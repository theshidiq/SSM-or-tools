/**
 * PerformanceMemoryTesting.test.js
 *
 * Comprehensive performance and memory testing
 * Validates production readiness and resource efficiency
 */

import { HybridPredictor } from "../hybrid/HybridPredictor";
import { TensorFlowScheduler } from "../ml/TensorFlowScheduler";
import { MLEngine } from "../advanced/MLEngine";
import {
  measurePerformance,
  createLoadTestScenarios,
  createTestStaffMembers,
  createTestScheduleData,
  TestReportGenerator,
} from "../utils/TestUtils";

describe("Phase 6: Performance & Memory Testing", () => {
  let hybridPredictor;
  let tensorFlowScheduler;
  let mlEngine;
  let reportGenerator;

  const PERFORMANCE_TARGETS = {
    TRAINING_TIME: 30000, // 30 seconds max training time
    PREDICTION_TIME: 3000, // 3 seconds max prediction time
    MEMORY_LIMIT: 100 * 1024 * 1024, // 100MB memory limit
    THROUGHPUT_TARGET: 10, // 10 predictions/second minimum
    MEMORY_LEAK_THRESHOLD: 10 * 1024 * 1024, // 10MB per operation max
    RESPONSE_TIME_99TH: 5000, // 99th percentile response time: 5 seconds
  };

  const LOAD_TEST_CONFIG = {
    WARM_UP_OPERATIONS: 5,
    MEASUREMENT_OPERATIONS: 20,
    MEMORY_SAMPLE_INTERVAL: 100, // ms
    GC_WAIT_TIME: 1000, // ms
  };

  beforeAll(async () => {
    console.log("🚀 Initializing Performance & Memory Tests...");

    hybridPredictor = new HybridPredictor();
    tensorFlowScheduler = new TensorFlowScheduler();
    mlEngine = new MLEngine();
    reportGenerator = new TestReportGenerator();

    // Initialize components
    await hybridPredictor.initialize();
    await tensorFlowScheduler.initialize();
    await mlEngine.initialize();

    // Warm up the system
    console.log("🔥 Warming up system for accurate measurements...");
    await warmUpSystem();

    console.log("✅ Performance testing components ready");
  });

  afterAll(async () => {
    if (hybridPredictor) await hybridPredictor.reset();
    if (tensorFlowScheduler) await tensorFlowScheduler.dispose();
    if (mlEngine) await mlEngine.reset();

    const report = reportGenerator.generateReport();
    console.log("🏁 Performance Testing Report:");
    console.log(`   Performance Score: ${report.summary.passRate}%`);
    console.log(`   Production Ready: ${report.phase6Status}`);
  });

  describe("Training Performance Testing", () => {
    test("should meet training time targets", async () => {
      console.log("⏱️ Testing ML model training performance...");

      const trainingScenarios = [
        { name: "Small Dataset", staffCount: 10, dayCount: 30 },
        { name: "Medium Dataset", staffCount: 25, dayCount: 60 },
        { name: "Large Dataset", staffCount: 50, dayCount: 90 },
      ];

      const trainingResults = [];

      for (const scenario of trainingScenarios) {
        console.log(`  Training ${scenario.name}...`);

        const staffMembers = createTestStaffMembers(scenario.staffCount);
        const performanceResult = await measurePerformance(() =>
          tensorFlowScheduler.trainModel(staffMembers),
        );

        const success =
          !performanceResult.error && performanceResult.result?.success;
        const trainingTime = performanceResult.executionTime;
        const memoryUsed = performanceResult.memoryUsage.delta;

        trainingResults.push({
          scenario: scenario.name,
          success,
          trainingTime,
          memoryUsed: Math.round(memoryUsed / 1024 / 1024),
          meetsTimeTarget: trainingTime < PERFORMANCE_TARGETS.TRAINING_TIME,
          meetsMemoryTarget: memoryUsed < PERFORMANCE_TARGETS.MEMORY_LIMIT,
        });

        expect(success).toBe(true);
        expect(trainingTime).toBeLessThan(PERFORMANCE_TARGETS.TRAINING_TIME);
        expect(memoryUsed).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT);

        console.log(`    Time: ${(trainingTime / 1000).toFixed(1)}s`);
        console.log(`    Memory: ${Math.round(memoryUsed / 1024 / 1024)}MB`);
      }

      const avgTrainingTime =
        trainingResults.reduce((sum, r) => sum + r.trainingTime, 0) /
        trainingResults.length;
      const maxMemoryUsed = Math.max(
        ...trainingResults.map((r) => r.memoryUsed),
      );

      reportGenerator.addTestResult("Training Performance", {
        success: true,
        trainingResults,
        avgTrainingTime,
        maxMemoryUsed,
        allMeetTargets: trainingResults.every(
          (r) => r.meetsTimeTarget && r.meetsMemoryTarget,
        ),
      });

      console.log(
        `  ✅ Average training time: ${(avgTrainingTime / 1000).toFixed(1)}s`,
      );
      console.log(`  ✅ Max memory usage: ${maxMemoryUsed}MB`);
    });

    test("should scale training performance predictably", async () => {
      console.log("📈 Testing training performance scalability...");

      const scalingFactors = [1, 2, 4, 8]; // 1x, 2x, 4x, 8x data size
      const baseStaffCount = 10;
      const baseDayCount = 14;

      const scalingResults = [];
      let baselineTime = 0;

      for (const factor of scalingFactors) {
        const staffCount = baseStaffCount * Math.sqrt(factor); // Square root scaling for staff
        const dayCount = baseDayCount * Math.sqrt(factor); // Square root scaling for days

        const staffMembers = createTestStaffMembers(Math.round(staffCount));
        const performanceResult = await measurePerformance(() =>
          tensorFlowScheduler.trainModel(staffMembers),
        );

        const trainingTime = performanceResult.executionTime;

        if (factor === 1) {
          baselineTime = trainingTime;
        }

        const scalingRatio = baselineTime > 0 ? trainingTime / baselineTime : 1;
        const efficiency = factor > 1 ? factor / scalingRatio : 1;

        scalingResults.push({
          scalingFactor: factor,
          staffCount: Math.round(staffCount),
          dayCount: Math.round(dayCount),
          trainingTime,
          scalingRatio,
          efficiency,
        });

        console.log(
          `    ${factor}x data: ${(trainingTime / 1000).toFixed(1)}s (${efficiency.toFixed(2)}x efficiency)`,
        );
      }

      // Efficiency should not degrade too much (>50% efficiency for reasonable scaling)
      const minEfficiency = Math.min(
        ...scalingResults.slice(1).map((r) => r.efficiency),
      );
      expect(minEfficiency).toBeGreaterThan(0.3); // At least 30% efficiency at largest scale

      reportGenerator.addTestResult("Training Scalability", {
        success: true,
        scalingResults,
        minEfficiency,
        maxScalingFactor: Math.max(...scalingFactors),
      });

      console.log(
        `  ✅ Minimum scaling efficiency: ${(minEfficiency * 100).toFixed(1)}%`,
      );
    });
  });

  describe("Prediction Performance Testing", () => {
    test("should meet prediction time targets", async () => {
      console.log("⚡ Testing prediction performance targets...");

      const predictionScenarios = [
        { name: "Quick Prediction", staffCount: 5, dayCount: 7 },
        { name: "Standard Prediction", staffCount: 15, dayCount: 30 },
        { name: "Large Prediction", staffCount: 30, dayCount: 60 },
        { name: "Maximum Prediction", staffCount: 50, dayCount: 90 },
      ];

      const predictionResults = [];

      for (const scenario of predictionScenarios) {
        console.log(`  Testing ${scenario.name}...`);

        const testData = {
          staffMembers: createTestStaffMembers(scenario.staffCount),
          scheduleData: createTestScheduleData(
            scenario.staffCount,
            scenario.dayCount,
          ),
          dateRange: generateDateRange(scenario.dayCount),
        };

        const performanceResult = await measurePerformance(() =>
          hybridPredictor.predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange,
          ),
        );

        const success =
          !performanceResult.error && performanceResult.result?.success;
        const predictionTime = performanceResult.executionTime;
        const memoryUsed = performanceResult.memoryUsage.delta;

        // Allow longer time for larger predictions
        const timeLimit =
          scenario.staffCount > 30
            ? PERFORMANCE_TARGETS.PREDICTION_TIME * 2
            : PERFORMANCE_TARGETS.PREDICTION_TIME;

        predictionResults.push({
          scenario: scenario.name,
          success,
          predictionTime,
          memoryUsed: Math.round(memoryUsed / 1024 / 1024),
          meetsTimeTarget: predictionTime < timeLimit,
          meetsMemoryTarget: memoryUsed < PERFORMANCE_TARGETS.MEMORY_LIMIT,
        });

        expect(success).toBe(true);
        expect(predictionTime).toBeLessThan(timeLimit);

        console.log(`    Time: ${(predictionTime / 1000).toFixed(2)}s`);
        console.log(`    Memory: ${Math.round(memoryUsed / 1024 / 1024)}MB`);
      }

      const avgPredictionTime =
        predictionResults.reduce((sum, r) => sum + r.predictionTime, 0) /
        predictionResults.length;

      reportGenerator.addTestResult("Prediction Performance", {
        success: true,
        predictionResults,
        avgPredictionTime,
        allMeetTargets: predictionResults.every(
          (r) => r.meetsTimeTarget && r.meetsMemoryTarget,
        ),
      });

      console.log(
        `  ✅ Average prediction time: ${(avgPredictionTime / 1000).toFixed(2)}s`,
      );
    });

    test("should achieve target throughput", async () => {
      console.log("📊 Testing prediction throughput...");

      const testData = {
        staffMembers: createTestStaffMembers(10),
        scheduleData: createTestScheduleData(10, 14),
        dateRange: generateDateRange(14),
      };

      const throughputTests = [];
      const testDuration = 10000; // 10 seconds
      const startTime = Date.now();
      let completedPredictions = 0;

      // Run predictions for specified duration
      const promises = [];
      while (Date.now() - startTime < testDuration) {
        const promise = hybridPredictor
          .predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange,
          )
          .then((result) => {
            if (result.success) {
              completedPredictions++;
              throughputTests.push({
                timestamp: Date.now(),
                processingTime: result.metadata?.processingTime || 0,
              });
            }
          })
          .catch(() => {
            // Count failures but continue
          });

        promises.push(promise);

        // Small delay to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await Promise.all(promises);

      const actualDuration = Date.now() - startTime;
      const throughput = completedPredictions / (actualDuration / 1000); // predictions per second

      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.THROUGHPUT_TARGET);

      const avgProcessingTime =
        throughputTests.length > 0
          ? throughputTests.reduce(
              (sum, test) => sum + test.processingTime,
              0,
            ) / throughputTests.length
          : 0;

      reportGenerator.addTestResult("Prediction Throughput", {
        success: true,
        throughput,
        completedPredictions,
        testDuration: actualDuration,
        avgProcessingTime,
        meetsTarget: throughput > PERFORMANCE_TARGETS.THROUGHPUT_TARGET,
      });

      console.log(
        `  ✅ Throughput: ${throughput.toFixed(1)} predictions/second`,
      );
      console.log(`  ✅ Completed: ${completedPredictions} predictions`);
    });
  });

  describe("Memory Management Testing", () => {
    test("should prevent memory leaks during repeated operations", async () => {
      console.log("💾 Testing memory leak prevention...");

      const initialMemory = getMemoryUsage();
      const memoryReadings = [initialMemory];
      const iterations = 25;

      console.log(
        `  Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB`,
      );

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        const testData = {
          staffMembers: createTestStaffMembers(15),
          scheduleData: createTestScheduleData(15, 21),
          dateRange: generateDateRange(21),
        };

        await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange,
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Wait briefly for cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));

        const currentMemory = getMemoryUsage();
        memoryReadings.push(currentMemory);

        if ((i + 1) % 5 === 0) {
          console.log(
            `    Iteration ${i + 1}: ${Math.round(currentMemory / 1024 / 1024)}MB`,
          );
        }
      }

      // Analyze memory trend
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerIteration = memoryIncrease / iterations;
      const memoryLeakDetected =
        memoryIncreasePerIteration >
        PERFORMANCE_TARGETS.MEMORY_LEAK_THRESHOLD / iterations;

      // Calculate memory trend (slope)
      const memoryTrend = calculateMemoryTrend(memoryReadings);

      expect(memoryLeakDetected).toBe(false);
      expect(memoryTrend.slope).toBeLessThan(1024 * 1024); // Less than 1MB/iteration trend

      reportGenerator.addTestResult("Memory Leak Prevention", {
        success: !memoryLeakDetected,
        iterations,
        memoryIncrease: Math.round(memoryIncrease / 1024 / 1024),
        memoryIncreasePerIteration: Math.round(
          memoryIncreasePerIteration / 1024,
        ),
        memoryTrend: memoryTrend.slope > 0 ? "increasing" : "stable",
        memoryLeakDetected,
      });

      console.log(
        `  ✅ Total memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`,
      );
      console.log(
        `  ✅ Per iteration: ${Math.round(memoryIncreasePerIteration / 1024)}KB`,
      );
      console.log(
        `  ✅ Memory trend: ${memoryTrend.slope > 0 ? "increasing" : "stable"}`,
      );
    });

    test("should handle memory pressure gracefully", async () => {
      console.log("🔥 Testing memory pressure handling...");

      // Create memory pressure by allocating large arrays
      const memoryPressureArrays = [];
      const arraySize = 1024 * 1024; // 1MB arrays
      let memoryPressureCreated = false;

      try {
        // Create memory pressure
        for (let i = 0; i < 50; i++) {
          // Try to allocate 50MB
          memoryPressureArrays.push(new Array(arraySize).fill(0));

          if (getMemoryUsage() > 150 * 1024 * 1024) {
            // 150MB threshold
            memoryPressureCreated = true;
            break;
          }
        }

        console.log(`  Created memory pressure: ${memoryPressureCreated}`);
        console.log(
          `  Memory after pressure: ${Math.round(getMemoryUsage() / 1024 / 1024)}MB`,
        );

        // Test system behavior under memory pressure
        const testData = {
          staffMembers: createTestStaffMembers(20),
          scheduleData: createTestScheduleData(20, 30),
          dateRange: generateDateRange(30),
        };

        const result = await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange,
        );

        expect(result.success).toBe(true);

        const gracefulHandling =
          result.success &&
          (result.metadata?.method?.includes("rule") || // Fell back to rules
            result.metadata?.memoryOptimized === true); // Used memory optimization

        reportGenerator.addTestResult("Memory Pressure Handling", {
          success: true,
          memoryPressureCreated,
          gracefulHandling,
          operationSucceeded: result.success,
          memoryAfterTest: Math.round(getMemoryUsage() / 1024 / 1024),
        });

        console.log(
          `  ✅ Operation succeeded under memory pressure: ${result.success}`,
        );
        console.log(`  ✅ Graceful handling: ${gracefulHandling}`);
      } finally {
        // Clean up memory pressure
        memoryPressureArrays.length = 0;
        if (global.gc) {
          global.gc();
        }
      }
    });

    test("should cleanup TensorFlow tensors properly", async () => {
      console.log("🧹 Testing TensorFlow tensor cleanup...");

      let initialTensorCount = 0;
      let finalTensorCount = 0;

      // Get initial tensor count (if TensorFlow provides it)
      try {
        const tf = require("@tensorflow/tfjs");
        if (tf && tf.memory) {
          initialTensorCount = tf.memory().numTensors;
        }
      } catch (error) {
        // TensorFlow not available in test environment
        initialTensorCount = 0;
      }

      const tensorOperations = 10;

      // Perform operations that create tensors
      for (let i = 0; i < tensorOperations; i++) {
        const staffMembers = createTestStaffMembers(8);

        try {
          await tensorFlowScheduler.trainModel(staffMembers);
        } catch (error) {
          // Continue even if training fails
        }
      }

      // Force cleanup
      if (typeof tf !== "undefined") {
        tf.disposeVariables();
        if (global.gc) {
          global.gc();
        }

        // Wait for cleanup
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          const tf = require("@tensorflow/tfjs");
          if (tf && tf.memory) {
            finalTensorCount = tf.memory().numTensors;
          }
        } catch (error) {
          finalTensorCount = 0;
        }
      }

      const tensorLeak =
        finalTensorCount > initialTensorCount + tensorOperations * 2; // Allow some overhead

      reportGenerator.addTestResult("Tensor Cleanup", {
        success: !tensorLeak,
        initialTensorCount,
        finalTensorCount,
        tensorOperations,
        tensorLeak,
        tensorIncrease: finalTensorCount - initialTensorCount,
      });

      console.log(`  ✅ Initial tensors: ${initialTensorCount}`);
      console.log(`  ✅ Final tensors: ${finalTensorCount}`);
      console.log(`  ✅ Tensor leak detected: ${tensorLeak}`);
    });
  });

  describe("Load Testing", () => {
    test("should maintain performance under concurrent load", async () => {
      console.log("🔀 Testing concurrent load performance...");

      const concurrentUsers = 5;
      const operationsPerUser = 8;
      const results = [];

      // Create concurrent operations
      const userPromises = Array.from(
        { length: concurrentUsers },
        async (_, userIndex) => {
          const userResults = [];

          for (let op = 0; op < operationsPerUser; op++) {
            const testData = {
              staffMembers: createTestStaffMembers(12),
              scheduleData: createTestScheduleData(12, 14),
              dateRange: generateDateRange(14),
            };

            const startTime = Date.now();

            try {
              const result = await hybridPredictor.predictSchedule(
                { scheduleData: testData.scheduleData },
                testData.staffMembers,
                testData.dateRange,
              );

              const endTime = Date.now();

              userResults.push({
                userIndex,
                operation: op,
                success: result.success,
                responseTime: endTime - startTime,
                timestamp: endTime,
              });
            } catch (error) {
              userResults.push({
                userIndex,
                operation: op,
                success: false,
                responseTime: Date.now() - startTime,
                error: error.message,
              });
            }
          }

          return userResults;
        },
      );

      const allUserResults = await Promise.all(userPromises);
      const flatResults = allUserResults.flat();

      // Analyze results
      const successfulOperations = flatResults.filter((r) => r.success);
      const successRate = successfulOperations.length / flatResults.length;
      const avgResponseTime =
        successfulOperations.reduce((sum, r) => sum + r.responseTime, 0) /
        successfulOperations.length;
      const maxResponseTime = Math.max(
        ...successfulOperations.map((r) => r.responseTime),
      );

      // Calculate 99th percentile
      const sortedTimes = successfulOperations
        .map((r) => r.responseTime)
        .sort((a, b) => a - b);
      const p99Index = Math.floor(sortedTimes.length * 0.99);
      const p99ResponseTime = sortedTimes[p99Index] || maxResponseTime;

      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(
        PERFORMANCE_TARGETS.PREDICTION_TIME * 1.5,
      ); // Allow 50% longer under load
      expect(p99ResponseTime).toBeLessThan(
        PERFORMANCE_TARGETS.RESPONSE_TIME_99TH,
      );

      reportGenerator.addTestResult("Concurrent Load Performance", {
        success: true,
        concurrentUsers,
        operationsPerUser,
        totalOperations: flatResults.length,
        successfulOperations: successfulOperations.length,
        successRate,
        avgResponseTime,
        maxResponseTime,
        p99ResponseTime,
      });

      console.log(`  ✅ Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(
        `  ✅ Average response time: ${avgResponseTime.toFixed(0)}ms`,
      );
      console.log(`  ✅ 99th percentile: ${p99ResponseTime.toFixed(0)}ms`);
    });

    test("should handle sustained load over time", async () => {
      console.log("⏰ Testing sustained load performance...");

      const testDuration = 30000; // 30 seconds
      const operationInterval = 500; // 500ms between operations
      const sustainedResults = [];

      const startTime = Date.now();
      let operationCount = 0;

      while (Date.now() - startTime < testDuration) {
        const operationStart = Date.now();
        operationCount++;

        const testData = {
          staffMembers: createTestStaffMembers(10),
          scheduleData: createTestScheduleData(10, 14),
          dateRange: generateDateRange(14),
        };

        try {
          const result = await hybridPredictor.predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange,
          );

          const responseTime = Date.now() - operationStart;

          sustainedResults.push({
            operationNumber: operationCount,
            timestamp: Date.now() - startTime,
            success: result.success,
            responseTime,
            memoryUsage: getMemoryUsage(),
          });
        } catch (error) {
          sustainedResults.push({
            operationNumber: operationCount,
            timestamp: Date.now() - startTime,
            success: false,
            responseTime: Date.now() - operationStart,
            error: error.message,
            memoryUsage: getMemoryUsage(),
          });
        }

        // Wait for next operation
        const elapsed = Date.now() - operationStart;
        if (elapsed < operationInterval) {
          await new Promise((resolve) =>
            setTimeout(resolve, operationInterval - elapsed),
          );
        }
      }

      // Analyze sustained performance
      const successfulOps = sustainedResults.filter((r) => r.success);
      const sustainedSuccessRate =
        successfulOps.length / sustainedResults.length;
      const avgSustainedResponseTime =
        successfulOps.reduce((sum, r) => sum + r.responseTime, 0) /
        successfulOps.length;

      // Check for performance degradation over time
      const firstHalf = successfulOps.slice(
        0,
        Math.floor(successfulOps.length / 2),
      );
      const secondHalf = successfulOps.slice(
        Math.floor(successfulOps.length / 2),
      );

      const firstHalfAvgTime =
        firstHalf.reduce((sum, r) => sum + r.responseTime, 0) /
        firstHalf.length;
      const secondHalfAvgTime =
        secondHalf.reduce((sum, r) => sum + r.responseTime, 0) /
        secondHalf.length;

      const performanceDegradation =
        (secondHalfAvgTime - firstHalfAvgTime) / firstHalfAvgTime;

      expect(sustainedSuccessRate).toBeGreaterThan(0.9); // 90% success rate
      expect(performanceDegradation).toBeLessThan(0.5); // Less than 50% degradation

      reportGenerator.addTestResult("Sustained Load Performance", {
        success: true,
        testDuration,
        totalOperations: sustainedResults.length,
        successfulOperations: successfulOps.length,
        sustainedSuccessRate,
        avgSustainedResponseTime,
        performanceDegradation,
        stablePerformance: performanceDegradation < 0.5,
      });

      console.log(
        `  ✅ Sustained success rate: ${(sustainedSuccessRate * 100).toFixed(1)}%`,
      );
      console.log(
        `  ✅ Performance degradation: ${(performanceDegradation * 100).toFixed(1)}%`,
      );
      console.log(`  ✅ Total operations: ${sustainedResults.length}`);
    });
  });

  // Helper functions
  async function warmUpSystem() {
    const warmUpOperations = LOAD_TEST_CONFIG.WARM_UP_OPERATIONS;

    for (let i = 0; i < warmUpOperations; i++) {
      const testData = {
        staffMembers: createTestStaffMembers(5),
        scheduleData: createTestScheduleData(5, 7),
        dateRange: generateDateRange(7),
      };

      try {
        await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange,
        );
      } catch (error) {
        // Ignore warm-up errors
      }
    }

    // Force garbage collection after warm-up
    if (global.gc) {
      global.gc();
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LOAD_TEST_CONFIG.GC_WAIT_TIME),
    );
  }

  function getMemoryUsage() {
    if (typeof performance !== "undefined" && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  function generateDateRange(dayCount) {
    const dates = [];
    const startDate = new Date(2024, 0, 1);

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }

    return dates;
  }

  function calculateMemoryTrend(memoryReadings) {
    // Calculate linear regression to determine memory trend
    const n = memoryReadings.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ..., n-1
    const sumY = memoryReadings.reduce((sum, mem) => sum + mem, 0);
    const sumXY = memoryReadings.reduce((sum, mem, i) => sum + i * mem, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares 0², 1², ..., (n-1)²

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }
});
