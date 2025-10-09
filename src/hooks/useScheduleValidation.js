/**
 * Schedule Validation Hook
 *
 * Validates schedule data against staff groups and daily limits settings
 * Used by Settings Modal to detect conflicts before saving settings changes
 *
 * Features:
 * - Staff group conflict detection (members working same shift on same day)
 * - Daily limits compliance checking (shift counts vs configured limits)
 * - Real-time validation with schedule data integration
 * - Support for both WebSocket and Supabase data sources
 */

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { PREFETCH_QUERY_KEYS } from "./useScheduleDataPrefetch";

/**
 * Staff Groups Conflict Validation
 *
 * Checks if staff group members are working on the same date
 * This violates the intra-group conflict prevention rule
 *
 * @param {Object} currentSchedule - Schedule data { [staffId]: { [dateKey]: shiftValue } }
 * @param {Array} staffGroups - Staff groups configuration
 * @returns {Array} List of conflicts with date, group, and members
 */
export const validateStaffGroupConflicts = (currentSchedule, staffGroups) => {
  if (!currentSchedule || !staffGroups || staffGroups.length === 0) {
    return [];
  }

  const conflicts = [];
  const processedDates = new Set();

  // Get all unique dates from schedule
  const allDates = new Set();
  Object.values(currentSchedule).forEach((staffSchedule) => {
    if (staffSchedule) {
      Object.keys(staffSchedule).forEach((dateKey) => allDates.add(dateKey));
    }
  });

  // Check each date for group conflicts
  allDates.forEach((dateKey) => {
    if (processedDates.has(dateKey)) return;
    processedDates.add(dateKey);

    // Find all staff working on this date (not off)
    const workingStaffOnDate = Object.keys(currentSchedule).filter(
      (staffId) => {
        const shift = currentSchedule[staffId]?.[dateKey];
        return shift && shift !== "×"; // Not off day
      },
    );

    // Check each group for conflicts
    staffGroups.forEach((group) => {
      const groupMembers = group.members || [];

      // Find group members working on this date
      const groupMembersWorking = workingStaffOnDate.filter((staffId) =>
        groupMembers.includes(staffId),
      );

      // Conflict: More than 1 group member working on same date
      if (groupMembersWorking.length > 1) {
        // Get the shifts for context
        const memberShifts = groupMembersWorking.map((staffId) => ({
          staffId,
          shift: currentSchedule[staffId][dateKey],
        }));

        conflicts.push({
          date: dateKey,
          groupId: group.id,
          groupName: group.name,
          members: groupMembersWorking,
          shifts: memberShifts,
          type: "intra_group_conflict",
        });
      }
    });
  });

  return conflicts;
};

/**
 * Daily Limits Compliance Validation
 *
 * Checks if current schedule exceeds configured daily limits
 * Supports different shift types (△ early, ○ normal) and scopes
 *
 * @param {Object} currentSchedule - Schedule data
 * @param {Array} dailyLimits - Daily limits configuration
 * @param {Array} staffMembers - Staff members for scope filtering
 * @returns {Array} List of violations with date, limit type, and counts
 */
