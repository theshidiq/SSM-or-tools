import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
// Removed unused imports: format, addDays, ja

// Import extracted utilities and constants
import { shiftSymbols, getAvailableShifts } from "../constants/shiftConstants";
import {
  monthPeriods,
  addNextPeriod,
  deletePeriod,
  getCurrentMonthIndex,
  findPeriodWithData,
} from "../utils/dateUtils";
import { getOrderedStaffMembers } from "../utils/staffUtils";
import { generateStatistics } from "../utils/statisticsUtils";
import { exportToCSV, printSchedule } from "../utils/exportUtils";

// Import extracted components - Phase 3: Enhanced Hooks
import { useScheduleDataEnhanced as useScheduleData } from "../hooks/useScheduleDataEnhanced";
import { useStaffManagementEnhanced as useStaffManagement } from "../hooks/useStaffManagementEnhanced";
import { useSettingsDataEnhanced as useSettingsData } from "../hooks/useSettingsDataEnhanced";
import ErrorDisplay from "./schedule/ErrorDisplay";
import StatisticsDashboard from "./schedule/StatisticsDashboard";
import NavigationToolbar from "./schedule/NavigationToolbar";
import ScheduleTable from "./schedule/ScheduleTable";
import StaffCardView from "./schedule/StaffCardView";
import StaffEditModal from "./schedule/StaffEditModal";
import StatusModal from "./common/StatusModal";
import SettingsModal from "./settings/SettingsModal";

// Lazy loaded AI features for better performance
import { Suspense, useState as useAIState, useCallback as useAICallback } from 'react';
import ErrorBoundary from './ui/ErrorBoundary';
import { AILoadingSpinner, DebugToolsLoading, FeatureLoadingProgress } from './ui/LoadingStates';
import { 
  aiFeatureLoader, 
  AI_FEATURES,
  getAIFeatureDefinitions,
  checkAIFeatureSupport
} from './lazy/LazyAIComponents';

// Manual input integration utilities (development only)
import { manualInputTestSuite } from "../utils/manualInputTestSuite";
import { dataIntegrityMonitor } from "../utils/dataIntegrityUtils";

// Import custom hooks

