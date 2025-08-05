/**
 * AIFoundation.js
 * 
 * Main API interface for the AI prediction system foundation.
 * Provides high-level functions for data analysis, constraint validation, and pattern recognition.
 * This is the primary entry point for AI-powered scheduling features.
 */

import { extractAllDataForAI } from './utils/DataExtractor';
import { performComprehensiveAnalysis } from './core/DataAnalyzer';
import { recognizePatternsForAllStaff } from './core/PatternRecognizer';
import { validateAllConstraints } from './constraints/ConstraintEngine';
import { StaffGroupManager } from './models/StaffGroupModel';
import { ConstraintManager } from './models/ConstraintModel';
import { PreferenceManager } from './models/PreferenceModel';

/**
 * Main AIFoundation class - coordinating all AI components
 */
export class AIFoundation {
  constructor() {
    this.initialized = false;
    this.lastAnalysis = null;
    this.staffGroupManager = new StaffGroupManager();
    this.constraintManager = new ConstraintManager();
    this.preferenceManager = new PreferenceManager();
    this.analysisHistory = [];
    this.initializationTime = null;
  }

  /**
   * Initialize the AI foundation system
   * @param {Object} options - Initialization options
   * @returns {Object} Initialization result
   */
  async initialize(options = {}) {
    console.log('🚀 Initializing AI Foundation System...');
    
    try {
      const startTime = Date.now();
      
      const initResult = {
        success: false,
        timestamp: new Date().toISOString(),
        components: {
          dataExtractor: 'not_initialized',
          constraintEngine: 'not_initialized',
          patternRecognizer: 'not_initialized',
          staffGroupManager: 'not_initialized',
          preferenceManager: 'not_initialized'
        },
        dataAnalysis: null,
        error: null
      };

      // Initialize data extraction and analysis
      console.log('📊 Extracting and analyzing historical data...');
      const extractedData = extractAllDataForAI();
      
      if (!extractedData.success) {
        throw new Error(`Data extraction failed: ${extractedData.error}`);
      }
      
      initResult.components.dataExtractor = 'initialized';

      // Perform comprehensive data analysis
      const analysis = performComprehensiveAnalysis(extractedData);
      
      if (!analysis.success) {
        throw new Error(`Data analysis failed: ${analysis.error}`);
      }
      
      this.lastAnalysis = analysis;
      initResult.dataAnalysis = analysis.analysis.summary;

      // Initialize pattern recognition
      console.log('🔍 Recognizing staff patterns...');
      const patternAnalysis = recognizePatternsForAllStaff(extractedData.data.staffProfiles);
      
      if (patternAnalysis.aggregateInsights.totalStaff > 0) {
        // Create preferences from detected patterns
        const createdPreferences = this.preferenceManager.createPreferencesFromPatterns(patternAnalysis);
        console.log(`✅ Created ${createdPreferences.length} staff preferences from patterns`);
      }
      
      initResult.components.patternRecognizer = 'initialized';
      initResult.components.preferenceManager = 'initialized';

      // Initialize constraint validation
      console.log('⚖️ Setting up constraint validation...');
      // Constraint manager is already initialized with default constraints
      initResult.components.constraintEngine = 'initialized';
      initResult.components.staffGroupManager = 'initialized';

      // Mark as initialized
      this.initialized = true;
      this.initializationTime = new Date().toISOString();
      initResult.success = true;

      const initTime = Date.now() - startTime;
      console.log(`✅ AI Foundation System initialized successfully in ${initTime}ms`);
      
      return initResult;

    } catch (error) {
      console.error('❌ AI Foundation initialization failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        components: {},
        dataAnalysis: null
      };
    }
  }

