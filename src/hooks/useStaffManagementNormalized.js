/**
 * Phase 3: Normalized Staff Management Hook
 * 
 * This hook provides real-time staff management operations using the normalized
 * schedule-staff relationship architecture. It integrates with the schedule_staff_assignments
 * table to provide complete staff-schedule relationship management.
 *
 * Key Features:
 * - Real-time staff data fetching from staff table
 * - Integration with schedule_staff_assignments for period-based filtering
 * - CRUD operations with normalized relationship updates
 * - Automatic schedule-staff assignment management
 * - Full API compatibility with existing staff management hooks
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import {
  cleanupStaffData,
  isStaffActiveInCurrentPeriod,
} from "../utils/staffUtils";
import { generateDateRange } from "../utils/dateUtils";

// Query keys for the normalized architecture
export const NORMALIZED_STAFF_QUERY_KEYS = {
  staff: (period) => ["staff", "normalized", period],
  allStaff: () => ["staff", "normalized", "all"],
  staffForPeriod: (period) => ["staff", "for-period", period],
  scheduleAssignments: (scheduleId, period) => ["schedule-assignments", scheduleId, period],
  connection: () => ["staff", "normalized", "connection"],
};

export const useStaffManagementNormalized = (currentMonthIndex, options = {}) => {
  const { scheduleId = null } = options;
  const queryClient = useQueryClient();
  const subscriptionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Auto-save refs for debouncing
  const autoSaveTimeoutRef = useRef(null);
  const currentMonthRef = useRef(currentMonthIndex);
  currentMonthRef.current = currentMonthIndex;

  // Period context
  const [currentPeriod, setCurrentPeriod] = useState(currentMonthIndex);

  // Modal states
  const [isAddingNewStaff, setIsAddingNewStaff] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState(null);
  const [showStaffEditModal, setShowStaffEditModal] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState({
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  });

  // Connection check query
  const { data: _connectionStatus } = useQuery({
    queryKey: NORMALIZED_STAFF_QUERY_KEYS.connection(),
    queryFn: async () => {
      try {
        const { data: _data, error } = await supabase
          .from("staff")
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

  /**
   * Load staff data using single consistent approach with period filtering
   */
  const {
    data: rawStaffData,
    isLoading: isStaffLoading,
    error: staffQueryError,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: ["staff", "normalized", "period-filtered", currentMonthIndex, "v2"],
    queryFn: async () => {
      console.log(
        `🔍 Loading staff for period ${currentMonthIndex} using normalized architecture...`,
      );

      try {
        // Load all active staff (most staff should be active across multiple periods)
        const { data: allStaff, error } = await supabase
          .from("staff")
          .select("*")
          .order("staff_order", { ascending: true });

        if (error) throw error;

        // Phase 3: Pure database integration - no localStorage fallbacks
        
        // Get current period date range for proper staff filtering
        const currentPeriodDateRange = generateDateRange(currentMonthIndex);

        // Period-based active staff filtering - considers both start_period and end_period
        const activeStaff = (allStaff || []).filter((staff) => {
          // Transform database format to application format for isStaffActiveInCurrentPeriod
          const appFormatStaff = {
            ...staff,
            startPeriod: staff.start_period,
            endPeriod: staff.end_period,
          };
          
          return isStaffActiveInCurrentPeriod(appFormatStaff, currentPeriodDateRange);
        });

        console.log(`📊 Loaded ${activeStaff.length} active staff for period ${currentMonthIndex}`);
        return activeStaff;
      } catch (error) {
        console.error(`❌ Error loading normalized staff for period ${currentMonthIndex}:`, error);
        throw error;
      }
    },
    enabled: isConnected,
    staleTime: 1000, // Keep data fresh for 1 second to prevent loading flashes
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes to smooth transitions
    keepPreviousData: true, // Maintain previous data during loading to prevent flashes
  });

  /**
   * Transform staff data to application format
   */
  const transformStaffFromDatabase = useCallback((dbStaff) => {
    if (!dbStaff) return null;

    return {
      id: dbStaff.id,
      name: dbStaff.name,
      position: dbStaff.position || "",
      department: dbStaff.department || "",
      type: dbStaff.type,
      color: dbStaff.color || "position-server",
      status: dbStaff.status || "社員",
      order: dbStaff.staff_order || 0,
      // Transform for compatibility
      startPeriod: dbStaff.start_period,
      endPeriod: dbStaff.end_period,
      lastModified: new Date(
        dbStaff.updated_at || dbStaff.created_at,
      ).getTime(),
    };
  }, []);

  /**
   * Process and filter staff members using normalized architecture
   * Avoid loading flashes by maintaining previous data during transitions
   */
  const staffMembers = useMemo(() => {
    // Only show default staff on initial load (no previous data)
    if (isStaffLoading && !rawStaffData && !queryClient.getQueryData(["staff", "normalized", "period-filtered", currentMonthIndex, "v2"])) {
      return defaultStaffMembersArray;
    }

    // If we have no data and we're not loading, show empty array
    if (!rawStaffData || !Array.isArray(rawStaffData)) {
      return [];
    }

    // Transform database format to application format
    // Data from get_staff_for_period is already filtered by period
    const transformedStaff = rawStaffData
      .map(transformStaffFromDatabase)
      .filter((staff) => staff !== null);

    console.log(
      `📋 Using ${transformedStaff.length} active staff for period ${currentMonthIndex} from database`,
    );

    return cleanupStaffData(transformedStaff);
  }, [
    rawStaffData,
    isStaffLoading,
    currentMonthIndex,
    transformStaffFromDatabase,
  ]);

  /**
   * Transform application format staff data to database format
   */
  const transformStaffForDatabase = useCallback((staff) => {
    return {
      id: staff.id,
      name: staff.name,
      position: staff.position || "",
      department: staff.department || null,
      type: staff.type || null,
      color: staff.color || "position-server",
      status: staff.status || "社員",
      staff_order: staff.order !== undefined ? staff.order : 0,
      start_period: staff.startPeriod,
      end_period: staff.endPeriod,
      updated_at: new Date().toISOString(),
    };
  }, []);

  /**
   * Update schedule-staff assignments for normalized architecture
   */
  const updateScheduleStaffAssignments = useCallback(async (scheduleId, staffMembers) => {
    if (!scheduleId || !staffMembers || !Array.isArray(staffMembers)) return;

    try {
      console.log(`🔗 Updating schedule-staff assignments for period ${currentMonthIndex}`);
      
      const staffIds = staffMembers.map(staff => staff.id);
      
      const { error } = await supabase.rpc('update_schedule_staff_assignments', {
        schedule_uuid: scheduleId,
        period_idx: currentMonthIndex,
        staff_ids: staffIds
      });

      if (error) throw error;

      console.log(`✅ Updated schedule-staff assignments: ${staffIds.length} staff assigned`);
    } catch (error) {
      console.error(`❌ Failed to update schedule-staff assignments:`, error);
      throw error;
    }
  }, [currentMonthIndex]);

  /**
   * Bulk update staff members mutation with normalized relationship management
   */
  const saveStaffMutation = useMutation({
    mutationFn: async ({ staffMembers: newStaffMembers, operation, updateAssignments = true }) => {
      console.log(
        `💾 Saving ${newStaffMembers.length} staff members using normalized architecture (${operation})`,
      );

      // Transform to database format
      const dbStaffMembers = newStaffMembers.map(transformStaffForDatabase);

      // Step 1: Save staff to staff table
      const { data, error } = await supabase
        .from("staff")
        .upsert(dbStaffMembers, { onConflict: "id" })
        .select();

      if (error) throw error;

      // Step 2: Update schedule-staff assignments if requested and scheduleId is available
      if (updateAssignments && scheduleId) {
        await updateScheduleStaffAssignments(scheduleId, newStaffMembers);
      }

      console.log(
        `✅ Successfully saved ${data.length} staff members using normalized architecture`,
      );
      return { staffData: data, assignmentsUpdated: updateAssignments && !!scheduleId };
    },
    onMutate: async ({ staffMembers: newStaffMembers, operation }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = NORMALIZED_STAFF_QUERY_KEYS.staffForPeriod(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousStaff = queryClient.getQueryData(queryKey);

      // Transform to database format for optimistic update
      const dbStaffMembers = newStaffMembers.map(transformStaffFromDatabase);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, dbStaffMembers);

      console.log(
        `⚡ Optimistic update (normalized): ${operation} for period ${currentMonthIndex}`,
      );

      // Return context with snapshot for rollback
      return { previousStaff, queryKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousStaff) {
        queryClient.setQueryData(context.queryKey, context.previousStaff);
      }
      setError(`Normalized staff save failed: ${err.message}`);
      console.error("❌ Normalized staff save failed:", err);
    },
    onSuccess: (result, variables, context) => {
      // Update cache with server response
      queryClient.setQueryData(context.queryKey, result.staffData);

      // Invalidate related queries to keep them fresh
      queryClient.invalidateQueries({
        queryKey: ["staff", "normalized"],
      });
      
      // Invalidate schedule-related queries if assignments were updated
      if (result.assignmentsUpdated) {
        queryClient.invalidateQueries({
          queryKey: ["schedule", "normalized"],
        });
        queryClient.invalidateQueries({
          queryKey: ["schedule-staff-assignments"],
        });
      }

      setError(null); // Clear any previous errors
      console.log("✅ Normalized staff saved successfully");
    },
  });

  /**
   * Add new staff member mutation with normalized relationship management
   */
  const addStaffMutation = useMutation({
    mutationFn: async (newStaff) => {
      console.log(`➕ Adding new staff member using normalized architecture: ${newStaff.name}`);

      const dbStaff = transformStaffForDatabase({
        ...newStaff,
        order: staffMembers.length,
        id: newStaff.id || crypto.randomUUID(),
      });

      // Add to staff table
      const { data, error } = await supabase
        .from("staff")
        .insert([dbStaff])
        .select("*")
        .single();

      if (error) throw error;

      // Update schedule-staff assignments if scheduleId is available
      if (scheduleId) {
        const updatedStaffList = [...staffMembers, transformStaffFromDatabase(data)];
        await updateScheduleStaffAssignments(scheduleId, updatedStaffList);
      }

      console.log(`✅ Successfully added staff member using normalized architecture: ${data.name}`);
      return { staffData: data, assignmentsUpdated: !!scheduleId };
    },
    onSuccess: (result) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff", "normalized"],
      });

      // Invalidate schedule-related queries if assignments were updated
      if (result.assignmentsUpdated) {
        queryClient.invalidateQueries({
          queryKey: ["schedule", "normalized"],
        });
        queryClient.invalidateQueries({
          queryKey: ["schedule-staff-assignments"],
        });
      }

      setError(null);
      console.log("✅ Normalized staff member added successfully");
    },
    onError: (err) => {
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || "Unknown error";
      setError(`Add staff failed (normalized): ${errorMessage}`);
      console.error("❌ Normalized add staff failed:", err);
    },
  });

  /**
   * Delete staff member mutation with normalized relationship cleanup
   */
  const deleteStaffMutation = useMutation({
    mutationFn: async (staffIdToDelete) => {
      console.log(`🗑️ Deleting staff member using normalized architecture: ${staffIdToDelete}`);

      // The database foreign key constraints will handle cleaning up assignments
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", staffIdToDelete);

      if (error) throw error;

      console.log(`✅ Successfully deleted staff member using normalized architecture: ${staffIdToDelete}`);
      return { staffId: staffIdToDelete, assignmentsCleanedUp: true };
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff", "normalized"],
      });
      
      // Invalidate schedule-related queries since assignments are automatically cleaned up
      queryClient.invalidateQueries({
        queryKey: ["schedule", "normalized"],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedule-staff-assignments"],
      });

      setError(null);
      console.log("✅ Normalized staff member deleted successfully");
    },
    onError: (err) => {
      setError(`Delete staff failed (normalized): ${err.message}`);
      console.error("❌ Normalized delete staff failed:", err);
    },
  });

  /**
   * Public API methods - Match existing useStaffManagement interface
   */
  const addStaff = useCallback(
    (newStaff, onSuccess) => {
      addStaffMutation.mutate(newStaff, {
        onSuccess: (result) => {
          if (onSuccess) {
            // Transform back to application format for callback
            const appFormatStaff = transformStaffFromDatabase(result.staffData);
            const updatedStaff = [...staffMembers, appFormatStaff];
            setTimeout(() => onSuccess(updatedStaff), 100);
          }
        },
      });

      // Return optimistic result for immediate UI updates
      return [
        ...staffMembers,
        {
          ...newStaff,
          order: staffMembers.length,
          lastModified: Date.now(),
        },
      ];
    },
    [addStaffMutation, staffMembers, transformStaffFromDatabase],
  );

  const updateStaff = useCallback(
    (staffId, updatedData, onSuccess) => {
      // Use the save mutation for single staff updates
      const staffToUpdate = staffMembers.find(staff => staff.id === staffId);
      if (!staffToUpdate) {
        console.error(`Staff member ${staffId} not found for update`);
        return;
      }

      const updatedStaff = { ...staffToUpdate, ...updatedData };
      const allStaffWithUpdate = staffMembers.map(staff => 
        staff.id === staffId ? updatedStaff : staff
      );

      saveStaffMutation.mutate({
        staffMembers: allStaffWithUpdate,
        operation: "update-single",
        updateAssignments: true,
      });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess(allStaffWithUpdate);
        }, 100);
      }
    },
    [saveStaffMutation, staffMembers],
  );

  const deleteStaff = useCallback(
    (staffIdToDelete, scheduleDataParam, updateSchedule, onSuccess) => {
      deleteStaffMutation.mutate(staffIdToDelete, {
        onSuccess: () => {
          // Handle schedule data cleanup if provided
          let newSchedule = scheduleDataParam;
          if (newSchedule && newSchedule[staffIdToDelete]) {
            newSchedule = { ...scheduleDataParam };
            delete newSchedule[staffIdToDelete];

            if (updateSchedule) {
              updateSchedule(newSchedule);
            }
          }

          if (onSuccess) {
            const newStaffMembers = staffMembers.filter(
              (staff) => staff.id !== staffIdToDelete,
            );
            setTimeout(() => onSuccess(newStaffMembers), 100);
          }
        },
      });

      // Return optimistic result for immediate UI updates
      const newStaffMembers = staffMembers.filter(
        (staff) => staff.id !== staffIdToDelete,
      );

      let newSchedule = scheduleDataParam;
      if (newSchedule && newSchedule[staffIdToDelete]) {
        newSchedule = { ...scheduleDataParam };
        delete newSchedule[staffIdToDelete];
      }

      return { newStaffMembers, newSchedule };
    },
    [deleteStaffMutation, staffMembers],
  );

  const reorderStaff = useCallback(
    (reorderedStaff, onSuccess) => {
      // Update all staff with new order
      const staffWithNewOrder = reorderedStaff.map((staff, index) => ({
        ...staff,
        order: index,
        lastModified: Date.now(),
      }));

      saveStaffMutation.mutate({
        staffMembers: staffWithNewOrder,
        operation: "reorder",
        updateAssignments: true,
      });

      if (onSuccess) {
        setTimeout(() => onSuccess(staffWithNewOrder), 100);
      }
    },
    [saveStaffMutation],
  );

  const editStaffName = useCallback(
    (staffId, newName, onSuccess) => {
      updateStaff(staffId, { name: newName }, onSuccess);
    },
    [updateStaff],
  );

  const createNewStaff = useCallback(
    (staffData, schedule, dateRange, onScheduleUpdate, onStaffUpdate) => {
      const newStaffId = crypto.randomUUID();

      const newStaff = {
        id: newStaffId,
        name: staffData.name || "新しいスタッフ",
        position: staffData.position || "Staff",
        color: "position-server",
        status: staffData.status || "社員",
        startPeriod: staffData.startPeriod,
        endPeriod: staffData.endPeriod,
        order: staffMembers.length,
        lastModified: Date.now(),
      };

      // Add to database using normalized architecture
      addStaffMutation.mutate(newStaff, {
        onSuccess: (result) => {
          const transformedStaff = transformStaffFromDatabase(result.staffData);
          const newStaffMembers = [...staffMembers, transformedStaff];

          // Add empty schedule data for new staff member
          let newSchedule = schedule;
          if (schedule) {
            newSchedule = {
              ...schedule,
              [newStaffId]: {},
            };

            // Initialize all dates for the new staff member
            if (dateRange) {
              dateRange.forEach((date) => {
                const dateKey = date.toISOString().split("T")[0];
                newSchedule[newStaffId][dateKey] = ""; // Start with blank
              });
            }
          }

          // Update states via callbacks
          if (onStaffUpdate) onStaffUpdate(newStaffMembers);
          if (onScheduleUpdate) onScheduleUpdate(newSchedule);
        },
      });

      // Return optimistic result for immediate UI updates
      const newStaffMembers = [...staffMembers, newStaff];

      let newSchedule = schedule;
      if (schedule) {
        newSchedule = {
          ...schedule,
          [newStaffId]: {},
        };

        if (dateRange) {
          dateRange.forEach((date) => {
            const dateKey = date.toISOString().split("T")[0];
            newSchedule[newStaffId][dateKey] = "";
          });
        }
      }

      return { newStaffMembers, newSchedule };
    },
    [staffMembers, addStaffMutation, transformStaffFromDatabase],
  );

  const handleCreateStaff = useCallback(
    (staffData, onSuccess) => {
      const newStaffId = crypto.randomUUID();

      const newStaff = {
        id: newStaffId,
        name: staffData.name || "新しいスタッフ",
        position: staffData.position || "Staff",
        color: "position-server",
        status: staffData.status || "社員",
        startPeriod: staffData.startPeriod,
        endPeriod: staffData.endPeriod,
        order: staffMembers.length,
        lastModified: Date.now(),
      };

      addStaff(newStaff, (updatedStaff) => {
        if (onSuccess && typeof onSuccess === "function") {
          onSuccess(updatedStaff);
        }
      });
    },
    [addStaff, staffMembers.length],
  );

  // Set up real-time subscription for normalized architecture
  useEffect(() => {
    if (!isConnected) return;

    console.log(`🔔 Setting up normalized real-time subscription for staff`);

    const channel = supabase
      .channel(`staff_normalized_${currentMonthIndex}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
        },
        (payload) => {
          console.log("📡 Real-time normalized staff update:", payload);

          // Invalidate and refetch staff data on any change
          queryClient.invalidateQueries({
            queryKey: ["staff", "normalized"],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_staff_assignments",
        },
        (payload) => {
          console.log("📡 Real-time assignment update:", payload);

          // Invalidate staff queries when assignments change
          queryClient.invalidateQueries({
            queryKey: ["staff", "normalized"],
          });
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [isConnected, currentMonthIndex, queryClient]);

  // Auto-save with debouncing
  const scheduleAutoSave = useCallback(
    (staffData, operation = "auto-save") => {
      clearTimeout(autoSaveTimeoutRef.current);

      autoSaveTimeoutRef.current = setTimeout(() => {
        if (isConnected && staffData && Array.isArray(staffData)) {
          saveStaffMutation.mutate({
            staffMembers: staffData,
            operation,
            updateAssignments: true,
          });
        }
      }, 1000); // 1 second debounce
    },
    [saveStaffMutation, isConnected],
  );

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Update current period when prop changes
  useEffect(() => {
    setCurrentPeriod(currentMonthIndex);
  }, [currentMonthIndex]);

  return {
    // Staff data
    staff: staffMembers,
    staffMembers, // Legacy alias

    // Loading states
    loading: isStaffLoading,
    isLoading: isStaffLoading,
    isSaving: saveStaffMutation.isPending || addStaffMutation.isPending || deleteStaffMutation.isPending,

    // Connection status
    isConnected,
    error: error || staffQueryError?.message,

    // Period management
    currentPeriod,
    setCurrentPeriod,

    // CRUD operations - Match existing API exactly
    addStaff,
    updateStaff,
    deleteStaff,
    editStaffName,
    reorderStaff,
    createNewStaff,
    handleCreateStaff,

    // Database/state management
    hasLoadedFromDb: !!rawStaffData,
    hasInitiallyLoaded: !!rawStaffData,
    isRefreshingFromDatabase: false,

    // Modal states
    isAddingNewStaff,
    setIsAddingNewStaff,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    showStaffEditModal,
    setShowStaffEditModal,
    editingStaffData,
    setEditingStaffData,

    // Utility functions (for compatibility)
    cleanupAllPeriods: () => 0,
    fixStaffInconsistencies: () => 0,
    clearAndRefreshFromDatabase: async () => {
      await refetchStaff();
      return true;
    },

    // Manual operations
    scheduleAutoSave,
    refetchStaff: refetchStaff,

    // Normalized architecture functions
    updateScheduleStaffAssignments,

    // Phase identification
    isRealtime: true,
    isNormalized: true,
    phase: "Phase 3: Normalized Staff-Schedule Architecture",
  };
};