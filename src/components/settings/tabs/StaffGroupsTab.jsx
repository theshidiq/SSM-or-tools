import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import ReactDOM from "react-dom";
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
import ConfirmationModal from "../shared/ConfirmationModal";
import ConflictsModal from "../shared/ConflictsModal";
import { useBackupStaffService } from "../../../hooks/useBackupStaffService";
import { useScheduleValidation } from "../../../hooks/useScheduleValidation";

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
  settings,
  onSettingsChange,
  staffMembers = [],
  validationErrors = {},
  currentScheduleId = null, // Phase 2: Schedule ID for validation
}) => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [originalGroupData, setOriginalGroupData] = useState(null);
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(null); // null or groupId
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // null or { groupId, groupName }
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false); // Track if delete was successful

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

  // Use ref to persist modal state across parent re-renders
  const modalStateRef = useRef({
    deleteConfirmation: null,
    deleteSuccess: false,
  });

  // Synchronize local state with ref to handle parent re-renders
  useEffect(() => {
    if (modalStateRef.current.deleteConfirmation && !deleteConfirmation) {
      setDeleteConfirmation(modalStateRef.current.deleteConfirmation);
    }
    if (modalStateRef.current.deleteSuccess && !deleteSuccess) {
      setDeleteSuccess(modalStateRef.current.deleteSuccess);
    }
  }, [deleteConfirmation, deleteSuccess]);

  // Fix: Memoize derived arrays to prevent unnecessary re-renders
  // Transform WebSocket multi-table format to localStorage-compatible format
  const staffGroups = useMemo(
    () => {
      const groups = settings?.staffGroups || [];
      // Ensure all groups have a members array (WebSocket multi-table backend compatibility)
      return groups.map(group => ({
        ...group,
        // Extract members from groupConfig if stored there (multi-table backend)
        // Otherwise use members directly, or default to empty array
        members: group.members || group.groupConfig?.members || []
      }));
    },
    [settings?.staffGroups],
  );
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
  useEffect(() => {
    if (
      hookBackupAssignments.length > 0 &&
      JSON.stringify(hookBackupAssignments) !==
        JSON.stringify(settings?.backupAssignments)
    ) {
      onSettingsChange({
        ...settings,
        backupAssignments: hookBackupAssignments,
      });
    }
  }, [hookBackupAssignments, settings, onSettingsChange]);

  const updateConflictRules = useCallback(
    (newRules) => {
      onSettingsChange({
        ...settings,
        conflictRules: [...newRules], // Create new array reference
      });
    },
    [settings, onSettingsChange],
  );

  // Automatically ensure all groups have intra-group conflict rules enabled
  // Use a ref to prevent interference with delete operations and infinite loops
  const lastProcessedGroupIdsRef = useRef(new Set());
  const onSettingsChangeRef = useRef(onSettingsChange);
  const settingsRef = useRef(settings);
  const staffGroupsRef = useRef(staffGroups);

  // Update refs when props change
  useEffect(() => {
    onSettingsChangeRef.current = onSettingsChange;
    settingsRef.current = settings;
    staffGroupsRef.current = staffGroups;
  }, [onSettingsChange, settings, staffGroups]);

  // Use useMemo to create a stable groupIds string that only changes when actual group IDs change
  const groupIdsString = useMemo(() => {
    return JSON.stringify(staffGroups.map((g) => g.id).sort());
  }, [staffGroups]);

  useEffect(() => {
    // TEMPORARILY DISABLED to debug infinite loop issue
    // This automatic synchronization will be re-enabled after fixing the modal click issue
    return;

    /*
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
      const existingRule = currentConflictRules.find((rule) => rule.id === ruleId);

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
      const currentRulesString = JSON.stringify(currentConflictRules.map(r => r.id).sort());
      const updatedRulesString = JSON.stringify(updatedRules.map(r => r.id).sort());

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
    */
  }, [groupIdsString]); // Only depend on the memoized group IDs string

  const updateStaffGroups = useCallback(
    async (newGroups, skipValidation = false) => {
      try {
        // Phase 2: Validate against current schedule before saving (unless skipped)
        if (!skipValidation && currentScheduleId) {
          setIsValidating(true);
          try {
            const conflicts = await validateStaffGroups(newGroups);

            if (conflicts.length > 0) {
              // Show warning toast with conflict count
              toast.warning(
                `Warning: ${conflicts.length} schedule conflict${conflicts.length !== 1 ? 's' : ''} detected`,
                {
                  description: 'Some group members are working on the same dates',
                  action: {
                    label: 'View Conflicts',
                    onClick: () => {
                      setValidationConflicts(conflicts);
                      setShowConflictsModal(true);
                    }
                  },
                  duration: 6000
                }
              );

              console.log('⚠️ Staff groups validation detected conflicts:', conflicts);
            }
          } catch (validationError) {
            console.error('❌ Staff groups validation failed:', validationError);
            // Continue with save even if validation fails
          } finally {
            setIsValidating(false);
          }
        }

        // Create a completely new settings object to ensure proper state update
        const updatedSettings = {
          ...settings,
          staffGroups: [...newGroups], // Create a new array reference
        };

        onSettingsChange(updatedSettings);
      } catch (error) {
        console.error("Error updating staff groups:", error);
        throw error;
      }
    },
    [settings, onSettingsChange, currentScheduleId, validateStaffGroups],
  );

  // Cancel changes and restore original data
  const handleCancelEdit = useCallback(() => {
    if (originalGroupData && editingGroup) {
      const updatedGroups = staffGroups.map((group) =>
        group.id === editingGroup ? originalGroupData : group,
      );
      updateStaffGroups(updatedGroups);
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
    const newGroup = {
      id: `group-${Date.now()}`,
      name: "New Group",
      description: "",
      color: getNextAvailableColor(),
      members: [], // Always initialize members array (WebSocket multi-table backend compatibility)
    };
    setEditingGroup(newGroup.id);
    updateStaffGroups([...staffGroups, newGroup]);

    // Automatically enable intra-group conflict rule for the new group
    // Note: The useEffect will handle adding the rule once the group is in state
  };

  const updateGroup = (groupId, updates) => {
    const updatedGroups = staffGroups.map((group) =>
      group.id === groupId ? { ...group, ...updates } : group,
    );
    updateStaffGroups(updatedGroups);
  };

  const deleteGroup = (groupId) => {
    const group = staffGroups.find((g) => g.id === groupId);
    if (group) {
      const confirmationData = { groupId, groupName: group.name };
      setDeleteConfirmation(confirmationData);
      setDeleteSuccess(false); // Reset success state

      // Update ref to persist across re-renders
      modalStateRef.current = {
        deleteConfirmation: confirmationData,
        deleteSuccess: false,
      };
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) {
      return;
    }

    setIsDeleting(true);

    try {
      const { groupId } = deleteConfirmation;

      // Filter out the group to delete
      const updatedGroups = staffGroups.filter((group) => group.id !== groupId);

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

      // Show success state first (before updating settings to prevent parent modal from closing)
      setDeleteSuccess(true);
      setIsDeleting(false);

      // Auto-close the confirmation modal after showing success message
      setTimeout(() => {
        // Update settings AFTER the success message is shown and modal is closing
        onSettingsChange(updatedSettings);

        // Clean up modal state
        setDeleteConfirmation(null);
        setDeleteSuccess(false);
        modalStateRef.current = {
          deleteConfirmation: null,
          deleteSuccess: false,
        };
      }, 1500); // Show success message for 1.5 seconds
    } catch (error) {
      console.error("Error deleting group:", error);
    } finally {
      // Only set if not already set above for success case
      if (!deleteSuccess) {
        setIsDeleting(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
    setDeleteSuccess(false);

    // Reset ref state
    modalStateRef.current = {
      deleteConfirmation: null,
      deleteSuccess: false,
    };
  };

  const addStaffToGroup = (groupId, staffId) => {
    // Allow staff to be in multiple groups - just add to the specified group
    const updatedGroups = staffGroups.map((group) => ({
      ...group,
      members:
        group.id === groupId
          ? [...new Set([...(group.members || []), staffId])] // Use Set to avoid duplicates, handle undefined members
          : (group.members || []),
    }));
    updateStaffGroups(updatedGroups);
  };

  const removeStaffFromGroup = (groupId, staffId) => {
    const updatedGroups = staffGroups.map((group) =>
      group.id === groupId
        ? { ...group, members: (group.members || []).filter((id) => id !== staffId) }
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
  const getAvailableStaffForGroup = (groupId) => {
    const activeStaff = getActiveStaffMembers();
    const group = staffGroups.find((g) => g.id === groupId);
    const groupMemberIds = new Set(group?.members || []);

    return activeStaff.filter((staff) => !groupMemberIds.has(staff.id));
  };

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

  // Staff Selection Modal Component (using Portal for proper z-index stacking)
  const StaffSelectionModal = ({ groupId, isOpen, onClose }) => {
    if (!isOpen || !groupId) return null;

    const availableStaff = getAvailableStaffForGroup(groupId);
    const group = staffGroups.find((g) => g.id === groupId);

    const handleAddStaff = (staffId) => {
      addStaffToGroup(groupId, staffId);
      onClose();
    };

    const handleBackdropClick = (e) => {
      // Only close if clicking the backdrop itself, not child elements
      if (e.target === e.currentTarget) {
        onClose();
      }
    };

    const handleCloseClick = (e) => {
      e.stopPropagation();
      onClose();
    };

    // Render modal using React Portal to escape parent stacking context
    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70000]"
        onClick={handleBackdropClick}
      >
        <div
          className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl relative z-[70001]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Add Staff to {group?.name}
            </h3>
            <button
              onClick={handleCloseClick}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {availableStaff.length === 0 ? (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-2">No available staff</p>
              <p className="text-sm text-gray-500">
                All active staff are already in this group
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => handleAddStaff(staff.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                    {staff.name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{staff.name}</p>
                  </div>
                  <UserPlus size={18} className="text-blue-600" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCloseClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderGroupCard = (group) => {
    const isEditing = editingGroup === group.id;
    // Defensive check: handle undefined/null members array (WebSocket multi-table backend compatibility)
    const groupMembers = (group.members || []).map(getStaffById).filter(Boolean);

    return (
      <div
        key={group.id}
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
            {isEditing ? (
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) =>
                    updateGroup(group.id, { name: e.target.value })
                  }
                  className="font-semibold text-lg bg-transparent border-b-2 border-blue-500 focus:outline-none w-full mr-2"
                  autoFocus
                />
              </div>
            ) : (
              <h3 className="font-semibold text-lg text-gray-800 truncate">
                {group.name}
              </h3>
            )}
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
              value={group.description}
              onChange={(e) =>
                updateGroup(group.id, { description: e.target.value })
              }
              placeholder="Group description..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!isEditing && group.description && (
          <p className="text-sm text-gray-600 mb-4">{group.description}</p>
        )}

        {/* Staff Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users size={16} />
              Members ({groupMembers.length})
            </div>
            <button
              onClick={() => setShowStaffModal(group.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Add staff to group"
            >
              <UserPlus size={14} />
              Add Staff
            </button>
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
          {staffGroups.map(renderGroupCard)}
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

      {/* Backup Management Section */}
      <BackupManagementSection />

      {/* Staff Selection Modal */}
      <StaffSelectionModal
        groupId={showStaffModal}
        isOpen={showStaffModal !== null}
        onClose={() => setShowStaffModal(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation !== null}
        onClose={handleDeleteCancel}
        onConfirm={deleteSuccess ? null : handleDeleteConfirm}
        title={
          deleteSuccess ? "Group Deleted Successfully" : "Delete Staff Group"
        }
        message={
          deleteSuccess
            ? `The group "${deleteConfirmation?.groupName}" has been successfully deleted along with any related conflict rules and backup assignments.`
            : `Are you sure you want to delete the group "${deleteConfirmation?.groupName}"? This action cannot be undone and will also remove any related conflict rules and backup assignments.`
        }
        confirmText={deleteSuccess ? null : "Delete Group"}
        cancelText={deleteSuccess ? null : "Cancel"}
        variant={deleteSuccess ? "info" : "danger"}
        isLoading={isDeleting}
      />

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
