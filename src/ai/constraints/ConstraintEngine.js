/**
 * ConstraintEngine.js
 * 
 * Core constraint validation engine for shift scheduling.
 * Implements all business rules and constraints for restaurant staff scheduling.
 */

import { getDaysInMonth } from '../../utils/dateUtils';

/**
 * Staff groups that cannot have simultaneous off/early shifts
 * Updated to match new group structure from AI_PREDICTION_MODEL_SPEC.md v1.1
 */
export const STAFF_CONFLICT_GROUPS = [
  { name: 'Group 1', members: ['料理長', '井関'] },
  { 
    name: 'Group 2', 
    members: ['料理長', '古藤'],
    coverageRule: {
      backupStaff: '中田',
      requiredShift: 'normal',
      description: 'When Group 2 member has day off, 中田 must work normal shift'
    },
    proximityPattern: {
      trigger: '料理長',
      condition: 'weekday_off',
      target: '古藤',
      proximity: 2,
      description: 'When 料理長 has weekday day off, 古藤\'s day off should be within ±2 days'
    }
  },
  { name: 'Group 3', members: ['井関', '小池'] },
  { name: 'Group 4', members: ['田辺', '小池'] },
  { name: 'Group 5', members: ['古藤', '岸'] },
  { name: 'Group 6', members: ['与儀', 'カマル'] },
  { name: 'Group 7', members: ['カマル', '高野'] },
  { name: 'Group 8', members: ['高野', '派遣スタッフ'] }
];

/**
 * Priority rules for specific staff members
 */
export const PRIORITY_RULES = {
  '料理長': {
    preferredShifts: [
      { day: 'sunday', shift: 'early', priority: 'high' }
    ]
  },
  '与儀': {
    preferredShifts: [
      { day: 'sunday', shift: 'off', priority: 'high' }
    ]
  }
};

/**
 * Daily limits for different shift types
 */
export const DAILY_LIMITS = {
  maxOffPerDay: 4,
  maxEarlyPerDay: 4,
  maxLatePerDay: 3,
  minWorkingStaffPerDay: 3
};

/**
 * Monthly limits based on days in month
 */
export const getMonthlyLimits = (year, month) => {
  const daysInMonth = getDaysInMonth(year, month);
  return {
    maxOffDaysPerMonth: daysInMonth === 31 ? 8 : 7,
    minWorkDaysPerMonth: daysInMonth === 31 ? 23 : 23
  };
};

/**
 * Constraint violation types
 */
export const VIOLATION_TYPES = {
  MONTHLY_OFF_LIMIT: 'monthly_off_limit',
  DAILY_OFF_LIMIT: 'daily_off_limit',
  DAILY_EARLY_LIMIT: 'daily_early_limit',
  STAFF_GROUP_CONFLICT: 'staff_group_conflict',
  PRIORITY_RULE_VIOLATION: 'priority_rule_violation',
  INSUFFICIENT_COVERAGE: 'insufficient_coverage',
  CONSECUTIVE_DAYS_OFF: 'consecutive_days_off',
  COVERAGE_COMPENSATION_VIOLATION: 'coverage_compensation_violation',
  PROXIMITY_PATTERN_VIOLATION: 'proximity_pattern_violation'
};

/**
 * Check if a shift value represents an off day
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's an off day
 */
export const isOffDay = (shiftValue) => {
  return shiftValue === '×' || shiftValue === 'off' || shiftValue === '★' || shiftValue === 'holiday';
};

/**
 * Check if a shift value represents an early shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's an early shift
 */
export const isEarlyShift = (shiftValue) => {
  return shiftValue === '△' || shiftValue === 'early';
};

/**
 * Check if a shift value represents a late shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a late shift
 */
export const isLateShift = (shiftValue) => {
  return shiftValue === '◇' || shiftValue === 'late';
};

/**
 * Check if a shift value represents a normal shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a normal shift
 */
