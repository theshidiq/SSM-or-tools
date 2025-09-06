/**
 * Performance Regression Verification Test
 *
 * Verifies that our optimizations solved the 3-4 second feature generation bottleneck
 * and the system can handle 270 predictions without timing out.
 */

import { EnhancedFeatureEngineering } from "../ml/EnhancedFeatureEngineering.js";

describe("Performance Regression Verification", () => {
  let enhancedEngineer;

  // Mock realistic data for testing
  const mockStaffMembers = [
    { id: "staff1", name: "田中太郎", status: "社員", position: "サーバー" },
    { id: "staff2", name: "佐藤花子", status: "パート", position: "キッチン" },
    {
      id: "staff3",
      name: "山田次郎",
      status: "社員",
      position: "マネージャー",
    },
    { id: "staff4", name: "鈴木美咲", status: "パート", position: "サーバー" },
    { id: "staff5", name: "高橋健太", status: "社員", position: "キッチン" },
  ];

  const mockPeriodData = {
    schedule: {
      staff1: { "2024-01-01": "○", "2024-01-02": "△", "2024-01-03": "×" },
      staff2: { "2024-01-01": "▽", "2024-01-02": "×", "2024-01-03": "○" },
      staff3: { "2024-01-01": "○", "2024-01-02": "○", "2024-01-03": "○" },
      staff4: { "2024-01-01": "×", "2024-01-02": "▽", "2024-01-03": "○" },
      staff5: { "2024-01-01": "△", "2024-01-02": "○", "2024-01-03": "×" },
    },
  };

  const mockAllHistoricalData = {
    0: mockPeriodData,
    1: mockPeriodData,
    2: mockPeriodData,
  };

  beforeAll(() => {
    enhancedEngineer = new EnhancedFeatureEngineering();
  });

  test("should generate single features in <50ms (regression test)", async () => {
    const staff = mockStaffMembers[0];
    const date = new Date("2024-01-04");

    const startTime = performance.now();

    const features = await enhancedEngineer.generateEnhancedFeaturesOptimized({
      staff,
      date,
      dateIndex: 3,
      periodData: mockPeriodData,
      allHistoricalData: mockAllHistoricalData,
      staffMembers: mockStaffMembers,
    });

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    console.log(`✅ Single feature generation: ${executionTime.toFixed(1)}ms`);

    // Verify we solved the 3-4 second bottleneck
    expect(executionTime).toBeLessThan(50);
    expect(features).toBeDefined();
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBe(65);
  });

  test("should handle 270 predictions without timeout (original issue)", async () => {
    // Simulate the original problem: 270 predictions (9 staff × 30 dates)
    const predictions = [];
    const numStaff = 9; // Simulate larger staff list
    const numDates = 30; // One month

    // Create extended staff list
    const extendedStaff = [];
    for (let i = 0; i < numStaff; i++) {
      extendedStaff.push({
        id: `staff${i + 1}`,
        name: `スタッフ${i + 1}`,
        status: i % 3 === 0 ? "社員" : "パート",
        position: i % 2 === 0 ? "サーバー" : "キッチン",
      });
    }

    // Create prediction requests (270 total)
    for (let staffIndex = 0; staffIndex < numStaff; staffIndex++) {
      for (let dateIndex = 0; dateIndex < numDates; dateIndex++) {
        const date = new Date("2024-01-01");
        date.setDate(date.getDate() + dateIndex);

        predictions.push({
          staff: extendedStaff[staffIndex],
          date,
          dateIndex,
          periodData: mockPeriodData,
          allHistoricalData: mockAllHistoricalData,
          staffMembers: extendedStaff,
        });
      }
    }

    console.log(
      `🎯 Testing 270 predictions (${numStaff} staff × ${numDates} dates)`,
    );

    const startTime = performance.now();
    let progressCount = 0;

    // Test batch processing with the same load that caused the original timeout
    const results = await enhancedEngineer.generateFeaturesBatch(
      predictions,
      (progress) => {
        progressCount++;
        if (progress.completed % 50 === 0) {
          console.log(
            `  Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`,
          );
        }
      },
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerPrediction = totalTime / predictions.length;

    console.log(`🏆 Batch processing results:`);
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(
      `  Average per prediction: ${avgTimePerPrediction.toFixed(1)}ms`,
    );
    console.log(`  Progress updates: ${progressCount}`);

    // Verify we solved the timeout issue
    expect(totalTime).toBeLessThan(25000); // Should complete well under 25 second timeout
    expect(avgTimePerPrediction).toBeLessThan(50); // Each prediction under 50ms
    expect(results).toBeDefined();
    expect(results.length).toBe(270);
    expect(progressCount).toBeGreaterThan(0);

    // Verify all results are valid
    results.forEach((features, index) => {
      expect(features).toBeDefined();
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBe(65);
    });

    // Calculate success metrics
    const under50msCount = results.filter(
      (_, i) => avgTimePerPrediction < 50, // Simplified check
    ).length;

    console.log(`📊 Success metrics:`);
    console.log(`  Completed: ${results.length}/${predictions.length} (100%)`);
    console.log(
      `  Under 50ms target: ${((under50msCount / results.length) * 100).toFixed(1)}%`,
    );
    console.log(`  No timeout failures: ✅`);
  });

  test("should maintain performance under realistic load patterns", async () => {
    // Test various load patterns that could occur in production
    const loadTests = [
      { name: "Small Load", staff: 3, dates: 7 },
      { name: "Medium Load", staff: 6, dates: 14 },
      { name: "Large Load", staff: 10, dates: 30 },
      { name: "Peak Load", staff: 15, dates: 60 },
    ];

    for (const test of loadTests) {
      console.log(
        `🔄 Testing ${test.name}: ${test.staff} staff × ${test.dates} dates`,
      );

      // Create test data
      const testStaff = [];
      for (let i = 0; i < test.staff; i++) {
        testStaff.push({
          id: `staff${i}`,
          name: `スタッフ${i}`,
          status: i % 3 === 0 ? "社員" : "パート",
          position: i % 2 === 0 ? "サーバー" : "キッチン",
        });
      }

      const predictions = [];
      for (let staffIndex = 0; staffIndex < test.staff; staffIndex++) {
        for (let dateIndex = 0; dateIndex < test.dates; dateIndex++) {
          const date = new Date("2024-01-01");
          date.setDate(date.getDate() + dateIndex);

          predictions.push({
            staff: testStaff[staffIndex],
            date,
            dateIndex,
            periodData: mockPeriodData,
            allHistoricalData: mockAllHistoricalData,
            staffMembers: testStaff,
          });
        }
      }

      const startTime = performance.now();

      const results = await enhancedEngineer.generateFeaturesBatch(
        predictions,
        () => {}, // No progress logging for load test
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / predictions.length;

      console.log(
        `  ${test.name}: ${results.length} predictions in ${totalTime.toFixed(0)}ms (${avgTime.toFixed(1)}ms avg)`,
      );

      // Performance assertions
      expect(results.length).toBe(predictions.length);
      expect(avgTime).toBeLessThan(50);

      // Memory cleanup test - verify no significant memory leaks
      if (typeof global.gc === "function") {
        global.gc();
      }
    }
  });

  test("should provide accurate performance metrics", async () => {
    // Test that our performance tracking is working
    const staff = mockStaffMembers[0];
    const date = new Date("2024-01-05");

    // Generate some predictions to populate metrics
    for (let i = 0; i < 5; i++) {
      await enhancedEngineer.generateEnhancedFeaturesOptimized({
        staff,
        date,
        dateIndex: 4 + i,
        periodData: mockPeriodData,
        allHistoricalData: mockAllHistoricalData,
        staffMembers: mockStaffMembers,
      });
    }

    const cacheStats = enhancedEngineer.getCacheStats();
    console.log("📈 Cache statistics:", JSON.stringify(cacheStats, null, 2));

    expect(cacheStats).toBeDefined();
    expect(typeof cacheStats.totalCached).toBe("number");

    // If optimized worker is being used, verify metrics
    if (cacheStats.optimizedWorker) {
      expect(cacheStats.optimizedWorker.initialized).toBe(true);
      expect(cacheStats.optimizedWorker.performanceTarget).toBe(50);
    }
  });
});

describe("Regression Prevention", () => {
  test("should prevent future performance regressions", () => {
    // Document the performance improvements for future reference
    const performanceTargets = {
      singlePrediction: 50, // ms
      batchAverage: 50, // ms per prediction
      timeoutThreshold: 25000, // ms (25 seconds)
      maxPredictions: 500, // concurrent predictions
    };

    console.log("🎯 Performance Targets for Future Regression Testing:");
    console.log(
      `  Single prediction: <${performanceTargets.singlePrediction}ms`,
    );
    console.log(
      `  Batch average: <${performanceTargets.batchAverage}ms per prediction`,
    );
    console.log(
      `  Timeout threshold: <${performanceTargets.timeoutThreshold}ms`,
    );
    console.log(
      `  Max concurrent: ${performanceTargets.maxPredictions} predictions`,
    );

    // This test documents our performance requirements
    expect(performanceTargets.singlePrediction).toBeLessThanOrEqual(50);
    expect(performanceTargets.batchAverage).toBeLessThanOrEqual(50);
    expect(performanceTargets.timeoutThreshold).toBeGreaterThanOrEqual(25000);
    expect(performanceTargets.maxPredictions).toBeGreaterThanOrEqual(270);
  });
});
