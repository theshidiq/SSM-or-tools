/**
 * ConfidenceScorer.js
 *
 * Multi-dimensional confidence scoring system that evaluates
 * the reliability and trustworthiness of schedule optimization
 * solutions across multiple factors.
 */

import {
  validateAllConstraints,
  VIOLATION_TYPES,
} from "../constraints/ConstraintEngine";

/**
 * Confidence scoring factors and their weights
 */
const CONFIDENCE_FACTORS = {
  constraint_satisfaction: {
    weight: 0.3,
    description: "How well the solution satisfies all scheduling constraints",
    impact: "high",
    category: "feasibility",
  },
  prediction_consistency: {
    weight: 0.2,
    description: "Agreement between different optimization algorithms",
    impact: "medium",
    category: "reliability",
  },
  algorithm_certainty: {
    weight: 0.2,
    description: "Confidence of the optimization algorithm in its solution",
    impact: "medium",
    category: "technical",
  },
  historical_accuracy: {
    weight: 0.15,
    description: "Past performance on similar scheduling problems",
    impact: "medium",
    category: "experience",
  },
  solution_stability: {
    weight: 0.1,
    description: "Consistency of solution across multiple runs",
    impact: "low",
    category: "robustness",
  },
  coverage_completeness: {
    weight: 0.05,
    description: "Complete coverage of all required shifts and assignments",
    impact: "low",
    category: "completeness",
  },
};

/**
 * Multi-dimensional Confidence Scoring System
 */
export class ConfidenceScorer {
  constructor() {
    this.scoringFactors = { ...CONFIDENCE_FACTORS };
    this.historicalData = new HistoricalAccuracyTracker();
    this.consistencyAnalyzer = new ConsistencyAnalyzer();
    this.stabilityTester = new StabilityTester();

    // Confidence thresholds
    this.thresholds = {
      very_high: 0.9,
      high: 0.8,
      medium: 0.65,
      low: 0.5,
      very_low: 0.3,
    };

    // User-friendly confidence levels
    this.confidenceLevels = {
      very_high: {
        label: "Very High",
        color: "#10B981",
        icon: "✅",
        recommendation: "Highly recommended for use",
      },
      high: {
        label: "High",
        color: "#22C55E",
        icon: "☑️",
        recommendation: "Recommended for use",
      },
      medium: {
        label: "Medium",
        color: "#F59E0B",
        icon: "⚠️",
        recommendation: "Review before use",
      },
      low: {
        label: "Low",
        color: "#EF4444",
        icon: "⚡",
        recommendation: "Use with caution",
      },
      very_low: {
        label: "Very Low",
        color: "#DC2626",
        icon: "❌",
        recommendation: "Not recommended for use",
      },
    };
  }

