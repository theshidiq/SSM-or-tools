/**
 * Phase2_PerformanceValidation.test.js
 *
 * Tests to validate Phase 2 Feature Cache System achieves performance goals:
 * - Cache features by staff + date combination in memory
 * - Cache invalidation on configuration changes
 * - Near-instant predictions (<100ms total, <10ms from cache)
 * - Background precomputation functionality
 */

import {
  featureCacheManager,
  FeatureCacheManager,
} from "../cache/FeatureCacheManager.js";

// Mock dependencies
jest.mock("../ml/EnhancedFeatureEngineering.js", () => {
  return {
    EnhancedFeatureEngineering: jest.fn().mockImplementation(() => ({
      generateFeatures: jest.fn(() => {
        // Simulate feature generation time
        const delay = Math.random() * 50; // 0-50ms simulation
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              Array(42)
                .fill(0)
                .map(() => Math.random()),
            );
          }, delay);
        });
      }),
    })),
  };
});

describe("Phase 2: Feature Cache Performance Validation", () => {
  let cacheManager;
  let mockStaff;
  let mockDate;

  beforeEach(() => {
    // Create fresh cache manager for each test
    cacheManager = new FeatureCacheManager();

    // Mock data
    mockStaff = [
      { id: "staff-1", name: "料理長", status: "社員", department: "キッチン" },
      { id: "staff-2", name: "与儀", status: "パート", department: "ホール" },
    ];

    mockDate = new Date("2024-01-15");
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.dispose();
    }
  });

  describe("Cache Initialization and Basic Functionality", () => {
    test("should initialize cache manager successfully", () => {
      expect(cacheManager).toBeDefined();
      expect(cacheManager.cache).toBeDefined();
      expect(cacheManager.stats.hits).toBe(0);
      expect(cacheManager.stats.misses).toBe(0);
    });

    test("should generate unique session ID", () => {
      const cache1 = new FeatureCacheManager();
      const cache2 = new FeatureCacheManager();

      expect(cache1.metadata.session_id).toBeDefined();
      expect(cache2.metadata.session_id).toBeDefined();
      expect(cache1.metadata.session_id).not.toBe(cache2.metadata.session_id);

      cache1.dispose();
      cache2.dispose();
    });

    test("should generate consistent configuration hashes", () => {
      const mockSchedule = { "staff-1": {}, "staff-2": {} };

      const hash1 = cacheManager.generateConfigHash(mockStaff, mockSchedule);
      const hash2 = cacheManager.generateConfigHash(mockStaff, mockSchedule);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe("string");
    });
  });

  describe("Configuration Change Detection and Cache Invalidation", () => {
    test("should invalidate cache when staff configuration changes", () => {
      const mockSchedule = { "staff-1": {}, "staff-2": {} };

      // Set initial configuration
      cacheManager.invalidateOnConfigChange(mockStaff, mockSchedule);

      // Add some cache entries
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);
      expect(cacheManager.cache.size).toBe(1);

      // Change staff configuration
      const modifiedStaff = [
        ...mockStaff,
        { id: "staff-3", name: "新人", status: "パート" },
      ];
      const invalidated = cacheManager.invalidateOnConfigChange(
        modifiedStaff,
        mockSchedule,
      );

      expect(invalidated).toBe(true);
      expect(cacheManager.cache.size).toBe(0);
      expect(cacheManager.stats.invalidations).toBe(1);
    });

    test("should not invalidate cache when configuration is unchanged", () => {
      const mockSchedule = { "staff-1": {}, "staff-2": {} };

      // Set initial configuration
      cacheManager.invalidateOnConfigChange(mockStaff, mockSchedule);

      // Add cache entry
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);
      expect(cacheManager.cache.size).toBe(1);

      // Same configuration
      const invalidated = cacheManager.invalidateOnConfigChange(
        mockStaff,
        mockSchedule,
      );

      expect(invalidated).toBe(false);
      expect(cacheManager.cache.size).toBe(1); // Cache preserved
      expect(cacheManager.stats.invalidations).toBe(0);
    });

    test("should detect schedule data changes", () => {
      const schedule1 = { "staff-1": {}, "staff-2": {} };
      const schedule2 = { "staff-1": { "2024-01-15": "○" }, "staff-2": {} };

      cacheManager.invalidateOnConfigChange(mockStaff, schedule1);
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);

      const invalidated = cacheManager.invalidateOnConfigChange(
        mockStaff,
        schedule2,
      );

      expect(invalidated).toBe(true);
      expect(cacheManager.cache.size).toBe(0);
    });
  });

  describe("Feature Caching Performance", () => {
    test("should achieve <10ms cache hit performance", async () => {
      const dateKey = "2024-01-15";
      const testFeatures = Array(42)
        .fill(0)
        .map(() => Math.random());

      // Pre-cache features
      cacheManager.setFeatures("staff-1", dateKey, testFeatures);

      // Measure cache hit performance
      const startTime = Date.now();
      const result = cacheManager.getFeatures("staff-1", dateKey);
      const cacheHitTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.features).toEqual(testFeatures);
      expect(cacheHitTime).toBeLessThan(10); // <10ms requirement
    });

    test("should track cache statistics correctly", async () => {
      const dateKey = "2024-01-15";
      const testFeatures = Array(42)
        .fill(0)
        .map(() => Math.random());

      // Cache miss
      let result = cacheManager.getFeatures("staff-1", dateKey);
      expect(result.success).toBe(false);
      expect(cacheManager.stats.misses).toBe(1);
      expect(cacheManager.stats.hits).toBe(0);

      // Set and hit
      cacheManager.setFeatures("staff-1", dateKey, testFeatures);
      result = cacheManager.getFeatures("staff-1", dateKey);

      expect(result.success).toBe(true);
      expect(cacheManager.stats.hits).toBe(1);
      expect(cacheManager.stats.misses).toBe(1);

      const stats = cacheManager.getStats();
      expect(stats.hit_rate).toBe("50.0%");
      expect(stats.cache_size).toBe(1);
    });

    test("should validate features before caching", () => {
      const dateKey = "2024-01-15";

      // Valid features
      const validFeatures = Array(42)
        .fill(0)
        .map(() => Math.random());
      expect(cacheManager.setFeatures("staff-1", dateKey, validFeatures)).toBe(
        true,
      );

      // Invalid features - not array
      expect(cacheManager.setFeatures("staff-2", dateKey, "not-array")).toBe(
        false,
      );

      // Invalid features - contains NaN
      const invalidFeatures = [1, 2, NaN, 4, 5];
      expect(
        cacheManager.setFeatures("staff-3", dateKey, invalidFeatures),
      ).toBe(false);

      // Invalid features - contains Infinity
      const infiniteFeatures = [1, 2, Infinity, 4, 5];
      expect(
        cacheManager.setFeatures("staff-4", dateKey, infiniteFeatures),
      ).toBe(false);
    });
  });

  describe("Feature Generation with Caching", () => {
    test("should generate and cache features efficiently", async () => {
      const mockPeriodData = { schedule: {}, dateRange: [mockDate] };
      const mockHistoricalData = {};

      const startTime = Date.now();
      const result = await cacheManager.generateAndCache(
        mockStaff[0],
        mockDate,
        0,
        mockPeriodData,
        mockHistoricalData,
        mockStaff,
      );
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.features).toBeDefined();
      expect(Array.isArray(result.features)).toBe(true);
      expect(totalTime).toBeLessThan(100); // Should be fast

      // Verify it's cached
      const dateKey = mockDate.toISOString().split("T")[0];
      const cachedResult = cacheManager.getFeatures(mockStaff[0].id, dateKey);
      expect(cachedResult.success).toBe(true);
      expect(cachedResult.features).toEqual(result.features);
    });

    test("should handle feature generation errors gracefully", async () => {
      // Mock feature engineer to throw error
      cacheManager.featureEngineer.generateFeatures = jest.fn(() => {
        throw new Error("Feature generation failed");
      });

      const result = await cacheManager.generateAndCache(
        mockStaff[0],
        mockDate,
        0,
        {},
        {},
        mockStaff,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.generation_time).toBeGreaterThan(0);
    });
  });

  describe("Background Precomputation", () => {
    test("should set up background precomputation queue", async () => {
      const dateRange = [
        new Date("2024-01-15"),
        new Date("2024-01-16"),
        new Date("2024-01-17"),
      ];
      const mockPeriodData = { schedule: {}, dateRange };
      const mockHistoricalData = {};

      // Start background precomputation
      const precomputePromise = cacheManager.startBackgroundPrecomputation(
        mockStaff,
        dateRange,
        mockPeriodData,
        mockHistoricalData,
      );

      expect(cacheManager.isPrecomputing).toBe(true);
      expect(cacheManager.precomputeQueue.length).toBeGreaterThan(0);

      // Stop background computation for test cleanup
      cacheManager.stopBackgroundPrecomputation();
      expect(cacheManager.isPrecomputing).toBe(false);
      expect(cacheManager.precomputeQueue.length).toBe(0);
    });

    test("should not start multiple background computations", async () => {
      const dateRange = [new Date("2024-01-15")];
      const mockPeriodData = { schedule: {}, dateRange };

      cacheManager.startBackgroundPrecomputation(
        mockStaff,
        dateRange,
        mockPeriodData,
        {},
      );
      expect(cacheManager.isPrecomputing).toBe(true);

      // Try to start again
      cacheManager.startBackgroundPrecomputation(
        mockStaff,
        dateRange,
        mockPeriodData,
        {},
      );
      // Should still be true, not duplicated
      expect(cacheManager.isPrecomputing).toBe(true);

      cacheManager.stopBackgroundPrecomputation();
    });

    test("should skip precomputation for already cached features", async () => {
      const dateRange = [new Date("2024-01-15")];
      const dateKey = "2024-01-15";

      // Pre-cache some features
      cacheManager.setFeatures(mockStaff[0].id, dateKey, [1, 2, 3, 4, 5]);

      cacheManager.startBackgroundPrecomputation(
        mockStaff,
        dateRange,
        { schedule: {}, dateRange },
        {},
      );

      // Should have fewer items in queue (skipping cached ones)
      const expectedQueueSize = mockStaff.length * dateRange.length - 1; // minus 1 cached
      expect(cacheManager.precomputeQueue.length).toBe(expectedQueueSize);

      cacheManager.stopBackgroundPrecomputation();
    });
  });

  describe("Cache Health and Management", () => {
    test("should provide cache health status", () => {
      // Empty cache
      let health = cacheManager.getHealth();
      expect(health.status).toBe("initializing");
      expect(health.ready_for_predictions).toBe(false);

      // Add some cached features
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);
      cacheManager.stats.hits = 8;
      cacheManager.stats.misses = 2;

      health = cacheManager.getHealth();
      expect(health.status).toBe("excellent"); // 80% hit rate
      expect(health.ready_for_predictions).toBe(true);
    });

    test("should clear cache manually", () => {
      // Add some entries
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);
      cacheManager.setFeatures("staff-2", "2024-01-16", [6, 7, 8, 9, 10]);
      expect(cacheManager.cache.size).toBe(2);

      // Clear cache
      cacheManager.clear();
      expect(cacheManager.cache.size).toBe(0);
      expect(cacheManager.stats.invalidations).toBe(1);
    });

    test("should dispose resources cleanly", () => {
      cacheManager.setFeatures("staff-1", "2024-01-15", [1, 2, 3, 4, 5]);
      cacheManager.startBackgroundPrecomputation(mockStaff, [mockDate], {}, {});

      expect(cacheManager.cache.size).toBe(1);
      expect(cacheManager.isPrecomputing).toBe(true);

      cacheManager.dispose();

      // Should clean up everything
      expect(cacheManager.featureEngineer).toBeNull();
      expect(cacheManager.stats).toBeNull();
      expect(cacheManager.metadata).toBeNull();
    });
  });

  describe("Phase 2 Performance Goals Validation", () => {
    test("should achieve overall <100ms prediction target with cache integration", async () => {
      const dateRange = [new Date("2024-01-15"), new Date("2024-01-16")];
      const mockPeriodData = { schedule: {}, dateRange };

      // First run - cache miss (will take longer)
      const startTime1 = Date.now();
      await cacheManager.generateAndCache(
        mockStaff[0],
        dateRange[0],
        0,
        mockPeriodData,
        {},
        mockStaff,
      );
      const firstRunTime = Date.now() - startTime1;

      console.log(`First run (cache miss): ${firstRunTime}ms`);

      // Second run - cache hit (should be much faster)
      const startTime2 = Date.now();
      const dateKey = dateRange[0].toISOString().split("T")[0];
      const cachedResult = cacheManager.getFeatures(mockStaff[0].id, dateKey);
      const secondRunTime = Date.now() - startTime2;

      console.log(`Second run (cache hit): ${secondRunTime}ms`);

      expect(cachedResult.success).toBe(true);
      expect(secondRunTime).toBeLessThan(10); // Phase 2 goal: <10ms from cache
      expect(firstRunTime).toBeLessThan(100); // Overall goal: <100ms total
    });

    test("should maintain performance with multiple staff and dates", async () => {
      const dateRange = Array.from(
        { length: 5 },
        (_, i) => new Date(`2024-01-${15 + i}`),
      );
      const mockPeriodData = { schedule: {}, dateRange };

      // Pre-cache all combinations
      const precomputeStart = Date.now();

      for (const staff of mockStaff) {
        for (let i = 0; i < dateRange.length; i++) {
          await cacheManager.generateAndCache(
            staff,
            dateRange[i],
            i,
            mockPeriodData,
            {},
            mockStaff,
          );
        }
      }

      const precomputeTime = Date.now() - precomputeStart;
      console.log(
        `Precompute ${mockStaff.length * dateRange.length} entries: ${precomputeTime}ms`,
      );

      // Now test cache hit performance
      const cacheHitStart = Date.now();

      for (const staff of mockStaff) {
        for (const date of dateRange) {
          const dateKey = date.toISOString().split("T")[0];
          const result = cacheManager.getFeatures(staff.id, dateKey);
          expect(result.success).toBe(true);
        }
      }

      const cacheHitTime = Date.now() - cacheHitStart;
      const avgCacheHitTime =
        cacheHitTime / (mockStaff.length * dateRange.length);

      console.log(
        `${mockStaff.length * dateRange.length} cache hits: ${cacheHitTime}ms (avg: ${avgCacheHitTime.toFixed(1)}ms per hit)`,
      );

      expect(avgCacheHitTime).toBeLessThan(10); // Each cache hit <10ms
      expect(cacheHitTime).toBeLessThan(100); // Total batch <100ms

      const stats = cacheManager.getStats();
      expect(stats.hit_rate).toBe("100.0%");
    });
  });
});

describe("Integration with Singleton Cache Manager", () => {
  test("should use singleton cache manager correctly", () => {
    expect(featureCacheManager).toBeDefined();
    expect(featureCacheManager instanceof FeatureCacheManager).toBe(true);

    const stats1 = featureCacheManager.getStats();
    const stats2 = featureCacheManager.getStats();

    // Same instance
    expect(stats1.session_id).toBe(stats2.session_id);
  });

  test("should handle concurrent access safely", async () => {
    const dateKey = "2024-01-15";
    const features1 = [1, 2, 3, 4, 5];
    const features2 = [6, 7, 8, 9, 10];

    // Set features concurrently
    featureCacheManager.setFeatures("staff-1", dateKey, features1);
    featureCacheManager.setFeatures("staff-2", dateKey, features2);

    // Get features concurrently
    const result1 = featureCacheManager.getFeatures("staff-1", dateKey);
    const result2 = featureCacheManager.getFeatures("staff-2", dateKey);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.features).toEqual(features1);
    expect(result2.features).toEqual(features2);
  });
});
