import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// Import extracted utilities and constants
import { shiftSymbols, getAvailableShifts } from '../constants/shiftConstants';
import { monthPeriods, getDropdownPosition, getDateLabel } from '../utils/dateUtils';
import { getOrderedStaffMembers } from '../utils/staffUtils';
import { generateStatistics } from '../utils/statisticsUtils';
import { exportToCSV, printSchedule } from '../utils/exportUtils';

// Import extracted components
import ErrorDisplay from './schedule/ErrorDisplay';
import StatisticsDashboard from './schedule/StatisticsDashboard';

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
  const [currentMonthIndex, setCurrentMonthIndex] = useState(6); // 6 = July-August (0-indexed)
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [error, setError] = useState(externalError);

  // UI state
  const [showDropdown, setShowDropdown] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);

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
  } = useScheduleData(currentMonthIndex, supabaseScheduleData, currentScheduleId, setCurrentScheduleId);

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
    startAddingNewStaff
  } = useStaffManagement(currentMonthIndex, staffMembersByMonth, supabaseScheduleData);

  // Calculate derived data
  const orderedStaffMembers = useMemo(() => 
    getOrderedStaffMembers(staffMembers, dateRange), 
    [staffMembers, dateRange]
  );

  const statistics = useMemo(() => 
    generateStatistics(staffMembers, schedule, dateRange), 
    [staffMembers, schedule, dateRange]
  );

  // Event handlers
  const handleCellClick = (staffId, dateKey) => {
    const cellId = `${staffId}-${dateKey}`;
    setShowDropdown(showDropdown === cellId ? null : cellId);
    setEditingCell(null);
  };

  const handleShiftSelect = (staffId, dateKey, shiftValue) => {
    updateShift(staffId, dateKey, shiftValue);
    setShowDropdown(null);
  };

  const handleMonthChange = (newIndex) => {
    setCurrentMonthIndex(newIndex);
    setShowMonthPicker(false);
  };

  const handleExport = () => {
    exportToCSV(orderedStaffMembers, dateRange, schedule);
  };

  const handlePrint = () => {
    printSchedule(orderedStaffMembers, dateRange, schedule);
  };

  const handleAddNewStaff = () => {
    startAddingNewStaff();
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
    
    // Auto-save to database asynchronously
    setTimeout(() => {
      scheduleAutoSave(newSchedule, newStaffMembers);
    }, 0);
  };

  // Handle external error updates
  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && event.target.closest && !event.target.closest('.shift-dropdown')) {
        if (schedule) {
          scheduleAutoSave(schedule, staffMembers);
        }
        setShowDropdown(null);
      }
      
      if (showMonthPicker && event.target.closest && !event.target.closest('.month-picker')) {
        setShowMonthPicker(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown, showMonthPicker, schedule, staffMembers, scheduleAutoSave]);

  return (
    <div className="shift-schedule-editor max-w-full mx-auto bg-white">
      {/* Error Display */}
      <ErrorDisplay error={error} onClearError={() => setError(null)} />

      {/* Navigation Toolbar */}
      <div className="toolbar-section mb-6">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 shadow-sm">
          {/* Month Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleMonthChange(Math.max(0, currentMonthIndex - 1))}
              disabled={currentMonthIndex === 0}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← 前月
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 font-medium"
              >
                {monthPeriods[currentMonthIndex]?.label}
              </button>
              
              {showMonthPicker && (
                <div className="month-picker absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                  {monthPeriods.map((period, index) => (
                    <button
                      key={index}
                      onClick={() => handleMonthChange(index)}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        index === currentMonthIndex ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={() => handleMonthChange(Math.min(monthPeriods.length - 1, currentMonthIndex + 1))}
              disabled={currentMonthIndex === monthPeriods.length - 1}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次月 →
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddNewStaff}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              スタッフ追加
            </button>
            
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              CSV出力
            </button>
            
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              印刷
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="table-container w-4/5 mx-auto overflow-auto border border-gray-200 rounded-lg shadow-sm mb-6" style={{ maxHeight: 'calc(100vh - 110px)' }}>
        <table className="shift-table w-full text-sm" style={{ minWidth: `${60 + (staffMembers.length * 40)}px` }}>
          {/* Table Header */}
          <thead>
            <tr>
              <th className="bg-gray-600 text-white min-w-[60px] border-r-2 border-gray-400 sticky left-0" style={{ zIndex: 400 }}>
                <div className="flex items-center justify-center gap-1 py-0.5">
                  <span className="text-xs font-medium">日付</span>
                </div>
              </th>
              
              {/* Staff Column Headers */}
              {orderedStaffMembers.map((staff, staffIndex) => (
                <th 
                  key={staff.id}
                  className="bg-gray-600 text-white text-center relative border-r border-gray-400"
                  style={{ minWidth: '40px', padding: '4px 2px' }}
                >
                  <div className="flex flex-col items-center justify-center py-1">
                    <span className="text-xs font-medium leading-tight">{staff.name}</span>
                    <span className="text-[10px] text-gray-300 leading-tight">{staff.position}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody>
            {dateRange.map((date, dateIndex) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              
              return (
                <tr key={dateKey} className={isWeekend ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  {/* Date Header */}
                  <td className="date-header bg-gray-100 font-medium text-center border-r-2 border-gray-400 sticky left-0" style={{ zIndex: 300 }}>
                    <div className="py-2">
                      <div className="text-sm font-bold">{format(date, 'dd')}</div>
                      <div className="text-xs text-gray-600">{format(date, 'EEE', { locale: ja })}</div>
                    </div>
                  </td>
                  
                  {/* Staff Shift Cells */}
                  {orderedStaffMembers.map((staff, staffIndex) => {
                    const shift = schedule[staff.id]?.[dateKey] || '';
                    const cellId = `${staff.id}-${dateKey}`;
                    const isDropdownOpen = showDropdown === cellId;
                    const dropdownPosition = getDropdownPosition(date, staffIndex + 1, dateIndex);
                    
                    return (
                      <td 
                        key={staff.id}
                        className={`text-center relative border-r border-gray-200 ${
                          isDropdownOpen ? 'ring-2 ring-gray-400 bg-white' : ''
                        }`}
                        style={{ minWidth: '40px', padding: '0' }}
                      >
                        <div
                          className="w-full h-12 flex items-center justify-center cursor-pointer hover:bg-gray-100"
                          onClick={() => handleCellClick(staff.id, dateKey)}
                        >
                          <span className={`text-lg font-bold ${shiftSymbols[shift]?.color || 'text-gray-400'}`}>
                            {shiftSymbols[shift]?.symbol || ''}
                          </span>
                        </div>
                        
                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                          <div className={`shift-dropdown absolute bg-white border border-gray-300 rounded-lg shadow-lg py-2 min-w-[120px] z-50 ${
                            dropdownPosition === 'right' ? 'left-full top-1/2 transform -translate-y-1/2 ml-1' :
                            dropdownPosition === 'left' ? 'right-full top-1/2 transform -translate-y-1/2 mr-1' :
                            'top-full left-1/2 transform -translate-x-1/2 mt-1'
                          }`}>
                            {getAvailableShifts(staff.name, staffMembers).map((key) => {
                              const value = shiftSymbols[key];
                              if (!value) return null;
                              
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                    shift === key ? 'bg-blue-50 text-blue-600' : ''
                                  }`}
                                  onClick={() => handleShiftSelect(staff.id, dateKey, key)}
                                >
                                  <span className={`text-lg font-bold mr-3 ${value.color}`}>
                                    {value.symbol}
                                  </span>
                                  <span className="text-sm">{value.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistics Dashboard */}
      <StatisticsDashboard 
        statistics={statistics}
        staffMembers={orderedStaffMembers}
        dateRange={dateRange}
      />

      {/* Staff Management Modal would go here */}
      {/* This would be extracted as a separate component in the final version */}
    </div>
  );
};

export default ShiftScheduleEditor;