import { supabase } from "../../utils/supabase";

/**
 * Early Shift Preferences Loader
 *
 * Loads and processes early shift preferences for AI schedule generation.
 * Integrates with staff_early_shift_preferences table.
 */
export class EarlyShiftPreferencesLoader {
  /**
   * Load early shift preferences for a specific date range
   * @param {string} restaurantId - Restaurant UUID
   * @param {Array<Date>} dateRange - Array of dates in the schedule
   * @returns {Promise<Object>} Preferences map: { [staffId]: { [dateString]: boolean } }
   */
  static async loadPreferences(restaurantId, dateRange) {
    if (!restaurantId) {
      console.warn("⚠️ [EarlyShiftPrefs] No restaurant ID provided");
      return {};
    }

    if (!dateRange || dateRange.length === 0) {
      console.warn("⚠️ [EarlyShiftPrefs] No date range provided");
      return {};
    }

    try {
      console.log(`🔄 [EarlyShiftPrefs] Loading preferences for restaurant ${restaurantId}`);

      // Load all preferences for this restaurant
      const { data, error } = await supabase
        .from("staff_early_shift_preferences")
        .select("staff_id, can_do_early_shift, applies_to_date, preference_source")
        .eq("restaurant_id", restaurantId);

      if (error) {
        console.error("❌ [EarlyShiftPrefs] Failed to load preferences:", error);
        return {};
      }

      if (!data || data.length === 0) {
        console.log("ℹ️ [EarlyShiftPrefs] No preferences found for this restaurant");
        return {};
      }

      // Process preferences into a map
      const preferencesMap = this.processPreferences(data, dateRange);

      console.log(`✅ [EarlyShiftPrefs] Loaded ${data.length} preference records for ${Object.keys(preferencesMap).length} staff members`);

      return preferencesMap;
    } catch (err) {
      console.error("❌ [EarlyShiftPrefs] Error loading preferences:", err);
      return {};
    }
  }

  /**
   * Process raw preferences into a usable map
   * @param {Array} rawPreferences - Raw preferences from database
   * @param {Array<Date>} dateRange - Date range for the schedule
   * @returns {Object} Processed preferences map
   */
  static processPreferences(rawPreferences, dateRange) {
    const prefsMap = {};

    rawPreferences.forEach((pref) => {
      if (!prefsMap[pref.staff_id]) {
        prefsMap[pref.staff_id] = {};
      }

      const dateKey = pref.applies_to_date || 'default';
      prefsMap[pref.staff_id][dateKey] = pref.can_do_early_shift;
    });

    return prefsMap;
  }

  /**
   * Check if a staff member can do early shifts on a specific date
   * @param {Object} preferencesMap - Preferences map from loadPreferences()
   * @param {string} staffId - Staff UUID
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if staff can do early shifts on this date
   */
  static canDoEarlyShift(preferencesMap, staffId, date) {
    if (!preferencesMap[staffId]) {
      // No preference set = not allowed by default
      return false;
    }

    // Convert date to string format (YYYY-MM-DD)
    const dateString = typeof date === 'string'
      ? date
      : date.toISOString().split('T')[0];

    // Check exact date match first
    if (preferencesMap[staffId][dateString] !== undefined) {
      return preferencesMap[staffId][dateString];
    }

    // Fallback to 'default' if no specific date match
    if (preferencesMap[staffId]['default'] !== undefined) {
      return preferencesMap[staffId]['default'];
    }

    // No preference = not allowed
    return false;
  }

  /**
   * Get all staff IDs who can do early shifts on a specific date
   * @param {Object} preferencesMap - Preferences map
   * @param {Date|string} date - Date to check
   * @returns {Array<string>} Array of staff IDs who can do early shifts
   */
  static getEligibleStaff(preferencesMap, date) {
    const dateString = typeof date === 'string'
      ? date
      : date.toISOString().split('T')[0];

    const eligibleStaff = [];

    Object.keys(preferencesMap).forEach((staffId) => {
      if (this.canDoEarlyShift(preferencesMap, staffId, dateString)) {
        eligibleStaff.push(staffId);
      }
    });

    return eligibleStaff;
  }

  /**
   * Validate that a schedule respects early shift preferences
   * @param {Object} schedule - Schedule to validate { [staffId]: { [date]: shift } }
   * @param {Object} preferencesMap - Preferences map
   * @returns {Object} Validation result with violations
   */
  static validateSchedule(schedule, preferencesMap) {
    const violations = [];

    Object.keys(schedule).forEach((staffId) => {
      Object.keys(schedule[staffId]).forEach((date) => {
        const shift = schedule[staffId][date];

        // Check if it's an early shift (△)
        if (shift === '△') {
          if (!this.canDoEarlyShift(preferencesMap, staffId, date)) {
            violations.push({
              staffId,
              date,
              shift,
              reason: 'Staff member is not allowed to do early shifts on this date',
            });
          }
        }
      });
    });

    return {
      isValid: violations.length === 0,
      violations,
      violationCount: violations.length,
    };
  }
}

export default EarlyShiftPreferencesLoader;
