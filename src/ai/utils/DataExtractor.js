/**
 * DataExtractor.js
 *
 * Utilities to extract and analyze data from the current schedule format.
 * Handles localStorage, Supabase data, and existing schedule structures.
 */

import { generateDateRange } from "../../utils/dateUtils";
import { optimizedStorage } from "../../utils/storageUtils";
import { shiftSymbols } from "../../constants/shiftConstants";
import { isStaffActiveInCurrentPeriod } from "../../utils/staffUtils";
import { detectAvailablePeriods } from "../../utils/periodDetection";
import {
  detectPositionPatterns,
  calculateShiftTransitionMatrix,
  analyzeShiftMomentum,
  calculatePatternStability,
  getSequenceFeaturesForDate,
} from "../core/PatternRecognizer";

/**
 * Extract schedule data for a specific period
 * @param {number} monthIndex - The month period index (0-5)
 * @returns {Object} Extracted schedule data and metadata
 */
export const extractPeriodData = (monthIndex) => {
  try {
    // Get schedule and staff data from optimized storage
    const scheduleData = optimizedStorage.getScheduleData(monthIndex);
    const staffData = optimizedStorage.getStaffData(monthIndex);
    const dateRange = generateDateRange(monthIndex);

    if (!scheduleData || !staffData) {
      return {
        success: false,
        error: "No data found for the specified period",
        monthIndex,
        dateRange,
      };
    }

    return {
      success: true,
      monthIndex,
      scheduleData,
      staffData,
      dateRange,
      metadata: {
        totalStaff: staffData.length,
        totalDays: dateRange.length,
        dateKeys: dateRange.map((date) => date.toISOString().split("T")[0]),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      monthIndex,
    };
  }
};

/**
 * Extract all available historical data from all periods
 * @param {Array<number>} periodsToUse - Optional array of period indices to use (e.g., [0,1,2,3,4])
 * @returns {Object} All period data with metadata
 */
export const extractAllHistoricalData = (periodsToUse = null) => {
  const allData = [];

  // 🔥 DYNAMIC PERIOD DETECTION: Automatically detect all periods with data
  let availablePeriods;

  if (periodsToUse && Array.isArray(periodsToUse) && periodsToUse.length > 0) {
    // Use filtered periods provided by caller
    availablePeriods = periodsToUse;
    console.log(`📅 [DataExtractor] Using ${availablePeriods.length} filtered periods for training:`, availablePeriods);
  } else {
    // Use all available periods
    availablePeriods = detectAvailablePeriods();
    console.log(`📊 [DataExtractor] Using ${availablePeriods.length} periods for training:`, availablePeriods);
  }

  if (availablePeriods.length === 0) {
    console.error('❌ [DataExtractor] No periods found with schedule data!');
    console.error('💡 [DataExtractor] Make sure you have created schedules and saved them to localStorage');
    console.error('💡 [DataExtractor] Expected localStorage keys: scheduleData_0, scheduleData_1, etc.');
  }

  // Extract data from specified periods
  for (const monthIndex of availablePeriods) {
    const periodData = extractPeriodData(monthIndex);
    if (periodData.success) {
      allData.push(periodData);
    } else {
      console.warn(`⚠️ [DataExtractor] Failed to extract period ${monthIndex}:`, periodData.error);
    }
  }

  return {
    periods: allData,
    periodsUsed: availablePeriods,
    totalPeriods: availablePeriods.length,
  };
};

/**
 * Extract staff information and their work patterns
 * @param {Array} allPeriodData - All period data from extractAllHistoricalData
 * @returns {Object} Staff profiles with historical patterns
 */
export const extractStaffProfiles = (allPeriodData) => {
  const staffProfiles = {};

  allPeriodData.forEach((periodData) => {
    const { staffData, scheduleData, dateRange, monthIndex } = periodData;

    // Filter staff to only include those who were active in this period
    const activeStaffForPeriod = staffData.filter((staff) => {
      try {
        const isActive = isStaffActiveInCurrentPeriod(staff, dateRange);

        if (!isActive) {
          console.log(
            `⏭️ DataExtractor: Filtering out inactive staff ${staff.name} for period ${monthIndex}`,
          );
        }

        return isActive;
      } catch (error) {
        console.warn(
          `⚠️ Error checking staff activity for ${staff.name} in data extraction:`,
          error,
        );
        // Default to including staff if there's an error
        return true;
      }
    });

    activeStaffForPeriod.forEach((staff) => {
      if (!staffProfiles[staff.id]) {
        staffProfiles[staff.id] = {
          id: staff.id,
          name: staff.name,
          position: staff.position,
          status: staff.status,
          type: staff.type,
          department: staff.department,
          startPeriod: staff.startPeriod,
          endPeriod: staff.endPeriod,
          periodsWorked: [],
          shiftHistory: {},
          totalShifts: 0,
          shiftCounts: {},
        };
      }

      // Add this period to their work history
      staffProfiles[staff.id].periodsWorked.push(monthIndex);

      // Extract shift patterns for this period
      if (scheduleData[staff.id]) {
        const staffSchedule = scheduleData[staff.id];
        const periodShifts = {};

        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          if (staffSchedule[dateKey] !== undefined) {
            const shiftValue = staffSchedule[dateKey];
            periodShifts[dateKey] = shiftValue;

            // Count shift types
            if (!staffProfiles[staff.id].shiftCounts[shiftValue]) {
              staffProfiles[staff.id].shiftCounts[shiftValue] = 0;
            }
            staffProfiles[staff.id].shiftCounts[shiftValue]++;
            staffProfiles[staff.id].totalShifts++;
          }
        });

        staffProfiles[staff.id].shiftHistory[monthIndex] = periodShifts;
      }
    });
  });

  return staffProfiles;
};

