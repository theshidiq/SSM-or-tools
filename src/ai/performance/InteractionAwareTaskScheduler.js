/**
 * InteractionAwareTaskScheduler.js
 * 
 * Advanced task scheduler that prioritizes user interactions,
 * dynamically adjusts processing based on user activity,
 * and ensures immediate response to user input.
 */

import { getUIResponsivenessMonitor } from './UIResponsivenessMonitor';

export class InteractionAwareTaskScheduler {
  constructor() {
    this.isInitialized = false;
    this.isProcessing = false;
    
    // Task priority levels
    this.PRIORITY = {
      CRITICAL: 100,    // User interactions, critical UI updates
      HIGH: 80,         // Visible content, immediate feedback
      NORMAL: 60,       // Standard processing
      LOW: 40,          // Background operations
      BACKGROUND: 20    // Deferred processing
    };

    // Task queues by priority
    this.taskQueues = {
      critical: [],     // User interactions, emergency tasks
      high: [],         // Important visible updates
      normal: [],       // Standard ML processing
      low: [],          // Background optimization
      background: []    // Deferred cleanup tasks
    };

    // Processing state
    this.processingState = {
      currentTask: null,
      currentPriority: null,
      processingStartTime: 0,
      interruptionCount: 0,
      taskHistory: [],
      maxHistorySize: 100
    };

    // User interaction detection
    this.interactionState = {
      isUserActive: false,
      lastInteractionTime: 0,
      lastInteractionType: null,
      activeInteractions: new Set(),
      interactionHistory: [],
      criticalInteractionTypes: new Set([
        'mousedown', 'touchstart', 'keydown', 'click', 'input', 'submit'
      ]),
      responsiveInteractionTypes: new Set([
        'mousemove', 'scroll', 'wheel', 'touchmove'
      ])
    };

    // Scheduling configuration
    this.config = {
      baseTimeSliceMs: 16,           // Base time slice (60fps)
      criticalTimeSliceMs: 4,        // Time slice for critical tasks
      normalTimeSliceMs: 8,          // Time slice for normal tasks
      backgroundTimeSliceMs: 32,     // Time slice for background tasks
      interactionTimeoutMs: 2000,    // User inactivity timeout
      interruptionDelayMs: 1,        // Delay before interruption
      maxConcurrentTasks: 3,         // Max tasks running simultaneously
      adaptiveScheduling: true,      // Enable adaptive scheduling
      preemptiveScheduling: true,    // Allow task preemption
      fairnessEnabled: true          // Ensure fairness across priorities
    };

    // Adaptive parameters
    this.adaptiveParams = {
      performanceWindow: 30,         // Window for performance tracking
      recentPerformance: [],         // Recent task performance data
      averageTaskTime: {},           // Average time per priority
      priorityWeights: {             // Dynamic priority weights
        critical: 1.0,
        high: 0.8,
        normal: 0.6,
        low: 0.4,
        background: 0.2
      },
      lastAdjustmentTime: 0,
      adjustmentInterval: 5000       // Adjust weights every 5 seconds
    };

    // Task execution tracking
    this.executionMetrics = {
      tasksProcessed: 0,
      tasksByPriority: {
        critical: 0,
        high: 0,
        normal: 0,
        low: 0,
        background: 0
      },
      averageWaitTime: {},
      averageExecutionTime: {},
      interruptionRate: 0,
      userResponseTime: [],
      schedulingEfficiency: 0
    };

    // Event handlers
    this.eventHandlers = {
      taskQueued: new Set(),
      taskStarted: new Set(),
      taskCompleted: new Set(),
      taskInterrupted: new Set(),
      userInteraction: new Set(),
      priorityAdjusted: new Set(),
      schedulingOptimized: new Set()
    };

    // Scheduling timers and RAF handles
    this.scheduler = {
      rafHandle: null,
      schedulingTimer: null,
      adaptationTimer: null,
      cleanupTimer: null
    };

    // UI responsiveness monitor integration
    this.uiMonitor = null;

    // DOM interaction listeners
    this.interactionListeners = new Map();
  }

