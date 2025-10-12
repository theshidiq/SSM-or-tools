import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, RotateCcw, AlertTriangle, Check } from "lucide-react";

// ShadCN UI Components
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Alert, AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

// Import tab components
// useConfigurationCache removed - hook was deleted as unused
import { useSettings } from "../../contexts/SettingsContext";
import StaffGroupsTab from "./tabs/StaffGroupsTab";
import DailyLimitsTab from "./tabs/DailyLimitsTab";
import PriorityRulesTab from "./tabs/PriorityRulesTab";
import MLParametersTab from "./tabs/MLParametersTab";
import DataMigrationTab from "./tabs/DataMigrationTab";
import PeriodsTab from "./tabs/PeriodsTab";

// Import shared components
import TabButton from "./shared/TabButton";
import ConfirmationModal from "./shared/ConfirmationModal";

// Import configuration cache hook

const TABS = [
  { id: "staff-groups", label: "Staff Groups", icon: "👥" },
  { id: "daily-limits", label: "Daily Limits", icon: "📅" },
  { id: "priority-rules", label: "Priority Rules", icon: "⭐" },
  { id: "ml-parameters", label: "ML Parameters", icon: "🤖" },
  { id: "periods", label: "Periods", icon: "📆" },
  { id: "data-migration", label: "Data Migration", icon: "🔄" },
];

