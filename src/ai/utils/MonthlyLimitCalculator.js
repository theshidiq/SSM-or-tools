/**
 * MonthlyLimitCalculator
 *
 * Calculates effective monthly limits by considering:
 * - Base configured MIN/MAX limits
 * - Calendar rules (must_day_off dates)
 * - Early shift preferences on calendar dates
 * - Weekly limits override behavior
 *
 * Priority Order:
 * 1. Calendar Rules (must_day_off) - Highest
 * 2. Monthly Limits (MIN/MAX) - Overrides weekly when conflicts
 * 3. Weekly Limits - Demoted when monthly override is enabled
 */

export class MonthlyLimitCalculator {
  /**
   * Calculate effective limits for a staff member
   * @param {string} staffId - Staff member ID
   * @param {Object} config - Configuration object
   * @param {Object} config.monthlyLimit - Monthly limit configuration
   * @param {Object} config.calendarRules - Calendar rules by date
   * @param {Object} config.earlyShiftPrefs - Early shift preferences by staffId->date
   * @param {Array} config.dateRange - Array of date strings in the period
   * @returns {Object} Effective limits with calendar adjustments
   */
  static calculateEffectiveLimits(staffId, config) {
    const {
      monthlyLimit,
      calendarRules = {},
      earlyShiftPrefs = {},
      dateRange = [],
    } = config;

    // Get configured limits with fallbacks
    const configuredMin = monthlyLimit?.minCount ?? null;
    const configuredMax = monthlyLimit?.maxCount ?? 8;
    const excludeCalendarRules = monthlyLimit?.excludeCalendarRules ?? true;
    const excludeEarlyShiftCalendar =
      monthlyLimit?.excludeEarlyShiftCalendar ?? true;
    const overrideWeeklyLimits = monthlyLimit?.overrideWeeklyLimits ?? true;
    const countHalfDays = monthlyLimit?.countHalfDays ?? true;

    // Count calendar rule days for this staff within the date range
    let calendarOffDays = 0;
    let calendarEarlyDays = 0;

    dateRange.forEach((dateKey) => {
      const calendarRule = calendarRules[dateKey];
      if (calendarRule?.must_day_off) {
        // Check if staff has early shift preference on this date
        const hasEarlyPref = earlyShiftPrefs[staffId]?.[dateKey] === true;
        if (hasEarlyPref) {
          calendarEarlyDays++; // Will be assigned triangle on must_day_off
        } else {
          calendarOffDays++; // Will be assigned x on must_day_off
        }
      }
    });

    // Calculate effective limits
    // If excludeCalendarRules is true, calendar days don't count toward the limits
    const effectiveMin = excludeCalendarRules ? configuredMin : configuredMin;
    const effectiveMax = excludeCalendarRules ? configuredMax : configuredMax;

    return {
      // Base configuration
      configuredMin,
      configuredMax,
      countHalfDays,

      // Effective limits (these are for flexible/non-calendar days)
      effectiveMin,
      effectiveMax,

      // Calendar tracking
      calendarOffDays,
      calendarEarlyDays,
      excludeCalendarRules,
      excludeEarlyShiftCalendar,

      // Total calculations
      totalCalendarDays: calendarOffDays + calendarEarlyDays,
      totalMinOffDays:
        (effectiveMin ?? 0) + (excludeCalendarRules ? calendarOffDays : 0),
      totalMaxOffDays:
        (effectiveMax ?? 31) + (excludeCalendarRules ? calendarOffDays : 0),

      // Override settings
      overrideWeeklyLimits,
    };
  }

  /**
   * Get current off-day count for a staff member
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Schedule data { staffId: { dateKey: shift } }
   * @param {Object} calendarRules - Calendar rules by date
   * @param {boolean} excludeCalendarRules - Whether to exclude calendar rule days
   * @returns {Object} Count breakdown
   */
  static countOffDays(
    staffId,
    schedule,
    calendarRules = {},
    excludeCalendarRules = true
  ) {
    let flexibleOffDays = 0;
    let calendarOffDays = 0;
    let flexibleEarlyDays = 0;
    let calendarEarlyDays = 0;

    const staffSchedule = schedule[staffId] || {};

    Object.keys(staffSchedule).forEach((dateKey) => {
      const shift = staffSchedule[dateKey];
      const isCalendarRule = calendarRules[dateKey]?.must_day_off;

      if (shift === "×") {
        if (isCalendarRule) {
          calendarOffDays++;
        } else {
          flexibleOffDays++;
        }
      } else if (shift === "△") {
        if (isCalendarRule) {
          calendarEarlyDays++;
        } else {
          flexibleEarlyDays++;
        }
      }
    });

    return {
      flexibleOffDays,
      calendarOffDays,
      flexibleEarlyDays,
      calendarEarlyDays,
      totalOffDays: flexibleOffDays + calendarOffDays,
      totalEarlyDays: flexibleEarlyDays + calendarEarlyDays,
      // For monthly limit calculation (may exclude calendar based on settings)
      countableOffDays: excludeCalendarRules
        ? flexibleOffDays
        : flexibleOffDays + calendarOffDays,
    };
  }

