/**
 * TensorFlowConfig.js
 * 
 * Configuration and setup for TensorFlow.js ML models
 * for restaurant shift scheduling prediction.
 */

import * as tf from '@tensorflow/tfjs';

// Model architecture configuration
export const MODEL_CONFIG = {
  // Input features configuration
  INPUT_FEATURES: {
    STAFF_FEATURES: 10,    // staff_id, status, position, etc.
    TEMPORAL_FEATURES: 8,  // day_of_week, date, period, etc.
    HISTORICAL_FEATURES: 12, // past patterns, preferences, etc.
    CONTEXT_FEATURES: 5,   // business context, constraints, etc.
    TOTAL: 35 // Total input feature size
  },
  
  // Neural network architecture
  ARCHITECTURE: {
    INPUT_SIZE: 35,
    HIDDEN_LAYERS: [128, 64, 32, 16],
    OUTPUT_SIZE: 5, // [blank, ○, △, ▽, ×]
    DROPOUT_RATE: 0.3,
    ACTIVATION: 'relu',
    OUTPUT_ACTIVATION: 'softmax'
  },
  
  // Training configuration
  TRAINING: {
    EPOCHS: 50,
    BATCH_SIZE: 32,
    VALIDATION_SPLIT: 0.2,
    LEARNING_RATE: 0.001,
    OPTIMIZER: 'adam',
    LOSS: 'categoricalCrossentropy',
    METRICS: ['accuracy']
  },
  
  // Shift type mappings
  SHIFT_TYPES: {
    BLANK: 0,      // Normal shift for 社員 (regular staff)
    CIRCLE: 1,     // ○ - Normal shift for パート (part-time)
    TRIANGLE: 2,   // △ - Early shift
    INVERTED: 3,   // ▽ - Late shift  
    CROSS: 4       // × - Day off
  },
  
  // Staff type mappings
  STAFF_TYPES: {
    REGULAR: 0,    // 社員 - Regular employee
    PART_TIME: 1   // パート - Part-time employee
  }
};

/**
 * Initialize TensorFlow backend and configure GPU acceleration if available
 */
export const initializeTensorFlow = async () => {
  try {
    // Set backend (webgl for GPU, cpu for fallback)
    await tf.ready();
    
    const backend = tf.getBackend();
    console.log(`🧠 TensorFlow.js initialized with backend: ${backend}`);
    
    // Memory management
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    tf.env().set('WEBGL_PACK', true);
    
    return true;
  } catch (error) {
    console.error('❌ TensorFlow initialization failed:', error);
    return false;
  }
};

/**
 * Create the neural network model for shift prediction
 */
export const createScheduleModel = () => {
  const model = tf.sequential({
    layers: [
      // Input layer
      tf.layers.dense({
        inputShape: [MODEL_CONFIG.ARCHITECTURE.INPUT_SIZE],
        units: MODEL_CONFIG.ARCHITECTURE.HIDDEN_LAYERS[0],
        activation: MODEL_CONFIG.ARCHITECTURE.ACTIVATION,
        kernelInitializer: 'glorotUniform',
        name: 'input_dense'
      }),
      
      // Dropout for regularization
      tf.layers.dropout({
        rate: MODEL_CONFIG.ARCHITECTURE.DROPOUT_RATE,
        name: 'input_dropout'
      }),
      
      // Hidden layers
      ...MODEL_CONFIG.ARCHITECTURE.HIDDEN_LAYERS.slice(1).map((units, index) => 
        tf.layers.dense({
          units,
          activation: MODEL_CONFIG.ARCHITECTURE.ACTIVATION,
          kernelInitializer: 'glorotUniform',
          name: `hidden_${index + 1}`
        })
      ),
      
      // Final dropout
      tf.layers.dropout({
        rate: MODEL_CONFIG.ARCHITECTURE.DROPOUT_RATE / 2,
        name: 'final_dropout'
      }),
      
      // Output layer
      tf.layers.dense({
        units: MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
        activation: MODEL_CONFIG.ARCHITECTURE.OUTPUT_ACTIVATION,
        name: 'output'
      })
    ]
  });
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(MODEL_CONFIG.TRAINING.LEARNING_RATE),
    loss: MODEL_CONFIG.TRAINING.LOSS,
    metrics: MODEL_CONFIG.TRAINING.METRICS
  });
  
  console.log('🏗️ TensorFlow model created:');
  model.summary();
  
  return model;
};

/**
 * Model persistence utilities
 */
export const MODEL_STORAGE = {
  // IndexedDB storage key
  STORAGE_KEY: 'restaurant-schedule-ml-model',
  
  // Save model to browser storage
  saveModel: async (model, version = '1.0') => {
    try {
      const saveUrl = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;
      await model.save(saveUrl);
      console.log(`💾 Model saved to ${saveUrl}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to save model:', error);
      return false;
    }
  },
  
  // Load model from browser storage
  loadModel: async (version = '1.0') => {
    try {
      const loadUrl = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;
      const model = await tf.loadLayersModel(loadUrl);
      console.log(`📂 Model loaded from ${loadUrl}`);
      return model;
    } catch (error) {
      console.log(`ℹ️ No saved model found, will create new one`);
      return null;
    }
  },
  
  // Check if model exists
  modelExists: async (version = '1.0') => {
    try {
      const models = await tf.io.listModels();
      const key = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;
      return key in models;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Memory management utilities
 */
export const MEMORY_UTILS = {
  // Get current memory usage
  getMemoryInfo: () => {
    const memInfo = tf.memory();
    return {
      numTensors: memInfo.numTensors,
      numDataBuffers: memInfo.numDataBuffers,
      numBytes: memInfo.numBytes,
      unreliable: memInfo.unreliable
    };
  },
  
  // Clean up unused tensors
  cleanup: () => {
    const before = tf.memory();
    tf.disposeVariables();
    tf.engine().endScope();
    const after = tf.memory();
    
    console.log(`🧹 Memory cleanup: ${before.numTensors} → ${after.numTensors} tensors`);
  },
  
  // Monitor memory usage
  logMemoryUsage: (label = 'Memory') => {
    const info = MEMORY_UTILS.getMemoryInfo();
    console.log(`📊 ${label}:`, info);
  }
};

// Export default configuration
export default {
  MODEL_CONFIG,
  initializeTensorFlow,
  createScheduleModel,
  MODEL_STORAGE,
  MEMORY_UTILS
};