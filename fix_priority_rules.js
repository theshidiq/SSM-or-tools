const fetch = require('node-fetch');

const SUPABASE_URL = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';

async function updatePriorityRules() {
  // INSERT both priority rules with proper JSONB data
  const insertRules = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([
        {
          restaurant_id: 'e1661c71-b24f-4ee1-9e8b-7290a43c9575',
          version_id: 'f9702e4e-5d19-4f01-a534-250313c3f977',
          name: '料理長 Sunday Early Preference',
          description: '料理長 prefers Sunday early shifts to prepare for the week',
          priority_level: 1,
          rule_definition: {
            type: 'preferred_shift',
            staff_id: '23ad831b-f8b3-415f-82e3-a6723a090dc6',
            conditions: {
              shift_type: 'early',
              day_of_week: [0]
            },
            preference_strength: 0.9
          },
          penalty_weight: 1.0,
          is_hard_constraint: false,
          is_active: true
        },
        {
          restaurant_id: 'e1661c71-b24f-4ee1-9e8b-7290a43c9575',
          version_id: 'f9702e4e-5d19-4f01-a534-250313c3f977',
          name: '与儀 Saturday Late Preference',
          description: '与儀 prefers Saturday late shifts',
          priority_level: 1,
          rule_definition: {
            type: 'preferred_shift',
            staff_id: 'b1f9dd22-b9c9-465a-ab5e-f25d98650122',
            conditions: {
              shift_type: 'late',
              day_of_week: [6]
            },
            preference_strength: 0.9
          },
          penalty_weight: 1.0,
          is_hard_constraint: false,
          is_active: true
        }
      ])
    }
  );

  const insertResult = await insertRules.json();
  console.log('✅ Inserted Priority Rules:', JSON.stringify(insertResult, null, 2));

  // Verify updates
  const verifyResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/priority_rules?is_active=eq.true&select=id,name,rule_definition&order=created_at`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );

  const verifyResult = await verifyResponse.json();
  console.log('\n📊 Verification - All priority rules:');
  verifyResult.forEach((rule, index) => {
    console.log(`\nRule ${index + 1}: ${rule.name}`);
    console.log(`  rule_definition:`, JSON.stringify(rule.rule_definition, null, 2));
  });
}

updatePriorityRules().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
