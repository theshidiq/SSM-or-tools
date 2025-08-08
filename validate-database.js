#!/usr/bin/env node

/**
 * Database Validation Script for Shift Schedule Manager
 * 
 * This script validates that all required database tables exist and are properly configured.
 * It checks for common issues and provides troubleshooting guidance.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const CONFIG = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY,
  verbose: process.argv.includes('--verbose'),
  fix: process.argv.includes('--fix')
};

class DatabaseValidator {
  constructor() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_SERVICE_KEY');
      process.exit(1);
    }

    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  log(level, message, data = null) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      debug: '\x1b[90m'
    };
    
    const color = colors[level] || '\x1b[0m';
    console.log(`${color}${message}\x1b[0m`);
    
    if (data && CONFIG.verbose) {
      console.log(`${color}${JSON.stringify(data, null, 2)}\x1b[0m`);
    }
  }

  async testConnection() {
    this.log('info', '🔍 Testing Supabase connection...');
    
    try {
      const { error } = await this.supabase.from('restaurants').select('count').limit(1);
      
      if (error && !['PGRST116', '42P01'].includes(error.code)) {
        throw error;
      }
      
      this.log('success', '✅ Connection successful');
      this.passed.push('Database connection');
      return true;
    } catch (error) {
      this.log('error', '❌ Connection failed: ' + error.message);
      this.issues.push({
        type: 'connection',
        message: 'Database connection failed',
        error: error.message,
        fix: 'Check your Supabase URL and service key'
      });
      return false;
    }
  }

  async checkTableExists(tableName) {
    try {
      const { error } = await this.supabase.from(tableName).select('*').limit(1);
      
      if (error && error.code === '42P01') {
        return false; // Table does not exist
      }
      
      return true; // Table exists (even if empty)
    } catch (error) {
      return false;
    }
  }

  async validateRequiredTables() {
    this.log('info', '📋 Checking required tables...');

    const requiredTables = [
      'restaurants',
      'config_versions', 
      'ml_model_configs',
      'conflict_rules',
      'priority_rules',
      'staff_groups',
      'daily_limits',
      'monthly_limits',
      'staff',
      'staff_group_members'
    ];

    const missingTables = [];

    for (const table of requiredTables) {
      const exists = await this.checkTableExists(table);
      
      if (exists) {
        this.log('success', `✅ Table exists: ${table}`);
        this.passed.push(`Table: ${table}`);
      } else {
        this.log('error', `❌ Missing table: ${table}`);
        missingTables.push(table);
        this.issues.push({
          type: 'missing_table',
          table,
          message: `Required table '${table}' does not exist`,
          fix: 'Run the database setup script: node database-setup-complete.js'
        });
      }
    }

    return missingTables;
  }

  async validateDataIntegrity() {
    this.log('info', '🔍 Checking data integrity...');

    const checks = [
      {
        name: 'Default restaurant exists',
        query: "SELECT COUNT(*) as count FROM restaurants WHERE name LIKE '%Sakura%' OR name = 'My Restaurant'",
        expected: 1,
        fix: 'Create a default restaurant in the restaurants table'
      },
      {
        name: 'Staff members exist',
        query: 'SELECT COUNT(*) as count FROM staff',
        expected: 1,
        fix: 'Add staff members to the staff table'
      },
      {
        name: 'Active configuration version',
        query: 'SELECT COUNT(*) as count FROM config_versions WHERE is_active = true',
        expected: 1,
        fix: 'Create and activate a configuration version'
      },
      {
        name: 'ML model configuration',
        query: 'SELECT COUNT(*) as count FROM ml_model_configs WHERE is_default = true',
        expected: 1,
        fix: 'Create a default ML model configuration'
      }
    ];

    for (const check of checks) {
      try {
        // Try using RPC first
        let result;
        try {
          const { data, error } = await this.supabase.rpc('exec_sql', { sql_query: check.query });
          if (error) throw error;
          result = data?.[0]?.count || 0;
        } catch (rpcError) {
          // Fallback: try to estimate from table queries
          const tableName = check.query.match(/FROM (\w+)/)?.[1];
          if (tableName) {
            const { data, error } = await this.supabase
              .from(tableName)
              .select('*', { count: 'exact' });
            
            if (error && error.code !== '42P01') throw error;
            result = data?.length || 0;
          } else {
            throw rpcError;
          }
        }

        if (result >= check.expected) {
          this.log('success', `✅ ${check.name}: ${result}`);
          this.passed.push(check.name);
        } else {
          this.log('warn', `⚠️ ${check.name}: ${result}/${check.expected}`);
          this.warnings.push({
            type: 'data_integrity',
            check: check.name,
            actual: result,
            expected: check.expected,
            message: `${check.name} check failed`,
            fix: check.fix
          });
        }

      } catch (error) {
        this.log('error', `❌ ${check.name}: Query failed - ${error.message}`);
        this.issues.push({
          type: 'query_failed',
          check: check.name,
          message: `Data integrity check failed`,
          error: error.message,
          fix: check.fix
        });
      }
    }
  }

  async validateFunctions() {
    this.log('info', '⚙️ Checking database functions...');

    const functions = [
      'get_active_config_version',
      'create_config_version',
      'activate_config_version'
    ];

    for (const funcName of functions) {
      try {
        // Try to call the function with dummy parameters to test existence
        const { error } = await this.supabase.rpc(funcName, {});
        
        if (error && error.code === '42883') {
          // Function does not exist
          this.log('warn', `⚠️ Function missing: ${funcName}`);
          this.warnings.push({
            type: 'missing_function',
            function: funcName,
            message: `Database function '${funcName}' does not exist`,
            fix: 'Run the database setup script to create functions'
          });
        } else {
          // Function exists (even if call failed due to parameters)
          this.log('success', `✅ Function exists: ${funcName}`);
          this.passed.push(`Function: ${funcName}`);
        }

      } catch (error) {
        this.log('warn', `⚠️ Could not verify function: ${funcName}`);
        this.warnings.push({
          type: 'function_check_failed',
          function: funcName,
          message: `Could not verify function existence`,
          error: error.message
        });
      }
    }
  }

  async checkApplicationReadiness() {
    this.log('info', '🚀 Testing application readiness...');

    try {
      // Simulate what the ConfigurationService does
      const { ConfigurationService } = require('./src/services/ConfigurationService.js');
      
      // Test initialization (this will use fallbacks if tables are missing)
      const configService = new ConfigurationService();
      
      // Don't actually initialize - just test if the class loads
      this.log('success', '✅ ConfigurationService can be loaded');
      this.passed.push('ConfigurationService loading');

    } catch (error) {
      this.log('error', `❌ ConfigurationService failed to load: ${error.message}`);
      this.issues.push({
        type: 'service_load_failed',
        message: 'ConfigurationService failed to load',
        error: error.message,
        fix: 'Check for syntax errors in the service file'
      });
    }
  }

  generateReport() {
    this.log('info', '\n📊 Validation Report:');
    this.log('success', `✅ Passed: ${this.passed.length} checks`);
    this.log('warn', `⚠️ Warnings: ${this.warnings.length} issues`);
    this.log('error', `❌ Errors: ${this.issues.length} critical issues`);

    if (this.issues.length > 0) {
      this.log('error', '\n❌ Critical Issues:');
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.message}`);
        if (issue.error) {
          console.log(`   Error: ${issue.error}`);
        }
        if (issue.table) {
          console.log(`   Table: ${issue.table}`);
        }
        console.log(`   💡 Fix: ${issue.fix}`);
      });
    }

    if (this.warnings.length > 0) {
      this.log('warn', '\n⚠️ Warnings:');
      this.warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${warning.message}`);
        if (warning.actual !== undefined && warning.expected !== undefined) {
          console.log(`   Found: ${warning.actual}, Expected: ${warning.expected}`);
        }
        if (warning.error) {
          console.log(`   Error: ${warning.error}`);
        }
        console.log(`   💡 Fix: ${warning.fix}`);
      });
    }

    if (CONFIG.verbose && this.passed.length > 0) {
      this.log('success', '\n✅ Passed Checks:');
      this.passed.forEach(check => {
        console.log(`   ✓ ${check}`);
      });
    }
  }

  provideTroubleshootingGuidance() {
    this.log('info', '\n🔧 Troubleshooting Guide:');

    if (this.issues.some(i => i.type === 'missing_table')) {
      console.log('\n🏗️ Missing Tables:');
      console.log('   1. Run the complete database setup:');
      console.log('      node database-setup-complete.js --force');
      console.log('   2. Or use the migration system:');
      console.log('      node database/scripts/migrate.js run --force');
    }

    if (this.warnings.some(w => w.type === 'data_integrity')) {
      console.log('\n📊 Data Issues:');
      console.log('   1. Seed default data:');
      console.log('      node database-setup-complete.js --force');
      console.log('   2. Or manually create required records');
    }

    if (this.issues.some(i => i.type === 'connection')) {
      console.log('\n🔌 Connection Issues:');
      console.log('   1. Check your .env file:');
      console.log('      REACT_APP_SUPABASE_URL=https://your-project.supabase.co');
      console.log('      REACT_APP_SUPABASE_SERVICE_KEY=your-service-key');
      console.log('   2. Verify your Supabase project is active');
      console.log('   3. Check Row Level Security policies');
    }

    console.log('\n🚀 Application Status:');
    if (this.issues.length === 0) {
      console.log('   ✅ Ready to run! Start with: npm start');
    } else if (this.issues.length <= 2) {
      console.log('   ⚠️ App will work with fallbacks, but setup recommended');
    } else {
      console.log('   ❌ Setup required before running the application');
    }

    console.log('\n📚 Additional Help:');
    console.log('   - Documentation: README.md');
    console.log('   - Database docs: database/README.md');
    console.log('   - Setup script: node database-setup-complete.js --help');
  }

  async run() {
    console.log('🔍 Database Validation for Shift Schedule Manager\n');

    // Test connection
    const connected = await this.testConnection();
    if (!connected && !CONFIG.fix) {
      process.exit(1);
    }

    // Check required tables
    const missingTables = await this.validateRequiredTables();

    // Check data integrity (only if tables exist)
    if (missingTables.length < 5) {
      await this.validateDataIntegrity();
    }

    // Check functions
    await this.validateFunctions();

    // Check application readiness
    await this.checkApplicationReadiness();

    // Generate report
    this.generateReport();

    // Provide guidance
    this.provideTroubleshootingGuidance();

    // Exit with appropriate code
    if (this.issues.length > 0) {
      process.exit(1);
    } else if (this.warnings.length > 0) {
      process.exit(2); // Warnings but not critical
    } else {
      process.exit(0); // All good
    }
  }
}

// CLI interface
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log(`
Database Validation Script

Usage: node validate-database.js [options]

Options:
  --verbose    Show detailed output
  --fix        Attempt to fix issues (not implemented yet)
  --help       Show this help

Exit codes:
  0    All checks passed
  1    Critical issues found
  2    Warnings but application should work
`);
    process.exit(0);
  }

  const validator = new DatabaseValidator();
  validator.run().catch(console.error);
}

module.exports = { DatabaseValidator };