/**
 * Phase 4: Staff Migration Utils Tests
 * Test the staff migration functionality
 */

import {
  hasLocalStorageStaffData,
  extractLocalStorageStaffData,
  transformStaffDataForDatabase,
  performStaffMigration,
  backupLocalStorageStaffData,
  cleanupLocalStorageStaffData,
  restoreStaffFromBackup,
} from "../staffMigrationUtils";

// Mock supabase
jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [],
        error: null,
      })),
      upsert: jest.fn(() => ({
        error: null,
      })),
    })),
  },
}));

describe("Staff Migration Utils", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe("hasLocalStorageStaffData", () => {
    it("should detect no data when localStorage is empty", () => {
      const result = hasLocalStorageStaffData();
      expect(result.hasData).toBe(false);
      expect(result.foundKeys).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("should detect period-based staff data", () => {
      localStorage.setItem("staff-0", JSON.stringify([{ name: "Test Staff" }]));
      localStorage.setItem(
        "staff-1",
        JSON.stringify([{ name: "Test Staff 2" }]),
      );

      const result = hasLocalStorageStaffData();
      expect(result.hasData).toBe(true);
      expect(result.foundKeys).toContain("Period 0");
      expect(result.foundKeys).toContain("Period 1");
      expect(result.count).toBe(2);
    });

    it("should detect legacy staff data", () => {
      localStorage.setItem(
        "staffMembers",
        JSON.stringify([{ name: "Legacy Staff" }]),
      );

      const result = hasLocalStorageStaffData();
      expect(result.hasData).toBe(true);
      expect(result.foundKeys).toContain("Legacy");
      expect(result.count).toBe(1);
    });

    it("should detect injected staff data", () => {
      localStorage.setItem(
        "staff_members_0",
        JSON.stringify([{ name: "Injected Staff" }]),
      );

      const result = hasLocalStorageStaffData();
      expect(result.hasData).toBe(true);
      expect(result.foundKeys).toContain("Injected Period 0");
      expect(result.count).toBe(1);
    });
  });

  describe("extractLocalStorageStaffData", () => {
    it("should extract period-based data correctly", () => {
      const testData = [
        { id: "test-1", name: "Test Staff 1", position: "Cook" },
        { id: "test-2", name: "Test Staff 2", position: "Server" },
      ];
      localStorage.setItem("staff-0", JSON.stringify(testData));

      const result = extractLocalStorageStaffData();
      expect(result).toBeTruthy();
      expect(result.periodBased[0]).toBeTruthy();
      expect(result.periodBased[0].data).toEqual(testData);
      expect(result.periodBased[0].source).toBe("regular");
    });

    it("should prefer optimized data over regular data", () => {
      const regularData = [{ name: "Regular Staff" }];
      const optimizedData = [{ name: "Optimized Staff" }];

      localStorage.setItem("staff-0", JSON.stringify(regularData));
      localStorage.setItem("optimized_staff_0", JSON.stringify(optimizedData));

      const result = extractLocalStorageStaffData();
      expect(result.periodBased[0].data).toEqual(optimizedData);
      expect(result.periodBased[0].source).toBe("optimized");
    });

    it("should extract legacy data", () => {
      const legacyData = [{ name: "Legacy Staff", position: "Manager" }];
      localStorage.setItem("staffMembers", JSON.stringify(legacyData));

      const result = extractLocalStorageStaffData();
      expect(result.legacy).toBeTruthy();
      expect(result.legacy.data).toEqual(legacyData);
      expect(result.legacy.source).toBe("legacy");
    });
  });

  describe("transformStaffDataForDatabase", () => {
    it("should transform array of staff data correctly", () => {
      const localData = [
        {
          id: "test-1",
          name: "Test Staff",
          position: "Cook",
          status: "社員",
          startPeriod: { year: 2023, month: 1, day: 1 },
          endPeriod: null,
        },
      ];

      const result = transformStaffDataForDatabase(localData);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "test-1",
        name: "Test Staff",
        position: "Cook",
        status: "社員",
        start_period: { year: 2023, month: 1, day: 1 },
        end_period: null,
      });
      expect(result[0].metadata.migrated_from).toBe("localStorage");
    });

    it("should handle missing IDs by generating them", () => {
      const localData = [{ name: "No ID Staff" }];

      const result = transformStaffDataForDatabase(localData);
      expect(result[0].id).toBeTruthy();
      expect(result[0].id).toMatch(/^migrated-\d+-0$/);
    });

    it("should handle empty or invalid data", () => {
      expect(transformStaffDataForDatabase([])).toEqual([]);
      expect(transformStaffDataForDatabase(null)).toEqual([]);
      expect(transformStaffDataForDatabase(undefined)).toEqual([]);
    });

    it("should set default values for missing fields", () => {
      const localData = [{ name: "Minimal Staff" }];

      const result = transformStaffDataForDatabase(localData);
      expect(result[0]).toMatchObject({
        name: "Minimal Staff",
        position: "",
        department: null,
        type: null,
        status: "社員",
        color: "position-server",
        staff_order: 0,
      });
    });
  });

  describe("backupLocalStorageStaffData", () => {
    it("should create backup of localStorage staff data", () => {
      const testData = [{ name: "Test Staff" }];
      localStorage.setItem("staff-0", JSON.stringify(testData));

      const result = backupLocalStorageStaffData();
      expect(result.success).toBe(true);
      expect(result.backupKey).toBeTruthy();
      expect(result.backupKey).toMatch(/^staff_migration_backup_/);

      // Verify backup was created
      const backupData = localStorage.getItem(result.backupKey);
      expect(backupData).toBeTruthy();

      const parsedBackup = JSON.parse(backupData);
      expect(parsedBackup.periodBased[0]).toBeTruthy();
    });

    it("should handle case with no data to backup", () => {
      const result = backupLocalStorageStaffData();
      expect(result.success).toBe(false);
      expect(result.message).toBe("No data to backup");
    });
  });

  describe("cleanupLocalStorageStaffData", () => {
    it("should remove staff-related localStorage keys", () => {
      localStorage.setItem("staff-0", JSON.stringify([]));
      localStorage.setItem("optimized_staff-1", JSON.stringify([]));
      localStorage.setItem("staffMembers", JSON.stringify([]));
      localStorage.setItem("other-key", "should not be removed");

      const result = cleanupLocalStorageStaffData();
      expect(result.success).toBe(true);
      expect(result.removedKeys.length).toBeGreaterThan(0);

      // Verify keys were removed
      expect(localStorage.getItem("staff-0")).toBeNull();
      expect(localStorage.getItem("staffMembers")).toBeNull();

      // Verify other keys were preserved
      expect(localStorage.getItem("other-key")).toBe("should not be removed");
    });

    it("should preserve backup keys when requested", () => {
      const backupKey = "staff_migration_backup_test";
      localStorage.setItem(backupKey, JSON.stringify({}));
      localStorage.setItem("staff-0", JSON.stringify([]));

      const result = cleanupLocalStorageStaffData(true);
      expect(result.success).toBe(true);

      // Backup should be preserved
      expect(localStorage.getItem(backupKey)).toBeTruthy();
      // Staff key should be removed
      expect(localStorage.getItem("staff-0")).toBeNull();
    });
  });

  describe("restoreStaffFromBackup", () => {
    it("should restore data from backup", () => {
      // Create a backup
      const originalData = [{ name: "Original Staff" }];
      localStorage.setItem("staff-0", JSON.stringify(originalData));
      const backupResult = backupLocalStorageStaffData();

      // Clear original data
      localStorage.removeItem("staff-0");

      // Restore from backup
      const restoreResult = restoreStaffFromBackup(backupResult.backupKey);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredCount).toBeGreaterThan(0);

      // Verify data was restored
      const restoredData = localStorage.getItem("staff-0");
      expect(restoredData).toBeTruthy();
      expect(JSON.parse(restoredData)).toEqual(originalData);
    });

    it("should handle missing backup gracefully", () => {
      const result = restoreStaffFromBackup("nonexistent-backup");
      expect(result.success).toBe(false);
      expect(result.message).toBe("Backup not found");
    });
  });
});
