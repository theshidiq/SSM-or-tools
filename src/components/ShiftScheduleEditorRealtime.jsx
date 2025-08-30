import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

// Import extracted utilities and constants
import { shiftSymbols, getAvailableShifts } from "../constants/shiftConstants";
import {
  monthPeriods,
  addNextPeriod,
  getCurrentMonthIndex,
  findPeriodWithData,
} from "../utils/dateUtils";
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

// Temporary debug tester - REMOVE AFTER DEBUGGING
import AIAssistantDebugTester from "./debug/AIAssistantDebugTester";

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
  // Main state - initialize with current month
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => {
    try {
      return getCurrentMonthIndex();
    } catch (error) {
      console.warn("Failed to get current month index, defaulting to 0:", error);
      return 0;
    }
  });

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

  // Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
    editStaffInfo,
    deleteStaff,
    addStaffMember,
    localStaffData,
  } = useStaffManagement(
    staffMembersByMonth[currentMonthIndex] || [],
    currentMonthIndex,
    updateSchedule,
    schedule,
    staffMembersByMonth,
    setStaffMembersByMonth,
    scheduleAutoSave,
  );

  // Error state - combine all possible errors
  const combinedError = externalError || supabaseError || settingsError || autosaveError;
  const [error, setError] = useState(combinedError);

  // Update error when any error changes
  useEffect(() => {
    setError(combinedError);
  }, [combinedError]);

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
      const testRunner = manualInputTestSuite(
        updateShift,
        schedule,
        staffMembers,
        currentMonthIndex,
      );

      // Set up data integrity monitoring
      const integrityMonitor = dataIntegrityMonitor(
        cleanupAllPeriods,
        fixStaffInconsistencies,
        updateShift,
        schedule,
        staffMembers,
        currentMonthIndex,
      );

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
    if (newMonthIndex >= 0 && newMonthIndex < monthPeriods.length) {
      setCurrentMonthIndex(newMonthIndex);
      setShowMonthPicker(false);
      setEditingColumn(null);
      setEditingNames({});
      setShowDropdown(null);
    }
  }, []);

  const handleNextPeriod = useCallback(() => {
    if (currentMonthIndex < monthPeriods.length - 1) {
      handleMonthChange(currentMonthIndex + 1);
    } else {
      const newPeriod = addNextPeriod();
      if (newPeriod.success) {
        handleMonthChange(currentMonthIndex + 1);
      }
    }
  }, [currentMonthIndex, handleMonthChange]);

  const handlePrevPeriod = useCallback(() => {
    if (currentMonthIndex > 0) {
      handleMonthChange(currentMonthIndex - 1);
    }
  }, [currentMonthIndex, handleMonthChange]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    exportToCSV(schedule, orderedStaffMembers, dateRange);
  }, [schedule, orderedStaffMembers, dateRange]);

  const handlePrint = useCallback(() => {
    printSchedule();
  }, []);

  // Real-time connection status display
  const ConnectionStatus = () => (
    <div className="fixed top-2 right-2 z-50">
      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
        realtimeStatus.status === 'connected' 
          ? 'bg-green-100 text-green-800 border border-green-200'
          : realtimeStatus.status === 'saving'
          ? 'bg-blue-100 text-blue-800 border border-blue-200'
          : realtimeStatus.status === 'loading'
          ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${
            realtimeStatus.status === 'connected' 
              ? 'bg-green-500'
              : realtimeStatus.status === 'saving'
              ? 'bg-blue-500 animate-pulse'
              : realtimeStatus.status === 'loading'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`} />
          <span>{realtimeStatus.message}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Real-time Connection Status */}
      <ConnectionStatus />

      {/* Phase 1 Real-time Badge */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-10 right-2 z-40">
          <div className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full text-xs font-medium">
            Phase 1: Real-time
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          onClear={() => setError(null)}
          context="ShiftScheduleEditorRealtime"
        />
      )}

      {/* Header with real-time info */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            シフト管理システム
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Schedule ID: {currentScheduleId?.substring(0, 8)}...</span>
            {isSaving && <span className="text-blue-600 animate-pulse">Auto-saving...</span>}
          </div>
        </div>
      </div>

      {/* Navigation Toolbar */}
      <NavigationToolbar
        currentMonthIndex={currentMonthIndex}
        onMonthChange={handleMonthChange}
        onNextPeriod={handleNextPeriod}
        onPrevPeriod={handlePrevPeriod}
        showMonthPicker={showMonthPicker}
        setShowMonthPicker={setShowMonthPicker}
        onExportCSV={handleExportCSV}
        onPrint={handlePrint}
        editingColumn={editingColumn}
        setEditingColumn={setEditingColumn}
        setJustEnteredEditMode={setJustEnteredEditMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
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
      <div className="statistics-section mt-8">
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
        isOpen={showStaffEditModal}
        onClose={() => {
          setShowStaffEditModal(false);
          setSelectedStaffForEdit(null);
          setEditingStaffData(null);
          setIsAddingNewStaff(false);
        }}
        staffData={editingStaffData}
        onSave={(updatedStaff) => {
          if (isAddingNewStaff) {
            createNewStaff(updatedStaff);
          } else {
            editStaffInfo(selectedStaffForEdit, updatedStaff);
          }
          setShowStaffEditModal(false);
          setSelectedStaffForEdit(null);
          setEditingStaffData(null);
          setIsAddingNewStaff(false);
        }}
        isAddingNew={isAddingNewStaff}
      />

      <StatusModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        type={deleteModal.type}
        title={deleteModal.title}
        message={deleteModal.message}
        onConfirm={() => setDeleteModal({ ...deleteModal, isOpen: false })}
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

      {/* Development Debug Tools */}
      {process.env.NODE_ENV === "development" && (
        <>
          <AIAssistantDebugTester />
          <div className="fixed bottom-4 left-4 text-xs bg-white border rounded p-2 shadow">
            <div>🔄 Real-time: {isConnected ? "Connected" : "Disconnected"}</div>
            <div>💾 Auto-save: {isSaving ? "Active" : "Idle"}</div>
            <div>📊 Data: {Object.keys(schedule).length} staff</div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftScheduleEditorRealtime;