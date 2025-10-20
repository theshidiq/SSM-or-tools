/**
 * AIConfigAdapter.test.js
 *
 * Test suite and transformation examples for AIConfigAdapter
 */

import {
  transformStaffGroups,
  transformDailyLimits,
  transformPriorityRules,
  transformMLConfig,
  transformMonthlyLimits,
  createAIConfiguration,
  validateAIConfiguration,
  camelToSnake,
  snakeToCamel,
  transformKeysToCamel,
  transformKeysToSnake,
} from './AIConfigAdapter';

/**
 * Example 1: Staff Groups Transformation
 */
export const exampleStaffGroupsTransformation = () => {
  console.log('\n📦 Example 1: Staff Groups Transformation\n');

  // Database format (from PostgreSQL with JSONB)
  const dbStaffGroups = [
    {
      id: 'group-uuid-1',
      name: 'Group 1',
      restaurant_id: 'rest-1',
      group_config: {
        members: ['staff-id-1', 'staff-id-2'],
        conflictsWith: ['group-uuid-2'],
        max_simultaneous_off: 1,
        max_simultaneous_early: 1,
        allows_conflict: false,
        priority: 'high',
      },
      is_active: true,
      color: '#3B82F6',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'group-uuid-2',
      name: 'Group 2',
      restaurant_id: 'rest-1',
      group_config: {
        members: ['staff-id-3', 'staff-id-4'],
        conflictsWith: ['group-uuid-1'],
        coverageRule: {
          backup_staff: 'staff-id-5',
          required_shift: 'normal',
          description: 'When Group 2 member has day off, staff-5 must work',
        },
        proximityPattern: {
          trigger: 'staff-id-3',
          condition: 'weekday_off',
          target: 'staff-id-4',
          proximity: 2,
          description: 'Target off day should be within ±2 days',
        },
      },
      is_active: true,
      color: '#EF4444',
    },
  ];

  console.log('Input (Database format):');
  console.log(JSON.stringify(dbStaffGroups, null, 2));

  const transformed = transformStaffGroups(dbStaffGroups);

  console.log('\nOutput (AI format):');
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n✅ Transformation successful!');
  console.log(`   Transformed ${Object.keys(transformed).length} staff groups`);

  return transformed;
};

/**
 * Example 2: Daily Limits Transformation
 */
export const exampleDailyLimitsTransformation = () => {
  console.log('\n📦 Example 2: Daily Limits Transformation\n');

  // Database format
  const dbDailyLimits = [
    {
      id: 'limit-uuid-1',
      name: 'Maximum Off Days',
      restaurant_id: 'rest-1',
      shift_type: 'off',
      max_count: 4,
      limit_config: {
        type: 'max_off_days',
        min_staff: null,
        max_staff: 4,
        shift_type: 'off',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        penalty_weight: 50,
        scope: 'all',
        target_ids: [],
      },
      is_hard_constraint: true,
      is_active: true,
      description: 'Maximum number of staff that can be off per day',
    },
    {
      id: 'limit-uuid-2',
      name: 'Minimum Working Staff',
      restaurant_id: 'rest-1',
      shift_type: 'any',
      max_count: 3,
      limit_config: {
        type: 'min_working_staff',
        min_staff: 3,
        max_staff: null,
        days_of_week: [1, 2, 3, 4, 5], // Weekdays only
        penalty_weight: 100,
        scope: 'all',
      },
      is_hard_constraint: true,
      is_active: true,
      description: 'Minimum staff required on weekdays',
    },
  ];

  console.log('Input (Database format):');
  console.log(JSON.stringify(dbDailyLimits, null, 2));

  const transformed = transformDailyLimits(dbDailyLimits);

  console.log('\nOutput (AI format):');
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n✅ Transformation successful!');
  console.log(`   Transformed ${transformed.length} daily limits`);

  return transformed;
};

/**
 * Example 3: Priority Rules Transformation
 */
