import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";
import {
  refreshPeriodsCache,
  synchronizePeriodsCache,
} from "../utils/dateUtils";

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

      const { data, error } = await supabase.rpc("get_periods");

      if (error) throw error;

      const formattedPeriods = (data || []).map((period) => ({
        id: period.id,
        start: new Date(period.start_date + "T00:00:00.000Z"),
        end: new Date(period.end_date + "T00:00:00.000Z"),
        label: period.label,
      }));

      setPeriods(formattedPeriods);

      // Synchronize the dateUtils cache with our fresh data
      synchronizePeriodsCache(formattedPeriods);
      console.log(
        `🔄 Synchronized dateUtils cache with ${formattedPeriods.length} periods`,
      );
    } catch (err) {
      console.error("Failed to load periods:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new period
  const addPeriod = useCallback(
    async (startDate, endDate, label) => {
      try {
        setError(null);

        const { data, error } = await supabase.rpc("add_period", {
          p_start_date: startDate.toISOString().split("T")[0],
          p_end_date: endDate.toISOString().split("T")[0],
          p_label: label,
        });

        if (error) throw error;

        // Reload periods to get updated list
        await loadPeriods();

        return data;
      } catch (err) {
        console.error("Failed to add period:", err);
        setError(err.message);
        throw err;
      }
    },
    [loadPeriods],
  );

  // Delete a period
  const deletePeriod = useCallback(
    async (periodId) => {
      try {
        setError(null);

        const { error } = await supabase.rpc("delete_period", {
          period_id: periodId,
        });

        if (error) throw error;

        // Reload periods to get updated list
        await loadPeriods();
      } catch (err) {
        console.error("Failed to delete period:", err);
        setError(err.message);
        throw err;
      }
    },
    [loadPeriods],
  );

  // Update a period
  const updatePeriod = useCallback(
    async (periodId, startDate, endDate, label) => {
      try {
        setError(null);

        const { error } = await supabase.rpc("update_period", {
          period_id: periodId,
          p_start_date: startDate.toISOString().split("T")[0],
          p_end_date: endDate.toISOString().split("T")[0],
          p_label: label,
        });

        if (error) throw error;

        // Reload periods to get updated list
        await loadPeriods();
      } catch (err) {
        console.error("Failed to update period:", err);
        setError(err.message);
        throw err;
      }
    },
    [loadPeriods],
  );

  // Get period configuration
  const getPeriodConfiguration = useCallback(async (restaurantId) => {
    try {
      setError(null);

      const { data, error } = await supabase
        .from("period_configuration")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

      if (error) throw error;

      return data; // Will be null if no config exists
    } catch (err) {
      console.error("Failed to get period configuration:", err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Update period configuration and regenerate all periods
  const updatePeriodConfiguration = useCallback(
    async (restaurantId, startDay, periodLengthDays = 30) => {
      try {
        setError(null);

        const { data, error } = await supabase.rpc(
          "update_period_configuration",
          {
            p_restaurant_id: restaurantId,
            p_start_day: startDay,
            p_period_length_days: periodLengthDays,
          },
        );

        if (error) throw error;

        console.log("✅ Period configuration updated:", data);
        console.log(`  - Start Day: ${data.start_day}`);
        console.log(`  - Period Length: ${data.period_length_days} days`);
        console.log(`  - Periods Regenerated: ${data.periods_regenerated}`);

        // Reload periods to get updated list
        await loadPeriods();

        return data;
      } catch (err) {
        console.error("Failed to update period configuration:", err);
        setError(err.message);
        throw err;
      }
    },
    [loadPeriods],
  );

  // Regenerate all periods based on current configuration
  const regeneratePeriods = useCallback(
    async (restaurantId = null) => {
      try {
        setError(null);

        const { data, error } = await supabase.rpc("regenerate_periods", {
          p_restaurant_id: restaurantId,
        });

        if (error) throw error;

        console.log("✅ Regenerated periods:", data?.length || 0);

        // Reload periods to get updated list
        await loadPeriods();

        return data;
      } catch (err) {
        console.error("Failed to regenerate periods:", err);
        setError(err.message);
        throw err;
      }
    },
    [loadPeriods],
  );

  // Set up real-time subscription
  const subscribeToUpdates = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel("periods-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "periods",
        },
        (payload) => {
          console.log(
            "🔄 Periods table changed:",
            payload.eventType,
            payload.new?.label || payload.old?.label,
          );
          // For DELETE events, reload immediately to prevent stale cache issues
          // For INSERT/UPDATE events, use small delay to ensure DB consistency
          const isDelete = payload.eventType === "DELETE";
          const delay = isDelete ? 10 : 50; // Very fast response for deletions to prevent race conditions

          setTimeout(() => {
            console.log(
              `🔄 Reloading periods after ${delay}ms delay (${payload.eventType} event)`,
            );
            loadPeriods();
          }, delay);
        },
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

    // Period Configuration (NEW)
    getPeriodConfiguration,
    updatePeriodConfiguration,
    regeneratePeriods,

    // Utilities
    clearError: () => setError(null),
    forceRefresh: () => {
      console.log("🔄 Forcing period refresh...");
      return loadPeriods();
    },
  };
};

export default usePeriodsRealtime;
