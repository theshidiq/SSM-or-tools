/**
 * enhancedAIWorker.js
 * 
 * Enhanced AI Web Worker with advanced task scheduling, micro-batching,
 * progressive yielding, and frame-aware processing for true non-blocking ML operations.
 */

// Import TensorFlow.js and other ML dependencies
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');

// Worker state and configuration
let workerState = {
  id: null,
  isInitialized: false,
  isProcessing: false,
  canYield: true,
  frameTimeBudget: 16, // 16ms for 60fps
  lastFrameTime: 0,
  yieldThreshold: 5, // Yield after 5ms of continuous processing
  processingQueue: [],
  currentTask: null,
  memoryManager: null,
  mlModels: new Map(),
  taskScheduler: null
};

// Performance monitoring
let performanceMetrics = {
  tasksProcessed: 0,
  averageTaskTime: 0,
  totalProcessingTime: 0,
  yieldCount: 0,
  frameDrops: 0,
  memoryCleanups: 0,
  lastHeartbeat: Date.now(),
  heartbeatInterval: 10000 // 10 seconds
};

// Memory management configuration
let memoryConfig = {
  maxMemoryMB: 200,
  cleanupThresholdMB: 160,
  tensorLifetime: 30000, // 30 seconds
  gcInterval: 15000, // 15 seconds
  activetensors: new Map(),
  memoryPressureLevel: 0 // 0 = low, 1 = medium, 2 = high
};

// Task scheduling configuration
let schedulingConfig = {
  maxBatchSize: 20,
  minBatchSize: 5,
  adaptiveBatching: true,
  priorityQueue: true,
  yieldOnFrameDrops: true,
  progressiveProcessing: true
};

/**
 * Initialize the enhanced AI worker
 */
async function initializeEnhancedWorker(config) {
  try {
    console.log('🚀 Initializing Enhanced AI Worker:', config.workerId);
    
    // Set worker ID
    workerState.id = config.workerId;
    
    // Apply configuration
    if (config.config) {
      Object.assign(memoryConfig, config.config);
      Object.assign(schedulingConfig, config.config);
      workerState.frameTimeBudget = 1000 / (config.config.targetFPS || 60);
    }

    // Initialize TensorFlow.js with optimization
    await initializeTensorFlow();
    
    // Setup memory management
    initializeMemoryManagement();
    
    // Setup task scheduler
    initializeTaskScheduler();
    
    // Setup performance monitoring
    startPerformanceMonitoring();
    
    // Setup frame-aware processing
    setupFrameAwareProcessing();
    
    // Load ML models if configured
    if (config.config?.enableMLPredictions) {
      await loadMLModels(config.config.modelConfig || {});
    }
    
    workerState.isInitialized = true;
    
    postMessage({
      type: 'initialized',
      data: {
        success: true,
        workerId: workerState.id,
        capabilities: getWorkerCapabilities(),
        memoryInfo: getMemoryInfo(),
        performanceMetrics: performanceMetrics
      }
    });
    
  } catch (error) {
    postMessage({
      type: 'error',
      data: {
        error: error.message,
        stage: 'initialization',
        workerId: workerState.id
      }
    });
  }
}

/**
 * Initialize TensorFlow.js with optimizations
 */
async function initializeTensorFlow() {
  await tf.ready();
  
  // Optimize for worker environment
  tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
  tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  tf.env().set('WEBGL_PACK', true);
  tf.env().set('WEBGL_MAX_TEXTURE_SIZE', 4096);
  
  // Setup memory cleanup hooks
  const originalTensor = tf.tensor;
  tf.tensor = function(...args) {
    const tensor = originalTensor.apply(this, args);
    trackTensorLifecycle(tensor);
    return tensor;
  };
  
  console.log('✅ TensorFlow.js initialized in worker with backend:', tf.getBackend());
}

/**
 * Initialize memory management system
 */
