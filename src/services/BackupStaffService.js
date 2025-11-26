/**
 * BackupStaffService.js
 *
 * Service for managing backup staff assignments and automatic shift coverage.
 * Implements business logic for backup staff assignments when group members have day offs.
 *
 * Key Features:
 * - Automatic backup staff detection for day-off scenarios
 * - Group coverage validation and enforcement
 * - Integration with constraint engine and schedule generation
 * - Performance-optimized backup assignment calculations
 * - Real-time backup status monitoring
 */

import {
  isOffDay,
  isNormalShift,
  isWorkingShift,
} from "../ai/constraints/ConstraintEngine";
import { configService } from "./ConfigurationService";

export class BackupStaffService {
  constructor() {
    this.initialized = false;
    this.backupAssignments = new Map(); // staffId -> [groupIds]
    this.groupBackups = new Map(); // groupId -> [staffIds]
    this.assignmentCache = new Map();
    this.performanceMetrics = {
      assignmentsProcessed: 0,
      backupsTriggered: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
    };

    // Cache configuration
    this.cacheConfig = {
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Initialize the backup staff service with current configuration
   * @param {Array} staffMembers - All staff members
   * @param {Array} staffGroups - Staff groups configuration
   * @param {Array} backupAssignments - Current backup assignments
   */
  async initialize(
    staffMembers = [],
    staffGroups = [],
    backupAssignments = [],
  ) {
    console.log("🔧 Initializing Backup Staff Service...");

    try {
      const startTime = Date.now();

      // Clear existing data
      this.backupAssignments.clear();
      this.groupBackups.clear();
      this.clearCache();

      // Build backup assignment maps
      this.buildBackupMaps(staffMembers, staffGroups, backupAssignments);

      // Validate backup assignments
      this.validateBackupConfiguration(
        staffMembers,
        staffGroups,
        backupAssignments,
      );

      this.initialized = true;
      const initTime = Date.now() - startTime;

      console.log(`✅ Backup Staff Service initialized in ${initTime}ms`);
      console.log(
        `📊 Loaded ${backupAssignments.length} backup assignments for ${staffGroups.length} groups`,
      );

      return true;
    } catch (error) {
      console.error("❌ Backup Staff Service initialization failed:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Build internal maps for efficient backup lookup
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {Array} backupAssignments - Backup assignments
   */
  buildBackupMaps(staffMembers, staffGroups, backupAssignments) {
    // Build backup assignments map (staff -> groups they backup)
    backupAssignments.forEach((assignment) => {
      const { staffId, groupId } = assignment;

      if (!this.backupAssignments.has(staffId)) {
        this.backupAssignments.set(staffId, []);
      }
      this.backupAssignments.get(staffId).push(groupId);

      // Build reverse map (group -> backup staff)
      if (!this.groupBackups.has(groupId)) {
        this.groupBackups.set(groupId, []);
      }
      this.groupBackups.get(groupId).push(staffId);
    });

    console.log(
      `📋 Built backup maps: ${this.backupAssignments.size} staff backing up ${this.groupBackups.size} groups`,
    );
  }

  /**
   * Validate backup configuration for potential issues
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {Array} backupAssignments - Backup assignments
   */
  validateBackupConfiguration(staffMembers, staffGroups, backupAssignments) {
    const issues = [];

    // Check for groups without backup staff
    const groupsWithoutBackups = staffGroups.filter(
      (group) =>
        !this.groupBackups.has(group.id) ||
        this.groupBackups.get(group.id).length === 0,
    );

    if (groupsWithoutBackups.length > 0) {
      issues.push(
        `Groups without backup staff: ${groupsWithoutBackups.map((g) => g.name).join(", ")}`,
      );
    }

    // Check for backup staff assigned to groups they're already in
    backupAssignments.forEach((assignment) => {
      const group = staffGroups.find((g) => g.id === assignment.groupId);
      if (group && group.members.includes(assignment.staffId)) {
        issues.push(
          `Staff ${assignment.staffId} is backup for group they're already in: ${group.name}`,
        );
      }
    });

    // Check for inactive backup staff
    const inactiveBackups = backupAssignments.filter((assignment) => {
      const staff = staffMembers.find((s) => s.id === assignment.staffId);

      // ✅ DIAGNOSTIC: Log detailed information about each backup assignment
      console.log("🔍 [DIAGNOSTIC] Checking backup assignment:", {
        assignmentId: assignment.id,
        staffId: assignment.staffId,
        staffFound: !!staff,
        staffName: staff?.name || "NOT FOUND",
        hasEndPeriod: staff?.endPeriod ? true : false,
        endPeriod: staff?.endPeriod,
        isInactive: staff ? this.isStaffInactive(staff) : "N/A (staff not found)"
      });

      if (!staff) {
        console.warn(`⚠️ [DIAGNOSTIC] Backup assignment ${assignment.id} references staff ID ${assignment.staffId} which was NOT FOUND in staffMembers array`);
        return true; // Flag as inactive because staff not found
      }

      const inactive = this.isStaffInactive(staff);
      if (inactive) {
        console.warn(`⚠️ [DIAGNOSTIC] Staff ${staff.name} (${staff.id}) is flagged as INACTIVE due to endPeriod:`, staff.endPeriod);
      }

      return inactive;
    });

    if (inactiveBackups.length > 0) {
      issues.push(
        `Inactive backup staff assignments: ${inactiveBackups.length}`,
      );
      console.warn(`⚠️ [DIAGNOSTIC] ${inactiveBackups.length} inactive backup assignment(s) detected:`,
        inactiveBackups.map(a => ({ id: a.id, staffId: a.staffId }))
      );
    }

    if (issues.length > 0) {
      console.warn("⚠️ Backup configuration issues found:", issues);
    } else {
      console.log("✅ Backup configuration validation passed");
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Process backup assignments for a specific date
   * @param {Object} schedule - Current schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @returns {Object} Updated schedule with backup assignments
   */
  processBackupAssignments(schedule, staffMembers, staffGroups, dateKey) {
    if (!this.initialized) {
      console.warn("⚠️ Backup Staff Service not initialized");
      return schedule;
    }

    const startTime = Date.now();
    const cacheKey = `${dateKey}_${JSON.stringify(schedule)}`;

    // Check cache first
    if (this.assignmentCache.has(cacheKey)) {
      this.performanceMetrics.cacheHitRate++;
      return this.assignmentCache.get(cacheKey);
    }

    let updatedSchedule = JSON.parse(JSON.stringify(schedule));
    let assignmentsTriggered = 0;

    // Process each staff group
    staffGroups.forEach((group) => {
      const backupResult = this.processGroupBackups(
        updatedSchedule,
        staffMembers,
        group,
        dateKey,
      );

      if (backupResult.assignmentsApplied > 0) {
        updatedSchedule = backupResult.schedule;
        assignmentsTriggered += backupResult.assignmentsApplied;
      }
    });

    // Cache the result
    this.cacheResult(cacheKey, updatedSchedule);

    // Update performance metrics
    this.updatePerformanceMetrics(startTime, assignmentsTriggered);

    return updatedSchedule;
  }

  /**
   * Process backup assignments for a specific group on a specific date
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Object} group - Staff group
   * @param {string} dateKey - Date key
   * @returns {Object} Result with updated schedule and assignment count
   */
  processGroupBackups(schedule, staffMembers, group, dateKey) {
    const updatedSchedule = JSON.parse(JSON.stringify(schedule));
    let assignmentsApplied = 0;

    // Find group members who have day off
    const membersOff = this.findGroupMembersWithDayOff(
      updatedSchedule,
      staffMembers,
      group,
      dateKey,
    );

    console.log(`🔍 [BackupStaffService] Group "${group.name}" on ${dateKey}:`, {
      membersOffCount: membersOff.length,
      membersOffNames: membersOff.map(m => m.name).join(", ") || "none"
    });

    if (membersOff.length === 0) {
      return { schedule: updatedSchedule, assignmentsApplied: 0 };
    }

    // Get backup staff for this group
    const backupStaffIds = this.groupBackups.get(group.id) || [];
    console.log(`🔍 [BackupStaffService] Backup staff for "${group.name}":`, {
      backupStaffCount: backupStaffIds.length,
      backupStaffIds: backupStaffIds
    });

    // Process each backup staff member
    backupStaffIds.forEach((backupStaffId) => {
      const backupStaff = staffMembers.find((s) => s.id === backupStaffId);

      if (!backupStaff) {
        console.warn(`⚠️ [BackupStaffService] Backup staff ID ${backupStaffId} not found in staffMembers`);
        return;
      }

      if (this.isStaffInactive(backupStaff)) {
        console.log(`⏭️ [BackupStaffService] Skipping inactive backup staff: ${backupStaff.name}`);
        return; // Skip inactive backup staff
      }

      // Check if backup staff is available (not already assigned to work)
      const currentAssignment = updatedSchedule[backupStaffId]?.[dateKey];
      const isAvailable = this.isBackupStaffAvailable(currentAssignment);

      console.log(`🔍 [BackupStaffService] Backup staff ${backupStaff.name}:`, {
        currentAssignment: currentAssignment || "blank",
        isAvailable,
        willAssign: isAvailable
      });

      if (isAvailable) {
        // Assign backup staff to normal shift
        if (!updatedSchedule[backupStaffId]) {
          updatedSchedule[backupStaffId] = {};
        }

        updatedSchedule[backupStaffId][dateKey] = "○"; // Normal shift symbol
        assignmentsApplied++;

        console.log(
          `✅ [BackupStaffService] Backup assignment applied: ${backupStaff.name} → ○ covering for ${group.name} on ${dateKey}`,
        );
      }
    });

    return { schedule: updatedSchedule, assignmentsApplied };
  }

  /**
   * Find group members who have day off on specific date
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Object} group - Staff group
   * @param {string} dateKey - Date key
   * @returns {Array} Staff members with day off
   */
  findGroupMembersWithDayOff(schedule, staffMembers, group, dateKey) {
    const membersOff = [];

    group.members.forEach((memberId) => {
      const staff = staffMembers.find((s) => s.id === memberId);
      if (!staff || this.isStaffInactive(staff)) return;

      const assignment = schedule[memberId]?.[dateKey];
      if (assignment !== undefined && isOffDay(assignment)) {
        membersOff.push({
          staffId: memberId,
          staffName: staff.name,
          assignment,
        });
      }
    });

    return membersOff;
  }

  /**
   * Check if backup staff is available for assignment
   * @param {string} currentAssignment - Current shift assignment
   * @returns {boolean} True if available
   */
  isBackupStaffAvailable(currentAssignment) {
    // Available if:
    // 1. No current assignment (undefined or null)
    // 2. Currently has day off
    // 3. Currently unassigned (empty string)
    return (
      currentAssignment === undefined ||
      currentAssignment === null ||
      currentAssignment === "" ||
      isOffDay(currentAssignment)
    );
  }

  /**
   * Check if staff member is inactive
   * @param {Object} staff - Staff member
   * @returns {boolean} True if inactive
   */
  isStaffInactive(staff) {
    if (!staff.endPeriod) {
      console.log(`🔍 [isStaffInactive] ${staff.name}: No endPeriod → ACTIVE`);
      return false;
    }

    const endDate = new Date(
      Date.UTC(
        staff.endPeriod.year,
        staff.endPeriod.month - 1,
        staff.endPeriod.day || 31,
      ),
    );

    const now = new Date();
    const isInactive = endDate < now;

    console.log(`🔍 [isStaffInactive] ${staff.name}:`, {
      endPeriod: staff.endPeriod,
      endDate: endDate.toISOString(),
      currentDate: now.toISOString(),
      comparison: `${endDate.toISOString()} < ${now.toISOString()}`,
      result: isInactive ? "INACTIVE ❌" : "ACTIVE ✅"
    });

    return isInactive;
  }

  /**
   * Process backup assignments for entire schedule period
   * @param {Object} schedule - Complete schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {Array} dateRange - Date range to process
   * @returns {Object} Updated schedule with all backup assignments
   */
  processFullScheduleBackups(schedule, staffMembers, staffGroups, dateRange) {
    console.log("🔍 [BackupStaffService] processFullScheduleBackups called", {
      initialized: this.initialized,
      staffMembersCount: staffMembers?.length,
      staffGroupsCount: staffGroups?.length,
      dateRangeLength: dateRange?.length,
      scheduleKeys: Object.keys(schedule || {}).length
    });

    if (!this.initialized) {
      console.warn("⚠️ [BackupStaffService] Service NOT initialized, returning original schedule");
      return schedule;
    }

    console.log("🔄 [BackupStaffService] Processing backup assignments for full schedule...");
    const startTime = Date.now();

    let updatedSchedule = JSON.parse(JSON.stringify(schedule));
    let totalAssignments = 0;

    // Process each date
    dateRange.forEach((date, index) => {
      const dateKey = date.toISOString().split("T")[0];
      console.log(`🔍 [BackupStaffService] Processing date ${index + 1}/${dateRange.length}: ${dateKey}`);

      const dateResult = this.processBackupAssignments(
        updatedSchedule,
        staffMembers,
        staffGroups,
        dateKey,
      );

      updatedSchedule = dateResult;
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ [BackupStaffService] Full schedule backup processing completed in ${processingTime}ms (${totalAssignments} assignments applied)`,
    );

    return updatedSchedule;
  }

  /**
   * Validate backup assignments in a schedule
   * @param {Object} schedule - Schedule to validate
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {Array} dateRange - Date range
   * @returns {Object} Validation result
   */
  validateBackupAssignments(schedule, staffMembers, staffGroups, dateRange) {
    const violations = [];
    const backupCoverage = new Map(); // groupId -> coverage stats

    // Initialize coverage tracking
    staffGroups.forEach((group) => {
      backupCoverage.set(group.id, {
        groupName: group.name,
        totalDaysNeeded: 0,
        daysCovered: 0,
        daysUncovered: 0,
        uncoveredDates: [],
      });
    });

    // Check each date
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      staffGroups.forEach((group) => {
        const membersOff = this.findGroupMembersWithDayOff(
          schedule,
          staffMembers,
          group,
          dateKey,
        );

        if (membersOff.length > 0) {
          const coverage = backupCoverage.get(group.id);
          coverage.totalDaysNeeded++;

          // Check if backup staff are working
          const backupStaffIds = this.groupBackups.get(group.id) || [];
          const backupsWorking = backupStaffIds.filter((staffId) => {
            const assignment = schedule[staffId]?.[dateKey];
            return assignment !== undefined && isWorkingShift(assignment);
          });

          if (backupsWorking.length > 0) {
            coverage.daysCovered++;
          } else {
            coverage.daysUncovered++;
            coverage.uncoveredDates.push(dateKey);

            violations.push({
              type: "backup_coverage_missing",
              date: dateKey,
              group: group.name,
              groupId: group.id,
              message: `No backup coverage for ${group.name} on ${dateKey} when ${membersOff.length} members are off`,
              severity: "high",
              details: {
                membersOff: membersOff.map((m) => m.staffName),
                availableBackups: backupStaffIds.length,
                workingBackups: backupsWorking.length,
              },
            });
          }
        }
      });
    });

    // Calculate overall coverage statistics
    const overallStats = {
      totalGroups: staffGroups.length,
      groupsWithBackups: this.groupBackups.size,
      groupsWithoutBackups: staffGroups.length - this.groupBackups.size,
      averageCoverageRate: 0,
    };

    let totalCoverageRate = 0;
    let groupsWithNeeds = 0;

    backupCoverage.forEach((coverage) => {
      if (coverage.totalDaysNeeded > 0) {
        const rate = coverage.daysCovered / coverage.totalDaysNeeded;
        totalCoverageRate += rate;
        groupsWithNeeds++;
      }
    });

    if (groupsWithNeeds > 0) {
      overallStats.averageCoverageRate = totalCoverageRate / groupsWithNeeds;
    }

    return {
      valid: violations.length === 0,
      violations,
      coverage: Object.fromEntries(backupCoverage),
      statistics: overallStats,
    };
  }

  /**
   * Get backup assignments for a specific staff member
   * @param {string} staffId - Staff member ID
   * @returns {Array} Group IDs that this staff backs up
   */
  getStaffBackupAssignments(staffId) {
    return this.backupAssignments.get(staffId) || [];
  }

  /**
   * Get backup staff for a specific group
   * @param {string} groupId - Group ID
   * @returns {Array} Staff IDs that backup this group
   */
  getGroupBackupStaff(groupId) {
    return this.groupBackups.get(groupId) || [];
  }

  /**
   * Check if a staff member is a backup for any group
   * @param {string} staffId - Staff member ID
   * @returns {boolean} True if staff is a backup
   */
  isBackupStaff(staffId) {
    return this.backupAssignments.has(staffId);
  }

  /**
   * Get backup status for a specific date
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} staffGroups - Staff groups
   * @param {string} dateKey - Date key
   * @returns {Object} Backup status information
   */
  getBackupStatus(schedule, staffMembers, staffGroups, dateKey) {
    const status = {
      date: dateKey,
      groupsNeedingBackup: [],
      backupsAssigned: [],
      backupsAvailable: [],
      potentialIssues: [],
    };

    staffGroups.forEach((group) => {
      const membersOff = this.findGroupMembersWithDayOff(
        schedule,
        staffMembers,
        group,
        dateKey,
      );

      if (membersOff.length > 0) {
        const groupStatus = {
          groupId: group.id,
          groupName: group.name,
          membersOff: membersOff.map((m) => m.staffName),
          backupStaff: [],
        };

        const backupStaffIds = this.groupBackups.get(group.id) || [];
        backupStaffIds.forEach((staffId) => {
          const staff = staffMembers.find((s) => s.id === staffId);
          if (staff && !this.isStaffInactive(staff)) {
            const assignment = schedule[staffId]?.[dateKey];
            const isWorking =
              assignment !== undefined && isWorkingShift(assignment);
            const isAvailable = this.isBackupStaffAvailable(assignment);

            groupStatus.backupStaff.push({
              staffId,
              staffName: staff.name,
              currentAssignment: assignment,
              isWorking,
              isAvailable,
            });

            if (isWorking) {
              status.backupsAssigned.push({
                staffId,
                staffName: staff.name,
                groupId: group.id,
                groupName: group.name,
              });
            } else if (isAvailable) {
              status.backupsAvailable.push({
                staffId,
                staffName: staff.name,
                groupId: group.id,
                groupName: group.name,
              });
            }
          }
        });

        status.groupsNeedingBackup.push(groupStatus);

        // Check for potential issues
        const workingBackups = groupStatus.backupStaff.filter(
          (b) => b.isWorking,
        ).length;
        if (workingBackups === 0) {
          status.potentialIssues.push({
            type: "no_backup_coverage",
            groupId: group.id,
            groupName: group.name,
            message: `No backup staff working for ${group.name} when ${membersOff.length} members are off`,
          });
        }
      }
    });

    return status;
  }

  /**
   * Cache result for performance optimization
   * @param {string} key - Cache key
   * @param {Object} result - Result to cache
   */
  cacheResult(key, result) {
    // Implement LRU-style cache with size limit
    if (this.assignmentCache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.assignmentCache.keys().next().value;
      this.assignmentCache.delete(firstKey);
    }

    this.assignmentCache.set(key, {
      data: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.assignmentCache.entries()) {
      if (now - value.timestamp > this.cacheConfig.ttl) {
        this.assignmentCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.assignmentCache.clear();
  }

  /**
   * Update performance metrics
   * @param {number} startTime - Operation start time
   * @param {number} assignments - Number of assignments processed
   */
  updatePerformanceMetrics(startTime, assignments) {
    const processingTime = Date.now() - startTime;

    this.performanceMetrics.assignmentsProcessed++;
    this.performanceMetrics.backupsTriggered += assignments;
    this.performanceMetrics.averageProcessingTime =
      (this.performanceMetrics.averageProcessingTime + processingTime) / 2;
  }

  /**
   * Get service status and performance metrics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      backupAssignments: this.backupAssignments.size,
      groupBackups: this.groupBackups.size,
      cacheSize: this.assignmentCache.size,
      performanceMetrics: { ...this.performanceMetrics },
    };
  }

  /**
   * Load backup assignments from ConfigurationService
   * @returns {Array} Array of backup assignments
   */
  async loadBackupAssignments() {
    try {
      // First try to load from ConfigurationService (database or localStorage)
      console.log("🔍 [BackupStaffService] Loading backup assignments from ConfigurationService...");
      const assignments = configService.getBackupAssignments();
      console.log("🔍 [BackupStaffService] getBackupAssignments() returned:", {
        isArray: Array.isArray(assignments),
        length: assignments?.length || 0,
        assignments: assignments,
      });

      // If no assignments in ConfigurationService, check for localStorage migration
      if (!assignments || assignments.length === 0) {
        console.log(
          "🔄 No backup assignments found, checking for legacy data...",
        );
        return await this.migrateFromLocalStorage();
      }

      console.log(
        `📋 Loaded ${assignments.length} backup assignments from configuration`,
      );
      return assignments;
    } catch (error) {
      console.error("❌ Failed to load backup assignments:", error);
      return [];
    }
  }

  /**
   * Save backup assignments using ConfigurationService
   * @param {Array} assignments - Backup assignments to save
   * @returns {Promise<boolean>} Success status
   */
  async saveBackupAssignments(assignments = []) {
    try {
      const success = await configService.updateBackupAssignments(assignments);
      if (success) {
        console.log(
          `💾 Saved ${assignments.length} backup assignments to configuration`,
        );
      }
      return success;
    } catch (error) {
      console.error("❌ Failed to save backup assignments:", error);
      return false;
    }
  }

  /**
   * Migrate legacy backup assignment data from localStorage
   * @returns {Array} Migrated backup assignments
   */
  async migrateFromLocalStorage() {
    try {
      const LEGACY_BACKUP_KEY = "backup-staff-assignments";
      const legacyData = localStorage.getItem(LEGACY_BACKUP_KEY);

      if (!legacyData) {
        console.log("📝 No legacy backup assignment data found");
        return [];
      }

      const parsedData = JSON.parse(legacyData);
      let migratedAssignments = [];

      // Handle different legacy data formats
      if (Array.isArray(parsedData)) {
        migratedAssignments = parsedData.map((assignment, index) => ({
          id: assignment.id || `migrated-backup-${index}-${Date.now()}`,
          staffId: assignment.staffId,
          groupId: assignment.groupId,
          assignmentType: assignment.assignmentType || "regular",
          priorityOrder: assignment.priorityOrder || 1,
          effectiveFrom: assignment.effectiveFrom || null,
          effectiveUntil: assignment.effectiveUntil || null,
          notes: assignment.notes || "",
          createdAt: assignment.createdAt || new Date().toISOString(),
        }));
      }

      if (migratedAssignments.length > 0) {
        console.log(
          `🔄 Migrating ${migratedAssignments.length} backup assignments from localStorage`,
        );

        // Save to ConfigurationService
        const saveSuccess =
          await this.saveBackupAssignments(migratedAssignments);

        if (saveSuccess) {
          // Remove legacy data after successful migration
          localStorage.removeItem(LEGACY_BACKUP_KEY);
          console.log(
            "✅ Legacy backup assignment data migrated and cleaned up",
          );
        } else {
          console.warn(
            "⚠️ Migration completed but save failed - keeping legacy data as backup",
          );
        }
      }

      return migratedAssignments;
    } catch (error) {
      console.error(
        "❌ Failed to migrate legacy backup assignment data:",
        error,
      );
      return [];
    }
  }

  /**
   * Initialize backup assignments from configuration with auto-loading
   * @param {Array} staffMembers - All staff members
   * @param {Array} staffGroups - Staff groups configuration
   * @param {Array} providedBackupAssignments - Optional backup assignments (if not provided, will auto-load)
   */
  async initializeWithConfiguration(
    staffMembers = [],
    staffGroups = [],
    providedBackupAssignments = null,
  ) {
    console.log("🔧 Initializing Backup Staff Service with configuration...");

    try {
      const startTime = Date.now();

      // ✅ FIX: Properly check for empty arrays, not just null
      // An empty array [] is NOT null, so we need explicit length check
      const backupAssignments =
        Array.isArray(providedBackupAssignments) && providedBackupAssignments.length > 0
          ? providedBackupAssignments
          : await this.loadBackupAssignments();

      console.log("🔍 [BackupStaffService] Backup assignments resolution:", {
        providedLength: providedBackupAssignments?.length || 0,
        willLoadFromConfig: !Array.isArray(providedBackupAssignments) || providedBackupAssignments.length === 0,
        finalLength: backupAssignments.length,
      });

      // ✅ FIX: Load ALL staff members from database if backup assignments reference missing staff
      // This ensures backup staff are included even if they're not in the provided staffMembers array
      let effectiveStaffMembers = staffMembers;

      if (backupAssignments.length > 0) {
        const providedStaffIds = new Set(staffMembers.map(s => s.id));
        const missingStaffIds = backupAssignments
          .map(assignment => assignment.staffId)
          .filter(staffId => !providedStaffIds.has(staffId));

        if (missingStaffIds.length > 0) {
          console.warn(`⚠️ [BackupStaffService] ${missingStaffIds.length} backup staff not in provided staffMembers array`);
          console.log(`🔄 [BackupStaffService] Loading ALL staff from Supabase to include backup staff...`);

          try {
            // Load all staff directly from Supabase
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.REACT_APP_SUPABASE_URL,
              process.env.REACT_APP_SUPABASE_ANON_KEY
            );

            const { data: allStaff, error } = await supabase
              .from('staff')
              .select('*')
              .order('name');

            if (error) {
              console.error(`❌ [BackupStaffService] Supabase error loading staff:`, error);
            } else if (allStaff && allStaff.length > 0) {
              effectiveStaffMembers = allStaff;
              console.log(`✅ [BackupStaffService] Loaded ${allStaff.length} staff members from Supabase (including ${missingStaffIds.length} missing backup staff)`);
            } else {
              console.warn(`⚠️ [BackupStaffService] No staff found in database, using provided array`);
            }
          } catch (error) {
            console.error(`❌ [BackupStaffService] Error loading staff from Supabase:`, error);
          }
        }
      }

      // Use the existing initialize method with effective staff members
      const success = await this.initialize(
        effectiveStaffMembers,
        staffGroups,
        backupAssignments,
      );

      const initTime = Date.now() - startTime;
      if (success) {
        console.log(
          `✅ Backup Staff Service initialized with configuration in ${initTime}ms`,
        );
        console.log(
          `📊 Loaded ${backupAssignments.length} backup assignments with ${effectiveStaffMembers.length} staff members`,
        );
      }

      return success;
    } catch (error) {
      console.error(
        "❌ Backup Staff Service configuration initialization failed:",
        error,
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Add a new backup assignment
   * @param {string} staffId - Staff member ID
   * @param {string} groupId - Group ID
   * @param {Object} options - Assignment options
   * @returns {Promise<boolean>} Success status
   */
  async addBackupAssignment(staffId, groupId, options = {}) {
    try {
      const currentAssignments = await this.loadBackupAssignments();

      // Check if assignment already exists
      const existingAssignment = currentAssignments.find(
        (a) => a.staffId === staffId && a.groupId === groupId,
      );

      if (existingAssignment) {
        console.warn(
          `⚠️ Backup assignment already exists: ${staffId} -> ${groupId}`,
        );
        return false;
      }

      const newAssignment = {
        id:
          options.id ||
          `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        staffId,
        groupId,
        assignmentType: options.assignmentType || "regular",
        priorityOrder: options.priorityOrder || 1,
        effectiveFrom: options.effectiveFrom || null,
        effectiveUntil: options.effectiveUntil || null,
        notes: options.notes || "",
        createdAt: new Date().toISOString(),
      };

      const updatedAssignments = [...currentAssignments, newAssignment];
      const success = await this.saveBackupAssignments(updatedAssignments);

      if (success) {
        console.log(`➕ Added backup assignment: ${staffId} -> ${groupId}`);
        // Update internal maps
        if (!this.backupAssignments.has(staffId)) {
          this.backupAssignments.set(staffId, []);
        }
        this.backupAssignments.get(staffId).push(groupId);

        if (!this.groupBackups.has(groupId)) {
          this.groupBackups.set(groupId, []);
        }
        this.groupBackups.get(groupId).push(staffId);
      }

      return success;
    } catch (error) {
      console.error("❌ Failed to add backup assignment:", error);
      return false;
    }
  }

  /**
   * Remove a backup assignment
   * @param {string} staffId - Staff member ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  async removeBackupAssignment(staffId, groupId) {
    try {
      const currentAssignments = await this.loadBackupAssignments();
      const updatedAssignments = currentAssignments.filter(
        (a) => !(a.staffId === staffId && a.groupId === groupId),
      );

      if (updatedAssignments.length === currentAssignments.length) {
        console.warn(
          `⚠️ Backup assignment not found: ${staffId} -> ${groupId}`,
        );
        return false;
      }

      const success = await this.saveBackupAssignments(updatedAssignments);

      if (success) {
        console.log(`➖ Removed backup assignment: ${staffId} -> ${groupId}`);
        // Update internal maps
        const staffBackups = this.backupAssignments.get(staffId);
        if (staffBackups) {
          const index = staffBackups.indexOf(groupId);
          if (index !== -1) {
            staffBackups.splice(index, 1);
          }
        }

        const groupBackups = this.groupBackups.get(groupId);
        if (groupBackups) {
          const index = groupBackups.indexOf(staffId);
          if (index !== -1) {
            groupBackups.splice(index, 1);
          }
        }
      }

      return success;
    } catch (error) {
      console.error("❌ Failed to remove backup assignment:", error);
      return false;
    }
  }

  /**
   * Get all current backup assignments
   * @returns {Promise<Array>} Current backup assignments
   */
  async getCurrentBackupAssignments() {
    return await this.loadBackupAssignments();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.backupAssignments.clear();
    this.groupBackups.clear();
    this.clearCache();
    this.initialized = false;
    console.log("✅ Backup Staff Service cleaned up");
  }
}

export default BackupStaffService;
