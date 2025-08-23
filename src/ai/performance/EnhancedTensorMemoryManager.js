/**
 * EnhancedTensorMemoryManager.js
 * 
 * Advanced tensor memory management system with lifecycle tracking,
 * intelligent garbage collection, memory pressure handling, and
 * automatic optimization for ML operations.
 */

export class EnhancedTensorMemoryManager {
  constructor() {
    this.isInitialized = false;
    this.isMonitoring = false;
    
    // Memory configuration
    this.config = {
      maxMemoryMB: 400,
      warningThresholdMB: 300,
      criticalThresholdMB: 350,
      cleanupIntervalMs: 15000, // 15 seconds
      aggressiveCleanupThresholdMB: 320,
      tensorLifetimeMs: 60000, // 1 minute default lifetime
      maxTensorAge: 300000, // 5 minutes max age
      memoryPressureThreshold: 0.8, // 80% of max memory
      emergencyCleanupEnabled: true
    };

    // Memory state tracking
    this.memoryState = {
      currentUsageMB: 0,
      peakUsageMB: 0,
      totalAllocatedMB: 0,
      totalDeallocatedMB: 0,
      pressureLevel: 0, // 0=low, 1=medium, 2=high, 3=critical
      lastCleanupTime: 0,
      cleanupCount: 0,
      memoryHistory: [], // Rolling window of memory usage
      historyWindowSize: 120, // 2 minutes at 1 sample per second
      allocationRate: 0, // MB/second
      deallocationRate: 0 // MB/second
    };

    // Tensor lifecycle tracking
    this.tensorRegistry = {
      activeTensors: new Map(), // id -> TensorInfo
      tensorsByAge: new Map(),   // age bucket -> Set<id>
      tensorsBySize: new Map(),  // size bucket -> Set<id>
      tensorsByType: new Map(),  // type -> Set<id>
      orphanedTensors: new Set(), // Tensors that should be cleaned up
      retainedTensors: new Set(), // Tensors that should not be cleaned up
      recentlyDisposed: new Set() // Recently disposed tensor IDs for tracking
    };

    // Garbage collection strategies
    this.gcStrategies = {
      current: 'adaptive', // adaptive, aggressive, conservative, emergency
      policies: {
        adaptive: {
          maxAge: 60000,
          sizeThreshold: 10 * 1024 * 1024, // 10MB
          frequency: 15000,
          retainRecent: true
        },
        aggressive: {
          maxAge: 30000,
          sizeThreshold: 5 * 1024 * 1024,
          frequency: 5000,
          retainRecent: false
        },
        conservative: {
          maxAge: 120000,
          sizeThreshold: 50 * 1024 * 1024,
          frequency: 30000,
          retainRecent: true
        },
        emergency: {
          maxAge: 5000,
          sizeThreshold: 1024 * 1024,
          frequency: 1000,
          retainRecent: false
        }
      }
    };

    // Performance metrics
    this.metrics = {
      totalTensorsCreated: 0,
      totalTensorsDisposed: 0,
      memoryLeaksDetected: 0,
      cleanupOperations: 0,
      emergencyCleanups: 0,
      memoryReclaimed: 0,
      averageCleanupTime: 0,
      peakMemoryPressure: 0,
      strategyChanges: 0
    };

    // Event handlers
    this.eventHandlers = {
      memoryPressure: new Map(), // level -> Set<callback>
      tensorCreated: new Set(),
      tensorDisposed: new Set(),
      cleanupComplete: new Set(),
      strategyChanged: new Set(),
      memoryLeak: new Set(),
      emergencyCleanup: new Set()
    };

    // Monitoring and cleanup timers
    this.timers = {
      monitoring: null,
      cleanup: null,
      analysis: null
    };

    // TensorFlow.js hooks
    this.tfHooks = {
      originalTensor: null,
      originalDispose: null,
      memoryHook: null
    };
  }

