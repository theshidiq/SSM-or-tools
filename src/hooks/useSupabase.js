import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";

export const useSupabase = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const subscriptionRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select("count")
        .limit(1);
      if (error) throw error;
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setIsConnected(false);
      setError(err.message);
    }
  }, []);

  // Clean up old schedule records (keep only the most recent ones)
  const cleanupOldSchedules = useCallback(async (keepCount = 3) => {
    try {
      // Get all schedules ordered by updated_at (newest first)
      const { data: allSchedules, error: fetchError } = await supabase
        .from("schedules")
        .select("id, updated_at")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;

      if (allSchedules && allSchedules.length > keepCount) {
        // Get IDs of schedules to delete (keep only the newest ones)
        const schedulesToDelete = allSchedules.slice(keepCount);
        const idsToDelete = schedulesToDelete.map((schedule) => schedule.id);

        // Delete old schedules in batches to avoid timeout
        const batchSize = 50;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
          const batch = idsToDelete.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from("schedules")
            .delete()
            .in("id", batch);

          if (deleteError) throw deleteError;
        }
      } else {
      }
    } catch (err) {
      console.error("❌ Database cleanup failed:", err);
      // Don't throw error - cleanup failure shouldn't prevent saving
    }
  }, []);

  // One-time massive cleanup for existing bloated database
  const massiveCleanup = useCallback(async () => {
    try {
      // Get count first
      const { data: allSchedules, error: fetchError } = await supabase
        .from("schedules")
        .select("id, updated_at")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;

      if (allSchedules && allSchedules.length > 1) {
        // Keep only the very latest record
        const schedulesToDelete = allSchedules.slice(1);
        const idsToDelete = schedulesToDelete.map((schedule) => schedule.id);

        // Delete in smaller batches to avoid timeout
        const batchSize = 20;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
          const batch = idsToDelete.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from("schedules")
            .delete()
            .in("id", batch);

          if (deleteError) throw deleteError;

          const progress = Math.round(
            ((i + batch.length) / idsToDelete.length) * 100,
          );
        }
      }
    } catch (err) {
      console.error("❌ Massive cleanup failed:", err);
      throw err;
    }
  }, []);

  // Save schedule data with automatic cleanup
  const saveScheduleData = useCallback(
    async (data, scheduleId = null) => {
      setIsLoading(true);
      setError(null);

      try {
        // Skip cleanup during save to avoid interference
        // await cleanupOldSchedules(3);

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

          setScheduleData(updatedData[0]);
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

          setScheduleData(newData[0]);
          return newData[0];
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cleanupOldSchedules],
  );

  // Load schedule data
  const loadScheduleData = useCallback(async (scheduleId = null) => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase.from("schedules").select("*");

      if (scheduleId) {
        query = query.eq("id", scheduleId);
      } else {
        query = query.order("updated_at", { ascending: false }).limit(1);
      }

      const { data, error } = await query;

      if (error) throw error;

      const scheduleRecord = data?.[0] || null;
      setScheduleData(scheduleRecord);
      return scheduleRecord;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save functionality
  const autoSave = useCallback(
    (data, scheduleId = null, delay = 2000) => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      return new Promise((resolve, reject) => {
        autoSaveTimeoutRef.current = setTimeout(() => {
          saveScheduleData(data, scheduleId).then(resolve).catch(reject);
        }, delay);
      });
    },
    [saveScheduleData],
  );

  // Set up real-time subscription
  const subscribeToScheduleUpdates = useCallback((scheduleId) => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel("schedule-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: scheduleId ? `id=eq.${scheduleId}` : undefined,
        },
        (payload) => {
          if (
            payload.eventType === "UPDATE" ||
            payload.eventType === "INSERT"
          ) {
            setScheduleData(payload.new);
          } else if (payload.eventType === "DELETE") {
            setScheduleData(null);
          }
        },
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Initialize connection check
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    isConnected,
    isLoading,
    error,
    scheduleData,

    // Functions
    saveScheduleData,
    loadScheduleData,
    autoSave,
    subscribeToScheduleUpdates,
    checkConnection,
    cleanupOldSchedules,
    massiveCleanup,

    // Utilities
    clearError: () => setError(null),
  };
};

export default useSupabase;
