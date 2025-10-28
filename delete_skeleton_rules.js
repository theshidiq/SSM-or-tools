const fetch = require('node-fetch');

const SUPABASE_URL = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';

async function deleteSkeletonRules() {
  console.log('🗑️  Deleting skeleton priority rules with NULL rule_definition...\n');

  // First, fetch all priority rules to see what we have
  const fetchResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.f9702e4e-5d19-4f01-a534-250313c3f977&select=id,name,rule_definition`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  const allRules = await fetchResponse.json();
  console.log(`📊 Found ${allRules.length} total priority rules:`);
  allRules.forEach(rule => {
    const hasDefinition = rule.rule_definition !== null && Object.keys(rule.rule_definition || {}).length > 0;
    console.log(`  - ${rule.name}: ${hasDefinition ? '✅ HAS rule_definition' : '❌ NULL rule_definition'}`);
  });

  // Delete rules with NULL rule_definition
  const deleteResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.f9702e4e-5d19-4f01-a534-250313c3f977&rule_definition=is.null`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  if (deleteResponse.ok) {
    console.log('\n✅ Successfully deleted skeleton priority rules with NULL rule_definition');
  } else {
    const error = await deleteResponse.text();
    console.error('\n❌ Failed to delete skeleton rules:', error);
    process.exit(1);
  }

  // Verify deletion
  const verifyResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.f9702e4e-5d19-4f01-a534-250313c3f977&select=id,name,rule_definition`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  const remainingRules = await verifyResponse.json();
  console.log(`\n📊 Remaining priority rules: ${remainingRules.length}`);
  if (remainingRules.length > 0) {
    remainingRules.forEach(rule => {
      console.log(`  - ${rule.name}: rule_definition = ${JSON.stringify(rule.rule_definition).substring(0, 100)}`);
    });
  } else {
    console.log('  (none - database is clean)');
  }
}

deleteSkeletonRules().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