export const isNormalShift = (shiftValue) => {
  return shiftValue === '' || shiftValue === '○' || shiftValue === 'normal';
};

/**
 * Check if a shift value represents a working shift
 * @param {string} shiftValue - The shift value to check
 * @returns {boolean} True if it's a working shift
 */
export const isWorkingShift = (shiftValue) => {
  return !isOffDay(shiftValue) && shiftValue !== undefined && shiftValue !== null;
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
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

/**
 * Validate monthly off day limits for a staff member
 * @param {Object} staffSchedule - Staff member's schedule for the month
 * @param {string} staffName - Staff member's name
 * @param {Array} dateRange - Array of dates for the month
 * @returns {Object} Validation result
 */
export const validateMonthlyOffLimits = (staffSchedule, staffName, dateRange) => {
  if (!staffSchedule || !dateRange.length) {
    return { valid: true, violations: [] };
  }

  const firstDate = dateRange[0];
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth() + 1;
  const monthlyLimits = getMonthlyLimits(year, month);

  let offDaysCount = 0;
  const offDays = [];

  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
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
      severity: 'high',
      details: {
        offDaysCount,
        limit: monthlyLimits.maxOffDaysPerMonth,
        offDays,
        excess: offDaysCount - monthlyLimits.maxOffDaysPerMonth
      }
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    summary: {
      offDaysCount,
      limit: monthlyLimits.maxOffDaysPerMonth,
      remaining: Math.max(0, monthlyLimits.maxOffDaysPerMonth - offDaysCount)
    }
  };
};

