#!/usr/bin/env node
/**
 * Delete ALL staff groups and restore the 8 static groups
 * This ensures we start fresh with correct IDs
 */

const https = require("https");
const crypto = require("crypto");

const SUPABASE_URL = "https://ymdyejrljmvajqjbejvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE";

const STATIC_STAFF_CONFLICT_GROUPS = [
  { name: "Group 1", members: ["料理長", "井関"] },
  {
    name: "Group 2",
    members: ["料理長", "古藤"],
    coverageRule: {
      backupStaff: "中田",
      requiredShift: "normal",
      description: "When Group 2 member has day off, 中田 must work normal shift",
    },
    proximityPattern: {
      trigger: "料理長",
      condition: "weekday_off",
      target: "古藤",
      proximity: 2,
      description: "When 料理長 has weekday day off, 古藤's day off should be within ±2 days",
    },
  },
  { name: "Group 3", members: ["井関", "小池"] },
  { name: "Group 4", members: ["田辺", "小池"] },
  { name: "Group 5", members: ["古藤", "岸"] },
  { name: "Group 6", members: ["与儀", "カマル"] },
  { name: "Group 7", members: ["カマル", "高野"] },
  { name: "Group 8", members: ["高野", "派遣スタッフ"] },
];

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=representation",
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

async function deleteAndRestore() {
  console.log("🔄 Delete and Restore Staff Groups\n");

  try {
    // Step 1: Get restaurant and version
    const restaurants = await makeRequest("GET", "/rest/v1/restaurants?select=*");
    const restaurantId = restaurants[0].id;
    console.log(`1️⃣ Restaurant: ${restaurants[0].name}`);

    const versions = await makeRequest(
      "GET",
      `/rest/v1/config_versions?restaurant_id=eq.${restaurantId}&is_active=eq.true&select=*`
    );
    const versionId = versions[0].id;
    console.log(`2️⃣ Version: v${versions[0].version_number}\n`);

    // Step 2: DELETE ALL staff groups
    console.log("3️⃣ Deleting ALL staff groups...");
    const allGroups = await makeRequest("GET", "/rest/v1/staff_groups?select=*");
    console.log(`   Found ${allGroups.length} groups to delete`);

    for (const group of allGroups) {
      await makeRequest("DELETE", `/rest/v1/staff_groups?id=eq.${group.id}`);
      console.log(`   ✅ Deleted: ${group.name} (${group.id})`);
    }

    console.log("\n4️⃣ Creating fresh staff groups...");

    // Step 3: Insert new groups
    const groupsToInsert = STATIC_STAFF_CONFLICT_GROUPS.map((group) => {
      const { members, coverageRule, proximityPattern, ...rest } = group;
      const groupConfig = { members };
      if (coverageRule) groupConfig.coverageRule = coverageRule;
      if (proximityPattern) groupConfig.proximityPattern = proximityPattern;

      return {
        id: crypto.randomUUID(),
        restaurant_id: restaurantId,
        version_id: versionId,
        ...rest,
        group_config: groupConfig,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    await makeRequest("POST", "/rest/v1/staff_groups", groupsToInsert);

    console.log("\n✅ SUCCESS! Fresh staff groups created:");
    groupsToInsert.forEach((g, i) => {
      console.log(`   ${i + 1}. ${g.name}: ${g.group_config.members.join(", ")}`);
    });

    console.log("\n🔄 Now refresh your browser to see the groups with members!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

deleteAndRestore();
