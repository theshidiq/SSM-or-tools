/**
 * GeneticAlgorithm.js
 *
 * Genetic Algorithm implementation for shift schedule optimization.
 * Uses evolutionary computation to find optimal scheduling solutions.
 */

import { validateAllConstraints } from "../constraints/ConstraintEngine";

/**
 * Genetic Algorithm for schedule optimization
 */
export class GeneticAlgorithm {
  constructor() {
    this.initialized = false;
    this.parameters = {
      populationSize: 50,
      maxGenerations: 100,
      crossoverRate: 0.8,
      mutationRate: 0.1,
      elitismSize: 5,
      tournamentSize: 3,
      convergenceThreshold: 0.01,
      maxStagnantGenerations: 20,
    };
    this.fitnessFunction = null;
    this.evolutionStats = {
      totalRuns: 0,
      successfulRuns: 0,
      averageGenerations: 0,
      bestFitnessAchieved: 0,
      averageConvergenceTime: 0,
    };
  }

  /**
   * Initialize the genetic algorithm
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("🧬 Initializing Enhanced Genetic Algorithm...");

    try {
      // ✅ PHASE 2: Updated ML-optimized defaults for better diversity
      const mlOptimizedDefaults = {
        populationSize: options.populationSize || 150, // Increased from 100
        maxGenerations: options.generations || 300,
        crossoverRate: options.crossoverRate || 0.7, // Reduced from 0.8 to allow more mutation
        mutationRate: options.mutationRate || 0.2, // Increased from 0.1 for more exploration
        elitismRate: options.elitismRate || 0.05, // Reduced from 0.1 to reduce convergence pressure
        tournamentSize: 3,
        convergenceThreshold: options.convergenceThreshold || 0.01,
        maxStagnantGenerations: 50,
        enableAdaptiveMutation: options.enableAdaptiveMutation || true,
        parallelProcessing: options.parallelProcessing || true,
        diversityThreshold: 0.3, // Increased from 0.1 for earlier intervention
        nichingEnabled: true,
      };

      this.parameters = { ...this.parameters, ...mlOptimizedDefaults };

      // Set fitness function
      this.fitnessFunction =
        options.fitnessFunction || this.defaultFitnessFunction;

      // Initialize adaptive components
      this.adaptiveComponents = {
        mutationHistory: [],
        diversityHistory: [],
        performanceHistory: [],
        adaptationEnabled: this.parameters.enableAdaptiveMutation,
      };

      this.initialized = true;
      console.log("✅ Enhanced Genetic Algorithm initialized successfully");
      console.log(
        `📊 Parameters: Population=${this.parameters.populationSize}, Generations=${this.parameters.maxGenerations}, Mutation=${this.parameters.mutationRate}`,
      );
    } catch (error) {
      console.error("❌ Genetic Algorithm initialization failed:", error);
      throw error;
    }
  }

  /**
   * Enhanced evolve method compatible with ScheduleGenerator
   * @param {Object} workingSchedule - Initial schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Evolution options
   * @returns {Object} Generated schedule
   */
  async evolve(workingSchedule, staffMembers, dateRange, options = {}) {
    if (!this.initialized) {
      throw new Error("Genetic Algorithm not initialized");
    }

    console.log(
      `🧬 Starting enhanced genetic evolution for ${staffMembers.length} staff over ${dateRange.length} days...`,
    );

    try {
      const startTime = Date.now();
      const preserveFixed = options.preserveFixed !== false;

      // Initialize population with working schedule as seed
      let population = this.initializePopulation(
        staffMembers,
        dateRange,
        workingSchedule,
        preserveFixed,
      );

      // Enhanced evolution statistics
      const stats = {
        generation: 0,
        bestFitness: -Infinity,
        averageFitness: 0,
        diversity: 0,
        stagnantGenerations: 0,
        fitnessHistory: [],
        diversityHistory: [],
        adaptationHistory: [],
        bestIndividualHistory: [],
      };

      // Evolution loop with enhanced termination conditions
      while (
        stats.generation < this.parameters.maxGenerations &&
        stats.stagnantGenerations < this.parameters.maxStagnantGenerations
      ) {
        stats.generation++;

        // Evaluate population fitness
        await this.evaluatePopulation(
          population,
          this.fitnessFunction,
          staffMembers,
          dateRange,
        );

        // Calculate generation statistics
        const generationStats = this.calculateGenerationStats(population);
        const previousBestFitness = stats.bestFitness;

        stats.bestFitness = generationStats.bestFitness;
        stats.averageFitness = generationStats.averageFitness;
        stats.diversity = generationStats.diversity;

        stats.fitnessHistory.push(stats.bestFitness);
        stats.diversityHistory.push(stats.diversity);

        // Store best individual for tracking
        const currentBest = population.reduce((best, current) =>
          current.fitness > best.fitness ? current : best,
        );
        stats.bestIndividualHistory.push({
          generation: stats.generation,
          fitness: currentBest.fitness,
          schedule: JSON.parse(JSON.stringify(currentBest.schedule)),
        });

        // Adaptive mutation rate adjustment
        if (this.parameters.enableAdaptiveMutation) {
          this.adaptMutationRate(stats);
        }

        // Check for stagnation with enhanced criteria
        const improvementThreshold = this.parameters.convergenceThreshold;
        if (
          Math.abs(stats.bestFitness - previousBestFitness) <
          improvementThreshold
        ) {
          stats.stagnantGenerations++;
        } else {
          stats.stagnantGenerations = 0;
        }

        // Progress reporting
        if (stats.generation % 25 === 0 || stats.generation <= 5) {
          console.log(
            `🧬 Gen ${stats.generation}: Best=${stats.bestFitness.toFixed(2)}%, Avg=${stats.averageFitness.toFixed(2)}%, Diversity=${stats.diversity.toFixed(2)}, MutRate=${this.parameters.mutationRate.toFixed(3)}`,
          );
        }

        // Early termination for excellent fitness
        if (stats.bestFitness >= 98) {
          console.log("🎯 Excellent fitness achieved, terminating evolution");
          break;
        }

        // Create next generation with enhanced operators
        population = await this.createNextGeneration(
          population,
          this.fitnessFunction,
          staffMembers,
          dateRange,
          stats,
        );
      }

      const evolutionTime = Date.now() - startTime;

      // Get best solution
      const bestIndividual = population.reduce((best, current) =>
        current.fitness > best.fitness ? current : best,
      );

      // Update evolution statistics
      this.updateEvolutionStats(stats, evolutionTime);

      console.log(
        `✅ Evolution completed: ${stats.bestFitness.toFixed(2)}% fitness in ${evolutionTime}ms`,
      );

      // Return in format expected by ScheduleGenerator
      return bestIndividual.schedule;
    } catch (error) {
      console.error("❌ Genetic algorithm evolution failed:", error);
      throw error;
    }
  }