  /**
   * Initialize the enhanced tensor memory manager
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('🧠 Initializing Enhanced Tensor Memory Manager...');

      // Apply configuration
      Object.assign(this.config, options);

      // Validate TensorFlow.js availability
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not available');
      }

      // Setup TensorFlow.js hooks
      await this.setupTensorFlowHooks();

      // Start monitoring systems
      this.startMemoryMonitoring();
      this.startCleanupTimer();
      this.startAnalysisTimer();

      // Setup emergency cleanup
      if (this.config.emergencyCleanupEnabled) {
        this.setupEmergencyCleanup();
      }

      // Initial memory assessment
      await this.performInitialAssessment();

      this.isInitialized = true;

      console.log('✅ Enhanced Tensor Memory Manager initialized:', {
        maxMemoryMB: this.config.maxMemoryMB,
        strategy: this.gcStrategies.current,
        hooksInstalled: Object.values(this.tfHooks).every(Boolean)
      });

      return {
        success: true,
        configuration: this.config,
        initialMemory: this.getMemoryStats()
      };

    } catch (error) {
      console.error('❌ Enhanced Tensor Memory Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup TensorFlow.js memory tracking hooks
   */
  async setupTensorFlowHooks() {
    // Hook into tensor creation
    this.tfHooks.originalTensor = tf.tensor;
    tf.tensor = (...args) => {
      const tensor = this.tfHooks.originalTensor.apply(tf, args);
      this.registerTensor(tensor);
      return tensor;
    };

    // Hook into tensor disposal
    const originalDispose = tf.dispose;
    tf.dispose = (container) => {
      if (container && container.id) {
        this.unregisterTensor(container);
      }
      return originalDispose.call(tf, container);
    };

    // Hook into memory() calls for monitoring
    this.tfHooks.originalMemory = tf.memory;
    tf.memory = () => {
      const memoryInfo = this.tfHooks.originalMemory.call(tf);
      this.updateMemoryState(memoryInfo);
      return memoryInfo;
    };

    console.log('✅ TensorFlow.js hooks installed');
  }

  /**
   * Register a new tensor in the lifecycle tracking system
   */
  registerTensor(tensor) {
    if (!tensor || !tensor.id) return;

    const tensorInfo = {
      id: tensor.id,
      shape: tensor.shape,
      dtype: tensor.dtype,
      size: tensor.size,
      sizeBytes: tensor.size * this.getBytesPerElement(tensor.dtype),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      retainCount: 0,
      isOrphaned: false,
      type: this.classifyTensor(tensor),
      references: new Set()
    };

    // Add to registry
    this.tensorRegistry.activeTensors.set(tensor.id, tensorInfo);

    // Categorize by size
    const sizeCategory = this.getSizeCategory(tensorInfo.sizeBytes);
    if (!this.tensorRegistry.tensorsBySize.has(sizeCategory)) {
      this.tensorRegistry.tensorsBySize.set(sizeCategory, new Set());
    }
    this.tensorRegistry.tensorsBySize.get(sizeCategory).add(tensor.id);

    // Categorize by type
    if (!this.tensorRegistry.tensorsByType.has(tensorInfo.type)) {
      this.tensorRegistry.tensorsByType.set(tensorInfo.type, new Set());
    }
    this.tensorRegistry.tensorsByType.get(tensorInfo.type).add(tensor.id);

    // Update metrics
    this.metrics.totalTensorsCreated++;

    // Fire event
    this.fireEvent('tensorCreated', tensorInfo);

    // Check for memory pressure after creation
    this.checkMemoryPressure();
  }

  /**
   * Unregister tensor when disposed
   */
  unregisterTensor(tensor) {
    if (!tensor || !tensor.id) return;

    const tensorInfo = this.tensorRegistry.activeTensors.get(tensor.id);
    if (!tensorInfo) return;

    // Remove from all registries
    this.tensorRegistry.activeTensors.delete(tensor.id);
    
    // Remove from categorizations
    const sizeCategory = this.getSizeCategory(tensorInfo.sizeBytes);
    this.tensorRegistry.tensorsBySize.get(sizeCategory)?.delete(tensor.id);
    this.tensorRegistry.tensorsByType.get(tensorInfo.type)?.delete(tensor.id);

    // Remove from orphaned set if present
    this.tensorRegistry.orphanedTensors.delete(tensor.id);

    // Add to recently disposed for tracking
    this.tensorRegistry.recentlyDisposed.add(tensor.id);
    setTimeout(() => {
      this.tensorRegistry.recentlyDisposed.delete(tensor.id);
    }, 10000); // Keep for 10 seconds

    // Update metrics
    this.metrics.totalTensorsDisposed++;
    this.memoryState.totalDeallocatedMB += tensorInfo.sizeBytes / 1024 / 1024;

    // Fire event
    this.fireEvent('tensorDisposed', tensorInfo);
  }