  /**
   * Initialize the interaction-aware task scheduler
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('🎯 Initializing Interaction-Aware Task Scheduler...');

      // Apply configuration
      Object.assign(this.config, options.config || {});
      Object.assign(this.adaptiveParams, options.adaptiveParams || {});

      // Initialize UI responsiveness monitor
      this.uiMonitor = getUIResponsivenessMonitor();
      if (!this.uiMonitor.isInitialized) {
        await this.uiMonitor.initialize();
      }

      // Setup interaction detection
      this.setupInteractionDetection();

      // Setup task scheduling loop
      this.startTaskSchedulingLoop();

      // Setup adaptive optimization
      this.startAdaptiveOptimization();

      // Setup UI integration
      this.setupUIIntegration();

      // Setup cleanup and maintenance
      this.startMaintenance();

      this.isInitialized = true;

      console.log('✅ Interaction-Aware Task Scheduler initialized:', {
        baseTimeSlice: this.config.baseTimeSliceMs + 'ms',
        adaptiveScheduling: this.config.adaptiveScheduling,
        preemptiveScheduling: this.config.preemptiveScheduling
      });

      return {
        success: true,
        configuration: this.config,
        priorities: this.PRIORITY
      };

    } catch (error) {
      console.error('❌ Interaction-Aware Task Scheduler initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup comprehensive interaction detection
   */
  setupInteractionDetection() {
    // Define interaction events to monitor
    const interactionEvents = [
      // Critical interactions (immediate response required)
      { type: 'mousedown', priority: 'critical', category: 'pointer' },
      { type: 'touchstart', priority: 'critical', category: 'touch' },
      { type: 'keydown', priority: 'critical', category: 'keyboard' },
      { type: 'click', priority: 'critical', category: 'pointer' },
      { type: 'input', priority: 'critical', category: 'input' },
      { type: 'submit', priority: 'critical', category: 'form' },
      
      // High priority interactions
      { type: 'focus', priority: 'high', category: 'focus' },
      { type: 'blur', priority: 'high', category: 'focus' },
      { type: 'change', priority: 'high', category: 'input' },
      
      // Responsive interactions (frequent but less critical)
      { type: 'mousemove', priority: 'normal', category: 'pointer' },
      { type: 'scroll', priority: 'normal', category: 'scroll' },
      { type: 'wheel', priority: 'normal', category: 'scroll' },
      { type: 'touchmove', priority: 'normal', category: 'touch' },
      
      // Background interactions
      { type: 'mouseenter', priority: 'low', category: 'hover' },
      { type: 'mouseleave', priority: 'low', category: 'hover' },
      { type: 'resize', priority: 'background', category: 'window' }
    ];

    // Add event listeners
    interactionEvents.forEach(({ type, priority, category }) => {
      const listener = (event) => {
        this.handleInteraction(event, priority, category);
      };

      document.addEventListener(type, listener, {
        passive: true,
        capture: false
      });

      this.interactionListeners.set(type, listener);
    });

    // Setup intersection observer for visibility-based prioritization
    this.setupVisibilityTracking();

    console.log('👆 Interaction detection setup completed');
  }

  /**
   * Setup visibility tracking for element-based prioritization
   */
  setupVisibilityTracking() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          const isVisible = entry.isIntersecting;
          
