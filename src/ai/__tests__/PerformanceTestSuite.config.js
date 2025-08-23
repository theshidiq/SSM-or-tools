/**
 * PerformanceTestSuite.config.js
 *
 * Configuration file for the comprehensive ML performance testing suite.
 * Defines test targets, thresholds, environments, and execution parameters.
 */

export const PERFORMANCE_TEST_CONFIG = {
  // Test Environment Configuration
  environment: {
    testTimeout: 60000, // 60 seconds max per test
    setupTimeout: 30000, // 30 seconds setup timeout
    teardownTimeout: 15000, // 15 seconds teardown timeout
    retries: 2, // Retry failed tests twice
    verbose: true, // Detailed logging
    parallel: false, // Run tests sequentially for accurate measurements
  },

  // Performance Targets and Thresholds
  targets: {
    // Processing Performance
    processing: {
      smallDatasetTime: 5000, // < 5 seconds for <100 cells
      mediumDatasetTime: 10000, // < 10 seconds for 500 cells
      largeDatasetTime: 15000, // < 15 seconds for >1000 cells
      maxProcessingTime: 30000, // 30 seconds absolute maximum
      minAccuracy: 85, // 85% minimum accuracy
      maxAccuracyDrop: 5, // Max 5% accuracy drop from baseline
    },

    // Memory Management
    memory: {
      maxMemoryUsage: 400 * 1024 * 1024, // 400MB maximum
      memoryLeakThreshold: 50 * 1024 * 1024, // 50MB leak threshold
      cleanupEfficiency: 0.85, // 85% cleanup efficiency
      memoryPressureThreshold: 300 * 1024 * 1024, // 300MB pressure threshold
      maxFragmentation: 0.3, // 30% max fragmentation
    },

    // UI Responsiveness
    ui: {
      minFPS: 30, // >30fps during processing
      maxInputLatency: 100, // <100ms input response
      maxFrameDrops: 5, // <5 frame drops per test
      uiUpdateFrequency: 200, // Updates every 200ms max
      pauseResponseTime: 500, // <500ms pause response
      resumeResponseTime: 500, // <500ms resume response
      cancelResponseTime: 1000, // <1 second cancel response
    },

    // Concurrency and Load
    concurrency: {
      maxConcurrentOps: 4, // 4 concurrent operations max
      minConcurrentSuccessRate: 0.75, // 75% success rate
      concurrentPerformanceDrop: 0.7, // Max 30% performance drop
      resourceContentionLimit: 1.5, // 50% overhead for contention
    },

    // Regression Thresholds
    regression: {
      processingTimeRegression: 1.2, // 20% slower than baseline
      memoryUsageRegression: 1.3, // 30% more memory than baseline
      accuracyRegression: 0.95, // Must maintain 95% of baseline accuracy
      throughputRegression: 0.8, // Must maintain 80% of baseline throughput
      errorRateIncrease: 2.0, // Error rate can't double
    },
  },

  // Test Dataset Configurations
  datasets: {
    tiny: { staff: 5, days: 3, cells: 15, complexity: "low" },
    small: { staff: 8, days: 7, cells: 56, complexity: "low" },
    medium: { staff: 15, days: 14, cells: 210, complexity: "medium" },
    large: { staff: 25, days: 21, cells: 525, complexity: "medium" },
    extraLarge: { staff: 40, days: 30, cells: 1200, complexity: "high" },
    stress: { staff: 60, days: 45, cells: 2700, complexity: "maximum" },
  },

  // Load Testing Scenarios
  loadScenarios: {
    burst: {
      name: "Burst Load",
      description: "Sudden spike in processing requests",
      duration: 10000, // 10 seconds
      requestsPerSecond: 5,
      rampUpTime: 1000, // 1 second ramp up
      sustainTime: 5000, // 5 seconds sustain
      rampDownTime: 1000, // 1 second ramp down
    },
    sustained: {
      name: "Sustained Load",
      description: "Continuous processing over extended period",
      duration: 30000, // 30 seconds
      requestsPerSecond: 2,
      rampUpTime: 5000, // 5 seconds ramp up
      sustainTime: 20000, // 20 seconds sustain
      rampDownTime: 5000, // 5 seconds ramp down
    },
    rampUp: {
      name: "Ramp-up Load",
      description: "Gradually increasing load pattern",
      duration: 20000, // 20 seconds
      startRPS: 1,
      endRPS: 4,
      stepDuration: 2000, // 2 seconds per step
    },
    stress: {
      name: "Stress Load",
      description: "Maximum system capacity testing",
      duration: 15000, // 15 seconds
      requestsPerSecond: 8,
      rampUpTime: 2000, // 2 seconds ramp up
      sustainTime: 10000, // 10 seconds sustain
      rampDownTime: 3000, // 3 seconds ramp down
    },
  },

  // Memory Testing Configurations
  memoryTesting: {
    leakDetection: {
      iterations: 5, // Run 5 iterations to detect leaks
      iterationDelay: 1000, // 1 second between iterations
      gcDelay: 2000, // 2 seconds for GC to run
      leakThreshold: 10 * 1024 * 1024, // 10MB leak threshold per iteration
    },
    pressureTesting: {
      pressureLevels: [100, 200, 300, 400], // MB pressure levels
      pressureDuration: 5000, // 5 seconds per level
      recoveryTime: 3000, // 3 seconds recovery between levels
    },
    allocationTesting: {
      tensorSizes: [
        [10, 10], // Small tensors
        [50, 50], // Medium tensors
        [100, 100], // Large tensors
        [200, 200], // Very large tensors
      ],
      allocationsPerSize: 20,
      poolingTestRounds: 50,
    },
  },

  // Error Scenarios for Testing
  errorScenarios: {
    memoryOverflow: {
      type: "memory_overflow",
      trigger: "large_allocation",
      expectedBehavior: "graceful_degradation",
    },
    workerFailure: {
      type: "worker_failure",
      trigger: "worker_crash",
      expectedBehavior: "fallback_processing",
    },
    invalidData: {
      type: "invalid_data",
      trigger: "corrupted_input",
      expectedBehavior: "error_recovery",
    },
    processingTimeout: {
      type: "timeout",
      trigger: "long_processing",
      expectedBehavior: "cancellation",
    },
    resourceStarvation: {
      type: "resource_starvation",
      trigger: "concurrent_overload",
      expectedBehavior: "queue_management",
    },
  },

  // Benchmark Configurations
  benchmarks: {
    comprehensive: {
      categories: ["processing", "memory", "concurrency", "errorRecovery"],
      scoreWeights: {
        processing: 0.4, // 40% weight
        memory: 0.3, // 30% weight
        concurrency: 0.2, // 20% weight
        errorRecovery: 0.1, // 10% weight
      },
      passingScore: 70, // 70/100 minimum passing score
      excellenceScore: 90, // 90/100 excellence threshold
    },
    scaling: {
      dataSizeMultipliers: [1, 2, 4, 8, 16], // Scale dataset by these factors
      complexityLevels: ["low", "medium", "high"],
      maxScalingFactor: 3, // 3x is acceptable scaling
    },
  },

  // Reporting Configuration
  reporting: {
    generateDetailedReport: true,
    includeCharts: false, // Text-only reports for CI
    outputFormats: ["console", "json"], // Output to console and JSON file
    metricsRetention: 30, // Keep metrics for 30 days
    comparisonBaseline: true, // Compare against baseline
    regressionAlerts: true, // Alert on regressions
  },

  // CI/CD Integration
  cicd: {
    failOnRegression: true, // Fail build on performance regression
    allowedRegressionPercent: 10, // 10% regression allowance
    requirementsCoverage: 0.95, // 95% of requirements must pass
    generateArtifacts: true, // Generate performance artifacts
    uploadResults: false, // Don't upload to external services in test
  },

  // Debug and Development
  debug: {
    enableVerboseLogging: true,
    capturePerformanceTraces: false, // Too much data for automated tests
    enableMemorySnapshots: true,
    saveIntermediateResults: false,
    mockExternalDependencies: true,
  },
};

