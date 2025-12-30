import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";

/**
 * Hook for managing calendar rules with Supabase real-time sync
 *
 * Calendar rules mark dates when ALL staff must work or must have day off:
 * - must_work: Special events (e.g., New Year) - no day off allowed
 * - must_day_off: Maintenance periods - all staff off
 *
 * @param {string} restaurantId - Restaurant UUID
 * @param {Date} startDate - Start of date range to load
 * @param {Date} endDate - End of date range to load
 */
export const useCalendarRules = (restaurantId, startDate, endDate) => {
  const [rules, setRules] = useState({}); // { "2025-01-01": "must_day_off", "2024-12-30": "must_work" }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);

  // Format date to YYYY-MM-DD (timezone-safe)
  const formatDate = useCallback((date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Load calendar rules from database
  const loadRules = useCallback(async () => {
    console.log(`🔍 [useCalendarRules] loadRules called with:`, {
      restaurantId,
      startDate: startDate ? formatDate(startDate) : null,
      endDate: endDate ? formatDate(endDate) : null,
    });

    if (!restaurantId) {
      console.warn(`⚠️ [useCalendarRules] No restaurantId provided, skipping load`);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from("calendar_rules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("date", { ascending: true });

      // Add date range filter if provided
      if (startDate) {
        query = query.gte("date", formatDate(startDate));
      }
      if (endDate) {
        query = query.lte("date", formatDate(endDate));
      }

      console.log(`🔍 [useCalendarRules] Executing query for restaurant: ${restaurantId}`);
      const { data, error: queryError } = await query;

      if (queryError) {
        console.error(`❌ [useCalendarRules] Query error:`, queryError);
        throw queryError;
      }

      console.log(`📦 [useCalendarRules] Raw data from DB:`, data);

      // Convert array to object: { "2025-01-01": "must_day_off", ... }
      const rulesMap = {};
      (data || []).forEach((rule) => {
        rulesMap[rule.date] = rule.rule_type;
      });

      console.log(`📦 [useCalendarRules] Processed rulesMap:`, rulesMap);
      setRules(rulesMap);
      console.log(`✅ [useCalendarRules] Loaded ${data?.length || 0} rules`);
    } catch (err) {
      console.error("❌ [useCalendarRules] Failed to load rules:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId, startDate, endDate, formatDate]);

  // Toggle calendar rule: null → must_work → must_day_off → null
  const toggleRule = useCallback(
    async (date) => {
      // Defensive validation: Prevent operations with invalid restaurant_id
      if (!restaurantId) {
        const errorMsg = "Restaurant ID is required. Please ensure restaurant context is initialized.";
        console.error("❌ [useCalendarRules] toggleRule called without restaurant_id");
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        setError(null);
        const dateString = formatDate(date);
        const currentRule = rules[dateString];

        // Determine next state
        let nextRule = null;
        if (!currentRule) {
          nextRule = "must_work"; // Normal → Must Work
        } else if (currentRule === "must_work") {
          nextRule = "must_day_off"; // Must Work → Must Day Off
        } else {
          nextRule = null; // Must Day Off → Normal (delete)
        }

        console.log(
          `🔄 [useCalendarRules] Toggle ${dateString}: ${currentRule || "normal"} → ${nextRule || "normal"}`,
        );

        if (nextRule === null) {
          // Delete the rule
          const { error: deleteError } = await supabase
            .from("calendar_rules")
            .delete()
            .eq("restaurant_id", restaurantId)
            .eq("date", dateString);

          if (deleteError) throw deleteError;

          // Update local state
          setRules((prev) => {
            const updated = { ...prev };
            delete updated[dateString];
            return updated;
          });
        } else {
          // Check if record exists first
          const { data: existingRule } = await supabase
            .from("calendar_rules")
            .select("id")
            .eq("restaurant_id", restaurantId)
            .eq("date", dateString)
            .maybeSingle();

          if (existingRule) {
            // Update existing record
            const { error: updateError } = await supabase
              .from("calendar_rules")
              .update({
                rule_type: nextRule,
                reason: nextRule === "must_work" ? "Special Event" : "Maintenance",
                updated_at: new Date().toISOString(),
              })
              .eq("restaurant_id", restaurantId)
              .eq("date", dateString);

            if (updateError) throw updateError;
          } else {
            // Insert new record
            const { error: insertError } = await supabase
              .from("calendar_rules")
              .insert({
                restaurant_id: restaurantId,
                date: dateString,
                rule_type: nextRule,
                reason: nextRule === "must_work" ? "Special Event" : "Maintenance",
              });

            if (insertError) throw insertError;
          }

          // Update local state
          setRules((prev) => ({
            ...prev,
            [dateString]: nextRule,
          }));
        }

        console.log(`✅ [useCalendarRules] Toggle successful`);
      } catch (err) {
        console.error("❌ [useCalendarRules] Failed to toggle rule:", err);
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, rules, formatDate],
  );

  // Get rule type for a specific date
  const getRuleForDate = useCallback(
    (date) => {
      const dateString = formatDate(date);
      return rules[dateString] || null;
    },
    [rules, formatDate],
  );

  // Check if a date has any rule
  const hasRule = useCallback(
    (date) => {
      const dateString = formatDate(date);
      return !!rules[dateString];
    },
    [rules, formatDate],
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    console.log("🔌 [useCalendarRules] Setting up real-time subscription");

    const channel = supabase
      .channel("calendar_rules_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_rules",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log("🔔 [useCalendarRules] Real-time update:", payload);

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newRule = payload.new;
            setRules((prev) => ({
              ...prev,
              [newRule.date]: newRule.rule_type,
            }));
          } else if (payload.eventType === "DELETE") {
            const oldRule = payload.old;
            setRules((prev) => {
              const updated = { ...prev };
              delete updated[oldRule.date];
              return updated;
            });
          }
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      console.log("🔌 [useCalendarRules] Cleaning up subscription");
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [restaurantId]);

  // Load rules on mount and when dependencies change
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules, // { "2025-01-01": "must_day_off", "2024-12-30": "must_work" }
    isLoading,
    error,
    toggleRule, // (date: Date) => Promise<void>
    getRuleForDate, // (date: Date) => "must_work" | "must_day_off" | null
    hasRule, // (date: Date) => boolean
    reload: loadRules, // () => Promise<void>
  };
};

export default useCalendarRules;
