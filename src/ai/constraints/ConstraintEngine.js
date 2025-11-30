/**
 * ConstraintEngine.js
 *
 * Core constraint validation engine for shift scheduling.
 * Implements all business rules and constraints for restaurant staff scheduling.
 */

import { getDaysInMonth } from "../../utils/dateUtils";
import { ConfigurationService } from "../../services/ConfigurationService.js";

// Configuration service instance - will be initialized when first used
let configService = null;
const configCache = new Map();
let cacheTimestamp = 0;
// ✅ PHASE 3 FIX: Reduced cache duration from 5 minutes to 30 seconds
// This minimizes stale data window while maintaining performance
const CACHE_DURATION = 30 * 1000; // 30 seconds (was 5 minutes)

// Cache invalidation callbacks
const cacheInvalidationCallbacks = new Set();
let settingsChangeWatcher = null;

/**
 * Initialize configuration service with real-time cache invalidation
 * @param {string} restaurantId - Restaurant ID for configuration
 */
export const initializeConstraintConfiguration = async (restaurantId) => {
  if (!configService && restaurantId) {
    configService = new ConfigurationService();
    await configService.initialize({ restaurantId });

    // Set up real-time cache invalidation
    setupCacheInvalidationWatcher();

    console.log(
      "✅ Constraint Engine configuration service initialized with real-time cache invalidation",
    );
  }
  return configService;
};

/**
 * Set up real-time cache invalidation when settings change
 */
const setupCacheInvalidationWatcher = () => {
  if (settingsChangeWatcher) {
    return; // Already set up
  }

  // Watch for localStorage changes (settings updates)
  settingsChangeWatcher = () => {
    console.log(
      "🔄 Settings change detected, invalidating constraint cache...",
    );
    invalidateConfigurationCache();
  };

  // Listen for storage events (when settings change in other tabs/windows)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === "shift-schedule-settings") {
        settingsChangeWatcher();
      }
    });
  }

  // Also check for direct ConfigurationService changes
  if (configService) {
    // Monkey patch the saveSettings method to trigger cache invalidation
    const originalSaveSettings = configService.saveSettings.bind(configService);
    configService.saveSettings = async function (settings) {
      const result = await originalSaveSettings(settings);
      if (result) {
        console.log(
          "🔄 Configuration updated, invalidating constraint cache...",
        );
        invalidateConfigurationCache();
      }
      return result;
    };
  }
};

/**
 * Get configuration with caching and real-time invalidation
 * @param {string} configType - Type of configuration to get
 */
const getCachedConfig = async (configType) => {
  const now = Date.now();
  const cacheKey = `${configType}_${now}`;

  // Check if cache is still valid (immediate invalidation if forced)
  if (
    configCache.has(configType) &&
    now - cacheTimestamp < CACHE_DURATION &&
    !configCache.get("_invalidated")
  ) {
    console.log(`📋 Using cached ${configType} configuration`);
    return configCache.get(configType);
  }

  // Loading fresh configuration (reduced logging for Phase 4)

  // Load fresh configuration with timeout protection
  if (configService) {
    try {
      // Add timeout to prevent blocking
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Configuration loading timeout for ${configType}`),
            ),
          5000,
        ),
      );

      let configPromise;
      switch (configType) {
        case "staff_groups":
          configPromise = configService.getStaffGroups();
          break;
        case "priority_rules":
          configPromise = configService.getPriorityRules();
          break;
        case "daily_limits":
          configPromise = configService.getDailyLimits();
          break;
        case "weekly_limits":
          configPromise = configService.getWeeklyLimits();
          break;
        case "monthly_limits":
          configPromise = configService.getMonthlyLimits();
          break;
        case "backup_assignments":
          configPromise = configService.getBackupAssignments();
          break;
        default:
          configPromise = Promise.resolve(null);
      }

      const config = await Promise.race([configPromise, timeoutPromise]);

      if (config) {
        configCache.set(configType, config);
        cacheTimestamp = now;

        // Clear invalidation flag
        configCache.delete("_invalidated");

        // Notify cache invalidation callbacks
        notifyCacheUpdate(configType, config);

        console.log(`✅ Fresh ${configType} configuration loaded and cached`);
        return config;
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to load ${configType} configuration (using fallback):`,
        error.message,
      );
    }
  }

  // Fallback to static configuration (silent for Phase 4)
  return getStaticConfiguration(configType);
};

/**
 * Invalidate configuration cache immediately
 */
export const invalidateConfigurationCache = () => {
  console.log(
    "🔄 Configuration cache invalidated - next access will reload from source",
  );
  configCache.set("_invalidated", true);
  cacheTimestamp = 0; // Force cache miss

  // Notify all registered callbacks
  cacheInvalidationCallbacks.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.warn("⚠️ Cache invalidation callback failed:", error);
    }
  });
};

/**
 * Register a callback to be called when configuration cache is invalidated
 * @param {Function} callback - Callback function
 * @returns {Function} Unregister function
 */
export const onConfigurationCacheInvalidated = (callback) => {
  cacheInvalidationCallbacks.add(callback);
  return () => cacheInvalidationCallbacks.delete(callback);
};

/**
 * Notify cache update callbacks
 * @param {string} configType - Configuration type that was updated
 * @param {*} config - New configuration data
 */
const notifyCacheUpdate = (configType, config) => {
  console.log(`📡 Broadcasting ${configType} configuration update`);
  // Could be extended to notify specific type listeners in the future
};

/**
 * Get static fallback configuration
 */
const getStaticConfiguration = (configType) => {
  switch (configType) {
    case "staff_groups":
      return STATIC_STAFF_CONFLICT_GROUPS;
    case "priority_rules":
      return STATIC_PRIORITY_RULES;
    case "daily_limits":
      return STATIC_DAILY_LIMITS;
    case "weekly_limits":
      return STATIC_WEEKLY_LIMITS;
    case "monthly_limits":
      return (year, month) => getStaticMonthlyLimits(year, month);
    default:
      return null;
  }
};

/**
 * ✅ CLEANED: Removed hardcoded staff groups
 * Staff groups should ONLY come from database via ConfigurationService
 * NO static fallback to prevent using deleted/outdated groups
 */
const STATIC_STAFF_CONFLICT_GROUPS = [];

/**
 * Static priority rules for specific staff members
 * ✅ CLEANED: Removed hardcoded test data (料理長, 与儀)
 * Priority rules should come from database/ConfigurationService only
 */
const STATIC_PRIORITY_RULES = [];

/**
 * Static daily limits for different shift types
 * NOTE: This is now loaded dynamically via getDailyLimits() from ConfigurationService
 * Fallback values are only used when configuration cannot be loaded
 */
const STATIC_DAILY_LIMITS = {
  minOffPerDay: 0,
  maxOffPerDay: 4,
  minEarlyPerDay: 0,
  maxEarlyPerDay: 4,
  minLatePerDay: 0,
  maxLatePerDay: 3,
  minWorkingStaffPerDay: 3,
};

/**
 * Static weekly limits (rolling 7-day window constraints)
 * Used as fallback when database limits are not available
 */
const STATIC_WEEKLY_LIMITS = [
  {
    id: "default-weekly-off",
    name: "Default Weekly Off Limit",
    shiftType: "off",
    maxCount: 2, // Max 2 days off in any 7-day period
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    scope: "all",
    targetIds: [],
    isHard: true,
    penalty: 50,
  },
];

/**
 * Static monthly limits based on days in month
 */
const getStaticMonthlyLimits = (year, month) => {
  const daysInMonth = getDaysInMonth(year, month);
  return {
    maxOffDaysPerMonth: daysInMonth === 31 ? 8 : 7,
    minWorkDaysPerMonth: daysInMonth === 31 ? 23 : 23,
  };
};