  /**
   * Legacy evolve method for backwards compatibility
   * @param {Object} params - Evolution parameters
   * @returns {Object} Evolution result
   */
  async evolveLegacy(params = {}) {
    if (!this.initialized) {
      throw new Error("Genetic Algorithm not initialized");
    }

    const {
      staffMembers = [],
      dateRange = [],
      initialSchedule = {},
      preserveFixed = true,
      customFitness = null,
    } = params;

    console.log("🧬 Starting genetic algorithm evolution...");

    try {
      const startTime = Date.now();

      // Initialize population
      let population = this.initializePopulation(
        staffMembers,
        dateRange,
        initialSchedule,
        preserveFixed,
      );

      // Evolution statistics
      const stats = {
        generation: 0,
        bestFitness: -Infinity,
        averageFitness: 0,
        diversity: 0,
        stagnantGenerations: 0,
        fitnessHistory: [],
        diversityHistory: [],
      };

      // Set fitness function for this run
      const fitnessFunc = customFitness || this.fitnessFunction;

      // Evolution loop
      while (
        stats.generation < this.parameters.maxGenerations &&
        stats.stagnantGenerations < this.parameters.maxStagnantGenerations
      ) {
        stats.generation++;

        // Evaluate population fitness
        await this.evaluatePopulation(
          population,
          fitnessFunc,
          staffMembers,
          dateRange,
        );

        // Calculate generation statistics
        const generationStats = this.calculateGenerationStats(population);
        const previousBestFitness = stats.bestFitness;

        stats.bestFitness = generationStats.bestFitness;
        stats.averageFitness = generationStats.averageFitness;
        stats.diversity = generationStats.diversity;

        stats.fitnessHistory.push(stats.bestFitness);
        stats.diversityHistory.push(stats.diversity);

        // Check for stagnation
        if (
          Math.abs(stats.bestFitness - previousBestFitness) <
          this.parameters.convergenceThreshold
        ) {
          stats.stagnantGenerations++;
        } else {
          stats.stagnantGenerations = 0;
        }

        console.log(
          `🧬 Generation ${stats.generation}: Best=${stats.bestFitness.toFixed(2)}, Avg=${stats.averageFitness.toFixed(2)}, Diversity=${stats.diversity.toFixed(2)}`,
        );

        // Early termination if excellent fitness achieved
        if (stats.bestFitness >= 95) {
          console.log("🎯 Excellent fitness achieved, terminating evolution");
          break;
        }

        // Create next generation
        population = await this.createNextGeneration(
          population,
          fitnessFunc,
          staffMembers,
          dateRange,
        );
      }

      const evolutionTime = Date.now() - startTime;

      // Get best solution
      const bestIndividual = population.reduce((best, current) =>
        current.fitness > best.fitness ? current : best,
      );

      // Update evolution statistics
      this.evolutionStats.totalRuns++;
      this.evolutionStats.averageGenerations =
        (this.evolutionStats.averageGenerations + stats.generation) /
        this.evolutionStats.totalRuns;

      if (stats.bestFitness > this.evolutionStats.bestFitnessAchieved) {
        this.evolutionStats.bestFitnessAchieved = stats.bestFitness;
      }

      if (stats.bestFitness >= 80) {
        this.evolutionStats.successfulRuns++;
      }

      this.evolutionStats.averageConvergenceTime =
        (this.evolutionStats.averageConvergenceTime + evolutionTime) /
        this.evolutionStats.totalRuns;

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        bestSchedule: bestIndividual.schedule,
        bestFitness: bestIndividual.fitness,
        generations: stats.generation,
        evolutionTime,
        convergenceReason:
          stats.generation >= this.parameters.maxGenerations
            ? "max_generations"
            : stats.stagnantGenerations >=
                this.parameters.maxStagnantGenerations
              ? "stagnation"
              : "early_termination",
        finalPopulationStats: {
          bestFitness: stats.bestFitness,
          averageFitness: stats.averageFitness,
          diversity: stats.diversity,
          populationSize: population.length,
        },
        evolutionHistory: {
          fitnessHistory: stats.fitnessHistory,
          diversityHistory: stats.diversityHistory,
        },
        parameters: { ...this.parameters },
        metadata: {
          algorithm: "genetic_algorithm",
          staffCount: staffMembers.length,
          dateCount: dateRange.length,
          searchSpaceSize: Math.pow(4, staffMembers.length * dateRange.length),
        },
      };

      console.log(
        `✅ Evolution completed in ${evolutionTime}ms after ${stats.generation} generations`,
      );
      console.log(`📊 Best fitness: ${stats.bestFitness.toFixed(2)}%`);

      return result;
    } catch (error) {
      console.error("❌ Genetic algorithm evolution failed:", error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        evolutionTime: 0,
        generations: 0,
      };
    }
  }

  /**
   * Initialize population with random individuals
   * ✅ PHASE 2: Multi-strategy initialization for diversity
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} initialSchedule - Initial schedule (if any)
   * @param {boolean} preserveFixed - Whether to preserve fixed assignments
   * @returns {Array} Initial population
   */
  initializePopulation(
    staffMembers,
    dateRange,
    initialSchedule,
    preserveFixed,
  ) {
    const population = [];
    const possibleShifts = ["○", "△", "◇", "×"]; // Normal, Early, Late, Off

    // ✅ PHASE 2: Multi-strategy initialization (40% random, 30% constraint, 20% pattern, 10% seeded)
    const strategies = {
      random: Math.floor(this.parameters.populationSize * 0.4),
      constraint: Math.floor(this.parameters.populationSize * 0.3),
      pattern: Math.floor(this.parameters.populationSize * 0.2),
      seeded: Math.floor(this.parameters.populationSize * 0.1),
    };

    console.log(`🧬 [INIT] Multi-strategy initialization: Random=${strategies.random}, Constraint=${strategies.constraint}, Pattern=${strategies.pattern}, Seeded=${strategies.seeded}`);

    for (let i = 0; i < this.parameters.populationSize; i++) {
      // Unique seed per individual for true randomness
      const individualSeed = i * 1000 + Date.now();
      const seededRandom = () => {
        const x = Math.sin(individualSeed + population.length) * 10000;
        return x - Math.floor(x);
      };

      // Determine strategy for this individual
      let strategy;
      if (i < strategies.random) {
        strategy = 'random';
      } else if (i < strategies.random + strategies.constraint) {
        strategy = 'constraint';
      } else if (i < strategies.random + strategies.constraint + strategies.pattern) {
        strategy = 'pattern';
      } else {
        strategy = 'seeded';
      }

      const individual = {
        schedule: {},
        fitness: 0,
        age: 0,
        id: `gen0_ind${i}`,
        strategy: strategy, // Track strategy for debugging
      };

      // Initialize schedule for each staff member
      staffMembers.forEach((staff) => {
        individual.schedule[staff.id] = {};

        dateRange.forEach((date, dateIdx) => {
          const dateKey = date.toISOString().split("T")[0];
          const dayOfWeek = date.getDay();

          // Preserve fixed assignments if specified
          if (
            preserveFixed &&
            initialSchedule[staff.id] &&
            initialSchedule[staff.id][dateKey] !== undefined &&
            initialSchedule[staff.id][dateKey] !== ""
          ) {
            individual.schedule[staff.id][dateKey] =
              initialSchedule[staff.id][dateKey];
          } else {
            let shift;

            switch (strategy) {
              case 'random':
                // ✅ FIX: Equal probabilities (25% each) instead of 50% normal bias
                const randomValue = seededRandom();
                if (randomValue < 0.25) {
                  shift = "○"; // Normal
                } else if (randomValue < 0.5) {
                  shift = "×"; // Off
                } else if (randomValue < 0.75) {
                  shift = "△"; // Early
                } else {
                  shift = "◇"; // Late
                }
                break;

              case 'constraint':
                // Constraint-focused: Respect typical patterns
                // Weekends more likely off, weekdays more likely working
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                  shift = seededRandom() < 0.4 ? "×" : (seededRandom() < 0.5 ? "△" : "○");
                } else {
                  shift = seededRandom() < 0.6 ? "○" : (seededRandom() < 0.8 ? "△" : "◇");
                }
                break;

              case 'pattern':
                // Pattern-based: Common shift patterns
                // Rotating pattern: Early week → Normal mid-week → Late end
                const weekPhase = dateIdx % 7;
                if (weekPhase < 2) {
                  shift = "△"; // Early in week
                } else if (weekPhase < 5) {
                  shift = "○"; // Normal mid-week
                } else if (weekPhase === 5) {
                  shift = "◇"; // Late Friday
                } else {
                  shift = "×"; // Off weekend
                }
                break;

              case 'seeded':
                // Seeded from initial schedule (if available) or balanced distribution
                if (initialSchedule && initialSchedule[staff.id] && initialSchedule[staff.id][dateKey]) {
                  shift = initialSchedule[staff.id][dateKey] || "○";
                } else {
                  // Balanced: ~20% off, ~30% early, ~30% late, ~20% normal
                  const seedValue = seededRandom();
                  if (seedValue < 0.2) {
                    shift = "×";
                  } else if (seedValue < 0.5) {
                    shift = "△";
                  } else if (seedValue < 0.8) {
                    shift = "◇";
                  } else {
                    shift = "○";
                  }
                }
                break;

              default:
                shift = "○";
            }

            individual.schedule[staff.id][dateKey] = shift;
          }
        });
      });

      population.push(individual);
    }

    // Log strategy distribution
    const strategyCounts = population.reduce((acc, ind) => {
      acc[ind.strategy] = (acc[ind.strategy] || 0) + 1;
      return acc;
    }, {});
    console.log(`🧬 [INIT] Strategy distribution:`, strategyCounts);

    return population;
  }

  /**
   * Evaluate fitness for entire population
   * @param {Array} population - Population to evaluate
   * @param {Function} fitnessFunc - Fitness function
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   */
  async evaluatePopulation(population, fitnessFunc, staffMembers, dateRange) {
    for (const individual of population) {
      individual.fitness = await fitnessFunc(
        individual.schedule,
        staffMembers,
        dateRange,
      );
      individual.age++;
    }
  }

  /**
   * Default fitness function
   * ✅ PHASE 3: Enhanced with diversity and fairness metrics
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fitness score (0-100)
   */
  async defaultFitnessFunction(schedule, staffMembers, dateRange) {
    try {
      // Constraint validation (50% of fitness - reduced from 70%)
      const validation = validateAllConstraints(
        schedule,
        staffMembers,
        dateRange,
      );
      let constraintScore = validation.valid ? 100 : 0;

      if (!validation.valid) {
        const violationPenalty =
          validation.summary.criticalViolations * 20 +
          validation.summary.highViolations * 10 +
          validation.summary.mediumViolations * 5;
        constraintScore = Math.max(0, 100 - violationPenalty);
      }

      // Workload balance (15% of fitness - reduced from 20%)
      const balanceScore = this.calculateWorkloadBalance(
        schedule,
        staffMembers,
        dateRange,
      );

      // Shift distribution (10% of fitness - unchanged)
      const distributionScore = this.calculateShiftDistribution(
        schedule,
        staffMembers,
        dateRange,
      );

      // ✅ NEW: Fairness score (15% of fitness)
      const fairnessScore = this.calculateFairnessScore(
        schedule,
        staffMembers,
        dateRange,
      );

      // ✅ NEW: Diversity score (10% of fitness)
      const diversityScore = this.calculateDiversityScore(
        schedule,
        staffMembers,
        dateRange,
      );

      // ✅ PHASE 3: Updated weighted fitness
      // 50% constraint + 15% balance + 10% distribution + 15% fairness + 10% diversity = 100%
      const fitness =
        constraintScore * 0.5 +
        balanceScore * 0.15 +
        distributionScore * 0.1 +
        fairnessScore * 0.15 +
        diversityScore * 0.1;

      return Math.min(100, Math.max(0, fitness));
    } catch (error) {
      console.error("Error in fitness calculation:", error);
      return 0;
    }
  }

  /**
   * Calculate workload balance score
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Balance score (0-100)
   */
  calculateWorkloadBalance(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) => {
      let workingDays = 0;
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift !== undefined && shift !== "×" && shift !== "off") {
          workingDays++;
        }
      });
      return workingDays / dateRange.length;
    });

    if (workloads.length === 0) return 100;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance =
      workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) /
      workloads.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 100 - stdDev * 200);
  }

  /**
   * Calculate shift distribution score
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Distribution score (0-100)
   */
  calculateShiftDistribution(schedule, staffMembers, dateRange) {
    const shiftCounts = { normal: 0, early: 0, late: 0, off: 0 };

    staffMembers.forEach((staff) => {
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id]?.[dateKey];

        if (shift === "△") shiftCounts.early++;
        else if (shift === "◇") shiftCounts.late++;
        else if (shift === "×") shiftCounts.off++;
        else shiftCounts.normal++;
      });
    });

    const totalShifts = Object.values(shiftCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (totalShifts === 0) return 100;

    // Prefer normal shifts, balanced early/late, reasonable off days
    const normalRatio = shiftCounts.normal / totalShifts;
    const earlyRatio = shiftCounts.early / totalShifts;
    const lateRatio = shiftCounts.late / totalShifts;
    const offRatio = shiftCounts.off / totalShifts;

    let score = 0;
    score += normalRatio * 50; // Prefer normal shifts
    score += Math.min(earlyRatio, 0.3) * 100; // Up to 30% early is good
    score += Math.min(lateRatio, 0.2) * 150; // Up to 20% late is good
    score += Math.min(offRatio, 0.25) * 80; // Up to 25% off is reasonable

    return Math.min(100, score);
  }

  /**
   * ✅ PHASE 3: Calculate fairness score
   * Measures how fairly shifts are distributed across staff
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fairness score (0-100)
   */
  calculateFairnessScore(schedule, staffMembers, dateRange) {
    if (!schedule || !staffMembers || staffMembers.length === 0) {
      return 0;
    }

    // Calculate workload (working days) variance
    const workloads = staffMembers.map(staff => {
      let workingDays = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift && shift !== '×') workingDays++;
      });
      return workingDays;
    });

    // Calculate off days variance
    const offDays = staffMembers.map(staff => {
      let offs = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift === '×') offs++;
      });
      return offs;
    });

    // Calculate early/late shift variance
    const earlyShifts = staffMembers.map(staff => {
      let count = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        if (schedule[staff.id]?.[dateKey] === '△') count++;
      });
      return count;
    });

    const lateShifts = staffMembers.map(staff => {
      let count = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        if (schedule[staff.id]?.[dateKey] === '◇') count++;
      });
      return count;
    });

    // Calculate variances
    const workloadVar = this.variance(workloads);
    const offDayVar = this.variance(offDays);
    const earlyVar = this.variance(earlyShifts);
    const lateVar = this.variance(lateShifts);
    const shiftTypeVar = (earlyVar + lateVar) / 2;

    // Convert to fairness scores (lower variance = higher fairness)
    const maxReasonableVar = 10; // days squared
    const workloadFairness = Math.max(0, 100 - (workloadVar / maxReasonableVar) * 100);
    const offDayFairness = Math.max(0, 100 - (offDayVar / maxReasonableVar) * 100);
    const shiftTypeFairness = Math.max(0, 100 - (shiftTypeVar / maxReasonableVar) * 100);

    // Weighted overall fairness
    return (
      workloadFairness * 0.4 +
      offDayFairness * 0.3 +
      shiftTypeFairness * 0.3
    );
  }

  /**
   * ✅ PHASE 3: Calculate diversity score
   * Measures pattern uniqueness and schedule differences
   * @param {Object} schedule - Schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Diversity score (0-100)
   */
  calculateDiversityScore(schedule, staffMembers, dateRange) {
    if (!schedule || !staffMembers || staffMembers.length < 2) {
      return 0;
    }

    // Extract patterns for each staff
    const patterns = staffMembers.map(staff => {
      if (!schedule[staff.id]) return '';
      return dateRange.map(date => {
        const dateKey = date.toISOString().split('T')[0];
        return schedule[staff.id][dateKey] || '○';
      }).join('');
    }).filter(p => p.length > 0);

    if (patterns.length === 0) return 0;

    // Count unique patterns
    const uniquePatterns = new Set(patterns);
    const patternDiversity = (uniquePatterns.size / patterns.length) * 100;

    // Calculate average Hamming distance
    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        let differences = 0;
        const len = Math.min(patterns[i].length, patterns[j].length);
        for (let k = 0; k < len; k++) {
          if (patterns[i][k] !== patterns[j][k]) differences++;
        }
        totalDistance += (differences / len);
        comparisons++;
      }
    }

    const hammingDistance = comparisons > 0 ? (totalDistance / comparisons) * 100 : 0;

    // Weighted diversity score
    return (
      patternDiversity * 0.6 +  // 60% unique patterns
      hammingDistance * 0.4      // 40% average difference
    );
  }

  /**
   * Helper: Calculate variance
   * @param {Array} values - Numeric values
   * @returns {number} Variance
   */
  variance(values) {
    if (!values || values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * ✅ PHASE 4: Calculate generation statistics with active similarity monitoring
   * @param {Array} population - Current population
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Generation statistics with similarity metrics
   */
  calculateGenerationStats(population, staffMembers = null, dateRange = null) {
    const fitnesses = population.map((ind) => ind.fitness);
    const bestFitness = Math.max(...fitnesses);
    const averageFitness =
      fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;

    // Calculate diversity using fitness variance
    const variance =
      fitnesses.reduce((sum, f) => sum + Math.pow(f - averageFitness, 2), 0) /
      fitnesses.length;
    const diversity = Math.sqrt(variance);

    const stats = {
      bestFitness,
      averageFitness,
      diversity,
      worstFitness: Math.min(...fitnesses),
    };

    // ✅ PHASE 4: Active similarity monitoring
    if (staffMembers && dateRange && population.length > 1) {
      // Calculate average pairwise similarity (Hamming distance)
      let totalSimilarity = 0;
      let comparisons = 0;

      for (let i = 0; i < Math.min(population.length, 20); i++) {
        for (let j = i + 1; j < Math.min(population.length, 20); j++) {
          let differences = 0;
          let totalCells = 0;

          staffMembers.forEach(staff => {
            dateRange.forEach(date => {
              const dateKey = date.toISOString().split('T')[0];
              const shift1 = population[i].chromosome[staff.id]?.[dateKey];
              const shift2 = population[j].chromosome[staff.id]?.[dateKey];
              if (shift1 && shift2) {
                totalCells++;
                if (shift1 !== shift2) differences++;
              }
            });
          });

          if (totalCells > 0) {
            // Similarity = 1 - (differences / totalCells)
            const similarity = 1 - (differences / totalCells);
            totalSimilarity += similarity;
            comparisons++;
          }
        }
      }

      if (comparisons > 0) {
        stats.averageSimilarity = totalSimilarity / comparisons;
        stats.uniquenessScore = 1 - stats.averageSimilarity; // Higher is better
      }
    }

    return stats;
  }

  /**
   * Create next generation with enhanced genetic operators
   * @param {Array} population - Current population
   * @param {Function} fitnessFunc - Fitness function
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} stats - Evolution statistics
   * @returns {Array} Next generation population
   */
  async createNextGeneration(
    population,
    fitnessFunc,
    staffMembers,
    dateRange,
    stats = {},
  ) {
    const nextGeneration = [];

    // Enhanced elitism with diversity preservation
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const elitismSize = Math.floor(
      this.parameters.populationSize * this.parameters.elitismRate,
    );
    const elite = sorted.slice(0, elitismSize);

    // Add elite individuals
    nextGeneration.push(
      ...elite.map((ind) => ({
        ...ind,
        age: ind.age + 1,
        id: `${ind.id}_elite_gen${stats.generation || 0}`,
      })),
    );

    // ✅ PHASE 4: Enhanced diversity injection (15-20% vs previous 5-10%)
    // Inject diverse individuals when population converges OR periodically
    const shouldInjectDiversity =
      stats.diversity < this.parameters.diversityThreshold ||
      (stats.generation && stats.generation % 10 === 0); // Periodic injection every 10 generations

    if (shouldInjectDiversity) {
      // Increase from 5-10% to 15-20% of population
      const diversityRate = stats.diversity < this.parameters.diversityThreshold * 0.5
        ? 0.20  // Aggressive injection when very low diversity
        : 0.15; // Regular injection

      const numDiverse = Math.floor(this.parameters.populationSize * diversityRate);
      const diverseIndividuals = this.generateDiverseIndividuals(
        staffMembers,
        dateRange,
        numDiverse,
      );
      nextGeneration.push(...diverseIndividuals);
    }

    // Generate offspring to fill remaining population
    while (nextGeneration.length < this.parameters.populationSize) {
      // Selection
      const parent1 = this.tournamentSelection(population);
      const parent2 = this.tournamentSelection(population);

      // ✅ PHASE 4: Enhanced crossover with multiple strategies
      let offspring1, offspring2;
      if (Math.random() < this.parameters.crossoverRate) {
        // Use different crossover strategies dynamically
        const crossoverStrategy = this.selectCrossoverStrategy(stats.generation);
        [offspring1, offspring2] = this.crossover(
          parent1,
          parent2,
          staffMembers,
          dateRange,
          crossoverStrategy,
        );
      } else {
        offspring1 = this.clone(parent1);
        offspring2 = this.clone(parent2);
      }

      // Enhanced mutation with adaptive strategies
      if (Math.random() < this.parameters.mutationRate) {
        this.enhancedMutate(offspring1, staffMembers, dateRange, stats);
      }
      if (Math.random() < this.parameters.mutationRate) {
        this.enhancedMutate(offspring2, staffMembers, dateRange, stats);
      }

      // Add offspring to next generation with proper tracking
      offspring1.age = 0;
      offspring2.age = 0;
      offspring1.id = `gen${stats.generation || 0}_off${nextGeneration.length}`;
      offspring2.id = `gen${stats.generation || 0}_off${nextGeneration.length + 1}`;
      offspring1.parentIds = [parent1.id, parent2.id];
      offspring2.parentIds = [parent1.id, parent2.id];

      nextGeneration.push(offspring1);
      if (nextGeneration.length < this.parameters.populationSize) {
        nextGeneration.push(offspring2);
      }
    }

    return nextGeneration.slice(0, this.parameters.populationSize);
  }

  /**
   * ✅ PHASE 4: Apply fitness sharing to promote diversity (niching)
   * Reduces fitness of similar individuals to maintain population diversity
   * @param {Array} population - Population
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {number} sharingRadius - Similarity threshold (0-1)
   * @returns {Array} Population with shared fitness values
   */
  applyFitnessSharing(population, staffMembers, dateRange, sharingRadius = 0.3) {
    if (!staffMembers || !dateRange || population.length < 2) {
      return population;
    }

    const sharedPopulation = population.map((individual, idx) => {
      let nichingCount = 0;

      // Calculate similarity with all other individuals
      for (let j = 0; j < population.length; j++) {
        if (idx === j) continue;

        // Calculate Hamming distance
        let differences = 0;
        let totalCells = 0;

        staffMembers.forEach(staff => {
          dateRange.forEach(date => {
            const dateKey = date.toISOString().split('T')[0];
            const shift1 = individual.chromosome[staff.id]?.[dateKey];
            const shift2 = population[j].chromosome[staff.id]?.[dateKey];
            if (shift1 && shift2) {
              totalCells++;
              if (shift1 !== shift2) differences++;
            }
          });
        });

        if (totalCells > 0) {
          const distance = differences / totalCells; // 0 = identical, 1 = completely different
          const similarity = 1 - distance;

          // Sharing function: if similarity > radius, penalize
          if (similarity > (1 - sharingRadius)) {
            // Linear sharing function
            nichingCount += 1 - (distance / sharingRadius);
          }
        }
      }

      // Shared fitness = original fitness / niche count
      const sharedFitness = nichingCount > 0
        ? individual.fitness / (1 + nichingCount)
        : individual.fitness;

      return {
        ...individual,
        originalFitness: individual.fitness,
        sharedFitness: sharedFitness,
        fitness: sharedFitness, // Use shared fitness for selection
        nichingCount: nichingCount,
      };
    });

    return sharedPopulation;
  }

  /**
   * Tournament selection (now uses shared fitness when available)
   * @param {Array} population - Population to select from
   * @returns {Object} Selected individual
   */
  tournamentSelection(population) {
    const tournament = [];

    for (let i = 0; i < this.parameters.tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    return tournament.reduce((best, current) =>
      current.fitness > best.fitness ? current : best,
    );
  }

  /**
   * ✅ PHASE 4: Select crossover strategy dynamically
   * @param {number} generation - Current generation number
   * @returns {string} Selected crossover strategy
   */
  selectCrossoverStrategy(generation = 0) {
    // Use different strategies at different stages of evolution
    const random = Math.random();

    // Early generations (0-20): favor staff-level for building blocks
    if (generation < 20) {
      if (random < 0.5) return 'staff-level';
      else if (random < 0.8) return 'multi-point';
      else return 'uniform';
    }
    // Mid generations (20-50): balanced mix
    else if (generation < 50) {
      if (random < 0.35) return 'staff-level';
      else if (random < 0.7) return 'multi-point';
      else return 'uniform';
    }
    // Late generations (50+): favor fine-grained exploration
    else {
      if (random < 0.25) return 'staff-level';
      else if (random < 0.5) return 'multi-point';
      else if (random < 0.85) return 'uniform';
      else return 'single-point';
    }
  }

  /**
   * ✅ PHASE 4: Enhanced crossover with multiple strategies
   * @param {Object} parent1 - First parent
   * @param {Object} parent2 - Second parent
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {string} strategy - Crossover strategy: 'staff-level', 'multi-point', 'uniform', 'single-point'
   * @returns {Array} Two offspring
   */
  crossover(parent1, parent2, staffMembers, dateRange, strategy = 'staff-level') {
    const offspring1 = { schedule: {}, fitness: 0, age: 0 };
    const offspring2 = { schedule: {}, fitness: 0, age: 0 };

    // Initialize schedules
    staffMembers.forEach(staff => {
      offspring1.schedule[staff.id] = {};
      offspring2.schedule[staff.id] = {};
    });

    switch (strategy) {
      case 'staff-level':
        // ✅ PHASE 4: Staff-level crossover - swap entire staff schedules
        staffMembers.forEach((staff) => {
          const useParent1 = Math.random() < 0.5;
          if (useParent1) {
            offspring1.schedule[staff.id] = { ...parent1.schedule[staff.id] };
            offspring2.schedule[staff.id] = { ...parent2.schedule[staff.id] };
          } else {
            offspring1.schedule[staff.id] = { ...parent2.schedule[staff.id] };
            offspring2.schedule[staff.id] = { ...parent1.schedule[staff.id] };
          }
        });
        break;

      case 'multi-point':
        // ✅ PHASE 4: Multi-point crossover - use 2-3 crossover points
        const numPoints = 2 + Math.floor(Math.random() * 2); // 2 or 3 points
        const points = [];
        for (let i = 0; i < numPoints; i++) {
          points.push(Math.floor(Math.random() * dateRange.length));
        }
        points.sort((a, b) => a - b);

        staffMembers.forEach((staff) => {
          dateRange.forEach((date, index) => {
            const dateKey = date.toISOString().split("T")[0];
            // Count how many points we've passed
            const pointsPassed = points.filter(p => index >= p).length;
            const useParent1 = pointsPassed % 2 === 0;

            offspring1.schedule[staff.id][dateKey] = useParent1
              ? parent1.schedule[staff.id][dateKey]
              : parent2.schedule[staff.id][dateKey];
            offspring2.schedule[staff.id][dateKey] = useParent1
              ? parent2.schedule[staff.id][dateKey]
              : parent1.schedule[staff.id][dateKey];
          });
        });
        break;

      case 'uniform':
        // Uniform crossover - each gene has 50% chance from either parent
        staffMembers.forEach((staff) => {
          dateRange.forEach((date) => {
            const dateKey = date.toISOString().split("T")[0];
            const useParent1 = Math.random() < 0.5;

            offspring1.schedule[staff.id][dateKey] = useParent1
              ? parent1.schedule[staff.id][dateKey]
              : parent2.schedule[staff.id][dateKey];
            offspring2.schedule[staff.id][dateKey] = useParent1
              ? parent2.schedule[staff.id][dateKey]
              : parent1.schedule[staff.id][dateKey];
          });
        });
        break;

      default: // 'single-point' (original behavior)
        staffMembers.forEach((staff) => {
          const crossoverPoint = Math.floor(Math.random() * dateRange.length);

          dateRange.forEach((date, index) => {
            const dateKey = date.toISOString().split("T")[0];

            if (index < crossoverPoint) {
              offspring1.schedule[staff.id][dateKey] =
                parent1.schedule[staff.id][dateKey];
              offspring2.schedule[staff.id][dateKey] =
                parent2.schedule[staff.id][dateKey];
            } else {
              offspring1.schedule[staff.id][dateKey] =
                parent2.schedule[staff.id][dateKey];
              offspring2.schedule[staff.id][dateKey] =
                parent1.schedule[staff.id][dateKey];
            }
          });
        });
    }

    return [offspring1, offspring2];
  }

  /**
   * Mutation operation
   * @param {Object} individual - Individual to mutate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   */
  mutate(individual, staffMembers, dateRange) {
    const __possibleShifts = ["", "△", "◇", "×"];
    const mutationCount = Math.max(
      1,
      Math.floor(staffMembers.length * dateRange.length * 0.01),
    ); // 1% mutation rate

    for (let i = 0; i < mutationCount; i++) {
      const randomStaff =
        staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate =
        dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split("T")[0];

      const currentShift = individual.schedule[randomStaff.id][dateKey];
      let newShift;

      do {
        newShift =
          __possibleShifts[Math.floor(Math.random() * __possibleShifts.length)];
      } while (newShift === currentShift);

      individual.schedule[randomStaff.id][dateKey] = newShift;
    }
  }

  /**
   * Clone an individual
   * @param {Object} individual - Individual to clone
   * @returns {Object} Cloned individual
   */
  clone(individual) {
    return {
      schedule: JSON.parse(JSON.stringify(individual.schedule)),
      fitness: individual.fitness,
      age: individual.age,
      id: individual.id + "_clone",
    };
  }

  /**
   * Get enhanced algorithm status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      parameters: { ...this.parameters },
      statistics: { ...this.evolutionStats },
      adaptiveComponents: {
        enabled: this.adaptiveComponents?.adaptationEnabled || false,
        currentMutationRate: this.parameters.mutationRate,
        adaptationHistory:
          this.adaptiveComponents?.mutationHistory?.slice(-10) || [],
      },
      successRate:
        this.evolutionStats.totalRuns > 0
          ? (this.evolutionStats.successfulRuns /
              this.evolutionStats.totalRuns) *
            100
          : 0,
      averageQuality: this.evolutionStats.bestFitnessAchieved,
      algorithmType: "enhanced_genetic_algorithm",
    };
  }

  // Enhanced genetic operators and helper methods

  /**
   * Adapt mutation rate based on population diversity and performance
   * @param {Object} stats - Current evolution statistics
   */
  adaptMutationRate(stats) {
    if (!this.adaptiveComponents.adaptationEnabled) return;

    const baseRate = 0.1;
    const minRate = 0.01;
    const maxRate = 0.3;

    // Increase mutation if diversity is low or fitness is stagnating
    let adaptedRate = baseRate;

    if (stats.diversity < this.parameters.diversityThreshold) {
      adaptedRate = Math.min(maxRate, baseRate * 1.5); // Increase for diversity
    }

    if (stats.stagnantGenerations > 10) {
      adaptedRate = Math.min(
        maxRate,
        baseRate * (1 + stats.stagnantGenerations * 0.1),
      );
    }

    if (stats.bestFitness > 90) {
      adaptedRate = Math.max(minRate, baseRate * 0.5); // Reduce for fine-tuning
    }

    this.parameters.mutationRate = adaptedRate;

    // Track adaptation history
    this.adaptiveComponents.mutationHistory.push({
      generation: stats.generation,
      rate: adaptedRate,
      diversity: stats.diversity,
      fitness: stats.bestFitness,
    });

    // Keep only recent history
    if (this.adaptiveComponents.mutationHistory.length > 50) {
      this.adaptiveComponents.mutationHistory =
        this.adaptiveComponents.mutationHistory.slice(-50);
    }
  }

  /**
   * Select crossover strategy based on evolution progress
   * @param {number} generation - Current generation
   * @returns {string} Crossover strategy
   */
  selectCrossoverStrategy(generation) {
    if (generation < 50) {
      return "uniform"; // Exploration phase
    } else if (generation < 150) {
      return "single_point"; // Balanced phase
    } else {
      return "two_point"; // Exploitation phase
    }
  }

  /**
   * Enhanced crossover with multiple strategies
   * @param {Object} parent1 - First parent
   * @param {Object} parent2 - Second parent
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {string} strategy - Crossover strategy
   * @returns {Array} Two offspring
   */
  enhancedCrossover(
    parent1,
    parent2,
    staffMembers,
    dateRange,
    strategy = "single_point",
  ) {
    switch (strategy) {
      case "uniform":
        return this.uniformCrossover(parent1, parent2, staffMembers, dateRange);
      case "two_point":
        return this.twoPointCrossover(
          parent1,
          parent2,
          staffMembers,
          dateRange,
        );
      default:
        return this.crossover(parent1, parent2, staffMembers, dateRange);
    }
  }

  /**
   * Uniform crossover operator
   */
  uniformCrossover(parent1, parent2, staffMembers, dateRange) {
    const offspring1 = { schedule: {}, fitness: 0, age: 0 };
    const offspring2 = { schedule: {}, fitness: 0, age: 0 };

    staffMembers.forEach((staff) => {
      offspring1.schedule[staff.id] = {};
      offspring2.schedule[staff.id] = {};

      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];

        if (Math.random() < 0.5) {
          offspring1.schedule[staff.id][dateKey] =
            parent1.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] =
            parent2.schedule[staff.id][dateKey];
        } else {
          offspring1.schedule[staff.id][dateKey] =
            parent2.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] =
            parent1.schedule[staff.id][dateKey];
        }
      });
    });

    return [offspring1, offspring2];
  }

  /**
   * Two-point crossover operator
   */
  twoPointCrossover(parent1, parent2, staffMembers, dateRange) {
    const offspring1 = { schedule: {}, fitness: 0, age: 0 };
    const offspring2 = { schedule: {}, fitness: 0, age: 0 };

    staffMembers.forEach((staff) => {
      offspring1.schedule[staff.id] = {};
      offspring2.schedule[staff.id] = {};

      const point1 = Math.floor(Math.random() * dateRange.length);
      const point2 = Math.floor(Math.random() * dateRange.length);
      const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];

      dateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split("T")[0];

        if (index >= start && index < end) {
          offspring1.schedule[staff.id][dateKey] =
            parent2.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] =
            parent1.schedule[staff.id][dateKey];
        } else {
          offspring1.schedule[staff.id][dateKey] =
            parent1.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] =
            parent2.schedule[staff.id][dateKey];
        }
      });
    });

    return [offspring1, offspring2];
  }

  /**
   * Enhanced mutation with adaptive strategies
   * @param {Object} individual - Individual to mutate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} stats - Evolution statistics
   */
  enhancedMutate(individual, staffMembers, dateRange, stats) {
    const __possibleShifts = ["", "△", "◇", "×"];

    // Adaptive mutation intensity based on fitness and diversity
    let mutationIntensity = 0.02; // Base 2%

    if (stats.diversity < this.parameters.diversityThreshold) {
      mutationIntensity *= 2; // Increase for low diversity
    }

    if (individual.fitness < stats.averageFitness) {
      mutationIntensity *= 1.5; // More mutation for poor individuals
    }

    const mutationCount = Math.max(
      1,
      Math.floor(staffMembers.length * dateRange.length * mutationIntensity),
    );

    for (let i = 0; i < mutationCount; i++) {
      const randomStaff =
        staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate =
        dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split("T")[0];

      const currentShift = individual.schedule[randomStaff.id][dateKey];

      // Smart mutation - prefer shifts that improve balance
      const newShift = this.selectSmartMutation(
        currentShift,
        __possibleShifts,
        individual,
        randomStaff.id,
        dateKey,
        dateRange,
      );
      individual.schedule[randomStaff.id][dateKey] = newShift;
    }
  }

  /**
   * Smart mutation that considers schedule balance
   */
  selectSmartMutation(
    currentShift,
    _possibleShifts,
    individual,
    staffId,
    dateKey,
    dateRange,
  ) {
    // Calculate current workload for this staff member
    let currentWorkload = 0;
    dateRange.forEach((date) => {
      const dk = date.toISOString().split("T")[0];
      const shift = individual.schedule[staffId][dk];
      if (shift !== "×" && shift !== "off") {
        currentWorkload++;
      }
    });

    const workloadRatio = currentWorkload / dateRange.length;

    // Bias mutation based on workload
    if (workloadRatio > 0.8) {
      // High workload - prefer off days
      return Math.random() < 0.7
        ? "×"
        : _possibleShifts[Math.floor(Math.random() * _possibleShifts.length)];
    } else if (workloadRatio < 0.5) {
      // Low workload - avoid off days
      const workingShifts = _possibleShifts.filter((s) => s !== "×");
      return workingShifts[Math.floor(Math.random() * workingShifts.length)];
    }

    // Balanced workload - random mutation
    let newShift;
    do {
      newShift =
        _possibleShifts[Math.floor(Math.random() * _possibleShifts.length)];
    } while (newShift === currentShift);

    return newShift;
  }

  /**
   * Generate diverse individuals to maintain population diversity
   */
  generateDiverseIndividuals(staffMembers, dateRange, count) {
    const diverse = [];
    const __possibleShifts = ["", "△", "◇", "×"];

    for (let i = 0; i < count; i++) {
      const individual = {
        schedule: {},
        fitness: 0,
        age: 0,
        id: `diverse_${i}`,
      };

      staffMembers.forEach((staff) => {
        individual.schedule[staff.id] = {};

        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          // Random assignment with different bias than initial population
          const random = Math.random();
          if (random < 0.4) {
            individual.schedule[staff.id][dateKey] = ""; // Normal
          } else if (random < 0.6) {
            individual.schedule[staff.id][dateKey] = "×"; // Off
          } else if (random < 0.8) {
            individual.schedule[staff.id][dateKey] = "△"; // Early
          } else {
            individual.schedule[staff.id][dateKey] = "◇"; // Late
          }
        });
      });

      diverse.push(individual);
    }

    return diverse;
  }

  /**
   * Update evolution statistics
   */
  updateEvolutionStats(stats, evolutionTime) {
    this.evolutionStats.totalRuns++;
    this.evolutionStats.averageGenerations =
      (this.evolutionStats.averageGenerations + stats.generation) /
      this.evolutionStats.totalRuns;

    if (stats.bestFitness > this.evolutionStats.bestFitnessAchieved) {
      this.evolutionStats.bestFitnessAchieved = stats.bestFitness;
    }

    if (stats.bestFitness >= 80) {
      this.evolutionStats.successfulRuns++;
    }

    this.evolutionStats.averageConvergenceTime =
      (this.evolutionStats.averageConvergenceTime + evolutionTime) /
      this.evolutionStats.totalRuns;
  }
}
