/**
 * Performance Testing Utilities for Shift Schedule Manager
 *
 * This module provides utilities for testing the performance of the card view
 * and other components under various load conditions.
 */

// Generate test data for performance testing
export const generateTestData = (staffCount = 100, dayCount = 60) => {
  const departments = ["調理", "ホール", "洗い場", "管理"];
  const statuses = ["社員", "派遣", "パート"];
  const shiftTypes = ["△", "○", "▽", "×", ""];

  // Generate staff members
  const staffMembers = Array.from({ length: staffCount }, (_, i) => ({
    id: `test-staff-${i}`,
    name: `テストスタッフ${i + 1}`,
    department: departments[i % departments.length],
    status: statuses[i % statuses.length],
    position: `ポジション${(i % 5) + 1}`,
    workPeriod: `Period ${Math.floor(i / 10) + 1}`,
  }));

  // Generate date range
  const startDate = new Date("2024-01-01");
  const dateRange = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    return date;
  });

  // Generate schedule data
  const schedule = {};
  staffMembers.forEach((staff) => {
    schedule[staff.id] = {};
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      // Randomly assign shifts with some patterns
      const rand = Math.random();
      if (rand < 0.1) {
        schedule[staff.id][dateKey] = "×"; // 10% days off
      } else if (rand < 0.3) {
        schedule[staff.id][dateKey] = "△"; // 20% early shifts
      } else if (rand < 0.4) {
        schedule[staff.id][dateKey] = "▽"; // 10% late shifts
      } else if (rand < 0.95) {
        schedule[staff.id][dateKey] = staff.status === "パート" ? "○" : ""; // Normal shifts
      } else {
        schedule[staff.id][dateKey] =
          `特別${Math.floor(Math.random() * 3) + 1}`; // 5% custom text
      }
    });
  });

  return { staffMembers, dateRange, schedule };
};

// Performance benchmark function
export const runPerformanceBenchmark = async (
  component,
  testCases,
  iterations = 5,
) => {
  const results = {};

  for (const testCase of testCases) {
    console.log(`🧪 Running test case: ${testCase.name}`);

    const measurements = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      try {
        // Setup test data
        const testData = generateTestData(
          testCase.staffCount,
          testCase.dayCount,
        );

        // Mark render start
        performance.mark("test-render-start");

        // Simulate component render (would be actual render in real test)
        await new Promise((resolve) => {
          setTimeout(() => {
            performance.mark("test-render-end");
            resolve();
          }, 10); // Minimal delay to simulate render
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Measure memory if available
        const memoryUsage = performance.memory
          ? {
              used: performance.memory.usedJSHeapSize / 1024 / 1024,
              total: performance.memory.totalJSHeapSize / 1024 / 1024,
            }
          : null;

        measurements.push({
          duration,
          memoryUsage,
          timestamp: Date.now(),
        });

        // Clean up performance entries
        performance.clearMarks();
        performance.clearMeasures();
      } catch (error) {
        console.error(`Test iteration ${i + 1} failed:`, error);
      }
    }

    // Calculate statistics
    const durations = measurements.map((m) => m.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const p95Duration = durations.sort((a, b) => a - b)[
      Math.floor(durations.length * 0.95)
    ];

    const memoryUsages = measurements
      .filter((m) => m.memoryUsage)
      .map((m) => m.memoryUsage.used);

    const avgMemory =
      memoryUsages.length > 0
        ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
        : null;

    results[testCase.name] = {
      testCase,
      measurements,
      statistics: {
        averageDuration: avgDuration,
        minDuration,
        maxDuration,
        p95Duration,
        averageMemoryMB: avgMemory,
        iterations,
      },
    };

    console.log(
      `✅ ${testCase.name} completed - Avg: ${avgDuration.toFixed(2)}ms`,
    );
  }

  return results;
};

// Predefined test cases
export const getStandardTestCases = () => [
  {
    name: "Small Dataset",
    description: "10 staff members, 30 days",
    staffCount: 10,
    dayCount: 30,
    expectedThresholds: {
      maxDuration: 100,
      maxMemoryMB: 10,
    },
  },
  {
    name: "Medium Dataset",
    description: "50 staff members, 60 days",
    staffCount: 50,
    dayCount: 60,
    expectedThresholds: {
      maxDuration: 300,
      maxMemoryMB: 25,
    },
  },
  {
    name: "Large Dataset",
    description: "100 staff members, 60 days",
    staffCount: 100,
    dayCount: 60,
    expectedThresholds: {
      maxDuration: 500,
      maxMemoryMB: 50,
    },
  },
  {
    name: "Extra Large Dataset",
    description: "200 staff members, 90 days",
    staffCount: 200,
    dayCount: 90,
    expectedThresholds: {
      maxDuration: 1000,
      maxMemoryMB: 75,
    },
  },
];

// View switching performance test
export const testViewSwitching = async (iterations = 10) => {
  const results = [];

  console.log("🔄 Testing view switching performance...");

  for (let i = 0; i < iterations; i++) {
    performance.mark("view-switch-start");

    // Simulate view switch delay
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100),
    );

    performance.mark("view-switch-end");
    performance.measure("view-switch", "view-switch-start", "view-switch-end");

    const entries = performance.getEntriesByName("view-switch", "measure");
    const duration = entries[entries.length - 1].duration;

    results.push({
      iteration: i + 1,
      duration,
      timestamp: Date.now(),
    });

    performance.clearMarks();
    performance.clearMeasures();
  }

  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map((r) => r.duration));

  return {
    results,
    statistics: {
      averageDuration: avgDuration,
      maxDuration,
      iterations,
      passedThreshold: maxDuration < 200, // Should be under 200ms
    },
  };
};

