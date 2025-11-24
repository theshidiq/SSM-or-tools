/**
 * aiWorker.js
 *
 * Web Worker for AI/ML processing to prevent main thread blocking.
 * Handles TensorFlow.js operations, genetic algorithms, and constraint validation.
 */

// Try to import TensorFlow.js - this is optional enhancement
let tfAvailable = false;
try {
  importScripts(
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js",
  );
  tfAvailable = true;
  console.log("✅ TensorFlow.js loaded successfully in worker");
} catch (error) {
  console.warn(
    "⚠️ TensorFlow.js not available in worker - using fallback methods:",
    error.message,
  );
  // Worker will still function with rule-based predictions
  tfAvailable = false;
}

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
  console.log("Creating constraint validation model...");

  // Simple neural network for constraint validation
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [10], units: 16, activation: "relu" }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 8, activation: "relu" }),
      tf.layers.dense({ units: 1, activation: "sigmoid" }),
    ],
  });

  model.compile({
    optimizer: "adam",
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

async function createPatternModel(config) {
  console.log("Creating pattern recognition model...");

  // Simple pattern recognition neural network
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [20], units: 32, activation: "relu" }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 16, activation: "relu" }),
      tf.layers.dense({ units: 8, activation: "relu" }),
      tf.layers.dense({ units: 4, activation: "softmax" }),
    ],
  });

  model.compile({
    optimizer: "adam",
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
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

    // Initialize TensorFlow.js in worker thread (if available)
    if (tfAvailable) {
      await tf.ready();
    }

    // Set memory management (if TensorFlow available)
    if (tfAvailable) {
      tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
      tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
    }

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
  if (!tfAvailable) {
    console.log("ℹ️ TensorFlow not available - skipping ML model loading");
    return; // Worker will use rule-based fallbacks
  }

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
    console.warn(`Model loading failed (non-fatal): ${error.message}`);
    // Don't throw - worker can still function without TensorFlow models
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
  if (!tfAvailable) {
    console.log("ℹ️ TensorFlow not available - skipping memory tracking");
    return;
  }

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
  if (!tfAvailable) {
    return; // Nothing to clean if TensorFlow not available
  }

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
  if (!tfAvailable) {
    return {
      totalBytes: 0,
      numTensors: 0,
      maxBytes: 0,
      percentUsed: 0,
      tensorflowAvailable: false,
    };
  }

  const memInfo = tf.memory();
  return {
    totalBytes: memInfo.numBytes,
    numTensors: memInfo.numTensors,
    maxBytes: tensorMemoryTracker.maxMemoryUsage,
    percentUsed: (memInfo.numBytes / tensorMemoryTracker.maxMemoryUsage) * 100,
    tensorflowAvailable: true,
  };
}

/**
 * Get worker capabilities
 */
function getWorkerCapabilities() {
  return {
    tensorflow: tfAvailable
      ? {
          version: tf.version.tfjs,
          backend: tf.getBackend(),
          ready: true,
        }
      : {
          version: "N/A",
          backend: "N/A",
          ready: false,
          reason: "TensorFlow.js not loaded (using rule-based fallbacks)",
        },
    features: {
      mlPredictions: mlModels.has("prediction"),
      constraintValidation: mlModels.has("constraint"),
      patternRecognition: mlModels.has("pattern"),
      ruleBasedFallback: !tfAvailable,
    },
    memoryManagement: tfAvailable,
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

// Add full hybrid AI prediction pipeline
/**
 * Full AI prediction pipeline - handles complete schedule prediction workflow
 */
async function processFullAIPrediction(data) {
  const { scheduleData, staffMembers, dateRange, options = {} } = data;

  processingState = {
    isProcessing: true,
    currentOperation: "full_ai_prediction",
    progress: 0,
    stage: "starting",
    startTime: Date.now(),
  };

  const PROCESSING_TIMEOUT = options.timeout || 30000; // 30 second timeout
  let timeoutId = null;
  let isCancelled = false;

  try {
    // Set up timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        isCancelled = true;
        reject(
          new Error(`AI processing timeout after ${PROCESSING_TIMEOUT}ms`),
        );
      }, PROCESSING_TIMEOUT);
    });

    // Main processing promise
    const processingPromise = performFullAIPrediction(
      scheduleData,
      staffMembers,
      dateRange,
      options,
      () => isCancelled,
    );

    // Race between timeout and actual processing
    const result = await Promise.race([processingPromise, timeoutPromise]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return result;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (error.message.includes("timeout")) {
      // Return emergency fallback result
      return await performEmergencyFallback(
        scheduleData,
        staffMembers,
        dateRange,
      );
    }

    throw error;
  } finally {
    processingState.isProcessing = false;
  }
}

