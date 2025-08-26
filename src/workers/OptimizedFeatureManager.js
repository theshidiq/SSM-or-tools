/**
 * Optimized Feature Manager
 * 
 * Manages high-performance feature generation with Web Worker
 * Target: <50ms per prediction
 */

class OptimizedFeatureManager {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    
    // Performance tracking
    this.performanceStats = {
      totalPredictions: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
      under50msCount: 0,
      successRate: 0
    };
    
    this.initPromise = null;
  }
  
  /**
   * Initialize the Web Worker
   */
  async initialize() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create the worker from our optimized script in public directory
        this.worker = new Worker('/workers/featureGenerationWorker.js', {
          type: 'module'
        });
        
        this.worker.onmessage = (event) => this.handleWorkerMessage(event);
        this.worker.onerror = (error) => {
          console.error('❌ Feature generation worker error:', error);
          reject(error);
        };
        
        // Initialize the worker
        const initId = this.generateRequestId();
        this.pendingRequests.set(initId, { resolve, reject, type: 'INIT' });
        
        this.worker.postMessage({
          type: 'INIT',
          id: initId
        });
        
        console.log('🚀 Initializing optimized feature generation worker...');
        
      } catch (error) {
        console.error('❌ Failed to create feature generation worker:', error);
        reject(error);
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Generate features for a single prediction (target: <50ms)
   */
  async generateFeatures(params) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();
      
      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          const endTime = performance.now();
          const executionTime = endTime - startTime;
          
          // Update performance stats
          this.updatePerformanceStats(executionTime, result.success);
          
          resolve({
            ...result,
            totalTime: executionTime
          });
        },
        reject,
        type: 'GENERATE_FEATURES',
        startTime
      });
      
      this.worker.postMessage({
        type: 'GENERATE_FEATURES',
        id: requestId,
        data: params
      });
    });
  }
  
  /**
   * Generate features for multiple predictions in batch
   * With progress updates for better UX
   */
  async generateFeaturesBatch(paramsList, onProgress) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();
      let progressCallback = onProgress;
      
      this.pendingRequests.set(requestId, {
        resolve: (results) => {
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          
          // Update batch performance stats
          results.forEach(result => {
            this.updatePerformanceStats(result.executionTime, result.success);
          });
          
          resolve({
            results,
            totalTime,
            avgTimePerPrediction: totalTime / paramsList.length
          });
        },
        reject,
        type: 'BATCH_GENERATE_FEATURES',
        startTime,
        onProgress: progressCallback
      });
      
      this.worker.postMessage({
        type: 'BATCH_GENERATE_FEATURES',
        id: requestId,
        data: {
          requests: paramsList
        }
      });
    });
  }
  
  /**
   * Handle messages from the Web Worker
   */
  handleWorkerMessage(event) {
    const { type, id, result, results, progress, success, error } = event.data;
    const request = this.pendingRequests.get(id);
    
    if (!request) {
      console.warn('⚠️ Received message for unknown request:', id);
      return;
    }
    
    switch (type) {
      case 'INIT_COMPLETE':
        this.isInitialized = true;
        console.log('✅ Optimized feature generation worker initialized');
        request.resolve();
        this.pendingRequests.delete(id);
        break;
        
      case 'FEATURES_GENERATED':
        request.resolve(result);
        this.pendingRequests.delete(id);
        break;
        
      case 'BATCH_PROGRESS':
        if (request.onProgress) {
          request.onProgress(progress);
        }
        break;
        
      case 'BATCH_COMPLETE':
        request.resolve(results);
        this.pendingRequests.delete(id);
        break;
        
      case 'CACHE_CLEARED':
        console.log('🧹 Feature generation cache cleared');
        if (request.resolve) request.resolve();
        this.pendingRequests.delete(id);
        break;
        
      case 'ERROR':
        console.error('❌ Worker error:', error);
        request.reject(new Error(error));
        this.pendingRequests.delete(id);
        break;
        
      default:
        console.warn('⚠️ Unknown worker message type:', type);
    }
  }
  
  /**
   * Update performance statistics
   */
  updatePerformanceStats(executionTime, success) {
    this.performanceStats.totalPredictions++;
    
    if (success) {
      this.performanceStats.totalTime += executionTime;
      this.performanceStats.maxTime = Math.max(this.performanceStats.maxTime, executionTime);
      this.performanceStats.minTime = Math.min(this.performanceStats.minTime, executionTime);
      this.performanceStats.avgTime = this.performanceStats.totalTime / this.performanceStats.totalPredictions;
      
      if (executionTime < 50) {
        this.performanceStats.under50msCount++;
      }
    }
    
    this.performanceStats.successRate = (this.performanceStats.totalPredictions > 0) 
      ? (this.performanceStats.under50msCount / this.performanceStats.totalPredictions * 100)
      : 0;
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      under50msPercentage: (this.performanceStats.totalPredictions > 0) 
        ? (this.performanceStats.under50msCount / this.performanceStats.totalPredictions * 100).toFixed(1)
        : '0.0'
    };
  }
  
  /**
   * Clear caches in the worker
   */
  async clearCache() {
    if (!this.isInitialized) return;
    
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        type: 'CLEAR_CACHE'
      });
      
      this.worker.postMessage({
        type: 'CLEAR_CACHE',
        id: requestId
      });
    });
  }
  
  /**
   * Log performance summary
   */
  logPerformanceSummary() {
    const stats = this.getPerformanceStats();
    
    console.log('📊 Optimized Feature Generation Performance Summary:');
    console.log(`  Total predictions: ${stats.totalPredictions}`);
    console.log(`  Average time: ${stats.avgTime.toFixed(1)}ms`);
    console.log(`  Min time: ${stats.minTime === Infinity ? 'N/A' : stats.minTime.toFixed(1)}ms`);
    console.log(`  Max time: ${stats.maxTime.toFixed(1)}ms`);
    console.log(`  Under 50ms: ${stats.under50msCount}/${stats.totalPredictions} (${stats.under50msPercentage}%)`);
    
    if (stats.avgTime > 50) {
      console.warn('⚠️ Average time exceeds 50ms target');
    } else {
      console.log('✅ Performance target achieved!');
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.pendingRequests.clear();
    this.isInitialized = false;
    console.log('🧹 Optimized feature manager destroyed');
  }
  
  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }
}

// Singleton instance
export const optimizedFeatureManager = new OptimizedFeatureManager();
export default OptimizedFeatureManager;