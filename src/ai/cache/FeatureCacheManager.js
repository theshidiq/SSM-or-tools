/**
 * FeatureCacheManager.js
 * 
 * Session-based in-memory feature caching system for lightning-fast AI predictions.
 * Caches pre-computed features by staff + date combination in memory only.
 * Recalculates on configuration changes and fresh on each session.
 */

import { EnhancedFeatureEngineering } from "../ml/EnhancedFeatureEngineering.js";

class FeatureCacheManager {
  constructor() {
    // Memory-only cache (no persistence across sessions)
    this.cache = new Map();
    this.configHash = null;
    this.featureEngineer = new EnhancedFeatureEngineering();
    
    // Performance monitoring
    this.stats = {
      hits: 0,
      misses: 0,
      generation_times: [],
      cache_size: 0,
      invalidations: 0,
      background_precomputed: 0
    };
    
    // Cache metadata
    this.metadata = {
      created: Date.now(),
      last_invalidation: null,
      session_id: this.generateSessionId(),
      version: "1.0.0"
    };
    
    // Background computation state
    this.precomputeController = null;
    this.precomputeQueue = [];
    this.isPrecomputing = false;
    
    console.log(`🚀 FeatureCacheManager initialized - Session ID: ${this.metadata.session_id}`);
  }

  /**
   * Generate unique session identifier
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate configuration hash for cache invalidation
   */
  generateConfigHash(staffMembers = [], scheduleData = {}, additionalConfig = {}) {
    try {
      const configData = {
        staff: staffMembers.map(s => ({ id: s.id, name: s.name, status: s.status, department: s.department })),
        scheduleStructure: Object.keys(scheduleData),
        additional: additionalConfig,
        timestamp: Math.floor(Date.now() / (1000 * 60 * 10)) // 10-minute granularity for stability
      };
      
      return this.hashObject(configData);
    } catch (error) {
      console.warn("⚠️ Config hash generation failed:", error.message);
      return `fallback-${Date.now()}`;
    }
  }

  /**
   * Simple object hashing for configuration tracking
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cache key for staff + date combination
   */
  getCacheKey(staffId, dateKey) {
    return `${staffId}-${dateKey}-${this.configHash}`;
  }

  /**
   * Check if cache is valid for current configuration
   */
  isValid(currentConfigHash) {
    return this.configHash === currentConfigHash;
  }

