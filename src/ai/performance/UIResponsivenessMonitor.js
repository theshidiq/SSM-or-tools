/**
 * UIResponsivenessMonitor.js
 * 
 * Advanced UI responsiveness monitoring system that tracks frame timing,
 * user interactions, and automatically optimizes processing to maintain
 * smooth user experience during ML operations.
 */

export class UIResponsivenessMonitor {
  constructor() {
    this.isInitialized = false;
    this.isMonitoring = false;
    
    // Frame timing configuration
    this.frameConfig = {
      targetFPS: 60,
      targetFrameTime: 16.67, // 60fps = 16.67ms per frame
      warningThreshold: 33.33, // 30fps threshold
      criticalThreshold: 50,    // 20fps threshold
      measurementWindow: 120,   // Track last 120 frames (2 seconds at 60fps)
      adaptiveThreshold: true
    };

    // Frame timing state
    this.frameState = {
      frames: [],
      currentFPS: 60,
      averageFrameTime: 16.67,
      frameDrops: 0,
      longFrames: 0,
      lastFrameTime: 0,
      frameTimeHistory: [],
      isDropping: false,
      consecutiveDrops: 0
    };

    // User interaction tracking
    this.interactionState = {
      isUserActive: false,
      lastInteractionTime: 0,
      interactionTypes: new Set(),
      blockedInteractions: 0,
      responseTimes: [],
      averageResponseTime: 0,
      interactionTimeout: 2000 // 2 seconds of inactivity
    };

    // Processing optimization state
    this.optimizationState = {
      processingMode: 'normal', // normal, reduced, minimal
      yieldStrategy: 'adaptive', // adaptive, aggressive, minimal
      batchSize: 20,
      yieldFrequency: 5, // yield every N tasks
      frameTimeTarget: 16.67,
      adaptiveParameters: {
        baseYieldTime: 4,     // base time before yielding (ms)
        maxYieldTime: 12,     // maximum yield time (ms)
        reductionFactor: 0.8, // factor to reduce processing when frames drop
        recoveryFactor: 1.1   // factor to increase processing when performance improves
      }
    };

    // Performance observers
    this.observers = {
      longTask: null,
      navigation: null,
      measure: null,
      paint: null,
      layout: null
    };

    // Event handlers and callbacks
    this.eventHandlers = {
      frameAlert: new Set(),
      interactionBlock: new Set(),
      optimizationChange: new Set(),
      performanceDegraded: new Set(),
      performanceRecovered: new Set()
    };

    // Metrics and analytics
    this.metrics = {
      totalFrames: 0,
      droppedFrames: 0,
      averageFrameTime: 16.67,
      p95FrameTime: 16.67,
      p99FrameTime: 16.67,
      interactionCount: 0,
      blockedInteractions: 0,
      optimizationChanges: 0,
      processingAdjustments: 0
    };

    // RAF and timing
    this.rafId = null;
    this.timingLoop = null;
  }

  /**
   * Initialize UI responsiveness monitoring
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('📱 Initializing UI Responsiveness Monitor...');

      // Apply configuration
      Object.assign(this.frameConfig, options.frameConfig || {});
      Object.assign(this.optimizationState, options.optimizationConfig || {});

      // Setup performance observers
      await this.setupPerformanceObservers();

      // Setup frame timing monitoring
      this.setupFrameTimingMonitor();

      // Setup interaction tracking
      this.setupInteractionTracking();

      // Setup adaptive optimization
      this.setupAdaptiveOptimization();

      // Start monitoring
      this.startMonitoring();

      this.isInitialized = true;

      console.log('✅ UI Responsiveness Monitor initialized:', {
        targetFPS: this.frameConfig.targetFPS,
        observers: Object.keys(this.observers).filter(k => this.observers[k]).length
      });

      return {
        success: true,
        configuration: this.frameConfig,
        observers: this.getObserverStatus()
      };

    } catch (error) {
      console.error('❌ UI Responsiveness Monitor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup performance observers for detailed monitoring
   */
  async setupPerformanceObservers() {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not available, using fallback monitoring');
      return;
    }

