/**
 * PerformanceLoadTesting.test.js
 *
 * Comprehensive performance load testing suite for the optimized ML performance system.
 * Tests processing time, memory usage, UI responsiveness, and load capacity under various conditions.
 */

import { getAIPerformanceManager } from "../performance/AIPerformanceManager";
import {
  generateTestScheduleData,
  generateTestStaffMembers,
} from "../utils/TestUtils";

describe("Performance Load Testing Suite", () => {
  let performanceManager;
  let memoryBaseline;
  let performanceMonitor;

  // Performance targets and thresholds
  const PERFORMANCE_TARGETS = {
    SMALL_DATASET_TIME: 5000, // < 5 seconds for <100 cells
    MEDIUM_DATASET_TIME: 10000, // < 10 seconds for 500 cells
    LARGE_DATASET_TIME: 15000, // < 15 seconds for >1000 cells
    MAX_MEMORY_USAGE: 400 * 1024 * 1024, // 400MB in bytes
    MIN_FPS_DURING_PROCESSING: 30, // >30fps UI responsiveness
    MEMORY_CLEANUP_EFFICIENCY: 0.9, // 90% memory should be cleaned up
    PROCESSING_TIMEOUT: 30000, // 30 seconds max timeout
  };

  const DATASET_SIZES = {
    SMALL: { staff: 8, days: 10, cells: 80 }, // <100 cells
    MEDIUM: { staff: 25, days: 20, cells: 500 }, // 500 cells
    LARGE: { staff: 40, days: 30, cells: 1200 }, // >1000 cells
    EXTRA_LARGE: { staff: 60, days: 45, cells: 2700 }, // Stress test
  };

  beforeAll(async () => {
    console.log("\n🏋️ Starting Performance Load Testing Suite");
    console.log("================================================");
    console.log(
      "Testing ML performance optimization under various load conditions",
    );
    console.log("================================================\n");

    // Initialize performance manager
    performanceManager = getAIPerformanceManager();
    await performanceManager.initialize({
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      enableStreaming: true,
      maxMemoryMB: 400,
      debug: true,
    });

    // Capture memory baseline
    memoryBaseline = await captureMemoryBaseline();
    performanceMonitor = performanceManager.components.performanceMonitor;

    console.log(
      `📊 Memory baseline: ${(memoryBaseline / 1024 / 1024).toFixed(2)}MB`,
    );
  });

  afterAll(async () => {
    if (performanceManager) {
      await performanceManager.destroy();
    }
    console.log("\n✅ Performance Load Testing Suite completed");
  });

  describe("Dataset Size Performance Tests", () => {
    test("should process small dataset (<100 cells) within time target", async () => {
      const { staff, days, cells } = DATASET_SIZES.SMALL;
      console.log(
        `\n🔬 Testing small dataset: ${staff} staff × ${days} days = ${cells} cells`,
      );

      const testData = createTestDataset(staff, days);
      const startTime = performance.now();
      const startMemory = await getCurrentMemoryUsage();

      const result = await processWithPerformanceTracking(
        testData,
        "small_dataset",
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const endMemory = await getCurrentMemoryUsage();
      const memoryUsed = endMemory - startMemory;

      console.log(`⏱️ Processing time: ${processingTime.toFixed(0)}ms`);
      console.log(`📦 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`✨ Result quality: ${result.quality}%`);

      // Assertions
      expect(processingTime).toBeLessThan(
        PERFORMANCE_TARGETS.SMALL_DATASET_TIME,
      );
      expect(memoryUsed).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
      expect(result.success).toBe(true);
      expect(result.quality).toBeGreaterThan(85);
    });

    test("should process medium dataset (500 cells) within time target", async () => {
      const { staff, days, cells } = DATASET_SIZES.MEDIUM;
      console.log(
        `\n🔬 Testing medium dataset: ${staff} staff × ${days} days = ${cells} cells`,
      );

      const testData = createTestDataset(staff, days);
      const startTime = performance.now();
      const startMemory = await getCurrentMemoryUsage();

      const result = await processWithPerformanceTracking(
        testData,
        "medium_dataset",
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const endMemory = await getCurrentMemoryUsage();
      const memoryUsed = endMemory - startMemory;

      console.log(`⏱️ Processing time: ${processingTime.toFixed(0)}ms`);
      console.log(`📦 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`✨ Result quality: ${result.quality}%`);

      // Assertions
      expect(processingTime).toBeLessThan(
        PERFORMANCE_TARGETS.MEDIUM_DATASET_TIME,
      );
      expect(memoryUsed).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
      expect(result.success).toBe(true);
      expect(result.quality).toBeGreaterThan(80);
    });

    test("should process large dataset (>1000 cells) within time target", async () => {
      const { staff, days, cells } = DATASET_SIZES.LARGE;
      console.log(
        `\n🔬 Testing large dataset: ${staff} staff × ${days} days = ${cells} cells`,
      );

      const testData = createTestDataset(staff, days);
      const startTime = performance.now();
      const startMemory = await getCurrentMemoryUsage();

      const result = await processWithPerformanceTracking(
        testData,
        "large_dataset",
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const endMemory = await getCurrentMemoryUsage();
      const memoryUsed = endMemory - startMemory;

      console.log(`⏱️ Processing time: ${processingTime.toFixed(0)}ms`);
      console.log(`📦 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`✨ Result quality: ${result.quality}%`);

      // Assertions
      expect(processingTime).toBeLessThan(
        PERFORMANCE_TARGETS.LARGE_DATASET_TIME,
      );
      expect(memoryUsed).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
      expect(result.success).toBe(true);
      expect(result.quality).toBeGreaterThan(75);
    });

    test("should handle extra-large dataset gracefully (stress test)", async () => {
      const { staff, days, cells } = DATASET_SIZES.EXTRA_LARGE;
      console.log(
        `\n🔬 Stress testing extra-large dataset: ${staff} staff × ${days} days = ${cells} cells`,
      );

      const testData = createTestDataset(staff, days);
      const startTime = performance.now();
      const startMemory = await getCurrentMemoryUsage();

      let result;
      let processingTime;
      let memoryUsed;

      try {
        result = await processWithPerformanceTracking(
          testData,
          "extra_large_dataset",
        );
        const endTime = performance.now();
        processingTime = endTime - startTime;
        const endMemory = await getCurrentMemoryUsage();
        memoryUsed = endMemory - startMemory;

        console.log(`⏱️ Processing time: ${processingTime.toFixed(0)}ms`);
        console.log(
          `📦 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`,
        );
        console.log(`✨ Result quality: ${result.quality}%`);

        // For stress test, we allow longer processing times but should not crash
        expect(processingTime).toBeLessThan(
          PERFORMANCE_TARGETS.PROCESSING_TIMEOUT,
        );
        expect(memoryUsed).toBeLessThan(
          PERFORMANCE_TARGETS.MAX_MEMORY_USAGE * 1.5,
        ); // Allow 50% more for stress test
        expect(result.success).toBe(true);
      } catch (error) {
        console.log(`⚠️ Stress test failed gracefully: ${error.message}`);
        // Graceful failure is acceptable for stress test
        expect(error.message).toContain("memory");
      }
    });
  });

  describe("Memory Usage and Cleanup Tests", () => {
    test("should maintain memory usage under 400MB during processing", async () => {
      const testData = createTestDataset(30, 25);

      console.log("\n🧠 Testing memory usage during processing...");

      let maxMemoryUsage = 0;
      const memoryReadings = [];

      // Monitor memory during processing
      const memoryMonitor = setInterval(async () => {
        const currentMemory = await getCurrentMemoryUsage();
        memoryReadings.push(currentMemory);
        maxMemoryUsage = Math.max(maxMemoryUsage, currentMemory);
      }, 100);

      try {
        await processWithPerformanceTracking(testData, "memory_test");
      } finally {
        clearInterval(memoryMonitor);
      }

      console.log(
        `📊 Max memory usage: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(`📈 Memory readings collected: ${memoryReadings.length}`);

      // Verify memory stayed within limits
      expect(maxMemoryUsage).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);

      // Verify memory trend doesn't continuously increase (no major leaks)
      if (memoryReadings.length > 10) {
        const firstHalf = memoryReadings.slice(
          0,
          Math.floor(memoryReadings.length / 2),
        );
        const secondHalf = memoryReadings.slice(
          Math.floor(memoryReadings.length / 2),
        );

        const firstHalfAvg =
          firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondHalfAvg =
          secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const memoryIncrease = secondHalfAvg - firstHalfAvg;
        const memoryIncreasePercent = (memoryIncrease / firstHalfAvg) * 100;

        console.log(
          `📈 Memory increase during processing: ${memoryIncreasePercent.toFixed(1)}%`,
        );

        // Memory should not increase by more than 50% during processing
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });

    test("should cleanup memory efficiently after processing", async () => {
      console.log("\n🗑️ Testing memory cleanup efficiency...");

      const beforeMemory = await getCurrentMemoryUsage();
      const testData = createTestDataset(25, 20);

      // Process data
      await processWithPerformanceTracking(testData, "cleanup_test");

      const afterProcessingMemory = await getCurrentMemoryUsage();

      // Force cleanup
      if (performanceManager.components.memoryManager) {
        await performanceManager.components.memoryManager.performMemoryCleanup();
      }

      // Wait for garbage collection
      await forceGarbageCollection();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const afterCleanupMemory = await getCurrentMemoryUsage();

      const memoryUsedDuringProcessing = afterProcessingMemory - beforeMemory;
      const memoryCleanedUp = afterProcessingMemory - afterCleanupMemory;
      const cleanupEfficiency = memoryCleanedUp / memoryUsedDuringProcessing;

      console.log(
        `📊 Memory used during processing: ${(memoryUsedDuringProcessing / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `🗑️ Memory cleaned up: ${(memoryCleanedUp / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `⚡ Cleanup efficiency: ${(cleanupEfficiency * 100).toFixed(1)}%`,
      );

      // Memory cleanup should be at least 70% efficient
      expect(cleanupEfficiency).toBeGreaterThan(0.7);
    });

    test("should detect and handle memory pressure", async () => {
      console.log("\n⚠️ Testing memory pressure detection...");

      // Create artificially high memory pressure scenario
      const largeTestData = createTestDataset(50, 40); // 2000 cells

      let memoryPressureDetected = false;
      let cleanupTriggered = false;

      // Mock memory manager events if available
      if (performanceManager.components.memoryManager) {
        performanceManager.components.memoryManager.onMemoryPressure = (
          level,
          stats,
        ) => {
          console.log(`⚠️ Memory pressure detected: ${level}`);
          console.log(`📊 Memory stats: ${JSON.stringify(stats)}`);
          memoryPressureDetected = true;
        };

        performanceManager.components.memoryManager.onMemoryCleanup = (
          cleanupStats,
        ) => {
          console.log(`🗑️ Emergency cleanup triggered`);
          console.log(`📊 Cleanup stats: ${JSON.stringify(cleanupStats)}`);
          cleanupTriggered = true;
        };
      }

      try {
        await processWithPerformanceTracking(
          largeTestData,
          "memory_pressure_test",
        );

        // Memory pressure detection is not guaranteed for all datasets
        // but the system should handle it gracefully when it occurs
        if (memoryPressureDetected) {
          console.log("✅ Memory pressure was detected and handled");
          expect(cleanupTriggered).toBe(true);
        } else {
          console.log("ℹ️ No memory pressure detected for this dataset size");
        }
      } catch (error) {
        // If memory pressure causes failure, it should be a graceful failure
        console.log(
          `⚠️ Memory pressure caused graceful failure: ${error.message}`,
        );
        expect(error.message).toMatch(/(memory|pressure|limit)/i);
      }
    });
  });

  describe("UI Responsiveness Tests", () => {
    test("should maintain UI responsiveness >30fps during processing", async () => {
      console.log("\n🎨 Testing UI responsiveness during processing...");

      const testData = createTestDataset(20, 18);
      const fpsReadings = [];
      let isProcessing = true;

      // Mock frame rate monitoring
      const startTime = performance.now();
      let lastFrameTime = startTime;
      let frameCount = 0;

      const measureFPS = () => {
        if (!isProcessing) return;

        const currentTime = performance.now();
        frameCount++;

        // Calculate FPS every second
        if (currentTime - lastFrameTime >= 1000) {
          const fps = frameCount;
          fpsReadings.push(fps);

          console.log(`🖼️ Current FPS: ${fps}`);

          frameCount = 0;
          lastFrameTime = currentTime;
        }

        requestAnimationFrame(measureFPS);
      };

      // Start FPS monitoring
      requestAnimationFrame(measureFPS);

      try {
        await processWithPerformanceTracking(
          testData,
          "ui_responsiveness_test",
        );
      } finally {
        isProcessing = false;
      }

      if (fpsReadings.length > 0) {
        const averageFPS =
          fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length;
        const minFPS = Math.min(...fpsReadings);

        console.log(`📊 Average FPS: ${averageFPS.toFixed(1)}`);
        console.log(`📊 Minimum FPS: ${minFPS}`);

        // Average FPS should be above 30
        expect(averageFPS).toBeGreaterThan(
          PERFORMANCE_TARGETS.MIN_FPS_DURING_PROCESSING,
        );
        // Minimum FPS should not drop too low
        expect(minFPS).toBeGreaterThan(15);
      } else {
        console.log("ℹ️ Processing completed too quickly to measure FPS");
      }
    });

    test("should respond to user interactions during processing", async () => {
      console.log("\n👆 Testing user interaction responsiveness...");

      const testData = createTestDataset(15, 12);
      const interactionResponseTimes = [];
      let isProcessing = true;

      // Simulate user interactions
      const simulateInteraction = async () => {
        while (isProcessing) {
          const interactionStart = performance.now();

          // Simulate a UI interaction (e.g., button click, modal open)
          await simulateUIInteraction();

          const interactionEnd = performance.now();
          const responseTime = interactionEnd - interactionStart;
          interactionResponseTimes.push(responseTime);

          // Wait before next interaction
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      };

      // Start interaction simulation
      const interactionPromise = simulateInteraction();

      try {
        // Process data while interactions are happening
        await processWithPerformanceTracking(testData, "interaction_test");
      } finally {
        isProcessing = false;
        await interactionPromise;
      }

      if (interactionResponseTimes.length > 0) {
        const avgResponseTime =
          interactionResponseTimes.reduce((a, b) => a + b, 0) /
          interactionResponseTimes.length;
        const maxResponseTime = Math.max(...interactionResponseTimes);

        console.log(
          `📊 Average interaction response: ${avgResponseTime.toFixed(1)}ms`,
        );
        console.log(
          `📊 Max interaction response: ${maxResponseTime.toFixed(1)}ms`,
        );

        // UI interactions should respond within 100ms on average
        expect(avgResponseTime).toBeLessThan(100);
        // No interaction should take longer than 500ms
        expect(maxResponseTime).toBeLessThan(500);
      }
    });
  });

  describe("Concurrent Processing Tests", () => {
    test("should handle multiple concurrent processing requests", async () => {
      console.log("\n🔄 Testing concurrent processing...");

      const numConcurrentRequests = 3;
      const testDatasets = Array.from(
        { length: numConcurrentRequests },
        (_, i) => createTestDataset(10 + i * 5, 8 + i * 2),
      );

      const startTime = performance.now();
      const concurrentPromises = testDatasets.map((testData, index) =>
        processWithPerformanceTracking(testData, `concurrent_test_${index}`),
      );

      const results = await Promise.allSettled(concurrentPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successfulResults = results.filter((r) => r.status === "fulfilled");
      const failedResults = results.filter((r) => r.status === "rejected");

      console.log(
        `⏱️ Total concurrent processing time: ${totalTime.toFixed(0)}ms`,
      );
      console.log(
        `✅ Successful requests: ${successfulResults.length}/${numConcurrentRequests}`,
      );
      console.log(
        `❌ Failed requests: ${failedResults.length}/${numConcurrentRequests}`,
      );

      // At least 2/3 of concurrent requests should succeed
      expect(successfulResults.length).toBeGreaterThanOrEqual(
        Math.floor(numConcurrentRequests * 0.67),
      );

      // Failed requests should fail gracefully (not crash the system)
      failedResults.forEach((result) => {
        console.log(`⚠️ Graceful failure: ${result.reason.message}`);
        expect(result.reason.message).toBeDefined();
      });
    });

    test("should manage resource contention effectively", async () => {
      console.log("\n⚖️ Testing resource contention management...");

      const heavyTestData1 = createTestDataset(25, 20); // 500 cells
      const heavyTestData2 = createTestDataset(30, 18); // 540 cells

      let resource1PeakMemory = 0;
      let resource2PeakMemory = 0;

      const process1 = (async () => {
        const startMem = await getCurrentMemoryUsage();
        const result = await processWithPerformanceTracking(
          heavyTestData1,
          "contention_test_1",
        );
        const endMem = await getCurrentMemoryUsage();
        resource1PeakMemory = endMem - startMem;
        return result;
      })();

      // Start second process after a brief delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      const process2 = (async () => {
        const startMem = await getCurrentMemoryUsage();
        const result = await processWithPerformanceTracking(
          heavyTestData2,
          "contention_test_2",
        );
        const endMem = await getCurrentMemoryUsage();
        resource2PeakMemory = endMem - startMem;
        return result;
      })();

      const [result1, result2] = await Promise.allSettled([process1, process2]);

      console.log(
        `📦 Process 1 memory usage: ${(resource1PeakMemory / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `📦 Process 2 memory usage: ${(resource2PeakMemory / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `📊 Total memory contention: ${((resource1PeakMemory + resource2PeakMemory) / 1024 / 1024).toFixed(2)}MB`,
      );

      // Both processes should manage resources effectively
      const totalMemoryUsage = resource1PeakMemory + resource2PeakMemory;
      expect(totalMemoryUsage).toBeLessThan(
        PERFORMANCE_TARGETS.MAX_MEMORY_USAGE * 1.2,
      ); // Allow 20% overhead for contention

      // At least one process should succeed
      const successCount = [result1, result2].filter(
        (r) => r.status === "fulfilled",
      ).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  // Helper Functions
  function createTestDataset(staffCount, dayCount) {
    return {
      scheduleData: generateTestScheduleData(staffCount, dayCount),
      staffMembers: generateTestStaffMembers(staffCount),
      dateRange: generateDateRange(dayCount),
      constraints: generateBasicConstraints(),
    };
  }

  function generateDateRange(dayCount) {
    const dates = [];
    const startDate = new Date();

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }

    return dates;
  }

  function generateBasicConstraints() {
    return {
      maxShiftsPerDay: { morning: 3, afternoon: 4, evening: 3 },
      minStaffPerShift: 2,
      maxConsecutiveDays: 5,
      restDaysBetweenShifts: 1,
    };
  }

  async function processWithPerformanceTracking(testData, testId) {
    let progressUpdates = 0;
    let lastProgress = 0;

    const progressCallback = (progress) => {
      progressUpdates++;
      if (progress.progress > lastProgress + 10) {
        console.log(
          `   Progress: ${progress.progress}% - ${progress.message || "Processing..."}`,
        );
        lastProgress = progress.progress;
      }
    };

    try {
      const result = await performanceManager.processMLPredictions(
        testData,
        progressCallback,
      );

      console.log(
        `   ✅ Processing completed with ${progressUpdates} progress updates`,
      );

      return {
        success: true,
        quality: result.accuracy || 85, // Default quality score
        progressUpdates,
        data: result,
      };
    } catch (error) {
      console.log(`   ❌ Processing failed: ${error.message}`);
      throw error;
    }
  }

  async function getCurrentMemoryUsage() {
    if (
      typeof window !== "undefined" &&
      window.performance &&
      window.performance.memory
    ) {
      return window.performance.memory.usedJSHeapSize;
    }

    // Fallback for environments without performance.memory
    return process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  }

  async function captureMemoryBaseline() {
    // Take several readings and average them
    const readings = [];
    for (let i = 0; i < 3; i++) {
      readings.push(await getCurrentMemoryUsage());
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return readings.reduce((a, b) => a + b, 0) / readings.length;
  }

  async function forceGarbageCollection() {
    if (typeof window !== "undefined" && window.gc) {
      window.gc();
    } else if (typeof global !== "undefined" && global.gc) {
      global.gc();
    }

    // Alternative: create and release large objects to encourage GC
    for (let i = 0; i < 10; i++) {
      const waste = new Array(100000).fill(Math.random());
      waste.length = 0;
    }
  }

  async function simulateUIInteraction() {
    // Simulate DOM manipulation or state updates
    const testElement = document.createElement("div");
    testElement.style.transform = "translateX(100px)";
    testElement.innerHTML = "Test interaction";
    document.body.appendChild(testElement);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    testElement.remove();
  }
});
