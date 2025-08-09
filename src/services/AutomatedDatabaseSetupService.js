/**
 * AutomatedDatabaseSetupService.js
 * 
 * Fully automated database setup service that executes SQL directly through Supabase.
 * No manual copy-pasting required - one-click solution.
 * 
 * Features:
 * - Direct SQL execution via Supabase client
 * - Chunked execution with progress tracking
 * - Smart table existence checking
 * - Retry mechanism with exponential backoff
 * - Real-time progress updates
 * - Graceful error handling with fallback
 */

import { supabase } from '../utils/supabase.js';

export class AutomatedDatabaseSetupService {
  constructor() {
    this.setupChunks = [];
    this.currentChunkIndex = 0;
    this.progress = 0;
    this.errors = [];
    this.isSetupComplete = false;
    this.existingTables = [];
    this.createdTables = [];
    
    // Setup progress callbacks
    this.onProgress = null;
    this.onChunkComplete = null;
    this.onError = null;
    this.onComplete = null;
    
    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    
    // Initialize setup chunks
    this.initializeSetupChunks();
  }

  /**
   * Initialize database setup chunks for progressive execution
   */
  initializeSetupChunks() {
    this.setupChunks = [
      {
        id: 'validate_connection',
        name: 'Validate Connection',
        description: 'Check database connection and permissions',
        execute: this.validateConnection.bind(this),
        critical: true,
        retryable: true,
      },
      {
        id: 'check_existing_tables',
        name: 'Scan Existing Tables',
        description: 'Check which tables already exist',
        execute: this.checkExistingTables.bind(this),
        critical: true,
        retryable: true,
      },
      {
        id: 'create_extensions',
        name: 'Create Extensions',
        description: 'Enable PostgreSQL extensions',
        sql: this.getExtensionsSQL(),
        critical: true,
        retryable: true,
      },
      {
        id: 'create_types',
        name: 'Create Types',
        description: 'Create custom database types',
        sql: this.getTypesSQL(),
        critical: true,
        retryable: true,
      },
      {
        id: 'create_core_tables',
        name: 'Create Core Tables',
        description: 'Create restaurants and staff tables',
        sql: this.getCoreTablesSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['restaurants', 'staff'],
      },
      {
        id: 'create_configuration_tables',
        name: 'Create Configuration Tables',
        description: 'Create configuration versioning system',
        sql: this.getConfigurationTablesSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['config_versions', 'config_changes'],
      },
      {
        id: 'create_staff_groups',
        name: 'Create Staff Groups',
        description: 'Create staff groups and memberships',
        sql: this.getStaffGroupsSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['staff_groups', 'staff_group_members'],
      },
      {
        id: 'create_business_rules',
        name: 'Create Business Rules',
        description: 'Create conflict and limit rules',
        sql: this.getBusinessRulesSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['conflict_rules', 'daily_limits', 'monthly_limits'],
      },
      {
        id: 'create_priority_rules',
        name: 'Create Priority Rules',
        description: 'Create priority and scheduling rules',
        sql: this.getPriorityRulesSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['priority_rules'],
      },
      {
        id: 'create_ml_system',
        name: 'Create ML System',
        description: 'Create machine learning configuration',
        sql: this.getMLSystemSQL(),
        critical: true,
        retryable: true,
        skipIfExists: ['ml_model_configs', 'ml_model_performance'],
      },
      {
        id: 'create_functions',
        name: 'Create Functions',
        description: 'Create helper functions',
        sql: this.getFunctionsSQL(),
        critical: true,
        retryable: true,
      },
      {
        id: 'create_triggers',
        name: 'Create Triggers',
        description: 'Create update triggers',
        sql: this.getTriggersSQL(),
        critical: true,
        retryable: true,
      },
      {
        id: 'create_indexes',
        name: 'Create Indexes',
        description: 'Create performance indexes',
        sql: this.getIndexesSQL(),
        critical: false,
        retryable: true,
      },
      {
        id: 'setup_rls',
        name: 'Setup RLS Policies',
        description: 'Configure row level security',
        sql: this.getRLSPoliciesSQL(),
        critical: false,
        retryable: true,
      },
      {
        id: 'insert_sample_data',
        name: 'Insert Sample Data',
        description: 'Create sample restaurant and configuration',
        execute: this.insertSampleData.bind(this),
        critical: false,
        retryable: true,
      },
      {
        id: 'final_validation',
        name: 'Final Validation',
        description: 'Verify setup completion',
        execute: this.performFinalValidation.bind(this),
        critical: true,
        retryable: false,
      },
    ];
  }