export const examplePriorityRulesTransformation = () => {
  console.log('\n📦 Example 3: Priority Rules Transformation\n');

  // Database format
  const dbPriorityRules = [
    {
      id: 'rule-uuid-1',
      name: 'Sunday Early Shift - Chef',
      restaurant_id: 'rest-1',
      priority: 10,
      rule_config: {
        conditions: {
          staff_id: 'chef-staff-id',
          day_of_week: 0, // Sunday
          shift_type: 'early',
        },
        actions: {
          assign_shift: 'early',
          penalty_if_violated: 100,
        },
      },
      staff_id: 'chef-staff-id',
      weight: 0.8,
      is_active: true,
      description: 'Chef prefers early shift on Sundays',
    },
    {
      id: 'rule-uuid-2',
      name: 'Weekend Off - Part-time Staff',
      restaurant_id: 'rest-1',
      priority: 5,
      rule_config: {
        conditions: {
          staff_id: 'parttime-staff-id',
          day_of_week: 0, // Sunday
        },
        actions: {
          assign_shift: 'off',
          penalty_if_violated: 50,
        },
      },
      staff_id: 'parttime-staff-id',
      weight: 0.5,
      is_active: true,
    },
  ];

  console.log('Input (Database format):');
  console.log(JSON.stringify(dbPriorityRules, null, 2));

  const transformed = transformPriorityRules(dbPriorityRules);

  console.log('\nOutput (AI format):');
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n✅ Transformation successful!');
  console.log(`   Transformed ${transformed.length} priority rules`);
  console.log(`   Sorted by priority: ${transformed.map(r => r.priority).join(', ')}`);

  return transformed;
};

/**
 * Example 4: ML Configuration Transformation
 */
export const exampleMLConfigTransformation = () => {
  console.log('\n📦 Example 4: ML Configuration Transformation\n');

  // Database format
  const dbMLConfigs = [
    {
      id: 'ml-config-uuid-1',
      restaurant_id: 'rest-1',
      model_type: 'neural_network',
      hyperparameters: {
        learning_rate: 0.001,
        epochs: 100,
        batch_size: 32,
        optimizer: 'adam',
        loss_function: 'categoricalCrossentropy',
        metrics: ['accuracy', 'precision'],
        dropout: 0.2,
        regularization: 'l2',
        regularization_rate: 0.01,
        hidden_layers: [128, 64, 32],
        activation_function: 'relu',
      },
      training_config: {
        validation_split: 0.2,
        early_stopping: true,
        early_stopping_patience: 10,
      },
      version: '1.0.0',
      is_active: true,
      description: 'Production neural network configuration',
    },
  ];

  console.log('Input (Database format):');
  console.log(JSON.stringify(dbMLConfigs, null, 2));

  const transformed = transformMLConfig(dbMLConfigs);

  console.log('\nOutput (AI format):');
  console.log(JSON.stringify(transformed, null, 2));

  console.log('\n✅ Transformation successful!');
  console.log(`   Model type: ${transformed.modelType}`);
  console.log(`   Learning rate: ${transformed.learningRate}`);
  console.log(`   Epochs: ${transformed.epochs}`);

  return transformed;
};

/**
 * Example 5: Complete Configuration Transformation
 */
