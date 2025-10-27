/**
 * BusinessRuleValidator.js
 *
 * Business rule validation system for schedule predictions.
 * Ensures predictions comply with labor laws, staffing requirements,
 * and restaurant operational constraints.
 */

import {
  validateAllConstraints,
  validateMonthlyOffLimits,
  validateDailyLimits,
  validateStaffGroupConflicts,
  validatePriorityRules,
  validateConsecutiveOffDays,
  validateCoverageCompensation,
  validateProximityPatterns,
  getViolationRecommendations,
  VIOLATION_TYPES,
  STAFF_CONFLICT_GROUPS,
  PRIORITY_RULES,
  DAILY_LIMITS,
  getMonthlyLimits,
  getDailyLimits,
  getPriorityRules,
  getStaffConflictGroups,
  initializeConstraintConfiguration,
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  isWeekday,
  getDayOfWeek,
} from "../constraints/ConstraintEngine";
import { ConfigurationService } from "../../services/ConfigurationService.js";

export class BusinessRuleValidator {
  constructor() {
    this.initialized = false;
    this.status = "idle";
    this.validationHistory = [];
    this.correctionStrategies = new Map();
    this.metrics = {
      validationsPerformed: 0,
      violationsFound: 0,
      correctionsApplied: 0,
      successRate: 0,
    };

    // Real-time settings provider (replaces ConfigurationService)
    this.settingsProvider = null;
    this.configService = null;
    this.restaurantId = null;
    this.configurationCache = new Map();
    this.lastConfigRefresh = 0;
    this.configRefreshInterval = 5 * 60 * 1000; // 5 minutes

    // Initialize correction strategies
    this.initializeCorrectionStrategies();
  }

  /**
   * Set settings provider for real-time configuration access
   * @param {Object} provider - Settings provider with getSettings() method
   */
  setSettingsProvider(provider) {
    if (!provider || typeof provider.getSettings !== "function") {
      throw new Error(
        "Invalid settings provider - must have getSettings() method",
      );
    }
    this.settingsProvider = provider;
    console.log("✅ BusinessRuleValidator: Settings provider configured");
  }

  /**
   * Initialize the business rule validator
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    try {
      this.options = {
        strictValidation: true,
        allowPartialCorrection: true,
        prioritizeStaffSatisfaction: true,
        prioritizeOperationalNeeds: true,
        maxCorrectionAttempts: 3,
        ...options,
      };

      // Set settings provider if provided
      if (options.settingsProvider) {
        this.setSettingsProvider(options.settingsProvider);
      }

      // Extract restaurant ID for configuration service (legacy fallback)
      this.restaurantId = options.restaurantId;

      // Initialize configuration service if restaurant ID provided (legacy path)
      if (this.restaurantId && !this.settingsProvider) {
        try {
          // Initialize constraint engine configuration
          this.configService = await initializeConstraintConfiguration(
            this.restaurantId,
          );

          if (!this.configService) {
            console.warn(
              "⚠️ Configuration service not available, using fallback static configuration",
            );
          } else {
            console.log(
              "✅ Configuration service integrated with BusinessRuleValidator",
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ Configuration service initialization failed, using static fallback:",
            error,
          );
          this.configService = null;
        }
      }

      // Load dynamic configurations (only if not using settings provider)
      if (!this.settingsProvider) {
        await this.refreshConfiguration();
      } else {
        console.log(
          "✅ Using real-time settings provider (skipping legacy config refresh)",
        );
      }

      this.initialized = true;
      this.status = "ready";
      console.log("✅ BusinessRuleValidator initialized");
    } catch (error) {
      this.status = "error";
      console.error("❌ BusinessRuleValidator initialization failed:", error);
      throw error;
    }
  }

  /**
   * Check if the validator is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && this.status === "ready";
  }

  /**
   * Get live settings from settings provider or fallback to cached configuration
   * @returns {Object} Live settings object
   */
  getLiveSettings() {
    if (this.settingsProvider) {
      try {
        const settings = this.settingsProvider.getSettings();
        return {
          staffGroups: settings.staffGroups || [],
          dailyLimits: settings.dailyLimits || DAILY_LIMITS,
          monthlyLimits: settings.monthlyLimits || {},
          priorityRules: settings.priorityRules || PRIORITY_RULES,
        };
      } catch (error) {
        console.warn(
          "⚠️ Failed to get live settings, using cached config:",
          error.message,
        );
      }
    }

    // Fallback to cached configuration (legacy path)
    return {
      staffGroups:
        this.configurationCache.get("staffGroups") || STAFF_CONFLICT_GROUPS,
      dailyLimits: this.configurationCache.get("dailyLimits") || DAILY_LIMITS,
      monthlyLimits: this.configurationCache.get("monthlyLimits") || {},
      priorityRules:
        this.configurationCache.get("priorityRules") || PRIORITY_RULES,
    };
  }

  /**
   * Refresh configuration from database
   */
  async refreshConfiguration() {
    try {
      if (!this.configService) {
        return; // Use static fallback
      }

      const now = Date.now();
      if (now - this.lastConfigRefresh < this.configRefreshInterval) {
        return; // Cache still valid
      }

      // Load configurations
      const [dailyLimits, monthlyLimits, priorityRules, staffGroups] =
        await Promise.all([
          getDailyLimits(),
          getMonthlyLimits(new Date().getFullYear(), new Date().getMonth() + 1),
          getPriorityRules(),
          getStaffConflictGroups(),
        ]);

      // Cache configurations
      this.configurationCache.set("dailyLimits", dailyLimits);
      this.configurationCache.set("monthlyLimits", monthlyLimits);
      this.configurationCache.set("priorityRules", priorityRules);
      this.configurationCache.set("staffGroups", staffGroups);

      this.lastConfigRefresh = now;
      console.log("🔄 BusinessRuleValidator configuration refreshed");
    } catch (error) {
      console.warn("⚠️ Configuration refresh failed:", error);
      // Continue using cached or static configuration
    }
  }

  /**
   * Initialize correction strategies for different violation types
   */
  initializeCorrectionStrategies() {
    // Monthly off limit corrections
    this.correctionStrategies.set(VIOLATION_TYPES.MONTHLY_OFF_LIMIT, {
      priority: "high",
      strategy: this.correctMonthlyOffLimit.bind(this),
      description: "Reduce excessive off days for staff member",
    });

    // Daily off limit corrections
    this.correctionStrategies.set(VIOLATION_TYPES.DAILY_OFF_LIMIT, {
      priority: "high",
      strategy: this.correctDailyOffLimit.bind(this),
      description: "Redistribute off days to ensure adequate coverage",
    });

    // Staff group conflict corrections
    this.correctionStrategies.set(VIOLATION_TYPES.STAFF_GROUP_CONFLICT, {
      priority: "high",
      strategy: this.correctStaffGroupConflict.bind(this),
      description: "Resolve conflicts between grouped staff members",
    });

    // Priority rule corrections
    this.correctionStrategies.set(VIOLATION_TYPES.PRIORITY_RULE_VIOLATION, {
      priority: "medium",
      strategy: this.correctPriorityRuleViolation.bind(this),
      description: "Apply staff priority preferences",
    });

    // Coverage compensation corrections
    this.correctionStrategies.set(
      VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION,
      {
        priority: "high",
        strategy: this.correctCoverageCompensation.bind(this),
        description: "Ensure backup staff coverage when primary staff is off",
      },
    );

    // Insufficient coverage corrections
    this.correctionStrategies.set(VIOLATION_TYPES.INSUFFICIENT_COVERAGE, {
      priority: "critical",
      strategy: this.correctInsufficientCoverage.bind(this),
      description: "Increase staffing to meet minimum requirements",
    });

    // Consecutive days off corrections
    this.correctionStrategies.set(VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF, {
      priority: "medium",
      strategy: this.correctConsecutiveDaysOff.bind(this),
      description: "Break up long consecutive off periods",
    });

    // Proximity pattern corrections
    this.correctionStrategies.set(VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION, {
      priority: "medium",
      strategy: this.correctProximityPattern.bind(this),
      description: "Adjust related staff off day patterns",
    });
  }

  /**
   * Validate a complete schedule against all business rules
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Validation result
   */
  async validateSchedule(schedule, staffMembers, dateRange) {
    if (!this.isReady()) {
      throw new Error("BusinessRuleValidator not initialized");
    }

    this.status = "validating";
    const startTime = Date.now();

    try {
      console.log("🔍 Validating schedule against business rules...");

      // Refresh configuration if needed
      await this.refreshConfiguration();

      // Perform comprehensive constraint validation
      const validationResult = await validateAllConstraints(
        schedule,
        staffMembers,
        dateRange,
      );

      // Additional business-specific validations
      const businessSpecificValidation =
        await this.performBusinessSpecificValidation(
          schedule,
          staffMembers,
          dateRange,
        );

      // Combine results
      const combinedResult = {
        valid: validationResult.valid && businessSpecificValidation.valid,
        violations: [
          ...(validationResult.violations || []),
          ...(businessSpecificValidation.violations || []),
        ],
        summary: {
          ...validationResult.summary,
          businessSpecific: businessSpecificValidation.summary,
          processingTime: Date.now() - startTime,
        },
      };

      // Update metrics
      this.updateValidationMetrics(combinedResult);

      // Add to history
      this.validationHistory.push({
        timestamp: new Date().toISOString(),
        valid: combinedResult.valid,
        violationCount: combinedResult.violations.length,
        processingTime: combinedResult.summary.processingTime,
      });

      this.status = "ready";
      console.log(
        `🎯 Validation completed: ${combinedResult.valid ? "VALID" : "VIOLATIONS"} (${combinedResult.summary.processingTime}ms)`,
      );

      return combinedResult;
    } catch (error) {
      this.status = "error";
      console.error("❌ Schedule validation failed:", error);
      throw error;
    }
  }

