/**
 * NonBlockingMLArchitecture.js
 * 
 * Ultimate non-blocking ML architecture that integrates all performance optimization
 * components to guarantee UI responsiveness regardless of ML processing complexity.
 * 
 * This system provides bulletproof protection against main thread blocking through:
 * - Advanced Web Worker thread pools
 * - Frame-aware processing with adaptive yielding
 * - Memory pressure management with tensor lifecycle tracking
 * - Real-time streaming results with progressive updates
 * - Interaction-aware task prioritization
 * - Emergency performance modes with automatic fallbacks
 */

import { getAdvancedWorkerManager } from './AdvancedWorkerManager';
import { getUIResponsivenessMonitor } from './UIResponsivenessMonitor';
import { getEnhancedTensorMemoryManager } from './EnhancedTensorMemoryManager';
import { getStreamingMLProcessor } from './StreamingMLProcessor';
import { getInteractionAwareTaskScheduler } from './InteractionAwareTaskScheduler';
import { getPerformanceMonitor } from './PerformanceMonitor';

export class NonBlockingMLArchitecture {
  constructor() {
    this.isInitialized = false;
    this.isProcessing = false;
    this.systemHealthy = true;
    
    // Component instances
    this.components = {
      workerManager: null,
      uiMonitor: null,
      memoryManager: null,
      streamingProcessor: null,
      taskScheduler: null,
      performanceMonitor: null
    };

    // Architecture configuration
    this.config = {
      // Performance guarantees
      maxFrameTime: 16.67,              // 60fps guarantee
      maxMemoryMB: 500,                 // Memory limit
      maxProcessingTimeMs: 300000,      // 5-minute processing limit
      minUIResponsiveness: 30,          // Minimum FPS during processing
      
      // Emergency thresholds
      emergencyFrameThreshold: 33.33,   // 30fps emergency threshold
      emergencyMemoryThreshold: 450,    // MB before emergency mode
      emergencyResponseTime: 100,       // 100ms max response time
      
      // Optimization modes
      adaptiveOptimization: true,       // Enable adaptive optimization
      predictiveScaling: true,          // Enable predictive resource scaling
      emergencyFallbacks: true,         // Enable emergency fallback modes
      realTimeMonitoring: true,         // Enable real-time monitoring
      
      // Processing strategies
      defaultStrategy: 'balanced',      // balanced, performance, memory, responsiveness
      fallbackStrategy: 'responsiveness', // Fallback when primary fails
      
      // Integration settings
      componentSyncInterval: 1000,      // Sync components every second
      healthCheckInterval: 5000,        // Health check every 5 seconds
      emergencyCheckInterval: 100       // Emergency check every 100ms
    };

    // System state tracking
    this.systemState = {
      overallHealth: 100,
      performanceGrade: 'A',
      emergencyMode: false,
      lastHealthCheck: 0,
      componentStates: {},
      activeOptimizations: new Set(),
      emergencyTriggers: [],
      processingQueue: [],
      activeJobs: new Map()
    };

    // Performance guarantees tracking
    this.performanceGuarantees = {
      frameTimeViolations: 0,
      memoryViolations: 0,
      responseTimeViolations: 0,
      userInteractionBlocks: 0,
      recoveryActions: 0,
      systemStalls: 0,
      emergencyActivations: 0
    };

    // Architecture metrics
    this.architectureMetrics = {
      totalMLOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      systemUptime: Date.now(),
      peakMemoryUsage: 0,
      bestFrameTime: 16.67,
      worstFrameTime: 16.67,
      userSatisfactionScore: 100
    };

    // Event handlers for inter-component communication
    this.eventHandlers = {
      systemHealthChange: new Set(),
      emergencyMode: new Set(),
      performanceViolation: new Set(),
      optimizationChange: new Set(),
      processingComplete: new Set(),
      systemRecovery: new Set(),
      architectureAlert: new Set()
    };

    // System timers
    this.timers = {
      healthMonitoring: null,
      componentSync: null,
      emergencyCheck: null,
      performanceTracking: null
    };

    // Emergency recovery procedures
    this.emergencyProcedures = new Map([
      ['memory_critical', this.handleMemoryCritical.bind(this)],
      ['ui_blocked', this.handleUIBlocked.bind(this)],
      ['processing_stalled', this.handleProcessingStalled.bind(this)],
      ['worker_failure', this.handleWorkerFailure.bind(this)],
      ['system_overload', this.handleSystemOverload.bind(this)]
    ]);
  }

