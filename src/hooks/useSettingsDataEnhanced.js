/**
 * Enhanced Settings Data Hook - Phase 2+3 Integration
 * Combines Phase 3's Supabase-first real-time with Phase 2's advanced features
 */

import { useCallback, useEffect, useMemo } from "react";
import {
  useConflictResolver,
  RESOLUTION_STRATEGIES,
} from "../utils/conflictResolver";
import { useSettingsDataRealtime } from "./useSettingsDataRealtime";
import { useAdvancedCache } from "./useAdvancedCache";
import { useOfflineSupport, OPERATION_TYPES } from "./useOfflineSupport";

export const useSettingsDataEnhanced = (options = {}) => {
  const {
    enableAdvancedCache = true,
    enableOfflineSupport = true,
    enableConflictResolution = true,
    cacheOptions = {},
    offlineOptions = {},
    conflictOptions = {
      defaultStrategy: RESOLUTION_STRATEGIES.AUTOMATIC_MERGE,
    },
  } = options;

  // Phase 3: Supabase-first real-time settings management
  const realtimeHook = useSettingsDataRealtime();

  // Phase 2: Advanced features
  const cacheHook = useAdvancedCache({
    enableMemoryCache: enableAdvancedCache,
    enableIndexedDBCache: enableAdvancedCache,
    ...cacheOptions,
  });

  const offlineHook = useOfflineSupport({
    enableOfflineMode: enableOfflineSupport,
    ...offlineOptions,
    onSyncSuccess: (synced, failed) => {
      console.log(
        `📊 Phase 2+3: Synced ${synced} settings operations, ${failed} failed`,
      );
      // Invalidate cache after successful sync
      cacheHook.invalidatePattern("settings");
    },
    onOfflineChange: (isOffline) => {
      console.log(
        `📱 Phase 2+3: Settings ${isOffline ? "Offline" : "Online"} mode activated`,
      );
    },
  });

  const conflictHook = useConflictResolver({
    enableUserChoice: enableConflictResolution,
    ...conflictOptions,
  });

  /**
   * Enhanced update settings with Phase 2 features
   */
  const updateSettingsEnhanced = useCallback(
    async (newSettings) => {
      const changeMetadata = {
        type: "settings_update",
        settings: newSettings,
        timestamp: new Date().toISOString(),
        operation: "update",
      };

      try {
        // Try offline-capable update first
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.BULK_UPDATE,
            payload: {
              bulkFunction: () => realtimeHook.updateSettings(newSettings),
              settingsData: newSettings,
            },
          });

          if (success) {
            // Invalidate relevant cache entries
            await cacheHook.invalidate("settings");
            await cacheHook.invalidate("settings_sections");

            console.log("✅ Phase 2+3: Enhanced settings update completed");
            realtimeHook.updateSettings(newSettings);
            return;
          }
        }

        // Fallback to direct real-time update
        realtimeHook.updateSettings(newSettings);

        // Update cache
        await cacheHook.setCached("settings", newSettings);
      } catch (error) {
        console.error("Phase 2+3: Enhanced settings update failed:", error);

        // Store for conflict resolution if needed
        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  /**
   * Enhanced save settings with Phase 2 features
   */
  const saveSettingsEnhanced = useCallback(
    async (settingsToSave = realtimeHook.settings) => {
      try {
        // Store offline backup first
        if (enableOfflineSupport) {
          await cacheHook.setCached(
            "offline_settings_backup",
            settingsToSave,
            24 * 60,
          ); // 24 hours
        }

        // Save via real-time mechanism
        await realtimeHook.saveSettings(settingsToSave);

        // Update cache
        await cacheHook.setCached("settings", settingsToSave, 60);

        console.log("✅ Phase 2+3: Enhanced settings save completed");
        return { success: true };
      } catch (error) {
        console.error("Phase 2+3: Enhanced settings save failed:", error);

        // Queue for offline sync if save failed
        if (enableOfflineSupport) {
          await offlineHook.queueOperation({
            type: OPERATION_TYPES.BULK_UPDATE,
            payload: {
              bulkFunction: () => realtimeHook.saveSettings(settingsToSave),
              settingsData: settingsToSave,
            },
          });
        }

        throw error;
      }
    },
    [realtimeHook, cacheHook, offlineHook, enableOfflineSupport],
  );

  /**
   * Enhanced section-specific update methods
   */
  const updateStaffGroupsEnhanced = useCallback(
    async (staffGroups) => {
      const changeMetadata = {
        type: "staff_groups_update",
        section: "staffGroups",
        data: staffGroups,
        timestamp: new Date().toISOString(),
        operation: "section_update",
      };

      try {
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.BULK_UPDATE,
            payload: {
              bulkFunction: () => realtimeHook.updateStaffGroups(staffGroups),
              settingsData: { staffGroups },
            },
          });

          if (success) {
            await cacheHook.invalidate("settings_staff_groups");
            console.log("✅ Phase 2+3: Enhanced staff groups update completed");
            realtimeHook.updateStaffGroups(staffGroups);
            return;
          }
        }

        realtimeHook.updateStaffGroups(staffGroups);
        await cacheHook.setCached("settings_staff_groups", staffGroups);
      } catch (error) {
        console.error("Phase 2+3: Enhanced staff groups update failed:", error);

        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  const updateDailyLimitsEnhanced = useCallback(
    async (dailyLimits) => {
      const changeMetadata = {
        type: "daily_limits_update",
        section: "dailyLimits",
        data: dailyLimits,
        timestamp: new Date().toISOString(),
        operation: "section_update",
      };

      try {
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.BULK_UPDATE,
            payload: {
              bulkFunction: () => realtimeHook.updateDailyLimits(dailyLimits),
              settingsData: { dailyLimits },
            },
          });

          if (success) {
            await cacheHook.invalidate("settings_daily_limits");
            console.log("✅ Phase 2+3: Enhanced daily limits update completed");
            realtimeHook.updateDailyLimits(dailyLimits);
            return;
          }
        }

        realtimeHook.updateDailyLimits(dailyLimits);
        await cacheHook.setCached("settings_daily_limits", dailyLimits);
      } catch (error) {
        console.error("Phase 2+3: Enhanced daily limits update failed:", error);

        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  const updateMLParametersEnhanced = useCallback(
    async (mlParameters) => {
      const changeMetadata = {
        type: "ml_parameters_update",
        section: "mlParameters",
        data: mlParameters,
        timestamp: new Date().toISOString(),
        operation: "section_update",
      };

      try {
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.BULK_UPDATE,
            payload: {
              bulkFunction: () => realtimeHook.updateMLParameters(mlParameters),
              settingsData: { mlParameters },
            },
          });

          if (success) {
            await cacheHook.invalidate("settings_ml_parameters");
            console.log(
              "✅ Phase 2+3: Enhanced ML parameters update completed",
            );
            realtimeHook.updateMLParameters(mlParameters);
            return;
          }
        }

        realtimeHook.updateMLParameters(mlParameters);
        await cacheHook.setCached("settings_ml_parameters", mlParameters);
      } catch (error) {
        console.error(
          "Phase 2+3: Enhanced ML parameters update failed:",
          error,
        );

        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  /**
   * Enhanced settings loading with advanced caching
   */
  const loadSettingsEnhanced = useCallback(async () => {
    const cacheKey = "settings_complete";

    try {
      // Try cache first, then fallback to real-time loading
      const cachedData = await cacheHook.getCached(
        cacheKey,
        async () => {
          console.log(
            "🔄 Phase 2+3: Cache miss, loading from real-time source",
          );
          return realtimeHook.settings;
        },
        30, // 30 minutes cache TTL for settings
      );

      return cachedData;
    } catch (error) {
      console.error("Phase 2+3: Enhanced settings loading failed:", error);

      // Try offline data as last resort
      if (enableOfflineSupport) {
        const offlineData = await cacheHook.getCached(
          "offline_settings_backup",
        );
        if (offlineData) {
          console.log("📱 Phase 2+3: Using offline settings backup");
          return offlineData;
        }
      }

      throw error;
    }
  }, [cacheHook, realtimeHook, enableOfflineSupport]);

  /**
   * Get enhanced performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    const metrics = {
      phase3: {
        isConnected: realtimeHook.isConnected,
        isSaving: realtimeHook.isSaving,
        isLoading: realtimeHook.isLoading,
        hasUnsavedChanges: realtimeHook.hasUnsavedChanges,
        lastSaveTime: realtimeHook.lastSaveTime,
      },
      phase2: {
        cache: enableAdvancedCache ? cacheHook.getCacheMetrics() : null,
        offline: enableOfflineSupport
          ? {
              isOnline: offlineHook.isOnline,
              pendingOperations: offlineHook.pendingOperations.length,
              syncStats: offlineHook.syncStats,
            }
          : null,
        conflicts: enableConflictResolution
          ? {
              activeConflicts: conflictHook.activeConflicts.length,
              conflictStats: conflictHook.conflictStats,
            }
          : null,
      },
    };

    return metrics;
  }, [
    realtimeHook,
    cacheHook,
    offlineHook,
    conflictHook,
    enableAdvancedCache,
    enableOfflineSupport,
    enableConflictResolution,
  ]);

  // Auto-sync pending operations when back online
  useEffect(() => {
    if (
      enableOfflineSupport &&
      offlineHook.isOnline &&
      offlineHook.pendingOperations.length > 0
    ) {
      offlineHook.syncPendingOperations();
    }
  }, [
    offlineHook.isOnline,
    offlineHook.pendingOperations.length,
    offlineHook.syncPendingOperations,
    enableOfflineSupport,
  ]);

  // Enhanced connection status
  const connectionStatus = useMemo(() => {
    if (!realtimeHook.isConnected) return "disconnected";
    if (realtimeHook.isSaving) return "saving";
    if (realtimeHook.isLoading) return "loading";
    if (enableOfflineSupport && !offlineHook.isOnline) return "offline_mode";
    if (enableOfflineSupport && offlineHook.isSyncing) return "syncing";
    if (enableConflictResolution && conflictHook.activeConflicts.length > 0)
      return "conflicts";
    return "connected";
  }, [
    realtimeHook.isConnected,
    realtimeHook.isSaving,
    realtimeHook.isLoading,
    offlineHook?.isOnline,
    offlineHook?.isSyncing,
    conflictHook?.activeConflicts?.length,
    enableOfflineSupport,
    enableConflictResolution,
  ]);

  return {
    // Phase 3 (Real-time) - Enhanced versions
    settings: realtimeHook.settings,

    // Enhanced operations
    updateSettings: updateSettingsEnhanced,
    saveSettings: saveSettingsEnhanced,
    resetToDefaults: realtimeHook.resetToDefaults,
    loadSettings: loadSettingsEnhanced,

    // Enhanced section-specific updates
    updateStaffGroups: updateStaffGroupsEnhanced,
    updateDailyLimits: updateDailyLimitsEnhanced,
    updateMLParameters: updateMLParametersEnhanced,
    updateMonthlyLimits: realtimeHook.updateMonthlyLimits,
    updateBackupAssignments: realtimeHook.updateBackupAssignments,

    // Phase 3 Status
    isConnected: realtimeHook.isConnected,
    isLoading: realtimeHook.isLoading,
    isSaving: realtimeHook.isSaving,
    error: realtimeHook.error,

    // Change tracking
    hasUnsavedChanges: realtimeHook.hasUnsavedChanges,
    validationErrors: realtimeHook.validationErrors,

    // Autosave state
    isAutosaveEnabled: realtimeHook.isAutosaveEnabled,
    setIsAutosaveEnabled: realtimeHook.setIsAutosaveEnabled,
    isAutosaving: realtimeHook.isAutosaving,
    lastSaveTime: realtimeHook.lastSaveTime,

    // Phase 2 Features
    cache: enableAdvancedCache ? cacheHook : null,
    offline: enableOfflineSupport ? offlineHook : null,
    conflicts: enableConflictResolution ? conflictHook : null,

    // Enhanced Status
    connectionStatus,
    isEnhanced: true,
    phase: "Phase 2+3: Enhanced Real-time Settings Management",

    // Enhanced Metrics
    getPerformanceMetrics,

    // Getters for individual sections (cached)
    getStaffGroups: () => realtimeHook.getStaffGroups(),
    getDailyLimits: () => realtimeHook.getDailyLimits(),
    getPriorityRules: () => realtimeHook.getPriorityRules(),
    getMLParameters: () => realtimeHook.getMLParameters(),
    getMonthlyLimits: () => realtimeHook.getMonthlyLimits(),
    getBackupAssignments: () => realtimeHook.getBackupAssignments(),

    // Utilities
    validateSettings: realtimeHook.validateSettings,
    refetchSettings: realtimeHook.refetchSettings,

    // Feature flags
    features: {
      advancedCache: enableAdvancedCache,
      offlineSupport: enableOfflineSupport,
      conflictResolution: enableConflictResolution,
    },
  };
};

export default useSettingsDataEnhanced;
