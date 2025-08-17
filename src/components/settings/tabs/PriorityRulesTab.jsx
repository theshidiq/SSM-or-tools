import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Star,
  AlertTriangle,
  Edit2,
  User,
  Clock,
  Calendar,
  Target,
} from "lucide-react";
import FormField from "../shared/FormField";
import Slider from "../shared/Slider";
import ToggleSwitch from "../shared/ToggleSwitch";

const DAYS_OF_WEEK = [
  { id: 0, label: "Sunday", short: "Sun" },
  { id: 1, label: "Monday", short: "Mon" },
  { id: 2, label: "Tuesday", short: "Tue" },
  { id: 3, label: "Wednesday", short: "Wed" },
  { id: 4, label: "Thursday", short: "Thu" },
  { id: 5, label: "Friday", short: "Fri" },
  { id: 6, label: "Saturday", short: "Sat" },
];

const SHIFT_TYPES = [
  { id: "early", label: "Early Shift", icon: "🌅" },
  { id: "late", label: "Late Shift", icon: "🌙" },
  { id: "off", label: "Off Day", icon: "🏠" },
];

const RULE_TYPES = [
  {
    id: "preferred_shift",
    label: "Preferred Shift",
    icon: "⭐",
    description: "Staff member prefers specific shifts on certain days",
  },
  {
    id: "avoid_shift",
    label: "Avoid Shift",
    icon: "❌",
    description: "Staff member wants to avoid specific shifts on certain days",
  },
  {
    id: "required_off",
    label: "Required Off",
    icon: "🏠",
    description: "Staff member must be off on specific days",
  },
  {
    id: "seniority_priority",
    label: "Seniority Priority",
    icon: "👑",
    description: "Give priority based on staff seniority level",
  },
];

const PRIORITY_LEVELS = [
  { value: 1, label: "Low Priority", color: "text-gray-600" },
  { value: 2, label: "Medium Priority", color: "text-yellow-600" },
  { value: 3, label: "High Priority", color: "text-orange-600" },
  { value: 4, label: "Critical Priority", color: "text-red-600" },
  { value: 5, label: "Absolute Priority", color: "text-purple-600" },
];

