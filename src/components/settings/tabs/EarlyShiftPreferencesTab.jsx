import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar as CalendarIcon, Users, Check, X, AlertCircle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { useRestaurant } from "../../../contexts/RestaurantContext";
import { useSettings } from "../../../contexts/SettingsContext";
import { useCalendarRules } from "../../../hooks/useCalendarRules";
import { useEarlyShiftPreferences } from "../../../hooks/useEarlyShiftPreferences";
import { supabase } from "../../../utils/supabase";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

// Local storage key for earlyShiftConfig (not stored in database yet)
const EARLY_SHIFT_CONFIG_KEY = "shift-schedule-earlyShiftConfig";

const EarlyShiftPreferencesTab = () => {
  const { restaurant } = useRestaurant();
  const { settings, updateSettings } = useSettings();

  // Load earlyShiftConfig from localStorage on mount
  const [localEarlyShiftConfig, setLocalEarlyShiftConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(EARLY_SHIFT_CONFIG_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to load earlyShiftConfig from localStorage:", e);
      return {};
    }
  });

  // Merge localStorage config with settings (localStorage takes priority)
  const earlyShiftConfig = useMemo(() => ({
    ...settings?.earlyShiftConfig,
    ...localEarlyShiftConfig,
  }), [settings?.earlyShiftConfig, localEarlyShiftConfig]);

  // Post day-off period constraint settings
  const postPeriodConfig = earlyShiftConfig?.postPeriodConstraint || {
    enabled: true,                  // CHANGED: Now enabled by default
    isHardConstraint: true,         // NEW: HARD mode by default
    minPeriodLength: 3,            // NEW: Only apply to 3+ day periods
    postPeriodDays: 2,             // NEW: Protect 2 days after period (e.g., March 6 AND March 7)
    avoidDayOffForShain: true,
    avoidDayOffForHaken: true,
    allowEarlyForShain: true,
  };

  // Handler for updating post-period constraint settings
  const handlePostPeriodConfigChange = useCallback((key, value) => {
    const newConfig = {
      ...postPeriodConfig,
      [key]: value,
    };
    const newEarlyShiftConfig = {
      ...earlyShiftConfig,
      postPeriodConstraint: newConfig,
    };

    // Save to localStorage for persistence
    try {
      localStorage.setItem(EARLY_SHIFT_CONFIG_KEY, JSON.stringify(newEarlyShiftConfig));
      setLocalEarlyShiftConfig(newEarlyShiftConfig);
    } catch (e) {
      console.error("Failed to save earlyShiftConfig to localStorage:", e);
    }

    // Also update settings context for immediate use
    updateSettings({
      earlyShiftConfig: newEarlyShiftConfig,
    });
    toast.success("設定を保存しました");
  }, [postPeriodConfig, earlyShiftConfig, updateSettings]);

  // Calendar rules (read-only preview)
  const dateRange = useMemo(() => {
    const now = new Date();
    return {
      start: startOfMonth(now),
      end: endOfMonth(addMonths(now, 2)), // Show 3 months
    };
  }, []); // Empty dependency array - calculate once on mount

  const { rules, isLoading: isLoadingRules } = useCalendarRules(
    restaurant?.id,
    dateRange.start,
    dateRange.end
  );

  // Early shift preferences
  const {
    preferences,
    isLoading: isLoadingPrefs,
    error: prefsError,
    savePreference,
    bulkSavePreferences,
  } = useEarlyShiftPreferences(restaurant?.id);

  // Staff members (fetch directly from Supabase)
  const [staffMembers, setStaffMembers] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Group consecutive must_day_off dates into periods
  const dayOffPeriods = useMemo(() => {
    const mustDayOffDates = Object.entries(rules)
      .filter(([_, ruleType]) => ruleType === "must_day_off")
      .map(([dateString, _]) => dateString)
      .sort(); // Sort chronologically

    if (mustDayOffDates.length === 0) return [];

    // Group consecutive dates into periods
    const periods = [];
    let currentPeriod = { start: mustDayOffDates[0], end: mustDayOffDates[0] };

    for (let i = 1; i < mustDayOffDates.length; i++) {
      const prevDate = new Date(mustDayOffDates[i - 1]);
      const currDate = new Date(mustDayOffDates[i]);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        // Consecutive - extend current period
        currentPeriod.end = mustDayOffDates[i];
      } else {
        // Gap - start new period
        periods.push(currentPeriod);
        currentPeriod = { start: mustDayOffDates[i], end: mustDayOffDates[i] };
      }
    }
    periods.push(currentPeriod);

    return periods;
  }, [rules]);

  // State for selected period navigation
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  // Auto-select first non-expired period on mount/update
  useEffect(() => {
    if (dayOffPeriods.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextUpcomingIndex = dayOffPeriods.findIndex(period => {
      const startDate = new Date(period.start);
      return startDate >= today;
    });

    // If all expired, show the last one; otherwise show next upcoming
    const targetIndex = nextUpcomingIndex >= 0 ? nextUpcomingIndex : dayOffPeriods.length - 1;
    setSelectedPeriodIndex(targetIndex);
  }, [dayOffPeriods]);

  // Get selected period and reference date
  const selectedPeriod = dayOffPeriods[selectedPeriodIndex] || null;
  const referenceDate = selectedPeriod?.start || null;

  // Legacy: Keep these for backward compatibility with existing code
  const firstMustDayOffDate = referenceDate;
  const lastMustDayOffDate = selectedPeriod?.end || null;

  // Auto-assign all staff to early shift (default checked)
  const [autoAssignAll, setAutoAssignAll] = useState(true);
  const [hasInitializedBulkAssignment, setHasInitializedBulkAssignment] = useState(false);

  // Load staff members
  const loadStaff = useCallback(async () => {
    if (!restaurant?.id) return;

    try {
      setIsLoadingStaff(true);
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true);

      if (error) throw error;

      // Filter to show only 社員 (regular staff), exclude part-time
      let regularStaff = (data || []).filter(
        (staff) => staff.status === "社員" && staff.type !== "part-time"
      );

      // Sort by hire date (earliest first)
      // Try start_period first, then hire_date as fallback
      regularStaff.sort((a, b) => {
        let dateA = null;
        let dateB = null;

        // Try to get date from start_period (JSONB field)
        if (a.start_period && a.start_period.year) {
          dateA = new Date(
            a.start_period.year,
            (a.start_period.month || 1) - 1,
            a.start_period.day || 1
          );
        } else if (a.hire_date) {
          dateA = new Date(a.hire_date);
        }

        if (b.start_period && b.start_period.year) {
          dateB = new Date(
            b.start_period.year,
            (b.start_period.month || 1) - 1,
            b.start_period.day || 1
          );
        } else if (b.hire_date) {
          dateB = new Date(b.hire_date);
        }

        // Handle staff without dates - put them at the end
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        // Compare dates
        return dateA - dateB; // Ascending order (earliest first)
      });

      // Debug log the sorted order
      console.log(
        "✅ [EarlyShiftPrefs] Staff sorted by hire date:",
        regularStaff.map((s) => ({
          name: s.name,
          hire_date: s.hire_date,
          start_period: s.start_period,
        }))
      );

      // If we have a must_day_off date, filter staff who are active on that date
      if (firstMustDayOffDate) {
        const targetDate = new Date(firstMustDayOffDate);

        regularStaff = regularStaff.filter((staff) => {
          // Check if staff started before or on the target date
          if (staff.start_period) {
            const startDate = new Date(
              staff.start_period.year,
              staff.start_period.month - 1,
              staff.start_period.day || 1
            );
            if (startDate > targetDate) {
              return false; // Staff hasn't started yet
            }
          }

          // Check if staff ended before the target date
          if (staff.end_period) {
            const endDate = new Date(
              staff.end_period.year,
              staff.end_period.month - 1,
              staff.end_period.day || 1
            );
            if (endDate < targetDate) {
              return false; // Staff already left
            }
          }

          return true; // Staff is active on target date
        });

        console.log(
          `✅ [EarlyShiftPrefs] Filtered to ${regularStaff.length} staff active on ${firstMustDayOffDate}`
        );
      }

      setStaffMembers(regularStaff);
      console.log(`✅ [EarlyShiftPrefs] Loaded ${regularStaff.length} regular staff members`);
    } catch (err) {
      console.error("❌ [EarlyShiftPrefs] Failed to load staff:", err);
      toast.error("スタッフの読み込みに失敗しました");
    } finally {
      setIsLoadingStaff(false);
    }
  }, [restaurant?.id, firstMustDayOffDate]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Auto-save bulk preference on initial load if checkbox is checked by default
  useEffect(() => {
    // Only run once when component mounts and we have the necessary data
    if (
      !hasInitializedBulkAssignment &&
      !isLoadingPrefs &&
      !isLoadingStaff &&
      restaurant?.id &&
      lastMustDayOffDate &&
      autoAssignAll // If checkbox is checked by default
    ) {
      const initializeBulkAssignment = async () => {
        console.log("🔄 [EarlyShift] Auto-saving bulk preference on initial load");

        try {
          // Get all regular staff (not just those on the first date)
          const { data, error } = await supabase
            .from("staff")
            .select("*")
            .eq("restaurant_id", restaurant.id)
            .eq("is_active", true);

          if (error) {
            console.error("Failed to load staff for bulk assignment:", error);
            return;
          }

          const regularStaff = (data || []).filter(
            (staff) => staff.status === "社員" && staff.type !== "part-time"
          );

          const bulkPrefs = {};
          regularStaff.forEach((staff) => {
            bulkPrefs[staff.id] = true; // autoAssignAll is true
          });

          await bulkSavePreferences(bulkPrefs, lastMustDayOffDate, 'bulk_assignment');
          console.log("✅ [EarlyShift] Bulk preference saved on initial load");
        } catch (err) {
          console.error("❌ [EarlyShift] Failed to auto-save bulk preference:", err);
        } finally {
          setHasInitializedBulkAssignment(true);
        }
      };

      initializeBulkAssignment();
    }
  }, [
    hasInitializedBulkAssignment,
    isLoadingPrefs,
    isLoadingStaff,
    restaurant?.id,
    lastMustDayOffDate,
    autoAssignAll,
    bulkSavePreferences,
  ]);

  // Calculate selected count for first must_day_off date
  const selectedCount = useMemo(() => {
    if (!firstMustDayOffDate) return 0;
    return staffMembers.filter((staff) => {
      const dateKey = firstMustDayOffDate || 'default';
      return preferences[staff.id]?.[dateKey] === true;
    }).length;
  }, [staffMembers, preferences, firstMustDayOffDate]);

  // Handle individual checkbox toggle (for first must_day_off date)
  const handleToggle = async (staffId) => {
    const dateKey = firstMustDayOffDate || 'default';
    const currentValue = preferences[staffId]?.[dateKey] || false;
    const newValue = !currentValue;

    try {
      setIsSaving(true);
      await savePreference(staffId, newValue, firstMustDayOffDate, 'individual');
      toast.success(newValue ? "早番可能に設定しました" : "早番不可に設定しました");
    } catch (err) {
      console.error("Failed to save preference:", err);
      toast.error("設定の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Select all staff (for first must_day_off date)
  const handleSelectAll = async () => {
    const allSelected = {};
    staffMembers.forEach((staff) => {
      allSelected[staff.id] = true;
    });

    try {
      setIsSaving(true);
      await bulkSavePreferences(allSelected, firstMustDayOffDate, 'individual');
      toast.success("全スタッフを早番可能に設定しました");
    } catch (err) {
      console.error("Failed to select all:", err);
      toast.error("一括設定に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Deselect all staff (for first must_day_off date)
  const handleDeselectAll = async () => {
    const allDeselected = {};
    staffMembers.forEach((staff) => {
      allDeselected[staff.id] = false;
    });

    try {
      setIsSaving(true);
      await bulkSavePreferences(allDeselected, firstMustDayOffDate, 'individual');
      toast.success("全スタッフを早番不可に設定しました");
    } catch (err) {
      console.error("Failed to deselect all:", err);
      toast.error("一括解除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle auto-assign all checkbox toggle (for last must_day_off date)
  const handleAutoAssignToggle = async (checked) => {
    setAutoAssignAll(checked);

    if (!lastMustDayOffDate) return;

    // Get all regular staff (not just those on the first date)
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true);

    if (error) {
      console.error("Failed to load staff for bulk assignment:", error);
      toast.error("スタッフの読み込みに失敗しました");
      return;
    }

    const regularStaff = (data || []).filter(
      (staff) => staff.status === "社員" && staff.type !== "part-time"
    );

    const bulkPrefs = {};
    regularStaff.forEach((staff) => {
      bulkPrefs[staff.id] = checked;
    });

    try {
      setIsSaving(true);
      await bulkSavePreferences(bulkPrefs, lastMustDayOffDate, 'bulk_assignment');
      toast.success(checked ? "全社員を早番可能に設定しました" : "一括設定を解除しました");
    } catch (err) {
      console.error("Failed to auto-assign all:", err);
      toast.error("一括設定に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Render compact calendar preview
  const renderCalendarPreview = () => {
    const now = dateRange.start; // Use start date from dateRange
    const months = [now, addMonths(now, 1), addMonths(now, 2)];

    return (
      <div className="grid grid-cols-3 gap-3">
        {months.map((month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
          const startDay = getDay(monthStart);
          const calendarDays = [...Array(startDay).fill(null), ...days];

          return (
            <div key={month.toISOString()} className="border rounded">
              {/* Month header */}
              <div className="bg-blue-600 text-white p-2 rounded-t text-center">
                <span className="text-sm font-bold">
                  {format(month, "yyyy年M月", { locale: ja })}
                </span>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 bg-gray-100 p-2">
                {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-sm font-semibold py-1 ${
                      index === 0 ? "text-red-600" : index === 6 ? "text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-10" />;
                  }

                  const dateString = format(day, "yyyy-MM-dd");
                  const ruleType = rules[dateString];

                  let bgColor = "bg-white";
                  let symbol = "";

                  if (ruleType === "must_work") {
                    bgColor = "bg-orange-500 text-white";
                    symbol = "⚠️";
                  } else if (ruleType === "must_day_off") {
                    bgColor = "bg-red-600 text-white font-bold";
                    symbol = "×";
                  }

                  return (
                    <div
                      key={dateString}
                      className={`h-10 flex flex-col items-center justify-center text-sm border rounded ${bgColor}`}
                      title={ruleType ? `${ruleType === "must_work" ? "出勤必須" : "休日必須"}` : ""}
                    >
                      <span className="text-sm font-medium">{format(day, "d")}</span>
                      {symbol && <span className="text-xs">{symbol}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isLoading = isLoadingRules || isLoadingPrefs || isLoadingStaff;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            早番希望スタッフ
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            早番(△)を担当できるスタッフを選択してください (社員のみ)
          </p>
        </div>

        {!isLoading && (
          <Badge variant="secondary" className="text-base px-4 py-2">
            {selectedCount} / {staffMembers.length}人
          </Badge>
        )}
      </div>

      {/* Error display */}
      {prefsError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700">{prefsError}</span>
        </div>
      )}

      {/* Calendar Preview Section */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">カレンダープレビュー (読み取り専用)</h3>
        </div>

        {isLoadingRules ? (
          <div className="text-center py-8 text-gray-500">
            読み込み中...
          </div>
        ) : (
          renderCalendarPreview()
        )}

        <div className="mt-3 pt-3 border-t flex items-start gap-2 text-sm text-gray-600">
          <Info className="w-4 h-4 mt-0.5" />
          <span>
            ⚠️ = 出勤必須 (イベント・休日禁止) | × = 休日必須 (メンテナンス・全員休み)
          </span>
        </div>
      </div>

      {/* Staff Selection Section */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              早番可能スタッフ選択 (社員のみ)
            </h3>
            {dayOffPeriods.length > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <Button
                  onClick={() => setSelectedPeriodIndex(prev => Math.max(0, prev - 1))}
                  disabled={selectedPeriodIndex === 0}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <span className="text-sm text-gray-600 min-w-[220px] text-center">
                  基準日: {format(new Date(referenceDate), "yyyy年M月d日", { locale: ja })}
                  {selectedPeriod?.start !== selectedPeriod?.end && (
                    <span> 〜 {format(new Date(selectedPeriod.end), "M月d日", { locale: ja })}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-1">
                    ({selectedPeriodIndex + 1}/{dayOffPeriods.length})
                  </span>
                </span>

                <Button
                  onClick={() => setSelectedPeriodIndex(prev => Math.min(dayOffPeriods.length - 1, prev + 1))}
                  disabled={selectedPeriodIndex === dayOffPeriods.length - 1}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                休日必須日が設定されていません
              </p>
            )}
            {dayOffPeriods.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                (選択した休日期間に在籍しているスタッフを表示)
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSelectAll}
              disabled={isSaving || isLoading}
              variant="outline"
              size="sm"
            >
              すべて選択
            </Button>
            <Button
              onClick={handleDeselectAll}
              disabled={isSaving || isLoading}
              variant="outline"
              size="sm"
            >
              すべて解除
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            読み込み中...
          </div>
        ) : staffMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            社員スタッフが登録されていません
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {staffMembers.map((staff) => {
              const dateKey = firstMustDayOffDate || 'default';
              const isChecked = preferences[staff.id]?.[dateKey] === true;

              return (
                <label
                  key={staff.id}
                  className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(staff.id)}
                    disabled={isSaving}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />

                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{staff.name}</div>
                    <div className="text-sm text-gray-600">
                      {staff.status || "社員"} {staff.position && `• ${staff.position}`}
                    </div>
                  </div>

                  {isChecked ? (
                    <Check className="w-5 h-5 text-blue-600" />
                  ) : (
                    <X className="w-5 h-5 text-gray-400" />
                  )}
                </label>
              );
            })}
          </div>
        )}

        {!isLoading && staffMembers.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-start gap-2 text-sm text-gray-600">
            <Info className="w-4 h-4 mt-0.5" />
            <span>
              チェックしたスタッフが早番(△)に優先的に配置されます。
              AI スケジュール生成時に自動的に反映されます。
            </span>
          </div>
        )}
      </div>

      {/* Auto-assign all staff section (for last must_day_off date) */}
      {lastMustDayOffDate && firstMustDayOffDate !== lastMustDayOffDate && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={autoAssignAll}
              onChange={(e) => handleAutoAssignToggle(e.target.checked)}
              disabled={isSaving || isLoading}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mt-1"
              id="auto-assign-all"
            />
            <label htmlFor="auto-assign-all" className="flex-1 cursor-pointer">
              <div className="font-semibold text-gray-900 text-base">
                {format(new Date(lastMustDayOffDate), "yyyy年M月d日", { locale: ja })}
                まで全社員を早番可能に設定
              </div>
              <p className="text-sm text-gray-600 mt-1">
                この日までに在籍する全ての社員スタッフが早番(△)を担当できるようになります
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Post Day-Off Period Constraint Section */}
      {dayOffPeriods.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            休日期間終了後の制約設定
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            長期休日期間（メンテナンス等）の翌日に適用する制約を設定します。
            営業再開日に十分なスタッフを確保するための設定です。
          </p>

          {/* Main toggle */}
          <div className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50 mb-3">
            <input
              type="checkbox"
              checked={postPeriodConfig.enabled}
              onChange={(e) => handlePostPeriodConfigChange('enabled', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mt-0.5"
              id="post-period-enabled"
            />
            <label htmlFor="post-period-enabled" className="flex-1 cursor-pointer">
              <div className="font-semibold text-gray-900">
                休日期間終了後の制約を有効にする
              </div>
              <p className="text-sm text-gray-500 mt-1">
                休日必須期間の翌日に、以下の制約を適用します
              </p>
            </label>
          </div>

          {/* Sub-options (only shown when enabled) */}
          {postPeriodConfig.enabled && (
            <div className="ml-6 space-y-3 border-l-2 border-blue-200 pl-4">
              {/* Avoid day-off for 社員 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={postPeriodConfig.avoidDayOffForShain}
                  onChange={(e) => handlePostPeriodConfigChange('avoidDayOffForShain', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  id="avoid-dayoff-shain"
                />
                <label htmlFor="avoid-dayoff-shain" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">社員</span>の休日(×)を避ける
                </label>
              </div>

              {/* Avoid day-off for 派遣 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={postPeriodConfig.avoidDayOffForHaken}
                  onChange={(e) => handlePostPeriodConfigChange('avoidDayOffForHaken', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  id="avoid-dayoff-haken"
                />
                <label htmlFor="avoid-dayoff-haken" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">派遣</span>の休日(×)を避ける
                </label>
              </div>

              {/* Allow early shift for 社員 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={postPeriodConfig.allowEarlyForShain}
                  onChange={(e) => handlePostPeriodConfigChange('allowEarlyForShain', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  id="allow-early-shain"
                />
                <label htmlFor="allow-early-shain" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">社員</span>の早番(△)を許可する
                </label>
              </div>

              {/* Divider */}
              <div className="border-t my-3"></div>

              {/* HARD mode toggle */}
              <div className="flex items-start gap-3 p-3 border rounded-lg bg-yellow-50">
                <input
                  type="checkbox"
                  checked={postPeriodConfig.isHardConstraint !== false}
                  onChange={(e) => handlePostPeriodConfigChange('isHardConstraint', e.target.checked)}
                  className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 mt-0.5"
                  id="post-period-hard-mode"
                />
                <label htmlFor="post-period-hard-mode" className="flex-1 cursor-pointer">
                  <div className="font-semibold text-gray-900">
                    ハード制約モード (絶対禁止)
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    有効時: 翌日の休日を絶対に許可しない (ペナルティ10000)
                    <br />
                    無効時: 避けるが許可する場合あり (ペナルティ500)
                  </p>
                </label>
              </div>

              {/* Minimum period length */}
              <div className="flex items-start gap-3 p-3 border rounded-lg bg-white">
                <label className="flex-1">
                  <div className="font-medium text-gray-700 mb-2">
                    最小期間日数 (この日数以上の休日期間に適用)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={postPeriodConfig.minPeriodLength || 3}
                      onChange={(e) => handlePostPeriodConfigChange('minPeriodLength', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border rounded text-sm"
                    />
                    <span className="text-sm text-gray-500">日以上の連続休日</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    推奨: 3日 (3日以上の営業停止のみ適用)
                  </p>
                </label>
              </div>

              {/* Post-period days config - NEW */}
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                <label className="flex-1">
                  <div className="font-medium text-gray-700 mb-1">
                    制約適用日数 (休日期間後)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={postPeriodConfig.postPeriodDays || 2}
                      onChange={(e) => handlePostPeriodConfigChange('postPeriodDays', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border rounded text-sm"
                    />
                    <span className="text-sm text-gray-500">日間</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    推奨: 2日 (休日期間終了後の2日間に制約を適用)
                  </p>
                </label>
              </div>

              {/* Info note */}
              <div className="mt-3 pt-3 border-t flex items-start gap-2 text-xs text-gray-500">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  例: 3月3日〜5日が休日期間(3日間)の場合、制約適用日数が2日なら3月6日と7日に上記制約が適用されます。
                  これにより営業再開後も十分な人員を確保できます。
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EarlyShiftPreferencesTab;
