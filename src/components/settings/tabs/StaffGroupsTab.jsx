import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Plus,
  Trash2,
  Users,
  Edit2,
  AlertTriangle,
  X,
  UserPlus,
  Check,
  XCircle,
  Shield,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import ConflictsModal from "../shared/ConflictsModal";
import { useBackupStaffService } from "../../../hooks/useBackupStaffService";
import { useScheduleValidation } from "../../../hooks/useScheduleValidation";
import { useSettings } from "../../../contexts/SettingsContext";

const PRESET_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
  "#E11D48",
  "#059669",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#65A30D",
  "#EA580C",
  "#4F46E5",
  "#BE123C",
  "#047857",
  "#B91C1C",
  "#6D28D9",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#C2410C",
  "#3730A3",
  "#9F1239",
  "#064E3B",
];

const StaffGroupsTab = ({
  staffMembers = [],
  validationErrors = {},
  currentScheduleId = null, // Phase 2: Schedule ID for validation
  onDeleteGroup, // Callback to handle delete confirmation via parent modal
  isDeleteModalOpen = false, // Track if delete modal is open to hide interfering elements
}) => {
  // Phase 3: Get settings from Context instead of props (eliminates prop drilling)
  const { settings, updateSettings } = useSettings();

  const [editingGroup, setEditingGroup] = useState(null);
  const [originalGroupData, setOriginalGroupData] = useState(null);
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);

  // Local state for group name/description while editing (for instant UI feedback)
  const [localGroupEdits, setLocalGroupEdits] = useState({});

  // Phase 2: Validation state
  const [validationConflicts, setValidationConflicts] = useState([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Schedule validation hook
  const { validateStaffGroups } = useScheduleValidation(currentScheduleId);

  // Backup staff service hook for database integration
  const {
    backupAssignments: hookBackupAssignments,
    loading: backupLoading,
    error: backupError,
    syncStatus: backupSyncStatus,
    addBackupAssignment: hookAddBackupAssignment,
    removeBackupAssignment: hookRemoveBackupAssignment,
    refreshBackupAssignments,
    getAvailableBackupStaff: hookGetAvailableBackupStaff,
  } = useBackupStaffService();

  // Fix: Memoize derived arrays to prevent unnecessary re-renders
  // Transform WebSocket multi-table format to localStorage-compatible format
  const staffGroups = useMemo(() => {
    const groups = settings?.staffGroups || [];
    // ✅ FIX: Filter out soft-deleted groups and ensure members array exists
    return groups
      .filter((group) => group.is_active !== false && group.isActive !== false)
      .map((group) => ({
        ...group,
        // Extract members from groupConfig if stored there (multi-table backend)
        // Otherwise use members directly, or default to empty array
        members: group.members || group.groupConfig?.members || [],
      }));
  }, [settings?.staffGroups]);
  const conflictRules = useMemo(
    () => settings?.conflictRules || [],
    [settings?.conflictRules],
  );
  // Prefer hook backup assignments (from database) over settings
  const backupAssignments = useMemo(
    () =>
      hookBackupAssignments.length > 0
        ? hookBackupAssignments
        : settings?.backupAssignments || [],
    [hookBackupAssignments, settings?.backupAssignments],
  );

  // Keep settings in sync with hook backup assignments
  const lastBackupAssignmentsRef = useRef(JSON.stringify([]));

  useEffect(() => {
    const currentBackupString = JSON.stringify(hookBackupAssignments);

    // Only update if backup assignments actually changed
    if (
      hookBackupAssignments.length > 0 &&
      currentBackupString !== lastBackupAssignmentsRef.current
    ) {
      lastBackupAssignmentsRef.current = currentBackupString;

      // Use ref to avoid infinite loop
      onSettingsChangeRef.current({
        ...settingsRef.current,
        backupAssignments: hookBackupAssignments,
      });
    }
  }, [hookBackupAssignments]);

  const updateConflictRules = useCallback(
    (newRules) => {
      // Use refs to avoid infinite loop
      onSettingsChangeRef.current({
        ...settingsRef.current,
        conflictRules: [...newRules], // Create new array reference
      });
    },
    [], // No dependencies - uses refs
  );

  // Automatically ensure all groups have intra-group conflict rules enabled
  // Use a ref to prevent interference with delete operations and infinite loops
  const lastProcessedGroupIdsRef = useRef(new Set());
  const onSettingsChangeRef = useRef(updateSettings); // Phase 3: updateSettings from Context
  const settingsRef = useRef(settings);
  const staffGroupsRef = useRef(staffGroups);

  // Update refs when context values change (Phase 3: updateSettings is stable from Context)
  useEffect(() => {
    onSettingsChangeRef.current = updateSettings;
    settingsRef.current = settings;
    staffGroupsRef.current = staffGroups;
  }, [updateSettings, settings, staffGroups]);

  // Use useMemo to create a stable groupIds string that only changes when actual group IDs change
  const groupIdsString = useMemo(() => {
    return JSON.stringify(staffGroups.map((g) => g.id).sort());
  }, [staffGroups]);

  useEffect(() => {
    const currentGroupIds = new Set(staffGroups.map((g) => g.id));
    const lastProcessedIds = lastProcessedGroupIdsRef.current;

    // Only process if the group IDs actually changed (not just a re-render)
    const lastProcessedString = JSON.stringify([...lastProcessedIds].sort());
    if (groupIdsString === lastProcessedString) {
      return;
    }

    // Get current conflict rules from settings ref to avoid infinite loop
    const currentSettings = settingsRef.current;
    const currentConflictRules = currentSettings?.conflictRules || [];

    // Check if we actually need to add any new rules
    const missingRules = [];
    staffGroups.forEach((group) => {
      const ruleId = `intra-${group.id}`;
      const existingRule = currentConflictRules.find(
        (rule) => rule.id === ruleId,
      );

      if (!existingRule) {
        missingRules.push({
          id: ruleId,
          name: `${group.name} Intra-Group Conflict Prevention`,
          type: "intra_group_conflict",
          groupId: group.id,
          constraint: "prevent_same_shift_same_day",
          isHardConstraint: true,
          penaltyWeight: 15,
          description:
            "Prevents staff in the same group from having identical shifts on the same day",
        });
      }
    });

    // Only update if we have missing rules to add
    if (missingRules.length > 0) {
      const updatedRules = [...currentConflictRules, ...missingRules];

      // Double-check that the rules are actually different before updating
      const currentRulesString = JSON.stringify(
        currentConflictRules.map((r) => r.id).sort(),
      );
      const updatedRulesString = JSON.stringify(
        updatedRules.map((r) => r.id).sort(),
      );

      if (currentRulesString !== updatedRulesString) {
        // Use ref to avoid dependency on onSettingsChange
        onSettingsChangeRef.current({
          ...currentSettings,
          conflictRules: updatedRules,
        });
      }
    }

    // Update the ref with current group IDs
    lastProcessedGroupIdsRef.current = currentGroupIds;
  }, [groupIdsString]); // Only depend on the memoized group IDs string

  const updateStaffGroups = useCallback(
    async (newGroups, skipValidation = false) => {
      console.log("💫 [updateStaffGroups] START:", {
        newGroupsCount: newGroups.length,
        skipValidation,
        hasCurrentScheduleId: !!currentScheduleId,
        timestamp: new Date().toISOString(),
      });

      try {
        // Phase 2: Validate against current schedule before saving (unless skipped)
        if (!skipValidation && currentScheduleId) {
          console.log("💫 [updateStaffGroups] Starting validation...");
          setIsValidating(true);
          try {
            const conflicts = await validateStaffGroups(newGroups);
            console.log("💫 [updateStaffGroups] Validation complete:", {
              conflictsFound: conflicts.length,
            });

            if (conflicts.length > 0) {
              // Show warning toast with conflict count
              toast.warning(
                `Warning: ${conflicts.length} schedule conflict${conflicts.length !== 1 ? "s" : ""} detected`,
                {
                  description:
                    "Some group members are working on the same dates",
                  action: {
                    label: "View Conflicts",
                    onClick: () => {
                      setValidationConflicts(conflicts);
                      setShowConflictsModal(true);
                    },
                  },
                  duration: 6000,
                },
              );

              console.log(
                "⚠️ Staff groups validation detected conflicts:",
                conflicts,
              );
            }
          } catch (validationError) {
            console.error(
              "❌ Staff groups validation failed:",
              validationError,
            );
            // Continue with save even if validation fails
          } finally {
            setIsValidating(false);
          }
        }

        // Use ref to get current settings to avoid infinite loop
        const currentSettings = settingsRef.current;

        console.log(
          "💫 [updateStaffGroups] Creating updated settings object...",
        );
        // Create a completely new settings object to ensure proper state update
        const updatedSettings = {
          ...currentSettings,
          staffGroups: [...newGroups], // Create a new array reference
        };

        console.log("💫 [updateStaffGroups] Calling updateSettings via ref...");
        // Use ref to avoid dependency on onSettingsChange
        onSettingsChangeRef.current(updatedSettings);
        console.log(
          "💫 [updateStaffGroups] updateSettings called - this will trigger re-render",
        );
        console.log("💫 [updateStaffGroups] END");
      } catch (error) {
        console.error(
          "❌ [updateStaffGroups] Error updating staff groups:",
          error,
        );
        throw error;
      }
    },
    [currentScheduleId, validateStaffGroups],
  );

  // Cancel changes and restore original data
  const handleCancelEdit = useCallback(() => {
    if (originalGroupData && editingGroup) {
      const updatedGroups = staffGroups.map((group) =>
        group.id === editingGroup ? originalGroupData : group,
      );
      updateStaffGroups(updatedGroups);

      // Clear local edits for this group
      setLocalGroupEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[editingGroup];
        return newEdits;
      });
    }
    setEditingGroup(null);
    setOriginalGroupData(null);
  }, [originalGroupData, editingGroup, staffGroups, updateStaffGroups]);

  // Add escape key listener to exit edit mode
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && editingGroup) {
        handleCancelEdit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingGroup, handleCancelEdit]);

  // Start editing a group and save original data for cancel
  const startEditingGroup = (groupId) => {
    const group = staffGroups.find((g) => g.id === groupId);
    if (group) {
      setOriginalGroupData({ ...group });
      setEditingGroup(groupId);
    }
  };

  // Save changes and exit edit mode
  const handleSaveEdit = () => {
    // Clear any pending debounce timers and send update immediately
    if (editingGroup && updateGroupDebounceRef.current[editingGroup]) {
      clearTimeout(updateGroupDebounceRef.current[editingGroup]);
      delete updateGroupDebounceRef.current[editingGroup];

      // Get the final local edits and send to server
      const localEdits = localGroupEdits[editingGroup];
      if (localEdits) {
        const updatedGroups = staffGroups.map((group) =>
          group.id === editingGroup ? { ...group, ...localEdits } : group,
        );
        updateStaffGroups(updatedGroups);
      }
    }

    // Clear local edits for this group
    setLocalGroupEdits((prev) => {
      const newEdits = { ...prev };
      delete newEdits[editingGroup];
      return newEdits;
    });

    setEditingGroup(null);
    setOriginalGroupData(null);
  };

  // Get the next available color, avoiding recently used ones
  const getNextAvailableColor = () => {
    const usedColors = new Set(staffGroups.map((group) => group.color));

    // Find first unused color
    for (const color of PRESET_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }

    // If all colors are used, cycle through them
    return PRESET_COLORS[staffGroups.length % PRESET_COLORS.length];
  };

  const createNewGroup = () => {
    // Generate a unique group name based on existing groups
    let groupNumber = 1;
    let newGroupName = `New Group ${groupNumber}`;

    // Keep incrementing until we find a unique name
    while (staffGroups.some((group) => group.name === newGroupName)) {
      groupNumber++;
      newGroupName = `New Group ${groupNumber}`;
    }

    const newGroup = {
      id: crypto.randomUUID(), // Generate proper UUID for Supabase
      name: newGroupName,
      description: "",
      color: getNextAvailableColor(),
      members: [], // Always initialize members array (WebSocket multi-table backend compatibility)
    };
    setEditingGroup(newGroup.id);
    updateStaffGroups([...staffGroups, newGroup]);

    // Automatically enable intra-group conflict rule for the new group
    // Note: The useEffect will handle adding the rule once the group is in state
  };

  // Debounce ref for group updates to prevent rapid-fire WebSocket messages
  const updateGroupDebounceRef = useRef({});

  const updateGroup = useCallback(
    (groupId, updates) => {
      console.log("✏️ [updateGroup] Called:", {
        groupId,
        updates,
        timestamp: new Date().toISOString(),
      });

      // Update local state immediately for responsive UI
      setLocalGroupEdits((prev) => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || {}), ...updates },
      }));

      // Clear existing debounce timer for this group
      if (updateGroupDebounceRef.current[groupId]) {
        console.log(
          "✏️ [updateGroup] Clearing existing debounce timer for group:",
          groupId,
        );
        clearTimeout(updateGroupDebounceRef.current[groupId]);
      }

      console.log("✏️ [updateGroup] Starting 500ms debounce timer...");

      // Debounce the server update (500ms delay)
      updateGroupDebounceRef.current[groupId] = setTimeout(() => {
        console.log(
          "⏱️ [updateGroup] Debounce timer fired - sending update to server:",
          {
            groupId,
            updates,
            timestamp: new Date().toISOString(),
          },
        );

        // Create updated groups array using staffGroups (not localGroupEdits)
        const updatedGroups = staffGroups.map((group) =>
          group.id === groupId ? { ...group, ...updates } : group,
        );

        // Send the update to server after user stops typing
        // This will trigger updateSettings() and the WebSocket send
        updateStaffGroups(updatedGroups);

        // Clear local edits for this group after sending to server
        setLocalGroupEdits((prev) => {
          const newEdits = { ...prev };
          delete newEdits[groupId];
          return newEdits;
        });

        // Clean up timer reference
        delete updateGroupDebounceRef.current[groupId];
      }, 500); // 500ms debounce delay
    },
    [staffGroups, updateStaffGroups],
  );

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(updateGroupDebounceRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  // Delete group logic - called when user confirms deletion
  const performDeleteGroup = useCallback(
    async (groupId) => {
      console.log(
        "🗑️ [StaffGroupsTab] performDeleteGroup called with groupId:",
        groupId,
      );

      try {
        // Filter out the group to delete
        const updatedGroups = staffGroups.filter(
          (group) => group.id !== groupId,
        );

        // Remove related intra-group conflict rules
        const updatedRules = conflictRules.filter(
          (rule) =>
            !(rule.type === "intra_group_conflict" && rule.groupId === groupId),
        );

        // Remove related backup assignments using hook
        const relatedBackupAssignments = backupAssignments.filter(
          (assignment) => assignment.groupId === groupId,
        );

        // Remove each backup assignment through the hook for proper database sync
        for (const assignment of relatedBackupAssignments) {
          await hookRemoveBackupAssignment(assignment.id);
        }

        // Update settings in a single atomic operation (backup assignments handled by hook)
        const updatedSettings = {
          ...settings,
          staffGroups: [...updatedGroups],
          conflictRules: [...updatedRules],
        };

        // Update settings (this will trigger change detection)
        console.log("🗑️ [StaffGroupsTab] Calling updateSettings with:", {
          oldGroupsCount: settings.staffGroups?.length,
          newGroupsCount: updatedSettings.staffGroups?.length,
          deletedGroupId: groupId,
        });
        updateSettings(updatedSettings);
        console.log("🗑️ [StaffGroupsTab] updateSettings called successfully");
      } catch (error) {
        console.error("🗑️ [StaffGroupsTab] Error deleting group:", error);
        throw error;
      }
    },
    [
      staffGroups,
      conflictRules,
      backupAssignments,
      settings,
      updateSettings,
      hookRemoveBackupAssignment,
    ],
  );

  // Delete group - trigger confirmation modal via parent
  const deleteGroup = useCallback(
    (groupId) => {
      console.log(
        "🗑️ [StaffGroupsTab] deleteGroup called with groupId:",
        groupId,
      );
      const group = staffGroups.find((g) => g.id === groupId);
      console.log("🗑️ [StaffGroupsTab] Found group:", group);

      if (group && onDeleteGroup) {
        console.log("🗑️ [StaffGroupsTab] Calling onDeleteGroup callback");
        // Pass the group info and delete handler to parent
        onDeleteGroup(groupId, group.name, () => performDeleteGroup(groupId));
      } else {
        if (!group) {
          console.error("🗑️ [StaffGroupsTab] Group not found for ID:", groupId);
        }
        if (!onDeleteGroup) {
          console.error(
            "🗑️ [StaffGroupsTab] onDeleteGroup callback not provided",
          );
        }
      }
    },
    [staffGroups, onDeleteGroup, performDeleteGroup],
  );

  const addStaffToGroup = (groupId, staffId) => {
    console.log("⭐ [addStaffToGroup] START:", {
      groupId,
      staffId,
      currentGroupsCount: staffGroups.length,
      timestamp: new Date().toISOString(),
    });

    // Allow staff to be in multiple groups - just add to the specified group
    const updatedGroups = staffGroups.map((group) => ({
      ...group,
      members:
        group.id === groupId
          ? [...new Set([...(group.members || []), staffId])] // Use Set to avoid duplicates, handle undefined members
          : group.members || [],
    }));

    console.log(
      "⭐ [addStaffToGroup] Updated groups created, calling updateStaffGroups...",
    );
    updateStaffGroups(updatedGroups);
    console.log("⭐ [addStaffToGroup] END - updateStaffGroups called");
  };

  const removeStaffFromGroup = (groupId, staffId) => {
    const updatedGroups = staffGroups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            members: (group.members || []).filter((id) => id !== staffId),
          }
        : group,
    );
    updateStaffGroups(updatedGroups);
  };

  // Backup Assignment Management Functions
  // Use hook-based backup assignment functions with database persistence
  const addBackupAssignment = async (staffId, groupId) => {
    const success = await hookAddBackupAssignment(staffId, groupId, {
      assignmentType: "regular",
      priorityOrder: 1,
      notes: "",
    });

    if (!success && backupError) {
      console.error("Failed to add backup assignment:", backupError);
    }

    return success;
  };

  const removeBackupAssignment = async (assignmentId) => {
    const success = await hookRemoveBackupAssignment(assignmentId);

    if (!success && backupError) {
      console.error("Failed to remove backup assignment:", backupError);
    }

    return success;
  };

  // Get available staff for backup assignments using hook function
  const getAvailableBackupStaffForGroup = (groupId) => {
    const activeStaff = getActiveStaffMembers();
    return hookGetAvailableBackupStaff(groupId, activeStaff, staffGroups);
  };

  // Check if a staff member can backup a specific group
  const canStaffBackupGroup = (staffId, groupId) => {
    const group = staffGroups.find((g) => g.id === groupId);
    if (!group) return false;

    // Staff cannot backup a group they are already a member of
    // Handle undefined members array (WebSocket multi-table backend compatibility)
    return !(group.members || []).includes(staffId);
  };

  // Get backup assignments for a specific group
  const getBackupAssignmentsForGroup = (groupId) => {
    return backupAssignments.filter(
      (assignment) => assignment.groupId === groupId,
    );
  };

  // Get backup assignments for a specific staff member
  const getBackupAssignmentsForStaff = (staffId) => {
    return backupAssignments.filter(
      (assignment) => assignment.staffId === staffId,
    );
  };

  const getGroupById = (id) => staffGroups.find((group) => group.id === id);
  const getStaffById = (id) => staffMembers.find((staff) => staff.id === id);

  // Get active staff members (filter out those with endPeriod)
  const getActiveStaffMembers = () => {
    return staffMembers.filter((staff) => {
      // Check if staff has an end period - if so, they are inactive
      if (staff.endPeriod) {
        // Create end date and check if it's in the past
        const staffEndDate = new Date(
          Date.UTC(
            staff.endPeriod.year,
            staff.endPeriod.month - 1, // month is 0-indexed
            staff.endPeriod.day || 31,
          ),
        );
        const today = new Date();
        return staffEndDate >= today;
      }
      // Staff without endPeriod are considered active
      return true;
    });
  };

  // Get available staff for a specific group (active staff not already in that group)
  // FIXED: Wrapped in useCallback to maintain stable reference across renders
  const getAvailableStaffForGroup = useCallback(
    (groupId) => {
      const activeStaff = getActiveStaffMembers();
      const group = staffGroups.find((g) => g.id === groupId);
      const groupMemberIds = new Set(group?.members || []);

      return activeStaff.filter((staff) => !groupMemberIds.has(staff.id));
    },
    [staffMembers, staffGroups],
  ); // Depend on staffMembers and staffGroups

  // Update drag start to only work on active staff
  const handleDragStart = (e, staffId) => {
    const staff = getStaffById(staffId);
    // Check if staff is active using the same logic as getActiveStaffMembers
    const isActive =
      staff &&
      (!staff.endPeriod ||
        new Date(
          Date.UTC(
            staff.endPeriod.year,
            staff.endPeriod.month - 1,
            staff.endPeriod.day || 31,
          ),
        ) >= new Date());

    if (isActive) {
      setDraggedStaff(staffId);
      e.dataTransfer.effectAllowed = "move";
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverGroup(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroup(null);
  };

  const handleDrop = (e, groupId) => {
    e.preventDefault();
    if (draggedStaff) {
      addStaffToGroup(groupId, draggedStaff);
    }
    setDraggedStaff(null);
    setDragOverGroup(null);
  };

  // Backup Management Component
  const BackupManagementSection = () => {
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");

    const activeStaff = getActiveStaffMembers();
    const availableStaffForSelectedGroup = selectedGroupId
      ? getAvailableBackupStaffForGroup(selectedGroupId)
      : activeStaff;

    const handleAddBackup = () => {
      if (selectedStaffId && selectedGroupId) {
        if (canStaffBackupGroup(selectedStaffId, selectedGroupId)) {
          addBackupAssignment(selectedStaffId, selectedGroupId);
          setSelectedStaffId("");
          setSelectedGroupId("");
        }
      }
    };

    const isAddButtonDisabled =
      !selectedStaffId ||
      !selectedGroupId ||
      !canStaffBackupGroup(selectedStaffId, selectedGroupId);

    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Shield size={24} className="text-orange-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">
              Backup Group Management
            </h3>
            <p className="text-gray-600">
              Assign staff members as backups for specific groups
            </p>
          </div>
        </div>

        {/* Add New Backup Assignment */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            Add New Backup Assignment
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Staff Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Staff Member
              </label>
              <div className="relative">
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Choose staff member...</option>
                  {availableStaffForSelectedGroup.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Group Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup for Group
              </label>
              <div className="relative">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Choose group...</option>
                  {staffGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Add Button */}
            <div>
              <button
                onClick={handleAddBackup}
                disabled={isAddButtonDisabled}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAddButtonDisabled
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Plus size={16} />
                Add Backup
              </button>
            </div>
          </div>

          {selectedStaffId &&
            selectedGroupId &&
            !canStaffBackupGroup(selectedStaffId, selectedGroupId) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This staff member is already in the selected group and
                    cannot be assigned as a backup.
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Current Backup Assignments */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            Current Backup Assignments
          </h4>

          {backupAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-2">No backup assignments</p>
              <p className="text-sm text-gray-500">
                Create backup assignments to ensure group coverage when needed
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backupAssignments.map((assignment) => {
                const staff = getStaffById(assignment.staffId);
                const group = getGroupById(assignment.groupId);

                if (!staff || !group) return null;

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                          {staff.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {staff.name}
                          </p>
                          <p className="text-sm text-gray-600">Staff Member</p>
                        </div>
                      </div>

                      <div className="text-gray-400">→</div>

                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: group.color }}
                        />
                        <div>
                          <p className="font-medium text-gray-800">
                            {group.name}
                          </p>
                          <p className="text-sm text-gray-600">Backup Group</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeBackupAssignment(assignment.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove backup assignment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGroupCard = (group) => {
    const isEditing = editingGroup === group.id;
    // Defensive check: handle undefined/null members array (WebSocket multi-table backend compatibility)
    const groupMembers = (group.members || [])
      .map(getStaffById)
      .filter(Boolean);

    // Use local edits if available, otherwise use server state
    const localEdits = localGroupEdits[group.id] || {};
    const displayName =
      localEdits.name !== undefined ? localEdits.name : group.name;
    const displayDescription =
      localEdits.description !== undefined
        ? localEdits.description
        : group.description;

    // ✅ FIX: Use stable key that doesn't change during edits
    // This prevents React from reordering DOM elements when group names change
    return (
      <div
        key={`group-${group.id}`}
        data-group-id={group.id}
        className={`bg-white rounded-xl border-2 p-4 transition-all duration-200 ${
          dragOverGroup === group.id
            ? "border-blue-400 shadow-lg scale-105"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onDragOver={(e) => handleDragOver(e, group.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, group.id)}
      >
        {/* Group Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: group.color }}
            />
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) =>
                    updateGroup(group.id, { name: e.target.value })
                  }
                  className="font-semibold text-lg bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                  autoFocus
                />
              ) : (
                <h3 className="font-semibold text-lg text-gray-800 truncate">
                  {displayName}
                </h3>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Save changes"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cancel changes"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditingGroup(group.id)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => deleteGroup(group.id)}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Group"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Group Description */}
        {isEditing && (
          <div className="mb-3">
            <input
              type="text"
              value={displayDescription}
              onChange={(e) =>
                updateGroup(group.id, { description: e.target.value })
              }
              placeholder="Group description..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!isEditing && displayDescription && (
          <p className="text-sm text-gray-600 mb-4">{displayDescription}</p>
        )}

        {/* Staff Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users size={16} />
              Members ({groupMembers.length})
            </div>
            <select
              defaultValue=""
              onChange={(e) => {
                console.log("🔵 [Dropdown onChange] Event fired:", {
                  value: e.target.value,
                  groupId: group.id,
                  groupName: group.name,
                  timestamp: new Date().toISOString(),
                });

                const selectedStaffId = e.target.value;
                console.log(
                  "🔵 [Dropdown onChange] Selected staff ID:",
                  selectedStaffId,
                );

                if (selectedStaffId) {
                  console.log(
                    "🔵 [Dropdown onChange] Calling addStaffToGroup...",
                  );
                  try {
                    addStaffToGroup(group.id, selectedStaffId);
                    console.log(
                      "🔵 [Dropdown onChange] addStaffToGroup called successfully",
                    );

                    // Success toast
                    const staff = staffMembers.find(
                      (s) => s.id === selectedStaffId,
                    );
                    console.log("🔵 [Dropdown onChange] Found staff:", staff);

                    if (staff) {
                      toast.success(`Added ${staff.name} to ${group.name}`);
                      console.log("🔵 [Dropdown onChange] Toast displayed");
                    } else {
                      console.warn(
                        "⚠️ [Dropdown onChange] Staff not found in staffMembers",
                      );
                    }

                    // Reset dropdown to placeholder
                    e.target.value = "";
                    console.log(
                      "🔵 [Dropdown onChange] Dropdown reset to placeholder",
                    );
                  } catch (error) {
                    console.error("❌ [Dropdown onChange] Error:", error);
                    toast.error(`Failed to add staff: ${error.message}`);
                  }
                } else {
                  console.warn(
                    "⚠️ [Dropdown onChange] selectedStaffId is empty",
                  );
                }
              }}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
              title="Add staff to group"
            >
              <option value="" disabled className="text-gray-500">
                ➕ Add staff...
              </option>
              {getAvailableStaffForGroup(group.id).map((staff) => (
                <option
                  key={staff.id}
                  value={staff.id}
                  className="text-gray-900"
                >
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {groupMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium">
                    {member.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => removeStaffFromGroup(group.id, member.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove from group"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {groupMembers.length === 0 && (
              <div className="text-center py-4">
                <div className="text-gray-500 text-sm mb-2">
                  No staff assigned to this group
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Staff Groups</h2>
          <p className="text-gray-600">
            Organize staff into groups and configure conflict rules for better
            scheduling.
          </p>
        </div>

        <button
          onClick={createNewGroup}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Add Group
        </button>
      </div>

      {/* Error Messages */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="font-medium text-red-800">Validation Errors</span>
          </div>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Staff Groups */}
      {staffGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {staffGroups.map((group) => renderGroupCard(group))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            No Staff Groups
          </h3>
          <p className="text-gray-600 mb-4">
            Create your first staff group to organize your team and set up
            scheduling rules.
          </p>
          <button
            onClick={createNewGroup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Create First Group
          </button>
        </div>
      )}

      {/* Backup Management Section - Hide when delete modal is open to prevent dropdown from appearing inside modal */}
      {!isDeleteModalOpen && <BackupManagementSection />}

      {/* Phase 2: Validation Conflicts Modal */}
      <ConflictsModal
        isOpen={showConflictsModal}
        onClose={() => setShowConflictsModal(false)}
        conflicts={validationConflicts}
        type="staff_groups"
        staffMembers={staffMembers}
        title="Staff Group Conflicts Detected"
      />

      {/* Validation Loading Indicator */}
      {isValidating && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Validating schedule...</span>
        </div>
      )}
    </div>
  );
};

export default StaffGroupsTab;
