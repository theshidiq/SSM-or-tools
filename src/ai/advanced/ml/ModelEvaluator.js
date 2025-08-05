/**
 * ModelEvaluator.js
 * 
 * Phase 3: Model Evaluation for machine learning models
 * Provides comprehensive evaluation metrics and schedule quality assessment
 */

/**
 * Model Evaluator for ML model assessment
 */
export class ModelEvaluator {
  constructor() {
    this.initialized = false;
    this.version = '1.0.0';
    
    // Evaluation metrics
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix: null,
      classificationReport: null
    };
    
    // Schedule quality metrics
    this.scheduleMetrics = {
      constraintViolations: 0,
      fairnessScore: 0,
      staffSatisfaction: 0,
      operationalEfficiency: 0,
      overallQuality: 0
    };
    
    // Evaluation history
    this.evaluationHistory = [];
    
    // Configuration
    this.config = {
      metrics: ['accuracy', 'precision', 'recall', 'f1Score'],
      scheduleQuality: ['constraints', 'fairness', 'satisfaction', 'efficiency'],
      classNames: ['△', '○', '▽', '×'], // Shift types
      qualityWeights: {
        constraints: 0.4,
        fairness: 0.25,
        satisfaction: 0.25,
        efficiency: 0.1
      }
    };
  }

  /**
   * Initialize the model evaluator
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log('📊 Initializing Model Evaluator...');
    
    try {
      // Merge configuration
      this.config = { ...this.config, ...config };
      
      this.initialized = true;
      
      console.log('✅ Model Evaluator initialized');
      console.log(`Metrics: ${this.config.metrics.join(', ')}`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        metrics: this.config.metrics,
        qualityMetrics: this.config.scheduleQuality
      };
      
    } catch (error) {
      console.error('❌ Model Evaluator initialization failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Evaluate ML model predictions
   * @param {Array} predictions - Predicted values
   * @param {Array} actualValues - Actual values
   * @param {Object} options - Evaluation options
   * @returns {Object} Evaluation results
   */
  async evaluateModel(predictions, actualValues, options = {}) {
    if (!this.initialized) {
      throw new Error('Model Evaluator not initialized');
    }

    console.log('🎯 Evaluating ML model predictions...');
    
    try {
      // Validate inputs
      if (predictions.length !== actualValues.length) {
        throw new Error('Predictions and actual values length mismatch');
      }
      
      if (predictions.length === 0) {
        throw new Error('Empty prediction set');
      }
      
      // Convert predictions to class labels if needed
      const predictionLabels = this.convertToLabels(predictions);
      const actualLabels = this.convertToLabels(actualValues);
      
      // Calculate basic metrics
      const accuracy = this.calculateAccuracy(predictionLabels, actualLabels);
      const precision = this.calculatePrecision(predictionLabels, actualLabels);
      const recall = this.calculateRecall(predictionLabels, actualLabels);
      const f1Score = this.calculateF1Score(precision, recall);
      
      // Generate confusion matrix
      const confusionMatrix = this.generateConfusionMatrix(predictionLabels, actualLabels);
      
      // Generate classification report
      const classificationReport = this.generateClassificationReport(
        predictionLabels, 
        actualLabels, 
        this.config.classNames
      );
      
      // Calculate confidence metrics
      const confidence = this.calculateConfidenceMetrics(predictions, actualValues);
      
      // Update metrics
      this.metrics = {
        accuracy,
        precision,
        recall,
        f1Score,
        confusionMatrix,
        classificationReport
      };
      
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        metrics: { ...this.metrics },
        confidence,
        sampleCount: predictions.length,
        classDistribution: this.calculateClassDistribution(actualLabels),
        qualityAssessment: this.assessPredictionQuality(accuracy, precision, recall, f1Score)
      };
      
      // Store in evaluation history
      this.evaluationHistory.push({
        timestamp: result.timestamp,
        accuracy,
        f1Score,
        sampleCount: predictions.length
      });
      
      // Keep only last 20 evaluations
      if (this.evaluationHistory.length > 20) {
        this.evaluationHistory = this.evaluationHistory.slice(-20);
      }
      
      console.log(`✅ Model evaluation completed`);
      console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%, F1: ${(f1Score * 100).toFixed(2)}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Model evaluation failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Evaluate schedule quality
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} constraints - Constraint definitions
   * @returns {Object} Schedule evaluation results
   */
  async evaluateSchedule(schedule, staffMembers, dateRange, constraints = {}) {
    if (!this.initialized) {
      throw new Error('Model Evaluator not initialized');
    }

    console.log('📋 Evaluating schedule quality...');
    
    try {
      // Evaluate different aspects of schedule quality
      const constraintScore = await this.evaluateConstraintCompliance(schedule, staffMembers, dateRange, constraints);
      const fairnessScore = await this.evaluateFairness(schedule, staffMembers, dateRange);
      const satisfactionScore = await this.evaluateStaffSatisfaction(schedule, staffMembers, dateRange);
      const efficiencyScore = await this.evaluateOperationalEfficiency(schedule, staffMembers, dateRange);
      
      // Calculate overall quality score
      const overallScore = this.calculateOverallQuality({
        constraints: constraintScore,
        fairness: fairnessScore,
        satisfaction: satisfactionScore,
        efficiency: efficiencyScore
      });
      
      // Update schedule metrics
      this.scheduleMetrics = {
        constraintViolations: 100 - constraintScore,
        fairnessScore,
        staffSatisfaction: satisfactionScore,
        operationalEfficiency: efficiencyScore,
        overallQuality: overallScore
      };
      
      // Generate detailed analysis
      const analysis = await this.generateScheduleAnalysis(schedule, staffMembers, dateRange);
      
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        overallScore,
        scores: {
          constraintCompliance: constraintScore,
          fairness: fairnessScore,
          staffSatisfaction: satisfactionScore,
          operationalEfficiency: efficiencyScore
        },
        metrics: { ...this.scheduleMetrics },
        analysis,
        recommendations: this.generateQualityRecommendations({
          constraints: constraintScore,
          fairness: fairnessScore,
          satisfaction: satisfactionScore,
          efficiency: efficiencyScore
        }),
        confidence: this.calculateScheduleConfidence(overallScore)
      };
      
      console.log(`✅ Schedule evaluation completed`);
      console.log(`Overall Quality: ${overallScore.toFixed(1)}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Schedule evaluation failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        overallScore: 0,
        accuracy: 0,
        confidence: 0
      };
    }
  }

  /**
   * Convert predictions to class labels
   * @param {Array} predictions - Raw predictions
   * @returns {Array} Class labels
   */
  convertToLabels(predictions) {
    return predictions.map(pred => {
      if (Array.isArray(pred)) {
        // Probability array - return argmax
        return this.argmax(pred);
      } else if (typeof pred === 'number') {
        // Single value - round to nearest class
        return Math.round(Math.max(0, Math.min(3, pred)));
      } else {
        // String or other - try to map to class
        const classMap = { '△': 0, '○': 1, '▽': 2, '×': 3 };
        return classMap[pred] !== undefined ? classMap[pred] : 1; // Default to normal
      }
    });
  }

  /**
   * Calculate accuracy
   * @param {Array} predictions - Predicted labels
   * @param {Array} actual - Actual labels
   * @returns {number} Accuracy score
   */
  calculateAccuracy(predictions, actual) {
    if (predictions.length === 0) return 0;
    
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === actual[i]) {
        correct++;
      }
    }
    
    return correct / predictions.length;
  }

  /**
   * Calculate precision (macro-averaged)
   * @param {Array} predictions - Predicted labels
   * @param {Array} actual - Actual labels
   * @returns {number} Precision score
   */
  calculatePrecision(predictions, actual) {
    const classes = [...new Set([...predictions, ...actual])];
    let totalPrecision = 0;
    let validClasses = 0;
    
    for (const cls of classes) {
      const truePositives = this.countTruePositives(predictions, actual, cls);
      const falsePositives = this.countFalsePositives(predictions, actual, cls);
      
      if (truePositives + falsePositives > 0) {
        totalPrecision += truePositives / (truePositives + falsePositives);
        validClasses++;
      }
    }
    
    return validClasses > 0 ? totalPrecision / validClasses : 0;
  }

  /**
   * Calculate recall (macro-averaged)
   * @param {Array} predictions - Predicted labels
   * @param {Array} actual - Actual labels
   * @returns {number} Recall score
   */
  calculateRecall(predictions, actual) {
    const classes = [...new Set([...predictions, ...actual])];
    let totalRecall = 0;
    let validClasses = 0;
    
    for (const cls of classes) {
      const truePositives = this.countTruePositives(predictions, actual, cls);
      const falseNegatives = this.countFalseNegatives(predictions, actual, cls);
      
      if (truePositives + falseNegatives > 0) {
        totalRecall += truePositives / (truePositives + falseNegatives);
        validClasses++;
      }
    }
    
    return validClasses > 0 ? totalRecall / validClasses : 0;
  }

  /**
   * Calculate F1 score
   * @param {number} precision - Precision score
   * @param {number} recall - Recall score
   * @returns {number} F1 score
   */
  calculateF1Score(precision, recall) {
    if (precision + recall === 0) return 0;
    return 2 * (precision * recall) / (precision + recall);
  }

  /**
   * Generate confusion matrix
   * @param {Array} predictions - Predicted labels
   * @param {Array} actual - Actual labels
   * @returns {Array} Confusion matrix
   */
  generateConfusionMatrix(predictions, actual) {
    const classes = [0, 1, 2, 3]; // Shift type classes
    const matrix = Array(classes.length).fill(null).map(() => Array(classes.length).fill(0));
    
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      const act = actual[i];
      
      if (pred >= 0 && pred < classes.length && act >= 0 && act < classes.length) {
        matrix[act][pred]++;
      }
    }
    
    return matrix;
  }

  /**
   * Generate classification report
   * @param {Array} predictions - Predicted labels
   * @param {Array} actual - Actual labels
   * @param {Array} classNames - Class names
   * @returns {Object} Classification report
   */
  generateClassificationReport(predictions, actual, classNames) {
    const report = {};
    
    for (let i = 0; i < classNames.length; i++) {
      const className = classNames[i];
      const truePositives = this.countTruePositives(predictions, actual, i);
      const falsePositives = this.countFalsePositives(predictions, actual, i);
      const falseNegatives = this.countFalseNegatives(predictions, actual, i);
      
      const precision = truePositives + falsePositives > 0 ? 
        truePositives / (truePositives + falsePositives) : 0;
      const recall = truePositives + falseNegatives > 0 ? 
        truePositives / (truePositives + falseNegatives) : 0;
      const f1Score = precision + recall > 0 ? 
        2 * (precision * recall) / (precision + recall) : 0;
      const support = actual.filter(a => a === i).length;
      
      report[className] = {
        precision,
        recall,
        f1Score,
        support
      };
    }
    
    return report;
  }

  /**
   * Calculate confidence metrics
   * @param {Array} predictions - Raw predictions
   * @param {Array} actual - Actual values
   * @returns {Object} Confidence metrics
   */
  calculateConfidenceMetrics(predictions, actual) {
    let totalConfidence = 0;
    let calibrationError = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      const act = actual[i];
      
      if (Array.isArray(pred)) {
        // Probability array - use max probability as confidence
        const maxProb = Math.max(...pred);
        totalConfidence += maxProb;
        
        // Calibration error (simplified)
        const predictedClass = this.argmax(pred);
        const actualClass = Array.isArray(act) ? this.argmax(act) : act;
        const isCorrect = predictedClass === actualClass ? 1 : 0;
        calibrationError += Math.abs(maxProb - isCorrect);
      }
    }
    
    const avgConfidence = predictions.length > 0 ? totalConfidence / predictions.length : 0;
    const avgCalibrationError = predictions.length > 0 ? calibrationError / predictions.length : 0;
    
    return {
      averageConfidence: avgConfidence,
      calibrationError: avgCalibrationError,
      reliabilityScore: Math.max(0, 1 - avgCalibrationError)
    };
  }

  /**
   * Calculate class distribution
   * @param {Array} labels - Class labels
   * @returns {Object} Class distribution
   */
  calculateClassDistribution(labels) {
    const distribution = {};
    const total = labels.length;
    
    this.config.classNames.forEach((className, index) => {
      const count = labels.filter(label => label === index).length;
      distribution[className] = {
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      };
    });
    
    return distribution;
  }

  /**
   * Assess prediction quality
   * @param {number} accuracy - Accuracy score
   * @param {number} precision - Precision score
   * @param {number} recall - Recall score
   * @param {number} f1Score - F1 score
   * @returns {Object} Quality assessment
   */
  assessPredictionQuality(accuracy, precision, recall, f1Score) {
    const overallScore = (accuracy + precision + recall + f1Score) / 4;
    
    let qualityLevel;
    if (overallScore >= 0.9) qualityLevel = 'excellent';
    else if (overallScore >= 0.8) qualityLevel = 'good';
    else if (overallScore >= 0.7) qualityLevel = 'fair';
    else if (overallScore >= 0.6) qualityLevel = 'poor';
    else qualityLevel = 'very_poor';
    
    return {
      overallScore,
      qualityLevel,
      strengths: this.identifyStrengths({ accuracy, precision, recall, f1Score }),
      weaknesses: this.identifyWeaknesses({ accuracy, precision, recall, f1Score }),
      recommendations: this.generateModelRecommendations({ accuracy, precision, recall, f1Score })
    };
  }

  /**
   * Evaluate constraint compliance
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} constraints - Constraints
   * @returns {number} Constraint compliance score (0-100)
   */
  async evaluateConstraintCompliance(schedule, staffMembers, dateRange, constraints) {
    // Simplified constraint evaluation
    let violations = 0;
    let totalChecks = 0;
    
    // Check daily coverage limits
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      let dailyOffCount = 0;
      
      staffMembers.forEach(staff => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] === '×') {
          dailyOffCount++;
        }
      });
      
      totalChecks++;
      if (dailyOffCount > 4) { // Max 4 staff off per day
        violations++;
      }
    });
    
    // Check monthly day-off limits
    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};
      const daysOff = Object.values(staffSchedule).filter(shift => shift === '×').length;
      const totalDays = dateRange.length;
      const maxDaysOff = Math.floor(totalDays * 0.25); // Max 25% days off
      
      totalChecks++;
      if (daysOff > maxDaysOff) {
        violations++;
      }
    });
    
    const complianceRate = totalChecks > 0 ? (totalChecks - violations) / totalChecks : 1;
    return Math.round(complianceRate * 100);
  }

  /**
   * Evaluate fairness (workload distribution)
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fairness score (0-100)
   */
  async evaluateFairness(schedule, staffMembers, dateRange) {
    const workDays = [];
    
    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};
      const workDayCount = Object.values(staffSchedule).filter(shift => shift !== '×').length;
      workDays.push(workDayCount);
    });
    
    if (workDays.length === 0) return 100;
    
    // Calculate coefficient of variation (lower is better)
    const mean = workDays.reduce((sum, days) => sum + days, 0) / workDays.length;
    const variance = workDays.reduce((sum, days) => sum + Math.pow(days - mean, 2), 0) / workDays.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
    
    // Convert to fairness score (inverse of variation)
    const fairnessScore = Math.max(0, 100 - (coefficientOfVariation * 100));
    return Math.round(fairnessScore);
  }

  /**
   * Evaluate staff satisfaction (simplified)
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Satisfaction score (0-100)
   */
  async evaluateStaffSatisfaction(schedule, staffMembers, dateRange) {
    let totalSatisfaction = 0;
    let staffCount = 0;
    
    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};
      let staffSatisfaction = 70; // Base satisfaction
      
      // Check for preferred day off patterns (simplified)
      const sundayShifts = [];
      dateRange.forEach(date => {
        if (date.getDay() === 0) { // Sunday
          const dateKey = date.toISOString().split('T')[0];
          sundayShifts.push(staffSchedule[dateKey]);
        }
      });
      
      // Reward Sunday days off for some staff
      const sundayDaysOff = sundayShifts.filter(shift => shift === '×').length;
      if (sundayDaysOff > 0) {
        staffSatisfaction += 10;
      }
      
      // Check for consecutive work days
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = staffSchedule[dateKey];
        
        if (shift && shift !== '×') {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 0;
        }
      });
      
      // Penalize excessive consecutive work days
      if (maxConsecutive > 6) {
        staffSatisfaction -= (maxConsecutive - 6) * 5;
      }
      
      totalSatisfaction += Math.max(0, Math.min(100, staffSatisfaction));
      staffCount++;
    });
    
    return staffCount > 0 ? Math.round(totalSatisfaction / staffCount) : 70;
  }

  /**
   * Evaluate operational efficiency
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Efficiency score (0-100)
   */
  async evaluateOperationalEfficiency(schedule, staffMembers, dateRange) {
    let efficiencyScore = 80; // Base efficiency
    
    // Check coverage adequacy
    let adequatelyCoveredDays = 0;
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      let workingStaff = 0;
      
      staffMembers.forEach(staff => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] && staffSchedule[dateKey] !== '×') {
          workingStaff++;
        }
      });
      
      // Check if coverage is adequate (at least 70% of staff)
      const requiredCoverage = Math.ceil(staffMembers.length * 0.7);
      if (workingStaff >= requiredCoverage) {
        adequatelyCoveredDays++;
      }
    });
    
    const coverageRate = dateRange.length > 0 ? adequatelyCoveredDays / dateRange.length : 1;
    efficiencyScore = Math.round(coverageRate * 100);
    
    return Math.max(0, Math.min(100, efficiencyScore));
  }

  /**
   * Calculate overall quality score
   * @param {Object} scores - Individual scores
   * @returns {number} Overall quality score
   */
  calculateOverallQuality(scores) {
    const weights = this.config.qualityWeights;
    
    const weightedScore = (
      (scores.constraints * weights.constraints) +
      (scores.fairness * weights.fairness) +
      (scores.satisfaction * weights.satisfaction) +
      (scores.efficiency * weights.efficiency)
    );
    
    return Math.round(weightedScore);
  }

  /**
   * Generate schedule analysis
   * @param {Object} schedule - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Object} Detailed analysis
   */
  async generateScheduleAnalysis(schedule, staffMembers, dateRange) {
    const analysis = {
      totalStaff: staffMembers.length,
      totalDays: dateRange.length,
      totalAssignments: 0,
      shiftDistribution: { '△': 0, '○': 0, '▽': 0, '×': 0 },
      staffWorkload: {},
      dailyStaffing: {},
      patterns: {}
    };
    
    // Analyze shift distribution and workload
    staffMembers.forEach(staff => {
      const staffSchedule = schedule[staff.id] || {};
      let workDays = 0;
      
      Object.entries(staffSchedule).forEach(([dateKey, shiftType]) => {
        analysis.totalAssignments++;
        
        if (analysis.shiftDistribution[shiftType] !== undefined) {
          analysis.shiftDistribution[shiftType]++;
        }
        
        if (shiftType !== '×') {
          workDays++;
        }
      });
      
      analysis.staffWorkload[staff.id] = {
        name: staff.name,
        workDays,
        workRatio: dateRange.length > 0 ? workDays / dateRange.length : 0
      };
    });
    
    // Analyze daily staffing levels
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      let workingStaff = 0;
      
      staffMembers.forEach(staff => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] && staffSchedule[dateKey] !== '×') {
          workingStaff++;
        }
      });
      
      analysis.dailyStaffing[dateKey] = workingStaff;
    });
    
    return analysis;
  }

  /**
   * Generate quality recommendations
   * @param {Object} scores - Quality scores
   * @returns {Array} Recommendations
   */
  generateQualityRecommendations(scores) {
    const recommendations = [];
    
    if (scores.constraints < 80) {
      recommendations.push({
        type: 'constraint_improvement',
        priority: 'high',
        description: 'Address constraint violations to improve schedule compliance',
        suggestedActions: [
          'Review daily staffing limits',
          'Check monthly day-off distributions',
          'Validate group restrictions'
        ]
      });
    }
    
    if (scores.fairness < 70) {
      recommendations.push({
        type: 'fairness_improvement',
        priority: 'medium',
        description: 'Improve workload distribution among staff members',
        suggestedActions: [
          'Balance work day assignments',
          'Rotate demanding shifts',
          'Monitor individual workloads'
        ]
      });
    }
    
    if (scores.satisfaction < 75) {
      recommendations.push({
        type: 'satisfaction_improvement',
        priority: 'medium',
        description: 'Enhance staff satisfaction through better preference matching',
        suggestedActions: [
          'Consider individual day-off preferences',
          'Avoid excessive consecutive work days',
          'Implement flexible scheduling options'
        ]
      });
    }
    
    if (scores.efficiency < 85) {
      recommendations.push({
        type: 'efficiency_improvement',
        priority: 'low',
        description: 'Optimize operational efficiency',
        suggestedActions: [
          'Ensure adequate daily coverage',
          'Optimize shift distributions',
          'Plan for peak demand periods'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate schedule confidence
   * @param {number} overallScore - Overall quality score
   * @returns {number} Confidence level (0-1)
   */
  calculateScheduleConfidence(overallScore) {
    // Map quality score to confidence level
    return Math.min(1, Math.max(0, overallScore / 100));
  }

  // Helper methods for metric calculations

  countTruePositives(predictions, actual, targetClass) {
    let count = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === targetClass && actual[i] === targetClass) {
        count++;
      }
    }
    return count;
  }

  countFalsePositives(predictions, actual, targetClass) {
    let count = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === targetClass && actual[i] !== targetClass) {
        count++;
      }
    }
    return count;
  }

  countFalseNegatives(predictions, actual, targetClass) {
    let count = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== targetClass && actual[i] === targetClass) {
        count++;
      }
    }
    return count;
  }

  argmax(array) {
    let maxIndex = 0;
    let maxValue = array[0];
    
    for (let i = 1; i < array.length; i++) {
      if (array[i] > maxValue) {
        maxValue = array[i];
        maxIndex = i;
      }
    }
    
    return maxIndex;
  }

  identifyStrengths(metrics) {
    const strengths = [];
    
    if (metrics.accuracy >= 0.8) strengths.push('High accuracy');
    if (metrics.precision >= 0.8) strengths.push('Good precision');
    if (metrics.recall >= 0.8) strengths.push('Good recall');
    if (metrics.f1Score >= 0.8) strengths.push('Balanced performance');
    
    return strengths;
  }

  identifyWeaknesses(metrics) {
    const weaknesses = [];
    
    if (metrics.accuracy < 0.7) weaknesses.push('Low accuracy');
    if (metrics.precision < 0.7) weaknesses.push('Poor precision');
    if (metrics.recall < 0.7) weaknesses.push('Poor recall');
    if (Math.abs(metrics.precision - metrics.recall) > 0.2) weaknesses.push('Imbalanced precision/recall');
    
    return weaknesses;
  }

  generateModelRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.accuracy < 0.8) {
      recommendations.push('Consider more training data or feature engineering');
    }
    
    if (metrics.precision < 0.8) {
      recommendations.push('Reduce false positives through better classification thresholds');
    }
    
    if (metrics.recall < 0.8) {
      recommendations.push('Improve feature representation to capture more patterns');
    }
    
    return recommendations;
  }

  /**
   * Get evaluator status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      version: this.version,
      metrics: { ...this.metrics },
      scheduleMetrics: { ...this.scheduleMetrics },
      evaluationHistory: this.evaluationHistory.length,
      config: this.config
    };
  }

  /**
   * Reset the model evaluator
   * @returns {Object} Reset result
   */
  async reset() {
    console.log('🔄 Resetting Model Evaluator...');
    
    try {
      this.initialized = false;
      
      // Reset metrics
      this.metrics = {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        confusionMatrix: null,
        classificationReport: null
      };
      
      this.scheduleMetrics = {
        constraintViolations: 0,
        fairnessScore: 0,
        staffSatisfaction: 0,
        operationalEfficiency: 0,
        overallQuality: 0
      };
      
      // Reset history
      this.evaluationHistory = [];
      
      console.log('✅ Model Evaluator reset successfully');
      
      return {
        success: true,
        message: 'Model Evaluator reset successfully',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Model Evaluator reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}