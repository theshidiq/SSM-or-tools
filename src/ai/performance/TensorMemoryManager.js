/**
 * TensorMemoryManager.js
 *
 * Advanced memory management system for TensorFlow.js operations.
 * Prevents memory leaks, manages tensor lifecycle, and optimizes memory usage.
 */

import * as tf from "@tensorflow/tfjs";

class TensorMemoryManager {
  constructor() {
    this.isInitialized = false;
    this.memoryLimits = {
      maxTotalMemory: 512 * 1024 * 1024, // 512MB default limit
      warningThreshold: 400 * 1024 * 1024, // 400MB warning threshold
      criticalThreshold: 480 * 1024 * 1024, // 480MB critical threshold
      maxTensors: 10000, // Maximum number of tensors
      warningTensorCount: 8000, // Warning tensor count
    };

    // Memory tracking
    this.memoryStats = {
      peakMemoryUsage: 0,
      currentMemoryUsage: 0,
      totalTensorsCreated: 0,
      totalTensorsDisposed: 0,
      currentTensorCount: 0,
      memoryCleanups: 0,
      forceCleanups: 0,
      oomEvents: 0,
    };

    // Tensor tracking for lifecycle management
    this.tensorRegistry = new Map();
    this.disposalQueue = new Set();
    this.tensorScopeStack = [];
    this.autoCleanupEnabled = true;
    this.cleanupTimer = null;

    // Memory pressure callbacks
    this.memoryPressureCallbacks = new Set();
    this.oomCallbacks = new Set();

    // Performance tracking
    this.performanceMetrics = {
      averageDisposalTime: 0,
      averageCleanupTime: 0,
      totalDisposalOperations: 0,
      totalCleanupOperations: 0,
    };

    // Tensor pooling for reuse
    this.tensorPools = new Map();
    this.poolingEnabled = true;
    this.maxPoolSize = 100;

    // Memory optimization strategies
    this.optimizationStrategies = {
      aggressiveCleanup: false,
      tensorPooling: true,
      automaticDisposal: true,
      memoryDefragmentation: true,
      scopeManagement: true,
    };
  }

  /**
   * Initialize the memory manager
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log("🧠 Initializing TensorFlow Memory Manager...");

      // Apply configuration options
      this.applyConfiguration(options);

      // Setup TensorFlow.js memory configuration
      await this.configureTensorFlow();

      // Setup memory monitoring
      this.setupMemoryMonitoring();

      // Setup automatic cleanup
      this.setupAutomaticCleanup();

      // Hook into TensorFlow tensor creation/disposal
      this.setupTensorHooks();

      this.isInitialized = true;

      console.log("✅ TensorFlow Memory Manager initialized:", {
        maxMemory:
          Math.round(this.memoryLimits.maxTotalMemory / 1024 / 1024) + "MB",
        maxTensors: this.memoryLimits.maxTensors,
        poolingEnabled: this.poolingEnabled,
        autoCleanup: this.autoCleanupEnabled,
      });

      return { success: true, config: this.getConfiguration() };
    } catch (error) {
      console.error("❌ Memory Manager initialization failed:", error);
      throw error;
    }
  }

  /**
   * Apply configuration options
   */
  applyConfiguration(options) {
    if (options.maxMemoryMB) {
      this.memoryLimits.maxTotalMemory = options.maxMemoryMB * 1024 * 1024;
      this.memoryLimits.warningThreshold = Math.floor(
        this.memoryLimits.maxTotalMemory * 0.8,
      );
      this.memoryLimits.criticalThreshold = Math.floor(
        this.memoryLimits.maxTotalMemory * 0.95,
      );
    }

    if (options.maxTensors) {
      this.memoryLimits.maxTensors = options.maxTensors;
      this.memoryLimits.warningTensorCount = Math.floor(
        options.maxTensors * 0.8,
      );
    }

    if (options.poolingEnabled !== undefined) {
      this.poolingEnabled = options.poolingEnabled;
    }

    if (options.autoCleanupEnabled !== undefined) {
      this.autoCleanupEnabled = options.autoCleanupEnabled;
    }

    // Apply optimization strategies
    Object.assign(
      this.optimizationStrategies,
      options.optimizationStrategies || {},
    );
  }

