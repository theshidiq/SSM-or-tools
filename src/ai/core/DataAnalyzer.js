/**
 * DataAnalyzer.js
 *
 * Advanced data analysis module for historical shift patterns, trends, and insights.
 * Provides statistical analysis and pattern recognition for AI-driven scheduling.
 */

import {
  isOffDay,
  isEarlyShift,
  isLateShift,
  isWorkingShift,
  getDayOfWeek,
} from "../constraints/ConstraintEngine";

/**
 * Analyze staff workload distribution across periods
 * @param {Object} staffProfiles - Staff profiles from DataExtractor
 * @returns {Object} Workload analysis results
 */
export const analyzeWorkloadDistribution = (staffProfiles) => {
  const workloadAnalysis = {
    byStaff: {},
    averages: {
      totalShifts: 0,
      offDays: 0,
      workDays: 0,
      earlyShifts: 0,
      lateShifts: 0,
    },
    statistics: {
      mostActiveStaff: null,
      leastActiveStaff: null,
      workloadVariance: 0,
      fairnessScore: 0,
    },
    patterns: {
      overworked: [],
      underutilized: [],
      balanced: [],
    },
  };

  const staffWorkloads = [];

  Object.keys(staffProfiles).forEach((staffId) => {
    const staff = staffProfiles[staffId];
    const workload = {
      staffId,
      name: staff.name,
      position: staff.position,
      status: staff.status,
      totalShifts: staff.totalShifts,
      periodsWorked: staff.periodsWorked.length,
      shiftCounts: { ...staff.shiftCounts },
      averageShiftsPerPeriod:
        staff.periodsWorked.length > 0
          ? staff.totalShifts / staff.periodsWorked.length
          : 0,
    };

    // Calculate shift type percentages
    workload.offDays =
      (staff.shiftCounts["×"] || 0) +
      (staff.shiftCounts["off"] || 0) +
      (staff.shiftCounts["★"] || 0);
    workload.earlyShifts =
      (staff.shiftCounts["△"] || 0) + (staff.shiftCounts["early"] || 0);
    workload.lateShifts =
      (staff.shiftCounts["◇"] || 0) + (staff.shiftCounts["late"] || 0);
    workload.normalShifts =
      (staff.shiftCounts[""] || 0) + (staff.shiftCounts["normal"] || 0);
    workload.workDays = workload.totalShifts - workload.offDays;

    if (workload.totalShifts > 0) {
      workload.offDayPercentage =
        (workload.offDays / workload.totalShifts) * 100;
      workload.earlyShiftPercentage =
        (workload.earlyShifts / workload.totalShifts) * 100;
      workload.lateShiftPercentage =
        (workload.lateShifts / workload.totalShifts) * 100;
      workload.workDayPercentage =
        (workload.workDays / workload.totalShifts) * 100;
    } else {
      workload.offDayPercentage = 0;
      workload.earlyShiftPercentage = 0;
      workload.lateShiftPercentage = 0;
      workload.workDayPercentage = 0;
    }

    workloadAnalysis.byStaff[staffId] = workload;
    staffWorkloads.push(workload);
  });

  // Calculate averages
  if (staffWorkloads.length > 0) {
    workloadAnalysis.averages.totalShifts =
      staffWorkloads.reduce((sum, w) => sum + w.totalShifts, 0) /
      staffWorkloads.length;
    workloadAnalysis.averages.offDays =
      staffWorkloads.reduce((sum, w) => sum + w.offDays, 0) /
      staffWorkloads.length;
    workloadAnalysis.averages.workDays =
      staffWorkloads.reduce((sum, w) => sum + w.workDays, 0) /
      staffWorkloads.length;
    workloadAnalysis.averages.earlyShifts =
      staffWorkloads.reduce((sum, w) => sum + w.earlyShifts, 0) /
      staffWorkloads.length;
    workloadAnalysis.averages.lateShifts =
      staffWorkloads.reduce((sum, w) => sum + w.lateShifts, 0) /
      staffWorkloads.length;

    // Find most and least active staff
    workloadAnalysis.statistics.mostActiveStaff = staffWorkloads.reduce(
      (max, current) => (current.totalShifts > max.totalShifts ? current : max),
    );
    workloadAnalysis.statistics.leastActiveStaff = staffWorkloads.reduce(
      (min, current) => (current.totalShifts < min.totalShifts ? current : min),
    );

    // Calculate workload variance
    const mean = workloadAnalysis.averages.totalShifts;
    const variance =
      staffWorkloads.reduce(
        (sum, w) => sum + Math.pow(w.totalShifts - mean, 2),
        0,
      ) / staffWorkloads.length;
    workloadAnalysis.statistics.workloadVariance = variance;

    // Calculate fairness score (lower variance = more fair)
    workloadAnalysis.statistics.fairnessScore = Math.max(
      0,
      100 - (Math.sqrt(variance) / mean) * 100,
    );

    // Categorize staff by workload
    const threshold = workloadAnalysis.averages.totalShifts * 0.15; // 15% threshold

    staffWorkloads.forEach((workload) => {
      if (
        workload.totalShifts >
        workloadAnalysis.averages.totalShifts + threshold
      ) {
        workloadAnalysis.patterns.overworked.push(workload);
      } else if (
        workload.totalShifts <
        workloadAnalysis.averages.totalShifts - threshold
      ) {
        workloadAnalysis.patterns.underutilized.push(workload);
      } else {
        workloadAnalysis.patterns.balanced.push(workload);
      }
    });
  }

  return workloadAnalysis;
};