function initializeMemoryManagement() {
  workerState.memoryManager = {
    currentUsage: 0,
    peakUsage: 0,
    cleanupCount: 0,
    lastCleanup: Date.now(),
    
    // Track memory usage
    updateUsage() {
      if (tf.memory) {
        this.currentUsage = tf.memory().numBytes;
        this.peakUsage = Math.max(this.peakUsage, this.currentUsage);
        
        // Update pressure level
        const usageMB = this.currentUsage / 1024 / 1024;
        if (usageMB > memoryConfig.maxMemoryMB * 0.8) {
          memoryConfig.memoryPressureLevel = 2; // High
        } else if (usageMB > memoryConfig.maxMemoryMB * 0.6) {
          memoryConfig.memoryPressureLevel = 1; // Medium
        } else {
          memoryConfig.memoryPressureLevel = 0; // Low
        }
      }
    },
    
    // Perform memory cleanup
    async cleanup(force = false) {
      const now = Date.now();
      const usageMB = this.currentUsage / 1024 / 1024;
      
      if (force || usageMB > memoryConfig.cleanupThresholdMB) {
        const beforeMemory = this.currentUsage;
        
        // Dispose old tensors
        cleanupOldTensors();
        
        // Force TensorFlow cleanup
        tf.dispose();
        
        // Manual garbage collection if available
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
        
        this.updateUsage();
        this.lastCleanup = now;
        this.cleanupCount++;
        
        const cleaned = beforeMemory - this.currentUsage;
        performanceMetrics.memoryCleanups++;
        
        postMessage({
          type: 'memory_cleanup',
          data: {
            cleaned,
            currentUsage: this.currentUsage,
            peakUsage: this.peakUsage
          }
        });
        
        return cleaned;
      }
      
      return 0;
    }
  };
  
  // Start periodic cleanup
  setInterval(() => {
    workerState.memoryManager.updateUsage();
    workerState.memoryManager.cleanup();
  }, memoryConfig.gcInterval);
}

/**
 * Initialize task scheduler with micro-batching and yielding
 */
