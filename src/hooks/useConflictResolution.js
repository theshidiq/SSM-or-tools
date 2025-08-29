import { useState, useCallback, useRef, useEffect } from "react";
import { conflictResolver } from "../utils/conflictResolver";

// Hook for managing conflict resolution in real-time collaboration
export const useConflictResolution = (options = {}) => {
  const [activeConflicts, setActiveConflicts] = useState([]);
  const [resolutionInProgress, setResolutionInProgress] = useState(false);
  const [resolutionHistory, setResolutionHistory] = useState([]);
  const [userPreferences, setUserPreferences] = useState({
    defaultStrategy: 'merge-changes',
    autoResolve: true,
    showNotifications: true,
    ...options.defaultPreferences
  });

  const conflictQueueRef = useRef([]);
  const activeResolutionRef = useRef(null);

  // Update conflict resolver preferences when user preferences change
  useEffect(() => {
    conflictResolver.setUserPreferences(userPreferences);
  }, [userPreferences]);

  // Main conflict resolution method
  const resolveConflict = useCallback(async (localData, remoteData, metadata = {}) => {
    if (resolutionInProgress && !metadata.force) {
      // Queue the conflict for later processing
      conflictQueueRef.current.push({ localData, remoteData, metadata });
      console.log('⏳ Conflict queued - resolution in progress');
      return null;
    }

    setResolutionInProgress(true);
    activeResolutionRef.current = { localData, remoteData, metadata };

    try {
      const resolution = await conflictResolver.detectAndResolve(
        localData,
        remoteData,
        {
          strategy: metadata.strategy || userPreferences.defaultStrategy,
          ...metadata
        }
      );

      // Update active conflicts
      if (!resolution.resolved && resolution.requiresUserInput) {
        const conflictId = `conflict-${Date.now()}`;
        const newConflict = {
          id: conflictId,
          timestamp: Date.now(),
          localData,
          remoteData,
          resolution,
          metadata
        };

        setActiveConflicts(prev => [...prev, newConflict]);

        if (userPreferences.showNotifications && options.onConflictDetected) {
          options.onConflictDetected(newConflict);
        }
      }

      // Store in history
      const historyEntry = {
        id: `history-${Date.now()}`,
        timestamp: Date.now(),
        conflicts: resolution.conflicts || [],
        strategy: resolution.strategy,
        resolved: resolution.resolved,
        autoResolved: resolution.mergedConflicts || 0,
        result: resolution.resolved ? 'success' : 'pending'
      };

      setResolutionHistory(prev => [...prev.slice(-49), historyEntry]); // Keep last 50 entries

      console.log(`🔧 Conflict resolution ${resolution.resolved ? 'completed' : 'requires user input'}:`, {
        strategy: resolution.strategy,
        conflicts: resolution.conflicts?.length || 0,
        autoResolved: resolution.mergedConflicts
      });

      return resolution;
    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      return {
        resolved: false,
        error: error.message,
        strategy: 'error',
        result: remoteData // Fallback to remote data
      };
    } finally {
      setResolutionInProgress(false);
      activeResolutionRef.current = null;

      // Process queued conflicts
      if (conflictQueueRef.current.length > 0) {
        const nextConflict = conflictQueueRef.current.shift();
        setTimeout(() => {
          resolveConflict(
            nextConflict.localData,
            nextConflict.remoteData,
            { ...nextConflict.metadata, fromQueue: true }
          );
        }, 100); // Small delay to prevent overwhelming
      }
    }
  }, [resolutionInProgress, userPreferences, options]);

  // Resolve user-prompted conflicts
  const resolveUserConflict = useCallback(async (conflictId, resolution) => {
    const conflict = activeConflicts.find(c => c.id === conflictId);
    if (!conflict) {
      console.warn('⚠️ Conflict not found:', conflictId);
      return null;
    }

    try {
      let resolvedData;
      
      switch (resolution.type) {
        case 'use-local':
          resolvedData = conflict.localData;
          break;
          
        case 'use-remote':
          resolvedData = conflict.remoteData;
          break;
          
        case 'use-merged':
          resolvedData = conflict.resolution.result;
          break;
          
        case 'manual':
          // Apply manual resolutions to the data
          resolvedData = await applyManualResolutions(
            conflict.localData,
            conflict.remoteData,
            resolution.resolutions
          );
          break;
          
        default:
          throw new Error(`Unknown resolution type: ${resolution.type}`);
      }

      // Remove from active conflicts
      setActiveConflicts(prev => prev.filter(c => c.id !== conflictId));

      // Update history
      const historyUpdate = {
        id: `resolved-${conflictId}`,
        timestamp: Date.now(),
        originalConflict: conflict.id,
        resolutionType: resolution.type,
        resolved: true,
        result: 'user-resolved'
      };

      setResolutionHistory(prev => [...prev, historyUpdate]);

      // Notify callback
      if (options.onConflictResolved) {
        options.onConflictResolved({
          conflictId,
          resolution: resolution.type,
          data: resolvedData
        });
      }

      console.log(`✅ User conflict resolved: ${resolution.type}`);
      return {
        resolved: true,
        strategy: 'user-resolved',
        result: resolvedData,
        conflictId
      };
    } catch (error) {
      console.error('❌ Failed to resolve user conflict:', error);
      return {
        resolved: false,
        error: error.message,
        conflictId
      };
    }
  }, [activeConflicts, options]);

  // Apply manual resolutions from user
  const applyManualResolutions = useCallback(async (localData, remoteData, resolutions) => {
    const result = JSON.parse(JSON.stringify(remoteData)); // Start with remote as base

    for (const [conflictKey, resolution] of Object.entries(resolutions)) {
      const [type, ...keyParts] = conflictKey.split(':');
      
      if (type === 'schedule') {
        const [staffId, dateKey] = keyParts;
        if (!result.schedule_data[staffId]) {
          result.schedule_data[staffId] = {};
        }
        
        switch (resolution.choice) {
          case 'local':
            result.schedule_data[staffId][dateKey] = localData.schedule_data[staffId]?.[dateKey];
            break;
          case 'remote':
            result.schedule_data[staffId][dateKey] = remoteData.schedule_data[staffId]?.[dateKey];
            break;
          case 'custom':
            result.schedule_data[staffId][dateKey] = resolution.value;
            break;
        }
      } else if (type === 'staff') {
        const [staffId, field] = keyParts;
        const staffIndex = result._staff_members.findIndex(s => s.id === staffId);
        
        if (staffIndex !== -1) {
          switch (resolution.choice) {
            case 'local':
              const localStaff = localData._staff_members.find(s => s.id === staffId);
              if (localStaff) {
                result._staff_members[staffIndex][field] = localStaff[field];
              }
              break;
            case 'remote':
              // Already has remote value
              break;
            case 'custom':
              result._staff_members[staffIndex][field] = resolution.value;
              break;
          }
        }
      }
    }

    return result;
  }, []);

  // Dismiss a conflict without resolving (use remote data)
  const dismissConflict = useCallback((conflictId) => {
    const conflict = activeConflicts.find(c => c.id === conflictId);
    if (conflict) {
      setActiveConflicts(prev => prev.filter(c => c.id !== conflictId));
      
      // Notify with remote data
      if (options.onConflictResolved) {
        options.onConflictResolved({
          conflictId,
          resolution: 'dismissed',
          data: conflict.remoteData
        });
      }

      console.log(`🚫 Conflict dismissed: ${conflictId}`);
    }
  }, [activeConflicts, options]);

  // Update user preferences
  const updatePreferences = useCallback((newPreferences) => {
    setUserPreferences(prev => ({ ...prev, ...newPreferences }));
  }, []);

  // Clear resolved conflicts from history
  const clearHistory = useCallback(() => {
    setResolutionHistory([]);
    conflictResolver.clearHistory();
  }, []);

  // Get conflict statistics
  const getStatistics = useCallback(() => {
    const stats = conflictResolver.getConflictStats();
    
    return {
      ...stats,
      active: activeConflicts.length,
      queued: conflictQueueRef.current.length,
      totalHistory: resolutionHistory.length,
      recentResolutions: resolutionHistory.slice(-10)
    };
  }, [activeConflicts, resolutionHistory]);

  // Check if there are unresolved conflicts
  const hasUnresolvedConflicts = useCallback(() => {
    return activeConflicts.length > 0 || conflictQueueRef.current.length > 0;
  }, [activeConflicts]);

  // Get conflict by ID
  const getConflict = useCallback((conflictId) => {
    return activeConflicts.find(c => c.id === conflictId);
  }, [activeConflicts]);

  // Preview merge result without applying
  const previewMerge = useCallback(async (localData, remoteData) => {
    try {
      const resolution = await conflictResolver.detectAndResolve(
        localData,
        remoteData,
        { strategy: 'merge-changes' }
      );
      
      return {
        success: true,
        result: resolution.result,
        conflicts: resolution.conflicts,
        autoResolved: resolution.mergedConflicts || 0,
        manualRequired: resolution.conflicts?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  return {
    // State
    activeConflicts,
    resolutionInProgress,
    resolutionHistory,
    userPreferences,

    // Main functions
    resolveConflict,
    resolveUserConflict,
    dismissConflict,

    // Utilities
    updatePreferences,
    clearHistory,
    getStatistics,
    hasUnresolvedConflicts,
    getConflict,
    previewMerge,

    // Queue info
    queueLength: conflictQueueRef.current.length,
    
    // Conflict resolver instance for advanced usage
    conflictResolver
  };
};

export default useConflictResolution;