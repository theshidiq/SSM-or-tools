import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Users,
  Edit2,
  Move,
  AlertTriangle,
  X,
  UserPlus,
  Check,
  XCircle,
} from "lucide-react";
import FormField from "../shared/FormField";
import { isStaffActiveInCurrentPeriod } from "../../../utils/staffUtils";

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
}) => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [originalGroupData, setOriginalGroupData] = useState(null);
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(null); // null or groupId

  const staffGroups = settings?.staffGroups || [];
  const conflictRules = settings?.conflictRules || [];

  // Add escape key listener to exit edit mode
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && editingGroup) {
        handleCancelEdit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingGroup]);

  const updateStaffGroups = (newGroups) => {
    onSettingsChange({
      ...settings,
      staffGroups: newGroups,
    });
  };

  // Start editing a group and save original data for cancel
  const startEditingGroup = (groupId) => {
    const group = staffGroups.find(g => g.id === groupId);
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

  // Cancel changes and restore original data
  const handleCancelEdit = () => {
    if (originalGroupData && editingGroup) {
      const updatedGroups = staffGroups.map(group => 
        group.id === editingGroup ? originalGroupData : group
      );
      updateStaffGroups(updatedGroups);
    }
    setEditingGroup(null);
    setOriginalGroupData(null);
  };

  const updateConflictRules = (newRules) => {
    onSettingsChange({
      ...settings,
      conflictRules: newRules,
    });
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
      members: [],
    };
    setEditingGroup(newGroup.id);
    updateStaffGroups([...staffGroups, newGroup]);
  };

  const updateGroup = (groupId, updates) => {
    const updatedGroups = staffGroups.map((group) =>
      group.id === groupId ? { ...group, ...updates } : group,
    );
    updateStaffGroups(updatedGroups);
  };

  const deleteGroup = (groupId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this group? This action cannot be undone.",
      )
    ) {
      const updatedGroups = staffGroups.filter((group) => group.id !== groupId);
      updateStaffGroups(updatedGroups);

      // Remove related conflict rules
      const updatedRules = conflictRules.filter(
        (rule) => !rule.involvedGroups?.includes(groupId),
      );
      updateConflictRules(updatedRules);
    }
  };

  const addStaffToGroup = (groupId, staffId) => {
    // Allow staff to be in multiple groups - just add to the specified group
    const updatedGroups = staffGroups.map((group) => ({
      ...group,
      members:
        group.id === groupId
          ? [...new Set([...group.members, staffId])] // Use Set to avoid duplicates
          : group.members,
    }));
    updateStaffGroups(updatedGroups);
  };

  const removeStaffFromGroup = (groupId, staffId) => {
    const updatedGroups = staffGroups.map((group) =>
      group.id === groupId
        ? { ...group, members: group.members.filter((id) => id !== staffId) }
        : group,
    );
    updateStaffGroups(updatedGroups);
  };

  const toggleConflictRule = (group1Id, group2Id) => {
    const ruleId = `${group1Id}-${group2Id}`;
    const existingRule = conflictRules.find((rule) => rule.id === ruleId);

    if (existingRule) {
      // Remove rule
      const updatedRules = conflictRules.filter((rule) => rule.id !== ruleId);
      updateConflictRules(updatedRules);
    } else {
      // Add rule
      const newRule = {
        id: ruleId,
        name: `${getGroupById(group1Id)?.name} vs ${getGroupById(group2Id)?.name} Conflict`,
        type: "group_conflict",
        involvedGroups: [group1Id, group2Id],
        constraint: "cannot_work_same_shift",
        isHardConstraint: true,
        penaltyWeight: 10,
      };
      updateConflictRules([...conflictRules, newRule]);
    }
  };

  const getGroupById = (id) => staffGroups.find((group) => group.id === id);
  const getStaffById = (id) => staffMembers.find((staff) => staff.id === id);

  // Get active staff members (filter out those with endPeriod)
  const getActiveStaffMembers = () => {
    return staffMembers.filter((staff) => {
      // Use the utility function to check if staff is active
      return isStaffActiveInCurrentPeriod(staff);
    });
  };

  // Get available staff for a specific group (active staff not already in that group)
  const getAvailableStaffForGroup = (groupId) => {
    const activeStaff = getActiveStaffMembers();
    const group = staffGroups.find((g) => g.id === groupId);
    const groupMemberIds = new Set(group?.members || []);

    return activeStaff.filter((staff) => !groupMemberIds.has(staff.id));
  };

  const hasConflictRule = (group1Id, group2Id) => {
    return conflictRules.some(
      (rule) =>
        rule.involvedGroups?.includes(group1Id) &&
        rule.involvedGroups?.includes(group2Id),
    );
  };

  // Update drag start to only work on active staff
  const handleDragStart = (e, staffId) => {
    const staff = getStaffById(staffId);
    if (staff && isStaffActiveInCurrentPeriod(staff)) {
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

  // Staff Selection Modal Component
  const StaffSelectionModal = ({ groupId, isOpen, onClose }) => {
    if (!isOpen || !groupId) return null;

    const availableStaff = getAvailableStaffForGroup(groupId);
    const group = staffGroups.find((g) => g.id === groupId);

    const handleAddStaff = (staffId) => {
      addStaffToGroup(groupId, staffId);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Add Staff to {group?.name}
            </h3>
            <button
              onClick={onClose}
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
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupCard = (group) => {
    const isEditing = editingGroup === group.id;
    const groupMembers = group.members.map(getStaffById).filter(Boolean);

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

  const renderConflictMatrix = () => {
    if (staffGroups.length < 2) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Group Conflicts
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Toggle conflicts between groups. Conflicting groups cannot be
          scheduled for the same shifts.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <td className="p-2"></td>
                {staffGroups.map((group) => (
                  <th
                    key={group.id}
                    className="p-2 text-center text-sm font-medium"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span>{group.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffGroups.map((group1, i) => (
                <tr key={group1.id}>
                  <th className="p-2 text-left text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group1.color }}
                      />
                      <span>{group1.name}</span>
                    </div>
                  </th>
                  {staffGroups.map((group2, j) => (
                    <td key={group2.id} className="p-2 text-center">
                      {i === j ? (
                        <div className="w-6 h-6 bg-gray-200 rounded-full mx-auto" />
                      ) : (
                        <button
                          onClick={() =>
                            toggleConflictRule(group1.id, group2.id)
                          }
                          className={`w-6 h-6 rounded-full mx-auto transition-colors ${
                            hasConflictRule(group1.id, group2.id)
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-gray-200 hover:bg-gray-300"
                          }`}
                          title={`Toggle conflict between ${group1.name} and ${group2.name}`}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Conflict enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full" />
            <span>No conflict</span>
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

      {/* Staff Selection Modal */}
      <StaffSelectionModal
        groupId={showStaffModal}
        isOpen={showStaffModal !== null}
        onClose={() => setShowStaffModal(null)}
      />

      {/* Conflict Rules Matrix */}
      {renderConflictMatrix()}
    </div>
  );
};

export default StaffGroupsTab;
