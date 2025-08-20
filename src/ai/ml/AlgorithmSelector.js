/**
 * AlgorithmSelector.js
 *
 * Intelligent algorithm selection system that chooses optimal
 * optimization algorithms based on problem characteristics,
 * performance requirements, and historical data.
 */

import { GeneticAlgorithm } from "../algorithms/GeneticAlgorithm";
import { CSPSolver } from "../algorithms/CSPSolver";

/**
 * Smart preset configurations for user-friendly interface
 */
export const SMART_PRESETS = {
  best_results: {
    displayName: "Best Results",
    description: "Prioritize accuracy over speed (2-5 minutes)",
    icon: "🎯",
    targetAccuracy: 0.92,
    maxProcessingTime: 300, // 5 minutes
    algorithms: ["ensemble", "genetic_advanced", "constraint_satisfaction"],
    parameters: {
      populationSize: 200,
      generations: 500,
      convergenceThreshold: 0.001,
      maxRuntime: 300,
      enableHybridOptimization: true,
      enableAdvancedFeatures: true,
      enableParallelProcessing: true,
      adaptiveMutation: true,
      elitismRate: 0.15,
      tournamentSize: 5,
    },
    resourceRequirements: {
      cpuIntensive: true,
      memoryIntensive: true,
      parallelizable: true,
    },
  },

  balanced: {
    displayName: "Balanced",
    description: "Good quality with reasonable speed (1-2 minutes)",
    icon: "⚖️",
    targetAccuracy: 0.85,
    maxProcessingTime: 120, // 2 minutes
    algorithms: ["genetic_optimized", "simulated_annealing"],
    parameters: {
      populationSize: 100,
      generations: 300,
      convergenceThreshold: 0.005,
      maxRuntime: 120,
      enableHybridOptimization: true,
      enableAdvancedFeatures: false,
      enableParallelProcessing: true,
      adaptiveMutation: false,
      elitismRate: 0.1,
      tournamentSize: 3,
    },
    resourceRequirements: {
      cpuIntensive: true,
      memoryIntensive: false,
      parallelizable: true,
    },
  },

  quick_draft: {
    displayName: "Quick Draft",
    description: "Fast approximation for immediate feedback (10-30 seconds)",
    icon: "⚡",
    targetAccuracy: 0.75,
    maxProcessingTime: 30, // 30 seconds
    algorithms: ["heuristic_optimized", "constraint_satisfaction"],
    parameters: {
      populationSize: 50,
      generations: 100,
      convergenceThreshold: 0.01,
      maxRuntime: 30,
      enableHybridOptimization: false,
      enableAdvancedFeatures: false,
      enableParallelProcessing: false,
      adaptiveMutation: false,
      elitismRate: 0.05,
      tournamentSize: 2,
    },
    resourceRequirements: {
      cpuIntensive: false,
      memoryIntensive: false,
      parallelizable: false,
    },
  },
};

/**
 * Algorithm performance characteristics
 */
