import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";
import { refreshPeriodsCache } from "../utils/dateUtils";

export const usePeriodsRealtime = () => {
  const [periods, setPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);

  // Load periods from database
  const loadPeriods = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_periods');
      
      if (error) throw error;

      const formattedPeriods = (data || []).map(period => ({
        id: period.id,
        start: new Date(period.start_date + 'T00:00:00.000Z'),
        end: new Date(period.end_date + 'T00:00:00.000Z'),
        label: period.label,
      }));

      setPeriods(formattedPeriods);
      
      // Also refresh the dateUtils cache
      await refreshPeriodsCache();
      
    } catch (err) {
      console.error('Failed to load periods:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new period
  const addPeriod = useCallback(async (startDate, endDate, label) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.rpc('add_period', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_label: label
      });

      if (error) throw error;

      // Reload periods to get updated list
      await loadPeriods();
      
      return data;
    } catch (err) {
      console.error('Failed to add period:', err);
      setError(err.message);
      throw err;
    }
  }, [loadPeriods]);

  // Delete a period
  const deletePeriod = useCallback(async (periodId) => {
    try {
      setError(null);
      
      const { error } = await supabase.rpc('delete_period', {
        period_id: periodId
      });

      if (error) throw error;

      // Reload periods to get updated list
      await loadPeriods();
      
    } catch (err) {
      console.error('Failed to delete period:', err);
      setError(err.message);
      throw err;
    }
  }, [loadPeriods]);

  // Update a period
  const updatePeriod = useCallback(async (periodId, startDate, endDate, label) => {
    try {
      setError(null);
      
      const { error } = await supabase.rpc('update_period', {
        period_id: periodId,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_label: label
      });

      if (error) throw error;

      // Reload periods to get updated list
      await loadPeriods();
      
    } catch (err) {
      console.error('Failed to update period:', err);
      setError(err.message);
      throw err;
    }
  }, [loadPeriods]);

  // Set up real-time subscription
  const subscribeToUpdates = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel('periods-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'periods',
        },
        (payload) => {
          console.log('🔄 Periods table changed:', payload.eventType, payload.new?.label || payload.old?.label);
          // Reload periods immediately when changes are detected
          // Use setTimeout to ensure the database transaction is committed
          setTimeout(() => {
            loadPeriods();
          }, 100); // Small delay to ensure DB consistency
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [loadPeriods]);

  // Initialize and set up subscription
  useEffect(() => {
    const initialize = async () => {
      await loadPeriods();
      subscribeToUpdates();
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [loadPeriods, subscribeToUpdates]);

  return {
    // State
    periods,
    isLoading,
    error,

    // Actions
    addPeriod,
    deletePeriod,
    updatePeriod,
    refresh: loadPeriods,

    // Utilities
    clearError: () => setError(null),
    forceRefresh: () => {
      console.log('🔄 Forcing period refresh...');
      return loadPeriods();
    }
  };
};

export default usePeriodsRealtime;