// Dynamic getters that use configuration service with real-time cache invalidation
export const getStaffConflictGroups = async () => {
  return await getCachedConfig("staff_groups");
};

export const getPriorityRules = async () => {
  return await getCachedConfig("priority_rules");
};

export const getDailyLimits = async () => {
  return await getCachedConfig("daily_limits");
};

/**
 * Get weekly limits from database
 * Weekly limits validate rolling 7-day windows for shift constraints
 * Example: Max 2 days off within any 7-day period
 */
export const getWeeklyLimits = async () => {
  return await getCachedConfig("weekly_limits");
};

export const getBackupAssignments = async () => {
  return await getCachedConfig("backup_assignments");
};

export const getMonthlyLimits = async (year, month) => {
  const limits = await getCachedConfig("monthly_limits");

  if (typeof limits === "function") {
    return limits(year, month);
  } else if (Array.isArray(limits)) {
    // New array format from ConfigurationService
    const daysInMonth = getDaysInMonth(year, month);
    const offDaysLimit = limits.find((l) => l.limitType === "max_off_days");

    return {
      maxOffDaysPerMonth:
        offDaysLimit?.maxCount || (daysInMonth === 31 ? 8 : 7),
      minWorkDaysPerMonth:
        daysInMonth - (offDaysLimit?.maxCount || (daysInMonth === 31 ? 8 : 7)),
    };
  } else if (limits && typeof limits === "object") {
    // Legacy object format
    const daysInMonth = getDaysInMonth(year, month);
    return {
      maxOffDaysPerMonth:
        limits.maxOffDaysPerMonth || (daysInMonth === 31 ? 8 : 7),
      minWorkDaysPerMonth: limits.minWorkDaysPerMonth || 23,
    };
  }

  // Fallback to static calculation
  return getStaticMonthlyLimits(year, month);
};

/**
 * Force refresh of all cached configurations
 */
export const refreshAllConfigurations = async () => {
  console.log("🔄 Force refreshing all configurations...");
  invalidateConfigurationCache();

  // Preload fresh configurations
  const refreshTasks = [
    getCachedConfig("staff_groups"),
    getCachedConfig("priority_rules"),
    getCachedConfig("daily_limits"),
    getCachedConfig("weekly_limits"), // ✅ NEW: Weekly limits cache refresh
    getCachedConfig("monthly_limits"),
    getCachedConfig("backup_assignments"),
  ];

  await Promise.allSettled(refreshTasks);
  console.log("✅ All configurations refreshed");
};

// Export static versions for backward compatibility
export const STAFF_CONFLICT_GROUPS = STATIC_STAFF_CONFLICT_GROUPS;
export const PRIORITY_RULES = STATIC_PRIORITY_RULES;
export const DAILY_LIMITS = STATIC_DAILY_LIMITS;

/**
 * Constraint violation types
 */
export const VIOLATION_TYPES = {
  MONTHLY_OFF_LIMIT: "monthly_off_limit",
  DAILY_OFF_LIMIT: "daily_off_limit",
  DAILY_EARLY_LIMIT: "daily_early_limit",
  WEEKLY_OFF_LIMIT: "weekly_off_limit", // ✅ NEW: Rolling 7-day window off day limit
  WEEKLY_EARLY_LIMIT: "weekly_early_limit", // ✅ NEW: Rolling 7-day window early shift limit
  WEEKLY_LATE_LIMIT: "weekly_late_limit", // ✅ NEW: Rolling 7-day window late shift limit
  STAFF_GROUP_CONFLICT: "staff_group_conflict",
  PRIORITY_RULE_VIOLATION: "priority_rule_violation",
  INSUFFICIENT_COVERAGE: "insufficient_coverage",
  CONSECUTIVE_DAYS_OFF: "consecutive_days_off",
  COVERAGE_COMPENSATION_VIOLATION: "coverage_compensation_violation",
  PROXIMITY_PATTERN_VIOLATION: "proximity_pattern_violation",
  CONSECUTIVE_SAME_PATTERN: "consecutive_same_pattern", // ✅ NEW: Consecutive same shift patterns (× or △)
};

/**
 * Check if a shift value represents an off day
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's an off day
 */
export const isOffDay = (shiftValue) => {
  return (
    shiftValue === "×" ||
    shiftValue === "off" ||
    shiftValue === "★" ||
    shiftValue === "holiday"
  );
};

/**
 * Check if a shift value represents an early shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's an early shift
 */
export const isEarlyShift = (shiftValue) => {
  return shiftValue === "△" || shiftValue === "early";
};

/**
 * Check if a shift value represents a late shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a late shift
 */
export const isLateShift = (shiftValue) => {
  return shiftValue === "◇" || shiftValue === "late";
};

/**
 * Check if a shift value represents a normal shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a normal shift
 */
export const isNormalShift = (shiftValue) => {
  return shiftValue === "" || shiftValue === "○" || shiftValue === "normal";
};

/**
 * Check if a shift value represents a working shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a working shift
 */
export const isWorkingShift = (shiftValue) => {
  return (
    !isOffDay(shiftValue) && shiftValue !== undefined && shiftValue !== null
  );
};

/**
 * Check if a date is a weekday (Monday-Friday)
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @returns {boolean} True if it's a weekday
 */
export const isWeekday = (dateKey) => {
  const date = new Date(dateKey);
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
};

/**
 * Get day of week from date string
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @returns {string} Day of week (sunday, monday, etc.)
 */
export const getDayOfWeek = (dateKey) => {
  const date = new Date(dateKey);
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()];
};

/**
 * Validate monthly off day limits for a staff member
 * @param {Object} staffSchedule - Staff member's schedule for the month
 * @param {string} staffName - Staff member's name
 * @param {Array} dateRange - Array of dates for the month
 * @returns {Object} Validation result
 */
