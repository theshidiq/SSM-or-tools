/**
 * SimulatedAnnealing.js
 *
 * Simulated Annealing algorithm implementation for shift schedule optimization.
 * Uses probabilistic hill climbing to escape local optima and find better solutions.
 */

import {
  validateAllConstraints,
  isOffDay,
  isWorkingShift,
} from "../constraints/ConstraintEngine";

/**
 * Simulated Annealing algorithm for schedule optimization
 */
export class SimulatedAnnealing {
  constructor() {
    this.initialized = false;
    this.parameters = {
      initialTemperature: 1000,
      finalTemperature: 0.1,
      coolingRate: 0.95,
      maxIterations: 1000,
      movesPerTemperature: 50,
      reheatThreshold: 100,
      acceptanceProbabilityThreshold: 0.01,
    };
    this.fitnessFunction = null;
    this.annealingStats = {
      totalRuns: 0,
      successfulRuns: 0,
      averageIterations: 0,
      bestFitnessAchieved: 0,
      averageConvergenceTime: 0,
      acceptanceRate: 0,
      reheatingEvents: 0,
    };
  }

  /**
   * Initialize the simulated annealing algorithm
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log("🔥 Initializing Enhanced Simulated Annealing...");

    try {
      // Update parameters with ML-optimized defaults
      const mlOptimizedDefaults = {
        initialTemperature: options.initialTemperature || 1000,
        finalTemperature: options.minTemperature || 0.1,
        coolingRate: options.coolingRate || 0.95,
        maxIterations: options.maxIterations || 1000,
        movesPerTemperature: 50,
        reheatThreshold: 100,
        adaptiveCooling: true,
        enableReheating: true,
        acceptanceProbabilityThreshold: 0.01,
      };

      this.parameters = { ...this.parameters, ...mlOptimizedDefaults };

      // Set fitness function
      this.fitnessFunction =
        options.fitnessFunction || this.defaultFitnessFunction;

      // Initialize adaptive components
      this.adaptiveComponents = {
        temperatureHistory: [],
        acceptanceHistory: [],
        performanceHistory: [],
        adaptiveCoolingEnabled: this.parameters.adaptiveCooling,
        reheatingEnabled: this.parameters.enableReheating,
      };

      this.initialized = true;
      console.log("✅ Enhanced Simulated Annealing initialized successfully");
      console.log(
        `🌡️ Parameters: InitTemp=${this.parameters.initialTemperature}, CoolingRate=${this.parameters.coolingRate}, MaxIter=${this.parameters.maxIterations}`,
      );
    } catch (error) {
      console.error("❌ Simulated Annealing initialization failed:", error);
      throw error;
    }
  }

  /**
   * Annealing method compatible with ScheduleGenerator
   * @param {Object} workingSchedule - Initial schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Annealing options
   * @returns {Object} Generated schedule
   */
  async anneal(workingSchedule, staffMembers, dateRange, _options = {}) {
    if (!this.initialized) {
      throw new Error("Simulated Annealing not initialized");
    }

    console.log(
      `🔥 Starting enhanced simulated annealing for ${staffMembers.length} staff over ${dateRange.length} days...`,
    );

    try {
      const startTime = Date.now();

      // Initialize current solution
      let currentSolution = JSON.parse(JSON.stringify(workingSchedule));
      let currentFitness = await this.fitnessFunction(
        currentSolution,
        staffMembers,
        dateRange,
      );

      // Track best solution
      let bestSolution = JSON.parse(JSON.stringify(currentSolution));
      let bestFitness = currentFitness;

      // Annealing state
      let temperature = this.parameters.initialTemperature;
      let iteration = 0;
      let acceptedMoves = 0;
      let totalMoves = 0;
      let stagnationCount = 0;

      // Enhanced tracking
      const stats = {
        iteration: 0,
        temperature: temperature,
        currentFitness: currentFitness,
        bestFitness: bestFitness,
        acceptanceRate: 0,
        temperatureHistory: [],
        fitnessHistory: [],
        acceptanceHistory: [],
      };

      console.log(`🔥 Initial solution fitness: ${currentFitness.toFixed(2)}%`);

      // Main annealing loop
      while (
        temperature > this.parameters.finalTemperature &&
        iteration < this.parameters.maxIterations
      ) {
        let movesAtThisTemperature = 0;
        let acceptedAtThisTemperature = 0;

        // Moves at current temperature
        while (movesAtThisTemperature < this.parameters.movesPerTemperature) {
          iteration++;
          movesAtThisTemperature++;
          totalMoves++;
          stats.iteration = iteration;

          // Generate neighbor solution
          const neighborSolution = this.generateNeighbor(
            currentSolution,
            staffMembers,
            dateRange,
          );
          const neighborFitness = await this.fitnessFunction(
            neighborSolution,
            staffMembers,
            dateRange,
          );

          // Calculate acceptance probability
          const deltaFitness = neighborFitness - currentFitness;
          const acceptanceProbability = this.calculateAcceptanceProbability(
            deltaFitness,
            temperature,
          );

          // Accept or reject the move
          if (deltaFitness > 0 || Math.random() < acceptanceProbability) {
            currentSolution = neighborSolution;
            currentFitness = neighborFitness;
            acceptedMoves++;
            acceptedAtThisTemperature++;

            // Update best solution if necessary
            if (neighborFitness > bestFitness) {
              bestSolution = JSON.parse(JSON.stringify(neighborSolution));
              bestFitness = neighborFitness;
              stagnationCount = 0;
              console.log(
                `🎯 New best: ${bestFitness.toFixed(2)}% at iteration ${iteration}, temp=${temperature.toFixed(2)}`,
              );
            }
          }

          // Early termination for excellent solutions
          if (bestFitness >= 98) {
            console.log("🏆 Excellent fitness achieved, terminating annealing");
            break;
          }
        }

        // Update statistics
        const currentAcceptanceRate =
          totalMoves > 0 ? acceptedMoves / totalMoves : 0;
        stats.temperature = temperature;
        stats.currentFitness = currentFitness;
        stats.bestFitness = bestFitness;
        stats.acceptanceRate = currentAcceptanceRate;

        stats.temperatureHistory.push(temperature);
        stats.fitnessHistory.push(bestFitness);
        stats.acceptanceHistory.push(currentAcceptanceRate);

        // Adaptive cooling rate adjustment
        if (this.parameters.adaptiveCooling) {
          temperature = this.adaptiveCooling(
            temperature,
            acceptedAtThisTemperature,
            movesAtThisTemperature,
            stats,
          );
        } else {
          temperature *= this.parameters.coolingRate;
        }

        // Reheating mechanism for escaping local optima
        if (
          this.parameters.enableReheating &&
          stagnationCount > this.parameters.reheatThreshold
        ) {
          temperature = this.reheat(temperature, stats);
          stagnationCount = 0;
          this.annealingStats.reheatingEvents++;
        }

        stagnationCount++;

        // Progress reporting
        if (
          iteration % 100 === 0 ||
          temperature <= this.parameters.finalTemperature
        ) {
          console.log(
            `🔥 Iteration ${iteration}: Best=${bestFitness.toFixed(2)}%, Current=${currentFitness.toFixed(2)}%, Temp=${temperature.toFixed(2)}, AcceptRate=${(currentAcceptanceRate * 100).toFixed(1)}%`,
          );
        }

        // Break if temperature is too low or excellent solution found
        if (
          temperature <= this.parameters.finalTemperature ||
          bestFitness >= 98
        ) {
          break;
        }
      }

      const annealingTime = Date.now() - startTime;

      // Update annealing statistics
      this.updateAnnealingStats(
        stats,
        annealingTime,
        acceptedMoves,
        totalMoves,
      );

      console.log(
        `✅ Annealing completed: ${bestFitness.toFixed(2)}% fitness in ${annealingTime}ms`,
      );
      console.log(
        `📊 Final stats: ${iteration} iterations, ${((acceptedMoves / totalMoves) * 100).toFixed(1)}% acceptance rate`,
      );

      // Return in format expected by ScheduleGenerator
      return bestSolution;
    } catch (error) {
      console.error("❌ Simulated annealing failed:", error);
      throw error;
    }
  }