  /**
   * Perform complete analysis of current schedule data
   * @param {number} monthIndex - Month period index to analyze
   * @returns {Object} Complete analysis results
   */
  async analyzeSchedule(monthIndex = 0) {
    if (!this.initialized) {
      throw new Error('AI Foundation not initialized. Call initialize() first.');
    }

    console.log(`📊 Analyzing schedule for period ${monthIndex}...`);
    
    try {
      // Extract fresh data
      const extractedData = extractAllDataForAI();
      
      if (!extractedData.success) {
        throw new Error(`Data extraction failed: ${extractedData.error}`);
      }

      // Perform comprehensive analysis
      const analysis = performComprehensiveAnalysis(extractedData);
      
      if (!analysis.success) {
        throw new Error(`Analysis failed: ${analysis.error}`);
      }

      // Store analysis in history
      this.analysisHistory.push({
        timestamp: new Date().toISOString(),
        monthIndex,
        analysis: analysis.analysis.summary
      });

      // Keep only last 10 analyses
      if (this.analysisHistory.length > 10) {
        this.analysisHistory = this.analysisHistory.slice(-10);
      }

      this.lastAnalysis = analysis;
      
      console.log('✅ Schedule analysis completed');
      return analysis;

    } catch (error) {
      console.error('❌ Schedule analysis failed:', error);
      throw error;
    }
  }

  /**
   * Validate schedule constraints for a specific period
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Constraint validation results
   */
  async validateConstraints(scheduleData, staffMembers, dateRange) {
    if (!this.initialized) {
      throw new Error('AI Foundation not initialized. Call initialize() first.');
    }

    console.log('⚖️ Validating schedule constraints...');
    
    try {
      // Validate using constraint manager
      const constraintValidation = this.constraintManager.validateAllConstraints(
        scheduleData, 
        staffMembers, 
        dateRange
      );

      // Validate using staff group manager
      const groupValidations = [];
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const groupValidation = this.staffGroupManager.checkAllGroupConflicts(
          scheduleData, 
          dateKey, 
          staffMembers
        );
        if (groupValidation.hasConflicts) {
          groupValidations.push(groupValidation);
        }
      });

      const result = {
        timestamp: new Date().toISOString(),
        constraintValidation,
        groupValidations,
        overallValid: constraintValidation.valid && groupValidations.length === 0,
        totalViolations: constraintValidation.totalViolations + 
                        groupValidations.reduce((sum, gv) => sum + gv.totalConflicts, 0),
        recommendations: [
          ...constraintValidation.summary.recommendedActions,
          ...this.staffGroupManager.getConflictReductionRecommendations()
        ]
      };

