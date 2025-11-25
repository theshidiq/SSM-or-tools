/**
 * useBackupStaffService Hook
 *
 * React hook for managing backup staff assignments with database integration.
 * Provides methods to load, save, and manage backup staff assignments
 * with automatic synchronization to Supabase and localStorage fallback.
 */

import { useState, useEffect, useCallback } from "react";
import { configService } from "../services/ConfigurationService";

export const useBackupStaffService = () => {
  const [backupAssignments, setBackupAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // 'idle', 'syncing', 'success', 'error'

  // Load backup assignments
  const loadBackupAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus("syncing");

      const assignments = configService.getBackupAssignments();
      setBackupAssignments(assignments);
      setSyncStatus("success");

      console.log(`📋 Loaded ${assignments.length} backup assignments`);
    } catch (err) {
      console.error("❌ Failed to load backup assignments:", err);
      setError(err.message);
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Save backup assignments
  const saveBackupAssignments = useCallback(async (assignments) => {
    try {
      setError(null);
      setSyncStatus("syncing");

      const success = await configService.updateBackupAssignments(assignments);

      if (success) {
        setBackupAssignments(assignments);
        setSyncStatus("success");
        console.log(`💾 Saved ${assignments.length} backup assignments`);
        return true;
      } else {
        throw new Error("Failed to save backup assignments");
      }
    } catch (err) {
      console.error("❌ Failed to save backup assignments:", err);
      setError(err.message);
      setSyncStatus("error");
      return false;
    }
  }, []);

  // Add a new backup assignment
  const addBackupAssignment = useCallback(
    async (staffId, groupId, options = {}) => {
      try {
        // Check if assignment already exists
        const existingAssignment = backupAssignments.find(
          (a) => a.staffId === staffId && a.groupId === groupId,
        );

        if (existingAssignment) {
          throw new Error("Backup assignment already exists");
        }

        const newAssignment = {
          id: options.id || crypto.randomUUID(), // ✅ FIX: Generate proper UUID for database compatibility
          staffId,
          groupId,
          assignmentType: options.assignmentType || "regular",
          priorityOrder: options.priorityOrder || 1,
          effectiveFrom: options.effectiveFrom || null,
          effectiveUntil: options.effectiveUntil || null,
          notes: options.notes || "",
          createdAt: new Date().toISOString(),
        };

        const updatedAssignments = [...backupAssignments, newAssignment];
        const success = await saveBackupAssignments(updatedAssignments);

        if (success) {
          console.log(`➕ Added backup assignment: ${staffId} -> ${groupId}`);
        }

        return success;
      } catch (err) {
        console.error("❌ Failed to add backup assignment:", err);
        setError(err.message);
        return false;
      }
    },
    [backupAssignments, saveBackupAssignments],
  );

  // Remove a backup assignment
  const removeBackupAssignment = useCallback(
    async (assignmentId) => {
      try {
        const updatedAssignments = backupAssignments.filter(
          (a) => a.id !== assignmentId,
        );
        const success = await saveBackupAssignments(updatedAssignments);

        if (success) {
          console.log(`➖ Removed backup assignment: ${assignmentId}`);
        }

        return success;
      } catch (err) {
        console.error("❌ Failed to remove backup assignment:", err);
        setError(err.message);
        return false;
      }
    },
    [backupAssignments, saveBackupAssignments],
  );

  // Update a backup assignment
  const updateBackupAssignment = useCallback(
    async (assignmentId, updates) => {
      try {
        const updatedAssignments = backupAssignments.map((assignment) => {
          if (assignment.id === assignmentId) {
            return {
              ...assignment,
              ...updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return assignment;
        });

        const success = await saveBackupAssignments(updatedAssignments);

        if (success) {
          console.log(`📝 Updated backup assignment: ${assignmentId}`);
        }

        return success;
      } catch (err) {
        console.error("❌ Failed to update backup assignment:", err);
        setError(err.message);
        return false;
      }
    },
    [backupAssignments, saveBackupAssignments],
  );

  // Get assignments for a specific staff member
  const getStaffBackupAssignments = useCallback(
    (staffId) => {
      return backupAssignments.filter((a) => a.staffId === staffId);
    },
    [backupAssignments],
  );

  // Get assignments for a specific group
  const getGroupBackupAssignments = useCallback(
    (groupId) => {
      return backupAssignments.filter((a) => a.groupId === groupId);
    },
    [backupAssignments],
  );

  // Check if staff can backup a specific group
  const canStaffBackupGroup = useCallback((staffId, groupId, staffGroups) => {
    // Staff cannot backup a group they are already a member of
    const group = staffGroups.find((g) => g.id === groupId);
    if (group && group.members.includes(staffId)) {
      return false;
    }
    return true;
  }, []);

  // Get available staff for backup assignments
  const getAvailableBackupStaff = useCallback(
    (groupId, staffMembers, staffGroups) => {
      const group = staffGroups.find((g) => g.id === groupId);
      if (!group) return [];

      return staffMembers.filter((staff) => {
        // Must be active
        if (!staff.isActive && staff.isActive !== undefined) return false;

        // Must not be a current member of the group
        if (
          group.members.includes(staff.id) ||
          group.members.includes(staff.name)
        )
          return false;

        // Check if not already assigned as backup
        const isAlreadyAssigned = backupAssignments.some(
          (a) =>
            a.groupId === groupId &&
            (a.staffId === staff.id || a.staffId === staff.name),
        );

        return !isAlreadyAssigned;
      });
    },
    [backupAssignments],
  );

  // Force refresh from configuration service
  const refreshBackupAssignments = useCallback(async () => {
    await loadBackupAssignments();
  }, [loadBackupAssignments]);

  // Get sync status information
  const getSyncStatus = useCallback(() => {
    const configSyncStatus = configService.getSyncStatus();
    return {
      ...configSyncStatus,
      hookSyncStatus: syncStatus,
      lastError: error,
    };
  }, [syncStatus, error]);

  // Load assignments on mount
  useEffect(() => {
    loadBackupAssignments();
  }, [loadBackupAssignments]);

  return {
    // State
    backupAssignments,
    loading,
    error,
    syncStatus,

    // Methods
    loadBackupAssignments,
    saveBackupAssignments,
    addBackupAssignment,
    removeBackupAssignment,
    updateBackupAssignment,
    refreshBackupAssignments,

    // Query helpers
    getStaffBackupAssignments,
    getGroupBackupAssignments,
    canStaffBackupGroup,
    getAvailableBackupStaff,

    // Status
    getSyncStatus,
  };
};

export default useBackupStaffService;