const ALGORITHM_CHARACTERISTICS = {
  genetic_advanced: {
    name: "Advanced Genetic Algorithm",
    strengths: ["high_accuracy", "constraint_handling", "parallel_processing"],
    weaknesses: ["processing_time", "memory_usage"],
    complexity: "high",
    bestFor: ["complex_schedules", "strict_constraints", "high_accuracy"],
    resourceUsage: { cpu: "high", memory: "high", time: "high" },
    accuracy: { min: 0.85, max: 0.95, typical: 0.9 },
  },

  genetic_optimized: {
    name: "Optimized Genetic Algorithm",
    strengths: ["balanced_performance", "adaptability", "good_convergence"],
    weaknesses: ["moderate_accuracy", "parameter_tuning"],
    complexity: "medium",
    bestFor: ["medium_schedules", "balanced_requirements"],
    resourceUsage: { cpu: "medium", memory: "medium", time: "medium" },
    accuracy: { min: 0.75, max: 0.9, typical: 0.82 },
  },

  constraint_satisfaction: {
    name: "Constraint Satisfaction Solver",
    strengths: ["hard_constraints", "fast_feasible", "deterministic"],
    weaknesses: ["optimization", "soft_constraints"],
    complexity: "medium",
    bestFor: ["feasibility_focus", "hard_constraints", "quick_results"],
    resourceUsage: { cpu: "medium", memory: "low", time: "low" },
    accuracy: { min: 0.7, max: 0.85, typical: 0.78 },
  },

  simulated_annealing: {
    name: "Simulated Annealing",
    strengths: ["global_optimization", "parameter_robust", "memory_efficient"],
    weaknesses: ["convergence_time", "parameter_sensitive"],
    complexity: "medium",
    bestFor: ["optimization_focus", "avoid_local_minima"],
    resourceUsage: { cpu: "medium", memory: "low", time: "medium" },
    accuracy: { min: 0.72, max: 0.88, typical: 0.8 },
  },

  heuristic_optimized: {
    name: "Optimized Heuristic Solver",
    strengths: ["speed", "simplicity", "predictable"],
    weaknesses: ["limited_accuracy", "local_optima"],
    complexity: "low",
    bestFor: ["quick_drafts", "simple_schedules", "speed_priority"],
    resourceUsage: { cpu: "low", memory: "low", time: "low" },
    accuracy: { min: 0.65, max: 0.8, typical: 0.72 },
  },

  ensemble: {
    name: "Ensemble Optimizer",
    strengths: ["highest_accuracy", "robustness", "comprehensive"],
    weaknesses: ["resource_intensive", "complexity"],
    complexity: "very_high",
    bestFor: ["maximum_accuracy", "complex_schedules", "critical_schedules"],
    resourceUsage: { cpu: "very_high", memory: "very_high", time: "very_high" },
    accuracy: { min: 0.88, max: 0.97, typical: 0.93 },
  },
};

/**
 * Main Algorithm Selection System
 */
export class AlgorithmSelector {
  constructor() {
    this.algorithms = new Map();
    this.performanceHistory = new AlgorithmPerformanceTracker();
    this.resourceMonitor = new ResourceMonitor();
    this.problemClassifier = new ProblemClassifier();

    // Initialize available algorithms
    this.initializeAlgorithms();

    // Performance thresholds
    this.thresholds = {
      accuracy: { low: 0.7, medium: 0.8, high: 0.9 },
      speed: { slow: 300, medium: 120, fast: 30 }, // seconds
      complexity: { low: 0.3, medium: 0.6, high: 0.8 },
    };
  }

  /**
   * Initialize algorithm instances
   */
  initializeAlgorithms() {
    // Available algorithm implementations
    this.algorithms.set("genetic_advanced", new AdvancedGeneticAlgorithm());
    this.algorithms.set("genetic_optimized", new OptimizedGeneticAlgorithm());
    this.algorithms.set("constraint_satisfaction", new CSPSolver());
    this.algorithms.set("simulated_annealing", new SimulatedAnnealing());
    this.algorithms.set("heuristic_optimized", new HeuristicOptimizer());
    this.algorithms.set("ensemble", new EnsembleOptimizer());

    console.log(
      `✅ Initialized ${this.algorithms.size} optimization algorithms`,
    );
  }

