import { ConstraintPriorityManager, CONSTRAINT_REGISTRY } from "./ConstraintPriorityManager";
import { CalendarRulesLoader } from "../utils/CalendarRulesLoader";
import { EarlyShiftPreferencesLoader } from "../utils/EarlyShiftPreferencesLoader";
import { isOffDay, isEarlyShift, isLateShift, isWorkingShift } from "../constraints/ConstraintEngine";

/**
 * Violation Repair Engine
 *
 * Automatically fixes constraint violations with minimal changes to the schedule.
 * Uses priority-based repair strategies to maintain schedule quality.
 *
 * Phase 2 of AI Generation Consistency Plan
 */
export class ViolationRepairEngine {
  constructor() {
    this.repairAttempts = 0;
    this.repairedViolations = [];
    this.MAX_REPAIR_PASSES = 3;
  }

  /**
   * Repair all violations in a schedule
   * @param {Object} schedule - Schedule with violations
   * @param {Object} context - Repair context (rules, preferences, staff, dateRange)
   * @returns {Object} Repaired schedule and repair summary
   */
  async repairSchedule(schedule, context) {
    console.log("🔧 [RepairEngine] Starting violation repair...");

    const {
      calendarRules = {},
      earlyShiftPreferences = {},
      staffMembers = [],
      dateRange = []
    } = context;

    const repairedSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
    this.repairAttempts = 0;
    this.repairedViolations = [];

    let pass = 0;
    let remainingViolations = [];

    // Multi-pass repair (Tier 1 → Tier 2 → Tier 3)
    while (pass < this.MAX_REPAIR_PASSES) {
      pass++;
      console.log(`🔄 [RepairEngine] Pass ${pass}/${this.MAX_REPAIR_PASSES}`);

      // Detect violations
      const violations = this.detectViolations(repairedSchedule, context);

      if (violations.length === 0) {
        console.log("✅ [RepairEngine] No violations found!");
        break;
      }

      console.log(`📋 [RepairEngine] Found ${violations.length} violations to repair`);

      // Repair violations by priority (Tier 1 first, then Tier 2, then Tier 3)
      const sortedViolations = this.sortViolationsByPriority(violations);

      let repairedThisPass = 0;
      for (const violation of sortedViolations) {
        const repaired = await this.repairViolation(
          repairedSchedule,
          violation,
          context
        );

        if (repaired) {
          repairedThisPass++;
          this.repairedViolations.push(violation);
        }
      }

      console.log(`✅ [RepairEngine] Repaired ${repairedThisPass} violations in pass ${pass}`);

      // Check if we made progress
      if (repairedThisPass === 0) {
        console.warn(`⚠️ [RepairEngine] No progress in pass ${pass}, stopping`);
        remainingViolations = violations;
        break;
      }
    }

    const finalViolations = this.detectViolations(repairedSchedule, context);

    const summary = {
      totalAttempts: this.repairAttempts,
      repairedCount: this.repairedViolations.length,
      remainingCount: finalViolations.length,
      passesUsed: pass,
      success: finalViolations.length === 0,
      repairDetails: this.repairedViolations,
      remainingViolations: finalViolations
    };

    console.log(`🎯 [RepairEngine] Repair complete: ${summary.repairedCount} fixed, ${summary.remainingCount} remaining`);

    return {
      schedule: repairedSchedule,
      summary
    };
  }

  /**
   * Detect all violations in a schedule
   * @param {Object} schedule - Schedule to check
   * @param {Object} context - Validation context
   * @returns {Array} Array of violations
   */
  detectViolations(schedule, context) {
    const violations = [];

    // Check Tier 1 constraints
    violations.push(...this.detectCalendarViolations(schedule, context));
    violations.push(...this.detectEarlyShiftPermissionViolations(schedule, context));
    violations.push(...this.detectConsecutiveWorkViolations(schedule, context));

    return violations;
  }

