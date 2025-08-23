/**
 * StreamingMLProcessor.js
 * 
 * Advanced streaming ML processor that delivers real-time results,
 * maintains UI responsiveness, and provides progressive updates
 * during complex ML processing operations.
 */

import { getUIResponsivenessMonitor } from './UIResponsivenessMonitor';
import { getEnhancedTensorMemoryManager } from './EnhancedTensorMemoryManager';

export class StreamingMLProcessor {
  constructor() {
    this.isInitialized = false;
    this.isProcessing = false;
    
    // Streaming configuration
    this.config = {
      chunkSize: 10,              // Process N items per chunk
      maxChunksPerBatch: 5,       // Max chunks per batch before yielding
      yieldTimeMs: 4,             // Time to yield between batches
      progressThrottleMs: 100,    // Min time between progress updates
      resultBufferSize: 50,       // Max results to buffer before streaming
      adaptiveChunking: true,     // Adjust chunk size based on performance
      priorityProcessing: true,   // Process high-priority items first
      streamingEnabled: true      // Enable real-time result streaming
    };

    // Processing state
    this.processingState = {
      totalItems: 0,
      processedItems: 0,
      currentChunk: 0,
      currentBatch: 0,
      startTime: 0,
      lastProgressTime: 0,
      lastYieldTime: 0,
      avgProcessingTime: 0,
      estimatedTimeRemaining: 0,
      currentJobId: null
    };

    // Streaming state
    this.streamingState = {
      activeStreams: new Map(),     // streamId -> streamInfo
      resultBuffer: [],             // Buffered results waiting to be streamed
      subscribers: new Map(),       // streamId -> Set<callback>
      streamMetrics: new Map(),     // streamId -> metrics
      totalStreams: 0,
      totalResultsStreamed: 0
    };

    // Adaptive processing parameters
    this.adaptiveParams = {
      baseChunkSize: 10,
      minChunkSize: 2,
      maxChunkSize: 50,
      performanceWindow: 10,        // Number of chunks to average for adaptation
      recentPerformance: [],        // Recent chunk processing times
      targetProcessingTime: 16,     // Target time per chunk (ms)
      adaptationFactor: 1.2         // Factor for chunk size adjustments
    };

    // Priority queue system
    this.priorityQueue = {
      high: [],      // Critical items (user interactions, visible data)
      normal: [],    // Standard processing items
      low: [],       // Background processing items
      processing: new Set() // Items currently being processed
    };

    // Performance monitoring integration
    this.uiMonitor = null;
    this.memoryManager = null;

    // Event handlers
    this.eventHandlers = {
      streamStart: new Set(),
      streamProgress: new Set(),
      streamResult: new Set(),
      streamComplete: new Set(),
      streamError: new Set(),
      chunkComplete: new Set(),
      adaptationChange: new Set()
    };

    // Processing workers and utilities
    this.processors = new Map();
    this.processingQueue = [];
    this.rafHandle = null;
  }

