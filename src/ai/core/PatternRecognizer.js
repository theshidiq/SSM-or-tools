/**
 * PatternRecognizer.js
 *
 * Advanced pattern recognition for staff scheduling preferences and behavioral patterns.
 * Uses statistical analysis and machine learning techniques to identify scheduling patterns.
 */

import {
  isOffDay,
  isEarlyShift,
  isLateShift,
  isWorkingShift,
  getDayOfWeek,
} from "../constraints/ConstraintEngine";

/**
 * Pattern types for classification
 */
export const PATTERN_TYPES = {
  DAY_OF_WEEK: "day_of_week",
  SHIFT_TYPE: "shift_type",
  CONSECUTIVE: "consecutive",
  FREQUENCY: "frequency",
  SEASONAL: "seasonal",
  WORKLOAD: "workload",
};

/**
 * Confidence levels for pattern recognition
 */
export const CONFIDENCE_LEVELS = {
  VERY_HIGH: "very_high", // 90%+
  HIGH: "high", // 80-89%
  MEDIUM: "medium", // 60-79%
  LOW: "low", // 40-59%
  VERY_LOW: "very_low", // <40%
};

/**
 * Get confidence level from percentage
 * @param {number} percentage - Percentage value
 * @returns {string} Confidence level
 */
export const getConfidenceLevel = (percentage) => {
  if (percentage >= 90) return CONFIDENCE_LEVELS.VERY_HIGH;
  if (percentage >= 80) return CONFIDENCE_LEVELS.HIGH;
  if (percentage >= 60) return CONFIDENCE_LEVELS.MEDIUM;
  if (percentage >= 40) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.VERY_LOW;
};

/**
 * Detect day-of-week preferences for a staff member
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Day of week preference patterns
 */
export const detectDayOfWeekPreferences = (staffProfile) => {
  const preferences = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    patterns: {},
    strongPreferences: [],
    avoidancePatterns: [],
    summary: {
      mostPreferredDay: null,
      leastPreferredDay: null,
      consistencyScore: 0,
    },
  };

  const dayStats = {
    sunday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    monday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    tuesday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    wednesday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    thursday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    friday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
    saturday: { total: 0, off: 0, early: 0, late: 0, normal: 0 },
  };

  // Collect statistics for each day
  Object.keys(staffProfile.shiftHistory).forEach((monthIndex) => {
    const monthSchedule = staffProfile.shiftHistory[monthIndex];
    Object.keys(monthSchedule).forEach((dateKey) => {
      const dayOfWeek = getDayOfWeek(dateKey);
      const shift = monthSchedule[dateKey];

      if (dayStats[dayOfWeek]) {
        dayStats[dayOfWeek].total++;

        if (isOffDay(shift)) {
          dayStats[dayOfWeek].off++;
        } else if (isEarlyShift(shift)) {
          dayStats[dayOfWeek].early++;
        } else if (isLateShift(shift)) {
          dayStats[dayOfWeek].late++;
        } else {
          dayStats[dayOfWeek].normal++;
        }
      }
    });
  });

  // Analyze patterns for each day
  let maxOffPercentage = 0;
  let minOffPercentage = 100;
  let mostPreferredOffDay = null;
  let leastPreferredOffDay = null;
  const dayVariances = [];

  Object.keys(dayStats).forEach((day) => {
    const stats = dayStats[day];
    if (stats.total > 0) {
      const offPercentage = (stats.off / stats.total) * 100;
      const earlyPercentage = (stats.early / stats.total) * 100;
      const latePercentage = (stats.late / stats.total) * 100;
      const workPercentage = ((stats.total - stats.off) / stats.total) * 100;

      preferences.patterns[day] = {
        totalShifts: stats.total,
        offPercentage,
        earlyPercentage,
        latePercentage,
        workPercentage,
        preference: {
          off: getConfidenceLevel(offPercentage),
          early: getConfidenceLevel(earlyPercentage),
          late: getConfidenceLevel(latePercentage),
          work: getConfidenceLevel(workPercentage),
        },
      };

      dayVariances.push(offPercentage);

      // Track extremes
      if (offPercentage > maxOffPercentage) {
        maxOffPercentage = offPercentage;
        mostPreferredOffDay = day;
      }
      if (offPercentage < minOffPercentage) {
        minOffPercentage = offPercentage;
        leastPreferredOffDay = day;
      }

      // Identify strong preferences (>70% or <30%)
      if (offPercentage > 70) {
        preferences.strongPreferences.push({
          day,
          type: "off_day",
          strength: offPercentage,
          confidence: getConfidenceLevel(offPercentage),
          description: `Strongly prefers ${day} off (${offPercentage.toFixed(1)}%)`,
        });
      } else if (offPercentage < 30 && workPercentage > 70) {
        preferences.strongPreferences.push({
          day,
          type: "work_day",
          strength: workPercentage,
          confidence: getConfidenceLevel(workPercentage),
          description: `Strongly prefers working ${day} (${workPercentage.toFixed(1)}%)`,
        });
      }

      // Identify avoidance patterns
      if (offPercentage < 15) {
        preferences.avoidancePatterns.push({
          day,
          type: "avoids_off",
          percentage: offPercentage,
          description: `Rarely takes ${day} off (${offPercentage.toFixed(1)}%)`,
        });
      } else if (offPercentage > 85) {
        preferences.avoidancePatterns.push({
          day,
          type: "avoids_work",
          percentage: workPercentage,
          description: `Rarely works ${day} (${workPercentage.toFixed(1)}%)`,
        });
      }
    }
  });

  // Calculate consistency score
  if (dayVariances.length > 0) {
    const mean =
      dayVariances.reduce((sum, val) => sum + val, 0) / dayVariances.length;
    const variance =
      dayVariances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      dayVariances.length;
    preferences.summary.consistencyScore = Math.max(
      0,
      100 - Math.sqrt(variance),
    );
  }

  preferences.summary.mostPreferredDay = mostPreferredOffDay;
  preferences.summary.leastPreferredDay = leastPreferredOffDay;

  return preferences;
};