export const validateMonthlyOffLimits = async (
  staffSchedule,
  staffName,
  dateRange,
) => {
  if (!staffSchedule || !dateRange.length) {
    return { valid: true, violations: [] };
  }

  const firstDate = dateRange[0];
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth() + 1;
  const monthlyLimits = await getMonthlyLimits(year, month);

  let offDaysCount = 0;
  const offDays = [];

  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    if (staffSchedule[dateKey] && isOffDay(staffSchedule[dateKey])) {
      offDaysCount++;
      offDays.push(dateKey);
    }
  });

  const violations = [];
  if (offDaysCount > monthlyLimits.maxOffDaysPerMonth) {
    violations.push({
      type: VIOLATION_TYPES.MONTHLY_OFF_LIMIT,
      staffName,
      message: `${staffName} has ${offDaysCount} off days, exceeding limit of ${monthlyLimits.maxOffDaysPerMonth}`,
      severity: "high",
      details: {
        offDaysCount,
        limit: monthlyLimits.maxOffDaysPerMonth,
        offDays,
        excess: offDaysCount - monthlyLimits.maxOffDaysPerMonth,
      },
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    summary: {
      offDaysCount,
      limit: monthlyLimits.maxOffDaysPerMonth,
      remaining: Math.max(0, monthlyLimits.maxOffDaysPerMonth - offDaysCount),
    },
  };
};

/**
 * Validate daily limits for a specific date
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateDailyLimits = async (
  scheduleData,
  dateKey,
  staffMembers,
) => {
  const violations = [];
  const dailyLimits = await getDailyLimits();

  let offCount = 0;
  let earlyCount = 0;
  let lateCount = 0;
  let workingCount = 0;
  const totalStaff = staffMembers.length;

  const dayData = {
    off: [],
    early: [],
    late: [],
    working: [],
  };

  staffMembers.forEach((staff) => {
    if (
      scheduleData[staff.id] &&
      scheduleData[staff.id][dateKey] !== undefined
    ) {
      const shift = scheduleData[staff.id][dateKey];

      if (isOffDay(shift)) {
        offCount++;
        dayData.off.push(staff.name);
      } else if (isEarlyShift(shift)) {
        // ✅ EARLY SHIFT LIMIT: Only count 社員 staff (exclude 派遣 and パート)
        if (staff.status === "社員") {
          earlyCount++;
          dayData.early.push(staff.name);
        } else {
          console.log(
            `⏭️ [EARLY-SHIFT-SKIP] ${staff.name} (${staff.status}): Early shift does not count toward limit`,
          );
        }
      } else if (isLateShift(shift)) {
        lateCount++;
        dayData.late.push(staff.name);
      }

      if (isWorkingShift(shift)) {
        workingCount++;
        dayData.working.push(staff.name);
      }
    }
  });

  // Check daily off limit (MAX)
  const maxOffPerDay = dailyLimits.maxOffPerDay || 4;
  if (offCount > maxOffPerDay) {
    violations.push({
      type: VIOLATION_TYPES.DAILY_OFF_LIMIT,
      date: dateKey,
      message: `Too many staff off on ${dateKey}: ${offCount} exceeds limit of ${maxOffPerDay}`,
      severity: "high",
      details: {
        offCount,
        limit: maxOffPerDay,
        staffOff: dayData.off,
        excess: offCount - maxOffPerDay,
      },
    });
  }

  // Check daily off limit (MIN)
  const minOffPerDay = dailyLimits.minOffPerDay || 0;
  if (minOffPerDay > 0 && offCount < minOffPerDay) {
    violations.push({
      type: "min_off_per_day",
      date: dateKey,
      message: `Too few staff off on ${dateKey}: ${offCount} is below minimum of ${minOffPerDay}`,
      severity: "medium",
      details: {
        offCount,
        limit: minOffPerDay,
        staffOff: dayData.off,
        deficit: minOffPerDay - offCount,
      },
    });
  }

  // Check daily early shift limit (MAX)
  const maxEarlyPerDay = dailyLimits.maxEarlyPerDay || 3;
  if (earlyCount > maxEarlyPerDay) {
    violations.push({
      type: VIOLATION_TYPES.DAILY_EARLY_LIMIT,
      date: dateKey,
      message: `Too many early shifts on ${dateKey}: ${earlyCount} exceeds limit of ${maxEarlyPerDay}`,
      severity: "medium",
      details: {
        earlyCount,
        limit: maxEarlyPerDay,
        staffEarly: dayData.early,
        excess: earlyCount - maxEarlyPerDay,
      },
    });
  }

  // Check daily early shift limit (MIN)
  const minEarlyPerDay = dailyLimits.minEarlyPerDay || 0;
  if (minEarlyPerDay > 0 && earlyCount < minEarlyPerDay) {
    violations.push({
      type: "min_early_per_day",
      date: dateKey,
      message: `Too few early shifts on ${dateKey}: ${earlyCount} is below minimum of ${minEarlyPerDay}`,
      severity: "medium",
      details: {
        earlyCount,
        limit: minEarlyPerDay,
        staffEarly: dayData.early,
        deficit: minEarlyPerDay - earlyCount,
      },
    });
  }

  // Check daily late shift limit (MAX)
  const maxLatePerDay = dailyLimits.maxLatePerDay || 3;
  if (lateCount > maxLatePerDay) {
    violations.push({
      type: "max_late_per_day",
      date: dateKey,
      message: `Too many late shifts on ${dateKey}: ${lateCount} exceeds limit of ${maxLatePerDay}`,
      severity: "medium",
      details: {
        lateCount,
        limit: maxLatePerDay,
        staffLate: dayData.late,
        excess: lateCount - maxLatePerDay,
      },
    });
  }

  // Check daily late shift limit (MIN)
  const minLatePerDay = dailyLimits.minLatePerDay || 0;
  if (minLatePerDay > 0 && lateCount < minLatePerDay) {
    violations.push({
      type: "min_late_per_day",
      date: dateKey,
      message: `Too few late shifts on ${dateKey}: ${lateCount} is below minimum of ${minLatePerDay}`,
      severity: "medium",
      details: {
        lateCount,
        limit: minLatePerDay,
        staffLate: dayData.late,
        deficit: minLatePerDay - lateCount,
      },
    });
  }

  // Check minimum working staff
  const minWorkingStaffPerDay = dailyLimits.minWorkingStaffPerDay || 3;
  if (workingCount < minWorkingStaffPerDay) {
    violations.push({
      type: VIOLATION_TYPES.INSUFFICIENT_COVERAGE,
      date: dateKey,
      message: `Insufficient coverage on ${dateKey}: only ${workingCount} working, need at least ${minWorkingStaffPerDay}`,
      severity: "critical",
      details: {
        workingCount,
        requiredMinimum: minWorkingStaffPerDay,
        deficit: minWorkingStaffPerDay - workingCount,
        staffWorking: dayData.working,
      },
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    summary: {
      totalStaff,
      offCount,
      earlyCount,
      lateCount,
      workingCount,
      coverage: totalStaff > 0 ? (workingCount / totalStaff) * 100 : 0,
    },
  };
};

/**
 * Validate weekly limits using rolling 7-day windows
 * Ensures each staff member doesn't exceed maxCount days off/early/late in any consecutive 7-day period
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {Object} staffMember - Staff member object with id and name
 * @param {Array} dateRange - Array of Date objects for the period
 * @param {Array} weeklyLimits - Weekly limits configuration from database
 * @returns {Object} Validation result with violations array
 */
export const validateWeeklyLimits = async (
  scheduleData,
  staffMember,
  dateRange,
  weeklyLimits = null
) => {
  const violations = [];

  // Load weekly limits if not provided
  if (!weeklyLimits) {
    weeklyLimits = await getWeeklyLimits();
  }

  // Handle case where weeklyLimits is empty or invalid
  if (!weeklyLimits || !Array.isArray(weeklyLimits) || weeklyLimits.length === 0) {
    // Use static fallback
    weeklyLimits = STATIC_WEEKLY_LIMITS;
  }

  // Get staff schedule data
  const staffSchedule = scheduleData[staffMember.id];
  if (!staffSchedule) {
    return { valid: true, violations: [] };
  }

  // Need at least 7 days to validate weekly windows
  if (dateRange.length < 7) {
    return { valid: true, violations: [] };
  }

  // Get limits for different shift types
  const offLimit = weeklyLimits.find(l =>
    l.shiftType === "off" || l.shiftType === "×"
  );
  const earlyLimit = weeklyLimits.find(l =>
    l.shiftType === "early" || l.shiftType === "△"
  );
  const lateLimit = weeklyLimits.find(l =>
    l.shiftType === "late" || l.shiftType === "◇"
  );

  const maxOffDaysPerWeek = offLimit?.maxCount || 2;
  const maxEarlyDaysPerWeek = earlyLimit?.maxCount || 7; // Default: no limit
  const maxLateDaysPerWeek = lateLimit?.maxCount || 7; // Default: no limit

  // Rolling 7-day window validation
  // For a period of N days, we check (N - 6) windows
  // Example: 14 days = windows [0-6], [1-7], [2-8], ..., [7-13] = 8 windows
  for (let i = 0; i <= dateRange.length - 7; i++) {
    const window = dateRange.slice(i, i + 7);

    let daysOffInWindow = 0;
    let earlyShiftsInWindow = 0;
    let lateShiftsInWindow = 0;
    const windowDetails = {
      offDays: [],
      earlyDays: [],
      lateDays: [],
    };

    // Count shifts in this 7-day window
    window.forEach(date => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];

      if (shift !== undefined) {
        if (isOffDay(shift)) {
          daysOffInWindow++;
          windowDetails.offDays.push(dateKey);
        } else if (isEarlyShift(shift)) {
          earlyShiftsInWindow++;
          windowDetails.earlyDays.push(dateKey);
        } else if (isLateShift(shift)) {
          lateShiftsInWindow++;
          windowDetails.lateDays.push(dateKey);
        }
      }
    });

    const windowStart = window[0].toISOString().split("T")[0];
    const windowEnd = window[6].toISOString().split("T")[0];

    // Check off days limit
    if (offLimit && daysOffInWindow > maxOffDaysPerWeek) {
      violations.push({
        type: VIOLATION_TYPES.WEEKLY_OFF_LIMIT,
        severity: "high",
        staffId: staffMember.id,
        staffName: staffMember.name,
        window: {
          start: windowStart,
          end: windowEnd,
        },
        count: daysOffInWindow,
        limit: maxOffDaysPerWeek,
        message: `${staffMember.name} has ${daysOffInWindow} days off in 7-day window (${windowStart} to ${windowEnd}), exceeding limit of ${maxOffDaysPerWeek}`,
        details: {
          shiftType: "off",
          offDays: windowDetails.offDays,
          windowDates: window.map(d => d.toISOString().split("T")[0]),
          excess: daysOffInWindow - maxOffDaysPerWeek,
        },
      });
    }

    // Check early shifts limit
    if (earlyLimit && earlyShiftsInWindow > maxEarlyDaysPerWeek) {
      violations.push({
        type: VIOLATION_TYPES.WEEKLY_EARLY_LIMIT,
        severity: "medium",
        staffId: staffMember.id,
        staffName: staffMember.name,
        window: {
          start: windowStart,
          end: windowEnd,
        },
        count: earlyShiftsInWindow,
        limit: maxEarlyDaysPerWeek,
        message: `${staffMember.name} has ${earlyShiftsInWindow} early shifts in 7-day window (${windowStart} to ${windowEnd}), exceeding limit of ${maxEarlyDaysPerWeek}`,
        details: {
          shiftType: "early",
          earlyDays: windowDetails.earlyDays,
          windowDates: window.map(d => d.toISOString().split("T")[0]),
          excess: earlyShiftsInWindow - maxEarlyDaysPerWeek,
        },
      });
    }

    // Check late shifts limit
    if (lateLimit && lateShiftsInWindow > maxLateDaysPerWeek) {
      violations.push({
        type: VIOLATION_TYPES.WEEKLY_LATE_LIMIT,
        severity: "medium",
        staffId: staffMember.id,
        staffName: staffMember.name,
        window: {
          start: windowStart,
          end: windowEnd,
        },
        count: lateShiftsInWindow,
        limit: maxLateDaysPerWeek,
        message: `${staffMember.name} has ${lateShiftsInWindow} late shifts in 7-day window (${windowStart} to ${windowEnd}), exceeding limit of ${maxLateDaysPerWeek}`,
        details: {
          shiftType: "late",
          lateDays: windowDetails.lateDays,
          windowDates: window.map(d => d.toISOString().split("T")[0]),
          excess: lateShiftsInWindow - maxLateDaysPerWeek,
        },
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Validate staff group conflicts for a specific date
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateStaffGroupConflicts = async (
  scheduleData,
  dateKey,
  staffMembers,
) => {
  const violations = [];
  const staffGroups = await getStaffConflictGroups();

  staffGroups.forEach((group) => {
    const groupMembers = [];

    const members = group.members || [];
    members.forEach((memberId) => {
      // ✅ FIX: group.members contains staff IDs, not names
      const staff = staffMembers.find((s) => s.id === memberId);
      if (
        staff &&
        scheduleData[staff.id] &&
        scheduleData[staff.id][dateKey] !== undefined
      ) {
        const shift = scheduleData[staff.id][dateKey];
        groupMembers.push({ name: staff.name, shift });
      }
    });

    // ✅ ENHANCED: Separate checks for × (off) and △ (early) same-day conflicts
    // Check if multiple members have SAME off day (×)
    const offMembers = groupMembers.filter((member) =>
      isOffDay(member.shift),
    );
    if (offMembers.length > 1) {
      violations.push({
        type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
        subType: "same_day_off", // NEW: Specific sub-type
        date: dateKey,
        group: group.name,
        message: `${group.name} conflict on ${dateKey}: multiple members have same day off (×) - ${offMembers.map((m) => m.name).join(", ")}`,
        severity: "high",
        details: {
          groupName: group.name,
          groupMembers: members,
          conflictingMembers: offMembers.map(
            (m) => `${m.name} (${m.shift})`,
          ),
          conflictCount: offMembers.length,
          conflictType: "same_off_day",
        },
      });
    }

    // ✅ ENHANCED: Check if multiple members have SAME early shift (△)
    const earlyMembers = groupMembers.filter((member) =>
      isEarlyShift(member.shift),
    );
    if (earlyMembers.length > 1) {
      violations.push({
        type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
        subType: "same_early_shift", // NEW: Specific sub-type
        date: dateKey,
        group: group.name,
        message: `${group.name} conflict on ${dateKey}: multiple members have same early shift (△) - ${earlyMembers.map((m) => m.name).join(", ")}`,
        severity: "high",
        details: {
          groupName: group.name,
          groupMembers: members,
          conflictingMembers: earlyMembers.map(
            (m) => `${m.name} (${m.shift})`,
          ),
          conflictCount: earlyMembers.length,
          conflictType: "same_early_shift",
        },
      });
    }

    // ✅ NEW: Check for MIXED conflicts (ANY combination of × and △)
    // This catches: ××, △△, ×△, and △×
    const offOrEarlyMembers = groupMembers.filter((member) =>
      isOffDay(member.shift) || isEarlyShift(member.shift),
    );
    if (offOrEarlyMembers.length > 1) {
      // Only report if not already reported by same-type checks above
      const hasMixedTypes = offMembers.length > 0 && earlyMembers.length > 0;

      if (hasMixedTypes) {
        violations.push({
          type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
          subType: "mixed_off_early", // NEW: Mixed conflict sub-type
          date: dateKey,
          group: group.name,
          message: `${group.name} conflict on ${dateKey}: mixed off/early shifts - ${offOrEarlyMembers.map((m) => `${m.name}(${m.shift})`).join(", ")}`,
          severity: "high",
          details: {
            groupName: group.name,
            groupMembers: members,
            conflictingMembers: offOrEarlyMembers.map(
              (m) => `${m.name} (${m.shift})`,
            ),
            conflictCount: offOrEarlyMembers.length,
            conflictType: "mixed_off_early",
            offCount: offMembers.length,
            earlyCount: earlyMembers.length,
          },
        });
      }
    }
  });

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Validate priority rules for specific staff members
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validatePriorityRules = async (
  scheduleData,
  dateKey,
  staffMembers,
) => {
  const violations = [];
  const dayOfWeek = getDayOfWeek(dateKey);
  const priorityRules = await getPriorityRules();

  console.log(`🔍 [VALIDATION-DEBUG] Checking violations for date ${dateKey} (${dayOfWeek})`);
  console.log(`🔍 [VALIDATION-DEBUG] Priority rules object:`, JSON.stringify(priorityRules, null, 2));

  // Handle both database format (by staff ID) and static format (by staff name)
  const processRules = (staffIdentifier, rules) => {
    // Find staff by name or ID
    const staff = staffMembers.find(
      (s) => s.name === staffIdentifier || s.id === staffIdentifier,
    );
    if (
      !staff ||
      !scheduleData[staff.id] ||
      scheduleData[staff.id][dateKey] === undefined
    ) {
      return;
    }

    const currentShift = scheduleData[staff.id][dateKey];
    const preferredShifts = rules.preferredShifts || [];

    console.log(`🔍 [VALIDATION-DEBUG] ${staff.name}: preferredShifts =`, preferredShifts);

    preferredShifts.forEach((rule) => {
      console.log(`🔍 [VALIDATION-DEBUG] ${staff.name}: Checking rule day="${rule.day}" vs dayOfWeek="${dayOfWeek}"`);
      if (rule.day === dayOfWeek) {
        console.log(`🔍 [VALIDATION-DEBUG] ${staff.name}: MATCH! Checking shift="${rule.shift}" vs currentShift="${currentShift}"`);
        let ruleViolated = false;
        let expectedShift = "";

        switch (rule.shift) {
          case "early":
            ruleViolated = !isEarlyShift(currentShift);
            expectedShift = "early shift (△)";
            break;
          case "off":
            ruleViolated = !isOffDay(currentShift);
            expectedShift = "day off (×)";
            break;
          case "late":
            ruleViolated = !isLateShift(currentShift);
            expectedShift = "late shift (◇)";
            break;
        }

        if (ruleViolated) {
          violations.push({
            type: VIOLATION_TYPES.PRIORITY_RULE_VIOLATION,
            date: dateKey,
            staffName: staff.name,
            message: `${staff.name} priority rule violated on ${dayOfWeek}: should have ${expectedShift}, but has ${currentShift}`,
            severity: rule.priority === "high" ? "high" : "medium",
            details: {
              rule,
              expectedShift,
              actualShift: currentShift,
              dayOfWeek,
            },
          });
        }
      }
    });
  };

  // Process priority rules
  if (priorityRules && typeof priorityRules === "object") {
    Object.keys(priorityRules).forEach((staffIdentifier) => {
      processRules(staffIdentifier, priorityRules[staffIdentifier]);
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Check for consecutive days off (more than 2 in a row)
 * @param {Object} staffSchedule - Staff member's schedule for the month
 * @param {string} staffName - Staff member's name
 * @param {Array} dateRange - Array of dates for the month
 * @returns {Object} Validation result
 */
export const validateConsecutiveOffDays = (
  staffSchedule,
  staffName,
  dateRange,
) => {
  const violations = [];
  const consecutiveOffDays = [];
  let currentStreak = [];

  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    if (staffSchedule[dateKey] && isOffDay(staffSchedule[dateKey])) {
      currentStreak.push(dateKey);
    } else {
      if (currentStreak.length > 2) {
        consecutiveOffDays.push([...currentStreak]);
      }
      currentStreak = [];
    }
  });

  // Check the last streak
  if (currentStreak.length > 2) {
    consecutiveOffDays.push(currentStreak);
  }

  consecutiveOffDays.forEach((streak) => {
    violations.push({
      type: VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF,
      staffName,
      message: `${staffName} has ${streak.length} consecutive days off: ${streak.join(", ")}`,
      severity: "medium",
      details: {
        consecutiveDays: streak,
        streakLength: streak.length,
      },
    });
  });

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * ✅ NEW: Validate consecutive same shift patterns (× or △)
 * Prevents staff from having 2+ consecutive days of the same shift type
 * @param {Object} staffSchedule - Staff member's schedule { dateKey: shift }
 * @param {string} staffName - Staff member's name
 * @param {Array} dateRange - Array of Date objects representing the date range
 * @returns {Object} Validation result with violations array
 */
export const validateConsecutiveSameShiftPatterns = (
  staffSchedule,
  staffName,
  dateRange
) => {
  const violations = [];

  // Track consecutive × (off day) streaks
  let consecutiveOff = [];
  // Track consecutive △ (early shift) streaks
  let consecutiveEarly = [];

  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    const shift = staffSchedule[dateKey];

    // Check for consecutive off days (×)
    if (isOffDay(shift)) {
      consecutiveOff.push(dateKey);
    } else {
      // If streak ended and was 2+ days, record violation
      // ⚠️ ENHANCED: Graduated severity - high for 2, critical for 3+
      if (consecutiveOff.length >= 2) {
        // 🔍 DEBUG: Log consecutive pattern detection
        console.log("🔍 [VALIDATION DEBUG] Detected consecutive off-days:", {
          staffName,
          streakLength: consecutiveOff.length,
          severity: consecutiveOff.length >= 3 ? "critical" : "high",
          dates: consecutiveOff.join(", ")
        });

        violations.push({
          type: VIOLATION_TYPES.CONSECUTIVE_SAME_PATTERN,
          subType: "consecutive_off",
          staffName,
          message: `${staffName} has ${consecutiveOff.length} consecutive days off (×): ${consecutiveOff.join(", ")}`,
          severity: consecutiveOff.length >= 3 ? "critical" : "high",
          details: {
            pattern: "off_days",
            shiftType: "×",
            consecutiveDays: [...consecutiveOff],
            streakLength: consecutiveOff.length,
            startDate: consecutiveOff[0],
            endDate: consecutiveOff[consecutiveOff.length - 1],
          },
        });
      }
      consecutiveOff = [];
    }

    // Check for consecutive early shifts (△)
    if (isEarlyShift(shift)) {
      consecutiveEarly.push(dateKey);
    } else {
      // If streak ended and was 2+ days, record violation
      // ⚠️ ENHANCED: Graduated severity - high for 2, critical for 3+
      if (consecutiveEarly.length >= 2) {
        violations.push({
          type: VIOLATION_TYPES.CONSECUTIVE_SAME_PATTERN,
          subType: "consecutive_early",
          staffName,
          message: `${staffName} has ${consecutiveEarly.length} consecutive early shifts (△): ${consecutiveEarly.join(", ")}`,
          severity: consecutiveEarly.length >= 3 ? "critical" : "high",
          details: {
            pattern: "early_shifts",
            shiftType: "△",
            consecutiveDays: [...consecutiveEarly],
            streakLength: consecutiveEarly.length,
            startDate: consecutiveEarly[0],
            endDate: consecutiveEarly[consecutiveEarly.length - 1],
          },
        });
      }
      consecutiveEarly = [];
    }
  });

  // Check final streaks at end of range
  if (consecutiveOff.length >= 2) {
    violations.push({
      type: VIOLATION_TYPES.CONSECUTIVE_SAME_PATTERN,
      subType: "consecutive_off",
      staffName,
      message: `${staffName} has ${consecutiveOff.length} consecutive days off (×): ${consecutiveOff.join(", ")}`,
      severity: "medium",
      details: {
        pattern: "off_days",
        shiftType: "×",
        consecutiveDays: [...consecutiveOff],
        streakLength: consecutiveOff.length,
        startDate: consecutiveOff[0],
        endDate: consecutiveOff[consecutiveOff.length - 1],
      },
    });
  }

  if (consecutiveEarly.length >= 2) {
    violations.push({
      type: VIOLATION_TYPES.CONSECUTIVE_SAME_PATTERN,
      subType: "consecutive_early",
      staffName,
      message: `${staffName} has ${consecutiveEarly.length} consecutive early shifts (△): ${consecutiveEarly.join(", ")}`,
      severity: "medium",
      details: {
        pattern: "early_shifts",
        shiftType: "△",
        consecutiveDays: [...consecutiveEarly],
        streakLength: consecutiveEarly.length,
        startDate: consecutiveEarly[0],
        endDate: consecutiveEarly[consecutiveEarly.length - 1],
      },
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Validate coverage compensation rules and backup staff assignments
 * Enhanced to support general backup staff assignments for all groups
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @param {Array} backupAssignments - Backup assignments configuration
 * @returns {Object} Validation result
 */
export const validateCoverageCompensation = async (
  scheduleData,
  dateKey,
  staffMembers,
  backupAssignments = [],
) => {
  const violations = [];
  const staffGroups = await getStaffConflictGroups();

  // Legacy validation: Group 2 specific coverage rule
  const group2 = staffGroups.find((g) => g.name === "Group 2");
  if (group2 && group2.coverageRule) {
    const legacyResult = await validateLegacyCoverageRule(
      scheduleData,
      dateKey,
      staffMembers,
      group2,
    );
    violations.push(...legacyResult.violations);
  }

  // Enhanced validation: General backup staff assignments
  const generalResult = await validateGeneralBackupAssignments(
    scheduleData,
    dateKey,
    staffMembers,
    staffGroups,
    backupAssignments,
  );
  violations.push(...generalResult.violations);

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Validate legacy Group 2 coverage rule for backward compatibility
 * @param {Object} scheduleData - Schedule data
 * @param {string} dateKey - Date key
 * @param {Array} staffMembers - Staff members
 * @param {Object} group2 - Group 2 configuration
 * @returns {Object} Validation result
 */
const validateLegacyCoverageRule = async (
  scheduleData,
  dateKey,
  staffMembers,
  group2,
) => {
  const violations = [];

  if (!group2.coverageRule) {
    return { valid: true, violations: [] };
  }

  const backupStaffName = group2.coverageRule.backupStaff;
  const backupStaff = staffMembers.find((s) => s.name === backupStaffName);

  if (
    !backupStaff ||
    !scheduleData[backupStaff.id] ||
    scheduleData[backupStaff.id][dateKey] === undefined
  ) {
    return { valid: true, violations: [] };
  }

  // Check if any Group 2 member has day off
  let group2MemberOff = false;
  const offMembers = [];

  const members = group2.members || [];
  members.forEach((memberName) => {
    const staff = staffMembers.find((s) => s.name === memberName);
    if (
      staff &&
      scheduleData[staff.id] &&
      scheduleData[staff.id][dateKey] !== undefined
    ) {
      const shift = scheduleData[staff.id][dateKey];
      if (isOffDay(shift)) {
        group2MemberOff = true;
        offMembers.push(memberName);
      }
    }
  });

  // If Group 2 member is off, check if backup staff has normal shift
  if (group2MemberOff) {
    const backupShift = scheduleData[backupStaff.id][dateKey];
    if (!isNormalShift(backupShift) && !isWorkingShift(backupShift)) {
      violations.push({
        type: VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION,
        date: dateKey,
        message: `Coverage compensation violated on ${dateKey}: ${offMembers.join(", ")} off but ${backupStaffName} not working (${backupShift})`,
        severity: "high",
        details: {
          groupMembersOff: offMembers,
          backupStaff: backupStaffName,
          backupShift,
          requiredShift: "working",
          coverageRule: group2.coverageRule,
          validationType: "legacy",
        },
      });
    }
  }

  return { valid: violations.length === 0, violations };
};

/**
 * Validate general backup staff assignments for all groups
 * @param {Object} scheduleData - Schedule data
 * @param {string} dateKey - Date key
 * @param {Array} staffMembers - Staff members
 * @param {Array} staffGroups - Staff groups
 * @param {Array} backupAssignments - Backup assignments
 * @returns {Object} Validation result
 */
const validateGeneralBackupAssignments = async (
  scheduleData,
  dateKey,
  staffMembers,
  staffGroups,
  backupAssignments,
) => {
  const violations = [];

  // Group backup assignments by group ID
  const backupsByGroup = new Map();
  backupAssignments.forEach((assignment) => {
    if (!backupsByGroup.has(assignment.groupId)) {
      backupsByGroup.set(assignment.groupId, []);
    }
    backupsByGroup.get(assignment.groupId).push(assignment.staffId);
  });

  // Check each group
  staffGroups.forEach((group) => {
    const groupBackups = backupsByGroup.get(group.id) || [];
    if (groupBackups.length === 0) return; // No backup staff for this group

    // Find group members with day off
    const membersOff = [];
    group.members.forEach((memberId) => {
      const staff = staffMembers.find((s) => s.id === memberId);
      if (
        staff &&
        scheduleData[memberId] &&
        scheduleData[memberId][dateKey] !== undefined
      ) {
        const shift = scheduleData[memberId][dateKey];
        if (isOffDay(shift)) {
          membersOff.push({
            staffId: memberId,
            staffName: staff.name,
            shift,
          });
        }
      }
    });

    // If group members are off, check backup coverage
    if (membersOff.length > 0) {
      const workingBackups = [];
      const availableBackups = [];

      groupBackups.forEach((backupStaffId) => {
        const backupStaff = staffMembers.find((s) => s.id === backupStaffId);
        if (backupStaff && scheduleData[backupStaffId]) {
          const backupShift = scheduleData[backupStaffId][dateKey];

          if (isWorkingShift(backupShift)) {
            workingBackups.push({
              staffId: backupStaffId,
              staffName: backupStaff.name,
              shift: backupShift,
            });
          } else {
            availableBackups.push({
              staffId: backupStaffId,
              staffName: backupStaff.name,
              shift: backupShift,
            });
          }
        }
      });

      // Check if there's adequate backup coverage
      if (workingBackups.length === 0 && availableBackups.length > 0) {
        violations.push({
          type: VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION,
          date: dateKey,
          message: `Backup staff not assigned for ${group.name} on ${dateKey}: ${membersOff.map((m) => m.staffName).join(", ")} off but backup staff not working`,
          severity: "medium",
          details: {
            groupId: group.id,
            groupName: group.name,
            groupMembersOff: membersOff.map((m) => m.staffName),
            backupStaffAvailable: availableBackups.map((b) => b.staffName),
            backupStaffWorking: workingBackups.map((b) => b.staffName),
            validationType: "general_backup",
          },
        });
      }
    }
  });

  return { valid: violations.length === 0, violations };
};

/**
 * Validate proximity patterns for related day offs
 * When 料理長 has day off in middle of week, 古藤's day off should be within ±2 days
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {Array} dateRange - Array of dates for the period
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateProximityPatterns = async (
  scheduleData,
  dateRange,
  staffMembers,
) => {
  const violations = [];
  const staffGroups = await getStaffConflictGroups();

  // Find Group 2 with proximity pattern
  const group2 = staffGroups.find((g) => g.name === "Group 2");
  if (!group2 || !group2.proximityPattern) {
    return { valid: true, violations: [] };
  }

  const pattern = group2.proximityPattern;
  const triggerStaff = staffMembers.find((s) => s.name === pattern.trigger);
  const targetStaff = staffMembers.find((s) => s.name === pattern.target);

  if (
    !triggerStaff ||
    !targetStaff ||
    !scheduleData[triggerStaff.id] ||
    !scheduleData[targetStaff.id]
  ) {
    return { valid: true, violations: [] };
  }

  // Find 料理長's weekday off days
  const triggerOffDays = [];
  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    if (
      isWeekday(dateKey) &&
      scheduleData[triggerStaff.id][dateKey] !== undefined &&
      isOffDay(scheduleData[triggerStaff.id][dateKey])
    ) {
      triggerOffDays.push(dateKey);
    }
  });

  // For each 料理長 weekday off, check if 古藤's off day is within ±2 days
  triggerOffDays.forEach((triggerOffDay) => {
    const triggerDate = new Date(triggerOffDay);
    let targetOffWithinRange = false;

    // Check ±2 days around trigger date
    for (
      let offset = -pattern.proximity;
      offset <= pattern.proximity;
      offset++
    ) {
      const checkDate = new Date(triggerDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const checkDateKey = checkDate.toISOString().split("T")[0];

      if (
        scheduleData[targetStaff.id][checkDateKey] !== undefined &&
        isOffDay(scheduleData[targetStaff.id][checkDateKey])
      ) {
        targetOffWithinRange = true;
        break;
      }
    }

    if (!targetOffWithinRange) {
      violations.push({
        type: VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION,
        date: triggerOffDay,
        message: `Proximity pattern violated: ${pattern.trigger} off on ${triggerOffDay} (weekday), but ${pattern.target} has no day off within ±${pattern.proximity} days`,
        severity: "medium",
        details: {
          triggerStaff: pattern.trigger,
          targetStaff: pattern.target,
          triggerOffDay,
          proximityRange: pattern.proximity,
          condition: pattern.condition,
          proximityPattern: pattern,
        },
      });
    }
  });

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Comprehensive constraint validation for a complete schedule
 * @param {Object} scheduleData - Complete schedule data
 * @param {Array} staffMembers - Array of staff member objects
 * @param {Array} dateRange - Array of dates for the period
 * @param {Array} backupAssignments - Backup assignments configuration (optional)
 * @returns {Object} Complete validation result
 */
export const validateAllConstraints = async (
  scheduleData,
  staffMembers,
  dateRange,
  backupAssignments = [],
) => {
  console.log("🔍 Running comprehensive constraint validation...");

  const allViolations = [];
  const validationSummary = {
    totalConstraintsChecked: 0,
    violationsFound: 0,
    criticalViolations: 0,
    highViolations: 0,
    mediumViolations: 0,
    byType: {},
    byStaff: {},
    byDate: {},
  };

  // Validate monthly limits for each staff member
  for (const staff of staffMembers) {
    if (scheduleData[staff.id]) {
      validationSummary.totalConstraintsChecked++;

      const monthlyResult = await validateMonthlyOffLimits(
        scheduleData[staff.id],
        staff.name,
        dateRange,
      );
      if (!monthlyResult.valid) {
        allViolations.push(...monthlyResult.violations);
      }

      const consecutiveResult = validateConsecutiveOffDays(
        scheduleData[staff.id],
        staff.name,
        dateRange,
      );
      if (!consecutiveResult.valid) {
        allViolations.push(...consecutiveResult.violations);
      }

      // ✅ NEW: Validate consecutive same shift patterns (× or △)
      const consecutivePatternsResult = validateConsecutiveSameShiftPatterns(
        scheduleData[staff.id],
        staff.name,
        dateRange,
      );
      if (!consecutivePatternsResult.valid) {
        allViolations.push(...consecutivePatternsResult.violations);
      }

      // ✅ NEW: Validate weekly limits with rolling 7-day windows
      const weeklyLimitsResult = await validateWeeklyLimits(
        scheduleData,
        staff,
        dateRange,
      );
      if (!weeklyLimitsResult.valid) {
        allViolations.push(...weeklyLimitsResult.violations);
      }
    }
  }

  // Validate daily constraints for each date
  for (const date of dateRange) {
    const dateKey = date.toISOString().split("T")[0];
    validationSummary.totalConstraintsChecked += 5; // daily limits, group conflicts, priority rules, coverage compensation, proximity patterns

    const dailyLimitsResult = await validateDailyLimits(
      scheduleData,
      dateKey,
      staffMembers,
    );
    if (!dailyLimitsResult.valid) {
      allViolations.push(...dailyLimitsResult.violations);
    }

    const groupConflictsResult = await validateStaffGroupConflicts(
      scheduleData,
      dateKey,
      staffMembers,
    );
    if (!groupConflictsResult.valid) {
      allViolations.push(...groupConflictsResult.violations);
    }

    const priorityRulesResult = await validatePriorityRules(
      scheduleData,
      dateKey,
      staffMembers,
    );
    if (!priorityRulesResult.valid) {
      allViolations.push(...priorityRulesResult.violations);
    }

    const coverageCompensationResult = await validateCoverageCompensation(
      scheduleData,
      dateKey,
      staffMembers,
      backupAssignments,
    );
    if (!coverageCompensationResult.valid) {
      allViolations.push(...coverageCompensationResult.violations);
    }
  }

  // Validate proximity patterns (needs full date range, so validate once)
  validationSummary.totalConstraintsChecked += 1;
  const proximityPatternsResult = await validateProximityPatterns(
    scheduleData,
    dateRange,
    staffMembers,
  );
  if (!proximityPatternsResult.valid) {
    allViolations.push(...proximityPatternsResult.violations);
  }

  // Categorize violations
  allViolations.forEach((violation) => {
    validationSummary.violationsFound++;

    // Count by severity
    switch (violation.severity) {
      case "critical":
        validationSummary.criticalViolations++;
        break;
      case "high":
        validationSummary.highViolations++;
        break;
      case "medium":
        validationSummary.mediumViolations++;
        break;
    }

    // Count by type
    if (!validationSummary.byType[violation.type]) {
      validationSummary.byType[violation.type] = 0;
    }
    validationSummary.byType[violation.type]++;

    // Count by staff
    if (violation.staffName) {
      if (!validationSummary.byStaff[violation.staffName]) {
        validationSummary.byStaff[violation.staffName] = 0;
      }
      validationSummary.byStaff[violation.staffName]++;
    }

    // Count by date
    if (violation.date) {
      if (!validationSummary.byDate[violation.date]) {
        validationSummary.byDate[violation.date] = 0;
      }
      validationSummary.byDate[violation.date]++;
    }
  });

  const isValid = allViolations.length === 0;

  console.log(
    `✅ Constraint validation completed: ${isValid ? "VALID" : "VIOLATIONS FOUND"}`,
  );
  console.log(
    `📊 Summary: ${validationSummary.violationsFound} violations found in ${validationSummary.totalConstraintsChecked} checks`,
  );

  return {
    valid: isValid,
    violations: allViolations,
    summary: validationSummary,
    constraintStatus: {
      monthlyLimits: "checked",
      weeklyLimits: "checked", // ✅ NEW: Rolling 7-day window validation
      dailyLimits: "checked",
      staffGroupConflicts: "checked",
      priorityRules: "checked",
      consecutiveOffDays: "checked",
      coverageCompensation: "checked",
      proximityPatterns: "checked",
    },
    cacheStatus: {
      cacheTimestamp,
      configCacheSize: configCache.size,
      lastInvalidation: configCache.get("_invalidated")
        ? "pending_refresh"
        : "valid",
    },
  };
};

/**
 * Get violation recommendations for fixing constraint violations
 * @param {Array} violations - Array of constraint violations
 * @returns {Array} Array of recommendation objects
 */
export const getViolationRecommendations = (violations) => {
  const recommendations = [];

  violations.forEach((violation) => {
    let recommendation = {};

    switch (violation.type) {
      case VIOLATION_TYPES.MONTHLY_OFF_LIMIT:
        recommendation = {
          violation,
          action: "reduce_off_days",
          suggestion: `Reduce ${violation.staffName}'s off days by ${violation.details.excess}`,
          priority: "high",
          alternativeActions: [
            "Convert some off days to working days",
            "Redistribute off days to other staff members",
          ],
        };
        break;

      case VIOLATION_TYPES.DAILY_OFF_LIMIT:
        recommendation = {
          violation,
          action: "redistribute_off_days",
          suggestion: `Move ${violation.details.excess} staff from off to working on ${violation.date}`,
          priority: "high",
          affectedStaff: violation.details.staffOff.slice(
            0,
            violation.details.excess,
          ),
          alternativeActions: [
            "Move off days to different dates",
            "Convert to early or late shifts",
          ],
        };
        break;

      case VIOLATION_TYPES.STAFF_GROUP_CONFLICT:
        recommendation = {
          violation,
          action: "resolve_group_conflict",
          suggestion: `Change shift for one member of ${violation.group} on ${violation.date}`,
          priority: "high",
          conflictingStaff: violation.details.conflictingMembers,
          alternativeActions: [
            "Move one member to working shift",
            "Swap shifts with staff from different group",
          ],
        };
        break;

      case VIOLATION_TYPES.PRIORITY_RULE_VIOLATION:
        recommendation = {
          violation,
          action: "apply_priority_rule",
          suggestion: `Change ${violation.staffName}'s shift to ${violation.details.expectedShift} on ${violation.date}`,
          priority: violation.severity === "high" ? "high" : "medium",
          alternativeActions: [
            "Adjust other staff schedules to accommodate priority",
            "Consider exception if business needs require it",
          ],
        };
        break;

      case VIOLATION_TYPES.INSUFFICIENT_COVERAGE:
        recommendation = {
          violation,
          action: "increase_coverage",
          suggestion: `Add ${violation.details.deficit} more working staff on ${violation.date}`,
          priority: "critical",
          alternativeActions: [
            "Convert off days to working days",
            "Call in additional staff",
            "Extend shifts for current working staff",
          ],
        };
        break;

      case VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF:
        recommendation = {
          violation,
          action: "break_consecutive_streak",
          suggestion: `Add working day in middle of ${violation.staffName}'s consecutive off period`,
          priority: "medium",
          streakDays: violation.details.consecutiveDays,
          alternativeActions: [
            "Split consecutive days into smaller periods",
            "Redistribute some off days to different weeks",
          ],
        };
        break;

      case VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION:
        recommendation = {
          violation,
          action: "apply_coverage_compensation",
          suggestion: `Change ${violation.details.backupStaff}'s shift to normal on ${violation.date} when ${violation.details.groupMembersOff.join(", ")} is off`,
          priority: "high",
          affectedStaff: [violation.details.backupStaff],
          alternativeActions: [
            "Change Group 2 member from off to working shift",
            "Arrange alternative coverage staff",
          ],
        };
        break;

      case VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION:
        recommendation = {
          violation,
          action: "adjust_proximity_pattern",
          suggestion: `Schedule ${violation.details.targetStaff}'s day off within ±${violation.details.proximityRange} days of ${violation.details.triggerStaff}'s off day (${violation.date})`,
          priority: "medium",
          affectedStaff: [violation.details.targetStaff],
          alternativeActions: [
            "Move target staff off day closer to trigger date",
            "Adjust trigger staff off day if more flexible",
          ],
        };
        break;

      default:
        recommendation = {
          violation,
          action: "manual_review",
          suggestion: "Manual review required for this constraint violation",
          priority: "medium",
        };
    }

    recommendations.push(recommendation);
  });

  return recommendations;
};

// Configuration Cache Helper Functions for ConfigurationCacheManager integration

/**
 * Get all configurations for caching
 */
export const getAllConfigurations = async () => {
  try {
    // Helper to add timeout protection to configuration calls
    const withTimeout = (promise, name, timeoutMs = 3000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`${name} loading timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
    };

    // Load all configurations with individual timeout protection
    const [
      staffGroups,
      dailyLimits,
      weeklyLimits,
      priorityRules,
      businessRules,
      constraintConfig,
      systemSettings,
      _checksum,
    ] = await Promise.allSettled([
      withTimeout(getStaffConflictGroups(), "staffGroups"),
      withTimeout(getDailyLimits(), "dailyLimits"),
      withTimeout(getWeeklyLimits(), "weeklyLimits"),
      withTimeout(getPriorityRules(), "priorityRules"),
      withTimeout(getBusinessRules(), "businessRules"),
      withTimeout(getConstraintConfiguration(), "constraintConfig"),
      withTimeout(getSystemSettings(), "systemSettings"),
      withTimeout(getConfigurationChecksum(), "checksum"),
    ]);

    const configurations = {
      staffGroups: staffGroups.status === "fulfilled" ? staffGroups.value : {},
      dailyLimits: dailyLimits.status === "fulfilled" ? dailyLimits.value : {},
      weeklyLimits:
        weeklyLimits.status === "fulfilled" ? weeklyLimits.value : [],
      priorityRules:
        priorityRules.status === "fulfilled" ? priorityRules.value : [],
      businessRules:
        businessRules.status === "fulfilled" ? businessRules.value : {},
      constraintConfig:
        constraintConfig.status === "fulfilled" ? constraintConfig.value : {},
      systemSettings:
        systemSettings.status === "fulfilled" ? systemSettings.value : {},
      _timestamp: Date.now(),
      _checksum:
        _checksum.status === "fulfilled"
          ? _checksum.value
          : Date.now().toString(36),
    };

    return configurations;
  } catch (error) {
    console.error("Failed to get all configurations:", error);
    return {
      staffGroups: {},
      dailyLimits: {},
      weeklyLimits: [],
      priorityRules: [],
      businessRules: {},
      constraintConfig: {},
      systemSettings: {},
      _timestamp: Date.now(),
      _error: error.message,
    };
  }
};

/**
 * Get specific configuration by type
 */
export const getSpecificConfiguration = async (type) => {
  try {
    switch (type) {
      case "staff_groups":
      case "staffGroups":
        return await getStaffConflictGroups(); // Use existing export
      case "daily_limits":
      case "dailyLimits":
        return await getDailyLimits(); // Use existing export
      case "priority_rules":
      case "priorityRules":
        return await getPriorityRules(); // Use existing export
      case "business_rules":
      case "businessRules":
        return await getBusinessRules();
      case "constraint_config":
      case "constraintConfig":
        return await getConstraintConfiguration();
      case "system_settings":
      case "systemSettings":
        return await getSystemSettings();
      default:
        console.warn(`Unknown configuration type: ${type}`);
        return {};
    }
  } catch (error) {
    console.error(`Failed to get ${type} configuration:`, error);
    return {};
  }
};

/**
 * Generate checksum for configuration integrity checking
 */
export const getConfigurationChecksum = async () => {
  try {
    // Get individual configurations directly to avoid infinite recursion
    // DO NOT call getAllConfigurations() here as it creates a circular dependency
    const [
      staffGroups,
      dailyLimits,
      priorityRules,
      businessRules,
      constraintConfig,
      systemSettings,
    ] = await Promise.allSettled([
      getStaffConflictGroups(),
      getDailyLimits(),
      getPriorityRules(),
      getBusinessRules(),
      getConstraintConfiguration(),
      getSystemSettings(),
    ]);

    // Build configuration object for checksum calculation
    const configs = {
      staffGroups: staffGroups.status === "fulfilled" ? staffGroups.value : {},
      dailyLimits: dailyLimits.status === "fulfilled" ? dailyLimits.value : {},
      priorityRules:
        priorityRules.status === "fulfilled" ? priorityRules.value : [],
      businessRules:
        businessRules.status === "fulfilled" ? businessRules.value : {},
      constraintConfig:
        constraintConfig.status === "fulfilled" ? constraintConfig.value : {},
      systemSettings:
        systemSettings.status === "fulfilled" ? systemSettings.value : {},
    };

    // Simple checksum based on serialized configuration
    const configString = JSON.stringify(configs);
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  } catch (error) {
    console.error("Failed to generate configuration checksum:", error);
    return Date.now().toString(36); // Fallback to timestamp
  }
};

/**
 * Helper functions to get individual configuration types
 */
async function getBusinessRules() {
  try {
    return (await getConstraintsByType("businessRules")) || {};
  } catch (error) {
    console.error("Failed to get business rules:", error);
    return {};
  }
}

async function getConstraintConfiguration() {
  try {
    return (await getConstraintsByType("constraintConfig")) || {};
  } catch (error) {
    console.error("Failed to get constraint configuration:", error);
    return {};
  }
}

async function getSystemSettings() {
  try {
    return (await getConstraintsByType("systemSettings")) || {};
  } catch (error) {
    console.error("Failed to get system settings:", error);
    return {};
  }
}

async function getConstraintsByType(type) {
  if (!configService) {
    await initializeConstraintConfiguration();
  }

  if (configService && typeof configService.getConstraints === "function") {
    return await configService.getConstraints(type);
  }

  // Fallback to cached data if service is not available
  if (configCache.has(type)) {
    return configCache.get(type);
  }

  return null;
}