  /**
   * Main algorithm selection method
   */
  async selectOptimalAlgorithms(
    problemCharacteristics,
    preset = "balanced",
    options = {},
  ) {
    console.log(`🧠 Selecting algorithms for preset: ${preset}`);

    const startTime = Date.now();

    try {
      // Get preset configuration
      const presetConfig = SMART_PRESETS[preset];
      if (!presetConfig) {
        throw new Error(`Unknown preset: ${preset}`);
      }

      // Analyze problem characteristics
      const problemAnalysis = await this.problemClassifier.analyze(
        problemCharacteristics,
      );

      // Check system resources
      const resourceStatus = await this.resourceMonitor.getCurrentStatus();

      // Get base algorithm selection
      let selectedAlgorithms = this.getBaseSelection(
        presetConfig,
        problemAnalysis,
      );

      // Apply adaptive selection based on performance history
      selectedAlgorithms = this.applyAdaptiveSelection(
        selectedAlgorithms,
        problemAnalysis,
        preset,
      );

      // Apply resource constraints
      selectedAlgorithms = this.applyResourceConstraints(
        selectedAlgorithms,
        resourceStatus,
        presetConfig,
      );

      // Optimize parameters for selected algorithms
      const optimizedParameters = this.optimizeParameters(
        selectedAlgorithms,
        problemAnalysis,
        presetConfig,
      );

      const selectionTime = Date.now() - startTime;

      const result = {
        success: true,
        selectedAlgorithms,
        parameters: optimizedParameters,
        preset: presetConfig,
        problemAnalysis,
        resourceStatus,
        metadata: {
          selectionTime,
          reasoning: this.generateSelectionReasoning(
            selectedAlgorithms,
            problemAnalysis,
            preset,
          ),
          expectedPerformance: this.predictPerformance(
            selectedAlgorithms,
            problemAnalysis,
          ),
        },
      };

      console.log(`✅ Algorithm selection completed in ${selectionTime}ms`);
      console.log(`📋 Selected: ${selectedAlgorithms.join(", ")}`);

      return result;
    } catch (error) {
      console.error("❌ Algorithm selection failed:", error);
      return {
        success: false,
        error: error.message,
        fallbackAlgorithms: ["genetic_optimized"], // Safe fallback
        selectionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get base algorithm selection from preset
   */
  getBaseSelection(presetConfig, problemAnalysis) {
    const { complexityScore, constraintDensity, staffCount, dateCount } =
      problemAnalysis;

    // Start with preset algorithms
    let algorithms = [...presetConfig.algorithms];

    // Adjust based on problem complexity
    if (complexityScore > 0.8) {
      // High complexity - prefer advanced algorithms
      if (
        presetConfig.targetAccuracy > 0.85 &&
        !algorithms.includes("ensemble")
      ) {
        algorithms.unshift("ensemble");
      }
      // Remove simple algorithms for complex problems
      algorithms = algorithms.filter((alg) => alg !== "heuristic_optimized");
    } else if (complexityScore < 0.3) {
      // Low complexity - simpler algorithms may suffice
      if (algorithms.includes("ensemble")) {
        algorithms = algorithms.filter((alg) => alg !== "ensemble");
        if (!algorithms.includes("genetic_optimized")) {
          algorithms.push("genetic_optimized");
        }
      }
    }

    // Adjust for constraint density
    if (constraintDensity > 0.7) {
      // High constraint density - prioritize constraint-handling algorithms
      if (!algorithms.includes("constraint_satisfaction")) {
        algorithms.push("constraint_satisfaction");
      }
    }

    // Adjust for problem size
    const problemSize = staffCount * dateCount;
    if (problemSize > 1000) {
      // Large problem - need efficient algorithms
      algorithms = algorithms.filter(
        (alg) =>
          ALGORITHM_CHARACTERISTICS[alg]?.resourceUsage.time !== "very_high",
      );
    }

    return algorithms.slice(0, 3); // Limit to top 3 algorithms
  }

  /**
   * Apply adaptive selection based on historical performance
   */
  applyAdaptiveSelection(algorithms, problemAnalysis, preset) {
    const performanceData = this.performanceHistory.getSimilarProblems(
      problemAnalysis,
      preset,
    );

    if (performanceData.length === 0) {
      return algorithms; // No history, use base selection
    }

    // Score algorithms based on historical performance
    const algorithmScores = new Map();

    algorithms.forEach((algorithm) => {
      const history = performanceData.filter((p) => p.algorithm === algorithm);
      if (history.length > 0) {
        const avgAccuracy =
          history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;
        const avgTime =
          history.reduce((sum, h) => sum + h.processingTime, 0) /
          history.length;

        // Score based on accuracy and speed (weighted by preset priorities)
        const presetConfig = SMART_PRESETS[preset];
        const accuracyWeight = presetConfig.targetAccuracy > 0.85 ? 0.7 : 0.5;
        const speedWeight = 1 - accuracyWeight;

        const normalizedTime = Math.min(
          1,
          avgTime / presetConfig.maxProcessingTime,
        );
        const score =
          avgAccuracy * accuracyWeight + (1 - normalizedTime) * speedWeight;

        algorithmScores.set(algorithm, score);
      } else {
        // No history for this algorithm - use default score
        const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];
        algorithmScores.set(
          algorithm,
          characteristics?.accuracy.typical || 0.5,
        );
      }
    });

    // Sort algorithms by score
    return algorithms.sort((a, b) => {
      const scoreA = algorithmScores.get(a) || 0;
      const scoreB = algorithmScores.get(b) || 0;
      return scoreB - scoreA;
    });
  }

  /**
   * Apply resource constraints to algorithm selection
   */
  applyResourceConstraints(algorithms, resourceStatus, presetConfig) {
    const { cpuUsage, memoryUsage, availableCores } = resourceStatus;

    // Filter algorithms based on current resource usage
    return algorithms.filter((algorithm) => {
      const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];
      if (!characteristics) return true;

      const resourceReq = characteristics.resourceUsage;

      // CPU constraints
      if (cpuUsage > 0.8 && resourceReq.cpu === "very_high") {
        console.log(`⚠️ Filtering out ${algorithm} due to high CPU usage`);
        return false;
      }

      // Memory constraints
      if (memoryUsage > 0.8 && resourceReq.memory === "very_high") {
        console.log(`⚠️ Filtering out ${algorithm} due to high memory usage`);
        return false;
      }

      // Core availability for parallel algorithms
      if (
        availableCores < 2 &&
        presetConfig.parameters?.enableParallelProcessing
      ) {
        if (["ensemble", "genetic_advanced"].includes(algorithm)) {
          console.log(
            `⚠️ Limited cores available, may affect ${algorithm} performance`,
          );
        }
      }

      return true;
    });
  }

  /**
   * Optimize parameters for selected algorithms
   */
  optimizeParameters(algorithms, problemAnalysis, presetConfig) {
    const optimizedParams = {};

    algorithms.forEach((algorithm) => {
      const baseParams = { ...presetConfig.parameters };
      const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];

      if (characteristics) {
        // Adjust parameters based on problem characteristics
        optimizedParams[algorithm] = this.adjustParametersForProblem(
          baseParams,
          problemAnalysis,
          characteristics,
        );
      } else {
        optimizedParams[algorithm] = baseParams;
      }
    });

    return optimizedParams;
  }

