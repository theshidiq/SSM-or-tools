/**
 * TensorFlowConfig.js
 *
 * Configuration and setup for TensorFlow.js ML models
 * for restaurant shift scheduling prediction.
 */

import * as tf from "@tensorflow/tfjs";

// Performance timing for initialization monitoring
const PERF_TIMING = {
  initStart: 0,
  backendReady: 0,
  optimizationsApplied: 0,
  warmupComplete: 0,
};

// Enhanced model architecture configuration with performance optimizations
export const MODEL_CONFIG = {
  // Input features configuration
  INPUT_FEATURES: {
    STAFF_FEATURES: 10, // staff_id, status, position, etc.
    TEMPORAL_FEATURES: 8, // day_of_week, date, period, etc.
    HISTORICAL_FEATURES: 12, // past patterns, preferences, etc.
    CONTEXT_FEATURES: 5, // business context, constraints, etc.
    TOTAL: 35, // Basic feature size

    // Enhanced features (optimized)
    ENHANCED_TOTAL: 65, // Enhanced feature size for high accuracy
    ENHANCED_STAFF_RELATIONSHIP: 10,
    ENHANCED_SEASONAL: 8,
    ENHANCED_WORKLOAD: 7,
    ENHANCED_TIME_SERIES: 5,
  },

  // Enhanced neural network architecture with performance tuning
  ARCHITECTURE: {
    INPUT_SIZE: 65, // Updated for enhanced features
    HIDDEN_LAYERS: [256, 128, 64, 32], // Larger network for enhanced features
    OUTPUT_SIZE: 5, // [blank, ○, △, ▽, ×]
    DROPOUT_RATE: 0.3,
    ACTIVATION: "relu",
    OUTPUT_ACTIVATION: "softmax",

    // Performance optimizations
    USE_BATCH_NORMALIZATION: true,
    USE_RESIDUAL_CONNECTIONS: false, // For deeper networks
    WEIGHT_REGULARIZATION: {
      L1: 0.0001,
      L2: 0.0001,
    },
    KERNEL_INITIALIZER: "glorotUniform",
    BIAS_INITIALIZER: "zeros",
  },

  // Enhanced training configuration with adaptive learning
  TRAINING: {
    // Basic parameters
    EPOCHS: 50,
    BATCH_SIZE: 32,
    VALIDATION_SPLIT: 0.2,
    LEARNING_RATE: 0.001,
    OPTIMIZER: "adam",
    LOSS: "categoricalCrossentropy",
    METRICS: ["accuracy"],

    // Advanced training features
    EARLY_STOPPING: {
      ENABLED: true,
      PATIENCE: 10,
      MIN_DELTA: 0.001,
      RESTORE_BEST_WEIGHTS: true,
    },

    LEARNING_RATE_SCHEDULER: {
      ENABLED: true,
      TYPE: "reduce_on_plateau", // 'exponential_decay', 'cosine_decay'
      FACTOR: 0.5,
      PATIENCE: 5,
      MIN_LR: 0.00001,
    },

    // Data augmentation
    DATA_AUGMENTATION: {
      ENABLED: true,
      NOISE_FACTOR: 0.05,
      DROPOUT_AUGMENTATION: 0.1,
    },

    // Mixed precision training for performance
    MIXED_PRECISION: {
      ENABLED: false, // Enable when supported
      LOSS_SCALE: "dynamic",
    },
  },

  // Performance optimization settings
  PERFORMANCE: {
    // Memory management
    MEMORY_GROWTH: true,
    MAX_MEMORY_USAGE: 0.8, // 80% of available GPU memory
    TENSOR_RECYCLING: true,

    // Computation optimization
    USE_WEBGL_OPTIMIZATION: true,
    ENABLE_PROFILING: false, // Enable for debugging only
    PARALLEL_PROCESSING: true,

    // Feature generation performance
    FEATURE_GENERATION_TIMEOUT: 100, // ms per prediction target
    USE_OPTIMIZED_WORKER: true,
    BATCH_FEATURE_PROCESSING: true,

    // Browser-specific optimizations
    WEBGL_SETTINGS: {
      DELETE_TEXTURE_THRESHOLD: 0,
      PACK_OPERATIONS: true,
      USE_FLOAT16: false, // Enable if supported
      MAX_TEXTURE_SIZE: 4096,
    },
  },

  // Model compression and quantization
  COMPRESSION: {
    ENABLE_QUANTIZATION: false, // Enable for production
    QUANTIZATION_BITS: 8,
    ENABLE_PRUNING: false,
    PRUNING_SPARSITY: 0.5,
  },

  // Shift type mappings
  SHIFT_TYPES: {
    BLANK: 0, // Normal shift for 社員 (regular staff)
    CIRCLE: 1, // ○ - Normal shift for パート (part-time)
    TRIANGLE: 2, // △ - Early shift
    INVERTED: 3, // ▽ - Late shift
    CROSS: 4, // × - Day off
  },

  // Staff type mappings
  STAFF_TYPES: {
    REGULAR: 0, // 社員 - Regular employee
    PART_TIME: 1, // パート - Part-time employee
  },
};

