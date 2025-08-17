/**
 * PredictionModel.js
 *
 * Pattern-based prediction model for shift scheduling.
 * Learns from historical data to predict optimal shift assignments.
 */

import {
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  getDayOfWeek,
  isWeekday,
  PRIORITY_RULES,
} from "../constraints/ConstraintEngine";

/**
 * Prediction model for shift assignments
 */
export class PredictionModel {
  constructor() {
    this.initialized = false;
    this.patterns = new Map();
    this.staffPreferences = new Map();
    this.contextualPatterns = new Map();
    this.predictionAccuracy = {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracyByShiftType: {
        normal: { total: 0, correct: 0 },
        early: { total: 0, correct: 0 },
        late: { total: 0, correct: 0 },
        off: { total: 0, correct: 0 },
      },
      accuracyByDayOfWeek: {},
      accuracyByStaff: new Map(),
    };
  }

  /**
   * Initialize the prediction model
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("🧠 Initializing Prediction Model...");

    try {
      // Initialize pattern storage
      this.initializePatternStructures();

      // Load any existing patterns
      if (options.existingPatterns) {
        this.loadPatterns(options.existingPatterns);
      }

      this.initialized = true;
      console.log("✅ Prediction Model initialized successfully");
    } catch (error) {
      console.error("❌ Prediction Model initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize pattern data structures
   */
  initializePatternStructures() {
    // Day of week patterns for each staff
    // Staff preferences based on historical data
    // Contextual patterns (holiday periods, seasonal variations)

    const daysOfWeek = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    daysOfWeek.forEach((day) => {
      this.predictionAccuracy.accuracyByDayOfWeek[day] = {
        total: 0,
        correct: 0,
      };
    });
  }

  /**
   * Train model from historical data
   * @param {Object} historicalData - Historical schedule data
   */
  async trainFromHistoricalData(historicalData) {
    if (!historicalData || !historicalData.scheduleData) {
      console.log("ℹ️ No historical data available for training");
      return;
    }

    console.log("📚 Training prediction model from historical data...");

    try {
      const { scheduleData, staffProfiles } = historicalData;

      // Extract patterns from historical schedules
      Object.keys(scheduleData).forEach((monthKey) => {
        const monthSchedule = scheduleData[monthKey];
        this.extractPatternsFromSchedule(monthSchedule, staffProfiles);
      });

      // Analyze staff preferences
      this.analyzeStaffPreferences(scheduleData, staffProfiles);

      // Build contextual patterns
      this.buildContextualPatterns(scheduleData, staffProfiles);

      console.log(
        `✅ Model trained on ${Object.keys(scheduleData).length} months of data`,
      );
      console.log(`📊 Patterns learned: ${this.patterns.size} staff patterns`);
    } catch (error) {
      console.error("❌ Training failed:", error);
    }
  }

  /**
   * Extract patterns from a single schedule
   * @param {Object} schedule - Schedule data
   * @param {Array} staffProfiles - Staff profile data
   */
  extractPatternsFromSchedule(schedule, staffProfiles) {
    if (!schedule || !staffProfiles) return;

    staffProfiles.forEach((staff) => {
      const staffSchedule = schedule[staff.id];
      if (!staffSchedule) return;

      if (!this.patterns.has(staff.id)) {
        this.patterns.set(staff.id, {
          staffName: staff.name,
          dayOfWeekPatterns: {},
          sequencePatterns: [],
          shiftTypeFrequency: { normal: 0, early: 0, late: 0, off: 0 },
          totalAssignments: 0,
        });
      }

      const staffPattern = this.patterns.get(staff.id);

      // Analyze day-of-week patterns
      Object.keys(staffSchedule).forEach((dateKey) => {
        const shift = staffSchedule[dateKey];
        const dayOfWeek = getDayOfWeek(dateKey);

        if (!staffPattern.dayOfWeekPatterns[dayOfWeek]) {
          staffPattern.dayOfWeekPatterns[dayOfWeek] = {
            normal: 0,
            early: 0,
            late: 0,
            off: 0,
            total: 0,
          };
        }

        const dayPattern = staffPattern.dayOfWeekPatterns[dayOfWeek];
        dayPattern.total++;
        staffPattern.totalAssignments++;

        if (isOffDay(shift)) {
          dayPattern.off++;
          staffPattern.shiftTypeFrequency.off++;
        } else if (isEarlyShift(shift)) {
          dayPattern.early++;
          staffPattern.shiftTypeFrequency.early++;
        } else if (isLateShift(shift)) {
          dayPattern.late++;
          staffPattern.shiftTypeFrequency.late++;
        } else {
          dayPattern.normal++;
          staffPattern.shiftTypeFrequency.normal++;
        }
      });

      // Extract sequence patterns (consecutive days, patterns around off days, etc.)
      this.extractSequencePatterns(staffSchedule, staffPattern);
    });
  }

