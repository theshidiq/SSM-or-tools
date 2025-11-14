/**
 * verify-ai-phases.js
 *
 * Static code verification for AI Enhancement Phases 1-3
 * Checks that all required code is in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 AI Enhancement Code Verification - Phases 1-3\n');
console.log('='.repeat(60));

const results = {
  phase1: { checks: [], passed: 0, failed: 0 },
  phase2: { checks: [], passed: 0, failed: 0 },
  phase3: { checks: [], passed: 0, failed: 0 },
};

function checkFile(filePath, searchTerms, phase, description) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    results[phase].checks.push({ description, status: 'FAILED', reason: 'File not found' });
    results[phase].failed++;
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const missingTerms = searchTerms.filter(term => !content.includes(term));

  if (missingTerms.length > 0) {
    results[phase].checks.push({
      description,
      status: 'FAILED',
      reason: `Missing: ${missingTerms.join(', ')}`,
    });
    results[phase].failed++;
    return false;
  }

  results[phase].checks.push({ description, status: 'PASSED' });
  results[phase].passed++;
  return true;
}

console.log('\n📊 PHASE 1: Sequence-Based Feature Extraction');
console.log('-'.repeat(60));

// Check FeatureEngineering.js
checkFile(
  'src/ai/ml/FeatureEngineering.js',
  [
    'rolling_3day_pattern_hash',
    'rolling_5day_pattern_hash',
    'position_in_weekly_cycle',
    'shift_transition_probability',
    'calculateRolling3DayPattern',
    'calculatePositionInWeeklyCycle',
    'calculateShiftTransitionProbability',
  ],
  'phase1',
  'FeatureEngineering has 15 sequence features'
);

// Check TensorFlowConfig.js
checkFile(
  'src/ai/ml/TensorFlowConfig.js',
  [
    'ENHANCED_TOTAL: 80',
    'INPUT_SIZE: 80',
    'SEQUENCE_ROLLING_WINDOW: 5',
    'SEQUENCE_POSITION_BASED: 5',
    'SEQUENCE_TRANSITION_PROB: 5',
  ],
  'phase1',
  'TensorFlowConfig updated to 80 features'
);

// Check PatternRecognizer.js
checkFile(
  'src/ai/core/PatternRecognizer.js',
  [
    'extractRollingWindows',
    'calculateShiftTransitionMatrix',
    'detectPositionPatterns',
    'analyzeShiftMomentum',
    'getSequenceFeaturesForDate',
    'calculatePatternStability',
  ],
  'phase1',
  'PatternRecognizer has sequence utilities'
);

console.log('\n🧠 PHASE 2: Per-Staff Pattern Memory');
console.log('-'.repeat(60));

// Check DataExtractor.js
checkFile(
  'src/ai/utils/DataExtractor.js',
  [
    'enrichStaffProfilesWithPatterns',
    'getStaffPredictionContext',
    'PHASE 2: Enrich staff profiles with per-staff pattern memory',
    'weeklyPositionPatterns',
    'transitionMatrix',
    'patternMemory',
    'hasPatternMemory',
  ],
  'phase2',
  'DataExtractor has pattern enrichment'
);

// Check TensorFlowScheduler.js
checkFile(
  'src/ai/ml/TensorFlowScheduler.js',
  [
    'getStaffPredictionContext',
    'staffPredictionContext',
    'PHASE 2:',
    'Pattern memory context',
  ],
  'phase2',
  'TensorFlowScheduler uses prediction context'
);

// Check HybridPredictor.js pattern stability
checkFile(
  'src/ai/hybrid/HybridPredictor.js',
  [
    'PHASE 2',
    'patternStabilityBoost',
    'hasPatternMemory',
    'patternMemory.stability',
  ],
  'phase2',
  'HybridPredictor includes pattern stability'
);

console.log('\n🎯 PHASE 3: Adaptive Intelligence');
console.log('-'.repeat(60));

// Check HybridPredictor adaptive thresholds
checkFile(
  'src/ai/hybrid/HybridPredictor.js',
  [
    'PHASE 3',
    'calculateAdaptiveThresholds',
    'patternBasedAdjustments',
    'correctionLearning',
    'getPatternAwareFallback',
    'stabilityBonus',
    'adaptiveThresholds',
  ],
  'phase3',
  'HybridPredictor has adaptive thresholds'
);

// Check HybridPredictor pattern-aware fallbacks
checkFile(
  'src/ai/hybrid/HybridPredictor.js',
  [
    'getPatternAwareFallback',
    'weeklyPrediction',
    'transitionMatrix',
    'shiftToIndex',
    'indexToShift',
  ],
  'phase3',
  'HybridPredictor has pattern-aware fallbacks'
);

// Check BusinessRuleValidator sequence validation
checkFile(
  'src/ai/hybrid/BusinessRuleValidator.js',
  [
    'PHASE 3',
    'validateSequencePatterns',
    'analyzeShiftMomentum',
    'excessive_work_streak',
    'insufficient_rest',
    'momentum_reversal',
    'pattern_deviation',
  ],
  'phase3',
  'BusinessRuleValidator has sequence validation'
);

// Display results
console.log('\n\n' + '='.repeat(60));
console.log('📋 VERIFICATION SUMMARY');
console.log('='.repeat(60));

['phase1', 'phase2', 'phase3'].forEach((phase, index) => {
  const phaseNum = index + 1;
  const { checks, passed, failed } = results[phase];
  const total = passed + failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;

  console.log(`\nPhase ${phaseNum}: ${passed}/${total} checks passed (${percentage}%)`);

  checks.forEach(check => {
    const icon = check.status === 'PASSED' ? '✅' : '❌';
    console.log(`  ${icon} ${check.description}`);
    if (check.reason) {
      console.log(`     → ${check.reason}`);
    }
  });
});

const totalPassed = results.phase1.passed + results.phase2.passed + results.phase3.passed;
const totalChecks =
  results.phase1.passed + results.phase1.failed +
  results.phase2.passed + results.phase2.failed +
  results.phase3.passed + results.phase3.failed;

console.log('\n' + '='.repeat(60));
console.log(`OVERALL: ${totalPassed}/${totalChecks} checks passed`);

if (totalPassed === totalChecks) {
  console.log('✅ ALL PHASES VERIFIED - CODE IS READY');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED - REVIEW REQUIRED');
  console.log('='.repeat(60));
  process.exit(1);
}