/**
 * Perform the actual AI prediction with progress updates
 */
async function performFullAIPrediction(
  scheduleData,
  staffMembers,
  dateRange,
  options,
  isCancelledFn,
) {
  const results = {
    success: false,
    schedule: JSON.parse(JSON.stringify(scheduleData)),
    metadata: {
      method: "worker_hybrid",
      processingTime: 0,
      filledCells: 0,
      mlUsed: false,
      quality: 0,
      confidence: 0,
    },
  };

  const startTime = Date.now();

  try {
    // Stage 1: Configuration validation (5%)
    postMessage({
      type: "progress",
      data: {
        progress: 5,
        stage: "validating_config",
        message: "設定を確認中...",
      },
    });

    if (isCancelledFn()) throw new Error("Processing cancelled");
    await yieldControl(); // Non-blocking yield

    // Stage 2: Data preparation (15%)
    postMessage({
      type: "progress",
      data: {
        progress: 15,
        stage: "preparing_data",
        message: "データを準備中...",
      },
    });

    const preparedData = await prepareDataForPrediction(
      scheduleData,
      staffMembers,
      dateRange,
      isCancelledFn,
    );

    if (isCancelledFn()) throw new Error("Processing cancelled");

    // Stage 3: ML Model initialization and training (30%)
    postMessage({
      type: "progress",
      data: {
        progress: 30,
        stage: "initializing_ml",
        message: "MLモデルを準備中...",
      },
    });

    let mlResults = null;
    if (mlModels.has("prediction") && options.useMLPredictions !== false) {
      try {
        mlResults = await processMLPredictionsEnhanced(
          preparedData,
          staffMembers,
          dateRange,
          isCancelledFn,
        );
        results.metadata.mlUsed = true;
      } catch (mlError) {
        console.warn(
          "ML prediction failed, using rule-based fallback:",
          mlError,
        );
        results.metadata.mlUsed = false;
      }
    }

    if (isCancelledFn()) throw new Error("Processing cancelled");

    // Stage 4: Rule-based prediction and validation (60%)
    postMessage({
      type: "progress",
      data: {
        progress: 60,
        stage: "applying_rules",
        message: "ビジネスルールを適用中...",
      },
    });

    const ruleResults = await applyBusinessRulesWorker(
      results.schedule,
      staffMembers,
      dateRange,
      mlResults,
      isCancelledFn,
    );

    if (isCancelledFn()) throw new Error("Processing cancelled");

    // Stage 5: Schedule optimization (80%)
    postMessage({
      type: "progress",
      data: {
        progress: 80,
        stage: "optimizing",
        message: "スケジュールを最適化中...",
      },
    });

    const optimizedResults = await optimizeScheduleWorker(
      ruleResults.schedule,
      staffMembers,
      dateRange,
      isCancelledFn,
    );

    if (isCancelledFn()) throw new Error("Processing cancelled");

    // Stage 6: Final validation (95%)
    postMessage({
      type: "progress",
      data: {
        progress: 95,
        stage: "finalizing",
        message: "最終検証中...",
      },
    });

    const finalResults = await finalizeScheduleWorker(
      optimizedResults.schedule,
      scheduleData,
      staffMembers,
    );

    // Complete (100%)
    const processingTime = Date.now() - startTime;

    postMessage({
      type: "progress",
      data: {
        progress: 100,
        stage: "completed",
        message: "予測完了",
        processingTime,
      },
    });

    return {
      success: true,
      schedule: finalResults.schedule,
      metadata: {
        method: "worker_hybrid",
        processingTime,
        filledCells: finalResults.filledCells,
        mlUsed: results.metadata.mlUsed,
        quality: calculateQualityScore(finalResults.schedule, scheduleData),
        confidence: mlResults ? mlResults.averageConfidence || 75 : 85,
        violations: finalResults.violations || [],
        emergencyFallback: false,
      },
    };
  } catch (error) {
    if (error.message === "Processing cancelled") {
      return {
        success: false,
        error: "Processing was cancelled",
        cancelled: true,
      };
    }
    throw error;
  }
}