  /**
   * Check if adding an off day would violate monthly MAX
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} effectiveLimits - Results from calculateEffectiveLimits
   * @param {Object} calendarRules - Calendar rules
   * @returns {boolean} True if can add off day
   */
  static canAddOffDay(staffId, schedule, effectiveLimits, calendarRules = {}) {
    const counts = this.countOffDays(
      staffId,
      schedule,
      calendarRules,
      effectiveLimits.excludeCalendarRules
    );

    // If no max is configured, allow
    if (effectiveLimits.effectiveMax === null) {
      return true;
    }

    return counts.countableOffDays < effectiveLimits.effectiveMax;
  }

  /**
   * Check if staff needs more off days to meet monthly MIN
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} effectiveLimits - Results from calculateEffectiveLimits
   * @param {Object} calendarRules - Calendar rules
   * @returns {boolean} True if needs more off days
   */
  static needsMoreOffDays(
    staffId,
    schedule,
    effectiveLimits,
    calendarRules = {}
  ) {
    // If no min is configured, doesn't need more
    if (
      effectiveLimits.effectiveMin === null ||
      effectiveLimits.effectiveMin === 0
    ) {
      return false;
    }

    const counts = this.countOffDays(
      staffId,
      schedule,
      calendarRules,
      effectiveLimits.excludeCalendarRules
    );

    return counts.countableOffDays < effectiveLimits.effectiveMin;
  }

  /**
   * Get the remaining off days needed to meet MIN requirement
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} effectiveLimits - Results from calculateEffectiveLimits
   * @param {Object} calendarRules - Calendar rules
   * @returns {number} Number of off days still needed (0 if MIN is met)
   */
  static getRemainingMinOffDays(
    staffId,
    schedule,
    effectiveLimits,
    calendarRules = {}
  ) {
    if (
      effectiveLimits.effectiveMin === null ||
      effectiveLimits.effectiveMin === 0
    ) {
      return 0;
    }

    const counts = this.countOffDays(
      staffId,
      schedule,
      calendarRules,
      effectiveLimits.excludeCalendarRules
    );

    const remaining = effectiveLimits.effectiveMin - counts.countableOffDays;
    return Math.max(0, remaining);
  }

  /**
   * Get the remaining off days available before hitting MAX
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} effectiveLimits - Results from calculateEffectiveLimits
   * @param {Object} calendarRules - Calendar rules
   * @returns {number} Number of off days still available (Infinity if no MAX)
   */
  static getRemainingMaxOffDays(
    staffId,
    schedule,
    effectiveLimits,
    calendarRules = {}
  ) {
    if (effectiveLimits.effectiveMax === null) {
      return Infinity;
    }

    const counts = this.countOffDays(
      staffId,
      schedule,
      calendarRules,
      effectiveLimits.excludeCalendarRules
    );

    const remaining = effectiveLimits.effectiveMax - counts.countableOffDays;
    return Math.max(0, remaining);
  }

