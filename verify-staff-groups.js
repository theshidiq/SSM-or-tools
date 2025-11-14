#!/usr/bin/env node
/**
 * Verify Staff Groups Data in Database
 */

const https = require("https");

const SUPABASE_URL = "https://ymdyejrljmvajqjbejvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE";

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);

    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };

    const req = https.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function verifyStaffGroups() {
  console.log("🔍 Verifying staff groups in database...\n");

  try {
    // Get all staff groups
    const groups = await makeRequest("GET", "/rest/v1/staff_groups?select=*");

    console.log(`Found ${groups.length} groups:\n`);

    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} (${group.id})`);
      console.log(`   restaurant_id: ${group.restaurant_id}`);
      console.log(`   version_id: ${group.version_id}`);
      console.log(`   group_config:`, JSON.stringify(group.group_config, null, 2));
      console.log("");
    });

    // Check if members are in group_config
    const hasMembers = groups.filter(
      (g) => g.group_config && g.group_config.members && g.group_config.members.length > 0
    );

    console.log(`\n📊 Summary:`);
    console.log(`   Total groups: ${groups.length}`);
    console.log(`   Groups with members: ${hasMembers.length}`);
    console.log(`   Groups without members: ${groups.length - hasMembers.length}`);

    if (hasMembers.length === 0) {
      console.log("\n⚠️ WARNING: No groups have members in group_config!");
      console.log("This explains why the UI shows 'No staff assigned'");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyStaffGroups();
