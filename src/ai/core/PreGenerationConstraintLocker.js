import { CalendarRulesLoader } from "../utils/CalendarRulesLoader";
import { EarlyShiftPreferencesLoader } from "../utils/EarlyShiftPreferencesLoader";

/**
 * Pre-Generation Constraint Locker
 *
 * Locks calendar-mandated cells BEFORE AI generation starts.
 * This ensures calendar rules (must_work, must_day_off) are never violated
 * by the AI generation process.
 *
 * Phase 1 of AI Generation Consistency Plan
 */
export class PreGenerationConstraintLocker {
  /**
   * Lock calendar-mandated constraints before AI generation
   *
   * @param {Object} schedule - Schedule object to pre-populate
   * @param {Object} calendarRules - Calendar rules map from CalendarRulesLoader
   * @param {Object} earlyShiftPreferences - Early shift preferences map
   * @param {Array} staffMembers - Array of staff members
   * @param {Array<string>} dateRange - Array of date strings (YYYY-MM-DD)
   * @returns {Object} { schedule, lockedCells, summary }
   */
  static lockMandatoryConstraints(
    schedule,
    calendarRules,
    earlyShiftPreferences,
    staffMembers,
    dateRange
  ) {
    const lockedCells = new Set();
    const changeLog = [];
    let totalLocked = 0;

    console.log("🔒 [PreGenLock] Locking calendar-mandated constraints...");

    // Get must_work and must_day_off dates
    const mustWorkDates = CalendarRulesLoader.getMustWorkDates(calendarRules);
    const mustDayOffDates =
      CalendarRulesLoader.getMustDayOffDates(calendarRules);

    console.log(
      `📅 [PreGenLock] Found ${mustWorkDates.length} must_work dates, ${mustDayOffDates.length} must_day_off dates`
    );

    // Lock must_work dates - ALL staff work normal shifts
    mustWorkDates.forEach((dateKey) => {
      staffMembers.forEach((staff) => {
        if (!schedule[staff.id]) {
          schedule[staff.id] = {};
        }

        // Lock as normal shift (empty string)
        schedule[staff.id][dateKey] = "";
        lockedCells.add(`${staff.id}:${dateKey}`);
        totalLocked++;

        changeLog.push({
          date: dateKey,
          staffId: staff.id,
          staffName: staff.name,
          shift: "",
          reason: "must_work (pre-locked)",
        });
      });
    });

    // Lock must_day_off dates - Eligible staff get △, others get ×
    mustDayOffDates.forEach((dateKey) => {
      staffMembers.forEach((staff) => {
        if (!schedule[staff.id]) {
          schedule[staff.id] = {};
        }

        // Check if staff can do early shift on this date
        const canDoEarly = EarlyShiftPreferencesLoader.canDoEarlyShift(
          earlyShiftPreferences,
          staff.id,
          dateKey
        );

        // Assign early shift or day off
        const assignedShift = canDoEarly ? "△" : "×";
        schedule[staff.id][dateKey] = assignedShift;
        lockedCells.add(`${staff.id}:${dateKey}`);
        totalLocked++;

        changeLog.push({
          date: dateKey,
          staffId: staff.id,
          staffName: staff.name,
          shift: assignedShift,
          reason: canDoEarly
            ? "must_day_off + early shift eligible (pre-locked)"
            : "must_day_off (pre-locked)",
        });
      });
    });

    const summary = {
      totalLocked,
      mustWorkDatesLocked: mustWorkDates.length,
      mustDayOffDatesLocked: mustDayOffDates.length,
      mustWorkCells: mustWorkDates.length * staffMembers.length,
      mustDayOffCells: mustDayOffDates.length * staffMembers.length,
      earlyShiftsAssigned: changeLog.filter((c) => c.shift === "△").length,
      dayOffsAssigned: changeLog.filter((c) => c.shift === "×").length,
      normalShiftsAssigned: changeLog.filter((c) => c.shift === "").length,
    };

    console.log(
      `✅ [PreGenLock] Locked ${totalLocked} cells (${mustWorkDates.length + mustDayOffDates.length} dates × ${staffMembers.length} staff)`
    );
    console.log(
      `   ├─ must_work: ${summary.mustWorkCells} normal shifts (${mustWorkDates.length} dates)`
    );
    console.log(
      `   ├─ must_day_off: ${summary.earlyShiftsAssigned} early shifts (△)`
    );
    console.log(
      `   └─ must_day_off: ${summary.dayOffsAssigned} day offs (×)`
    );

    return {
      schedule,
      lockedCells,
      changeLog,
      summary,
    };
  }

  /**
   * Check if a cell is locked and cannot be modified by AI
   *
   * @param {Set} lockedCells - Set of locked cell identifiers
   * @param {string} staffId - Staff member ID
   * @param {string} dateKey - Date string (YYYY-MM-DD)
   * @returns {boolean} True if cell is locked
   */
  static isCellLocked(lockedCells, staffId, dateKey) {
    return lockedCells.has(`${staffId}:${dateKey}`);
  }

  /**
   * Get locked cells for a specific date
   *
   * @param {Set} lockedCells - Set of locked cell identifiers
   * @param {string} dateKey - Date string (YYYY-MM-DD)
   * @returns {Array<string>} Array of locked staff IDs for this date
   */
  static getLockedStaffForDate(lockedCells, dateKey) {
    const lockedStaff = [];
    lockedCells.forEach((cell) => {
      const [staffId, cellDate] = cell.split(":");
      if (cellDate === dateKey) {
        lockedStaff.push(staffId);
      }
    });
    return lockedStaff;
  }

  /**
   * Validate that locked cells remain unchanged after generation
   *
   * @param {Object} originalSchedule - Schedule with locked cells
   * @param {Object} generatedSchedule - Schedule after AI generation
   * @param {Set} lockedCells - Set of locked cell identifiers
   * @returns {Object} Validation result
   */
  static validateLockedCells(
    originalSchedule,
    generatedSchedule,
    lockedCells
  ) {
    const violations = [];

    lockedCells.forEach((cell) => {
      const [staffId, dateKey] = cell.split(":");
      const originalShift = originalSchedule[staffId]?.[dateKey];
      const generatedShift = generatedSchedule[staffId]?.[dateKey];

      if (originalShift !== generatedShift) {
        violations.push({
          cell,
          staffId,
          dateKey,
          expectedShift: originalShift,
          actualShift: generatedShift,
          reason: "Locked cell was modified during generation",
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
      violationCount: violations.length,
      totalLocked: lockedCells.size,
    };
  }

  /**
   * Get summary of locked constraints for debugging
   *
   * @param {Set} lockedCells - Set of locked cell identifiers
   * @param {Object} calendarRules - Calendar rules map
   * @returns {Object} Summary statistics
   */
  static getLockedCellsSummary(lockedCells, calendarRules) {
    const mustWorkDates = CalendarRulesLoader.getMustWorkDates(calendarRules);
    const mustDayOffDates =
      CalendarRulesLoader.getMustDayOffDates(calendarRules);

    return {
      totalLockedCells: lockedCells.size,
      calendarRuleCount: Object.keys(calendarRules).length,
      mustWorkDates: mustWorkDates.length,
      mustDayOffDates: mustDayOffDates.length,
      lockedDates: [...new Set([...mustWorkDates, ...mustDayOffDates])],
    };
  }
}

export default PreGenerationConstraintLocker;
