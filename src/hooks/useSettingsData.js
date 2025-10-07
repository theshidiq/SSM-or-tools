import { useState, useEffect, useCallback, useRef } from "react";
import { configService } from "../services/ConfigurationService";
import { useAutosave } from "./useAutosave";
import { useWebSocketSettings } from "./useWebSocketSettings";

// Feature flag for WebSocket settings (multi-table backend)
const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

export const useSettingsData = (autosaveEnabled = true) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(autosaveEnabled);

  // Ref to hold current settings to prevent infinite loops
  const settingsRef = useRef(settings);

  // WebSocket multi-table integration
  const {
    settings: wsSettings,
    version: wsVersion,
    updateStaffGroups: wsUpdateStaffGroups,
    createStaffGroup: wsCreateStaffGroup,
    deleteStaffGroup: wsDeleteStaffGroup,
    updateDailyLimits: wsUpdateDailyLimits,
    updateMonthlyLimits: wsUpdateMonthlyLimits,
    updatePriorityRules: wsUpdatePriorityRules,
    updateMLConfig: wsUpdateMLConfig,
    resetSettings: wsResetSettings,
    migrateSettings: wsMigrateSettings,
    isConnected: wsConnected,
    connectionStatus,
    isLoading: wsLoading,
    lastError: wsError
  } = useWebSocketSettings({
    enabled: WEBSOCKET_SETTINGS_ENABLED
  });

  // Store WebSocket callbacks in refs to keep updateSettings stable
  const wsCallbacksRef = useRef({
    wsUpdateStaffGroups,
    wsCreateStaffGroup,
    wsDeleteStaffGroup,
    wsUpdateDailyLimits,
    wsUpdateMonthlyLimits,
    wsUpdatePriorityRules,
    wsUpdateMLConfig
  });

  // Update refs when callbacks change
  useEffect(() => {
    wsCallbacksRef.current = {
      wsUpdateStaffGroups,
      wsCreateStaffGroup,
      wsDeleteStaffGroup,
      wsUpdateDailyLimits,
      wsUpdateMonthlyLimits,
      wsUpdatePriorityRules,
      wsUpdateMLConfig
    };
  }, [wsUpdateStaffGroups, wsCreateStaffGroup, wsDeleteStaffGroup, wsUpdateDailyLimits, wsUpdateMonthlyLimits, wsUpdatePriorityRules, wsUpdateMLConfig]);

  // Determine active backend mode
  const useWebSocket = WEBSOCKET_SETTINGS_ENABLED && wsConnected;

  // Log backend mode on mount and changes
  useEffect(() => {
    if (WEBSOCKET_SETTINGS_ENABLED) {
      if (wsConnected) {
        console.log('📡 useSettingsData: WebSocket multi-table backend ACTIVE');
        console.log(`  - Version: ${wsVersion?.versionNumber} (${wsVersion?.name})`);
        console.log(`  - Tables: staff_groups, daily_limits, monthly_limits, priority_rules, ml_model_configs`);
      } else {
        console.log('📦 useSettingsData: localStorage fallback (WebSocket disconnected)');
      }
    } else {
      console.log('📦 useSettingsData: localStorage mode (WebSocket disabled)');
    }
  }, [wsConnected, wsVersion]);

  // Sync WebSocket settings to local state (aggregate multi-table data)
  useEffect(() => {
    if (useWebSocket && wsSettings) {
      console.log('🔄 Syncing WebSocket multi-table settings to local state');

      // Transform multi-table response to localStorage-compatible format
      const aggregatedSettings = {
        staffGroups: wsSettings.staffGroups || [],
        dailyLimits: wsSettings.dailyLimits || [],
        monthlyLimits: wsSettings.monthlyLimits || [],
        priorityRules: wsSettings.priorityRules || [],
        mlParameters: wsSettings.mlModelConfigs?.[0] || {},
        version: wsVersion,
      };

      setSettings(aggregatedSettings);
      setIsLoading(false);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [useWebSocket, wsSettings, wsVersion]);

  // Sync settings to ref to prevent infinite loops in updateSettings
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load settings from localStorage via configService (localStorage mode only)
  const loadSettings = useCallback(() => {
    if (useWebSocket) {
      console.log('⏭️ Skipping loadSettings - using WebSocket multi-table backend');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const loadedSettings = configService.getSettings();
      setSettings(loadedSettings);
      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket]);

  // Save settings via configService (localStorage mode only)
  const saveSettings = useCallback(
    async (settingsToSave = settings, skipLoadingState = false) => {
      if (useWebSocket) {
        console.log('⏭️ Skipping saveSettings - using WebSocket multi-table backend (auto-sync)');
        return { success: true };
      }

      try {
        if (!skipLoadingState) {
          setIsLoading(true);
        }
        setError(null);

        // Validate settings before saving
        const validation = configService.validateSettings(settingsToSave);
        if (!validation.isValid) {
          setValidationErrors(validation.errors);
          throw new Error("Validation errors found");
        }

        // Save settings
        const success = await configService.saveSettings(settingsToSave);
        if (!success) {
          throw new Error("Failed to save settings");
        }

        setSettings(settingsToSave);
        setHasUnsavedChanges(false);
        setValidationErrors({});

        return { success: true };
      } catch (err) {
        console.error("Failed to save settings:", err);
        setError(err.message);
        throw err;
      } finally {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [settings, useWebSocket],
  );

  /**
   * Update settings with multi-table awareness
   * Detects which table was modified and sends specific WebSocket updates
   */
  const updateSettings = useCallback((newSettings) => {
    if (useWebSocket) {
      console.log('🔄 Updating settings via WebSocket multi-table backend');

      // ✅ CRITICAL: Capture old settings BEFORE updating ref
      const oldSettings = settingsRef.current || {};
      const callbacks = wsCallbacksRef.current;

      // Detect and send changes to server FIRST (while we still have old settings for comparison)
      let changedGroupsCount = 0;
      let createdGroupsCount = 0;
      let deletedGroupsCount = 0;

      // Detect and update staff groups (CREATE, UPDATE, DELETE operations)
      if (JSON.stringify(oldSettings.staffGroups) !== JSON.stringify(newSettings.staffGroups)) {
        console.log('  - Detecting staff_groups table changes...');

        const oldGroups = oldSettings.staffGroups || [];
        const newGroups = newSettings.staffGroups || [];
        const oldGroupIds = new Set(oldGroups.map(g => g.id));
        const newGroupIds = new Set(newGroups.map(g => g.id));

        // Detect CREATED groups (exist in new but not in old)
        const createdGroups = newGroups.filter(g => !oldGroupIds.has(g.id));
        createdGroupsCount = createdGroups.length;
        if (createdGroups.length > 0) {
          console.log(`    - ${createdGroups.length} new group(s) created`);
          createdGroups.forEach(group => {
            console.log(`      - Creating group "${group.name}" (${group.id})`);
            callbacks.wsCreateStaffGroup(group);
          });
        }

        // Detect DELETED groups (exist in old but not in new)
        const deletedGroupIds = [...oldGroupIds].filter(id => !newGroupIds.has(id));
        deletedGroupsCount = deletedGroupIds.length;
        if (deletedGroupIds.length > 0) {
          console.log(`    - ${deletedGroupIds.length} group(s) deleted`);
          deletedGroupIds.forEach(groupId => {
            const deletedGroup = oldGroups.find(g => g.id === groupId);
            console.log(`      - Deleting group "${deletedGroup?.name}" (${groupId})`);
            callbacks.wsDeleteStaffGroup(groupId);
          });
        }

        // Detect UPDATED groups (exist in both, but members changed)
        const updatedGroups = newGroups.filter(newGroup => {
          if (!oldGroupIds.has(newGroup.id)) return false; // Skip newly created

          const oldGroup = oldGroups.find(g => g.id === newGroup.id);
          // Only compare members array, not entire object
          const oldMembers = JSON.stringify(oldGroup?.members || []);
          const newMembers = JSON.stringify(newGroup.members || []);
          return oldMembers !== newMembers;
        });

        changedGroupsCount = updatedGroups.length;
        if (updatedGroups.length > 0) {
          console.log(`    - ${updatedGroups.length} group(s) updated`);
          updatedGroups.forEach(group => {
            const oldGroup = oldGroups.find(g => g.id === group.id);
            console.log(`      - Updating group "${group.name}": ${oldGroup?.members?.length || 0} → ${group.members?.length || 0} members`);
            callbacks.wsUpdateStaffGroups(group);
          });
        }

        console.log(`  - Summary: ${createdGroupsCount} created, ${changedGroupsCount} updated, ${deletedGroupsCount} deleted`);
      }

      // Detect and update daily limits
      if (JSON.stringify(oldSettings.dailyLimits) !== JSON.stringify(newSettings.dailyLimits)) {
        console.log('  - Updating daily_limits table');
        newSettings.dailyLimits?.forEach(limit => {
          callbacks.wsUpdateDailyLimits(limit);
        });
      }

      // Detect and update monthly limits
      if (JSON.stringify(oldSettings.monthlyLimits) !== JSON.stringify(newSettings.monthlyLimits)) {
        console.log('  - Updating monthly_limits table');
        newSettings.monthlyLimits?.forEach(limit => {
          callbacks.wsUpdateMonthlyLimits(limit);
        });
      }

      // Detect and update priority rules
      if (JSON.stringify(oldSettings.priorityRules) !== JSON.stringify(newSettings.priorityRules)) {
        console.log('  - Updating priority_rules table');
        newSettings.priorityRules?.forEach(rule => {
          callbacks.wsUpdatePriorityRules(rule);
        });
      }

      // Detect and update ML parameters
      if (JSON.stringify(oldSettings.mlParameters) !== JSON.stringify(newSettings.mlParameters)) {
        console.log('  - Updating ml_model_configs table');
        callbacks.wsUpdateMLConfig(newSettings.mlParameters);
      }

      // ✅ OPTIMISTIC UPDATE: Update local state AFTER all change detection completes
      // This prevents race conditions where ref updates before all comparisons finish
      settingsRef.current = newSettings;
      setSettings(newSettings);

      // WebSocket updates are authoritative - no unsaved changes
      setValidationErrors({});
    } else {
      // localStorage mode - traditional behavior
      setSettings(newSettings);
      setHasUnsavedChanges(true);
      setValidationErrors({});
    }
  }, [useWebSocket]); // FIXED: Only depend on useWebSocket, use refs for callbacks

  /**
   * Reset settings to defaults (multi-table aware)
   */
  const resetToDefaults = useCallback(async () => {
    try {
      setIsLoading(true);

      if (useWebSocket) {
        console.log('🔄 Resetting settings via WebSocket multi-table backend');
        // WebSocket mode: send multi-table reset to Go server
        await wsResetSettings();
        console.log('✅ Multi-table reset complete');
      } else {
        // localStorage mode: use configService
        await configService.resetToDefaults();
        const defaultSettings = configService.getSettings();
        setSettings(defaultSettings);
      }

      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to reset to defaults:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsResetSettings]);

  // Export configuration
  const exportConfiguration = useCallback(() => {
    try {
      return configService.exportSettings();
    } catch (err) {
      console.error("Failed to export configuration:", err);
      throw err;
    }
  }, []);

  // Import configuration
  const importConfiguration = useCallback(
    (configJson) => {
      try {
        const result = configService.importSettings(configJson);
        if (!result.success) {
          throw new Error(result.error);
        }

        if (useWebSocket) {
          console.log('📥 Imported configuration - migrating to WebSocket multi-table backend');
          // In WebSocket mode, trigger migration after import
          wsMigrateSettings(JSON.parse(configJson)).catch(err => {
            console.error('Migration failed after import:', err);
          });
        } else {
          // Reload settings after import (localStorage mode)
          loadSettings();
        }

        return { success: true };
      } catch (err) {
        setError("Failed to import configuration: " + err.message);
        return { success: false, error: err.message };
      }
    },
    [loadSettings, useWebSocket, wsMigrateSettings],
  );

  /**
   * Migrate localStorage settings to WebSocket multi-table backend
   * @returns {Promise<void>}
   */
  const migrateToBackend = useCallback(async () => {
    if (!useWebSocket) {
      throw new Error('WebSocket not connected - cannot migrate to multi-table backend');
    }

    try {
      setIsLoading(true);
      console.log('🚀 Starting localStorage → multi-table backend migration');

      // Get localStorage settings
      const localSettings = localStorage.getItem('shift-schedule-settings');
      if (!localSettings) {
        throw new Error('No localStorage settings to migrate');
      }

      const parsedSettings = JSON.parse(localSettings);

      // Send migration request (will map to multi-table structure on server)
      await wsMigrateSettings(parsedSettings);

      console.log('✅ Migration complete (localStorage → multi-table backend)');
      console.log(`  - Staff Groups: ${parsedSettings.staffGroups?.length || 0} items`);
      console.log(`  - Daily Limits: ${parsedSettings.dailyLimits?.length || 0} items`);
      console.log(`  - Monthly Limits: ${parsedSettings.monthlyLimits?.length || 0} items`);
      console.log(`  - Priority Rules: ${parsedSettings.priorityRules?.length || 0} items`);
      console.log(`  - ML Parameters: ${parsedSettings.mlParameters ? '1 config' : '0 configs'}`);
    } catch (err) {
      console.error("Failed to migrate settings:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsMigrateSettings]);

  // Autosave functionality (localStorage mode only - WebSocket is authoritative)
  const autosaveSettings = useCallback(
    async (settingsToSave) => {
      if (useWebSocket) {
        // WebSocket mode: no autosave needed (real-time sync)
        return { success: true };
      }
      return await saveSettings(settingsToSave, true); // Skip loading state for autosave
    },
    [saveSettings, useWebSocket],
  );

  const {
    isAutosaving,
    lastSaveTime,
    saveError: autosaveError,
    saveNow: saveNowAutosave,
    cancelAutosave,
  } = useAutosave(autosaveSettings, settings, {
    delay: 400, // 400ms debounce
    enabled: isAutosaveEnabled && !useWebSocket, // Disable autosave in WebSocket mode
    onSaveSuccess: () => {
      // Settings autosaved successfully (localStorage mode only)
    },
    onSaveError: (error) => {
      console.warn("Autosave failed:", error);
    },
  });

  // Load settings on mount (localStorage mode only)
  useEffect(() => {
    if (!useWebSocket) {
      loadSettings();
    }
  }, [loadSettings, useWebSocket]);

  return {
    // State
    settings,
    version: wsVersion,
    isLoading: useWebSocket ? wsLoading : isLoading,
    error: useWebSocket ? wsError : error,
    hasUnsavedChanges,
    validationErrors,

    // Actions (multi-table aware)
    updateSettings,
    saveSettings, // localStorage only
    loadSettings, // localStorage only
    resetToDefaults,
    migrateToBackend, // NEW: localStorage → multi-table backend migration
    exportConfiguration,
    importConfiguration,

    // Backend mode indicators (NEW)
    backendMode: useWebSocket ? 'websocket-multitable' : 'localStorage',
    isConnectedToBackend: useWebSocket,
    connectionStatus: useWebSocket ? connectionStatus : 'localStorage',

    // Version info (NEW - multi-table backend only)
    currentVersion: wsVersion?.versionNumber,
    versionName: wsVersion?.name,
    isVersionLocked: wsVersion?.isLocked,

    // Autosave (localStorage only - disabled in WebSocket mode)
    isAutosaving,
    lastSaveTime,
    autosaveError,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    saveNowAutosave,
    cancelAutosave,

    // Utilities
    validateSettings: (settingsToValidate) =>
      configService.validateSettings(settingsToValidate),
  };
};