  /**
   * Adjust parameters for specific problem characteristics
   */
  adjustParametersForProblem(
    baseParams,
    problemAnalysis,
    algorithmCharacteristics,
  ) {
    const adjusted = { ...baseParams };
    const { complexityScore, staffCount, dateCount, constraintDensity } =
      problemAnalysis;

    // Adjust population size based on problem size
    if (adjusted.populationSize) {
      const problemSize = staffCount * dateCount;
      if (problemSize > 500) {
        adjusted.populationSize = Math.min(adjusted.populationSize * 1.5, 300);
      } else if (problemSize < 100) {
        adjusted.populationSize = Math.max(adjusted.populationSize * 0.7, 20);
      }
    }

    // Adjust generations based on complexity
    if (adjusted.generations) {
      if (complexityScore > 0.8) {
        adjusted.generations = Math.min(adjusted.generations * 1.3, 800);
      } else if (complexityScore < 0.3) {
        adjusted.generations = Math.max(adjusted.generations * 0.8, 50);
      }
    }

    // Adjust convergence threshold based on accuracy requirements
    if (adjusted.convergenceThreshold) {
      if (baseParams.targetAccuracy > 0.9) {
        adjusted.convergenceThreshold *= 0.5; // Stricter convergence
      } else if (baseParams.targetAccuracy < 0.8) {
        adjusted.convergenceThreshold *= 2; // Looser convergence
      }
    }

    // Adjust mutation rate based on constraint density
    if (adjusted.mutationRate && constraintDensity > 0.7) {
      adjusted.mutationRate *= 0.8; // More conservative mutation for constrained problems
    }

    return adjusted;
  }

