/**
 * Schedule Validator
 *
 * Validates schedule data before import:
 * - Date range validation
 * - Shift symbol validation
 * - Staff availability validation
 * - Data integrity checks
 */

import { format, isWithinInterval, parseISO } from 'date-fns';

/**
 * Valid shift symbols supported by the system
 */
const VALID_SHIFT_SYMBOLS = ['△', '○', '◇', '×', '●', '◎', '▣', '★', '⊘', ''];

/**
 * Validate complete schedule data before import
 *
 * @param {Object} scheduleData - Schedule data { [staffId]: { [dateKey]: shift } }
 * @param {Array<Date>} dateRange - Expected date range for period
 * @param {Array<Object>} staffMembers - Staff members
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateScheduleData(scheduleData, dateRange, staffMembers, options = {}) {
  const {
    allowCustomShifts = true,  // Allow custom text shifts
    strictDateValidation = true, // Require all dates in range
    checkStaffAvailability = true // Validate staff is active during period
  } = options;

  const errors = [];
  const warnings = [];
  const info = [];

  // 1. Validate date range
  if (!dateRange || dateRange.length === 0) {
    errors.push({
      type: 'INVALID_DATE_RANGE',
      message: 'Date range is empty or invalid'
    });
    return { isValid: false, errors, warnings, info };
  }

  // 2. Validate schedule data structure
  if (!scheduleData || typeof scheduleData !== 'object') {
    errors.push({
      type: 'INVALID_SCHEDULE_DATA',
      message: 'Schedule data is missing or invalid'
    });
    return { isValid: false, errors, warnings, info };
  }

  // 3. Validate staff members
  if (!staffMembers || staffMembers.length === 0) {
    errors.push({
      type: 'NO_STAFF_MEMBERS',
      message: 'No staff members provided'
    });
    return { isValid: false, errors, warnings, info };
  }

  // 4. Validate each staff's schedule
  const staffIds = Object.keys(scheduleData);
  const dateKeys = dateRange.map(date => format(date, 'yyyy-MM-dd'));

  let totalShifts = 0;
  let customShiftCount = 0;
  let emptyShiftCount = 0;

  staffIds.forEach(staffId => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) {
      warnings.push({
        type: 'UNKNOWN_STAFF',
        message: `Staff ID ${staffId} not found in staff members`,
        staffId
      });
      return;
    }

    const staffSchedule = scheduleData[staffId];

    // Validate staff availability if enabled
    if (checkStaffAvailability) {
      const availabilityCheck = validateStaffAvailability(staff, dateRange);
      if (!availabilityCheck.isAvailable) {
        warnings.push({
          type: 'STAFF_NOT_AVAILABLE',
          message: `Staff ${staff.name} may not be available during this period`,
          staffName: staff.name,
          staffId,
          reason: availabilityCheck.reason
        });
      }
    }

    // Validate dates in schedule
    Object.entries(staffSchedule).forEach(([dateKey, shiftValue]) => {
      totalShifts++;

      // Check if date is in expected range
      if (strictDateValidation && !dateKeys.includes(dateKey)) {
        errors.push({
          type: 'DATE_OUT_OF_RANGE',
          message: `Date ${dateKey} is outside the expected range`,
          staffName: staff.name,
          staffId,
          dateKey
        });
      }

      // Validate shift symbol
      const shiftValidation = validateShiftSymbol(shiftValue, allowCustomShifts);
      if (!shiftValidation.isValid) {
        warnings.push({
          type: 'INVALID_SHIFT_SYMBOL',
          message: shiftValidation.message,
          staffName: staff.name,
          staffId,
          dateKey,
          shiftValue
        });
      }

      // Track custom and empty shifts
      if (shiftValidation.isCustom) {
        customShiftCount++;
      }
      if (shiftValue === '' || shiftValue === null) {
        emptyShiftCount++;
      }
    });

    // Check for missing dates
    if (strictDateValidation) {
      const missingDates = dateKeys.filter(dateKey => !(dateKey in staffSchedule));
      if (missingDates.length > 0) {
        info.push({
          type: 'MISSING_DATES',
          message: `Staff ${staff.name} has ${missingDates.length} missing date(s)`,
          staffName: staff.name,
          staffId,
          missingDates
        });
      }
    }
  });

  // 5. Check for missing staff
  const staffIdsInData = new Set(staffIds);
  const missingStaff = staffMembers.filter(s => !staffIdsInData.has(s.id));
  if (missingStaff.length > 0) {
    info.push({
      type: 'MISSING_STAFF',
      message: `${missingStaff.length} staff member(s) have no schedule data`,
      staff: missingStaff.map(s => ({ id: s.id, name: s.name }))
    });
  }

  // Summary statistics
  const stats = {
    totalStaff: staffIds.length,
    totalShifts,
    customShifts: customShiftCount,
    emptyShifts: emptyShiftCount,
    dateRange: {
      start: format(dateRange[0], 'yyyy-MM-dd'),
      end: format(dateRange[dateRange.length - 1], 'yyyy-MM-dd'),
      totalDays: dateRange.length
    }
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
    stats
  };
}

/**
 * Validate a single shift symbol
 *
 * @param {string} shiftSymbol - Shift symbol to validate
 * @param {boolean} allowCustom - Allow custom text values
 * @returns {Object} Validation result
 */
