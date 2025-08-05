/**
 * GeneticAlgorithm.js
 * 
 * Genetic Algorithm implementation for shift schedule optimization.
 * Uses evolutionary computation to find optimal scheduling solutions.
 */

import { validateAllConstraints } from '../constraints/ConstraintEngine';

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
      maxStagnantGenerations: 20
    };
    this.fitnessFunction = null;
    this.evolutionStats = {
      totalRuns: 0,
      successfulRuns: 0,
      averageGenerations: 0,
      bestFitnessAchieved: 0,
      averageConvergenceTime: 0
    };
  }

  /**
   * Initialize the genetic algorithm
   * @param {Object} options - Initialization options
   */
  initialize(options = {}) {
    console.log('🧬 Initializing Genetic Algorithm...');
    
    try {
      // Update parameters if provided
      if (options.parameters) {
        this.parameters = { ...this.parameters, ...options.parameters };
      }

      // Set fitness function
      this.fitnessFunction = options.fitnessFunction || this.defaultFitnessFunction;
      
      this.initialized = true;
      console.log('✅ Genetic Algorithm initialized successfully');
      
    } catch (error) {
      console.error('❌ Genetic Algorithm initialization failed:', error);
      throw error;
    }
  }

  /**
   * Evolve a population to find optimal schedule
   * @param {Object} params - Evolution parameters
   * @returns {Object} Evolution result
   */
  async evolve(params = {}) {
    if (!this.initialized) {
      throw new Error('Genetic Algorithm not initialized');
    }

    const {
      staffMembers = [],
      dateRange = [],
      initialSchedule = {},
      preserveFixed = true,
      customFitness = null
    } = params;

    console.log('🧬 Starting genetic algorithm evolution...');
    
    try {
      const startTime = Date.now();
      
      // Initialize population
      let population = this.initializePopulation(
        staffMembers, 
        dateRange, 
        initialSchedule, 
        preserveFixed
      );

      // Evolution statistics
      const stats = {
        generation: 0,
        bestFitness: -Infinity,
        averageFitness: 0,
        diversity: 0,
        stagnantGenerations: 0,
        fitnessHistory: [],
        diversityHistory: []
      };

      // Set fitness function for this run
      const fitnessFunc = customFitness || this.fitnessFunction;

      // Evolution loop
      while (stats.generation < this.parameters.maxGenerations && 
             stats.stagnantGenerations < this.parameters.maxStagnantGenerations) {
        
        stats.generation++;

        // Evaluate population fitness
        await this.evaluatePopulation(population, fitnessFunc, staffMembers, dateRange);

        // Calculate generation statistics
        const generationStats = this.calculateGenerationStats(population);
        const previousBestFitness = stats.bestFitness;
        
        stats.bestFitness = generationStats.bestFitness;
        stats.averageFitness = generationStats.averageFitness;
        stats.diversity = generationStats.diversity;
        
        stats.fitnessHistory.push(stats.bestFitness);
        stats.diversityHistory.push(stats.diversity);

        // Check for stagnation
        if (Math.abs(stats.bestFitness - previousBestFitness) < this.parameters.convergenceThreshold) {
          stats.stagnantGenerations++;
        } else {
          stats.stagnantGenerations = 0;
        }

        console.log(`🧬 Generation ${stats.generation}: Best=${stats.bestFitness.toFixed(2)}, Avg=${stats.averageFitness.toFixed(2)}, Diversity=${stats.diversity.toFixed(2)}`);

        // Early termination if excellent fitness achieved
        if (stats.bestFitness >= 95) {
          console.log('🎯 Excellent fitness achieved, terminating evolution');
          break;
        }

        // Create next generation
        population = await this.createNextGeneration(population, fitnessFunc, staffMembers, dateRange);
      }

      const evolutionTime = Date.now() - startTime;

      // Get best solution
      const bestIndividual = population.reduce((best, current) => 
        current.fitness > best.fitness ? current : best
      );

      // Update evolution statistics
      this.evolutionStats.totalRuns++;
      this.evolutionStats.averageGenerations = 
        (this.evolutionStats.averageGenerations + stats.generation) / this.evolutionStats.totalRuns;
      
      if (stats.bestFitness > this.evolutionStats.bestFitnessAchieved) {
        this.evolutionStats.bestFitnessAchieved = stats.bestFitness;
      }

      if (stats.bestFitness >= 80) {
        this.evolutionStats.successfulRuns++;
      }

      this.evolutionStats.averageConvergenceTime = 
        (this.evolutionStats.averageConvergenceTime + evolutionTime) / this.evolutionStats.totalRuns;

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        bestSchedule: bestIndividual.schedule,
        bestFitness: bestIndividual.fitness,
        generations: stats.generation,
        evolutionTime,
        convergenceReason: stats.generation >= this.parameters.maxGenerations ? 
          'max_generations' : 
          stats.stagnantGenerations >= this.parameters.maxStagnantGenerations ? 
            'stagnation' : 'early_termination',
        finalPopulationStats: {
          bestFitness: stats.bestFitness,
          averageFitness: stats.averageFitness,
          diversity: stats.diversity,
          populationSize: population.length
        },
        evolutionHistory: {
          fitnessHistory: stats.fitnessHistory,
          diversityHistory: stats.diversityHistory
        },
        parameters: { ...this.parameters },
        metadata: {
          algorithm: 'genetic_algorithm',
          staffCount: staffMembers.length,
          dateCount: dateRange.length,
          searchSpaceSize: Math.pow(4, staffMembers.length * dateRange.length)
        }
      };

      console.log(`✅ Evolution completed in ${evolutionTime}ms after ${stats.generation} generations`);
      console.log(`📊 Best fitness: ${stats.bestFitness.toFixed(2)}%`);

      return result;

    } catch (error) {
      console.error('❌ Genetic algorithm evolution failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        evolutionTime: 0,
        generations: 0
      };
    }
  }

  /**
   * Initialize population with random individuals
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} initialSchedule - Initial schedule (if any)
   * @param {boolean} preserveFixed - Whether to preserve fixed assignments
   * @returns {Array} Initial population
   */
  initializePopulation(staffMembers, dateRange, initialSchedule, preserveFixed) {
    const population = [];
    const possibleShifts = ['', '△', '◇', '×'];

    for (let i = 0; i < this.parameters.populationSize; i++) {
      const individual = {
        schedule: {},
        fitness: 0,
        age: 0,
        id: `gen0_ind${i}`
      };

      // Initialize schedule for each staff member
      staffMembers.forEach(staff => {
        individual.schedule[staff.id] = {};
        
        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          
          // Preserve fixed assignments if specified
          if (preserveFixed && 
              initialSchedule[staff.id] && 
              initialSchedule[staff.id][dateKey] !== undefined &&
              initialSchedule[staff.id][dateKey] !== '') {
            individual.schedule[staff.id][dateKey] = initialSchedule[staff.id][dateKey];
          } else {
            // Random assignment with bias toward normal shifts
            const random = Math.random();
            if (random < 0.5) {
              individual.schedule[staff.id][dateKey] = ''; // Normal shift
            } else if (random < 0.7) {
              individual.schedule[staff.id][dateKey] = '×'; // Off day
            } else if (random < 0.85) {
              individual.schedule[staff.id][dateKey] = '△'; // Early shift
            } else {
              individual.schedule[staff.id][dateKey] = '◇'; // Late shift
            }
          }
        });
      });

      population.push(individual);
    }

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
      individual.fitness = await fitnessFunc(individual.schedule, staffMembers, dateRange);
      individual.age++;
    }
  }

  /**
   * Default fitness function
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fitness score (0-100)
   */
  async defaultFitnessFunction(schedule, staffMembers, dateRange) {
    try {
      // Constraint validation (70% of fitness)
      const validation = validateAllConstraints(schedule, staffMembers, dateRange);
      let constraintScore = validation.valid ? 100 : 0;
      
      if (!validation.valid) {
        const violationPenalty = validation.summary.criticalViolations * 20 + 
                               validation.summary.highViolations * 10 + 
                               validation.summary.mediumViolations * 5;
        constraintScore = Math.max(0, 100 - violationPenalty);
      }

      // Workload balance (20% of fitness)
      const balanceScore = this.calculateWorkloadBalance(schedule, staffMembers, dateRange);

      // Shift distribution (10% of fitness)
      const distributionScore = this.calculateShiftDistribution(schedule, staffMembers, dateRange);

      // Weighted fitness
      const fitness = (constraintScore * 0.7) + (balanceScore * 0.2) + (distributionScore * 0.1);
      
      return Math.min(100, Math.max(0, fitness));

    } catch (error) {
      console.error('Error in fitness calculation:', error);
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
    const workloads = staffMembers.map(staff => {
      let workingDays = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift !== undefined && shift !== '×' && shift !== 'off') {
          workingDays++;
        }
      });
      return workingDays / dateRange.length;
    });

    if (workloads.length === 0) return 100;

    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / workloads.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 100 - (stdDev * 200));
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

    staffMembers.forEach(staff => {
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey];
        
        if (shift === '△') shiftCounts.early++;
        else if (shift === '◇') shiftCounts.late++;
        else if (shift === '×') shiftCounts.off++;
        else shiftCounts.normal++;
      });
    });

    const totalShifts = Object.values(shiftCounts).reduce((sum, count) => sum + count, 0);
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
   * Calculate generation statistics
   * @param {Array} population - Current population
   * @returns {Object} Generation statistics
   */
  calculateGenerationStats(population) {
    const fitnesses = population.map(ind => ind.fitness);
    const bestFitness = Math.max(...fitnesses);
    const averageFitness = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
    
    // Calculate diversity using fitness variance
    const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - averageFitness, 2), 0) / fitnesses.length;
    const diversity = Math.sqrt(variance);

    return {
      bestFitness,
      averageFitness,
      diversity,
      worstFitness: Math.min(...fitnesses)
    };
  }

  /**
   * Create next generation using selection, crossover, and mutation
   * @param {Array} population - Current population
   * @param {Function} fitnessFunc - Fitness function
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Array} Next generation population
   */
  async createNextGeneration(population, fitnessFunc, staffMembers, dateRange) {
    const nextGeneration = [];

    // Elitism - keep best individuals
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const elite = sorted.slice(0, this.parameters.elitismSize);
    nextGeneration.push(...elite.map(ind => ({ ...ind, age: ind.age + 1 })));

    // Generate offspring to fill remaining population
    while (nextGeneration.length < this.parameters.populationSize) {
      // Selection
      const parent1 = this.tournamentSelection(population);
      const parent2 = this.tournamentSelection(population);

      // Crossover
      let offspring1, offspring2;
      if (Math.random() < this.parameters.crossoverRate) {
        [offspring1, offspring2] = this.crossover(parent1, parent2, staffMembers, dateRange);
      } else {
        offspring1 = this.clone(parent1);
        offspring2 = this.clone(parent2);
      }

      // Mutation
      if (Math.random() < this.parameters.mutationRate) {
        this.mutate(offspring1, staffMembers, dateRange);
      }
      if (Math.random() < this.parameters.mutationRate) {
        this.mutate(offspring2, staffMembers, dateRange);
      }

      // Add offspring to next generation
      offspring1.age = 0;
      offspring2.age = 0;
      offspring1.id = `gen${population[0]?.generation || 0}_off${nextGeneration.length}`;
      offspring2.id = `gen${population[0]?.generation || 0}_off${nextGeneration.length + 1}`;

      nextGeneration.push(offspring1);
      if (nextGeneration.length < this.parameters.populationSize) {
        nextGeneration.push(offspring2);
      }
    }

    return nextGeneration.slice(0, this.parameters.populationSize);
  }

  /**
   * Tournament selection
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
      current.fitness > best.fitness ? current : best
    );
  }

  /**
   * Crossover operation
   * @param {Object} parent1 - First parent
   * @param {Object} parent2 - Second parent
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Array} Two offspring
   */
  crossover(parent1, parent2, staffMembers, dateRange) {
    const offspring1 = { schedule: {}, fitness: 0, age: 0 };
    const offspring2 = { schedule: {}, fitness: 0, age: 0 };

    // Single-point crossover for each staff member
    staffMembers.forEach(staff => {
      offspring1.schedule[staff.id] = {};
      offspring2.schedule[staff.id] = {};

      const crossoverPoint = Math.floor(Math.random() * dateRange.length);

      dateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split('T')[0];
        
        if (index < crossoverPoint) {
          offspring1.schedule[staff.id][dateKey] = parent1.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] = parent2.schedule[staff.id][dateKey];
        } else {
          offspring1.schedule[staff.id][dateKey] = parent2.schedule[staff.id][dateKey];
          offspring2.schedule[staff.id][dateKey] = parent1.schedule[staff.id][dateKey];
        }
      });
    });

    return [offspring1, offspring2];
  }

  /**
   * Mutation operation
   * @param {Object} individual - Individual to mutate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   */
  mutate(individual, staffMembers, dateRange) {
    const possibleShifts = ['', '△', '◇', '×'];
    const mutationCount = Math.max(1, Math.floor(staffMembers.length * dateRange.length * 0.01)); // 1% mutation rate

    for (let i = 0; i < mutationCount; i++) {
      const randomStaff = staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate = dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split('T')[0];

      const currentShift = individual.schedule[randomStaff.id][dateKey];
      let newShift;
      
      do {
        newShift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
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
      id: individual.id + '_clone'
    };
  }

  /**
   * Get algorithm status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      parameters: { ...this.parameters },
      statistics: { ...this.evolutionStats },
      successRate: this.evolutionStats.totalRuns > 0 ? 
        (this.evolutionStats.successfulRuns / this.evolutionStats.totalRuns) * 100 : 0
    };
  }
}