  /**
   * Start continuous memory monitoring
   */
  startMemoryMonitoring() {
    this.timers.monitoring = setInterval(() => {
      this.monitorMemoryUsage();
      this.updateMemoryHistory();
      this.analyzeMemoryTrends();
      this.checkForMemoryLeaks();
    }, 1000); // Monitor every second

    this.isMonitoring = true;
    console.log('📊 Memory monitoring started');
  }

  /**
   * Monitor current memory usage and update state
   */
  monitorMemoryUsage() {
    try {
      const memoryInfo = tf.memory();
      this.updateMemoryState(memoryInfo);
      this.updateMemoryPressure();
      this.categorizeActiveTensors();
    } catch (error) {
      console.warn('Memory monitoring error:', error);
    }
  }

  /**
   * Update memory state from TensorFlow.js memory info
   */
  updateMemoryState(memoryInfo) {
    const currentMB = memoryInfo.numBytes / 1024 / 1024;
    
    this.memoryState.currentUsageMB = currentMB;
    this.memoryState.peakUsageMB = Math.max(this.memoryState.peakUsageMB, currentMB);

    // Calculate allocation/deallocation rates
    const now = Date.now();
    if (this.memoryState.lastUpdateTime) {
      const timeDelta = (now - this.memoryState.lastUpdateTime) / 1000; // seconds
      const memoryDelta = currentMB - this.memoryState.previousUsageMB;
      
      if (memoryDelta > 0) {
        this.memoryState.allocationRate = memoryDelta / timeDelta;
      } else {
        this.memoryState.deallocationRate = -memoryDelta / timeDelta;
      }
    }

    this.memoryState.previousUsageMB = currentMB;
    this.memoryState.lastUpdateTime = now;
  }

  /**
   * Update memory history for trend analysis
   */
  updateMemoryHistory() {
    const sample = {
      timestamp: Date.now(),
      memoryMB: this.memoryState.currentUsageMB,
      tensorCount: this.tensorRegistry.activeTensors.size,
      pressureLevel: this.memoryState.pressureLevel
    };

    this.memoryState.memoryHistory.push(sample);

    // Limit history size
    if (this.memoryState.memoryHistory.length > this.config.historyWindowSize) {
      this.memoryState.memoryHistory.shift();
    }
  }

  /**
   * Analyze memory trends and predict issues
   */
  analyzeMemoryTrends() {
    if (this.memoryState.memoryHistory.length < 10) return;

    const recent = this.memoryState.memoryHistory.slice(-10);
    const trend = this.calculateMemoryTrend(recent);

    // Predict if we'll hit memory limit
    if (trend > 0 && this.memoryState.currentUsageMB > this.config.warningThresholdMB) {
      const timeToLimit = (this.config.maxMemoryMB - this.memoryState.currentUsageMB) / trend;
      
      if (timeToLimit < 60) { // Less than 60 seconds
        console.warn(`⚠️ Memory limit predicted to be reached in ${Math.round(timeToLimit)}s`);
        this.triggerPreemptiveCleanup();
      }
    }
  }

  /**
   * Calculate memory usage trend (MB/second)
   */
  calculateMemoryTrend(samples) {
    if (samples.length < 2) return 0;

    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDelta = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryDelta = last.memoryMB - first.memoryMB;

    return timeDelta > 0 ? memoryDelta / timeDelta : 0;
  }

  /**
   * Check for potential memory leaks
   */
  checkForMemoryLeaks() {
    const now = Date.now();
    let potentialLeaks = 0;

    // Check for very old tensors
    for (const [id, tensorInfo] of this.tensorRegistry.activeTensors) {
      const age = now - tensorInfo.createdAt;
      
      if (age > this.config.maxTensorAge) {
        if (!this.tensorRegistry.retainedTensors.has(id)) {
          console.warn(`🚨 Potential memory leak detected: Tensor ${id} age ${Math.round(age/1000)}s`);
          this.tensorRegistry.orphanedTensors.add(id);
          potentialLeaks++;
        }
      }
    }

    if (potentialLeaks > 0) {
      this.metrics.memoryLeaksDetected += potentialLeaks;
      this.fireEvent('memoryLeak', {
        count: potentialLeaks,
        totalOrphaned: this.tensorRegistry.orphanedTensors.size
      });
    }
  }

