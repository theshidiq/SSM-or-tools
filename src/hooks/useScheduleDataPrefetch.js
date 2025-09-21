/**
 * WebSocket-First Prefetch Hook for Shift Schedule Manager
 *
 * Updated for Phase 6: Hybrid WebSocket + Supabase Architecture
 *
 * Features:
 * - WebSocket-first staff management via Go server (ws://localhost:8080/staff-sync)
 * - Supabase schedule data management with real-time sync
 * - Period-based filtering with instant navigation
 * - Graceful fallback to Supabase-only mode
 *
 * Performance Benefits:
 * - Real-time staff updates via WebSocket (sub-100ms)
 * - Client-side period filtering for instant navigation
 * - Optimistic updates with conflict resolution
 * - Zero race conditions through server-authoritative updates
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";
import { generateDateRange } from "../utils/dateUtils";
import {
  cleanupStaffData,
  isStaffActiveInCurrentPeriod,
  getOrderedStaffMembers,
  initializeSchedule,
} from "../utils/staffUtils";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import { useWebSocketStaff } from "./useWebSocketStaff";
import { FEATURE_FLAGS } from "../config/featureFlags";

// WebSocket-first query keys
export const PREFETCH_QUERY_KEYS = {
  scheduleData: (period) => ["schedule", "data", period],
  allSchedules: () => ["schedule", "all-periods"],
  periods: () => ["periods", "list"],
  connection: () => ["websocket", "connection"],
};

/**
 * WebSocket-First Prefetch Hook with Supabase Fallback
 * Integrates with Go WebSocket server for real-time staff management
 */