  /**
   * Generate human-readable reasoning for algorithm selection
   */
  generateSelectionReasoning(algorithms, problemAnalysis, preset) {
    const reasoning = [];
    const presetConfig = SMART_PRESETS[preset];

    reasoning.push(
      `Selected ${preset} preset targeting ${(presetConfig.targetAccuracy * 100).toFixed(0)}% accuracy`,
    );

    if (problemAnalysis.complexityScore > 0.8) {
      reasoning.push(
        "High problem complexity detected - using advanced algorithms",
      );
    } else if (problemAnalysis.complexityScore < 0.3) {
      reasoning.push("Low problem complexity - optimized for speed");
    }

    if (problemAnalysis.constraintDensity > 0.7) {
      reasoning.push(
        "High constraint density - prioritizing constraint satisfaction",
      );
    }

    algorithms.forEach((algorithm) => {
      const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];
      if (characteristics) {
        reasoning.push(
          `${characteristics.name}: ${characteristics.bestFor.join(", ")}`,
        );
      }
    });

    return reasoning;
  }

  /**
   * Predict expected performance for selected algorithms
   */
  predictPerformance(algorithms, problemAnalysis) {
    const predictions = {};

    algorithms.forEach((algorithm) => {
      const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];
      if (characteristics) {
        // Base prediction from algorithm characteristics
        let accuracyPrediction = characteristics.accuracy.typical;
        let timePrediction = this.estimateProcessingTime(
          algorithm,
          problemAnalysis,
        );

        // Adjust based on problem characteristics
        if (problemAnalysis.complexityScore > 0.8) {
          accuracyPrediction *= 0.95; // Slight accuracy drop for complex problems
          timePrediction *= 1.3; // Longer processing time
        }

        predictions[algorithm] = {
          expectedAccuracy: Math.min(0.99, Math.max(0.5, accuracyPrediction)),
          expectedTime: Math.max(5, timePrediction), // Minimum 5 seconds
          confidence: 0.75, // Confidence in prediction
        };
      }
    });

    return predictions;
  }

  /**
   * Estimate processing time for algorithm on given problem
   */
  estimateProcessingTime(algorithm, problemAnalysis) {
    const characteristics = ALGORITHM_CHARACTERISTICS[algorithm];
    const problemSize = problemAnalysis.staffCount * problemAnalysis.dateCount;

    // Base time estimates (in seconds)
    const baseTimes = {
      heuristic_optimized: 5,
      constraint_satisfaction: 15,
      genetic_optimized: 45,
      simulated_annealing: 60,
      genetic_advanced: 120,
      ensemble: 240,
    };

    const baseTime = baseTimes[algorithm] || 60;

    // Scale by problem size (roughly logarithmic scaling)
    const sizeMultiplier = 1 + Math.log10(Math.max(10, problemSize)) * 0.3;

    // Scale by complexity
    const complexityMultiplier = 1 + problemAnalysis.complexityScore * 0.5;

    return baseTime * sizeMultiplier * complexityMultiplier;
  }

  /**
   * Record algorithm performance for adaptive learning
   */
  recordPerformance(algorithmResult) {
    this.performanceHistory.record(algorithmResult);
  }

  /**
   * Get algorithm selection statistics
   */
  getStatistics() {
    return {
      availableAlgorithms: Array.from(this.algorithms.keys()),
      performanceHistory: this.performanceHistory.getSummary(),
      resourceStatus: this.resourceMonitor.getCurrentStatus(),
      presetUsage: this.performanceHistory.getPresetUsage(),
      algorithmSuccess: this.performanceHistory.getAlgorithmSuccessRates(),
    };
  }

  /**
   * Get detailed information about available presets
   */
  getPresetInformation() {
    return Object.entries(SMART_PRESETS).map(([key, preset]) => ({
      id: key,
      name: preset.displayName,
      description: preset.description,
      icon: preset.icon,
      targetAccuracy: `${(preset.targetAccuracy * 100).toFixed(0)}%`,
      estimatedTime: this.formatTime(preset.maxProcessingTime),
      algorithms: preset.algorithms.map(
        (alg) => ALGORITHM_CHARACTERISTICS[alg]?.name || alg,
      ),
      bestFor: this.getPresetRecommendations(preset),
    }));
  }

  getPresetRecommendations(preset) {
    if (preset.targetAccuracy >= 0.9) {
      return [
        "Complex schedules",
        "High accuracy requirements",
        "Time is not critical",
      ];
    } else if (preset.targetAccuracy >= 0.8) {
      return ["Most scheduling scenarios", "Good balance of speed and quality"];
    } else {
      return ["Quick drafts", "Initial exploration", "Time-critical decisions"];
    }
  }

  formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
}

