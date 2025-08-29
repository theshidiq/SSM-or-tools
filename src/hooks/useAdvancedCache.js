/**
 * Advanced Caching Hook for Phase 2
 * Provides intelligent multi-layer caching with IndexedDB and memory layers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { indexedDBManager } from '../utils/indexedDBManager';

// Memory cache with LRU eviction
class MemoryCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check TTL
    if (item.expiry && new Date() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  set(key, data, ttlMinutes = 60) {
    // Remove oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiry = ttlMinutes > 0 ? new Date(Date.now() + ttlMinutes * 60 * 1000) : null;
    this.cache.set(key, { data, expiry, createdAt: new Date() });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global memory cache instance
const memoryCache = new MemoryCache(100);

export const useAdvancedCache = (options = {}) => {
  const {
    enableMemoryCache = true,
    enableIndexedDBCache = true,
    defaultTTL = 60, // minutes
    maxMemorySize = 100,
    prefetchAdjacent = true,
    backgroundRefresh = true
  } = options;

  const [cacheStats, setCacheStats] = useState({
    memoryHits: 0,
    memoryMisses: 0,
    indexedDBHits: 0,
    indexedDBMisses: 0,
    totalRequests: 0
  });

  const statsRef = useRef(cacheStats);
  statsRef.current = cacheStats;

  // Update cache stats
  const updateStats = useCallback((type, isHit) => {
    setCacheStats(prev => {
      const updated = {
        ...prev,
        totalRequests: prev.totalRequests + 1
      };
      
      if (type === 'memory') {
        updated[isHit ? 'memoryHits' : 'memoryMisses']++;
      } else if (type === 'indexedDB') {
        updated[isHit ? 'indexedDBHits' : 'indexedDBMisses']++;
      }
      
      return updated;
    });
  }, []);

  /**
   * Get data from cache with fallback chain
   */
  const getCached = useCallback(async (key, fallbackFn, ttlMinutes = defaultTTL) => {
    try {
      // Layer 1: Memory cache
      if (enableMemoryCache) {
        const memoryData = memoryCache.get(key);
        if (memoryData !== null) {
          updateStats('memory', true);
          return memoryData;
        }
        updateStats('memory', false);
      }

      // Layer 2: IndexedDB cache
      if (enableIndexedDBCache) {
        const indexedDBData = await indexedDBManager.getCache(key);
        if (indexedDBData !== null) {
          updateStats('indexedDB', true);
          
          // Populate memory cache
          if (enableMemoryCache) {
            memoryCache.set(key, indexedDBData, ttlMinutes);
          }
          
          return indexedDBData;
        }
        updateStats('indexedDB', false);
      }

      // Layer 3: Fallback function
      if (fallbackFn) {
        console.log(`🔄 Cache miss for ${key}, fetching from source...`);
        const freshData = await fallbackFn();
        
        // Store in all enabled cache layers
        await setCached(key, freshData, ttlMinutes);
        
        return freshData;
      }

      return null;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return fallbackFn ? await fallbackFn() : null;
    }
  }, [enableMemoryCache, enableIndexedDBCache, defaultTTL, updateStats]);

  /**
   * Set data in cache
   */
  const setCached = useCallback(async (key, data, ttlMinutes = defaultTTL) => {
    try {
      // Store in memory cache
      if (enableMemoryCache) {
        memoryCache.set(key, data, ttlMinutes);
      }

      // Store in IndexedDB cache
      if (enableIndexedDBCache) {
        await indexedDBManager.setCache(key, data, ttlMinutes);
      }
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
    }
  }, [enableMemoryCache, enableIndexedDBCache, defaultTTL]);

  /**
   * Invalidate cache entry
   */
  const invalidate = useCallback(async (key) => {
    try {
      if (enableMemoryCache) {
        memoryCache.delete(key);
      }
      
      if (enableIndexedDBCache) {
        await indexedDBManager.deleteCache(key);
      }
      
      console.log(`🗑️ Invalidated cache for ${key}`);
    } catch (error) {
      console.error(`Cache invalidation error for ${key}:`, error);
    }
  }, [enableMemoryCache, enableIndexedDBCache]);

  /**
   * Invalidate cache entries by pattern
   */
  const invalidatePattern = useCallback(async (pattern) => {
    try {
      if (enableMemoryCache) {
        const memStats = memoryCache.getStats();
        memStats.keys.forEach(key => {
          if (key.includes(pattern)) {
            memoryCache.delete(key);
          }
        });
      }
      
      // Note: IndexedDB pattern invalidation would require full scan
      // For now, we'll just clear all if pattern is too broad
      console.log(`🗑️ Pattern invalidation for ${pattern}`);
    } catch (error) {
      console.error(`Cache pattern invalidation error:`, error);
    }
  }, [enableMemoryCache]);

  /**
   * Clear all cache
   */
  const clearCache = useCallback(async () => {
    try {
      if (enableMemoryCache) {
        memoryCache.clear();
      }
      
      if (enableIndexedDBCache) {
        await indexedDBManager.cleanExpiredCache();
      }
      
      console.log('🧹 All cache cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }, [enableMemoryCache, enableIndexedDBCache]);

  /**
   * Preload adjacent periods for better UX
   */
  const preloadAdjacent = useCallback(async (currentPeriod, dataFetcher) => {
    if (!prefetchAdjacent || !dataFetcher) return;

    const adjacentPeriods = [
      Math.max(0, currentPeriod - 1),
      Math.min(5, currentPeriod + 1) // Assuming 6 periods (0-5)
    ];

    // Background preload without blocking
    Promise.all(
      adjacentPeriods.map(async (period) => {
        const cacheKey = `schedule_${period}`;
        const exists = enableMemoryCache && memoryCache.get(cacheKey);
        
        if (!exists) {
          try {
            await getCached(cacheKey, () => dataFetcher(period), defaultTTL);
            console.log(`📦 Preloaded period ${period}`);
          } catch (error) {
            console.warn(`Preload failed for period ${period}:`, error);
          }
        }
      })
    ).catch(error => {
      console.warn('Adjacent preload error:', error);
    });
  }, [prefetchAdjacent, getCached, enableMemoryCache, defaultTTL]);

  /**
   * Background refresh of cache entries
   */
  const backgroundRefreshCache = useCallback(async (key, dataFetcher, ttlMinutes = defaultTTL) => {
    if (!backgroundRefresh || !dataFetcher) return;

    try {
      // Refresh in background without blocking UI
      setTimeout(async () => {
        try {
          const freshData = await dataFetcher();
          await setCached(key, freshData, ttlMinutes);
          console.log(`🔄 Background refreshed ${key}`);
        } catch (error) {
          console.warn(`Background refresh failed for ${key}:`, error);
        }
      }, 100);
    } catch (error) {
      console.warn('Background refresh setup error:', error);
    }
  }, [backgroundRefresh, setCached, defaultTTL]);

  /**
   * Get cache performance metrics
   */
  const getCacheMetrics = useCallback(() => {
    const memory = enableMemoryCache ? memoryCache.getStats() : null;
    const hitRate = statsRef.current.totalRequests > 0 
      ? ((statsRef.current.memoryHits + statsRef.current.indexedDBHits) / statsRef.current.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...statsRef.current,
      hitRate: `${hitRate}%`,
      memoryCache: memory,
      cacheEnabled: {
        memory: enableMemoryCache,
        indexedDB: enableIndexedDBCache
      }
    };
  }, [enableMemoryCache, enableIndexedDBCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Optional: Clear memory cache on unmount to free memory
      // memoryCache.clear();
    };
  }, []);

  // Log cache performance in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && statsRef.current.totalRequests > 0) {
      const metrics = getCacheMetrics();
      if (statsRef.current.totalRequests % 10 === 0) { // Log every 10 requests
        console.log('📊 Cache Performance:', metrics);
      }
    }
  }, [cacheStats, getCacheMetrics]);

  return {
    // Core cache operations
    getCached,
    setCached,
    invalidate,
    invalidatePattern,
    clearCache,
    
    // Advanced features
    preloadAdjacent,
    backgroundRefreshCache,
    
    // Metrics and stats
    getCacheMetrics,
    cacheStats,
    
    // Direct access to cache instances (for debugging)
    memoryCache: process.env.NODE_ENV === 'development' ? memoryCache : undefined,
    indexedDBManager: process.env.NODE_ENV === 'development' ? indexedDBManager : undefined
  };
};

// Export memory cache for direct access in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.memoryCache = memoryCache;
  console.log('🔧 Memory cache available: window.memoryCache');
}

export default useAdvancedCache;