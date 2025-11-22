import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";

/**
 * Hook for managing early shift preferences with Supabase real-time sync
 *
 * Early shift preferences indicate which staff members (社員 only) can be assigned early shifts (△).
 * Now supports date-based preferences - each preference is tied to a specific date.
 *
 * @param {string} restaurantId - Restaurant UUID
 */
export const useEarlyShiftPreferences = (restaurantId) => {
  const [preferences, setPreferences] = useState({}); // { [staffId]: { [date]: boolean } }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);

  // Load preferences from database
  const loadPreferences = useCallback(async () => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("staff_early_shift_preferences")
        .select("staff_id, can_do_early_shift, applies_to_date, preference_source")
        .eq("restaurant_id", restaurantId);

      if (queryError) throw queryError;

      // Convert array to nested object: { [staffId]: { [date]: boolean } }
      const prefsMap = {};
      (data || []).forEach((pref) => {
        if (!prefsMap[pref.staff_id]) {
          prefsMap[pref.staff_id] = {};
        }
        const dateKey = pref.applies_to_date || 'default';
        prefsMap[pref.staff_id][dateKey] = pref.can_do_early_shift;
      });

      setPreferences(prefsMap);
      console.log(`✅ [useEarlyShiftPreferences] Loaded ${data?.length || 0} preferences`);
    } catch (err) {
      console.error("❌ [useEarlyShiftPreferences] Failed to load preferences:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  // Save a single preference with date and source tracking
  const savePreference = useCallback(
    async (staffId, canDoEarlyShift, appliesToDate = null, preferenceSource = 'individual') => {
      if (!restaurantId) {
        const errorMsg = "Restaurant ID is required. Please ensure restaurant context is initialized.";
        console.error("❌ [useEarlyShiftPreferences] savePreference called without restaurant_id");
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        setError(null);

        console.log(
          `🔄 [useEarlyShiftPreferences] Saving preference for staff ${staffId}: ${canDoEarlyShift} (date: ${appliesToDate}, source: ${preferenceSource})`
        );

        // Check if record exists first
        const query = supabase
          .from("staff_early_shift_preferences")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .eq("staff_id", staffId);

        if (appliesToDate) {
          query.eq("applies_to_date", appliesToDate);
        } else {
          query.is("applies_to_date", null);
        }

        const { data: existingPref } = await query.maybeSingle();

        if (existingPref) {
          // Update existing record
          const { error: updateError } = await supabase
            .from("staff_early_shift_preferences")
            .update({
              can_do_early_shift: canDoEarlyShift,
              preference_source: preferenceSource,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPref.id);

          if (updateError) throw updateError;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from("staff_early_shift_preferences")
            .insert({
              restaurant_id: restaurantId,
              staff_id: staffId,
              can_do_early_shift: canDoEarlyShift,
              applies_to_date: appliesToDate,
              preference_source: preferenceSource,
            });

          if (insertError) throw insertError;
        }

        // Update local state
        setPreferences((prev) => {
          const dateKey = appliesToDate || 'default';
          return {
            ...prev,
            [staffId]: {
              ...(prev[staffId] || {}),
              [dateKey]: canDoEarlyShift,
            },
          };
        });

        console.log(`✅ [useEarlyShiftPreferences] Preference saved successfully`);
      } catch (err) {
        console.error("❌ [useEarlyShiftPreferences] Failed to save preference:", err);
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  // Bulk save multiple preferences with date and source tracking
  const bulkSavePreferences = useCallback(
    async (staffPreferences, appliesToDate = null, preferenceSource = 'bulk_assignment') => {
      if (!restaurantId) {
        const errorMsg = "Restaurant ID is required. Please ensure restaurant context is initialized.";
        console.error("❌ [useEarlyShiftPreferences] bulkSavePreferences called without restaurant_id");
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        setError(null);

        console.log(
          `🔄 [useEarlyShiftPreferences] Bulk saving ${Object.keys(staffPreferences).length} preferences (date: ${appliesToDate}, source: ${preferenceSource})`
        );

        // Process each staff preference
        const promises = Object.entries(staffPreferences).map(async ([staffId, canDoEarlyShift]) => {
          // Check if record exists
          const query = supabase
            .from("staff_early_shift_preferences")
            .select("id")
            .eq("restaurant_id", restaurantId)
            .eq("staff_id", staffId);

          if (appliesToDate) {
            query.eq("applies_to_date", appliesToDate);
          } else {
            query.is("applies_to_date", null);
          }

          const { data: existingPref } = await query.maybeSingle();

          if (existingPref) {
            // Update existing
            return supabase
              .from("staff_early_shift_preferences")
              .update({
                can_do_early_shift: canDoEarlyShift,
                preference_source: preferenceSource,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingPref.id);
          } else {
            // Insert new
            return supabase
              .from("staff_early_shift_preferences")
              .insert({
                restaurant_id: restaurantId,
                staff_id: staffId,
                can_do_early_shift: canDoEarlyShift,
                applies_to_date: appliesToDate,
                preference_source: preferenceSource,
              });
          }
        });

        const results = await Promise.all(promises);

        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
          throw new Error(`Failed to save ${errors.length} preferences`);
        }

        // Update local state
        setPreferences((prev) => {
          const dateKey = appliesToDate || 'default';
          const updated = { ...prev };
          Object.entries(staffPreferences).forEach(([staffId, canDoEarlyShift]) => {
            if (!updated[staffId]) {
              updated[staffId] = {};
            }
            updated[staffId][dateKey] = canDoEarlyShift;
          });
          return updated;
        });

        console.log(`✅ [useEarlyShiftPreferences] Bulk save successful`);
      } catch (err) {
        console.error("❌ [useEarlyShiftPreferences] Failed to bulk save preferences:", err);
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  // Get preference for a specific staff member and date
  const getPreferenceForStaff = useCallback(
    (staffId, appliesToDate = null) => {
      const dateKey = appliesToDate || 'default';
      return preferences[staffId]?.[dateKey] || false;
    },
    [preferences]
  );

  // Check if a staff member can do early shifts for a specific date
  const canDoEarlyShift = useCallback(
    (staffId, appliesToDate = null) => {
      const dateKey = appliesToDate || 'default';
      return preferences[staffId]?.[dateKey] === true;
    },
    [preferences]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    console.log("🔌 [useEarlyShiftPreferences] Setting up real-time subscription");

    const channel = supabase
      .channel("early_shift_prefs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_early_shift_preferences",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log("🔔 [useEarlyShiftPreferences] Real-time update:", payload);

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newPref = payload.new;
            setPreferences((prev) => {
              const dateKey = newPref.applies_to_date || 'default';
              return {
                ...prev,
                [newPref.staff_id]: {
                  ...(prev[newPref.staff_id] || {}),
                  [dateKey]: newPref.can_do_early_shift,
                },
              };
            });
          } else if (payload.eventType === "DELETE") {
            const oldPref = payload.old;
            setPreferences((prev) => {
              const dateKey = oldPref.applies_to_date || 'default';
              const updated = { ...prev };
              if (updated[oldPref.staff_id]) {
                const staffPrefs = { ...updated[oldPref.staff_id] };
                delete staffPrefs[dateKey];
                if (Object.keys(staffPrefs).length === 0) {
                  delete updated[oldPref.staff_id];
                } else {
                  updated[oldPref.staff_id] = staffPrefs;
                }
              }
              return updated;
            });
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      console.log("🔌 [useEarlyShiftPreferences] Cleaning up subscription");
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [restaurantId]);

  // Load preferences on mount and when restaurantId changes
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences, // { [staffId]: { [date]: boolean } }
    isLoading,
    error,
    savePreference, // (staffId: string, canDoEarlyShift: boolean, appliesToDate?: string, preferenceSource?: string) => Promise<void>
    bulkSavePreferences, // (staffPreferences: { [staffId]: boolean }, appliesToDate?: string, preferenceSource?: string) => Promise<void>
    getPreferenceForStaff, // (staffId: string, appliesToDate?: string) => boolean
    canDoEarlyShift, // (staffId: string, appliesToDate?: string) => boolean
    reload: loadPreferences, // () => Promise<void>
  };
};

export default useEarlyShiftPreferences;
