const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBrokenRules() {
  console.log('🔍 Fetching priority rules with NULL rule_definition...');

  const { data: rules, error: fetchError } = await supabase
    .from('priority_rules')
    .select('*')
    .is('rule_definition', null);

  if (fetchError) {
    console.error('❌ Error fetching rules:', fetchError);
    return;
  }

  console.log(`📊 Found ${rules.length} rule(s) with NULL rule_definition:`);
  rules.forEach((rule, i) => {
    console.log(`  ${i + 1}. "${rule.name}" (ID: ${rule.id})`);
  });

  if (rules.length === 0) {
    console.log('✅ No broken rules found!');
    return;
  }

  console.log('\n🗑️  Deleting broken rules...');

  const ruleIds = rules.map(r => r.id);
  const { data: deleted, error: deleteError } = await supabase
    .from('priority_rules')
    .delete()
    .in('id', ruleIds)
    .select();

  if (deleteError) {
    console.error('❌ Error deleting rules:', deleteError);
    return;
  }

  console.log(`✅ Deleted ${deleted.length} broken rule(s)`);
  deleted.forEach((rule, i) => {
    console.log(`  ${i + 1}. "${rule.name}" (ID: ${rule.id})`);
  });
}

cleanupBrokenRules().catch(console.error);
