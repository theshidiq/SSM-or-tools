import React, { useEffect, useState, useRef, useMemo, Suspense } from "react";
import {
  Download,
  Calendar,
  Users,
  Table,
  Printer,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
  Maximize,
  Sparkles,
  TableProperties,
  Eye,
} from "lucide-react";
import { monthPeriods, addNextPeriod } from "../../utils/dateUtils";
import { useAIAssistant } from "../../hooks/useAIAssistant";
import { useAIAssistantLazy } from "../../hooks/useAIAssistantLazy";
import ErrorBoundary from "../ui/ErrorBoundary";
import { AILoadingSpinner } from "../ui/LoadingStates";
import { LazyAIAssistantModal } from "../lazy/LazyAIComponents";

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
  // Settings props
  onShowSettings,
  // AI loading props
  aiEnabled = false,
  onEnableAI,
}) => {
  const [showAIModal, setShowAIModal] = useState(false);
  const monthPickerRef = useRef(null);

  // Get available years from monthPeriods (and allow one year ahead for expansion)
  const availableYears = useMemo(() => {
    const years = new Set();
    monthPeriods.forEach((period) => {
      years.add(period.start.getFullYear());
    });
    
    // Add next year as available for expansion
    const maxYear = Math.max(...Array.from(years));
    years.add(maxYear + 1);
    
    return Array.from(years).sort();
  }, []);

  // Set initial year to first available year or current selected period year
  const [currentYear, setCurrentYear] = useState(() => {
    const selectedPeriod = monthPeriods[currentMonthIndex];
    return selectedPeriod ? selectedPeriod.start.getFullYear() : availableYears[0] || 2025;
  });

  // Track if user is manually navigating years to prevent automatic resets
  const [isManualYearNavigation, setIsManualYearNavigation] = useState(false);

  // Filter periods by selected year, and create periods if none exist
  const periodsForCurrentYear = useMemo(() => {
    const existingPeriods = monthPeriods
      .map((period, index) => ({ ...period, originalIndex: index }))
      .filter((period) => period.start.getFullYear() === currentYear);
      
    // If no periods exist for this year and it's the next year after the last available year, create them
    if (existingPeriods.length === 0) {
      const existingYears = new Set();
      monthPeriods.forEach((period) => {
        existingYears.add(period.start.getFullYear());
      });
      const maxExistingYear = Math.max(...Array.from(existingYears));
      
      if (currentYear === maxExistingYear + 1) {
        // Auto-create periods for the next year by adding periods one by one
        let periodsAdded = 0;
        while (periodsAdded < 6) { // Create 6 periods (typical for a year)
          const lastPeriod = monthPeriods[monthPeriods.length - 1];
          if (!lastPeriod || lastPeriod.start.getFullYear() >= currentYear) {
            break; // Stop if we've reached the target year
          }
          addNextPeriod();
          periodsAdded++;
        }
        
        // Return newly created periods for the current year
        return monthPeriods
          .map((period, index) => ({ ...period, originalIndex: index }))
          .filter((period) => period.start.getFullYear() === currentYear);
      }
    }
    
    return existingPeriods;
  }, [currentYear]);

  // Use lazy AI assistant when AI is enabled, fallback to regular when not
  const regularAI = useAIAssistant(
    scheduleData,
    staffMembers,
    currentMonthIndex,
    updateSchedule,
  );
  
  const lazyAI = useAIAssistantLazy(
    scheduleData,
    staffMembers,
    currentMonthIndex,
    updateSchedule,
    {
      autoInitialize: aiEnabled,
      enableEnhanced: true,
      fallbackMode: true
    }
  );
  
  // Choose which AI system to use
  const ai = aiEnabled ? lazyAI : regularAI;
  
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
    isMLReady,
  } = ai;

  // Initialize AI on first render when AI is enabled
  useEffect(() => {
    if (aiEnabled && !isInitialized) {
      initializeAI();
    }
  }, [aiEnabled, isInitialized, initializeAI]);

  // Update year when month selection changes (but not during manual year navigation)
  useEffect(() => {
    if (!isManualYearNavigation) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      if (selectedPeriod) {
        const selectedYear = selectedPeriod.start.getFullYear();
        if (selectedYear !== currentYear) {
          setCurrentYear(selectedYear);
        }
      }
    }
  }, [currentMonthIndex, currentYear, isManualYearNavigation]);

  // Reset manual navigation flag when a period is actually selected
  useEffect(() => {
    if (isManualYearNavigation) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      if (selectedPeriod && selectedPeriod.start.getFullYear() === currentYear) {
        setIsManualYearNavigation(false);
      }
    }
  }, [currentMonthIndex, currentYear, isManualYearNavigation]);

  const handleAIClick = () => {
    if (aiEnabled) {
      setShowAIModal(true);
    } else if (onEnableAI) {
      onEnableAI();
    }
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

  // Handle outside click to close month picker
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setShowMonthPicker(false);
      }
    };

    if (showMonthPicker) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showMonthPicker, setShowMonthPicker]);

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
          <div className="relative" ref={monthPickerRef}>
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
                {monthPeriods[currentMonthIndex]?.label || "Period"} {currentYear}年
              </span>
            </button>

            {showMonthPicker && (
              <div className="month-picker absolute top-12 left-0 bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] min-w-[320px] p-4">
                {/* Year Navigation */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                  <button
                    onClick={() => {
                      const currentIndex = availableYears.indexOf(currentYear);
                      if (currentIndex > 0) {
                        setIsManualYearNavigation(true);
                        setCurrentYear(availableYears[currentIndex - 1]);
                      }
                    }}
                    disabled={availableYears.indexOf(currentYear) <= 0}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-gray-600 ${
                      availableYears.indexOf(currentYear) <= 0 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'hover:bg-gray-100 hover:text-gray-800'
                    }`}
                    title="Previous year"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-lg font-semibold text-gray-800">
                    {currentYear}年
                  </span>
                  <button
                    onClick={() => {
                      const currentIndex = availableYears.indexOf(currentYear);
                      if (currentIndex < availableYears.length - 1) {
                        setIsManualYearNavigation(true);
                        setCurrentYear(availableYears[currentIndex + 1]);
                      }
                    }}
                    disabled={availableYears.indexOf(currentYear) >= availableYears.length - 1}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-gray-600 ${
                      availableYears.indexOf(currentYear) >= availableYears.length - 1 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'hover:bg-gray-100 hover:text-gray-800'
                    }`}
                    title="Next year"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Month Periods Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {periodsForCurrentYear.length > 0 ? (
                    periodsForCurrentYear.map((period) => (
                      <button
                        key={period.originalIndex}
                        onClick={() => {
                          onMonthChange(period.originalIndex);
                          setShowMonthPicker(false);
                        }}
                        className={`text-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                          period.originalIndex === currentMonthIndex
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : "text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                      >
                        {period.label}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-2 text-center text-gray-500 py-4">
                      No periods available for {currentYear}
                    </div>
                  )}
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
                ? "border-yellow-400 bg-yellow-50 animate-pulse"
                : isEnhanced && isMLReady && typeof isMLReady === 'function' && isMLReady()
                  ? "border-violet-400 bg-violet-50 hover:bg-violet-100"
                  : "border-gray-300 bg-white hover:border-gray-400"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500`}
            title={`${
              isEnhanced
                ? isMLReady && typeof isMLReady === 'function' && isMLReady()
                  ? "ハイブリッドAI (ML準備完了)"
                  : "ハイブリッドAI (ML初期化中)"
                : "AI Assistant"
            }`}
            disabled={isProcessing}
          >
            <Sparkles
              size={16}
              className={`${
                isProcessing
                  ? "text-yellow-600 animate-spin"
                  : isEnhanced
                    ? "text-violet-600 hover:text-violet-700"
                    : "text-gray-600 hover:text-gray-700"
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

          {/* Settings */}
          <button
            onClick={onShowSettings}
            className="flex items-center px-3 py-2 h-10 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
            title="Settings - Configure ML models and business rules"
          >
            <Settings size={16} className="text-blue-600 hover:text-blue-700" />
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

      {/* AI Assistant Modal - Lazy loaded when AI is enabled */}
      {aiEnabled && (
        <ErrorBoundary 
          userFriendlyMessage="AI Assistant failed to load. Core functionality remains available."
          onDisableFeature={() => {
            setShowAIModal(false);
            if (onEnableAI) onEnableAI(false);
          }}
        >
          <Suspense fallback={showAIModal ? <AILoadingSpinner message="Loading AI Assistant..." /> : null}>
            <LazyAIAssistantModal
              isOpen={showAIModal}
              onClose={() => setShowAIModal(false)}
              onAutoFillSchedule={generateAIPredictions || autoFillSchedule}
              isProcessing={isProcessing}
              systemStatus={getSystemStatus && getSystemStatus()}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default NavigationToolbar;
