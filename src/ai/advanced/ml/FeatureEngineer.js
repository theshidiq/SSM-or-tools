/**
 * FeatureEngineer.js
 * 
 * Phase 3: Feature Engineering for machine learning models
 * Extracts, transforms, and creates features from scheduling data
 */

/**
 * Feature Engineering class for ML model preparation
 */
export class FeatureEngineer {
  constructor() {
    this.initialized = false;
    this.version = '1.0.0';
    
    // Feature extraction configuration
    this.config = {
      categoricalEncoding: 'oneHot', // 'oneHot', 'label', 'target'
      numericalScaling: 'standardization', // 'standardization', 'normalization', 'minMax'
      timeFeatures: true,
      patternFeatures: true,
      constraintFeatures: true,
      seasonalFeatures: true,
      workloadFeatures: true,
      preferenceFeatures: true
    };
    
    // Feature metadata
    this.featureNames = [];
    this.featureTypes = new Map();
    this.scalingParameters = new Map();
    this.encodingMappings = new Map();
    
    // Feature statistics
    this.featureStats = {
      totalFeatures: 0,
      categoricalFeatures: 0,
      numericalFeatures: 0,
      timeFeatures: 0,
      extractionTime: 0
    };
  }

  /**
   * Initialize the feature engineer
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log('🔧 Initializing Feature Engineer...');
    
    try {
      // Merge configuration
      this.config = { ...this.config, ...config };
      
      this.initialized = true;
      
      console.log('✅ Feature Engineer initialized');
      console.log(`Encoding: ${this.config.categoricalEncoding}, Scaling: ${this.config.numericalScaling}`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        config: this.config
      };
      
    } catch (error) {
      console.error('❌ Feature Engineer initialization failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract features from historical data for training
   * @param {Object} historicalData - Historical scheduling data
   * @returns {Object} Extracted features and metadata
   */
  async extractFeatures(historicalData) {
    if (!this.initialized) {
      throw new Error('Feature Engineer not initialized');
    }

    console.log('🔍 Extracting features from historical data...');
    
    try {
      const startTime = Date.now();
      
      // Initialize feature extraction
      this.featureNames = [];
      this.featureTypes.clear();
      const features = [];
      
      // Extract features for each schedule entry
      if (historicalData.scheduleData) {
        for (const [monthKey, monthData] of Object.entries(historicalData.scheduleData)) {
          for (const [staffId, staffSchedule] of Object.entries(monthData)) {
            for (const [dateKey, shiftType] of Object.entries(staffSchedule)) {
              const sampleFeatures = await this.extractSampleFeatures({
                staffId,
                dateKey,
                shiftType,
                monthData,
                staffSchedule,
                historicalData
              });
              
              features.push(sampleFeatures);
            }
          }
        }
      }
      
      // Process extracted features
      const processedFeatures = await this.processFeatures(features);
      
      const extractionTime = Date.now() - startTime;
      this.featureStats.extractionTime = extractionTime;
      this.featureStats.totalFeatures = this.featureNames.length;
      
      console.log(`✅ Feature extraction completed in ${extractionTime}ms`);
      console.log(`📊 Extracted ${this.featureNames.length} features from ${features.length} samples`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        features: processedFeatures,
        featureNames: [...this.featureNames],
        featureTypes: Object.fromEntries(this.featureTypes),
        featureStats: { ...this.featureStats },
        patterns: this.extractPatterns(features)
      };
      
    } catch (error) {
      console.error('❌ Feature extraction failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract features for prediction
   * @param {Object} params - Prediction parameters
   * @returns {Object} Prediction features
   */
  async extractPredictionFeatures(params) {
    const {
      staffMembers,
      dateRange,
      existingSchedule,
      seasonalContext
    } = params;

    console.log('🎯 Extracting features for prediction...');
    
    const features = [];
    const featureNames = [...this.featureNames]; // Use existing feature names
    
    // Extract features for each staff-date combination
    for (const staff of staffMembers) {
      for (const date of dateRange) {
        const dateKey = date.toISOString().split('T')[0];
        
        const sampleFeatures = await this.extractPredictionSampleFeatures({
          staffId: staff.id,
          staffName: staff.name,
          dateKey,
          date,
          staff,
          existingSchedule,
          seasonalContext,
          staffMembers,
          dateRange
        });
        
        features.push(sampleFeatures);
      }
    }
    
    // Process features using existing scaling/encoding parameters
    const processedFeatures = await this.processFeatures(features, true);
    
    return {
      success: true,
      features: processedFeatures,
      featureNames,
      patterns: this.extractPatterns(features)
    };
  }

  /**
   * Extract features for a single sample (training)
   * @param {Object} params - Sample parameters
   * @returns {Array} Feature vector
   */
  async extractSampleFeatures(params) {
    const {
      staffId,
      dateKey,
      shiftType,
      monthData,
      staffSchedule,
      historicalData
    } = params;
    
    const features = [];
    const date = new Date(dateKey);
    
    try {
      // 1. Time-based features
      if (this.config.timeFeatures) {
        features.push(...this.extractTimeFeatures(date, dateKey));
      }
      
      // 2. Staff features
      features.push(...this.extractStaffFeatures(staffId, historicalData));
      
      // 3. Shift pattern features
      if (this.config.patternFeatures) {
        features.push(...this.extractShiftPatternFeatures(staffSchedule, dateKey));
      }
      
      // 4. Workload features
      if (this.config.workloadFeatures) {
        features.push(...this.extractWorkloadFeatures(staffSchedule, monthData, staffId));
      }
      
      // 5. Constraint features
      if (this.config.constraintFeatures) {
        features.push(...this.extractConstraintFeatures(staffId, dateKey, monthData, historicalData));
      }
      
      // 6. Seasonal features
      if (this.config.seasonalFeatures) {
        features.push(...this.extractSeasonalFeatures(date, historicalData));
      }
      
      // 7. Preference features
      if (this.config.preferenceFeatures) {
        features.push(...this.extractPreferenceFeatures(staffId, dateKey, historicalData));
      }
      
    } catch (error) {
      console.error('❌ Sample feature extraction failed:', error);
      // Return default features on error
      return new Array(this.getExpectedFeatureCount()).fill(0);
    }
    
    return features;
  }

  /**
   * Extract features for prediction sample
   * @param {Object} params - Prediction sample parameters
   * @returns {Array} Feature vector
   */
  async extractPredictionSampleFeatures(params) {
    const {
      staffId,
      staffName,
      dateKey,
      date,
      staff,
      existingSchedule,
      seasonalContext,
      staffMembers,
      dateRange
    } = params;
    
    const features = [];
    
    try {
      // 1. Time-based features
      if (this.config.timeFeatures) {
        features.push(...this.extractTimeFeatures(date, dateKey));
      }
      
      // 2. Staff features (from current staff data)
      features.push(...this.extractStaffFeaturesFromStaff(staff));
      
      // 3. Existing schedule pattern features
      if (this.config.patternFeatures) {
        const staffSchedule = existingSchedule[staffId] || {};
        features.push(...this.extractShiftPatternFeatures(staffSchedule, dateKey));
      }
      
      // 4. Current workload features
      if (this.config.workloadFeatures) {
        features.push(...this.extractCurrentWorkloadFeatures(staffId, existingSchedule, dateRange));
      }
      
      // 5. Constraint features (current context)
      if (this.config.constraintFeatures) {
        features.push(...this.extractCurrentConstraintFeatures(staffId, dateKey, existingSchedule, staffMembers));
      }
      
      // 6. Seasonal features (from seasonal context)
      if (this.config.seasonalFeatures) {
        features.push(...this.extractCurrentSeasonalFeatures(date, seasonalContext));
      }
      
      // 7. Preference features (simplified for prediction)
      if (this.config.preferenceFeatures) {
        features.push(...this.extractCurrentPreferenceFeatures(staff, dateKey));
      }
      
    } catch (error) {
      console.error('❌ Prediction sample feature extraction failed:', error);
      return new Array(this.getExpectedFeatureCount()).fill(0);
    }
    
    return features;
  }

  /**
   * Extract time-based features
   * @param {Date} date - Date object
   * @param {string} dateKey - Date key string
   * @returns {Array} Time features
   */
  extractTimeFeatures(date, dateKey) {
    const features = [];
    
    // Day of week (0-6, Sunday = 0)
    features.push(date.getDay());
    this.addFeatureName('dayOfWeek', 'categorical');
    
    // Day of month (1-31)
    features.push(date.getDate());
    this.addFeatureName('dayOfMonth', 'numerical');
    
    // Month (0-11)
    features.push(date.getMonth());
    this.addFeatureName('month', 'categorical');
    
    // Is weekend (0 or 1)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6 ? 1 : 0;
    features.push(isWeekend);
    this.addFeatureName('isWeekend', 'binary');
    
    // Week of year
    const weekOfYear = this.getWeekOfYear(date);
    features.push(weekOfYear);
    this.addFeatureName('weekOfYear', 'numerical');
    
    // Is month start/end
    const isMonthStart = date.getDate() <= 7 ? 1 : 0;
    const isMonthEnd = date.getDate() >= 25 ? 1 : 0;
    features.push(isMonthStart, isMonthEnd);
    this.addFeatureName('isMonthStart', 'binary');
    this.addFeatureName('isMonthEnd', 'binary');
    
    return features;
  }

  /**
   * Extract staff-related features
   * @param {string} staffId - Staff ID
   * @param {Object} historicalData - Historical data
   * @returns {Array} Staff features
   */
  extractStaffFeatures(staffId, historicalData) {
    const features = [];
    
    // Staff position encoding (if available)
    const staffInfo = this.findStaffInfo(staffId, historicalData);
    
    if (staffInfo) {
      // Position type
      const positionEncoding = this.encodePosition(staffInfo.position || '');
      features.push(...positionEncoding);
      this.addFeatureName('positionType', 'categorical');
      
      // Employment type
      const employmentType = staffInfo.type === 'regular' ? 1 : 0;
      features.push(employmentType);
      this.addFeatureName('employmentType', 'binary');
      
      // Department
      const departmentEncoding = this.encodeDepartment(staffInfo.department || '');
      features.push(...departmentEncoding);
      this.addFeatureName('department', 'categorical');
    } else {
      // Default values when staff info not available
      features.push(0, 0, 0); // position, employment, department
      this.addFeatureName('positionType', 'categorical');
      this.addFeatureName('employmentType', 'binary');
      this.addFeatureName('department', 'categorical');
    }
    
    return features;
  }

  /**
   * Extract staff features from staff object (prediction)
   * @param {Object} staff - Staff object
   * @returns {Array} Staff features
   */
  extractStaffFeaturesFromStaff(staff) {
    const features = [];
    
    // Position encoding
    const positionEncoding = this.encodePosition(staff.position || '');
    features.push(...positionEncoding);
    
    // Employment type
    const employmentType = staff.type === 'regular' ? 1 : 0;
    features.push(employmentType);
    
    // Department encoding
    const departmentEncoding = this.encodeDepartment(staff.department || '');
    features.push(...departmentEncoding);
    
    return features;
  }

  /**
   * Extract shift pattern features
   * @param {Object} staffSchedule - Staff's schedule
   * @param {string} currentDateKey - Current date key
   * @returns {Array} Pattern features
   */
  extractShiftPatternFeatures(staffSchedule, currentDateKey) {
    const features = [];
    
    // Recent shift pattern (last 7 days)
    const recentShifts = this.getRecentShifts(staffSchedule, currentDateKey, 7);
    const shiftCounts = this.countShiftTypes(recentShifts);
    
    features.push(
      shiftCounts['△'] || 0, // Early shifts
      shiftCounts['○'] || 0, // Normal shifts
      shiftCounts['▽'] || 0, // Late shifts
      shiftCounts['×'] || 0  // Days off
    );
    
    this.addFeatureName('recentEarlyShifts', 'numerical');
    this.addFeatureName('recentNormalShifts', 'numerical');
    this.addFeatureName('recentLateShifts', 'numerical');
    this.addFeatureName('recentDaysOff', 'numerical');
    
    // Consecutive work days
    const consecutiveWorkDays = this.getConsecutiveWorkDays(staffSchedule, currentDateKey);
    features.push(consecutiveWorkDays);
    this.addFeatureName('consecutiveWorkDays', 'numerical');
    
    // Days since last day off
    const daysSinceLastOff = this.getDaysSinceLastDayOff(staffSchedule, currentDateKey);
    features.push(daysSinceLastOff);
    this.addFeatureName('daysSinceLastOff', 'numerical');
    
    return features;
  }

  /**
   * Extract workload features
   * @param {Object} staffSchedule - Staff's schedule
   * @param {Object} monthData - Full month data
   * @param {string} staffId - Staff ID
   * @returns {Array} Workload features
   */
  extractWorkloadFeatures(staffSchedule, monthData, staffId) {
    const features = [];
    
    // Monthly workload
    const totalWorkDays = Object.values(staffSchedule).filter(shift => shift !== '×').length;
    const totalDays = Object.keys(staffSchedule).length;
    const workRatio = totalDays > 0 ? totalWorkDays / totalDays : 0;
    
    features.push(totalWorkDays, workRatio);
    this.addFeatureName('monthlyWorkDays', 'numerical');
    this.addFeatureName('monthlyWorkRatio', 'numerical');
    
    // Relative workload compared to others
    const averageWorkDays = this.calculateAverageWorkDays(monthData);
    const relativeWorkload = averageWorkDays > 0 ? totalWorkDays / averageWorkDays : 1;
    
    features.push(relativeWorkload);
    this.addFeatureName('relativeWorkload', 'numerical');
    
    // Shift type distribution
    const shiftCounts = this.countShiftTypes(Object.values(staffSchedule));
    const totalShifts = Math.max(1, totalWorkDays);
    
    features.push(
      (shiftCounts['△'] || 0) / totalShifts, // Early shift ratio
      (shiftCounts['○'] || 0) / totalShifts, // Normal shift ratio
      (shiftCounts['▽'] || 0) / totalShifts  // Late shift ratio
    );
    
    this.addFeatureName('earlyShiftRatio', 'numerical');
    this.addFeatureName('normalShiftRatio', 'numerical');
    this.addFeatureName('lateShiftRatio', 'numerical');
    
    return features;
  }

  /**
   * Extract constraint-related features
   * @param {string} staffId - Staff ID
   * @param {string} dateKey - Date key
   * @param {Object} monthData - Month data
   * @param {Object} historicalData - Historical data
   * @returns {Array} Constraint features
   */
  extractConstraintFeatures(staffId, dateKey, monthData, historicalData) {
    const features = [];
    
    // Group membership features
    const groupMemberships = this.getStaffGroupMemberships(staffId, historicalData);
    features.push(groupMemberships.length); // Number of groups
    this.addFeatureName('groupMemberships', 'numerical');
    
    // Daily constraint pressure (how many staff are off/early on this date)
    const date = new Date(dateKey);
    const dailyOffCount = this.countDailyOffStaff(monthData, dateKey);
    features.push(dailyOffCount);
    this.addFeatureName('dailyOffCount', 'numerical');
    
    // Coverage requirements
    const coverageNeeded = this.estimateCoverageNeeded(date);
    features.push(coverageNeeded);
    this.addFeatureName('coverageNeeded', 'numerical');
    
    return features;
  }

  /**
   * Extract seasonal features
   * @param {Date} date - Date object
   * @param {Object} historicalData - Historical data
   * @returns {Array} Seasonal features
   */
  extractSeasonalFeatures(date, historicalData) {
    const features = [];
    
    // Season encoding (0-3 for spring, summer, fall, winter)
    const season = this.getSeason(date);
    features.push(season);
    this.addFeatureName('season', 'categorical');
    
    // Holiday proximity
    const isNearHoliday = this.isNearHoliday(date) ? 1 : 0;
    features.push(isNearHoliday);
    this.addFeatureName('isNearHoliday', 'binary');
    
    // Business cycle (busy/slow period)
    const businessCycle = this.getBusinessCycle(date);
    features.push(businessCycle);
    this.addFeatureName('businessCycle', 'numerical');
    
    return features;
  }

  /**
   * Extract preference features
   * @param {string} staffId - Staff ID
   * @param {string} dateKey - Date key
   * @param {Object} historicalData - Historical data
   * @returns {Array} Preference features
   */
  extractPreferenceFeatures(staffId, dateKey, historicalData) {
    const features = [];
    
    // Day of week preference
    const date = new Date(dateKey);
    const dayOfWeek = date.getDay();
    const dayOffPreference = this.getDayOffPreference(staffId, dayOfWeek, historicalData);
    
    features.push(dayOffPreference);
    this.addFeatureName('dayOffPreference', 'numerical');
    
    // Shift type preference for this day
    const shiftPreference = this.getShiftTypePreference(staffId, dayOfWeek, historicalData);
    features.push(...shiftPreference); // [early, normal, late preferences]
    
    this.addFeatureName('earlyShiftPreference', 'numerical');
    this.addFeatureName('normalShiftPreference', 'numerical');
    this.addFeatureName('lateShiftPreference', 'numerical');
    
    return features;
  }

  /**
   * Extract current workload features for prediction
   * @param {string} staffId - Staff ID
   * @param {Object} existingSchedule - Existing schedule
   * @param {Array} dateRange - Date range
   * @returns {Array} Current workload features
   */
  extractCurrentWorkloadFeatures(staffId, existingSchedule, dateRange) {
    const staffSchedule = existingSchedule[staffId] || {};
    const features = [];
    
    // Count existing assignments
    let workDays = 0;
    let totalDays = 0;
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      if (staffSchedule[dateKey] !== undefined) {
        totalDays++;
        if (staffSchedule[dateKey] !== '×') {
          workDays++;
        }
      }
    });
    
    const workRatio = totalDays > 0 ? workDays / totalDays : 0;
    
    features.push(workDays, workRatio);
    
    return features;
  }

  /**
   * Extract current constraint features for prediction
   * @param {string} staffId - Staff ID
   * @param {string} dateKey - Date key
   * @param {Object} existingSchedule - Existing schedule
   * @param {Array} staffMembers - Staff members
   * @returns {Array} Current constraint features
   */
  extractCurrentConstraintFeatures(staffId, dateKey, existingSchedule, staffMembers) {
    const features = [];
    
    // Count how many staff are already off on this date
    let dailyOffCount = 0;
    staffMembers.forEach(staff => {
      const staffSchedule = existingSchedule[staff.id] || {};
      if (staffSchedule[dateKey] === '×') {
        dailyOffCount++;
      }
    });
    
    features.push(dailyOffCount);
    
    // Estimate coverage needed (simplified)
    const date = new Date(dateKey);
    const coverageNeeded = this.estimateCoverageNeeded(date);
    features.push(coverageNeeded);
    
    return features;
  }

  /**
   * Extract current seasonal features for prediction
   * @param {Date} date - Date object
   * @param {Object} seasonalContext - Seasonal context
   * @returns {Array} Current seasonal features
   */
  extractCurrentSeasonalFeatures(date, seasonalContext) {
    const features = [];
    
    // Use seasonal context if available, otherwise extract from date
    if (seasonalContext && seasonalContext.season !== undefined) {
      features.push(seasonalContext.season);
      features.push(seasonalContext.isNearHoliday ? 1 : 0);
      features.push(seasonalContext.businessCycle || 0.5);
    } else {
      features.push(this.getSeason(date));
      features.push(this.isNearHoliday(date) ? 1 : 0);
      features.push(this.getBusinessCycle(date));
    }
    
    return features;
  }

  /**
   * Extract current preference features for prediction
   * @param {Object} staff - Staff object
   * @param {string} dateKey - Date key
   * @returns {Array} Current preference features
   */
  extractCurrentPreferenceFeatures(staff, dateKey) {
    const features = [];
    const date = new Date(dateKey);
    const dayOfWeek = date.getDay();
    
    // Simplified preference extraction for prediction
    // In practice, this would use learned preferences
    
    // Sunday preference (Sunday = 0)
    const sundayOffPreference = dayOfWeek === 0 ? 0.8 : 0.2;
    features.push(sundayOffPreference);
    
    // Default shift preferences
    features.push(0.3, 0.4, 0.3); // early, normal, late
    
    return features;
  }

  /**
   * Process extracted features (scaling, encoding)
   * @param {Array} features - Raw features
   * @param {boolean} useExistingParams - Use existing scaling parameters
   * @returns {Array} Processed features
   */
  async processFeatures(features, useExistingParams = false) {
    if (features.length === 0) return features;
    
    console.log('⚙️ Processing extracted features...');
    
    // Ensure all feature vectors have the same length
    const maxLength = Math.max(...features.map(f => f.length));
    const paddedFeatures = features.map(f => {
      const padded = [...f];
      while (padded.length < maxLength) {
        padded.push(0);
      }
      return padded;
    });
    
    // Apply scaling to numerical features
    const scaledFeatures = await this.applyScaling(paddedFeatures, useExistingParams);
    
    // Apply categorical encoding
    const encodedFeatures = await this.applyCategoricalEncoding(scaledFeatures, useExistingParams);
    
    return encodedFeatures;
  }

  /**
   * Apply scaling to numerical features
   * @param {Array} features - Feature matrix
   * @param {boolean} useExistingParams - Use existing parameters
   * @returns {Array} Scaled features
   */
  async applyScaling(features, useExistingParams) {
    if (features.length === 0) return features;
    
    const scaledFeatures = features.map(f => [...f]);
    
    // For each feature dimension
    for (let featureIdx = 0; featureIdx < features[0].length; featureIdx++) {
      const featureName = this.featureNames[featureIdx] || `feature_${featureIdx}`;
      const featureType = this.featureTypes.get(featureName) || 'numerical';
      
      // Only scale numerical features
      if (featureType === 'numerical') {
        const featureValues = features.map(f => f[featureIdx]);
        
        if (useExistingParams && this.scalingParameters.has(featureName)) {
          // Use existing parameters
          const params = this.scalingParameters.get(featureName);
          for (let sampleIdx = 0; sampleIdx < scaledFeatures.length; sampleIdx++) {
            scaledFeatures[sampleIdx][featureIdx] = this.scaleValue(
              scaledFeatures[sampleIdx][featureIdx],
              params,
              this.config.numericalScaling
            );
          }
        } else {
          // Calculate new parameters
          const params = this.calculateScalingParameters(featureValues, this.config.numericalScaling);
          this.scalingParameters.set(featureName, params);
          
          // Apply scaling
          for (let sampleIdx = 0; sampleIdx < scaledFeatures.length; sampleIdx++) {
            scaledFeatures[sampleIdx][featureIdx] = this.scaleValue(
              scaledFeatures[sampleIdx][featureIdx],
              params,
              this.config.numericalScaling
            );
          }
        }
      }
    }
    
    return scaledFeatures;
  }

  /**
   * Apply categorical encoding
   * @param {Array} features - Feature matrix
   * @param {boolean} useExistingParams - Use existing parameters
   * @returns {Array} Encoded features
   */
  async applyCategoricalEncoding(features, useExistingParams) {
    // For simplicity, return features as-is
    // In practice, would implement one-hot encoding for categorical features
    return features;
  }

  /**
   * Calculate scaling parameters
   * @param {Array} values - Feature values
   * @param {string} scalingType - Scaling type
   * @returns {Object} Scaling parameters
   */
  calculateScalingParameters(values, scalingType) {
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    
    if (validValues.length === 0) {
      return { mean: 0, std: 1, min: 0, max: 1 };
    }
    
    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    
    return { mean, std: std || 1, min, max: max || 1 };
  }

  /**
   * Scale a single value
   * @param {number} value - Value to scale
   * @param {Object} params - Scaling parameters
   * @param {string} scalingType - Scaling type
   * @returns {number} Scaled value
   */
  scaleValue(value, params, scalingType) {
    if (isNaN(value) || !isFinite(value)) return 0;
    
    switch (scalingType) {
      case 'standardization':
        return (value - params.mean) / params.std;
      case 'normalization':
      case 'minMax':
        return params.max > params.min ? 
          (value - params.min) / (params.max - params.min) : 0;
      default:
        return value;
    }
  }

  /**
   * Extract patterns from features
   * @param {Array} features - Feature matrix
   * @returns {Object} Extracted patterns
   */
  extractPatterns(features) {
    return {
      totalSamples: features.length,
      featureCount: features.length > 0 ? features[0].length : 0,
      extractedAt: new Date().toISOString()
    };
  }

  // Utility methods for feature extraction

  addFeatureName(name, type) {
    if (!this.featureNames.includes(name)) {
      this.featureNames.push(name);
      this.featureTypes.set(name, type);
      
      // Update statistics
      if (type === 'categorical') this.featureStats.categoricalFeatures++;
      else if (type === 'numerical') this.featureStats.numericalFeatures++;
      else if (type === 'time') this.featureStats.timeFeatures++;
    }
  }

  getExpectedFeatureCount() {
    // Estimate based on enabled features
    let count = 0;
    if (this.config.timeFeatures) count += 7; // Day, month, weekend, etc.
    if (this.config.patternFeatures) count += 6; // Recent shifts, consecutive days
    if (this.config.workloadFeatures) count += 6; // Work ratios, shift distributions
    if (this.config.constraintFeatures) count += 3; // Group memberships, coverage
    if (this.config.seasonalFeatures) count += 3; // Season, holiday, business cycle
    if (this.config.preferenceFeatures) count += 4; // Day off and shift preferences
    count += 3; // Staff features
    
    return count;
  }

  getWeekOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  findStaffInfo(staffId, historicalData) {
    // Search for staff info in historical data
    if (historicalData.staffMembers) {
      return historicalData.staffMembers.find(s => s.id === staffId);
    }
    return null;
  }

  encodePosition(position) {
    const positions = ['料理長', '古藤', '中田', '井関', '小池', '田辺', '岸', '与儀', 'カマル', '高野', '派遣スタッフ'];
    const index = positions.indexOf(position);
    return [index >= 0 ? index : 0];
  }

  encodeDepartment(department) {
    const departments = ['kitchen', 'service', 'management'];
    const index = departments.indexOf(department);
    return [index >= 0 ? index : 0];
  }

  getRecentShifts(staffSchedule, currentDateKey, days) {
    const currentDate = new Date(currentDateKey);
    const recentShifts = [];
    
    for (let i = 1; i <= days; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateKey = checkDate.toISOString().split('T')[0];
      
      if (staffSchedule[checkDateKey]) {
        recentShifts.push(staffSchedule[checkDateKey]);
      }
    }
    
    return recentShifts;
  }

  countShiftTypes(shifts) {
    const counts = { '△': 0, '○': 0, '▽': 0, '×': 0 };
    shifts.forEach(shift => {
      if (counts[shift] !== undefined) {
        counts[shift]++;
      }
    });
    return counts;
  }

  getConsecutiveWorkDays(staffSchedule, currentDateKey) {
    const currentDate = new Date(currentDateKey);
    let consecutiveDays = 0;
    
    for (let i = 1; i <= 14; i++) { // Check up to 14 days back
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateKey = checkDate.toISOString().split('T')[0];
      
      const shift = staffSchedule[checkDateKey];
      if (shift && shift !== '×') {
        consecutiveDays++;
      } else {
        break;
      }
    }
    
    return consecutiveDays;
  }

  getDaysSinceLastDayOff(staffSchedule, currentDateKey) {
    const currentDate = new Date(currentDateKey);
    
    for (let i = 1; i <= 30; i++) { // Check up to 30 days back
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateKey = checkDate.toISOString().split('T')[0];
      
      if (staffSchedule[checkDateKey] === '×') {
        return i;
      }
    }
    
    return 30; // More than 30 days
  }

  calculateAverageWorkDays(monthData) {
    const workDayCounts = [];
    
    Object.values(monthData).forEach(staffSchedule => {
      const workDays = Object.values(staffSchedule).filter(shift => shift !== '×').length;
      workDayCounts.push(workDays);
    });
    
    return workDayCounts.length > 0 ? 
      workDayCounts.reduce((sum, count) => sum + count, 0) / workDayCounts.length : 0;
  }

  getStaffGroupMemberships(staffId, historicalData) {
    // Simplified - would check actual group memberships
    return []; // Return array of group IDs
  }

  countDailyOffStaff(monthData, dateKey) {
    let count = 0;
    Object.values(monthData).forEach(staffSchedule => {
      if (staffSchedule[dateKey] === '×') {
        count++;
      }
    });
    return count;
  }

  estimateCoverageNeeded(date) {
    // Simplified coverage estimation based on day of week
    const dayOfWeek = date.getDay();
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
    return Math.round(8 * weekendMultiplier); // Base coverage of 8 staff
  }

  getSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 0; // Spring
    if (month >= 5 && month <= 7) return 1; // Summer
    if (month >= 8 && month <= 10) return 2; // Fall
    return 3; // Winter
  }