/**
 * PHASE 2: Enrich staff profiles with per-staff pattern memory
 * @param {Object} staffProfiles - Staff profiles from extractStaffProfiles
 * @returns {Object} Enhanced staff profiles with pattern analysis
 */
export const enrichStaffProfilesWithPatterns = (staffProfiles) => {
  console.log("🧠 PHASE 2: Enriching staff profiles with pattern memory...");

  const enrichedProfiles = {};

  Object.keys(staffProfiles).forEach((staffId) => {
    const profile = staffProfiles[staffId];

    // Skip staff with insufficient data
    if (profile.totalShifts < 10) {
      console.log(
        `⏭️ Skipping ${profile.name} - insufficient data (${profile.totalShifts} shifts)`,
      );
      enrichedProfiles[staffId] = profile;
      return;
    }

    try {
      // Collect all shifts in chronological order
      const allShifts = [];
      Object.keys(profile.shiftHistory)
        .sort()
        .forEach((monthIndex) => {
          const monthSchedule = profile.shiftHistory[monthIndex];
          Object.keys(monthSchedule)
            .sort()
            .forEach((dateKey) => {
              allShifts.push(monthSchedule[dateKey]);
            });
        });

      // Calculate pattern memory features
      const patternMemory = {
        // Position-based patterns (weekly cycle)
        weeklyPositionPatterns: detectPositionPatterns(profile, "weekly"),

        // Position-based patterns (monthly cycle)
        monthlyPositionPatterns: detectPositionPatterns(profile, "monthly"),

        // Shift transition matrix (Markov analysis)
        transitionMatrix: calculateShiftTransitionMatrix(allShifts),

        // Shift momentum analysis
        momentum: analyzeShiftMomentum(allShifts),

        // Pattern stability over time
        stability: calculatePatternStability(profile, 30),

        // Statistics
        stats: {
          totalHistoricalShifts: allShifts.length,
          periodsAnalyzed: Object.keys(profile.shiftHistory).length,
          averageShiftsPerPeriod:
            allShifts.length / Object.keys(profile.shiftHistory).length,
        },
      };

      // Add pattern memory to profile
      enrichedProfiles[staffId] = {
        ...profile,
        patternMemory,
        hasPatternMemory: true,
      };

      console.log(
        `✅ ${profile.name}: Pattern memory added (${allShifts.length} shifts analyzed)`,
      );
    } catch (error) {
      console.error(`❌ Failed to enrich ${profile.name}:`, error);
      enrichedProfiles[staffId] = {
        ...profile,
        hasPatternMemory: false,
      };
    }
  });

  console.log(
    `🎯 Pattern memory enrichment completed for ${Object.keys(enrichedProfiles).length} staff members`,
  );
  return enrichedProfiles;
};

