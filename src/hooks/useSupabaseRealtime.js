import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";

// Query keys for React Query cache management
export const QUERY_KEYS = {
  schedule: (scheduleId) => scheduleId ? ['schedule', scheduleId] : ['schedule', 'latest'],
  schedules: ['schedules'],
};

export const useSupabaseRealtime = (initialScheduleId = null) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef(null);
  const [currentScheduleId, setCurrentScheduleId] = useState(initialScheduleId);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Connection check query
  const { data: connectionStatus } = useQuery({
    queryKey: ['supabase', 'connection'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("schedules")
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

  // Load schedule data query
  const { 
    data: scheduleData, 
    isLoading, 
    error: queryError,
    refetch: refetchSchedule
  } = useQuery({
    queryKey: QUERY_KEYS.schedule(currentScheduleId),
    queryFn: async () => {
      const targetId = currentScheduleId || '502c037b-9be1-4018-bc92-6970748df9e2';
      
      let query = supabase.from("schedules").select("*");
      
      if (targetId && targetId !== 'latest') {
        query = query.eq("id", targetId);
      } else {
        query = query.order("updated_at", { ascending: false }).limit(1);
      }

      const { data, error } = await query;
      if (error) throw error;

      const scheduleRecord = data?.[0] || null;
      
      // Update current schedule ID if we got a different one
      if (scheduleRecord?.id && scheduleRecord.id !== currentScheduleId) {
        setCurrentScheduleId(scheduleRecord.id);
      }
      
      return scheduleRecord;
    },
    enabled: isConnected, // Only run query when connected
    staleTime: 1000, // Consider data stale after 1 second for real-time feel
  });

  // Save schedule mutation with optimistic updates
  const saveScheduleMutation = useMutation({
    mutationFn: async ({ data, scheduleId = null }) => {
      if (scheduleId) {
        // Update existing schedule
        const { data: updatedData, error } = await supabase
          .from("schedules")
          .update({
            schedule_data: data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduleId)
          .select();

        if (error) throw error;
        return updatedData[0];
      } else {
        // Create new schedule
        const { data: newData, error } = await supabase
          .from("schedules")
          .insert([
            {
              schedule_data: data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select();

        if (error) throw error;
        return newData[0];
      }
    },
    onMutate: async ({ data, scheduleId }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = QUERY_KEYS.schedule(scheduleId || currentScheduleId);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousSchedule = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old) => ({
        ...old,
        schedule_data: data,
        updated_at: new Date().toISOString(),
      }));

      // Return context with snapshot for rollback
      return { previousSchedule, queryKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSchedule) {
        queryClient.setQueryData(context.queryKey, context.previousSchedule);
      }
      setError(err.message);
      console.error("❌ Schedule save failed:", err);
    },
    onSuccess: (data, variables, context) => {
      // Update current schedule ID if it changed
      if (data?.id && data.id !== currentScheduleId) {
        setCurrentScheduleId(data.id);
      }
      
      // Update cache with server response
      queryClient.setQueryData(context.queryKey, data);
      
      // Invalidate related queries to keep them fresh
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules });
      
      console.log("✅ Schedule saved successfully");
    }
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId) => {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", scheduleId);
      
      if (error) throw error;
      return { deleted: true };
    },
    onSuccess: (data, scheduleId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: QUERY_KEYS.schedule(scheduleId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules });
      
      // Reset current schedule ID if we deleted the current one
      if (scheduleId === currentScheduleId) {
        setCurrentScheduleId(null);
      }
    },
    onError: (err) => {
      setError(err.message);
      console.error("❌ Schedule deletion failed:", err);
    }
  });

  // Set up real-time subscription
  const subscribeToScheduleUpdates = useCallback((scheduleId) => {
    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    if (!scheduleId) return;

    console.log("🔄 Setting up real-time subscription for schedule:", scheduleId);
    
    subscriptionRef.current = supabase
      .channel(`schedule-${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: `id=eq.${scheduleId}`,
        },
        (payload) => {
          console.log("📡 Real-time update received:", payload.eventType);
          
          const queryKey = QUERY_KEYS.schedule(scheduleId);
          
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            // Update cache with real-time data
            queryClient.setQueryData(queryKey, payload.new);
          } else if (payload.eventType === "DELETE") {
            // Remove from cache and reset state
            queryClient.removeQueries({ queryKey });
            if (scheduleId === currentScheduleId) {
              setCurrentScheduleId(null);
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ Real-time subscription active");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ Real-time subscription error");
        }
      });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [queryClient, currentScheduleId]);

  // Auto-save functionality with debouncing
  const autoSave = useCallback(
    (data, scheduleId = null, delay = 2000) => {
      const targetScheduleId = scheduleId || currentScheduleId;
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          saveScheduleMutation.mutate(
            { data, scheduleId: targetScheduleId },
            {
              onSuccess: resolve,
              onError: reject,
            }
          );
        }, delay);

        // Store timeout ID for potential cancellation
        return () => clearTimeout(timeoutId);
      });
    },
    [saveScheduleMutation, currentScheduleId]
  );

  // Set up subscription when schedule ID changes
  useEffect(() => {
    if (currentScheduleId && isConnected) {
      const cleanup = subscribeToScheduleUpdates(currentScheduleId);
      return cleanup;
    }
  }, [currentScheduleId, isConnected, subscribeToScheduleUpdates]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    // State
    isConnected,
    isLoading,
    error: error || queryError?.message,
    scheduleData,
    currentScheduleId,
    
    // Mutations
    saveSchedule: saveScheduleMutation.mutate,
    saveScheduleAsync: saveScheduleMutation.mutateAsync,
    deleteSchedule: deleteScheduleMutation.mutate,
    isSupabaseSaving: saveScheduleMutation.isPending,
    
    // Functions
    autoSave,
    refetchSchedule,
    subscribeToScheduleUpdates,
    setCurrentScheduleId,
    
    // Utilities
    clearError: () => setError(null),
  };
};