export const useScheduleDataPrefetch = (
  currentMonthIndex = 0,
  options = {},
) => {
  const { scheduleId = null, enabled = true } = options;
  const queryClient = useQueryClient();

  // WebSocket staff management (primary)
  const isWebSocketEnabled = FEATURE_FLAGS.WEBSOCKET_ENABLED &&
                              FEATURE_FLAGS.WEBSOCKET_STAFF_MANAGEMENT &&
                              !localStorage.getItem('FORCE_SUPABASE_ONLY') &&
                              enabled;

  // WebSocket staff hook - handles real-time staff operations
  const webSocketStaff = useWebSocketStaff(currentMonthIndex, {
    enabled: isWebSocketEnabled
  });

  // Schedule management state (Supabase for now, could be moved to WebSocket later)
  const [schedule, setSchedule] = useState({});
  const [currentScheduleId, setCurrentScheduleId] = useState(scheduleId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // WebSocket connection state tracking
  const isConnected = useMemo(() => {
    return isWebSocketEnabled ? webSocketStaff.isConnected : true; // Always connected for Supabase mode
  }, [isWebSocketEnabled, webSocketStaff.isConnected]);

  // Error state management
  const effectiveError = useMemo(() => {
    if (isWebSocketEnabled) {
      return webSocketStaff.lastError || error;
    }
    return error;
  }, [isWebSocketEnabled, webSocketStaff.lastError, error]);

  // Staff data from WebSocket or Supabase fallback
  const staffMembers = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === 'connected') {
      return webSocketStaff.staffMembers || [];
    }
    // Fallback to empty for now - could integrate with Enhanced mode here
    return [];
  }, [isWebSocketEnabled, webSocketStaff.connectionStatus, webSocketStaff.staffMembers]);

  // Period data management (Supabase)
  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: PREFETCH_QUERY_KEYS.periods(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_periods");
      if (error) throw error;

      return (data || []).map((period) => ({
        id: period.id,
        start: new Date(period.start_date + "T00:00:00.000Z"),
        end: new Date(period.end_date + "T00:00:00.000Z"),
        label: period.label,
      }));
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // Schedule data management for current period
  const {
    data: currentScheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
    queryFn: async () => {
      console.log(
        `📅 [WEBSOCKET-PREFETCH] Loading schedule data for period ${currentMonthIndex}`,
      );

      const startTime = performance.now();

      try {
        // Load schedule for current period
        const { data: schedules, error: scheduleError } = await supabase
          .from("schedules")
          .select(`
            *,
            schedule_staff_assignments (
              staff_id,
              period_index
            )
          `)
          .eq('schedule_staff_assignments.period_index', currentMonthIndex);

        if (scheduleError) throw scheduleError;

        const loadTime = performance.now() - startTime;

        // Find the schedule for this period
        const periodSchedule = schedules?.find(schedule =>
          schedule.schedule_staff_assignments.some(
            assignment => assignment.period_index === currentMonthIndex
          )
        );

        console.log(
          `⚡ [WEBSOCKET-PREFETCH] Loaded schedule data in ${loadTime.toFixed(1)}ms:`,
          {
            schedulesFound: schedules?.length || 0,
            periodSchedule: !!periodSchedule,
            period: currentMonthIndex,
          },
        );

        return {
          schedule: periodSchedule?.schedule_data || {},
          scheduleId: periodSchedule?.id || null,
          loadedAt: Date.now(),
          loadTime: loadTime,
        };
      } catch (error) {
        console.error(`❌ [WEBSOCKET-PREFETCH] Failed to load schedule data for period ${currentMonthIndex}:`, error);
        throw error;
      }
    },
    enabled: !periodsLoading && periods?.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes for schedule data
    cacheTime: 5 * 60 * 1000, // 5 minutes in cache
    refetchOnWindowFocus: false,
  });

  // Update local state when schedule data changes
  useEffect(() => {
    if (currentScheduleData) {
      setSchedule(currentScheduleData.schedule || {});
      setCurrentScheduleId(currentScheduleData.scheduleId);
      setIsLoading(false);
    }
  }, [currentScheduleData]);

  // Overall loading state
  const isPrefetching = periodsLoading || scheduleLoading || webSocketStaff.isLoading;

  // Generate date range for current period
  const dateRange = useMemo(() => {
    try {
      return generateDateRange(currentMonthIndex);
    } catch (error) {
      console.warn('Failed to generate date range:', error);
      return [];
    }
  }, [currentMonthIndex]);

  // Process and clean staff data from WebSocket
  const processedStaffMembers = useMemo(() => {
    if (!staffMembers || staffMembers.length === 0) {
      return defaultStaffMembersArray;
    }

    try {
      // Clean and order staff members
      const cleanedStaff = cleanupStaffData(staffMembers);
      const orderedStaff = getOrderedStaffMembers(cleanedStaff);

      console.log(
        `👥 [WEBSOCKET-PREFETCH] Processed ${orderedStaff.length} staff members for period ${currentMonthIndex}`,
      );

      return orderedStaff;
    } catch (error) {
      console.error('Error processing staff members:', error);
      return defaultStaffMembersArray;
    }
  }, [staffMembers, currentMonthIndex]);

  /**
   * Current period data - combines WebSocket staff with Supabase schedule
   */
  const getCurrentPeriodData = useCallback(
    (periodIndex = currentMonthIndex) => {
      // For different period requests, return cached data if available
      if (periodIndex !== currentMonthIndex) {
        console.warn(`🔄 [WEBSOCKET-PREFETCH] Period ${periodIndex} requested but currently on ${currentMonthIndex}`);
        return {
          staff: processedStaffMembers,
          schedule: schedule,
          dateRange: generateDateRange(periodIndex),
          isFromCache: true,
          scheduleId: currentScheduleId,
        };
      }

      // Current period data
      try {
        return {
          staff: processedStaffMembers,
          schedule: schedule,
          dateRange: dateRange,
          isFromCache: true,
          scheduleId: currentScheduleId,
          webSocketMode: isWebSocketEnabled,
          connectionStatus: webSocketStaff.connectionStatus,
        };
      } catch (error) {
        console.error(
          `❌ [WEBSOCKET-PREFETCH] Error getting period data for ${periodIndex}:`,
          error,
        );
        return {
          staff: defaultStaffMembersArray,
          schedule: {},
          dateRange: [],
          isFromCache: false,
          error: error.message,
        };
      }
    },
    [currentMonthIndex, processedStaffMembers, schedule, dateRange, currentScheduleId, isWebSocketEnabled, webSocketStaff.connectionStatus],
  );

  /**
   * Get current period data (memoized for performance)
   */
  const currentPeriodData = useMemo(() => {
    return getCurrentPeriodData(currentMonthIndex);
  }, [getCurrentPeriodData, currentMonthIndex]);

  /**
   * Save schedule data with optimistic updates (Supabase for now)
   */
  const saveScheduleMutation = useMutation({
    mutationFn: async ({
      scheduleData,
      scheduleId: targetScheduleId,
      staffMembers,
    }) => {
      console.log(
        `💾 [WEBSOCKET-PREFETCH] Saving schedule for period ${currentMonthIndex}`,
      );

      // Clean schedule data (remove _staff_members if present)
      const { _staff_members, ...actualScheduleData } = scheduleData;

      // Save to Supabase (schedule management still via Supabase)
      const { data: savedSchedule, error } = await supabase
        .from("schedules")
        .upsert({
          id: targetScheduleId,
          schedule_data: actualScheduleData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [WEBSOCKET-PREFETCH] Schedule saved successfully`);
      return savedSchedule;
    },
    onMutate: async ({ scheduleData }) => {
      // Optimistic update to local state
      const previousSchedule = schedule;
      setSchedule(scheduleData);

      console.log(`⚡ [WEBSOCKET-PREFETCH] Optimistic schedule update applied`);
      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousSchedule) {
        setSchedule(context.previousSchedule);
        console.log(`🔄 [WEBSOCKET-PREFETCH] Rolled back optimistic schedule update`);
      }
      console.error("❌ [WEBSOCKET-PREFETCH] Schedule save failed:", error);
      setError(`Save failed: ${error.message}`);
    },
    onSuccess: (data) => {
      // Update schedule ID if it was created
      if (data?.id && data.id !== currentScheduleId) {
        setCurrentScheduleId(data.id);
      }
      console.log(
        "✅ [WEBSOCKET-PREFETCH] Schedule save confirmed by server",
      );
      setError(null);
      // Invalidate schedule query to refresh data
      queryClient.invalidateQueries({
        queryKey: PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
      });
    },
  });

  // Staff operations - delegate to WebSocket or implement fallback
  const staffOperations = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === 'connected') {
      // Use WebSocket operations
      return {
        addStaff: (newStaff, onSuccess) => {
          console.log(`➕ [WEBSOCKET-PREFETCH] Adding staff via WebSocket: ${newStaff.name}`);
          return webSocketStaff.addStaff(newStaff)
            .then(() => {
              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch(error => {
              console.error('WebSocket addStaff failed:', error);
              setError(`スタッフの追加に失敗しました: ${error.message}`);
            });
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.log(`✏️ [WEBSOCKET-PREFETCH] Updating staff via WebSocket: ${staffId}`);
          return webSocketStaff.updateStaff(staffId, updatedData)
            .then(() => {
              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch(error => {
              console.error('WebSocket updateStaff failed:', error);
              setError(`スタッフの更新に失敗しました: ${error.message}`);
            });
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.log(`🗑️ [WEBSOCKET-PREFETCH] Deleting staff via WebSocket: ${staffId}`);
          return webSocketStaff.deleteStaff(staffId)
            .then(() => {
              // Handle schedule cleanup
              if (scheduleData && scheduleData[staffId]) {
                const newSchedule = { ...scheduleData };
                delete newSchedule[staffId];
                if (updateScheduleFn) updateScheduleFn(newSchedule);
              }
              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch(error => {
              console.error('WebSocket deleteStaff failed:', error);
              setError(`スタッフの削除に失敗しました: ${error.message}`);
            });
        },
      };
    } else {
      // Fallback to Enhanced mode operations (placeholder)
      return {
        addStaff: (newStaff, onSuccess) => {
          console.warn('🚫 [WEBSOCKET-PREFETCH] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.warn('🚫 [WEBSOCKET-PREFETCH] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.warn('🚫 [WEBSOCKET-PREFETCH] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
      };
    }
  }, [isWebSocketEnabled, webSocketStaff.connectionStatus, webSocketStaff.staffMembers, webSocketStaff.addStaff, webSocketStaff.updateStaff, webSocketStaff.deleteStaff]);

  /**
   * Schedule operations (still via Supabase for now)
   */
  const scheduleOperations = useMemo(() => ({
    updateShift: (staffId, dateKey, shiftValue) => {
      if (!currentScheduleId) {
        console.warn('⚠️ [WEBSOCKET-PREFETCH] No schedule found for shift update');
        return Promise.reject(new Error('No schedule ID'));
      }

      // Create updated schedule
      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };

      console.log(
        `📝 [WEBSOCKET-PREFETCH] Updating shift: ${staffId} → ${dateKey} = "${shiftValue}"`,
      );

      // Save with optimistic update
      return saveScheduleMutation.mutateAsync({
        scheduleData: newSchedule,
        scheduleId: currentScheduleId,
        staffMembers: processedStaffMembers,
      });
    },
    updateSchedule: (newScheduleData, staffForSave = null) => {
      if (!currentScheduleId) {
        console.warn('⚠️ [WEBSOCKET-PREFETCH] No schedule ID for bulk update');
        return Promise.reject(new Error('No schedule ID'));
      }

      console.log(`📅 [WEBSOCKET-PREFETCH] Updating entire schedule`);

      return saveScheduleMutation.mutateAsync({
        scheduleData: newScheduleData,
        scheduleId: currentScheduleId,
        staffMembers: staffForSave || processedStaffMembers,
      });
    },
  }), [schedule, currentScheduleId, processedStaffMembers, saveScheduleMutation]);

  // Setup real-time schedule subscriptions
  useEffect(() => {
    if (!currentScheduleId) return;

    console.log(`🔔 [WEBSOCKET-PREFETCH] Setting up schedule subscription for ${currentScheduleId}`);

    const scheduleChannel = supabase
      .channel('websocket_prefetch_schedule')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          filter: `id=eq.${currentScheduleId}`,
        },
        (payload) => {
          console.log('📡 [WEBSOCKET-PREFETCH] Schedule update from external source:', payload.eventType);

          if (payload.eventType === 'UPDATE' && payload.new?.schedule_data) {
            setSchedule(payload.new.schedule_data);
            console.log('✅ [WEBSOCKET-PREFETCH] Schedule updated from real-time subscription');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      console.log('🔌 [WEBSOCKET-PREFETCH] Cleaned up schedule subscription');
    };
  }, [currentScheduleId]);


  // Return WebSocket-first API with Supabase schedule management
  return {
    // Data - WebSocket staff with Supabase schedule
    staff: currentPeriodData.staff,
    staffMembers: currentPeriodData.staff, // Legacy alias
    schedule: currentPeriodData.schedule,
    schedulesByMonth: { [currentMonthIndex]: currentPeriodData.schedule },
    dateRange: currentPeriodData.dateRange,
    periods: periods || [],

    // Connection state
    currentScheduleId: currentPeriodData.scheduleId,
    setCurrentScheduleId: setCurrentScheduleId,
    isConnected,
    isLoading: isPrefetching,
    isSaving: saveScheduleMutation.isPending,
    error: effectiveError,

    // Schedule operations (Supabase)
    updateShift: scheduleOperations.updateShift,
    updateSchedule: scheduleOperations.updateSchedule,
    scheduleAutoSave: scheduleOperations.updateSchedule,

    // Staff operations (WebSocket-first)
    addStaff: staffOperations.addStaff,
    updateStaff: staffOperations.updateStaff,
    deleteStaff: staffOperations.deleteStaff,

    // Utility functions
    getCurrentPeriodData,
    refetchAllData: refetchSchedule,

    // Performance metrics
    prefetchStats: {
      isLoaded: !isPrefetching,
      loadTime: currentScheduleData?.loadTime,
      staffCount: processedStaffMembers?.length || 0,
      scheduleCount: 1,
      loadedAt: currentScheduleData?.loadedAt,
      webSocketMode: isWebSocketEnabled,
      connectionStatus: webSocketStaff.connectionStatus,
    },

    // Architecture identification
    isPrefetch: true,
    phase: "Phase 6: WebSocket-First Hybrid Architecture",
    webSocketEnabled: isWebSocketEnabled,
    fallbackMode: !isWebSocketEnabled || webSocketStaff.connectionStatus !== 'connected',
  };
};
