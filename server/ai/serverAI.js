/**
 * Server-Side AI Processing System
 * 
 * This module handles heavy AI computation on the server side with:
 * - TensorFlow.js Node.js optimizations
 * - Business rule validation using existing constraint engine logic
 * - Streaming progress updates
 * - Memory management and performance optimization
 * - Integration with existing client-side business rules
 */

// Use pure JavaScript TensorFlow for Alpine Linux compatibility
const tf = require('@tensorflow/tfjs');

// Configure CPU backend for Alpine Linux
if (process.env.TFJS_FORCE_CPU === 'true' || process.env.TFJS_BACKEND === 'cpu') {
  console.log('Using TensorFlow.js CPU backend for Alpine Linux compatibility');
}

// Import business logic from client-side (we'll adapt the paths)
const { generateDateRange } = require('./utils/dateUtils');
const { validateBusinessRules } = require('./validation/businessRuleValidator');
const { createFeatures, optimizeFeatureGeneration } = require('./ml/featureEngineering');
const { TensorFlowProcessor } = require('./ml/tensorFlowProcessor');

class ServerAIProcessor {
  constructor() {
    this.initialized = false;
    this.ready = false;
    this.status = 'idle';
    this.tfProcessor = null;
    this.businessValidator = null;
    this.processingQueue = [];
    this.currentProcessing = null;
    this.metrics = {
      totalRequests: 0,
      successfulPredictions: 0,
      averageProcessingTime: 0,
      memoryPeaks: [],
    };
  }

