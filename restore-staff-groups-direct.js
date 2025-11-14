#!/usr/bin/env node
/**
 * Direct Staff Groups Restoration to Supabase
 *
 * This script directly inserts the 8 static staff groups into Supabase
 * without going through the WebSocket backend.
 *
 * Usage: node restore-staff-groups-direct.js
 */

const https = require("https");
const crypto = require("crypto");

// Supabase configuration from .env
const SUPABASE_URL = "https://ymdyejrljmvajqjbejvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE";

// Define the 8 static staff groups (from ConstraintEngine.js)
const STATIC_STAFF_CONFLICT_GROUPS = [
  {
    id: crypto.randomUUID(),
    name: "Group 1",
    members: ["料理長", "井関"],
  },
  {
    id: crypto.randomUUID(),
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
  {
    id: crypto.randomUUID(),
    name: "Group 3",
    members: ["井関", "小池"],
  },
  {
    id: crypto.randomUUID(),
    name: "Group 4",
    members: ["田辺", "小池"],
  },
  {
    id: crypto.randomUUID(),
    name: "Group 5",
    members: ["古藤", "岸"],
  },
  {
    id: crypto.randomUUID(),
    name: "Group 6",
    members: ["与儀", "カマル"],
  },
  {
    id: crypto.randomUUID(),
    name: "Group 7",
    members: ["カマル", "高野"],
  },
  {
    id: crypto.randomUUID(),
    name: "Group 8",
    members: ["高野", "派遣スタッフ"],
  },
];

/**
 * Make HTTP request to Supabase
 */
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

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve(parsed);
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${body || res.statusMessage}`,
            ),
          );
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Main restoration function
 */
async function restoreStaffGroups() {
  console.log("🔄 Starting staff groups restoration...\n");

  try {
    // Step 1: Check if staff_groups table exists and get current data
    console.log("1️⃣ Checking existing staff groups...");
    let existingGroups = [];
    try {
      existingGroups = await makeRequest(
        "GET",
        "/rest/v1/staff_groups?select=*",
      );
      console.log(`   Found ${existingGroups.length} existing groups`);
    } catch (error) {
      console.log("   No existing groups found (or table doesn't exist)");
    }

    // Step 2: Delete existing groups if any
    if (existingGroups.length > 0) {
      console.log("\n2️⃣ Clearing existing groups...");
      for (const group of existingGroups) {
        await makeRequest("DELETE", `/rest/v1/staff_groups?id=eq.${group.id}`);
        console.log(`   ✅ Deleted group: ${group.name}`);
      }
    }

    // Step 3: Insert new groups
    console.log("\n3️⃣ Inserting 8 staff groups...");
    const insertedGroups = await makeRequest(
      "POST",
      "/rest/v1/staff_groups",
      STATIC_STAFF_CONFLICT_GROUPS,
    );

    console.log("\n✅ Staff groups restored successfully!");
    console.log("\n📋 Restored groups:");
    STATIC_STAFF_CONFLICT_GROUPS.forEach((group, index) => {
      console.log(
        `   ${index + 1}. ${group.name}: ${group.members.join(", ")}`,
      );
      if (group.coverageRule) {
        console.log(
          `      Coverage: ${group.coverageRule.backupStaff} (${group.coverageRule.requiredShift})`,
        );
      }
      if (group.proximityPattern) {
        console.log(
          `      Proximity: ${group.proximityPattern.trigger} ↔ ${group.proximityPattern.target} (±${group.proximityPattern.proximity} days)`,
        );
      }
    });

    console.log("\n🔄 Refresh your app to see the restored staff groups!");
  } catch (error) {
    console.error("\n❌ Error during restoration:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Ensure the staff_groups table exists in Supabase");
    console.error("2. Check that the table has proper permissions");
    console.error("3. Verify the table schema matches the data structure");
    console.error("\nExpected schema:");
    console.error("  - id: uuid (primary key)");
    console.error("  - name: text");
    console.error("  - members: text[]");
    console.error("  - coverageRule: jsonb (optional)");
    console.error("  - proximityPattern: jsonb (optional)");
    process.exit(1);
  }
}

// Run the restoration
restoreStaffGroups();
