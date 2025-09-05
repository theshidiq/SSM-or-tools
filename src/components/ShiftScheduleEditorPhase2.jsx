/**
 * Phase 2 Shift Schedule Editor - Enhanced Real-time with Advanced Features
 * Builds on Phase 1 with caching, offline support, and conflict resolution
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

// Import Phase 2 enhanced hooks
import { useScheduleDataEnhanced } from "../hooks/useScheduleDataEnhanced";
import { useStaffRealtime } from "../hooks/useStaffRealtime";
import { useSettingsData } from "../hooks/useSettingsData";

// Import utilities
import { 
  monthPeriods,
  addNextPeriod,
  getCurrentMonthIndex,
} from "../utils/dateUtils";
import { getOrderedStaffMembers } from "../utils/staffUtils";
import { generateStatistics } from "../utils/statisticsUtils";
import { exportToCSV, printSchedule } from "../utils/exportUtils";

// Import components
import ErrorDisplay from "./schedule/ErrorDisplay";
import StatisticsDashboard from "./schedule/StatisticsDashboard";
import NavigationToolbar from "./schedule/NavigationToolbar";
import ScheduleTable from "./schedule/ScheduleTable";
import StaffCardView from "./schedule/StaffCardView";
import StaffEditModal from "./schedule/StaffEditModal";
import StatusModal from "./common/StatusModal";
import SettingsModal from "./settings/SettingsModal";

// Phase 2 specific components
import { OfflineIndicator } from "../hooks/useOfflineSupport";

const ShiftScheduleEditorPhase2 = (props) => {
  // Main state
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => {
    try {
      return getCurrentMonthIndex();
    } catch (error) {
      console.warn("Failed to get current month index, defaulting to 0:", error);
      return 0;
    }
  });

  const [viewMode, setViewMode] = useState("table");

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

  // Phase 2 Enhanced Hook - Main data management with all features
  const {
    schedule,
    dateRange,
    staffMembersByMonth,
    setStaffMembersByMonth,
    updateShift,
    updateSchedule,
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
  } = useScheduleDataEnhanced(currentMonthIndex, {
    enableAdvancedCache: true,
    enableOfflineSupport: true,
    enableConflictResolution: true
  });

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
  } = useStaffRealtime(currentMonthIndex); // Phase 3: Updated to use real-time staff management

  // Error state - combine all possible errors
  const combinedError = scheduleError || settingsError || autosaveError;
  const [error, setError] = useState(combinedError);

  // Update error when any error changes
  useEffect(() => {
    setError(combinedError);
  }, [combinedError]);

  // Generate ordered staff members
  const orderedStaffMembers = useMemo(() => {
    if (
      isLoading ||
      !Array.isArray(staffMembers) ||
      staffMembers.length === 0
    ) {
      return [];
    }
    return getOrderedStaffMembers(staffMembers);
  }, [staffMembers, isLoading]);

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

  // Phase 2 status indicator
  const Phase2ConnectionStatus = () => {
    const getStatusColor = () => {
      switch (connectionStatus) {
        case 'connected': return 'bg-green-100 text-green-800 border-green-200';
        case 'saving': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'loading': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'syncing': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'offline_mode': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'conflicts': return 'bg-red-100 text-red-800 border-red-200';
        case 'disconnected': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const getStatusIcon = () => {
      switch (connectionStatus) {
        case 'connected': return '🟢';
        case 'saving': return '💾';
        case 'loading': return '⏳';
        case 'syncing': return '🔄';
        case 'offline_mode': return '📱';
        case 'conflicts': return '⚠️';
        case 'disconnected': return '🔴';
        default: return '❓';
      }
    };

    const getStatusMessage = () => {
      switch (connectionStatus) {
        case 'connected': return 'Connected';
        case 'saving': return 'Saving...';
        case 'loading': return 'Loading...';
        case 'syncing': return 'Syncing...';
        case 'offline_mode': return 'Offline Mode';
        case 'conflicts': return 'Conflicts Detected';
        case 'disconnected': return 'Disconnected';
        default: return 'Unknown';
      }
    };

    return (
      <div className="fixed top-2 right-2 z-50">
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
          <div className="flex items-center gap-2">
            <span>{getStatusIcon()}</span>
            <span>{getStatusMessage()}</span>
          </div>
        </div>
        
        {/* Performance metrics tooltip */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-1 text-xs opacity-75">
            {cache && `Cache: ${cache.cacheStats.hitRate}`}
            {offline && ` | Offline: ${offline.pendingOperations.length} pending`}
            {conflicts && ` | Conflicts: ${conflicts.activeConflicts.length}`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Phase 2 Enhanced Status Indicator */}
      <Phase2ConnectionStatus />

      {/* Phase 2 Badge */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-12 right-2 z-40">
          <div className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-medium">
            {phase} ({Object.values(features).filter(Boolean).length} features)
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          onClear={() => setError(null)}
          context="ShiftScheduleEditorPhase2"
        />
      )}

      {/* Header with Phase 2 info */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            シフト管理システム
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Schedule ID: {currentScheduleId?.substring(0, 8)}...</span>
            {isSaving && <span className="text-blue-600 animate-pulse">Auto-saving...</span>}
            {features.advancedCache && <span className="text-green-600">📦 Cache</span>}
            {features.offlineSupport && <span className="text-orange-600">📱 Offline</span>}
            {features.conflictResolution && <span className="text-purple-600">⚖️ Conflicts</span>}
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
        connectionStatus={settingsConnectionStatus}
        onCheckConnection={() => console.log('Check connection')}
        isAutosaving={isAutosaving}
        lastSaveTime={lastSaveTime}
        autosaveError={autosaveError}
        isAutosaveEnabled={isAutosaveEnabled}
        onToggleAutosave={setIsAutosaveEnabled}
      />

      {/* Phase 2 Offline Indicator */}
      {offline && (
        <OfflineIndicator
          isOnline={offline.isOnline}
          pendingCount={offline.pendingOperations.length}
        />
      )}

      {/* Development Debug Tools for Phase 2 */}
      {process.env.NODE_ENV === "development" && (
        <>
          <div className="fixed bottom-4 left-4 text-xs bg-white border rounded p-2 shadow max-w-sm">
            <div className="font-bold mb-2">Phase 2 Debug Info</div>
            <div>🔄 Status: {connectionStatus}</div>
            <div>📊 Data: {Object.keys(schedule).length} staff</div>
            {cache && (
              <div>📦 Cache: {cache.cacheStats.hitRate} hit rate</div>
            )}
            {offline && (
              <div>📱 Offline: {offline.pendingOperations.length} pending</div>
            )}
            {conflicts && (
              <div>⚖️ Conflicts: {conflicts.activeConflicts.length} active</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftScheduleEditorPhase2;