/**
 * Algorithm Performance Tracking
 */
class AlgorithmPerformanceTracker {
  constructor() {
    this.performanceData = [];
    this.maxRecords = 1000;
  }

  record(result) {
    const record = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      algorithm: result.algorithm,
      preset: result.preset,
      accuracy: result.accuracy,
      processingTime: result.processingTime,
      problemCharacteristics: result.problemCharacteristics,
      success: result.success,
      resourceUsage: result.resourceUsage,
    };

    this.performanceData.push(record);

    // Keep only recent records
    if (this.performanceData.length > this.maxRecords) {
      this.performanceData = this.performanceData.slice(-this.maxRecords);
    }
  }

  getSimilarProblems(problemCharacteristics, preset) {
    return this.performanceData.filter((record) => {
      const similarity = this.calculateSimilarity(
        record.problemCharacteristics,
        problemCharacteristics,
      );
      return similarity > 0.7 && record.preset === preset;
    });
  }

  calculateSimilarity(problem1, problem2) {
    // Simple similarity calculation based on key characteristics
    const staffDiff =
      Math.abs(problem1.staffCount - problem2.staffCount) /
      Math.max(problem1.staffCount, problem2.staffCount);
    const dateDiff =
      Math.abs(problem1.dateCount - problem2.dateCount) /
      Math.max(problem1.dateCount, problem2.dateCount);
    const complexityDiff = Math.abs(
      problem1.complexityScore - problem2.complexityScore,
    );

    const similarity = 1 - (staffDiff + dateDiff + complexityDiff) / 3;
    return Math.max(0, similarity);
  }

  getSummary() {
    if (this.performanceData.length === 0) {
      return {
        totalRecords: 0,
        averageAccuracy: 0,
        averageTime: 0,
        successRate: 0,
      };
    }

    const total = this.performanceData.length;
    const successful = this.performanceData.filter((r) => r.success).length;
    const accuracies = this.performanceData
      .map((r) => r.accuracy)
      .filter((a) => a > 0);
    const times = this.performanceData
      .map((r) => r.processingTime)
      .filter((t) => t > 0);

    return {
      totalRecords: total,
      successRate: (successful / total) * 100,
      averageAccuracy:
        accuracies.length > 0
          ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
          : 0,
      averageTime:
        times.length > 0
          ? times.reduce((sum, time) => sum + time, 0) / times.length
          : 0,
    };
  }

  getPresetUsage() {
    const usage = {};
    this.performanceData.forEach((record) => {
      usage[record.preset] = (usage[record.preset] || 0) + 1;
    });
    return usage;
  }

  getAlgorithmSuccessRates() {
    const rates = {};
    this.performanceData.forEach((record) => {
      if (!rates[record.algorithm]) {
        rates[record.algorithm] = { total: 0, successful: 0 };
      }
      rates[record.algorithm].total++;
      if (record.success) {
        rates[record.algorithm].successful++;
      }
    });

    // Convert to percentages
    Object.keys(rates).forEach((algorithm) => {
      const data = rates[algorithm];
      rates[algorithm].successRate = (data.successful / data.total) * 100;
    });

    return rates;
  }
}

/**
 * Problem Classification System
 */
class ProblemClassifier {
  async analyze(problemCharacteristics) {
    const {
      staffMembers = [],
      dateRange = [],
      constraints = {},
      existingSchedule = {},
    } = problemCharacteristics;

    const staffCount = staffMembers.length;
    const dateCount = dateRange.length;

    // Calculate complexity metrics
    const complexityScore = this.calculateComplexityScore(
      staffCount,
      dateCount,
      constraints,
    );

    const constraintDensity = this.calculateConstraintDensity(constraints);

    const existingDataRatio = this.calculateExistingDataRatio(
      existingSchedule,
      staffCount,
      dateCount,
    );

    return {
      staffCount,
      dateCount,
      totalSlots: staffCount * dateCount,
      complexityScore,
      constraintDensity,
      existingDataRatio,
      problemSize: this.classifyProblemSize(staffCount * dateCount),
      constraintLoad: this.classifyConstraintLoad(constraintDensity),
      recommendation: this.generateRecommendation(
        complexityScore,
        constraintDensity,
        staffCount * dateCount,
      ),
    };
  }

