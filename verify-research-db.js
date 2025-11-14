#!/usr/bin/env node

/**
 * Verify Research Database Setup
 * Checks if survey_responses table and views exist
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
  console.log('🔍 Verifying Research Database Setup...\n');

  try {
    // Test 1: Check if survey_responses table exists
    console.log('1️⃣ Checking survey_responses table...');
    const { data: tableData, error: tableError } = await supabase
      .from('survey_responses')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('   ❌ Table not found:', tableError.message);
      return;
    }
    console.log('   ✅ survey_responses table exists!\n');

    // Test 2: Check analytics view
    console.log('2️⃣ Checking survey_analytics view...');
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('survey_analytics')
      .select('*');

    if (analyticsError) {
      console.error('   ❌ View not found:', analyticsError.message);
    } else {
      console.log('   ✅ survey_analytics view exists!');
      console.log('   📊 Current stats:', JSON.stringify(analyticsData[0], null, 2));
      console.log();
    }

    // Test 3: Check time_efficiency_stats view
    console.log('3️⃣ Checking time_efficiency_stats view...');
    const { data: timeData, error: timeError } = await supabase
      .from('time_efficiency_stats')
      .select('*');

    if (timeError) {
      console.error('   ❌ View not found:', timeError.message);
    } else {
      console.log('   ✅ time_efficiency_stats view exists!\n');
    }

    // Test 4: Check satisfaction_by_category view
    console.log('4️⃣ Checking satisfaction_by_category view...');
    const { data: satData, error: satError } = await supabase
      .from('satisfaction_by_category')
      .select('*');

    if (satError) {
      console.error('   ❌ View not found:', satError.message);
    } else {
      console.log('   ✅ satisfaction_by_category view exists!\n');
    }

    // Test 5: Count existing responses
    console.log('5️⃣ Counting existing survey responses...');
    const { count, error: countError } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('   ❌ Count failed:', countError.message);
    } else {
      console.log(`   📊 Total responses: ${count}\n`);
    }

    console.log('✅ Database verification complete!\n');
    console.log('🎉 Your research application is ready to use!');
    console.log('\n📍 Next steps:');
    console.log('   1. Go to: http://localhost:3001/research');
    console.log('   2. Fill out the survey form (8 sections)');
    console.log('   3. Click "Results" tab to see analytics');
    console.log('   4. Charts will update in real-time as responses come in\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyDatabase();