/**
 * Analyze shift patterns by day of week
 * @param {Object} coveragePatterns - Coverage patterns from DataExtractor
 * @returns {Object} Day of week analysis
 */
export const analyzeDayOfWeekPatterns = (coveragePatterns) => {
  const dayAnalysis = {
    byDay: {},
    trends: {
      busiestDay: null,
      quietestDay: null,
      weekendPattern: {},
      weekdayPattern: {},
    },
    recommendations: [],
  };

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  days.forEach((dayName, dayIndex) => {
    const dayData = coveragePatterns.byDayOfWeek[dayIndex];
    if (dayData) {
      dayAnalysis.byDay[dayName] = {
        averageStaff: dayData.averageStaff,
        totalDays: dayData.totalDays,
        shiftCounts: { ...dayData.shiftCounts },
        patterns: {
          offDayPercentage:
            dayData.totalDays > 0
              ? ((dayData.shiftCounts.off || 0) /
                  (dayData.shiftCounts.total || 1)) *
                100
              : 0,
          earlyShiftPercentage:
            dayData.totalDays > 0
              ? ((dayData.shiftCounts.early || 0) /
                  (dayData.shiftCounts.total || 1)) *
                100
              : 0,
          lateShiftPercentage:
            dayData.totalDays > 0
              ? ((dayData.shiftCounts.late || 0) /
                  (dayData.shiftCounts.total || 1)) *
                100
              : 0,
        },
      };
    }
  });

  // Find busiest and quietest days
  let maxStaff = 0;
  let minStaff = Infinity;
  let busiestDay = null;
  let quietestDay = null;

  Object.keys(dayAnalysis.byDay).forEach((day) => {
    const avgStaff = dayAnalysis.byDay[day].averageStaff;
    if (avgStaff > maxStaff) {
      maxStaff = avgStaff;
      busiestDay = day;
    }
    if (avgStaff < minStaff) {
      minStaff = avgStaff;
      quietestDay = day;
    }
  });

  dayAnalysis.trends.busiestDay = { day: busiestDay, averageStaff: maxStaff };
  dayAnalysis.trends.quietestDay = { day: quietestDay, averageStaff: minStaff };

  // Analyze weekend vs weekday patterns
  const weekendDays = ["Saturday", "Sunday"];
  const weekdayDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  let weekendAvg = 0;
  let weekdayAvg = 0;
  let weekendCount = 0;
  let weekdayCount = 0;

  weekendDays.forEach((day) => {
    if (dayAnalysis.byDay[day]) {
      weekendAvg += dayAnalysis.byDay[day].averageStaff;
      weekendCount++;
    }
  });

  weekdayDays.forEach((day) => {
    if (dayAnalysis.byDay[day]) {
      weekdayAvg += dayAnalysis.byDay[day].averageStaff;
      weekdayCount++;
    }
  });

  if (weekendCount > 0) weekendAvg /= weekendCount;
  if (weekdayCount > 0) weekdayAvg /= weekdayCount;

  dayAnalysis.trends.weekendPattern = {
    averageStaff: weekendAvg,
    daysAnalyzed: weekendCount,
    pattern: weekendAvg < weekdayAvg ? "lighter" : "heavier",
  };

  dayAnalysis.trends.weekdayPattern = {
    averageStaff: weekdayAvg,
    daysAnalyzed: weekdayCount,
    pattern: weekdayAvg > weekendAvg ? "heavier" : "lighter",
  };

  // Generate recommendations
  if (Math.abs(weekendAvg - weekdayAvg) > 1) {
    dayAnalysis.recommendations.push({
      type: "staffing_balance",
      message: `Consider balancing staffing: ${weekendAvg > weekdayAvg ? "weekends are overstaffed" : "weekdays are overstaffed"}`,
      impact: "medium",
    });
  }

  if (maxStaff - minStaff > 2) {
    dayAnalysis.recommendations.push({
      type: "daily_variance",
      message: `High variance in daily staffing (${maxStaff.toFixed(1)} vs ${minStaff.toFixed(1)}). Consider redistribution.`,
      impact: "high",
    });
  }

  return dayAnalysis;
};

