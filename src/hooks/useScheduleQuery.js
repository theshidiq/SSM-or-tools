import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { validateScheduleData } from '../utils/dataTransformation';

// Query key constants
const QUERY_KEYS = {
  schedules: ['schedules'],
  schedule: (id) => ['schedules', id],
};

// Supabase operations
const scheduleOperations = {
  // Fetch schedule by ID or latest
  fetchSchedule: async (scheduleId = null) => {
    let query = supabase.from('schedules').select('*');
    
    if (scheduleId) {
      query = query.eq('id', scheduleId);
    } else {
      query = query.order('updated_at', { ascending: false }).limit(1);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data?.[0] || null;
  },

  // Save/update schedule
  saveSchedule: async ({ scheduleData, scheduleId = null }) => {
    // Handle both old format (just schedule data) and new format (object with schedule_data and staff_members)
    let dataToSave;
    let staffMembers = null;
    
    if (scheduleData && typeof scheduleData === 'object') {
      if (scheduleData.schedule_data) {
        // New format: { schedule_data: {...}, staff_members: [...] }
        dataToSave = scheduleData.schedule_data;
        staffMembers = scheduleData.staff_members;
      } else {
        // Old format: just the schedule data object
        dataToSave = scheduleData;
      }
    } else {
      dataToSave = scheduleData;
    }

    // Validate only the schedule data part
    const validationErrors = validateScheduleData(dataToSave);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Prepare the data to save to database
    // Store staff members within the schedule_data object for now
    const dbData = {
      schedule_data: {
        ...dataToSave,
        _staff_members: staffMembers // Store staff members as a special key
      },
      updated_at: new Date().toISOString()
    };

    if (scheduleId) {
      // Update existing schedule
      const { data, error } = await supabase
        .from('schedules')
        .update(dbData)
        .eq('id', scheduleId)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      // Create new schedule
      const { data, error } = await supabase
        .from('schedules')
        .insert([{
          ...dbData,
          created_at: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  },

  // Delete schedule
  deleteSchedule: async (scheduleId) => {
    if (!scheduleId) {
      throw new Error('Schedule ID is required for deletion');
    }
    
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId);
    
    if (error) throw error;
    return true;
  },

  // Delete all schedules (for complete reset)
  deleteAllSchedules: async () => {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .gte('id', 0); // Delete all records
    
    if (error) throw error;
    return true;
  },

  // Check connection
  checkConnection: async () => {
    const { data, error } = await supabase.from('schedules').select('count').limit(1);
    if (error) throw error;
    return true;
  }
};

// Custom hook for schedule management with React Query
export const useScheduleQuery = (scheduleId = null) => {
  const queryClient = useQueryClient();

  // Query for fetching schedule data
  const {
    data: scheduleData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: scheduleId ? QUERY_KEYS.schedule(scheduleId) : QUERY_KEYS.schedules,
    queryFn: () => scheduleOperations.fetchSchedule(scheduleId),
    staleTime: 30 * 1000, // 30 seconds - relatively fresh for real-time updates
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute for real-time sync
    refetchIntervalInBackground: false,
  });

  // Mutation for deleting schedule data
  const deleteMutation = useMutation({
    mutationFn: scheduleOperations.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules });
    },
  });

  // Mutation for deleting all schedules
  const deleteAllMutation = useMutation({
    mutationFn: scheduleOperations.deleteAllSchedules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules });
      queryClient.clear(); // Clear all cached data
    },
  });

  // Mutation for saving schedule data with optimistic updates
  const saveMutation = useMutation({
    mutationFn: scheduleOperations.saveSchedule,
    onMutate: async ({ scheduleData, scheduleId: mutationScheduleId }) => {
      // Cancel any outgoing refetches
      const queryKey = mutationScheduleId ? 
        QUERY_KEYS.schedule(mutationScheduleId) : 
        QUERY_KEYS.schedules;
      
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Handle both old and new data formats
      let actualScheduleData;
      let staffMembers = null;
      
      if (scheduleData && scheduleData.schedule_data) {
        // New format: { schedule_data: {...}, staff_members: [...] }
        actualScheduleData = scheduleData.schedule_data;
        staffMembers = scheduleData.staff_members;
      } else {
        // Old format: just the schedule data object
        actualScheduleData = scheduleData;
      }

      // Optimistically update - NO UI REFRESH
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) {
          const newData = {
            id: mutationScheduleId || 'temp-id',
            schedule_data: {
              ...actualScheduleData,
              _staff_members: staffMembers
            },
            updated_at: new Date().toISOString()
          };
          return newData;
        }
        const updatedData = {
          ...old,
          schedule_data: {
            ...actualScheduleData,
            _staff_members: staffMembers
          },
          updated_at: new Date().toISOString()
        };
        return updatedData;
      });

      return { previousData, queryKey };
    },
    onError: (err, variables, context) => {
      // If mutation fails, rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSuccess: (data, variables, context) => {
      // Update with real server response
      const queryKey = data.id ? 
        QUERY_KEYS.schedule(data.id) : 
        QUERY_KEYS.schedules;
      
      queryClient.setQueryData(queryKey, data);
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules });
    },
  });

  // Connection check query
  const { data: isConnected = false } = useQuery({
    queryKey: ['connection'],
    queryFn: scheduleOperations.checkConnection,
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Auto-save function with debouncing
  const autoSave = (scheduleData, targetScheduleId = null, delay = 2000) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        saveMutation.mutate(
          { scheduleData, scheduleId: targetScheduleId },
          {
            onSuccess: resolve,
            onError: reject,
          }
        );
      }, delay);

      // Return cleanup function
      return () => clearTimeout(timeoutId);
    });
  };

  return {
    // Data
    scheduleData,
    isConnected,
    
    // Loading states
    isLoading,
    isSaving: saveMutation.isPending,
    
    // Error states
    error: error || saveMutation.error,
    
    // Functions
    saveSchedule: (scheduleData, targetScheduleId) => 
      saveMutation.mutateAsync({ scheduleData, scheduleId: targetScheduleId }),
    deleteSchedule: (scheduleId) => deleteMutation.mutateAsync(scheduleId),
    deleteAllSchedules: () => deleteAllMutation.mutateAsync(),
    autoSave,
    refetch,
    
    // Utils
    clearError: () => {
      queryClient.resetQueries({ queryKey: QUERY_KEYS.schedules });
      saveMutation.reset();
    },
    
    // Status helpers
    isModified: false, // React Query handles this through optimistic updates
    lastSyncTime: scheduleData?.updated_at,
  };
};

export default useScheduleQuery;