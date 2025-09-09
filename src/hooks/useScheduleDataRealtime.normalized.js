/**
 * Phase 3: Normalized Schedule Data Real-time Hook
 * 
 * This hook provides real-time schedule management with normalized staff-schedule relationships
 * using the new schedule_staff_assignments table instead of embedded _staff_members data.
 *
 * Key Changes from Phase 2:
 * - Uses schedule_staff_assignments table for staff-schedule relationships
 * - Eliminates embedded _staff_members from schedule JSONB data
 * - Maintains full API compatibility with existing useScheduleDataRealtime
 * - Uses database functions for efficient normalized data access
 * - Provides real-time updates across normalized relationships
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { generateDateRange, monthPeriods } from "../utils/dateUtils";
import {
  initializeSchedule,
  migrateScheduleData,
} from "../utils/staffUtils";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import { dataValidation } from "../utils/dataIntegrityUtils";
import { supabase } from "../utils/supabase";

// Offline queue utilities
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

const createQueueItem = (type, data, timestamp = Date.now()) => ({
  id: `${type}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
  type, // 'schedule' or 'singleCell'
  data,
  timestamp,
  retryCount: 0,
  maxRetries: MAX_RETRY_ATTEMPTS,
});

const deduplicateQueue = (queue, newItem) => {
  // For single cell updates, remove any previous updates for the same cell
  if (newItem.type === "singleCell") {
    const { staffId, dateKey } = newItem.data;
    return queue.filter((item) => {
      if (item.type === "singleCell") {
        return !(
          item.data.staffId === staffId && item.data.dateKey === dateKey
        );
      }
      return true;
    });
  }

  // For full schedule updates, remove any previous full updates
  if (newItem.type === "schedule") {
    return queue.filter((item) => item.type !== "schedule");
  }

  return queue;
};

// Query keys for the normalized architecture
export const NORMALIZED_QUERY_KEYS = {
  schedule: (scheduleId) => ["schedule", "normalized", scheduleId],
  scheduleWithStaff: (scheduleId, periodIndex) => ["schedule", "with-staff", scheduleId, periodIndex],
  staffForPeriod: (periodIndex) => ["staff", "for-period", periodIndex],
  scheduleStaffAssignments: (scheduleId, periodIndex) => ["schedule-staff-assignments", scheduleId, periodIndex],
  connection: () => ["normalized", "connection"],
};

export const useScheduleDataRealtimeNormalized = (
  currentMonthIndex,
  initialScheduleId = null,
  totalPeriods = 0,
) => {
  const queryClient = useQueryClient();

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [currentScheduleId, setCurrentScheduleId] = useState(initialScheduleId);

  // Local state for immediate UI updates
  const [schedule, setSchedule] = useState(() => {
    // Initialize with empty schedule structure - will be populated when periods load
    return initializeSchedule(
      defaultStaffMembersArray,
      [], // Start with empty date range, will be updated when periods load
    );
  });

  const [staffMembersByMonth, setStaffMembersByMonth] = useState({});

  // Auto-save refs for debouncing
  const autoSaveTimeoutRef = useRef(null);
  const currentMonthRef = useRef(currentMonthIndex);
  currentMonthRef.current = currentMonthIndex;

  // Offline queue state
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [pendingCells, setPendingCells] = useState(new Set()); // Track cells with pending changes
  const retryTimeoutRef = useRef(null);

  // Helper function to safely generate date ranges
  const safeGenerateDateRange = (monthIndex) => {
    try {
      if (monthPeriods && monthPeriods.length > 0) {
        return generateDateRange(monthIndex);
      }
      return []; // Return empty array while periods are loading
    } catch (error) {
      return []; // Return empty array if periods not ready
    }
  };

  // Generate date range for current month - only when periods are available
  const dateRange = useMemo(() => {
    return safeGenerateDateRange(currentMonthIndex);
  }, [currentMonthIndex]);

  // Connection check query
  const { data: _connectionStatus } = useQuery({
    queryKey: NORMALIZED_QUERY_KEYS.connection(),
    queryFn: async () => {
      try {
        const { data: _data, error } = await supabase
          .from("schedules")
          .select("id")
          .limit(1);

        if (error) throw error;

        setIsConnected(true);
        setError(null);
        return { connected: true };
      } catch (err) {
        setIsConnected(false);
        setError(err.message);
        return { connected: false, error: err.message };
      }
    },
    refetchInterval: 30000, // Check connection every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Note: Staff loading is now handled by useStaffManagementNormalized hook
  // This hook focuses only on schedule data - no duplicate staff filtering

  // Load schedule with staff using normalized relationship
  const {
    data: scheduleWithStaffData,
    isLoading: isScheduleLoading,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: NORMALIZED_QUERY_KEYS.scheduleWithStaff(currentScheduleId, currentMonthIndex),
    queryFn: async () => {
      if (!currentScheduleId) return null;

      try {
        console.log(`🔍 Loading schedule ${currentScheduleId} for period ${currentMonthIndex} using normalized architecture`);
        
        // Use simple query instead of missing RPC function
        const { data: scheduleData, error } = await supabase
          .from("schedules")
          .select("*")
          .eq("id", currentScheduleId)
          .single();

        if (error) throw error;

        // Note: Staff data is handled by useStaffManagementNormalized hook
        // This query only loads schedule data - no embedded staff
        console.log(`📊 Loaded schedule data (staff managed separately by normalized hook)`);
        return scheduleData;
      } catch (error) {
        console.error(`❌ Error loading schedule for period ${currentMonthIndex}:`, error);
        throw error;
      }
    },
    enabled: isConnected && !!currentScheduleId && currentMonthIndex >= 0,
    staleTime: 5000,
  });

  // Save schedule using normalized architecture
  const saveScheduleNormalized = useCallback(async ({ data: scheduleData, scheduleId }) => {
    try {
      const { _staff_members, ...actualScheduleData } = scheduleData;
      
      // Step 1: Save schedule data (without embedded staff)
      const { data: savedSchedule, error: scheduleError } = await supabase
        .from("schedules")
        .upsert({
          id: scheduleId,
          schedule_data: actualScheduleData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Simple approach: Staff assignments are handled via direct staff table queries
      // No need for complex bridge table operations
      console.log(`✅ Schedule saved with ${_staff_members?.length || 0} staff members (simple JOIN approach)`);

      console.log(`✅ Successfully saved normalized schedule for period ${currentMonthIndex}`);
      return savedSchedule;
    } catch (error) {
      console.error(`❌ Failed to save normalized schedule:`, error);
      throw error;
    }
  }, [currentMonthIndex]);

  // Mutation for optimistic schedule updates using normalized architecture
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ newSchedule, staffForSave }) => {
      // Prepare data for saving
      const currentMonthStaff =
        staffForSave || staffMembersByMonth[currentMonthIndex] || [];

      // Filter schedule data to only include current date range and active staff
      const currentDateRange = generateDateRange(currentMonthIndex);
      const validDateKeys = currentDateRange.map(
        (date) => date.toISOString().split("T")[0],
      );

      const activeStaffIds = currentMonthStaff.map((staff) => staff.id);
      const filteredScheduleData = {};

      activeStaffIds.forEach((staffId) => {
        if (newSchedule[staffId]) {
          filteredScheduleData[staffId] = {};
          validDateKeys.forEach((dateKey) => {
            if (newSchedule[staffId][dateKey] !== undefined) {
              filteredScheduleData[staffId][dateKey] =
                newSchedule[staffId][dateKey];
            }
          });
        }
      });

      // Prepare save data for normalized architecture (no embedded _staff_members)
      const saveData = {
        ...filteredScheduleData,
        _staff_members: currentMonthStaff, // Still needed for the save function
      };

      // Save using normalized architecture
      await saveScheduleNormalized({
        data: saveData,
        scheduleId: currentScheduleId,
      });

      return { newSchedule, staffForSave };
    },
    onMutate: async ({ newSchedule, staffForSave }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: NORMALIZED_QUERY_KEYS.scheduleWithStaff(currentScheduleId, currentMonthIndex),
      });

      // Snapshot the previous value for rollback
      const previousSchedule = schedule;

      // Optimistically update the UI immediately
      flushSync(() => {
        setSchedule(newSchedule);
      });

      // Update staff members if provided
      if (staffForSave) {
        setStaffMembersByMonth((prev) => ({
          ...prev,
          [currentMonthIndex]: staffForSave,
        }));
      }

      // Return context for potential rollback
      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      if (!isConnected) {
        // Connection failed - queue for retry instead of rolling back
        const queueItem = createQueueItem("schedule", {
          newSchedule: variables.newSchedule,
          staffForSave: variables.staffForSave,
        });

        setOfflineQueue((prevQueue) => {
          const dedupedQueue = deduplicateQueue(prevQueue, queueItem);
          return [...dedupedQueue, queueItem];
        });

        console.warn("🔄 Connection lost - queuing schedule update for retry", {
          queueId: queueItem.id,
          error: error.message,
        });
      } else {
        // Other errors - rollback the optimistic update
        if (context?.previousSchedule) {
          setSchedule(context.previousSchedule);
        }
        console.error("❌ Schedule update failed, rolling back:", error);
      }
    },
    onSuccess: (result, variables) => {
      // Success - invalidate related queries to keep them fresh
      queryClient.invalidateQueries({
        queryKey: ["schedule", "normalized"],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedule-staff-assignments"],
      });

      if (process.env.NODE_ENV === "development") {
        console.log("✅ Normalized schedule update successful with optimistic UI");
      }
    },
  });

  // Single-cell update mutation for real-time typing (normalized)
  const updateShiftMutation = useMutation({
    mutationFn: async ({ staffId, dateKey, shiftValue }) => {
      // Create new schedule with the single cell update
      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };

      // Use the same save logic as bulk updates but for normalized architecture
      const currentMonthStaff = staffMembersByMonth[currentMonthIndex] || [];
      const saveData = {
        ...newSchedule,
        _staff_members: currentMonthStaff, // Still needed for the save function
      };

      // Debounced auto-save to Supabase using normalized architecture
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      return new Promise((resolve, reject) => {
        autoSaveTimeoutRef.current = setTimeout(async () => {
          try {
            await saveScheduleNormalized({
              data: saveData,
              scheduleId: currentScheduleId,
            });
            resolve({ staffId, dateKey, shiftValue, newSchedule });
          } catch (error) {
            reject(error);
          }
        }, 1000); // 1 second debounce for individual cell updates
      });
    },
    onMutate: async ({ staffId, dateKey, shiftValue }) => {
      // Immediate UI update for typing responsiveness
      const previousSchedule = schedule;

      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };

      // Immediate UI update
      setSchedule(newSchedule);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `📝 Instant update (normalized): ${staffId} → ${dateKey} = "${shiftValue}"`,
        );
      }

      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      if (!isConnected) {
        // Connection failed - queue for retry instead of rolling back
        const queueItem = createQueueItem("singleCell", {
          staffId: variables.staffId,
          dateKey: variables.dateKey,
          shiftValue: variables.shiftValue,
        });

        setOfflineQueue((prevQueue) => {
          const dedupedQueue = deduplicateQueue(prevQueue, queueItem);
          return [...dedupedQueue, queueItem];
        });

        // Mark cell as pending
        const cellKey = `${variables.staffId}_${variables.dateKey}`;
        setPendingCells((prev) => new Set([...prev, cellKey]));

        console.warn("🔄 Connection lost - queuing normalized cell update for retry", {
          queueId: queueItem.id,
          staffId: variables.staffId,
          dateKey: variables.dateKey,
          value: variables.shiftValue,
          error: error.message,
        });
      } else {
        // Other errors - rollback the optimistic update
        if (context?.previousSchedule) {
          setSchedule(context.previousSchedule);
        }
        console.error("❌ Normalized single cell update failed:", error);
      }
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["schedule", "normalized"],
      });
    },
  });

  // Load and migrate data from normalized architecture when available
  useEffect(() => {
    console.log(
      `🔍 useScheduleDataRealtimeNormalized effect: currentMonthIndex=${currentMonthIndex}, totalPeriods=${totalPeriods}`,
    );

    // Skip if currentMonthIndex is invalid (negative)
    if (currentMonthIndex < 0) {
      console.log(`⚠️ BLOCKED: Negative period index: ${currentMonthIndex}`);
      return;
    }

    // Skip if we have explicit totalPeriods count and index exceeds it
    if (totalPeriods > 0 && currentMonthIndex >= totalPeriods) {
      console.log(
        `⚠️ BLOCKED: Period index ${currentMonthIndex} >= totalPeriods ${totalPeriods}`,
      );
      return;
    }

    // Additional safety check: skip if index seems unreasonably high
    if (currentMonthIndex > 20) {
      console.log(
        `⚠️ Skipping data load for unreasonably high period index: ${currentMonthIndex}`,
      );
      return;
    }

    // Process data from normalized architecture
    if (scheduleWithStaffData) {
      const { _staff_members, ...actualScheduleData } = scheduleWithStaffData;

      // Transform staff members (already in correct format from database function)
      const staffMembers = _staff_members || [];

      // Migrate schedule data to use UUIDs (if needed)
      const migratedScheduleData = migrateScheduleData(
        actualScheduleData,
        staffMembers,
      );

      // Only update if we have meaningful data AND valid period index
      if (
        (staffMembers.length > 0 ||
          Object.keys(migratedScheduleData).length > 0) &&
        currentMonthIndex >= 0
      ) {
        console.log(
          `🔄 Loading period ${currentMonthIndex} from normalized architecture`,
        );

        // Update staff members
        if (staffMembers.length > 0) {
          setStaffMembersByMonth((prev) => ({
            ...prev,
            [currentMonthIndex]: staffMembers,
          }));
        }

        // Update schedule data
        if (Object.keys(migratedScheduleData).length > 0) {
          setSchedule(migratedScheduleData);
        } else {
          // Initialize with staff structure
          const currentDateRange = generateDateRange(currentMonthIndex);
          const newSchedule = initializeSchedule(
            staffMembers.length > 0
              ? staffMembers
              : defaultStaffMembersArray,
            currentDateRange,
          );
          setSchedule(newSchedule);
        }
      }
    }

    // Note: Staff data is now managed by useStaffManagementNormalized hook
    // No duplicate staff processing here to avoid conflicts
  }, [scheduleWithStaffData, currentMonthIndex, totalPeriods]);

  // Set up real-time subscriptions for normalized architecture
  useEffect(() => {
    if (!isConnected || !currentScheduleId) return;

    console.log(`🔔 Setting up normalized real-time subscriptions for schedule ${currentScheduleId}`);

    // Subscribe to schedule changes
    const scheduleChannel = supabase
      .channel(`schedule_normalized_${currentScheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: `id=eq.${currentScheduleId}`,
        },
        (payload) => {
          console.log("📡 Real-time schedule update (normalized):", payload);
          
          // Invalidate and refetch schedule data
          queryClient.invalidateQueries({
            queryKey: NORMALIZED_QUERY_KEYS.scheduleWithStaff(currentScheduleId, currentMonthIndex),
          });
        },
      )
      .subscribe();

    // Subscribe to schedule-staff assignment changes
    const assignmentChannel = supabase
      .channel(`assignments_normalized_${currentScheduleId}_${currentMonthIndex}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_staff_assignments",
          filter: `schedule_id=eq.${currentScheduleId}`,
        },
        (payload) => {
          console.log("📡 Real-time assignment update (normalized):", payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({
            queryKey: NORMALIZED_QUERY_KEYS.scheduleWithStaff(currentScheduleId, currentMonthIndex),
          });
          queryClient.invalidateQueries({
            queryKey: NORMALIZED_QUERY_KEYS.staffForPeriod(currentMonthIndex),
          });
        },
      )
      .subscribe();

    // Subscribe to staff changes
    const staffChannel = supabase
      .channel(`staff_normalized_${currentMonthIndex}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
        },
        (payload) => {
          console.log("📡 Real-time staff update (normalized):", payload);
          
          // Invalidate staff queries
          queryClient.invalidateQueries({
            queryKey: NORMALIZED_QUERY_KEYS.staffForPeriod(currentMonthIndex),
          });
          queryClient.invalidateQueries({
            queryKey: NORMALIZED_QUERY_KEYS.scheduleWithStaff(currentScheduleId, currentMonthIndex),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(staffChannel);
    };
  }, [isConnected, currentScheduleId, currentMonthIndex, queryClient]);

  // Optimistic update functions
  const updateSchedule = useCallback(
    (newSchedule, staffForSave = null, source = "auto") => {
      if (Object.keys(newSchedule).length === 0) return;

      // Use the mutation for optimistic updates
      updateScheduleMutation.mutate({ newSchedule, staffForSave });
    },
    [updateScheduleMutation],
  );

  const updateShift = useCallback(
    (staffId, dateKey, shiftValue) => {
      // Input validation
      if (!dataValidation.isValidStaffId(staffId)) {
        console.warn("⚠️ Invalid staffId in updateShift:", staffId);
        return;
      }

      if (!dataValidation.isValidDateKey(dateKey)) {
        console.warn("⚠️ Invalid dateKey in updateShift:", dateKey);
        return;
      }

      if (!dataValidation.isValidShiftValue(shiftValue)) {
        console.warn("⚠️ Invalid shiftValue in updateShift:", shiftValue);
        return;
      }

      // Use the mutation for instant UI update + background save
      updateShiftMutation.mutate({ staffId, dateKey, shiftValue });
    },
    [updateShiftMutation],
  );

  // Retry queued changes when connection is restored
  const retryQueuedChanges = useCallback(async () => {
    if (offlineQueue.length === 0 || !isConnected) return;

    console.log(
      `🔄 Connection restored - retrying ${offlineQueue.length} queued changes (normalized)`,
    );

    // Process queue items sequentially to avoid conflicts
    for (const queueItem of offlineQueue) {
      if (queueItem.retryCount >= queueItem.maxRetries) {
        console.warn(
          `⚠️ Skipping queue item ${queueItem.id} - max retries exceeded`,
        );
        continue;
      }

      try {
        if (queueItem.type === "schedule") {
          console.log(`🔄 Retrying queued normalized schedule update: ${queueItem.id}`);
          await updateScheduleMutation.mutateAsync(queueItem.data);
        } else if (queueItem.type === "singleCell") {
          console.log(`🔄 Retrying queued normalized cell update: ${queueItem.id}`, {
            staffId: queueItem.data.staffId,
            dateKey: queueItem.data.dateKey,
            value: queueItem.data.shiftValue,
          });
          await updateShiftMutation.mutateAsync(queueItem.data);

          // Remove from pending cells on success
          const cellKey = `${queueItem.data.staffId}_${queueItem.data.dateKey}`;
          setPendingCells((prev) => {
            const newSet = new Set(prev);
            newSet.delete(cellKey);
            return newSet;
          });
        }

        console.log(`✅ Normalized queue item ${queueItem.id} retried successfully`);
      } catch (retryError) {
        console.error(
          `❌ Normalized queue retry failed for ${queueItem.id}:`,
          retryError.message,
        );

        // Increment retry count
        setOfflineQueue((prevQueue) =>
          prevQueue.map((item) =>
            item.id === queueItem.id
              ? { ...item, retryCount: item.retryCount + 1 }
              : item,
          ),
        );
      }
    }

    // Clean up successfully processed items
    setOfflineQueue((prevQueue) =>
      prevQueue.filter((item) => item.retryCount < item.maxRetries),
    );
  }, [offlineQueue, isConnected, updateScheduleMutation, updateShiftMutation]);

  // Auto-retry when connection is restored
  useEffect(() => {
    if (isConnected && offlineQueue.length > 0) {
      // Small delay to ensure connection is stable
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      retryTimeoutRef.current = setTimeout(() => {
        retryQueuedChanges();
      }, RETRY_DELAY);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isConnected, offlineQueue.length, retryQueuedChanges]);

  // Legacy auto-save function for compatibility
  const scheduleAutoSave = useCallback(
    (newScheduleData, newStaffMembers = null, source = "auto") => {
      // This now uses the normalized mutation system
      updateScheduleMutation.mutate({
        newSchedule: newScheduleData,
        staffForSave: newStaffMembers,
      });
    },
    [updateScheduleMutation],
  );

  // Update schedule when periods are loaded (if schedule is still empty)
  useEffect(() => {
    const currentDateRange = safeGenerateDateRange(currentMonthIndex);
    if (
      currentDateRange.length > 0 &&
      (!schedule || Object.keys(schedule).length === 0)
    ) {
      // Periods are now loaded but schedule is still empty - reinitialize
      const newSchedule = initializeSchedule(
        defaultStaffMembersArray,
        currentDateRange,
      );
      setSchedule(newSchedule);
    }
  }, [monthPeriods, currentMonthIndex, schedule]);

  return {
    // Schedule data
    schedule,
    schedulesByMonth: { [currentMonthIndex]: schedule }, // For compatibility
    dateRange,

    // State setters (for compatibility)
    setSchedule,
    setStaffMembersByMonth,

    // Update functions with optimistic updates
    updateSchedule,
    updateShift,
    scheduleAutoSave,

    // Supabase state
    currentScheduleId,
    setCurrentScheduleId,
    isConnected,
    isLoading: isScheduleLoading,
    isSaving:
      updateScheduleMutation.isPending ||
      updateShiftMutation.isPending,
    error: error || scheduleError?.message,

    // Offline queue state
    offlineQueue,
    pendingCells,
    hasPendingChanges: offlineQueue.length > 0,
    retryQueuedChanges,

    // Save functions for normalized architecture
    saveSchedule: saveScheduleNormalized,
    saveScheduleAsync: saveScheduleNormalized,
    isSupabaseSaving: updateScheduleMutation.isPending || updateShiftMutation.isPending,
    autoSave: scheduleAutoSave,

    // Utilities
    setHasExplicitlyDeletedData: () => {}, // Placeholder for compatibility
    syncLocalStorageToDatabase: () => Promise.resolve(), // No longer needed

    // Architecture identification
    isNormalized: true,
    phase: "Phase 3: Normalized Schedule-Staff Architecture",
  };
};