/**
 * Get staff-specific prediction context for a given date
 * @param {Object} staffProfile - Enriched staff profile with pattern memory
 * @param {string} targetDate - Target date for prediction (ISO format)
 * @returns {Object} Staff-specific context for predictions
 */
export const getStaffPredictionContext = (staffProfile, targetDate) => {
  if (!staffProfile.hasPatternMemory) {
    return {
      hasContext: false,
      reason: "No pattern memory available",
    };
  }

  const { patternMemory } = staffProfile;
  const targetDateObj = new Date(targetDate);

  // Get position-based predictions
  const weeklyPosition = targetDateObj.getDay();
  const monthlyPosition = targetDateObj.getDate() - 1; // 0-indexed

  const weeklyPrediction =
    patternMemory.weeklyPositionPatterns.predictions[weeklyPosition];
  const monthlyPrediction =
    patternMemory.monthlyPositionPatterns.predictions[monthlyPosition];

  // Get sequence features for the target date
  const sequenceFeatures = getSequenceFeaturesForDate(
    staffProfile,
    targetDate,
    7,
  );

  // Calculate confidence based on pattern stability
  const baseConfidence = patternMemory.stability.stabilityScore / 100;
  const weeklyConfidence = weeklyPrediction?.confidence || 0.5;
  const monthlyConfidence = monthlyPrediction?.confidence || 0.5;

  // Weighted average confidence
  const overallConfidence =
    baseConfidence * 0.4 + weeklyConfidence * 0.4 + monthlyConfidence * 0.2;

  return {
    hasContext: true,
    staffId: staffProfile.id,
    staffName: staffProfile.name,
    targetDate,
    predictions: {
      weekly: weeklyPrediction,
      monthly: monthlyPrediction,
    },
    transitionMatrix: patternMemory.transitionMatrix.matrix,
    momentum: patternMemory.momentum,
    stability: {
      score: patternMemory.stability.stabilityScore,
      level: patternMemory.stability.stabilityLevel,
      trend: patternMemory.stability.variabilityTrend,
    },
    sequenceFeatures,
    confidence: {
      overall: overallConfidence,
      base: baseConfidence,
      weekly: weeklyConfidence,
      monthly: monthlyConfidence,
    },
    recommendations: [
      ...patternMemory.stability.recommendations,
      ...(overallConfidence < 0.5
        ? [
            {
              type: "low_confidence",
              message: "Pattern confidence is low - predictions may be less accurate",
              priority: "medium",
            },
          ]
        : []),
    ],
  };
};

/**
 * Extract daily coverage patterns across all periods
 * @param {Array} allPeriodData - All period data from extractAllHistoricalData
 * @returns {Object} Daily coverage analysis
 */
