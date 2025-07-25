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
    scheduleAutoSave
  } = useScheduleData(currentMonthIndex, supabaseScheduleData, currentScheduleId, setCurrentScheduleId, onSaveSchedule);

  const {
    staffMembers,
    setStaffMembers,
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
  } = useStaffManagement(currentMonthIndex, staffMembersByMonth, supabaseScheduleData);

  // Calculate derived data
  const orderedStaffMembers = useMemo(() => {
    console.log('Calculating orderedStaffMembers with staffMembers:', staffMembers);
    const result = getOrderedStaffMembers(staffMembers, dateRange);
    console.log('orderedStaffMembers result:', result);
    return result;
  }, [staffMembers, dateRange]);

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
      <StatisticsDashboard statistics={statistics} />

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
    </div>
  );
};

export default ShiftScheduleEditor;