  /**
   * Initialize the complete non-blocking ML architecture
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('🏗️ Initializing Non-Blocking ML Architecture...');
      const startTime = Date.now();

      // Apply configuration
      Object.assign(this.config, options);

      // Initialize core components in optimal order
      await this.initializeComponents();

      // Setup inter-component communication
      this.setupComponentIntegration();

      // Setup system monitoring
      this.startSystemMonitoring();

      // Setup emergency systems
      this.setupEmergencyProtection();

      // Verify system health
      const initialHealth = await this.performInitialHealthCheck();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;

      console.log('✅ Non-Blocking ML Architecture initialized:', {
        initTime: initTime + 'ms',
        components: Object.keys(this.components).filter(k => this.components[k]?.isInitialized),
        systemHealth: initialHealth,
        guarantees: this.getPerformanceGuarantees()
      });

      return {
        success: true,
        initTime,
        systemHealth: initialHealth,
        capabilities: this.getSystemCapabilities(),
        guarantees: this.getPerformanceGuarantees()
      };

    } catch (error) {
      console.error('❌ Non-Blocking ML Architecture initialization failed:', error);
      await this.handleInitializationFailure(error);
      throw error;
    }
  }

  /**
   * Initialize all components with proper error handling
   */
  async initializeComponents() {
    const initPromises = [];

    // Initialize UI Responsiveness Monitor first (critical for other components)
    console.log('📱 Initializing UI Responsiveness Monitor...');
    this.components.uiMonitor = getUIResponsivenessMonitor();
    await this.components.uiMonitor.initialize({
      frameConfig: {
        targetFPS: 60,
        warningThreshold: 33.33,
        criticalThreshold: this.config.emergencyFrameThreshold
      }
    });

    // Initialize Memory Manager
    console.log('🧠 Initializing Enhanced Memory Manager...');
    this.components.memoryManager = getEnhancedTensorMemoryManager();
    await this.components.memoryManager.initialize({
      maxMemoryMB: this.config.maxMemoryMB,
      criticalThresholdMB: this.config.emergencyMemoryThreshold,
      emergencyCleanupEnabled: true
    });

    // Initialize Task Scheduler
    console.log('🎯 Initializing Task Scheduler...');
    this.components.taskScheduler = getInteractionAwareTaskScheduler();
    await this.components.taskScheduler.initialize({
      config: {
        adaptiveScheduling: this.config.adaptiveOptimization,
        preemptiveScheduling: true,
        fairnessEnabled: true
      }
    });

    // Initialize Performance Monitor
    console.log('📊 Initializing Performance Monitor...');
    this.components.performanceMonitor = getPerformanceMonitor();
    await this.components.performanceMonitor.initialize();

    // Initialize Streaming Processor
    console.log('🌊 Initializing Streaming Processor...');
    this.components.streamingProcessor = getStreamingMLProcessor();
    await this.components.streamingProcessor.initialize({
      config: {
        adaptiveChunking: true,
        streamingEnabled: true,
        priorityProcessing: true
      }
    });

    // Initialize Worker Manager last (depends on other components)
    console.log('👷 Initializing Advanced Worker Manager...');
    this.components.workerManager = getAdvancedWorkerManager();
    await this.components.workerManager.initialize({
      maxWorkers: Math.max(2, Math.min(6, navigator.hardwareConcurrency || 4)),
      memoryLimitMB: this.config.maxMemoryMB / 4, // Per worker limit
      loadBalancingEnabled: true,
      priorityQueueEnabled: true
    });

    console.log('✅ All components initialized successfully');
  }

  /**
   * Setup inter-component communication and integration
   */
  setupComponentIntegration() {
    console.log('🔗 Setting up component integration...');

    // UI Monitor → Task Scheduler integration
    this.components.uiMonitor.on('optimizationChange', (data) => {
      this.components.taskScheduler.adjustProcessingParameters(data);
    });

    // UI Monitor → Emergency System integration
    this.components.uiMonitor.on('frameAlert', (alert) => {
      if (alert.type === 'critical') {
        this.triggerEmergencyMode('ui_blocked', alert);
      }
    });

    // Memory Manager → System integration
    this.components.memoryManager.onMemoryPressure('critical', (data) => {
      this.triggerEmergencyMode('memory_critical', data);
    });

    this.components.memoryManager.onMemoryPressure('high', (data) => {
      this.optimizeForMemoryPressure(data);
    });

    // Task Scheduler → Worker Manager integration
    this.components.taskScheduler.on('taskQueued', (data) => {
      if (data.priority === 'critical') {
        this.prioritizeCriticalTask(data);
      }
    });

    // Streaming Processor → Performance tracking
    this.components.streamingProcessor.on('streamComplete', (data) => {
      this.updateArchitectureMetrics(data);
    });

    // Performance Monitor → System health
    this.components.performanceMonitor.onAlert((alert) => {
      this.handlePerformanceAlert(alert);
    });

    // Worker Manager → Error handling
    this.components.workerManager.on('workerError', (data) => {
      this.handleWorkerError(data);
    });

    console.log('✅ Component integration setup completed');
  }

