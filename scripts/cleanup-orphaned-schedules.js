#!/usr/bin/env node

/**
 * Cleanup Orphaned Schedules Utility
 *
 * Finds and removes schedules with:
 * - Empty schedule_data ({})
 * - No metadata_id (null)
 * - Optionally no schedule_staff_assignments
 *
 * Usage:
 *   node scripts/cleanup-orphaned-schedules.js           # Dry run (preview only)
 *   node scripts/cleanup-orphaned-schedules.js --execute # Actually delete
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = !process.argv.includes('--execute');

async function findOrphanedSchedules() {
  console.log('🔍 Searching for orphaned schedules...\n');

  // Use the database function we created
  const { data, error } = await supabase.rpc('cleanup_orphaned_schedules', {
    dry_run: isDryRun
  });

  if (error) {
    console.error('❌ Error finding orphaned schedules:', error);
    return [];
  }

  return data || [];
}

async function main() {
  console.log('================================================================================');
  console.log('Orphaned Schedule Cleanup Utility');
  console.log('================================================================================\n');

  if (isDryRun) {
    console.log('🔎 DRY RUN MODE - No changes will be made');
    console.log('   Run with --execute to actually delete orphaned schedules\n');
  } else {
    console.log('⚠️  EXECUTE MODE - Orphaned schedules will be DELETED');
    console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const orphanedSchedules = await findOrphanedSchedules();

  if (orphanedSchedules.length === 0) {
    console.log('✅ No orphaned schedules found!\n');
    return;
  }

  console.log(`Found ${orphanedSchedules.length} orphaned schedule(s):\n`);
  console.log('┌────────────────────────────────────────┬─────────────────────────┬──────────────┬─────────────┐');
  console.log('│ Schedule ID                            │ Created At              │ Has Assign.  │ Action      │');
  console.log('├────────────────────────────────────────┼─────────────────────────┼──────────────┼─────────────┤');

  orphanedSchedules.forEach(schedule => {
    const id = schedule.schedule_id;
    const createdAt = new Date(schedule.created_at).toLocaleString();
    const hasAssignments = schedule.has_assignments ? 'Yes' : 'No';
    const action = schedule.action;

    console.log(`│ ${id} │ ${createdAt.padEnd(23)} │ ${hasAssignments.padEnd(12)} │ ${action.padEnd(11)} │`);
  });

  console.log('└────────────────────────────────────────┴─────────────────────────┴──────────────┴─────────────┘\n');

  if (isDryRun) {
    console.log('ℹ️  To actually delete these schedules, run:');
    console.log('   node scripts/cleanup-orphaned-schedules.js --execute\n');
  } else {
    console.log(`✅ Successfully deleted ${orphanedSchedules.length} orphaned schedule(s)\n`);
  }

  // Check for any remaining orphaned schedules
  const { data: remaining, error: checkError } = await supabase
    .from('schedules')
    .select('id, created_at')
    .is('metadata_id', null)
    .eq('schedule_data', {});

  if (!checkError && remaining && remaining.length > 0) {
    console.log(`⚠️  Warning: ${remaining.length} schedule(s) still match orphan criteria`);
    console.log('   (This might be due to constraint preventing deletion of empty schedules)\n');
  }

  console.log('================================================================================');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
