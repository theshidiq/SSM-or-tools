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
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "../../../contexts/SettingsContext";
import FormField from "../shared/FormField";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";
import Slider from "../shared/Slider";
import ConfirmationModal from "../shared/ConfirmationModal";
import ConflictsModal from "../shared/ConflictsModal";
import { useScheduleValidation } from "../../../hooks/useScheduleValidation";
import { PREFETCH_QUERY_KEYS } from "../../../hooks/useScheduleDataPrefetch";

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

/**
 * Staff Type Limits Section - Configure per-staff-type daily limits
 * Business Logic:
 * - For 社員 (n=6), max 1 off per day ensures adequate coverage
 * - Allows combinations like: (1 off + 1 early) or (0 off + 2 early)
 * - Prevents scenarios like: (2 off + 0 early) which reduces coverage too much
 */
const StaffTypeLimitsSection = ({
  staffTypeLimits,
  staffMembers,
  onUpdate,
}) => {
  const [localLimits, setLocalLimits] = useState(staffTypeLimits || {});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get unique staff types from staff members
  const staffTypes = useMemo(() => {
    const types = new Set();
    staffMembers.forEach((staff) => {
      if (staff.status) {
        types.add(staff.status);
      }
    });
    return Array.from(types);
  }, [staffMembers]);

  // Count staff by type
  const staffCountByType = useMemo(() => {
    const counts = {};
    staffMembers.forEach((staff) => {
      if (staff.status) {
        counts[staff.status] = (counts[staff.status] || 0) + 1;
      }
    });
    return counts;
  }, [staffMembers]);

  // Staff type color mapping
  const staffTypeColors = {
    "社員": { bg: "from-blue-50 to-blue-100", border: "border-blue-200", badge: "bg-blue-600", icon: "text-blue-600" },
    "派遣": { bg: "from-green-50 to-green-100", border: "border-green-200", badge: "bg-green-600", icon: "text-green-600" },
    "パート": { bg: "from-purple-50 to-purple-100", border: "border-purple-200", badge: "bg-purple-600", icon: "text-purple-600" },
  };

  const getTypeColors = (type) => staffTypeColors[type] || {
    bg: "from-gray-50 to-gray-100",
    border: "border-gray-200",
    badge: "bg-gray-600",
    icon: "text-gray-600"
  };

  // Update local state when props change
  useEffect(() => {
    if (staffTypeLimits) {
      setLocalLimits(staffTypeLimits);
      setHasChanges(false);
    }
  }, [staffTypeLimits]);

  const handleLimitChange = (staffType, field, value) => {
    const updated = {
      ...localLimits,
      [staffType]: {
        ...localLimits[staffType],
        [field]: value,
      },
    };
    setLocalLimits(updated);
    setHasChanges(true);
  };

  const handleAddStaffType = (staffType) => {
    const updated = {
      ...localLimits,
      [staffType]: {
        maxOff: 1,
        maxEarly: 2,
        isHard: true,
        penaltyWeight: 60,
      },
    };
    setLocalLimits(updated);
    setHasChanges(true);
  };

  const handleRemoveStaffType = (staffType) => {
    const updated = { ...localLimits };
    delete updated[staffType];
    setLocalLimits(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(localLimits);
      setHasChanges(false);
      toast.success("Staff type limits updated successfully");
    } catch (error) {
      console.error("Failed to update staff type limits:", error);
      toast.error("Failed to update staff type limits");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalLimits({});
    setHasChanges(true);
  };

  // Get unconfigured staff types
  const unconfiguredTypes = staffTypes.filter(type => !localLimits[type]);

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
      {/* Header with Action Buttons */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              ST
            </span>
            Staff Type Daily Limits
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure maximum off/early shifts per staff type per day (HARD constraint)
          </p>
        </div>

        {/* Icon Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="p-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All Limits"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`p-2 rounded-lg transition-all ${
              !hasChanges || isSaving
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg"
            }`}
            title={isSaving ? "Saving..." : "Save Changes"}
          >
            {isSaving ? (
              <Clock className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Business Rule Example:</p>
            <p>For 社員 with 6 total staff, setting Max Off = 1 ensures:</p>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li className="text-green-700">1 off + 1 early + 4 normal = OK</li>
              <li className="text-green-700">0 off + 2 early + 4 normal = OK</li>
              <li className="text-red-700">2 off + 0 early + 4 normal = NOT ALLOWED</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Configured Staff Types */}
      <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
        {Object.entries(localLimits).length > 0 ? (
          Object.entries(localLimits).map(([staffType, limits]) => {
            const colors = getTypeColors(staffType);
            const staffCount = staffCountByType[staffType] || 0;

            return (
              <div
                key={staffType}
                className={`p-4 rounded-lg border-2 ${colors.border} bg-gradient-to-br ${colors.bg}`}
              >
                {/* Staff Type Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 ${colors.badge} text-white rounded-full text-sm font-bold`}>
                      {staffType}
                    </span>
                    <span className="text-sm text-gray-600">
                      {staffCount} staff member{staffCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveStaffType(staffType)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove this staff type limit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Limit Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Max Off Per Day */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Maximum Off Per Day
                      <span className="text-red-500 text-xs">(HARD)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={Math.min(staffCount, 4)}
                        step={1}
                        value={limits.maxOff ?? 1}
                        onChange={(e) => handleLimitChange(staffType, "maxOff", parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                      <span className="w-12 text-center px-2 py-1 bg-red-100 text-red-800 rounded-lg font-bold text-lg">
                        {limits.maxOff ?? 1}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Max {limits.maxOff ?? 1} {staffType} can be off (x) on any day
                    </p>
                  </div>

                  {/* Max Early Per Day */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Maximum Early Per Day
                      <span className="text-orange-500 text-xs">(SOFT)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={Math.min(staffCount, 4)}
                        step={1}
                        value={limits.maxEarly ?? 2}
                        onChange={(e) => handleLimitChange(staffType, "maxEarly", parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <span className="w-12 text-center px-2 py-1 bg-orange-100 text-orange-800 rounded-lg font-bold text-lg">
                        {limits.maxEarly ?? 2}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Max {limits.maxEarly ?? 2} {staffType} on early shift (triangle) per day
                    </p>
                  </div>
                </div>

                {/* Hard Constraint Toggle */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Hard Constraint</label>
                    <span className="text-xs text-gray-500">(Cannot be violated)</span>
                  </div>
                  <button
                    onClick={() => handleLimitChange(staffType, "isHard", !limits.isHard)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      limits.isHard ? "bg-red-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        limits.isHard ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">No staff type limits configured</p>
            <p className="text-sm">Click a staff type below to add limits</p>
          </div>
        )}
      </div>

      {/* Add New Staff Type */}
      {unconfiguredTypes.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Add Staff Type Limit:</p>
          <div className="flex flex-wrap gap-2">
            {unconfiguredTypes.map((staffType) => {
              const colors = getTypeColors(staffType);
              const staffCount = staffCountByType[staffType] || 0;

              return (
                <button
                  key={staffType}
                  onClick={() => handleAddStaffType(staffType)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${colors.border} hover:shadow-md transition-all hover:scale-105`}
                >
                  <Plus className={`w-4 h-4 ${colors.icon}`} />
                  <span className={`px-2 py-0.5 ${colors.badge} text-white rounded text-xs font-bold`}>
                    {staffType}
                  </span>
                  <span className="text-xs text-gray-500">({staffCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Daily Limits Section - Configure per-date limits
 */
const DailyLimitsSection = ({
  dailyLimits,
  onUpdate,
  onValidate,
  onShowViolations,
  currentScheduleId,
}) => {
  const [localLimits, setLocalLimits] = useState(dailyLimits || {
    enabled: true, // NEW: Flag to enable/disable daily limits
    minOffPerDay: 0,
    maxOffPerDay: 3,
    minEarlyPerDay: 0,
    maxEarlyPerDay: 2,
    minLatePerDay: 0,
    maxLatePerDay: 3,
    minWorkingStaffPerDay: 3,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when props change
  useEffect(() => {
    if (dailyLimits) {
      setLocalLimits({
        enabled: dailyLimits.enabled ?? true, // NEW: Default to enabled
        minOffPerDay: dailyLimits.minOffPerDay ?? 0,
        maxOffPerDay: dailyLimits.maxOffPerDay ?? 3,
        minEarlyPerDay: dailyLimits.minEarlyPerDay ?? 0,
        maxEarlyPerDay: dailyLimits.maxEarlyPerDay ?? 2,
        minLatePerDay: dailyLimits.minLatePerDay ?? 0,
        maxLatePerDay: dailyLimits.maxLatePerDay ?? 3,
        minWorkingStaffPerDay: dailyLimits.minWorkingStaffPerDay ?? 3,
      });
      setHasChanges(false);
    }
  }, [dailyLimits]);

  const handleSliderChange = (field, value) => {
    const updated = { ...localLimits, [field]: value };

    // Validation: Ensure MIN doesn't exceed MAX for each shift type
    if (field === "minOffPerDay" && value > updated.maxOffPerDay) {
      toast.error("Minimum cannot exceed maximum");
      return;
    }
    if (field === "maxOffPerDay" && value < updated.minOffPerDay) {
      toast.error("Maximum cannot be less than minimum");
      return;
    }
    if (field === "minEarlyPerDay" && value > updated.maxEarlyPerDay) {
      toast.error("Minimum cannot exceed maximum");
      return;
    }
    if (field === "maxEarlyPerDay" && value < updated.minEarlyPerDay) {
      toast.error("Maximum cannot be less than minimum");
      return;
    }
    if (field === "minLatePerDay" && value > updated.maxLatePerDay) {
      toast.error("Minimum cannot exceed maximum");
      return;
    }
    if (field === "maxLatePerDay" && value < updated.minLatePerDay) {
      toast.error("Maximum cannot be less than minimum");
      return;
    }

    setLocalLimits(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if we have validation function and current schedule
      if (onValidate && currentScheduleId) {
        console.log("🔍 Validating schedule against new daily limits...");

        // Validate current schedule against NEW limits
        const violations = await onValidate(localLimits);

        if (violations && violations.length > 0) {
          console.log(`⚠️ Found ${violations.length} violation(s) with new limits`);
          setIsSaving(false);

          // Show violations modal - user must choose
          if (onShowViolations) {
            onShowViolations(violations, async () => {
              // User clicked "Accept & Fix" - proceed with save
              console.log("✅ User accepted violations - saving new limits");
              setIsSaving(true);
              try {
                await onUpdate(localLimits);
                setHasChanges(false);
                toast.success("Daily limits updated successfully");
              } catch (error) {
                console.error("Failed to update daily limits:", error);
                toast.error("Failed to update daily limits");
              } finally {
                setIsSaving(false);
              }
            });
          }
          return; // Don't proceed with save yet
        }
      }

      // No violations or no validation - proceed with save
      await onUpdate(localLimits);
      setHasChanges(false);
      toast.success("Daily limits updated successfully");
    } catch (error) {
      console.error("Failed to update daily limits:", error);
      toast.error("Failed to update daily limits");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaults = {
      enabled: true, // Reset to enabled
      minOffPerDay: 0,
      maxOffPerDay: 3,
      minEarlyPerDay: 0,
      maxEarlyPerDay: 2,
      minLatePerDay: 0,
      maxLatePerDay: 3,
    };
    setLocalLimits(defaults);
    setHasChanges(true);
  };

  // Toggle enabled/disabled state
  const handleToggleEnabled = () => {
    setLocalLimits(prev => ({ ...prev, enabled: !prev.enabled }));
    setHasChanges(true);
  };

  return (
    <div className={`space-y-4 p-6 rounded-lg border ${
      localLimits.enabled
        ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
        : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300"
    }`}>
      {/* Header with Action Buttons */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${
              localLimits.enabled ? "text-gray-900" : "text-gray-500"
            }`}>
              📅 Daily Limits (Per Date)
            </h3>
            {/* Enable/Disable Toggle */}
            <button
              onClick={handleToggleEnabled}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                localLimits.enabled
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              {localLimits.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className={`text-sm mt-1 ${localLimits.enabled ? "text-gray-600" : "text-gray-400"}`}>
            {localLimits.enabled
              ? "Configure minimum and maximum number of staff per shift type on any single day"
              : "Daily limits are disabled. Use Staff Type Limits for per-type constraints instead."
            }
          </p>
        </div>

        {/* Icon Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="p-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset to Defaults"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`p-2 rounded-lg transition-all ${
              !hasChanges || isSaving
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
            }`}
            title={isSaving ? "Saving..." : "Save Changes"}
          >
            {isSaving ? (
              <Clock className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sliders - Only show when enabled */}
      {localLimits.enabled ? (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
          {/* Off Days (×) Group */}
          <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              🔴 Staff Off Days (×)
            </h4>
            <Slider
              label="Minimum Staff Off Per Day"
              value={localLimits.minOffPerDay}
              min={0}
              max={4}
              step={1}
              onChange={(value) => handleSliderChange("minOffPerDay", value)}
              colorScheme="red"
              showValue={true}
              unit=" staff"
              description="Minimum number of staff that must be off (×) on any single day"
            />
            <Slider
              label="Maximum Staff Off Per Day"
              value={localLimits.maxOffPerDay}
              min={0}
              max={4}
              step={1}
              onChange={(value) => handleSliderChange("maxOffPerDay", value)}
              colorScheme="red"
              showValue={true}
              unit=" staff"
              description="Maximum number of staff that can be off (×) on any single day"
            />
          </div>

          {/* Early Shifts (△) Group */}
          <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              🟠 Early Shifts (△)
            </h4>
            <Slider
              label="Minimum Early Shifts Per Day"
              value={localLimits.minEarlyPerDay}
              min={0}
              max={2}
              step={1}
              onChange={(value) => handleSliderChange("minEarlyPerDay", value)}
              colorScheme="orange"
              showValue={true}
              unit=" staff"
              description="Minimum number of staff on early shifts (△) on any single day"
            />
            <Slider
              label="Maximum Early Shifts Per Day"
              value={localLimits.maxEarlyPerDay}
              min={0}
              max={2}
              step={1}
              onChange={(value) => handleSliderChange("maxEarlyPerDay", value)}
              colorScheme="orange"
              showValue={true}
              unit=" staff"
              description="Maximum number of staff on early shifts (△) on any single day"
            />
          </div>

          {/* Late Shifts (◇) Group */}
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              🟣 Late Shifts (◇)
            </h4>
            <Slider
              label="Minimum Late Shifts Per Day"
              value={localLimits.minLatePerDay}
              min={0}
              max={3}
              step={1}
              onChange={(value) => handleSliderChange("minLatePerDay", value)}
              colorScheme="purple"
              showValue={true}
              unit=" staff"
              description="Minimum number of staff on late shifts (◇) on any single day"
            />
            <Slider
              label="Maximum Late Shifts Per Day"
              value={localLimits.maxLatePerDay}
              min={0}
              max={3}
              step={1}
              onChange={(value) => handleSliderChange("maxLatePerDay", value)}
              colorScheme="purple"
              showValue={true}
              unit=" staff"
              description="Maximum number of staff on late shifts (◇) on any single day"
            />
          </div>
        </div>
      ) : (
        /* Disabled Message */
        <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-500 text-sm">
            Global daily limits are disabled. Configure per-staff-type limits below for more granular control.
          </p>
        </div>
      )}
    </div>
  );
};

const LimitsTab = ({
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

  // Daily Limits state - DEPRECATED (kept for backward compatibility)
  // Global daily limits have been replaced by Staff Type Daily Limits
  // eslint-disable-next-line no-unused-vars
  const [dailyLimits, setDailyLimits] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isLoadingDailyLimits, setIsLoadingDailyLimits] = useState(false);

  // Staff Type Limits state
  const [staffTypeLimits, setStaffTypeLimits] = useState(null);
  const [isLoadingStaffTypeLimits, setIsLoadingStaffTypeLimits] = useState(true);

  // Daily Limits Violations state - DEPRECATED
  // Global daily limits have been replaced by Staff Type Daily Limits
  // eslint-disable-next-line no-unused-vars
  const [showDailyLimitViolations, setShowDailyLimitViolations] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [dailyLimitViolations, setDailyLimitViolations] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [dailyLimitOnAccept, setDailyLimitOnAccept] = useState(null);

  // Schedule validation hook
  const { validateDailyLimits, getScheduleData } = useScheduleValidation(currentScheduleId);
  const queryClient = useQueryClient();

  // Phase 4.3: Add refs for stable references (prevent infinite loops)
  const settingsRef = useRef(settings);
  const updateSettingsRef = useRef(updateSettings);

  // Update refs when context values change
  useEffect(() => {
    settingsRef.current = settings;
    updateSettingsRef.current = updateSettings;
  }, [settings, updateSettings]);

  // Get limits directly from settings (no transformation needed)
  const weeklyLimits = useMemo(() => {
    return settings?.weeklyLimits || [];
  }, [settings?.weeklyLimits]);

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

  // Load daily limits from settings
  useEffect(() => {
    const loadDailyLimits = async () => {
      try {
        setIsLoadingDailyLimits(true);
        const limits = settings?.dailyLimits || {
          minOffPerDay: 0,
          maxOffPerDay: 3,
          minEarlyPerDay: 0,
          maxEarlyPerDay: 2,
          minLatePerDay: 0,
          maxLatePerDay: 3,
          minWorkingStaffPerDay: 3,
        };
        setDailyLimits(limits);
      } catch (error) {
        console.error("Failed to load daily limits:", error);
        toast.error("Failed to load daily limits");
      } finally {
        setIsLoadingDailyLimits(false);
      }
    };

    loadDailyLimits();
  }, [settings?.dailyLimits]);

  // Load staff type limits from settings
  useEffect(() => {
    const loadStaffTypeLimits = async () => {
      try {
        setIsLoadingStaffTypeLimits(true);
        const limits = settings?.staffTypeLimits || {};
        setStaffTypeLimits(limits);
      } catch (error) {
        console.error("Failed to load staff type limits:", error);
        toast.error("Failed to load staff type limits");
      } finally {
        setIsLoadingStaffTypeLimits(false);
      }
    };

    loadStaffTypeLimits();
  }, [settings?.staffTypeLimits]);

  // Phase 4.3: Wrap updateWeeklyLimits with refs (prevent infinite loops)
  // ✅ FIX: Remove staffMembers from dependencies to prevent unnecessary re-creations
  const updateWeeklyLimits = useCallback(
    async (newLimits, skipValidation = false) => {
      try {
        // ✅ STEP 1: Validate FIRST (before saving)
        if (!skipValidation && currentScheduleId) {
          setIsValidating(true);
          try {
            // ✅ Use staffMembers directly without adding to dependencies
            const violations = await validateDailyLimits(
              newLimits,
              staffMembers,
            );
            setIsValidating(false);

            if (violations.length > 0) {
              // ❌ Validation failed - DON'T save
              console.error(
                "❌ Weekly limits validation failed:",
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
                  description: "Current schedule exceeds new weekly limits. Please fix violations first.",
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
              "❌ Weekly limits validation error:",
              validationError,
            );
            toast.error(`Validation error: ${validationError.message}`);
            return; // ❌ Exit without saving
          }
        }

        // ✅ STEP 2: Save ONLY if validation passed
        updateSettingsRef.current({
          ...settingsRef.current,
          weeklyLimits: newLimits,
        });

        // ✅ Success feedback
        toast.success("Weekly limits updated successfully");
        console.log("✅ Weekly limits updated successfully");
      } catch (error) {
        console.error("Error updating weekly limits:", error);
        toast.error(`Failed to update weekly limits: ${error.message}`);
        throw error;
      }
    },
    [currentScheduleId, validateDailyLimits],
  );

  // Phase 4.3: Wrap updateMonthlyLimits with useCallback and refs
  const updateMonthlyLimits = useCallback((newLimits) => {
    updateSettingsRef.current({
      ...settingsRef.current,
      monthlyLimits: newLimits,
    });
  }, []);

  // Weekly Limits Edit Management
  const startEditingDailyLimit = (limitId) => {
    const limit = weeklyLimits.find((l) => l.id === limitId);
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
      const updatedLimits = weeklyLimits.map((limit) =>
        limit.id === editingLimit ? originalLimitData : limit,
      );
      // Skip validation when canceling (restoring original data)
      updateWeeklyLimits(updatedLimits, true);
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

  const createNewWeeklyLimit = () => {
    const newLimit = {
      id: crypto.randomUUID(),
      name: "New Weekly Limit",
      limitConfig: {
        shiftType: "any",
        maxCount: 1,
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
    updateWeeklyLimits([...weeklyLimits, newLimit], true);
    setShowAddForm(false);
  };

  const createNewMonthlyLimit = () => {
    const newLimit = {
      id: crypto.randomUUID(),
      name: "New Monthly Limit",
      limitType: "off_days",  // Enhanced: supports both MIN and MAX
      minCount: 7,            // NEW: Minimum off days required
      maxCount: 8,            // Maximum off days allowed
      countHalfDays: true,    // NEW: Support 0.5 increments
      excludeCalendarRules: true,       // NEW: Calendar days don't count
      excludeEarlyShiftCalendar: true,  // NEW: △ on calendar days don't count
      overrideWeeklyLimits: true,       // NEW: Monthly takes precedence
      scope: "individual",
      targetIds: [],
      distributionRules: {
        maxConsecutive: 2,
        preferWeekends: false,
      },
      isHardConstraint: true,  // Enhanced: default to hard constraint
      penaltyWeight: 50,       // Enhanced: higher priority than weekly
      description: "",
    };
    setOriginalMonthlyLimitData({ ...newLimit });
    setEditingMonthlyLimit(newLimit.id);
    const updatedLimits = [...monthlyLimits, newLimit];
    updateMonthlyLimits(updatedLimits);
  };

  const updateWeeklyLimit = (limitId, updates) => {
    const updatedLimits = weeklyLimits.map((limit) =>
      limit.id === limitId ? { ...limit, ...updates } : limit,
    );
    updateWeeklyLimits(updatedLimits);
  };

  const updateMonthlyLimit = (limitId, updates) => {
    const updatedLimits = monthlyLimits.map((limit) =>
      limit.id === limitId ? { ...limit, ...updates } : limit,
    );
    updateMonthlyLimits(updatedLimits);
  };

  const handleUpdateDailyLimits = async (newLimits) => {
    try {
      // Update via settings context
      await updateSettings({
        ...settings,
        dailyLimits: newLimits,
      });
      setDailyLimits(newLimits);
      console.log("✅ Daily limits updated:", newLimits);
    } catch (error) {
      console.error("Failed to update daily limits:", error);
      throw error;
    }
  };

  // Update staff type limits handler
  const handleUpdateStaffTypeLimits = async (newLimits) => {
    try {
      // Update via settings context
      await updateSettings({
        ...settings,
        staffTypeLimits: newLimits,
      });
      setStaffTypeLimits(newLimits);
      console.log("✅ Staff type limits updated:", newLimits);
    } catch (error) {
      console.error("Failed to update staff type limits:", error);
      throw error;
    }
  };

  // Validate daily limits against current schedule
  const handleValidateDailyLimits = async (newLimits) => {
    try {
      // Get current schedule from query cache
      const scheduleData = await getScheduleData(currentScheduleId) ||
                           queryClient.getQueryData(PREFETCH_QUERY_KEYS.scheduleData(currentScheduleId))?.schedule || {};

      if (!scheduleData || Object.keys(scheduleData).length === 0) {
        console.log("ℹ️ No schedule data found - skipping validation");
        return [];
      }

      const violations = [];

      // Get all dates from schedule
      const allDates = new Set();
      Object.values(scheduleData).forEach((staffSchedule) => {
        if (staffSchedule) {
          Object.keys(staffSchedule).forEach((dateKey) => allDates.add(dateKey));
        }
      });

      // Check each date against new limits
      allDates.forEach((dateKey) => {
        let offCount = 0;
        let earlyCount = 0;
        let lateCount = 0;

        Object.entries(scheduleData).forEach(([staffId, staffSchedule]) => {
          const shift = staffSchedule?.[dateKey];
          if (!shift) return;

          if (shift === "×") offCount++;
          else if (shift === "△") earlyCount++;
          else if (shift === "◇") lateCount++;
        });

        // Check violations
        if (offCount > newLimits.maxOffPerDay) {
          violations.push({
            date: dateKey,
            type: "max_off_per_day",
            message: `${offCount} staff off exceeds limit (${newLimits.maxOffPerDay})`,
            severity: "high",
            details: {
              actual: offCount,
              limit: newLimits.maxOffPerDay,
              shiftType: "off",
            },
          });
        }

        if (earlyCount > newLimits.maxEarlyPerDay) {
          violations.push({
            date: dateKey,
            type: "max_early_per_day",
            message: `${earlyCount} early shifts exceeds limit (${newLimits.maxEarlyPerDay})`,
            severity: "high",
            details: {
              actual: earlyCount,
              limit: newLimits.maxEarlyPerDay,
              shiftType: "early",
            },
          });
        }

        if (lateCount > newLimits.maxLatePerDay) {
          violations.push({
            date: dateKey,
            type: "max_late_per_day",
            message: `${lateCount} late shifts exceeds limit (${newLimits.maxLatePerDay})`,
            severity: "high",
            details: {
              actual: lateCount,
              limit: newLimits.maxLatePerDay,
              shiftType: "late",
            },
          });
        }
      });

      return violations;
    } catch (error) {
      console.error("Validation error:", error);
      return [];
    }
  };

  // Show violations modal handler
  const handleShowDailyLimitViolations = (violations, onAccept) => {
    setDailyLimitViolations(violations);
    setDailyLimitOnAccept(() => onAccept);
    setShowDailyLimitViolations(true);
  };

  // Modal close handlers
  const handleCloseDailyLimitViolations = () => {
    setShowDailyLimitViolations(false);
    setDailyLimitViolations([]);
    setDailyLimitOnAccept(null);
  };

  const handleAcceptDailyLimitViolations = () => {
    setShowDailyLimitViolations(false);
    if (dailyLimitOnAccept) {
      dailyLimitOnAccept();
    }
  };

  const deleteWeeklyLimit = (limitId) => {
    const limit = weeklyLimits.find((l) => l.id === limitId);
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
        const updatedLimits = weeklyLimits.filter((limit) => limit.id !== id);
        updateWeeklyLimits(updatedLimits);
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
    const limit = weeklyLimits.find((l) => l.id === limitId);
    if (!limit || !limit.limitConfig) return;

    const currentDays = limit.limitConfig.daysOfWeek || [];
    const updatedDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId];

    updateWeeklyLimit(limitId, {
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
    // Support both new (top-level) and old (limitConfig) structure
    const scope = limit.scope || limit.limitConfig?.scope || "all";
    if (scope === "all") return null;

    const options = getTargetOptions(scope);
    const updateFunc = isMonthly ? updateMonthlyLimit : updateWeeklyLimit;
    const targetIds = limit.targetIds || limit.limitConfig?.targetIds || [];

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
                  // For monthly limits, use top-level fields; for weekly, use limitConfig
                  if (isMonthly) {
                    updateFunc(limit.id, {
                      targetIds: updatedTargets,
                    });
                  } else {
                    updateFunc(limit.id, {
                      limitConfig: {
                        ...limit.limitConfig,
                        targetIds: updatedTargets,
                      },
                    });
                  }
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
    // Support both new (top-level) and old (limitConfig) structure
    const scope = limit.scope || limit.limitConfig?.scope || "all";
    if (scope === "all") return "";

    const targetIds = limit.targetIds || limit.limitConfig?.targetIds || [];

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
                    updateWeeklyLimit(limit.id, { name: e.target.value })
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
                {shiftType?.label} • Max {limit.limitConfig?.maxCount || 1} per
                week
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
                onClick={() => deleteWeeklyLimit(limit.id)}
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
                  updateWeeklyLimit(limit.id, { description: e.target.value })
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
                  updateWeeklyLimit(limit.id, {
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
              value={limit.limitConfig?.maxCount || 1}
              min={1}
              max={2}
              step={0.5}
              onChange={(value) =>
                updateWeeklyLimit(limit.id, {
                  limitConfig: {
                    ...limit.limitConfig,
                    maxCount: value,
                  },
                })
              }
              description="Maximum number of this shift type allowed per week (1, 1.5, or 2)"
            />

            {/* Days of Week */}
            {renderDaySelector(limit)}

            {/* Scope */}
            <FormField label="Apply To">
              <select
                value={limit.limitConfig?.scope || "all"}
                onChange={(e) =>
                  updateWeeklyLimit(limit.id, {
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
                  updateWeeklyLimit(limit.id, { isHardConstraint: checked })
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
                updateWeeklyLimit(limit.id, { penaltyWeight: value })
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

    // Get values with fallbacks for backward compatibility
    const minCount = limit.minCount ?? limit.limitConfig?.minCount ?? null;
    const maxCount = limit.maxCount ?? limit.limitConfig?.maxCount ?? 8;
    const limitType = limit.limitType || limit.limitConfig?.limitType || "off_days";
    const excludeCalendarRules = limit.excludeCalendarRules ?? true;
    const excludeEarlyShiftCalendar = limit.excludeEarlyShiftCalendar ?? true;
    const overrideWeeklyLimits = limit.overrideWeeklyLimits ?? true;
    const countHalfDays = limit.countHalfDays ?? true;
    const scope = limit.scope || limit.limitConfig?.scope || "all";

    // Format display text for min/max
    const formatCount = (count) => {
      if (count === null || count === undefined) return "—";
      return count % 1 === 0 ? Math.floor(count) : count;
    };

    const MONTHLY_LIMIT_TYPES = [
      { id: "off_days", label: "Off Days (× and △)" },
      { id: "max_off_days", label: "Max Off Days (legacy)" },
      { id: "max_work_days", label: "Max Work Days" },
      { id: "max_early_shifts", label: "Max Early Shifts" },
      { id: "max_late_shifts", label: "Max Late Shifts" },
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
                {limitType.replace(/_/g, " ")}{" "}
                • {minCount !== null ? `Min ${formatCount(minCount)}` : ""}{minCount !== null && maxCount !== null ? " / " : ""}{maxCount !== null ? `Max ${formatCount(maxCount)}` : ""} per month
                {scope !== "all" &&
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
                value={limitType}
                onChange={(e) =>
                  updateMonthlyLimit(limit.id, {
                    limitType: e.target.value,
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

            {/* MIN/MAX Count Section */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                📊 Monthly Limits Range
              </h4>

              {/* Minimum Count */}
              <NumberInput
                label="Minimum Count"
                value={minCount ?? ""}
                min={0}
                max={31}
                step={countHalfDays ? 0.5 : 1}
                onChange={(value) =>
                  updateMonthlyLimit(limit.id, {
                    minCount: value === "" ? null : value,
                  })
                }
                description="Minimum off days required per month (leave empty for no minimum)"
                placeholder="No minimum"
              />

              {/* Maximum Count */}
              <NumberInput
                label="Maximum Count"
                value={maxCount ?? ""}
                min={0}
                max={31}
                step={countHalfDays ? 0.5 : 1}
                onChange={(value) =>
                  updateMonthlyLimit(limit.id, {
                    maxCount: value === "" ? null : value,
                  })
                }
                description="Maximum off days allowed per month (leave empty for no maximum)"
                placeholder="No maximum"
              />

              {/* Half-day support toggle */}
              <ToggleSwitch
                label="Support Half Days"
                description="Allow 0.5 day increments (e.g., 7.5 days)"
                checked={countHalfDays}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { countHalfDays: checked })
                }
              />
            </div>

            {/* Calendar Rules Section */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                📅 Calendar Integration
              </h4>

              <ToggleSwitch
                label="Exclude Calendar Rules from Count"
                description="Days marked as must_day_off in calendar won't count toward monthly limit"
                checked={excludeCalendarRules}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { excludeCalendarRules: checked })
                }
              />

              <ToggleSwitch
                label="Exclude Early Shift Calendar Days"
                description="△ shifts on must_day_off dates won't count toward monthly limit"
                checked={excludeEarlyShiftCalendar}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { excludeEarlyShiftCalendar: checked })
                }
              />
            </div>

            {/* Priority Section */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-4">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                ⚖️ Priority Settings
              </h4>

              <ToggleSwitch
                label="Override Weekly Limits"
                description="Monthly limits take precedence over weekly limits when conflicts occur"
                checked={overrideWeeklyLimits}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { overrideWeeklyLimits: checked })
                }
              />

              <ToggleSwitch
                label="Hard Constraint"
                description="Cannot be violated vs. soft preference"
                checked={limit.isHardConstraint}
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, { isHardConstraint: checked })
                }
              />

              {/* Penalty Weight */}
              <Slider
                label="Penalty Weight"
                value={limit.penaltyWeight}
                min={1}
                max={100}
                onChange={(value) =>
                  updateMonthlyLimit(limit.id, { penaltyWeight: value })
                }
                description="Higher values make this constraint more important (50+ recommended for monthly)"
                colorScheme={limit.isHardConstraint ? "red" : "orange"}
              />
            </div>

            {/* Scope */}
            <FormField label="Apply To">
              <select
                value={scope}
                onChange={(e) =>
                  updateMonthlyLimit(limit.id, {
                    scope: e.target.value,
                    targetIds: [], // Reset targets when scope changes
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LIMIT_SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Target Selector */}
            {renderTargetSelector(limit, true)}
          </div>
        )}

        {!isEditing && limit.description && (
          <p className="text-sm text-gray-600 mb-4">{limit.description}</p>
        )}

        {/* Summary badges when not editing */}
        {!isEditing && (
          <div className="space-y-3">
            {/* Settings Summary */}
            <div className="flex flex-wrap gap-2">
              {excludeCalendarRules && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  Excludes Calendar Rules
                </span>
              )}
              {overrideWeeklyLimits && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Overrides Weekly
                </span>
              )}
              {countHalfDays && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  Half-day Support
                </span>
              )}
            </div>

            {/* Distribution Rules */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Distribution Rules</h4>

              <div className="mb-4">
                <NumberInput
                  label="Max Consecutive"
                  value={
                    limit.distributionRules?.maxConsecutive || 2
                  }
                  min={1}
                  max={7}
                  onChange={(value) =>
                    updateMonthlyLimit(limit.id, {
                      distributionRules: {
                        ...limit.distributionRules,
                        maxConsecutive: value,
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
                  limit.distributionRules?.preferWeekends || false
                }
                onChange={(checked) =>
                  updateMonthlyLimit(limit.id, {
                    distributionRules: {
                      ...limit.distributionRules,
                      preferWeekends: checked,
                    },
                  })
                }
                size="small"
                disabled={!isEditing}
              />
            </div>

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
            Weekly & Monthly Limits
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
                Cannot Save Weekly Limits
              </h3>
              <p className="text-red-700 text-sm mt-1">
                The current schedule violates the new weekly limits. Please fix these issues before saving.
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

      {/* Staff Type Daily Limits Section - PRIMARY constraint method */}
      {/* NOTE: Global Daily Limits (DailyLimitsSection) has been DEPRECATED */}
      {/* in favor of per-staff-type limits for more granular control */}
      {isLoadingStaffTypeLimits ? (
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600">Loading staff type limits...</p>
        </div>
      ) : (
        <StaffTypeLimitsSection
          staffTypeLimits={staffTypeLimits}
          staffMembers={staffMembers}
          onUpdate={handleUpdateStaffTypeLimits}
        />
      )}

      {/* Separator */}
      <div className="border-t-2 border-gray-200" />

      {/* Weekly Limits Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">
              Weekly Limits
            </h3>
            <p className="text-gray-600 text-sm">
              Set maximum counts for shift types per week.
            </p>
          </div>

          <button
            onClick={createNewWeeklyLimit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Weekly Limit
          </button>
        </div>

        {weeklyLimits.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {weeklyLimits.map(renderDailyLimitCard)}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No Weekly Limits
            </h3>
            <p className="text-gray-600 mb-4">
              Create weekly limits to control how many staff can have the same
              shift type per week.
            </p>
            <button
              onClick={createNewWeeklyLimit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Create First Weekly Limit
            </button>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t-2 border-gray-200" />

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
      {/* ✅ FIX: Memoize computed props to prevent infinite re-renders */}
      <ConfirmationModal
        isOpen={deleteConfirmation !== null}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={useMemo(
          () =>
            `Delete ${deleteConfirmation?.type === "daily" ? "Weekly" : "Monthly"} Limit`,
          [deleteConfirmation?.type],
        )}
        message={useMemo(
          () =>
            `Are you sure you want to delete the ${deleteConfirmation?.type} limit "${deleteConfirmation?.name}"? This action cannot be undone.`,
          [deleteConfirmation?.type, deleteConfirmation?.name],
        )}
        confirmText={useMemo(
          () =>
            `Delete ${deleteConfirmation?.type === "daily" ? "Weekly" : "Monthly"} Limit`,
          [deleteConfirmation?.type],
        )}
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
        title="Weekly Limit Violations Detected"
      />

      {/* Daily Limits Violations Modal */}
      {showDailyLimitViolations && (
        <ConflictsModal
          isOpen={showDailyLimitViolations}
          onClose={handleCloseDailyLimitViolations}
          onAccept={handleAcceptDailyLimitViolations}
          conflicts={dailyLimitViolations}
          type="daily_limits"
          staffMembers={staffMembers}
          title="Daily Limits Would Violate Current Schedule"
          description={`The new daily limits would cause ${dailyLimitViolations.length} violation${dailyLimitViolations.length !== 1 ? "s" : ""} in your current schedule. You can accept and the system will automatically fix these violations, or cancel to keep the current limits.`}
        />
      )}

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

export default LimitsTab;
