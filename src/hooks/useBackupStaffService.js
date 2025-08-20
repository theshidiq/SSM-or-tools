/**
 * useBackupStaffService.js
 *
 * React hook for managing backup staff assignments and automatic coverage.
 * Integrates with the settings system and schedule management.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import BackupStaffService from "../services/BackupStaffService";
import { useSettingsData } from "./useSettingsData";

export const useBackupStaffService = (staffMembers = [], onScheduleUpdate) => {
  const [backupService] = useState(() => new BackupStaffService());
  const [isInitialized, setIsInitialized] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Get settings data including staff groups and backup assignments
  const { settings, isLoading: settingsLoading } = useSettingsData();

  // Refs for avoiding stale closures
  const staffMembersRef = useRef(staffMembers);
  const settingsRef = useRef(settings);

  // Update refs when props change
  useEffect(() => {
    staffMembersRef.current = staffMembers;
  }, [staffMembers]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /**
   * Initialize backup staff service
   */
  const initializeService = useCallback(async () => {
    if (settingsLoading || !settings) return;

    try {
      const staffGroups = settings.staffGroups || [];
      const backupAssignments = settings.backupAssignments || [];

      const initialized = await backupService.initialize(
        staffMembersRef.current,
        staffGroups,
        backupAssignments,
      );

      setIsInitialized(initialized);

      if (initialized) {
        console.log("✅ Backup Staff Service initialized via hook");
      }
    } catch (error) {
      console.error("❌ Failed to initialize backup service:", error);
      setIsInitialized(false);
    }
  }, [backupService, settings, settingsLoading]);

  // Initialize service when settings are loaded
  useEffect(() => {
    initializeService();
  }, [initializeService]);

  /**
   * Process backup assignments for a schedule
   */
  const processBackupAssignments = useCallback(
    async (schedule, dateRange) => {
      if (!isInitialized) {
        console.warn("⚠️ Backup service not initialized");
        return schedule;
      }

      setProcessing(true);

      try {
        const updatedSchedule = backupService.processFullScheduleBackups(
          schedule,
          staffMembersRef.current,
          settingsRef.current.staffGroups || [],
          dateRange,
        );

        if (onScheduleUpdate && typeof onScheduleUpdate === "function") {
          onScheduleUpdate(updatedSchedule);
        }

        return updatedSchedule;
      } catch (error) {
        console.error("❌ Failed to process backup assignments:", error);
        return schedule;
      } finally {
        setProcessing(false);
      }
    },
    [isInitialized, backupService, onScheduleUpdate],
  );

  /**
   * Validate backup assignments in a schedule
   */
  const validateBackupAssignments = useCallback(
    async (schedule, dateRange) => {
      if (!isInitialized) {
        return { valid: true, violations: [], coverage: {}, statistics: {} };
      }

      try {
        const result = backupService.validateBackupAssignments(
          schedule,
          staffMembersRef.current,
          settingsRef.current.staffGroups || [],
          dateRange,
        );

        setValidationResult(result);
        return result;
      } catch (error) {
        console.error("❌ Failed to validate backup assignments:", error);
        return { valid: false, error: error.message, violations: [] };
      }
    },
    [isInitialized, backupService],
  );

  /**
   * Get backup status for a specific date
   */
  const getBackupStatusForDate = useCallback(
    (schedule, dateKey) => {
      if (!isInitialized) return null;

      try {
        const status = backupService.getBackupStatus(
          schedule,
          staffMembersRef.current,
          settingsRef.current.staffGroups || [],
          dateKey,
        );

        return status;
      } catch (error) {
        console.error("❌ Failed to get backup status:", error);
        return null;
      }
    },
    [isInitialized, backupService],
  );

  /**
   * Get backup assignments for a staff member
   */
  const getStaffBackupAssignments = useCallback(
    (staffId) => {
      if (!isInitialized) return [];

      return backupService.getStaffBackupAssignments(staffId);
    },
    [isInitialized, backupService],
  );

  /**
   * Get backup staff for a group
   */
  const getGroupBackupStaff = useCallback(
    (groupId) => {
      if (!isInitialized) return [];

      return backupService.getGroupBackupStaff(groupId);
    },
    [isInitialized, backupService],
  );

  /**
   * Check if staff member is a backup
   */
  const isBackupStaff = useCallback(
    (staffId) => {
      if (!isInitialized) return false;

      return backupService.isBackupStaff(staffId);
    },
    [isInitialized, backupService],
  );

  /**
   * Get service performance metrics
   */
  const getServiceStatus = useCallback(() => {
    return backupService.getStatus();
  }, [backupService]);

  /**
   * Process automatic backup assignments for schedule changes
   */
  const processAutomaticBackups = useCallback(
    async (schedule, dateKey, changedStaffId) => {
      if (!isInitialized) return schedule;

      // Only process if the change might affect backup requirements
      const changedAssignment = schedule[changedStaffId]?.[dateKey];

      try {
        // Process backups for the specific date
        const updatedSchedule = backupService.processBackupAssignments(
          schedule,
          staffMembersRef.current,
          settingsRef.current.staffGroups || [],
          dateKey,
        );

        return updatedSchedule;
      } catch (error) {
        console.error("❌ Failed to process automatic backups:", error);
        return schedule;
      }
    },
    [isInitialized, backupService],
  );

  /**
   * Clear service cache (useful for settings changes)
   */
  const clearServiceCache = useCallback(() => {
    if (isInitialized) {
      backupService.clearCache();
    }
  }, [isInitialized, backupService]);

  /**
   * Reinitialize service (useful when settings change)
   */
  const reinitializeService = useCallback(async () => {
    if (isInitialized) {
      await initializeService();
      clearServiceCache();
    }
  }, [isInitialized, initializeService, clearServiceCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        backupService.cleanup();
      }
    };
  }, [isInitialized, backupService]);

  return {
    // Service state
    isInitialized,
    processing,
    backupStatus,
    validationResult,

    // Service methods
    processBackupAssignments,
    validateBackupAssignments,
    getBackupStatusForDate,
    getStaffBackupAssignments,
    getGroupBackupStaff,
    isBackupStaff,
    getServiceStatus,

    // Automatic processing
    processAutomaticBackups,

    // Service management
    clearServiceCache,
    reinitializeService,

    // Service instance (for advanced usage)
    backupService: isInitialized ? backupService : null,
  };
};