/**
 * Validate daily limits for a specific date
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateDailyLimits = (scheduleData, dateKey, staffMembers) => {
  const violations = [];
  let offCount = 0;
  let earlyCount = 0;
  let lateCount = 0;
  let workingCount = 0;
  const totalStaff = staffMembers.length;

  const dayData = {
    off: [],
    early: [],
    late: [],
    working: []
  };

  staffMembers.forEach(staff => {
    if (scheduleData[staff.id] && scheduleData[staff.id][dateKey] !== undefined) {
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
  if (offCount > DAILY_LIMITS.maxOffPerDay) {
    violations.push({
      type: VIOLATION_TYPES.DAILY_OFF_LIMIT,
      date: dateKey,
      message: `Too many staff off on ${dateKey}: ${offCount} exceeds limit of ${DAILY_LIMITS.maxOffPerDay}`,
      severity: 'high',
      details: {
        offCount,
        limit: DAILY_LIMITS.maxOffPerDay,
        staffOff: dayData.off,
        excess: offCount - DAILY_LIMITS.maxOffPerDay
      }
    });
  }

  // Check daily early shift limit
  if (earlyCount > DAILY_LIMITS.maxEarlyPerDay) {
    violations.push({
      type: VIOLATION_TYPES.DAILY_EARLY_LIMIT,
      date: dateKey,
      message: `Too many early shifts on ${dateKey}: ${earlyCount} exceeds limit of ${DAILY_LIMITS.maxEarlyPerDay}`,
      severity: 'medium',
      details: {
        earlyCount,
        limit: DAILY_LIMITS.maxEarlyPerDay,
        staffEarly: dayData.early,
        excess: earlyCount - DAILY_LIMITS.maxEarlyPerDay
      }
    });
  }

  // Check minimum working staff
  if (workingCount < DAILY_LIMITS.minWorkingStaffPerDay) {
    violations.push({
      type: VIOLATION_TYPES.INSUFFICIENT_COVERAGE,
      date: dateKey,
      message: `Insufficient coverage on ${dateKey}: only ${workingCount} working, need at least ${DAILY_LIMITS.minWorkingStaffPerDay}`,
      severity: 'critical',
      details: {
        workingCount,
        requiredMinimum: DAILY_LIMITS.minWorkingStaffPerDay,
        deficit: DAILY_LIMITS.minWorkingStaffPerDay - workingCount,
        staffWorking: dayData.working
      }
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
      coverage: totalStaff > 0 ? (workingCount / totalStaff) * 100 : 0
    }
  };
};

/**
 * Validate staff group conflicts for a specific date
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateStaffGroupConflicts = (scheduleData, dateKey, staffMembers) => {
  const violations = [];

  STAFF_CONFLICT_GROUPS.forEach(group => {
    const groupMembers = [];
    let offOrEarlyCount = 0;

    group.members.forEach(memberName => {
      const staff = staffMembers.find(s => s.name === memberName);
      if (staff && scheduleData[staff.id] && scheduleData[staff.id][dateKey] !== undefined) {
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
        .filter(member => isOffDay(member.shift) || isEarlyShift(member.shift))
        .map(member => `${member.name} (${member.shift})`);

      violations.push({
        type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
        date: dateKey,
        group: group.name,
        message: `${group.name} conflict on ${dateKey}: multiple members off/early - ${conflictingMembers.join(', ')}`,
        severity: 'high',
        details: {
          groupName: group.name,
          groupMembers: group.members,
          conflictingMembers,
          conflictCount: offOrEarlyCount
        }
      });
    }
  });

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Validate priority rules for specific staff members
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validatePriorityRules = (scheduleData, dateKey, staffMembers) => {
  const violations = [];
  const dayOfWeek = getDayOfWeek(dateKey);

  Object.keys(PRIORITY_RULES).forEach(staffName => {
    const staff = staffMembers.find(s => s.name === staffName);
    if (!staff || !scheduleData[staff.id] || scheduleData[staff.id][dateKey] === undefined) {
      return;
    }

    const currentShift = scheduleData[staff.id][dateKey];
    const rules = PRIORITY_RULES[staffName];

    rules.preferredShifts.forEach(rule => {
      if (rule.day === dayOfWeek) {
        let ruleViolated = false;
        let expectedShift = '';

        switch (rule.shift) {
          case 'early':
            ruleViolated = !isEarlyShift(currentShift);
            expectedShift = 'early shift (△)';
            break;
          case 'off':
            ruleViolated = !isOffDay(currentShift);
            expectedShift = 'day off (×)';
            break;
          case 'late':
            ruleViolated = !isLateShift(currentShift);
            expectedShift = 'late shift (◇)';
            break;
        }

        if (ruleViolated) {
          violations.push({
            type: VIOLATION_TYPES.PRIORITY_RULE_VIOLATION,
            date: dateKey,
            staffName,
            message: `${staffName} priority rule violated on ${dayOfWeek}: should have ${expectedShift}, but has ${currentShift}`,
            severity: rule.priority === 'high' ? 'high' : 'medium',
            details: {
              rule,
              expectedShift,
              actualShift: currentShift,
              dayOfWeek
            }
          });
        }
      }
    });
  });

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Check for consecutive days off (more than 2 in a row)
 * @param {Object} staffSchedule - Staff member's schedule for the month
 * @param {string} staffName - Staff member's name
 * @param {Array} dateRange - Array of dates for the month
 * @returns {Object} Validation result
 */
