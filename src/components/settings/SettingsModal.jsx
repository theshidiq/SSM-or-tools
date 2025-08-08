import React, { useState, useEffect } from "react";
import { X, Save, RotateCcw, Download, Upload, History, AlertTriangle } from "lucide-react";

// Import tab components
import StaffGroupsTab from "./tabs/StaffGroupsTab";
import DailyLimitsTab from "./tabs/DailyLimitsTab";
import PriorityRulesTab from "./tabs/PriorityRulesTab";
import MLParametersTab from "./tabs/MLParametersTab";
import ConstraintWeightsTab from "./tabs/ConstraintWeightsTab";

// Import shared components
import TabButton from "./shared/TabButton";

const TABS = [
  { id: "staff-groups", label: "Staff Groups", icon: "👥" },
  { id: "daily-limits", label: "Daily Limits", icon: "📅" },
  { id: "priority-rules", label: "Priority Rules", icon: "⭐" },
  { id: "ml-parameters", label: "ML Parameters", icon: "🤖" },
  { id: "constraint-weights", label: "Weights", icon: "⚖️" }
];

const SettingsModal = ({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  error = null,
  // Settings data
  settings,
  onSettingsChange,
  // Staff data for reference
  staffMembers = [],
  // Configuration management
  onExportConfig,
  onImportConfig,
  onResetConfig,
  onShowHistory,
  // Validation and preview
  validationErrors = {},
  hasUnsavedChanges = false,
}) => {
  const [activeTab, setActiveTab] = useState("staff-groups");
  const [isVisible, setIsVisible] = useState(false);

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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      // Close modal on Escape
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // Save on Ctrl/Cmd + S
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
        return;
      }

      // Tab navigation with Ctrl/Cmd + 1-5
      if ((event.ctrlKey || event.metaKey) && event.key >= "1" && event.key <= "5") {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        if (TABS[tabIndex]) {
          setActiveTab(TABS[tabIndex].id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onSave]);

  const handleSave = async () => {
    if (isLoading) return;
    
    try {
      await onSave(settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all settings to default values? This action cannot be undone.")) {
      onResetConfig();
    }
  };

  const renderTabContent = () => {
    const commonProps = {
      settings,
      onSettingsChange,
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
      case "constraint-weights":
        return <ConstraintWeightsTab {...commonProps} />;
      default:
        return <div className="p-8 text-center text-gray-500">Tab content not found</div>;
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div
        className={`bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl transform transition-all duration-300 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">⚙️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
              <p className="text-gray-600 text-sm">Configure ML models and business rules</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Configuration Actions */}
            <button
              onClick={onShowHistory}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title="Configuration History (Ctrl+H)"
            >
              <History size={16} className="mr-1.5" />
              History
            </button>
            
            <button
              onClick={onExportConfig}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title="Export Configuration"
            >
              <Download size={16} className="mr-1.5" />
              Export
            </button>
            
            <button
              onClick={onImportConfig}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title="Import Configuration"
            >
              <Upload size={16} className="mr-1.5" />
              Import
            </button>

            <div className="h-6 w-px bg-gray-300"></div>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Configuration Error</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-1" role="tablist">
            {TABS.map((tab, index) => (
              <TabButton
                key={tab.id}
                id={tab.id}
                label={tab.label}
                icon={tab.icon}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                hasErrors={validationErrors[tab.id] && Object.keys(validationErrors[tab.id]).length > 0}
                keyboardShortcut={`Ctrl+${index + 1}`}
              />
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-orange-600">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-sm font-medium">Unsaved changes</span>
              </div>
            )}
            
            <button
              onClick={handleReset}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              title="Reset to Defaults"
            >
              <RotateCcw size={16} className="mr-1.5" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={isLoading}
              className={`flex items-center px-6 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isLoading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              title="Save Configuration (Ctrl+S)"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-200 border-t-white rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-1.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;