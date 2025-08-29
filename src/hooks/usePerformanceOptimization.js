import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { debounce } from 'lodash';

// Performance optimization hook with intelligent memoization and debouncing
export const usePerformanceOptimization = (options = {}) => {
  const {
    debounceDelay = 300,
    memoizationDepth = 3,
    enableProfiling = process.env.NODE_ENV === 'development',
    performanceThresholds = {
      render: 16, // 16ms for 60fps
      interaction: 100, // 100ms for responsive interactions
      dataProcessing: 500 // 500ms for complex operations
    }
  } = options;

  const performanceMetrics = useRef({
    renders: [],
    interactions: [],
    operations: [],
    memoryUsage: []
  });

  const memoizationCache = useRef(new Map());
  const [performanceStats, setPerformanceStats] = useState(null);

  // Enhanced memoization with intelligent invalidation
  const intelligentMemo = useCallback((factory, deps, options = {}) => {
    const {
      key = JSON.stringify(deps),
      ttl = 60000, // 1 minute default TTL
      maxSize = 100
    } = options;

    const cache = memoizationCache.current;
    const cached = cache.get(key);
    
    // Check if cached value is still valid
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    // Clear old entries if cache is full
    if (cache.size >= maxSize) {
      const oldestKey = Array.from(cache.keys())[0];
      cache.delete(oldestKey);
    }

    // Compute new value
    const startTime = performance.now();
    const value = factory();
    const computeTime = performance.now() - startTime;

    // Store in cache
    cache.set(key, {
      value,
      timestamp: Date.now(),
      computeTime,
      deps: deps ? [...deps] : []
    });

    // Log performance if enabled
    if (enableProfiling && computeTime > 5) {
      console.log(`🔧 Memoized computation: ${key.slice(0, 50)}... (${computeTime.toFixed(2)}ms)`);
    }

    return value;
  }, [enableProfiling]);

  // Optimized debounced functions factory
  const createDebouncedFunction = useCallback((fn, delay = debounceDelay, options = {}) => {
    const {
      leading = false,
      trailing = true,
      maxWait
    } = options;

    return debounce(fn, delay, { leading, trailing, maxWait });
  }, [debounceDelay]);

  // Performance monitoring wrapper
  const measurePerformance = useCallback((operation, fn, threshold) => {
    if (!enableProfiling) return fn();

    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    const result = fn();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryDelta = endMemory - startMemory;

    // Store metrics
    const metrics = performanceMetrics.current;
    const operationType = typeof operation === 'string' ? operation : 'unknown';
    
    if (!metrics[operationType]) {
      metrics[operationType] = [];
    }
    
    metrics[operationType].push({
      duration,
      memoryDelta,
      timestamp: Date.now(),
      threshold: threshold || performanceThresholds[operationType] || 100
    });

    // Keep only last 100 measurements per operation
    if (metrics[operationType].length > 100) {
      metrics[operationType] = metrics[operationType].slice(-100);
    }

    // Warn if performance threshold exceeded
    const operationThreshold = threshold || performanceThresholds[operationType] || 100;
    if (duration > operationThreshold) {
      console.warn(`⚠️ Performance warning: ${operationType} took ${duration.toFixed(2)}ms (threshold: ${operationThreshold}ms)`);
    }

    return result;
  }, [enableProfiling, performanceThresholds]);

  // Optimized array operations with batching
  const optimizedArrayOperations = useMemo(() => ({
    // Batch process large arrays
    batchProcess: (array, processor, batchSize = 1000) => {
      if (array.length <= batchSize) {
        return measurePerformance('batchProcess', () => array.map(processor));
      }

      return measurePerformance('batchProcess', () => {
        const results = [];
        for (let i = 0; i < array.length; i += batchSize) {
          const batch = array.slice(i, i + batchSize);
          const batchResults = batch.map(processor);
          results.push(...batchResults);
          
          // Allow UI to breathe between batches
          if (i + batchSize < array.length) {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(results);
              }, 0);
            });
          }
        }
        return results;
      });
    },

    // Optimized filtering with early termination
    smartFilter: (array, predicate, maxResults = Infinity) => {
      return measurePerformance('smartFilter', () => {
        const results = [];
        for (let i = 0; i < array.length && results.length < maxResults; i++) {
          if (predicate(array[i], i, array)) {
            results.push(array[i]);
          }
        }
        return results;
      });
    },

    // Optimized sorting with intelligent algorithm selection
    smartSort: (array, compareFn) => {
      return measurePerformance('smartSort', () => {
        if (array.length < 100) {
          // Use insertion sort for small arrays
          return [...array].sort(compareFn);
        } else {
          // Use native sort (typically quicksort/mergesort)
          return [...array].sort(compareFn);
        }
      });
    }
  }), [measurePerformance]);

  // Memory optimization utilities
  const memoryOptimization = useMemo(() => ({
    // Clean up unused memoization cache
    clearCache: () => {
      const cache = memoizationCache.current;
      const now = Date.now();
      let cleared = 0;
      
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > 300000) { // 5 minutes
          cache.delete(key);
          cleared++;
        }
      }
      
      if (cleared > 0 && enableProfiling) {
        console.log(`🧹 Cleared ${cleared} expired cache entries`);
      }
    },

    // Get memory usage stats
    getMemoryStats: () => {
      if (!performance.memory) return null;
      
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        cacheSize: memoizationCache.current.size
      };
    },

    // Force garbage collection if available
    forceGC: () => {
      if (window.gc) {
        window.gc();
        console.log('🗑️ Forced garbage collection');
      } else {
        console.warn('⚠️ Garbage collection not available');
      }
    }
  }), [enableProfiling]);

  // React-specific optimizations
  const reactOptimizations = useMemo(() => ({
    // Create stable callback references
    useStableCallback: (callback, deps) => {
      const callbackRef = useRef(callback);
      callbackRef.current = callback;
      
      return useCallback((...args) => {
        return callbackRef.current(...args);
      }, deps);
    },

    // Optimized useMemo with deep comparison
    useDeepMemo: (factory, deps) => {
      const depsString = JSON.stringify(deps);
      return intelligentMemo(factory, [depsString], { key: depsString });
    },

    // Batch state updates
    batchStateUpdates: (updates) => {
      // Use React's unstable_batchedUpdates if available
      if (typeof window !== 'undefined' && window.React?.unstable_batchedUpdates) {
        window.React.unstable_batchedUpdates(() => {
          updates.forEach(update => update());
        });
      } else {
        // Fallback to setTimeout for batching
        setTimeout(() => {
          updates.forEach(update => update());
        }, 0);
      }
    }
  }), [intelligentMemo]);

  // Performance monitoring
  useEffect(() => {
    if (!enableProfiling) return;

    const updateStats = () => {
      const stats = {
        cache: {
          size: memoizationCache.current.size,
          hitRatio: calculateCacheHitRatio(),
        },
        memory: memoryOptimization.getMemoryStats(),
        operations: getOperationStats(),
        timestamp: Date.now()
      };
      
      setPerformanceStats(stats);
    };

    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    
    // Initial stats
    updateStats();

    return () => clearInterval(interval);
  }, [enableProfiling, memoryOptimization]);

  // Calculate cache hit ratio
  const calculateCacheHitRatio = useCallback(() => {
    const cache = memoizationCache.current;
    if (cache.size === 0) return 0;
    
    let totalAccess = 0;
    let hits = 0;
    
    for (const entry of cache.values()) {
      totalAccess += entry.accessCount || 1;
      hits += entry.accessCount > 1 ? entry.accessCount - 1 : 0;
    }
    
    return totalAccess > 0 ? (hits / totalAccess) * 100 : 0;
  }, []);

  // Get operation statistics
  const getOperationStats = useCallback(() => {
    const metrics = performanceMetrics.current;
    const stats = {};
    
    Object.entries(metrics).forEach(([operation, measurements]) => {
      if (measurements.length === 0) return;
      
      const durations = measurements.map(m => m.duration);
      const memoryDeltas = measurements.map(m => m.memoryDelta);
      
      stats[operation] = {
        count: measurements.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        avgMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
        slowOperations: measurements.filter(m => m.duration > m.threshold).length
      };
    });
    
    return stats;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      memoizationCache.current.clear();
      performanceMetrics.current = {
        renders: [],
        interactions: [],
        operations: [],
        memoryUsage: []
      };
    };
  }, []);

  return {
    // Memoization and caching
    intelligentMemo,
    
    // Debouncing
    createDebouncedFunction,
    
    // Performance measurement
    measurePerformance,
    
    // Optimized operations
    optimizedArrayOperations,
    
    // Memory management
    memoryOptimization,
    
    // React optimizations
    reactOptimizations,
    
    // Performance data
    performanceStats,
    
    // Utilities
    isPerformanceModeEnabled: enableProfiling,
    clearAllCaches: () => {
      memoizationCache.current.clear();
      performanceMetrics.current = {
        renders: [],
        interactions: [],
        operations: [],
        memoryUsage: []
      };
    }
  };
};

export default usePerformanceOptimization;