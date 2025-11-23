/**
 * ScheduleGenerator.js
 *
 * Core schedule generation engine that creates optimized shift schedules.
 * Combines constraint satisfaction, pattern recognition, and intelligent assignment.
 */

import {
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  getDayOfWeek,
  isWeekday,
  PRIORITY_RULES,
  getMonthlyLimits,
  getWeeklyLimits, // ✅ NEW: Weekly limits loader
  validateAllConstraints,
  validateWeeklyLimits, // ✅ NEW: Weekly validation function
  getPriorityRules,
  getStaffConflictGroups,
  getDailyLimits,
  getBackupAssignments,
  onConfigurationCacheInvalidated,
  invalidateConfigurationCache,
  refreshAllConfigurations,
  VIOLATION_TYPES, // ✅ NEW: Violation type constants
} from "../constraints/ConstraintEngine";
import { configService } from "../../services/ConfigurationService.js";
import BackupStaffService from "../../services/BackupStaffService";
import { GeneticAlgorithm } from "../algorithms/GeneticAlgorithm";
import { SimulatedAnnealing } from "../algorithms/SimulatedAnnealing";
import { EnsembleScheduler } from "../ml/EnsembleScheduler";
import { EarlyShiftPreferencesLoader } from "../utils/EarlyShiftPreferencesLoader";
import { CalendarRulesLoader } from "../utils/CalendarRulesLoader";
import { CalendarEarlyShiftIntegrator } from "../utils/CalendarEarlyShiftIntegrator";
import { PreGenerationConstraintLocker } from "./PreGenerationConstraintLocker";
import { ViolationRepairEngine } from "./ViolationRepairEngine";

/**
 * Main ScheduleGenerator class
 */
export class ScheduleGenerator {
  constructor() {
    this.initialized = false;
    this.generationStrategies = new Map();
    this.shiftPriorities = new Map();
    this.staffPatterns = new Map();
    this.backupStaffService = new BackupStaffService();
    this.generationStats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      averageIterations: 0,
      averageConstraintSatisfaction: 0,
      averageConfidenceScore: 0,
      performanceHistory: [],
    };

    // Real-time cache invalidation setup
    this.cacheInvalidationUnsubscribe = null;
    this.lastConfigurationRefresh = 0;

    // Enhanced ML components
    this.geneticAlgorithm = new GeneticAlgorithm();
    this.simulatedAnnealing = new SimulatedAnnealing();
    this.ensembleScheduler = new EnsembleScheduler();

    // ML parameter presets mapping
    this.mlPresets = {
      quick: {
        algorithm: "genetic_algorithm",
        populationSize: 50,
        generations: 150,
        mutationRate: 0.15,
        crossoverRate: 0.7,
        elitismRate: 0.15,
        convergenceThreshold: 0.005,
        confidenceThreshold: 0.65,
        maxRuntime: 120,
        enableAdaptiveMutation: true,
        enableElitismDiversity: false,
        parallelProcessing: true,
        constraintWeightMultiplier: 0.8,
      },
      balanced: {
        algorithm: "genetic_algorithm",
        populationSize: 100,
        generations: 300,
        mutationRate: 0.1,
        crossoverRate: 0.8,
        elitismRate: 0.1,
        convergenceThreshold: 0.001,
        confidenceThreshold: 0.75,
        maxRuntime: 300,
        enableAdaptiveMutation: true,
        enableElitismDiversity: false,
        parallelProcessing: true,
        constraintWeightMultiplier: 1.0,
      },
      best: {
        algorithm: "ensemble",
        populationSize: 200,
        generations: 500,
        mutationRate: 0.05,
        crossoverRate: 0.85,
        elitismRate: 0.05,
        convergenceThreshold: 0.0001,
        confidenceThreshold: 0.85,
        maxRuntime: 720,
        enableAdaptiveMutation: true,
        enableElitismDiversity: true,
        parallelProcessing: true,
        constraintWeightMultiplier: 1.2,
        ensembleAlgorithms: ["genetic_algorithm", "simulated_annealing"],
        ensembleWeights: [0.6, 0.4],
      },
    };

    // Constraint weights for different settings
    this.constraintWeights = {
      staffGroups: 0.25,
      weeklyLimits: 0.2, // ✅ NEW: Rolling 7-day window constraints
      dailyLimits: 0.2,
      priorityRules: 0.15,
      monthlyLimits: 0.15,
      fairness: 0.05,
      earlyShiftRestrictions: 1.0, // ✅ NEW: Early shift permission enforcement (critical constraint)
      calendarRules: 1.0, // ✅ NEW: Calendar rules (must_work, must_day_off) enforcement
    };

    // Monthly balancing tracking
    this.monthlyProjections = new Map();
    this.monthlyBalancingEnabled = true;

