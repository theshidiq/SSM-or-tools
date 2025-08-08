/**
 * ConfigurationCacheManager.js
 * 
 * Advanced cache manager for configuration service with intelligent caching,
 * performance monitoring, and memory optimization.
 * 
 * Features:
 * - Multi-level caching with TTL support
 * - Memory pressure handling and automatic cleanup
 * - Cache hit/miss analytics
 * - Prefetching and background refresh
 * - Cache warming strategies
 * - Memory usage monitoring
 */

export class ConfigurationCacheManager {
  constructor(options = {}) {
    // Cache configuration
    this.config = {
      maxMemoryUsage: options.maxMemoryUsage || 50 * 1024 * 1024, // 50MB
      defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
      maxCacheSize: options.maxCacheSize || 10000,
      cleanupInterval: options.cleanupInterval || 60 * 1000, // 1 minute
      prefetchThreshold: options.prefetchThreshold || 0.8, // When to prefetch
      memoryPressureThreshold: options.memoryPressureThreshold || 0.9, // When to cleanup
    };

    // Multi-level cache storage
    this.l1Cache = new Map(); // Frequently accessed items
    this.l2Cache = new Map(); // Less frequently accessed items
    this.metadataCache = new Map(); // Cache metadata
    
    // Performance metrics
    this.metrics = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      prefetchCount: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
      cacheEfficiency: 0,
      lastCleanupTime: Date.now(),
    };

    // Access frequency tracking
    this.accessCounts = new Map();
    this.accessTimes = new Map();
    this.prefetchQueue = new Set();

    // Background tasks
    this.cleanupInterval = null;
    this.isRunning = false;
    