  /**
   * Execute complete automated database setup
   */
  async executeSetup(progressCallback = null, errorCallback = null, completeCallback = null) {
    this.onProgress = progressCallback;
    this.onError = errorCallback;
    this.onComplete = completeCallback;
    
    this.currentChunkIndex = 0;
    this.progress = 0;
    this.errors = [];
    this.isSetupComplete = false;
    this.createdTables = [];

    try {
      console.log('🚀 Starting automated database setup...');
      this.reportProgress('Starting automated database setup...', 0);

      for (let i = 0; i < this.setupChunks.length; i++) {
        const chunk = this.setupChunks[i];
        this.currentChunkIndex = i;
        
        try {
          console.log(`📋 Executing chunk ${i + 1}/${this.setupChunks.length}: ${chunk.name}`);
          this.reportProgress(`Executing: ${chunk.name}`, (i / this.setupChunks.length) * 100);

          // Check if we should skip this chunk
          if (await this.shouldSkipChunk(chunk)) {
            console.log(`⏭️  Skipping ${chunk.name} - tables already exist`);
            this.reportProgress(`Skipped: ${chunk.name}`, ((i + 1) / this.setupChunks.length) * 100);
            continue;
          }

          // Execute the chunk with retry logic
          await this.executeChunkWithRetry(chunk);
          
          console.log(`✅ Completed: ${chunk.name}`);
          this.reportProgress(`Completed: ${chunk.name}`, ((i + 1) / this.setupChunks.length) * 100);

          if (this.onChunkComplete) {
            this.onChunkComplete(chunk, i + 1, this.setupChunks.length);
          }

        } catch (error) {
          const errorMsg = `Failed at chunk "${chunk.name}": ${error.message}`;
          console.error(`❌ ${errorMsg}`, error);
          
          this.errors.push({
            chunk: chunk.name,
            chunkId: chunk.id,
            message: error.message,
            critical: chunk.critical,
            timestamp: new Date().toISOString(),
            details: error.details || null,
          });

          if (this.onError) {
            this.onError(error, chunk);
          }

          // If critical chunk fails, abort setup
          if (chunk.critical) {
            throw new Error(errorMsg);
          }

          // For non-critical chunks, log and continue
          console.warn(`⚠️ Non-critical chunk failed, continuing: ${chunk.name}`);
        }
      }

      this.isSetupComplete = true;
      this.progress = 100;
      
      console.log('✅ Automated database setup completed successfully!');
      this.reportProgress('Automated setup completed successfully!', 100);
      
      if (this.onComplete) {
        this.onComplete({
          success: true,
          errors: this.errors,
          chunksCompleted: this.setupChunks.length,
          tablesCreated: this.createdTables,
          tablesExisted: this.existingTables,
        });
      }

      return {
        success: true,
        errors: this.errors,
        chunksCompleted: this.setupChunks.length,
        tablesCreated: this.createdTables,
        tablesExisted: this.existingTables,
      };

    } catch (error) {
      console.error('❌ Automated database setup failed:', error);
      
      const result = {
        success: false,
        error: error.message,
        errors: this.errors,
        chunksCompleted: this.currentChunkIndex,
        tablesCreated: this.createdTables,
        fallbackRequired: true,
      };

      if (this.onComplete) {
        this.onComplete(result);
      }

      return result;
    }
  }

