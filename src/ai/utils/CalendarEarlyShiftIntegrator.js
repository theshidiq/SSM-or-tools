import { CalendarRulesLoader } from "./CalendarRulesLoader";
import { EarlyShiftPreferencesLoader } from "./EarlyShiftPreferencesLoader";

/**
 * Calendar Early Shift Integrator
 *
 * Combines calendar rules (must_work, must_day_off) with early shift preferences
 * to intelligently assign early shifts on special dates.
 *
 * Integration Logic:
 * - On must_day_off dates: Assign early shifts (△) to eligible staff
 * - On must_work dates: Ensure all staff work (override day offs)
 * - Respect early shift preferences when assigning △
 */
export class CalendarEarlyShiftIntegrator {
  /**
   * Apply combined rules to a schedule
   * @param {Object} schedule - Schedule to modify
   * @param {Object} calendarRules - Calendar rules map
   * @param {Object} earlyShiftPreferences - Early shift preferences map
   * @param {Array} staffMembers - Array of staff members
   * @returns {Object} Modified schedule with combined rules applied
   */
  static applyCombinedRules(
    schedule,
    calendarRules,
    earlyShiftPreferences,
    staffMembers
  ) {
    const modifiedSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
    let changesApplied = 0;
    const changeLog = [];

    // Get must_day_off dates from calendar rules
    const mustDayOffDates = CalendarRulesLoader.getMustDayOffDates(calendarRules);

    console.log(
      `🔄 [CalendarEarlyShift] Applying combined rules for ${mustDayOffDates.length} must_day_off dates`
    );

    // Process each must_day_off date
    mustDayOffDates.forEach((dateKey) => {
      // Get staff who can do early shifts on this date
      const eligibleStaff = this.getEligibleStaffForEarlyShift(
        staffMembers,
        earlyShiftPreferences,
        dateKey
      );

      console.log(
        `📅 [CalendarEarlyShift] ${dateKey}: ${eligibleStaff.length}/${staffMembers.length} staff eligible for early shift (must_day_off)`
      );

      // ✅ STEP 1: Assign × to ALL staff first (calendar must_day_off baseline)
      staffMembers.forEach((staff) => {
        if (!modifiedSchedule[staff.id]) {
          modifiedSchedule[staff.id] = {};
        }

        const currentShift = modifiedSchedule[staff.id][dateKey];

        // Assign day off to all staff on must_day_off dates
        modifiedSchedule[staff.id][dateKey] = "×";
        changesApplied++;

        changeLog.push({
          date: dateKey,
          staffId: staff.id,
          staffName: staff.name,
          previousShift: currentShift,
          newShift: "×",
          reason: "must_day_off date (calendar rule baseline)",
        });
      });

      // ✅ STEP 2: OVERWRITE × with △ for eligible staff (early shift preference overrides)
      eligibleStaff.forEach((staff) => {
        const currentShift = modifiedSchedule[staff.id][dateKey];

        // Overwrite × with △ for eligible staff
        modifiedSchedule[staff.id][dateKey] = "△";
        changesApplied++;

        changeLog.push({
          date: dateKey,
          staffId: staff.id,
          staffName: staff.name,
          previousShift: currentShift,
          newShift: "△",
          reason: "must_day_off + early shift preference (△ overrides ×)",
        });
      });

      console.log(
        `✅ [CalendarEarlyShift] ${dateKey}: ${eligibleStaff.length} staff with △, ${staffMembers.length - eligibleStaff.length} staff with ×`
      );
    });

    // Get must_work dates and ensure all staff work normal shifts
    const mustWorkDates = CalendarRulesLoader.getMustWorkDates(calendarRules);

    mustWorkDates.forEach((dateKey) => {
      staffMembers.forEach((staff) => {
        if (!modifiedSchedule[staff.id]) {
          modifiedSchedule[staff.id] = {};
        }

        const currentShift = modifiedSchedule[staff.id][dateKey];

        // If staff has day off, early shift, or late shift on must_work date, change to normal shift
        // This ensures everyone works normal shifts on must_work dates (overrides all other shift types)
        if (currentShift === "×" || currentShift === "△" || currentShift === "◇" || currentShift === undefined) {
          modifiedSchedule[staff.id][dateKey] = ""; // Normal shift
          changesApplied++;

          changeLog.push({
            date: dateKey,
            staffId: staff.id,
            staffName: staff.name,
            previousShift: currentShift,
            newShift: "",
            reason: "must_work date (override all shift types to normal)",
          });
        }
      });
    });

    console.log(
      `✅ [CalendarEarlyShift] Applied ${changesApplied} combined rule changes`
    );

    return {
      schedule: modifiedSchedule,
      changesApplied,
      changeLog,
      summary: {
        mustDayOffDates: mustDayOffDates.length,
        mustWorkDates: mustWorkDates.length,
        earlyShiftsAssigned: changeLog.filter((c) => c.newShift === "△").length,
        dayOffsAssigned: changeLog.filter(
          (c) => c.newShift === "×" && c.reason.includes("must_day_off")
        ).length,
        mustWorkChanges: changeLog.filter((c) => c.reason === "must_work date")
          .length,
      },
    };
  }

