import React from "react";
import {
  Download,
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
  X,
  Delete,
} from "lucide-react";
import { monthPeriods } from "../../utils/dateUtils";

const NavigationToolbar = ({
  currentMonthIndex,
  onMonthChange,
  showMonthPicker,
  setShowMonthPicker,
  editingColumn,
  setEditingColumn,
  setJustEnteredEditMode,
  addNewColumn,
  setShowStaffEditModal,
  handleExport,
  handlePrint,
  handleAddTable,
  handleDeletePeriod,
}) => {
  return (
    <div className="toolbar-section mb-6">
      <div className="w-4/5 mx-auto flex items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        {/* Left Side - Month Navigation */}
        <div className="flex items-center gap-3">
          {/* Previous Month Button */}
          <button
            onClick={() => {
              onMonthChange(currentMonthIndex - 1);
            }}
            disabled={currentMonthIndex <= 0}
            className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
              currentMonthIndex <= 0
                ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                : "border-gray-300 bg-white hover:border-gray-400"
            }`}
            title="Previous period"
          >
            <ChevronLeft
              size={16}
              className={
                currentMonthIndex <= 0
                  ? "text-gray-400"
                  : "text-gray-600 hover:text-gray-800"
              }
            />
          </button>

          {/* Month Picker */}
          <div className="relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="month-picker flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              title="Select month"
            >
              <Calendar
                size={16}
                className="text-gray-600 hover:text-gray-800 mr-1"
              />
              <span className="text-gray-700 hover:text-gray-900 text-center">
                {monthPeriods[currentMonthIndex]?.label || "Period"}
              </span>
            </button>

            {showMonthPicker && (
              <div className="month-picker absolute top-12 left-0 bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] min-w-[300px] p-3">
                <div className="grid grid-cols-2 gap-2">
                  {monthPeriods.map((period, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        onMonthChange(index);
                        setShowMonthPicker(false);
                      }}
                      className={`text-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                        index === currentMonthIndex
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "text-gray-700 hover:bg-gray-50 border border-gray-200"
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Next Month Button */}
          <button
            onClick={() => {
              onMonthChange(currentMonthIndex + 1);
            }}
            disabled={currentMonthIndex >= monthPeriods.length - 1}
            className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
              currentMonthIndex >= monthPeriods.length - 1
                ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                : "border-gray-300 bg-white hover:border-gray-400"
            }`}
            title="Next period"
          >
            <ChevronRight
              size={16}
              className={
                currentMonthIndex >= monthPeriods.length - 1
                  ? "text-gray-400"
                  : "text-gray-600 hover:text-gray-800"
              }
            />
          </button>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-gray-300 mx-6"></div>

        {/* Action Buttons Section */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title="Toggle fullscreen"
          >
            <Maximize size={16} className="text-gray-600 hover:text-gray-700" />
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
            onClick={handleAddTable}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title="Add Next Period Table"
          >
            <TableProperties
              size={16}
              className="text-teal-600 hover:text-teal-700"
            />
          </button>

          {/* Manage Staff */}
          <button
            onClick={() => setShowStaffEditModal(true)}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title="Manage Staff"
          >
            <Users
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
            <Delete
              size={16}
              className={
                editingColumn === "delete-mode"
                  ? "text-red-700"
                  : "text-red-600 hover:text-red-700"
              }
            />
          </button>

          {/* Delete Current Period */}
          <button
            onClick={handleDeletePeriod}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title={`Delete ${monthPeriods[currentMonthIndex]?.label || "current period"} data`}
          >
            <Trash2
              size={16}
              className="text-orange-600 hover:text-orange-700"
            />
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title="Export CSV"
          >
            <Download
              size={16}
              className="text-green-600 hover:text-green-700"
            />
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            title="Print"
          >
            <Printer size={16} className="text-gray-600 hover:text-gray-700" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationToolbar;
