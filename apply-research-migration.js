#!/usr/bin/env node

/**
 * Apply Research Survey Database Migration
 * This script creates the survey_responses table and related views in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env file');
  console.error('   Required: REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_KEY (or REACT_APP_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Starting database migration for research survey...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251031000000_create_survey_responses.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📊 Creating survey_responses table and views...\n');

    // Execute migration using RPC or direct SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).catch(() => {
      // If RPC doesn't work, we'll provide manual instructions
      return { error: { message: 'RPC not available' } };
    });

    if (error && error.message === 'RPC not available') {
      console.log('⚠️  Automatic migration failed - RPC method not available');
      console.log('\n📋 Manual Migration Instructions:\n');
      console.log('1. Go to Supabase Dashboard: https://app.supabase.com/project/ymdyejrljmvajqjbejvh/editor');
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Click "New query"');
      console.log('4. Copy the SQL from: supabase/migrations/20251031000000_create_survey_responses.sql');
      console.log('5. Paste it into the SQL Editor');
      console.log('6. Click "Run" (or press Cmd+Enter / Ctrl+Enter)');
      console.log('\n💡 Or copy the SQL below:\n');
      console.log('─'.repeat(80));
      console.log(migrationSQL);
      console.log('─'.repeat(80));
      return;
    }

    if (error) {
      throw error;
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('📊 Created:');
    console.log('   ✓ survey_responses table (50+ fields)');
    console.log('   ✓ survey_analytics view');
    console.log('   ✓ time_efficiency_stats view');
    console.log('   ✓ satisfaction_by_category view');
    console.log('   ✓ Indexes and triggers\n');

    // Verify table exists
    console.log('🔍 Verifying table creation...');
    const { data: tableData, error: tableError } = await supabase
      .from('survey_responses')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('⚠️  Table verification failed:', tableError.message);
      console.log('   The table might have been created but needs manual verification.');
    } else {
      console.log('✅ Table verified successfully!\n');
      console.log('🎉 Database setup complete!');
      console.log('\n📍 Next steps:');
      console.log('   1. Refresh your browser at http://localhost:3001/research');
      console.log('   2. Fill out the survey form');
      console.log('   3. Check the Results tab to see analytics\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Please apply the migration manually:');
    console.error('   1. Go to: https://app.supabase.com/project/ymdyejrljmvajqjbejvh/editor');
    console.error('   2. Open SQL Editor');
    console.error('   3. Copy contents from: supabase/migrations/20251031000000_create_survey_responses.sql');
    console.error('   4. Run the SQL\n');
    process.exit(1);
  }
}

// Run migration
applyMigration();
