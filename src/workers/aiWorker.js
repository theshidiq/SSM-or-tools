/**
 * aiWorker.js
 *
 * Web Worker for AI/ML processing to prevent main thread blocking.
 * Handles TensorFlow.js operations, genetic algorithms, and constraint validation.
 */

// Import TensorFlow.js and other ML dependencies in worker
importScripts(
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js",
);

// Worker state
let isInitialized = false;
const mlModels = new Map();
let processingState = {
  isProcessing: false,
  currentOperation: null,
  progress: 0,
  stage: "idle",
  startTime: null,
};

// Memory management
const tensorMemoryTracker = {
  totalTensors: 0,
  memoryUsage: 0,
  maxMemoryUsage: 500 * 1024 * 1024, // 500MB limit
  cleanupThreshold: 400 * 1024 * 1024, // Cleanup at 400MB
};

// Model creation functions
async function createConstraintModel(config) {
  console.log('Creating constraint validation model...');
  
  // Simple neural network for constraint validation
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [10], units: 16, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });

  model.compile({
    optimizer: 'adam',
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

async function createPatternModel(config) {
  console.log('Creating pattern recognition model...');
  
  // Simple pattern recognition neural network
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [20], units: 32, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 4, activation: 'softmax' })
    ]
  });

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

/**
 * Initialize the AI worker with models and configurations
 */
async function initializeWorker(config) {
  try {
    postMessage({
      type: "progress",
      data: {
        progress: 0,
        stage: "initializing",
        message: "AIワーカーを初期化中...",
      },
    });

    // Initialize TensorFlow.js in worker thread
    await tf.ready();

    // Set memory management
    tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
    tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);

    postMessage({
      type: "progress",
      data: {
        progress: 25,
        stage: "loading_models",
        message: "MLモデルを読み込み中...",
      },
    });

    // Initialize memory tracking
    setupMemoryTracking();

    // Load base models (lightweight versions for worker)
    await loadWorkerModels(config);

    postMessage({
      type: "progress",
      data: {
        progress: 75,
        stage: "configuring",
        message: "設定を適用中...",
      },
    });

    // Setup worker configurations
    setupWorkerConfigurations(config);

    isInitialized = true;

    postMessage({
      type: "progress",
      data: {
        progress: 100,
        stage: "ready",
        message: "AIワーカー初期化完了",
      },
    });

    postMessage({
      type: "initialized",
      data: {
        success: true,
        memoryInfo: getMemoryInfo(),
        capabilities: getWorkerCapabilities(),
      },
    });
  } catch (error) {
    postMessage({
      type: "error",
      data: {
        error: error.message,
        stage: "initialization",
        recoverable: true,
      },
    });
  }
}

/**
 * Load optimized models for worker processing
 */
async function loadWorkerModels(config) {
  try {
    // Load lightweight neural network for predictions
    if (config.enableMLPredictions) {
      const model = await createLightweightModel(config.modelConfig);
      mlModels.set("prediction", model);
    }

    // Load constraint validation model
    if (config.enableConstraintML) {
      const constraintModel = await createConstraintModel(
        config.constraintConfig,
      );
      mlModels.set("constraint", constraintModel);
    }

    // Load pattern recognition model
    if (config.enablePatternRecognition) {
      const patternModel = await createPatternModel(config.patternConfig);
      mlModels.set("pattern", patternModel);
    }
  } catch (error) {
    throw new Error(`Model loading failed: ${error.message}`);
  }
}

/**
 * Create lightweight neural network model optimized for worker
 */