/**
 * Detect shift type preferences for a staff member
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Shift type preference patterns
 */
export const detectShiftTypePreferences = (staffProfile) => {
  const preferences = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    shiftTypes: {},
    preferences: [],
    avoidances: [],
    adaptability: {
      score: 0,
      level: "rigid",
      description: "",
    },
  };

  const totalShifts = staffProfile.totalShifts;
  if (totalShifts === 0) {
    return preferences;
  }

  // Analyze each shift type
  Object.keys(staffProfile.shiftCounts).forEach((shiftType) => {
    const count = staffProfile.shiftCounts[shiftType];
    const percentage = (count / totalShifts) * 100;

    preferences.shiftTypes[shiftType] = {
      count,
      percentage,
      confidence: getConfidenceLevel(percentage),
      preference:
        percentage > 40 ? "preferred" : percentage > 20 ? "neutral" : "avoided",
    };

    // Identify strong preferences
    if (percentage > 50) {
      preferences.preferences.push({
        shiftType,
        percentage,
        confidence: getConfidenceLevel(percentage),
        description: `Strong preference for ${shiftType} shifts (${percentage.toFixed(1)}%)`,
      });
    }

    // Identify avoidances
    if (percentage < 10 && count > 0) {
      preferences.avoidances.push({
        shiftType,
        percentage,
        description: `Rarely works ${shiftType} shifts (${percentage.toFixed(1)}%)`,
      });
    }
  });

  // Calculate adaptability score based on distribution
  const shiftTypeVariances = Object.values(preferences.shiftTypes).map(
    (st) => st.percentage,
  );
  if (shiftTypeVariances.length > 0) {
    const mean =
      shiftTypeVariances.reduce((sum, val) => sum + val, 0) /
      shiftTypeVariances.length;
    const variance =
      shiftTypeVariances.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2),
        0,
      ) / shiftTypeVariances.length;
    const standardDeviation = Math.sqrt(variance);

    // Higher variance = lower adaptability (more specialized)
    preferences.adaptability.score = Math.max(0, 100 - standardDeviation);

    if (preferences.adaptability.score > 80) {
      preferences.adaptability.level = "highly_adaptable";
      preferences.adaptability.description =
        "Works all shift types equally well";
    } else if (preferences.adaptability.score > 60) {
      preferences.adaptability.level = "adaptable";
      preferences.adaptability.description =
        "Works most shift types comfortably";
    } else if (preferences.adaptability.score > 40) {
      preferences.adaptability.level = "somewhat_specialized";
      preferences.adaptability.description = "Has some shift type preferences";
    } else {
      preferences.adaptability.level = "highly_specialized";
      preferences.adaptability.description =
        "Strongly prefers specific shift types";
    }
  }

  return preferences;
};

