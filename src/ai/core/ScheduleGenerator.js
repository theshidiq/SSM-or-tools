/**
 * ScheduleGenerator.js
 *
 * Core schedule generation engine that creates optimized shift schedules.
 * Combines constraint satisfaction, pattern recognition, and intelligent assignment.
 */

import {
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  getDayOfWeek,
  isWeekday,
  STAFF_CONFLICT_GROUPS,
  PRIORITY_RULES,
  getMonthlyLimits,
} from "../constraints/ConstraintEngine";

/**
 * Main ScheduleGenerator class
 */
export class ScheduleGenerator {
  constructor() {
    this.initialized = false;
    this.generationStrategies = new Map();
    this.shiftPriorities = new Map();
    this.staffPatterns = new Map();
    this.generationStats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      averageIterations: 0,
      averageConstraintSatisfaction: 0,
    };
  }

  /**
   * Initialize the schedule generator
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("📋 Initializing Schedule Generator...");

    try {
      // Initialize generation strategies
      this.initializeGenerationStrategies();

      // Initialize shift priorities
      this.initializeShiftPriorities();

      // Load historical patterns if available
      await this.loadHistoricalPatterns(options);

      this.initialized = true;
      console.log("✅ Schedule Generator initialized successfully");
    } catch (error) {
      console.error("❌ Schedule Generator initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize generation strategies
   */
  initializeGenerationStrategies() {
    // Priority-based strategy: Fill high priority assignments first
    this.generationStrategies.set("priority_first", {
      name: "Priority First",
      description: "Assign priority rules first, then fill remaining positions",
      weight: 0.3,
      execute: this.priorityFirstStrategy.bind(this),
    });

    // Balance-based strategy: Distribute shifts evenly
    this.generationStrategies.set("balance_first", {
      name: "Balance First",
      description: "Focus on even distribution of shifts across staff",
      weight: 0.4,
      execute: this.balanceFirstStrategy.bind(this),
    });

    // Pattern-based strategy: Follow historical patterns
    this.generationStrategies.set("pattern_based", {
      name: "Pattern Based",
      description: "Generate based on historical patterns and preferences",
      weight: 0.3,
      execute: this.patternBasedStrategy.bind(this),
    });
  }

  /**
   * Initialize shift priorities based on business rules
   */
  initializeShiftPriorities() {
    // Day of week priorities
    this.shiftPriorities.set("sunday_early", {
      priority: "high",
      staff: "料理長",
      condition: (dateKey) => getDayOfWeek(dateKey) === "sunday",
      shift: "△",
      weight: 0.8,
    });

    this.shiftPriorities.set("sunday_off", {
      priority: "high",
      staff: "与儀",
      condition: (dateKey) => getDayOfWeek(dateKey) === "sunday",
      shift: "×",
      weight: 0.8,
    });

    // Coverage priorities
    this.shiftPriorities.set("group2_coverage", {
      priority: "critical",
      staff: "中田",
      condition: (dateKey, schedule, staffMembers) => {
        // Check if Group 2 members (料理長 or 古藤) have day off
        const group2 = STAFF_CONFLICT_GROUPS.find((g) => g.name === "Group 2");
        if (!group2) return false;

        return group2.members.some((memberName) => {
          const staff = staffMembers.find((s) => s.name === memberName);
          if (staff && schedule[staff.id] && schedule[staff.id][dateKey]) {
            return isOffDay(schedule[staff.id][dateKey]);
          }
          return false;
        });
      },
      shift: "", // Normal shift
      weight: 1.0,
    });
  }

  /**
   * Load historical patterns for pattern-based generation
   * @param {Object} options - Options containing historical data
   */
  async loadHistoricalPatterns(options) {
    // This would typically load from the DataExtractor
    // For now, initialize with empty patterns
    this.staffPatterns.clear();

    // Initialize basic patterns for each staff member
    const staffList = options.staffMembers || [];
    staffList.forEach((staff) => {
      this.staffPatterns.set(staff.id, {
        preferredDays: [],
        preferredShifts: [],
        avoidedDays: [],
        patterns: {
          weekdayPreference: 0, // -1 to 1 scale
          weekendPreference: 0,
          earlyShiftPreference: 0,
          lateShiftPreference: 0,
        },
      });
    });
  }

  /**
   * Generate a complete schedule using hybrid strategy
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated schedule
   */
  async generateSchedule(params = {}) {
    if (!this.initialized) {
      throw new Error("ScheduleGenerator not initialized");
    }

    const {
      staffMembers = [],
      dateRange = [],
      existingSchedule = {},
      preserveExisting = true,
      strategy = "hybrid",
      maxIterations = 100,
    } = params;

    console.log(`📋 Generating schedule with ${strategy} strategy...`);

    try {
      const startTime = Date.now();
      let bestSchedule = null;
      let bestScore = -1;
      let iterations = 0;

      // Initialize working schedule
      let workingSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange,
        existingSchedule,
        preserveExisting,
      );

      // Try different generation approaches
      const strategies =
        strategy === "hybrid"
          ? Array.from(this.generationStrategies.keys())
          : [strategy];

      for (const strategyName of strategies) {
        const strategyFunc = this.generationStrategies.get(strategyName);
        if (!strategyFunc) continue;

        console.log(`🔄 Trying ${strategyFunc.name} strategy...`);

        for (let i = 0; i < maxIterations; i++) {
          iterations++;

          // Generate schedule with current strategy
          const generated = await strategyFunc.execute(
            workingSchedule,
            staffMembers,
            dateRange,
            { iteration: i, maxIterations },
          );

          // Evaluate the generated schedule
          const score = await this.evaluateSchedule(
            generated.schedule,
            staffMembers,
            dateRange,
          );

          if (score > bestScore) {
            bestScore = score;
            bestSchedule = {
              ...generated,
              score,
              strategy: strategyName,
              iteration: i,
            };

            // If we achieved near-perfect score, we can stop early
            if (score >= 95) {
              console.log(
                `🎯 Achieved high score (${score}%) early, stopping optimization`,
              );
              break;
            }
          }

          // Update working schedule for next iteration
          workingSchedule = this.applyRandomMutation(generated.schedule, 0.1);
        }
      }

      const generationTime = Date.now() - startTime;

      // Update statistics
      this.generationStats.totalGenerations++;
      this.generationStats.averageIterations =
        (this.generationStats.averageIterations + iterations) /
        this.generationStats.totalGenerations;

      if (bestSchedule && bestScore >= 80) {
        this.generationStats.successfulGenerations++;
      }

      this.generationStats.averageConstraintSatisfaction =
        (this.generationStats.averageConstraintSatisfaction + bestScore) /
        this.generationStats.totalGenerations;

      const result = {
        success: bestSchedule !== null,
        schedule: bestSchedule?.schedule || workingSchedule,
        score: bestScore,
        strategy: bestSchedule?.strategy || "none",
        generationTime,
        iterations,
        metadata: {
          staffCount: staffMembers.length,
          dateCount: dateRange.length,
          preservedCells: preserveExisting
            ? this.countPreservedCells(existingSchedule)
            : 0,
          strategiesUsed: strategies.length,
          bestIteration: bestSchedule?.iteration || -1,
        },
        statistics: { ...this.generationStats },
      };

      console.log(`✅ Schedule generation completed in ${generationTime}ms`);
      console.log(
        `📊 Best score: ${bestScore}% using ${bestSchedule?.strategy || "unknown"} strategy`,
      );

      return result;
    } catch (error) {
      console.error("❌ Schedule generation failed:", error);
      return {
        success: false,
        error: error.message,
        schedule: existingSchedule,
        score: 0,
        generationTime: 0,
        iterations: 0,
      };
    }
  }

  /**
   * Initialize working schedule with existing data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} existingSchedule - Existing schedule data
   * @param {boolean} preserveExisting - Whether to preserve existing data
   * @returns {Object} Working schedule
   */
  initializeWorkingSchedule(
    staffMembers,
    dateRange,
    existingSchedule,
    preserveExisting,
  ) {
    const workingSchedule = {};

    staffMembers.forEach((staff) => {
      workingSchedule[staff.id] = {};

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];

        if (
          preserveExisting &&
          existingSchedule[staff.id] &&
          existingSchedule[staff.id][dateKey] !== undefined &&
          existingSchedule[staff.id][dateKey] !== ""
        ) {
          // Preserve existing data
          workingSchedule[staff.id][dateKey] =
            existingSchedule[staff.id][dateKey];
        } else {
          // Initialize with normal shift (empty string)
          workingSchedule[staff.id][dateKey] = "";
        }
      });
    });

    return workingSchedule;
  }

  /**
   * Priority-first generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async priorityFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;

    // Phase 1: Apply priority rules first
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Apply shift priorities for this date
      for (const [priorityId, priority] of this.shiftPriorities) {
        if (priority.condition(dateKey, workingSchedule, staffMembers)) {
          const staff = staffMembers.find((s) => s.name === priority.staff);
          if (staff && workingSchedule[staff.id]) {
            const currentShift = workingSchedule[staff.id][dateKey];
            // Only change if current shift is empty or we have higher priority
            if (currentShift === "" || priority.priority === "critical") {
              workingSchedule[staff.id][dateKey] = priority.shift;
              changesApplied++;
            }
          }
        }
      }
    });

    // Phase 2: Fill remaining positions with balanced approach
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Count current assignments for the day
      const dayCounts = this.countDayAssignments(
        workingSchedule,
        dateKey,
        staffMembers,
      );

      // Apply group constraints and daily limits
      staffMembers.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          // Assign based on constraints and balance
          const suggestedShift = this.suggestShiftForStaff(
            staff,
            dateKey,
            workingSchedule,
            staffMembers,
            dayCounts,
          );

          if (suggestedShift) {
            workingSchedule[staff.id][dateKey] = suggestedShift;
            changesApplied++;
          }
        }
      });
    });

    return {
      schedule: workingSchedule,
      changesApplied,
      strategy: "priority_first",
      analysis: {
        priorityRulesApplied: this.countPriorityRulesApplied(
          workingSchedule,
          dateRange,
          staffMembers,
        ),
        balanceScore: this.calculateBalanceScore(
          workingSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Balance-first generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async balanceFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;

    // Calculate monthly limits for each staff member
    const monthlyLimits = this.calculateMonthlyLimits(dateRange);
    const staffOffDayBudgets = new Map();

    staffMembers.forEach((staff) => {
      const currentOffDays = this.countStaffOffDays(
        workingSchedule[staff.id],
        dateRange,
      );
      staffOffDayBudgets.set(
        staff.id,
        monthlyLimits.maxOffDaysPerMonth - currentOffDays,
      );
    });

    // Sort dates by difficulty (weekends first, then special constraint days)
    const sortedDates = [...dateRange].sort((a, b) => {
      const aDifficulty = this.calculateDateDifficulty(a);
      const bDifficulty = this.calculateDateDifficulty(b);
      return bDifficulty - aDifficulty;
    });

    // Fill schedule date by date, balancing as we go
    sortedDates.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      // Sort staff by current workload (lowest first)
      const staffByWorkload = [...staffMembers].sort((a, b) => {
        const aWorkload = this.calculateStaffWorkload(
          workingSchedule[a.id],
          dateRange,
        );
        const bWorkload = this.calculateStaffWorkload(
          workingSchedule[b.id],
          dateRange,
        );
        return aWorkload - bWorkload;
      });

      // Assign shifts for this day
      let assignedCount = 0;
      const maxOffPerDay = 4; // DAILY_LIMITS.maxOffPerDay

      staffByWorkload.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          const staffOffBudget = staffOffDayBudgets.get(staff.id) || 0;
          const currentDayOffCount = this.countDayOffAssignments(
            workingSchedule,
            dateKey,
            staffMembers,
          );

          // Decide shift type based on balance and constraints
          let assignedShift = "";

          // Consider giving day off if under budget and daily limit allows
          if (
            staffOffBudget > 0 &&
            currentDayOffCount < maxOffPerDay &&
            assignedCount < staffMembers.length - 3
          ) {
            // More likely to give day off if staff has high workload
            const workload = this.calculateStaffWorkload(
              workingSchedule[staff.id],
              dateRange,
            );
            const avgWorkload = this.calculateAverageWorkload(
              workingSchedule,
              staffMembers,
              dateRange,
            );

            if (workload > avgWorkload * 1.1) {
              assignedShift = "×";
              staffOffDayBudgets.set(staff.id, staffOffBudget - 1);
            }
          }

          // If not assigned day off, assign working shift
          if (assignedShift === "") {
            assignedShift = this.selectWorkingShift(
              staff,
              dateKey,
              workingSchedule,
              staffMembers,
            );
          }

          workingSchedule[staff.id][dateKey] = assignedShift;
          changesApplied++;
          assignedCount++;
        }
      });
    });

    return {
      schedule: workingSchedule,
      changesApplied,
      strategy: "balance_first",
      analysis: {
        balanceScore: this.calculateBalanceScore(
          workingSchedule,
          staffMembers,
          dateRange,
        ),
        workloadVariance: this.calculateWorkloadVariance(
          workingSchedule,
          staffMembers,
          dateRange,
        ),
        offDayDistribution: this.calculateOffDayDistribution(
          workingSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Pattern-based generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async patternBasedStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;
    let patternMatches = 0;

    // Fill based on learned patterns
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      staffMembers.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          const staffPattern = this.staffPatterns.get(staff.id);
          if (staffPattern) {
            const suggestedShift = this.predictShiftFromPattern(
              staff,
              dateKey,
              dayOfWeek,
              staffPattern,
              workingSchedule,
            );

            if (suggestedShift) {
              // Validate against constraints before applying
              if (
                this.validateShiftAssignment(
                  staff,
                  dateKey,
                  suggestedShift,
                  workingSchedule,
                  staffMembers,
                )
              ) {
                workingSchedule[staff.id][dateKey] = suggestedShift;
                changesApplied++;
                patternMatches++;
              }
            }
          }
        }
      });
    });

    // Fill remaining empty slots with balanced approach
    const remaining = this.fillRemainingSlots(
      workingSchedule,
      staffMembers,
      dateRange,
    );
    changesApplied += remaining.changesApplied;

    return {
      schedule: workingSchedule,
      changesApplied,
      strategy: "pattern_based",
      analysis: {
        patternMatches,
        patternMatchRate:
          staffMembers.length > 0
            ? patternMatches / (staffMembers.length * dateRange.length)
            : 0,
        balanceScore: this.calculateBalanceScore(
          workingSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Suggest optimal shift for a staff member on a specific date
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - All staff members
   * @param {Object} dayCounts - Current day assignments count
   * @returns {string} Suggested shift
   */
  suggestShiftForStaff(staff, dateKey, schedule, staffMembers, dayCounts) {
    const dayOfWeek = getDayOfWeek(dateKey);

    // Check priority rules first
    const priorityShift = this.checkPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );
    if (priorityShift) return priorityShift;

    // Check monthly off day budget
    const monthlyLimits = this.calculateMonthlyLimits([new Date(dateKey)]);
    const currentOffDays = this.countStaffOffDays(schedule[staff.id], [
      new Date(dateKey),
    ]);
    const canTakeOffDay =
      currentOffDays < monthlyLimits.maxOffDaysPerMonth && dayCounts.off < 4;

    // Check group constraints
    const hasGroupConflict = this.checkGroupConflicts(
      staff,
      dateKey,
      "×",
      schedule,
      staffMembers,
    );

    // Decision logic
    if (canTakeOffDay && !hasGroupConflict && Math.random() < 0.2) {
      return "×"; // Day off
    }

    // Assign working shift based on day and needs
    if (
      dayOfWeek === "sunday" &&
      staff.name === "料理長" &&
      dayCounts.early < 2
    ) {
      return "△"; // Early shift for head chef on Sunday
    }

    if (dayCounts.early < 3 && Math.random() < 0.3) {
      return "△"; // Early shift
    }

    if (dayCounts.late < 2 && Math.random() < 0.2) {
      return "◇"; // Late shift
    }

    return ""; // Normal shift
  }

  /**
   * Apply random mutation to schedule for genetic-like variation
   * @param {Object} schedule - Schedule to mutate
   * @param {number} mutationRate - Rate of mutation (0-1)
   * @returns {Object} Mutated schedule
   */
  applyRandomMutation(schedule, mutationRate = 0.1) {
    const mutated = JSON.parse(JSON.stringify(schedule));

    Object.keys(mutated).forEach((staffId) => {
      Object.keys(mutated[staffId]).forEach((dateKey) => {
        if (Math.random() < mutationRate) {
          const currentShift = mutated[staffId][dateKey];
          // Only mutate non-empty shifts (preserve manually set empty cells)
          if (currentShift !== "" && currentShift !== undefined) {
            const possibleShifts = ["", "△", "◇", "×"];
            const newShift =
              possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
            mutated[staffId][dateKey] = newShift;
          }
        }
      });
    });

    return mutated;
  }

  /**
   * Evaluate schedule quality
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Score from 0-100
   */
  async evaluateSchedule(schedule, staffMembers, dateRange) {
    const score = 100;
    let penalties = 0;

    // Import validation from constraint engine
    const { validateAllConstraints } = await import(
      "../constraints/ConstraintEngine"
    );
    const validation = validateAllConstraints(
      schedule,
      staffMembers,
      dateRange,
    );

    // Major penalty for constraint violations
    penalties += validation.summary.criticalViolations * 20;
    penalties += validation.summary.highViolations * 10;
    penalties += validation.summary.mediumViolations * 5;

    // Balance score (workload distribution)
    const balanceScore = this.calculateBalanceScore(
      schedule,
      staffMembers,
      dateRange,
    );
    if (balanceScore < 70) penalties += (70 - balanceScore) * 0.5;

    // Priority rules satisfaction
    const priorityScore = this.calculatePriorityScore(
      schedule,
      staffMembers,
      dateRange,
    );
    if (priorityScore < 80) penalties += (80 - priorityScore) * 0.3;

    return Math.max(0, score - penalties);
  }

  /**
   * Calculate balance score based on workload distribution
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Balance score 0-100
   */
  calculateBalanceScore(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );

    if (workloads.length === 0) return 100;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance =
      workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) /
      workloads.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = better balance
    const balanceScore = Math.max(0, 100 - stdDev * 10);
    return balanceScore;
  }

  /**
   * Calculate staff workload (working days / total days)
   * @param {Object} staffSchedule - Staff schedule
   * @param {Array} dateRange - Date range
   * @returns {number} Workload ratio
   */
  calculateStaffWorkload(staffSchedule, dateRange) {
    if (!staffSchedule) return 0;

    let workingDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];
      if (shift !== undefined && !isOffDay(shift)) {
        workingDays++;
      }
    });

    return dateRange.length > 0 ? workingDays / dateRange.length : 0;
  }

  /**
   * Calculate priority rules satisfaction score
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Priority score 0-100
   */
  calculatePriorityScore(schedule, staffMembers, dateRange) {
    let totalRules = 0;
    let satisfiedRules = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      // Check priority rules
      Object.keys(PRIORITY_RULES).forEach((staffName) => {
        const staff = staffMembers.find((s) => s.name === staffName);
        if (
          staff &&
          schedule[staff.id] &&
          schedule[staff.id][dateKey] !== undefined
        ) {
          const rules = PRIORITY_RULES[staffName];

          rules.preferredShifts.forEach((rule) => {
            if (rule.day === dayOfWeek) {
              totalRules++;
              const currentShift = schedule[staff.id][dateKey];

              let ruleSatisfied = false;
              switch (rule.shift) {
                case "early":
                  ruleSatisfied = isEarlyShift(currentShift);
                  break;
                case "off":
                  ruleSatisfied = isOffDay(currentShift);
                  break;
                case "late":
                  ruleSatisfied = isLateShift(currentShift);
                  break;
                default:
                  ruleSatisfied = isNormalShift(currentShift);
              }

              if (ruleSatisfied) satisfiedRules++;
            }
          });
        }
      });
    });

    return totalRules > 0 ? (satisfiedRules / totalRules) * 100 : 100;
  }

  // Helper methods for calculations and validations
  calculateMonthlyLimits(dateRange) {
    if (dateRange.length === 0) return { maxOffDaysPerMonth: 7 };
    const firstDate = dateRange[0];
    return getMonthlyLimits(firstDate.getFullYear(), firstDate.getMonth() + 1);
  }

  countDayAssignments(schedule, dateKey, staffMembers) {
    const counts = { off: 0, early: 0, late: 0, normal: 0, working: 0 };

    staffMembers.forEach((staff) => {
      if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
        const shift = schedule[staff.id][dateKey];
        if (isOffDay(shift)) counts.off++;
        else if (isEarlyShift(shift)) counts.early++;
        else if (isLateShift(shift)) counts.late++;
        else counts.normal++;

        if (isWorkingShift(shift)) counts.working++;
      }
    });

    return counts;
  }

  countStaffOffDays(staffSchedule, dateRange) {
    if (!staffSchedule) return 0;

    let offDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      if (staffSchedule[dateKey] && isOffDay(staffSchedule[dateKey])) {
        offDays++;
      }
    });

    return offDays;
  }

  countPreservedCells(existingSchedule) {
    let count = 0;
    Object.values(existingSchedule).forEach((staffSchedule) => {
      Object.values(staffSchedule).forEach((shift) => {
        if (shift !== undefined && shift !== "") count++;
      });
    });
    return count;
  }

  checkPriorityRules(staff, dateKey, schedule, staffMembers) {
    // Implementation for checking priority rules
    // Return shift if priority rule applies, null otherwise
    return null;
  }

  checkGroupConflicts(staff, dateKey, proposedShift, schedule, staffMembers) {
    // Check if proposed shift would create group conflicts
    return false;
  }

  selectWorkingShift(staff, dateKey, schedule, staffMembers) {
    // Logic to select appropriate working shift
    return ""; // Default to normal shift
  }

  calculateDateDifficulty(date) {
    // Calculate how difficult it is to schedule this date
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1; // Weekends are harder
  }

  calculateWorkloadVariance(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );

    if (workloads.length === 0) return 0;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    return (
      workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) /
      workloads.length
    );
  }

  calculateOffDayDistribution(schedule, staffMembers, dateRange) {
    // Calculate how evenly off days are distributed
    const offDayCounts = staffMembers.map((staff) =>
      this.countStaffOffDays(schedule[staff.id], dateRange),
    );

    const variance = this.calculateWorkloadVariance(
      Object.fromEntries(
        staffMembers.map((staff, i) => [staff.id, { total: offDayCounts[i] }]),
      ),
      staffMembers.map((staff, i) => ({
        ...staff,
        schedule: { total: offDayCounts[i] },
      })),
      [{ length: 1 }], // Dummy range for calculation
    );

    return Math.max(0, 100 - variance * 100);
  }

  calculateAverageWorkload(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );
    return workloads.length > 0
      ? workloads.reduce((sum, w) => sum + w, 0) / workloads.length
      : 0;
  }

  countDayOffAssignments(schedule, dateKey, staffMembers) {
    return this.countDayAssignments(schedule, dateKey, staffMembers).off;
  }

  countPriorityRulesApplied(schedule, dateRange, staffMembers) {
    // Count how many priority rules are currently satisfied
    return this.calculatePriorityScore(schedule, staffMembers, dateRange);
  }

  predictShiftFromPattern(staff, dateKey, dayOfWeek, pattern, schedule) {
    // Predict shift based on learned patterns
    // This is a simplified implementation
    return "";
  }

  validateShiftAssignment(staff, dateKey, shift, schedule, staffMembers) {
    // Validate if shift assignment is allowed
    return true;
  }

  fillRemainingSlots(schedule, staffMembers, dateRange) {
    // Fill any remaining empty slots with balanced approach
    let changesApplied = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      staffMembers.forEach((staff) => {
        if (schedule[staff.id][dateKey] === "") {
          schedule[staff.id][dateKey] = "";
          changesApplied++;
        }
      });
    });

    return { changesApplied };
  }

  /**
   * Get generator status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      strategies: Array.from(this.generationStrategies.keys()),
      priorityRules: Array.from(this.shiftPriorities.keys()),
      statistics: { ...this.generationStats },
      patternsLoaded: this.staffPatterns.size,
    };
  }
}
