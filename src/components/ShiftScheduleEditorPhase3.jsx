import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

// ShadCN UI components
import { shiftSymbols, getAvailableShifts } from "../constants/shiftConstants";
import {
  monthPeriods,
  addNextPeriod,
  deletePeriod,
  getCurrentMonthIndex,
  findPeriodWithData,
} from "../utils/dateUtils";
import { usePeriodsRealtime } from "../hooks/usePeriodsRealtime";
import { getOrderedStaffMembers } from "../utils/staffUtils";
import { generateStatistics } from "../utils/statisticsUtils";
import { exportToCSV, printSchedule } from "../utils/exportUtils";

// Phase 4: Import the unified prefetch hook (replaces competing hooks)
import { useScheduleDataPrefetch } from "../hooks/useScheduleDataPrefetch";

import { useSettingsData } from "../hooks/useSettingsData";
// Phase 3: Removed localStorage-dependent utilities for pure database integration
// - manualInputTestSuite (development testing only)
// - dataIntegrityMonitor (uses localStorage fallbacks)
// - runPhase1TestSuite (validates localStorage data)
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";

// Import extracted components
// import ErrorDisplay from "./schedule/ErrorDisplay"; // Temporarily disabled for Phase 3 testing
import StatisticsDashboard from "./schedule/StatisticsDashboard";
import NavigationToolbar from "./schedule/NavigationToolbar";
import ScheduleTable from "./schedule/ScheduleTable";
import ScheduleTableSkeleton from "./schedule/ScheduleTableSkeleton";
import StaffCardView from "./schedule/StaffCardView";
import StaffEditModal from "./schedule/StaffEditModal";
import StatusModal from "./common/StatusModal";
import SettingsModal from "./settings/SettingsModal";