const PriorityRulesTab = ({
  settings,
  onSettingsChange,
  staffMembers = [],
  validationErrors = {},
}) => {
  const [editingRule, setEditingRule] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [conflictingRules, setConflictingRules] = useState([]);

  const priorityRules = settings?.priorityRules || [];

  // Add escape key listener to exit edit mode
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && editingRule) {
        setEditingRule(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingRule]);

  const updatePriorityRules = (newRules) => {
    // Check for conflicts when updating rules
    const conflicts = detectRuleConflicts(newRules);
    setConflictingRules(conflicts);

    onSettingsChange({
      ...settings,
      priorityRules: newRules,
    });
  };

  const detectRuleConflicts = (rules) => {
    const conflicts = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        // Check if rules apply to same staff and have conflicting requirements
        if (rule1.staffId === rule2.staffId) {
          const daysOverlap = rule1.daysOfWeek.some((day) =>
            rule2.daysOfWeek.includes(day),
          );
          const shiftsConflict =
            (rule1.ruleType === "preferred_shift" &&
              rule2.ruleType === "avoid_shift" &&
              rule1.shiftType === rule2.shiftType) ||
            (rule1.ruleType === "required_off" &&
              rule2.ruleType === "preferred_shift" &&
              rule2.shiftType !== "off");

          if (daysOverlap && shiftsConflict) {
            conflicts.push({
              rules: [rule1.id, rule2.id],
              description: `Conflicting rules for ${getStaffById(rule1.staffId)?.name}`,
            });
          }
        }
      }
    }

    return conflicts;
  };

  const createNewRule = () => {
    const newRule = {
      id: `priority-rule-${Date.now()}`,
      name: "New Priority Rule",
      description: "",
      ruleType: "preferred_shift",
      staffId: staffMembers[0]?.id || "",
      shiftType: "early",
      daysOfWeek: [],
      priorityLevel: 3,
      preferenceStrength: 0.8,
      isHardConstraint: false,
      penaltyWeight: 5,
      effectiveFrom: null,
      effectiveUntil: null,
      isActive: true,
    };
    setEditingRule(newRule.id);
    updatePriorityRules([...priorityRules, newRule]);
  };

  const updateRule = (ruleId, updates) => {
    const updatedRules = priorityRules.map((rule) =>
      rule.id === ruleId ? { ...rule, ...updates } : rule,
    );
    updatePriorityRules(updatedRules);
  };

  const deleteRule = (ruleId) => {
    if (window.confirm("Are you sure you want to delete this priority rule?")) {
      const updatedRules = priorityRules.filter((rule) => rule.id !== ruleId);
      updatePriorityRules(updatedRules);
    }
  };

  const getStaffById = (id) => staffMembers.find((staff) => staff.id === id);

  const getRulesByStaff = (staffId) => {
    if (staffId === "all") return priorityRules;
    return priorityRules.filter((rule) => rule.staffId === staffId);
  };

  const toggleDayOfWeek = (ruleId, dayId) => {
    const rule = priorityRules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updatedDays = rule.daysOfWeek.includes(dayId)
      ? rule.daysOfWeek.filter((d) => d !== dayId)
      : [...rule.daysOfWeek, dayId];

    updateRule(ruleId, { daysOfWeek: updatedDays });
  };

  const renderRuleTypeSelector = (rule) => {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">Rule Type</label>
        <div className="grid grid-cols-2 gap-3">
          {RULE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => updateRule(rule.id, { ruleType: type.id })}
              className={`p-3 text-left border-2 rounded-lg transition-all ${
                rule.ruleType === type.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{type.icon}</span>
                <span className="font-medium text-sm">{type.label}</span>
              </div>
              <p className="text-xs text-gray-600">{type.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderDaySelector = (rule) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Days of Week
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.id}
              onClick={() => toggleDayOfWeek(rule.id, day.id)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                rule.daysOfWeek.includes(day.id)
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {day.short}
            </button>
          ))}
        </div>
        {rule.daysOfWeek.length === 0 && (
          <p className="text-xs text-red-600">
            At least one day must be selected
          </p>
        )}
      </div>
    );
  };

  const renderRuleCard = (rule) => {
    const isEditing = editingRule === rule.id;
    const staff = getStaffById(rule.staffId);
    const ruleType = RULE_TYPES.find((rt) => rt.id === rule.ruleType);
    const priority = PRIORITY_LEVELS.find(
      (p) => p.value === rule.priorityLevel,
    );
    const isConflicted = conflictingRules.some((conflict) =>
      conflict.rules.includes(rule.id),
    );

    return (
      <div
        key={rule.id}
        className={`bg-white rounded-xl border-2 p-6 transition-all ${
          isConflicted
            ? "border-red-300 bg-red-50"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">{ruleType?.icon || "⭐"}</span>
            </div>
            <div>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) =>
                      updateRule(rule.id, { name: e.target.value })
                    }
                    className="text-lg font-semibold bg-transparent border-b-2 border-purple-500 focus:outline-none w-full"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Press Escape to finish editing
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {rule.name}
                  </h3>
                  {isConflicted && (
                    <AlertTriangle size={16} className="text-red-500" />
                  )}
                </div>
              )}
              <p className="text-sm text-gray-600">
                {staff?.name} • {ruleType?.label}
                {rule.daysOfWeek.length > 0 &&
                  ` • ${rule.daysOfWeek.length} days`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${priority?.color} bg-opacity-10`}
            >
              {priority?.label}
            </span>
            {!isEditing && (
              <button
                onClick={() => setEditingRule(rule.id)}
                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            )}
            <button
              onClick={() => deleteRule(rule.id)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Conflict Warning */}
        {isConflicted && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Rule Conflict Detected
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              This rule conflicts with other rules for the same staff member.
            </p>
          </div>
        )}

        {isEditing && (
          <div className="space-y-6">
            {/* Description */}
            <FormField label="Description">
              <textarea
                value={rule.description}
                onChange={(e) =>
                  updateRule(rule.id, { description: e.target.value })
                }
                placeholder="Describe this priority rule..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </FormField>

            {/* Staff Selection */}
            <FormField label="Staff Member">
              <select
                value={rule.staffId}
                onChange={(e) =>
                  updateRule(rule.id, { staffId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Rule Type */}
            {renderRuleTypeSelector(rule)}

            {/* Shift Type (if applicable) */}
            {rule.ruleType !== "seniority_priority" && (
              <FormField label="Shift Type">
                <div className="flex gap-3">
                  {SHIFT_TYPES.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() =>
                        updateRule(rule.id, { shiftType: shift.id })
                      }
                      className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 rounded-lg transition-all ${
                        rule.shiftType === shift.id
                          ? "border-purple-300 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-lg">{shift.icon}</span>
                      <span className="text-sm font-medium">{shift.label}</span>
                    </button>
                  ))}
                </div>
              </FormField>
            )}

            {/* Days of Week */}
            {renderDaySelector(rule)}

            {/* Priority Level */}
            <FormField label="Priority Level">
              <div className="space-y-2">
                <select
                  value={rule.priorityLevel}
                  onChange={(e) =>
                    updateRule(rule.id, {
                      priorityLevel: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PRIORITY_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Higher priority rules are more likely to be satisfied
                </p>
              </div>
            </FormField>

            {/* Preference Strength */}
            <Slider
              label="Preference Strength"
              value={rule.preferenceStrength}
              min={0.1}
              max={1.0}
              step={0.1}
              onChange={(value) =>
                updateRule(rule.id, { preferenceStrength: value })
              }
              description="How strongly this preference should be enforced (0.1 = weak, 1.0 = strong)"
              colorScheme="purple"
            />

            {/* Hard Constraint Toggle */}
            <ToggleSwitch
              label="Hard Constraint"
              description="Must be satisfied vs. preferred when possible"
              checked={rule.isHardConstraint}
              onChange={(checked) =>
                updateRule(rule.id, { isHardConstraint: checked })
              }
            />

            {/* Penalty Weight */}
            <Slider
              label="Penalty Weight"
              value={rule.penaltyWeight}
              min={1}
              max={100}
              onChange={(value) =>
                updateRule(rule.id, { penaltyWeight: value })
              }
              description="Higher values make this rule more important in scheduling decisions"
              colorScheme={rule.isHardConstraint ? "red" : "orange"}
            />

            {/* Effective Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Effective From">
                <input
                  type="date"
                  value={rule.effectiveFrom || ""}
                  onChange={(e) =>
                    updateRule(rule.id, {
                      effectiveFrom: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </FormField>

              <FormField label="Effective Until">
                <input
                  type="date"
                  value={rule.effectiveUntil || ""}
                  onChange={(e) =>
                    updateRule(rule.id, {
                      effectiveUntil: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </FormField>
            </div>

            {/* Active Toggle */}
            <ToggleSwitch
              label="Active"
              description="Whether this rule is currently active"
              checked={rule.isActive}
              onChange={(checked) => updateRule(rule.id, { isActive: checked })}
            />
          </div>
        )}

        {!isEditing && rule.description && (
          <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
        )}

        {!isEditing && (
          <div className="space-y-3">
            {/* Days Display */}
            {rule.daysOfWeek.length > 0 && (
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <div className="flex gap-1">
                  {rule.daysOfWeek.map((dayId) => {
                    const day = DAYS_OF_WEEK.find((d) => d.id === dayId);
                    return (
                      <span
                        key={dayId}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        {day?.short}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rule Details */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                Strength: {Math.round(rule.preferenceStrength * 100)}%
              </span>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  rule.isHardConstraint
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {rule.isHardConstraint ? "Hard" : "Soft"}
              </span>
              <span>Weight: {rule.penaltyWeight}</span>
              {!rule.isActive && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  Inactive
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredRules = getRulesByStaff(selectedStaff);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Priority Rules</h2>
          <p className="text-gray-600">
            Configure staff preferences and priority rules for intelligent
            scheduling.
          </p>
        </div>

        <button
          onClick={createNewRule}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={16} />
          Add Rule
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

      {/* Conflict Warnings */}
      {conflictingRules.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-600" />
            <span className="font-medium text-orange-800">
              Rule Conflicts Detected
            </span>
          </div>
          <ul className="list-disc list-inside text-orange-700 text-sm space-y-1">
            {conflictingRules.map((conflict, index) => (
              <li key={index}>{conflict.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter and Stats */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-500" />
            <label className="text-sm font-medium text-gray-700">
              Filter by Staff:
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Staff</option>
              {staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Total Rules: {filteredRules.length}</span>
          <span>Active: {filteredRules.filter((r) => r.isActive).length}</span>
          <span>Conflicts: {conflictingRules.length}</span>
        </div>
      </div>

      {/* Rules List */}
      {filteredRules.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRules.map(renderRuleCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Star size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            {selectedStaff === "all"
              ? "No Priority Rules"
              : "No Rules for Selected Staff"}
          </h3>
          <p className="text-gray-600 mb-4">
            Create priority rules to define staff preferences and scheduling
            constraints.
          </p>
          <button
            onClick={createNewRule}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} />
            Create First Rule
          </button>
        </div>
      )}
    </div>
  );
};

export default PriorityRulesTab;
