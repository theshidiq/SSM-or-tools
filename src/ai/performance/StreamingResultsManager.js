/**
 * StreamingResultsManager.js
 *
 * Manages streaming results and lazy loading for AI processing.
 * Provides progressive result updates and optimized data loading.
 */

class StreamingResultsManager {
  constructor() {
    this.isInitialized = false;
    this.streams = new Map();
    this.resultCache = new Map();
    this.subscriptions = new Map();
    this.lazyLoaders = new Map();

    // Configuration
    this.config = {
      streamBufferSize: 100,
      cacheMaxSize: 1000,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      lazyLoadThreshold: 50, // Start lazy loading after 50 items
      batchSize: 20,
      maxConcurrentStreams: 5,
    };

    // Stream state tracking
    this.streamStats = {
      totalStreams: 0,
      activeStreams: 0,
      bytesStreamed: 0,
      itemsStreamed: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Performance tracking
    this.performanceMetrics = {
      averageLatency: 0,
      throughput: 0,
      streamingOverhead: 0,
      memoryUsage: 0,
    };

    // Event handlers
    this.eventHandlers = {
      stream: new Set(),
      chunk: new Set(),
      complete: new Set(),
      error: new Set(),
    };
  }

  /**
   * Initialize the streaming manager
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log("🌊 Initializing Streaming Results Manager...");

      // Apply configuration
      Object.assign(this.config, options.config || {});

      // Setup cache cleanup
      this.setupCacheCleanup();

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      this.isInitialized = true;

      console.log("✅ Streaming Results Manager initialized:", {
        bufferSize: this.config.streamBufferSize,
        cacheSize: this.config.cacheMaxSize,
        batchSize: this.config.batchSize,
      });

      return { success: true, config: this.config };
    } catch (error) {
      console.error("❌ Streaming Manager initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create a new result stream
   */
  createStream(streamId, options = {}) {
    if (this.streams.has(streamId)) {
      console.warn(`Stream ${streamId} already exists`);
      return this.streams.get(streamId);
    }

    if (this.streamStats.activeStreams >= this.config.maxConcurrentStreams) {
      throw new Error("Maximum concurrent streams reached");
    }

    const stream = new ResultStream(streamId, {
      ...this.config,
      ...options,
      onChunk: (chunk) => this.handleStreamChunk(streamId, chunk),
      onComplete: (result) => this.handleStreamComplete(streamId, result),
      onError: (error) => this.handleStreamError(streamId, error),
    });

    this.streams.set(streamId, stream);
    this.streamStats.activeStreams++;
    this.streamStats.totalStreams++;

    console.log(`🌊 Created stream: ${streamId}`);
    return stream;
  }

  /**
   * Subscribe to stream updates
   */
  subscribeToStream(streamId, callback, options = {}) {
    const subscriptionId = `${streamId}_${Date.now()}_${Math.random()}`;

    const subscription = {
      id: subscriptionId,
      streamId,
      callback,
      options: {
        includePartial: options.includePartial || false,
        throttle: options.throttle || 0,
        filter: options.filter || null,
      },
      lastUpdate: 0,
      active: true,
    };

    if (!this.subscriptions.has(streamId)) {
      this.subscriptions.set(streamId, new Set());
    }

    this.subscriptions.get(streamId).add(subscription);

    console.log(
      `📡 Subscribed to stream ${streamId} with ID ${subscriptionId}`,
    );

    // Return unsubscribe function
    return () => this.unsubscribeFromStream(subscriptionId);
  }

  /**
   * Unsubscribe from stream
   */
  unsubscribeFromStream(subscriptionId) {
    for (const [streamId, subscriptions] of this.subscriptions) {
      for (const subscription of subscriptions) {
        if (subscription.id === subscriptionId) {
          subscription.active = false;
          subscriptions.delete(subscription);
          console.log(`📡 Unsubscribed from stream ${streamId}`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Start streaming ML results
   */
  async streamMLResults(streamId, data, progressCallback) {
    const stream = this.createStream(streamId, {
      type: "ml_results",
      estimatedSize: data.estimatedSize || 0,
    });

    try {
      const { scheduleData, staffMembers, dateRange, options = {} } = data;

      // Initialize streaming processing
      console.log(`🌊 Starting ML results stream: ${streamId}`);
      stream.start();

      // Process results in streaming fashion
      await this.processStreamingMLResults(
        stream,
        scheduleData,
        staffMembers,
        dateRange,
        options,
        progressCallback,
      );

      return stream;
    } catch (error) {
      stream.error(error);
      throw error;
    }
  }

  /**
   * Process ML results with streaming
   */
  async processStreamingMLResults(
    stream,
    scheduleData,
    staffMembers,
    dateRange,
    options,
    progressCallback,
  ) {
    const totalCells = staffMembers.length * dateRange.length;
    let processedCells = 0;
    let resultBuffer = [];

    // Create lazy loader for large datasets
    const lazyLoader = this.createLazyLoader(stream.id, {
      staffMembers,
      dateRange,
      totalItems: totalCells,
    });

    // Process in batches for streaming
    for (let staffIndex = 0; staffIndex < staffMembers.length; staffIndex++) {
      const staff = staffMembers[staffIndex];

      // Check if we should use lazy loading
      if (processedCells > this.config.lazyLoadThreshold) {
        await this.processWithLazyLoading(
          stream,
          lazyLoader,
          staff,
          dateRange,
          scheduleData,
          options,
          (progress) => {
            processedCells += progress.itemsProcessed || 0;
            this.updateStreamProgress(
              stream,
              processedCells,
              totalCells,
              progressCallback,
            );
          },
        );
        continue;
      }

      // Process dates in batches
      for (
        let dateIndex = 0;
        dateIndex < dateRange.length;
        dateIndex += this.config.batchSize
      ) {
        const dateBatch = dateRange.slice(
          dateIndex,
          Math.min(dateIndex + this.config.batchSize, dateRange.length),
        );

        // Process batch
        const batchResults = await this.processBatch(
          staff,
          dateBatch,
          scheduleData,
          options,
        );

        // Add to buffer
        resultBuffer.push(...batchResults);
        processedCells += batchResults.length;

        // Stream buffer if it's full
        if (resultBuffer.length >= this.config.streamBufferSize) {
          await this.streamResultChunk(stream, resultBuffer);
          resultBuffer = [];
        }

        // Update progress
        this.updateStreamProgress(
          stream,
          processedCells,
          totalCells,
          progressCallback,
        );

        // Yield control to prevent blocking
        await this.yieldControl();
      }
    }

    // Stream remaining results
    if (resultBuffer.length > 0) {
      await this.streamResultChunk(stream, resultBuffer);
    }

    // Complete the stream
    stream.complete({
      totalItems: processedCells,
      processingTime: stream.getElapsedTime(),
      cacheHits: this.streamStats.cacheHits,
      cacheMisses: this.streamStats.cacheMisses,
    });
  }

  /**
   * Process with lazy loading
   */
  async processWithLazyLoading(
    stream,
    lazyLoader,
    staff,
    dateRange,
    scheduleData,
    options,
    progressCallback,
  ) {
    // Create lazy loading promise for this staff member
    const lazyPromise = lazyLoader.loadStaffData(
      staff,
      dateRange,
      scheduleData,
      options,
    );

    // Stream placeholder while loading
    await this.streamResultChunk(stream, [
      {
        type: "lazy_placeholder",
        staffId: staff.id,
        staffName: staff.name,
        dateRange: dateRange.map((d) => d.toISOString().split("T")[0]),
        status: "loading",
        promise: lazyPromise,
      },
    ]);

    // Process lazy loading in background
    lazyPromise.then(async (results) => {
      // Stream actual results when ready
      await this.streamResultChunk(
        stream,
        results.map((result) => ({
          ...result,
          type: "lazy_result",
          staffId: staff.id,
        })),
      );

      if (progressCallback) {
        progressCallback({
          itemsProcessed: results.length,
          type: "lazy_loaded",
        });
      }
    });
  }

  /**
   * Process a batch of predictions
   */
  async processBatch(staff, dateBatch, scheduleData, options) {
    const results = [];

    for (const date of dateBatch) {
      const dateKey = date.toISOString().split("T")[0];
      const cellKey = `${staff.id}_${dateKey}`;

      // Check cache first
      if (this.resultCache.has(cellKey)) {
        const cached = this.resultCache.get(cellKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          results.push({
            ...cached.result,
            fromCache: true,
          });
          this.streamStats.cacheHits++;
          continue;
        } else {
          this.resultCache.delete(cellKey);
        }
      }

      // Process prediction
      try {
        const prediction = await this.generateStreamingPrediction(
          staff,
          date,
          scheduleData,
          options,
        );

        if (prediction) {
          const result = {
            cellKey,
            staffId: staff.id,
            staffName: staff.name,
            dateKey,
            date: date.toISOString(),
            prediction: prediction.shift,
            confidence: prediction.confidence,
            probabilities: prediction.probabilities,
            timestamp: Date.now(),
            fromCache: false,
          };

          results.push(result);

          // Cache result
          this.cacheResult(cellKey, result);
          this.streamStats.cacheMisses++;
        }
      } catch (error) {
        console.warn(
          `Streaming prediction failed for ${staff.name} on ${dateKey}:`,
          error,
        );
        results.push({
          cellKey,
          staffId: staff.id,
          staffName: staff.name,
          dateKey,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  /**
   * Generate streaming prediction (optimized for streaming)
   */
  async generateStreamingPrediction(staff, date, scheduleData, options) {
    // Simplified prediction for streaming (can be enhanced)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Basic probability model
    const probabilities = {
      "○": 0.4, // normal
      "△": 0.2, // early
      "▽": 0.2, // late
      "×": 0.2, // off
    };

    // Adjust for specific rules
    if (staff.name === "料理長" && dayOfWeek === 0) {
      probabilities["△"] = 0.7;
      probabilities["○"] = 0.2;
      probabilities["▽"] = 0.05;
      probabilities["×"] = 0.05;
    }

    if (isWeekend) {
      probabilities["×"] += 0.1;
    }

    // Normalize probabilities
    const total = Object.values(probabilities).reduce(
      (sum, prob) => sum + prob,
      0,
    );
    Object.keys(probabilities).forEach((key) => {
      probabilities[key] = probabilities[key] / total;
    });

    // Select best prediction
    let bestShift = "○";
    let bestProb = 0;

    for (const [shift, prob] of Object.entries(probabilities)) {
      if (prob > bestProb) {
        bestProb = prob;
        bestShift = shift;
      }
    }

    return {
      shift: bestShift,
      confidence: Math.round(bestProb * 100),
      probabilities,
    };
  }

  /**
   * Stream a chunk of results
   */
  async streamResultChunk(stream, chunk) {
    const chunkSize = JSON.stringify(chunk).length;
    this.streamStats.bytesStreamed += chunkSize;
    this.streamStats.itemsStreamed += chunk.length;

    // Send chunk to stream
    stream.pushChunk({
      data: chunk,
      size: chunkSize,
      timestamp: Date.now(),
      chunkId: stream.getNextChunkId(),
    });

    // Notify subscribers
    await this.notifySubscribers(stream.id, chunk, {
      type: "chunk",
      partial: true,
    });
  }

  /**
   * Update stream progress
   */
  updateStreamProgress(stream, processed, total, progressCallback) {
    const progress = Math.min(100, Math.floor((processed / total) * 100));

    stream.updateProgress(progress, {
      processed,
      total,
      throughput: this.calculateThroughput(stream),
      estimatedTimeRemaining: this.estimateTimeRemaining(
        stream,
        processed,
        total,
      ),
    });

    if (progressCallback) {
      progressCallback({
        progress,
        processed,
        total,
        stage: "streaming",
        message: `Streaming results... (${processed}/${total})`,
      });
    }
  }

  /**
   * Create lazy loader
   */
  createLazyLoader(streamId, options) {
    const lazyLoader = new LazyLoader(streamId, {
      ...options,
      batchSize: this.config.batchSize,
      cacheManager: this,
    });

    this.lazyLoaders.set(streamId, lazyLoader);
    return lazyLoader;
  }

  /**
   * Cache result with TTL
   */
  cacheResult(key, result) {
    // Implement LRU cache with size limit
    if (this.resultCache.size >= this.config.cacheMaxSize) {
      // Remove oldest entries
      const sortedEntries = Array.from(this.resultCache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      );

      const removeCount = Math.floor(this.config.cacheMaxSize * 0.1); // Remove 10%
      for (let i = 0; i < removeCount; i++) {
        this.resultCache.delete(sortedEntries[i][0]);
      }
    }

    this.resultCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle stream chunk
   */
  handleStreamChunk(streamId, chunk) {
    this.notifySubscribers(streamId, chunk.data, {
      type: "chunk",
      chunkId: chunk.chunkId,
      size: chunk.size,
    });
  }

  /**
   * Handle stream completion
   */
  handleStreamComplete(streamId, result) {
    this.streamStats.activeStreams--;
    this.notifySubscribers(streamId, result, { type: "complete" });

    // Cleanup
    setTimeout(() => {
      this.cleanup(streamId);
    }, 60000); // Cleanup after 1 minute
  }

  /**
   * Handle stream error
   */
  handleStreamError(streamId, error) {
    this.streamStats.activeStreams--;
    this.notifySubscribers(streamId, error, { type: "error" });

    console.error(`Stream ${streamId} error:`, error);
  }

  /**
   * Notify subscribers
   */
  async notifySubscribers(streamId, data, metadata) {
    const subscriptions = this.subscriptions.get(streamId);
    if (!subscriptions) return;

    const now = Date.now();

    for (const subscription of subscriptions) {
      if (!subscription.active) continue;

      // Check throttling
      if (
        subscription.options.throttle > 0 &&
        now - subscription.lastUpdate < subscription.options.throttle
      ) {
        continue;
      }

      // Apply filter if specified
      if (
        subscription.options.filter &&
        !subscription.options.filter(data, metadata)
      ) {
        continue;
      }

      // Skip partial results if not requested
      if (metadata.partial && !subscription.options.includePartial) {
        continue;
      }

      try {
        subscription.callback(data, metadata);
        subscription.lastUpdate = now;
      } catch (error) {
        console.warn(`Subscription callback failed for ${streamId}:`, error);
      }
    }
  }

  /**
   * Calculate throughput
   */
  calculateThroughput(stream) {
    const elapsed = stream.getElapsedTime();
    return elapsed > 0 ? stream.getProcessedCount() / (elapsed / 1000) : 0; // Items per second
  }

  /**
   * Estimate time remaining
   */
  estimateTimeRemaining(stream, processed, total) {
    const throughput = this.calculateThroughput(stream);
    const remaining = total - processed;
    return throughput > 0 ? (remaining / throughput) * 1000 : 0; // milliseconds
  }

  /**
   * Yield control to prevent blocking
   */
  async yieldControl() {
    return new Promise((resolve) => setTimeout(resolve, 1));
  }

  /**
   * Setup cache cleanup
   */
  setupCacheCleanup() {
    // Cleanup expired cache entries every 2 minutes
    setInterval(
      () => {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, cached] of this.resultCache) {
          if (now - cached.timestamp > this.config.cacheTTL) {
            expiredKeys.push(key);
          }
        }

        expiredKeys.forEach((key) => this.resultCache.delete(key));

        if (expiredKeys.length > 0) {
          console.log(`🧹 Cleaned ${expiredKeys.length} expired cache entries`);
        }
      },
      2 * 60 * 1000,
    );
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    // Calculate memory usage of cache
    let cacheMemory = 0;
    for (const [, cached] of this.resultCache) {
      cacheMemory += JSON.stringify(cached).length * 2; // Rough estimate
    }

    this.performanceMetrics.memoryUsage = cacheMemory;

    // Update other metrics based on recent activity
    // (Implementation would track latency, throughput, etc.)
  }

  /**
   * Get stream statistics
   */
  getStreamStats() {
    return {
      ...this.streamStats,
      performanceMetrics: this.performanceMetrics,
      cacheSize: this.resultCache.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, subs) => sum + subs.size,
        0,
      ),
    };
  }

  /**
   * Cleanup stream resources
   */
  cleanup(streamId) {
    // Remove stream
    this.streams.delete(streamId);

    // Remove subscriptions
    this.subscriptions.delete(streamId);

    // Remove lazy loader
    if (this.lazyLoaders.has(streamId)) {
      const lazyLoader = this.lazyLoaders.get(streamId);
      lazyLoader.destroy();
      this.lazyLoaders.delete(streamId);
    }

    console.log(`🧹 Cleaned up stream: ${streamId}`);
  }

  /**
   * Destroy streaming manager
   */
  async destroy() {
    console.log("🧹 Destroying Streaming Results Manager...");

    // Stop all streams
    for (const stream of this.streams.values()) {
      stream.abort();
    }

    // Clear all data
    this.streams.clear();
    this.subscriptions.clear();
    this.resultCache.clear();
    this.lazyLoaders.clear();

    this.isInitialized = false;
    console.log("✅ Streaming Manager destroyed");
  }
}

/**
 * Individual Result Stream
 */
class ResultStream {
  constructor(id, options) {
    this.id = id;
    this.options = options;
    this.chunks = [];
    this.status = "idle";
    this.startTime = null;
    this.endTime = null;
    this.progress = 0;
    this.processedCount = 0;
    this.nextChunkId = 1;
    this.totalSize = 0;
    this.metadata = {};
  }

  start() {
    this.status = "streaming";
    this.startTime = Date.now();
  }

  pushChunk(chunk) {
    this.chunks.push(chunk);
    this.totalSize += chunk.size;
    this.processedCount += chunk.data.length;

    if (this.options.onChunk) {
      this.options.onChunk(chunk);
    }
  }

  updateProgress(progress, metadata = {}) {
    this.progress = progress;
    this.metadata = { ...this.metadata, ...metadata };
  }

  complete(result) {
    this.status = "completed";
    this.endTime = Date.now();

    if (this.options.onComplete) {
      this.options.onComplete({
        ...result,
        streamId: this.id,
        chunks: this.chunks.length,
        totalSize: this.totalSize,
      });
    }
  }

  error(error) {
    this.status = "error";
    this.endTime = Date.now();

    if (this.options.onError) {
      this.options.onError(error);
    }
  }

  abort() {
    this.status = "aborted";
    this.endTime = Date.now();
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || Date.now();
    return endTime - this.startTime;
  }

  getNextChunkId() {
    return this.nextChunkId++;
  }

  getProcessedCount() {
    return this.processedCount;
  }
}

/**
 * Lazy Loader for large datasets
 */
class LazyLoader {
  constructor(id, options) {
    this.id = id;
    this.options = options;
    this.loadingPromises = new Map();
    this.loadedData = new Map();
  }

  async loadStaffData(staff, dateRange, scheduleData, options) {
    const staffKey = `staff_${staff.id}`;

    if (this.loadingPromises.has(staffKey)) {
      return this.loadingPromises.get(staffKey);
    }

    const loadPromise = this.performLazyLoad(
      staff,
      dateRange,
      scheduleData,
      options,
    );
    this.loadingPromises.set(staffKey, loadPromise);

    try {
      const result = await loadPromise;
      this.loadedData.set(staffKey, result);
      return result;
    } finally {
      this.loadingPromises.delete(staffKey);
    }
  }

  async performLazyLoad(staff, dateRange, scheduleData, options) {
    // Simulate lazy loading with processing
    const results = [];

    for (const date of dateRange) {
      const dateKey = date.toISOString().split("T")[0];

      // Simplified prediction for lazy loading
      const prediction = {
        shift: "○", // Default to normal shift
        confidence: 75,
        probabilities: { "○": 0.75, "△": 0.1, "▽": 0.1, "×": 0.05 },
      };

      results.push({
        cellKey: `${staff.id}_${dateKey}`,
        staffId: staff.id,
        staffName: staff.name,
        dateKey,
        prediction: prediction.shift,
        confidence: prediction.confidence,
        probabilities: prediction.probabilities,
        lazyLoaded: true,
        timestamp: Date.now(),
      });

      // Yield periodically
      if (results.length % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    return results;
  }

  destroy() {
    this.loadingPromises.clear();
    this.loadedData.clear();
  }
}

// Singleton instance
let streamingManagerInstance = null;

export function getStreamingResultsManager() {
  if (!streamingManagerInstance) {
    streamingManagerInstance = new StreamingResultsManager();
  }
  return streamingManagerInstance;
}

export { StreamingResultsManager, ResultStream, LazyLoader };