const SettingsModal = ({
  isOpen,
  onClose,
  // Staff data for reference (from parent - different data source)
  staffMembers = [],
  // Phase 2: Schedule validation (from parent navigation state)
  currentScheduleId = null,
}) => {
  // Get all settings data from React Context (replaces prop drilling)
  const {
    // Settings state
    settings,
    updateSettings,
    resetToDefaults,
    validationErrors,
    error,
    // Autosave state
    isAutosaving,
    autosaveError,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    lastSaveTime,
    // Backend mode and version info
    backendMode,
    isConnectedToBackend,
    connectionStatus,
    currentVersion,
    versionName,
    isVersionLocked,
  } = useSettings();

  const [activeTab, setActiveTab] = useState("staff-groups");
  const [isVisible, setIsVisible] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const modalRef = useRef(null);

  // State for StaffGroupsTab delete confirmation (lifted to avoid z-index issues)
  const [deleteGroupConfirmation, setDeleteGroupConfirmation] = useState(null); // { groupId, groupName, onConfirm }
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupSuccess, setDeleteGroupSuccess] = useState(false);

  // Configuration cache management removed - hook was deleted as unused

  // Don't wrap onSettingsChange - pass it directly to avoid infinite loops
  // The wrapper was causing handleSettingsChange to recreate, which triggered
  // ref updates in StaffGroupsTab, causing infinite loops

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Reset to first tab when modal opens
      setActiveTab("staff-groups");
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle click outside to close - exclude confirmation modals
  const handleOutsideClick = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      // Check if click is on a confirmation modal (higher z-index)
      const targetZIndex = window.getComputedStyle(
        event.target.closest('[role="dialog"]') || event.target,
      ).zIndex;
      if (parseInt(targetZIndex) > 10000) {
        return; // Don't close if clicking on a higher z-index modal
      }
      onClose();
    }
  };

  // Keyboard shortcuts and click outside handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      // Close modal on Escape - but not if there's a confirmation modal open
      if (event.key === "Escape") {
        // Check if there's a confirmation modal open (higher z-index)
        const confirmationModal = document.querySelector(
          '[role="dialog"][style*="z-index: 50000"], [role="dialog"][style*="zIndex: 50000"]',
        );
        if (confirmationModal) {
          return; // Let the confirmation modal handle the escape key
        }
        event.preventDefault();
        onClose();
        return;
      }

      // Tab navigation with Ctrl/Cmd + 1-4
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key >= "1" &&
        event.key <= "4"
      ) {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        if (TABS[tabIndex]) {
          setActiveTab(TABS[tabIndex].id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  const handleReset = () => {
    setResetConfirmation(true);
  };

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      resetToDefaults();
      setResetConfirmation(false);
    } catch (error) {
      console.error("Error resetting configuration:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetCancel = () => {
    setResetConfirmation(false);
  };

  // Handlers for StaffGroupsTab delete confirmation
  const handleDeleteGroup = (groupId, groupName, onConfirm) => {
    console.log("🗑️ [SettingsModal] handleDeleteGroup called:", {
      groupId,
      groupName,
    });

    // Close any open select dropdowns (native selects have higher z-index than modals)
    document.activeElement?.blur();

    setDeleteGroupConfirmation({ groupId, groupName, onConfirm });
    setDeleteGroupSuccess(false);
  };

  const handleDeleteGroupConfirm = async () => {
    console.log("🗑️ [SettingsModal] handleDeleteGroupConfirm called");
    if (!deleteGroupConfirmation) return;

    setIsDeletingGroup(true);
    try {
      // Call the confirmation handler passed from StaffGroupsTab
      await deleteGroupConfirmation.onConfirm();

      // Show success state
      setDeleteGroupSuccess(true);
      setIsDeletingGroup(false);

      // Auto-close after showing success
      setTimeout(() => {
        setDeleteGroupConfirmation(null);
        setDeleteGroupSuccess(false);
      }, 1500);
    } catch (error) {
      console.error("🗑️ [SettingsModal] Error during delete:", error);
      setIsDeletingGroup(false);
    }
  };

  const handleDeleteGroupCancel = () => {
    console.log("🗑️ [SettingsModal] handleDeleteGroupCancel called");
    setDeleteGroupConfirmation(null);
    setDeleteGroupSuccess(false);
  };

  const renderTabContent = () => {
    const commonProps = {
      // Phase 3: settings & updateSettings now from Context (not passed as props)
      staffMembers,
      validationErrors: validationErrors[activeTab] || {},
      currentScheduleId, // Phase 2: Pass schedule ID for validation
    };

    switch (activeTab) {
      case "staff-groups":
        return (
          <StaffGroupsTab
            {...commonProps}
            onDeleteGroup={handleDeleteGroup}
            isDeleteModalOpen={deleteGroupConfirmation !== null}
          />
        );
      case "daily-limits":
        // Phase 4.3: DailyLimitsTab now uses useSettings() hook
        return (
          <DailyLimitsTab
            staffMembers={staffMembers}
            validationErrors={validationErrors[activeTab] || {}}
            currentScheduleId={currentScheduleId}
          />
        );
      case "priority-rules":
        // Phase 4.2: PriorityRulesTab needs staffMembers + validationErrors (no scheduleId)
        return (
          <PriorityRulesTab
            staffMembers={staffMembers}
            validationErrors={validationErrors[activeTab] || {}}
          />
        );
      case "ml-parameters":
        // Phase 4.1: MLParametersTab only needs validationErrors (no staffMembers/scheduleId)
        return (
          <MLParametersTab
            validationErrors={validationErrors[activeTab] || {}}
          />
        );
      case "periods":
        return <PeriodsTab />;
      case "data-migration":
        return <DataMigrationTab />;
      default:
        return (
          <div className="p-8 text-center text-gray-500">
            Tab content not found
          </div>
        );
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                ⚙️
              </div>
              <span className="japanese-text text-xl font-bold">
                Settings & Configuration
              </span>
              <Badge variant="secondary" className="japanese-text">
                設定
              </Badge>
            </DialogTitle>

            {/* Backend Status Indicator */}
            <div className="flex items-center justify-between mt-2">
              {backendMode === "websocket-multitable" ? (
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-800 border-green-300"
                >
                  <span className="mr-1">🟢</span>
                  Real-time Multi-Table Sync
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 border-amber-300"
                >
                  <span className="mr-1">📱</span>
                  Local Storage Mode
                </Badge>
              )}

              {backendMode === "websocket-multitable" && currentVersion && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Version {currentVersion}</span>
                  {versionName && (
                    <span className="text-gray-500">• {versionName}</span>
                  )}
                  {isVersionLocked && (
                    <span className="text-red-600">🔒 Locked</span>
                  )}
                </div>
              )}
            </div>

            <DialogDescription>
              Configure ML models, business rules, and system settings
              {backendMode === "websocket-multitable" && (
                <span className="ml-2 text-xs text-gray-500">
                  • Status:{" "}
                  {connectionStatus === "connected"
                    ? "✅ Connected"
                    : "⏳ Connecting..."}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mx-4">
              <AlertTriangle size={20} />
              <AlertDescription>
                <strong>Configuration Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-4 mb-4 flex-shrink-0">
              {TABS.map((tab, index) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                  {validationErrors[tab.id] &&
                    Object.keys(validationErrors[tab.id]).length > 0 && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        !
                      </Badge>
                    )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-hidden px-4">
              {TABS.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="h-full overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  {renderTabContent(tab.id)}
                </TabsContent>
              ))}
            </div>
          </Tabs>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-4">
              {/* Autosave Status */}
              {isAutosaving && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Auto-saving...</span>
                </div>
              )}

              {autosaveError && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">
                    Auto-save failed: {autosaveError}
                  </span>
                </div>
              )}

              {!isAutosaving && !autosaveError && lastSaveTime && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check size={16} />
                  <span className="text-sm">
                    Saved at {new Date(lastSaveTime).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Autosave Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="autosave"
                  checked={isAutosaveEnabled}
                  onCheckedChange={setIsAutosaveEnabled}
                />
                <Label htmlFor="autosave" className="text-sm">
                  Auto-save
                </Label>
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                title="Reset to Defaults"
              >
                <RotateCcw size={16} />
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Modal - Rendered outside Dialog to prevent pointer-events issues */}
      {resetConfirmation && (
        <ConfirmationModal
          isOpen={resetConfirmation}
          onClose={handleResetCancel}
          onConfirm={handleResetConfirm}
          title="Reset All Settings"
          message="Are you sure you want to reset all settings to default values? This action cannot be undone and will remove all your custom configurations."
          confirmText="Reset Settings"
          cancelText="Cancel"
          variant="warning"
          isLoading={isResetting}
        />
      )}

      {/* Delete Group Confirmation Modal - Rendered outside Dialog to prevent pointer-events issues */}
      {deleteGroupConfirmation && (
        <ConfirmationModal
          isOpen={deleteGroupConfirmation !== null}
          onClose={handleDeleteGroupCancel}
          onConfirm={deleteGroupSuccess ? null : handleDeleteGroupConfirm}
          title={
            deleteGroupSuccess
              ? "Group Deleted Successfully"
              : "Delete Staff Group"
          }
          message={
            deleteGroupSuccess
              ? `The group "${deleteGroupConfirmation.groupName}" has been successfully deleted along with any related conflict rules and backup assignments.`
              : `Are you sure you want to delete the group "${deleteGroupConfirmation.groupName}"? This action cannot be undone and will also remove any related conflict rules and backup assignments.`
          }
          confirmText={deleteGroupSuccess ? null : "Delete Group"}
          cancelText={deleteGroupSuccess ? null : "Cancel"}
          variant={deleteGroupSuccess ? "info" : "danger"}
          isLoading={isDeletingGroup}
        />
      )}
    </>
  );
};

export default SettingsModal;