  /**
   * Extract sequence patterns from staff schedule
   * @param {Object} staffSchedule - Schedule for one staff member
   * @param {Object} staffPattern - Staff pattern object to update
   */
  extractSequencePatterns(staffSchedule, staffPattern) {
    const dates = Object.keys(staffSchedule).sort();
    const sequences = [];

    // Look for patterns of length 3-7 days
    for (let length = 3; length <= 7; length++) {
      for (let i = 0; i <= dates.length - length; i++) {
        const sequence = [];
        for (let j = 0; j < length; j++) {
          const shift = staffSchedule[dates[i + j]];
          sequence.push(this.normalizeShift(shift));
        }
        sequences.push(sequence.join("-"));
      }
    }

    // Count sequence frequency
    const sequenceCounts = {};
    sequences.forEach((seq) => {
      sequenceCounts[seq] = (sequenceCounts[seq] || 0) + 1;
    });

    // Keep only frequent sequences (appearing more than once)
    Object.keys(sequenceCounts).forEach((seq) => {
      if (sequenceCounts[seq] > 1) {
        const existing = staffPattern.sequencePatterns.find(
          (p) => p.pattern === seq,
        );
        if (existing) {
          existing.frequency += sequenceCounts[seq];
        } else {
          staffPattern.sequencePatterns.push({
            pattern: seq,
            frequency: sequenceCounts[seq],
            length: seq.split("-").length,
          });
        }
      }
    });

    // Sort by frequency
    staffPattern.sequencePatterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Analyze staff preferences from historical data
   * @param {Object} scheduleData - All historical schedule data
   * @param {Array} staffProfiles - Staff profiles
   */
  analyzeStaffPreferences(scheduleData, staffProfiles) {
    staffProfiles.forEach((staff) => {
      const preferences = {
        preferredDays: {},
        avoidedDays: {},
        preferredShifts: {},
        consistency: 0,
        flexibility: 0,
      };

      let totalAssignments = 0;
      const dayAssignments = {};
      const shiftAssignments = { normal: 0, early: 0, late: 0, off: 0 };

      // Aggregate across all months
      Object.values(scheduleData).forEach((monthSchedule) => {
        const staffSchedule = monthSchedule[staff.id];
        if (!staffSchedule) return;

        Object.keys(staffSchedule).forEach((dateKey) => {
          const shift = staffSchedule[dateKey];
          const dayOfWeek = getDayOfWeek(dateKey);

          totalAssignments++;

          if (!dayAssignments[dayOfWeek]) {
            dayAssignments[dayOfWeek] = {
              normal: 0,
              early: 0,
              late: 0,
              off: 0,
              total: 0,
            };
          }

          dayAssignments[dayOfWeek].total++;

          if (isOffDay(shift)) {
            dayAssignments[dayOfWeek].off++;
            shiftAssignments.off++;
          } else if (isEarlyShift(shift)) {
            dayAssignments[dayOfWeek].early++;
            shiftAssignments.early++;
          } else if (isLateShift(shift)) {
            dayAssignments[dayOfWeek].late++;
            shiftAssignments.late++;
          } else {
            dayAssignments[dayOfWeek].normal++;
            shiftAssignments.normal++;
          }
        });
      });

      // Calculate preferences
      Object.keys(dayAssignments).forEach((day) => {
        const dayData = dayAssignments[day];
        const offRate = dayData.off / dayData.total;
        const earlyRate = dayData.early / dayData.total;

        if (offRate > 0.3) {
          // More than 30% off days
          preferences.preferredDays[day] = "off";
        } else if (earlyRate > 0.3) {
          // More than 30% early shifts
          preferences.preferredDays[day] = "early";
        }

        if (offRate < 0.1) {
          // Less than 10% off days
          preferences.avoidedDays[day] = "off";
        }
      });

      // Calculate overall shift preferences
      const totalShifts = Object.values(shiftAssignments).reduce(
        (sum, count) => sum + count,
        0,
      );
      Object.keys(shiftAssignments).forEach((shiftType) => {
        const rate = shiftAssignments[shiftType] / totalShifts;
        if (rate > 0.3) {
          preferences.preferredShifts[shiftType] = rate;
        }
      });

      // Calculate consistency (how regular their patterns are)
      preferences.consistency = this.calculateConsistency(dayAssignments);

      // Calculate flexibility (how varied their assignments are)
      preferences.flexibility = this.calculateFlexibility(shiftAssignments);

      this.staffPreferences.set(staff.id, preferences);
    });
  }

  /**
   * Build contextual patterns (seasonal, monthly variations)
   * @param {Object} scheduleData - Historical schedule data
   * @param {Array} staffProfiles - Staff profiles
   */
  buildContextualPatterns(scheduleData, staffProfiles) {
    // Analyze patterns by month, season, special periods
    const monthlyPatterns = {};

    Object.keys(scheduleData).forEach((monthKey) => {
      const monthSchedule = scheduleData[monthKey];
      const month = parseInt(monthKey.split("-")[1]);

      if (!monthlyPatterns[month]) {
        monthlyPatterns[month] = {
          totalOffDays: 0,
          totalEarlyShifts: 0,
          totalLateShifts: 0,
          staffCount: 0,
        };
      }

      const monthPattern = monthlyPatterns[month];

      staffProfiles.forEach((staff) => {
        const staffSchedule = monthSchedule[staff.id];
        if (!staffSchedule) return;

        monthPattern.staffCount++;

        Object.values(staffSchedule).forEach((shift) => {
          if (isOffDay(shift)) monthPattern.totalOffDays++;
          else if (isEarlyShift(shift)) monthPattern.totalEarlyShifts++;
          else if (isLateShift(shift)) monthPattern.totalLateShifts++;
        });
      });
    });

    this.contextualPatterns.set("monthly", monthlyPatterns);
  }

  /**
   * Predict optimal shift for a staff member on a specific date
   * @param {Object} params - Prediction parameters
   * @returns {Object} Prediction result
   */
  async predictShift(params = {}) {
    const {
      staffId,
      staffName,
      dateKey,
      currentSchedule = {},
      staffMembers = [],
      contextDates = [],
    } = params;

    if (!this.initialized) {
      throw new Error("Prediction Model not initialized");
    }

    try {
      const dayOfWeek = getDayOfWeek(dateKey);
      const staffPattern = this.patterns.get(staffId);
      const staffPreferences = this.staffPreferences.get(staffId);

      // Base prediction scores for each shift type
      const shiftScores = {
        normal: 50,
        early: 20,
        late: 15,
        off: 25,
      };

      // Apply pattern-based scoring
      if (staffPattern) {
        this.applyPatternScoring(shiftScores, staffPattern, dayOfWeek);
      }

      // Apply preference-based scoring
      if (staffPreferences) {
        this.applyPreferenceScoring(shiftScores, staffPreferences, dayOfWeek);
      }

      // Apply priority rules
      this.applyPriorityRules(shiftScores, staffName, dayOfWeek);

      // Apply contextual scoring (sequence patterns, workload balance)
      this.applyContextualScoring(
        shiftScores,
        staffId,
        dateKey,
        currentSchedule,
        contextDates,
      );

      // Find best prediction
      const bestShift = Object.keys(shiftScores).reduce((best, current) =>
        shiftScores[current] > shiftScores[best] ? current : best,
      );

      const confidence = shiftScores[bestShift] / 100;
      const recommendedShift = this.convertShiftTypeToSymbol(bestShift);

      // Generate alternatives
      const alternatives = Object.keys(shiftScores)
        .filter((shift) => shift !== bestShift)
        .sort((a, b) => shiftScores[b] - shiftScores[a])
        .slice(0, 2)
        .map((shift) => ({
          shift: this.convertShiftTypeToSymbol(shift),
          confidence: shiftScores[shift] / 100,
          reasoning: this.generateReasoning(shift, shiftScores[shift]),
        }));

      const result = {
        recommendedShift,
        confidence: Math.min(1.0, Math.max(0.1, confidence)),
        reasoning: this.generateReasoning(bestShift, shiftScores[bestShift]),
        alternatives,
        patternMatch: staffPattern ? true : false,
        historicalSimilarity: this.calculateHistoricalSimilarity(
          staffPattern,
          dayOfWeek,
        ),
        scores: shiftScores,
      };

      return result;
    } catch (error) {
      console.error("❌ Shift prediction failed:", error);
      return {
        recommendedShift: "",
        confidence: 0.1,
        reasoning: "Prediction failed, defaulting to normal shift",
        alternatives: [],
        patternMatch: false,
        historicalSimilarity: 0,
      };
    }
  }

  /**
   * Apply pattern-based scoring
   * @param {Object} shiftScores - Current shift scores
   * @param {Object} staffPattern - Staff pattern data
   * @param {string} dayOfWeek - Day of week
   */
  applyPatternScoring(shiftScores, staffPattern, dayOfWeek) {
    const dayPattern = staffPattern.dayOfWeekPatterns[dayOfWeek];
    if (!dayPattern || dayPattern.total === 0) return;

    // Apply day-of-week patterns
    const normalRate = dayPattern.normal / dayPattern.total;
    const earlyRate = dayPattern.early / dayPattern.total;
    const lateRate = dayPattern.late / dayPattern.total;
    const offRate = dayPattern.off / dayPattern.total;

    shiftScores.normal += normalRate * 30;
    shiftScores.early += earlyRate * 30;
    shiftScores.late += lateRate * 30;
    shiftScores.off += offRate * 30;
  }

  /**
   * Apply preference-based scoring
   * @param {Object} shiftScores - Current shift scores
   * @param {Object} staffPreferences - Staff preferences
   * @param {string} dayOfWeek - Day of week
   */
  applyPreferenceScoring(shiftScores, staffPreferences, dayOfWeek) {
    // Apply day preferences
    if (staffPreferences.preferredDays[dayOfWeek]) {
      const preferredShift = staffPreferences.preferredDays[dayOfWeek];
      shiftScores[preferredShift] += 20;
    }

    if (staffPreferences.avoidedDays[dayOfWeek]) {
      const avoidedShift = staffPreferences.avoidedDays[dayOfWeek];
      shiftScores[avoidedShift] -= 20;
    }

    // Apply shift preferences
    Object.keys(staffPreferences.preferredShifts).forEach((shiftType) => {
      const preferenceStrength = staffPreferences.preferredShifts[shiftType];
      shiftScores[shiftType] += preferenceStrength * 15;
    });
  }

  /**
   * Apply priority rules scoring
   * @param {Object} shiftScores - Current shift scores
   * @param {string} staffName - Staff name
   * @param {string} dayOfWeek - Day of week
   */
  applyPriorityRules(shiftScores, staffName, dayOfWeek) {
    if (!PRIORITY_RULES[staffName]) return;

    const rules = PRIORITY_RULES[staffName];
    rules.preferredShifts.forEach((rule) => {
      if (rule.day === dayOfWeek) {
        const boost = rule.priority === "high" ? 40 : 20;

        switch (rule.shift) {
          case "early":
            shiftScores.early += boost;
            break;
          case "off":
            shiftScores.off += boost;
            break;
          case "late":
            shiftScores.late += boost;
            break;
          default:
            shiftScores.normal += boost;
        }
      }
    });
  }

  /**
   * Apply contextual scoring based on sequence patterns and workload
   * @param {Object} shiftScores - Current shift scores
   * @param {string} staffId - Staff ID
   * @param {string} dateKey - Date key
   * @param {Object} currentSchedule - Current schedule
   * @param {Array} contextDates - Context dates for analysis
   */
  applyContextualScoring(
    shiftScores,
    staffId,
    dateKey,
    currentSchedule,
    contextDates,
  ) {
    const staffSchedule = currentSchedule[staffId] || {};

    // Analyze recent assignments for this staff
    const recentAssignments = [];
    contextDates.forEach((date) => {
      const contextDateKey = date.toISOString().split("T")[0];
      if (
        contextDateKey !== dateKey &&
        staffSchedule[contextDateKey] !== undefined
      ) {
        recentAssignments.push(staffSchedule[contextDateKey]);
      }
    });

    // Avoid too many consecutive off days
    const recentOffDays = recentAssignments.filter((shift) =>
      isOffDay(shift),
    ).length;
    if (recentOffDays >= 2) {
      shiftScores.off -= 30;
      shiftScores.normal += 15;
    }

    // Avoid too many consecutive early shifts
    const recentEarlyShifts = recentAssignments.filter((shift) =>
      isEarlyShift(shift),
    ).length;
    if (recentEarlyShifts >= 3) {
      shiftScores.early -= 20;
      shiftScores.normal += 10;
    }

    // Balance workload - if staff has been working a lot, prefer off day
    const recentWorkingDays = recentAssignments.filter(
      (shift) => !isOffDay(shift),
    ).length;
    const workloadRatio =
      recentAssignments.length > 0
        ? recentWorkingDays / recentAssignments.length
        : 0;

    if (workloadRatio > 0.8) {
      // Very high workload
      shiftScores.off += 20;
    } else if (workloadRatio < 0.6) {
      // Low workload
      shiftScores.off -= 10;
      shiftScores.normal += 10;
    }
  }

  /**
   * Enhance schedule with predictions
   * @param {Object} baseSchedule - Base schedule to enhance
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Enhanced schedule
   */
  async enhanceSchedule(baseSchedule, staffMembers, dateRange) {
    const enhancedSchedule = JSON.parse(JSON.stringify(baseSchedule));
    let enhancementsApplied = 0;
    let totalPredictions = 0;

    for (const staff of staffMembers) {
      for (const date of dateRange) {
        const dateKey = date.toISOString().split("T")[0];

        // Only enhance empty or unoptimal cells
        if (!enhancedSchedule[staff.id]) {
          enhancedSchedule[staff.id] = {};
        }

        if (
          enhancedSchedule[staff.id][dateKey] === "" ||
          enhancedSchedule[staff.id][dateKey] === undefined
        ) {
          totalPredictions++;

          const prediction = await this.predictShift({
            staffId: staff.id,
            staffName: staff.name,
            dateKey,
            currentSchedule: enhancedSchedule,
            staffMembers,
            contextDates: dateRange,
          });

          if (prediction.confidence > 0.5) {
            enhancedSchedule[staff.id][dateKey] = prediction.recommendedShift;
            enhancementsApplied++;
          }
        }
      }
    }

    return {
      schedule: enhancedSchedule,
      confidence:
        totalPredictions > 0 ? enhancementsApplied / totalPredictions : 0,
      enhancementsApplied,
      totalPredictions,
      coverageRate: enhancementsApplied / totalPredictions,
    };
  }

  /**
   * Get recommendations for schedule improvements
   * @param {Object} scheduleData - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Array} Recommendations
   */
  async getRecommendations(scheduleData, staffMembers, dateRange) {
    const recommendations = [];

    // Analyze current schedule for improvement opportunities
    for (const staff of staffMembers) {
      const staffSchedule = scheduleData[staff.id] || {};
      const staffPattern = this.patterns.get(staff.id);

      if (!staffPattern) continue;

      // Check for pattern violations
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const currentShift = staffSchedule[dateKey];
        const dayOfWeek = getDayOfWeek(dateKey);

        const prediction = this.predictShift({
          staffId: staff.id,
          staffName: staff.name,
          dateKey,
          currentSchedule: scheduleData,
          staffMembers,
          contextDates: dateRange,
        });

        // If current assignment differs significantly from prediction
        if (
          currentShift &&
          prediction.recommendedShift !== currentShift &&
          prediction.confidence > 0.7
        ) {
          recommendations.push({
            type: "pattern_mismatch",
            staffId: staff.id,
            staffName: staff.name,
            date: dateKey,
            currentShift,
            recommendedShift: prediction.recommendedShift,
            confidence: prediction.confidence,
            priority: "medium",
            description: `Consider changing ${staff.name}'s shift on ${dateKey} from ${currentShift || "normal"} to ${prediction.recommendedShift || "normal"} based on historical patterns`,
            reasoning: prediction.reasoning,
          });
        }
      });
    }

