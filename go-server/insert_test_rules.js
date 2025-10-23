// Insert test priority rules with proper rule_definition structure
const https = require('https');

const testRules = [{
  id: "491cebaa-b66b-409f-9423-1a35efe9104d",
  restaurant_id: "e1661c71-b24f-4ee1-9e8b-7290a43c9575",
  version_id: "f9702e4e-5d19-4f01-a534-250313c3f977",
  name: "料理長 Sunday Early Preference",
  description: "料理長 prefers Sunday early shifts",
  priority_level: 4,
  rule_definition: {
    type: "preferred_shift",
    staff_id: "23ad831b-f8b3-415f-82e3-a6723a090dc6",
    conditions: {
      day_of_week: [0],
      shift_type: "early"
    },
    preference_strength: 0.9
  },
  penalty_weight: 3.0,
  is_hard_constraint: false,
  is_active: true
}, {
  id: "6d3e17b3-2ce4-4b78-a672-df00ccd39254",
  restaurant_id: "e1661c71-b24f-4ee1-9e8b-7290a43c9575",
  version_id: "f9702e4e-5d19-4f01-a534-250313c3f977",
  name: "与儀 Saturday Late Preference",
  description: "与儀 prefers Saturday late shifts",
  priority_level: 4,
  rule_definition: {
    type: "preferred_shift",
    staff_id: "b1f9dd22-b9c9-465a-ab5e-f25d98650122",
    conditions: {
      day_of_week: [6],
      shift_type: "late"
    },
    preference_strength: 0.9
  },
  penalty_weight: 3.0,
  is_hard_constraint: false,
  is_active: true
}];

const options = {
  hostname: 'ymdyejrljmvajqjbejvh.supabase.co',
  port: 443,
  path: '/rest/v1/priority_rules',
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

const data = JSON.stringify(testRules);

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 201) {
      console.log('✅ Successfully created 2 test priority rules');
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } else {
      console.error('❌ Failed to create rules:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
});

req.write(data);
req.end();
