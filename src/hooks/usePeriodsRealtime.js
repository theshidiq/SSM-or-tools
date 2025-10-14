import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";
import {
  refreshPeriodsCache,
  synchronizePeriodsCache,
} from "../utils/dateUtils";

export const usePeriodsRealtime = () => {
  const queryClient = useQueryClient();
  const [periods, setPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);
  const isManualUpdateRef = useRef(false); // Flag to prevent realtime interference

  // Load periods from database
  const loadPeriods = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc("get_periods");

      if (error) throw error;

      // Create a completely new array with new object references
      // This forces React to detect the change and re-render
      const formattedPeriods = (data || []).map((period) => ({
        id: period.id,
        start: new Date(period.start_date + "T00:00:00.000Z"),
        end: new Date(period.end_date + "T00:00:00.000Z"),
        label: period.label,
        // Add a timestamp to force object reference change
        _loadedAt: Date.now(),
      }));

      // Force setState with a function to ensure React sees this as a new reference
      setPeriods(() => [...formattedPeriods]);

      // Synchronize the dateUtils cache with our fresh data
      synchronizePeriodsCache(formattedPeriods);
      console.log(
        `🔄 Synchronized dateUtils cache with ${formattedPeriods.length} periods`,
      );

      // Also force refresh dateUtils cache from database to ensure dates are updated
      const { refreshPeriodsCache } = await import("../utils/dateUtils");
      await refreshPeriodsCache();
      console.log("🔄 Force refreshed dateUtils cache from database");

      // Force refetch React Query cache used by main schedule table
      // Using refetchQueries instead of invalidateQueries to force immediate refetch
      queryClient.refetchQueries({ queryKey: ["periods", "list"] });
      console.log("🔄 Refetching React Query periods cache for main table");
    } catch (err) {
      console.error("Failed to load periods:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

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
    async (restaurantId, startDay, endDay) => {
      try {
        setError(null);

        // Set flag to prevent realtime interference
        isManualUpdateRef.current = true;
        console.log("🔒 Manual update started - blocking realtime updates");

        const { data, error } = await supabase.rpc(
          "update_period_configuration",
          {
            p_restaurant_id: restaurantId,
            p_start_day: startDay,
            p_end_day: endDay,
          },
        );

        if (error) throw error;

        // Extract data with new output column names (out_ prefix)
        const result = Array.isArray(data) ? data[0] : data;

        console.log("✅ Period configuration updated:", result);
        console.log(`  - Start Day: ${result.out_start_day}`);
        console.log(`  - End Day: ${result.out_end_day}`);
        console.log(`  - Period Length: ${result.out_period_length_days} days (calculated)`);
        console.log(`  - Periods Regenerated: ${result.out_periods_regenerated}`);

        // Reload periods to get updated list
        await loadPeriods();

        // Re-enable realtime updates after a delay
        setTimeout(() => {
          isManualUpdateRef.current = false;
          console.log("🔓 Manual update complete - realtime updates re-enabled");
        }, 500);

        // Return data in normalized format (without out_ prefix)
        return {
          restaurant_id: result.out_restaurant_id,
          start_day: result.out_start_day,
          end_day: result.out_end_day,
          period_length_days: result.out_period_length_days,
          periods_regenerated: result.out_periods_regenerated,
        };
      } catch (err) {
        console.error("Failed to update period configuration:", err);
        setError(err.message);
        // Re-enable realtime updates on error
        isManualUpdateRef.current = false;
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

        // Set flag to prevent realtime interference
        isManualUpdateRef.current = true;
        console.log("🔒 Manual regenerate started - blocking realtime updates");

        const { data, error } = await supabase.rpc("regenerate_periods", {
          p_restaurant_id: restaurantId,
        });

        if (error) throw error;

        console.log("✅ Regenerated periods:", data?.length || 0);

        // Reload periods to get updated list
        await loadPeriods();

        // Re-enable realtime updates after a delay
        setTimeout(() => {
          isManualUpdateRef.current = false;
          console.log("🔓 Manual regenerate complete - realtime updates re-enabled");
        }, 500);

        return data;
      } catch (err) {
        console.error("Failed to regenerate periods:", err);
        setError(err.message);
        // Re-enable realtime updates on error
        isManualUpdateRef.current = false;
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
          // Skip realtime updates if manual update is in progress
          if (isManualUpdateRef.current) {
            console.log(
              "⏸️ Skipping realtime update (manual update in progress):",
              payload.eventType,
              payload.new?.label || payload.old?.label,
            );
            return;
          }

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
    forceRefresh: async () => {
      console.log("🔄 Forcing period refresh...");
      // Temporarily block realtime during force refresh
      const wasBlocked = isManualUpdateRef.current;
      isManualUpdateRef.current = true;

      await loadPeriods();

      // Restore previous state or keep blocked for 200ms
      if (!wasBlocked) {
        setTimeout(() => {
          isManualUpdateRef.current = false;
        }, 200);
      }
    },
  };
};

export default usePeriodsRealtime;
