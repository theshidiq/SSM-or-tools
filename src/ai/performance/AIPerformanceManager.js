/**
 * AIPerformanceManager.js
 *
 * Central manager that integrates all performance optimization components.
 * Coordinates Web Workers, memory management, streaming, and monitoring.
 */

import { getWorkerManager } from "./WorkerManager";
import { getTensorMemoryManager } from "./TensorMemoryManager";
import { getPerformanceMonitor } from "./PerformanceMonitor";
import { getStreamingResultsManager } from "./StreamingResultsManager";

class AIPerformanceManager {
  constructor() {
    this.isInitialized = false;
    this.components = {
      workerManager: null,
      memoryManager: null,
      performanceMonitor: null,
      streamingManager: null,
    };

    // Configuration
    this.config = {
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      enableStreaming: true,
      maxMemoryMB: 400,
      workerTimeout: 300000, // 5 minutes
      streamingThreshold: 50,
    };

    // State tracking
    this.state = {
      isProcessing: false,
      canCancel: false,
      canPause: false,
      isPaused: false,
      currentJobId: null,
      systemHealth: {
        overall: "good",
        components: {},
        lastCheck: null,
      },
    };

    // Event handlers
    this.eventHandlers = {
      progress: new Set(),
      complete: new Set(),
      error: new Set(),
      cancel: new Set(),
      pause: new Set(),
      resume: new Set(),
      alert: new Set(),
    };

    // Performance tracking
    this.performanceHistory = [];
    this.systemMetrics = {
      totalJobs: 0,
      successfulJobs: 0,
      averageJobTime: 0,
      memoryEfficiency: 0,
      workerUtilization: 0,
    };
  }

  /**
   * Initialize all performance components
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log("🚀 Initializing AI Performance Manager...");
      const startTime = Date.now();

      // Apply configuration
      this.applyConfiguration(options);

      // Initialize components in order
      const initResults = await this.initializeComponents(options);

      // Setup inter-component communication
      this.setupComponentIntegration();

      // Setup system health monitoring
      this.setupHealthMonitoring();

      // Setup performance optimization
      this.setupPerformanceOptimization();

      const initTime = Date.now() - startTime;
      this.isInitialized = true;

      console.log("✅ AI Performance Manager initialized:", {
        initTime: initTime + "ms",
        components: Object.keys(this.components).filter(
          (k) => this.components[k],
        ),
        config: this.config,
      });

      return {
        success: true,
        initTime,
        components: initResults,
        systemHealth: await this.checkSystemHealth(),
      };
    } catch (error) {
      console.error("❌ AI Performance Manager initialization failed:", error);
      throw error;
    }
  }

  /**
   * Apply configuration options
   */
  applyConfiguration(options) {
    Object.assign(this.config, options);

    // Validate configuration
    this.config.maxMemoryMB = Math.max(
      100,
      Math.min(1000, this.config.maxMemoryMB),
    );
    this.config.workerTimeout = Math.max(
      30000,
      Math.min(600000, this.config.workerTimeout),
    );
  }

  /**
   * Initialize all components
   */
  async initializeComponents(options) {
    const results = {};

    try {
      // Initialize Memory Manager first
      if (this.config.enableMemoryManagement) {
        console.log("🧠 Initializing Memory Manager...");
        this.components.memoryManager = getTensorMemoryManager();
        results.memoryManager = await this.components.memoryManager.initialize({
          maxMemoryMB: this.config.maxMemoryMB,
          ...options.memoryConfig,
        });
      }

      // Initialize Performance Monitor
      if (this.config.enablePerformanceMonitoring) {
        console.log("📊 Initializing Performance Monitor...");
        this.components.performanceMonitor = getPerformanceMonitor();
        results.performanceMonitor =
          await this.components.performanceMonitor.initialize({
            ...options.performanceConfig,
          });
      }

      // Initialize Worker Manager
      if (this.config.enableWorkers) {
        console.log("👷 Initializing Worker Manager...");
        this.components.workerManager = getWorkerManager();
        results.workerManager = await this.components.workerManager.initialize({
          memoryLimitMB: this.config.maxMemoryMB,
          timeout: this.config.workerTimeout,
          ...options.workerConfig,
        });
      }

      // Initialize Streaming Manager
      if (this.config.enableStreaming) {
        console.log("🌊 Initializing Streaming Manager...");
        this.components.streamingManager = getStreamingResultsManager();
        results.streamingManager =
          await this.components.streamingManager.initialize({
            lazyLoadThreshold: this.config.streamingThreshold,
            ...options.streamingConfig,
          });
      }

      return results;
    } catch (error) {
      console.error("Component initialization failed:", error);
      throw error;
    }
  }

