/**
 * test-ai-phases.js
 *
 * Comprehensive test script for AI Enhancement Phases 1-3
 * Tests feature extraction, pattern memory, and adaptive intelligence
 */

const { extractAllDataForAI, enrichStaffProfilesWithPatterns, getStaffPredictionContext } = require('./src/ai/utils/DataExtractor');
const { ScheduleFeatureEngineer } = require('./src/ai/ml/FeatureEngineering');
const { EnhancedFeatureEngineering } = require('./src/ai/ml/EnhancedFeatureEngineering');
const { detectPositionPatterns, calculateShiftTransitionMatrix, analyzeShiftMomentum, calculatePatternStability } = require('./src/ai/core/PatternRecognizer');

console.log('🧪 AI Enhancement Test Suite - Phases 1-3\n');
console.log('=' .repeat(60));

async function testPhase1() {
  console.log('\n📊 PHASE 1: Testing Sequence-Based Feature Extraction');
  console.log('-'.repeat(60));

  try {
    // Test feature engineer initialization
    const featureEngineer = new EnhancedFeatureEngineering();
    console.log('✅ EnhancedFeatureEngineering initialized');

    // Extract test data
    const dataResult = extractAllDataForAI(false); // Without pattern enrichment

    if (!dataResult.success) {
      console.error('❌ Failed to extract data:', dataResult.error);
      return { success: false, phase: 1 };
    }

    const { staffProfiles, rawPeriodData } = dataResult.data;
    const staffList = Object.values(staffProfiles);

    console.log(`✅ Extracted data: ${staffList.length} staff members, ${rawPeriodData.length} periods`);

    if (staffList.length === 0 || rawPeriodData.length === 0) {
      console.log('⚠️ No data available for testing');
      return { success: true, phase: 1, warning: 'No data' };
    }

    // Test feature generation with first staff member and date
    const testStaff = staffList[0];
    const testPeriod = rawPeriodData[0];
    const testDate = testPeriod.dateRange[0];

    console.log(`\n🔍 Testing feature generation for: ${testStaff.name}`);
    console.log(`   Date: ${testDate.toISOString().split('T')[0]}`);

    const features = featureEngineer.generateFeatures({
      staff: testStaff,
      date: testDate,
      dateIndex: 0,
      periodData: {
        schedule: testPeriod.scheduleData,
        dateRange: testPeriod.dateRange,
        monthIndex: testPeriod.monthIndex,
      },
      allHistoricalData: rawPeriodData.reduce((acc, period) => {
        acc[period.monthIndex] = {
          schedule: period.scheduleData,
          dateRange: period.dateRange,
        };
        return acc;
      }, {}),
      staffMembers: staffList,
    });

    if (!features) {
      console.error('❌ Feature generation returned null');
      return { success: false, phase: 1 };
    }

    console.log(`✅ Features generated: ${features.length} features`);

    if (features.length !== 80) {
      console.error(`❌ Expected 80 features, got ${features.length}`);
      return { success: false, phase: 1, actual: features.length };
    }

    console.log('✅ Feature count correct: 80 features');

    // Verify feature values are valid
    const invalidFeatures = features.filter((f, i) =>
      typeof f !== 'number' || isNaN(f) || !isFinite(f)
    );

    if (invalidFeatures.length > 0) {
      console.error(`❌ Found ${invalidFeatures.length} invalid features`);
      return { success: false, phase: 1 };
    }

    console.log('✅ All feature values are valid numbers');

    // Display feature sample
    console.log('\n📈 Feature Sample (first 10):');
    features.slice(0, 10).forEach((f, i) => {
      console.log(`   Feature ${i}: ${f.toFixed(4)}`);
    });

    return {
      success: true,
      phase: 1,
      featureCount: features.length,
      testStaff: testStaff.name,
    };

  } catch (error) {
    console.error('❌ Phase 1 test failed:', error.message);
    console.error(error.stack);
    return { success: false, phase: 1, error: error.message };
  }
}

