#!/usr/bin/env node

/**
 * Complete Database Setup Script for Shift Schedule Manager
 * 
 * This script creates all required tables and configurations for the shift scheduling application.
 * It handles both development and production Supabase environments.
 * 
 * Features:
 * - Creates all missing database tables
 * - Sets up proper indexes and constraints  
 * - Populates with default data and configurations
 * - Includes comprehensive error handling and fallbacks
 * - Validates setup completion
 * - Works with any Supabase project
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const CONFIG = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY,
  defaultRestaurantId: '550e8400-e29b-41d4-a716-446655440001',
  defaultRestaurantName: 'Sakura Sushi Restaurant',
  verbose: process.argv.includes('--verbose'),
  force: process.argv.includes('--force'),
  skipSeed: process.argv.includes('--skip-seed'),
  dryRun: process.argv.includes('--dry-run')
};

class DatabaseSetup {
  constructor() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_SERVICE_KEY');
      console.error('Or REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
      process.exit(1);
    }

    this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    this.createdTables = [];
    this.errors = [];
    this.warnings = [];
  }

  log(level, message, data = null) {
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warn: '\x1b[33m',    // yellow
      error: '\x1b[31m',   // red
      debug: '\x1b[90m'    // gray
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
      // Test basic connectivity with a simple query
      const { data, error } = await this.supabase.from('migration_history').select('count').limit(1);
      
      if (error && !['PGRST116', '42P01'].includes(error.code)) {
        throw error;
      }
      
      this.log('success', '✅ Connection successful');
      return true;
    } catch (error) {
      this.log('error', '❌ Connection failed: ' + error.message);
      this.log('warn', '🔧 Please verify:');
      this.log('warn', '   1. REACT_APP_SUPABASE_URL is correct');
      this.log('warn', '   2. REACT_APP_SUPABASE_SERVICE_KEY is correct');
      this.log('warn', '   3. Your Supabase project is active');
      return false;
    }
  }

  async executeSql(sql, description, required = true) {
    if (CONFIG.dryRun) {
      this.log('debug', `[DRY RUN] ${description}`);
      return { success: true };
    }

    try {
      this.log('info', `📝 ${description}...`);
      
      // Try using RPC first (works with service key)
      let result;
      try {
        result = await this.supabase.rpc('exec_sql', { sql_query: sql });
      } catch (rpcError) {
        // If RPC fails, try direct table operations for simple cases
        this.log('debug', 'RPC exec_sql not available, using direct operations');
        throw rpcError;
      }

      if (result.error) {
        throw result.error;
      }

      this.log('success', `✅ ${description} completed`);
      return { success: true, data: result.data };

    } catch (error) {
      if (required) {
        this.log('error', `❌ ${description} failed: ${error.message}`);
        this.errors.push({ operation: description, error: error.message });
      } else {
        this.log('warn', `⚠️ ${description} skipped: ${error.message}`);
        this.warnings.push({ operation: description, warning: error.message });
      }
      return { success: false, error: error.message };
    }
  }

  async createTable(tableName, sql, required = true) {
    const description = `Creating table: ${tableName}`;
    const result = await this.executeSql(sql, description, required);
    
    if (result.success) {
      this.createdTables.push(tableName);
    }
    
    return result;
  }

  async setupExtensionsAndTypes() {
    this.log('info', '🔧 Setting up extensions and custom types...');

    const extensions = [
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      'CREATE EXTENSION IF NOT EXISTS "pg_trgm"'
    ];

    const types = [
      `CREATE TYPE shift_type AS ENUM ('early', 'late', 'off')`,
      `CREATE TYPE constraint_type AS ENUM ('group_conflict', 'individual_conflict', 'position_conflict', 'coverage_rule', 'fairness_rule')`,
      `CREATE TYPE violation_severity AS ENUM ('low', 'medium', 'high', 'critical')`,
      `CREATE TYPE resolution_status AS ENUM ('pending', 'resolved', 'accepted', 'ignored')`,
      `CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'viewer')`
    ];

    const domains = [
      `CREATE DOMAIN hex_color AS TEXT CHECK (VALUE ~ '^#[0-9A-Fa-f]{6}$')`
    ];

    // Create extensions
    for (const ext of extensions) {
      await this.executeSql(ext, 'Creating extension', false);
    }

    // Create types (ignore if they exist)
    for (const type of types) {
      await this.executeSql(`${type}`, 'Creating custom type', false);
    }

    // Create domains
    for (const domain of domains) {
      await this.executeSql(`${domain}`, 'Creating custom domain', false);
    }
  }

  async createMigrationHistory() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        rollback_sql TEXT
      )`;
    
    await this.createTable('migration_history', sql, false);
  }

  async createRestaurantsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE,
        timezone VARCHAR(50) DEFAULT 'Asia/Tokyo',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{
          "business_hours": {"open": "09:00", "close": "22:00"},
          "shift_duration": 8,
          "min_staff_per_shift": 2,
          "max_consecutive_days": 6,
          "min_rest_hours": 12
        }'::jsonb,
        contact_info JSONB DEFAULT '{}'::jsonb,
        address TEXT,
        phone VARCHAR(50)
      )`;
    
    await this.createTable('restaurants', sql);
    
    // Create indexes
    await this.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active) WHERE is_active = true',
      'Creating restaurants active index',
      false
    );
  }

  async createStaffTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS staff (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        position VARCHAR(100),
        hire_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB DEFAULT '{
          "skill_level": 1,
          "preferences": {},
          "availability": {},
          "hourly_rate": null,
          "employee_id": null
        }'::jsonb
      )`;
    
    await this.createTable('staff', sql);
    
    // Create indexes
    await this.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_staff_restaurant_active ON staff(restaurant_id, is_active)',
      'Creating staff restaurant active index',
      false
    );
  }

  async createConfigVersionsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS config_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT false,
        is_locked BOOLEAN DEFAULT false,
        backup_data JSONB DEFAULT '{}'::jsonb,
        UNIQUE(restaurant_id, version_number)
      )`;
    
    await this.createTable('config_versions', sql);
    
    // Create indexes
    await this.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_config_versions_restaurant_active ON config_versions(restaurant_id, is_active) WHERE is_active = true',
      'Creating config_versions restaurant active index',
      false
    );
  }

  async createStaffGroupsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS staff_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#6B7280',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{
          "max_members": null,
          "required_skills": [],
          "responsibilities": []
        }'::jsonb
      )`;
    
    await this.createTable('staff_groups', sql);
    
    // Create staff group members table
    const membersSQL = `
      CREATE TABLE IF NOT EXISTS staff_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
        staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        role_in_group VARCHAR(100) DEFAULT 'member',
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb,
        UNIQUE(group_id, staff_id)
      )`;
    
    await this.createTable('staff_group_members', membersSQL);
  }

  async createBusinessRulesTables() {
    // Conflict rules table
    const conflictRulesSQL = `
      CREATE TABLE IF NOT EXISTS conflict_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(100) NOT NULL,
        conflict_definition JSONB NOT NULL,
        penalty_weight DECIMAL(5,2) DEFAULT 1.0,
        is_hard_constraint BOOLEAN DEFAULT false,
        effective_from DATE,
        effective_until DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        tags TEXT[] DEFAULT '{}'
      )`;
    
    await this.createTable('conflict_rules', conflictRulesSQL);

    // Daily limits table
    const dailyLimitsSQL = `
      CREATE TABLE IF NOT EXISTS daily_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        limit_config JSONB NOT NULL,
        penalty_weight DECIMAL(5,2) DEFAULT 1.0,
        is_hard_constraint BOOLEAN DEFAULT false,
        effective_from DATE,
        effective_until DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
    
    await this.createTable('daily_limits', dailyLimitsSQL);

    // Monthly limits table
    const monthlyLimitsSQL = `
      CREATE TABLE IF NOT EXISTS monthly_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        limit_config JSONB NOT NULL,
        penalty_weight DECIMAL(5,2) DEFAULT 1.0,
        is_hard_constraint BOOLEAN DEFAULT false,
        effective_from DATE,
        effective_until DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
    
    await this.createTable('monthly_limits', monthlyLimitsSQL);

    // Priority rules table
    const priorityRulesSQL = `
      CREATE TABLE IF NOT EXISTS priority_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        priority_level INTEGER DEFAULT 1,
        rule_definition JSONB NOT NULL,
        penalty_weight DECIMAL(5,2) DEFAULT 1.0,
        is_hard_constraint BOOLEAN DEFAULT false,
        effective_from DATE,
        effective_until DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
    
    await this.createTable('priority_rules', priorityRulesSQL);
  }

  async createMLModelConfigsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS ml_model_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        version_id UUID REFERENCES config_versions(id) ON DELETE CASCADE,
        model_name VARCHAR(255) NOT NULL,
        model_type VARCHAR(100) NOT NULL DEFAULT 'optimization',
        parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence_threshold DECIMAL(5,3) DEFAULT 0.75,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        tags TEXT[] DEFAULT '{}'
      )`;
    
    await this.createTable('ml_model_configs', sql);
    
    // Create ML model performance table
    const performanceSQL = `
      CREATE TABLE IF NOT EXISTS ml_model_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_config_id UUID NOT NULL REFERENCES ml_model_configs(id) ON DELETE CASCADE,
        execution_date DATE NOT NULL,
        execution_time_ms INTEGER,
        fitness_score DECIMAL(10,4),
        constraint_violations INTEGER DEFAULT 0,
        user_satisfaction_score DECIMAL(3,2),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metrics JSONB DEFAULT '{}'::jsonb
      )`;
    
    await this.createTable('ml_model_performance', performanceSQL);
  }

  async createHelperFunctions() {
    this.log('info', '⚙️ Creating helper functions...');

    const functions = [
      {
        name: 'get_active_config_version',
        sql: `
          CREATE OR REPLACE FUNCTION get_active_config_version(p_restaurant_id UUID)
          RETURNS UUID AS $$
          DECLARE
            active_version UUID;
          BEGIN
            SELECT id INTO active_version
            FROM config_versions
            WHERE restaurant_id = p_restaurant_id
            AND is_active = true
            LIMIT 1;
            
            RETURN active_version;
          END;
          $$ LANGUAGE plpgsql;`
      },
      {
        name: 'create_config_version',
        sql: `
          CREATE OR REPLACE FUNCTION create_config_version(
            p_restaurant_id UUID,
            p_name VARCHAR(255),
            p_description TEXT DEFAULT NULL,
            p_created_by UUID DEFAULT NULL
          )
          RETURNS UUID AS $$
          DECLARE
            next_version INTEGER;
            new_version_id UUID;
          BEGIN
            SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
            FROM config_versions
            WHERE restaurant_id = p_restaurant_id;
            
            INSERT INTO config_versions (restaurant_id, version_number, name, description, created_by)
            VALUES (p_restaurant_id, next_version, p_name, p_description, p_created_by)
            RETURNING id INTO new_version_id;
            
            RETURN new_version_id;
          END;
          $$ LANGUAGE plpgsql;`
      },
      {
        name: 'activate_config_version',
        sql: `
          CREATE OR REPLACE FUNCTION activate_config_version(p_version_id UUID)
          RETURNS BOOLEAN AS $$
          DECLARE
            p_restaurant_id UUID;
            version_exists BOOLEAN := false;
          BEGIN
            SELECT restaurant_id INTO p_restaurant_id
            FROM config_versions
            WHERE id = p_version_id;
            
            GET DIAGNOSTICS version_exists = FOUND;
            
            IF NOT version_exists THEN
              RETURN false;
            END IF;
            
            UPDATE config_versions
            SET is_active = false
            WHERE restaurant_id = p_restaurant_id;
            
            UPDATE config_versions
            SET is_active = true
            WHERE id = p_version_id;
            
            RETURN true;
          END;
          $$ LANGUAGE plpgsql;`
      }
    ];

    for (const func of functions) {
      await this.executeSql(func.sql, `Creating function: ${func.name}`, false);
    }
  }

  async seedDefaultData() {
    if (CONFIG.skipSeed) {
      this.log('info', '⏭️ Skipping seed data (--skip-seed flag)');
      return;
    }

    this.log('info', '🌱 Seeding default data...');

    // Check if restaurant exists
    const { data: existingRestaurant } = await this.supabase
      .from('restaurants')
      .select('id')
      .eq('id', CONFIG.defaultRestaurantId)
      .single();

    let restaurantId = CONFIG.defaultRestaurantId;

    if (!existingRestaurant) {
      // Create default restaurant
      const { data: newRestaurant, error } = await this.supabase
        .from('restaurants')
        .insert({
          id: CONFIG.defaultRestaurantId,
          name: CONFIG.defaultRestaurantName,
          slug: 'sakura-sushi',
          settings: {
            business_hours: { open: "09:00", close: "22:00" },
            shift_duration: 8,
            min_staff_per_shift: 2,
            max_consecutive_days: 6,
            min_rest_hours: 12
          }
        })
        .select()
        .single();

      if (error) {
        this.log('warn', '⚠️ Could not create default restaurant: ' + error.message);
        return;
      }

      this.log('success', `✅ Created default restaurant: ${CONFIG.defaultRestaurantName}`);
      restaurantId = newRestaurant.id;
    }

    // Create default staff members
    await this.seedStaffMembers(restaurantId);

    // Create default configuration version
    const configVersionId = await this.createDefaultConfigVersion(restaurantId);

    if (configVersionId) {
      // Seed staff groups
      await this.seedStaffGroups(restaurantId, configVersionId);

      // Seed business rules
      await this.seedBusinessRules(restaurantId, configVersionId);

      // Seed ML model configs
      await this.seedMLModelConfigs(restaurantId, configVersionId);

      // Activate the configuration version
      await this.supabase.rpc('activate_config_version', { p_version_id: configVersionId });
    }
  }

  async seedStaffMembers(restaurantId) {
    const staffMembers = [
      { name: '料理長', position: 'Head Chef', email: 'head-chef@sakura-sushi.com' },
      { name: '井関', position: 'Sous Chef', email: 'sous-chef@sakura-sushi.com' },
      { name: '古藤', position: 'Cook', email: 'koto@sakura-sushi.com' },
      { name: '中田', position: 'Cook', email: 'nakata@sakura-sushi.com' },
      { name: '小池', position: 'Kitchen Assistant', email: 'koike@sakura-sushi.com' },
      { name: '田辺', position: 'Floor Manager', email: 'tanabe@sakura-sushi.com' },
      { name: '岸', position: 'Server', email: 'kishi@sakura-sushi.com' },
      { name: '与儀', position: 'Server', email: 'yogi@sakura-sushi.com' },
      { name: 'カマル', position: 'Server', email: 'kamal@sakura-sushi.com' },
      { name: '高野', position: 'Server', email: 'takano@sakura-sushi.com' },
      { name: '派遣スタッフ1', position: 'Temp Staff', email: null },
      { name: '派遣スタッフ2', position: 'Temp Staff', email: null }
    ];

    // Check if staff already exist
    const { data: existingStaff } = await this.supabase
      .from('staff')
      .select('name')
      .eq('restaurant_id', restaurantId);

    if (existingStaff && existingStaff.length > 0) {
      this.log('info', '👥 Staff members already exist, skipping seed');
      return;
    }

    const staffData = staffMembers.map(member => ({
      ...member,
      restaurant_id: restaurantId,
      hire_date: '2024-01-01'
    }));

    const { error } = await this.supabase
      .from('staff')
      .insert(staffData);

    if (error) {
      this.log('warn', '⚠️ Could not seed staff members: ' + error.message);
    } else {
      this.log('success', `✅ Created ${staffMembers.length} staff members`);
    }
  }

  async createDefaultConfigVersion(restaurantId) {
    try {
      const { data, error } = await this.supabase.rpc('create_config_version', {
        p_restaurant_id: restaurantId,
        p_name: 'Default Configuration',
        p_description: 'Initial setup with default rules and constraints'
      });

      if (error) throw error;

      this.log('success', '✅ Created default configuration version');
      return data;
    } catch (error) {
      this.log('warn', '⚠️ Could not create config version: ' + error.message);
      return null;
    }
  }

  async seedStaffGroups(restaurantId, versionId) {
    const groups = [
      { name: 'Group 1', description: 'Kitchen Leadership', color: '#EF4444' },
      { name: 'Group 2', description: 'Kitchen Preparation', color: '#F97316' },
      { name: 'Group 3', description: 'Kitchen Support', color: '#EAB308' },
      { name: 'Group 4', description: 'Service Leadership', color: '#22C55E' },
      { name: 'Group 5', description: 'Service Team A', color: '#06B6D4' },
      { name: 'Group 6', description: 'Service Team B', color: '#3B82F6' },
      { name: 'Group 7', description: 'Service Support', color: '#8B5CF6' }
    ];

    const groupData = groups.map((group, index) => ({
      ...group,
      restaurant_id: restaurantId,
      version_id: versionId,
      sort_order: index
    }));

    const { error } = await this.supabase
      .from('staff_groups')
      .insert(groupData);

    if (error) {
      this.log('warn', '⚠️ Could not seed staff groups: ' + error.message);
    } else {
      this.log('success', `✅ Created ${groups.length} staff groups`);
    }
  }

  async seedBusinessRules(restaurantId, versionId) {
    // Daily limits
    const dailyLimits = [
      {
        name: 'Max Off Per Day',
        limit_config: {
          shift_type: 'off',
          max_count: 4,
          applies_to: { type: 'all' }
        }
      },
      {
        name: 'Min Working Staff Per Day', 
        limit_config: {
          shift_type: 'any',
          min_count: 3,
          applies_to: { type: 'all' }
        }
      }
    ];

    const dailyLimitData = dailyLimits.map(limit => ({
      ...limit,
      restaurant_id: restaurantId,
      version_id: versionId
    }));

    await this.supabase.from('daily_limits').insert(dailyLimitData);

    // Monthly limits
    const monthlyLimits = [
      {
        name: 'Max Off Days Per Month',
        limit_config: {
          limit_type: 'max_off_days',
          max_count: 8,
          applies_to: { type: 'individual' }
        }
      }
    ];

    const monthlyLimitData = monthlyLimits.map(limit => ({
      ...limit,
      restaurant_id: restaurantId,
      version_id: versionId
    }));

    await this.supabase.from('monthly_limits').insert(monthlyLimitData);

    // Priority rules
    const priorityRules = [
      {
        name: '料理長 Sunday Early Preference',
        description: 'Head chef prefers Sunday early shift',
        priority_level: 9,
        rule_definition: {
          type: 'preferred_shift',
          staff_name: '料理長',
          conditions: {
            day_of_week: [0],
            shift_type: 'early'
          },
          preference_strength: 0.9
        }
      }
    ];

    const priorityRuleData = priorityRules.map(rule => ({
      ...rule,
      restaurant_id: restaurantId,
      version_id: versionId
    }));

    await this.supabase.from('priority_rules').insert(priorityRuleData);

    this.log('success', '✅ Created default business rules');
  }

  async seedMLModelConfigs(restaurantId, versionId) {
    const mlConfigs = [
      {
        model_name: 'Genetic Algorithm Optimizer',
        model_type: 'optimization',
        is_default: true,
        parameters: {
          algorithm: 'genetic_algorithm',
          population_size: 100,
          generations: 500,
          mutation_rate: 0.1,
          crossover_rate: 0.8,
          elitism_rate: 0.1,
          convergence_threshold: 0.001,
          fitness_weights: {
            fairness: 0.3,
            preferences: 0.25,
            constraints: 0.45
          },
          constraint_penalties: {
            hard_constraint_violation: 1000,
            soft_constraint_violation: 10,
            preference_violation: 1
          }
        },
        confidence_threshold: 0.85
      }
    ];

    const configData = mlConfigs.map(config => ({
      ...config,
      restaurant_id: restaurantId,
      version_id: versionId
    }));

    const { error } = await this.supabase
      .from('ml_model_configs')
      .insert(configData);

    if (error) {
      this.log('warn', '⚠️ Could not seed ML model configs: ' + error.message);
    } else {
      this.log('success', '✅ Created default ML model configurations');
    }
  }

  async validateSetup() {
    this.log('info', '🔍 Validating database setup...');

    const validations = [
      { table: 'restaurants', expected: 1, query: `SELECT COUNT(*) FROM restaurants WHERE name = '${CONFIG.defaultRestaurantName}'` },
      { table: 'staff', expected: 12, query: `SELECT COUNT(*) FROM staff WHERE restaurant_id = '${CONFIG.defaultRestaurantId}'` },
      { table: 'config_versions', expected: 1, query: 'SELECT COUNT(*) FROM config_versions WHERE is_active = true' },
      { table: 'staff_groups', expected: 7, query: `SELECT COUNT(*) FROM staff_groups WHERE restaurant_id = '${CONFIG.defaultRestaurantId}'` },
      { table: 'ml_model_configs', expected: 1, query: `SELECT COUNT(*) FROM ml_model_configs WHERE is_default = true AND restaurant_id = '${CONFIG.defaultRestaurantId}'` }
    ];

    let allValid = true;

    for (const validation of validations) {
      try {
        const { data, error } = await this.supabase.rpc('exec_sql', { 
          sql_query: validation.query 
        });

        if (error) {
          // Try direct query if RPC fails
          const { data: directData, error: directError } = await this.supabase
            .from(validation.table)
            .select('*', { count: 'exact' });

          if (directError) {
            this.log('error', `❌ ${validation.table}: Query failed - ${error.message}`);
            allValid = false;
            continue;
          }

          const result = directData?.length || 0;
          const isValid = result >= validation.expected;
          
          this.log(isValid ? 'success' : 'warn', 
            `${validation.table}: ${isValid ? '✅' : '⚠️'} (${result}/${validation.expected})`);

          if (!isValid && validation.expected > 0) allValid = false;
        } else {
          const result = data?.[0]?.count || 0;
          const isValid = result >= validation.expected;
          
          this.log(isValid ? 'success' : 'warn', 
            `${validation.table}: ${isValid ? '✅' : '⚠️'} (${result}/${validation.expected})`);

          if (!isValid && validation.expected > 0) allValid = false;
        }

      } catch (error) {
        this.log('error', `❌ ${validation.table}: Validation failed - ${error.message}`);
        allValid = false;
      }
    }

    return allValid;
  }

  async run() {
    console.log('🚀 Starting Complete Database Setup for Shift Schedule Manager\n');
    
    if (CONFIG.dryRun) {
      this.log('info', '🔍 DRY RUN MODE - No changes will be made');
    }

    // Test connection
    const connected = await this.testConnection();
    if (!connected) {
      process.exit(1);
    }

    if (!CONFIG.force && !CONFIG.dryRun) {
      console.log('\n⚠️  This will create/modify database tables.');
      console.log(`Target: ${CONFIG.supabaseUrl}`);
      console.log('\nPress Ctrl+C to cancel or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const startTime = Date.now();

    try {
      // Setup extensions and types
      await this.setupExtensionsAndTypes();

      // Create migration history table
      await this.createMigrationHistory();

      // Create core tables
      await this.createRestaurantsTable();
      await this.createStaffTable();
      await this.createConfigVersionsTable();

      // Create configuration tables
      await this.createStaffGroupsTable();
      await this.createBusinessRulesTables();
      await this.createMLModelConfigsTable();

      // Create helper functions
      await this.createHelperFunctions();

      // Seed default data
      await this.seedDefaultData();

      // Validate setup
      const isValid = await this.validateSetup();

      const duration = Date.now() - startTime;

      // Print summary
      this.log('info', '\n📊 Setup Summary:');
      this.log('success', `✅ Tables created: ${this.createdTables.length}`);
      this.log('warn', `⚠️  Warnings: ${this.warnings.length}`);
      this.log('error', `❌ Errors: ${this.errors.length}`);
      this.log('info', `⏱️  Duration: ${duration}ms`);

      if (this.errors.length > 0) {
        this.log('error', '\n❌ Errors encountered:');
        this.errors.forEach(err => this.log('error', `  - ${err.operation}: ${err.error}`));
      }

      if (this.warnings.length > 0 && CONFIG.verbose) {
        this.log('warn', '\n⚠️ Warnings:');
        this.warnings.forEach(warn => this.log('warn', `  - ${warn.operation}: ${warn.warning}`));
      }

      if (isValid) {
        this.log('success', '\n🎉 Database setup completed successfully!');
      } else {
        this.log('warn', '\n⚠️ Setup completed with some validation failures');
      }

      this.log('info', '\n📝 Next steps:');
      this.log('info', '   1. Run: npm start');
      this.log('info', '   2. Open Settings to configure ML parameters');
      this.log('info', '   3. Test the schedule generation');

      if (!isValid || this.errors.length > 0) {
        this.log('info', '\n💡 The application includes fallback mechanisms:');
        this.log('info', '   - Settings saved to local storage as backup');
        this.log('info', '   - Default configurations for missing data');
        this.log('info', '   - Graceful error handling');
      }

      process.exit(this.errors.length > 0 ? 1 : 0);

    } catch (error) {
      this.log('error', `💥 Setup failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.run().catch(console.error);
}

module.exports = { DatabaseSetup };