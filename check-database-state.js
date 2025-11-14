/**
 * Quick Database State Checker
 * Run this to verify if priority rules and staff groups actually exist in Supabase
 * Usage: node check-database-state.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load both .env and .env.development (Supabase credentials are in .env)
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.development', override: false });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   REACT_APP_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   REACT_APP_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  console.error('\n   Credentials should be in .env file (not .env.development)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
  console.log('🔍 Checking Supabase Database State...\n');

  // Check Priority Rules
  console.log('📋 PRIORITY RULES:');
  console.log('─'.repeat(80));

  const { data: rules, error: rulesError } = await supabase
    .from('priority_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (rulesError) {
    console.error('❌ Error fetching priority rules:', rulesError.message);
  } else if (!rules || rules.length === 0) {
    console.log('⚠️  NO PRIORITY RULES FOUND IN DATABASE');
    console.log('   This explains why data appears "wiped" - it was never saved!\n');
  } else {
    console.log(`✅ Found ${rules.length} priority rule(s)\n`);

    rules.forEach((rule, index) => {
      const staffIds = rule.rule_definition?.staff_ids || [];
      const hasStaffIds = staffIds.length > 0;

      console.log(`${index + 1}. ${rule.name}`);
      console.log(`   ID: ${rule.id}`);
      console.log(`   Staff IDs: ${hasStaffIds ? `✅ ${staffIds.length} staff` : '❌ EMPTY ARRAY'}`);
      if (hasStaffIds) {
        console.log(`   Staff UUIDs: ${JSON.stringify(staffIds)}`);
      }
      console.log(`   Created: ${new Date(rule.created_at).toLocaleString()}`);
      console.log(`   Is Active: ${rule.is_active}`);
      console.log('');
    });

    // Check for rules with empty staff_ids
    const emptyStaffRules = rules.filter(r => {
      const staffIds = r.rule_definition?.staff_ids || [];
      return staffIds.length === 0;
    });

    if (emptyStaffRules.length > 0) {
      console.log(`⚠️  WARNING: ${emptyStaffRules.length} rule(s) have EMPTY staff_ids array:`);
      emptyStaffRules.forEach(r => {
        console.log(`   - "${r.name}" (${r.id})`);
      });
      console.log('');
    }
  }

  // Check Staff Groups
  console.log('👥 STAFF GROUPS:');
  console.log('─'.repeat(80));

  const { data: groups, error: groupsError } = await supabase
    .from('staff_groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (groupsError) {
    console.error('❌ Error fetching staff groups:', groupsError.message);
  } else if (!groups || groups.length === 0) {
    console.log('⚠️  NO STAFF GROUPS FOUND IN DATABASE\n');
  } else {
    console.log(`✅ Found ${groups.length} staff group(s)\n`);

    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name}`);
      console.log(`   ID: ${group.id}`);
      console.log(`   Description: ${group.description || 'N/A'}`);
      console.log(`   Created: ${new Date(group.created_at).toLocaleString()}`);
      console.log(`   Is Active: ${group.is_active}`);
      console.log('');
    });
  }

  // Summary
  console.log('📊 SUMMARY:');
  console.log('─'.repeat(80));
  console.log(`Priority Rules: ${rules?.length || 0} total`);
  if (rules && rules.length > 0) {
    const withStaff = rules.filter(r => (r.rule_definition?.staff_ids || []).length > 0).length;
    const withoutStaff = rules.length - withStaff;
    console.log(`  - ${withStaff} with staff IDs ✅`);
    console.log(`  - ${withoutStaff} without staff IDs ${withoutStaff > 0 ? '⚠️' : '✅'}`);
  }
  console.log(`Staff Groups: ${groups?.length || 0} total\n`);

  // Diagnosis
  console.log('🔬 DIAGNOSIS:');
  console.log('─'.repeat(80));

  if (!rules || rules.length === 0) {
    console.log('❌ PROBLEM: Database has NO priority rules');
    console.log('   This means rules were never saved in the first place.');
    console.log('   OR they were deleted at some point.');
    console.log('\n   Next steps:');
    console.log('   1. Create a new priority rule in the UI');
    console.log('   2. Check browser console for save errors');
    console.log('   3. Run this script again to verify it saved');
  } else if (rules.every(r => (r.rule_definition?.staff_ids || []).length === 0)) {
    console.log('❌ PROBLEM: All priority rules have EMPTY staff_ids arrays');
    console.log('   This means the staffIds field is not being saved correctly.');
    console.log('\n   Possible causes:');
    console.log('   - Go server ToReactFormat() not extracting staff_ids (check fix)');
    console.log('   - Frontend not sending staff_ids in create/update requests');
    console.log('   - Race condition overwriting staff_ids with empty array');
  } else {
    const withStaff = rules.filter(r => (r.rule_definition?.staff_ids || []).length > 0).length;
    console.log(`✅ Database looks good! ${withStaff} rule(s) have staff IDs.`);
    console.log('\n   If data still appears "wiped" in UI:');
    console.log('   1. Check WebSocket connection (is Go server running?)');
    console.log('   2. Check browser console for SETTINGS_SYNC_RESPONSE');
    console.log('   3. Run debug logging to trace data flow');
  }

  console.log('');
}

checkDatabaseState()
  .then(() => {
    console.log('✅ Database check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