  /**
   * Setup component integration
   */
  setupComponentIntegration() {
    // Integrate performance monitor with other components
    if (this.components.performanceMonitor && this.components.memoryManager) {
      this.components.memoryManager.onMemoryPressure("high", (stats) => {
        this.handleMemoryPressure(stats);
      });
    }

    // Setup alert forwarding
    if (this.components.performanceMonitor) {
      this.components.performanceMonitor.onAlert((alert) => {
        this.handleSystemAlert(alert);
      });
    }

    // Setup progress forwarding
    if (this.components.performanceMonitor) {
      this.components.performanceMonitor.onProgress((progress) => {
        this.notifyEventHandlers("progress", progress);
      });
    }
  }

  /**
   * Setup system health monitoring
   */
  setupHealthMonitoring() {
    // Check system health every 30 seconds
    setInterval(async () => {
      try {
        this.state.systemHealth = await this.checkSystemHealth();
      } catch (error) {
        console.warn("Health check failed:", error);
      }
    }, 30000);
  }

  /**
   * Setup performance optimization
   */
  setupPerformanceOptimization() {
    // Auto-optimize based on system performance
    if (this.components.performanceMonitor) {
      this.components.performanceMonitor.onAlert((alert) => {
        if (alert.type === "memory_high" || alert.type === "processing_slow") {
          this.optimizePerformance();
        }
      });
    }
  }

  /**
   * Process ML predictions with all optimizations
   */
  async processMLPredictions(data, progressCallback) {
    if (!this.isInitialized) {
      throw new Error("AI Performance Manager not initialized");
    }

    const jobId = `ml_job_${Date.now()}`;
    this.state.currentJobId = jobId;
    this.state.isProcessing = true;
    this.state.canCancel = true;
    this.state.canPause = false; // Will be enabled during processing

    try {
      // Start performance monitoring
      let performanceJob = null;
      if (this.components.performanceMonitor) {
        performanceJob = this.components.performanceMonitor.startJob(jobId, {
          type: "ml_predictions",
          estimatedDuration: this.estimateProcessingTime(data),
        });
      }

      // Determine processing strategy
      const strategy = this.selectProcessingStrategy(data);
      console.log("🎯 Selected processing strategy:", strategy);

      let result;

      // Create enhanced progress callback
      const enhancedProgressCallback = (progress) => {
        if (performanceJob) {
          this.components.performanceMonitor.updateJobProgress(
            jobId,
            progress.progress || 0,
            progress,
          );
        }

        // Enable pause after initial setup
        if (progress.progress > 10) {
          this.state.canPause = true;
        }

        if (progressCallback) {
          progressCallback({
            ...progress,
            strategy,
            systemHealth: this.state.systemHealth.overall,
            canCancel: this.state.canCancel,
            canPause: this.state.canPause,
          });
        }
      };

      // Execute based on strategy
      switch (strategy.type) {
        case "worker_streaming":
          result = await this.processWithWorkerStreaming(
            data,
            enhancedProgressCallback,
            strategy,
          );
          break;

        case "worker_batch":
          result = await this.processWithWorker(
            data,
            enhancedProgressCallback,
            strategy,
          );
          break;

        case "streaming_fallback":
          result = await this.processWithStreamingFallback(
            data,
            enhancedProgressCallback,
            strategy,
          );
          break;

        case "basic_fallback":
          result = await this.processWithBasicFallback(
            data,
            enhancedProgressCallback,
            strategy,
          );
          break;

        default:
          throw new Error("Unknown processing strategy: " + strategy.type);
      }

      // Finalize job
      if (performanceJob) {
        this.components.performanceMonitor.endJob(jobId, {
          success: true,
          result,
        });
      }

      // Update system metrics
      this.updateSystemMetrics(result, strategy);

      return {
        ...result,
        strategy,
        systemMetrics: this.systemMetrics,
        performanceOptimized: true,
      };
    } catch (error) {
      // Handle error
      if (performanceJob) {
        this.components.performanceMonitor.endJob(jobId, {
          success: false,
          error: error.message,
        });
      }

      this.notifyEventHandlers("error", { jobId, error });
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.canCancel = false;
      this.state.canPause = false;
      this.state.currentJobId = null;
    }
  }

