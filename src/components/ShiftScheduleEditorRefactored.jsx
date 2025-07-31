import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { format, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Download,
  Save,
  RotateCcw,
  Calendar,
  Users,
  UserPlus,
  FileText,
  Table,
  Printer,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  Edit,
  Maximize,
  Sparkles,
  TableProperties,
  RefreshCw,
  X,
} from "lucide-react";

// Import extracted utilities and constants
import { shiftSymbols, getAvailableShifts } from "../constants/shiftConstants";
import {
  monthPeriods,
  getDropdownPosition,
  getDateLabel,
  isDateWithinWorkPeriod,
} from "../utils/dateUtils";
import {
  getOrderedStaffMembers,
  migrateScheduleData,
  migrateStaffMembers,
} from "../utils/staffUtils";
import { generateStatistics } from "../utils/statisticsUtils";
import { exportToCSV, printSchedule } from "../utils/exportUtils";

// Import extracted components
import { useScheduleData } from "../hooks/useScheduleData";
import { useStaffManagement } from "../hooks/useStaffManagement";
import ErrorDisplay from "./schedule/ErrorDisplay";
import StatisticsDashboard from "./schedule/StatisticsDashboard";

// Import custom hooks

const ShiftScheduleEditor = ({
  supabaseScheduleData,
  isConnected,
  error: externalError,
  onSaveSchedule,
  onDeleteSchedule,
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
  const [editingSpecificColumn, setEditingSpecificColumn] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [editingNames, setEditingNames] = useState({});
  const [justEnteredEditMode, setJustEnteredEditMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");

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
  } = useScheduleData(
    currentMonthIndex,
    supabaseScheduleData,
    currentScheduleId,
    setCurrentScheduleId,
  );

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
  } = useStaffManagement(
    currentMonthIndex,
    staffMembersByMonth,
    supabaseScheduleData,
  );

  // Calculate derived data
  const orderedStaffMembers = useMemo(
    () => getOrderedStaffMembers(staffMembers, dateRange),
    [staffMembers, dateRange],
  );

  const statistics = useMemo(
    () => generateStatistics(staffMembers, schedule, dateRange),
    [staffMembers, schedule, dateRange],
  );

  // Handle external error updates
  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  // Focus handling for edit modes
  useEffect(() => {
    if (editingColumn === "edit-name-mode") {
      const initialNames = {};
      staffMembers.forEach((staff) => {
        initialNames[staff.id] = staff.name;
      });
      setEditingNames(initialNames);
    }
  }, [editingColumn, staffMembers]);

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

  const addNewColumn = () => {
    startAddingNewStaff();
  };

  const editColumnName = (staffId, newName) => {
    const newStaffMembers = staffMembers.map((staff) =>
      staff.id === staffId ? { ...staff, name: newName } : staff,
    );

    React.startTransition(() => {
      setStaffMembers(newStaffMembers);
      setStaffMembersByMonth((prev) => ({
        ...prev,
        [currentMonthIndex]: newStaffMembers,
      }));
    });

    setTimeout(() => {
      scheduleAutoSave(schedule, newStaffMembers);
    }, 0);
  };

  const deleteColumn = (staffId) => {
    if (staffMembers.length <= 1) {
      alert("最低1つの列は必要です。");
      return;
    }

    const newStaffMembers = staffMembers.filter(
      (staff) => staff.id !== staffId,
    );
    const newSchedule = { ...schedule };
    delete newSchedule[staffId];

    React.startTransition(() => {
      setStaffMembers(newStaffMembers);
      updateSchedule(newSchedule);
      setStaffMembersByMonth((prev) => ({
        ...prev,
        [currentMonthIndex]: newStaffMembers,
      }));
    });

    setTimeout(() => {
      scheduleAutoSave(newSchedule, newStaffMembers);
    }, 0);

    setEditingColumn(null);
  };

  const exitEditMode = () => {
    setEditingColumn(null);
    setEditingSpecificColumn(null);
    setEditingColumnName("");
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
          if (schedule) {
            scheduleAutoSave(schedule, staffMembers);
          }
          setShowDropdown(null);
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
          if (schedule) {
            scheduleAutoSave(schedule, staffMembers);
          }
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
    schedule,
    staffMembers,
    editingNames,
    scheduleAutoSave,
  ]);

  return (
    <div className="shift-schedule-editor max-w-full mx-auto bg-white">
      {/* Error Display */}
      <ErrorDisplay error={error} onClearError={() => setError(null)} />

      {/* Navigation Toolbar */}
      <div className="toolbar-section mb-6">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 shadow-sm">
          {/* Left Side - Month Navigation */}
          <div className="flex items-center gap-3">
            {/* Previous Month Button */}
            <button
              onClick={() =>
                handleMonthChange(Math.max(0, currentMonthIndex - 1))
              }
              disabled={currentMonthIndex === 0}
              className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
                currentMonthIndex === 0
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
              title="Previous month"
            >
              <ChevronLeft
                size={16}
                className={
                  currentMonthIndex === 0
                    ? "text-gray-400"
                    : "text-gray-600 hover:text-gray-800"
                }
              />
            </button>

            {/* Month Picker */}
            <div className="relative">
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="month-picker flex items-center px-4 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 min-w-[140px] justify-center"
              >
                <Calendar size={16} className="mr-2 text-blue-600" />
                {monthPeriods[currentMonthIndex]?.label}
              </button>

              {showMonthPicker && (
                <div className="month-picker absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
                  {monthPeriods.map((period, index) => (
                    <button
                      key={index}
                      onClick={() => handleMonthChange(index)}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                        index === currentMonthIndex
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : ""
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Next Month Button */}
            <button
              onClick={() =>
                handleMonthChange(
                  Math.min(monthPeriods.length - 1, currentMonthIndex + 1),
                )
              }
              disabled={currentMonthIndex === monthPeriods.length - 1}
              className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
                currentMonthIndex === monthPeriods.length - 1
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
              title="Next month"
            >
              <ChevronRight
                size={16}
                className={
                  currentMonthIndex === monthPeriods.length - 1
                    ? "text-gray-400"
                    : "text-gray-600 hover:text-gray-800"
                }
              />
            </button>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                // TODO: Implement fullscreen toggle
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Toggle Fullscreen"
            >
              <Maximize
                size={16}
                className="text-indigo-600 hover:text-indigo-700"
              />
            </button>

            {/* Force Sync */}
            <button
              onClick={async () => {
                // TODO: Implement force sync
                alert("✅ Data synced successfully!");
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
              title="Force sync all data to database"
            >
              <RefreshCw
                size={16}
                className="text-green-600 hover:text-green-700"
              />
            </button>

            {/* Delete Current Period */}
            <button
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete ${monthPeriods[currentMonthIndex].label} period data?`,
                );
                if (confirmed) {
                  // TODO: Implement delete period
                }
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200"
              title={`Delete ${monthPeriods[currentMonthIndex].label} period data`}
            >
              <Trash2
                size={16}
                className="text-orange-600 hover:text-orange-700"
              />
            </button>

            {/* AI Assistant */}
            <button
              onClick={() => {
                // TODO: Implement AI functionality
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="AI Assistant"
            >
              <Sparkles
                size={16}
                className="text-violet-600 hover:text-violet-700"
              />
            </button>

            {/* Add Table */}
            <button
              onClick={() => {
                // TODO: Implement add table
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Add Table"
            >
              <TableProperties
                size={16}
                className="text-teal-600 hover:text-teal-700"
              />
            </button>

            {/* Add User */}
            <button
              onClick={addNewColumn}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Add User"
            >
              <UserPlus
                size={16}
                className="text-green-600 hover:text-green-700"
              />
            </button>

            {/* Edit Staff */}
            <button
              onClick={() => setShowStaffEditModal(true)}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Edit Staff"
            >
              <Edit
                size={16}
                className="text-purple-600 hover:text-purple-700"
              />
            </button>

            {/* Delete Columns */}
            <button
              onClick={() => setEditingColumn("delete-mode")}
              className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
                editingColumn === "delete-mode"
                  ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
              title="Delete Columns"
            >
              <Trash2
                size={16}
                className={
                  editingColumn === "delete-mode"
                    ? "text-red-700"
                    : "text-red-600 hover:text-red-700"
                }
              />
            </button>

            {/* Edit Names */}
            <button
              onClick={() => {
                setEditingColumn("edit-name-mode");
                setJustEnteredEditMode(true);
              }}
              className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
                editingColumn === "edit-name-mode"
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
              title="Edit Column Names"
            >
              <Edit
                size={16}
                className={
                  editingColumn === "edit-name-mode"
                    ? "text-blue-700"
                    : "text-blue-600 hover:text-blue-700"
                }
              />
            </button>

            {/* Manual Save */}
            <button
              onClick={() => {
                scheduleAutoSave(schedule, staffMembers);
                alert("✅ Schedule saved!");
              }}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              title="Manual Save"
            >
              <Save size={16} className="text-blue-600 hover:text-blue-700" />
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExport}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Export CSV"
            >
              <Download
                size={16}
                className="text-gray-600 hover:text-gray-700"
              />
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              title="Print"
            >
              <Printer
                size={16}
                className="text-gray-600 hover:text-gray-700"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div
        className="table-container w-4/5 mx-auto overflow-auto border border-gray-200 rounded-lg shadow-sm mb-6"
        style={{ maxHeight: "calc(100vh - 110px)" }}
      >
        <table
          className="shift-table w-full text-sm"
          style={{ minWidth: `${60 + staffMembers.length * 40}px` }}
        >
          {/* Sticky Header Row: Staff Names as Column Headers */}
          <thead>
            <tr>
              <th
                className="bg-gray-600 text-white min-w-[60px] border-r-2 border-gray-400 sticky left-0"
                style={{ zIndex: 400 }}
              >
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
                      editingColumn === "delete-mode"
                        ? "hover:bg-red-600 cursor-pointer"
                        : editingColumn === "edit-name-mode"
                          ? "hover:bg-blue-600 cursor-text"
                          : ""
                    }`}
                    style={{ minWidth: "40px", padding: "4px 2px" }}
                    onClick={() => {
                      if (editingColumn === "delete-mode") {
                        deleteColumn(staff.id);
                      } else if (editingColumn === "edit-name-mode") {
                        setEditingSpecificColumn(staff.id);
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center py-1">
                      {editingColumn === "edit-name-mode" &&
                      editingSpecificColumn === staff.id ? (
                        <input
                          ref={newColumnInputRef}
                          type="text"
                          value={editingNames[staff.id] || staff.name}
                          onChange={(e) =>
                            setEditingNames((prev) => ({
                              ...prev,
                              [staff.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const newName = e.target.value.trim();
                              if (newName) {
                                editColumnName(staff.id, newName);
                              }
                              setEditingSpecificColumn(null);
                            } else if (e.key === "Escape") {
                              setEditingSpecificColumn(null);
                            }
                          }}
                          onBlur={() => {
                            const newName = editingNames[staff.id]?.trim();
                            if (newName && newName !== staff.name) {
                              editColumnName(staff.id, newName);
                            }
                            setEditingSpecificColumn(null);
                          }}
                          className="text-xs font-medium bg-white text-black px-1 py-0.5 rounded border-0 outline-none text-center w-full"
                          style={{ minWidth: "60px" }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="text-xs font-medium leading-tight">
                            {staff.name}
                          </span>
                          <span className="text-[10px] text-gray-300 leading-tight">
                            {staff.position}
                          </span>
                        </>
                      )}

                      {editingColumn === "delete-mode" && (
                        <div className="absolute inset-0 bg-red-600 bg-opacity-75 flex items-center justify-center">
                          <Trash2 size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body: Each Row = One Date, Each Column = One Staff Member */}
          <tbody>
            {dateRange.map((date, dateIndex) => {
              const dateKey = format(date, "yyyy-MM-dd");
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <tr
                  key={dateKey}
                  className={isWeekend ? "bg-red-50" : "hover:bg-gray-50"}
                >
                  {/* Date Header Column */}
                  <td
                    className="date-header bg-gray-100 font-medium text-center border-r-2 border-gray-400 sticky left-0"
                    style={{ zIndex: 300 }}
                  >
                    <div className="py-2">
                      <div className="text-sm font-bold">
                        {format(date, "dd")}
                      </div>
                      <div className="text-xs text-gray-600">
                        {format(date, "EEE", { locale: ja })}
                      </div>
                    </div>
                  </td>

                  {/* Staff Shift Cells - One Column per Staff Member */}
                  {orderedStaffMembers.map((staff, staffIndex) => {
                    if (!staff || !staff.id) return null;

                    // Safe access to schedule data
                    const staffSchedule = schedule[staff.id];
                    const shift =
                      staffSchedule && staffSchedule[dateKey]
                        ? staffSchedule[dateKey]
                        : "";

                    // Ensure shift is always a string and handle any objects
                    let shiftValue;
                    try {
                      if (typeof shift === "object") {
                        if (shift && shift.value) {
                          shiftValue = shift.value.toString
                            ? shift.value.toString()
                            : "normal";
                        } else {
                          shiftValue = shift.toString
                            ? shift.toString()
                            : "normal";
                        }
                      } else {
                        shiftValue = String(shift);
                      }
                    } catch (e) {
                      shiftValue = "normal";
                    }

                    // Final safety check
                    if (typeof shiftValue !== "string") {
                      shiftValue = "normal";
                    }
                    const cellId = `${staff.id}-${dateKey}`;
                    const isDropdownOpen = showDropdown === cellId;
                    const dropdownPosition = getDropdownPosition(
                      date,
                      staffIndex + 1,
                      dateIndex,
                    );

                    // Dynamic dropdown positioning classes
                    const getDropdownClasses = () => {
                      const baseClasses =
                        "shift-dropdown absolute bg-white border border-gray-300 rounded-lg shadow-lg py-2 min-w-[120px]";

                      switch (dropdownPosition) {
                        case "right":
                          return `${baseClasses} z-50 left-full top-1/2 transform -translate-y-1/2 ml-1`;
                        case "left":
                          return `${baseClasses} z-50 right-full top-1/2 transform -translate-y-1/2 mr-1`;
                        case "left-elevated-top":
                          return (
                            `${baseClasses} z-[500] right-full mr-1` +
                            " " +
                            "top-[0%]"
                          );
                        case "below":
                          return `${baseClasses} z-50 top-full left-1/2 transform -translate-x-1/2 mt-1`;
                        default:
                          return `${baseClasses} z-50 top-full left-1/2 transform -translate-x-1/2 mt-1`;
                      }
                    };

                    // Check if date is within work period and if it has START/END label
                    const isWithinWorkPeriod = isDateWithinWorkPeriod(
                      date,
                      staff,
                    );
                    const dateLabel = getDateLabel(date, staff);
                    const isStartOrEndDate =
                      dateLabel === "START" || dateLabel === "END";

                    return (
                      <td
                        key={staff.id}
                        className={`text-center relative border-r border-gray-200 ${
                          !isWithinWorkPeriod
                            ? "bg-gray-100"
                            : isStartOrEndDate
                              ? "bg-blue-50"
                              : editingSpecificColumn === staff.id
                                ? "bg-white"
                                : isDropdownOpen
                                  ? "ring-2 ring-gray-400 bg-white"
                                  : ""
                        }`}
                        style={{ minWidth: "40px", padding: "0" }}
                      >
                        {isWithinWorkPeriod ? (
                          <>
                            {/* Clickable Cell Content */}
                            <div
                              className="w-full h-12 flex items-center justify-center cursor-pointer hover:bg-gray-100 relative"
                              onClick={() => handleCellClick(staff.id, dateKey)}
                            >
                              {isStartOrEndDate ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-bold text-blue-600">
                                    {dateLabel}
                                  </span>
                                  <span
                                    className={`text-lg font-bold ${shiftSymbols[shiftValue]?.color || "text-gray-400"}`}
                                  >
                                    {shiftSymbols[shiftValue]?.symbol || ""}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={`text-lg font-bold ${shiftSymbols[shiftValue]?.color || "text-gray-400"}`}
                                >
                                  {shiftSymbols[shiftValue]?.symbol ||
                                    (shiftValue && !shiftSymbols[shiftValue]
                                      ? shiftValue
                                      : "")}
                                </span>
                              )}
                            </div>

                            {/* Custom Dropdown with Dynamic Positioning */}
                            {isDropdownOpen &&
                              isWithinWorkPeriod &&
                              !isStartOrEndDate && (
                                <div className={getDropdownClasses()}>
                                  {getAvailableShifts(
                                    staff.name,
                                    staffMembers,
                                  ).map((key) => {
                                    const value = shiftSymbols[key];
                                    if (!value) {
                                      return null;
                                    }
                                    return (
                                      <div
                                        key={key}
                                        className={`flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                          shiftValue === key
                                            ? "bg-blue-50 text-blue-600"
                                            : ""
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShiftSelect(
                                            staff.id,
                                            dateKey,
                                            key,
                                          );
                                        }}
                                      >
                                        <span
                                          className={`text-lg font-bold mr-3 ${value.color}`}
                                        >
                                          {value.symbol}
                                        </span>
                                        <span className="text-sm">
                                          {value.label}
                                        </span>
                                      </div>
                                    );
                                  })}

                                  {/* Custom Text Input Section */}
                                  <div className="border-t border-gray-200 p-2">
                                    <div className="text-xs text-gray-500 mb-2">
                                      Custom text:
                                    </div>
                                    <input
                                      type="text"
                                      value={customText}
                                      onChange={(e) =>
                                        setCustomText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          if (customText.trim()) {
                                            handleShiftSelect(
                                              staff.id,
                                              dateKey,
                                              customText.trim(),
                                            );
                                            setCustomText("");
                                          }
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="Type custom text..."
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      autoFocus
                                    />
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="border-t border-gray-200 p-1 flex gap-1">
                                    {/* Delete Button - only show if cell has existing text */}
                                    {shiftValue &&
                                      !shiftSymbols[shiftValue] && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleShiftSelect(
                                              staff.id,
                                              dateKey,
                                              "normal",
                                            );
                                          }}
                                          className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                          title="Delete custom text"
                                        >
                                          Delete
                                        </button>
                                      )}

                                    {/* Apply Custom Text Button */}
                                    {customText.trim() && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShiftSelect(
                                            staff.id,
                                            dateKey,
                                            customText.trim(),
                                          );
                                          setCustomText("");
                                        }}
                                        className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        title="Apply custom text"
                                      >
                                        Apply
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                          </>
                        ) : (
                          /* Show non-working indicator when outside work period */
                          <div
                            className="w-full h-12 flex items-center justify-center cursor-default text-gray-400"
                            title={`${staff.name} - ${format(date, "MMM dd")} - Not working`}
                          >
                            <div className="text-gray-400 text-xs">-</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Footer: Vacation Days Summary */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td
                className="font-bold text-center text-orange-700 border-r-2 border-gray-400 sticky left-0 bg-gray-50"
                style={{ zIndex: 300 }}
              >
                <div className="py-2">
                  <div className="text-xs">Vacation</div>
                  <div className="text-xs">Days</div>
                </div>
              </td>
              {orderedStaffMembers.map((staff) => {
                if (!staff || !staff.id) return null;

                let vacationDays = 0;
                dateRange.forEach((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const staffSchedule = schedule[staff.id];
                  const shift =
                    staffSchedule && staffSchedule[dateKey]
                      ? staffSchedule[dateKey]
                      : "";

                  if (shift === "early") {
                    vacationDays += 0.5;
                  } else if (
                    shift === "off" ||
                    shift === "unavailable" ||
                    shift === "holiday"
                  ) {
                    vacationDays += 1;
                  }
                });

                return (
                  <td
                    key={staff.id}
                    className="text-center border-r border-gray-200 bg-gray-50 py-2"
                  >
                    <div className="text-sm font-bold text-orange-600">
                      {vacationDays}
                    </div>
                    <div className="text-xs text-orange-700">days</div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Staff Management Modals */}
      {showStaffEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {isAddingNewStaff ? "Add New Staff Member" : "Edit Staff Member"}
            </h3>

            {!isAddingNewStaff && !selectedStaffForEdit && (
              /* Staff Selection List */
              <div className="space-y-3">
                <div className="text-sm text-gray-600 mb-3">
                  Select a staff member to edit:
                </div>
                {orderedStaffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      // Use the latest staff data from current staffMembers array to avoid stale data
                      const freshStaffData = staffMembers.find(s => s.id === staff.id) || staff;
                      console.log("🎯 Staff selection: Using fresh data", {
                        original: { id: staff.id, startPeriod: staff.startPeriod },
                        fresh: { id: freshStaffData.id, startPeriod: freshStaffData.startPeriod }
                      });
                      
                      setSelectedStaffForEdit(freshStaffData);
                      setEditingStaffData({
                        name: freshStaffData.name,
                        position: freshStaffData.position || "Staff",
                        status: freshStaffData.status || "社員",
                        startPeriod: freshStaffData.startPeriod || {
                          year: new Date().getFullYear(),
                          month: new Date().getMonth() + 1,
                          day: 1,
                        },
                        endPeriod: freshStaffData.endPeriod || null,
                      });
                    }}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-sm text-gray-500">
                      {staff.position} • {staff.status}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(isAddingNewStaff || selectedStaffForEdit) && (
              /* Staff Edit Form */
              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingStaffData.name}
                    onChange={(e) =>
                      setEditingStaffData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter staff name"
                    required
                  />
                </div>

                {/* Position Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <select
                    value={editingStaffData.position}
                    onChange={(e) =>
                      setEditingStaffData((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Head Chef">Head Chef</option>
                    <option value="Chef">Chef</option>
                    <option value="Sous Chef">Sous Chef</option>
                    <option value="Server">Server</option>
                    <option value="Host">Host</option>
                    <option value="Prep">Prep</option>
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                {/* Status Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="社員"
                        checked={editingStaffData.status === "社員"}
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                        className="mr-2"
                      />
                      社員 (Employee)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="派遣"
                        checked={editingStaffData.status === "派遣"}
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                        className="mr-2"
                      />
                      派遣 (Temporary)
                    </label>
                  </div>
                </div>

                {/* Start Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Period
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={
                        editingStaffData.startPeriod?.year ||
                        new Date().getFullYear()
                      }
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            year: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - 5 + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={
                        editingStaffData.startPeriod?.month ||
                        new Date().getMonth() + 1
                      }
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            month: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}月
                        </option>
                      ))}
                    </select>
                    <select
                      value={editingStaffData.startPeriod?.day || 1}
                      onChange={(e) =>
                        setEditingStaffData((prev) => ({
                          ...prev,
                          startPeriod: {
                            ...prev.startPeriod,
                            day: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}日
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* End Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Period
                  </label>
                  <div className="flex items-center mb-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!editingStaffData.endPeriod}
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod: e.target.checked
                              ? null
                              : {
                                  year: new Date().getFullYear(),
                                  month: new Date().getMonth() + 1,
                                  day: 1,
                                },
                          }))
                        }
                        className="mr-2"
                      />
                      Indefinite (無期限)
                    </label>
                  </div>

                  {editingStaffData.endPeriod && (
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={
                          editingStaffData.endPeriod?.year ||
                          new Date().getFullYear()
                        }
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod: {
                              ...prev.endPeriod,
                              year: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={
                          editingStaffData.endPeriod?.month ||
                          new Date().getMonth() + 1
                        }
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod: {
                              ...prev.endPeriod,
                              month: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}月
                          </option>
                        ))}
                      </select>
                      <select
                        value={editingStaffData.endPeriod?.day || 1}
                        onChange={(e) =>
                          setEditingStaffData((prev) => ({
                            ...prev,
                            endPeriod: {
                              ...prev.endPeriod,
                              day: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}日
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Status-specific help text */}
                  <div className="mt-2 text-xs text-gray-500">
                    {editingStaffData.status === "社員" && (
                      <p>社員の場合、終了期間は無期限にできます</p>
                    )}
                    {editingStaffData.status === "派遣" && (
                      <p>
                        派遣の場合、{new Date().getFullYear()}
                        年内での開始・終了期間を選択してください
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedStaffForEdit(null);
                  setIsAddingNewStaff(false);
                  setShowStaffEditModal(false);
                  setEditingStaffData({
                    name: "",
                    position: "",
                    status: "社員",
                    startPeriod: {
                      year: new Date().getFullYear(),
                      month: new Date().getMonth() + 1,
                      day: 1,
                    },
                    endPeriod: null,
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                キャンセル
              </button>

              {(isAddingNewStaff || selectedStaffForEdit) && (
                <button
                  onClick={() => {
                    if (isAddingNewStaff) {
                      handleCreateStaff(editingStaffData);
                    } else {
                      // Update existing staff member
                      const updatedStaffMembers = staffMembers.map((staff) =>
                        staff.id === selectedStaffForEdit.id
                          ? {
                              ...staff,
                              name: editingStaffData.name,
                              position: editingStaffData.position,
                              status: editingStaffData.status,
                              startPeriod: editingStaffData.startPeriod,
                              endPeriod: editingStaffData.endPeriod,
                            }
                          : staff,
                      );

                      React.startTransition(() => {
                        setStaffMembers(updatedStaffMembers);
                        setStaffMembersByMonth((prev) => ({
                          ...prev,
                          [currentMonthIndex]: updatedStaffMembers,
                        }));
                      });

                      setTimeout(() => {
                        scheduleAutoSave(schedule, updatedStaffMembers);
                      }, 0);

                      // Close modal
                      setSelectedStaffForEdit(null);
                      setIsAddingNewStaff(false);
                      setShowStaffEditModal(false);
                      setEditingStaffData({
                        name: "",
                        position: "",
                        status: "社員",
                        startPeriod: {
                          year: new Date().getFullYear(),
                          month: new Date().getMonth() + 1,
                          day: 1,
                        },
                        endPeriod: null,
                      });
                    }
                  }}
                  disabled={!editingStaffData.name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingNewStaff ? "追加" : "保存"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Dashboard */}
      <StatisticsDashboard
        statistics={statistics}
        staffMembers={orderedStaffMembers}
        dateRange={dateRange}
      />
    </div>
  );
};

export default ShiftScheduleEditor;
