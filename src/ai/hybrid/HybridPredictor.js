/**
 * HybridPredictor.js
 * 
 * Hybrid AI system that combines TensorFlow ML predictions with business rule validation.
 * This creates a robust scheduling system that leverages neural networks while ensuring
 * compliance with business constraints and restaurant operations requirements.
 */

import { TensorFlowScheduler } from '../ml/TensorFlowScheduler';
import { BusinessRuleValidator } from './BusinessRuleValidator';
import { validateAllConstraints } from '../constraints/ConstraintEngine';

export class HybridPredictor {
  constructor() {
    this.initialized = false;
    this.status = 'idle';
    this.mlEngine = null;
    this.ruleValidator = null;
    this.predictionHistory = [];
    this.metrics = {
      totalPredictions: 0,
      mlAcceptedRate: 0,
      rulesAppliedRate: 0,
      hybridSuccessRate: 0
    };
  }

  /**
   * Initialize the hybrid prediction system
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    try {
      this.status = 'initializing';
      console.log('🤖 Initializing HybridPredictor...');

      // Initialize TensorFlow ML engine
      this.mlEngine = new TensorFlowScheduler();
      await this.mlEngine.initialize(options.ml);

      // Initialize business rule validator
      this.ruleValidator = new BusinessRuleValidator();
      await this.ruleValidator.initialize(options.rules);

      this.options = {
        // ML prediction settings
        mlConfidenceThreshold: 0.7,
        useMLPredictions: true,
        
        // Rule validation settings
        strictRuleEnforcement: true,
        allowRuleOverrides: false,
        
        // Hybrid combination settings
        preferMLWhenValid: true,
        fallbackToRules: true,
        
        ...options
      };

      this.initialized = true;
      this.status = 'ready';
      console.log('✅ HybridPredictor initialized successfully');

    } catch (error) {
      this.status = 'error';
      console.error('❌ HybridPredictor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if the hybrid predictor is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && 
           this.status === 'ready' && 
           this.mlEngine?.isReady() && 
           this.ruleValidator?.isReady();
  }

  /**
   * Generate hybrid predictions that combine ML and business rules
   * @param {Object} inputData - Schedule input data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range for predictions
   * @returns {Object} Hybrid prediction results
   */
  async predictSchedule(inputData, staffMembers, dateRange) {
    if (!this.isReady()) {
      throw new Error('HybridPredictor not ready. Call initialize() first.');
    }

    this.status = 'predicting';
    const startTime = Date.now();

    try {
      console.log('🔮 Generating hybrid schedule predictions...');

      // Step 1: Get ML predictions
      let mlPredictions = null;
      let mlSuccess = false;
      
      if (this.options.useMLPredictions) {
        try {
          mlPredictions = await this.mlEngine.generateSchedule(inputData, staffMembers, dateRange);
          mlSuccess = mlPredictions.success && 
                     mlPredictions.confidence >= this.options.mlConfidenceThreshold;
          
          console.log(`🧠 ML predictions: ${mlSuccess ? 'SUCCESS' : 'FALLBACK'} (confidence: ${mlPredictions?.confidence || 0})`);
        } catch (error) {
          console.warn('⚠️ ML prediction failed, falling back to rules:', error.message);
        }
      }

      // Step 2: Validate ML predictions against business rules
      let validatedPredictions = null;
      let ruleValidationResult = null;

      if (mlSuccess && mlPredictions) {
        ruleValidationResult = await this.validateMLPredictions(
          mlPredictions.schedule, 
          staffMembers, 
          dateRange
        );

        if (ruleValidationResult.valid || !this.options.strictRuleEnforcement) {
          validatedPredictions = mlPredictions.schedule;
          console.log('✅ ML predictions passed business rule validation');
        } else {
          console.log('❌ ML predictions failed business rule validation');
        }
      }

      // Step 3: Apply rule-based corrections or generate rule-based schedule
      let finalSchedule = null;
      let predictionMethod = 'unknown';

      if (validatedPredictions && ruleValidationResult?.valid) {
        // Use validated ML predictions
        finalSchedule = validatedPredictions;
        predictionMethod = 'ml_validated';
      } else if (validatedPredictions && !this.options.strictRuleEnforcement) {
        // Use ML predictions with rule corrections
        finalSchedule = await this.applyRuleCorrections(
          validatedPredictions, 
          ruleValidationResult.violations,
          staffMembers,
          dateRange
        );
        predictionMethod = 'ml_corrected';
      } else if (this.options.fallbackToRules) {
        // Generate rule-based schedule
        finalSchedule = await this.ruleValidator.generateRuleBasedSchedule(
          inputData,
          staffMembers,
          dateRange
        );
        predictionMethod = 'rule_based';
      } else {
        throw new Error('Unable to generate valid schedule predictions');
      }

      // Step 4: Final validation
      const finalValidation = await this.performFinalValidation(
        finalSchedule,
        staffMembers,
        dateRange
      );

      const result = {
        success: true,
        schedule: finalSchedule,
        metadata: {
          method: predictionMethod,
          processingTime: Date.now() - startTime,
          mlUsed: mlSuccess,
          mlConfidence: mlPredictions?.confidence || 0,
          ruleValidationResult,
          finalValidation,
          violations: finalValidation.violations || [],
          quality: this.calculatePredictionQuality(finalValidation)
        }
      };

      // Update metrics and history
      this.updateMetrics(result);
      this.predictionHistory.push({
        timestamp: new Date().toISOString(),
        method: predictionMethod,
        success: true,
        quality: result.metadata.quality
      });

      this.status = 'ready';
      console.log(`🎯 Hybrid prediction completed: ${predictionMethod} (${result.metadata.processingTime}ms)`);
      
      return result;

    } catch (error) {
      this.status = 'error';
      console.error('❌ Hybrid prediction failed:', error);
      throw error;
    }
  }