  /**
   * Generate a neighbor solution by making small modifications
   * @param {Object} currentSolution - Current schedule solution
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Neighbor solution
   */
  generateNeighbor(currentSolution, staffMembers, dateRange) {
    const neighbor = JSON.parse(JSON.stringify(currentSolution));
    const possibleShifts = ["", "△", "◇", "×"];

    // Number of changes to make (adaptive based on problem size)
    const changeCount = Math.max(
      1,
      Math.floor(Math.sqrt(staffMembers.length * dateRange.length) * 0.1),
    );

    for (let i = 0; i < changeCount; i++) {
      // Select random staff and date
      const randomStaff =
        staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate =
        dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split("T")[0];

      // Get current shift
      const currentShift = neighbor[randomStaff.id][dateKey];

      // Select new shift (different from current)
      let newShift;
      do {
        newShift =
          possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
      } while (newShift === currentShift);

      neighbor[randomStaff.id][dateKey] = newShift;
    }

    return neighbor;
  }

  /**
   * Calculate acceptance probability using Boltzmann distribution
   * @param {number} deltaFitness - Change in fitness
   * @param {number} temperature - Current temperature
   * @returns {number} Acceptance probability
   */
  calculateAcceptanceProbability(deltaFitness, temperature) {
    if (deltaFitness > 0) {
      return 1.0; // Always accept improvements
    }

    if (temperature <= 0) {
      return 0.0; // No acceptance at zero temperature
    }

    // Boltzmann probability
    return Math.exp(deltaFitness / temperature);
  }

  /**
   * Adaptive cooling rate based on acceptance rate and performance
   * @param {number} temperature - Current temperature
   * @param {number} acceptedMoves - Moves accepted at this temperature
   * @param {number} totalMoves - Total moves at this temperature
   * @param {Object} stats - Current statistics
   * @returns {number} New temperature
   */
  adaptiveCooling(temperature, acceptedMoves, totalMoves, stats) {
    const acceptanceRate = totalMoves > 0 ? acceptedMoves / totalMoves : 0;
    let coolingRate = this.parameters.coolingRate;

    // Adjust cooling rate based on acceptance rate
    if (acceptanceRate > 0.8) {
      coolingRate = 0.99; // Slow cooling if accepting too many moves
    } else if (acceptanceRate < 0.1) {
      coolingRate = 0.9; // Fast cooling if accepting too few moves
    } else if (acceptanceRate > 0.4 && acceptanceRate < 0.6) {
      coolingRate = 0.95; // Optimal range
    }

    // Adjust based on fitness improvement rate
    if (stats.fitnessHistory.length > 5) {
      const recentImprovement =
        stats.bestFitness -
        stats.fitnessHistory[stats.fitnessHistory.length - 5];
      if (recentImprovement < 0.1) {
        coolingRate = Math.min(0.98, coolingRate * 1.02); // Slower cooling if no improvement
      }
    }

    return temperature * coolingRate;
  }

  /**
   * Reheat the system to escape local optima
   * @param {number} currentTemperature - Current temperature
   * @param {Object} stats - Current statistics
   * @returns {number} New temperature after reheating
   */
  reheat(currentTemperature, _stats) {
    // Reheat to a fraction of initial temperature
    const reheatTemperature = this.parameters.initialTemperature * 0.3;

    console.log(
      `🔥 Reheating: ${currentTemperature.toFixed(2)} → ${reheatTemperature.toFixed(2)}`,
    );

    return reheatTemperature;
  }

