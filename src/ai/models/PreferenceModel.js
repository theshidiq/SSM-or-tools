/**
 * PreferenceModel.js
 *
 * Model classes for staff preference patterns and scheduling preferences.
 * Provides structured representation of staff preferences detected from historical data.
 */

import {
  CONFIDENCE_LEVELS,
  getConfidenceLevel,
} from "../core/PatternRecognizer";

/**
 * Base preference class
 */
export class Preference {
  constructor(staffId, staffName, type, confidence = "medium") {
    this.id = this.generateId();
    this.staffId = staffId;
    this.staffName = staffName;
    this.type = type;
    this.confidence = confidence;
    this.strength = 0; // 0-100 percentage strength
    this.active = true;
    this.source = "historical_analysis";
    this.detectedAt = new Date().toISOString();
    this.lastConfirmed = null;
    this.overrideAllowed = true;
    this.notes = "";
  }

  /**
   * Generate unique ID for preference
   * @returns {string} Unique preference ID
   */
  generateId() {
    return `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update confidence level based on new data
   * @param {number} newStrength - New strength percentage
   */
  updateConfidence(newStrength) {
    this.strength = newStrength;
    this.confidence = getConfidenceLevel(newStrength);
    this.lastConfirmed = new Date().toISOString();
  }

  /**
   * Check if preference is applicable to a specific date/shift
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} shiftType - Shift type to check
   * @returns {boolean} True if preference applies
   */
  appliesTo(dateKey, shiftType) {
    throw new Error("appliesTo method must be implemented by subclass");
  }

  /**
   * Get preference score for a specific context
   * @param {Object} context - Context object with date, shift, etc.
   * @returns {number} Score from -100 to 100 (negative = avoid, positive = prefer)
   */
  getScore(context) {
    throw new Error("getScore method must be implemented by subclass");
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      staffId: this.staffId,
      staffName: this.staffName,
      type: this.type,
      confidence: this.confidence,
      strength: this.strength,
      active: this.active,
      source: this.source,
      detectedAt: this.detectedAt,
      lastConfirmed: this.lastConfirmed,
      overrideAllowed: this.overrideAllowed,
      notes: this.notes,
    };
  }
}

/**
 * Day of week preference (e.g., prefers Sunday off)
 */
export class DayOfWeekPreference extends Preference {
  constructor(staffId, staffName, dayOfWeek, preferenceType, strength) {
    super(staffId, staffName, "day_of_week", getConfidenceLevel(strength));
    this.dayOfWeek = dayOfWeek; // 'sunday', 'monday', etc.
    this.preferenceType = preferenceType; // 'off', 'work', 'early', 'late'
    this.strength = strength; // percentage
    this.seasonalVariation = false;
    this.exceptions = []; // Specific dates where preference doesn't apply
  }

  /**
   * Check if preference applies to a specific date
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} shiftType - Shift type to check
   * @returns {boolean} True if preference applies
   */
  appliesTo(dateKey, shiftType) {
    const date = new Date(dateKey);
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayOfWeek = dayNames[date.getDay()];

    if (dayOfWeek !== this.dayOfWeek) {
      return false;
    }

    if (this.exceptions.includes(dateKey)) {
      return false;
    }

    // Check if shift type matches preference
    if (this.preferenceType === "off") {
      return shiftType === "×" || shiftType === "off" || shiftType === "★";
    } else if (this.preferenceType === "work") {
      return shiftType !== "×" && shiftType !== "off" && shiftType !== "★";
    } else if (this.preferenceType === "early") {
      return shiftType === "△" || shiftType === "early";
    } else if (this.preferenceType === "late") {
      return shiftType === "◇" || shiftType === "late";
    }

    return false;
  }

  /**
   * Get preference score for a specific context
   * @param {Object} context - Context with date, shift, etc.
   * @returns {number} Score from -100 to 100
   */
  getScore(context) {
    if (!this.appliesTo(context.dateKey, context.shiftType)) {
      return 0;
    }

    // Return positive score for preferred scenarios, negative for avoided
    const baseScore = this.strength;

    if (
      this.preferenceType === context.shiftType ||
      (this.preferenceType === "work" && context.shiftType !== "off") ||
      (this.preferenceType === "off" &&
        (context.shiftType === "off" || context.shiftType === "×"))
    ) {
      return baseScore;
    }

    return -baseScore;
  }

  /**
   * Add exception date
   * @param {string} dateKey - Date to exclude from preference
   */
  addException(dateKey) {
    if (!this.exceptions.includes(dateKey)) {
      this.exceptions.push(dateKey);
    }
  }

  /**
   * Convert to JSON with day of week specific data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      dayOfWeek: this.dayOfWeek,
      preferenceType: this.preferenceType,
      seasonalVariation: this.seasonalVariation,
      exceptions: [...this.exceptions],
    };
  }
}

/**
 * Shift type preference (e.g., prefers early shifts)
 */
export class ShiftTypePreference extends Preference {
  constructor(staffId, staffName, shiftType, strength) {
    super(staffId, staffName, "shift_type", getConfidenceLevel(strength));
    this.shiftType = shiftType; // 'early', 'late', 'normal', 'off'
    this.strength = strength;
    this.timeFlexibility = "none"; // 'none', 'slight', 'moderate', 'high'
    this.daysOfWeek = []; // Empty means all days, specific days if limited
  }

  /**
   * Check if preference applies to a specific context
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} shiftType - Shift type to check
   * @returns {boolean} True if preference applies
   */
  appliesTo(dateKey, shiftType) {
    // Check day of week restriction
    if (this.daysOfWeek.length > 0) {
      const date = new Date(dateKey);
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayOfWeek = dayNames[date.getDay()];

      if (!this.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check shift type match
    return this.matchesShiftType(shiftType);
  }

  /**
   * Check if given shift matches preference shift type
   * @param {string} shift - Shift value to check
   * @returns {boolean} True if matches
   */
  matchesShiftType(shift) {
    switch (this.shiftType) {
      case "early":
        return shift === "△" || shift === "early";
      case "late":
        return shift === "◇" || shift === "late";
      case "normal":
        return shift === "" || shift === "normal";
      case "off":
        return shift === "×" || shift === "off" || shift === "★";
      default:
        return false;
    }
  }

  /**
   * Get preference score for a specific context
   * @param {Object} context - Context with date, shift, etc.
   * @returns {number} Score from -100 to 100
   */
  getScore(context) {
    if (this.matchesShiftType(context.shiftType)) {
      return this.strength;
    }

    // Neutral or slightly negative for non-matching shifts
    return 0;
  }

  /**
   * Set days of week where this preference applies
   * @param {Array} daysOfWeek - Array of day names
   */
  setDaysOfWeek(daysOfWeek) {
    this.daysOfWeek = [...daysOfWeek];
  }

  /**
   * Convert to JSON with shift type specific data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      shiftType: this.shiftType,
      timeFlexibility: this.timeFlexibility,
      daysOfWeek: [...this.daysOfWeek],
    };
  }
}

/**
 * Consecutive work pattern preference
 */
export class ConsecutivePatternPreference extends Preference {
  constructor(staffId, staffName, patternType, preferredLength, strength) {
    super(
      staffId,
      staffName,
      "consecutive_pattern",
      getConfidenceLevel(strength),
    );
    this.patternType = patternType; // 'work_days', 'off_days'
    this.preferredLength = preferredLength; // number of consecutive days
    this.minLength = Math.max(1, preferredLength - 1);
    this.maxLength = preferredLength + 1;
    this.strength = strength;
    this.flexibility = "medium"; // 'strict', 'medium', 'flexible'
  }

  /**
   * Check if preference applies to a consecutive pattern
   * @param {Array} consecutiveDays - Array of consecutive dates
   * @param {string} patternType - Type of pattern ('work' or 'off')
   * @returns {boolean} True if preference applies
   */
  appliesTo(consecutiveDays, patternType) {
    if (this.patternType === "work_days" && patternType !== "work") {
      return false;
    }
    if (this.patternType === "off_days" && patternType !== "off") {
      return false;
    }

    const length = consecutiveDays.length;
    return length >= this.minLength && length <= this.maxLength;
  }

  /**
   * Get preference score for consecutive pattern
   * @param {Object} context - Context with consecutiveDays, patternType
   * @returns {number} Score from -100 to 100
   */
  getScore(context) {
    if (!this.appliesTo(context.consecutiveDays, context.patternType)) {
      return 0;
    }

    const length = context.consecutiveDays.length;

    // Perfect match gets full score
    if (length === this.preferredLength) {
      return this.strength;
    }

    // Partial match gets reduced score based on flexibility
    const deviation = Math.abs(length - this.preferredLength);
    let penalty = 0;

    switch (this.flexibility) {
      case "strict":
        penalty = deviation * 25; // Heavy penalty for deviation
        break;
      case "medium":
        penalty = deviation * 15; // Moderate penalty
        break;
      case "flexible":
        penalty = deviation * 5; // Light penalty
        break;
    }

    return Math.max(0, this.strength - penalty);
  }

  /**
   * Convert to JSON with consecutive pattern specific data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      patternType: this.patternType,
      preferredLength: this.preferredLength,
      minLength: this.minLength,
      maxLength: this.maxLength,
      flexibility: this.flexibility,
    };
  }
}

/**
 * Frequency preference (e.g., prefers working 5 days per week)
 */
export class FrequencyPreference extends Preference {
  constructor(staffId, staffName, frequencyType, targetPercentage, strength) {
    super(staffId, staffName, "frequency", getConfidenceLevel(strength));
    this.frequencyType = frequencyType; // 'work_frequency', 'off_frequency'
    this.targetPercentage = targetPercentage; // 0-100
    this.tolerance = 10; // +/- percentage tolerance
    this.strength = strength;
    this.timeFrame = "weekly"; // 'weekly', 'monthly'
  }

  /**
   * Check if preference applies to a frequency context
   * @param {Object} context - Context with frequency data
   * @returns {boolean} True if preference applies
   */
  appliesTo(context) {
    return (
      context.frequencyType === this.frequencyType &&
      context.timeFrame === this.timeFrame
    );
  }

  /**
   * Get preference score for frequency
   * @param {Object} context - Context with actualPercentage, frequencyType
   * @returns {number} Score from -100 to 100
   */
  getScore(context) {
    if (!this.appliesTo(context)) {
      return 0;
    }

    const deviation = Math.abs(
      context.actualPercentage - this.targetPercentage,
    );

    if (deviation <= this.tolerance) {
      return this.strength;
    }

    // Score decreases with deviation beyond tolerance
    const penalty = (deviation - this.tolerance) * 2;
    return Math.max(-this.strength, this.strength - penalty);
  }

  /**
   * Convert to JSON with frequency specific data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      frequencyType: this.frequencyType,
      targetPercentage: this.targetPercentage,
      tolerance: this.tolerance,
      timeFrame: this.timeFrame,
    };
  }
}

/**
 * Seasonal preference (e.g., prefers more off days in summer)
 */
export class SeasonalPreference extends Preference {
  constructor(staffId, staffName, season, preferenceType, strength) {
    super(staffId, staffName, "seasonal", getConfidenceLevel(strength));
    this.season = season; // 'spring', 'summer', 'fall', 'winter', or month numbers
    this.preferenceType = preferenceType; // 'more_off', 'more_work', 'more_early', etc.
    this.strength = strength;
    this.monthMapping = this.getMonthMapping(season);
  }

  /**
   * Get month numbers for season
   * @param {string} season - Season name or month numbers
   * @returns {Array} Array of month numbers (1-12)
   */
  getMonthMapping(season) {
    switch (season) {
      case "spring":
        return [3, 4, 5];
      case "summer":
        return [6, 7, 8];
      case "fall":
        return [9, 10, 11];
      case "winter":
        return [12, 1, 2];
      default:
        // Assume it's a specific month or comma-separated months
        if (typeof season === "string") {
          return season
            .split(",")
            .map((m) => parseInt(m.trim()))
            .filter((m) => m >= 1 && m <= 12);
        }
        return [season];
    }
  }

  /**
   * Check if preference applies to a specific date
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} context - Additional context
   * @returns {boolean} True if preference applies
   */
  appliesTo(dateKey, context) {
    const date = new Date(dateKey);
    const month = date.getMonth() + 1; // 1-12

    return this.monthMapping.includes(month);
  }

  /**
   * Get preference score for seasonal context
   * @param {Object} context - Context with date, shiftType, etc.
   * @returns {number} Score from -100 to 100
   */
  getScore(context) {
    if (!this.appliesTo(context.dateKey)) {
      return 0;
    }

    // Check if current shift type matches seasonal preference
    switch (this.preferenceType) {
      case "more_off":
        if (context.shiftType === "×" || context.shiftType === "off") {
          return this.strength;
        }
        break;
      case "more_work":
        if (context.shiftType !== "×" && context.shiftType !== "off") {
          return this.strength;
        }
        break;
      case "more_early":
        if (context.shiftType === "△" || context.shiftType === "early") {
          return this.strength;
        }
        break;
      case "more_late":
        if (context.shiftType === "◇" || context.shiftType === "late") {
          return this.strength;
        }
        break;
    }

    return 0;
  }

  /**
   * Convert to JSON with seasonal specific data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      season: this.season,
      preferenceType: this.preferenceType,
      monthMapping: [...this.monthMapping],
    };
  }
}

/**
 * Preference manager for handling all staff preferences
 */
export class PreferenceManager {
  constructor() {
    this.preferences = new Map();
    this.staffPreferences = new Map(); // staffId -> array of preference IDs
    this.preferenceHistory = [];
  }

  /**
   * Add a preference
   * @param {Preference} preference - Preference to add
   */
  addPreference(preference) {
    this.preferences.set(preference.id, preference);

    // Add to staff preference tracking
    if (!this.staffPreferences.has(preference.staffId)) {
      this.staffPreferences.set(preference.staffId, []);
    }
    this.staffPreferences.get(preference.staffId).push(preference.id);
  }

  /**
   * Remove a preference
   * @param {string} preferenceId - ID of preference to remove
   */
  removePreference(preferenceId) {
    const preference = this.preferences.get(preferenceId);
    if (preference) {
      // Remove from staff tracking
      const staffPrefs = this.staffPreferences.get(preference.staffId) || [];
      const updatedPrefs = staffPrefs.filter((id) => id !== preferenceId);
      this.staffPreferences.set(preference.staffId, updatedPrefs);

      // Remove from main preferences
      this.preferences.delete(preferenceId);
    }
  }

  /**
   * Get preferences for a specific staff member
   * @param {string} staffId - Staff member ID
   * @returns {Array} Array of preferences for the staff member
   */
  getStaffPreferences(staffId) {
    const preferenceIds = this.staffPreferences.get(staffId) || [];
    return preferenceIds
      .map((id) => this.preferences.get(id))
      .filter((pref) => pref && pref.active);
  }

  /**
   * Get preference score for a staff member in a specific context
   * @param {string} staffId - Staff member ID
   * @param {Object} context - Context object with date, shift, etc.
   * @returns {number} Combined preference score
   */
  getPreferenceScore(staffId, context) {
    const staffPrefs = this.getStaffPreferences(staffId);
    let totalScore = 0;
    let weightSum = 0;

    staffPrefs.forEach((preference) => {
      const score = preference.getScore(context);
      const weight = this.getPreferenceWeight(preference);

      totalScore += score * weight;
      weightSum += weight;
    });

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Get weight for preference based on confidence and type
   * @param {Preference} preference - Preference object
   * @returns {number} Weight value
   */
  getPreferenceWeight(preference) {
    const confidenceWeights = {
      [CONFIDENCE_LEVELS.VERY_HIGH]: 1.0,
      [CONFIDENCE_LEVELS.HIGH]: 0.8,
      [CONFIDENCE_LEVELS.MEDIUM]: 0.6,
      [CONFIDENCE_LEVELS.LOW]: 0.4,
      [CONFIDENCE_LEVELS.VERY_LOW]: 0.2,
    };

    const typeWeights = {
      day_of_week: 1.0,
      shift_type: 0.9,
      consecutive_pattern: 0.8,
      frequency: 0.7,
      seasonal: 0.6,
    };

    const confidenceWeight = confidenceWeights[preference.confidence] || 0.5;
    const typeWeight = typeWeights[preference.type] || 0.5;

    return confidenceWeight * typeWeight;
  }

  /**
   * Create preferences from pattern analysis
   * @param {Object} patternAnalysis - Pattern analysis from PatternRecognizer
   * @returns {Array} Array of created preferences
   */
  createPreferencesFromPatterns(patternAnalysis) {
    const createdPreferences = [];

    Object.keys(patternAnalysis.staffPatterns).forEach((staffId) => {
      const staffPattern = patternAnalysis.staffPatterns[staffId];

      // Create day of week preferences
      Object.keys(staffPattern.patterns.dayOfWeek.patterns).forEach((day) => {
        const dayPattern = staffPattern.patterns.dayOfWeek.patterns[day];

        if (dayPattern.offPercentage > 60) {
          const preference = new DayOfWeekPreference(
            staffId,
            staffPattern.staffName,
            day,
            "off",
            dayPattern.offPercentage,
          );
          this.addPreference(preference);
          createdPreferences.push(preference);
        } else if (dayPattern.workPercentage > 80) {
          const preference = new DayOfWeekPreference(
            staffId,
            staffPattern.staffName,
            day,
            "work",
            dayPattern.workPercentage,
          );
          this.addPreference(preference);
          createdPreferences.push(preference);
        }
      });

      // Create shift type preferences
      Object.keys(staffPattern.patterns.shiftType.shiftTypes).forEach(
        (shiftType) => {
          const shiftData =
            staffPattern.patterns.shiftType.shiftTypes[shiftType];

          if (
            shiftData.percentage > 40 &&
            shiftData.confidence !== CONFIDENCE_LEVELS.VERY_LOW
          ) {
            const preference = new ShiftTypePreference(
              staffId,
              staffPattern.staffName,
              shiftType === "△"
                ? "early"
                : shiftType === "◇"
                  ? "late"
                  : shiftType === "×"
                    ? "off"
                    : "normal",
              shiftData.percentage,
            );
            this.addPreference(preference);
            createdPreferences.push(preference);
          }
        },
      );

      // Create consecutive pattern preferences
      if (staffPattern.patterns.consecutive.workStreaks.average > 0) {
        const preference = new ConsecutivePatternPreference(
          staffId,
          staffPattern.staffName,
          "work_days",
          Math.round(staffPattern.patterns.consecutive.workStreaks.average),
          80, // High confidence for average patterns
        );
        this.addPreference(preference);
        createdPreferences.push(preference);
      }

      // Create frequency preferences
      if (staffPattern.patterns.frequency.workFrequency.consistency > 60) {
        const preference = new FrequencyPreference(
          staffId,
          staffPattern.staffName,
          "work_frequency",
          staffPattern.patterns.frequency.workFrequency.percentage,
          staffPattern.patterns.frequency.workFrequency.consistency,
        );
        this.addPreference(preference);
        createdPreferences.push(preference);
      }
    });

    return createdPreferences;
  }

  /**
   * Get recommendations for improving preference satisfaction
   * @param {string} staffId - Staff member ID
   * @param {Object} currentSchedule - Current schedule data
   * @param {Array} dateRange - Date range to analyze
   * @returns {Array} Array of recommendations
   */
  getPreferenceRecommendations(staffId, currentSchedule, dateRange) {
    const recommendations = [];
    const staffPrefs = this.getStaffPreferences(staffId);

    staffPrefs.forEach((preference) => {
      let satisfactionCount = 0;
      let totalApplicable = 0;

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const currentShift = currentSchedule[dateKey];

        if (currentShift !== undefined) {
          const context = { dateKey, shiftType: currentShift };
          const score = preference.getScore(context);

          if (Math.abs(score) > 0) {
            // Preference applies
            totalApplicable++;
            if (score > 0) {
              // Preference satisfied
              satisfactionCount++;
            }
          }
        }
      });

      const satisfactionRate =
        totalApplicable > 0 ? (satisfactionCount / totalApplicable) * 100 : 100;

      if (satisfactionRate < 70) {
        recommendations.push({
          preferenceId: preference.id,
          preferenceType: preference.type,
          satisfactionRate,
          priority: satisfactionRate < 30 ? "high" : "medium",
          suggestion: this.generatePreferenceSuggestion(
            preference,
            satisfactionRate,
          ),
          details: {
            satisfactionCount,
            totalApplicable,
            preferenceStrength: preference.strength,
          },
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate suggestion text for preference improvement
   * @param {Preference} preference - Preference object
   * @param {number} satisfactionRate - Current satisfaction rate
   * @returns {string} Suggestion text
   */
  generatePreferenceSuggestion(preference, satisfactionRate) {
    switch (preference.type) {
      case "day_of_week":
        return `Consider scheduling ${preference.staffName} for ${preference.preferenceType} on ${preference.dayOfWeek}s more often`;
      case "shift_type":
        return `${preference.staffName} prefers ${preference.shiftType} shifts - current satisfaction: ${satisfactionRate.toFixed(1)}%`;
      case "consecutive_pattern":
        return `${preference.staffName} prefers ${preference.preferredLength} consecutive ${preference.patternType}`;
      case "frequency":
        return `Adjust ${preference.staffName}'s ${preference.frequencyType} to target ${preference.targetPercentage}%`;
      case "seasonal":
        return `Consider ${preference.staffName}'s seasonal preference for ${preference.preferenceType} during ${preference.season}`;
      default:
        return `Improve satisfaction for ${preference.staffName}'s ${preference.type} preference`;
    }
  }

  /**
   * Export all preferences to JSON
   * @returns {Object} JSON representation of all preferences
   */
  exportToJSON() {
    const exported = {
      exportedAt: new Date().toISOString(),
      preferences: {},
      staffPreferences: {},
      preferenceHistory: [...this.preferenceHistory],
    };

    // Export preferences
    Array.from(this.preferences.entries()).forEach(([id, preference]) => {
      exported.preferences[id] = preference.toJSON();
    });

    // Export staff preference mappings
    Array.from(this.staffPreferences.entries()).forEach(
      ([staffId, preferenceIds]) => {
        exported.staffPreferences[staffId] = [...preferenceIds];
      },
    );

    return exported;
  }

  /**
   * Import preferences from JSON
   * @param {Object} jsonData - JSON data to import
   */
  importFromJSON(jsonData) {
    this.preferences.clear();
    this.staffPreferences.clear();
    this.preferenceHistory = jsonData.preferenceHistory || [];

    // Import preferences
    Object.entries(jsonData.preferences || {}).forEach(([id, prefData]) => {
      let preference;

      switch (prefData.type) {
        case "day_of_week":
          preference = new DayOfWeekPreference(
            prefData.staffId,
            prefData.staffName,
            prefData.dayOfWeek,
            prefData.preferenceType,
            prefData.strength,
          );
          break;
        case "shift_type":
          preference = new ShiftTypePreference(
            prefData.staffId,
            prefData.staffName,
            prefData.shiftType,
            prefData.strength,
          );
          break;
        case "consecutive_pattern":
          preference = new ConsecutivePatternPreference(
            prefData.staffId,
            prefData.staffName,
            prefData.patternType,
            prefData.preferredLength,
            prefData.strength,
          );
          break;
        case "frequency":
          preference = new FrequencyPreference(
            prefData.staffId,
            prefData.staffName,
            prefData.frequencyType,
            prefData.targetPercentage,
            prefData.strength,
          );
          break;
        case "seasonal":
          preference = new SeasonalPreference(
            prefData.staffId,
            prefData.staffName,
            prefData.season,
            prefData.preferenceType,
            prefData.strength,
          );
          break;
        default:
          return;
      }

      if (preference) {
        // Apply common properties
        preference.id = prefData.id;
        preference.confidence = prefData.confidence;
        preference.active = prefData.active;
        preference.source = prefData.source;
        preference.detectedAt = prefData.detectedAt;
        preference.lastConfirmed = prefData.lastConfirmed;
        preference.overrideAllowed = prefData.overrideAllowed;
        preference.notes = prefData.notes;

        this.preferences.set(id, preference);
      }
    });

    // Import staff preference mappings
    Object.entries(jsonData.staffPreferences || {}).forEach(
      ([staffId, preferenceIds]) => {
        this.staffPreferences.set(staffId, [...preferenceIds]);
      },
    );
  }
}