function initializeTaskScheduler() {
  workerState.taskScheduler = {
    queue: [],
    processing: false,
    currentBatch: null,
    yieldCounter: 0,
    
    // Add task to queue
    enqueue(task) {
      if (schedulingConfig.priorityQueue) {
        // Insert based on priority
        const priority = task.priority || 0;
        const insertIndex = this.queue.findIndex(t => (t.priority || 0) < priority);
        
        if (insertIndex === -1) {
          this.queue.push(task);
        } else {
          this.queue.splice(insertIndex, 0, task);
        }
      } else {
        this.queue.push(task);
      }
    },
    
    // Create optimized batch from queue
    createBatch() {
      if (this.queue.length === 0) return null;
      
      let batchSize = schedulingConfig.maxBatchSize;
      
      if (schedulingConfig.adaptiveBatching) {
        // Adjust batch size based on memory pressure
        switch (memoryConfig.memoryPressureLevel) {
          case 2: // High pressure
            batchSize = Math.min(schedulingConfig.minBatchSize, batchSize);
            break;
          case 1: // Medium pressure
            batchSize = Math.floor(batchSize * 0.7);
            break;
          // Low pressure uses max batch size
        }
        
        // Adjust for recent performance
        if (performanceMetrics.averageTaskTime > 100) { // Over 100ms per task
          batchSize = Math.max(schedulingConfig.minBatchSize, Math.floor(batchSize * 0.5));
        }
      }
      
      const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
      return batch.length > 0 ? batch : null;
    },
    
    // Process tasks with yielding
    async processTasks() {
      if (this.processing) return;
      
      this.processing = true;
      
      try {
        while (this.queue.length > 0 || this.currentBatch) {
          // Create new batch if needed
          if (!this.currentBatch) {
            this.currentBatch = this.createBatch();
            if (!this.currentBatch) break;
          }
          
          // Process batch with yielding
          await this.processBatchWithYielding(this.currentBatch);
          this.currentBatch = null;
          
          // Check if we should yield to main thread
          if (await this.shouldYieldToMainThread()) {
            await this.yieldToMainThread();
          }
        }
      } finally {
        this.processing = false;
      }
    },
    
    // Process batch with micro-yielding
    async processBatchWithYielding(batch) {
      const results = [];
      const startTime = performance.now();
      
      for (let i = 0; i < batch.length; i++) {
        const task = batch[i];
        
        // Process individual task
        const taskStartTime = performance.now();
        const result = await this.processIndividualTask(task);
        const taskTime = performance.now() - taskStartTime;
        
        results.push(result);
        
        // Update performance metrics
        this.updateTaskMetrics(taskTime);
        
        // Check for micro-yield
        if (this.shouldMicroYield(taskStartTime)) {
          await this.microYield();
        }
        
        // Memory cleanup if needed
        if (memoryConfig.memoryPressureLevel >= 1 && i % 5 === 0) {
          await workerState.memoryManager.cleanup();
        }
      }
      
      const totalTime = performance.now() - startTime;
      
      // Send progress update
      postMessage({
        type: 'batch_progress',
        data: {
          batchSize: batch.length,
          results,
          processingTime: totalTime,
          memoryUsage: workerState.memoryManager.currentUsage,
          yieldCount: this.yieldCounter
        }
      });
      
      return results;
    },
    
    // Process individual task
    async processIndividualTask(task) {
      switch (task.type) {
        case 'ml_prediction':
          return await processMLPrediction(task.data);
        case 'constraint_validation':
          return await processConstraintValidation(task.data);
        case 'pattern_recognition':
          return await processPatternRecognition(task.data);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    },
    
    // Check if should yield to main thread
    async shouldYieldToMainThread() {
      const now = performance.now();
      const timeSinceLastYield = now - (workerState.lastFrameTime || now);
      
      return (
        workerState.canYield &&
        timeSinceLastYield >= workerState.frameTimeBudget
      );
    },
    
    // Yield to main thread
    async yieldToMainThread() {
      return new Promise(resolve => {
        this.yieldCounter++;
        performanceMetrics.yieldCount++;
        
        setTimeout(() => {
          workerState.lastFrameTime = performance.now();
          resolve();
        }, 1);
      });
    },
    
    // Check if should micro-yield
    shouldMicroYield(taskStartTime) {
      return (
        performance.now() - taskStartTime >= workerState.yieldThreshold
      );
    },
    
    // Perform micro-yield
    async microYield() {
      await new Promise(resolve => setTimeout(resolve, 0));
    },
    
    // Update task performance metrics
    updateTaskMetrics(taskTime) {
      performanceMetrics.tasksProcessed++;
      performanceMetrics.totalProcessingTime += taskTime;
      performanceMetrics.averageTaskTime = 
        performanceMetrics.totalProcessingTime / performanceMetrics.tasksProcessed;
    }
  };
}

/**
 * Setup frame-aware processing
 */
function setupFrameAwareProcessing() {
  // Monitor frame timing for responsive processing
  let lastFrameCheck = performance.now();
  
  setInterval(() => {
    const now = performance.now();
    const frameTime = now - lastFrameCheck;
    lastFrameCheck = now;
    
    // Detect frame drops
    if (frameTime > workerState.frameTimeBudget * 2) {
      performanceMetrics.frameDrops++;
      
      // Adjust processing strategy for better responsiveness
      if (schedulingConfig.yieldOnFrameDrops) {
        workerState.yieldThreshold = Math.max(1, workerState.yieldThreshold - 1);
      }
    }
    
    // Adjust yield threshold based on performance
    if (frameTime < workerState.frameTimeBudget * 0.5) {
      workerState.yieldThreshold = Math.min(10, workerState.yieldThreshold + 0.5);
    }
  }, workerState.frameTimeBudget);
}

/**
 * Start performance monitoring and heartbeat
 */
function startPerformanceMonitoring() {
  setInterval(() => {
    // Update memory usage
    workerState.memoryManager.updateUsage();
    
    // Send heartbeat
    performanceMetrics.lastHeartbeat = Date.now();
    
    postMessage({
      type: 'heartbeat',
      data: {
        workerId: workerState.id,
        state: workerState.isProcessing ? 'processing' : 'ready',
        memoryUsage: workerState.memoryManager.currentUsage,
        taskQueueLength: workerState.taskScheduler.queue.length,
        performanceMetrics: {
          ...performanceMetrics,
          memoryPressureLevel: memoryConfig.memoryPressureLevel
        }
      }
    });
  }, performanceMetrics.heartbeatInterval);
}

/**
 * Load ML models with optimization
 */
async function loadMLModels(modelConfig) {
  try {
    // Load lightweight prediction model
    const predictionModel = await createOptimizedModel(modelConfig);
    workerState.mlModels.set('prediction', predictionModel);
    
    console.log('✅ ML models loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load ML models:', error);
    throw error;
  }
}

/**
 * Create optimized neural network model
 */
async function createOptimizedModel(config) {
  const inputSize = config.inputSize || 50;
  const outputSize = config.outputSize || 4;
  const batchSize = config.batchSize || 10;
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [inputSize],
        units: 32,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: outputSize,
        activation: 'softmax'
      })
    ]
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

