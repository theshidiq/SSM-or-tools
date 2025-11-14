/**
 * FeatureEngineering.js
 *
 * Converts restaurant schedule data into machine learning features
 * for TensorFlow training and inference.
 */

import { isStaffActiveInCurrentPeriod } from "../../utils/staffUtils";
import { MODEL_CONFIG } from "./TensorFlowConfig";

/**
 * Main class for converting schedule data to ML features
 */
export class ScheduleFeatureEngineer {
  constructor() {
    this.featureNames = [];
    this.initializeFeatureNames();
  }

  /**
   * Initialize feature name mappings for debugging
   */
  initializeFeatureNames() {
    this.featureNames = [
      // Staff features (10)
      "staff_id_hash",
      "staff_status_regular",
      "staff_status_part_time",
      "staff_position_hash",
      "staff_work_frequency",
      "staff_preference_early",
      "staff_preference_late",
      "staff_preference_off",
      "staff_tenure_months",
      "staff_recent_workload",

      // Temporal features (8)
      "day_of_week",
      "day_of_month",
      "month_of_year",
      "is_weekend",
      "is_holiday",
      "period_index",
      "days_from_period_start",
      "season",

      // Historical features (12)
      "historical_shift_early_freq",
      "historical_shift_normal_freq",
      "historical_shift_late_freq",
      "historical_shift_off_freq",
      "recent_consecutive_days",
      "avg_weekly_hours",
      "pattern_consistency",
      "same_day_last_week",
      "same_day_last_month",
      "workload_trend",
      "preference_strength",
      "schedule_stability",

      // Context features (5)
      "business_busy_level",
      "required_coverage",
      "staff_availability",
      "cost_factor",
      "constraint_violations",

      // === ENHANCED FEATURES (30 additional) ===

      // Enhanced Staff Relationship Features (10)
      "team_chemistry_score",
      "collaboration_frequency",
      "shift_overlap_preference",
      "peer_work_balance",
      "social_connection_strength",
      "team_seniority_balance",
      "cross_training_score",
      "mentorship_involvement",
      "communication_frequency",
      "conflict_avoidance_score",

      // Enhanced Seasonal Features (8)
      "month_specific_pattern",
      "holiday_season_indicator",
      "weather_impact_factor",
      "seasonal_business_trend",
      "year_end_effect",
      "new_year_effect",
      "summer_vacation_factor",
      "cultural_event_impact",

      // Enhanced Workload Features (7)
      "cumulative_hours_this_week",
      "cumulative_hours_this_month",
      "fatigue_indicator",
      "recovery_time_needed",
      "overtime_frequency",
      "workload_balance_score",
      "burnout_risk_factor",

      // Enhanced Time Series Features (5)
      "recent_shift_momentum",
      "workload_trend_direction",
      "pattern_consistency_score",
      "schedule_predictability",
      "shift_change_velocity",

      // === PHASE 1: SEQUENCE-BASED FEATURES (15 additional) ===

      // Rolling Window Features (5)
      "rolling_3day_pattern_hash",
      "rolling_5day_pattern_hash",
      "rolling_7day_shift_distribution",
      "rolling_work_rest_ratio",
      "recent_shift_momentum_score",

      // Position-Based Features (5)
      "position_in_weekly_cycle",
      "days_since_last_off",
      "days_until_usual_off",
      "position_in_monthly_cycle",
      "predicted_next_by_position",

      // Transition Probability Features (5)
      "shift_transition_probability",
      "consecutive_work_likelihood",
      "off_day_clustering_tendency",
      "shift_type_switching_rate",
      "pattern_stability_index",
    ];

    console.log(
      `🔍 Feature Engineering: ${this.featureNames.length} features defined`,
    );
  }

