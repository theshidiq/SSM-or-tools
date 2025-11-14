#!/usr/bin/env node
/**
 * Check Staff Groups Table Schema
 */

const https = require("https");

const SUPABASE_URL = "https://ymdyejrljmvajqjbejvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE";

function makeRequest(method, path) {
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
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function checkSchema() {
  console.log("🔍 Checking staff_groups table...\n");

  try {
    // Try to get any existing records to see the structure
    const result = await makeRequest("GET", "/rest/v1/staff_groups?select=*&limit=1");

    console.log("Status:", result.status);
    console.log("\nTable structure (from existing data):");
    console.log(JSON.stringify(result.body, null, 2));

    // Try inserting a test record to see what fields are accepted
    console.log("\n\n🧪 Testing minimal insert...");
    const testRecord = {
      name: "Test Group",
      members: ["Test1", "Test2"],
    };

    const insertResult = await makeRequest(
      "POST",
      "/rest/v1/staff_groups",
      testRecord
    );
    console.log("Insert result:", insertResult);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkSchema();
