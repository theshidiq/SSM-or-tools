import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings as SettingsIcon,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { usePeriodsRealtime } from "../../../hooks/usePeriodsRealtime";
import { useRestaurant } from "../../../contexts/RestaurantContext";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

const PeriodsTab = () => {
  const {
    periods,
    isLoading,
    error,
    getPeriodConfiguration,
    updatePeriodConfiguration,
    regeneratePeriods,
    clearError,
  } = usePeriodsRealtime();

  const { restaurant } = useRestaurant();

  const [config, setConfig] = useState(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    startDay: 21,
    periodLength: 30,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load period configuration
  const loadConfiguration = useCallback(async () => {
    if (!restaurant?.id) return;

    try {
      setIsLoadingConfig(true);
      const data = await getPeriodConfiguration(restaurant.id);

      if (data) {
        setConfig(data);
        setFormData({
          startDay: data.start_day,
          periodLength: data.period_length_days,
        });
      }
    } catch (err) {
      console.error("Failed to load period configuration:", err);
      // Config might not exist yet, use defaults
      setFormData({
        startDay: 21,
        periodLength: 30,
      });
    } finally {
      setIsLoadingConfig(false);
    }
  }, [restaurant?.id, getPeriodConfiguration]);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Handle form changes
  const handleStartDayChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 31) {
      setFormData((prev) => ({ ...prev, startDay: value }));
      setHasUnsavedChanges(true);
    }
  }, []);

  const handlePeriodLengthChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 60) {
      setFormData((prev) => ({ ...prev, periodLength: value }));
      setHasUnsavedChanges(true);
    }
  }, []);

  // Save configuration and regenerate periods
  const handleSaveConfiguration = useCallback(async () => {
    if (!restaurant?.id) {
      toast.error("Restaurant ID not found");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updatePeriodConfiguration(
        restaurant.id,
        formData.startDay,
        formData.periodLength
      );

      toast.success("Period configuration updated!", {
        description: `All ${result.periods_regenerated} periods have been regenerated.`,
      });

      setHasUnsavedChanges(false);
      await loadConfiguration();
    } catch (err) {
      toast.error(`Failed to update configuration: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    restaurant?.id,
    formData,
    updatePeriodConfiguration,
    loadConfiguration,
  ]);

  // Manual regenerate
  const handleRegeneratePeriods = useCallback(async () => {
    if (!restaurant?.id) {
      toast.error("Restaurant ID not found");
      return;
    }

    try {
      const result = await regeneratePeriods(restaurant.id);
      toast.success(`Regenerated ${result?.length || 18} periods successfully`);
    } catch (err) {
      toast.error(`Failed to regenerate periods: ${err.message}`);
    }
  }, [restaurant?.id, regeneratePeriods]);

  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Period Configuration
          </h2>
          <p className="text-gray-600 mt-1">
            Configure universal rules for all scheduling periods
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {periods.length} periods active
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="font-medium text-red-800">Error: {error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Universal Period Rules</p>
            <p>
              One configuration applies to all {periods.length} periods. When you
              change the start day, all periods will be automatically regenerated
              with the new settings.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon size={20} className="text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-800">
            Period Settings
          </h3>
        </div>

        {/* Start Day Input */}
        <div className="space-y-2">
          <label
            htmlFor="startDay"
            className="block text-sm font-medium text-gray-700"
          >
            Start Day of Month
          </label>
          <div className="flex items-center gap-4">
            <input
              id="startDay"
              type="number"
              min="1"
              max="31"
              value={formData.startDay}
              onChange={handleStartDayChange}
              className="w-24 px-4 py-2 text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                All periods will start on day <strong>{formData.startDay}</strong>{" "}
                of each month
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Valid range: 1-31 (automatically adjusts for shorter months)
              </p>
            </div>
          </div>
        </div>

        {/* Period Length Input */}
        <div className="space-y-2">
          <label
            htmlFor="periodLength"
            className="block text-sm font-medium text-gray-700"
          >
            Period Length (Days)
          </label>
          <div className="flex items-center gap-4">
            <input
              id="periodLength"
              type="number"
              min="1"
              max="60"
              value={formData.periodLength}
              onChange={handlePeriodLengthChange}
              className="w-24 px-4 py-2 text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Each period will be <strong>{formData.periodLength} days</strong>{" "}
                long
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Current system default: 30 days per period
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={handleSaveConfiguration}
            disabled={!hasUnsavedChanges || isSaving}
            className="flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            {isSaving ? "Saving..." : "Save & Regenerate All Periods"}
          </Button>
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>

      {/* Current Periods Preview */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-800">
              Current Periods
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegeneratePeriods}
            className="flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Regenerate
          </Button>
        </div>

        {periods.length > 0 ? (
          <div className="space-y-2">
            {/* Show first 3 and last 3 periods */}
            {periods.slice(0, 3).map((period, index) => (
              <div
                key={period.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    #{index}
                  </Badge>
                  <span className="font-medium text-gray-800">
                    {period.label}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {format(period.start, "MMM d", { locale: ja })} -{" "}
                  {format(period.end, "MMM d, yyyy", { locale: ja })}
                </div>
              </div>
            ))}

            {periods.length > 6 && (
              <div className="text-center py-2 text-sm text-gray-500">
                ... {periods.length - 6} more periods ...
              </div>
            )}

            {periods.length > 3 &&
              periods.slice(-3).map((period, index) => {
                const actualIndex = periods.length - 3 + index;
                return (
                  <div
                    key={period.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        #{actualIndex}
                      </Badge>
                      <span className="font-medium text-gray-800">
                        {period.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(period.start, "MMM d", { locale: ja })} -{" "}
                      {format(period.end, "MMM d, yyyy", { locale: ja })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No periods configured</p>
            <p className="text-sm text-gray-500 mt-1">
              Save configuration to generate periods
            </p>
          </div>
        )}

        {config && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 size={14} className="text-green-600" />
              <span>
                Last updated:{" "}
                {format(new Date(config.updated_at), "PPp", { locale: ja })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
        <p className="font-medium mb-2">How it works:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>
            Set the start day (e.g., "21") and all periods will begin on that day
          </li>
          <li>
            Changes apply universally to all periods (past, present, and future)
          </li>
          <li>Existing schedule data is preserved and linked by period index</li>
          <li>
            Period labels are automatically generated in Japanese format (e.g.,
            "1月・2月")
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PeriodsTab;