  /**
   * Invalidate cache when configuration changes
   */
  invalidateOnConfigChange(newStaffMembers = [], newScheduleData = {}, additionalConfig = {}) {
    const newConfigHash = this.generateConfigHash(newStaffMembers, newScheduleData, additionalConfig);
    
    if (this.configHash !== newConfigHash) {
      console.log(`🔄 Config change detected - invalidating feature cache (${this.cache.size} entries)`);
      
      this.cache.clear();
      this.configHash = newConfigHash;
      this.metadata.last_invalidation = Date.now();
      this.stats.invalidations++;
      
      // Stop any ongoing background computation
      if (this.precomputeController) {
        this.precomputeController.abort();
        this.precomputeController = null;
      }
      
      this.precomputeQueue = [];
      this.isPrecomputing = false;
      
      console.log(`✅ Cache invalidated - new config hash: ${this.configHash}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get cached features for staff + date combination
   */
  getFeatures(staffId, dateKey) {
    const cacheKey = this.getCacheKey(staffId, dateKey);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      this.stats.hits++;
      
      // Validate cached features
      if (this.validateCachedFeatures(cached.features)) {
        return {
          success: true,
          features: cached.features,
          cached: true,
          timestamp: cached.timestamp,
          generation_time: 0 // Instant from cache
        };
      } else {
        // Remove invalid cached entry
        this.cache.delete(cacheKey);
        console.warn(`⚠️ Invalid cached features removed for ${staffId}-${dateKey}`);
      }
    }
    
    this.stats.misses++;
    return {
      success: false,
      cached: false,
      reason: "cache_miss"
    };
  }

  /**
   * Cache features for staff + date combination
   */
  setFeatures(staffId, dateKey, features, metadata = {}) {
    if (!this.validateCachedFeatures(features)) {
      console.warn(`⚠️ Refusing to cache invalid features for ${staffId}-${dateKey}`);
      return false;
    }

    const cacheKey = this.getCacheKey(staffId, dateKey);
    const cacheEntry = {
      features: [...features], // Deep copy to prevent mutations
      timestamp: Date.now(),
      staffId,
      dateKey,
      configHash: this.configHash,
      metadata: { ...metadata }
    };

    this.cache.set(cacheKey, cacheEntry);
    this.stats.cache_size = this.cache.size;

    return true;
  }

  /**
   * Validate features before caching or returning
   */
  validateCachedFeatures(features) {
    if (!Array.isArray(features)) return false;
    if (features.length === 0) return false;
    
    // Check for NaN or infinite values
    return features.every(f => typeof f === 'number' && isFinite(f));
  }

  /**
   * Generate features and cache them (with performance monitoring)
   */
  async generateAndCache(staff, date, dateIndex, periodData, allHistoricalData, staffMembers) {
    const dateKey = date.toISOString().split("T")[0];
    const startTime = Date.now();

    try {
      // Generate features using the feature engineer
      const features = this.featureEngineer.generateFeatures({
        staff,
        date,
        dateIndex,
        periodData,
        allHistoricalData,
        staffMembers
      });

      const generationTime = Date.now() - startTime;
      this.stats.generation_times.push(generationTime);

      // Keep only last 100 generation times for rolling average
      if (this.stats.generation_times.length > 100) {
        this.stats.generation_times.shift();
      }

      if (this.validateCachedFeatures(features)) {
        // Cache the generated features
        this.setFeatures(staff.id, dateKey, features, {
          generation_time: generationTime,
          date_index: dateIndex
        });

        return {
          success: true,
          features,
          cached: true,
          generation_time: generationTime
        };
      } else {
        throw new Error("Generated features failed validation");
      }

    } catch (error) {
      console.warn(`⚠️ Feature generation failed for ${staff.name} on ${dateKey}:`, error.message);
      return {
        success: false,
        error: error.message,
        generation_time: Date.now() - startTime
      };
    }
  }

  /**
   * Background pre-computation of features during idle time
   */
  async startBackgroundPrecomputation(staffMembers, dateRange, periodData, allHistoricalData) {
    if (this.isPrecomputing) {
      console.log("📊 Background precomputation already running");
      return;
    }

    console.log(`🚀 Starting background feature precomputation for ${staffMembers.length} staff over ${dateRange.length} dates`);
    
    this.isPrecomputing = true;
    this.precomputeController = new AbortController();
    
    // Create precomputation queue
    this.precomputeQueue = [];
    for (const staff of staffMembers) {
      for (let i = 0; i < dateRange.length; i++) {
        const date = dateRange[i];
        const dateKey = date.toISOString().split("T")[0];
        
        // Only queue if not already cached
        if (!this.getFeatures(staff.id, dateKey).success) {
          this.precomputeQueue.push({
            staff,
            date,
            dateIndex: i,
            dateKey,
            periodData,
            allHistoricalData,
            staffMembers
          });
        }
      }
    }

    console.log(`📦 Queued ${this.precomputeQueue.length} features for background precomputation`);
    
    // Process queue during idle time
    await this.processPrecomputeQueue();
  }

  /**
   * Process precomputation queue using requestIdleCallback
   */
  async processPrecomputeQueue() {
    const processNextBatch = async (deadline) => {
      try {
        // Check if operation was aborted
        if (this.precomputeController?.signal.aborted) {
          this.isPrecomputing = false;
          return;
        }

        const BATCH_SIZE = 3; // Process 3 features at a time during idle
        let processed = 0;
        
        // Process items while we have idle time and items in queue
        while (
          this.precomputeQueue.length > 0 && 
          processed < BATCH_SIZE &&
          (!deadline || deadline.timeRemaining() > 20) // Need at least 20ms
        ) {
          const item = this.precomputeQueue.shift();
          
          try {
            const result = await this.generateAndCache(
              item.staff,
              item.date,
              item.dateIndex,
              item.periodData,
              item.allHistoricalData,
              item.staffMembers
            );
            
            if (result.success) {
              this.stats.background_precomputed++;
              processed++;
              
              if (processed % 10 === 0) {
                console.log(`📊 Background precomputed ${this.stats.background_precomputed} features (${this.precomputeQueue.length} remaining)`);
              }
            }
          } catch (error) {
            console.warn("⚠️ Background precomputation error:", error.message);
          }
        }

        // Continue processing if there are more items
        if (this.precomputeQueue.length > 0 && !this.precomputeController?.signal.aborted) {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(processNextBatch, { timeout: 30000 });
          } else {
            setTimeout(() => processNextBatch({}), 100);
          }
        } else {
          // Precomputation complete
          this.isPrecomputing = false;
          console.log(`✅ Background precomputation completed - ${this.stats.background_precomputed} features cached`);
          this.logPerformanceStats();
        }
        
      } catch (error) {
        console.error("❌ Background precomputation error:", error);
        this.isPrecomputing = false;
      }
    };

    // Start the precomputation process
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processNextBatch, { timeout: 30000 });
    } else {
      setTimeout(() => processNextBatch({}), 100);
    }
  }

  /**
   * Stop background precomputation
   */
  stopBackgroundPrecomputation() {
    if (this.precomputeController) {
      this.precomputeController.abort();
      this.precomputeController = null;
    }
    this.precomputeQueue = [];
    this.isPrecomputing = false;
    console.log("🛑 Background precomputation stopped");
  }

  /**
   * Get cache performance statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;

    const avgGenerationTime = this.stats.generation_times.length > 0
      ? (this.stats.generation_times.reduce((sum, time) => sum + time, 0) / this.stats.generation_times.length).toFixed(1)
      : 0;

    return {
      cache_size: this.stats.cache_size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hit_rate: `${hitRate}%`,
      invalidations: this.stats.invalidations,
      background_precomputed: this.stats.background_precomputed,
      avg_generation_time: `${avgGenerationTime}ms`,
      config_hash: this.configHash,
      session_id: this.metadata.session_id,
      uptime: Date.now() - this.metadata.created,
      is_precomputing: this.isPrecomputing,
      queue_size: this.precomputeQueue.length
    };
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats() {
    const stats = this.getStats();
    console.log("📊 Feature Cache Performance Stats:", {
      "Cache Size": stats.cache_size,
      "Hit Rate": stats.hit_rate,
      "Background Precomputed": stats.background_precomputed,
      "Avg Generation Time": stats.avg_generation_time,
      "Session Uptime": `${Math.round(stats.uptime / 1000)}s`
    });
  }

  /**
   * Clear cache (manual reset)
   */
  clear() {
    console.log(`🗑️ Manually clearing feature cache (${this.cache.size} entries)`);
    this.cache.clear();
    this.stopBackgroundPrecomputation();
    this.stats.cache_size = 0;
    this.stats.invalidations++;
  }

  /**
   * Get cache health information
   */
  getHealth() {
    const stats = this.getStats();
    const hitRate = parseFloat(stats.hit_rate);
    
    let health = "excellent";
    let issues = [];

    if (hitRate < 20) {
      health = "poor";
      issues.push("Low cache hit rate");
    } else if (hitRate < 50) {
      health = "fair";
      issues.push("Moderate cache hit rate");
    } else if (hitRate < 80) {
      health = "good";
    }

    if (stats.cache_size === 0) {
      health = "initializing";
      issues.push("Cache is empty");
    }

    if (this.stats.generation_times.length > 0) {
      const avgTime = this.stats.generation_times.reduce((sum, time) => sum + time, 0) / this.stats.generation_times.length;
      if (avgTime > 100) {
        issues.push("Slow feature generation");
        if (health === "excellent") health = "good";
      }
    }

    return {
      status: health,
      issues,
      stats,
      ready_for_predictions: stats.cache_size > 0
    };
  }

  /**
   * Dispose and cleanup resources
   */
  dispose() {
    console.log("🧹 Disposing FeatureCacheManager...");
    
    this.stopBackgroundPrecomputation();
    this.clear();
    
    // Reset all state
    this.featureEngineer = null;
    this.stats = null;
    this.metadata = null;
    
    console.log("✅ FeatureCacheManager disposed");
  }
}

// Export singleton instance
export const featureCacheManager = new FeatureCacheManager();
export { FeatureCacheManager };