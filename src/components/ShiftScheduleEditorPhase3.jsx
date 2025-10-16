import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

// ShadCN UI components
import {
  addNextPeriod,
  deletePeriod,
  getCurrentMonthIndex,
} from "../utils/dateUtils";
import { getOrderedStaffMembers } from "../utils/staffUtils";
import { generateStatistics } from "../utils/statisticsUtils";
import { exportToCSV, printSchedule } from "../utils/exportUtils";

// Phase 6: Import the WebSocket-first prefetch hook
import { useScheduleDataPrefetch } from "../hooks/useScheduleDataPrefetch";
import "../utils/debugUtils"; // Import debug utilities for browser exposure

import { useSettingsData } from "../hooks/useSettingsData";
import { SettingsProvider } from "../contexts/SettingsContext";
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
  supabaseScheduleData: _legacySupabaseScheduleData, // Legacy prop - not used
  error: externalError, // Legacy prop
  onSaveSchedule: _legacyOnSaveSchedule, // Legacy prop - not used
  loadScheduleData: _legacyLoadScheduleData, // Legacy prop - not used
  showSettingsModal: externalShowSettingsModal, // External control from App.js
  setShowSettingsModal: externalSetShowSettingsModal, // External control from App.js
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

  // Fullscreen mode state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
  });

  // Use external showSettingsModal state if provided, otherwise use internal state
  const showSettingsModal =
    externalShowSettingsModal !== undefined ? externalShowSettingsModal : false;
  const setShowSettingsModal = externalSetShowSettingsModal || (() => {});

  // WebSocket-first prefetch hook (replaces separate usePeriodsRealtime and data management)
  const {
    periods: realtimePeriods,
    staff: prefetchStaff,
    schedule: prefetchSchedule,
    dateRange: prefetchDateRange,
    isLoading: prefetchLoading,
    isConnected: prefetchConnected,
    error: prefetchError,
    currentScheduleId: prefetchScheduleId,
    updateShift: prefetchUpdateShift,
    updateSchedule: prefetchUpdateSchedule,
    addStaff: prefetchAddStaff,
    updateStaff: prefetchUpdateStaff,
    deleteStaff: prefetchDeleteStaff,
    refetchAllData: refetchPrefetchData,
    invalidateAllPeriodsCache, // Phase 3: Cache invalidation for database refresh
    prefetchStats,
    phase: prefetchPhase,
    webSocketEnabled: isPrefetchWebSocketEnabled,
    fallbackMode,
  } = useScheduleDataPrefetch(currentMonthIndex, { enabled: true });

  // For backwards compatibility, create aliases
  const periodsLoading = prefetchLoading;
  const forcePeriodsRefresh = refetchPrefetchData;

  // Initialize current month index when periods are loaded (prevent race conditions)
  useEffect(() => {
    if (
      !periodsLoading &&
      realtimePeriods.length > 0 &&
      !isInitializedRef.current
    ) {
      const initializeIndex = async () => {
        try {
          const correctIndex = await getCurrentMonthIndex(realtimePeriods);
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
      };

      initializeIndex();
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

  // Use prefetch data directly (WebSocket-first with built-in fallback)
  const effectiveStaffMembers = prefetchStaff;
  const effectiveStaffOps = {
    updateStaff: prefetchUpdateStaff,
    addStaff: prefetchAddStaff,
    deleteStaff: prefetchDeleteStaff,
  };

  // Connection state from prefetch hook
  const isConnected = prefetchConnected;
  const isSupabaseLoading = prefetchLoading;
  const lastError = prefetchError;

  // Use prefetch schedule data
  const schedule = prefetchSchedule;
  const currentScheduleId = prefetchScheduleId;
  const dateRange = prefetchDateRange;
  const updateSchedule = prefetchUpdateSchedule;
  const updateShift = prefetchUpdateShift;
  const isSaving = false; // TODO: implement from prefetch hook
  const supabaseError = lastError;

  // Debug logging for prefetch architecture
  useEffect(() => {
    const throttleTimeout = setTimeout(() => {
      console.log(
        `🚀 [PREFETCH] State: period=${currentMonthIndex}, phase="${prefetchPhase}", webSocket=${isPrefetchWebSocketEnabled}, fallback=${fallbackMode}, staff=${effectiveStaffMembers?.length || 0}`,
      );
    }, 100);

    return () => clearTimeout(throttleTimeout);
  }, [
    currentMonthIndex,
    prefetchPhase,
    isPrefetchWebSocketEnabled,
    fallbackMode,
    effectiveStaffMembers?.length,
  ]);

  // Settings hook (unchanged)
  const {
    settings,
    isLoading: isLoadingSettings,
    error: settingsError,
    hasUnsavedChanges,
    validationErrors,
    connectionStatus: settingsConnectionStatus,
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
        `🔍 [Modal Debug] Staff members passed to modal: ${effectiveStaffMembers?.length || 0} staff`,
      );
      console.log(
        `🔍 [Modal Debug] Staff members:`,
        effectiveStaffMembers?.map((s) => ({ id: s.id, name: s.name })) || [],
      );
    }
  }, [effectiveStaffMembers, showStaffEditModal]);

  // Phase 4: Staff management is now handled directly by prefetch hook functions

  const editStaffName = useCallback(
    (staffId, newName, onSuccess) => {
      effectiveStaffOps.updateStaff(staffId, { name: newName }, onSuccess);
    },
    [effectiveStaffOps],
  );

  // Alias for compatibility with existing code
  const localStaffData = effectiveStaffMembers;
  const hasLoadedFromDb =
    !!effectiveStaffMembers && effectiveStaffMembers.length > 0;

  // Error state - combine all possible errors
  const error =
    externalError || supabaseError || settingsError || autosaveError;

  // Real-time status indicator with WebSocket-first prefetch + Phase 4 instant navigation indicator
  const realtimeStatus = useMemo(() => {
    // Phase 4: Show instant navigation status when all periods are prefetched
    const hasAllPeriodsData = prefetchStats?.memoryUsage?.periodCount > 0;
    const isInstantNavEnabled = !fallbackMode && hasAllPeriodsData;

    // FIX: If all periods are cached, navigation is instant even if momentarily disconnected
    // Only show offline when truly disconnected AND no cached data available
    if (!isConnected && !hasAllPeriodsData)
      return { type: "error", message: "Offline Mode", instantNav: false };
    if (isSaving)
      return {
        type: "saving",
        message: "Saving...",
        instantNav: isInstantNavEnabled,
      };
    if (isSupabaseLoading && !hasAllPeriodsData)
      return { type: "loading", message: "Loading...", instantNav: false };

    // Phase 4: Show instant navigation status (even if momentarily disconnected, cache keeps it working)
    return {
      type: "connected",
      message: isInstantNavEnabled ? "⚡ Instant Navigation" : "Database Sync",
      instantNav: isInstantNavEnabled,
      periodsCached: prefetchStats?.memoryUsage?.periodCount || 0,
    };
  }, [isConnected, isSaving, isSupabaseLoading, fallbackMode, prefetchStats]);

  // Process current staff and generate stats - use normalized staff data
  const currentStaff = useMemo(() => {
    // Phase 3: Use normalized staff data directly (no more schedule-embedded staff)
    return getOrderedStaffMembers(effectiveStaffMembers || []);
  }, [effectiveStaffMembers]);

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

  // Phase 4: Navigation state for smooth transitions
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef(null);

  // Phase 4: Enhanced navigation with smooth transitions
  const navigateToMonth = useCallback(
    (monthIndex) => {
      if (monthIndex >= 0 && monthIndex < realtimePeriods.length) {
        console.log(
          `📅 [PREFETCH] Navigating to period ${monthIndex} (instant)`,
        );

        // Phase 4: Trigger transition animation
        setIsNavigating(true);

        // Clear any existing timeout
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }

        // Navigate instantly (data is already cached)
        setCurrentMonthIndex(monthIndex);

        // Reset navigation state after animation completes
        navigationTimeoutRef.current = setTimeout(() => {
          setIsNavigating(false);
        }, 200); // Match CSS transition duration
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
      navigateToMonth(newIndex); // Use enhanced navigation
    }
  }, [currentMonthIndex, navigateToMonth]);

  const nextMonth = useCallback(() => {
    if (currentMonthIndex < realtimePeriods.length - 1) {
      const newIndex = currentMonthIndex + 1;
      console.log(
        `📅 [PREFETCH] Next period: ${currentMonthIndex} → ${newIndex} (instant)`,
      );
      navigateToMonth(newIndex); // Use enhanced navigation
    }
  }, [currentMonthIndex, realtimePeriods.length, navigateToMonth]);

  // Phase 4: Cleanup navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

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
    exportToCSV(currentStaff, dateRange, schedule);
  }, [currentStaff, dateRange, schedule]);

  const handlePrint = useCallback(() => {
    printSchedule(currentStaff, dateRange, schedule);
  }, [currentStaff, dateRange, schedule]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Loading state - Skip intermediate loading, go directly to skeleton
  if (periodsLoading) {
    return (
      <div className="shift-schedule-container space-y-6 p-6">
        {/* Header skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">
                調理場シフト表
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
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
        {/* Header card hidden - title moved to toolbar */}

        {/* Error Display - Hidden in fullscreen */}
        {error && !isFullscreen && (
          <Alert className="mb-4">
            <AlertDescription>Error: {error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Toolbar - Sticky at top */}
        <div className="sticky top-0 z-40 bg-white">
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
          isFullscreen={isFullscreen}
          />
        </div>

        {/* Main Interface - Switch between views with Phase 4 smooth transitions */}
        <div
          className={`space-y-4 transition-opacity duration-200 ${
            isNavigating ? "opacity-50" : "opacity-100"
          }`}
          style={{
            // Phase 4: Respect user's motion preferences
            transition: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "none"
              : "opacity 200ms ease-in-out",
          }}
        >
          {viewMode === "table" ? (
            // Phase 4: Only show skeleton during initial load, not during navigation
            isSupabaseLoading && !prefetchStats?.memoryUsage?.periodCount ? (
              <ScheduleTableSkeleton
                staffCount={currentStaff?.length || 5}
                dateCount={dateRange?.length || 31}
                showConnectionStatus={false}
              />
            ) : (
              <div className="sticky top-[64px] z-30 bg-white">
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
                  deleteStaff={effectiveStaffOps.deleteStaff}
                  staffMembers={localStaffData}
                  updateSchedule={handleScheduleUpdate}
                  currentMonthIndex={currentMonthIndex}
                  editStaffName={editStaffName}
                  isConnected={isConnected}
                  hasAllPeriodsData={prefetchStats?.memoryUsage?.periodCount > 0}
                />
              </div>
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
          ) : null}
        </div>

        {/* Statistics Dashboard - Hidden in fullscreen */}
        {viewMode !== "stats" && !isFullscreen && (
          <StatisticsDashboard
            data={statsData}
            currentPeriod={currentPeriod}
            isLoading={
              isSupabaseLoading && !prefetchStats?.memoryUsage?.periodCount
            }
            settings={settings}
          />
        )}

        {/* Staff Edit Modal - Enhanced Real-time Integration */}
        {showStaffEditModal && (
          <StaffEditModal
            showStaffEditModal={showStaffEditModal}
            setShowStaffEditModal={setShowStaffEditModal}
            staffMembers={effectiveStaffMembers}
            schedule={schedule}
            dateRange={dateRange}
            selectedStaffForEdit={selectedStaffForEdit}
            setSelectedStaffForEdit={setSelectedStaffForEdit}
            editingStaffData={editingStaffData}
            setEditingStaffData={setEditingStaffData}
            isAddingNewStaff={isAddingNewStaff}
            setIsAddingNewStaff={setIsAddingNewStaff}
            addStaff={effectiveStaffOps.addStaff}
            updateStaff={effectiveStaffOps.updateStaff}
            deleteStaff={effectiveStaffOps.deleteStaff}
            currentMonthIndex={currentMonthIndex}
            updateSchedule={updateSchedule}
            isSaving={isSaving}
            error={supabaseError}
            invalidateAllPeriodsCache={invalidateAllPeriodsCache} // Phase 3: Cache refresh for database sync
            currentScheduleId={currentScheduleId} // Phase 3: WebSocket shift integration
          />
        )}

        {/* Settings Modal - Phase 2: Using Context API (11 props removed, 73% reduction) */}
        {showSettingsModal && (
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            currentScheduleId={currentScheduleId} // Phase 2: Schedule validation
            staffMembers={effectiveStaffMembers} // Phase 2: Staff data for validation
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
      </div>
  );
};

export default ShiftScheduleEditorPhase3;
