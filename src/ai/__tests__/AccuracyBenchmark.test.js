/**
 * AccuracyBenchmark.test.js
 * 
 * Comprehensive accuracy validation and benchmarking tests
 * Compares ML vs rule-based system performance across various scenarios
 */

import { HybridPredictor } from '../hybrid/HybridPredictor';
import { ScheduleOptimizer } from '../optimization/ScheduleOptimizer';
import { BusinessRuleEngine } from '../constraints/BusinessRuleEngine';
import { 
  createBenchmarkTestCases,
  createTestStaffMembers,
  createTestScheduleData,
  calculateAccuracy,
  validateBusinessRules,
  measurePerformance,
  TestReportGenerator
} from '../utils/TestUtils';

describe('Phase 6: Accuracy Validation & Benchmarking', () => {
  let hybridPredictor;
  let ruleBasedOptimizer;
  let businessRules;
  let reportGenerator;
  
  const ACCURACY_TARGETS = {
    ML_MINIMUM: 0.75,      // 75% minimum ML accuracy
    ML_TARGET: 0.85,       // 85% target ML accuracy
    HYBRID_TARGET: 0.90,   // 90% target hybrid accuracy
    IMPROVEMENT_TARGET: 0.25 // 25% improvement over rule-based
  };

  beforeAll(async () => {
    console.log('🎯 Initializing Accuracy Benchmarking Tests...');
    
    hybridPredictor = new HybridPredictor();
    ruleBasedOptimizer = new ScheduleOptimizer();
    businessRules = new BusinessRuleEngine();
    reportGenerator = new TestReportGenerator();
    
    // Initialize components
    await hybridPredictor.initialize({
      mlConfidenceThreshold: 0.6,
      useMLPredictions: true,
      fallbackToRules: true
    });
    
    await ruleBasedOptimizer.initialize();
    await businessRules.initialize();
    
    console.log('✅ Benchmarking components initialized');
  });

  afterAll(async () => {
    if (hybridPredictor) await hybridPredictor.reset();
    if (ruleBasedOptimizer) await ruleBasedOptimizer.reset();
    
    // Generate final accuracy report
    const report = reportGenerator.generateReport();
    console.log('📊 Final Accuracy Benchmarking Report:');
    console.log(`   Pass Rate: ${report.summary.passRate}%`);
    console.log(`   Phase 6 Status: ${report.phase6Status}`);
  });

  describe('ML vs Rule-Based Accuracy Comparison', () => {
    test('should outperform rule-based system across all benchmark scenarios', async () => {
      console.log('⚡ Running comprehensive ML vs Rule-based accuracy comparison...');
      
      const benchmarkCases = createBenchmarkTestCases();
      const results = [];
      
      for (const testCase of benchmarkCases) {
        console.log(`  Testing: ${testCase.name}`);
        
        const testData = createBenchmarkTestData(testCase);
        const comparisonResult = await compareMlVsRuleBased(testData);
        
        results.push({
          name: testCase.name,
          ...comparisonResult,
          expectedML: testCase.expectedAccuracy.ml,
          expectedRules: testCase.expectedAccuracy.rules
        });
        
        // Validate ML outperforms rules
        expect(comparisonResult.mlAccuracy).toBeGreaterThan(comparisonResult.ruleBasedAccuracy);
        
        // Validate improvement meets target
        const improvement = (comparisonResult.mlAccuracy - comparisonResult.ruleBasedAccuracy) / comparisonResult.ruleBasedAccuracy;
        expect(improvement).toBeGreaterThan(ACCURACY_TARGETS.IMPROVEMENT_TARGET);
        
        console.log(`    ML: ${(comparisonResult.mlAccuracy * 100).toFixed(1)}%`);
        console.log(`    Rules: ${(comparisonResult.ruleBasedAccuracy * 100).toFixed(1)}%`);
        console.log(`    Improvement: ${(improvement * 100).toFixed(1)}%`);
      }
      
      // Calculate overall performance
      const avgMlAccuracy = results.reduce((sum, r) => sum + r.mlAccuracy, 0) / results.length;
      const avgRulesAccuracy = results.reduce((sum, r) => sum + r.ruleBasedAccuracy, 0) / results.length;
      const overallImprovement = (avgMlAccuracy - avgRulesAccuracy) / avgRulesAccuracy;
      
      expect(avgMlAccuracy).toBeGreaterThan(ACCURACY_TARGETS.ML_TARGET);
      expect(overallImprovement).toBeGreaterThan(ACCURACY_TARGETS.IMPROVEMENT_TARGET);
      
      reportGenerator.addTestResult('ML vs Rule-Based Comparison', {
        success: true,
        avgMlAccuracy,
        avgRulesAccuracy,
        overallImprovement,
        testCases: results.length
      });
      
      console.log(`✅ Overall ML Accuracy: ${(avgMlAccuracy * 100).toFixed(1)}%`);
      console.log(`✅ Overall Rules Accuracy: ${(avgRulesAccuracy * 100).toFixed(1)}%`);
      console.log(`✅ Overall Improvement: ${(overallImprovement * 100).toFixed(1)}%`);
    });

    test('should maintain accuracy consistency across multiple runs', async () => {
      console.log('🔄 Testing accuracy consistency across multiple runs...');
      
      const testData = createBenchmarkTestData({
        staffCount: 15,
        dayCount: 30,
        complexity: 'medium'
      });
      
      const runs = 5;
      const accuracyResults = [];
      
      for (let i = 0; i < runs; i++) {
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange
        );
        
        const accuracy = calculateAccuracyFromResult(result, testData.expectedSchedule);
        accuracyResults.push(accuracy);
      }
      
      // Calculate consistency metrics
      const avgAccuracy = accuracyResults.reduce((sum, acc) => sum + acc, 0) / accuracyResults.length;
      const variance = accuracyResults.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracyResults.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / avgAccuracy;
      
      // Expect low variation (high consistency)
      expect(coefficientOfVariation).toBeLessThan(0.1); // Less than 10% variation
      expect(avgAccuracy).toBeGreaterThan(ACCURACY_TARGETS.ML_TARGET);
      
      reportGenerator.addTestResult('Accuracy Consistency', {
        success: true,
        avgAccuracy,
        standardDeviation,
        coefficientOfVariation,
        runs
      });
      
      console.log(`✅ Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
      console.log(`✅ Standard Deviation: ${(standardDeviation * 100).toFixed(2)}%`);
      console.log(`✅ Coefficient of Variation: ${(coefficientOfVariation * 100).toFixed(1)}%`);
    });
  });

  describe('Hybrid System Accuracy Validation', () => {
    test('should achieve target accuracy with ML + business rules', async () => {
      console.log('🤖 Testing hybrid system accuracy...');
      
      const testCases = createBenchmarkTestCases().slice(0, 3); // Test first 3 cases
      const hybridResults = [];
      
      for (const testCase of testCases) {
        const testData = createBenchmarkTestData(testCase);
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange
        );
        
        const accuracy = calculateAccuracyFromResult(result, testData.expectedSchedule);
        const businessCompliance = validateBusinessRules(
          result.schedule,
          testData.staffMembers
        );
        
        hybridResults.push({
          name: testCase.name,
          accuracy,
          businessCompliance: businessCompliance.overall,
          mlUsed: result.metadata?.mlUsed || false,
          mlConfidence: result.metadata?.mlConfidence || 0
        });
        
        // Validate hybrid performance
        expect(accuracy).toBeGreaterThan(ACCURACY_TARGETS.HYBRID_TARGET);
        expect(businessCompliance.overall).toBe(100); // Perfect business rule compliance
        
        console.log(`  ${testCase.name}:`);
        console.log(`    Accuracy: ${(accuracy * 100).toFixed(1)}%`);
        console.log(`    Compliance: ${businessCompliance.overall}%`);
        console.log(`    ML Used: ${result.metadata?.mlUsed ? 'Yes' : 'No'}`);
      }
      
      const avgHybridAccuracy = hybridResults.reduce((sum, r) => sum + r.accuracy, 0) / hybridResults.length;
      const mlUsageRate = hybridResults.filter(r => r.mlUsed).length / hybridResults.length;
      
      expect(avgHybridAccuracy).toBeGreaterThan(ACCURACY_TARGETS.HYBRID_TARGET);
      expect(mlUsageRate).toBeGreaterThan(0.6); // ML should be used in majority of cases
      
      reportGenerator.addTestResult('Hybrid System Accuracy', {
        success: true,
        avgHybridAccuracy,
        mlUsageRate,
        testCases: hybridResults.length
      });
      
      console.log(`✅ Hybrid System Average Accuracy: ${(avgHybridAccuracy * 100).toFixed(1)}%`);
      console.log(`✅ ML Usage Rate: ${(mlUsageRate * 100).toFixed(1)}%`);
    });

    test('should gracefully degrade with low ML confidence', async () => {
      console.log('📉 Testing graceful degradation with low ML confidence...');
      
      // Create test data that would result in low ML confidence
      const testData = createBenchmarkTestData({
        staffCount: 5,
        dayCount: 7,
        complexity: 'low',
        insufficientData: true
      });
      
      const result = await hybridPredictor.predictSchedule(
        { scheduleData: testData.scheduleData },
        testData.staffMembers,
        testData.dateRange
      );
      
      expect(result.success).toBe(true);
      
      // Should fall back to rules when ML confidence is low
      const mlConfidence = result.metadata?.mlConfidence || 0;
      const ruleBased = result.metadata?.method?.includes('rule') || mlConfidence < 0.5;
      
      if (ruleBased) {
        console.log('  ✅ Gracefully fell back to rule-based approach');
      } else {
        console.log('  ✅ ML confidence was sufficient for ML-based approach');
      }
      
      // Ensure business rules are still followed
      const businessCompliance = validateBusinessRules(
        result.schedule,
        testData.staffMembers
      );
      
      expect(businessCompliance.overall).toBe(100);
      
      reportGenerator.addTestResult('Graceful Degradation', {
        success: true,
        mlConfidence,
        ruleBased,
        businessCompliance: businessCompliance.overall
      });
    });
  });

  describe('Training Data Impact Analysis', () => {
    test('should show accuracy improvement with more training data', async () => {
      console.log('📊 Analyzing training data impact on accuracy...');
      
      const dataAmounts = [0.1, 0.25, 0.5, 0.75, 1.0];
      const accuracyProgression = [];
      
      for (const amount of dataAmounts) {
        const testData = createBenchmarkTestData({
          staffCount: 10,
          dayCount: 30,
          complexity: 'medium',
          dataAmount: amount
        });
        
        // Simulate training with limited data
        const performanceResult = await measurePerformance(async () => {
          return await hybridPredictor.predictSchedule(
            { scheduleData: testData.scheduleData },
            testData.staffMembers,
            testData.dateRange
          );
        });
        
        const accuracy = calculateAccuracyFromResult(
          performanceResult.result,
          testData.expectedSchedule
        );
        
        accuracyProgression.push({
          dataAmount: amount,
          accuracy,
          trainingTime: performanceResult.executionTime
        });
        
        console.log(`  ${(amount * 100).toFixed(0)}% data: ${(accuracy * 100).toFixed(1)}% accuracy`);
      }
      
      // Validate accuracy generally improves with more data
      const firstAccuracy = accuracyProgression[0].accuracy;
      const lastAccuracy = accuracyProgression[accuracyProgression.length - 1].accuracy;
      const improvement = (lastAccuracy - firstAccuracy) / firstAccuracy;
      
      expect(improvement).toBeGreaterThan(0.1); // At least 10% improvement
      expect(lastAccuracy).toBeGreaterThan(ACCURACY_TARGETS.ML_TARGET);
      
      reportGenerator.addTestResult('Training Data Impact', {
        success: true,
        improvement,
        finalAccuracy: lastAccuracy,
        dataPoints: accuracyProgression.length
      });
      
      console.log(`✅ Accuracy improved by ${(improvement * 100).toFixed(1)}% with full data`);
    });
  });

  describe('Real-world Scenario Testing', () => {
    test('should handle complex restaurant scheduling scenarios', async () => {
      console.log('🍽️ Testing real-world restaurant scenarios...');
      
      const scenarios = [
        {
          name: 'Busy Weekend',
          description: 'High demand weekend with skilled staff requirements',
          staffCount: 20,
          dayCount: 3,
          highDemand: true,
          skillRequirements: true
        },
        {
          name: 'Holiday Season',
          description: 'Extended holiday period with mixed availability',
          staffCount: 25,
          dayCount: 14,
          holidayPeriod: true,
          mixedAvailability: true
        },
        {
          name: 'Staff Shortage',
          description: 'Limited staff with mandatory coverage requirements',
          staffCount: 8,
          dayCount: 21,
          staffShortage: true,
          mandatoryCoverage: true
        }
      ];
      
      const scenarioResults = [];
      
      for (const scenario of scenarios) {
        const testData = createRealWorldScenario(scenario);
        const result = await hybridPredictor.predictSchedule(
          { scheduleData: testData.scheduleData },
          testData.staffMembers,
          testData.dateRange
        );
        
        const accuracy = calculateAccuracyFromResult(result, testData.expectedSchedule);
        const businessCompliance = validateBusinessRules(
          result.schedule,
          testData.staffMembers
        );
        
        scenarioResults.push({
          name: scenario.name,
          accuracy,
          businessCompliance: businessCompliance.overall,
          processingTime: result.metadata?.processingTime || 0
        });
        
        // Validate performance in real-world scenarios
        expect(accuracy).toBeGreaterThan(ACCURACY_TARGETS.ML_MINIMUM);
        expect(businessCompliance.overall).toBe(100);
        expect(result.metadata?.processingTime || 0).toBeLessThan(5000); // 5 seconds max
        
        console.log(`  ${scenario.name}:`);
        console.log(`    Accuracy: ${(accuracy * 100).toFixed(1)}%`);
        console.log(`    Compliance: ${businessCompliance.overall}%`);
        console.log(`    Processing: ${result.metadata?.processingTime || 0}ms`);
      }
      
      const avgAccuracy = scenarioResults.reduce((sum, r) => sum + r.accuracy, 0) / scenarioResults.length;
      
      expect(avgAccuracy).toBeGreaterThan(ACCURACY_TARGETS.ML_TARGET);
      
      reportGenerator.addTestResult('Real-world Scenarios', {
        success: true,
        avgAccuracy,
        scenarios: scenarioResults.length,
        allCompliant: scenarioResults.every(r => r.businessCompliance === 100)
      });
      
      console.log(`✅ Real-world Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
    });
  });

  // Helper functions
  function createBenchmarkTestData(testCase) {
    const staffMembers = createTestStaffMembers(testCase.staffCount);
    const scheduleData = createTestScheduleData(testCase.staffCount, testCase.dayCount);
    const dateRange = generateDateRange(testCase.dayCount);
    const expectedSchedule = generateOptimalSchedule(staffMembers, dateRange, testCase);
    
    return {
      staffMembers,
      scheduleData,
      dateRange,
      expectedSchedule
    };
  }
  
  async function compareMlVsRuleBased(testData) {
    // ML prediction
    const mlResult = await hybridPredictor.predictSchedule(
      { scheduleData: testData.scheduleData },
      testData.staffMembers,
      testData.dateRange
    );
    
    // Rule-based prediction
    const ruleResult = await ruleBasedOptimizer.generateOptimalSchedule(
      { scheduleData: testData.scheduleData },
      testData.staffMembers,
      testData.dateRange
    );
    
    // Calculate accuracies
    const mlAccuracy = calculateAccuracyFromResult(mlResult, testData.expectedSchedule);
    const ruleBasedAccuracy = calculateAccuracyFromResult(ruleResult, testData.expectedSchedule);
    
    return {
      mlAccuracy,
      ruleBasedAccuracy,
      mlProcessingTime: mlResult.metadata?.processingTime || 0,
      ruleProcessingTime: ruleResult.metadata?.processingTime || 0
    };
  }
  
  function calculateAccuracyFromResult(result, expectedSchedule) {
    if (!result.success || !result.schedule) return 0;
    return calculateAccuracy(result.schedule, expectedSchedule);
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
  
  function generateOptimalSchedule(staffMembers, dateRange, testCase) {
    // Generate a theoretically optimal schedule for comparison
    // This would be based on perfect knowledge of constraints and preferences
    const schedule = {};
    
    staffMembers.forEach(staff => {
      schedule[staff.id] = {};
      
      dateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split('T')[0];
        
        // Generate optimal shift based on test case requirements
        let optimalShift;
        
        if (testCase.highDemand && (index % 7 === 5 || index % 7 === 6)) {
          // Weekend high demand
          optimalShift = '○'; // Normal shift
        } else if (testCase.staffShortage && staff.position === 'マネージャー') {
          // Manager should work more during shortage
          optimalShift = index % 6 === 5 ? '×' : '○';
        } else {
          // Standard optimal pattern
          optimalShift = index % 5 === 4 ? '×' : ['△', '○', '▽'][index % 3];
        }
        
        schedule[staff.id][dateKey] = optimalShift;
      });
    });
    
    return schedule;
  }
  
  function createRealWorldScenario(scenario) {
    return createBenchmarkTestData({
      staffCount: scenario.staffCount,
      dayCount: scenario.dayCount,
      complexity: 'high',
      ...scenario
    });
  }
});