async function createLightweightModel(config) {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [config.inputSize || 50],
        units: 32,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 16,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: config.outputSize || 4,
        activation: "softmax",
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

/**
 * Process ML predictions in background with progressive updates
 */
async function processMLPredictions(data) {
  const { scheduleData, staffMembers, dateRange, options } = data;

  processingState = {
    isProcessing: true,
    currentOperation: "ml_prediction",
    progress: 0,
    stage: "starting",
    startTime: Date.now(),
  };

  try {
    const results = {
      predictions: new Map(),
      confidence: new Map(),
      processingStats: {
        totalCells: 0,
        processedCells: 0,
        mlPredictions: 0,
        constraintViolations: 0,
      },
    };

    // Calculate total work
    const totalCells = staffMembers.length * dateRange.length;
    results.processingStats.totalCells = totalCells;

    postMessage({
      type: "progress",
      data: {
        progress: 5,
        stage: "preparing_data",
        message: "データを準備中...",
        stats: results.processingStats,
      },
    });

    // Process in chunks to avoid blocking
    const chunkSize = Math.min(50, Math.max(10, Math.floor(totalCells / 20)));
    let processedCount = 0;

    for (let staffIndex = 0; staffIndex < staffMembers.length; staffIndex++) {
      const staff = staffMembers[staffIndex];

      for (
        let dateIndex = 0;
        dateIndex < dateRange.length;
        dateIndex += chunkSize
      ) {
        const dateChunk = dateRange.slice(
          dateIndex,
          Math.min(dateIndex + chunkSize, dateRange.length),
        );

        // Process chunk with yielding
        await processChunkWithYielding(
          staff,
          dateChunk,
          scheduleData,
          results,
          options,
        );

        processedCount += dateChunk.length;
        const progress = Math.min(
          95,
          Math.floor((processedCount / totalCells) * 90) + 5,
        );

        // Update progress
        postMessage({
          type: "progress",
          data: {
            progress,
            stage: "processing_predictions",
            message: `${staff.name}のシフトを予測中... (${processedCount}/${totalCells})`,
            stats: results.processingStats,
          },
        });

        // Yield control to prevent blocking
        await new Promise((resolve) => setTimeout(resolve, 1));

        // Memory cleanup check
        if (processedCount % 100 === 0) {
          await performMemoryCleanup();
        }
      }
    }

    // Final validation and optimization
    postMessage({
      type: "progress",
      data: {
        progress: 95,
        stage: "validating",
        message: "制約を検証中...",
        stats: results.processingStats,
      },
    });

    await validateAndOptimizeResults(
      results,
      scheduleData,
      staffMembers,
      dateRange,
    );

    const processingTime = Date.now() - processingState.startTime;

    postMessage({
      type: "progress",
      data: {
        progress: 100,
        stage: "completed",
        message: "AI予測完了",
        stats: {
          ...results.processingStats,
          processingTime,
        },
      },
    });

    processingState.isProcessing = false;

    return {
      success: true,
      results,
      processingTime,
      memoryInfo: getMemoryInfo(),
    };
  } catch (error) {
    processingState.isProcessing = false;
    throw error;
  }
}

/**
 * Process a chunk of predictions with yielding
 */
async function processChunkWithYielding(
  staff,
  dateChunk,
  scheduleData,
  results,
  options,
) {
  for (const date of dateChunk) {
    const dateKey = date.toISOString().split("T")[0];

    // Skip if already filled
    if (scheduleData[staff.id] && scheduleData[staff.id][dateKey]) {
      continue;
    }

    try {
      // Generate features for ML prediction
      const features = generateFeatures(staff, date, scheduleData, options);

      if (features && mlModels.has("prediction")) {
        // Make ML prediction
        const prediction = await makePrediction(features);

        if (prediction) {
          results.predictions.set(`${staff.id}_${dateKey}`, prediction.class);
          results.confidence.set(
            `${staff.id}_${dateKey}`,
            prediction.confidence,
          );
          results.processingStats.mlPredictions++;
        }
      }

      results.processingStats.processedCells++;
    } catch (error) {
      console.warn(`Prediction failed for ${staff.name} on ${dateKey}:`, error);
    }
  }
}

/**
 * Make ML prediction using loaded model
 */
async function makePrediction(features) {
  const model = mlModels.get("prediction");
  if (!model) return null;

  return tf.tidy(() => {
    try {
      const inputTensor = tf.tensor2d([features]);
      const prediction = model.predict(inputTensor);
      const probabilities = prediction.dataSync();

      // Find best prediction
      let maxProb = 0;
      let bestClass = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          bestClass = i;
        }
      }

      const shiftMap = ["○", "△", "▽", "×"]; // normal, early, late, off

      return {
        class: shiftMap[bestClass] || "○",
        confidence: Math.round(maxProb * 100),
        probabilities: Array.from(probabilities),
      };
    } catch (error) {
      console.warn("Prediction error:", error);
      return null;
    }
  });
}

