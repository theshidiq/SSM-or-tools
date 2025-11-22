import { supabase } from "../../utils/supabase";

/**
 * Calendar Rules Loader
 *
 * Loads and processes calendar rules (must_work, must_day_off) for AI schedule generation.
 * Integrates with calendar_rules table to enforce mandatory work days and mandatory off days.
 */
export class CalendarRulesLoader {
  /**
   * Load calendar rules for a specific date range
   * @param {string} restaurantId - Restaurant UUID
   * @param {Array<Date>} dateRange - Array of dates in the schedule
   * @returns {Promise<Object>} Rules map: { [dateString]: { must_work: boolean, must_day_off: boolean } }
   */
  static async loadRules(restaurantId, dateRange) {
    if (!restaurantId) {
      console.warn("⚠️ [CalendarRules] No restaurant ID provided");
      return {};
    }

    if (!dateRange || dateRange.length === 0) {
      console.warn("⚠️ [CalendarRules] No date range provided");
      return {};
    }

    try {
      console.log(`🔄 [CalendarRules] Loading rules for restaurant ${restaurantId}`);

      // Get date range boundaries
      const startDate = dateRange[0].toISOString().split('T')[0];
      const endDate = dateRange[dateRange.length - 1].toISOString().split('T')[0];

      // Load all calendar rules within the date range
      const { data, error } = await supabase
        .from("calendar_rules")
        .select("date, rule_type")
        .eq("restaurant_id", restaurantId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) {
        console.error("❌ [CalendarRules] Failed to load rules:", error);
        return {};
      }

      if (!data || data.length === 0) {
        console.log("ℹ️ [CalendarRules] No calendar rules found for this date range");
        return {};
      }

      // Process rules into a map
      const rulesMap = this.processRules(data);

      console.log(`✅ [CalendarRules] Loaded ${data.length} calendar rules`);

      return rulesMap;
    } catch (err) {
      console.error("❌ [CalendarRules] Error loading rules:", err);
      return {};
    }
  }

  /**
   * Process raw calendar rules into a usable map
   * @param {Array} rawRules - Raw rules from database
   * @returns {Object} Processed rules map
   */
  static processRules(rawRules) {
    const rulesMap = {};

    rawRules.forEach((rule) => {
      const dateKey = rule.date;
      rulesMap[dateKey] = {
        must_work: rule.rule_type === "must_work",
        must_day_off: rule.rule_type === "must_day_off",
      };
    });

    return rulesMap;
  }

  /**
   * Check if a date has a must_work rule
   * @param {Object} rulesMap - Rules map from loadRules()
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if date has must_work rule
   */
  static isMustWorkDate(rulesMap, date) {
    const dateString = typeof date === 'string'
      ? date
      : date.toISOString().split('T')[0];

    return rulesMap[dateString]?.must_work === true;
  }

  /**
   * Check if a date has a must_day_off rule
   * @param {Object} rulesMap - Rules map from loadRules()
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if date has must_day_off rule
   */
  static isMustDayOffDate(rulesMap, date) {
    const dateString = typeof date === 'string'
      ? date
      : date.toISOString().split('T')[0];

    return rulesMap[dateString]?.must_day_off === true;
  }

  /**
   * Get all must_work dates from rules map
   * @param {Object} rulesMap - Rules map
   * @returns {Array<string>} Array of date strings with must_work rule
   */
  static getMustWorkDates(rulesMap) {
    return Object.keys(rulesMap).filter(
      (dateKey) => rulesMap[dateKey].must_work === true
    );
  }

  /**
   * Get all must_day_off dates from rules map
   * @param {Object} rulesMap - Rules map
   * @returns {Array<string>} Array of date strings with must_day_off rule
   */
  static getMustDayOffDates(rulesMap) {
    return Object.keys(rulesMap).filter(
      (dateKey) => rulesMap[dateKey].must_day_off === true
    );
  }