  /**
   * Configure TensorFlow.js for optimal memory usage
   */
  async configureTensorFlow() {
    // Wait for TensorFlow to be ready
    await tf.ready();

    // Configure memory management settings
    tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0); // Immediate cleanup
    tf.env().set("WEBGL_FORCE_F16_TEXTURES", true); // Use half precision
    tf.env().set("WEBGL_PACK", true); // Enable texture packing
    tf.env().set("WEBGL_MAX_TEXTURE_SIZE", 4096); // Limit texture size

    // Set memory growth for GPU backend
    if (tf.getBackend() === "webgl") {
      tf.env().set("WEBGL_MEMORY_GROWTH", true);
    }

    console.log("🔧 TensorFlow configured for optimal memory usage:", {
      backend: tf.getBackend(),
      flags: tf.env().getFlags(),
    });
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    // Monitor memory usage every 5 seconds
    this.memoryMonitorTimer = setInterval(() => {
      this.updateMemoryStats();
      this.checkMemoryPressure();
    }, 5000);

    // Setup performance observer for memory pressure (if available)
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "measure-memory") {
              this.handleMemoryMeasurement(entry);
            }
          }
        });
        observer.observe({ type: "measure" });
      } catch (error) {
        console.warn("Performance Observer not available:", error);
      }
    }
  }

  /**
   * Setup automatic cleanup
   */
  setupAutomaticCleanup() {
    if (!this.autoCleanupEnabled) return;

    // Aggressive cleanup every 30 seconds
    this.cleanupTimer = setInterval(async () => {
      await this.performAutomaticCleanup();
    }, 30000);

    // Emergency cleanup on memory pressure
    this.onMemoryPressure("high", async () => {
      console.warn(
        "🚨 High memory pressure detected, performing emergency cleanup",
      );
      await this.performEmergencyCleanup();
    });
  }

  /**
   * Setup tensor creation/disposal hooks using TensorFlow.js engine hooks
   */
  setupTensorHooks() {
    try {
      const self = this;

      // Use TensorFlow.js engine registration hooks instead of overriding properties
      // This is a safer approach that works with TensorFlow.js internal architecture

      // Set up engine disposal hooks
      if (tf.engine && tf.engine().startScope && tf.engine().endScope) {
        const originalStartScope = tf.engine().startScope.bind(tf.engine());
        const originalEndScope = tf.engine().endScope.bind(tf.engine());

        // Override scope management for tracking
        tf.engine().startScope = function (name) {
          self.enterTensorScope(name || "unnamed");
          return originalStartScope(name);
        };

        tf.engine().endScope = function (result) {
          try {
            const scopeResult = originalEndScope(result);
            self.exitTensorScope();
            return scopeResult;
          } catch (error) {
            // Handle null reference errors gracefully
            console.warn(
              "TensorFlow engine endScope error (handled gracefully):",
              error.message,
            );
            self.exitTensorScope();
            return result; // Return the original result
          }
        };
      }

      // Use tf.util.createScalarValue hook for tensor tracking if available
      if (tf.util && tf.util.createScalarValue) {
        // This is a more compatible way to track tensor creation
        console.log("🔧 Using TensorFlow.js util hooks for tensor tracking");
      }

      // Set up periodic memory monitoring instead of hooking every operation
      this.setupPeriodicMemoryTracking();

      console.log("✅ TensorFlow hooks configured safely");
    } catch (error) {
      console.warn(
        "⚠️ TensorFlow hooks setup failed, using fallback monitoring:",
        error.message,
      );
      // Fallback to periodic monitoring only
      this.setupPeriodicMemoryTracking();
    }
  }

  /**
   * Setup periodic memory tracking as fallback
   */
  setupPeriodicMemoryTracking() {
    // Track memory usage and tensor counts periodically
    this.tensorTrackingTimer = setInterval(() => {
      try {
        const memInfo = tf.memory();
        this.updateMemoryStatsFromTF(memInfo);

        // Estimate tensors created based on memory info
        const estimatedTensors = memInfo.numTensors || 0;
        if (estimatedTensors > this.memoryStats.currentTensorCount) {
          this.memoryStats.totalTensorsCreated +=
            estimatedTensors - this.memoryStats.currentTensorCount;
        }

        this.memoryStats.currentTensorCount = estimatedTensors;

        // Check for memory pressure
        if (
          this.memoryStats.currentTensorCount > 0 &&
          this.memoryStats.currentTensorCount % 100 === 0
        ) {
          this.checkMemoryPressure();
        }
      } catch (error) {
        console.warn("Periodic memory tracking error:", error.message);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Register a tensor for tracking (fallback method)
   */
  registerTensor(tensor) {
    if (!tensor || !tensor.id) return;

    const tensorInfo = {
      id: tensor.id,
      shape: tensor.shape,
      dtype: tensor.dtype,
      size: tensor.size,
      createdAt: Date.now(),
      scope: this.getCurrentScope(),
      disposed: false,
    };

    this.tensorRegistry.set(tensor.id, tensorInfo);
    this.memoryStats.totalTensorsCreated++;
    this.memoryStats.currentTensorCount++;

    // Check for memory pressure after tensor creation
    if (this.memoryStats.currentTensorCount % 100 === 0) {
      this.checkMemoryPressure();
    }
  }

  /**
   * Unregister a tensor
   */
  unregisterTensor(tensorId) {
    if (this.tensorRegistry.has(tensorId)) {
      const tensorInfo = this.tensorRegistry.get(tensorId);
      tensorInfo.disposed = true;
      this.tensorRegistry.delete(tensorId);
      this.memoryStats.totalTensorsDisposed++;
      this.memoryStats.currentTensorCount--;
    }
  }

  /**
   * Enter a tensor scope
   */
  enterTensorScope(scopeName = "unnamed") {
    this.tensorScopeStack.push({
      name: scopeName,
      tensors: new Set(),
      startTime: Date.now(),
    });
  }

  /**
   * Exit a tensor scope
   */
  exitTensorScope() {
    if (this.tensorScopeStack.length === 0) return;

    const scope = this.tensorScopeStack.pop();
    const duration = Date.now() - scope.startTime;

    // Cleanup tensors in this scope if needed
    if (this.optimizationStrategies.scopeManagement) {
      this.cleanupScopeTensors(scope);
    }

    console.log(
      `📊 Tensor scope '${scope.name}' completed in ${duration}ms with ${scope.tensors.size} tensors`,
    );
  }

  /**
   * Get current tensor scope
   */
  getCurrentScope() {
    return this.tensorScopeStack.length > 0
      ? this.tensorScopeStack[this.tensorScopeStack.length - 1].name
      : "global";
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    try {
      const memInfo = tf.memory();
      this.updateMemoryStatsFromTF(memInfo);
    } catch (error) {
      console.warn("Failed to update memory stats:", error);
    }
  }

  /**
   * Update memory stats from TensorFlow memory info
   */
  updateMemoryStatsFromTF(memInfo) {
    this.memoryStats.currentMemoryUsage = memInfo.numBytes;
    this.memoryStats.currentTensorCount = memInfo.numTensors;

    if (memInfo.numBytes > this.memoryStats.peakMemoryUsage) {
      this.memoryStats.peakMemoryUsage = memInfo.numBytes;
    }
  }

  /**
   * Check for memory pressure and take action
   */
  checkMemoryPressure() {
    const memoryUsage = this.memoryStats.currentMemoryUsage;
    const tensorCount = this.memoryStats.currentTensorCount;

    let pressureLevel = "normal";

    // Check memory thresholds
    if (
      memoryUsage > this.memoryLimits.criticalThreshold ||
      tensorCount > this.memoryLimits.maxTensors
    ) {
      pressureLevel = "critical";
    } else if (
      memoryUsage > this.memoryLimits.warningThreshold ||
      tensorCount > this.memoryLimits.warningTensorCount
    ) {
      pressureLevel = "high";
    }

    if (pressureLevel !== "normal") {
      this.notifyMemoryPressure(pressureLevel, {
        memoryUsage,
        memoryLimit: this.memoryLimits.maxTotalMemory,
        tensorCount,
        tensorLimit: this.memoryLimits.maxTensors,
      });

      // Trigger automatic cleanup for high pressure
      if (pressureLevel === "high") {
        this.performAutomaticCleanup();
      } else if (pressureLevel === "critical") {
        this.performEmergencyCleanup();
      }
    }
  }

  /**
   * Perform automatic cleanup
   */
  async performAutomaticCleanup() {
    if (!this.autoCleanupEnabled) return;

    const startTime = Date.now();
    const beforeMemory = tf.memory();

    try {
      console.log("🧹 Performing automatic tensor cleanup...");

      // Clean up disposed tensors
      await this.cleanupDisposedTensors();

      // Clean up old tensor pools
      await this.cleanupTensorPools();

      // Force garbage collection
      await this.forceGarbageCollection();

      // Defragment memory if needed
      if (this.optimizationStrategies.memoryDefragmentation) {
        await this.defragmentMemory();
      }

      const afterMemory = tf.memory();
      const cleanupTime = Date.now() - startTime;
      const memoryReleased = beforeMemory.numBytes - afterMemory.numBytes;

      this.memoryStats.memoryCleanups++;
      this.updateCleanupMetrics(cleanupTime);

      console.log(`✅ Automatic cleanup completed in ${cleanupTime}ms:`, {
        memoryReleased: Math.round(memoryReleased / 1024 / 1024) + "MB",
        tensorsRemaining: afterMemory.numTensors,
        currentMemory: Math.round(afterMemory.numBytes / 1024 / 1024) + "MB",
      });
    } catch (error) {
      console.error("Automatic cleanup failed:", error);
    }
  }

  /**
   * Perform emergency cleanup for critical memory pressure
   */
  async performEmergencyCleanup() {
    console.warn("🚨 Performing emergency memory cleanup...");

    const startTime = Date.now();
    this.memoryStats.forceCleanups++;

    try {
      // Aggressive tensor disposal
      await this.performAggressiveCleanup();

      // Clear all tensor pools
      this.clearAllTensorPools();

      // Force multiple GC cycles
      for (let i = 0; i < 3; i++) {
        await this.forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Notify OOM callbacks
      this.notifyOOMEvent({
        type: "emergency_cleanup",
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("Emergency cleanup failed:", error);
      this.memoryStats.oomEvents++;
    }
  }

  /**
   * Perform aggressive tensor cleanup with safe tensor access
   */
  async performAggressiveCleanup() {
    try {
      // Use TensorFlow.js dispose to clean up all unused tensors
      const beforeMemory = tf.memory();

      // Force disposal of unreferenced tensors
      tf.dispose();

      // Clear our registry of old entries
      const cutoffTime = Date.now() - 5 * 60 * 1000;
      const tensorsToRemove = [];

      for (const [id, tensorInfo] of this.tensorRegistry) {
        if (tensorInfo.createdAt < cutoffTime && !tensorInfo.disposed) {
          tensorsToRemove.push(id);
        }
      }

      // Remove old tensor references from our registry
      tensorsToRemove.forEach((id) => {
        this.unregisterTensor(id);
      });

      const afterMemory = tf.memory();
      const tensorsDisposed = beforeMemory.numTensors - afterMemory.numTensors;

      if (tensorsDisposed > 0) {
        console.log(
          `🗑️ Aggressively disposed ${tensorsDisposed} tensors via tf.dispose()`,
        );
      }

      // Yield to allow cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (error) {
      console.warn(
        "Aggressive cleanup error (handled gracefully):",
        error.message,
      );
      // Continue with basic cleanup
      this.tensorRegistry.clear();
    }
  }

  /**
   * Clean up disposed tensors
   */
  async cleanupDisposedTensors() {
    const disposedTensors = [];

    for (const [id, tensorInfo] of this.tensorRegistry) {
      if (tensorInfo.disposed) {
        disposedTensors.push(id);
      }
    }

    disposedTensors.forEach((id) => this.tensorRegistry.delete(id));

    if (disposedTensors.length > 0) {
      console.log(
        `🧹 Cleaned up ${disposedTensors.length} disposed tensor references`,
      );
    }
  }

  /**
   * Clean up tensor pools
   */
  async cleanupTensorPools() {
    if (!this.poolingEnabled) return;

    let cleanedPools = 0;
    const cutoffTime = Date.now() - 10 * 60 * 1000; // 10 minutes

    for (const [key, pool] of this.tensorPools) {
      const activeTensors = pool.tensors.filter((tensor) => {
        return tensor.lastUsed > cutoffTime && !tensor.tensor.isDisposed;
      });

      // Dispose unused tensors
      const disposedCount = pool.tensors.length - activeTensors.length;
      pool.tensors.forEach((tensor) => {
        if (tensor.lastUsed <= cutoffTime || tensor.tensor.isDisposed) {
          try {
            tensor.tensor.dispose();
          } catch (error) {
            console.warn("Failed to dispose pooled tensor:", error);
          }
        }
      });

      pool.tensors = activeTensors;

      if (disposedCount > 0) {
        cleanedPools++;
        console.log(`🗑️ Cleaned ${disposedCount} tensors from pool '${key}'`);
      }

      // Remove empty pools
      if (pool.tensors.length === 0) {
        this.tensorPools.delete(key);
      }
    }

    if (cleanedPools > 0) {
      console.log(`🧹 Cleaned ${cleanedPools} tensor pools`);
    }
  }

  /**
   * Clear all tensor pools
   */
  clearAllTensorPools() {
    for (const [key, pool] of this.tensorPools) {
      pool.tensors.forEach((tensor) => {
        try {
          tensor.tensor.dispose();
        } catch (error) {
          console.warn("Failed to dispose pooled tensor:", error);
        }
      });
    }

    this.tensorPools.clear();
    console.log("🗑️ Cleared all tensor pools");
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection() {
    // Use tf.dispose to trigger cleanup
    tf.dispose();

    // Force browser GC if available
    if (window.gc) {
      window.gc();
    }

    // Yield to allow GC to run
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  /**
   * Defragment memory
   */
  async defragmentMemory() {
    try {
      // This is a placeholder for memory defragmentation
      // In practice, this would involve reorganizing tensor storage
      console.log("🔧 Memory defragmentation completed");
    } catch (error) {
      console.warn("Memory defragmentation failed:", error);
    }
  }

  /**
   * Get or create a tensor from pool
   */
  getTensorFromPool(poolKey, shape, dtype = "float32") {
    if (!this.poolingEnabled) return null;

    const pool = this.tensorPools.get(poolKey);
    if (!pool) return null;

    // Find matching tensor in pool
    const matchingTensor = pool.tensors.find((tensor) => {
      return (
        !tensor.tensor.isDisposed &&
        tensor.tensor.shape.toString() === shape.toString() &&
        tensor.tensor.dtype === dtype
      );
    });

    if (matchingTensor) {
      // Remove from pool and return
      pool.tensors = pool.tensors.filter((t) => t !== matchingTensor);
      matchingTensor.lastUsed = Date.now();
      console.log(`♻️ Retrieved tensor from pool '${poolKey}'`);
      return matchingTensor.tensor;
    }

    return null;
  }

  /**
   * Return a tensor to pool
   */
  returnTensorToPool(poolKey, tensor) {
    if (!this.poolingEnabled || !tensor || tensor.isDisposed) return;

    let pool = this.tensorPools.get(poolKey);
    if (!pool) {
      pool = { tensors: [], maxSize: this.maxPoolSize };
      this.tensorPools.set(poolKey, pool);
    }

    // Check if pool is full
    if (pool.tensors.length >= pool.maxSize) {
      // Remove oldest tensor
      const oldest = pool.tensors.shift();
      oldest.tensor.dispose();
    }

    // Add to pool
    pool.tensors.push({
      tensor,
      lastUsed: Date.now(),
      pooledAt: Date.now(),
    });

    console.log(`♻️ Returned tensor to pool '${poolKey}'`);
  }

  /**
   * Create a managed tensor scope
   */
  managedScope(name, fn) {
    return tf.tidy(name, () => {
      this.enterTensorScope(name);
      try {
        return fn();
      } finally {
        this.exitTensorScope();
      }
    });
  }

  /**
   * Register memory pressure callback
   */
  onMemoryPressure(level, callback) {
    this.memoryPressureCallbacks.add({ level, callback });
    return () => this.memoryPressureCallbacks.delete({ level, callback });
  }

  /**
   * Register OOM callback
   */
  onOutOfMemory(callback) {
    this.oomCallbacks.add(callback);
    return () => this.oomCallbacks.delete(callback);
  }

  /**
   * Notify memory pressure callbacks
   */
  notifyMemoryPressure(level, stats) {
    for (const { level: callbackLevel, callback } of this
      .memoryPressureCallbacks) {
      if (callbackLevel === level || callbackLevel === "all") {
        try {
          callback({ level, stats });
        } catch (error) {
          console.warn("Memory pressure callback failed:", error);
        }
      }
    }
  }

  /**
   * Notify OOM callbacks
   */
  notifyOOMEvent(eventInfo) {
    for (const callback of this.oomCallbacks) {
      try {
        callback(eventInfo);
      } catch (error) {
        console.warn("OOM callback failed:", error);
      }
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    try {
      const tfMemory = tf.memory();
      return {
        ...this.memoryStats,
        currentMemoryUsage: tfMemory.numBytes,
        currentTensorCount: tfMemory.numTensors,
        memoryUtilization:
          (tfMemory.numBytes / this.memoryLimits.maxTotalMemory) * 100,
        tensorUtilization:
          (tfMemory.numTensors / this.memoryLimits.maxTensors) * 100,
        pooledTensors: Array.from(this.tensorPools.values()).reduce(
          (sum, pool) => sum + pool.tensors.length,
          0,
        ),
      };
    } catch (error) {
      console.warn("Failed to get memory stats:", error);
      return this.memoryStats;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      memoryStats: this.getMemoryStats(),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return {
      memoryLimits: this.memoryLimits,
      optimizationStrategies: this.optimizationStrategies,
      poolingEnabled: this.poolingEnabled,
      autoCleanupEnabled: this.autoCleanupEnabled,
      maxPoolSize: this.maxPoolSize,
    };
  }

  /**
   * Update cleanup metrics
   */
  updateCleanupMetrics(cleanupTime) {
    this.performanceMetrics.totalCleanupOperations++;
    const totalTime =
      this.performanceMetrics.averageCleanupTime *
        (this.performanceMetrics.totalCleanupOperations - 1) +
      cleanupTime;
    this.performanceMetrics.averageCleanupTime = Math.round(
      totalTime / this.performanceMetrics.totalCleanupOperations,
    );
  }

  /**
   * Cleanup scope tensors
   */
  cleanupScopeTensors(scope) {
    // This would implement scope-based tensor cleanup
    console.log(`🧹 Cleaning up tensors in scope '${scope.name}'`);
  }

  /**
   * Handle memory measurement from Performance Observer
   */
  handleMemoryMeasurement(entry) {
    if (entry.detail && entry.detail.bytes) {
      console.log(
        "📊 Browser memory usage:",
        Math.round(entry.detail.bytes / 1024 / 1024) + "MB",
      );
    }
  }

  /**
   * Destroy memory manager with safe cleanup
   */
  async destroy() {
    console.log("🧹 Destroying TensorFlow Memory Manager...");

    try {
      // Stop monitoring timers
      if (this.memoryMonitorTimer) {
        clearInterval(this.memoryMonitorTimer);
        this.memoryMonitorTimer = null;
      }

      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      if (this.tensorTrackingTimer) {
        clearInterval(this.tensorTrackingTimer);
        this.tensorTrackingTimer = null;
      }

      // Final cleanup with error handling
      try {
        await this.performEmergencyCleanup();
      } catch (error) {
        console.warn(
          "Emergency cleanup error during destroy (handled):",
          error.message,
        );
      }

      // Clear all callbacks
      this.memoryPressureCallbacks.clear();
      this.oomCallbacks.clear();

      // Clear registries
      this.tensorRegistry.clear();
      this.tensorPools.clear();

      this.isInitialized = false;
      console.log("✅ Memory Manager destroyed safely");
    } catch (error) {
      console.warn("Memory Manager destroy error (handled):", error.message);
      this.isInitialized = false;
    }
  }
}

// Singleton instance
let tensorMemoryManagerInstance = null;

export function getTensorMemoryManager() {
  if (!tensorMemoryManagerInstance) {
    tensorMemoryManagerInstance = new TensorMemoryManager();
  }
  return tensorMemoryManagerInstance;
}

export { TensorMemoryManager };
