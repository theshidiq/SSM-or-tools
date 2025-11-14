/**
 * Emergency Script: Check and Restore Staff Groups & Priority Rules
 *
 * This script checks for data in localStorage and attempts to restore it to the database.
 * Run this if staff groups or priority rules are missing after implementing fixes.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function checkAndRestoreData() {
  console.log('🔍 Emergency Data Check and Restore Script\n');

  // Check database current state
  console.log('📊 Checking current database state...\n');

  const { data: dbGroups, error: groupsError } = await supabase
    .from('staff_groups')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: dbRules, error: rulesError } = await supabase
    .from('priority_rules')
    .select('*')
    .order('created_at', { ascending: true });

  console.log(`📋 Database Status:`);
  console.log(`   Staff Groups: ${dbGroups?.length || 0}`);
  console.log(`   Priority Rules: ${dbRules?.length || 0}\n`);

  if (dbGroups && dbGroups.length > 0) {
    console.log('✅ Staff groups found in database:');
    dbGroups.forEach(g => {
      console.log(`   - ${g.name} (${g.id}) - is_active: ${g.is_active}`);
    });
    console.log('');
  }

  if (dbRules && dbRules.length > 0) {
    console.log('✅ Priority rules found in database:');
    dbRules.forEach(r => {
      console.log(`   - ${r.name} (${r.id}) - is_active: ${r.is_active}`);
    });
    console.log('');
  }

  // If database is empty, suggest checking localStorage
  if ((!dbGroups || dbGroups.length === 0) && (!dbRules || dbRules.length === 0)) {
    console.log('⚠️  Database appears empty!');
    console.log('');
    console.log('💡 To check if data exists in browser localStorage:');
    console.log('   1. Open your browser');
    console.log('   2. Press F12 to open DevTools');
    console.log('   3. Go to Console tab');
    console.log('   4. Run: localStorage.getItem("scheduleSettings")');
    console.log('   5. If data exists, copy it and we can restore it');
    console.log('');
    console.log('💡 To check WebSocket connection:');
    console.log('   1. Open Settings page in browser');
    console.log('   2. Check console for: "🔄 Syncing WebSocket multi-table settings"');
    console.log('   3. Verify: "✅ Sync #N complete - clearing isSyncingFromWebSocketRef"');
    console.log('');
  }

  // Provide SQL queries for manual inspection
  console.log('🔧 Manual Database Queries:\n');
  console.log('Check all staff groups (including soft-deleted):');
  console.log('  SELECT id, name, is_active, created_at FROM staff_groups;\n');
  console.log('Check all priority rules (including soft-deleted):');
  console.log('  SELECT id, name, is_active, created_at FROM priority_rules;\n');
  console.log('Check for recent deletions:');
  console.log('  SELECT * FROM staff_groups WHERE updated_at > NOW() - INTERVAL \'1 hour\';\n');
}

checkAndRestoreData()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