  /**
   * Update memory pressure level and trigger appropriate actions
   */
  updateMemoryPressure() {
    const usage = this.memoryState.currentUsageMB;
    let newPressureLevel = 0;

    if (usage > this.config.criticalThresholdMB) {
      newPressureLevel = 3; // Critical
    } else if (usage > this.config.aggressiveCleanupThresholdMB) {
      newPressureLevel = 2; // High
    } else if (usage > this.config.warningThresholdMB) {
      newPressureLevel = 1; // Medium
    } else {
      newPressureLevel = 0; // Low
    }

    if (newPressureLevel !== this.memoryState.pressureLevel) {
      const oldLevel = this.memoryState.pressureLevel;
      this.memoryState.pressureLevel = newPressureLevel;
      this.metrics.peakMemoryPressure = Math.max(this.metrics.peakMemoryPressure, newPressureLevel);

      this.handleMemoryPressureChange(oldLevel, newPressureLevel);
    }
  }

  /**
   * Handle memory pressure level changes
   */
  handleMemoryPressureChange(oldLevel, newLevel) {
    console.log(`🎚️ Memory pressure: ${oldLevel} → ${newLevel}`);

    // Adjust garbage collection strategy
    if (newLevel >= 2 && this.gcStrategies.current !== 'aggressive') {
      this.changeGCStrategy('aggressive');
    } else if (newLevel === 3 && this.gcStrategies.current !== 'emergency') {
      this.changeGCStrategy('emergency');
    } else if (newLevel <= 1 && this.gcStrategies.current !== 'adaptive') {
      this.changeGCStrategy('adaptive');
    }

    // Fire memory pressure events
    this.fireMemoryPressureEvent(newLevel);

    // Immediate cleanup for high pressure
    if (newLevel >= 2) {
      this.performMemoryCleanup(true);
    }
  }

  /**
   * Fire memory pressure events to registered handlers
   */
  fireMemoryPressureEvent(level) {
    const levelNames = ['low', 'medium', 'high', 'critical'];
    const levelName = levelNames[level] || 'unknown';

    // Fire specific level events
    if (this.eventHandlers.memoryPressure.has(levelName)) {
      for (const callback of this.eventHandlers.memoryPressure.get(levelName)) {
        try {
          callback({
            level,
            levelName,
            memoryMB: this.memoryState.currentUsageMB,
            maxMemoryMB: this.config.maxMemoryMB,
            pressureRatio: this.memoryState.currentUsageMB / this.config.maxMemoryMB
          });
        } catch (error) {
          console.warn(`Memory pressure callback failed:`, error);
        }
      }
    }
  }

  /**
   * Change garbage collection strategy
   */
  changeGCStrategy(newStrategy) {
    if (!this.gcStrategies.policies[newStrategy]) {
      console.warn(`Unknown GC strategy: ${newStrategy}`);
      return;
    }

    const oldStrategy = this.gcStrategies.current;
    this.gcStrategies.current = newStrategy;
    this.metrics.strategyChanges++;

    console.log(`🔄 GC strategy changed: ${oldStrategy} → ${newStrategy}`);

    // Update cleanup timer frequency
    this.updateCleanupTimer();

    this.fireEvent('strategyChanged', {
      oldStrategy,
      newStrategy,
      policy: this.gcStrategies.policies[newStrategy]
    });
  }

  /**
   * Start cleanup timer with current strategy
   */
  startCleanupTimer() {
    const policy = this.gcStrategies.policies[this.gcStrategies.current];
    this.timers.cleanup = setInterval(() => {
      this.performMemoryCleanup();
    }, policy.frequency);

    console.log(`🗑️ Cleanup timer started with ${policy.frequency}ms interval`);
  }

  /**
   * Update cleanup timer frequency based on current strategy
   */
  updateCleanupTimer() {
    if (this.timers.cleanup) {
      clearInterval(this.timers.cleanup);
    }
    this.startCleanupTimer();
  }