  /**
   * Initialize the streaming ML processor
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('🌊 Initializing Streaming ML Processor...');

      // Apply configuration
      Object.assign(this.config, options.config || {});
      Object.assign(this.adaptiveParams, options.adaptiveParams || {});

      // Initialize performance monitoring
      this.uiMonitor = getUIResponsivenessMonitor();
      if (!this.uiMonitor.isInitialized) {
        await this.uiMonitor.initialize();
      }

      // Initialize memory management
      this.memoryManager = getEnhancedTensorMemoryManager();
      if (!this.memoryManager.isInitialized) {
        await this.memoryManager.initialize();
      }

      // Setup adaptive processing based on UI performance
      this.setupAdaptiveProcessing();

      // Setup streaming pipeline
      this.setupStreamingPipeline();

      // Setup performance integration
      this.setupPerformanceIntegration();

      this.isInitialized = true;

      console.log('✅ Streaming ML Processor initialized:', {
        chunkSize: this.config.chunkSize,
        adaptiveChunking: this.config.adaptiveChunking,
        streamingEnabled: this.config.streamingEnabled
      });

      return {
        success: true,
        configuration: this.config,
        adaptiveParams: this.adaptiveParams
      };

    } catch (error) {
      console.error('❌ Streaming ML Processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup adaptive processing based on UI performance feedback
   */
  setupAdaptiveProcessing() {
    // Listen to UI responsiveness changes
    this.uiMonitor.on('optimizationChange', (data) => {
      this.adjustProcessingParameters(data);
    });

    this.uiMonitor.on('frameAlert', (data) => {
      if (data.type === 'critical') {
        this.enableEmergencyMode();
      }
    });

    // Monitor memory pressure
    this.memoryManager.onMemoryPressure('high', (data) => {
      this.reduceProcessingIntensity();
    });

    this.memoryManager.onMemoryPressure('critical', (data) => {
      this.enableMemoryConservationMode();
    });
  }

  /**
   * Setup streaming pipeline for real-time result delivery
   */
  setupStreamingPipeline() {
    // Setup result buffer processing
    setInterval(() => {
      this.processResultBuffer();
    }, this.config.progressThrottleMs);

    // Setup stream health monitoring
    setInterval(() => {
      this.monitorStreamHealth();
    }, 5000); // Every 5 seconds
  }

  /**
   * Setup performance integration with monitoring systems
   */
  setupPerformanceIntegration() {
    // Get optimization parameters from UI monitor
    setInterval(() => {
      if (this.isProcessing) {
        const params = this.uiMonitor.getOptimizationParameters();
        this.updateFromUIOptimization(params);
      }
    }, 1000);
  }