  isNearHoliday(date) {
    // Simplified holiday detection
    const month = date.getMonth();
    const day = date.getDate();
    
    // Check for major holidays (simplified)
    const holidays = [
      [0, 1], [1, 11], [2, 20], [3, 29], [4, 3], [4, 4], [4, 5], // New Year, etc.
      [6, 20], [8, 15], [8, 22], [9, 10], [10, 3], [10, 23], [11, 23] // Summer/Fall holidays
    ];
    
    return holidays.some(([hMonth, hDay]) => {
      const dayDiff = Math.abs((month * 30 + day) - (hMonth * 30 + hDay));
      return dayDiff <= 3; // Within 3 days of holiday
    });
  }

  getBusinessCycle(date) {
    // Simplified business cycle (0.0 = slow, 1.0 = busy)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0.8; // Weekend busy
    if (dayOfWeek >= 4) return 0.7; // Thursday-Friday busy
    return 0.5; // Weekday normal
  }

  getDayOffPreference(staffId, dayOfWeek, historicalData) {
    // Simplified preference calculation
    if (dayOfWeek === 0) return 0.8; // Sunday preference
    return 0.2; // Other days
  }

  getShiftTypePreference(staffId, dayOfWeek, historicalData) {
    // Simplified shift preferences [early, normal, late]
    if (dayOfWeek === 0) return [0.6, 0.3, 0.1]; // Sunday prefer early
    return [0.2, 0.6, 0.2]; // Other days prefer normal
  }

  /**
   * Get feature engineer status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      version: this.version,
      config: this.config,
      featureStats: { ...this.featureStats },
      totalFeatureNames: this.featureNames.length,
      scalingParameters: this.scalingParameters.size,
      encodingMappings: this.encodingMappings.size
    };
  }

  /**
   * Reset the feature engineer
   * @returns {Object} Reset result
   */
  async reset() {
    console.log('🔄 Resetting Feature Engineer...');
    
    try {
      this.initialized = false;
      this.featureNames = [];
      this.featureTypes.clear();
      this.scalingParameters.clear();
      this.encodingMappings.clear();
      
      // Reset statistics
      this.featureStats = {
        totalFeatures: 0,
        categoricalFeatures: 0,
        numericalFeatures: 0,
        timeFeatures: 0,
        extractionTime: 0
      };
      
      console.log('✅ Feature Engineer reset successfully');
      
      return {
        success: true,
        message: 'Feature Engineer reset successfully',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Feature Engineer reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}