/**
 * Generate features for ML prediction
 */
function generateFeatures(staff, date, scheduleData, options) {
  try {
    const features = [];

    // Staff features
    features.push(staff.name === "料理長" ? 1 : 0);
    features.push(staff.type === "regular" ? 1 : 0);

    // Date features
    const dayOfWeek = date.getDay();
    for (let i = 0; i < 7; i++) {
      features.push(dayOfWeek === i ? 1 : 0);
    }

    // Historical patterns (last 7 days)
    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - i);
      const pastDateKey = pastDate.toISOString().split("T")[0];

      if (scheduleData[staff.id] && scheduleData[staff.id][pastDateKey]) {
        const shift = scheduleData[staff.id][pastDateKey];
        features.push(shift === "○" ? 1 : 0); // normal
        features.push(shift === "△" ? 1 : 0); // early
        features.push(shift === "▽" ? 1 : 0); // late
        features.push(shift === "×" ? 1 : 0); // off
      } else {
        features.push(0, 0, 0, 0);
      }
    }

    // Pad to expected input size
    while (features.length < 50) {
      features.push(0);
    }

    return features.slice(0, 50);
  } catch (error) {
    console.warn("Feature generation error:", error);
    return null;
  }
}

/**
 * Setup memory tracking and management
 */
function setupMemoryTracking() {
  // Track tensor creation and cleanup
  const originalTensor = tf.tensor;
  tf.tensor = function (...args) {
    const tensor = originalTensor.apply(this, args);
    tensorMemoryTracker.totalTensors++;
    tensorMemoryTracker.memoryUsage += tensor.size * 4; // Assume float32
    return tensor;
  };

  // Monitor memory usage periodically
  setInterval(() => {
    const memInfo = tf.memory();
    tensorMemoryTracker.memoryUsage = memInfo.numBytes;
    tensorMemoryTracker.totalTensors = memInfo.numTensors;

    // Auto cleanup if memory usage is high
    if (memInfo.numBytes > tensorMemoryTracker.cleanupThreshold) {
      performMemoryCleanup();
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Perform memory cleanup
 */
async function performMemoryCleanup() {
  const beforeMemory = tf.memory();

  // Dispose unreferenced tensors
  tf.dispose();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const afterMemory = tf.memory();
  const cleaned = beforeMemory.numBytes - afterMemory.numBytes;

  if (cleaned > 1024 * 1024) {
    // More than 1MB cleaned
    postMessage({
      type: "memory_cleanup",
      data: {
        cleanedBytes: cleaned,
        currentMemory: afterMemory.numBytes,
        currentTensors: afterMemory.numTensors,
      },
    });
  }
}

/**
 * Get current memory information
 */
function getMemoryInfo() {
  const memInfo = tf.memory();
  return {
    totalBytes: memInfo.numBytes,
    numTensors: memInfo.numTensors,
    maxBytes: tensorMemoryTracker.maxMemoryUsage,
    percentUsed: (memInfo.numBytes / tensorMemoryTracker.maxMemoryUsage) * 100,
  };
}

/**
 * Get worker capabilities
 */
function getWorkerCapabilities() {
  return {
    tensorflow: {
      version: tf.version.tfjs,
      backend: tf.getBackend(),
      ready: true,
    },
    features: {
      mlPredictions: mlModels.has("prediction"),
      constraintValidation: mlModels.has("constraint"),
      patternRecognition: mlModels.has("pattern"),
    },
    memoryManagement: true,
    progressiveProcessing: true,
  };
}

/**
 * Cancel current processing operation
 */
function cancelProcessing() {
  if (processingState.isProcessing) {
    processingState.isProcessing = false;
    postMessage({
      type: "cancelled",
      data: {
        operation: processingState.currentOperation,
        progress: processingState.progress,
      },
    });
  }
}

/**
 * Validate and optimize results
 */
async function validateAndOptimizeResults(
  results,
  scheduleData,
  staffMembers,
  dateRange,
) {
  // Run constraint validation
  let violationCount = 0;
  const violations = [];

  // Check basic constraints for each prediction
  for (const [key, prediction] of results.predictions) {
    const [staffId, dateKey] = key.split("_");
    const staff = staffMembers.find((s) => s.id === staffId);

    if (staff) {
      // Simple validation (can be expanded)
      if (
        prediction === "×" &&
        violatesOffDayLimits(staff, dateKey, scheduleData, results.predictions)
      ) {
        violations.push({ staffId, dateKey, violation: "off_day_limit" });
        violationCount++;

        // Auto-correct to normal shift
        results.predictions.set(key, "○");
      }
    }
  }

  results.processingStats.constraintViolations = violationCount;
}

/**
 * Check if off day violates limits (simplified)
 */
function violatesOffDayLimits(staff, dateKey, scheduleData, predictions) {
  const date = new Date(dateKey);
  const month = date.getMonth();
  const year = date.getFullYear();

  let offDayCount = 0;

  // Count existing off days in month
  if (scheduleData[staff.id]) {
    for (const [key, shift] of Object.entries(scheduleData[staff.id])) {
      const keyDate = new Date(key);
      if (
        keyDate.getMonth() === month &&
        keyDate.getFullYear() === year &&
        shift === "×"
      ) {
        offDayCount++;
      }
    }
  }

  // Count predicted off days in month
  for (const [key, prediction] of predictions) {
    if (key.startsWith(staff.id) && prediction === "×") {
      const predDate = new Date(key.split("_")[1]);
      if (predDate.getMonth() === month && predDate.getFullYear() === year) {
        offDayCount++;
      }
    }
  }

  return offDayCount > 8; // Simple limit check
}

// Worker message handler
self.onmessage = async function (event) {
  const { type, data, requestId } = event.data;

  try {
    switch (type) {
      case "initialize":
        await initializeWorker(data);
        break;

      case "process_ml_predictions":
        const result = await processMLPredictions(data);
        postMessage({
          type: "result",
          requestId,
          data: result,
        });
        break;

      case "cancel":
        cancelProcessing();
        break;

      case "get_status":
        postMessage({
          type: "status",
          requestId,
          data: {
            initialized: isInitialized,
            processing: processingState,
            memory: getMemoryInfo(),
            capabilities: isInitialized ? getWorkerCapabilities() : null,
          },
        });
        break;

      case "cleanup_memory":
        await performMemoryCleanup();
        postMessage({
          type: "memory_cleanup_complete",
          requestId,
          data: getMemoryInfo(),
        });
        break;

      default:
        postMessage({
          type: "error",
          requestId,
          data: {
            error: `Unknown message type: ${type}`,
            recoverable: true,
          },
        });
    }
  } catch (error) {
    postMessage({
      type: "error",
      requestId,
      data: {
        error: error.message,
        stack: error.stack,
        recoverable: false,
      },
    });
  }
};

// Setup worker configurations
function setupWorkerConfigurations(config) {
  // Configure TensorFlow.js for worker environment
  tf.env().set("WEBGL_MAX_TEXTURE_SIZE", 4096);
  tf.env().set("WEBGL_PACK", true);
  tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);

  // Set memory limits
  if (config.memoryLimitMB) {
    tensorMemoryTracker.maxMemoryUsage = config.memoryLimitMB * 1024 * 1024;
    tensorMemoryTracker.cleanupThreshold = Math.floor(
      tensorMemoryTracker.maxMemoryUsage * 0.8,
    );
  }
}