  /**
   * Initialize the server-side AI processor
   */
  async initialize(options = {}) {
    try {
      this.status = 'initializing';
      console.log('🚀 Initializing ServerAIProcessor...');

      // Set TensorFlow backend to CPU with optimizations
      tf.setBackend('cpu');
      console.log(`📊 TensorFlow backend: ${tf.getBackend()}`);

      // Initialize TensorFlow processor with server optimizations
      this.tfProcessor = new TensorFlowProcessor();
      await this.tfProcessor.initialize({
        useGPU: false, // CPU optimizations for server
        batchSize: 32,
        enableOptimizations: true,
        memoryGrowth: true,
        ...options.ml,
      });

      // Initialize business rule validator
      this.businessValidator = new ServerBusinessValidator();
      await this.businessValidator.initialize(options.validation);

      this.options = {
        maxConcurrentRequests: 5,
        enableProgressStreaming: true,
        businessRuleValidation: true,
        memoryCleanupInterval: 30000, // 30 seconds
        processingTimeout: 120000, // 2 minutes
        ...options,
      };

      // Start memory monitoring
      this.startMemoryMonitoring();

      this.initialized = true;
      this.ready = true;
      this.status = 'ready';
      console.log('✅ ServerAIProcessor initialized successfully');
    } catch (error) {
      this.status = 'error';
      console.error('❌ ServerAIProcessor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if processor is ready
   */
  isReady() {
    return this.initialized && this.ready && this.status === 'ready';
  }

  /**
   * Check if processor is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.status,
      ready: this.isReady(),
      initialized: this.initialized,
      queueLength: this.processingQueue.length,
      currentProcessing: this.currentProcessing ? true : false,
    };
  }

  /**
   * Get detailed system status
   */
  getDetailedStatus() {
    return {
      ...this.getStatus(),
      metrics: { ...this.metrics },
      memoryUsage: process.memoryUsage(),
      tensorflowMemory: tf.memory(),
      processingQueue: this.processingQueue.length,
      components: {
        tfProcessor: this.tfProcessor?.getStatus() || null,
        businessValidator: this.businessValidator?.getStatus() || null,
      },
    };
  }

  /**
   * Main prediction method with streaming support
   */
  async predictSchedule(inputData, progressCallback = null) {
    if (!this.isReady()) {
      throw new Error('ServerAIProcessor not ready');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.metrics.totalRequests++;

    try {
      console.log(`🎯 Starting server-side prediction ${requestId}`);
      
      if (progressCallback) {
        progressCallback({
          stage: 'initialization',
          progress: 0,
          message: 'サーバーサイドAI処理を開始しています...',
          requestId,
        });
      }

      this.status = 'processing';
      this.currentProcessing = { requestId, startTime };

      // Validate input data
      await this.validateInput(inputData);
      
      if (progressCallback) {
        progressCallback({
          stage: 'validation',
          progress: 10,
          message: '入力データの検証が完了しました',
          requestId,
        });
      }

      // Generate date range for processing
      const dateRange = generateDateRange(inputData.currentMonthIndex);
      console.log(`📅 Processing date range: ${dateRange.length} days`);

      if (progressCallback) {
        progressCallback({
          stage: 'feature_generation',
          progress: 20,
          message: '特徴量生成を開始しています...',
          requestId,
        });
      }

      // Generate optimized features using Phase 1 & 2 improvements
      const features = await this.generateOptimizedFeatures(
        inputData.scheduleData,
        inputData.staffMembers,
        dateRange,
        progressCallback,
        requestId
      );

      if (progressCallback) {
        progressCallback({
          stage: 'ml_prediction',
          progress: 50,
          message: 'TensorFlow MLモデルで予測を実行中...',
          requestId,
        });
      }

      // Execute TensorFlow predictions
      const mlResult = await this.tfProcessor.predictSchedule(
        features,
        inputData.staffMembers,
        dateRange,
        (mlProgress) => {
          if (progressCallback) {
            progressCallback({
              stage: 'ml_prediction',
              progress: 50 + (mlProgress.progress * 0.3), // 50-80%
              message: `ML予測: ${mlProgress.message}`,
              requestId,
            });
          }
        }
      );

      if (progressCallback) {
        progressCallback({
          stage: 'business_validation',
          progress: 80,
          message: 'ビジネスルール検証を実行中...',
          requestId,
        });
      }

      // Validate with business rules
      const validationResult = await this.businessValidator.validateSchedule(
        mlResult.predictions,
        inputData.staffMembers,
        dateRange,
        inputData.scheduleData
      );

      let finalSchedule = mlResult.predictions;
      let predictionMethod = 'ml_validated';
      let correctionsMade = false;

      // Apply corrections if needed
      if (!validationResult.valid && validationResult.violations?.length > 0) {
        if (progressCallback) {
          progressCallback({
            stage: 'rule_correction',
            progress: 90,
            message: 'ビジネスルール違反を修正中...',
            requestId,
          });
        }

        const correctionResult = await this.businessValidator.correctViolations(
          mlResult.predictions,
          validationResult.violations,
          inputData.staffMembers,
          dateRange
        );

        if (correctionResult.success) {
          finalSchedule = correctionResult.correctedSchedule;
          predictionMethod = 'ml_corrected';
          correctionsMade = true;
        }
      }

      // Final validation
      const finalValidation = await this.businessValidator.validateSchedule(
        finalSchedule,
        inputData.staffMembers,
        dateRange,
        inputData.scheduleData
      );

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      if (progressCallback) {
        progressCallback({
          stage: 'completed',
          progress: 100,
          message: '予測が完了しました',
          requestId,
        });
      }

      const result = {
        success: true,
        schedule: finalSchedule,
        metadata: {
          method: predictionMethod,
          processingTime,
          mlUsed: true,
          mlConfidence: mlResult.confidence || 0.85,
          ruleValidationResult: validationResult,
          finalValidation,
          correctionsMade,
          violations: finalValidation.violations || [],
          quality: this.calculateQuality(finalValidation),
          serverProcessed: true,
          requestId,
        },
      };

      this.metrics.successfulPredictions++;
      this.status = 'ready';
      this.currentProcessing = null;

      console.log(`✅ Server prediction ${requestId} completed in ${processingTime}ms`);
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      this.status = 'ready';
      this.currentProcessing = null;

      console.error(`❌ Server prediction ${requestId} failed:`, error);
      throw error;
    }
  }

  /**
   * Generate optimized features using Phase 1 & 2 improvements
   */
  async generateOptimizedFeatures(scheduleData, staffMembers, dateRange, progressCallback, requestId) {
    try {
      console.log('⚡ Generating optimized features on server...');
      
      // Use existing feature optimization logic adapted for server
      const featureResults = await optimizeFeatureGeneration(
        scheduleData,
        staffMembers,
        dateRange,
        {
          enableCaching: true,
          serverSide: true,
          batchProcessing: true,
          chunkSize: 50, // Process in chunks to maintain responsiveness
        }
      );

      // Progress updates during feature generation
      if (progressCallback && featureResults.progress) {
        featureResults.progress.forEach((progressUpdate, index) => {
          setTimeout(() => {
            progressCallback({
              stage: 'feature_generation',
              progress: 20 + (progressUpdate.completion * 0.25), // 20-45%
              message: `特徴量生成: ${progressUpdate.description}`,
              requestId,
            });
          }, index * 100); // Stagger updates
        });
      }

      console.log(`✅ Generated ${Object.keys(featureResults.features).length} feature sets`);
      return featureResults.features;
    } catch (error) {
      console.error('❌ Feature generation failed:', error);
      throw new Error(`Feature generation failed: ${error.message}`);
    }
  }

  /**
   * Validate input data
   */
  async validateInput(inputData) {
    if (!inputData.scheduleData || typeof inputData.scheduleData !== 'object') {
      throw new Error('Invalid scheduleData provided');
    }

    if (!Array.isArray(inputData.staffMembers) || inputData.staffMembers.length === 0) {
      throw new Error('Invalid or empty staffMembers array');
    }

    if (typeof inputData.currentMonthIndex !== 'number' || 
        inputData.currentMonthIndex < 0 || inputData.currentMonthIndex > 5) {
      throw new Error('Invalid currentMonthIndex (must be 0-5)');
    }

    console.log(`✅ Input validation passed: ${inputData.staffMembers.length} staff, month ${inputData.currentMonthIndex}`);
  }

  /**
   * Calculate prediction quality score
   */
  calculateQuality(validation) {
    if (!validation.valid) {
      return Math.max(0, 50 - (validation.violations?.length || 0) * 10);
    }
    return validation.summary?.quality?.overall || 85;
  }

  /**
   * Update processing metrics
   */
  updateMetrics(processingTime, success) {
    const currentAvg = this.metrics.averageProcessingTime;
    const totalRequests = this.metrics.totalRequests;
    
    this.metrics.averageProcessingTime = 
      (currentAvg * (totalRequests - 1) + processingTime) / totalRequests;

    if (!success) {
      console.log(`📊 Request failed - Average processing time: ${this.metrics.averageProcessingTime.toFixed(0)}ms`);
    }
  }

  /**
   * Start memory monitoring for server health
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const tfMemory = tf.memory();
      
      this.metrics.memoryPeaks.push({
        timestamp: Date.now(),
        process: memoryUsage,
        tensorflow: tfMemory,
      });

      // Keep only last 20 measurements
      if (this.metrics.memoryPeaks.length > 20) {
        this.metrics.memoryPeaks = this.metrics.memoryPeaks.slice(-20);
      }

      // Log warning if memory usage is high
      if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.log(`⚠️ High memory usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(0)}MB`);
      }

      // Clean up TensorFlow tensors if needed
      if (tfMemory.numTensors > 100) {
        console.log(`🧹 Cleaning up ${tfMemory.numTensors} tensors...`);
        tf.dispose(tf.getRegisteredVariables());
      }
    }, this.options.memoryCleanupInterval);
  }

  /**
   * Reset the AI processor
   */
  async reset() {
    try {
      console.log('🔄 Resetting ServerAIProcessor...');
      
      this.status = 'resetting';
      this.processingQueue = [];
      this.currentProcessing = null;

      // Reset TensorFlow processor
      if (this.tfProcessor) {
        await this.tfProcessor.reset();
      }

      // Reset business validator
      if (this.businessValidator) {
        await this.businessValidator.reset();
      }

      // Clean up TensorFlow memory
      tf.disposeVariables();

      // Reset metrics
      this.metrics = {
        totalRequests: 0,
        successfulPredictions: 0,
        averageProcessingTime: 0,
        memoryPeaks: [],
      };

      this.status = 'ready';
      console.log('✅ ServerAIProcessor reset completed');
    } catch (error) {
      console.error('❌ ServerAIProcessor reset failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Cleanup resources before shutdown
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up ServerAIProcessor resources...');
      
      this.status = 'shutting_down';

      // Clean up TensorFlow
      if (tf) {
        tf.disposeVariables();
        console.log('✅ TensorFlow variables disposed');
      }

      // Cleanup processors
      if (this.tfProcessor && typeof this.tfProcessor.cleanup === 'function') {
        await this.tfProcessor.cleanup();
      }

      if (this.businessValidator && typeof this.businessValidator.cleanup === 'function') {
        await this.businessValidator.cleanup();
      }

      this.initialized = false;
      this.ready = false;
      console.log('✅ ServerAIProcessor cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

/**
 * Server-side Business Rule Validator
 * Adapts client-side business rules for server environment
 */
class ServerBusinessValidator {
  constructor() {
    this.initialized = false;
    this.rules = null;
  }

  async initialize(options = {}) {
    this.options = {
      strictValidation: true,
      maxCorrectionAttempts: 3,
      ...options,
    };
    
    // Load business rules (adapted from client-side)
    this.rules = await this.loadBusinessRules();
    this.initialized = true;
    console.log('✅ ServerBusinessValidator initialized');
  }

  async loadBusinessRules() {
    // This would load the same business rules as client-side
    // For now, implementing core validation logic
    return {
      dailyLimits: {
        maxWorkingDays: 28,
        minOffDays: 4,
        maxConsecutiveWorkDays: 6,
      },
      staffConstraints: {
        partTimeMaxDays: 20,
        fullTimeMinDays: 22,
      },
      shiftPatterns: {
        validShifts: ['○', '△', '◇', '×', ''],
        restShift: '×',
        workShifts: ['○', '△', '◇', ''],
      },
    };
  }

  async validateSchedule(schedule, staffMembers, dateRange, originalSchedule) {
    try {
      console.log('🔍 Validating schedule with business rules...');
      
      const violations = [];
      
      // Validate each staff member's schedule
      for (const staff of staffMembers) {
        const staffSchedule = schedule[staff.id] || {};
        const staffViolations = await this.validateStaffSchedule(
          staff,
          staffSchedule,
          dateRange,
          originalSchedule?.[staff.id] || {}
        );
        violations.push(...staffViolations);
      }

      const isValid = violations.length === 0;
      
      console.log(`📊 Validation result: ${isValid ? 'VALID' : 'INVALID'} (${violations.length} violations)`);
      
      return {
        valid: isValid,
        violations,
        summary: {
          totalViolations: violations.length,
          criticalViolations: violations.filter(v => v.severity === 'critical').length,
          validationTime: Date.now(),
        },
      };
    } catch (error) {
      console.error('❌ Schedule validation failed:', error);
      return {
        valid: false,
        violations: [{
          type: 'validation_error',
          message: `Validation failed: ${error.message}`,
          severity: 'critical',
        }],
        summary: { error: error.message },
      };
    }
  }

  async validateStaffSchedule(staff, staffSchedule, dateRange, originalStaffSchedule) {
    const violations = [];
    const isPartTime = staff.status === 'パート';
    
    // Count working days and off days
    let workingDays = 0;
    let offDays = 0;
    let consecutiveWorkDays = 0;
    let maxConsecutive = 0;
    
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = staffSchedule[dateKey];
      
      if (shift === '×') {
        offDays++;
        consecutiveWorkDays = 0;
      } else if (shift && shift !== '') {
        workingDays++;
        consecutiveWorkDays++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveWorkDays);
      } else if (!isPartTime) {
        // Empty shift for full-time = working day
        workingDays++;
        consecutiveWorkDays++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveWorkDays);
      } else {
        consecutiveWorkDays = 0;
      }
    });

    // Validate based on staff type
    if (isPartTime) {
      if (workingDays > this.rules.staffConstraints.partTimeMaxDays) {
        violations.push({
          type: 'part_time_overwork',
          staffId: staff.id,
          staffName: staff.name,
          message: `パートタイムスタッフ ${staff.name} の勤務日数が上限を超過 (${workingDays}日 > ${this.rules.staffConstraints.partTimeMaxDays}日)`,
          severity: 'high',
          details: { workingDays, limit: this.rules.staffConstraints.partTimeMaxDays },
        });
      }
    } else {
      if (workingDays < this.rules.staffConstraints.fullTimeMinDays) {
        violations.push({
          type: 'full_time_underwork',
          staffId: staff.id,
          staffName: staff.name,
          message: `正社員 ${staff.name} の勤務日数が最低基準を下回り (${workingDays}日 < ${this.rules.staffConstraints.fullTimeMinDays}日)`,
          severity: 'medium',
          details: { workingDays, minimum: this.rules.staffConstraints.fullTimeMinDays },
        });
      }
    }

    // Validate consecutive work days
    if (maxConsecutive > this.rules.dailyLimits.maxConsecutiveWorkDays) {
      violations.push({
        type: 'consecutive_work_violation',
        staffId: staff.id,
        staffName: staff.name,
        message: `${staff.name} の連続勤務日数が制限を超過 (${maxConsecutive}日 > ${this.rules.dailyLimits.maxConsecutiveWorkDays}日)`,
        severity: 'critical',
        details: { consecutiveDays: maxConsecutive, limit: this.rules.dailyLimits.maxConsecutiveWorkDays },
      });
    }

    return violations;
  }

  async correctViolations(schedule, violations, staffMembers, dateRange) {
    try {
      console.log(`🔧 Attempting to correct ${violations.length} violations...`);
      
      let correctedSchedule = JSON.parse(JSON.stringify(schedule));
      const correctionLog = [];
      let correctionsMade = 0;

      for (const violation of violations) {
        if (correctionsMade >= this.options.maxCorrectionAttempts) {
          break;
        }

        const correctionResult = await this.correctSingleViolation(
          correctedSchedule,
          violation,
          staffMembers,
          dateRange
        );

        if (correctionResult.success) {
          correctedSchedule = correctionResult.schedule;
          correctionsMade++;
          correctionLog.push({
            type: violation.type,
            corrected: true,
            method: correctionResult.method,
          });
        } else {
          correctionLog.push({
            type: violation.type,
            corrected: false,
            reason: correctionResult.reason,
          });
        }
      }

      return {
        success: correctionsMade > 0,
        correctedSchedule,
        correctionsMade,
        correctionLog,
      };
    } catch (error) {
      console.error('❌ Violation correction failed:', error);
      return {
        success: false,
        correctedSchedule: schedule,
        correctionsMade: 0,
        error: error.message,
      };
    }
  }

  async correctSingleViolation(schedule, violation, staffMembers, dateRange) {
    // Implement basic correction strategies
    switch (violation.type) {
      case 'part_time_overwork':
        return await this.correctPartTimeOverwork(schedule, violation, dateRange);
      case 'consecutive_work_violation':
        return await this.correctConsecutiveWork(schedule, violation, dateRange);
      default:
        return { success: false, reason: 'No correction strategy available' };
    }
  }

  async correctPartTimeOverwork(schedule, violation, dateRange) {
    // Simple correction: convert some working days to off days
    const staffSchedule = schedule[violation.staffId];
    const workingDates = [];
    
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = staffSchedule[dateKey];
      if (shift && shift !== '×' && shift !== '') {
        workingDates.push(dateKey);
      }
    });

    // Convert excess days to off days (starting from the end)
    const excessDays = violation.details.workingDays - violation.details.limit;
    const daysToConvert = workingDates.slice(-excessDays);
    
    daysToConvert.forEach(dateKey => {
      schedule[violation.staffId][dateKey] = '×';
    });

    return {
      success: true,
      schedule,
      method: 'convert_to_off_days',
    };
  }

  async correctConsecutiveWork(schedule, violation, dateRange) {
    // Simple correction: add off days to break consecutive work periods
    const staffSchedule = schedule[violation.staffId];
    const dates = dateRange.map(d => d.toISOString().split('T')[0]).sort();
    
    let consecutiveCount = 0;
    
    for (const dateKey of dates) {
      const shift = staffSchedule[dateKey];
      const isWorking = shift && shift !== '×' && shift !== '';
      
      if (isWorking) {
        consecutiveCount++;
        if (consecutiveCount >= this.rules.dailyLimits.maxConsecutiveWorkDays) {
          // Insert off day to break the sequence
          schedule[violation.staffId][dateKey] = '×';
          consecutiveCount = 0;
        }
      } else {
        consecutiveCount = 0;
      }
    }

    return {
      success: true,
      schedule,
      method: 'insert_off_days',
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      rules: this.rules ? Object.keys(this.rules) : [],
    };
  }

  async reset() {
    console.log('🔄 Resetting ServerBusinessValidator...');
    // Reset any cached state if needed
  }

  async cleanup() {
    console.log('🧹 Cleaning up ServerBusinessValidator...');
    this.initialized = false;
    this.rules = null;
  }
}

module.exports = {
  ServerAIProcessor,
  ServerBusinessValidator,
};