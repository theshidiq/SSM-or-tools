/**
 * Performance Benchmark Test for Optimized Feature Generation
 *
 * Verifies that feature generation meets the <50ms per prediction target
 */

import { EnhancedFeatureEngineering } from "../ml/EnhancedFeatureEngineering.js";
import { optimizedFeatureManager } from "../../workers/OptimizedFeatureManager.js";

describe("Optimized Feature Generation Performance", () => {
  let enhancedEngineer;
  let mockStaffMembers;
  let mockPeriodData;
  let mockAllHistoricalData;
  let testDates;

  beforeAll(async () => {
    enhancedEngineer = new EnhancedFeatureEngineering();

    // Setup test data
    mockStaffMembers = [
      {
        id: "staff1",
        name: "田中太郎",
        status: "社員",
        position: "サーバー",
      },
      {
        id: "staff2",
        name: "佐藤花子",
        status: "パート",
        position: "キッチン",
      },
      {
        id: "staff3",
        name: "山田次郎",
        status: "社員",
        position: "マネージャー",
      },
    ];

    // Mock period data with realistic schedule
    mockPeriodData = {
      schedule: {
        staff1: {
          "2024-01-01": "○",
          "2024-01-02": "△",
          "2024-01-03": "×",
          "2024-01-04": "○",
          "2024-01-05": "▽",
        },
        staff2: {
          "2024-01-01": "▽",
          "2024-01-02": "×",
          "2024-01-03": "○",
          "2024-01-04": "×",
          "2024-01-05": "○",
        },
        staff3: {
          "2024-01-01": "○",
          "2024-01-02": "○",
          "2024-01-03": "○",
          "2024-01-04": "△",
          "2024-01-05": "×",
        },
      },
      dateRange: [
        new Date("2024-01-01"),
        new Date("2024-01-02"),
        new Date("2024-01-03"),
        new Date("2024-01-04"),
        new Date("2024-01-05"),
      ],
    };

    mockAllHistoricalData = {
      0: mockPeriodData,
      1: mockPeriodData, // Duplicate for historical data
    };

    testDates = [
      new Date("2024-01-06"),
      new Date("2024-01-07"),
      new Date("2024-01-08"),
    ];

    // Initialize optimized worker
    await optimizedFeatureManager.initialize();
  });

  afterAll(async () => {
    // Cleanup
    optimizedFeatureManager.destroy();
  });

  describe("Single Prediction Performance", () => {
    test("should generate features in <50ms per prediction (optimized)", async () => {
      const staff = mockStaffMembers[0];
      const date = testDates[0];

      const startTime = performance.now();

      const features = await enhancedEngineer.generateEnhancedFeaturesOptimized(
        {
          staff,
          date,
          dateIndex: 5,
          periodData: mockPeriodData,
          allHistoricalData: mockAllHistoricalData,
          staffMembers: mockStaffMembers,
        },
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(
        `🎯 Optimized feature generation time: ${executionTime.toFixed(1)}ms`,
      );

      // Verify performance target
      expect(executionTime).toBeLessThan(50);

      // Verify feature quality
      expect(features).toBeDefined();
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBe(65); // Enhanced feature count
    });

    test("should maintain consistent performance across multiple predictions", async () => {
      const measurements = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const staff = mockStaffMembers[i % mockStaffMembers.length];
        const date = new Date("2024-01-10");
        date.setDate(date.getDate() + i);

        const startTime = performance.now();

        await enhancedEngineer.generateEnhancedFeaturesOptimized({
          staff,
          date,
          dateIndex: 10 + i,
          periodData: mockPeriodData,
          allHistoricalData: mockAllHistoricalData,
          staffMembers: mockStaffMembers,
        });

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);

      console.log(`📊 Performance stats over ${iterations} predictions:`);
      console.log(`  Average: ${avgTime.toFixed(1)}ms`);
      console.log(`  Min: ${minTime.toFixed(1)}ms`);
      console.log(`  Max: ${maxTime.toFixed(1)}ms`);
      console.log(
        `  Under 50ms: ${measurements.filter((t) => t < 50).length}/${iterations}`,
      );

      // Verify performance targets
      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100); // Allow some variance but not too much

      // At least 90% should be under 50ms
      const under50msCount = measurements.filter((t) => t < 50).length;
      expect(under50msCount / iterations).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("Batch Processing Performance", () => {
    test("should process batch predictions efficiently", async () => {
      // Create a realistic batch of predictions
      const batchRequests = [];

      for (
        let staffIndex = 0;
        staffIndex < mockStaffMembers.length;
        staffIndex++
      ) {
        for (let dateIndex = 0; dateIndex < testDates.length; dateIndex++) {
          batchRequests.push({
            staff: mockStaffMembers[staffIndex],
            date: testDates[dateIndex],
            dateIndex: 6 + dateIndex,
            periodData: mockPeriodData,
            allHistoricalData: mockAllHistoricalData,
            staffMembers: mockStaffMembers,
          });
        }
      }

      console.log(
        `🔄 Testing batch processing with ${batchRequests.length} predictions`,
      );

      const startTime = performance.now();
      let progressUpdates = 0;

      const results = await enhancedEngineer.generateFeaturesBatch(
        batchRequests,
        (progress) => {
          progressUpdates++;
          console.log(`  Progress: ${progress.percentage}%`);
        },
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerPrediction = totalTime / batchRequests.length;

      console.log(`⚡ Batch processing results:`);
      console.log(`  Total time: ${totalTime.toFixed(1)}ms`);
      console.log(
        `  Average per prediction: ${avgTimePerPrediction.toFixed(1)}ms`,
      );
      console.log(`  Progress updates: ${progressUpdates}`);

      // Verify batch processing is efficient
      expect(avgTimePerPrediction).toBeLessThan(50);
      expect(results).toBeDefined();
      expect(results.length).toBe(batchRequests.length);
      expect(progressUpdates).toBeGreaterThan(0); // Should have progress updates

      // Verify all results are valid
      results.forEach((features, index) => {
        expect(features).toBeDefined();
        expect(Array.isArray(features)).toBe(true);
        expect(features.length).toBe(65);
      });
    });
  });

  describe("Memory and Resource Management", () => {
    test("should manage memory efficiently during extended processing", async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Simulate extended processing
      for (let batch = 0; batch < 5; batch++) {
        const batchRequests = [];

        for (let i = 0; i < 10; i++) {
          batchRequests.push({
            staff: mockStaffMembers[i % mockStaffMembers.length],
            date: new Date(`2024-01-${10 + batch * 10 + i}`),
            dateIndex: 10 + batch * 10 + i,
            periodData: mockPeriodData,
            allHistoricalData: mockAllHistoricalData,
            staffMembers: mockStaffMembers,
          });
        }

        await enhancedEngineer.generateFeaturesBatch(batchRequests);

        // Clear caches periodically
        if (batch % 2 === 0) {
          await enhancedEngineer.clearCaches();
        }
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`💾 Memory usage:`);
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test("should provide accurate cache statistics", async () => {
      // Generate some features to populate caches
      await enhancedEngineer.generateEnhancedFeaturesOptimized({
        staff: mockStaffMembers[0],
        date: testDates[0],
        dateIndex: 5,
        periodData: mockPeriodData,
        allHistoricalData: mockAllHistoricalData,
        staffMembers: mockStaffMembers,
      });

      const cacheStats = enhancedEngineer.getCacheStats();

      console.log("📈 Cache statistics:", cacheStats);

      expect(cacheStats).toBeDefined();
      expect(typeof cacheStats.totalCached).toBe("number");

      if (cacheStats.optimizedWorker) {
        expect(cacheStats.optimizedWorker.initialized).toBe(true);
        expect(typeof cacheStats.optimizedWorker.totalPredictions).toBe(
          "number",
        );
        expect(typeof cacheStats.optimizedWorker.avgTime).toBe("number");
        expect(cacheStats.optimizedWorker.performanceTarget).toBe(50);
      }
    });
  });

  describe("Fallback and Error Handling", () => {
    test("should fallback gracefully when optimized worker fails", async () => {
      // Temporarily disable optimized worker
      const originalUseOptimizedWorker = enhancedEngineer.useOptimizedWorker;
      enhancedEngineer.useOptimizedWorker = false;

      const startTime = performance.now();

      const features = await enhancedEngineer.generateEnhancedFeaturesOptimized(
        {
          staff: mockStaffMembers[0],
          date: testDates[0],
          dateIndex: 5,
          periodData: mockPeriodData,
          allHistoricalData: mockAllHistoricalData,
          staffMembers: mockStaffMembers,
        },
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Restore original setting
      enhancedEngineer.useOptimizedWorker = originalUseOptimizedWorker;

      console.log(`🔄 Fallback execution time: ${executionTime.toFixed(1)}ms`);

      // Should still work, but might be slower
      expect(features).toBeDefined();
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBe(65);
    });
  });
});

describe("Performance Regression Tests", () => {
  test("should maintain performance when processing realistic schedule sizes", async () => {
    // Test with more realistic data sizes
    const largeStaffList = [];
    for (let i = 0; i < 20; i++) {
      largeStaffList.push({
        id: `staff${i}`,
        name: `スタッフ${i}`,
        status: i % 3 === 0 ? "社員" : "パート",
        position: i % 4 === 0 ? "マネージャー" : "スタッフ",
      });
    }

    const largeDateRange = [];
    for (let i = 0; i < 60; i++) {
      // 2 months
      const date = new Date("2024-01-01");
      date.setDate(date.getDate() + i);
      largeDateRange.push(date);
    }

    const enhancedEngineer = new EnhancedFeatureEngineering();
    await optimizedFeatureManager.initialize();

    const batchRequests = [];

    // Create a realistic batch (20 staff × 10 predictions = 200 predictions)
    for (
      let staffIndex = 0;
      staffIndex < Math.min(20, largeStaffList.length);
      staffIndex++
    ) {
      for (let dateIndex = 0; dateIndex < 10; dateIndex++) {
        batchRequests.push({
          staff: largeStaffList[staffIndex],
          date: largeDateRange[dateIndex],
          dateIndex,
          periodData: { schedule: {}, dateRange: largeDateRange.slice(0, 30) },
          allHistoricalData: {},
          staffMembers: largeStaffList,
        });
      }
    }

    console.log(
      `🏢 Testing with realistic scale: ${batchRequests.length} predictions`,
    );

    const startTime = performance.now();

    const results = await enhancedEngineer.generateFeaturesBatch(
      batchRequests,
      (progress) => {
        if (progress.completed % 50 === 0) {
          console.log(`  Realistic scale progress: ${progress.percentage}%`);
        }
      },
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerPrediction = totalTime / batchRequests.length;

    console.log(`🎯 Realistic scale results:`);
    console.log(`  Total predictions: ${batchRequests.length}`);
    console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(
      `  Average per prediction: ${avgTimePerPrediction.toFixed(1)}ms`,
    );

    // Performance targets for realistic scale
    expect(avgTimePerPrediction).toBeLessThan(50);
    expect(results.length).toBe(batchRequests.length);

    // Log final performance stats
    optimizedFeatureManager.logPerformanceSummary();
  });
});