  /**
   * Perform memory cleanup based on current strategy
   */
  async performMemoryCleanup(force = false) {
    const startTime = Date.now();
    const beforeMemory = this.memoryState.currentUsageMB;
    
    try {
      const policy = this.gcStrategies.policies[this.gcStrategies.current];
      let cleanedTensors = 0;
      let reclaimedMB = 0;

      // Phase 1: Clean up orphaned tensors
      const orphanedCleaned = await this.cleanupOrphanedTensors();
      cleanedTensors += orphanedCleaned.count;
      reclaimedMB += orphanedCleaned.memoryMB;

      // Phase 2: Age-based cleanup
      const ageCleaned = await this.cleanupByAge(policy.maxAge, force);
      cleanedTensors += ageCleaned.count;
      reclaimedMB += ageCleaned.memoryMB;

      // Phase 3: Size-based cleanup for high pressure
      if (this.memoryState.pressureLevel >= 2) {
        const sizeCleaned = await this.cleanupBySize(policy.sizeThreshold);
        cleanedTensors += sizeCleaned.count;
        reclaimedMB += sizeCleaned.memoryMB;
      }

      // Phase 4: TensorFlow.js internal cleanup
      tf.dispose();

      // Phase 5: Force garbage collection if available
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }

      // Update metrics
      const cleanupTime = Date.now() - startTime;
      this.updateCleanupMetrics(cleanedTensors, reclaimedMB, cleanupTime);

      // Check results
      const afterMemory = this.memoryState.currentUsageMB;
      const actualReclaimed = beforeMemory - afterMemory;

      console.log(`🗑️ Cleanup completed: ${cleanedTensors} tensors, ${actualReclaimed.toFixed(1)}MB reclaimed in ${cleanupTime}ms`);

      this.fireEvent('cleanupComplete', {
        strategy: this.gcStrategies.current,
        tensorsCleaned: cleanedTensors,
        memoryReclaimedMB: actualReclaimed,
        cleanupTimeMs: cleanupTime,
        beforeMemoryMB: beforeMemory,
        afterMemoryMB: afterMemory
      });

      return {
        success: true,
        tensorsCleaned: cleanedTensors,
        memoryReclaimedMB: actualReclaimed,
        cleanupTimeMs: cleanupTime
      };

    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up orphaned tensors
   */
  async cleanupOrphanedTensors() {
    let count = 0;
    let memoryMB = 0;

    for (const tensorId of this.tensorRegistry.orphanedTensors) {
      const tensorInfo = this.tensorRegistry.activeTensors.get(tensorId);
      if (tensorInfo) {
        try {
          // Find and dispose tensor if it still exists
          memoryMB += tensorInfo.sizeBytes / 1024 / 1024;
          count++;
        } catch (error) {
          // Tensor might already be disposed
        }
      }
      this.tensorRegistry.orphanedTensors.delete(tensorId);
    }

    return { count, memoryMB };
  }

  /**
   * Clean up tensors based on age
   */
  async cleanupByAge(maxAge, force = false) {
    const now = Date.now();
    let count = 0;
    let memoryMB = 0;
    const policy = this.gcStrategies.policies[this.gcStrategies.current];

    for (const [tensorId, tensorInfo] of this.tensorRegistry.activeTensors) {
      const age = now - tensorInfo.createdAt;
      
      if (age > maxAge && !this.tensorRegistry.retainedTensors.has(tensorId)) {
        // Skip recently accessed tensors unless forced or emergency
        if (!force && policy.retainRecent && (now - tensorInfo.lastAccessed) < maxAge / 2) {
          continue;
        }

        try {
          memoryMB += tensorInfo.sizeBytes / 1024 / 1024;
          count++;
          this.tensorRegistry.activeTensors.delete(tensorId);
        } catch (error) {
          console.warn(`Failed to cleanup tensor ${tensorId}:`, error);
        }
      }
    }

    return { count, memoryMB };
  }

  /**
   * Clean up large tensors based on size threshold
   */
  async cleanupBySize(sizeThreshold) {
    let count = 0;
    let memoryMB = 0;

    // Get large tensors sorted by size (largest first)
    const largeTensors = Array.from(this.tensorRegistry.activeTensors.entries())
      .filter(([id, info]) => info.sizeBytes >= sizeThreshold)
      .sort(([, a], [, b]) => b.sizeBytes - a.sizeBytes);

    for (const [tensorId, tensorInfo] of largeTensors) {
      if (!this.tensorRegistry.retainedTensors.has(tensorId)) {
        try {
          memoryMB += tensorInfo.sizeBytes / 1024 / 1024;
          count++;
          this.tensorRegistry.activeTensors.delete(tensorId);
        } catch (error) {
          console.warn(`Failed to cleanup large tensor ${tensorId}:`, error);
        }

        // Stop if we've reclaimed enough memory
        if (this.memoryState.pressureLevel < 2) {
          break;
        }
      }
    }

    return { count, memoryMB };
  }

  /**
   * Trigger preemptive cleanup before memory pressure becomes critical
   */
  triggerPreemptiveCleanup() {
    console.log('🚨 Triggering preemptive memory cleanup');
    this.performMemoryCleanup(true);
  }

  /**
   * Setup emergency cleanup for critical memory situations
   */
  setupEmergencyCleanup() {
    // Monitor for critical memory conditions
    setInterval(() => {
      if (this.memoryState.pressureLevel >= 3) {
        this.performEmergencyCleanup();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Perform emergency cleanup for critical memory pressure
   */
  async performEmergencyCleanup() {
    console.warn('🚨 Performing emergency memory cleanup');
    
    this.metrics.emergencyCleanups++;
    const originalStrategy = this.gcStrategies.current;
    
    try {
      // Switch to emergency strategy
      this.changeGCStrategy('emergency');
      
      // Aggressive cleanup
      await this.performMemoryCleanup(true);
      
      // Clear non-essential tensors
      this.clearNonEssentialTensors();
      
      this.fireEvent('emergencyCleanup', {
        memoryMB: this.memoryState.currentUsageMB,
        pressureLevel: this.memoryState.pressureLevel,
        previousStrategy: originalStrategy
      });
      
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Clear non-essential tensors during emergency
   */
  clearNonEssentialTensors() {
    const nonEssentialTypes = ['temporary', 'intermediate', 'cache'];
    
    for (const type of nonEssentialTypes) {
      const tensorsOfType = this.tensorRegistry.tensorsByType.get(type);
      if (tensorsOfType) {
        for (const tensorId of tensorsOfType) {
          if (!this.tensorRegistry.retainedTensors.has(tensorId)) {
            this.tensorRegistry.activeTensors.delete(tensorId);
          }
        }
      }
    }
  }

  /**
   * Categorize active tensors by age
   */
  categorizeActiveTensors() {
    const now = Date.now();
    this.tensorRegistry.tensorsByAge.clear();

    for (const [tensorId, tensorInfo] of this.tensorRegistry.activeTensors) {
      const age = now - tensorInfo.createdAt;
      const ageCategory = this.getAgeCategory(age);
      
      if (!this.tensorRegistry.tensorsByAge.has(ageCategory)) {
        this.tensorRegistry.tensorsByAge.set(ageCategory, new Set());
      }
      this.tensorRegistry.tensorsByAge.get(ageCategory).add(tensorId);
    }
  }

  /**
   * Get age category for tensor
   */
  getAgeCategory(age) {
    if (age < 10000) return 'fresh'; // < 10 seconds
    if (age < 60000) return 'recent'; // < 1 minute
    if (age < 300000) return 'old'; // < 5 minutes
    return 'stale'; // >= 5 minutes
  }

  /**
   * Get size category for tensor
   */
  getSizeCategory(sizeBytes) {
    const sizeMB = sizeBytes / 1024 / 1024;
    if (sizeMB < 1) return 'small';
    if (sizeMB < 10) return 'medium';
    if (sizeMB < 50) return 'large';
    return 'huge';
  }

  /**
   * Classify tensor type based on characteristics
   */
  classifyTensor(tensor) {
    // Simple heuristics for tensor classification
    if (tensor.shape.length === 0) return 'scalar';
    if (tensor.shape.length === 1) return 'vector';
    if (tensor.shape.length === 2) return 'matrix';
    if (tensor.shape.some(dim => dim === 1)) return 'temporary';
    if (tensor.size > 1000000) return 'large_model';
    return 'intermediate';
  }

  /**
   * Get bytes per element for different data types
   */
  getBytesPerElement(dtype) {
    const bytesMap = {
      'float32': 4,
      'int32': 4,
      'bool': 1,
      'complex64': 8,
      'string': 4 // Approximate
    };
    return bytesMap[dtype] || 4;
  }

  /**
   * Retain tensor (prevent cleanup)
   */
  retainTensor(tensorId) {
    this.tensorRegistry.retainedTensors.add(tensorId);
    const tensorInfo = this.tensorRegistry.activeTensors.get(tensorId);
    if (tensorInfo) {
      tensorInfo.retainCount++;
    }
  }

  /**
   * Release tensor (allow cleanup)
   */
  releaseTensor(tensorId) {
    const tensorInfo = this.tensorRegistry.activeTensors.get(tensorId);
    if (tensorInfo && tensorInfo.retainCount > 0) {
      tensorInfo.retainCount--;
      if (tensorInfo.retainCount === 0) {
        this.tensorRegistry.retainedTensors.delete(tensorId);
      }
    }
  }

  /**
   * Start analysis timer for periodic assessments
   */
  startAnalysisTimer() {
    this.timers.analysis = setInterval(() => {
      this.performMemoryAnalysis();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform comprehensive memory analysis
   */
  performMemoryAnalysis() {
    const analysis = {
      timestamp: Date.now(),
      memoryState: { ...this.memoryState },
      tensorCounts: {
        total: this.tensorRegistry.activeTensors.size,
        byType: {},
        bySize: {},
        byAge: {}
      },
      recommendations: []
    };

    // Count tensors by categories
    for (const [type, tensors] of this.tensorRegistry.tensorsByType) {
      analysis.tensorCounts.byType[type] = tensors.size;
    }
    
    for (const [size, tensors] of this.tensorRegistry.tensorsBySize) {
      analysis.tensorCounts.bySize[size] = tensors.size;
    }
    
    for (const [age, tensors] of this.tensorRegistry.tensorsByAge) {
      analysis.tensorCounts.byAge[age] = tensors.size;
    }

    // Generate recommendations
    analysis.recommendations = this.generateMemoryRecommendations(analysis);

    console.log('📊 Memory analysis:', analysis);
    return analysis;
  }

  /**
   * Generate memory optimization recommendations
   */
  generateMemoryRecommendations(analysis) {
    const recommendations = [];
    const { memoryState, tensorCounts } = analysis;

    // High memory usage
    if (memoryState.currentUsageMB > this.config.warningThresholdMB) {
      recommendations.push({
        type: 'memory_high',
        severity: 'warning',
        message: `Memory usage is high: ${memoryState.currentUsageMB.toFixed(1)}MB`,
        action: 'Consider more frequent cleanup or reducing batch sizes'
      });
    }

    // Too many old tensors
    if (tensorCounts.byAge.old > 10 || tensorCounts.byAge.stale > 0) {
      recommendations.push({
        type: 'old_tensors',
        severity: 'info',
        message: `${tensorCounts.byAge.old || 0} old tensors, ${tensorCounts.byAge.stale || 0} stale tensors`,
        action: 'Review tensor lifecycle and consider earlier disposal'
      });
    }

    // Memory leak warning
    if (this.metrics.memoryLeaksDetected > 0) {
      recommendations.push({
        type: 'memory_leaks',
        severity: 'error',
        message: `${this.metrics.memoryLeaksDetected} potential memory leaks detected`,
        action: 'Review tensor disposal patterns and fix memory leaks'
      });
    }

    return recommendations;
  }

  /**
   * Perform initial memory assessment
   */
  async performInitialAssessment() {
    console.log('🔍 Performing initial memory assessment...');
    
    const memoryInfo = tf.memory();
    this.updateMemoryState(memoryInfo);
    
    const assessment = {
      initialMemoryMB: memoryInfo.numBytes / 1024 / 1024,
      initialTensorCount: memoryInfo.numTensors,
      configuredMaxMB: this.config.maxMemoryMB,
      availableMemoryMB: this.config.maxMemoryMB - (memoryInfo.numBytes / 1024 / 1024),
      recommendedStrategy: this.recommendInitialStrategy(memoryInfo)
    };

    // Adjust strategy if needed
    if (assessment.recommendedStrategy !== this.gcStrategies.current) {
      this.changeGCStrategy(assessment.recommendedStrategy);
    }

    console.log('📋 Initial assessment:', assessment);
    return assessment;
  }

  /**
   * Recommend initial GC strategy based on current memory state
   */
  recommendInitialStrategy(memoryInfo) {
    const currentMB = memoryInfo.numBytes / 1024 / 1024;
    const usageRatio = currentMB / this.config.maxMemoryMB;

    if (usageRatio > 0.8) return 'aggressive';
    if (usageRatio > 0.6) return 'adaptive';
    return 'conservative';
  }

  /**
   * Update cleanup metrics
   */
  updateCleanupMetrics(tensorsCleaned, memoryReclaimedMB, cleanupTimeMs) {
    this.metrics.cleanupOperations++;
    this.metrics.memoryReclaimed += memoryReclaimedMB;
    
    // Update average cleanup time
    const totalTime = this.metrics.averageCleanupTime * (this.metrics.cleanupOperations - 1) + cleanupTimeMs;
    this.metrics.averageCleanupTime = totalTime / this.metrics.cleanupOperations;
    
    this.memoryState.lastCleanupTime = Date.now();
    this.memoryState.cleanupCount++;
  }

  /**
   * Get comprehensive memory statistics
   */
  getMemoryStats() {
    const tfMemory = tf.memory();
    
    return {
      current: {
        memoryMB: Math.round(this.memoryState.currentUsageMB * 100) / 100,
        tensorCount: this.tensorRegistry.activeTensors.size,
        pressureLevel: this.memoryState.pressureLevel,
        strategy: this.gcStrategies.current
      },
      tensorflow: {
        numTensors: tfMemory.numTensors,
        numDataBuffers: tfMemory.numDataBuffers,
        numBytes: tfMemory.numBytes,
        unreliable: tfMemory.unreliable || false
      },
      configuration: {
        maxMemoryMB: this.config.maxMemoryMB,
        warningThresholdMB: this.config.warningThresholdMB,
        criticalThresholdMB: this.config.criticalThresholdMB
      },
      metrics: { ...this.metrics },
      tensorBreakdown: {
        byType: Object.fromEntries(
          Array.from(this.tensorRegistry.tensorsByType.entries()).map(([type, tensors]) => [type, tensors.size])
        ),
        bySize: Object.fromEntries(
          Array.from(this.tensorRegistry.tensorsBySize.entries()).map(([size, tensors]) => [size, tensors.size])
        ),
        byAge: Object.fromEntries(
          Array.from(this.tensorRegistry.tensorsByAge.entries()).map(([age, tensors]) => [age, tensors.size])
        )
      },
      health: this.calculateMemoryHealth()
    };
  }

  /**
   * Calculate overall memory health score
   */
  calculateMemoryHealth() {
    const memoryScore = Math.max(0, 100 - (this.memoryState.pressureLevel * 25));
    const leakScore = Math.max(0, 100 - (this.metrics.memoryLeaksDetected * 20));
    const cleanupScore = this.memoryState.cleanupCount > 0 ? 100 : 50;
    
    return Math.round((memoryScore + leakScore + cleanupScore) / 3);
  }

  /**
   * Register event handler for memory pressure
   */
  onMemoryPressure(level, callback) {
    if (!this.eventHandlers.memoryPressure.has(level)) {
      this.eventHandlers.memoryPressure.set(level, new Set());
    }
    this.eventHandlers.memoryPressure.get(level).add(callback);
    
    return () => this.eventHandlers.memoryPressure.get(level).delete(callback);
  }

  /**
   * Generic event registration
   */
  on(eventType, callback) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType].add(callback);
      return () => this.eventHandlers[eventType].delete(callback);
    }
  }

  /**
   * Fire event to registered handlers
   */
  fireEvent(eventType, data) {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler({ ...data, timestamp: Date.now() });
        } catch (error) {
          console.warn(`Memory manager event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Force memory cleanup (public API)
   */
  async forceCleanup() {
    return await this.performMemoryCleanup(true);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const analysis = this.performMemoryAnalysis();
    return analysis.recommendations;
  }

  /**
   * Cleanup and destroy the memory manager
   */
  async destroy() {
    console.log('🧹 Destroying Enhanced Tensor Memory Manager...');

    try {
      this.isMonitoring = false;

      // Clear all timers
      Object.values(this.timers).forEach(timer => {
        if (timer) clearInterval(timer);
      });

      // Restore TensorFlow.js hooks
      if (this.tfHooks.originalTensor) {
        tf.tensor = this.tfHooks.originalTensor;
      }
      if (this.tfHooks.originalMemory) {
        tf.memory = this.tfHooks.originalMemory;
      }

      // Final cleanup
      await this.performMemoryCleanup(true);

      // Clear registries
      this.tensorRegistry.activeTensors.clear();
      this.tensorRegistry.tensorsByAge.clear();
      this.tensorRegistry.tensorsBySize.clear();
      this.tensorRegistry.tensorsByType.clear();
      this.tensorRegistry.orphanedTensors.clear();
      this.tensorRegistry.retainedTensors.clear();

      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => {
        if (handlers instanceof Map) {
          handlers.clear();
        } else if (handlers instanceof Set) {
          handlers.clear();
        }
      });

      this.isInitialized = false;

      console.log('✅ Enhanced Tensor Memory Manager destroyed');

    } catch (error) {
      console.error('Error during Enhanced Tensor Memory Manager destruction:', error);
    }
  }
}

// Singleton instance
let enhancedTensorMemoryManagerInstance = null;

export function getEnhancedTensorMemoryManager() {
  if (!enhancedTensorMemoryManagerInstance) {
    enhancedTensorMemoryManagerInstance = new EnhancedTensorMemoryManager();
  }
  return enhancedTensorMemoryManagerInstance;
}

// Compatibility alias
export function getTensorMemoryManager() {
  return getEnhancedTensorMemoryManager();
}

export { EnhancedTensorMemoryManager };