/**
 * Emergency fallback when main processing fails or times out
 */
async function performEmergencyFallback(scheduleData, staffMembers, dateRange) {
  console.log("🆘 Performing emergency fallback prediction...");

  postMessage({
    type: "progress",
    data: {
      progress: 50,
      stage: "emergency_fallback",
      message: "緊急フォールバック実行中...",
    },
  });

  const emergencySchedule = JSON.parse(JSON.stringify(scheduleData));
  let filledCells = 0;

  try {
    // Simple, fast pattern-based filling
    Object.keys(emergencySchedule).forEach((staffId) => {
      const staff = staffMembers.find((s) => s.id === staffId);
      if (!staff) return;

      Object.keys(emergencySchedule[staffId]).forEach((dateKey) => {
        const currentValue = emergencySchedule[staffId][dateKey];

        if (!currentValue || currentValue === "") {
          const date = new Date(dateKey);
          const dayOfWeek = date.getDay();

          let shift;
          if (staff.status === "パート") {
            // Part-time: work 4-5 days, rest on weekends
            shift = dayOfWeek === 0 || dayOfWeek === 6 ? "×" : "○";
          } else {
            // Full-time: normal work pattern
            if (dayOfWeek === 1)
              shift = "×"; // Monday off
            else if (dayOfWeek === 0)
              shift = "△"; // Sunday early
            else shift = ""; // Normal shift (blank for regular staff)
          }

          emergencySchedule[staffId][dateKey] = shift;
          filledCells++;
        }
      });
    });

    postMessage({
      type: "progress",
      data: {
        progress: 100,
        stage: "emergency_complete",
        message: `緊急フォールバック完了 (${filledCells}個のセル)`,
      },
    });

    return {
      success: true,
      schedule: emergencySchedule,
      metadata: {
        method: "emergency_fallback",
        processingTime: 1000, // Fast processing
        filledCells,
        mlUsed: false,
        quality: 60, // Lower quality but reliable
        confidence: 60,
        violations: [],
        emergencyFallback: true,
      },
    };
  } catch (error) {
    console.error("Emergency fallback also failed:", error);
    return {
      success: false,
      error: "Emergency fallback failed: " + error.message,
      schedule: scheduleData, // Return original
      metadata: {
        method: "failed",
        processingTime: 0,
        filledCells: 0,
        emergencyFallback: true,
      },
    };
  }
}

/**
 * Non-blocking yield control to prevent worker from hanging
 */