  /**
   * Execute a chunk with retry logic
   */
  async executeChunkWithRetry(chunk) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (chunk.execute) {
          // Custom execution function
          await chunk.execute();
        } else if (chunk.sql) {
          // Direct SQL execution
          await this.executeSQLChunk(chunk.sql, chunk.name);
        }
        return; // Success
      } catch (error) {
        lastError = error;
        
        if (!chunk.retryable || attempt === this.maxRetries) {
          throw error; // No more retries or not retryable
        }
        
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`⚠️ Chunk ${chunk.name} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if a chunk should be skipped
   */
  async shouldSkipChunk(chunk) {
    if (!chunk.skipIfExists || chunk.skipIfExists.length === 0) {
      return false;
    }
    
    // Check if all required tables already exist
    for (const tableName of chunk.skipIfExists) {
      if (!this.existingTables.includes(tableName)) {
        return false;
      }
    }
    
    console.log(`All tables for ${chunk.name} already exist: ${chunk.skipIfExists.join(', ')}`);
    return true;
  }

  /**
   * Execute SQL chunk directly through Supabase
   */
  async executeSQLChunk(sql, chunkName) {
    try {
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.length === 0) continue;
        
        // Try exec first, then fall back to exec_safe
        let { error } = await supabase.rpc('exec', { sql: statement + ';' });
        
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
          // Try the safer version
          const { error: safeError } = await supabase.rpc('exec_safe', { sql: statement + ';' });
          error = safeError;
        }
        
        if (error) {
          // Check if it's a "already exists" error (which we can ignore)
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.code === '42P07' || // duplicate table
              error.code === '42710') { // duplicate function/procedure
            console.log(`⏭️  Statement skipped (already exists): ${statement.substring(0, 50)}...`);
            continue;
          }
          
          // Check if RPC functions are missing entirely
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            throw new Error(`RPC functions not available. Please run the RPC setup script first.\nMissing function for: ${statement.substring(0, 100)}...`);
          }
          
          throw new Error(`SQL execution failed in ${chunkName}: ${error.message}\nStatement: ${statement.substring(0, 100)}...`);
        }
      }
      
      console.log(`✅ SQL chunk executed successfully: ${chunkName}`);
    } catch (error) {
      console.error(`❌ SQL chunk execution failed: ${chunkName}`, error);
      throw error;
    }
  }

  /**
   * Validate database connection and permissions
   */
  async validateConnection() {
    try {
      // Test basic connection
      const { error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }

      // Test if we can execute SQL via RPC
      let rpcAvailable = false;
      const { error: execError } = await supabase.rpc('exec', { 
        sql: 'SELECT 1 as test;' 
      });
      
      if (execError) {
        // Try the test_rpc function if exec is not available
        const { error: testError } = await supabase.rpc('test_rpc');
        
        if (testError) {
          // Neither function available - RPC not set up
          if (testError.message.includes('function') && testError.message.includes('does not exist')) {
            throw new Error(`RPC functions not available. Please run the RPC setup script first:\n\n1. Copy the content of supabase-rpc-setup.sql\n2. Run it in your Supabase SQL Editor\n3. Return here and try again`);
          }
        } else {
          rpcAvailable = true;
        }
        
        // If no RPC available, check basic database access
        if (!rpcAvailable) {
          console.warn('RPC functions not available, checking basic database access...');
          
          const { error: altError } = await supabase
            .from('restaurants')
            .select('count')
            .limit(0);
          
          if (altError && altError.code !== '42P01') { // 42P01 is "table does not exist" which is fine
            throw new Error(`Database access denied. Please check your Supabase permissions.`);
          }
          
          throw new Error(`RPC functions required for automated setup are not available. Please run the RPC setup script first.`);
        }
      } else {
        rpcAvailable = true;
      }

      console.log('✅ Database connection and RPC functions validated');
    } catch (error) {
      throw new Error(`Database connection validation failed: ${error.message}`);
    }
  }

  /**
   * Check which tables already exist
   */
  async checkExistingTables() {
    const requiredTables = [
      'restaurants', 'staff', 'config_versions', 'config_changes',
      'staff_groups', 'staff_group_members', 'conflict_rules',
      'daily_limits', 'monthly_limits', 'priority_rules',
      'ml_model_configs', 'ml_model_performance'
    ];

    this.existingTables = [];
    const missingTables = [];

    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('count')
          .limit(1);

        if (!error || error.code === 'PGRST116') {
          // Table exists (either no error or just no data)
          this.existingTables.push(table);
        } else if (error.code === '42P01') {
          // Table doesn't exist
          missingTables.push(table);
        } else {
          // Other error (permissions, etc.)
          console.warn(`Table ${table} check failed:`, error);
          missingTables.push(table);
        }
      } catch (error) {
        console.warn(`Failed to check table ${table}:`, error);
        missingTables.push(table);
      }
    }

    console.log(`✅ Found existing tables: ${this.existingTables.length}/${requiredTables.length}`);
    console.log(`📋 Tables to create: ${missingTables.length}`);

    if (missingTables.length === 0) {
      console.log('🎉 All required tables already exist!');
    } else {
      console.log(`📋 Missing tables: ${missingTables.join(', ')}`);
    }
  }

  /**
   * Insert sample data for immediate testing
   */
  async insertSampleData() {
    try {
      // Check if we already have sample data
      const { data: existingRestaurants, error: checkError } = await supabase
        .from('restaurants')
        .select('id')
        .limit(1);

      if (checkError) {
        console.warn('Could not check for existing sample data:', checkError);
        return;
      }

      if (existingRestaurants && existingRestaurants.length > 0) {
        console.log('✅ Sample data already exists, skipping insertion');
        return;
      }

      // Create sample restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: 'Sample Restaurant',
          slug: 'sample-restaurant',
          timezone: 'Asia/Tokyo',
          settings: {
            business_hours: { open: '09:00', close: '22:00' },
            shift_duration: 8,
            min_staff_per_shift: 2,
            max_consecutive_days: 6,
            min_rest_hours: 12
          }
        })
        .select()
        .single();

      if (restaurantError) {
        console.warn('Sample restaurant creation failed:', restaurantError);
        return;
      }

      // Create sample staff
      const staffMembers = [
        { name: '料理長', position: 'Head Chef', email: 'head.chef@sample.com' },
        { name: '井関', position: 'Cook', email: 'iseki@sample.com' },
        { name: '古藤', position: 'Cook', email: 'koto@sample.com' },
        { name: '中田', position: 'Cook', email: 'nakata@sample.com' },
        { name: '小池', position: 'Cook', email: 'koike@sample.com' },
        { name: '田辺', position: 'Server', email: 'tanabe@sample.com' },
        { name: '岸', position: 'Server', email: 'kishi@sample.com' },
        { name: '与儀', position: 'Server', email: 'yogi@sample.com' },
        { name: 'カマル', position: 'Server', email: 'kamal@sample.com' },
        { name: '高野', position: 'Server', email: 'takano@sample.com' },
        { name: '派遣スタッフ', position: 'Temporary', email: 'temp@sample.com' },
      ];

      const { error: staffError } = await supabase
        .from('staff')
        .insert(
          staffMembers.map(member => ({
            ...member,
            restaurant_id: restaurant.id,
            hire_date: '2024-01-01',
            is_active: true,
            metadata: {
              skill_level: Math.floor(Math.random() * 5) + 1,
              preferences: {},
              availability: {},
              hourly_rate: null,
              employee_id: null
            }
          }))
        );

      if (staffError) {
        console.warn('Sample staff creation failed:', staffError);
        return;
      }

      console.log('✅ Sample data inserted successfully');
    } catch (error) {
      console.warn('⚠️ Sample data insertion failed (non-critical):', error);
      // Sample data is non-critical, so we don't throw
    }
  }

  /**
   * Perform final system validation
   */
  async performFinalValidation() {
    const validationResults = {
      tablesAccessible: 0,
      functionsWorking: 0,
      sampleDataAvailable: false,
    };

    // Test table access
    const testTables = ['restaurants', 'staff', 'config_versions', 'ml_model_configs'];
    for (const table of testTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (!error || error.code === 'PGRST116') {
          validationResults.tablesAccessible++;
        }
      } catch (error) {
        console.warn(`Final validation - table ${table} failed:`, error);
      }
    }

    // Test sample data
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .limit(1);
      
      if (!error && data && data.length > 0) {
        validationResults.sampleDataAvailable = true;
      }
    } catch (error) {
      console.warn('Final validation - sample data check failed:', error);
    }

    this.validationResults = validationResults;

    console.log(`✅ Final validation completed:`);
    console.log(`   - Tables accessible: ${validationResults.tablesAccessible}/${testTables.length}`);
    console.log(`   - Sample data: ${validationResults.sampleDataAvailable ? 'Yes' : 'No'}`);
    
    if (validationResults.tablesAccessible < testTables.length) {
      throw new Error(`Only ${validationResults.tablesAccessible}/${testTables.length} tables are accessible. Setup may be incomplete.`);
    }
  }

  /**
   * Report progress to callback
   */
  reportProgress(message, percentage) {
    this.progress = percentage;
    if (this.onProgress) {
      this.onProgress({
        message,
        percentage,
        currentChunk: this.currentChunkIndex,
        totalChunks: this.setupChunks.length,
        chunkName: this.setupChunks[this.currentChunkIndex]?.name || 'Unknown',
      });
    }
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get setup progress information
   */
  getProgress() {
    return {
      currentChunk: this.currentChunkIndex,
      totalChunks: this.setupChunks.length,
      percentage: this.progress,
      isComplete: this.isSetupComplete,
      chunkName: this.setupChunks[this.currentChunkIndex]?.name || 'Unknown',
      errors: this.errors,
      existingTables: this.existingTables,
      createdTables: this.createdTables,
      validationResults: this.validationResults,
    };
  }

  /**
   * Get setup chunks information
   */
  getSetupChunks() {
    return this.setupChunks.map((chunk, index) => ({
      ...chunk,
      index,
      isCompleted: index < this.currentChunkIndex,
      isCurrent: index === this.currentChunkIndex,
      isPending: index > this.currentChunkIndex,
    }));
  }

  // SQL Generation Methods
  getExtensionsSQL() {
    return `-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;
  }

  getTypesSQL() {
    return `-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
  }

  getCoreTablesSQL() {
    return `-- Restaurants table (multi-tenancy)
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
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
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    }'::jsonb,
    
    UNIQUE(restaurant_id, email) WHERE email IS NOT NULL,
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);`;
  }

  getConfigurationTablesSQL() {
    return `-- Configuration versions for rollback capability