  /**
   * Determine if weekly limit should be overridden for this staff
   * based on monthly limit requirements
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} effectiveLimits - Results from calculateEffectiveLimits
   * @param {Object} calendarRules - Calendar rules
   * @returns {Object} Override decision with reason
   */
  static shouldOverrideWeeklyLimit(
    staffId,
    schedule,
    effectiveLimits,
    calendarRules = {}
  ) {
    // If override is not enabled, never override
    if (!effectiveLimits.overrideWeeklyLimits) {
      return {
        shouldOverride: false,
        reason: "Monthly override disabled",
      };
    }

    // Check if we need more off days to meet monthly MIN
    if (this.needsMoreOffDays(staffId, schedule, effectiveLimits, calendarRules)) {
      const remaining = this.getRemainingMinOffDays(
        staffId,
        schedule,
        effectiveLimits,
        calendarRules
      );
      return {
        shouldOverride: true,
        reason: `Need ${remaining} more off days to meet monthly minimum (${effectiveLimits.effectiveMin})`,
        remainingNeeded: remaining,
      };
    }

    // Check if we're approaching monthly MAX
    const remainingMax = this.getRemainingMaxOffDays(
      staffId,
      schedule,
      effectiveLimits,
      calendarRules
    );
    if (remainingMax <= 0) {
      return {
        shouldOverride: true,
        reason: `At monthly maximum (${effectiveLimits.effectiveMax}), cannot add more off days`,
        blockAddingOff: true,
      };
    }

    return {
      shouldOverride: false,
      reason: "No monthly limit conflict",
    };
  }

  /**
   * Get a summary of monthly limit status for a staff member
   * @param {string} staffId - Staff member ID
   * @param {Object} schedule - Current schedule
   * @param {Object} config - Configuration (same as calculateEffectiveLimits)
   * @returns {Object} Summary of current status
   */
  static getMonthlyLimitStatus(staffId, schedule, config) {
    const effectiveLimits = this.calculateEffectiveLimits(staffId, config);
    const counts = this.countOffDays(
      staffId,
      schedule,
      config.calendarRules || {},
      effectiveLimits.excludeCalendarRules
    );

    const minMet =
      effectiveLimits.effectiveMin === null ||
      counts.countableOffDays >= effectiveLimits.effectiveMin;

    const maxOk =
      effectiveLimits.effectiveMax === null ||
      counts.countableOffDays <= effectiveLimits.effectiveMax;

    return {
      staffId,
      currentFlexibleOffDays: counts.flexibleOffDays,
      currentCalendarOffDays: counts.calendarOffDays,
      currentCalendarEarlyDays: counts.calendarEarlyDays,
      countableOffDays: counts.countableOffDays,
      effectiveMin: effectiveLimits.effectiveMin,
      effectiveMax: effectiveLimits.effectiveMax,
      minMet,
      maxOk,
      isValid: minMet && maxOk,
      remainingToMin: this.getRemainingMinOffDays(
        staffId,
        schedule,
        effectiveLimits,
        config.calendarRules || {}
      ),
      remainingToMax: this.getRemainingMaxOffDays(
        staffId,
        schedule,
        effectiveLimits,
        config.calendarRules || {}
      ),
      overrideWeeklyLimits: effectiveLimits.overrideWeeklyLimits,
    };
  }

  /**
   * Batch calculate status for all staff members
   * @param {Array} staffMembers - Array of staff member objects
   * @param {Object} schedule - Current schedule
   * @param {Object} config - Base configuration (monthlyLimit, calendarRules, etc.)
   * @returns {Map} Map of staffId -> status
   */
  static getAllStaffMonthlyStatus(staffMembers, schedule, config) {
    const statusMap = new Map();

    staffMembers.forEach((staff) => {
      const status = this.getMonthlyLimitStatus(staff.id, schedule, config);
      statusMap.set(staff.id, status);
    });

    return statusMap;
  }

  /**
   * Get staff who need more off days to meet monthly MIN
   * @param {Array} staffMembers - Array of staff member objects
   * @param {Object} schedule - Current schedule
   * @param {Object} config - Configuration
   * @returns {Array} Staff members who need more off days
   */
  static getStaffNeedingMoreOffDays(staffMembers, schedule, config) {
    const statusMap = this.getAllStaffMonthlyStatus(
      staffMembers,
      schedule,
      config
    );

    return staffMembers.filter((staff) => {
      const status = statusMap.get(staff.id);
      return status && !status.minMet;
    });
  }

  /**
   * Get staff who have reached or exceeded monthly MAX
   * @param {Array} staffMembers - Array of staff member objects
   * @param {Object} schedule - Current schedule
   * @param {Object} config - Configuration
   * @returns {Array} Staff members at or over MAX
   */
  static getStaffAtMaxOffDays(staffMembers, schedule, config) {
    const statusMap = this.getAllStaffMonthlyStatus(
      staffMembers,
      schedule,
      config
    );

    return staffMembers.filter((staff) => {
      const status = statusMap.get(staff.id);
      return status && status.remainingToMax <= 0;
    });
  }
}

export default MonthlyLimitCalculator;
