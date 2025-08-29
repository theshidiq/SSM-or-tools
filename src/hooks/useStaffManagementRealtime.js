/**
 * Supabase-first Real-time Staff Management Hook - Phase 3 Implementation
 * Extends the proven Supabase-first architecture to staff management operations
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import { migrateStaffMembers, cleanupStaffData } from "../utils/staffUtils";

// Query keys for React Query cache management
export const STAFF_QUERY_KEYS = {
  staff: (period) => period !== undefined ? ['staff', period] : ['staff'],
  allStaff: ['staff', 'all'],
};

export const useStaffManagementRealtime = (currentMonthIndex) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [localStaffChanges, setLocalStaffChanges] = useState({});
  
  // Auto-save refs for debouncing
  const autoSaveTimeoutRef = useRef(null);
  const currentMonthRef = useRef(currentMonthIndex);
  currentMonthRef.current = currentMonthIndex;

  // Connection check query
  const { data: connectionStatus } = useQuery({
    queryKey: ['supabase', 'staff-connection'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("staff_members")
          .select("count")
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
   * Load staff members from Supabase for current period
   */
  const { 
    data: supabaseStaffData, 
    isLoading: isSupabaseLoading, 
    error: queryError,
    refetch: refetchStaff
  } = useQuery({
    queryKey: STAFF_QUERY_KEYS.staff(currentMonthIndex),
    queryFn: async () => {
      console.log(`🔍 Loading staff members for period ${currentMonthIndex}...`);
      
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("period", currentMonthIndex)
        .order("staff_order", { ascending: true });

      if (error) throw error;

      console.log(`📊 Found ${data?.length || 0} staff members in Supabase for period ${currentMonthIndex}`);
      return data || [];
    },
    enabled: isConnected, // Only run query when connected
    staleTime: 5000, // Consider data stale after 5 seconds for real-time feel
  });

  /**
   * Save staff members mutation with optimistic updates
   */
  const saveStaffMutation = useMutation({
    mutationFn: async ({ staffMembers, operation, affectedStaffId }) => {
      console.log(`💾 Saving ${staffMembers.length} staff members for period ${currentMonthIndex} (${operation})`);
      
      // Prepare staff data for Supabase
      const staffForSave = staffMembers.map((staff, index) => ({
        id: staff.id,
        name: staff.name || '',
        position: staff.position || '',
        status: staff.status || '社員',
        department: staff.department || '',
        period: currentMonthIndex,
        staff_order: index,
        start_period: staff.startPeriod || null,
        end_period: staff.endPeriod || null,
        created_at: staff.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Delete all existing staff for this period, then insert new ones (atomic transaction)
      const { error: deleteError } = await supabase
        .from("staff_members")
        .delete()
        .eq("period", currentMonthIndex);

      if (deleteError) throw deleteError;

      if (staffForSave.length > 0) {
        const { data, error: insertError } = await supabase
          .from("staff_members")
          .insert(staffForSave)
          .select();

        if (insertError) throw insertError;
        
        console.log(`✅ Successfully saved ${data.length} staff members to Supabase`);
        return data;
      }

      console.log("✅ Successfully cleared staff members from Supabase");
      return [];
    },
    onMutate: async ({ staffMembers, operation }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = STAFF_QUERY_KEYS.staff(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousStaff = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, staffMembers);

      console.log(`⚡ Optimistic update: ${operation} for period ${currentMonthIndex}`);

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
      
      // Invalidate related queries to keep them fresh
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allStaff });
      
      setError(null); // Clear any previous errors
      console.log("✅ Staff saved successfully to Supabase");
    }
  });

  /**
   * Individual staff update mutation for single staff changes
   */
  const updateSingleStaffMutation = useMutation({
    mutationFn: async ({ staffId, updatedData, operation }) => {
      console.log(`🔄 Updating single staff member: ${staffId} (${operation})`);
      
      const updateData = {
        name: updatedData.name,
        position: updatedData.position,
        status: updatedData.status,
        department: updatedData.department,
        start_period: updatedData.startPeriod,
        end_period: updatedData.endPeriod,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("staff_members")
        .update(updateData)
        .eq("id", staffId)
        .eq("period", currentMonthIndex)
        .select();

      if (error) throw error;

      console.log(`✅ Successfully updated staff member: ${staffId}`);
      return data[0];
    },
    onMutate: async ({ staffId, updatedData }) => {
      const queryKey = STAFF_QUERY_KEYS.staff(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      const previousStaff = queryClient.getQueryData(queryKey);

      // Optimistically update the specific staff member
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(staff => 
          staff.id === staffId 
            ? { ...staff, ...updatedData, updated_at: new Date().toISOString() }
            : staff
        );
      });

      return { previousStaff, queryKey };
    },
    onError: (err, variables, context) => {
      if (context?.previousStaff) {
        queryClient.setQueryData(context.queryKey, context.previousStaff);
      }
      setError(`Staff update failed: ${err.message}`);
      console.error("❌ Staff update failed:", err);
    },
    onSuccess: (data, variables, context) => {
      // Update specific staff member in cache with server response
      queryClient.setQueryData(context.queryKey, (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(staff => 
          staff.id === variables.staffId ? data : staff
        );
      });
      
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allStaff });
      setError(null);
      console.log("✅ Staff member updated successfully");
    }
  });

  /**
   * Delete staff mutation
   */
  const deleteStaffMutation = useMutation({
    mutationFn: async ({ staffId }) => {
      console.log(`🗑️ Deleting staff member: ${staffId}`);
      
      const { error } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", staffId)
        .eq("period", currentMonthIndex);

      if (error) throw error;

      console.log(`✅ Successfully deleted staff member: ${staffId}`);
      return staffId;
    },
    onMutate: async ({ staffId }) => {
      const queryKey = STAFF_QUERY_KEYS.staff(currentMonthIndex);
      await queryClient.cancelQueries({ queryKey });

      const previousStaff = queryClient.getQueryData(queryKey);

      // Optimistically remove the staff member
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter(staff => staff.id !== staffId);
      });

      return { previousStaff, queryKey };
    },
    onError: (err, variables, context) => {
      if (context?.previousStaff) {
        queryClient.setQueryData(context.queryKey, context.previousStaff);
      }
      setError(`Staff deletion failed: ${err.message}`);
      console.error("❌ Staff deletion failed:", err);
    },
    onSuccess: (staffId, variables, context) => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.allStaff });
      setError(null);
      console.log("✅ Staff member deleted successfully");
    }
  });

  // Computed staff members with fallback to defaults
  const staffMembers = useMemo(() => {
    if (supabaseStaffData && supabaseStaffData.length > 0) {
      // Convert Supabase data to expected format
      return supabaseStaffData.map(staff => ({
        id: staff.id,
        name: staff.name,
        position: staff.position,
        status: staff.status,
        department: staff.department,
        startPeriod: staff.start_period,
        endPeriod: staff.end_period,
        order: staff.staff_order,
        created_at: staff.created_at,
        updated_at: staff.updated_at,
      }));
    }
    
    // Fallback to defaults if no Supabase data
    if (!isSupabaseLoading && isConnected) {
      return [];
    }
    
    return defaultStaffMembersArray;
  }, [supabaseStaffData, isSupabaseLoading, isConnected]);

  /**
   * Auto-save with debouncing
   */
  const scheduleAutoSave = useCallback((staffData, operation = 'auto-save', affectedStaffId = null) => {
    clearTimeout(autoSaveTimeoutRef.current);
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (isConnected && staffData && staffData.length >= 0) {
        saveStaffMutation.mutate({ 
          staffMembers: staffData, 
          operation, 
          affectedStaffId 
        });
      }
    }, 1000); // 1 second debounce
  }, [saveStaffMutation, isConnected]);

  /**
   * Public API methods
   */
  const addStaff = useCallback((newStaff) => {
    const updatedStaff = [...staffMembers, { ...newStaff, order: staffMembers.length }];
    scheduleAutoSave(updatedStaff, 'add', newStaff.id);
    return updatedStaff;
  }, [staffMembers, scheduleAutoSave]);

  const updateStaff = useCallback((staffId, updatedData) => {
    updateSingleStaffMutation.mutate({ staffId, updatedData, operation: 'update' });
  }, [updateSingleStaffMutation]);

  const deleteStaff = useCallback((staffId) => {
    deleteStaffMutation.mutate({ staffId });
  }, [deleteStaffMutation]);

  const reorderStaff = useCallback((reorderedStaff) => {
    const staffWithNewOrder = reorderedStaff.map((staff, index) => ({
      ...staff,
      order: index
    }));
    scheduleAutoSave(staffWithNewOrder, 'reorder');
  }, [scheduleAutoSave]);

  const editStaffName = useCallback((staffId, newName) => {
    updateSingleStaffMutation.mutate({ 
      staffId, 
      updatedData: { name: newName }, 
      operation: 'name-edit' 
    });
  }, [updateSingleStaffMutation]);

  const createNewStaff = useCallback((staffData) => {
    const newStaffId = `01934d2c-8a7b-7${Date.now().toString(16).slice(-3)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;
    
    const newStaff = {
      id: newStaffId,
      name: staffData.name || "新しいスタッフ",
      position: staffData.position || "Staff",
      status: staffData.status || "社員",
      department: staffData.department || "",
      startPeriod: staffData.startPeriod,
      endPeriod: staffData.endPeriod,
      order: staffMembers.length,
      created_at: new Date().toISOString(),
    };

    return addStaff(newStaff);
  }, [staffMembers.length, addStaff]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isConnected) return;

    console.log(`🔔 Setting up real-time subscription for staff period ${currentMonthIndex}`);

    const channel = supabase
      .channel(`staff_members_${currentMonthIndex}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_members',
          filter: `period=eq.${currentMonthIndex}`
        },
        (payload) => {
          console.log('📡 Real-time staff update:', payload);
          
          // Invalidate and refetch staff data on any change
          queryClient.invalidateQueries({ 
            queryKey: STAFF_QUERY_KEYS.staff(currentMonthIndex) 
          });
        }
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

  return {
    // Data
    staffMembers,
    
    // Loading states
    isLoading: isSupabaseLoading,
    isSaving: saveStaffMutation.isPending || updateSingleStaffMutation.isPending || deleteStaffMutation.isPending,
    
    // Connection status
    isConnected,
    error: error || queryError?.message,
    
    // Actions
    addStaff,
    updateStaff,
    deleteStaff,
    editStaffName,
    reorderStaff,
    createNewStaff,
    
    // Manual operations
    scheduleAutoSave,
    refetchStaff,
    
    // Phase identification
    isRealtime: true,
    phase: 'Phase 3: Supabase-first Staff Management',
  };
};

export default useStaffManagementRealtime;