    try {
      // Long Task Observer - critical for detecting blocking operations
      if ('longtask' in PerformanceObserver.supportedEntryTypes) {
        this.observers.longTask = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleLongTask(entry);
          }
        });
        this.observers.longTask.observe({ type: 'longtask', buffered: false });
      }

      // Paint Observer - for render timing
      if ('paint' in PerformanceObserver.supportedEntryTypes) {
        this.observers.paint = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handlePaintTiming(entry);
          }
        });
        this.observers.paint.observe({ type: 'paint', buffered: true });
      }

      // Layout Shift Observer - for visual stability
      if ('layout-shift' in PerformanceObserver.supportedEntryTypes) {
        this.observers.layout = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleLayoutShift(entry);
          }
        });
        this.observers.layout.observe({ type: 'layout-shift', buffered: false });
      }

      // Navigation Observer - for page load metrics
      if ('navigation' in PerformanceObserver.supportedEntryTypes) {
        this.observers.navigation = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleNavigationTiming(entry);
          }
        });
        this.observers.navigation.observe({ type: 'navigation', buffered: true });
      }

    } catch (error) {
      console.warn('Failed to setup some performance observers:', error);
    }
  }

  /**
   * Setup frame timing monitoring using RAF
   */
  setupFrameTimingMonitor() {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFrame = (currentTime) => {
      const frameTime = currentTime - lastTime;
      lastTime = currentTime;
      frameCount++;

      // Store frame timing
      this.recordFrameTiming(frameTime);

      // Update frame metrics
      this.updateFrameMetrics(frameTime);

      // Check for frame drops
      this.checkFrameDrops(frameTime);

      // Continue monitoring
      if (this.isMonitoring) {
        this.rafId = requestAnimationFrame(measureFrame);
      }
    };

    // Start RAF loop
    this.rafId = requestAnimationFrame(measureFrame);

    // Setup periodic analysis
    this.timingLoop = setInterval(() => {
      this.analyzeFramePerformance();
      this.adjustOptimizationParameters();
    }, 1000); // Analyze every second
  }

  /**
   * Setup user interaction tracking
   */
  setupInteractionTracking() {
    const interactionEvents = [
      'mousedown', 'mouseup', 'mousemove', 'wheel',
      'touchstart', 'touchend', 'touchmove',
      'keydown', 'keyup',
      'click', 'scroll'
    ];

    const trackInteraction = (event) => {
      const now = performance.now();
      
      this.interactionState.isUserActive = true;
      this.interactionState.lastInteractionTime = now;
      this.interactionState.interactionTypes.add(event.type);
      this.metrics.interactionCount++;

      // Measure response time for critical interactions
      if (['click', 'touchstart', 'keydown'].includes(event.type)) {
        this.measureInteractionResponse(event, now);
      }

      // Clear inactivity timeout
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = setTimeout(() => {
        this.interactionState.isUserActive = false;
        this.interactionState.interactionTypes.clear();
      }, this.interactionState.interactionTimeout);
    };

    // Add event listeners with passive option for performance
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, trackInteraction, { 
        passive: true, 
        capture: false 
      });
    });

    // Store event listeners for cleanup
    this.interactionListeners = interactionEvents.map(eventType => ({
      type: eventType,
      listener: trackInteraction
    }));
  }

  /**
   * Setup adaptive optimization system
   */
  setupAdaptiveOptimization() {
    // Monitor for performance degradation
    setInterval(() => {
      this.evaluatePerformanceState();
      this.adjustProcessingStrategy();
    }, 500); // Check every 500ms

    // Setup emergency performance mode
    this.setupEmergencyMode();
  }

  /**
   * Setup emergency performance mode for critical situations
   */
  setupEmergencyMode() {
    let emergencyMode = false;
    let emergencyStartTime = 0;

    const checkEmergencyConditions = () => {
      const criticalConditions = [
        this.frameState.currentFPS < 20,
        this.frameState.consecutiveDrops > 10,
        this.interactionState.blockedInteractions > 3,
        this.frameState.averageFrameTime > 50
      ];

      const shouldEnterEmergency = criticalConditions.filter(Boolean).length >= 2;

      if (shouldEnterEmergency && !emergencyMode) {
        this.enterEmergencyMode();
        emergencyMode = true;
        emergencyStartTime = Date.now();
      } else if (emergencyMode && Date.now() - emergencyStartTime > 5000) {
        // Exit emergency mode after 5 seconds if conditions improve
        const improvedConditions = [
          this.frameState.currentFPS > 30,
          this.frameState.consecutiveDrops < 3,
          this.frameState.averageFrameTime < 33
        ];

        if (improvedConditions.filter(Boolean).length >= 2) {
          this.exitEmergencyMode();
          emergencyMode = false;
        }
      }
    };

    setInterval(checkEmergencyConditions, 1000);
  }

  /**
   * Record individual frame timing
   */
  recordFrameTiming(frameTime) {
    // Add to history
    this.frameState.frameTimeHistory.push({
      time: performance.now(),
      frameTime,
      dropped: frameTime > this.frameConfig.warningThreshold
    });

    // Limit history size
    if (this.frameState.frameTimeHistory.length > this.frameConfig.measurementWindow) {
      this.frameState.frameTimeHistory.shift();
    }

    // Update real-time metrics
    this.frameState.lastFrameTime = frameTime;
  }

  /**
   * Update frame performance metrics
   */
  updateFrameMetrics(frameTime) {
    this.metrics.totalFrames++;

    // Calculate running average
    const alpha = 0.1; // Smoothing factor
    this.frameState.averageFrameTime = 
      this.frameState.averageFrameTime * (1 - alpha) + frameTime * alpha;

    // Update FPS
    this.frameState.currentFPS = 1000 / this.frameState.averageFrameTime;

    // Calculate percentiles from recent history
    if (this.frameState.frameTimeHistory.length >= 60) {
      const recent = this.frameState.frameTimeHistory.slice(-60);
      const sortedTimes = recent.map(f => f.frameTime).sort((a, b) => a - b);
      
      this.metrics.p95FrameTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      this.metrics.p99FrameTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    }
  }

  /**
   * Check for frame drops and consecutive issues
   */
  checkFrameDrops(frameTime) {
    if (frameTime > this.frameConfig.warningThreshold) {
      this.frameState.frameDrops++;
      this.metrics.droppedFrames++;
      this.frameState.consecutiveDrops++;

      if (frameTime > this.frameConfig.criticalThreshold) {
        this.frameState.longFrames++;
        this.handleCriticalFrameDrop(frameTime);
      }

      this.frameState.isDropping = true;
    } else {
      this.frameState.consecutiveDrops = 0;
      this.frameState.isDropping = false;
    }
  }

  /**
   * Analyze frame performance patterns
   */
  analyzeFramePerformance() {
    if (this.frameState.frameTimeHistory.length < 30) return;

    const recent = this.frameState.frameTimeHistory.slice(-30);
    const dropRate = recent.filter(f => f.dropped).length / recent.length;

    // Detect performance patterns
    const patterns = {
      consistentDrops: dropRate > 0.3,
      intermittentDrops: dropRate > 0.1 && dropRate <= 0.3,
      stable: dropRate <= 0.1,
      degrading: this.isPerformanceDegrading(recent),
      recovering: this.isPerformanceRecovering(recent)
    };

    // Fire appropriate events
    if (patterns.degrading) {
      this.fireEvent('performanceDegraded', {
        dropRate,
        averageFrameTime: this.frameState.averageFrameTime,
        consecutiveDrops: this.frameState.consecutiveDrops
      });
    } else if (patterns.recovering) {
      this.fireEvent('performanceRecovered', {
        dropRate,
        averageFrameTime: this.frameState.averageFrameTime,
        currentFPS: this.frameState.currentFPS
      });
    }
  }

  /**
   * Adjust optimization parameters based on performance
   */
  adjustOptimizationParameters() {
    const params = this.optimizationState.adaptiveParameters;
    const currentFPS = this.frameState.currentFPS;
    const targetFPS = this.frameConfig.targetFPS;

    if (currentFPS < targetFPS * 0.8) {
      // Performance is degraded, be more aggressive with yielding
      params.baseYieldTime = Math.max(1, params.baseYieldTime * 0.9);
      this.optimizationState.yieldFrequency = Math.max(2, this.optimizationState.yieldFrequency - 1);
      this.optimizationState.batchSize = Math.max(5, Math.floor(this.optimizationState.batchSize * 0.9));
      
      this.metrics.processingAdjustments++;
      
    } else if (currentFPS > targetFPS * 0.95) {
      // Performance is good, can be less aggressive
      params.baseYieldTime = Math.min(params.maxYieldTime, params.baseYieldTime * 1.05);
      this.optimizationState.yieldFrequency = Math.min(10, this.optimizationState.yieldFrequency + 1);
      this.optimizationState.batchSize = Math.min(50, Math.floor(this.optimizationState.batchSize * 1.05));
    }

    // Update frame time target based on current performance
    this.optimizationState.frameTimeTarget = this.frameState.averageFrameTime * 0.8;
  }

  /**
   * Evaluate current performance state and adjust processing mode
   */
  evaluatePerformanceState() {
    const currentFPS = this.frameState.currentFPS;
    const dropRate = this.calculateRecentDropRate();
    const isUserActive = this.interactionState.isUserActive;

    let newMode = this.optimizationState.processingMode;

    if (currentFPS < 20 || dropRate > 0.5 || (isUserActive && currentFPS < 30)) {
      newMode = 'minimal';
    } else if (currentFPS < 40 || dropRate > 0.2 || (isUserActive && currentFPS < 45)) {
      newMode = 'reduced';
    } else if (currentFPS > 50 && dropRate < 0.1) {
      newMode = 'normal';
    }

    if (newMode !== this.optimizationState.processingMode) {
      this.changeProcessingMode(newMode);
    }
  }

  /**
   * Change processing mode with notifications
   */
  changeProcessingMode(newMode) {
    const oldMode = this.optimizationState.processingMode;
    this.optimizationState.processingMode = newMode;
    this.metrics.optimizationChanges++;

    // Adjust parameters based on mode
    switch (newMode) {
      case 'minimal':
        this.optimizationState.batchSize = 3;
        this.optimizationState.yieldFrequency = 1;
        this.optimizationState.yieldStrategy = 'aggressive';
        break;
      case 'reduced':
        this.optimizationState.batchSize = 8;
        this.optimizationState.yieldFrequency = 3;
        this.optimizationState.yieldStrategy = 'adaptive';
        break;
      case 'normal':
        this.optimizationState.batchSize = 20;
        this.optimizationState.yieldFrequency = 5;
        this.optimizationState.yieldStrategy = 'minimal';
        break;
    }

    this.fireEvent('optimizationChange', {
      oldMode,
      newMode,
      parameters: { ...this.optimizationState }
    });

    console.log(`🔧 Processing mode changed: ${oldMode} → ${newMode}`);
  }

  /**
   * Handle long task detection from Performance Observer
   */
  handleLongTask(entry) {
    console.warn('🐌 Long task detected:', {
      duration: entry.duration,
      startTime: entry.startTime,
      name: entry.name
    });

    // Record blocked interaction if user was active
    if (this.interactionState.isUserActive) {
      this.interactionState.blockedInteractions++;
      this.metrics.blockedInteractions++;
      
      this.fireEvent('interactionBlock', {
        duration: entry.duration,
        timestamp: entry.startTime
      });
    }

    // Trigger immediate optimization if task was very long
    if (entry.duration > 100) {
      this.changeProcessingMode('minimal');
    }
  }

  /**
   * Handle critical frame drops
   */
  handleCriticalFrameDrop(frameTime) {
    console.warn('🚨 Critical frame drop detected:', frameTime + 'ms');
    
    this.fireEvent('frameAlert', {
      type: 'critical',
      frameTime,
      currentFPS: this.frameState.currentFPS,
      consecutiveDrops: this.frameState.consecutiveDrops
    });

    // Emergency optimization
    if (this.frameState.consecutiveDrops > 3) {
      this.changeProcessingMode('minimal');
    }
  }

  /**
   * Measure interaction response time
   */
  measureInteractionResponse(event, startTime) {
    // Use next paint to measure response time
    requestAnimationFrame(() => {
      const responseTime = performance.now() - startTime;
      this.interactionState.responseTimes.push(responseTime);
      
      // Keep only recent measurements
      if (this.interactionState.responseTimes.length > 50) {
        this.interactionState.responseTimes.shift();
      }

      // Update average
      this.interactionState.averageResponseTime = 
        this.interactionState.responseTimes.reduce((sum, time) => sum + time, 0) / 
        this.interactionState.responseTimes.length;

      // Check for slow responses
      if (responseTime > 100) {
        console.warn('🐌 Slow interaction response:', responseTime + 'ms');
        this.interactionState.blockedInteractions++;
      }
    });
  }

  /**
   * Enter emergency performance mode
   */
  enterEmergencyMode() {
    console.warn('🚨 Entering emergency performance mode');
    
    this.changeProcessingMode('minimal');
    
    // More aggressive settings
    this.optimizationState.batchSize = 1;
    this.optimizationState.yieldFrequency = 1;
    this.optimizationState.adaptiveParameters.baseYieldTime = 1;

    this.fireEvent('optimizationChange', {
      mode: 'emergency',
      reason: 'Critical performance degradation'
    });
  }

  /**
   * Exit emergency performance mode
   */
  exitEmergencyMode() {
    console.log('✅ Exiting emergency performance mode');
    
    this.changeProcessingMode('reduced');
    
    this.fireEvent('optimizationChange', {
      mode: 'recovery',
      reason: 'Performance recovered'
    });
  }

  /**
   * Check if performance is degrading
   */
  isPerformanceDegrading(recentFrames) {
    if (recentFrames.length < 20) return false;
    
    const firstHalf = recentFrames.slice(0, 10);
    const secondHalf = recentFrames.slice(-10);
    
    const firstAvg = firstHalf.reduce((sum, f) => sum + f.frameTime, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, f) => sum + f.frameTime, 0) / secondHalf.length;
    
    return secondAvg > firstAvg * 1.2; // 20% increase indicates degradation
  }

  /**
   * Check if performance is recovering
   */
  isPerformanceRecovering(recentFrames) {
    if (recentFrames.length < 20) return false;
    
    const firstHalf = recentFrames.slice(0, 10);
    const secondHalf = recentFrames.slice(-10);
    
    const firstAvg = firstHalf.reduce((sum, f) => sum + f.frameTime, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, f) => sum + f.frameTime, 0) / secondHalf.length;
    
    return secondAvg < firstAvg * 0.8 && firstAvg > this.frameConfig.warningThreshold; // 20% improvement from degraded state
  }

  /**
   * Calculate recent frame drop rate
   */
  calculateRecentDropRate() {
    if (this.frameState.frameTimeHistory.length < 10) return 0;
    
    const recent = this.frameState.frameTimeHistory.slice(-30);
    return recent.filter(f => f.dropped).length / recent.length;
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('📱 UI Responsiveness monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.timingLoop) {
      clearInterval(this.timingLoop);
      this.timingLoop = null;
    }
    
    console.log('📱 UI Responsiveness monitoring stopped');
  }

  /**
   * Get current optimization parameters for processing systems
   */
  getOptimizationParameters() {
    return {
      processingMode: this.optimizationState.processingMode,
      batchSize: this.optimizationState.batchSize,
      yieldFrequency: this.optimizationState.yieldFrequency,
      yieldStrategy: this.optimizationState.yieldStrategy,
      frameTimeTarget: this.optimizationState.frameTimeTarget,
      shouldYieldImmediately: this.frameState.isDropping && this.interactionState.isUserActive,
      emergencyMode: this.optimizationState.processingMode === 'minimal' && this.frameState.currentFPS < 20,
      adaptiveParameters: { ...this.optimizationState.adaptiveParameters }
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    return {
      timestamp: Date.now(),
      frameMetrics: {
        currentFPS: Math.round(this.frameState.currentFPS * 10) / 10,
        averageFrameTime: Math.round(this.frameState.averageFrameTime * 10) / 10,
        p95FrameTime: Math.round(this.metrics.p95FrameTime * 10) / 10,
        p99FrameTime: Math.round(this.metrics.p99FrameTime * 10) / 10,
        frameDrops: this.frameState.frameDrops,
        consecutiveDrops: this.frameState.consecutiveDrops,
        dropRate: this.calculateRecentDropRate()
      },
      interactionMetrics: {
        isUserActive: this.interactionState.isUserActive,
        blockedInteractions: this.interactionState.blockedInteractions,
        averageResponseTime: Math.round(this.interactionState.averageResponseTime * 10) / 10,
        interactionCount: this.metrics.interactionCount
      },
      optimizationState: {
        mode: this.optimizationState.processingMode,
        batchSize: this.optimizationState.batchSize,
        yieldFrequency: this.optimizationState.yieldFrequency,
        adjustments: this.metrics.processingAdjustments,
        changes: this.metrics.optimizationChanges
      },
      overallHealth: this.calculateOverallHealth()
    };
  }

  /**
   * Calculate overall UI health score
   */
  calculateOverallHealth() {
    const fpsScore = Math.min(100, (this.frameState.currentFPS / this.frameConfig.targetFPS) * 100);
    const dropScore = Math.max(0, 100 - (this.calculateRecentDropRate() * 200));
    const interactionScore = this.interactionState.blockedInteractions === 0 ? 100 : 
      Math.max(0, 100 - (this.interactionState.blockedInteractions * 10));
    
    return Math.round((fpsScore + dropScore + interactionScore) / 3);
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
          console.warn(`UI Responsiveness event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Get observer status
   */
  getObserverStatus() {
    return {
      longTask: !!this.observers.longTask,
      navigation: !!this.observers.navigation,
      paint: !!this.observers.paint,
      layout: !!this.observers.layout
    };
  }

  /**
   * Cleanup and destroy
   */
  async destroy() {
    console.log('🧹 Destroying UI Responsiveness Monitor...');
    
    try {
      // Stop monitoring
      this.stopMonitoring();

      // Disconnect observers
      Object.values(this.observers).forEach(observer => {
        if (observer) {
          observer.disconnect();
        }
      });

      // Remove interaction listeners
      if (this.interactionListeners) {
        this.interactionListeners.forEach(({ type, listener }) => {
          document.removeEventListener(type, listener);
        });
      }

      // Clear timers
      if (this.inactivityTimeout) {
        clearTimeout(this.inactivityTimeout);
      }

      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());

      this.isInitialized = false;

      console.log('✅ UI Responsiveness Monitor destroyed');

    } catch (error) {
      console.error('Error during UI Responsiveness Monitor destruction:', error);
    }
  }

  // Additional performance observer handlers
  handlePaintTiming(entry) {
    // Track paint performance
    console.log('🎨 Paint timing:', entry.name, entry.startTime);
  }

  handleLayoutShift(entry) {
    if (entry.value > 0.1) {
      console.warn('📐 Significant layout shift:', entry.value);
    }
  }

  handleNavigationTiming(entry) {
    console.log('🧭 Navigation timing:', {
      loadTime: entry.loadEventEnd - entry.fetchStart,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.fetchStart
    });
  }
}

// Singleton instance
let uiResponsivenessMonitorInstance = null;

export function getUIResponsivenessMonitor() {
  if (!uiResponsivenessMonitorInstance) {
    uiResponsivenessMonitorInstance = new UIResponsivenessMonitor();
  }
  return uiResponsivenessMonitorInstance;
}

export { UIResponsivenessMonitor };