  /**
   * Convert historical schedule data to training dataset
   * @param {Object} allHistoricalData - All periods schedule data
   * @param {Array} staffMembers - Staff information
   * @returns {Object} Training features and labels
   */
  prepareTrainingData(allHistoricalData, staffMembers) {
    const features = [];
    const labels = [];
    const sampleMetadata = [];

    console.log("🔧 Preparing training data from historical schedules...");
    console.log(
      `📁 Processing ${Object.keys(allHistoricalData).length} historical periods`,
    );
    console.log(`👥 Processing ${staffMembers.length} staff members`);

    let totalSamples = 0;
    let validSamples = 0;
    let invalidSamples = 0;
    let filteredStaffCount = 0;

    // Process each period
    Object.entries(allHistoricalData).forEach(([periodIndex, periodData]) => {
      if (!periodData || !periodData.schedule) {
        console.warn(`⚠️ Period ${periodIndex} has no schedule data`);
        return;
      }

      const { schedule, dateRange } = periodData;
      console.log(
        `📅 Processing period ${periodIndex} with ${dateRange.length} days`,
      );

      // Filter staff members to only include those who were active in this period
      const activeStaffForPeriod = staffMembers.filter((staff) => {
        try {
          const isActive = isStaffActiveInCurrentPeriod(staff, dateRange);

          if (!isActive) {
            console.log(
              `⏭️ Skipping inactive staff ${staff.name} for period ${periodIndex} training data`,
            );
            filteredStaffCount++;
          }

          return isActive;
        } catch (error) {
          console.warn(
            `⚠️ Error checking staff activity for ${staff.name} in period ${periodIndex}:`,
            error,
          );
          // Default to including staff if there's an error
          return true;
        }
      });

      console.log(
        `👥 Training with ${activeStaffForPeriod.length} active staff for period ${periodIndex}`,
      );

      // Process only active staff members
      activeStaffForPeriod.forEach((staff) => {
        if (!schedule[staff.id]) {
          console.log(
            `ℹ️ No schedule data for staff ${staff.name} (${staff.id}) in period ${periodIndex}`,
          );
          return;
        }

        const staffSchedule = schedule[staff.id];
        let staffSamples = 0;

        // Process each date for this staff member
        dateRange.forEach((date, dateIndex) => {
          totalSamples++;
          const dateKey = date.toISOString().split("T")[0];
          const actualShift = staffSchedule[dateKey];

          // Accept both defined values and empty strings (meaningful for regular staff)
          if (actualShift === undefined || actualShift === null) {
            console.log(
              `⚠️ Missing shift data for ${staff.name} on ${dateKey}`,
            );
            invalidSamples++;
            return;
          }

          // Generate features for this staff-date combination
          const featureVector = this.generateFeatures({
            staff,
            date,
            dateIndex,
            periodData,
            allHistoricalData,
            staffMembers,
          });

          // Generate label for this shift
          const label = this.shiftToLabel(actualShift, staff);

          if (featureVector && label !== null) {
            features.push(featureVector);
            labels.push(label);
            sampleMetadata.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              period: periodIndex,
              actualShift,
              label,
              isPartTime: staff.status === "パート",
            });
            validSamples++;
            staffSamples++;
          } else {
            console.warn(
              `⚠️ Invalid feature/label for ${staff.name} on ${dateKey}: shift="${actualShift}", label=${label}`,
            );
            invalidSamples++;
          }
        });

        console.log(`📊 Staff ${staff.name}: ${staffSamples} training samples`);
      });
    });

    console.log(`✅ Training data preparation completed:`);
    console.log(`  - Total samples processed: ${totalSamples}`);
    console.log(`  - Valid samples generated: ${validSamples}`);
    console.log(`  - Invalid/skipped samples: ${invalidSamples}`);
    console.log(`  - Inactive staff filtered: ${filteredStaffCount}`);
    console.log(
      `  - Success rate: ${((validSamples / totalSamples) * 100).toFixed(1)}%`,
    );

    // Validate feature consistency
    if (features.length > 0) {
      const featureLength = features[0].length;
      const expectedLength = MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL;
      console.log(
        `🔍 Feature validation: ${featureLength} features per sample (expected: ${expectedLength})`,
      );

      if (featureLength !== expectedLength) {
        console.error(
          `❌ Feature length mismatch! This will cause training failures.`,
        );
      }
    }

    return {
      features: features,
      labels: labels,
      featureNames: this.featureNames,
      metadata: sampleMetadata,
      stats: {
        totalSamples,
        validSamples,
        invalidSamples,
        successRate: validSamples / totalSamples,
      },
    };
  }

  /**
   * Generate feature vector for a specific staff-date combination
   */
  generateFeatures({
    staff,
    date,
    dateIndex,
    periodData,
    allHistoricalData,
    staffMembers,
  }) {
    const expectedFeatures = MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL;
    const features = new Array(expectedFeatures).fill(0);
    let idx = 0;

    try {
      console.log(
        `🔧 Generating ${expectedFeatures} enhanced features for staff ${staff.name} on ${date.toISOString().split("T")[0]}`,
      );

      // Staff features (10)
      features[idx++] = this.hashString(staff.id) / 1000000; // Normalize hash
      features[idx++] = staff.status === "社員" ? 1 : 0;
      features[idx++] = staff.status === "パート" ? 1 : 0;
      features[idx++] = this.hashString(staff.position || "default") / 1000000;
      features[idx++] = this.calculateWorkFrequency(staff, allHistoricalData);
      features[idx++] = this.calculateShiftPreference(
        staff,
        "△",
        allHistoricalData,
      );
      features[idx++] = this.calculateShiftPreference(
        staff,
        "▽",
        allHistoricalData,
      );
      features[idx++] = this.calculateShiftPreference(
        staff,
        "×",
        allHistoricalData,
      );
      features[idx++] = this.calculateTenure(staff, allHistoricalData);
      features[idx++] = this.calculateRecentWorkload(staff, periodData, date);

      // Temporal features (8)
      features[idx++] = date.getDay() / 6; // 0-6 normalized to 0-1
      features[idx++] = date.getDate() / 31;
      features[idx++] = date.getMonth() / 11;
      features[idx++] = date.getDay() === 0 || date.getDay() === 6 ? 1 : 0;
      features[idx++] = this.isHoliday(date) ? 1 : 0;
      features[idx++] =
        parseInt(
          Object.keys(allHistoricalData).find(
            (key) => allHistoricalData[key] === periodData,
          ) || 0,
        ) / 5;
      features[idx++] = dateIndex / 30; // Approximate days in period
      features[idx++] = this.getSeason(date) / 3;

      // Historical features (12)
      const historicalPatterns = this.analyzeHistoricalPatterns(
        staff,
        allHistoricalData,
      );
      features[idx++] = historicalPatterns.earlyFreq;
      features[idx++] = historicalPatterns.normalFreq;
      features[idx++] = historicalPatterns.lateFreq;
      features[idx++] = historicalPatterns.offFreq;
      features[idx++] =
        this.calculateConsecutiveDays(staff, periodData, date) / 7;
      features[idx++] = historicalPatterns.avgWeeklyHours / 40;
      features[idx++] = historicalPatterns.consistency;
      features[idx++] = this.getSameDayLastWeek(staff, periodData, date);
      features[idx++] = this.getSameDayLastMonth(
        staff,
        allHistoricalData,
        date,
      );
      features[idx++] = historicalPatterns.workloadTrend;
      features[idx++] = historicalPatterns.preferenceStrength;
      features[idx++] = historicalPatterns.stability;

      // Context features (5)
      features[idx++] = this.calculateBusinessLevel(date, periodData) / 100;
      features[idx++] =
        this.calculateRequiredCoverage(date, staffMembers) /
        staffMembers.length;
      features[idx++] = this.calculateStaffAvailability(staff, date);
      features[idx++] = this.calculateCostFactor(staff, date);
      features[idx++] = this.calculateConstraintViolations(
        staff,
        periodData,
        date,
      );

      // === ENHANCED FEATURES (30 additional) ===

      // Enhanced Staff Relationship Features (10)
      try {
        features[idx++] = this.calculateTeamChemistry(staff, staffMembers, periodData);
        features[idx++] = this.calculateCollaborationFrequency(staff, staffMembers, allHistoricalData);
        features[idx++] = this.calculateShiftOverlapPreference(staff, staffMembers, allHistoricalData);
        features[idx++] = this.calculatePeerWorkBalance(staff, staffMembers, periodData);
        features[idx++] = this.calculateSocialConnectionStrength(staff, staffMembers);
        features[idx++] = this.calculateTeamSeniorityBalance(staff, staffMembers, allHistoricalData);
        features[idx++] = this.calculateCrossTrainingScore(staff);
        features[idx++] = this.calculateMentorshipInvolvement(staff, staffMembers);
        features[idx++] = this.calculateCommunicationFrequency(staff);
        features[idx++] = this.calculateConflictAvoidance(staff, staffMembers);
      } catch (error) {
        console.error("❌ Enhanced Staff Relationship features failed:", error.message);
        // Fill remaining relationship features with defaults
        while (idx < 45) features[idx++] = 0.5;
      }

      // Enhanced Seasonal Features (8)
      try {
        features[idx++] = this.calculateMonthSpecificPattern(staff, date, allHistoricalData);
        features[idx++] = this.calculateHolidaySeasonIndicator(date);
        features[idx++] = this.calculateWeatherImpact(date);
        features[idx++] = this.calculateSeasonalBusinessTrend(date, periodData);
        features[idx++] = this.calculateYearEndEffect(date);
        features[idx++] = this.calculateNewYearEffect(date);
        features[idx++] = this.calculateSummerVacationFactor(date);
        features[idx++] = this.calculateCulturalEventImpact(date);
      } catch (error) {
        console.error("❌ Enhanced Seasonal features failed:", error.message);
        // Fill remaining seasonal features with defaults
        while (idx < 53) features[idx++] = 0.5;
      }

      // Enhanced Workload Features (7)
      try {
        features[idx++] = this.calculateCumulativeHoursThisWeek(staff, periodData, date);
        features[idx++] = this.calculateCumulativeHoursThisMonth(staff, periodData, date);
        features[idx++] = this.calculateFatigueIndicator(staff, periodData, date);
        features[idx++] = this.calculateRecoveryTimeNeeded(staff, periodData, date);
        features[idx++] = this.calculateOvertimeFrequency(staff, allHistoricalData);
        features[idx++] = this.calculateWorkloadBalanceScore(staff, periodData, date);
        features[idx++] = this.calculateBurnoutRiskFactor(staff, periodData, date);
      } catch (error) {
        console.error("❌ Enhanced Workload features failed:", error.message);
        // Fill remaining workload features with defaults
        while (idx < 60) features[idx++] = 0.5;
      }

      // Enhanced Time Series Features (5)
      try {
        features[idx++] = this.calculateRecentShiftMomentum(staff, periodData, date);
        features[idx++] = this.calculateWorkloadTrendDirection(staff, periodData, date);
        features[idx++] = this.calculatePatternConsistencyScore(staff, allHistoricalData);
        features[idx++] = this.calculateSchedulePredictability(staff, allHistoricalData);
        features[idx++] = this.calculateShiftChangeVelocity(staff, periodData, date);
      } catch (error) {
        console.error("❌ Enhanced Time Series features failed:", error.message);
        // Fill remaining time series features with defaults
        while (idx < 65) features[idx++] = 0.5;
      }

      // === PHASE 1: SEQUENCE-BASED FEATURES (15 additional) ===

      // Rolling Window Features (5)
      try {
        features[idx++] = this.calculateRolling3DayPattern(staff, periodData, date);
        features[idx++] = this.calculateRolling5DayPattern(staff, periodData, date);
        features[idx++] = this.calculateRolling7DayShiftDistribution(staff, periodData, date);
        features[idx++] = this.calculateRollingWorkRestRatio(staff, periodData, date);
        features[idx++] = this.calculateRecentShiftMomentumScore(staff, periodData, date);
      } catch (error) {
        console.error("❌ Rolling Window features failed:", error.message);
        // Fill remaining rolling window features with defaults
        while (idx < 70) features[idx++] = 0.5;
      }

      // Position-Based Features (5)
      try {
        features[idx++] = this.calculatePositionInWeeklyCycle(staff, periodData, date, allHistoricalData);
        features[idx++] = this.calculateDaysSinceLastOff(staff, periodData, date);
        features[idx++] = this.calculateDaysUntilUsualOff(staff, periodData, date, allHistoricalData);
        features[idx++] = this.calculatePositionInMonthlyCycle(date);
        features[idx++] = this.predictNextByPosition(staff, periodData, date, allHistoricalData);
      } catch (error) {
        console.error("❌ Position-Based features failed:", error.message);
        // Fill remaining position features with defaults
        while (idx < 75) features[idx++] = 0.5;
      }

      // Transition Probability Features (5)
      try {
        features[idx++] = this.calculateShiftTransitionProbability(staff, periodData, date, allHistoricalData);
        features[idx++] = this.calculateConsecutiveWorkLikelihood(staff, periodData, date, allHistoricalData);
        features[idx++] = this.calculateOffDayClusteringTendency(staff, allHistoricalData);
        features[idx++] = this.calculateShiftTypeSwitchingRate(staff, allHistoricalData);
        features[idx++] = this.calculatePatternStabilityIndex(staff, allHistoricalData);
      } catch (error) {
        console.error("❌ Transition Probability features failed:", error.message);
        // Fill remaining transition features with defaults
        while (idx < 80) features[idx++] = 0.5;
      }

      // Validate feature count matches expected
      if (idx !== expectedFeatures) {
        console.warn(
          `⚠️ Feature count mismatch: generated ${idx}, expected ${expectedFeatures}`,
        );
        // Pad or trim to match expected size
        while (features.length < expectedFeatures) features.push(0);
        while (features.length > expectedFeatures) features.pop();
      }

      // Validate no NaN or infinite values
      for (let i = 0; i < features.length; i++) {
        if (!isFinite(features[i])) {
          console.warn(
            `⚠️ Invalid feature at index ${i}: ${features[i]}, replacing with 0`,
          );
          features[i] = 0;
        }
      }

      console.log(
        `✅ Generated ${features.length} valid features (idx=${idx})`,
      );
      return features;
    } catch (error) {
      console.error("❌ Error generating features:", error);
      return null;
    }
  }

  /**
   * Convert shift symbol to ML label
   */
  shiftToLabel(shift, staff) {
    // Handle different shift types based on staff status
    if (!shift || shift === "") {
      // 🔧 FIX: Blank/empty shifts are valid data for both regular and part-time staff
      // Empty shift means "not scheduled/not working that day" which is valid training data
      // Return BLANK for all staff types instead of null for part-time staff
      return MODEL_CONFIG.SHIFT_TYPES.BLANK;
    }

    switch (shift) {
      case "○":
        return MODEL_CONFIG.SHIFT_TYPES.CIRCLE;
      case "△":
        return MODEL_CONFIG.SHIFT_TYPES.TRIANGLE;
      case "▽":
        return MODEL_CONFIG.SHIFT_TYPES.INVERTED;
      case "×":
        return MODEL_CONFIG.SHIFT_TYPES.CROSS;
      case "late":
        return MODEL_CONFIG.SHIFT_TYPES.INVERTED;
      default:
        // Custom text - treat as normal shift
        return staff.status === "パート"
          ? MODEL_CONFIG.SHIFT_TYPES.CIRCLE
          : MODEL_CONFIG.SHIFT_TYPES.BLANK;
    }
  }

  /**
   * Convert ML prediction back to shift symbol
   */
  labelToShift(labelIndex, staff) {
    switch (labelIndex) {
      case MODEL_CONFIG.SHIFT_TYPES.BLANK:
        return ""; // Blank for regular staff normal shift
      case MODEL_CONFIG.SHIFT_TYPES.CIRCLE:
        return "○"; // Circle for part-time normal shift
      case MODEL_CONFIG.SHIFT_TYPES.TRIANGLE:
        return "△"; // Early shift
      case MODEL_CONFIG.SHIFT_TYPES.INVERTED:
        return "▽"; // Late shift
      case MODEL_CONFIG.SHIFT_TYPES.CROSS:
        return "×"; // Day off
      default:
        return staff.status === "パート" ? "○" : "";
    }
  }

  // Utility functions for feature calculation

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  calculateWorkFrequency(staff, allHistoricalData) {
    let totalDays = 0;
    let workDays = 0;

    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.values(periodData.schedule[staff.id]).forEach((shift) => {
        totalDays++;
        if (shift && shift !== "×") workDays++;
      });
    });

    return totalDays > 0 ? workDays / totalDays : 0.5;
  }

  calculateShiftPreference(staff, shiftType, allHistoricalData) {
    let totalShifts = 0;
    let targetShifts = 0;

    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.values(periodData.schedule[staff.id]).forEach((shift) => {
        if (shift && shift !== "×") {
          totalShifts++;
          if (shift === shiftType || (shiftType === "○" && shift === "")) {
            targetShifts++;
          }
        }
      });
    });

    return totalShifts > 0 ? targetShifts / totalShifts : 0;
  }

  calculateTenure(staff, allHistoricalData) {
    // Estimate tenure based on data presence across periods
    const periodsWithData = Object.values(allHistoricalData).filter(
      (periodData) => periodData?.schedule?.[staff.id],
    ).length;

    return Math.min(periodsWithData * 2, 24) / 24; // Max 24 months, normalized
  }

  calculateRecentWorkload(staff, periodData, currentDate) {
    if (!periodData?.schedule?.[staff.id]) return 0.5;

    // Look at past 7 days workload
    let workDays = 0;
    const schedule = periodData.schedule[staff.id];

    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(currentDate);
      pastDate.setDate(pastDate.getDate() - i);
      const dateKey = pastDate.toISOString().split("T")[0];

      if (schedule[dateKey] && schedule[dateKey] !== "×") {
        workDays++;
      }
    }

    return workDays / 7;
  }

  isHoliday(date) {
    // Simple Japanese holiday detection (can be expanded)
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return (
      (month === 1 && day === 1) || // New Year
      (month === 12 && day >= 29)
    ); // Year-end
  }

  getSeason(date) {
    const month = date.getMonth() + 1;
    if (month >= 3 && month <= 5) return 0; // Spring
    if (month >= 6 && month <= 8) return 1; // Summer
    if (month >= 9 && month <= 11) return 2; // Fall
    return 3; // Winter
  }

  analyzeHistoricalPatterns(staff, allHistoricalData) {
    let earlyCount = 0,
      normalCount = 0,
      lateCount = 0,
      offCount = 0,
      total = 0;
    const periods = Object.keys(allHistoricalData).length;
    const periodWorkRates = [];

    Object.entries(allHistoricalData).forEach(([periodKey, periodData]) => {
      if (!periodData?.schedule?.[staff.id]) return;

      let periodWork = 0,
        periodTotal = 0;

      Object.values(periodData.schedule[staff.id]).forEach((shift) => {
        total++;
        periodTotal++;

        // Count shift types with proper handling of empty strings for regular staff
        const isPartTime = staff.status === "パート";

        switch (shift) {
          case "△":
            earlyCount++;
            periodWork++;
            break;
          case "○":
            normalCount++;
            periodWork++;
            break;
          case "▽":
            lateCount++;
            periodWork++;
            break;
          case "×":
            offCount++;
            break;
          case "":
            if (!isPartTime) {
              normalCount++; // Empty = normal work for regular staff
              periodWork++;
            }
            break;
          default:
            if (shift && shift.trim() !== "") {
              normalCount++; // Custom text = work
              periodWork++;
            }
        }
      });

      if (periodTotal > 0) {
        periodWorkRates.push(periodWork / periodTotal);
      }
    });

    if (total === 0) {
      return {
        earlyFreq: 0,
        normalFreq: staff.status === "パート" ? 0.3 : 0.7,
        lateFreq: 0,
        offFreq: 0.3,
        avgWeeklyHours: staff.status === "パート" ? 20 : 35,
        consistency: 0.5,
        workloadTrend: 0,
        preferenceStrength: 0.5,
        stability: 0.5,
      };
    }

    // Calculate workload trend
    let workloadTrend = 0;
    if (periodWorkRates.length >= 2) {
      const recent = periodWorkRates.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const older =
        periodWorkRates.slice(0, -2).reduce((a, b) => a + b, 0) /
        Math.max(1, periodWorkRates.length - 2);
      workloadTrend = (recent - older) * 2; // Scale to [-2, 2] range
    }

    // Calculate stability based on variance in work rates
    let stability = 0.5;
    if (periodWorkRates.length > 1) {
      const avgRate =
        periodWorkRates.reduce((a, b) => a + b, 0) / periodWorkRates.length;
      const variance =
        periodWorkRates.reduce(
          (sum, rate) => sum + Math.pow(rate - avgRate, 2),
          0,
        ) / periodWorkRates.length;
      stability = Math.max(0, Math.min(1, 1 - variance)); // Higher stability = lower variance
    }

    return {
      earlyFreq: earlyCount / total,
      normalFreq: normalCount / total,
      lateFreq: lateCount / total,
      offFreq: offCount / total,
      avgWeeklyHours:
        ((total - offCount) / total) * (staff.status === "パート" ? 25 : 40),
      consistency: this.calculateConsistency(staff, allHistoricalData),
      workloadTrend: Math.max(-1, Math.min(1, workloadTrend)),
      preferenceStrength: Math.max(earlyCount, normalCount, lateCount) / total,
      stability: stability,
    };
  }

  calculateConsistency(staff, allHistoricalData) {
    // Measure how consistent the staff's patterns are across periods
    const patterns = [];

    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData?.schedule?.[staff.id]) return;

      const dayPatterns = {};
      Object.entries(periodData.schedule[staff.id]).forEach(
        ([dateKey, shift]) => {
          const date = new Date(dateKey);
          const dayOfWeek = date.getDay();
          dayPatterns[dayOfWeek] = dayPatterns[dayOfWeek] || [];
          dayPatterns[dayOfWeek].push(shift);
        },
      );

      patterns.push(dayPatterns);
    });

    // Calculate pattern consistency (simplified)
    return patterns.length > 1 ? 0.7 : 0.5;
  }

  // Additional utility functions (improved implementations)
  calculateConsecutiveDays(staff, periodData, currentDate) {
    if (!periodData?.schedule?.[staff.id]) return 0;

    let consecutive = 0;
    const schedule = periodData.schedule[staff.id];

    for (let i = 1; i <= 10; i++) {
      const pastDate = new Date(currentDate);
      pastDate.setDate(pastDate.getDate() - i);
      const dateKey = pastDate.toISOString().split("T")[0];

      const shift = schedule[dateKey];
      const isWorkDay =
        shift && shift !== "×" && shift !== ""
          ? true
          : !staff.isPartTime && shift === ""; // Empty = work for regular staff

      if (isWorkDay) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  getSameDayLastWeek(staff, periodData, currentDate) {
    if (!periodData?.schedule?.[staff.id]) return 0;

    const lastWeek = new Date(currentDate);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const dateKey = lastWeek.toISOString().split("T")[0];

    const shift = periodData.schedule[staff.id][dateKey];
    const isWorkDay =
      shift && shift !== "×" ? 1 : !staff.isPartTime && shift === "" ? 1 : 0;
    return isWorkDay;
  }

  getSameDayLastMonth(staff, allHistoricalData, currentDate) {
    // Look for same day of week in previous periods
    const targetDayOfWeek = currentDate.getDay();
    let workingDaysFound = 0;
    let totalDaysFound = 0;

    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.entries(periodData.schedule[staff.id]).forEach(
        ([dateKey, shift]) => {
          const date = new Date(dateKey);
          if (date.getDay() === targetDayOfWeek) {
            totalDaysFound++;
            const isWorkDay =
              shift && shift !== "×" ? true : !staff.isPartTime && shift === "";
            if (isWorkDay) workingDaysFound++;
          }
        },
      );
    });

    return totalDaysFound > 0 ? workingDaysFound / totalDaysFound : 0.5;
  }

  calculateBusinessLevel(date, periodData) {
    // Enhanced business level calculation
    const dayOfWeek = date.getDay();
    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();

    let baseLevel = 60; // Weekday baseline

    // Weekend premium
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseLevel = 80;
    }

    // Friday night boost
    if (dayOfWeek === 5) {
      baseLevel = 75;
    }

    // End of month boost (payday effect)
    if (dayOfMonth >= 25) {
      baseLevel += 10;
    }

    // Holiday season boost
    if (month === 12 || month === 1) {
      baseLevel += 15;
    }

    return Math.min(100, baseLevel);
  }

  calculateRequiredCoverage(date, staffMembers) {
    // Required coverage based on day and staff count
    const dayOfWeek = date.getDay();
    const baseRequirement = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 0.6;
    return Math.ceil(staffMembers.length * baseRequirement);
  }

  calculateStaffAvailability(staff, date) {
    // Simplified availability based on staff status
    return staff.status === "パート" ? 0.7 : 0.9;
  }

  calculateCostFactor(staff, date) {
    // Cost factor based on staff type and day
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseCost = staff.status === "社員" ? 0.8 : 0.6;
    return isWeekend ? baseCost * 1.2 : baseCost;
  }

  calculateConstraintViolations(staff, periodData, date) {
    // Check for potential constraint violations
    const consecutiveDays = this.calculateConsecutiveDays(
      staff,
      periodData,
      date,
    );
    const maxDays = staff.status === "パート" ? 4 : 6;

    return consecutiveDays >= maxDays ? 1 : 0;
  }

  // ============================================================================
  // ENHANCED FEATURE CALCULATION METHODS (30 new methods)
  // ============================================================================

  // === Enhanced Staff Relationship Features (10) ===

  calculateTeamChemistry(staff, staffMembers, periodData) {
    // Calculate how well this staff works with the team based on overlapping shifts
    if (!periodData?.schedule) return 0.7; // Default neutral chemistry

    const schedule = periodData.schedule;
    let sharedShifts = 0;
    let totalShifts = 0;

    Object.keys(schedule[staff.id] || {}).forEach(dateKey => {
      const staffShift = schedule[staff.id][dateKey];
      if (staffShift && staffShift !== '×') {
        totalShifts++;
        // Count how many other staff work on same day
        const othersWorking = staffMembers.filter(other =>
          other.id !== staff.id &&
          schedule[other.id]?.[dateKey] &&
          schedule[other.id][dateKey] !== '×'
        ).length;
        sharedShifts += othersWorking;
      }
    });

    return totalShifts > 0 ? Math.min(1, sharedShifts / (totalShifts * staffMembers.length * 0.5)) : 0.7;
  }

  calculateCollaborationFrequency(staff, staffMembers, allHistoricalData) {
    // How often this staff collaborates with others historically
    let collaborationDays = 0;
    let totalWorkDays = 0;

    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.entries(periodData.schedule[staff.id]).forEach(([dateKey, shift]) => {
        if (shift && shift !== '×') {
          totalWorkDays++;
          const hasCollaborators = staffMembers.some(other =>
            other.id !== staff.id &&
            periodData.schedule[other.id]?.[dateKey] &&
            periodData.schedule[other.id][dateKey] !== '×'
          );
          if (hasCollaborators) collaborationDays++;
        }
      });
    });

    return totalWorkDays > 0 ? collaborationDays / totalWorkDays : 0.8;
  }

  calculateShiftOverlapPreference(staff, staffMembers, allHistoricalData) {
    // Preference for working when specific team members work
    return 0.5; // Neutral - requires more complex relationship tracking
  }

  calculatePeerWorkBalance(staff, staffMembers, periodData) {
    // Balance of workload compared to peers of same type
    if (!periodData?.schedule) return 0.5;

    const staffType = staff.status;
    const peers = staffMembers.filter(s => s.status === staffType && s.id !== staff.id);
    if (peers.length === 0) return 0.5;

    const staffWorkDays = Object.values(periodData.schedule[staff.id] || {})
      .filter(shift => shift && shift !== '×').length;

    const peerAvgWorkDays = peers.reduce((sum, peer) => {
      const peerWorkDays = Object.values(periodData.schedule[peer.id] || {})
        .filter(shift => shift && shift !== '×').length;
      return sum + peerWorkDays;
    }, 0) / peers.length;

    return peerAvgWorkDays > 0 ? Math.min(1, staffWorkDays / peerAvgWorkDays) : 0.5;
  }

  calculateSocialConnectionStrength(staff, staffMembers) {
    // Social network strength within team (simplified)
    const teamSize = staffMembers.length;
    return teamSize > 3 ? 0.7 : 0.5;
  }

  calculateTeamSeniorityBalance(staff, staffMembers, allHistoricalData) {
    // Balance of experience levels in team
    const tenure = this.calculateTenure(staff, allHistoricalData);
    const avgTenure = staffMembers.reduce((sum, s) =>
      sum + this.calculateTenure(s, allHistoricalData), 0
    ) / staffMembers.length;

    return avgTenure > 0 ? Math.min(1, tenure / avgTenure) : 0.5;
  }

  calculateCrossTrainingScore(staff) {
    // Ability to cover multiple positions (simplified)
    return staff.status === '社員' ? 0.8 : 0.5;
  }

  calculateMentorshipInvolvement(staff, staffMembers) {
    // Involvement in mentoring junior staff
    return staff.status === '社員' ? 0.6 : 0.3;
  }

  calculateCommunicationFrequency(staff) {
    // Communication frequency with management (simplified)
    return staff.status === '社員' ? 0.7 : 0.5;
  }

  calculateConflictAvoidance(staff, staffMembers) {
    // Tendency to avoid scheduling conflicts
    return 0.7; // Default moderate conflict avoidance
  }

  // === Enhanced Seasonal Features (8) ===

  calculateMonthSpecificPattern(staff, date, allHistoricalData) {
    // Specific patterns for this month historically
    const targetMonth = date.getMonth();
    let sameMonthWorkDays = 0;
    let sameMonthTotalDays = 0;

    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.entries(periodData.schedule[staff.id]).forEach(([dateKey, shift]) => {
        const histDate = new Date(dateKey);
        if (histDate.getMonth() === targetMonth) {
          sameMonthTotalDays++;
          if (shift && shift !== '×') sameMonthWorkDays++;
        }
      });
    });

    return sameMonthTotalDays > 0 ? sameMonthWorkDays / sameMonthTotalDays : 0.7;
  }

  calculateHolidaySeasonIndicator(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Major holiday seasons in Japan
    if (month === 12 && day >= 25) return 0.9; // Year-end
    if (month === 1 && day <= 7) return 0.9; // New Year
    if (month === 8 && day >= 10 && day <= 16) return 0.7; // Obon
    if (month === 5 && day <= 5) return 0.7; // Golden Week

    return 0.1;
  }

  calculateWeatherImpact(date) {
    // Seasonal weather impact on business
    const month = date.getMonth() + 1;

    if (month >= 6 && month <= 9) return 0.7; // Summer - tourism season
    if (month === 12 || month === 1) return 0.6; // Winter - holiday season

    return 0.5;
  }

  calculateSeasonalBusinessTrend(date, periodData) {
    // Business trend for current season
    const season = this.getSeason(date);
    return season === 1 ? 0.8 : season === 3 ? 0.7 : 0.6; // Summer/Winter busier
  }

  calculateYearEndEffect(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return month === 12 && day >= 20 ? 1 : 0;
  }

  calculateNewYearEffect(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return month === 1 && day <= 10 ? 1 : 0;
  }

  calculateSummerVacationFactor(date) {
    const month = date.getMonth() + 1;

    return month >= 7 && month <= 8 ? 0.8 : 0;
  }

  calculateCulturalEventImpact(date) {
    // Impact of cultural events (festivals, etc.)
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    // Weekends in spring/fall (festival seasons)
    if ((month >= 3 && month <= 5) || (month >= 9 && month <= 11)) {
      return (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 0.2;
    }

    return 0.1;
  }

  // === Enhanced Workload Features (7) ===

  calculateCumulativeHoursThisWeek(staff, periodData, date) {
    if (!periodData?.schedule?.[staff.id]) return 0.5;

    let hoursThisWeek = 0;
    const schedule = periodData.schedule[staff.id];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startOfWeek);
      checkDate.setDate(startOfWeek.getDate() + i);
      if (checkDate > date) break; // Don't count future days

      const dateKey = checkDate.toISOString().split('T')[0];
      const shift = schedule[dateKey];

      if (shift && shift !== '×') {
        hoursThisWeek += staff.status === 'パート' ? 6 : 8; // Estimated hours per shift
      }
    }

    const maxWeeklyHours = staff.status === 'パート' ? 30 : 50;
    return Math.min(1, hoursThisWeek / maxWeeklyHours);
  }

  calculateCumulativeHoursThisMonth(staff, periodData, date) {
    if (!periodData?.schedule?.[staff.id]) return 0.5;

    let hoursThisMonth = 0;
    const schedule = periodData.schedule[staff.id];
    const currentMonth = date.getMonth();

    Object.entries(schedule).forEach(([dateKey, shift]) => {
      const checkDate = new Date(dateKey);
      if (checkDate.getMonth() === currentMonth && checkDate <= date) {
        if (shift && shift !== '×') {
          hoursThisMonth += staff.status === 'パート' ? 6 : 8;
        }
      }
    });

    const maxMonthlyHours = staff.status === 'パート' ? 120 : 180;
    return Math.min(1, hoursThisMonth / maxMonthlyHours);
  }

  calculateFatigueIndicator(staff, periodData, date) {
    // Fatigue based on consecutive work days and total hours
    const consecutiveDays = this.calculateConsecutiveDays(staff, periodData, date);
    const cumulativeHours = this.calculateCumulativeHoursThisWeek(staff, periodData, date);

    return Math.min(1, (consecutiveDays / 7 * 0.6) + (cumulativeHours * 0.4));
  }

  calculateRecoveryTimeNeeded(staff, periodData, date) {
    // Recovery time needed based on recent workload
    const fatigue = this.calculateFatigueIndicator(staff, periodData, date);
    return fatigue; // Higher fatigue = more recovery needed
  }

  calculateOvertimeFrequency(staff, allHistoricalData) {
    // Frequency of overtime work historically
    if (staff.status === 'パート') return 0.1; // Part-time rarely has overtime

    let overtimeDays = 0;
    let totalWorkDays = 0;

    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;

      Object.values(periodData.schedule[staff.id]).forEach(shift => {
        if (shift && shift !== '×') {
          totalWorkDays++;
          // Late shift suggests possible overtime
          if (shift === '▽') overtimeDays++;
        }
      });
    });

    return totalWorkDays > 0 ? overtimeDays / totalWorkDays : 0.2;
  }

  calculateWorkloadBalanceScore(staff, periodData, date) {
    // Balance between work and rest
    const workFreq = this.calculateRecentWorkload(staff, periodData, date);
    return 1 - Math.abs(workFreq - 0.7); // Optimal is 70% work, 30% rest
  }

  calculateBurnoutRiskFactor(staff, periodData, date) {
    // Risk of burnout based on sustained high workload
    const fatigue = this.calculateFatigueIndicator(staff, periodData, date);
    const consecutiveDays = this.calculateConsecutiveDays(staff, periodData, date);
    const maxConsecutive = staff.status === 'パート' ? 4 : 6;

    return Math.min(1, (fatigue * 0.6) + (consecutiveDays / maxConsecutive * 0.4));
  }

  // === Enhanced Time Series Features (5) ===

  calculateRecentShiftMomentum(staff, periodData, date) {
    // Momentum of shift pattern (increasing/decreasing work)
    if (!periodData?.schedule?.[staff.id]) return 0.5;

    let recentWorkDays = 0;
    let previousWorkDays = 0;
    const schedule = periodData.schedule[staff.id];

    // Count last 7 days
    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(date.getDate() - i);
      const dateKey = pastDate.toISOString().split('T')[0];

      if (schedule[dateKey] && schedule[dateKey] !== '×') {
        recentWorkDays++;
      }
    }

    // Count previous 7 days (8-14 days ago)
    for (let i = 8; i <= 14; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(date.getDate() - i);
      const dateKey = pastDate.toISOString().split('T')[0];

      if (schedule[dateKey] && schedule[dateKey] !== '×') {
        previousWorkDays++;
      }
    }

    // Momentum: positive if increasing, negative if decreasing
    const momentum = (recentWorkDays - previousWorkDays) / 7;
    return (momentum + 1) / 2; // Normalize to 0-1 range
  }

  calculateWorkloadTrendDirection(staff, periodData, date) {
    // Direction of workload trend
    const momentum = this.calculateRecentShiftMomentum(staff, periodData, date);
    return momentum; // Already normalized 0-1
  }

  calculatePatternConsistencyScore(staff, allHistoricalData) {
    // How consistent are shift patterns over time
    return this.calculateConsistency(staff, allHistoricalData);
  }

  calculateSchedulePredictability(staff, allHistoricalData) {
    // How predictable is this staff's schedule
    const consistency = this.calculateConsistency(staff, allHistoricalData);
    const patterns = this.analyzeHistoricalPatterns(staff, allHistoricalData);

    return (consistency + patterns.stability) / 2;
  }

  calculateShiftChangeVelocity(staff, periodData, date) {
    // Rate of shift type changes (early/late/normal)
    if (!periodData?.schedule?.[staff.id]) return 0.3;

    let changes = 0;
    let comparisons = 0;
    const schedule = periodData.schedule[staff.id];
    let lastShift = null;

    for (let i = 7; i >= 1; i--) {
      const pastDate = new Date(date);
      pastDate.setDate(date.getDate() - i);
      const dateKey = pastDate.toISOString().split('T')[0];
      const shift = schedule[dateKey];

      if (shift && shift !== '×') {
        if (lastShift && lastShift !== shift) {
          changes++;
        }
        lastShift = shift;
        comparisons++;
      }
    }

    return comparisons > 0 ? changes / comparisons : 0.3;
  }

  /**
   * ✅ PHASE 3: Calculate pattern diversity score
   * Measures how many unique shift patterns exist across staff members
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {Array} staffMembers - Staff member objects
   * @param {Array} dateRange - Date range
   * @returns {number} Diversity score (0-100)
   */
  calculatePatternDiversity(scheduleData, staffMembers, dateRange) {
    if (!scheduleData || !staffMembers || staffMembers.length === 0) {
      return 0;
    }

    // Extract weekly patterns for each staff member
    const patterns = [];
    staffMembers.forEach(staff => {
      if (!scheduleData[staff.id]) return;

      // Get shift sequence as pattern string
      const patternStr = dateRange
        .map(date => {
          const dateKey = date.toISOString().split('T')[0];
          return scheduleData[staff.id][dateKey] || '○';
        })
        .join('');

      patterns.push(patternStr);
    });

    // Count unique patterns
    const uniquePatterns = new Set(patterns);
    const diversityRatio = uniquePatterns.size / patterns.length;

    // Convert to 0-100 score
    return diversityRatio * 100;
  }

  /**
   * ✅ PHASE 3: Calculate Hamming distance between two schedules
   * Measures how many shifts differ between two staff members
   * @param {Object} schedule1 - First staff schedule
   * @param {Object} schedule2 - Second staff schedule
   * @param {Array} dateRange - Date range
   * @returns {number} Hamming distance (0-1, where 1 = completely different)
   */
  calculateHammingDistance(schedule1, schedule2, dateRange) {
    if (!schedule1 || !schedule2 || !dateRange) {
      return 0;
    }

    let differences = 0;
    let totalDays = 0;

    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const shift1 = schedule1[dateKey] || '○';
      const shift2 = schedule2[dateKey] || '○';

      if (shift1 !== shift2) {
        differences++;
      }
      totalDays++;
    });

    return totalDays > 0 ? differences / totalDays : 0;
  }

  /**
   * ✅ PHASE 3: Calculate average Hamming distance across all staff pairs
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {Array} staffMembers - Staff member objects
   * @param {Array} dateRange - Date range
   * @returns {number} Average Hamming distance (0-1)
   */
  calculateAverageHammingDistance(scheduleData, staffMembers, dateRange) {
    if (!scheduleData || !staffMembers || staffMembers.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    let comparisons = 0;

    // Compare each pair of staff members
    for (let i = 0; i < staffMembers.length; i++) {
      for (let j = i + 1; j < staffMembers.length; j++) {
        const staff1 = staffMembers[i];
        const staff2 = staffMembers[j];

        if (scheduleData[staff1.id] && scheduleData[staff2.id]) {
          const distance = this.calculateHammingDistance(
            scheduleData[staff1.id],
            scheduleData[staff2.id],
            dateRange
          );
          totalDistance += distance;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * ✅ PHASE 3: Calculate fairness score based on variance
   * Measures how fairly shifts are distributed across staff
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {Array} staffMembers - Staff member objects
   * @param {Array} dateRange - Date range
   * @returns {Object} Fairness metrics
   */
  calculateFairnessScore(scheduleData, staffMembers, dateRange) {
    if (!scheduleData || !staffMembers || staffMembers.length === 0) {
      return {
        workloadVariance: 0,
        offDayVariance: 0,
        shiftTypeVariance: 0,
        overall: 0
      };
    }

    // Calculate workload (total working days) per staff
    const workloads = staffMembers.map(staff => {
      if (!scheduleData[staff.id]) return 0;
      return Object.values(scheduleData[staff.id])
        .filter(shift => shift && shift !== '×').length;
    });

    // Calculate off days per staff
    const offDays = staffMembers.map(staff => {
      if (!scheduleData[staff.id]) return 0;
      return Object.values(scheduleData[staff.id])
        .filter(shift => shift === '×').length;
    });

    // Calculate shift type distribution (early, late, normal)
    const earlyShifts = staffMembers.map(staff => {
      if (!scheduleData[staff.id]) return 0;
      return Object.values(scheduleData[staff.id])
        .filter(shift => shift === '△').length;
    });

    const lateShifts = staffMembers.map(staff => {
      if (!scheduleData[staff.id]) return 0;
      return Object.values(scheduleData[staff.id])
        .filter(shift => shift === '◇').length;
    });

    // Calculate variances
    const workloadVariance = this.calculateVariance(workloads);
    const offDayVariance = this.calculateVariance(offDays);
    const earlyVariance = this.calculateVariance(earlyShifts);
    const lateVariance = this.calculateVariance(lateShifts);
    const shiftTypeVariance = (earlyVariance + lateVariance) / 2;

    // Convert to 0-100 scores (lower variance = higher fairness)
    const maxReasonableVariance = 10; // Days squared
    const workloadFairness = Math.max(0, 100 - (workloadVariance / maxReasonableVariance) * 100);
    const offDayFairness = Math.max(0, 100 - (offDayVariance / maxReasonableVariance) * 100);
    const shiftTypeFairness = Math.max(0, 100 - (shiftTypeVariance / maxReasonableVariance) * 100);

    // Weighted overall fairness
    const overall = (
      workloadFairness * 0.4 +  // 40% weight on workload fairness
      offDayFairness * 0.3 +     // 30% weight on off day fairness
      shiftTypeFairness * 0.3    // 30% weight on shift type fairness
    );

    return {
      workloadVariance,
      offDayVariance,
      shiftTypeVariance,
      workloadFairness,
      offDayFairness,
      shiftTypeFairness,
      overall
    };
  }

  /**
   * Helper: Calculate variance of an array
   * @param {Array} values - Numeric values
   * @returns {number} Variance
   */
  calculateVariance(values) {
    if (!values || values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * ✅ PHASE 3: Calculate diversity score
   * Combines pattern diversity and Hamming distance
   * @param {Object} scheduleData - Schedule data for all staff
   * @param {Array} staffMembers - Staff member objects
   * @param {Array} dateRange - Date range
   * @returns {Object} Diversity metrics
   */
  calculateDiversityScore(scheduleData, staffMembers, dateRange) {
    const patternDiversity = this.calculatePatternDiversity(scheduleData, staffMembers, dateRange);
    const hammingDistance = this.calculateAverageHammingDistance(scheduleData, staffMembers, dateRange);

    // Convert Hamming distance (0-1) to 0-100 score
    const hammingScore = hammingDistance * 100;

    // Weighted overall diversity
    const overall = (
      patternDiversity * 0.6 +  // 60% weight on unique patterns
      hammingScore * 0.4         // 40% weight on average difference
    );

    return {
      patternDiversity,
      hammingDistance,
      hammingScore,
      overall
    };
  }

  // ============================================================================
  // PHASE 1: SEQUENCE-BASED FEATURE EXTRACTION METHODS
  // ============================================================================

  /**
   * === ROLLING WINDOW FEATURES (5 methods) ===
   * Analyze recent shift patterns using sliding windows
   */

  /**
   * Calculate 3-day rolling pattern hash
   * Captures very recent shift trends (short-term patterns)
   */
  calculateRolling3DayPattern(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 3) return 0.5; // Not enough history

      // Get last 3 days of shifts
      const pattern = [];
      for (let i = dateIndex - 3; i < dateIndex; i++) {
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";
        pattern.push(this.shiftToNumeric(shift, staff));
      }

      // Create simple hash: sum of encoded values
      const hash = pattern.reduce((sum, val) => sum + val, 0) / (3 * 4); // Normalize by max possible value
      return Math.min(1, Math.max(0, hash));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate 5-day rolling pattern hash
   * Captures medium-term shift trends (weekly patterns)
   */
  calculateRolling5DayPattern(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 5) return 0.5; // Not enough history

      // Get last 5 days of shifts
      const pattern = [];
      for (let i = dateIndex - 5; i < dateIndex; i++) {
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";
        pattern.push(this.shiftToNumeric(shift, staff));
      }

      // Weighted hash - more recent days have higher weight
      const weights = [0.1, 0.15, 0.2, 0.25, 0.3];
      const weightedSum = pattern.reduce((sum, val, idx) => sum + val * weights[idx], 0);
      return Math.min(1, Math.max(0, weightedSum / 4)); // Normalize by max shift value
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate 7-day shift distribution
   * Analyzes the variety and balance of shifts over past week
   */
  calculateRolling7DayShiftDistribution(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 7) return 0.5; // Not enough history

      // Count shift types in last 7 days
      const shiftCounts = { work: 0, off: 0, early: 0, late: 0 };
      for (let i = dateIndex - 7; i < dateIndex; i++) {
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";

        if (shift === "×" || shift === "⊘") {
          shiftCounts.off++;
        } else if (shift === "△") {
          shiftCounts.early++;
        } else if (shift === "▽") {
          shiftCounts.late++;
        } else {
          shiftCounts.work++;
        }
      }

      // Calculate entropy-like diversity score
      const total = 7;
      const proportions = Object.values(shiftCounts).map(count => count / total);
      const entropy = proportions.reduce((sum, p) => {
        return p > 0 ? sum - p * Math.log2(p) : sum;
      }, 0);

      // Normalize entropy (max entropy for 4 categories is 2)
      return Math.min(1, entropy / 2);
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate rolling work/rest ratio
   * Measures work intensity over recent period
   */
  calculateRollingWorkRestRatio(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 7) return 0.5; // Not enough history

      let workDays = 0;
      let restDays = 0;

      for (let i = dateIndex - 7; i < dateIndex; i++) {
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";

        if (shift === "×" || shift === "⊘") {
          restDays++;
        } else {
          workDays++;
        }
      }

      // Ratio: workDays / (workDays + restDays), normalized to 0-1
      const ratio = workDays / 7;
      return Math.min(1, Math.max(0, ratio));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate recent shift momentum score
   * Detects if staff is in a work streak or rest streak
   */
  calculateRecentShiftMomentumScore(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 5) return 0.5; // Not enough history

      // Count consecutive work or rest days leading up to current date
      let consecutiveWork = 0;
      let consecutiveRest = 0;

      for (let i = dateIndex - 1; i >= Math.max(0, dateIndex - 5); i--) {
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";

        const isRest = shift === "×" || shift === "⊘";

        if (isRest) {
          consecutiveRest++;
          if (consecutiveWork > 0) break; // Streak ended
        } else {
          consecutiveWork++;
          if (consecutiveRest > 0) break; // Streak ended
        }
      }

      // Convert to momentum score
      // Positive for work streak, negative for rest streak
      const momentum = (consecutiveWork - consecutiveRest) / 5;
      return (momentum + 1) / 2; // Normalize to 0-1
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * === POSITION-BASED FEATURES (5 methods) ===
   * Analyze position within rotation cycles
   */

  /**
   * Calculate position in weekly rotation cycle
   * Identifies where staff is in their typical weekly pattern
   */
  calculatePositionInWeeklyCycle(staff, periodData, date, allHistoricalData) {
    try {
      // Simple: day of week (0=Sunday, 6=Saturday)
      const dayOfWeek = date.getDay();

      // Analyze historical: which day of week does this staff typically work/rest?
      const dayPreferences = this.analyzeDayOfWeekPreferences(staff, allHistoricalData);

      // Combine day of week with historical preference
      const historicalScore = dayPreferences[dayOfWeek] || 0.5;
      const positionScore = dayOfWeek / 6; // Normalize to 0-1

      // Weighted average
      return positionScore * 0.3 + historicalScore * 0.7;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate days since last off day
   * Important for predicting when next rest is needed
   */
  calculateDaysSinceLastOff(staff, periodData, date) {
    try {
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      let daysSince = 0;
      for (let i = dateIndex - 1; i >= 0; i--) {
        daysSince++;
        const dateKey = dateRange[i].toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey] || "";

        if (shift === "×" || shift === "⊘") {
          break; // Found last off day
        }

        if (daysSince >= 10) break; // Cap at 10 days
      }

      // Normalize: 0 = just had off, 1 = 10+ days without off
      return Math.min(1, daysSince / 10);
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate days until usual off day
   * Predicts upcoming rest based on historical patterns
   */
  calculateDaysUntilUsualOff(staff, periodData, date, allHistoricalData) {
    try {
      // Analyze historical off day frequency
      const historicalPatterns = this.analyzeHistoricalPatterns(staff, allHistoricalData);
      const avgDaysBetweenOffs = historicalPatterns.offFreq > 0 ? 1 / historicalPatterns.offFreq : 7;

      // Days since last off
      const daysSince = this.calculateDaysSinceLastOff(staff, periodData, date) * 10;

      // Estimated days until next off
      const daysUntil = Math.max(0, avgDaysBetweenOffs - daysSince);

      // Normalize to 0-1 (0 = should be soon, 1 = far away)
      return Math.min(1, daysUntil / 10);
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate position in monthly cycle
   * Some staff have monthly patterns (e.g., prefer offs at month start/end)
   */
  calculatePositionInMonthlyCycle(date) {
    try {
      const dayOfMonth = date.getDate();
      const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

      // Normalize to 0-1
      return dayOfMonth / totalDays;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Predict next shift based on position in patterns
   * Uses historical position analysis to predict likely next shift
   */
  predictNextByPosition(staff, periodData, date, allHistoricalData) {
    try {
      const dayOfWeek = date.getDay();
      const dayPreferences = this.analyzeDayOfWeekPreferences(staff, allHistoricalData);

      // Return the historical probability of working on this day of week
      return dayPreferences[dayOfWeek] || 0.5;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * === TRANSITION PROBABILITY FEATURES (5 methods) ===
   * Analyze shift-to-shift transitions
   */

  /**
   * Calculate shift transition probability
   * Probability that current shift type transitions to another specific type
   */
  calculateShiftTransitionProbability(staff, periodData, date, allHistoricalData) {
    try {
      // Get current shift (from previous day)
      const { schedule, dateRange } = periodData;
      const dateIndex = dateRange.findIndex(d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]);

      if (dateIndex < 1) return 0.5; // No previous day

      const prevDateKey = dateRange[dateIndex - 1].toISOString().split('T')[0];
      const prevShift = schedule[staff.id]?.[prevDateKey] || "";

      // Build transition matrix from historical data
      const transitions = this.buildTransitionMatrix(staff, allHistoricalData);
      const prevNumeric = this.shiftToNumeric(prevShift, staff);

      // Get probability distribution for next shift
      const nextProbs = transitions[prevNumeric] || [0.25, 0.25, 0.25, 0.25];

      // Return average probability (as a single feature)
      return nextProbs.reduce((sum, p) => sum + p, 0) / nextProbs.length;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate consecutive work day likelihood
   * Probability of continuing to work based on current streak
   */
  calculateConsecutiveWorkLikelihood(staff, periodData, date, allHistoricalData) {
    try {
      const daysSince = this.calculateDaysSinceLastOff(staff, periodData, date) * 10;

      // Analyze historical: what's the longest work streak?
      const historicalPatterns = this.analyzeHistoricalPatterns(staff, allHistoricalData);
      const avgWorkStreak = historicalPatterns.consistency * 7; // Rough estimate

      // Likelihood decreases as current streak approaches historical average
      const likelihood = Math.max(0, 1 - (daysSince / avgWorkStreak));
      return Math.min(1, Math.max(0, likelihood));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate off day clustering tendency
   * Do offs tend to cluster together or spread evenly?
   */
  calculateOffDayClusteringTendency(staff, allHistoricalData) {
    try {
      let totalTransitions = 0;
      let offToOffTransitions = 0;

      // Analyze all historical data
      Object.values(allHistoricalData).forEach(periodData => {
        const { schedule, dateRange } = periodData;
        const staffSchedule = schedule[staff.id] || {};

        for (let i = 1; i < dateRange.length; i++) {
          const prevDateKey = dateRange[i - 1].toISOString().split('T')[0];
          const currDateKey = dateRange[i].toISOString().split('T')[0];

          const prevShift = staffSchedule[prevDateKey] || "";
          const currShift = staffSchedule[currDateKey] || "";

          const prevIsOff = prevShift === "×" || prevShift === "⊘";
          const currIsOff = currShift === "×" || currShift === "⊘";

          if (prevIsOff) {
            totalTransitions++;
            if (currIsOff) {
              offToOffTransitions++;
            }
          }
        }
      });

      // Clustering score: high if offs follow offs
      return totalTransitions > 0 ? offToOffTransitions / totalTransitions : 0.5;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate shift type switching rate
   * How often does staff change between different shift types?
   */
  calculateShiftTypeSwitchingRate(staff, allHistoricalData) {
    try {
      let totalTransitions = 0;
      let switches = 0;

      // Analyze all historical data
      Object.values(allHistoricalData).forEach(periodData => {
        const { schedule, dateRange } = periodData;
        const staffSchedule = schedule[staff.id] || {};

        for (let i = 1; i < dateRange.length; i++) {
          const prevDateKey = dateRange[i - 1].toISOString().split('T')[0];
          const currDateKey = dateRange[i].toISOString().split('T')[0];

          const prevShift = staffSchedule[prevDateKey] || "";
          const currShift = staffSchedule[currDateKey] || "";

          // Ignore transitions involving blanks
          if (prevShift && currShift) {
            totalTransitions++;
            if (prevShift !== currShift) {
              switches++;
            }
          }
        }
      });

      // Switching rate: 0 = very stable, 1 = changes every day
      return totalTransitions > 0 ? switches / totalTransitions : 0.5;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Calculate pattern stability index
   * How consistent are shift patterns across different time periods?
   */
  calculatePatternStabilityIndex(staff, allHistoricalData) {
    try {
      // Compare shift distributions across periods
      const periodDistributions = [];

      Object.values(allHistoricalData).forEach(periodData => {
        const { schedule, dateRange } = periodData;
        const staffSchedule = schedule[staff.id] || {};

        const dist = { work: 0, off: 0, early: 0, late: 0, total: 0 };
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          const shift = staffSchedule[dateKey] || "";

          dist.total++;
          if (shift === "×" || shift === "⊘") {
            dist.off++;
          } else if (shift === "△") {
            dist.early++;
          } else if (shift === "▽") {
            dist.late++;
          } else {
            dist.work++;
          }
        });

        // Normalize
        if (dist.total > 0) {
          periodDistributions.push({
            work: dist.work / dist.total,
            off: dist.off / dist.total,
            early: dist.early / dist.total,
            late: dist.late / dist.total
          });
        }
      });

      if (periodDistributions.length < 2) return 0.5;

      // Calculate variance across periods
      const avgDist = {
        work: periodDistributions.reduce((sum, d) => sum + d.work, 0) / periodDistributions.length,
        off: periodDistributions.reduce((sum, d) => sum + d.off, 0) / periodDistributions.length,
        early: periodDistributions.reduce((sum, d) => sum + d.early, 0) / periodDistributions.length,
        late: periodDistributions.reduce((sum, d) => sum + d.late, 0) / periodDistributions.length
      };

      const variance = periodDistributions.reduce((sum, dist) => {
        return sum +
          Math.pow(dist.work - avgDist.work, 2) +
          Math.pow(dist.off - avgDist.off, 2) +
          Math.pow(dist.early - avgDist.early, 2) +
          Math.pow(dist.late - avgDist.late, 2);
      }, 0) / periodDistributions.length;

      // Stability: low variance = high stability
      // Invert: 1 = very stable, 0 = very unstable
      return Math.max(0, 1 - Math.sqrt(variance));
    } catch (error) {
      return 0.5;
    }
  }

  // ============================================================================
  // HELPER METHODS FOR SEQUENCE FEATURES
  // ============================================================================

  /**
   * Convert shift symbol to numeric value for pattern analysis
   */
  shiftToNumeric(shift, staff) {
    if (!shift || shift === "") {
      return staff.status === "社員" ? 1 : 0; // Regular staff blank = normal (1)
    }
    switch (shift) {
      case "○": return 1; // Normal (part-time)
      case "△": return 2; // Early
      case "▽": return 3; // Late
      case "×": return 0; // Off
      case "⊘": return 0; // Unavailable (treat as off)
      default: return 1; // Unknown defaults to normal
    }
  }

  /**
   * Analyze day-of-week preferences from historical data
   * Returns: {0: 0.8, 1: 0.7, ..., 6: 0.5} (Sunday to Saturday work probabilities)
   */
  analyzeDayOfWeekPreferences(staff, allHistoricalData) {
    const dayStats = {0: {work: 0, total: 0}, 1: {work: 0, total: 0}, 2: {work: 0, total: 0},
                      3: {work: 0, total: 0}, 4: {work: 0, total: 0}, 5: {work: 0, total: 0}, 6: {work: 0, total: 0}};

    try {
      Object.values(allHistoricalData).forEach(periodData => {
        const { schedule, dateRange } = periodData;
        const staffSchedule = schedule[staff.id] || {};

        dateRange.forEach(date => {
          const dayOfWeek = date.getDay();
          const dateKey = date.toISOString().split('T')[0];
          const shift = staffSchedule[dateKey] || "";

          dayStats[dayOfWeek].total++;
          if (shift !== "×" && shift !== "⊘") {
            dayStats[dayOfWeek].work++;
          }
        });
      });

      // Calculate probabilities
      const preferences = {};
      for (let day = 0; day <= 6; day++) {
        preferences[day] = dayStats[day].total > 0
          ? dayStats[day].work / dayStats[day].total
          : 0.5;
      }

      return preferences;
    } catch (error) {
      return {0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 0.5};
    }
  }

  /**
   * Build Markov transition matrix for shift types
   * Returns: [[p00, p01, p02, p03], [p10, p11, p12, p13], ...]
   * where pij = probability of transitioning from shift i to shift j
   */
  buildTransitionMatrix(staff, allHistoricalData) {
    // Initialize 4x4 matrix (off, normal, early, late)
    const matrix = [
      [0, 0, 0, 0], // From off (0)
      [0, 0, 0, 0], // From normal (1)
      [0, 0, 0, 0], // From early (2)
      [0, 0, 0, 0]  // From late (3)
    ];
    const counts = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    try {
      Object.values(allHistoricalData).forEach(periodData => {
        const { schedule, dateRange } = periodData;
        const staffSchedule = schedule[staff.id] || {};

        for (let i = 1; i < dateRange.length; i++) {
          const prevDateKey = dateRange[i - 1].toISOString().split('T')[0];
          const currDateKey = dateRange[i].toISOString().split('T')[0];

          const prevShift = staffSchedule[prevDateKey] || "";
          const currShift = staffSchedule[currDateKey] || "";

          const prevNumeric = this.shiftToNumeric(prevShift, staff);
          const currNumeric = this.shiftToNumeric(currShift, staff);

          counts[prevNumeric][currNumeric]++;
        }
      });

      // Convert counts to probabilities
      for (let i = 0; i < 4; i++) {
        const rowTotal = counts[i].reduce((sum, val) => sum + val, 0);
        if (rowTotal > 0) {
          for (let j = 0; j < 4; j++) {
            matrix[i][j] = counts[i][j] / rowTotal;
          }
        } else {
          // Default uniform distribution if no data
          matrix[i] = [0.25, 0.25, 0.25, 0.25];
        }
      }

      return matrix;
    } catch (error) {
      // Return uniform distribution on error
      return [
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25]
      ];
    }
  }
}

export default ScheduleFeatureEngineer;