export function validateShiftSymbol(shiftSymbol, allowCustom = true) {
  // Empty is valid
  if (shiftSymbol === '' || shiftSymbol === null || shiftSymbol === undefined) {
    return { isValid: true, isCustom: false };
  }

  // Check if it's a standard symbol
  if (VALID_SHIFT_SYMBOLS.includes(shiftSymbol)) {
    return { isValid: true, isCustom: false };
  }

  // Check if it's a custom value
  if (allowCustom && typeof shiftSymbol === 'string') {
    return {
      isValid: true,
      isCustom: true,
      message: `Custom shift value: "${shiftSymbol}"`
    };
  }

  return {
    isValid: false,
    isCustom: false,
    message: `Invalid shift symbol: "${shiftSymbol}"`
  };
}

/**
 * Validate staff availability during period
 *
 * @param {Object} staff - Staff member object
 * @param {Array<Date>} dateRange - Date range
 * @returns {Object} Availability result
 */
export function validateStaffAvailability(staff, dateRange) {
  if (!staff) {
    return { isAvailable: false, reason: 'Staff member not provided' };
  }

  const periodStart = dateRange[0];
  const periodEnd = dateRange[dateRange.length - 1];

  // Check if staff has start/end period information
  if (staff.startPeriod) {
    const staffStart = new Date(
      staff.startPeriod.year,
      staff.startPeriod.month - 1,
      staff.startPeriod.day
    );

    // Staff starts after period ends
    if (staffStart > periodEnd) {
      return {
        isAvailable: false,
        reason: `Staff starts ${format(staffStart, 'yyyy-MM-dd')} (after period ends)`
      };
    }
  }

  if (staff.endPeriod) {
    const staffEnd = new Date(
      staff.endPeriod.year,
      staff.endPeriod.month - 1,
      staff.endPeriod.day
    );

    // Staff ends before period starts
    if (staffEnd < periodStart) {
      return {
        isAvailable: false,
        reason: `Staff ended ${format(staffEnd, 'yyyy-MM-dd')} (before period starts)`
      };
    }
  }

  // Check is_active flag
  if (staff.is_active === false) {
    return {
      isAvailable: false,
      reason: 'Staff is marked as inactive'
    };
  }

  return { isAvailable: true };
}

/**
 * Validate date range matches period
 *
 * @param {Array<Object>} parsedRows - Parsed rows from HTML
 * @param {Array<Date>} expectedDateRange - Expected date range
 * @returns {Object} Validation result
 */