          // Adjust priority for tasks related to visible elements
          if (element.dataset.taskId) {
            this.adjustTaskPriorityByVisibility(element.dataset.taskId, isVisible);
          }
        });
      }, {
        threshold: [0, 0.1, 0.5, 1.0],
        rootMargin: '50px'
      });
    }
  }

  /**
   * Handle user interaction events
   */
  handleInteraction(event, priority, category) {
    const now = performance.now();
    const interactionInfo = {
      type: event.type,
      priority,
      category,
      timestamp: now,
      target: event.target,
      isCritical: this.interactionState.criticalInteractionTypes.has(event.type)
    };

    // Update interaction state
    this.interactionState.isUserActive = true;
    this.interactionState.lastInteractionTime = now;
    this.interactionState.lastInteractionType = event.type;
    this.interactionState.activeInteractions.add(event.type);

    // Add to interaction history
    this.interactionState.interactionHistory.push(interactionInfo);
    if (this.interactionState.interactionHistory.length > 50) {
      this.interactionState.interactionHistory.shift();
    }

    // Clear previous timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }

    // Set new inactivity timeout
    this.interactionTimeout = setTimeout(() => {
      this.handleUserInactivity();
    }, this.config.interactionTimeoutMs);

    // Handle critical interactions immediately
    if (interactionInfo.isCritical) {
      this.handleCriticalInteraction(interactionInfo);
    }

    // Boost priority for related tasks
    this.boostRelatedTaskPriorities(interactionInfo);

    // Fire interaction event
    this.fireEvent('userInteraction', interactionInfo);

    console.log(`👆 ${event.type} interaction (${priority} priority)`);
  }

  /**
   * Handle critical user interactions requiring immediate response
   */
  handleCriticalInteraction(interactionInfo) {
    console.log('🚨 Critical interaction detected:', interactionInfo.type);

    // Interrupt current processing if it's not critical
    if (this.processingState.currentTask && 
        this.processingState.currentPriority !== 'critical') {
      this.interruptCurrentTask('critical_interaction');
    }

    // Temporarily boost all critical tasks
    this.temporaryPriorityBoost('critical', 2000); // 2 second boost

    // Schedule immediate UI update task
    this.queueTask({
      id: `ui_update_${Date.now()}`,
      type: 'ui_response',
      priority: 'critical',
      data: interactionInfo,
      processor: async () => {
        // Allow immediate UI updates
        await new Promise(resolve => requestAnimationFrame(resolve));
        return { success: true, responseTime: performance.now() - interactionInfo.timestamp };
      }
    });
  }

  /**
   * Handle user inactivity
   */
  handleUserInactivity() {
    console.log('😴 User inactive, adjusting scheduling priorities');
    
    this.interactionState.isUserActive = false;
    this.interactionState.activeInteractions.clear();

    // Allow more time for background tasks when user is inactive
    this.adjustSchedulingForInactivity();
  }

  /**
   * Boost priority for tasks related to current interaction
   */
  boostRelatedTaskPriorities(interactionInfo) {
    const { target, category, type } = interactionInfo;
    
    // Get related element selectors
    const relatedSelectors = this.getRelatedSelectors(target, category);
    
    // Boost tasks associated with related elements
    Object.values(this.taskQueues).flat().forEach(task => {
      if (this.isTaskRelatedToInteraction(task, relatedSelectors, type)) {
        this.promotedTaskPriority(task.id, 'interaction_boost');
      }
    });
  }

  /**
   * Get selectors related to interaction target
   */
  getRelatedSelectors(target, category) {
    const selectors = [];
    
    // Add element-specific selectors
    if (target.id) selectors.push(`#${target.id}`);
    if (target.className) {
      target.className.split(' ').forEach(cls => {
        if (cls) selectors.push(`.${cls}`);
      });
    }
    
    // Add category-based selectors
    switch (category) {
      case 'input':
        selectors.push('input', 'textarea', 'select', '[contenteditable]');
        break;
      case 'form':
        selectors.push('form', 'fieldset');
        break;
      case 'pointer':
        selectors.push('button', '[role="button"]', 'a');
        break;
    }
    
    return selectors;
  }

  /**
   * Check if task is related to current interaction
   */
  isTaskRelatedToInteraction(task, selectors, interactionType) {
    if (!task.metadata) return false;
    
    // Check element association
    if (task.metadata.element) {
      return selectors.some(selector => {
        try {
          return task.metadata.element.matches(selector);
        } catch (e) {
          return false;
        }
      });
    }
    
    // Check interaction type association
    if (task.metadata.triggerInteraction) {
      return task.metadata.triggerInteraction === interactionType;
    }
    
    return false;
  }

  /**
   * Start main task scheduling loop
   */
  startTaskSchedulingLoop() {
    const scheduleNextTasks = () => {
      if (this.isInitialized) {
        this.processTaskQueues();
        this.scheduler.rafHandle = requestAnimationFrame(scheduleNextTasks);
      }
    };

    this.scheduler.rafHandle = requestAnimationFrame(scheduleNextTasks);
    
    // Also run periodic scheduling optimization
    this.scheduler.schedulingTimer = setInterval(() => {
      this.optimizeScheduling();
    }, 1000);

    console.log('⚡ Task scheduling loop started');
  }

  /**
   * Process task queues with priority-based scheduling
   */
  processTaskQueues() {
    const now = performance.now();
    const frameTimeTarget = this.calculateFrameTimeTarget();
    const availableTime = this.calculateAvailableProcessingTime(frameTimeTarget);
    
    if (availableTime <= 0) return;

    // Get next priority level to process
    const priorityLevel = this.selectNextPriorityLevel();
    if (!priorityLevel) return;

    const queue = this.taskQueues[priorityLevel];
    if (queue.length === 0) return;

    // Calculate time slice for this priority
    const timeSlice = this.calculateTimeSlice(priorityLevel, availableTime);
    const maxTasks = Math.min(queue.length, this.config.maxConcurrentTasks);

    // Process tasks within time budget
    this.processPriorityQueue(priorityLevel, timeSlice, maxTasks);
  }

  /**
   * Calculate available processing time based on frame timing
   */
  calculateAvailableProcessingTime(frameTimeTarget) {
    if (!this.uiMonitor) return this.config.baseTimeSliceMs;

    const report = this.uiMonitor.getPerformanceReport();
    const currentFrameTime = report.frameMetrics?.averageFrameTime || 16;
    
    // Reserve time for UI updates
    const reservedTime = Math.max(2, frameTimeTarget * 0.3);
    return Math.max(1, frameTimeTarget - reservedTime - currentFrameTime);
  }

  /**
   * Calculate frame time target based on UI state
   */
  calculateFrameTimeTarget() {
    const baseTarget = this.config.baseTimeSliceMs;
    
    if (this.interactionState.isUserActive) {
      return Math.max(4, baseTarget * 0.5); // More responsive during interaction
    }
    
    return baseTarget;
  }

  /**
   * Select next priority level to process
   */
  selectNextPriorityLevel() {
    const priorities = ['critical', 'high', 'normal', 'low', 'background'];
    
    // Always process critical first
    if (this.taskQueues.critical.length > 0) {
      return 'critical';
    }

    // Use weighted round-robin for other priorities
    if (this.config.fairnessEnabled) {
      return this.selectPriorityWithFairness(priorities.slice(1));
    }
    
    // Simple priority order
    return priorities.find(priority => this.taskQueues[priority].length > 0);
  }

  /**
   * Select priority level with fairness consideration
   */
  selectPriorityWithFairness(priorities) {
    const now = performance.now();
    
    // Calculate starvation scores (time since last processing)
    const starvationScores = priorities.map(priority => {
      const lastProcessed = this.adaptiveParams.lastProcessedTime?.[priority] || 0;
      const timeSinceProcessed = now - lastProcessed;
      const queueLength = this.taskQueues[priority].length;
      const weight = this.adaptiveParams.priorityWeights[priority];
      
      return {
        priority,
        score: (timeSinceProcessed * queueLength * weight),
        queueLength
      };
    });

    // Sort by starvation score and select highest
    starvationScores.sort((a, b) => b.score - a.score);
    
    const selected = starvationScores.find(item => item.queueLength > 0);
    return selected?.priority;
  }

  /**
   * Calculate time slice for priority level
   */
  calculateTimeSlice(priorityLevel, availableTime) {
    const baseTimeSlices = {
      critical: this.config.criticalTimeSliceMs,
      high: this.config.normalTimeSliceMs,
      normal: this.config.normalTimeSliceMs,
      low: this.config.backgroundTimeSliceMs,
      background: this.config.backgroundTimeSliceMs
    };

    let timeSlice = baseTimeSlices[priorityLevel] || this.config.normalTimeSliceMs;
    
    // Adjust for user activity
    if (this.interactionState.isUserActive && priorityLevel === 'critical') {
      timeSlice = Math.min(timeSlice, 4); // Max 4ms for critical during interaction
    } else if (!this.interactionState.isUserActive && priorityLevel === 'background') {
      timeSlice = Math.min(availableTime, timeSlice * 2); // Allow more time when inactive
    }

    return Math.min(timeSlice, availableTime);
  }

  /**
   * Process tasks from specific priority queue
   */
  async processPriorityQueue(priorityLevel, timeSlice, maxTasks) {
    const queue = this.taskQueues[priorityLevel];
    const startTime = performance.now();
    let processedTasks = 0;
    
    while (queue.length > 0 && processedTasks < maxTasks) {
      const elapsedTime = performance.now() - startTime;
      if (elapsedTime >= timeSlice) {
        break; // Time slice exceeded
      }

      // Check for interruption by higher priority tasks
      if (this.shouldInterruptProcessing(priorityLevel)) {
        break;
      }

      const task = queue.shift();
      const taskSuccess = await this.executeTask(task, priorityLevel);
      
      if (taskSuccess) {
        processedTasks++;
        this.recordTaskCompletion(task, priorityLevel, performance.now() - startTime);
      } else {
        // Requeue failed task with adjusted priority
        this.requeueFailedTask(task, priorityLevel);
      }
    }

    // Update processing time tracking
    if (!this.adaptiveParams.lastProcessedTime) {
      this.adaptiveParams.lastProcessedTime = {};
    }
    this.adaptiveParams.lastProcessedTime[priorityLevel] = performance.now();
  }

  /**
   * Execute individual task
   */
  async executeTask(task, priorityLevel) {
    const taskStartTime = performance.now();
    
    try {
      // Set current processing state
      this.processingState.currentTask = task;
      this.processingState.currentPriority = priorityLevel;
      this.processingState.processingStartTime = taskStartTime;
      
      this.fireEvent('taskStarted', {
        taskId: task.id,
        priority: priorityLevel,
        type: task.type
      });

      // Execute task processor
      const result = await this.executeTaskProcessor(task);
      
      // Task completed successfully
      this.processingState.currentTask = null;
      this.processingState.currentPriority = null;
      
      const executionTime = performance.now() - taskStartTime;
      
      this.fireEvent('taskCompleted', {
        taskId: task.id,
        priority: priorityLevel,
        executionTime,
        result
      });

      return true;

    } catch (error) {
      console.warn(`Task execution failed: ${task.id}`, error);
      
      this.processingState.currentTask = null;
      this.processingState.currentPriority = null;
      
      return false;
    }
  }

  /**
   * Execute task processor with proper error handling
   */
  async executeTaskProcessor(task) {
    if (typeof task.processor === 'function') {
      return await task.processor(task.data);
    } else if (task.processor && typeof task.processor.process === 'function') {
      return await task.processor.process(task.data);
    } else {
      throw new Error('Task processor not defined or not callable');
    }
  }

  /**
   * Check if current processing should be interrupted
   */
  shouldInterruptProcessing(currentPriorityLevel) {
    if (!this.config.preemptiveScheduling) return false;
    
    // Check for critical tasks
    if (currentPriorityLevel !== 'critical' && this.taskQueues.critical.length > 0) {
      return true;
    }
    
    // Check for user interaction during non-critical processing
    if (this.interactionState.isUserActive && 
        currentPriorityLevel === 'background' &&
        (this.taskQueues.critical.length > 0 || this.taskQueues.high.length > 0)) {
      return true;
    }
    
    return false;
  }

  /**
   * Interrupt current task processing
   */
  interruptCurrentTask(reason) {
    if (!this.processingState.currentTask) return;
    
    console.log(`⚡ Interrupting task: ${this.processingState.currentTask.id} (${reason})`);
    
    const interruptedTask = this.processingState.currentTask;
    const priorityLevel = this.processingState.currentPriority;
    
    // Requeue interrupted task
    this.taskQueues[priorityLevel].unshift(interruptedTask);
    
    // Update metrics
    this.processingState.interruptionCount++;
    this.executionMetrics.interruptionRate++;
    
    // Clear current processing state
    this.processingState.currentTask = null;
    this.processingState.currentPriority = null;
    
    this.fireEvent('taskInterrupted', {
      taskId: interruptedTask.id,
      reason,
      priority: priorityLevel
    });
  }

  /**
   * Queue new task with priority-based placement
   */
  queueTask(task) {
    // Validate task
    if (!task || !task.id || !task.processor) {
      throw new Error('Invalid task: must have id and processor');
    }

    // Determine priority queue
    const priorityLevel = this.determinePriorityLevel(task);
    
    // Add metadata
    task.queuedAt = performance.now();
    task.priority = priorityLevel;
    
    // Add to appropriate queue
    this.taskQueues[priorityLevel].push(task);
    
    // Update metrics
    this.executionMetrics.tasksProcessed++;
    this.executionMetrics.tasksByPriority[priorityLevel]++;
    
    this.fireEvent('taskQueued', {
      taskId: task.id,
      priority: priorityLevel,
      queueLength: this.taskQueues[priorityLevel].length
    });

    console.log(`📋 Task queued: ${task.id} (${priorityLevel} priority)`);
    
    return {
      taskId: task.id,
      priority: priorityLevel,
      queuePosition: this.taskQueues[priorityLevel].length
    };
  }

  /**
   * Determine priority level for task
   */
  determinePriorityLevel(task) {
    // Explicit priority
    if (task.priority && this.taskQueues[task.priority]) {
      return task.priority;
    }

    // Priority by type
    const typePriorities = {
      'ui_response': 'critical',
      'user_interaction': 'critical',
      'visible_update': 'high',
      'ml_prediction': 'normal',
      'data_processing': 'normal',
      'background_sync': 'low',
      'cleanup': 'background'
    };

    if (task.type && typePriorities[task.type]) {
      return typePriorities[task.type];
    }

    // Priority by urgency
    if (task.urgent) return 'high';
    if (task.background) return 'background';

    // Default priority
    return 'normal';
  }

  /**
   * Promote task priority
   */
  promotedTaskPriority(taskId, reason) {
    let found = false;
    
    // Search all queues for the task
    Object.entries(this.taskQueues).forEach(([currentPriority, queue]) => {
      const taskIndex = queue.findIndex(task => task.id === taskId);
      
      if (taskIndex !== -1) {
        const task = queue.splice(taskIndex, 1)[0];
        
        // Determine new priority (one level higher)
        const newPriority = this.getHigherPriority(currentPriority);
        
        if (newPriority !== currentPriority) {
          task.priority = newPriority;
          task.promotedAt = performance.now();
          task.promotionReason = reason;
          
          this.taskQueues[newPriority].push(task);
          
          console.log(`⬆️ Task promoted: ${taskId} (${currentPriority} → ${newPriority})`);
          found = true;
        }
      }
    });

    return found;
  }

  /**
   * Get higher priority level
   */
  getHigherPriority(currentPriority) {
    const priorityOrder = ['background', 'low', 'normal', 'high', 'critical'];
    const currentIndex = priorityOrder.indexOf(currentPriority);
    return priorityOrder[Math.min(currentIndex + 1, priorityOrder.length - 1)];
  }

  /**
   * Temporarily boost priority level
   */
  temporaryPriorityBoost(priorityLevel, durationMs) {
    const originalWeight = this.adaptiveParams.priorityWeights[priorityLevel];
    this.adaptiveParams.priorityWeights[priorityLevel] = 1.5;
    
    setTimeout(() => {
      this.adaptiveParams.priorityWeights[priorityLevel] = originalWeight;
    }, durationMs);

    console.log(`🚀 Temporary priority boost: ${priorityLevel} for ${durationMs}ms`);
  }

  /**
   * Adjust scheduling for user inactivity
   */
  adjustSchedulingForInactivity() {
    // Allow longer time slices for background tasks
    this.config.backgroundTimeSliceMs = Math.min(64, this.config.backgroundTimeSliceMs * 1.5);
    
    // Reduce critical task urgency slightly
    this.adaptiveParams.priorityWeights.critical = 0.9;
    this.adaptiveParams.priorityWeights.background = 0.4;

    // Reset after a delay
    setTimeout(() => {
      this.resetSchedulingParameters();
    }, 5000);
  }

  /**
   * Reset scheduling parameters to defaults
   */
  resetSchedulingParameters() {
    this.config.backgroundTimeSliceMs = 32;
    this.adaptiveParams.priorityWeights = {
      critical: 1.0,
      high: 0.8,
      normal: 0.6,
      low: 0.4,
      background: 0.2
    };
  }

  /**
   * Start adaptive optimization
   */
  startAdaptiveOptimization() {
    if (!this.config.adaptiveScheduling) return;

    this.scheduler.adaptationTimer = setInterval(() => {
      this.adaptSchedulingParameters();
    }, this.adaptiveParams.adjustmentInterval);
  }

  /**
   * Adapt scheduling parameters based on performance
   */
  adaptSchedulingParameters() {
    const report = this.uiMonitor?.getPerformanceReport();
    if (!report) return;

    const frameMetrics = report.frameMetrics;
    const interactionMetrics = report.interactionMetrics;

    // Adjust based on frame performance
    if (frameMetrics.currentFPS < 30) {
      this.reduceProcessingIntensity();
    } else if (frameMetrics.currentFPS > 55 && frameMetrics.dropRate < 0.05) {
      this.increaseProcessingIntensity();
    }

    // Adjust based on interaction responsiveness
    if (interactionMetrics.blockedInteractions > 0) {
      this.boostInteractionResponsiveness();
    }

    this.fireEvent('schedulingOptimized', {
      frameMetrics,
      adjustments: this.adaptiveParams.priorityWeights
    });
  }

  /**
   * Reduce processing intensity for better responsiveness
   */
  reduceProcessingIntensity() {
    console.log('🐌 Reducing processing intensity');
    
    this.config.baseTimeSliceMs = Math.max(4, this.config.baseTimeSliceMs * 0.8);
    this.config.maxConcurrentTasks = Math.max(1, this.config.maxConcurrentTasks - 1);
    
    // Reduce background task weight
    this.adaptiveParams.priorityWeights.background *= 0.8;
    this.adaptiveParams.priorityWeights.low *= 0.9;
  }

  /**
   * Increase processing intensity when performance is good
   */
  increaseProcessingIntensity() {
    console.log('🚀 Increasing processing intensity');
    
    this.config.baseTimeSliceMs = Math.min(32, this.config.baseTimeSliceMs * 1.1);
    this.config.maxConcurrentTasks = Math.min(5, this.config.maxConcurrentTasks + 1);
    
    // Increase background task weight
    this.adaptiveParams.priorityWeights.background = Math.min(0.4, this.adaptiveParams.priorityWeights.background * 1.1);
  }

  /**
   * Boost interaction responsiveness
   */
  boostInteractionResponsiveness() {
    console.log('⚡ Boosting interaction responsiveness');
    
    this.config.criticalTimeSliceMs = Math.max(2, this.config.criticalTimeSliceMs * 0.8);
    this.adaptiveParams.priorityWeights.critical = 1.2;
    
    // Reset after short duration
    setTimeout(() => {
      this.adaptiveParams.priorityWeights.critical = 1.0;
    }, 3000);
  }

  /**
   * Setup UI integration for priority adjustments
   */
  setupUIIntegration() {
    // Listen to UI performance events
    if (this.uiMonitor) {
      this.uiMonitor.on('frameAlert', (data) => {
        if (data.type === 'critical') {
          this.handleCriticalPerformance();
        }
      });

      this.uiMonitor.on('interactionBlock', (data) => {
        this.handleBlockedInteraction(data);
      });
    }
  }

  /**
   * Handle critical performance situations
   */
  handleCriticalPerformance() {
    console.warn('🚨 Critical performance detected, emergency scheduling');
    
    // Clear all non-critical queues temporarily
    this.taskQueues.background = [];
    this.taskQueues.low = [];
    
    // Reduce normal and high task processing
    this.adaptiveParams.priorityWeights.normal = 0.3;
    this.adaptiveParams.priorityWeights.high = 0.5;
    
    // Reset after emergency period
    setTimeout(() => {
      this.resetSchedulingParameters();
    }, 2000);
  }

  /**
   * Handle blocked interaction events
   */
  handleBlockedInteraction(data) {
    console.warn('🚫 Blocked interaction detected:', data);
    
    // Interrupt all non-critical processing
    if (this.processingState.currentTask && 
        this.processingState.currentPriority !== 'critical') {
      this.interruptCurrentTask('blocked_interaction');
    }
    
    // Boost critical task processing
    this.temporaryPriorityBoost('critical', 1000);
  }

  /**
   * Requeue failed task with adjusted priority
   */
  requeueFailedTask(task, originalPriority) {
    // Reduce priority for failed tasks
    const lowerPriority = this.getLowerPriority(originalPriority);
    
    task.failureCount = (task.failureCount || 0) + 1;
    task.lastFailureTime = performance.now();
    task.priority = lowerPriority;
    
    // Add to lower priority queue
    this.taskQueues[lowerPriority].push(task);
    
    console.log(`🔄 Task requeued: ${task.id} (${originalPriority} → ${lowerPriority})`);
  }

  /**
   * Get lower priority level
   */
  getLowerPriority(currentPriority) {
    const priorityOrder = ['critical', 'high', 'normal', 'low', 'background'];
    const currentIndex = priorityOrder.indexOf(currentPriority);
    return priorityOrder[Math.min(currentIndex + 1, priorityOrder.length - 1)];
  }

  /**
   * Record task completion metrics
   */
  recordTaskCompletion(task, priorityLevel, executionTime) {
    // Update execution metrics
    if (!this.executionMetrics.averageExecutionTime[priorityLevel]) {
      this.executionMetrics.averageExecutionTime[priorityLevel] = [];
    }
    
    this.executionMetrics.averageExecutionTime[priorityLevel].push(executionTime);
    
    // Limit metrics history
    if (this.executionMetrics.averageExecutionTime[priorityLevel].length > 50) {
      this.executionMetrics.averageExecutionTime[priorityLevel].shift();
    }

    // Calculate wait time
    const waitTime = task.queuedAt ? performance.now() - task.queuedAt : 0;
    if (!this.executionMetrics.averageWaitTime[priorityLevel]) {
      this.executionMetrics.averageWaitTime[priorityLevel] = [];
    }
    this.executionMetrics.averageWaitTime[priorityLevel].push(waitTime);

    // Update task history
    this.processingState.taskHistory.push({
      id: task.id,
      priority: priorityLevel,
      executionTime,
      waitTime,
      completedAt: performance.now()
    });

    // Limit history size
    if (this.processingState.taskHistory.length > this.processingState.maxHistorySize) {
      this.processingState.taskHistory.shift();
    }
  }

  /**
   * Start maintenance tasks
   */
  startMaintenance() {
    this.scheduler.cleanupTimer = setInterval(() => {
      this.performMaintenance();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform periodic maintenance
   */
  performMaintenance() {
    // Clean up old interaction history
    const cutoffTime = performance.now() - 300000; // 5 minutes
    this.interactionState.interactionHistory = this.interactionState.interactionHistory
      .filter(interaction => interaction.timestamp > cutoffTime);

    // Clean up old performance data
    Object.values(this.executionMetrics.averageExecutionTime).forEach(times => {
      if (times.length > 100) {
        times.splice(0, times.length - 100);
      }
    });

    // Update scheduling efficiency
    this.calculateSchedulingEfficiency();
  }

  /**
   * Calculate scheduling efficiency
   */
  calculateSchedulingEfficiency() {
    const totalTasks = this.executionMetrics.tasksProcessed;
    const interruptions = this.processingState.interruptionCount;
    
    if (totalTasks > 0) {
      this.executionMetrics.schedulingEfficiency = 
        Math.max(0, 100 - ((interruptions / totalTasks) * 100));
    }
  }

  /**
   * Get comprehensive scheduling statistics
   */
  getSchedulingStats() {
    return {
      queueStatus: Object.entries(this.taskQueues).reduce((acc, [priority, queue]) => {
        acc[priority] = queue.length;
        return acc;
      }, {}),
      currentTask: this.processingState.currentTask ? {
        id: this.processingState.currentTask.id,
        priority: this.processingState.currentPriority,
        processingTime: performance.now() - this.processingState.processingStartTime
      } : null,
      interactionState: {
        isActive: this.interactionState.isUserActive,
        lastInteraction: this.interactionState.lastInteractionType,
        timeSinceInteraction: performance.now() - this.interactionState.lastInteractionTime,
        activeInteractions: Array.from(this.interactionState.activeInteractions)
      },
      metrics: { ...this.executionMetrics },
      adaptiveParams: { ...this.adaptiveParams },
      configuration: { ...this.config }
    };
  }

  /**
   * Cancel task by ID
   */
  cancelTask(taskId) {
    let found = false;
    
    // Search all queues
    Object.entries(this.taskQueues).forEach(([priority, queue]) => {
      const taskIndex = queue.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        const cancelledTask = queue.splice(taskIndex, 1)[0];
        console.log(`❌ Task cancelled: ${taskId} (${priority})`);
        found = true;
      }
    });

    // If currently processing, interrupt it
    if (this.processingState.currentTask?.id === taskId) {
      this.interruptCurrentTask('task_cancelled');
      found = true;
    }

    return found;
  }

  /**
   * Clear all tasks from specific priority queue
   */
  clearQueue(priorityLevel) {
    if (this.taskQueues[priorityLevel]) {
      const clearedCount = this.taskQueues[priorityLevel].length;
      this.taskQueues[priorityLevel] = [];
      console.log(`🗑️ Cleared ${clearedCount} tasks from ${priorityLevel} queue`);
      return clearedCount;
    }
    return 0;
  }

  /**
   * Adjust task priority by element visibility
   */
  adjustTaskPriorityByVisibility(taskId, isVisible) {
    if (isVisible) {
      this.promotedTaskPriority(taskId, 'element_visible');
    }
    // Could also demote if not visible, but that might be too aggressive
  }

  /**
   * Optimize scheduling based on current conditions
   */
  optimizeScheduling() {
    // This method can be called to trigger immediate optimization
    this.adaptSchedulingParameters();
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
          handler({ ...data, timestamp: performance.now() });
        } catch (error) {
          console.warn(`Scheduler event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Destroy scheduler and cleanup resources
   */
  async destroy() {
    console.log('🧹 Destroying Interaction-Aware Task Scheduler...');

    try {
      // Clear all timers
      if (this.scheduler.rafHandle) {
        cancelAnimationFrame(this.scheduler.rafHandle);
      }
      Object.values(this.scheduler).forEach(timer => {
        if (timer && typeof timer === 'number') {
          clearInterval(timer);
        }
      });

      // Clear interaction timeout
      if (this.interactionTimeout) {
        clearTimeout(this.interactionTimeout);
      }

      // Remove interaction listeners
      this.interactionListeners.forEach((listener, eventType) => {
        document.removeEventListener(eventType, listener);
      });
      this.interactionListeners.clear();

      // Disconnect intersection observer
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }

      // Clear all task queues
      Object.keys(this.taskQueues).forEach(priority => {
        this.taskQueues[priority] = [];
      });

      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());

      // Reset state
      this.processingState.currentTask = null;
      this.processingState.taskHistory = [];
      this.interactionState.interactionHistory = [];

      this.isInitialized = false;
      this.isProcessing = false;

      console.log('✅ Interaction-Aware Task Scheduler destroyed');

    } catch (error) {
      console.error('Error during Interaction-Aware Task Scheduler destruction:', error);
    }
  }
}

// Singleton instance
let interactionAwareTaskSchedulerInstance = null;

export function getInteractionAwareTaskScheduler() {
  if (!interactionAwareTaskSchedulerInstance) {
    interactionAwareTaskSchedulerInstance = new InteractionAwareTaskScheduler();
  }
  return interactionAwareTaskSchedulerInstance;
}

export { InteractionAwareTaskScheduler };