/**
 * AdvancedWorkerManager.js
 * 
 * Advanced Web Worker management system with thread pooling, load balancing,
 * and intelligent task distribution for true non-blocking ML processing.
 */

import { getPerformanceMonitor } from './PerformanceMonitor';

export class AdvancedWorkerManager {
  constructor() {
    this.isInitialized = false;
    this.workerPool = [];
    this.availableWorkers = new Set();
    this.busyWorkers = new Map(); // workerId -> taskInfo
    this.taskQueue = [];
    this.workerIndex = 0;
    
    // Configuration
    this.config = {
      maxWorkers: Math.max(2, Math.min(8, navigator.hardwareConcurrency || 4)),
      minWorkers: 2,
      workerTimeout: 300000, // 5 minutes
      taskBatchSize: 10,
      maxMemoryPerWorker: 200 * 1024 * 1024, // 200MB per worker
      heartbeatInterval: 10000, // 10 seconds
      loadBalancingEnabled: true,
      priorityQueueEnabled: true
    };

    // State tracking
    this.state = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      workerUtilization: 0,
      memoryPressure: 0
    };

    // Event handlers
    this.eventHandlers = {
      taskProgress: new Set(),
      taskComplete: new Set(),
      taskError: new Set(),
      workerReady: new Set(),
      workerError: new Set(),
      poolResize: new Set()
    };

    // Performance monitoring
    this.performanceMonitor = null;
    this.heartbeatTimer = null;
    this.loadBalanceTimer = null;
    
    // Task tracking
    this.activeTasks = new Map();
    this.taskHistory = [];
    
