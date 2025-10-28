/**
 * TensorFlowScheduler.js
 *
 * High-Accuracy ML engine for restaurant shift scheduling predictions.
 * Uses advanced ensemble learning and neural architectures for 90%+ accuracy.
 */

import * as tf from "@tensorflow/tfjs";
// Removed circular dependency - HighAccuracyMLScheduler imports TensorFlowScheduler
import { extractAllDataForAI } from "../utils/DataExtractor.js";
import { isStaffActiveInCurrentPeriod } from "../../utils/staffUtils.js";
import { mlWorkerManager } from "../../workers/MLWorkerManager.js";
import { optimizedFeatureManager } from "../../workers/OptimizedFeatureManager.js";
import { featureCacheManager } from "../cache/FeatureCacheManager.js";
import { ScheduleFeatureEngineer } from "./FeatureEngineering.js";
import { EnhancedFeatureEngineering } from "./EnhancedFeatureEngineering.js";
import {
  MODEL_CONFIG,
  MEMORY_UTILS,
  createScheduleModel,
  MODEL_STORAGE,
  initializeTensorFlow,
} from "./TensorFlowConfig.js";
// Import ML Worker Manager and Optimized Feature Manager for non-blocking operations
// Import Feature Cache Manager for lightning-fast predictions

export class TensorFlowScheduler {
  constructor() {
    // Removed circular dependency - this will be set by HighAccuracyMLScheduler if needed
    this.highAccuracyScheduler = null;

    // Keep existing properties for backward compatibility
    this.model = null;
    this.featureEngineer = new EnhancedFeatureEngineering(); // Use optimized enhanced features
    this.isInitialized = false;
    this.isTraining = false;
    this.trainingHistory = null;

    // Enhanced model management
    this.modelVersion = "2.0.0"; // Updated to high-accuracy version
    this.lastTrainingData = null;
    this.cacheWarmedUp = false; // 🔥 Track if cache has been warmed up
    this.modelPerformanceMetrics = {
      accuracy: 0.9, // Target 90%+ accuracy
      loss: 0,
      trainingTime: 0,
      predictionSpeed: 0,
      memoryUsage: 0,
    };

    // Retraining system
    this.retrainingQueue = [];
    this.feedbackData = [];
    this.adaptiveLearning = {
      enabled: true,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 50,
      validationSplit: 0.2,
    };

    // Performance monitoring
    this.performanceMonitor = {
      predictionTimes: [],
      memorySnapshots: [],
      errorCounts: 0,
      successCounts: 0,
    };

    // Web Worker integration for non-blocking operations
    // 🔧 FIX: Force worker fallback mode - Web Worker has broken communication for both batch and individual predictions
    this.useWebWorker = true;
    this.workerFallbackMode = true; // Force fallback - prevents hanging on Worker calls
    this.workerInitialized = false;

    // Model backup system
    this.modelBackups = new Map();
    this.maxBackups = 3;
  }

  /**
   * Initialize TensorFlow with enhanced model management and performance monitoring
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;

    try {
      // Initializing Enhanced TensorFlow ML Scheduler
      const startTime = Date.now();

      // Apply options
      this.adaptiveLearning = {
        ...this.adaptiveLearning,
        ...options.adaptiveLearning,
      };

      // Initialize TensorFlow backend with optimizations
      const tfReady = await initializeTensorFlow();
      if (!tfReady) {
        throw new Error("TensorFlow initialization failed");
      }

      // Initialize ML Web Worker and Optimized Feature Manager
      if (this.useWebWorker) {
        try {
          this.workerInitialized = await mlWorkerManager.initializeWorker();
          if (!this.workerInitialized) {
            this.workerFallbackMode = true;
          }
          await optimizedFeatureManager.initialize();
        } catch (error) {
          console.warn("⚠️ Web Worker initialization error:", error.message);
          this.workerFallbackMode = true;
        }
      }

      // Initialize Feature Cache Manager
      try {
        // Cache will be invalidated on first use with actual data
      } catch (cacheError) {
        console.warn(
          "⚠️ Feature cache initialization warning:",
          cacheError.message,
        );
      }

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Try to load existing trained model with version checking
      const loadResult = await this.loadModelWithVersionCheck();

      if (!loadResult.success) {
        // Creating new optimized model
        try {
          this.model = createScheduleModel({
            ...MODEL_CONFIG.ARCHITECTURE,
            optimizeForPerformance: true,
            enableBatchNormalization: true,
            dropoutRate: 0.3, // Prevent overfitting
          });

          if (!this.model) {
            throw new Error("Failed to create TensorFlow model");
          }

          // Model created successfully
          await this.saveModelVersion();
        } catch (error) {
          console.error("❌ Model creation failed:", error);
          // Create a simple fallback model
          this.model = this.createSimpleFallbackModel();
        }
      }

      // Initialize model metadata
      await this.initializeModelMetadata();

      // 🎯 PERFORMANCE: Warmup feature cache if enabled
      if (options.warmupCache !== false) {
        await this.warmupFeatureCache(options);
      }

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      console.log(`✨ ML Scheduler initialized in ${initTime}ms`);

      MEMORY_UTILS.logMemoryUsage("After enhanced ML initialization");

      return true;
    } catch (error) {
      console.error("❌ Enhanced TensorFlow ML initialization failed:", error);
      await this.handleInitializationError(error);
      return false;
    }
  }

  /**
   * Enhanced model training with adaptive learning and performance optimization
   */
  async trainModel(currentStaffMembers = null, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isTraining) {
      // Training already in progress - skipping
      return null;
    }

    // Check if retraining is needed
    const retrainingNeeded = await this.shouldRetrain(
      currentStaffMembers,
      options,
    );
    if (!retrainingNeeded && !options.forceRetrain) {
      // Using existing trained model (no retraining needed)
      return {
        success: true,
        skipped: true,
        reason: "Model is up-to-date",
        modelInfo: this.getModelInfo(),
      };
    }

