/**
 * Phase 4: Migration Test Utility
 * Creates sample localStorage data and tests the migration process
 */

import {
  performStaffMigration,
  hasLocalStorageStaffData,
} from "./staffMigrationUtils";

// Sample staff data in various localStorage formats
const sampleStaffData = {
  // Modern period-based format
  periodBased: [
    {
      id: "test-staff-1",
      name: "田中太郎",
      position: "Head Chef",
      status: "社員",
      color: "position-chef",
      staff_order: 0,
      startPeriod: { year: 2021, month: 1, day: 1 },
      endPeriod: null,
    },
    {
      id: "test-staff-2",
      name: "佐藤花子",
      position: "Sous Chef",
      status: "社員",
      color: "position-server",
      staff_order: 1,
      startPeriod: { year: 2022, month: 4, day: 1 },
      endPeriod: null,
    },
    {
      id: "test-staff-3",
      name: "鈴木一郎",
      position: "Server",
      status: "パート",
      color: "position-staff",
      staff_order: 2,
      startPeriod: { year: 2023, month: 1, day: 15 },
      endPeriod: { year: 2024, month: 12, day: 31 },
    },
  ],

  // Legacy format
  legacy: [
    {
      staffId: "legacy-staff-1",
      staffName: "高橋次郎",
      position: "Cook",
      order: 3,
    },
    {
      staffId: "legacy-staff-2",
      staffName: "山田美咲",
      position: "Prep",
      order: 4,
    },
  ],

  // Injected format (from inject-schedule.js)
  injected: [
    {
      id: "injected-staff-1",
      name: "小林健",
      position: "Manager",
      status: "社員",
      startPeriod: { year: 2020, month: 1, day: 1 },
    },
  ],
};

/**
 * Populate localStorage with sample staff data for testing
 */
export const createSampleLocalStorageData = () => {
  console.log("🧪 Creating sample localStorage data for migration testing...");

  try {
    // Period-based data (periods 0-2)
    for (let period = 0; period < 3; period++) {
      const staffKey = `staff-${period}`;
      const optimizedStaffKey = `optimized_staff_${period}`;

      // Add regular staff data for periods 0-1
      if (period < 2) {
        localStorage.setItem(
          staffKey,
          JSON.stringify(sampleStaffData.periodBased),
        );
      }

      // Add optimized data for period 0 (should be preferred)
      if (period === 0) {
        localStorage.setItem(
          optimizedStaffKey,
          JSON.stringify(sampleStaffData.periodBased),
        );
      }
    }

    // Legacy data
    localStorage.setItem(
      "staffMembers",
      JSON.stringify(sampleStaffData.legacy),
    );

    // Injected data
    for (let period = 0; period < 2; period++) {
      localStorage.setItem(
        `staff_members_${period}`,
        JSON.stringify(sampleStaffData.injected),
      );
    }

    // Additional test data with different formats
    localStorage.setItem(
      "staff-3",
      JSON.stringify([
        { name: "スタッフ１", position: "テスト" },
        { name: "スタッフ２", position: "テスト２" },
      ]),
    );

    console.log("✅ Sample localStorage data created successfully");

    // Verify what was created
    const check = hasLocalStorageStaffData();
    console.log(`📊 Found data: ${check.foundKeys.join(", ")}`);
    console.log(`📈 Total sources: ${check.count}`);

    return true;
  } catch (error) {
    console.error("❌ Failed to create sample data:", error);
    return false;
  }
};

/**
 * Clear all test localStorage data
 */
export const clearTestLocalStorageData = () => {
  console.log("🧹 Clearing test localStorage data...");

  try {
    const keysToRemove = [];

    // Find all keys that match our test patterns
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("staff") ||
          key.includes("backup") ||
          key.includes("migration"))
      ) {
        keysToRemove.push(key);
      }
    }

    // Remove them
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    console.log(`🗑️ Removed ${keysToRemove.length} test keys:`, keysToRemove);
    return true;
  } catch (error) {
    console.error("❌ Failed to clear test data:", error);
    return false;
  }
};

/**
 * Run a complete migration test
 */