/**
 * Detect consecutive work/off patterns for a staff member
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Consecutive pattern analysis
 */
export const detectConsecutivePatterns = (staffProfile) => {
  const patterns = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    workStreaks: {
      average: 0,
      maximum: 0,
      minimum: 0,
      distribution: {},
    },
    offStreaks: {
      average: 0,
      maximum: 0,
      minimum: 0,
      distribution: {},
    },
    preferences: {
      preferredWorkStreak: 0,
      preferredOffStreak: 0,
      endurance: "medium",
    },
  };

  const workStreaks = [];
  const offStreaks = [];

  // Analyze each period
  Object.keys(staffProfile.shiftHistory).forEach((monthIndex) => {
    const monthSchedule = staffProfile.shiftHistory[monthIndex];
    const sortedDates = Object.keys(monthSchedule).sort();

    let currentWorkStreak = 0;
    let currentOffStreak = 0;

    sortedDates.forEach((dateKey) => {
      const shift = monthSchedule[dateKey];

      if (isOffDay(shift)) {
        if (currentWorkStreak > 0) {
          workStreaks.push(currentWorkStreak);
          currentWorkStreak = 0;
        }
        currentOffStreak++;
      } else if (isWorkingShift(shift)) {
        if (currentOffStreak > 0) {
          offStreaks.push(currentOffStreak);
          currentOffStreak = 0;
        }
        currentWorkStreak++;
      }
    });

    // Don't forget the last streak
    if (currentWorkStreak > 0) workStreaks.push(currentWorkStreak);
    if (currentOffStreak > 0) offStreaks.push(currentOffStreak);
  });

  // Analyze work streaks
  if (workStreaks.length > 0) {
    patterns.workStreaks.average =
      workStreaks.reduce((sum, val) => sum + val, 0) / workStreaks.length;
    patterns.workStreaks.maximum = Math.max(...workStreaks);
    patterns.workStreaks.minimum = Math.min(...workStreaks);

    // Distribution
    workStreaks.forEach((streak) => {
      if (!patterns.workStreaks.distribution[streak]) {
        patterns.workStreaks.distribution[streak] = 0;
      }
      patterns.workStreaks.distribution[streak]++;
    });

    // Find most common work streak length
    let maxCount = 0;
    Object.keys(patterns.workStreaks.distribution).forEach((streak) => {
      if (patterns.workStreaks.distribution[streak] > maxCount) {
        maxCount = patterns.workStreaks.distribution[streak];
        patterns.preferences.preferredWorkStreak = parseInt(streak);
      }
    });
  }

  // Analyze off streaks
  if (offStreaks.length > 0) {
    patterns.offStreaks.average =
      offStreaks.reduce((sum, val) => sum + val, 0) / offStreaks.length;
    patterns.offStreaks.maximum = Math.max(...offStreaks);
    patterns.offStreaks.minimum = Math.min(...offStreaks);

    // Distribution
    offStreaks.forEach((streak) => {
      if (!patterns.offStreaks.distribution[streak]) {
        patterns.offStreaks.distribution[streak] = 0;
      }
      patterns.offStreaks.distribution[streak]++;
    });

    // Find most common off streak length
    let maxCount = 0;
    Object.keys(patterns.offStreaks.distribution).forEach((streak) => {
      if (patterns.offStreaks.distribution[streak] > maxCount) {
        maxCount = patterns.offStreaks.distribution[streak];
        patterns.preferences.preferredOffStreak = parseInt(streak);
      }
    });
  }

  // Determine endurance level
  if (patterns.workStreaks.average > 6) {
    patterns.preferences.endurance = "high";
  } else if (patterns.workStreaks.average > 4) {
    patterns.preferences.endurance = "medium";
  } else {
    patterns.preferences.endurance = "low";
  }

  return patterns;
};

/**
 * Detect frequency patterns (how often staff work/are off)
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Frequency pattern analysis
 */
