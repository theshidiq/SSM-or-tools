import React, { useState } from "react";
import { Plus, Trash2, Calendar, AlertTriangle, Save, Edit2, Clock } from "lucide-react";
import FormField from "../shared/FormField";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";
import Slider from "../shared/Slider";

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
  { id: "any", label: "Any Shift", icon: "⭐" },
];

const LIMIT_SCOPES = [
  { id: "all", label: "All Staff" },
  { id: "position", label: "By Position" },
  { id: "group", label: "By Group" },
  { id: "individual", label: "Individual Staff" },
];

const DailyLimitsTab = ({
  settings,
  onSettingsChange,
  staffMembers = [],
  validationErrors = {},
}) => {
  const [editingLimit, setEditingLimit] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const dailyLimits = settings?.dailyLimits || [];
  const monthlyLimits = settings?.monthlyLimits || [];
  const staffGroups = settings?.staffGroups || [];

  const updateDailyLimits = (newLimits) => {
    onSettingsChange({
      ...settings,
      dailyLimits: newLimits,
    });
  };

  const updateMonthlyLimits = (newLimits) => {
    onSettingsChange({
      ...settings,
      monthlyLimits: newLimits,
    });
  };

  const createNewDailyLimit = () => {
    const newLimit = {
      id: `daily-limit-${Date.now()}`,
      name: "New Daily Limit",
      shiftType: "any",
      maxCount: 3,
      daysOfWeek: DAYS_OF_WEEK.map(d => d.id), // All days by default
      scope: "all",
      targetIds: [],
      isHardConstraint: true,
      penaltyWeight: 10,
      description: "",
    };
    setEditingLimit(newLimit.id);
    updateDailyLimits([...dailyLimits, newLimit]);
    setShowAddForm(false);
  };

  const createNewMonthlyLimit = () => {
    const newLimit = {
      id: `monthly-limit-${Date.now()}`,
      name: "New Monthly Limit",
      limitType: "max_off_days",
      maxCount: 8,
      scope: "individual",
      targetIds: [],
      distributionRules: {
        minDaysBetween: 1,
        maxConsecutive: 2,
        preferWeekends: false,
      },
      isHardConstraint: false,
      penaltyWeight: 5,
      description: "",
    };
    const updatedLimits = [...monthlyLimits, newLimit];
    updateMonthlyLimits(updatedLimits);
  };

  const updateDailyLimit = (limitId, updates) => {
    const updatedLimits = dailyLimits.map(limit =>
      limit.id === limitId ? { ...limit, ...updates } : limit
    );
    updateDailyLimits(updatedLimits);
  };

  const updateMonthlyLimit = (limitId, updates) => {
    const updatedLimits = monthlyLimits.map(limit =>
      limit.id === limitId ? { ...limit, ...updates } : limit
    );
    updateMonthlyLimits(updatedLimits);
  };

  const deleteDailyLimit = (limitId) => {
    if (window.confirm("Are you sure you want to delete this daily limit?")) {
      const updatedLimits = dailyLimits.filter(limit => limit.id !== limitId);
      updateDailyLimits(updatedLimits);
    }
  };

  const deleteMonthlyLimit = (limitId) => {
    if (window.confirm("Are you sure you want to delete this monthly limit?")) {
      const updatedLimits = monthlyLimits.filter(limit => limit.id !== limitId);
      updateMonthlyLimits(updatedLimits);
    }
  };

  const toggleDayOfWeek = (limitId, dayId) => {
    const limit = dailyLimits.find(l => l.id === limitId);
    if (!limit) return;

    const updatedDays = limit.daysOfWeek.includes(dayId)
      ? limit.daysOfWeek.filter(d => d !== dayId)
      : [...limit.daysOfWeek, dayId];

    updateDailyLimit(limitId, { daysOfWeek: updatedDays });
  };

  const getTargetOptions = (scope) => {
    switch (scope) {
      case "position":
        const positions = [...new Set(staffMembers.map(s => s.position).filter(Boolean))];
        return positions.map(pos => ({ id: pos, label: pos }));
      case "group":
        return staffGroups.map(group => ({ id: group.id, label: group.name }));
      case "individual":
        return staffMembers.map(staff => ({ id: staff.id, label: staff.name }));
      default:
        return [];
    }
  };

  const renderDaySelector = (limit) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Days of Week</label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day.id}
              onClick={() => toggleDayOfWeek(limit.id, day.id)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                limit.daysOfWeek.includes(day.id)
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {day.short}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Selected days: {limit.daysOfWeek.length === 7 ? "All days" : `${limit.daysOfWeek.length} days`}
        </p>
      </div>
    );
  };

  const renderTargetSelector = (limit, isMonthly = false) => {
    if (limit.scope === "all") return null;

    const options = getTargetOptions(limit.scope);
    const updateFunc = isMonthly ? updateMonthlyLimit : updateDailyLimit;

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {limit.scope === "position" ? "Positions" :
           limit.scope === "group" ? "Groups" : "Staff Members"}
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {options.map(option => (
            <label key={option.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={limit.targetIds.includes(option.id)}
                onChange={(e) => {
                  const updatedTargets = e.target.checked
                    ? [...limit.targetIds, option.id]
                    : limit.targetIds.filter(id => id !== option.id);
                  updateFunc(limit.id, { targetIds: updatedTargets });
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
        {limit.targetIds.length === 0 && (
          <p className="text-xs text-red-600">At least one target must be selected</p>
        )}
      </div>
    );
  };

  const renderDailyLimitCard = (limit) => {
    const isEditing = editingLimit === limit.id;
    const shiftType = SHIFT_TYPES.find(st => st.id === limit.shiftType);

    return (
      <div key={limit.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">{shiftType?.icon || "📅"}</span>
            </div>
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={limit.name}
                  onChange={(e) => updateDailyLimit(limit.id, { name: e.target.value })}
                  className="text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h3 className="text-lg font-semibold text-gray-800">{limit.name}</h3>
              )}
              <p className="text-sm text-gray-600">
                {shiftType?.label} • Max {limit.maxCount} per day
                {limit.scope !== "all" && ` • ${limit.scope}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingLimit(isEditing ? null : limit.id)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={isEditing ? "Save" : "Edit"}
            >
              {isEditing ? <Save size={16} /> : <Edit2 size={16} />}
            </button>
            <button
              onClick={() => deleteDailyLimit(limit.id)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="space-y-4">
            {/* Description */}
            <FormField label="Description">
              <textarea
                value={limit.description}
                onChange={(e) => updateDailyLimit(limit.id, { description: e.target.value })}
                placeholder="Describe this limit rule..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </FormField>

            {/* Shift Type */}
            <FormField label="Shift Type">
              <select
                value={limit.shiftType}
                onChange={(e) => updateDailyLimit(limit.id, { shiftType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SHIFT_TYPES.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.icon} {st.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Max Count */}
            <NumberInput
              label="Maximum Count"
              value={limit.maxCount}
              min={0}
              max={20}
              onChange={(value) => updateDailyLimit(limit.id, { maxCount: value })}
              description="Maximum number of this shift type allowed per day"
            />

            {/* Days of Week */}
            {renderDaySelector(limit)}

            {/* Scope */}
            <FormField label="Apply To">
              <select
                value={limit.scope}
                onChange={(e) => updateDailyLimit(limit.id, { 
                  scope: e.target.value,
                  targetIds: [] // Reset targets when scope changes
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LIMIT_SCOPES.map(scope => (
                  <option key={scope.id} value={scope.id}>{scope.label}</option>
                ))}
              </select>
            </FormField>

            {/* Target Selector */}
            {renderTargetSelector(limit)}

            {/* Constraint Settings */}
            <div className="flex items-center justify-between">
              <ToggleSwitch
                label="Hard Constraint"
                description="Cannot be violated vs. soft preference"
                checked={limit.isHardConstraint}
                onChange={(checked) => updateDailyLimit(limit.id, { isHardConstraint: checked })}
              />
            </div>

            {/* Penalty Weight */}
            <Slider
              label="Penalty Weight"
              value={limit.penaltyWeight}
              min={1}
              max={100}
              onChange={(value) => updateDailyLimit(limit.id, { penaltyWeight: value })}
              description="Higher values make this constraint more important"
              colorScheme={limit.isHardConstraint ? "red" : "orange"}
            />
          </div>
        )}

        {!isEditing && limit.description && (
          <p className="text-sm text-gray-600 mb-3">{limit.description}</p>
        )}

        {!isEditing && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {limit.daysOfWeek.length === 7 ? "All days" : `${limit.daysOfWeek.length} days`}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${
              limit.isHardConstraint
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {limit.isHardConstraint ? "Hard" : "Soft"}
            </span>
            <span>Weight: {limit.penaltyWeight}</span>
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyLimitCard = (limit) => {
    return (
      <div key={limit.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{limit.name}</h3>
              <p className="text-sm text-gray-600">
                {limit.limitType.replace(/_/g, " ")} • Max {limit.maxCount} per month
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => deleteMonthlyLimit(limit.id)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {limit.description && (
          <p className="text-sm text-gray-600 mb-4">{limit.description}</p>
        )}

        {/* Distribution Rules */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800">Distribution Rules</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <NumberInput
                label="Min Days Between"
                value={limit.distributionRules?.minDaysBetween || 1}
                min={0}
                max={7}
                onChange={(value) => updateMonthlyLimit(limit.id, {
                  distributionRules: {
                    ...limit.distributionRules,
                    minDaysBetween: value
                  }
                })}
                size="small"
              />
            </div>
            
            <div>
              <NumberInput
                label="Max Consecutive"
                value={limit.distributionRules?.maxConsecutive || 2}
                min={1}
                max={7}
                onChange={(value) => updateMonthlyLimit(limit.id, {
                  distributionRules: {
                    ...limit.distributionRules,
                    maxConsecutive: value
                  }
                })}
                size="small"
              />
            </div>
          </div>

          <ToggleSwitch
            label="Prefer Weekends"
            checked={limit.distributionRules?.preferWeekends || false}
            onChange={(checked) => updateMonthlyLimit(limit.id, {
              distributionRules: {
                ...limit.distributionRules,
                preferWeekends: checked
              }
            })}
            size="small"
          />
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <span className={`px-2 py-1 rounded text-xs ${
            limit.isHardConstraint
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}>
            {limit.isHardConstraint ? "Hard" : "Soft"}
          </span>
          <span>Weight: {limit.penaltyWeight}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Daily & Monthly Limits</h2>
          <p className="text-gray-600">
            Configure scheduling limits and constraints for better work-life balance.
          </p>
        </div>
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

      {/* Daily Limits Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Daily Limits</h3>
            <p className="text-gray-600 text-sm">
              Set maximum counts for shift types per day.
            </p>
          </div>
          
          <button
            onClick={createNewDailyLimit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Daily Limit
          </button>
        </div>

        {dailyLimits.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dailyLimits.map(renderDailyLimitCard)}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Daily Limits</h3>
            <p className="text-gray-600 mb-4">
              Create daily limits to control how many staff can have the same shift type per day.
            </p>
            <button
              onClick={createNewDailyLimit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Create First Daily Limit
            </button>
          </div>
        )}
      </div>

      {/* Monthly Limits Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Monthly Limits</h3>
            <p className="text-gray-600 text-sm">
              Set monthly constraints and distribution rules.
            </p>
          </div>
          
          <button
            onClick={createNewMonthlyLimit}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            Add Monthly Limit
          </button>
        </div>

        {monthlyLimits.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {monthlyLimits.map(renderMonthlyLimitCard)}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Monthly Limits</h3>
            <p className="text-gray-600 mb-4">
              Create monthly limits to ensure fair distribution of off days and shift patterns.
            </p>
            <button
              onClick={createNewMonthlyLimit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              Create First Monthly Limit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyLimitsTab;