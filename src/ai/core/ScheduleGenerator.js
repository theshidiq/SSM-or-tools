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
  STAFF_CONFLICT_GROUPS,
  PRIORITY_RULES,
  getMonthlyLimits,
  validateAllConstraints,
} from "../constraints/ConstraintEngine";
import BackupStaffService from "../../services/BackupStaffService";
import { GeneticAlgorithm } from "../algorithms/GeneticAlgorithm";
import { SimulatedAnnealing } from "../algorithms/SimulatedAnnealing";
import { EnsembleScheduler } from "../ml/EnsembleScheduler";

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
      staffGroups: 0.3,
      dailyLimits: 0.25,
      priorityRules: 0.2,
      monthlyLimits: 0.15,
      fairness: 0.1,
    };

    // Performance adaptation settings
    this.adaptiveLearning = {
      enabled: true,
      performanceWindow: 10,
      improvementThreshold: 0.05,
      adaptationRate: 0.1,
    };
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
      this.initializeShiftPriorities();

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

      this.initialized = true;
      console.log("✅ Schedule Generator initialized successfully");
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
   * Initialize shift priorities based on business rules
   */
  initializeShiftPriorities() {
    // Day of week priorities
    this.shiftPriorities.set("sunday_early", {
      priority: "high",
      staff: "料理長",
      condition: (dateKey) => getDayOfWeek(dateKey) === "sunday",
      shift: "△",
      weight: 0.8,
    });

    this.shiftPriorities.set("sunday_off", {
      priority: "high",
      staff: "与儀",
      condition: (dateKey) => getDayOfWeek(dateKey) === "sunday",
      shift: "×",
      weight: 0.8,
    });

    // Coverage priorities
    this.shiftPriorities.set("group2_coverage", {
      priority: "critical",
      staff: "中田",
      condition: (dateKey, schedule, staffMembers) => {
        // Check if Group 2 members (料理長 or 古藤) have day off
        const group2 = STAFF_CONFLICT_GROUPS.find((g) => g.name === "Group 2");
        if (!group2) return false;

        return group2.members.some((memberName) => {
          const staff = staffMembers.find((s) => s.name === memberName);
          if (staff && schedule[staff.id] && schedule[staff.id][dateKey]) {
            return isOffDay(schedule[staff.id][dateKey]);
          }
          return false;
        });
      },
      shift: "", // Normal shift
      weight: 1.0,
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
      await this.updateConstraintWeights(staffMembers, dateRange, params.settings);

      // Initialize working schedule
      const workingSchedule = this.initializeWorkingSchedule(
        staffMembers,
        dateRange,
        existingSchedule,
        preserveExisting,
      );

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

      const result = {
        success: bestSchedule !== null,
        schedule: bestSchedule?.schedule || workingSchedule,
        score: bestScore,
        confidence: confidenceScore,
        strategy: strategy,
        algorithm: mlConfig.algorithm,
        generationTime,
        iterations,
        qualityMetrics,
        constraintAnalysis: qualityMetrics.constraintAnalysis,
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
        },
        statistics: { ...this.generationStats },
      };

      console.log(`✅ Schedule generation completed in ${generationTime}ms`);
      console.log(
        `📊 Best score: ${bestScore.toFixed(2)}% | Confidence: ${(confidenceScore * 100).toFixed(1)}% | Algorithm: ${mlConfig.algorithm}`,
      );
      console.log(`🎯 Quality metrics:`, qualityMetrics.summary);

      return result;
    } catch (error) {
      console.error("❌ Schedule generation failed:", error);
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
   * Priority-first generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async priorityFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;

    // Phase 1: Apply priority rules first
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
            }
          }
        }
      }
    });

    // Phase 2: Fill remaining positions with balanced approach
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];

      // Count current assignments for the day
      const dayCounts = this.countDayAssignments(
        workingSchedule,
        dateKey,
        staffMembers,
      );

      // Apply group constraints and daily limits
      staffMembers.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          // Assign based on constraints and balance
          const suggestedShift = this.suggestShiftForStaff(
            staff,
            dateKey,
            workingSchedule,
            staffMembers,
            dayCounts,
          );

          if (suggestedShift) {
            workingSchedule[staff.id][dateKey] = suggestedShift;
            changesApplied++;
          }
        }
      });
    });

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
        balanceScore: this.calculateBalanceScore(
          finalSchedule,
          staffMembers,
          dateRange,
        ),
      },
    };
  }

  /**
   * Balance-first generation strategy
   * @param {Object} schedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Strategy options
   * @returns {Object} Updated schedule with analysis
   */
  async balanceFirstStrategy(schedule, staffMembers, dateRange, options = {}) {
    const workingSchedule = JSON.parse(JSON.stringify(schedule));
    let changesApplied = 0;

    // Calculate monthly limits for each staff member
    const monthlyLimits = this.calculateMonthlyLimits(dateRange);
    const staffOffDayBudgets = new Map();

    staffMembers.forEach((staff) => {
      const currentOffDays = this.countStaffOffDays(
        workingSchedule[staff.id],
        dateRange,
      );
      staffOffDayBudgets.set(
        staff.id,
        monthlyLimits.maxOffDaysPerMonth - currentOffDays,
      );
    });

    // Sort dates by difficulty (weekends first, then special constraint days)
    const sortedDates = [...dateRange].sort((a, b) => {
      const aDifficulty = this.calculateDateDifficulty(a);
      const bDifficulty = this.calculateDateDifficulty(b);
      return bDifficulty - aDifficulty;
    });

    // Fill schedule date by date, balancing as we go
    sortedDates.forEach((date) => {
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

      // Assign shifts for this day
      let assignedCount = 0;
      const maxOffPerDay = 4; // DAILY_LIMITS.maxOffPerDay

      staffByWorkload.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          const staffOffBudget = staffOffDayBudgets.get(staff.id) || 0;
          const currentDayOffCount = this.countDayOffAssignments(
            workingSchedule,
            dateKey,
            staffMembers,
          );

          // Decide shift type based on balance and constraints
          let assignedShift = "";

          // Consider giving day off if under budget and daily limit allows
          if (
            staffOffBudget > 0 &&
            currentDayOffCount < maxOffPerDay &&
            assignedCount < staffMembers.length - 3
          ) {
            // More likely to give day off if staff has high workload
            const workload = this.calculateStaffWorkload(
              workingSchedule[staff.id],
              dateRange,
            );
            const avgWorkload = this.calculateAverageWorkload(
              workingSchedule,
              staffMembers,
              dateRange,
            );

            if (workload > avgWorkload * 1.1) {
              assignedShift = "×";
              staffOffDayBudgets.set(staff.id, staffOffBudget - 1);
            }
          }

          // If not assigned day off, assign working shift
          if (assignedShift === "") {
            assignedShift = this.selectWorkingShift(
              staff,
              dateKey,
              workingSchedule,
              staffMembers,
            );
          }

          workingSchedule[staff.id][dateKey] = assignedShift;
          changesApplied++;
          assignedCount++;
        }
      });
    });

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
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      staffMembers.forEach((staff) => {
        if (workingSchedule[staff.id][dateKey] === "") {
          const staffPattern = this.staffPatterns.get(staff.id);
          if (staffPattern) {
            const suggestedShift = this.predictShiftFromPattern(
              staff,
              dateKey,
              dayOfWeek,
              staffPattern,
              workingSchedule,
            );

            if (suggestedShift) {
              // Validate against constraints before applying
              if (
                this.validateShiftAssignment(
                  staff,
                  dateKey,
                  suggestedShift,
                  workingSchedule,
                  staffMembers,
                )
              ) {
                workingSchedule[staff.id][dateKey] = suggestedShift;
                changesApplied++;
                patternMatches++;
              }
            }
          }
        }
      });
    });

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
  suggestShiftForStaff(staff, dateKey, schedule, staffMembers, dayCounts) {
    const dayOfWeek = getDayOfWeek(dateKey);

    // Check priority rules first
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
    const canTakeOffDay =
      currentOffDays < monthlyLimits.maxOffDaysPerMonth && dayCounts.off < 4;

    // Check group constraints
    const hasGroupConflict = this.checkGroupConflicts(
      staff,
      dateKey,
      "×",
      schedule,
      staffMembers,
    );

    // Decision logic
    if (canTakeOffDay && !hasGroupConflict && Math.random() < 0.2) {
      return "×"; // Day off
    }

    // Assign working shift based on day and needs
    if (
      dayOfWeek === "sunday" &&
      staff.name === "料理長" &&
      dayCounts.early < 2
    ) {
      return "△"; // Early shift for head chef on Sunday
    }

    if (dayCounts.early < 3 && Math.random() < 0.3) {
      return "△"; // Early shift
    }

    if (dayCounts.late < 2 && Math.random() < 0.2) {
      return "◇"; // Late shift
    }

    return ""; // Normal shift
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
  calculateMonthlyLimits(dateRange) {
    if (dateRange.length === 0) return { maxOffDaysPerMonth: 7 };
    const firstDate = dateRange[0];
    return getMonthlyLimits(firstDate.getFullYear(), firstDate.getMonth() + 1);
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

  checkPriorityRules(staff, dateKey, schedule, staffMembers) {
    // Implementation for checking priority rules
    // Return shift if priority rule applies, null otherwise
    return null;
  }

  checkGroupConflicts(staff, dateKey, proposedShift, schedule, staffMembers) {
    // Check if proposed shift would create group conflicts
    return false;
  }

  selectWorkingShift(staff, dateKey, schedule, staffMembers) {
    // Logic to select appropriate working shift
    return ""; // Default to normal shift
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

  validateShiftAssignment(staff, dateKey, shift, schedule, staffMembers) {
    // Validate if shift assignment is allowed
    return true;
  }

  fillRemainingSlots(schedule, staffMembers, dateRange) {
    // Fill any remaining empty slots with balanced approach
    let changesApplied = 0;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      staffMembers.forEach((staff) => {
        if (schedule[staff.id][dateKey] === "") {
          schedule[staff.id][dateKey] = "";
          changesApplied++;
        }
      });
    });

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
   * Get generator status
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
    };
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
    if (settings) {
      // Use smart auto-detection system
      console.log("🧠 Using smart auto-detected constraint weights");
      
      const smartWeights = this.autoDetectConstraintWeights(
        settings,
        staffMembers,
        dateRange
      );
      
      this.constraintWeights = smartWeights;
      console.log(`🎯 Auto-detected weights:`, this.constraintWeights);
    } else {
      // Legacy system with dynamic adjustment
      const staffGroupsImportance = staffMembers.length > 8 ? 1.2 : 1.0;
      const timeRangeImportance = dateRange.length > 30 ? 1.1 : 1.0;

      this.constraintWeights.staffGroups *= staffGroupsImportance;
      this.constraintWeights.dailyLimits *= timeRangeImportance;

      console.log(`📊 Legacy constraint weights:`, this.constraintWeights);
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
      staffGroups: 0.2,     // Base weight
      dailyLimits: 0.2,     // Base weight  
      priorityRules: 0.2,   // Base weight
      monthlyLimits: 0.2,   // Base weight
      fairness: 0.2,        // Base weight
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
    const hasComplexGroups = hasStaffGroups && 
      settings.staffGroups.some(g => g.members?.length > 2);
    if (hasComplexGroups) {
      weights.staffGroups *= 1.2; // Additional boost
      console.log("📊 Additional boost for complex groups");
    }

    // If they have hard constraints, be more strict
    const hasHardConstraints = hasDailyLimits && 
      settings.dailyLimits.some(l => l.isHardConstraint);
    if (hasHardConstraints) {
      weights.dailyLimits *= 1.3; // Additional boost for hard limits
      console.log("📊 Additional boost for hard constraints");
    }

    // Normalize to ensure weights sum to ~1.0
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      Object.keys(weights).forEach(key => {
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