  /**
   * Select optimal processing strategy
   */
  selectProcessingStrategy(data) {
    const dataSize = this.calculateDataSize(data);
    const memoryAvailable = this.getAvailableMemory();
    const systemLoad = this.getSystemLoad();

    // Strategy selection logic
    if (
      this.components.workerManager &&
      this.components.streamingManager &&
      dataSize > 1000 &&
      memoryAvailable > 200 * 1024 * 1024
    ) {
      return {
        type: "worker_streaming",
        reason:
          "Large dataset with sufficient memory, using worker + streaming",
        dataSize,
        memoryAvailable,
      };
    }

    if (this.components.workerManager && dataSize > 500) {
      return {
        type: "worker_batch",
        reason: "Medium dataset, using worker batch processing",
        dataSize,
        memoryAvailable,
      };
    }

    if (this.components.streamingManager && dataSize > 100) {
      return {
        type: "streaming_fallback",
        reason: "Using streaming fallback for medium dataset",
        dataSize,
        systemLoad,
      };
    }

    return {
      type: "basic_fallback",
      reason: "Small dataset or limited resources, using basic fallback",
      dataSize,
      systemLoad,
    };
  }

  /**
   * Process with Worker + Streaming (optimal)
   */
  async processWithWorkerStreaming(data, progressCallback, strategy) {
    console.log("🚀 Processing with Worker + Streaming optimization");

    // Start streaming
    const streamId = "ml_" + Date.now();
    const stream = await this.components.streamingManager.streamMLResults(
      streamId,
      data,
      progressCallback,
    );

    // Process with worker
    const workerResult =
      await this.components.workerManager.processMLPredictions(
        data,
        (progress) => {
          progressCallback({
            ...progress,
            stage: "worker_processing",
            optimization: "worker_streaming",
          });
        },
      );

    return {
      success: true,
      data: workerResult.results,
      method: "worker_streaming",
      streamId,
      processingTime: workerResult.processingTime,
      memoryInfo: workerResult.memoryInfo,
      performanceStats: {
        memoryEfficiency: this.calculateMemoryEfficiency(),
        streamingEnabled: true,
        workerUsed: true,
        cacheHitRate: this.calculateCacheHitRate(),
      },
    };
  }

  /**
   * Process with Worker only
   */
  async processWithWorker(data, progressCallback, strategy) {
    console.log("👷 Processing with Worker optimization");

    const result = await this.components.workerManager.processMLPredictions(
      data,
      (progress) => {
        progressCallback({
          ...progress,
          stage: "worker_processing",
          optimization: "worker_batch",
        });
      },
    );

    return {
      success: true,
      data: result.results,
      method: "worker_batch",
      processingTime: result.processingTime,
      memoryInfo: result.memoryInfo,
      performanceStats: {
        memoryEfficiency: this.calculateMemoryEfficiency(),
        streamingEnabled: false,
        workerUsed: true,
        cacheHitRate: this.calculateCacheHitRate(),
      },
    };
  }

  /**
   * Process with Streaming fallback
   */
  async processWithStreamingFallback(data, progressCallback, strategy) {
    console.log("🌊 Processing with Streaming fallback");

    const streamId = "fallback_" + Date.now();
    const stream = await this.components.streamingManager.streamMLResults(
      streamId,
      data,
      (progress) => {
        progressCallback({
          ...progress,
          stage: "streaming_processing",
          optimization: "streaming_fallback",
        });
      },
    );

    // Wait for stream completion
    return new Promise((resolve, reject) => {
      const unsubscribe = this.components.streamingManager.subscribeToStream(
        streamId,
        (data, metadata) => {
          if (metadata.type === "complete") {
            unsubscribe();
            resolve({
              success: true,
              data: data.results || {},
              method: "streaming_fallback",
              processingTime: data.processingTime,
              performanceStats: {
                memoryEfficiency: this.calculateMemoryEfficiency(),
                streamingEnabled: true,
                workerUsed: false,
                cacheHitRate: this.calculateCacheHitRate(),
              },
            });
          } else if (metadata.type === "error") {
            unsubscribe();
            reject(new Error(data.message || "Streaming failed"));
          }
        },
      );
    });
  }

  /**
   * Process with basic fallback
   */
  async processWithBasicFallback(data, progressCallback, strategy) {
    console.log("🔄 Processing with basic fallback");

    // Use the existing schedule generator as fallback
    const { ScheduleGenerator } = await import("../core/ScheduleGenerator");
    const generator = new ScheduleGenerator();
    await generator.initialize();

    const result = await generator.generateScheduleWithStrategy(
      data.scheduleData,
      data.staffMembers,
      data.dateRange,
      "balanced",
      (progress) => {
        progressCallback({
          progress: progress.progress || 0,
          stage: "basic_processing",
          message: progress.message || "基本処理中...",
          optimization: "basic_fallback",
        });
      },
    );

    return {
      success: true,
      data: result.schedule,
      method: "basic_fallback",
      processingTime: result.processingTime || 0,
      performanceStats: {
        memoryEfficiency: this.calculateMemoryEfficiency(),
        streamingEnabled: false,
        workerUsed: false,
        cacheHitRate: 0,
      },
    };
  }

