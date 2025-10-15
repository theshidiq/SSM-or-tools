import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Edit2,
  Clock,
  Check,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../../../contexts/SettingsContext";
import FormField from "../shared/FormField";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";
import Slider from "../shared/Slider";
import ConfirmationModal from "../shared/ConfirmationModal";
import ConflictsModal from "../shared/ConflictsModal";
import { useScheduleValidation } from "../../../hooks/useScheduleValidation";

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
  { id: "staff_status", label: "Staff Status" },
  { id: "individual", label: "Individual" },
];

const DailyLimitsTab = ({
  staffMembers = [],
  validationErrors = {},
  currentScheduleId = null, // Phase 2: Schedule ID for validation
}) => {
  // Phase 4.3: Get settings from Context instead of props
  const { settings, updateSettings } = useSettings();

  const [editingLimit, setEditingLimit] = useState(null);
  const [originalLimitData, setOriginalLimitData] = useState(null);
  const [editingMonthlyLimit, setEditingMonthlyLimit] = useState(null);
  const [originalMonthlyLimitData, setOriginalMonthlyLimitData] =
    useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'daily'|'monthly', id, name }
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Phase 2: Validation state
  const [validationViolations, setValidationViolations] = useState([]);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [pendingValidationErrors, setPendingValidationErrors] = useState([]); // Show validation errors in UI

  // Schedule validation hook
  const { validateDailyLimits } = useScheduleValidation(currentScheduleId);

  // Phase 4.3: Add refs for stable references (prevent infinite loops)
  const settingsRef = useRef(settings);
  const updateSettingsRef = useRef(updateSettings);

  // Update refs when context values change
  useEffect(() => {
    settingsRef.current = settings;
    updateSettingsRef.current = updateSettings;
  }, [settings, updateSettings]);

  // Get limits directly from settings (no transformation needed)
  const dailyLimits = useMemo(() => {
    return settings?.dailyLimits || [];
  }, [settings?.dailyLimits]);

  const monthlyLimits = useMemo(() => {
    return settings?.monthlyLimits || [];
  }, [settings?.monthlyLimits]);

  // Add escape key listener to exit edit mode
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editingLimit) {
          handleCancelDailyEdit();
        } else if (editingMonthlyLimit) {
          handleCancelMonthlyEdit();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingLimit, editingMonthlyLimit]);

  // Phase 4.3: Wrap updateDailyLimits with refs (prevent infinite loops)
  const updateDailyLimits = useCallback(
    async (newLimits, skipValidation = false) => {
      try {
        // ✅ STEP 1: Validate FIRST (before saving)
        if (!skipValidation && currentScheduleId) {
          setIsValidating(true);
          try {
            const violations = await validateDailyLimits(
              newLimits,
              staffMembers,
            );
            setIsValidating(false);

            if (violations.length > 0) {
              // ❌ Validation failed - DON'T save
              console.error(
                "❌ Daily limits validation failed:",
                violations.length,
                "violations detected",
              );

              // Store violations for UI display
              setPendingValidationErrors(violations);
              setValidationViolations(violations);

              // Show error toast
              toast.error(
                `Validation failed: ${violations.length} issue${violations.length !== 1 ? "s" : ""} found`,
                {
                  description: "Current schedule exceeds new daily limits. Please fix violations first.",
                  action: {
                    label: "View Details",
                    onClick: () => {
                      setShowViolationsModal(true);
                    },
                  },
                  duration: 8000,
                },
              );

              return; // ❌ Exit without saving
            }

            // ✅ Validation passed - clear any previous errors
            setPendingValidationErrors([]);
          } catch (validationError) {
            setIsValidating(false);
            console.error(
              "❌ Daily limits validation error:",
              validationError,
            );
            toast.error(`Validation error: ${validationError.message}`);
            return; // ❌ Exit without saving
          }
        }

        // ✅ STEP 2: Save ONLY if validation passed
        updateSettingsRef.current({
          ...settingsRef.current,
          dailyLimits: newLimits,
        });

        // ✅ Success feedback
        toast.success("Daily limits updated successfully");
        console.log("✅ Daily limits updated successfully");
      } catch (error) {
        console.error("Error updating daily limits:", error);
        toast.error(`Failed to update daily limits: ${error.message}`);
        throw error;
      }
    },
    [currentScheduleId, validateDailyLimits, staffMembers],
  );

  // Phase 4.3: Wrap updateMonthlyLimits with useCallback and refs
  const updateMonthlyLimits = useCallback((newLimits) => {
    updateSettingsRef.current({
      ...settingsRef.current,
      monthlyLimits: newLimits,
    });
  }, []);

  // Daily Limits Edit Management
  const startEditingDailyLimit = (limitId) => {
    const limit = dailyLimits.find((l) => l.id === limitId);
    if (limit) {
      setOriginalLimitData({ ...limit });
      setEditingLimit(limitId);
    }
  };

  const handleSaveDailyEdit = () => {
    setEditingLimit(null);
    setOriginalLimitData(null);
    // Clear validation errors on successful save
    setPendingValidationErrors([]);
  };

  const handleCancelDailyEdit = () => {
    if (originalLimitData && editingLimit) {
      const updatedLimits = dailyLimits.map((limit) =>
        limit.id === editingLimit ? originalLimitData : limit,
      );
      // Skip validation when canceling (restoring original data)
      updateDailyLimits(updatedLimits, true);
    }
    setEditingLimit(null);
    setOriginalLimitData(null);
    // Clear validation errors on cancel
    setPendingValidationErrors([]);
  };

  // Monthly Limits Edit Management
  const startEditingMonthlyLimit = (limitId) => {
    const limit = monthlyLimits.find((l) => l.id === limitId);
    if (limit) {
      setOriginalMonthlyLimitData({ ...limit });
      setEditingMonthlyLimit(limitId);
    }
  };

  const handleSaveMonthlyEdit = () => {
    setEditingMonthlyLimit(null);
    setOriginalMonthlyLimitData(null);
  };

  const handleCancelMonthlyEdit = () => {
    if (originalMonthlyLimitData && editingMonthlyLimit) {
      const updatedLimits = monthlyLimits.map((limit) =>
        limit.id === editingMonthlyLimit ? originalMonthlyLimitData : limit,
      );
      updateMonthlyLimits(updatedLimits);
    }
    setEditingMonthlyLimit(null);
    setOriginalMonthlyLimitData(null);
  };

  const createNewDailyLimit = () => {
    const newLimit = {
      id: `daily-limit-${Date.now()}`,
      name: "New Daily Limit",
      limitConfig: {
        shiftType: "any",
        maxCount: 3,
        daysOfWeek: DAYS_OF_WEEK.map((d) => d.id), // All days by default
        scope: "all",
        targetIds: [],
      },
      isHardConstraint: true,
      penaltyWeight: 10,
      description: "",
    };
    setOriginalLimitData({ ...newLimit });
    setEditingLimit(newLimit.id);
    // Skip validation when creating new limit (default values are safe)
    updateDailyLimits([...dailyLimits, newLimit], true);
    setShowAddForm(false);
  };

  const createNewMonthlyLimit = () => {
    const newLimit = {
      id: `monthly-limit-${Date.now()}`,
      name: "New Monthly Limit",
      limitConfig: {
        limitType: "max_off_days",
        maxCount: 8,
        scope: "individual",
        targetIds: [],
        distributionRules: {
          maxConsecutive: 2,
          preferWeekends: false,
        },
      },
      isHardConstraint: false,
      penaltyWeight: 5,
      description: "",
    };
    setOriginalMonthlyLimitData({ ...newLimit });
    setEditingMonthlyLimit(newLimit.id);
    const updatedLimits = [...monthlyLimits, newLimit];
    updateMonthlyLimits(updatedLimits);
  };

  const updateDailyLimit = (limitId, updates) => {
    const updatedLimits = dailyLimits.map((limit) =>
      limit.id === limitId ? { ...limit, ...updates } : limit,
    );
    updateDailyLimits(updatedLimits);
  };

  const updateMonthlyLimit = (limitId, updates) => {
    const updatedLimits = monthlyLimits.map((limit) =>
      limit.id === limitId ? { ...limit, ...updates } : limit,
    );
    updateMonthlyLimits(updatedLimits);
  };

  const deleteDailyLimit = (limitId) => {
    const limit = dailyLimits.find((l) => l.id === limitId);
    if (limit) {
      setDeleteConfirmation({ type: "daily", id: limitId, name: limit.name });
    }
  };

  const deleteMonthlyLimit = (limitId) => {
    const limit = monthlyLimits.find((l) => l.id === limitId);
    if (limit) {
      setDeleteConfirmation({ type: "monthly", id: limitId, name: limit.name });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);
    try {
      const { type, id } = deleteConfirmation;

      if (type === "daily") {
        const updatedLimits = dailyLimits.filter((limit) => limit.id !== id);
        updateDailyLimits(updatedLimits);
      } else if (type === "monthly") {
        const updatedLimits = monthlyLimits.filter((limit) => limit.id !== id);
        updateMonthlyLimits(updatedLimits);
      }

      setDeleteConfirmation(null);
    } catch (error) {
      console.error("Error deleting limit:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
  };

  const toggleDayOfWeek = (limitId, dayId) => {
    const limit = dailyLimits.find((l) => l.id === limitId);
    if (!limit || !limit.limitConfig) return;

    const currentDays = limit.limitConfig.daysOfWeek || [];
    const updatedDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId];

    updateDailyLimit(limitId, {
      limitConfig: {
        ...limit.limitConfig,
        daysOfWeek: updatedDays,
      },
    });
  };

  // Get active staff members (filter out those with endPeriod in the past)
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

  const getTargetOptions = (scope) => {
    switch (scope) {
      case "staff_status":
        const activeStaffForStatus = getActiveStaffMembers();
        const statuses = [
          ...new Set(activeStaffForStatus.map((s) => s.status).filter(Boolean)),
        ];
        return statuses.map((status) => ({ id: status, label: status }));
      case "individual":
        const activeStaffForIndividual = getActiveStaffMembers();
        return activeStaffForIndividual.map((staff) => ({
          id: staff.id,
          label: staff.name,
        }));
      default:
        return [];
    }
  };

  const renderDaySelector = (limit) => {
    const daysOfWeek = limit.limitConfig?.daysOfWeek || [];

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Days of Week
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.id}
              onClick={() => toggleDayOfWeek(limit.id, day.id)}
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
        <p className="text-xs text-gray-500">
          Selected days:{" "}
          {daysOfWeek.length === 7 ? "All days" : `${daysOfWeek.length} days`}
        </p>
      </div>
    );
  };

  const renderTargetSelector = (limit, isMonthly = false) => {
    const scope = limit.limitConfig?.scope || "all";
    if (scope === "all") return null;

    const options = getTargetOptions(scope);
    const updateFunc = isMonthly ? updateMonthlyLimit : updateDailyLimit;
    const targetIds = limit.limitConfig?.targetIds || [];

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {scope === "staff_status" ? "Staff Status" : "Staff Members"}
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={targetIds.includes(option.id)}
                onChange={(e) => {
                  const updatedTargets = e.target.checked
                    ? [...targetIds, option.id]
                    : targetIds.filter((id) => id !== option.id);
                  updateFunc(limit.id, {
                    limitConfig: {
                      ...limit.limitConfig,
                      targetIds: updatedTargets,
                    },
                  });
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
        {targetIds.length === 0 && (
          <p className="text-xs text-red-600">
            At least one target must be selected
          </p>
        )}
      </div>
    );
  };

  // Helper function to get target display text
  const getTargetDisplayText = (limit) => {
    const scope = limit.limitConfig?.scope || "all";
    if (scope === "all") return "";

    const targetIds = limit.limitConfig?.targetIds || [];

    if (scope === "individual") {
      const selectedStaff = staffMembers.filter((staff) =>
        targetIds.includes(staff.id),
      );
      return selectedStaff.length > 0
        ? selectedStaff.map((staff) => staff.name).join(", ")
        : "No staff selected";
    }
    if (scope === "staff_status") {
      return targetIds.length > 0 ? targetIds.join(", ") : "No status selected";
    }
    return scope;
  };

  const renderDailyLimitCard = (limit) => {
    const isEditing = editingLimit === limit.id;
    const shiftType = SHIFT_TYPES.find(
      (st) => st.id === (limit.limitConfig?.shiftType || "any"),
    );
    const targetDisplayText = getTargetDisplayText(limit);

    return (
      <div
        key={limit.id}
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
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
                  onChange={(e) =>
                    updateDailyLimit(limit.id, { name: e.target.value })
                  }
                  className="text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h3 className="text-lg font-semibold text-gray-800">
                  {limit.name}
                </h3>
              )}
              <p className="text-sm text-gray-600">
                {shiftType?.label} • Max {limit.limitConfig?.maxCount || 0} per
                day
                {limit.limitConfig?.scope !== "all" &&
                  targetDisplayText &&
                  ` • ${targetDisplayText}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveDailyEdit}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Save changes"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleCancelDailyEdit}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cancel changes"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditingDailyLimit(limit.id)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => deleteDailyLimit(limit.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="space-y-4">
            {/* Description */}
            <FormField label="Description">
              <textarea
                value={limit.description || ""}
                onChange={(e) =>
                  updateDailyLimit(limit.id, { description: e.target.value })
                }
                placeholder="Describe this limit rule..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </FormField>

            {/* Shift Type */}
            <FormField label="Shift Type">
              <select
                value={limit.limitConfig?.shiftType || "any"}
                onChange={(e) =>
                  updateDailyLimit(limit.id, {
                    limitConfig: {
                      ...limit.limitConfig,
                      shiftType: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SHIFT_TYPES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.icon} {st.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Max Count */}
            <NumberInput
              label="Maximum Count"
              value={limit.limitConfig?.maxCount || 0}
              min={0}
              max={20}
              onChange={(value) =>
                updateDailyLimit(limit.id, {
                  limitConfig: {
                    ...limit.limitConfig,
                    maxCount: value,
                  },
                })
              }
              description="Maximum number of this shift type allowed per day"
            />

            {/* Days of Week */}
            {renderDaySelector(limit)}

            {/* Scope */}
            <FormField label="Apply To">
              <select
                value={limit.limitConfig?.scope || "all"}
                onChange={(e) =>
                  updateDailyLimit(limit.id, {
                    limitConfig: {
                      ...limit.limitConfig,
                      scope: e.target.value,
                      targetIds: [], // Reset targets when scope changes
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LIMIT_SCOPES.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.label}
                  </option>
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
                onChange={(checked) =>
                  updateDailyLimit(limit.id, { isHardConstraint: checked })
                }
              />
            </div>

            {/* Penalty Weight */}
            <Slider
              label="Penalty Weight"
              value={limit.penaltyWeight}
              min={1}
              max={100}
              onChange={(value) =>
                updateDailyLimit(limit.id, { penaltyWeight: value })
              }
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
              {(limit.limitConfig?.daysOfWeek || []).length === 7
                ? "All days"
                : `${(limit.limitConfig?.daysOfWeek || []).length} days`}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs ${
                limit.isHardConstraint
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {limit.isHardConstraint ? "Hard" : "Soft"}
            </span>
            <span>Weight: {limit.penaltyWeight}</span>
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyLimitCard = (limit) => {
    const isEditing = editingMonthlyLimit === limit.id;
    const targetDisplayText = getTargetDisplayText(limit);

    const MONTHLY_LIMIT_TYPES = [
      { id: "max_off_days", label: "Max Off Days" },
      { id: "max_work_days", label: "Max Work Days" },
      { id: "max_early_shifts", label: "Max Early Shifts" },
      { id: "max_late_shifts", label: "Max Late Shifts" },
      { id: "min_off_days", label: "Min Off Days" },
    ];

    return (
      <div
        key={limit.id}
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar size={20} className="text-green-600" />
            </div>
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={limit.name}
                  onChange={(e) =>
                    updateMonthlyLimit(limit.id, { name: e.target.value })
                  }
                  className="text-lg font-semibold bg-transparent border-b-2 border-green-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h3 className="text-lg font-semibold text-gray-800">
                  {limit.name}
                </h3>
              )}
              <p className="text-sm text-gray-600">
                {(limit.limitConfig?.limitType || "max_off_days").replace(
                  /_/g,
                  " ",
                )}{" "}
                • Max{" "}
                {(limit.limitConfig?.maxCount || 0) % 1 === 0
                  ? Math.floor(limit.limitConfig?.maxCount || 0)
                  : limit.limitConfig?.maxCount || 0}{" "}
                per month
                {limit.limitConfig?.scope !== "all" &&
                  targetDisplayText &&
                  ` • ${targetDisplayText}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveMonthlyEdit}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Save changes"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleCancelMonthlyEdit}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cancel changes"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditingMonthlyLimit(limit.id)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => deleteMonthlyLimit(limit.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="space-y-4 mb-4">
            {/* Description */}
            <FormField label="Description">
              <textarea
                value={limit.description || ""}
                onChange={(e) =>
                  updateMonthlyLimit(limit.id, { description: e.target.value })
                }
                placeholder="Describe this monthly limit rule..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </FormField>

            {/* Limit Type */}
            <FormField label="Limit Type">
              <select
                value={limit.limitConfig?.limitType || "max_off_days"}
                onChange={(e) =>
                  updateMonthlyLimit(limit.id, {
                    limitConfig: {
                      ...limit.limitConfig,
                      limitType: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {MONTHLY_LIMIT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Max Count */}
            <NumberInput
              label="Count"
              value={limit.limitConfig?.maxCount || 0}
              min={0}
              max={31}
              step={
                limit.limitConfig?.limitType === "max_off_days" ? 0.5 : 1
              }
              onChange={(value) =>
                updateMonthlyLimit(limit.id, {
                  limitConfig: {
                    ...limit.limitConfig,
                    maxCount: value,
                  },
                })
              }
              description={
                limit.limitConfig?.limitType === "max_off_days"
                  ? "Maximum count for this limit type per month (supports half-days: 6.5, 7, 7.5, etc.)"
                  : "Maximum count for this limit type per month"
              }
            />

            {/* Scope */}
            <FormField label="Apply To">
              <select
                value={limit.limitConfig?.scope || "all"}
                onChange={(e) =>
                  updateMonthlyLimit(limit.id, {
                    limitConfig: {
                      ...limit.limitConfig,
                      scope: e.target.value,
                      targetIds: [], // Reset targets when scope changes
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LIMIT_SCOPES.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Target Selector */}
            {renderTargetSelector(limit, true)}

            {/* Constraint Settings */}
            <div className="flex items-center justify-between">
              <ToggleSwitch
                label="Hard Constraint"
                description="Cannot be violated vs. soft preference"
                checked={limit.isHardConstraint}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { isHardConstraint: checked })
                }
              />
            </div>

            {/* Penalty Weight */}
            <Slider
              label="Penalty Weight"
              value={limit.penaltyWeight}
              min={1}
              max={100}
              onChange={(value) =>
                updateMonthlyLimit(limit.id, { penaltyWeight: value })
              }
              description="Higher values make this constraint more important"
              colorScheme={limit.isHardConstraint ? "red" : "orange"}
            />
          </div>
        )}

        {!isEditing && limit.description && (
          <p className="text-sm text-gray-600 mb-4">{limit.description}</p>
        )}

        {/* Distribution Rules */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800">Distribution Rules</h4>

          <div className="mb-4">
            <NumberInput
              label="Max Consecutive"
              value={
                limit.limitConfig?.distributionRules?.maxConsecutive || 2
              }
              min={1}
              max={7}
              onChange={(value) =>
                updateMonthlyLimit(limit.id, {
                  limitConfig: {
                    ...limit.limitConfig,
                    distributionRules: {
                      ...limit.limitConfig?.distributionRules,
                      maxConsecutive: value,
                    },
                  },
                })
              }
              size="small"
              disabled={!isEditing}
              description="Maximum consecutive days for this limit type"
            />
          </div>

          <ToggleSwitch
            label="Prefer Weekends"
            checked={
              limit.limitConfig?.distributionRules?.preferWeekends || false
            }
            onChange={(checked) =>
              updateMonthlyLimit(limit.id, {
                limitConfig: {
                  ...limit.limitConfig,
                  distributionRules: {
                    ...limit.limitConfig?.distributionRules,
                    preferWeekends: checked,
                  },
                },
              })
            }
            size="small"
            disabled={!isEditing}
          />
        </div>

        {!isEditing && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span
              className={`px-2 py-1 rounded text-xs ${
                limit.isHardConstraint
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {limit.isHardConstraint ? "Hard" : "Soft"}
            </span>
            <span>Weight: {limit.penaltyWeight}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Daily & Monthly Limits
          </h2>
          <p className="text-gray-600">
            Configure scheduling limits and constraints for better work-life
            balance.
          </p>
        </div>
      </div>

      {/* Phase 2: Validation Errors from Props */}
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

      {/* Phase 2: Real-time Validation Violations Alert */}
      {pendingValidationErrors.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 shadow-md">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-800 text-lg">
                Cannot Save Daily Limits
              </h3>
              <p className="text-red-700 text-sm mt-1">
                The current schedule violates the new daily limits. Please fix these issues before saving.
              </p>
            </div>
            <button
              onClick={() => setPendingValidationErrors([])}
              className="text-red-600 hover:text-red-800 flex-shrink-0"
              title="Dismiss"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="ml-9">
            <p className="font-semibold text-red-800 mb-2">
              {pendingValidationErrors.length} Violation{pendingValidationErrors.length !== 1 ? "s" : ""} Detected:
            </p>
            <ul className="list-disc list-inside text-red-700 text-sm space-y-1.5 max-h-40 overflow-y-auto">
              {pendingValidationErrors.slice(0, 8).map((violation, idx) => (
                <li key={idx} className="leading-relaxed">{violation}</li>
              ))}
            </ul>
            {pendingValidationErrors.length > 8 && (
              <p className="text-sm text-red-600 mt-2 font-medium">
                ...and {pendingValidationErrors.length - 8} more violation{pendingValidationErrors.length - 8 !== 1 ? "s" : ""}
              </p>
            )}
            <button
              onClick={() => setShowViolationsModal(true)}
              className="mt-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
            >
              View All Violations
            </button>
          </div>
        </div>
      )}

      {/* Daily Limits Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">
              Daily Limits
            </h3>
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
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No Daily Limits
            </h3>
            <p className="text-gray-600 mb-4">
              Create daily limits to control how many staff can have the same
              shift type per day.
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
            <h3 className="text-xl font-semibold text-gray-800">
              Monthly Limits
            </h3>
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
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No Monthly Limits
            </h3>
            <p className="text-gray-600 mb-4">
              Create monthly limits to ensure fair distribution of off days and
              shift patterns.
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation !== null}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteConfirmation?.type === "daily" ? "Daily" : "Monthly"} Limit`}
        message={`Are you sure you want to delete the ${deleteConfirmation?.type} limit "${deleteConfirmation?.name}"? This action cannot be undone.`}
        confirmText={`Delete ${deleteConfirmation?.type === "daily" ? "Daily" : "Monthly"} Limit`}
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Phase 2: Validation Violations Modal */}
      <ConflictsModal
        isOpen={showViolationsModal}
        onClose={() => setShowViolationsModal(false)}
        conflicts={validationViolations}
        type="daily_limits"
        staffMembers={staffMembers}
        title="Daily Limit Violations Detected"
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

export default DailyLimitsTab;