  /**
   * Perform business-specific validation beyond standard constraints
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Business-specific validation result
   */
  async performBusinessSpecificValidation(schedule, staffMembers, dateRange) {
    const violations = [];
    const metrics = {
      laborLawCompliance: true,
      operationalEfficiency: 0,
      staffSatisfaction: 0,
    };

    try {
      // Check labor law compliance (maximum consecutive work days)
      await this.validateLaborLawCompliance(
        schedule,
        staffMembers,
        dateRange,
        violations,
      );

      // Check operational efficiency
      metrics.operationalEfficiency = await this.calculateOperationalEfficiency(
        schedule,
        staffMembers,
        dateRange,
      );

      // Check staff satisfaction indicators
      metrics.staffSatisfaction = await this.calculateStaffSatisfaction(
        schedule,
        staffMembers,
        dateRange,
      );

      // Validate seasonal/holiday requirements
      await this.validateSeasonalRequirements(
        schedule,
        staffMembers,
        dateRange,
        violations,
      );

      return {
        valid: violations.length === 0,
        violations,
        summary: {
          metrics,
          checksPerformed: [
            "labor_law",
            "operational_efficiency",
            "staff_satisfaction",
            "seasonal_requirements",
          ],
        },
      };
    } catch (error) {
      return {
        valid: false,
        violations: [
          {
            type: "business_validation_error",
            message: `Business validation failed: ${error.message}`,
            severity: "critical",
          },
        ],
        summary: { error: error.message },
      };
    }
  }