CREATE TABLE IF NOT EXISTS config_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    
    UNIQUE(restaurant_id, version_number)
);

-- Change tracking for audit trail
CREATE TABLE IF NOT EXISTS config_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);`;
  }

  getStaffGroupsSQL() {
    return `-- Staff groups
CREATE TABLE IF NOT EXISTS staff_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(restaurant_id, version_id, name)
);

-- Staff group memberships
CREATE TABLE IF NOT EXISTS staff_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(group_id, staff_id)
);`;
  }

  getBusinessRulesSQL() {
    return `-- Conflict rules between groups/individuals
CREATE TABLE IF NOT EXISTS conflict_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    conflict_definition JSONB NOT NULL,
    penalty_weight DECIMAL(5,2) DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(restaurant_id, version_id, name)
);

-- Daily limits
CREATE TABLE IF NOT EXISTS daily_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    limit_config JSONB NOT NULL,
    penalty_weight DECIMAL(5,2) DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(restaurant_id, version_id, name)
);

-- Monthly limits
CREATE TABLE IF NOT EXISTS monthly_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    limit_config JSONB NOT NULL,
    penalty_weight DECIMAL(5,2) DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(restaurant_id, version_id, name)
);`;
  }

  getPriorityRulesSQL() {
    return `-- Priority rules
