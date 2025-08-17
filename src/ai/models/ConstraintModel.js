/**
 * ConstraintModel.js
 *
 * Model classes for constraint definitions and management.
 * Provides structured representation of scheduling constraints and rules.
 */

import {
  VIOLATION_TYPES,
  DAILY_LIMITS,
  getMonthlyLimits,
} from "../constraints/ConstraintEngine";

/**
 * Base constraint class
 */
export class Constraint {
  constructor(name, type, priority = "medium") {
    this.id = this.generateId();
    this.name = name;
    this.type = type;
    this.priority = priority; // 'critical', 'high', 'medium', 'low'
    this.active = true;
    this.description = "";
    this.tags = [];
    this.createdAt = new Date().toISOString();
    this.lastModified = new Date().toISOString();
  }

  /**
   * Generate unique ID for constraint
   * @returns {string} Unique constraint ID
   */
  generateId() {
    return `constraint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate the constraint against schedule data
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Validation result
   */
  validate(scheduleData, staffMembers, dateRange) {
    throw new Error("validate method must be implemented by subclass");
  }

  /**
   * Update the constraint
   * @param {Object} updates - Updates to apply
   */
  update(updates) {
    Object.keys(updates).forEach((key) => {
      if (key !== "id" && key !== "createdAt") {
        this[key] = updates[key];
      }
    });
    this.lastModified = new Date().toISOString();
  }

  /**
   * Add a tag to the constraint
   * @param {string} tag - Tag to add
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.lastModified = new Date().toISOString();
    }
  }

  /**
   * Remove a tag from the constraint
   * @param {string} tag - Tag to remove
   */
  removeTag(tag) {
    this.tags = this.tags.filter((t) => t !== tag);
    this.lastModified = new Date().toISOString();
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      priority: this.priority,
      active: this.active,
      description: this.description,
      tags: [...this.tags],
      createdAt: this.createdAt,
      lastModified: this.lastModified,
    };
  }
}

/**
 * Monthly limit constraint (e.g., max off days per month)
 */
export class MonthlyLimitConstraint extends Constraint {
  constructor(name, limitType, maxValue, minValue = 0) {
    super(name, "monthly_limit", "high");
    this.limitType = limitType; // 'off_days', 'work_days', 'early_shifts', etc.
    this.maxValue = maxValue;
    this.minValue = minValue;
    this.appliesToAllStaff = true;
    this.exemptStaff = [];
    this.customLimits = {}; // { staffId: { max: number, min: number } }
  }

  /**
   * Set custom limits for specific staff
   * @param {string} staffId - Staff member ID
   * @param {number} maxValue - Maximum value for this staff
   * @param {number} minValue - Minimum value for this staff
   */
  setCustomLimit(staffId, maxValue, minValue = 0) {
    this.customLimits[staffId] = { max: maxValue, min: minValue };
    this.lastModified = new Date().toISOString();
  }

  /**
   * Remove custom limit for staff
   * @param {string} staffId - Staff member ID
   */
  removeCustomLimit(staffId) {
    delete this.customLimits[staffId];
    this.lastModified = new Date().toISOString();
  }

  /**
   * Get limit for specific staff member
   * @param {string} staffId - Staff member ID
   * @returns {Object} Limit object with max and min values
   */
  getLimitForStaff(staffId) {
    if (this.exemptStaff.includes(staffId)) {
      return { max: Infinity, min: 0 };
    }

    if (this.customLimits[staffId]) {
      return this.customLimits[staffId];
    }

    return { max: this.maxValue, min: this.minValue };
  }

  /**
   * Validate monthly limits
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Validation result
   */
  validate(scheduleData, staffMembers, dateRange) {
    const violations = [];

    staffMembers.forEach((staff) => {
      if (!this.active || this.exemptStaff.includes(staff.id)) {
        return;
      }

      const staffSchedule = scheduleData[staff.id];
      if (!staffSchedule) return;

      const limits = this.getLimitForStaff(staff.id);
      let count = 0;

      // Count based on limit type
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = staffSchedule[dateKey];

        if (this.shiftMatchesType(shift)) {
          count++;
        }
      });

      // Check violations
      if (count > limits.max) {
        violations.push({
          type: VIOLATION_TYPES.MONTHLY_OFF_LIMIT,
          constraintId: this.id,
          staffId: staff.id,
          staffName: staff.name,
          message: `${staff.name} exceeds ${this.limitType} limit: ${count} > ${limits.max}`,
          severity: this.priority,
          details: {
            limitType: this.limitType,
            count,
            maxLimit: limits.max,
            excess: count - limits.max,
          },
        });
      } else if (count < limits.min) {
        violations.push({
          type: VIOLATION_TYPES.MONTHLY_OFF_LIMIT,
          constraintId: this.id,
          staffId: staff.id,
          staffName: staff.name,
          message: `${staff.name} below ${this.limitType} minimum: ${count} < ${limits.min}`,
          severity: this.priority,
          details: {
            limitType: this.limitType,
            count,
            minLimit: limits.min,
            deficit: limits.min - count,
          },
        });
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      constraintId: this.id,
      constraintName: this.name,
    };
  }

  /**
   * Check if shift matches the constraint type
   * @param {string} shift - Shift value
   * @returns {boolean} True if shift matches type
   */
  shiftMatchesType(shift) {
    switch (this.limitType) {
      case "off_days":
        return shift === "×" || shift === "off" || shift === "★";
      case "early_shifts":
        return shift === "△" || shift === "early";
      case "late_shifts":
        return shift === "◇" || shift === "late";
      case "work_days":
        return (
          shift !== "×" &&
          shift !== "off" &&
          shift !== "★" &&
          shift !== undefined
        );
      default:
        return false;
    }
  }

  /**
   * Convert to JSON with additional monthly limit data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      limitType: this.limitType,
      maxValue: this.maxValue,
      minValue: this.minValue,
      appliesToAllStaff: this.appliesToAllStaff,
      exemptStaff: [...this.exemptStaff],
      customLimits: { ...this.customLimits },
    };
  }
}

/**
 * Daily limit constraint (e.g., max staff off per day)
 */
export class DailyLimitConstraint extends Constraint {
  constructor(name, limitType, maxValue, minValue = 0) {
    super(name, "daily_limit", "high");
    this.limitType = limitType; // 'off_count', 'early_count', 'working_count', etc.
    this.maxValue = maxValue;
    this.minValue = minValue;
    this.daysOfWeek = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    this.customLimitsByDay = {}; // { 'monday': { max: 3, min: 1 }, ... }
  }

  /**
   * Set custom limits for specific days of the week
   * @param {string} dayOfWeek - Day of week (e.g., 'monday')
   * @param {number} maxValue - Maximum value for this day
   * @param {number} minValue - Minimum value for this day
   */
  setDayLimit(dayOfWeek, maxValue, minValue = 0) {
    this.customLimitsByDay[dayOfWeek] = { max: maxValue, min: minValue };
    this.lastModified = new Date().toISOString();
  }

  /**
   * Get limit for specific day
   * @param {string} dayOfWeek - Day of week
   * @returns {Object} Limit object with max and min values
   */
  getLimitForDay(dayOfWeek) {
    return (
      this.customLimitsByDay[dayOfWeek] || {
        max: this.maxValue,
        min: this.minValue,
      }
    );
  }

  /**
   * Validate daily limits
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Validation result
   */
  validate(scheduleData, staffMembers, dateRange) {
    const violations = [];

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][date.getDay()];

      if (!this.daysOfWeek.includes(dayOfWeek)) {
        return; // Skip days not included in constraint
      }

      const limits = this.getLimitForDay(dayOfWeek);
      let count = 0;
      const affectedStaff = [];

      // Count based on limit type
      staffMembers.forEach((staff) => {
        const staffSchedule = scheduleData[staff.id];
        if (staffSchedule && staffSchedule[dateKey] !== undefined) {
          const shift = staffSchedule[dateKey];

          if (this.shiftMatchesType(shift)) {
            count++;
            affectedStaff.push({
              id: staff.id,
              name: staff.name,
              shift,
            });
          }
        }
      });

      // Check violations
      if (count > limits.max) {
        violations.push({
          type: VIOLATION_TYPES.DAILY_OFF_LIMIT,
          constraintId: this.id,
          date: dateKey,
          dayOfWeek,
          message: `Too many ${this.limitType} on ${dateKey}: ${count} > ${limits.max}`,
          severity: this.priority,
          details: {
            limitType: this.limitType,
            count,
            maxLimit: limits.max,
            excess: count - limits.max,
            affectedStaff,
          },
        });
      } else if (count < limits.min) {
        violations.push({
          type: VIOLATION_TYPES.INSUFFICIENT_COVERAGE,
          constraintId: this.id,
          date: dateKey,
          dayOfWeek,
          message: `Too few ${this.limitType} on ${dateKey}: ${count} < ${limits.min}`,
          severity: this.priority,
          details: {
            limitType: this.limitType,
            count,
            minLimit: limits.min,
            deficit: limits.min - count,
            affectedStaff,
          },
        });
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      constraintId: this.id,
      constraintName: this.name,
    };
  }

  /**
   * Check if shift matches the constraint type
   * @param {string} shift - Shift value
   * @returns {boolean} True if shift matches type
   */
  shiftMatchesType(shift) {
    switch (this.limitType) {
      case "off_count":
        return shift === "×" || shift === "off" || shift === "★";
      case "early_count":
        return shift === "△" || shift === "early";
      case "late_count":
        return shift === "◇" || shift === "late";
      case "working_count":
        return (
          shift !== "×" &&
          shift !== "off" &&
          shift !== "★" &&
          shift !== undefined
        );
      case "normal_count":
        return shift === "" || shift === "normal";
      default:
        return false;
    }
  }

  /**
   * Convert to JSON with additional daily limit data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      limitType: this.limitType,
      maxValue: this.maxValue,
      minValue: this.minValue,
      daysOfWeek: [...this.daysOfWeek],
      customLimitsByDay: { ...this.customLimitsByDay },
    };
  }
}

/**
 * Staff group conflict constraint
 */
export class StaffGroupConstraint extends Constraint {
  constructor(name, groupMembers, conflictType = "simultaneous_off") {
    super(name, "staff_group", "high");
    this.groupMembers = [...groupMembers];
    this.conflictType = conflictType; // 'simultaneous_off', 'simultaneous_early', 'simultaneous_late'
    this.maxSimultaneous = 1;
    this.exemptDates = []; // Dates where this constraint doesn't apply
    this.allowOverride = false;
  }

  /**
   * Add member to group
   * @param {string} memberName - Staff member name
   */
  addMember(memberName) {
    if (!this.groupMembers.includes(memberName)) {
      this.groupMembers.push(memberName);
      this.lastModified = new Date().toISOString();
    }
  }

  /**
   * Remove member from group
   * @param {string} memberName - Staff member name
   */
  removeMember(memberName) {
    this.groupMembers = this.groupMembers.filter(
      (member) => member !== memberName,
    );
    this.lastModified = new Date().toISOString();
  }

  /**
   * Add exempt date
   * @param {string} dateKey - Date in YYYY-MM-DD format
   */
  addExemptDate(dateKey) {
    if (!this.exemptDates.includes(dateKey)) {
      this.exemptDates.push(dateKey);
      this.lastModified = new Date().toISOString();
    }
  }

  /**
   * Validate staff group constraints
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Validation result
   */
  validate(scheduleData, staffMembers, dateRange) {
    const violations = [];

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      if (this.exemptDates.includes(dateKey)) {
        return; // Skip exempt dates
      }

      let count = 0;
      const conflictingStaff = [];

      // Check each group member
      this.groupMembers.forEach((memberName) => {
        const staff = staffMembers.find((s) => s.name === memberName);
        if (
          staff &&
          scheduleData[staff.id] &&
          scheduleData[staff.id][dateKey] !== undefined
        ) {
          const shift = scheduleData[staff.id][dateKey];

          if (this.shiftMatchesConflictType(shift)) {
            count++;
            conflictingStaff.push({
              id: staff.id,
              name: staff.name,
              shift,
            });
          }
        }
      });

      // Check for violations
      if (count > this.maxSimultaneous) {
        violations.push({
          type: VIOLATION_TYPES.STAFF_GROUP_CONFLICT,
          constraintId: this.id,
          date: dateKey,
          groupName: this.name,
          message: `${this.name} conflict on ${dateKey}: ${count} members with ${this.conflictType}`,
          severity: this.priority,
          details: {
            conflictType: this.conflictType,
            count,
            maxSimultaneous: this.maxSimultaneous,
            excess: count - this.maxSimultaneous,
            conflictingStaff,
            groupMembers: [...this.groupMembers],
          },
        });
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      constraintId: this.id,
      constraintName: this.name,
    };
  }

  /**
   * Check if shift matches the conflict type
   * @param {string} shift - Shift value
   * @returns {boolean} True if shift matches conflict type
   */
  shiftMatchesConflictType(shift) {
    switch (this.conflictType) {
      case "simultaneous_off":
        return shift === "×" || shift === "off" || shift === "★";
      case "simultaneous_early":
        return shift === "△" || shift === "early";
      case "simultaneous_late":
        return shift === "◇" || shift === "late";
      case "simultaneous_work":
        return (
          shift !== "×" &&
          shift !== "off" &&
          shift !== "★" &&
          shift !== undefined
        );
      default:
        return false;
    }
  }

  /**
   * Convert to JSON with additional group constraint data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      groupMembers: [...this.groupMembers],
      conflictType: this.conflictType,
      maxSimultaneous: this.maxSimultaneous,
      exemptDates: [...this.exemptDates],
      allowOverride: this.allowOverride,
    };
  }
}

/**
 * Priority rule constraint (e.g., specific staff preferences)
 */
export class PriorityRuleConstraint extends Constraint {
  constructor(name, staffName, rule) {
    super(name, "priority_rule", "medium");
    this.staffName = staffName;
    this.rule = rule; // { day: 'sunday', shift: 'early', priority: 'high' }
    this.flexibility = "strict"; // 'strict', 'flexible', 'preferred'
    this.exemptDates = [];
  }

  /**
   * Validate priority rules
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Validation result
   */
  validate(scheduleData, staffMembers, dateRange) {
    const violations = [];
    const staff = staffMembers.find((s) => s.name === this.staffName);

    if (!staff || !scheduleData[staff.id]) {
      return {
        valid: true,
        violations: [],
        constraintId: this.id,
        constraintName: this.name,
      };
    }

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][date.getDay()];

      if (this.exemptDates.includes(dateKey) || dayOfWeek !== this.rule.day) {
        return;
      }

      const actualShift = scheduleData[staff.id][dateKey];
      if (actualShift === undefined) return;

      const expectedShift = this.rule.shift;
      let ruleViolated = false;

      // Check if actual shift matches expected shift
      if (
        expectedShift === "off" &&
        !(actualShift === "×" || actualShift === "off" || actualShift === "★")
      ) {
        ruleViolated = true;
      } else if (
        expectedShift === "early" &&
        !(actualShift === "△" || actualShift === "early")
      ) {
        ruleViolated = true;
      } else if (
        expectedShift === "late" &&
        !(actualShift === "◇" || actualShift === "late")
      ) {
        ruleViolated = true;
      } else if (
        expectedShift === "normal" &&
        !(actualShift === "" || actualShift === "normal")
      ) {
        ruleViolated = true;
      }

      if (ruleViolated) {
        const severity =
          this.flexibility === "strict"
            ? this.priority
            : this.flexibility === "flexible"
              ? "low"
              : "medium";

        violations.push({
          type: VIOLATION_TYPES.PRIORITY_RULE_VIOLATION,
          constraintId: this.id,
          staffId: staff.id,
          staffName: this.staffName,
          date: dateKey,
          dayOfWeek,
          message: `${this.staffName} priority rule violated on ${dayOfWeek}: expected ${expectedShift}, got ${actualShift}`,
          severity,
          details: {
            rule: { ...this.rule },
            expectedShift,
            actualShift,
            flexibility: this.flexibility,
          },
        });
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      constraintId: this.id,
      constraintName: this.name,
    };
  }

  /**
   * Convert to JSON with additional priority rule data
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      staffName: this.staffName,
      rule: { ...this.rule },
      flexibility: this.flexibility,
      exemptDates: [...this.exemptDates],
    };
  }
}

/**
 * Constraint manager for handling multiple constraints
 */
export class ConstraintManager {
  constructor() {
    this.constraints = new Map();
    this.validationHistory = [];
    this.initializeDefaultConstraints();
  }

  /**
   * Initialize default constraints based on business rules
   */
  initializeDefaultConstraints() {
    // Monthly off day limits
    const monthlyOffLimit = new MonthlyLimitConstraint(
      "Monthly Off Day Limit",
      "off_days",
      8, // max 8 off days for 31-day months, 7 for 30-day months
      0,
    );
    this.addConstraint(monthlyOffLimit);

    // Daily off limit
    const dailyOffLimit = new DailyLimitConstraint(
      "Daily Off Limit",
      "off_count",
      DAILY_LIMITS.maxOffPerDay,
      0,
    );
    this.addConstraint(dailyOffLimit);

    // Daily early shift limit
    const dailyEarlyLimit = new DailyLimitConstraint(
      "Daily Early Shift Limit",
      "early_count",
      DAILY_LIMITS.maxEarlyPerDay,
      0,
    );
    this.addConstraint(dailyEarlyLimit);

    // Minimum working staff
    const minWorkingStaff = new DailyLimitConstraint(
      "Minimum Working Staff",
      "working_count",
      Infinity,
      DAILY_LIMITS.minWorkingStaffPerDay,
    );
    this.addConstraint(minWorkingStaff);
  }

  /**
   * Add a constraint
   * @param {Constraint} constraint - Constraint to add
   */
  addConstraint(constraint) {
    this.constraints.set(constraint.id, constraint);
  }

  /**
   * Remove a constraint
   * @param {string} constraintId - ID of constraint to remove
   */
  removeConstraint(constraintId) {
    this.constraints.delete(constraintId);
  }

  /**
   * Get a constraint by ID
   * @param {string} constraintId - Constraint ID
   * @returns {Constraint|null} The constraint or null if not found
   */
  getConstraint(constraintId) {
    return this.constraints.get(constraintId) || null;
  }

  /**
   * Get all constraints
   * @returns {Array} Array of all constraints
   */
  getAllConstraints() {
    return Array.from(this.constraints.values());
  }

  /**
   * Get constraints by type
   * @param {string} type - Constraint type
   * @returns {Array} Array of constraints of the specified type
   */
  getConstraintsByType(type) {
    return Array.from(this.constraints.values()).filter(
      (constraint) => constraint.type === type && constraint.active,
    );
  }

  /**
   * Validate all constraints
   * @param {Object} scheduleData - Schedule data to validate
   * @param {Array} staffMembers - Array of staff members
   * @param {Array} dateRange - Array of dates
   * @returns {Object} Complete validation result
   */
  validateAllConstraints(scheduleData, staffMembers, dateRange) {
    console.log("🔍 Validating all constraints...");

    const validationResult = {
      valid: true,
      timestamp: new Date().toISOString(),
      totalConstraints: 0,
      violatedConstraints: 0,
      totalViolations: 0,
      violationsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      constraintResults: [],
      allViolations: [],
      summary: {},
    };

    // Validate each active constraint
    Array.from(this.constraints.values()).forEach((constraint) => {
      if (constraint.active) {
        validationResult.totalConstraints++;

        const result = constraint.validate(
          scheduleData,
          staffMembers,
          dateRange,
        );
        validationResult.constraintResults.push(result);

        if (!result.valid) {
          validationResult.valid = false;
          validationResult.violatedConstraints++;
          validationResult.totalViolations += result.violations.length;

          result.violations.forEach((violation) => {
            validationResult.allViolations.push(violation);
            validationResult.violationsBySeverity[violation.severity]++;
          });
        }
      }
    });

    // Store validation history
    this.validationHistory.push({
      timestamp: validationResult.timestamp,
      valid: validationResult.valid,
      totalViolations: validationResult.totalViolations,
      violationsBySeverity: { ...validationResult.violationsBySeverity },
    });

    // Keep only last 50 validation records
    if (this.validationHistory.length > 50) {
      this.validationHistory = this.validationHistory.slice(-50);
    }

    // Generate summary
    validationResult.summary = {
      complianceRate:
        validationResult.totalConstraints > 0
          ? ((validationResult.totalConstraints -
              validationResult.violatedConstraints) /
              validationResult.totalConstraints) *
            100
          : 100,
      criticalIssues: validationResult.violationsBySeverity.critical > 0,
      recommendedActions: this.generateRecommendedActions(
        validationResult.allViolations,
      ),
    };

    console.log(
      `✅ Constraint validation completed: ${validationResult.valid ? "VALID" : "VIOLATIONS FOUND"}`,
    );
    return validationResult;
  }

  /**
   * Generate recommended actions for violations
   * @param {Array} violations - Array of violations
   * @returns {Array} Array of recommended actions
   */
  generateRecommendedActions(violations) {
    const actions = [];
    const violationTypes = {};

    // Group violations by type
    violations.forEach((violation) => {
      if (!violationTypes[violation.type]) {
        violationTypes[violation.type] = [];
      }
      violationTypes[violation.type].push(violation);
    });

    // Generate actions for each violation type
    Object.keys(violationTypes).forEach((type) => {
      const typeViolations = violationTypes[type];

      switch (type) {
        case VIOLATION_TYPES.MONTHLY_OFF_LIMIT:
          actions.push({
            type: "redistribute_monthly_off",
            priority: "high",
            affectedCount: typeViolations.length,
            description: "Redistribute monthly off days for affected staff",
            violations: typeViolations,
          });
          break;

        case VIOLATION_TYPES.DAILY_OFF_LIMIT:
          actions.push({
            type: "adjust_daily_off",
            priority: "high",
            affectedCount: typeViolations.length,
            description: "Adjust daily off assignments to meet limits",
            violations: typeViolations,
          });
          break;

        case VIOLATION_TYPES.STAFF_GROUP_CONFLICT:
          actions.push({
            type: "resolve_group_conflicts",
            priority: "high",
            affectedCount: typeViolations.length,
            description: "Resolve staff group conflicts",
            violations: typeViolations,
          });
          break;

        case VIOLATION_TYPES.PRIORITY_RULE_VIOLATION:
          actions.push({
            type: "apply_priority_rules",
            priority: "medium",
            affectedCount: typeViolations.length,
            description: "Apply staff priority rules",
            violations: typeViolations,
          });
          break;

        case VIOLATION_TYPES.INSUFFICIENT_COVERAGE:
          actions.push({
            type: "increase_coverage",
            priority: "critical",
            affectedCount: typeViolations.length,
            description: "Increase staff coverage for affected days",
            violations: typeViolations,
          });
          break;
      }
    });

    return actions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Export all constraints to JSON
   * @returns {Object} JSON representation of all constraints
   */
  exportToJSON() {
    const exported = {
      exportedAt: new Date().toISOString(),
      constraints: {},
      validationHistory: [...this.validationHistory],
    };

    Array.from(this.constraints.entries()).forEach(([id, constraint]) => {
      exported.constraints[id] = constraint.toJSON();
    });

    return exported;
  }

  /**
   * Import constraints from JSON
   * @param {Object} jsonData - JSON data to import
   */
  importFromJSON(jsonData) {
    this.constraints.clear();
    this.validationHistory = jsonData.validationHistory || [];

    Object.entries(jsonData.constraints || {}).forEach(
      ([id, constraintData]) => {
        let constraint;

        switch (constraintData.type) {
          case "monthly_limit":
            constraint = new MonthlyLimitConstraint(
              constraintData.name,
              constraintData.limitType,
              constraintData.maxValue,
              constraintData.minValue,
            );
            break;
          case "daily_limit":
            constraint = new DailyLimitConstraint(
              constraintData.name,
              constraintData.limitType,
              constraintData.maxValue,
              constraintData.minValue,
            );
            break;
          case "staff_group":
            constraint = new StaffGroupConstraint(
              constraintData.name,
              constraintData.groupMembers,
              constraintData.conflictType,
            );
            break;
          case "priority_rule":
            constraint = new PriorityRuleConstraint(
              constraintData.name,
              constraintData.staffName,
              constraintData.rule,
            );
            break;
          default:
            return;
        }

        // Apply common properties
        constraint.id = constraintData.id;
        constraint.priority = constraintData.priority;
        constraint.active = constraintData.active;
        constraint.description = constraintData.description;
        constraint.tags = constraintData.tags || [];
        constraint.createdAt = constraintData.createdAt;
        constraint.lastModified = constraintData.lastModified;

        this.constraints.set(id, constraint);
      },
    );
  }
}
