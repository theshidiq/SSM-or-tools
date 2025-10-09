/**
 * Enhanced Staff Management Hook - Phase 2+3 Integration
 * Combines Phase 3's Supabase-first real-time with Phase 2's advanced features
 */

import { useCallback, useEffect, useMemo } from "react";
import {
  useConflictResolver,
  RESOLUTION_STRATEGIES,
} from "../utils/conflictResolver";
import { useStaffRealtime } from "./useStaffRealtime";
import { useAdvancedCache } from "./useAdvancedCache";
import { useOfflineSupport, OPERATION_TYPES } from "./useOfflineSupport";

export const useStaffManagementEnhanced = (currentMonthIndex, options = {}) => {
  const {
    enabled = true, // Add enabled option to completely disable the hook
    enableAdvancedCache = true,
    enableOfflineSupport = true,
    enableConflictResolution = true,
    cacheOptions = {},
    offlineOptions = {},
    conflictOptions = {
      defaultStrategy: RESOLUTION_STRATEGIES.AUTOMATIC_MERGE,
    },
  } = options;

  // Phase 3: Supabase-first real-time staff management
  const realtimeHook = useStaffRealtime(currentMonthIndex);

  // Phase 2: Advanced features
  const cacheHook = useAdvancedCache({
    enableMemoryCache: enableAdvancedCache,
    enableIndexedDBCache: enableAdvancedCache,
    ...cacheOptions,
  });

  const offlineHook = useOfflineSupport({
    enableOfflineMode: enabled && enableOfflineSupport, // Only enable offline support when hook is enabled
    ...offlineOptions,
    onSyncSuccess: (synced, failed) => {
      console.log(
        `📊 Phase 2+3: Synced ${synced} staff operations, ${failed} failed`,
      );
      // Invalidate cache after successful sync
      cacheHook.invalidatePattern(`staff_${currentMonthIndex}`);
    },
    onOfflineChange: (isOffline) => {
      console.log(
        `📱 Phase 2+3: Staff ${isOffline ? "Offline" : "Online"} mode activated`,
      );
    },
  });

  const conflictHook = useConflictResolver({
    enableUserChoice: enableConflictResolution,
    ...conflictOptions,
  });

  /**
   * Enhanced add staff with Phase 2 features
   */
  const addStaffEnhanced = useCallback(
    async (newStaff) => {
      const changeMetadata = {
        type: "staff_create",
        staffId: newStaff.id,
        staffData: newStaff,
        period: currentMonthIndex,
        timestamp: new Date().toISOString(),
        operation: "create",
      };

      try {
        // Try offline-capable create first
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.CREATE_STAFF,
            payload: {
              createFunction: () => realtimeHook.addStaff(newStaff),
              staffData: newStaff,
            },
          });

          if (success) {
            // Invalidate relevant cache entries
            await cacheHook.invalidate(`staff_${currentMonthIndex}`);
            await cacheHook.invalidate(`staff_all`);

            console.log("✅ Phase 2+3: Enhanced staff creation completed");
            return realtimeHook.addStaff(newStaff);
          }
        }

        // Fallback to direct real-time create
        const result = realtimeHook.addStaff(newStaff);

        // Update cache
        await cacheHook.setCached(`staff_${newStaff.id}`, newStaff);
        await cacheHook.invalidate(`staff_${currentMonthIndex}`);

        return result;
      } catch (error) {
        console.error("Phase 2+3: Enhanced staff creation failed:", error);

        // Store for conflict resolution if needed
        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      currentMonthIndex,
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  /**
   * Enhanced update staff with Phase 2 features
   */
  const updateStaffEnhanced = useCallback(
    async (staffId, updatedData) => {
      const changeMetadata = {
        type: "staff_update",
        staffId,
        staffData: updatedData,
        period: currentMonthIndex,
        timestamp: new Date().toISOString(),
        operation: "update",
      };

      try {
        // Try offline-capable update first
        if (enableOfflineSupport) {
          const success = await offlineHook.updateStaffOffline(
            staffId,
            updatedData,
            (id, data) => realtimeHook.updateStaff(id, data),
          );

          if (success) {
            // Invalidate relevant cache entries
            await cacheHook.invalidate(`staff_${staffId}`);
            await cacheHook.invalidate(`staff_${currentMonthIndex}`);

            console.log("✅ Phase 2+3: Enhanced staff update completed");
            return true;
          }
        }

        // Fallback to direct real-time update
        realtimeHook.updateStaff(staffId, updatedData);

        // Update cache
        await cacheHook.setCached(`staff_${staffId}`, {
          staffId,
          ...updatedData,
          updatedAt: new Date().toISOString(),
        });

        return true;
      } catch (error) {
        console.error("Phase 2+3: Enhanced staff update failed:", error);

        // Store for conflict resolution if needed
        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      currentMonthIndex,
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  /**
   * Enhanced delete staff with Phase 2 features
   */
  const deleteStaffEnhanced = useCallback(
    async (staffId) => {
      const changeMetadata = {
        type: "staff_delete",
        staffId,
        period: currentMonthIndex,
        timestamp: new Date().toISOString(),
        operation: "delete",
      };

      try {
        // Try offline-capable delete first
        if (enableOfflineSupport) {
          const success = await offlineHook.queueOperation({
            type: OPERATION_TYPES.DELETE_STAFF,
            staffId,
            payload: {
              deleteFunction: () => realtimeHook.deleteStaff(staffId),
            },
          });

          if (success) {
            // Invalidate relevant cache entries
            await cacheHook.invalidate(`staff_${staffId}`);
            await cacheHook.invalidate(`staff_${currentMonthIndex}`);

            console.log("✅ Phase 2+3: Enhanced staff deletion completed");
            realtimeHook.deleteStaff(staffId);
            return;
          }
        }

        // Fallback to direct real-time delete
        realtimeHook.deleteStaff(staffId);

        // Remove from cache
        await cacheHook.invalidate(`staff_${staffId}`);
        await cacheHook.invalidate(`staff_${currentMonthIndex}`);
      } catch (error) {
        console.error("Phase 2+3: Enhanced staff deletion failed:", error);

        // Store for conflict resolution if needed
        if (enableConflictResolution && error.isConflict) {
          await conflictHook.handleConflict(changeMetadata, error.remoteChange);
        }

        throw error;
      }
    },
    [
      currentMonthIndex,
      enableOfflineSupport,
      enableConflictResolution,
      offlineHook,
      cacheHook,
      conflictHook,
      realtimeHook,
    ],
  );

  /**
   * Enhanced staff loading with advanced caching
   */
  const loadStaffEnhanced = useCallback(
    async (period = currentMonthIndex) => {
      const cacheKey = `staff_${period}`;

      try {
        // Try cache first, then fallback to real-time loading
        const cachedData = await cacheHook.getCached(
          cacheKey,
          async () => {
            console.log(
              `🔄 Phase 2+3: Cache miss, loading from real-time source for period ${period}`,
            );
            return realtimeHook.staffMembers; // Current staff data
          },
          60, // 1 hour cache TTL
        );

        return cachedData;
      } catch (error) {
        console.error(
          `Phase 2+3: Enhanced staff loading failed for period ${period}:`,
          error,
        );

        // Try offline data as last resort
        if (enableOfflineSupport) {
          const offlineData = await cacheHook.getCached(
            `offline_staff_${period}`,
          );
          if (offlineData) {
            console.log("📱 Phase 2+3: Using offline staff data");
            return offlineData;
          }
        }

        throw error;
      }
    },
    [currentMonthIndex, cacheHook, realtimeHook, enableOfflineSupport],
  );

  /**
   * Get enhanced performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    const metrics = {
      phase3: {
        isConnected: realtimeHook.isConnected,
        isSaving: realtimeHook.isSaving,
        isLoading: realtimeHook.isLoading,
        staffCount: realtimeHook.staffMembers.length,
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

  // Enhanced connection status - prioritize actual Supabase connectivity
  const connectionStatus = useMemo(() => {
    if (realtimeHook.isSaving) return "saving";
    if (realtimeHook.isLoading) return "loading";
    if (enableOfflineSupport && offlineHook.isSyncing) return "syncing";
    if (enableConflictResolution && conflictHook.activeConflicts.length > 0)
      return "conflicts";
    // Only consider offline if both Supabase is disconnected AND browser is offline
    if (
      !realtimeHook.isConnected &&
      enableOfflineSupport &&
      !offlineHook.isOnline
    )
      return "offline_mode";
    // If Supabase is connected, we're considered online regardless of navigator.onLine
    if (realtimeHook.isConnected) return "connected";
    return "disconnected";
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
    staffMembers: realtimeHook.staffMembers,

    // Enhanced operations
    addStaff: addStaffEnhanced,
    updateStaff: updateStaffEnhanced,
    deleteStaff: deleteStaffEnhanced,
    editStaffName: realtimeHook.editStaffName,
    reorderStaff: realtimeHook.reorderStaff,
    createNewStaff: (staffData) =>
      addStaffEnhanced({
        ...staffData,
        id: crypto.randomUUID(),
      }),
    loadStaff: loadStaffEnhanced,

    // Phase 3 Status
    isConnected: realtimeHook.isConnected,
    isLoading: realtimeHook.isLoading,
    isSaving: realtimeHook.isSaving,
    error: realtimeHook.error,

    // Phase 2 Features
    cache: enableAdvancedCache ? cacheHook : null,
    offline: enableOfflineSupport ? offlineHook : null,
    conflicts: enableConflictResolution ? conflictHook : null,

    // Enhanced Status
    connectionStatus,
    isEnhanced: true,
    phase: "Phase 2+3: Enhanced Real-time Staff Management",

    // Enhanced Metrics
    getPerformanceMetrics,

    // Feature flags
    features: {
      advancedCache: enableAdvancedCache,
      offlineSupport: enableOfflineSupport,
      conflictResolution: enableConflictResolution,
    },
  };
};

export default useStaffManagementEnhanced;