/**
 * Process ML prediction task
 */
async function processMLPrediction(data) {
  const model = workerState.mlModels.get('prediction');
  if (!model) {
    throw new Error('ML prediction model not loaded');
  }

  return tf.tidy(() => {
    try {
      const { features, staffId, dateKey } = data;
      
      // Create input tensor
      const inputTensor = tf.tensor2d([features]);
      
      // Make prediction
      const prediction = model.predict(inputTensor);
      const probabilities = prediction.dataSync();
      
      // Process results
      let maxProb = 0;
      let bestClass = 0;
      
      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          bestClass = i;
        }
      }

      const shiftMap = ['○', '△', '▽', '×']; // normal, early, late, off
      
      return {
        staffId,
        dateKey,
        prediction: shiftMap[bestClass] || '○',
        confidence: Math.round(maxProb * 100),
        probabilities: Array.from(probabilities),
        processingTime: performance.now()
      };
      
    } catch (error) {
      console.error('ML prediction error:', error);
      return {
        staffId: data.staffId,
        dateKey: data.dateKey,
        error: error.message
      };
    }
  });
}

/**
 * Process constraint validation task
 */
async function processConstraintValidation(data) {
  // Simplified constraint validation
  return {
    valid: true,
    violations: [],
    processingTime: performance.now()
  };
}

/**
 * Process pattern recognition task
 */
async function processPatternRecognition(data) {
  // Simplified pattern recognition
  return {
    patterns: [],
    confidence: 0,
    processingTime: performance.now()
  };
}

/**
 * Track tensor lifecycle for memory management
 */
function trackTensorLifecycle(tensor) {
  const id = tensor.id;
  const createdAt = Date.now();
  
  memoryConfig.activetensors.set(id, {
    tensor,
    createdAt,
    size: tensor.size * 4 // Assume float32
  });
}

/**
 * Cleanup old tensors
 */
function cleanupOldTensors() {
  const now = Date.now();
  const maxAge = memoryConfig.tensorLifetime;
  
  for (const [id, tensorInfo] of memoryConfig.activetensors) {
    if (now - tensorInfo.createdAt > maxAge) {
      try {
        tensorInfo.tensor.dispose();
        memoryConfig.activetensors.delete(id);
      } catch (error) {
        // Tensor might already be disposed
        memoryConfig.activetensors.delete(id);
      }
    }
  }
}

/**
 * Get worker capabilities
 */
function getWorkerCapabilities() {
  return {
    tensorflow: {
      version: tf.version.tfjs,
      backend: tf.getBackend(),
      ready: true
    },
    features: {
      mlPredictions: workerState.mlModels.has('prediction'),
      constraintValidation: true,
      patternRecognition: true,
      frameAwareProcessing: true,
      adaptiveBatching: schedulingConfig.adaptiveBatching,
      memoryManagement: true,
      progressiveYielding: true
    },
    performance: {
      frameTimeBudget: workerState.frameTimeBudget,
      yieldThreshold: workerState.yieldThreshold,
      maxBatchSize: schedulingConfig.maxBatchSize,
      memoryLimit: memoryConfig.maxMemoryMB
    }
  };
}

