/**
 * Staff Groups Restoration Utility
 *
 * Restores the 8 static staff conflict groups from ConstraintEngine.js
 * to the Supabase database via the WebSocket multi-table backend.
 *
 * Usage:
 * 1. Ensure the app is running (npm start)
 * 2. Open browser console at http://localhost:3001
 * 3. Copy and paste this entire script
 * 4. The groups will be restored automatically
 */

(async function restoreStaffGroups() {
  console.log("🔄 Starting staff groups restoration...");

  // Define the 8 static staff groups (from ConstraintEngine.js lines 226-252)
  const STATIC_STAFF_CONFLICT_GROUPS = [
    { name: "Group 1", members: ["料理長", "井関"] },
    {
      name: "Group 2",
      members: ["料理長", "古藤"],
      coverageRule: {
        backupStaff: "中田",
        requiredShift: "normal",
        description:
          "When Group 2 member has day off, 中田 must work normal shift",
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

  // Generate proper UUID for each group
  const groupsWithIds = STATIC_STAFF_CONFLICT_GROUPS.map((group) => ({
    id: crypto.randomUUID(),
    ...group,
  }));

  console.log("📦 Prepared groups for restoration:", groupsWithIds);

  // Access the settings context from the app
  // This assumes the app exposes the SettingsContext or we can access it via React DevTools
  try {
    // Method 1: Try to access via React DevTools global
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log("⚠️ Manual restoration required:");
      console.log("1. Open React DevTools");
      console.log("2. Select a component that uses useSettings()");
      console.log("3. In console, run:");
      console.log(
        "   $r.props.updateSettings?.({ staffGroups: " +
          JSON.stringify(groupsWithIds) +
          " })",
      );
      console.log("\nOR use the Settings UI Staff Groups tab to restore.");
      return;
    }

    // Method 2: Check if app has exposed settings methods
    if (window.updateSettings) {
      await window.updateSettings({ staffGroups: groupsWithIds });
      console.log("✅ Staff groups restored successfully!");
      console.log("🔄 Refresh the Staff Groups tab to see the restored data.");
    } else {
      // Fallback: Direct Supabase update
      console.log(
        "📋 Copy this data and paste into Settings > Staff Groups tab:",
      );
      console.log(JSON.stringify(groupsWithIds, null, 2));
    }
  } catch (error) {
    console.error("❌ Error during restoration:", error);
    console.log("\n📋 Manual restoration data:");
    console.log(JSON.stringify(groupsWithIds, null, 2));
  }
})();
