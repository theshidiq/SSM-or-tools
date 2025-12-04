/**
 * CSPSolver.js
 *
 * Constraint Satisfaction Problem solver for shift scheduling.
 * Uses backtracking with constraint propagation and heuristics.
 */

import {
  isOffDay,
  isEarlyShift,
  isWorkingShift,
  getDayOfWeek,
  PRIORITY_RULES,
  getDailyLimitsSync, // ✅ Phase 3: Import sync getter for dynamic limits
  getMonthlyLimits,
  getStaffConflictGroups,
} from "../constraints/ConstraintEngine";

/**
 * CSP Solver for shift scheduling
 */
export class CSPSolver {
  constructor(options = {}) {
    this.initialized = false;
    this.domain = ["", "△", "◇", "×"]; // Possible shift values
    this.constraints = [];
    this.staffGroups = []; // ✅ Database-only staff groups
    // ✅ Phase 3: Daily limits from options or dynamic getter
    this.dailyLimits = options.dailyLimits || getDailyLimitsSync();
    this.heuristics = {
      variableOrdering: "most_constrained_first",
      valueOrdering: "least_constraining_first",
      constraintPropagation: true,
      forwardChecking: true,
    };
    this.solutionStats = {
      totalSolutions: 0,
      successfulSolutions: 0,
      averageSolutionTime: 0,
      averageBacktracks: 0,
      constraintChecks: 0,
    };

    // ✅ Phase 3: Log daily limits source
    if (options.dailyLimits) {
      console.log('[CSPSolver] Using provided daily limits:', this.dailyLimits);
    } else {
      console.log('[CSPSolver] Using dynamic/static daily limits:', this.dailyLimits);
    }
  }

