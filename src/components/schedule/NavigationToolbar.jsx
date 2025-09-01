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

// ShadCN UI components
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
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
    <TooltipProvider>
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Left Side - Month Navigation */}
            <div className="flex items-center gap-2">
              {/* Previous Month Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMonthChange(currentMonthIndex - 1)}
                    disabled={currentMonthIndex <= 0}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous period (← Left Arrow)</p>
                </TooltipContent>
              </Tooltip>

              {/* Month Picker */}
              <div className="relative" ref={monthPickerRef}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => setShowMonthPicker(!showMonthPicker)}
                      className="h-10 gap-2"
                    >
                      <Calendar size={16} />
                      <span className="japanese-text">
                        {monthPeriods[currentMonthIndex]?.label || "Period"} {currentYear}年
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select month (Use ← → arrow keys to navigate periods)</p>
                  </TooltipContent>
                </Tooltip>

                {showMonthPicker && (
                  <Card className="absolute top-12 left-0 min-w-[320px] z-50 shadow-lg">
                    <CardContent className="p-4">
                      {/* Year Navigation */}
                      <div className="flex items-center justify-between mb-4 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const currentIndex = availableYears.indexOf(currentYear);
                            if (currentIndex > 0) {
                              setIsManualYearNavigation(true);
                              setCurrentYear(availableYears[currentIndex - 1]);
                            }
                          }}
                          disabled={availableYears.indexOf(currentYear) <= 0}
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        <span className="text-lg font-semibold japanese-text">
                          {currentYear}年
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const currentIndex = availableYears.indexOf(currentYear);
                            if (currentIndex < availableYears.length - 1) {
                              setIsManualYearNavigation(true);
                              setCurrentYear(availableYears[currentIndex + 1]);
                            }
                          }}
                          disabled={availableYears.indexOf(currentYear) >= availableYears.length - 1}
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                      <Separator className="mb-4" />
                      {/* Month Periods Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {periodsForCurrentYear.length > 0 ? (
                          periodsForCurrentYear.map((period) => (
                            <Button
                              key={period.originalIndex}
                              variant={period.originalIndex === currentMonthIndex ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                onMonthChange(period.originalIndex);
                                setShowMonthPicker(false);
                              }}
                              className="japanese-text"
                            >
                              {period.label}
                            </Button>
                          ))
                        ) : (
                          <div className="col-span-2 text-center text-muted-foreground py-4">
                            No periods available for {currentYear}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Next Month Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMonthChange(currentMonthIndex + 1)}
                    disabled={currentMonthIndex >= monthPeriods.length - 1}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next period (→ Right Arrow)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Separator orientation="vertical" className="h-8 mx-4" />

            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={onViewModeChange} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table" className="flex items-center gap-2 japanese-text">
                  <Table size={16} />
                  エディター
                </TabsTrigger>
                <TabsTrigger value="card" className="flex items-center gap-2 japanese-text">
                  <Eye size={16} />
                  ビュー
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Separator orientation="vertical" className="h-8 mx-4" />

            {/* Action Buttons Section */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Fullscreen Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}
                  >
                    <Maximize size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle fullscreen</p>
                </TooltipContent>
              </Tooltip>

              {/* AI Assistant */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isEnhanced ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleAIClick}
                    disabled={isProcessing}
                    className={isProcessing ? "animate-pulse" : ""}
                  >
                    <Sparkles 
                      size={16} 
                      className={isProcessing ? "animate-spin" : ""}
                    />
                    {isEnhanced && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        AI+
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="japanese-text">
                    {isEnhanced
                      ? isMLReady && typeof isMLReady === 'function' && isMLReady()
                        ? "ハイブリッドAI (ML準備完了)"
                        : "ハイブリッドAI (ML初期化中)"
                      : "AI Assistant"}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Add Table */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleAddTable}>
                    <TableProperties size={16} className="text-teal-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add Next Period Table</p>
                </TooltipContent>
              </Tooltip>

              {/* Manage Staff */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setShowStaffEditModal(true)}>
                    <Users size={16} className="text-purple-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage Staff</p>
                </TooltipContent>
              </Tooltip>

              {/* Settings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onShowSettings}>
                    <Settings size={16} className="text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings - Configure ML models and business rules</p>
                </TooltipContent>
              </Tooltip>

              {/* Delete Current Period */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleDeletePeriod}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="japanese-text">
                    Delete entire {monthPeriods[currentMonthIndex]?.label || "current period"} table
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Export CSV */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download size={16} className="text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export CSV</p>
                </TooltipContent>
              </Tooltip>

              {/* Print */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </TooltipProvider>
  );
};

export default NavigationToolbar;