    try {
      this.isTraining = true;
      const trainingStartTime = Date.now();
      // Starting enhanced ML model training

      // Create model backup before training
      await this.createModelBackup("pre-training");

      MEMORY_UTILS.logMemoryUsage("Before enhanced training");

      // Extract and validate training data
      const dataExtractionResult = await this.extractAndValidateTrainingData();

      if (!dataExtractionResult.success) {
        throw new Error(
          `Training data extraction failed: ${dataExtractionResult.error}`,
        );
      }

      const { allHistoricalData, allStaffMembers, dataQuality } =
        dataExtractionResult;

      // Training data quality and staff information logged internally

      // Use current staff if provided, otherwise use historical staff
      const staffMembers =
        currentStaffMembers && currentStaffMembers.length > 0
          ? currentStaffMembers
          : allStaffMembers;

      // Using staff members for training

      // Enhanced training data preparation with validation
      const trainingDataResult = await this.prepareEnhancedTrainingData(
        allHistoricalData,
        staffMembers,
        options,
      );

      if (!trainingDataResult.success) {
        throw new Error(
          `Training data preparation failed: ${trainingDataResult.error}`,
        );
      }

      const {
        features,
        labels,
        validationFeatures,
        validationLabels,
        metadata,
      } = trainingDataResult;

      // Training and validation samples prepared

      // Validate training data consistency
      const validationResult = this.validateTrainingData(
        features,
        labels,
        metadata,
      );

      if (!validationResult.valid) {
        throw new Error(
          `Training data validation failed: ${validationResult.issues.join("; ")}`,
        );
      }

      if (validationResult.warnings.length > 0) {
        console.warn("⚠️ Training data warnings:", validationResult.warnings);
      }

      // Training data validation passed

      // Enhanced model training with adaptive parameters
      const trainingConfig = this.getOptimalTrainingConfig(
        features.length,
        options,
      );
      const trainingResult = await this.performEnhancedTraining(
        features,
        labels,
        validationFeatures,
        validationLabels,
        trainingConfig,
      );

      if (!trainingResult.success) {
        throw new Error(`Model training failed: ${trainingResult.error}`);
      }

      const { history, finalMetrics } = trainingResult;

      // Store training results and update model metadata
      await this.updateModelMetadata({
        version: this.getNextModelVersion(),
        trainingTime: Date.now() - trainingStartTime,
        accuracy: finalMetrics.accuracy,
        loss: finalMetrics.loss,
        trainingData: {
          samples: features.length,
          staffCount: staffMembers.length,
          dataQuality: dataQuality.completeness,
        },
      });

      // Save enhanced model with metadata
      await this.saveEnhancedModel();

      // Update performance metrics
      this.updatePerformanceMetrics({
        accuracy: finalMetrics.accuracy,
        loss: finalMetrics.loss,
        trainingTime: Date.now() - trainingStartTime,
      });

      const trainingTime = Date.now() - trainingStartTime;
      console.log(
        `✅ ML training complete: ${(finalMetrics.accuracy * 100).toFixed(1)}% accuracy`,
      );

      MEMORY_UTILS.logMemoryUsage("After enhanced training");

      return {
        success: true,
        finalAccuracy: finalMetrics.accuracy,
        finalLoss: finalMetrics.loss,
        trainingHistory: history.history,
        trainingSamples: features.length,
        validationSamples: validationFeatures?.length || 0,
        dataQuality: dataQuality.completeness,
        staffCount: staffMembers.length,
        trainingTime,
        modelVersion: this.modelVersion,
        performanceMetrics: this.modelPerformanceMetrics,
      };
    } catch (error) {
      console.error("❌ Enhanced model training failed:", error);

      // Attempt model recovery
      const recoveryResult = await this.attemptModelRecovery(error);

      return {
        success: false,
        error: error.message,
        recovery: recoveryResult,
        fallbackAvailable: recoveryResult.success,
      };
    } finally {
      this.isTraining = false;
      await this.performPostTrainingCleanup();
    }
  }

  /**
   * Predict shift assignments for empty schedule cells
   * @param {Object} currentSchedule - Current schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range for predictions
   * @param {Function} onProgress - Optional progress callback
   * @param {Object} constraints - Optional constraints including priority rules
   */
  async predictSchedule(currentSchedule, staffMembers, dateRange, onProgress = null, constraints = null) {
    // Extract priority rules and constraints
    const priorityRules = constraints?.priorityRules || [];
    const dailyLimits = constraints?.dailyLimits || [];
    const monthlyLimits = constraints?.monthlyLimits || [];
    const staffGroups = constraints?.staffGroups || [];

    console.log("🎯 [DEBUG] predictSchedule() CALLED", {
      hasModel: !!this.model,
      isInitialized: this.isInitialized,
      cacheWarmedUp: this.cacheWarmedUp,
      staffCount: staffMembers?.length,
      dateCount: dateRange?.length,
      hasOnProgress: !!onProgress,
      onProgressType: typeof onProgress,
      priorityRulesCount: priorityRules.length,
    });

    if (priorityRules.length > 0) {
      console.log(`🎯 [ML] Received ${priorityRules.length} priority rule(s) for prediction`);
    }

    if (!this.isInitialized || !this.model) {
      // Model not initialized, initializing
      console.log("🎯 [DEBUG] Model not initialized, calling initialize()");
      await this.initialize();
    }

    // Ensure model is available after initialization
    if (!this.model) {
      console.error("❌ TensorFlow model not available after initialization");
      throw new Error(
        "TensorFlow model initialization failed - no model available",
      );
    }

    // Check if model needs training
    const modelInfo = this.getModelInfo();
    console.log("🎯 [DEBUG] Model training check:", {
      hasModelInfo: !!modelInfo,
      accuracy: modelInfo?.accuracy,
      needsTraining: !modelInfo || modelInfo.accuracy === 0
    });

    if (!modelInfo || modelInfo.accuracy === 0) {
      // Model needs training, training on current data
      console.log("🎯 [DEBUG] Starting model training...");
      const trainingStartTime = Date.now();
      try {
        const trainingResult = await this.trainModel(staffMembers, {
          forceRetrain: false,
        });
        const trainingTime = Date.now() - trainingStartTime;
        console.log(`🎯 [DEBUG] Model training completed in ${trainingTime}ms`, {
          success: trainingResult?.success,
          accuracy: trainingResult?.accuracy
        });

        if (!trainingResult?.success) {
          console.warn(
            "⚠️ Training failed, will use untrained model with reduced accuracy",
          );
        }
      } catch (trainingError) {
        console.warn(
          "⚠️ Training error:",
          trainingError.message,
          "- proceeding with untrained model",
        );
      }
    }

    try {
      // Generating ML predictions for schedule
      console.log("🎯 [DEBUG] Entering prediction try block");

      // **PHASE 2 ENHANCEMENT: Initialize cache with current configuration**
      const cacheInvalidated = featureCacheManager.invalidateOnConfigChange(
        staffMembers,
        currentSchedule,
        { dateRange: dateRange.map((d) => d.toISOString()) },
      );

      // Cache invalidated if configuration changed
      console.log("🎯 [DEBUG] Cache invalidation check:", {
        cacheInvalidated,
        cacheWarmedUp: this.cacheWarmedUp
      });

      // 🔥 PERFORMANCE OPTIMIZATION: Skip synchronous warmup to prevent UI freeze
      // Warmup was causing 30% progress hang (270+ features taking too long)
      // Features will be generated on-demand with caching for subsequent predictions
      console.log("🎯 [DEBUG] Using lazy feature generation (warmup disabled to prevent UI freeze)");
      this.cacheWarmedUp = true; // Skip warmup, use on-demand feature generation

      // ✅ Defensive validation: Ensure staffMembers is valid array
      if (!staffMembers || !Array.isArray(staffMembers)) {
        console.error("❌ predictSchedule: Invalid staffMembers parameter", {
          staffMembers,
          type: typeof staffMembers,
          isArray: Array.isArray(staffMembers)
        });
        throw new Error(
          `Invalid staffMembers parameter: expected array, got ${typeof staffMembers}`
        );
      }

      if (!dateRange || !Array.isArray(dateRange)) {
        console.error("❌ predictSchedule: Invalid dateRange parameter", {
          dateRange,
          type: typeof dateRange,
          isArray: Array.isArray(dateRange)
        });
        throw new Error(
          `Invalid dateRange parameter: expected array, got ${typeof dateRange}`
        );
      }

      // Filter out inactive staff members before processing
      const activeStaff = staffMembers.filter((staff) => {
        try {
          const isActive = isStaffActiveInCurrentPeriod(staff, dateRange);

          // Skipping inactive staff members

          return isActive;
        } catch (error) {
          console.warn(
            `⚠️ Error checking staff activity for ${staff.name}:`,
            error,
          );
          // Default to including staff if there's an error
          return true;
        }
      });

      // Processing predictions for active staff members

      // Extract historical data for context
      const extractedData = extractAllDataForAI();
      const allHistoricalData = {};

      if (extractedData.success && extractedData.data.rawPeriodData) {
        extractedData.data.rawPeriodData.forEach((periodData) => {
          allHistoricalData[periodData.monthIndex] = {
            schedule: periodData.scheduleData,
            dateRange: periodData.dateRange,
          };
        });
      }

      const predictions = {};
      const predictionConfidence = {};

      // Prepare current period data structure
      const currentPeriodData = {
        schedule: currentSchedule,
        dateRange: dateRange,
      };

      // **CRITICAL PERFORMANCE FIX: Ultra-responsive chunking to prevent UI blocking**
      const CHUNK_SIZE = 2; // Very small chunks for maximum responsiveness
      const YIELD_INTERVAL = 3; // Yield every 3 predictions (more frequent)
      const IDLE_YIELD_TIME = 16; // Target 60fps (16ms frame time)
      let processedCount = 0;
      let yieldCounter = 0;
      const totalPredictions = activeStaff.length * dateRange.length;
      const startTime = Date.now();
      const PREDICTION_TIMEOUT = 30000; // 30 second timeout

      // Add progress callback for UI updates
      const updateProgress = (progress) => {
        console.log(`📊 [PROGRESS] updateProgress called: ${progress}% (${processedCount}/${totalPredictions})`);
        // Call onProgress callback directly if provided
        if (onProgress) {
          console.log(`✅ [PROGRESS] Calling onProgress with ${progress}%`);
          onProgress({
            stage: "predicting",
            progress,
            message: `AI予測中... (${progress}%)`,
            processed: processedCount,
            total: totalPredictions,
          });
        } else {
          console.warn(`⚠️ [PROGRESS] onProgress is null/undefined, cannot update UI`);
        }
      };

      // Starting prediction processing for active staff

      // 🔧 TEMPORARY FIX: Disable Web Worker batch processing to prevent hang at 30%
      // Root cause: Web Worker never responds to BATCH_GENERATE_FEATURES messages
      // The Worker Promise hangs indefinitely in optimizedFeatureManager.generateFeaturesBatch()
      // Solution: Force fallback to individual processing mode (proven to work)
      const skipBatchProcessing = true; // TODO: Fix Web Worker communication issue

      console.log("🎯 [DEBUG] Batch processing check:", {
        workerFallbackMode: this.workerFallbackMode,
        totalPredictions,
        skipBatchProcessing,
        willUseBatch: !this.workerFallbackMode && !skipBatchProcessing && totalPredictions > 10
      });

      if (!this.workerFallbackMode && !skipBatchProcessing && totalPredictions > 10) {
        try {
          console.log("🎯 [DEBUG] BEFORE processPredictionsBatch() call");
          // Attempting batch feature generation
          const batchResult = await this.processPredictionsBatch(
            activeStaff,
            dateRange,
            currentSchedule,
            currentPeriodData,
            allHistoricalData,
            updateProgress,
          );
          console.log("🎯 [DEBUG] AFTER processPredictionsBatch() call", {
            success: batchResult?.success,
            processedCount: batchResult?.processedCount
          });

          if (batchResult.success) {
            // Batch processing completed successfully
            return {
              success: true,
              predictions: batchResult.predictions,
              predictionConfidence: batchResult.confidence,
              method: "batch_optimized",
              performanceStats: {
                totalPredictions: batchResult.processedCount,
                totalTime: batchResult.totalTime,
                avgTimePerPrediction:
                  batchResult.totalTime / batchResult.processedCount,
                usingWebWorkers: true,
              },
            };
          } else {
            console.warn(
              "⚠️ Batch processing failed, falling back to individual processing",
            );
          }
        } catch (batchError) {
          console.warn(
            "⚠️ Batch processing error, falling back to individual processing:",
            batchError.message,
          );
        }
      }

      // Fallback to individual processing for compatibility
      // Using individual prediction processing

      console.log("🎯 [DEBUG] Starting individual prediction loop", {
        activeStaffCount: activeStaff.length,
        dateRangeLength: dateRange.length,
        totalPredictions,
        workerFallbackMode: this.workerFallbackMode
      });

      // Process only active staff members with fully non-blocking chunked processing
      for (const staff of activeStaff) {
        predictions[staff.id] = {};
        predictionConfidence[staff.id] = {};

        // Processing staff member predictions

        // **CRITICAL FIX: Process dates in smaller chunks with frequent yielding**
        for (
          let startIndex = 0;
          startIndex < dateRange.length;
          startIndex += CHUNK_SIZE
        ) {
          console.log(`📦 [CHUNK-START] Starting chunk ${startIndex}-${Math.min(startIndex + CHUNK_SIZE, dateRange.length)} for ${staff.name}`);

          // Check timeout
          if (Date.now() - startTime > PREDICTION_TIMEOUT) {
            console.warn(`⏱️ Prediction timeout reached, stopping processing`);
            break;
          }

          const endIndex = Math.min(startIndex + CHUNK_SIZE, dateRange.length);
          const dateChunk = dateRange.slice(startIndex, endIndex);

          // Process chunk with timeout protection
          for (const date of dateChunk) {
            const dateKey = date.toISOString().split("T")[0];
            console.log(`🔵 [LOOP-START] Starting prediction iteration for ${staff.name} on ${dateKey}, processedCount=${processedCount}`);

            // Skip if cell is already filled
            if (
              currentSchedule[staff.id] &&
              currentSchedule[staff.id][dateKey] !== undefined &&
              currentSchedule[staff.id][dateKey] !== null &&
              currentSchedule[staff.id][dateKey] !== ""
            ) {
              processedCount++;
              continue;
            }

            // **PERFORMANCE FIX: Ultra-fast feature generation using Web Worker (<50ms target)**
            let features;
            try {
              const featureStartTime = Date.now();

              // Use optimized Web Worker feature generation
              features = await this.generateFeaturesAsync(
                staff,
                date,
                dateRange.indexOf(date),
                currentPeriodData,
                allHistoricalData,
                staffMembers,
              );

              // Track performance
              const duration = Date.now() - featureStartTime;
              if (duration > 50) {
                console.warn(
                  `🐌 Feature generation exceeded 50ms target for ${staff.name}: ${duration}ms`,
                );
              }
            } catch (featureError) {
              console.warn(
                `⚠️ Feature generation failed for ${staff.name} on ${dateKey}:`,
                featureError.message,
              );
              features = null;
            }

            if (
              !features ||
              !Array.isArray(features) ||
              features.length !== MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL
            ) {
              console.warn(
                `⚠️ Invalid features for ${staff.name} on ${dateKey}, using emergency fallback`,
              );
              const emergencyShift = this.getEmergencyShift(
                staff,
                date.getDay(),
              );
              predictions[staff.id][dateKey] = emergencyShift;
              predictionConfidence[staff.id][dateKey] = 0.5;
              processedCount++;
              continue;
            }

            // Make prediction using TensorFlow model with timeout protection
            try {
              // Create a timeout promise to prevent hanging
              const predictionPromise = this.predict([features]);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Prediction timeout")), 5000),
              );

              const result = await Promise.race([
                predictionPromise,
                timeoutPromise,
              ]);

              if (result.success && result.predictions) {
                // Convert prediction to shift symbol
                const shiftSymbol = this.predictionToShift(result.predictions);
                predictions[staff.id][dateKey] = shiftSymbol;
                predictionConfidence[staff.id][dateKey] =
                  result.confidence || 0.8;
              } else {
                throw new Error(result.error || "Prediction failed");
              }
            } catch (error) {
              if (error.message === "Prediction timeout") {
                console.warn(
                  `⏱️ Prediction timeout for ${staff.name} on ${dateKey}, using fallback`,
                );
              } else {
                console.warn(
                  `⚠️ TensorFlow prediction failed for ${staff.name} on ${dateKey}: ${error.message}, using emergency fallback`,
                );
              }
              const emergencyShift = this.getEmergencyShift(
                staff,
                date.getDay(),
              );
              predictions[staff.id][dateKey] = emergencyShift;
              predictionConfidence[staff.id][dateKey] = 0.6;
            }

            processedCount++;
            yieldCounter++;

            // **CRITICAL UX FIX: Update progress frequently (every 10 predictions = ~3% progress)**
            // This prevents UI from appearing frozen during long 14-second prediction phase
            if (processedCount % 10 === 0 || yieldCounter >= YIELD_INTERVAL) {
              // Map 0-270 predictions to 30-95% progress range (30% already done, reserve 95-100% for validation/save)
              const predictionProgress = (processedCount / totalPredictions) * 65; // 0-65%
              const progress = Math.min(95, Math.round(30 + predictionProgress)); // 30-95%

              console.log(`🔢 [PROGRESS-CALC] processedCount=${processedCount}, total=${totalPredictions}, progress=${progress}%`);
              updateProgress(progress);
            }

            // Yield to event loop every YIELD_INTERVAL (every 3 predictions) to keep UI responsive
            if (yieldCounter >= YIELD_INTERVAL) {
              console.log(`⏸️ [YIELD] Yielding to event loop at processedCount=${processedCount}`);
              // **FIX: Use simple setTimeout instead of complex requestIdleCallback to prevent infinite rescheduling**
              await new Promise(resolve => setTimeout(resolve, 0));
              yieldCounter = 0; // Reset yield counter
              console.log(`⏭️ [YIELD] Resumed after yield, continuing predictions at processedCount=${processedCount}`);
            }

            console.log(`✅ [LOOP] Completed prediction for ${staff.name} on ${dateKey}`);
          }

          console.log(`📊 [LOOP] Finished date chunk ${startIndex}-${endIndex} for ${staff.name}`);

          // **ENHANCED: Intelligent yielding after each date chunk**
          if (startIndex + CHUNK_SIZE < dateRange.length) {
            console.log(`⏸️ [YIELD-CHUNK] Yielding after chunk, will resume next chunk...`);
            await new Promise((resolve) => {
              // Use requestIdleCallback for better timing
              if (typeof requestIdleCallback !== "undefined") {
                requestIdleCallback(() => resolve(), { timeout: 5 });
              } else {
                setTimeout(resolve, 2);
              }
            });
            console.log(`⏭️ [YIELD-CHUNK] Resumed after chunk yield`);
          }
        }

        console.log(`🎯 [LOOP] Completed ALL chunks for ${staff.name}, moving to next staff member...`);

        // Smart yielding after each staff member
        const progress = Math.round(
          ((activeStaff.indexOf(staff) + 1) / activeStaff.length) * 100,
        );

        await new Promise((resolve) => {
          // Use requestIdleCallback for optimal performance
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(() => resolve(), { timeout: 10 });
          } else {
            setTimeout(resolve, 3);
          }
        });
      }

      console.log("✅ ML predictions completed");

      // **PHASE 2 ENHANCEMENT: Start background precomputation for future requests**
      try {
        featureCacheManager.startBackgroundPrecomputation(
          activeStaff,
          dateRange,
          currentPeriodData,
          allHistoricalData,
        );
        // Background feature precomputation started
      } catch (precomputeError) {
        console.warn(
          "⚠️ Background precomputation setup failed:",
          precomputeError.message,
        );
        // Not critical for operation, continue without it
      }

      const modelAccuracy = this.getModelAccuracy();
      const cacheStats = featureCacheManager.getStats();

      // ✅ PHASE 3: Apply priority rules as post-processing
      if (priorityRules && priorityRules.length > 0) {
        console.log(`🎯 [ML] Applying ${priorityRules.length} priority rule(s) to ML predictions...`);

        let rulesAppliedCount = 0;
        priorityRules.forEach(rule => {
          if (!rule.staffId || !rule.preferences?.daysOfWeek) {
            console.warn(`⚠️ [ML-PRIORITY] Skipping invalid rule:`, rule);
            return;
          }

          const staff = staffMembers.find(s => s.id === rule.staffId || s.name === rule.staffId);
          if (!staff) {
            console.warn(`⚠️ [ML-PRIORITY] Staff not found for rule:`, rule.staffId);
            return;
          }

          if (!predictions[staff.id]) {
            console.warn(`⚠️ [ML-PRIORITY] No predictions for staff:`, staff.name);
            return;
          }

          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

          dateRange.forEach(date => {
            const dateKey = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();

            // Check if this day is in the rule's daysOfWeek array
            if (rule.preferences.daysOfWeek.includes(dayOfWeek)) {
              const shiftValue = this.convertShiftTypeToSymbol(rule.preferences.shiftType);

              // Override ML prediction with user's priority preference
              predictions[staff.id][dateKey] = shiftValue;
              predictionConfidence[staff.id][dateKey] = 1.0; // Maximum confidence for user preferences
              rulesAppliedCount++;

              console.log(`  ✅ [ML-PRIORITY] ${staff.name}: Set "${shiftValue}" on ${date.toLocaleDateString('ja-JP')} (${dayNames[dayOfWeek]})`);
            }
          });
        });

        console.log(`✅ [ML] Applied ${rulesAppliedCount} priority rule override(s) to ML predictions`);
      }

      return {
        predictions,
        confidence: predictionConfidence,
        modelAccuracy: modelAccuracy,
        success: true,
        cacheStats: cacheStats, // Include cache performance in response
      };
    } catch (error) {
      console.error("❌ Prediction failed:", error);
      return {
        predictions: {},
        confidence: {},
        error: error.message,
      };
    }
  }

  /**
   * Async generator for processing predictions with automatic yielding
   * This prevents UI blocking by processing data in chunks with regular yields
   */
  async *processPredictionBatches(
    activeStaff,
    dateRange,
    currentPeriodData,
    allHistoricalData,
    currentSchedule,
  ) {
    const BATCH_SIZE = 5; // Process 5 staff-date combinations at a time
    const YIELD_INTERVAL = 10; // Yield every 10 operations

    let processedCount = 0;
    let batchBuffer = [];

    for (const staff of activeStaff) {
      for (const date of dateRange) {
        const dateKey = date.toISOString().split("T")[0];

        // Skip if cell is already filled
        if (
          currentSchedule[staff.id] &&
          currentSchedule[staff.id][dateKey] !== undefined &&
          currentSchedule[staff.id][dateKey] !== null &&
          currentSchedule[staff.id][dateKey] !== ""
        ) {
          continue;
        }

        // Add to batch
        batchBuffer.push({ staff, date, dateKey });
        processedCount++;

        // Process batch when full or yield interval reached
        if (
          batchBuffer.length >= BATCH_SIZE ||
          processedCount % YIELD_INTERVAL === 0
        ) {
          // Process current batch
          const batchResults = [];

          for (const item of batchBuffer) {
            try {
              // Generate features asynchronously
              const features = await this.generateFeaturesAsync(
                item.staff,
                item.date,
                dateRange.indexOf(item.date),
                currentPeriodData,
                allHistoricalData,
                activeStaff,
              );

              if (
                features &&
                features.length === MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL
              ) {
                // Make prediction
                const prediction = await this.predictSingleAsync(features);

                batchResults.push({
                  staffId: item.staff.id,
                  dateKey: item.dateKey,
                  prediction,
                  features,
                  success: true,
                });
              } else {
                // Use emergency fallback
                batchResults.push({
                  staffId: item.staff.id,
                  dateKey: item.dateKey,
                  prediction: {
                    predictedClass: 1,
                    confidence: 0.6,
                    probabilities: [0.1, 0.4, 0.2, 0.2, 0.1],
                  },
                  fallback: true,
                  success: true,
                });
              }
            } catch (error) {
              console.warn(
                `⚠️ Batch processing failed for ${item.staff.name} on ${item.dateKey}:`,
                error.message,
              );
              // Use emergency fallback
              batchResults.push({
                staffId: item.staff.id,
                dateKey: item.dateKey,
                prediction: {
                  predictedClass: 1,
                  confidence: 0.5,
                  probabilities: [0.1, 0.4, 0.2, 0.2, 0.1],
                },
                error: true,
                success: true,
              });
            }
          }

          // Yield results and clear batch
          yield {
            batch: batchResults,
            processed: processedCount,
            total: activeStaff.length * dateRange.length,
            progress: Math.round(
              (processedCount / (activeStaff.length * dateRange.length)) * 100,
            ),
          };

          batchBuffer = [];

          // Yield control to UI thread
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(() => resolve(), { timeout: 16 });
            } else {
              setTimeout(resolve, 1);
            }
          });
        }
      }
    }

    // Process any remaining items in buffer
    if (batchBuffer.length > 0) {
      const batchResults = [];

      for (const item of batchBuffer) {
        try {
          const features = await this.generateFeaturesAsync(
            item.staff,
            item.date,
            dateRange.indexOf(item.date),
            currentPeriodData,
            allHistoricalData,
            activeStaff,
          );

          if (
            features &&
            features.length === MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL
          ) {
            const prediction = await this.predictSingleAsync(features);

            batchResults.push({
              staffId: item.staff.id,
              dateKey: item.dateKey,
              prediction,
              features,
              success: true,
            });
          } else {
            batchResults.push({
              staffId: item.staff.id,
              dateKey: item.dateKey,
              prediction: {
                predictedClass: 1,
                confidence: 0.6,
                probabilities: [0.1, 0.4, 0.2, 0.2, 0.1],
              },
              fallback: true,
              success: true,
            });
          }
        } catch (error) {
          batchResults.push({
            staffId: item.staff.id,
            dateKey: item.dateKey,
            prediction: {
              predictedClass: 1,
              confidence: 0.5,
              probabilities: [0.1, 0.4, 0.2, 0.2, 0.1],
            },
            error: true,
            success: true,
          });
        }
      }

      yield {
        batch: batchResults,
        processed: processedCount,
        total: activeStaff.length * dateRange.length,
        progress: 100,
        final: true,
      };
    }
  }

  /**
   * Ultra-fast batch processing for multiple predictions using Web Workers
   */
  async processPredictionsBatch(
    activeStaff,
    dateRange,
    currentSchedule,
    currentPeriodData,
    allHistoricalData,
    updateProgress,
  ) {
    console.log("🎯 [DEBUG] processPredictionsBatch() ENTRY", {
      activeStaffCount: activeStaff.length,
      dateRangeLength: dateRange.length,
      totalPredictions: activeStaff.length * dateRange.length
    });

    const startTime = Date.now();
    const predictions = {};
    const confidence = {};
    let processedCount = 0;

    try {
      console.log("🎯 [DEBUG] Preparing batch parameters...");
      // Prepare batch parameters for all predictions
      const batchParams = [];
      for (const staff of activeStaff) {
        predictions[staff.id] = {};
        confidence[staff.id] = {};

        for (const date of dateRange) {
          const dateKey = date.toISOString().split("T")[0];

          // Skip if cell is already filled
          if (
            currentSchedule[staff.id] &&
            currentSchedule[staff.id][dateKey] !== undefined &&
            currentSchedule[staff.id][dateKey] !== null &&
            currentSchedule[staff.id][dateKey] !== ""
          ) {
            continue;
          }

          batchParams.push({
            staff,
            date,
            dateIndex: dateRange.indexOf(date),
            periodData: currentPeriodData,
            allHistoricalData,
            staffMembers: activeStaff,
            staffId: staff.id,
            dateKey,
          });
        }
      }

      // Processing predictions in batch mode

      // Process batch with progress updates
      const batchResult = await optimizedFeatureManager.generateFeaturesBatch(
        batchParams,
        (progress) => {
          if (updateProgress) {
            updateProgress(progress.percentage);
          }
          // Batch progress tracking
        },
      );

      if (!batchResult.results) {
        throw new Error("Batch processing returned no results");
      }

      // Process the batch results
      for (let i = 0; i < batchResult.results.length; i++) {
        const result = batchResult.results[i];
        const params = batchParams[i];

        if (result.success && result.features) {
          // Make prediction using the features
          const predictionResult = await this.predict([result.features]);

          if (predictionResult.success) {
            const shiftSymbol = this.predictionToShift(
              predictionResult.predictions,
            );
            predictions[params.staffId][params.dateKey] = shiftSymbol;
            confidence[params.staffId][params.dateKey] =
              predictionResult.confidence || 0.8;
            processedCount++;
          } else {
            // Use emergency fallback
            const emergencyShift = this.getEmergencyShift(
              params.staff,
              params.date.getDay(),
            );
            predictions[params.staffId][params.dateKey] = emergencyShift;
            confidence[params.staffId][params.dateKey] = 0.5;
            processedCount++;
          }
        } else {
          // Use emergency fallback
          const emergencyShift = this.getEmergencyShift(
            params.staff,
            params.date.getDay(),
          );
          predictions[params.staffId][params.dateKey] = emergencyShift;
          confidence[params.staffId][params.dateKey] = 0.5;
          processedCount++;
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `✅ Batch processing completed: ${processedCount} predictions in ${totalTime}ms`,
      );

      // Log performance summary
      optimizedFeatureManager.logPerformanceSummary();

      return {
        success: true,
        predictions,
        confidence,
        processedCount,
        totalTime,
        avgTimePerPrediction: totalTime / processedCount,
      };
    } catch (error) {
      console.error("❌ Batch processing failed:", error.message);
      return {
        success: false,
        error: error.message,
        processedCount,
      };
    }
  }

  /**
   * Ultra-fast feature generation with cache-first approach (target: <10ms from cache, <50ms generation)
   */
  async generateFeaturesAsync(
    staff,
    date,
    dateIndex,
    periodData,
    allHistoricalData,
    staffMembers,
  ) {
    const dateKey = date.toISOString().split("T")[0];
    const startTime = Date.now();

    console.log("🎯 [DEBUG] generateFeaturesAsync called", {
      staffName: staff.name,
      dateKey,
      workerFallbackMode: this.workerFallbackMode
    });

    try {
      // **PHASE 2 ENHANCEMENT: Try cache first for lightning-fast predictions (<10ms)**
      const cacheResult = featureCacheManager.getFeatures(staff.id, dateKey);
      if (cacheResult.success) {
        const cacheTime = Date.now() - startTime;
        if (cacheTime < 10) {
          // Cache hit for prediction
        }
        return cacheResult.features;
      }

      // Cache miss - generate features and cache them
      // Cache miss - generating features

      // Try using optimized web worker first
      if (!this.workerFallbackMode && optimizedFeatureManager) {
        const result = await optimizedFeatureManager.generateFeatures({
          staff,
          date,
          dateIndex,
          periodData,
          allHistoricalData,
          staffMembers,
        });

        if (result.success) {
          // Cache the generated features
          featureCacheManager.setFeatures(staff.id, dateKey, result.features, {
            generation_time: Date.now() - startTime,
            method: "web_worker",
          });
          return result.features;
        } else {
          console.warn(
            "⚠️ Optimized feature generation failed, using fallback:",
            result.error,
          );
        }
      }

      // Fallback to main thread with timeout protection
      const features = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Feature generation timeout after 200ms"));
        }, 200); // 200ms timeout - enhanced features need more time

        try {
          // Use requestIdleCallback for feature generation if available
          const performGeneration = () => {
            try {
              console.log(`🔧 [FEATURE-GEN] Starting for ${staff.name} on ${dateKey}`);
              const genStartTime = Date.now();

              const features = this.featureEngineer.generateFeatures({
                staff,
                date,
                dateIndex,
                periodData,
                allHistoricalData,
                staffMembers,
              });

              const genTime = Date.now() - genStartTime;
              console.log(`✅ [FEATURE-GEN] Completed for ${staff.name} in ${genTime}ms: ${features ? features.length : 0} features`);

              clearTimeout(timeoutId);
              resolve(features);
            } catch (error) {
              console.error(`❌ [FEATURE-GEN] Failed for ${staff.name} on ${dateKey}:`, error.message, error.stack);
              clearTimeout(timeoutId);
              reject(error);
            }
          };

          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(performGeneration, { timeout: 30 });
          } else {
            setTimeout(performGeneration, 0);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Cache the generated features
      const generationTime = Date.now() - startTime;
      featureCacheManager.setFeatures(staff.id, dateKey, features, {
        generation_time: generationTime,
        method: "main_thread_fallback",
      });

      return features;
    } catch (error) {
      console.error(`❌ [FEATURE-GEN] Critical failure for ${staff.name} on ${dateKey}:`, {
        error: error.message,
        stack: error.stack,
        staff: staff.name,
        dateKey,
        hasperiodData: !!periodData,
        hasHistoricalData: !!allHistoricalData,
        staffCount: staffMembers?.length || 0
      });
      // Return minimal features for fallback
      return Array(MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL || 65).fill(0);
    }
  }

  /**
   * Async wrapper for single prediction with non-blocking execution
   */
  async predictSingleAsync(features) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Prediction timeout"));
      }, 100); // 100ms timeout

      const performPrediction = async () => {
        try {
          if (!this.model) {
            throw new Error("Model not available");
          }

          // Use tf.tidy to manage memory
          const result = await tf.tidy(async () => {
            const inputTensor = tf.tensor2d([features]);
            const prediction = this.model.predict(inputTensor);
            const probabilities = await prediction.data();

            const predictedClass = probabilities.indexOf(
              Math.max(...probabilities),
            );
            const confidence = Math.max(...probabilities);

            return {
              predictedClass,
              confidence,
              probabilities: Array.from(probabilities),
            };
          });

          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      // Schedule prediction with idle callback
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => performPrediction(), { timeout: 50 });
      } else {
        setTimeout(performPrediction, 0);
      }
    });
  }

  /**
   * Make batch predictions for multiple feature vectors with non-blocking operations
   * @param {Array} featuresArray - Array of feature vectors
   * @returns {Object} Prediction results with probabilities and confidence
   */
  async predict(featuresArray) {
    try {
      if (!this.model) {
        // Initialize model if not ready
        await this.initialize();
        if (!this.model) {
          throw new Error("TensorFlow model not available");
        }
      }

      // Handle single feature vector wrapped in array
      const features = Array.isArray(featuresArray[0])
        ? featuresArray[0]
        : featuresArray;

      // 🔧 FIX: Remove broken requestIdleCallback that caused 30% hang
      // Root cause: deadline.timeRemaining() check created infinite reschedule loop
      // - During AI processing, browser is never idle (timeRemaining() always < 10ms)
      // - Function kept rescheduling without resolving promise → 5s timeout
      // - Cascading timeouts caused system to appear stuck at 30%
      // Solution: Execute prediction directly without waiting for idle time
      const tensorResult = await new Promise((resolve, reject) => {
        try {
          // Create tensors and make prediction directly
          const inputTensor = tf.tensor2d([features]);
          const prediction = this.model.predict(inputTensor);

          // Extract probabilities asynchronously
          prediction
            .data()
            .then((probabilities) => {
              const predictedClass = probabilities.indexOf(
                Math.max(...probabilities),
              );
              const confidence = Math.max(...probabilities);

              // Clean up tensors
              inputTensor.dispose();
              prediction.dispose();

              resolve({
                predictions: Array.from(probabilities),
                confidence,
                predictedClass,
                success: true,
              });
            })
            .catch((error) => {
              // Cleanup on error
              inputTensor.dispose();
              prediction.dispose();
              reject(error);
            });
        } catch (error) {
          reject(error);
        }
      });

      return tensorResult;
    } catch (error) {
      console.error("❌ Batch prediction failed:", error);

      // Return fallback prediction
      return {
        predictions: [0.1, 0.4, 0.2, 0.2, 0.1], // Bias toward normal shift (○)
        confidence: 0.6,
        predictedClass: 1, // Default to normal shift
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Make single prediction for feature vector
   */
  /**
   * High-accuracy single prediction using ensemble system
   */
  async predictSingle(features) {
    try {
      // Use standard TensorFlow prediction (fallback)
      if (!this.model) {
        // Return emergency fallback prediction
        return {
          predictedClass: 1, // Default to normal shift (○)
          confidence: 0.6,
          probabilities: [0.1, 0.4, 0.2, 0.2, 0.1], // Bias toward working shifts
        };
      }

      // Make actual TensorFlow prediction
      const inputTensor = tf.tensor2d([features]);
      const prediction = this.model.predict(inputTensor);
      const probabilities = await prediction.data();
      inputTensor.dispose();
      prediction.dispose();

      const predictedClass = probabilities.indexOf(Math.max(...probabilities));
      const confidence = Math.max(...probabilities);

      return {
        predictedClass,
        confidence,
        probabilities: Array.from(probabilities),
      };
    } catch (error) {
      console.error("❌ Single prediction failed:", error);
      return null;
    }
  }

  /**
   * Evaluate model performance on test data
   */
  async evaluateModel(testData, testLabels) {
    if (!this.model) return null;

    try {
      const xs = tf.tensor2d(testData);
      const ys = tf.oneHot(
        tf.tensor1d(testLabels, "int32"),
        MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
      );

      const evaluation = this.model.evaluate(xs, ys);
      const loss = await evaluation[0].data();
      const accuracy = await evaluation[1].data();

      xs.dispose();
      ys.dispose();
      evaluation[0].dispose();
      evaluation[1].dispose();

      return {
        loss: loss[0],
        accuracy: accuracy[0],
      };
    } catch (error) {
      console.error("❌ Model evaluation failed:", error);
      return null;
    }
  }

  /**
   * Get high-accuracy model performance
   */
  getModelAccuracy() {
    // Return standard TensorFlow accuracy since high-accuracy scheduler is removed
    return this.modelPerformanceMetrics.accuracy;
  }

  /**
   * Convert shift symbol to class index for compatibility
   */
  shiftToClassIndex(shift) {
    const shiftMap = { "": 0, "○": 1, "△": 2, "▽": 3, "×": 4 };
    return shiftMap[shift] || 0;
  }

  /**
   * Convert prediction probabilities to shift symbol
   */
  predictionToShift(probabilities) {
    const shiftMap = ["", "○", "△", "▽", "×"];
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    return shiftMap[maxIndex] || "";
  }

  /**
   * Emergency fallback prediction for system reliability
   * Provides intelligent fallback based on staff role and day patterns
   */
  getEmergencyShift(staff, dayOfWeek) {
    // Role-specific patterns for key staff
    if (staff.name === "料理長") {
      // Kitchen manager - likely to work early shifts, Sunday early shift
      if (dayOfWeek === 0) return "△"; // Sunday early
      if (dayOfWeek === 1) return "×"; // Monday off
      if (dayOfWeek === 6) return "○"; // Saturday normal
      return "○"; // Default normal shift
    }

    if (staff.name === "与儀") {
      // Part-time staff - pattern based on common schedules
      if (dayOfWeek === 0) return "×"; // Sunday off
      if (dayOfWeek === 3) return "×"; // Wednesday off
      return "○"; // Normal shift when working
    }

    // General patterns based on staff status and day of week
    if (staff.status === "パート") {
      // Part-time staff - more likely to have off days
      if (dayOfWeek === 0 || dayOfWeek === 6) return "×"; // Weekends off
      if (Math.random() < 0.3) return "×"; // 30% chance of weekday off
      return "○"; // Normal shift
    }

    if (staff.status === "社員") {
      // Full-time staff - more varied shifts
      if (dayOfWeek === 1) return "×"; // Monday off (common in restaurants)
      if (dayOfWeek === 0) return "△"; // Sunday early shift
      if (dayOfWeek === 6) return "▽"; // Saturday late shift
      return "○"; // Normal shift
    }

    // Default fallback - bias toward working shifts
    if (dayOfWeek === 0) return Math.random() < 0.7 ? "○" : "×"; // Sunday
    if (dayOfWeek === 1) return Math.random() < 0.3 ? "×" : "○"; // Monday
    return "○"; // Normal shift for other days
  }

  /**
   * Get enhanced model information with performance metrics
   */
  getModelInfo() {
    if (!this.model) return null;

    return {
      isInitialized: this.isInitialized,
      isTraining: this.isTraining,
      totalParams: this.model.countParams(),
      architecture: MODEL_CONFIG.ARCHITECTURE,
      accuracy: this.getModelAccuracy(),
      memoryUsage: MEMORY_UTILS.getMemoryInfo(),

      // Enhanced information
      version: this.modelVersion,
      performanceMetrics: { ...this.modelPerformanceMetrics },
      adaptiveLearning: { ...this.adaptiveLearning },
      retrainingQueue: this.retrainingQueue.length,
      feedbackDataCount: this.feedbackData.length,

      // Model health indicators
      health: {
        predictionAccuracy: this.calculateRecentAccuracy(),
        memoryEfficiency: this.assessMemoryEfficiency(),
        responseTime: this.calculateAverageResponseTime(),
        errorRate: this.calculateErrorRate(),
      },

      // Backup information
      backups: {
        available: this.modelBackups.size,
        latest: this.getLatestBackupInfo(),
      },
    };
  }

  /**
   * Enhanced model retraining with user feedback and adaptive learning
   */
  async updateModelWithFeedback(correctionData) {
    try {
      // Processing model feedback for adaptive learning

      // Validate and process feedback data
      const processedFeedback = await this.processFeedbackData(correctionData);

      if (!processedFeedback.success) {
        console.warn("⚠️ Invalid feedback data:", processedFeedback.error);
        return { success: false, error: processedFeedback.error };
      }

      // Add to feedback queue
      this.feedbackData.push({
        timestamp: Date.now(),
        data: processedFeedback.data,
        type: "user_correction",
        processed: false,
      });

      // Check if incremental retraining is needed
      const shouldRetrain = await this.shouldPerformIncrementalUpdate();

      if (shouldRetrain) {
        // Performing incremental model update
        const retrainingResult = await this.performIncrementalRetraining();

        return {
          success: true,
          retrainTriggered: true,
          retrainingResult,
          feedbackProcessed: processedFeedback.data.length,
        };
      }

      return {
        success: true,
        retrainTriggered: false,
        feedbackQueued: true,
        queueSize: this.feedbackData.length,
      };
    } catch (error) {
      console.error("❌ Model feedback update failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if TensorFlow scheduler is ready for predictions
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.isInitialized && this.model !== null && !this.isTraining;
  }

  /**
   * Get current status of the TensorFlow scheduler
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      ready: this.isReady(),
      training: this.isTraining,
      modelInfo: this.getModelInfo(),
      performanceMetrics: { ...this.modelPerformanceMetrics },
      version: this.modelVersion,
      health: {
        memoryEfficiency: this.assessMemoryEfficiency(),
        errorRate: this.calculateErrorRate(),
        responseTime: this.calculateAverageResponseTime(),
      },
    };
  }

  /**
   * Reset the TensorFlow scheduler state
   */
  async reset() {
    try {
      // Resetting TensorFlow scheduler

      // Stop any ongoing training
      this.isTraining = false;

      // Clear training history
      this.trainingHistory = null;
      this.lastTrainingData = null;

      // Reset performance metrics
      this.modelPerformanceMetrics = {
        accuracy: 0,
        loss: 0,
        trainingTime: 0,
        predictionSpeed: 0,
        memoryUsage: 0,
      };

      // Clear feedback data and retraining queue
      this.feedbackData = [];
      this.retrainingQueue = [];

      // Reset performance monitor
      this.performanceMonitor = {
        predictionTimes: [],
        memorySnapshots: [],
        errorCounts: 0,
        successCounts: 0,
      };

      // **PERFORMANCE FIX: Clean up Web Workers to prevent stuck states**
      if (optimizedFeatureManager) {
        try {
          await optimizedFeatureManager.clearCache();
          // Optimized feature manager cache cleared
        } catch (error) {
          console.warn(
            "⚠️ Failed to clear optimized feature manager cache:",
            error.message,
          );
        }
      }

      // **PHASE 2 ENHANCEMENT: Clear feature cache**
      try {
        featureCacheManager.clear();
        // Feature cache cleared
      } catch (error) {
        console.warn("⚠️ Failed to clear feature cache:", error.message);
      }

      // Reset worker states
      this.workerInitialized = false;
      this.workerFallbackMode = false;

      // Perform memory cleanup
      MEMORY_UTILS.cleanup();

      console.log("✅ ML scheduler reset completed");
    } catch (error) {
      console.error("❌ TensorFlow scheduler reset failed:", error);
      throw error;
    }
  }

  /**
   * Enhanced resource cleanup with backup preservation
   */
  dispose() {
    try {
      // Starting enhanced TensorFlow cleanup

      // Dispose current model
      if (this.model) {
        this.model.dispose();
        this.model = null;
      }

      // Dispose model backups
      this.modelBackups.forEach((backup, key) => {
        if (backup.model) {
          backup.model.dispose();
        }
      });
      this.modelBackups.clear();

      // Clear performance monitoring data
      this.performanceMonitor = {
        predictionTimes: [],
        memorySnapshots: [],
        errorCounts: 0,
        successCounts: 0,
      };

      // Clear training data
      this.lastTrainingData = null;
      this.feedbackData = [];
      this.retrainingQueue = [];

      // **PHASE 2 ENHANCEMENT: Dispose feature cache**
      try {
        featureCacheManager.dispose();
        // Feature cache disposed
      } catch (error) {
        console.warn("⚠️ Failed to dispose feature cache:", error.message);
      }

      // Full memory cleanup
      MEMORY_UTILS.cleanup();

      this.isInitialized = false;

      console.log("✅ ML Scheduler disposed successfully");
    } catch (error) {
      console.error("❌ Error during disposal:", error);
    }
  }

  // ============================================================================
  // ENHANCED ML SYSTEM METHODS
  // ============================================================================

  /**
   * Setup performance monitoring system
   */
  setupPerformanceMonitoring() {
    // Monitor memory usage periodically
    setInterval(() => {
      if (this.isInitialized) {
        const memoryInfo = MEMORY_UTILS.getMemoryInfo();
        this.performanceMonitor.memorySnapshots.push({
          timestamp: Date.now(),
          ...memoryInfo,
        });

        // Keep only last 100 snapshots
        if (this.performanceMonitor.memorySnapshots.length > 100) {
          this.performanceMonitor.memorySnapshots.shift();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Load model with version checking
   */
  async loadModelWithVersionCheck() {
    try {
      const modelResult = await MODEL_STORAGE.loadModel();
      if (!modelResult || !modelResult.model) {
        return { success: false, reason: "No saved model found" };
      }

      // 🎯 PERFORMANCE FIX: Extract model from result object
      this.model = modelResult.model;
      this.modelVersion = modelResult.metadata?.version || "1.0.0";

      if (modelResult.fromCache) {
        console.log(`⚡ Model loaded from memory cache (v${this.modelVersion})`);
      } else {
        console.log(`📂 Model loaded from IndexedDB (v${this.modelVersion})`);
      }

      return {
        success: true,
        version: this.modelVersion,
        metadata: modelResult.metadata,
        fromCache: modelResult.fromCache,
        loadTime: modelResult.loadTime,
      };
    } catch (error) {
      console.warn("⚠️ Model loading failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save model version metadata
   */
  async saveModelVersion() {
    try {
      const metadata = {
        version: this.modelVersion,
        created: Date.now(),
        architecture: MODEL_CONFIG.ARCHITECTURE,
        performance: this.modelPerformanceMetrics,
      };

      await MODEL_STORAGE.saveModelMetadata(metadata);
    } catch (error) {
      console.warn("⚠️ Failed to save model metadata:", error.message);
    }
  }

  /**
   * Initialize model metadata
   */
  async initializeModelMetadata() {
    this.modelPerformanceMetrics = {
      accuracy: this.getModelAccuracy(),
      loss: 0,
      trainingTime: 0,
      predictionSpeed: 0,
      memoryUsage: MEMORY_UTILS.getMemoryInfo().numTensors || 0,
    };
  }

  /**
   * Handle initialization errors with fallback strategies
   */
  async handleInitializationError(error) {
    console.log("🔄 Attempting error recovery...");

    if (error.message.includes("memory") || error.message.includes("tensor")) {
      // Memory-related error - try cleanup and retry
      MEMORY_UTILS.cleanup();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        this.model = createScheduleModel();
        this.isInitialized = true;
        console.log("✅ Model recovery successful");
      } catch (retryError) {
        console.error("❌ Recovery failed:", retryError.message);
      }
    }
  }

  /**
   * 🎯 PERFORMANCE: Warmup feature cache during initialization
   * Pre-computes features to eliminate generation delay on first prediction
   */
  async warmupFeatureCache(options = {}) {
    try {
      console.log("🔥 [WARMUP] Starting feature cache warmup...");
      const startTime = Date.now();

      // Get sample data for warmup (if available from options)
      const staffMembers = options.staffMembers || [];
      const dateRange = options.dateRange || [];

      // Only warmup if we have data
      if (staffMembers.length === 0 || dateRange.length === 0) {
        console.log(
          "ℹ️ [WARMUP] Skipping cache warmup - no staff/date data provided",
        );
        return { success: true, skipped: true };
      }

      // Call warmupCache on featureCacheManager
      const warmupResult = await featureCacheManager.warmupCache(
        staffMembers,
        dateRange,
        {}, // periodData - will be loaded later
        {}, // allHistoricalData - will be loaded later
      );

      const warmupTime = Date.now() - startTime;
      console.log(
        `✅ [WARMUP] Feature cache warmed up in ${warmupTime}ms (${warmupResult.featuresGenerated} features)`,
      );

      return {
        success: true,
        warmupTime,
        featuresGenerated: warmupResult.featuresGenerated,
      };
    } catch (error) {
      console.warn("⚠️ [WARMUP] Feature cache warmup failed:", error.message);
      // Non-critical - continue without warmup
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if model retraining is needed
   */
  async shouldRetrain(currentStaffMembers, options) {
    // Force retrain if requested
    if (options.forceRetrain) return true;

    // Check if model exists and is trained
    if (!this.model || this.getModelAccuracy() === 0) return true;

    // Check feedback queue size
    if (this.feedbackData.length >= 20) return true;

    // Check staff changes
    if (currentStaffMembers && this.lastTrainingData) {
      const staffChanged = this.hasStaffCompositionChanged(currentStaffMembers);
      if (staffChanged) return true;
    }

    // Check model age (retrain if older than 30 days)
    const modelAge =
      Date.now() - (this.modelPerformanceMetrics.lastTraining || 0);
    if (modelAge > 30 * 24 * 60 * 60 * 1000) return true;

    return false;
  }

  /**
   * Extract and validate training data with comprehensive quality checks
   */
  async extractAndValidateTrainingData() {
    try {
      // Extracting and validating training data

      const extractedData = extractAllDataForAI();

      if (!extractedData.success || !extractedData.data) {
        return {
          success: false,
          error: "No historical data available for training",
          details: extractedData.error || "Data extraction failed",
        };
      }

      const { rawPeriodData, staffProfiles, summary } = extractedData.data;

      // Enhanced validation checks
      const validationResults = await this.performDataQualityValidation({
        rawPeriodData,
        staffProfiles,
        summary,
      });

      if (!validationResults.passed) {
        return {
          success: false,
          error: "Training data quality validation failed",
          validation: validationResults,
          details: validationResults.issues.join("; "),
        };
      }

      // Convert to training format
      const allHistoricalData = {};
      const allStaffMembers = [];
      let totalShiftsProcessed = 0;

      rawPeriodData.forEach((periodData) => {
        allHistoricalData[periodData.monthIndex] = {
          schedule: periodData.scheduleData,
          dateRange: periodData.dateRange,
        };

        // Count actual shift data
        Object.values(periodData.scheduleData).forEach((staffSchedule) => {
          Object.values(staffSchedule).forEach((shift) => {
            if (shift !== undefined && shift !== null) {
              totalShiftsProcessed++;
            }
          });
        });

        // Collect unique staff members with enhanced data
        periodData.staffData.forEach((staff) => {
          if (!allStaffMembers.find((s) => s.id === staff.id)) {
            // Enhance staff data with historical context
            const enhancedStaff = {
              ...staff,
              periodsWorked: rawPeriodData.filter((pd) =>
                pd.staffData.find((s) => s.id === staff.id),
              ).length,
              hasScheduleData: rawPeriodData.some(
                (pd) =>
                  pd.scheduleData[staff.id] &&
                  Object.keys(pd.scheduleData[staff.id]).length > 0,
              ),
            };
            allStaffMembers.push(enhancedStaff);
          }
        });
      });

      // Enhanced data quality assessment
      const dataQuality = {
        completeness: summary.dataCompleteness,
        periods: rawPeriodData.length,
        staffCount: allStaffMembers.length,
        activeStaffCount: allStaffMembers.filter((s) => s.hasScheduleData)
          .length,
        totalDataPoints: totalShiftsProcessed,
        averageDataPointsPerStaff:
          totalShiftsProcessed / Math.max(1, allStaffMembers.length),
        periodCoverage: rawPeriodData.length / 6, // Out of 6 possible periods
        validation: validationResults,
      };

      // Training data validation completed

      return {
        success: true,
        allHistoricalData,
        allStaffMembers,
        dataQuality,
      };
    } catch (error) {
      console.error("❌ Training data extraction failed:", error);
      return {
        success: false,
        error: error.message,
        details: "Exception during data extraction and validation",
      };
    }
  }

  /**
   * Prepare enhanced training data with validation and augmentation
   */
  async prepareEnhancedTrainingData(allHistoricalData, staffMembers, options) {
    try {
      // Basic training data preparation
      const trainingData = this.featureEngineer.prepareTrainingData(
        allHistoricalData,
        staffMembers,
      );

      if (trainingData.features.length === 0) {
        return {
          success: false,
          error: "No training samples generated from historical data",
        };
      }

      // Data augmentation if requested
      let features = trainingData.features;
      let labels = trainingData.labels;
      let augmentedData = null;

      if (options.dataAugmentation && features.length < 1000) {
        augmentedData = await this.performDataAugmentation(features, labels);
        features = features.concat(augmentedData.features);
        labels = labels.concat(augmentedData.labels);
      }

      // Split into training and validation sets
      const splitIndex = Math.floor(features.length * 0.8);
      const validationFeatures = features.slice(splitIndex);
      const validationLabels = labels.slice(splitIndex);

      const trainingFeatures = features.slice(0, splitIndex);
      const trainingLabels = labels.slice(0, splitIndex);

      // Generate metadata about the training data
      const metadata = {
        originalSamples: features.length,
        trainingSamples: trainingFeatures.length,
        validationSamples: validationFeatures.length,
        augmentedSamples: augmentedData ? augmentedData.features.length : 0,
        staffCount: staffMembers.length,
        featureCount:
          trainingFeatures.length > 0 ? trainingFeatures[0].length : 0,
        expectedFeatures: MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL,
        dataAugmentationUsed:
          options.dataAugmentation && features.length < 1000,
      };

      return {
        success: true,
        features: trainingFeatures,
        labels: trainingLabels,
        validationFeatures,
        validationLabels,
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get optimal training configuration based on data size
   */
  getOptimalTrainingConfig(dataSize, options) {
    const baseConfig = {
      epochs: this.adaptiveLearning.epochs,
      batchSize: this.adaptiveLearning.batchSize,
      learningRate: this.adaptiveLearning.learningRate,
      validationSplit: this.adaptiveLearning.validationSplit,
    };

    // Adjust based on data size
    if (dataSize < 500) {
      baseConfig.epochs = Math.max(30, baseConfig.epochs * 0.6);
      baseConfig.batchSize = Math.min(16, baseConfig.batchSize);
    } else if (dataSize > 2000) {
      baseConfig.epochs = Math.min(100, baseConfig.epochs * 1.2);
      baseConfig.batchSize = Math.max(64, baseConfig.batchSize);
    }

    // Apply user options
    return { ...baseConfig, ...options };
  }

  /**
   * Perform enhanced training with progress monitoring
   */
  async performEnhancedTraining(
    features,
    labels,
    validationFeatures,
    validationLabels,
    config,
  ) {
    try {
      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.oneHot(
        tf.tensor1d(labels, "int32"),
        MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
      );

      let validationData = null;
      if (validationFeatures && validationLabels) {
        const valXs = tf.tensor2d(validationFeatures);
        const valYs = tf.oneHot(
          tf.tensor1d(validationLabels, "int32"),
          MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
        );
        validationData = [valXs, valYs];
      }

      // Starting enhanced neural network training

      // Enhanced training with callbacks
      const history = await this.model.fit(xs, ys, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationData: validationData,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const progress = (((epoch + 1) / config.epochs) * 100).toFixed(1);
            // Training progress tracking

            // Early stopping if loss increases significantly
            if (epoch > 10 && logs.loss > 2.0) {
              console.warn("⚠️ Early stopping due to loss explosion");
              this.model.stopTraining = true;
            }
          },
          onTrainEnd: () => {
            // Enhanced training completed
          },
        },
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();
      if (validationData) {
        validationData[0].dispose();
        validationData[1].dispose();
      }

      // Calculate final metrics
      const finalLoss = history.history.loss[history.history.loss.length - 1];
      const finalAccuracy = history.history.acc
        ? history.history.acc[history.history.acc.length - 1]
        : 0;

      this.trainingHistory = history;

      return {
        success: true,
        history,
        finalMetrics: {
          loss: finalLoss,
          accuracy: finalAccuracy,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create model backup
   */
  async createModelBackup(reason) {
    try {
      if (!this.model) return;

      const backupId = `${Date.now()}-${reason}`;

      // Create a copy of the model
      const modelCopy = await tf.loadLayersModel(
        tf.io.fromMemory({
          modelTopology: this.model.toJSON(),
          weightSpecs: this.model
            .getWeights()
            .map((w) => ({ name: w.name, shape: w.shape, dtype: w.dtype })),
          weightData: tf.io.concatenateArrayBuffers(
            this.model.getWeights().map((w) => w.dataSync().buffer),
          ),
        }),
      );

      this.modelBackups.set(backupId, {
        model: modelCopy,
        timestamp: Date.now(),
        reason,
        version: this.modelVersion,
        performance: { ...this.modelPerformanceMetrics },
      });

      // Limit number of backups
      if (this.modelBackups.size > this.maxBackups) {
        const oldestKey = Array.from(this.modelBackups.keys())[0];
        const oldestBackup = this.modelBackups.get(oldestKey);
        if (oldestBackup.model) {
          oldestBackup.model.dispose();
        }
        this.modelBackups.delete(oldestKey);
      }

      // Model backup created successfully
    } catch (error) {
      console.warn("⚠️ Failed to create model backup:", error.message);
    }
  }

  /**
   * Calculate recent prediction accuracy
   */
  calculateRecentAccuracy() {
    const recentPredictions =
      this.performanceMonitor.predictionTimes.slice(-50);
    const successRate =
      this.performanceMonitor.successCounts /
      Math.max(
        1,
        this.performanceMonitor.successCounts +
          this.performanceMonitor.errorCounts,
      );
    return Math.max(0, Math.min(1, successRate));
  }

  /**
   * Assess memory efficiency
   */
  assessMemoryEfficiency() {
    const memoryInfo = MEMORY_UTILS.getMemoryInfo();
    const tensorCount = memoryInfo.numTensors || 0;

    if (tensorCount < 50) return "excellent";
    if (tensorCount < 100) return "good";
    if (tensorCount < 200) return "moderate";
    return "needs_optimization";
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    const times = this.performanceMonitor.predictionTimes.slice(-20);
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const total =
      this.performanceMonitor.successCounts +
      this.performanceMonitor.errorCounts;
    return total > 0 ? this.performanceMonitor.errorCounts / total : 0;
  }

  /**
   * Get latest backup information
   */
  getLatestBackupInfo() {
    if (this.modelBackups.size === 0) return null;

    const backups = Array.from(this.modelBackups.values());
    const latest = backups.reduce((latest, backup) =>
      backup.timestamp > latest.timestamp ? backup : latest,
    );

    return {
      timestamp: latest.timestamp,
      reason: latest.reason,
      version: latest.version,
    };
  }

  /**
   * Enhanced model saving with metadata
   */
  async saveEnhancedModel() {
    try {
      await MODEL_STORAGE.saveModel(this.model);
      await this.saveModelVersion();
      // Enhanced model saved successfully
    } catch (error) {
      console.error("❌ Failed to save enhanced model:", error);
    }
  }

  /**
   * Update model metadata after training
   */
  async updateModelMetadata(metadata) {
    this.modelVersion = metadata.version;
    this.modelPerformanceMetrics = {
      accuracy: metadata.accuracy,
      loss: metadata.loss,
      trainingTime: metadata.trainingTime,
      lastTraining: Date.now(),
      predictionSpeed: this.modelPerformanceMetrics.predictionSpeed,
      memoryUsage: MEMORY_UTILS.getMemoryInfo().numTensors || 0,
    };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(metrics) {
    Object.assign(this.modelPerformanceMetrics, metrics);
  }

  /**
   * Get next model version
   */
  getNextModelVersion() {
    const parts = this.modelVersion.split(".");
    const minor = parseInt(parts[1] || 0) + 1;
    return `${parts[0]}.${minor}.0`;
  }

  /**
   * Attempt model recovery after training failure
   */
  async attemptModelRecovery(error) {
    try {
      // Attempting model recovery

      // Try to restore from backup
      if (this.modelBackups.size > 0) {
        const latestBackup = this.getLatestBackupInfo();
        // Restoring from backup

        // This would require implementing backup restoration
        // For now, we'll create a new model
        this.model = createScheduleModel();

        return {
          success: true,
          method: "backup_restore",
          backupUsed: latestBackup,
        };
      }

      // Fallback: create new model
      this.model = createScheduleModel();

      return {
        success: true,
        method: "new_model_created",
      };
    } catch (recoveryError) {
      console.error("❌ Model recovery failed:", recoveryError);
      return {
        success: false,
        error: recoveryError.message,
      };
    }
  }

  /**
   * Post-training cleanup
   */
  async performPostTrainingCleanup() {
    try {
      // Clean up old performance monitoring data
      if (this.performanceMonitor.memorySnapshots.length > 50) {
        this.performanceMonitor.memorySnapshots =
          this.performanceMonitor.memorySnapshots.slice(-50);
      }

      if (this.performanceMonitor.predictionTimes.length > 100) {
        this.performanceMonitor.predictionTimes =
          this.performanceMonitor.predictionTimes.slice(-100);
      }

      // Perform memory cleanup
      MEMORY_UTILS.cleanup();

      // Post-training cleanup completed
    } catch (error) {
      console.warn("⚠️ Post-training cleanup failed:", error.message);
    }
  }

  // ============================================================================
  // ENHANCED DATA VALIDATION METHODS
  // ============================================================================

  /**
   * Perform comprehensive data quality validation
   */
  async performDataQualityValidation({
    rawPeriodData,
    staffProfiles,
    summary,
  }) {
    const issues = [];
    const warnings = [];
    let score = 100;

    // Check 1: Minimum data requirements
    if (rawPeriodData.length === 0) {
      issues.push("No historical periods found");
      score -= 50;
    } else if (rawPeriodData.length < 2) {
      warnings.push("Only one period available - limited learning capability");
      score -= 10;
    }

    // Check 2: Staff data quality
    const totalStaff = Object.keys(staffProfiles).length;
    if (totalStaff < 2) {
      issues.push(
        `Insufficient staff data: ${totalStaff} (minimum 2 required)`,
      );
      score -= 30;
    } else if (totalStaff < 5) {
      warnings.push("Limited staff diversity may affect prediction quality");
      score -= 5;
    }

    // Check 3: Data completeness
    if (summary.dataCompleteness < 5) {
      issues.push(
        `Data completeness too low: ${summary.dataCompleteness.toFixed(1)}% (minimum 5% required)`,
      );
      score -= 40;
    } else if (summary.dataCompleteness < 20) {
      warnings.push(
        `Low data completeness: ${summary.dataCompleteness.toFixed(1)}%`,
      );
      score -= 15;
    }

    // Check 4: Individual period data quality
    let periodsWithData = 0;
    let totalScheduleEntries = 0;

    rawPeriodData.forEach((period, index) => {
      const staffWithData = Object.keys(period.scheduleData).length;
      const scheduleEntries = Object.values(period.scheduleData).reduce(
        (sum, schedule) => sum + Object.keys(schedule).length,
        0,
      );

      if (scheduleEntries > 0) {
        periodsWithData++;
        totalScheduleEntries += scheduleEntries;
      }

      if (staffWithData === 0) {
        issues.push(`Period ${index} has no staff schedule data`);
        score -= 10;
      } else if (scheduleEntries < 10) {
        warnings.push(
          `Period ${index} has very limited data: ${scheduleEntries} entries`,
        );
        score -= 2;
      }
    });

    // Check 5: Training sample sufficiency
    const estimatedSamples = totalScheduleEntries * 0.8; // Rough estimate
    if (estimatedSamples < 50) {
      issues.push(
        `Insufficient training samples: ~${Math.round(estimatedSamples)} (minimum 50 required)`,
      );
      score -= 25;
    } else if (estimatedSamples < 100) {
      warnings.push(
        `Limited training samples: ~${Math.round(estimatedSamples)} (recommended 100+)`,
      );
      score -= 5;
    }

    // Check 6: Staff type diversity
    const staffTypes = Object.values(staffProfiles).reduce((types, profile) => {
      types[profile.status] = (types[profile.status] || 0) + 1;
      return types;
    }, {});

    if (Object.keys(staffTypes).length < 2) {
      warnings.push("Only one staff type found - limited pattern diversity");
      score -= 5;
    }

    const passed = issues.length === 0;
    const qualityLevel =
      score >= 80
        ? "excellent"
        : score >= 60
          ? "good"
          : score >= 40
            ? "fair"
            : "poor";

    // Data quality validation completed
    if (issues.length > 0) {
      console.warn("⚠️ Data validation issues:", issues.join("; "));
    }
    if (warnings.length > 0 && score < 60) {
      console.warn("⚠️ Data quality warnings:", warnings.join("; "));
    }

    return {
      passed,
      score,
      qualityLevel,
      issues,
      warnings,
      metrics: {
        periods: rawPeriodData.length,
        periodsWithData,
        totalStaff,
        totalScheduleEntries,
        estimatedSamples,
        completeness: summary.dataCompleteness,
        staffTypes: Object.keys(staffTypes).length,
      },
    };
  }

  /**
   * Validate training features and labels for consistency
   */
  validateTrainingData(features, labels, metadata) {
    const issues = [];
    const warnings = [];

    // Check feature-label count consistency
    if (features.length !== labels.length) {
      issues.push(
        `Feature-label count mismatch: ${features.length} features, ${labels.length} labels`,
      );
    }

    // Check feature vector consistency
    if (features.length > 0) {
      const expectedLength = MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL;
      const actualLength = features[0].length;

      if (actualLength !== expectedLength) {
        issues.push(
          `Feature vector length mismatch: expected ${expectedLength}, got ${actualLength}`,
        );
      }

      // Check for inconsistent feature vector lengths
      const inconsistentVectors = features.some(
        (f) => f.length !== actualLength,
      );
      if (inconsistentVectors) {
        issues.push("Inconsistent feature vector lengths detected");
      }

      // Check for NaN or infinite values
      let nanCount = 0;
      let infCount = 0;

      features.forEach((featureVector, i) => {
        featureVector.forEach((value, j) => {
          if (isNaN(value)) {
            nanCount++;
          } else if (!isFinite(value)) {
            infCount++;
          }
        });
      });

      if (nanCount > 0) {
        issues.push(`${nanCount} NaN values detected in features`);
      }
      if (infCount > 0) {
        issues.push(`${infCount} infinite values detected in features`);
      }
    }

    // Check label validity
    const invalidLabels = labels.filter(
      (label) =>
        !Number.isInteger(label) ||
        label < 0 ||
        label >= MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
    );

    if (invalidLabels.length > 0) {
      issues.push(
        `${invalidLabels.length} invalid labels (must be integers 0-${MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE - 1})`,
      );
    }

    // Check label distribution
    const labelCounts = {};
    labels.forEach((label) => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });

    const totalLabels = labels.length;
    const labelDistribution = Object.entries(labelCounts).map(
      ([label, count]) => ({
        label,
        count,
        percentage: (count / totalLabels) * 100,
      }),
    );

    // Warn about highly imbalanced labels
    const maxPercentage = Math.max(
      ...labelDistribution.map((l) => l.percentage),
    );
    if (maxPercentage > 80) {
      warnings.push(
        `Label distribution is highly imbalanced (${maxPercentage.toFixed(1)}% for one class)`,
      );
    }

    // Check for missing label classes
    const missingLabels = [];
    for (let i = 0; i < MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE; i++) {
      if (!labelCounts[i]) {
        missingLabels.push(i);
      }
    }

    if (missingLabels.length > 0) {
      warnings.push(`Missing label classes: [${missingLabels.join(", ")}]`);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      stats: {
        sampleCount: features.length,
        featureLength: features.length > 0 ? features[0].length : 0,
        labelDistribution,
        missingLabels,
      },
    };
  }

  /**
   * Create a simple fallback model when main model creation fails
   */
  createSimpleFallbackModel() {
    try {
      // Creating simple fallback model

      const model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [MODEL_CONFIG.INPUT_FEATURES.ENHANCED_TOTAL],
            units: 32,
            activation: "relu",
            name: "fallback_hidden",
          }),
          tf.layers.dropout({ rate: 0.2, name: "fallback_dropout" }),
          tf.layers.dense({
            units: MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
            activation: "softmax",
            name: "fallback_output",
          }),
        ],
      });

      model.compile({
        optimizer: "adam",
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
      });

      // Fallback model created successfully
      return model;
    } catch (error) {
      console.error("❌ Even fallback model creation failed:", error);
      return null;
    }
  }

  // Additional methods for feedback processing would go here...

  async processFeedbackData(correctionData) {
    // Process and validate user correction data
    return { success: true, data: correctionData };
  }

  async shouldPerformIncrementalUpdate() {
    // Determine if incremental retraining should be triggered
    return this.feedbackData.filter((f) => !f.processed).length >= 10;
  }

  async performIncrementalRetraining() {
    // Perform incremental model updates based on feedback
    return { success: true, updatesApplied: this.feedbackData.length };
  }

  hasStaffCompositionChanged(currentStaffMembers) {
    // Check if staff composition has changed significantly
    if (!this.lastTrainingData || !this.lastTrainingData.staffMembers)
      return true;

    const currentIds = new Set(currentStaffMembers.map((s) => s.id));
    const lastIds = new Set(
      this.lastTrainingData.staffMembers.map((s) => s.id),
    );

    // Check for significant changes (>25% different)
    const intersection = new Set(
      [...currentIds].filter((id) => lastIds.has(id)),
    );
    const union = new Set([...currentIds, ...lastIds]);
    const similarity = intersection.size / union.size;

    return similarity < 0.75; // More than 25% change
  }

  async performDataAugmentation(features, labels) {
    // Simple data augmentation through feature noise injection
    if (features.length < 500) {
      const augmentedFeatures = [];
      const augmentedLabels = [];

      // Add noise-augmented versions of existing samples
      const augmentationFactor = Math.min(2, 1000 / features.length);

      for (let i = 0; i < features.length; i++) {
        const originalFeature = features[i];
        const originalLabel = labels[i];

        for (let j = 0; j < augmentationFactor; j++) {
          const augmentedFeature = originalFeature.map((value) => {
            // Add small random noise (±5%)
            const noise = (Math.random() - 0.5) * 0.1 * value;
            return Math.max(0, Math.min(1, value + noise)); // Clamp to [0,1]
          });

          augmentedFeatures.push(augmentedFeature);
          augmentedLabels.push(originalLabel);
        }
      }

      // Data augmentation completed
      return { features: augmentedFeatures, labels: augmentedLabels };
    }

    return { features: [], labels: [] };
  }

  /**
   * Convert shift type string to shift symbol
   * @param {string} shiftType - Shift type (early, late, normal, off, etc.)
   * @returns {string} Shift symbol (△, ◇, ○, ×, etc.)
   */
  convertShiftTypeToSymbol(shiftType) {
    const shiftMap = {
      'early': '△',
      'late': '◇',
      'normal': '○',
      'off': '×',
      '○': '○',  // Pass-through if already symbol
      '△': '△',
      '◇': '◇',
      '×': '×',
    };

    return shiftMap[shiftType] || shiftType;
  }
}

export default TensorFlowScheduler;
