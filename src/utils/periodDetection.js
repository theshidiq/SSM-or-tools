/**
 * periodDetection.js
 *
 * Utilities for detecting available training periods dynamically
 * Supports automatic period detection from localStorage and Supabase
 */

import { getMonthPeriods } from './dateUtils.js';

/**
 * Detect all periods that have schedule data in localStorage
 * @returns {Array<number>} Array of period indices with data (e.g., [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
 */
export const detectAvailablePeriods = () => {
  const availablePeriods = [];

  try {
    // Get all defined periods dynamically
    const periods = getMonthPeriods();
    console.log(`🔍 [Period Detection] Checking ${periods.length} defined periods...`);

    // Iterate through all defined periods (supports any number of periods)
    for (let monthIndex = 0; monthIndex < periods.length; monthIndex++) {
      // FIXED: Use correct localStorage key that matches optimizedStorage format
      const storageKey = `schedule-${monthIndex}`;
      const periodData = localStorage.getItem(storageKey);

      if (periodData) {
        try {
          const parsed = JSON.parse(periodData);
          // Check if period has meaningful schedule data
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            console.log(`✅ Period ${monthIndex} has data (${Object.keys(parsed).length} staff members)`);
            availablePeriods.push(monthIndex);
          } else {
            console.log(`⚠️ Period ${monthIndex} has empty data`);
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse period ${monthIndex} data:`, parseError.message);
        }
      } else {
        console.log(`❌ Period ${monthIndex} has no data in localStorage (key: ${storageKey})`);
      }
    }

    console.log(`📊 Detected ${availablePeriods.length} periods with data:`, availablePeriods);

    if (availablePeriods.length === 0) {
      console.error('❌ No periods with data found! Please ensure you have schedule data in localStorage.');
      console.log('💡 Tip: Check localStorage keys starting with "scheduleData_"');
    }

    return availablePeriods;
  } catch (error) {
    console.error('❌ Period detection failed:', error);
    // Fallback: return empty array or up to 6 periods if they exist
    const periods = getMonthPeriods();
    return periods.length > 0 ? Array.from({ length: Math.min(6, periods.length) }, (_, i) => i) : [];
  }
};

/**
 * Get current period index based on today's date
 * @returns {number} Current period index (0-based)
 */
export const getCurrentPeriodIndex = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based (0 = January, 11 = December)

  // Periods are defined as 2-month chunks:
  // Period 0: Jan-Feb (months 0-1)
  // Period 1: Mar-Apr (months 2-3)
  // Period 2: May-Jun (months 4-5)
  // Period 3: Jul-Aug (months 6-7)
  // Period 4: Sep-Oct (months 8-9)
  // Period 5: Nov-Dec (months 10-11)

  const periodIndex = Math.floor(currentMonth / 2);
  return periodIndex;
};

/**
 * Detect available periods up to the current date only
 * This ensures we only train on historical data, not future periods
 * @returns {Array<number>} Array of period indices from 0 to current period
 */
export const detectAvailablePeriodsUpToNow = () => {
  // Get all periods with data
  const allAvailablePeriods = detectAvailablePeriods();

  // Get current period index
  const currentPeriodIndex = getCurrentPeriodIndex();

  console.log(`📅 [Period Filter] Current date: ${new Date().toLocaleDateString('ja-JP')}`);
  console.log(`📅 [Period Filter] Current period index: ${currentPeriodIndex}`);
  console.log(`📅 [Period Filter] All available periods: ${formatPeriodList(allAvailablePeriods)}`);

  // Filter to only include periods up to and including current period
  const filteredPeriods = allAvailablePeriods.filter(p => p <= currentPeriodIndex);

  console.log(`✅ [Period Filter] Filtered to periods 0-${currentPeriodIndex}: ${formatPeriodList(filteredPeriods)}`);
  console.log(`🔍 [Period Filter] Using ${filteredPeriods.length} periods for training (excluding future periods)`);

  if (filteredPeriods.length < allAvailablePeriods.length) {
    const excludedPeriods = allAvailablePeriods.filter(p => p > currentPeriodIndex);
    console.log(`⏭️ [Period Filter] Excluded future periods: ${formatPeriodList(excludedPeriods)}`);
  }

  return filteredPeriods;
};

/**
 * Get the latest (highest index) period with data
 * @returns {number|null} Latest period index or null if no periods found
 */
export const getLatestPeriodIndex = () => {
  const periods = detectAvailablePeriods();
  return periods.length > 0 ? Math.max(...periods) : null;
};

/**
 * Check if specific period has data
 * @param {number} monthIndex - Period index to check
 * @returns {boolean} True if period has data
 */
export const hasPeriodData = (monthIndex) => {
  const periods = getMonthPeriods();
  if (monthIndex < 0 || monthIndex >= periods.length) {
    return false;
  }

  const storageKey = `scheduleData_${monthIndex}`;
  const periodData = localStorage.getItem(storageKey);

  if (!periodData) {
    return false;
  }

  try {
    const parsed = JSON.parse(periodData);
    return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
  } catch {
    return false;
  }
};

/**
 * Compare current available periods with periods used in model training
 * @param {Array<number>} modelPeriods - Periods used in trained model
 * @returns {Object} Comparison result with new periods detected
 */
export const comparePeriodsWithModel = (modelPeriods = []) => {
  const currentPeriods = detectAvailablePeriods();

  // Find new periods not in model
  const newPeriods = currentPeriods.filter(p => !modelPeriods.includes(p));

  // Find removed periods (in model but not in current)
  const removedPeriods = modelPeriods.filter(p => !currentPeriods.includes(p));

  const hasChanges = newPeriods.length > 0 || removedPeriods.length > 0;
  const needsRetraining = hasChanges;

  return {
    currentPeriods,
    modelPeriods,
    newPeriods,
    removedPeriods,
    hasChanges,
    needsRetraining,
    summary: {
      current: currentPeriods.length,
      model: modelPeriods.length,
      new: newPeriods.length,
      removed: removedPeriods.length,
    },
  };
};

/**
 * Get detailed period information for display
 * @returns {Array<Object>} Period details with data status
 */
export const getPeriodDetails = () => {
  const details = [];
  const periods = getMonthPeriods();

  for (let monthIndex = 0; monthIndex < periods.length; monthIndex++) {
    const period = periods[monthIndex];
    const hasData = hasPeriodData(monthIndex);

    let sampleCount = 0;
    if (hasData) {
      try {
        const storageKey = `scheduleData_${monthIndex}`;
        const periodData = JSON.parse(localStorage.getItem(storageKey));
        // Estimate sample count (staff × days)
        const staffCount = Object.keys(periodData).length;
        const dayCount = Object.keys(Object.values(periodData)[0] || {}).length;
        sampleCount = staffCount * dayCount;
      } catch {
        sampleCount = 0;
      }
    }

    details.push({
      index: monthIndex,
      name: period.name,
      hasData,
      sampleCount,
      estimatedSamples: sampleCount,
    });
  }

  return details;
};

/**
 * Calculate total training samples across all available periods
 * @returns {number} Total sample count
 */
export const getTotalTrainingSamples = () => {
  const details = getPeriodDetails();
  return details
    .filter(d => d.hasData)
    .reduce((sum, d) => sum + d.estimatedSamples, 0);
};

/**
 * Validate that minimum data exists for training
 * @param {number} minPeriods - Minimum periods required (default: 1)
 * @param {number} minSamples - Minimum samples required (default: 50)
 * @returns {Object} Validation result
 */
export const validateTrainingData = (minPeriods = 1, minSamples = 50) => {
  const availablePeriods = detectAvailablePeriods();
  const totalSamples = getTotalTrainingSamples();

  const valid = availablePeriods.length >= minPeriods && totalSamples >= minSamples;

  return {
    valid,
    availablePeriods: availablePeriods.length,
    totalSamples,
    minPeriods,
    minSamples,
    issues: [
      ...(availablePeriods.length < minPeriods
        ? [`Not enough periods: ${availablePeriods.length}/${minPeriods}`]
        : []),
      ...(totalSamples < minSamples
        ? [`Not enough samples: ${totalSamples}/${minSamples}`]
        : []),
    ],
  };
};

/**
 * Format period list for display
 * @param {Array<number>} periods - Period indices
 * @returns {string} Formatted string (e.g., "0-5, 7, 9")
 */
export const formatPeriodList = (periods) => {
  if (!periods || periods.length === 0) return 'なし';

  const sorted = [...periods].sort((a, b) => a - b);
  const ranges = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      if (rangeStart === rangeEnd) {
        ranges.push(`${rangeStart}`);
      } else if (rangeEnd === rangeStart + 1) {
        ranges.push(`${rangeStart}, ${rangeEnd}`);
      } else {
        ranges.push(`${rangeStart}-${rangeEnd}`);
      }
      if (i < sorted.length) {
        rangeStart = sorted[i];
        rangeEnd = sorted[i];
      }
    }
  }

  return ranges.join(', ');
};