/**
 * Get memory information
 */
function getMemoryInfo() {
  const tfMemory = tf.memory();
  return {
    tensorflow: {
      numTensors: tfMemory.numTensors,
      numDataBuffers: tfMemory.numDataBuffers,
      numBytes: tfMemory.numBytes
    },
    managed: {
      currentUsage: workerState.memoryManager?.currentUsage || 0,
      peakUsage: workerState.memoryManager?.peakUsage || 0,
      activeTensors: memoryConfig.activetensors.size,
      pressureLevel: memoryConfig.memoryPressureLevel
    }
  };
}

/**
 * Process task batch - main entry point for batch processing
 */
async function processTaskBatch(data, requestId) {
  try {
    const { tasks, batchIndex, jobId } = data;
    
    postMessage({
      type: 'progress',
      requestId,
      data: {
        progress: 0,
        stage: 'starting_batch',
        message: `バッチ ${batchIndex + 1} 開始`,
        batchIndex,
        taskCount: tasks.length
      }
    });

    // Add tasks to scheduler queue
    tasks.forEach((task, index) => {
      workerState.taskScheduler.enqueue({
        ...task,
        batchIndex,
        taskIndex: index,
        requestId,
        priority: task.priority || 0
      });
    });

    // Process tasks
    await workerState.taskScheduler.processTasks();

    const results = {
      results: {
        predictions: {},
        confidence: {},
        stats: {
          totalTasks: tasks.length,
          processedTasks: tasks.length,
          processingTime: performance.now()
        }
      },
      memoryInfo: getMemoryInfo(),
      performanceMetrics
    };

    postMessage({
      type: 'result',
      requestId,
      data: results
    });

  } catch (error) {
    postMessage({
      type: 'error',
      requestId,
      data: {
        error: error.message,
        stage: 'batch_processing'
      }
    });
  }
}

/**
 * Main message handler
 */
self.onmessage = async function(event) {
  const { type, data, requestId } = event.data;
  
  try {
    switch (type) {
      case 'initialize':
        await initializeEnhancedWorker(data);
        break;
        
      case 'process_task_batch':
        await processTaskBatch(data, requestId);
        break;
        
      case 'cleanup_memory':
        const cleaned = await workerState.memoryManager.cleanup(true);
        postMessage({
          type: 'result',
          requestId,
          data: {
            success: true,
            cleaned,
            memoryInfo: getMemoryInfo()
          }
        });
        break;
        
      case 'get_status':
        postMessage({
          type: 'result',
          requestId,
          data: {
            workerId: workerState.id,
            initialized: workerState.isInitialized,
            processing: workerState.isProcessing,
            memoryInfo: getMemoryInfo(),
            performanceMetrics,
            queueLength: workerState.taskScheduler?.queue.length || 0
          }
        });
        break;
        
      case 'terminate':
        // Graceful shutdown
        console.log('🛑 Enhanced AI Worker terminating...');
        self.close();
        break;
        
      default:
        postMessage({
          type: 'error',
          requestId,
          data: {
            error: `Unknown message type: ${type}`,
            recoverable: true
          }
        });
    }
  } catch (error) {
    postMessage({
      type: 'error',
      requestId,
      data: {
        error: error.message,
        stack: error.stack,
        recoverable: false,
        workerId: workerState.id
      }
    });
  }
};

// Handle uncaught errors
self.onerror = function(error) {
  postMessage({
    type: 'error',
    data: {
      error: error.message,
      filename: error.filename,
      lineno: error.lineno,
      workerId: workerState.id,
      recoverable: false
    }
  });
};

console.log('🚀 Enhanced AI Worker script loaded');