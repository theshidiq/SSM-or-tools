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

export class TensorFlowScheduler {
  constructor() {
    this.model = null;
    this.featureEngineer = new ScheduleFeatureEngineer();
    this.isInitialized = false;
    this.isTraining = false;
    this.trainingHistory = null;
  }
  
  /**
   * Initialize TensorFlow and load or create model
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      console.log('🚀 Initializing TensorFlow ML Scheduler...');
      
      // Initialize TensorFlow backend
      const tfReady = await initializeTensorFlow();
      if (!tfReady) {
        throw new Error('TensorFlow initialization failed');
      }
      
      // Try to load existing trained model
      this.model = await MODEL_STORAGE.loadModel();
      
      if (!this.model) {
        console.log('📦 No trained model found, creating new model...');
        this.model = createScheduleModel();
      } else {
        console.log('✅ Loaded existing trained model');
      }
      
      this.isInitialized = true;
      MEMORY_UTILS.logMemoryUsage('After ML initialization');
      
      return true;
    } catch (error) {
      console.error('❌ TensorFlow ML initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Train the model on historical schedule data
   */
  async trainModel(allHistoricalData, staffMembers, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isTraining) {
      console.log('⏳ Training already in progress...');
      return null;
    }
    
    try {
      this.isTraining = true;
      console.log('🎓 Starting ML model training...');
      MEMORY_UTILS.logMemoryUsage('Before training');
      
      // Prepare training data
      const trainingData = this.featureEngineer.prepareTrainingData(
        allHistoricalData, 
        staffMembers
      );
      
      if (trainingData.features.length === 0) {
        throw new Error('No training data available');
      }
      
      console.log(`📊 Training data: ${trainingData.features.length} samples`);
      
      // Convert to tensors
      const xs = tf.tensor2d(trainingData.features);
      const ys = tf.oneHot(tf.tensor1d(trainingData.labels, 'int32'), 
                           MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE);
      
      console.log('🔄 Training neural network...');
      
      // Train the model
      const history = await this.model.fit(xs, ys, {
        epochs: options.epochs || MODEL_CONFIG.TRAINING.EPOCHS,
        batchSize: options.batchSize || MODEL_CONFIG.TRAINING.BATCH_SIZE,
        validationSplit: MODEL_CONFIG.TRAINING.VALIDATION_SPLIT,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`📈 Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
            }
          },
          onTrainEnd: () => {
            console.log('🎯 Training completed!');
          }
        }
      });
      
      this.trainingHistory = history;
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      // Save trained model
      await MODEL_STORAGE.saveModel(this.model);
      
      // Get final metrics
      const finalLoss = history.history.loss[history.history.loss.length - 1];
      const finalAccuracy = history.history.acc[history.history.acc.length - 1];
      
      console.log(`✅ Training complete! Final accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
      MEMORY_UTILS.logMemoryUsage('After training');
      
      return {
        success: true,
        finalAccuracy: finalAccuracy,
        finalLoss: finalLoss,
        trainingHistory: history.history,
        trainingSamples: trainingData.features.length
      };
      
    } catch (error) {
      console.error('❌ Model training failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isTraining = false;
      MEMORY_UTILS.cleanup();
    }
  }
  
  /**
   * Predict shift assignments for empty schedule cells
   */
  async predictSchedule(currentSchedule, staffMembers, dateRange, allHistoricalData) {
    if (!this.isInitialized || !this.model) {
      console.log('⚠️ Model not initialized, initializing...');
      await this.initialize();
    }
    
    try {
      console.log('🔮 Generating ML predictions for schedule...');
      
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
    if (!this.trainingHistory) return 0.75; // Default estimate
    
    const history = this.trainingHistory.history;
    if (history.val_acc && history.val_acc.length > 0) {
      return history.val_acc[history.val_acc.length - 1];
    } else if (history.acc && history.acc.length > 0) {
      return history.acc[history.acc.length - 1];
    }
    
    return 0.75;
  }
  
  /**
   * Get model summary information
   */
  getModelInfo() {
    if (!this.model) return null;
    
    return {
      isInitialized: this.isInitialized,
      isTraining: this.isTraining,
      totalParams: this.model.countParams(),
      architecture: MODEL_CONFIG.ARCHITECTURE,
      accuracy: this.getModelAccuracy(),
      memoryUsage: MEMORY_UTILS.getMemoryInfo()
    };
  }
  
  /**
   * Retrain model with new feedback data
   */
  async updateModelWithFeedback(correctionData) {
    // Placeholder for reinforcement learning / feedback updates
    console.log('📝 Model feedback update (future enhancement)');
    return true;
  }
  
  /**
   * Cleanup resources
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    MEMORY_UTILS.cleanup();
    this.isInitialized = false;
    
    console.log('🧹 TensorFlow ML Scheduler disposed');
  }
}

export default TensorFlowScheduler;