export const extractDailyCoveragePatterns = (allPeriodData) => {
  const coverageData = {
    byDayOfWeek: {}, // 0 = Sunday, 6 = Saturday
    byDate: {},
    averageStaffing: {},
    patterns: {
      weekday: {},
      weekend: {},
      monthly: {},
    },
  };

  // Initialize day of week data
  for (let i = 0; i < 7; i++) {
    coverageData.byDayOfWeek[i] = {
      totalDays: 0,
      shiftCounts: {},
      averageStaff: 0,
    };
  }

  allPeriodData.forEach((periodData) => {
    const { scheduleData, dateRange, monthIndex } = periodData;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();

      // Count shifts for this date
      const dailyShifts = {
        early: 0,
        normal: 0,
        late: 0,
        off: 0,
        other: 0,
        total: 0,
      };

      Object.keys(scheduleData).forEach((staffId) => {
        if (scheduleData[staffId][dateKey] !== undefined) {
          const shift = scheduleData[staffId][dateKey];
          dailyShifts.total++;

          // Categorize shift types
          if (shift === "△" || shift === "early") {
            dailyShifts.early++;
          } else if (shift === "×" || shift === "off") {
            dailyShifts.off++;
          } else if (shift === "◇" || shift === "late") {
            dailyShifts.late++;
          } else if (shift === "" || shift === "normal") {
            dailyShifts.normal++;
          } else {
            dailyShifts.other++;
          }
        }
      });

      // Store daily data
      coverageData.byDate[dateKey] = {
        date: date,
        dayOfWeek: dayOfWeek,
        monthIndex: monthIndex,
        shifts: dailyShifts,
      };

      // Aggregate by day of week
      const dayData = coverageData.byDayOfWeek[dayOfWeek];
      dayData.totalDays++;
      Object.keys(dailyShifts).forEach((shiftType) => {
        if (!dayData.shiftCounts[shiftType]) {
          dayData.shiftCounts[shiftType] = 0;
        }
        dayData.shiftCounts[shiftType] += dailyShifts[shiftType];
      });
    });
  });

  // Calculate averages
  Object.keys(coverageData.byDayOfWeek).forEach((dayOfWeek) => {
    const dayData = coverageData.byDayOfWeek[dayOfWeek];
    if (dayData.totalDays > 0) {
      dayData.averageStaff = dayData.shiftCounts.total / dayData.totalDays;
    }
  });

  return coverageData;
};

/**
 * Extract shift symbols and their usage patterns
 * @param {Array} allPeriodData - All period data from extractAllHistoricalData
 * @returns {Object} Shift symbol analysis
 */
export const extractShiftSymbolUsage = (allPeriodData) => {
  const symbolUsage = {};

  // Initialize with known symbols
  Object.keys(shiftSymbols).forEach((key) => {
    symbolUsage[shiftSymbols[key].symbol] = {
      symbol: shiftSymbols[key].symbol,
      label: shiftSymbols[key].label,
      count: 0,
      staffUsage: {},
    };
  });

  // Add empty string for normal shift
  symbolUsage[""] = {
    symbol: "",
    label: "Normal Shift",
    count: 0,
    staffUsage: {},
  };

  allPeriodData.forEach((periodData) => {
    const { scheduleData, staffData } = periodData;

    Object.keys(scheduleData).forEach((staffId) => {
      const staffName =
        staffData.find((s) => s.id === staffId)?.name || staffId;
      const staffSchedule = scheduleData[staffId];

      Object.values(staffSchedule).forEach((shiftValue) => {
        if (shiftValue !== undefined) {
          // Count usage
          if (!symbolUsage[shiftValue]) {
            symbolUsage[shiftValue] = {
              symbol: shiftValue,
              label: `Custom: ${shiftValue}`,
              count: 0,
              staffUsage: {},
            };
          }

          symbolUsage[shiftValue].count++;

          // Track staff usage
          if (!symbolUsage[shiftValue].staffUsage[staffName]) {
            symbolUsage[shiftValue].staffUsage[staffName] = 0;
          }
          symbolUsage[shiftValue].staffUsage[staffName]++;
        }
      });
    });
  });

  return symbolUsage;
};

/**
 * Extract data quality metrics
 * @param {Array} allPeriodData - All period data from extractAllHistoricalData
 * @returns {Object} Data quality analysis
 */