export const runMigrationTest = async (options = {}) => {
  const {
    createSampleData = true,
    cleanupAfter = false,
    dryRun = true,
    logResults = true,
  } = options;

  console.log("🚀 Starting migration test...");
  console.log(
    `Settings: createSampleData=${createSampleData}, dryRun=${dryRun}, cleanupAfter=${cleanupAfter}`,
  );

  try {
    // Step 1: Create sample data if requested
    if (createSampleData) {
      const created = createSampleLocalStorageData();
      if (!created) {
        return { success: false, error: "Failed to create sample data" };
      }
    }

    // Step 2: Check what's available for migration
    const dataCheck = hasLocalStorageStaffData();
    if (!dataCheck.hasData) {
      return { success: false, error: "No data available for migration" };
    }

    console.log(
      `📋 Pre-migration check: Found ${dataCheck.count} data sources`,
    );

    // Step 3: Run migration
    console.log("⚡ Running migration...");
    const migrationResult = await performStaffMigration({
      skipDuplicates: true,
      updateDuplicates: false,
      createBackup: true,
      cleanup: false, // Don't cleanup during test
      dryRun,
    });

    // Step 4: Log results
    if (logResults) {
      console.log("\n📊 MIGRATION TEST RESULTS:");
      console.log("========================");
      console.log(`Success: ${migrationResult.success ? "✅" : "❌"}`);
      console.log(`Message: ${migrationResult.message}`);
      console.log(`Dry Run: ${migrationResult.dryRun ? "🧪" : "🔄"}`);

      if (migrationResult.migrated !== undefined) {
        console.log(`Staff Migrated: ${migrationResult.migrated}`);
      }

      if (migrationResult.duplicates !== undefined) {
        console.log(`Duplicates Found: ${migrationResult.duplicates}`);
      }

      if (migrationResult.totalExtracted !== undefined) {
        console.log(`Total Extracted: ${migrationResult.totalExtracted}`);
      }

      if (migrationResult.uniqueProcessed !== undefined) {
        console.log(`Unique Processed: ${migrationResult.uniqueProcessed}`);
      }

      if (migrationResult.extractedFrom) {
        console.log(`Sources: ${migrationResult.extractedFrom.join(", ")}`);
      }

      if (migrationResult.backupKey) {
        console.log(`Backup Created: ${migrationResult.backupKey}`);
      }

      if (migrationResult.errors && migrationResult.errors.length > 0) {
        console.log("❌ Errors:");
        migrationResult.errors.forEach((error) => console.log(`   - ${error}`));
      }

      if (migrationResult.dryRun && migrationResult.preview) {
        console.log("\n👥 MIGRATION PREVIEW:");
        migrationResult.preview.forEach((staff, index) => {
          console.log(
            `   ${index + 1}. ${staff.name} (${staff.position}) - ${staff.status}`,
          );
        });
      }
    }

    // Step 5: Cleanup if requested
    if (cleanupAfter) {
      const cleaned = clearTestLocalStorageData();
      console.log(`🧹 Cleanup: ${cleaned ? "Success" : "Failed"}`);
    }

    return {
      success: true,
      migrationResult,
      testConfig: { createSampleData, dryRun, cleanupAfter },
    };
  } catch (error) {
    console.error("❌ Migration test failed:", error);
    return {
      success: false,
      error: error.message,
      testConfig: { createSampleData, dryRun, cleanupAfter },
    };
  }
};

/**
 * Quick test functions for browser console
 */
export const quickTests = {
  // Create data and run dry run
  dryRun: () => runMigrationTest({ dryRun: true, cleanupAfter: false }),

  // Create data and run actual migration
  migrate: () => runMigrationTest({ dryRun: false, cleanupAfter: false }),

  // Just create sample data for manual testing
  createData: () => createSampleLocalStorageData(),

  // Clear all test data
  cleanup: () => clearTestLocalStorageData(),

  // Check current localStorage status
  check: () => {
    const result = hasLocalStorageStaffData();
    console.log("📊 localStorage Status:", result);
    return result;
  },
};

// Expose functions to window for browser console testing
if (typeof window !== "undefined") {
  window.migrationTest = quickTests;
  console.log("🛠️ Migration test utilities available at: window.migrationTest");
  console.log(
    "Available methods: dryRun(), migrate(), createData(), cleanup(), check()",
  );
}