// Test Utilities Configuration
export const TEST_UTILITIES_CONFIG = {
  dataGeneration: {
    randomSeed: 12345, // Fixed seed for reproducible tests
    staffNamePool: [
      "田中",
      "佐藤",
      "山田",
      "鈴木",
      "高橋",
      "伊藤",
      "渡辺",
      "中村",
      "小林",
      "加藤",
      "吉田",
      "山本",
      "松本",
      "井上",
      "木村",
      "林",
      "清水",
      "山崎",
      "池田",
      "阿部",
      "森",
      "橋本",
      "石川",
      "斎藤",
    ],
    departments: ["キッチン", "ホール", "レジ", "ドリンク"],
    positions: ["マネージャー", "リーダー", "スタッフ", "アルバイト"],
    shiftTypes: ["△", "○", "▽", "×"],
  },

  mockData: {
    enableRealisticSchedules: true,
    includeConflicts: true,
    simulateHumanPatterns: true,
    addRandomVariations: true,
  },

  assertions: {
    defaultTolerancePct: 5, // 5% tolerance for performance assertions
    memoryToleranceMB: 10, // 10MB tolerance for memory assertions
    timeToleranceMs: 100, // 100ms tolerance for timing assertions
  },
};

// Environment-specific Overrides
export const ENVIRONMENT_OVERRIDES = {
  // CI Environment (GitHub Actions, etc.)
  ci: {
    targets: {
      processing: {
        smallDatasetTime: 8000, // More lenient in CI
        mediumDatasetTime: 15000,
        largeDatasetTime: 25000,
      },
      memory: {
        maxMemoryUsage: 600 * 1024 * 1024, // 600MB in CI
      },
      ui: {
        minFPS: 20, // Lower FPS requirement in CI
      },
    },
    environment: {
      testTimeout: 120000, // 2 minutes in CI
      retries: 3, // More retries in CI
    },
  },

  // Development Environment
  development: {
    environment: {
      verbose: true,
      parallel: false,
    },
    debug: {
      enableVerboseLogging: true,
      capturePerformanceTraces: true,
      saveIntermediateResults: true,
    },
  },

  // Production-like Testing
  production: {
    targets: {
      processing: {
        smallDatasetTime: 3000, // Stricter in production testing
        mediumDatasetTime: 7000,
        largeDatasetTime: 12000,
      },
      memory: {
        maxMemoryUsage: 300 * 1024 * 1024, // 300MB in production
      },
    },
    environment: {
      retries: 1, // Fewer retries in production testing
    },
  },
};

// Export helper function to get environment-specific config
export function getTestConfig(environment = "test") {
  const baseConfig = { ...PERFORMANCE_TEST_CONFIG };
  const overrides = ENVIRONMENT_OVERRIDES[environment];

  if (overrides) {
    // Deep merge overrides with base config
    return deepMerge(baseConfig, overrides);
  }

  return baseConfig;
}

// Deep merge utility function
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default PERFORMANCE_TEST_CONFIG;
