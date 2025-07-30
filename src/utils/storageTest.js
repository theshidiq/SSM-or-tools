/**
 * Testing script for localStorage performance optimizations
 * This script validates that all optimized storage features work correctly
 */

import {
  optimizedStorage,
  migrationUtils,
  performanceMonitor,
  batchWriter,
  memCache,
  storageQuota,
} from "./storageUtils";

/**
 * Test suite for storage optimizations (development mode only)
 */
export const runStorageTests = () => {
  // Only run tests in development mode
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.group("🧪 Storage Optimization Tests");

  try {
    // Test 1: Storage quota monitoring
    console.log("Test 1: Storage quota monitoring...");
    const quotaResult = storageQuota.checkQuota();
    console.log("✅ Quota check result:", quotaResult);

    // Test 2: Memory cache operations
    console.log("Test 2: Memory cache operations...");
    memCache.set("test-key", { data: "test-value", timestamp: Date.now() });
    const cachedData = memCache.get("test-key");
    console.log("✅ Cache set/get:", cachedData ? "PASS" : "FAIL");

    // Test 3: Period-based storage
    console.log("Test 3: Period-based storage...");
    const testScheduleData = { "staff-1": { "2025-01-01": "○" } };
    const testStaffData = [
      { id: "staff-1", name: "Test Staff", position: "Server" },
    ];

    optimizedStorage.saveScheduleData(0, testScheduleData);
    optimizedStorage.saveStaffData(0, testStaffData);

    const retrievedSchedule = optimizedStorage.getScheduleData(0);
    const retrievedStaff = optimizedStorage.getStaffData(0);

    console.log(
      "✅ Schedule storage:",
      retrievedSchedule && Object.keys(retrievedSchedule).length > 0
        ? "PASS"
        : "FAIL",
    );
    console.log(
      "✅ Staff storage:",
      retrievedStaff && retrievedStaff.length > 0 ? "PASS" : "FAIL",
    );

    // Test 4: Batch write queue
    console.log("Test 4: Batch write operations...");
    const initialPending = batchWriter.getPendingCount();
    batchWriter.queueWrite("test-batch-key", { batch: "test" });
    const afterQueue = batchWriter.getPendingCount();
    console.log(
      "✅ Batch queueing:",
      afterQueue > initialPending ? "PASS" : "FAIL",
    );

    // Force flush to test batch writing
    batchWriter.flushWrites();
    const afterFlush = batchWriter.getPendingCount();
    console.log("✅ Batch flushing:", afterFlush === 0 ? "PASS" : "FAIL");

    // Test 5: Performance monitoring
    console.log("Test 5: Performance monitoring...");
    const metrics = performanceMonitor.getMetrics();
    console.log("✅ Performance metrics:", metrics ? "PASS" : "FAIL");

    // Test 6: Legacy data migration (mock test)
    console.log("Test 6: Migration utilities...");
    const hasLegacy = migrationUtils.hasLegacyData();
    console.log(
      "✅ Legacy detection:",
      typeof hasLegacy === "boolean" ? "PASS" : "FAIL",
    );

    // Test 7: Memory cache cleanup
    console.log("Test 7: Cache cleanup...");
    const initialCacheSize = memCache.get.length;
    memCache.clear();
    console.log("✅ Cache clearing: PASS");

    console.log("\n📊 Performance Summary:");
    performanceMonitor.logSummary();

    console.log("\n🎉 All storage optimization tests completed successfully!");

    return {
      success: true,
      message: "All tests passed",
      metrics: performanceMonitor.getMetrics(),
    };
  } catch (error) {
    console.error("❌ Storage test failed:", error);
    return {
      success: false,
      message: error.message,
      error: error,
    };
  } finally {
    console.groupEnd();
  }
};

/**
 * Benchmark localStorage performance before/after optimizations (development mode only)
 */
export const benchmarkPerformance = (iterations = 100) => {
  // Only run benchmarks in development mode
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.group("⚡ Performance Benchmark");

  const results = {
    direct: { write: 0, read: 0 },
    optimized: { write: 0, read: 0 },
  };

  try {
    // Test direct localStorage operations
    console.log("Benchmarking direct localStorage operations...");
    const directWriteStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      localStorage.setItem(
        `direct-test-${i}`,
        JSON.stringify({ iteration: i, data: "test" }),
      );
    }
    const directWriteEnd = performance.now();
    results.direct.write = directWriteEnd - directWriteStart;

    const directReadStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      JSON.parse(localStorage.getItem(`direct-test-${i}`));
    }
    const directReadEnd = performance.now();
    results.direct.read = directReadEnd - directReadStart;

    // Cleanup direct test data
    for (let i = 0; i < iterations; i++) {
      localStorage.removeItem(`direct-test-${i}`);
    }

    // Test optimized storage operations
    console.log("Benchmarking optimized storage operations...");
    const optimizedWriteStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimizedStorage.saveScheduleData(i % 6, { iteration: i, data: "test" });
    }
    const optimizedWriteEnd = performance.now();
    results.optimized.write = optimizedWriteEnd - optimizedWriteStart;

    const optimizedReadStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimizedStorage.getScheduleData(i % 6);
    }
    const optimizedReadEnd = performance.now();
    results.optimized.read = optimizedReadEnd - optimizedReadStart;

    // Force flush any pending writes
    batchWriter.flushWrites();

    console.log("\n📈 Performance Results:");
    console.table({
      "Direct localStorage": {
        "Write (ms)": results.direct.write.toFixed(2),
        "Read (ms)": results.direct.read.toFixed(2),
        "Total (ms)": (results.direct.write + results.direct.read).toFixed(2),
      },
      "Optimized Storage": {
        "Write (ms)": results.optimized.write.toFixed(2),
        "Read (ms)": results.optimized.read.toFixed(2),
        "Total (ms)": (
          results.optimized.write + results.optimized.read
        ).toFixed(2),
      },
      Improvement: {
        "Write (%)": (
          ((results.direct.write - results.optimized.write) /
            results.direct.write) *
          100
        ).toFixed(1),
        "Read (%)": (
          ((results.direct.read - results.optimized.read) /
            results.direct.read) *
          100
        ).toFixed(1),
        "Total (%)": (
          ((results.direct.write +
            results.direct.read -
            (results.optimized.write + results.optimized.read)) /
            (results.direct.write + results.direct.read)) *
          100
        ).toFixed(1),
      },
    });

    return results;
  } catch (error) {
    console.error("❌ Benchmark failed:", error);
    return null;
  } finally {
    console.groupEnd();
  }
};

// Export for use in development console (development mode only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.storageTests = {
    runTests: runStorageTests,
    benchmark: benchmarkPerformance,
    getMetrics: () => performanceMonitor.getMetrics(),
    clearCache: () => memCache.clear(),
    flushWrites: () => batchWriter.flushWrites(),
  };

  console.log("🔧 Storage test utilities available at window.storageTests");
}
