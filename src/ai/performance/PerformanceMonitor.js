/**
 * PerformanceMonitor.js
 * 
 * Comprehensive performance monitoring and progress tracking system.
 * Monitors ML processing, memory usage, UI responsiveness, and user experience.
 */

class PerformanceMonitor {
  constructor() {
    this.isInitialized = false;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    // Performance metrics
    this.metrics = {
      // Processing performance
      processingTimes: [],
      averageProcessingTime: 0,
      totalProcessingJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      
      // Memory metrics
      memoryUsage: {
        peak: 0,
        average: 0,
        current: 0,
        samples: []
      },
      
      // UI responsiveness metrics
      uiResponsiveness: {
        frameDrops: 0,
        longTasks: 0,
        averageFrameTime: 16.67, // Target 60fps
        worstFrameTime: 0
      },
      
      // Resource utilization
      resourceUtilization: {
        cpu: { samples: [], average: 0 },
        memory: { samples: [], average: 0 },
        network: { requests: 0, failures: 0 }
      },
      
      // User experience metrics
      userExperience: {
        totalWaitTime: 0,
        averageWaitTime: 0,
        userInteractions: 0,
        blockedInteractions: 0
      }
    };

    // Performance thresholds
    this.thresholds = {
      processingTime: {
        good: 5000,    // Under 5 seconds
        acceptable: 15000, // Under 15 seconds
        poor: 30000    // Over 30 seconds
      },
      memoryUsage: {
        good: 200 * 1024 * 1024,      // Under 200MB
        acceptable: 400 * 1024 * 1024, // Under 400MB
        poor: 600 * 1024 * 1024       // Over 600MB
      },
      frameTime: {
        good: 16.67,   // 60fps
        acceptable: 33.33, // 30fps
        poor: 66.67    // 15fps
      }
    };

    // Progress tracking
    this.progressTracking = {
      currentJob: null,
      jobs: new Map(),
      progressCallbacks: new Set(),
      stageTimings: new Map()
    };

    // Performance observers
    this.observers = {
      longTask: null,
      navigation: null,
      measure: null,
      layout: null
    };

    // Alerts and notifications
    this.alertCallbacks = new Set();
    this.alertHistory = [];
    
    // Benchmarking
    this.benchmarks = {
      baseline: null,
      history: [],
      regressions: []
    };

    // Configuration
    this.config = {
      monitoringIntervalMs: 1000,
      sampleRetentionCount: 100,
      alertThresholds: {
        memoryIncrease: 50 * 1024 * 1024, // 50MB sudden increase
        processingTimeIncrease: 5000,      // 5 second increase
        frameDropThreshold: 5              // 5 consecutive dropped frames
      }
    };
  }

  /**
   * Initialize performance monitoring
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('📊 Initializing Performance Monitor...');

      // Apply configuration
      Object.assign(this.config, options.config || {});
      Object.assign(this.thresholds, options.thresholds || {});

      // Setup performance observers
      await this.setupPerformanceObservers();

      // Setup monitoring timers
      this.setupMonitoringTimers();

      // Initialize baseline benchmarks
      await this.establishBaseline();

      this.isInitialized = true;
      this.isMonitoring = true;

      console.log('✅ Performance Monitor initialized:', {
        monitoringInterval: this.config.monitoringIntervalMs + 'ms',
        observersActive: Object.values(this.observers).filter(Boolean).length
      });

      return { success: true, observers: this.getObserverStatus() };

    } catch (error) {
      console.error('❌ Performance Monitor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup performance observers
   */
  async setupPerformanceObservers() {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported, limited monitoring available');
      return;
    }

