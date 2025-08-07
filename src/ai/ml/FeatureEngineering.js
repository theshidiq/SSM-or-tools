/**
 * FeatureEngineering.js
 * 
 * Converts restaurant schedule data into machine learning features
 * for TensorFlow training and inference.
 */

import { MODEL_CONFIG } from './TensorFlowConfig';
import { isStaffActiveInCurrentPeriod } from '../../utils/staffUtils';

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
      'staff_id_hash', 'staff_status_regular', 'staff_status_part_time',
      'staff_position_hash', 'staff_work_frequency', 'staff_preference_early',
      'staff_preference_late', 'staff_preference_off', 'staff_tenure_months',
      'staff_recent_workload',
      
      // Temporal features (8)
      'day_of_week', 'day_of_month', 'month_of_year', 'is_weekend',
      'is_holiday', 'period_index', 'days_from_period_start', 'season',
      
      // Historical features (12)
      'historical_shift_early_freq', 'historical_shift_normal_freq',
      'historical_shift_late_freq', 'historical_shift_off_freq',
      'recent_consecutive_days', 'avg_weekly_hours', 'pattern_consistency',
      'same_day_last_week', 'same_day_last_month', 'workload_trend',
      'preference_strength', 'schedule_stability',
      
      // Context features (5)
      'business_busy_level', 'required_coverage', 'staff_availability',
      'cost_factor', 'constraint_violations'
    ];
    
    console.log(`🔍 Feature Engineering: ${this.featureNames.length} features defined`);
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
    
    console.log('🔧 Preparing training data from historical schedules...');
    console.log(`📁 Processing ${Object.keys(allHistoricalData).length} historical periods`);
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
      console.log(`📅 Processing period ${periodIndex} with ${dateRange.length} days`);
      
      // Filter staff members to only include those who were active in this period
      const activeStaffForPeriod = staffMembers.filter(staff => {
        try {
          const isActive = isStaffActiveInCurrentPeriod(staff, dateRange);
          
          if (!isActive) {
            console.log(`⏭️ Skipping inactive staff ${staff.name} for period ${periodIndex} training data`);
            filteredStaffCount++;
          }
          
          return isActive;
        } catch (error) {
          console.warn(`⚠️ Error checking staff activity for ${staff.name} in period ${periodIndex}:`, error);
          // Default to including staff if there's an error
          return true;
        }
      });
      
      console.log(`👥 Training with ${activeStaffForPeriod.length} active staff for period ${periodIndex}`);
      
      // Process only active staff members
      activeStaffForPeriod.forEach(staff => {
        if (!schedule[staff.id]) {
          console.log(`ℹ️ No schedule data for staff ${staff.name} (${staff.id}) in period ${periodIndex}`);
          return;
        }
        
        const staffSchedule = schedule[staff.id];
        let staffSamples = 0;
        
        // Process each date for this staff member
        dateRange.forEach((date, dateIndex) => {
          totalSamples++;
          const dateKey = date.toISOString().split('T')[0];
          const actualShift = staffSchedule[dateKey];
          
          // Accept both defined values and empty strings (meaningful for regular staff)
          if (actualShift === undefined || actualShift === null) {
            console.log(`⚠️ Missing shift data for ${staff.name} on ${dateKey}`);
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
            staffMembers
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
              isPartTime: staff.status === 'パート'
            });
            validSamples++;
            staffSamples++;
          } else {
            console.warn(`⚠️ Invalid feature/label for ${staff.name} on ${dateKey}: shift="${actualShift}", label=${label}`);
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
    console.log(`  - Success rate: ${((validSamples / totalSamples) * 100).toFixed(1)}%`);
    
    // Validate feature consistency
    if (features.length > 0) {
      const featureLength = features[0].length;
      const expectedLength = MODEL_CONFIG.INPUT_FEATURES.TOTAL;
      console.log(`🔍 Feature validation: ${featureLength} features per sample (expected: ${expectedLength})`);
      
      if (featureLength !== expectedLength) {
        console.error(`❌ Feature length mismatch! This will cause training failures.`);
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
        successRate: validSamples / totalSamples
      }
    };
  }
  
  /**
   * Generate feature vector for a specific staff-date combination
   */
  generateFeatures({ staff, date, dateIndex, periodData, allHistoricalData, staffMembers }) {
    const expectedFeatures = MODEL_CONFIG.INPUT_FEATURES.TOTAL;
    const features = new Array(expectedFeatures).fill(0);
    let idx = 0;
    
    try {
      console.log(`🔧 Generating ${expectedFeatures} features for staff ${staff.name} on ${date.toISOString().split('T')[0]}`);
      
      // Staff features (10)
      features[idx++] = this.hashString(staff.id) / 1000000; // Normalize hash
      features[idx++] = staff.status === '社員' ? 1 : 0;
      features[idx++] = staff.status === 'パート' ? 1 : 0;
      features[idx++] = this.hashString(staff.position || 'default') / 1000000;
      features[idx++] = this.calculateWorkFrequency(staff, allHistoricalData);
      features[idx++] = this.calculateShiftPreference(staff, '△', allHistoricalData);
      features[idx++] = this.calculateShiftPreference(staff, '▽', allHistoricalData);
      features[idx++] = this.calculateShiftPreference(staff, '×', allHistoricalData);
      features[idx++] = this.calculateTenure(staff, allHistoricalData);
      features[idx++] = this.calculateRecentWorkload(staff, periodData, date);
      
      // Temporal features (8)
      features[idx++] = date.getDay() / 6; // 0-6 normalized to 0-1
      features[idx++] = date.getDate() / 31;
      features[idx++] = date.getMonth() / 11;
      features[idx++] = (date.getDay() === 0 || date.getDay() === 6) ? 1 : 0;
      features[idx++] = this.isHoliday(date) ? 1 : 0;
      features[idx++] = parseInt(Object.keys(allHistoricalData).find(key => 
        allHistoricalData[key] === periodData) || 0) / 5;
      features[idx++] = dateIndex / 30; // Approximate days in period
      features[idx++] = this.getSeason(date) / 3;
      
      // Historical features (12)
      const historicalPatterns = this.analyzeHistoricalPatterns(staff, allHistoricalData);
      features[idx++] = historicalPatterns.earlyFreq;
      features[idx++] = historicalPatterns.normalFreq;
      features[idx++] = historicalPatterns.lateFreq;
      features[idx++] = historicalPatterns.offFreq;
      features[idx++] = this.calculateConsecutiveDays(staff, periodData, date) / 7;
      features[idx++] = historicalPatterns.avgWeeklyHours / 40;
      features[idx++] = historicalPatterns.consistency;
      features[idx++] = this.getSameDayLastWeek(staff, periodData, date);
      features[idx++] = this.getSameDayLastMonth(staff, allHistoricalData, date);
      features[idx++] = historicalPatterns.workloadTrend;
      features[idx++] = historicalPatterns.preferenceStrength;
      features[idx++] = historicalPatterns.stability;
      
      // Context features (5)
      features[idx++] = this.calculateBusinessLevel(date, periodData) / 100;
      features[idx++] = this.calculateRequiredCoverage(date, staffMembers) / staffMembers.length;
      features[idx++] = this.calculateStaffAvailability(staff, date);
      features[idx++] = this.calculateCostFactor(staff, date);
      features[idx++] = this.calculateConstraintViolations(staff, periodData, date);
      
      // Validate feature count matches expected
      if (idx !== expectedFeatures) {
        console.warn(`⚠️ Feature count mismatch: generated ${idx}, expected ${expectedFeatures}`);
        // Pad or trim to match expected size
        while (features.length < expectedFeatures) features.push(0);
        while (features.length > expectedFeatures) features.pop();
      }
      
      // Validate no NaN or infinite values
      for (let i = 0; i < features.length; i++) {
        if (!isFinite(features[i])) {
          console.warn(`⚠️ Invalid feature at index ${i}: ${features[i]}, replacing with 0`);
          features[i] = 0;
        }
      }
      
      console.log(`✅ Generated ${features.length} valid features (idx=${idx})`);
      return features;
    } catch (error) {
      console.error('❌ Error generating features:', error);
      return null;
    }
  }
  
  /**
   * Convert shift symbol to ML label
   */
  shiftToLabel(shift, staff) {
    // Handle different shift types based on staff status
    if (!shift || shift === '') {
      // Blank/empty - normal shift for regular staff
      return staff.status === '社員' ? MODEL_CONFIG.SHIFT_TYPES.BLANK : null;
    }
    
    switch (shift) {
      case '○':
        return MODEL_CONFIG.SHIFT_TYPES.CIRCLE;
      case '△':
        return MODEL_CONFIG.SHIFT_TYPES.TRIANGLE;
      case '▽':
        return MODEL_CONFIG.SHIFT_TYPES.INVERTED;
      case '×': 
        return MODEL_CONFIG.SHIFT_TYPES.CROSS;
      case 'late':
        return MODEL_CONFIG.SHIFT_TYPES.INVERTED;
      default:
        // Custom text - treat as normal shift
        return staff.status === 'パート' ? MODEL_CONFIG.SHIFT_TYPES.CIRCLE : MODEL_CONFIG.SHIFT_TYPES.BLANK;
    }
  }
  
  /**
   * Convert ML prediction back to shift symbol
   */
  labelToShift(labelIndex, staff) {
    switch (labelIndex) {
      case MODEL_CONFIG.SHIFT_TYPES.BLANK:
        return ''; // Blank for regular staff normal shift
      case MODEL_CONFIG.SHIFT_TYPES.CIRCLE:
        return '○'; // Circle for part-time normal shift
      case MODEL_CONFIG.SHIFT_TYPES.TRIANGLE:
        return '△'; // Early shift
      case MODEL_CONFIG.SHIFT_TYPES.INVERTED:
        return '▽'; // Late shift
      case MODEL_CONFIG.SHIFT_TYPES.CROSS:
        return '×'; // Day off
      default:
        return staff.status === 'パート' ? '○' : '';
    }
  }
  
  // Utility functions for feature calculation
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  calculateWorkFrequency(staff, allHistoricalData) {
    let totalDays = 0;
    let workDays = 0;
    
    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      Object.values(periodData.schedule[staff.id]).forEach(shift => {
        totalDays++;
        if (shift && shift !== '×') workDays++;
      });
    });
    
    return totalDays > 0 ? workDays / totalDays : 0.5;
  }
  
  calculateShiftPreference(staff, shiftType, allHistoricalData) {
    let totalShifts = 0;
    let targetShifts = 0;
    
    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      Object.values(periodData.schedule[staff.id]).forEach(shift => {
        if (shift && shift !== '×') {
          totalShifts++;
          if (shift === shiftType || (shiftType === '○' && shift === '')) {
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
      periodData => periodData?.schedule?.[staff.id]
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
      const dateKey = pastDate.toISOString().split('T')[0];
      
      if (schedule[dateKey] && schedule[dateKey] !== '×') {
        workDays++;
      }
    }
    
    return workDays / 7;
  }
  
  isHoliday(date) {
    // Simple Japanese holiday detection (can be expanded)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return (month === 1 && day === 1) || // New Year
           (month === 12 && day >= 29); // Year-end
  }
  
  getSeason(date) {
    const month = date.getMonth() + 1;
    if (month >= 3 && month <= 5) return 0; // Spring
    if (month >= 6 && month <= 8) return 1; // Summer  
    if (month >= 9 && month <= 11) return 2; // Fall
    return 3; // Winter
  }
  
  analyzeHistoricalPatterns(staff, allHistoricalData) {
    let earlyCount = 0, normalCount = 0, lateCount = 0, offCount = 0, total = 0;
    const periods = Object.keys(allHistoricalData).length;
    const periodWorkRates = [];
    
    Object.entries(allHistoricalData).forEach(([periodKey, periodData]) => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      let periodWork = 0, periodTotal = 0;
      
      Object.values(periodData.schedule[staff.id]).forEach(shift => {
        total++;
        periodTotal++;
        
        // Count shift types with proper handling of empty strings for regular staff
        const isPartTime = staff.status === 'パート';
        
        switch (shift) {
          case '△': 
            earlyCount++; 
            periodWork++;
            break;
          case '○': 
            normalCount++; 
            periodWork++;
            break;
          case '▽': 
            lateCount++; 
            periodWork++;
            break;
          case '×': 
            offCount++; 
            break;
          case '': 
            if (!isPartTime) {
              normalCount++; // Empty = normal work for regular staff
              periodWork++;
            }
            break;
          default:
            if (shift && shift.trim() !== '') {
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
        earlyFreq: 0, normalFreq: staff.status === 'パート' ? 0.3 : 0.7, lateFreq: 0, offFreq: 0.3,
        avgWeeklyHours: staff.status === 'パート' ? 20 : 35, consistency: 0.5, workloadTrend: 0,
        preferenceStrength: 0.5, stability: 0.5
      };
    }
    
    // Calculate workload trend
    let workloadTrend = 0;
    if (periodWorkRates.length >= 2) {
      const recent = periodWorkRates.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const older = periodWorkRates.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, periodWorkRates.length - 2);
      workloadTrend = (recent - older) * 2; // Scale to [-2, 2] range
    }
    
    // Calculate stability based on variance in work rates
    let stability = 0.5;
    if (periodWorkRates.length > 1) {
      const avgRate = periodWorkRates.reduce((a, b) => a + b, 0) / periodWorkRates.length;
      const variance = periodWorkRates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / periodWorkRates.length;
      stability = Math.max(0, Math.min(1, 1 - variance)); // Higher stability = lower variance
    }
    
    return {
      earlyFreq: earlyCount / total,
      normalFreq: normalCount / total,
      lateFreq: lateCount / total,
      offFreq: offCount / total,
      avgWeeklyHours: ((total - offCount) / total) * (staff.status === 'パート' ? 25 : 40),
      consistency: this.calculateConsistency(staff, allHistoricalData),
      workloadTrend: Math.max(-1, Math.min(1, workloadTrend)),
      preferenceStrength: Math.max(earlyCount, normalCount, lateCount) / total,
      stability: stability
    };
  }
  
  calculateConsistency(staff, allHistoricalData) {
    // Measure how consistent the staff's patterns are across periods
    const patterns = [];
    
    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      const dayPatterns = {};
      Object.entries(periodData.schedule[staff.id]).forEach(([dateKey, shift]) => {
        const date = new Date(dateKey);
        const dayOfWeek = date.getDay();
        dayPatterns[dayOfWeek] = dayPatterns[dayOfWeek] || [];
        dayPatterns[dayOfWeek].push(shift);
      });
      
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
      const dateKey = pastDate.toISOString().split('T')[0];
      
      const shift = schedule[dateKey];
      const isWorkDay = shift && shift !== '×' && shift !== '' ? true : 
                        (!staff.isPartTime && shift === ''); // Empty = work for regular staff
      
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
    const dateKey = lastWeek.toISOString().split('T')[0];
    
    const shift = periodData.schedule[staff.id][dateKey];
    const isWorkDay = shift && shift !== '×' ? 1 : 
                      (!staff.isPartTime && shift === '' ? 1 : 0);
    return isWorkDay;
  }
  
  getSameDayLastMonth(staff, allHistoricalData, currentDate) {
    // Look for same day of week in previous periods
    const targetDayOfWeek = currentDate.getDay();
    let workingDaysFound = 0;
    let totalDaysFound = 0;
    
    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      Object.entries(periodData.schedule[staff.id]).forEach(([dateKey, shift]) => {
        const date = new Date(dateKey);
        if (date.getDay() === targetDayOfWeek) {
          totalDaysFound++;
          const isWorkDay = shift && shift !== '×' ? true : 
                            (!staff.isPartTime && shift === '');
          if (isWorkDay) workingDaysFound++;
        }
      });
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
    const baseRequirement = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 0.6;
    return Math.ceil(staffMembers.length * baseRequirement);
  }
  
  calculateStaffAvailability(staff, date) {
    // Simplified availability based on staff status
    return staff.status === 'パート' ? 0.7 : 0.9;
  }
  
  calculateCostFactor(staff, date) {
    // Cost factor based on staff type and day
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseCost = staff.status === '社員' ? 0.8 : 0.6;
    return isWeekend ? baseCost * 1.2 : baseCost;
  }
  
  calculateConstraintViolations(staff, periodData, date) {
    // Check for potential constraint violations
    const consecutiveDays = this.calculateConsecutiveDays(staff, periodData, date);
    const maxDays = staff.status === 'パート' ? 4 : 6;
    
    return consecutiveDays >= maxDays ? 1 : 0;
  }
}

export default ScheduleFeatureEngineer;