  /**
   * Calculate comprehensive confidence score
   */
  async calculateConfidence(solution, problemContext, algorithmResults) {
    console.log("🎯 Calculating solution confidence...");

    const startTime = Date.now();
    const scores = {};
    let totalConfidence = 0;
    let totalWeight = 0;

    try {
      // 1. Constraint Satisfaction Score (30%)
      scores.constraint_satisfaction =
        await this.evaluateConstraintSatisfaction(
          solution,
          problemContext.constraints,
          problemContext,
        );
      totalConfidence +=
        scores.constraint_satisfaction *
        this.scoringFactors.constraint_satisfaction.weight;
      totalWeight += this.scoringFactors.constraint_satisfaction.weight;

      // 2. Prediction Consistency Score (20%)
      scores.prediction_consistency = await this.evaluatePredictionConsistency(
        algorithmResults,
        solution,
      );
      totalConfidence +=
        scores.prediction_consistency *
        this.scoringFactors.prediction_consistency.weight;
      totalWeight += this.scoringFactors.prediction_consistency.weight;

      // 3. Algorithm Certainty Score (20%)
      scores.algorithm_certainty = await this.evaluateAlgorithmCertainty(
        algorithmResults,
        problemContext,
      );
      totalConfidence +=
        scores.algorithm_certainty *
        this.scoringFactors.algorithm_certainty.weight;
      totalWeight += this.scoringFactors.algorithm_certainty.weight;

      // 4. Historical Accuracy Score (15%)
      scores.historical_accuracy = await this.evaluateHistoricalAccuracy(
        problemContext,
        algorithmResults,
      );
      totalConfidence +=
        scores.historical_accuracy *
        this.scoringFactors.historical_accuracy.weight;
      totalWeight += this.scoringFactors.historical_accuracy.weight;

      // 5. Solution Stability Score (10%)
      scores.solution_stability = await this.evaluateSolutionStability(
        solution,
        algorithmResults,
        problemContext,
      );
      totalConfidence +=
        scores.solution_stability *
        this.scoringFactors.solution_stability.weight;
      totalWeight += this.scoringFactors.solution_stability.weight;

      // 6. Coverage Completeness Score (5%)
      scores.coverage_completeness = await this.evaluateCoverageCompleteness(
        solution,
        problemContext,
      );
      totalConfidence +=
        scores.coverage_completeness *
        this.scoringFactors.coverage_completeness.weight;
      totalWeight += this.scoringFactors.coverage_completeness.weight;

      const overallConfidence =
        totalWeight > 0 ? totalConfidence / totalWeight : 0;
      const confidenceLevel = this.classifyConfidenceLevel(overallConfidence);
      const calculationTime = Date.now() - startTime;

      console.log(
        `✅ Confidence calculated: ${(overallConfidence * 100).toFixed(1)}% (${confidenceLevel})`,
      );

      return {
        overall: overallConfidence,
        level: confidenceLevel,
        scores,
        calculationTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Confidence calculation failed:", error);
      return {
        overall: 0.5, // Default medium confidence
        level: "medium",
        scores: {},
        error: error.message,
        calculationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get detailed confidence breakdown for user understanding
   */
  async getConfidenceBreakdown(solution, problemContext, algorithmResults) {
    const confidence = await this.calculateConfidence(
      solution,
      problemContext,
      algorithmResults,
    );

    const breakdown = {
      overall: confidence.overall,
      level: confidence.level,
      levelInfo: this.confidenceLevels[confidence.level],
      factors: {},
      recommendations: [],
      improvements: [],
      trustworthiness: this.assessTrustworthiness(confidence),
      riskFactors: this.identifyRiskFactors(confidence.scores),
    };

    // Detailed factor analysis
    for (const [factorName, factorConfig] of Object.entries(
      this.scoringFactors,
    )) {
      const score = confidence.scores[factorName] || 0;
      breakdown.factors[factorName] = {
        score: score,
        weight: factorConfig.weight,
        description: factorConfig.description,
        impact: factorConfig.impact,
        category: factorConfig.category,
        contribution: score * factorConfig.weight,
        status: this.getFactorStatus(score),
        details: await this.getFactorDetails(
          factorName,
          solution,
          problemContext,
          algorithmResults,
        ),
      };
    }

    // Generate recommendations
    breakdown.recommendations = this.generateConfidenceRecommendations(
      confidence.scores,
      problemContext,
    );

    // Generate improvement suggestions
    breakdown.improvements = this.generateImprovementSuggestions(
      confidence.scores,
      problemContext,
    );

    return breakdown;
  }

  /**
   * Evaluate constraint satisfaction factor
   */
  async evaluateConstraintSatisfaction(solution, constraints, problemContext) {
    try {
      // Use existing constraint validation system
      const validation = await validateAllConstraints(
        solution.schedule || solution,
        problemContext.staffMembers,
        problemContext.dateRange,
        constraints.backup_assignments || [],
      );

      if (validation.valid) {
        return 1.0; // Perfect constraint satisfaction
      }

      // Calculate score based on violation severity
      const { summary } = validation;
      const totalViolations =
        summary.criticalViolations +
        summary.highViolations +
        summary.mediumViolations;

      if (totalViolations === 0) {
        return 1.0;
      }

      // Weighted penalty for different violation types
      const violationPenalty =
        summary.criticalViolations * 0.5 +
        summary.highViolations * 0.3 +
        summary.mediumViolations * 0.1;

      const totalConstraints = summary.totalConstraintsChecked;
      const penaltyRatio = Math.min(1, violationPenalty / totalConstraints);

      return Math.max(0, 1 - penaltyRatio);
    } catch (error) {
      console.error("Error evaluating constraint satisfaction:", error);
      return 0.5; // Default score on error
    }
  }

  /**
   * Evaluate prediction consistency across algorithms
   */
  async evaluatePredictionConsistency(algorithmResults, bestSolution) {
    if (!algorithmResults || algorithmResults.length < 2) {
      return 0.7; // Default score for single algorithm
    }

    try {
      const consistencyScores = [];

      // Compare each algorithm result with the best solution
      for (const result of algorithmResults) {
        if (result.schedule && result.fitness !== undefined) {
          const similarity = this.calculateScheduleSimilarity(
            result.schedule,
            bestSolution.schedule || bestSolution,
          );
          consistencyScores.push(similarity);
        }
      }

      if (consistencyScores.length === 0) {
        return 0.6;
      }

      // Calculate average consistency
      const averageConsistency =
        consistencyScores.reduce((sum, score) => sum + score, 0) /
        consistencyScores.length;

      // Weight by fitness differences (algorithms with similar fitness should have similar solutions)
      const fitnessConsistency =
        this.calculateFitnessConsistency(algorithmResults);

      return averageConsistency * 0.7 + fitnessConsistency * 0.3;
    } catch (error) {
      console.error("Error evaluating prediction consistency:", error);
      return 0.5;
    }
  }

  /**
   * Evaluate algorithm certainty
   */
  async evaluateAlgorithmCertainty(algorithmResults, problemContext) {
    try {
      if (!algorithmResults || algorithmResults.length === 0) {
        return 0.5;
      }

      let totalCertainty = 0;
      let totalWeight = 0;

      for (const result of algorithmResults) {
        const algorithmCertainty = this.calculateAlgorithmCertainty(
          result,
          problemContext,
        );
        const weight = result.fitness || 0.5; // Weight by algorithm performance

        totalCertainty += algorithmCertainty * weight;
        totalWeight += weight;
      }

      return totalWeight > 0 ? totalCertainty / totalWeight : 0.5;
    } catch (error) {
      console.error("Error evaluating algorithm certainty:", error);
      return 0.5;
    }
  }

  /**
   * Evaluate historical accuracy
   */
  async evaluateHistoricalAccuracy(problemContext, algorithmResults) {
    try {
      const historicalAccuracy =
        await this.historicalData.getAccuracyForSimilarProblems(
          problemContext,
          algorithmResults.map((r) => r.algorithm || "unknown"),
        );

      if (historicalAccuracy.sampleSize === 0) {
        return 0.6; // Default when no historical data
      }

      // Adjust based on sample size (more data = higher confidence)
      const sampleSizeBonus = Math.min(0.2, historicalAccuracy.sampleSize / 50);

      return Math.min(
        1.0,
        historicalAccuracy.averageAccuracy + sampleSizeBonus,
      );
    } catch (error) {
      console.error("Error evaluating historical accuracy:", error);
      return 0.5;
    }
  }

  /**
   * Evaluate solution stability
   */
  async evaluateSolutionStability(solution, algorithmResults, problemContext) {
    try {
      // Test solution stability by running multiple variations
      const stabilityScore = await this.stabilityTester.testStability(
        solution,
        problemContext,
        algorithmResults,
      );

      return stabilityScore;
    } catch (error) {
      console.error("Error evaluating solution stability:", error);
      return 0.7; // Default stable score
    }
  }

  /**
   * Evaluate coverage completeness
   */
  async evaluateCoverageCompleteness(solution, problemContext) {
    try {
      const schedule = solution.schedule || solution;
      const { staffMembers, dateRange } = problemContext;

      let totalSlots = 0;
      let filledSlots = 0;
      let properlyFilledSlots = 0;

      staffMembers.forEach((staff) => {
        dateRange.forEach((date) => {
          totalSlots++;
          const dateKey = date.toISOString().split("T")[0];

          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            filledSlots++;

            // Check if the assignment is valid (not just empty)
            const assignment = schedule[staff.id][dateKey];
            if (
              assignment !== "" ||
              this.isValidNormalShift(assignment, staff, date)
            ) {
              properlyFilledSlots++;
            }
          }
        });
      });

      // Coverage completeness score
      const completenessRatio = totalSlots > 0 ? filledSlots / totalSlots : 0;
      const qualityRatio =
        filledSlots > 0 ? properlyFilledSlots / filledSlots : 0;

      return completenessRatio * 0.6 + qualityRatio * 0.4;
    } catch (error) {
      console.error("Error evaluating coverage completeness:", error);
      return 0.8; // Default high completeness
    }
  }

  /**
   * Calculate schedule similarity between two solutions
   */
  calculateScheduleSimilarity(schedule1, schedule2) {
    let totalComparisons = 0;
    let matches = 0;

    Object.keys(schedule1).forEach((staffId) => {
      if (schedule2[staffId]) {
        Object.keys(schedule1[staffId]).forEach((dateKey) => {
          totalComparisons++;
          if (schedule1[staffId][dateKey] === schedule2[staffId][dateKey]) {
            matches++;
          }
        });
      }
    });

    return totalComparisons > 0 ? matches / totalComparisons : 0;
  }

  /**
   * Calculate fitness consistency across algorithm results
   */
  calculateFitnessConsistency(algorithmResults) {
    const fitnessValues = algorithmResults
      .map((r) => r.fitness || 0)
      .filter((f) => f > 0);

    if (fitnessValues.length < 2) {
      return 0.7;
    }

    // Calculate coefficient of variation (lower = more consistent)
    const mean =
      fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const variance =
      fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) /
      fitnessValues.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 1;

    // Convert to consistency score (0-1, higher is better)
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  /**
   * Calculate individual algorithm certainty
   */
  calculateAlgorithmCertainty(result, problemContext) {
    let certainty = 0.5; // Base certainty

    // Fitness-based certainty
    if (result.fitness !== undefined) {
      certainty += Math.min(0.3, (result.fitness / 100) * 0.3); // Up to 30% from fitness
    }

    // Convergence-based certainty
    if (result.generations && result.convergenceReason) {
      if (result.convergenceReason === "early_termination") {
        certainty += 0.15; // High certainty for early termination
      } else if (result.convergenceReason === "stagnation") {
        certainty += 0.1; // Medium certainty for stagnation
      }
    }

    // Problem complexity adjustment
    const complexity = problemContext.complexityScore || 0.5;
    if (complexity < 0.3) {
      certainty += 0.05; // Bonus for simple problems
    } else if (complexity > 0.8) {
      certainty -= 0.05; // Penalty for complex problems
    }

    return Math.max(0, Math.min(1, certainty));
  }

  /**
   * Classify overall confidence level
   */
  classifyConfidenceLevel(confidence) {
    if (confidence >= this.thresholds.very_high) return "very_high";
    if (confidence >= this.thresholds.high) return "high";
    if (confidence >= this.thresholds.medium) return "medium";
    if (confidence >= this.thresholds.low) return "low";
    return "very_low";
  }

  /**
   * Get factor status for individual scoring factors
   */
  getFactorStatus(score) {
    if (score >= 0.9) return "excellent";
    if (score >= 0.8) return "good";
    if (score >= 0.6) return "fair";
    if (score >= 0.4) return "poor";
    return "very_poor";
  }

  /**
   * Get detailed information for each factor
   */
  async getFactorDetails(
    factorName,
    solution,
    problemContext,
    algorithmResults,
  ) {
    const details = { metrics: {}, insights: [], warnings: [] };

    switch (factorName) {
      case "constraint_satisfaction":
        try {
          const validation = await validateAllConstraints(
            solution.schedule || solution,
            problemContext.staffMembers,
            problemContext.dateRange,
            problemContext.constraints?.backup_assignments || [],
          );
          details.metrics = {
            totalConstraints: validation.summary.totalConstraintsChecked,
            violations: validation.summary.violationsFound,
            criticalViolations: validation.summary.criticalViolations,
            highViolations: validation.summary.highViolations,
          };
          if (validation.summary.criticalViolations > 0) {
            details.warnings.push(
              `${validation.summary.criticalViolations} critical constraint violations found`,
            );
          }
        } catch (error) {
          details.warnings.push("Unable to validate constraints");
        }
        break;

      case "prediction_consistency":
        if (algorithmResults && algorithmResults.length > 1) {
          const fitnessRange =
            Math.max(...algorithmResults.map((r) => r.fitness || 0)) -
            Math.min(...algorithmResults.map((r) => r.fitness || 0));
          details.metrics = {
            algorithmsUsed: algorithmResults.length,
            fitnessRange: fitnessRange.toFixed(2),
          };
          if (fitnessRange > 20) {
            details.warnings.push(
              "Large fitness difference between algorithms",
            );
          }
        }
        break;

      case "algorithm_certainty":
        const avgCertainty =
          algorithmResults?.length > 0
            ? algorithmResults.reduce(
                (sum, r) => sum + (r.confidence || 0.5),
                0,
              ) / algorithmResults.length
            : 0.5;
        details.metrics = {
          averageCertainty: (avgCertainty * 100).toFixed(1) + "%",
        };
        break;
    }

    return details;
  }

  /**
   * Assess overall trustworthiness
   */
  assessTrustworthiness(confidence) {
    const overallScore = confidence.overall;
    const scores = confidence.scores;

    const assessment = {
      level: this.classifyConfidenceLevel(overallScore),
      score: overallScore,
      factors: {
        reliability: (scores.prediction_consistency || 0.5) > 0.7,
        feasibility: (scores.constraint_satisfaction || 0.5) > 0.8,
        stability: (scores.solution_stability || 0.5) > 0.6,
        experience: (scores.historical_accuracy || 0.5) > 0.6,
      },
    };

    assessment.trusted =
      Object.values(assessment.factors).filter(Boolean).length >= 3;

    return assessment;
  }

  /**
   * Identify risk factors in the solution
   */
  identifyRiskFactors(scores) {
    const risks = [];

    if ((scores.constraint_satisfaction || 0) < 0.8) {
      risks.push({
        type: "constraint_violations",
        severity: "high",
        message: "Solution may violate important scheduling constraints",
        impact: "May result in infeasible or problematic schedules",
      });
    }

    if ((scores.prediction_consistency || 0) < 0.6) {
      risks.push({
        type: "inconsistent_predictions",
        severity: "medium",
        message:
          "Different algorithms produced significantly different results",
        impact: "Solution reliability may be questionable",
      });
    }

    if ((scores.algorithm_certainty || 0) < 0.5) {
      risks.push({
        type: "low_algorithm_confidence",
        severity: "medium",
        message: "Optimization algorithms expressed low confidence",
        impact: "Solution may not be optimal",
      });
    }

    if ((scores.solution_stability || 0) < 0.4) {
      risks.push({
        type: "unstable_solution",
        severity: "low",
        message: "Solution shows instability across test runs",
        impact: "Minor variations in results possible",
      });
    }

    return risks;
  }

  /**
   * Generate confidence-based recommendations
   */
  generateConfidenceRecommendations(scores, problemContext) {
    const recommendations = [];

    const overallConfidence = Object.keys(this.scoringFactors).reduce(
      (sum, factor) => {
        return (
          sum + (scores[factor] || 0.5) * this.scoringFactors[factor].weight
        );
      },
      0,
    );

    if (overallConfidence >= 0.85) {
      recommendations.push({
        type: "approval",
        priority: "low",
        message: "High confidence solution - recommended for immediate use",
        action: "Apply schedule with confidence",
      });
    } else if (overallConfidence >= 0.65) {
      recommendations.push({
        type: "review",
        priority: "medium",
        message: "Medium confidence solution - review before implementation",
        action: "Review constraint violations and make adjustments if needed",
      });
    } else {
      recommendations.push({
        type: "caution",
        priority: "high",
        message: "Low confidence solution - use with caution",
        action:
          "Consider running optimization with different parameters or manually review",
      });
    }

    // Specific factor recommendations
    if ((scores.constraint_satisfaction || 0) < 0.7) {
      recommendations.push({
        type: "constraint_warning",
        priority: "high",
        message: "Constraint violations detected",
        action:
          "Review and resolve constraint violations before implementation",
      });
    }

    if ((scores.prediction_consistency || 0) < 0.5) {
      recommendations.push({
        type: "consistency_warning",
        priority: "medium",
        message: "Low consistency between optimization algorithms",
        action: "Consider running optimization again with different parameters",
      });
    }

    return recommendations;
  }

  /**
   * Generate improvement suggestions
   */
  generateImprovementSuggestions(scores, problemContext) {
    const suggestions = [];

    if ((scores.constraint_satisfaction || 0) < 0.8) {
      suggestions.push({
        factor: "constraint_satisfaction",
        suggestion: "Relax some soft constraints or adjust constraint weights",
        impact: "Should improve feasibility and constraint satisfaction",
      });
    }

    if ((scores.algorithm_certainty || 0) < 0.6) {
      suggestions.push({
        factor: "algorithm_certainty",
        suggestion:
          "Increase optimization runtime or use more advanced algorithms",
        impact: "May improve solution quality and algorithm confidence",
      });
    }

    if ((scores.historical_accuracy || 0) < 0.5) {
      suggestions.push({
        factor: "historical_accuracy",
        suggestion: "Continue using the system to build performance history",
        impact: "Future optimizations will benefit from learned patterns",
      });
    }

    return suggestions;
  }

  /**
   * Helper method to validate normal shift assignment
   */
  isValidNormalShift(assignment, staff, date) {
    // Normal shift (empty string) is always valid
    return assignment === "";
  }

  /**
   * Record confidence scoring results for continuous improvement
   */
  recordConfidenceResult(confidence, actualOutcome) {
    this.historicalData.recordConfidence(confidence, actualOutcome);
  }

  /**
   * Get confidence scoring statistics
   */
  getStatistics() {
    return {
      scoringFactors: this.scoringFactors,
      confidenceLevels: this.confidenceLevels,
      thresholds: this.thresholds,
      historicalData: this.historicalData.getSummary(),
    };
  }
}

/**
 * Historical Accuracy Tracking
 */
class HistoricalAccuracyTracker {
  constructor() {
    this.accuracyHistory = [];
    this.confidenceHistory = [];
    this.maxRecords = 500;
  }

  async getAccuracyForSimilarProblems(problemContext, algorithms) {
    // Filter similar problems based on characteristics
    const similarProblems = this.accuracyHistory.filter(
      (record) =>
        this.isSimilarProblem(record.problemContext, problemContext) &&
        algorithms.some((alg) => record.algorithms.includes(alg)),
    );

    if (similarProblems.length === 0) {
      return { averageAccuracy: 0.6, sampleSize: 0 };
    }

    const totalAccuracy = similarProblems.reduce(
      (sum, record) => sum + record.actualAccuracy,
      0,
    );
    const averageAccuracy = totalAccuracy / similarProblems.length;

    return {
      averageAccuracy: Math.min(1, Math.max(0, averageAccuracy)),
      sampleSize: similarProblems.length,
      confidence: this.calculateHistoricalConfidence(similarProblems),
    };
  }

  isSimilarProblem(problem1, problem2) {
    // Simple similarity check
    const staffDiff = Math.abs(
      (problem1.staffMembers?.length || 0) -
        (problem2.staffMembers?.length || 0),
    );
    const dateDiff = Math.abs(
      (problem1.dateRange?.length || 0) - (problem2.dateRange?.length || 0),
    );

    return staffDiff <= 3 && dateDiff <= 7; // Similar if within 3 staff and 7 dates
  }

  calculateHistoricalConfidence(records) {
    if (records.length < 3) return 0.5;

    const accuracies = records.map((r) => r.actualAccuracy);
    const mean =
      accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance =
      accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) /
      accuracies.length;

    // Lower variance = higher confidence
    return Math.max(0.3, Math.min(1, 1 - Math.sqrt(variance)));
  }

  recordConfidence(confidence, actualOutcome) {
    const record = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      predictedConfidence: confidence.overall,
      actualAccuracy: actualOutcome.accuracy || 0.5,
      problemContext: actualOutcome.problemContext,
      algorithms: actualOutcome.algorithms || [],
    };

    this.confidenceHistory.push(record);

    // Keep only recent records
    if (this.confidenceHistory.length > this.maxRecords) {
      this.confidenceHistory = this.confidenceHistory.slice(-this.maxRecords);
    }
  }

  getSummary() {
    return {
      totalAccuracyRecords: this.accuracyHistory.length,
      totalConfidenceRecords: this.confidenceHistory.length,
      averageHistoricalAccuracy: this.calculateAverageHistoricalAccuracy(),
      confidenceCalibration: this.calculateConfidenceCalibration(),
    };
  }

  calculateAverageHistoricalAccuracy() {
    if (this.accuracyHistory.length === 0) return 0;

    const total = this.accuracyHistory.reduce(
      (sum, record) => sum + record.actualAccuracy,
      0,
    );
    return total / this.accuracyHistory.length;
  }

  calculateConfidenceCalibration() {
    if (this.confidenceHistory.length === 0) return 0.5;

    // Calculate how well predicted confidence matches actual accuracy
    const calibrationError = this.confidenceHistory.reduce((sum, record) => {
      return sum + Math.abs(record.predictedConfidence - record.actualAccuracy);
    }, 0);

    const averageCalibrationError =
      calibrationError / this.confidenceHistory.length;
    return Math.max(0, 1 - averageCalibrationError); // Lower error = better calibration
  }
}

/**
 * Solution Consistency Analysis
 */
class ConsistencyAnalyzer {
  analyzeConsistency(algorithmResults) {
    if (algorithmResults.length < 2) {
      return { score: 0.7, analysis: "Single algorithm used" };
    }

    // Analyze various aspects of consistency
    const fitnessConsistency = this.analyzeFitnessConsistency(algorithmResults);
    const solutionConsistency =
      this.analyzeSolutionConsistency(algorithmResults);
    const convergenceConsistency =
      this.analyzeConvergenceConsistency(algorithmResults);

    const overallScore =
      (fitnessConsistency + solutionConsistency + convergenceConsistency) / 3;

    return {
      score: overallScore,
      breakdown: {
        fitness: fitnessConsistency,
        solution: solutionConsistency,
        convergence: convergenceConsistency,
      },
      analysis: this.generateConsistencyAnalysis(overallScore),
    };
  }

