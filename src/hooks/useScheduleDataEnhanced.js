/**
 * Enhanced Schedule Data Hook - Phase 2 Integration
 * Combines Phase 1 real-time with Phase 2 advanced features
 */

import { useScheduleDataRealtime } from './useScheduleDataRealtime';
import { useAdvancedCache } from './useAdvancedCache';
import { useOfflineSupport, OPERATION_TYPES } from './useOfflineSupport';
import { useConflictResolver, RESOLUTION_STRATEGIES } from '../utils/conflictResolver';
import { useCallback, useEffect, useMemo } from 'react';

export const useScheduleDataEnhanced = (currentMonthIndex, options = {}) => {
  const {
    enableAdvancedCache = true,
    enableOfflineSupport = true,
    enableConflictResolution = true,
    cacheOptions = {},
    offlineOptions = {},
    conflictOptions = {
      defaultStrategy: RESOLUTION_STRATEGIES.AUTOMATIC_MERGE
    }
  } = options;

  // Phase 1: Real-time data management
  const realtimeHook = useScheduleDataRealtime(currentMonthIndex);
  
  // Phase 2: Advanced features
  const cacheHook = useAdvancedCache({
    enableMemoryCache: enableAdvancedCache,
    enableIndexedDBCache: enableAdvancedCache,
    ...cacheOptions
  });

  const offlineHook = useOfflineSupport({
    enableOfflineMode: enableOfflineSupport,
    ...offlineOptions,
    onSyncSuccess: (synced, failed) => {
      console.log(`📊 Phase 2: Synced ${synced} operations, ${failed} failed`);
      // Invalidate cache after successful sync
      cacheHook.invalidatePattern(`schedule_${currentMonthIndex}`);
    },
    onOfflineChange: (isOffline) => {
      console.log(`📱 Phase 2: ${isOffline ? 'Offline' : 'Online'} mode activated`);
    }
  });

  const conflictHook = useConflictResolver({
    enableUserChoice: enableConflictResolution,
    ...conflictOptions
  });

  /**
   * Enhanced update shift with Phase 2 features
   */
  const updateShiftEnhanced = useCallback(async (staffId, dateKey, shiftValue) => {
    const changeMetadata = {
      type: 'shift_update',
      staffId,
      dateKey,
      value: shiftValue,
      period: currentMonthIndex,
      timestamp: new Date().toISOString(),
      operation: 'update'
    };

    try {
      // Try offline-capable update first
      if (enableOfflineSupport) {
        const success = await offlineHook.updateShiftOffline(
          staffId,
          dateKey, 
          shiftValue,
          currentMonthIndex,
          realtimeHook.updateShift
        );

        if (success) {
          // Invalidate relevant cache entries
          await cacheHook.invalidate(`shift_${staffId}_${dateKey}`);
          await cacheHook.invalidate(`schedule_${currentMonthIndex}`);
          
          console.log('✅ Phase 2: Enhanced shift update completed');
          return true;
        }
      }

      // Fallback to direct real-time update
      await realtimeHook.updateShift(staffId, dateKey, shiftValue);
      
      // Update cache
      await cacheHook.setCached(`shift_${staffId}_${dateKey}`, {
        staffId,
        dateKey,
        value: shiftValue,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Phase 2: Enhanced shift update failed:', error);
      
      // Store for conflict resolution if needed
      if (enableConflictResolution && error.isConflict) {
        await conflictHook.handleConflict(changeMetadata, error.remoteChange);
      }
      
      throw error;
    }
  }, [
    currentMonthIndex,
    enableOfflineSupport,
    enableConflictResolution,
    offlineHook,
    cacheHook,
    conflictHook,
    realtimeHook
  ]);

  /**
   * Enhanced schedule loading with advanced caching
   */
  const loadScheduleEnhanced = useCallback(async (period = currentMonthIndex) => {
    const cacheKey = `schedule_${period}`;

    try {
      // Try cache first, then fallback to real-time loading
      const cachedData = await cacheHook.getCached(
        cacheKey,
        async () => {
          // This will use the real-time loading mechanism
          console.log(`🔄 Phase 2: Cache miss, loading from real-time source for period ${period}`);
          return realtimeHook.schedule; // Current schedule data
        },
        60 // 1 hour cache TTL
      );

      // Preload adjacent periods in background
      await cacheHook.preloadAdjacent(period, async (adjacentPeriod) => {
        return realtimeHook.schedule; // Would load adjacent period data
      });

      return cachedData;
    } catch (error) {
      console.error(`Phase 2: Enhanced schedule loading failed for period ${period}:`, error);
      
      // Try offline data as last resort
      if (enableOfflineSupport) {
        const offlineData = await offlineHook.getOfflineSchedule(period);
        if (offlineData) {
          console.log('📱 Phase 2: Using offline schedule data');
          return offlineData;
        }
      }
      
      throw error;
    }
  }, [currentMonthIndex, cacheHook, realtimeHook, offlineHook, enableOfflineSupport]);

  /**
   * Enhanced schedule saving with conflict resolution
   */
  const saveScheduleEnhanced = useCallback(async (scheduleData, period = currentMonthIndex) => {
    try {
      // Store offline backup first
      if (enableOfflineSupport) {
        await offlineHook.storeOfflineSchedule(period, scheduleData);
      }

      // Save via real-time mechanism
      await realtimeHook.scheduleAutoSave();

      // Update cache
      await cacheHook.setCached(`schedule_${period}`, scheduleData, 60);

      console.log('✅ Phase 2: Enhanced schedule save completed');
      return true;
    } catch (error) {
      console.error('Phase 2: Enhanced schedule save failed:', error);
      
      // Queue for offline sync if save failed
      if (enableOfflineSupport) {
        await offlineHook.queueOperation({
          type: OPERATION_TYPES.BULK_UPDATE,
          period,
          payload: {
            bulkFunction: async () => realtimeHook.scheduleAutoSave(),
            scheduleData
          }
        });
      }
      
      throw error;
    }
  }, [currentMonthIndex, realtimeHook, cacheHook, offlineHook, enableOfflineSupport]);

  /**
   * Get enhanced performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    const metrics = {
      phase1: {
        isConnected: realtimeHook.isConnected,
        isSaving: realtimeHook.isSaving,
        isLoading: realtimeHook.isLoading,
        scheduleId: realtimeHook.currentScheduleId
      },
      phase2: {
        cache: enableAdvancedCache ? cacheHook.getCacheMetrics() : null,
        offline: enableOfflineSupport ? {
          isOnline: offlineHook.isOnline,
          pendingOperations: offlineHook.pendingOperations.length,
          syncStats: offlineHook.syncStats
        } : null,
        conflicts: enableConflictResolution ? {
          activeConflicts: conflictHook.activeConflicts.length,
          conflictStats: conflictHook.conflictStats
        } : null
      }
    };

    return metrics;
  }, [
    realtimeHook,
    cacheHook,
    offlineHook,
    conflictHook,
    enableAdvancedCache,
    enableOfflineSupport,
    enableConflictResolution
  ]);

  // Auto-sync pending operations when back online
  useEffect(() => {
    if (enableOfflineSupport && offlineHook.isOnline && offlineHook.pendingOperations.length > 0) {
      offlineHook.syncPendingOperations();
    }
  }, [offlineHook.isOnline, offlineHook.pendingOperations.length, offlineHook.syncPendingOperations, enableOfflineSupport]);

  // Enhanced connection status
  const connectionStatus = useMemo(() => {
    if (!realtimeHook.isConnected) return 'disconnected';
    if (realtimeHook.isSaving) return 'saving';
    if (realtimeHook.isLoading) return 'loading';
    if (enableOfflineSupport && !offlineHook.isOnline) return 'offline_mode';
    if (enableOfflineSupport && offlineHook.isSyncing) return 'syncing';
    if (enableConflictResolution && conflictHook.activeConflicts.length > 0) return 'conflicts';
    return 'connected';
  }, [
    realtimeHook.isConnected,
    realtimeHook.isSaving,
    realtimeHook.isLoading,
    offlineHook?.isOnline,
    offlineHook?.isSyncing,
    conflictHook?.activeConflicts?.length,
    enableOfflineSupport,
    enableConflictResolution
  ]);

  return {
    // Phase 1 (Real-time) - Enhanced versions
    schedule: realtimeHook.schedule,
    dateRange: realtimeHook.dateRange,
    staffMembersByMonth: realtimeHook.staffMembersByMonth,
    setStaffMembersByMonth: realtimeHook.setStaffMembersByMonth,
    currentScheduleId: realtimeHook.currentScheduleId,
    setCurrentScheduleId: realtimeHook.setCurrentScheduleId,
    
    // Enhanced operations
    updateShift: updateShiftEnhanced,
    updateSchedule: realtimeHook.updateSchedule,
    scheduleAutoSave: saveScheduleEnhanced,
    loadSchedule: loadScheduleEnhanced,

    // Phase 1 Status
    isConnected: realtimeHook.isConnected,
    isLoading: realtimeHook.isLoading,
    isSaving: realtimeHook.isSaving,
    error: realtimeHook.error,

    // Offline queue state (from Phase 1 Realtime hook)
    offlineQueue: realtimeHook.offlineQueue,
    pendingCells: realtimeHook.pendingCells,
    hasPendingChanges: realtimeHook.hasPendingChanges,
    retryQueuedChanges: realtimeHook.retryQueuedChanges,

    // Phase 2 Features
    cache: enableAdvancedCache ? cacheHook : null,
    offline: enableOfflineSupport ? offlineHook : null,
    conflicts: enableConflictResolution ? conflictHook : null,

    // Enhanced Status
    connectionStatus,
    isEnhanced: true,
    phase: 'Phase 2: Enhanced Real-time',

    // Enhanced Metrics
    getPerformanceMetrics,

    // Feature flags
    features: {
      advancedCache: enableAdvancedCache,
      offlineSupport: enableOfflineSupport,
      conflictResolution: enableConflictResolution
    }
  };
};

export default useScheduleDataEnhanced;