  /**
   * Cancel current processing
   */
  async cancelProcessing() {
    if (!this.state.isProcessing || !this.state.canCancel) {
      return { success: false, reason: "No cancellable processing" };
    }

    try {
      console.log("🛑 Cancelling AI processing...");

      // Cancel worker if active
      if (this.components.workerManager) {
        await this.components.workerManager.cancelProcessing();
      }

      // Cancel performance monitoring
      if (this.components.performanceMonitor && this.state.currentJobId) {
        this.components.performanceMonitor.cancelJob(
          this.state.currentJobId,
          "user_cancelled",
        );
      }

      this.notifyEventHandlers("cancel", { jobId: this.state.currentJobId });
      return { success: true };
    } catch (error) {
      console.error("Failed to cancel processing:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause current processing
   */
  async pauseProcessing() {
    if (!this.state.canPause || this.state.isPaused) {
      return { success: false, reason: "Cannot pause current processing" };
    }

    try {
      console.log("⏸️ Pausing AI processing...");
      this.state.isPaused = true;
      this.notifyEventHandlers("pause", { jobId: this.state.currentJobId });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume paused processing
   */
  async resumeProcessing() {
    if (!this.state.isPaused) {
      return { success: false, reason: "No paused processing to resume" };
    }

    try {
      console.log("▶️ Resuming AI processing...");
      this.state.isPaused = false;
      this.notifyEventHandlers("resume", { jobId: this.state.currentJobId });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    const health = {
      overall: "good",
      components: {},
      lastCheck: Date.now(),
      recommendations: [],
    };

    try {
      // Check memory manager
      if (this.components.memoryManager) {
        const memoryStats = this.components.memoryManager.getMemoryStats();
        health.components.memory = {
          status:
            memoryStats.memoryUtilization > 90
              ? "critical"
              : memoryStats.memoryUtilization > 70
                ? "warning"
                : "good",
          utilization: memoryStats.memoryUtilization,
          totalBytes: memoryStats.currentMemoryUsage,
        };
      }

      // Check worker manager
      if (this.components.workerManager) {
        const workerStatus = await this.components.workerManager.getStatus();
        health.components.worker = {
          status: workerStatus.initialized ? "good" : "warning",
          method: workerStatus.method || "unknown",
        };
      }

      // Check performance monitor
      if (this.components.performanceMonitor) {
        const perfReport =
          this.components.performanceMonitor.getPerformanceReport();
        health.components.performance = {
          status: perfReport.recentAlerts?.length > 0 ? "warning" : "good",
          averageProcessingTime: perfReport.metrics.averageProcessingTime,
        };
      }

      // Check streaming manager
      if (this.components.streamingManager) {
        const streamStats = this.components.streamingManager.getStreamStats();
        health.components.streaming = {
          status: streamStats.activeStreams > 0 ? "active" : "ready",
          activeStreams: streamStats.activeStreams,
        };
      }

      // Determine overall health
      const componentStatuses = Object.values(health.components).map(
        (c) => c.status,
      );
      if (componentStatuses.includes("critical")) {
        health.overall = "critical";
      } else if (componentStatuses.includes("warning")) {
        health.overall = "warning";
      }

      // Generate recommendations
      health.recommendations = this.generateHealthRecommendations(health);
    } catch (error) {
      console.error("Health check failed:", error);
      health.overall = "error";
      health.error = error.message;
    }

    return health;
  }

  /**
   * Generate health recommendations
   */
  generateHealthRecommendations(health) {
    const recommendations = [];

    if (health.components.memory?.utilization > 80) {
      recommendations.push({
        type: "memory",
        severity: "warning",
        message:
          "メモリ使用量が高くなっています。メモリクリーンアップを実行してください。",
        action: "cleanup_memory",
      });
    }

    if (health.components.performance?.averageProcessingTime > 30000) {
      recommendations.push({
        type: "performance",
        severity: "info",
        message:
          "処理時間が長くなっています。Web Workerの使用を検討してください。",
        action: "enable_workers",
      });
    }

    return recommendations;
  }

  /**
   * Optimize performance based on current conditions
   */
  async optimizePerformance() {
    console.log("🔧 Running automatic performance optimization...");

    try {
      // Memory cleanup
      if (this.components.memoryManager) {
        await this.components.memoryManager.performMemoryCleanup();
      }

      // Worker memory cleanup
      if (this.components.workerManager) {
        await this.components.workerManager.performMemoryCleanup();
      }

      console.log("✅ Performance optimization completed");
    } catch (error) {
      console.warn("Performance optimization failed:", error);
    }
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure(stats) {
    console.warn("🚨 Memory pressure detected:", stats);

    this.notifyEventHandlers("alert", {
      type: "memory_pressure",
      severity: "warning",
      message: "メモリ使用量が高くなっています",
      stats,
    });

    // Auto-optimize if not processing
    if (!this.state.isProcessing) {
      this.optimizePerformance();
    }
  }

  /**
   * Handle system alerts
   */
  handleSystemAlert(alert) {
    this.notifyEventHandlers("alert", alert);
  }

  /**
   * Utility functions
   */
  calculateDataSize(data) {
    const { staffMembers = [], dateRange = [] } = data;
    return staffMembers.length * dateRange.length;
  }

  getAvailableMemory() {
    if (performance.memory) {
      return (
        performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize
      );
    }
    return this.config.maxMemoryMB * 1024 * 1024; // Fallback estimate
  }

  getSystemLoad() {
    // Simplified system load calculation
    return Math.random() * 0.5; // Mock implementation
  }

  estimateProcessingTime(data) {
    const dataSize = this.calculateDataSize(data);
    return Math.max(5000, dataSize * 10); // Rough estimate: 10ms per cell
  }

  calculateMemoryEfficiency() {
    if (this.components.memoryManager) {
      const stats = this.components.memoryManager.getMemoryStats();
      return Math.max(0, 100 - stats.memoryUtilization);
    }
    return 75; // Default estimate
  }

  calculateCacheHitRate() {
    if (this.components.streamingManager) {
      const stats = this.components.streamingManager.getStreamStats();
      const total = stats.cacheHits + stats.cacheMisses;
      return total > 0 ? Math.round((stats.cacheHits / total) * 100) : 0;
    }
    return 0;
  }

  updateSystemMetrics(result, strategy) {
    this.systemMetrics.totalJobs++;
    if (result.success) {
      this.systemMetrics.successfulJobs++;
    }

    if (result.processingTime) {
      const totalTime =
        this.systemMetrics.averageJobTime * (this.systemMetrics.totalJobs - 1) +
        result.processingTime;
      this.systemMetrics.averageJobTime = Math.round(
        totalTime / this.systemMetrics.totalJobs,
      );
    }
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
   * Get system status for UI
   */
  getSystemStatus() {
    return {
      type: "enhanced",
      initialized: this.isInitialized,
      isProcessing: this.state.isProcessing,
      canCancel: this.state.canCancel,
      canPause: this.state.canPause,
      isPaused: this.state.isPaused,
      health: this.state.systemHealth,
      systemMetrics: this.systemMetrics,
      memoryManager: !!this.components.memoryManager,
      streaming: !!this.components.streamingManager,
      version: "4.0-enhanced",
    };
  }

  /**
   * Destroy all components
   */
  async destroy() {
    console.log("🧹 Destroying AI Performance Manager...");

    try {
      // Cancel any ongoing processing
      if (this.state.isProcessing) {
        await this.cancelProcessing();
      }

      // Destroy components
      const destroyPromises = [];

      Object.entries(this.components).forEach(([name, component]) => {
        if (component && typeof component.destroy === "function") {
          destroyPromises.push(
            component
              .destroy()
              .catch((error) =>
                console.warn(`Failed to destroy ${name}:`, error),
              ),
          );
        }
      });

      await Promise.allSettled(destroyPromises);

      // Clear state
      this.isInitialized = false;
      Object.keys(this.components).forEach((key) => {
        this.components[key] = null;
      });

      // Clear event handlers
      Object.values(this.eventHandlers).forEach((handlers) => handlers.clear());

      console.log("✅ AI Performance Manager destroyed");
    } catch (error) {
      console.error("Error during destruction:", error);
    }
  }
}

// Singleton instance
let performanceManagerInstance = null;

export function getAIPerformanceManager() {
  if (!performanceManagerInstance) {
    performanceManagerInstance = new AIPerformanceManager();
  }
  return performanceManagerInstance;
}

export { AIPerformanceManager };