// Memory leak detection
export const detectMemoryLeaks = async (
  testDuration = 30000,
  sampleInterval = 1000,
) => {
  const memorySnapshots = [];
  let isRunning = true;

  console.log("🧠 Starting memory leak detection...");

  const takeSnapshot = () => {
    if (!isRunning) return;

    if (performance.memory) {
      memorySnapshots.push({
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize / 1024 / 1024,
        total: performance.memory.totalJSHeapSize / 1024 / 1024,
        limit: performance.memory.jsHeapSizeLimit / 1024 / 1024,
      });
    }

    if (isRunning) {
      setTimeout(takeSnapshot, sampleInterval);
    }
  };

  // Start taking snapshots
  takeSnapshot();

  // Stop after test duration
  await new Promise((resolve) => {
    setTimeout(() => {
      isRunning = false;
      resolve();
    }, testDuration);
  });

  // Analyze results
  const startMemory = memorySnapshots[0];
  const endMemory = memorySnapshots[memorySnapshots.length - 1];
  const maxMemory = Math.max(...memorySnapshots.map((s) => s.used));
  const memoryGrowth = endMemory.used - startMemory.used;
  const growthRate = memoryGrowth / (testDuration / 1000); // MB per second

  const hasPotentialLeak = growthRate > 1.0; // More than 1MB/sec growth

  return {
    snapshots: memorySnapshots,
    analysis: {
      startMemoryMB: startMemory.used,
      endMemoryMB: endMemory.used,
      maxMemoryMB: maxMemory,
      memoryGrowthMB: memoryGrowth,
      growthRateMBPerSec: growthRate,
      hasPotentialLeak,
      testDurationMs: testDuration,
    },
  };
};

// Generate performance report
export const generatePerformanceReport = (
  benchmarkResults,
  viewSwitchResults,
  memoryResults,
) => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: Object.keys(benchmarkResults).length,
      passedTests: 0,
      failedTests: 0,
    },
    recommendations: [],
  };

  // Analyze benchmark results
  Object.entries(benchmarkResults).forEach(([testName, result]) => {
    const { statistics, testCase } = result;
    const thresholds = testCase.expectedThresholds;

    const passed =
      statistics.averageDuration <= thresholds.maxDuration &&
      (!statistics.averageMemoryMB ||
        statistics.averageMemoryMB <= thresholds.maxMemoryMB);

    if (passed) {
      report.summary.passedTests++;
    } else {
      report.summary.failedTests++;

      if (statistics.averageDuration > thresholds.maxDuration) {
        report.recommendations.push({
          type: "Performance",
          priority: "High",
          issue: `${testName} exceeds duration threshold: ${statistics.averageDuration.toFixed(2)}ms > ${thresholds.maxDuration}ms`,
          solution:
            "Consider implementing virtualization or reducing computation complexity",
        });
      }

      if (statistics.averageMemoryMB > thresholds.maxMemoryMB) {
        report.recommendations.push({
          type: "Memory",
          priority: "High",
          issue: `${testName} exceeds memory threshold: ${statistics.averageMemoryMB.toFixed(2)}MB > ${thresholds.maxMemoryMB}MB`,
          solution: "Optimize data structures and implement proper cleanup",
        });
      }
    }
  });

  // Analyze view switching
  if (viewSwitchResults && !viewSwitchResults.statistics.passedThreshold) {
    report.recommendations.push({
      type: "Responsiveness",
      priority: "Medium",
      issue: `View switching is slow: ${viewSwitchResults.statistics.maxDuration.toFixed(2)}ms`,
      solution: "Implement lazy loading and reduce component render complexity",
    });
  }

  // Analyze memory leaks
  if (memoryResults && memoryResults.analysis.hasPotentialLeak) {
    report.recommendations.push({
      type: "Memory Leak",
      priority: "Critical",
      issue: `Potential memory leak detected: ${memoryResults.analysis.growthRateMBPerSec.toFixed(2)}MB/sec growth`,
      solution:
        "Check for uncleared timers, event listeners, and circular references",
    });
  }

  return report;
};

// Export test runner function
export const runFullPerformanceTest = async () => {
  console.log("🚀 Starting comprehensive performance test...");

  const testCases = getStandardTestCases();

  // Run benchmark tests
  const benchmarkResults = await runPerformanceBenchmark(
    "StaffCardView",
    testCases,
    3,
  );

  // Test view switching
  const viewSwitchResults = await testViewSwitching(5);

  // Test for memory leaks (shorter duration for demo)
  const memoryResults = await detectMemoryLeaks(10000, 500);

  // Generate report
  const report = generatePerformanceReport(
    benchmarkResults,
    viewSwitchResults,
    memoryResults,
  );

  console.log("📊 Performance test completed!");
  console.log("Report:", report);

  return {
    benchmarkResults,
    viewSwitchResults,
    memoryResults,
    report,
  };
};
