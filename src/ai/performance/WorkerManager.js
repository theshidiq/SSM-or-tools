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
      fallbackUsage: 0
    };

    // Worker configuration
    this.workerConfig = {
      enableMLPredictions: true,
      enableConstraintML: true,
      enablePatternRecognition: true,
      memoryLimitMB: 400,
      modelConfig: {
        inputSize: 50,
        outputSize: 4
      },
      constraintConfig: {
        enabled: true
      },
      patternConfig: {
        enabled: true
      }
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
        console.warn('🔄 Web Workers not supported, using fallback processor');
        await this.initializeFallback(options);
        return { success: true, fallback: true };
      }

      // Create worker
      this.worker = new Worker('/src/workers/aiWorker.js');
      this.setupWorkerEventListeners();

      // Initialize worker with configuration
      const config = {
        ...this.workerConfig,
        ...options,
        restaurantId: options.restaurantId
      };

      const initResult = await this.sendWorkerMessage('initialize', config, {
        timeout: 30000,
        trackProgress: true
      });

      if (initResult.success) {
        this.isInitialized = true;
        this.workerCapabilities = initResult.capabilities;
        this.performanceMetrics.workerInitTime = Date.now() - startTime;

        console.log('✅ AI Worker initialized successfully:', {
          initTime: this.performanceMetrics.workerInitTime + 'ms',
          capabilities: this.workerCapabilities
        });

        return { success: true, capabilities: this.workerCapabilities };
      } else {
        throw new Error('Worker initialization failed');
      }

    } catch (error) {
      console.error('❌ Worker initialization failed, using fallback:', error);
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
      throw new Error('WorkerManager not initialized');
    }

    if (this.isProcessing) {
      throw new Error('Another ML processing job is already running');
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
        throw new Error('No processing method available');
      }

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(processingTime, result);

      return {
        ...result,
        processingTime,
        method: this.worker ? 'worker' : 'fallback',
        memoryInfo: result.memoryInfo || {}
      };

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process using web worker
   */
  async processWithWorker(data, progressCallback) {
    const requestId = this.generateRequestId();
    
    // Register progress callback
    if (progressCallback) {
      this.progressCallbacks.set(requestId, progressCallback);
    }

    try {
      const result = await this.sendWorkerMessage('process_ml_predictions', data, {
        requestId,
        timeout: 300000, // 5 minutes max
        trackProgress: true
      });

      return result;

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
      const { FallbackMLProcessor } = await import('./FallbackMLProcessor');
      this.fallbackProcessor = new FallbackMLProcessor();
    }

    return await this.fallbackProcessor.process(data, progressCallback);
  }

  /**
   * Cancel current processing
   */
  async cancelProcessing() {
    if (!this.isProcessing) {
      return { success: false, reason: 'No processing to cancel' };
    }

    try {
      if (this.worker) {
        await this.sendWorkerMessage('cancel', {}, { timeout: 5000 });
      } else if (this.fallbackProcessor) {
        this.fallbackProcessor.cancel();
      }

      this.isProcessing = false;
      return { success: true };

    } catch (error) {
      console.error('Failed to cancel processing:', error);
      return { success: false, error: error.message };
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
        return await this.sendWorkerMessage('get_status', {}, { timeout: 5000 });
      } else {
        return {
          initialized: true,
          processing: { isProcessing: this.isProcessing },
          method: 'fallback',
          capabilities: this.workerCapabilities,
          performanceMetrics: this.performanceMetrics
        };
      }
    } catch (error) {
      return {
        initialized: this.isInitialized,
        error: error.message,
        performanceMetrics: this.performanceMetrics
      };
    }
  }

  /**
   * Perform manual memory cleanup
   */
  async performMemoryCleanup() {
    try {
      if (this.worker) {
        const result = await this.sendWorkerMessage('cleanup_memory', {}, { timeout: 10000 });
        this.performanceMetrics.memoryCleanups++;
        return result;
      } else if (this.fallbackProcessor) {
        return await this.fallbackProcessor.performMemoryCleanup();
      }
    } catch (error) {
      console.warn('Memory cleanup failed:', error);
      return { success: false, error: error.message };
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

      console.log('🧹 WorkerManager destroyed successfully');
      return { success: true };

    } catch (error) {
      console.error('Error destroying WorkerManager:', error);
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
        case 'progress':
          this.handleProgressUpdate(requestId, data);
          break;

        case 'result':
          this.handleWorkerResult(requestId, data);
          break;

        case 'error':
          this.handleWorkerError(requestId, data);
          break;

        case 'initialized':
          this.handleWorkerInitialized(data);
          break;

        case 'cancelled':
          this.handleWorkerCancelled(data);
          break;

        case 'memory_cleanup':
          this.handleMemoryCleanup(data);
          break;

        case 'status':
          this.handleStatusResponse(requestId, data);
          break;

        default:
          console.warn('Unknown worker message type:', type);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
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
      if (typeof callback === 'function') {
        try {
          callback(data);
        } catch (error) {
          console.warn('Progress callback error:', error);
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
      
      request.reject(new Error(data.error || 'Worker processing error'));
    }
  }

  /**
   * Handle worker initialized response
   */
  handleWorkerInitialized(data) {
    if (data.success) {
      this.workerCapabilities = data.capabilities;
      console.log('🚀 Worker capabilities loaded:', this.workerCapabilities);
    }
  }

  /**
   * Handle worker cancellation
   */
  handleWorkerCancelled(data) {
    console.log('⏹️ Worker processing cancelled:', data);
  }

  /**
   * Handle memory cleanup notification
   */
  handleMemoryCleanup(data) {
    console.log('🧹 Worker memory cleanup:', {
      cleaned: Math.round(data.cleanedBytes / 1024 / 1024) + 'MB',
      current: Math.round(data.currentMemory / 1024 / 1024) + 'MB',
      tensors: data.currentTensors
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
        startTime: Date.now()
      });

      // Send message
      try {
        this.worker.postMessage({
          type,
          data,
          requestId
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
    return typeof Worker !== 'undefined';
  }

  /**
   * Initialize fallback processor
   */
  async initializeFallback(options) {
    try {
      const { FallbackMLProcessor } = await import('./FallbackMLProcessor');
      this.fallbackProcessor = new FallbackMLProcessor();
      await this.fallbackProcessor.initialize(options);
      this.isInitialized = true;
      
      // Mock capabilities for fallback
      this.workerCapabilities = {
        tensorflow: { version: 'fallback', backend: 'cpu', ready: true },
        features: {
          mlPredictions: true,
          constraintValidation: true,
          patternRecognition: false
        },
        memoryManagement: true,
        progressiveProcessing: true,
        method: 'fallback'
      };
      
    } catch (error) {
      console.error('Fallback initialization failed:', error);
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(processingTime, result) {
    this.performanceMetrics.totalProcessedJobs++;
    
    // Update average processing time
    const totalTime = (this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.totalProcessedJobs - 1)) + processingTime;
    this.performanceMetrics.averageProcessingTime = Math.round(totalTime / this.performanceMetrics.totalProcessedJobs);
    
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
    this.cleanupTimer = setInterval(async () => {
      if (this.isInitialized && !this.isProcessing) {
        try {
          await this.performMemoryCleanup();
        } catch (error) {
          console.warn('Periodic cleanup failed:', error);
        }
      }
    }, 5 * 60 * 1000);
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
      workerSupported: this.isWorkerSupported()
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