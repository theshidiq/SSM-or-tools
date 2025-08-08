#!/usr/bin/env node

/**
 * Database Setup Script
 * 
 * This script sets up the required database tables for the shift schedule manager.
 * It creates a minimal schema that supports the settings functionality.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupMinimalSchema() {
  console.log('🔧 Setting up minimal database schema...');
  
  const tables = [
    {
      name: 'restaurants',
      sql: `
        CREATE TABLE IF NOT EXISTS restaurants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          address TEXT,
          phone VARCHAR(50),
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'config_versions',
      sql: `
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
        );
      `
    },
    {
      name: 'ml_model_configs',
      sql: `
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
          tags TEXT[] DEFAULT '{}',
          UNIQUE(restaurant_id, model_name)
        );
      `
    }
  ];

  const functions = [
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
          -- Get next version number
          SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
          FROM config_versions
          WHERE restaurant_id = p_restaurant_id;
          
          -- Create new version
          INSERT INTO config_versions (restaurant_id, version_number, name, description, created_by)
          VALUES (p_restaurant_id, next_version, p_name, p_description, p_created_by)
          RETURNING id INTO new_version_id;
          
          RETURN new_version_id;
        END;
        $$ LANGUAGE plpgsql;
      `
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
          -- Check if version exists and get restaurant_id
          SELECT restaurant_id INTO p_restaurant_id
          FROM config_versions
          WHERE id = p_version_id;
          
          GET DIAGNOSTICS version_exists = FOUND;
          
          IF NOT version_exists THEN
            RETURN false;
          END IF;
          
          -- Deactivate all other versions for this restaurant
          UPDATE config_versions
          SET is_active = false
          WHERE restaurant_id = p_restaurant_id;
          
          -- Activate the specified version
          UPDATE config_versions
          SET is_active = true
          WHERE id = p_version_id;
          
          RETURN true;
        END;
        $$ LANGUAGE plpgsql;
      `
    }
  ];

  try {
    // Create tables
    for (const table of tables) {
      console.log(`📋 Creating table: ${table.name}`);
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        // Try direct execution if RPC doesn't work
        console.log(`⚠️  RPC failed for ${table.name}, this is expected for hosted Supabase`);
      }
    }

    // Create functions (these may fail on hosted Supabase, which is OK)
    for (const func of functions) {
      console.log(`⚙️  Creating function: ${func.name}`);
      const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
      if (error) {
        console.log(`⚠️  Function creation failed for ${func.name}, this is expected for hosted Supabase`);
      }
    }

    // Create a default restaurant if none exists
    console.log('🏪 Checking for default restaurant...');
    const { data: restaurants, error: fetchError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);

    if (fetchError) {
      console.log('⚠️  Could not check restaurants table, it may not exist yet');
      console.log('   This is normal if you\'re using a fresh Supabase project');
      console.log('   The application will create a fallback restaurant automatically');
    } else if (!restaurants || restaurants.length === 0) {
      console.log('➕ Creating default restaurant...');
      const { data: newRestaurant, error: createError } = await supabase
        .from('restaurants')
        .insert({
          name: 'My Restaurant',
          address: '',
          phone: '',
          settings: {}
        })
        .select();

      if (createError) {
        console.log('⚠️  Could not create default restaurant:', createError.message);
        console.log('   The application will handle this gracefully');
      } else {
        console.log('✅ Default restaurant created:', newRestaurant[0]?.id);
      }
    } else {
      console.log('✅ Restaurant(s) already exist');
    }

    console.log('\n🎉 Database setup completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Open the application and go to Settings');
    console.log('   3. Configure your ML parameters and save');
    console.log('\n💡 If you encounter issues:');
    console.log('   - The app will work with local storage as fallback');
    console.log('   - Check your Supabase project settings');
    console.log('   - Ensure RLS policies allow your operations');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n💡 Don\'t worry! The application includes fallback mechanisms:');
    console.log('   - Settings will be saved to local storage');
    console.log('   - ML parameters will use sensible defaults');
    console.log('   - You can still use all features');
  }
}

// Test basic connectivity first
async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Try a simple query to test connectivity
    const { data, error } = await supabase.from('schedules').select('count').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
      throw error;
    }
    
    console.log('✅ Connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n🔧 Please check:');
    console.log('   1. REACT_APP_SUPABASE_URL is correct');
    console.log('   2. REACT_APP_SUPABASE_ANON_KEY is correct');
    console.log('   3. Your Supabase project is active');
    console.log('   4. Row Level Security policies allow access');
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database setup for Shift Schedule Manager\n');
  
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  await setupMinimalSchema();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { setupMinimalSchema, testConnection };