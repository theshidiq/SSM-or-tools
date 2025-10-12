import React, { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Edit2,
  AlertTriangle,
  Check,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { usePeriodsRealtime } from "../../../hooks/usePeriodsRealtime";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Calendar } from "../../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import ConfirmationModal from "../shared/ConfirmationModal";

const PeriodsTab = () => {
  const {
    periods,
    isLoading,
    error,
    addPeriod,
    updatePeriod,
    deletePeriod,
    clearError,
  } = usePeriodsRealtime();

  const [editingPeriod, setEditingPeriod] = useState(null);
  const [editFormData, setEditFormData] = useState({
    startDate: null,
    endDate: null,
    label: "",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate period metadata (duration, continuity)
  const periodsWithMeta = useMemo(() => {
    return periods.map((period, index) => {
      const duration =
        Math.round((period.end - period.start) / (1000 * 60 * 60 * 24)) + 1;

      let isContinuous = true;
      if (index > 0) {
        const prevPeriod = periods[index - 1];
        const prevEndDate = new Date(prevPeriod.end);
        const currentStartDate = new Date(period.start);
        const gap =
          Math.round(
            (currentStartDate - prevEndDate) / (1000 * 60 * 60 * 24)
          ) - 1;
        isContinuous = gap === 0;
      }

      return {
        ...period,
        duration,
        isContinuous,
      };
    });
  }, [periods]);

  // Detect validation issues
  const validationIssues = useMemo(() => {
    const issues = [];

    periodsWithMeta.forEach((period, index) => {
      // Check for gaps
      if (!period.isContinuous && index > 0) {
        issues.push({
          type: "gap",
          periodId: period.id,
          message: `Gap detected between "${periods[index - 1].label}" and "${period.label}"`,
        });
      }

      // Check for overlaps
      for (let i = index + 1; i < periods.length; i++) {
        const otherPeriod = periods[i];
        if (
          period.start <= otherPeriod.end &&
          period.end >= otherPeriod.start
        ) {
          issues.push({
            type: "overlap",
            periodId: period.id,
            message: `Overlap detected between "${period.label}" and "${otherPeriod.label}"`,
          });
        }
      }
    });

    return issues;
  }, [periodsWithMeta, periods]);

  // Start editing a period
  const startEditing = useCallback((period) => {
    setEditingPeriod(period.id);
    setEditFormData({
      startDate: new Date(period.start),
      endDate: new Date(period.end),
      label: period.label,
    });
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingPeriod(null);
    setEditFormData({ startDate: null, endDate: null, label: "" });
  }, []);

  // Save edited period
  const saveEdit = useCallback(async () => {
    if (!editingPeriod || !editFormData.startDate || !editFormData.endDate) {
      return;
    }

    try {
      await updatePeriod(
        editingPeriod,
        editFormData.startDate,
        editFormData.endDate,
        editFormData.label
      );
      toast.success("Period updated successfully");
      cancelEditing();
    } catch (err) {
      toast.error(`Failed to update period: ${err.message}`);
    }
  }, [editingPeriod, editFormData, updatePeriod, cancelEditing]);

  // Add new period (smart date suggestion)
  const handleAddPeriod = useCallback(async () => {
    let suggestedStart, suggestedEnd, suggestedLabel;

    if (periods.length > 0) {
      // Suggest next period after the last one
      const lastPeriod = periods[periods.length - 1];
      suggestedStart = new Date(lastPeriod.end);
      suggestedStart.setDate(suggestedStart.getDate() + 1);
      suggestedEnd = new Date(suggestedStart);
      suggestedEnd.setDate(suggestedEnd.getDate() + 30); // ~1 month

      // Auto-generate label based on months
      const startMonth = suggestedStart.getMonth() + 1;
      const endMonth = suggestedEnd.getMonth() + 1;
      suggestedLabel = `${startMonth}月・${endMonth}月`;
    } else {
      // First period - use current date
      suggestedStart = new Date();
      suggestedEnd = new Date();
      suggestedEnd.setDate(suggestedEnd.getDate() + 30);
      suggestedLabel = "1月・2月";
    }

    try {
      await addPeriod(suggestedStart, suggestedEnd, suggestedLabel);
      toast.success("Period added successfully");
    } catch (err) {
      toast.error(`Failed to add period: ${err.message}`);
    }
  }, [periods, addPeriod]);

  // Delete period with confirmation
  const handleDeleteClick = useCallback((period) => {
    setDeleteConfirmation(period);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);
    try {
      await deletePeriod(deleteConfirmation.id);
      toast.success("Period deleted successfully");
      setDeleteConfirmation(null);
    } catch (err) {
      toast.error(`Failed to delete period: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmation, deletePeriod]);

  // Render period card
  const renderPeriodCard = useCallback(
    (period) => {
      const isEditing = editingPeriod === period.id;
      const hasIssues = validationIssues.some((i) => i.periodId === period.id);

      return (
        <div
          key={period.id}
          className={`bg-white rounded-xl border-2 p-4 transition-all duration-200 ${
            hasIssues
              ? "border-yellow-400 shadow-lg"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          {/* Period Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CalendarIcon size={20} className="text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editFormData.label}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    className="font-semibold text-lg bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                    autoFocus
                  />
                ) : (
                  <h3 className="font-semibold text-lg text-gray-800 truncate">
                    {period.label}
                  </h3>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={saveEdit}
                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Save changes"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cancel changes"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => startEditing(period)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit period"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(period)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete period"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            {isEditing ? (
              <>
                {/* Start Date Picker */}
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Start Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editFormData.startDate
                          ? format(editFormData.startDate, "PPP", { locale: ja })
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editFormData.startDate}
                        onSelect={(date) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            startDate: date,
                          }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date Picker */}
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    End Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editFormData.endDate
                          ? format(editFormData.endDate, "PPP", { locale: ja })
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editFormData.endDate}
                        onSelect={(date) =>
                          setEditFormData((prev) => ({ ...prev, endDate: date }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Start:</span>
                    <span>{format(period.start, "PPP", { locale: ja })}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">End:</span>
                    <span>{format(period.end, "PPP", { locale: ja })}</span>
                  </div>
                </div>

                {/* Duration Badge */}
                <Badge variant="secondary" className="text-xs">
                  {period.duration} days
                </Badge>

                {/* Continuity Indicator */}
                {period.isContinuous ? (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 size={14} />
                    <span>Continuous from previous</span>
                  </div>
                ) : periods.indexOf(period) > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangle size={14} />
                    <span>Gap detected</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      );
    },
    [
      editingPeriod,
      editFormData,
      validationIssues,
      periods,
      saveEdit,
      cancelEditing,
      startEditing,
      handleDeleteClick,
    ]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading periods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Periods Configuration</h2>
          <p className="text-gray-600">
            Manage scheduling periods for your shift calendar
          </p>
        </div>

        <Button onClick={handleAddPeriod} className="flex items-center gap-2">
          <Plus size={16} />
          Add Period
        </Button>
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

      {/* Validation Warnings */}
      {validationIssues.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-yellow-600" />
            <span className="font-medium text-yellow-800">
              Validation Warnings
            </span>
          </div>
          <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
            {validationIssues.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Periods Grid */}
      {periodsWithMeta.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periodsWithMeta.map(renderPeriodCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <CalendarIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            No Periods Configured
          </h3>
          <p className="text-gray-600 mb-4">
            Create your first period to start scheduling shifts
          </p>
          <Button onClick={handleAddPeriod} className="inline-flex items-center gap-2">
            <Plus size={16} />
            Create First Period
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          isOpen={deleteConfirmation !== null}
          onClose={() => setDeleteConfirmation(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Period"
          message={`Are you sure you want to delete the period "${deleteConfirmation.label}"? This action cannot be undone and may affect existing schedules.`}
          confirmText="Delete Period"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
};

export default PeriodsTab;