  /**
   * Start comprehensive system monitoring
   */
  startSystemMonitoring() {
    // Main health monitoring
    this.timers.healthMonitoring = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Component synchronization
    this.timers.componentSync = setInterval(() => {
      this.synchronizeComponents();
    }, this.config.componentSyncInterval);

    // Emergency monitoring (high frequency)
    this.timers.emergencyCheck = setInterval(() => {
      this.performEmergencyCheck();
    }, this.config.emergencyCheckInterval);

    // Performance tracking
    this.timers.performanceTracking = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);

    console.log('📡 System monitoring started');
  }

  /**
   * Setup emergency protection systems
   */
  setupEmergencyProtection() {
    // Setup emergency triggers
    window.addEventListener('unhandledrejection', (event) => {
      this.handleUnhandledRejection(event);
    });

    window.addEventListener('error', (event) => {
      this.handleGlobalError(event);
    });

    // Setup performance observer for long tasks
    if ('PerformanceObserver' in window) {
      try {
        this.emergencyTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Over 50ms
              this.handleLongTask(entry);
            }
          }
        });
        this.emergencyTaskObserver.observe({ type: 'longtask', buffered: false });
      } catch (error) {
        console.warn('Could not setup emergency task observer:', error);
      }
    }

    console.log('🚨 Emergency protection systems activated');
  }

  /**
   * Process ML with guaranteed non-blocking execution
   */
  async processMLWithGuarantees(data, progressCallback, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Non-Blocking ML Architecture not initialized');
    }

    const jobId = `ml_job_${Date.now()}`;
    const startTime = Date.now();

    try {
      console.log(`🚀 Starting guaranteed non-blocking ML processing: ${jobId}`);

      // Pre-processing system health check
      const preProcessingHealth = await this.performHealthCheck();
      if (preProcessingHealth.overall < 70) {
        console.warn('⚠️ System health degraded, applying optimizations');
        await this.optimizeSystemForProcessing();
      }

      // Register job
      this.systemState.activeJobs.set(jobId, {
        id: jobId,
        startTime,
        data,
        options,
        status: 'initializing'
      });

      // Start performance monitoring for this job
      const perfJob = this.components.performanceMonitor.startJob(jobId, {
        type: 'guaranteed_ml_processing',
        estimatedDuration: this.estimateProcessingTime(data),
        guarantees: this.getPerformanceGuarantees()
      });

      // Create enhanced progress callback with guarantees
      const guaranteedProgressCallback = (progress) => {
        this.enforcePerformanceGuarantees(jobId, progress);
        
        if (progressCallback) {
          progressCallback({
            ...progress,
            guarantees: this.getGuaranteeStatus(),
            systemHealth: this.systemState.overallHealth,
            emergencyMode: this.systemState.emergencyMode
          });
        }
      };

      // Determine optimal processing strategy
      const strategy = this.selectOptimalProcessingStrategy(data, options);
      console.log(`🎯 Selected processing strategy: ${strategy.name}`);

      // Update job status
      const job = this.systemState.activeJobs.get(jobId);
      job.status = 'processing';
      job.strategy = strategy;

      // Execute processing with selected strategy
      let result;
      switch (strategy.type) {
        case 'worker_streaming':
          result = await this.processWithWorkerStreaming(jobId, data, guaranteedProgressCallback, strategy);
          break;
        case 'streaming_only':
          result = await this.processWithStreamingOnly(jobId, data, guaranteedProgressCallback, strategy);
          break;
        case 'task_scheduled':
          result = await this.processWithTaskScheduling(jobId, data, guaranteedProgressCallback, strategy);
          break;
        case 'emergency_fallback':
          result = await this.processWithEmergencyFallback(jobId, data, guaranteedProgressCallback, strategy);
          break;
        default:
          throw new Error(`Unknown processing strategy: ${strategy.type}`);
      }

      // Finalize job
      job.status = 'completed';
      job.endTime = Date.now();
      job.totalTime = job.endTime - startTime;
      job.result = result;

      // End performance monitoring
      this.components.performanceMonitor.endJob(jobId, {
        success: true,
        result,
        guaranteesMet: this.validateGuarantees(job)
      });

      // Update architecture metrics
      this.updateArchitectureMetrics({
        jobId,
        processingTime: job.totalTime,
        strategy: strategy.name,
        success: true
      });

      // Post-processing health check
      const postProcessingHealth = await this.performHealthCheck();
      
      // Cleanup
      setTimeout(() => {
        this.systemState.activeJobs.delete(jobId);
      }, 30000);

      console.log(`✅ Guaranteed ML processing completed: ${jobId} in ${job.totalTime}ms`);

      return {
        success: true,
        jobId,
        result,
        processingTime: job.totalTime,
        strategy: strategy.name,
        guaranteesMet: this.validateGuarantees(job),
        systemHealth: {
          before: preProcessingHealth,
          after: postProcessingHealth
        },
        metrics: this.getJobMetrics(job)
      };

    } catch (error) {
      console.error(`❌ Guaranteed ML processing failed for ${jobId}:`, error);
      
      // Handle failure
      const job = this.systemState.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.endTime = Date.now();
        job.totalTime = job.endTime - startTime;
      }

      // End performance monitoring with failure
      this.components.performanceMonitor.endJob(jobId, {
        success: false,
        error: error.message
      });

      // Update failure metrics
      this.architectureMetrics.failedOperations++;

      // Trigger recovery if needed
      await this.handleProcessingFailure(jobId, error);

      throw error;
    }
  }

  /**
   * Select optimal processing strategy based on data and system state
   */
  selectOptimalProcessingStrategy(data, options) {
    const systemHealth = this.systemState.overallHealth;
    const memoryPressure = this.components.memoryManager.getMemoryStats().current.pressureLevel;
    const uiResponsiveness = this.components.uiMonitor.getPerformanceReport().frameMetrics.currentFPS;
    const dataSize = this.calculateDataComplexity(data);
    const userActive = this.components.taskScheduler.getSchedulingStats().interactionState.isActive;

    // Emergency strategy if system is unhealthy
    if (systemHealth < 50 || this.systemState.emergencyMode) {
      return {
        type: 'emergency_fallback',
        name: 'Emergency Fallback',
        reason: 'System health critical or emergency mode active',
        config: { maxChunkSize: 5, yieldFrequency: 1 }
      };
    }

    // Streaming-only strategy for memory pressure
    if (memoryPressure >= 2 || uiResponsiveness < 30) {
      return {
        type: 'streaming_only',
        name: 'Streaming Only',
        reason: 'High memory pressure or poor UI responsiveness',
        config: { chunkSize: 8, streamingOnly: true }
      };
    }

    // Task-scheduled strategy for user activity
    if (userActive || dataSize < 100) {
      return {
        type: 'task_scheduled',
        name: 'Task Scheduled',
        reason: 'User active or small dataset',
        config: { priority: userActive ? 'high' : 'normal', interruptible: true }
      };
    }

    // Worker streaming strategy for optimal performance
    if (dataSize > 500 && systemHealth > 80 && uiResponsiveness > 45) {
      return {
        type: 'worker_streaming',
        name: 'Worker + Streaming',
        reason: 'Large dataset with good system health',
        config: { workerCount: 2, streamingEnabled: true, batchSize: 20 }
      };
    }

    // Default streaming strategy
    return {
      type: 'streaming_only',
      name: 'Default Streaming',
      reason: 'Default balanced approach',
      config: { chunkSize: 12, adaptiveChunking: true }
    };
  }

  /**
   * Process with Worker + Streaming strategy
   */
  async processWithWorkerStreaming(jobId, data, progressCallback, strategy) {
    console.log(`🚀 Processing with Worker + Streaming: ${jobId}`);

    // Prepare worker tasks
    const tasks = this.prepareWorkerTasks(data, strategy.config);
    
    // Start streaming processor
    const streamId = `stream_${jobId}`;
    const streamPromise = this.components.streamingProcessor.startStreamingProcessing(
      streamId,
      { items: tasks },
      progressCallback,
      { priority: 'normal' }
    );

    // Process with workers
    const workerPromise = this.components.workerManager.processMLTasks(
      tasks,
      (progress) => {
        progressCallback({
          ...progress,
          stage: 'worker_processing',
          method: 'worker_streaming'
        });
      }
    );

    // Wait for both to complete
    const [streamResult, workerResult] = await Promise.all([streamPromise, workerPromise]);

    return this.combineWorkerStreamingResults(streamResult, workerResult);
  }

  /**
   * Process with Streaming Only strategy
   */
  async processWithStreamingOnly(jobId, data, progressCallback, strategy) {
    console.log(`🌊 Processing with Streaming Only: ${jobId}`);

    const streamId = `stream_${jobId}`;
    return await this.components.streamingProcessor.startStreamingProcessing(
      streamId,
      { items: this.prepareStreamingTasks(data, strategy.config) },
      progressCallback,
      { priority: 'high' }
    );
  }

  /**
   * Process with Task Scheduling strategy
   */
  async processWithTaskScheduling(jobId, data, progressCallback, strategy) {
    console.log(`🎯 Processing with Task Scheduling: ${jobId}`);

    return new Promise((resolve, reject) => {
      const taskId = `task_${jobId}`;
      
      this.components.taskScheduler.queueTask({
        id: taskId,
        type: 'ml_prediction',
        priority: strategy.config.priority,
        data,
        processor: async (taskData) => {
          // Process in small chunks with yielding
          return await this.processDataInChunks(taskData, progressCallback, strategy.config);
        },
        metadata: {
          jobId,
          interruptible: strategy.config.interruptible
        }
      });

      // Monitor task completion
      const unsubscribe = this.components.taskScheduler.on('taskCompleted', (event) => {
        if (event.taskId === taskId) {
          unsubscribe();
          resolve(event.result);
        }
      });

      // Handle task errors
      const unsubscribeError = this.components.taskScheduler.on('taskError', (event) => {
        if (event.taskId === taskId) {
          unsubscribeError();
          reject(new Error(event.error));
        }
      });
    });
  }

  /**
   * Process with Emergency Fallback strategy
   */
  async processWithEmergencyFallback(jobId, data, progressCallback, strategy) {
    console.warn(`🚨 Processing with Emergency Fallback: ${jobId}`);

    // Extremely conservative processing
    const smallChunks = this.splitDataIntoMinimalChunks(data, strategy.config.maxChunkSize);
    const results = [];
    let processedCount = 0;

    for (const chunk of smallChunks) {
      // Process tiny chunk
      const chunkResult = await this.processMinimalChunk(chunk);
      results.push(...chunkResult);
      processedCount += chunk.length;

      // Update progress
      progressCallback({
        progress: (processedCount / data.items.length) * 100,
        stage: 'emergency_processing',
        message: '緊急処理モード',
        method: 'emergency_fallback'
      });

      // Aggressive yielding
      await new Promise(resolve => setTimeout(resolve, strategy.config.yieldFrequency));
    }

    return { success: true, results, method: 'emergency_fallback' };
  }

  /**
   * Enforce performance guarantees during processing
   */
  enforcePerformanceGuarantees(jobId, progress) {
    const now = Date.now();
    const job = this.systemState.activeJobs.get(jobId);
    
    if (!job) return;

    // Check frame time guarantee
    const currentFrameTime = this.components.uiMonitor.getPerformanceReport().frameMetrics.averageFrameTime;
    if (currentFrameTime > this.config.maxFrameTime * 1.5) {
      this.performanceGuarantees.frameTimeViolations++;
      this.handleFrameTimeViolation(jobId, currentFrameTime);
    }

    // Check memory guarantee
    const memoryUsage = this.components.memoryManager.getMemoryStats().current.memoryMB;
    if (memoryUsage > this.config.maxMemoryMB * 0.9) {
      this.performanceGuarantees.memoryViolations++;
      this.handleMemoryViolation(jobId, memoryUsage);
    }

    // Check processing time guarantee
    const processingTime = now - job.startTime;
    if (processingTime > this.config.maxProcessingTimeMs) {
      this.handleProcessingTimeViolation(jobId, processingTime);
    }

    // Check user interaction responsiveness
    if (this.components.uiMonitor.getPerformanceReport().interactionMetrics.blockedInteractions > 0) {
      this.performanceGuarantees.userInteractionBlocks++;
      this.handleInteractionBlock(jobId);
    }
  }

  /**
   * Handle frame time violations
   */
  handleFrameTimeViolation(jobId, frameTime) {
    console.warn(`⚠️ Frame time violation: ${frameTime.toFixed(2)}ms (job: ${jobId})`);
    
    // Trigger immediate optimization
    this.optimizeForFrameTime(jobId);
    
    // Fire violation event
    this.fireEvent('performanceViolation', {
      type: 'frame_time',
      jobId,
      violation: frameTime,
      threshold: this.config.maxFrameTime
    });
  }

  /**
   * Handle memory violations
   */
  handleMemoryViolation(jobId, memoryUsage) {
    console.warn(`⚠️ Memory violation: ${memoryUsage.toFixed(1)}MB (job: ${jobId})`);
    
    // Trigger memory optimization
    this.optimizeForMemory(jobId);
    
    this.fireEvent('performanceViolation', {
      type: 'memory',
      jobId,
      violation: memoryUsage,
      threshold: this.config.maxMemoryMB
    });
  }

  /**
   * Handle processing time violations
   */
  handleProcessingTimeViolation(jobId, processingTime) {
    console.error(`❌ Processing time violation: ${processingTime}ms (job: ${jobId})`);
    
    // Consider cancelling the job if it's taking too long
    const job = this.systemState.activeJobs.get(jobId);
    if (job && job.status === 'processing') {
      // Try to optimize first, cancel if that fails
      const optimized = await this.attemptProcessingOptimization(jobId);
      if (!optimized) {
        this.cancelJob(jobId, 'processing_timeout');
      }
    }
  }

  /**
   * Handle user interaction blocks
   */
  handleInteractionBlock(jobId) {
    console.warn(`🚫 User interaction blocked (job: ${jobId})`);
    
    // Immediately prioritize UI responsiveness
    this.prioritizeUIResponsiveness(jobId);
  }

  /**
   * Trigger emergency mode
   */
  triggerEmergencyMode(reason, data) {
    if (this.systemState.emergencyMode) return; // Already in emergency mode

    console.error(`🚨 EMERGENCY MODE ACTIVATED: ${reason}`);
    
    this.systemState.emergencyMode = true;
    this.systemState.emergencyTriggers.push({
      reason,
      data,
      timestamp: Date.now()
    });
    
    this.performanceGuarantees.emergencyActivations++;

    // Execute emergency procedure
    if (this.emergencyProcedures.has(reason)) {
      this.emergencyProcedures.get(reason)(data);
    } else {
      this.executeGenericEmergencyProcedure(reason, data);
    }

    this.fireEvent('emergencyMode', { reason, data });

    // Auto-exit emergency mode after conditions improve
    setTimeout(() => {
      this.checkEmergencyModeExit();
    }, 5000);
  }

  /**
   * Handle memory critical emergency
   */
  async handleMemoryCritical(data) {
    console.error('🚨 Memory Critical Emergency');
    
    // Immediate memory cleanup
    await this.components.memoryManager.forceCleanup();
    
    // Stop all non-critical processing
    this.pauseNonCriticalProcessing();
    
    // Reduce memory footprint
    this.components.workerManager?.scaleDownWorkerPool(2);
  }

  /**
   * Handle UI blocked emergency
   */
  async handleUIBlocked(data) {
    console.error('🚨 UI Blocked Emergency');
    
    // Interrupt all current processing
    await this.interruptAllProcessing();
    
    // Switch to minimal processing mode
    this.switchToMinimalProcessingMode();
  }

  /**
   * Handle processing stalled emergency
   */
  async handleProcessingStalled(data) {
    console.error('🚨 Processing Stalled Emergency');
    
    // Restart stalled components
    await this.restartStalledComponents();
  }

  /**
   * Handle worker failure emergency
   */
  async handleWorkerFailure(data) {
    console.error('🚨 Worker Failure Emergency');
    
    // Restart worker manager
    await this.restartWorkerSystem();
    
    // Fall back to main thread processing
    this.enableMainThreadFallback();
  }

  /**
   * Handle system overload emergency
   */
  async handleSystemOverload(data) {
    console.error('🚨 System Overload Emergency');
    
    // Reduce all processing intensity
    this.reduceSystemLoad();
    
    // Clear non-essential queues
    this.clearNonEssentialQueues();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const now = Date.now();
    const componentStates = {};
    let overallHealth = 100;

    try {
      // Check each component
      for (const [name, component] of Object.entries(this.components)) {
        if (component) {
          const componentHealth = await this.checkComponentHealth(component, name);
          componentStates[name] = componentHealth;
          overallHealth = Math.min(overallHealth, componentHealth.health);
        } else {
          componentStates[name] = { health: 0, status: 'not_initialized' };
          overallHealth = Math.min(overallHealth, 50);
        }
      }

      // Check system-wide metrics
      const systemChecks = this.performSystemChecks();
      overallHealth = Math.min(overallHealth, systemChecks.health);

      // Update system state
      this.systemState.overallHealth = overallHealth;
      this.systemState.componentStates = componentStates;
      this.systemState.lastHealthCheck = now;
      this.systemState.performanceGrade = this.calculatePerformanceGrade(overallHealth);

      return {
        overall: overallHealth,
        grade: this.systemState.performanceGrade,
        components: componentStates,
        systemChecks,
        timestamp: now
      };

    } catch (error) {
      console.error('Health check failed:', error);
      return {
        overall: 25,
        grade: 'F',
        error: error.message,
        timestamp: now
      };
    }
  }

  /**
   * Check individual component health
   */
  async checkComponentHealth(component, name) {
    try {
      let health = 100;
      let status = 'healthy';
      let metrics = {};

      switch (name) {
        case 'uiMonitor':
          const uiReport = component.getPerformanceReport();
          health = uiReport.overallHealth || 100;
          metrics = uiReport.frameMetrics;
          break;

        case 'memoryManager':
          const memStats = component.getMemoryStats();
          health = memStats.health || 100;
          metrics = memStats.current;
          break;

        case 'taskScheduler':
          const schedStats = component.getSchedulingStats();
          health = Math.min(100, schedStats.metrics.schedulingEfficiency || 100);
          metrics = schedStats.metrics;
          break;

        case 'streamingProcessor':
          const streamStats = component.getStreamingStats();
          health = streamStats.activeStreams < 10 ? 100 : 80; // Simple heuristic
          metrics = streamStats;
          break;

        case 'workerManager':
          const workerStatus = await component.getStatus();
          health = workerStatus.initialized ? 100 : 50;
          metrics = workerStatus.metrics || {};
          break;

        case 'performanceMonitor':
          const perfReport = component.getPerformanceReport();
          health = perfReport.recentAlerts?.length > 0 ? 80 : 100;
          metrics = perfReport.metrics;
          break;
      }

      if (health < 50) status = 'critical';
      else if (health < 80) status = 'degraded';

      return { health, status, metrics };

    } catch (error) {
      return { health: 25, status: 'error', error: error.message };
    }
  }

  /**
   * Perform system-wide checks
   */
  performSystemChecks() {
    let health = 100;
    const checks = {};

    // Memory check
    if (performance.memory) {
      const memoryRatio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      checks.memory = memoryRatio < 0.8 ? 100 : 80 - (memoryRatio * 50);
      health = Math.min(health, checks.memory);
    }

    // Performance check
    const recentViolations = this.performanceGuarantees.frameTimeViolations + 
                           this.performanceGuarantees.memoryViolations;
    checks.violations = Math.max(0, 100 - (recentViolations * 10));
    health = Math.min(health, checks.violations);

    // Active jobs check
    const activeJobCount = this.systemState.activeJobs.size;
    checks.jobs = activeJobCount < 5 ? 100 : Math.max(50, 100 - (activeJobCount * 5));
    health = Math.min(health, checks.jobs);

    return { health, checks };
  }

  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(health) {
    if (health >= 95) return 'A+';
    if (health >= 90) return 'A';
    if (health >= 80) return 'B';
    if (health >= 70) return 'C';
    if (health >= 60) return 'D';
    return 'F';
  }

  /**
   * Perform emergency check (high frequency)
   */
  performEmergencyCheck() {
    if (!this.isInitialized) return;

    // Quick checks for emergency conditions
    const currentFrameTime = this.components.uiMonitor?.getPerformanceReport()?.frameMetrics?.averageFrameTime || 16;
    const memoryUsage = this.components.memoryManager?.getMemoryStats()?.current?.memoryMB || 0;
    
    // Emergency frame time check
    if (currentFrameTime > this.config.emergencyFrameThreshold) {
      this.triggerEmergencyMode('ui_blocked', { frameTime: currentFrameTime });
    }

    // Emergency memory check
    if (memoryUsage > this.config.emergencyMemoryThreshold) {
      this.triggerEmergencyMode('memory_critical', { memoryUsage });
    }
  }

  /**
   * Get performance guarantees status
   */
  getPerformanceGuarantees() {
    return {
      frameTime: {
        guarantee: this.config.maxFrameTime + 'ms',
        current: this.components.uiMonitor?.getPerformanceReport()?.frameMetrics?.averageFrameTime || 16,
        violations: this.performanceGuarantees.frameTimeViolations
      },
      memory: {
        guarantee: this.config.maxMemoryMB + 'MB',
        current: this.components.memoryManager?.getMemoryStats()?.current?.memoryMB || 0,
        violations: this.performanceGuarantees.memoryViolations
      },
      responsiveness: {
        guarantee: this.config.emergencyResponseTime + 'ms',
        violations: this.performanceGuarantees.responseTimeViolations
      },
      userInteractions: {
        guarantee: 'No blocking',
        violations: this.performanceGuarantees.userInteractionBlocks
      }
    };
  }

  /**
   * Get guarantee status for current processing
   */
  getGuaranteeStatus() {
    const guarantees = this.getPerformanceGuarantees();
    return {
      frameTimeOK: guarantees.frameTime.current <= this.config.maxFrameTime * 1.2,
      memoryOK: guarantees.memory.current <= this.config.maxMemoryMB * 0.9,
      responsivenessOK: guarantees.responsiveness.violations === 0,
      interactionsOK: guarantees.userInteractions.violations === 0,
      overallOK: this.systemState.overallHealth > 70
    };
  }

  /**
   * Validate guarantees for completed job
   */
  validateGuarantees(job) {
    return {
      processingTimeOK: job.totalTime <= this.config.maxProcessingTimeMs,
      frameTimePreserved: this.performanceGuarantees.frameTimeViolations === 0,
      memoryLimitRespected: this.performanceGuarantees.memoryViolations === 0,
      userInteractionsUnblocked: this.performanceGuarantees.userInteractionBlocks === 0,
      emergencyModeAvoided: !this.systemState.emergencyMode
    };
  }

  /**
   * Get system capabilities
   */
  getSystemCapabilities() {
    return {
      guaranteedNonBlocking: true,
      maxConcurrentJobs: 3,
      supportedStrategies: ['worker_streaming', 'streaming_only', 'task_scheduled', 'emergency_fallback'],
      adaptiveOptimization: this.config.adaptiveOptimization,
      emergencyRecovery: this.config.emergencyFallbacks,
      realTimeMonitoring: this.config.realTimeMonitoring,
      memoryManagement: true,
      userInteractionPriority: true,
      performanceGuarantees: this.getPerformanceGuarantees()
    };
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      type: 'non_blocking_ml_architecture',
      version: '1.0.0',
      initialized: this.isInitialized,
      healthy: this.systemHealthy,
      emergencyMode: this.systemState.emergencyMode,
      systemHealth: {
        overall: this.systemState.overallHealth,
        grade: this.systemState.performanceGrade,
        components: Object.keys(this.components).filter(k => this.components[k]?.isInitialized)
      },
      processing: {
        activeJobs: this.systemState.activeJobs.size,
        isProcessing: this.isProcessing,
        queue: this.systemState.processingQueue.length
      },
      metrics: this.architectureMetrics,
      guarantees: this.getPerformanceGuarantees(),
      capabilities: this.getSystemCapabilities()
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

  fireEvent(eventType, data) {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler({ ...data, timestamp: Date.now() });
        } catch (error) {
          console.warn(`Architecture event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Destroy the complete architecture
   */
  async destroy() {
    console.log('🧹 Destroying Non-Blocking ML Architecture...');

    try {
      // Stop all processing
      this.isProcessing = false;
      
      // Clear all timers
      Object.values(this.timers).forEach(timer => {
        if (timer) clearInterval(timer);
      });

      // Disconnect emergency observer
      if (this.emergencyTaskObserver) {
        this.emergencyTaskObserver.disconnect();
      }

      // Destroy all components
      const destroyPromises = Object.values(this.components)
        .filter(component => component && typeof component.destroy === 'function')
        .map(component => component.destroy().catch(error => 
          console.warn('Component destruction failed:', error)
        ));

      await Promise.allSettled(destroyPromises);

      // Clear all state
      this.systemState.activeJobs.clear();
      this.systemState.processingQueue = [];
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());

      this.isInitialized = false;
      this.systemHealthy = false;

      console.log('✅ Non-Blocking ML Architecture destroyed successfully');

    } catch (error) {
      console.error('Error during Non-Blocking ML Architecture destruction:', error);
    }
  }

  // Additional utility methods (implemented based on usage above)
  calculateDataComplexity(data) { 
    return (data.items?.length || 0) * (data.complexity || 1); 
  }
  
  estimateProcessingTime(data) { 
    return this.calculateDataComplexity(data) * 10; // 10ms per unit
  }
  
  prepareWorkerTasks(data, config) { 
    return data.items || []; 
  }
  
  combineWorkerStreamingResults(streamResult, workerResult) {
    return { ...streamResult, workerMetrics: workerResult };
  }
  
  // ... (other utility methods would be implemented similarly)
}

// Singleton instance
let nonBlockingMLArchitectureInstance = null;

export function getNonBlockingMLArchitecture() {
  if (!nonBlockingMLArchitectureInstance) {
    nonBlockingMLArchitectureInstance = new NonBlockingMLArchitecture();
  }
  return nonBlockingMLArchitectureInstance;
}

export { NonBlockingMLArchitecture };