    try {
      // Long Task Observer - detect blocking tasks
      this.observers.longTask = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleLongTask(entry);
        }
      });
      this.observers.longTask.observe({ type: 'longtask', buffered: false });

      // Navigation Timing Observer
      this.observers.navigation = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleNavigationTiming(entry);
        }
      });
      this.observers.navigation.observe({ type: 'navigation', buffered: true });

      // Measure Observer - custom performance measurements
      this.observers.measure = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleCustomMeasure(entry);
        }
      });
      this.observers.measure.observe({ type: 'measure', buffered: false });

      // Layout Shift Observer (if available)
      if ('layout-shift' in PerformanceObserver.supportedEntryTypes) {
        this.observers.layout = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleLayoutShift(entry);
          }
        });
        this.observers.layout.observe({ type: 'layout-shift', buffered: false });
      }

    } catch (error) {
      console.warn('Failed to setup some performance observers:', error);
    }
  }

  /**
   * Setup monitoring timers
   */
  setupMonitoringTimers() {
    // Main monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.checkThresholds();
    }, this.config.monitoringIntervalMs);

    // Frame rate monitoring
    this.setupFrameRateMonitoring();
  }

  /**
   * Setup frame rate monitoring
   */
  setupFrameRateMonitoring() {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let totalFrameTime = 0;

    const measureFrame = (currentTime) => {
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      frameCount++;
      totalFrameTime += frameTime;

      // Track frame performance
      if (frameTime > this.thresholds.frameTime.poor) {
        this.metrics.uiResponsiveness.frameDrops++;
        this.metrics.uiResponsiveness.worstFrameTime = Math.max(
          this.metrics.uiResponsiveness.worstFrameTime, 
          frameTime
        );
      }

      // Update average every 60 frames
      if (frameCount % 60 === 0) {
        this.metrics.uiResponsiveness.averageFrameTime = totalFrameTime / frameCount;
        totalFrameTime = 0;
        frameCount = 0;
      }

      // Continue monitoring
      if (this.isMonitoring) {
        requestAnimationFrame(measureFrame);
      }
    };

    requestAnimationFrame(measureFrame);
  }

  /**
   * Start tracking a processing job
   */
  startJob(jobId, options = {}) {
    const job = {
      id: jobId,
      startTime: performance.now(),
      stages: [],
      currentStage: null,
      metadata: options.metadata || {},
      estimatedDuration: options.estimatedDuration || null,
      priority: options.priority || 'normal'
    };

    this.progressTracking.jobs.set(jobId, job);
    this.progressTracking.currentJob = jobId;

    // Mark performance start
    performance.mark(`job-start-${jobId}`);

    console.log(`📋 Started tracking job: ${jobId}`);
    return job;
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId, progress, stageInfo = {}) {
    const job = this.progressTracking.jobs.get(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found for progress update`);
      return;
    }

    const now = performance.now();
    const elapsed = now - job.startTime;

    // Update stage if provided
    if (stageInfo.stage && stageInfo.stage !== job.currentStage) {
      // End previous stage
      if (job.currentStage) {
        const stageKey = `${jobId}-${job.currentStage}`;
        if (this.progressTracking.stageTimings.has(stageKey)) {
          const stageStart = this.progressTracking.stageTimings.get(stageKey);
          job.stages.push({
            stage: job.currentStage,
            duration: now - stageStart,
            completed: true
          });
        }
      }

      // Start new stage
      job.currentStage = stageInfo.stage;
      this.progressTracking.stageTimings.set(`${jobId}-${stageInfo.stage}`, now);
      performance.mark(`job-stage-${jobId}-${stageInfo.stage}`);
    }

    // Update progress
    job.progress = Math.max(0, Math.min(100, progress));
    job.lastUpdate = now;
    job.elapsedTime = elapsed;

    // Calculate ETA
    if (job.progress > 0) {
      job.estimatedTimeRemaining = (elapsed / job.progress) * (100 - job.progress);
    }

    // Notify progress callbacks
    this.notifyProgressCallbacks({
      jobId,
      progress: job.progress,
      stage: job.currentStage,
      elapsedTime: elapsed,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
      message: stageInfo.message || '',
      stats: stageInfo.stats || {}
    });

    // Check for performance issues
    this.checkJobPerformance(job);
  }

  /**
   * End job tracking
   */
  endJob(jobId, result = {}) {
    const job = this.progressTracking.jobs.get(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found for completion`);
      return;
    }

    const now = performance.now();
    const totalDuration = now - job.startTime;

    // End current stage
    if (job.currentStage) {
      const stageKey = `${jobId}-${job.currentStage}`;
      if (this.progressTracking.stageTimings.has(stageKey)) {
        const stageStart = this.progressTracking.stageTimings.get(stageKey);
        job.stages.push({
          stage: job.currentStage,
          duration: now - stageStart,
          completed: true
        });
      }
    }

    // Finalize job
    job.endTime = now;
    job.totalDuration = totalDuration;
    job.completed = true;
    job.success = result.success !== false;
    job.result = result;

    // Mark performance end
    performance.mark(`job-end-${jobId}`);
    performance.measure(`job-total-${jobId}`, `job-start-${jobId}`, `job-end-${jobId}`);

    // Update metrics
    this.updateProcessingMetrics(job);

    // Cleanup
    this.progressTracking.jobs.delete(jobId);
    if (this.progressTracking.currentJob === jobId) {
      this.progressTracking.currentJob = null;
    }

    console.log(`✅ Completed tracking job: ${jobId} in ${Math.round(totalDuration)}ms`);
    return job;
  }

  /**
   * Cancel job tracking
   */
  cancelJob(jobId, reason = 'cancelled') {
    const job = this.progressTracking.jobs.get(jobId);
    if (job) {
      job.cancelled = true;
      job.cancelReason = reason;
      this.endJob(jobId, { success: false, cancelled: true, reason });
      this.metrics.cancelledJobs++;
    }
  }

  /**
   * Collect current metrics
   */
  collectMetrics() {
    try {
      // Memory metrics
      if ('memory' in performance) {
        const memInfo = performance.memory;
        const currentMemory = memInfo.usedJSHeapSize;
        
        this.metrics.memoryUsage.current = currentMemory;
        this.metrics.memoryUsage.peak = Math.max(this.metrics.memoryUsage.peak, currentMemory);
        this.metrics.memoryUsage.samples.push({
          timestamp: Date.now(),
          memory: currentMemory
        });

        // Keep only recent samples
        if (this.metrics.memoryUsage.samples.length > this.config.sampleRetentionCount) {
          this.metrics.memoryUsage.samples.shift();
        }

        // Update average
        this.metrics.memoryUsage.average = this.metrics.memoryUsage.samples.reduce(
          (sum, sample) => sum + sample.memory, 0
        ) / this.metrics.memoryUsage.samples.length;
      }

      // CPU utilization (approximation using navigation timing)
      this.collectCPUMetrics();

    } catch (error) {
      console.warn('Error collecting metrics:', error);
    }
  }

  /**
   * Collect CPU metrics (approximation)
   */
  collectCPUMetrics() {
    // Use paint timing as CPU utilization approximation
    const paintEntries = performance.getEntriesByType('paint');
    if (paintEntries.length > 0) {
      const paintTime = paintEntries[paintEntries.length - 1].startTime;
      this.metrics.resourceUtilization.cpu.samples.push({
        timestamp: Date.now(),
        paintTime
      });

      if (this.metrics.resourceUtilization.cpu.samples.length > this.config.sampleRetentionCount) {
        this.metrics.resourceUtilization.cpu.samples.shift();
      }
    }
  }

  /**
   * Analyze current performance
   */
  analyzePerformance() {
    // Detect performance regressions
    this.detectRegressions();

    // Analyze memory trends
    this.analyzeMemoryTrends();

    // Check for resource bottlenecks
    this.checkResourceBottlenecks();
  }

  /**
   * Check performance thresholds
   */
  checkThresholds() {
    const alerts = [];

    // Check memory threshold
    if (this.metrics.memoryUsage.current > this.thresholds.memoryUsage.poor) {
      alerts.push({
        type: 'memory_high',
        severity: 'critical',
        message: `High memory usage: ${Math.round(this.metrics.memoryUsage.current / 1024 / 1024)}MB`,
        threshold: this.thresholds.memoryUsage.poor,
        current: this.metrics.memoryUsage.current
      });
    }

    // Check frame rate threshold
    if (this.metrics.uiResponsiveness.averageFrameTime > this.thresholds.frameTime.poor) {
      alerts.push({
        type: 'frame_rate_low',
        severity: 'warning',
        message: `Low frame rate: ${Math.round(1000 / this.metrics.uiResponsiveness.averageFrameTime)}fps`,
        threshold: this.thresholds.frameTime.poor,
        current: this.metrics.uiResponsiveness.averageFrameTime
      });
    }

    // Check processing time threshold
    if (this.metrics.averageProcessingTime > this.thresholds.processingTime.poor) {
      alerts.push({
        type: 'processing_slow',
        severity: 'warning',
        message: `Slow processing: ${Math.round(this.metrics.averageProcessingTime)}ms average`,
        threshold: this.thresholds.processingTime.poor,
        current: this.metrics.averageProcessingTime
      });
    }

    // Fire alerts
    if (alerts.length > 0) {
      this.fireAlerts(alerts);
    }
  }

  /**
   * Detect performance regressions
   */
  detectRegressions() {
    if (!this.benchmarks.baseline || this.metrics.processingTimes.length === 0) {
      return;
    }

    const recentAverage = this.metrics.processingTimes
      .slice(-10)
      .reduce((sum, time) => sum + time, 0) / Math.min(10, this.metrics.processingTimes.length);

    const regression = recentAverage - this.benchmarks.baseline.averageProcessingTime;

    if (regression > this.config.alertThresholds.processingTimeIncrease) {
      this.benchmarks.regressions.push({
        timestamp: Date.now(),
        type: 'processing_time',
        regression,
        baseline: this.benchmarks.baseline.averageProcessingTime,
        current: recentAverage
      });

      this.fireAlerts([{
        type: 'performance_regression',
        severity: 'warning',
        message: `Performance regression detected: ${Math.round(regression)}ms slower than baseline`,
        regression,
        baseline: this.benchmarks.baseline.averageProcessingTime
      }]);
    }
  }

  /**
   * Analyze memory trends
   */
  analyzeMemoryTrends() {
    if (this.metrics.memoryUsage.samples.length < 10) return;

    const recent = this.metrics.memoryUsage.samples.slice(-10);
    const older = this.metrics.memoryUsage.samples.slice(-20, -10);

    if (older.length === 0) return;

    const recentAverage = recent.reduce((sum, sample) => sum + sample.memory, 0) / recent.length;
    const olderAverage = older.reduce((sum, sample) => sum + sample.memory, 0) / older.length;

    const memoryIncrease = recentAverage - olderAverage;

    if (memoryIncrease > this.config.alertThresholds.memoryIncrease) {
      this.fireAlerts([{
        type: 'memory_leak_suspected',
        severity: 'warning',
        message: `Suspected memory leak: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase`,
        increase: memoryIncrease,
        recentAverage,
        olderAverage
      }]);
    }
  }

  /**
   * Check for resource bottlenecks
   */
  checkResourceBottlenecks() {
    // Check for consistent long tasks
    if (this.metrics.uiResponsiveness.longTasks > 5) {
      this.fireAlerts([{
        type: 'ui_blocking',
        severity: 'critical',
        message: `UI blocking detected: ${this.metrics.uiResponsiveness.longTasks} long tasks`,
        longTasks: this.metrics.uiResponsiveness.longTasks
      }]);
      
      // Reset counter
      this.metrics.uiResponsiveness.longTasks = 0;
    }
  }

  /**
   * Handle long task detection
   */
  handleLongTask(entry) {
    this.metrics.uiResponsiveness.longTasks++;
    
    console.warn('🐌 Long task detected:', {
      duration: Math.round(entry.duration) + 'ms',
      startTime: Math.round(entry.startTime),
      name: entry.name
    });

    // Fire immediate alert for very long tasks
    if (entry.duration > 500) {
      this.fireAlerts([{
        type: 'very_long_task',
        severity: 'critical',
        message: `Very long task: ${Math.round(entry.duration)}ms`,
        duration: entry.duration,
        immediate: true
      }]);
    }
  }

  /**
   * Handle navigation timing
   */
  handleNavigationTiming(entry) {
    console.log('📊 Navigation timing:', {
      loadTime: Math.round(entry.loadEventEnd - entry.fetchStart),
      domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.fetchStart),
      firstByte: Math.round(entry.responseStart - entry.fetchStart)
    });
  }

  /**
   * Handle custom performance measures
   */
  handleCustomMeasure(entry) {
    if (entry.name.startsWith('job-total-')) {
      const jobId = entry.name.replace('job-total-', '');
      console.log(`⏱️ Job ${jobId} completed in ${Math.round(entry.duration)}ms`);
    }
  }

  /**
   * Handle layout shift
   */
  handleLayoutShift(entry) {
    if (entry.value > 0.1) { // Significant layout shift
      console.warn('📐 Layout shift detected:', {
        value: entry.value,
        sources: entry.sources?.length || 0
      });
    }
  }

  /**
   * Update processing metrics
   */
  updateProcessingMetrics(job) {
    this.metrics.totalProcessingJobs++;
    
    if (job.success) {
      this.metrics.successfulJobs++;
    } else {
      this.metrics.failedJobs++;
    }

    this.metrics.processingTimes.push(job.totalDuration);
    
    // Keep only recent processing times
    if (this.metrics.processingTimes.length > this.config.sampleRetentionCount) {
      this.metrics.processingTimes.shift();
    }

    // Update average
    this.metrics.averageProcessingTime = this.metrics.processingTimes.reduce(
      (sum, time) => sum + time, 0
    ) / this.metrics.processingTimes.length;

    // Update user experience metrics
    this.metrics.userExperience.totalWaitTime += job.totalDuration;
    this.metrics.userExperience.averageWaitTime = 
      this.metrics.userExperience.totalWaitTime / this.metrics.totalProcessingJobs;
  }

  /**
   * Check job performance for issues
   */
  checkJobPerformance(job) {
    // Check if job is taking too long
    if (job.elapsedTime > this.thresholds.processingTime.poor && job.progress < 90) {
      this.fireAlerts([{
        type: 'job_slow',
        severity: 'warning',
        message: `Job ${job.id} is taking longer than expected`,
        jobId: job.id,
        elapsedTime: job.elapsedTime,
        progress: job.progress
      }]);
    }

    // Check if job is stuck
    if (job.progress > 0 && job.lastUpdate && 
        (performance.now() - job.lastUpdate) > 30000) { // 30 seconds no update
      this.fireAlerts([{
        type: 'job_stuck',
        severity: 'critical',
        message: `Job ${job.id} appears to be stuck`,
        jobId: job.id,
        lastUpdate: job.lastUpdate,
        progress: job.progress
      }]);
    }
  }

  /**
   * Fire performance alerts
   */
  fireAlerts(alerts) {
    for (const alert of alerts) {
      alert.timestamp = Date.now();
      this.alertHistory.push(alert);
      
      // Keep only recent alerts
      if (this.alertHistory.length > 100) {
        this.alertHistory.shift();
      }

      // Notify callbacks
      for (const callback of this.alertCallbacks) {
        try {
          callback(alert);
        } catch (error) {
          console.warn('Alert callback failed:', error);
        }
      }

      // Log alert
      const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
      console[logLevel](`🚨 Performance Alert (${alert.severity}):`, alert.message);
    }
  }

  /**
   * Notify progress callbacks
   */
  notifyProgressCallbacks(progressData) {
    for (const callback of this.progressTracking.progressCallbacks) {
      try {
        callback(progressData);
      } catch (error) {
        console.warn('Progress callback failed:', error);
      }
    }
  }

  /**
   * Establish baseline performance
   */
  async establishBaseline() {
    if (this.metrics.totalProcessingJobs > 0) {
      this.benchmarks.baseline = {
        timestamp: Date.now(),
        averageProcessingTime: this.metrics.averageProcessingTime,
        averageMemoryUsage: this.metrics.memoryUsage.average,
        averageFrameTime: this.metrics.uiResponsiveness.averageFrameTime
      };
      
      console.log('📊 Performance baseline established:', this.benchmarks.baseline);
    }
  }

  /**
   * Register progress callback
   */
  onProgress(callback) {
    this.progressTracking.progressCallbacks.add(callback);
    return () => this.progressTracking.progressCallbacks.delete(callback);
  }

  /**
   * Register alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  /**
   * Get current performance report
   */
  getPerformanceReport() {
    return {
      timestamp: Date.now(),
      metrics: this.metrics,
      thresholds: this.thresholds,
      currentJobs: Array.from(this.progressTracking.jobs.values()),
      recentAlerts: this.alertHistory.slice(-10),
      benchmarks: this.benchmarks,
      isMonitoring: this.isMonitoring,
      observerStatus: this.getObserverStatus()
    };
  }

  /**
   * Get observer status
   */
  getObserverStatus() {
    return {
      longTask: !!this.observers.longTask,
      navigation: !!this.observers.navigation,
      measure: !!this.observers.measure,
      layout: !!this.observers.layout
    };
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      exportTimestamp: Date.now(),
      metrics: this.metrics,
      alertHistory: this.alertHistory,
      benchmarks: this.benchmarks,
      config: this.config,
      thresholds: this.thresholds
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Disconnect observers
    Object.values(this.observers).forEach(observer => {
      if (observer) {
        observer.disconnect();
      }
    });

    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Destroy performance monitor
   */
  async destroy() {
    console.log('🧹 Destroying Performance Monitor...');

    this.stopMonitoring();

    // Clear callbacks
    this.progressTracking.progressCallbacks.clear();
    this.alertCallbacks.clear();

    // Clear data
    this.progressTracking.jobs.clear();
    this.alertHistory = [];

    this.isInitialized = false;
    console.log('✅ Performance Monitor destroyed');
  }
}

// Singleton instance
let performanceMonitorInstance = null;

export function getPerformanceMonitor() {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

export { PerformanceMonitor };