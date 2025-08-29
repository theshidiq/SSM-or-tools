/**
 * Offline Support Hook for Phase 2
 * Handles offline operations, queueing, and synchronization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { indexedDBManager } from '../utils/indexedDBManager';
import { useAdvancedCache } from './useAdvancedCache';

// Operation types for offline queue
export const OPERATION_TYPES = {
  UPDATE_SHIFT: 'update_shift',
  UPDATE_STAFF: 'update_staff',
  CREATE_STAFF: 'create_staff',
  DELETE_STAFF: 'delete_staff',
  BULK_UPDATE: 'bulk_update'
};

export const useOfflineSupport = (options = {}) => {
  const {
    syncInterval = 30000, // 30 seconds
    maxRetries = 3,
    retryDelay = 5000, // 5 seconds
    enableOfflineMode = true,
    onSyncSuccess,
    onSyncError,
    onOfflineChange
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({
    lastSyncTime: null,
    successfulSyncs: 0,
    failedSyncs: 0,
    pendingCount: 0
  });

  const syncIntervalRef = useRef(null);
  const { getCached, setCached, invalidate } = useAdvancedCache();

  /**
   * Check online/offline status
   */
  const checkOnlineStatus = useCallback(() => {
    return navigator.onLine && window.navigator.connection?.effectiveType !== 'none';
  }, []);

  /**
   * Handle online status changes
   */
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Back online - triggering sync...');
      onOfflineChange?.(false);
      // Trigger immediate sync when coming back online
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 Gone offline - entering offline mode');
      onOfflineChange?.(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOfflineChange]);

  /**
   * Load pending operations from IndexedDB
   */
  const loadPendingOperations = useCallback(async () => {
    try {
      const operations = await indexedDBManager.getPendingOperations();
      setPendingOperations(operations);
      setSyncStats(prev => ({ ...prev, pendingCount: operations.length }));
      return operations;
    } catch (error) {
      console.error('Failed to load pending operations:', error);
      return [];
    }
  }, []);

  /**
   * Add operation to offline queue
   */
  const queueOperation = useCallback(async (operation) => {
    if (!enableOfflineMode) return false;

    try {
      const queuedOp = await indexedDBManager.addPendingOperation({
        ...operation,
        retryCount: 0,
        maxRetries,
        createdAt: new Date().toISOString()
      });

      setPendingOperations(prev => [...prev, queuedOp]);
      setSyncStats(prev => ({ 
        ...prev, 
        pendingCount: prev.pendingCount + 1 
      }));

      console.log(`📝 Queued ${operation.type} operation:`, operation);

      // Try immediate sync if online
      if (isOnline) {
        setTimeout(() => syncPendingOperations(), 100);
      }

      return queuedOp;
    } catch (error) {
      console.error('Failed to queue operation:', error);
      return null;
    }
  }, [enableOfflineMode, maxRetries, isOnline]);

  /**
   * Execute a single operation
   */
  const executeOperation = useCallback(async (operation, supabaseClient) => {
    const { type, payload, staffId, period, dateKey, shiftValue } = operation;

    try {
      switch (type) {
        case OPERATION_TYPES.UPDATE_SHIFT:
          // Call the actual Supabase update function
          if (payload.updateFunction) {
            await payload.updateFunction(staffId, dateKey, shiftValue);
          }
          break;

        case OPERATION_TYPES.UPDATE_STAFF:
          // Update staff information
          if (payload.updateFunction) {
            await payload.updateFunction(staffId, payload.staffData);
          }
          break;

        case OPERATION_TYPES.CREATE_STAFF:
          // Create new staff member
          if (payload.createFunction) {
            await payload.createFunction(payload.staffData);
          }
          break;

        case OPERATION_TYPES.DELETE_STAFF:
          // Delete staff member
          if (payload.deleteFunction) {
            await payload.deleteFunction(staffId);
          }
          break;

        case OPERATION_TYPES.BULK_UPDATE:
          // Handle bulk operations
          if (payload.bulkFunction) {
            await payload.bulkFunction(payload.operations);
          }
          break;

        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Operation execution failed for ${type}:`, error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Sync all pending operations
   */
  const syncPendingOperations = useCallback(async (supabaseClient = null) => {
    if (!isOnline || isSyncing || pendingOperations.length === 0) {
      return { success: true, synced: 0, failed: 0 };
    }

    setIsSyncing(true);
    let syncedCount = 0;
    let failedCount = 0;

    try {
      console.log(`🔄 Syncing ${pendingOperations.length} pending operations...`);

      // Process operations in batches to avoid overwhelming the server
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < pendingOperations.length; i += batchSize) {
        batches.push(pendingOperations.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(async (operation) => {
            try {
              const result = await executeOperation(operation, supabaseClient);
              
              if (result.success) {
                // Remove from IndexedDB and local state
                await indexedDBManager.removePendingOperation(operation.id);
                setPendingOperations(prev => 
                  prev.filter(op => op.id !== operation.id)
                );
                syncedCount++;

                // Invalidate related cache entries
                await invalidate(`schedule_${operation.period || 'current'}`);
                
                console.log(`✅ Synced ${operation.type} operation`);
              } else {
                // Increment retry count
                operation.retryCount = (operation.retryCount || 0) + 1;
                
                if (operation.retryCount >= maxRetries) {
                  // Max retries reached, remove from queue
                  await indexedDBManager.removePendingOperation(operation.id);
                  setPendingOperations(prev => 
                    prev.filter(op => op.id !== operation.id)
                  );
                  console.error(`❌ Max retries reached for ${operation.type}`);
                } else {
                  console.warn(`⚠️ Retry ${operation.retryCount}/${maxRetries} for ${operation.type}`);
                }
                
                failedCount++;
              }
            } catch (error) {
              console.error(`Sync error for operation ${operation.id}:`, error);
              failedCount++;
            }
          })
        );

        // Small delay between batches
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update sync stats
      setSyncStats(prev => ({
        lastSyncTime: new Date().toISOString(),
        successfulSyncs: prev.successfulSyncs + (syncedCount > 0 ? 1 : 0),
        failedSyncs: prev.failedSyncs + (failedCount > 0 ? 1 : 0),
        pendingCount: pendingOperations.length - syncedCount
      }));

      if (syncedCount > 0 && onSyncSuccess) {
        onSyncSuccess(syncedCount, failedCount);
      }

      if (failedCount > 0 && onSyncError) {
        onSyncError(failedCount, syncedCount);
      }

      console.log(`📊 Sync complete: ${syncedCount} succeeded, ${failedCount} failed`);

      return { success: true, synced: syncedCount, failed: failedCount };

    } catch (error) {
      console.error('Sync process error:', error);
      setSyncStats(prev => ({
        ...prev,
        failedSyncs: prev.failedSyncs + 1
      }));
      
      if (onSyncError) {
        onSyncError(0, 0, error);
      }
      
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, pendingOperations, maxRetries, executeOperation, invalidate, onSyncSuccess, onSyncError]);

  /**
   * Offline-capable update shift operation
   */
  const updateShiftOffline = useCallback(async (staffId, dateKey, shiftValue, period, updateFunction) => {
    const operation = {
      type: OPERATION_TYPES.UPDATE_SHIFT,
      staffId,
      dateKey,
      shiftValue,
      period,
      payload: { updateFunction }
    };

    if (isOnline) {
      // Try immediate execution
      try {
        const result = await executeOperation(operation);
        if (result.success) {
          console.log('✅ Shift updated online');
          return true;
        }
      } catch (error) {
        console.warn('Online update failed, queuing for offline:', error);
      }
    }

    // Queue for offline sync
    const queued = await queueOperation(operation);
    return !!queued;
  }, [isOnline, executeOperation, queueOperation]);

  /**
   * Offline-capable staff update operation
   */
  const updateStaffOffline = useCallback(async (staffId, staffData, updateFunction) => {
    const operation = {
      type: OPERATION_TYPES.UPDATE_STAFF,
      staffId,
      payload: { staffData, updateFunction }
    };

    if (isOnline) {
      try {
        const result = await executeOperation(operation);
        if (result.success) {
          console.log('✅ Staff updated online');
          return true;
        }
      } catch (error) {
        console.warn('Online staff update failed, queuing for offline:', error);
      }
    }

    const queued = await queueOperation(operation);
    return !!queued;
  }, [isOnline, executeOperation, queueOperation]);

  /**
   * Get offline cache for schedule data
   */
  const getOfflineSchedule = useCallback(async (period) => {
    try {
      const cached = await getCached(`offline_schedule_${period}`);
      if (cached) {
        console.log(`📱 Retrieved offline schedule for period ${period}`);
        return cached;
      }
      return null;
    } catch (error) {
      console.error('Failed to get offline schedule:', error);
      return null;
    }
  }, [getCached]);

  /**
   * Store schedule data for offline access
   */
  const storeOfflineSchedule = useCallback(async (period, scheduleData) => {
    try {
      await setCached(`offline_schedule_${period}`, scheduleData, 24 * 60); // 24 hours
      await indexedDBManager.storeSchedule(scheduleData, period);
      console.log(`💾 Stored offline schedule for period ${period}`);
      return true;
    } catch (error) {
      console.error('Failed to store offline schedule:', error);
      return false;
    }
  }, [setCached]);

  /**
   * Start automatic sync interval
   */
  const startSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) return; // Already started

    syncIntervalRef.current = setInterval(() => {
      if (isOnline && pendingOperations.length > 0) {
        syncPendingOperations();
      }
    }, syncInterval);

    console.log(`⏰ Sync interval started (${syncInterval}ms)`);
  }, [isOnline, pendingOperations.length, syncInterval, syncPendingOperations]);

  /**
   * Stop automatic sync interval
   */
  const stopSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
      console.log('⏰ Sync interval stopped');
    }
  }, []);

  /**
   * Clear all pending operations (for debugging/reset)
   */
  const clearPendingOperations = useCallback(async () => {
    try {
      const operations = await indexedDBManager.getPendingOperations();
      for (const op of operations) {
        await indexedDBManager.removePendingOperation(op.id);
      }
      setPendingOperations([]);
      setSyncStats(prev => ({ ...prev, pendingCount: 0 }));
      console.log('🗑️ Cleared all pending operations');
    } catch (error) {
      console.error('Failed to clear pending operations:', error);
    }
  }, []);

  // Initialize offline support
  useEffect(() => {
    if (enableOfflineMode) {
      loadPendingOperations();
      startSyncInterval();
    }

    return () => {
      stopSyncInterval();
    };
  }, [enableOfflineMode, loadPendingOperations, startSyncInterval, stopSyncInterval]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0) {
      // Small delay to ensure connection is stable
      setTimeout(() => {
        syncPendingOperations();
      }, 2000);
    }
  }, [isOnline, pendingOperations.length, syncPendingOperations]);

  return {
    // Status
    isOnline,
    isOfflineMode: !isOnline,
    isSyncing,
    pendingOperations,
    syncStats,

    // Operations
    updateShiftOffline,
    updateStaffOffline,
    queueOperation,

    // Offline data access
    getOfflineSchedule,
    storeOfflineSchedule,

    // Sync management
    syncPendingOperations,
    startSyncInterval,
    stopSyncInterval,
    clearPendingOperations,

    // Utilities
    checkOnlineStatus,
    loadPendingOperations
  };
};

// Offline status indicator component
export const OfflineIndicator = ({ isOnline, pendingCount = 0 }) => {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
        isOnline 
          ? 'bg-blue-100 text-blue-800 border border-blue-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-blue-500' : 'bg-red-500 animate-pulse'
          }`} />
          <span>
            {isOnline 
              ? pendingCount > 0 
                ? `Syncing ${pendingCount} changes...`
                : 'Online'
              : 'Offline Mode'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default useOfflineSupport;