export const detectFrequencyPatterns = (staffProfile) => {
  const patterns = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    workFrequency: {
      percentage: 0,
      pattern: "regular",
      consistency: 0,
    },
    monthlyTrends: {},
    seasonalTrends: {},
    recommendations: [],
  };

  const totalPossibleShifts =
    Object.keys(staffProfile.shiftHistory).length * 31; // Rough estimate
  const totalWorkShifts =
    staffProfile.totalShifts -
    (staffProfile.shiftCounts["×"] || 0) -
    (staffProfile.shiftCounts["off"] || 0);

  if (totalPossibleShifts > 0) {
    patterns.workFrequency.percentage =
      (totalWorkShifts / staffProfile.totalShifts) * 100;
  }

  // Analyze monthly consistency
  const monthlyWorkPercentages = [];
  Object.keys(staffProfile.shiftHistory).forEach((monthIndex) => {
    const monthSchedule = staffProfile.shiftHistory[monthIndex];
    const totalDays = Object.keys(monthSchedule).length;
    const workDays = Object.values(monthSchedule).filter((shift) =>
      isWorkingShift(shift),
    ).length;
    const workPercentage = totalDays > 0 ? (workDays / totalDays) * 100 : 0;

    monthlyWorkPercentages.push(workPercentage);
    patterns.monthlyTrends[monthIndex] = {
      totalDays,
      workDays,
      workPercentage,
      pattern:
        workPercentage > 80
          ? "heavy"
          : workPercentage > 60
            ? "regular"
            : "light",
    };
  });

  // Calculate consistency
  if (monthlyWorkPercentages.length > 0) {
    const mean =
      monthlyWorkPercentages.reduce((sum, val) => sum + val, 0) /
      monthlyWorkPercentages.length;
    const variance =
      monthlyWorkPercentages.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2),
        0,
      ) / monthlyWorkPercentages.length;
    patterns.workFrequency.consistency = Math.max(0, 100 - Math.sqrt(variance));
  }

  // Determine pattern type
  if (patterns.workFrequency.consistency > 80) {
    patterns.workFrequency.pattern = "very_consistent";
  } else if (patterns.workFrequency.consistency > 60) {
    patterns.workFrequency.pattern = "consistent";
  } else if (patterns.workFrequency.consistency > 40) {
    patterns.workFrequency.pattern = "somewhat_variable";
  } else {
    patterns.workFrequency.pattern = "highly_variable";
  }

  // Generate recommendations
  if (patterns.workFrequency.consistency < 50) {
    patterns.recommendations.push({
      type: "consistency",
      message:
        "Consider standardizing work frequency for better predictability",
      priority: "medium",
    });
  }

  if (patterns.workFrequency.percentage < 40) {
    patterns.recommendations.push({
      type: "utilization",
      message: "Consider increasing work frequency if availability allows",
      priority: "low",
    });
  } else if (patterns.workFrequency.percentage > 85) {
    patterns.recommendations.push({
      type: "workload",
      message: "Consider reducing work frequency to prevent burnout",
      priority: "medium",
    });
  }

  return patterns;
};

/**
 * Detect seasonal patterns in staff scheduling
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Seasonal pattern analysis
 */
