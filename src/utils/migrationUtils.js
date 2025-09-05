/**
 * Phase 1 Data Migration Utilities
 * Helps transition from localStorage+Supabase to Supabase-first architecture
 */

import { supabase } from "./supabase";

/**
 * Check if there's existing data in localStorage that needs migration
 */
export const hasLocalStorageData = () => {
  try {
    // Check for common localStorage keys used in the old system
    const scheduleKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("schedule") ||
          key.includes("staff") ||
          key.includes("optimized"))
      ) {
        scheduleKeys.push(key);
      }
    }

    return scheduleKeys.length > 0;
  } catch (error) {
    console.warn("Error checking localStorage data:", error);
    return false;
  }
};

/**
 * Extract schedule data from localStorage for migration
 */
export const extractLocalStorageData = () => {
  try {
    const data = {};

    // Look for optimized storage data (most recent format)
    for (let i = 0; i < 6; i++) {
      const scheduleKey = `optimized_schedule_${i}`;
      const staffKey = `optimized_staff_${i}`;

      const scheduleData = localStorage.getItem(scheduleKey);
      const staffData = localStorage.getItem(staffKey);

      if (scheduleData || staffData) {
        data[i] = {
          schedule: scheduleData ? JSON.parse(scheduleData) : null,
          staff: staffData ? JSON.parse(staffData) : null,
        };
      }
    }

    // Also check for legacy format
    const legacySchedule = localStorage.getItem("schedule");
    const legacyStaff = localStorage.getItem("staffMembers");

    if (legacySchedule || legacyStaff) {
      data.legacy = {
        schedule: legacySchedule ? JSON.parse(legacySchedule) : null,
        staff: legacyStaff ? JSON.parse(legacyStaff) : null,
      };
    }

    return data;
  } catch (error) {
    console.error("Error extracting localStorage data:", error);
    return {};
  }
};

/**
 * Migrate localStorage data to Supabase
 */
export const migrateLocalStorageToSupabase = async (localData) => {
  if (!localData || Object.keys(localData).length === 0) {
    return { success: false, reason: "No data to migrate" };
  }

  try {
    let migrationCount = 0;

    // Migrate each period
    for (const [period, data] of Object.entries(localData)) {
      if (period === "legacy") continue; // Handle legacy separately

      if (data.schedule && data.staff) {
        const saveData = {
          ...data.schedule,
          _staff_members: data.staff,
        };

        // Save to Supabase
        const { error } = await supabase.from("schedules").insert([
          {
            schedule_data: saveData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            migration_source: `period_${period}`,
          },
        ]);

        if (error) {
          console.error(`Migration failed for period ${period}:`, error);
        } else {
          migrationCount++;
          console.log(`✅ Migrated period ${period} data`);
        }
      }
    }

    // Handle legacy data if present and no other data was migrated
    if (migrationCount === 0 && localData.legacy) {
      const legacyData = localData.legacy;
      if (legacyData.schedule && legacyData.staff) {
        const saveData = {
          ...legacyData.schedule,
          _staff_members: legacyData.staff,
        };

        const { error } = await supabase.from("schedules").insert([
          {
            schedule_data: saveData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            migration_source: "legacy_format",
          },
        ]);

        if (!error) {
          migrationCount++;
          console.log("✅ Migrated legacy data");
        }
      }
    }

    return {
      success: migrationCount > 0,
      migrationCount,
      reason:
        migrationCount > 0
          ? `Migrated ${migrationCount} periods`
          : "No valid data found",
    };
  } catch (error) {
    console.error("Migration error:", error);
    return {
      success: false,
      reason: error.message,
      error,
    };
  }
};

/**
 * Backup localStorage data before migration
 */
export const backupLocalStorageData = () => {
  try {
    const backup = {};
    const timestamp = new Date().toISOString();

    // Copy all shift-related localStorage data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("schedule") ||
          key.includes("staff") ||
          key.includes("optimized"))
      ) {
        backup[key] = localStorage.getItem(key);
      }
    }

    // Save backup to localStorage with timestamp
    const backupKey = `migration_backup_${timestamp}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));

    console.log(`📦 Created backup: ${backupKey}`);
    return backupKey;
  } catch (error) {
    console.error("Backup creation failed:", error);
    return null;
  }
};

/**
 * Clean up old localStorage data after successful migration
 */
export const cleanupOldLocalStorage = (keepBackup = true) => {
  try {
    const keysToRemove = [];

    // Find all schedule-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("schedule") ||
          key.includes("staff") ||
          key.includes("optimized"))
      ) {
        // Don't remove backup keys
        if (!key.includes("migration_backup")) {
          keysToRemove.push(key);
        }
      }
    }

    // Remove the keys
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed ${key}`);
    });

    return { success: true, removedKeys: keysToRemove };
  } catch (error) {
    console.error("Cleanup error:", error);
    return { success: false, error };
  }
};

/**
 * Complete migration workflow
 */
export const performMigration = async () => {
  console.log("🚀 Starting Phase 1 migration...");

  // Step 1: Check if migration is needed
  if (!hasLocalStorageData()) {
    return { success: true, reason: "No migration needed", skipped: true };
  }

  // Step 2: Create backup
  const backupKey = backupLocalStorageData();
  if (!backupKey) {
    return { success: false, reason: "Failed to create backup" };
  }

  // Step 3: Extract data
  const localData = extractLocalStorageData();
  if (Object.keys(localData).length === 0) {
    return { success: false, reason: "No valid data to migrate" };
  }

  // Step 4: Migrate to Supabase
  const migrationResult = await migrateLocalStorageToSupabase(localData);
  if (!migrationResult.success) {
    return migrationResult;
  }

  // Step 5: Clean up (keep backup)
  const cleanupResult = cleanupOldLocalStorage(true);

  console.log("✅ Migration completed successfully");

  return {
    success: true,
    migrationCount: migrationResult.migrationCount,
    backupKey,
    cleanupResult,
  };
};

/**
 * Development helper to restore from backup
 */
export const restoreFromBackup = (backupKey) => {
  try {
    const backupData = localStorage.getItem(backupKey);
    if (!backupData) {
      return { success: false, reason: "Backup not found" };
    }

    const backup = JSON.parse(backupData);

    // Restore all backed up keys
    Object.entries(backup).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    console.log(`🔄 Restored from backup: ${backupKey}`);
    return { success: true, restoredKeys: Object.keys(backup) };
  } catch (error) {
    console.error("Restore error:", error);
    return { success: false, error };
  }
};
