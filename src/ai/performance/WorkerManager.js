/**
 * WorkerManager.js
 *
 * Manages AI Web Workers for non-blocking ML processing.
 * Handles worker lifecycle, communication, and fallback strategies.
 */

class WorkerManager {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.isProcessing = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.progressCallbacks = new Map();
    this.workerCapabilities = null;
    this.fallbackProcessor = null;

    // Performance tracking
    this.performanceMetrics = {
      workerInitTime: 0,
      averageProcessingTime: 0,
      totalProcessedJobs: 0,
      memoryCleanups: 0,
      errorCount: 0,
      fallbackUsage: 0,
    };

    // Worker configuration
    this.workerConfig = {
      enableMLPredictions: true,
      enableConstraintML: true,
      enablePatternRecognition: true,
      memoryLimitMB: 400,
      modelConfig: {
        inputSize: 50,
        outputSize: 4,
      },
      constraintConfig: {
        enabled: true,
      },
      patternConfig: {
        enabled: true,
      },
    };

    // Auto-cleanup timer
    this.cleanupTimer = null;
    this.setupPeriodicCleanup();
  }

  /**
   * Initialize the worker system
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    const startTime = Date.now();

    try {
      // Check if Web Workers are supported
      if (!this.isWorkerSupported()) {
        console.warn("🔄 Web Workers not supported, using fallback processor");
        await this.initializeFallback(options);
        return { success: true, fallback: true };
      }

      // Create worker
      this.worker = new Worker("/workers/aiWorker.js");
      this.setupWorkerEventListeners();

      // Initialize worker with configuration
      const config = {
        ...this.workerConfig,
        ...options,
        restaurantId: options.restaurantId,
      };

      const initResult = await this.sendWorkerMessage("initialize", config, {
        timeout: 30000,
        trackProgress: true,
      });

      if (initResult.success) {
        this.isInitialized = true;
        this.workerCapabilities = initResult.capabilities;
        this.performanceMetrics.workerInitTime = Date.now() - startTime;

        console.log("✅ AI Worker initialized successfully:", {
          initTime: this.performanceMetrics.workerInitTime + "ms",
          capabilities: this.workerCapabilities,
        });

        return { success: true, capabilities: this.workerCapabilities };
      } else {
        throw new Error("Worker initialization failed");
      }
    } catch (error) {
      console.error("❌ Worker initialization failed, using fallback:", error);
      await this.initializeFallback(options);
      this.performanceMetrics.errorCount++;
      return { success: true, fallback: true, error: error.message };
    }
  }

  /**
   * Process ML predictions using worker
   */
  async processMLPredictions(data, progressCallback) {
    if (!this.isInitialized) {
      throw new Error("WorkerManager not initialized");
    }

    if (this.isProcessing) {
      throw new Error("Another ML processing job is already running");
    }

    const startTime = Date.now();
    this.isProcessing = true;

    try {
      // Use worker if available, otherwise fallback
      let result;
      if (this.worker && this.workerCapabilities) {
        result = await this.processWithWorker(data, progressCallback);
      } else if (this.fallbackProcessor) {
        result = await this.processWithFallback(data, progressCallback);
      } else {
        throw new Error("No processing method available");
      }

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(processingTime, result);

      return {
        ...result,
        processingTime,
        method: this.worker ? "worker" : "fallback",
        memoryInfo: result.memoryInfo || {},
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process using web worker with enhanced timeout and cancellation
   */
  async processWithWorker(data, progressCallback) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    let processingTimeout = null;
    let cancellationTimeout = null;

    // Register progress callback
    if (progressCallback) {
      this.progressCallbacks.set(requestId, progressCallback);
    }

    try {
      // Enhanced timeout management
      const maxProcessingTime = data.timeout || 30000; // 30 seconds default
      const emergencyTimeout = maxProcessingTime + 5000; // +5s for cleanup

      console.log(
        `🚀 Starting worker processing (timeout: ${maxProcessingTime}ms)...`,
      );

      // Set up processing timeout
      const timeoutPromise = new Promise((_, reject) => {
        processingTimeout = setTimeout(() => {
          console.warn(
            `⏱️ Worker processing timeout after ${maxProcessingTime}ms`,
          );
          reject(
            new Error(`Worker processing timeout after ${maxProcessingTime}ms`),
          );
        }, maxProcessingTime);
      });

      // Set up emergency cancellation timeout
      const emergencyPromise = new Promise((_, reject) => {
        cancellationTimeout = setTimeout(async () => {
          console.warn(
            `🆘 Emergency worker cancellation after ${emergencyTimeout}ms`,
          );
          await this.emergencyWorkerCancellation();
          reject(
            new Error(
              `Emergency worker cancellation after ${emergencyTimeout}ms`,
            ),
          );
        }, emergencyTimeout);
      });

      // Main processing promise using new full AI prediction
      const processingPromise = this.sendWorkerMessage(
        "process_full_ai_prediction",
        {
          ...data,
          timeout: maxProcessingTime - 2000, // Give worker 2s less time
        },
        {
          requestId,
          timeout: maxProcessingTime,
          trackProgress: true,
        },
      );

      // Race between processing, timeout, and emergency cancellation
      const result = await Promise.race([
        processingPromise,
        timeoutPromise,
        emergencyPromise,
      ]);

      // Clear timeouts if processing completed successfully
      if (processingTimeout) clearTimeout(processingTimeout);
      if (cancellationTimeout) clearTimeout(cancellationTimeout);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Worker processing completed in ${processingTime}ms`);

      return {
        ...result,
        processingTime,
        method: "worker",
      };
    } catch (error) {
      // Clear any active timeouts
      if (processingTimeout) clearTimeout(processingTimeout);
      if (cancellationTimeout) clearTimeout(cancellationTimeout);

      const processingTime = Date.now() - startTime;

      if (
        error.message.includes("timeout") ||
        error.message.includes("Emergency")
      ) {
        console.warn(
          `⏱️ Worker timeout/cancellation after ${processingTime}ms, attempting fallback...`,
        );

        // Attempt graceful cancellation
        try {
          await this.sendWorkerMessage("cancel", {}, { timeout: 2000 });
        } catch (cancelError) {
          console.warn("Failed to cancel worker gracefully:", cancelError);
        }

        // Return emergency fallback result
        return await this.performEmergencyWorkerFallback(
          data,
          progressCallback,
        );
      }

      throw error;
    } finally {
      this.progressCallbacks.delete(requestId);
    }
  }

  /**
   * Process using fallback (main thread with yielding)
   */
  async processWithFallback(data, progressCallback) {
    this.performanceMetrics.fallbackUsage++;

    if (!this.fallbackProcessor) {
      // Lazy load fallback processor
      const { FallbackMLProcessor } = await import("./FallbackMLProcessor");
      this.fallbackProcessor = new FallbackMLProcessor();
    }

    return await this.fallbackProcessor.process(data, progressCallback);
  }

  /**
   * Cancel current processing with enhanced cleanup
   */
  async cancelProcessing() {
    if (!this.isProcessing) {
      return { success: false, reason: "No processing to cancel" };
    }

    console.log("🛑 Initiating processing cancellation...");

    try {
      if (this.worker) {
        // Try graceful cancellation first
        const gracefulTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Graceful cancellation timeout")),
            3000,
          ),
        );

        const gracefulCancel = this.sendWorkerMessage(
          "cancel",
          {},
          { timeout: 3000 },
        );

        try {
          await Promise.race([gracefulCancel, gracefulTimeout]);
          console.log("✅ Graceful worker cancellation successful");
        } catch (gracefulError) {
          console.warn(
            "⚠️ Graceful cancellation failed, forcing emergency stop...",
          );
          await this.emergencyWorkerCancellation();
        }
      } else if (this.fallbackProcessor) {
        this.fallbackProcessor.cancel();
      }

      this.isProcessing = false;

      // Clear all pending requests
      for (const [requestId, request] of this.pendingRequests) {
        if (request.timeout) clearTimeout(request.timeout);
        request.reject(new Error("Processing cancelled by user"));
      }
      this.pendingRequests.clear();

      return { success: true };
    } catch (error) {
      console.error("❌ Failed to cancel processing:", error);

      // Force cleanup even if cancellation failed
      this.isProcessing = false;
      this.pendingRequests.clear();

      return { success: false, error: error.message, forcedCleanup: true };
    }
  }

  /**
   * Get current processing status
   */
  async getStatus() {
    if (!this.isInitialized) {
      return { initialized: false };
    }

    try {
      if (this.worker) {
        return await this.sendWorkerMessage(
          "get_status",
          {},
          { timeout: 5000 },
        );
      } else {
        return {
          initialized: true,
          processing: { isProcessing: this.isProcessing },
          method: "fallback",
          capabilities: this.workerCapabilities,
          performanceMetrics: this.performanceMetrics,
        };
      }
    } catch (error) {
      return {
        initialized: this.isInitialized,
        error: error.message,
        performanceMetrics: this.performanceMetrics,
      };
    }
  }

  /**
   * Perform manual memory cleanup
   */
  async performMemoryCleanup() {
    try {
      if (this.worker) {
        const result = await this.sendWorkerMessage(
          "cleanup_memory",
          {},
          { timeout: 10000 },
        );
        this.performanceMetrics.memoryCleanups++;
        return result;
      } else if (this.fallbackProcessor) {
        return await this.fallbackProcessor.performMemoryCleanup();
      }
    } catch (error) {
      console.warn("Memory cleanup failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emergency worker cancellation when normal cancellation fails
   */
  async emergencyWorkerCancellation() {
    console.warn("🆘 Performing emergency worker cancellation...");

    try {
      if (this.worker) {
        // Immediately terminate the worker
        this.worker.terminate();
        console.log("⚡ Worker forcefully terminated");

        // Clear worker reference
        this.worker = null;

        // Recreate worker for future use
        setTimeout(async () => {
          try {
            console.log("🔄 Recreating worker after emergency termination...");
            this.worker = new Worker("/workers/aiWorker.js");
            this.setupWorkerEventListeners();

            // Reinitialize if needed
            if (this.isInitialized) {
              await this.initializeWorkerQuietly();
            }
          } catch (recreateError) {
            console.error("Failed to recreate worker:", recreateError);
            this.isInitialized = false;
          }
        }, 1000);
      }

      // Clear all pending requests
      for (const [requestId, request] of this.pendingRequests) {
        if (request.timeout) clearTimeout(request.timeout);
        request.reject(new Error("Emergency worker cancellation"));
      }
      this.pendingRequests.clear();
      this.progressCallbacks.clear();

      this.isProcessing = false;
    } catch (error) {
      console.error("Emergency cancellation failed:", error);
    }
  }

  /**
   * Emergency fallback when worker completely fails
   */
  async performEmergencyWorkerFallback(data, progressCallback) {
    console.log("🆘 Performing emergency worker fallback...");

    try {
      if (progressCallback) {
        progressCallback({
          stage: "emergency_fallback",
          progress: 25,
          message: "緊急フォールバック実行中...",
        });
      }

      // Use fallback processor or simple logic
      if (this.fallbackProcessor) {
        const result = await this.fallbackProcessor.process(
          data,
          progressCallback,
        );
        return {
          ...result,
          emergencyFallback: true,
          method: "emergency_fallback_processor",
        };
      } else {
        // Ultra-simple emergency logic
        const emergencySchedule = await this.performUltraSimpleEmergencyFill(
          data.scheduleData,
          data.staffMembers,
          progressCallback,
        );

        return {
          success: true,
          schedule: emergencySchedule.schedule,
          metadata: {
            method: "ultra_simple_emergency",
            processingTime: 500,
            filledCells: emergencySchedule.filledCells,
            quality: 50,
            confidence: 50,
            emergencyFallback: true,
          },
        };
      }
    } catch (error) {
      console.error("Emergency fallback also failed:", error);
      return {
        success: false,
        error: "All processing methods failed: " + error.message,
        emergencyFallback: true,
        schedule: data.scheduleData, // Return original
      };
    }
  }

  /**
   * Ultra-simple emergency schedule filling
   */
  async performUltraSimpleEmergencyFill(
    scheduleData,
    staffMembers,
    progressCallback,
  ) {
    const schedule = JSON.parse(JSON.stringify(scheduleData));
    let filledCells = 0;

    if (progressCallback) {
      progressCallback({
        stage: "ultra_simple_fill",
        progress: 50,
        message: "最小限のスケジュール生成中...",
      });
    }

    Object.keys(schedule).forEach((staffId) => {
      const staff = staffMembers.find((s) => s.id === staffId);
      if (!staff) return;

      Object.keys(schedule[staffId]).forEach((dateKey) => {
        const currentValue = schedule[staffId][dateKey];

        if (!currentValue || currentValue === "") {
          const date = new Date(dateKey);
          const dayOfWeek = date.getDay();

          // Ultra-simple pattern
          let shift;
          if (staff.status === "パート") {
            // Part-time: work weekdays, rest weekends
            shift = dayOfWeek === 0 || dayOfWeek === 6 ? "×" : "○";
          } else {
            // Full-time: work most days, occasional rest
            shift = dayOfWeek === 1 ? "×" : ""; // Monday off
          }

          schedule[staffId][dateKey] = shift;
          filledCells++;
        }
      });
    });

    if (progressCallback) {
      progressCallback({
        stage: "ultra_simple_complete",
        progress: 100,
        message: `緊急フィル完了 (${filledCells}個のセル)`,
      });
    }

    return { schedule, filledCells };
  }

  /**
   * Initialize worker quietly (for recreation)
   */
  async initializeWorkerQuietly() {
    try {
      const config = {
        ...this.workerConfig,
        quiet: true,
      };

      await this.sendWorkerMessage("initialize", config, { timeout: 15000 });
      this.isInitialized = true;
      console.log("🔄 Worker quietly reinitialized");
    } catch (error) {
      console.warn("Quiet worker initialization failed:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Destroy worker and cleanup resources
   */
  async destroy() {
    try {
      // Cancel any ongoing processing
      if (this.isProcessing) {
        await this.cancelProcessing();
      }

      // Clear timers
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // Terminate worker
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      // Cleanup fallback processor
      if (this.fallbackProcessor) {
        await this.fallbackProcessor.destroy();
        this.fallbackProcessor = null;
      }

      // Clear state
      this.isInitialized = false;
      this.isProcessing = false;
      this.pendingRequests.clear();
      this.progressCallbacks.clear();

      console.log("🧹 WorkerManager destroyed successfully");
      return { success: true };
    } catch (error) {
      console.error("Error destroying WorkerManager:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup worker event listeners
   */
  setupWorkerEventListeners() {
    if (!this.worker) return;

    this.worker.onmessage = (event) => {
      const { type, requestId, data } = event.data;

      switch (type) {
        case "progress":
          this.handleProgressUpdate(requestId, data);
          break;

        case "result":
          this.handleWorkerResult(requestId, data);
          break;

        case "error":
          this.handleWorkerError(requestId, data);
          break;

        case "initialized":
          this.handleWorkerInitialized(data);
          break;

        case "cancelled":
          this.handleWorkerCancelled(data);
          break;

        case "memory_cleanup":
          this.handleMemoryCleanup(data);
          break;

        case "status":
          this.handleStatusResponse(requestId, data);
          break;

        default:
          console.warn("Unknown worker message type:", type);
      }
    };

    this.worker.onerror = (error) => {
      console.error("Worker error:", error);
      this.performanceMetrics.errorCount++;

      // Handle worker errors by rejecting pending requests
      for (const [requestId, request] of this.pendingRequests) {
        request.reject(new Error(`Worker error: ${error.message}`));
      }
      this.pendingRequests.clear();
    };
  }

  /**
   * Handle progress updates from worker
   */
  handleProgressUpdate(requestId, data) {
    // Broadcast to registered progress callbacks
    if (requestId && this.progressCallbacks.has(requestId)) {
      this.progressCallbacks.get(requestId)(data);
    }

    // Also broadcast to any general progress listeners
    for (const [, callback] of this.progressCallbacks) {
      if (typeof callback === "function") {
        try {
          callback(data);
        } catch (error) {
          console.warn("Progress callback error:", error);
        }
      }
    }
  }

  /**
   * Handle worker result
   */
  handleWorkerResult(requestId, data) {
    if (this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      request.resolve(data);
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(requestId, data) {
    this.performanceMetrics.errorCount++;

    if (this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      request.reject(new Error(data.error || "Worker processing error"));
    }
  }

  /**
   * Handle worker initialized response
   */
  handleWorkerInitialized(data) {
    if (data.success) {
      this.workerCapabilities = data.capabilities;
      console.log("🚀 Worker capabilities loaded:", this.workerCapabilities);
    }
  }

  /**
   * Handle worker cancellation
   */
  handleWorkerCancelled(data) {
    console.log("⏹️ Worker processing cancelled:", data);
  }

  /**
   * Handle memory cleanup notification
   */
  handleMemoryCleanup(data) {
    console.log("🧹 Worker memory cleanup:", {
      cleaned: Math.round(data.cleanedBytes / 1024 / 1024) + "MB",
      current: Math.round(data.currentMemory / 1024 / 1024) + "MB",
      tensors: data.currentTensors,
    });
  }

  /**
   * Handle status response
   */
  handleStatusResponse(requestId, data) {
    if (this.pendingRequests.has(requestId)) {
      this.handleWorkerResult(requestId, data);
    }
  }

  /**
   * Send message to worker with timeout and promise handling
   */
  sendWorkerMessage(type, data, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = options.requestId || this.generateRequestId();
      const timeout = options.timeout || 60000;

      // Setup timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Worker request timeout: ${type}`));
        }
      }, timeout);

      // Store request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId,
        type,
        startTime: Date.now(),
      });

      // Send message
      try {
        this.worker.postMessage({
          type,
          data,
          requestId,
        });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Check if Web Workers are supported
   */
  isWorkerSupported() {
    return typeof Worker !== "undefined";
  }

  /**
   * Initialize fallback processor
   */
  async initializeFallback(options) {
    try {
      const { FallbackMLProcessor } = await import("./FallbackMLProcessor");
      this.fallbackProcessor = new FallbackMLProcessor();
      await this.fallbackProcessor.initialize(options);
      this.isInitialized = true;

      // Mock capabilities for fallback
      this.workerCapabilities = {
        tensorflow: { version: "fallback", backend: "cpu", ready: true },
        features: {
          mlPredictions: true,
          constraintValidation: true,
          patternRecognition: false,
        },
        memoryManagement: true,
        progressiveProcessing: true,
        method: "fallback",
      };
    } catch (error) {
      console.error("Fallback initialization failed:", error);
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(processingTime, result) {
    this.performanceMetrics.totalProcessedJobs++;

    // Update average processing time
    const totalTime =
      this.performanceMetrics.averageProcessingTime *
        (this.performanceMetrics.totalProcessedJobs - 1) +
      processingTime;
    this.performanceMetrics.averageProcessingTime = Math.round(
      totalTime / this.performanceMetrics.totalProcessedJobs,
    );

    // Track errors
    if (result && result.error) {
      this.performanceMetrics.errorCount++;
    }
  }

  /**
   * Setup periodic memory cleanup
   */
  setupPeriodicCleanup() {
    // Cleanup every 5 minutes
    this.cleanupTimer = setInterval(
      async () => {
        if (this.isInitialized && !this.isProcessing) {
          try {
            await this.performMemoryCleanup();
          } catch (error) {
            console.warn("Periodic cleanup failed:", error);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      capabilities: this.workerCapabilities,
      workerSupported: this.isWorkerSupported(),
    };
  }
}

// Singleton instance
let workerManagerInstance = null;

export function getWorkerManager() {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager();
  }
  return workerManagerInstance;
}

export { WorkerManager };