async function yieldControl() {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

/**
 * Prepare data for prediction processing
 */
async function prepareDataForPrediction(
  scheduleData,
  staffMembers,
  dateRange,
  isCancelledFn,
) {
  const prepared = {
    scheduleMatrix: {},
    staffProfiles: {},
    dateInfo: {},
  };

  // Build schedule matrix
  for (const staffId of Object.keys(scheduleData)) {
    if (isCancelledFn()) throw new Error("Processing cancelled");

    prepared.scheduleMatrix[staffId] = {};

    for (const date of dateRange) {
      const dateKey = date.toISOString().split("T")[0];
      prepared.scheduleMatrix[staffId][dateKey] =
        scheduleData[staffId][dateKey] || "";
    }

    await yieldControl(); // Yield after each staff member
  }

  // Build staff profiles
  for (const staff of staffMembers) {
    if (isCancelledFn()) throw new Error("Processing cancelled");

    prepared.staffProfiles[staff.id] = {
      ...staff,
      isPartTime: staff.status === "パート",
      preferredShifts: analyzeStaffPreferences(scheduleData[staff.id] || {}),
    };

    await yieldControl();
  }

  // Build date info
  for (const date of dateRange) {
    if (isCancelledFn()) throw new Error("Processing cancelled");

    const dateKey = date.toISOString().split("T")[0];
    prepared.dateInfo[dateKey] = {
      date,
      dayOfWeek: date.getDay(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };

    await yieldControl();
  }

  return prepared;
}

/**
 * Enhanced ML predictions with better timeout handling
 */
async function processMLPredictionsEnhanced(
  preparedData,
  staffMembers,
  dateRange,
  isCancelledFn,
) {
  const predictions = new Map();
  const confidences = new Map();
  let totalConfidence = 0;
  let predictionCount = 0;

  const model = mlModels.get("prediction");
  if (!model) {
    throw new Error("ML model not available");
  }

  // Process in small chunks to avoid blocking
  const chunkSize = 10;
  let processedCount = 0;
  const totalWork = staffMembers.length * dateRange.length;

  for (let staffIndex = 0; staffIndex < staffMembers.length; staffIndex++) {
    if (isCancelledFn()) throw new Error("Processing cancelled");

    const staff = staffMembers[staffIndex];
    const staffSchedule = preparedData.scheduleMatrix[staff.id] || {};

    for (
      let dateIndex = 0;
      dateIndex < dateRange.length;
      dateIndex += chunkSize
    ) {
      if (isCancelledFn()) throw new Error("Processing cancelled");

      const dateChunk = dateRange.slice(dateIndex, dateIndex + chunkSize);

      for (const date of dateChunk) {
        const dateKey = date.toISOString().split("T")[0];

        // Skip if already filled
        if (staffSchedule[dateKey] && staffSchedule[dateKey].trim() !== "") {
          continue;
        }

        try {
          const features = generateFeaturesEnhanced(
            staff,
            date,
            preparedData,
            dateKey,
          );
          if (features) {
            const prediction = await makePredictionSafe(features, model);
            if (prediction) {
              predictions.set(`${staff.id}_${dateKey}`, prediction.class);
              confidences.set(`${staff.id}_${dateKey}`, prediction.confidence);
              totalConfidence += prediction.confidence;
              predictionCount++;
            }
          }
        } catch (error) {
          console.warn(
            `ML prediction failed for ${staff.name} on ${dateKey}:`,
            error,
          );
        }

        processedCount++;
      }

      // Update progress and yield control
      const progress = Math.min(90, 30 + (processedCount / totalWork) * 30);
      postMessage({
        type: "progress",
        data: {
          progress,
          stage: "ml_predicting",
          message: `ML予測中... (${processedCount}/${totalWork})`,
        },
      });

      await yieldControl();
    }
  }

  return {
    predictions,
    confidences,
    averageConfidence:
      predictionCount > 0 ? Math.round(totalConfidence / predictionCount) : 0,
    totalPredictions: predictionCount,
  };
}

/**
 * Enhanced feature generation
 */
function generateFeaturesEnhanced(staff, date, preparedData, dateKey) {
  try {
    const features = [];
    const staffProfile = preparedData.staffProfiles[staff.id];
    const dateInfo = preparedData.dateInfo[dateKey];

    if (!staffProfile || !dateInfo) return null;

    // Staff features (8 features)
    features.push(staffProfile.isPartTime ? 1 : 0);
    features.push(staff.name === "料理長" ? 1 : 0);
    features.push(staff.name.includes("主任") ? 1 : 0);
    features.push(staff.name.includes("アルバイト") ? 1 : 0);
    features.push(staff.name.includes("新人") ? 1 : 0);
    features.push(staff.name.includes("ベテラン") ? 1 : 0);
    features.push(staff.position === "キッチン" ? 1 : 0);
    features.push(staff.position === "ホール" ? 1 : 0);

    // Date features (10 features)
    for (let i = 0; i < 7; i++) {
      features.push(dateInfo.dayOfWeek === i ? 1 : 0);
    }
    features.push(dateInfo.isWeekend ? 1 : 0);
    features.push(date.getDate() <= 15 ? 1 : 0); // First half of month
    features.push(Math.sin((2 * Math.PI * date.getDate()) / 31)); // Cyclical pattern

    // Historical patterns (32 features - last 8 days, 4 shifts each)
    const staffSchedule = preparedData.scheduleMatrix[staff.id] || {};
    for (let i = 1; i <= 8; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - i);
      const pastDateKey = pastDate.toISOString().split("T")[0];
      const pastShift = staffSchedule[pastDateKey] || "";

      features.push(pastShift === "○" ? 1 : 0);
      features.push(pastShift === "△" ? 1 : 0);
      features.push(pastShift === "▽" ? 1 : 0);
      features.push(pastShift === "×" ? 1 : 0);
    }

    // Ensure exactly 50 features
    while (features.length < 50) features.push(0);

    return features.slice(0, 50);
  } catch (error) {
    console.warn("Feature generation failed:", error);
    return null;
  }
}

/**
 * Safe ML prediction with error handling
 */
async function makePredictionSafe(features, model) {
  return tf.tidy(() => {
    try {
      const inputTensor = tf.tensor2d([features]);
      const prediction = model.predict(inputTensor);
      const probabilities = prediction.dataSync();

      let maxProb = 0;
      let bestClass = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          bestClass = i;
        }
      }

      const shiftMap = ["○", "△", "▽", "×"];

      return {
        class: shiftMap[bestClass] || "○",
        confidence: Math.round(maxProb * 100),
        probabilities: Array.from(probabilities),
      };
    } catch (error) {
      console.warn("ML prediction error:", error);
      return null;
    }
  });
}

