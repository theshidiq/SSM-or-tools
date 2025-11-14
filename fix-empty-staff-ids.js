/**
 * Fix Priority Rules with Empty staff_ids
 *
 * This script finds all priority rules with empty staff_ids arrays
 * and gives you options to either delete them or update them with staff members.
 *
 * Run with: node fix-empty-staff-ids.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.development' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.development');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n🔍 Finding Priority Rules with Empty staff_ids...\n');

  // Fetch all priority rules
  const { data: rules, error } = await supabase
    .from('priority_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching rules:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${rules.length} total priority rules\n`);

  // Filter rules with empty staff_ids
  const emptyRules = rules.filter(rule => {
    const staffIds = rule.rule_definition?.staff_ids || [];
    return staffIds.length === 0;
  });

  if (emptyRules.length === 0) {
    console.log('✅ Great! No rules with empty staff_ids found.');
    console.log('   All your priority rules have staff members assigned.\n');
    return;
  }

  console.log(`⚠️  Found ${emptyRules.length} rule(s) with empty staff_ids:\n`);
  console.log('─'.repeat(80));

  emptyRules.forEach((rule, index) => {
    console.log(`\n${index + 1}. Rule ID: ${rule.id}`);
    console.log(`   Name: "${rule.name || '(unnamed)'}"`);
    console.log(`   Type: ${rule.rule_definition?.ruleType || 'unknown'}`);
    console.log(`   Shift: ${rule.rule_definition?.shiftType || 'unknown'}`);
    console.log(`   Days: ${JSON.stringify(rule.rule_definition?.daysOfWeek || [])}`);
    console.log(`   Created: ${rule.created_at}`);
    console.log(`   ❌ staff_ids: [] (EMPTY)`);
  });

  console.log('\n' + '─'.repeat(80));
  console.log('\n🛠️  RECOMMENDED ACTIONS:\n');
  console.log('Option 1: DELETE these rules (they\'re incomplete)');
  console.log('   Command: node delete-empty-priority-rules.js');
  console.log('');
  console.log('Option 2: UPDATE these rules manually in the UI');
  console.log('   1. Open http://localhost:3001');
  console.log('   2. Go to Settings → Priority Rules');
  console.log('   3. Edit each rule and add staff members');
  console.log('   4. With the new validation, you MUST add staff before saving');
  console.log('');
  console.log('Option 3: UPDATE via SQL (for advanced users)');
  console.log('   You can update the rule_definition JSONB to add staff_ids');
  console.log('');
}

main().catch(console.error);
