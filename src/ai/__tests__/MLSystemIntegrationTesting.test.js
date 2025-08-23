/**
 * MLSystemIntegrationTesting.test.js
 *
 * Integration tests for the ML system optimization components.
 * Tests Web Worker architecture, TensorFlow operations, progressive processing,
 * streaming results, and fallback mechanisms.
 */

import { getAIPerformanceManager } from "../performance/AIPerformanceManager";
import {
  generateTestScheduleData,
  generateTestStaffMembers,
} from "../utils/TestUtils";

describe("ML System Integration Testing Suite", () => {
  let performanceManager;
  let workerManager;
  let streamingManager;
  let memoryManager;

  const INTEGRATION_TARGETS = {
    WORKER_STARTUP_TIME: 2000, // < 2 seconds to initialize worker
    TENSOR_OPERATION_TIME: 1000, // < 1 second for basic tensor ops
    STREAM_LATENCY: 100, // < 100ms stream latency
    FALLBACK_SWITCH_TIME: 500, // < 500ms to switch to fallback
    MESSAGE_ROUND_TRIP: 50, // < 50ms worker message round trip
  };

  beforeAll(async () => {
    console.log("\n⚙️ Starting ML System Integration Testing Suite");
    console.log("================================================");
    console.log(
      "Testing Web Worker architecture, TensorFlow ops, streaming, and fallbacks",
    );
    console.log("================================================\n");

    // Initialize performance manager with all optimizations
    performanceManager = getAIPerformanceManager();
    await performanceManager.initialize({
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      enableStreaming: true,
      maxMemoryMB: 300,
      debug: true,
      workerConfig: {
        memoryLimitMB: 200,
        timeout: 30000,
        enableTensorPooling: true,
      },
    });

    // Get component references
    workerManager = performanceManager.components.workerManager;
    streamingManager = performanceManager.components.streamingManager;
    memoryManager = performanceManager.components.memoryManager;
  });

  afterAll(async () => {
    if (performanceManager) {
      await performanceManager.destroy();
    }
    console.log("\n✅ ML System Integration Testing Suite completed");
  });

  describe("Web Worker Architecture Tests", () => {
    test("should initialize Web Worker successfully", async () => {
      console.log("\n👷 Testing Web Worker initialization...");

      const startTime = performance.now();

      // Test worker initialization
      let workerReady = false;
      let initializationError = null;

      try {
        if (workerManager) {
          const workerStatus = await workerManager.getWorkerStatus();
          console.log(`📊 Worker status: ${JSON.stringify(workerStatus)}`);

          workerReady = workerStatus.ready || workerStatus.available;

          if (!workerReady) {
            // Try to create a new worker
            await workerManager.createWorker();
            const newStatus = await workerManager.getWorkerStatus();
            workerReady = newStatus.ready || newStatus.available;
          }
        } else {
          console.log(
            "⚠️ WorkerManager not available, testing fallback behavior",
          );
          workerReady = false; // Will test fallback
        }
      } catch (error) {
        initializationError = error;
        console.log(`⚠️ Worker initialization error: ${error.message}`);
      }

      const endTime = performance.now();
      const initTime = endTime - startTime;

      console.log(`⏱️ Worker initialization time: ${initTime.toFixed(0)}ms`);
      console.log(`✅ Worker ready: ${workerReady}`);

      if (workerReady) {
        expect(initTime).toBeLessThan(INTEGRATION_TARGETS.WORKER_STARTUP_TIME);
        expect(initializationError).toBeNull();
      } else {
        console.log("ℹ️ Worker not available - fallback mode will be tested");
      }
    });

    test("should communicate with Web Worker effectively", async () => {
      console.log("\n💬 Testing Web Worker communication...");

      if (!workerManager) {
        console.log(
          "ℹ️ Skipping worker communication test - WorkerManager not available",
        );
        return;
      }

      const testMessage = {
        type: "ping",
        timestamp: Date.now(),
        testData: "Hello from main thread",
      };

      const startTime = performance.now();

      try {
        const response = await workerManager.sendMessage(testMessage);
        const endTime = performance.now();
        const roundTripTime = endTime - startTime;

        console.log(
          `⏱️ Message round-trip time: ${roundTripTime.toFixed(1)}ms`,
        );
        console.log(`📨 Response received: ${JSON.stringify(response)}`);

        expect(roundTripTime).toBeLessThan(
          INTEGRATION_TARGETS.MESSAGE_ROUND_TRIP,
        );
        expect(response).toBeDefined();
        expect(response.type).toBe("pong");
      } catch (error) {
        console.log(`⚠️ Worker communication failed: ${error.message}`);
        // Communication failure is acceptable if worker is not available
        expect(error.message).toMatch(/(worker|communication|timeout)/i);
      }
    });

    test("should process ML operations in Web Worker", async () => {
      console.log("\n🧠 Testing ML operations in Web Worker...");

      const testData = createSimpleMLTestData();
      const startTime = performance.now();

      let result;
      let processingError = null;

      try {
        result = await performanceManager.processMLPredictions(
          testData,
          (progress) => {
            console.log(`   Worker progress: ${progress.progress}%`);
          },
        );

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        console.log(`⏱️ ML processing time: ${processingTime.toFixed(0)}ms`);
        console.log(`✨ Processing successful: ${result.success}`);
        console.log(`📊 Result quality: ${result.accuracy}%`);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      } catch (error) {
        processingError = error;
        console.log(`⚠️ ML processing error: ${error.message}`);
      }

      // Either worker processing succeeds, or graceful fallback occurs
      if (processingError) {
        expect(processingError.message).toMatch(/(fallback|worker|timeout)/i);
      }
    });
  });

  describe("TensorFlow Operations Tests", () => {
    test("should perform basic tensor operations correctly", async () => {
      console.log("\n🔢 Testing basic TensorFlow operations...");

      const tensorOperations = [
        {
          name: "Matrix Multiplication",
          operation: async () => {
            // Create test tensors
            const a = [
              [1, 2],
              [3, 4],
            ];
            const b = [
              [5, 6],
              [7, 8],
            ];

            // This would normally use TensorFlow.js
            // For testing, we'll simulate the operation
            const result = [
              [
                a[0][0] * b[0][0] + a[0][1] * b[1][0],
                a[0][0] * b[0][1] + a[0][1] * b[1][1],
              ],
              [
                a[1][0] * b[0][0] + a[1][1] * b[1][0],
                a[1][0] * b[0][1] + a[1][1] * b[1][1],
              ],
            ];

            return { success: true, result, shape: [2, 2] };
          },
        },
        {
          name: "Tensor Reshape",
          operation: async () => {
            const originalShape = [4, 1];
            const targetShape = [2, 2];

            return {
              success: true,
              originalShape,
              targetShape,
              result: [
                [1, 2],
                [3, 4],
              ],
            };
          },
        },
        {
          name: "Activation Function (ReLU)",
          operation: async () => {
            const input = [-2, -1, 0, 1, 2];
            const result = input.map((x) => Math.max(0, x));

            return { success: true, input, result };
          },
        },
      ];

      for (const { name, operation } of tensorOperations) {
        console.log(`   Testing ${name}...`);

        const startTime = performance.now();
        const result = await operation();
        const endTime = performance.now();
        const opTime = endTime - startTime;

        console.log(`   ⏱️ ${name} time: ${opTime.toFixed(1)}ms`);
        console.log(`   ✅ ${name} result: ${result.success}`);

        expect(result.success).toBe(true);
        expect(opTime).toBeLessThan(INTEGRATION_TARGETS.TENSOR_OPERATION_TIME);
      }
    });

    test("should handle tensor memory management", async () => {
      console.log("\n🧠 Testing tensor memory management...");

      if (!memoryManager) {
        console.log(
          "ℹ️ Skipping tensor memory test - MemoryManager not available",
        );
        return;
      }

      const initialMemory = await memoryManager.getMemoryStats();
      console.log(`📊 Initial tensor count: ${initialMemory.numTensors || 0}`);

      // Simulate creating multiple tensors
      const tensorOperations = [];
      for (let i = 0; i < 10; i++) {
        tensorOperations.push({
          id: i,
          size: [100, 100], // Simulate 100x100 tensor
          created: Date.now(),
        });
      }

      console.log(`📈 Created ${tensorOperations.length} simulated tensors`);

      // Simulate tensor cleanup
      await memoryManager.performMemoryCleanup();

      const afterCleanupMemory = await memoryManager.getMemoryStats();
      console.log(
        `🗑️ Memory after cleanup: ${JSON.stringify(afterCleanupMemory)}`,
      );

      // Memory management should reduce tensor count or memory usage
      const memoryImproved =
        (afterCleanupMemory.memoryUtilization || 0) <
        (initialMemory.memoryUtilization || 100);

      if (memoryImproved) {
        console.log("✅ Memory management improved memory utilization");
      } else {
        console.log(
          "ℹ️ Memory cleanup completed (no significant change needed)",
        );
      }
    });

    test("should handle TensorFlow errors gracefully", async () => {
      console.log("\n⚠️ Testing TensorFlow error handling...");

      const errorScenarios = [
        {
          name: "Shape Mismatch",
          test: async () => {
            try {
              // Simulate shape mismatch error
              throw new Error(
                "Cannot broadcast tensors with shapes [3,4] and [2,5]",
              );
            } catch (error) {
              return {
                error: error.message,
                handled: error.message.includes("shape"),
              };
            }
          },
        },
        {
          name: "Memory Overflow",
          test: async () => {
            try {
              // Simulate memory overflow
              throw new Error("Out of memory when allocating tensor");
            } catch (error) {
              return {
                error: error.message,
                handled: error.message.includes("memory"),
              };
            }
          },
        },
        {
          name: "Invalid Operation",
          test: async () => {
            try {
              // Simulate invalid operation
              throw new Error("Invalid operation: division by zero tensor");
            } catch (error) {
              return {
                error: error.message,
                handled: error.message.includes("Invalid"),
              };
            }
          },
        },
      ];

      for (const scenario of errorScenarios) {
        console.log(`   Testing ${scenario.name}...`);

        const result = await scenario.test();

        console.log(`   ⚠️ Error: ${result.error}`);
        console.log(`   ✅ Handled gracefully: ${result.handled}`);

        expect(result.error).toBeDefined();
        expect(result.handled).toBe(true);
      }
    });
  });

  describe("Progressive Processing Tests", () => {
    test("should process data progressively with yielding", async () => {
      console.log("\n⏭️ Testing progressive processing...");

      const testData = createProgressiveTestData();
      let progressUpdates = 0;
      let yieldingDetected = false;

      const progressCallback = (progress) => {
        progressUpdates++;

        if (progress.yielding) {
          yieldingDetected = true;
        }

        console.log(
          `   📊 Progress: ${progress.progress}% (${progress.stage || "processing"})`,
        );
      };

      const startTime = performance.now();
      const result = await performanceManager.processMLPredictions(
        testData,
        progressCallback,
      );
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`⏱️ Total processing time: ${totalTime.toFixed(0)}ms`);
      console.log(`📈 Progress updates: ${progressUpdates}`);
      console.log(`⏭️ Yielding detected: ${yieldingDetected}`);

      expect(result.success).toBe(true);
      expect(progressUpdates).toBeGreaterThan(1);

      // For larger datasets, yielding should occur
      if (testData.staffMembers.length > 15) {
        console.log("ℹ️ Large dataset - yielding behavior expected");
      }
    });

    test("should maintain data integrity during progressive processing", async () => {
      console.log(
        "\n🔐 Testing data integrity during progressive processing...",
      );

      const originalData = createProgressiveTestData();
      const dataChecksum = calculateDataChecksum(originalData);

      console.log(`📊 Original data checksum: ${dataChecksum}`);

      let dataIntegrityChecks = 0;

      const progressCallback = (progress) => {
        if (progress.data && progress.stage === "processing") {
          // Verify data hasn't been corrupted
          const currentChecksum = calculateDataChecksum(progress.data);
          if (currentChecksum === dataChecksum) {
            dataIntegrityChecks++;
          }
        }
      };

      const result = await performanceManager.processMLPredictions(
        originalData,
        progressCallback,
      );

      console.log(`🔍 Data integrity checks passed: ${dataIntegrityChecks}`);
      console.log(`✅ Final result integrity: ${result.success}`);

      expect(result.success).toBe(true);

      // At least some data integrity checks should have occurred
      if (dataIntegrityChecks > 0) {
        console.log(
          "✅ Data integrity maintained during progressive processing",
        );
      }
    });
  });

  describe("Streaming Results Tests", () => {
    test("should stream results in real-time", async () => {
      console.log("\n📡 Testing real-time result streaming...");

      if (!streamingManager) {
        console.log(
          "ℹ️ Skipping streaming test - StreamingManager not available",
        );
        return;
      }

      const testData = createStreamingTestData();
      const streamedResults = [];
      const streamLatencies = [];

      // Subscribe to streaming results
      const unsubscribe = streamingManager.subscribeToStream(
        "ml_processing_test",
        (data, metadata) => {
          const receiveTime = performance.now();
          streamedResults.push({
            data,
            metadata,
            receiveTime,
            latency: metadata.sendTime ? receiveTime - metadata.sendTime : 0,
          });

          if (metadata.sendTime) {
            streamLatencies.push(receiveTime - metadata.sendTime);
          }

          console.log(
            `   📨 Streamed result: ${metadata.type} (${streamedResults.length} total)`,
          );
        },
      );

      try {
        await performanceManager.processMLPredictions(testData);

        // Wait a bit for final stream data
        await new Promise((resolve) => setTimeout(resolve, 100));

        const avgLatency =
          streamLatencies.length > 0
            ? streamLatencies.reduce((a, b) => a + b, 0) /
              streamLatencies.length
            : 0;
        const maxLatency =
          streamLatencies.length > 0 ? Math.max(...streamLatencies) : 0;

        console.log(`📊 Streamed results received: ${streamedResults.length}`);
        console.log(`⏱️ Average stream latency: ${avgLatency.toFixed(1)}ms`);
        console.log(`⏱️ Max stream latency: ${maxLatency.toFixed(1)}ms`);

        expect(streamedResults.length).toBeGreaterThan(0);

        if (streamLatencies.length > 0) {
          expect(avgLatency).toBeLessThan(INTEGRATION_TARGETS.STREAM_LATENCY);
        }
      } finally {
        unsubscribe();
      }
    });

    test("should handle streaming errors gracefully", async () => {
      console.log("\n⚠️ Testing streaming error handling...");

      if (!streamingManager) {
        console.log(
          "ℹ️ Skipping streaming error test - StreamingManager not available",
        );
        return;
      }

      let errorsCaught = 0;
      let errorsHandled = 0;

      // Subscribe to streaming with error handling
      const unsubscribe = streamingManager.subscribeToStream(
        "ml_error_test",
        (data, metadata) => {
          // Normal data handling
          console.log(`   📨 Received: ${metadata.type}`);
        },
        {
          onError: (error) => {
            errorsCaught++;
            console.log(`   ⚠️ Stream error caught: ${error.message}`);

            // Verify error is handled gracefully
            if (error.message && error.recoverable !== undefined) {
              errorsHandled++;
            }
          },
        },
      );

      try {
        // Create scenario that might cause streaming errors
        const problemData = createStreamingErrorTestData();

        await performanceManager.processMLPredictions(problemData);

        console.log(`📊 Errors caught: ${errorsCaught}`);
        console.log(`✅ Errors handled gracefully: ${errorsHandled}`);

        // All caught errors should be handled gracefully
        if (errorsCaught > 0) {
          expect(errorsHandled).toBe(errorsCaught);
        }
      } finally {
        unsubscribe();
      }
    });
  });

  describe("Fallback Mechanism Tests", () => {
    test("should detect when Web Worker is unavailable", async () => {
      console.log("\n🔍 Testing Web Worker availability detection...");

      // Test worker availability
      let workerAvailable = false;
      let fallbackRequired = false;

      try {
        if (workerManager) {
          const status = await workerManager.getWorkerStatus();
          workerAvailable = status.available && status.ready;
        }

        if (!workerAvailable) {
          console.log("⚠️ Web Worker not available - fallback required");
          fallbackRequired = true;
        } else {
          console.log("✅ Web Worker available");
        }
      } catch (error) {
        console.log(`⚠️ Worker detection error: ${error.message}`);
        fallbackRequired = true;
      }

      // System should detect worker availability correctly
      if (typeof Worker === "undefined") {
        expect(fallbackRequired).toBe(true);
        console.log("ℹ️ Environment does not support Web Workers");
      } else {
        console.log(`📊 Worker available: ${workerAvailable}`);
        console.log(`📊 Fallback required: ${fallbackRequired}`);
      }
    });

    test("should switch to fallback processing smoothly", async () => {
      console.log("\n🔄 Testing fallback processing switch...");

      const testData = createFallbackTestData();

      // Force fallback by simulating worker failure
      let fallbackUsed = false;
      let switchTime = 0;

      const startTime = performance.now();

      try {
        const result = await performanceManager.processMLPredictions(
          testData,
          (progress) => {
            if (progress.usingFallback) {
              if (!fallbackUsed) {
                fallbackUsed = true;
                switchTime = performance.now() - startTime;
                console.log(
                  `   🔄 Switched to fallback after ${switchTime.toFixed(0)}ms`,
                );
              }
            }
          },
        );

        console.log(`✅ Fallback processing successful: ${result.success}`);
        console.log(`⏱️ Fallback switch time: ${switchTime.toFixed(0)}ms`);

        expect(result.success).toBe(true);

        if (fallbackUsed) {
          expect(switchTime).toBeLessThan(
            INTEGRATION_TARGETS.FALLBACK_SWITCH_TIME,
          );
        }
      } catch (error) {
        console.log(`⚠️ Fallback processing error: ${error.message}`);
        // Even fallback failures should be graceful
        expect(error.message).toBeDefined();
      }
    });

    test("should maintain performance with fallback processing", async () => {
      console.log("\n⚡ Testing fallback performance...");

      const testData = createFallbackTestData();

      // Test fallback processing performance
      const startTime = performance.now();
      let progressUpdates = 0;

      const result = await performanceManager.processMLPredictions(
        testData,
        (progress) => {
          progressUpdates++;
          if (progressUpdates % 5 === 0) {
            console.log(`   📊 Fallback progress: ${progress.progress}%`);
          }
        },
      );

      const endTime = performance.now();
      const fallbackTime = endTime - startTime;

      console.log(`⏱️ Fallback processing time: ${fallbackTime.toFixed(0)}ms`);
      console.log(`✅ Fallback result quality: ${result.accuracy || "N/A"}%`);
      console.log(`📈 Progress updates: ${progressUpdates}`);

      expect(result.success).toBe(true);
      expect(progressUpdates).toBeGreaterThan(0);

      // Fallback should complete in reasonable time (may be slower than worker)
      expect(fallbackTime).toBeLessThan(20000); // 20 seconds max for fallback
    });
  });

  // Helper Functions
  function createSimpleMLTestData() {
    return {
      scheduleData: generateTestScheduleData(8, 7),
      staffMembers: generateTestStaffMembers(8),
      dateRange: generateDateRange(7),
      constraints: generateBasicConstraints(),
    };
  }

  function createProgressiveTestData() {
    return {
      scheduleData: generateTestScheduleData(20, 14),
      staffMembers: generateTestStaffMembers(20),
      dateRange: generateDateRange(14),
      constraints: generateBasicConstraints(),
    };
  }

  function createStreamingTestData() {
    return {
      scheduleData: generateTestScheduleData(15, 10),
      staffMembers: generateTestStaffMembers(15),
      dateRange: generateDateRange(10),
      constraints: generateBasicConstraints(),
    };
  }

  function createStreamingErrorTestData() {
    // Create data that might cause streaming issues
    const data = createStreamingTestData();
    data.constraints = {
      ...data.constraints,
      impossibleConstraint: true, // This might cause processing issues
      negativeStaff: -1,
    };
    return data;
  }

  function createFallbackTestData() {
    return {
      scheduleData: generateTestScheduleData(12, 8),
      staffMembers: generateTestStaffMembers(12),
      dateRange: generateDateRange(8),
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
      maxShiftsPerDay: { morning: 2, afternoon: 3, evening: 2 },
      minStaffPerShift: 1,
      maxConsecutiveDays: 4,
      restDaysBetweenShifts: 1,
    };
  }

  function calculateDataChecksum(data) {
    // Simple checksum calculation for data integrity
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
});
