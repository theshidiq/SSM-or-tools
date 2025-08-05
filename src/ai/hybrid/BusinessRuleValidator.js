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
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  isWeekday,
  getDayOfWeek
} from '../constraints/ConstraintEngine';

export class BusinessRuleValidator {
  constructor() {
    this.initialized = false;
    this.status = 'idle';
    this.validationHistory = [];
    this.correctionStrategies = new Map();
    this.metrics = {
      validationsPerformed: 0,
      violationsFound: 0,
      correctionsApplied: 0,
      successRate: 0
    };
    
    // Initialize correction strategies
    this.initializeCorrectionStrategies();
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
        ...options
      };

      this.initialized = true;
      this.status = 'ready';
      console.log('✅ BusinessRuleValidator initialized');

    } catch (error) {
      this.status = 'error';
      console.error('❌ BusinessRuleValidator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if the validator is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && this.status === 'ready';
  }

  /**
   * Initialize correction strategies for different violation types
   */
  initializeCorrectionStrategies() {
    // Monthly off limit corrections
    this.correctionStrategies.set(VIOLATION_TYPES.MONTHLY_OFF_LIMIT, {
      priority: 'high',
      strategy: this.correctMonthlyOffLimit.bind(this),
      description: 'Reduce excessive off days for staff member'
    });

    // Daily off limit corrections
    this.correctionStrategies.set(VIOLATION_TYPES.DAILY_OFF_LIMIT, {
      priority: 'high',
      strategy: this.correctDailyOffLimit.bind(this),
      description: 'Redistribute off days to ensure adequate coverage'
    });

    // Staff group conflict corrections
    this.correctionStrategies.set(VIOLATION_TYPES.STAFF_GROUP_CONFLICT, {
      priority: 'high',
      strategy: this.correctStaffGroupConflict.bind(this),
      description: 'Resolve conflicts between grouped staff members'
    });

    // Priority rule corrections
    this.correctionStrategies.set(VIOLATION_TYPES.PRIORITY_RULE_VIOLATION, {
      priority: 'medium',
      strategy: this.correctPriorityRuleViolation.bind(this),
      description: 'Apply staff priority preferences'
    });

    // Coverage compensation corrections
    this.correctionStrategies.set(VIOLATION_TYPES.COVERAGE_COMPENSATION_VIOLATION, {
      priority: 'high',
      strategy: this.correctCoverageCompensation.bind(this),
      description: 'Ensure backup staff coverage when primary staff is off'
    });

    // Insufficient coverage corrections
    this.correctionStrategies.set(VIOLATION_TYPES.INSUFFICIENT_COVERAGE, {
      priority: 'critical',
      strategy: this.correctInsufficientCoverage.bind(this),
      description: 'Increase staffing to meet minimum requirements'
    });

    // Consecutive days off corrections
    this.correctionStrategies.set(VIOLATION_TYPES.CONSECUTIVE_DAYS_OFF, {
      priority: 'medium',
      strategy: this.correctConsecutiveDaysOff.bind(this),
      description: 'Break up long consecutive off periods'
    });

    // Proximity pattern corrections
    this.correctionStrategies.set(VIOLATION_TYPES.PROXIMITY_PATTERN_VIOLATION, {
      priority: 'medium',
      strategy: this.correctProximityPattern.bind(this),
      description: 'Adjust related staff off day patterns'
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
      throw new Error('BusinessRuleValidator not initialized');
    }

    this.status = 'validating';
    const startTime = Date.now();

    try {
      console.log('🔍 Validating schedule against business rules...');

      // Perform comprehensive constraint validation
      const validationResult = validateAllConstraints(schedule, staffMembers, dateRange);

      // Additional business-specific validations
      const businessSpecificValidation = await this.performBusinessSpecificValidation(
        schedule, 
        staffMembers, 
        dateRange
      );

      // Combine results
      const combinedResult = {
        valid: validationResult.valid && businessSpecificValidation.valid,
        violations: [
          ...(validationResult.violations || []),
          ...(businessSpecificValidation.violations || [])
        ],
        summary: {
          ...validationResult.summary,
          businessSpecific: businessSpecificValidation.summary,
          processingTime: Date.now() - startTime
        }
      };

      // Update metrics
      this.updateValidationMetrics(combinedResult);

      // Add to history
      this.validationHistory.push({
        timestamp: new Date().toISOString(),
        valid: combinedResult.valid,
        violationCount: combinedResult.violations.length,
        processingTime: combinedResult.summary.processingTime
      });

      this.status = 'ready';
      console.log(`🎯 Validation completed: ${combinedResult.valid ? 'VALID' : 'VIOLATIONS'} (${combinedResult.summary.processingTime}ms)`);

      return combinedResult;

    } catch (error) {
      this.status = 'error';
      console.error('❌ Schedule validation failed:', error);
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
      staffSatisfaction: 0
    };

    try {
      // Check labor law compliance (maximum consecutive work days)
      await this.validateLaborLawCompliance(schedule, staffMembers, dateRange, violations);

      // Check operational efficiency
      metrics.operationalEfficiency = await this.calculateOperationalEfficiency(schedule, staffMembers, dateRange);

      // Check staff satisfaction indicators
      metrics.staffSatisfaction = await this.calculateStaffSatisfaction(schedule, staffMembers, dateRange);

      // Validate seasonal/holiday requirements
      await this.validateSeasonalRequirements(schedule, staffMembers, dateRange, violations);

      return {
        valid: violations.length === 0,
        violations,
        summary: {
          metrics,
          checksPerformed: ['labor_law', 'operational_efficiency', 'staff_satisfaction', 'seasonal_requirements']
        }
      };

    } catch (error) {
      return {
        valid: false,
        violations: [{
          type: 'business_validation_error',
          message: `Business validation failed: ${error.message}`,
          severity: 'critical'
        }],
        summary: { error: error.message }
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
  async validateLaborLawCompliance(schedule, staffMembers, dateRange, violations) {
    const MAX_CONSECUTIVE_WORK_DAYS = 6; // Japanese labor standard

    staffMembers.forEach(staff => {
      if (!schedule[staff.id]) return;

      let consecutiveWorkDays = 0;
      let maxConsecutive = 0;
      let currentStreak = [];

      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id][dateKey];

        if (shift !== undefined && isWorkingShift(shift)) {
          consecutiveWorkDays++;
          currentStreak.push(dateKey);
          maxConsecutive = Math.max(maxConsecutive, consecutiveWorkDays);
        } else {
          if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
            violations.push({
              type: 'labor_law_violation',
              staffName: staff.name,
              message: `${staff.name} has ${consecutiveWorkDays} consecutive work days, exceeding legal limit of ${MAX_CONSECUTIVE_WORK_DAYS}`,
              severity: 'critical',
              details: {
                consecutiveDays: currentStreak.length,
                limit: MAX_CONSECUTIVE_WORK_DAYS,
                period: currentStreak
              }
            });
          }
          consecutiveWorkDays = 0;
          currentStreak = [];
        }
      });

      // Check final streak
      if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
        violations.push({
          type: 'labor_law_violation',
          staffName: staff.name,
          message: `${staff.name} has ${consecutiveWorkDays} consecutive work days at period end, exceeding legal limit`,
          severity: 'critical',
          details: {
            consecutiveDays: currentStreak.length,
            limit: MAX_CONSECUTIVE_WORK_DAYS,
            period: currentStreak
          }
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

    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = getDayOfWeek(dateKey);
      
      let workingStaff = 0;
      let earlyShifts = 0;
      let lateShifts = 0;

      staffMembers.forEach(staff => {
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
      const isWeekendDay = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';
      const optimalStaff = isWeekendDay ? Math.ceil(staffMembers.length * 0.8) : Math.ceil(staffMembers.length * 0.9);
      
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

    staffMembers.forEach(staff => {
      if (!schedule[staff.id]) return;

      let staffSatisfaction = 100; // Start with perfect score
      let workDays = 0;
      let offDays = 0;
      let weekendWork = 0;
      let weekendOff = 0;

      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id][dateKey];
        const dayOfWeek = getDayOfWeek(dateKey);
        const isWeekendDay = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';

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
      if (workRatio < 0.60) staffSatisfaction -= 10; // Too little work

      // Weekend work balance
      const weekendWorkRatio = weekendWork / (weekendWork + weekendOff);
      if (weekendWorkRatio > 0.70) staffSatisfaction -= 15; // Too many weekends
      
      // Priority rule satisfaction
      if (PRIORITY_RULES[staff.name]) {
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
  async validateSeasonalRequirements(schedule, staffMembers, dateRange, violations) {
    // Check for holiday coverage (simplified - could be enhanced)
    dateRange.forEach(date => {
      const dayOfWeek = getDayOfWeek(date.toISOString().split('T')[0]);
      
      // Weekend and holiday coverage requirements
      if (dayOfWeek === 'saturday' || dayOfWeek === 'sunday') {
        const dateKey = date.toISOString().split('T')[0];
        let workingStaff = 0;

        staffMembers.forEach(staff => {
          if (schedule[staff.id] && schedule[staff.id][dateKey] && 
              isWorkingShift(schedule[staff.id][dateKey])) {
            workingStaff++;
          }
        });

        const minWeekendStaff = Math.ceil(staffMembers.length * 0.6);
        if (workingStaff < minWeekendStaff) {
          violations.push({
            type: 'weekend_coverage_violation',
            date: dateKey,
            message: `Insufficient weekend coverage on ${dateKey}: ${workingStaff} staff, need at least ${minWeekendStaff}`,
            severity: 'high',
            details: {
              workingStaff,
              requiredMinimum: minWeekendStaff,
              deficit: minWeekendStaff - workingStaff
            }
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
      console.warn(`⚠️ No correction strategy found for violation type: ${violation.type}`);
      return schedule; // Return unchanged schedule
    }

    try {
      console.log(`🔧 Applying correction for ${violation.type}...`);
      const correctedSchedule = await strategy.strategy(schedule, violation, staffMembers, dateRange);
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
    const staffMember = staffMembers.find(s => s.name === violation.staffName);
    
    if (!staffMember || !violation.details.offDays) {
      return correctedSchedule;
    }

    // Convert excess off days to working days
    const excessDays = violation.details.excess;
    const offDays = violation.details.offDays.slice(); // Copy array
    
    for (let i = 0; i < Math.min(excessDays, offDays.length); i++) {
      const dateKey = offDays[i];
      // Convert to normal working shift
      correctedSchedule[staffMember.id][dateKey] = '';
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
      const staffMember = staffMembers.find(s => s.name === staffName);
      
      if (staffMember && correctedSchedule[staffMember.id]) {
        correctedSchedule[staffMember.id][dateKey] = ''; // Normal shift
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
  async correctStaffGroupConflict(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const dateKey = violation.date;
    const conflictingMembers = violation.details.conflictingMembers || [];

    // Change the first conflicting member to working shift
    if (conflictingMembers.length > 0) {
      const memberInfo = conflictingMembers[0].split(' (')[0]; // Extract name
      const staffMember = staffMembers.find(s => s.name === memberInfo);
      
      if (staffMember && correctedSchedule[staffMember.id]) {
        correctedSchedule[staffMember.id][dateKey] = ''; // Normal shift
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
  async correctPriorityRuleViolation(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const staffMember = staffMembers.find(s => s.name === violation.staffName);
    const dateKey = violation.date;

    if (!staffMember || !correctedSchedule[staffMember.id]) {
      return correctedSchedule;
    }

    // Apply the expected shift from the priority rule
    const rule = violation.details.rule;
    let targetShift = '';

    switch (rule.shift) {
      case 'early':
        targetShift = '△';
        break;
      case 'off':
        targetShift = '×';
        break;
      case 'late':
        targetShift = '◇';
        break;
      default:
        targetShift = '';
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
  async correctCoverageCompensation(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const backupStaffName = violation.details.backupStaff;
    const dateKey = violation.date;
    const backupStaff = staffMembers.find(s => s.name === backupStaffName);

    if (backupStaff && correctedSchedule[backupStaff.id]) {
      // Set backup staff to normal shift
      correctedSchedule[backupStaff.id][dateKey] = '';
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
  async correctInsufficientCoverage(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const dateKey = violation.date;
    const deficit = violation.details.deficit || 1;

    // Find staff currently off and convert them to working
    let convertedCount = 0;
    for (const staff of staffMembers) {
      if (convertedCount >= deficit) break;
      
      if (correctedSchedule[staff.id] && correctedSchedule[staff.id][dateKey] && 
          isOffDay(correctedSchedule[staff.id][dateKey])) {
        correctedSchedule[staff.id][dateKey] = ''; // Normal shift
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
  async correctConsecutiveDaysOff(schedule, violation, staffMembers, dateRange) {
    const correctedSchedule = JSON.parse(JSON.stringify(schedule));
    const staffMember = staffMembers.find(s => s.name === violation.staffName);
    const consecutiveDays = violation.details.consecutiveDays || [];

    if (!staffMember || consecutiveDays.length === 0) {
      return correctedSchedule;
    }

    // Convert middle day of consecutive streak to working day
    const middleIndex = Math.floor(consecutiveDays.length / 2);
    const middleDate = consecutiveDays[middleIndex];
    
    if (correctedSchedule[staffMember.id]) {
      correctedSchedule[staffMember.id][middleDate] = ''; // Normal shift
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
    
    const targetStaff = staffMembers.find(s => s.name === targetStaffName);
    if (!targetStaff || !correctedSchedule[targetStaff.id]) {
      return correctedSchedule;
    }

    // Find a suitable date within proximity range to set as off day
    for (let offset = 1; offset <= proximityRange; offset++) {
      const checkDate = new Date(triggerDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const checkDateKey = checkDate.toISOString().split('T')[0];

      if (correctedSchedule[targetStaff.id][checkDateKey] !== undefined &&
          !isOffDay(correctedSchedule[targetStaff.id][checkDateKey])) {
        correctedSchedule[targetStaff.id][checkDateKey] = '×'; // Set as off day
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
      console.log('🎯 Generating rule-based schedule...');
      
      // Initialize empty schedule
      const schedule = {};
      staffMembers.forEach(staff => {
        schedule[staff.id] = {};
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          schedule[staff.id][dateKey] = ''; // Start with normal shifts
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

      console.log('✅ Rule-based schedule generated');
      return schedule;

    } catch (error) {
      console.error('❌ Rule-based schedule generation failed:', error);
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
    Object.keys(PRIORITY_RULES).forEach(staffName => {
      const staff = staffMembers.find(s => s.name === staffName);
      if (!staff || !schedule[staff.id]) return;

      const rules = PRIORITY_RULES[staffName];
      
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeek(dateKey);
        
        rules.preferredShifts.forEach(rule => {
          if (rule.day === dayOfWeek) {
            let shiftValue = '';
            
            switch (rule.shift) {
              case 'early':
                shiftValue = '△';
                break;
              case 'off':
                shiftValue = '×';
                break;
              case 'late':
                shiftValue = '◇';
                break;
              default:
                shiftValue = '';
            }
            
            schedule[staff.id][dateKey] = shiftValue;
          }
        });
      });
    });
  }

  /**
   * Apply staff group constraints
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyStaffGroupConstraints(schedule, staffMembers, dateRange) {
    // This is a simplified implementation
    // In a full implementation, this would check all group constraints
    // and make adjustments to prevent conflicts
    console.log('🔧 Applying staff group constraints...');
  }

  /**
   * Distribute off days evenly among staff
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async distributeOffDays(schedule, staffMembers, dateRange) {
    const monthLimits = getMonthlyLimits(
      dateRange[0].getFullYear(),
      dateRange[0].getMonth() + 1
    );

    staffMembers.forEach(staff => {
      if (!schedule[staff.id]) return;

      let offDaysSet = 0;
      const targetOffDays = Math.min(monthLimits.maxOffDaysPerMonth - 1, 6); // Conservative target

      // Set off days, avoiding violations
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        
        if (offDaysSet < targetOffDays && 
            schedule[staff.id][dateKey] === '' && // Not already set by priority rules
            Math.random() < 0.25) { // 25% chance for each available day
          
          // Check if setting this as off day would violate daily limits
          let currentOffCount = 0;
          staffMembers.forEach(otherStaff => {
            if (schedule[otherStaff.id][dateKey] === '×') {
              currentOffCount++;
            }
          });

          if (currentOffCount < DAILY_LIMITS.maxOffPerDay) {
            schedule[staff.id][dateKey] = '×';
            offDaysSet++;
          }
        }
      });
    });
  }

  /**
   * Apply coverage compensation rules
   * @param {Object} schedule - Schedule to modify
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   */
  async applyCoverageCompensation(schedule, staffMembers, dateRange) {
    // Apply Group 2 coverage compensation rule
    const group2 = STAFF_CONFLICT_GROUPS.find(g => g.name === 'Group 2');
    if (!group2 || !group2.coverageRule) return;

    const backupStaff = staffMembers.find(s => s.name === group2.coverageRule.backupStaff);
    if (!backupStaff) return;

    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      
      // Check if any Group 2 member is off
      let group2MemberOff = false;
      group2.members.forEach(memberName => {
        const staff = staffMembers.find(s => s.name === memberName);
        if (staff && schedule[staff.id][dateKey] === '×') {
          group2MemberOff = true;
        }
      });

      // If Group 2 member is off, ensure backup staff works normal shift
      if (group2MemberOff && schedule[backupStaff.id]) {
        schedule[backupStaff.id][dateKey] = ''; // Normal shift
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
    // Ensure minimum coverage each day
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      
      let workingStaff = 0;
      staffMembers.forEach(staff => {
        if (schedule[staff.id][dateKey] !== '×') {
          workingStaff++;
        }
      });

      // If insufficient coverage, convert some off days to working days
      if (workingStaff < DAILY_LIMITS.minWorkingStaffPerDay) {
        const deficit = DAILY_LIMITS.minWorkingStaffPerDay - workingStaff;
        let converted = 0;
        
        for (const staff of staffMembers) {
          if (converted >= deficit) break;
          
          if (schedule[staff.id][dateKey] === '×') {
            schedule[staff.id][dateKey] = ''; // Convert to normal shift
            converted++;
          }
        }
      }
    });
  }

  /**
   * Update validation metrics
   * @param {Object} result - Validation result
   */
  updateValidationMetrics(result) {
    this.metrics.validationsPerformed++;
    this.metrics.violationsFound += result.violations.length;
    
    if (result.valid) {
      this.metrics.successRate = (
        (this.metrics.successRate * (this.metrics.validationsPerformed - 1) + 100) / 
        this.metrics.validationsPerformed
      );
    } else {
      this.metrics.successRate = (
        (this.metrics.successRate * (this.metrics.validationsPerformed - 1)) / 
        this.metrics.validationsPerformed
      );
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
      validationHistory: this.validationHistory.slice(-10) // Last 10 validations
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
      successRate: 0
    };
    this.status = 'idle';
    console.log('🔄 BusinessRuleValidator reset completed');
  }
}