export const exampleCompleteTransformation = () => {
  console.log('\n📦 Example 5: Complete AI Configuration\n');

  // Simulated WebSocket message with all settings
  const websocketMessage = {
    staffGroups: [
      {
        id: 'group-1',
        name: 'Kitchen Team A',
        group_config: {
          members: ['chef-1', 'cook-1'],
          max_simultaneous_off: 1,
        },
        is_active: true,
      },
    ],
    dailyLimits: [
      {
        id: 'limit-1',
        name: 'Max Off Days',
        limit_config: {
          max_staff: 4,
          penalty_weight: 50,
        },
        is_hard_constraint: true,
        is_active: true,
      },
    ],
    monthlyLimits: [
      {
        id: 'monthly-1',
        name: 'Monthly Off Limit',
        limit_config: {
          limit_type: 'max_off_days',
          max_count: 8,
        },
        is_active: true,
      },
    ],
    priorityRules: [
      {
        id: 'rule-1',
        name: 'Chef Sunday Early',
        priority: 10,
        rule_config: {
          conditions: { staff_id: 'chef-1', day_of_week: 0 },
          actions: { assign_shift: 'early' },
        },
        is_active: true,
      },
    ],
    mlModelConfigs: [
      {
        id: 'ml-1',
        model_type: 'neural_network',
        hyperparameters: {
          learning_rate: 0.001,
          epochs: 100,
          batch_size: 32,
        },
        training_config: {
          validation_split: 0.2,
        },
        is_active: true,
      },
    ],
    version: {
      versionNumber: 1,
      name: 'v1.0',
      timestamp: '2025-01-01T00:00:00Z',
    },
  };

  console.log('Input (WebSocket message):');
  console.log(JSON.stringify(websocketMessage, null, 2));

  const aiConfig = createAIConfiguration(websocketMessage);

  console.log('\nOutput (AI Configuration):');
  console.log(JSON.stringify(aiConfig, null, 2));

  // Validate configuration
  const validation = validateAIConfiguration(aiConfig);
  console.log('\nValidation Result:');
  console.log(`Valid: ${validation.valid}`);
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }

  return aiConfig;
};

/**
 * Example 6: Key Transformation Utilities
 */
export const exampleKeyTransformations = () => {
  console.log('\n📦 Example 6: Key Transformation Utilities\n');

  // camelCase to snake_case
  console.log('camelCase to snake_case:');
  console.log('  learningRate →', camelToSnake('learningRate'));
  console.log('  maxSimultaneousOff →', camelToSnake('maxSimultaneousOff'));
  console.log('  isHardConstraint →', camelToSnake('isHardConstraint'));

  // snake_case to camelCase
  console.log('\nsnake_case to camelCase:');
  console.log('  learning_rate →', snakeToCamel('learning_rate'));
  console.log('  max_simultaneous_off →', snakeToCamel('max_simultaneous_off'));
  console.log('  is_hard_constraint →', snakeToCamel('is_hard_constraint'));

  // Deep object transformation
  const snakeObject = {
    staff_id: 'staff-1',
    max_count: 5,
    nested_config: {
      learning_rate: 0.001,
      batch_size: 32,
    },
  };

  console.log('\nDeep snake_case object:');
  console.log(JSON.stringify(snakeObject, null, 2));

  const camelObject = transformKeysToCamel(snakeObject);
  console.log('\nTransformed to camelCase:');
  console.log(JSON.stringify(camelObject, null, 2));

  const backToSnake = transformKeysToSnake(camelObject);
  console.log('\nTransformed back to snake_case:');
  console.log(JSON.stringify(backToSnake, null, 2));
};

/**
 * Run all examples
 */
export const runAllExamples = () => {
  console.log('🚀 Running AI Configuration Adapter Examples\n');
  console.log('='.repeat(80));

  exampleStaffGroupsTransformation();
  console.log('\n' + '='.repeat(80));

  exampleDailyLimitsTransformation();
  console.log('\n' + '='.repeat(80));

  examplePriorityRulesTransformation();
  console.log('\n' + '='.repeat(80));

  exampleMLConfigTransformation();
  console.log('\n' + '='.repeat(80));

  exampleCompleteTransformation();
  console.log('\n' + '='.repeat(80));

  exampleKeyTransformations();
  console.log('\n' + '='.repeat(80));

  console.log('\n✅ All examples completed successfully!\n');
};

// Export for testing
export default {
  exampleStaffGroupsTransformation,
  exampleDailyLimitsTransformation,
  examplePriorityRulesTransformation,
  exampleMLConfigTransformation,
  exampleCompleteTransformation,
  exampleKeyTransformations,
  runAllExamples,
};
