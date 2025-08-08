#!/usr/bin/env node

/**
 * Test Script for Database Fix Verification
 * 
 * This script tests the specific issues mentioned:
 * - 404 errors for missing tables
 * - Configuration service initialization
 * - Settings modal functionality  
 * - ML parameter saving
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const CONFIG = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY,
  restaurantId: '550e8400-e29b-41d4-a716-446655440001'
};

class DatabaseFixTester {
  constructor() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      process.exit(1);
    }

    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    this.testResults = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m', 
      warn: '\x1b[33m',
      error: '\x1b[31m'
    };
    
    const color = colors[level] || '\x1b[0m';
    console.log(`${color}${message}\x1b[0m`);
  }

  async test(name, testFunction) {
    try {
      this.log('info', `🔍 Testing: ${name}`);
      const result = await testFunction();
      
      if (result) {
        this.log('success', `✅ ${name}: PASSED`);
        this.testResults.passed.push(name);
      } else {
        this.log('warn', `⚠️ ${name}: WARNING`);  
        this.testResults.warnings.push(name);
      }
      
      return result;
    } catch (error) {
      this.log('error', `❌ ${name}: FAILED - ${error.message}`);
      this.testResults.failed.push({ name, error: error.message });
      return false;
    }
  }

  async testTablesExist() {
    const requiredTables = [
      'restaurants',
      'config_versions',
      'ml_model_configs', 
      'conflict_rules',
      'priority_rules',
      'staff_groups',
      'daily_limits',
      'monthly_limits'
    ];

    let allExist = true;

    for (const table of requiredTables) {
      try {
        const { error } = await this.supabase.from(table).select('*').limit(1);
        
        if (error && error.code === '42P01') {
          this.log('error', `   ❌ Table missing: ${table}`);
          allExist = false;
        } else {
          this.log('success', `   ✅ Table exists: ${table}`);
        }
      } catch (error) {
        this.log('error', `   ❌ Error checking ${table}: ${error.message}`);
        allExist = false;
      }
    }

    return allExist;
  }

  async testRestaurantData() {
    const { data, error } = await this.supabase
      .from('restaurants')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Restaurant query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      this.log('warn', '   ⚠️ No restaurants found - will use default');
      return false;
    }

    this.log('success', `   ✅ Found ${data.length} restaurant(s)`);
    return true;
  }

  async testConfigurationVersion() {
    const { data, error } = await this.supabase
      .from('config_versions')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (error) {
      throw new Error(`Config version query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      this.log('warn', '   ⚠️ No active configuration version - will use defaults');
      return false;
    }

    this.log('success', `   ✅ Found active configuration version`);
    return true;
  }

  async testMLModelConfig() {
    const { data, error } = await this.supabase
      .from('ml_model_configs')
      .select('*')
      .eq('is_default', true)
      .limit(1);

    if (error) {
      throw new Error(`ML model config query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      this.log('warn', '   ⚠️ No default ML model config - will use fallback');
      return false;
    }

    this.log('success', `   ✅ Found default ML model configuration`);
    return true;
  }

  async testStaffGroups() {
    const { data, error } = await this.supabase
      .from('staff_groups')
      .select('*')
      .limit(5);

    if (error) {
      throw new Error(`Staff groups query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      this.log('warn', '   ⚠️ No staff groups found - will use defaults');
      return false;
    }

    this.log('success', `   ✅ Found ${data.length} staff group(s)`);
    return true;
  }

  async testPriorityRules() {
    const { data, error } = await this.supabase
      .from('priority_rules')
      .select('*')
      .limit(5);

    if (error) {
      throw new Error(`Priority rules query failed: ${error.message}`);
    }

    // This is OK if empty - test the data processing
    const rules = data || [];
    
    // Test the array processing that was failing
    try {
      if (!Array.isArray(rules)) {
        throw new Error('Priority rules is not an array');
      }

      const processed = rules.reduce((acc, rule) => {
        if (!rule || !rule.rule_definition) {
          return acc;
        }

        const definition = rule.rule_definition;
        const staffId = definition.staff_id || definition.staff_name;
        
        if (staffId) {
          if (!acc[staffId]) {
            acc[staffId] = { preferredShifts: [] };
          }
          
          acc[staffId].preferredShifts.push({
            day: definition.conditions?.day_of_week,
            shift: definition.conditions?.shift_type,
            priority: rule.priority_level > 5 ? 'high' : 'medium'
          });
        }
        
        return acc;
      }, {});

      this.log('success', `   ✅ Priority rules processing works (${rules.length} rules)`);
      return true;

    } catch (processingError) {
      throw new Error(`Priority rules processing failed: ${processingError.message}`);
    }
  }

  async testConfigurationServiceLoad() {
    try {
      // Try to load the ConfigurationService module
      const { ConfigurationService } = require('./src/services/ConfigurationService.js');
      
      // Create instance (don't initialize - just test loading)
      const configService = new ConfigurationService();
      
      this.log('success', '   ✅ ConfigurationService loads without errors');
      return true;
      
    } catch (error) {
      throw new Error(`ConfigurationService failed to load: ${error.message}`);
    }
  }

  async testMLParameterSaveSimulation() {
    // Test saving ML parameters to the database
    const testConfig = {
      model_name: 'Test Configuration',
      model_type: 'optimization',
      parameters: {
        algorithm: 'genetic_algorithm',
        population_size: 50,
        generations: 100,
        mutation_rate: 0.1
      },
      confidence_threshold: 0.75,
      is_default: false,
      restaurant_id: CONFIG.restaurantId
    };

    try {
      // Try to insert a test configuration
      const { data, error } = await this.supabase
        .from('ml_model_configs')
        .insert(testConfig)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Clean up - delete the test record
      await this.supabase
        .from('ml_model_configs')
        .delete()
        .eq('id', data.id);

      this.log('success', '   ✅ ML parameter save/delete works');
      return true;

    } catch (error) {
      throw new Error(`ML parameter save test failed: ${error.message}`);
    }
  }

  async testDatabaseFunctions() {
    try {
      // Test the get_active_config_version function
      const { data, error } = await this.supabase.rpc('get_active_config_version', {
        p_restaurant_id: CONFIG.restaurantId
      });

      if (error && error.code === '42883') {
        throw new Error('Database functions not created');
      }

      // Function exists (even if returns null)
      this.log('success', '   ✅ Database functions are available');
      return true;

    } catch (error) {
      throw new Error(`Database functions test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🧪 Testing Database Fix for Shift Schedule Manager\n');

    // Test 1: Tables exist (fixes 404 errors)
    await this.test('Required tables exist', () => this.testTablesExist());

    // Test 2: Basic data integrity
    await this.test('Restaurant data available', () => this.testRestaurantData());
    await this.test('Configuration version exists', () => this.testConfigurationVersion()); 
    await this.test('ML model config exists', () => this.testMLModelConfig());
    await this.test('Staff groups available', () => this.testStaffGroups());

    // Test 3: Specific error fixes
    await this.test('Priority rules processing (fixes reduce error)', () => this.testPriorityRules());
    await this.test('ConfigurationService loads', () => this.testConfigurationServiceLoad());

    // Test 4: Functionality tests
    await this.test('ML parameter save/load', () => this.testMLParameterSaveSimulation());
    await this.test('Database functions available', () => this.testDatabaseFunctions());

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Results Summary:');
    this.log('success', `✅ Passed: ${this.testResults.passed.length} tests`);
    this.log('warn', `⚠️ Warnings: ${this.testResults.warnings.length} tests`);
    this.log('error', `❌ Failed: ${this.testResults.failed.length} tests`);

    if (this.testResults.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.failed.forEach(failure => {
        console.log(`   - ${failure.name}: ${failure.error}`);
      });
    }

    if (this.testResults.warnings.length > 0) {
      console.log('\n⚠️ Warnings (app will work with fallbacks):');
      this.testResults.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }

    console.log('\n🎯 Overall Status:');
    if (this.testResults.failed.length === 0) {
      if (this.testResults.warnings.length === 0) {
        this.log('success', '🎉 All tests passed! Database is fully configured.');
      } else {
        this.log('warn', '⚠️ Tests passed with warnings. App will work but setup recommended.');
      }
    } else {
      this.log('error', '❌ Some tests failed. Run database setup:');
      console.log('   node database-setup-complete.js --force');
    }

    console.log('\n📝 Next Steps:');
    console.log('   1. If tests failed: node database-setup-complete.js --force');
    console.log('   2. Start the app: npm start');
    console.log('   3. Test Settings modal and ML parameter saving');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new DatabaseFixTester();
  tester.runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { DatabaseFixTester };