CREATE TABLE IF NOT EXISTS priority_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(restaurant_id, version_id, name)
);`;
  }

  getMLSystemSQL() {
    return `-- ML model parameters and weights
CREATE TABLE IF NOT EXISTS ml_model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL,
    confidence_threshold DECIMAL(5,3) DEFAULT 0.75,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(restaurant_id, version_id, model_name)
);

-- Model performance tracking
CREATE TABLE IF NOT EXISTS ml_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_config_id UUID NOT NULL REFERENCES ml_model_configs(id) ON DELETE CASCADE,
    execution_date DATE NOT NULL,
    execution_time_ms INTEGER,
    fitness_score DECIMAL(10,4),
    constraint_violations INTEGER DEFAULT 0,
    user_satisfaction_score DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(model_config_id, execution_date)
);`;
  }

  getFunctionsSQL() {
    return `-- Function to get active configuration for a restaurant
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
$$ LANGUAGE plpgsql;

-- Function to create new config version
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
$$ LANGUAGE plpgsql;

-- Function to activate a config version
CREATE OR REPLACE FUNCTION activate_config_version(p_version_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    p_restaurant_id UUID;
BEGIN
    SELECT restaurant_id INTO p_restaurant_id
    FROM config_versions
    WHERE id = p_version_id;
    
    UPDATE config_versions
    SET is_active = false
    WHERE restaurant_id = p_restaurant_id;
    
    UPDATE config_versions
    SET is_active = true
    WHERE id = p_version_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;`;
  }

  getTriggersSQL() {
    return `-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at 
    BEFORE UPDATE ON restaurants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at 
    BEFORE UPDATE ON staff 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_groups_updated_at ON staff_groups;
CREATE TRIGGER update_staff_groups_updated_at 
    BEFORE UPDATE ON staff_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;
  }

  getIndexesSQL() {
    return `-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_active ON staff(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_position ON staff(restaurant_id, position);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_config_versions_restaurant_active ON config_versions(restaurant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_config_versions_created ON config_versions(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_changes_version ON config_changes(version_id);

-- Staff groups and memberships
CREATE INDEX IF NOT EXISTS idx_staff_groups_restaurant_version ON staff_groups(restaurant_id, version_id);
CREATE INDEX IF NOT EXISTS idx_staff_group_members_staff ON staff_group_members(staff_id);

-- Rules and constraints
CREATE INDEX IF NOT EXISTS idx_conflict_rules_restaurant_version_active ON conflict_rules(restaurant_id, version_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_limits_restaurant_version_active ON daily_limits(restaurant_id, version_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monthly_limits_restaurant_version_active ON monthly_limits(restaurant_id, version_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_priority_rules_restaurant_version_active ON priority_rules(restaurant_id, version_id, is_active) WHERE is_active = true;

-- ML model configs
CREATE INDEX IF NOT EXISTS idx_ml_model_configs_restaurant_version ON ml_model_configs(restaurant_id, version_id);
CREATE INDEX IF NOT EXISTS idx_ml_model_configs_default ON ml_model_configs(restaurant_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_ml_model_performance_config_date ON ml_model_performance(model_config_id, execution_date DESC);`;
  }

  getRLSPoliciesSQL() {
    return `-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_performance ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users
CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON restaurants
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON staff
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON config_versions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON config_changes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON staff_groups
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON staff_group_members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON conflict_rules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON daily_limits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON monthly_limits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON priority_rules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON ml_model_configs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable all operations for authenticated users" ON ml_model_performance
    FOR ALL TO authenticated USING (true) WITH CHECK (true);`;
  }
}

export default AutomatedDatabaseSetupService;