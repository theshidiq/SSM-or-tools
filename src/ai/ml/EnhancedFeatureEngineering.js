/**
 * EnhancedFeatureEngineering.js
 *
 * Advanced feature engineering that goes beyond basic patterns to capture
 * complex relationships, business context, and predictive signals.
 *
 * New Features Added:
 * - Staff relationship networks and collaboration patterns
 * - Advanced seasonal and business cycle analysis
 * - Workload balancing and fairness metrics
 * - Management strategy and operational context
 * - Predictive lag features and time series patterns
 */

import { ScheduleFeatureEngineer } from "./FeatureEngineering";
import { MODEL_CONFIG } from "./TensorFlowConfig";
import { optimizedFeatureManager } from "../../workers/OptimizedFeatureManager.js";

export class EnhancedFeatureEngineering extends ScheduleFeatureEngineer {
  constructor() {
    super();
    this.enhancedFeatureCount = 65; // Total enhanced features
    this.initializeEnhancedFeatures();

    // Caches for expensive computations
    this.staffRelationshipCache = new Map();
    this.seasonalPatternCache = new Map();
    this.workloadBalanceCache = new Map();
    
    // Performance optimization flags
    this.useOptimizedWorker = true;
    this.performanceTarget = 50; // ms per prediction
    this.optimizationInitialized = false;
  }

  /**
   * Initialize enhanced feature names for debugging
   */
  initializeEnhancedFeatures() {
    this.enhancedFeatureNames = [
      // Original features (35) - from base class
      ...this.featureNames,

      // Staff Relationship Features (10)
      "staff_network_centrality",
      "preferred_coworkers_available",
      "team_chemistry_score",
      "supervision_level",
      "training_mentoring_load",
      "conflict_avoidance_factor",
      "collaboration_frequency",
      "skill_complementarity",
      "experience_balance",
      "leadership_responsibility",

      // Advanced Seasonal Features (8)
      "detailed_seasonal_trend",
      "monthly_business_cycle",
      "weekly_pattern_strength",
      "holiday_proximity_effect",
      "weather_impact_factor",
      "local_event_influence",
      "tourism_season_effect",
      "economic_cycle_position",

      // Workload Balancing Features (7)
      "current_period_workload_relative",
      "fairness_adjustment_factor",
      "overtime_risk_score",
      "burnout_prevention_factor",
      "cross_training_opportunity",
      "skill_development_weight",
      "performance_based_adjustment",

      // Predictive Time Series Features (5)
      "lag_1_same_weekday",
      "lag_2_same_weekday",
      "momentum_indicator",
      "trend_acceleration",
      "pattern_stability_score",
    ];

    console.log(
      `🚀 Enhanced Feature Engineering: ${this.enhancedFeatureNames.length} total features`,
    );
  }

  /**
   * Generate enhanced feature vector with sophisticated analysis
   * OPTIMIZED for <50ms per prediction using Web Worker
   */
  async generateEnhancedFeaturesOptimized({
    staff,
    date,
    dateIndex,
    periodData,
    allHistoricalData,
    staffMembers,
  }) {
    const startTime = performance.now();
    
    try {
      // Initialize optimized worker if needed
      if (this.useOptimizedWorker && !this.optimizationInitialized) {
        await optimizedFeatureManager.initialize();
        this.optimizationInitialized = true;
        console.log('⚡ Optimized feature generation initialized');
      }
      
      // Use optimized worker for feature generation
      if (this.useOptimizedWorker && this.optimizationInitialized) {
        const result = await optimizedFeatureManager.generateFeatures({
          staff,
          date,
          dateIndex,
          periodData,
          allHistoricalData,
          staffMembers
        });
        
        const totalTime = performance.now() - startTime;
        
        if (result.success) {
          console.log(
            `⚡ OPTIMIZED features generated in ${totalTime.toFixed(1)}ms (worker: ${result.executionTime.toFixed(1)}ms)`
          );
          return result.features;
        } else {
          console.warn('⚠️ Optimized worker failed, falling back to sync method');
        }
      }
      
      // Fallback to synchronous method
      return this.generateEnhancedFeatures({
        staff,
        date,
        dateIndex,
        periodData,
        allHistoricalData,
        staffMembers,
      });
      
    } catch (error) {
      console.error('❌ Error in optimized feature generation:', error);
      // Fallback to synchronous method
      return this.generateEnhancedFeatures({
        staff,
        date,
        dateIndex,
        periodData,
        allHistoricalData,
        staffMembers,
      });
    }
  }

