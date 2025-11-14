const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.development' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPriorityRule() {
  const ruleId = '90a07843-11bb-48a2-b93d-864f8486dacb';

  console.log(`\n🔍 Checking Priority Rule: ${ruleId}\n`);

  const { data, error } = await supabase
    .from('priority_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 Priority Rule Data:');
  console.log('─'.repeat(60));
  console.log('ID:', data.id);
  console.log('Name:', data.name);
  console.log('Description:', data.description);
  console.log('Priority Level:', data.priority_level);
  console.log('Penalty Weight:', data.penalty_weight);
  console.log('Is Hard Constraint:', data.is_hard_constraint);
  console.log('Is Active:', data.is_active);
  console.log('\n📦 Rule Definition (JSONB):');
  console.log(JSON.stringify(data.rule_definition, null, 2));
  console.log('\n🕐 Timestamps:');
  console.log('Created:', data.created_at);
  console.log('Updated:', data.updated_at);
  console.log('─'.repeat(60));

  // Check for staff IDs
  const staffIds = data.rule_definition?.staff_ids || [];
  const legacyStaffId = data.rule_definition?.staff_id;

  console.log('\n👥 Staff ID Analysis:');
  console.log('─'.repeat(60));

  if (staffIds.length > 0) {
    console.log(`✅ Found ${staffIds.length} staff ID(s) in staff_ids array:`);
    staffIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
  } else {
    console.log('❌ No staff IDs found in staff_ids array');
  }

  if (legacyStaffId) {
    console.log(`\n⚠️  Found legacy staff_id: ${legacyStaffId}`);
  }

  if (staffIds.length === 0 && !legacyStaffId) {
    console.log('\n⚠️  WARNING: No staff IDs stored in database!');
    console.log('   This rule has no staff members assigned.');
  }

  console.log('─'.repeat(60) + '\n');
}

checkPriorityRule().catch(console.error);