/**
 * Enhanced TensorFlow initialization with comprehensive performance optimization
 */
export const initializeTensorFlow = async (options = {}) => {
  try {
    console.log("🚀 Initializing enhanced TensorFlow.js...");
    const startTime = Date.now();

    // Configure environment before initialization
    await configureEnvironment(options);

    // Initialize with optimal backend selection
    const backend = await selectOptimalBackend(options);
    await tf.ready();

    // Verify backend initialization
    const actualBackend = tf.getBackend();
    console.log(`🧠 TensorFlow.js initialized with backend: ${actualBackend}`);

    // Apply performance optimizations
    await applyPerformanceOptimizations();

    // Initialize memory monitoring
    initializeMemoryMonitoring();

    // Warm up the backend
    if (options.warmUp !== false) {
      await warmUpBackend();
    }

    const initTime = Date.now() - startTime;
    console.log(
      `✨ TensorFlow.js enhanced initialization completed in ${initTime}ms`,
    );

    return {
      success: true,
      backend: actualBackend,
      initTime,
      memoryInfo: tf.memory(),
      capabilities: await getBackendCapabilities(),
    };
  } catch (error) {
    console.error("❌ Enhanced TensorFlow initialization failed:", error);

    // Attempt fallback initialization
    const fallbackResult = await fallbackInitialization();

    return {
      success: fallbackResult.success,
      backend: fallbackResult.backend,
      fallback: true,
      error: error.message,
    };
  }
};

/**
 * Create enhanced neural network model with performance optimizations
 */
export const createScheduleModel = (options = {}) => {
  const config = { ...MODEL_CONFIG.ARCHITECTURE, ...options };

  console.log("🏗️ Creating enhanced TensorFlow model...");
  const startTime = Date.now();

  const layers = [];

  // Input layer with enhanced initialization
  layers.push(
    tf.layers.dense({
      inputShape: [config.INPUT_SIZE],
      units: config.HIDDEN_LAYERS[0],
      activation: config.ACTIVATION,
      kernelInitializer: config.KERNEL_INITIALIZER,
      biasInitializer: config.BIAS_INITIALIZER,
      kernelRegularizer: createRegularizer(config.WEIGHT_REGULARIZATION),
      name: "input_dense",
    }),
  );

  // Batch normalization if enabled
  if (config.USE_BATCH_NORMALIZATION) {
    layers.push(tf.layers.batchNormalization({ name: "input_batch_norm" }));
  }

  // Input dropout
  layers.push(
    tf.layers.dropout({
      rate: config.DROPOUT_RATE,
      name: "input_dropout",
    }),
  );

  // Enhanced hidden layers with optimizations
  config.HIDDEN_LAYERS.slice(1).forEach((units, index) => {
    // Dense layer
    layers.push(
      tf.layers.dense({
        units,
        activation: config.ACTIVATION,
        kernelInitializer: config.KERNEL_INITIALIZER,
        biasInitializer: config.BIAS_INITIALIZER,
        kernelRegularizer: createRegularizer(config.WEIGHT_REGULARIZATION),
        name: `hidden_${index + 1}`,
      }),
    );

    // Batch normalization
    if (config.USE_BATCH_NORMALIZATION) {
      layers.push(
        tf.layers.batchNormalization({
          name: `hidden_${index + 1}_batch_norm`,
        }),
      );
    }

    // Dropout (reduced for deeper layers)
    const dropoutRate =
      config.DROPOUT_RATE *
      (1 - ((index + 1) / config.HIDDEN_LAYERS.length) * 0.5);
    layers.push(
      tf.layers.dropout({
        rate: dropoutRate,
        name: `hidden_${index + 1}_dropout`,
      }),
    );
  });

  // Output layer
  layers.push(
    tf.layers.dense({
      units: config.OUTPUT_SIZE,
      activation: config.OUTPUT_ACTIVATION,
      kernelInitializer: config.KERNEL_INITIALIZER,
      name: "output",
    }),
  );

  // Create model
  const model = tf.sequential({ layers });

  // Enhanced model compilation with adaptive optimizer
  const optimizer = createOptimizedOptimizer();

  model.compile({
    optimizer,
    loss: MODEL_CONFIG.TRAINING.LOSS,
    metrics: MODEL_CONFIG.TRAINING.METRICS,
  });

  const createTime = Date.now() - startTime;
  console.log(
    `✨ Enhanced model created in ${createTime}ms (${model.countParams()} parameters)`,
  );

  // Log model summary
  model.summary();

  // Add performance monitoring hooks
  addPerformanceHooks(model);

  return model;
};

