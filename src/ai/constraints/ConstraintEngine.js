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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize configuration service
 * @param {string} restaurantId - Restaurant ID for configuration
 */
export const initializeConstraintConfiguration = async (restaurantId) => {
  if (!configService && restaurantId) {
    configService = new ConfigurationService();
    await configService.initialize({ restaurantId });
    console.log("✅ Constraint Engine configuration service initialized");
  }
  return configService;
};

/**
 * Get configuration with caching
 * @param {string} configType - Type of configuration to get
 */
const getCachedConfig = async (configType) => {
  const now = Date.now();
  const cacheKey = `${configType}_${now}`;

  // Check if cache is still valid
  if (configCache.has(configType) && now - cacheTimestamp < CACHE_DURATION) {
    return configCache.get(configType);
  }

  // Load fresh configuration
  if (configService) {
    try {
      let config;
      switch (configType) {
        case "staff_groups":
          config = await configService.getStaffGroupsWithMembers();
          break;
        case "priority_rules":
          config = await configService.getPriorityRules();
          break;
        case "daily_limits":
          config = await configService.getDailyLimits();
          break;
        case "monthly_limits":
          config = await configService.getMonthlyLimits();
          break;
        case "conflict_rules":
          config = await configService.getConflictRules();
          break;
        default:
          config = null;
      }

      if (config) {
        configCache.set(configType, config);
        cacheTimestamp = now;
        return config;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load ${configType} configuration:`, error);
    }
  }

  // Fallback to static configuration
  return getStaticConfiguration(configType);
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
    case "monthly_limits":
      return (year, month) => getStaticMonthlyLimits(year, month);
    default:
      return null;
  }
};

/**
 * Staff groups that cannot have simultaneous off/early shifts
 * Static fallback configuration - Updated to match new group structure
 */
const STATIC_STAFF_CONFLICT_GROUPS = [
  { name: "Group 1", members: ["料理長", "井関"] },
  {
    name: "Group 2",
    members: ["料理長", "古藤"],
    coverageRule: {
      backupStaff: "中田",
      requiredShift: "normal",
      description:
        "When Group 2 member has day off, 中田 must work normal shift",
    },
    proximityPattern: {
      trigger: "料理長",
      condition: "weekday_off",
      target: "古藤",
      proximity: 2,
      description:
        "When 料理長 has weekday day off, 古藤's day off should be within ±2 days",
    },
  },
  { name: "Group 3", members: ["井関", "小池"] },
  { name: "Group 4", members: ["田辺", "小池"] },
  { name: "Group 5", members: ["古藤", "岸"] },
  { name: "Group 6", members: ["与儀", "カマル"] },
  { name: "Group 7", members: ["カマル", "高野"] },
  { name: "Group 8", members: ["高野", "派遣スタッフ"] },
];

/**
 * Static priority rules for specific staff members
 */
const STATIC_PRIORITY_RULES = {
  料理長: {
    preferredShifts: [{ day: "sunday", shift: "early", priority: "high" }],
  },
  与儀: {
    preferredShifts: [{ day: "sunday", shift: "off", priority: "high" }],
  },
};

/**
 * Static daily limits for different shift types
 */
const STATIC_DAILY_LIMITS = {
  maxOffPerDay: 4,
  maxEarlyPerDay: 4,
  maxLatePerDay: 3,
  minWorkingStaffPerDay: 3,
};

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

// Dynamic getters that use configuration service or fall back to static config
export const getStaffConflictGroups = async () => {
  return await getCachedConfig("staff_groups");
};

export const getPriorityRules = async () => {
  return await getCachedConfig("priority_rules");
};

export const getDailyLimits = async () => {
  return await getCachedConfig("daily_limits");
};

export const getMonthlyLimits = async (year, month) => {
  const limits = await getCachedConfig("monthly_limits");

  if (typeof limits === "function") {
    return limits(year, month);
  } else if (limits && typeof limits === "object") {
    // Database configuration format
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
  STAFF_GROUP_CONFLICT: "staff_group_conflict",
  PRIORITY_RULE_VIOLATION: "priority_rule_violation",
  INSUFFICIENT_COVERAGE: "insufficient_coverage",
  CONSECUTIVE_DAYS_OFF: "consecutive_days_off",
  COVERAGE_COMPENSATION_VIOLATION: "coverage_compensation_violation",
  PROXIMITY_PATTERN_VIOLATION: "proximity_pattern_violation",
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
        earlyCount++;
        dayData.early.push(staff.name);
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

  // Check daily off limit
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

  // Check daily early shift limit
  const maxEarlyPerDay = dailyLimits.maxEarlyPerDay || 4;
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
    let offOrEarlyCount = 0;

    const members = group.members || [];
    members.forEach((memberName) => {
      const staff = staffMembers.find((s) => s.name === memberName);
      if (
        staff &&
        scheduleData[staff.id] &&
        scheduleData[staff.id][dateKey] !== undefined
      ) {
        const shift = scheduleData[staff.id][dateKey];
        groupMembers.push({ name: memberName, shift });

        if (isOffDay(shift) || isEarlyShift(shift)) {
          offOrEarlyCount++;
        }
      }
    });

    // Check if more than one member in the group is off or on early shift
    if (offOrEarlyCount > 1) {
      const conflictingMembers = groupMembers
        .filter(
          (member) => isOffDay(member.shift) || isEarlyShift(member.shift),
        )
        .map((member) => `${member.name} (${member.shift})`);

      violations.push({
        type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
        date: dateKey,
        group: group.name,
        message: `${group.name} conflict on ${dateKey}: multiple members off/early - ${conflictingMembers.join(", ")}`,
        severity: "high",
        details: {
          groupName: group.name,
          groupMembers: members,
          conflictingMembers,
          conflictCount: offOrEarlyCount,
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

    preferredShifts.forEach((rule) => {
      if (rule.day === dayOfWeek) {
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
      dailyLimits: "checked",
      staffGroupConflicts: "checked",
      priorityRules: "checked",
      consecutiveOffDays: "checked",
      coverageCompensation: "checked",
      proximityPatterns: "checked",
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