  /**
   * Validate that a schedule respects calendar rules
   * @param {Object} schedule - Schedule to validate { [staffId]: { [date]: shift } }
   * @param {Object} rulesMap - Rules map
   * @param {Array} staffMembers - Array of staff members
   * @returns {Object} Validation result with violations
   */
  static validateSchedule(schedule, rulesMap, staffMembers) {
    const violations = [];

    Object.keys(rulesMap).forEach((dateKey) => {
      const rule = rulesMap[dateKey];

      // Check must_work violations
      if (rule.must_work) {
        staffMembers.forEach((staff) => {
          const shift = schedule[staff.id]?.[dateKey];

          // Staff should be working (not × day off)
          if (shift === '×') {
            violations.push({
              type: 'must_work_violation',
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              shift,
              reason: 'Staff assigned day off on a must_work date',
              rule: 'must_work',
            });
          }
        });
      }

      // Check must_day_off violations
      if (rule.must_day_off) {
        staffMembers.forEach((staff) => {
          const shift = schedule[staff.id]?.[dateKey];

          // Staff should have day off (× or empty/undefined)
          // Normal shift is "", early is △, late is ◇
          if (shift && shift !== '×' && shift !== '') {
            violations.push({
              type: 'must_day_off_violation',
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              shift,
              reason: 'Staff assigned work shift on a must_day_off date',
              rule: 'must_day_off',
            });
          }
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
      violationCount: violations.length,
      mustWorkViolations: violations.filter((v) => v.type === 'must_work_violation').length,
      mustDayOffViolations: violations.filter((v) => v.type === 'must_day_off_violation').length,
    };
  }

  /**
   * Apply calendar rules to a schedule (auto-fix violations)
   * @param {Object} schedule - Schedule to apply rules to
   * @param {Object} rulesMap - Rules map
   * @param {Array} staffMembers - Array of staff members
   * @returns {Object} Modified schedule with rules applied
   */
  static applyRulesToSchedule(schedule, rulesMap, staffMembers) {
    const modifiedSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
    let changesApplied = 0;

    Object.keys(rulesMap).forEach((dateKey) => {
      const rule = rulesMap[dateKey];

      staffMembers.forEach((staff) => {
        // Apply must_day_off rule - force day off
        if (rule.must_day_off) {
          const currentShift = modifiedSchedule[staff.id]?.[dateKey];
          if (currentShift !== '×') {
            if (!modifiedSchedule[staff.id]) {
              modifiedSchedule[staff.id] = {};
            }
            modifiedSchedule[staff.id][dateKey] = '×';
            changesApplied++;
          }
        }

        // Apply must_work rule - ensure not day off
        if (rule.must_work) {
          const currentShift = modifiedSchedule[staff.id]?.[dateKey];
          if (currentShift === '×') {
            if (!modifiedSchedule[staff.id]) {
              modifiedSchedule[staff.id] = {};
            }
            // Change to normal shift (empty string)
            modifiedSchedule[staff.id][dateKey] = '';
            changesApplied++;
          }
        }
      });
    });

    console.log(`✅ [CalendarRules] Applied ${changesApplied} rule-based changes to schedule`);

    return modifiedSchedule;
  }

  /**
   * Get summary of calendar rules for logging/debugging
   * @param {Object} rulesMap - Rules map
   * @returns {Object} Summary statistics
   */
  static getRulesSummary(rulesMap) {
    const mustWorkDates = this.getMustWorkDates(rulesMap);
    const mustDayOffDates = this.getMustDayOffDates(rulesMap);

    return {
      totalRules: Object.keys(rulesMap).length,
      mustWorkCount: mustWorkDates.length,
      mustDayOffCount: mustDayOffDates.length,
      mustWorkDates,
      mustDayOffDates,
      dateRange: {
        start: Object.keys(rulesMap).sort()[0],
        end: Object.keys(rulesMap).sort()[Object.keys(rulesMap).length - 1],
      },
    };
  }
}

export default CalendarRulesLoader;
