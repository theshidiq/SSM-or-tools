import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

// Import extracted utilities and constants
import { shiftSymbols, getAvailableShifts } from '../constants/shiftConstants';
import { monthPeriods, getDropdownPosition, getDateLabel, isDateWithinWorkPeriod, addNextPeriod } from '../utils/dateUtils';
import { getOrderedStaffMembers, migrateScheduleData, migrateStaffMembers } from '../utils/staffUtils';
import { generateStatistics } from '../utils/statisticsUtils';
import { exportToCSV, printSchedule } from '../utils/exportUtils';

// Import extracted components
import ErrorDisplay from './schedule/ErrorDisplay';
import StatisticsDashboard from './schedule/StatisticsDashboard';
import NavigationToolbar from './schedule/NavigationToolbar';
import ScheduleTable from './schedule/ScheduleTable';
import StaffEditModal from './schedule/StaffEditModal';
import StatusModal from './common/StatusModal';

// Import custom hooks
import { useScheduleData } from '../hooks/useScheduleData';
import { useStaffManagement } from '../hooks/useStaffManagement';

const ShiftScheduleEditor = ({ 
  supabaseScheduleData, 
  isConnected, 
  error: externalError,
  onSaveSchedule,
  onDeleteSchedule 
}) => {
  // Main state
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // 0 = January-February (0-indexed)
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [error, setError] = useState(externalError);

  // UI state
  const [showDropdown, setShowDropdown] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingSpecificColumn, setEditingSpecificColumn] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [editingNames, setEditingNames] = useState({});
  const [justEnteredEditMode, setJustEnteredEditMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  
  // Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: ''
  });

  // Refs
  const newColumnInputRef = useRef(null);

  // Custom hooks
  const {
    schedule,
    schedulesByMonth,
    staffMembersByMonth,
    dateRange,
    setSchedulesByMonth,
    setStaffMembersByMonth,
    updateSchedule,
    updateShift,
    scheduleAutoSave,
    setHasExplicitlyDeletedData
  } = useScheduleData(currentMonthIndex, supabaseScheduleData, currentScheduleId, setCurrentScheduleId, onSaveSchedule);

  const {
    staffMembers,
    setStaffMembers,
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
    updateStaff
  } = useStaffManagement(currentMonthIndex, supabaseScheduleData);

  // Check if we're still loading - wait until both database and staff are ready
  const isLoading = supabaseScheduleData === undefined || !hasLoadedFromDb;
  
  // Calculate derived data
  const orderedStaffMembers = useMemo(() => {
    if (isLoading) {
      return []; // Don't show anything while loading
    }
    // If database is empty (null) or no staff loaded, show empty for now
    if (!staffMembers || staffMembers.length === 0) {
      return [];
    }
    return getOrderedStaffMembers(staffMembers, dateRange);
  }, [staffMembers, dateRange, isLoading]);

  // Check if we have any data at all (including localStorage as backup)
  const localStaffData = useMemo(() => {
    try {
      const savedStaffByMonth = JSON.parse(localStorage.getItem('staff-by-month-data') || '{}');
      return savedStaffByMonth[currentMonthIndex] || [];
    } catch {
      return [];
    }
  }, [currentMonthIndex]);
  
  const hasAnyStaffData = (staffMembers && staffMembers.length > 0) || 
    (supabaseScheduleData && supabaseScheduleData.schedule_data && supabaseScheduleData.schedule_data._staff_members) ||
    (localStaffData && localStaffData.length > 0);

  const statistics = useMemo(() => 
    generateStatistics(schedule, staffMembers, dateRange), 
    [schedule, staffMembers, dateRange]
  );

  // Error handling
  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  // Event handlers
  const handleMonthChange = useCallback((newMonthIndex) => {
    if (newMonthIndex >= 0 && newMonthIndex <= 11) {
      setCurrentMonthIndex(newMonthIndex);
      setShowMonthPicker(false);
      setShowDropdown(null);
      setEditingCell(null);
      exitEditMode();
    }
  }, []);

  const addNewColumn = () => {
    startAddingNewStaff();
  };

  const editColumnName = useCallback((staffId, newName) => {
    editStaffName(staffId, newName, (newStaff) => {
      setStaffMembersByMonth(prev => ({
        ...prev,
        [currentMonthIndex]: newStaff
      }));
    });
  }, [editStaffName, setStaffMembersByMonth, currentMonthIndex]);

  const exitEditMode = () => {
    setEditingColumn(null);
    setEditingSpecificColumn(null);
    setEditingColumnName('');
  };

  const handleCreateStaff = (staffData) => {
    const { newStaffMembers, newSchedule } = createNewStaff(
      staffData,
      schedule,
      dateRange,
      updateSchedule,
      (newStaff) => {
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: newStaff
        }));
      }
    );
    
    setTimeout(() => {
      scheduleAutoSave(newSchedule, newStaffMembers);
    }, 0);
  };

  const handleExport = () => {
    exportToCSV(
      schedule,
      orderedStaffMembers,
      dateRange,
      monthPeriods[currentMonthIndex]?.label || 'Schedule'
    );
  };

  const handlePrint = () => {
    printSchedule(
      schedule,
      orderedStaffMembers,
      dateRange,
      monthPeriods[currentMonthIndex]?.label || 'Schedule'
    );
  };

  const handleAddTable = () => {
    // Add next period and switch to it
    const newPeriodIndex = addNextPeriod();
    setCurrentMonthIndex(newPeriodIndex);
  };

  const handleDeletePeriod = () => {
    const periodLabel = monthPeriods[currentMonthIndex]?.label || 'current period';
    
    // Show confirmation modal
    setDeleteModal({
      isOpen: true,
      type: 'confirm',
      title: 'Clear Schedule Data',
      message: `Are you sure you want to clear all schedule data (shift assignments) for ${periodLabel}? This will remove all shift entries but preserve staff configuration. This action cannot be undone.`
    });
  };

  const confirmDeletePeriod = async () => {
    // Show loading modal
    setDeleteModal({
      isOpen: true,
      type: 'loading',
      title: 'Clearing Schedule Data',
      message: 'Please wait while we clear the schedule data...'
    });

    try {
      // Step 1: Clear only schedule data (cell values) for current period, preserve staff configuration
      const clearedSchedule = {};
      
      // Clear schedule data for current period but keep staff structure
      Object.keys(schedule).forEach(staffId => {
        clearedSchedule[staffId] = {};
        // Initialize empty dates for current period
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          clearedSchedule[staffId][dateKey] = '';
        });
      });
      
      // Step 2: Update local state
      updateSchedule(clearedSchedule);

      // Step 3: Auto-save will handle database update with cleared data but preserved staff
      await new Promise(resolve => {
        scheduleAutoSave(clearedSchedule, staffMembers);
        setTimeout(resolve, 1000); // Give time for auto-save
      });

      // Simulate some processing time for visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Show success modal
      setDeleteModal({
        isOpen: true,
        type: 'success',
        title: 'Success!',
        message: 'Schedule data has been cleared. Staff configuration preserved.'
      });

    } catch (error) {
      console.error('❌ Failed to clear schedule data:', error);
      
      // Show error modal
      setDeleteModal({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to clear schedule data. Please try again.'
      });
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      type: 'confirm',
      title: '',
      message: ''
    });
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      try {
        if (!event || !event.target) return;
        
        if (showDropdown && event.target.closest && !event.target.closest('.shift-dropdown')) {
          setShowDropdown(null);
        }
        
        if (showMonthPicker && event.target.closest && !event.target.closest('.month-picker')) {
          setShowMonthPicker(false);
        }
        
        // Exit edit mode when clicking outside table header
        if ((editingColumn === 'delete-mode' || editingColumn === 'edit-name-mode' || editingSpecificColumn) && 
            event.target.closest && 
            !event.target.closest('th') && 
            !event.target.closest('button') && 
            !justEnteredEditMode) {
          
          if (editingColumn === 'edit-name-mode') {
            Object.keys(editingNames).forEach(staffId => {
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
        console.error('Error in handleClickOutside:', error);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown, showMonthPicker, editingColumn, editingSpecificColumn, justEnteredEditMode, editingNames, editColumnName]);

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
            Start by adding staff members to create your shift schedule. You can manage their information, positions, and work periods.
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
        scheduleAutoSave={scheduleAutoSave}
        schedule={schedule}
        staffMembers={staffMembers}
        handleExport={handleExport}
        handlePrint={handlePrint}
        handleAddTable={handleAddTable}
        handleDeletePeriod={handleDeletePeriod}
      />

      {/* Schedule Table */}
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

      {/* Statistics Dashboard */}
      <StatisticsDashboard statistics={statistics} staffMembers={staffMembers} dateRange={dateRange} />

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
      />

      {/* Delete Period Modal */}
      <StatusModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeletePeriod}
        title={deleteModal.title}
        message={deleteModal.message}
        type={deleteModal.type}
        confirmText="Delete"
        cancelText="Cancel"
        autoCloseDelay={deleteModal.type === 'success' ? 2000 : null}
      />
    </div>
  );
};

export default ShiftScheduleEditor;