  calculateComplexityScore(staffCount, dateCount, constraints) {
    let score = 0;

    // Base complexity from problem size
    const problemSize = staffCount * dateCount;
    score += Math.min(0.4, problemSize / 1000); // Up to 40% from size

    // Constraint complexity
    const constraintTypes = Object.keys(constraints).length;
    score += Math.min(0.3, constraintTypes / 10); // Up to 30% from constraint variety

    // Staff group complexity
    const staffGroups = constraints.staff_groups || [];
    score += Math.min(0.2, staffGroups.length / 20); // Up to 20% from groups

    // Priority rule complexity
    const priorityRules = constraints.priority_rules || [];
    score += Math.min(0.1, priorityRules.length / 50); // Up to 10% from rules

    return Math.min(1, score);
  }

  calculateConstraintDensity(constraints) {
    let totalConstraints = 0;
    let totalWeight = 0;

    Object.values(constraints).forEach((constraintList) => {
      if (Array.isArray(constraintList)) {
        constraintList.forEach((constraint) => {
          totalConstraints++;
          totalWeight += constraint.weight || constraint.penaltyWeight || 1;
        });
      }
    });

    return totalConstraints > 0
      ? Math.min(1, totalWeight / (totalConstraints * 50))
      : 0;
  }

  calculateExistingDataRatio(existingSchedule, staffCount, dateCount) {
    let filledSlots = 0;
    const totalSlots = staffCount * dateCount;

    Object.values(existingSchedule).forEach((staffSchedule) => {
      Object.values(staffSchedule).forEach((shift) => {
        if (shift !== undefined && shift !== "") {
          filledSlots++;
        }
      });
    });

    return totalSlots > 0 ? filledSlots / totalSlots : 0;
  }

  classifyProblemSize(totalSlots) {
    if (totalSlots < 100) return "small";
    if (totalSlots < 500) return "medium";
    if (totalSlots < 1000) return "large";
    return "very_large";
  }

  classifyConstraintLoad(density) {
    if (density < 0.3) return "light";
    if (density < 0.6) return "moderate";
    if (density < 0.8) return "heavy";
    return "very_heavy";
  }

  generateRecommendation(complexityScore, constraintDensity, problemSize) {
    if (complexityScore > 0.8 && constraintDensity > 0.7) {
      return "best_results"; // High complexity and constraints
    } else if (complexityScore < 0.3 && constraintDensity < 0.4) {
      return "quick_draft"; // Simple problem
    } else {
      return "balanced"; // Most cases
    }
  }
}

/**
 * System Resource Monitoring
 */
class ResourceMonitor {
  async getCurrentStatus() {
    // In a real implementation, this would monitor actual system resources
    return {
      cpuUsage: Math.random() * 0.8, // 0-80% usage
      memoryUsage: Math.random() * 0.7, // 0-70% usage
      availableCores: navigator.hardwareConcurrency || 4,
      loadAverage: Math.random() * 2,
      timestamp: Date.now(),
    };
  }

  isResourceConstrained() {
    // Placeholder implementation
    return false;
  }
}

// Placeholder algorithm classes - these would be implemented separately
class AdvancedGeneticAlgorithm extends GeneticAlgorithm {
  constructor() {
    super();
    this.name = "AdvancedGeneticAlgorithm";
  }
}

class OptimizedGeneticAlgorithm extends GeneticAlgorithm {
  constructor() {
    super();
    this.name = "OptimizedGeneticAlgorithm";
  }
}

class SimulatedAnnealing {
  constructor() {
    this.name = "SimulatedAnnealing";
  }
}

class HeuristicOptimizer {
  constructor() {
    this.name = "HeuristicOptimizer";
  }
}

class EnsembleOptimizer {
  constructor() {
    this.name = "EnsembleOptimizer";
  }
}
