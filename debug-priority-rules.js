#!/usr/bin/env node

/**
 * Debug and Clean Duplicate Priority Rules
 *
 * This script:
 * 1. Fetches all priority rules from Supabase
 * 2. Identifies duplicates
 * 3. Deletes duplicates keeping the most complete one
 * 4. Verifies cleanup
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

function analyzeRules(rules) {
  console.log('\n📊 ANALYZING PRIORITY RULES');
  console.log('='.repeat(80));
  console.log(`Total rules found: ${rules.length}\n`);

  rules.forEach((rule, index) => {
    console.log(`Rule ${index + 1}:`);
    console.log(`  ID: ${rule.id}`);
    console.log(`  Name: "${rule.name || '(empty)'}"`);
    console.log(`  Created: ${rule.created_at}`);
    console.log(`  Updated: ${rule.updated_at || '(never)'}`);
    console.log(`  Data keys: ${Object.keys(rule).length}`);

    // Check for empty or problematic data
    if (!rule.name || rule.name.trim() === '') {
      console.log(`  ⚠️  WARNING: Empty name!`);
    }

    console.log('');
  });

  return rules;
}

function identifyDuplicates(rules) {
  console.log('\n🔍 IDENTIFYING DUPLICATES');
  console.log('='.repeat(80));

  // Group rules by name
  const rulesByName = {};
  const emptyNameRules = [];

  rules.forEach(rule => {
    const name = (rule.name || '').trim();

    if (name === '') {
      emptyNameRules.push(rule);
    } else {
      if (!rulesByName[name]) {
        rulesByName[name] = [];
      }
      rulesByName[name].push(rule);
    }
  });

  // Identify duplicates
  const duplicateGroups = [];

  Object.entries(rulesByName).forEach(([name, rules]) => {
    if (rules.length > 1) {
      console.log(`\n📦 Duplicate group for name "${name}":`);
      rules.forEach((rule, idx) => {
        console.log(`  ${idx + 1}. ID: ${rule.id}, Created: ${rule.created_at}`);
      });
      duplicateGroups.push({ name, rules });
    }
  });

  if (emptyNameRules.length > 0) {
    console.log(`\n⚠️  Found ${emptyNameRules.length} rule(s) with empty names:`);
    emptyNameRules.forEach((rule, idx) => {
      console.log(`  ${idx + 1}. ID: ${rule.id}, Created: ${rule.created_at}`);
    });
    duplicateGroups.push({ name: '(empty)', rules: emptyNameRules });
  }

  if (duplicateGroups.length === 0) {
    console.log('\n✅ No duplicates found!');
  }

  return { duplicateGroups, emptyNameRules };
}

function selectRulesToDelete(rules) {
  console.log('\n🎯 SELECTING RULES TO DELETE');
  console.log('='.repeat(80));

  const toDelete = [];
  const toKeep = [];

  if (rules.length === 0) {
    return { toDelete, toKeep };
  }

  // Strategy: Keep the oldest rule (first created)
  // This assumes the first rule is the original and others are duplicates
  const sorted = [...rules].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  toKeep.push(sorted[0]);
  toDelete.push(...sorted.slice(1));

  console.log(`\n✅ Keeping (oldest): ${sorted[0].id} - "${sorted[0].name || '(empty)'}"`);
  console.log(`   Created: ${sorted[0].created_at}`);

  if (toDelete.length > 0) {
    console.log(`\n🗑️  Marking for deletion (${toDelete.length} rule(s)):`);
    toDelete.forEach((rule, idx) => {
      console.log(`   ${idx + 1}. ${rule.id} - "${rule.name || '(empty)'}" (Created: ${rule.created_at})`);
    });
  }

  return { toDelete, toKeep };
}

async function main() {
  try {
    console.log('🚀 Starting Priority Rules Cleanup\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Version ID: ${VERSION_ID}\n`);

    // Step 1: Fetch all rules
    console.log('📥 Fetching priority rules from database...');
    const rules = await fetchPriorityRules();

    // Step 2: Analyze rules
    analyzeRules(rules);

    // Step 3: Identify duplicates
    const { duplicateGroups, emptyNameRules } = identifyDuplicates(rules);

    if (duplicateGroups.length === 0) {
      console.log('\n✅ No duplicates to clean up!');
      return;
    }

    // Step 4: Process each duplicate group
    console.log('\n🧹 CLEANUP PLAN');
    console.log('='.repeat(80));

    const allToDelete = [];

    duplicateGroups.forEach(({ name, rules }) => {
      const { toDelete } = selectRulesToDelete(rules);
      allToDelete.push(...toDelete);
    });

    if (allToDelete.length === 0) {
      console.log('\n✅ No rules need to be deleted!');
      return;
    }

    console.log(`\n📋 Summary: Will delete ${allToDelete.length} duplicate rule(s)`);
    console.log('\nProceeding with deletion in 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Delete duplicates
    console.log('🗑️  DELETING DUPLICATES');
    console.log('='.repeat(80));

    for (const rule of allToDelete) {
      try {
        console.log(`Deleting: ${rule.id} - "${rule.name || '(empty)'}"`);
        await deletePriorityRule(rule.id);
        console.log('  ✅ Deleted successfully');
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }

    // Step 6: Verify cleanup
    console.log('\n🔍 VERIFYING CLEANUP');
    console.log('='.repeat(80));

    const remainingRules = await fetchPriorityRules();
    console.log(`\nRemaining rules: ${remainingRules.length}`);

    if (remainingRules.length > 0) {
      console.log('\nFinal state:');
      remainingRules.forEach((rule, index) => {
        console.log(`  ${index + 1}. "${rule.name || '(empty)'}" (ID: ${rule.id})`);
      });
    }

    console.log('\n✅ CLEANUP COMPLETE!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