  /**
   * Detect calendar rule violations (must_work, must_day_off)
   */
  detectCalendarViolations(schedule, context) {
    const { calendarRules = {}, earlyShiftPreferences = {}, staffMembers = [] } = context;
    const violations = [];

    // Check must_work dates
    const mustWorkDates = CalendarRulesLoader.getMustWorkDates(calendarRules);
    mustWorkDates.forEach(dateKey => {
      staffMembers.forEach(staff => {
        const shift = schedule[staff.id]?.[dateKey];

        // On must_work dates, staff should work (not ×)
        if (shift === "×" || shift === undefined) {
          violations.push({
            type: 'calendar_must_work',
            constraint: CONSTRAINT_REGISTRY.CALENDAR_MUST_WORK,
            staffId: staff.id,
            staffName: staff.name,
            date: dateKey,
            currentShift: shift,
            expectedShift: "",
            reason: "Staff has day off on must_work date"
          });
        }
      });
    });

    // Check must_day_off dates
    const mustDayOffDates = CalendarRulesLoader.getMustDayOffDates(calendarRules);
    mustDayOffDates.forEach(dateKey => {
      staffMembers.forEach(staff => {
        const shift = schedule[staff.id]?.[dateKey];
        const canDoEarly = EarlyShiftPreferencesLoader.canDoEarlyShift(
          earlyShiftPreferences,
          staff.id,
          dateKey
        );

        // On must_day_off: eligible staff should have △, others should have ×
        const expectedShift = canDoEarly ? "△" : "×";

        if (shift !== expectedShift) {
          violations.push({
            type: 'calendar_must_day_off',
            constraint: CONSTRAINT_REGISTRY.CALENDAR_MUST_DAY_OFF,
            staffId: staff.id,
            staffName: staff.name,
            date: dateKey,
            currentShift: shift,
            expectedShift,
            reason: canDoEarly
              ? "Staff should have early shift on must_day_off date"
              : "Staff should have day off on must_day_off date"
          });
        }
      });
    });

    return violations;
  }

  /**
   * Detect early shift permission violations
   */
  detectEarlyShiftPermissionViolations(schedule, context) {
    const { earlyShiftPreferences = {}, staffMembers = [] } = context;
    const violations = [];

    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};

      Object.keys(staffSchedule).forEach(dateKey => {
        const shift = staffSchedule[dateKey];

        // If staff has early shift but no permission
        if (shift === "△") {
          const canDoEarly = EarlyShiftPreferencesLoader.canDoEarlyShift(
            earlyShiftPreferences,
            staff.id,
            dateKey
          );

          if (!canDoEarly) {
            violations.push({
              type: 'early_shift_permission',
              constraint: CONSTRAINT_REGISTRY.EARLY_SHIFT_PERMISSION,
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              currentShift: shift,
              expectedShift: "", // Change to normal shift
              reason: "Staff does not have permission for early shift"
            });
          }
        }
      });
    });

    return violations;
  }

  /**
   * Detect consecutive work day violations
   */
  detectConsecutiveWorkViolations(schedule, context) {
    const { staffMembers = [], dateRange = [] } = context;
    const violations = [];
    const MAX_CONSECUTIVE_WORK_DAYS = 6;

    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};
      let consecutiveWorkDays = 0;
      let currentStreak = [];

      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = staffSchedule[dateKey];

        if (isWorkingShift(shift)) {
          consecutiveWorkDays++;
          currentStreak.push(dateKey);

          // Check if exceeded limit
          if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
            violations.push({
              type: 'consecutive_work_limit',
              constraint: CONSTRAINT_REGISTRY.CONSECUTIVE_WORK_LIMIT,
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey, // The violating date
              currentShift: shift,
              expectedShift: "×", // Should be day off
              consecutiveDays: consecutiveWorkDays,
              streak: [...currentStreak],
              reason: `Exceeded ${MAX_CONSECUTIVE_WORK_DAYS} consecutive work days (at ${consecutiveWorkDays} days)`
            });
          }
        } else {
          // Day off - reset streak
          consecutiveWorkDays = 0;
          currentStreak = [];
        }
      });
    });

    return violations;
  }

  /**
   * Sort violations by priority (Tier 1 first, then by priority number)
   */
  sortViolationsByPriority(violations) {
    return violations.sort((a, b) => {
      const priorityA = a.constraint?.priority || 999;
      const priorityB = b.constraint?.priority || 999;
      return priorityA - priorityB;
    });
  }

  /**
   * Repair a single violation
   * @param {Object} schedule - Schedule to repair
   * @param {Object} violation - Violation to fix
   * @param {Object} context - Repair context
   * @returns {boolean} True if repaired successfully
   */
  async repairViolation(schedule, violation, context) {
    this.repairAttempts++;

    const { staffId, date, currentShift, expectedShift, type } = violation;

    console.log(`🔧 [RepairEngine] Repairing ${type} for ${violation.staffName} on ${date}`);

    // Simple repair: change shift to expected value
    if (!schedule[staffId]) {
      schedule[staffId] = {};
    }

    // Apply the repair
    const previousShift = schedule[staffId][date];
    schedule[staffId][date] = expectedShift;

    console.log(`  ✅ Changed shift from "${previousShift}" to "${expectedShift}"`);

    return true;
  }

  /**
   * Get repair summary for logging
   */
  getRepairSummary() {
    return {
      totalAttempts: this.repairAttempts,
      repairedCount: this.repairedViolations.length,
      byType: this.groupViolationsByType(this.repairedViolations)
    };
  }

  /**
   * Group violations by type
   */
  groupViolationsByType(violations) {
    const grouped = {};

    violations.forEach(v => {
      if (!grouped[v.type]) {
        grouped[v.type] = 0;
      }
      grouped[v.type]++;
    });

    return grouped;
  }
}

export default ViolationRepairEngine;
