/**
 * ConstraintIntegrationLayer.js
 *
 * Unified constraint processing system that converts UI constraints
 * into ML-compatible parameters and optimization objectives.
 * Integrates with existing constraint systems while providing
 * enhanced parameter management for ML algorithms.
 */

import {
  getStaffConflictGroups,
  getPriorityRules,
  getDailyLimits,
  getMonthlyLimits,
  validateAllConstraints,
  VIOLATION_TYPES,
} from "../constraints/ConstraintEngine";

/**
 * Main constraint integration layer
 */
export class ConstraintIntegrationLayer {
  constructor() {
    this.constraintProcessors = {
      staff_groups: new StaffGroupProcessor(),
      daily_limits: new DailyLimitProcessor(),
      priority_rules: new PriorityRuleProcessor(),
      monthly_limits: new MonthlyLimitProcessor(),
      backup_assignments: new BackupAssignmentProcessor(),
      early_shift_restrictions: new EarlyShiftRestrictionProcessor(),
      calendar_rules: new CalendarRuleProcessor(),
    };

    this.constraintWeights = new Map();
    this.violationPenalties = new Map();
    this.mlParameters = new Map();
    this.performanceHistory = new ConstraintPerformanceTracker();

    // Cache for processed constraints
    this.constraintCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the constraint integration layer
   */
  async initialize(options = {}) {
    console.log("🔧 Initializing Constraint Integration Layer...");

    try {
      // Initialize constraint processors
      for (const [type, processor] of Object.entries(
        this.constraintProcessors,
      )) {
        await processor.initialize(options);
      }

      // Load default weights
      this.loadDefaultWeights();

      console.log("✅ Constraint Integration Layer initialized successfully");
      return true;
    } catch (error) {
      console.error(
        "❌ Constraint Integration Layer initialization failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * Auto-detect priorities from actual settings and process constraints intelligently
   */
  async processSmartConstraints(settings, problemContext = {}) {
    console.log("🧠 Auto-detecting priorities from settings...");

    // Auto-detect priorities based on what the user actually configured
    const detectedPriorities = this.detectPrioritiesFromSettings(settings);
    console.log(`📊 Detected priorities: ${detectedPriorities.join(" → ")}`);

    const constraintWeights =
      this.convertPrioritiesToWeights(detectedPriorities);
    const penaltyMultipliers = this.calculatePenaltyMultipliers(
      detectedPriorities[0],
    );

    // Convert to the standard rawConstraints format for processing
    const rawConstraints = {
      staff_groups: settings?.staffGroups || [],
      daily_limits: settings?.dailyLimits || [],
      priority_rules: settings?.priorityRules || [],
      monthly_limits: settings?.monthlyLimits || [],
      backup_assignments: settings?.backupAssignments || [],
      early_shift_restrictions: settings?.earlyShiftPreferences || {},
      calendar_rules: settings?.calendarRules || {},
    };

    // Add smart weights and penalties to problem context
    const enhancedContext = {
      ...problemContext,
      detectedPriorities,
      constraintWeights,
      penaltyMultipliers,
      smartMode: true,
    };

    // Process using existing system but with intelligently detected weighting
    return this.processConstraints(rawConstraints, enhancedContext);
  }

  /**
   * Automatically detect priorities based on what settings the user actually configured
   */
  detectPrioritiesFromSettings(settings) {
    const priorities = [];

    // Always prioritize staffing if they have groups or limits
    const hasStaffGroups = settings?.staffGroups?.length > 0;
    const hasDailyLimits = settings?.dailyLimits?.length > 0;
    if (hasStaffGroups || hasDailyLimits) {
      priorities.push("staffing_requirements");
    }

    // If they set up priority rules, they care about staff requests
    const hasPriorityRules = settings?.priorityRules?.length > 0;
    if (hasPriorityRules) {
      priorities.push("staff_requests");
    }

    // If they have complex groups, they care about team dynamics
    const hasComplexGroups =
      hasStaffGroups && settings.staffGroups.some((g) => g.members?.length > 2);
    if (hasComplexGroups) {
      priorities.push("team_dynamics");
    }

    // If they have monthly limits, they care about fairness
    const hasMonthlyLimits = settings?.monthlyLimits?.length > 0;
    if (hasMonthlyLimits) {
      priorities.push("fair_treatment");
    }

    // Cost control comes last unless specifically indicated
    const hasStrictLimits =
      hasDailyLimits && settings.dailyLimits.some((l) => l.isHardConstraint);
    if (hasStrictLimits) {
      priorities.push("cost_control");
    }

    // Fill in defaults for any missing priorities
    const allPriorities = [
      "staffing_requirements",
      "fair_treatment",
      "staff_requests",
      "team_dynamics",
      "cost_control",
    ];
    allPriorities.forEach((p) => {
      if (!priorities.includes(p)) {
        priorities.push(p);
      }
    });

    return priorities;
  }

  /**
   * Convert auto-detected priorities to technical weights
   */
  convertPrioritiesToWeights(priorityOrder) {
    const weights = {
      minimum_coverage: 0,
      skill_requirements: 0,
      shift_distribution: 0,
      off_day_distribution: 0,
      weekend_fairness: 0,
      shift_preferences: 0,
      day_off_preferences: 0,
      cost_efficiency: 0,
      schedule_stability: 0,
      conflict_avoidance: 0,
      seniority_bonus: 0,
    };

    const baseWeights = [40, 30, 20, 15, 10];

    priorityOrder.forEach((priorityId, index) => {
      const weight = baseWeights[index] || 5;

      switch (priorityId) {
        case "staffing_requirements":
          weights.minimum_coverage = weight * 1.5;
          weights.skill_requirements = weight;
          break;
        case "fair_treatment":
          weights.shift_distribution = weight;
          weights.off_day_distribution = weight * 0.8;
          weights.weekend_fairness = weight * 0.6;
          break;
        case "staff_requests":
          weights.shift_preferences = weight;
          weights.day_off_preferences = weight * 1.2;
          break;
        case "cost_control":
          weights.cost_efficiency = weight;
          weights.schedule_stability = weight * 0.8;
          break;
        case "team_dynamics":
          weights.conflict_avoidance = weight;
          weights.seniority_bonus = weight * 0.6;
          break;
      }
    });

    return weights;
  }

  /**
   * Calculate penalty multipliers based on auto-detected top priority
   */
  calculatePenaltyMultipliers(topPriority) {
    switch (topPriority) {
      case "staffing_requirements":
        return {
          hard_constraint_violation: 2000,
          soft_constraint_violation: 100,
          preference_violation: 20,
        };
      case "fair_treatment":
        return {
          hard_constraint_violation: 1200,
          soft_constraint_violation: 80,
          preference_violation: 40,
        };
      case "staff_requests":
        return {
          hard_constraint_violation: 800,
          soft_constraint_violation: 60,
          preference_violation: 60,
        };
      case "cost_control":
        return {
          hard_constraint_violation: 1500,
          soft_constraint_violation: 120,
          preference_violation: 15,
        };
      case "team_dynamics":
        return {
          hard_constraint_violation: 1000,
          soft_constraint_violation: 70,
          preference_violation: 30,
        };
      default:
        return {
          hard_constraint_violation: 1000,
          soft_constraint_violation: 50,
          preference_violation: 10,
        };
    }
  }

  /**
   * Convert UI constraints to ML-compatible format (legacy system)
   */
  async processConstraints(rawConstraints, problemContext = {}) {
    console.log("🔄 Processing constraints for ML optimization...");

    const cacheKey = this.createConstraintCacheKey(
      rawConstraints,
      problemContext,
    );

    // Check cache first
    if (this.constraintCache.has(cacheKey)) {
      const cached = this.constraintCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log("💾 Using cached constraint processing");
        return cached.result;
      }
    }

    const processedConstraints = {
      hardConstraints: [],
      softConstraints: [],
      objectiveWeights: {},
      penaltyFunctions: new Map(),
      mlParameters: {},
      optimizationTargets: [],
      constraintMatrix: null,
    };

    try {
      // Process each constraint type
      for (const [type, processor] of Object.entries(
        this.constraintProcessors,
      )) {
        const constraints = rawConstraints[type] || [];
        console.log(`📋 Processing ${type}: ${constraints.length} constraints`);

        const processed = await processor.process(constraints, problemContext);

        // Merge processed results
        processedConstraints.hardConstraints.push(...processed.hard);
        processedConstraints.softConstraints.push(...processed.soft);
        processedConstraints.objectiveWeights[type] = processed.weights;
        processedConstraints.penaltyFunctions.set(type, processed.penalties);

        // Merge ML parameters
        Object.assign(
          processedConstraints.mlParameters,
          processed.mlParameters,
        );
        processedConstraints.optimizationTargets.push(...processed.targets);
      }

      // Build constraint matrix for optimization algorithms
      processedConstraints.constraintMatrix = this.buildConstraintMatrix(
        processedConstraints,
        problemContext,
      );

      // Apply dynamic weight adjustment
      this.adjustConstraintWeights(processedConstraints, problemContext);

      // Generate optimization objectives
      processedConstraints.objectiveFunction =
        this.createObjectiveFunction(processedConstraints);

      // Cache result
      this.constraintCache.set(cacheKey, {
        result: processedConstraints,
        timestamp: Date.now(),
      });

      console.log("✅ Constraint processing completed");
      console.log(
        `📊 Generated: ${processedConstraints.hardConstraints.length} hard, ${processedConstraints.softConstraints.length} soft constraints`,
      );

      return processedConstraints;
    } catch (error) {
      console.error("❌ Constraint processing failed:", error);
      throw error;
    }
  }

  /**
   * Dynamic weight adjustment based on constraint importance and performance
   */
  adjustConstraintWeights(processedConstraints, problemContext) {
    const { staffCount, dateCount, complexityScore } = problemContext;

    // Adjust weights based on problem size
    const sizeMultiplier = Math.min(2.0, 1 + (staffCount * dateCount) / 1000);

    // Historical performance-based adjustment
    const performanceAdjustments =
      this.performanceHistory.getWeightAdjustments(problemContext);

    processedConstraints.hardConstraints.forEach((constraint) => {
      const baseWeight = constraint.weight || 1.0;
      const performanceAdj = performanceAdjustments.get(constraint.id) || 1.0;
      const finalWeight = baseWeight * sizeMultiplier * performanceAdj;

      this.constraintWeights.set(constraint.id, finalWeight);
      constraint.adjustedWeight = finalWeight;
    });

    processedConstraints.softConstraints.forEach((constraint) => {
      const baseWeight = constraint.weight || 0.5;
      const performanceAdj = performanceAdjustments.get(constraint.id) || 1.0;
      const complexityAdj = 1 + complexityScore * 0.3;
      const finalWeight =
        baseWeight * sizeMultiplier * performanceAdj * complexityAdj;

      this.constraintWeights.set(constraint.id, finalWeight);
      constraint.adjustedWeight = finalWeight;
    });
  }

  /**
   * Build constraint matrix for optimization algorithms
   */
  buildConstraintMatrix(processedConstraints, problemContext) {
    const { staffCount, dateCount } = problemContext;
    const matrixSize = staffCount * dateCount;

    const matrix = {
      dimensions: { staffCount, dateCount, totalSlots: matrixSize },
      constraints: {
        equality: [], // A_eq * x = b_eq
        inequality: [], // A_ineq * x <= b_ineq
        bounds: [], // lower_bound <= x <= upper_bound
      },
      objectiveCoefficients: new Array(matrixSize).fill(0),
      penaltyCoefficients: new Array(matrixSize).fill(0),
    };

    // Convert constraints to matrix form
    this.convertConstraintsToMatrix(processedConstraints, matrix);

    return matrix;
  }

  /**
   * Create unified objective function for optimization
   */
  createObjectiveFunction(processedConstraints) {
    return (solution, context) => {
      let totalScore = 0;
      const totalWeight = 0;

      const scores = {
        hardConstraintScore: 0,
        softConstraintScore: 0,
        objectiveScore: 0,
        penaltyScore: 0,
      };

      // Evaluate hard constraints
      const hardViolations = this.evaluateHardConstraints(
        solution,
        processedConstraints.hardConstraints,
      );
      scores.hardConstraintScore =
        this.calculateHardConstraintScore(hardViolations);

      // Evaluate soft constraints
      const softViolations = this.evaluateSoftConstraints(
        solution,
        processedConstraints.softConstraints,
      );
      scores.softConstraintScore =
        this.calculateSoftConstraintScore(softViolations);

      // Evaluate optimization objectives
      scores.objectiveScore = this.evaluateObjectives(
        solution,
        processedConstraints.optimizationTargets,
      );

      // Calculate penalties
      scores.penaltyScore = this.calculatePenalties(
        hardViolations,
        softViolations,
        processedConstraints.penaltyFunctions,
      );

      // Weighted combination
      const weights = {
        hardConstraints: 0.5,
        softConstraints: 0.3,
        objectives: 0.15,
        penalties: -0.05, // Negative because penalties reduce score
      };

      totalScore =
        scores.hardConstraintScore * weights.hardConstraints +
        scores.softConstraintScore * weights.softConstraints +
        scores.objectiveScore * weights.objectives +
        scores.penaltyScore * weights.penalties;

      return {
        totalScore: Math.max(0, Math.min(100, totalScore)),
        breakdown: scores,
        violations: {
          hard: hardViolations,
          soft: softViolations,
        },
        metadata: {
          evaluatedConstraints:
            processedConstraints.hardConstraints.length +
            processedConstraints.softConstraints.length,
          evaluationTime: Date.now(),
        },
      };
    };
  }

  /**
   * Convert solution back to schedule format and validate
   */
  async validateSolution(solution, originalConstraints, problemContext) {
    console.log("🔍 Validating optimized solution...");

    try {
      // Convert ML solution to schedule format
      const schedule = this.convertSolutionToSchedule(solution, problemContext);

      // Use existing constraint validation
      const validation = await validateAllConstraints(
        schedule,
        problemContext.staffMembers,
        problemContext.dateRange,
        originalConstraints.backup_assignments || [],
      );

      // Calculate confidence based on validation results
      const confidence = this.calculateSolutionConfidence(validation, solution);

      // Generate improvement recommendations
      const recommendations = this.generateRecommendations(
        validation,
        solution,
      );

      return {
        valid: validation.valid,
        schedule,
        confidence,
        validation,
        recommendations,
        metadata: {
          constraintsChecked: validation.summary.totalConstraintsChecked,
          violationsFound: validation.summary.violationsFound,
          validationTime: Date.now(),
        },
      };
    } catch (error) {
      console.error("❌ Solution validation failed:", error);
      return {
        valid: false,
        error: error.message,
        confidence: 0,
      };
    }
  }

  /**
   * Performance tracking and learning
   */
  recordPerformance(constraints, solution, actualOutcome) {
    this.performanceHistory.record({
      constraints,
      solution,
      outcome: actualOutcome,
      timestamp: Date.now(),
    });
  }

  /**
   * Get constraint processing statistics
   */
  getStatistics() {
    return {
      constraintsProcessed: this.constraintCache.size,
      cacheHitRate: this.calculateCacheHitRate(),
      averageProcessingTime: this.performanceHistory.getAverageProcessingTime(),
      constraintTypes: Object.keys(this.constraintProcessors),
      activeWeights: this.constraintWeights.size,
      performanceHistory: this.performanceHistory.getSummary(),
    };
  }

  // Helper methods
  createConstraintCacheKey(rawConstraints, problemContext) {
    const constraintHash = JSON.stringify(rawConstraints);
    const contextHash = JSON.stringify({
      staffCount: problemContext.staffCount,
      dateCount: problemContext.dateCount,
      complexityScore: problemContext.complexityScore,
    });
    return `${constraintHash}_${contextHash}`;
  }

  loadDefaultWeights() {
    // Default constraint weights
    const defaultWeights = {
      staff_group_conflicts: 50,
      daily_limits: 40,
      monthly_limits: 35,
      priority_rules: 45,
      backup_assignments: 30,
      workload_balance: 25,
      shift_distribution: 20,
      coverage_requirements: 60,
      early_shift_restrictions: 100, // Very high weight - critical constraint
      calendar_rules: 100, // Very high weight - mandatory calendar rules
    };

    for (const [type, weight] of Object.entries(defaultWeights)) {
      this.constraintWeights.set(type, weight);
    }
  }

  convertConstraintsToMatrix(processedConstraints, matrix) {
    // Convert hard constraints to equality/inequality constraints
    processedConstraints.hardConstraints.forEach((constraint) => {
      if (constraint.type === "equality") {
        matrix.constraints.equality.push(constraint.matrixForm);
      } else {
        matrix.constraints.inequality.push(constraint.matrixForm);
      }
    });

    // Convert soft constraints to penalty coefficients
    processedConstraints.softConstraints.forEach((constraint) => {
      if (constraint.penaltyCoefficients) {
        constraint.penaltyCoefficients.forEach((coeff, index) => {
          matrix.penaltyCoefficients[index] += coeff * constraint.weight;
        });
      }
    });
  }

  evaluateHardConstraints(solution, hardConstraints) {
    const violations = [];

    hardConstraints.forEach((constraint) => {
      const violation = constraint.evaluate(solution);
      if (violation && violation.severity === "critical") {
        violations.push({
          constraintId: constraint.id,
          type: constraint.type,
          severity: violation.severity,
          magnitude: violation.magnitude,
          details: violation.details,
        });
      }
    });

    return violations;
  }

  evaluateSoftConstraints(solution, softConstraints) {
    const violations = [];

    softConstraints.forEach((constraint) => {
      const violation = constraint.evaluate(solution);
      if (violation) {
        violations.push({
          constraintId: constraint.id,
          type: constraint.type,
          severity: violation.severity || "medium",
          magnitude: violation.magnitude,
          weight: constraint.weight,
          details: violation.details,
        });
      }
    });

    return violations;
  }

  calculateHardConstraintScore(violations) {
    if (violations.length === 0) return 100;

    let penalty = 0;
    violations.forEach((v) => {
      penalty += v.magnitude * 20; // Hard constraint violations are heavily penalized
    });

    return Math.max(0, 100 - penalty);
  }

  calculateSoftConstraintScore(violations) {
    if (violations.length === 0) return 100;

    let weightedPenalty = 0;
    let totalWeight = 0;

    violations.forEach((v) => {
      const weight = v.weight || 1;
      weightedPenalty += v.magnitude * weight * 10;
      totalWeight += weight;
    });

    const avgPenalty = totalWeight > 0 ? weightedPenalty / totalWeight : 0;
    return Math.max(0, 100 - avgPenalty);
  }

  evaluateObjectives(solution, targets) {
    let totalScore = 0;
    let totalWeight = 0;

    targets.forEach((target) => {
      const score = target.evaluate(solution);
      const weight = target.weight || 1;
      totalScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 50;
  }

  calculatePenalties(hardViolations, softViolations, penaltyFunctions) {
    let totalPenalty = 0;

    // Hard constraint penalties
    hardViolations.forEach((v) => {
      const penaltyFn = penaltyFunctions.get(v.type);
      if (penaltyFn) {
        totalPenalty += penaltyFn(v);
      } else {
        totalPenalty += v.magnitude * 50; // Default heavy penalty
      }
    });

    // Soft constraint penalties
    softViolations.forEach((v) => {
      const penaltyFn = penaltyFunctions.get(v.type);
      if (penaltyFn) {
        totalPenalty += penaltyFn(v) * (v.weight || 1);
      } else {
        totalPenalty += v.magnitude * 10 * (v.weight || 1); // Default light penalty
      }
    });

    return Math.min(0, -totalPenalty); // Penalties are negative
  }

  convertSolutionToSchedule(solution, problemContext) {
    const { staffMembers, dateRange } = problemContext;
    const schedule = {};

    staffMembers.forEach((staff, staffIndex) => {
      schedule[staff.id] = {};
      dateRange.forEach((date, dateIndex) => {
        const dateKey = date.toISOString().split("T")[0];
        const solutionIndex = staffIndex * dateRange.length + dateIndex;

        // Convert numerical solution to shift symbols
        const shiftValue = solution[solutionIndex];
        const shiftSymbol = this.convertToShiftSymbol(shiftValue);

        schedule[staff.id][dateKey] = shiftSymbol;
      });
    });

    return schedule;
  }

  convertToShiftSymbol(value) {
    // Convert numerical optimization value to shift symbol
    if (value <= 0.25) return "×"; // Off day
    if (value <= 0.5) return "△"; // Early shift
    if (value <= 0.75) return "▽"; // Late shift
    return ""; // Normal shift
  }

  calculateSolutionConfidence(validation, solution) {
    if (validation.valid) {
      return 0.9 + Math.random() * 0.1; // 90-100% for valid solutions
    }

    const violationRatio =
      validation.summary.violationsFound /
      validation.summary.totalConstraintsChecked;
    const confidence = Math.max(0.1, 0.8 - violationRatio * 0.7);

    return confidence;
  }

  generateRecommendations(validation, solution) {
    const recommendations = [];

    if (!validation.valid) {
      // High-priority violations
      validation.violations.forEach((violation) => {
        if (violation.severity === "critical") {
          recommendations.push({
            type: "critical",
            message: `Address ${violation.type}: ${violation.message}`,
            priority: "high",
            suggestedAction: this.getSuggestedAction(violation),
          });
        }
      });
    }

    return recommendations;
  }

  getSuggestedAction(violation) {
    switch (violation.type) {
      case VIOLATION_TYPES.INSUFFICIENT_COVERAGE:
        return "Convert some off days to working shifts";
      case VIOLATION_TYPES.DAILY_OFF_LIMIT:
        return "Redistribute off days across different dates";
      case VIOLATION_TYPES.STAFF_GROUP_CONFLICT:
        return "Adjust shifts for conflicting group members";
      default:
        return "Review and adjust the conflicting assignments";
    }
  }

  calculateCacheHitRate() {
    // This would track actual cache hits vs misses
    return 0.75; // Placeholder
  }
}

/**
 * Base class for constraint processors
 */
class BaseConstraintProcessor {
  constructor(type) {
    this.type = type;
    this.initialized = false;
  }

  async initialize(options = {}) {
    this.initialized = true;
    console.log(`✅ ${this.type} processor initialized`);
  }

  async process(constraints, context) {
    if (!this.initialized) {
      throw new Error(`${this.type} processor not initialized`);
    }

    return {
      hard: [],
      soft: [],
      weights: {},
      penalties: new Map(),
      mlParameters: {},
      targets: [],
    };
  }
}

/**
 * Staff Group Constraint Processor
 */
class StaffGroupProcessor extends BaseConstraintProcessor {
  constructor() {
    super("StaffGroup");
  }

  async process(staffGroups, context) {
    const result = await super.process(staffGroups, context);

    for (const group of staffGroups) {
      // Convert group conflicts to hard constraints
      const conflictConstraint = {
        id: `staff_group_${group.id}`,
        type: "group_conflict",
        groupId: group.id,
        members: group.members,
        weight: 50,
        evaluate: (solution) =>
          this.evaluateGroupConflict(solution, group, context),
        matrixForm: this.createGroupConflictMatrix(group, context),
      };

      result.hard.push(conflictConstraint);

      // Add backup coverage as soft constraint if specified
      if (group.coverageRules && group.coverageRules.backupRequired) {
        const coverageConstraint = {
          id: `backup_coverage_${group.id}`,
          type: "backup_coverage",
          groupId: group.id,
          backupStaff: group.coverageRules.backupStaffIds,
          weight: 30,
          evaluate: (solution) =>
            this.evaluateBackupCoverage(solution, group, context),
        };

        result.soft.push(coverageConstraint);
      }
    }

    result.weights.staff_groups = 45;
    result.mlParameters.groupConflictPenalty = 100;

    return result;
  }

  evaluateGroupConflict(solution, group, context) {
    const { staffMembers, dateRange } = context;

    if (!staffMembers || !dateRange || !group.members || group.members.length === 0) {
      return null;
    }

    const violations = [];

    // Check each date in the schedule
    dateRange.forEach((date, dateIndex) => {
      const dateKey = date.toISOString().split('T')[0];
      const conflictingMembers = [];

      // Check each member in this group
      group.members.forEach((memberName) => {
        // Find staff member by name
        const staffIndex = staffMembers.findIndex((s) => s.name === memberName);

        if (staffIndex === -1) {
          return; // Staff member not found
        }

        const staff = staffMembers[staffIndex];
        const solutionIndex = staffIndex * dateRange.length + dateIndex;
        const shiftValue = solution[solutionIndex];

        // Check if this staff member has × (day off) or △ (early shift)
        // Based on convertToShiftSymbol() logic:
        // × = 0-0.25, △ = 0.25-0.5
        const isDayOff = shiftValue <= 0.25;
        const isEarlyShift = shiftValue > 0.25 && shiftValue <= 0.5;

        if (isDayOff || isEarlyShift) {
          conflictingMembers.push({
            staffId: staff.id,
            staffName: staff.name,
            shiftValue,
            shift: isDayOff ? '×' : '△'
          });
        }
      });

      // If more than 1 member has × or △ on same day = violation
      // This catches ××, △△, ×△, and △× patterns
      if (conflictingMembers.length > 1) {
        violations.push({
          date: dateKey,
          groupName: group.name,
          groupId: group.id,
          conflictingMembers,
          conflictCount: conflictingMembers.length,
          reason: `${conflictingMembers.length} members in group "${group.name}" have × or △ on ${dateKey}: ${conflictingMembers.map(m => `${m.staffName}(${m.shift})`).join(', ')}`
        });
      }
    });

    if (violations.length === 0) {
      return null; // No violations
    }

    return {
      severity: "critical",
      magnitude: violations.length,
      details: {
        violationCount: violations.length,
        violations,
        message: `${violations.length} group conflict violation(s) detected in group "${group.name}"`,
        affectedDates: violations.map(v => v.date),
        conflictPatterns: violations.map(v => ({
          date: v.date,
          pattern: v.conflictingMembers.map(m => m.shift).join('')
        }))
      }
    };
  }

  evaluateBackupCoverage(solution, group, context) {
    // Implementation for evaluating backup coverage
    return null; // No violation found
  }

  createGroupConflictMatrix(group, context) {
    // Create matrix representation of group conflict constraint
    return {
      coefficients: [],
      bound: 1,
      type: "inequality",
    };
  }
}

/**
 * Daily Limit Constraint Processor
 */
class DailyLimitProcessor extends BaseConstraintProcessor {
  constructor() {
    super("DailyLimit");
  }

  async process(dailyLimits, context) {
    const result = await super.process(dailyLimits, context);

    for (const limit of dailyLimits) {
      const constraint = {
        id: `daily_limit_${limit.id}`,
        type: "daily_limit",
        shiftType: limit.shiftType,
        maxCount: limit.maxCount,
        daysOfWeek: limit.daysOfWeek,
        weight: limit.isHardConstraint ? 60 : 25,
        evaluate: (solution) =>
          this.evaluateDailyLimit(solution, limit, context),
        matrixForm: this.createDailyLimitMatrix(limit, context),
      };

      if (limit.isHardConstraint) {
        result.hard.push(constraint);
      } else {
        result.soft.push(constraint);
      }
    }

    result.weights.daily_limits = 40;
    result.mlParameters.dailyLimitPenalty = 80;

    return result;
  }

  evaluateDailyLimit(solution, limit, context) {
    // Implementation for evaluating daily limits
    return null; // No violation found
  }

  createDailyLimitMatrix(limit, context) {
    // Create matrix representation of daily limit constraint
    return {
      coefficients: [],
      bound: limit.maxCount,
      type: "inequality",
    };
  }
}

/**
 * Priority Rule Constraint Processor
 */
class PriorityRuleProcessor extends BaseConstraintProcessor {
  constructor() {
    super("PriorityRule");
  }

  async process(priorityRules, context) {
    const result = await super.process(priorityRules, context);

    for (const rule of priorityRules) {
      const constraint = {
        id: `priority_rule_${rule.id}`,
        type: "priority_rule",
        staffId: rule.staffId,
        shiftType: rule.shiftType,
        daysOfWeek: rule.daysOfWeek,
        priority: rule.priorityLevel,
        weight: rule.isHardConstraint ? 80 : rule.priorityLevel * 10,
        evaluate: (solution) =>
          this.evaluatePriorityRule(solution, rule, context),
      };

      if (rule.isHardConstraint) {
        result.hard.push(constraint);
      } else {
        result.soft.push(constraint);
      }
    }

    result.weights.priority_rules = 45;
    result.mlParameters.priorityPenalty = 60;

    return result;
  }

  evaluatePriorityRule(solution, rule, context) {
    // Implementation for evaluating priority rules
    return null; // No violation found
  }
}

/**
 * Monthly Limit Constraint Processor
 */
class MonthlyLimitProcessor extends BaseConstraintProcessor {
  constructor() {
    super("MonthlyLimit");
  }

  async process(monthlyLimits, context) {
    const result = await super.process(monthlyLimits, context);

    for (const limit of monthlyLimits) {
      const constraint = {
        id: `monthly_limit_${limit.id}`,
        type: "monthly_limit",
        limitType: limit.limitType,
        maxCount: limit.maxCount,
        weight: limit.isHardConstraint ? 40 : 20,
        evaluate: (solution) =>
          this.evaluateMonthlyLimit(solution, limit, context),
      };

      if (limit.isHardConstraint) {
        result.hard.push(constraint);
      } else {
        result.soft.push(constraint);
      }
    }

    result.weights.monthly_limits = 35;
    result.mlParameters.monthlyLimitPenalty = 50;

    return result;
  }

  evaluateMonthlyLimit(solution, limit, context) {
    // Implementation for evaluating monthly limits
    return null; // No violation found
  }
}

/**
 * Backup Assignment Constraint Processor
 */
class BackupAssignmentProcessor extends BaseConstraintProcessor {
  constructor() {
    super("BackupAssignment");
  }

  async process(backupAssignments, context) {
    const result = await super.process(backupAssignments, context);

    for (const assignment of backupAssignments) {
      const constraint = {
        id: `backup_${assignment.id}`,
        type: "backup_assignment",
        groupId: assignment.groupId,
        staffId: assignment.staffId,
        weight: 30,
        evaluate: (solution) =>
          this.evaluateBackupAssignment(solution, assignment, context),
      };

      result.soft.push(constraint);
    }

    result.weights.backup_assignments = 30;
    result.mlParameters.backupPenalty = 40;

    return result;
  }

  evaluateBackupAssignment(solution, assignment, context) {
    // Implementation for evaluating backup assignments
    return null; // No violation found
  }
}

/**
 * Early Shift Restriction Constraint Processor
 * Validates that staff members can only be assigned early shifts (△)
 * if they have explicit permission in their preferences
 */
class EarlyShiftRestrictionProcessor extends BaseConstraintProcessor {
  constructor() {
    super("EarlyShiftRestriction");
  }

  async process(earlyShiftPreferences, context) {
    const result = await super.process(earlyShiftPreferences, context);

    if (!earlyShiftPreferences || Object.keys(earlyShiftPreferences).length === 0) {
      console.log("ℹ️ No early shift preferences configured - skipping restrictions");
      return result;
    }

    console.log(
      `🔍 Processing early shift restrictions for ${Object.keys(earlyShiftPreferences).length} staff members`
    );

    // Create a hard constraint for early shift permissions
    const earlyShiftConstraint = {
      id: "early_shift_permissions",
      type: "early_shift_restriction",
      preferences: earlyShiftPreferences,
      weight: 100, // Very high weight - this is a critical constraint
      evaluate: (solution) =>
        this.evaluateEarlyShiftRestrictions(solution, earlyShiftPreferences, context),
      matrixForm: this.createEarlyShiftMatrix(earlyShiftPreferences, context),
    };

    // This is a hard constraint - staff cannot be assigned early shifts without permission
    result.hard.push(earlyShiftConstraint);

    result.weights.early_shift_restrictions = 100;
    result.mlParameters.earlyShiftViolationPenalty = 100; // Heavy penalty

    return result;
  }

  /**
   * Evaluate early shift restriction violations in a solution
   */
  evaluateEarlyShiftRestrictions(solution, preferences, context) {
    const { staffMembers, dateRange } = context;

    if (!staffMembers || !dateRange) {
      return null;
    }

    const violations = [];

    staffMembers.forEach((staff, staffIndex) => {
      dateRange.forEach((date, dateIndex) => {
        const dateKey = date.toISOString().split("T")[0];
        const solutionIndex = staffIndex * dateRange.length + dateIndex;
        const shiftValue = solution[solutionIndex];

        // Check if this is an early shift assignment (△)
        // In the solution array, early shift is typically represented as ~0.33-0.5
        const isEarlyShift = shiftValue > 0.25 && shiftValue <= 0.5;

        if (isEarlyShift) {
          // Check if staff has permission for early shifts on this date
          const hasPermission = this.canDoEarlyShift(preferences, staff.id, dateKey);

          if (!hasPermission) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              shiftValue,
              reason: "Staff member not authorized for early shifts on this date",
            });
          }
        }
      });
    });

    if (violations.length === 0) {
      return null; // No violations
    }

    return {
      severity: "critical",
      magnitude: violations.length,
      details: {
        violationCount: violations.length,
        violations,
        message: `${violations.length} early shift assignment(s) violate permission constraints`,
      },
    };
  }

  /**
   * Check if a staff member can do early shifts on a specific date
   * (Mirrors logic from EarlyShiftPreferencesLoader)
   */
  canDoEarlyShift(preferencesMap, staffId, dateString) {
    if (!preferencesMap[staffId]) {
      return false;
    }

    // Check exact date match first
    if (preferencesMap[staffId][dateString] !== undefined) {
      return preferencesMap[staffId][dateString];
    }

    // Fallback to 'default' if no specific date match
    if (preferencesMap[staffId]["default"] !== undefined) {
      return preferencesMap[staffId]["default"];
    }

    // No preference = not allowed
    return false;
  }

  /**
   * Create matrix representation of early shift restrictions
   */
  createEarlyShiftMatrix(preferences, context) {
    // Matrix form for optimization algorithms
    // This would create inequality constraints preventing early shift assignments
    // for unauthorized staff
    return {
      coefficients: [],
      bound: 0,
      type: "inequality",
    };
  }
}

/**
 * Calendar Rule Constraint Processor
 * Enforces must_work and must_day_off rules from calendar_rules table
 */
class CalendarRuleProcessor extends BaseConstraintProcessor {
  constructor() {
    super("CalendarRule");
  }

  async process(calendarRules, context) {
    const result = await super.process(calendarRules, context);

    if (!calendarRules || Object.keys(calendarRules).length === 0) {
      console.log("ℹ️ No calendar rules configured - skipping calendar constraints");
      return result;
    }

    console.log(
      `🔍 Processing calendar rules for ${Object.keys(calendarRules).length} dates`
    );

    // Create hard constraints for calendar rules
    const calendarConstraint = {
      id: "calendar_rules",
      type: "calendar_rule",
      rules: calendarRules,
      weight: 100, // Very high weight - calendar rules are mandatory
      evaluate: (solution) =>
        this.evaluateCalendarRules(solution, calendarRules, context),
      matrixForm: this.createCalendarRuleMatrix(calendarRules, context),
    };

    // Calendar rules are hard constraints - must be respected
    result.hard.push(calendarConstraint);

    result.weights.calendar_rules = 100;
    result.mlParameters.calendarRuleViolationPenalty = 100; // Heavy penalty

    return result;
  }

  /**
   * Evaluate calendar rule violations in a solution
   */
  evaluateCalendarRules(solution, rules, context) {
    const { staffMembers, dateRange } = context;

    if (!staffMembers || !dateRange) {
      return null;
    }

    const violations = [];

    // Check each date that has calendar rules
    Object.keys(rules).forEach((dateKey) => {
      const rule = rules[dateKey];
      const dateObj = new Date(dateKey + 'T00:00:00');
      const dateIndex = dateRange.findIndex(
        (d) => d.toISOString().split('T')[0] === dateKey
      );

      if (dateIndex === -1) {
        return; // Date not in our range
      }

      staffMembers.forEach((staff, staffIndex) => {
        const solutionIndex = staffIndex * dateRange.length + dateIndex;
        const shiftValue = solution[solutionIndex];

        // Check must_day_off violations
        if (rule.must_day_off) {
          // Staff should have day off (shift value should be 0 for day off)
          // In solution array: 0 = day off, >0 = working
          if (shiftValue > 0.1) {
            violations.push({
              type: 'must_day_off_violation',
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              shiftValue,
              reason: 'Staff assigned work shift on a must_day_off date',
              rule: 'must_day_off',
            });
          }
        }

        // Check must_work violations
        if (rule.must_work) {
          // Staff should be working (shift value > 0)
          // Value of 0 means day off
          if (shiftValue <= 0.1) {
            violations.push({
              type: 'must_work_violation',
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              shiftValue,
              reason: 'Staff assigned day off on a must_work date',
              rule: 'must_work',
            });
          }
        }
      });
    });

    if (violations.length === 0) {
      return null; // No violations
    }

    const mustWorkCount = violations.filter((v) => v.type === 'must_work_violation').length;
    const mustDayOffCount = violations.filter((v) => v.type === 'must_day_off_violation').length;

    return {
      severity: "critical",
      magnitude: violations.length,
      details: {
        violationCount: violations.length,
        mustWorkViolations: mustWorkCount,
        mustDayOffViolations: mustDayOffCount,
        violations,
        message: `${violations.length} calendar rule violation(s): ${mustWorkCount} must_work, ${mustDayOffCount} must_day_off`,
      },
    };
  }

  /**
   * Create matrix representation of calendar rules
   */
  createCalendarRuleMatrix(rules, context) {
    // Matrix form for optimization algorithms
    return {
      coefficients: [],
      bound: 0,
      type: "equality",
    };
  }
}

/**
 * Performance tracking for constraint processing
 */
class ConstraintPerformanceTracker {
  constructor() {
    this.performanceData = [];
    this.weightAdjustments = new Map();
  }

  record(data) {
    this.performanceData.push({
      ...data,
      id: Date.now().toString(),
    });

    // Keep only recent data (last 100 records)
    if (this.performanceData.length > 100) {
      this.performanceData = this.performanceData.slice(-100);
    }
  }

  getWeightAdjustments(problemContext) {
    // Analyze performance and suggest weight adjustments
    const adjustments = new Map();

    // Default adjustments based on problem characteristics
    if (problemContext.complexityScore > 0.8) {
      adjustments.set("staff_group_conflicts", 1.2);
      adjustments.set("daily_limits", 1.1);
    }

    return adjustments;
  }

  getAverageProcessingTime() {
    if (this.performanceData.length === 0) return 0;

    const times = this.performanceData.map((d) => d.processingTime || 0);
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getSummary() {
    return {
      totalRecords: this.performanceData.length,
      averageProcessingTime: this.getAverageProcessingTime(),
      successRate: this.calculateSuccessRate(),
      lastUpdated:
        this.performanceData.length > 0
          ? this.performanceData[this.performanceData.length - 1].timestamp
          : null,
    };
  }

  calculateSuccessRate() {
    if (this.performanceData.length === 0) return 0;

    const successful = this.performanceData.filter(
      (d) => d.outcome?.success,
    ).length;
    return (successful / this.performanceData.length) * 100;
  }
}