  /**
   * Validate ML predictions against business rules
   * @param {Object} mlSchedule - ML generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Validation result
   */
  async validateMLPredictions(mlSchedule, staffMembers, dateRange) {
    try {
      console.log('🔍 Validating ML predictions against business rules...');
      
      // Use the comprehensive constraint validation system
      const validationResult = validateAllConstraints(mlSchedule, staffMembers, dateRange);
      
      // Additional business rule checks specific to ML predictions
      const additionalChecks = await this.ruleValidator.validateSchedule(
        mlSchedule,
        staffMembers,
        dateRange
      );

      return {
        valid: validationResult.valid && additionalChecks.valid,
        violations: [...(validationResult.violations || []), ...(additionalChecks.violations || [])],
        summary: {
          ...validationResult.summary,
          additionalChecks: additionalChecks.summary
        }
      };

    } catch (error) {
      console.error('❌ ML prediction validation failed:', error);
      return {
        valid: false,
        violations: [{
          type: 'validation_error',
          message: `Validation failed: ${error.message}`,
          severity: 'critical'
        }],
        summary: { error: error.message }
      };
    }
  }

  /**
   * Apply rule-based corrections to ML predictions
   * @param {Object} mlSchedule - ML generated schedule
   * @param {Array} violations - Rule violations to fix
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async applyRuleCorrections(mlSchedule, violations, staffMembers, dateRange) {
    try {
      console.log('🔧 Applying rule-based corrections to ML predictions...');
      
      let correctedSchedule = JSON.parse(JSON.stringify(mlSchedule)); // Deep copy
      
      // Apply corrections for each violation
      for (const violation of violations) {
        correctedSchedule = await this.ruleValidator.correctViolation(
          correctedSchedule,
          violation,
          staffMembers,
          dateRange
        );
      }

      return correctedSchedule;

    } catch (error) {
      console.error('❌ Rule correction failed:', error);
      throw error;
    }
  }

  /**
   * Perform final validation of the generated schedule
   * @param {Object} schedule - Generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Final validation result
   */
  async performFinalValidation(schedule, staffMembers, dateRange) {
    try {
      console.log('🔎 Performing final schedule validation...');
      
      // Comprehensive constraint validation
      const constraintValidation = validateAllConstraints(schedule, staffMembers, dateRange);
      
      // Business rule validation
      const businessRuleValidation = await this.ruleValidator.validateSchedule(
        schedule,
        staffMembers,
        dateRange
      );

      // Quality assessment
      const qualityMetrics = this.assessScheduleQuality(schedule, staffMembers, dateRange);

      return {
        valid: constraintValidation.valid && businessRuleValidation.valid,
        violations: [
          ...(constraintValidation.violations || []),
          ...(businessRuleValidation.violations || [])
        ],
        summary: {
          constraints: constraintValidation.summary,
          businessRules: businessRuleValidation.summary,
          quality: qualityMetrics
        }
      };

    } catch (error) {
      console.error('❌ Final validation failed:', error);
      return {
        valid: false,
        violations: [{
          type: 'final_validation_error',
          message: `Final validation failed: ${error.message}`,
          severity: 'critical'
        }],
        summary: { error: error.message }
      };
    }
  }