const ShiftScheduleEditorPhase3 = ({
  supabaseScheduleData: legacySupabaseScheduleData, // Legacy prop - not used
  error: externalError, // Legacy prop
  onSaveSchedule: legacyOnSaveSchedule, // Legacy prop - not used
  loadScheduleData: legacyLoadScheduleData, // Legacy prop - not used
}) => {
  // Main state - initialize with 0, will be updated when periods load
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [pendingNavigationToPeriod, setPendingNavigationToPeriod] =
    useState(null);

  // Ref to track initialization state (no timeout needed with prefetch)
  const isInitializedRef = useRef(false);

  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'

  // UI state
  const [showDropdown, setShowDropdown] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingSpecificColumn, setEditingSpecificColumn] = useState(null);
  const [editingNames, setEditingNames] = useState({});
  const [justEnteredEditMode, setJustEnteredEditMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);

  // Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Period management hook
  const {
    periods: realtimePeriods,
    isLoading: periodsLoading,
    forceRefresh: forcePeriodsRefresh,
  } = usePeriodsRealtime();

  // Initialize current month index when periods are loaded (prevent race conditions)
  useEffect(() => {
    if (
      !periodsLoading &&
      realtimePeriods.length > 0 &&
      !isInitializedRef.current
    ) {
      try {
        const correctIndex = getCurrentMonthIndex(realtimePeriods);
        setCurrentMonthIndex(correctIndex);
        isInitializedRef.current = true; // Mark as initialized to prevent subsequent updates
        console.log(
          `📅 [Phase 3] Initial period index set to ${correctIndex} (${realtimePeriods[correctIndex]?.label})`,
        );
      } catch (error) {
        console.warn("Failed to get current month index, using 0:", error);
        setCurrentMonthIndex(0);
        isInitializedRef.current = true;
      }
    }
  }, [periodsLoading, realtimePeriods]);

  // Phase 4: No more navigation timeouts needed with prefetch architecture

  // Handle navigation to newly added period and bounds checking
  useEffect(() => {
    if (!periodsLoading && realtimePeriods.length > 0) {
      // Check if we need to navigate to a specific period after adding
      if (pendingNavigationToPeriod) {
        // Phase 4: No timeout clearing needed with instant navigation

        // Find the period by matching the label and dates
        const targetPeriodIndex = realtimePeriods.findIndex((period) => {
          return (
            period.label === pendingNavigationToPeriod.label &&
            period.start.toISOString().split("T")[0] ===
              pendingNavigationToPeriod.start.toISOString().split("T")[0] &&
            period.end.toISOString().split("T")[0] ===
              pendingNavigationToPeriod.end.toISOString().split("T")[0]
          );
        });

        if (targetPeriodIndex >= 0) {
          setCurrentMonthIndex(targetPeriodIndex);
          setPendingNavigationToPeriod(null);
          console.log(
            `📅 [Phase 3] Navigated to newly added period: ${realtimePeriods[targetPeriodIndex]?.label} (index ${targetPeriodIndex})`,
          );
          return;
        }
      }

      // Check if currentMonthIndex is out of bounds (negative or too high)
      if (
        currentMonthIndex < 0 ||
        currentMonthIndex >= realtimePeriods.length
      ) {
        const newIndex = currentMonthIndex < 0 ? 0 : realtimePeriods.length - 1;
        console.log(
          `📅 [Phase 3] Corrected out-of-bounds index ${currentMonthIndex} → ${newIndex}`,
        );
        setCurrentMonthIndex(newIndex);
      }
    }
  }, [
    currentMonthIndex,
    realtimePeriods,
    periodsLoading,
    pendingNavigationToPeriod,
    forcePeriodsRefresh,
  ]);

  // Phase 4: Unified prefetch hook - eliminates all race conditions
  const {
    schedule,
    dateRange,
    staff: staffMembers,
    currentScheduleId,
    setCurrentScheduleId,
    updateSchedule,
    updateShift,
    addStaff: addStaffMember,
    updateStaff: editStaffInfo,
    deleteStaff,
    isConnected,
    isLoading: isSupabaseLoading,
    isSaving,
    error: supabaseError,
    phase: prefetchPhase,
    prefetchStats,
  } = useScheduleDataPrefetch(currentMonthIndex);

  // Debug logging for prefetch architecture
  useEffect(() => {
    console.log(
      `🚀 [PREFETCH] State: period=${currentMonthIndex}, phase="${prefetchPhase}", staff=${staffMembers?.length || 0}, loadTime=${prefetchStats?.loadTime?.toFixed(1)}ms`,
    );
  }, [
    currentMonthIndex,
    prefetchPhase,
    staffMembers?.length,
    prefetchStats?.loadTime,
  ]);

  // Settings hook (unchanged)
  const {
    settings,
    isLoading: isLoadingSettings,
    error: settingsError,
    hasUnsavedChanges,
    validationErrors,
    connectionStatus,
    updateSettings,
    saveSettings,
    resetToDefaults,
    isAutosaving,
    lastSaveTime,
    autosaveError,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
  } = useSettingsData();

  // Phase 4: Staff management handled by unified prefetch hook (no separate hook needed)
  // Staff modal states
  const [isAddingNewStaff, setIsAddingNewStaff] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState(null);
  const [showStaffEditModal, setShowStaffEditModal] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState({
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  });

  // Debug staffMembers changes for modal real-time updates
  useEffect(() => {
    if (showStaffEditModal) {
      console.log(
        `🔍 [Modal Debug] Staff members passed to modal: ${staffMembers.length} staff`,
      );
      console.log(
        `🔍 [Modal Debug] Staff members:`,
        staffMembers.map((s) => ({ id: s.id, name: s.name })),
      );
    }
  }, [staffMembers, showStaffEditModal]);

  // Phase 4: Staff management is now handled directly by prefetch hook functions

  const editStaffName = useCallback(
    (staffId, newName, onSuccess) => {
      editStaffInfo(staffId, { name: newName }, onSuccess);
    },
    [editStaffInfo],
  );

  // Alias for compatibility with existing code
  const localStaffData = staffMembers;
  const hasLoadedFromDb = !!staffMembers && staffMembers.length > 0;

  // Error state - combine all possible errors
  const error =
    externalError || supabaseError || settingsError || autosaveError;

  // Real-time status indicator with Phase 3 details
  const realtimeStatus = useMemo(() => {
    if (!isConnected)
      return { type: "error", message: "Disconnected from database" };
    if (isSaving) return { type: "saving", message: "Saving changes..." };
    if (isSupabaseLoading)
      return { type: "loading", message: "Loading schedule..." };
    return {
      type: "connected",
      message: `Phase 3 Normalized Architecture - Connected`,
    };
  }, [isConnected, isSaving, isSupabaseLoading]);

  // Process current staff and generate stats - use normalized staff data
  const currentStaff = useMemo(() => {
    // Phase 3: Use normalized staff data directly (no more schedule-embedded staff)
    return getOrderedStaffMembers(staffMembers || []);
  }, [staffMembers]);

  // Generate statistics
  const statistics = useMemo(() => {
    return generateStatistics(schedule, currentStaff, dateRange);
  }, [schedule, currentStaff, dateRange]);

  // Prepare data for stats dashboard
  const statsData = useMemo(() => {
    const currentPeriod = realtimePeriods[currentMonthIndex];
    return {
      schedule,
      staff: currentStaff,
      dateRange,
      period: currentPeriod,
      statistics,
    };
  }, [
    schedule,
    currentStaff,
    dateRange,
    realtimePeriods,
    currentMonthIndex,
    statistics,
  ]);

  // Navigation handlers
  const navigateToMonth = useCallback(
    (monthIndex) => {
      if (monthIndex >= 0 && monthIndex < realtimePeriods.length) {
        console.log(
          `📅 [PREFETCH] Navigating to period ${monthIndex} (instant)`,
        );
        setCurrentMonthIndex(monthIndex);
      }
    },
    [realtimePeriods.length],
  );

  const previousMonth = useCallback(() => {
    if (currentMonthIndex > 0) {
      const newIndex = currentMonthIndex - 1;
      console.log(
        `📅 [PREFETCH] Previous period: ${currentMonthIndex} → ${newIndex} (instant)`,
      );
      setCurrentMonthIndex(newIndex);
    }
  }, [currentMonthIndex]);

  const nextMonth = useCallback(() => {
    if (currentMonthIndex < realtimePeriods.length - 1) {
      const newIndex = currentMonthIndex + 1;
      console.log(
        `📅 [PREFETCH] Next period: ${currentMonthIndex} → ${newIndex} (instant)`,
      );
      setCurrentMonthIndex(newIndex);
    }
  }, [currentMonthIndex, realtimePeriods.length]);

  // Add next period handler
  const handleAddNextPeriod = useCallback(async () => {
    try {
      const newPeriod = addNextPeriod(realtimePeriods);
      if (newPeriod) {
        console.log(`➕ [Phase 3] Adding new period: ${newPeriod.label}`);
        setPendingNavigationToPeriod(newPeriod);
        await forcePeriodsRefresh();
      }
    } catch (error) {
      console.error("Failed to add next period:", error);
    }
  }, [realtimePeriods, forcePeriodsRefresh]);

  // Delete period handler
  const handleDeletePeriod = useCallback(
    async (periodIndex) => {
      if (periodIndex < 0 || periodIndex >= realtimePeriods.length) return;

      const periodToDelete = realtimePeriods[periodIndex];
      console.log(
        `🗑️ [Phase 3] Deleting period: ${periodToDelete.label} (index ${periodIndex})`,
      );

      setDeleteModal({
        isOpen: true,
        type: "confirm",
        title: "期間を削除",
        message: `期間「${periodToDelete.label}」を削除しますか？この操作は元に戻せません。`,
        onConfirm: async () => {
          try {
            await deletePeriod(periodIndex, realtimePeriods);

            // Navigate to a valid period after deletion (instant with prefetch)
            const newCurrentIndex = Math.min(
              periodIndex,
              realtimePeriods.length - 2,
            );
            if (newCurrentIndex >= 0) {
              setCurrentMonthIndex(newCurrentIndex);
            }

            await forcePeriodsRefresh();
            setDeleteModal({ isOpen: false });
            console.log(
              `✅ [Phase 3] Deleted period and navigated to index ${newCurrentIndex}`,
            );
          } catch (error) {
            console.error("Failed to delete period:", error);
            setDeleteModal({ isOpen: false });
          }
        },
        onCancel: () => setDeleteModal({ isOpen: false }),
      });
    },
    [realtimePeriods, forcePeriodsRefresh],
  );

  // Staff management handlers
  const handleStaffUpdate = useCallback((updatedStaffData) => {
    console.log(
      `👥 [Phase 3] Staff updated: ${updatedStaffData.length} members`,
    );
    // The normalized hooks handle the update automatically
  }, []);

  const handleScheduleUpdate = useCallback(
    (newScheduleData, source = "auto") => {
      console.log(`📅 [Phase 3] Schedule update from ${source}`);
      updateSchedule(newScheduleData, currentStaff, source);
    },
    [updateSchedule, currentStaff],
  );

  const handleShiftUpdate = useCallback(
    (staffId, dateKey, shiftValue) => {
      console.log(
        `📝 [Phase 3] Shift update: ${staffId} → ${dateKey} = "${shiftValue}"`,
      );
      updateShift(staffId, dateKey, shiftValue);
    },
    [updateShift],
  );

  // View mode handler
  const handleViewModeChange = useCallback((newViewMode) => {
    if (
      newViewMode === "table" ||
      newViewMode === "card" ||
      newViewMode === "stats"
    ) {
      setViewMode(newViewMode);
      console.log(`📱 [Phase 3] View mode changed to: ${newViewMode}`);
    } else {
      console.warn("Invalid view mode:", newViewMode);
    }
  }, []);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    const currentPeriod = realtimePeriods[currentMonthIndex];
    exportToCSV(schedule, currentStaff, dateRange, currentPeriod?.label || "");
  }, [schedule, currentStaff, dateRange, realtimePeriods, currentMonthIndex]);

  const handlePrint = useCallback(() => {
    const currentPeriod = realtimePeriods[currentMonthIndex];
    printSchedule(
      schedule,
      currentStaff,
      dateRange,
      currentPeriod?.label || "",
    );
  }, [schedule, currentStaff, dateRange, realtimePeriods, currentMonthIndex]);

  // Loading state - Skip intermediate loading, go directly to skeleton
  if (periodsLoading) {
    return (
      <div className="shift-schedule-container space-y-6 p-6">
        {/* Header skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">調理場シフト表</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Phase 3: Normalized
                </Badge>
                <Badge variant="default" className="bg-blue-500 text-white">
                  Loading...
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Show skeleton immediately */}
        <ScheduleTableSkeleton
          staffCount={5}
          dateCount={31}
          showConnectionStatus={false}
        />
      </div>
    );
  }

  // No periods available
  if (!realtimePeriods || realtimePeriods.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <Alert>
              <AlertDescription>
                期間データがありません。システム管理者にお問い合わせください。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPeriod = realtimePeriods[currentMonthIndex];

  return (
    <div className="shift-schedule-container space-y-6 p-6">
      {/* Header with Phase 3 indicator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">調理場シフト表</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                Phase 3: Normalized
              </Badge>
              <Badge
                variant={isConnected ? "default" : "destructive"}
                className={
                  isConnected
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }
              >
                {realtimeStatus.message}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display - Temporarily disabled for Phase 3 testing */}
      {error && (
        <Alert className="mb-4">
          <AlertDescription>Error: {error}</AlertDescription>
        </Alert>
      )}

      {/* Navigation Toolbar */}
      <NavigationToolbar
        currentMonthIndex={currentMonthIndex}
        periods={realtimePeriods}
        onMonthChange={navigateToMonth}
        onPrevious={previousMonth}
        onNext={nextMonth}
        showMonthPicker={showMonthPicker}
        setShowMonthPicker={setShowMonthPicker}
        editingColumn={editingColumn}
        setEditingColumn={setEditingColumn}
        setJustEnteredEditMode={setJustEnteredEditMode}
        addNewColumn={() => {}} // Placeholder function
        setShowStaffEditModal={setShowStaffEditModal}
        handleExport={handleExportCSV}
        handlePrint={handlePrint}
        handleAddTable={handleAddNextPeriod}
        handleDeletePeriod={() => handleDeletePeriod(currentMonthIndex)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        scheduleData={schedule}
        staffMembers={currentStaff}
        updateSchedule={handleScheduleUpdate}
        onShowSettings={() => setShowSettingsModal(true)}
        aiEnabled={aiEnabled}
        onEnableAI={setAiEnabled}
        isConnected={isConnected}
        isSaving={isSaving}
      />

      {/* Main Interface - Switch between views */}
      <div className="space-y-4">
        {viewMode === "table" ? (
          isSupabaseLoading ? (
            <ScheduleTableSkeleton
              staffCount={currentStaff?.length || 5}
              dateCount={dateRange?.length || 31}
              showConnectionStatus={false}
            />
          ) : (
            <ScheduleTable
              orderedStaffMembers={currentStaff}
              dateRange={dateRange}
              schedule={schedule}
              editingColumn={editingColumn}
              editingSpecificColumn={editingSpecificColumn}
              editingNames={editingNames}
              setEditingNames={setEditingNames}
              setEditingSpecificColumn={setEditingSpecificColumn}
              showDropdown={showDropdown}
              setShowDropdown={setShowDropdown}
              updateShift={handleShiftUpdate}
              customText={customText}
              setCustomText={setCustomText}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              deleteStaff={deleteStaff}
              staffMembers={localStaffData}
              updateSchedule={handleScheduleUpdate}
              currentMonthIndex={currentMonthIndex}
              editStaffName={editStaffName}
              isConnected={isConnected}
            />
          )
        ) : viewMode === "card" ? (
          <StaffCardView
            orderedStaffMembers={currentStaff}
            schedule={schedule}
            dateRange={dateRange}
            currentPeriod={currentPeriod}
            onShiftUpdate={handleShiftUpdate}
            settings={settings}
          />
        ) : viewMode === "stats" ? (
          <StatisticsDashboard
            data={statsData}
            currentPeriod={currentPeriod}
            isLoading={isSupabaseLoading}
            settings={settings}
          />
        ) : null}
      </div>

      {/* Staff Edit Modal - Enhanced Real-time Integration */}
      {showStaffEditModal && (
        <StaffEditModal
          showStaffEditModal={showStaffEditModal}
          setShowStaffEditModal={setShowStaffEditModal}
          staffMembers={staffMembers}
          schedule={schedule}
          dateRange={dateRange}
          selectedStaffForEdit={selectedStaffForEdit}
          setSelectedStaffForEdit={setSelectedStaffForEdit}
          editingStaffData={editingStaffData}
          setEditingStaffData={setEditingStaffData}
          isAddingNewStaff={isAddingNewStaff}
          setIsAddingNewStaff={setIsAddingNewStaff}
          addStaff={addStaffMember}
          updateStaff={editStaffInfo}
          deleteStaff={deleteStaff}
          currentMonthIndex={currentMonthIndex}
          updateSchedule={updateSchedule}
          isSaving={isSaving}
          error={supabaseError}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSettingsUpdate={updateSettings}
          onSaveSettings={saveSettings}
          onResetToDefaults={resetToDefaults}
          hasUnsavedChanges={hasUnsavedChanges}
          validationErrors={validationErrors}
          connectionStatus={connectionStatus}
          isAutosaving={isAutosaving}
          lastSaveTime={lastSaveTime}
          autosaveError={autosaveError}
          isAutosaveEnabled={isAutosaveEnabled}
          setIsAutosaveEnabled={setIsAutosaveEnabled}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <StatusModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false })}
          type={deleteModal.type}
          title={deleteModal.title}
          message={deleteModal.message}
          onConfirm={deleteModal.onConfirm}
          onCancel={deleteModal.onCancel}
        />
      )}

      {/* Development Tools - Phase 3 Testing */}
      {process.env.NODE_ENV === "development" && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Phase 3 Development Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Architecture Status</h4>
                  <p className="text-sm text-muted-foreground">
                    Architecture: {"Phase 4: Prefetch"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Staff: {"Phase 4: Prefetch"} (Normalized)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Real-time Status</h4>
                  <p className="text-sm text-muted-foreground">
                    Connected: {isConnected ? "Yes" : "No"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Schedule ID: {currentScheduleId || "None"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium">Data Summary</h4>
                <p className="text-sm text-muted-foreground">
                  Period: {currentPeriod?.label || "Unknown"} (Index:{" "}
                  {currentMonthIndex})
                </p>
                <p className="text-sm text-muted-foreground">
                  Staff Count: {currentStaff.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Date Range: {dateRange.length} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftScheduleEditorPhase3;