    // Event handlers
    this.eventHandlers = {
      hit: [],
      miss: [],
      eviction: [],
      memoryWarning: []
    };
  }

  /**
   * Initialize cache manager
   */
  async initialize() {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Start background cleanup
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, this.config.cleanupInterval);

    // Monitor memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      setInterval(() => {
        this.updateMemoryUsage();
      }, 30000); // Every 30 seconds
    }

    console.log('✅ Configuration Cache Manager initialized');
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @param {Object} options - Get options
   */
  async get(key, options = {}) {
    const startTime = performance.now();
    
    try {
      // Check L1 cache first
      let cacheEntry = this.l1Cache.get(key);
      let fromL2 = false;

      // Check L2 cache if not in L1
      if (!cacheEntry) {
        cacheEntry = this.l2Cache.get(key);
        fromL2 = true;
      }

      if (cacheEntry) {
        // Check TTL
        if (this.isExpired(cacheEntry)) {
          this.evict(key);
          this.recordMiss(key, startTime);
          return null;
        }

        // Update access metadata
        this.recordAccess(key, fromL2);
        
        // Promote to L1 if frequently accessed
        if (fromL2 && this.shouldPromoteToL1(key)) {
          this.promoteToL1(key, cacheEntry);
        }

        // Check if needs prefetching
        if (this.shouldPrefetch(cacheEntry)) {
          this.schedulePrefetch(key, options);
        }

        this.recordHit(key, startTime);
        this.emitEvent('hit', { key, fromL2, value: cacheEntry.value });
        
        return cacheEntry.value;
      }

      this.recordMiss(key, startTime);
      return null;

    } catch (error) {
      console.error('❌ Cache get error:', error);
      this.recordMiss(key, startTime);
      return null;
    }
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Set options
   */
  async set(key, value, options = {}) {
    try {
      const now = Date.now();
      const ttl = options.ttl || this.config.defaultTTL;
      const priority = options.priority || 'normal'; // 'high', 'normal', 'low'
      
      const cacheEntry = {
        key,
        value,
        createdAt: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        size: this.estimateSize(value),
        priority,
        version: options.version || 1,
      };

      // Check memory pressure before adding
      if (this.isMemoryPressureHigh()) {
        await this.freeMemory();
      }

      // Determine which cache level to use
      const useL1 = priority === 'high' || this.shouldUseL1(key);
      
      if (useL1) {
        this.l1Cache.set(key, cacheEntry);
        // Remove from L2 if exists
        if (this.l2Cache.has(key)) {
          this.l2Cache.delete(key);
        }
      } else {
        this.l2Cache.set(key, cacheEntry);
      }

      // Store metadata
      this.metadataCache.set(key, {
        level: useL1 ? 'L1' : 'L2',
        createdAt: now,
        priority,
      });

      // Update metrics
      this.updateMemoryMetrics();

      return true;

    } catch (error) {
      console.error('❌ Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   */
  async delete(key) {
    try {
      const deleted = this.l1Cache.delete(key) || this.l2Cache.delete(key);
      
      if (deleted) {
        this.metadataCache.delete(key);
        this.accessCounts.delete(key);
        this.accessTimes.delete(key);
        this.prefetchQueue.delete(key);
        
        this.updateMemoryMetrics();
      }

      return deleted;

    } catch (error) {
      console.error('❌ Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear entire cache
   */
  async clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.metadataCache.clear();
    this.accessCounts.clear();
    this.accessTimes.clear();
    this.prefetchQueue.clear();
    
    this.metrics.memoryUsage = 0;
    console.log('🧹 Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalItems = this.l1Cache.size + this.l2Cache.size;
    const hitRate = this.metrics.hitCount + this.metrics.missCount > 0 
      ? (this.metrics.hitCount / (this.metrics.hitCount + this.metrics.missCount)) * 100 
      : 0;

    return {
      ...this.metrics,
      totalItems,
      l1Items: this.l1Cache.size,
      l2Items: this.l2Cache.size,
      hitRate,
      missRate: 100 - hitRate,
      memoryUsagePercent: (this.metrics.memoryUsage / this.config.maxMemoryUsage) * 100,
      cacheEfficiency: hitRate > 0 ? hitRate / 100 : 0,
    };
  }

  /**
   * Warm cache with frequently accessed data
   * @param {Array} keys - Keys to warm
   * @param {Function} dataLoader - Function to load data
   */
  async warmCache(keys, dataLoader) {
    console.log(`🔥 Warming cache with ${keys.length} keys`);
    
    const warmPromises = keys.map(async (key) => {
      try {
        if (!this.has(key)) {
          const value = await dataLoader(key);
          if (value !== null && value !== undefined) {
            await this.set(key, value, { priority: 'high' });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to warm cache for key ${key}:`, error);
      }
    });

    await Promise.all(warmPromises);
    console.log('✅ Cache warming completed');
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   */
  has(key) {
    return this.l1Cache.has(key) || this.l2Cache.has(key);
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Check if cache entry is expired
   */
  isExpired(cacheEntry) {
    return Date.now() > cacheEntry.expiresAt;
  }

  /**
   * Record cache hit
   */
  recordHit(key, startTime) {
    this.metrics.hitCount++;
    this.recordAccessTime(startTime);
  }

  /**
   * Record cache miss
   */
  recordMiss(key, startTime) {
    this.metrics.missCount++;
    this.recordAccessTime(startTime);
    this.emitEvent('miss', { key });
  }

  /**
   * Record access time for performance metrics
   */
  recordAccessTime(startTime) {
    const accessTime = performance.now() - startTime;
    this.metrics.averageAccessTime = (
      (this.metrics.averageAccessTime + accessTime) / 2
    );
  }

  /**
   * Record access for frequency tracking
   */
  recordAccess(key, fromL2) {
    const count = this.accessCounts.get(key) || 0;
    this.accessCounts.set(key, count + 1);
    this.accessTimes.set(key, Date.now());

    // Update cache level efficiency
    if (fromL2) {
      this.metrics.l2Hits = (this.metrics.l2Hits || 0) + 1;
    }
  }

  /**
   * Check if key should be promoted to L1
   */
  shouldPromoteToL1(key) {
    const accessCount = this.accessCounts.get(key) || 0;
    return accessCount >= 3; // Promote after 3 accesses
  }

  /**
   * Promote cache entry to L1
   */
  promoteToL1(key, cacheEntry) {
    this.l1Cache.set(key, cacheEntry);
    this.l2Cache.delete(key);
    
    const metadata = this.metadataCache.get(key);
    if (metadata) {
      metadata.level = 'L1';
      this.metadataCache.set(key, metadata);
    }
  }

  /**
   * Check if should use L1 cache
   */
  shouldUseL1(key) {
    const metadata = this.metadataCache.get(key);
    return metadata && metadata.priority === 'high';
  }

  /**
   * Check if should prefetch
   */
  shouldPrefetch(cacheEntry) {
    const timeUntilExpiry = cacheEntry.expiresAt - Date.now();
    const ttl = cacheEntry.expiresAt - cacheEntry.createdAt;
    
    return (timeUntilExpiry / ttl) <= this.config.prefetchThreshold;
  }

  /**
   * Schedule prefetch
   */
  schedulePrefetch(key, options) {
    if (!this.prefetchQueue.has(key)) {
      this.prefetchQueue.add(key);
      this.metrics.prefetchCount++;
      
      // Emit prefetch event for external handling
      this.emitEvent('prefetch', { key, options });
    }
  }

  /**
   * Check memory pressure
   */
  isMemoryPressureHigh() {
    return (this.metrics.memoryUsage / this.config.maxMemoryUsage) > 
           this.config.memoryPressureThreshold;
  }

  /**
   * Free memory by evicting least accessed items
   */
  async freeMemory() {
    const targetReduction = this.config.maxMemoryUsage * 0.1; // Free 10%
    let freedMemory = 0;
    
    // Get all cache entries sorted by access frequency
    const allEntries = [];
    
    for (const [key, entry] of this.l2Cache) {
      allEntries.push({
        key,
        entry,
        level: 'L2',
        accessCount: this.accessCounts.get(key) || 0,
        lastAccessed: this.accessTimes.get(key) || 0,
      });
    }

    // Sort by access count (ascending) and last accessed time
    allEntries.sort((a, b) => {
      if (a.accessCount !== b.accessCount) {
        return a.accessCount - b.accessCount;
      }
      return a.lastAccessed - b.lastAccessed;
    });

    // Evict least accessed items
    for (const { key, entry } of allEntries) {
      if (freedMemory >= targetReduction) break;
      
      await this.evict(key);
      freedMemory += entry.size || 0;
    }

    console.log(`🧹 Freed ${freedMemory} bytes from cache`);
  }

  /**
   * Evict cache entry
   */
  evict(key) {
    const deleted = this.l1Cache.delete(key) || this.l2Cache.delete(key);
    
    if (deleted) {
      this.metadataCache.delete(key);
      this.accessCounts.delete(key);
      this.accessTimes.delete(key);
      this.prefetchQueue.delete(key);
      
      this.metrics.evictionCount++;
      this.emitEvent('eviction', { key });
    }

    return deleted;
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance() {
    const now = Date.now();
    let expiredCount = 0;

    // Clean expired entries
    for (const [key, entry] of [...this.l1Cache, ...this.l2Cache]) {
      if (this.isExpired(entry)) {
        await this.evict(key);
        expiredCount++;
      }
    }

    // Update metrics
    this.updateMemoryMetrics();
    this.metrics.lastCleanupTime = now;

    if (expiredCount > 0) {
      console.log(`🧹 Cleaned ${expiredCount} expired cache entries`);
    }

    // Check memory pressure
    if (this.isMemoryPressureHigh()) {
      this.emitEvent('memoryWarning', { 
        usage: this.metrics.memoryUsage,
        threshold: this.config.maxMemoryUsage 
      });
      await this.freeMemory();
    }
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryMetrics() {
    let totalSize = 0;
    
    for (const entry of [...this.l1Cache.values(), ...this.l2Cache.values()]) {
      totalSize += entry.size || 0;
    }
    
    this.metrics.memoryUsage = totalSize;
  }

  /**
   * Update memory usage from system
   */
  updateMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.systemMemoryUsage = usage.heapUsed;
      this.metrics.systemMemoryTotal = usage.heapTotal;
    }
  }

  /**
   * Estimate object size in bytes
   */
  estimateSize(obj) {
    try {
      if (obj === null || obj === undefined) return 0;
      
      const jsonString = JSON.stringify(obj);
      return jsonString.length * 2; // Rough estimate for UTF-16 encoding
      
    } catch (error) {
      return 1000; // Default estimate
    }
  }

  /**
   * Emit event to registered handlers
   */
  emitEvent(eventName, data) {
    const handlers = this.eventHandlers[eventName] || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`❌ Cache event handler error for ${eventName}:`, error);
      }
    });
  }

  /**
   * Cleanup and stop background tasks
   */
  async cleanup() {
    this.isRunning = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.clear();
    console.log('✅ Configuration Cache Manager cleaned up');
  }
}

/**
 * Configuration Performance Monitor
 * 
 * Monitors performance of configuration system and provides insights
 */
export class ConfigurationPerformanceMonitor {
  constructor(configService, cacheManager) {
    this.configService = configService;
    this.cacheManager = cacheManager;
    
    // Performance tracking
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryEfficiency: 0,
      },
      database: {
        queries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPoolStatus: 0,
      },
      realtime: {
        subscriptions: 0,
        messagesReceived: 0,
        averageLatency: 0,
        reconnections: 0,
      },
    };

    // Response time tracking
    this.responseTimes = [];
    this.maxResponseTimes = 1000; // Keep last 1000 response times

    // Monitoring intervals
    this.monitoringInterval = null;
    this.isMonitoring = false;

    // Alerts and thresholds
    this.thresholds = {
      responseTime: 1000, // ms
      cacheHitRate: 80, // %
      memoryUsage: 90, // %
      errorRate: 5, // %
    };

    this.alerts = [];
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Monitor cache events
    this.cacheManager.on('hit', (data) => {
      this.recordCacheHit();
    });

    this.cacheManager.on('miss', (data) => {
      this.recordCacheMiss();
    });

    this.cacheManager.on('memoryWarning', (data) => {
      this.recordAlert('high_memory_usage', data);
    });

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds

    console.log('📊 Configuration Performance Monitor started');
  }

  /**
   * Record configuration request
   */
  recordRequest(responseTime, success = true) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update response times
    this.responseTimes.push({
      time: responseTime,
      timestamp: Date.now(),
    });

    // Keep only recent response times
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimes);
    }

    // Update averages
    this.updateResponseTimeMetrics();

    // Check thresholds
    if (responseTime > this.thresholds.responseTime) {
      this.recordAlert('slow_response', { responseTime });
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100 
      : 0;

    const cacheStats = this.cacheManager.getStats();

    return {
      summary: {
        overallHealth: this.calculateOverallHealth(),
        errorRate,
        averageResponseTime: this.metrics.requests.averageResponseTime,
        cacheEfficiency: cacheStats.cacheEfficiency,
      },
      metrics: this.metrics,
      cache: cacheStats,
      alerts: this.getRecentAlerts(),
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const cacheStats = this.cacheManager.getStats();
    
    if (cacheStats.hitRate < this.thresholds.cacheHitRate) {
      recommendations.push({
        type: 'cache_optimization',
        priority: 'high',
        message: 'Cache hit rate is low. Consider increasing cache TTL or warming cache.',
        metric: 'hit_rate',
        currentValue: cacheStats.hitRate,
        targetValue: this.thresholds.cacheHitRate,
      });
    }

    if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
      recommendations.push({
        type: 'performance_optimization',
        priority: 'medium',
        message: 'Average response time is high. Consider optimizing database queries or caching strategy.',
        metric: 'response_time',
        currentValue: this.metrics.requests.averageResponseTime,
        targetValue: this.thresholds.responseTime,
      });
    }

    if (cacheStats.memoryUsagePercent > this.thresholds.memoryUsage) {
      recommendations.push({
        type: 'memory_optimization',
        priority: 'high',
        message: 'Memory usage is high. Consider reducing cache size or implementing more aggressive eviction.',
        metric: 'memory_usage',
        currentValue: cacheStats.memoryUsagePercent,
        targetValue: this.thresholds.memoryUsage,
      });
    }

    return recommendations;
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  recordCacheHit() {
    // Cache metrics are handled by cache manager
  }

  recordCacheMiss() {
    // Cache metrics are handled by cache manager
  }

  recordAlert(type, data) {
    this.alerts.push({
      type,
      data,
      timestamp: Date.now(),
    });

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  updateResponseTimeMetrics() {
    if (this.responseTimes.length === 0) return;

    // Calculate average
    const sum = this.responseTimes.reduce((acc, rt) => acc + rt.time, 0);
    this.metrics.requests.averageResponseTime = sum / this.responseTimes.length;

    // Calculate percentiles
    const sortedTimes = this.responseTimes.map(rt => rt.time).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    this.metrics.requests.p95ResponseTime = sortedTimes[p95Index] || 0;
    this.metrics.requests.p99ResponseTime = sortedTimes[p99Index] || 0;
  }

  collectMetrics() {
    // Update cache metrics
    const cacheStats = this.cacheManager.getStats();
    this.metrics.cache = {
      hitRate: cacheStats.hitRate,
      missRate: cacheStats.missRate,
      evictionRate: cacheStats.evictionCount > 0 ? 
        (cacheStats.evictionCount / (cacheStats.hitCount + cacheStats.missCount)) * 100 : 0,
      memoryEfficiency: cacheStats.cacheEfficiency,
    };

    // Check for performance issues
    this.checkPerformanceThresholds();
  }

  checkPerformanceThresholds() {
    const cacheStats = this.cacheManager.getStats();
    const errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100 
      : 0;

    if (errorRate > this.thresholds.errorRate) {
      this.recordAlert('high_error_rate', { errorRate });
    }

    if (cacheStats.hitRate < this.thresholds.cacheHitRate) {
      this.recordAlert('low_cache_hit_rate', { hitRate: cacheStats.hitRate });
    }
  }

  calculateOverallHealth() {
    const cacheStats = this.cacheManager.getStats();
    const errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100 
      : 0;

    // Health score based on multiple factors
    let healthScore = 100;
    
    // Penalize high error rate
    healthScore -= Math.min(errorRate * 2, 30);
    
    // Penalize slow response times
    if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
      healthScore -= 20;
    }
    
    // Penalize low cache hit rate
    if (cacheStats.hitRate < this.thresholds.cacheHitRate) {
      healthScore -= 15;
    }
    
    // Penalize high memory usage
    if (cacheStats.memoryUsagePercent > this.thresholds.memoryUsage) {
      healthScore -= 25;
    }

    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('📊 Configuration Performance Monitor stopped');
  }
}