export const detectSeasonalPatterns = (staffProfile) => {
  const patterns = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    quarterlyTrends: {},
    yearlyTrends: {},
    seasonalPreferences: [],
    adaptability: {
      score: 0,
      level: "stable",
    },
  };

  // Group periods by quarters (rough approximation)
  const quarters = {
    Q1: [], // Periods 0, 1
    Q2: [], // Periods 2, 3
    Q3: [], // Periods 4, 5
    Q4: [], // Would be future periods
  };

  Object.keys(staffProfile.shiftHistory).forEach((monthIndex) => {
    const index = parseInt(monthIndex);
    if (index <= 1) quarters.Q1.push(monthIndex);
    else if (index <= 3) quarters.Q2.push(monthIndex);
    else if (index <= 5) quarters.Q3.push(monthIndex);
    else quarters.Q4.push(monthIndex);
  });

  // Analyze each quarter
  Object.keys(quarters).forEach((quarter) => {
    if (quarters[quarter].length > 0) {
      let totalShifts = 0;
      let workShifts = 0;
      let offShifts = 0;
      let earlyShifts = 0;
      let lateShifts = 0;

      quarters[quarter].forEach((monthIndex) => {
        const monthSchedule = staffProfile.shiftHistory[monthIndex];
        Object.values(monthSchedule).forEach((shift) => {
          totalShifts++;
          if (isOffDay(shift)) {
            offShifts++;
          } else if (isEarlyShift(shift)) {
            earlyShifts++;
            workShifts++;
          } else if (isLateShift(shift)) {
            lateShifts++;
            workShifts++;
          } else if (isWorkingShift(shift)) {
            workShifts++;
          }
        });
      });

      patterns.quarterlyTrends[quarter] = {
        totalShifts,
        workShifts,
        offShifts,
        earlyShifts,
        lateShifts,
        workPercentage: totalShifts > 0 ? (workShifts / totalShifts) * 100 : 0,
        offPercentage: totalShifts > 0 ? (offShifts / totalShifts) * 100 : 0,
        earlyPercentage:
          totalShifts > 0 ? (earlyShifts / totalShifts) * 100 : 0,
        latePercentage: totalShifts > 0 ? (lateShifts / totalShifts) * 100 : 0,
      };
    }
  });

  // Calculate seasonal adaptability
  const quarterWorkPercentages = Object.values(patterns.quarterlyTrends).map(
    (q) => q.workPercentage,
  );
  if (quarterWorkPercentages.length > 1) {
    const mean =
      quarterWorkPercentages.reduce((sum, val) => sum + val, 0) /
      quarterWorkPercentages.length;
    const variance =
      quarterWorkPercentages.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2),
        0,
      ) / quarterWorkPercentages.length;
    patterns.adaptability.score = Math.max(0, 100 - Math.sqrt(variance));

    if (patterns.adaptability.score > 80) {
      patterns.adaptability.level = "highly_stable";
    } else if (patterns.adaptability.score > 60) {
      patterns.adaptability.level = "stable";
    } else if (patterns.adaptability.score > 40) {
      patterns.adaptability.level = "somewhat_variable";
    } else {
      patterns.adaptability.level = "highly_seasonal";
    }
  }

  return patterns;
};

/**
 * Recognize all patterns for a staff member
 * @param {Object} staffProfile - Staff profile with shift history
 * @returns {Object} Complete pattern analysis
 */
export const recognizeAllPatterns = (staffProfile) => {
  console.log(`🔍 Recognizing patterns for ${staffProfile.name}...`);

  const patterns = {
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    recognizedAt: new Date().toISOString(),
    patterns: {
      dayOfWeek: detectDayOfWeekPreferences(staffProfile),
      shiftType: detectShiftTypePreferences(staffProfile),
      consecutive: detectConsecutivePatterns(staffProfile),
      frequency: detectFrequencyPatterns(staffProfile),
      seasonal: detectSeasonalPatterns(staffProfile),
    },
    overallProfile: {
      adaptability: "medium",
      predictability: "medium",
      specialization: "general",
      reliability: "reliable",
    },
    recommendations: [],
  };

  // Calculate overall profile characteristics
  const adaptabilityScores = [
    patterns.patterns.shiftType.adaptability.score,
    patterns.patterns.frequency.workFrequency.consistency,
    patterns.patterns.seasonal.adaptability.score,
  ].filter((score) => score > 0);

  if (adaptabilityScores.length > 0) {
    const avgAdaptability =
      adaptabilityScores.reduce((sum, score) => sum + score, 0) /
      adaptabilityScores.length;

    if (avgAdaptability > 80) {
      patterns.overallProfile.adaptability = "highly_adaptable";
    } else if (avgAdaptability > 60) {
      patterns.overallProfile.adaptability = "adaptable";
    } else if (avgAdaptability > 40) {
      patterns.overallProfile.adaptability = "somewhat_rigid";
    } else {
      patterns.overallProfile.adaptability = "rigid";
    }
  }

  // Determine predictability
  const consistencyScores = [
    patterns.patterns.dayOfWeek.summary.consistencyScore,
    patterns.patterns.frequency.workFrequency.consistency,
  ].filter((score) => score > 0);

  if (consistencyScores.length > 0) {
    const avgConsistency =
      consistencyScores.reduce((sum, score) => sum + score, 0) /
      consistencyScores.length;

    if (avgConsistency > 80) {
      patterns.overallProfile.predictability = "highly_predictable";
    } else if (avgConsistency > 60) {
      patterns.overallProfile.predictability = "predictable";
    } else if (avgConsistency > 40) {
      patterns.overallProfile.predictability = "somewhat_unpredictable";
    } else {
      patterns.overallProfile.predictability = "unpredictable";
    }
  }

  // Determine specialization
  const strongPreferences =
    patterns.patterns.dayOfWeek.strongPreferences.length +
    patterns.patterns.shiftType.preferences.length;

  if (strongPreferences > 3) {
    patterns.overallProfile.specialization = "highly_specialized";
  } else if (strongPreferences > 1) {
    patterns.overallProfile.specialization = "specialized";
  } else {
    patterns.overallProfile.specialization = "general";
  }

  // Generate recommendations
  if (patterns.overallProfile.adaptability === "rigid") {
    patterns.recommendations.push({
      type: "adaptability",
      message: "Consider gradual introduction of different shift patterns",
      priority: "low",
    });
  }

  if (patterns.overallProfile.predictability === "unpredictable") {
    patterns.recommendations.push({
      type: "consistency",
      message: "Work on establishing more consistent scheduling patterns",
      priority: "medium",
    });
  }

  if (strongPreferences === 0) {
    patterns.recommendations.push({
      type: "preferences",
      message: "Consider identifying and accommodating schedule preferences",
      priority: "low",
    });
  }

  console.log(`✅ Pattern recognition completed for ${staffProfile.name}`);
  return patterns;
};

