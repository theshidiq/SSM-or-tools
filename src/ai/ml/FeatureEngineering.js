/**
 * FeatureEngineering.js
 * 
 * Converts restaurant schedule data into machine learning features
 * for TensorFlow training and inference.
 */

import { MODEL_CONFIG } from './TensorFlowConfig';

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
    
    console.log('🔧 Preparing training data from historical schedules...');
    
    // Process each period
    Object.entries(allHistoricalData).forEach(([periodIndex, periodData]) => {
      if (!periodData || !periodData.schedule) return;
      
      const { schedule, dateRange } = periodData;
      
      // Process each staff member
      staffMembers.forEach(staff => {
        if (!schedule[staff.id]) return;
        
        // Process each date for this staff member
        dateRange.forEach((date, dateIndex) => {
          const dateKey = date.toISOString().split('T')[0];
          const actualShift = schedule[staff.id][dateKey];
          
          // Skip if no actual shift data (can't learn from missing data)
          if (actualShift === undefined || actualShift === null) return;
          
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
          }
        });
      });
    });
    
    console.log(`✅ Generated ${features.length} training samples`);
    
    return {
      features: features,
      labels: labels,
      featureNames: this.featureNames
    };
  }
  
  /**
   * Generate feature vector for a specific staff-date combination
   */
  generateFeatures({ staff, date, dateIndex, periodData, allHistoricalData, staffMembers }) {
    const features = new Array(MODEL_CONFIG.INPUT_FEATURES.TOTAL).fill(0);
    let idx = 0;
    
    try {
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
    
    Object.values(allHistoricalData).forEach(periodData => {
      if (!periodData?.schedule?.[staff.id]) return;
      
      Object.values(periodData.schedule[staff.id]).forEach(shift => {
        total++;
        switch (shift) {
          case '△': earlyCount++; break;
          case '○': case '': normalCount++; break;
          case '▽': lateCount++; break;
          case '×': offCount++; break;
        }
      });
    });
    
    if (total === 0) {
      return {
        earlyFreq: 0, normalFreq: 0.5, lateFreq: 0, offFreq: 0.3,
        avgWeeklyHours: 20, consistency: 0.5, workloadTrend: 0,
        preferenceStrength: 0.5, stability: 0.5
      };
    }
    
    return {
      earlyFreq: earlyCount / total,
      normalFreq: normalCount / total,
      lateFreq: lateCount / total,
      offFreq: offCount / total,
      avgWeeklyHours: ((total - offCount) / total) * 40,
      consistency: this.calculateConsistency(staff, allHistoricalData),
      workloadTrend: periods > 1 ? Math.random() * 0.2 - 0.1 : 0, // Placeholder
      preferenceStrength: Math.max(earlyCount, normalCount, lateCount) / total,
      stability: 0.7 // Placeholder
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
  
  // Additional utility functions (simplified implementations)
  calculateConsecutiveDays(staff, periodData, currentDate) {
    if (!periodData?.schedule?.[staff.id]) return 0;
    
    let consecutive = 0;
    const schedule = periodData.schedule[staff.id];
    
    for (let i = 1; i <= 10; i++) {
      const pastDate = new Date(currentDate);
      pastDate.setDate(pastDate.getDate() - i);
      const dateKey = pastDate.toISOString().split('T')[0];
      
      if (schedule[dateKey] && schedule[dateKey] !== '×') {
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
    return shift && shift !== '×' ? 1 : 0;
  }
  
  getSameDayLastMonth(staff, allHistoricalData, currentDate) {
    // Simple implementation - check if worked same day in previous periods
    return Math.random() > 0.5 ? 1 : 0; // Placeholder
  }
  
  calculateBusinessLevel(date, periodData) {
    // Business level based on day of week (weekends busier)
    const dayOfWeek = date.getDay();
    return (dayOfWeek === 0 || dayOfWeek === 6) ? 80 : 60;
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