/**
 * PredictionEngine.js
 * 
 * Phase 2: Core Prediction Engine - Main interface for AI-powered shift scheduling.
 * Provides intelligent schedule generation, conflict resolution, and optimization.
 * Integrates with Phase 1 foundation to provide complete AI scheduling solution.
 */

import { aiFoundation } from './AIFoundation';
import { ScheduleGenerator } from './core/ScheduleGenerator';
import { ConflictResolver } from './core/ConflictResolver';
import { OptimizationEngine } from './core/OptimizationEngine';
import { CSPSolver } from './algorithms/CSPSolver';
import { GeneticAlgorithm } from './algorithms/GeneticAlgorithm';
import { PredictionModel } from './models/PredictionModel';
import { extractAllDataForAI } from './utils/DataExtractor';

/**
 * Main PredictionEngine class - orchestrates all prediction and generation capabilities
 */
export class PredictionEngine {
  constructor() {
    this.initialized = false;
    this.foundationReady = false;
    
    // Core components
    this.scheduleGenerator = new ScheduleGenerator();
    this.conflictResolver = new ConflictResolver();
    this.optimizationEngine = new OptimizationEngine();
    
    // Algorithm components
    this.cspSolver = new CSPSolver();
    this.geneticAlgorithm = new GeneticAlgorithm();
    
    // Models
    this.predictionModel = new PredictionModel();
    
    // State tracking
    this.lastGeneration = null;
    this.generationHistory = [];
    this.predictionCache = new Map();
    this.performanceMetrics = {
      generationTime: 0,
      conflictResolutionTime: 0,
      optimizationTime: 0,
      totalPredictions: 0,
      successfulGenerations: 0,
      averageConstraintSatisfaction: 0
    };
  }

  /**
   * Initialize the prediction engine
   * @param {Object} options - Initialization options
   * @returns {Object} Initialization result
   */
  async initialize(options = {}) {
    console.log('🤖 Initializing AI Prediction Engine Phase 2...');
    
    try {
      const startTime = Date.now();
      
      // Ensure AI Foundation is initialized
      if (!aiFoundation.initialized) {
        console.log('📋 Initializing AI Foundation first...');
        const foundationResult = await aiFoundation.initialize();
        if (!foundationResult.success) {
          throw new Error(`Foundation initialization failed: ${foundationResult.error}`);
        }
      }
      this.foundationReady = true;

      // Initialize core components
      await this.scheduleGenerator.initialize(options);
      await this.conflictResolver.initialize(options);
      await this.optimizationEngine.initialize(options);
      
      // Initialize algorithm components
      this.cspSolver.initialize(options);
      this.geneticAlgorithm.initialize(options);
      
      // Initialize prediction model
      await this.predictionModel.initialize(options);
      
      // Load historical data for pattern learning
      const extractedData = extractAllDataForAI();
      if (extractedData.success) {
        await this.predictionModel.trainFromHistoricalData(extractedData.data);
      }

      this.initialized = true;
      const initTime = Date.now() - startTime;
      
      console.log(`✅ AI Prediction Engine Phase 2 initialized successfully in ${initTime}ms`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        initializationTime: initTime,
        components: {
          foundation: 'ready',
          scheduleGenerator: 'initialized',
          conflictResolver: 'initialized',
          optimizationEngine: 'initialized',
          cspSolver: 'initialized',
          geneticAlgorithm: 'initialized',
          predictionModel: 'initialized'
        },
        capabilities: [
          'intelligent_schedule_generation',
          'automatic_conflict_resolution',
          'multi_objective_optimization',
          'pattern_based_prediction',
          'constraint_satisfaction_solving'
        ]
      };

    } catch (error) {
      console.error('❌ Prediction Engine initialization failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        components: {}
      };
    }
  }

  /**
   * Generate a complete schedule for a given period
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated schedule with analysis
   */
  async generateSchedule(params = {}) {
    if (!this.initialized) {
      throw new Error('Prediction Engine not initialized. Call initialize() first.');
    }

    const {
      monthIndex = 0,
      staffMembers = [],
      dateRange = [],
      existingSchedule = {},
      preferences = {},
      constraints = {},
      preserveExisting = true,
      optimizationGoals = ['constraint_satisfaction', 'fairness', 'preferences']
    } = params;

    console.log(`🔮 Generating AI-powered schedule for period ${monthIndex}...`);
    
    try {
      const startTime = Date.now();
      
      // Step 1: Analyze current state and constraints
      console.log('📊 Analyzing current state and constraints...');
      const constraintAnalysis = await aiFoundation.validateConstraints(
        existingSchedule, 
        staffMembers, 
        dateRange
      );

      // Step 2: Generate base schedule using CSP solver
      console.log('⚡ Generating base schedule with constraint satisfaction...');
      const baseSchedule = await this.cspSolver.generateSchedule({
        staffMembers,
        dateRange,
        existingSchedule,
        preserveExisting,
        constraints: constraints
      });

      // Step 3: Apply prediction model for intelligent assignments
      console.log('🧠 Applying pattern-based predictions...');
      const predictedSchedule = await this.predictionModel.enhanceSchedule(
        baseSchedule.schedule,
        staffMembers,
        dateRange
      );

      // Step 4: Resolve any remaining conflicts
      console.log('🔧 Resolving conflicts and violations...');
      const resolvedSchedule = await this.conflictResolver.resolveAllConflicts(
        predictedSchedule,
        staffMembers,
        dateRange
      );

      // Step 5: Apply multi-objective optimization
      console.log('🎯 Optimizing for multiple objectives...');
      const optimizedSchedule = await this.optimizationEngine.optimize(
        resolvedSchedule.schedule,
        staffMembers,
        dateRange,
        {
          goals: optimizationGoals,
          preferences: preferences,
          constraints: constraints
        }
      );

      // Step 6: Final validation and analysis
      console.log('✅ Performing final validation...');
      const finalValidation = await aiFoundation.validateConstraints(
        optimizedSchedule.schedule,
        staffMembers,
        dateRange
      );

      const generationTime = Date.now() - startTime;
      
      // Update performance metrics
      this.performanceMetrics.totalPredictions++;
      this.performanceMetrics.generationTime = generationTime;
      if (finalValidation.overallValid) {
        this.performanceMetrics.successfulGenerations++;
      }
      this.performanceMetrics.averageConstraintSatisfaction = 
        (this.performanceMetrics.averageConstraintSatisfaction + 
         (finalValidation.overallValid ? 100 : 0)) / this.performanceMetrics.totalPredictions;

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        generationTime,
        schedule: optimizedSchedule.schedule,
        analysis: {
          constraintSatisfaction: finalValidation.overallValid,
          totalViolations: finalValidation.totalViolations,
          optimizationScore: optimizedSchedule.optimizationScore,
          predictionConfidence: predictedSchedule.confidence || 0,
          fairnessScore: optimizedSchedule.fairnessScore || 0,
          preferenceScore: optimizedSchedule.preferenceScore || 0
        },
        steps: {
          baseGeneration: baseSchedule,
          prediction: predictedSchedule,
          conflictResolution: resolvedSchedule,
          optimization: optimizedSchedule,
          validation: finalValidation
        },
        recommendations: finalValidation.recommendations || [],
        metadata: {
          monthIndex,
          staffCount: staffMembers.length,
          dateCount: dateRange.length,
          preservedCells: preserveExisting ? Object.keys(existingSchedule).length : 0,
          algorithmUsed: 'hybrid_csp_genetic',
          optimizationGoals
        }
      };

      // Store in generation history
      this.generationHistory.push({
        timestamp: result.timestamp,
        monthIndex,
        success: result.success,
        constraintSatisfaction: result.analysis.constraintSatisfaction,
        optimizationScore: result.analysis.optimizationScore
      });

      // Keep only last 20 generations
      if (this.generationHistory.length > 20) {
        this.generationHistory = this.generationHistory.slice(-20);
      }

      this.lastGeneration = result;
      
      console.log(`✅ Schedule generation completed in ${generationTime}ms`);
      console.log(`📊 Constraint satisfaction: ${result.analysis.constraintSatisfaction ? '100%' : (100 - result.analysis.totalViolations * 10) + '%'}`);
      console.log(`🎯 Optimization score: ${result.analysis.optimizationScore}%`);
      
      return result;

    } catch (error) {
      console.error('❌ Schedule generation failed:', error);
      
      this.performanceMetrics.totalPredictions++;
      
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        schedule: existingSchedule,
        analysis: {
          constraintSatisfaction: false,
          totalViolations: 0,
          optimizationScore: 0,
          predictionConfidence: 0
        },
        recommendations: [
          {
            type: 'generation_error',
            priority: 'critical',
            description: `Schedule generation failed: ${error.message}`,
            actions: ['Review input parameters', 'Check constraint definitions', 'Retry with simpler parameters']
          }
        ]
      };
    }
  }

  /**
   * Predict the best shift for a specific staff member on a specific date
   * @param {Object} params - Prediction parameters
   * @returns {Object} Shift prediction with confidence score
   */
  async predictShift(params = {}) {
    if (!this.initialized) {
      throw new Error('Prediction Engine not initialized. Call initialize() first.');
    }

    const {
      staffId,
      staffName,
      dateKey,
      currentSchedule = {},
      staffMembers = [],
      contextDates = [],
      constraints = {}
    } = params;

    const cacheKey = `${staffId}-${dateKey}-${JSON.stringify(constraints).slice(0, 50)}`;
    
    // Check cache first
    if (this.predictionCache.has(cacheKey)) {
      return this.predictionCache.get(cacheKey);
    }

    try {
      // Get prediction from model
      const prediction = await this.predictionModel.predictShift({
        staffId,
        staffName,
        dateKey,
        currentSchedule,
        staffMembers,
        contextDates
      });

      // Validate prediction against constraints
      const testSchedule = { ...currentSchedule };
      if (!testSchedule[staffId]) testSchedule[staffId] = {};
      testSchedule[staffId][dateKey] = prediction.recommendedShift;

      const validation = await aiFoundation.validateConstraints(
        testSchedule,
        staffMembers,
        [new Date(dateKey)]
      );

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        staffId,
        staffName,
        dateKey,
        prediction: {
          recommendedShift: prediction.recommendedShift,
          confidence: prediction.confidence,
          reasoning: prediction.reasoning,
          alternatives: prediction.alternatives || []
        },
        validation: {
          valid: validation.overallValid,
          violations: validation.totalViolations,
          warnings: validation.recommendations.filter(r => r.priority === 'medium')
        },
        metadata: {
          basedOnPatterns: prediction.patternMatch || false,
          historicalSimilarity: prediction.historicalSimilarity || 0,
          constraintCompliance: validation.overallValid ? 1 : 0
        }
      };

      // Cache result
      this.predictionCache.set(cacheKey, result);
      
      // Limit cache size
      if (this.predictionCache.size > 1000) {
        const firstKey = this.predictionCache.keys().next().value;
        this.predictionCache.delete(firstKey);
      }

      return result;

    } catch (error) {
      console.error('❌ Shift prediction failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        prediction: {
          recommendedShift: '',
          confidence: 0,
          reasoning: 'Prediction failed due to error'
        }
      };
    }
  }

  /**
   * Automatically resolve conflicts in an existing schedule
   * @param {Object} params - Resolution parameters
   * @returns {Object} Resolved schedule with changes
   */
  async resolveConflicts(params = {}) {
    if (!this.initialized) {
      throw new Error('Prediction Engine not initialized. Call initialize() first.');
    }

    const {
      scheduleData,
      staffMembers,
      dateRange,
      resolutionStrategy = 'priority_based',
      maxAttempts = 5
    } = params;

    console.log('🔧 Auto-resolving schedule conflicts...');
    
    try {
      const startTime = Date.now();
      
      const result = await this.conflictResolver.resolveAllConflicts(
        scheduleData,
        staffMembers,
        dateRange,
        {
          strategy: resolutionStrategy,
          maxAttempts
        }
      );

      const resolutionTime = Date.now() - startTime;
      this.performanceMetrics.conflictResolutionTime = resolutionTime;

      console.log(`✅ Conflict resolution completed in ${resolutionTime}ms`);
      console.log(`🔧 ${result.changesApplied} changes applied, ${result.conflictsResolved} conflicts resolved`);

      return result;

    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        schedule: scheduleData,
        changesApplied: 0,
        conflictsResolved: 0
      };
    }
  }

  /**
   * Optimize an existing schedule for multiple objectives
   * @param {Object} params - Optimization parameters
   * @returns {Object} Optimized schedule with improvements
   */
  async optimizeSchedule(params = {}) {
    if (!this.initialized) {
      throw new Error('Prediction Engine not initialized. Call initialize() first.');
    }

    const {
      scheduleData,
      staffMembers,
      dateRange,
      goals = ['fairness', 'preferences', 'efficiency'],
      maxIterations = 100
    } = params;

    console.log('🎯 Optimizing schedule for multiple objectives...');
    
    try {
      const startTime = Date.now();
      
      const result = await this.optimizationEngine.optimize(
        scheduleData,
        staffMembers,
        dateRange,
        {
          goals,
          maxIterations
        }
      );

      const optimizationTime = Date.now() - startTime;
      this.performanceMetrics.optimizationTime = optimizationTime;

      console.log(`✅ Optimization completed in ${optimizationTime}ms`);
      console.log(`📈 Overall score improved by ${result.improvementScore}%`);

      return result;

    } catch (error) {
      console.error('❌ Schedule optimization failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        schedule: scheduleData,
        optimizationScore: 0,
        improvementScore: 0
      };
    }
  }

  /**
   * Get intelligent recommendations for schedule improvements
   * @param {Object} params - Analysis parameters
   * @returns {Object} Comprehensive recommendations
   */
  async getRecommendations(params = {}) {
    if (!this.initialized) {
      throw new Error('Prediction Engine not initialized. Call initialize() first.');
    }

    const {
      scheduleData,
      staffMembers,
      dateRange,
      includeOptimization = true,
      includePredictions = true
    } = params;

    try {
      // Get foundation recommendations
      const foundationRecs = await aiFoundation.generateOptimizationRecommendations(
        scheduleData,
        staffMembers,
        dateRange
      );

      // Get prediction-based recommendations
      const predictionRecs = includePredictions ? 
        await this.predictionModel.getRecommendations(scheduleData, staffMembers, dateRange) : 
        [];

      // Get optimization recommendations
      const optimizationRecs = includeOptimization ?
        await this.optimizationEngine.getRecommendations(scheduleData, staffMembers, dateRange) :
        [];

      // Combine and prioritize recommendations
      const allRecommendations = [
        ...foundationRecs.recommendations.critical.map(r => ({ ...r, source: 'foundation', priority: 'critical' })),
        ...foundationRecs.recommendations.high.map(r => ({ ...r, source: 'foundation', priority: 'high' })),
        ...foundationRecs.recommendations.medium.map(r => ({ ...r, source: 'foundation', priority: 'medium' })),
        ...predictionRecs.map(r => ({ ...r, source: 'prediction' })),
        ...optimizationRecs.map(r => ({ ...r, source: 'optimization' }))
      ];

      // Sort by priority and potential impact
      const prioritizedRecs = this.prioritizeRecommendations(allRecommendations);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        totalRecommendations: allRecommendations.length,
        recommendations: {
          critical: prioritizedRecs.filter(r => r.priority === 'critical'),
          high: prioritizedRecs.filter(r => r.priority === 'high'),
          medium: prioritizedRecs.filter(r => r.priority === 'medium'),
          low: prioritizedRecs.filter(r => r.priority === 'low')
        },
        actionPlan: this.generateActionPlan(prioritizedRecs.slice(0, 10)),
        sources: {
          foundation: foundationRecs.recommendations,
          prediction: predictionRecs,
          optimization: optimizationRecs
        }
      };

    } catch (error) {
      console.error('❌ Recommendations generation failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        recommendations: { critical: [], high: [], medium: [], low: [] }
      };
    }
  }

  /**
   * Prioritize recommendations based on impact and urgency
   * @param {Array} recommendations - Array of recommendations
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(recommendations) {
    const priorityWeights = {
      critical: 1000,
      high: 100,
      medium: 10,
      low: 1
    };

    return recommendations.sort((a, b) => {
      const aWeight = priorityWeights[a.priority] || 1;
      const bWeight = priorityWeights[b.priority] || 1;
      
      // Secondary sort by potential impact
      const aImpact = a.expectedImpact?.efficiency || a.impact?.efficiency || 0;
      const bImpact = b.expectedImpact?.efficiency || b.impact?.efficiency || 0;
      
      if (aWeight === bWeight) {
        return bImpact - aImpact;
      }
      
      return bWeight - aWeight;
    });
  }

  /**
   * Generate actionable plan from recommendations
   * @param {Array} recommendations - Top recommendations
   * @returns {Array} Action plan
   */
  generateActionPlan(recommendations) {
    return recommendations.map((rec, index) => ({
      step: index + 1,
      priority: rec.priority,
      action: rec.description || rec.suggestion || 'Review recommendation',
      type: rec.type,
      source: rec.source,
      estimatedTime: this.estimateActionTime(rec),
      impact: rec.expectedImpact || rec.impact || 'unknown',
      prerequisites: rec.prerequisites || [],
      alternatives: rec.alternativeActions || rec.alternatives || []
    }));
  }

  /**
   * Estimate time required for an action
   * @param {Object} recommendation - Recommendation object
   * @returns {string} Time estimate
   */
  estimateActionTime(recommendation) {
    if (recommendation.priority === 'critical') return 'immediate';
    if (recommendation.type === 'constraint_violation') return 'within_hour';
    if (recommendation.type === 'staff_preference') return 'within_day';
    if (recommendation.type === 'optimization') return 'within_week';
    return 'flexible';
  }

  /**
   * Get system status and performance metrics
   * @returns {Object} Comprehensive system status
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      foundationReady: this.foundationReady,
      components: {
        scheduleGenerator: this.scheduleGenerator.getStatus(),
        conflictResolver: this.conflictResolver.getStatus(),
        optimizationEngine: this.optimizationEngine.getStatus(),
        cspSolver: this.cspSolver.getStatus(),
        geneticAlgorithm: this.geneticAlgorithm.getStatus(),
        predictionModel: this.predictionModel.getStatus()
      },
      performance: {
        ...this.performanceMetrics,
        cacheSize: this.predictionCache.size,
        successRate: this.performanceMetrics.totalPredictions > 0 ? 
          (this.performanceMetrics.successfulGenerations / this.performanceMetrics.totalPredictions) * 100 : 0
      },
      history: {
        totalGenerations: this.generationHistory.length,
        lastGeneration: this.lastGeneration?.timestamp,
        averageGenerationTime: this.generationHistory.length > 0 ?
          this.generationHistory.reduce((sum, g) => sum + (g.generationTime || 0), 0) / this.generationHistory.length : 0
      },
      capabilities: {
        scheduleGeneration: true,
        conflictResolution: true,
        multiObjectiveOptimization: true,
        patternBasedPrediction: true,
        constraintSatisfactionSolving: true,
        realTimeRecommendations: true
      }
    };
  }

  /**
   * Reset the prediction engine
   * @returns {Object} Reset result
   */
  reset() {
    console.log('🔄 Resetting Prediction Engine...');
    
    try {
      this.initialized = false;
      this.foundationReady = false;
      this.lastGeneration = null;
      this.generationHistory = [];
      this.predictionCache.clear();
      
      // Reset performance metrics
      this.performanceMetrics = {
        generationTime: 0,
        conflictResolutionTime: 0,
        optimizationTime: 0,
        totalPredictions: 0,
        successfulGenerations: 0,
        averageConstraintSatisfaction: 0
      };

      // Reset components
      this.scheduleGenerator = new ScheduleGenerator();
      this.conflictResolver = new ConflictResolver();
      this.optimizationEngine = new OptimizationEngine();
      this.cspSolver = new CSPSolver();
      this.geneticAlgorithm = new GeneticAlgorithm();
      this.predictionModel = new PredictionModel();

      console.log('✅ Prediction Engine reset successfully');
      return {
        success: true,
        message: 'Prediction Engine reset successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Prediction Engine reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
export const predictionEngine = new PredictionEngine();

// Convenience functions for common operations
export const initializePrediction = (options) => predictionEngine.initialize(options);
export const generateOptimalSchedule = (params) => predictionEngine.generateSchedule(params);
export const predictOptimalShift = (params) => predictionEngine.predictShift(params);
export const autoResolveConflicts = (params) => predictionEngine.resolveConflicts(params);
export const optimizeExistingSchedule = (params) => predictionEngine.optimizeSchedule(params);
export const getSmartRecommendations = (params) => predictionEngine.getRecommendations(params);
export const getPredictionSystemStatus = () => predictionEngine.getSystemStatus();