  /**
   * Get staff members who are eligible for early shifts on a specific date
   * @param {Array} staffMembers - All staff members
   * @param {Object} earlyShiftPreferences - Early shift preferences map
   * @param {string} dateKey - Date string (YYYY-MM-DD)
   * @returns {Array} Staff members who can do early shifts
   */
  static getEligibleStaffForEarlyShift(
    staffMembers,
    earlyShiftPreferences,
    dateKey
  ) {
    return staffMembers.filter((staff) => {
      return EarlyShiftPreferencesLoader.canDoEarlyShift(
        earlyShiftPreferences,
        staff.id,
        dateKey
      );
    });
  }

  /**
   * Validate that a schedule respects combined calendar + early shift rules
   * @param {Object} schedule - Schedule to validate
   * @param {Object} calendarRules - Calendar rules map
   * @param {Object} earlyShiftPreferences - Early shift preferences map
   * @param {Array} staffMembers - Array of staff members
   * @returns {Object} Validation result
   */
  static validateCombinedRules(
    schedule,
    calendarRules,
    earlyShiftPreferences,
    staffMembers
  ) {
    const violations = [];

    // Get must_day_off dates
    const mustDayOffDates = CalendarRulesLoader.getMustDayOffDates(calendarRules);

    // Validate each must_day_off date
    mustDayOffDates.forEach((dateKey) => {
      staffMembers.forEach((staff) => {
        const shift = schedule[staff.id]?.[dateKey];
        const canDoEarlyShift = EarlyShiftPreferencesLoader.canDoEarlyShift(
          earlyShiftPreferences,
          staff.id,
          dateKey
        );

        // On must_day_off dates:
        // - Staff with early shift permission should have △
        // - Staff without permission should have ×
        if (canDoEarlyShift) {
          if (shift !== "△") {
            violations.push({
              type: "missing_early_shift_on_must_day_off",
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              currentShift: shift,
              expectedShift: "△",
              reason:
                "Staff has early shift permission but not assigned early shift on must_day_off date",
            });
          }
        } else {
          // Staff without early shift permission should have day off (×)
          // Empty string '' means normal shift which is still working
          if (shift !== "×") {
            violations.push({
              type: "wrong_shift_on_must_day_off",
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              currentShift: shift,
              expectedShift: "×",
              reason:
                "Staff without early shift permission should have day off on must_day_off date",
            });
          }
        }
      });
    });

    return {
      isValid: violations.length === 0,
      violations,
      violationCount: violations.length,
      mustDayOffDateViolations: violations.filter((v) =>
        v.type.includes("must_day_off")
      ).length,
    };
  }

  /**
   * Get summary of combined rules application
   * @param {Object} calendarRules - Calendar rules map
   * @param {Object} earlyShiftPreferences - Early shift preferences map
   * @param {Array} staffMembers - Array of staff members
   * @returns {Object} Summary of what will be applied
   */
  static getCombinedRulesSummary(
    calendarRules,
    earlyShiftPreferences,
    staffMembers
  ) {
    const mustDayOffDates = CalendarRulesLoader.getMustDayOffDates(calendarRules);
    const mustWorkDates = CalendarRulesLoader.getMustWorkDates(calendarRules);

    // Calculate how many early shifts will be assigned
    let totalEarlyShiftsToAssign = 0;
    let totalDayOffsToAssign = 0;

    mustDayOffDates.forEach((dateKey) => {
      const eligibleStaff = this.getEligibleStaffForEarlyShift(
        staffMembers,
        earlyShiftPreferences,
        dateKey
      );
      totalEarlyShiftsToAssign += eligibleStaff.length;
      totalDayOffsToAssign += staffMembers.length - eligibleStaff.length;
    });

    return {
      mustDayOffDates: mustDayOffDates.length,
      mustWorkDates: mustWorkDates.length,
      totalEarlyShiftsToAssign,
      totalDayOffsToAssign,
      averageEarlyShiftsPerDay:
        mustDayOffDates.length > 0
          ? (totalEarlyShiftsToAssign / mustDayOffDates.length).toFixed(1)
          : 0,
      staffWithEarlyShiftPermission: Object.keys(earlyShiftPreferences).length,
      dates: {
        mustDayOff: mustDayOffDates,
        mustWork: mustWorkDates,
      },
    };
  }

  /**
   * Check if a specific date requires combined rule application
   * @param {string} dateKey - Date string (YYYY-MM-DD)
   * @param {Object} calendarRules - Calendar rules map
   * @returns {boolean} True if date has must_day_off rule
   */
  static shouldApplyCombinedRules(dateKey, calendarRules) {
    return CalendarRulesLoader.isMustDayOffDate(calendarRules, dateKey);
  }
}

export default CalendarEarlyShiftIntegrator;