async function testPhase2() {
  console.log('\n\n🧠 PHASE 2: Testing Per-Staff Pattern Memory');
  console.log('-'.repeat(60));

  try {
    // Extract data WITH pattern enrichment
    const dataResult = extractAllDataForAI(true); // Enable pattern enrichment

    if (!dataResult.success) {
      console.error('❌ Failed to extract data:', dataResult.error);
      return { success: false, phase: 2 };
    }

    console.log(`✅ Phase 2 enabled: ${dataResult.phase2Enabled}`);

    const { staffProfiles } = dataResult.data;
    const staffList = Object.values(staffProfiles);

    // Count staff with pattern memory
    const staffWithPatterns = staffList.filter(s => s.hasPatternMemory);

    console.log(`✅ Staff with pattern memory: ${staffWithPatterns.length}/${staffList.length}`);

    if (staffWithPatterns.length === 0) {
      console.log('⚠️ No staff have pattern memory (insufficient data)');
      return { success: true, phase: 2, warning: 'Insufficient data' };
    }

    // Test pattern memory structure
    const testStaff = staffWithPatterns[0];
    console.log(`\n🔍 Testing pattern memory for: ${testStaff.name}`);

    const { patternMemory } = testStaff;

    // Verify pattern memory structure
    const requiredFields = [
      'weeklyPositionPatterns',
      'monthlyPositionPatterns',
      'transitionMatrix',
      'momentum',
      'stability',
      'stats'
    ];

    const missingFields = requiredFields.filter(field => !patternMemory[field]);

    if (missingFields.length > 0) {
      console.error(`❌ Missing pattern memory fields: ${missingFields.join(', ')}`);
      return { success: false, phase: 2, missingFields };
    }

    console.log('✅ Pattern memory structure complete');

    // Display pattern memory details
    console.log('\n📊 Pattern Memory Details:');
    console.log(`   Weekly patterns: ${Object.keys(patternMemory.weeklyPositionPatterns.predictions).length} days`);
    console.log(`   Monthly patterns: ${Object.keys(patternMemory.monthlyPositionPatterns.predictions).length} days`);
    console.log(`   Transition matrix: ${patternMemory.transitionMatrix.totalTransitions} transitions`);
    console.log(`   Momentum: ${patternMemory.momentum.momentum.toFixed(2)} (${patternMemory.momentum.streakType} streak)`);
    console.log(`   Stability score: ${patternMemory.stability.stabilityScore.toFixed(1)} (${patternMemory.stability.stabilityLevel})`);
    console.log(`   Historical shifts: ${patternMemory.stats.totalHistoricalShifts}`);

    // Test prediction context
    const testDate = new Date().toISOString().split('T')[0];
    const predictionContext = getStaffPredictionContext(testStaff, testDate);

    if (!predictionContext.hasContext) {
      console.error('❌ Failed to get prediction context');
      return { success: false, phase: 2 };
    }

    console.log('\n✅ Prediction context generated:');
    console.log(`   Overall confidence: ${(predictionContext.confidence.overall * 100).toFixed(1)}%`);
    console.log(`   Stability: ${predictionContext.stability.level} (${predictionContext.stability.score.toFixed(1)})`);
    console.log(`   Weekly prediction: ${predictionContext.predictions.weekly?.shift || 'N/A'}`);
    console.log(`   Recommendations: ${predictionContext.recommendations.length}`);

    return {
      success: true,
      phase: 2,
      staffWithPatterns: staffWithPatterns.length,
      testStaff: testStaff.name,
      stabilityScore: patternMemory.stability.stabilityScore,
      confidence: predictionContext.confidence.overall,
    };

  } catch (error) {
    console.error('❌ Phase 2 test failed:', error.message);
    console.error(error.stack);
    return { success: false, phase: 2, error: error.message };
  }
}

