#!/usr/bin/env node
/**
 * Fixed Staff Groups Restoration to Supabase
 *
 * Properly handles the multi-tenant schema with restaurant_id and version_id requirements.
 */

const https = require("https");
const crypto = require("crypto");

const SUPABASE_URL = "https://ymdyejrljmvajqjbejvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE";

// Static staff groups from ConstraintEngine.js
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
      description:
        "When 料理長 has weekday day off, 古藤's day off should be within ±2 days",
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

async function restoreStaffGroups() {
  console.log("🔄 Starting staff groups restoration...\n");

  try {
    // Step 1: Get or create restaurant
    console.log("1️⃣ Getting restaurant...");
    let restaurants = await makeRequest("GET", "/rest/v1/restaurants?select=*");

    let restaurantId;
    if (restaurants && restaurants.length > 0) {
      restaurantId = restaurants[0].id;
      console.log(`   ✅ Found restaurant: ${restaurants[0].name} (${restaurantId})`);
    } else {
      console.log("   Creating default restaurant...");
      const newRestaurant = await makeRequest("POST", "/rest/v1/restaurants", {
        name: "Default Restaurant",
        slug: "default-restaurant",
        timezone: "Asia/Tokyo",
        is_active: true,
      });
      restaurantId = newRestaurant[0].id;
      console.log(`   ✅ Created restaurant: ${restaurantId}`);
    }

    // Step 2: Get or create active config version
    console.log("\n2️⃣ Getting active config version...");
    let versions = await makeRequest(
      "GET",
      `/rest/v1/config_versions?restaurant_id=eq.${restaurantId}&is_active=eq.true&select=*`
    );

    let versionId;
    if (versions && versions.length > 0) {
      versionId = versions[0].id;
      console.log(
        `   ✅ Found active version: v${versions[0].version_number} - ${versions[0].name}`
      );
    } else {
      console.log("   Creating default config version...");
      const newVersion = await makeRequest("POST", "/rest/v1/config_versions", {
        restaurant_id: restaurantId,
        version_number: 1,
        name: "Default Configuration",
        description: "Initial configuration with restored staff groups",
        is_active: true,
      });
      versionId = newVersion[0].id;
      console.log(`   ✅ Created version: v1 (${versionId})`);
    }

    // Step 3: Delete existing staff groups for this version
    console.log("\n3️⃣ Checking for existing groups...");
    const existingGroups = await makeRequest(
      "GET",
      `/rest/v1/staff_groups?version_id=eq.${versionId}&select=*`
    );

    if (existingGroups && existingGroups.length > 0) {
      console.log(`   Found ${existingGroups.length} existing groups - clearing...`);
      for (const group of existingGroups) {
        await makeRequest("DELETE", `/rest/v1/staff_groups?id=eq.${group.id}`);
      }
      console.log("   ✅ Cleared existing groups");
    }

    // Step 4: Insert staff groups with proper schema
    console.log("\n4️⃣ Inserting 8 staff groups...");

    const groupsToInsert = STATIC_STAFF_CONFLICT_GROUPS.map((group) => {
      const { members, coverageRule, proximityPattern, ...rest } = group;

      // Build group_config JSONB with members and optional rules
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

    const insertedGroups = await makeRequest(
      "POST",
      "/rest/v1/staff_groups",
      groupsToInsert
    );

    console.log("\n✅ Staff groups restored successfully!\n");
    console.log("📋 Restored groups:");
    STATIC_STAFF_CONFLICT_GROUPS.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.name}: ${group.members.join(", ")}`);
      if (group.coverageRule) {
        console.log(
          `      Coverage: ${group.coverageRule.backupStaff} (${group.coverageRule.requiredShift})`
        );
      }
      if (group.proximityPattern) {
        console.log(
          `      Proximity: ${group.proximityPattern.trigger} ↔ ${group.proximityPattern.target} (±${group.proximityPattern.proximity} days)`
        );
      }
    });

    console.log("\n🔄 Refresh your app to see the restored staff groups!");
    console.log(`📌 Restaurant ID: ${restaurantId}`);
    console.log(`📌 Version ID: ${versionId}`);
  } catch (error) {
    console.error("\n❌ Error during restoration:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Ensure Supabase URL and API key are correct");
    console.error("2. Check that RLS policies allow anonymous access");
    console.error("3. Verify the database schema matches the expected structure");
    process.exit(1);
  }
}

restoreStaffGroups();