/**
 * Analyze seasonal and monthly trends
 * @param {Array} allPeriodData - All historical period data
 * @returns {Object} Seasonal trend analysis
 */
export const analyzeSeasonalTrends = (allPeriodData) => {
  const seasonalAnalysis = {
    byPeriod: {},
    trends: {
      growth: "stable",
      seasonality: {},
      staffingChanges: [],
    },
    insights: [],
  };

  allPeriodData.forEach((periodData, index) => {
    const { scheduleData, staffData, dateRange, monthIndex } = periodData;

    let totalShifts = 0;
    let totalOffDays = 0;
    let totalEarlyShifts = 0;
    let totalLateShifts = 0;
    const uniqueStaffCount = staffData.length;

    // Count all shifts in this period
    Object.keys(scheduleData).forEach((staffId) => {
      const staffSchedule = scheduleData[staffId];
      Object.values(staffSchedule).forEach((shift) => {
        if (shift !== undefined) {
          totalShifts++;
          if (isOffDay(shift)) totalOffDays++;
          if (isEarlyShift(shift)) totalEarlyShifts++;
          if (isLateShift(shift)) totalLateShifts++;
        }
      });
    });

    seasonalAnalysis.byPeriod[monthIndex] = {
      periodIndex: monthIndex,
      dateRange: dateRange.length,
      uniqueStaffCount,
      totalShifts,
      totalOffDays,
      totalEarlyShifts,
      totalLateShifts,
      averageShiftsPerDay:
        dateRange.length > 0 ? totalShifts / dateRange.length : 0,
      offDayPercentage:
        totalShifts > 0 ? (totalOffDays / totalShifts) * 100 : 0,
      earlyShiftPercentage:
        totalShifts > 0 ? (totalEarlyShifts / totalShifts) * 100 : 0,
      lateShiftPercentage:
        totalShifts > 0 ? (totalLateShifts / totalShifts) * 100 : 0,
    };
  });

  // Analyze trends across periods
  const periods = Object.keys(seasonalAnalysis.byPeriod).map(
    (key) => seasonalAnalysis.byPeriod[key],
  );

  if (periods.length >= 2) {
    const firstPeriod = periods[0];
    const lastPeriod = periods[periods.length - 1];

    // Staff count trend
    const staffGrowth =
      ((lastPeriod.uniqueStaffCount - firstPeriod.uniqueStaffCount) /
        firstPeriod.uniqueStaffCount) *
      100;
    if (Math.abs(staffGrowth) > 10) {
      seasonalAnalysis.trends.staffingChanges.push({
        type: staffGrowth > 0 ? "growth" : "reduction",
        percentage: Math.abs(staffGrowth),
        message: `Staff count ${staffGrowth > 0 ? "increased" : "decreased"} by ${Math.abs(staffGrowth).toFixed(1)}%`,
      });
    }

    // Shift pattern trends
    const shiftGrowth =
      ((lastPeriod.totalShifts - firstPeriod.totalShifts) /
        firstPeriod.totalShifts) *
      100;
    if (Math.abs(shiftGrowth) > 5) {
      seasonalAnalysis.trends.growth =
        shiftGrowth > 0 ? "increasing" : "decreasing";
      seasonalAnalysis.insights.push({
        type: "shift_volume",
        message: `Overall shift volume ${shiftGrowth > 0 ? "increased" : "decreased"} by ${Math.abs(shiftGrowth).toFixed(1)}%`,
        impact: Math.abs(shiftGrowth) > 15 ? "high" : "medium",
      });
    }

    // Off day percentage trends
    const offDayTrend =
      lastPeriod.offDayPercentage - firstPeriod.offDayPercentage;
    if (Math.abs(offDayTrend) > 2) {
      seasonalAnalysis.insights.push({
        type: "off_day_trend",
        message: `Off day percentage ${offDayTrend > 0 ? "increased" : "decreased"} by ${Math.abs(offDayTrend).toFixed(1)}%`,
        impact: Math.abs(offDayTrend) > 5 ? "high" : "medium",
      });
    }
  }

  return seasonalAnalysis;
};

