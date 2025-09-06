/**
 * Phase 2: Staff Management Real-time Hook - Main Staff Table Implementation
 *
 * This hook provides real-time staff management operations using the main
 * staff table as single source of truth instead of embedded schedules data
 *
 * Features:
 * - Direct queries to main staff table with period-based filtering
 * - Real-time staff data fetching with Supabase subscriptions
 * - CRUD operations (create, read, update, delete staff)
 * - Data format compatibility layer (snake_case to camelCase)
 * - Optimistic updates with conflict resolution
 * - Full API compatibility with existing useStaffManagement
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

// Query keys for React Query cache management - Updated for main staff table
export const STAFF_REALTIME_QUERY_KEYS = {
  staff: (period) => ["staff-table", "realtime", period],
  allStaff: () => ["staff-table", "all"],
  connection: () => ["staff-table", "connection"],
};

export const useStaffRealtime = (currentMonthIndex, options = {}) => {
  const { scheduleId: _scheduleId = null } = options;
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

  // Modal states (Phase 2 Fix: Add proper state management)
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

  // Connection check query - Updated to use staff table
  const { data: _connectionStatus } = useQuery({
    queryKey: STAFF_REALTIME_QUERY_KEYS.connection(),
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
   * Load staff data directly from main staff table with period filtering
   */
  const {
    data: rawStaffData,
    isLoading: isStaffLoading,
    error: staffQueryError,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: STAFF_REALTIME_QUERY_KEYS.staff(currentMonthIndex),
    queryFn: async () => {
      console.log(
        `🔍 Loading staff data from main table for period ${currentMonthIndex}...`,
      );

      // Query main staff table directly
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("staff_order", { ascending: true });

      if (error) throw error;

      console.log(`📊 Loaded staff data:`, {
        totalStaffCount: data?.length || 0,
        staffNames: data?.slice(0, 3).map((s) => s.name),
      });

      return data || [];
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
      position: dbStaff.position,
      department: dbStaff.department,
      type: dbStaff.type,
      color: dbStaff.color || "position-server",
      status: dbStaff.status || "社員",
      order: dbStaff.staff_order,
      // Transform snake_case to camelCase for compatibility
      startPeriod: dbStaff.start_period,
      endPeriod: dbStaff.end_period,
      lastModified: new Date(
        dbStaff.updated_at || dbStaff.created_at,
      ).getTime(),
    };
  }, []);

  /**
   * Process and filter staff members from main staff table
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

    // Filter staff active in current period
    try {
      const currentDateRange = generateDateRange(currentMonthIndex);
      const activeStaff = transformedStaff.filter((staff) =>
        isStaffActiveInCurrentPeriod(staff, currentDateRange),
      );

      console.log(
        `📋 Filtered ${activeStaff.length} active staff for period ${currentMonthIndex} from ${transformedStaff.length} total`,
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
      // Transform camelCase to snake_case for database
      staff_order: staff.order !== undefined ? staff.order : 0,
      start_period: staff.startPeriod,
      end_period: staff.endPeriod,
      updated_at: new Date().toISOString(),
    };
  }, []);

  /**
   * Bulk update staff members mutation - directly to staff table
   */
  const saveStaffMutation = useMutation({
    mutationFn: async ({ staffMembers: newStaffMembers, operation }) => {
      console.log(
        `💾 Saving ${newStaffMembers.length} staff members to main table (${operation})`,
      );

      // Transform to database format
      const dbStaffMembers = newStaffMembers.map(transformStaffForDatabase);

      // Use upsert to handle both updates and inserts
      const { data, error } = await supabase
        .from("staff")
        .upsert(dbStaffMembers, { onConflict: "id" })
        .select();

      if (error) throw error;

      console.log(
        `✅ Successfully saved ${data.length} staff members to main staff table`,
      );
      return data;
    },
    onMutate: async ({ staffMembers: newStaffMembers, operation }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = STAFF_REALTIME_QUERY_KEYS.staff(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousStaff = queryClient.getQueryData(queryKey);

      // Transform to database format for optimistic update
      const dbStaffMembers = newStaffMembers.map(transformStaffForDatabase);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, dbStaffMembers);

      console.log(
        `⚡ Optimistic update: ${operation} for period ${currentMonthIndex}`,
      );

      // Return context with snapshot for rollback
      return { previousStaff, queryKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousStaff) {
        queryClient.setQueryData(context.queryKey, context.previousStaff);
      }
      setError(`Staff save failed: ${err.message}`);
      console.error("❌ Staff save failed:", err);
    },
    onSuccess: (data, variables, context) => {
      // Update cache with server response
      queryClient.setQueryData(context.queryKey, data);

      // Invalidate related staff queries to keep them fresh
      queryClient.invalidateQueries({
        queryKey: ["staff-table"],
      });

      setError(null); // Clear any previous errors
      console.log("✅ Staff saved successfully to main staff table");
    },
  });

  /**
   * Update single staff member mutation - directly to staff table
   */
  const updateSingleStaffMutation = useMutation({
    mutationFn: async ({ staffId, updatedData, operation }) => {
      console.log(`🔄 Updating single staff member: ${staffId} (${operation})`);

      // Prepare update data in database format
      const updatePayload = {
        ...updatedData,
        updated_at: new Date().toISOString(),
      };

      // Transform camelCase keys to snake_case if needed
      if (updatedData.startPeriod !== undefined) {
        updatePayload.start_period = updatedData.startPeriod;
        delete updatePayload.startPeriod;
      }
      if (updatedData.endPeriod !== undefined) {
        updatePayload.end_period = updatedData.endPeriod;
        delete updatePayload.endPeriod;
      }
      if (updatedData.order !== undefined) {
        updatePayload.staff_order = updatedData.order;
        delete updatePayload.order;
      }

      // Update single staff member in database
      const { data, error } = await supabase
        .from("staff")
        .update(updatePayload)
        .eq("id", staffId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Successfully updated staff member ${staffId}`);
      return data;
    },
    onError: (err) => {
      setError(`Staff update failed: ${err.message}`);
      console.error("❌ Staff update failed:", err);
    },
    onSuccess: (_data) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff-table"],
      });

      setError(null);
      console.log("✅ Staff member updated successfully");
    },
  });

  /**
   * Auto-save with debouncing
   */
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

  /**
   * Add new staff member mutation - directly to staff table
   */
  const addStaffMutation = useMutation({
    mutationFn: async (newStaff) => {
      console.log(`➕ Adding new staff member: ${newStaff.name}`);

      const dbStaff = transformStaffForDatabase({
        ...newStaff,
        order: staffMembers.length,
        id:
          newStaff.id ||
          `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });

      const { data, error } = await supabase
        .from("staff")
        .insert([dbStaff])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Successfully added staff member: ${data.name}`);
      return data;
    },
    onSuccess: (_data) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff-table"],
      });

      setError(null);
      console.log("✅ Staff member added successfully");
    },
    onError: (err) => {
      setError(`Add staff failed: ${err.message}`);
      console.error("❌ Add staff failed:", err);
    },
  });

  /**
   * Public API methods - Match existing useStaffManagement interface
   */
  const addStaff = useCallback(
    (newStaff, onSuccess) => {
      addStaffMutation.mutate(newStaff, {
        onSuccess: (data) => {
          if (onSuccess) {
            // Transform back to application format for callback
            const appFormatStaff = transformStaffFromDatabase(data);
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
      updateSingleStaffMutation.mutate({
        staffId,
        updatedData: {
          ...updatedData,
          lastModified: Date.now(),
        },
        operation: "update",
      });

      if (onSuccess) {
        setTimeout(() => {
          const updatedStaff = staffMembers.map((staff) =>
            staff.id === staffId ? { ...staff, ...updatedData } : staff,
          );
          onSuccess(updatedStaff);
        }, 100);
      }
    },
    [updateSingleStaffMutation, staffMembers],
  );

  /**
   * Delete staff member mutation - directly from staff table
   */
  const deleteStaffMutation = useMutation({
    mutationFn: async (staffIdToDelete) => {
      console.log(`🗑️ Deleting staff member: ${staffIdToDelete}`);

      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", staffIdToDelete);

      if (error) throw error;

      console.log(`✅ Successfully deleted staff member: ${staffIdToDelete}`);
      return staffIdToDelete;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff-table"],
      });

      setError(null);
      console.log("✅ Staff member deleted successfully");
    },
    onError: (err) => {
      setError(`Delete staff failed: ${err.message}`);
      console.error("❌ Delete staff failed:", err);
    },
  });

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

  /**
   * Reorder staff members mutation - directly in staff table
   */
  const reorderStaffMutation = useMutation({
    mutationFn: async (reorderedStaff) => {
      console.log(`🔄 Reordering ${reorderedStaff.length} staff members`);

      // Prepare batch updates with new order values
      const updates = reorderedStaff.map((staff, index) => ({
        id: staff.id,
        staff_order: index,
        updated_at: new Date().toISOString(),
      }));

      // Use upsert to update the order for all staff
      const { data, error } = await supabase
        .from("staff")
        .upsert(updates, { onConflict: "id" })
        .select();

      if (error) throw error;

      console.log(`✅ Successfully reordered staff members`);
      return data;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["staff-table"],
      });

      setError(null);
      console.log("✅ Staff reordered successfully");
    },
    onError: (err) => {
      setError(`Reorder staff failed: ${err.message}`);
      console.error("❌ Reorder staff failed:", err);
    },
  });

  const reorderStaff = useCallback(
    (reorderedStaff, onSuccess) => {
      reorderStaffMutation.mutate(reorderedStaff, {
        onSuccess: () => {
          if (onSuccess) {
            const staffWithNewOrder = reorderedStaff.map((staff, index) => ({
              ...staff,
              order: index,
              lastModified: Date.now(),
            }));
            setTimeout(() => onSuccess(staffWithNewOrder), 100);
          }
        },
      });
    },
    [reorderStaffMutation],
  );

  const editStaffName = useCallback(
    (staffId, newName, onSuccess) => {
      updateSingleStaffMutation.mutate({
        staffId,
        updatedData: { name: newName },
        operation: "name-edit",
      });

      if (onSuccess) {
        setTimeout(() => {
          const updatedStaff = staffMembers.map((staff) =>
            staff.id === staffId ? { ...staff, name: newName } : staff,
          );
          onSuccess(updatedStaff);
        }, 100);
      }
    },
    [updateSingleStaffMutation, staffMembers],
  );

  const createNewStaff = useCallback(
    (staffData, schedule, dateRange, onScheduleUpdate, onStaffUpdate) => {
      const newStaffId = `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

      // Add to database
      addStaffMutation.mutate(newStaff, {
        onSuccess: (data) => {
          const transformedStaff = transformStaffFromDatabase(data);
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
      const newStaffId = `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  // Set up real-time subscription - Updated to subscribe to staff table
  useEffect(() => {
    if (!isConnected) return;

    console.log(`🔔 Setting up real-time subscription for staff table`);

    const channel = supabase
      .channel(`staff_realtime_${currentMonthIndex}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
        },
        (payload) => {
          console.log("📡 Real-time staff table update:", payload);

          // Invalidate and refetch staff data on any change
          queryClient.invalidateQueries({
            queryKey: ["staff-table"],
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
    isSaving:
      saveStaffMutation.isPending ||
      updateSingleStaffMutation.isPending ||
      addStaffMutation.isPending ||
      deleteStaffMutation.isPending ||
      reorderStaffMutation.isPending,

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
    isRefreshingFromDatabase: false, // Not implemented yet

    // Modal states (Phase 2 Fix: Use real state instead of hardcoded values)
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
    phase: "Phase 2: Main Staff Table Integration",
  };
};

export default useStaffRealtime;