  /**
   * Generate enhanced feature vector with sophisticated analysis
   * LEGACY synchronous method (kept for fallback)
   */
  generateEnhancedFeatures({
    staff,
    date,
    dateIndex,
    periodData,
    allHistoricalData,
    staffMembers,
  }) {
    const totalFeatures = this.enhancedFeatureCount;
    const features = new Array(totalFeatures).fill(0);
    let idx = 0;

    try {
      console.log(
        `🔧 Generating ${totalFeatures} enhanced features for ${staff.name} on ${date.toISOString().split("T")[0]}`,
      );

      // ========================================
      // ORIGINAL FEATURES (35) - Use base implementation
      // ========================================
      const baseFeatures = super.generateFeatures({
        staff,
        date,
        dateIndex,
        periodData,
        allHistoricalData,
        staffMembers,
      });

      if (!baseFeatures) {
        console.error("❌ Failed to generate base features");
        return null;
      }

      // Copy base features
      for (let i = 0; i < baseFeatures.length && i < 35; i++) {
        features[idx++] = baseFeatures[i];
      }

      // Ensure we're at the right index
      idx = 35;

      // ========================================
      // STAFF RELATIONSHIP FEATURES (10)
      // ========================================
      const relationshipFeatures = this.generateStaffRelationshipFeatures(
        staff,
        date,
        staffMembers,
        periodData,
        allHistoricalData,
      );
      for (let i = 0; i < 10; i++) {
        features[idx++] = relationshipFeatures[i] || 0;
      }

      // ========================================
      // ADVANCED SEASONAL FEATURES (8)
      // ========================================
      const seasonalFeatures = this.generateAdvancedSeasonalFeatures(
        date,
        periodData,
        allHistoricalData,
      );
      for (let i = 0; i < 8; i++) {
        features[idx++] = seasonalFeatures[i] || 0;
      }

      // ========================================
      // WORKLOAD BALANCING FEATURES (7)
      // ========================================
      const workloadFeatures = this.generateWorkloadBalancingFeatures(
        staff,
        date,
        staffMembers,
        periodData,
        allHistoricalData,
      );
      for (let i = 0; i < 7; i++) {
        features[idx++] = workloadFeatures[i] || 0;
      }

      // ========================================
      // PREDICTIVE TIME SERIES FEATURES (5)
      // ========================================
      const timeSeriesFeatures = this.generatePredictiveTimeSeriesFeatures(
        staff,
        date,
        dateIndex,
        periodData,
        allHistoricalData,
      );
      for (let i = 0; i < 5; i++) {
        features[idx++] = timeSeriesFeatures[i] || 0;
      }

      // ========================================
      // VALIDATION AND CLEANUP
      // ========================================

      // Validate feature count
      if (idx !== totalFeatures) {
        console.warn(
          `⚠️ Enhanced feature count mismatch: generated ${idx}, expected ${totalFeatures}`,
        );
        while (features.length < totalFeatures) features.push(0);
        while (features.length > totalFeatures) features.pop();
      }

      // Validate no NaN or infinite values
      for (let i = 0; i < features.length; i++) {
        if (!isFinite(features[i])) {
          console.warn(
            `⚠️ Invalid enhanced feature at index ${i} (${this.enhancedFeatureNames[i]}): ${features[i]}`,
          );
          features[i] = 0;
        }
      }

      console.log(
        `✅ Generated ${features.length} enhanced features successfully`,
      );
      return features;
    } catch (error) {
      console.error("❌ Error generating enhanced features:", error);
      return null;
    }
  }