const ShiftScheduleEditor = ({
  supabaseScheduleData,
  error: externalError,
  onSaveSchedule,
  loadScheduleData,
}) => {
  // Main state - initialize with period that has data, or current month
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => {
    try {
      // First try to find a period with data, otherwise use current date
      return findPeriodWithData(supabaseScheduleData);
    } catch (error) {
      console.warn(
        "Failed to get period with data, defaulting to current month:",
        error,
      );
      try {
        return getCurrentMonthIndex();
      } catch (fallbackError) {
        console.warn(
          "Failed to get current month index, defaulting to 0:",
          fallbackError,
        );
        return 0;
      }
    }
  });
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [error, setError] = useState(externalError);
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'

  // UI state
  const [showDropdown, setShowDropdown] = useState(null);
  
  // AI Features state
  const [aiEnabled, setAIEnabled] = useAIState(false);
  const [aiLoading, setAILoading] = useAIState(false);
  const [aiSupported, setAISupported] = useAIState(() => checkAIFeatureSupport());
  const [aiLoadingProgress, setAILoadingProgress] = useAIState(null);
  const [aiFeatureError, setAIFeatureError] = useAIState(null);

  // Wrapper for setShowDropdown
  const setShowDropdownDebug = (value) => {
    setShowDropdown(value);
  };
  const [editingCell, setEditingCell] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingSpecificColumn, setEditingSpecificColumn] = useState(null);
  const [editingNames, setEditingNames] = useState({});
  const [justEnteredEditMode, setJustEnteredEditMode] = useState(false);
  const [customText, setCustomText] = useState("");

  // Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // AI Feature loading
  const enableAIFeatures = useAICallback(async () => {
    if (!aiSupported) {
      setAIFeatureError('AI features are not supported in this browser');
      return;
    }
    
    if (aiEnabled) return; // Already enabled
    
    setAILoading(true);
    setAIFeatureError(null);
    
    try {
      const features = getAIFeatureDefinitions();
      
      // Set up progress listener
      const removeListener = aiFeatureLoader.addProgressListener(setAILoadingProgress);
      
      // Load AI features
      await aiFeatureLoader.loadFeatures(features);
      
      // Cleanup
      removeListener();
      setAILoadingProgress(null);
      setAIEnabled(true);
      
      console.log('✅ AI features loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load AI features:', error);
      setAIFeatureError('Failed to load AI features: ' + error.message);
      setAILoadingProgress(null);
    } finally {
      setAILoading(false);
    }
  }, [aiSupported, aiEnabled]);
  
  const disableAIFeatures = useAICallback(() => {
    setAIEnabled(false);
    setAIFeatureError(null);
    console.log('🔌 AI features disabled');
  }, []);
  
  // Refs - removed unused newColumnInputRef

  // Custom hooks
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
    exportConfiguration,
    importConfiguration,
    checkConnectionStatus,
    // Autosave properties
    isAutosaving,
    lastSaveTime,
    autosaveError,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
  } = useSettingsData(); // Phase 3: No parameters needed for enhanced settings hook
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
    isLoading,
    isSaving,
    error: scheduleError,
    connectionStatus,
    cache,
    offline,
    conflicts,
    getPerformanceMetrics,
    features,
    phase,
    // Offline queue state
    offlineQueue,
    pendingCells,
    hasPendingChanges,
    retryQueuedChanges,
  } = useScheduleData(currentMonthIndex, {
    enableAdvancedCache: true,
    enableOfflineSupport: true,
    enableConflictResolution: true
  }); // Phase 3: Enhanced schedule hook

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
    startAddingNewStaff,
    updateStaff,
    cleanupAllPeriods,
    fixStaffInconsistencies,
    clearAndRefreshFromDatabase,
    isRefreshingFromDatabase,
  } = useStaffManagement(currentMonthIndex, {
    enableAdvancedCache: true,
    enableOfflineSupport: true,
    enableConflictResolution: true
  }); // Phase 3: Enhanced staff management hook

  // Re-evaluate period selection when Supabase data becomes available - ONE TIME ONLY
  const hasEvaluatedPeriod = useRef(false);
  useEffect(() => {
    // Only evaluate once when Supabase data first becomes available
    if (
      supabaseScheduleData &&
      supabaseScheduleData.schedule_data &&
      !hasEvaluatedPeriod.current
    ) {
      const dataBasedPeriod = findPeriodWithData(supabaseScheduleData);

      // Switch to data-based period if it's different from current and has meaningful data
      if (dataBasedPeriod !== currentMonthIndex) {
        console.log(
          `🔄 Switching from period ${currentMonthIndex} to period ${dataBasedPeriod} (found meaningful Supabase data)`,
        );
        setCurrentMonthIndex(dataBasedPeriod);
      }
      hasEvaluatedPeriod.current = true; // Mark as evaluated to prevent re-evaluation
    }
  }, [supabaseScheduleData]); // Remove currentMonthIndex to prevent infinite loop

  // Check if we're still loading - only show loading if Supabase is undefined (initial state)
  // Once we have either data OR null (meaning no data), we can proceed
  const isLoading = supabaseScheduleData === undefined;

  // Expose cleanup functions to global window for debugging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      window.cleanupAllPeriods = cleanupAllPeriods;
      window.fixStaffInconsistencies = fixStaffInconsistencies;
      
      // Manual input testing utilities
      window.testManualInput = () => manualInputTestSuite.runCompleteTestSuite(
        updateShift, schedule, staffMembers, currentMonthIndex
      );
      window.checkDataIntegrity = () => dataIntegrityMonitor.checkCrossPeriodConsistency();
      window.getAutoSaveStats = () => dataIntegrityMonitor.autoSaveMonitor.getStats();
    }
  }, [cleanupAllPeriods, fixStaffInconsistencies, updateShift, schedule, staffMembers, currentMonthIndex]);

  // Check if we have any data at all (including localStorage as backup)
  const localStaffData = useMemo(() => {
    try {
      const savedStaffByMonth = JSON.parse(
        localStorage.getItem("staff-by-month-data") || "{}",
      );
      return savedStaffByMonth[currentMonthIndex] || [];
    } catch {
      return [];
    }
  }, [currentMonthIndex]);

  // Calculate derived data
  const orderedStaffMembers = useMemo(() => {
    if (isLoading) {
      return []; // Don't show anything while loading
    }
    
    // If we have staff members, use them
    if (staffMembers && staffMembers.length > 0) {
      const ordered = getOrderedStaffMembers(staffMembers, dateRange);
      return ordered;
    }

    // If we have Supabase data with staff members, extract and use them
    if (supabaseScheduleData && supabaseScheduleData.schedule_data && supabaseScheduleData.schedule_data._staff_members) {
      const ordered = getOrderedStaffMembers(supabaseScheduleData.schedule_data._staff_members, dateRange);
      return ordered;
    }

    // Fallback to localStorage staff data
    if (localStaffData && localStaffData.length > 0) {
      const ordered = getOrderedStaffMembers(localStaffData, dateRange);
      return ordered;
    }

    return [];
  }, [staffMembers, dateRange, isLoading, supabaseScheduleData, localStaffData, hasLoadedFromDb]);

  const hasAnyStaffData =
    (staffMembers && staffMembers.length > 0) ||
    (supabaseScheduleData &&
      supabaseScheduleData.schedule_data &&
      supabaseScheduleData.schedule_data._staff_members) ||
    (localStaffData && localStaffData.length > 0);

  const statistics = useMemo(
    () => generateStatistics(schedule, staffMembers, dateRange),
    [schedule, staffMembers, dateRange],
  );

  // Initialize custom text when dropdown opens
  useEffect(() => {
    if (showDropdown && !editingCell) {
      // Parse cell key to get current value
      const dateKey = showDropdown.slice(-10);
      const staffId = showDropdown.slice(0, -11);
      const currentCellValue = schedule[staffId]?.[dateKey] || "";

      // Initialize custom text with current cell value
      setCustomText(currentCellValue);
    }
  }, [showDropdown, editingCell, schedule]);

  // Error handling
  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  // Event handlers
  const handleMonthChange = useCallback(
    (newMonthIndex) => {
      // Save current data before switching
      if (
        schedule &&
        Object.keys(schedule).length > 0 &&
        staffMembers &&
        staffMembers.length > 0
      ) {
        scheduleAutoSave(schedule, staffMembers);
      }

      // Allow navigation to any valid period index (not just 0-11)
      if (newMonthIndex >= 0 && newMonthIndex < monthPeriods.length) {
        setCurrentMonthIndex(newMonthIndex);
        setShowMonthPicker(false);
        setShowDropdownDebug(null);
        setEditingCell(null);
        exitEditMode();
      } else {
        console.warn(
          `⚠️ NAVIGATION: Invalid month index ${newMonthIndex}. Available: 0-${monthPeriods.length - 1}`,
        );
      }
    },
    [schedule, staffMembers, scheduleAutoSave],
  );

  const addNewColumn = () => {
    startAddingNewStaff();
  };

  const editColumnName = useCallback(
    (staffId, newName) => {
      editStaffName(staffId, newName, (newStaff) => {
        setStaffMembersByMonth((prev) => ({
          ...prev,
          [currentMonthIndex]: newStaff,
        }));
      });
    },
    [editStaffName, setStaffMembersByMonth, currentMonthIndex],
  );

  const exitEditMode = () => {
    setEditingColumn(null);
    setEditingSpecificColumn(null);
  };

  const handleCreateStaff = (staffData) => {
    const { newStaffMembers, newSchedule } = createNewStaff(
      staffData,
      schedule,
      dateRange,
      updateSchedule,
      (newStaff) => {
        setStaffMembersByMonth((prev) => ({
          ...prev,
          [currentMonthIndex]: newStaff,
        }));
      },
    );

    setTimeout(() => {
      scheduleAutoSave(newSchedule, newStaffMembers);
    }, 0);
  };

  const handleExport = () => {
    exportToCSV(orderedStaffMembers, dateRange, schedule);
  };

  const handlePrint = () => {
    printSchedule(orderedStaffMembers, dateRange, schedule);
  };

  // Settings handlers
  const handleShowSettings = () => {
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (settingsToSave) => {
    try {
      await saveSettings(settingsToSave);
      // Show success message
      setDeleteModal({
        isOpen: true,
        type: "success",
        title: "Settings Saved",
        message: "Your configuration has been saved successfully.",
      });
    } catch (error) {
      // Show error message
      setDeleteModal({
        isOpen: true,
        type: "error",
        title: "Save Failed",
        message: `Failed to save settings: ${error.message}`,
      });
    }
  };

  const handleAddTable = async () => {
    try {
      // Add next period and switch to it
      const newPeriodIndex = await addNextPeriod();
      setCurrentMonthIndex(newPeriodIndex);
      console.log(`✅ Successfully added new period and navigated to index ${newPeriodIndex}`);
    } catch (error) {
      console.error('Failed to add new period:', error);
      setError({
        message: `Failed to add new period: ${error.message}`,
        type: 'error',
        details: 'Please try again or check your connection.'
      });
    }
  };

  const handleDeletePeriod = () => {
    const periodLabel =
      monthPeriods[currentMonthIndex]?.label || "current period";

    // Check if we can delete this period
    if (monthPeriods.length <= 1) {
      setDeleteModal({
        isOpen: true,
        type: "error",
        title: "Cannot Delete Period",
        message: "Cannot delete the last remaining period. At least one period must exist in the system.",
      });
      return;
    }

    // Show confirmation modal for complete period deletion
    setDeleteModal({
      isOpen: true,
      type: "confirm",
      title: "Delete Entire Period",
      message: `Are you sure you want to completely delete the period "${periodLabel}"? This will permanently remove the entire period table from the system, including all schedule data and staff assignments for this period. This action cannot be undone.`,
    });
  };

  const handleViewModeChange = (newViewMode) => {
    if (newViewMode === "table" || newViewMode === "card") {
      setViewMode(newViewMode);
    } else {
      console.warn("Invalid view mode:", newViewMode);
    }
  };

  const confirmDeletePeriod = async () => {
    const periodToDeleteLabel = monthPeriods[currentMonthIndex]?.label || "current period";
    
    // Show loading modal
    setDeleteModal({
      isOpen: true,
      type: "loading",
      title: "Deleting Period",
      message: `Please wait while we delete the period "${periodToDeleteLabel}"...`,
    });

    try {
      // Step 1: Delete the period from the system
      const deletionResult = deletePeriod(currentMonthIndex);
      
      if (!deletionResult.success) {
        throw new Error(deletionResult.error);
      }

      // Step 2: Navigate to a valid remaining period
      const newCurrentIndex = deletionResult.suggestedNavigationIndex;
      console.log(`🔄 Navigating to period ${newCurrentIndex} after deletion`);
      
      // Force update the current month index to trigger re-render with new period
      setCurrentMonthIndex(newCurrentIndex);

      // Step 3: Clear any cached data for the deleted period
      try {
        // Clear localStorage cache for the deleted period if it exists
        const savedScheduleByMonth = JSON.parse(localStorage.getItem("schedule-by-month-data") || "{}");
        const savedStaffByMonth = JSON.parse(localStorage.getItem("staff-by-month-data") || "{}");
        
        // Remove data for periods that are now out of range due to deletion
        Object.keys(savedScheduleByMonth).forEach(key => {
          const periodIndex = parseInt(key);
          if (periodIndex >= monthPeriods.length) {
            delete savedScheduleByMonth[key];
          }
        });
        
        Object.keys(savedStaffByMonth).forEach(key => {
          const periodIndex = parseInt(key);
          if (periodIndex >= monthPeriods.length) {
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

      // Show success modal
      setDeleteModal({
        isOpen: true,
        type: "success",
        title: "Period Deleted Successfully!",
        message: `The period "${deletionResult.deletedPeriod.label}" has been completely removed from the system. Navigated to "${monthPeriods[newCurrentIndex]?.label}".`,
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
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      type: "confirm",
      title: "",
      message: "",
    });
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      try {
        if (!event || !event.target) return;

        if (
          showDropdown &&
          event.target.closest &&
          !event.target.closest(".shift-dropdown")
        ) {
          setShowDropdownDebug(null);
        }

        if (
          showMonthPicker &&
          event.target.closest &&
          !event.target.closest(".month-picker")
        ) {
          setShowMonthPicker(false);
        }

        // Exit edit mode when clicking outside table header
        if (
          (editingColumn === "delete-mode" ||
            editingColumn === "edit-name-mode" ||
            editingSpecificColumn) &&
          event.target.closest &&
          !event.target.closest("th") &&
          !event.target.closest("button") &&
          !justEnteredEditMode
        ) {
          if (editingColumn === "edit-name-mode") {
            Object.keys(editingNames).forEach((staffId) => {
              const newName = editingNames[staffId];
              if (newName && newName.trim()) {
                editColumnName(staffId, newName.trim());
              }
            });
          }
          exitEditMode();
        }

        setJustEnteredEditMode(false);
      } catch (error) {
        console.error("Error in handleClickOutside:", error);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [
    showDropdown,
    showMonthPicker,
    editingColumn,
    editingSpecificColumn,
    justEnteredEditMode,
    editingNames,
    editColumnName,
  ]);

  // Don't render anything until data is loaded
  if (isLoading) {
    return (
      <div className="shift-schedule-editor max-w-full mx-auto bg-white">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-gray-500">Loading schedule data...</div>
        </div>
      </div>
    );
  }

  // Show add user function only when truly no staff data exists anywhere
  if (!hasAnyStaffData && hasLoadedFromDb) {
    return (
      <div className="shift-schedule-editor max-w-full mx-auto bg-white">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="text-gray-600 text-lg">No schedule data found</div>
          <div className="text-gray-500 text-center max-w-md">
            Start by adding staff members to create your shift schedule. You can
            manage their information, positions, and work periods.
          </div>
          <button
            onClick={() => setShowStaffEditModal(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Add Staff Members
          </button>
        </div>

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
          dateRange={dateRange}
          handleCreateStaff={handleCreateStaff}
          updateStaff={updateStaff}
          deleteStaff={deleteStaff}
          schedule={schedule}
          updateSchedule={updateSchedule}
          setStaffMembersByMonth={setStaffMembersByMonth}
          currentMonthIndex={currentMonthIndex}
          scheduleAutoSave={scheduleAutoSave}
          clearAndRefreshFromDatabase={clearAndRefreshFromDatabase}
          isRefreshingFromDatabase={isRefreshingFromDatabase}
        />
      </div>
    );
  }

  return (
    <div className="shift-schedule-editor max-w-full mx-auto bg-white">
      {/* Error Display */}
      <ErrorDisplay error={error} onClearError={() => setError(null)} />

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
        handleExport={handleExport}
        handlePrint={handlePrint}
        handleAddTable={handleAddTable}
        handleDeletePeriod={handleDeletePeriod}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onShowSettings={handleShowSettings}
        scheduleData={schedule}
        staffMembers={staffMembers}
        updateSchedule={updateSchedule}
        aiEnabled={aiEnabled}
        onEnableAI={enableAIFeatures}
      />

      {/* Schedule View - Table or Card */}
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
          setShowDropdown={setShowDropdownDebug}
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
          // Offline queue state for visual feedback
          pendingCells={pendingCells}
          hasPendingChanges={hasPendingChanges}
          isConnected={isConnected}
          offlineQueue={offlineQueue}
        />
      ) : (
        <StaffCardView
          orderedStaffMembers={orderedStaffMembers}
          dateRange={dateRange}
          schedule={schedule}
        />
      )}

      {/* ScheduleTable data debug removed */}

      {/* Statistics Dashboard */}
      <StatisticsDashboard
        statistics={statistics}
        staffMembers={staffMembers}
        dateRange={dateRange}
      />

      {/* Staff Edit Modal */}
      <StaffEditModal
        showStaffEditModal={showStaffEditModal}
        setShowStaffEditModal={setShowStaffEditModal}
        isAddingNewStaff={isAddingNewStaff}
        setIsAddingNewStaff={setIsAddingNewStaff}
        selectedStaffForEdit={selectedStaffForEdit}
        setSelectedStaffForEdit={setSelectedStaffForEdit}
        editingStaffData={editingStaffData}
        setEditingStaffData={setEditingStaffData}
        staffMembers={staffMembers}
        dateRange={dateRange}
        handleCreateStaff={handleCreateStaff}
        updateStaff={updateStaff}
        deleteStaff={deleteStaff}
        schedule={schedule}
        updateSchedule={updateSchedule}
        setStaffMembersByMonth={setStaffMembersByMonth}
        currentMonthIndex={currentMonthIndex}
        scheduleAutoSave={scheduleAutoSave}
        clearAndRefreshFromDatabase={clearAndRefreshFromDatabase}
        isRefreshingFromDatabase={isRefreshingFromDatabase}
      />

      {/* Shift Dropdown Portal */}
      {showDropdown &&
        (() => {
          // Parse staffId and dateKey correctly - dateKey is always at the end in YYYY-MM-DD format (10 chars)
          // Expected format: "uuid-with-hyphens-YYYY-MM-DD"
          const dateKey = showDropdown.slice(-10); // Extract last 10 characters (YYYY-MM-DD)
          const staffId = showDropdown.slice(0, -11); // Everything except the last 11 characters (-YYYY-MM-DD)

          const staff = orderedStaffMembers.find((s) => s.id === staffId);

          if (!staff) {
            return null;
          }

          const status = staff?.status || "派遣";
          const availableShifts = getAvailableShifts(status);

          // Find the cell element for positioning
          const cellElement = document.querySelector(
            `[data-cell-key="${showDropdown}"]`,
          );

          if (!cellElement) {
            return null;
          }

          const cellRect = cellElement.getBoundingClientRect();

          // Calculate dropdown position using proper indices
          const staffIndex = orderedStaffMembers.findIndex(
            (s) => s.id === staffId,
          );
          const dateIndex = dateRange.findIndex(
            (d) => d.toISOString().split("T")[0] === dateKey,
          );

          // Dynamic dropdown positioning - prioritize side positioning to avoid covering cells below
          const isRightSide = staffIndex >= orderedStaffMembers.length - 2; // Last 2 columns
          const isLeftSide = staffIndex === 0; // First column
          const hasSpaceRight = cellRect.right + 140 < window.innerWidth; // 140px = dropdown width + margin
          const hasSpaceLeft = cellRect.left - 140 > 0;

          // Calculate dropdown position
          let dropdownStyle = {
            position: "fixed",
            backgroundColor: "white",
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            padding: "0.5rem 0",
            minWidth: "120px",
            zIndex: 1000,
          };

          // Prioritize side positioning to avoid covering cells below
          if (hasSpaceRight && !isRightSide) {
            // Position to the right side of the cell
            dropdownStyle = {
              ...dropdownStyle,
              left: cellRect.right + 8,
              top: cellRect.top,
            };
          } else if (hasSpaceLeft && !isLeftSide) {
            // Position to the left side of the cell
            dropdownStyle = {
              ...dropdownStyle,
              right: window.innerWidth - cellRect.left + 8,
              top: cellRect.top,
            };
          } else if (dateIndex >= dateRange.length - 3) {
            // If in bottom rows, position above
            dropdownStyle = {
              ...dropdownStyle,
              left: cellRect.left,
              bottom: window.innerHeight - cellRect.top + 4,
            };
          } else {
            // Fallback: position below but slightly offset to minimize coverage
            dropdownStyle = {
              ...dropdownStyle,
              left: cellRect.right + 4,
              top: cellRect.bottom + 4,
            };
          }

          return (
            <div
              className="shift-dropdown"
              style={dropdownStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {availableShifts.map((key) => {
                const value = shiftSymbols[key];
                if (!value) return null;

                return (
                  <div
                    key={key}
                    className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle different shift types like in ScheduleTable
                      let shiftValue;
                      const staff = staffMembers.find((s) => s.id === staffId);

                      if (key === "normal") {
                        // For パート staff, normal shift shows circle symbol
                        if (staff?.status === "パート") {
                          shiftValue = shiftSymbols[key]?.symbol || "○";
                        } else {
                          shiftValue = ""; // Normal shift shows as blank for other staff
                        }
                      } else if (key === "late") {
                        shiftValue = "late"; // Late shift stores as 'late' key, not symbol
                      } else {
                        shiftValue = shiftSymbols[key]?.symbol || key;
                      }

                      updateShift(staffId, dateKey, shiftValue);
                      setShowDropdownDebug(null);
                    }}
                  >
                    <span className={`text-lg font-bold mr-3 ${value.color}`}>
                      {(() => {
                        // For パート staff, show circle for normal shift in dropdown
                        if (key === "normal" && staff?.status === "パート") {
                          return "○";
                        }
                        return value.symbol || "　";
                      })()}
                    </span>
                    <span className="text-sm">{value.label}</span>
                  </div>
                );
              })}

              {/* Direct Custom Text Input Section */}
              <div className="border-t border-gray-200 p-2">
                <div className="text-xs text-gray-500 mb-2">Custom text:</div>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const finalText = customText.trim() || "";
                      updateShift(staffId, dateKey, finalText);
                      setEditingCell(null);
                      setShowDropdownDebug(null);
                      setCustomText("");
                    } else if (e.key === "Escape") {
                      setEditingCell(null);
                      setShowDropdownDebug(null);
                      setCustomText("");
                    }
                  }}
                  onFocus={() => {
                    // Set editing cell when text input is focused
                    setEditingCell(showDropdown);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Type custom text..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus={editingCell === showDropdown}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Press Enter to save, Escape to cancel
                </div>
              </div>
            </div>
          );
        })()}

      {/* Delete Period Modal */}
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
        onSave={handleSaveSettings}
        isLoading={isLoadingSettings}
        error={settingsError}
        settings={settings}
        onSettingsChange={updateSettings}
        staffMembers={staffMembers}
        onResetConfig={resetToDefaults}
        onShowHistory={() => {}} // TODO: Implement history modal
        connectionStatus={connectionStatus}
        onRetryConnection={checkConnectionStatus}
        validationErrors={validationErrors}
        hasUnsavedChanges={hasUnsavedChanges}
        // Autosave state
        isAutoSaving={isAutosaving}
        lastSaveTime={lastSaveTime}
        autosaveError={autosaveError}
        isAutosaveEnabled={isAutosaveEnabled}
        onToggleAutosave={setIsAutosaveEnabled}
      />

      {/* AI Features Control */}
      {!aiEnabled && !aiLoading && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-white border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-center space-x-2 mb-3">
              <div className="text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900">AI Features Available</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Enable AI-powered schedule optimization, debug tools, and advanced analytics.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={enableAIFeatures}
                disabled={!aiSupported}
                className={`px-3 py-2 text-sm font-medium rounded ${
                  aiSupported 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Enable AI Features
              </button>
              <button
                onClick={() => setAIEnabled(null)} // Hide the prompt
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Maybe Later
              </button>
            </div>
            {!aiSupported && (
              <div className="mt-2 text-xs text-red-600">
                AI features require a modern browser with ES2020+ support
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* AI Loading Progress */}
      {aiLoading && aiLoadingProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <FeatureLoadingProgress
            features={aiLoadingProgress.features || []}
            currentFeature={aiLoadingProgress.currentFeature}
            progress={aiLoadingProgress.progress || 0}
          />
        </div>
      )}
      
      {/* AI Feature Error */}
      {aiFeatureError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
            <div className="flex items-center space-x-2 mb-2">
              <div className="text-red-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm font-medium text-red-800">AI Feature Error</div>
            </div>
            <div className="text-sm text-red-700 mb-3">{aiFeatureError}</div>
            <div className="flex space-x-2">
              <button
                onClick={() => setAIFeatureError(null)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Dismiss
              </button>
              <button
                onClick={enableAIFeatures}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftScheduleEditor;