export function validateDateRange(parsedRows, expectedDateRange) {
  const errors = [];
  const warnings = [];

  if (parsedRows.length !== expectedDateRange.length) {
    warnings.push({
      type: 'DATE_COUNT_MISMATCH',
      message: `Parsed ${parsedRows.length} days, expected ${expectedDateRange.length}`,
      parsed: parsedRows.length,
      expected: expectedDateRange.length
    });
  }

  // Check if day numbers match
  parsedRows.forEach((row, index) => {
    if (!expectedDateRange[index]) return;

    const expectedDay = expectedDateRange[index].getDate();
    const parsedDay = row.dayNumber;

    if (parsedDay !== expectedDay) {
      errors.push({
        type: 'DATE_MISMATCH',
        message: `Row ${index + 1}: Expected day ${expectedDay}, got ${parsedDay}`,
        rowIndex: index,
        expected: expectedDay,
        parsed: parsedDay
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check for potential data conflicts with existing schedule
 *
 * @param {Object} newScheduleData - New schedule data to import
 * @param {Object} existingScheduleData - Existing schedule data
 * @returns {Object} Conflict report
 */
export function checkScheduleConflicts(newScheduleData, existingScheduleData) {
  const conflicts = [];
  const additions = [];
  const unchanged = [];

  Object.entries(newScheduleData).forEach(([staffId, staffSchedule]) => {
    Object.entries(staffSchedule).forEach(([dateKey, newShift]) => {
      const existingShift = existingScheduleData?.[staffId]?.[dateKey];

      if (existingShift === undefined) {
        // New shift being added
        additions.push({ staffId, dateKey, newShift });
      } else if (existingShift !== newShift) {
        // Conflict: different shift value
        conflicts.push({
          staffId,
          dateKey,
          existingShift,
          newShift
        });
      } else {
        // Unchanged
        unchanged.push({ staffId, dateKey, shift: newShift });
      }
    });
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    additions,
    unchanged,
    summary: {
      totalConflicts: conflicts.length,
      totalAdditions: additions.length,
      totalUnchanged: unchanged.length
    }
  };
}

/**
 * Validate import compatibility with target period
 *
 * @param {Object} parsedData - Parsed HTML data
 * @param {Object} targetPeriod - Target period object
 * @returns {Object} Compatibility result
 */
export function validatePeriodCompatibility(parsedData, targetPeriod) {
  const errors = [];
  const warnings = [];

  if (!targetPeriod) {
    errors.push({
      type: 'NO_TARGET_PERIOD',
      message: 'Target period not specified'
    });
    return { isCompatible: false, errors, warnings };
  }

  const { period: detectedPeriod } = parsedData;

  if (!detectedPeriod) {
    warnings.push({
      type: 'PERIOD_NOT_DETECTED',
      message: 'Could not detect period from parsed data'
    });
  } else {
    // Check if detected period matches target
    const periodStart = new Date(targetPeriod.start);
    const expectedStartDay = periodStart.getDate();

    if (detectedPeriod.startDay !== expectedStartDay) {
      warnings.push({
        type: 'PERIOD_START_MISMATCH',
        message: `Detected start day ${detectedPeriod.startDay} differs from expected ${expectedStartDay}`,
        detected: detectedPeriod.startDay,
        expected: expectedStartDay
      });
    }
  }

  return {
    isCompatible: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get validation summary for display
 *
 * @param {Object} validationResult - Validation result object
 * @returns {string} Human-readable summary
 */
export function getValidationSummary(validationResult) {
  const { isValid, errors, warnings, info, stats } = validationResult;

  const lines = [];

  if (isValid) {
    lines.push('✅ Validation passed');
  } else {
    lines.push(`❌ Validation failed with ${errors.length} error(s)`);
  }

  if (stats) {
    lines.push('');
    lines.push('📊 Statistics:');
    lines.push(`  - Staff members: ${stats.totalStaff}`);
    lines.push(`  - Total shifts: ${stats.totalShifts}`);
    lines.push(`  - Custom shifts: ${stats.customShifts}`);
    lines.push(`  - Empty shifts: ${stats.emptyShifts}`);
    lines.push(`  - Date range: ${stats.dateRange.start} to ${stats.dateRange.end} (${stats.dateRange.totalDays} days)`);
  }

  if (errors.length > 0) {
    lines.push('');
    lines.push('❌ Errors:');
    errors.forEach(error => {
      lines.push(`  - ${error.message}`);
    });
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ Warnings:');
    warnings.forEach(warning => {
      lines.push(`  - ${warning.message}`);
    });
  }

  if (info.length > 0) {
    lines.push('');
    lines.push('ℹ️ Information:');
    info.forEach(item => {
      lines.push(`  - ${item.message}`);
    });
  }

  return lines.join('\n');
}

export default {
  validateScheduleData,
  validateShiftSymbol,
  validateStaffAvailability,
  validateDateRange,
  checkScheduleConflicts,
  validatePeriodCompatibility,
  getValidationSummary,
  VALID_SHIFT_SYMBOLS
};