    return recommendations;
  }

  // Helper methods
  normalizeShift(shift) {
    if (isOffDay(shift)) return "off";
    if (isEarlyShift(shift)) return "early";
    if (isLateShift(shift)) return "late";
    return "normal";
  }

  convertShiftTypeToSymbol(shiftType) {
    switch (shiftType) {
      case "early":
        return "△";
      case "late":
        return "◇";
      case "off":
        return "×";
      default:
        return "";
    }
  }

  generateReasoning(shiftType, score) {
    if (score > 80) return `Strong pattern match for ${shiftType} shift`;
    if (score > 60) return `Good historical precedent for ${shiftType} shift`;
    if (score > 40) return `Moderate preference for ${shiftType} shift`;
    return `Default assignment to ${shiftType} shift`;
  }

  calculateHistoricalSimilarity(staffPattern, dayOfWeek) {
    if (!staffPattern || !staffPattern.dayOfWeekPatterns[dayOfWeek]) {
      return 0;
    }

    const dayPattern = staffPattern.dayOfWeekPatterns[dayOfWeek];
    return dayPattern.total > 5 ? Math.min(1.0, dayPattern.total / 20) : 0.5;
  }

  calculateConsistency(dayAssignments) {
    // Calculate how consistent the staff member's schedule is
    const days = Object.keys(dayAssignments);
    if (days.length === 0) return 0;

    let totalVariance = 0;
    days.forEach((day) => {
      const dayData = dayAssignments[day];
      const rates = [
        dayData.normal / dayData.total,
        dayData.early / dayData.total,
        dayData.late / dayData.total,
        dayData.off / dayData.total,
      ];

      const maxRate = Math.max(...rates);
      totalVariance += 1 - maxRate; // Lower variance = higher consistency
    });

    return Math.max(0, 1 - totalVariance / days.length);
  }

  calculateFlexibility(shiftAssignments) {
    // Calculate how flexible/varied the staff member's assignments are
    const total = Object.values(shiftAssignments).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (total === 0) return 0;

    const rates = Object.values(shiftAssignments).map((count) => count / total);
    const entropy = rates.reduce((sum, rate) => {
      return rate > 0 ? sum - rate * Math.log2(rate) : sum;
    }, 0);

    return entropy / Math.log2(4); // Normalize to 0-1 scale
  }

  loadPatterns(existingPatterns) {
    // Load existing patterns from storage
    if (existingPatterns.patterns) {
      this.patterns = new Map(existingPatterns.patterns);
    }
    if (existingPatterns.staffPreferences) {
      this.staffPreferences = new Map(existingPatterns.staffPreferences);
    }
    if (existingPatterns.contextualPatterns) {
      this.contextualPatterns = new Map(existingPatterns.contextualPatterns);
    }
  }

  /**
   * Get model status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      patternsLearned: this.patterns.size,
      staffPreferences: this.staffPreferences.size,
      contextualPatterns: this.contextualPatterns.size,
      accuracy: {
        overall:
          this.predictionAccuracy.totalPredictions > 0
            ? (this.predictionAccuracy.correctPredictions /
                this.predictionAccuracy.totalPredictions) *
              100
            : 0,
        byShiftType: Object.fromEntries(
          Object.entries(this.predictionAccuracy.accuracyByShiftType).map(
            ([type, data]) => [
              type,
              data.total > 0 ? (data.correct / data.total) * 100 : 0,
            ],
          ),
        ),
      },
    };
  }
}
