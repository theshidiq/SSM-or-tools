import React, { useEffect, useState, useRef, useMemo, Suspense } from "react";
import {
  Download,
  Upload,
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
  BarChart3,
} from "lucide-react";

// ShadCN UI components
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { addNextPeriod } from "../../utils/dateUtils";
import { usePeriodsRealtime } from "../../hooks/usePeriodsRealtime";
import { useAIAssistant } from "../../hooks/useAIAssistant";
import { useAIAssistantLazy } from "../../hooks/useAIAssistantLazy";
import { AISettingsProvider } from "../../contexts/AISettingsProvider";
import ErrorBoundary from "../ui/ErrorBoundary";
import { AILoadingSpinner } from "../ui/LoadingStates";
import { LazyAIAssistantModal } from "../lazy/LazyAIComponents";
import { ScheduleImportModal } from "../import";
import { ModelStatusBadge } from "../ai/ModelStatusBadge";

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
  // Fullscreen prop
  isFullscreen = false,
  // Connection status props
  isConnected = true,
  isSaving = false,
  prefetchStats = null,
}) => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const monthPickerRef = useRef(null);

  // Use real-time periods hook
  const { periods: monthPeriods, isLoading: periodsLoading } =
    usePeriodsRealtime();

  // Get available years from monthPeriods (only years with actual periods)
  const availableYears = useMemo(() => {
    const years = new Set();

    if (monthPeriods && monthPeriods.length > 0) {
      monthPeriods.forEach((period) => {
        years.add(period.start.getFullYear());
      });
      // Note: Removed automatic next year addition - only show years with actual periods
    } else {
      // Default to current year if no periods yet
      years.add(new Date().getFullYear());
    }

    return Array.from(years).sort();
  }, [monthPeriods]);

  // Set initial year to current selected period year
  const [currentYear, setCurrentYear] = useState(() => {
    if (monthPeriods && monthPeriods.length > 0) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      return selectedPeriod
        ? selectedPeriod.start.getFullYear()
        : monthPeriods[0].start.getFullYear();
    }
    return new Date().getFullYear();
  });

  // Track if user is manually navigating years to prevent automatic resets
  const [isManualYearNavigation, setIsManualYearNavigation] = useState(false);

  // Update current year when monthIndex changes to ensure calendar shows correct year
  useEffect(() => {
    if (!isManualYearNavigation && monthPeriods && monthPeriods.length > 0) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      if (selectedPeriod) {
        const newYear = selectedPeriod.start.getFullYear();
        if (newYear !== currentYear) {
          console.log(
            `📅 Updating calendar year to ${newYear} for period: ${selectedPeriod.label}`,
          );
          setCurrentYear(newYear);
        }
      }
    }
  }, [currentMonthIndex, currentYear, isManualYearNavigation, monthPeriods]);

  // Auto-navigate away from years with no periods
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
      const firstAvailableYear = availableYears[0];
      console.log(
        `📅 Auto-navigating from empty year ${currentYear} to ${firstAvailableYear}`,
      );
      setCurrentYear(firstAvailableYear);
      setIsManualYearNavigation(false);
    }
  }, [availableYears, currentYear]);

  // Note: Removed automatic period creation - users add periods manually via "Add Table" button

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
    updateSchedule, // This is handleScheduleUpdate which calls prefetchUpdateSchedule (backend save)
    {
      autoInitialize: aiEnabled,
      enableEnhanced: true,
      fallbackMode: true,
    },
  );

  // Choose which AI system to use
  const ai = aiEnabled ? lazyAI : regularAI;

  const {
    isInitialized,
    isProcessing,
    initializeAI,
    autoFillSchedule,
    generateAIPredictions,
    generateSchedule, // Bridge to HybridPredictor
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
    if (!isManualYearNavigation && monthPeriods && monthPeriods.length > 0) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      if (selectedPeriod) {
        const selectedYear = selectedPeriod.start.getFullYear();
        if (selectedYear !== currentYear) {
          setCurrentYear(selectedYear);
        }
      }
    }
  }, [currentMonthIndex, currentYear, isManualYearNavigation, monthPeriods]);

  // Reset manual navigation flag when a period is actually selected
  useEffect(() => {
    if (isManualYearNavigation && monthPeriods && monthPeriods.length > 0) {
      const selectedPeriod = monthPeriods[currentMonthIndex];
      if (
        selectedPeriod &&
        selectedPeriod.start.getFullYear() === currentYear
      ) {
        setIsManualYearNavigation(false);
      }
    }
  }, [currentMonthIndex, currentYear, isManualYearNavigation, monthPeriods]);

  const handleAIClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Always show modal immediately to avoid timing issues
    setShowAIModal(true);

    // Enable AI if not already enabled
    if (!aiEnabled && onEnableAI) {
      onEnableAI(true);
    }
  };

  // Debug function to check periods (you can call this from browser console)
  if (typeof window !== "undefined") {
    window.checkPeriods = () => {
      if (monthPeriods && monthPeriods.length > 0) {
        console.log(
          "📅 Current periods:",
          monthPeriods.map(
            (p, i) => `${i}: ${p.label} (${p.start.getFullYear()})`,
          ),
        );
        console.log("📊 Total periods:", monthPeriods.length);
        console.log(
          "📆 Years represented:",
          [...new Set(monthPeriods.map((p) => p.start.getFullYear()))].sort(),
        );
        console.log("🔄 Loading state:", periodsLoading);
      } else {
        console.log("📅 No periods available or still loading");
        console.log("🔄 Loading state:", periodsLoading);
      }
    };
  }
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
        if (monthPeriods && monthPeriods.length > 0 && currentMonthIndex > 0) {
          onMonthChange(currentMonthIndex - 1);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        // Navigate to next period if possible
        if (
          monthPeriods &&
          monthPeriods.length > 0 &&
          currentMonthIndex < monthPeriods.length - 1
        ) {
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
  }, [currentMonthIndex, onMonthChange, showMonthPicker, monthPeriods]);

  // Handle outside click to close month picker
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        monthPickerRef.current &&
        !monthPickerRef.current.contains(event.target)
      ) {
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

  // Calculate realtime status
  const hasAllPeriodsData = prefetchStats?.memoryUsage?.periodCount > 0;
  const isInstantNavEnabled = hasAllPeriodsData;

  const realtimeStatus = (() => {
    if (!isConnected && !hasAllPeriodsData)
      return { type: "error", message: "Offline Mode", instantNav: false };
    if (isSaving)
      return {
        type: "saving",
        message: "Saving...",
        instantNav: isInstantNavEnabled,
      };

    return {
      type: "connected",
      message: isInstantNavEnabled ? "⚡ Instant Navigation" : "Database Sync",
      instantNav: isInstantNavEnabled,
      periodsCached: prefetchStats?.memoryUsage?.periodCount || 0,
    };
  })();

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
                    disabled={
                      currentMonthIndex <= 0 || monthPeriods.length === 0
                    }
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
                        {currentYear}年{" "}
                        {monthPeriods &&
                        monthPeriods.length > 0 &&
                        monthPeriods[currentMonthIndex]
                          ? monthPeriods[currentMonthIndex].label
                          : periodsLoading
                            ? "——————"
                            : "No Periods"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select month (Use ← → arrow keys to navigate periods)</p>
                  </TooltipContent>
                </Tooltip>

                {showMonthPicker && (
                  <Card className="absolute top-12 left-0 min-w-[320px] z-[9999] shadow-lg">
                    <CardContent className="p-4">
                      {/* Year Navigation */}
                      <div className="flex items-center justify-between mb-4 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const currentIndex =
                              availableYears.indexOf(currentYear);
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
                            const currentIndex =
                              availableYears.indexOf(currentYear);
                            if (currentIndex < availableYears.length - 1) {
                              setIsManualYearNavigation(true);
                              setCurrentYear(availableYears[currentIndex + 1]);
                            }
                          }}
                          disabled={
                            availableYears.indexOf(currentYear) >=
                            availableYears.length - 1
                          }
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                      <Separator className="mb-4" />
                      {/* Month Periods Grid - Show periods for current year */}
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {monthPeriods.length > 0 ? (
                          monthPeriods
                            .map((period, index) => ({
                              period,
                              originalIndex: index,
                            }))
                            .filter(
                              ({ period }) =>
                                period.start.getFullYear() === currentYear,
                            )
                            .map(({ period, originalIndex }) => (
                              <Button
                                key={originalIndex}
                                variant={
                                  originalIndex === currentMonthIndex
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => {
                                  onMonthChange(originalIndex);
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
                    disabled={
                      currentMonthIndex >= monthPeriods.length - 1 ||
                      monthPeriods.length === 0
                    }
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
            <Tabs
              value={viewMode}
              onValueChange={onViewModeChange}
              className="w-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="table"
                  className="flex items-center gap-2 japanese-text"
                >
                  <Table size={16} />
                  エディター
                </TabsTrigger>
                <TabsTrigger
                  value="card"
                  className="flex items-center gap-2 japanese-text"
                >
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
                    variant={isFullscreen ? "default" : "outline"}
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
                  <p>{isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen'}</p>
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
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="japanese-text">
                    {isEnhanced
                      ? isMLReady &&
                        typeof isMLReady === "function" &&
                        isMLReady()
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log("🔧 Staff management button clicked");
                      setShowStaffEditModal(true);
                      console.log("✅ Modal state set to true");
                    }}
                  >
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

              {/* Model Status Badge - NEW */}
              <ModelStatusBadge />

              {/* Delete Current Period */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeletePeriod}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="japanese-text">
                    Delete entire{" "}
                    {monthPeriods[currentMonthIndex]?.label || "current period"}{" "}
                    table
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Import HTML */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                  >
                    <Upload size={16} className="text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Import HTML Schedule</p>
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

      {/* AI Assistant Modal - Show when AI is enabled OR when modal is requested */}
      {(aiEnabled || showAIModal) && (
        <AISettingsProvider>
          <ErrorBoundary
            userFriendlyMessage="AI Assistant failed to load. Core functionality remains available."
            onDisableFeature={() => {
              setShowAIModal(false);
              if (onEnableAI) onEnableAI(false);
            }}
          >
            <Suspense
              fallback={
                showAIModal ? (
                  <AILoadingSpinner message="Loading AI Assistant..." />
                ) : null
              }
            >
              <LazyAIAssistantModal
                isOpen={showAIModal}
                onClose={() => setShowAIModal(false)}
                onAutoFillSchedule={generateAIPredictions || autoFillSchedule}
                scheduleData={scheduleData} // AI generation data
                staffMembers={staffMembers} // Staff array
                currentMonthIndex={currentMonthIndex} // Current month
                saveSchedule={updateSchedule} // Save function
                isProcessing={isProcessing}
                systemStatus={getSystemStatus && getSystemStatus()}
              />
            </Suspense>
          </ErrorBoundary>
        </AISettingsProvider>
      )}

      {/* Schedule Import Modal */}
      {showImportModal && (
        <ScheduleImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          targetPeriodIndex={currentMonthIndex}
          targetPeriod={monthPeriods?.[currentMonthIndex]}
          onImportSuccess={() => {
            console.log('✅ Schedule imported successfully!');
            // Optionally refetch or refresh data here
          }}
        />
      )}
    </TooltipProvider>
  );
};

export default NavigationToolbar;