/**
 * Analyze staff preferences based on historical patterns
 * @param {Object} staffProfiles - Staff profiles from DataExtractor
 * @returns {Object} Staff preference analysis
 */
export const analyzeStaffPreferences = (staffProfiles) => {
  const preferenceAnalysis = {
    byStaff: {},
    patterns: {
      dayOfWeekPreferences: {},
      shiftTypePreferences: {},
      consistentPatterns: [],
      irregularPatterns: [],
    },
    insights: [],
  };

  Object.keys(staffProfiles).forEach((staffId) => {
    const staff = staffProfiles[staffId];
    const preferences = {
      staffId,
      name: staff.name,
      position: staff.position,
      dayOfWeekPatterns: {},
      shiftTypePreferences: {},
      consistency: {
        score: 0,
        pattern: "irregular",
        description: "",
      },
    };

    // Analyze day of week patterns
    const dayOfWeekCounts = {};
    const dayOfWeekOffCounts = {};

    Object.keys(staff.shiftHistory).forEach((monthIndex) => {
      const monthSchedule = staff.shiftHistory[monthIndex];
      Object.keys(monthSchedule).forEach((dateKey) => {
        const dayOfWeek = getDayOfWeek(dateKey);
        const shift = monthSchedule[dateKey];

        if (!dayOfWeekCounts[dayOfWeek]) {
          dayOfWeekCounts[dayOfWeek] = 0;
          dayOfWeekOffCounts[dayOfWeek] = 0;
        }

        dayOfWeekCounts[dayOfWeek]++;
        if (isOffDay(shift)) {
          dayOfWeekOffCounts[dayOfWeek]++;
        }
      });
    });

    // Calculate day of week preferences
    Object.keys(dayOfWeekCounts).forEach((day) => {
      const total = dayOfWeekCounts[day];
      const offCount = dayOfWeekOffCounts[day];
      preferences.dayOfWeekPatterns[day] = {
        totalShifts: total,
        offDays: offCount,
        workDays: total - offCount,
        offDayPercentage: total > 0 ? (offCount / total) * 100 : 0,
        workDayPercentage: total > 0 ? ((total - offCount) / total) * 100 : 0,
      };
    });

    // Analyze shift type preferences
    const totalShifts = staff.totalShifts;
    if (totalShifts > 0) {
      Object.keys(staff.shiftCounts).forEach((shiftType) => {
        const count = staff.shiftCounts[shiftType];
        preferences.shiftTypePreferences[shiftType] = {
          count,
          percentage: (count / totalShifts) * 100,
          preference:
            count / totalShifts > 0.3
              ? "high"
              : count / totalShifts > 0.15
                ? "medium"
                : "low",
        };
      });
    }

    // Calculate consistency score
    const dayVariances = [];
    Object.keys(preferences.dayOfWeekPatterns).forEach((day) => {
      dayVariances.push(preferences.dayOfWeekPatterns[day].offDayPercentage);
    });

    if (dayVariances.length > 0) {
      const mean =
        dayVariances.reduce((sum, val) => sum + val, 0) / dayVariances.length;
      const variance =
        dayVariances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        dayVariances.length;
      const standardDeviation = Math.sqrt(variance);

      preferences.consistency.score = Math.max(0, 100 - standardDeviation);

      if (preferences.consistency.score > 80) {
        preferences.consistency.pattern = "very_consistent";
        preferences.consistency.description =
          "Highly predictable schedule pattern";
        preferenceAnalysis.patterns.consistentPatterns.push(preferences);
      } else if (preferences.consistency.score > 60) {
        preferences.consistency.pattern = "consistent";
        preferences.consistency.description =
          "Generally consistent schedule pattern";
        preferenceAnalysis.patterns.consistentPatterns.push(preferences);
      } else {
        preferences.consistency.pattern = "irregular";
        preferences.consistency.description = "Irregular schedule pattern";
        preferenceAnalysis.patterns.irregularPatterns.push(preferences);
      }
    }

    preferenceAnalysis.byStaff[staffId] = preferences;
  });

  // Generate insights
  const consistentStaff = preferenceAnalysis.patterns.consistentPatterns.length;
  const irregularStaff = preferenceAnalysis.patterns.irregularPatterns.length;
  const totalStaff = consistentStaff + irregularStaff;

  if (totalStaff > 0) {
    const consistencyRate = (consistentStaff / totalStaff) * 100;

    preferenceAnalysis.insights.push({
      type: "consistency_rate",
      message: `${consistencyRate.toFixed(1)}% of staff have consistent schedule patterns`,
      impact:
        consistencyRate > 70
          ? "positive"
          : consistencyRate < 40
            ? "concern"
            : "neutral",
    });

    if (irregularStaff > consistentStaff) {
      preferenceAnalysis.insights.push({
        type: "scheduling_complexity",
        message:
          "Most staff have irregular patterns, suggesting complex scheduling needs",
        impact: "high",
      });
    }
  }

  return preferenceAnalysis;
};

