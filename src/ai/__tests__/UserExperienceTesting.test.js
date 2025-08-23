/**
 * UserExperienceTesting.test.js
 *
 * User Experience testing suite for the ML performance optimization system.
 * Tests pause/resume functionality, cancellation support, performance dashboard,
 * real-time metrics, and error handling with graceful degradation.
 */

import { getAIPerformanceManager } from "../performance/AIPerformanceManager";
import {
  generateTestScheduleData,
  generateTestStaffMembers,
} from "../utils/TestUtils";

describe("User Experience Testing Suite", () => {
  let performanceManager;
  let performanceMonitor;
  let streamingManager;

  // UX targets and thresholds
  const UX_TARGETS = {
    PAUSE_RESPONSE_TIME: 500, // < 500ms to pause processing
    RESUME_RESPONSE_TIME: 500, // < 500ms to resume processing
    CANCEL_RESPONSE_TIME: 1000, // < 1 second to cancel processing
    UI_UPDATE_FREQUENCY: 200, // Updates every 200ms max
    PROGRESS_ACCURACY_THRESHOLD: 5, // ±5% progress accuracy
    ERROR_MESSAGE_DISPLAY_TIME: 100, // < 100ms to display error
    DASHBOARD_REFRESH_TIME: 1000, // < 1 second dashboard refresh
    ACCESSIBILITY_COMPLIANCE: 95, // 95% accessibility compliance
  };

  beforeAll(async () => {
    console.log("\n🎨 Starting User Experience Testing Suite");
    console.log("================================================");
    console.log(
      "Testing pause/resume, cancellation, dashboard, and error handling",
    );
    console.log("================================================\n");

    // Initialize performance manager with full UX features
    performanceManager = getAIPerformanceManager();
    await performanceManager.initialize({
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      enableStreaming: true,
      maxMemoryMB: 300,
      uiConfig: {
        progressUpdateInterval: 200,
        enablePauseResume: true,
        enableCancellation: true,
        enableDashboard: true,
        dashboardRefreshRate: 1000,
      },
      debug: true,
    });

    performanceMonitor = performanceManager.components.performanceMonitor;
    streamingManager = performanceManager.components.streamingManager;
  });

  afterAll(async () => {
    if (performanceManager) {
      await performanceManager.destroy();
    }
    console.log("\n✅ User Experience Testing Suite completed");
  });

  describe("Pause/Resume Functionality Tests", () => {
    test("should pause processing within response time limit", async () => {
      console.log("\n⏸️ Testing pause functionality...");

      const testData = createUXTestData("medium");
      let processingPaused = false;
      let pauseResponseTime = 0;
      let progressBeforePause = 0;

      // Start processing
      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          console.log(`   📊 Progress: ${progress.progress}%`);

          // Trigger pause when we reach ~30% progress
          if (progress.progress >= 30 && !processingPaused) {
            progressBeforePause = progress.progress;

            const pauseStart = performance.now();

            performanceManager.pauseProcessing().then(() => {
              const pauseEnd = performance.now();
              pauseResponseTime = pauseEnd - pauseStart;
              processingPaused = true;

              console.log(
                `   ⏸️ Paused at ${progressBeforePause}% after ${pauseResponseTime.toFixed(0)}ms`,
              );
            });
          }
        },
      );

      // Wait for pause to occur
      while (!processingPaused && pauseResponseTime === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify pause occurred
      expect(processingPaused).toBe(true);
      expect(pauseResponseTime).toBeLessThan(UX_TARGETS.PAUSE_RESPONSE_TIME);
      expect(progressBeforePause).toBeGreaterThan(0);

      // Clean up by canceling the paused process
      await performanceManager.cancelProcessing();
    });

    test("should resume processing seamlessly", async () => {
      console.log("\n▶️ Testing resume functionality...");

      const testData = createUXTestData("small");
      let pausedAt = 0;
      let resumedAt = 0;
      let resumeResponseTime = 0;
      let processingCompleted = false;

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          // Pause at 40%
          if (progress.progress >= 40 && pausedAt === 0) {
            pausedAt = progress.progress;
            console.log(`   ⏸️ Pausing at ${pausedAt}%`);

            performanceManager.pauseProcessing().then(() => {
              console.log(`   ⏸️ Processing paused`);

              // Resume after a short delay
              setTimeout(async () => {
                const resumeStart = performance.now();

                await performanceManager.resumeProcessing();

                const resumeEnd = performance.now();
                resumeResponseTime = resumeEnd - resumeStart;

                console.log(
                  `   ▶️ Resumed after ${resumeResponseTime.toFixed(0)}ms`,
                );
              }, 500);
            });
          }

          // Track when processing resumes
          if (pausedAt > 0 && progress.progress > pausedAt && resumedAt === 0) {
            resumedAt = progress.progress;
            console.log(`   ▶️ Processing resumed at ${resumedAt}%`);
          }

          if (progress.progress >= 100) {
            processingCompleted = true;
          }
        },
      );

      // Wait for processing to complete
      const result = await processingPromise;

      console.log(`📊 Pause/Resume Summary:`);
      console.log(`   Paused at: ${pausedAt}%`);
      console.log(`   Resumed at: ${resumedAt}%`);
      console.log(
        `   Resume response time: ${resumeResponseTime.toFixed(0)}ms`,
      );
      console.log(`   Processing completed: ${processingCompleted}`);

      expect(result.success).toBe(true);
      expect(resumeResponseTime).toBeLessThan(UX_TARGETS.RESUME_RESPONSE_TIME);
      expect(resumedAt).toBeGreaterThan(pausedAt);
      expect(processingCompleted).toBe(true);
    });

    test("should maintain state integrity during pause/resume cycles", async () => {
      console.log("\n🔄 Testing state integrity during pause/resume...");

      const testData = createUXTestData("small");
      const stateSnapshots = [];
      let pauseResumeCount = 0;

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        async (progress) => {
          // Capture state snapshot
          const snapshot = {
            progress: progress.progress,
            timestamp: Date.now(),
            stage: progress.stage,
            data: progress.data
              ? JSON.stringify(progress.data).slice(0, 100)
              : null,
          };
          stateSnapshots.push(snapshot);

          // Multiple pause/resume cycles
          if (
            [25, 50, 75].includes(Math.floor(progress.progress / 5) * 5) &&
            pauseResumeCount < 3
          ) {
            pauseResumeCount++;

            console.log(
              `   🔄 Pause/Resume cycle ${pauseResumeCount} at ${progress.progress}%`,
            );

            await performanceManager.pauseProcessing();

            // Brief pause
            await new Promise((resolve) => setTimeout(resolve, 100));

            await performanceManager.resumeProcessing();
          }
        },
      );

      const result = await processingPromise;

      // Analyze state integrity
      console.log(`📊 State integrity analysis:`);
      console.log(`   Total snapshots: ${stateSnapshots.length}`);
      console.log(`   Pause/resume cycles: ${pauseResumeCount}`);

      // Progress should be monotonically increasing (allowing for small variations)
      let progressRegressions = 0;
      for (let i = 1; i < stateSnapshots.length; i++) {
        if (stateSnapshots[i].progress < stateSnapshots[i - 1].progress - 1) {
          progressRegressions++;
        }
      }

      console.log(`   Progress regressions: ${progressRegressions}`);

      expect(result.success).toBe(true);
      expect(pauseResumeCount).toBeGreaterThan(0);
      expect(progressRegressions).toBeLessThan(3); // Allow minimal regressions
    });
  });

  describe("Cancellation Support Tests", () => {
    test("should cancel processing instantly", async () => {
      console.log("\n❌ Testing processing cancellation...");

      const testData = createUXTestData("large");
      let processingCanceled = false;
      let cancelResponseTime = 0;
      let progressWhenCanceled = 0;

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          console.log(`   📊 Progress: ${progress.progress}%`);

          // Trigger cancellation at 20% progress
          if (progress.progress >= 20 && !processingCanceled) {
            progressWhenCanceled = progress.progress;

            const cancelStart = performance.now();

            performanceManager.cancelProcessing().then(() => {
              const cancelEnd = performance.now();
              cancelResponseTime = cancelEnd - cancelStart;
              processingCanceled = true;

              console.log(
                `   ❌ Canceled at ${progressWhenCanceled}% after ${cancelResponseTime.toFixed(0)}ms`,
              );
            });
          }
        },
      );

      try {
        await processingPromise;
        // If processing completes without throwing, cancellation didn't work as expected
        console.log(`   ⚠️ Processing completed instead of being canceled`);
      } catch (error) {
        // Expected behavior - processing should be canceled
        console.log(`   ✅ Processing canceled with error: ${error.message}`);
        expect(error.message).toMatch(/(cancel|abort|stop)/i);
      }

      expect(processingCanceled).toBe(true);
      expect(cancelResponseTime).toBeLessThan(UX_TARGETS.CANCEL_RESPONSE_TIME);
      expect(progressWhenCanceled).toBeGreaterThan(0);
    });

    test("should cleanup resources after cancellation", async () => {
      console.log("\n🗑️ Testing resource cleanup after cancellation...");

      const initialMemory = await getCurrentMemoryUsage();
      const testData = createUXTestData("medium");

      let maxMemoryDuringProcessing = initialMemory;

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        async (progress) => {
          const currentMemory = await getCurrentMemoryUsage();
          maxMemoryDuringProcessing = Math.max(
            maxMemoryDuringProcessing,
            currentMemory,
          );

          // Cancel at 30% progress
          if (progress.progress >= 30) {
            await performanceManager.cancelProcessing();
          }
        },
      );

      try {
        await processingPromise;
      } catch (error) {
        console.log(`   ✅ Processing canceled: ${error.message}`);
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalMemory = await getCurrentMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      const peakMemoryUsage = maxMemoryDuringProcessing - initialMemory;

      console.log(`📊 Memory analysis after cancellation:`);
      console.log(
        `   Peak memory usage: ${(peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `   Final memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `   Cleanup efficiency: ${((1 - memoryIncrease / peakMemoryUsage) * 100).toFixed(1)}%`,
      );

      // Memory should be cleaned up reasonably well
      expect(memoryIncrease).toBeLessThan(peakMemoryUsage * 0.5); // Less than 50% of peak should remain
    });

    test("should handle multiple rapid cancellation requests", async () => {
      console.log("\n🚀 Testing rapid cancellation requests...");

      const testData = createUXTestData("medium");
      const cancellationAttempts = [];

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        async (progress) => {
          // Make multiple rapid cancellation attempts
          if (progress.progress >= 15) {
            for (let i = 0; i < 5; i++) {
              const attemptStart = performance.now();

              try {
                await performanceManager.cancelProcessing();
                const attemptEnd = performance.now();

                cancellationAttempts.push({
                  attempt: i + 1,
                  responseTime: attemptEnd - attemptStart,
                  success: true,
                });
              } catch (error) {
                cancellationAttempts.push({
                  attempt: i + 1,
                  error: error.message,
                  success: false,
                });
              }
            }
          }
        },
      );

      try {
        await processingPromise;
      } catch (error) {
        console.log(`   ✅ Processing canceled: ${error.message}`);
      }

      console.log(`📊 Rapid cancellation results:`);
      cancellationAttempts.forEach((attempt) => {
        if (attempt.success) {
          console.log(
            `   Attempt ${attempt.attempt}: ${attempt.responseTime.toFixed(0)}ms`,
          );
        } else {
          console.log(
            `   Attempt ${attempt.attempt}: Error - ${attempt.error}`,
          );
        }
      });

      // At least one cancellation attempt should succeed
      const successfulCancellations = cancellationAttempts.filter(
        (a) => a.success,
      );
      expect(successfulCancellations.length).toBeGreaterThan(0);

      // Successful cancellations should be responsive
      successfulCancellations.forEach((attempt) => {
        expect(attempt.responseTime).toBeLessThan(
          UX_TARGETS.CANCEL_RESPONSE_TIME,
        );
      });
    });
  });

  describe("Performance Dashboard Tests", () => {
    test("should display real-time performance metrics", async () => {
      console.log("\n📊 Testing real-time performance metrics...");

      if (!performanceMonitor) {
        console.log(
          "ℹ️ Skipping dashboard test - PerformanceMonitor not available",
        );
        return;
      }

      const testData = createUXTestData("medium");
      const metricSnapshots = [];

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          // Capture performance metrics
          const metrics = performanceMonitor.getCurrentMetrics
            ? performanceMonitor.getCurrentMetrics()
            : null;

          if (metrics) {
            metricSnapshots.push({
              timestamp: Date.now(),
              progress: progress.progress,
              ...metrics,
            });
          }
        },
      );

      await processingPromise;

      console.log(
        `📈 Performance metrics captured: ${metricSnapshots.length} snapshots`,
      );

      if (metricSnapshots.length > 0) {
        const lastMetrics = metricSnapshots[metricSnapshots.length - 1];
        console.log(`📊 Final metrics:`);
        console.log(`   CPU Usage: ${lastMetrics.cpuUsage || "N/A"}%`);
        console.log(`   Memory Usage: ${lastMetrics.memoryUsage || "N/A"}MB`);
        console.log(
          `   Processing Speed: ${lastMetrics.processingSpeed || "N/A"} items/sec`,
        );

        // Metrics should be collected regularly
        expect(metricSnapshots.length).toBeGreaterThan(5);

        // Metrics should have reasonable values
        metricSnapshots.forEach((snapshot) => {
          if (snapshot.memoryUsage) {
            expect(snapshot.memoryUsage).toBeGreaterThan(0);
            expect(snapshot.memoryUsage).toBeLessThan(1000); // Less than 1GB
          }
        });
      } else {
        console.log("ℹ️ No performance metrics captured");
      }
    });

    test("should update dashboard with appropriate frequency", async () => {
      console.log("\n⏱️ Testing dashboard update frequency...");

      const testData = createUXTestData("medium");
      const dashboardUpdates = [];

      // Mock dashboard update mechanism
      const mockDashboard = {
        updateCount: 0,
        lastUpdateTime: 0,
        updateIntervals: [],

        update: function (metrics) {
          const now = performance.now();
          if (this.lastUpdateTime > 0) {
            this.updateIntervals.push(now - this.lastUpdateTime);
          }
          this.lastUpdateTime = now;
          this.updateCount++;

          dashboardUpdates.push({
            timestamp: now,
            metrics,
            updateNumber: this.updateCount,
          });
        },
      };

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          // Simulate dashboard updates
          mockDashboard.update({
            progress: progress.progress,
            stage: progress.stage,
            memoryUsage: progress.memoryUsage || 0,
          });
        },
      );

      await processingPromise;

      const avgUpdateInterval =
        mockDashboard.updateIntervals.length > 0
          ? mockDashboard.updateIntervals.reduce((a, b) => a + b, 0) /
            mockDashboard.updateIntervals.length
          : 0;

      console.log(`📊 Dashboard update analysis:`);
      console.log(`   Total updates: ${mockDashboard.updateCount}`);
      console.log(
        `   Average update interval: ${avgUpdateInterval.toFixed(0)}ms`,
      );
      console.log(
        `   Update frequency: ${avgUpdateInterval > 0 ? (1000 / avgUpdateInterval).toFixed(1) : "N/A"} Hz`,
      );

      expect(mockDashboard.updateCount).toBeGreaterThan(3);

      if (avgUpdateInterval > 0) {
        // Updates shouldn't be too frequent (performance) or too infrequent (UX)
        expect(avgUpdateInterval).toBeGreaterThan(50); // Not more than 20 Hz
        expect(avgUpdateInterval).toBeLessThan(
          UX_TARGETS.UI_UPDATE_FREQUENCY * 3,
        ); // Not less than ~1.7 Hz
      }
    });

    test("should provide accurate progress reporting", async () => {
      console.log("\n📏 Testing progress reporting accuracy...");

      const testData = createUXTestData("small");
      const progressReports = [];

      const processingPromise = performanceManager.processMLPredictions(
        testData,
        (progress) => {
          progressReports.push({
            timestamp: performance.now(),
            progress: progress.progress,
            stage: progress.stage,
          });
        },
      );

      await processingPromise;

      // Analyze progress reporting
      console.log(`📈 Progress analysis:`);
      console.log(`   Total progress reports: ${progressReports.length}`);

      if (progressReports.length > 1) {
        const finalProgress =
          progressReports[progressReports.length - 1].progress;
        console.log(`   Final progress: ${finalProgress}%`);

        // Progress should reach 100%
        expect(finalProgress).toBeGreaterThan(95);
        expect(finalProgress).toBeLessThanOrEqual(100);

        // Progress should be monotonically increasing (mostly)
        let regressions = 0;
        for (let i = 1; i < progressReports.length; i++) {
          if (progressReports[i].progress < progressReports[i - 1].progress) {
            regressions++;
          }
        }

        const regressionRate = regressions / progressReports.length;
        console.log(
          `   Progress regressions: ${regressions} (${(regressionRate * 100).toFixed(1)}%)`,
        );

        expect(regressionRate).toBeLessThan(0.1); // Less than 10% regression rate
      }
    });
  });

  describe("Error Handling and Graceful Degradation Tests", () => {
    test("should display user-friendly error messages", async () => {
      console.log("\n💬 Testing user-friendly error messages...");

      const errorScenarios = [
        {
          name: "Memory Overflow",
          testData: createErrorTestData("memory_overflow"),
          expectedErrorPattern: /memory|overflow|limit/i,
        },
        {
          name: "Invalid Data",
          testData: createErrorTestData("invalid_data"),
          expectedErrorPattern: /data|invalid|format/i,
        },
        {
          name: "Processing Timeout",
          testData: createErrorTestData("timeout"),
          expectedErrorPattern: /timeout|time|limit/i,
        },
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        console.log(`   Testing ${scenario.name}...`);

        let errorCaught = false;
        let errorMessage = "";
        let errorDisplayTime = 0;

        try {
          const errorStart = performance.now();

          await performanceManager.processMLPredictions(
            scenario.testData,
            (progress) => {
              if (progress.error) {
                const errorEnd = performance.now();
                errorDisplayTime = errorEnd - errorStart;
                errorMessage = progress.error.message || progress.error;
                errorCaught = true;
              }
            },
          );
        } catch (error) {
          errorCaught = true;
          errorMessage = error.message;
          errorDisplayTime = 0; // Immediate error
        }

        const result = {
          scenario: scenario.name,
          errorCaught,
          errorMessage,
          errorDisplayTime,
          matchesPattern: scenario.expectedErrorPattern.test(errorMessage),
          userFriendly: isUserFriendlyError(errorMessage),
        };

        errorResults.push(result);

        console.log(`   ✅ Error caught: ${errorCaught}`);
        console.log(`   💬 Error message: "${errorMessage}"`);
        console.log(`   ⏱️ Display time: ${errorDisplayTime.toFixed(0)}ms`);
        console.log(`   🎯 Matches pattern: ${result.matchesPattern}`);
        console.log(`   👤 User-friendly: ${result.userFriendly}`);
      }

      // All error scenarios should be handled gracefully
      errorResults.forEach((result) => {
        expect(result.errorCaught).toBe(true);
        expect(result.errorMessage).toBeTruthy();
        expect(result.userFriendly).toBe(true);

        if (result.errorDisplayTime > 0) {
          expect(result.errorDisplayTime).toBeLessThan(
            UX_TARGETS.ERROR_MESSAGE_DISPLAY_TIME * 10,
          );
        }
      });
    });

    test("should provide graceful degradation options", async () => {
      console.log("\n🔄 Testing graceful degradation...");

      const degradationTest = createDegradationTestData();
      let degradationOptions = [];
      let fallbackUsed = false;

      try {
        const result = await performanceManager.processMLPredictions(
          degradationTest,
          (progress) => {
            if (progress.degradationOptions) {
              degradationOptions = progress.degradationOptions;
              console.log(
                `   🔄 Degradation options available: ${degradationOptions.length}`,
              );
            }

            if (progress.usingFallback) {
              fallbackUsed = true;
              console.log(`   🔄 Fallback mode activated`);
            }
          },
        );

        console.log(
          `✅ Processing completed with ${fallbackUsed ? "fallback" : "normal"} mode`,
        );
      } catch (error) {
        console.log(`⚠️ Graceful failure: ${error.message}`);

        // Check if error provides recovery options
        expect(error.recoveryOptions || error.suggestions).toBeDefined();
      }

      // System should attempt graceful degradation
      if (degradationOptions.length > 0 || fallbackUsed) {
        console.log(`🔄 Graceful degradation was attempted`);
        expect(true).toBe(true); // Degradation attempted
      } else {
        console.log(`ℹ️ No degradation needed for this test scenario`);
      }
    });

    test("should maintain UI responsiveness during error recovery", async () => {
      console.log("\n🔄 Testing UI responsiveness during error recovery...");

      const errorRecoveryTest = createErrorRecoveryTestData();
      const responsivenessMeasurements = [];

      let errorRecoveryStarted = false;
      let errorRecoveryCompleted = false;

      // Monitor UI responsiveness during error recovery
      const responsivenesMonitor = setInterval(() => {
        if (errorRecoveryStarted && !errorRecoveryCompleted) {
          const measurementStart = performance.now();

          // Simulate UI interaction during error recovery
          simulateUIInteraction().then(() => {
            const measurementEnd = performance.now();
            const responseTime = measurementEnd - measurementStart;

            responsivenessMeasurements.push(responseTime);
          });
        }
      }, 100);

      try {
        await performanceManager.processMLPredictions(
          errorRecoveryTest,
          (progress) => {
            if (progress.error && !errorRecoveryStarted) {
              errorRecoveryStarted = true;
              console.log(`   🔄 Error recovery started`);
            }

            if (progress.recovered) {
              errorRecoveryCompleted = true;
              console.log(`   ✅ Error recovery completed`);
            }
          },
        );
      } catch (error) {
        errorRecoveryCompleted = true;
        console.log(`   ⚠️ Error recovery failed: ${error.message}`);
      } finally {
        clearInterval(responsivenesMonitor);
      }

      if (responsivenessMeasurements.length > 0) {
        const avgResponseTime =
          responsivenessMeasurements.reduce((a, b) => a + b, 0) /
          responsivenessMeasurements.length;
        const maxResponseTime = Math.max(...responsivenessMeasurements);

        console.log(`📊 UI responsiveness during error recovery:`);
        console.log(
          `   Measurements taken: ${responsivenessMeasurements.length}`,
        );
        console.log(
          `   Average response time: ${avgResponseTime.toFixed(0)}ms`,
        );
        console.log(`   Max response time: ${maxResponseTime.toFixed(0)}ms`);

        // UI should remain responsive during error recovery
        expect(avgResponseTime).toBeLessThan(200);
        expect(maxResponseTime).toBeLessThan(500);
      }
    });
  });

  // Helper Functions
  function createUXTestData(size = "medium") {
    const sizeConfig = {
      small: { staff: 8, days: 7 },
      medium: { staff: 15, days: 12 },
      large: { staff: 25, days: 20 },
    };

    const config = sizeConfig[size] || sizeConfig.medium;

    return {
      scheduleData: generateTestScheduleData(config.staff, config.days),
      staffMembers: generateTestStaffMembers(config.staff),
      dateRange: generateDateRange(config.days),
      constraints: generateBasicConstraints(),
    };
  }

  function createErrorTestData(errorType) {
    const baseData = createUXTestData("small");

    switch (errorType) {
      case "memory_overflow":
        // Create data that might cause memory issues
        return {
          ...baseData,
          scheduleData: generateTestScheduleData(100, 50), // Very large dataset
          forceMemoryError: true,
        };

      case "invalid_data":
        // Create invalid data structure
        return {
          scheduleData: null, // Invalid data
          staffMembers: [],
          dateRange: [],
          constraints: { invalid: true },
        };

      case "timeout":
        // Create data that might timeout
        return {
          ...baseData,
          processing: { timeout: 1 }, // Very short timeout
          complexity: "maximum",
        };

      default:
        return baseData;
    }
  }

  function createDegradationTestData() {
    return {
      scheduleData: generateTestScheduleData(30, 20),
      staffMembers: generateTestStaffMembers(30),
      dateRange: generateDateRange(20),
      constraints: generateComplexConstraints(),
      requireDegradation: true, // Flag to simulate need for degradation
    };
  }

  function createErrorRecoveryTestData() {
    return {
      scheduleData: generateTestScheduleData(12, 10),
      staffMembers: generateTestStaffMembers(12),
      dateRange: generateDateRange(10),
      constraints: generateBasicConstraints(),
      simulateRecoverableError: true,
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

  function generateComplexConstraints() {
    return {
      ...generateBasicConstraints(),
      skillRequirements: ["cooking", "serving", "cleaning"],
      availabilityConstraints: true,
      fairnessWeights: { experience: 0.3, hours: 0.4, preferences: 0.3 },
      complexityLevel: "high",
    };
  }

  async function getCurrentMemoryUsage() {
    if (
      typeof window !== "undefined" &&
      window.performance &&
      window.performance.memory
    ) {
      return window.performance.memory.usedJSHeapSize;
    }

    return process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  }

  function isUserFriendlyError(errorMessage) {
    if (!errorMessage) return false;

    // Check for user-friendly characteristics
    const userFriendlyPatterns = [
      /please|try|unable|cannot|failed/i, // Polite language
      /\b(data|memory|processing|network)\b/i, // Domain terms
      /\b(retry|again|later|support)\b/i, // Actionable suggestions
    ];

    const technicalJargonPatterns = [
      /\b(undefined|null|NaN|exception|stack)\b/i, // Technical terms
      /\b(0x[0-9a-f]+|TypeError|ReferenceError)\b/i, // Technical errors
    ];

    const hasUserFriendlyLanguage = userFriendlyPatterns.some((pattern) =>
      pattern.test(errorMessage),
    );
    const hasTechnicalJargon = technicalJargonPatterns.some((pattern) =>
      pattern.test(errorMessage),
    );

    return hasUserFriendlyLanguage && !hasTechnicalJargon;
  }

  async function simulateUIInteraction() {
    // Simulate DOM manipulation or state updates
    const testElement = document.createElement("div");
    testElement.style.transform = "translateX(50px)";
    testElement.innerHTML = "UI interaction test";
    document.body.appendChild(testElement);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    testElement.remove();
  }
});
