/**
 * ConflictResolver.js
 *
 * Automatic conflict resolution system for shift scheduling.
 * Resolves constraint violations using priority-based strategies and intelligent algorithms.
 */

import {
  validateAllConstraints,
  getViolationRecommendations,
  VIOLATION_TYPES,
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  getDayOfWeek,
  isWeekday,
} from "../constraints/ConstraintEngine";

/**
 * ConflictResolver class for automatic constraint violation resolution
 */
export class ConflictResolver {
  constructor() {
    this.initialized = false;
    this.resolutionStrategies = new Map();
    this.resolutionHistory = [];
    this.performanceMetrics = {
      totalResolutions: 0,
      successfulResolutions: 0,
      averageResolutionTime: 0,
      conflictTypesResolved: {},
      averageChangesPerResolution: 0,
    };
  }

  /**
   * Initialize the conflict resolver
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("🔧 Initializing Conflict Resolver...");

    try {
      // Initialize resolution strategies based on constraint priority order
      this.initializeResolutionStrategies();

      this.initialized = true;
      console.log("✅ Conflict Resolver initialized successfully");
    } catch (error) {
      console.error("❌ Conflict Resolver initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize resolution strategies for different violation types
   */
  initializeResolutionStrategies() {
    // Priority order from AI_PREDICTION_MODEL_SPEC.md:
    // 1. Group Restrictions (highest)
    // 2. Coverage Compensation Rules
    // 3. Daily Coverage Limits
    // 4. Monthly Day-Off Limits
    // 5. Sunday Preferences
    // 6. Proximity Patterns
    // 7. Historical Patterns (lowest)

    this.resolutionStrategies.set(VIOLATION_TYPES.STAFF_GROUP_CONFLICT, {
      priority: 1000,
      name: "Group Conflict Resolution",
      resolve: this.resolveGroupConflicts.bind(this),
    });

    this.resolutionStrategies.set(
      VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION,
      {
        priority: 900,
        name: "Coverage Compensation Resolution",
        resolve: this.resolveCoverageCompensation.bind(this),
      },
    );

    this.resolutionStrategies.set(VIOLATION_TYPES.INSUFFICIENT_COVERAGE, {
      priority: 800,
      name: "Coverage Resolution",
      resolve: this.resolveInsufficientCoverage.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.DAILY_OFF_LIMIT, {
      priority: 750,
      name: "Daily Off Limit Resolution",
      resolve: this.resolveDailyOffLimit.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.DAILY_EARLY_LIMIT, {
      priority: 700,
      name: "Daily Early Limit Resolution",
      resolve: this.resolveDailyEarlyLimit.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.MONTHLY_OFF_LIMIT, {
      priority: 600,
      name: "Monthly Off Limit Resolution",
      resolve: this.resolveMonthlyOffLimit.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.PRIORITY_RULE_VIOLATION, {
      priority: 500,
      name: "Priority Rule Resolution",
      resolve: this.resolvePriorityRuleViolation.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION, {
      priority: 400,
      name: "Proximity Pattern Resolution",
      resolve: this.resolveProximityPattern.bind(this),
    });

    this.resolutionStrategies.set(VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF, {
      priority: 300,
      name: "Consecutive Days Resolution",
      resolve: this.resolveConsecutiveDaysOff.bind(this),
    });
  }

  /**
   * Resolve all conflicts in a schedule
   * @param {Object} scheduleData - Schedule data with conflicts
   * @param {Array} staffMembers - Staff members array
   * @param {Array} dateRange - Date range array
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveAllConflicts(
    scheduleData,
    staffMembers,
    dateRange,
    options = {},
  ) {
    if (!this.initialized) {
      throw new Error("ConflictResolver not initialized");
    }

    const {
      strategy = "priority_based",
      maxAttempts = 5,
      preserveImportantAssignments = true,
    } = options;

    console.log("🔧 Starting automatic conflict resolution...");

    try {
      const startTime = Date.now();
      const workingSchedule = JSON.parse(JSON.stringify(scheduleData));
      const resolutionLog = [];
      let totalChanges = 0;
      let totalConflictsResolved = 0;
      let attempts = 0;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Resolution attempt ${attempts}/${maxAttempts}...`);

        // Validate current state
        const validation = validateAllConstraints(
          workingSchedule,
          staffMembers,
          dateRange,
        );

        if (validation.valid) {
          console.log("✅ All conflicts resolved successfully!");
          break;
        }

        // Get violations sorted by priority
        const prioritizedViolations = this.prioritizeViolations(
          validation.violations,
        );

        if (prioritizedViolations.length === 0) {
          console.log("ℹ️ No resolvable violations found");
          break;
        }

        let changesInThisAttempt = 0;
        let conflictsResolvedInAttempt = 0;

        // Resolve violations in priority order
        for (const violation of prioritizedViolations) {
          const strategy = this.resolutionStrategies.get(violation.type);

          if (strategy) {
            console.log(`🔧 Resolving ${strategy.name}: ${violation.message}`);

            const resolutionResult = await strategy.resolve(
              violation,
              workingSchedule,
              staffMembers,
              dateRange,
              { preserveImportant: preserveImportantAssignments },
            );

            if (resolutionResult.success) {
              changesInThisAttempt += resolutionResult.changesApplied || 0;
              conflictsResolvedInAttempt++;

              resolutionLog.push({
                attempt: attempts,
                violationType: violation.type,
                strategy: strategy.name,
                changes: resolutionResult.changesApplied || 0,
                description:
                  resolutionResult.description || "Conflict resolved",
                timestamp: new Date().toISOString(),
              });

              console.log(
                `  ✅ Resolved with ${resolutionResult.changesApplied || 0} changes`,
              );
            } else {
              console.log(
                `  ❌ Failed to resolve: ${resolutionResult.error || "Unknown error"}`,
              );
            }
          } else {
            console.log(`  ⚠️ No strategy available for ${violation.type}`);
          }
        }

        totalChanges += changesInThisAttempt;
        totalConflictsResolved += conflictsResolvedInAttempt;

        // If no changes were made in this attempt, break to avoid infinite loop
        if (changesInThisAttempt === 0) {
          console.log(
            "⚠️ No changes made in this attempt, stopping resolution",
          );
          break;
        }
      }

      // Final validation
      const finalValidation = validateAllConstraints(
        workingSchedule,
        staffMembers,
        dateRange,
      );
      const resolutionTime = Date.now() - startTime;

      // Update performance metrics
      this.performanceMetrics.totalResolutions++;
      this.performanceMetrics.averageResolutionTime =
        (this.performanceMetrics.averageResolutionTime + resolutionTime) /
        this.performanceMetrics.totalResolutions;

      if (finalValidation.valid) {
        this.performanceMetrics.successfulResolutions++;
      }

      this.performanceMetrics.averageChangesPerResolution =
        (this.performanceMetrics.averageChangesPerResolution + totalChanges) /
        this.performanceMetrics.totalResolutions;

      // Update conflict type statistics
      resolutionLog.forEach((log) => {
        if (!this.performanceMetrics.conflictTypesResolved[log.violationType]) {
          this.performanceMetrics.conflictTypesResolved[log.violationType] = 0;
        }
        this.performanceMetrics.conflictTypesResolved[log.violationType]++;
      });

      // Store resolution in history
      this.resolutionHistory.push({
        timestamp: new Date().toISOString(),
        attempts,
        totalChanges,
        conflictsResolved: totalConflictsResolved,
        finallyValid: finalValidation.valid,
        resolutionTime,
        staffCount: staffMembers.length,
        dateCount: dateRange.length,
      });

      // Keep only last 50 resolutions
      if (this.resolutionHistory.length > 50) {
        this.resolutionHistory = this.resolutionHistory.slice(-50);
      }

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        schedule: workingSchedule,
        finalValidation: finalValidation.valid,
        remainingViolations: finalValidation.summary?.violationsFound || 0,
        changesApplied: totalChanges,
        conflictsResolved: totalConflictsResolved,
        attempts,
        resolutionTime,
        resolutionLog,
        analysis: {
          initialViolations: this.countInitialViolations(
            scheduleData,
            staffMembers,
            dateRange,
          ),
          finalViolations: finalValidation.summary?.violationsFound || 0,
          resolutionEfficiency:
            totalConflictsResolved > 0 ? totalConflictsResolved / attempts : 0,
          changeEfficiency:
            totalChanges > 0 ? totalConflictsResolved / totalChanges : 0,
        },
        recommendations: finalValidation.valid
          ? []
          : getViolationRecommendations(finalValidation.violations),
      };

      console.log(`✅ Conflict resolution completed in ${resolutionTime}ms`);
      console.log(
        `📊 ${totalConflictsResolved} conflicts resolved with ${totalChanges} changes`,
      );
      console.log(
        `🎯 Final validation: ${finalValidation.valid ? "VALID" : "HAS VIOLATIONS"}`,
      );

      return result;
    } catch (error) {
      console.error("❌ Conflict resolution failed:", error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        schedule: scheduleData,
        changesApplied: 0,
        conflictsResolved: 0,
        attempts: 0,
      };
    }
  }

  /**
   * Prioritize violations by strategy priority and severity
   * @param {Array} violations - Array of violations
   * @returns {Array} Prioritized violations
   */
  prioritizeViolations(violations) {
    return violations.sort((a, b) => {
      const aStrategy = this.resolutionStrategies.get(a.type);
      const bStrategy = this.resolutionStrategies.get(b.type);

      const aPriority = aStrategy ? aStrategy.priority : 0;
      const bPriority = bStrategy ? bStrategy.priority : 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // Secondary sort by severity
      const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      const aSeverity = severityOrder[a.severity] || 0;
      const bSeverity = severityOrder[b.severity] || 0;

      return bSeverity - aSeverity;
    });
  }

  /**
   * Resolve group conflicts (highest priority)
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveGroupConflicts(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, group, details } = violation;
    const conflictingMembers = details.conflictingMembers || [];

    if (conflictingMembers.length < 2) {
      return { success: false, error: "No conflicting members found" };
    }

    let changesApplied = 0;

    // Strategy: Change the member with lowest priority to working shift
    // Priority order: newer staff first, then by position importance
    const membersWithStaff = conflictingMembers
      .map((memberInfo) => {
        const memberName =
          typeof memberInfo === "string"
            ? memberInfo.split(" ")[0]
            : memberInfo;
        const staff = staffMembers.find((s) => s.name === memberName);
        return { memberName, staff, memberInfo };
      })
      .filter((m) => m.staff);

    // Sort by priority (lower priority changed first)
    membersWithStaff.sort((a, b) => {
      // Prioritize based on position importance
      const positionPriority = {
        料理長: 100, // Head Chef - highest priority
        古藤: 90,
        井関: 80,
        中田: 70,
        与儀: 60,
        カマル: 50,
        田辺: 40,
        小池: 40,
        岸: 30,
        高野: 20,
        派遣スタッフ: 10, // Temp staff - lowest priority
      };

      const aPriority = positionPriority[a.memberName] || 25;
      const bPriority = positionPriority[b.memberName] || 25;

      return aPriority - bPriority; // Lower priority first
    });

    // Change the lowest priority member to working shift
    const memberToChange = membersWithStaff[0];
    if (memberToChange && memberToChange.staff) {
      const currentShift = schedule[memberToChange.staff.id][date];

      // Change to normal working shift
      let newShift = "";

      // If they were off, change to normal
      if (isOffDay(currentShift)) {
        newShift = "";
      }
      // If they were early, change to normal
      else if (isEarlyShift(currentShift)) {
        newShift = "";
      }

      schedule[memberToChange.staff.id][date] = newShift;
      changesApplied++;

      return {
        success: true,
        changesApplied,
        description: `Changed ${memberToChange.memberName} from ${currentShift} to ${newShift || "normal"} on ${date} to resolve ${group} conflict`,
      };
    }

    return { success: false, error: "Could not identify member to change" };
  }

  /**
   * Resolve coverage compensation violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveCoverageCompensation(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, details } = violation;
    const { backupStaff, groupMembersOff, requiredShift } = details;

    const backupStaffMember = staffMembers.find((s) => s.name === backupStaff);
    if (!backupStaffMember) {
      return { success: false, error: "Backup staff member not found" };
    }

    const currentShift = schedule[backupStaffMember.id][date];
    const targetShift = requiredShift === "normal" ? "" : requiredShift;

    // Change backup staff to required shift
    schedule[backupStaffMember.id][date] = targetShift;

    return {
      success: true,
      changesApplied: 1,
      description: `Changed ${backupStaff} to ${targetShift || "normal"} shift on ${date} for coverage when ${groupMembersOff.join(", ")} off`,
    };
  }

  /**
   * Resolve insufficient coverage
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveInsufficientCoverage(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, details } = violation;
    const { deficit, staffWorking } = details;

    let changesApplied = 0;
    const staffToChange = [];

    // Find staff members who are off but could work
    staffMembers.forEach((staff) => {
      if (schedule[staff.id] && schedule[staff.id][date]) {
        const currentShift = schedule[staff.id][date];
        if (isOffDay(currentShift) && !staffWorking.includes(staff.name)) {
          staffToChange.push({ staff, currentShift });
        }
      }
    });

    // Sort staff by who can most easily be changed
    staffToChange.sort((a, b) => {
      // Prefer temporary staff or lower priority positions
      const priorityOrder = {
        派遣スタッフ: 1, // Temp staff first
        高野: 2,
        岸: 3,
        カマル: 4,
        田辺: 5,
        小池: 6,
        与儀: 7,
        中田: 8,
        井関: 9,
        古藤: 10,
        料理長: 11, // Head chef last
      };

      const aPriority = priorityOrder[a.staff.name] || 5;
      const bPriority = priorityOrder[b.staff.name] || 5;

      return aPriority - bPriority;
    });

    // Change needed number of staff from off to working
    const neededChanges = Math.min(deficit, staffToChange.length);

    for (let i = 0; i < neededChanges; i++) {
      const { staff } = staffToChange[i];
      schedule[staff.id][date] = ""; // Change to normal working shift
      changesApplied++;
    }

    return {
      success: changesApplied > 0,
      changesApplied,
      description: `Changed ${changesApplied} staff from off to working on ${date} to meet coverage requirements`,
    };
  }

  /**
   * Resolve daily off limit violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveDailyOffLimit(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, details } = violation;
    const { excess, staffOff } = details;

    let changesApplied = 0;

    // Find staff members who are off and can be changed to working
    const staffToChange = staffOff
      .map((staffName) => {
        const staff = staffMembers.find((s) => s.name === staffName);
        return staff
          ? { staff, priority: this.getStaffChangePriority(staff) }
          : null;
      })
      .filter((s) => s !== null);

    // Sort by change priority (temp staff first)
    staffToChange.sort((a, b) => a.priority - b.priority);

    // Change the required number of staff from off to working
    const neededChanges = Math.min(excess, staffToChange.length);

    for (let i = 0; i < neededChanges; i++) {
      const { staff } = staffToChange[i];
      schedule[staff.id][date] = ""; // Change to normal working shift
      changesApplied++;
    }

    return {
      success: changesApplied > 0,
      changesApplied,
      description: `Changed ${changesApplied} staff from off to working on ${date} to meet daily off limits`,
    };
  }

  /**
   * Resolve daily early shift limit violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveDailyEarlyLimit(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, details } = violation;
    const { excess, staffEarly } = details;

    let changesApplied = 0;

    // Change excess early shifts to normal shifts
    const staffToChange = staffEarly.slice(0, excess);

    staffToChange.forEach((staffName) => {
      const staff = staffMembers.find((s) => s.name === staffName);
      if (staff && schedule[staff.id] && schedule[staff.id][date]) {
        schedule[staff.id][date] = ""; // Change to normal shift
        changesApplied++;
      }
    });

    return {
      success: changesApplied > 0,
      changesApplied,
      description: `Changed ${changesApplied} early shifts to normal on ${date} to meet daily early limits`,
    };
  }

  /**
   * Resolve monthly off limit violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveMonthlyOffLimit(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { staffName, details } = violation;
    const { excess, offDays } = details;

    const staff = staffMembers.find((s) => s.name === staffName);
    if (!staff) {
      return { success: false, error: "Staff member not found" };
    }

    let changesApplied = 0;

    // Find the most recent off days to change to working days
    const offDaysToChange = offDays.slice(-excess); // Take the last 'excess' off days

    offDaysToChange.forEach((dateKey) => {
      if (schedule[staff.id] && schedule[staff.id][dateKey]) {
        schedule[staff.id][dateKey] = ""; // Change to normal working shift
        changesApplied++;
      }
    });

    return {
      success: changesApplied > 0,
      changesApplied,
      description: `Changed ${changesApplied} off days to working for ${staffName} to meet monthly limits`,
    };
  }

  /**
   * Resolve priority rule violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolvePriorityRuleViolation(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { date, staffName, details } = violation;
    const { expectedShift, rule } = details;

    const staff = staffMembers.find((s) => s.name === staffName);
    if (!staff) {
      return { success: false, error: "Staff member not found" };
    }

    // Convert expected shift description to shift symbol
    let targetShift = "";
    if (expectedShift.includes("early")) {
      targetShift = "△";
    } else if (expectedShift.includes("off")) {
      targetShift = "×";
    } else if (expectedShift.includes("late")) {
      targetShift = "◇";
    }

    schedule[staff.id][date] = targetShift;

    return {
      success: true,
      changesApplied: 1,
      description: `Applied priority rule: ${staffName} assigned ${targetShift || "normal"} shift on ${date}`,
    };
  }

  /**
   * Resolve proximity pattern violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveProximityPattern(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { details } = violation;
    const { triggerStaff, targetStaff, triggerOffDay, proximityRange } =
      details;

    const targetStaffMember = staffMembers.find((s) => s.name === targetStaff);
    if (!targetStaffMember) {
      return { success: false, error: "Target staff member not found" };
    }

    // Find a date within proximity range to assign off day
    const triggerDate = new Date(triggerOffDay);
    let bestDate = null;
    let minDistance = Infinity;

    // Check dates within range
    for (let offset = -proximityRange; offset <= proximityRange; offset++) {
      const checkDate = new Date(triggerDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const checkDateKey = checkDate.toISOString().split("T")[0];

      // Check if this date is in our range and available
      const dateInRange = dateRange.some(
        (d) => d.toISOString().split("T")[0] === checkDateKey,
      );

      if (
        dateInRange &&
        schedule[targetStaffMember.id] &&
        schedule[targetStaffMember.id][checkDateKey] !== undefined
      ) {
        const currentShift = schedule[targetStaffMember.id][checkDateKey];
        // Prefer dates that are already off or can be easily changed
        if (isOffDay(currentShift) || currentShift === "") {
          const distance = Math.abs(offset);
          if (distance < minDistance) {
            minDistance = distance;
            bestDate = checkDateKey;
          }
        }
      }
    }

    if (bestDate) {
      schedule[targetStaffMember.id][bestDate] = "×"; // Assign off day

      return {
        success: true,
        changesApplied: 1,
        description: `Assigned ${targetStaff} off day on ${bestDate} to maintain proximity pattern with ${triggerStaff}`,
      };
    }

    return {
      success: false,
      error: "Could not find suitable date within proximity range",
    };
  }

  /**
   * Resolve consecutive days off violations
   * @param {Object} violation - Violation details
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result
   */
  async resolveConsecutiveDaysOff(
    violation,
    schedule,
    staffMembers,
    dateRange,
    options = {},
  ) {
    const { staffName, details } = violation;
    const { consecutiveDays } = details;

    const staff = staffMembers.find((s) => s.name === staffName);
    if (!staff) {
      return { success: false, error: "Staff member not found" };
    }

    // Strategy: Break the consecutive streak by changing the middle day(s) to working
    const middleIndex = Math.floor(consecutiveDays.length / 2);
    const dateToChange = consecutiveDays[middleIndex];

    schedule[staff.id][dateToChange] = ""; // Change to normal working shift

    return {
      success: true,
      changesApplied: 1,
      description: `Changed ${staffName} from off to working on ${dateToChange} to break consecutive off days streak`,
    };
  }

  /**
   * Get staff change priority (lower number = higher priority to change)
   * @param {Object} staff - Staff member
   * @returns {number} Priority score
   */
  getStaffChangePriority(staff) {
    const priorityMap = {
      派遣スタッフ: 1, // Temp staff - easiest to change
      高野: 2,
      岸: 3,
      カマル: 4,
      田辺: 5,
      小池: 6,
      与儀: 7,
      中田: 8,
      井関: 9,
      古藤: 10,
      料理長: 11, // Head chef - hardest to change
    };

    return priorityMap[staff.name] || 5;
  }

  /**
   * Count initial violations before resolution
   * @param {Object} scheduleData - Original schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Number of initial violations
   */
  async countInitialViolations(scheduleData, staffMembers, dateRange) {
    try {
      const validation = validateAllConstraints(
        scheduleData,
        staffMembers,
        dateRange,
      );
      return validation.summary?.violationsFound || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get resolver status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      strategies: Array.from(this.resolutionStrategies.keys()),
      performance: { ...this.performanceMetrics },
      recentResolutions: this.resolutionHistory.slice(-10),
      successRate:
        this.performanceMetrics.totalResolutions > 0
          ? (this.performanceMetrics.successfulResolutions /
              this.performanceMetrics.totalResolutions) *
            100
          : 0,
    };
  }
}
