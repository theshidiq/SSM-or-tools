import React, { useEffect, useState } from "react";
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
  Grid,
  Eye,
} from "lucide-react";
import { monthPeriods } from "../../utils/dateUtils";
import { useAIAssistant } from "../../hooks/useAIAssistant";
import AIAssistantModal from "../ai/AIAssistantModal";

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
  viewMode,
  onViewModeChange,
  // AI Assistant props
  scheduleData,
  staffMembers,
  updateSchedule,
}) => {
  const [showAIModal, setShowAIModal] = useState(false);
  
  const {
    isInitialized,
    isProcessing,
    initializeAI,
    autoFillSchedule,
    generateAIPredictions,
    getSystemStatus,
    systemType,
    systemHealth,
    isEnhanced,
    isMLReady
  } = useAIAssistant(scheduleData, staffMembers, currentMonthIndex, updateSchedule);

  // Initialize AI on first render
  useEffect(() => {
    if (!isInitialized) {
      initializeAI();
    }
  }, [isInitialized, initializeAI]);

  const handleAIClick = () => {
    setShowAIModal(true);
  };
  // Keyboard navigation for period switching
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle keyboard navigation when no input elements are focused
      // and no modals are open
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.contentEditable === "true" ||
        activeElement?.closest(".shift-dropdown") ||
        activeElement?.closest('[role="dialog"]') ||
        showMonthPicker;

      if (isInputFocused) {
        return;
      }

      // Handle arrow key navigation
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        // Navigate to previous period if possible
        if (currentMonthIndex > 0) {
          onMonthChange(currentMonthIndex - 1);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        // Navigate to next period if possible
        if (currentMonthIndex < monthPeriods.length - 1) {
          onMonthChange(currentMonthIndex + 1);
        }
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentMonthIndex, onMonthChange, showMonthPicker]);
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
            title="Previous period (← Left Arrow)"
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
              title="Select month (Use ← → arrow keys to navigate periods)"
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
            title="Next period (→ Right Arrow)"
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

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange("table")}
            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === "table"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
            title="Editor (エディター)"
          >
            <Table size={16} className="mr-1.5" />
            エディター
          </button>
          <button
            onClick={() => onViewModeChange("card")}
            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === "card"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
            title="View (ビュー)"
          >
            <Eye size={16} className="mr-1.5" />
            ビュー
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
            onClick={handleAIClick}
            className={`flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border transition-all duration-200 ${
              isProcessing 
                ? 'border-yellow-400 bg-yellow-50 animate-pulse' 
                : isEnhanced && isMLReady && isMLReady()
                  ? 'border-violet-400 bg-violet-50 hover:bg-violet-100'
                  : 'border-gray-300 bg-white hover:border-gray-400'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500`}
            title={`${
              isEnhanced 
                ? (isMLReady && isMLReady() ? 'ハイブリッドAI (ML準備完了)' : 'ハイブリッドAI (ML初期化中)')
                : 'AI Assistant'
            }`}
            disabled={isProcessing}
          >
            <Sparkles
              size={16}
              className={`${
                isProcessing 
                  ? 'text-yellow-600 animate-spin' 
                  : isEnhanced
                    ? 'text-violet-600 hover:text-violet-700'
                    : 'text-gray-600 hover:text-gray-700'
              }`}
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

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onAutoFillSchedule={generateAIPredictions || autoFillSchedule}
        isProcessing={isProcessing}
        systemStatus={getSystemStatus && getSystemStatus()}
      />
    </div>
  );
};

export default NavigationToolbar;
