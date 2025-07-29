/**
 * useScheduleSelection - Hook for managing bulk cell selection and operations
 * Handles multi-cell selection, clipboard operations, and bulk editing
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const useScheduleSelection = (scheduleData, updateShift, staffMembers, dates, updateSchedule) => {
  // Selection state
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectionStart, setSelectionStart] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [focusedCell, setFocusedCell] = useState(null);
  
  // Clipboard state
  const [clipboard, setClipboard] = useState(null);
  const [clipboardType, setClipboardType] = useState(null); // 'cells' | 'row' | 'column'
  
  // Navigation state
  const [navigationMode, setNavigationMode] = useState(false);
  
  // Refs for event handling
  const tableRef = useRef(null);
  const selectionStartRef = useRef(null);

  /**
   * Generate cell key from staff ID and date
   */
  const getCellKey = useCallback((staffId, dateKey) => {
    return `${staffId}-${dateKey}`;
  }, []);

  /**
   * Parse cell key to get staff ID and date
   */
  const parseCellKey = useCallback((cellKey) => {
    const parts = cellKey.split('-');
    const dateKey = parts.slice(-1)[0];
    const staffId = parts.slice(0, -1).join('-');
    return { staffId, dateKey };
  }, []);

  /**
   * Check if a cell is selected
   */
  const isCellSelected = useCallback((staffId, dateKey) => {
    return selectedCells.has(getCellKey(staffId, dateKey));
  }, [selectedCells, getCellKey]);

  /**
   * Check if a cell is focused
   */
  const isCellFocused = useCallback((staffId, dateKey) => {
    return focusedCell === getCellKey(staffId, dateKey);
  }, [focusedCell, getCellKey]);

  /**
   * Get range selection between two cells
   */
  const getRangeSelection = useCallback((startKey, endKey) => {
    if (!staffMembers || staffMembers.length === 0 || !dates || dates.length === 0) {
      return [];
    }
    
    const start = parseCellKey(startKey);
    const end = parseCellKey(endKey);
    
    // Find indices
    const startStaffIndex = staffMembers.findIndex(s => s && s.id === start.staffId);
    const endStaffIndex = staffMembers.findIndex(s => s && s.id === end.staffId);
    const startDateIndex = dates.findIndex(d => d === start.dateKey);
    const endDateIndex = dates.findIndex(d => d === end.dateKey);
    
    if (startStaffIndex === -1 || endStaffIndex === -1 || startDateIndex === -1 || endDateIndex === -1) {
      return [];
    }
    
    // Calculate range bounds
    const minStaffIndex = Math.min(startStaffIndex, endStaffIndex);
    const maxStaffIndex = Math.max(startStaffIndex, endStaffIndex);
    const minDateIndex = Math.min(startDateIndex, endDateIndex);
    const maxDateIndex = Math.max(startDateIndex, endDateIndex);
    
    // Generate range
    const range = [];
    for (let si = minStaffIndex; si <= maxStaffIndex; si++) {
      for (let di = minDateIndex; di <= maxDateIndex; di++) {
        if (staffMembers[si] && staffMembers[si].id && dates[di]) {
          const staffId = staffMembers[si].id;
          const dateKey = dates[di];
          range.push(getCellKey(staffId, dateKey));
        }
      }
    }
    
    return range;
  }, [staffMembers, dates, parseCellKey, getCellKey]);

  /**
   * Start cell selection
   */
  const startSelection = useCallback((staffId, dateKey, isShiftKey = false, isCtrlKey = false) => {
    const cellKey = getCellKey(staffId, dateKey);
    
    if (isShiftKey && selectionStart) {
      // Extend selection from start to current cell, adding to existing selection
      const rangeSelection = getRangeSelection(selectionStart, cellKey);
      const newSelection = new Set([...selectedCells, ...rangeSelection]);
      setSelectedCells(newSelection);
    } else if (isCtrlKey) {
      // Toggle individual cell selection (add/remove from existing selection)
      const newSelection = new Set(selectedCells);
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey);
      } else {
        newSelection.add(cellKey);
        setSelectionStart(cellKey); // Update selection start for future shift+clicks
      }
      setSelectedCells(newSelection);
    } else {
      // Start new selection (clears existing)
      setSelectionStart(cellKey);
      setSelectedCells(new Set([cellKey]));
      setIsSelecting(true);
    }
    
    setFocusedCell(cellKey);
  }, [getCellKey, selectionStart, getRangeSelection, selectedCells]);

  /**
   * Extend selection during drag
   */
  const extendSelection = useCallback((staffId, dateKey) => {
    if (!isSelecting || !selectionStart) return;
    
    const cellKey = getCellKey(staffId, dateKey);
    const newSelection = getRangeSelection(selectionStart, cellKey);
    setSelectedCells(new Set(newSelection));
    setFocusedCell(cellKey);
  }, [isSelecting, selectionStart, getCellKey, getRangeSelection]);

  /**
   * End selection
   */
  const endSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setSelectionStart(null);
    setIsSelecting(false);
    setFocusedCell(null);
  }, []);

  /**
   * Select entire week for a staff member
   */
  const selectWeek = useCallback((staffId) => {
    const weekCells = dates.map(dateKey => getCellKey(staffId, dateKey));
    setSelectedCells(new Set(weekCells));
    setSelectionStart(weekCells[0]);
    setFocusedCell(weekCells[0]);
    setIsSelecting(false);
  }, [dates, getCellKey]);

  /**
   * Select entire column (all staff for a specific date)
   */
  const selectColumn = useCallback((dateKey) => {
    if (!staffMembers || staffMembers.length === 0) return;
    
    const columnCells = staffMembers
      .filter(staff => staff && staff.id)
      .map(staff => getCellKey(staff.id, dateKey));
    
    if (columnCells.length === 0) return;
    
    setSelectedCells(new Set(columnCells));
    setSelectionStart(columnCells[0]);
    setFocusedCell(columnCells[0]);
    setIsSelecting(false);
  }, [staffMembers, getCellKey]);


  /**
   * Apply shift value to selected cells
   */
  const applyToSelected = useCallback((shiftValue) => {
    if (selectedCells.size === 0) return;
    
    // CRITICAL FIX: Ensure we have the latest schedule data and apply all updates
    if (updateSchedule && typeof updateSchedule === 'function') {
      try {
        // Create completely new schedule object to ensure React detects the change
        const newSchedule = JSON.parse(JSON.stringify(scheduleData)); // Deep clone to avoid mutations
        
        selectedCells.forEach(cellKey => {
          const { staffId, dateKey } = parseCellKey(cellKey);
          
          // Ensure staff exists in schedule
          if (!newSchedule[staffId]) {
            newSchedule[staffId] = {};
          }
          
          // Apply the update
          newSchedule[staffId][dateKey] = shiftValue;
        });
        
        // Verify changes were made before calling updateSchedule
        const hasChanges = Array.from(selectedCells).some(cellKey => {
          const { staffId, dateKey } = parseCellKey(cellKey);
          return scheduleData[staffId]?.[dateKey] !== newSchedule[staffId]?.[dateKey];
        });
        
        if (hasChanges) {
          updateSchedule(newSchedule);
        }
      } catch (error) {
        console.error('Error in bulk operation:', error);
        // Fallback to individual updates if batch update fails
        selectedCells.forEach(cellKey => {
          const { staffId, dateKey } = parseCellKey(cellKey);
          updateShift(staffId, dateKey, shiftValue);
        });
      }
    } else {
      // Fallback to individual updates if updateSchedule is not available
      selectedCells.forEach(cellKey => {
        const { staffId, dateKey } = parseCellKey(cellKey);
        updateShift(staffId, dateKey, shiftValue);
      });
    }
  }, [selectedCells, parseCellKey, updateShift, scheduleData, updateSchedule]);

  /**
   * Clear selected cells
   */
  const clearSelected = useCallback(() => {
    applyToSelected('');
  }, [applyToSelected]);

  /**
   * Copy selected cells to clipboard
   */
  const copySelected = useCallback(() => {
    if (selectedCells.size === 0) return;
    
    const cellData = Array.from(selectedCells).map(cellKey => {
      const { staffId, dateKey } = parseCellKey(cellKey);
      const shiftValue = scheduleData[staffId]?.[dateKey] || '';
      return {
        cellKey,
        staffId,
        dateKey,
        value: shiftValue
      };
    });
    
    setClipboard(cellData);
    setClipboardType('cells');
    
    return cellData.length;
  }, [selectedCells, parseCellKey, scheduleData]);

  /**
   * Paste clipboard data to selected cells
   */
  const pasteToSelected = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return 0;
    
    if (selectedCells.size === 0) return 0;
    
    // Simple paste - apply first clipboard value to all selected cells
    const firstValue = clipboard[0].value;
    applyToSelected(firstValue);
    
    return selectedCells.size;
  }, [clipboard, selectedCells, applyToSelected]);

  /**
   * Navigate with keyboard
   */
  const navigateCell = useCallback((direction) => {
    if (!focusedCell) {
      // Focus first cell if none focused
      if (staffMembers.length > 0 && dates.length > 0) {
        const firstCell = getCellKey(staffMembers[0].id, dates[0]);
        setFocusedCell(firstCell);
        setSelectedCells(new Set([firstCell]));
      }
      return;
    }
    
    // Ensure we have valid data
    if (!staffMembers || staffMembers.length === 0 || !dates || dates.length === 0) {
      return;
    }
    
    const { staffId, dateKey } = parseCellKey(focusedCell);
    const staffIndex = staffMembers.findIndex(s => s && s.id === staffId);
    const dateIndex = dates.findIndex(d => d === dateKey);
    
    // If current position is invalid, reset to first cell
    if (staffIndex === -1 || dateIndex === -1) {
      const firstCell = getCellKey(staffMembers[0].id, dates[0]);
      setFocusedCell(firstCell);
      setSelectedCells(new Set([firstCell]));
      return;
    }
    
    let newStaffIndex = staffIndex;
    let newDateIndex = dateIndex;
    
    switch (direction) {
      case 'up':
        newStaffIndex = Math.max(0, staffIndex - 1);
        break;
      case 'down':
        newStaffIndex = Math.min(staffMembers.length - 1, staffIndex + 1);
        break;
      case 'left':
        newDateIndex = Math.max(0, dateIndex - 1);
        break;
      case 'right':
        newDateIndex = Math.min(dates.length - 1, dateIndex + 1);
        break;
      default:
        return;
    }
    
    // Ensure the new indices are valid
    if (newStaffIndex < 0 || newStaffIndex >= staffMembers.length || 
        newDateIndex < 0 || newDateIndex >= dates.length ||
        !staffMembers[newStaffIndex] || !staffMembers[newStaffIndex].id) {
      return;
    }
    
    const newStaffId = staffMembers[newStaffIndex].id;
    const newDateKey = dates[newDateIndex];
    const newCellKey = getCellKey(newStaffId, newDateKey);
    
    setFocusedCell(newCellKey);
    setSelectedCells(new Set([newCellKey]));
    setNavigationMode(true);
  }, [focusedCell, staffMembers, dates, parseCellKey, getCellKey]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboardShortcut = useCallback((key, ctrlKey = false, shiftKey = false) => {
    if (ctrlKey) {
      switch (key.toLowerCase()) {
        case 'c':
          return copySelected();
        case 'v':
          return pasteToSelected();
        case 'a':
          // Select all cells
          if (!staffMembers || staffMembers.length === 0 || !dates || dates.length === 0) {
            return 0;
          }
          const allCells = staffMembers
            .filter(staff => staff && staff.id)
            .flatMap(staff => 
              dates.map(date => getCellKey(staff.id, date))
            );
          setSelectedCells(new Set(allCells));
          return allCells.length;
        default:
          return 0;
      }
    }
    
    // Quick shift entry
    switch (key) {
      case '1':
        applyToSelected('△');
        return selectedCells.size;
      case '2':
        applyToSelected('○');
        return selectedCells.size;
      case '3':
        applyToSelected('▽');
        return selectedCells.size;
      case '4':
      case 'x':
      case 'X':
        applyToSelected('×');
        return selectedCells.size;
      case ' ':
      case 'Delete':
      case 'Backspace':
        clearSelected();
        return selectedCells.size;
      case 'ArrowUp':
        navigateCell('up');
        return 0;
      case 'ArrowDown':
        navigateCell('down');
        return 0;
      case 'ArrowLeft':
        navigateCell('left');
        return 0;
      case 'ArrowRight':
        navigateCell('right');
        return 0;
      default:
        return 0;
    }
  }, [copySelected, pasteToSelected, applyToSelected, clearSelected, navigateCell, selectedCells.size, staffMembers, dates, getCellKey]);

  /**
   * Get selection statistics
   */
  const getSelectionStats = useCallback(() => {
    return {
      selectedCount: selectedCells.size,
      hasClipboard: clipboard && clipboard.length > 0,
      clipboardSize: clipboard ? clipboard.length : 0,
      isNavigating: navigationMode
    };
  }, [selectedCells.size, clipboard, navigationMode]);

  // Setup keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if we have focus and selected cells
      if (selectedCells.size === 0 && !focusedCell) return;
      
      // Prevent default for navigation keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      
      const result = handleKeyboardShortcut(e.key, e.ctrlKey || e.metaKey, e.shiftKey);
      
      // Reset navigation mode after key action
      if (result > 0) {
        setNavigationMode(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCells.size, focusedCell, handleKeyboardShortcut]);

  return {
    // Selection state
    selectedCells,
    focusedCell,
    isSelecting,
    
    // Selection methods
    startSelection,
    extendSelection,
    endSelection,
    clearSelection,
    isCellSelected,
    isCellFocused,
    selectWeek,
    selectColumn,
    
    // Bulk operations
    applyToSelected,
    clearSelected,
    copySelected,
    pasteToSelected,
    
    // Navigation
    navigateCell,
    navigationMode,
    
    // Utilities
    getCellKey,
    parseCellKey,
    getSelectionStats,
    handleKeyboardShortcut,
    
    // Refs
    tableRef
  };
};

export default useScheduleSelection;