/**
 * Recognize patterns for all staff members
 * @param {Object} staffProfiles - All staff profiles from DataExtractor
 * @returns {Object} Complete pattern recognition results
 */
export const recognizePatternsForAllStaff = (staffProfiles) => {
  console.log("🔍 Recognizing patterns for all staff members...");

  const allPatterns = {
    recognizedAt: new Date().toISOString(),
    staffPatterns: {},
    aggregateInsights: {
      totalStaff: 0,
      adaptabilityDistribution: {},
      predictabilityDistribution: {},
      specializationDistribution: {},
      commonPatterns: [],
      uniquePatterns: [],
    },
    recommendations: [],
  };

  // Recognize patterns for each staff member
  Object.keys(staffProfiles).forEach((staffId) => {
    const staffProfile = staffProfiles[staffId];
    if (staffProfile.totalShifts > 0) {
      allPatterns.staffPatterns[staffId] = recognizeAllPatterns(staffProfile);
      allPatterns.aggregateInsights.totalStaff++;
    }
  });

  // Aggregate insights
  Object.values(allPatterns.staffPatterns).forEach((patterns) => {
    const adaptability = patterns.overallProfile.adaptability;
    const predictability = patterns.overallProfile.predictability;
    const specialization = patterns.overallProfile.specialization;

    // Count distributions
    if (!allPatterns.aggregateInsights.adaptabilityDistribution[adaptability]) {
      allPatterns.aggregateInsights.adaptabilityDistribution[adaptability] = 0;
    }
    allPatterns.aggregateInsights.adaptabilityDistribution[adaptability]++;

    if (
      !allPatterns.aggregateInsights.predictabilityDistribution[predictability]
    ) {
      allPatterns.aggregateInsights.predictabilityDistribution[predictability] =
        0;
    }
    allPatterns.aggregateInsights.predictabilityDistribution[predictability]++;

    if (
      !allPatterns.aggregateInsights.specializationDistribution[specialization]
    ) {
      allPatterns.aggregateInsights.specializationDistribution[specialization] =
        0;
    }
    allPatterns.aggregateInsights.specializationDistribution[specialization]++;
  });

  // Generate aggregate recommendations
  const totalStaff = allPatterns.aggregateInsights.totalStaff;
  const rigidStaff =
    allPatterns.aggregateInsights.adaptabilityDistribution["rigid"] || 0;
  const unpredictableStaff =
    allPatterns.aggregateInsights.predictabilityDistribution["unpredictable"] ||
    0;

  if (rigidStaff / totalStaff > 0.3) {
    allPatterns.recommendations.push({
      type: "team_adaptability",
      message:
        "High percentage of staff with rigid patterns. Consider flexibility training.",
      priority: "medium",
      affectedStaff: rigidStaff,
    });
  }

  if (unpredictableStaff / totalStaff > 0.2) {
    allPatterns.recommendations.push({
      type: "team_consistency",
      message:
        "Some staff have unpredictable patterns. Consider standardizing schedules.",
      priority: "high",
      affectedStaff: unpredictableStaff,
    });
  }

  console.log(
    `✅ Pattern recognition completed for ${totalStaff} staff members`,
  );
  return allPatterns;
};
