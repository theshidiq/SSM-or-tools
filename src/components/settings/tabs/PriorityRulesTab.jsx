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
    supportsExceptions: false,
  },
  {
    id: "avoid_shift",
    label: "Avoid Shift",
    icon: "❌",
    description: "Staff member wants to avoid specific shifts on certain days",
    supportsExceptions: false,
  },
  {
    id: "required_off",
    label: "Required Off",
    icon: "🏠",
    description: "Staff member must be off on specific days",
    supportsExceptions: false,
  },
  {
    id: "avoid_shift_with_exceptions",
    label: "Avoid Shift (with Exceptions)",
    icon: "🚫✅",
    description: "Avoid specific shift but allow certain exceptions",
    helpText: "Example: Avoid off days (×) but allow early shifts (△) on weekends",
    supportsExceptions: true,
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

  // ✅ FIX: Local state to store incomplete rules that haven't been synced yet
  // MUST be declared BEFORE priorityRules memo that uses it
  const [localIncompleteRules, setLocalIncompleteRules] = useState([]);

  // Fix: Memoize derived arrays to prevent unnecessary re-renders
  // Transform WebSocket multi-table format to localStorage-compatible format
  const priorityRules = useMemo(() => {
    const rules = settings?.priorityRules || [];
    // Ensure all rules have required properties (WebSocket multi-table backend compatibility)
    // Handle legacy object format - convert to array if needed
    const rulesArray = Array.isArray(rules) ? rules : [];

    const mappedRules = rulesArray.map((rule) => ({
      ...rule,
      // Extract properties from ruleConfig if stored there (multi-table backend)
      // ✅ FIX: Also check ruleDefinition.conditions for database seed format
      // Otherwise use properties directly, or default to safe values
      daysOfWeek: rule.daysOfWeek || rule.ruleDefinition?.conditions?.day_of_week || rule.ruleDefinition?.daysOfWeek || rule.ruleConfig?.daysOfWeek || [],
      targetIds: rule.targetIds || rule.ruleConfig?.targetIds || [],
      shiftType: rule.shiftType || rule.ruleDefinition?.conditions?.shift_type || rule.ruleDefinition?.shiftType || rule.ruleConfig?.shiftType || "early",
      ruleType: rule.ruleType || rule.ruleDefinition?.type || rule.ruleDefinition?.ruleType || rule.ruleConfig?.ruleType || "preferred_shift",
      // ✅ NEW: Support allowedShifts for avoid_shift_with_exceptions rule type
      allowedShifts: rule.allowedShifts || rule.ruleDefinition?.allowedShifts || rule.ruleConfig?.allowedShifts || [],
      // ✅ Support both single staffId (legacy) and staffIds array (new)
      staffIds: rule.staffIds || rule.ruleDefinition?.staff_ids || (rule.staffId || rule.ruleDefinition?.staff_id ? [rule.staffId || rule.ruleDefinition?.staff_id] : []),
      // Keep legacy staffId for backward compatibility (will be undefined if using staffIds)
      staffId: rule.staffIds ? undefined : (rule.staffId || rule.ruleDefinition?.staff_id || ""),
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

    // ✅ FIX: Filter out soft-deleted rules for display (UI layer filtering)
    // Keep soft-deleted in settings state but hide from UI
    const activeRules = mappedRules.filter(rule => rule.isActive !== false && rule.is_active !== false);

    // ✅ FIX: Merge complete rules from server with incomplete local-only rules
    return [...activeRules, ...localIncompleteRules];
  }, [settings?.priorityRules, localIncompleteRules]);

  // Memoize conflict detection to prevent recalculation (Phase 4.2)
  const detectRuleConflicts = useCallback(
    (rules) => {
      const conflicts = [];

      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
          const rule1 = rules[i];
          const rule2 = rules[j];

          // Check if rules apply to same staff and have conflicting requirements
          // ✅ Support both single staffId and staffIds array
          const staff1 = rule1.staffIds || (rule1.staffId ? [rule1.staffId] : []);
          const staff2 = rule2.staffIds || (rule2.staffId ? [rule2.staffId] : []);
          const hasCommonStaff = staff1.some(id => staff2.includes(id));

          if (hasCommonStaff) {
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

      // ✅ NEW FIX: Separate incomplete and complete rules
      const incompleteRules = [];
      const completeRules = [];

      newRules.forEach((rule) => {
        // ✅ FIX: A rule is complete only if it has both days AND staff members selected
        const hasDays = rule.daysOfWeek && rule.daysOfWeek.length > 0;
        const staffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
        const hasStaff = staffIds.length > 0;
        const isComplete = hasDays && hasStaff;

        if (!isComplete && rule._isLocalOnly) {
          const missingParts = [];
          if (!hasDays) missingParts.push('days');
          if (!hasStaff) missingParts.push('staff members');
          console.log(`⏸️ Skipping incomplete rule "${rule.name}" (missing: ${missingParts.join(', ')}) - keeping in UI only`);
          incompleteRules.push(rule);
        } else {
          completeRules.push(rule);
        }
      });

      // Store incomplete rules in local state (UI only)
      setLocalIncompleteRules(incompleteRules);

      // ✅ Use functional update to get latest settings without adding to dependencies
      // Only sync complete rules to server/database
      updateSettings((prevSettings) => ({
        ...prevSettings,
        priorityRules: completeRules,
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
      if (!bufferedUpdates) {
        console.log(`⚠️ [syncRuleToServer] No buffered updates for rule ${ruleId}`);
        return;
      }

      console.log(
        `🔄 [DEBOUNCE] Syncing buffered updates for rule ${ruleId}:`,
        bufferedUpdates,
      );

      const updatedRules = priorityRulesRef.current.map((rule) => {
        if (rule.id === ruleId) {
          const merged = { ...rule, ...bufferedUpdates };
          console.log(`🔍 [syncRuleToServer] Merged rule:`, merged);
          console.log(`🔍 [syncRuleToServer] staffIds in merged:`, merged.staffIds);
          return merged;
        }
        return rule;
      });

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
      // ✅ FIX: If canceling an incomplete rule, remove it entirely
      if (originalRuleData._isLocalOnly && (!originalRuleData.daysOfWeek || originalRuleData.daysOfWeek.length === 0)) {
        const updatedRules = priorityRules.filter((rule) => rule.id !== editingRule);
        updatePriorityRules(updatedRules);
        setLocalIncompleteRules(prev => prev.filter(r => r.id !== editingRule));
      } else {
        // Otherwise, restore original data
        const updatedRules = priorityRules.map((rule) =>
          rule.id === editingRule ? originalRuleData : rule,
        );
        updatePriorityRules(updatedRules);
      }
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

    console.log(`✅ Creating new priority rule skeleton (local UI only, not synced to server yet)`);

    const newRule = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      ruleType: "preferred_shift",
      staffIds: [], // Empty array for multiple staff members
      shiftType: "early",
      allowedShifts: [], // ✅ NEW: Exception shifts for avoid_shift_with_exceptions
      daysOfWeek: [], // ⚠️ Empty - rule is incomplete, will NOT be synced to server
      // Set high priority defaults (hidden from UI)
      priorityLevel: 4, // High Priority
      preferenceStrength: 1.0, // Strong
      isHardConstraint: true, // Hard constraint
      penaltyWeight: 100, // High penalty weight
      effectiveFrom: null, // Always active
      effectiveUntil: null, // Always active
      isActive: true,
      _isLocalOnly: true, // ✅ NEW: Flag to prevent server sync until completed
    };

    // ✅ FIX: Set editing state FIRST to ensure it's not lost during re-render
    setOriginalRuleData({ ...newRule });
    setEditingRule(newRule.id);

    // ✅ FIX: Do NOT sync to server yet - keep in UI local state only
    // Server sync will happen when user completes the rule (adds at least one day)
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

      // ✅ FIX: Also remove from local incomplete rules if it exists there
      setLocalIncompleteRules(prev => prev.filter(r => r.id !== id));

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
      // ✅ FIX: Initialize edit buffer with current rule data to prevent input lag
      setEditBuffer((prev) => ({
        ...prev,
        [ruleId]: {
          name: rule.name,
          description: rule.description || "",
        },
      }));
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

    // ✅ FIX: Update rule immediately (no debouncing for day selection)
    // Day selection needs to be immediate to keep edit mode stable
    const updates = { ...rule, daysOfWeek: updatedDays };

    if (updatedDays.length > 0 && rule._isLocalOnly) {
      console.log(`✅ Rule "${rule.name}" is now complete (has days selected) - will sync to server`);
      updates._isLocalOnly = undefined; // Remove the flag to allow server sync
    }

    // Update immediately using updatePriorityRules (not debounced updateRule)
    const updatedRules = priorityRules.map((r) =>
      r.id === ruleId ? updates : r
    );
    updatePriorityRules(updatedRules);
  };

  // Helper functions for multiple staff members
  const addStaffMember = useCallback((ruleId, staffId) => {
    const rule = priorityRules.find(r => r.id === ruleId);
    if (!rule) return;

    // Get current staff IDs (support both single staffId and staffIds array)
    const currentStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);

    // Don't add if already in the list
    if (currentStaffIds.includes(staffId)) return;

    const updatedStaffIds = [...currentStaffIds, staffId];

    // ✅ FIX: Update edit buffer so changes are included in save
    // This ensures staffIds changes are captured when user clicks "Save"
    setEditBuffer((prev) => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] || {}), staffIds: updatedStaffIds },
    }));

    // Update rule with new staff member
    const updatedRules = priorityRules.map(r =>
      r.id === ruleId ? { ...r, staffIds: updatedStaffIds, staffId: undefined } : r
    );
    updatePriorityRules(updatedRules);

    console.log(`✅ Added staff member to rule "${rule.name}": ${staffId}`);
    console.log(`🔍 [addStaffMember] Updated staffIds:`, updatedStaffIds);
    console.log(`🔍 [addStaffMember] Edit buffer now:`, { [ruleId]: { staffIds: updatedStaffIds } });
  }, [priorityRules, updatePriorityRules]);

  const removeStaffMember = useCallback((ruleId, staffId) => {
    const rule = priorityRules.find(r => r.id === ruleId);
    if (!rule) return;

    const currentStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
    const updatedStaffIds = currentStaffIds.filter(id => id !== staffId);

    // ✅ FIX: Update edit buffer so changes are included in save
    setEditBuffer((prev) => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] || {}), staffIds: updatedStaffIds },
    }));

    const updatedRules = priorityRules.map(r =>
      r.id === ruleId ? { ...r, staffIds: updatedStaffIds, staffId: undefined } : r
    );
    updatePriorityRules(updatedRules);

    console.log(`✅ Removed staff member from rule "${rule.name}": ${staffId}`);
  }, [priorityRules, updatePriorityRules]);

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
    // ✅ FIX: Get ALL staff members for this rule (not just first one)
    const ruleStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
    const ruleStaff = ruleStaffIds.map(id => getStaffById(id)).filter(Boolean);
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
                    placeholder="e.g., Weekend Early Shifts for Chef Team"
                    className="text-lg font-semibold bg-transparent border-b-2 border-purple-500 focus:outline-none w-full placeholder:text-gray-400 placeholder:font-normal"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Give this rule a descriptive name (e.g., "Monday Off Days", "Weekend Late Shifts")
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
                {/* ✅ FIX: Show ALL staff members, not just first one */}
                {ruleStaff.length > 0 ? (
                  ruleStaff.length === 1 ? (
                    ruleStaff[0].name
                  ) : (
                    `${ruleStaff.length} staff members`
                  )
                ) : (
                  <span className="text-red-600">No staff assigned</span>
                )} • {ruleType?.label}
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
            <FormField label="Staff Members">
              <div className="space-y-3">
                {/* List of selected staff members */}
                {(() => {
                  const currentStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
                  return currentStaffIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {currentStaffIds.map((staffId) => {
                        const staff = staffMembers.find(s => s.id === staffId);
                        if (!staff) return null;
                        return (
                          <div
                            key={staffId}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg"
                          >
                            <User size={14} />
                            <span className="text-sm font-medium">{staff.name}</span>
                            <button
                              onClick={() => removeStaffMember(rule.id, staffId)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remove staff member"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Add staff member dropdown */}
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addStaffMember(rule.id, e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select staff member...</option>
                    {(() => {
                      const currentStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
                      return staffMembers
                        .filter(staff => !currentStaffIds.includes(staff.id))
                        .map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ));
                    })()}
                  </select>
                  <button
                    onClick={() => {
                      // Focus the select element
                      const selectElement = document.querySelector(`select[value=""]`);
                      if (selectElement) selectElement.focus();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Add staff member"
                  >
                    <Plus size={16} />
                    Add Staff
                  </button>
                </div>
                {(() => {
                  const currentStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
                  return currentStaffIds.length === 0 ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      At least one staff member must be selected (rule will not be saved until staff is added)
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Add multiple staff members to apply this rule to all of them
                    </p>
                  );
                })()}
              </div>
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

            {/* ✅ NEW: Exception Shift Selector (only for avoid_shift_with_exceptions) */}
            {rule.ruleType === "avoid_shift_with_exceptions" && (
              <FormField label="Allowed Exceptions (Optional)">
                <p className="text-sm text-gray-600 mb-3">
                  Select shifts that ARE allowed on these days (despite avoidance rule)
                </p>
                <div className="flex flex-wrap gap-2">
                  {SHIFT_TYPES.filter((shift) => shift.id !== rule.shiftType).map((shift) => {
                    const isAllowed = (rule.allowedShifts || []).includes(shift.id);
                    return (
                      <button
                        key={shift.id}
                        onClick={() => {
                          const currentAllowed = rule.allowedShifts || [];
                          const updatedAllowed = isAllowed
                            ? currentAllowed.filter((id) => id !== shift.id)
                            : [...currentAllowed, shift.id];
                          updateRule(rule.id, { allowedShifts: updatedAllowed });
                        }}
                        className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg transition-all ${
                          isAllowed
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        }`}
                      >
                        <span className="text-lg">{shift.icon}</span>
                        <span className="text-sm font-medium">{shift.label}</span>
                        {isAllowed && <Check size={16} className="text-green-600" />}
                      </button>
                    );
                  })}
                </div>
                {(!rule.allowedShifts || rule.allowedShifts.length === 0) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                    <AlertTriangle size={12} />
                    No exceptions selected - rule will behave like "Avoid Shift"
                  </p>
                )}
              </FormField>
            )}

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

            {/* ✅ NEW: Exception Shifts Display (for avoid_shift_with_exceptions) */}
            {rule.ruleType === "avoid_shift_with_exceptions" &&
              Array.isArray(rule.allowedShifts) &&
              rule.allowedShifts.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs font-medium">
                    Exceptions:
                  </span>
                  <div className="flex gap-1">
                    {rule.allowedShifts.map((shiftId) => {
                      const shift = SHIFT_TYPES.find((s) => s.id === shiftId);
                      return (
                        <span
                          key={shiftId}
                          className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1"
                          title={`${shift?.label} is allowed as exception`}
                        >
                          <span>{shift?.icon}</span>
                          <span>{shift?.label}</span>
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
