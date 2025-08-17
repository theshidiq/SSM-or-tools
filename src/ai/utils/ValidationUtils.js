/**
 * ValidationUtils.js
 *
 * Comprehensive validation utilities for AI system data and operations.
 * Provides validation functions for data integrity, constraint compliance, and system health.
 */

import { shiftSymbols } from "../../constants/shiftConstants";
import { isValidDateKey } from "./DataNormalizer";

/**
 * Validation result structure
 */
export const createValidationResult = (
  isValid,
  errors = [],
  warnings = [],
) => ({
  isValid,
  errors: Array.isArray(errors) ? errors : [errors],
  warnings: Array.isArray(warnings) ? warnings : [warnings],
  timestamp: new Date().toISOString(),
});

/**
 * Validate staff member object structure
 * @param {Object} staff - Staff member object to validate
 * @returns {Object} Validation result
 */
export const validateStaffMember = (staff) => {
  const errors = [];
  const warnings = [];

  if (!staff || typeof staff !== "object") {
    return createValidationResult(false, "Staff member must be an object");
  }

  // Required fields
  if (!staff.id || typeof staff.id !== "string" || staff.id.trim() === "") {
    errors.push("Staff member must have a valid ID");
  }

  if (
    !staff.name ||
    typeof staff.name !== "string" ||
    staff.name.trim() === ""
  ) {
    errors.push("Staff member must have a valid name");
  }

  // Optional but validated fields
  if (staff.status && !["社員", "派遣", "パート"].includes(staff.status)) {
    warnings.push(`Unknown staff status: ${staff.status}`);
  }

  if (staff.startPeriod && !validateWorkPeriod(staff.startPeriod).isValid) {
    warnings.push("Invalid start period format");
  }

  if (staff.endPeriod && !validateWorkPeriod(staff.endPeriod).isValid) {
    warnings.push("Invalid end period format");
  }

  // Check for reasonable field lengths
  if (staff.name && staff.name.length > 50) {
    warnings.push("Staff name is unusually long");
  }

  if (staff.position && staff.position.length > 100) {
    warnings.push("Staff position is unusually long");
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate work period object
 * @param {Object} period - Work period object to validate
 * @returns {Object} Validation result
 */
export const validateWorkPeriod = (period) => {
  const errors = [];

  if (!period || typeof period !== "object") {
    return createValidationResult(false, "Work period must be an object");
  }

  const year = parseInt(period.year);
  const month = parseInt(period.month);
  const day = parseInt(period.day);

  if (isNaN(year) || year < 2020 || year > 2030) {
    errors.push("Year must be between 2020 and 2030");
  }

  if (isNaN(month) || month < 1 || month > 12) {
    errors.push("Month must be between 1 and 12");
  }

  if (!isNaN(day) && (day < 1 || day > 31)) {
    errors.push("Day must be between 1 and 31");
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate schedule data structure
 * @param {Object} scheduleData - Schedule data to validate
 * @param {Array} staffMembers - Array of staff members for reference
 * @returns {Object} Validation result
 */
export const validateScheduleData = (scheduleData, staffMembers = []) => {
  const errors = [];
  const warnings = [];

  if (!scheduleData || typeof scheduleData !== "object") {
    return createValidationResult(false, "Schedule data must be an object");
  }

  const staffIds = staffMembers.map((staff) => staff.id);
  const validShiftValues = new Set([
    ...Object.values(shiftSymbols).map((s) => s.symbol),
    "", // Normal shift
    "early",
    "late",
    "normal",
    "off",
    "holiday", // Text alternatives
  ]);

  let totalShifts = 0;
  const dateFrequency = {};

  Object.keys(scheduleData).forEach((staffId) => {
    // Skip metadata fields
    if (staffId.startsWith("_")) {
      return;
    }

    // Check if staff ID exists in staff members
    if (staffIds.length > 0 && !staffIds.includes(staffId)) {
      warnings.push(`Schedule contains data for unknown staff ID: ${staffId}`);
    }

    const staffSchedule = scheduleData[staffId];

    if (!staffSchedule || typeof staffSchedule !== "object") {
      errors.push(`Invalid schedule data for staff ${staffId}`);
      return;
    }

    Object.keys(staffSchedule).forEach((dateKey) => {
      // Validate date format
      if (!isValidDateKey(dateKey)) {
        errors.push(`Invalid date key format: ${dateKey} for staff ${staffId}`);
        return;
      }

      // Track date frequency
      dateFrequency[dateKey] = (dateFrequency[dateKey] || 0) + 1;

      const shiftValue = staffSchedule[dateKey];

      // Validate shift value
      if (shiftValue !== undefined && shiftValue !== null) {
        if (!validShiftValues.has(shiftValue)) {
          // Allow custom text values, but warn about unknown symbols
          if (typeof shiftValue === "string" && shiftValue.length <= 5) {
            warnings.push(
              `Custom shift value "${shiftValue}" for ${staffId} on ${dateKey}`,
            );
          } else {
            errors.push(
              `Invalid shift value "${shiftValue}" for ${staffId} on ${dateKey}`,
            );
          }
        }
        totalShifts++;
      }
    });
  });

  // Check for data consistency
  if (totalShifts === 0) {
    warnings.push("Schedule contains no shift data");
  }

  // Check for uneven date coverage
  const maxFreq = Math.max(...Object.values(dateFrequency));
  const minFreq = Math.min(...Object.values(dateFrequency));

  if (maxFreq - minFreq > staffIds.length * 0.3) {
    warnings.push("Uneven date coverage across staff members");
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate date range array
 * @param {Array} dateRange - Array of dates to validate
 * @returns {Object} Validation result
 */
export const validateDateRange = (dateRange) => {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(dateRange)) {
    return createValidationResult(false, "Date range must be an array");
  }

  if (dateRange.length === 0) {
    return createValidationResult(false, "Date range cannot be empty");
  }

  const dates = [];
  dateRange.forEach((date, index) => {
    if (!(date instanceof Date)) {
      errors.push(`Invalid date at index ${index}: must be Date object`);
      return;
    }

    if (isNaN(date.getTime())) {
      errors.push(`Invalid date at index ${index}: not a valid date`);
      return;
    }

    dates.push(date.getTime());
  });

  // Check for chronological order
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      warnings.push("Dates are not in chronological order");
      break;
    }
  }

  // Check for gaps
  if (dates.length > 1) {
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const expectedDays =
      Math.floor((lastDate - firstDate) / (24 * 60 * 60 * 1000)) + 1;

    if (expectedDays !== dates.length) {
      warnings.push("Date range may have gaps or duplicates");
    }
  }

  // Check for reasonable range
  if (dates.length > 62) {
    warnings.push("Date range is unusually long (>62 days)");
  }

  if (dates.length < 7) {
    warnings.push("Date range is unusually short (<7 days)");
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate constraint object
 * @param {Object} constraint - Constraint object to validate
 * @returns {Object} Validation result
 */
export const validateConstraint = (constraint) => {
  const errors = [];
  const warnings = [];

  if (!constraint || typeof constraint !== "object") {
    return createValidationResult(false, "Constraint must be an object");
  }

  // Required fields
  if (!constraint.id || typeof constraint.id !== "string") {
    errors.push("Constraint must have a valid ID");
  }

  if (!constraint.name || typeof constraint.name !== "string") {
    errors.push("Constraint must have a valid name");
  }

  if (!constraint.type || typeof constraint.type !== "string") {
    errors.push("Constraint must have a valid type");
  }

  // Validate type-specific properties
  const validTypes = [
    "monthly_limit",
    "daily_limit",
    "staff_group",
    "priority_rule",
  ];
  if (constraint.type && !validTypes.includes(constraint.type)) {
    errors.push(`Unknown constraint type: ${constraint.type}`);
  }

  // Validate priority
  const validPriorities = ["critical", "high", "medium", "low"];
  if (constraint.priority && !validPriorities.includes(constraint.priority)) {
    warnings.push(`Unknown priority level: ${constraint.priority}`);
  }

  // Type-specific validations
  switch (constraint.type) {
    case "monthly_limit":
      if (typeof constraint.maxValue !== "number" || constraint.maxValue < 0) {
        errors.push("Monthly limit constraint must have valid maxValue");
      }
      if (
        constraint.minValue !== undefined &&
        (typeof constraint.minValue !== "number" || constraint.minValue < 0)
      ) {
        errors.push("Monthly limit constraint must have valid minValue");
      }
      break;

    case "daily_limit":
      if (typeof constraint.maxValue !== "number" || constraint.maxValue < 0) {
        errors.push("Daily limit constraint must have valid maxValue");
      }
      break;

    case "staff_group":
      if (
        !Array.isArray(constraint.groupMembers) ||
        constraint.groupMembers.length === 0
      ) {
        errors.push(
          "Staff group constraint must have valid groupMembers array",
        );
      }
      break;

    case "priority_rule":
      if (!constraint.staffName || typeof constraint.staffName !== "string") {
        errors.push("Priority rule constraint must have valid staffName");
      }
      if (!constraint.rule || typeof constraint.rule !== "object") {
        errors.push("Priority rule constraint must have valid rule object");
      }
      break;
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate preference object
 * @param {Object} preference - Preference object to validate
 * @returns {Object} Validation result
 */
export const validatePreference = (preference) => {
  const errors = [];
  const warnings = [];

  if (!preference || typeof preference !== "object") {
    return createValidationResult(false, "Preference must be an object");
  }

  // Required fields
  if (!preference.id || typeof preference.id !== "string") {
    errors.push("Preference must have a valid ID");
  }

  if (!preference.staffId || typeof preference.staffId !== "string") {
    errors.push("Preference must have a valid staffId");
  }

  if (!preference.type || typeof preference.type !== "string") {
    errors.push("Preference must have a valid type");
  }

  // Validate type
  const validTypes = [
    "day_of_week",
    "shift_type",
    "consecutive_pattern",
    "frequency",
    "seasonal",
  ];
  if (preference.type && !validTypes.includes(preference.type)) {
    errors.push(`Unknown preference type: ${preference.type}`);
  }

  // Validate confidence
  const validConfidenceLevels = [
    "very_high",
    "high",
    "medium",
    "low",
    "very_low",
  ];
  if (
    preference.confidence &&
    !validConfidenceLevels.includes(preference.confidence)
  ) {
    warnings.push(`Unknown confidence level: ${preference.confidence}`);
  }

  // Validate strength
  if (preference.strength !== undefined) {
    if (
      typeof preference.strength !== "number" ||
      preference.strength < 0 ||
      preference.strength > 100
    ) {
      errors.push("Preference strength must be a number between 0 and 100");
    }
  }

  // Type-specific validations
  switch (preference.type) {
    case "day_of_week":
      const validDays = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      if (preference.dayOfWeek && !validDays.includes(preference.dayOfWeek)) {
        errors.push(`Invalid day of week: ${preference.dayOfWeek}`);
      }
      break;

    case "shift_type":
      const validShiftTypes = ["early", "late", "normal", "off"];
      if (
        preference.shiftType &&
        !validShiftTypes.includes(preference.shiftType)
      ) {
        errors.push(`Invalid shift type: ${preference.shiftType}`);
      }
      break;

    case "consecutive_pattern":
      if (
        preference.preferredLength !== undefined &&
        (typeof preference.preferredLength !== "number" ||
          preference.preferredLength < 1)
      ) {
        errors.push(
          "Consecutive pattern preference must have valid preferredLength",
        );
      }
      break;

    case "frequency":
      if (
        preference.targetPercentage !== undefined &&
        (typeof preference.targetPercentage !== "number" ||
          preference.targetPercentage < 0 ||
          preference.targetPercentage > 100)
      ) {
        errors.push(
          "Frequency preference must have valid targetPercentage (0-100)",
        );
      }
      break;
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate analysis result structure
 * @param {Object} analysisResult - Analysis result to validate
 * @returns {Object} Validation result
 */
export const validateAnalysisResult = (analysisResult) => {
  const errors = [];
  const warnings = [];

  if (!analysisResult || typeof analysisResult !== "object") {
    return createValidationResult(false, "Analysis result must be an object");
  }

  // Check success flag
  if (typeof analysisResult.success !== "boolean") {
    errors.push("Analysis result must have a success boolean field");
  }

  if (analysisResult.success) {
    // Successful analysis should have data
    if (
      !analysisResult.analysis ||
      typeof analysisResult.analysis !== "object"
    ) {
      errors.push("Successful analysis must have analysis data");
    }

    // Check for required analysis components
    if (analysisResult.analysis) {
      const requiredComponents = [
        "workloadAnalysis",
        "dayOfWeekAnalysis",
        "optimizationAnalysis",
      ];
      requiredComponents.forEach((component) => {
        if (!analysisResult.analysis[component]) {
          warnings.push(`Missing analysis component: ${component}`);
        }
      });

      // Check summary
      if (!analysisResult.analysis.summary) {
        warnings.push("Analysis missing summary section");
      }
    }
  } else {
    // Failed analysis should have error
    if (!analysisResult.error || typeof analysisResult.error !== "string") {
      errors.push("Failed analysis must have error message");
    }
  }

  // Check timestamp
  if (analysisResult.analyzedAt) {
    const timestamp = new Date(analysisResult.analyzedAt);
    if (isNaN(timestamp.getTime())) {
      warnings.push("Invalid analyzedAt timestamp");
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate system configuration
 * @param {Object} config - System configuration to validate
 * @returns {Object} Validation result
 */
export const validateSystemConfig = (config) => {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== "object") {
    return createValidationResult(false, "Configuration must be an object");
  }

  // Validate AI system settings
  if (config.aiSettings) {
    const aiSettings = config.aiSettings;

    if (
      aiSettings.analysisDepth &&
      !["shallow", "medium", "deep"].includes(aiSettings.analysisDepth)
    ) {
      warnings.push("Unknown analysis depth setting");
    }

    if (
      aiSettings.confidenceThreshold !== undefined &&
      (typeof aiSettings.confidenceThreshold !== "number" ||
        aiSettings.confidenceThreshold < 0 ||
        aiSettings.confidenceThreshold > 100)
    ) {
      errors.push("Confidence threshold must be between 0 and 100");
    }
  }

  // Validate constraint settings
  if (config.constraintSettings) {
    const constraintSettings = config.constraintSettings;

    if (
      constraintSettings.strictMode !== undefined &&
      typeof constraintSettings.strictMode !== "boolean"
    ) {
      errors.push("Strict mode must be a boolean");
    }

    if (
      constraintSettings.warningLevel &&
      !["low", "medium", "high"].includes(constraintSettings.warningLevel)
    ) {
      warnings.push("Unknown warning level setting");
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate data integrity across related objects
 * @param {Object} scheduleData - Schedule data
 * @param {Array} staffMembers - Staff members array
 * @param {Array} dateRange - Date range array
 * @returns {Object} Validation result
 */
export const validateDataIntegrity = (
  scheduleData,
  staffMembers,
  dateRange,
) => {
  const errors = [];
  const warnings = [];

  // Validate individual components first
  const scheduleValidation = validateScheduleData(scheduleData, staffMembers);
  const staffValidation = validateStaffMembers(staffMembers);
  const dateValidation = validateDateRange(dateRange);

  if (!scheduleValidation.isValid) {
    errors.push(...scheduleValidation.errors);
  }
  if (!staffValidation.isValid) {
    errors.push(...staffValidation.errors);
  }
  if (!dateValidation.isValid) {
    errors.push(...dateValidation.errors);
  }

  // Cross-reference validations
  if (scheduleData && staffMembers && dateRange) {
    const staffIds = staffMembers.map((staff) => staff.id);
    const dateKeys = dateRange.map((date) => date.toISOString().split("T")[0]);

    // Check staff coverage
    const scheduleStaffIds = Object.keys(scheduleData).filter(
      (id) => !id.startsWith("_"),
    );
    const missingStaff = staffIds.filter(
      (id) => !scheduleStaffIds.includes(id),
    );
    const extraStaff = scheduleStaffIds.filter((id) => !staffIds.includes(id));

    if (missingStaff.length > 0) {
      warnings.push(`Staff missing from schedule: ${missingStaff.join(", ")}`);
    }
    if (extraStaff.length > 0) {
      warnings.push(`Unknown staff in schedule: ${extraStaff.join(", ")}`);
    }

    // Check date coverage
    const allScheduleDates = new Set();
    Object.values(scheduleData).forEach((staffSchedule) => {
      if (staffSchedule && typeof staffSchedule === "object") {
        Object.keys(staffSchedule).forEach((dateKey) => {
          allScheduleDates.add(dateKey);
        });
      }
    });

    const missingDates = dateKeys.filter(
      (dateKey) => !allScheduleDates.has(dateKey),
    );
    if (missingDates.length > 0 && missingDates.length < dateKeys.length) {
      warnings.push(
        `Some dates missing from schedule data: ${missingDates.length} dates`,
      );
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Validate staff members array
 * @param {Array} staffMembers - Staff members to validate
 * @returns {Object} Validation result
 */
export const validateStaffMembers = (staffMembers) => {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(staffMembers)) {
    return createValidationResult(false, "Staff members must be an array");
  }

  if (staffMembers.length === 0) {
    return createValidationResult(false, "Staff members array cannot be empty");
  }

  const staffIds = new Set();
  const staffNames = new Set();

  staffMembers.forEach((staff, index) => {
    const staffValidation = validateStaffMember(staff);

    if (!staffValidation.isValid) {
      errors.push(
        `Staff member ${index}: ${staffValidation.errors.join(", ")}`,
      );
    }

    if (staffValidation.warnings.length > 0) {
      warnings.push(
        `Staff member ${index}: ${staffValidation.warnings.join(", ")}`,
      );
    }

    // Check for duplicates
    if (staff && staff.id) {
      if (staffIds.has(staff.id)) {
        errors.push(`Duplicate staff ID: ${staff.id}`);
      }
      staffIds.add(staff.id);
    }

    if (staff && staff.name) {
      if (staffNames.has(staff.name)) {
        warnings.push(`Duplicate staff name: ${staff.name}`);
      }
      staffNames.add(staff.name);
    }
  });

  return createValidationResult(errors.length === 0, errors, warnings);
};

/**
 * Batch validate multiple objects
 * @param {Array} items - Array of items to validate
 * @param {Function} validateFunction - Validation function to apply
 * @param {string} itemType - Type of items being validated (for error messages)
 * @returns {Object} Batch validation result
 */
export const batchValidate = (items, validateFunction, itemType = "item") => {
  const errors = [];
  const warnings = [];
  let validCount = 0;

  if (!Array.isArray(items)) {
    return createValidationResult(
      false,
      `${itemType}s must be provided as an array`,
    );
  }

  items.forEach((item, index) => {
    try {
      const validation = validateFunction(item);

      if (validation.isValid) {
        validCount++;
      } else {
        errors.push(`${itemType} ${index}: ${validation.errors.join(", ")}`);
      }

      if (validation.warnings.length > 0) {
        warnings.push(
          `${itemType} ${index}: ${validation.warnings.join(", ")}`,
        );
      }
    } catch (error) {
      errors.push(`${itemType} ${index}: Validation error - ${error.message}`);
    }
  });

  const summary = {
    total: items.length,
    valid: validCount,
    invalid: items.length - validCount,
    validationRate: items.length > 0 ? (validCount / items.length) * 100 : 0,
  };

  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    summary,
  };
};
