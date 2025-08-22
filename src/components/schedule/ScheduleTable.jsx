import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Trash2,
  Edit,
  Check,
  X,
  Copy,
  Clipboard,
  MousePointer2,
} from "lucide-react";
import {
  shiftSymbols,
  getAvailableShifts,
} from "../../constants/shiftConstants";
import {
  getDropdownPosition,
  getDateLabel,
  isDateWithinWorkPeriod,
} from "../../utils/dateUtils";
import useScheduleSelection from "../../hooks/useScheduleSelection";

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
  editStaffName,
}) => {
  // Prepare date keys for selection hook
  const dateKeys = dateRange.map((date) => date.toISOString().split("T")[0]);

  // Initialize selection hook
  const {
    selectedCells,
    focusedCell,
    isSelecting,
    startSelection,
    startDragSelection,
    extendSelection,
    endSelection,
    clearSelection,
    isCellSelected,
    isCellFocused,
    selectWeek,
    selectColumn,
    applyToSelected,
    clearSelected,
    copySelected,
    pasteToSelected,
    navigateCell,
    getCellKey,
    parseCellKey,
    getSelectionStats,
    tableRef,
  } = useScheduleSelection(
    schedule,
    updateShift,
    orderedStaffMembers,
    dateKeys,
    updateSchedule,
  );

  const [customInputText, setCustomInputText] = useState("");
  const [contextMenu, setContextMenu] = useState(null); // { x, y, cellKey }
  // Show bulk toolbar only when more than one cell is selected
  const showBulkToolbar = selectedCells.size > 1;

  // Track drag state to prevent accidental drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState(null);

  // UX improvements for dropdown behavior
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedCell, setLastClickedCell] = useState(null);
  const [dropdownDelay, setDropdownDelay] = useState(null);
  const CLICK_TIME_GAP_THRESHOLD = 1000; // 1 second
  const DROPDOWN_DELAY_TIME = 300; // 300ms delay
  const DOUBLE_CLICK_TIME = 400; // 400ms for double-click detection

  // Handle dropdown visibility based on cell selection - only hide when multiple cells
  useEffect(() => {
    if (selectedCells.size > 1) {
      // Multiple cells selected - hide dropdown
      setShowDropdown(null);
      setEditingCell(null);
    }
  }, [selectedCells.size, setShowDropdown, setEditingCell]);

  // Function to get symbol color based on the cell value
  const getSymbolColor = (value, staff) => {
    // For パート staff, if value is empty, default to unavailable
    if (staff?.status === "パート" && (!value || value === "")) {
      return shiftSymbols.unavailable.color;
    }

    if (!value) return "text-gray-400"; // Empty/blank cells

    // Find the shift type by symbol
    const shiftEntry = Object.entries(shiftSymbols).find(
      ([key, shift]) => shift.symbol === value,
    );

    if (shiftEntry) {
      return shiftEntry[1].color; // Return the color class
    }

    // For custom text (not a predefined symbol)
    return "text-gray-700";
  };

  // Function to get display value for cell
  const getCellDisplayValue = (value, staff) => {
    // For パート staff, if value is empty, default to unavailable symbol
    if (staff?.status === "パート" && (!value || value === "")) {
      return shiftSymbols.unavailable.symbol;
    }

    // For late shift, don't display symbol (show as background color only)
    if (value === "late") {
      return "";
    }

    return value;
  };

  // Enhanced cell click handler with improved UX
  const handleShiftClick = useCallback(
    (staffId, dateKey, currentValue, event) => {
      event.preventDefault();
      event.stopPropagation();

      const cellKey = getCellKey(staffId, dateKey);
      const currentTime = Date.now();

      // Clear any pending dropdown delay
      if (dropdownDelay) {
        clearTimeout(dropdownDelay);
        setDropdownDelay(null);
      }

      // Handle selection with modifier keys FIRST
      if (event.shiftKey) {
        // Extend selection using shift key (adds to existing selection)
        startSelection(staffId, dateKey, true, false);
        setShowDropdown(null); // Close dropdown when using modifier keys
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        // Toggle individual cell selection with ctrl/cmd key
        startSelection(staffId, dateKey, false, true);
        setShowDropdown(null); // Close dropdown when using modifier keys
        return;
      }

      // For regular clicks, always start with selection
      startSelection(staffId, dateKey, false, false);

      // UX Improvement 1: Double-click and time gap detection for same cell clicks
      if (lastClickedCell === cellKey) {
        const timeSinceLastClick = currentTime - lastClickTime;

        if (timeSinceLastClick <= DOUBLE_CLICK_TIME) {
          // Double-click detected - enter custom text mode immediately
          setCustomText(currentValue || "");
          setEditingCell(cellKey);
          setShowDropdown(cellKey);
          setLastClickTime(currentTime);
          return;
        } else if (timeSinceLastClick > CLICK_TIME_GAP_THRESHOLD) {
          // Time gap detected - close dropdown and don't show it again
          setShowDropdown(null);
          setLastClickTime(currentTime);
          return;
        } else if (showDropdown === cellKey) {
          // Quick successive clicks on same cell with dropdown open - toggle dropdown
          setShowDropdown(null);
          setLastClickTime(currentTime);
          return;
        }
      }

      // Update last click tracking
      setLastClickTime(currentTime);
      setLastClickedCell(cellKey);

      // Handle dropdown display logic
      if (!isCellSelected(staffId, dateKey)) {
        // If clicking a cell with custom text (not just "自由"), enter edit mode immediately
        const isCustomText =
          currentValue &&
          !Object.values(shiftSymbols).some(
            (shift) => shift.symbol === currentValue || currentValue === "late",
          );
        if (isCustomText) {
          setCustomText(currentValue);
          setEditingCell(cellKey);
          setShowDropdown(cellKey);
          return;
        }

        const staff = staffMembers.find((s) => s.id === staffId);
        const status = staff?.status || "派遣";
        const availableShifts = getAvailableShifts(status);

        if (availableShifts.length > 0) {
          // UX Improvement 2: Delayed dropdown for cell switching
          if (showDropdown && showDropdown !== cellKey) {
            // User is switching from another cell - add delay
            const delayTimeout = setTimeout(() => {
              setShowDropdown(cellKey);
              setEditingCell(null);
              setDropdownDelay(null);
            }, DROPDOWN_DELAY_TIME);

            setDropdownDelay(delayTimeout);
            // Temporarily hide current dropdown
            setShowDropdown(null);
          } else {
            // First click or same cell - show immediately
            setShowDropdown(cellKey);
            setEditingCell(null);
          }
        }
      }
    },
    [
      getCellKey,
      startSelection,
      isCellSelected,
      showDropdown,
      setCustomText,
      setEditingCell,
      setShowDropdown,
      staffMembers,
      lastClickTime,
      lastClickedCell,
      dropdownDelay,
    ],
  );

  const handleShiftSelect = (staffId, dateKey, shiftKey) => {
    // Handle different shift types
    const staff = staffMembers.find((s) => s.id === staffId);
    let shiftValue;

    if (shiftKey === "normal") {
      // For パート staff, normal shift shows circle symbol
      if (staff?.status === "パート") {
        shiftValue = shiftSymbols[shiftKey]?.symbol || "○"; // Store circle symbol
      } else {
        shiftValue = ""; // Normal shift shows as blank for other staff
      }
    } else if (shiftKey === "late") {
      shiftValue = "late"; // Late shift stores as 'late' key, not symbol
    } else {
      shiftValue = shiftSymbols[shiftKey]?.symbol || shiftKey; // Other shifts show symbols
    }

    updateShift(staffId, dateKey, shiftValue);
    setShowDropdown(null);
    setCustomInputText("");
  };

  const handleCustomTextSave = (staffId, dateKey) => {
    const finalText = customInputText.trim() || "";
    updateShift(staffId, dateKey, finalText);
    setEditingCell(null);
    setShowDropdown(null);
    setCustomInputText("");
  };

  // Helper function to check if date is start/end for all staff types
  const getStaffPeriodLabel = (staff, date) => {
    // Early return if staff has no period data at all
    if (!staff || (!staff.startPeriod && !staff.endPeriod)) {
      return null;
    }

    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    // Check if it's start date
    if (
      staff.startPeriod &&
      staff.startPeriod.year &&
      staff.startPeriod.month
    ) {
      const startDate = new Date(
        staff.startPeriod.year,
        staff.startPeriod.month - 1,
        staff.startPeriod.day || 1,
      );
      startDate.setHours(0, 0, 0, 0);

      if (currentDate.getTime() === startDate.getTime()) {
        return "START";
      }
    }

    // Check if it's end date
    if (staff.endPeriod && staff.endPeriod.year && staff.endPeriod.month) {
      const endDate = new Date(
        staff.endPeriod.year,
        staff.endPeriod.month - 1,
        staff.endPeriod.day || 1,
      );
      endDate.setHours(0, 0, 0, 0);

      if (currentDate.getTime() === endDate.getTime()) {
        return "END";
      }
    }

    return null;
  };

  const handleCustomTextSubmit = (staffId, dateKey) => {
    const finalText = customText.trim() || "";
    updateShift(staffId, dateKey, finalText);
    setEditingCell(null);
    setCustomText("");
  };

  const handleCustomTextCancel = () => {
    setCustomInputText("");
    setShowDropdown(null);
  };

  // Handle right-click context menu
  const handleCellRightClick = useCallback(
    (event, staffId, dateKey) => {
      event.preventDefault();
      const cellKey = getCellKey(staffId, dateKey);

      // Select cell if not already selected
      if (!isCellSelected(staffId, dateKey)) {
        startSelection(staffId, dateKey, false);
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        cellKey,
        staffId,
        dateKey,
      });
    },
    [getCellKey, isCellSelected, startSelection],
  );

  // Handle mouse events for drag selection (simplified - main logic is in cell event handlers)
  const handleCellMouseDown = useCallback((event, staffId, dateKey) => {
    // Mouse down logic is handled directly in the cell onMouseDown
  }, []);

  const handleCellMouseEnter = useCallback((staffId, dateKey) => {
    // Mouse enter logic is handled directly in the cell onMouseEnter
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Global mouse up handler to clean up drag state
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging || dragStartCell) {
        setIsDragging(false);
        setDragStartCell(null);
        endSelection();
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, dragStartCell, endSelection]);

  // Click outside table to deselect cells
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside the table container
      if (tableRef.current && !tableRef.current.contains(event.target)) {
        // Also check if click is not on the bulk toolbar or context menu
        const bulkToolbar =
          document.querySelector(".fixed.bottom-0") ||
          document.querySelector(".animate-slide-up-toolbar");
        const contextMenu = document.querySelector(
          ".fixed.bg-white.border.border-gray-300",
        );

        if (
          (!bulkToolbar || !bulkToolbar.contains(event.target)) &&
          (!contextMenu || !contextMenu.contains(event.target))
        ) {
          clearSelection();
          setContextMenu(null);
          // Clear dropdown delay when clicking outside
          if (dropdownDelay) {
            clearTimeout(dropdownDelay);
            setDropdownDelay(null);
          }
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearSelection, tableRef, dropdownDelay]);

  // Auto-deselect cells when user scrolls to Statistics section
  useEffect(() => {
    const statisticsSection = document.querySelector(".statistics-section");
    if (!statisticsSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When statistics section comes into view, clear cell selection
          if (entry.isIntersecting && selectedCells.size > 0) {
            clearSelection();
            setContextMenu(null);
            // Clear dropdown delay when scrolling
            if (dropdownDelay) {
              clearTimeout(dropdownDelay);
              setDropdownDelay(null);
            }
          }
        });
      },
      {
        // Trigger when 20% of the statistics section is visible
        threshold: 0.2,
        // Add some margin to trigger slightly before the section is fully visible
        rootMargin: "-10px 0px -10px 0px",
      },
    );

    observer.observe(statisticsSection);

    return () => {
      observer.disconnect();
    };
  }, [selectedCells.size, clearSelection, dropdownDelay]);

  // Cleanup dropdown delay timeout on unmount
  useEffect(() => {
    return () => {
      if (dropdownDelay) {
        clearTimeout(dropdownDelay);
      }
    };
  }, [dropdownDelay]);

  const handleDeleteStaff = (staffId) => {
    const { newStaffMembers, newSchedule } = deleteStaff(
      staffId,
      schedule,
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

  const handleNameEdit = (staffId, newName) => {
    setEditingNames((prev) => ({
      ...prev,
      [staffId]: newName,
    }));
  };

  const handleNameSubmit = (staffId) => {
    const newName = editingNames[staffId];
    if (newName && newName.trim()) {
      editStaffName(staffId, newName.trim(), (newStaff) => {
        setStaffMembersByMonth((prev) => ({
          ...prev,
          [currentMonthIndex]: newStaff,
        }));
      });

      setTimeout(() => {
        scheduleAutoSave(schedule, staffMembers);
      }, 0);
    }
    setEditingNames((prev) => {
      const updated = { ...prev };
      delete updated[staffId];
      return updated;
    });
  };

  // Quick action handlers
  const handleQuickAction = useCallback(
    (action) => {
      switch (action) {
        case "copy":
          copySelected();
          break;
        case "paste":
          pasteToSelected();
          break;
        case "clear":
          clearSelected();
          break;
        case "early":
          applyToSelected("△");
          break;
        case "normal":
          applyToSelected("○");
          break;
        case "late":
          applyToSelected("▽");
          break;
        case "off":
          applyToSelected("×");
          break;
        default:
          break;
      }
      setContextMenu(null);
    },
    [copySelected, pasteToSelected, clearSelected, applyToSelected],
  );

  // Handle drag-to-fill events (placeholder for future implementation)
  const handleDragFillStart = useCallback((cellKey, event) => {
  }, []);

  const handleDragFillPreview = useCallback((event) => {
  }, []);

  const handleDragFillEnd = useCallback((event) => {
  }, []);

  return (
    <div className="relative">
      {/* Bulk Operations Toolbar - Bottom positioned with slide up animation */}
      {showBulkToolbar && (
        <div
          className="fixed bottom-0 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-t-lg shadow-2xl p-4 z-50 flex items-center gap-3 animate-slide-up-toolbar"
          style={{
            marginBottom: "0px",
            boxShadow:
              "0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -10px 10px -5px rgba(0, 0, 0, 0.04)",
            minWidth: "400px",
          }}
        >
          <span className="text-sm text-gray-600 mr-2">
            {selectedCells.size} cells selected
          </span>
          <button
            onClick={() => handleQuickAction("copy")}
            className="p-1 hover:bg-gray-100 rounded"
            title="Copy (Ctrl+C)"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => handleQuickAction("paste")}
            className="p-1 hover:bg-gray-100 rounded"
            title="Paste (Ctrl+V)"
            disabled={!getSelectionStats().hasClipboard}
          >
            <Clipboard
              size={16}
              className={
                getSelectionStats().hasClipboard
                  ? "text-blue-600"
                  : "text-gray-400"
              }
            />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button
            onClick={() => handleQuickAction("off")}
            className="px-2 py-1 text-sm hover:bg-gray-100 rounded font-bold text-red-600"
            title="Day Off (Press 4)"
          >
            ×
          </button>
          <button
            onClick={() => handleQuickAction("early")}
            className="px-2 py-1 text-sm hover:bg-gray-100 rounded font-bold text-blue-600"
            title="Early Shift (Press 1)"
          >
            △
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <button
            onClick={() => handleQuickAction("clear")}
            className="px-2 py-1 text-sm hover:bg-red-100 rounded text-red-600"
            title="Clear (Delete)"
          >
            Clear
          </button>
          <button
            onClick={clearSelection}
            className="p-1 hover:bg-gray-100 rounded"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Table Header with Title and Legend */}
      <div className="w-4/5 mx-auto mb-4">
        <div className="bg-white border border-gray-200 rounded-t-lg px-6 py-4 border-b-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              調理場シフト表
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-200 rounded border border-blue-300"></div>
                <span>早番(△)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-200 rounded border border-red-300"></div>
                <span>休み(×)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={tableRef}
        className="table-container w-4/5 mx-auto overflow-auto border border-gray-200 rounded-b-lg shadow-sm mb-6"
        style={{ maxHeight: "calc(100vh - 110px)" }}
        tabIndex={0}
        onMouseUp={() => {
          // End selection on mouse up and clear drag state
          endSelection();
          setIsDragging(false);
          setDragStartCell(null);
        }}
        onFocus={() => {
          // Ensure table is focused for keyboard events
        }}
        onBlur={() => {
          // Don't clear selection on blur to maintain keyboard shortcuts
        }}
        onClick={(e) => {
          // Focus table when clicked to enable keyboard shortcuts
          e.currentTarget.focus();
        }}
      >
        <table
          className="shift-table w-full text-sm"
          style={{ minWidth: `${40 + orderedStaffMembers.length * 40}px` }}
        >
          {/* Sticky Header Row: Staff Names as Column Headers */}
          <thead>
            <tr>
              <th
                className="bg-gray-600 text-white min-w-[40px] border-r-2 border-gray-400 sticky left-0"
                style={{ zIndex: 400, width: "40px" }}
              >
                <div className="flex items-center justify-center gap-1 py-0.5">
                  <span className="text-xs font-medium">日付</span>
                </div>
              </th>

              {/* Staff Column Headers */}
              {orderedStaffMembers.map((staff, staffIndex) => {
                if (!staff) return null;
                return (
                  <th
                    key={staff.id}
                    className={`bg-gray-600 text-white text-center relative border-r border-gray-400 cursor-pointer hover:bg-gray-500 ${
                      staffIndex === orderedStaffMembers.length - 1
                        ? "border-r-2"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectWeek(staff.id);
                    }}
                    title={`Click to select entire week for ${staff.name}`}
                    style={{
                      minWidth: "40px",
                      width: "40px",
                      maxWidth: "40px",
                      position: "relative",
                    }}
                  >
                    <div className="flex flex-col items-center justify-center py-1 px-1 h-full">
                      {/* Delete Button (only visible in delete mode) */}
                      {editingColumn === "delete-mode" && (
                        <button
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10 transition-colors duration-200"
                          title={`Delete ${staff.name}`}
                        >
                          <Trash2 size={8} />
                        </button>
                      )}

                      {/* Staff Name (editable in edit-name mode) */}
                      {editingColumn === "edit-name-mode" ? (
                        <input
                          type="text"
                          value={
                            editingNames[staff.id] !== undefined
                              ? editingNames[staff.id]
                              : staff.name
                          }
                          onChange={(e) =>
                            handleNameEdit(staff.id, e.target.value)
                          }
                          onBlur={() => handleNameSubmit(staff.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNameSubmit(staff.id);
                            }
                          }}
                          className="w-full text-center text-xs bg-white text-black border border-gray-300 rounded px-1 py-0.5"
                          style={{ minHeight: "20px" }}
                          autoFocus={editingSpecificColumn === staff.id}
                        />
                      ) : (
                        <span
                          className="text-sm font-medium cursor-pointer hover:bg-gray-500 px-1 py-0.5 rounded transition-colors duration-200"
                          style={{
                            fontSize: "14px",
                            lineHeight: "16px",
                            maxWidth: "80px",
                            overflow: "hidden",
                            wordBreak: "break-all",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          onClick={() => {
                            if (editingColumn === "edit-name-mode") {
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
              const dateKey = date.toISOString().split("T")[0];
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <tr key={dateKey} className="hover:bg-gray-50">
                  {/* Date Cell (Sticky Left Column) */}
                  <td
                    className="text-center font-medium border-r-2 border-gray-300 sticky left-0 bg-white cursor-pointer hover:bg-gray-50"
                    style={{
                      minWidth: "40px",
                      width: "40px",
                      zIndex: 300,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectColumn(dateKey);
                    }}
                    title={`Click to select entire column for ${format(date, "M/d")}`}
                  >
                    <div className="py-1 px-1 flex items-center justify-center gap-0.5">
                      <div
                        className={`text-xs font-bold ${isWeekend ? "text-red-600" : "text-gray-700"}`}
                      >
                        {getDateLabel(date)}
                      </div>
                      <div
                        className={`text-xs opacity-75 ${isWeekend ? "text-red-600" : "text-gray-700"}`}
                      >
                        {format(date, "E", { locale: ja })}
                      </div>
                    </div>
                  </td>

                  {/* Staff Shift Cells */}
                  {orderedStaffMembers.map((staff, staffIndex) => {
                    if (!staff) {
                      return null;
                    }

                    const cellKey = getCellKey(staff.id, dateKey);
                    const cellValue = schedule[staff.id]?.[dateKey] || "";
                    const isActiveForDate = isDateWithinWorkPeriod(date, staff);

                    return (
                      <td
                        key={staff.id}
                        className={`text-center border-r border-gray-200 relative ${
                          staffIndex === orderedStaffMembers.length - 1
                            ? "border-r-2 border-gray-300"
                            : ""
                        } ${
                          cellValue === "late"
                            ? "bg-purple-200 hover:bg-purple-300"
                            : "hover:bg-blue-50"
                        } ${!isActiveForDate ? "bg-gray-100" : ""}`}
                        style={{
                          minWidth: "40px",
                          width: "40px",
                          maxWidth: "40px",
                          height: "50px",
                          padding: "0",
                        }}
                      >
                        <button
                          className={`w-full h-full flex items-center justify-center transition-all duration-200 relative ${
                            !isActiveForDate
                              ? "cursor-not-allowed text-gray-400"
                              : "cursor-pointer hover:bg-blue-100"
                          } ${
                            isCellSelected(staff.id, dateKey)
                              ? "bg-blue-200 hover:bg-blue-300"
                              : ""
                          } ${
                            isCellFocused(staff.id, dateKey)
                              ? "ring-2 ring-blue-500 ring-inset"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();

                            if (isActiveForDate) {
                              // Use the unified handleShiftClick function for all click handling
                              handleShiftClick(staff.id, dateKey, cellValue, e);
                            }
                          }}
                          onMouseDown={(e) => {
                            if (isActiveForDate && e.button === 0) {
                              // Left mouse button only
                              e.preventDefault();
                              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                // Prepare for potential drag - but don't start selecting yet
                                setDragStartCell({
                                  staffId: staff.id,
                                  dateKey,
                                });
                                setIsDragging(false);
                              }
                            }
                          }}
                          onMouseMove={(e) => {
                            if (
                              isActiveForDate &&
                              dragStartCell &&
                              !isDragging
                            ) {
                              // User moved mouse while holding down - start drag selection
                              setIsDragging(true);
                              startDragSelection(
                                dragStartCell.staffId,
                                dragStartCell.dateKey,
                              );
                              // Clear the drag start cell since we've started dragging
                              setDragStartCell(null);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (isActiveForDate && isSelecting && isDragging) {
                              // Only extend selection if we're actually in drag mode
                              extendSelection(staff.id, dateKey);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (isActiveForDate) {
                              handleCellRightClick(e, staff.id, dateKey);
                            }
                          }}
                          title={`${staff.name} - ${format(date, "M/d")}${!isActiveForDate ? " (Inactive)" : ""}${
                            isCellSelected(staff.id, dateKey)
                              ? " (Selected)"
                              : ""
                          }`}
                          data-cell-key={cellKey}
                        >
                          <span
                            className={`text-2xl font-bold select-none ${
                              !isActiveForDate
                                ? "text-gray-400"
                                : getSymbolColor(cellValue, staff)
                            }`}
                          >
                            {!isActiveForDate
                              ? "-"
                              : getCellDisplayValue(cellValue, staff)}
                          </span>

                          {/* Selection indicator for selected cells */}
                          {isCellSelected(staff.id, dateKey) &&
                            isActiveForDate && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full transform translate-x-1 -translate-y-1"></div>
                            )}

                          {/* Period labels for all staff start/end dates */}
                          {(() => {
                            const periodLabel = getStaffPeriodLabel(
                              staff,
                              date,
                            );
                            if (periodLabel) {
                              return (
                                <div
                                  className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded z-10 ${
                                    periodLabel === "START"
                                      ? "bg-green-500 text-white"
                                      : "bg-red-500 text-white"
                                  }`}
                                >
                                  {periodLabel}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </button>
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
              <td
                className="text-center font-bold text-xs border-r-2 border-gray-300 sticky left-0 bg-yellow-100 py-2"
                style={{ zIndex: 300, color: "#dc2626" }}
              >
                休日数
              </td>
              {orderedStaffMembers.map((staff, staffIndex) => {
                if (!staff) return null;

                // Calculate day off count to match statistics dashboard total
                // Total = (early × 0.5) + (off × 1) + (holiday × 1)
                let dayOffCount = 0;
                dateRange.forEach((date) => {
                  const dateKey = date.toISOString().split("T")[0];
                  const cellValue = schedule[staff.id]?.[dateKey] || "";

                  // For パート staff: empty cells and unavailable symbol count as day off
                  if (staff.status === "パート") {
                    if (
                      cellValue === "" ||
                      cellValue === "⊘" ||
                      cellValue === "×"
                    ) {
                      dayOffCount += 1;
                    }
                  } else {
                    // Match statistics calculation: Triangle (△) = 0.5, Cross (×) = 1, Star (★) = 1
                    if (cellValue === "×") {
                      dayOffCount += 1;
                    } else if (cellValue === "△") {
                      dayOffCount += 0.5;
                    } else if (cellValue === "★") {
                      dayOffCount += 1;
                    }
                  }
                });

                return (
                  <td
                    key={staff.id}
                    className={`text-center font-bold text-xs border-r border-gray-300 bg-yellow-100 py-2 ${
                      staffIndex === orderedStaffMembers.length - 1
                        ? "border-r-2"
                        : ""
                    }`}
                    style={{
                      minWidth: "40px",
                      width: "40px",
                      maxWidth: "40px",
                      color: "#dc2626",
                    }}
                  >
                    {dayOffCount % 1 === 0
                      ? dayOffCount
                      : dayOffCount.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg py-2 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            onClick={() => handleQuickAction("copy")}
          >
            <Copy size={14} /> Copy ({selectedCells.size} cells)
          </button>
          {getSelectionStats().hasClipboard && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
              onClick={() => handleQuickAction("paste")}
            >
              <Clipboard size={14} /> Paste
            </button>
          )}
          <hr className="my-1" />
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-600 font-bold"
            onClick={() => handleQuickAction("off")}
          >
            × Day Off
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-blue-600 font-bold"
            onClick={() => handleQuickAction("early")}
          >
            △ Early Shift
          </button>
          <hr className="my-1" />
          <button
            className="w-full px-4 py-2 text-left hover:bg-red-100 text-red-600"
            onClick={() => handleQuickAction("clear")}
          >
            Clear Selected
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduleTable;
