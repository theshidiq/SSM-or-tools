import React, { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Trash2, Edit, Check, X } from 'lucide-react';
import { shiftSymbols, getAvailableShifts } from '../../constants/shiftConstants';
import { getDropdownPosition, getDateLabel, isDateWithinWorkPeriod } from '../../utils/dateUtils';

const ScheduleTable = ({
  orderedStaffMembers,
  dateRange,
  schedule,
  editingColumn,
  editingSpecificColumn,
  editingNames,
  setEditingNames,
  setEditingSpecificColumn,
  showDropdown,
  setShowDropdown,
  updateShift,
  customText,
  setCustomText,
  editingCell,
  setEditingCell,
  deleteStaff,
  staffMembers,
  updateSchedule,
  setStaffMembersByMonth,
  currentMonthIndex,
  scheduleAutoSave,
  editStaffName
}) => {
  const [customInputText, setCustomInputText] = useState('');

  // Function to get symbol color based on the cell value
  const getSymbolColor = (value, staff) => {
    // For パート staff, if value is empty, default to unavailable
    if (staff?.status === 'パート' && (!value || value === '')) {
      return shiftSymbols.unavailable.color;
    }
    
    if (!value) return 'text-gray-400'; // Empty/blank cells
    
    // Find the shift type by symbol
    const shiftEntry = Object.entries(shiftSymbols).find(([key, shift]) => shift.symbol === value);
    
    if (shiftEntry) {
      return shiftEntry[1].color; // Return the color class
    }
    
    // For custom text (not a predefined symbol)
    return 'text-gray-700';
  };

  // Function to get display value for cell
  const getCellDisplayValue = (value, staff) => {
    // For パート staff, if value is empty, default to unavailable symbol
    if (staff?.status === 'パート' && (!value || value === '')) {
      return shiftSymbols.unavailable.symbol;
    }
    
    // For late shift, don't display symbol (show as background color only)
    if (value === 'late') {
      return '';
    }
    
    return value;
  };

  const handleShiftClick = (staffId, dateKey, currentValue) => {
    const cellKey = `${staffId}-${dateKey}`;
    
    if (currentValue === '自由' || showDropdown === cellKey) {
      setCustomText(currentValue === '自由' ? '' : currentValue);
      setEditingCell(cellKey);
      setShowDropdown(null);
    } else {
      const staff = staffMembers.find(s => s.id === staffId);
      const status = staff?.status || '派遣';
      const availableShifts = getAvailableShifts(status);
      
      if (availableShifts.length > 0) {
        setShowDropdown(cellKey);
        setEditingCell(null);
      }
    }
  };

  const handleShiftSelect = (staffId, dateKey, shiftKey) => {
    // Handle different shift types
    const staff = staffMembers.find(s => s.id === staffId);
    let shiftValue;
    
    if (shiftKey === 'normal') {
      // For パート staff, normal shift shows circle symbol
      if (staff?.status === 'パート') {
        shiftValue = shiftSymbols[shiftKey]?.symbol || '○'; // Store circle symbol
      } else {
        shiftValue = ''; // Normal shift shows as blank for other staff
      }
    } else if (shiftKey === 'late') {
      shiftValue = 'late'; // Late shift stores as 'late' key, not symbol
    } else {
      shiftValue = shiftSymbols[shiftKey]?.symbol || shiftKey; // Other shifts show symbols
    }
    
    updateShift(staffId, dateKey, shiftValue);
    setShowDropdown(null);
    setCustomInputText('');
  };

  const handleCustomTextSave = (staffId, dateKey) => {
    const finalText = customInputText.trim() || '';
    updateShift(staffId, dateKey, finalText);
    setEditingCell(null);
    setShowDropdown(null);
    setCustomInputText('');
  };

  // Helper function to check if date is start/end for 派遣 staff
  const getStaffPeriodLabel = (staff, date) => {
    if (staff.status !== '派遣' || !staff.startPeriod) {
      return null;
    }

    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    // Check if it's start date
    if (staff.startPeriod) {
      const startDate = new Date(
        staff.startPeriod.year,
        staff.startPeriod.month - 1,
        staff.startPeriod.day || 1
      );
      startDate.setHours(0, 0, 0, 0);
      
      if (currentDate.getTime() === startDate.getTime()) {
        return 'START';
      }
    }

    // Check if it's end date
    if (staff.endPeriod) {
      const endDate = new Date(
        staff.endPeriod.year,
        staff.endPeriod.month - 1,
        staff.endPeriod.day || 1
      );
      endDate.setHours(0, 0, 0, 0);
      
      if (currentDate.getTime() === endDate.getTime()) {
        return 'END';
      }
    }

    return null;
  };

  const handleCustomTextSubmit = (staffId, dateKey) => {
    const finalText = customText.trim() || '';
    updateShift(staffId, dateKey, finalText);
    setEditingCell(null);
    setCustomText('');
  };

  const handleCustomTextCancel = () => {
    setCustomInputText('');
    setShowDropdown(null);
  };


  const handleDeleteStaff = (staffId) => {
    const { newStaffMembers, newSchedule } = deleteStaff(
      staffId,
      schedule,
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

  const handleNameEdit = (staffId, newName) => {
    setEditingNames(prev => ({
      ...prev,
      [staffId]: newName
    }));
  };

  const handleNameSubmit = (staffId) => {
    const newName = editingNames[staffId];
    if (newName && newName.trim()) {
      editStaffName(staffId, newName.trim(), (newStaff) => {
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: newStaff
        }));
      });
      
      setTimeout(() => {
        scheduleAutoSave(schedule, staffMembers);
      }, 0);
    }
    setEditingNames(prev => {
      const updated = { ...prev };
      delete updated[staffId];
      return updated;
    });
  };

  return (
    <div className="table-container w-4/5 mx-auto overflow-auto border border-gray-200 rounded-lg shadow-sm mb-6" style={{ maxHeight: 'calc(100vh - 110px)' }}>
      <table className="shift-table w-full text-sm" style={{ minWidth: `${40 + (orderedStaffMembers.length * 40)}px` }}>
        {/* Sticky Header Row: Staff Names as Column Headers */}
        <thead>
          <tr>
            <th className="bg-gray-600 text-white min-w-[40px] border-r-2 border-gray-400 sticky left-0" style={{ zIndex: 400, width: '40px' }}>
              <div className="flex items-center justify-center gap-1 py-0.5">
                <span className="text-xs font-medium">日付</span>
              </div>
            </th>
            
            {/* Staff Column Headers */}
            {orderedStaffMembers.map((staff, staffIndex) => {
              if (!staff || !staff.id) return null;
              
              return (
                <th 
                  key={staff.id}
                  className={`bg-gray-600 text-white text-center relative border-r border-gray-400 ${
                    staffIndex === orderedStaffMembers.length - 1 ? 'border-r-2' : ''
                  }`}
                  style={{ 
                    minWidth: '40px',
                    width: '40px',
                    maxWidth: '40px',
                    position: 'relative'
                  }}
                >
                  <div className="flex flex-col items-center justify-center py-1 px-1 h-full">
                    {/* Delete Button (only visible in delete mode) */}
                    {editingColumn === 'delete-mode' && (
                      <button
                        onClick={() => handleDeleteStaff(staff.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10 transition-colors duration-200"
                        title={`Delete ${staff.name}`}
                      >
                        <Trash2 size={8} />
                      </button>
                    )}
                    
                    {/* Staff Name (editable in edit-name mode) */}
                    {editingColumn === 'edit-name-mode' ? (
                      <input
                        type="text"
                        value={editingNames[staff.id] !== undefined ? editingNames[staff.id] : staff.name}
                        onChange={(e) => handleNameEdit(staff.id, e.target.value)}
                        onBlur={() => handleNameSubmit(staff.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleNameSubmit(staff.id);
                          }
                        }}
                        className="w-full text-center text-xs bg-white text-black border border-gray-300 rounded px-1 py-0.5"
                        style={{ minHeight: '20px' }}
                        autoFocus={editingSpecificColumn === staff.id}
                      />
                    ) : (
                      <span 
                        className="text-sm font-medium cursor-pointer hover:bg-gray-500 px-1 py-0.5 rounded transition-colors duration-200"
                        style={{ 
                          fontSize: '14px',
                          lineHeight: '16px',
                          maxWidth: '80px',
                          overflow: 'hidden',
                          wordBreak: 'break-all',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                        onClick={() => {
                          if (editingColumn === 'edit-name-mode') {
                            setEditingSpecificColumn(staff.id);
                          }
                        }}
                        title={staff.name}
                      >
                        {staff.name}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body: Date Rows */}
        <tbody>
          {dateRange.map((date, dateIndex) => {
            const dateKey = date.toISOString().split('T')[0];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            return (
              <tr key={dateKey} className="hover:bg-gray-50">
                {/* Date Cell (Sticky Left Column) */}
                <td 
                  className="text-center font-medium border-r-2 border-gray-300 sticky left-0 bg-white"
                  style={{ 
                    minWidth: '40px',
                    width: '40px', 
                    zIndex: 300
                  }}
                >
                  <div className="py-1 px-1 flex items-center justify-center gap-0.5">
                    <div className={`text-xs font-bold ${isWeekend ? 'text-red-600' : 'text-gray-700'}`}>
                      {getDateLabel(date)}
                    </div>
                    <div className={`text-xs opacity-75 ${isWeekend ? 'text-red-600' : 'text-gray-700'}`}>
                      {format(date, 'E', { locale: ja })}
                    </div>
                  </div>
                </td>

                {/* Staff Shift Cells */}
                {orderedStaffMembers.map((staff, staffIndex) => {
                  if (!staff || !staff.id) return null;
                  
                  const cellKey = `${staff.id}-${dateKey}`;
                  const cellValue = schedule[staff.id]?.[dateKey] || '';
                  const isActiveForDate = isDateWithinWorkPeriod(date, staff);
                  const isDropdownOpen = showDropdown === cellKey;
                  const periodLabel = getStaffPeriodLabel(staff, date);
                  
                  const isEditingThis = editingCell === cellKey;

                  return (
                    <td 
                      key={staff.id}
                      className={`text-center border-r border-gray-200 relative ${
                        staffIndex === orderedStaffMembers.length - 1 ? 'border-r-2 border-gray-300' : ''
                      } ${
                        cellValue === 'late' ? 'bg-purple-200 hover:bg-purple-300' : 'hover:bg-blue-50'
                      } ${
                        !isActiveForDate ? 'bg-gray-100' : ''
                      }`}
                      style={{ 
                        minWidth: '40px',
                        width: '40px',
                        maxWidth: '40px',
                        height: '50px',
                        padding: '0'
                      }}
                    >
                      {!isActiveForDate ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-xs">-</span>
                        </div>
                      ) : isEditingThis ? (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <input
                            type="text"
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            onBlur={() => handleCustomTextSubmit(staff.id, dateKey)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomTextSubmit(staff.id, dateKey);
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                                setCustomText('');
                              }
                            }}
                            className="w-full h-full text-center text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            placeholder="テキスト"
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            className={`w-full h-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
                              cellValue === 'late' ? '' : 'hover:bg-blue-100'
                            } ${
                              isDropdownOpen ? 'bg-blue-100' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShiftClick(staff.id, dateKey, cellValue);
                            }}
                            title={`${staff.name} - ${format(date, 'M/d')}`}
                          >
                            <span className={`${
                              periodLabel ? 'text-xs font-bold' : 'text-2xl font-bold'
                            } select-none ${
                              periodLabel === 'START' ? 'text-green-600' : 
                              periodLabel === 'END' ? 'text-red-600' : 
                              getSymbolColor(cellValue, staff)
                            }`}>
                              {periodLabel || getCellDisplayValue(cellValue, staff)}
                            </span>
                          </button>
                          
                          {/* Shift Selection Dropdown */}
                          {isDropdownOpen && (
                            <div 
                              className="shift-dropdown absolute bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[120px]"
                              style={getDropdownPosition(staffIndex, dateIndex, orderedStaffMembers.length, dateRange.length)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                {/* Show available shifts for this staff type */}
                                {getAvailableShifts(staff.status).map(shiftKey => {
                                  const shift = shiftSymbols[shiftKey];
                                  
                                  // For パート staff, show normal shift as circle with proper label
                                  if (staff.status === 'パート' && shiftKey === 'normal') {
                                    return (
                                      <button
                                        key={shiftKey}
                                        onClick={() => handleShiftSelect(staff.id, dateKey, shiftKey)}
                                        className="w-full text-left px-3 py-2 text-base hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                      >
                                        <span className={`font-bold ${shift.color}`}>
                                          {shift.symbol}
                                        </span>
                                        <span className="text-gray-700">
                                          Circle (Normal)
                                        </span>
                                      </button>
                                    );
                                  }
                                  
                                  // For other staff types, show normal as blank
                                  if (staff.status !== 'パート' && shiftKey === 'normal') {
                                    return (
                                      <button
                                        key={shiftKey}
                                        onClick={() => handleShiftSelect(staff.id, dateKey, shiftKey)}
                                        className="w-full text-left px-3 py-2 text-base hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                                      >
                                        <span className="text-gray-600 font-medium">（空白）</span>
                                        <span className="text-gray-500">Normal Shift</span>
                                      </button>
                                    );
                                  }
                                  
                                  // For all other shifts, show normally
                                  return (
                                    <button
                                      key={shiftKey}
                                      onClick={() => handleShiftSelect(staff.id, dateKey, shiftKey)}
                                      className="w-full text-left px-3 py-2 text-base hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <span className={`font-bold ${shift.color}`}>
                                        {shift.symbol}
                                      </span>
                                      <span className="text-gray-700">
                                        {shift.label}
                                      </span>
                                    </button>
                                  );
                                })}
                                
                                {/* Custom Text Input - Always visible */}
                                <div className="border-t border-gray-100 p-2">
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      value={customInputText}
                                      onChange={(e) => setCustomInputText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleCustomTextSave(staff.id, dateKey);
                                        } else if (e.key === 'Escape') {
                                          handleCustomTextCancel();
                                        }
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="カスタムテキスト..."
                                    />
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={handleCustomTextCancel}
                                        className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors duration-200"
                                        title="キャンセル"
                                      >
                                        <X size={16} />
                                      </button>
                                      <button
                                        onClick={() => handleCustomTextSave(staff.id, dateKey)}
                                        className="flex-1 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 flex items-center justify-center transition-colors duration-200"
                                        title="保存"
                                      >
                                        <Check size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        
        {/* Day Off Count Footer */}
        <tfoot>
          <tr className="bg-yellow-100 border-t-2 border-gray-400">
            <td className="text-center font-bold text-xs border-r-2 border-gray-300 sticky left-0 bg-yellow-100 py-2" style={{ zIndex: 300, color: '#dc2626' }}>
              休日数
            </td>
            {orderedStaffMembers.map((staff, staffIndex) => {
              if (!staff || !staff.id) return null;
              
              // Calculate day off count to match statistics dashboard total
              // Total = (early × 0.5) + (off × 1) + (holiday × 1)
              let dayOffCount = 0;
              dateRange.forEach(date => {
                const dateKey = date.toISOString().split('T')[0];
                const cellValue = schedule[staff.id]?.[dateKey] || '';
                
                // For パート staff: empty cells and unavailable symbol count as day off
                if (staff.status === 'パート') {
                  if (cellValue === '' || cellValue === '⊘' || cellValue === '×') {
                    dayOffCount += 1;
                  }
                } else {
                  // Match statistics calculation: Triangle (△) = 0.5, Cross (×) = 1, Star (★) = 1
                  if (cellValue === '×') {
                    dayOffCount += 1;
                  } else if (cellValue === '△') {
                    dayOffCount += 0.5;
                  } else if (cellValue === '★') {
                    dayOffCount += 1;
                  }
                }
              });
              
              return (
                <td 
                  key={staff.id}
                  className={`text-center font-bold text-xs border-r border-gray-300 bg-yellow-100 py-2 ${
                    staffIndex === orderedStaffMembers.length - 1 ? 'border-r-2' : ''
                  }`}
                  style={{ 
                    minWidth: '40px',
                    width: '40px',
                    maxWidth: '40px',
                    color: '#dc2626'
                  }}
                >
                  {dayOffCount % 1 === 0 ? dayOffCount : dayOffCount.toFixed(1)}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ScheduleTable;