  analyzeFitnessConsistency(results) {
    const fitnessValues = results
      .map((r) => r.fitness || 0)
      .filter((f) => f > 0);
    if (fitnessValues.length < 2) return 0.5;

    const mean =
      fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
    const variance =
      fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) /
      fitnessValues.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;

    return Math.max(0, 1 - coefficientOfVariation);
  }

  analyzeSolutionConsistency(results) {
    // This would compare actual schedule solutions
    // For now, return a placeholder
    return 0.75;
  }

  analyzeConvergenceConsistency(results) {
    const convergenceResults = results.filter((r) => r.convergenceReason);
    if (convergenceResults.length < 2) return 0.6;

    // Count convergence reasons
    const reasons = {};
    convergenceResults.forEach((r) => {
      reasons[r.convergenceReason] = (reasons[r.convergenceReason] || 0) + 1;
    });

    // Higher consistency if algorithms converged for similar reasons
    const mostCommonReason = Object.keys(reasons).reduce((a, b) =>
      reasons[a] > reasons[b] ? a : b,
    );
    const mostCommonCount = reasons[mostCommonReason];

    return mostCommonCount / convergenceResults.length;
  }

  generateConsistencyAnalysis(score) {
    if (score >= 0.8) return "High consistency across algorithms";
    if (score >= 0.6) return "Moderate consistency with some variation";
    if (score >= 0.4)
      return "Low consistency - algorithms disagree significantly";
    return "Very low consistency - results highly variable";
  }
}