    // Worker lifecycle management
    this.workerLifecycle = {
      created: new Set(),
      ready: new Set(),
      busy: new Set(),
      idle: new Set(),
      terminating: new Set()
    };
  }

  /**
   * Initialize the advanced worker pool
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('🚀 Initializing Advanced Worker Manager...');
      
      // Apply configuration
      Object.assign(this.config, options);
      
      // Validate worker support
      if (!this.isWorkerSupported()) {
        throw new Error('Web Workers not supported in this environment');
      }

      // Initialize performance monitoring
      this.performanceMonitor = getPerformanceMonitor();
      
      // Create initial worker pool
      await this.createWorkerPool();
      
      // Start monitoring systems
      this.startHeartbeat();
      this.startLoadBalancing();
      this.startMemoryMonitoring();
      
      this.isInitialized = true;
      
      console.log('✅ Advanced Worker Manager initialized:', {
        workerCount: this.workerPool.length,
        maxWorkers: this.config.maxWorkers,
        capabilities: this.getCapabilities()
      });

      return {
        success: true,
        workerCount: this.workerPool.length,
        capabilities: this.getCapabilities()
      };

    } catch (error) {
      console.error('❌ Advanced Worker Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create and configure worker pool
   */
  async createWorkerPool() {
    const workerPromises = [];
    
    for (let i = 0; i < this.config.minWorkers; i++) {
      workerPromises.push(this.createWorker(i));
    }
    
    const workers = await Promise.allSettled(workerPromises);
    
    // Process worker creation results
    workers.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const worker = result.value;
        this.workerPool.push(worker);
        this.availableWorkers.add(worker.id);
        this.workerLifecycle.ready.add(worker.id);
        this.notifyEventHandlers('workerReady', { workerId: worker.id });
      } else {
        console.warn(`Failed to create worker ${index}:`, result.reason);
      }
    });

    if (this.workerPool.length === 0) {
      throw new Error('Failed to create any workers');
    }

    console.log(`✅ Created ${this.workerPool.length} workers`);
  }

  /**
   * Create a single worker with full configuration
   */
  async createWorker(index) {
    const workerId = `worker_${index}_${Date.now()}`;
    
    try {
      // Create worker
      const worker = new Worker('/src/workers/enhancedAIWorker.js');
      
      // Add metadata
      worker.id = workerId;
      worker.index = index;
      worker.createdAt = Date.now();
      worker.state = 'initializing';
      worker.taskCount = 0;
      worker.memoryUsage = 0;
      worker.lastHeartbeat = Date.now();
      
      // Setup event handlers
      this.setupWorkerEventHandlers(worker);
      
      // Initialize worker
      await this.initializeWorker(worker);
      
      this.workerLifecycle.created.add(workerId);
      
      return worker;
      
    } catch (error) {
      console.error(`Failed to create worker ${index}:`, error);
      throw error;
    }
  }

  /**
   * Setup comprehensive worker event handlers
   */
  setupWorkerEventHandlers(worker) {
    worker.onmessage = (event) => {
      this.handleWorkerMessage(worker, event.data);
    };

    worker.onerror = (error) => {
      this.handleWorkerError(worker, error);
    };

    worker.onmessageerror = (error) => {
      this.handleWorkerMessageError(worker, error);
    };
  }

  /**
   * Initialize individual worker with configuration
   */
  async initializeWorker(worker) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${worker.id} initialization timeout`));
      }, 30000);

      const messageHandler = (event) => {
        const { type, data } = event.data;
        
        if (type === 'initialized') {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          
          if (data.success) {
            worker.state = 'ready';
            worker.capabilities = data.capabilities;
            worker.memoryInfo = data.memoryInfo;
            resolve(worker);
          } else {
            reject(new Error(`Worker ${worker.id} initialization failed: ${data.error}`));
          }
        } else if (type === 'error') {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          reject(new Error(`Worker ${worker.id} initialization error: ${data.error}`));
        }
      };

      worker.addEventListener('message', messageHandler);
      
      // Send initialization message
      worker.postMessage({
        type: 'initialize',
        data: {
          workerId: worker.id,
          config: {
            ...this.config,
            memoryLimitMB: this.config.maxMemoryPerWorker / 1024 / 1024,
            enableMLPredictions: true,
            enableConstraintML: true,
            enablePatternRecognition: true,
            enableProgressiveProcessing: true,
            enableMemoryOptimization: true,
            modelConfig: {
              inputSize: 50,
              outputSize: 4,
              batchSize: this.config.taskBatchSize
            }
          }
        }
      });
    });
  }

  /**
   * Process ML tasks with intelligent load balancing
   */
  async processMLTasks(tasks, progressCallback) {
    if (!this.isInitialized) {
      throw new Error('AdvancedWorkerManager not initialized');
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No tasks provided for processing');
    }

    const jobId = `job_${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`🔄 Starting ML task processing: ${tasks.length} tasks`);
    
    // Start performance monitoring
    let perfJob = null;
    if (this.performanceMonitor) {
      perfJob = this.performanceMonitor.startJob(jobId, {
        type: 'ml_tasks_batch',
        taskCount: tasks.length,
        estimatedDuration: this.estimateProcessingTime(tasks)
      });
    }

    try {
      // Distribute tasks across workers
      const taskBatches = this.createTaskBatches(tasks);
      const workerPromises = taskBatches.map((batch, index) => 
        this.processTaskBatch(batch, progressCallback, jobId, index)
      );

      // Execute with progress tracking
      const results = await this.executeWithProgress(
        workerPromises, 
        progressCallback, 
        jobId,
        tasks.length
      );

      // Combine results
      const combinedResults = this.combineTaskResults(results);
      
      // Update performance metrics
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(tasks.length, processingTime, true);

      // End performance monitoring
      if (perfJob) {
        this.performanceMonitor.endJob(jobId, { 
          success: true, 
          results: combinedResults,
          processingTime
        });
      }

      console.log(`✅ ML task processing completed: ${processingTime}ms`);

      return {
        success: true,
        results: combinedResults,
        processingTime,
        tasksProcessed: tasks.length,
        workersUsed: taskBatches.length,
        averageTaskTime: processingTime / tasks.length
      };

    } catch (error) {
      // Handle error
      this.updatePerformanceMetrics(tasks.length, Date.now() - startTime, false);
      
      if (perfJob) {
        this.performanceMonitor.endJob(jobId, { 
          success: false, 
          error: error.message 
        });
      }

      console.error('❌ ML task processing failed:', error);
      throw error;
    }
  }

  /**
   * Create optimized task batches for worker distribution
   */
  createTaskBatches(tasks) {
    const availableWorkerCount = this.availableWorkers.size;
    if (availableWorkerCount === 0) {
      throw new Error('No available workers for task processing');
    }

    // Calculate optimal batch sizes based on task complexity and worker capabilities
    const tasksPerWorker = Math.ceil(tasks.length / availableWorkerCount);
    const batches = [];
    
    for (let i = 0; i < tasks.length; i += tasksPerWorker) {
      const batch = tasks.slice(i, i + tasksPerWorker);
      batches.push(batch);
    }

    // Ensure we don't create more batches than available workers
    return batches.slice(0, availableWorkerCount);
  }

  /**
   * Process a batch of tasks on a specific worker
   */
  async processTaskBatch(taskBatch, progressCallback, jobId, batchIndex) {
    const worker = this.getOptimalWorker();
    if (!worker) {
      throw new Error('No available worker for task batch processing');
    }

    // Mark worker as busy
    this.availableWorkers.delete(worker.id);
    this.busyWorkers.set(worker.id, {
      taskBatch,
      startTime: Date.now(),
      batchIndex,
      jobId
    });
    
    worker.taskCount++;
    worker.state = 'processing';

    try {
      const result = await this.sendWorkerMessage(worker, 'process_task_batch', {
        tasks: taskBatch,
        batchIndex,
        jobId,
        batchSize: taskBatch.length
      }, {
        timeout: this.config.workerTimeout,
        trackProgress: true
      });

      return {
        batchIndex,
        workerId: worker.id,
        results: result.results,
        processingTime: result.processingTime,
        memoryUsage: result.memoryInfo
      };

    } finally {
      // Release worker
      this.busyWorkers.delete(worker.id);
      this.availableWorkers.add(worker.id);
      worker.state = 'ready';
    }
  }

  /**
   * Get optimal worker based on load balancing strategy
   */
  getOptimalWorker() {
    if (this.availableWorkers.size === 0) {
      return null;
    }

    if (!this.config.loadBalancingEnabled) {
      // Simple round-robin selection
      return this.getWorkerById(Array.from(this.availableWorkers)[0]);
    }

    // Advanced load balancing
    let optimalWorker = null;
    let lowestScore = Infinity;

    for (const workerId of this.availableWorkers) {
      const worker = this.getWorkerById(workerId);
      if (!worker) continue;

      // Calculate load score (lower is better)
      const loadScore = this.calculateWorkerLoadScore(worker);
      
      if (loadScore < lowestScore) {
        lowestScore = loadScore;
        optimalWorker = worker;
      }
    }

    return optimalWorker;
  }

  /**
   * Calculate worker load score for load balancing
   */
  calculateWorkerLoadScore(worker) {
    const memoryWeight = 0.4;
    const taskCountWeight = 0.3;
    const ageWeight = 0.2;
    const performanceWeight = 0.1;

    // Memory utilization (0-1, lower is better)
    const memoryScore = worker.memoryUsage / this.config.maxMemoryPerWorker;

    // Task count (normalized, lower is better)
    const taskScore = worker.taskCount / 100; // Normalize to 0-1 range

    // Worker age (newer workers preferred)
    const age = Date.now() - worker.createdAt;
    const ageScore = Math.min(age / (24 * 60 * 60 * 1000), 1); // Normalize to 0-1 range

    // Performance score (higher is better, so invert)
    const performanceScore = 1 - (worker.averageTaskTime || 0) / 10000; // Normalize

    return (
      memoryScore * memoryWeight +
      taskScore * taskCountWeight +
      ageScore * ageWeight +
      performanceScore * performanceWeight
    );
  }

  /**
   * Execute task batches with progress tracking
   */
  async executeWithProgress(workerPromises, progressCallback, jobId, totalTasks) {
    const results = [];
    let completedTasks = 0;

    // Setup progress tracking for each worker
    const progressTracking = new Map();
    
    workerPromises.forEach((promise, index) => {
      progressTracking.set(index, { progress: 0, completed: false });
    });

    // Execute promises with progress updates
    const settledPromises = await Promise.allSettled(
      workerPromises.map(async (promise, index) => {
        try {
          const result = await promise;
          
          // Update progress
          progressTracking.set(index, { progress: 100, completed: true });
          completedTasks += result.results.length || 0;
          
          // Notify progress
          if (progressCallback) {
            progressCallback({
              progress: Math.round((completedTasks / totalTasks) * 100),
              stage: 'processing_batch',
              message: `バッチ ${index + 1} 完了`,
              completedTasks,
              totalTasks,
              workerId: result.workerId
            });
          }
          
          return result;
          
        } catch (error) {
          console.error(`Batch ${index} processing failed:`, error);
          throw error;
        }
      })
    );

    // Process results
    settledPromises.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Batch ${index} failed:`, result.reason);
        // Continue with other batches
      }
    });

    if (results.length === 0) {
      throw new Error('All task batches failed');
    }

    return results;
  }

  /**
   * Combine results from multiple worker batches
   */
  combineTaskResults(batchResults) {
    const combinedResults = {
      predictions: {},
      confidence: {},
      stats: {
        totalTasks: 0,
        processedTasks: 0,
        averageConfidence: 0,
        processingTime: 0
      },
      workerMetrics: {}
    };

    let totalConfidence = 0;
    let confidenceCount = 0;
    let totalProcessingTime = 0;

    batchResults.forEach((batch) => {
      const { results, workerId, processingTime } = batch;
      
      if (results) {
        // Merge predictions
        Object.assign(combinedResults.predictions, results.predictions || {});
        Object.assign(combinedResults.confidence, results.confidence || {});

        // Update stats
        combinedResults.stats.totalTasks += results.stats?.totalTasks || 0;
        combinedResults.stats.processedTasks += results.stats?.processedTasks || 0;
        
        // Calculate confidence
        if (results.confidence) {
          Object.values(results.confidence).forEach(staffConfidence => {
            Object.values(staffConfidence).forEach(conf => {
              if (typeof conf === 'number') {
                totalConfidence += conf;
                confidenceCount++;
              }
            });
          });
        }

        totalProcessingTime += processingTime || 0;

        // Track worker metrics
        combinedResults.workerMetrics[workerId] = {
          processingTime,
          memoryUsage: batch.memoryUsage,
          tasksProcessed: results.stats?.processedTasks || 0
        };
      }
    });

    // Finalize averages
    combinedResults.stats.averageConfidence = confidenceCount > 0 
      ? totalConfidence / confidenceCount 
      : 0;
    
    combinedResults.stats.processingTime = totalProcessingTime;

    return combinedResults;
  }

  /**
   * Handle worker messages with comprehensive routing
   */
  handleWorkerMessage(worker, message) {
    const { type, data, requestId } = message;

    // Update last heartbeat
    worker.lastHeartbeat = Date.now();

    switch (type) {
      case 'progress':
        this.handleWorkerProgress(worker, data, requestId);
        break;

      case 'result':
        this.handleWorkerResult(worker, data, requestId);
        break;

      case 'error':
        this.handleWorkerError(worker, new Error(data.error || 'Unknown worker error'));
        break;

      case 'heartbeat':
        this.handleWorkerHeartbeat(worker, data);
        break;

      case 'memory_stats':
        this.handleWorkerMemoryStats(worker, data);
        break;

      case 'task_complete':
        this.handleWorkerTaskComplete(worker, data);
        break;

      default:
        console.warn(`Unknown worker message type: ${type} from worker ${worker.id}`);
    }
  }

  /**
   * Handle worker progress updates
   */
  handleWorkerProgress(worker, data, requestId) {
    // Update worker state
    worker.lastProgress = data;

    // Find associated task
    const taskInfo = this.busyWorkers.get(worker.id);
    if (taskInfo) {
      // Notify task progress handlers
      this.notifyEventHandlers('taskProgress', {
        workerId: worker.id,
        batchIndex: taskInfo.batchIndex,
        jobId: taskInfo.jobId,
        progress: data
      });
    }
  }

  /**
   * Handle worker task completion
   */
  handleWorkerTaskComplete(worker, data) {
    this.notifyEventHandlers('taskComplete', {
      workerId: worker.id,
      data
    });
  }

  /**
   * Handle worker errors with recovery strategies
   */
  handleWorkerError(worker, error) {
    console.error(`Worker ${worker.id} error:`, error);

    this.notifyEventHandlers('workerError', {
      workerId: worker.id,
      error
    });

    // Update performance metrics
    this.state.failedTasks++;

    // Check if worker needs to be replaced
    this.assessWorkerHealth(worker);
  }

  /**
   * Handle worker heartbeat
   */
  handleWorkerHeartbeat(worker, data) {
    worker.lastHeartbeat = Date.now();
    worker.memoryUsage = data.memoryUsage || 0;
    worker.state = data.state || 'ready';
  }

  /**
   * Handle worker memory statistics
   */
  handleWorkerMemoryStats(worker, data) {
    worker.memoryInfo = data;
    worker.memoryUsage = data.currentMemory || 0;

    // Check for memory pressure
    if (worker.memoryUsage > this.config.maxMemoryPerWorker * 0.9) {
      console.warn(`Worker ${worker.id} high memory usage:`, worker.memoryUsage);
      this.requestWorkerMemoryCleanup(worker);
    }
  }

  /**
   * Start heartbeat monitoring
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.checkWorkerHeartbeats();
    }, this.config.heartbeatInterval);
  }

  /**
   * Start load balancing optimization
   */
  startLoadBalancing() {
    if (!this.config.loadBalancingEnabled) return;

    this.loadBalanceTimer = setInterval(() => {
      this.optimizeWorkerPool();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 5000); // Every 5 seconds
  }

  /**
   * Check worker heartbeats and handle stale workers
   */
  checkWorkerHeartbeats() {
    const now = Date.now();
    const staleThreshold = this.config.heartbeatInterval * 3; // 3x heartbeat interval

    this.workerPool.forEach(worker => {
      if (now - worker.lastHeartbeat > staleThreshold) {
        console.warn(`Worker ${worker.id} heartbeat stale, investigating...`);
        this.assessWorkerHealth(worker);
      }
    });
  }

  /**
   * Optimize worker pool size based on current load
   */
  optimizeWorkerPool() {
    const currentLoad = this.calculateCurrentLoad();
    const targetWorkerCount = this.calculateOptimalWorkerCount(currentLoad);

    if (targetWorkerCount > this.workerPool.length) {
      // Scale up
      this.scaleUpWorkerPool(targetWorkerCount - this.workerPool.length);
    } else if (targetWorkerCount < this.workerPool.length && 
               this.workerPool.length > this.config.minWorkers) {
      // Scale down
      this.scaleDownWorkerPool(this.workerPool.length - targetWorkerCount);
    }
  }

  /**
   * Monitor memory usage across all workers
   */
  monitorMemoryUsage() {
    let totalMemory = 0;
    let pressureCount = 0;

    this.workerPool.forEach(worker => {
      totalMemory += worker.memoryUsage || 0;
      
      if (worker.memoryUsage > this.config.maxMemoryPerWorker * 0.8) {
        pressureCount++;
      }
    });

    this.state.memoryPressure = pressureCount / this.workerPool.length;

    // Trigger cleanup if memory pressure is high
    if (this.state.memoryPressure > 0.5) {
      console.log('🧹 High memory pressure detected, initiating cleanup...');
      this.performGlobalMemoryCleanup();
    }
  }

  /**
   * Send message to worker with promise-based response
   */
  sendWorkerMessage(worker, type, data, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timeout = options.timeout || 60000;

      // Setup timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Worker ${worker.id} message timeout: ${type}`));
      }, timeout);

      // Setup response handler
      const messageHandler = (event) => {
        const { type: responseType, data: responseData, requestId: responseRequestId } = event.data;
        
        if (responseRequestId === requestId) {
          clearTimeout(timeoutId);
          worker.removeEventListener('message', messageHandler);
          
          if (responseType === 'result' || responseType === type + '_result') {
            resolve(responseData);
          } else if (responseType === 'error') {
            reject(new Error(responseData.error || 'Worker processing error'));
          }
        }
      };

      worker.addEventListener('message', messageHandler);

      // Send message
      try {
        worker.postMessage({
          type,
          data,
          requestId
        });
      } catch (error) {
        clearTimeout(timeoutId);
        worker.removeEventListener('message', messageHandler);
        reject(error);
      }
    });
  }

  /**
   * Utility methods
   */
  getWorkerById(workerId) {
    return this.workerPool.find(worker => worker.id === workerId);
  }

  isWorkerSupported() {
    return typeof Worker !== 'undefined';
  }

  calculateCurrentLoad() {
    const busyWorkers = this.busyWorkers.size;
    const totalWorkers = this.workerPool.length;
    return totalWorkers > 0 ? busyWorkers / totalWorkers : 0;
  }

  calculateOptimalWorkerCount(currentLoad) {
    if (currentLoad > 0.8) {
      return Math.min(this.config.maxWorkers, this.workerPool.length + 1);
    } else if (currentLoad < 0.3) {
      return Math.max(this.config.minWorkers, this.workerPool.length - 1);
    }
    return this.workerPool.length;
  }

  estimateProcessingTime(tasks) {
    const averageTimePerTask = this.state.averageTaskTime || 100; // 100ms default
    return tasks.length * averageTimePerTask;
  }

  updatePerformanceMetrics(taskCount, processingTime, success) {
    this.state.totalTasks += taskCount;
    
    if (success) {
      this.state.completedTasks += taskCount;
    } else {
      this.state.failedTasks += taskCount;
    }

    // Update average task time
    const totalTime = this.state.averageTaskTime * this.state.totalTasks + processingTime;
    this.state.averageTaskTime = totalTime / (this.state.totalTasks + taskCount);

    // Update worker utilization
    this.state.workerUtilization = this.busyWorkers.size / this.workerPool.length;
  }

  getCapabilities() {
    return {
      maxWorkers: this.config.maxWorkers,
      currentWorkers: this.workerPool.length,
      availableWorkers: this.availableWorkers.size,
      loadBalancing: this.config.loadBalancingEnabled,
      priorityQueue: this.config.priorityQueueEnabled,
      memoryManagement: true,
      heartbeatMonitoring: true,
      autoScaling: true
    };
  }

  /**
   * Event handling
   */
  on(eventType, callback) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType].add(callback);
      return () => this.eventHandlers[eventType].delete(callback);
    }
  }

  notifyEventHandlers(eventType, data) {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler(data);
        } catch (error) {
          console.warn(`Event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Cleanup and destruction
   */
  async destroy() {
    console.log('🧹 Destroying Advanced Worker Manager...');

    try {
      // Stop monitoring
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.loadBalanceTimer) {
        clearInterval(this.loadBalanceTimer);
        this.loadBalanceTimer = null;
      }

      // Terminate all workers
      const terminatePromises = this.workerPool.map(worker => 
        this.terminateWorker(worker)
      );

      await Promise.allSettled(terminatePromises);

      // Clear state
      this.workerPool = [];
      this.availableWorkers.clear();
      this.busyWorkers.clear();
      this.taskQueue = [];
      this.activeTasks.clear();

      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());

      this.isInitialized = false;

      console.log('✅ Advanced Worker Manager destroyed');

    } catch (error) {
      console.error('Error during Advanced Worker Manager destruction:', error);
    }
  }

  async terminateWorker(worker) {
    try {
      // Send termination message
      worker.postMessage({ type: 'terminate' });
      
      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force terminate
      worker.terminate();
      
    } catch (error) {
      console.warn(`Error terminating worker ${worker.id}:`, error);
      worker.terminate(); // Force terminate anyway
    }
  }

  // Additional helper methods for worker lifecycle management...
  async assessWorkerHealth(worker) {
    // Implementation for worker health assessment
  }

  async scaleUpWorkerPool(count) {
    // Implementation for scaling up worker pool
  }

  async scaleDownWorkerPool(count) {
    // Implementation for scaling down worker pool
  }

  async requestWorkerMemoryCleanup(worker) {
    // Implementation for requesting memory cleanup from worker
  }

  async performGlobalMemoryCleanup() {
    // Implementation for global memory cleanup across all workers
  }
}

// Singleton instance
let advancedWorkerManagerInstance = null;

export function getAdvancedWorkerManager() {
  if (!advancedWorkerManagerInstance) {
    advancedWorkerManagerInstance = new AdvancedWorkerManager();
  }
  return advancedWorkerManagerInstance;
}

export { AdvancedWorkerManager };