  /**
   * Start streaming ML processing
   */
  async startStreamingProcessing(streamId, data, progressCallback, options = {}) {
    if (!this.isInitialized) {
      throw new Error('StreamingMLProcessor not initialized');
    }

    if (this.streamingState.activeStreams.has(streamId)) {
      throw new Error(`Stream ${streamId} already active`);
    }

    try {
      console.log(`🌊 Starting streaming processing: ${streamId}`);

      // Create stream info
      const streamInfo = {
        id: streamId,
        startTime: Date.now(),
        totalItems: data.items?.length || 0,
        processedItems: 0,
        options: { ...options },
        progressCallback,
        status: 'active',
        priority: options.priority || 'normal',
        results: [],
        metrics: {
          chunksProcessed: 0,
          averageChunkTime: 0,
          totalProcessingTime: 0,
          memoryUsage: 0,
          adaptationEvents: 0
        }
      };

      // Register stream
      this.streamingState.activeStreams.set(streamId, streamInfo);
      this.streamingState.totalStreams++;

      // Fire stream start event
      this.fireEvent('streamStart', {
        streamId,
        totalItems: streamInfo.totalItems,
        priority: streamInfo.priority
      });

      // Prepare processing queue with priority handling
      const processingItems = this.prepareProcessingQueue(data, streamInfo);

      // Start adaptive streaming processing
      const result = await this.processStreamWithAdaptiveChunking(
        streamId,
        processingItems,
        streamInfo
      );

      // Complete stream
      streamInfo.status = 'completed';
      streamInfo.endTime = Date.now();
      streamInfo.totalTime = streamInfo.endTime - streamInfo.startTime;

      // Fire completion event
      this.fireEvent('streamComplete', {
        streamId,
        totalTime: streamInfo.totalTime,
        itemsProcessed: streamInfo.processedItems,
        results: result
      });

      // Cleanup stream
      setTimeout(() => {
        this.cleanupStream(streamId);
      }, 30000); // Keep stream data for 30 seconds

      return {
        success: true,
        streamId,
        results: result,
        metrics: streamInfo.metrics,
        totalTime: streamInfo.totalTime
      };

    } catch (error) {
      console.error(`❌ Streaming processing failed for ${streamId}:`, error);
      
      // Mark stream as failed
      const streamInfo = this.streamingState.activeStreams.get(streamId);
      if (streamInfo) {
        streamInfo.status = 'failed';
        streamInfo.error = error.message;
      }

      this.fireEvent('streamError', {
        streamId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Prepare processing queue with priority ordering
   */
  prepareProcessingQueue(data, streamInfo) {
    const { items, priorities } = data;
    const processingItems = items.map((item, index) => ({
      id: `${streamInfo.id}_${index}`,
      data: item,
      priority: priorities?.[index] || streamInfo.priority,
      index,
      streamId: streamInfo.id
    }));

    // Sort by priority if enabled
    if (this.config.priorityProcessing) {
      processingItems.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }

    return processingItems;
  }

  /**
   * Process stream with adaptive chunking and yielding
   */
  async processStreamWithAdaptiveChunking(streamId, items, streamInfo) {
    const results = [];
    let currentChunkSize = this.config.chunkSize;
    let processedCount = 0;
    
    this.processingState.currentJobId = streamId;
    this.processingState.totalItems = items.length;
    this.processingState.startTime = Date.now();
    this.isProcessing = true;

    try {
      while (processedCount < items.length) {
        const chunkStartTime = performance.now();
        
        // Get current chunk
        const chunk = items.slice(processedCount, processedCount + currentChunkSize);
        
        // Process chunk with streaming results
        const chunkResults = await this.processChunkWithStreaming(
          chunk, 
          streamInfo, 
          processedCount
        );
        
        results.push(...chunkResults);
        processedCount += chunk.length;
        
        const chunkTime = performance.now() - chunkStartTime;
        
        // Update metrics
        streamInfo.metrics.chunksProcessed++;
        streamInfo.metrics.totalProcessingTime += chunkTime;
        streamInfo.metrics.averageChunkTime = 
          streamInfo.metrics.totalProcessingTime / streamInfo.metrics.chunksProcessed;
        
        // Record performance for adaptation
        this.recordChunkPerformance(chunkTime, chunk.length);
        
        // Adaptive chunk size adjustment
        if (this.config.adaptiveChunking) {
          currentChunkSize = this.calculateAdaptiveChunkSize(chunkTime, currentChunkSize);
          
          if (currentChunkSize !== this.adaptiveParams.baseChunkSize) {
            this.fireEvent('adaptationChange', {
              streamId,
              oldChunkSize: this.adaptiveParams.baseChunkSize,
              newChunkSize: currentChunkSize,
              reason: 'performance_adaptation'
            });
            streamInfo.metrics.adaptationEvents++;
          }
        }
        
        // Update progress
        this.updateStreamProgress(streamInfo, processedCount, chunkTime);
        
        // Yield control based on UI performance
        if (await this.shouldYieldControl()) {
          await this.yieldWithStreaming(streamId);
        }
        
        // Memory management
        if (streamInfo.metrics.chunksProcessed % 5 === 0) {
          await this.performStreamingMemoryCleanup();
        }
      }

      return results;

    } finally {
      this.isProcessing = false;
      this.processingState.currentJobId = null;
    }
  }

  /**
   * Process chunk with real-time result streaming
   */
  async processChunkWithStreaming(chunk, streamInfo, baseIndex) {
    const chunkResults = [];
    
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i];
      const itemStartTime = performance.now();
      
      try {
        // Process individual item
        const result = await this.processMLItem(item, streamInfo);
        
        // Add metadata
        const enrichedResult = {
          ...result,
          itemIndex: baseIndex + i,
          streamId: streamInfo.id,
          timestamp: Date.now(),
          processingTime: performance.now() - itemStartTime
        };
        
        chunkResults.push(enrichedResult);
        
        // Stream result immediately if enabled
        if (this.config.streamingEnabled) {
          this.streamResult(streamInfo.id, enrichedResult);
        }
        
        // Check for early yield if processing is taking too long
        if (performance.now() - itemStartTime > 10) { // Over 10ms for single item
          await this.microYield();
        }
        
      } catch (error) {
        console.warn(`Item processing failed at index ${baseIndex + i}:`, error);
        
        // Stream error result
        const errorResult = {
          itemIndex: baseIndex + i,
          streamId: streamInfo.id,
          error: error.message,
          timestamp: Date.now()
        };
        
        chunkResults.push(errorResult);
        this.streamResult(streamInfo.id, errorResult);
      }
    }

    this.fireEvent('chunkComplete', {
      streamId: streamInfo.id,
      chunkSize: chunk.length,
      results: chunkResults,
      chunkIndex: streamInfo.metrics.chunksProcessed
    });

    return chunkResults;
  }

  /**
   * Process individual ML item (to be implemented by specific ML processors)
   */
  async processMLItem(item, streamInfo) {
    // This is a base implementation - should be overridden by specific processors
    
    // Simulate ML processing with realistic timing
    const processingTime = 5 + Math.random() * 10; // 5-15ms simulation
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      id: item.id || `item_${Date.now()}`,
      prediction: this.generateMockPrediction(item),
      confidence: Math.random() * 100,
      processed: true
    };
  }

  /**
   * Generate mock ML prediction (for testing)
   */
  generateMockPrediction(item) {
    const predictions = ['○', '△', '▽', '×'];
    return predictions[Math.floor(Math.random() * predictions.length)];
  }

  /**
   * Stream individual result to subscribers
   */
  streamResult(streamId, result) {
    // Add to buffer for batch streaming
    this.streamingState.resultBuffer.push({
      streamId,
      result,
      timestamp: Date.now()
    });

    // Update metrics
    this.streamingState.totalResultsStreamed++;
    
    // Fire individual result event
    this.fireEvent('streamResult', {
      streamId,
      result,
      bufferSize: this.streamingState.resultBuffer.length
    });
  }

  /**
   * Process result buffer and deliver to subscribers
   */
  processResultBuffer() {
    if (this.streamingState.resultBuffer.length === 0) return;
    
    const resultsToProcess = this.streamingState.resultBuffer.splice(0, this.config.resultBufferSize);
    
    // Group by stream ID
    const resultsByStream = resultsToProcess.reduce((acc, { streamId, result }) => {
      if (!acc[streamId]) acc[streamId] = [];
      acc[streamId].push(result);
      return acc;
    }, {});
    
    // Deliver to subscribers
    for (const [streamId, results] of Object.entries(resultsByStream)) {
      this.deliverResultsToSubscribers(streamId, results);
    }
  }

  /**
   * Deliver results to stream subscribers
   */
  deliverResultsToSubscribers(streamId, results) {
    const subscribers = this.streamingState.subscribers.get(streamId);
    if (!subscribers) return;
    
    for (const callback of subscribers) {
      try {
        callback(results, {
          type: 'results',
          streamId,
          count: results.length,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn(`Streaming callback failed for ${streamId}:`, error);
      }
    }
  }

  /**
   * Subscribe to streaming results
   */
  subscribeToStream(streamId, callback, options = {}) {
    if (!this.streamingState.subscribers.has(streamId)) {
      this.streamingState.subscribers.set(streamId, new Set());
    }
    
    this.streamingState.subscribers.get(streamId).add(callback);
    
    console.log(`📡 Subscribed to stream: ${streamId}`);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.streamingState.subscribers.get(streamId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.streamingState.subscribers.delete(streamId);
        }
      }
    };
  }

  /**
   * Record chunk performance for adaptive processing
   */
  recordChunkPerformance(chunkTime, chunkSize) {
    const timePerItem = chunkTime / chunkSize;
    
    this.adaptiveParams.recentPerformance.push({
      chunkTime,
      chunkSize,
      timePerItem,
      timestamp: performance.now()
    });
    
    // Limit performance history
    if (this.adaptiveParams.recentPerformance.length > this.adaptiveParams.performanceWindow) {
      this.adaptiveParams.recentPerformance.shift();
    }
  }

  /**
   * Calculate adaptive chunk size based on performance
   */
  calculateAdaptiveChunkSize(chunkTime, currentChunkSize) {
    const targetTime = this.adaptiveParams.targetProcessingTime;
    const adaptationFactor = this.adaptiveParams.adaptationFactor;
    
    let newChunkSize = currentChunkSize;
    
    if (chunkTime > targetTime * 1.5) {
      // Processing is too slow, reduce chunk size
      newChunkSize = Math.max(
        this.adaptiveParams.minChunkSize,
        Math.floor(currentChunkSize / adaptationFactor)
      );
    } else if (chunkTime < targetTime * 0.5 && this.isUIPerformanceGood()) {
      // Processing is fast and UI is responsive, increase chunk size
      newChunkSize = Math.min(
        this.adaptiveParams.maxChunkSize,
        Math.floor(currentChunkSize * adaptationFactor)
      );
    }
    
    return newChunkSize;
  }

  /**
   * Check if UI performance is good enough for larger chunks
   */
  isUIPerformanceGood() {
    if (!this.uiMonitor) return true;
    
    const report = this.uiMonitor.getPerformanceReport();
    return report.frameMetrics.currentFPS > 45 && 
           report.frameMetrics.dropRate < 0.1 &&
           !report.interactionMetrics.isUserActive;
  }

  /**
   * Update stream progress and notify callbacks
   */
  updateStreamProgress(streamInfo, processedCount, lastChunkTime) {
    const now = Date.now();
    const progress = Math.min(100, (processedCount / streamInfo.totalItems) * 100);
    
    streamInfo.processedItems = processedCount;
    
    // Calculate ETA
    const elapsedTime = now - streamInfo.startTime;
    const itemsRemaining = streamInfo.totalItems - processedCount;
    const avgTimePerItem = elapsedTime / processedCount;
    const estimatedTimeRemaining = itemsRemaining * avgTimePerItem;
    
    const progressData = {
      streamId: streamInfo.id,
      progress,
      processedItems: processedCount,
      totalItems: streamInfo.totalItems,
      elapsedTime,
      estimatedTimeRemaining,
      currentChunkTime: lastChunkTime,
      averageChunkTime: streamInfo.metrics.averageChunkTime,
      memoryUsage: this.memoryManager?.getMemoryStats()?.current?.memoryMB || 0
    };
    
    // Throttle progress updates
    if (now - this.processingState.lastProgressTime >= this.config.progressThrottleMs) {
      this.processingState.lastProgressTime = now;
      
      if (streamInfo.progressCallback) {
        streamInfo.progressCallback(progressData);
      }
      
      this.fireEvent('streamProgress', progressData);
    }
  }

  /**
   * Determine if control should be yielded to maintain responsiveness
   */
  async shouldYieldControl() {
    // Always yield if UI monitor suggests emergency mode
    if (this.uiMonitor) {
      const params = this.uiMonitor.getOptimizationParameters();
      if (params.emergencyMode || params.shouldYieldImmediately) {
        return true;
      }
    }
    
    // Yield based on time since last yield
    const timeSinceYield = performance.now() - this.processingState.lastYieldTime;
    return timeSinceYield >= this.config.yieldTimeMs;
  }

  /**
   * Yield control with streaming support
   */
  async yieldWithStreaming(streamId) {
    this.processingState.lastYieldTime = performance.now();
    
    // Process any buffered results during yield
    this.processResultBuffer();
    
    // Micro-yield to allow other tasks
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  /**
   * Micro-yield for fine-grained responsiveness
   */
  async microYield() {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Adjust processing parameters based on UI optimization feedback
   */
  adjustProcessingParameters(optimizationData) {
    const { processingMode, batchSize, yieldFrequency } = optimizationData;
    
    switch (processingMode) {
      case 'minimal':
        this.config.chunkSize = Math.max(2, Math.floor(this.config.chunkSize * 0.5));
        this.config.yieldTimeMs = Math.max(1, this.config.yieldTimeMs * 0.5);
        break;
      case 'reduced':
        this.config.chunkSize = Math.max(5, Math.floor(this.config.chunkSize * 0.7));
        this.config.yieldTimeMs = Math.max(2, this.config.yieldTimeMs * 0.8);
        break;
      case 'normal':
        this.config.chunkSize = this.adaptiveParams.baseChunkSize;
        this.config.yieldTimeMs = 4; // Default
        break;
    }
    
    console.log(`🔧 Streaming parameters adjusted for ${processingMode} mode:`, {
      chunkSize: this.config.chunkSize,
      yieldTimeMs: this.config.yieldTimeMs
    });
  }

  /**
   * Enable emergency processing mode
   */
  enableEmergencyMode() {
    console.warn('🚨 Streaming processor entering emergency mode');
    
    this.config.chunkSize = this.adaptiveParams.minChunkSize;
    this.config.yieldTimeMs = 1;
    this.config.progressThrottleMs = 500; // Reduce update frequency
  }

  /**
   * Reduce processing intensity due to memory pressure
   */
  reduceProcessingIntensity() {
    console.warn('🧠 Reducing streaming intensity due to memory pressure');
    
    this.config.chunkSize = Math.max(
      this.adaptiveParams.minChunkSize,
      Math.floor(this.config.chunkSize * 0.8)
    );
    
    this.config.resultBufferSize = Math.max(10, Math.floor(this.config.resultBufferSize * 0.5));
  }

  /**
   * Enable memory conservation mode
   */
  enableMemoryConservationMode() {
    console.error('🚨 Enabling memory conservation mode');
    
    this.config.chunkSize = this.adaptiveParams.minChunkSize;
    this.config.resultBufferSize = 5; // Minimal buffering
    this.config.progressThrottleMs = 1000; // Reduce updates
    
    // Force immediate result processing
    this.processResultBuffer();
  }

  /**
   * Update processing from UI optimization parameters
   */
  updateFromUIOptimization(params) {
    if (params.frameTimeTarget < 20) { // Good performance
      this.adaptiveParams.targetProcessingTime = 16;
    } else if (params.frameTimeTarget > 50) { // Poor performance
      this.adaptiveParams.targetProcessingTime = 8;
    } else {
      this.adaptiveParams.targetProcessingTime = 12;
    }
  }

  /**
   * Perform memory cleanup optimized for streaming
   */
  async performStreamingMemoryCleanup() {
    if (this.memoryManager) {
      const cleanupResult = await this.memoryManager.forceCleanup();
      
      if (cleanupResult.success && cleanupResult.memoryReclaimedMB > 10) {
        console.log(`🧹 Streaming cleanup: ${cleanupResult.memoryReclaimedMB.toFixed(1)}MB reclaimed`);
      }
    }
  }

  /**
   * Monitor stream health and performance
   */
  monitorStreamHealth() {
    for (const [streamId, streamInfo] of this.streamingState.activeStreams) {
      if (streamInfo.status === 'active') {
        const elapsedTime = Date.now() - streamInfo.startTime;
        
        // Check for stalled streams
        if (elapsedTime > 300000 && streamInfo.processedItems === 0) { // 5 minutes no progress
          console.warn(`⚠️ Stream ${streamId} appears stalled`);
          this.handleStalledStream(streamId, streamInfo);
        }
        
        // Update stream metrics
        this.updateStreamMetrics(streamId, streamInfo);
      }
    }
  }

  /**
   * Handle stalled stream
   */
  handleStalledStream(streamId, streamInfo) {
    console.warn(`🚨 Handling stalled stream: ${streamId}`);
    
    streamInfo.status = 'stalled';
    this.fireEvent('streamError', {
      streamId,
      error: 'Stream processing stalled',
      type: 'stall'
    });
  }

  /**
   * Update stream metrics
   */
  updateStreamMetrics(streamId, streamInfo) {
    if (!this.streamingState.streamMetrics.has(streamId)) {
      this.streamingState.streamMetrics.set(streamId, {
        startTime: streamInfo.startTime,
        lastUpdateTime: Date.now(),
        throughput: 0, // items per second
        efficiency: 0, // processed/total ratio
        adaptations: 0
      });
    }
    
    const metrics = this.streamingState.streamMetrics.get(streamId);
    const now = Date.now();
    const elapsedSeconds = (now - streamInfo.startTime) / 1000;
    
    metrics.lastUpdateTime = now;
    metrics.throughput = streamInfo.processedItems / elapsedSeconds;
    metrics.efficiency = streamInfo.processedItems / streamInfo.totalItems;
    metrics.adaptations = streamInfo.metrics.adaptationEvents;
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats() {
    return {
      activeStreams: this.streamingState.activeStreams.size,
      totalStreams: this.streamingState.totalStreams,
      totalResultsStreamed: this.streamingState.totalResultsStreamed,
      resultBufferSize: this.streamingState.resultBuffer.length,
      subscriberCount: Array.from(this.streamingState.subscribers.values())
        .reduce((sum, set) => sum + set.size, 0),
      processingState: {
        isProcessing: this.isProcessing,
        currentJob: this.processingState.currentJobId,
        progress: this.processingState.processedItems / this.processingState.totalItems * 100
      },
      adaptiveParams: { ...this.adaptiveParams },
      configuration: { ...this.config }
    };
  }

  /**
   * Cleanup completed or failed stream
   */
  cleanupStream(streamId) {
    this.streamingState.activeStreams.delete(streamId);
    this.streamingState.subscribers.delete(streamId);
    this.streamingState.streamMetrics.delete(streamId);
    
    console.log(`🧹 Cleaned up stream: ${streamId}`);
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

  fireEvent(eventType, data) {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler({ ...data, timestamp: Date.now() });
        } catch (error) {
          console.warn(`Streaming event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Stop all active streams
   */
  async stopAllStreams() {
    console.log('⏹️ Stopping all active streams...');
    
    for (const [streamId, streamInfo] of this.streamingState.activeStreams) {
      if (streamInfo.status === 'active') {
        streamInfo.status = 'stopped';
        this.fireEvent('streamComplete', {
          streamId,
          stopped: true,
          itemsProcessed: streamInfo.processedItems
        });
      }
    }
    
    this.isProcessing = false;
    this.processingState.currentJobId = null;
  }

  /**
   * Destroy streaming processor
   */
  async destroy() {
    console.log('🧹 Destroying Streaming ML Processor...');
    
    try {
      // Stop all streams
      await this.stopAllStreams();
      
      // Clear RAF handle
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle);
        this.rafHandle = null;
      }
      
      // Clear all data structures
      this.streamingState.activeStreams.clear();
      this.streamingState.subscribers.clear();
      this.streamingState.streamMetrics.clear();
      this.streamingState.resultBuffer = [];
      
      // Clear processors
      this.processors.clear();
      
      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());
      
      this.isInitialized = false;
      
      console.log('✅ Streaming ML Processor destroyed');
      
    } catch (error) {
      console.error('Error during Streaming ML Processor destruction:', error);
    }
  }
}

// Singleton instance
let streamingMLProcessorInstance = null;

export function getStreamingMLProcessor() {
  if (!streamingMLProcessorInstance) {
    streamingMLProcessorInstance = new StreamingMLProcessor();
  }
  return streamingMLProcessorInstance;
}

export { StreamingMLProcessor };