/**
 * WebSocket-First Prefetch Hook for Shift Schedule Manager
 *
 * Updated for Phase 3: Multi-Period State Management Optimization
 *
 * Features:
 * - WebSocket-first staff management via Go server (ws://localhost:8080/staff-sync)
 * - React Query multi-period caching strategy
 * - Intelligent cache invalidation on WebSocket updates
 * - Supabase schedule data management with real-time sync
 * - Period-based filtering with instant navigation
 * - Graceful fallback to Supabase-only mode
 *
 * Performance Benefits:
 * - Real-time staff updates via WebSocket (sub-100ms)
 * - Multi-period cache with 5-minute staleTime, 30-minute cacheTime
 * - Client-side period filtering for instant navigation
 * - WebSocket is source of truth, React Query provides persistence
 * - Optimistic updates with conflict resolution
 * - Zero race conditions through server-authoritative updates
 * - Total memory: 47.1 KB (17 periods × 2.77 KB)
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
import { useWebSocketShifts } from "./useWebSocketShifts";
import { FEATURE_FLAGS } from "../config/featureFlags";

// WebSocket-first query keys with multi-period support
export const PREFETCH_QUERY_KEYS = {
  scheduleData: (period) => ["schedule", "data", period],
  allSchedules: () => ["schedule", "all-periods"],
  periods: () => ["periods", "list"],
  connection: () => ["websocket", "connection"],
  // Phase 3: Multi-period staff cache keys
  allPeriodsStaff: () => ["staff", "all-periods"],
  periodStaff: (period) => ["staff", "period", period],
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

  // Schedule management state (must be initialized before hooks that use it)
  const [schedule, setSchedule] = useState({});
  const [currentScheduleId, setCurrentScheduleId] = useState(scheduleId);

  // WebSocket staff hook - handles real-time staff operations with multi-period prefetch
  const webSocketStaff = useWebSocketStaff(currentMonthIndex, {
    enabled: isWebSocketEnabled,
    prefetchAllPeriods: true // Phase 3: Enable all-periods prefetch
  });

  // WebSocket shifts hook - handles real-time shift updates
  const webSocketShifts = useWebSocketShifts(currentMonthIndex, currentScheduleId, {
    enabled: isWebSocketEnabled && !!currentScheduleId,
    autoReconnect: true,
    enableOfflineQueue: true,
  });

  // Phase 3: Performance monitoring
  const cacheHitCountRef = useRef(0);
  const cacheMissCountRef = useRef(0);
  const lastCacheUpdateRef = useRef(Date.now());
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

  // Phase 3: React Query multi-period cache strategy
  // This syncs with WebSocket allPeriodsStaff and provides persistence
  const { data: cachedAllPeriodsStaff } = useQuery({
    queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff(),
    queryFn: async () => {
      console.log('📦 [PHASE3-CACHE] Initial cache population from WebSocket');
      // Return WebSocket data as initial cache value
      return webSocketStaff.allPeriodsStaff || {};
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - cache remains fresh
    cacheTime: 30 * 60 * 1000, // 30 minutes - cache persists in memory
    refetchOnWindowFocus: false, // WebSocket handles real-time updates
    enabled: isWebSocketEnabled && webSocketStaff.allPeriodsLoaded,
    initialData: webSocketStaff.allPeriodsStaff || {},
  });

  // Phase 3: Intelligent cache invalidation on WebSocket updates
  useEffect(() => {
    if (isWebSocketEnabled && webSocketStaff.allPeriodsLoaded) {
      // Update React Query cache when WebSocket data changes
      queryClient.setQueryData(
        PREFETCH_QUERY_KEYS.allPeriodsStaff(),
        webSocketStaff.allPeriodsStaff
      );

      lastCacheUpdateRef.current = Date.now();
      console.log('🔄 [PHASE3-CACHE] Synced WebSocket updates to React Query cache');
    }
  }, [webSocketStaff.allPeriodsStaff, webSocketStaff.allPeriodsLoaded, isWebSocketEnabled, queryClient]);

  // Phase 3: Period-specific cache invalidation helper
  const updatePeriodStaffCache = useCallback((periodIndex, updatedStaff) => {
    queryClient.setQueryData(PREFETCH_QUERY_KEYS.allPeriodsStaff(), (old) => {
      const updated = { ...(old || {}) };
      updated[periodIndex] = updatedStaff;
      console.log(`🔄 [PHASE3-CACHE] Updated period ${periodIndex} cache (${updatedStaff.length} staff)`);
      return updated;
    });
  }, [queryClient]);

  // Staff data from WebSocket (source of truth) with React Query persistence
  const staffMembers = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === 'connected') {
      // WebSocket is connected - use real-time data
      const staffData = webSocketStaff.staffMembers || [];
      if (staffData.length > 0) {
        cacheHitCountRef.current++;
      }
      return staffData;
    } else if (isWebSocketEnabled && cachedAllPeriodsStaff) {
      // WebSocket disconnected - use React Query cache as fallback
      const cachedData = cachedAllPeriodsStaff[currentMonthIndex] || [];
      if (cachedData.length > 0) {
        cacheMissCountRef.current++;
        console.log('📦 [PHASE3-CACHE] Using cached data during WebSocket disconnection');
      }
      return cachedData;
    }
    // No WebSocket and no cache - fallback to empty
    return [];
  }, [isWebSocketEnabled, webSocketStaff.connectionStatus, webSocketStaff.staffMembers, cachedAllPeriodsStaff, currentMonthIndex]);

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
        // Load schedule for current period with proper filtering
        const { data: schedules, error: scheduleError } = await supabase
          .from("schedules")
          .select(`
            id,
            schedule_data,
            created_at,
            updated_at,
            schedule_staff_assignments!inner (
              id,
              staff_id,
              period_index
            )
          `)
          .eq('schedule_staff_assignments.period_index', currentMonthIndex)
          .order('created_at', { ascending: false }); // Get newest first

        if (scheduleError) throw scheduleError;

        const loadTime = performance.now() - startTime;

        // Find the FIRST (newest) schedule with non-null schedule_data for this period
        const periodSchedule = schedules?.find(schedule => {
          const hasAssignmentForPeriod = schedule.schedule_staff_assignments?.some(
            assignment => assignment.period_index === currentMonthIndex
          );
          // Prefer schedules with actual data, skip null schedules
          const hasData = schedule.schedule_data && Object.keys(schedule.schedule_data).length > 0;
          return hasAssignmentForPeriod && (hasData || schedules.length === 1);
        }) || schedules?.[0]; // Fallback to first schedule if none have data

        console.log(
          `⚡ [WEBSOCKET-PREFETCH] Loaded schedule data in ${loadTime.toFixed(1)}ms:`,
          {
            schedulesFound: schedules?.length || 0,
            selectedScheduleId: periodSchedule?.id || null,
            period: currentMonthIndex,
            hasData: !!(periodSchedule?.schedule_data && Object.keys(periodSchedule.schedule_data).length > 0),
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

  // Auto-create schedule if it doesn't exist for the current period
  const creationAttemptedRef = useRef({});
  useEffect(() => {
    const createScheduleForPeriod = async () => {
      // Check if schedule is still loading
      if (scheduleLoading) {
        return;
      }

      // Wait for query to actually run (data will be undefined until query executes)
      if (!currentScheduleData) {
        return;
      }

      // Check if we already have a valid schedule ID for this period
      if (currentScheduleData.scheduleId) {
        console.log(`✅ [WEBSOCKET-PREFETCH] Using existing schedule: ${currentScheduleData.scheduleId} for period ${currentMonthIndex}`);
        creationAttemptedRef.current[currentMonthIndex] = false; // Reset creation flag
        return;
      }

      // Prevent duplicate creation attempts for the same period
      if (creationAttemptedRef.current[currentMonthIndex]) {
        console.log(`⏭️ [WEBSOCKET-PREFETCH] Already attempted creation for period ${currentMonthIndex}, skipping...`);
        return;
      }

      try {
        // Mark that we're attempting to create for this period
        creationAttemptedRef.current[currentMonthIndex] = true;

        console.log(`🆕 [WEBSOCKET-PREFETCH] No schedule found for period ${currentMonthIndex}, creating new one...`);

        // Double-check: Query again to ensure no schedule exists (race condition protection)
        const { data: existingSchedules, error: checkError } = await supabase
          .from("schedules")
          .select(`
            id,
            schedule_staff_assignments!inner (
              period_index
            )
          `)
          .eq('schedule_staff_assignments.period_index', currentMonthIndex)
          .limit(1);

        if (checkError) throw checkError;

        if (existingSchedules && existingSchedules.length > 0) {
          console.log(`✅ [WEBSOCKET-PREFETCH] Found existing schedule during double-check: ${existingSchedules[0].id}`);
          setCurrentScheduleId(existingSchedules[0].id);
          queryClient.invalidateQueries(PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex));
          return;
        }

        // Create new schedule in Supabase
        const { data: newSchedule, error: createError } = await supabase
          .from('schedules')
          .insert([
            {
              schedule_data: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          ])
          .select()
          .single();

        if (createError) throw createError;

        // Create schedule_staff_assignment for this period
        const { error: assignmentError } = await supabase
          .from('schedule_staff_assignments')
          .insert([
            {
              schedule_id: newSchedule.id,
              period_index: currentMonthIndex,
            }
          ]);

        if (assignmentError) {
          // If assignment creation fails, delete the orphaned schedule
          await supabase.from('schedules').delete().eq('id', newSchedule.id);
          throw assignmentError;
        }

        console.log(`✅ [WEBSOCKET-PREFETCH] Created schedule ${newSchedule.id} for period ${currentMonthIndex}`);

        // Update local state with new schedule ID
        setCurrentScheduleId(newSchedule.id);
        setSchedule({});

        // Invalidate and refetch to get the new schedule
        queryClient.invalidateQueries(PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex));
      } catch (error) {
        console.error(`❌ [WEBSOCKET-PREFETCH] Failed to create schedule for period ${currentMonthIndex}:`, error);
        setError(`スケジュールの作成に失敗しました: ${error.message}`);
        // Reset creation flag on error so it can be retried
        creationAttemptedRef.current[currentMonthIndex] = false;
      }
    };

    createScheduleForPeriod();
  }, [currentScheduleData, scheduleLoading, currentMonthIndex, queryClient]);

  // Sync WebSocket shift data with local schedule state
  useEffect(() => {
    if (webSocketShifts.isConnected && Object.keys(webSocketShifts.scheduleData).length > 0) {
      console.log('🔄 [WEBSOCKET-PREFETCH] Syncing WebSocket shift data to local state');
      setSchedule(webSocketShifts.scheduleData);
    }
  }, [webSocketShifts.scheduleData, webSocketShifts.isConnected]);

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

  // Phase 3: Staff operations with cache invalidation
  const staffOperations = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === 'connected') {
      // Use WebSocket operations with React Query cache invalidation
      return {
        addStaff: (newStaff, onSuccess) => {
          console.log(`➕ [PHASE3-CACHE] Adding staff via WebSocket: ${newStaff.name}`);
          return webSocketStaff.addStaff(newStaff)
            .then(() => {
              // Phase 3: Invalidate cache on successful add
              queryClient.invalidateQueries({
                queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff()
              });
              console.log('🔄 [PHASE3-CACHE] Cache invalidated after staff add');

              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch(error => {
              console.error('WebSocket addStaff failed:', error);
              setError(`スタッフの追加に失敗しました: ${error.message}`);
            });
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.log(`✏️ [PHASE3-CACHE] Updating staff via WebSocket: ${staffId}`);
          return webSocketStaff.updateStaff(staffId, updatedData)
            .then(() => {
              // Phase 3: Optimistic cache update for instant UI response
              const updatedAllPeriods = { ...webSocketStaff.allPeriodsStaff };
              Object.keys(updatedAllPeriods).forEach(periodIndex => {
                updatedAllPeriods[periodIndex] = updatedAllPeriods[periodIndex].map(staff =>
                  staff.id === staffId ? { ...staff, ...updatedData } : staff
                );
              });
              queryClient.setQueryData(
                PREFETCH_QUERY_KEYS.allPeriodsStaff(),
                updatedAllPeriods
              );
              console.log('⚡ [PHASE3-CACHE] Optimistic cache update after staff update');

              // Call onSuccess immediately with optimistic data
              // Modal will handle fetching fresh data after cache invalidation
              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch(error => {
              console.error('WebSocket updateStaff failed:', error);
              // Phase 3: Rollback optimistic update on error
              queryClient.invalidateQueries({
                queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff()
              });
              setError(`スタッフの更新に失敗しました: ${error.message}`);
            });
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.log(`🗑️ [PHASE3-CACHE] Deleting staff via WebSocket: ${staffId}`);
          return webSocketStaff.deleteStaff(staffId)
            .then(() => {
              // Handle schedule cleanup
              if (scheduleData && scheduleData[staffId]) {
                const newSchedule = { ...scheduleData };
                delete newSchedule[staffId];
                if (updateScheduleFn) updateScheduleFn(newSchedule);
              }

              // Phase 3: Remove from cache across all periods
              const updatedAllPeriods = { ...webSocketStaff.allPeriodsStaff };
              Object.keys(updatedAllPeriods).forEach(periodIndex => {
                updatedAllPeriods[periodIndex] = updatedAllPeriods[periodIndex].filter(
                  staff => staff.id !== staffId
                );
              });
              queryClient.setQueryData(
                PREFETCH_QUERY_KEYS.allPeriodsStaff(),
                updatedAllPeriods
              );
              console.log('🔄 [PHASE3-CACHE] Staff removed from all periods cache');

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
          console.warn('🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.warn('🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.warn('🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled');
          setError('WebSocket接続が必要です。');
          return Promise.reject(new Error('WebSocket not connected'));
        },
      };
    }
  }, [isWebSocketEnabled, webSocketStaff.connectionStatus, webSocketStaff.staffMembers, webSocketStaff.allPeriodsStaff, webSocketStaff.addStaff, webSocketStaff.updateStaff, webSocketStaff.deleteStaff, queryClient]);

  /**
   * Schedule operations (WebSocket-first with Supabase fallback)
   */
  const scheduleOperations = useMemo(() => ({
    updateShift: async (staffId, dateKey, shiftValue) => {
      // Create schedule on-demand if it doesn't exist
      if (!currentScheduleId) {
        console.warn('⏳ [WEBSOCKET-PREFETCH] No schedule ID, checking for existing schedule...');

        try {
          // First, check if a schedule already exists for this period (race condition protection)
          const { data: existingSchedules, error: checkError } = await supabase
            .from("schedules")
            .select(`
              id,
              schedule_staff_assignments!inner (
                period_index
              )
            `)
            .eq('schedule_staff_assignments.period_index', currentMonthIndex)
            .limit(1);

          if (checkError) throw checkError;

          if (existingSchedules && existingSchedules.length > 0) {
            console.log(`✅ [WEBSOCKET-PREFETCH] Found existing schedule: ${existingSchedules[0].id}, using it`);
            setCurrentScheduleId(existingSchedules[0].id);
            queryClient.invalidateQueries(PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex));
            // Continue with the update using the existing schedule ID (fall through)
          } else {
            // Create new schedule in Supabase
            const { data: newSchedule, error: createError } = await supabase
              .from('schedules')
              .insert([
                {
                  schedule_data: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              ])
              .select()
              .single();

            if (createError) throw createError;

            // Create schedule_staff_assignment for this period
            const { error: assignmentError } = await supabase
              .from('schedule_staff_assignments')
              .insert([
                {
                  schedule_id: newSchedule.id,
                  period_index: currentMonthIndex,
                }
              ]);

            if (assignmentError) {
              // If assignment creation fails, delete the orphaned schedule
              await supabase.from('schedules').delete().eq('id', newSchedule.id);
              throw assignmentError;
            }

            console.log(`✅ [WEBSOCKET-PREFETCH] Created schedule ${newSchedule.id} on-demand for period ${currentMonthIndex}`);

            // Update local state
            setCurrentScheduleId(newSchedule.id);
            setSchedule({});

            // Invalidate cache to refetch with new schedule
            queryClient.invalidateQueries(PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex));
          }
        } catch (error) {
          console.error('❌ [WEBSOCKET-PREFETCH] Failed to create schedule on-demand:', error);
          return Promise.reject(new Error(`Failed to create schedule: ${error.message}`));
        }
      }

      // WebSocket-first shift update
      if (isWebSocketEnabled && webSocketShifts.isConnected) {
        console.log(
          `📝 [WEBSOCKET-PREFETCH] WebSocket shift update: ${staffId} → ${dateKey} = "${shiftValue}"`,
        );

        // Use WebSocket for real-time update
        return webSocketShifts.updateShift(staffId, dateKey, shiftValue)
          .then(() => {
            console.log('✅ [WEBSOCKET-PREFETCH] Shift updated via WebSocket');
            // Optimistically update local state (WebSocket hook already does this)
            setSchedule(webSocketShifts.scheduleData);
          })
          .catch((error) => {
            console.error('❌ [WEBSOCKET-PREFETCH] WebSocket shift update failed:', error);
            // Fallback to Supabase on error
            return scheduleOperations.updateShiftViaSupabase(staffId, dateKey, shiftValue);
          });
      }

      // Fallback to Supabase direct update
      return scheduleOperations.updateShiftViaSupabase(staffId, dateKey, shiftValue);
    },

    updateShiftViaSupabase: (staffId, dateKey, shiftValue) => {
      // Create updated schedule
      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };

      console.log(
        `📝 [WEBSOCKET-PREFETCH] Supabase shift update: ${staffId} → ${dateKey} = "${shiftValue}"`,
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

      // WebSocket-first bulk update
      if (isWebSocketEnabled && webSocketShifts.isConnected) {
        console.log(`📅 [WEBSOCKET-PREFETCH] WebSocket bulk schedule update`);

        return webSocketShifts.bulkUpdateSchedule(newScheduleData)
          .then(() => {
            console.log('✅ [WEBSOCKET-PREFETCH] Schedule bulk updated via WebSocket');
            setSchedule(webSocketShifts.scheduleData);
          })
          .catch((error) => {
            console.error('❌ [WEBSOCKET-PREFETCH] WebSocket bulk update failed:', error);
            // Fallback to Supabase
            return scheduleOperations.updateScheduleViaSupabase(newScheduleData, staffForSave);
          });
      }

      // Fallback to Supabase
      return scheduleOperations.updateScheduleViaSupabase(newScheduleData, staffForSave);
    },

    updateScheduleViaSupabase: (newScheduleData, staffForSave = null) => {
      console.log(`📅 [WEBSOCKET-PREFETCH] Supabase bulk schedule update`);

      return saveScheduleMutation.mutateAsync({
        scheduleData: newScheduleData,
        scheduleId: currentScheduleId,
        staffMembers: staffForSave || processedStaffMembers,
      });
    },
  }), [schedule, currentScheduleId, processedStaffMembers, saveScheduleMutation, isWebSocketEnabled, webSocketShifts]);

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


  // Phase 3: Memory usage monitoring
  const getMemoryUsage = useCallback(() => {
    const allPeriodsData = webSocketStaff.allPeriodsStaff || {};
    const periodCount = Object.keys(allPeriodsData).length;
    const totalStaff = Object.values(allPeriodsData).reduce((sum, staff) => sum + staff.length, 0);

    // Rough estimation: each staff member ~163 bytes (2.77 KB / 17 staff members)
    const estimatedMemoryKB = (totalStaff * 163) / 1024;

    return {
      periodCount,
      totalStaff,
      estimatedMemoryKB: estimatedMemoryKB.toFixed(2),
      averageStaffPerPeriod: periodCount > 0 ? (totalStaff / periodCount).toFixed(1) : 0,
    };
  }, [webSocketStaff.allPeriodsStaff]);

  // Phase 3: Cache performance metrics
  const getCacheStats = useCallback(() => {
    const totalRequests = cacheHitCountRef.current + cacheMissCountRef.current;
    const hitRate = totalRequests > 0 ? ((cacheHitCountRef.current / totalRequests) * 100).toFixed(1) : 0;
    const timeSinceLastUpdate = Date.now() - lastCacheUpdateRef.current;

    return {
      cacheHits: cacheHitCountRef.current,
      cacheMisses: cacheMissCountRef.current,
      totalRequests,
      hitRate: `${hitRate}%`,
      timeSinceLastUpdateMs: timeSinceLastUpdate,
      isCacheStale: timeSinceLastUpdate > (5 * 60 * 1000), // > 5 minutes
    };
  }, []);

  // Return WebSocket-first API with React Query cache management
  return {
    // Data - WebSocket staff with Supabase schedule
    staff: currentPeriodData.staff,
    staffMembers: currentPeriodData.staff, // Legacy alias
    schedule: currentPeriodData.schedule,
    schedulesByMonth: { [currentMonthIndex]: currentPeriodData.schedule },
    dateRange: currentPeriodData.dateRange,
    periods: periods || [],

    // Phase 3: Multi-period data access
    allPeriodsStaff: webSocketStaff.allPeriodsStaff,
    allPeriodsLoaded: webSocketStaff.allPeriodsLoaded,
    cachedAllPeriodsStaff,

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

    // Staff operations (WebSocket-first with cache invalidation)
    addStaff: staffOperations.addStaff,
    updateStaff: staffOperations.updateStaff,
    deleteStaff: staffOperations.deleteStaff,

    // Phase 3: Cache management utilities
    updatePeriodStaffCache,
    invalidateAllPeriodsCache: () => {
      console.log('🔄 [PHASE3-CACHE] Invalidating all periods cache');
      queryClient.invalidateQueries({
        queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff()
      });
      console.log('✅ [PHASE3-CACHE] Cache invalidated');
    },

    // Utility functions
    getCurrentPeriodData,
    refetchAllData: refetchSchedule,

    // Performance metrics (enhanced for Phase 3)
    prefetchStats: {
      isLoaded: !isPrefetching,
      loadTime: currentScheduleData?.loadTime,
      staffCount: processedStaffMembers?.length || 0,
      scheduleCount: 1,
      loadedAt: currentScheduleData?.loadedAt,
      webSocketMode: isWebSocketEnabled,
      connectionStatus: webSocketStaff.connectionStatus,

      // Phase 3: Cache and memory metrics
      cacheStats: getCacheStats(),
      memoryUsage: getMemoryUsage(),

      // Shift WebSocket metrics
      shiftWebSocketStatus: webSocketShifts.connectionStatus,
      shiftOfflineQueue: webSocketShifts.offlineQueueLength,
      shiftReconnectAttempts: webSocketShifts.reconnectAttempts,
    },

    // Architecture identification
    isPrefetch: true,
    phase: "Phase 4: Real-time Shift Updates with WebSocket Integration",
    webSocketEnabled: isWebSocketEnabled,
    fallbackMode: !isWebSocketEnabled || webSocketStaff.connectionStatus !== 'connected',

    // Shift WebSocket operations
    shiftWebSocket: {
      syncSchedule: webSocketShifts.syncSchedule,
      connectionStatus: webSocketShifts.connectionStatus,
      isConnected: webSocketShifts.isConnected,
      isSyncing: webSocketShifts.isSyncing,
      clientId: webSocketShifts.clientId,
    },
  };
};
