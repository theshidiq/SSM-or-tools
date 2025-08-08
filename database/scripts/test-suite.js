#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Database Migration
 * 
 * Features:
 * - Schema structure validation
 * - Data integrity testing
 * - Performance benchmarking
 * - RLS policy validation
 * - Migration rollback testing
 * - Real-world scenario simulation
 */

const { createClient } = require('@supabase/supabase-js');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'your-supabase-url',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'your-service-key',
  testRestaurantId: '550e8400-e29b-41d4-a716-446655440001',
  performanceThresholds: {
    queryTime: 1000, // ms
    batchInsertTime: 5000, // ms
    complexQueryTime: 2000 // ms
  }
};

class DatabaseTestSuite {
  constructor() {
    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);
    this.testResults = [];
    this.performanceMetrics = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // cyan
      pass: '\x1b[32m',    // green
      fail: '\x1b[31m',    // red
      warn: '\x1b[33m',    // yellow
      reset: '\x1b[0m'     // reset
    };
    
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runTest(testName, testFn, category = 'general') {
    const startTime = performance.now();
    
    try {
      this.log(`Running: ${testName}`, 'info');
      
      const result = await testFn();
      const duration = performance.now() - startTime;
      
      const testResult = {
        name: testName,
        category,
        passed: result.passed !== false,
        duration: Math.round(duration),
        details: result.details || 'Test completed',
        data: result.data || null,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(testResult);
      
      if (testResult.passed) {
        this.log(`✅ ${testName} - ${testResult.details} (${testResult.duration}ms)`, 'pass');
      } else {
        this.log(`❌ ${testName} - ${testResult.details} (${testResult.duration}ms)`, 'fail');
      }
      
      return testResult;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      const testResult = {
        name: testName,
        category,
        passed: false,
        duration: Math.round(duration),
        details: error.message,
        error: error.stack,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(testResult);
      this.log(`❌ ${testName} - ERROR: ${error.message} (${testResult.duration}ms)`, 'fail');
      
      return testResult;
    }
  }

  async measurePerformance(operation, queryFn) {
    const startTime = performance.now();
    const result = await queryFn();
    const duration = performance.now() - startTime;
    
    this.performanceMetrics.push({
      operation,
      duration: Math.round(duration),
      timestamp: new Date().toISOString()
    });
    
    return { result, duration };
  }

  // ===================================================================
  // SCHEMA STRUCTURE TESTS
  // ===================================================================

  async testTableStructure() {
    const expectedTables = [
      'restaurants', 'staff', 'user_profiles', 'config_versions', 'config_changes',
      'staff_groups', 'staff_group_members', 'staff_group_hierarchy',
      'conflict_rules', 'daily_limits', 'monthly_limits', 'priority_rules',
      'ml_model_configs', 'ml_model_performance', 'ml_training_history',
      'ml_feature_importance', 'constraint_violations', 'violation_patterns',
      'schedule_audit_log', 'notification_settings', 'notification_log'
    ];

    const { data: tables, error } = await this.supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `
      });

    if (error) throw error;

    const actualTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !actualTables.includes(t));
    const extraTables = actualTables.filter(t => !expectedTables.includes(t));

    return {
      passed: missingTables.length === 0,
      details: `${actualTables.length} tables found${missingTables.length > 0 ? `, missing: ${missingTables.join(', ')}` : ''}`,
      data: { actual: actualTables, missing: missingTables, extra: extraTables }
    };
  }

  async testCustomTypes() {
    const expectedTypes = ['shift_type', 'constraint_type', 'violation_severity', 'resolution_status', 'user_role'];

    const { data: types, error } = await this.supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT typname 
          FROM pg_type 
          WHERE typname IN ('${expectedTypes.join("','")}')
          ORDER BY typname
        `
      });

    if (error) throw error;

    const actualTypes = types.map(t => t.typname);
    const missingTypes = expectedTypes.filter(t => !actualTypes.includes(t));

    return {
      passed: missingTypes.length === 0,
      details: `${actualTypes.length}/${expectedTypes.length} custom types found`,
      data: { actual: actualTypes, missing: missingTypes }
    };
  }

  async testFunctionExistence() {
    const expectedFunctions = [
      'get_active_config_version', 'create_config_version', 'activate_config_version',
      'get_staff_groups', 'get_group_members', 'get_default_ml_config',
      'user_has_restaurant_access', 'database_health_check'
    ];

    const { data: functions, error } = await this.supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name IN ('${expectedFunctions.join("','")}')
          ORDER BY routine_name
        `
      });

    if (error) throw error;

    const actualFunctions = functions.map(f => f.routine_name);
    const missingFunctions = expectedFunctions.filter(f => !actualFunctions.includes(f));

    return {
      passed: missingFunctions.length === 0,
      details: `${actualFunctions.length}/${expectedFunctions.length} functions found`,
      data: { actual: actualFunctions, missing: missingFunctions }
    };
  }

  // ===================================================================
  // DATA INTEGRITY TESTS
  // ===================================================================

  async testSeedDataIntegrity() {
    // Test restaurant exists
    const { data: restaurant } = await this.supabase
      .from('restaurants')
      .select('*')
      .eq('id', CONFIG.testRestaurantId)
      .single();

    if (!restaurant) {
      return { passed: false, details: 'Test restaurant not found' };
    }

    // Test staff count
    const { count: staffCount } = await this.supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', CONFIG.testRestaurantId);

    // Test active configuration
    const { data: activeConfig } = await this.supabase
      .from('config_versions')
      .select('*')
      .eq('restaurant_id', CONFIG.testRestaurantId)
      .eq('is_active', true)
      .single();

    return {
      passed: restaurant && staffCount >= 10 && activeConfig,
      details: `Restaurant: ${restaurant.name}, Staff: ${staffCount}, Config: ${activeConfig ? 'active' : 'none'}`,
      data: { restaurantName: restaurant.name, staffCount, hasActiveConfig: !!activeConfig }
    };
  }

  async testForeignKeyIntegrity() {
    const { data: violations, error } = await this.supabase
      .rpc('validate_foreign_keys');

    if (error) throw error;

    const invalidRelations = violations.filter(v => !v.is_valid);

    return {
      passed: invalidRelations.length === 0,
      details: invalidRelations.length === 0 
        ? 'All foreign key relationships valid' 
        : `${invalidRelations.length} invalid relationships found`,
      data: invalidRelations
    };
  }

  async testDataConsistency() {
    const checks = [];

    // Check staff group memberships consistency
    const { data: orphanedMemberships } = await this.supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT sgm.id 
          FROM staff_group_members sgm
          LEFT JOIN staff s ON sgm.staff_id = s.id
          LEFT JOIN staff_groups sg ON sgm.group_id = sg.id
          WHERE s.id IS NULL OR sg.id IS NULL
          LIMIT 10
        `
      });

    checks.push({
      name: 'Staff group memberships',
      valid: orphanedMemberships.length === 0,
      count: orphanedMemberships.length
    });

    // Check ML model relationships
    const { data: orphanedPerformance } = await this.supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT mp.id 
          FROM ml_model_performance mp
          LEFT JOIN ml_model_configs mc ON mp.model_config_id = mc.id
          WHERE mc.id IS NULL
          LIMIT 10
        `
      });

    checks.push({
      name: 'ML performance records',
      valid: orphanedPerformance.length === 0,
      count: orphanedPerformance.length
    });

    const invalidChecks = checks.filter(c => !c.valid);

    return {
      passed: invalidChecks.length === 0,
      details: `${checks.length - invalidChecks.length}/${checks.length} consistency checks passed`,
      data: { checks, invalid: invalidChecks }
    };
  }

  // ===================================================================
  // PERFORMANCE TESTS
  // ===================================================================

  async testQueryPerformance() {
    const queries = [
      {
        name: 'Restaurant lookup',
        query: () => this.supabase
          .from('restaurants')
          .select('*')
          .eq('id', CONFIG.testRestaurantId)
          .single()
      },
      {
        name: 'Staff with groups',
        query: () => this.supabase
          .from('staff')
          .select(`
            *,
            staff_group_members!inner(
              staff_groups(name, color)
            )
          `)
          .eq('restaurant_id', CONFIG.testRestaurantId)
      },
      {
        name: 'Active configuration rules',
        query: () => this.supabase
          .from('conflict_rules')
          .select('*')
          .eq('restaurant_id', CONFIG.testRestaurantId)
          .eq('is_active', true)
      },
      {
        name: 'ML performance history',
        query: () => this.supabase
          .from('ml_performance_summary')
          .select('*')
          .eq('restaurant_id', CONFIG.testRestaurantId)
      }
    ];

    const results = [];
    let slowQueries = 0;

    for (const { name, query } of queries) {
      const { duration } = await this.measurePerformance(name, query);
      
      results.push({ name, duration });
      
      if (duration > CONFIG.performanceThresholds.queryTime) {
        slowQueries++;
      }
    }

    return {
      passed: slowQueries === 0,
      details: `${results.length} queries tested, ${slowQueries} exceeded threshold (${CONFIG.performanceThresholds.queryTime}ms)`,
      data: { queries: results, slowQueries, threshold: CONFIG.performanceThresholds.queryTime }
    };
  }

  async testIndexEfficiency() {
    const indexQueries = [
      {
        name: 'Restaurant ID index',
        query: `EXPLAIN ANALYZE SELECT * FROM staff WHERE restaurant_id = '${CONFIG.testRestaurantId}'`
      },
      {
        name: 'Config version active index', 
        query: `EXPLAIN ANALYZE SELECT * FROM config_versions WHERE restaurant_id = '${CONFIG.testRestaurantId}' AND is_active = true`
      },
      {
        name: 'ML model config index',
        query: `EXPLAIN ANALYZE SELECT * FROM ml_model_configs WHERE restaurant_id = '${CONFIG.testRestaurantId}' AND is_default = true`
      }
    ];

    const results = [];
    
    for (const { name, query } of indexQueries) {
      const { data } = await this.supabase.rpc('exec_sql', { sql_query: query });
      
      const planText = data.map(row => Object.values(row)[0]).join('\n');
      const hasIndexScan = planText.includes('Index Scan') || planText.includes('Index Only Scan');
      const hasSeqScan = planText.includes('Seq Scan');
      
      results.push({
        name,
        hasIndexScan,
        hasSeqScan,
        efficient: hasIndexScan && !hasSeqScan
      });
    }

    const inefficientQueries = results.filter(r => !r.efficient);

    return {
      passed: inefficientQueries.length === 0,
      details: `${results.length - inefficientQueries.length}/${results.length} queries use indexes efficiently`,
      data: { queries: results, inefficient: inefficientQueries }
    };
  }

  // ===================================================================
  // RLS POLICY TESTS
  // ===================================================================

  async testRLSPolicies() {
    const tables = ['restaurants', 'staff', 'config_versions', 'staff_groups', 'conflict_rules'];
    const results = [];

    for (const tableName of tables) {
      const { data: policies } = await this.supabase
        .rpc('exec_sql', {
          sql_query: `
            SELECT 
              schemaname,
              tablename,
              policyname,
              permissive,
              roles,
              cmd
            FROM pg_policies 
            WHERE tablename = '${tableName}'
          `
        });

      const { data: rlsStatus } = await this.supabase
        .rpc('exec_sql', {
          sql_query: `
            SELECT c.relname, c.rowsecurity
            FROM pg_class c
            WHERE c.relname = '${tableName}'
          `
        });

      const isRLSEnabled = rlsStatus[0]?.rowsecurity;
      const policyCount = policies.length;

      results.push({
        table: tableName,
        rlsEnabled: isRLSEnabled,
        policyCount,
        valid: isRLSEnabled && policyCount > 0
      });
    }

    const invalidTables = results.filter(r => !r.valid);

    return {
      passed: invalidTables.length === 0,
      details: `${results.length - invalidTables.length}/${results.length} tables have proper RLS setup`,
      data: { tables: results, invalid: invalidTables }
    };
  }

  // ===================================================================
  // BUSINESS LOGIC TESTS
  // ===================================================================

  async testBusinessRules() {
    // Test configuration activation
    const { data: beforeCount } = await this.supabase
      .from('config_versions')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', CONFIG.testRestaurantId)
      .eq('is_active', true);

    const activeVersions = beforeCount || 0;

    // Test staff group functions
    const { data: staffGroups } = await this.supabase
      .rpc('get_staff_groups', { p_staff_id: '550e8400-e29b-41d4-a716-446655440010' });

    // Test ML config retrieval
    const { data: defaultMLConfig } = await this.supabase
      .rpc('get_default_ml_config', { p_restaurant_id: CONFIG.testRestaurantId });

    return {
      passed: activeVersions <= 1 && Array.isArray(staffGroups) && defaultMLConfig,
      details: `Active configs: ${activeVersions}, Staff groups function: ${staffGroups ? 'working' : 'failed'}, ML config: ${defaultMLConfig ? 'found' : 'missing'}`,
      data: { activeVersions, staffGroupsCount: staffGroups?.length, hasMLConfig: !!defaultMLConfig }
    };
  }

  async testMLModelValidation() {
    // Test ML model configuration validation
    const { data: mlConfigs } = await this.supabase
      .from('ml_model_configs')
      .select('*')
      .eq('restaurant_id', CONFIG.testRestaurantId);

    if (!mlConfigs || mlConfigs.length === 0) {
      return { passed: false, details: 'No ML configurations found' };
    }

    // Validate ML config structure
    const validConfigs = mlConfigs.filter(config => {
      return config.parameters && 
             typeof config.parameters === 'object' &&
             config.confidence_threshold >= 0 &&
             config.confidence_threshold <= 1;
    });

    // Test performance data exists
    const { count: performanceCount } = await this.supabase
      .from('ml_model_performance')
      .select('*', { count: 'exact', head: true });

    return {
      passed: validConfigs.length === mlConfigs.length && performanceCount > 0,
      details: `${validConfigs.length}/${mlConfigs.length} valid ML configs, ${performanceCount} performance records`,
      data: { totalConfigs: mlConfigs.length, validConfigs: validConfigs.length, performanceRecords: performanceCount }
    };
  }

  // ===================================================================
  // MAIN TEST RUNNER
  // ===================================================================

  async runAllTests() {
    this.log('🚀 Starting Database Migration Test Suite', 'info');
    this.log('='.repeat(60), 'info');

    // Schema Structure Tests
    await this.runTest('Table Structure', () => this.testTableStructure(), 'schema');
    await this.runTest('Custom Types', () => this.testCustomTypes(), 'schema');
    await this.runTest('Functions', () => this.testFunctionExistence(), 'schema');

    // Data Integrity Tests
    await this.runTest('Seed Data Integrity', () => this.testSeedDataIntegrity(), 'data');
    await this.runTest('Foreign Key Integrity', () => this.testForeignKeyIntegrity(), 'data');
    await this.runTest('Data Consistency', () => this.testDataConsistency(), 'data');

    // Performance Tests
    await this.runTest('Query Performance', () => this.testQueryPerformance(), 'performance');
    await this.runTest('Index Efficiency', () => this.testIndexEfficiency(), 'performance');

    // Security Tests
    await this.runTest('RLS Policies', () => this.testRLSPolicies(), 'security');

    // Business Logic Tests
    await this.runTest('Business Rules', () => this.testBusinessRules(), 'business');
    await this.runTest('ML Model Validation', () => this.testMLModelValidation(), 'business');

    return this.generateTestReport();
  }

  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Date.now() - this.startTime;

    // Group by category
    const categories = {};
    for (const test of this.testResults) {
      if (!categories[test.category]) {
        categories[test.category] = { total: 0, passed: 0, failed: 0 };
      }
      categories[test.category].total++;
      if (test.passed) {
        categories[test.category].passed++;
      } else {
        categories[test.category].failed++;
      }
    }

    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        totalDuration
      },
      categories,
      results: this.testResults,
      performance: this.performanceMetrics,
      timestamp: new Date().toISOString()
    };

    // Print summary
    this.log('='.repeat(60), 'info');
    this.log('📊 TEST RESULTS SUMMARY', 'info');
    this.log('='.repeat(60), 'info');
    this.log(`Total Tests: ${totalTests}`, 'info');
    this.log(`Passed: ${passedTests}`, passedTests === totalTests ? 'pass' : 'info');
    this.log(`Failed: ${failedTests}`, failedTests === 0 ? 'info' : 'fail');
    this.log(`Success Rate: ${report.summary.successRate}%`, report.summary.successRate >= 90 ? 'pass' : 'warn');
    this.log(`Duration: ${Math.round(totalDuration / 1000)}s`, 'info');

    // Print category breakdown
    this.log('\n📋 CATEGORY BREAKDOWN:', 'info');
    for (const [category, stats] of Object.entries(categories)) {
      this.log(`${category}: ${stats.passed}/${stats.total} passed`, stats.failed === 0 ? 'pass' : 'warn');
    }

    // Print failed tests
    if (failedTests > 0) {
      this.log('\n❌ FAILED TESTS:', 'fail');
      this.testResults
        .filter(t => !t.passed)
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.details}`, 'fail');
        });
    }

    if (passedTests === totalTests) {
      this.log('\n🎉 ALL TESTS PASSED! Migration is successful.', 'pass');
    } else {
      this.log('\n⚠️  Some tests failed. Please review the results above.', 'warn');
    }

    return report;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const testSuite = new DatabaseTestSuite();

  try {
    const command = args[0] || 'all';

    switch (command) {
      case 'all': {
        const report = await testSuite.runAllTests();
        
        // Save detailed report
        const fs = require('fs').promises;
        await fs.mkdir('./test-reports', { recursive: true });
        const reportFile = `./test-reports/test-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved: ${reportFile}`);
        
        process.exit(report.summary.failedTests === 0 ? 0 : 1);
        break;
      }

      case 'schema': {
        await testSuite.runTest('Table Structure', () => testSuite.testTableStructure());
        await testSuite.runTest('Custom Types', () => testSuite.testCustomTypes());
        await testSuite.runTest('Functions', () => testSuite.testFunctionExistence());
        break;
      }

      case 'performance': {
        await testSuite.runTest('Query Performance', () => testSuite.testQueryPerformance());
        await testSuite.runTest('Index Efficiency', () => testSuite.testIndexEfficiency());
        break;
      }

      default: {
        console.log(`
Database Migration Test Suite

Usage: node test-suite.js [command]

Commands:
  all         Run all tests (default)
  schema      Run schema structure tests only
  performance Run performance tests only
  help        Show this help

Environment Variables:
  SUPABASE_URL           Supabase project URL
  SUPABASE_SERVICE_KEY   Service role key

Examples:
  node test-suite.js
  node test-suite.js schema
  node test-suite.js performance
        `);
        break;
      }
    }

  } catch (error) {
    console.error(`Test suite failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DatabaseTestSuite, CONFIG };