export const validateDailyLimitsCompliance = (
  currentSchedule,
  dailyLimits,
  staffMembers = [],
) => {
  if (!currentSchedule || !dailyLimits || dailyLimits.length === 0) {
    return [];
  }

  const violations = [];
  const dateShiftCounts = {};

  // Calculate shift counts per date, categorized by shift type
  Object.entries(currentSchedule).forEach(([staffId, staffSchedule]) => {
    if (!staffSchedule) return;

    Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
      if (!shift || shift === "×") return; // Skip off days

      // Initialize date counts if not exists
      if (!dateShiftCounts[dateKey]) {
        dateShiftCounts[dateKey] = {
          "△": { all: 0, byScope: {} }, // Early shift
          "○": { all: 0, byScope: {} }, // Normal shift
          any: { all: 0, byScope: {} }, // Any shift (total)
          early: { all: 0, byScope: {} }, // Alias for △
          late: { all: 0, byScope: {} }, // Alias for ○
          off: { all: 0, byScope: {} }, // Off days (×)
        };
      }

      // Get staff member for scope filtering
      const staff = staffMembers.find((s) => s.id === staffId);
      const staffStatus = staff?.status || "unknown";

      // Count by shift type
      const shiftType =
        shift === "△" ? "early" : shift === "○" ? "late" : "any";

      // Increment counters
      if (shift === "△") {
        dateShiftCounts[dateKey]["△"].all++;
        dateShiftCounts[dateKey]["early"].all++;
        if (!dateShiftCounts[dateKey]["△"].byScope[staffStatus]) {
          dateShiftCounts[dateKey]["△"].byScope[staffStatus] = [];
        }
        dateShiftCounts[dateKey]["△"].byScope[staffStatus].push(staffId);
      } else if (shift === "○") {
        dateShiftCounts[dateKey]["○"].all++;
        dateShiftCounts[dateKey]["late"].all++;
        if (!dateShiftCounts[dateKey]["○"].byScope[staffStatus]) {
          dateShiftCounts[dateKey]["○"].byScope[staffStatus] = [];
        }
        dateShiftCounts[dateKey]["○"].byScope[staffStatus].push(staffId);
      }

      // Always increment 'any' counter
      dateShiftCounts[dateKey]["any"].all++;
      if (!dateShiftCounts[dateKey]["any"].byScope[staffStatus]) {
        dateShiftCounts[dateKey]["any"].byScope[staffStatus] = [];
      }
      dateShiftCounts[dateKey]["any"].byScope[staffStatus].push(staffId);
    });
  });

  // Check each limit against the calculated counts
  dailyLimits.forEach((limit) => {
    const {
      shiftType = "any",
      maxCount = 0,
      daysOfWeek = [],
      scope = "all",
      targetIds = [],
      name = "Unnamed Limit",
    } = limit;

    // Map shift type to count key
    const countKey =
      shiftType === "early" ? "△" : shiftType === "late" ? "○" : shiftType;

    // Check each date
    Object.entries(dateShiftCounts).forEach(([dateKey, counts]) => {
      // Parse date and check if it matches daysOfWeek filter
      const date = new Date(dateKey);
      const dayOfWeek = date.getDay();

      // Skip if this day is not in the limit's daysOfWeek filter
      if (daysOfWeek.length > 0 && !daysOfWeek.includes(dayOfWeek)) {
        return;
      }

      // Get count based on scope
      let actualCount = 0;
      const violatingStaff = [];

      if (scope === "all") {
        actualCount = counts[countKey]?.all || 0;
      } else if (scope === "staff_status") {
        // Sum counts for all target statuses
        targetIds.forEach((status) => {
          const staffInScope = counts[countKey]?.byScope[status] || [];
          actualCount += staffInScope.length;
          violatingStaff.push(...staffInScope);
        });
      } else if (scope === "individual") {
        // Count only if target staff are working
        targetIds.forEach((staffId) => {
          Object.values(counts[countKey]?.byScope || {}).forEach(
            (staffList) => {
              if (staffList.includes(staffId)) {
                actualCount++;
                violatingStaff.push(staffId);
              }
            },
          );
        });
      }

      // Check if limit is exceeded
      if (actualCount > maxCount) {
        violations.push({
          date: dateKey,
          limitId: limit.id,
          limitName: name,
          shiftType: countKey,
          scope,
          targetIds,
          maxCount,
          actualCount,
          violatingStaff: [...new Set(violatingStaff)], // Remove duplicates
          type: "daily_limit_exceeded",
          dayOfWeek: format(date, "EEEE", { locale: ja }),
        });
      }
    });
  });

  return violations;
};

/**
 * useScheduleValidation Hook
 *
 * Provides validation functions with access to current schedule data
 * Integrates with React Query cache for efficient data access
 */
export const useScheduleValidation = (currentScheduleId = null) => {
  const queryClient = useQueryClient();

  /**
   * Get schedule data from cache or return empty object
   */
  const getScheduleData = useCallback(
    async (scheduleId) => {
      if (!scheduleId) {
        // No schedule ID provided - this is expected when no schedule is loaded
        // Return empty object to skip validation (no conflicts will be found)
        return {};
      }

      // Try to get from cache first
      const cachedData = queryClient.getQueryData(
        PREFETCH_QUERY_KEYS.scheduleData(scheduleId),
      );

      if (cachedData?.schedule) {
        console.log("✅ useScheduleValidation: Using cached schedule data");
        return cachedData.schedule;
      }

      // If not in cache, return empty object
      // The validation will return no conflicts/violations
      // This is expected when settings are changed before any schedule is loaded
      return {};
    },
    [queryClient],
  );

  /**
   * Validate staff groups against current schedule
   *
   * @param {Array} newStaffGroups - New staff groups configuration to validate
   * @returns {Promise<Array>} List of conflicts
   */
  const validateStaffGroups = useCallback(
    async (newStaffGroups) => {
      const scheduleData = await getScheduleData(currentScheduleId);
      return validateStaffGroupConflicts(scheduleData, newStaffGroups);
    },
    [currentScheduleId, getScheduleData],
  );

  /**
   * Validate daily limits against current schedule
   *
   * @param {Array} newDailyLimits - New daily limits configuration to validate
   * @param {Array} staffMembers - Staff members for scope filtering
   * @returns {Promise<Array>} List of violations
   */
  const validateDailyLimits = useCallback(
    async (newDailyLimits, staffMembers = []) => {
      const scheduleData = await getScheduleData(currentScheduleId);
      return validateDailyLimitsCompliance(
        scheduleData,
        newDailyLimits,
        staffMembers,
      );
    },
    [currentScheduleId, getScheduleData],
  );

  return {
    validateStaffGroups,
    validateDailyLimits,
    getScheduleData,
  };
};

export default useScheduleValidation;
