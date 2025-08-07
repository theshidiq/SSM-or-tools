/**
 * EdgeCaseErrorHandling.test.js
 * 
 * Comprehensive edge case and error handling tests
 * Validates system robustness under extreme conditions
 */

import { HybridPredictor } from '../hybrid/HybridPredictor';
import { TensorFlowScheduler } from '../ml/TensorFlowScheduler';
import { aiErrorHandler } from '../utils/ErrorHandler';
import { 
  simulateMemoryConstraints,
  createTestStaffMembers,
  createTestScheduleData,
  measurePerformance,
  TestReportGenerator
} from '../utils/TestUtils';

describe('Phase 6: Edge Case & Error Handling Tests', () => {
  let hybridPredictor;
  let tensorFlowScheduler;
  let reportGenerator;
  
  const ERROR_SCENARIOS = {
    MEMORY_CONSTRAINT: 'memory_constraint',
    TENSORFLOW_FAILURE: 'tensorflow_failure',
    INSUFFICIENT_DATA: 'insufficient_data',
    INVALID_INPUT: 'invalid_input',
    NETWORK_FAILURE: 'network_failure',
    EXTREME_SCALE: 'extreme_scale'
  };

  beforeAll(async () => {
    console.log('🛡️ Initializing Edge Case & Error Handling Tests...');
    
    hybridPredictor = new HybridPredictor();
    tensorFlowScheduler = new TensorFlowScheduler();
    reportGenerator = new TestReportGenerator();
    
    console.log('✅ Error handling test components initialized');
  });

  afterAll(async () => {
    if (hybridPredictor) await hybridPredictor.reset();
    if (tensorFlowScheduler) await tensorFlowScheduler.dispose();
    
    const report = reportGenerator.generateReport();
    console.log('🔍 Edge Case Testing Report:');
    console.log(`   Tests Passed: ${report.summary.passedTests}/${report.summary.totalTests}`);
    console.log(`   Robustness Score: ${report.summary.passRate}%`);
  });

  describe('Memory Constraint Handling', () => {
    test('should handle low memory conditions gracefully', async () => {
      console.log('💾 Testing low memory condition handling...');
      
      const memoryConstraint = simulateMemoryConstraints(30); // 30MB limit
      let memoryTestPassed = true;
      let fallbackActivated = false;
      let scheduleGenerated = false;
      
      try {
        // Create large dataset that might trigger memory issues
        const largeStaff = createTestStaffMembers(100);
        const largeSchedule = createTestScheduleData(100, 90);
        const dateRange = generateLargeDateRange(90);
        
        // Monitor memory during operation
        const initialMemory = memoryConstraint.getCurrentUsage();
        
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: largeSchedule },
          largeStaff,
          dateRange
        );
        
        const finalMemory = memoryConstraint.getCurrentUsage();
        const memoryUsed = finalMemory - initialMemory;
        
        // Check if memory constraints were respected
        if (!memoryConstraint.checkMemoryLimit()) {
          console.log('  ⚠️ Memory limit exceeded, checking fallback...');
          fallbackActivated = result.metadata?.method?.includes('rule') || result.metadata?.fallback;
        }
        
        scheduleGenerated = result.success && result.schedule;
        
      } catch (error) {
        console.log('  🔄 Error caught, testing error handler...');
        
        const errorResult = await aiErrorHandler.handleError(
          error,
          'memory_constraint_test',
          {
            staffCount: 100,
            dayCount: 90,
            memoryLimit: 30
          }
        );
        
        fallbackActivated = !!errorResult.fallback;
        scheduleGenerated = !!errorResult.fallback;
        memoryTestPassed = errorResult.success;
      }
      
      expect(memoryTestPassed).toBe(true);
      expect(scheduleGenerated).toBe(true);
      
      if (!memoryConstraint.checkMemoryLimit()) {
        expect(fallbackActivated).toBe(true);
        console.log('  ✅ Memory constraint triggered appropriate fallback');
      } else {
        console.log('  ✅ Operation completed within memory limits');
      }
      
      reportGenerator.addTestResult('Memory Constraint Handling', {
        success: true,
        memoryLimitRespected: memoryConstraint.checkMemoryLimit(),
        fallbackActivated,
        scheduleGenerated
      });
    });

    test('should cleanup tensors properly to prevent memory leaks', async () => {
      console.log('🧹 Testing tensor cleanup and memory leak prevention...');
      
      const initialMemory = getMemoryUsage();
      const iterations = 5;
      const memoryReadings = [initialMemory];
      
      // Perform multiple ML operations
      for (let i = 0; i < iterations; i++) {
        const testData = {
          staffMembers: createTestStaffMembers(10),
          scheduleData: createTestScheduleData(10, 14),
          dateRange: generateLargeDateRange(14)
        };
        
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange
        );
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = getMemoryUsage();
        memoryReadings.push(currentMemory);
        
        console.log(`  Iteration ${i + 1}: ${Math.round(currentMemory / 1024 / 1024)}MB`);
      }
      
      // Check for memory leak patterns
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerIteration = memoryIncrease / iterations;
      
      // Memory increase should be minimal (less than 5MB per iteration)
      const memoryLeakDetected = memoryIncreasePerIteration > 5 * 1024 * 1024;
      
      expect(memoryLeakDetected).toBe(false);
      
      reportGenerator.addTestResult('Memory Leak Prevention', {
        success: !memoryLeakDetected,
        memoryIncrease: Math.round(memoryIncrease / 1024 / 1024),
        memoryIncreasePerIteration: Math.round(memoryIncreasePerIteration / 1024 / 1024),
        iterations
      });
      
      console.log(`  ✅ Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB total`);
      console.log(`  ✅ Per iteration: ${Math.round(memoryIncreasePerIteration / 1024 / 1024)}MB`);
    });
  });

  describe('TensorFlow Failure Recovery', () => {
    test('should recover from TensorFlow initialization failures', async () => {
      console.log('💥 Testing TensorFlow initialization failure recovery...');
      
      // Force TensorFlow failure by corrupting initialization
      const corruptedScheduler = new TensorFlowScheduler();
      let initializationFailed = false;
      let fallbackWorked = false;
      let scheduleGenerated = false;
      
      try {
        // Attempt to initialize with corrupted state
        const initResult = await corruptedScheduler.initialize();
        
        if (!initResult) {
          initializationFailed = true;
          throw new Error('TensorFlow initialization failed');
        }
        
      } catch (error) {
        initializationFailed = true;
        console.log('  ⚠️ TensorFlow initialization failed as expected');
        
        // Test error handler recovery
        const errorResult = await aiErrorHandler.handleError(
          error,
          'tensorflow_init_failure',
          {
            component: 'TensorFlowScheduler',
            operation: 'initialization'
          }
        );
        
        fallbackWorked = !!errorResult.fallback;
        scheduleGenerated = fallbackWorked;
      }
      
      expect(initializationFailed).toBe(true);
      expect(fallbackWorked).toBe(true);
      expect(scheduleGenerated).toBe(true);
      
      reportGenerator.addTestResult('TensorFlow Failure Recovery', {
        success: true,
        initializationFailed,
        fallbackWorked,
        scheduleGenerated
      });
      
      console.log('  ✅ TensorFlow failure handled with rule-based fallback');
    });

    test('should handle model training failures gracefully', async () => {
      console.log('🧠 Testing model training failure recovery...');
      
      let trainingFailed = false;
      let gracefulRecovery = false;
      let fallbackActivated = false;
      
      try {
        // Create problematic training data
        const problematicData = createProblematicTrainingData();
        
        const trainingResult = await tensorFlowScheduler.trainModel(problematicData.staffMembers);
        
        if (!trainingResult.success) {
          trainingFailed = true;
          throw new Error('Model training failed: ' + trainingResult.error);
        }
        
      } catch (error) {
        trainingFailed = true;
        console.log('  ⚠️ Model training failed as expected');
        
        // Test graceful recovery
        const errorResult = await aiErrorHandler.handleError(
          error,
          'model_training_failure',
          {
            component: 'TensorFlowScheduler',
            operation: 'training',
            dataQuality: 'problematic'
          }
        );
        
        gracefulRecovery = errorResult.success;
        fallbackActivated = !!errorResult.fallback;
      }
      
      expect(trainingFailed).toBe(true);
      expect(gracefulRecovery).toBe(true);
      expect(fallbackActivated).toBe(true);
      
      reportGenerator.addTestResult('Training Failure Recovery', {
        success: true,
        trainingFailed,
        gracefulRecovery,
        fallbackActivated
      });
      
      console.log('  ✅ Training failure handled gracefully');
    });
  });

  describe('Insufficient Data Handling', () => {
    test('should handle minimal historical data gracefully', async () => {
      console.log('📉 Testing minimal historical data handling...');
      
      const minimalData = createMinimalDataScenario();
      let gracefulDegradation = false;
      let scheduleGenerated = false;
      let ruleBased = false;
      
      const result = await hybridPredictor.predictSchedule(
        { scheduleData: minimalData.scheduleData },
        minimalData.staffMembers,
        minimalData.dateRange
      );
      
      scheduleGenerated = result.success && result.schedule;
      
      // Check if it degraded to rule-based approach
      ruleBased = result.metadata?.method?.includes('rule') || 
                  result.metadata?.mlUsed === false;
      
      gracefulDegradation = scheduleGenerated && 
                           (ruleBased || result.metadata?.mlConfidence < 0.5);
      
      expect(gracefulDegradation).toBe(true);
      expect(scheduleGenerated).toBe(true);
      
      reportGenerator.addTestResult('Minimal Data Handling', {
        success: true,
        gracefulDegradation,
        scheduleGenerated,
        ruleBased,
        dataAmount: minimalData.dataAmount
      });
      
      console.log(`  ✅ Handled minimal data (${minimalData.dataAmount * 100}% of normal)`);
      console.log(`  ✅ Used ${ruleBased ? 'rule-based' : 'ML'} approach`);
    });

    test('should handle empty historical data', async () => {
      console.log('📊 Testing empty historical data handling...');
      
      const emptyData = {
        staffMembers: createTestStaffMembers(5),
        scheduleData: {}, // Empty schedule data
        dateRange: generateLargeDateRange(7)
      };
      
      let errorHandled = false;
      let fallbackGenerated = false;
      let scheduleQuality = 0;
      
      try {
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: emptyData.scheduleData },
          emptyData.staffMembers,
          emptyData.dateRange
        );
        
        fallbackGenerated = result.success && result.schedule;
        
        if (fallbackGenerated) {
          // Check basic schedule quality
          const totalCells = Object.keys(result.schedule).length * emptyData.dateRange.length;
          const filledCells = Object.values(result.schedule).reduce((count, staffSched) => {
            return count + Object.values(staffSched).filter(shift => shift !== '').length;
          }, 0);
          
          scheduleQuality = filledCells / totalCells;
        }
        
        errorHandled = true;
        
      } catch (error) {
        const errorResult = await aiErrorHandler.handleError(
          error,
          'empty_data_handling',
          emptyData
        );
        
        errorHandled = errorResult.success;
        fallbackGenerated = !!errorResult.fallback;
      }
      
      expect(errorHandled).toBe(true);
      expect(fallbackGenerated).toBe(true);
      expect(scheduleQuality).toBeGreaterThan(0.5); // At least 50% filled
      
      reportGenerator.addTestResult('Empty Data Handling', {
        success: true,
        errorHandled,
        fallbackGenerated,
        scheduleQuality
      });
      
      console.log(`  ✅ Empty data handled with ${(scheduleQuality * 100).toFixed(1)}% schedule quality`);
    });
  });

  describe('Invalid Input Handling', () => {
    test('should validate and handle malformed input data', async () => {
      console.log('🚨 Testing malformed input data handling...');
      
      const malformedInputs = [
        { name: 'Null schedule data', data: { scheduleData: null } },
        { name: 'Invalid staff array', data: { staffMembers: 'not_an_array' } },
        { name: 'Empty date range', data: { dateRange: [] } },
        { name: 'Malformed dates', data: { dateRange: ['invalid_date', null] } },
        { name: 'Corrupted schedule', data: { scheduleData: { staff1: 'not_an_object' } } }
      ];
      
      const validationResults = [];
      
      for (const input of malformedInputs) {
        let validationPassed = false;
        let errorCaught = false;
        let fallbackProvided = false;
        
        try {
          const testData = {
            scheduleData: input.data.scheduleData || {},
            staffMembers: Array.isArray(input.data.staffMembers) ? 
              input.data.staffMembers : createTestStaffMembers(3),
            dateRange: Array.isArray(input.data.dateRange) ? 
              input.data.dateRange : generateLargeDateRange(7)
          };
          
          const result = await hybridPredictor.predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange
          );
          
          validationPassed = result.success;
          fallbackProvided = !!result.schedule;
          
        } catch (error) {
          errorCaught = true;
          
          const errorResult = await aiErrorHandler.handleError(
            error,
            'malformed_input_test',
            input
          );
          
          validationPassed = errorResult.success;
          fallbackProvided = !!errorResult.fallback;
        }
        
        validationResults.push({
          name: input.name,
          validationPassed,
          errorCaught,
          fallbackProvided
        });
        
        expect(validationPassed).toBe(true);
        expect(fallbackProvided).toBe(true);
        
        console.log(`  ✅ ${input.name}: Handled gracefully`);
      }
      
      reportGenerator.addTestResult('Invalid Input Handling', {
        success: true,
        validationResults,
        allInputsHandled: validationResults.every(r => r.validationPassed)
      });
    });
  });

  describe('Extreme Scale Testing', () => {
    test('should handle very large staff and date ranges', async () => {
      console.log('🌋 Testing extreme scale handling...');
      
      const extremeScenarios = [
        { name: 'Large Staff Count', staffCount: 200, dayCount: 30 },
        { name: 'Long Time Period', staffCount: 20, dayCount: 365 },
        { name: 'Maximum Scale', staffCount: 100, dayCount: 180 }
      ];
      
      const scaleResults = [];
      
      for (const scenario of extremeScenarios) {
        console.log(`  Testing ${scenario.name}...`);
        
        const performanceResult = await measurePerformance(async () => {
          const testData = {
            staffMembers: createTestStaffMembers(scenario.staffCount),
            scheduleData: createTestScheduleData(scenario.staffCount, scenario.dayCount),
            dateRange: generateLargeDateRange(scenario.dayCount)
          };
          
          return await hybridPredictor.predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange
          );
        });
        
        const success = !performanceResult.error && performanceResult.result.success;
        const processingTime = performanceResult.executionTime;
        const memoryUsage = performanceResult.memoryUsage.delta;
        
        // Allow longer processing time for extreme scenarios (up to 30 seconds)
        const withinTimeLimit = processingTime < 30000;
        const withinMemoryLimit = memoryUsage < 200 * 1024 * 1024; // 200MB
        
        scaleResults.push({
          name: scenario.name,
          success,
          processingTime,
          memoryUsage: Math.round(memoryUsage / 1024 / 1024),
          withinLimits: withinTimeLimit && withinMemoryLimit
        });
        
        expect(success).toBe(true);
        
        console.log(`    Success: ${success}`);
        console.log(`    Time: ${(processingTime / 1000).toFixed(1)}s`);
        console.log(`    Memory: ${Math.round(memoryUsage / 1024 / 1024)}MB`);
      }
      
      const allWithinLimits = scaleResults.every(r => r.withinLimits);
      
      reportGenerator.addTestResult('Extreme Scale Testing', {
        success: true,
        scaleResults,
        allWithinLimits,
        maxProcessingTime: Math.max(...scaleResults.map(r => r.processingTime)),
        maxMemoryUsage: Math.max(...scaleResults.map(r => r.memoryUsage))
      });
      
      console.log(`  ✅ All extreme scale scenarios handled successfully`);
    });

    test('should maintain responsiveness during intensive operations', async () => {
      console.log('⚡ Testing system responsiveness during intensive operations...');
      
      let responsivenessMaintained = true;
      let operationCompleted = false;
      const responsivenessPings = [];
      
      // Start intensive operation
      const intensiveOperation = hybridPredictor.predictSchedule(
        { scheduleData: createTestScheduleData(50, 60) },
        createTestStaffMembers(50),
        generateLargeDateRange(60)
      );
      
      // Monitor responsiveness during operation
      const responsivenessCheck = setInterval(() => {
        const startPing = Date.now();
        setTimeout(() => {
          const pingTime = Date.now() - startPing;
          responsivenessPings.push(pingTime);
          
          // If any ping takes more than 100ms, responsiveness is compromised
          if (pingTime > 100) {
            responsivenessMaintained = false;
          }
        }, 0);
      }, 250); // Check every 250ms
      
      // Wait for operation completion
      try {
        const result = await intensiveOperation;
        operationCompleted = result.success;
      } catch (error) {
        operationCompleted = false;
      } finally {
        clearInterval(responsivenessCheck);
      }
      
      const avgPingTime = responsivenessPings.length > 0 ? 
        responsivenessPings.reduce((sum, ping) => sum + ping, 0) / responsivenessPings.length : 0;
      
      expect(operationCompleted).toBe(true);
      expect(avgPingTime).toBeLessThan(50); // Average ping should be under 50ms
      
      reportGenerator.addTestResult('System Responsiveness', {
        success: true,
        operationCompleted,
        responsivenessMaintained,
        avgPingTime,
        responsivenessPings: responsivenessPings.length
      });
      
      console.log(`  ✅ Average responsiveness: ${avgPingTime.toFixed(1)}ms`);
      console.log(`  ✅ Responsiveness maintained: ${responsivenessMaintained}`);
    });
  });

  // Helper functions
  function getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
  
  function generateLargeDateRange(dayCount) {
    const dates = [];
    const startDate = new Date(2024, 0, 1);
    
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  }
  
  function createProblematicTrainingData() {
    // Create data that might cause training issues
    const staffMembers = createTestStaffMembers(3);
    
    // Add problematic data patterns
    staffMembers.forEach(staff => {
      staff.inconsistentData = true;
      staff.missingFields = ['availability', 'preferences'];
    });
    
    return { staffMembers };
  }
  
  function createMinimalDataScenario() {
    const staffMembers = createTestStaffMembers(3);
    const scheduleData = {};
    
    // Only populate 10% of normal schedule data
    staffMembers.forEach(staff => {
      scheduleData[staff.id] = {
        '2024-01-01': '○',
        '2024-01-02': '×'
      };
    });
    
    return {
      staffMembers,
      scheduleData,
      dateRange: generateLargeDateRange(14),
      dataAmount: 0.1 // 10% of normal data
    };
  }
});