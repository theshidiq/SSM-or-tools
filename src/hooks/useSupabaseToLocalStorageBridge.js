/**
 * useSupabaseToLocalStorageBridge.js
 *
 * Bridges Supabase data to localStorage for ML training compatibility
 *
 * This hook syncs schedule data from Supabase to localStorage with the expected
 * keys that the ML training system looks for (scheduleData_0, scheduleData_1, etc.)
 *
 * This is a temporary bridge until the ML training system is updated to read
 * directly from Supabase.
 */

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

/**
 * Bridge Supabase data to localStorage for ML training
 * @param {boolean} autoSync - Whether to auto-sync periodically (default: false)
 * @param {number} syncIntervalMs - Sync interval in milliseconds (default: 5 minutes)
 * @returns {Object} Sync status and manual sync function
 */
export const useSupabaseToLocalStorageBridge = (
  autoSync = false,
  syncIntervalMs = 5 * 60 * 1000,
) => {
  const [syncStatus, setSyncStatus] = useState({
    syncing: false,
    lastSync: null,
    periodsSynced: 0,
    error: null,
  });

  /**
   * Sync schedule data from Supabase to localStorage
   */
  const syncSupabaseToLocalStorage = async () => {
    try {
      console.log("🔄 [Bridge] Starting Supabase → localStorage sync...");
      setSyncStatus((prev) => ({ ...prev, syncing: true, error: null }));

      // Fetch all schedules from Supabase
      const { data: schedules, error: schedulesError } = await supabase
        .from("schedules")
        .select("id, schedule_data, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (schedulesError) {
        throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
      }

      // Fetch schedule_staff_assignments to map schedules to periods
      const { data: assignments, error: assignmentsError } = await supabase
        .from("schedule_staff_assignments")
        .select("schedule_id, staff_id, period_index");

      if (assignmentsError) {
        throw new Error(
          `Failed to fetch assignments: ${assignmentsError.message}`,
        );
      }

      if (!schedules || schedules.length === 0) {
        console.warn("⚠️ [Bridge] No schedules found in Supabase");
        setSyncStatus({
          syncing: false,
          lastSync: new Date().toISOString(),
          periodsSynced: 0,
          error: "No schedules found in Supabase",
        });
        return { success: false, periodsSynced: 0 };
      }

      // Fetch all staff members from Supabase
      const { data: allStaff, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false});

      if (staffError) {
        throw new Error(`Failed to fetch staff: ${staffError.message}`);
      }

      console.log(
        `📊 [Bridge] Found ${schedules.length} schedules, ${assignments?.length || 0} assignments, and ${allStaff?.length || 0} staff records`,
      );

      // Group schedules by period using the assignments
      const periodMap = {};
      const staffByPeriod = {};

      // Create a map of schedule_id => schedule for quick lookup
      const scheduleMap = {};
      schedules.forEach((schedule) => {
        scheduleMap[schedule.id] = schedule;
      });

      // Process assignments to build period map
      if (assignments && assignments.length > 0) {
        assignments.forEach((assignment) => {
          const schedule = scheduleMap[assignment.schedule_id];
          if (!schedule) return;

          const periodIndex = assignment.period_index;
          const staffId = assignment.staff_id;

          if (!periodMap[periodIndex]) {
            periodMap[periodIndex] = {};
          }

          // Parse schedule data (expecting JSON object with staff-date-shift structure)
          let scheduleData = {};
          try {
            if (typeof schedule.schedule_data === "string") {
              scheduleData = JSON.parse(schedule.schedule_data);
            } else if (typeof schedule.schedule_data === "object" && schedule.schedule_data) {
              scheduleData = schedule.schedule_data;
            }
          } catch (parseError) {
            console.warn(
              `⚠️ [Bridge] Failed to parse schedule_data for schedule ${schedule.id}:`,
              parseError,
            );
          }

          // Store shifts for this staff member in this period
          if (staffId && scheduleData[staffId]) {
            periodMap[periodIndex][staffId] = scheduleData[staffId];
          }
        });
      }

      // Process staff data - staff table doesn't have period_index
      // Staff members are linked to periods via schedule_staff_assignments
      if (allStaff && allStaff.length > 0) {
        // Group all staff (they're shared across periods)
        // We'll replicate them for each period that has schedules
        Object.keys(periodMap).forEach((periodIndex) => {
          if (!staffByPeriod[periodIndex]) {
            staffByPeriod[periodIndex] = [];
          }

          // Find staff members that have schedules for this period
          const staffIdsInPeriod = Object.keys(periodMap[periodIndex]);
          staffIdsInPeriod.forEach((staffId) => {
            const staffMember = allStaff.find((s) => s.id === staffId);
            if (
              staffMember &&
              !staffByPeriod[periodIndex].find((s) => s.id === staffId)
            ) {
              staffByPeriod[periodIndex].push(staffMember);
            }
          });
        });
      }

      // Write to localStorage with expected keys
      let syncedCount = 0;
      Object.keys(periodMap).forEach((periodIndex) => {
        // FIXED: Use correct localStorage keys that match optimizedStorage format
        const scheduleKey = `schedule-${periodIndex}`;
        const staffKey = `staff-${periodIndex}`;

        try {
          // Write schedule data
          localStorage.setItem(
            scheduleKey,
            JSON.stringify(periodMap[periodIndex]),
          );

          // Write staff data if available
          if (staffByPeriod[periodIndex]) {
            localStorage.setItem(
              staffKey,
              JSON.stringify(staffByPeriod[periodIndex]),
            );
          }

          syncedCount++;
          console.log(
            `✅ [Bridge] Synced period ${periodIndex}: ${Object.keys(periodMap[periodIndex]).length} staff members`,
          );
        } catch (storageError) {
          console.error(
            `❌ [Bridge] Failed to write period ${periodIndex} to localStorage:`,
            storageError,
          );
        }
      });

      console.log(
        `🎉 [Bridge] Sync complete! Synced ${syncedCount} periods to localStorage`,
      );

      setSyncStatus({
        syncing: false,
        lastSync: new Date().toISOString(),
        periodsSynced: syncedCount,
        error: null,
      });

      return { success: true, periodsSynced: syncedCount };
    } catch (error) {
      console.error("❌ [Bridge] Sync failed:", error);
      setSyncStatus({
        syncing: false,
        lastSync: new Date().toISOString(),
        periodsSynced: 0,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    // Sync on mount
    syncSupabaseToLocalStorage();

    // Set up periodic sync if enabled
    if (autoSync) {
      console.log(
        `🔁 [Bridge] Auto-sync enabled (interval: ${syncIntervalMs / 1000}s)`,
      );
      const interval = setInterval(syncSupabaseToLocalStorage, syncIntervalMs);
      return () => {
        console.log("🛑 [Bridge] Auto-sync disabled");
        clearInterval(interval);
      };
    }
  }, [autoSync, syncIntervalMs]);

  return {
    syncStatus,
    syncManually: syncSupabaseToLocalStorage,
  };
};

/**
 * Utility function to check if localStorage has synced data
 * @returns {Object} Check result with periods found
 */
export const checkLocalStorageSync = () => {
  const result = {
    hasSyncedData: false,
    periodsFound: [],
    totalPeriods: 0,
  };

  for (let i = 0; i < 100; i++) {
    const key = `scheduleData_${i}`;
    const data = localStorage.getItem(key);

    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (
          parsed &&
          typeof parsed === "object" &&
          Object.keys(parsed).length > 0
        ) {
          result.periodsFound.push(i);
        }
      } catch {
        // Invalid data, skip
      }
    }
  }

  result.hasSyncedData = result.periodsFound.length > 0;
  result.totalPeriods = result.periodsFound.length;

  return result;
};

export default useSupabaseToLocalStorageBridge;
