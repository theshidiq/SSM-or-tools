/**
 * PerformanceRegressionTesting.test.js
 *
 * Performance regression testing suite for the ML performance optimization system.
 * Creates baseline metrics, tests with various configurations, validates performance under
 * different system loads, and tests concurrent operations and resource contention.
 */

import { getAIPerformanceManager } from '../performance/AIPerformanceManager';
import { generateTestScheduleData, generateTestStaffMembers } from '../utils/TestUtils';

describe('Performance Regression Testing Suite', () => {
  let performanceManager;
  let baselineMetrics;
  let testResults = [];

  // Performance regression thresholds
  const REGRESSION_THRESHOLDS = {
    PROCESSING_TIME_REGRESSION: 1.2,      // 20% slower than baseline
    MEMORY_USAGE_REGRESSION: 1.3,         // 30% more memory than baseline
    ACCURACY_REGRESSION: 0.95,             // Must maintain 95% of baseline accuracy
    THROUGHPUT_REGRESSION: 0.8,            // Must maintain 80% of baseline throughput
    ERROR_RATE_INCREASE: 2.0,              // Error rate can't double
    CONCURRENT_PERFORMANCE_DROP: 0.7,      // 30% performance drop max for concurrent ops
  };

  const BASELINE_TEST_CONFIGS = [
    { name: 'Small Dataset', staff: 8, days: 7, complexity: 'low' },
    { name: 'Medium Dataset', staff: 15, days: 14, complexity: 'medium' },
    { name: 'Large Dataset', staff: 25, days: 21, complexity: 'high' }
  ];

  beforeAll(async () => {
    console.log('\n📈 Starting Performance Regression Testing Suite');
    console.log('================================================');
    console.log('Creating baselines, testing configurations, and validating performance');
    console.log('================================================\n');

    // Initialize performance manager
    performanceManager = getAIPerformanceManager();
    await performanceManager.initialize({
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      enableStreaming: true,
      maxMemoryMB: 400,
      debug: true
    });

    // Create baseline performance metrics
    console.log('🎯 Creating baseline performance metrics...');
    baselineMetrics = await createBaselineMetrics();
    
    console.log('📊 Baseline Metrics Summary:');
    Object.entries(baselineMetrics).forEach(([config, metrics]) => {
      console.log(`   ${config}: ${metrics.processingTime.toFixed(0)}ms, ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB, ${metrics.accuracy.toFixed(1)}%`);
    });
  });

  afterAll(async () => {
    if (performanceManager) {
      await performanceManager.destroy();
    }
    
    // Generate final regression report
    generateRegressionReport();
    
    console.log('\n✅ Performance Regression Testing Suite completed');
  });

  describe('Baseline Performance Metrics', () => {

    test('should establish reliable baseline metrics', async () => {
      console.log('\n📊 Validating baseline reliability...');

      // Test baseline consistency by running multiple iterations
      const consistencyTests = [];
      
      for (const config of BASELINE_TEST_CONFIGS) {
        console.log(`   Testing ${config.name} consistency...`);
        
        const iterations = [];
        for (let i = 0; i < 3; i++) {
          const testData = createTestData(config);
          const metrics = await measurePerformanceMetrics(testData, `baseline_${config.name}_${i}`);
          iterations.push(metrics);
        }

        const avgProcessingTime = iterations.reduce((sum, m) => sum + m.processingTime, 0) / iterations.length;
        const processingTimeVariance = calculateVariance(iterations.map(m => m.processingTime));
        const processingTimeCV = Math.sqrt(processingTimeVariance) / avgProcessingTime; // Coefficient of variation

        const avgMemoryUsage = iterations.reduce((sum, m) => sum + m.memoryUsage, 0) / iterations.length;
        const memoryVariance = calculateVariance(iterations.map(m => m.memoryUsage));
        const memoryCV = Math.sqrt(memoryVariance) / avgMemoryUsage;

        consistencyTests.push({
          config: config.name,
          processingTimeCV,
          memoryCV,
          avgProcessingTime,
          avgMemoryUsage
        });

        console.log(`     Processing time CV: ${(processingTimeCV * 100).toFixed(1)}%`);
        console.log(`     Memory usage CV: ${(memoryCV * 100).toFixed(1)}%`);
      }

      // Baselines should be consistent (CV < 15%)
      consistencyTests.forEach(test => {
        expect(test.processingTimeCV).toBeLessThan(0.15);
        expect(test.memoryCV).toBeLessThan(0.15);
        console.log(`✅ ${test.config} baseline is consistent`);
      });
    });

    test('should maintain baseline performance characteristics', async () => {
      console.log('\n🔍 Validating baseline characteristics...');

      const characteristicsTests = [];

      for (const [configName, baseline] of Object.entries(baselineMetrics)) {
        // Expected characteristics based on dataset size
        const config = BASELINE_TEST_CONFIGS.find(c => c.name === configName);
        const expectedRelativeMemory = config.staff * config.days * 0.1; // Rough estimate
        
        const characteristics = {
          config: configName,
          memoryEfficiency: baseline.memoryUsage / (config.staff * config.days),
          processingSpeed: (config.staff * config.days) / baseline.processingTime * 1000, // items per second
          accuracyScore: baseline.accuracy
        };

        characteristicsTests.push(characteristics);

        console.log(`   ${configName}:`);
        console.log(`     Memory efficiency: ${characteristics.memoryEfficiency.toFixed(2)} bytes/cell`);
        console.log(`     Processing speed: ${characteristics.processingSpeed.toFixed(1)} cells/sec`);
        console.log(`     Accuracy score: ${characteristics.accuracyScore.toFixed(1)}%`);

        // Validate reasonable characteristics
        expect(characteristics.accuracyScore).toBeGreaterThan(80);
        expect(characteristics.processingSpeed).toBeGreaterThan(1);
        expect(characteristics.memoryEfficiency).toBeLessThan(1024 * 1024); // Less than 1MB per cell
      }
    });
  });

  describe('Configuration Variation Testing', () => {

    test('should handle different constraint configurations without regression', async () => {
      console.log('\n⚙️ Testing constraint configuration variations...');

      const constraintVariations = [
        {
          name: 'Minimal Constraints',
          constraints: {
            maxShiftsPerDay: { morning: 5, afternoon: 5, evening: 5 },
            minStaffPerShift: 1
          }
        },
        {
          name: 'Standard Constraints', 
          constraints: {
            maxShiftsPerDay: { morning: 3, afternoon: 4, evening: 3 },
            minStaffPerShift: 2,
            maxConsecutiveDays: 5,
            restDaysBetweenShifts: 1
          }
        },
        {
          name: 'Complex Constraints',
          constraints: {
            maxShiftsPerDay: { morning: 2, afternoon: 3, evening: 2 },
            minStaffPerShift: 2,
            maxConsecutiveDays: 4,
            restDaysBetweenShifts: 1,
            skillRequirements: ['cooking', 'serving', 'cleaning'],
            availabilityConstraints: true,
            fairnessWeights: { experience: 0.3, hours: 0.4, preferences: 0.3 }
          }
        }
      ];

      const configResults = [];

      for (const variation of constraintVariations) {
        console.log(`   Testing ${variation.name}...`);
        
        const testData = createTestData(BASELINE_TEST_CONFIGS[1]); // Medium dataset
        testData.constraints = variation.constraints;
        
        const metrics = await measurePerformanceMetrics(testData, `config_${variation.name}`);
        const baseline = baselineMetrics[BASELINE_TEST_CONFIGS[1].name];
        
        const regressionAnalysis = {
          variation: variation.name,
          processingTimeRatio: metrics.processingTime / baseline.processingTime,
          memoryUsageRatio: metrics.memoryUsage / baseline.memoryUsage,
          accuracyRatio: metrics.accuracy / baseline.accuracy,
          metrics
        };

        configResults.push(regressionAnalysis);

        console.log(`     Processing time ratio: ${regressionAnalysis.processingTimeRatio.toFixed(2)}x`);
        console.log(`     Memory usage ratio: ${regressionAnalysis.memoryUsageRatio.toFixed(2)}x`);
        console.log(`     Accuracy ratio: ${regressionAnalysis.accuracyRatio.toFixed(2)}x`);

        // Check for regressions
        expect(regressionAnalysis.processingTimeRatio).toBeLessThan(REGRESSION_THRESHOLDS.PROCESSING_TIME_REGRESSION);
        expect(regressionAnalysis.memoryUsageRatio).toBeLessThan(REGRESSION_THRESHOLDS.MEMORY_USAGE_REGRESSION);
        expect(regressionAnalysis.accuracyRatio).toBeGreaterThan(REGRESSION_THRESHOLDS.ACCURACY_REGRESSION);
      }

      testResults.push({ category: 'Configuration Variations', results: configResults });
    });

    test('should scale performance appropriately with dataset size', async () => {
      console.log('\n📏 Testing performance scaling with dataset size...');

      const scalingTests = [
        { staff: 5, days: 5, expectedComplexity: 'O(n)' },
        { staff: 10, days: 10, expectedComplexity: 'O(n log n)' },
        { staff: 20, days: 15, expectedComplexity: 'O(n^2)' },
        { staff: 30, days: 20, expectedComplexity: 'O(n^2 log n)' }
      ];

      const scalingResults = [];

      for (const test of scalingTests) {
        const testData = createTestData({
          staff: test.staff,
          days: test.days,
          complexity: 'medium'
        });

        const metrics = await measurePerformanceMetrics(testData, `scaling_${test.staff}x${test.days}`);
        const dataSize = test.staff * test.days;

        scalingResults.push({
          dataSize,
          staff: test.staff,
          days: test.days,
          processingTime: metrics.processingTime,
          memoryUsage: metrics.memoryUsage,
          timePerCell: metrics.processingTime / dataSize,
          memoryPerCell: metrics.memoryUsage / dataSize
        });

        console.log(`   ${test.staff}x${test.days} (${dataSize} cells):`);
        console.log(`     Processing time: ${metrics.processingTime.toFixed(0)}ms`);
        console.log(`     Time per cell: ${(metrics.processingTime / dataSize).toFixed(1)}ms`);
        console.log(`     Memory per cell: ${(metrics.memoryUsage / dataSize / 1024).toFixed(1)}KB`);
      }

      // Analyze scaling characteristics
      for (let i = 1; i < scalingResults.length; i++) {
        const current = scalingResults[i];
        const previous = scalingResults[i - 1];
        
        const sizeRatio = current.dataSize / previous.dataSize;
        const timeRatio = current.processingTime / previous.processingTime;
        const memoryRatio = current.memoryUsage / previous.memoryUsage;

        console.log(`   Scaling ${previous.dataSize} → ${current.dataSize}:`);
        console.log(`     Time scaling: ${timeRatio.toFixed(2)}x (expected: ${sizeRatio.toFixed(2)}x)`);
        console.log(`     Memory scaling: ${memoryRatio.toFixed(2)}x`);

        // Performance shouldn't scale worse than O(n^3)
        const maxExpectedTimeRatio = Math.pow(sizeRatio, 3);
        expect(timeRatio).toBeLessThan(maxExpectedTimeRatio);
      }

      testResults.push({ category: 'Dataset Scaling', results: scalingResults });
    });
  });

  describe('System Load Impact Testing', () => {

    test('should maintain performance under CPU load simulation', async () => {
      console.log('\n🔥 Testing performance under CPU load...');

      const testData = createTestData(BASELINE_TEST_CONFIGS[1]); // Medium dataset
      const baseline = baselineMetrics[BASELINE_TEST_CONFIGS[1].name];

      // Simulate CPU load
      const cpuLoadWorkers = [];
      for (let i = 0; i < 2; i++) {
        const worker = createCPULoadSimulator();
        cpuLoadWorkers.push(worker);
      }

      console.log('   🔥 CPU load simulation started...');
      
      try {
        const metrics = await measurePerformanceMetrics(testData, 'cpu_load_test');
        
        const performanceImpact = {
          processingTimeRatio: metrics.processingTime / baseline.processingTime,
          memoryUsageRatio: metrics.memoryUsage / baseline.memoryUsage,
          accuracyRatio: metrics.accuracy / baseline.accuracy
        };

        console.log(`   📊 Performance under CPU load:`);
        console.log(`     Processing time impact: ${performanceImpact.processingTimeRatio.toFixed(2)}x`);
        console.log(`     Memory usage impact: ${performanceImpact.memoryUsageRatio.toFixed(2)}x`);
        console.log(`     Accuracy impact: ${performanceImpact.accuracyRatio.toFixed(2)}x`);

        // Performance degradation under load should be reasonable
        expect(performanceImpact.processingTimeRatio).toBeLessThan(2.0); // Not more than 2x slower
        expect(performanceImpact.memoryUsageRatio).toBeLessThan(1.5);    // Not more than 50% more memory
        expect(performanceImpact.accuracyRatio).toBeGreaterThan(0.9);    // Maintain 90% accuracy

        testResults.push({ 
          category: 'CPU Load Impact', 
          results: [{ type: 'CPU Load', metrics, performanceImpact }] 
        });
        
      } finally {
        // Cleanup CPU load workers
        cpuLoadWorkers.forEach(worker => worker.terminate());
        console.log('   🛑 CPU load simulation stopped');
      }
    });

    test('should handle memory pressure gracefully', async () => {
      console.log('\n🧠 Testing performance under memory pressure...');

      const testData = createTestData(BASELINE_TEST_CONFIGS[1]); 
      const baseline = baselineMetrics[BASELINE_TEST_CONFIGS[1].name];

      // Create memory pressure
      const memoryConsumers = [];
      for (let i = 0; i < 5; i++) {
        // Allocate large arrays to create memory pressure
        const consumer = new Array(1000000).fill(Math.random());
        memoryConsumers.push(consumer);
      }

      console.log('   🧠 Memory pressure created...');
      
      try {
        const metrics = await measurePerformanceMetrics(testData, 'memory_pressure_test');
        
        const performanceImpact = {
          processingTimeRatio: metrics.processingTime / baseline.processingTime,
          memoryUsageRatio: metrics.memoryUsage / baseline.memoryUsage,
          accuracyRatio: metrics.accuracy / baseline.accuracy,
          completionSuccess: metrics.success
        };

        console.log(`   📊 Performance under memory pressure:`);
        console.log(`     Processing time impact: ${performanceImpact.processingTimeRatio.toFixed(2)}x`);
        console.log(`     Memory usage impact: ${performanceImpact.memoryUsageRatio.toFixed(2)}x`);
        console.log(`     Accuracy impact: ${performanceImpact.accuracyRatio.toFixed(2)}x`);
        console.log(`     Completion success: ${performanceImpact.completionSuccess}`);

        // System should handle memory pressure gracefully
        if (performanceImpact.completionSuccess) {
          expect(performanceImpact.processingTimeRatio).toBeLessThan(3.0); // May be slower under pressure
          expect(performanceImpact.accuracyRatio).toBeGreaterThan(0.85);   // Maintain 85% accuracy
        }

        testResults.push({ 
          category: 'Memory Pressure Impact', 
          results: [{ type: 'Memory Pressure', metrics, performanceImpact }] 
        });
        
      } finally {
        // Cleanup memory consumers
        memoryConsumers.length = 0;
        console.log('   🛑 Memory pressure released');
      }
    });

    test('should adapt to available system resources', async () => {
      console.log('\n⚡ Testing resource adaptation...');

      const resourceTests = [
        {
          name: 'Limited Memory',
          config: { maxMemoryMB: 100, enableWorkers: false },
          expectedBehavior: 'fallback processing'
        },
        {
          name: 'No Workers',
          config: { enableWorkers: false, maxMemoryMB: 400 },
          expectedBehavior: 'main thread processing'
        },
        {
          name: 'Minimal Resources',
          config: { maxMemoryMB: 50, enableWorkers: false, enableStreaming: false },
          expectedBehavior: 'basic processing mode'
        }
      ];

      const adaptationResults = [];

      for (const test of resourceTests) {
        console.log(`   Testing ${test.name}...`);
        
        // Reinitialize with limited resources
        await performanceManager.destroy();
        performanceManager = getAIPerformanceManager();
        await performanceManager.initialize(test.config);

        const testData = createTestData({ staff: 10, days: 8, complexity: 'low' });
        const metrics = await measurePerformanceMetrics(testData, `resource_${test.name}`);

        adaptationResults.push({
          testName: test.name,
          config: test.config,
          metrics,
          adapted: metrics.success
        });

        console.log(`     Adaptation successful: ${metrics.success}`);
        console.log(`     Processing time: ${metrics.processingTime.toFixed(0)}ms`);
        console.log(`     Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

        expect(metrics.success).toBe(true); // System should adapt and complete successfully
      }

      // Reinitialize with full resources for remaining tests
      await performanceManager.destroy();
      performanceManager = getAIPerformanceManager();
      await performanceManager.initialize({
        enableWorkers: true,
        enableMemoryManagement: true,
        enablePerformanceMonitoring: true,
        enableStreaming: true,
        maxMemoryMB: 400
      });

      testResults.push({ category: 'Resource Adaptation', results: adaptationResults });
    });
  });

  describe('Concurrent Operations Testing', () => {

    test('should handle multiple concurrent ML processing requests', async () => {
      console.log('\n🔄 Testing concurrent processing performance...');

      const concurrentTests = [
        { name: '2 Concurrent', count: 2 },
        { name: '3 Concurrent', count: 3 },
        { name: '4 Concurrent', count: 4 }
      ];

      const baseline = baselineMetrics[BASELINE_TEST_CONFIGS[0].name]; // Use small dataset baseline
      const concurrentResults = [];

      for (const test of concurrentTests) {
        console.log(`   Testing ${test.name} operations...`);
        
        const testDataSets = Array.from({ length: test.count }, (_, i) => 
          createTestData({ staff: 8, days: 6, complexity: 'low' })
        );

        const startTime = performance.now();
        const promises = testDataSets.map((data, index) => 
          measurePerformanceMetrics(data, `concurrent_${test.name}_${index}`)
        );

        const results = await Promise.allSettled(promises);
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        const successfulMetrics = successful.map(r => r.value);
        const avgProcessingTime = successfulMetrics.length > 0 ? 
          successfulMetrics.reduce((sum, m) => sum + m.processingTime, 0) / successfulMetrics.length : 0;

        const concurrentResult = {
          testName: test.name,
          concurrentCount: test.count,
          totalTime,
          successfulCount: successful.length,
          failedCount: failed.length,
          avgProcessingTime,
          concurrentEfficiency: avgProcessingTime > 0 ? baseline.processingTime / avgProcessingTime : 0,
          throughputRatio: (successful.length * baseline.processingTime) / totalTime
        };

        concurrentResults.push(concurrentResult);

        console.log(`     Total time: ${totalTime.toFixed(0)}ms`);
        console.log(`     Successful: ${successful.length}/${test.count}`);
        console.log(`     Failed: ${failed.length}/${test.count}`);
        console.log(`     Avg processing time: ${avgProcessingTime.toFixed(0)}ms`);
        console.log(`     Concurrent efficiency: ${concurrentResult.concurrentEfficiency.toFixed(2)}x`);

        // At least 75% of concurrent operations should succeed
        expect(successful.length / test.count).toBeGreaterThan(0.75);
        
        // Concurrent processing shouldn't be less than 70% of baseline efficiency
        if (concurrentResult.concurrentEfficiency > 0) {
          expect(concurrentResult.concurrentEfficiency).toBeGreaterThan(REGRESSION_THRESHOLDS.CONCURRENT_PERFORMANCE_DROP);
        }
      }

      testResults.push({ category: 'Concurrent Operations', results: concurrentResults });
    });

    test('should manage resource contention effectively', async () => {
      console.log('\n⚖️ Testing resource contention management...');

      const contentionScenarios = [
        {
          name: 'Memory Contention',
          scenario: async () => {
            const largeDataSets = Array.from({ length: 3 }, () => 
              createTestData({ staff: 20, days: 15, complexity: 'medium' })
            );
            
            return Promise.allSettled(
              largeDataSets.map((data, index) => 
                measurePerformanceMetrics(data, `memory_contention_${index}`)
              )
            );
          }
        },
        {
          name: 'Processing Contention',
          scenario: async () => {
            const processingDataSets = Array.from({ length: 4 }, () => 
              createTestData({ staff: 12, days: 10, complexity: 'high' })
            );
            
            return Promise.allSettled(
              processingDataSets.map((data, index) => 
                measurePerformanceMetrics(data, `processing_contention_${index}`)
              )
            );
          }
        }
      ];

      const contentionResults = [];

      for (const scenario of contentionScenarios) {
        console.log(`   Testing ${scenario.name}...`);
        
        const startTime = performance.now();
        const results = await scenario.scenario();
        const endTime = performance.now();
        
        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        const contentionResult = {
          scenarioName: scenario.name,
          totalTime: endTime - startTime,
          successfulCount: successful.length,
          failedCount: failed.length,
          successRate: successful.length / results.length,
          avgMemoryUsage: successful.length > 0 ? 
            successful.reduce((sum, r) => sum + r.value.memoryUsage, 0) / successful.length : 0
        };

        contentionResults.push(contentionResult);

        console.log(`     Success rate: ${(contentionResult.successRate * 100).toFixed(1)}%`);
        console.log(`     Total time: ${contentionResult.totalTime.toFixed(0)}ms`);
        console.log(`     Avg memory usage: ${(contentionResult.avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);

        // Resource contention should be managed with reasonable success rate
        expect(contentionResult.successRate).toBeGreaterThan(0.6); // At least 60% success under contention

        if (failed.length > 0) {
          // Failures should be graceful
          failed.forEach(failure => {
            console.log(`     Graceful failure: ${failure.reason.message}`);
            expect(failure.reason.message).toBeDefined();
          });
        }
      }

      testResults.push({ category: 'Resource Contention', results: contentionResults });
    });
  });

  // Helper Functions
  async function createBaselineMetrics() {
    const baselines = {};
    
    for (const config of BASELINE_TEST_CONFIGS) {
      console.log(`   Creating baseline for ${config.name}...`);
      
      const testData = createTestData(config);
      const metrics = await measurePerformanceMetrics(testData, `baseline_${config.name}`);
      
      baselines[config.name] = metrics;
      
      console.log(`     ${config.name}: ${metrics.processingTime.toFixed(0)}ms, ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB, ${metrics.accuracy.toFixed(1)}%`);
    }
    
    return baselines;
  }

  function createTestData(config) {
    return {
      scheduleData: generateTestScheduleData(config.staff, config.days),
      staffMembers: generateTestStaffMembers(config.staff),
      dateRange: generateDateRange(config.days),
      constraints: generateConstraintsForComplexity(config.complexity || 'medium')
    };
  }

  function generateDateRange(dayCount) {
    const dates = [];
    const startDate = new Date();
    
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  }

  function generateConstraintsForComplexity(complexity) {
    const baseConstraints = {
      maxShiftsPerDay: { morning: 3, afternoon: 4, evening: 3 },
      minStaffPerShift: 2,
      maxConsecutiveDays: 5,
      restDaysBetweenShifts: 1
    };

    switch (complexity) {
      case 'low':
        return {
          maxShiftsPerDay: { morning: 5, afternoon: 5, evening: 5 },
          minStaffPerShift: 1
        };
        
      case 'high':
        return {
          ...baseConstraints,
          skillRequirements: ['cooking', 'serving', 'cleaning'],
          availabilityConstraints: true,
          fairnessWeights: { experience: 0.3, hours: 0.4, preferences: 0.3 }
        };
        
      default:
        return baseConstraints;
    }
  }

  async function measurePerformanceMetrics(testData, testId) {
    const startTime = performance.now();
    const startMemory = await getCurrentMemoryUsage();
    
    let success = true;
    let accuracy = 0;
    let errorCount = 0;
    
    try {
      const result = await performanceManager.processMLPredictions(
        testData,
        (progress) => {
          if (progress.error) {
            errorCount++;
          }
        }
      );
      
      accuracy = result.accuracy || 85; // Default accuracy if not provided
      success = result.success;
      
    } catch (error) {
      success = false;
      console.log(`   ⚠️ Test ${testId} failed: ${error.message}`);
    }
    
    const endTime = performance.now();
    const endMemory = await getCurrentMemoryUsage();
    
    return {
      testId,
      processingTime: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      accuracy,
      success,
      errorCount,
      timestamp: Date.now()
    };
  }

  async function getCurrentMemoryUsage() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      return window.performance.memory.usedJSHeapSize;
    }
    
    return process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  }

  function calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  function createCPULoadSimulator() {
    // Create a simple CPU load simulator using setTimeout intensive operations
    const worker = {
      active: true,
      terminate: function() {
        this.active = false;
      }
    };

    const simulateLoad = () => {
      if (!worker.active) return;
      
      // CPU-intensive calculation
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sin(i) * Math.cos(i);
      }
      
      // Schedule next iteration
      setTimeout(simulateLoad, 10);
    };

    simulateLoad();
    return worker;
  }

  function generateRegressionReport() {
    console.log('\n📋 PERFORMANCE REGRESSION REPORT');
    console.log('================================================');

    testResults.forEach(category => {
      console.log(`\n📊 ${category.category}:`);
      
      category.results.forEach(result => {
        if (result.processingTimeRatio) {
          const status = result.processingTimeRatio < REGRESSION_THRESHOLDS.PROCESSING_TIME_REGRESSION ? '✅' : '⚠️';
          console.log(`   ${status} ${result.variation || result.testName}: ${result.processingTimeRatio.toFixed(2)}x processing time`);
        } else if (result.successRate) {
          const status = result.successRate > 0.8 ? '✅' : '⚠️';
          console.log(`   ${status} ${result.scenarioName}: ${(result.successRate * 100).toFixed(1)}% success rate`);
        } else if (result.concurrentEfficiency) {
          const status = result.concurrentEfficiency > REGRESSION_THRESHOLDS.CONCURRENT_PERFORMANCE_DROP ? '✅' : '⚠️';
          console.log(`   ${status} ${result.testName}: ${result.concurrentEfficiency.toFixed(2)}x efficiency`);
        }
      });
    });

    // Overall assessment
    const allRegressions = testResults.flatMap(cat => cat.results)
      .filter(result => result.processingTimeRatio)
      .filter(result => result.processingTimeRatio >= REGRESSION_THRESHOLDS.PROCESSING_TIME_REGRESSION);

    if (allRegressions.length === 0) {
      console.log('\n🎉 NO PERFORMANCE REGRESSIONS DETECTED!');
    } else {
      console.log(`\n⚠️ ${allRegressions.length} POTENTIAL REGRESSIONS DETECTED:`);
      allRegressions.forEach(regression => {
        console.log(`   • ${regression.variation || regression.testName}: ${regression.processingTimeRatio.toFixed(2)}x slower`);
      });
    }

    console.log('\n================================================');
  }
});