/**
 * Analyze schedule optimization opportunities
 * @param {Object} completeAnalysis - Combined analysis from all other functions
 * @returns {Object} Optimization recommendations
 */
export const analyzeOptimizationOpportunities = (completeAnalysis) => {
  const {
    workloadAnalysis,
    dayOfWeekAnalysis,
    seasonalAnalysis,
    staffPreferenceAnalysis,
  } = completeAnalysis;

  const optimizationAnalysis = {
    opportunities: [],
    priorities: {
      high: [],
      medium: [],
      low: [],
    },
    potentialImpact: {
      efficiency: 0,
      fairness: 0,
      satisfaction: 0,
    },
    recommendations: [],
  };

  // Workload balancing opportunities
  if (workloadAnalysis.statistics.fairnessScore < 70) {
    const opportunity = {
      type: "workload_balancing",
      description: "Improve workload distribution fairness",
      currentScore: workloadAnalysis.statistics.fairnessScore,
      targetScore: 85,
      affectedStaff: [
        ...workloadAnalysis.patterns.overworked,
        ...workloadAnalysis.patterns.underutilized,
      ],
      actions: [
        "Redistribute shifts from overworked to underutilized staff",
        "Implement rotation system for demanding shifts",
        "Consider workload caps and minimums",
      ],
      impact: {
        efficiency: 15,
        fairness: 25,
        satisfaction: 20,
      },
    };

    optimizationAnalysis.opportunities.push(opportunity);
    optimizationAnalysis.priorities.high.push(opportunity);
  }

  // Day of week optimization
  const dayVariance =
    dayOfWeekAnalysis.trends.busiestDay.averageStaff -
    dayOfWeekAnalysis.trends.quietestDay.averageStaff;
  if (dayVariance > 2) {
    const opportunity = {
      type: "daily_staffing_optimization",
      description: "Balance daily staffing levels",
      currentVariance: dayVariance,
      targetVariance: 1.5,
      actions: [
        `Reduce staffing on ${dayOfWeekAnalysis.trends.busiestDay.day}`,
        `Increase staffing on ${dayOfWeekAnalysis.trends.quietestDay.day}`,
        "Implement flexible shift patterns",
      ],
      impact: {
        efficiency: 20,
        fairness: 10,
        satisfaction: 15,
      },
    };

    optimizationAnalysis.opportunities.push(opportunity);
    optimizationAnalysis.priorities.medium.push(opportunity);
  }

  // Staff preference alignment
  const consistentStaffCount =
    staffPreferenceAnalysis.patterns.consistentPatterns.length;
  const totalStaff = Object.keys(staffPreferenceAnalysis.byStaff).length;
  const consistencyRate =
    totalStaff > 0 ? (consistentStaffCount / totalStaff) * 100 : 0;

  if (consistencyRate < 60) {
    const opportunity = {
      type: "preference_alignment",
      description: "Better align schedules with staff preferences",
      currentAlignment: consistencyRate,
      targetAlignment: 75,
      actions: [
        "Identify and accommodate day-of-week preferences",
        "Create shift patterns that match staff availability",
        "Implement preference-based scheduling system",
      ],
      impact: {
        efficiency: 10,
        fairness: 15,
        satisfaction: 30,
      },
    };

    optimizationAnalysis.opportunities.push(opportunity);
    optimizationAnalysis.priorities.high.push(opportunity);
  }

  // Seasonal adaptation
  if (seasonalAnalysis.trends.staffingChanges.length > 0) {
    const opportunity = {
      type: "seasonal_adaptation",
      description: "Adapt scheduling to seasonal patterns",
      changes: seasonalAnalysis.trends.staffingChanges,
      actions: [
        "Implement seasonal staffing models",
        "Prepare for predictable volume changes",
        "Create flexible capacity planning",
      ],
      impact: {
        efficiency: 25,
        fairness: 5,
        satisfaction: 10,
      },
    };

    optimizationAnalysis.opportunities.push(opportunity);
    optimizationAnalysis.priorities.medium.push(opportunity);
  }

  // Calculate total potential impact
  optimizationAnalysis.opportunities.forEach((opp) => {
    optimizationAnalysis.potentialImpact.efficiency += opp.impact.efficiency;
    optimizationAnalysis.potentialImpact.fairness += opp.impact.fairness;
    optimizationAnalysis.potentialImpact.satisfaction +=
      opp.impact.satisfaction;
  });

  // Generate specific recommendations
  optimizationAnalysis.priorities.high.forEach((opp) => {
    optimizationAnalysis.recommendations.push({
      priority: "high",
      title: opp.description,
      actions: opp.actions,
      expectedImpact: opp.impact,
    });
  });

  optimizationAnalysis.priorities.medium.forEach((opp) => {
    optimizationAnalysis.recommendations.push({
      priority: "medium",
      title: opp.description,
      actions: opp.actions,
      expectedImpact: opp.impact,
    });
  });

  return optimizationAnalysis;
};

