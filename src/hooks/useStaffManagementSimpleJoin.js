/**
 * Simple Staff Management Hook with Schedule JOIN
 * 
 * This hook provides a simple approach to staff-schedule integration by using
 * direct JOINs between the existing 'staff' table and 'schedules' table.
 * 
 * No complex bridge tables - just direct relationships using the schedule JSONB data
 * that already contains staff UUIDs as keys.
 *
 * Key Features:
 * - Direct JOIN between staff and schedules tables
 * - Real-time staff data fetching from staff table
 * - Simple period-based filtering using existing schedule data
 * - CRUD operations on staff table
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

// Query keys for the simple JOIN architecture
export const SIMPLE_JOIN_QUERY_KEYS = {
  staff: (period) => ["staff", "simple-join", period],
  allStaff: () => ["staff", "simple-join", "all"],
  staffWithSchedule: (period) => ["staff-with-schedule", period],
  connection: () => ["staff", "simple-join", "connection"],
};

export const useStaffManagementSimpleJoin = (currentMonthIndex, options = {}) => {
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
    queryKey: SIMPLE_JOIN_QUERY_KEYS.connection(),
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
   * Load staff data using simple JOIN with schedules
   * This replaces the complex database functions with a simple approach
   */
  const {
    data: rawStaffData,
    isLoading: isStaffLoading,
    error: staffQueryError,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: SIMPLE_JOIN_QUERY_KEYS.staffWithSchedule(currentMonthIndex),
    queryFn: async () => {
      console.log(
        `🔍 Loading staff data using simple JOIN for period ${currentMonthIndex}...`,
      );

      try {
        // Simple approach: Get all staff from staff table
        const { data: allStaff, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .order("staff_order", { ascending: true });

        if (staffError) throw staffError;

        console.log(`📊 Loaded ${allStaff?.length || 0} staff from staff table`);

        // If we have a specific scheduleId, we could filter by schedule data,
        // but for now, return all active staff
        const activeStaff = allStaff?.filter(staff => staff.is_active !== false) || [];

        console.log(`📊 Filtered to ${activeStaff.length} active staff for period ${currentMonthIndex}`);

        return activeStaff;
      } catch (error) {
        console.error(`❌ Error loading staff for period ${currentMonthIndex}:`, error);
        throw error;
      }
    },
    enabled: isConnected,
    staleTime: 5000, // Consider data stale after 5 seconds for real-time feel
  });

  /**
   * Transform staff data from database format to application format
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
   * Process and filter staff members using simple JOIN approach
   */
  const staffMembers = useMemo(() => {
    if (!rawStaffData || !Array.isArray(rawStaffData)) {
      // Fallback to defaults if no staff data and not loading
      if (!isStaffLoading && isConnected) {
        return [];
      }
      return defaultStaffMembersArray;
    }

    // Transform database format to application format
    const transformedStaff = rawStaffData
      .map(transformStaffFromDatabase)
      .filter((staff) => staff !== null);

    // Apply period-based filtering if needed
    try {
      const currentDateRange = generateDateRange(currentMonthIndex);
      
      // Apply period filtering manually
      const activeStaff = transformedStaff.filter((staff) =>
        isStaffActiveInCurrentPeriod(staff, currentDateRange),
      );

      console.log(
        `📋 Using simple JOIN: ${activeStaff.length} active staff for period ${currentMonthIndex}`,
      );
      return cleanupStaffData(activeStaff);
    } catch (error) {
      console.warn("Error filtering staff for current period:", error);
      return cleanupStaffData(transformedStaff);
    }
  }, [
    rawStaffData,
    currentMonthIndex,
    isStaffLoading,
    isConnected,
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
      is_active: true,
      updated_at: new Date().toISOString(),
    };
  }, []);

  /**
   * Bulk update staff members mutation using simple staff table operations
   */
  const saveStaffMutation = useMutation({
    mutationFn: async ({ staffMembers: newStaffMembers, operation }) => {
      console.log(
        `💾 Saving ${newStaffMembers.length} staff members using simple JOIN (${operation})`,
      );

      // Transform to database format
      const dbStaffMembers = newStaffMembers.map(transformStaffForDatabase);

      // Simple upsert to staff table
      const { data, error } = await supabase
        .from("staff")
        .upsert(dbStaffMembers, { onConflict: "id" })
        .select();

      if (error) throw error;

      console.log(
        `✅ Successfully saved ${data.length} staff members using simple JOIN`,
      );
      return { staffData: data };
    },
    onMutate: async ({ staffMembers: newStaffMembers, operation }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = SIMPLE_JOIN_QUERY_KEYS.staffWithSchedule(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousStaff = queryClient.getQueryData(queryKey);

      // Transform to database format for optimistic update
      const dbStaffMembers = newStaffMembers.map(transformStaffFromDatabase);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, dbStaffMembers);

      console.log(
        `⚡ Optimistic update (simple JOIN): ${operation} for period ${currentMonthIndex}`,
      );

      // Return context with snapshot for rollback
      return { previousStaff, queryKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousStaff) {
        queryClient.setQueryData(context.queryKey, context.previousStaff);
      }
      setError(`Simple JOIN staff save failed: ${err.message}`);
      console.error("❌ Simple JOIN staff save failed:", err);
    },
    onSuccess: (result, variables, context) => {
      // Update cache with server response
      queryClient.setQueryData(context.queryKey, result.staffData);

      // Invalidate related queries to keep them fresh
      queryClient.invalidateQueries({
        queryKey: ["staff", "simple-join"],
      });

      setError(null); // Clear any previous errors
      console.log("✅ Simple JOIN staff saved successfully");
    },
  });

  /**
   * Add new staff member mutation using simple staff table
   */
  const addStaffMutation = useMutation({
    mutationFn: async (newStaff) => {
      console.log(`➕ Adding new staff member using simple JOIN: ${newStaff.name}`);

      const dbStaff = transformStaffForDatabase({
        ...newStaff,
        order: staffMembers.length,
        id: newStaff.id || crypto.randomUUID(),
      });

      // Simple insert to staff table
      const { data, error } = await supabase
        .from("staff")
        .insert([dbStaff])
        .select("*")
        .single();

      if (error) throw error;

      console.log(`✅ Successfully added staff member using simple JOIN: ${data.name}`);
      return { staffData: data };
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff", "simple-join"],
      });

      setError(null);
      console.log("✅ Simple JOIN staff member added successfully");
    },
    onError: (err) => {
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || "Unknown error";
      setError(`Add staff failed (simple JOIN): ${errorMessage}`);
      console.error("❌ Simple JOIN add staff failed:", err);
    },
  });

  /**
   * Delete staff member mutation using simple staff table
   */
  const deleteStaffMutation = useMutation({
    mutationFn: async (staffIdToDelete) => {
      console.log(`🗑️ Deleting staff member using simple JOIN: ${staffIdToDelete}`);

      // Simple delete from staff table
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", staffIdToDelete);

      if (error) throw error;

      console.log(`✅ Successfully deleted staff member using simple JOIN: ${staffIdToDelete}`);
      return { staffId: staffIdToDelete };
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff", "simple-join"],
      });

      setError(null);
      console.log("✅ Simple JOIN staff member deleted successfully");
    },
    onError: (err) => {
      setError(`Delete staff failed (simple JOIN): ${err.message}`);
      console.error("❌ Simple JOIN delete staff failed:", err);
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

      // Add to database using simple JOIN
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

  // Set up real-time subscription for simple JOIN architecture
  useEffect(() => {
    if (!isConnected) return;

    console.log(`🔔 Setting up simple JOIN real-time subscription for staff`);

    const channel = supabase
      .channel(`staff_simple_join_${currentMonthIndex}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
        },
        (payload) => {
          console.log("📡 Real-time staff update (simple JOIN):", payload);

          // Invalidate and refetch staff data on any change
          queryClient.invalidateQueries({
            queryKey: ["staff", "simple-join"],
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

    // Phase identification
    isRealtime: true,
    isSimpleJoin: true,
    isNormalized: true, // For compatibility with existing code
    phase: "Phase 3: Simple JOIN Staff-Schedule Architecture",
  };
};