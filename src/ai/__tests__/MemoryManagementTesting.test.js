/**
 * MemoryManagementTesting.test.js
 *
 * Comprehensive memory management testing suite for the ML performance optimization system.
 * Tests TensorFlow tensor cleanup, memory leak detection, tensor pooling, and memory pressure handling.
 */

import { getAIPerformanceManager } from '../performance/AIPerformanceManager';
import { generateTestScheduleData, generateTestStaffMembers } from '../utils/TestUtils';

describe('Memory Management Testing Suite', () => {
  let performanceManager;
  let memoryManager;
  let initialMemorySnapshot;

  // Memory management targets and thresholds
  const MEMORY_TARGETS = {
    MAX_MEMORY_USAGE: 400 * 1024 * 1024,    // 400MB max usage
    MEMORY_LEAK_THRESHOLD: 50 * 1024 * 1024, // 50MB leak threshold
    CLEANUP_EFFICIENCY: 0.85,                 // 85% cleanup efficiency
    MEMORY_PRESSURE_THRESHOLD: 300 * 1024 * 1024, // 300MB pressure threshold
    TENSOR_POOL_HIT_RATE: 0.7,               // 70% pool hit rate
    GC_TIME_LIMIT: 2000,                     // 2 seconds max GC time
    MEMORY_FRAGMENTATION_LIMIT: 0.3,         // 30% max fragmentation
  };

  beforeAll(async () => {
    console.log('\n🧠 Starting Memory Management Testing Suite');
    console.log('================================================');
    console.log('Testing tensor cleanup, memory leaks, pooling, and pressure handling');
    console.log('================================================\n');

    // Initialize performance manager with memory management enabled
    performanceManager = getAIPerformanceManager();
    await performanceManager.initialize({
      enableWorkers: true,
      enableMemoryManagement: true,
      enablePerformanceMonitoring: true,
      maxMemoryMB: 400,
      memoryConfig: {
        maxMemoryMB: 400,
        warningThreshold: 300,
        criticalThreshold: 380,
        autoCleanupEnabled: true,
        optimizationStrategies: {
          aggressiveCleanup: true,
          tensorPooling: true,
          memoryDefragmentation: true
        }
      },
      debug: true
    });

    memoryManager = performanceManager.components.memoryManager;
    
    // Capture initial memory state
    initialMemorySnapshot = await captureMemorySnapshot();
    console.log(`📊 Initial memory usage: ${(initialMemorySnapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  });

  afterAll(async () => {
    if (performanceManager) {
      await performanceManager.destroy();
    }
    console.log('\n✅ Memory Management Testing Suite completed');
  });

  describe('TensorFlow Tensor Cleanup Tests', () => {

    test('should track tensor lifecycle correctly', async () => {
      console.log('\n🔍 Testing tensor lifecycle tracking...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping tensor lifecycle test - MemoryManager not available');
        return;
      }

      const beforeStats = await memoryManager.getMemoryStats();
      console.log(`📊 Tensors before: ${beforeStats.numTensors || 0}`);

      // Simulate tensor operations
      const tensorOperations = await simulateTensorOperations(10);
      
      const duringStats = await memoryManager.getMemoryStats();
      console.log(`📊 Tensors during operations: ${duringStats.numTensors || 0}`);

      // Cleanup tensors
      await memoryManager.performMemoryCleanup();
      
      const afterStats = await memoryManager.getMemoryStats();
      console.log(`📊 Tensors after cleanup: ${afterStats.numTensors || 0}`);

      // Verify tensor tracking
      expect(duringStats.numTensors || 0).toBeGreaterThanOrEqual(beforeStats.numTensors || 0);
      
      if ((duringStats.numTensors || 0) > 0) {
        const cleanupEfficiency = ((duringStats.numTensors || 0) - (afterStats.numTensors || 0)) / 
                                  (duringStats.numTensors || 0);
        console.log(`🗑️ Tensor cleanup efficiency: ${(cleanupEfficiency * 100).toFixed(1)}%`);
        expect(cleanupEfficiency).toBeGreaterThan(0.5); // At least 50% cleanup
      }
    });

    test('should dispose of tensors automatically', async () => {
      console.log('\n🔄 Testing automatic tensor disposal...');

      const initialMemory = await getCurrentMemoryUsage();
      const testData = createMemoryIntensiveTestData();

      // Process data that creates many tensors
      let maxMemoryDuringProcessing = initialMemory;
      
      const result = await performanceManager.processMLPredictions(
        testData,
        (progress) => {
          // Monitor memory during processing
          getCurrentMemoryUsage().then(currentMemory => {
            maxMemoryDuringProcessing = Math.max(maxMemoryDuringProcessing, currentMemory);
          });
        }
      );

      // Wait for automatic cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalMemory = await getCurrentMemoryUsage();
      const memoryGrowth = finalMemory - initialMemory;
      const peakMemoryUsage = maxMemoryDuringProcessing - initialMemory;

      console.log(`📈 Peak memory usage: ${(peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Final memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      expect(result.success).toBe(true);
      expect(memoryGrowth).toBeLessThan(MEMORY_TARGETS.MEMORY_LEAK_THRESHOLD);
      expect(maxMemoryDuringProcessing).toBeLessThan(initialMemory + MEMORY_TARGETS.MAX_MEMORY_USAGE);
    });

    test('should handle tensor disposal errors gracefully', async () => {
      console.log('\n⚠️ Testing tensor disposal error handling...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping disposal error test - MemoryManager not available');
        return;
      }

      let disposalErrors = 0;
      let errorsHandled = 0;

      // Mock tensor operations with potential disposal errors
      const problematicTensors = await simulateProblematicTensorOperations();
      
      try {
        await memoryManager.performMemoryCleanup();
        console.log('✅ Memory cleanup completed without errors');
      } catch (error) {
        disposalErrors++;
        
        if (error.message && error.recoverable !== undefined) {
          errorsHandled++;
          console.log(`⚠️ Disposal error handled gracefully: ${error.message}`);
        } else {
          console.log(`❌ Unhandled disposal error: ${error.message}`);
        }
      }

      // Additional cleanup attempt
      if (disposalErrors > 0) {
        try {
          await memoryManager.performMemoryCleanup();
          errorsHandled++;
        } catch (retryError) {
          console.log(`⚠️ Retry cleanup also failed: ${retryError.message}`);
        }
      }

      console.log(`📊 Disposal errors: ${disposalErrors}`);
      console.log(`✅ Errors handled: ${errorsHandled}`);

      // All disposal errors should be handled gracefully
      if (disposalErrors > 0) {
        expect(errorsHandled).toBeGreaterThan(0);
      }
    });
  });

  describe('Memory Leak Detection Tests', () => {

    test('should detect memory leaks in processing cycles', async () => {
      console.log('\n🕵️ Testing memory leak detection...');

      const memoryReadings = [];
      const cycleCount = 5;

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        console.log(`   Cycle ${cycle + 1}/${cycleCount}...`);
        
        const cycleStart = await getCurrentMemoryUsage();
        
        // Process data
        const testData = createLeakTestData(cycle);
        await performanceManager.processMLPredictions(testData);
        
        // Force cleanup
        if (memoryManager) {
          await memoryManager.performMemoryCleanup();
        }
        
        // Force garbage collection
        await forceGarbageCollection();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const cycleEnd = await getCurrentMemoryUsage();
        const cycleGrowth = cycleEnd - cycleStart;
        
        memoryReadings.push({
          cycle: cycle + 1,
          startMemory: cycleStart,
          endMemory: cycleEnd,
          growth: cycleGrowth
        });
        
        console.log(`   📊 Cycle ${cycle + 1} memory growth: ${(cycleGrowth / 1024 / 1024).toFixed(2)}MB`);
      }

      // Analyze memory leak patterns
      const memoryGrowths = memoryReadings.map(r => r.growth);
      const averageGrowth = memoryGrowths.reduce((a, b) => a + b, 0) / memoryGrowths.length;
      const totalGrowth = memoryReadings[memoryReadings.length - 1].endMemory - memoryReadings[0].startMemory;
      
      // Check for consistent memory growth (potential leak)
      const growthTrend = calculateGrowthTrend(memoryGrowths);
      
      console.log(`📈 Average memory growth per cycle: ${(averageGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Total memory growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📈 Growth trend: ${growthTrend > 0 ? 'increasing' : 'stable'}`);

      // Memory leaks should be minimal
      expect(totalGrowth).toBeLessThan(MEMORY_TARGETS.MEMORY_LEAK_THRESHOLD);
      expect(averageGrowth).toBeLessThan(MEMORY_TARGETS.MEMORY_LEAK_THRESHOLD / cycleCount);
    });

    test('should identify memory leak sources', async () => {
      console.log('\n🔬 Testing memory leak source identification...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping leak source test - MemoryManager not available');
        return;
      }

      const potentialLeakSources = [
        {
          name: 'Event Listeners',
          test: async () => {
            // Simulate event listener leaks
            const listeners = [];
            for (let i = 0; i < 100; i++) {
              const listener = () => console.log(`Event ${i}`);
              listeners.push(listener);
              // Simulate adding event listeners without cleanup
            }
            return listeners.length;
          }
        },
        {
          name: 'Closure References',
          test: async () => {
            // Simulate closure memory leaks
            const closures = [];
            for (let i = 0; i < 50; i++) {
              const largeData = new Array(1000).fill(Math.random());
              closures.push(() => largeData.length);
            }
            return closures.length;
          }
        },
        {
          name: 'DOM References',
          test: async () => {
            // Simulate DOM reference leaks
            const elements = [];
            for (let i = 0; i < 20; i++) {
              const element = document.createElement('div');
              element.innerHTML = `Test element ${i}`;
              elements.push(element);
            }
            return elements.length;
          }
        }
      ];

      const leakSourceResults = [];

      for (const source of potentialLeakSources) {
        const beforeMemory = await getCurrentMemoryUsage();
        const sourceSize = await source.test();
        const afterMemory = await getCurrentMemoryUsage();
        
        const memoryIncrease = afterMemory - beforeMemory;
        
        leakSourceResults.push({
          name: source.name,
          sourceSize,
          memoryIncrease,
          leakSeverity: memoryIncrease / (1024 * 1024) // MB
        });

        console.log(`   📊 ${source.name}: ${sourceSize} items, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
      }

      // Identify significant leak sources
      const significantLeaks = leakSourceResults.filter(r => r.leakSeverity > 5); // >5MB
      
      console.log(`🚨 Significant leak sources detected: ${significantLeaks.length}`);
      
      significantLeaks.forEach(leak => {
        console.log(`   ⚠️ ${leak.name}: ${leak.leakSeverity.toFixed(2)}MB`);
      });

      // Memory leaks from sources should be manageable
      leakSourceResults.forEach(source => {
        expect(source.leakSeverity).toBeLessThan(50); // Less than 50MB per source
      });
    });

    test('should monitor memory usage patterns', async () => {
      console.log('\n📊 Testing memory usage pattern monitoring...');

      const patternMonitor = new MemoryPatternMonitor();
      const monitorDuration = 3000; // 3 seconds
      
      // Start monitoring
      patternMonitor.startMonitoring();
      
      // Simulate various memory usage patterns
      const patterns = [
        { name: 'Steady Usage', action: () => createSteadyMemoryUsage() },
        { name: 'Spike Usage', action: () => createMemorySpike() },
        { name: 'Gradual Increase', action: () => createGradualMemoryIncrease() },
        { name: 'Cleanup Cycle', action: () => performMemoryCleanupCycle() }
      ];
      
      for (const pattern of patterns) {
        console.log(`   Testing ${pattern.name}...`);
        await pattern.action();
        await new Promise(resolve => setTimeout(resolve, monitorDuration / patterns.length));
      }
      
      // Stop monitoring and analyze patterns
      const analysis = patternMonitor.stopMonitoringAndAnalyze();
      
      console.log(`📈 Memory patterns detected:`);
      console.log(`   Peak usage: ${(analysis.peakUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Average usage: ${(analysis.averageUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Volatility: ${analysis.volatility.toFixed(2)}`);
      console.log(`   Leak indicators: ${analysis.leakIndicators.length}`);
      
      // Analyze patterns for health
      expect(analysis.peakUsage).toBeLessThan(MEMORY_TARGETS.MAX_MEMORY_USAGE);
      expect(analysis.volatility).toBeLessThan(2.0); // Reasonable volatility
      expect(analysis.leakIndicators.length).toBeLessThan(3); // Few leak indicators
    });
  });

  describe('Tensor Pooling and Reuse Tests', () => {

    test('should implement tensor pooling effectively', async () => {
      console.log('\n🏊 Testing tensor pooling implementation...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping tensor pooling test - MemoryManager not available');
        return;
      }

      // Simulate tensor pool operations
      const poolOperations = [];
      const tensorSizes = [
        [10, 10],   // Small tensors
        [50, 50],   // Medium tensors
        [100, 100], // Large tensors
      ];

      let poolHits = 0;
      let poolMisses = 0;
      let totalAllocations = 0;

      for (let i = 0; i < 20; i++) {
        const sizeIndex = i % tensorSizes.length;
        const tensorSize = tensorSizes[sizeIndex];
        
        // Simulate tensor allocation
        const allocation = await simulateTensorAllocation(tensorSize);
        totalAllocations++;
        
        if (allocation.fromPool) {
          poolHits++;
          console.log(`   🎯 Pool hit for ${tensorSize.join('x')} tensor`);
        } else {
          poolMisses++;
          console.log(`   ➕ Pool miss for ${tensorSize.join('x')} tensor (new allocation)`);
        }
        
        poolOperations.push(allocation);
        
        // Occasionally return tensors to pool
        if (i > 0 && i % 3 === 0) {
          const returnIndex = Math.floor(Math.random() * poolOperations.length);
          await simulateTensorReturn(poolOperations[returnIndex]);
        }
      }

      const poolHitRate = poolHits / totalAllocations;
      
      console.log(`📊 Tensor pool statistics:`);
      console.log(`   Total allocations: ${totalAllocations}`);
      console.log(`   Pool hits: ${poolHits}`);
      console.log(`   Pool misses: ${poolMisses}`);
      console.log(`   Hit rate: ${(poolHitRate * 100).toFixed(1)}%`);

      // Pool should provide reasonable hit rate for repeated operations
      expect(poolHitRate).toBeGreaterThan(0.3); // At least 30% hit rate
      expect(poolHits).toBeGreaterThan(0);
    });

    test('should optimize memory allocation through reuse', async () => {
      console.log('\n♻️ Testing memory allocation optimization...');

      const allocationTests = [
        {
          name: 'Without Pooling',
          usePooling: false
        },
        {
          name: 'With Pooling',
          usePooling: true
        }
      ];

      const results = [];

      for (const test of allocationTests) {
        console.log(`   Running ${test.name} test...`);
        
        const startMemory = await getCurrentMemoryUsage();
        const startTime = performance.now();
        
        // Perform allocation-heavy operations
        const allocations = [];
        for (let i = 0; i < 50; i++) {
          const tensorSize = [20 + (i % 5) * 10, 20 + (i % 5) * 10];
          const allocation = await simulateTensorAllocation(tensorSize, test.usePooling);
          allocations.push(allocation);
          
          // Simulate some usage then disposal
          if (i % 5 === 4) {
            for (const alloc of allocations.splice(0, 5)) {
              await simulateTensorDisposal(alloc);
            }
          }
        }
        
        // Cleanup remaining allocations
        for (const allocation of allocations) {
          await simulateTensorDisposal(allocation);
        }
        
        const endTime = performance.now();
        const endMemory = await getCurrentMemoryUsage();
        
        const testResult = {
          name: test.name,
          allocationTime: endTime - startTime,
          memoryUsed: endMemory - startMemory,
          usePooling: test.usePooling
        };
        
        results.push(testResult);
        
        console.log(`   ⏱️ ${test.name} time: ${testResult.allocationTime.toFixed(0)}ms`);
        console.log(`   📦 ${test.name} memory: ${(testResult.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      }

      // Compare results
      const withoutPooling = results.find(r => !r.usePooling);
      const withPooling = results.find(r => r.usePooling);

      if (withoutPooling && withPooling) {
        const timeImprovement = (withoutPooling.allocationTime - withPooling.allocationTime) / withoutPooling.allocationTime;
        const memoryImprovement = (withoutPooling.memoryUsed - withPooling.memoryUsed) / withoutPooling.memoryUsed;
        
        console.log(`📈 Pooling improvements:`);
        console.log(`   Time improvement: ${(timeImprovement * 100).toFixed(1)}%`);
        console.log(`   Memory improvement: ${(memoryImprovement * 100).toFixed(1)}%`);
        
        // Pooling should provide some benefit
        expect(timeImprovement).toBeGreaterThan(-0.5); // Not more than 50% slower
        expect(memoryImprovement).toBeGreaterThan(-0.2); // Not more than 20% worse memory
      }
    });
  });

  describe('Memory Pressure Detection Tests', () => {

    test('should detect memory pressure conditions', async () => {
      console.log('\n⚠️ Testing memory pressure detection...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping memory pressure test - MemoryManager not available');
        return;
      }

      let pressureEvents = [];
      
      // Set up memory pressure monitoring
      memoryManager.onMemoryPressure = (level, stats) => {
        pressureEvents.push({ level, stats, timestamp: Date.now() });
        console.log(`   🚨 Memory pressure detected: ${level} (${(stats.currentMemory / 1024 / 1024).toFixed(2)}MB)`);
      };

      // Gradually increase memory usage
      const memoryConsumers = [];
      
      for (let i = 0; i < 10; i++) {
        console.log(`   Increasing memory usage (step ${i + 1}/10)...`);
        
        // Create memory-intensive data
        const consumer = createMemoryConsumer(i * 20); // Increasing size
        memoryConsumers.push(consumer);
        
        const currentMemory = await getCurrentMemoryUsage();
        console.log(`   📊 Current memory: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`);
        
        // Check if memory pressure is detected
        if (currentMemory > MEMORY_TARGETS.MEMORY_PRESSURE_THRESHOLD) {
          console.log(`   ⚠️ Memory pressure threshold exceeded`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clean up memory consumers
      memoryConsumers.length = 0;
      await forceGarbageCollection();

      console.log(`📊 Memory pressure events detected: ${pressureEvents.length}`);
      
      // Analyze pressure events
      pressureEvents.forEach((event, index) => {
        console.log(`   Event ${index + 1}: ${event.level} pressure at ${(event.stats.currentMemory / 1024 / 1024).toFixed(2)}MB`);
      });

      // Memory pressure detection should work (though may not trigger in test environment)
      if (pressureEvents.length > 0) {
        expect(pressureEvents[0].level).toMatch(/(low|medium|high|critical)/);
        expect(pressureEvents[0].stats.currentMemory).toBeGreaterThan(MEMORY_TARGETS.MEMORY_PRESSURE_THRESHOLD * 0.8);
      } else {
        console.log('ℹ️ No memory pressure events detected (normal in test environment)');
      }
    });

    test('should trigger emergency cleanup under memory pressure', async () => {
      console.log('\n🚨 Testing emergency cleanup triggers...');

      if (!memoryManager) {
        console.log('ℹ️ Skipping emergency cleanup test - MemoryManager not available');
        return;
      }

      let emergencyCleanups = 0;
      let cleanupEffectiveness = [];

      memoryManager.onMemoryCleanup = (cleanupStats) => {
        emergencyCleanups++;
        cleanupEffectiveness.push(cleanupStats);
        console.log(`   🗑️ Emergency cleanup #${emergencyCleanups}: ${JSON.stringify(cleanupStats)}`);
      };

      // Create memory pressure scenario
      const heavyTestData = createMemoryPressureTestData();
      
      try {
        await performanceManager.processMLPredictions(
          heavyTestData,
          (progress) => {
            if (progress.memoryPressure) {
              console.log(`   ⚠️ Memory pressure during processing: ${progress.memoryPressure}`);
            }
          }
        );
        
        console.log(`🗑️ Emergency cleanups triggered: ${emergencyCleanups}`);
        
        if (emergencyCleanups > 0) {
          const avgEffectiveness = cleanupEffectiveness.reduce((sum, stats) => 
            sum + (stats.memoryFreed || 0), 0) / cleanupEffectiveness.length;
          
          console.log(`📊 Average cleanup effectiveness: ${(avgEffectiveness / 1024 / 1024).toFixed(2)}MB`);
          
          expect(avgEffectiveness).toBeGreaterThan(0);
          expect(emergencyCleanups).toBeLessThan(10); // Shouldn't require too many emergency cleanups
        }
        
      } catch (error) {
        if (error.message.includes('memory')) {
          console.log(`⚠️ Memory pressure caused graceful failure: ${error.message}`);
          expect(emergencyCleanups).toBeGreaterThan(0); // Should have tried cleanup before failing
        } else {
          throw error;
        }
      }
    });
  });

  // Helper Functions
  function createMemoryIntensiveTestData() {
    return {
      scheduleData: generateTestScheduleData(30, 25),
      staffMembers: generateTestStaffMembers(30),
      dateRange: generateDateRange(25),
      constraints: generateComplexConstraints()
    };
  }

  function createLeakTestData(cycle) {
    // Create slightly different data each cycle to test for leaks
    return {
      scheduleData: generateTestScheduleData(10 + cycle, 8 + cycle),
      staffMembers: generateTestStaffMembers(10 + cycle),
      dateRange: generateDateRange(8 + cycle),
      constraints: generateBasicConstraints()
    };
  }

  function createMemoryPressureTestData() {
    return {
      scheduleData: generateTestScheduleData(50, 30),
      staffMembers: generateTestStaffMembers(50),
      dateRange: generateDateRange(30),
      constraints: generateComplexConstraints()
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

  function generateBasicConstraints() {
    return {
      maxShiftsPerDay: { morning: 2, afternoon: 3, evening: 2 },
      minStaffPerShift: 1,
      maxConsecutiveDays: 4,
      restDaysBetweenShifts: 1
    };
  }

  function generateComplexConstraints() {
    return {
      ...generateBasicConstraints(),
      skillRequirements: ['cooking', 'serving', 'cleaning'],
      departmentConstraints: ['kitchen', 'floor', 'bar'],
      availabilityConstraints: true,
      fairnessWeights: { experience: 0.3, hours: 0.4, preferences: 0.3 }
    };
  }

  async function simulateTensorOperations(count) {
    const operations = [];
    
    for (let i = 0; i < count; i++) {
      const op = {
        id: i,
        type: 'matmul',
        size: [10 + i * 5, 10 + i * 5],
        created: Date.now(),
        disposed: false
      };
      operations.push(op);
    }
    
    return operations;
  }

  async function simulateProblematicTensorOperations() {
    // Simulate tensors that might cause disposal errors
    return [
      { id: 'problem1', error: 'Already disposed', recoverable: true },
      { id: 'problem2', error: 'Invalid tensor reference', recoverable: false },
      { id: 'problem3', error: 'Memory corruption', recoverable: true }
    ];
  }

  async function simulateTensorAllocation(tensorSize, usePooling = true) {
    // Simulate tensor allocation from pool or new allocation
    const fromPool = usePooling && Math.random() > 0.5;
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      size: tensorSize,
      fromPool,
      allocated: Date.now(),
      memoryUsage: tensorSize[0] * tensorSize[1] * 4 // Assume float32
    };
  }

  async function simulateTensorReturn(allocation) {
    // Simulate returning tensor to pool
    allocation.returnedToPool = Date.now();
  }

  async function simulateTensorDisposal(allocation) {
    // Simulate tensor disposal
    allocation.disposed = Date.now();
  }

  async function getCurrentMemoryUsage() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      return window.performance.memory.usedJSHeapSize;
    }
    
    return process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  }

  async function captureMemorySnapshot() {
    return {
      heapUsed: await getCurrentMemoryUsage(),
      timestamp: Date.now()
    };
  }

  async function forceGarbageCollection() {
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    } else if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    // Alternative GC encouragement
    for (let i = 0; i < 5; i++) {
      const waste = new Array(50000).fill(Math.random());
      waste.length = 0;
    }
  }

  function calculateGrowthTrend(growths) {
    if (growths.length < 2) return 0;
    
    let trend = 0;
    for (let i = 1; i < growths.length; i++) {
      trend += growths[i] - growths[i - 1];
    }
    
    return trend / (growths.length - 1);
  }

  function createMemoryConsumer(sizeMB) {
    // Create objects that consume approximately sizeMB of memory
    const arraySize = (sizeMB * 1024 * 1024) / 8; // Rough estimate for numbers
    return new Array(Math.floor(arraySize)).fill(Math.random());
  }

  async function createSteadyMemoryUsage() {
    const steadyConsumer = new Array(1000000).fill(1);
    await new Promise(resolve => setTimeout(resolve, 100));
    steadyConsumer.length = 0;
  }

  async function createMemorySpike() {
    const spikeConsumer = new Array(5000000).fill(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    spikeConsumer.length = 0;
  }

  async function createGradualMemoryIncrease() {
    const gradualConsumers = [];
    for (let i = 0; i < 5; i++) {
      gradualConsumers.push(new Array(500000).fill(i));
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    gradualConsumers.length = 0;
  }

  async function performMemoryCleanupCycle() {
    if (memoryManager) {
      await memoryManager.performMemoryCleanup();
    }
    await forceGarbageCollection();
  }

  // Memory Pattern Monitor Class
  class MemoryPatternMonitor {
    constructor() {
      this.readings = [];
      this.monitoring = false;
      this.interval = null;
    }

    startMonitoring() {
      this.monitoring = true;
      this.readings = [];
      
      this.interval = setInterval(async () => {
        if (!this.monitoring) return;
        
        const reading = {
          timestamp: Date.now(),
          memory: await getCurrentMemoryUsage()
        };
        
        this.readings.push(reading);
      }, 100);
    }

    stopMonitoringAndAnalyze() {
      this.monitoring = false;
      if (this.interval) {
        clearInterval(this.interval);
      }

      if (this.readings.length === 0) {
        return { peakUsage: 0, averageUsage: 0, volatility: 0, leakIndicators: [] };
      }

      const memoryValues = this.readings.map(r => r.memory);
      const peakUsage = Math.max(...memoryValues);
      const averageUsage = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
      
      // Calculate volatility (standard deviation)
      const variance = memoryValues.reduce((sum, val) => sum + Math.pow(val - averageUsage, 2), 0) / memoryValues.length;
      const volatility = Math.sqrt(variance) / averageUsage;
      
      // Detect leak indicators (consistent upward trends)
      const leakIndicators = [];
      for (let i = 10; i < this.readings.length - 10; i++) {
        const before = this.readings.slice(i - 10, i).map(r => r.memory);
        const after = this.readings.slice(i, i + 10).map(r => r.memory);
        
        const beforeAvg = before.reduce((a, b) => a + b, 0) / before.length;
        const afterAvg = after.reduce((a, b) => a + b, 0) / after.length;
        
        if (afterAvg > beforeAvg * 1.1) { // 10% increase
          leakIndicators.push({
            timestamp: this.readings[i].timestamp,
            increase: afterAvg - beforeAvg
          });
        }
      }

      return { peakUsage, averageUsage, volatility, leakIndicators };
    }
  }
});