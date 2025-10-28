#!/usr/bin/env node

/**
 * Delete All Priority Rules
 *
 * This script deletes all priority rules from Supabase for a fresh start.
 */

const SUPABASE_URL = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';
const VERSION_ID = 'f9702e4e-5d19-4f01-a534-250313c3f977';

async function fetchPriorityRules() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.${VERSION_ID}&select=*`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch priority rules: ${response.statusText}`);
  }

  return await response.json();
}

async function deletePriorityRule(id) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?id=eq.${id}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete rule ${id}: ${response.statusText}`);
  }

  return true;
}

async function main() {
  try {
    console.log('🚀 Starting Priority Rules Deletion (Delete All)\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Version ID: ${VERSION_ID}\n`);

    // Step 1: Fetch all rules
    console.log('📥 Fetching priority rules from database...');
    const rules = await fetchPriorityRules();

    console.log(`\n📊 Found ${rules.length} rule(s) to delete:\n`);

    rules.forEach((rule, index) => {
      console.log(`${index + 1}. "${rule.name || '(empty)'}" (ID: ${rule.id})`);
      console.log(`   Created: ${rule.created_at}`);
    });

    if (rules.length === 0) {
      console.log('\n✅ No rules to delete!');
      return;
    }

    console.log(`\n🗑️  Proceeding to delete all ${rules.length} rule(s)...\n`);

    // Step 2: Delete all rules
    let successCount = 0;
    let errorCount = 0;

    for (const rule of rules) {
      try {
        console.log(`Deleting: "${rule.name || '(empty)'}" (${rule.id})`);
        await deletePriorityRule(rule.id);
        console.log('  ✅ Deleted successfully');
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Step 3: Verify cleanup
    console.log('\n🔍 VERIFYING CLEANUP');
    console.log('='.repeat(80));

    const remainingRules = await fetchPriorityRules();
    console.log(`\nRemaining rules: ${remainingRules.length}`);

    if (remainingRules.length > 0) {
      console.log('\n⚠️  WARNING: Some rules still remain:');
      remainingRules.forEach((rule, index) => {
        console.log(`  ${index + 1}. "${rule.name || '(empty)'}" (ID: ${rule.id})`);
      });
    } else {
      console.log('\n✅ All priority rules deleted successfully!');
    }

    console.log('\n📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Successfully deleted: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Remaining: ${remainingRules.length}`);
    console.log('\n✅ CLEANUP COMPLETE!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
