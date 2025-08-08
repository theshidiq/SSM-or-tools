import React, { useState } from "react";
import { Plus, Trash2, Users, Edit2, Move, AlertTriangle, Save, X } from "lucide-react";
import FormField from "../shared/FormField";
import ToggleSwitch from "../shared/ToggleSwitch";

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

const StaffGroupsTab = ({
  settings,
  onSettingsChange,
  staffMembers = [],
  validationErrors = {},
}) => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [draggedStaff, setDraggedStaff] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);

  const staffGroups = settings?.staffGroups || [];
  const conflictRules = settings?.conflictRules || [];

  const updateStaffGroups = (newGroups) => {
    onSettingsChange({
      ...settings,
      staffGroups: newGroups,
    });
  };

  const updateConflictRules = (newRules) => {
    onSettingsChange({
      ...settings,
      conflictRules: newRules,
    });
  };

  const createNewGroup = () => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name: "New Group",
      description: "",
      color: PRESET_COLORS[staffGroups.length % PRESET_COLORS.length],
      members: [],
      coverageRules: {
        minimumCoverage: 1,
        backupRequired: false,
        backupStaffIds: [],
      },
    };
    setEditingGroup(newGroup.id);
    updateStaffGroups([...staffGroups, newGroup]);
  };

  const updateGroup = (groupId, updates) => {
    const updatedGroups = staffGroups.map(group =>
      group.id === groupId ? { ...group, ...updates } : group
    );
    updateStaffGroups(updatedGroups);
  };

  const deleteGroup = (groupId) => {
    if (window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      const updatedGroups = staffGroups.filter(group => group.id !== groupId);
      updateStaffGroups(updatedGroups);
      
      // Remove related conflict rules
      const updatedRules = conflictRules.filter(rule =>
        !rule.involvedGroups?.includes(groupId)
      );
      updateConflictRules(updatedRules);
    }
  };

  const addStaffToGroup = (groupId, staffId) => {
    // Remove staff from other groups first
    const updatedGroups = staffGroups.map(group => ({
      ...group,
      members: group.id === groupId
        ? [...group.members.filter(id => id !== staffId), staffId]
        : group.members.filter(id => id !== staffId)
    }));
    updateStaffGroups(updatedGroups);
  };

  const removeStaffFromGroup = (groupId, staffId) => {
    const updatedGroups = staffGroups.map(group =>
      group.id === groupId
        ? { ...group, members: group.members.filter(id => id !== staffId) }
        : group
    );
    updateStaffGroups(updatedGroups);
  };

  const toggleConflictRule = (group1Id, group2Id) => {
    const ruleId = `${group1Id}-${group2Id}`;
    const existingRule = conflictRules.find(rule => rule.id === ruleId);

    if (existingRule) {
      // Remove rule
      const updatedRules = conflictRules.filter(rule => rule.id !== ruleId);
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

  const getGroupById = (id) => staffGroups.find(group => group.id === id);
  const getStaffById = (id) => staffMembers.find(staff => staff.id === id);
  const getUnassignedStaff = () => {
    const assignedIds = new Set(staffGroups.flatMap(group => group.members));
    return staffMembers.filter(staff => !assignedIds.has(staff.id));
  };

  const hasConflictRule = (group1Id, group2Id) => {
    return conflictRules.some(rule =>
      rule.involvedGroups?.includes(group1Id) && rule.involvedGroups?.includes(group2Id)
    );
  };

  const handleDragStart = (e, staffId) => {
    setDraggedStaff(staffId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

  const renderGroupCard = (group) => {
    const isEditing = editingGroup === group.id;
    const groupMembers = group.members.map(getStaffById).filter(Boolean);

    return (
      <div
        key={group.id}
        className={`bg-white rounded-xl border-2 p-6 transition-all duration-200 ${
          dragOverGroup === group.id
            ? "border-blue-400 shadow-lg scale-105"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onDragOver={(e) => handleDragOver(e, group.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, group.id)}
      >
        {/* Group Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: group.color }}
            />
            {isEditing ? (
              <input
                type="text"
                value={group.name}
                onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                className="font-semibold text-lg bg-transparent border-b-2 border-blue-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <h3 className="font-semibold text-lg text-gray-800">{group.name}</h3>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingGroup(isEditing ? null : group.id)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={isEditing ? "Save" : "Edit"}
            >
              {isEditing ? <Save size={16} /> : <Edit2 size={16} />}
            </button>
            <button
              onClick={() => deleteGroup(group.id)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Group"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Group Description */}
        {isEditing && (
          <div className="mb-4">
            <textarea
              value={group.description}
              onChange={(e) => updateGroup(group.id, { description: e.target.value })}
              placeholder="Group description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}
        
        {!isEditing && group.description && (
          <p className="text-sm text-gray-600 mb-4">{group.description}</p>
        )}

        {/* Color Selection */}
        {isEditing && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateGroup(group.id, { color })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    group.color === color ? "border-gray-800" : "border-gray-300"
                  } hover:scale-110 transition-transform`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Coverage Rules */}
        {isEditing && (
          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800">Coverage Rules</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Minimum Coverage</label>
                <input
                  type="number"
                  min="0"
                  value={group.coverageRules?.minimumCoverage || 1}
                  onChange={(e) => updateGroup(group.id, {
                    coverageRules: {
                      ...group.coverageRules,
                      minimumCoverage: parseInt(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              
              <div className="flex items-center">
                <ToggleSwitch
                  label="Backup Required"
                  checked={group.coverageRules?.backupRequired || false}
                  onChange={(checked) => updateGroup(group.id, {
                    coverageRules: {
                      ...group.coverageRules,
                      backupRequired: checked
                    }
                  })}
                  size="small"
                />
              </div>
            </div>
          </div>
        )}

        {/* Staff Members */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Users size={16} />
            Members ({groupMembers.length})
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {groupMembers.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                    {member.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.position || 'Staff'}</p>
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
              <div className="text-center py-4 text-gray-500 text-sm">
                No staff assigned to this group
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Group Conflicts</h3>
        <p className="text-sm text-gray-600 mb-4">
          Toggle conflicts between groups. Conflicting groups cannot be scheduled for the same shifts.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <td className="p-2"></td>
                {staffGroups.map(group => (
                  <th key={group.id} className="p-2 text-center text-sm font-medium">
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
                          onClick={() => toggleConflictRule(group1.id, group2.id)}
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
            Organize staff into groups and configure conflict rules for better scheduling.
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

      {/* Unassigned Staff */}
      {getUnassignedStaff().length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Unassigned Staff</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getUnassignedStaff().map(staff => (
              <div
                key={staff.id}
                draggable
                onDragStart={(e) => handleDragStart(e, staff.id)}
                className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
              >
                <Move size={16} className="text-gray-400" />
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                  {staff.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{staff.name}</p>
                  <p className="text-xs text-gray-500">{staff.position || 'Staff'}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            💡 Drag staff members to groups or use the group edit mode to assign them.
          </p>
        </div>
      )}

      {/* Staff Groups */}
      {staffGroups.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {staffGroups.map(renderGroupCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No Staff Groups</h3>
          <p className="text-gray-600 mb-4">
            Create your first staff group to organize your team and set up scheduling rules.
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

      {/* Conflict Rules Matrix */}
      {renderConflictMatrix()}
    </div>
  );
};

export default StaffGroupsTab;