export const extractDataQualityMetrics = (allPeriodData) => {
  const metrics = {
    totalPeriods: allPeriodData.length,
    totalStaff: 0,
    totalDays: 0,
    totalShifts: 0,
    emptyDays: 0,
    inconsistentData: [],
    coverage: {
      complete: 0,
      partial: 0,
      empty: 0,
    },
  };

  allPeriodData.forEach((periodData) => {
    const { scheduleData, staffData, dateRange, monthIndex } = periodData;

    metrics.totalStaff += staffData.length;
    metrics.totalDays += dateRange.length;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      let dayShifts = 0;
      let staffWithData = 0;

      staffData.forEach((staff) => {
        if (
          scheduleData[staff.id] &&
          scheduleData[staff.id][dateKey] !== undefined
        ) {
          staffWithData++;
          dayShifts++;
          metrics.totalShifts++;
        }
      });

      // Categorize coverage
      if (staffWithData === 0) {
        metrics.coverage.empty++;
        metrics.emptyDays++;
      } else if (staffWithData === staffData.length) {
        metrics.coverage.complete++;
      } else {
        metrics.coverage.partial++;
        metrics.inconsistentData.push({
          date: dateKey,
          monthIndex,
          staffTotal: staffData.length,
          staffWithData,
          coverage: (staffWithData / staffData.length) * 100,
        });
      }
    });
  });

  return metrics;
};

/**
 * Main function to extract and structure all data for AI analysis
 * @param {boolean} enrichWithPatterns - Whether to enrich with Phase 2 pattern memory (default: true)
 * @param {Array<number>} periodsToUse - Optional array of period indices to use (e.g., [0,1,2,3,4])
 * @returns {Object} Complete data extraction for AI processing
 */
export const extractAllDataForAI = (enrichWithPatterns = true, periodsToUse = null) => {
  try {
    console.log("🔍 Extracting all data for AI analysis...");

    // Extract all historical data with dynamic period detection (optionally filtered)
    const historicalDataResult = extractAllHistoricalData(periodsToUse);
    const { periods: allPeriodData, periodsUsed, totalPeriods } = historicalDataResult;

    if (allPeriodData.length === 0) {
      return {
        success: false,
        error: "No historical data found",
        data: null,
      };
    }

    // Extract staff profiles
    let staffProfiles = extractStaffProfiles(allPeriodData);

    // PHASE 2: Enrich with per-staff pattern memory
    if (enrichWithPatterns) {
      try {
        staffProfiles = enrichStaffProfilesWithPatterns(staffProfiles);
      } catch (error) {
        console.warn("⚠️ Pattern enrichment failed, continuing without:", error);
      }
    }

    // Extract coverage patterns
    const coveragePatterns = extractDailyCoveragePatterns(allPeriodData);

    // Extract shift symbol usage
    const shiftSymbolUsage = extractShiftSymbolUsage(allPeriodData);

    // Extract data quality metrics
    const dataQualityMetrics = extractDataQualityMetrics(allPeriodData);

    // Count staff with pattern memory
    const staffWithPatterns = Object.values(staffProfiles).filter(
      (p) => p.hasPatternMemory,
    ).length;

    const result = {
      success: true,
      extractedAt: new Date().toISOString(),
      phase2Enabled: enrichWithPatterns,
      periodsUsed, // NEW: Track which periods were used
      totalPeriods, // NEW: Total count of periods
      data: {
        rawPeriodData: allPeriodData,
        staffProfiles,
        coveragePatterns,
        shiftSymbolUsage,
        dataQualityMetrics,
        summary: {
          totalPeriods: allPeriodData.length,
          periodsUsed, // NEW: Include in summary
          totalStaff: Object.keys(staffProfiles).length,
          staffWithPatternMemory: staffWithPatterns,
          totalDays: dataQualityMetrics.totalDays,
          totalShifts: dataQualityMetrics.totalShifts,
          dataCompleteness:
            (dataQualityMetrics.coverage.complete /
              (dataQualityMetrics.coverage.complete +
                dataQualityMetrics.coverage.partial +
                dataQualityMetrics.coverage.empty)) *
            100,
        },
      },
    };

    console.log("✅ Data extraction completed:", result.data.summary);
    return result;
  } catch (error) {
    console.error("❌ Data extraction failed:", error);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
};
