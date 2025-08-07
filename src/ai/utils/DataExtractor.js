/**
 * DataExtractor.js
 * 
 * Utilities to extract and analyze data from the current schedule format.
 * Handles localStorage, Supabase data, and existing schedule structures.
 */

import { generateDateRange } from '../../utils/dateUtils';
import { optimizedStorage } from '../../utils/storageUtils';
import { shiftSymbols } from '../../constants/shiftConstants';
import { isStaffActiveInCurrentPeriod } from '../../utils/staffUtils';

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
        error: 'No data found for the specified period',
        monthIndex,
        dateRange
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
        dateKeys: dateRange.map(date => date.toISOString().split('T')[0])
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      monthIndex
    };
  }
};

/**
 * Extract all available historical data from all periods
 * @returns {Array} Array of period data objects
 */
export const extractAllHistoricalData = () => {
  const allData = [];
  
  // Extract data from all 6 periods (0-5)
  for (let monthIndex = 0; monthIndex < 6; monthIndex++) {
    const periodData = extractPeriodData(monthIndex);
    if (periodData.success) {
      allData.push(periodData);
    }
  }
  
  return allData;
};

/**
 * Extract staff information and their work patterns
 * @param {Array} allPeriodData - All period data from extractAllHistoricalData
 * @returns {Object} Staff profiles with historical patterns
 */
export const extractStaffProfiles = (allPeriodData) => {
  const staffProfiles = {};
  
  allPeriodData.forEach(periodData => {
    const { staffData, scheduleData, dateRange, monthIndex } = periodData;
    
    // Filter staff to only include those who were active in this period
    const activeStaffForPeriod = staffData.filter(staff => {
      try {
        const isActive = isStaffActiveInCurrentPeriod(staff, dateRange);
        
        if (!isActive) {
          console.log(`⏭️ DataExtractor: Filtering out inactive staff ${staff.name} for period ${monthIndex}`);
        }
        
        return isActive;
      } catch (error) {
        console.warn(`⚠️ Error checking staff activity for ${staff.name} in data extraction:`, error);
        // Default to including staff if there's an error
        return true;
      }
    });
    
    activeStaffForPeriod.forEach(staff => {
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
          shiftCounts: {}
        };
      }
      
      // Add this period to their work history
      staffProfiles[staff.id].periodsWorked.push(monthIndex);
      
      // Extract shift patterns for this period
      if (scheduleData[staff.id]) {
        const staffSchedule = scheduleData[staff.id];
        const periodShifts = {};
        
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
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
      monthly: {}
    }
  };
  
  // Initialize day of week data
  for (let i = 0; i < 7; i++) {
    coverageData.byDayOfWeek[i] = {
      totalDays: 0,
      shiftCounts: {},
      averageStaff: 0
    };
  }
  
  allPeriodData.forEach(periodData => {
    const { scheduleData, dateRange, monthIndex } = periodData;
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Count shifts for this date
      const dailyShifts = {
        early: 0,
        normal: 0,
        late: 0,
        off: 0,
        other: 0,
        total: 0
      };
      
      Object.keys(scheduleData).forEach(staffId => {
        if (scheduleData[staffId][dateKey] !== undefined) {
          const shift = scheduleData[staffId][dateKey];
          dailyShifts.total++;
          
          // Categorize shift types
          if (shift === '△' || shift === 'early') {
            dailyShifts.early++;
          } else if (shift === '×' || shift === 'off') {
            dailyShifts.off++;
          } else if (shift === '◇' || shift === 'late') {
            dailyShifts.late++;
          } else if (shift === '' || shift === 'normal') {
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
        shifts: dailyShifts
      };
      
      // Aggregate by day of week
      const dayData = coverageData.byDayOfWeek[dayOfWeek];
      dayData.totalDays++;
      Object.keys(dailyShifts).forEach(shiftType => {
        if (!dayData.shiftCounts[shiftType]) {
          dayData.shiftCounts[shiftType] = 0;
        }
        dayData.shiftCounts[shiftType] += dailyShifts[shiftType];
      });
    });
  });
  
  // Calculate averages
  Object.keys(coverageData.byDayOfWeek).forEach(dayOfWeek => {
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
  Object.keys(shiftSymbols).forEach(key => {
    symbolUsage[shiftSymbols[key].symbol] = {
      symbol: shiftSymbols[key].symbol,
      label: shiftSymbols[key].label,
      count: 0,
      staffUsage: {}
    };
  });
  
  // Add empty string for normal shift
  symbolUsage[''] = {
    symbol: '',
    label: 'Normal Shift',
    count: 0,
    staffUsage: {}
  };
  
  allPeriodData.forEach(periodData => {
    const { scheduleData, staffData } = periodData;
    
    Object.keys(scheduleData).forEach(staffId => {
      const staffName = staffData.find(s => s.id === staffId)?.name || staffId;
      const staffSchedule = scheduleData[staffId];
      
      Object.values(staffSchedule).forEach(shiftValue => {
        if (shiftValue !== undefined) {
          // Count usage
          if (!symbolUsage[shiftValue]) {
            symbolUsage[shiftValue] = {
              symbol: shiftValue,
              label: `Custom: ${shiftValue}`,
              count: 0,
              staffUsage: {}
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
      empty: 0
    }
  };
  
  allPeriodData.forEach(periodData => {
    const { scheduleData, staffData, dateRange, monthIndex } = periodData;
    
    metrics.totalStaff += staffData.length;
    metrics.totalDays += dateRange.length;
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      let dayShifts = 0;
      let staffWithData = 0;
      
      staffData.forEach(staff => {
        if (scheduleData[staff.id] && scheduleData[staff.id][dateKey] !== undefined) {
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
          coverage: (staffWithData / staffData.length) * 100
        });
      }
    });
  });
  
  return metrics;
};

/**
 * Main function to extract and structure all data for AI analysis
 * @returns {Object} Complete data extraction for AI processing
 */
export const extractAllDataForAI = () => {
  try {
    console.log('🔍 Extracting all data for AI analysis...');
    
    // Extract all historical data
    const allPeriodData = extractAllHistoricalData();
    
    if (allPeriodData.length === 0) {
      return {
        success: false,
        error: 'No historical data found',
        data: null
      };
    }
    
    // Extract staff profiles
    const staffProfiles = extractStaffProfiles(allPeriodData);
    
    // Extract coverage patterns
    const coveragePatterns = extractDailyCoveragePatterns(allPeriodData);
    
    // Extract shift symbol usage
    const shiftSymbolUsage = extractShiftSymbolUsage(allPeriodData);
    
    // Extract data quality metrics
    const dataQualityMetrics = extractDataQualityMetrics(allPeriodData);
    
    const result = {
      success: true,
      extractedAt: new Date().toISOString(),
      data: {
        rawPeriodData: allPeriodData,
        staffProfiles,
        coveragePatterns,
        shiftSymbolUsage,
        dataQualityMetrics,
        summary: {
          totalPeriods: allPeriodData.length,
          totalStaff: Object.keys(staffProfiles).length,
          totalDays: dataQualityMetrics.totalDays,
          totalShifts: dataQualityMetrics.totalShifts,
          dataCompleteness: (dataQualityMetrics.coverage.complete / 
            (dataQualityMetrics.coverage.complete + dataQualityMetrics.coverage.partial + dataQualityMetrics.coverage.empty)) * 100
        }
      }
    };
    
    console.log('✅ Data extraction completed:', result.data.summary);
    return result;
    
  } catch (error) {
    console.error('❌ Data extraction failed:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};