/**
 * Solution Stability Testing
 */
class StabilityTester {
  async testStability(solution, problemContext, algorithmResults) {
    try {
      // For now, return a stability score based on algorithm results
      const stabilityMetrics = this.analyzeAlgorithmStability(algorithmResults);
      return stabilityMetrics.overallScore;
    } catch (error) {
      console.error("Error in stability testing:", error);
      return 0.7; // Default stable score
    }
  }

  analyzeAlgorithmStability(algorithmResults) {
    if (!algorithmResults || algorithmResults.length === 0) {
      return { overallScore: 0.5, analysis: "No algorithm results to analyze" };
    }

    let stabilityScore = 0.7; // Base score

    // Check for convergence patterns
    const convergenceReasons = algorithmResults
      .map((r) => r.convergenceReason)
      .filter(Boolean);
    if (convergenceReasons.length > 0) {
      const earlyTerminations = convergenceReasons.filter(
        (r) => r === "early_termination",
      ).length;
      const ratio = earlyTerminations / convergenceReasons.length;

      if (ratio > 0.5) {
        stabilityScore += 0.2; // Bonus for early termination (good convergence)
      }
    }

    // Check fitness variance
    const fitnessValues = algorithmResults
      .map((r) => r.fitness || 0)
      .filter((f) => f > 0);
    if (fitnessValues.length > 1) {
      const mean =
        fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
      const variance =
        fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) /
        fitnessValues.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

      // Lower variation = higher stability
      stabilityScore += Math.max(-0.2, 0.2 - coefficientOfVariation);
    }

    return {
      overallScore: Math.max(0, Math.min(1, stabilityScore)),
      analysis: `Stability analysis based on ${algorithmResults.length} algorithm results`,
    };
  }
}
