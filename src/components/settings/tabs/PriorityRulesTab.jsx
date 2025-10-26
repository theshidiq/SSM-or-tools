import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Star,
  AlertTriangle,
  Edit2,
  User,
  Calendar,
  Check,
  XCircle,
} from "lucide-react";
import debounce from "lodash/debounce";
import { toast } from "sonner";
import { useSettings } from "../../../contexts/SettingsContext";
import FormField from "../shared/FormField";
import ConfirmationModal from "../shared/ConfirmationModal";

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
];

const PRIORITY_LEVELS = [
  { value: 1, label: "Low Priority", color: "text-gray-600" },
  { value: 2, label: "Medium Priority", color: "text-yellow-600" },
  { value: 3, label: "High Priority", color: "text-orange-600" },
  { value: 4, label: "Critical Priority", color: "text-red-600" },
  { value: 5, label: "Absolute Priority", color: "text-purple-600" },
];

const PriorityRulesTab = ({ staffMembers = [], validationErrors = {} }) => {
  // Phase 4.2: Get settings from Context instead of props
  const { settings, updateSettings } = useSettings();

  const [editingRule, setEditingRule] = useState(null);
  const [originalRuleData, setOriginalRuleData] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { id, name }
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [conflictingRules, setConflictingRules] = useState([]);

  // ✅ FIX: Local edit buffer for responsive UI with debounced server sync
  // Stores temporary edits until they're synced to server after 500ms of inactivity
  const [editBuffer, setEditBuffer] = useState({}); // { [ruleId]: { name: "...", description: "..." } }

  // Fix: Memoize derived arrays to prevent unnecessary re-renders
  // Transform WebSocket multi-table format to localStorage-compatible format
  const priorityRules = useMemo(() => {
    const rules = settings?.priorityRules || [];
    // Ensure all rules have required properties (WebSocket multi-table backend compatibility)
    // Handle legacy object format - convert to array if needed
    const rulesArray = Array.isArray(rules) ? rules : [];

    return rulesArray.map((rule) => ({
      ...rule,
      // Extract properties from ruleConfig if stored there (multi-table backend)
      // Otherwise use properties directly, or default to safe values
      daysOfWeek: rule.daysOfWeek || rule.ruleConfig?.daysOfWeek || [],
      targetIds: rule.targetIds || rule.ruleConfig?.targetIds || [],
      shiftType: rule.shiftType || rule.ruleConfig?.shiftType || "early",
      ruleType: rule.ruleType || rule.ruleConfig?.ruleType || "preferred_shift",
      staffId: rule.staffId || rule.ruleConfig?.staffId || "",
      priorityLevel: rule.priorityLevel ?? rule.ruleConfig?.priorityLevel ?? 4,
      preferenceStrength:
        rule.preferenceStrength ?? rule.ruleConfig?.preferenceStrength ?? 1.0,
      isHardConstraint:
        rule.isHardConstraint ?? rule.ruleConfig?.isHardConstraint ?? true,
      penaltyWeight:
        rule.penaltyWeight ?? rule.ruleConfig?.penaltyWeight ?? 100,
      effectiveFrom:
        rule.effectiveFrom ?? rule.ruleConfig?.effectiveFrom ?? null,
      effectiveUntil:
        rule.effectiveUntil ?? rule.ruleConfig?.effectiveUntil ?? null,
      isActive: rule.isActive ?? rule.ruleConfig?.isActive ?? true,
      description: rule.description || rule.ruleConfig?.description || "",
    }));
  }, [settings?.priorityRules]);

  // Memoize conflict detection to prevent recalculation (Phase 4.2)
  const detectRuleConflicts = useCallback(
    (rules) => {
      const conflicts = [];

      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
          const rule1 = rules[i];
          const rule2 = rules[j];

          // Check if rules apply to same staff and have conflicting requirements
          if (rule1.staffId === rule2.staffId) {
            // Defensive: Ensure daysOfWeek is an array
            const days1 = Array.isArray(rule1.daysOfWeek)
              ? rule1.daysOfWeek
              : [];
            const days2 = Array.isArray(rule2.daysOfWeek)
              ? rule2.daysOfWeek
              : [];

            const daysOverlap = days1.some((day) => days2.includes(day));
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
    },
    [staffMembers],
  ); // Only depends on staffMembers

  // Wrap updatePriorityRules in useCallback for stable reference (Phase 4.2)
  // ✅ FIX: Use functional update to avoid dependency on settings object
  const updatePriorityRulesImmediate = useCallback(
    (newRules) => {
      // Check for conflicts when updating rules
      const conflicts = detectRuleConflicts(newRules);
      setConflictingRules(conflicts);

      // ✅ Use functional update to get latest settings without adding to dependencies
      updateSettings((prevSettings) => ({
        ...prevSettings,
        priorityRules: newRules,
      }));
    },
    [updateSettings, detectRuleConflicts],
  );

  // ✅ FIX: Debounced server sync - waits 500ms after last edit before syncing to server
  const editBufferRef = useRef({});
  const priorityRulesRef = useRef(priorityRules);
  const debouncedSyncRef = useRef({});

  // Keep refs in sync
  useEffect(() => {
    editBufferRef.current = editBuffer;
  }, [editBuffer]);

  useEffect(() => {
    priorityRulesRef.current = priorityRules;
  }, [priorityRules]);

  // Sync specific rule from buffer to server (stable - no dependencies)
  const syncRuleToServer = useCallback(
    (ruleId) => {
      const bufferedUpdates = editBufferRef.current[ruleId];
      if (!bufferedUpdates) return;

      console.log(
        `🔄 [DEBOUNCE] Syncing buffered updates for rule ${ruleId}:`,
        bufferedUpdates,
      );

      const updatedRules = priorityRulesRef.current.map((rule) =>
        rule.id === ruleId ? { ...rule, ...bufferedUpdates } : rule,
      );

      updatePriorityRulesImmediate(updatedRules);

      // Clear buffer after sync
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[ruleId];
        return next;
      });
    },
    [updatePriorityRulesImmediate],
  );

  // Create stable debounced functions (only once per rule)
  const getOrCreateDebouncedSync = useCallback(
    (ruleId) => {
      if (!debouncedSyncRef.current[ruleId]) {
        debouncedSyncRef.current[ruleId] = debounce(
          () => syncRuleToServer(ruleId),
          500,
          {
            leading: false,
            trailing: true,
          },
        );
      }
      return debouncedSyncRef.current[ruleId];
    },
    [syncRuleToServer],
  );

  // Cleanup: cancel all pending debounces on unmount
  useEffect(() => {
    return () => {
      Object.values(debouncedSyncRef.current).forEach((debouncedFn) => {
        if (debouncedFn) debouncedFn.cancel();
      });
    };
  }, []);

  // Immediate update function for non-text changes (selects, toggles, etc.)
  const updatePriorityRules = useCallback(
    (newRules) => {
      updatePriorityRulesImmediate(newRules);
    },
    [updatePriorityRulesImmediate],
  );

  // Cancel changes and restore original data (Phase 4.2: moved before useEffect for dependency)
  const handleCancelEdit = useCallback(() => {
    // ✅ FIX: Cancel pending debounced sync
    if (editingRule && debouncedSyncRef.current[editingRule]) {
      debouncedSyncRef.current[editingRule].cancel();
      delete debouncedSyncRef.current[editingRule];
    }

    // ✅ FIX: Clear edit buffer for this rule
    setEditBuffer((prev) => {
      const next = { ...prev };
      delete next[editingRule];
      return next;
    });

    if (originalRuleData && editingRule) {
      const updatedRules = priorityRules.map((rule) =>
        rule.id === editingRule ? originalRuleData : rule,
      );
      updatePriorityRules(updatedRules);
    }
    setEditingRule(null);
    setOriginalRuleData(null);
  }, [originalRuleData, editingRule, priorityRules, updatePriorityRules]);

  // Add escape key listener to exit edit mode (Phase 4.2: uses handleCancelEdit)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && editingRule) {
        handleCancelEdit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingRule, handleCancelEdit]);

  const createNewRule = () => {
    // ✅ FIX: Check if staff members are available before creating rule
    if (!staffMembers || staffMembers.length === 0) {
      console.error("❌ Cannot create priority rule: No staff members available");
      toast.error("Cannot create priority rule: No staff members available. Please add staff members first.", {
        duration: 5000,
        description: "Go to Settings → Staff Groups to add staff members before creating priority rules.",
      });
      return;
    }

    console.log(`✅ Creating new priority rule with staffId: ${staffMembers[0].id} (${staffMembers[0].name})`);

    const newRule = {
      id: `priority-rule-${Date.now()}`,
      name: "New Priority Rule",
      description: "",
      ruleType: "preferred_shift",
      staffId: staffMembers[0]?.id || "",
      shiftType: "early",
      daysOfWeek: [],
      // Set high priority defaults (hidden from UI)
      priorityLevel: 4, // High Priority
      preferenceStrength: 1.0, // Strong
      isHardConstraint: true, // Hard constraint
      penaltyWeight: 100, // High penalty weight
      effectiveFrom: null, // Always active
      effectiveUntil: null, // Always active
      isActive: true,
    };
    startEditingRule(newRule.id, newRule);
    updatePriorityRules([...priorityRules, newRule]);
  };

  // ✅ FIX: Update rule with local buffer + debounced server sync
  const updateRule = useCallback(
    (ruleId, updates) => {
      // Update local buffer immediately for responsive UI
      setEditBuffer((prev) => ({
        ...prev,
        [ruleId]: { ...(prev[ruleId] || {}), ...updates },
      }));

      // Trigger debounced server sync (gets or creates stable debounced function)
      const debouncedSync = getOrCreateDebouncedSync(ruleId);
      debouncedSync();
    },
    [getOrCreateDebouncedSync],
  );

  const deleteRule = (ruleId) => {
    const rule = priorityRules.find((r) => r.id === ruleId);
    if (rule) {
      setDeleteConfirmation({ id: ruleId, name: rule.name });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);
    try {
      const { id } = deleteConfirmation;
      const updatedRules = priorityRules.filter((rule) => rule.id !== id);
      updatePriorityRules(updatedRules);

      setDeleteConfirmation(null);
    } catch (error) {
      console.error("Error deleting priority rule:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
  };

  const getStaffById = (id) => staffMembers.find((staff) => staff.id === id);

  const getRulesByStaff = (staffId) => {
    if (staffId === "all") return priorityRules;
    return priorityRules.filter((rule) => rule.staffId === staffId);
  };

  // Start editing a rule and save original data for cancel
  const startEditingRule = (ruleId, ruleData = null) => {
    const rule = ruleData || priorityRules.find((r) => r.id === ruleId);
    if (rule) {
      setOriginalRuleData({ ...rule });
      setEditingRule(ruleId);
    }
  };

  // Save changes and exit edit mode
  const handleSaveEdit = () => {
    // ✅ FIX: Force immediate sync if there's buffered data
    if (editingRule && editBuffer[editingRule]) {
      // Cancel pending debounce
      if (debouncedSyncRef.current[editingRule]) {
        debouncedSyncRef.current[editingRule].cancel();
        delete debouncedSyncRef.current[editingRule];
      }

      // Sync immediately
      syncRuleToServer(editingRule);
    }

    setEditingRule(null);
    setOriginalRuleData(null);
  };

  const toggleDayOfWeek = (ruleId, dayId) => {
    const rule = priorityRules.find((r) => r.id === ruleId);
    if (!rule) return;

    // Defensive: Ensure daysOfWeek is an array
    const currentDays = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
    const updatedDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId];

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
    // Defensive: Ensure daysOfWeek is an array
    const daysOfWeek = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];

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
                daysOfWeek.includes(day.id)
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {day.short}
            </button>
          ))}
        </div>
        {daysOfWeek.length === 0 && (
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
                    value={editBuffer[rule.id]?.name ?? rule.name}
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
                {/* Defensive: Ensure daysOfWeek is an array */}
                {Array.isArray(rule.daysOfWeek) &&
                  rule.daysOfWeek.length > 0 &&
                  ` • ${rule.daysOfWeek.length} days`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${priority?.color} bg-opacity-10`}
            >
              High Priority
            </span>
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
                onClick={() => startEditingRule(rule.id)}
                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => deleteRule(rule.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
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
                value={editBuffer[rule.id]?.description ?? rule.description}
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

            {/* Shift Type */}
            <FormField label="Shift Type">
              <div className="flex gap-3">
                {SHIFT_TYPES.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => updateRule(rule.id, { shiftType: shift.id })}
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

            {/* Days of Week */}
            {renderDaySelector(rule)}
          </div>
        )}

        {!isEditing && rule.description && (
          <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
        )}

        {!isEditing && (
          <div className="space-y-3">
            {/* Days Display */}
            {/* Defensive: Ensure daysOfWeek is an array */}
            {Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0 && (
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
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                High Priority Rule
              </span>
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                Hard Constraint
              </span>
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
          {/* ✅ FIX: Show helper text when no staff members */}
          {(!staffMembers || staffMembers.length === 0) && (
            <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle size={14} />
              Add staff members before creating priority rules
            </p>
          )}
        </div>

        <button
          onClick={createNewRule}
          disabled={!staffMembers || staffMembers.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            !staffMembers || staffMembers.length === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
          title={!staffMembers || staffMembers.length === 0 ? "Add staff members first" : "Add new priority rule"}
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
            disabled={!staffMembers || staffMembers.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              !staffMembers || staffMembers.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
            title={!staffMembers || staffMembers.length === 0 ? "Add staff members first" : "Create your first priority rule"}
          >
            <Plus size={16} />
            Create First Rule
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* ✅ FIX: Memoize computed message prop to prevent infinite re-renders */}
      <ConfirmationModal
        isOpen={deleteConfirmation !== null}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Priority Rule"
        message={useMemo(
          () =>
            `Are you sure you want to delete the priority rule "${deleteConfirmation?.name}"? This action cannot be undone.`,
          [deleteConfirmation?.name],
        )}
        confirmText="Delete Rule"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default PriorityRulesTab;