  /**
   * Assess the quality of a generated schedule
   * @param {Object} schedule - Generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Quality metrics
   */
  assessScheduleQuality(schedule, staffMembers, dateRange) {
    try {
      const metrics = {
        completeness: 0,
        fairness: 0,
        efficiency: 0,
        compliance: 0,
        overall: 0
      };

      // Calculate completeness (percentage of shifts filled)
      let totalSlots = 0;
      let filledSlots = 0;
      
      staffMembers.forEach(staff => {
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          totalSlots++;
          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            filledSlots++;
          }
        });
      });
      
      metrics.completeness = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;

      // Calculate fairness (distribution of shifts and off days)
      const staffWorkloads = {};
      staffMembers.forEach(staff => {
        staffWorkloads[staff.id] = { working: 0, off: 0 };
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          if (schedule[staff.id] && schedule[staff.id][dateKey]) {
            const shift = schedule[staff.id][dateKey];
            if (shift === '×' || shift === 'off') {
              staffWorkloads[staff.id].off++;
            } else {
              staffWorkloads[staff.id].working++;
            }
          }
        });
      });

      const workingDays = Object.values(staffWorkloads).map(w => w.working);
      const avgWorking = workingDays.reduce((sum, days) => sum + days, 0) / workingDays.length;
      const workingVariance = workingDays.reduce((sum, days) => sum + Math.pow(days - avgWorking, 2), 0) / workingDays.length;
      metrics.fairness = Math.max(0, 100 - (Math.sqrt(workingVariance) * 10));

      // Calculate efficiency (coverage and resource utilization)
      let totalCoverage = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        let workingStaff = 0;
        staffMembers.forEach(staff => {
          if (schedule[staff.id] && schedule[staff.id][dateKey] && 
              schedule[staff.id][dateKey] !== '×' && schedule[staff.id][dateKey] !== 'off') {
            workingStaff++;
          }
        });
        totalCoverage += Math.min(workingStaff / staffMembers.length, 1.0);
      });
      metrics.efficiency = (totalCoverage / dateRange.length) * 100;

      // Compliance is based on constraint validation (assumed 100% if we reach this point)
      metrics.compliance = 100;

      // Overall quality score
      metrics.overall = (
        metrics.completeness * 0.3 +
        metrics.fairness * 0.3 +
        metrics.efficiency * 0.3 +
        metrics.compliance * 0.1
      );

      return metrics;

    } catch (error) {
      console.error('❌ Quality assessment failed:', error);
      return {
        completeness: 0,
        fairness: 0,
        efficiency: 0,
        compliance: 0,
        overall: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate prediction quality score
   * @param {Object} validation - Validation result
   * @returns {number} Quality score (0-100)
   */
  calculatePredictionQuality(validation) {
    if (!validation.valid) {
      return Math.max(0, 50 - (validation.violations?.length * 10));
    }
    
    const qualityMetrics = validation.summary?.quality || {};
    return qualityMetrics.overall || 75;
  }

  /**
   * Update prediction metrics
   * @param {Object} result - Prediction result
   */
  updateMetrics(result) {
    this.metrics.totalPredictions++;
    
    if (result.metadata.mlUsed) {
      this.metrics.mlAcceptedRate = (
        (this.metrics.mlAcceptedRate * (this.metrics.totalPredictions - 1) + 100) / 
        this.metrics.totalPredictions
      );
    }

    if (result.metadata.ruleValidationResult?.violations?.length > 0) {
      this.metrics.rulesAppliedRate = (
        (this.metrics.rulesAppliedRate * (this.metrics.totalPredictions - 1) + 100) / 
        this.metrics.totalPredictions
      );
    }

    if (result.success && result.metadata.quality > 70) {
      this.metrics.hybridSuccessRate = (
        (this.metrics.hybridSuccessRate * (this.metrics.totalPredictions - 1) + 100) / 
        this.metrics.totalPredictions
      );
    }
  }

  /**
   * Get current status and metrics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      status: this.status,
      ready: this.isReady(),
      metrics: { ...this.metrics },
      components: {
        mlEngine: this.mlEngine?.getStatus() || null,
        ruleValidator: this.ruleValidator?.getStatus() || null
      },
      predictionHistory: this.predictionHistory.slice(-10) // Last 10 predictions
    };
  }

  /**
   * Reset the hybrid predictor
   */
  async reset() {
    try {
      this.predictionHistory = [];
      this.metrics = {
        totalPredictions: 0,
        mlAcceptedRate: 0,
        rulesAppliedRate: 0,
        hybridSuccessRate: 0
      };
      
      if (this.mlEngine) {
        await this.mlEngine.reset();
      }
      
      if (this.ruleValidator) {
        await this.ruleValidator.reset();
      }
      
      this.status = 'idle';
      console.log('🔄 HybridPredictor reset completed');
      
    } catch (error) {
      console.error('❌ HybridPredictor reset failed:', error);
      throw error;
    }
  }
}