    // Performance adaptation settings
    this.adaptiveLearning = {
      enabled: true,
      performanceWindow: 10,
      improvementThreshold: 0.05,
      adaptationRate: 0.1,
    };
  }

  /**
   * Check if staff member is eligible for early shift (△)
   * Only 社員 staff can work early shifts
   * @param {Object} staff - Staff member object with status field
   * @returns {boolean} True if staff can work early shifts
   */
  isEligibleForEarlyShift(staff) {
    return staff.status === "社員";
  }

  /**
   * Initialize the schedule generator
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("📋 Initializing Schedule Generator...");

    try {
      // Initialize generation strategies
      this.initializeGenerationStrategies();

      // Initialize shift priorities
      await this.initializeShiftPriorities();

      // Load historical patterns if available
      await this.loadHistoricalPatterns(options);

      // Initialize backup staff service
      const {
        staffMembers = [],
        staffGroups = [],
        backupAssignments = [],
      } = options;

      // Use configuration-aware initialization for backup staff service
      await this.backupStaffService.initializeWithConfiguration(
        staffMembers,
        staffGroups,
        backupAssignments, // Will auto-load from config if null/undefined
      );

      // Set up real-time cache invalidation listener
      this.setupCacheInvalidationListener();

      this.initialized = true;
      console.log(
        "✅ Schedule Generator initialized successfully with real-time configuration updates",
      );
    } catch (error) {
      console.error("❌ Schedule Generator initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize generation strategies
   */
  initializeGenerationStrategies() {
    // Priority-based strategy: Fill high priority assignments first
    this.generationStrategies.set("priority_first", {
      name: "Priority First",
      description: "Assign priority rules first, then fill remaining positions",
      weight: 0.3,
      execute: this.priorityFirstStrategy.bind(this),
    });

    // Balance-based strategy: Distribute shifts evenly
    this.generationStrategies.set("balance_first", {
      name: "Balance First",
      description: "Focus on even distribution of shifts across staff",
      weight: 0.4,
      execute: this.balanceFirstStrategy.bind(this),
    });

    // Pattern-based strategy: Follow historical patterns
    this.generationStrategies.set("pattern_based", {
      name: "Pattern Based",
      description: "Generate based on historical patterns and preferences",
      weight: 0.3,
      execute: this.patternBasedStrategy.bind(this),
    });
  }

  /**
   * Initialize shift priorities based on business rules (now uses dynamic config)
   */
  async initializeShiftPriorities() {
    // Load dynamic priority rules and convert to legacy format for backward compatibility
    try {
      const priorityRules = await getPriorityRules();

      if (priorityRules && priorityRules.length > 0) {
        console.log(
          `🎯 Initializing ${priorityRules.length} dynamic priority rules as legacy format`,
        );

        priorityRules.forEach((rule, index) => {
          if (rule.isActive !== false) {
            this.shiftPriorities.set(`dynamic_${rule.id || index}`, {
              priority: rule.isHardConstraint ? "critical" : "high",
              staff: rule.staffId, // Can be name or ID
              condition: (dateKey, schedule, staffMembers) => {
                const date = new Date(dateKey);
                const dayOfWeek = date.getDay();

                // Check day of week match
                if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
                  if (!rule.daysOfWeek.includes(dayOfWeek)) return false;
                }

                // Check effective date range
                if (rule.effectiveFrom && date < new Date(rule.effectiveFrom))
                  return false;
                if (rule.effectiveUntil && date > new Date(rule.effectiveUntil))
                  return false;

                return true;
              },
              shift: this.mapShiftTypeToSymbol(rule.shiftType),
              weight: (rule.priorityLevel || 3) / 5, // Convert 1-5 priority to 0.2-1.0 weight
              ruleType: rule.ruleType,
              preferenceStrength: rule.preferenceStrength || 0.8,
            });
          }
        });
      } else {
        console.log(
          "📌 No dynamic priority rules found, using minimal legacy fallbacks",
        );
        this.initializeLegacyPriorities();
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to load dynamic priority rules, using legacy fallbacks:",
        error,
      );
      this.initializeLegacyPriorities();
    }
  }

  /**
   * Initialize minimal legacy priorities as fallback
   */
  initializeLegacyPriorities() {
    console.log("🔄 Initializing minimal legacy priority rules as fallback");

    // Only keep essential business rules that are commonly expected
    // These should ideally be migrated to dynamic priority rules
    this.shiftPriorities.set("legacy_coverage", {
      priority: "medium",
      staff: null, // Will be dynamically determined
      condition: (dateKey, schedule, staffMembers) => {
        // Generic coverage check - can be extended based on actual business needs
        return false; // Disabled by default - encourage use of dynamic rules
      },
      shift: "",
      weight: 0.5,
    });
  }

  /**
   * Load historical patterns for pattern-based generation
   * @param {Object} options - Options containing historical data
   */
  async loadHistoricalPatterns(options) {
    // This would typically load from the DataExtractor
    // For now, initialize with empty patterns
    this.staffPatterns.clear();

    // Initialize basic patterns for each staff member
    const staffList = options.staffMembers || [];
    staffList.forEach((staff) => {
      this.staffPatterns.set(staff.id, {
        preferredDays: [],
        preferredShifts: [],
        avoidedDays: [],
        patterns: {
          weekdayPreference: 0, // -1 to 1 scale
          weekendPreference: 0,
          earlyShiftPreference: 0,
          lateShiftPreference: 0,
        },
      });
    });
  }

  /**
   * Generate a complete schedule using ML-optimized strategy
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated schedule
   */
  async generateSchedule(params = {}) {
    if (!this.initialized) {
      throw new Error("ScheduleGenerator not initialized");
    }

    const {
      staffMembers = [],
      dateRange = [],
      existingSchedule = {},
      preserveExisting = true,
      strategy = "balanced", // Default to balanced
      maxIterations = 100,
      mlParameters = null, // ML parameters from UI
    } = params;

    // ✅ PHASE 1: Store early shift preferences for validation during generation
    this.earlyShiftPreferences = params.earlyShiftPreferences || {};
    this.calendarRules = params.calendarRules || {};

    console.log(
      `📋 Generating schedule with ${strategy} strategy (ML-enhanced)...`,
    );

    try {
      const startTime = Date.now();
      let bestSchedule = null;
      let bestScore = -1;
      let confidenceScore = 0;
      let iterations = 0;

      // Get ML preset configuration
      const mlConfig =
        mlParameters || this.mlPresets[strategy] || this.mlPresets.balanced;
      console.log(`🎯 Using ML preset: ${JSON.stringify(mlConfig, null, 2)}`);

      // Update constraint weights based on current settings
      await this.updateConstraintWeights(
        staffMembers,
        dateRange,
        params.settings,
      );

      // Calculate monthly projections if balancing is enabled
      if (this.monthlyBalancingEnabled) {
        console.log(
          "📋 Calculating monthly projections for enhanced generation...",
        );
        await this.calculateMonthlyProjections(
          existingSchedule,
          staffMembers,
          dateRange,
        );
      }

      // Initialize working schedule
      const workingSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange,
        existingSchedule,
        preserveExisting,
      );

      // ✅ PHASE 1: Lock calendar-mandated constraints BEFORE generation
      let lockedCells = new Set();
      let lockingSummary = null;

      if (this.calendarRules && Object.keys(this.calendarRules).length > 0) {
        console.log("🔒 [PHASE 1] Applying pre-generation constraint locking...");

        const dateRangeStrings = dateRange.map(d => d.toISOString().split('T')[0]);

        const lockingResult = PreGenerationConstraintLocker.lockMandatoryConstraints(
          workingSchedule,
          this.calendarRules,
          this.earlyShiftPreferences,
          staffMembers,
          dateRangeStrings
        );

        lockedCells = lockingResult.lockedCells;
        lockingSummary = lockingResult.summary;

        console.log(`✅ [PHASE 1] Locked ${lockedCells.size} cells before generation`);
        console.log(`   └─ Summary:`, lockingSummary);
      }

      // Store locked cells for generation algorithms to skip
      this.lockedCells = lockedCells;

      // Choose algorithm based on ML configuration
      if (mlConfig.algorithm === "ensemble") {
        console.log(
          `🧠 Using ensemble approach with algorithms: ${mlConfig.ensembleAlgorithms.join(", ")}`,
        );
        const ensembleResult = await this.generateWithEnsemble(
          workingSchedule,
          staffMembers,
          dateRange,
          mlConfig,
        );
        bestSchedule = ensembleResult.schedule;
        bestScore = ensembleResult.score;
        confidenceScore = ensembleResult.confidence;
        iterations = ensembleResult.iterations;
      } else {
        // Single algorithm approach
        console.log(`🔄 Using ${mlConfig.algorithm} with enhanced parameters`);
        const algorithmResult = await this.generateWithSingleAlgorithm(
          workingSchedule,
          staffMembers,
          dateRange,
          mlConfig,
        );
        bestSchedule = algorithmResult.schedule;
        bestScore = algorithmResult.score;
        confidenceScore = algorithmResult.confidence;
        iterations = algorithmResult.iterations;
      }

      const generationTime = Date.now() - startTime;

      // Calculate detailed quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(
        bestSchedule?.schedule || workingSchedule,
        staffMembers,
        dateRange,
      );

      // Update statistics with ML enhancements
      this.generationStats.totalGenerations++;
      this.generationStats.averageIterations =
        (this.generationStats.averageIterations + iterations) /
        this.generationStats.totalGenerations;

      if (bestSchedule && bestScore >= 80) {
        this.generationStats.successfulGenerations++;
      }

      this.generationStats.averageConstraintSatisfaction =
        (this.generationStats.averageConstraintSatisfaction + bestScore) /
        this.generationStats.totalGenerations;

      this.generationStats.averageConfidenceScore =
        (this.generationStats.averageConfidenceScore + confidenceScore) /
        this.generationStats.totalGenerations;

      // Store performance for adaptive learning
      this.generationStats.performanceHistory.push({
        timestamp: Date.now(),
        strategy,
        score: bestScore,
        confidence: confidenceScore,
        generationTime,
        iterations,
        qualityMetrics,
      });

      // Apply adaptive learning
      await this.applyAdaptiveLearning();

      // ✅ PHASE 1: Calendar rules now applied PRE-generation (no post-generation override needed)
      // This prevents AI decisions from being overwritten and ensures calendar compliance from the start
      let finalSchedule = bestSchedule?.schedule || workingSchedule;
      let combinedRulesApplied = lockingSummary ? true : false;
      let combinedRulesSummary = lockingSummary;

      // ✅ PHASE 2: Automatic violation repair
      let repairSummary = null;
      if (this.calendarRules || this.earlyShiftPreferences) {
        console.log("🔧 [PHASE 2] Running violation repair engine...");

        const repairEngine = new ViolationRepairEngine();
        const repairContext = {
          calendarRules: this.calendarRules,
          earlyShiftPreferences: this.earlyShiftPreferences,
          staffMembers,
          dateRange
        };

        const repairResult = await repairEngine.repairSchedule(finalSchedule, repairContext);
        finalSchedule = repairResult.schedule;
        repairSummary = repairResult.summary;

        console.log(`✅ [PHASE 2] Repair complete: ${repairSummary.repairedCount} violations fixed`);
      }

      const result = {
        success: bestSchedule !== null,
        schedule: finalSchedule,
        score: bestScore,
        confidence: confidenceScore,
        strategy: strategy,
        algorithm: mlConfig.algorithm,
        generationTime,
        iterations,
        qualityMetrics,
        constraintAnalysis: qualityMetrics.constraintAnalysis,
        combinedRulesApplied,
        combinedRulesSummary,
        repairSummary, // ✅ PHASE 2: Violation repair results
        metadata: {
          staffCount: staffMembers.length,
          dateCount: dateRange.length,
          preservedCells: preserveExisting
            ? this.countPreservedCells(existingSchedule)
            : 0,
          mlConfig: {
            preset: strategy,
            algorithm: mlConfig.algorithm,
            populationSize: mlConfig.populationSize,
            generations: mlConfig.generations,
            runtime: generationTime,
          },
          bestIteration: bestSchedule?.iteration || -1,
          monthlyProjections: this.monthlyBalancingEnabled
            ? this.getMonthlyProjectionSummary()
            : null,
        },
        statistics: { ...this.generationStats },
      };

      console.log(`✅ Schedule generation completed in ${generationTime}ms`);
      console.log(
        `📊 Best score: ${bestScore.toFixed(2)}% | Confidence: ${(confidenceScore * 100).toFixed(1)}% | Algorithm: ${mlConfig.algorithm}`,
      );
      console.log(`🎯 Quality metrics:`, qualityMetrics.summary);

      // ✅ PHASE 1: Clean up instance variables
      this.earlyShiftPreferences = null;
      this.calendarRules = null;
      this.lockedCells = null;

      return result;
    } catch (error) {
      console.error("❌ Schedule generation failed:", error);

      // ✅ PHASE 1: Clean up instance variables (error path)
      this.earlyShiftPreferences = null;
      this.calendarRules = null;
      this.lockedCells = null;

      return {
        success: false,
        error: error.message,
        schedule: existingSchedule,
        score: 0,
        generationTime: 0,
        iterations: 0,
      };
    }
  }

  /**
   * Initialize working schedule with existing data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} existingSchedule - Existing schedule data
   * @param {boolean} preserveExisting - Whether to preserve existing data
   * @returns {Object} Working schedule
   */
  initializeWorkingSchedule(
    staffMembers,
    dateRange,
    existingSchedule,
    preserveExisting,
  ) {
    const workingSchedule = {};

    staffMembers.forEach((staff) => {
      workingSchedule[staff.id] = {};

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];

        if (
          preserveExisting &&
          existingSchedule[staff.id] &&
          existingSchedule[staff.id][dateKey] !== undefined &&
          existingSchedule[staff.id][dateKey] !== ""
        ) {
          // Preserve existing data
          workingSchedule[staff.id][dateKey] =
            existingSchedule[staff.id][dateKey];
        } else {
          // Initialize with normal shift (empty string)
          workingSchedule[staff.id][dateKey] = "";
        }
      });
    });

    return workingSchedule;
  }

  /**
   * Priority-first generation strategy - Enhanced with dynamic priority rules
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async priorityFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;
    const appliedRules = [];

    console.log(
      "🎯 Applying enhanced priority-first strategy with dynamic rules...",
    );

    // Phase 1: Apply dynamic priority rules from configuration
    const priorityRules = await getPriorityRules();
    await this.applyDynamicPriorityRules(
      workingSchedule,
      staffMembers,
      dateRange,
      priorityRules,
      appliedRules,
    );

    // Phase 2: Apply legacy hardcoded priorities (for backward compatibility)
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Apply shift priorities for this date
      for (const [priorityId, priority] of this.shiftPriorities) {
        if (priority.condition(dateKey, workingSchedule, staffMembers)) {
          const staff = staffMembers.find((s) => s.name === priority.staff);
          if (staff && workingSchedule[staff.id]) {
            const currentShift = workingSchedule[staff.id][dateKey];
            // Only change if current shift is empty or we have higher priority
            if (currentShift === "" || priority.priority === "critical") {
              workingSchedule[staff.id][dateKey] = priority.shift;
              changesApplied++;
              appliedRules.push({
                type: "legacy",
                staffName: staff.name,
                date: dateKey,
                rule: priorityId,
                appliedShift: priority.shift,
              });
            }
          }
        }
      }
    });

    // Phase 2: Fill remaining positions with balanced approach
    for (const date of dateRange) {
      const dateKey = date.toISOString().split("T")[0];

      // Count current assignments for the day
      const dayCounts = this.countDayAssignments(
        workingSchedule,
        dateKey,
        staffMembers,
      );

      // Apply group constraints and daily limits
      // Calculate backup coverage needs for this date in priority-first strategy
      const backupCoverageNeeds = await this.calculateBackupCoverageNeeds(
        workingSchedule,
        dateKey,
        staffMembers,
      );

      for (const staff of staffMembers) {
        if (workingSchedule[staff.id][dateKey] === "") {
          // Assign based on constraints, balance, and backup considerations
          const suggestedShift = await this.suggestShiftForStaffWithBackup(
            staff,
            dateKey,
            workingSchedule,
            staffMembers,
            dayCounts,
            backupCoverageNeeds,
            dateRange,
          );

          // ✅ BUGFIX: Check for null/undefined explicitly (not falsy, since "" is valid normal shift)
          if (suggestedShift !== null && suggestedShift !== undefined) {
            // ✅ Final limit check before assignment (defense in depth)
            const limitsOK = await this.canAssignShift(
              staff,
              dateKey,
              suggestedShift,
              workingSchedule,
              dateRange,
            );
            if (limitsOK) {
              workingSchedule[staff.id][dateKey] = suggestedShift;
              changesApplied++;
            }
          }
        }
      }
    }

    // Apply backup staff assignments after main generation
    const finalSchedule = await this.applyBackupStaffAssignments(
      workingSchedule,
      staffMembers,
      dateRange,
    );

    return {
      schedule: finalSchedule,
      changesApplied,
      strategy: "priority_first",
      analysis: {
        priorityRulesApplied: this.countPriorityRulesApplied(
          finalSchedule,
          dateRange,
          staffMembers,
        ),
        appliedRules: appliedRules,
        dynamicRulesCount: appliedRules.filter((r) => r.type === "dynamic")
          .length,
        legacyRulesCount: appliedRules.filter((r) => r.type === "legacy")
          .length,
        balanceScore: this.calculateBalanceScore(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Balance-first generation strategy with predictive monthly balancing
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async balanceFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;

    console.log(
      "📋 Initializing balance-first strategy with predictive monthly balancing...",
    );

    // Initialize backup pre-planning for this strategy
    const backupPrePlanning = await this.initializeBackupPrePlanning(
      staffMembers,
      dateRange,
      {},
    );

    // Enhanced monthly limits calculation with predictive balancing
    const monthlyLimits = await this.calculateEnhancedMonthlyLimits(dateRange);
    const monthlyProjections = await this.calculateMonthlyProjections(
      workingSchedule,
      staffMembers,
      dateRange,
    );

    const staffOffDayBudgets = new Map();
    const staffWorkloadProjections = new Map();

    staffMembers.forEach((staff) => {
      const projection = monthlyProjections.get(staff.id);
      const currentOffDays = this.countStaffOffDays(
        workingSchedule[staff.id],
        dateRange,
      );

      // Calculate budget with predictive balancing
      const remainingDays =
        dateRange.length -
        this.countFilledDays(workingSchedule[staff.id], dateRange);
      const projectedOffDayNeed = projection
        ? projection.recommendedOffDays - currentOffDays
        : 0;
      const adjustedBudget = Math.max(
        0,
        Math.min(
          monthlyLimits.maxOffDaysPerMonth - currentOffDays,
          projectedOffDayNeed,
          Math.floor(remainingDays * 0.4), // Max 40% of remaining days as off days
        ),
      );

      staffOffDayBudgets.set(staff.id, adjustedBudget);
      staffWorkloadProjections.set(staff.id, projection);

      console.log(
        `📋 ${staff.name}: Current off days: ${currentOffDays}, Budget: ${adjustedBudget}, Projected need: ${projectedOffDayNeed}`,
      );
    });

    // Sort dates by difficulty (weekends first, then special constraint days)
    const sortedDates = [...dateRange].sort((a, b) => {
      const aDifficulty = this.calculateDateDifficulty(a);
      const bDifficulty = this.calculateDateDifficulty(b);
      return bDifficulty - aDifficulty;
    });

    // Fill schedule date by date, balancing as we go
    for (const date of sortedDates) {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      // Sort staff by current workload (lowest first)
      const staffByWorkload = [...staffMembers].sort((a, b) => {
        const aWorkload = this.calculateStaffWorkload(
          workingSchedule[a.id],
          dateRange,
        );
        const bWorkload = this.calculateStaffWorkload(
          workingSchedule[b.id],
          dateRange,
        );
        return aWorkload - bWorkload;
      });

      // Assign shifts for this day with priority rules consideration
      let assignedCount = 0;
      const dailyLimits = await getDailyLimits();
      const maxOffPerDay =
        dailyLimits.find((l) => l.shiftType === "off")?.maxCount || 4;

      // Calculate backup coverage needs for this date in balance-first strategy
      const backupCoverageNeeds = await this.calculateBackupCoverageNeeds(
        workingSchedule,
        dateKey,
        staffMembers,
      );

      for (const staff of staffByWorkload) {
        if (workingSchedule[staff.id][dateKey] === "") {
          const staffOffBudget = staffOffDayBudgets.get(staff.id) || 0;
          const currentDayOffCount = this.countDayOffAssignments(
            workingSchedule,
            dateKey,
            staffMembers,
          );

          // First, check if priority rules apply
          const priorityShift = await this.checkDynamicPriorityRules(
            staff,
            dateKey,
            workingSchedule,
            staffMembers,
          );

          let assignedShift = "";

          if (priorityShift) {
            // Priority rule overrides balance considerations
            assignedShift = priorityShift;
            console.log(
              `🎯 Priority rule applied for ${staff.name} on ${dateKey}: ${priorityShift}`,
            );
          } else {
            // Use predictive balance-based logic for non-priority assignments
            const projection = staffWorkloadProjections.get(staff.id);

            // Consider giving day off if under budget and daily limit allows
            if (
              staffOffBudget > 0 &&
              currentDayOffCount < maxOffPerDay &&
              assignedCount < staffMembers.length - 3
            ) {
              let shouldGiveOffDay = false;

              // Use monthly projection for more intelligent off day decisions
              if (projection) {
                // High priority staff (unbalanced) get preference for off days
                const needsOffDay =
                  projection.recommendations.priority === "high" &&
                  projection.projections.offDaysNeeded > 0;

                // Also consider current workload vs projection
                const isOverworked =
                  projection.currentStats.currentWorkRate >
                  projection.targets.targetWorkRate + 0.1;

                shouldGiveOffDay = needsOffDay || isOverworked;

                if (shouldGiveOffDay) {
                  console.log(
                    `📋 Predictive balancing: Giving off day to ${staff.name} (priority: ${projection.recommendations.priority})`,
                  );
                }
              } else {
                // Fallback to original logic if no projection available
                const workload = this.calculateStaffWorkload(
                  workingSchedule[staff.id],
                  dateRange,
                );
                const avgWorkload = this.calculateAverageWorkload(
                  workingSchedule,
                  staffMembers,
                  dateRange,
                );

                shouldGiveOffDay = workload > avgWorkload * 1.1;
              }

              if (shouldGiveOffDay) {
                assignedShift = "×";
                staffOffDayBudgets.set(staff.id, staffOffBudget - 1);
              }
            }

            // If not assigned day off, assign working shift with backup considerations
            if (assignedShift === "") {
              assignedShift = await this.selectWorkingShiftWithBackup(
                staff,
                dateKey,
                workingSchedule,
                staffMembers,
                backupCoverageNeeds,
              );
            }
          }

          // ✅ Check weekly/monthly limits before assignment
          const limitsOK = await this.canAssignShift(
            staff,
            dateKey,
            assignedShift,
            workingSchedule,
            dateRange,
          );
          if (limitsOK) {
            workingSchedule[staff.id][dateKey] = assignedShift;
            changesApplied++;
            assignedCount++;
          }
        }
      }
    }

    // Apply backup staff assignments after main generation
    const finalSchedule = await this.applyBackupStaffAssignments(
      workingSchedule,
      staffMembers,
      dateRange,
    );

    return {
      schedule: finalSchedule,
      changesApplied,
      strategy: "balance_first",
      analysis: {
        balanceScore: this.calculateBalanceScore(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
        workloadVariance: this.calculateWorkloadVariance(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
        offDayDistribution: this.calculateOffDayDistribution(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
        monthlyProjections: Array.from(monthlyProjections.entries()).map(
          ([staffId, projection]) => {
            const staff = staffMembers.find((s) => s.id === staffId);
            return {
              staffId,
              staffName: staff?.name || "Unknown",
              ...projection,
            };
          },
        ),
        predictiveBalancingUsed: this.monthlyBalancingEnabled,
        backupStaffIntegration: {
          enabled: true,
          backupAssignmentsConsidered: backupPrePlanning?.enabled || false,
          totalBackupStaff: backupPrePlanning?.totalBackupStaff || 0,
        },
      },
    };
  }

  /**
   * Pattern-based generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async patternBasedStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;
    let patternMatches = 0;

    // Fill based on learned patterns
    for (const date of dateRange) {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      for (const staff of staffMembers) {
        if (workingSchedule[staff.id][dateKey] === "") {
          // Check priority rules first (highest precedence)
          const priorityShift = await this.checkDynamicPriorityRules(
            staff,
            dateKey,
            workingSchedule,
            staffMembers,
          );

          if (priorityShift) {
            // ✅ Check weekly/monthly limits before applying priority shift
            const limitsOK = await this.canAssignShift(
              staff,
              dateKey,
              priorityShift,
              workingSchedule,
              dateRange,
            );
            if (limitsOK) {
              workingSchedule[staff.id][dateKey] = priorityShift;
              changesApplied++;
              console.log(
                `🎯 Priority rule applied in pattern strategy for ${staff.name}`,
              );
              continue;
            }
          }

          // If no priority rule, use pattern-based prediction
          const staffPattern = this.staffPatterns.get(staff.id);
          if (staffPattern) {
            const suggestedShift = this.predictShiftFromPattern(
              staff,
              dateKey,
              dayOfWeek,
              staffPattern,
              workingSchedule,
            );

            // ✅ BUGFIX: Check for null/undefined explicitly (not falsy, since "" is valid normal shift)
            if (suggestedShift !== null && suggestedShift !== undefined) {
              // Validate against constraints and limits before applying
              if (
                await this.validateShiftAssignment(
                  staff,
                  dateKey,
                  suggestedShift,
                  workingSchedule,
                  staffMembers,
                  dateRange,
                )
              ) {
                workingSchedule[staff.id][dateKey] = suggestedShift;
                changesApplied++;
                patternMatches++;
              }
            }
          }
        }
      }
    }

    // Fill remaining empty slots with balanced approach
    const remaining = this.fillRemainingSlots(
      workingSchedule,
      staffMembers,
      dateRange,
    );
    changesApplied += remaining.changesApplied;

    // Apply backup staff assignments after main generation
    const finalSchedule = await this.applyBackupStaffAssignments(
      workingSchedule,
      staffMembers,
      dateRange,
    );

    return {
      schedule: finalSchedule,
      changesApplied,
      strategy: "pattern_based",
      analysis: {
        patternMatches,
        patternMatchRate:
          staffMembers.length > 0
            ? patternMatches / (staffMembers.length * dateRange.length)
            : 0,
        balanceScore: this.calculateBalanceScore(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Suggest optimal shift for a staff member on a specific date
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - All staff members
   * @param {Object} dayCounts - Current day assignments count
   * @returns {string} Suggested shift
   */
  /**
   * Suggest shift for staff with backup considerations
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - All staff members
   * @param {Object} dayCounts - Current day assignments count
   * @param {Object} backupCoverageNeeds - Backup coverage analysis
   * @returns {string} Suggested shift
   */
  async suggestShiftForStaffWithBackup(
    staff,
    dateKey,
    schedule,
    staffMembers,
    dayCounts,
    backupCoverageNeeds,
    dateRange = [],
  ) {
    const dayOfWeek = getDayOfWeek(dateKey);

    // Check dynamic priority rules first
    const dynamicPriorityShift = await this.checkDynamicPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );
    if (dynamicPriorityShift) return dynamicPriorityShift;

    // Check legacy priority rules
    const priorityShift = this.checkPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );
    if (priorityShift) return priorityShift;

    // Check if this staff member is needed for backup coverage
    const isBackupStaff = backupCoverageNeeds.backupStaffRequired.includes(
      staff.id,
    );
    const criticalGroup = backupCoverageNeeds.criticalGroups.find((group) =>
      group.backupStaff.some((backup) => backup.staffId === staff.id),
    );

    if (isBackupStaff && criticalGroup) {
      console.log(
        `🔄 Backup staff ${staff.name} required for critical group ${criticalGroup.groupName}`,
      );

      // Backup staff should generally work when needed
      // Reduce probability of off days for backup staff during critical coverage
      const offDayProbability = Math.max(
        0.05,
        0.15 - criticalGroup.criticality * 0.05,
      );

      if (Math.random() > offDayProbability) {
        // Choose working shift for backup staff
        return await this.selectWorkingShiftWithBackup(
          staff,
          dateKey,
          schedule,
          staffMembers,
          backupCoverageNeeds,
        );
      }
    }

    // Continue with regular logic
    return await this.suggestShiftForStaff(
      staff,
      dateKey,
      schedule,
      staffMembers,
      dayCounts,
      dateRange,
    );
  }

  async suggestShiftForStaff(
    staff,
    dateKey,
    schedule,
    staffMembers,
    dayCounts,
    dateRange = [],
  ) {
    const dayOfWeek = getDayOfWeek(dateKey);

    // Check dynamic priority rules first
    const dynamicPriorityShift = await this.checkDynamicPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );
    if (dynamicPriorityShift) return dynamicPriorityShift;

    // Check legacy priority rules
    const priorityShift = this.checkPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );
    if (priorityShift) return priorityShift;

    // Check monthly off day budget
    const monthlyLimits = this.calculateMonthlyLimits([new Date(dateKey)]);
    const currentOffDays = this.countStaffOffDays(schedule[staff.id], [
      new Date(dateKey),
    ]);
    // Get configured daily limits
    const dailyLimits = await getDailyLimits();
    const maxOffPerDay =
      dailyLimits.find((l) => l.shiftType === "off")?.maxCount || 2;

    const canTakeOffDay =
      currentOffDays < monthlyLimits.maxOffDaysPerMonth &&
      dayCounts.off < maxOffPerDay;

    // Check group constraints
    const hasGroupConflict = await this.checkGroupConflicts(
      staff,
      dateKey,
      "×",
      schedule,
      staffMembers,
    );

    // ===== HARD CONSTRAINT: 5-Day Rest Rule =====
    // Check if staff needs rest (no × or △ in last 5 days)
    const restDaysInWindow = this.countRestDays(staff, dateKey, schedule, 5);
    const needsRest = restDaysInWindow === 0;

    if (needsRest) {
      console.log(
        `⚠️ [5-DAY-REST] ${staff.name}: No × or △ in last 5 days - MUST assign rest`,
      );

      // Priority 1: Try × (off day) if no group conflict
      if (!hasGroupConflict) {
        // ✅ ADJACENT CONFLICT CHECK: Prevent × next to △ (early shifts)
        const hasAdjacentConflict = this.hasAdjacentConflict(
          staff,
          dateKey,
          "×",
          schedule,
        );
        if (!hasAdjacentConflict) {
          const offDayOK = await this.canAssignShift(
            staff,
            dateKey,
            "×",
            schedule,
            dateRange,
          );
          if (offDayOK) {
            console.log(`✅ [5-DAY-REST] ${staff.name}: Assigned × (off day)`);
            return "×";
          }
          console.log(
            `⚠️ [5-DAY-REST] ${staff.name}: × blocked by weekly limit`,
          );
        } else {
          console.log(
            `⏭️ [5-DAY-REST] ${staff.name}: × blocked by adjacent early shift conflict`,
          );
        }
      } else {
        console.log(
          `⚠️ [5-DAY-REST] ${staff.name}: × blocked by group conflict`,
        );
      }

      // Priority 2: Try △ (early shift) as fallback - ONLY for 社員
      if (this.isEligibleForEarlyShift(staff)) {
        // ✅ ADJACENT CONFLICT CHECK: Prevent △ next to × (off days)
        const hasAdjacentConflict = this.hasAdjacentConflict(
          staff,
          dateKey,
          "△",
          schedule,
        );
        if (!hasAdjacentConflict) {
          const earlyShiftOK = await this.canAssignShift(
            staff,
            dateKey,
            "△",
            schedule,
            dateRange,
          );
          if (earlyShiftOK) {
            console.log(
              `✅ [5-DAY-REST] ${staff.name}: Assigned △ (early shift rest)`,
            );
            return "△";
          }
          console.log(`⚠️ [5-DAY-REST] ${staff.name}: △ also blocked by limits`);
        } else {
          console.log(
            `⏭️ [5-DAY-REST] ${staff.name}: △ blocked by adjacent off day conflict`,
          );
        }
      } else {
        console.log(
          `⏭️ [5-DAY-REST] ${staff.name} (${staff.status}): Early shift not allowed for non-社員 staff`,
        );
      }

      // Both × and △ blocked: Log conflict, continue to normal assignment
      console.warn(
        `❌ [CONFLICT] ${staff.name}: 5-day rest needed but × and △ blocked. ` +
          `Assigning normal shift to respect limit priority.`,
      );
      // Fall through to normal assignment below
    }

    // Assign working shift based on day and needs
    // Get early shift limit from configuration
    const maxEarlyPerDay =
      dailyLimits.find((l) => l.shiftType === "early")?.maxCount || 3;

    // ✅ Special case: Head chef Sunday early shift (only if 社員)
    if (
      dayOfWeek === "sunday" &&
      staff.name === "料理長" &&
      this.isEligibleForEarlyShift(staff) &&
      dayCounts.early < maxEarlyPerDay
    ) {
      // ✅ ADJACENT CONFLICT CHECK: Prevent △ next to × (off days)
      const hasAdjacentConflict = this.hasAdjacentConflict(
        staff,
        dateKey,
        "△",
        schedule,
      );
      if (!hasAdjacentConflict) {
        // Check group conflict for early shift
        const hasEarlyGroupConflict = await this.checkGroupConflicts(
          staff,
          dateKey,
          "△",
          schedule,
          staffMembers,
        );
        if (!hasEarlyGroupConflict) {
          // ✅ Check weekly/monthly limits before assigning early shift
          const limitsOK = await this.canAssignShift(
            staff,
            dateKey,
            "△",
            schedule,
            dateRange,
          );
          if (limitsOK) {
            return "△"; // Early shift for head chef on Sunday
          }
        }
      }
    }

    // ✅ WEEKLY EARLY SHIFT LIMIT: Check if staff already has 1 early shift this week
    const earlyShiftsThisWeek = this.countEarlyShiftsInWeek(
      staff,
      dateKey,
      schedule,
    );

    if (earlyShiftsThisWeek >= 1) {
      // Staff already has 1 early shift this week, skip △ assignment
      console.log(
        `⏭️ [WEEKLY-EARLY-LIMIT] ${staff.name}: Already has ${earlyShiftsThisWeek} early shift(s) this week, skipping △`,
      );
    } else if (
      // ✅ EARLY SHIFT ELIGIBILITY: Only 社員 staff can work early shifts
      this.isEligibleForEarlyShift(staff) &&
      dayCounts.early < maxEarlyPerDay &&
      Math.random() < 0.2 // Reduced from 0.3 to 0.2 (20% probability)
    ) {
      // ✅ ADJACENT CONFLICT CHECK: Prevent △ next to × (off days)
      const hasAdjacentConflict = this.hasAdjacentConflict(
        staff,
        dateKey,
        "△",
        schedule,
      );
      if (hasAdjacentConflict) {
        // Skip △ assignment due to adjacent × (off day)
        console.log(
          `⏭️ [ADJACENT-SKIP] ${staff.name}: Skipping △ due to adjacent off day`,
        );
      } else {
        // Check group conflict for early shift
        const hasEarlyGroupConflict = await this.checkGroupConflicts(
          staff,
          dateKey,
          "△",
          schedule,
          staffMembers,
        );
        if (!hasEarlyGroupConflict) {
          // ✅ Check weekly/monthly limits before assigning early shift
          const limitsOK = await this.canAssignShift(
            staff,
            dateKey,
            "△",
            schedule,
            dateRange,
          );
          if (limitsOK) {
            return "△"; // Early shift
          }
        }
      }
    }

    // Get late shift limit from configuration
    const maxLatePerDay =
      dailyLimits.find((l) => l.shiftType === "late")?.maxCount || 3;

    if (dayCounts.late < maxLatePerDay && Math.random() < 0.2) {
      // ✅ Check weekly/monthly limits before assigning late shift
      const limitsOK = await this.canAssignShift(
        staff,
        dateKey,
        "◇",
        schedule,
        dateRange,
      );
      if (limitsOK) {
        return "◇"; // Late shift
      }
    }

    return ""; // Normal shift
  }

  /**
   * Count rest days (off days × or early shifts △) for a staff member in the last N days
   * Used to enforce "within 5 days, staff should have at least 1 rest day" rule
   * @param {Object} staff - Staff member
   * @param {string} currentDate - Current date being evaluated (YYYY-MM-DD)
   * @param {Object} schedule - Current schedule state
   * @param {number} lookbackDays - Number of days to look back (default: 5)
   * @returns {number} Count of rest days (× or △) in the lookback window
   */
  countRestDays(staff, currentDate, schedule, lookbackDays = 5) {
    try {
      const staffSchedule = schedule[staff.id];
      if (!staffSchedule) return 0;

      const currentDateObj = new Date(currentDate);
      let restDayCount = 0;

      // Look back N days from current date (not including current date)
      for (let i = 1; i <= lookbackDays; i++) {
        const checkDate = new Date(currentDateObj);
        checkDate.setDate(checkDate.getDate() - i);
        const checkDateKey = checkDate.toISOString().split("T")[0];

        const shift = staffSchedule[checkDateKey];

        // Count × (off days) or △ (early shifts) as rest days
        if (shift === "×" || shift === "△") {
          restDayCount++;
        }
      }

      return restDayCount;
    } catch (error) {
      console.warn(
        `⚠️ [REST-COUNT] Error counting rest days for ${staff.name}:`,
        error,
      );
      return 0; // Safe fallback
    }
  }

  /**
   * Count early shifts (△) for a staff member in a rolling 7-day window
   * Used to enforce max 1 early shift per week per staff member
   * @param {Object} staff - Staff member object
   * @param {string} currentDate - Current date being evaluated (YYYY-MM-DD)
   * @param {Object} schedule - Current schedule state
   * @returns {number} Count of early shifts in the rolling 7-day window
   */
  countEarlyShiftsInWeek(staff, currentDate, schedule) {
    try {
      const staffSchedule = schedule[staff.id];
      if (!staffSchedule) return 0;

      const currentDateObj = new Date(currentDate);
      let earlyShiftCount = 0;

      // Check 7-day rolling window (3 days before + today + 3 days after)
      for (let i = -3; i <= 3; i++) {
        const checkDate = new Date(currentDateObj);
        checkDate.setDate(checkDate.getDate() + i);
        const checkDateKey = checkDate.toISOString().split("T")[0];

        const shift = staffSchedule[checkDateKey];

        // Count △ (early shifts)
        if (shift === "△") {
          earlyShiftCount++;
        }
      }

      return earlyShiftCount;
    } catch (error) {
      console.warn(
        `⚠️ [EARLY-COUNT] Error counting early shifts for ${staff.name}:`,
        error,
      );
      return 0; // Safe fallback
    }
  }

  /**
   * Check if previous days have conflicting shift patterns
   * Prevents consecutive off days (×) and early shifts (△) for better rotation
   * Checks previous 2 days only (sequential generation means future days are empty)
   * @param {Object} staff - Staff member object
   * @param {string} currentDate - Current date being evaluated (YYYY-MM-DD)
   * @param {string} proposedShift - Shift being proposed (△ or ×)
   * @param {Object} schedule - Current schedule state
   * @returns {boolean} True if previous days have conflicting pattern
   */
  hasAdjacentConflict(staff, currentDate, proposedShift, schedule) {
    try {
      const staffSchedule = schedule[staff.id];
      if (!staffSchedule) return false;

      const currentDateObj = new Date(currentDate);

      // Check previous 2 days only (sequential generation - future days are empty)
      const daysToCheck = [-1, -2]; // -1 = yesterday, -2 = day before yesterday

      for (const offset of daysToCheck) {
        const adjacentDate = new Date(currentDateObj);
        adjacentDate.setDate(adjacentDate.getDate() + offset);
        const adjacentDateKey = adjacentDate.toISOString().split("T")[0];

        const adjacentShift = staffSchedule[adjacentDateKey];

        // If proposing △ (early shift), check if previous day is × (off day)
        if (proposedShift === "△" && adjacentShift === "×") {
          console.log(
            `⏭️ [ADJACENT-CONFLICT] ${staff.name}: Cannot assign △ on ${currentDate}, previous day ${adjacentDateKey} is ×`,
          );
          return true;
        }

        // If proposing × (off day), check if previous day is △ (early shift)
        if (proposedShift === "×" && adjacentShift === "△") {
          console.log(
            `⏭️ [ADJACENT-CONFLICT] ${staff.name}: Cannot assign × on ${currentDate}, previous day ${adjacentDateKey} is △`,
          );
          return true;
        }
      }

      return false; // No conflict found
    } catch (error) {
      console.warn(
        `⚠️ [ADJACENT-CHECK] Error checking adjacent conflicts for ${staff.name}:`,
        error,
      );
      return false; // Safe fallback - allow assignment
    }
  }

  /**
   * Check if assigning an early shift would create consecutive early shifts
   * Prevents △△ pattern which is undesirable for staff scheduling
   * @param {Object} staff - Staff member object
   * @param {string} currentDate - Current date being evaluated (YYYY-MM-DD)
   * @param {string} proposedShift - Shift being proposed (should be △)
   * @param {Object} schedule - Current schedule state
   * @returns {boolean} True if would create consecutive △, false otherwise
   */
  hasConsecutiveEarlyShift(staff, currentDate, proposedShift, schedule) {
    try {
      // Only check if proposing early shift
      if (proposedShift !== "△") {
        return false;
      }

      const staffSchedule = schedule[staff.id];
      if (!staffSchedule) return false;

      const currentDateObj = new Date(currentDate);

      // Check previous 2 days (sequential generation - future days are empty)
      const daysToCheck = [-1, -2]; // -1 = yesterday, -2 = day before yesterday

      for (const offset of daysToCheck) {
        const adjacentDate = new Date(currentDateObj);
        adjacentDate.setDate(adjacentDate.getDate() + offset);
        const adjacentDateKey = adjacentDate.toISOString().split("T")[0];

        const adjacentShift = staffSchedule[adjacentDateKey];

        // If previous day has △, proposing △ would create consecutive early shifts
        if (adjacentShift === "△") {
          console.log(
            `⏭️ [CONSECUTIVE-EARLY-SHIFT] ${staff.name}: Cannot assign △ on ${currentDate}, ` +
            `previous day ${adjacentDateKey} already has △ (prevents △△ pattern)`
          );
          return true;
        }
      }

      return false; // No consecutive early shift conflict
    } catch (error) {
      console.warn(
        `⚠️ [CONSECUTIVE-EARLY-CHECK] Error checking consecutive early shifts for ${staff.name}:`,
        error
      );
      return false; // Safe fallback - allow assignment
    }
  }

  /**
   * Apply random mutation to schedule for genetic-like variation
   * @param {Object} schedule - Schedule to mutate
   * @param {number} mutationRate - Rate of mutation (0-1)
   * @returns {Object} Mutated schedule
   */
  applyRandomMutation(schedule, mutationRate = 0.1) {
    const mutated = JSON.parse(JSON.stringify(schedule));

    Object.keys(mutated).forEach((staffId) => {
      Object.keys(mutated[staffId]).forEach((dateKey) => {
        if (Math.random() < mutationRate) {
          const currentShift = mutated[staffId][dateKey];
          // Only mutate non-empty shifts (preserve manually set empty cells)
          if (currentShift !== "" && currentShift !== undefined) {
            const possibleShifts = ["", "△", "◇", "×"];
            const newShift =
              possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
            mutated[staffId][dateKey] = newShift;
          }
        }
      });
    });

    return mutated;
  }

  /**
   * Evaluate schedule quality with enhanced ML scoring
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Evaluation options
   * @returns {number} Score from 0-100
   */
  async evaluateSchedule(schedule, staffMembers, dateRange, options = {}) {
    const baseScore = 100;
    let penalties = 0;
    let bonuses = 0;

    // Get backup assignments from settings (would be passed from actual implementation)
    const backupAssignments = options.backupAssignments || [];

    const validation = await validateAllConstraints(
      schedule,
      staffMembers,
      dateRange,
      backupAssignments,
    );

    // Constraint violation penalties with weighted importance
    penalties +=
      validation.summary.criticalViolations *
      25 *
      this.constraintWeights.dailyLimits;
    penalties +=
      validation.summary.highViolations *
      15 *
      this.constraintWeights.staffGroups;
    penalties +=
      validation.summary.mediumViolations *
      8 *
      this.constraintWeights.priorityRules;

    // ✅ NEW: Weekly limits violation penalties (rolling 7-day windows)
    const weeklyViolations = validation.violations.filter(v =>
      v.type === VIOLATION_TYPES.WEEKLY_OFF_LIMIT ||
      v.type === VIOLATION_TYPES.WEEKLY_EARLY_LIMIT ||
      v.type === VIOLATION_TYPES.WEEKLY_LATE_LIMIT
    );
    weeklyViolations.forEach(violation => {
      // High penalty for weekly off limit violations (critical for staff health)
      if (violation.type === VIOLATION_TYPES.WEEKLY_OFF_LIMIT) {
        penalties += 20 * this.constraintWeights.weeklyLimits;
      }
      // Medium penalty for early/late shift weekly violations
      else {
        penalties += 10 * this.constraintWeights.weeklyLimits;
      }
    });

    // ✅ NEW: Early shift restriction violation penalties
    if (options.earlyShiftPreferences && Object.keys(options.earlyShiftPreferences).length > 0) {
      const earlyShiftValidation = EarlyShiftPreferencesLoader.validateSchedule(
        schedule,
        options.earlyShiftPreferences
      );

      if (!earlyShiftValidation.isValid) {
        // Very heavy penalty - this is a critical constraint violation
        // Staff cannot be assigned early shifts without explicit permission
        const violationCount = earlyShiftValidation.violationCount;
        penalties += violationCount * 100 * (this.constraintWeights.earlyShiftRestrictions || 1.0);

        console.warn(
          `⚠️ [ScheduleGen] Early shift restriction violations: ${violationCount}`
        );
      }
    }

    // ✅ NEW: Calendar rule violation penalties (must_work, must_day_off)
    if (options.calendarRules && Object.keys(options.calendarRules).length > 0) {
      const calendarValidation = CalendarRulesLoader.validateSchedule(
        schedule,
        options.calendarRules,
        staffMembers
      );

      if (!calendarValidation.isValid) {
        // Very heavy penalty - calendar rules are mandatory constraints
        const violationCount = calendarValidation.violationCount;
        const mustWorkViolations = calendarValidation.mustWorkViolations;
        const mustDayOffViolations = calendarValidation.mustDayOffViolations;

        // Different penalties for different rule types
        penalties += mustWorkViolations * 100 * (this.constraintWeights.calendarRules || 1.0);
        penalties += mustDayOffViolations * 100 * (this.constraintWeights.calendarRules || 1.0);

        console.warn(
          `⚠️ [ScheduleGen] Calendar rule violations: ${violationCount} (${mustWorkViolations} must_work, ${mustDayOffViolations} must_day_off)`
        );
      }
    }

    // ✅ NEW: Phase 3 - Combined calendar rules + early shift preferences validation
    if (
      options.calendarRules &&
      options.earlyShiftPreferences &&
      Object.keys(options.calendarRules).length > 0 &&
      Object.keys(options.earlyShiftPreferences).length > 0
    ) {
      const combinedValidation = CalendarEarlyShiftIntegrator.validateCombinedRules(
        schedule,
        options.calendarRules,
        options.earlyShiftPreferences,
        staffMembers
      );

      if (!combinedValidation.isValid) {
        // Heavy penalty for violating combined rules
        // This ensures staff with early shift permission get △ on must_day_off dates
        const violationCount = combinedValidation.violationCount;
        penalties += violationCount * 80 * (this.constraintWeights.calendarRules || 1.0);

        console.warn(
          `⚠️ [ScheduleGen] Combined rule violations (Phase 3): ${violationCount}`
        );
      }
    }

    // Enhanced scoring components
    const balanceScore = this.calculateBalanceScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const priorityScore = this.calculatePriorityScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const fairnessScore = this.calculateFairnessScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const efficiencyScore = this.calculateEfficiencyScore(
      schedule,
      staffMembers,
      dateRange,
    );

    // Apply weighted penalties
    if (balanceScore < 70) penalties += (70 - balanceScore) * 0.4;
    if (priorityScore < 80) penalties += (80 - priorityScore) * 0.3;
    if (fairnessScore < 75) penalties += (75 - fairnessScore) * 0.25;
    if (efficiencyScore < 85) penalties += (85 - efficiencyScore) * 0.15;

    // Bonus for high performance in all areas
    if (balanceScore > 90 && priorityScore > 90 && fairnessScore > 90) {
      bonuses += 5; // Synergy bonus
    }

    return Math.max(0, Math.min(100, baseScore - penalties + bonuses));
  }

  /**
   * Calculate balance score based on workload distribution
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Balance score 0-100
   */
  calculateBalanceScore(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );

    if (workloads.length === 0) return 100;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance =
      workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) /
      workloads.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = better balance
    const balanceScore = Math.max(0, 100 - stdDev * 10);
    return balanceScore;
  }

  /**
   * Calculate staff workload (working days / total days)
   * @param {Object} staffSchedule - Staff schedule
   * @param {Array} dateRange - Date range
   * @returns {number} Workload ratio
   */
  calculateStaffWorkload(staffSchedule, dateRange) {
    if (!staffSchedule) return 0;

    let workingDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];
      if (shift !== undefined && !isOffDay(shift)) {
        workingDays++;
      }
    });

    return dateRange.length > 0 ? workingDays / dateRange.length : 0;
  }

  /**
   * Calculate priority rules satisfaction score
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Priority score 0-100
   */
  calculatePriorityScore(schedule, staffMembers, dateRange) {
    let totalRules = 0;
    let satisfiedRules = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      // Check priority rules
      Object.keys(PRIORITY_RULES).forEach((staffName) => {
        const staff = staffMembers.find((s) => s.name === staffName);
        if (
          staff &&
          schedule[staff.id] &&
          schedule[staff.id][dateKey] !== undefined
        ) {
          const rules = PRIORITY_RULES[staffName];

          rules.preferredShifts.forEach((rule) => {
            if (rule.day === dayOfWeek) {
              totalRules++;
              const currentShift = schedule[staff.id][dateKey];

              let ruleSatisfied = false;
              switch (rule.shift) {
                case "early":
                  ruleSatisfied = isEarlyShift(currentShift);
                  break;
                case "off":
                  ruleSatisfied = isOffDay(currentShift);
                  break;
                case "late":
                  ruleSatisfied = isLateShift(currentShift);
                  break;
                default:
                  ruleSatisfied = isNormalShift(currentShift);
              }

              if (ruleSatisfied) satisfiedRules++;
            }
          });
        }
      });
    });

    return totalRules > 0 ? (satisfiedRules / totalRules) * 100 : 100;
  }

  // Helper methods for calculations and validations
  async calculateMonthlyLimits(dateRange) {
    if (dateRange.length === 0) return { maxOffDaysPerMonth: 7 };
    const firstDate = dateRange[0];
    try {
      return await getMonthlyLimits(
        firstDate.getFullYear(),
        firstDate.getMonth() + 1,
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to get monthly limits from configuration, using calculation:",
        error,
      );
      return {
        maxOffDaysPerMonth: Math.ceil(dateRange.length * 0.25),
        minWorkDaysPerMonth: Math.floor(dateRange.length * 0.75),
      };
    }
  }

  countDayAssignments(schedule, dateKey, staffMembers) {
    const counts = { off: 0, early: 0, late: 0, normal: 0, working: 0 };

    staffMembers.forEach((staff) => {
      if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
        const shift = schedule[staff.id][dateKey];
        if (isOffDay(shift)) counts.off++;
        else if (isEarlyShift(shift)) counts.early++;
        else if (isLateShift(shift)) counts.late++;
        else counts.normal++;

        if (isWorkingShift(shift)) counts.working++;
      }
    });

    return counts;
  }

  countStaffOffDays(staffSchedule, dateRange) {
    if (!staffSchedule) return 0;

    let offDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      if (staffSchedule[dateKey] && isOffDay(staffSchedule[dateKey])) {
        offDays++;
      }
    });

    return offDays;
  }

  countPreservedCells(existingSchedule) {
    let count = 0;
    Object.values(existingSchedule).forEach((staffSchedule) => {
      Object.values(staffSchedule).forEach((shift) => {
        if (shift !== undefined && shift !== "") count++;
      });
    });
    return count;
  }

  /**
   * Apply dynamic priority rules from configuration during generation
   * @param {Object} schedule - Working schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Array} priorityRules - Priority rules from configuration
   * @param {Array} appliedRules - Array to track applied rules
   */
  async applyDynamicPriorityRules(
    schedule,
    staffMembers,
    dateRange,
    priorityRules,
    appliedRules,
  ) {
    if (!Array.isArray(priorityRules) || priorityRules.length === 0) {
      console.log("📋 No dynamic priority rules configured");
      return;
    }

    console.log(
      `🎯 Applying ${priorityRules.length} dynamic priority rules...`,
    );

    // Sort rules by priority level (higher priority first)
    const sortedRules = priorityRules
      .filter((rule) => rule.isActive !== false)
      .sort((a, b) => (b.priorityLevel || 0) - (a.priorityLevel || 0));

    for (const rule of sortedRules) {
      // Find the staff member for this rule
      const staff = staffMembers.find(
        (s) => s.id === rule.staffId || s.name === rule.staffId,
      );

      if (!staff) {
        console.warn(`⚠️ Staff not found for rule: ${rule.name}`);
        continue;
      }

      // Apply rule to relevant dates
      for (const date of dateRange) {
        const dateKey = date.toISOString().split("T")[0];
        const dayOfWeek = date.getDay();

        // Check if rule applies to this day of week
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          if (!rule.daysOfWeek.includes(dayOfWeek)) {
            continue;
          }
        }

        // Check if rule is within effective date range
        if (
          rule.effectiveFrom &&
          new Date(dateKey) < new Date(rule.effectiveFrom)
        ) {
          continue;
        }
        if (
          rule.effectiveUntil &&
          new Date(dateKey) > new Date(rule.effectiveUntil)
        ) {
          continue;
        }

        const currentShift = schedule[staff.id]?.[dateKey];
        let targetShift = null;

        // Determine target shift based on rule type
        switch (rule.ruleType) {
          case "required_off":
            targetShift = "×";
            break;
          case "preferred_shift":
            targetShift = this.mapShiftTypeToSymbol(rule.shiftType);
            break;
          case "avoid_shift":
            // For avoid rules, we skip if current shift matches what to avoid
            if (currentShift === this.mapShiftTypeToSymbol(rule.shiftType)) {
              continue;
            }
            break;
          default:
            continue;
        }

        // Apply the rule if conditions are met
        if (targetShift !== null) {
          const shouldApply = this.shouldApplyPriorityRule(
            rule,
            currentShift,
            targetShift,
            schedule,
            staff,
            dateKey,
          );

          if (shouldApply) {
            schedule[staff.id][dateKey] = targetShift;
            appliedRules.push({
              type: "dynamic",
              ruleId: rule.id,
              ruleName: rule.name,
              staffId: staff.id,
              staffName: staff.name,
              date: dateKey,
              dayOfWeek: dayOfWeek,
              priorityLevel: rule.priorityLevel,
              appliedShift: targetShift,
              previousShift: currentShift,
            });

            console.log(
              `✅ Applied rule "${rule.name}" for ${staff.name} on ${dateKey}: ${targetShift}`,
            );
          }
        }
      }
    }

    const dynamicRulesApplied = appliedRules.filter(
      (r) => r.type === "dynamic",
    ).length;
    console.log(`🎯 Applied ${dynamicRulesApplied} dynamic priority rules`);

    if (dynamicRulesApplied > 0) {
      const hardRulesApplied = appliedRules.filter(
        (r) =>
          r.type === "dynamic" &&
          priorityRules.find((rule) => rule.id === r.ruleId)?.isHardConstraint,
      ).length;

      console.log(`  • ${hardRulesApplied} hard constraint rules applied`);
      console.log(
        `  • ${dynamicRulesApplied - hardRulesApplied} soft preference rules applied`,
      );
    }
  }

  /**
   * Map configuration shift type to schedule symbol
   * @param {string} shiftType - Shift type from configuration
   * @returns {string} Schedule symbol
   */
  mapShiftTypeToSymbol(shiftType) {
    const mapping = {
      early: "△",
      normal: "",
      late: "◇",
      off: "×",
    };
    return mapping[shiftType] || "";
  }

  /**
   * ✅ NEW: Check if assigning a shift would violate weekly limits
   * Uses rolling 7-day window validation to prevent over-assignment
   * @param {Object} schedule - Current schedule state
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date to check (YYYY-MM-DD)
   * @param {string} proposedShift - Shift to assign (×, △, ◇, etc.)
   * @param {Array} dateRange - Full date range for the period
   * @param {Array} weeklyLimits - Weekly limits configuration
   * @returns {boolean} True if assignment would violate weekly limits
   */
  async wouldViolateWeeklyLimits(
    schedule,
    staff,
    dateKey,
    proposedShift,
    dateRange,
    weeklyLimits = null
  ) {
    try {
      // Load weekly limits if not provided
      if (!weeklyLimits) {
        weeklyLimits = await getWeeklyLimits();
      }

      // Need at least 7 days to validate weekly windows
      if (!dateRange || dateRange.length < 7) {
        return false;
      }

      // Find the date in the range
      const dateIndex = dateRange.findIndex(
        d => d.toISOString().split("T")[0] === dateKey
      );
      if (dateIndex === -1) return false;

      // Get relevant weekly limit based on shift type
      let limit = null;
      let checkFunction = null;

      if (isOffDay(proposedShift)) {
        limit = weeklyLimits?.find(l => l.shiftType === "off" || l.shiftType === "×");
        checkFunction = isOffDay;
      } else if (isEarlyShift(proposedShift)) {
        limit = weeklyLimits?.find(l => l.shiftType === "early" || l.shiftType === "△");
        checkFunction = isEarlyShift;
      } else if (isLateShift(proposedShift)) {
        limit = weeklyLimits?.find(l => l.shiftType === "late" || l.shiftType === "◇");
        checkFunction = isLateShift;
      }

      if (!limit || !checkFunction) {
        return false; // No limit configured for this shift type
      }

      const maxCount = limit.maxCount || 7; // Default: no limit

      // Check all 7-day windows that include this date
      // A date can be in up to 7 different windows (positions 0-6 in each window)
      for (let windowStart = Math.max(0, dateIndex - 6);
           windowStart <= Math.min(dateIndex, dateRange.length - 7);
           windowStart++) {

        const window = dateRange.slice(windowStart, windowStart + 7);
        let count = 0;

        // Get staff schedule once for the window
        const staffSchedule = schedule[staff.id];

        // Count shifts of this type in the window
        window.forEach((date, idx) => {
          const d = date.toISOString().split("T")[0];

          if (staffSchedule && staffSchedule[d] !== undefined) {
            const shift = staffSchedule[d];

            // Count existing shifts of this type
            if (checkFunction(shift)) {
              count++;
            }

            // Handle proposed shift assignment at this date
            if (d === dateKey && checkFunction(proposedShift)) {
              // Only increment if we're changing shift type or assigning to empty cell
              // If replacing same shift type: already counted above, no change to count
              if (!checkFunction(shift)) {
                count++; // New shift of this type (replacing different type or empty)
              }
            }
          } else if (d === dateKey && checkFunction(proposedShift)) {
            count++; // Assigning to empty cell
          }
        });

        // Check if this window would be violated
        if (count > maxCount) {
          return true; // Would violate weekly limit
        }
      }

      return false; // No violation
    } catch (error) {
      console.warn(
        `⚠️ [WEEKLY-LIMIT] Error checking weekly limits for ${staff.name}:`,
        error,
      );
      return false; // Don't block on errors (fail-open)
    }
  }

  /**
   * Check if assigning a shift would violate monthly limits
   * @param {Object} schedule - Current schedule
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} proposedShift - Proposed shift value (×, △, ◇, etc.)
   * @param {Array} dateRange - All dates in the schedule period
   * @param {Array} monthlyLimits - Optional pre-loaded monthly limits
   * @returns {Promise<boolean>} True if would violate, false otherwise
   */
  async wouldViolateMonthlyLimits(
    schedule,
    staff,
    dateKey,
    proposedShift,
    dateRange,
    monthlyLimits = null,
  ) {
    try {
      // Load monthly limits if not provided
      if (!monthlyLimits) {
        const date = new Date(dateKey);
        monthlyLimits = await getMonthlyLimits(
          date.getFullYear(),
          date.getMonth() + 1,
        );
      }

      if (!monthlyLimits || monthlyLimits.length === 0) {
        return false; // No limits configured
      }

      // Find applicable limit based on proposed shift type
      let applicableLimit = null;

      if (isOffDay(proposedShift)) {
        applicableLimit = monthlyLimits.find(
          (l) =>
            l.enabled !== false &&
            (l.shiftType === "off" || l.shiftType === "×" || l.limitType === "max_off_days"),
        );
      } else if (isEarlyShift(proposedShift)) {
        applicableLimit = monthlyLimits.find(
          (l) =>
            l.enabled !== false &&
            (l.shiftType === "early" || l.shiftType === "△"),
        );
      } else if (isLateShift(proposedShift)) {
        applicableLimit = monthlyLimits.find(
          (l) =>
            l.enabled !== false &&
            (l.shiftType === "late" || l.shiftType === "◇"),
        );
      }

      if (!applicableLimit) {
        return false; // No limit for this shift type
      }

      // Check if limit applies to this staff member
      const { scope, targetIds } = applicableLimit;
      if (scope === "individual" && targetIds && targetIds.length > 0) {
        if (!targetIds.includes(staff.id)) {
          return false; // Limit doesn't apply to this staff member
        }
      }

      // Get all dates in the same month as the proposed date
      const proposedDate = new Date(dateKey);
      const proposedMonth = proposedDate.getMonth();
      const proposedYear = proposedDate.getFullYear();

      const datesInMonth = dateRange.filter((date) => {
        return (
          date.getMonth() === proposedMonth && date.getFullYear() === proposedYear
        );
      });

      // Count existing shifts of this type in the month
      let monthCount = 0;
      for (const date of datesInMonth) {
        const checkDateKey = date.toISOString().split("T")[0];
        const existingShift = schedule[staff.id]?.[checkDateKey] || "";

        // Skip the proposed date (we're checking if adding it would violate)
        if (checkDateKey === dateKey) continue;

        // Count matching shift types
        if (isOffDay(proposedShift) && isOffDay(existingShift)) {
          monthCount++;
        } else if (isEarlyShift(proposedShift) && isEarlyShift(existingShift)) {
          monthCount++;
        } else if (isLateShift(proposedShift) && isLateShift(existingShift)) {
          monthCount++;
        }
      }

      // Check if adding this shift would exceed the limit
      const maxCount = applicableLimit.maxCount || applicableLimit.maxOffDaysPerMonth || Infinity;
      const wouldExceed = monthCount + 1 > maxCount;

      if (wouldExceed) {
        console.log(
          `🚫 [MONTHLY-LIMIT] ${staff.name}: Would exceed monthly limit for ${proposedShift} ` +
          `(current: ${monthCount}, max: ${maxCount}, proposed date: ${dateKey})`,
        );
      }

      return wouldExceed;
    } catch (error) {
      console.warn(
        `⚠️ [MONTHLY-LIMIT] Error checking monthly limits for ${staff.name}:`,
        error,
      );
      return false; // Don't block on errors
    }
  }

  /**
   * Unified check to determine if a shift can be assigned without violating limits
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date in YYYY-MM-DD format
   * @param {string} proposedShift - Proposed shift value
   * @param {Object} schedule - Current schedule
   * @param {Array} dateRange - All dates in the schedule period
   * @returns {Promise<boolean>} True if can assign, false if would violate limits
   */
  async canAssignShift(staff, dateKey, proposedShift, schedule, dateRange) {
    try {
      // ✅ PHASE 1: Check early shift permissions FIRST (Tier 1 constraint)
      if (proposedShift === "△" && this.earlyShiftPreferences) {
        const canDoEarly = EarlyShiftPreferencesLoader.canDoEarlyShift(
          this.earlyShiftPreferences,
          staff.id,
          dateKey
        );

        if (!canDoEarly) {
          console.log(
            `🚫 [EARLY-SHIFT] ${staff.name}: No permission for early shift (△) on ${dateKey}`
          );
          return false;
        }
      }

      // ✅ Check adjacent conflicts (Tier 1 constraint - Pattern prevention)
      // Prevents both △-× and △-△ patterns
      if (this.hasAdjacentConflict(staff, dateKey, proposedShift, schedule)) {
        return false; // Adjacent conflict already logged in hasAdjacentConflict()
      }

      // ✅ Check consecutive early shifts (Tier 1 constraint - Staff welfare)
      // Prevents △△ pattern which is undesirable for staff
      if (this.hasConsecutiveEarlyShift(staff, dateKey, proposedShift, schedule)) {
        return false; // Consecutive early shift already logged in hasConsecutiveEarlyShift()
      }

      // ✅ PHASE 1: Check consecutive work day limits (Tier 1 constraint - Labor Law)
      if (proposedShift !== "×" && dateRange && dateRange.length > 0) {
        const MAX_CONSECUTIVE_WORK_DAYS = 6; // Japanese labor standard

        // Find the index of the proposed date
        const dateIndex = dateRange.findIndex(
          d => d.toISOString().split("T")[0] === dateKey
        );

        if (dateIndex > 0) {
          // Count backward to find consecutive work days before this date
          let consecutiveWorkDays = 0;
          for (let i = dateIndex - 1; i >= 0; i--) {
            const checkDate = dateRange[i].toISOString().split("T")[0];
            const existingShift = schedule[staff.id]?.[checkDate];

            // If it's a day off, break the streak
            if (!existingShift || existingShift === "×") {
              break;
            }

            // It's a work day (△, ◇, or normal shift)
            consecutiveWorkDays++;
          }

          // Check if adding this work shift would exceed the limit
          if (consecutiveWorkDays >= MAX_CONSECUTIVE_WORK_DAYS) {
            console.log(
              `🚫 [CONSECUTIVE-LIMIT] ${staff.name}: Would exceed ${MAX_CONSECUTIVE_WORK_DAYS} consecutive work days ` +
              `(current streak: ${consecutiveWorkDays}, proposed: ${proposedShift} on ${dateKey})`
            );
            return false;
          }
        }
      }

      // Check weekly limits (rolling 7-day windows)
      const weeklyViolation = await this.wouldViolateWeeklyLimits(
        schedule,
        staff,
        dateKey,
        proposedShift,
        dateRange,
      );

      if (weeklyViolation) {
        console.log(
          `🚫 [LIMIT-CHECK] ${staff.name}: Blocked by weekly limit (${proposedShift} on ${dateKey})`,
        );
        return false;
      }

      // Check monthly limits (month-to-date)
      const monthlyViolation = await this.wouldViolateMonthlyLimits(
        schedule,
        staff,
        dateKey,
        proposedShift,
        dateRange,
      );

      if (monthlyViolation) {
        console.log(
          `🚫 [LIMIT-CHECK] ${staff.name}: Blocked by monthly limit (${proposedShift} on ${dateKey})`,
        );
        return false;
      }

      // All checks passed
      return true;
    } catch (error) {
      console.warn(
        `⚠️ [LIMIT-CHECK] Error checking limits for ${staff.name}:`,
        error,
      );
      return true; // Don't block on errors
    }
  }

  /**
   * Determine if a priority rule should be applied
   * @param {Object} rule - Priority rule
   * @param {string} currentShift - Current shift value
   * @param {string} targetShift - Target shift value
   * @param {Object} schedule - Working schedule
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @returns {boolean} Whether to apply the rule
   */
  shouldApplyPriorityRule(
    rule,
    currentShift,
    targetShift,
    schedule,
    staff,
    dateKey,
  ) {
    // Always apply if cell is empty
    if (!currentShift || currentShift === "") {
      return true;
    }

    // Apply hard constraints regardless of current value
    if (rule.isHardConstraint) {
      return true;
    }

    // For soft constraints, consider preference strength
    const preferenceStrength = rule.preferenceStrength || 0.8;

    // Apply based on preference strength (some randomness for realistic scheduling)
    return Math.random() < preferenceStrength;
  }

  checkPriorityRules(staff, dateKey, schedule, staffMembers) {
    // Enhanced implementation for checking priority rules
    // This method now works with both dynamic and legacy rules
    const dayOfWeek = getDayOfWeek(dateKey);

    // Check legacy hardcoded rules first
    for (const [priorityId, priority] of this.shiftPriorities) {
      if (priority.condition(dateKey, schedule, staffMembers)) {
        if (staff.name === priority.staff) {
          return priority.shift;
        }
      }
    }

    // Note: Dynamic priority rules are now handled in applyDynamicPriorityRules
    // This method is kept for backward compatibility
    return null;
  }

  /**
   * Check dynamic priority rules for a specific staff and date
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - All staff members
   * @returns {string|null} Suggested shift or null
   */
  async checkDynamicPriorityRules(staff, dateKey, schedule, staffMembers) {
    try {
      const priorityRules = await getPriorityRules();

      if (!Array.isArray(priorityRules) || priorityRules.length === 0) {
        return null;
      }

      const date = new Date(dateKey);
      const dayOfWeek = date.getDay();

      // Find applicable rules for this staff member
      const applicableRules = priorityRules
        .filter((rule) => {
          // Check if rule is active and applies to this staff
          if (rule.isActive === false) return false;
          if (rule.staffId !== staff.id && rule.staffId !== staff.name)
            return false;

          // Check day of week
          if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
            if (!rule.daysOfWeek.includes(dayOfWeek)) return false;
          }

          // Check effective date range
          if (rule.effectiveFrom && date < new Date(rule.effectiveFrom))
            return false;
          if (rule.effectiveUntil && date > new Date(rule.effectiveUntil))
            return false;

          return true;
        })
        .sort((a, b) => (b.priorityLevel || 0) - (a.priorityLevel || 0)); // Highest priority first

      // Apply the highest priority applicable rule
      for (const rule of applicableRules) {
        let targetShift = null;

        switch (rule.ruleType) {
          case "required_off":
            targetShift = "×";
            break;
          case "preferred_shift":
            targetShift = this.mapShiftTypeToSymbol(rule.shiftType);
            break;
          case "avoid_shift":
            // For avoid rules, we need to suggest an alternative
            const avoidShift = this.mapShiftTypeToSymbol(rule.shiftType);
            if (avoidShift === "×") {
              // If avoiding off day, suggest normal work
              targetShift = staff.status === "パート" ? "○" : "";
            } else {
              // If avoiding a work shift, might suggest off day
              targetShift = "×";
            }
            break;
        }

        if (targetShift !== null) {
          // Apply preference strength for soft constraints
          if (!rule.isHardConstraint) {
            const preferenceStrength = rule.preferenceStrength || 0.8;
            if (Math.random() > preferenceStrength) {
              continue; // Skip this rule based on preference strength
            }
          }

          return targetShift;
        }
      }

      return null;
    } catch (error) {
      console.warn("⚠️ Failed to check dynamic priority rules:", error);
      return null;
    }
  }

  async checkGroupConflicts(
    staff,
    dateKey,
    proposedShift,
    schedule,
    staffMembers,
  ) {
    try {
      // Get staff groups from configuration
      const staffGroups = await getStaffConflictGroups();

      // Check if proposed shift is off day or early shift (these create conflicts)
      const isConflictShift = proposedShift === "×" || proposedShift === "△";
      if (!isConflictShift) {
        return false; // Normal/late shifts don't cause group conflicts
      }

      // Find groups containing this staff member
      const staffGroups_containing = staffGroups.filter(
        (group) => group.members && group.members.includes(staff.name),
      );

      if (staffGroups_containing.length === 0) {
        return false; // Staff not in any group
      }

      // Check each group for conflicts
      for (const group of staffGroups_containing) {
        let conflictCount = 0;

        // Count existing conflicts in this group for this date
        for (const memberName of group.members) {
          if (memberName === staff.name) continue; // Skip current staff

          const memberSchedule = schedule[memberName];
          if (memberSchedule && memberSchedule[dateKey]) {
            const memberShift = memberSchedule[dateKey];
            // Check if group member already has conflicting shift
            if (memberShift === "×" || memberShift === "△") {
              conflictCount++;
            }
          }
        }

        // If any group member already has conflict shift, proposing another would create violation
        if (conflictCount > 0) {
          console.log(
            `🚫 Group conflict detected: ${staff.name} in ${group.name} - ${conflictCount} member(s) already off/early on ${dateKey}`,
          );
          return true;
        }
      }

      return false; // No conflicts found
    } catch (error) {
      console.warn("⚠️ Error checking group conflicts:", error);
      return false; // Default to allowing shift if check fails
    }
  }

  /**
   * Calculate backup coverage needs for a specific date
   * @param {Object} schedule - Current schedule
   * @param {string} dateKey - Date key
   * @param {Array} staffMembers - Staff members
   * @returns {Object} Backup coverage analysis
   */
  async calculateBackupCoverageNeeds(schedule, dateKey, staffMembers) {
    try {
      const staffGroups = await getStaffConflictGroups();
      const backupAssignments = await getBackupAssignments();

      if (!backupAssignments || backupAssignments.length === 0) {
        return {
          criticalGroups: [],
          backupStaffRequired: [],
          criticalityScore: 0,
        };
      }

      const criticalGroups = [];
      let totalCriticality = 0;

      // Check each group for coverage needs
      for (const group of staffGroups) {
        const groupMembersOffCount = group.members.filter((memberName) => {
          const staff = staffMembers.find((s) => s.name === memberName);
          if (staff && schedule[staff.id] && schedule[staff.id][dateKey]) {
            return isOffDay(schedule[staff.id][dateKey]);
          }
          return false;
        }).length;

        // Group is critical if more than 1 member is off
        if (groupMembersOffCount > 1) {
          const groupBackupStaff = backupAssignments
            .filter((assignment) => assignment.groupId === group.id)
            .map((assignment) => {
              const staff = staffMembers.find(
                (s) => s.id === assignment.staffId,
              );
              return {
                staffId: assignment.staffId,
                staffName: staff?.name || "Unknown",
                priority: assignment.priorityOrder || 1,
              };
            })
            .sort((a, b) => a.priority - b.priority);

          if (groupBackupStaff.length > 0) {
            criticalGroups.push({
              groupId: group.id,
              groupName: group.name,
              membersOff: groupMembersOffCount,
              backupStaff: groupBackupStaff,
              criticality: groupMembersOffCount * 2, // Weight by severity
            });

            totalCriticality += groupMembersOffCount * 2;
          }
        }
      }

      const backupStaffRequired = criticalGroups
        .flatMap((group) => group.backupStaff.slice(0, group.membersOff)) // Take needed backup staff
        .map((backup) => backup.staffId);

      return {
        criticalGroups,
        backupStaffRequired: [...new Set(backupStaffRequired)], // Remove duplicates
        criticalityScore: Math.min(1.0, totalCriticality / 10), // Normalize to 0-1
      };
    } catch (error) {
      console.warn("⚠️ Failed to calculate backup coverage needs:", error);
      return {
        criticalGroups: [],
        backupStaffRequired: [],
        criticalityScore: 0,
      };
    }
  }

  /**
   * Select working shift with backup staff considerations
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Object} backupCoverageNeeds - Backup coverage analysis
   * @returns {string} Selected shift
   */
  async selectWorkingShiftWithBackup(
    staff,
    dateKey,
    schedule,
    staffMembers,
    backupCoverageNeeds,
  ) {
    // First check if there are any dynamic priority rules that suggest a specific working shift
    const priorityShift = await this.checkDynamicPriorityRules(
      staff,
      dateKey,
      schedule,
      staffMembers,
    );

    if (priorityShift && priorityShift !== "×") {
      return priorityShift;
    }

    // Get daily limits for shift balancing
    const dailyLimits = await getDailyLimits();
    const dayCounts = this.countDayAssignments(schedule, dateKey, staffMembers);

    const dayOfWeek = getDayOfWeek(dateKey);

    // Check if this staff member has backup responsibilities
    const isBackupStaff = backupCoverageNeeds.backupStaffRequired.includes(
      staff.id,
    );
    const criticalGroup = backupCoverageNeeds.criticalGroups.find((group) =>
      group.backupStaff.some((backup) => backup.staffId === staff.id),
    );

    // Check daily limits and suggest appropriate shifts
    const earlyLimit =
      dailyLimits.find((l) => l.shiftType === "early")?.maxCount || 3;
    const lateLimit =
      dailyLimits.find((l) => l.shiftType === "late")?.maxCount || 3;

    // Apply business logic based on dynamic configuration (replaces hardcoded rules)
    // Sunday early shift logic now handled by dynamic priority rules
    // Check if there are any dynamic rules that should apply here
    const sundayEarlyRule = await this.checkDynamicBusinessRules(
      staff,
      dateKey,
      dayOfWeek,
      dayCounts,
    );
    if (sundayEarlyRule) {
      return sundayEarlyRule;
    }

    // Backup staff considerations for shift selection
    if (isBackupStaff && criticalGroup) {
      console.log(
        `🔄 Backup staff ${staff.name} covering for critical group ${criticalGroup.groupName}`,
      );

      // Backup staff should work normal shifts to provide stable coverage
      // unless there's a specific operational need for different shifts
      // ✅ EARLY SHIFT ELIGIBILITY: Only 社員 backup staff can work early shifts
      if (
        this.isEligibleForEarlyShift(staff) &&
        dayCounts.early < earlyLimit &&
        criticalGroup.criticality > 3
      ) {
        // ✅ ADJACENT CONFLICT CHECK: Prevent △ next to × (off days)
        const hasAdjacentConflict = this.hasAdjacentConflict(
          staff,
          dateKey,
          "△",
          schedule,
        );
        if (!hasAdjacentConflict) {
          return "△"; // Early shift for critical coverage
        }
      }

      return ""; // Normal shift for stable backup coverage
    }

    // Regular shift selection logic
    // ✅ EARLY SHIFT ELIGIBILITY: Only 社員 staff can work early shifts
    if (
      this.isEligibleForEarlyShift(staff) &&
      dayCounts.early < earlyLimit &&
      Math.random() < 0.2 // Reduced from 0.3 to 0.2 (20% probability)
    ) {
      // ✅ ADJACENT CONFLICT CHECK: Prevent △ next to × (off days)
      const hasAdjacentConflict = this.hasAdjacentConflict(
        staff,
        dateKey,
        "△",
        schedule,
      );
      if (!hasAdjacentConflict) {
        return "△"; // Early shift
      }
    }

    if (dayCounts.late < lateLimit && Math.random() < 0.2) {
      return "◇"; // Late shift
    }

    return ""; // Default to normal shift
  }

  /**
   * Check dynamic business rules for specific scenarios
   * @param {Object} staff - Staff member
   * @param {string} dateKey - Date key
   * @param {string} dayOfWeek - Day of week
   * @param {Object} dayCounts - Current day counts
   * @returns {string|null} Suggested shift or null
   */
  async checkDynamicBusinessRules(staff, dateKey, dayOfWeek, dayCounts) {
    try {
      // Get priority rules to check for business logic
      const priorityRules = await getPriorityRules();

      if (!priorityRules || priorityRules.length === 0) {
        return null;
      }

      const date = new Date(dateKey);
      const dayIndex = date.getDay();

      // Find applicable rules for this staff member and day
      const applicableRule = priorityRules.find((rule) => {
        if (rule.isActive === false) return false;
        if (rule.staffId !== staff.id && rule.staffId !== staff.name)
          return false;

        // Check day of week
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          if (!rule.daysOfWeek.includes(dayIndex)) return false;
        }

        return true;
      });

      if (applicableRule) {
        const targetShift = this.mapShiftTypeToSymbol(applicableRule.shiftType);
        console.log(
          `🎯 Dynamic business rule applied: ${staff.name} -> ${targetShift} on ${dayOfWeek}`,
        );
        return targetShift;
      }

      return null;
    } catch (error) {
      console.warn("⚠️ Failed to check dynamic business rules:", error);
      return null;
    }
  }

  async selectWorkingShift(staff, dateKey, schedule, staffMembers) {
    // Legacy method - now calls the backup-aware version with empty backup needs
    return await this.selectWorkingShiftWithBackup(
      staff,
      dateKey,
      schedule,
      staffMembers,
      { criticalGroups: [], backupStaffRequired: [], criticalityScore: 0 },
    );
  }

  calculateDateDifficulty(date) {
    // Calculate how difficult it is to schedule this date
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1; // Weekends are harder
  }

  calculateWorkloadVariance(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );

    if (workloads.length === 0) return 0;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    return (
      workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) /
      workloads.length
    );
  }

  calculateOffDayDistribution(schedule, staffMembers, dateRange) {
    // Calculate how evenly off days are distributed
    const offDayCounts = staffMembers.map((staff) =>
      this.countStaffOffDays(schedule[staff.id], dateRange),
    );

    const variance = this.calculateWorkloadVariance(
      Object.fromEntries(
        staffMembers.map((staff, i) => [staff.id, { total: offDayCounts[i] }]),
      ),
      staffMembers.map((staff, i) => ({
        ...staff,
        schedule: { total: offDayCounts[i] },
      })),
      [{ length: 1 }], // Dummy range for calculation
    );

    return Math.max(0, 100 - variance * 100);
  }

  calculateAverageWorkload(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );
    return workloads.length > 0
      ? workloads.reduce((sum, w) => sum + w, 0) / workloads.length
      : 0;
  }

  countDayOffAssignments(schedule, dateKey, staffMembers) {
    return this.countDayAssignments(schedule, dateKey, staffMembers).off;
  }

  countPriorityRulesApplied(schedule, dateRange, staffMembers) {
    // Count how many priority rules are currently satisfied
    return this.calculatePriorityScore(schedule, staffMembers, dateRange);
  }

  predictShiftFromPattern(staff, dateKey, dayOfWeek, pattern, schedule) {
    // Predict shift based on learned patterns
    // This is a simplified implementation
    return "";
  }

  async validateShiftAssignment(
    staff,
    dateKey,
    shift,
    schedule,
    staffMembers,
    dateRange,
  ) {
    // Validate if shift assignment is allowed with actual limit checks
    return await this.canAssignShift(staff, dateKey, shift, schedule, dateRange);
  }

  async fillRemainingSlots(schedule, staffMembers, dateRange) {
    // Fill any remaining empty slots with balanced approach and limit enforcement
    let changesApplied = 0;

    for (const date of dateRange) {
      const dateKey = date.toISOString().split("T")[0];

      for (const staff of staffMembers) {
        if (schedule[staff.id][dateKey] === "") {
          // Get day counts for this date
          const dayCounts = this.countDayAssignments(
            schedule,
            dateKey,
            staffMembers,
          );

          // Suggest a shift using the existing logic
          const suggestedShift = await this.suggestShiftForStaff(
            staff,
            dateKey,
            schedule,
            staffMembers,
            dayCounts,
            dateRange,
          );

          // Only assign if it passes limit checks
          if (suggestedShift !== null && suggestedShift !== undefined) {
            const limitsOK = await this.canAssignShift(
              staff,
              dateKey,
              suggestedShift,
              schedule,
              dateRange,
            );

            if (limitsOK) {
              schedule[staff.id][dateKey] = suggestedShift;
              changesApplied++;
            }
          }
        }
      }
    }

    return { changesApplied };
  }

  /**
   * Apply backup staff assignments to a schedule
   * @param {Object} schedule - Schedule to process
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Updated schedule with backup assignments
   */
  async applyBackupStaffAssignments(schedule, staffMembers, dateRange) {
    if (!this.backupStaffService.initialized) {
      console.warn(
        "⚠️ Backup staff service not initialized, skipping backup assignments",
      );
      return schedule;
    }

    console.log("🔄 Applying backup staff assignments...");
    const startTime = Date.now();

    try {
      // Load current staff groups and backup assignments
      const { getStaffConflictGroups } = await import(
        "../constraints/ConstraintEngine"
      );
      const staffGroups = await getStaffConflictGroups();

      // Process backup assignments for the full schedule
      const updatedSchedule =
        this.backupStaffService.processFullScheduleBackups(
          schedule,
          staffMembers,
          staffGroups,
          dateRange,
        );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Backup staff assignments completed in ${processingTime}ms`,
      );

      return updatedSchedule;
    } catch (error) {
      console.error("❌ Failed to apply backup staff assignments:", error);
      return schedule; // Return original schedule if backup processing fails
    }
  }

  /**
   * Set up real-time cache invalidation listener
   */
  setupCacheInvalidationListener() {
    console.log(
      "🔌 Setting up real-time configuration cache invalidation listener...",
    );

    this.cacheInvalidationUnsubscribe = onConfigurationCacheInvalidated(() => {
      console.log(
        "🔄 ScheduleGenerator: Configuration cache invalidated, updating constraint weights...",
      );
      this.onConfigurationUpdated();
    });
  }

  /**
   * Handle configuration updates
   */
  async onConfigurationUpdated() {
    const now = Date.now();

    // Throttle updates to avoid excessive processing
    if (now - this.lastConfigurationRefresh < 1000) {
      console.log(
        "🕒 Configuration update throttled (less than 1 second since last update)",
      );
      return;
    }

    this.lastConfigurationRefresh = now;

    try {
      console.log(
        "🔄 ScheduleGenerator: Updating constraint weights with fresh configuration...",
      );

      // Reload constraint weights with fresh configuration
      if (this.initialized) {
        // Use empty arrays as placeholder - updateConstraintWeights will load fresh data
        await this.updateConstraintWeights([], [], null);

        console.log(
          "✅ ScheduleGenerator constraint weights updated with fresh configuration",
        );
      }

      // Notify that generator is ready with updated configuration
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("scheduleGeneratorConfigUpdated", {
            detail: {
              timestamp: now,
              constraintWeights: this.constraintWeights,
            },
          }),
        );
      }
    } catch (error) {
      console.error(
        "❌ Failed to update ScheduleGenerator configuration:",
        error,
      );
    }
  }

  /**
   * Force refresh configuration
   */
  async forceRefreshConfiguration() {
    console.log("🔄 Force refreshing ScheduleGenerator configuration...");

    try {
      // Force refresh all configurations
      await refreshAllConfigurations();

      // Update our constraint weights
      await this.onConfigurationUpdated();

      console.log("✅ ScheduleGenerator configuration force refresh completed");
      return { success: true };
    } catch (error) {
      console.error("❌ Force refresh failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get generator status with configuration cache information
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      strategies: Array.from(this.generationStrategies.keys()),
      priorityRules: Array.from(this.shiftPriorities.keys()),
      statistics: { ...this.generationStats },
      patternsLoaded: this.staffPatterns.size,
      backupService: this.backupStaffService.getStatus(),
      mlComponents: {
        geneticAlgorithm: this.geneticAlgorithm?.getStatus?.() || "available",
        simulatedAnnealing:
          this.simulatedAnnealing?.getStatus?.() || "available",
        ensembleScheduler: this.ensembleScheduler?.getStatus?.() || "available",
      },
      mlPresets: Object.keys(this.mlPresets),
      constraintWeights: this.constraintWeights,
      adaptiveLearning: this.adaptiveLearning,
      performanceHistory: this.generationStats.performanceHistory.slice(-5), // Last 5 generations
      configurationCache: {
        hasInvalidationListener: !!this.cacheInvalidationUnsubscribe,
        lastConfigurationRefresh: this.lastConfigurationRefresh,
        timeSinceLastRefresh: this.lastConfigurationRefresh
          ? Date.now() - this.lastConfigurationRefresh
          : null,
      },
      monthlyBalancing: {
        enabled: this.monthlyBalancingEnabled,
        projectionsCount: this.monthlyProjections.size,
        summary: this.getMonthlyProjectionSummary(),
      },
      backupStaffIntegration: {
        available: true,
        prePlanningEnabled: true,
        description:
          "Backup staff considerations integrated into generation algorithms",
      },
    };
  }

  /**
   * Cleanup method for proper disposal
   */
  /**
   * Enable or disable monthly balancing
   * @param {boolean} enabled - Whether to enable monthly balancing
   */
  setMonthlyBalancingEnabled(enabled) {
    this.monthlyBalancingEnabled = enabled;
    console.log(`📋 Monthly balancing ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get current monthly projections
   * @returns {Map} Current monthly projections
   */
  getCurrentMonthlyProjections() {
    return this.monthlyProjections;
  }

  /**
   * Comprehensive integration testing and validation
   * @param {Array} staffMembers - Staff members for testing
   * @param {Array} dateRange - Date range for testing
   * @returns {Object} Test results
   */
  async runIntegrationTests(staffMembers, dateRange) {
    console.log("🧪 Starting comprehensive AI-settings integration tests...");

    const testResults = {
      timestamp: new Date().toISOString(),
      testSuite: "AI-Settings Integration",
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      tests: [],
      summary: "",
    };

    const runTest = async (testName, testFunction) => {
      testResults.totalTests++;
      try {
        console.log(`📝 Running test: ${testName}`);
        const result = await testFunction();
        testResults.tests.push({
          name: testName,
          status: "PASS",
          result,
          timestamp: Date.now(),
        });
        testResults.passedTests++;
        console.log(`✅ ${testName}: PASSED`);
        return result;
      } catch (error) {
        testResults.tests.push({
          name: testName,
          status: "FAIL",
          error: error.message,
          timestamp: Date.now(),
        });
        testResults.failedTests++;
        console.error(`❌ ${testName}: FAILED - ${error.message}`);
        return null;
      }
    };

    // Test 1: Priority Rules Integration
    await runTest("Priority Rules Loading and Application", async () => {
      const priorityRules = await getPriorityRules();
      if (!Array.isArray(priorityRules)) {
        throw new Error("Priority rules not loaded as array");
      }

      // Test application during generation
      const testSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange.slice(0, 3),
        {},
        false,
      );
      const appliedRules = [];

      await this.applyDynamicPriorityRules(
        testSchedule,
        staffMembers,
        dateRange.slice(0, 3),
        priorityRules,
        appliedRules,
      );

      return {
        rulesLoaded: priorityRules.length,
        rulesApplied: appliedRules.filter((r) => r.type === "dynamic").length,
        integrationWorking: true,
      };
    });

    // Test 2: Real-time Cache Invalidation
    await runTest("Real-time Cache Invalidation", async () => {
      let invalidationTriggered = false;

      // Register temporary listener
      const unsubscribe = onConfigurationCacheInvalidated(() => {
        invalidationTriggered = true;
      });

      // Force invalidation
      invalidateConfigurationCache();

      // Wait briefly for async callback
      await new Promise((resolve) => setTimeout(resolve, 100));

      unsubscribe();

      if (!invalidationTriggered) {
        throw new Error("Cache invalidation callback not triggered");
      }

      return {
        listenerRegistered: true,
        invalidationTriggered: true,
        integrationWorking: true,
      };
    });

    // Test 3: Monthly Balancing Integration
    await runTest("Monthly Balancing and Projections", async () => {
      if (!this.monthlyBalancingEnabled) {
        this.setMonthlyBalancingEnabled(true);
      }

      const testSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange.slice(0, 7),
        {},
        false,
      );
      const projections = await this.calculateMonthlyProjections(
        testSchedule,
        staffMembers,
        dateRange.slice(0, 7),
      );

      if (projections.size === 0) {
        throw new Error("No monthly projections calculated");
      }

      const summary = this.getMonthlyProjectionSummary();

      return {
        projectionsCalculated: projections.size,
        staffCovered: summary.totalStaff,
        averageBalanceScore: summary.averageBalanceScore,
        integrationWorking: true,
      };
    });

    // Test 4: Backup Staff Integration
    await runTest("Backup Staff Pre-Planning", async () => {
      const backupPrePlanning = await this.initializeBackupPrePlanning(
        staffMembers,
        dateRange.slice(0, 5),
        {},
      );

      if (!backupPrePlanning) {
        throw new Error("Backup pre-planning initialization failed");
      }

      // Test coverage calculation
      const testSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange.slice(0, 5),
        {},
        false,
      );
      const coverageNeeds = await this.calculateBackupCoverageNeeds(
        testSchedule,
        dateRange[0].toISOString().split("T")[0],
        staffMembers,
      );

      return {
        prePlanningEnabled: backupPrePlanning.enabled,
        backupAssignments: backupPrePlanning.totalBackupStaff || 0,
        coverageCalculated: coverageNeeds !== null,
        integrationWorking: true,
      };
    });

    // Test 5: Configuration Service Integration
    await runTest("Dynamic Configuration Loading", async () => {
      const configs = await Promise.allSettled([
        getStaffConflictGroups(),
        getDailyLimits(),
        getPriorityRules(),
        getBackupAssignments(),
      ]);

      const successful = configs.filter((c) => c.status === "fulfilled").length;
      const failed = configs.filter((c) => c.status === "rejected").length;

      if (successful === 0) {
        throw new Error("No configuration services working");
      }

      return {
        configurationsLoaded: successful,
        configurationsFailed: failed,
        totalConfigurations: configs.length,
        successRate: Math.round((successful / configs.length) * 100),
        integrationWorking: successful > failed,
      };
    });

    // Test 6: End-to-End Generation with All Features
    await runTest("End-to-End Generation Integration", async () => {
      const testSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange.slice(0, 3),
        {},
        false,
      );

      // Run balance-first strategy with all integrations
      const result = await this.balanceFirstStrategy(
        testSchedule,
        staffMembers,
        dateRange.slice(0, 3),
        { useAllIntegrations: true },
      );

      if (!result || !result.schedule) {
        throw new Error("Generation failed to produce schedule");
      }

      const hasAnalysis =
        result.analysis && typeof result.analysis === "object";
      const hasProjections = result.analysis?.monthlyProjections?.length > 0;
      const hasBackupIntegration =
        result.analysis?.backupStaffIntegration?.enabled;

      return {
        scheduleGenerated: true,
        changesApplied: result.changesApplied,
        analysisIncluded: hasAnalysis,
        monthlyProjectionsIncluded: hasProjections,
        backupIntegrationEnabled: hasBackupIntegration,
        strategy: result.strategy,
        integrationWorking: true,
      };
    });

    // Calculate summary
    const successRate = Math.round(
      (testResults.passedTests / testResults.totalTests) * 100,
    );
    testResults.summary = `${testResults.passedTests}/${testResults.totalTests} tests passed (${successRate}%)`;

    if (testResults.passedTests === testResults.totalTests) {
      console.log(
        "✅ All integration tests PASSED! AI-settings integration is fully functional.",
      );
    } else {
      console.warn(
        `⚠️ Integration tests completed with ${testResults.failedTests} failures. Review failed tests.`,
      );
    }

    return testResults;
  }

  /**
   * Quick validation check for AI-settings integration
   * @returns {Object} Validation status
   */
  async validateAISettingsIntegration() {
    console.log("🔍 Running quick AI-settings integration validation...");

    const validation = {
      timestamp: new Date().toISOString(),
      status: "checking",
      components: {
        priorityRules: { status: "unknown", details: null },
        cacheInvalidation: { status: "unknown", details: null },
        monthlyBalancing: { status: "unknown", details: null },
        backupStaffIntegration: { status: "unknown", details: null },
        configurationService: { status: "unknown", details: null },
      },
      overallStatus: "unknown",
      readiness: 0,
    };

    try {
      // Check priority rules
      const priorityRules = await getPriorityRules();
      validation.components.priorityRules = {
        status: Array.isArray(priorityRules) ? "ready" : "error",
        details: `${priorityRules?.length || 0} rules configured`,
      };

      // Check cache invalidation
      validation.components.cacheInvalidation = {
        status: this.cacheInvalidationUnsubscribe ? "ready" : "warning",
        details: this.cacheInvalidationUnsubscribe
          ? "Listener active"
          : "No listener registered",
      };

      // Check monthly balancing
      validation.components.monthlyBalancing = {
        status: this.monthlyBalancingEnabled ? "ready" : "disabled",
        details: `Projections: ${this.monthlyProjections.size} staff`,
      };

      // Check backup staff integration
      const backupAssignments = await getBackupAssignments();
      validation.components.backupStaffIntegration = {
        status: Array.isArray(backupAssignments) ? "ready" : "warning",
        details: `${backupAssignments?.length || 0} backup assignments`,
      };

      // Check configuration service
      const configStatus = configService.getSyncStatus();
      validation.components.configurationService = {
        status: configStatus.isSupabaseEnabled ? "ready" : "local-only",
        details: `Sync: ${configStatus.isSupabaseEnabled ? "enabled" : "localStorage only"}`,
      };

      // Calculate overall readiness
      const componentStatuses = Object.values(validation.components);
      const readyCount = componentStatuses.filter(
        (c) => c.status === "ready",
      ).length;
      validation.readiness = Math.round(
        (readyCount / componentStatuses.length) * 100,
      );

      if (validation.readiness >= 80) {
        validation.overallStatus = "ready";
      } else if (validation.readiness >= 60) {
        validation.overallStatus = "partial";
      } else {
        validation.overallStatus = "needs-attention";
      }

      console.log(
        `📋 AI-Settings Integration Readiness: ${validation.readiness}% (${validation.overallStatus})`,
      );
    } catch (error) {
      validation.overallStatus = "error";
      validation.error = error.message;
      console.error("❌ AI-settings integration validation failed:", error);
    }

    return validation;
  }

  dispose() {
    if (this.cacheInvalidationUnsubscribe) {
      this.cacheInvalidationUnsubscribe();
      this.cacheInvalidationUnsubscribe = null;
      console.log("🔌 ScheduleGenerator cache invalidation listener removed");
    }

    // Clear monthly projections
    this.monthlyProjections.clear();
  }

  /**
   * Generate schedule using ensemble approach
   * @param {Object} workingSchedule - Initial schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} mlConfig - ML configuration
   * @returns {Object} Generation result
   */
  async generateWithEnsemble(
    workingSchedule,
    staffMembers,
    dateRange,
    mlConfig,
  ) {
    const results = [];
    const algorithms = mlConfig.ensembleAlgorithms || [
      "genetic_algorithm",
      "simulated_annealing",
    ];
    const weights = mlConfig.ensembleWeights || [0.6, 0.4];

    console.log(`🧠 Running ensemble with ${algorithms.length} algorithms...`);

    // Run each algorithm
    for (let i = 0; i < algorithms.length; i++) {
      const algorithm = algorithms[i];
      const weight = weights[i] || 1.0 / algorithms.length;

      console.log(`  🔄 Running ${algorithm} (weight: ${weight})...`);

      const algorithmConfig = { ...mlConfig, algorithm };
      const result = await this.generateWithSingleAlgorithm(
        JSON.parse(JSON.stringify(workingSchedule)),
        staffMembers,
        dateRange,
        algorithmConfig,
      );

      results.push({ ...result, weight, algorithm });
      console.log(
        `  ✅ ${algorithm} completed: score ${result.score.toFixed(2)}%, confidence ${(result.confidence * 100).toFixed(1)}%`,
      );
    }

    // Combine results using weighted voting
    const combinedResult = await this.combineEnsembleResults(
      results,
      staffMembers,
      dateRange,
    );

    console.log(
      `🎯 Ensemble combination completed: final score ${combinedResult.score.toFixed(2)}%`,
    );
    return combinedResult;
  }

  /**
   * Generate schedule using single algorithm
   * @param {Object} workingSchedule - Initial schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} mlConfig - ML configuration
   * @returns {Object} Generation result
   */
  async generateWithSingleAlgorithm(
    workingSchedule,
    staffMembers,
    dateRange,
    mlConfig,
  ) {
    const maxIterations = mlConfig.generations || 300;
    const maxRuntime = mlConfig.maxRuntime * 1000 || 300000; // Convert to milliseconds
    const startTime = Date.now();

    let bestSchedule = null;
    let bestScore = -1;
    let iterations = 0;
    let stagnationCount = 0;
    const maxStagnation = 50;

    // Initialize algorithm-specific parameters
    if (mlConfig.algorithm === "genetic_algorithm") {
      await this.geneticAlgorithm.initialize({
        populationSize: mlConfig.populationSize,
        mutationRate: mlConfig.mutationRate,
        crossoverRate: mlConfig.crossoverRate,
        elitismRate: mlConfig.elitismRate,
        enableAdaptiveMutation: mlConfig.enableAdaptiveMutation,
        parallelProcessing: mlConfig.parallelProcessing,
      });
    } else if (mlConfig.algorithm === "simulated_annealing") {
      await this.simulatedAnnealing.initialize({
        initialTemperature: 1000,
        coolingRate: 0.95,
        minTemperature: 0.1,
        maxIterations: maxIterations,
      });
    }

    // Generation loop with multiple termination conditions
    while (
      iterations < maxIterations &&
      Date.now() - startTime < maxRuntime &&
      stagnationCount < maxStagnation
    ) {
      iterations++;

      let generatedSchedule;

      if (mlConfig.algorithm === "genetic_algorithm") {
        generatedSchedule = await this.geneticAlgorithm.evolve(
          workingSchedule,
          staffMembers,
          dateRange,
          { iteration: iterations },
        );
      } else if (mlConfig.algorithm === "simulated_annealing") {
        generatedSchedule = await this.simulatedAnnealing.anneal(
          workingSchedule,
          staffMembers,
          dateRange,
          { iteration: iterations },
        );
      } else {
        // Fallback to existing strategies
        const strategyFunc = this.generationStrategies.get("balance_first");
        const generated = await strategyFunc.execute(
          workingSchedule,
          staffMembers,
          dateRange,
          { iteration: iterations, maxIterations },
        );
        generatedSchedule = generated.schedule;
      }

      // Evaluate the generated schedule
      const score = await this.evaluateSchedule(
        generatedSchedule,
        staffMembers,
        dateRange,
      );

      // Update best solution
      if (score > bestScore) {
        bestScore = score;
        bestSchedule = {
          schedule: generatedSchedule,
          score,
          iteration: iterations,
          algorithm: mlConfig.algorithm,
        };
        stagnationCount = 0;

        // Early termination for high-quality solutions
        if (score >= 98) {
          console.log(
            `🎯 Achieved excellent score (${score.toFixed(2)}%) early, stopping optimization`,
          );
          break;
        }
      } else {
        stagnationCount++;
      }

      // Update working schedule for next iteration
      if (iterations % 10 === 0) {
        workingSchedule = this.applyRandomMutation(
          generatedSchedule,
          mlConfig.mutationRate * 0.5,
        );
      }

      // Progress logging
      if (iterations % 50 === 0) {
        console.log(
          `    Progress: ${iterations}/${maxIterations} iterations, best score: ${bestScore.toFixed(2)}%`,
        );
      }
    }

    // Calculate confidence score
    const confidence = this.calculateConfidenceScore(
      bestSchedule,
      iterations,
      maxIterations,
      bestScore,
    );

    return {
      schedule: bestSchedule,
      score: bestScore,
      confidence,
      iterations,
      algorithm: mlConfig.algorithm,
      terminationReason: this.getTerminationReason(
        iterations,
        maxIterations,
        Date.now() - startTime,
        maxRuntime,
        stagnationCount,
        maxStagnation,
      ),
    };
  }

  /**
   * Combine results from ensemble algorithms
   * @param {Array} results - Algorithm results
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Combined result
   */
  async combineEnsembleResults(results, staffMembers, dateRange) {
    if (results.length === 0) {
      throw new Error("No results to combine");
    }

    if (results.length === 1) {
      return results[0];
    }

    // Weight results by both algorithm weight and performance
    const weightedResults = results.map((result) => ({
      ...result,
      adjustedWeight:
        result.weight * (result.confidence || 0.5) * (result.score / 100),
    }));

    // Normalize weights
    const totalWeight = weightedResults.reduce(
      (sum, r) => sum + r.adjustedWeight,
      0,
    );
    weightedResults.forEach((r) => {
      r.normalizedWeight = r.adjustedWeight / totalWeight;
    });

    // Choose best individual result as base, then apply ensemble improvements
    const bestResult = results.reduce((best, current) =>
      current.score > best.score ? current : best,
    );

    // Apply ensemble-specific improvements
    const ensembleSchedule = await this.applyEnsembleConsensus(
      weightedResults,
      staffMembers,
      dateRange,
    );

    // Evaluate ensemble result
    const ensembleScore = await this.evaluateSchedule(
      ensembleSchedule,
      staffMembers,
      dateRange,
    );

    // Calculate ensemble confidence
    const ensembleConfidence =
      this.calculateEnsembleConfidence(weightedResults);

    return {
      schedule: {
        schedule: ensembleSchedule,
        score: ensembleScore,
        algorithm: "ensemble",
      },
      score: ensembleScore,
      confidence: ensembleConfidence,
      iterations: Math.max(...results.map((r) => r.iterations)),
      algorithm: "ensemble",
      ensembleDetails: {
        individualResults: results.map((r) => ({
          algorithm: r.algorithm,
          score: r.score,
          confidence: r.confidence,
          weight: r.weight,
          normalizedWeight: weightedResults.find(
            (wr) => wr.algorithm === r.algorithm,
          )?.normalizedWeight,
        })),
        consensusRate: this.calculateConsensusRate(results),
      },
    };
  }

  /**
   * Apply ensemble consensus to create final schedule
   * @param {Array} weightedResults - Weighted algorithm results
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Consensus schedule
   */
  async applyEnsembleConsensus(weightedResults, staffMembers, dateRange) {
    const consensusSchedule = {};

    // Initialize consensus schedule
    staffMembers.forEach((staff) => {
      consensusSchedule[staff.id] = {};
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        consensusSchedule[staff.id][dateKey] = "";
      });
    });

    // Apply weighted voting for each cell
    staffMembers.forEach((staff) => {
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const votes = new Map();

        // Collect votes from each algorithm
        weightedResults.forEach((result) => {
          const schedule = result.schedule?.schedule || result.schedule;
          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            const shift = schedule[staff.id][dateKey];
            const currentVotes = votes.get(shift) || 0;
            votes.set(shift, currentVotes + result.normalizedWeight);
          }
        });

        // Choose shift with highest weighted vote
        let bestShift = "";
        let bestVotes = 0;
        for (const [shift, voteWeight] of votes) {
          if (voteWeight > bestVotes) {
            bestVotes = voteWeight;
            bestShift = shift;
          }
        }

        consensusSchedule[staff.id][dateKey] = bestShift;
      });
    });

    return consensusSchedule;
  }

  /**
   * Calculate confidence score for a generated schedule
   * @param {Object} schedule - Generated schedule
   * @param {number} iterations - Number of iterations used
   * @param {number} maxIterations - Maximum iterations allowed
   * @param {number} score - Schedule quality score
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidenceScore(schedule, iterations, maxIterations, score) {
    // Base confidence from score
    let confidence = score / 100;

    // Adjust based on iteration convergence
    const convergenceRatio = iterations / maxIterations;
    if (convergenceRatio < 0.5) {
      confidence *= 1.1; // Bonus for early convergence
    } else if (convergenceRatio > 0.9) {
      confidence *= 0.9; // Penalty for using most iterations
    }

    // Adjust based on score thresholds
    if (score >= 95) {
      confidence = Math.min(1.0, confidence * 1.1);
    } else if (score < 80) {
      confidence *= 0.8;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate ensemble confidence from individual results
   * @param {Array} weightedResults - Weighted algorithm results
   * @returns {number} Ensemble confidence (0-1)
   */
  calculateEnsembleConfidence(weightedResults) {
    // Weighted average of individual confidences
    const avgConfidence = weightedResults.reduce(
      (sum, result) =>
        sum + (result.confidence || 0.5) * result.normalizedWeight,
      0,
    );

    // Bonus for consensus between algorithms
    const consensusRate = this.calculateConsensusRate(weightedResults);
    const consensusBonus = consensusRate * 0.1;

    return Math.min(1.0, avgConfidence + consensusBonus);
  }

  /**
   * Calculate quality metrics for a schedule
   * @param {Object} schedule - Schedule to analyze
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Quality metrics
   */
  async calculateQualityMetrics(schedule, staffMembers, dateRange) {
    const validation = await validateAllConstraints(
      schedule,
      staffMembers,
      dateRange,
      [], // backupAssignments
    );

    const balanceScore = this.calculateBalanceScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const priorityScore = this.calculatePriorityScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const fairnessScore = this.calculateFairnessScore(
      schedule,
      staffMembers,
      dateRange,
    );
    const efficiencyScore = this.calculateEfficiencyScore(
      schedule,
      staffMembers,
      dateRange,
    );

    return {
      validation,
      constraintAnalysis: {
        totalViolations: validation.summary.violationsFound,
        criticalViolations: validation.summary.criticalViolations,
        highViolations: validation.summary.highViolations,
        mediumViolations: validation.summary.mediumViolations,
        violationRate:
          validation.summary.violationsFound /
          validation.summary.totalConstraintsChecked,
      },
      scores: {
        balance: balanceScore,
        priority: priorityScore,
        fairness: fairnessScore,
        efficiency: efficiencyScore,
      },
      summary: {
        overall:
          (balanceScore + priorityScore + fairnessScore + efficiencyScore) / 4,
        strengths: this.identifyStrengths({
          balance: balanceScore,
          priority: priorityScore,
          fairness: fairnessScore,
          efficiency: efficiencyScore,
        }),
        weaknesses: this.identifyWeaknesses({
          balance: balanceScore,
          priority: priorityScore,
          fairness: fairnessScore,
          efficiency: efficiencyScore,
        }),
      },
    };
  }

  /**
   * Update constraint weights based on current settings (supports priority system)
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} settings - User settings including priorities
   */
  async updateConstraintWeights(staffMembers, dateRange, settings = null) {
    try {
      // Load actual current settings from ConfigurationService
      const currentSettings = settings || {
        staffGroups: await getStaffConflictGroups(),
        dailyLimits: await getDailyLimits(),
        priorityRules: await getPriorityRules(),
        monthlyLimits: configService.getMonthlyLimits(),
        backupAssignments: configService.getBackupAssignments(),
      };

      // Use smart auto-detection system
      console.log(
        "🧠 Using smart auto-detected constraint weights with live settings",
      );

      const smartWeights = this.autoDetectConstraintWeights(
        currentSettings,
        staffMembers,
        dateRange,
      );

      this.constraintWeights = smartWeights;
      console.log(`🎯 Auto-detected weights:`, this.constraintWeights);

      // Log configuration counts for transparency
      console.log(`📋 Configuration summary:`, {
        staffGroups: currentSettings.staffGroups?.length || 0,
        dailyLimits: currentSettings.dailyLimits?.length || 0,
        priorityRules: currentSettings.priorityRules?.length || 0,
        monthlyLimits: currentSettings.monthlyLimits?.length || 0,
        backupAssignments: currentSettings.backupAssignments?.length || 0,
      });
    } catch (error) {
      console.warn(
        "⚠️ Failed to load settings, using fallback weights:",
        error,
      );

      // Legacy system with dynamic adjustment as fallback
      const staffGroupsImportance = staffMembers.length > 8 ? 1.2 : 1.0;
      const timeRangeImportance = dateRange.length > 30 ? 1.1 : 1.0;

      this.constraintWeights.staffGroups *= staffGroupsImportance;
      this.constraintWeights.dailyLimits *= timeRangeImportance;

      console.log(`📊 Fallback constraint weights:`, this.constraintWeights);
    }
  }

  /**
   * Auto-detect constraint weights based on actual settings configured
   * @param {Object} settings - User settings
   * @param {Array} staffMembers - Staff members for scaling
   * @param {Array} dateRange - Date range for scaling
   * @returns {Object} Constraint weights
   */
  autoDetectConstraintWeights(settings, staffMembers, dateRange) {
    const weights = {
      staffGroups: 0.2, // Base weight
      dailyLimits: 0.2, // Base weight
      priorityRules: 0.2, // Base weight
      monthlyLimits: 0.2, // Base weight
      fairness: 0.2, // Base weight
    };

    // Apply scaling based on problem size
    const staffScale = Math.min(1.5, 1 + staffMembers.length * 0.01);
    const timeScale = Math.min(1.3, 1 + dateRange.length * 0.005);

    // Boost weights based on what they actually configured

    // If they have staff groups, prioritize group management
    const hasStaffGroups = settings?.staffGroups?.length > 0;
    if (hasStaffGroups) {
      weights.staffGroups *= 1.8 * staffScale;
      console.log("📊 Boosted staff groups weight (configured groups)");
    }

    // If they have daily limits, prioritize coverage
    const hasDailyLimits = settings?.dailyLimits?.length > 0;
    if (hasDailyLimits) {
      weights.dailyLimits *= 1.6 * timeScale;
      console.log("📊 Boosted daily limits weight (configured limits)");
    }

    // If they set priority rules, respect staff requests
    const hasPriorityRules = settings?.priorityRules?.length > 0;
    if (hasPriorityRules) {
      weights.priorityRules *= 1.7;
      console.log("📊 Boosted priority rules weight (configured rules)");
    }

    // If they have monthly limits, focus on fairness
    const hasMonthlyLimits = settings?.monthlyLimits?.length > 0;
    if (hasMonthlyLimits) {
      weights.monthlyLimits *= 1.4;
      weights.fairness *= 1.3;
      console.log("📊 Boosted monthly limits and fairness weights");
    }

    // If they have complex groups (>2 members), boost team dynamics
    const hasComplexGroups =
      hasStaffGroups && settings.staffGroups.some((g) => g.members?.length > 2);
    if (hasComplexGroups) {
      weights.staffGroups *= 1.2; // Additional boost
      console.log("📊 Additional boost for complex groups");
    }

    // If they have hard constraints, be more strict
    const hasHardConstraints =
      hasDailyLimits && settings.dailyLimits.some((l) => l.isHardConstraint);
    if (hasHardConstraints) {
      weights.dailyLimits *= 1.3; // Additional boost for hard limits
      console.log("📊 Additional boost for hard constraints");
    }

    // Normalize to ensure weights sum to ~1.0
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      Object.keys(weights).forEach((key) => {
        weights[key] = weights[key] / total;
      });
    }

    return weights;
  }

  /**
   * Apply adaptive learning based on performance history
   */
  async applyAdaptiveLearning() {
    if (
      !this.adaptiveLearning.enabled ||
      this.generationStats.performanceHistory.length <
        this.adaptiveLearning.performanceWindow
    ) {
      return;
    }

    const recentPerformance = this.generationStats.performanceHistory.slice(
      -this.adaptiveLearning.performanceWindow,
    );
    const avgScore =
      recentPerformance.reduce((sum, p) => sum + p.score, 0) /
      recentPerformance.length;
    const avgConfidence =
      recentPerformance.reduce((sum, p) => sum + p.confidence, 0) /
      recentPerformance.length;

    // Identify patterns and adjust parameters
    const strategies = recentPerformance.map((p) => p.strategy);
    const bestStrategy = this.findMostSuccessfulStrategy(recentPerformance);

    if (bestStrategy && avgScore < 85) {
      console.log(
        `🔄 Adaptive learning: adjusting parameters based on ${bestStrategy} success`,
      );
      this.adaptMLPresets(bestStrategy, avgScore, avgConfidence);
    }
  }

  // Helper methods for ML enhancements

  calculateFairnessScore(schedule, staffMembers, dateRange) {
    // Calculate how fairly shifts and off days are distributed
    const workloads = staffMembers.map((staff) =>
      this.calculateStaffWorkload(schedule[staff.id], dateRange),
    );

    const mean = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance =
      workloads.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) /
      workloads.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower standard deviation = higher fairness
    return Math.max(0, 100 - standardDeviation * 100);
  }

  calculateEfficiencyScore(schedule, staffMembers, dateRange) {
    // Calculate operational efficiency metrics
    let totalCoverage = 0;
    let optimalCoverage = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const workingStaff = staffMembers.filter(
        (staff) =>
          schedule[staff.id] &&
          schedule[staff.id][dateKey] &&
          isWorkingShift(schedule[staff.id][dateKey]),
      ).length;

      totalCoverage += workingStaff;
      optimalCoverage += Math.min(
        staffMembers.length - 2,
        staffMembers.length * 0.8,
      ); // Target 80% coverage
    });

    return Math.min(100, (totalCoverage / optimalCoverage) * 100);
  }

  getTerminationReason(
    iterations,
    maxIterations,
    runtime,
    maxRuntime,
    stagnationCount,
    maxStagnation,
  ) {
    if (iterations >= maxIterations) return "max_iterations";
    if (runtime >= maxRuntime) return "max_runtime";
    if (stagnationCount >= maxStagnation) return "stagnation";
    return "target_achieved";
  }

  calculateConsensusRate(results) {
    // Calculate how much the algorithms agree on their solutions
    // Simplified implementation - would need detailed comparison in practice
    return 0.75; // Placeholder
  }

  identifyStrengths(scores) {
    return Object.entries(scores)
      .filter(([_, score]) => score >= 85)
      .map(([metric, score]) => `${metric}: ${score.toFixed(1)}%`);
  }

  identifyWeaknesses(scores) {
    return Object.entries(scores)
      .filter(([_, score]) => score < 75)
      .map(([metric, score]) => `${metric}: ${score.toFixed(1)}%`);
  }

  /**
   * Calculate enhanced monthly limits with predictive balancing
   * @param {Array} dateRange - Date range for the schedule
   * @returns {Object} Enhanced monthly limits
   */
  async calculateEnhancedMonthlyLimits(dateRange) {
    try {
      const firstDate = dateRange[0];
      const year = firstDate.getFullYear();
      const month = firstDate.getMonth() + 1;

      // Get dynamic monthly limits from configuration
      const configLimits = await getMonthlyLimits(year, month);

      // Calculate working days and weekends in the period
      const weekends = dateRange.filter((date) => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
      }).length;

      const weekdays = dateRange.length - weekends;

      return {
        ...configLimits,
        totalDays: dateRange.length,
        weekdays,
        weekends,
        optimalOffDaysPerWeek: Math.ceil(configLimits.maxOffDaysPerMonth / 4),
        recommendedWorkRate: Math.max(
          0.6,
          Math.min(
            0.85,
            (dateRange.length - configLimits.maxOffDaysPerMonth) /
              dateRange.length,
          ),
        ),
      };
    } catch (error) {
      console.warn(
        "⚠️ Failed to calculate enhanced monthly limits, using basic calculation:",
        error,
      );
      return {
        maxOffDaysPerMonth: Math.ceil(dateRange.length * 0.25),
        minWorkDaysPerMonth: Math.floor(dateRange.length * 0.75),
        totalDays: dateRange.length,
        recommendedWorkRate: 0.75,
      };
    }
  }

  /**
   * Calculate monthly workload projections for all staff members
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Map} Projections for each staff member
   */
  async calculateMonthlyProjections(schedule, staffMembers, dateRange) {
    const projections = new Map();

    console.log("📊 Calculating monthly workload projections...");

    try {
      const monthlyLimits =
        await this.calculateEnhancedMonthlyLimits(dateRange);

      for (const staff of staffMembers) {
        const projection = await this.calculateStaffMonthlyProjection(
          staff,
          schedule[staff.id] || {},
          dateRange,
          monthlyLimits,
        );

        projections.set(staff.id, projection);
      }

      // Cache projections for potential reuse
      this.monthlyProjections = projections;

      console.log(
        `✅ Calculated projections for ${projections.size} staff members`,
      );
    } catch (error) {
      console.error("❌ Failed to calculate monthly projections:", error);
    }

    return projections;
  }

  /**
   * Calculate monthly projection for a single staff member
   * @param {Object} staff - Staff member
   * @param {Object} staffSchedule - Staff member's current schedule
   * @param {Array} dateRange - Date range
   * @param {Object} monthlyLimits - Monthly limits
   * @returns {Object} Projection data
   */
  async calculateStaffMonthlyProjection(
    staff,
    staffSchedule,
    dateRange,
    monthlyLimits,
  ) {
    const currentWorkDays = this.countWorkingDays(staffSchedule, dateRange);
    const currentOffDays = this.countStaffOffDays(staffSchedule, dateRange);
    const filledDays = this.countFilledDays(staffSchedule, dateRange);
    const remainingDays = dateRange.length - filledDays;

    // Calculate target work rate based on staff type and historical data
    const targetWorkRate =
      staff.status === "パート" ? 0.6 : monthlyLimits.recommendedWorkRate;
    const targetWorkDays = Math.floor(dateRange.length * targetWorkRate);
    const targetOffDays = Math.min(
      monthlyLimits.maxOffDaysPerMonth,
      dateRange.length - targetWorkDays,
    );

    // Calculate needed adjustments
    const workDaysNeeded = Math.max(0, targetWorkDays - currentWorkDays);
    const offDaysNeeded = Math.max(0, targetOffDays - currentOffDays);

    // Predict workload balance
    const currentWorkRate = filledDays > 0 ? currentWorkDays / filledDays : 0;
    const projectedFinalWorkRate =
      filledDays > 0
        ? (currentWorkDays + Math.max(0, remainingDays - offDaysNeeded)) /
          dateRange.length
        : targetWorkRate;

    // Calculate balance score (how close to ideal)
    const workRateDeviation = Math.abs(projectedFinalWorkRate - targetWorkRate);
    const balanceScore = Math.max(0, 100 - workRateDeviation * 200); // 200 to make it more sensitive

    return {
      staffId: staff.id,
      staffName: staff.name,
      staffType: staff.status,
      currentStats: {
        workDays: currentWorkDays,
        offDays: currentOffDays,
        filledDays,
        remainingDays,
        currentWorkRate: Math.round(currentWorkRate * 100) / 100,
      },
      targets: {
        targetWorkRate: Math.round(targetWorkRate * 100) / 100,
        targetWorkDays,
        targetOffDays,
      },
      projections: {
        projectedFinalWorkRate: Math.round(projectedFinalWorkRate * 100) / 100,
        workDaysNeeded,
        offDaysNeeded,
        balanceScore: Math.round(balanceScore),
      },
      recommendations: {
        recommendedOffDays: targetOffDays,
        priority:
          balanceScore < 70 ? "high" : balanceScore < 85 ? "medium" : "low",
        adjustmentNeeded: workRateDeviation > 0.1,
      },
    };
  }

  /**
   * Count working days in a staff schedule
   * @param {Object} staffSchedule - Staff schedule
   * @param {Array} dateRange - Date range
   * @returns {number} Number of working days
   */
  countWorkingDays(staffSchedule, dateRange) {
    let workingDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];
      if (shift !== undefined && shift !== "" && !isOffDay(shift)) {
        workingDays++;
      }
    });
    return workingDays;
  }

  /**
   * Count filled days (non-undefined entries) in a staff schedule
   * @param {Object} staffSchedule - Staff schedule
   * @param {Array} dateRange - Date range
   * @returns {number} Number of filled days
   */
  countFilledDays(staffSchedule, dateRange) {
    let filledDays = 0;
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shift = staffSchedule[dateKey];
      if (shift !== undefined && shift !== "") {
        filledDays++;
      }
    });
    return filledDays;
  }

  /**
   * Get monthly projection summary for display
   * @returns {Object} Summary of monthly projections
   */
  getMonthlyProjectionSummary() {
    if (!this.monthlyProjections || this.monthlyProjections.size === 0) {
      return {
        totalStaff: 0,
        projectionsAvailable: false,
        summary: "No projections available",
      };
    }

    const projections = Array.from(this.monthlyProjections.values());
    const highPriorityStaff = projections.filter(
      (p) => p.recommendations.priority === "high",
    );
    const averageBalance =
      projections.reduce((sum, p) => sum + p.projections.balanceScore, 0) /
      projections.length;

    return {
      totalStaff: projections.length,
      projectionsAvailable: true,
      averageBalanceScore: Math.round(averageBalance),
      highPriorityStaff: highPriorityStaff.length,
      highPriorityNames: highPriorityStaff.map((p) => p.staffName),
      summary: `${projections.length} staff projections, ${highPriorityStaff.length} need priority balancing`,
    };
  }

  findMostSuccessfulStrategy(performanceHistory) {
    const strategyPerformance = new Map();

    performanceHistory.forEach((p) => {
      const current = strategyPerformance.get(p.strategy) || {
        total: 0,
        count: 0,
      };
      current.total += p.score;
      current.count += 1;
      strategyPerformance.set(p.strategy, current);
    });

    let bestStrategy = null;
    let bestAverage = 0;

    for (const [strategy, perf] of strategyPerformance) {
      const average = perf.total / perf.count;
      if (average > bestAverage) {
        bestAverage = average;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  adaptMLPresets(bestStrategy, avgScore, avgConfidence) {
    // Adapt ML presets based on performance feedback
    const preset = this.mlPresets[bestStrategy];
    if (!preset) return;

    const adaptationRate = this.adaptiveLearning.adaptationRate;

    if (avgScore < 80) {
      // Increase exploration
      preset.mutationRate = Math.min(
        0.3,
        preset.mutationRate * (1 + adaptationRate),
      );
      preset.generations = Math.min(1000, Math.floor(preset.generations * 1.1));
    } else if (avgScore > 95 && avgConfidence > 0.9) {
      // Can reduce computational cost while maintaining quality
      preset.generations = Math.max(100, Math.floor(preset.generations * 0.9));
    }

    console.log(
      `🎯 Adapted ${bestStrategy} preset based on performance feedback`,
    );
  }
}