  /**
   * Generate staff relationship and network features
   */
  generateStaffRelationshipFeatures(
    staff,
    date,
    staffMembers,
    periodData,
    allHistoricalData,
  ) {
    const features = new Array(10).fill(0);
    const cacheKey = `${staff.id}_${date.toDateString()}`;

    // Check cache first
    if (this.staffRelationshipCache.has(cacheKey)) {
      return this.staffRelationshipCache.get(cacheKey);
    }

    try {
      // 1. Staff Network Centrality - how central this staff is in the network
      features[0] = this.calculateStaffNetworkCentrality(
        staff,
        staffMembers,
        allHistoricalData,
      );

      // 2. Preferred Coworkers Available - are their usual teammates working?
      features[1] = this.calculatePreferredCoworkersAvailability(
        staff,
        date,
        staffMembers,
        periodData,
      );

      // 3. Team Chemistry Score - how well this person works with others
      features[2] = this.calculateTeamChemistryScore(
        staff,
        staffMembers,
        allHistoricalData,
      );

      // 4. Supervision Level - management/supervision responsibilities
      features[3] = this.calculateSupervisionLevel(staff, staffMembers);

      // 5. Training/Mentoring Load - teaching responsibilities
      features[4] = this.calculateTrainingMentoringLoad(
        staff,
        staffMembers,
        date,
      );

      // 6. Conflict Avoidance Factor - avoiding problematic combinations
      features[5] = this.calculateConflictAvoidanceFactor(
        staff,
        date,
        staffMembers,
        periodData,
      );

      // 7. Collaboration Frequency - how often they work with others
      features[6] = this.calculateCollaborationFrequency(
        staff,
        allHistoricalData,
      );

      // 8. Skill Complementarity - how their skills complement others
      features[7] = this.calculateSkillComplementarity(staff, staffMembers);

      // 9. Experience Balance - balancing experience levels
      features[8] = this.calculateExperienceBalance(
        staff,
        date,
        staffMembers,
        periodData,
      );

      // 10. Leadership Responsibility - leadership and responsibility factors
      features[9] = this.calculateLeadershipResponsibility(
        staff,
        date,
        staffMembers,
      );

      // Cache the result
      this.staffRelationshipCache.set(cacheKey, features);
    } catch (error) {
      console.warn("⚠️ Error in staff relationship features:", error);
    }

    return features;
  }

  /**
   * Generate advanced seasonal and business cycle features
   */
  generateAdvancedSeasonalFeatures(date, periodData, allHistoricalData) {
    const features = new Array(8).fill(0);
    const cacheKey = date.toDateString();

    if (this.seasonalPatternCache.has(cacheKey)) {
      return this.seasonalPatternCache.get(cacheKey);
    }

    try {
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();
      const dayOfWeek = date.getDay();

      // 1. Detailed Seasonal Trend - more sophisticated than basic season
      features[0] = this.calculateDetailedSeasonalTrend(month, dayOfMonth);

      // 2. Monthly Business Cycle - different from just season
      features[1] = this.calculateMonthlyBusinessCycle(
        month,
        allHistoricalData,
      );

      // 3. Weekly Pattern Strength - how strong is the weekly pattern
      features[2] = this.calculateWeeklyPatternStrength(
        dayOfWeek,
        allHistoricalData,
      );

      // 4. Holiday Proximity Effect - influence of nearby holidays
      features[3] = this.calculateHolidayProximityEffect(date);

      // 5. Weather Impact Factor - seasonal weather effects on business
      features[4] = this.calculateWeatherImpactFactor(month, dayOfWeek);

      // 6. Local Event Influence - local events and festivals
      features[5] = this.calculateLocalEventInfluence(date);

      // 7. Tourism Season Effect - tourism impact on restaurant business
      features[6] = this.calculateTourismSeasonEffect(month, dayOfWeek);

      // 8. Economic Cycle Position - position in broader economic cycle
      features[7] = this.calculateEconomicCyclePosition(date);

      this.seasonalPatternCache.set(cacheKey, features);
    } catch (error) {
      console.warn("⚠️ Error in seasonal features:", error);
    }

    return features;
  }

