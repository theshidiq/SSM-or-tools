const fetch = require('node-fetch');

const SUPABASE_URL = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';

async function deleteDuplicateRules() {
  console.log('🗑️  Deleting duplicate "New Priority" rules, keeping only the most complete one...\n');

  // Fetch all priority rules
  const fetchResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.f9702e4e-5d19-4f01-a534-250313c3f977&select=id,name,created_at&order=created_at`,
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
    console.log(`  - ${rule.name} (${rule.created_at}) - ID: ${rule.id}`);
  });

  // Filter rules that start with "New Priori" (all the incomplete duplicates)
  const duplicateRules = allRules.filter(rule => rule.name.startsWith('New Priori'));

  if (duplicateRules.length === 0) {
    console.log('\n✅ No duplicate rules found to delete');
    return;
  }

  // Keep only the last one (most complete - "New Priority Rule")
  const rulesToDelete = duplicateRules.slice(0, -1);

  console.log(`\n🗑️  Deleting ${rulesToDelete.length} duplicate rules:`);
  rulesToDelete.forEach(rule => {
    console.log(`  - ${rule.name} (${rule.id})`);
  });

  // Delete each duplicate rule
  for (const rule of rulesToDelete) {
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/priority_rules?id=eq.${rule.id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );

    if (deleteResponse.ok) {
      console.log(`  ✅ Deleted: ${rule.name}`);
    } else {
      const error = await deleteResponse.text();
      console.error(`  ❌ Failed to delete ${rule.name}:`, error);
    }
  }

  // Verify deletion
  const verifyResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?version_id=eq.f9702e4e-5d19-4f01-a534-250313c3f977&select=id,name`,
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
      console.log(`  - ${rule.name}`);
    });
  } else {
    console.log('  (none - database is clean)');
  }
}

deleteDuplicateRules().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