  /**
   * Default fitness function for simulated annealing
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fitness score (0-100)
   */
  async defaultFitnessFunction(schedule, staffMembers, dateRange) {
    try {
      // Use constraint validation as primary fitness
      const validation = await validateAllConstraints(
        schedule,
        staffMembers,
        dateRange,
        [],
      );
      let constraintScore = validation.valid ? 100 : 0;

      if (!validation.valid) {
        const violationPenalty =
          validation.summary.criticalViolations * 25 +
          validation.summary.highViolations * 15 +
          validation.summary.mediumViolations * 8;
        constraintScore = Math.max(0, 100 - violationPenalty);
      }

      // Add balance and distribution scores
      const balanceScore = this.calculateWorkloadBalance(
        schedule,
        staffMembers,
        dateRange,
      );
      const distributionScore = this.calculateShiftDistribution(
        schedule,
        staffMembers,
        dateRange,
      );
      const efficiencyScore = this.calculateEfficiencyScore(
        schedule,
        staffMembers,
        dateRange,
      );

      // Weighted fitness calculation
      const fitness =
        constraintScore * 0.6 +
        balanceScore * 0.2 +
        distributionScore * 0.1 +
        efficiencyScore * 0.1;

      return Math.min(100, Math.max(0, fitness));
    } catch (error) {
      console.error("Error in SA fitness calculation:", error);
      return 0;
    }
  }

  /**
   * Calculate workload balance score
   */
  calculateWorkloadBalance(schedule, staffMembers, dateRange) {
    const workloads = staffMembers.map((staff) => {
      let workingDays = 0;
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift !== undefined && !isOffDay(shift)) {
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
   */
  calculateShiftDistribution(schedule, staffMembers, dateRange) {
    const shiftCounts = { normal: 0, early: 0, late: 0, off: 0 };

    staffMembers.forEach((staff) => {
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        const shift = schedule[staff.id]?.[dateKey];

        if (shift === "△") shiftCounts.early++;
        else if (shift === "◇") shiftCounts.late++;
        else if (isOffDay(shift)) shiftCounts.off++;
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
   * Calculate efficiency score
   */
  calculateEfficiencyScore(schedule, staffMembers, dateRange) {
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

  /**
   * Update annealing statistics
   */
  updateAnnealingStats(stats, annealingTime, acceptedMoves, totalMoves) {
    this.annealingStats.totalRuns++;
    this.annealingStats.averageIterations =
      (this.annealingStats.averageIterations + stats.iteration) /
      this.annealingStats.totalRuns;

    if (stats.bestFitness > this.annealingStats.bestFitnessAchieved) {
      this.annealingStats.bestFitnessAchieved = stats.bestFitness;
    }

    if (stats.bestFitness >= 80) {
      this.annealingStats.successfulRuns++;
    }

    this.annealingStats.averageConvergenceTime =
      (this.annealingStats.averageConvergenceTime + annealingTime) /
      this.annealingStats.totalRuns;

    const acceptanceRate = totalMoves > 0 ? acceptedMoves / totalMoves : 0;
    this.annealingStats.acceptanceRate =
      (this.annealingStats.acceptanceRate + acceptanceRate) /
      this.annealingStats.totalRuns;
  }

  /**
   * Get algorithm status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      parameters: { ...this.parameters },
      statistics: { ...this.annealingStats },
      adaptiveComponents: {
        adaptiveCoolingEnabled:
          this.adaptiveComponents?.adaptiveCoolingEnabled || false,
        reheatingEnabled: this.adaptiveComponents?.reheatingEnabled || false,
        reheatingEvents: this.annealingStats.reheatingEvents,
      },
      successRate:
        this.annealingStats.totalRuns > 0
          ? (this.annealingStats.successfulRuns /
              this.annealingStats.totalRuns) *
            100
          : 0,
      averageQuality: this.annealingStats.bestFitnessAchieved,
      algorithmType: "enhanced_simulated_annealing",
    };
  }
}