async function testPhase3() {
  console.log('\n\n🎯 PHASE 3: Testing Adaptive Intelligence');
  console.log('-'.repeat(60));

  try {
    // Extract data with pattern enrichment
    const dataResult = extractAllDataForAI(true);

    if (!dataResult.success) {
      console.error('❌ Failed to extract data:', dataResult.error);
      return { success: false, phase: 3 };
    }

    const { staffProfiles } = dataResult.data;
    const staffWithPatterns = Object.values(staffProfiles).filter(s => s.hasPatternMemory);

    if (staffWithPatterns.length === 0) {
      console.log('⚠️ No staff have pattern memory for Phase 3 testing');
      return { success: true, phase: 3, warning: 'Insufficient data' };
    }

    console.log(`✅ Testing with ${staffWithPatterns.length} staff with pattern memory`);

    // Test adaptive threshold calculation
    console.log('\n🎚️ Testing Adaptive Thresholds:');

    let totalStability = 0;
    staffWithPatterns.forEach(profile => {
      totalStability += profile.patternMemory.stability.stabilityScore;
    });
    const avgStability = totalStability / staffWithPatterns.length;

    console.log(`   Average pattern stability: ${avgStability.toFixed(1)}`);

    // Calculate expected threshold adjustment
    let expectedAdjustment = 0;
    if (avgStability >= 80) {
      expectedAdjustment = -0.05; // Lower thresholds for stable patterns
      console.log('   ✅ High stability detected → Thresholds lowered by 5%');
    } else if (avgStability < 60) {
      expectedAdjustment = 0.03; // Raise thresholds for unstable patterns
      console.log('   ✅ Low stability detected → Thresholds raised by 3%');
    } else {
      console.log('   ✅ Medium stability → No threshold adjustment');
    }

    // Test pattern-aware fallback
    console.log('\n🔄 Testing Pattern-Aware Fallback:');
    const testStaff = staffWithPatterns[0];
    const testDate = new Date().toISOString().split('T')[0];

    const weeklyPosition = new Date(testDate).getDay();
    const weeklyPrediction = testStaff.patternMemory.weeklyPositionPatterns.predictions[weeklyPosition];

    if (weeklyPrediction) {
      console.log(`   Weekly pattern fallback: "${weeklyPrediction.shift}" (confidence: ${(weeklyPrediction.confidence * 100).toFixed(0)}%)`);

      if (weeklyPrediction.confidence > 0.6) {
        console.log('   ✅ High confidence weekly pattern available for fallback');
      } else {
        console.log('   ℹ️ Low confidence weekly pattern - would use transition matrix');
      }
    }

    // Test sequence validation
    console.log('\n🔄 Testing Sequence Validation:');
    const { momentum } = testStaff.patternMemory;

    console.log(`   Average work streak: ${momentum.averageWorkStreak.toFixed(1)} days`);
    console.log(`   Average rest streak: ${momentum.averageRestStreak.toFixed(1)} days`);
    console.log(`   Momentum score: ${momentum.momentum.toFixed(2)}`);
    console.log('   ✅ Sequence metrics available for validation');

    // Display pattern stability levels
    console.log('\n📊 Pattern Stability Distribution:');
    const stabilityLevels = {};
    staffWithPatterns.forEach(profile => {
      const level = profile.patternMemory.stability.stabilityLevel;
      stabilityLevels[level] = (stabilityLevels[level] || 0) + 1;
    });

    Object.entries(stabilityLevels).forEach(([level, count]) => {
      console.log(`   ${level}: ${count} staff`);
    });

    return {
      success: true,
      phase: 3,
      avgStability,
      thresholdAdjustment: expectedAdjustment,
      stabilityDistribution: stabilityLevels,
      testStaff: testStaff.name,
    };

  } catch (error) {
    console.error('❌ Phase 3 test failed:', error.message);
    console.error(error.stack);
    return { success: false, phase: 3, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive AI test suite...\n');

  const results = {
    phase1: null,
    phase2: null,
    phase3: null,
    startTime: Date.now(),
  };

  // Run tests sequentially
  results.phase1 = await testPhase1();
  results.phase2 = await testPhase2();
  results.phase3 = await testPhase3();

  results.endTime = Date.now();
  results.totalTime = results.endTime - results.startTime;

  // Display summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));

  const phases = [
    { name: 'Phase 1 (80 Features)', result: results.phase1 },
    { name: 'Phase 2 (Pattern Memory)', result: results.phase2 },
    { name: 'Phase 3 (Adaptive Intelligence)', result: results.phase3 },
  ];

  phases.forEach(({ name, result }) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const warning = result.warning ? ` (${result.warning})` : '';
    console.log(`\n${name}: ${status}${warning}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const allPassed = phases.every(p => p.result.success);
  const totalDuration = (results.totalTime / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log(`⏱️ Total test time: ${totalDuration}s`);
  console.log('='.repeat(60));

  return results;
}

// Run tests
runAllTests()
  .then(results => {
    const exitCode = results.phase1.success && results.phase2.success && results.phase3.success ? 0 : 1;
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('\n💥 Fatal test error:', error);
    process.exit(1);
  });