  /**
   * Generate workload balancing and fairness features
   */
  generateWorkloadBalancingFeatures(
    staff,
    date,
    staffMembers,
    periodData,
    allHistoricalData,
  ) {
    const features = new Array(7).fill(0);

    try {
      // 1. Current Period Workload Relative - compared to others
      features[0] = this.calculateCurrentPeriodWorkloadRelative(
        staff,
        staffMembers,
        periodData,
      );

      // 2. Fairness Adjustment Factor - ensuring fair distribution
      features[1] = this.calculateFairnessAdjustmentFactor(
        staff,
        staffMembers,
        periodData,
        allHistoricalData,
      );

      // 3. Overtime Risk Score - risk of overwork
      features[2] = this.calculateOvertimeRiskScore(staff, date, periodData);

      // 4. Burnout Prevention Factor - preventing staff burnout
      features[3] = this.calculateBurnoutPreventionFactor(
        staff,
        periodData,
        allHistoricalData,
      );

      // 5. Cross-Training Opportunity - opportunity for skill development
      features[4] = this.calculateCrossTrainingOpportunity(
        staff,
        date,
        staffMembers,
      );

      // 6. Skill Development Weight - emphasis on developing skills
      features[5] = this.calculateSkillDevelopmentWeight(
        staff,
        date,
        staffMembers,
      );

      // 7. Performance Based Adjustment - adjustments based on performance
      features[6] = this.calculatePerformanceBasedAdjustment(
        staff,
        allHistoricalData,
      );
    } catch (error) {
      console.warn("⚠️ Error in workload balancing features:", error);
    }

    return features;
  }

  /**
   * Generate predictive time series features
   */
  generatePredictiveTimeSeriesFeatures(
    staff,
    date,
    dateIndex,
    periodData,
    allHistoricalData,
  ) {
    const features = new Array(5).fill(0);

    try {
      // 1. Lag 1 Same Weekday - same day of week, 1 week ago
      features[0] = this.getLagSameWeekday(staff, date, periodData, 1);

      // 2. Lag 2 Same Weekday - same day of week, 2 weeks ago
      features[1] = this.getLagSameWeekday(staff, date, periodData, 2);

      // 3. Momentum Indicator - direction of recent changes
      features[2] = this.calculateMomentumIndicator(staff, date, periodData);

      // 4. Trend Acceleration - acceleration of trends
      features[3] = this.calculateTrendAcceleration(
        staff,
        date,
        periodData,
        allHistoricalData,
      );

      // 5. Pattern Stability Score - how stable are the patterns
      features[4] = this.calculatePatternStabilityScore(
        staff,
        allHistoricalData,
      );
    } catch (error) {
      console.warn("⚠️ Error in time series features:", error);
    }

    return features;
  }

  // ========================================
  // DETAILED IMPLEMENTATION OF FEATURE CALCULATIONS
  // ========================================

  calculateStaffNetworkCentrality(staff, staffMembers, allHistoricalData) {
    // Calculate how central this staff member is in the collaboration network
    let collaborationCount = 0;
    let totalPossibleCollaborations = 0;

    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData.schedule) return;

