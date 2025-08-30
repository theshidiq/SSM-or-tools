/**
 * MLWorkerManager.js
 *
 * Manages communication with ML Web Worker to prevent main thread blocking
 * during heavy TensorFlow operations.
 */

export class MLWorkerManager {
  constructor() {
    this.worker = null;
    this.initialized = false;
    this.operationCounter = 0;
    this.pendingOperations = new Map();
    this.progressCallbacks = new Map();
    this.isSupported = typeof Worker !== "undefined";

    // Initialize worker if supported
    if (this.isSupported) {
      this.initializeWorker();
    }
  }

  /**
   * Initialize the ML web worker
   */
  async initializeWorker() {
    try {
      // Create worker from URL
      const workerUrl = new URL("./mlWorker.js", import.meta.url);
      this.worker = new Worker(workerUrl);

      // Set up message handling
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Initialize TensorFlow in worker
      const initResult = await this.sendMessage("INITIALIZE", {});
      this.initialized = initResult.success;

      // ML Worker initialized
      return this.initialized;
    } catch (error) {
      console.warn("⚠️ ML Worker initialization failed:", error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Handle messages from worker
   */
  handleWorkerMessage(event) {
    const { type, id, success, result, error, progress, status } = event.data;

    switch (type) {
      case "WORKER_READY":
        // ML Worker is ready
        break;

      case "INITIALIZATION_COMPLETE":
        this.resolveOperation(id, { success, error });
        break;

      case "OPERATION_COMPLETE":
        this.resolveOperation(id, { success, result, error });
        break;

      case "PROGRESS_UPDATE":
      case "TRAINING_PROGRESS":
        this.handleProgressUpdate(progress, event.data);
        break;

      case "STATUS_RESPONSE":
        this.resolveOperation(id, { success: true, result: status });
        break;

      case "ERROR":
        console.error("❌ ML Worker error:", error);
        this.resolveOperation(id, { success: false, error });
        break;
    }
  }

  /**
   * Handle worker errors
   */
  handleWorkerError(error) {
    console.error("❌ ML Worker error:", error);
    this.initialized = false;

    // Reject all pending operations
    this.pendingOperations.forEach((operation) => {
      operation.reject(new Error("Worker error: " + error.message));
    });
    this.pendingOperations.clear();
  }

  /**
   * Handle progress updates
   */
  handleProgressUpdate(progress, data) {
    // Call progress callbacks for all active operations
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress, data);
      } catch (error) {
        console.warn("Progress callback error:", error);
      }
    });
  }

  /**
   * Send message to worker with promise-based response
   */
  async sendMessage(type, data, progressCallback = null) {
    if (!this.isSupported || !this.worker) {
      throw new Error("ML Worker not supported or not available");
    }

    return new Promise((resolve, reject) => {
      const id = `op_${++this.operationCounter}`;

      // Store operation promise
      this.pendingOperations.set(id, { resolve, reject });

      // Store progress callback if provided
      if (progressCallback) {
        this.progressCallbacks.set(id, progressCallback);
      }

      // Send message to worker
      this.worker.postMessage({ type, data, id });

      // Set timeout for operation
      setTimeout(() => {
        if (this.pendingOperations.has(id)) {
          this.pendingOperations.delete(id);
          this.progressCallbacks.delete(id);
          reject(new Error("Operation timeout"));
        }
      }, 60000); // 60 second timeout
    });
  }

  /**
   * Resolve pending operation
   */
  resolveOperation(id, result) {
    if (this.pendingOperations.has(id)) {
      const { resolve, reject } = this.pendingOperations.get(id);
      this.pendingOperations.delete(id);
      this.progressCallbacks.delete(id);

      if (result.success) {
        resolve(result.result || result);
      } else {
        reject(new Error(result.error || "Operation failed"));
      }
    }
  }

  /**
   * Perform batch predictions using worker
   */
  async performBatchPredictions(
    features,
    modelData = null,
    progressCallback = null,
  ) {
    if (!this.isSupported || !this.initialized) {
      throw new Error("ML Worker not available - falling back to main thread");
    }

    try {
      const result = await this.sendMessage(
        "QUEUE_OPERATION",
        {
          operationType: "PREDICT_BATCH",
          operationData: { features, modelData },
        },
        progressCallback,
      );

      return result;
    } catch (error) {
      console.warn(
        "🔄 Worker prediction failed, falling back to main thread:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Train model using worker
   */
  async trainModel(trainingData, modelConfig = {}, progressCallback = null) {
    if (!this.isSupported || !this.initialized) {
      throw new Error("ML Worker not available - falling back to main thread");
    }

    try {
      const result = await this.sendMessage(
        "QUEUE_OPERATION",
        {
          operationType: "TRAIN_MODEL",
          operationData: { trainingData, modelConfig },
        },
        progressCallback,
      );

      return result;
    } catch (error) {
      console.warn(
        "🔄 Worker training failed, falling back to main thread:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Generate features using worker
   */
  async generateFeatures(featureData, progressCallback = null) {
    if (!this.isSupported || !this.initialized) {
      throw new Error("ML Worker not available - falling back to main thread");
    }

    try {
      const result = await this.sendMessage(
        "QUEUE_OPERATION",
        {
          operationType: "FEATURE_GENERATION",
          operationData: { featureData },
        },
        progressCallback,
      );

      return result;
    } catch (error) {
      console.warn(
        "🔄 Worker feature generation failed, falling back to main thread:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get worker status
   */
  async getWorkerStatus() {
    if (!this.isSupported || !this.initialized) {
      return {
        supported: false,
        initialized: false,
        available: false,
      };
    }

    try {
      const status = await this.sendMessage("GET_STATUS", {});
      return {
        supported: true,
        initialized: this.initialized,
        available: true,
        ...status,
      };
    } catch (error) {
      return {
        supported: true,
        initialized: false,
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if worker is available and ready
   */
  isReady() {
    return this.isSupported && this.initialized && this.worker;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      // Send termination message
      try {
        this.worker.postMessage({ type: "TERMINATE" });
      } catch (error) {
        console.warn("Error sending termination message:", error);
      }

      // Terminate worker
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;

      // Clear pending operations
      this.pendingOperations.forEach(({ reject }) => {
        reject(new Error("Worker terminated"));
      });
      this.pendingOperations.clear();
      this.progressCallbacks.clear();

      // ML Worker terminated
    }
  }

  /**
   * Restart the worker
   */
  async restart() {
    if (this.worker) {
      this.terminate();
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.initializeWorker();
  }
}

// Create singleton instance
export const mlWorkerManager = new MLWorkerManager();
