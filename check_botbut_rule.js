/**
 * Query the database to see the raw "botbut" priority rule data
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function checkBotbutRule() {
  console.log('\n🔍 Querying database for "botbut" priority rule...\n');
  
  const { data, error } = await supabase
    .from('priority_rules')
    .select('*')
    .eq('name', 'botbut')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Raw database record:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n🔍 rule_definition field (JSONB):');
  console.log(JSON.stringify(data.rule_definition, null, 2));
  
  console.log('\n🔍 Checking critical fields:');
  console.log('- rule_definition.staff_id:', data.rule_definition?.staff_id);
  console.log('- rule_definition.conditions:', data.rule_definition?.conditions);
  console.log('- rule_definition.conditions.day_of_week:', data.rule_definition?.conditions?.day_of_week);
  console.log('- rule_definition.conditions.shift_type:', data.rule_definition?.conditions?.shift_type);
}

checkBotbutRule().catch(console.error);