      const staffSchedule = periodData.schedule[staff.id];
      if (!staffSchedule) return;

      Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
        if (shift && shift !== "×") {
          // Count other staff working on same day
          const otherStaffWorking = staffMembers.filter(
            (s) =>
              s.id !== staff.id &&
              periodData.schedule[s.id] &&
              periodData.schedule[s.id][dateKey] &&
              periodData.schedule[s.id][dateKey] !== "×",
          ).length;

          collaborationCount += otherStaffWorking;
          totalPossibleCollaborations += staffMembers.length - 1;
        }
      });
    });

    return totalPossibleCollaborations > 0
      ? collaborationCount / totalPossibleCollaborations
      : 0.5;
  }

  calculatePreferredCoworkersAvailability(
    staff,
    date,
    staffMembers,
    periodData,
  ) {
    // Find preferred coworkers based on historical patterns
    const dateKey = date.toISOString().split("T")[0];
    const preferredCoworkers = this.findPreferredCoworkers(
      staff,
      staffMembers,
      periodData,
    );

    if (preferredCoworkers.length === 0) return 0.5;

    const availablePreferred = preferredCoworkers.filter((coworker) => {
      const coworkerSchedule = periodData.schedule[coworker.id];
      return (
        coworkerSchedule &&
        coworkerSchedule[dateKey] !== undefined &&
        coworkerSchedule[dateKey] !== "×"
      );
    }).length;

    return availablePreferred / preferredCoworkers.length;
  }

  calculateTeamChemistryScore(staff, staffMembers, allHistoricalData) {
    // Measure how well this staff works in teams
    let positiveInteractions = 0;
    let totalInteractions = 0;

    // Simplified team chemistry based on consistent coworker patterns
    Object.values(allHistoricalData).forEach((periodData) => {
      if (!periodData.schedule || !periodData.schedule[staff.id]) return;

      Object.entries(periodData.schedule[staff.id]).forEach(
        ([dateKey, shift]) => {
          if (shift && shift !== "×") {
            const coworkers = staffMembers.filter(
              (s) =>
                s.id !== staff.id &&
                periodData.schedule[s.id] &&
                periodData.schedule[s.id][dateKey] &&
                periodData.schedule[s.id][dateKey] !== "×",
            );

            totalInteractions++;
            if (coworkers.length >= 2) {
              // Good team size
              positiveInteractions++;
            }
          }
        },
      );
    });

    return totalInteractions > 0
      ? positiveInteractions / totalInteractions
      : 0.7;
  }

  calculateDetailedSeasonalTrend(month, dayOfMonth) {
    // More sophisticated seasonal analysis
    let seasonalScore = 0;

    // New Year season (high activity)
    if (month === 12 && dayOfMonth >= 20) seasonalScore = 0.9;
    else if (month === 1 && dayOfMonth <= 10) seasonalScore = 0.9;
    // Golden Week (Japan)
    else if (month === 4 && dayOfMonth >= 25) seasonalScore = 0.8;
    else if (month === 5 && dayOfMonth <= 10) seasonalScore = 0.8;
    // Summer vacation season
    else if (month >= 7 && month <= 8) seasonalScore = 0.85;
    // Holiday season buildup
    else if (month === 12) seasonalScore = 0.8;
    // Regular seasons
    else if (month >= 3 && month <= 5)
      seasonalScore = 0.6; // Spring
    else if (month >= 6 && month <= 8)
      seasonalScore = 0.75; // Summer
    else if (month >= 9 && month <= 11)
      seasonalScore = 0.65; // Fall
    else seasonalScore = 0.7; // Winter

    return seasonalScore;
  }

  calculateCurrentPeriodWorkloadRelative(staff, staffMembers, periodData) {
    if (!periodData.schedule) return 0.5;

    // Calculate this staff's workload
    const staffSchedule = periodData.schedule[staff.id];
    if (!staffSchedule) return 0.5;

    const staffWorkDays = Object.values(staffSchedule).filter(
      (shift) => shift && shift !== "×",
    ).length;

    // Calculate average workload of similar staff (same status)
    const similarStaff = staffMembers.filter(
      (s) => s.status === staff.status && s.id !== staff.id,
    );

    if (similarStaff.length === 0) return 0.5;

    let totalSimilarWorkDays = 0;
    let validSimilarStaff = 0;

    similarStaff.forEach((s) => {
      const similarSchedule = periodData.schedule[s.id];
      if (similarSchedule) {
        const workDays = Object.values(similarSchedule).filter(
          (shift) => shift && shift !== "×",
        ).length;
        totalSimilarWorkDays += workDays;
        validSimilarStaff++;
      }
    });

    if (validSimilarStaff === 0) return 0.5;

    const avgSimilarWorkDays = totalSimilarWorkDays / validSimilarStaff;

    // Return relative workload (normalized)
    return avgSimilarWorkDays > 0
      ? Math.min(1, staffWorkDays / avgSimilarWorkDays / 1.5)
      : 0.5;
  }

  // Additional helper methods would be implemented similarly...
  // For brevity, implementing a few key ones:

  findPreferredCoworkers(staff, staffMembers, periodData) {
    // Simple implementation - could be more sophisticated
    return staffMembers.filter((s) => s.id !== staff.id).slice(0, 3);
  }

  getLagSameWeekday(staff, date, periodData, weeksBack) {
    const lagDate = new Date(date);
    lagDate.setDate(lagDate.getDate() - 7 * weeksBack);
    const lagDateKey = lagDate.toISOString().split("T")[0];

    if (periodData.schedule && periodData.schedule[staff.id]) {
      const lagShift = periodData.schedule[staff.id][lagDateKey];
      return lagShift && lagShift !== "×" ? 1 : 0;
    }

    return 0;
  }

  calculateMomentumIndicator(staff, date, periodData) {
    // Look at past 3 days to determine momentum
    let workDays = 0;
    for (let i = 1; i <= 3; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - i);
      const pastDateKey = pastDate.toISOString().split("T")[0];

      if (
        periodData.schedule &&
        periodData.schedule[staff.id] &&
        periodData.schedule[staff.id][pastDateKey] &&
        periodData.schedule[staff.id][pastDateKey] !== "×"
      ) {
        workDays++;
      }
    }

    return workDays / 3; // 0 = no work momentum, 1 = full work momentum
  }

  // Placeholder implementations for remaining methods
  calculateSupervisionLevel(staff, staffMembers) {
    return staff.status === "社員" ? 0.8 : 0.2;
  }
  calculateTrainingMentoringLoad(staff, staffMembers, date) {
    return 0.3;
  }
  calculateConflictAvoidanceFactor(staff, date, staffMembers, periodData) {
    return 0.8;
  }
  calculateCollaborationFrequency(staff, allHistoricalData) {
    return 0.6;
  }
  calculateSkillComplementarity(staff, staffMembers) {
    return 0.7;
  }
  calculateExperienceBalance(staff, date, staffMembers, periodData) {
    return 0.6;
  }
  calculateLeadershipResponsibility(staff, date, staffMembers) {
    return staff.status === "社員" ? 0.7 : 0.3;
  }
  calculateMonthlyBusinessCycle(month, allHistoricalData) {
    return 0.6;
  }
  calculateWeeklyPatternStrength(dayOfWeek, allHistoricalData) {
    return dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 0.6;
  }
  calculateHolidayProximityEffect(date) {
    return 0.5;
  }
  calculateWeatherImpactFactor(month, dayOfWeek) {
    return 0.5;
  }
  calculateLocalEventInfluence(date) {
    return 0.4;
  }
  calculateTourismSeasonEffect(month, dayOfWeek) {
    return month >= 7 && month <= 8 ? 0.8 : 0.5;
  }
  calculateEconomicCyclePosition(date) {
    return 0.6;
  }
  calculateFairnessAdjustmentFactor(
    staff,
    staffMembers,
    periodData,
    allHistoricalData,
  ) {
    return 0.7;
  }
  calculateOvertimeRiskScore(staff, date, periodData) {
    return 0.3;
  }
  calculateBurnoutPreventionFactor(staff, periodData, allHistoricalData) {
    return 0.8;
  }
  calculateCrossTrainingOpportunity(staff, date, staffMembers) {
    return 0.4;
  }
  calculateSkillDevelopmentWeight(staff, date, staffMembers) {
    return 0.5;
  }
  calculatePerformanceBasedAdjustment(staff, allHistoricalData) {
    return 0.6;
  }
  calculateTrendAcceleration(staff, date, periodData, allHistoricalData) {
    return 0.4;
  }
  calculatePatternStabilityScore(staff, allHistoricalData) {
    return 0.7;
  }

  /**
   * Generate features in batch for multiple predictions with progress tracking
   */
  async generateFeaturesBatch(predictions, onProgress) {
    if (!this.useOptimizedWorker) {
      // Fallback to synchronous batch processing
      return this.generateFeaturesBatchSync(predictions, onProgress);
    }
    
    try {
      if (!this.optimizationInitialized) {
        await optimizedFeatureManager.initialize();
        this.optimizationInitialized = true;
      }
      
      console.log(`🚀 Starting OPTIMIZED batch feature generation for ${predictions.length} predictions`);
      
      const result = await optimizedFeatureManager.generateFeaturesBatch(
        predictions,
        (progress) => {
          if (onProgress) {
            onProgress({
              completed: progress.completed,
              total: progress.total,
              percentage: progress.percentage,
              message: `Generated features for ${progress.completed}/${progress.total} predictions (${progress.percentage}%)`
            });
          }
        }
      );
      
      console.log(`✅ OPTIMIZED batch completed in ${result.totalTime.toFixed(1)}ms`);
      console.log(`📊 Average: ${result.avgTimePerPrediction.toFixed(1)}ms per prediction`);
      
      // Log performance stats
      optimizedFeatureManager.logPerformanceSummary();
      
      return result.results.map(r => r.features);
      
    } catch (error) {
      console.error('❌ Optimized batch processing failed:', error);
      console.log('⚠️ Falling back to synchronous batch processing');
      return this.generateFeaturesBatchSync(predictions, onProgress);
    }
  }
  
  /**
   * Synchronous batch feature generation (fallback)
   */
  generateFeaturesBatchSync(predictions, onProgress) {
    console.log(`🔄 Starting synchronous batch feature generation for ${predictions.length} predictions`);
    const startTime = performance.now();
    const results = [];
    
    for (let i = 0; i < predictions.length; i++) {
      const features = this.generateEnhancedFeatures(predictions[i]);
      results.push(features);
      
      if (onProgress && (i + 1) % 10 === 0) {
        onProgress({
          completed: i + 1,
          total: predictions.length,
          percentage: ((i + 1) / predictions.length * 100).toFixed(1),
          message: `Generated features for ${i + 1}/${predictions.length} predictions`
        });
      }
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Synchronous batch completed in ${totalTime.toFixed(1)}ms`);
    console.log(`📊 Average: ${(totalTime / predictions.length).toFixed(1)}ms per prediction`);
    
    return results;
  }

  /**
   * Override the prepare training data method to use enhanced features
   */
  async prepareTrainingDataOptimized(allHistoricalData, staffMembers) {
    const features = [];
    const labels = [];
    const sampleMetadata = [];

    console.log(
      "🚀 Preparing OPTIMIZED ENHANCED training data with sophisticated features...",
    );
    console.log(
      `📁 Processing ${Object.keys(allHistoricalData).length} historical periods`,
    );
    console.log(`👥 Processing ${staffMembers.length} staff members`);

    let totalSamples = 0;
    let validSamples = 0;
    let invalidSamples = 0;
    
    // Collect all prediction requests for batch processing
    const batchRequests = [];

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

      // Process each staff member
      staffMembers.forEach((staff) => {
        if (!schedule[staff.id]) {
          console.log(
            `ℹ️ No schedule data for staff ${staff.name} (${staff.id}) in period ${periodIndex}`,
          );
          return;
        }

        const staffSchedule = schedule[staff.id];

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

          // Add to batch request
          batchRequests.push({
            staff,
            date,
            dateIndex,
            periodData,
            allHistoricalData,
            staffMembers,
            metadata: {
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              period: periodIndex,
              actualShift,
              isPartTime: staff.status === "パート",
              enhanced: true,
            }
          });
        });
      });
    });
    
    console.log(`🔄 Processing ${batchRequests.length} feature requests in optimized batch mode`);
    
    // Process batch with progress tracking
    const batchFeatures = await this.generateFeaturesBatch(
      batchRequests,
      (progress) => {
        console.log(`📊 Training data progress: ${progress.message}`);
      }
    );
    
    // Process results and create training data
    for (let i = 0; i < batchRequests.length; i++) {
      const request = batchRequests[i];
      const featureVector = batchFeatures[i];
      const label = this.shiftToLabel(request.metadata.actualShift, request.staff);
      
      if (featureVector && label !== null) {
        features.push(featureVector);
        labels.push(label);
        sampleMetadata.push({
          ...request.metadata,
          label
        });
        validSamples++;
      } else {
        console.warn(
          `⚠️ Invalid enhanced feature/label for ${request.staff.name} on ${request.metadata.date}`,
        );
        invalidSamples++;
      }
    }

    console.log(`✅ OPTIMIZED ENHANCED training data preparation completed:`);
    console.log(`  - Total samples processed: ${totalSamples}`);
    console.log(`  - Valid ENHANCED samples generated: ${validSamples}`);
    console.log(`  - Invalid/skipped samples: ${invalidSamples}`);
    console.log(
      `  - Success rate: ${((validSamples / totalSamples) * 100).toFixed(1)}%`,
    );

    // Validate feature consistency
    if (features.length > 0) {
      const featureLength = features[0].length;
      const expectedLength = this.enhancedFeatureCount;
      console.log(
        `🔍 OPTIMIZED ENHANCED feature validation: ${featureLength} features per sample (expected: ${expectedLength})`,
      );

      if (featureLength !== expectedLength) {
        console.error(
          `❌ OPTIMIZED ENHANCED feature length mismatch! This will cause training failures.`,
        );
      } else {
        console.log(`✅ OPTIMIZED ENHANCED features are correctly sized!`);
      }
    }

    return {
      features: features,
      labels: labels,
      featureNames: this.enhancedFeatureNames,
      metadata: sampleMetadata,
      stats: {
        totalSamples,
        validSamples,
        invalidSamples,
        successRate: validSamples / totalSamples,
      },
      enhanced: true,
      optimized: true,
      featureCount: this.enhancedFeatureCount,
    };
  }
  
  /**
   * Override the prepare training data method to use enhanced features
   */
  prepareTrainingData(allHistoricalData, staffMembers) {
    const features = [];
    const labels = [];
    const sampleMetadata = [];

    console.log(
      "🚀 Preparing ENHANCED training data with sophisticated features...",
    );
    console.log(
      `📁 Processing ${Object.keys(allHistoricalData).length} historical periods`,
    );
    console.log(`👥 Processing ${staffMembers.length} staff members`);

    let totalSamples = 0;
    let validSamples = 0;
    let invalidSamples = 0;

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

      // Process each staff member
      staffMembers.forEach((staff) => {
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

          // Generate ENHANCED features for this staff-date combination
          const featureVector = this.generateEnhancedFeatures({
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
              enhanced: true,
            });
            validSamples++;
            staffSamples++;
          } else {
            console.warn(
              `⚠️ Invalid enhanced feature/label for ${staff.name} on ${dateKey}: shift="${actualShift}", label=${label}`,
            );
            invalidSamples++;
          }
        });

        console.log(
          `📊 Staff ${staff.name}: ${staffSamples} ENHANCED training samples`,
        );
      });
    });

    console.log(`✅ ENHANCED training data preparation completed:`);
    console.log(`  - Total samples processed: ${totalSamples}`);
    console.log(`  - Valid ENHANCED samples generated: ${validSamples}`);
    console.log(`  - Invalid/skipped samples: ${invalidSamples}`);
    console.log(
      `  - Success rate: ${((validSamples / totalSamples) * 100).toFixed(1)}%`,
    );

    // Validate feature consistency
    if (features.length > 0) {
      const featureLength = features[0].length;
      const expectedLength = this.enhancedFeatureCount;
      console.log(
        `🔍 ENHANCED feature validation: ${featureLength} features per sample (expected: ${expectedLength})`,
      );

      if (featureLength !== expectedLength) {
        console.error(
          `❌ ENHANCED feature length mismatch! This will cause training failures.`,
        );
      } else {
        console.log(`✅ ENHANCED features are correctly sized!`);
      }
    }

    return {
      features: features,
      labels: labels,
      featureNames: this.enhancedFeatureNames,
      metadata: sampleMetadata,
      stats: {
        totalSamples,
        validSamples,
        invalidSamples,
        successRate: validSamples / totalSamples,
      },
      enhanced: true,
      featureCount: this.enhancedFeatureCount,
    };
  }

  /**
   * Clear caches to prevent memory buildup
   */
  async clearCaches() {
    this.staffRelationshipCache.clear();
    this.seasonalPatternCache.clear();
    this.workloadBalanceCache.clear();
    
    // Clear optimized worker cache
    if (this.optimizationInitialized) {
      try {
        await optimizedFeatureManager.clearCache();
      } catch (error) {
        console.warn('⚠️ Failed to clear optimized worker cache:', error);
      }
    }
    
    console.log("🧹 Enhanced feature engineering caches cleared");
  }

  /**
   * Get cache statistics including optimized worker performance
   */
  getCacheStats() {
    const baseStats = {
      staffRelationshipCache: this.staffRelationshipCache.size,
      seasonalPatternCache: this.seasonalPatternCache.size,
      workloadBalanceCache: this.workloadBalanceCache.size,
      totalCached:
        this.staffRelationshipCache.size +
        this.seasonalPatternCache.size +
        this.workloadBalanceCache.size,
    };
    
    // Add optimized worker performance stats
    if (this.optimizationInitialized) {
      const performanceStats = optimizedFeatureManager.getPerformanceStats();
      return {
        ...baseStats,
        optimizedWorker: {
          initialized: this.optimizationInitialized,
          totalPredictions: performanceStats.totalPredictions,
          avgTime: performanceStats.avgTime,
          under50msPercentage: performanceStats.under50msPercentage,
          performanceTarget: this.performanceTarget
        }
      };
    }
    
    return baseStats;
  }
}

export default EnhancedFeatureEngineering;
