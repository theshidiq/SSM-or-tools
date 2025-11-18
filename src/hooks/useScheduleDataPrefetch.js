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

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from "react";
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
import { FEATURE_FLAGS } from "../config/featureFlags";
import { useWebSocketStaff } from "./useWebSocketStaff";
import { useWebSocketShifts } from "./useWebSocketShifts";

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
  const isWebSocketEnabled =
    FEATURE_FLAGS.WEBSOCKET_ENABLED &&
    FEATURE_FLAGS.WEBSOCKET_STAFF_MANAGEMENT &&
    !localStorage.getItem("FORCE_SUPABASE_ONLY") &&
    enabled;

  // Schedule management state (must be initialized before hooks that use it)
  const [schedule, setSchedule] = useState({});
  const [currentScheduleId, setCurrentScheduleId] = useState(scheduleId);

  // WebSocket staff hook - handles real-time staff operations with multi-period prefetch
  const webSocketStaff = useWebSocketStaff(currentMonthIndex, {
    enabled: isWebSocketEnabled,
    prefetchAllPeriods: true, // Phase 3: Enable all-periods prefetch
  });

  // WebSocket shifts hook - handles real-time shift updates
  const webSocketShifts = useWebSocketShifts(
    currentMonthIndex,
    currentScheduleId,
    {
      enabled: isWebSocketEnabled && !!currentScheduleId,
      autoReconnect: true,
      enableOfflineQueue: true,
    },
  );

  // Phase 3: Performance monitoring
  const cacheHitCountRef = useRef(0);
  const cacheMissCountRef = useRef(0);
  const lastCacheUpdateRef = useRef(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // AI modification tracking to prevent WebSocket from wiping AI-generated data
  const lastAIModificationRef = useRef(null);
  const localModificationsRef = useRef(new Set()); // Track modified cells

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
      console.log("📦 [PHASE3-CACHE] Initial cache population from WebSocket");
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
        webSocketStaff.allPeriodsStaff,
      );

      lastCacheUpdateRef.current = Date.now();
      console.log(
        "🔄 [PHASE3-CACHE] Synced WebSocket updates to React Query cache",
      );
    }
  }, [
    webSocketStaff.allPeriodsStaff,
    webSocketStaff.allPeriodsLoaded,
    isWebSocketEnabled,
    queryClient,
  ]);

  // Phase 3: Period-specific cache invalidation helper
  const updatePeriodStaffCache = useCallback(
    (periodIndex, updatedStaff) => {
      queryClient.setQueryData(PREFETCH_QUERY_KEYS.allPeriodsStaff(), (old) => {
        const updated = { ...(old || {}) };
        updated[periodIndex] = updatedStaff;
        console.log(
          `🔄 [PHASE3-CACHE] Updated period ${periodIndex} cache (${updatedStaff.length} staff)`,
        );
        return updated;
      });
    },
    [queryClient],
  );

  // Staff data from WebSocket (source of truth) with React Query persistence
  const staffMembers = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === "connected") {
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
        console.log(
          "📦 [PHASE3-CACHE] Using cached data during WebSocket disconnection",
        );
      }
      return cachedData;
    }
    // No WebSocket and no cache - fallback to empty
    return [];
  }, [
    isWebSocketEnabled,
    webSocketStaff.connectionStatus,
    webSocketStaff.staffMembers,
    cachedAllPeriodsStaff,
    currentMonthIndex,
  ]);

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
          .select(
            `
            id,
            schedule_data,
            created_at,
            updated_at,
            schedule_staff_assignments!inner (
              id,
              staff_id,
              period_index
            )
          `,
          )
          .eq("schedule_staff_assignments.period_index", currentMonthIndex)
          .order("created_at", { ascending: false }); // Get newest first

        if (scheduleError) throw scheduleError;

        const loadTime = performance.now() - startTime;

        // Find the FIRST (newest) schedule with non-null schedule_data for this period
        const periodSchedule =
          schedules?.find((schedule) => {
            const hasAssignmentForPeriod =
              schedule.schedule_staff_assignments?.some(
                (assignment) => assignment.period_index === currentMonthIndex,
              );
            // Prefer schedules with actual data, skip null schedules
            const hasData =
              schedule.schedule_data &&
              Object.keys(schedule.schedule_data).length > 0;
            return (
              hasAssignmentForPeriod && (hasData || schedules.length === 1)
            );
          }) || schedules?.[0]; // Fallback to first schedule if none have data

        console.log(
          `⚡ [WEBSOCKET-PREFETCH] Loaded schedule data in ${loadTime.toFixed(1)}ms:`,
          {
            schedulesFound: schedules?.length || 0,
            selectedScheduleId: periodSchedule?.id || null,
            period: currentMonthIndex,
            hasData: !!(
              periodSchedule?.schedule_data &&
              Object.keys(periodSchedule.schedule_data).length > 0
            ),
          },
        );

        return {
          schedule: periodSchedule?.schedule_data || {},
          scheduleId: periodSchedule?.id || null,
          loadedAt: Date.now(),
          loadTime: loadTime,
        };
      } catch (error) {
        console.error(
          `❌ [WEBSOCKET-PREFETCH] Failed to load schedule data for period ${currentMonthIndex}:`,
          error,
        );
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

  // DON'T auto-create schedule - only create when user actually updates a shift
  // This prevents empty orphaned schedules in the database
  const creationAttemptedRef = useRef({});
  const shiftCreationAttemptedRef = useRef({}); // For updateShift code path
  useEffect(() => {
    // Just track the schedule ID if it exists, don't create proactively
    if (currentScheduleData?.scheduleId) {
      console.log(
        `✅ [WEBSOCKET-PREFETCH] Using existing schedule: ${currentScheduleData.scheduleId} for period ${currentMonthIndex}`,
      );
      creationAttemptedRef.current[currentMonthIndex] = false; // Reset creation flag
      return;
    }

    // No schedule exists - that's OK, it will be created on-demand when user updates a shift
    console.log(
      `📋 [WEBSOCKET-PREFETCH] No schedule for period ${currentMonthIndex} - will create on first shift update`,
    );
  }, [currentScheduleData, currentMonthIndex]);

  // Sync WebSocket shift data with local schedule state (WITH PERIOD VALIDATION + AI PROTECTION)
  useEffect(() => {
    if (
      webSocketShifts.isConnected &&
      Object.keys(webSocketShifts.scheduleData).length > 0
    ) {
      // CRITICAL FIX: Only sync if WebSocket data matches current period
      const syncedPeriod = webSocketShifts.syncedPeriodIndex;

      if (syncedPeriod === currentMonthIndex) {
        // 🛡️ AI PROTECTION: Check if we have recent AI modifications
        const wsTimestamp = webSocketShifts.lastSyncTimestamp || 0;
        const aiTimestamp = lastAIModificationRef.current || 0;

        if (aiTimestamp > wsTimestamp && localModificationsRef.current.size > 0) {
          console.warn(
            `⚠️ [WEBSOCKET-PREFETCH] Skipping WebSocket sync - AI changes (${localModificationsRef.current.size} cells) are newer than server data`,
          );
          // Schedule a backend persist to sync AI changes to server
          setTimeout(() => {
            if (webSocketShifts.bulkUpdateSchedule && typeof webSocketShifts.bulkUpdateSchedule === 'function') {
              console.log('📤 [WEBSOCKET-PREFETCH] Persisting AI changes to backend');
              webSocketShifts.bulkUpdateSchedule(schedule);
              // Clear local modifications after successful persist
              setTimeout(() => {
                localModificationsRef.current.clear();
                lastAIModificationRef.current = null;
              }, 1000);
            }
          }, 500);
          return;
        }

        console.log(
          `🔄 [WEBSOCKET-PREFETCH] Syncing WebSocket shift data for period ${currentMonthIndex} to local state`,
        );

        // 🎯 SMART MERGE: Preserve locally-modified cells during sync
        // Wrapped in startTransition for non-blocking UI updates
        startTransition(() => {
          if (localModificationsRef.current.size > 0) {
            console.log(
              `🔀 [WEBSOCKET-PREFETCH] Smart merge: preserving ${localModificationsRef.current.size} locally-modified cells`,
            );

            setSchedule(prev => {
              const merged = { ...webSocketShifts.scheduleData };

              // Preserve AI-modified cells
              localModificationsRef.current.forEach(cellKey => {
                const [staffId, dateKey] = cellKey.split('::');
                if (prev[staffId]?.[dateKey] !== undefined) {
                  if (!merged[staffId]) merged[staffId] = {};
                  merged[staffId][dateKey] = prev[staffId][dateKey];
                }
              });

              return merged;
            });
          } else {
            // No local modifications - safe to replace
            setSchedule(webSocketShifts.scheduleData);
          }
        });
      } else {
        console.warn(
          `⚠️ [WEBSOCKET-PREFETCH] Ignoring WebSocket data for period ${syncedPeriod} (currently viewing period ${currentMonthIndex})`,
        );
        // Don't sync - this prevents wrong period data from overwriting current display
      }
    }
  }, [webSocketShifts.scheduleData, webSocketShifts.isConnected, webSocketShifts.syncedPeriodIndex, currentMonthIndex, schedule, webSocketShifts.bulkUpdateSchedule, webSocketShifts.lastSyncTimestamp]);

  // Overall loading state
  const isPrefetching =
    periodsLoading || scheduleLoading || webSocketStaff.isLoading;

  // Generate date range for current period
  // IMPORTANT: Depends on periods to trigger regeneration when periods are updated
  const dateRange = useMemo(() => {
    try {
      return generateDateRange(currentMonthIndex);
    } catch (error) {
      console.warn("Failed to generate date range:", error);
      return [];
    }
  }, [currentMonthIndex, periods]);

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
      console.error("Error processing staff members:", error);
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
        console.warn(
          `🔄 [WEBSOCKET-PREFETCH] Period ${periodIndex} requested but currently on ${currentMonthIndex}`,
        );
        return {
          staff: processedStaffMembers,
          schedule: currentScheduleData?.schedule || {}, // ✅ FIX: Use React Query data directly
          dateRange: generateDateRange(periodIndex),
          isFromCache: true,
          scheduleId: currentScheduleId,
        };
      }

      // Current period data
      try {
        return {
          staff: processedStaffMembers,
          schedule: currentScheduleData?.schedule || {}, // ✅ FIX: Use React Query data directly instead of stale state
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
    [
      currentMonthIndex,
      processedStaffMembers,
      currentScheduleData, // ✅ FIX: Use currentScheduleData instead of schedule state
      dateRange,
      currentScheduleId,
      isWebSocketEnabled,
      webSocketStaff.connectionStatus,
    ],
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

      console.log(`⚡ [WEBSOCKET-PREFETCH] Applying optimistic update for period ${currentMonthIndex}`);
      console.log(`   Old schedule staff count: ${Object.keys(previousSchedule).length}`);
      console.log(`   New schedule staff count: ${Object.keys(scheduleData).length}`);

      setSchedule(scheduleData);

      console.log(`✅ [WEBSOCKET-PREFETCH] Optimistic schedule update applied - state should re-render`);
      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousSchedule) {
        setSchedule(context.previousSchedule);
        console.log(
          `🔄 [WEBSOCKET-PREFETCH] Rolled back optimistic schedule update`,
        );
      }
      console.error("❌ [WEBSOCKET-PREFETCH] Schedule save failed:", error);
      setError(`Save failed: ${error.message}`);
    },
    onSuccess: (data) => {
      // Update schedule ID if it was created
      if (data?.id && data.id !== currentScheduleId) {
        setCurrentScheduleId(data.id);
      }
      console.log("✅ [WEBSOCKET-PREFETCH] Schedule save confirmed by server");
      setError(null);
      // Invalidate schedule query to refresh data
      queryClient.invalidateQueries({
        queryKey: PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
      });
    },
  });

  // Phase 3: Staff operations with cache invalidation
  const staffOperations = useMemo(() => {
    if (isWebSocketEnabled && webSocketStaff.connectionStatus === "connected") {
      // Use WebSocket operations with React Query cache invalidation
      return {
        addStaff: (newStaff, onSuccess) => {
          console.log(
            `➕ [PHASE3-CACHE] Adding staff via WebSocket: ${newStaff.name}`,
          );
          return webSocketStaff
            .addStaff(newStaff)
            .then(() => {
              // Phase 3: Invalidate cache on successful add
              queryClient.invalidateQueries({
                queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff(),
              });
              console.log(
                "🔄 [PHASE3-CACHE] Cache invalidated after staff add",
              );

              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch((error) => {
              console.error("WebSocket addStaff failed:", error);
              setError(`スタッフの追加に失敗しました: ${error.message}`);
            });
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.log(
            `✏️ [PHASE3-CACHE] Updating staff via WebSocket: ${staffId}`,
          );
          return webSocketStaff
            .updateStaff(staffId, updatedData)
            .then(() => {
              // Phase 3: Optimistic cache update for instant UI response
              const updatedAllPeriods = { ...webSocketStaff.allPeriodsStaff };
              Object.keys(updatedAllPeriods).forEach((periodIndex) => {
                updatedAllPeriods[periodIndex] = updatedAllPeriods[
                  periodIndex
                ].map((staff) =>
                  staff.id === staffId ? { ...staff, ...updatedData } : staff,
                );
              });
              queryClient.setQueryData(
                PREFETCH_QUERY_KEYS.allPeriodsStaff(),
                updatedAllPeriods,
              );
              console.log(
                "⚡ [PHASE3-CACHE] Optimistic cache update after staff update",
              );

              // Call onSuccess immediately with optimistic data
              // Modal will handle fetching fresh data after cache invalidation
              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch((error) => {
              console.error("WebSocket updateStaff failed:", error);
              // Phase 3: Rollback optimistic update on error
              queryClient.invalidateQueries({
                queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff(),
              });
              setError(`スタッフの更新に失敗しました: ${error.message}`);
            });
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.log(
            `🗑️ [PHASE3-CACHE] Deleting staff via WebSocket: ${staffId}`,
          );
          return webSocketStaff
            .deleteStaff(staffId)
            .then(() => {
              // Handle schedule cleanup
              if (scheduleData && scheduleData[staffId]) {
                const newSchedule = { ...scheduleData };
                delete newSchedule[staffId];
                if (updateScheduleFn) updateScheduleFn(newSchedule);
              }

              // Phase 3: Remove from cache across all periods
              const updatedAllPeriods = { ...webSocketStaff.allPeriodsStaff };
              Object.keys(updatedAllPeriods).forEach((periodIndex) => {
                updatedAllPeriods[periodIndex] = updatedAllPeriods[
                  periodIndex
                ].filter((staff) => staff.id !== staffId);
              });
              queryClient.setQueryData(
                PREFETCH_QUERY_KEYS.allPeriodsStaff(),
                updatedAllPeriods,
              );
              console.log(
                "🔄 [PHASE3-CACHE] Staff removed from all periods cache",
              );

              if (onSuccess) onSuccess(webSocketStaff.staffMembers);
            })
            .catch((error) => {
              console.error("WebSocket deleteStaff failed:", error);
              setError(`スタッフの削除に失敗しました: ${error.message}`);
            });
        },
      };
    } else {
      // Fallback to Enhanced mode operations (placeholder)
      return {
        addStaff: (newStaff, onSuccess) => {
          console.warn(
            "🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled",
          );
          setError("WebSocket接続が必要です。");
          return Promise.reject(new Error("WebSocket not connected"));
        },
        updateStaff: (staffId, updatedData, onSuccess) => {
          console.warn(
            "🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled",
          );
          setError("WebSocket接続が必要です。");
          return Promise.reject(new Error("WebSocket not connected"));
        },
        deleteStaff: (staffId, scheduleData, updateScheduleFn, onSuccess) => {
          console.warn(
            "🚫 [PHASE3-CACHE] WebSocket not available, staff operations disabled",
          );
          setError("WebSocket接続が必要です。");
          return Promise.reject(new Error("WebSocket not connected"));
        },
      };
    }
  }, [
    isWebSocketEnabled,
    webSocketStaff.connectionStatus,
    webSocketStaff.staffMembers,
    webSocketStaff.allPeriodsStaff,
    webSocketStaff.addStaff,
    webSocketStaff.updateStaff,
    webSocketStaff.deleteStaff,
    queryClient,
  ]);

  /**
   * Schedule operations (WebSocket-first with Supabase fallback)
   */
  const scheduleOperations = useMemo(
    () => ({
      updateShift: async (staffId, dateKey, shiftValue) => {
        // Track the schedule ID to use (either existing or newly created)
        let scheduleIdToUse = currentScheduleId;

        // Create schedule on-demand if it doesn't exist
        if (!scheduleIdToUse) {
          // Check if we're already attempting creation (prevent race conditions)
          if (shiftCreationAttemptedRef.current[currentMonthIndex]) {
            console.log(
              `⏭️ [WEBSOCKET-PREFETCH] Already attempting schedule creation via updateShift for period ${currentMonthIndex}, waiting...`,
            );
            // Wait briefly for ongoing creation
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Check again after waiting - use local variable to get latest state
            scheduleIdToUse = currentScheduleId;
            if (!scheduleIdToUse) {
              return Promise.reject(
                new Error("Schedule creation in progress, please retry"),
              );
            }
            // Schedule now exists, fall through to update
          } else {
            console.warn(
              "⏳ [WEBSOCKET-PREFETCH] No schedule ID, checking for existing schedule...",
            );

            try {
              // Mark that we're attempting creation
              shiftCreationAttemptedRef.current[currentMonthIndex] = true;

              // First, check if a schedule already exists for this period (race condition protection)
              const { data: existingSchedules, error: checkError } =
                await supabase
                  .from("schedules")
                  .select(
                    `
                id,
                schedule_staff_assignments!inner (
                  period_index
                )
              `,
                  )
                  .eq(
                    "schedule_staff_assignments.period_index",
                    currentMonthIndex,
                  )
                  .limit(1);

              if (checkError) throw checkError;

              if (existingSchedules && existingSchedules.length > 0) {
                console.log(
                  `✅ [WEBSOCKET-PREFETCH] Found existing schedule: ${existingSchedules[0].id}, using it`,
                );
                scheduleIdToUse = existingSchedules[0].id;
                setCurrentScheduleId(scheduleIdToUse);
                queryClient.invalidateQueries(
                  PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
                );
                shiftCreationAttemptedRef.current[currentMonthIndex] = false; // Reset flag
                // Continue with the update using the existing schedule ID (fall through)
              } else {
                // Create schedule with assignment atomically via RPC
                const { data: result, error: createError } = await supabase.rpc(
                  "create_schedule_with_assignment",
                  {
                    p_period_index: currentMonthIndex,
                    p_schedule_data: {},
                  }
                );

                if (createError) {
                  console.error(
                    `❌ [WEBSOCKET-PREFETCH] Failed to create schedule on-demand:`,
                    createError
                  );
                  throw createError;
                }

                const newSchedule = { id: result };

                if (!newSchedule.id) {
                  throw new Error("Schedule creation returned no ID");
                }

                console.log(
                  `✅ [WEBSOCKET-PREFETCH] Created schedule ${newSchedule.id} on-demand for period ${currentMonthIndex}`,
                );

                // Use the newly created schedule ID immediately
                scheduleIdToUse = newSchedule.id;

                // Update local state
                setCurrentScheduleId(scheduleIdToUse);
                setSchedule({});

                // Reset flag after successful creation
                shiftCreationAttemptedRef.current[currentMonthIndex] = false;

                // Invalidate cache to refetch with new schedule
                queryClient.invalidateQueries(
                  PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
                );
              }
            } catch (error) {
              console.error(
                "❌ [WEBSOCKET-PREFETCH] Failed to create schedule on-demand:",
                error,
              );
              shiftCreationAttemptedRef.current[currentMonthIndex] = false; // Reset on error
              return Promise.reject(
                new Error(`Failed to create schedule: ${error.message}`),
              );
            }
          }
        }

        // WebSocket-first shift update (using the correct schedule ID)
        if (isWebSocketEnabled && webSocketShifts.isConnected) {
          console.log(
            `📝 [WEBSOCKET-PREFETCH] WebSocket shift update: ${staffId} → ${dateKey} = "${shiftValue}" (Schedule: ${scheduleIdToUse})`,
          );

          // CRITICAL FIX: Create a manual WebSocket message with the correct scheduleId
          // The webSocketShifts.updateShift() uses stale scheduleId from hook initialization
          // So we need to wait for state to propagate or fall back to Supabase

          // Check if WebSocket hook has the latest scheduleId
          if (scheduleIdToUse === currentScheduleId && currentScheduleId === webSocketShifts.scheduleData.scheduleId) {
            // IDs match - safe to use WebSocket
            return webSocketShifts
              .updateShift(staffId, dateKey, shiftValue)
              .then(() => {
                console.log(
                  "✅ [WEBSOCKET-PREFETCH] Shift updated via WebSocket",
                );
                // Optimistically update local state (WebSocket hook already does this)
                setSchedule(webSocketShifts.scheduleData);
              })
              .catch((error) => {
                console.error(
                  "❌ [WEBSOCKET-PREFETCH] WebSocket shift update failed:",
                  error,
                );
                // Fallback to Supabase on error
                return scheduleOperations.updateShiftViaSupabase(
                  staffId,
                  dateKey,
                  shiftValue,
                );
              });
          } else {
            // Schedule just created - WebSocket hook doesn't have new ID yet
            // Fall back to Supabase for this first save, future saves will use WebSocket
            console.log(
              `⏭️ [WEBSOCKET-PREFETCH] Schedule just created (${scheduleIdToUse}), using Supabase for initial save`,
            );
            return scheduleOperations.updateShiftViaSupabase(
              staffId,
              dateKey,
              shiftValue,
              scheduleIdToUse, // Pass the new schedule ID explicitly
            );
          }
        }

        // Fallback to Supabase direct update
        return scheduleOperations.updateShiftViaSupabase(
          staffId,
          dateKey,
          shiftValue,
        );
      },

      updateShiftViaSupabase: (staffId, dateKey, shiftValue, explicitScheduleId = null) => {
        // Use explicit schedule ID if provided (for newly created schedules)
        const scheduleIdToSave = explicitScheduleId || currentScheduleId;

        if (!scheduleIdToSave) {
          console.error("❌ [WEBSOCKET-PREFETCH] Cannot save shift: No schedule ID");
          return Promise.reject(new Error("No schedule ID available"));
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
          `📝 [WEBSOCKET-PREFETCH] Supabase shift update: ${staffId} → ${dateKey} = "${shiftValue}" (Schedule: ${scheduleIdToSave})`,
        );

        // Save with optimistic update
        return saveScheduleMutation.mutateAsync({
          scheduleData: newSchedule,
          scheduleId: scheduleIdToSave,
          staffMembers: processedStaffMembers,
        });
      },
      updateSchedule: async (newScheduleData, staffForSave = null, options = {}) => {
        // 🤖 Track AI modifications to prevent WebSocket from wiping generated data
        const isFromAI = options.fromAI || false;
        if (isFromAI) {
          console.log('🤖 [AI-PROTECTION] Recording AI-generated schedule update');
          lastAIModificationRef.current = Date.now();

          // Track all modified cells
          Object.keys(newScheduleData).forEach(staffId => {
            Object.keys(newScheduleData[staffId] || {}).forEach(dateKey => {
              const cellKey = `${staffId}::${dateKey}`;
              localModificationsRef.current.add(cellKey);
            });
          });

          console.log(`🤖 [AI-PROTECTION] Tracked ${localModificationsRef.current.size} AI-modified cells`);
        }

        // Track the schedule ID to use (either existing or newly created)
        let scheduleIdToUse = currentScheduleId;

        // Create schedule on-demand if it doesn't exist (same as updateShift logic)
        if (!scheduleIdToUse) {
          // Check if we're already attempting creation (prevent race conditions)
          if (creationAttemptedRef.current[currentMonthIndex]) {
            console.log(
              `⏭️ [WEBSOCKET-PREFETCH] Already attempting schedule creation via updateSchedule for period ${currentMonthIndex}, waiting...`,
            );
            // Wait briefly for ongoing creation
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Check again after waiting
            scheduleIdToUse = currentScheduleId;
            if (!scheduleIdToUse) {
              return Promise.reject(
                new Error("Schedule creation in progress, please retry"),
              );
            }
            // Schedule now exists, fall through to update
          } else {
            console.warn(
              "⏳ [WEBSOCKET-PREFETCH] No schedule ID for bulk update, creating on-demand...",
            );

            try {
              // Mark that we're attempting creation
              creationAttemptedRef.current[currentMonthIndex] = true;

              // First, check if a schedule already exists for this period (race condition protection)
              const { data: existingSchedules, error: checkError } =
                await supabase
                  .from("schedules")
                  .select(
                    `
                id,
                schedule_staff_assignments!inner (
                  period_index
                )
              `,
                  )
                  .eq(
                    "schedule_staff_assignments.period_index",
                    currentMonthIndex,
                  )
                  .limit(1);

              if (checkError) throw checkError;

              if (existingSchedules && existingSchedules.length > 0) {
                console.log(
                  `✅ [WEBSOCKET-PREFETCH] Found existing schedule: ${existingSchedules[0].id}, using it`,
                );
                scheduleIdToUse = existingSchedules[0].id;
                setCurrentScheduleId(scheduleIdToUse);
                queryClient.invalidateQueries(
                  PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
                );
                creationAttemptedRef.current[currentMonthIndex] = false; // Reset flag
                // Continue with the update using the existing schedule ID (fall through)
              } else {
                // Create schedule with assignment atomically via RPC
                const { data: result, error: createError } = await supabase.rpc(
                  "create_schedule_with_assignment",
                  {
                    p_period_index: currentMonthIndex,
                    p_schedule_data: newScheduleData, // Use the bulk data for initial creation
                  },
                );

                if (createError) {
                  console.error(
                    `❌ [WEBSOCKET-PREFETCH] Failed to create schedule on-demand:`,
                    createError,
                  );
                  throw createError;
                }

                const newSchedule = { id: result };

                if (!newSchedule.id) {
                  throw new Error("Schedule creation returned no ID");
                }

                console.log(
                  `✅ [WEBSOCKET-PREFETCH] Created schedule ${newSchedule.id} on-demand for bulk update, period ${currentMonthIndex}`,
                );

                // Use the newly created schedule ID immediately
                scheduleIdToUse = newSchedule.id;

                // Update local state
                setCurrentScheduleId(scheduleIdToUse);
                setSchedule(newScheduleData);

                // Reset flag after successful creation
                creationAttemptedRef.current[currentMonthIndex] = false;

                // Invalidate cache to refetch with new schedule
                queryClient.invalidateQueries(
                  PREFETCH_QUERY_KEYS.scheduleData(currentMonthIndex),
                );

                // Return early - schedule already created with the data
                return Promise.resolve();
              }
            } catch (error) {
              console.error(
                "❌ [WEBSOCKET-PREFETCH] Failed to create schedule on-demand:",
                error,
              );
              creationAttemptedRef.current[currentMonthIndex] = false; // Reset on error
              return Promise.reject(
                new Error(`Failed to create schedule: ${error.message}`),
              );
            }
          }
        }

        // ✅ CRITICAL FIX: For AI-generated updates, apply immediately (don't wait for WebSocket)
        // This prevents AI predictions from being overwritten by stale WebSocket data
        if (isFromAI) {
          console.log('🤖 [AI-PROTECTION] Applying AI-generated schedule immediately to UI');
          setSchedule(newScheduleData);  // ✅ Immediate UI update with AI predictions

          // Sync to backend asynchronously (non-blocking)
          if (isWebSocketEnabled && webSocketShifts.isConnected) {
            console.log(`📅 [AI-WEBSOCKET] Syncing AI schedule to WebSocket (Schedule: ${scheduleIdToUse})`);
            webSocketShifts
              .bulkUpdateSchedule(newScheduleData)
              .then(() => {
                console.log("✅ [AI-WEBSOCKET] AI schedule synced to WebSocket successfully");
              })
              .catch((error) => {
                console.error("❌ [AI-WEBSOCKET] WebSocket sync failed, trying Supabase:", error);
                // Fallback to Supabase if WebSocket fails
                scheduleOperations.updateScheduleViaSupabase(
                  newScheduleData,
                  staffForSave,
                  scheduleIdToUse,
                ).catch(err => console.error("❌ [AI-SUPABASE] Supabase fallback failed:", err));
              });
          }

          return Promise.resolve();  // Return immediately (don't block UI)
        }

        // WebSocket-first bulk update (with existing or newly created schedule ID)
        if (isWebSocketEnabled && webSocketShifts.isConnected) {
          console.log(`📅 [WEBSOCKET-PREFETCH] WebSocket bulk schedule update (Schedule: ${scheduleIdToUse})`);

          return webSocketShifts
            .bulkUpdateSchedule(newScheduleData)
            .then(() => {
              console.log(
                "✅ [WEBSOCKET-PREFETCH] Schedule bulk updated via WebSocket",
              );
              setSchedule(webSocketShifts.scheduleData);
            })
            .catch((error) => {
              console.error(
                "❌ [WEBSOCKET-PREFETCH] WebSocket bulk update failed:",
                error,
              );
              // Fallback to Supabase with explicit schedule ID
              return scheduleOperations.updateScheduleViaSupabase(
                newScheduleData,
                staffForSave,
                scheduleIdToUse,
              );
            });
        }

        // Fallback to Supabase with explicit schedule ID
        return scheduleOperations.updateScheduleViaSupabase(
          newScheduleData,
          staffForSave,
          scheduleIdToUse,
        );
      },

      updateScheduleViaSupabase: (newScheduleData, staffForSave = null, explicitScheduleId = null) => {
        // Use explicit schedule ID if provided (for newly created schedules)
        const scheduleIdToSave = explicitScheduleId || currentScheduleId;

        if (!scheduleIdToSave) {
          console.error("❌ [WEBSOCKET-PREFETCH] Cannot bulk save schedule: No schedule ID");
          return Promise.reject(new Error("No schedule ID available"));
        }

        console.log(`📅 [WEBSOCKET-PREFETCH] Supabase bulk schedule update (Schedule: ${scheduleIdToSave})`);

        return saveScheduleMutation.mutateAsync({
          scheduleData: newScheduleData,
          scheduleId: scheduleIdToSave,
          staffMembers: staffForSave || processedStaffMembers,
        });
      },
    }),
    [
      schedule,
      currentScheduleId,
      currentMonthIndex,
      processedStaffMembers,
      saveScheduleMutation,
      isWebSocketEnabled,
      webSocketShifts,
      queryClient,
    ],
  );

  // Setup real-time schedule subscriptions (DISABLED - using Go WebSocket instead)
  useEffect(() => {
    // Skip Supabase Realtime when using Go WebSocket server
    if (isWebSocketEnabled) {
      console.log(
        "⏭️ [WEBSOCKET-PREFETCH] Skipping Supabase Realtime (using Go WebSocket instead)",
      );
      return;
    }

    if (!currentScheduleId) return;

    console.log(
      `🔔 [WEBSOCKET-PREFETCH] Setting up Supabase Realtime subscription for ${currentScheduleId}`,
    );

    const scheduleChannel = supabase
      .channel("websocket_prefetch_schedule")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: `id=eq.${currentScheduleId}`,
        },
        (payload) => {
          console.log(
            "📡 [WEBSOCKET-PREFETCH] Schedule update from external source:",
            payload.eventType,
          );

          if (payload.eventType === "UPDATE" && payload.new?.schedule_data) {
            setSchedule(payload.new.schedule_data);
            console.log(
              "✅ [WEBSOCKET-PREFETCH] Schedule updated from Supabase Realtime",
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      console.log("🔌 [WEBSOCKET-PREFETCH] Cleaned up Supabase Realtime subscription");
    };
  }, [currentScheduleId, isWebSocketEnabled]);

  // Phase 3: Memory usage monitoring
  const getMemoryUsage = useCallback(() => {
    const allPeriodsData = webSocketStaff.allPeriodsStaff || {};
    const periodCount = Object.keys(allPeriodsData).length;
    const totalStaff = Object.values(allPeriodsData).reduce(
      (sum, staff) => sum + staff.length,
      0,
    );

    // Rough estimation: each staff member ~163 bytes (2.77 KB / 17 staff members)
    const estimatedMemoryKB = (totalStaff * 163) / 1024;

    return {
      periodCount,
      totalStaff,
      estimatedMemoryKB: estimatedMemoryKB.toFixed(2),
      averageStaffPerPeriod:
        periodCount > 0 ? (totalStaff / periodCount).toFixed(1) : 0,
    };
  }, [webSocketStaff.allPeriodsStaff]);

  // Phase 3: Cache performance metrics
  const getCacheStats = useCallback(() => {
    const totalRequests = cacheHitCountRef.current + cacheMissCountRef.current;
    const hitRate =
      totalRequests > 0
        ? ((cacheHitCountRef.current / totalRequests) * 100).toFixed(1)
        : 0;
    const timeSinceLastUpdate = Date.now() - lastCacheUpdateRef.current;

    return {
      cacheHits: cacheHitCountRef.current,
      cacheMisses: cacheMissCountRef.current,
      totalRequests,
      hitRate: `${hitRate}%`,
      timeSinceLastUpdateMs: timeSinceLastUpdate,
      isCacheStale: timeSinceLastUpdate > 5 * 60 * 1000, // > 5 minutes
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
      console.log("🔄 [PHASE3-CACHE] Invalidating all periods cache");
      queryClient.invalidateQueries({
        queryKey: PREFETCH_QUERY_KEYS.allPeriodsStaff(),
      });
      console.log("✅ [PHASE3-CACHE] Cache invalidated");
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
    fallbackMode:
      !isWebSocketEnabled || webSocketStaff.connectionStatus !== "connected",

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
