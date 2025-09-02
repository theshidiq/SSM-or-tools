import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

// ShadCN UI components
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";

// Import extracted utilities and constants
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

// Import extracted components
import { useScheduleDataRealtime } from "../hooks/useScheduleDataRealtime";
import { useStaffManagement } from "../hooks/useStaffManagement";
import { useSettingsData } from "../hooks/useSettingsData";
import ErrorDisplay from "./schedule/ErrorDisplay";
import StatisticsDashboard from "./schedule/StatisticsDashboard";
import NavigationToolbar from "./schedule/NavigationToolbar";
import ScheduleTable from "./schedule/ScheduleTable";
import StaffCardView from "./schedule/StaffCardView";
import StaffEditModal from "./schedule/StaffEditModal";
import StatusModal from "./common/StatusModal";
import SettingsModal from "./settings/SettingsModal";


// Manual input integration utilities (development only)
import { manualInputTestSuite } from "../utils/manualInputTestSuite";
import { dataIntegrityMonitor } from "../utils/dataIntegrityUtils";
import { runPhase1TestSuite } from "../utils/phase1Validation";

const ShiftScheduleEditorRealtime = ({
  supabaseScheduleData: legacySupabaseScheduleData, // Legacy prop - not used
  error: externalError, // Legacy prop
  onSaveSchedule: legacyOnSaveSchedule, // Legacy prop - not used
  loadScheduleData: legacyLoadScheduleData, // Legacy prop - not used
}) => {
  // Main state - initialize with 0, will be updated when periods load
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

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
  const { periods: realtimePeriods, isLoading: periodsLoading } = usePeriodsRealtime();

  // Initialize current month index when periods are loaded
  useEffect(() => {
    if (!periodsLoading && realtimePeriods.length > 0) {
      try {
        const correctIndex = getCurrentMonthIndex(realtimePeriods);
        setCurrentMonthIndex(correctIndex);
        console.log(`📅 Set initial period index to ${correctIndex} (${realtimePeriods[correctIndex]?.label})`);
      } catch (error) {
        console.warn("Failed to get current month index, using 0:", error);
        setCurrentMonthIndex(0);
      }
    }
  }, [periodsLoading, realtimePeriods]);

  // Ensure currentMonthIndex stays in bounds when periods change (e.g., after deletion)
  useEffect(() => {
    if (!periodsLoading && realtimePeriods.length > 0) {
      if (currentMonthIndex >= realtimePeriods.length) {
        const newIndex = Math.max(0, realtimePeriods.length - 1);
        setCurrentMonthIndex(newIndex);
        console.log(`🔄 Period index out of bounds after deletion, adjusted to ${newIndex} (${realtimePeriods[newIndex]?.label})`);
      }
    } else if (!periodsLoading && realtimePeriods.length === 0) {
      // No periods available, set to 0 but UI should show empty state
      setCurrentMonthIndex(0);
      console.log('🔄 No periods available, set index to 0');
    }
  }, [currentMonthIndex, realtimePeriods, periodsLoading]);

  // Custom hooks - NEW REAL-TIME VERSION
  const {
    schedule,
    dateRange,
    staffMembersByMonth,
    setStaffMembersByMonth,
    updateSchedule,
    updateShift,
    scheduleAutoSave,
    currentScheduleId,
    setCurrentScheduleId,
    isConnected,
    isLoading: isSupabaseLoading,
    isSaving,
    error: supabaseError,
  } = useScheduleDataRealtime(currentMonthIndex);

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

  // Staff management hook
  const {
    staffMembers,
    hasLoadedFromDb,
    isAddingNewStaff,
    setIsAddingNewStaff,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    showStaffEditModal,
    setShowStaffEditModal,
    editingStaffData,
    setEditingStaffData,
    createNewStaff,
    editStaffName,
    deleteStaff,
    addStaff: addStaffMember,
    updateStaff: editStaffInfo,
  } = useStaffManagement(
    currentMonthIndex,
    null, // supabaseScheduleData - using real-time hook instead
    null, // loadScheduleData - using real-time hook instead
  );

  // Alias for compatibility with existing code
  const localStaffData = staffMembers;

  // Error state - combine all possible errors
  const error = externalError || supabaseError || settingsError || autosaveError;

  // Real-time status indicator
  const realtimeStatus = useMemo(() => {
    if (!isConnected) return { status: "disconnected", message: "Offline" };
    if (isSaving) return { status: "saving", message: "Saving..." };
    if (isSupabaseLoading) return { status: "loading", message: "Loading..." };
    return { status: "connected", message: "Real-time" };
  }, [isConnected, isSaving, isSupabaseLoading]);

  // Development utilities setup
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Set up manual input test capabilities
      const testRunner = manualInputTestSuite;

      // Set up data integrity monitoring
      const integrityMonitor = dataIntegrityMonitor;

      // Expose to window for debugging
      window.manualInputTestSuite = testRunner;
      window.dataIntegrityMonitor = integrityMonitor;
      window.runPhase1TestSuite = runPhase1TestSuite;

      // Development tools initialized
      // Manual input testing tools available
      // Data integrity monitor available
      // Phase 1 test suite available

      return () => {
        delete window.manualInputTestSuite;
        delete window.dataIntegrityMonitor;
        delete window.runPhase1TestSuite;
      };
    }
  }, [updateShift, schedule, staffMembers, currentMonthIndex]);

  // Helper functions (placeholder implementations)
  const cleanupAllPeriods = useCallback(() => {
    // cleanupAllPeriods placeholder
    return Promise.resolve();
  }, []);

  const fixStaffInconsistencies = useCallback(() => {
    // fixStaffInconsistencies placeholder
    return Promise.resolve();
  }, []);

  // Connection status check function
  const checkConnectionStatus = useCallback(() => {
    // Checking connection status
    return Promise.resolve({
      isConnected: isConnected,
      status: realtimeStatus.status,
      message: realtimeStatus.message
    });
  }, [isConnected, realtimeStatus]);

  // Generate ordered staff members
  const orderedStaffMembers = useMemo(() => {
    if (
      isSupabaseLoading ||
      !Array.isArray(staffMembers) ||
      staffMembers.length === 0
    ) {
      return [];
    }
    return getOrderedStaffMembers(staffMembers);
  }, [staffMembers, isSupabaseLoading]);

  // Generate statistics
  const statistics = useMemo(() => {
    if (!schedule || Object.keys(schedule).length === 0) return [];
    return generateStatistics(schedule, staffMembers, dateRange);
  }, [schedule, staffMembers, dateRange]);

  // Month navigation handlers
  const handleMonthChange = useCallback((newMonthIndex) => {
    if (newMonthIndex >= 0 && newMonthIndex < realtimePeriods.length) {
      setCurrentMonthIndex(newMonthIndex);
      setShowMonthPicker(false);
      setEditingColumn(null);
      setEditingNames({});
      setShowDropdown(null);
    }
  }, [realtimePeriods]);

  const handleNextPeriod = useCallback(() => {
    if (currentMonthIndex < realtimePeriods.length - 1) {
      handleMonthChange(currentMonthIndex + 1);
    }
    // REMOVED: Automatic period creation when reaching end
    // Users must now explicitly use "Add Table" button to create periods
  }, [currentMonthIndex, handleMonthChange, realtimePeriods]);

  const handlePrevPeriod = useCallback(() => {
    if (currentMonthIndex > 0) {
      handleMonthChange(currentMonthIndex - 1);
    }
  }, [currentMonthIndex, handleMonthChange, realtimePeriods]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    exportToCSV(schedule, orderedStaffMembers, dateRange);
  }, [schedule, orderedStaffMembers, dateRange]);

  const handlePrint = useCallback(() => {
    printSchedule();
  }, []);

  // Delete period handlers
  const handleDeletePeriod = useCallback(() => {
    const periodLabel =
      realtimePeriods[currentMonthIndex]?.label || "current period";

    // Allow deletion of all periods now - user can recreate with "Add Table"
    const warningMessage = realtimePeriods.length <= 1 
      ? `Are you sure you want to delete the last period "${periodLabel}"? This will remove all schedule data. You can recreate periods using the "Add Table" button.`
      : `Are you sure you want to completely delete the period "${periodLabel}"? This will permanently remove the entire period table from the system, including all schedule data and staff assignments for this period. This action cannot be undone.`;

    // Show confirmation modal for complete period deletion
    setDeleteModal({
      isOpen: true,
      type: "confirm",
      title: "Delete Entire Period",
      message: warningMessage,
    });
  }, [currentMonthIndex, realtimePeriods]);

  const confirmDeletePeriod = useCallback(async () => {
    const periodToDeleteLabel = realtimePeriods[currentMonthIndex]?.label || "current period";
    
    // Show loading modal
    setDeleteModal({
      isOpen: true,
      type: "loading",
      title: "Deleting Period",
      message: `Please wait while we delete the period "${periodToDeleteLabel}"...`,
    });

    try {
      // Step 1: Delete the period from the system
      // Pass realtimePeriods to avoid race condition with periodsCache
      const deletionResult = await deletePeriod(currentMonthIndex, realtimePeriods);
      
      if (!deletionResult.success) {
        throw new Error(deletionResult.error);
      }

      // Step 2: Handle navigation based on remaining periods
      if (deletionResult.isEmpty) {
        // All periods deleted - set to index 0 but with no valid period
        console.log(`🔄 All periods deleted - UI will show empty state`);
        setCurrentMonthIndex(0);
      } else {
        // Navigate to a valid remaining period
        const newCurrentIndex = deletionResult.suggestedNavigationIndex;
        console.log(`🔄 Navigating to period ${newCurrentIndex} after deletion`);
        setCurrentMonthIndex(newCurrentIndex);
      }

      // Step 3: Clear any cached data for deleted periods
      try {
        // Clear localStorage cache for periods that no longer exist
        const savedScheduleByMonth = JSON.parse(localStorage.getItem("schedule-by-month-data") || "{}");
        const savedStaffByMonth = JSON.parse(localStorage.getItem("staff-by-month-data") || "{}");
        
        // Remove data for periods that are now out of range due to deletion
        Object.keys(savedScheduleByMonth).forEach(key => {
          const periodIndex = parseInt(key);
          if (periodIndex >= realtimePeriods.length) {
            delete savedScheduleByMonth[key];
          }
        });
        
        Object.keys(savedStaffByMonth).forEach(key => {
          const periodIndex = parseInt(key);
          if (periodIndex >= realtimePeriods.length) {
            delete savedStaffByMonth[key];
          }
        });
        
        localStorage.setItem("schedule-by-month-data", JSON.stringify(savedScheduleByMonth));
        localStorage.setItem("staff-by-month-data", JSON.stringify(savedStaffByMonth));
      } catch (cacheError) {
        console.warn("Failed to clean up cached data after period deletion:", cacheError);
      }

      // Simulate some processing time for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Show success modal with appropriate message
      const successMessage = deletionResult.isEmpty
        ? `The period "${deletionResult.deletedPeriod.label}" has been deleted. All periods have been removed. Use the "Add Table" button to create new periods.`
        : `The period "${deletionResult.deletedPeriod.label}" has been completely removed from the system.${
            realtimePeriods[deletionResult.suggestedNavigationIndex] 
              ? ` Navigated to "${realtimePeriods[deletionResult.suggestedNavigationIndex].label}".` 
              : ""
          }`;

      setDeleteModal({
        isOpen: true,
        type: "success",
        title: "Period Deleted Successfully!",
        message: successMessage,
      });
    } catch (error) {
      console.error("❌ Failed to delete period:", error);

      // Show error modal
      setDeleteModal({
        isOpen: true,
        type: "error",
        title: "Deletion Failed",
        message: `Failed to delete period: ${error.message}`,
      });
    }
  }, [currentMonthIndex, realtimePeriods]);

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({
      isOpen: false,
      type: "confirm",
      title: "",
      message: "",
    });
  }, []);

  // Add new column handler
  const addNewColumn = useCallback(() => {
    // Add a new staff member - trigger the staff modal
    setIsAddingNewStaff(true);
    setShowStaffEditModal(true);
    setEditingStaffData(null);
  }, [setIsAddingNewStaff, setShowStaffEditModal, setEditingStaffData]);

  // AI enable handler
  const handleEnableAI = useCallback((enabled = true) => {
    setAiEnabled(enabled);
    console.log(`AI ${enabled ? 'enabled' : 'disabled'}`);
  }, []);


  // Show loading state while periods are being loaded
  if (periodsLoading || realtimePeriods.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Loading periods...</h3>
          <p className="text-sm text-muted-foreground">Setting up schedule periods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* Error Display */}
        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>
              エラーが発生しました: {error?.message || error}
            </AlertDescription>
          </Alert>
        )}


      {/* Navigation Toolbar */}
      <NavigationToolbar
        currentMonthIndex={currentMonthIndex}
        onMonthChange={handleMonthChange}
        showMonthPicker={showMonthPicker}
        setShowMonthPicker={setShowMonthPicker}
        editingColumn={editingColumn}
        setEditingColumn={setEditingColumn}
        setJustEnteredEditMode={setJustEnteredEditMode}
        addNewColumn={addNewColumn}
        setShowStaffEditModal={setShowStaffEditModal}
        handleExport={handleExportCSV}
        handlePrint={handlePrint}
        handleAddTable={async () => {
          // Only add next period when user explicitly clicks the button
          // This prevents automatic period creation
          try {
            const newPeriodIndex = await addNextPeriod();
            if (typeof newPeriodIndex === 'number' && newPeriodIndex >= 0) {
              setCurrentMonthIndex(newPeriodIndex);
            }
          } catch (error) {
            console.error('Failed to add next period:', error);
          }
        }}
        handleDeletePeriod={handleDeletePeriod}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        scheduleData={schedule}
        staffMembers={staffMembers}
        updateSchedule={updateSchedule}
        onShowSettings={() => setShowSettingsModal(true)}
        aiEnabled={aiEnabled}
        onEnableAI={handleEnableAI}
      />

      {/* Main Content */}
      {viewMode === "table" ? (
        <ScheduleTable
          orderedStaffMembers={orderedStaffMembers}
          dateRange={dateRange}
          schedule={schedule}
          editingColumn={editingColumn}
          editingSpecificColumn={editingSpecificColumn}
          editingNames={editingNames}
          setEditingNames={setEditingNames}
          setEditingSpecificColumn={setEditingSpecificColumn}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          updateShift={updateShift}
          customText={customText}
          setCustomText={setCustomText}
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          deleteStaff={deleteStaff}
          staffMembers={staffMembers}
          updateSchedule={updateSchedule}
          setStaffMembersByMonth={setStaffMembersByMonth}
          currentMonthIndex={currentMonthIndex}
          scheduleAutoSave={scheduleAutoSave}
          editStaffName={editStaffName}
        />
      ) : (
        <StaffCardView
          orderedStaffMembers={orderedStaffMembers}
          dateRange={dateRange}
          schedule={schedule}
          updateShift={updateShift}
          statistics={statistics}
          currentMonthIndex={currentMonthIndex}
        />
      )}

        {/* Statistics Dashboard */}
        <div className="mt-8">
          <StatisticsDashboard
            statistics={statistics}
            staffMembers={orderedStaffMembers}
            schedule={schedule}
            dateRange={dateRange}
            currentMonthIndex={currentMonthIndex}
          />
        </div>

      {/* Modals */}
      <StaffEditModal
        showStaffEditModal={showStaffEditModal}
        setShowStaffEditModal={setShowStaffEditModal}
        isAddingNewStaff={isAddingNewStaff}
        setIsAddingNewStaff={setIsAddingNewStaff}
        selectedStaffForEdit={selectedStaffForEdit}
        setSelectedStaffForEdit={setSelectedStaffForEdit}
        editingStaffData={editingStaffData}
        setEditingStaffData={setEditingStaffData}
        staffMembers={staffMembers || []}
        dateRange={dateRange || []}
        handleCreateStaff={createNewStaff}
        updateStaff={editStaffInfo}
        deleteStaff={deleteStaff}
        schedule={schedule || {}}
        updateSchedule={updateSchedule}
        setStaffMembersByMonth={setStaffMembersByMonth}
        currentMonthIndex={currentMonthIndex}
        scheduleAutoSave={scheduleAutoSave}
        clearAndRefreshFromDatabase={() => {
          // Real-time version doesn't need this function as data is automatically synced
          console.log("Real-time version - data auto-synced");
        }}
        isRefreshingFromDatabase={isSupabaseLoading}
      />

      <StatusModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeletePeriod}
        title={deleteModal.title}
        message={deleteModal.message}
        type={deleteModal.type}
        confirmText={deleteModal.type === "confirm" ? "Delete Period" : "Delete"}
        cancelText="Cancel"
        autoCloseDelay={deleteModal.type === "success" ? 2000 : null}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onSaveSettings={saveSettings}
        onResetToDefaults={resetToDefaults}
        hasUnsavedChanges={hasUnsavedChanges}
        validationErrors={validationErrors}
        connectionStatus={connectionStatus}
        onCheckConnection={checkConnectionStatus}
        isAutosaving={isAutosaving}
        lastSaveTime={lastSaveTime}
        autosaveError={autosaveError}
        isAutosaveEnabled={isAutosaveEnabled}
        onToggleAutosave={setIsAutosaveEnabled}
      />

      </div>
    </div>
  );
};

export default ShiftScheduleEditorRealtime;