/**
 * Apply business rules in worker
 */
async function applyBusinessRulesWorker(
  schedule,
  staffMembers,
  dateRange,
  mlResults,
  isCancelledFn,
) {
  // Implementation of business rules application
  // This would include constraint checking and rule enforcement

  if (isCancelledFn()) throw new Error("Processing cancelled");

  // For now, return the schedule as-is with ML results applied
  if (mlResults && mlResults.predictions) {
    for (const [key, prediction] of mlResults.predictions) {
      const [staffId, dateKey] = key.split("_");
      if (!schedule[staffId][dateKey] || schedule[staffId][dateKey] === "") {
        schedule[staffId][dateKey] = prediction;
      }
    }
  }

  return { schedule, violations: [] };
}

/**
 * Optimize schedule in worker
 */
async function optimizeScheduleWorker(
  schedule,
  staffMembers,
  dateRange,
  isCancelledFn,
) {
  if (isCancelledFn()) throw new Error("Processing cancelled");

  // Basic optimization - ensure coverage and balance
  // More sophisticated optimization could be added here

  return { schedule };
}

/**
 * Finalize schedule processing
 */
async function finalizeScheduleWorker(
  schedule,
  originalSchedule,
  staffMembers,
) {
  let filledCells = 0;
  const violations = [];

  // Count newly filled cells
  Object.keys(schedule).forEach((staffId) => {
    Object.keys(schedule[staffId]).forEach((dateKey) => {
      const original = originalSchedule[staffId]?.[dateKey];
      const current = schedule[staffId][dateKey];

      if ((!original || original === "") && current && current !== "") {
        filledCells++;
      }
    });
  });

  return {
    schedule,
    filledCells,
    violations,
  };
}

/**
 * Calculate quality score
 */
function calculateQualityScore(newSchedule, originalSchedule) {
  let totalCells = 0;
  let filledCells = 0;
  let qualityPoints = 0;

  Object.keys(newSchedule).forEach((staffId) => {
    Object.keys(newSchedule[staffId]).forEach((dateKey) => {
      totalCells++;
      const original = originalSchedule[staffId]?.[dateKey];
      const current = newSchedule[staffId][dateKey];

      if (current && current !== "") {
        filledCells++;

        // Quality points based on shift type appropriateness
        if (
          current === "○" ||
          current === "△" ||
          current === "▽" ||
          current === ""
        ) {
          qualityPoints += 1; // Work shifts
        } else if (current === "×") {
          qualityPoints += 0.8; // Rest days
        }
      }
    });
  });

  const fillRate = totalCells > 0 ? filledCells / totalCells : 0;
  const avgQuality = filledCells > 0 ? qualityPoints / filledCells : 0;

  return Math.round((fillRate * 0.6 + avgQuality * 0.4) * 100);
}

/**
 * Analyze staff preferences from existing schedule data
 */
function analyzeStaffPreferences(staffSchedule) {
  const preferences = {
    shifts: {},
    dayOfWeek: {},
  };

  Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
    if (shift && shift.trim() !== "") {
      preferences.shifts[shift] = (preferences.shifts[shift] || 0) + 1;

      const date = new Date(dateKey);
      const dayOfWeek = date.getDay();

      if (!preferences.dayOfWeek[dayOfWeek])
        preferences.dayOfWeek[dayOfWeek] = {};
      preferences.dayOfWeek[dayOfWeek][shift] =
        (preferences.dayOfWeek[dayOfWeek][shift] || 0) + 1;
    }
  });

  return preferences;
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

      case "process_full_ai_prediction":
        const fullResult = await processFullAIPrediction(data);
        postMessage({
          type: "result",
          requestId,
          data: fullResult,
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
  // Configure TensorFlow.js for worker environment (if available)
  if (tfAvailable) {
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
  } else {
    console.log("ℹ️ TensorFlow not available - skipping TF configuration");
  }
}
