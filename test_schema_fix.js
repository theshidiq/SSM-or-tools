// ===============================================
// BROWSER CONSOLE TEST FOR SCHEMA FIX
// ===============================================
// Copy and paste this code into your browser console to test the schema fix
// Run this AFTER applying the SQL schema fix to verify it works

console.log('🔧 Testing Supabase Schema Fix...');

// Test function to verify schema and autosave functionality
async function testSchemaFix() {
  console.log('\n=== SCHEMA FIX VERIFICATION TEST ===\n');
  
  try {
    // Get the configuration service instance
    const configService = window.configService || 
      (await import('./src/services/ConfigurationService.js')).configService;
    
    console.log('✅ ConfigurationService loaded');
    
    // Check current sync status
    const syncStatus = configService.getSyncStatus();
    console.log('📊 Current sync status:', syncStatus);
    
    if (!syncStatus.isSupabaseEnabled) {
      console.error('❌ Supabase is not enabled - check your connection first');
      return false;
    }
    
    console.log('✅ Supabase connection is enabled');
    
    // Test 1: Save Staff Groups (tests group_config column)
    console.log('\n--- Test 1: Staff Groups (group_config column) ---');
    const testStaffGroups = [
      {
        id: 'test-group-1',
        name: 'Test Group 1',
        description: 'Schema test group',
        color: '#FF0000',
        members: ['Test Staff 1', 'Test Staff 2']
      }
    ];
    
    try {
      await configService.updateStaffGroups(testStaffGroups);
      console.log('✅ Staff Groups saved successfully (group_config column working)');
    } catch (error) {
      console.error('❌ Staff Groups save failed:', error.message);
      if (error.message.includes('group_config')) {
        console.error('🔍 Schema Fix Needed: staff_groups table missing group_config column');
      }
    }
    
    // Test 2: Save Daily Limits (tests limit_config column)
    console.log('\n--- Test 2: Daily Limits (limit_config column) ---');
    const testDailyLimits = [
      {
        id: 'test-daily-limit',
        name: 'Test Daily Limit',
        shiftType: 'off',
        maxCount: 3,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        scope: 'all',
        targetIds: [],
        isHardConstraint: true,
        penaltyWeight: 50,
        description: 'Schema test daily limit'
      }
    ];
    
    try {
      await configService.updateDailyLimits(testDailyLimits);
      console.log('✅ Daily Limits saved successfully (limit_config column working)');
    } catch (error) {
      console.error('❌ Daily Limits save failed:', error.message);
      if (error.message.includes('limit_config')) {
        console.error('🔍 Schema Fix Needed: daily_limits table missing limit_config column');
      }
    }
    
    // Test 3: Save Monthly Limits (tests limit_config column)
    console.log('\n--- Test 3: Monthly Limits (limit_config column) ---');
    const testMonthlyLimits = [
      {
        id: 'test-monthly-limit',
        name: 'Test Monthly Limit',
        limitType: 'max_off_days',
        maxCount: 8,
        scope: 'individual',
        targetIds: [],
        distributionRules: {
          maxConsecutive: 2,
          preferWeekends: false
        },
        isHardConstraint: false,
        penaltyWeight: 40,
        description: 'Schema test monthly limit'
      }
    ];
    
    try {
      await configService.updateMonthlyLimits(testMonthlyLimits);
      console.log('✅ Monthly Limits saved successfully (limit_config column working)');
    } catch (error) {
      console.error('❌ Monthly Limits save failed:', error.message);
      if (error.message.includes('limit_config')) {
        console.error('🔍 Schema Fix Needed: monthly_limits table missing limit_config column');
      }
    }
    
    // Test 4: Save Priority Rules (tests rule_config column)
    console.log('\n--- Test 4: Priority Rules (rule_config column) ---');
    const testPriorityRules = [
      {
        id: 'test-priority-rule',
        name: 'Test Priority Rule',
        description: 'Schema test priority rule',
        ruleType: 'preferred_shift',
        staffId: 'test-staff',
        shiftType: 'early',
        daysOfWeek: [1, 2, 3, 4, 5],
        priorityLevel: 3,
        preferenceStrength: 0.8,
        isHardConstraint: false,
        penaltyWeight: 50,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      }
    ];
    
    try {
      await configService.updatePriorityRules(testPriorityRules);
      console.log('✅ Priority Rules saved successfully (rule_config column working)');
    } catch (error) {
      console.error('❌ Priority Rules save failed:', error.message);
      if (error.message.includes('rule_config')) {
        console.error('🔍 Schema Fix Needed: priority_rules table missing rule_config column');
      }
    }
    
    // Test 5: Save ML Config (tests is_active column)
    console.log('\n--- Test 5: ML Config (is_active column) ---');
    const testMLParameters = {
      model_name: 'genetic_algorithm',
      model_type: 'genetic_algorithm',
      parameters: {
        populationSize: 50,
        generations: 100,
        mutationRate: 0.1,
        crossoverRate: 0.8
      },
      confidence_threshold: 0.75
    };
    
    try {
      await configService.updateMLParameters(testMLParameters);
      console.log('✅ ML Config saved successfully (is_active column working)');
    } catch (error) {
      console.error('❌ ML Config save failed:', error.message);
      if (error.message.includes('is_active')) {
        console.error('🔍 Schema Fix Needed: ml_model_configs table missing is_active column');
      }
    }
    
    // Final autosave test
    console.log('\n--- Final Test: Complete Autosave ---');
    try {
      const syncResult = await configService.syncToDatabase();
      if (syncResult.success) {
        console.log('✅ Complete autosave test successful!');
        console.log('🎉 ALL SCHEMA COLUMNS ARE WORKING CORRECTLY');
        return true;
      } else {
        console.error('❌ Complete autosave failed:', syncResult.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Complete autosave error:', error.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    return false;
  }
}

// ===============================================
// SCHEMA VALIDATION FUNCTION
// ===============================================
async function validateSchemaColumns() {
  console.log('\n=== SCHEMA VALIDATION ===\n');
  
  try {
    const { supabase } = await import('./src/utils/supabase.js');
    
    // Test each required column by attempting to query it
    const tests = [
      { table: 'staff_groups', column: 'group_config', description: 'Staff groups JSONB config' },
      { table: 'daily_limits', column: 'limit_config', description: 'Daily limits JSONB config' },
      { table: 'monthly_limits', column: 'limit_config', description: 'Monthly limits JSONB config' },
      { table: 'priority_rules', column: 'rule_config', description: 'Priority rules JSONB config' },
      { table: 'ml_model_configs', column: 'is_active', description: 'ML config active flag' }
    ];
    
    console.log('Testing database columns...\n');
    
    for (const test of tests) {
      try {
        const { error } = await supabase
          .from(test.table)
          .select(test.column)
          .limit(1);
          
        if (error) {
          console.error(`❌ ${test.table}.${test.column} - ${error.message}`);
        } else {
          console.log(`✅ ${test.table}.${test.column} - ${test.description}`);
        }
      } catch (err) {
        console.error(`❌ ${test.table}.${test.column} - Query failed: ${err.message}`);
      }
    }
    
    console.log('\n📋 Schema validation complete');
    
  } catch (error) {
    console.error('❌ Schema validation setup failed:', error);
  }
}

// ===============================================
// USAGE INSTRUCTIONS
// ===============================================
console.log(`
🚀 USAGE INSTRUCTIONS:

1. First run the SQL schema fix in your Supabase SQL Editor
2. Then run: validateSchemaColumns()
3. Finally run: testSchemaFix()

Example:
await validateSchemaColumns()
await testSchemaFix()
`);

// Export functions for manual use
window.testSchemaFix = testSchemaFix;
window.validateSchemaColumns = validateSchemaColumns;

console.log('✅ Test functions loaded. Run validateSchemaColumns() and testSchemaFix() when ready.');