/**
 * Main comprehensive data analysis function
 * @param {Object} extractedData - Data from DataExtractor.extractAllDataForAI()
 * @returns {Object} Complete analysis results
 */
export const performComprehensiveAnalysis = (extractedData) => {
  console.log("📊 Performing comprehensive data analysis...");

  if (!extractedData.success || !extractedData.data) {
    return {
      success: false,
      error: "Invalid extracted data provided",
      analysis: null,
    };
  }

  const { staffProfiles, coveragePatterns, rawPeriodData } = extractedData.data;

  try {
    // Perform all analyses
    const workloadAnalysis = analyzeWorkloadDistribution(staffProfiles);
    const dayOfWeekAnalysis = analyzeDayOfWeekPatterns(coveragePatterns);
    const seasonalAnalysis = analyzeSeasonalTrends(rawPeriodData);
    const staffPreferenceAnalysis = analyzeStaffPreferences(staffProfiles);

    const completeAnalysis = {
      workloadAnalysis,
      dayOfWeekAnalysis,
      seasonalAnalysis,
      staffPreferenceAnalysis,
    };

    const optimizationAnalysis =
      analyzeOptimizationOpportunities(completeAnalysis);

    const result = {
      success: true,
      analyzedAt: new Date().toISOString(),
      analysis: {
        ...completeAnalysis,
        optimizationAnalysis,
        summary: {
          totalStaffAnalyzed: Object.keys(staffProfiles).length,
          periodsAnalyzed: rawPeriodData.length,
          optimizationOpportunities: optimizationAnalysis.opportunities.length,
          highPriorityOpportunities:
            optimizationAnalysis.priorities.high.length,
          overallHealthScore: calculateOverallHealthScore(completeAnalysis),
        },
      },
    };

    console.log(
      "✅ Comprehensive analysis completed:",
      result.analysis.summary,
    );
    return result;
  } catch (error) {
    console.error("❌ Analysis failed:", error);
    return {
      success: false,
      error: error.message,
      analysis: null,
    };
  }
};