  /**
   * Initialize the CSP solver
   * @param {Object} options - Initialization options
   */
  initialize(options = {}) {
    // Initializing CSP Solver

    try {
      // Set up constraint types
      this.initializeConstraints();

      // Configure heuristics
      if (options.heuristics) {
        this.heuristics = { ...this.heuristics, ...options.heuristics };
      }

      this.initialized = true;
      // CSP Solver initialized successfully
    } catch (error) {
      console.error("❌ CSP Solver initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize constraint definitions
   */
  initializeConstraints() {
    this.constraints = [
      {
        name: "monthly_off_limits",
        type: "unary",
        priority: "high",
        check: this.checkMonthlyOffLimits.bind(this),
      },
      {
        name: "daily_limits",
        type: "global",
        priority: "high",
        check: this.checkDailyLimits.bind(this),
      },
      {
        name: "staff_group_conflicts",
        type: "global",
        priority: "critical",
        check: this.checkStaffGroupConflicts.bind(this),
      },
      {
        name: "coverage_compensation",
        type: "global",
        priority: "critical",
        check: this.checkCoverageCompensation.bind(this),
      },
      {
        name: "priority_rules",
        type: "unary",
        priority: "medium",
        check: this.checkPriorityRules.bind(this),
      },
    ];
  }

  /**
   * Generate schedule using CSP solving
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated schedule result
   */
  async generateSchedule(params = {}) {
    if (!this.initialized) {
      throw new Error("CSP Solver not initialized");
    }

    const {
      staffMembers = [],
      dateRange = [],
      existingSchedule = {},
      preserveExisting = true,
      timeLimit = 30000, // 30 seconds
    } = params;

    // Generating schedule using CSP solver

    try {
      const startTime = Date.now();

      // ✅ Load staff groups from database
      this.staffGroups = await getStaffConflictGroups();

      // Initialize problem
      const problem = this.initializeProblem(
        staffMembers,
        dateRange,
        existingSchedule,
        preserveExisting,
      );

      // Solve using backtracking with constraint propagation
      const solution = await this.solve(problem, {
        timeLimit: startTime + timeLimit,
      });

      const solutionTime = Date.now() - startTime;

      // Update statistics
      this.solutionStats.totalSolutions++;
      this.solutionStats.averageSolutionTime =
        (this.solutionStats.averageSolutionTime + solutionTime) /
        this.solutionStats.totalSolutions;

      if (solution.success) {
        this.solutionStats.successfulSolutions++;
      }

      // CSP solving completed

      return {
        success: solution.success,
        schedule:
          solution.schedule ||
          this.convertProblemToSchedule(problem, staffMembers, dateRange),
        solutionTime,
        backtracks: solution.backtracks || 0,
        constraintChecks: solution.constraintChecks || 0,
        completeness: solution.completeness || 0,
        feasible: solution.feasible !== false,
        metadata: {
          algorithm: "backtracking_with_constraint_propagation",
          heuristics: this.heuristics,
          problemSize: {
            variables: staffMembers.length * dateRange.length,
            constraints: this.constraints.length,
            domainSize: this.domain.length,
          },
        },
      };
    } catch (error) {
      console.error("❌ CSP solving failed:", error);
      return {
        success: false,
        error: error.message,
        schedule: existingSchedule,
        solutionTime: 0,
        backtracks: 0,
        constraintChecks: 0,
      };
    }
  }

  /**
   * Initialize CSP problem from parameters
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} existingSchedule - Existing assignments
   * @param {boolean} preserveExisting - Whether to preserve existing data
   * @returns {Object} CSP problem representation
   */
  initializeProblem(
    staffMembers,
    dateRange,
    existingSchedule,
    preserveExisting,
  ) {
    const variables = [];
    const domains = new Map();
    const assignments = new Map();

    // Create variables for each staff-date combination
    staffMembers.forEach((staff) => {
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const variable = `${staff.id}_${dateKey}`;

        variables.push({
          id: variable,
          staffId: staff.id,
          staffName: staff.name,
          dateKey,
          date,
          dayOfWeek: getDayOfWeek(dateKey),
        });

        // Set domain (possible values)
        if (
          preserveExisting &&
          existingSchedule[staff.id] &&
          existingSchedule[staff.id][dateKey] !== undefined &&
          existingSchedule[staff.id][dateKey] !== ""
        ) {
          // Fixed assignment - domain contains only existing value
          const existingValue = existingSchedule[staff.id][dateKey];
          domains.set(variable, [existingValue]);
          assignments.set(variable, existingValue);
        } else {
          // Full domain available
          domains.set(variable, [...this.domain]);
        }
      });
    });

    return {
      variables,
      domains,
      assignments,
      staffMembers,
      dateRange,
      constraints: this.constraints,
      metadata: {
        variableCount: variables.length,
        averageDomainSize:
          Array.from(domains.values()).reduce(
            (sum, domain) => sum + domain.length,
            0,
          ) / domains.size,
        fixedAssignments: assignments.size,
      },
    };
  }

  /**
   * Solve CSP using backtracking with constraint propagation
   * @param {Object} problem - CSP problem
   * @param {Object} options - Solving options
   * @returns {Object} Solution result
   */
  async solve(problem, options = {}) {
    const { timeLimit = Date.now() + 30000 } = options;
    const stats = {
      backtracks: 0,
      constraintChecks: 0,
      assignments: 0,
    };

    // Apply initial constraint propagation
    if (this.heuristics.constraintPropagation) {
      const propagationResult = this.propagateConstraints(problem);
      if (!propagationResult.consistent) {
        return {
          success: false,
          feasible: false,
          backtracks: stats.backtracks,
          constraintChecks: stats.constraintChecks,
          message: "Problem is inconsistent after initial propagation",
        };
      }
    }

    // Start backtracking
    const result = await this.backtrack(problem, stats, timeLimit);

    return {
      success: result.success,
      schedule: result.success
        ? this.convertProblemToSchedule(
            problem,
            problem.staffMembers,
            problem.dateRange,
          )
        : null,
      backtracks: stats.backtracks,
      constraintChecks: stats.constraintChecks,
      completeness: this.calculateCompleteness(problem),
      feasible: result.feasible !== false,
    };
  }

  /**
   * Backtracking algorithm implementation
   * @param {Object} problem - CSP problem
   * @param {Object} stats - Statistics tracking
   * @param {number} timeLimit - Time limit timestamp
   * @returns {Object} Backtracking result
   */
  async backtrack(problem, stats, timeLimit) {
    // Check time limit
    if (Date.now() > timeLimit) {
      return { success: false, timeout: true };
    }

    // Check if assignment is complete
    if (this.isComplete(problem)) {
      return { success: true };
    }

    // Select next variable using heuristic
    const variable = this.selectVariable(problem);
    if (!variable) {
      return { success: false };
    }

    // Get domain values in order
    const values = this.orderDomainValues(problem, variable);

    for (const value of values) {
      stats.assignments++;

      // Check if value is consistent with current assignments
      if (this.isConsistent(problem, variable, value, stats)) {
        // Make assignment
        problem.assignments.set(variable.id, value);

        // Apply constraint propagation
        const domainBackup = new Map();
        if (this.heuristics.constraintPropagation) {
          // Backup domains before propagation
          problem.domains.forEach((domain, varId) => {
            domainBackup.set(varId, [...domain]);
          });

          const propagationResult = this.propagateConstraints(
            problem,
            variable,
            value,
          );
          if (!propagationResult.consistent) {
            // Restore domains and backtrack
            problem.domains = domainBackup;
            problem.assignments.delete(variable.id);
            stats.backtracks++;
            continue;
          }
        }

        // Recursive call
        const result = await this.backtrack(problem, stats, timeLimit);
        if (result.success) {
          return result;
        }

        // Backtrack - undo assignment
        problem.assignments.delete(variable.id);
        if (this.heuristics.constraintPropagation && domainBackup.size > 0) {
          problem.domains = domainBackup;
        }
        stats.backtracks++;
      }
    }

    return { success: false };
  }

  /**
   * Select next variable to assign using heuristic
   * @param {Object} problem - CSP problem
   * @returns {Object} Selected variable
   */
  selectVariable(problem) {
    const unassigned = problem.variables.filter(
      (v) => !problem.assignments.has(v.id),
    );

    if (unassigned.length === 0) return null;

    switch (this.heuristics.variableOrdering) {
      case "most_constrained_first":
        // Choose variable with smallest domain (MRV heuristic)
        return unassigned.reduce((best, current) => {
          const currentDomainSize =
            problem.domains.get(current.id)?.length || 0;
          const bestDomainSize = problem.domains.get(best.id)?.length || 0;
          return currentDomainSize < bestDomainSize ? current : best;
        });

      case "most_constraining_first":
        // Choose variable that constrains the most other variables
        return unassigned.reduce((best, current) => {
          const currentConstraining = this.countConstrainingRelations(
            problem,
            current,
          );
          const bestConstraining = this.countConstrainingRelations(
            problem,
            best,
          );
          return currentConstraining > bestConstraining ? current : best;
        });

      case "first_unassigned":
      default:
        return unassigned[0];
    }
  }

  /**
   * Order domain values using heuristic
   * @param {Object} problem - CSP problem
   * @param {Object} variable - Variable to order values for
   * @returns {Array} Ordered domain values
   */
  orderDomainValues(problem, variable) {
    const domain = problem.domains.get(variable.id) || [];

    switch (this.heuristics.valueOrdering) {
      case "least_constraining_first":
        // Order by how many future options each value eliminates
        return domain.sort((a, b) => {
          const aConstraining = this.countValueConstraining(
            problem,
            variable,
            a,
          );
          const bConstraining = this.countValueConstraining(
            problem,
            variable,
            b,
          );
          return aConstraining - bConstraining;
        });

      case "most_likely_first":
        // Order by likelihood based on problem context
        return this.orderByLikelihood(problem, variable, domain);

      case "random":
        return domain.sort(() => Math.random() - 0.5);

      default:
        return [...domain];
    }
  }

  /**
   * Check if assignment is consistent with constraints
   * @param {Object} problem - CSP problem
   * @param {Object} variable - Variable being assigned
   * @param {string} value - Value being assigned
   * @param {Object} stats - Statistics object
   * @returns {boolean} True if consistent
   */
  isConsistent(problem, variable, value, stats) {
    // Create temporary assignment for checking
    const tempAssignments = new Map(problem.assignments);
    tempAssignments.set(variable.id, value);

    // Check all constraints
    for (const constraint of problem.constraints) {
      stats.constraintChecks++;

      if (
        !this.checkConstraint(
          constraint,
          problem,
          tempAssignments,
          variable,
          value,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check a specific constraint
   * @param {Object} constraint - Constraint to check
   * @param {Object} problem - CSP problem
   * @param {Map} assignments - Current assignments
   * @param {Object} variable - Variable being assigned
   * @param {string} value - Value being assigned
   * @returns {boolean} True if constraint is satisfied
   */
  checkConstraint(constraint, problem, assignments, variable, value) {
    try {
      return constraint.check(problem, assignments, variable, value);
    } catch (error) {
      console.warn(`Constraint check failed for ${constraint.name}:`, error);
      return false;
    }
  }

  /**
   * Propagate constraints to reduce domains
   * @param {Object} problem - CSP problem
   * @param {Object} assignedVariable - Recently assigned variable
   * @param {string} assignedValue - Recently assigned value
   * @returns {Object} Propagation result
   */
  propagateConstraints(
    problem,
    _assignedVariable = null,
    _assignedValue = null,
  ) {
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Apply arc consistency
      for (const variable of problem.variables) {
        if (problem.assignments.has(variable.id)) continue;

        const originalDomain = problem.domains.get(variable.id) || [];
        const newDomain = [];

        for (const value of originalDomain) {
          let consistent = true;

          // Check consistency with all constraints
          for (const constraint of problem.constraints) {
            const tempAssignments = new Map(problem.assignments);
            tempAssignments.set(variable.id, value);

            if (
              !this.checkConstraint(
                constraint,
                problem,
                tempAssignments,
                variable,
                value,
              )
            ) {
              consistent = false;
              break;
            }
          }

          if (consistent) {
            newDomain.push(value);
          }
        }

        // Update domain if it changed
        if (newDomain.length !== originalDomain.length) {
          problem.domains.set(variable.id, newDomain);
          changed = true;

          // Check for empty domain (inconsistency)
          if (newDomain.length === 0) {
            return { consistent: false, emptyDomain: variable.id };
          }
        }
      }
    }

    return { consistent: true, iterations };
  }

  // Constraint checking methods
  checkMonthlyOffLimits(problem, assignments, variable, value) {
    if (!isOffDay(value)) return true;

    const staffId = variable.staffId;
    const firstDate = problem.dateRange[0];
    const monthlyLimits = getMonthlyLimits(
      firstDate.getFullYear(),
      firstDate.getMonth() + 1,
    );

    // Count off days for this staff member
    let offDays = 0;
    problem.variables.forEach((v) => {
      if (v.staffId === staffId && assignments.has(v.id)) {
        if (isOffDay(assignments.get(v.id))) {
          offDays++;
        }
      }
    });

    return offDays < monthlyLimits.maxOffDaysPerMonth;
  }

  checkDailyLimits(problem, assignments, variable, value) {
    const dateKey = variable.dateKey;
    // ✅ Phase 3: Use instance daily limits (dynamic from database)
    const limits = this.dailyLimits;

    // Count assignments for this date
    let offCount = 0;
    let earlyCount = 0;
    let lateCount = 0;
    let workingCount = 0;

    problem.variables.forEach((v) => {
      if (v.dateKey === dateKey && assignments.has(v.id)) {
        const assignedValue = assignments.get(v.id);
        if (isOffDay(assignedValue)) offCount++;
        else if (isEarlyShift(assignedValue)) earlyCount++;
        else if (assignedValue === '◇') lateCount++; // Late shift
        if (isWorkingShift(assignedValue)) workingCount++;
      }
    });

    // ✅ Phase 3: Check MAX limits using dynamic daily limits
    if (isOffDay(value) && offCount >= limits.maxOffPerDay) return false;
    if (isEarlyShift(value) && earlyCount >= limits.maxEarlyPerDay) return false;
    if (value === '◇' && lateCount >= limits.maxLatePerDay) return false;

    // ✅ Phase 3: Check minimum working staff using dynamic limits
    const totalStaffForDate = problem.variables.filter(
      (v) => v.dateKey === dateKey,
    ).length;
    const maxOffAllowed = totalStaffForDate - limits.minWorkingStaffPerDay;
    if (isOffDay(value) && offCount >= maxOffAllowed) return false;

    return true;
  }

  checkStaffGroupConflicts(problem, assignments, variable, value) {
    if (!isOffDay(value) && !isEarlyShift(value)) return true;

    const staffName = variable.staffName;
    const dateKey = variable.dateKey;

    // Check each staff group (from database)
    for (const group of this.staffGroups) {
      if (!group.members.includes(staffName)) continue;

      let conflictCount = 0;

      // Count other group members with off/early on same date
      group.members.forEach((memberName) => {
        if (memberName === staffName) return;

        const memberVariable = problem.variables.find(
          (v) => v.staffName === memberName && v.dateKey === dateKey,
        );

        if (memberVariable && assignments.has(memberVariable.id)) {
          const memberValue = assignments.get(memberVariable.id);
          if (isOffDay(memberValue) || isEarlyShift(memberValue)) {
            conflictCount++;
          }
        }
      });

      // If assigning off/early would create conflict, reject
      if (conflictCount >= 1) {
        return false;
      }
    }

    return true;
  }

  checkCoverageCompensation(problem, assignments, variable, value) {
    const dateKey = variable.dateKey;
    const staffName = variable.staffName;

    // Find Group 2 (料理長, 古藤) from database
    const group2 = this.staffGroups.find((g) => g.name === "Group 2");
    if (!group2 || !group2.coverageRule) return true;

    const backupStaff = group2.coverageRule.backupStaff;

    // If this is the backup staff (中田)
    if (staffName === backupStaff) {
      // Check if any Group 2 member has day off
      let group2MemberOff = false;

      group2.members.forEach((memberName) => {
        const memberVariable = problem.variables.find(
          (v) => v.staffName === memberName && v.dateKey === dateKey,
        );

        if (memberVariable && assignments.has(memberVariable.id)) {
          if (isOffDay(assignments.get(memberVariable.id))) {
            group2MemberOff = true;
          }
        }
      });

      // If Group 2 member is off, backup must work normal shift
      if (group2MemberOff && !isWorkingShift(value)) {
        return false;
      }
    }

    return true;
  }

  checkPriorityRules(problem, assignments, variable, value) {
    const staffName = variable.staffName;
    const dayOfWeek = variable.dayOfWeek;

    if (!PRIORITY_RULES[staffName]) return true;

    const rules = PRIORITY_RULES[staffName];

    for (const rule of rules.preferredShifts) {
      if (rule.day === dayOfWeek) {
        let expectedShift = "";
        switch (rule.shift) {
          case "early":
            expectedShift = "△";
            break;
          case "off":
            expectedShift = "×";
            break;
          case "late":
            expectedShift = "◇";
            break;
          default:
            expectedShift = "";
        }

        // For high priority rules, enforce strictly
        if (rule.priority === "high" && value !== expectedShift) {
          return false;
        }
      }
    }

    return true;
  }

  // Helper methods
  isComplete(problem) {
    return problem.assignments.size === problem.variables.length;
  }

  calculateCompleteness(problem) {
    return problem.variables.length > 0
      ? (problem.assignments.size / problem.variables.length) * 100
      : 100;
  }

  countConstrainingRelations(problem, variable) {
    // Count how many other variables this variable constrains
    let count = 0;

    problem.variables.forEach((otherVar) => {
      if (otherVar.id !== variable.id) {
        // Check if they share constraints (same date, same staff group, etc.)
        if (
          otherVar.dateKey === variable.dateKey ||
          this.shareStaffGroup(variable.staffName, otherVar.staffName)
        ) {
          count++;
        }
      }
    });

    return count;
  }

  countValueConstraining(problem, variable, value) {
    // Count how many future options this value eliminates
    let eliminated = 0;

    problem.variables.forEach((otherVar) => {
      if (
        otherVar.id !== variable.id &&
        !problem.assignments.has(otherVar.id)
      ) {
        const otherDomain = problem.domains.get(otherVar.id) || [];

        otherDomain.forEach((otherValue) => {
          // Simulate assignment and check if it would be consistent
          const tempAssignments = new Map(problem.assignments);
          tempAssignments.set(variable.id, value);
          tempAssignments.set(otherVar.id, otherValue);

          let consistent = true;
          for (const constraint of problem.constraints) {
            if (
              !this.checkConstraint(
                constraint,
                problem,
                tempAssignments,
                otherVar,
                otherValue,
              )
            ) {
              consistent = false;
              break;
            }
          }

          if (!consistent) eliminated++;
        });
      }
    });

    return eliminated;
  }

  orderByLikelihood(problem, variable, domain) {
    // Order values by likelihood based on context
    const priorities = [];

    domain.forEach((value) => {
      let score = 50; // Base score

      // Prefer normal shifts
      if (value === "") score += 20;

      // Consider day of week
      if (variable.dayOfWeek === "sunday") {
        if (variable.staffName === "料理長" && value === "△") score += 30;
        if (variable.staffName === "与儀" && value === "×") score += 30;
      }

      // Avoid too many off days
      if (isOffDay(value)) score -= 10;

      priorities.push({ value, score });
    });

    return priorities.sort((a, b) => b.score - a.score).map((p) => p.value);
  }

  shareStaffGroup(staffName1, staffName2) {
    return this.staffGroups.some(
      (group) =>
        group.members.includes(staffName1) &&
        group.members.includes(staffName2),
    );
  }

  convertProblemToSchedule(problem, staffMembers, dateRange) {
    const schedule = {};

    staffMembers.forEach((staff) => {
      schedule[staff.id] = {};

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const variableId = `${staff.id}_${dateKey}`;

        const assignedValue = problem.assignments.get(variableId);
        schedule[staff.id][dateKey] =
          assignedValue !== undefined ? assignedValue : "";
      });
    });

    return schedule;
  }

  /**
   * Get solver status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      domain: [...this.domain],
      constraints: this.constraints.map((c) => ({
        name: c.name,
        type: c.type,
        priority: c.priority,
      })),
      heuristics: { ...this.heuristics },
      statistics: { ...this.solutionStats },
      // ✅ Phase 3: Include daily limits in status
      dailyLimits: { ...this.dailyLimits },
      successRate:
        this.solutionStats.totalSolutions > 0
          ? (this.solutionStats.successfulSolutions /
              this.solutionStats.totalSolutions) *
            100
          : 0,
    };
  }

  /**
   * ✅ Phase 3: Update daily limits at runtime
   * @param {Object} newLimits - New daily limits to use
   */
  updateDailyLimits(newLimits) {
    if (newLimits && typeof newLimits === 'object') {
      this.dailyLimits = { ...this.dailyLimits, ...newLimits };
      console.log('[CSPSolver] Daily limits updated:', this.dailyLimits);
    }
  }
}