export const validateConsecutiveOffDays = (staffSchedule, staffName, dateRange) => {
  const violations = [];
  let consecutiveOffDays = [];
  let currentStreak = [];

  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
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

  consecutiveOffDays.forEach(streak => {
    violations.push({
      type: VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF,
      staffName,
      message: `${staffName} has ${streak.length} consecutive days off: ${streak.join(', ')}`,
      severity: 'medium',
      details: {
        consecutiveDays: streak,
        streakLength: streak.length
      }
    });
  });

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Validate coverage compensation rules
 * When Group 2 member (料理長 or 古藤) has day off, 中田 must work normal shift
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateCoverageCompensation = (scheduleData, dateKey, staffMembers) => {
  const violations = [];
  
  // Find Group 2 (料理長, 古藤) and 中田
  const group2 = STAFF_CONFLICT_GROUPS.find(g => g.name === 'Group 2');
  if (!group2 || !group2.coverageRule) {
    return { valid: true, violations: [] };
  }

  const backupStaffName = group2.coverageRule.backupStaff;
  const backupStaff = staffMembers.find(s => s.name === backupStaffName);
  
  if (!backupStaff || !scheduleData[backupStaff.id] || scheduleData[backupStaff.id][dateKey] === undefined) {
    return { valid: true, violations: [] };
  }

  // Check if any Group 2 member has day off
  let group2MemberOff = false;
  const offMembers = [];
  
  group2.members.forEach(memberName => {
    const staff = staffMembers.find(s => s.name === memberName);
    if (staff && scheduleData[staff.id] && scheduleData[staff.id][dateKey] !== undefined) {
      const shift = scheduleData[staff.id][dateKey];
      if (isOffDay(shift)) {
        group2MemberOff = true;
        offMembers.push(memberName);
      }
    }
  });

  // If Group 2 member is off, check if 中田 has normal shift
  if (group2MemberOff) {
    const backupShift = scheduleData[backupStaff.id][dateKey];
    if (!isNormalShift(backupShift)) {
      violations.push({
        type: VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION,
        date: dateKey,
        message: `Coverage compensation violated on ${dateKey}: ${offMembers.join(', ')} off but ${backupStaffName} not on normal shift (${backupShift})`,
        severity: 'high',
        details: {
          groupMembersOff: offMembers,
          backupStaff: backupStaffName,
          backupShift,
          requiredShift: 'normal',
          coverageRule: group2.coverageRule
        }
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Validate proximity patterns for related day offs
 * When 料理長 has day off in middle of week, 古藤's day off should be within ±2 days
 * @param {Object} scheduleData - Complete schedule data for all staff
 * @param {Array} dateRange - Array of dates for the period
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Object} Validation result
 */
export const validateProximityPatterns = (scheduleData, dateRange, staffMembers) => {
  const violations = [];
  
  // Find Group 2 with proximity pattern
  const group2 = STAFF_CONFLICT_GROUPS.find(g => g.name === 'Group 2');
  if (!group2 || !group2.proximityPattern) {
    return { valid: true, violations: [] };
  }

  const pattern = group2.proximityPattern;
  const triggerStaff = staffMembers.find(s => s.name === pattern.trigger);
  const targetStaff = staffMembers.find(s => s.name === pattern.target);
  
  if (!triggerStaff || !targetStaff || 
      !scheduleData[triggerStaff.id] || !scheduleData[targetStaff.id]) {
    return { valid: true, violations: [] };
  }

  // Find 料理長's weekday off days
  const triggerOffDays = [];
  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
    if (isWeekday(dateKey) && 
        scheduleData[triggerStaff.id][dateKey] !== undefined &&
        isOffDay(scheduleData[triggerStaff.id][dateKey])) {
      triggerOffDays.push(dateKey);
    }
  });

  // For each 料理長 weekday off, check if 古藤's off day is within ±2 days
  triggerOffDays.forEach(triggerOffDay => {
    const triggerDate = new Date(triggerOffDay);
    let targetOffWithinRange = false;
    
    // Check ±2 days around trigger date
    for (let offset = -pattern.proximity; offset <= pattern.proximity; offset++) {
      const checkDate = new Date(triggerDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const checkDateKey = checkDate.toISOString().split('T')[0];
      
      if (scheduleData[targetStaff.id][checkDateKey] !== undefined &&
          isOffDay(scheduleData[targetStaff.id][checkDateKey])) {
        targetOffWithinRange = true;
        break;
      }
    }

    if (!targetOffWithinRange) {
      violations.push({
        type: VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION,
        date: triggerOffDay,
        message: `Proximity pattern violated: ${pattern.trigger} off on ${triggerOffDay} (weekday), but ${pattern.target} has no day off within ±${pattern.proximity} days`,
        severity: 'medium',
        details: {
          triggerStaff: pattern.trigger,
          targetStaff: pattern.target,
          triggerOffDay,
          proximityRange: pattern.proximity,
          condition: pattern.condition,
          proximityPattern: pattern
        }
      });
    }
  });

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Comprehensive constraint validation for a complete schedule
 * @param {Object} scheduleData - Complete schedule data
 * @param {Array} staffMembers - Array of staff member objects
 * @param {Array} dateRange - Array of dates for the period
 * @returns {Object} Complete validation result
 */
export const validateAllConstraints = (scheduleData, staffMembers, dateRange) => {
  console.log('🔍 Running comprehensive constraint validation...');
  
  const allViolations = [];
  const validationSummary = {
    totalConstraintsChecked: 0,
    violationsFound: 0,
    criticalViolations: 0,
    highViolations: 0,
    mediumViolations: 0,
    byType: {},
    byStaff: {},
    byDate: {}
  };

  // Validate monthly limits for each staff member
  staffMembers.forEach(staff => {
    if (scheduleData[staff.id]) {
      validationSummary.totalConstraintsChecked++;
      
      const monthlyResult = validateMonthlyOffLimits(scheduleData[staff.id], staff.name, dateRange);
      if (!monthlyResult.valid) {
        allViolations.push(...monthlyResult.violations);
      }

      const consecutiveResult = validateConsecutiveOffDays(scheduleData[staff.id], staff.name, dateRange);
      if (!consecutiveResult.valid) {
        allViolations.push(...consecutiveResult.violations);
      }
    }
  });

  // Validate daily constraints for each date
  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
    validationSummary.totalConstraintsChecked += 5; // daily limits, group conflicts, priority rules, coverage compensation, proximity patterns

    const dailyLimitsResult = validateDailyLimits(scheduleData, dateKey, staffMembers);
    if (!dailyLimitsResult.valid) {
      allViolations.push(...dailyLimitsResult.violations);
    }

    const groupConflictsResult = validateStaffGroupConflicts(scheduleData, dateKey, staffMembers);
    if (!groupConflictsResult.valid) {
      allViolations.push(...groupConflictsResult.violations);
    }

    const priorityRulesResult = validatePriorityRules(scheduleData, dateKey, staffMembers);
    if (!priorityRulesResult.valid) {
      allViolations.push(...priorityRulesResult.violations);
    }

    const coverageCompensationResult = validateCoverageCompensation(scheduleData, dateKey, staffMembers);
    if (!coverageCompensationResult.valid) {
      allViolations.push(...coverageCompensationResult.violations);
    }
  });

  // Validate proximity patterns (needs full date range, so validate once)
  validationSummary.totalConstraintsChecked += 1;
  const proximityPatternsResult = validateProximityPatterns(scheduleData, dateRange, staffMembers);
  if (!proximityPatternsResult.valid) {
    allViolations.push(...proximityPatternsResult.violations);
  }

  // Categorize violations
  allViolations.forEach(violation => {
    validationSummary.violationsFound++;
    
    // Count by severity
    switch (violation.severity) {
      case 'critical':
        validationSummary.criticalViolations++;
        break;
      case 'high':
        validationSummary.highViolations++;
        break;
      case 'medium':
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
  
  console.log(`✅ Constraint validation completed: ${isValid ? 'VALID' : 'VIOLATIONS FOUND'}`);
  console.log(`📊 Summary: ${validationSummary.violationsFound} violations found in ${validationSummary.totalConstraintsChecked} checks`);

  return {
    valid: isValid,
    violations: allViolations,
    summary: validationSummary,
    constraintStatus: {
      monthlyLimits: 'checked',
      dailyLimits: 'checked',
      staffGroupConflicts: 'checked',
      priorityRules: 'checked',
      consecutiveOffDays: 'checked',
      coverageCompensation: 'checked',
      proximityPatterns: 'checked'
    }
  };
};

/**
 * Get violation recommendations for fixing constraint violations
 * @param {Array} violations - Array of constraint violations
 * @returns {Array} Array of recommendation objects
 */
export const getViolationRecommendations = (violations) => {
  const recommendations = [];

  violations.forEach(violation => {
    let recommendation = {};

    switch (violation.type) {
      case VIOLATION_TYPES.MONTHLY_OFF_LIMIT:
        recommendation = {
          violation,
          action: 'reduce_off_days',
          suggestion: `Reduce ${violation.staffName}'s off days by ${violation.details.excess}`,
          priority: 'high',
          alternativeActions: [
            'Convert some off days to working days',
            'Redistribute off days to other staff members'
          ]
        };
        break;

      case VIOLATION_TYPES.DAILY_OFF_LIMIT:
        recommendation = {
          violation,
          action: 'redistribute_off_days',
          suggestion: `Move ${violation.details.excess} staff from off to working on ${violation.date}`,
          priority: 'high',
          affectedStaff: violation.details.staffOff.slice(0, violation.details.excess),
          alternativeActions: [
            'Move off days to different dates',
            'Convert to early or late shifts'
          ]
        };
        break;

      case VIOLATION_TYPES.STAFF_GROUP_CONFLICT:
        recommendation = {
          violation,
          action: 'resolve_group_conflict',
          suggestion: `Change shift for one member of ${violation.group} on ${violation.date}`,
          priority: 'high',
          conflictingStaff: violation.details.conflictingMembers,
          alternativeActions: [
            'Move one member to working shift',
            'Swap shifts with staff from different group'
          ]
        };
        break;

      case VIOLATION_TYPES.PRIORITY_RULE_VIOLATION:
        recommendation = {
          violation,
          action: 'apply_priority_rule',
          suggestion: `Change ${violation.staffName}'s shift to ${violation.details.expectedShift} on ${violation.date}`,
          priority: violation.severity === 'high' ? 'high' : 'medium',
          alternativeActions: [
            'Adjust other staff schedules to accommodate priority',
            'Consider exception if business needs require it'
          ]
        };
        break;

      case VIOLATION_TYPES.INSUFFICIENT_COVERAGE:
        recommendation = {
          violation,
          action: 'increase_coverage',
          suggestion: `Add ${violation.details.deficit} more working staff on ${violation.date}`,
          priority: 'critical',
          alternativeActions: [
            'Convert off days to working days',
            'Call in additional staff',
            'Extend shifts for current working staff'
          ]
        };
        break;

      case VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF:
        recommendation = {
          violation,
          action: 'break_consecutive_streak',
          suggestion: `Add working day in middle of ${violation.staffName}'s consecutive off period`,
          priority: 'medium',
          streakDays: violation.details.consecutiveDays,
          alternativeActions: [
            'Split consecutive days into smaller periods',
            'Redistribute some off days to different weeks'
          ]
        };
        break;

      case VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION:
        recommendation = {
          violation,
          action: 'apply_coverage_compensation',
          suggestion: `Change ${violation.details.backupStaff}'s shift to normal on ${violation.date} when ${violation.details.groupMembersOff.join(', ')} is off`,
          priority: 'high',
          affectedStaff: [violation.details.backupStaff],
          alternativeActions: [
            'Change Group 2 member from off to working shift',
            'Arrange alternative coverage staff'
          ]
        };
        break;

      case VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION:
        recommendation = {
          violation,
          action: 'adjust_proximity_pattern',
          suggestion: `Schedule ${violation.details.targetStaff}'s day off within ±${violation.details.proximityRange} days of ${violation.details.triggerStaff}'s off day (${violation.date})`,
          priority: 'medium',
          affectedStaff: [violation.details.targetStaff],
          alternativeActions: [
            'Move target staff off day closer to trigger date',
            'Adjust trigger staff off day if more flexible'
          ]
        };
        break;

      default:
        recommendation = {
          violation,
          action: 'manual_review',
          suggestion: 'Manual review required for this constraint violation',
          priority: 'medium'
        };
    }

    recommendations.push(recommendation);
  });

  return recommendations;
};