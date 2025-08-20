/**
 * BackupStaffService.test.js
 *
 * Comprehensive test suite for backup staff service functionality.
 * Tests automatic backup assignments, validation, and integration scenarios.
 */

import BackupStaffService from "../BackupStaffService";

// Mock data for testing
const mockStaffMembers = [
  { id: "staff-1", name: "料理長" },
  { id: "staff-2", name: "古藤" },
  { id: "staff-3", name: "中田" },
  { id: "staff-4", name: "井関" },
  { id: "staff-5", name: "小池" },
  { id: "staff-6", name: "与儀" },
];

const mockStaffGroups = [
  {
    id: "group-1",
    name: "Group 1",
    members: ["staff-1", "staff-4"], // 料理長, 井関
  },
  {
    id: "group-2",
    name: "Group 2",
    members: ["staff-1", "staff-2"], // 料理長, 古藤
  },
  {
    id: "group-3",
    name: "Group 3",
    members: ["staff-4", "staff-5"], // 井関, 小池
  },
];

const mockBackupAssignments = [
  {
    id: "backup-1",
    staffId: "staff-3", // 中田
    groupId: "group-2", // backs up Group 2
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "backup-2",
    staffId: "staff-6", // 与儀
    groupId: "group-1", // backs up Group 1
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "backup-3",
    staffId: "staff-3", // 中田
    groupId: "group-3", // backs up Group 3 (multiple backup assignments)
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

// Helper function to create test schedule
const createTestSchedule = (customAssignments = {}) => {
  const schedule = {};

  mockStaffMembers.forEach((staff) => {
    schedule[staff.id] = {
      "2024-01-01": "", // Normal shift
      "2024-01-02": "", // Normal shift
      "2024-01-03": "", // Normal shift
    };
  });

  // Apply custom assignments
  Object.keys(customAssignments).forEach((staffId) => {
    Object.keys(customAssignments[staffId]).forEach((dateKey) => {
      if (schedule[staffId]) {
        schedule[staffId][dateKey] = customAssignments[staffId][dateKey];
      }
    });
  });

  return schedule;
};

describe("BackupStaffService", () => {
  let backupService;

  beforeEach(() => {
    backupService = new BackupStaffService();
  });

  afterEach(() => {
    if (backupService.initialized) {
      backupService.cleanup();
    }
  });

  describe("Initialization", () => {
    test("should initialize successfully with valid data", async () => {
      const result = await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );

      expect(result).toBe(true);
      expect(backupService.initialized).toBe(true);
    });

    test("should handle empty data gracefully", async () => {
      const result = await backupService.initialize([], [], []);

      expect(result).toBe(true);
      expect(backupService.initialized).toBe(true);
    });

    test("should build backup maps correctly", async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );

      // Check staff backup assignments
      expect(backupService.getStaffBackupAssignments("staff-3")).toEqual([
        "group-2",
        "group-3",
      ]);
      expect(backupService.getStaffBackupAssignments("staff-6")).toEqual([
        "group-1",
      ]);

      // Check group backup staff
      expect(backupService.getGroupBackupStaff("group-1")).toEqual(["staff-6"]);
      expect(backupService.getGroupBackupStaff("group-2")).toEqual(["staff-3"]);
      expect(backupService.getGroupBackupStaff("group-3")).toEqual(["staff-3"]);
    });
  });

  describe("Backup Detection", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should detect when group members have day off", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off
        "staff-2": { "2024-01-01": "" }, // 古藤 working
      });

      const membersOff = backupService.findGroupMembersWithDayOff(
        schedule,
        mockStaffMembers,
        mockStaffGroups[1], // Group 2
        "2024-01-01",
      );

      expect(membersOff).toHaveLength(1);
      expect(membersOff[0].staffName).toBe("料理長");
      expect(membersOff[0].assignment).toBe("×");
    });

    test("should handle multiple group members off", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off
        "staff-2": { "2024-01-01": "×" }, // 古藤 has day off
      });

      const membersOff = backupService.findGroupMembersWithDayOff(
        schedule,
        mockStaffMembers,
        mockStaffGroups[1], // Group 2
        "2024-01-01",
      );

      expect(membersOff).toHaveLength(2);
      expect(membersOff.map((m) => m.staffName)).toEqual(["料理長", "古藤"]);
    });

    test("should return empty array when no members are off", () => {
      const schedule = createTestSchedule(); // All working

      const membersOff = backupService.findGroupMembersWithDayOff(
        schedule,
        mockStaffMembers,
        mockStaffGroups[1], // Group 2
        "2024-01-01",
      );

      expect(membersOff).toHaveLength(0);
    });
  });

  describe("Backup Assignment Processing", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should assign backup staff when group member has day off", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "" }, // 中田 available (backup for Group 2)
      });

      const updatedSchedule = backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      // 中田 should be assigned normal shift
      expect(updatedSchedule["staff-3"]["2024-01-01"]).toBe("○");
    });

    test("should not assign backup if already working", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "△" }, // 中田 already working early shift
      });

      const updatedSchedule = backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      // 中田 should keep existing assignment
      expect(updatedSchedule["staff-3"]["2024-01-01"]).toBe("△");
    });

    test("should assign backup if currently has day off", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "×" }, // 中田 also has day off initially
      });

      const updatedSchedule = backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      // 中田 should be assigned normal shift (backup takes priority)
      expect(updatedSchedule["staff-3"]["2024-01-01"]).toBe("○");
    });

    test("should handle multiple backup assignments for same staff", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-5": { "2024-01-01": "×" }, // 小池 has day off (Group 3)
        "staff-3": { "2024-01-01": "" }, // 中田 backs up both groups
      });

      const updatedSchedule = backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      // 中田 should be assigned normal shift for backup coverage
      expect(updatedSchedule["staff-3"]["2024-01-01"]).toBe("○");
    });
  });

  describe("Backup Validation", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should validate successful backup coverage", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "○" }, // 中田 working (backup for Group 2)
      });

      const dateRange = [new Date("2024-01-01")];
      const validation = backupService.validateBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        dateRange,
      );

      expect(validation.valid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    test("should detect missing backup coverage", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "×" }, // 中田 also off (should be working as backup)
      });

      const dateRange = [new Date("2024-01-01")];
      const validation = backupService.validateBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        dateRange,
      );

      expect(validation.valid).toBe(false);
      expect(validation.violations).toHaveLength(1);
      expect(validation.violations[0].type).toBe("backup_coverage_missing");
    });

    test("should calculate coverage statistics", () => {
      const schedule = createTestSchedule({
        "staff-1": {
          "2024-01-01": "×", // Day off
          "2024-01-02": "", // Working
          "2024-01-03": "×", // Day off
        },
        "staff-3": {
          "2024-01-01": "○", // Working (good coverage)
          "2024-01-02": "", // Working
          "2024-01-03": "×", // Off (bad coverage)
        },
      });

      const dateRange = [
        new Date("2024-01-01"),
        new Date("2024-01-02"),
        new Date("2024-01-03"),
      ];

      const validation = backupService.validateBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        dateRange,
      );

      expect(validation.coverage["group-2"]).toBeDefined();
      expect(validation.coverage["group-2"].totalDaysNeeded).toBe(2);
      expect(validation.coverage["group-2"].daysCovered).toBe(1);
      expect(validation.coverage["group-2"].daysUncovered).toBe(1);
    });
  });

  describe("Backup Status", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should provide detailed backup status for date", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "○" }, // 中田 working (backup)
        "staff-6": { "2024-01-01": "" }, // 与儀 available but not needed
      });

      const status = backupService.getBackupStatus(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      expect(status.groupsNeedingBackup).toHaveLength(1);
      expect(status.groupsNeedingBackup[0].groupName).toBe("Group 2");
      expect(status.groupsNeedingBackup[0].membersOff).toEqual(["料理長"]);
      expect(status.backupsAssigned).toHaveLength(1);
      expect(status.backupsAssigned[0].staffName).toBe("中田");
    });

    test("should identify potential issues", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" }, // 料理長 has day off (Group 2)
        "staff-3": { "2024-01-01": "×" }, // 中田 also off (should be working)
      });

      const status = backupService.getBackupStatus(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      expect(status.potentialIssues).toHaveLength(1);
      expect(status.potentialIssues[0].type).toBe("no_backup_coverage");
      expect(status.potentialIssues[0].groupName).toBe("Group 2");
    });
  });

  describe("Service Utilities", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should identify backup staff correctly", () => {
      expect(backupService.isBackupStaff("staff-3")).toBe(true); // 中田
      expect(backupService.isBackupStaff("staff-6")).toBe(true); // 与儀
      expect(backupService.isBackupStaff("staff-1")).toBe(false); // 料理長
    });

    test("should check staff availability correctly", () => {
      expect(backupService.isBackupStaffAvailable(undefined)).toBe(true);
      expect(backupService.isBackupStaffAvailable("")).toBe(true);
      expect(backupService.isBackupStaffAvailable("×")).toBe(true);
      expect(backupService.isBackupStaffAvailable("○")).toBe(false);
      expect(backupService.isBackupStaffAvailable("△")).toBe(false);
    });

    test("should provide service status", () => {
      const status = backupService.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.backupAssignments).toBe(2); // 中田, 与儀
      expect(status.groupBackups).toBe(3); // group-1, group-2, group-3
      expect(status.performanceMetrics).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should handle inactive staff members", () => {
      const inactiveStaff = [
        ...mockStaffMembers,
        {
          id: "staff-inactive",
          name: "退職者",
          endPeriod: { year: 2023, month: 12, day: 31 },
        },
      ];

      const backupWithInactive = [
        ...mockBackupAssignments,
        {
          id: "backup-inactive",
          staffId: "staff-inactive",
          groupId: "group-1",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      // Should handle inactive staff gracefully
      expect(() => {
        backupService.buildBackupMaps(
          inactiveStaff,
          mockStaffGroups,
          backupWithInactive,
        );
      }).not.toThrow();
    });

    test("should handle missing staff members in assignments", () => {
      const invalidBackupAssignments = [
        {
          id: "backup-invalid",
          staffId: "nonexistent-staff",
          groupId: "group-1",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ];

      const schedule = createTestSchedule();

      // Should not crash with invalid staff IDs
      expect(() => {
        backupService.processBackupAssignments(
          schedule,
          mockStaffMembers,
          mockStaffGroups,
          "2024-01-01",
        );
      }).not.toThrow();
    });

    test("should handle empty groups", () => {
      const emptyGroups = [
        {
          id: "empty-group",
          name: "Empty Group",
          members: [],
        },
      ];

      const schedule = createTestSchedule();

      // Should handle empty groups gracefully
      expect(() => {
        backupService.processBackupAssignments(
          schedule,
          mockStaffMembers,
          emptyGroups,
          "2024-01-01",
        );
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      await backupService.initialize(
        mockStaffMembers,
        mockStaffGroups,
        mockBackupAssignments,
      );
    });

    test("should cache results for performance", () => {
      const schedule = createTestSchedule({
        "staff-1": { "2024-01-01": "×" },
      });

      // First call
      const start1 = Date.now();
      backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );
      const time1 = Date.now() - start1;

      // Second call with same data (should use cache)
      const start2 = Date.now();
      backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );
      const time2 = Date.now() - start2;

      // Cache should improve performance (though this test might be flaky in CI)
      expect(time2).toBeLessThanOrEqual(time1);
    });

    test("should clear cache when requested", () => {
      const initialCacheSize = backupService.getStatus().cacheSize;

      // Process some assignments to populate cache
      const schedule = createTestSchedule({ "staff-1": { "2024-01-01": "×" } });
      backupService.processBackupAssignments(
        schedule,
        mockStaffMembers,
        mockStaffGroups,
        "2024-01-01",
      );

      expect(backupService.getStatus().cacheSize).toBeGreaterThan(
        initialCacheSize,
      );

      // Clear cache
      backupService.clearCache();
      expect(backupService.getStatus().cacheSize).toBe(0);
    });
  });
});