      console.log(`✅ Constraint validation completed: ${result.overallValid ? 'VALID' : 'VIOLATIONS FOUND'}`);
      return result;

    } catch (error) {
      console.error('❌ Constraint validation failed:', error);
      throw error;
    }
  }

  /**
   * Get staff preference scores for schedule optimization
   * @param {string} staffId - Staff member ID
   * @param {Object} scheduleData - Current schedule data
   * @param {Array} dateRange - Array of dates to analyze
   * @returns {Object} Preference analysis results
   */
  async analyzeStaffPreferences(staffId, scheduleData, dateRange) {
    if (!this.initialized) {
      throw new Error('AI Foundation not initialized. Call initialize() first.');
    }

    console.log(`👤 Analyzing preferences for staff ${staffId}...`);
    
    try {
      const staffPreferences = this.preferenceManager.getStaffPreferences(staffId);
      const staffSchedule = scheduleData[staffId] || {};
      
      let totalScore = 0;
      let applicableCount = 0;
      const dailyScores = {};
      const preferenceBreakdown = {};

      // Calculate scores for each date
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const currentShift = staffSchedule[dateKey];
        
        if (currentShift !== undefined) {
          const context = { dateKey, shiftType: currentShift };
          const score = this.preferenceManager.getPreferenceScore(staffId, context);
          
          dailyScores[dateKey] = score;
          totalScore += score;
          applicableCount++;
        }
      });

      // Analyze each preference type
      staffPreferences.forEach(preference => {
        if (!preferenceBreakdown[preference.type]) {
          preferenceBreakdown[preference.type] = {
            count: 0,
            averageScore: 0,
            totalScore: 0,
            preferences: []
          };
        }
        
        preferenceBreakdown[preference.type].count++;
        preferenceBreakdown[preference.type].preferences.push({
          id: preference.id,
          strength: preference.strength,
          confidence: preference.confidence
        });
      });

      // Get recommendations
      const recommendations = this.preferenceManager.getPreferenceRecommendations(
        staffId, 
        staffSchedule, 
        dateRange
      );

      const result = {
        staffId,
        timestamp: new Date().toISOString(),
        overallScore: applicableCount > 0 ? totalScore / applicableCount : 0,
        totalPreferences: staffPreferences.length,
        dailyScores,
        preferenceBreakdown,
        recommendations,
        satisfactionLevel: this.getPreferenceSatisfactionLevel(totalScore / applicableCount)
      };

      console.log(`✅ Staff preference analysis completed: ${result.satisfactionLevel}`);
      return result;

    } catch (error) {
      console.error('❌ Staff preference analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get satisfaction level description from score
   * @param {number} score - Preference score
   * @returns {string} Satisfaction level
   */
  getPreferenceSatisfactionLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'very_poor';
  }

  /**
   * Generate optimization recommendations for a schedule
   * @param {Object} scheduleData - Current schedule data
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Optimization recommendations
   */
  async generateOptimizationRecommendations(scheduleData, staffMembers, dateRange) {
    if (!this.initialized) {
      throw new Error('AI Foundation not initialized. Call initialize() first.');
    }

    console.log('🎯 Generating optimization recommendations...');
    
    try {
      // Validate constraints first
      const constraintValidation = await this.validateConstraints(scheduleData, staffMembers, dateRange);
      
      // Analyze staff preferences
      const staffPreferenceAnalyses = [];
      for (const staff of staffMembers) {
        const prefAnalysis = await this.analyzeStaffPreferences(staff.id, scheduleData, dateRange);
        staffPreferenceAnalyses.push(prefAnalysis);
      }

      // Get optimization opportunities from last analysis
      const optimizationOpportunities = this.lastAnalysis?.analysis?.optimizationAnalysis?.opportunities || [];

      const recommendations = {
        timestamp: new Date().toISOString(),
        constraintViolations: constraintValidation.totalViolations,
        averagePreferenceScore: staffPreferenceAnalyses.reduce((sum, spa) => sum + spa.overallScore, 0) / staffPreferenceAnalyses.length,
        recommendations: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        optimizationOpportunities,
        actionPlan: []
      };

      // Critical: Constraint violations
      constraintValidation.recommendations.forEach(rec => {
        if (rec.priority === 'critical') {
          recommendations.recommendations.critical.push({
            type: 'constraint_violation',
            priority: 'critical',
            description: rec.title || rec.message,
            actions: rec.actions || [],
            impact: 'business_continuity'
          });
        }
      });

      // High: Major preference issues and group conflicts
      staffPreferenceAnalyses.forEach(spa => {
        spa.recommendations.forEach(rec => {
          if (rec.priority === 'high' && rec.satisfactionRate < 30) {
            recommendations.recommendations.high.push({
              type: 'staff_preference',
              priority: 'high',
              staffId: spa.staffId,
              description: rec.suggestion,
              satisfactionRate: rec.satisfactionRate,
              impact: 'staff_satisfaction'
            });
          }
        });
      });

      // Medium: Optimization opportunities
      optimizationOpportunities.forEach(opp => {
        if (opp.impact.efficiency > 15 || opp.impact.fairness > 20) {
          recommendations.recommendations.medium.push({
            type: 'optimization',
            priority: 'medium',
            description: opp.description,
            actions: opp.actions,
            expectedImpact: opp.impact
          });
        }
      });

      // Generate action plan
      recommendations.actionPlan = this.generateActionPlan(recommendations);

      console.log(`✅ Generated ${Object.values(recommendations.recommendations).flat().length} optimization recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Optimization recommendation generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate prioritized action plan
   * @param {Object} recommendations - Recommendations object
   * @returns {Array} Prioritized action plan
   */
  generateActionPlan(recommendations) {
    const actionPlan = [];
    
    // Add critical actions first
    recommendations.recommendations.critical.forEach((rec, index) => {
      actionPlan.push({
        step: actionPlan.length + 1,
        priority: 'critical',
        action: rec.description,
        type: rec.type,
        estimatedTime: 'immediate',
        impact: rec.impact
      });
    });

    // Add high priority actions
    recommendations.recommendations.high.slice(0, 3).forEach((rec, index) => {
      actionPlan.push({
        step: actionPlan.length + 1,
        priority: 'high',
        action: rec.description,
        type: rec.type,
        estimatedTime: 'within_day',
        impact: rec.impact
      });
    });

    // Add top medium priority actions
    recommendations.recommendations.medium.slice(0, 2).forEach((rec, index) => {
      actionPlan.push({
        step: actionPlan.length + 1,
        priority: 'medium',
        action: rec.description,
        type: rec.type,
        estimatedTime: 'within_week',
        impact: rec.expectedImpact
      });
    });

    return actionPlan;
  }

  /**
   * Get system status and health metrics
   * @returns {Object} System status information
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      initializationTime: this.initializationTime,
      lastAnalysisTime: this.lastAnalysis?.analyzedAt,
      analysisHistoryCount: this.analysisHistory.length,
      components: {
        staffGroupManager: {
          totalGroups: this.staffGroupManager.getAllGroups().length,
          conflictHistory: this.staffGroupManager.conflictHistory.length
        },
        constraintManager: {
          totalConstraints: this.constraintManager.getAllConstraints().length,
          activeConstraints: this.constraintManager.getAllConstraints().filter(c => c.active).length
        },
        preferenceManager: {
          totalPreferences: this.preferenceManager.preferences.size,
          staffWithPreferences: this.preferenceManager.staffPreferences.size
        }
      },
      lastAnalysisSummary: this.lastAnalysis?.analysis?.summary || null
    };
  }

  /**
   * Export AI foundation data for backup/transfer
   * @returns {Object} Complete AI foundation data
   */
  exportData() {
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      systemStatus: this.getSystemStatus(),
      staffGroups: this.staffGroupManager.exportToJSON(),
      constraints: this.constraintManager.exportToJSON(),
      preferences: this.preferenceManager.exportToJSON(),
      analysisHistory: [...this.analysisHistory],
      lastAnalysis: this.lastAnalysis
    };
  }

  /**
   * Import AI foundation data from backup
   * @param {Object} data - Data to import
   * @returns {Object} Import result
   */
  importData(data) {
    try {
      console.log('📥 Importing AI foundation data...');
      
      // Import staff groups
      if (data.staffGroups) {
        this.staffGroupManager.importFromJSON(data.staffGroups);
      }
      
      // Import constraints
      if (data.constraints) {
        this.constraintManager.importFromJSON(data.constraints);
      }
      
      // Import preferences
      if (data.preferences) {
        this.preferenceManager.importFromJSON(data.preferences);
      }
      
      // Import history
      if (data.analysisHistory) {
        this.analysisHistory = [...data.analysisHistory];
      }
      
      if (data.lastAnalysis) {
        this.lastAnalysis = data.lastAnalysis;
      }

      console.log('✅ AI foundation data imported successfully');
      return {
        success: true,
        message: 'Data imported successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Data import failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reset AI foundation to initial state
   * @returns {Object} Reset result
   */
  reset() {
    console.log('🔄 Resetting AI Foundation System...');
    
    try {
      this.initialized = false;
      this.lastAnalysis = null;
      this.staffGroupManager = new StaffGroupManager();
      this.constraintManager = new ConstraintManager();
      this.preferenceManager = new PreferenceManager();
      this.analysisHistory = [];
      this.initializationTime = null;

      console.log('✅ AI Foundation System reset successfully');
      return {
        success: true,
        message: 'System reset successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ System reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
export const aiFoundation = new AIFoundation();

// Convenience functions for common operations
export const initializeAI = (options) => aiFoundation.initialize(options);
export const analyzeCurrentSchedule = (monthIndex) => aiFoundation.analyzeSchedule(monthIndex);
export const validateScheduleConstraints = (scheduleData, staffMembers, dateRange) => 
  aiFoundation.validateConstraints(scheduleData, staffMembers, dateRange);
export const getStaffPreferences = (staffId, scheduleData, dateRange) => 
  aiFoundation.analyzeStaffPreferences(staffId, scheduleData, dateRange);
export const getOptimizationRecommendations = (scheduleData, staffMembers, dateRange) => 
  aiFoundation.generateOptimizationRecommendations(scheduleData, staffMembers, dateRange);
export const getAISystemStatus = () => aiFoundation.getSystemStatus();

// Export individual components for advanced usage
export { StaffGroupManager } from './models/StaffGroupModel';
export { ConstraintManager } from './models/ConstraintModel';
export { PreferenceManager } from './models/PreferenceModel';
export { extractAllDataForAI } from './utils/DataExtractor';
export { performComprehensiveAnalysis } from './core/DataAnalyzer';
export { recognizePatternsForAllStaff } from './core/PatternRecognizer';
export { validateAllConstraints } from './constraints/ConstraintEngine';