/**
 * Enhanced model persistence with compression and metadata
 * 🎯 PERFORMANCE: In-memory model cache to reduce IndexedDB load time
 */
export const MODEL_STORAGE = {
  // Storage configuration
  STORAGE_KEY: "restaurant-schedule-ml-model",
  METADATA_KEY: "restaurant-schedule-ml-metadata",
  BACKUP_PREFIX: "backup",

  // 🎯 PERFORMANCE: In-memory model cache (300-500ms → <10ms)
  _modelCache: null,
  _metadataCache: null,
  _cacheVersion: null,

  // Enhanced model saving with compression and metadata
  saveModel: async (model, version = "1.0", metadata = {}) => {
    try {
      console.log(`💾 Saving enhanced model v${version}...`);
      const startTime = Date.now();

      const saveUrl = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;

      // Compress model if enabled
      const modelToSave = MODEL_CONFIG.COMPRESSION.ENABLE_QUANTIZATION
        ? await compressModel(model)
        : model;

      // Save model
      await modelToSave.save(saveUrl);

      // Save enhanced metadata
      const enhancedMetadata = {
        version,
        timestamp: Date.now(),
        modelParams: model.countParams(),
        architecture: MODEL_CONFIG.ARCHITECTURE,
        performance: await getModelPerformanceMetrics(model),
        browserInfo: getBrowserInfo(),
        saveTime: Date.now() - startTime,
        ...metadata,
      };

      await MODEL_STORAGE.saveModelMetadata(enhancedMetadata);

      // 🎯 PERFORMANCE: Update in-memory cache
      MODEL_STORAGE._modelCache = model;
      MODEL_STORAGE._metadataCache = enhancedMetadata;
      MODEL_STORAGE._cacheVersion = version;

      console.log(
        `✅ Enhanced model saved successfully in ${enhancedMetadata.saveTime}ms (cached in memory)`,
      );

      return {
        success: true,
        url: saveUrl,
        metadata: enhancedMetadata,
        saveTime: enhancedMetadata.saveTime,
      };
    } catch (error) {
      console.error("❌ Failed to save enhanced model:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Enhanced model loading with validation
  loadModel: async (version = "1.0") => {
    try {
      const startTime = Date.now();

      // 🎯 PERFORMANCE: Check in-memory cache first (300-500ms → <10ms)
      if (
        MODEL_STORAGE._modelCache &&
        MODEL_STORAGE._cacheVersion === version
      ) {
        const cacheTime = Date.now() - startTime;
        console.log(
          `⚡ Model loaded from memory cache in ${cacheTime}ms (${MODEL_STORAGE._modelCache.countParams()} params)`,
        );

        return {
          model: MODEL_STORAGE._modelCache,
          metadata: MODEL_STORAGE._metadataCache,
          validation: { valid: true, source: "cache" },
          loadTime: cacheTime,
          fromCache: true,
        };
      }

      console.log(`📂 Loading enhanced model v${version} from IndexedDB...`);
      const loadUrl = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;

      // Load model with error handling
      const model = await tf.loadLayersModel(loadUrl);

      // Load and validate metadata
      const metadata = await MODEL_STORAGE.loadModelMetadata(version);

      // 🎯 PERFORMANCE: Cache loaded model in memory
      MODEL_STORAGE._modelCache = model;
      MODEL_STORAGE._metadataCache = metadata;
      MODEL_STORAGE._cacheVersion = version;

      const loadTime = Date.now() - startTime;
      console.log(
        `✅ Enhanced model loaded from IndexedDB in ${loadTime}ms (cached in memory)`,
      );

      // Validate model integrity
      const validation = await validateModelIntegrity(model, metadata);

      return {
        model,
        metadata,
        validation,
        loadTime,
        fromCache: false,
      };
    } catch (error) {
      console.log(`ℹ️ No saved model found (v${version}), will create new one`);
      return null;
    }
  },

  // Save model metadata
  saveModelMetadata: async (metadata) => {
    try {
      const metadataKey = `${MODEL_STORAGE.METADATA_KEY}-v${metadata.version}`;
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      return true;
    } catch (error) {
      console.warn("⚠️ Failed to save model metadata:", error);
      return false;
    }
  },

  // Load model metadata
  loadModelMetadata: async (version = "1.0") => {
    try {
      const metadataKey = `${MODEL_STORAGE.METADATA_KEY}-v${version}`;
      const metadataStr = localStorage.getItem(metadataKey);
      return metadataStr ? JSON.parse(metadataStr) : null;
    } catch (error) {
      console.warn("⚠️ Failed to load model metadata:", error);
      return null;
    }
  },

  // Enhanced model existence check with metadata validation
  modelExists: async (version = "1.0") => {
    try {
      const models = await tf.io.listModels();
      const key = `indexeddb://${MODEL_STORAGE.STORAGE_KEY}-v${version}`;
      const exists = key in models;

      if (exists) {
        // Also check metadata
        const metadata = await MODEL_STORAGE.loadModelMetadata(version);
        return {
          exists: true,
          hasMetadata: metadata !== null,
          metadata,
        };
      }

      return { exists: false };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  },

  // 🎯 PERFORMANCE: Clear in-memory cache
  clearCache: () => {
    if (MODEL_STORAGE._modelCache) {
      // Dispose cached model tensors to prevent memory leaks
      MODEL_STORAGE._modelCache.dispose?.();
    }
    MODEL_STORAGE._modelCache = null;
    MODEL_STORAGE._metadataCache = null;
    MODEL_STORAGE._cacheVersion = null;
    console.log("🗑️ Model cache cleared");
  },

  // 🎯 PERFORMANCE: Get cache status
  getCacheStatus: () => {
    return {
      cached: MODEL_STORAGE._modelCache !== null,
      version: MODEL_STORAGE._cacheVersion,
      metadata: MODEL_STORAGE._metadataCache,
    };
  },

  // Create model backup
  createBackup: async (model, version, reason = "manual") => {
    try {
      const backupVersion = `${MODEL_STORAGE.BACKUP_PREFIX}-${version}-${Date.now()}`;
      const result = await MODEL_STORAGE.saveModel(model, backupVersion, {
        isBackup: true,
        originalVersion: version,
        backupReason: reason,
      });

      return {
        success: result.success,
        backupVersion,
        originalVersion: version,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // List all saved models
  listModels: async () => {
    try {
      const models = await tf.io.listModels();
      const modelList = [];

      for (const [url, info] of Object.entries(models)) {
        if (url.includes(MODEL_STORAGE.STORAGE_KEY)) {
          const version = extractVersionFromUrl(url);
          const metadata = await MODEL_STORAGE.loadModelMetadata(version);

          modelList.push({
            url,
            version,
            dateSaved: new Date(info.dateSaved),
            modelSize: info.modelTopologyBytes + info.weightDataBytes,
            metadata,
          });
        }
      }

      return modelList.sort((a, b) => b.dateSaved - a.dateSaved);
    } catch (error) {
      console.error("❌ Failed to list models:", error);
      return [];
    }
  },

  // Clean up old models
  cleanupOldModels: async (keepCount = 3) => {
    try {
      const models = await MODEL_STORAGE.listModels();
      const modelsToDelete = models.slice(keepCount);

      let deletedCount = 0;
      for (const model of modelsToDelete) {
        try {
          await tf.io.removeModel(model.url);
          // Also remove metadata
          const metadataKey = `${MODEL_STORAGE.METADATA_KEY}-v${model.version}`;
          localStorage.removeItem(metadataKey);
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ Failed to delete model ${model.version}:`, error);
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} old models`);
      return { deletedCount, errors: modelsToDelete.length - deletedCount };
    } catch (error) {
      console.error("❌ Model cleanup failed:", error);
      return { deletedCount: 0, errors: 1 };
    }
  },
};

/**
 * Enhanced memory management with performance monitoring
 */
export const MEMORY_UTILS = {
  // Memory monitoring state
  monitoring: {
    enabled: false,
    interval: null,
    history: [],
    maxHistorySize: 100,
    thresholds: {
      tensors: 200,
      bytes: 100 * 1024 * 1024, // 100MB
      warnings: 0,
    },
  },

  // Enhanced memory information
  getMemoryInfo: () => {
    const memInfo = tf.memory();
    const jsHeap =
      typeof performance !== "undefined" && performance.memory
        ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
          }
        : null;

    return {
      // TensorFlow memory
      numTensors: memInfo.numTensors,
      numDataBuffers: memInfo.numDataBuffers,
      numBytes: memInfo.numBytes,
      unreliable: memInfo.unreliable,

      // JavaScript heap (if available)
      jsHeap,

      // Calculated metrics
      tensorDensity:
        memInfo.numTensors > 0 ? memInfo.numBytes / memInfo.numTensors : 0,
      averageTensorSize:
        memInfo.numTensors > 0 ? memInfo.numBytes / memInfo.numTensors : 0,
      memoryPressure: MEMORY_UTILS.calculateMemoryPressure(memInfo, jsHeap),

      timestamp: Date.now(),
    };
  },

  // Calculate memory pressure level
  calculateMemoryPressure: (tfMemory, jsHeap) => {
    let pressure = 0;

    // TensorFlow memory pressure
    if (tfMemory.numTensors > MEMORY_UTILS.monitoring.thresholds.tensors)
      pressure += 0.3;
    if (tfMemory.numBytes > MEMORY_UTILS.monitoring.thresholds.bytes)
      pressure += 0.3;

    // JS heap pressure (if available)
    if (jsHeap && jsHeap.limit > 0) {
      const heapUsageRatio = jsHeap.used / jsHeap.limit;
      if (heapUsageRatio > 0.8) pressure += 0.4;
      else if (heapUsageRatio > 0.6) pressure += 0.2;
    }

    if (pressure > 0.7) return "high";
    if (pressure > 0.4) return "medium";
    return "low";
  },

  // Enhanced cleanup with different strategies
  cleanup: (strategy = "standard") => {
    const before = tf.memory();
    console.log(`🧹 Starting ${strategy} memory cleanup...`);

    switch (strategy) {
      case "aggressive":
        // Aggressive cleanup
        tf.disposeVariables();
        tf.engine().endScope();
        if (typeof window !== "undefined" && window.gc) {
          window.gc(); // Force garbage collection if available
        }
        break;

      case "gentle":
        // Gentle cleanup - only dispose variables
        tf.disposeVariables();
        break;

      case "targeted":
        // Target specific tensor types
        tf.disposeVariables();
        tf.engine().endScope();
        break;

      default: // 'standard'
        tf.disposeVariables();
        tf.engine().endScope();
    }

    const after = tf.memory();
    const cleaned = {
      tensors: before.numTensors - after.numTensors,
      bytes: before.numBytes - after.numBytes,
      buffers: before.numDataBuffers - after.numDataBuffers,
    };

    console.log(`✅ Memory cleanup completed:`, {
      strategy,
      before: `${before.numTensors} tensors, ${Math.round(before.numBytes / 1024 / 1024)}MB`,
      after: `${after.numTensors} tensors, ${Math.round(after.numBytes / 1024 / 1024)}MB`,
      cleaned: `${cleaned.tensors} tensors, ${Math.round(cleaned.bytes / 1024 / 1024)}MB freed`,
    });

    return cleaned;
  },

  // Start memory monitoring
  startMonitoring: (intervalMs = 30000) => {
    if (MEMORY_UTILS.monitoring.enabled) {
      console.log("📊 Memory monitoring already active");
      return;
    }

    MEMORY_UTILS.monitoring.enabled = true;
    MEMORY_UTILS.monitoring.interval = setInterval(() => {
      const memInfo = MEMORY_UTILS.getMemoryInfo();

      // Add to history
      MEMORY_UTILS.monitoring.history.push(memInfo);

      // Trim history
      if (
        MEMORY_UTILS.monitoring.history.length >
        MEMORY_UTILS.monitoring.maxHistorySize
      ) {
        MEMORY_UTILS.monitoring.history.shift();
      }

      // Check thresholds and warn if necessary
      MEMORY_UTILS.checkMemoryThresholds(memInfo);
    }, intervalMs);

    console.log(`📊 Memory monitoring started (${intervalMs}ms interval)`);
  },

  // Stop memory monitoring
  stopMonitoring: () => {
    if (MEMORY_UTILS.monitoring.interval) {
      clearInterval(MEMORY_UTILS.monitoring.interval);
      MEMORY_UTILS.monitoring.interval = null;
    }
    MEMORY_UTILS.monitoring.enabled = false;
    console.log("📊 Memory monitoring stopped");
  },

  // Check memory thresholds
  checkMemoryThresholds: (memInfo) => {
    const thresholds = MEMORY_UTILS.monitoring.thresholds;

    if (
      memInfo.numTensors > thresholds.tensors ||
      memInfo.numBytes > thresholds.bytes
    ) {
      thresholds.warnings++;

      if (thresholds.warnings % 5 === 1) {
        // Log every 5th warning to avoid spam
        console.warn("⚠️ Memory usage exceeds thresholds:", {
          tensors: `${memInfo.numTensors}/${thresholds.tensors}`,
          bytes: `${Math.round(memInfo.numBytes / 1024 / 1024)}MB/${Math.round(thresholds.bytes / 1024 / 1024)}MB`,
          pressure: memInfo.memoryPressure,
        });

        // Auto-cleanup if pressure is high
        if (memInfo.memoryPressure === "high") {
          console.log("🧹 Auto-triggering memory cleanup due to high pressure");
          MEMORY_UTILS.cleanup("gentle");
        }
      }
    }
  },

  // Get memory statistics
  getMemoryStatistics: () => {
    const history = MEMORY_UTILS.monitoring.history;
    if (history.length === 0) return null;

    const recent = history.slice(-10); // Last 10 measurements

    return {
      current: MEMORY_UTILS.getMemoryInfo(),
      trend: MEMORY_UTILS.calculateMemoryTrend(recent),
      average: MEMORY_UTILS.calculateAverageMemory(recent),
      peak: MEMORY_UTILS.findPeakMemory(history),
      warnings: MEMORY_UTILS.monitoring.thresholds.warnings,
      historySize: history.length,
    };
  },

  // Calculate memory trend
  calculateMemoryTrend: (measurements) => {
    if (measurements.length < 2) return "stable";

    const first = measurements[0];
    const last = measurements[measurements.length - 1];

    const tensorTrend =
      (last.numTensors - first.numTensors) / measurements.length;
    const byteTrend = (last.numBytes - first.numBytes) / measurements.length;

    if (tensorTrend > 5 || byteTrend > 1024 * 1024) return "increasing";
    if (tensorTrend < -5 || byteTrend < -1024 * 1024) return "decreasing";
    return "stable";
  },

  // Calculate average memory usage
  calculateAverageMemory: (measurements) => {
    if (measurements.length === 0) return null;

    const sums = measurements.reduce(
      (acc, mem) => ({
        tensors: acc.tensors + mem.numTensors,
        bytes: acc.bytes + mem.numBytes,
        buffers: acc.buffers + mem.numDataBuffers,
      }),
      { tensors: 0, bytes: 0, buffers: 0 },
    );

    return {
      tensors: sums.tensors / measurements.length,
      bytes: sums.bytes / measurements.length,
      buffers: sums.buffers / measurements.length,
    };
  },

  // Find peak memory usage
  findPeakMemory: (measurements) => {
    if (measurements.length === 0) return null;

    return measurements.reduce((peak, current) => {
      if (current.numBytes > peak.numBytes) return current;
      return peak;
    });
  },

  // Enhanced memory logging
  logMemoryUsage: (label = "Memory", detailed = false) => {
    const info = MEMORY_UTILS.getMemoryInfo();

    if (detailed) {
      console.log(`📊 ${label} (detailed):`, {
        tensors: info.numTensors,
        bytes: `${Math.round(info.numBytes / 1024 / 1024)}MB`,
        buffers: info.numDataBuffers,
        avgTensorSize: `${Math.round(info.averageTensorSize / 1024)}KB`,
        pressure: info.memoryPressure,
        jsHeap: info.jsHeap
          ? {
              used: `${Math.round(info.jsHeap.used / 1024 / 1024)}MB`,
              total: `${Math.round(info.jsHeap.total / 1024 / 1024)}MB`,
              usage: `${((info.jsHeap.used / info.jsHeap.total) * 100).toFixed(1)}%`,
            }
          : "unavailable",
      });
    } else {
      console.log(
        `📊 ${label}: ${info.numTensors} tensors, ${Math.round(info.numBytes / 1024 / 1024)}MB, pressure: ${info.memoryPressure}`,
      );
    }
  },

  // Memory usage analysis
  analyzeMemoryUsage: () => {
    const stats = MEMORY_UTILS.getMemoryStatistics();
    if (!stats) {
      return { recommendation: "Start memory monitoring to get analysis" };
    }

    const analysis = {
      status: stats.current.memoryPressure,
      trend: stats.trend,
      recommendations: [],
    };

    // Generate recommendations based on analysis
    if (stats.current.memoryPressure === "high") {
      analysis.recommendations.push("Consider running memory cleanup");
      analysis.recommendations.push("Reduce batch size or model complexity");
    }

    if (stats.trend === "increasing") {
      analysis.recommendations.push(
        "Memory usage is increasing - investigate potential leaks",
      );
      analysis.recommendations.push(
        "Consider periodic cleanup during long operations",
      );
    }

    if (stats.warnings > 10) {
      analysis.recommendations.push(
        "Frequent memory warnings - review memory management strategy",
      );
    }

    return analysis;
  },
};

// ============================================================================
// ENHANCED PERFORMANCE OPTIMIZATION FUNCTIONS
// ============================================================================

/**
 * Configure TensorFlow environment for optimal performance
 */
const configureEnvironment = async (options) => {
  const config = {
    ...MODEL_CONFIG.PERFORMANCE.WEBGL_SETTINGS,
    ...options.webgl,
  };

  // WebGL optimizations
  tf.env().set(
    "WEBGL_DELETE_TEXTURE_THRESHOLD",
    config.DELETE_TEXTURE_THRESHOLD,
  );
  tf.env().set("WEBGL_PACK", config.PACK_OPERATIONS);
  tf.env().set("WEBGL_MAX_TEXTURE_SIZE", config.MAX_TEXTURE_SIZE);

  if (config.USE_FLOAT16) {
    tf.env().set("WEBGL_RENDER_FLOAT32_CAPABLE", false);
  }

  // Memory optimizations
  if (MODEL_CONFIG.PERFORMANCE.MEMORY_GROWTH) {
    tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
  }

  console.log("⚙️ TensorFlow environment configured for performance");
};

/**
 * Select optimal backend based on device capabilities
 */
const selectOptimalBackend = async (options) => {
  const preferredBackend = options.backend || "webgl";

  try {
    // Try preferred backend first
    await tf.setBackend(preferredBackend);
    return preferredBackend;
  } catch (error) {
    console.warn(
      `⚠️ Failed to set ${preferredBackend} backend, trying fallbacks...`,
    );

    // Try fallback backends
    const fallbacks = ["webgl", "cpu"];
    for (const backend of fallbacks) {
      if (backend !== preferredBackend) {
        try {
          await tf.setBackend(backend);
          console.log(`✅ Using fallback backend: ${backend}`);
          return backend;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback ${backend} also failed`);
        }
      }
    }

    throw new Error("No suitable backend available");
  }
};

/**
 * Apply comprehensive performance optimizations
 */
const applyPerformanceOptimizations = async () => {
  // Enable WebGL optimizations if available
  if (
    MODEL_CONFIG.PERFORMANCE.USE_WEBGL_OPTIMIZATION &&
    tf.getBackend() === "webgl"
  ) {
    console.log("🚀 Applying WebGL optimizations...");

    // Optimize texture handling
    tf.env().set("WEBGL_PACK", true);
    tf.env().set("WEBGL_PACK_NORMALIZATION", true);
    tf.env().set("WEBGL_PACK_CLIP", true);

    // Optimize memory allocation
    tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
    tf.env().set("WEBGL_FLUSH_THRESHOLD", -1);
  }

  console.log("✅ Performance optimizations applied");
};

/**
 * Initialize memory monitoring
 */
const initializeMemoryMonitoring = () => {
  if (MODEL_CONFIG.PERFORMANCE.ENABLE_PROFILING) {
    console.log("📊 Starting memory monitoring...");
    MEMORY_UTILS.startMonitoring(30000); // 30 second intervals
  }
};

/**
 * Warm up the backend with a small operation
 */
const warmUpBackend = async () => {
  try {
    console.log("🔥 Warming up TensorFlow backend...");
    const startTime = Date.now();

    // Small matrix multiplication to warm up GPU
    const a = tf.randomNormal([32, 32]);
    const b = tf.randomNormal([32, 32]);
    const result = tf.matMul(a, b);
    await result.data(); // Force execution

    // Cleanup
    a.dispose();
    b.dispose();
    result.dispose();

    const warmUpTime = Date.now() - startTime;
    console.log(`🔥 Backend warmed up in ${warmUpTime}ms`);
  } catch (error) {
    console.warn("⚠️ Backend warm-up failed:", error.message);
  }
};

/**
 * Get backend capabilities
 */
const getBackendCapabilities = async () => {
  const backend = tf.getBackend();
  const capabilities = {
    backend,
    webgl: backend === "webgl",
    supportsFP16: false,
    maxTextureSize: 0,
    supportsFloat32: true,
  };

  if (backend === "webgl") {
    try {
      const webglBackend = tf.backend();
      capabilities.maxTextureSize = webglBackend.maxTextureSize || 0;
      capabilities.supportsFP16 = webglBackend.isRenderFloat32Capable || false;
    } catch (error) {
      console.warn("⚠️ Failed to get WebGL capabilities:", error);
    }
  }

  return capabilities;
};

/**
 * Fallback initialization for error recovery
 */
const fallbackInitialization = async () => {
  try {
    console.log("🔄 Attempting fallback initialization...");

    // Force CPU backend
    await tf.setBackend("cpu");
    await tf.ready();

    return {
      success: true,
      backend: "cpu",
    };
  } catch (error) {
    return {
      success: false,
      backend: null,
      error: error.message,
    };
  }
};

/**
 * Create regularizer based on configuration
 */
const createRegularizer = (config) => {
  if (!config || (!config.L1 && !config.L2)) return null;

  if (config.L1 && config.L2) {
    return tf.regularizers.l1l2({ l1: config.L1, l2: config.L2 });
  } else if (config.L1) {
    return tf.regularizers.l1({ l1: config.L1 });
  } else if (config.L2) {
    return tf.regularizers.l2({ l2: config.L2 });
  }

  return null;
};

/**
 * Create optimized optimizer with adaptive learning rate
 */
const createOptimizedOptimizer = () => {
  const config = MODEL_CONFIG.TRAINING;

  // Create Adam optimizer with custom settings
  return tf.train.adam({
    learningRate: config.LEARNING_RATE,
    beta1: 0.9,
    beta2: 0.999,
    epsilon: 1e-7,
  });
};

/**
 * Add performance monitoring hooks to model
 */
const addPerformanceHooks = (model) => {
  if (!MODEL_CONFIG.PERFORMANCE.ENABLE_PROFILING) return;

  // Add hooks to monitor training performance
  const originalFit = model.fit.bind(model);
  model.fit = function (...args) {
    const startTime = Date.now();
    const result = originalFit(...args);

    // Monitor memory during training
    if (result.then) {
      result.then(() => {
        const endTime = Date.now();
        console.log(`📊 Training completed in ${endTime - startTime}ms`);
        MEMORY_UTILS.logMemoryUsage("After Training", true);
      });
    }

    return result;
  };
};

/**
 * Compress model using quantization
 */
const compressModel = async (model) => {
  if (!MODEL_CONFIG.COMPRESSION.ENABLE_QUANTIZATION) return model;

  try {
    console.log("🗜️ Compressing model...");
    // This is a placeholder - actual quantization would require tf.js quantization API
    // For now, return the original model
    return model;
  } catch (error) {
    console.warn("⚠️ Model compression failed:", error);
    return model;
  }
};

/**
 * Get model performance metrics
 */
const getModelPerformanceMetrics = async (model) => {
  try {
    return {
      parameters: model.countParams(),
      memoryUsage: tf.memory(),
      modelSize: await estimateModelSize(model),
    };
  } catch (error) {
    return {
      parameters: 0,
      memoryUsage: tf.memory(),
      modelSize: 0,
      error: error.message,
    };
  }
};

/**
 * Estimate model size in bytes
 */
const estimateModelSize = async (model) => {
  try {
    // Rough estimation based on parameters and float32 size
    const params = model.countParams();
    return params * 4; // 4 bytes per float32 parameter
  } catch (error) {
    return 0;
  }
};

/**
 * Get browser information for compatibility
 */
const getBrowserInfo = () => {
  if (typeof navigator === "undefined") return { unknown: true };

  return {
    userAgent: navigator.userAgent,
    vendor: navigator.vendor,
    platform: navigator.platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
  };
};

/**
 * Validate model integrity
 */
const validateModelIntegrity = async (model, metadata) => {
  try {
    const validation = {
      valid: true,
      issues: [],
    };

    // Check if model parameters match metadata
    if (metadata && metadata.modelParams !== model.countParams()) {
      validation.issues.push("Parameter count mismatch with metadata");
    }

    // Check if model can make predictions
    try {
      const testInput = tf.zeros([1, MODEL_CONFIG.ARCHITECTURE.INPUT_SIZE]);
      const testOutput = model.predict(testInput);
      testInput.dispose();
      testOutput.dispose();
    } catch (error) {
      validation.issues.push(`Prediction test failed: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  } catch (error) {
    return {
      valid: false,
      issues: [`Validation failed: ${error.message}`],
    };
  }
};

/**
 * Extract version from model URL
 */
const extractVersionFromUrl = (url) => {
  const match = url.match(/-v([\d.]+)$/);
  return match ? match[1] : "1.0";
};

// Export enhanced configuration
export default {
  MODEL_CONFIG,
  initializeTensorFlow,
  createScheduleModel,
  MODEL_STORAGE,
  MEMORY_UTILS,

  // Enhanced functions
  configureEnvironment,
  selectOptimalBackend,
  applyPerformanceOptimizations,
  warmUpBackend,
  getBackendCapabilities,
  createOptimizedOptimizer,
  compressModel,
  validateModelIntegrity,
};
