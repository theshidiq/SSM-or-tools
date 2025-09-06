import React, { useState, useEffect, useRef } from "react";
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
import { useSettingsCache } from "../../hooks/useConfigurationCache";
import StaffGroupsTab from "./tabs/StaffGroupsTab";
import DailyLimitsTab from "./tabs/DailyLimitsTab";
import PriorityRulesTab from "./tabs/PriorityRulesTab";
import MLParametersTab from "./tabs/MLParametersTab";
import DataMigrationTab from "./tabs/DataMigrationTab";

// Import shared components
import TabButton from "./shared/TabButton";
import ConfirmationModal from "./shared/ConfirmationModal";

// Import configuration cache hook

const TABS = [
  { id: "staff-groups", label: "Staff Groups", icon: "👥" },
  { id: "daily-limits", label: "Daily Limits", icon: "📅" },
  { id: "priority-rules", label: "Priority Rules", icon: "⭐" },
  { id: "ml-parameters", label: "ML Parameters", icon: "🤖" },
  { id: "data-migration", label: "Data Migration", icon: "🔄" },
];

const SettingsModal = ({
  isOpen,
  onClose,
  isAutoSaving = false,
  error = null,
  // Settings data
  settings,
  onSettingsChange,
  // Staff data for reference
  staffMembers = [],
  // Configuration management
  onResetConfig,
  // Validation and preview
  validationErrors = {},
  // Autosave state
  autosaveError = null,
  isAutosaveEnabled = true,
  onToggleAutosave,
  lastSaveTime = null,
}) => {
  const [activeTab, setActiveTab] = useState("staff-groups");
  const [isVisible, setIsVisible] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const modalRef = useRef(null);

  // Configuration cache management
  const { onSettingSaved, onSettingsBulkSaved, cacheStatus, isRefreshing } =
    useSettingsCache();

  // Enhanced settings change handler that also refreshes cache
  const handleSettingsChange = async (newSettings, changedSection = null) => {
    // Call the original settings change handler
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }

    // Refresh configuration cache based on what changed
    if (changedSection) {
      await onSettingSaved(changedSection);
    } else {
      await onSettingsBulkSaved();
    }
  };

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
      onResetConfig();
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

  const renderTabContent = () => {
    const commonProps = {
      settings,
      onSettingsChange: handleSettingsChange,
      staffMembers,
      validationErrors: validationErrors[activeTab] || {},
    };

    switch (activeTab) {
      case "staff-groups":
        return <StaffGroupsTab {...commonProps} />;
      case "daily-limits":
        return <DailyLimitsTab {...commonProps} />;
      case "priority-rules":
        return <PriorityRulesTab {...commonProps} />;
      case "ml-parameters":
        return <MLParametersTab {...commonProps} />;
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
          <DialogDescription>
            Configure ML models, business rules, and system settings
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
            {isAutoSaving && (
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

            {!isAutoSaving && !autosaveError && lastSaveTime && (
              <div className="flex items-center gap-2 text-green-600">
                <Check size={16} />
                <span className="text-sm">
                  Saved at {new Date(lastSaveTime).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Autosave Toggle */}
            {onToggleAutosave && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="autosave"
                  checked={isAutosaveEnabled}
                  onCheckedChange={onToggleAutosave}
                />
                <Label htmlFor="autosave" className="text-sm">
                  Auto-save
                </Label>
              </div>
            )}

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

      {/* Reset Confirmation Modal - Moved outside to prevent z-index issues */}
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
    </Dialog>
  );
};

export default SettingsModal;
