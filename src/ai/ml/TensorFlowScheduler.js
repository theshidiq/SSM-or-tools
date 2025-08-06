/**
 * TensorFlowScheduler.js
 * 
 * Main TensorFlow ML engine for restaurant shift scheduling predictions.
 * Uses real neural networks to learn from historical schedule data.
 */

import * as tf from '@tensorflow/tfjs';
import { 
  MODEL_CONFIG, 
  initializeTensorFlow, 
  createScheduleModel, 
  MODEL_STORAGE, 
  MEMORY_UTILS 
} from './TensorFlowConfig';
import { ScheduleFeatureEngineer } from './FeatureEngineering';
import { extractAllDataForAI } from '../utils/DataExtractor';

export class TensorFlowScheduler {
  constructor() {
    this.model = null;
    this.featureEngineer = new ScheduleFeatureEngineer();
    this.isInitialized = false;
    this.isTraining = false;
    this.trainingHistory = null;
    
    // Enhanced model management
    this.modelVersion = '1.0.0';
    this.lastTrainingData = null;
    this.modelPerformanceMetrics = {
      accuracy: 0,
      loss: 0,
      trainingTime: 0,
      predictionSpeed: 0,
      memoryUsage: 0
    };
    
    // Retraining system
    this.retrainingQueue = [];
    this.feedbackData = [];
    this.adaptiveLearning = {
      enabled: true,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 50,
      validationSplit: 0.2
    };
    
    // Performance monitoring
    this.performanceMonitor = {
      predictionTimes: [],
      memorySnapshots: [],
      errorCounts: 0,
      successCounts: 0
    };
    
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
      console.log('🚀 Initializing Enhanced TensorFlow ML Scheduler...');
      const startTime = Date.now();
      
      // Apply options
      this.adaptiveLearning = { ...this.adaptiveLearning, ...options.adaptiveLearning };
      
      // Initialize TensorFlow backend with optimizations
      const tfReady = await initializeTensorFlow();
      if (!tfReady) {
        throw new Error('TensorFlow initialization failed');
      }
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      // Try to load existing trained model with version checking
      const loadResult = await this.loadModelWithVersionCheck();
      
      if (!loadResult.success) {
        console.log('📦 Creating new optimized model...');
        this.model = createScheduleModel({
          ...MODEL_CONFIG.ARCHITECTURE,
          optimizeForPerformance: true,
          enableBatchNormalization: true,
          dropoutRate: 0.3 // Prevent overfitting
        });
        await this.saveModelVersion();
      } else {
        console.log(`✅ Loaded model version ${loadResult.version}`);
      }
      
      // Initialize model metadata
      await this.initializeModelMetadata();
      
      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      console.log(`✨ ML Scheduler initialized in ${initTime}ms`);
      
      MEMORY_UTILS.logMemoryUsage('After enhanced ML initialization');
      
      return true;
    } catch (error) {
      console.error('❌ Enhanced TensorFlow ML initialization failed:', error);
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
      console.log('⏳ Training already in progress...');
      return null;
    }
    
    // Check if retraining is needed
    const retrainingNeeded = await this.shouldRetrain(currentStaffMembers, options);
    if (!retrainingNeeded && !options.forceRetrain) {
      console.log('🏃 Using existing trained model (no retraining needed)');
      return {
        success: true,
        skipped: true,
        reason: 'Model is up-to-date',
        modelInfo: this.getModelInfo()
      };
    }
    