  /**
   * Validate labor law compliance
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @param {Array} violations - Violations array to populate
   */
  async validateLaborLawCompliance(
    schedule,
    staffMembers,
    dateRange,
    violations,
  ) {
    const MAX_CONSECUTIVE_WORK_DAYS = 6; // Japanese labor standard

    staffMembers.forEach((staff) => {
      if (!schedule[staff.id]) return;

      let consecutiveWorkDays = 0;
      let maxConsecutive = 0;
      let currentStreak = [];

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id][dateKey];

        if (shift !== undefined && isWorkingShift(shift)) {
          consecutiveWorkDays++;
          currentStreak.push(dateKey);
          maxConsecutive = Math.max(maxConsecutive, consecutiveWorkDays);
        } else {
          if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
            violations.push({
              type: "labor_law_violation",
              staffName: staff.name,
              message: `${staff.name} has ${consecutiveWorkDays} consecutive work days, exceeding legal limit of ${MAX_CONSECUTIVE_WORK_DAYS}`,
              severity: "critical",
              details: {
                consecutiveDays: currentStreak.length,
                limit: MAX_CONSECUTIVE_WORK_DAYS,
                period: currentStreak,
              },
            });
          }
          consecutiveWorkDays = 0;
          currentStreak = [];
        }
      });

      // Check final streak
      if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
        violations.push({
          type: "labor_law_violation",
          staffName: staff.name,
          message: `${staff.name} has ${consecutiveWorkDays} consecutive work days at period end, exceeding legal limit`,
          severity: "critical",
          details: {
            consecutiveDays: currentStreak.length,
            limit: MAX_CONSECUTIVE_WORK_DAYS,
            period: currentStreak,
          },
        });
      }
    });
  }

  /**
   * Calculate operational efficiency score
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {number} Efficiency score (0-100)
   */
  async calculateOperationalEfficiency(schedule, staffMembers, dateRange) {
    let totalCoverage = 0;
    let optimalCoverage = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      let workingStaff = 0;
      let earlyShifts = 0;
      let lateShifts = 0;

      staffMembers.forEach((staff) => {
        if (schedule[staff.id] && schedule[staff.id][dateKey]) {
          const shift = schedule[staff.id][dateKey];
          if (isWorkingShift(shift)) {
            workingStaff++;
            if (isEarlyShift(shift)) earlyShifts++;
            if (isLateShift(shift)) lateShifts++;
          }
        }
      });

      // Define optimal staffing based on day of week
      const isWeekendDay = dayOfWeek === "saturday" || dayOfWeek === "sunday";
      const optimalStaff = isWeekendDay
        ? Math.ceil(staffMembers.length * 0.8)
        : Math.ceil(staffMembers.length * 0.9);

      totalCoverage += Math.min(workingStaff / optimalStaff, 1.0);
      optimalCoverage += 1.0;
    });

    return totalCoverage > 0 ? (totalCoverage / optimalCoverage) * 100 : 0;
  }

  /**
   * Calculate staff satisfaction score
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {number} Satisfaction score (0-100)
   */
  async calculateStaffSatisfaction(schedule, staffMembers, dateRange) {
    let totalSatisfaction = 0;
    let staffCount = 0;

    staffMembers.forEach((staff) => {
      if (!schedule[staff.id]) return;

      let staffSatisfaction = 100; // Start with perfect score
      let workDays = 0;
      let offDays = 0;
      let weekendWork = 0;
      let weekendOff = 0;

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id][dateKey];
        const dayOfWeek = getDayOfWeek(dateKey);
        const isWeekendDay = dayOfWeek === "saturday" || dayOfWeek === "sunday";

        if (shift !== undefined) {
          if (isWorkingShift(shift)) {
            workDays++;
            if (isWeekendDay) weekendWork++;
          } else if (isOffDay(shift)) {
            offDays++;
            if (isWeekendDay) weekendOff++;
          }
        }
      });

      // Adjust satisfaction based on work-life balance
      const workRatio = workDays / (workDays + offDays);
      if (workRatio > 0.85) staffSatisfaction -= 20; // Too much work
      if (workRatio < 0.6) staffSatisfaction -= 10; // Too little work

      // Weekend work balance
      const weekendWorkRatio = weekendWork / (weekendWork + weekendOff);
      if (weekendWorkRatio > 0.7) staffSatisfaction -= 15; // Too many weekends

      // Priority rule satisfaction
      const liveSettings = this.getLiveSettings();
      const priorityRules = liveSettings.priorityRules;
      if (priorityRules[staff.name] || priorityRules[staff.id]) {
        // Check if priority rules are followed (simplified check)
        staffSatisfaction += 10; // Bonus for having priority rules considered
      }

      totalSatisfaction += Math.max(0, Math.min(100, staffSatisfaction));
      staffCount++;
    });

    return staffCount > 0 ? totalSatisfaction / staffCount : 0;
  }

  /**
   * Validate seasonal and holiday requirements
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @param {Array} violations - Violations array to populate
   */
  async validateSeasonalRequirements(
    schedule,
    staffMembers,
    dateRange,
    violations,
  ) {
    // Check for holiday coverage (simplified - could be enhanced)
    dateRange.forEach((date) => {
      const dayOfWeek = getDayOfWeek(date.toISOString().split("T")[0]);

      // Weekend and holiday coverage requirements
      if (dayOfWeek === "saturday" || dayOfWeek === "sunday") {
        const dateKey = date.toISOString().split("T")[0];
        let workingStaff = 0;

        staffMembers.forEach((staff) => {
          if (
            schedule[staff.id] &&
            schedule[staff.id][dateKey] &&
            isWorkingShift(schedule[staff.id][dateKey])
          ) {
            workingStaff++;
          }
        });

        const minWeekendStaff = Math.ceil(staffMembers.length * 0.6);
        if (workingStaff < minWeekendStaff) {
          violations.push({
            type: "weekend_coverage_violation",
            date: dateKey,
            message: `Insufficient weekend coverage on ${dateKey}: ${workingStaff} staff, need at least ${minWeekendStaff}`,
            severity: "high",
            details: {
              workingStaff,
              requiredMinimum: minWeekendStaff,
              deficit: minWeekendStaff - workingStaff,
            },
          });
        }
      }
    });
  }

  /**
   * Correct a specific violation in the schedule
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation to correct
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctViolation(schedule, violation, staffMembers, dateRange) {
    const strategy = this.correctionStrategies.get(violation.type);

    if (!strategy) {
      console.warn(
        `⚠️ No correction strategy found for violation type: ${violation.type}`,
      );
      return schedule; // Return unchanged schedule
    }

    try {
      console.log(`🔧 Applying correction for ${violation.type}...`);
      const correctedSchedule = await strategy.strategy(
        schedule,
        violation,
        staffMembers,
        dateRange,
      );
      this.metrics.correctionsApplied++;
      return correctedSchedule;
    } catch (error) {
      console.error(`❌ Correction failed for ${violation.type}:`, error);
      return schedule; // Return unchanged schedule on error
    }
  }

  /**
   * Correct monthly off limit violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctMonthlyOffLimit(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const staffMember = staffMembers.find(
      (s) => s.name === violation.staffName,
    );

    if (!staffMember || !violation.details.offDays) {
      return correctedSchedule;
    }

    // Convert excess off days to working days
    const excessDays = violation.details.excess;
    const offDays = violation.details.offDays.slice(); // Copy array

    for (let i = 0; i < Math.min(excessDays, offDays.length); i++) {
      const dateKey = offDays[i];
      // Convert to normal working shift
      correctedSchedule[staffMember.id][dateKey] = "";
    }

    return correctedSchedule;
  }

  /**
   * Correct daily off limit violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctDailyOffLimit(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const dateKey = violation.date;
    const staffOff = violation.details.staffOff || [];
    const excess = violation.details.excess || 1;

    // Convert some off staff to working
    for (let i = 0; i < Math.min(excess, staffOff.length); i++) {
      const staffName = staffOff[i];
      const staffMember = staffMembers.find((s) => s.name === staffName);

      if (staffMember && correctedSchedule[staffMember.id]) {
        correctedSchedule[staffMember.id][dateKey] = ""; // Normal shift
      }
    }

    return correctedSchedule;
  }

  /**
   * Correct staff group conflict violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctStaffGroupConflict(
    schedule,
    violation,
    staffMembers,
    dateRange,
  ) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const dateKey = violation.date;
    const conflictingMembers = violation.details.conflictingMembers || [];

    // Change the first conflicting member to working shift
    if (conflictingMembers.length > 0) {
      const memberInfo = conflictingMembers[0].split(" (")[0]; // Extract name
      const staffMember = staffMembers.find((s) => s.name === memberInfo);

      if (staffMember && correctedSchedule[staffMember.id]) {
        correctedSchedule[staffMember.id][dateKey] = ""; // Normal shift
      }
    }

    return correctedSchedule;
  }

  /**
   * Correct priority rule violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctPriorityRuleViolation(
    schedule,
    violation,
    staffMembers,
    dateRange,
  ) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const staffMember = staffMembers.find(
      (s) => s.name === violation.staffName,
    );
    const dateKey = violation.date;

    if (!staffMember || !correctedSchedule[staffMember.id]) {
      return correctedSchedule;
    }

    // Apply the expected shift from the priority rule
    const rule = violation.details.rule;
    let targetShift = "";

    switch (rule.shift) {
      case "early":
        targetShift = "△";
        break;
      case "off":
        targetShift = "×";
        break;
      case "late":
        targetShift = "◇";
        break;
      default:
        targetShift = "";
    }

    correctedSchedule[staffMember.id][dateKey] = targetShift;
    return correctedSchedule;
  }

  /**
   * Correct coverage compensation violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctCoverageCompensation(
    schedule,
    violation,
    staffMembers,
    dateRange,
  ) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const backupStaffName = violation.details.backupStaff;
    const dateKey = violation.date;
    const backupStaff = staffMembers.find((s) => s.name === backupStaffName);

    if (backupStaff && correctedSchedule[backupStaff.id]) {
      // Set backup staff to normal shift
      correctedSchedule[backupStaff.id][dateKey] = "";
    }

    return correctedSchedule;
  }

  /**
   * Correct insufficient coverage violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctInsufficientCoverage(
    schedule,
    violation,
    staffMembers,
    dateRange,
  ) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const dateKey = violation.date;
    const deficit = violation.details.deficit || 1;

    // Find staff currently off and convert them to working
    let convertedCount = 0;
    for (const staff of staffMembers) {
      if (convertedCount >= deficit) break;

      if (
        correctedSchedule[staff.id] &&
        correctedSchedule[staff.id][dateKey] &&
        isOffDay(correctedSchedule[staff.id][dateKey])
      ) {
        correctedSchedule[staff.id][dateKey] = ""; // Normal shift
        convertedCount++;
      }
    }

    return correctedSchedule;
  }

  /**
   * Correct consecutive days off violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctConsecutiveDaysOff(
    schedule,
    violation,
    staffMembers,
    dateRange,
  ) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const staffMember = staffMembers.find(
      (s) => s.name === violation.staffName,
    );
    const consecutiveDays = violation.details.consecutiveDays || [];

    if (!staffMember || consecutiveDays.length === 0) {
      return correctedSchedule;
    }

    // Convert middle day of consecutive streak to working day
    const middleIndex = Math.floor(consecutiveDays.length / 2);
    const middleDate = consecutiveDays[middleIndex];

    if (correctedSchedule[staffMember.id]) {
      correctedSchedule[staffMember.id][middleDate] = ""; // Normal shift
    }

    return correctedSchedule;
  }

  /**
   * Correct proximity pattern violation
   * @param {Object} schedule - Current schedule
   * @param {Object} violation - Violation details
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async correctProximityPattern(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const targetStaffName = violation.details.targetStaff;
    const triggerDate = new Date(violation.details.triggerOffDay);
    const proximityRange = violation.details.proximityRange || 2;

    const targetStaff = staffMembers.find((s) => s.name === targetStaffName);
    if (!targetStaff || !correctedSchedule[targetStaff.id]) {
      return correctedSchedule;
    }

    // Find a suitable date within proximity range to set as off day
    for (let offset = 1; offset <= proximityRange; offset++) {
      const checkDate = new Date(triggerDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const checkDateKey = checkDate.toISOString().split("T")[0];

      if (
        correctedSchedule[targetStaff.id][checkDateKey] !== undefined &&
        !isOffDay(correctedSchedule[targetStaff.id][checkDateKey])
      ) {
        correctedSchedule[targetStaff.id][checkDateKey] = "×"; // Set as off day
        break;
      }
    }

    return correctedSchedule;
  }

  /**
   * Generate a rule-based schedule from scratch
   * @param {Object} inputData - Input data for schedule generation
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Generated rule-based schedule
   */
  async generateRuleBasedSchedule(inputData, staffMembers, dateRange) {
    try {
      console.log("🎯 Generating rule-based schedule...");

      // ✅ Defensive validation: Ensure parameters are valid
      if (!staffMembers || !Array.isArray(staffMembers)) {
        console.error("❌ generateRuleBasedSchedule: Invalid staffMembers parameter", {
          staffMembers,
          type: typeof staffMembers,
          isArray: Array.isArray(staffMembers)
        });
        throw new Error(
          `Invalid staffMembers parameter: expected array, got ${typeof staffMembers}`
        );
      }

      if (!dateRange || !Array.isArray(dateRange)) {
        console.error("❌ generateRuleBasedSchedule: Invalid dateRange parameter", {
          dateRange,
          type: typeof dateRange,
          isArray: Array.isArray(dateRange)
        });
        throw new Error(
          `Invalid dateRange parameter: expected array, got ${typeof dateRange}`
        );
      }

      console.log(`✅ Validation passed: ${staffMembers.length} staff, ${dateRange.length} dates`);

      // Initialize empty schedule
      const schedule = {};
      staffMembers.forEach((staff) => {
        schedule[staff.id] = {};
        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          schedule[staff.id][dateKey] = ""; // Start with normal shifts
        });
      });

      // Apply priority rules first
      await this.applyPriorityRules(schedule, staffMembers, dateRange);

      // Apply staff group constraints
      await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);

      // Distribute off days evenly
      await this.distributeOffDays(schedule, staffMembers, dateRange);

      // Apply coverage compensation rules
      await this.applyCoverageCompensation(schedule, staffMembers, dateRange);

      // Final validation and adjustments
      await this.applyFinalAdjustments(schedule, staffMembers, dateRange);

      console.log("✅ Rule-based schedule generated");
      return schedule;
    } catch (error) {
      console.error("❌ Rule-based schedule generation failed:", error);
      throw error;
    }
  }

  /**
   * Apply priority rules to schedule
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyPriorityRules(schedule, staffMembers, dateRange) {
    console.log("🎯 [PRIORITY] Applying priority rules...");

    // Get priority rules from live settings
    const liveSettings = this.getLiveSettings();
    let priorityRules = liveSettings.priorityRules;

    if (!priorityRules) {
      console.log("⚠️ [PRIORITY] No priority rules configured");
      return;
    }

    // TRANSFORMATION: Handle array format from UI
    if (Array.isArray(priorityRules)) {
      console.log(
        `🎯 [PRIORITY] Received array format with ${priorityRules.length} rule(s)`,
      );

      if (priorityRules.length === 0) {
        console.log("⚠️ [PRIORITY] Empty priority rules array");
        return;
      }

      // Transform to object format
      priorityRules = this.transformPriorityRulesArrayToObject(
        priorityRules,
        staffMembers,
      );
    }

    // Check if we have any rules after transformation
    const ruleCount = Object.keys(priorityRules || {}).length;
    if (ruleCount === 0) {
      console.log("⚠️ [PRIORITY] No valid priority rules after transformation");
      return;
    }

    console.log(`🎯 [PRIORITY] Processing ${ruleCount} staff with priority rules`);

    let totalRulesApplied = 0;

    Object.keys(priorityRules).forEach((staffIdentifier) => {
      // Find staff by name or ID with multiple matching strategies
      const staff = staffMembers.find(
        (s) => s.id === staffIdentifier || s.name === staffIdentifier,
      );

      if (!staff) {
        console.log(
          `⚠️ [PRIORITY] Staff not found for identifier: "${staffIdentifier}"`,
        );
        console.log(
          `📋 [PRIORITY] Available staff: ${staffMembers.map((s) => `${s.name} (ID: ${s.id})`).join(", ")}`,
        );
        return;
      }

      if (!schedule[staff.id]) {
        console.log(
          `⚠️ [PRIORITY] No schedule entry for staff: ${staff.name} (ID: ${staff.id})`,
        );
        return;
      }

      const rules = priorityRules[staffIdentifier];
      const preferredShifts = rules.preferredShifts || [];

      if (preferredShifts.length === 0) {
        console.log(
          `⚠️ [PRIORITY] ${staff.name}: No preferredShifts defined`,
        );
        return;
      }

      console.log(
        `🎯 [PRIORITY] ${staff.name}: Processing ${preferredShifts.length} preferred shift(s)`,
      );

      let staffRulesApplied = 0;

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const dayOfWeek = getDayOfWeek(dateKey);

        preferredShifts.forEach((rule) => {
          if (rule.day === dayOfWeek) {
            let shiftValue = "";

            switch (rule.shift) {
              case "early":
                shiftValue = "△";
                break;
              case "off":
                shiftValue = "×";
                break;
              case "late":
                shiftValue = "◇";
                break;
              default:
                shiftValue = "";
            }

            schedule[staff.id][dateKey] = shiftValue;
            staffRulesApplied++;
            console.log(
              `🎯 [PRIORITY]   → ${staff.name}: Set "${shiftValue}" on ${date.toLocaleDateString('ja-JP')} (${dayOfWeek})`,
            );
          }
        });
      });

      console.log(
        `🎯 [PRIORITY] ${staff.name}: Applied ${staffRulesApplied} rule(s)`,
      );
      totalRulesApplied += staffRulesApplied;
    });

    console.log(
      `✅ [PRIORITY] Total ${totalRulesApplied} priority rule(s) applied`,
    );
  }

  /**
   * Transform priority rules from array format (UI) to object format (AI)
   * @param {Array} rulesArray - Priority rules in array format
   * @param {Array} staffMembers - Staff member data for validation
   * @returns {Object} Priority rules in object format keyed by staff identifier
   */
  transformPriorityRulesArrayToObject(rulesArray, staffMembers) {
    console.log(
      `🔄 [PRIORITY-TRANSFORM] Converting ${rulesArray.length} array rules to object format`,
    );
    console.log(`🔍 [DEBUG] Input rulesArray:`, JSON.stringify(rulesArray, null, 2));

    const rulesObject = {};
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    rulesArray.forEach((rule, index) => {
      // Extract staffId from multiple possible locations (defensive extraction)
      const staffId =
        rule.staffId ||
        rule.staff_id ||
        rule.ruleDefinition?.staff_id ||  // ← JSONB nested structure (safety net)
        rule.ruleDefinition?.staffId ||
        rule.ruleConfig?.staffId ||
        rule.preferences?.staffId;  // ← Alternative nested location

      if (!staffId) {
        console.log(
          `⚠️ [PRIORITY-TRANSFORM] Rule ${index}: Missing staffId (checked all locations), skipping`,
        );
        console.log(`   Raw rule:`, JSON.stringify(rule, null, 2).substring(0, 200));
        return;
      }

      console.log(`🔍 [DEBUG] Rule ${index}: staffId="${staffId}"`);

      // Find staff to validate and get both ID and name
      const staff = staffMembers.find(
        (s) => s.id === staffId || s.name === staffId,
      );

      if (!staff) {
        console.log(
          `⚠️ [PRIORITY-TRANSFORM] Rule ${index}: Staff not found for staffId "${staffId}"`,
        );
        return;
      }

      // Use staff ID as the primary key (fall back to name if no ID)
      const staffKey = staff.id || staff.name;

      // Initialize staff entry if not exists
      if (!rulesObject[staffKey]) {
        rulesObject[staffKey] = { preferredShifts: [] };
      }

      // Convert daysOfWeek array to individual preferred shifts (defensive extraction)
      const daysOfWeek =
        rule.daysOfWeek ||
        rule.days_of_week ||
        rule.ruleDefinition?.conditions?.day_of_week ||  // ← JSONB nested structure
        rule.ruleDefinition?.daysOfWeek ||
        rule.preferences?.daysOfWeek ||
        [];

      // Extract shiftType (defensive extraction)
      const shiftType =
        rule.shiftType ||
        rule.shift_type ||
        rule.ruleDefinition?.conditions?.shift_type ||  // ← JSONB nested structure
        rule.ruleDefinition?.shiftType ||
        rule.preferences?.shiftType ||
        rule.ruleType;

      console.log(`🔍 [DEBUG] Rule ${index} for ${staff.name}:`);
      console.log(`   daysOfWeek:`, daysOfWeek);
      console.log(`   shiftType:`, shiftType);
      console.log(`   priorityLevel:`, rule.priorityLevel || rule.priority_level);

      if (daysOfWeek.length === 0) {
        console.log(
          `⚠️ [PRIORITY-TRANSFORM] Rule ${index} for ${staff.name}: No daysOfWeek specified`,
        );
        return;
      }

      daysOfWeek.forEach((dayNum) => {
        const preferredShift = {
          day: dayNames[dayNum] || dayNum,
          shift: shiftType,
          priority: rule.priorityLevel || rule.priority_level || 3,
        };

        rulesObject[staffKey].preferredShifts.push(preferredShift);

        console.log(
          `🔄 [PRIORITY-TRANSFORM]   → ${staff.name}: dayNum=${dayNum} → ${dayNames[dayNum]} = ${shiftType}`,
        );
      });
    });

    const transformedCount = Object.keys(rulesObject).length;
    console.log(
      `✅ [PRIORITY-TRANSFORM] Transformed to ${transformedCount} staff with rules`,
    );
    console.log(`🔍 [DEBUG] Final rulesObject:`, JSON.stringify(rulesObject, null, 2));

    return rulesObject;
  }

  /**
   * Apply staff group constraints
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyStaffGroupConstraints(schedule, staffMembers, dateRange) {
    console.log("🔧 [AI] Applying staff group constraints...");
    console.log(`📊 [AI] Input - Schedule keys: ${Object.keys(schedule).length}, Staff: ${staffMembers.length}, Dates: ${dateRange.length}`);

    // Get staff groups from live settings
    const liveSettings = this.getLiveSettings();
    if (!liveSettings || !liveSettings.staffGroups || liveSettings.staffGroups.length === 0) {
      console.log("⚠️ [AI] No staff groups configured, skipping constraint application");
      return;
    }

    const staffGroups = liveSettings.staffGroups;
    console.log(`📋 [AI] Processing ${staffGroups.length} staff group(s)`);
    console.log(`📋 [AI] Staff groups:`, staffGroups.map(g => ({ name: g.name, members: g.members })));

    // For each date in the range
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // For each staff group
      staffGroups.forEach((group) => {
        const groupMembers = group.members || [];
        if (groupMembers.length === 0) return;

        // Find members in this group and their shift status
        const membersWithShifts = [];

        groupMembers.forEach((memberId) => {
          // Try to find staff by ID first, then by name (backward compatibility)
          let staff = staffMembers.find(s => s.id === memberId);
          if (!staff) {
            staff = staffMembers.find(s => s.name === memberId);
          }

          if (!staff) {
            console.log(`  ⚠️ [AI] ${dateKey}: Group "${group.name}" - Member "${memberId}" not found in staffMembers`);
            console.log(`  📋 [AI] Available staff IDs:`, staffMembers.map(s => s.id));
            console.log(`  📋 [AI] Available staff names:`, staffMembers.map(s => s.name));
            return;
          }

          if (!schedule[staff.id]) {
            console.log(`  ⚠️ [AI] ${dateKey}: Staff "${staff.name}" (ID: ${staff.id}) has no schedule entry`);
            return;
          }

          const shift = schedule[staff.id][dateKey];
          membersWithShifts.push({
            staffId: staff.id,
            staffName: staff.name,
            shift: shift,
            isOffOrEarly: shift !== undefined && (isOffDay(shift) || isEarlyShift(shift))
          });
        });

        // Count members with off/early shifts
        const offOrEarlyMembers = membersWithShifts.filter(m => m.isOffOrEarly);

        // ✅ CRITICAL FIX: If more than 1 member has off/early shift, enforce opposite pattern
        if (offOrEarlyMembers.length > 1) {
          console.log(
            `⚠️ [AI] ${dateKey}: Group "${group.name}" has ${offOrEarlyMembers.length} members with off/early shifts - fixing conflict`
          );

          // Strategy: Keep the first member's shift, change the rest to working (○ or empty)
          // This ensures opposite patterns: if one is off (×), others must work (○)
          offOrEarlyMembers.slice(1).forEach((member) => {
            const previousShift = schedule[member.staffId][dateKey];

            // Change to working shift (normal shift = empty string or ○)
            schedule[member.staffId][dateKey] = "○"; // Normal working shift

            console.log(
              `  ✏️ [AI] Changed ${member.staffName}: "${previousShift}" → "○" (working shift)`
            );
          });

          console.log(
            `  ✅ [AI] Group "${group.name}" conflict resolved: 1 member off/early, ${offOrEarlyMembers.length - 1} changed to working`
          );
        } else if (offOrEarlyMembers.length === 1) {
          console.log(
            `  ✓ [AI] ${dateKey}: Group "${group.name}" OK - 1 member off/early, others working`
          );
        }
      });
    });

    console.log("✅ [AI] Staff group constraints applied successfully");
  }

  /**
   * Distribute off days evenly among staff
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async distributeOffDays(schedule, staffMembers, dateRange) {
    console.log("📅 [RULE-GEN] Distributing off days...");

    // Use live settings
    const liveSettings = this.getLiveSettings();
    const monthLimits =
      liveSettings.monthlyLimits ||
      (await getMonthlyLimits(
        dateRange[0].getFullYear(),
        dateRange[0].getMonth() + 1,
      ));

    const dailyLimits = liveSettings.dailyLimits;

    console.log(
      `📅 [RULE-GEN] monthLimits type: ${Array.isArray(monthLimits) ? 'array' : typeof monthLimits}`,
    );
    console.log(
      `📅 [RULE-GEN] dailyLimits type: ${Array.isArray(dailyLimits) ? 'array' : typeof dailyLimits}`,
    );

    // Extract actual limit values with safe defaults
    // Handle both old format (object) and new format (array)
    let maxOffPerMonth, maxOffPerDay;

    if (Array.isArray(monthLimits)) {
      // New format: array of limit objects with maxCount property
      const offDayLimit = monthLimits.find(
        (l) =>
          l.limitType === "max_off_days" ||
          l.name?.toLowerCase().includes("off"),
      );
      maxOffPerMonth = offDayLimit?.maxCount || 10;
      console.log(
        `📅 [RULE-GEN] Found monthly limit (array):`,
        offDayLimit,
      );
    } else if (monthLimits && typeof monthLimits === "object") {
      // Old format: object with maxOffDaysPerMonth property
      maxOffPerMonth = monthLimits.maxOffDaysPerMonth || 10;
      console.log(
        `📅 [RULE-GEN] Using monthly limit (object): ${maxOffPerMonth}`,
      );
    } else {
      maxOffPerMonth = 10; // Fallback default
      console.log(`📅 [RULE-GEN] Using default monthly limit: 10`);
    }

    if (Array.isArray(dailyLimits)) {
      // New format: array of limit objects with maxCount property
      const offDayLimit = dailyLimits.find(
        (l) =>
          l.shiftType === "off" ||
          l.name?.toLowerCase().includes("off"),
      );
      maxOffPerDay = offDayLimit?.maxCount || 4;
      console.log(
        `📅 [RULE-GEN] Found daily limit (array):`,
        offDayLimit,
      );
    } else if (dailyLimits && typeof dailyLimits === "object") {
      // Old format: object with maxOffPerDay property
      maxOffPerDay = dailyLimits.maxOffPerDay || 4;
      console.log(
        `📅 [RULE-GEN] Using daily limit (object): ${maxOffPerDay}`,
      );
    } else {
      maxOffPerDay = 4; // Fallback default
      console.log(`📅 [RULE-GEN] Using default daily limit: 4`);
    }

    console.log(
      `📅 [RULE-GEN] Final limits: maxOffPerMonth=${maxOffPerMonth}, maxOffPerDay=${maxOffPerDay}`,
    );

    // ✅ PHASE 1: Randomized distribution to prevent clustering
    // Track global off-day distribution across all staff
    const globalOffDayCount = {};
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      globalOffDayCount[dateKey] = 0;
    });

    staffMembers.forEach((staff) => {
      if (!schedule[staff.id]) return;

      let offDaysSet = 0;
      const targetOffDays = Math.min(maxOffPerMonth - 1, 6); // Conservative target

      console.log(
        `📅 [RULE-GEN] ${staff.name}: Target ${targetOffDays} off days`,
      );

      // Build list of available days for this staff (not already set by priority rules)
      const availableDays = [];
      dateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split("T")[0];
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

        if (schedule[staff.id][dateKey] === "") {
          // Not already set by priority rules
          availableDays.push({
            dateKey,
            date,
            index,
            dayOfWeek,
            // Prefer weekends for off days (higher score = better candidate)
            score: dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1,
          });
        }
      });

      // ✅ FIX 1: Shuffle dates within score groups to break deterministic ordering
      const weekendDays = availableDays.filter(d => d.score === 2);
      const weekdayDays = availableDays.filter(d => d.score === 1);

      // Fisher-Yates shuffle
      const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };

      const shuffledDays = [...shuffle(weekendDays), ...shuffle(weekdayDays)];

      // ✅ FIX 2: Per-staff random offset to avoid all staff starting at same position
      const interval = Math.floor(shuffledDays.length / targetOffDays);
      const randomOffset = Math.floor(Math.random() * Math.min(interval, shuffledDays.length));
      let nextOffDayIndex = randomOffset;

      console.log(
        `📅 [RULE-GEN]   Starting at index ${randomOffset} (interval: ${interval})`,
      );

      while (offDaysSet < targetOffDays && shuffledDays.length > 0) {
        // ✅ FIX 3: Stochastic selection with probability-based approach
        // Try to find best candidate considering global distribution
        let bestCandidate = null;
        let bestScore = -Infinity;

        // Check next few candidates (lookahead window)
        const lookAheadWindow = Math.min(5, shuffledDays.length);
        for (let i = 0; i < lookAheadWindow; i++) {
          const candIdx = (nextOffDayIndex + i) % shuffledDays.length;
          const candidate = shuffledDays[candIdx];

          if (!candidate) continue;

          // Count current off days on this date (including already set)
          let currentOffCount = globalOffDayCount[candidate.dateKey] || 0;

          // ✅ FIX 4: Score based on global distribution to spread off-days
          // Lower off count = better score (prefer dates with fewer offs)
          const distributionScore = maxOffPerDay - currentOffCount;
          const weekendBonus = candidate.score === 2 ? 1.5 : 1.0;
          const totalScore = distributionScore * weekendBonus;

          if (totalScore > bestScore && currentOffCount < maxOffPerDay) {
            bestScore = totalScore;
            bestCandidate = { ...candidate, arrayIndex: candIdx };
          }
        }

        if (bestCandidate) {
          // Assign off day
          schedule[staff.id][bestCandidate.dateKey] = "×";
          globalOffDayCount[bestCandidate.dateKey]++;
          offDaysSet++;

          console.log(
            `📅 [RULE-GEN]   → ${staff.name}: Set off day on ${bestCandidate.date.toLocaleDateString('ja-JP')} ` +
            `(${['日', '月', '火', '水', '木', '金', '土'][bestCandidate.dayOfWeek]}) ` +
            `[Global: ${globalOffDayCount[bestCandidate.dateKey]}/${maxOffPerDay}]`,
          );

          // Remove used day and advance with random jitter
          shuffledDays.splice(bestCandidate.arrayIndex, 1);
          const jitter = Math.floor(Math.random() * 2); // 0 or 1
          nextOffDayIndex = (bestCandidate.arrayIndex + interval + jitter) % Math.max(shuffledDays.length, 1);
        } else {
          // No valid candidate found, try next position
          nextOffDayIndex = (nextOffDayIndex + 1) % Math.max(shuffledDays.length, 1);

          // Safety: If we've checked all days and still can't find a slot, break
          if (shuffledDays.every(d => globalOffDayCount[d.dateKey] >= maxOffPerDay)) {
            console.log(
              `📅 [RULE-GEN]   ⚠ ${staff.name}: All remaining days at capacity, stopping at ${offDaysSet} off days`,
            );
            break;
          }
        }
      }

      console.log(
        `📅 [RULE-GEN] ${staff.name}: Set ${offDaysSet}/${targetOffDays} off days`,
      );
    });

    console.log("✅ [RULE-GEN] Off days distributed");
  }

  /**
   * Apply coverage compensation rules
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyCoverageCompensation(schedule, staffMembers, dateRange) {
    // Get staff groups from live settings
    const liveSettings = this.getLiveSettings();
    const staffGroups = liveSettings.staffGroups;

    // Apply Group 2 coverage compensation rule
    const group2 = staffGroups.find((g) => g.name === "Group 2");
    if (!group2 || !group2.coverageRule) return;

    const backupStaff = staffMembers.find(
      (s) => s.name === group2.coverageRule.backupStaff,
    );
    if (!backupStaff) return;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Check if any Group 2 member is off
      let group2MemberOff = false;
      const members = group2.members || [];
      members.forEach((memberName) => {
        const staff = staffMembers.find((s) => s.name === memberName);
        if (staff && schedule[staff.id][dateKey] === "×") {
          group2MemberOff = true;
        }
      });

      // If Group 2 member is off, ensure backup staff works normal shift
      if (group2MemberOff && schedule[backupStaff.id]) {
        schedule[backupStaff.id][dateKey] = ""; // Normal shift
      }
    });
  }

  /**
   * Apply final adjustments to ensure schedule validity
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyFinalAdjustments(schedule, staffMembers, dateRange) {
    console.log("🔧 [FINAL] Applying final adjustments...");

    // Use live settings
    const liveSettings = this.getLiveSettings();
    const dailyLimits = liveSettings.dailyLimits;

    // Ensure minimum coverage each day
    let coverageAdjustments = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      let workingStaff = 0;
      staffMembers.forEach((staff) => {
        if (schedule[staff.id][dateKey] !== "×") {
          workingStaff++;
        }
      });

      // If insufficient coverage, convert some off days to working days
      const minWorkingStaffPerDay = dailyLimits.minWorkingStaffPerDay || 3;
      if (workingStaff < minWorkingStaffPerDay) {
        const deficit = minWorkingStaffPerDay - workingStaff;
        let converted = 0;

        for (const staff of staffMembers) {
          if (converted >= deficit) break;

          if (schedule[staff.id][dateKey] === "×") {
            schedule[staff.id][dateKey] = ""; // Convert to normal shift (empty)
            converted++;
            coverageAdjustments++;
            console.log(
              `🔧 [FINAL]   → ${staff.name}: Converted off day to normal shift on ${dateKey}`,
            );
          }
        }
      }
    });

    console.log(
      `🔧 [FINAL] Coverage adjustments: ${coverageAdjustments} off days converted`,
    );

    // Note: Empty cells ("") represent normal working days
    // Do NOT fill with ○ - empty is the correct representation
    console.log(
      `✅ [FINAL] Final adjustments complete (empty cells = normal working days)`,
    );
  }

  /**
   * Update validation metrics
   * @param {Object} result - Validation result
   */
  updateValidationMetrics(result) {
    this.metrics.validationsPerformed++;
    this.metrics.violationsFound += result.violations.length;

    if (result.valid) {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.validationsPerformed - 1) +
          100) /
        this.metrics.validationsPerformed;
    } else {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.validationsPerformed - 1)) /
        this.metrics.validationsPerformed;
    }
  }

  /**
   * Get current status and metrics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      status: this.status,
      ready: this.isReady(),
      metrics: { ...this.metrics },
      correctionStrategies: Array.from(this.correctionStrategies.keys()),
      validationHistory: this.validationHistory.slice(-10), // Last 10 validations
    };
  }

  /**
   * Reset the validator
   */
  async reset() {
    this.validationHistory = [];
    this.metrics = {
      validationsPerformed: 0,
      violationsFound: 0,
      correctionsApplied: 0,
      successRate: 0,
    };
    // Reset enhanced features
    this.performanceMetrics = {
      validationSpeed: 0,
      cacheHitRate: 0,
      averageComplexity: 0,
    };

    this.validationCache.clear();
    this.lastEfficiencyBreakdown = null;
    this.lastSatisfactionBreakdown = null;

    this.status = "idle";
    console.log(
      "🔄 BusinessRuleValidator reset completed with enhanced cleanup",
    );
  }

  // ============================================================================
  // ENHANCED HELPER METHODS FOR COMPREHENSIVE VALIDATION
  // ============================================================================

  /**
   * Estimate shift end time for rest hour calculation
   * @param {string} shift - Shift symbol
   * @returns {number} End hour (24-hour format)
   */
  estimateShiftEndTime(shift) {
    const shiftTimes = {
      "△": 15, // Early shift: 6:00-15:00
      "○": 22, // Normal shift: 10:00-22:00
      "▽": 24, // Late shift: 18:00-24:00
      "": 22, // Default normal hours
    };
    return shiftTimes[shift] || 22;
  }

  /**
   * Estimate shift start time for rest hour calculation
   * @param {string} shift - Shift symbol
   * @returns {number} Start hour (24-hour format)
   */
  estimateShiftStartTime(shift) {
    const shiftTimes = {
      "△": 6, // Early shift: 6:00-15:00
      "○": 10, // Normal shift: 10:00-22:00
      "▽": 18, // Late shift: 18:00-24:00
      "": 10, // Default normal hours
    };
    return shiftTimes[shift] || 10;
  }

  /**
   * Group dates by week for weekly pattern analysis
   * @param {Array} dateRange - Date range
   * @returns {Array} Array of weekly date groups
   */
  groupDatesByWeek(dateRange) {
    const weeks = [];
    let currentWeek = [];
    let currentWeekStart = null;

    dateRange.forEach((date) => {
      const dayOfWeek = date.getDay();

      // Start new week on Monday (or first date)
      if (
        currentWeekStart === null ||
        (dayOfWeek === 1 && currentWeek.length > 0)
      ) {
        if (currentWeek.length > 0) {
          weeks.push([...currentWeek]);
        }
        currentWeek = [date];
        currentWeekStart = date;
      } else {
        currentWeek.push(date);
      }
    });

    // Add final week
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  /**
   * Check if date is a holiday (simplified implementation)
   * @param {Date} date - Date to check
   * @returns {boolean} Is holiday
   */
  isHoliday(date) {
    // This is a simplified implementation
    // In a real system, this would check against a holiday calendar
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Japanese national holidays (simplified)
    const holidays = [
      "1-1", // New Year's Day
      "2-11", // National Foundation Day
      "4-29", // Showa Day
      "5-3", // Constitution Memorial Day
      "5-4", // Greenery Day
      "5-5", // Children's Day
      "8-11", // Mountain Day
      "11-3", // Culture Day
      "11-23", // Labor Thanksgiving Day
      "12-23", // Emperor's Birthday
    ];

    return holidays.includes(`${month}-${day}`);
  }

  /**
   * Count peak days (weekends and holidays) in date range
   * @param {Array} dateRange - Date range
   * @returns {number} Number of peak days
   */
  countPeakDays(dateRange) {
    return dateRange.filter((date) => {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = this.isHoliday(date);
      return isWeekend || isHoliday;
    }).length;
  }

  /**
   * Calculate schedule flexibility score
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {number} Flexibility score (0-100)
   */
  calculateFlexibilityScore(schedule, staffMembers, dateRange) {
    let flexibilityScore = 0;
    const shiftTypes = ["△", "○", "▽", "", "×"];

    staffMembers.forEach((staff) => {
      if (!schedule[staff.id]) return;

      const staffShifts = Object.values(schedule[staff.id]);
      const uniqueShifts = new Set(staffShifts.filter((s) => s !== undefined));

      // Higher score for staff with variety in shift types
      flexibilityScore += (uniqueShifts.size / shiftTypes.length) * 100;
    });

    return staffMembers.length > 0 ? flexibilityScore / staffMembers.length : 0;
  }

  /**
   * Analyze staff work patterns for satisfaction calculation
   * @param {Object} staffSchedule - Individual staff schedule
   * @param {Object} staff - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Work pattern analysis
   */
  analyzeStaffWorkPatterns(staffSchedule, staff, dateRange) {
    const patterns = {
      workDays: 0,
      offDays: 0,
      weekendWork: 0,
      totalWeekends: 0,
      consecutiveWorkStreaks: [],
      consecutiveOffStreaks: [],
      shiftVariety: {},
      peakDayWork: 0,
      totalPeakDays: 0,
    };

    let currentWorkStreak = 0;
    let currentOffStreak = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPeakDay = isWeekend || this.isHoliday(date);

      if (isWeekend) patterns.totalWeekends++;
      if (isPeakDay) patterns.totalPeakDays++;

      if (shift !== undefined && isWorkingShift(shift)) {
        patterns.workDays++;
        if (isWeekend) patterns.weekendWork++;
        if (isPeakDay) patterns.peakDayWork++;

        patterns.shiftVariety[shift] = (patterns.shiftVariety[shift] || 0) + 1;

        currentWorkStreak++;
        if (currentOffStreak > 0) {
          patterns.consecutiveOffStreaks.push(currentOffStreak);
          currentOffStreak = 0;
        }
      } else if (shift !== undefined && isOffDay(shift)) {
        patterns.offDays++;
        currentOffStreak++;
        if (currentWorkStreak > 0) {
          patterns.consecutiveWorkStreaks.push(currentWorkStreak);
          currentWorkStreak = 0;
        }
      } else {
        // Empty cell - handle based on staff type
        if (staff.status === "社員") {
          // For regular staff, empty usually means work
          patterns.workDays++;
          currentWorkStreak++;
        } else {
          // For part-time, empty might mean unavailable
          patterns.offDays++;
          currentOffStreak++;
        }
      }
    });

    // Add final streaks
    if (currentWorkStreak > 0)
      patterns.consecutiveWorkStreaks.push(currentWorkStreak);
    if (currentOffStreak > 0)
      patterns.consecutiveOffStreaks.push(currentOffStreak);

    return patterns;
  }

  /**
   * Calculate schedule consistency score
   * @param {Object} workPatterns - Work pattern analysis
   * @returns {number} Consistency score (0-100)
   */
  calculateScheduleConsistency(workPatterns) {
    // Look for consistent patterns vs erratic scheduling
    const workStreaks = workPatterns.consecutiveWorkStreaks;
    const offStreaks = workPatterns.consecutiveOffStreaks;

    if (workStreaks.length === 0) return 50; // No work pattern to analyze

    // Calculate variance in work streaks (lower variance = more consistent)
    const avgWorkStreak =
      workStreaks.reduce((a, b) => a + b, 0) / workStreaks.length;
    const workVariance =
      workStreaks.reduce(
        (sum, streak) => sum + Math.pow(streak - avgWorkStreak, 2),
        0,
      ) / workStreaks.length;

    // Calculate variance in off streaks
    let offVariance = 0;
    if (offStreaks.length > 0) {
      const avgOffStreak =
        offStreaks.reduce((a, b) => a + b, 0) / offStreaks.length;
      offVariance =
        offStreaks.reduce(
          (sum, streak) => sum + Math.pow(streak - avgOffStreak, 2),
          0,
        ) / offStreaks.length;
    }

    // Lower variance = higher consistency score
    const consistencyScore = Math.max(
      0,
      100 - Math.sqrt(workVariance + offVariance) * 10,
    );
    return Math.min(100, consistencyScore);
  }

  /**
   * Calculate preference compliance for staff with priority rules
   * @param {Object} staffSchedule - Individual staff schedule
   * @param {Object} staff - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {number} Compliance score (0-1)
   */
  async calculatePreferenceCompliance(staffSchedule, staff, dateRange) {
    const liveSettings = this.getLiveSettings();
    const priorityRules = liveSettings.priorityRules;
    const rules = priorityRules[staff.name] || priorityRules[staff.id];
    if (!rules || !rules.preferredShifts) return 0.8; // Default good score if no rules

    let totalPreferences = 0;
    let matchedPreferences = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const actualShift = staffSchedule[dateKey];
      const dayOfWeek = getDayOfWeek(dateKey);

      // Find matching preference rules for this day
      const dayPreferences = rules.preferredShifts.filter(
        (pref) => pref.day === dayOfWeek,
      );

      dayPreferences.forEach((pref) => {
        totalPreferences++;

        let expectedShift = "";
        switch (pref.shift) {
          case "early":
            expectedShift = "△";
            break;
          case "off":
            expectedShift = "×";
            break;
          case "late":
            expectedShift = "▽";
            break;
          default:
            expectedShift = "";
        }

        if (
          actualShift === expectedShift ||
          (pref.shift === "normal" &&
            (actualShift === "" || actualShift === "○"))
        ) {
          matchedPreferences++;
        }
      });
    });

    return totalPreferences > 0 ? matchedPreferences / totalPreferences : 0.8;
  }

  /**
   * Assess quality of consecutive days off
   * @param {Object} workPatterns - Work pattern analysis
   * @returns {number} Quality score (0-100)
   */
  assessConsecutiveDaysOffQuality(workPatterns) {
    const offStreaks = workPatterns.consecutiveOffStreaks;

    if (offStreaks.length === 0) return 50; // No consecutive off days

    // Ideal consecutive off days: 2-3 days
    let qualityScore = 0;
    offStreaks.forEach((streak) => {
      if (streak === 2 || streak === 3) {
        qualityScore += 100; // Perfect
      } else if (streak === 1 || streak === 4) {
        qualityScore += 70; // Good
      } else if (streak >= 5) {
        qualityScore += 40; // Too long (might indicate scheduling issues)
      } else {
        qualityScore += 30; // Very short streaks
      }
    });

    return qualityScore / offStreaks.length;
  }

  /**
   * Calculate fairness perception compared to other staff
   * @param {Object} staff - Current staff member
   * @param {Object} workPatterns - Current staff work patterns
   * @param {Object} schedule - Full schedule
   * @param {Array} staffMembers - All staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fairness score (0-100)
   */
  async calculateFairnessPerception(
    staff,
    workPatterns,
    schedule,
    staffMembers,
    dateRange,
  ) {
    // Compare work distribution with similar staff (same type)
    const similarStaff = staffMembers.filter(
      (s) => s.status === staff.status && s.id !== staff.id,
    );

    if (similarStaff.length === 0) return 90; // No comparison possible, assume fair

    const currentWorkRatio =
      workPatterns.workDays / (workPatterns.workDays + workPatterns.offDays);
    const currentWeekendRatio =
      workPatterns.weekendWork / Math.max(workPatterns.totalWeekends, 1);

    let workRatioSum = 0;
    let weekendRatioSum = 0;
    let validComparisons = 0;

    similarStaff.forEach((otherStaff) => {
      if (!schedule[otherStaff.id]) return;

      const otherPatterns = this.analyzeStaffWorkPatterns(
        schedule[otherStaff.id],
        otherStaff,
        dateRange,
      );
      const otherWorkRatio =
        otherPatterns.workDays /
        (otherPatterns.workDays + otherPatterns.offDays);
      const otherWeekendRatio =
        otherPatterns.weekendWork / Math.max(otherPatterns.totalWeekends, 1);

      workRatioSum += otherWorkRatio;
      weekendRatioSum += otherWeekendRatio;
      validComparisons++;
    });

    if (validComparisons === 0) return 90;

    const avgWorkRatio = workRatioSum / validComparisons;
    const avgWeekendRatio = weekendRatioSum / validComparisons;

    // Calculate fairness based on how close current staff is to average
    const workRatioFairness = Math.max(
      0,
      100 - Math.abs(currentWorkRatio - avgWorkRatio) * 200,
    );
    const weekendRatioFairness = Math.max(
      0,
      100 - Math.abs(currentWeekendRatio - avgWeekendRatio) * 150,
    );

    return workRatioFairness * 0.6 + weekendRatioFairness * 0.4;
  }

  /**
   * Assess flexibility accommodation for staff
   * @param {Object} workPatterns - Work pattern analysis
   * @param {Object} staff - Staff member data
   * @returns {number} Flexibility score (0-100)
   */
  assessFlexibilityAccommodation(workPatterns, staff) {
    // For part-time staff, flexibility is more important
    const baseScore = staff.status === "パート" ? 85 : 90;

    // Variety in shift types indicates good flexibility
    const shiftVariety = Object.keys(workPatterns.shiftVariety).length;
    const varietyBonus = Math.min(15, shiftVariety * 3);

    // Reasonable consecutive work streaks indicate good balance
    const maxWorkStreak = Math.max(...workPatterns.consecutiveWorkStreaks, 0);
    const streakPenalty = Math.max(0, (maxWorkStreak - 5) * 2); // Penalty for very long streaks

    return Math.max(0, Math.min(100, baseScore + varietyBonus - streakPenalty));
  }

  // ============================================================================
  // ENHANCED PRODUCTION-READY FEATURES
  // ============================================================================

  /**
   * Enhanced staff satisfaction calculation with detailed breakdown
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Promise<Object>} Enhanced satisfaction analysis
   */
  async calculateEnhancedStaffSatisfaction(schedule, staffMembers, dateRange) {
    try {
      const satisfactionBreakdown = {
        overall: 0,
        byStaff: {},
        factors: {
          workLifeBalance: 0,
          fairness: 0,
          preferences: 0,
          flexibility: 0,
          consecutiveDaysOff: 0,
        },
        recommendations: [],
      };

      let totalSatisfaction = 0;
      let validStaffCount = 0;

      for (const staff of staffMembers) {
        if (!schedule[staff.id]) continue;

        const staffPatterns = this.analyzeStaffWorkPatterns(
          schedule[staff.id],
          staff,
          dateRange,
        );
        const staffAnalysis = {
          workLifeBalance: this.calculateWorkLifeBalance(staffPatterns),
          fairness: await this.calculateFairnessPerception(
            staff,
            staffPatterns,
            schedule,
            staffMembers,
            dateRange,
          ),
          preferences: await this.calculatePreferenceCompliance(
            schedule[staff.id],
            staff,
            dateRange,
          ),
          flexibility: this.assessFlexibilityAccommodation(
            staffPatterns,
            staff,
          ),
          consecutiveDaysOff:
            this.assessConsecutiveDaysOffQuality(staffPatterns),
        };

        // Calculate staff overall satisfaction
        const staffSatisfaction =
          staffAnalysis.workLifeBalance * 0.3 +
          staffAnalysis.fairness * 0.25 +
          staffAnalysis.preferences * 100 * 0.2 +
          staffAnalysis.flexibility * 0.15 +
          staffAnalysis.consecutiveDaysOff * 0.1;

        satisfactionBreakdown.byStaff[staff.name] = {
          overall: Math.min(100, Math.max(0, staffSatisfaction)),
          ...staffAnalysis,
        };

        totalSatisfaction += staffSatisfaction;
        validStaffCount++;

        // Generate recommendations for low satisfaction
        if (staffSatisfaction < 60) {
          satisfactionBreakdown.recommendations.push({
            staff: staff.name,
            issue: "Low satisfaction score",
            suggestions:
              this.generateSatisfactionRecommendations(staffAnalysis),
          });
        }
      }

      // Calculate overall metrics
      satisfactionBreakdown.overall =
        validStaffCount > 0 ? totalSatisfaction / validStaffCount : 0;

      // Calculate factor averages
      Object.keys(satisfactionBreakdown.factors).forEach((factor) => {
        const factorSum = Object.values(satisfactionBreakdown.byStaff).reduce(
          (sum, staff) => sum + (staff[factor] || 0),
          0,
        );
        satisfactionBreakdown.factors[factor] =
          validStaffCount > 0 ? factorSum / validStaffCount : 0;
      });

      this.lastSatisfactionBreakdown = satisfactionBreakdown;
      return satisfactionBreakdown;
    } catch (error) {
      console.error("❌ Enhanced satisfaction calculation failed:", error);
      return {
        overall: 0,
        byStaff: {},
        factors: {},
        recommendations: [],
        error: error.message,
      };
    }
  }

  /**
   * Calculate work-life balance score
   * @param {Object} workPatterns - Work pattern analysis
   * @returns {number} Work-life balance score (0-100)
   */
  calculateWorkLifeBalance(workPatterns) {
    const workRatio =
      workPatterns.workDays / (workPatterns.workDays + workPatterns.offDays);
    const weekendRatio =
      workPatterns.weekendWork / Math.max(workPatterns.totalWeekends, 1);

    // Ideal work ratio: 70-80%
    let workBalanceScore = 100;
    if (workRatio > 0.8) workBalanceScore -= (workRatio - 0.8) * 200;
    if (workRatio < 0.6) workBalanceScore -= (0.6 - workRatio) * 150;

    // Weekend work penalty
    if (weekendRatio > 0.7) workBalanceScore -= (weekendRatio - 0.7) * 100;

    return Math.max(0, Math.min(100, workBalanceScore));
  }

  /**
   * Generate satisfaction improvement recommendations
   * @param {Object} staffAnalysis - Staff analysis data
   * @returns {Array} Recommendations
   */
  generateSatisfactionRecommendations(staffAnalysis) {
    const recommendations = [];

    if (staffAnalysis.workLifeBalance < 60) {
      recommendations.push(
        "Improve work-life balance by reducing excessive work hours",
      );
    }

    if (staffAnalysis.fairness < 70) {
      recommendations.push(
        "Review shift distribution for fairness compared to peers",
      );
    }

    if (staffAnalysis.preferences < 0.6) {
      recommendations.push(
        "Better accommodate staff preferred shifts and days",
      );
    }

    if (staffAnalysis.flexibility < 70) {
      recommendations.push("Increase schedule flexibility and variety");
    }

    if (staffAnalysis.consecutiveDaysOff < 60) {
      recommendations.push("Improve consecutive days off patterns");
    }

    return recommendations.length > 0
      ? recommendations
      : ["Schedule appears optimal for this staff member"];
  }

  /**
   * Enhanced operational efficiency calculation with detailed metrics
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Promise<Object>} Enhanced efficiency analysis
   */
  async calculateEnhancedOperationalEfficiency(
    schedule,
    staffMembers,
    dateRange,
  ) {
    try {
      const efficiencyBreakdown = {
        overall: 0,
        coverage: 0,
        utilization: 0,
        flexibility: 0,
        costEfficiency: 0,
        dailyBreakdown: {},
        recommendations: [],
      };

      let totalCoverage = 0;
      let totalUtilization = 0;
      let flexibilitySum = 0;
      let costEfficiencySum = 0;

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const dayAnalysis = this.analyzeDailyEfficiency(
          schedule,
          staffMembers,
          date,
        );

        efficiencyBreakdown.dailyBreakdown[dateKey] = dayAnalysis;

        totalCoverage += dayAnalysis.coverage;
        totalUtilization += dayAnalysis.utilization;
        flexibilitySum += dayAnalysis.flexibility;
        costEfficiencySum += dayAnalysis.costEfficiency;

        // Generate daily recommendations
        if (dayAnalysis.coverage < 70) {
          efficiencyBreakdown.recommendations.push({
            date: dateKey,
            issue: "Insufficient coverage",
            suggestion: `Increase staffing on ${dateKey}`,
          });
        }
      });

      const dayCount = dateRange.length;
      efficiencyBreakdown.coverage =
        dayCount > 0 ? totalCoverage / dayCount : 0;
      efficiencyBreakdown.utilization =
        dayCount > 0 ? totalUtilization / dayCount : 0;
      efficiencyBreakdown.flexibility =
        dayCount > 0 ? flexibilitySum / dayCount : 0;
      efficiencyBreakdown.costEfficiency =
        dayCount > 0 ? costEfficiencySum / dayCount : 0;

      // Calculate overall efficiency score
      efficiencyBreakdown.overall =
        efficiencyBreakdown.coverage * 0.4 +
        efficiencyBreakdown.utilization * 0.3 +
        efficiencyBreakdown.flexibility * 0.2 +
        efficiencyBreakdown.costEfficiency * 0.1;

      this.lastEfficiencyBreakdown = efficiencyBreakdown;
      return efficiencyBreakdown;
    } catch (error) {
      console.error("❌ Enhanced efficiency calculation failed:", error);
      return {
        overall: 0,
        coverage: 0,
        utilization: 0,
        flexibility: 0,
        costEfficiency: 0,
        dailyBreakdown: {},
        recommendations: [],
        error: error.message,
      };
    }
  }

  /**
   * Analyze daily operational efficiency
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Date} date - Date to analyze
   * @returns {Object} Daily efficiency metrics
   */
  analyzeDailyEfficiency(schedule, staffMembers, date) {
    const dateKey = date.toISOString().split("T")[0];
    const dayOfWeek = getDayOfWeek(dateKey);
    const isWeekend = dayOfWeek === "saturday" || dayOfWeek === "sunday";

    let workingStaff = 0;
    let regularStaff = 0;
    let partTimeStaff = 0;
    let earlyShifts = 0;
    let lateShifts = 0;
    let normalShifts = 0;

    staffMembers.forEach((staff) => {
      if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
        const shift = schedule[staff.id][dateKey];

        if (isWorkingShift(shift)) {
          workingStaff++;

          if (staff.status === "社員") {
            regularStaff++;
          } else {
            partTimeStaff++;
          }

          if (isEarlyShift(shift)) earlyShifts++;
          else if (isLateShift(shift)) lateShifts++;
          else normalShifts++;
        }
      }
    });

    // Calculate metrics
    const optimalStaff = isWeekend
      ? Math.ceil(staffMembers.length * 0.75)
      : Math.ceil(staffMembers.length * 0.85);
    const coverage = Math.min(100, (workingStaff / optimalStaff) * 100);
    const utilization = (workingStaff / staffMembers.length) * 100;

    // Flexibility based on shift variety
    const shiftTypes = [earlyShifts, normalShifts, lateShifts].filter(
      (count) => count > 0,
    ).length;
    const flexibility = Math.min(100, (shiftTypes / 3) * 100);

    // Cost efficiency (prefer part-time for non-peak days)
    const partTimeRatio = workingStaff > 0 ? partTimeStaff / workingStaff : 0;
    const idealPartTimeRatio = isWeekend ? 0.6 : 0.4;
    const costEfficiency =
      100 - Math.abs(partTimeRatio - idealPartTimeRatio) * 100;

    return {
      coverage: Math.max(0, coverage),
      utilization: Math.max(0, utilization),
      flexibility: Math.max(0, flexibility),
      costEfficiency: Math.max(0, costEfficiency),
      details: {
        workingStaff,
        regularStaff,
        partTimeStaff,
        shiftDistribution: {
          early: earlyShifts,
          normal: normalShifts,
          late: lateShifts,
        },
        isWeekend,
      },
    };
  }

  /**
   * Calculate cost efficiency of the schedule
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {number} Cost efficiency score (0-100)
   */
  calculateCostEfficiency(schedule, staffMembers, dateRange) {
    try {
      let totalCost = 0;
      let optimalCost = 0;

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const dayOfWeek = getDayOfWeek(dateKey);
        const isWeekend = dayOfWeek === "saturday" || dayOfWeek === "sunday";

        let regularStaffWorking = 0;
        let partTimeStaffWorking = 0;

        staffMembers.forEach((staff) => {
          if (
            schedule[staff.id] &&
            schedule[staff.id][dateKey] &&
            isWorkingShift(schedule[staff.id][dateKey])
          ) {
            if (staff.status === "社員") {
              regularStaffWorking++;
            } else {
              partTimeStaffWorking++;
            }
          }
        });

        // Assume regular staff cost 1.5x part-time, weekends 1.2x multiplier
        const weekendMultiplier = isWeekend ? 1.2 : 1.0;
        const dayCost =
          (regularStaffWorking * 1.5 + partTimeStaffWorking * 1.0) *
          weekendMultiplier;
        totalCost += dayCost;

        // Calculate optimal cost (prefer part-time on weekdays, balanced on weekends)
        const totalWorking = regularStaffWorking + partTimeStaffWorking;
        const optimalPartTimeRatio = isWeekend ? 0.5 : 0.6;
        const optimalPartTime = Math.round(totalWorking * optimalPartTimeRatio);
        const optimalRegular = totalWorking - optimalPartTime;
        const optimalDayCost =
          (optimalRegular * 1.5 + optimalPartTime * 1.0) * weekendMultiplier;
        optimalCost += optimalDayCost;
      });

      if (optimalCost === 0) return 100;

      const efficiency = Math.max(
        0,
        Math.min(100, (optimalCost / totalCost) * 100),
      );
      return efficiency;
    } catch (error) {
      console.warn("⚠️ Cost efficiency calculation failed:", error.message);
      return 75; // Default reasonable score
    }
  }
}