/**
 * Calculate overall scheduling health score
 * @param {Object} completeAnalysis - Complete analysis results
 * @returns {number} Health score from 0-100
 */
const calculateOverallHealthScore = (completeAnalysis) => {
  const { workloadAnalysis, dayOfWeekAnalysis, staffPreferenceAnalysis } =
    completeAnalysis;

  let totalScore = 0;
  let factors = 0;

  // Workload fairness (30% weight)
  if (workloadAnalysis.statistics.fairnessScore !== undefined) {
    totalScore += workloadAnalysis.statistics.fairnessScore * 0.3;
    factors += 0.3;
  }

  // Day-to-day consistency (25% weight)
  const dayVariance =
    dayOfWeekAnalysis.trends.busiestDay.averageStaff -
    dayOfWeekAnalysis.trends.quietestDay.averageStaff;
  const dayConsistencyScore = Math.max(0, 100 - dayVariance * 10);
  totalScore += dayConsistencyScore * 0.25;
  factors += 0.25;

  // Staff preference alignment (25% weight)
  const consistentStaff =
    staffPreferenceAnalysis.patterns.consistentPatterns.length;
  const totalStaff = Object.keys(staffPreferenceAnalysis.byStaff).length;
  const preferenceScore =
    totalStaff > 0 ? (consistentStaff / totalStaff) * 100 : 0;
  totalScore += preferenceScore * 0.25;
  factors += 0.25;

  // Coverage adequacy (20% weight)
  // This is a simplified score - in a real implementation, you'd want more detailed coverage metrics
  const coverageScore = 80; // Placeholder
  totalScore += coverageScore * 0.2;
  factors += 0.2;

  return factors > 0 ? Math.round(totalScore / factors) : 0;
};