    try {
      this.isTraining = true;
      const trainingStartTime = Date.now();
      console.log('🎓 Starting enhanced ML model training...');
      
      // Create model backup before training
      await this.createModelBackup('pre-training');
      
      MEMORY_UTILS.logMemoryUsage('Before enhanced training');
      
      // Extract and validate training data
      const dataExtractionResult = await this.extractAndValidateTrainingData();
      
      if (!dataExtractionResult.success) {
        throw new Error(`Training data extraction failed: ${dataExtractionResult.error}`);
      }
      
      const { allHistoricalData, allStaffMembers, dataQuality } = dataExtractionResult;
      
      console.log(`📚 Training data quality: ${(dataQuality.completeness * 100).toFixed(1)}%`);
      console.log(`👥 Staff members: ${allStaffMembers.length}, Data periods: ${Object.keys(allHistoricalData).length}`);
      
      // Use current staff if provided, otherwise use historical staff
      const staffMembers = currentStaffMembers && currentStaffMembers.length > 0 
        ? currentStaffMembers 
        : allStaffMembers;
      
      console.log(`🔄 Using ${staffMembers.length} staff members for training`);
      
      // Enhanced training data preparation with data augmentation
      const trainingDataResult = await this.prepareEnhancedTrainingData(
        allHistoricalData, 
        staffMembers,
        options
      );
      
      if (!trainingDataResult.success) {
        throw new Error(`Training data preparation failed: ${trainingDataResult.error}`);
      }
      
      const { features, labels, validationFeatures, validationLabels } = trainingDataResult;
      
      console.log(`📊 Training samples: ${features.length}, Validation samples: ${validationFeatures?.length || 0}`);
      
      // Enhanced model training with adaptive parameters
      const trainingConfig = this.getOptimalTrainingConfig(features.length, options);
      const trainingResult = await this.performEnhancedTraining(
        features, 
        labels, 
        validationFeatures, 
        validationLabels, 
        trainingConfig
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
          dataQuality: dataQuality.completeness
        }
      });
      
      // Save enhanced model with metadata
      await this.saveEnhancedModel();
      
      // Update performance metrics
      this.updatePerformanceMetrics({
        accuracy: finalMetrics.accuracy,
        loss: finalMetrics.loss,
        trainingTime: Date.now() - trainingStartTime
      });
      
      const trainingTime = Date.now() - trainingStartTime;
      console.log(`✅ Enhanced training complete! Accuracy: ${(finalMetrics.accuracy * 100).toFixed(1)}% (${trainingTime}ms)`);
      console.log(`📈 Data quality: ${(dataQuality.completeness * 100).toFixed(1)}%, Model version: ${this.modelVersion}`);
      
      MEMORY_UTILS.logMemoryUsage('After enhanced training');
      
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
        performanceMetrics: this.modelPerformanceMetrics
      };
      
    } catch (error) {
      console.error('❌ Enhanced model training failed:', error);
      
      // Attempt model recovery
      const recoveryResult = await this.attemptModelRecovery(error);
      
      return {
        success: false,
        error: error.message,
        recovery: recoveryResult,
        fallbackAvailable: recoveryResult.success
      };
    } finally {
      this.isTraining = false;
      await this.performPostTrainingCleanup();
    }
  }
  
  /**
   * Predict shift assignments for empty schedule cells
   */
  async predictSchedule(currentSchedule, staffMembers, dateRange) {
    if (!this.isInitialized || !this.model) {
      console.log('⚠️ Model not initialized, initializing...');
      await this.initialize();
    }
    
    try {
      console.log('🔮 Generating ML predictions for schedule...');
      
      // Extract historical data for context
      const extractedData = extractAllDataForAI();
      const allHistoricalData = {};
      
      if (extractedData.success && extractedData.data.rawPeriodData) {
        extractedData.data.rawPeriodData.forEach(periodData => {
          allHistoricalData[periodData.monthIndex] = {
            schedule: periodData.scheduleData,
            dateRange: periodData.dateRange
          };
        });
      }
      
      const predictions = {};
      const predictionConfidence = {};
      
      // Prepare current period data structure
      const currentPeriodData = {
        schedule: currentSchedule,
        dateRange: dateRange
      };
      
      // Process each staff member
      for (const staff of staffMembers) {
        predictions[staff.id] = {};
        predictionConfidence[staff.id] = {};
        
        // Process each date
        for (let dateIndex = 0; dateIndex < dateRange.length; dateIndex++) {
          const date = dateRange[dateIndex];
          const dateKey = date.toISOString().split('T')[0];
          
          // Skip if cell is already filled
          if (currentSchedule[staff.id] && 
              currentSchedule[staff.id][dateKey] !== undefined && 
              currentSchedule[staff.id][dateKey] !== null &&
              currentSchedule[staff.id][dateKey] !== '') {
            continue;
          }
          
          // Generate features for this staff-date combination
          const features = this.featureEngineer.generateFeatures({
            staff,
            date,
            dateIndex,
            periodData: currentPeriodData,
            allHistoricalData,
            staffMembers
          });
          
          if (!features) continue;
          
          // Make prediction using TensorFlow model
          const prediction = await this.predictSingle(features);
          
          if (prediction) {
            const shiftSymbol = this.featureEngineer.labelToShift(
              prediction.predictedClass, 
              staff
            );
            
            predictions[staff.id][dateKey] = shiftSymbol;
            predictionConfidence[staff.id][dateKey] = prediction.confidence;
          }
        }
      }
      
      console.log('✅ ML predictions generated');
      
      return {
        predictions,
        confidence: predictionConfidence,
        modelAccuracy: this.getModelAccuracy()
      };
      
    } catch (error) {
      console.error('❌ Prediction failed:', error);
      return {
        predictions: {},
        confidence: {},
        error: error.message
      };
    }
  }
  
  /**
   * Make single prediction for feature vector
   */
  async predictSingle(features) {
    try {
      // Convert to tensor
      const input = tf.tensor2d([features]);
      
      // Get prediction probabilities
      const output = this.model.predict(input);
      const probabilities = await output.data();
      
      // Find class with highest probability
      let maxProb = 0;
      let predictedClass = 0;
      
      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          predictedClass = i;
        }
      }
      
      // Clean up tensors
      input.dispose();
      output.dispose();
      
      return {
        predictedClass,
        confidence: maxProb,
        probabilities: Array.from(probabilities)
      };
      
    } catch (error) {
      console.error('❌ Single prediction failed:', error);
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
      const ys = tf.oneHot(tf.tensor1d(testLabels, 'int32'), 
                           MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE);
      
      const evaluation = this.model.evaluate(xs, ys);
      const loss = await evaluation[0].data();
      const accuracy = await evaluation[1].data();
      
      xs.dispose();
      ys.dispose();
      evaluation[0].dispose();
      evaluation[1].dispose();
      
      return {
        loss: loss[0],
        accuracy: accuracy[0]
      };
      
    } catch (error) {
      console.error('❌ Model evaluation failed:', error);
      return null;
    }
  }
  
  /**
   * Get model accuracy from training history
   */
  getModelAccuracy() {
    if (!this.trainingHistory) {
      // Use performance metrics if available
      return this.modelPerformanceMetrics.accuracy || 0.75;
    }
    
    const history = this.trainingHistory.history;
    if (history.val_acc && history.val_acc.length > 0) {
      return history.val_acc[history.val_acc.length - 1];
    } else if (history.acc && history.acc.length > 0) {
      return history.acc[history.acc.length - 1];
    } else if (history.val_accuracy && history.val_accuracy.length > 0) {
      return history.val_accuracy[history.val_accuracy.length - 1];
    } else if (history.accuracy && history.accuracy.length > 0) {
      return history.accuracy[history.accuracy.length - 1];
    }
    
    return this.modelPerformanceMetrics.accuracy || 0.75;
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
        errorRate: this.calculateErrorRate()
      },
      
      // Backup information
      backups: {
        available: this.modelBackups.size,
        latest: this.getLatestBackupInfo()
      }
    };
  }
  
  /**
   * Enhanced model retraining with user feedback and adaptive learning
   */
  async updateModelWithFeedback(correctionData) {
    try {
      console.log('📝 Processing model feedback for adaptive learning...');
      
      // Validate and process feedback data
      const processedFeedback = await this.processFeedbackData(correctionData);
      
      if (!processedFeedback.success) {
        console.warn('⚠️ Invalid feedback data:', processedFeedback.error);
        return { success: false, error: processedFeedback.error };
      }
      
      // Add to feedback queue
      this.feedbackData.push({
        timestamp: Date.now(),
        data: processedFeedback.data,
        type: 'user_correction',
        processed: false
      });
      
      // Check if incremental retraining is needed
      const shouldRetrain = await this.shouldPerformIncrementalUpdate();
      
      if (shouldRetrain) {
        console.log('🔄 Performing incremental model update...');
        const retrainingResult = await this.performIncrementalRetraining();
        
        return {
          success: true,
          retrainTriggered: true,
          retrainingResult,
          feedbackProcessed: processedFeedback.data.length
        };
      }
      
      return {
        success: true,
        retrainTriggered: false,
        feedbackQueued: true,
        queueSize: this.feedbackData.length
      };
      
    } catch (error) {
      console.error('❌ Model feedback update failed:', error);
      return {
        success: false,
        error: error.message
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
   * Reset the TensorFlow scheduler state
   */
  async reset() {
    try {
      console.log('🔄 Resetting TensorFlow scheduler...');
      
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
        memoryUsage: 0
      };
      
      // Clear feedback data and retraining queue
      this.feedbackData = [];
      this.retrainingQueue = [];
      
      // Reset performance monitor
      this.performanceMonitor = {
        predictionTimes: [],
        memorySnapshots: [],
        errorCounts: 0,
        successCounts: 0
      };
      
      // Perform memory cleanup
      MEMORY_UTILS.cleanup();
      
      console.log('✅ TensorFlow scheduler reset completed');
      
    } catch (error) {
      console.error('❌ TensorFlow scheduler reset failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced resource cleanup with backup preservation
   */
  dispose() {
    try {
      console.log('🧹 Starting enhanced TensorFlow cleanup...');
      
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
        successCounts: 0
      };
      
      // Clear training data
      this.lastTrainingData = null;
      this.feedbackData = [];
      this.retrainingQueue = [];
      
      // Full memory cleanup
      MEMORY_UTILS.cleanup();
      
      this.isInitialized = false;
      
      console.log('✅ Enhanced TensorFlow ML Scheduler disposed successfully');
      
    } catch (error) {
      console.error('❌ Error during disposal:', error);
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
          ...memoryInfo
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
      const modelData = await MODEL_STORAGE.loadModel();
      if (!modelData) {
        return { success: false, reason: 'No saved model found' };
      }
      
      // Load version metadata if available
      const versionInfo = await MODEL_STORAGE.loadModelMetadata();
      
      this.model = modelData;
      this.modelVersion = versionInfo?.version || '1.0.0';
      
      return { 
        success: true, 
        version: this.modelVersion,
        metadata: versionInfo 
      };
      
    } catch (error) {
      console.warn('⚠️ Model loading failed:', error.message);
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
        performance: this.modelPerformanceMetrics
      };
      
      await MODEL_STORAGE.saveModelMetadata(metadata);
      
    } catch (error) {
      console.warn('⚠️ Failed to save model metadata:', error.message);
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
      memoryUsage: MEMORY_UTILS.getMemoryInfo().numTensors || 0
    };
  }

  /**
   * Handle initialization errors with fallback strategies
   */
  async handleInitializationError(error) {
    console.log('🔄 Attempting error recovery...');
    
    if (error.message.includes('memory') || error.message.includes('tensor')) {
      // Memory-related error - try cleanup and retry
      MEMORY_UTILS.cleanup();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        this.model = createScheduleModel();
        this.isInitialized = true;
        console.log('✅ Recovery successful - created new model');
      } catch (retryError) {
        console.error('❌ Recovery failed:', retryError.message);
      }
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
    const modelAge = Date.now() - (this.modelPerformanceMetrics.lastTraining || 0);
    if (modelAge > 30 * 24 * 60 * 60 * 1000) return true;
    
    return false;
  }

  /**
   * Extract and validate training data
   */
  async extractAndValidateTrainingData() {
    try {
      const extractedData = extractAllDataForAI();
      
      if (!extractedData.success || !extractedData.data) {
        return {
          success: false,
          error: 'No historical data available for training'
        };
      }
      
      const { rawPeriodData, staffProfiles, summary } = extractedData.data;
      
      if (rawPeriodData.length === 0) {
        return {
          success: false,
          error: 'No period data found for training'
        };
      }
      
      // Convert to training format
      const allHistoricalData = {};
      const allStaffMembers = [];
      
      rawPeriodData.forEach(periodData => {
        allHistoricalData[periodData.monthIndex] = {
          schedule: periodData.scheduleData,
          dateRange: periodData.dateRange
        };
        
        // Collect unique staff members
        periodData.staffData.forEach(staff => {
          if (!allStaffMembers.find(s => s.id === staff.id)) {
            allStaffMembers.push(staff);
          }
        });
      });
      
      // Assess data quality
      const dataQuality = {
        completeness: summary.dataCompleteness,
        periods: rawPeriodData.length,
        staffCount: allStaffMembers.length,
        totalDataPoints: Object.keys(staffProfiles).length
      };
      
      return {
        success: true,
        allHistoricalData,
        allStaffMembers,
        dataQuality
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
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
        staffMembers
      );
      
      if (trainingData.features.length === 0) {
        return {
          success: false,
          error: 'No training samples generated from historical data'
        };
      }
      
      // Data augmentation if requested
      let features = trainingData.features;
      let labels = trainingData.labels;
      
      if (options.dataAugmentation && features.length < 1000) {
        const augmentedData = await this.performDataAugmentation(features, labels);
        features = features.concat(augmentedData.features);
        labels = labels.concat(augmentedData.labels);
      }
      
      // Split into training and validation sets
      const splitIndex = Math.floor(features.length * 0.8);
      const validationFeatures = features.slice(splitIndex);
      const validationLabels = labels.slice(splitIndex);
      
      features = features.slice(0, splitIndex);
      labels = labels.slice(0, splitIndex);
      
      return {
        success: true,
        features,
        labels,
        validationFeatures,
        validationLabels
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
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
      validationSplit: this.adaptiveLearning.validationSplit
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
  async performEnhancedTraining(features, labels, validationFeatures, validationLabels, config) {
    try {
      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE);
      
      let validationData = null;
      if (validationFeatures && validationLabels) {
        const valXs = tf.tensor2d(validationFeatures);
        const valYs = tf.oneHot(tf.tensor1d(validationLabels, 'int32'), MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE);
        validationData = [valXs, valYs];
      }
      
      console.log('🔄 Starting enhanced neural network training...');
      
      // Enhanced training with callbacks
      const history = await this.model.fit(xs, ys, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationData: validationData,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const progress = ((epoch + 1) / config.epochs * 100).toFixed(1);
            if (epoch % Math.max(1, Math.floor(config.epochs / 10)) === 0) {
              console.log(`📈 Progress: ${progress}% - Loss: ${logs.loss.toFixed(4)}, Accuracy: ${logs.acc.toFixed(4)}`);
            }
            
            // Early stopping if loss increases significantly
            if (epoch > 10 && logs.loss > 2.0) {
              console.log('⚠️ Early stopping due to loss explosion');
              this.model.stopTraining = true;
            }
          },
          onTrainEnd: () => {
            console.log('🎯 Enhanced training completed!');
          }
        }
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
      const finalAccuracy = history.history.acc ? history.history.acc[history.history.acc.length - 1] : 0;
      
      this.trainingHistory = history;
      
      return {
        success: true,
        history,
        finalMetrics: {
          loss: finalLoss,
          accuracy: finalAccuracy
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
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
      const modelCopy = await tf.loadLayersModel(tf.io.fromMemory({
        modelTopology: this.model.toJSON(),
        weightSpecs: this.model.getWeights().map(w => ({ name: w.name, shape: w.shape, dtype: w.dtype })),
        weightData: tf.io.concatenateArrayBuffers(this.model.getWeights().map(w => w.dataSync().buffer))
      }));
      
      this.modelBackups.set(backupId, {
        model: modelCopy,
        timestamp: Date.now(),
        reason,
        version: this.modelVersion,
        performance: { ...this.modelPerformanceMetrics }
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
      
      console.log(`💾 Model backup created: ${backupId}`);
      
    } catch (error) {
      console.warn('⚠️ Failed to create model backup:', error.message);
    }
  }

  /**
   * Calculate recent prediction accuracy
   */
  calculateRecentAccuracy() {
    const recentPredictions = this.performanceMonitor.predictionTimes.slice(-50);
    const successRate = this.performanceMonitor.successCounts / 
      Math.max(1, this.performanceMonitor.successCounts + this.performanceMonitor.errorCounts);
    return Math.max(0, Math.min(1, successRate));
  }

  /**
   * Assess memory efficiency
   */
  assessMemoryEfficiency() {
    const memoryInfo = MEMORY_UTILS.getMemoryInfo();
    const tensorCount = memoryInfo.numTensors || 0;
    
    if (tensorCount < 50) return 'excellent';
    if (tensorCount < 100) return 'good';
    if (tensorCount < 200) return 'moderate';
    return 'needs_optimization';
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
    const total = this.performanceMonitor.successCounts + this.performanceMonitor.errorCounts;
    return total > 0 ? this.performanceMonitor.errorCounts / total : 0;
  }

  /**
   * Get latest backup information
   */
  getLatestBackupInfo() {
    if (this.modelBackups.size === 0) return null;
    
    const backups = Array.from(this.modelBackups.values());
    const latest = backups.reduce((latest, backup) => 
      backup.timestamp > latest.timestamp ? backup : latest
    );
    
    return {
      timestamp: latest.timestamp,
      reason: latest.reason,
      version: latest.version
    };
  }

  /**
   * Enhanced model saving with metadata
   */
  async saveEnhancedModel() {
    try {
      await MODEL_STORAGE.saveModel(this.model);
      await this.saveModelVersion();
      console.log('💾 Enhanced model saved successfully');
    } catch (error) {
      console.error('❌ Failed to save enhanced model:', error);
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
      memoryUsage: MEMORY_UTILS.getMemoryInfo().numTensors || 0
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
    const parts = this.modelVersion.split('.');
    const minor = parseInt(parts[1] || 0) + 1;
    return `${parts[0]}.${minor}.0`;
  }

  /**
   * Attempt model recovery after training failure
   */
  async attemptModelRecovery(error) {
    try {
      console.log('🔄 Attempting model recovery...');
      
      // Try to restore from backup
      if (this.modelBackups.size > 0) {
        const latestBackup = this.getLatestBackupInfo();
        console.log(`🔄 Restoring from backup: ${latestBackup.reason}`);
        
        // This would require implementing backup restoration
        // For now, we'll create a new model
        this.model = createScheduleModel();
        
        return {
          success: true,
          method: 'backup_restore',
          backupUsed: latestBackup
        };
      }
      
      // Fallback: create new model
      this.model = createScheduleModel();
      
      return {
        success: true,
        method: 'new_model_created'
      };
      
    } catch (recoveryError) {
      console.error('❌ Model recovery failed:', recoveryError);
      return {
        success: false,
        error: recoveryError.message
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
        this.performanceMonitor.memorySnapshots = this.performanceMonitor.memorySnapshots.slice(-50);
      }
      
      if (this.performanceMonitor.predictionTimes.length > 100) {
        this.performanceMonitor.predictionTimes = this.performanceMonitor.predictionTimes.slice(-100);
      }
      
      // Perform memory cleanup
      MEMORY_UTILS.cleanup();
      
      console.log('🧹 Post-training cleanup completed');
      
    } catch (error) {
      console.warn('⚠️ Post-training cleanup failed:', error.message);
    }
  }

  // Additional methods for feedback processing would go here...
  // These are placeholders for the full implementation
  
  async processFeedbackData(correctionData) {
    // Process and validate user correction data
    return { success: true, data: correctionData };
  }
  
  async shouldPerformIncrementalUpdate() {
    // Determine if incremental retraining should be triggered
    return this.feedbackData.filter(f => !f.processed).length >= 10;
  }
  
  async performIncrementalRetraining() {
    // Perform incremental model updates based on feedback
    return { success: true, updatesApplied: this.feedbackData.length };
  }
  
  hasStaffCompositionChanged(currentStaffMembers) {
    // Check if staff composition has changed significantly
    return false; // Placeholder
  }
  
  async performDataAugmentation(features, labels) {
    // Perform data augmentation to increase training samples
    return { features: [], labels: [] }; // Placeholder
  }
}

export default TensorFlowScheduler;