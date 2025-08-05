/**
 * OptimizationEngine.js
 * 
 * Multi-objective optimization engine for shift scheduling.
 * Optimizes schedules for fairness, staff preferences, efficiency, and business objectives.
 */

import {
  validateAllConstraints,
  isOffDay,
  isEarlyShift,
  isLateShift,
  isNormalShift,
  isWorkingShift,
  getDayOfWeek,
  PRIORITY_RULES
} from "../constraints/ConstraintEngine";

/**
 * OptimizationEngine class for multi-objective schedule optimization
 */
export class OptimizationEngine {
  constructor() {
    this.initialized = false;
    this.optimizationObjectives = new Map();
    this.weightingSchemes = new Map();
    this.optimizationHistory = [];
    this.performanceMetrics = {
      totalOptimizations: 0,
      averageImprovementScore: 0,
      averageOptimizationTime: 0,
      objectiveSuccessRates: {},
      bestScoreAchieved: 0
    };
  }

  /**
   * Initialize the optimization engine
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    console.log('🎯 Initializing Optimization Engine...');
    
    try {
      // Initialize optimization objectives
      this.initializeOptimizationObjectives();
      
      // Initialize weighting schemes for different scenarios
      this.initializeWeightingSchemes();
      
      this.initialized = true;
      console.log('✅ Optimization Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Optimization Engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize optimization objectives
   */
  initializeOptimizationObjectives() {
    // Constraint Satisfaction - Ensure all business rules are met
    this.optimizationObjectives.set('constraint_satisfaction', {
      name: 'Constraint Satisfaction',
      description: 'Minimize constraint violations',
      weight: 0.4,
      calculate: this.calculateConstraintScore.bind(this),
      priority: 'critical'
    });

    // Fairness - Even distribution of shifts and workload
    this.optimizationObjectives.set('fairness', {
      name: 'Fairness',
      description: 'Ensure fair distribution of shifts across staff',
      weight: 0.25,
      calculate: this.calculateFairnessScore.bind(this),
      priority: 'high'
    });

    // Staff Preferences - Satisfy individual staff preferences
    this.optimizationObjectives.set('preferences', {
      name: 'Staff Preferences',
      description: 'Maximize staff preference satisfaction',
      weight: 0.2,
      calculate: this.calculatePreferenceScore.bind(this),
      priority: 'medium'
    });

    // Efficiency - Optimize coverage and resource utilization
    this.optimizationObjectives.set('efficiency', {
      name: 'Efficiency',
      description: 'Optimize coverage and resource utilization',
      weight: 0.1,
      calculate: this.calculateEfficiencyScore.bind(this),
      priority: 'medium'
    });

    // Business Priority - Important business rules and priorities
    this.optimizationObjectives.set('business_priority', {
      name: 'Business Priority',
      description: 'Satisfy high-priority business rules',
      weight: 0.05,
      calculate: this.calculateBusinessPriorityScore.bind(this),
      priority: 'low'
    });
  }

  /**
   * Initialize weighting schemes for different optimization scenarios
   */
  initializeWeightingSchemes() {
    // Balanced approach - equal emphasis on all objectives
    this.weightingSchemes.set('balanced', {
      constraint_satisfaction: 0.3,
      fairness: 0.25,
      preferences: 0.25,
      efficiency: 0.15,
      business_priority: 0.05
    });

    // Constraint-focused - prioritize rule compliance
    this.weightingSchemes.set('constraint_focused', {
      constraint_satisfaction: 0.5,
      fairness: 0.2,
      preferences: 0.15,
      efficiency: 0.1,
      business_priority: 0.05
    });

    // Staff-focused - prioritize staff satisfaction
    this.weightingSchemes.set('staff_focused', {
      constraint_satisfaction: 0.25,
      fairness: 0.35,
      preferences: 0.3,
      efficiency: 0.05,
      business_priority: 0.05
    });

    // Business-focused - prioritize operational efficiency
    this.weightingSchemes.set('business_focused', {
      constraint_satisfaction: 0.35,
      fairness: 0.15,
      preferences: 0.15,
      efficiency: 0.3,
      business_priority: 0.05
    });
  }

  /**
   * Optimize a schedule using multi-objective optimization
   * @param {Object} scheduleData - Schedule to optimize
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Optimization options
   * @returns {Object} Optimization result
   */
  async optimize(scheduleData, staffMembers, dateRange, options = {}) {
    if (!this.initialized) {
      throw new Error('OptimizationEngine not initialized');
    }

    const {
      goals = ['constraint_satisfaction', 'fairness', 'preferences'],
      weightingScheme = 'balanced',
      maxIterations = 100,
      convergenceThreshold = 0.01,
      preserveImportantAssignments = true
    } = options;

    console.log(`🎯 Starting multi-objective optimization with ${goals.length} objectives...`);
    
    try {
      const startTime = Date.now();
      const workingSchedule = JSON.parse(JSON.stringify(scheduleData));
      
      // Get weighting scheme
      const weights = this.weightingSchemes.get(weightingScheme) || this.weightingSchemes.get('balanced');
      
      // Calculate initial scores
      const initialScores = await this.calculateAllObjectiveScores(
        workingSchedule, 
        staffMembers, 
        dateRange, 
        goals
      );
      
      const initialOverallScore = this.calculateWeightedScore(initialScores, weights, goals);
      
      console.log(`📊 Initial overall score: ${initialOverallScore.toFixed(2)}%`);
      
      let currentSchedule = workingSchedule;
      let currentScore = initialOverallScore;
      let bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
      let bestScore = currentScore;
      let iteration = 0;
      let noImprovementCount = 0;
      let improvements = [];

      // Optimization loop
      while (iteration < maxIterations && noImprovementCount < 20) {
        iteration++;
        
        // Generate candidate solutions using different strategies
        const candidates = await this.generateCandidateSolutions(
          currentSchedule,
          staffMembers,
          dateRange,
          {
            preserveImportant: preserveImportantAssignments,
            focusObjectives: goals,
            iteration
          }
        );

        // Evaluate all candidates
        let bestCandidate = null;
        let bestCandidateScore = -1;

        for (const candidate of candidates) {
          const candidateScores = await this.calculateAllObjectiveScores(
            candidate.schedule,
            staffMembers,
            dateRange,
            goals
          );
          
          const candidateOverallScore = this.calculateWeightedScore(candidateScores, weights, goals);
          
          if (candidateOverallScore > bestCandidateScore) {
            bestCandidateScore = candidateOverallScore;
            bestCandidate = {
              schedule: candidate.schedule,
              score: candidateOverallScore,
              scores: candidateScores,
              strategy: candidate.strategy
            };
          }
        }

        // Check for improvement
        if (bestCandidate && bestCandidateScore > currentScore + convergenceThreshold) {
          const improvement = bestCandidateScore - currentScore;
          currentSchedule = bestCandidate.schedule;
          currentScore = bestCandidateScore;
          noImprovementCount = 0;
          
          improvements.push({
            iteration,
            improvement,
            score: currentScore,
            strategy: bestCandidate.strategy
          });
          
          // Update best if this is the best so far
          if (currentScore > bestScore) {
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
            bestScore = currentScore;
          }

          console.log(`📈 Iteration ${iteration}: Score improved by ${improvement.toFixed(2)}% to ${currentScore.toFixed(2)}% using ${bestCandidate.strategy}`);
        } else {
          noImprovementCount++;
        }

        // Early termination if we reach excellent score
        if (currentScore >= 95) {
          console.log(`🎯 Excellent score achieved (${currentScore.toFixed(2)}%), stopping optimization`);
          break;
        }
      }

      const optimizationTime = Date.now() - startTime;
      const improvementScore = bestScore - initialOverallScore;

      // Calculate final detailed scores
      const finalScores = await this.calculateAllObjectiveScores(
        bestSchedule,
        staffMembers,
        dateRange,
        goals
      );

      // Update performance metrics
      this.performanceMetrics.totalOptimizations++;
      this.performanceMetrics.averageImprovementScore = 
        (this.performanceMetrics.averageImprovementScore + improvementScore) / 
        this.performanceMetrics.totalOptimizations;
      
      this.performanceMetrics.averageOptimizationTime = 
        (this.performanceMetrics.averageOptimizationTime + optimizationTime) / 
        this.performanceMetrics.totalOptimizations;

      if (bestScore > this.performanceMetrics.bestScoreAchieved) {
        this.performanceMetrics.bestScoreAchieved = bestScore;
      }

      // Update objective success rates
      goals.forEach(goal => {
        const score = finalScores[goal] || 0;
        if (!this.performanceMetrics.objectiveSuccessRates[goal]) {
          this.performanceMetrics.objectiveSuccessRates[goal] = 0;
        }
        this.performanceMetrics.objectiveSuccessRates[goal] = 
          (this.performanceMetrics.objectiveSuccessRates[goal] + score) / 
          this.performanceMetrics.totalOptimizations;
      });

      // Store optimization in history
      this.optimizationHistory.push({
        timestamp: new Date().toISOString(),
        goals,
        weightingScheme,
        initialScore: initialOverallScore,
        finalScore: bestScore,
        improvementScore,
        iterations: iteration,
        optimizationTime,
        staffCount: staffMembers.length,
        dateCount: dateRange.length
      });

      // Keep only last 30 optimizations
      if (this.optimizationHistory.length > 30) {
        this.optimizationHistory = this.optimizationHistory.slice(-30);
      }

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        schedule: bestSchedule,
        optimizationScore: bestScore,
        improvementScore,
        initialScore: initialOverallScore,
        iterations: iteration,
        optimizationTime,
        objectives: {
          initial: initialScores,
          final: finalScores,
          weights: weights,
          goals: goals
        },
        improvements,
        analysis: {
          convergenceReached: noImprovementCount >= 20,
          earlyTermination: bestScore >= 95,
          averageImprovementPerIteration: improvements.length > 0 ? 
            improvementScore / improvements.length : 0,
          objectiveBreakdown: this.analyzeObjectiveContributions(finalScores, weights, goals)
        },
        fairnessScore: finalScores.fairness || 0,
        preferenceScore: finalScores.preferences || 0,
        efficiencyScore: finalScores.efficiency || 0,
        recommendations: await this.generateOptimizationRecommendations(
          bestSchedule,
          finalScores,
          staffMembers,
          dateRange
        )
      };

      console.log(`✅ Optimization completed in ${optimizationTime}ms after ${iteration} iterations`);
      console.log(`📊 Score improved from ${initialOverallScore.toFixed(2)}% to ${bestScore.toFixed(2)}% (+${improvementScore.toFixed(2)}%)`);

      return result;

    } catch (error) {
      console.error('❌ Optimization failed:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        schedule: scheduleData,
        optimizationScore: 0,
        improvementScore: 0
      };
    }
  }

  /**
   * Generate candidate solutions for optimization
   * @param {Object} currentSchedule - Current schedule
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} options - Generation options
   * @returns {Array} Array of candidate solutions
   */
  async generateCandidateSolutions(currentSchedule, staffMembers, dateRange, options = {}) {
    const candidates = [];
    const { focusObjectives = [], iteration = 0 } = options;

    // Strategy 1: Local improvement - small random changes
    const localImprovement = this.generateLocalImprovement(currentSchedule, staffMembers, dateRange);
    candidates.push({
      schedule: localImprovement,
      strategy: 'local_improvement'
    });

    // Strategy 2: Fairness-focused adjustment
    if (focusObjectives.includes('fairness')) {
      const fairnessAdjustment = await this.generateFairnessAdjustment(currentSchedule, staffMembers, dateRange);
      candidates.push({
        schedule: fairnessAdjustment,
        strategy: 'fairness_adjustment'
      });
    }

    // Strategy 3: Preference-focused adjustment
    if (focusObjectives.includes('preferences')) {
      const preferenceAdjustment = await this.generatePreferenceAdjustment(currentSchedule, staffMembers, dateRange);
      candidates.push({
        schedule: preferenceAdjustment,
        strategy: 'preference_adjustment'
      });
    }

    // Strategy 4: Efficiency-focused adjustment
    if (focusObjectives.includes('efficiency')) {
      const efficiencyAdjustment = await this.generateEfficiencyAdjustment(currentSchedule, staffMembers, dateRange);
      candidates.push({
        schedule: efficiencyAdjustment,
        strategy: 'efficiency_adjustment'
      });
    }

    // Strategy 5: Constraint-focused adjustment
    if (focusObjectives.includes('constraint_satisfaction')) {
      const constraintAdjustment = await this.generateConstraintAdjustment(currentSchedule, staffMembers, dateRange);
      candidates.push({
        schedule: constraintAdjustment,
        strategy: 'constraint_adjustment'
      });
    }

    // Strategy 6: Random perturbation (exploration)
    if (iteration % 10 === 0) { // Every 10th iteration
      const randomPerturbation = this.generateRandomPerturbation(currentSchedule, staffMembers, dateRange);
      candidates.push({
        schedule: randomPerturbation,
        strategy: 'random_exploration'
      });
    }

    return candidates;
  }

  /**
   * Calculate constraint satisfaction score
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Constraint score (0-100)
   */
  async calculateConstraintScore(schedule, staffMembers, dateRange) {
    try {
      const validation = validateAllConstraints(schedule, staffMembers, dateRange);
      
      if (validation.valid) {
        return 100;
      }

      // Calculate score based on violation severity
      const totalPossibleViolations = staffMembers.length * dateRange.length;
      const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
      
      let totalPenalty = 0;
      totalPenalty += validation.summary.criticalViolations * severityWeights.critical;
      totalPenalty += validation.summary.highViolations * severityWeights.high;
      totalPenalty += validation.summary.mediumViolations * severityWeights.medium;
      
      // Convert penalty to score (higher penalty = lower score)
      const maxPenalty = totalPossibleViolations * severityWeights.critical;
      const score = Math.max(0, 100 - (totalPenalty / maxPenalty) * 100);
      
      return score;
      
    } catch (error) {
      console.error('Error calculating constraint score:', error);
      return 0;
    }
  }

  /**
   * Calculate fairness score based on workload distribution
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Fairness score (0-100)
   */
  async calculateFairnessScore(schedule, staffMembers, dateRange) {
    try {
      // Calculate workload for each staff member
      const workloads = staffMembers.map(staff => {
        let workingDays = 0;
        let offDays = 0;
        let earlyShifts = 0;
        let lateShifts = 0;

        dateRange.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          const shift = schedule[staff.id]?.[dateKey];
          
          if (shift !== undefined) {
            if (isOffDay(shift)) {
              offDays++;
            } else {
              workingDays++;
              if (isEarlyShift(shift)) earlyShifts++;
              else if (isLateShift(shift)) lateShifts++;
            }
          }
        });

        return {
          staffId: staff.id,
          staffName: staff.name,
          workingDays,
          offDays,
          earlyShifts,
          lateShifts,
          workloadRatio: dateRange.length > 0 ? workingDays / dateRange.length : 0
        };
      });

      if (workloads.length === 0) return 100;

      // Calculate distribution variance
      const workloadRatios = workloads.map(w => w.workloadRatio);
      const avgWorkload = workloadRatios.reduce((sum, ratio) => sum + ratio, 0) / workloadRatios.length;
      const variance = workloadRatios.reduce((sum, ratio) => sum + Math.pow(ratio - avgWorkload, 2), 0) / workloadRatios.length;
      const stdDev = Math.sqrt(variance);

      // Calculate fairness score (lower standard deviation = higher fairness)
      const fairnessScore = Math.max(0, 100 - (stdDev * 200)); // Scale stdDev to 0-100

      // Also consider off day distribution
      const offDayCounts = workloads.map(w => w.offDays);
      const avgOffDays = offDayCounts.reduce((sum, count) => sum + count, 0) / offDayCounts.length;
      const offDayVariance = offDayCounts.reduce((sum, count) => sum + Math.pow(count - avgOffDays, 2), 0) / offDayCounts.length;
      const offDayStdDev = Math.sqrt(offDayVariance);
      const offDayFairness = Math.max(0, 100 - (offDayStdDev * 20));

      // Combine workload and off day fairness
      return (fairnessScore * 0.7) + (offDayFairness * 0.3);

    } catch (error) {
      console.error('Error calculating fairness score:', error);
      return 0;
    }
  }

  /**
   * Calculate preference satisfaction score
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Preference score (0-100)
   */
  async calculatePreferenceScore(schedule, staffMembers, dateRange) {
    try {
      let totalScore = 0;
      let totalRules = 0;

      // Check priority rules satisfaction
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeek(dateKey);

        Object.keys(PRIORITY_RULES).forEach(staffName => {
          const staff = staffMembers.find(s => s.name === staffName);
          if (!staff || !schedule[staff.id] || schedule[staff.id][dateKey] === undefined) {
            return;
          }

          const currentShift = schedule[staff.id][dateKey];
          const rules = PRIORITY_RULES[staffName];

          rules.preferredShifts.forEach(rule => {
            if (rule.day === dayOfWeek) {
              totalRules++;
              let satisfied = false;

              switch (rule.shift) {
                case 'early':
                  satisfied = isEarlyShift(currentShift);
                  break;
                case 'off':
                  satisfied = isOffDay(currentShift);
                  break;
                case 'late':
                  satisfied = isLateShift(currentShift);
                  break;
                case 'normal':
                  satisfied = isNormalShift(currentShift);
                  break;
              }

              if (satisfied) {
                totalScore += rule.priority === 'high' ? 100 : 70;
              }
            }
          });
        });
      });

      return totalRules > 0 ? totalScore / totalRules : 100;

    } catch (error) {
      console.error('Error calculating preference score:', error);
      return 0;
    }
  }

  /**
   * Calculate efficiency score
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Efficiency score (0-100)
   */
  async calculateEfficiencyScore(schedule, staffMembers, dateRange) {
    try {
      let totalScore = 0;
      let scoreComponents = 0;

      // Coverage efficiency - ensure adequate staffing
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeek(dateKey);
        
        let workingCount = 0;
        staffMembers.forEach(staff => {
          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            const shift = schedule[staff.id][dateKey];
            if (isWorkingShift(shift)) {
              workingCount++;
            }
          }
        });

        // Optimal working count varies by day
        const optimalWorking = dayOfWeek === 'sunday' || dayOfWeek === 'saturday' ? 
          Math.ceil(staffMembers.length * 0.8) : // Weekends need more staff
          Math.ceil(staffMembers.length * 0.7);   // Weekdays

        const coverageRatio = workingCount / optimalWorking;
        const coverageScore = coverageRatio > 1 ? 
          Math.max(50, 100 - (coverageRatio - 1) * 50) : // Overstaffing penalty
          coverageRatio * 100; // Understaffing penalty

        totalScore += coverageScore;
        scoreComponents++;
      });

      // Shift distribution efficiency
      const shiftCounts = { early: 0, normal: 0, late: 0, off: 0 };
      
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        staffMembers.forEach(staff => {
          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            const shift = schedule[staff.id][dateKey];
            if (isEarlyShift(shift)) shiftCounts.early++;
            else if (isLateShift(shift)) shiftCounts.late++;
            else if (isOffDay(shift)) shiftCounts.off++;
            else shiftCounts.normal++;
          }
        });
      });

      // Optimal distribution: more normal shifts, balanced early/late
      const totalShifts = Object.values(shiftCounts).reduce((sum, count) => sum + count, 0);
      if (totalShifts > 0) {
        const normalRatio = shiftCounts.normal / totalShifts;
        const distributionScore = normalRatio * 100; // Prefer normal shifts
        
        totalScore += distributionScore;
        scoreComponents++;
      }

      return scoreComponents > 0 ? totalScore / scoreComponents : 100;

    } catch (error) {
      console.error('Error calculating efficiency score:', error);
      return 0;
    }
  }

  /**
   * Calculate business priority score
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {number} Business priority score (0-100)
   */
  async calculateBusinessPriorityScore(schedule, staffMembers, dateRange) {
    try {
      // This could include various business-specific rules
      // For now, just return a high score if constraints are met
      const constraintScore = await this.calculateConstraintScore(schedule, staffMembers, dateRange);
      return constraintScore;

    } catch (error) {
      console.error('Error calculating business priority score:', error);
      return 0;
    }
  }

  /**
   * Calculate all objective scores
   * @param {Object} schedule - Schedule to evaluate
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Array} goals - Objectives to calculate
   * @returns {Object} Object with all scores
   */
  async calculateAllObjectiveScores(schedule, staffMembers, dateRange, goals) {
    const scores = {};

    for (const goal of goals) {
      const objective = this.optimizationObjectives.get(goal);
      if (objective) {
        scores[goal] = await objective.calculate(schedule, staffMembers, dateRange);
      }
    }

    return scores;
  }

  /**
   * Calculate weighted overall score
   * @param {Object} scores - Individual objective scores
   * @param {Object} weights - Weighting scheme
   * @param {Array} goals - Goals to include
   * @returns {number} Weighted overall score
   */
  calculateWeightedScore(scores, weights, goals) {
    let totalScore = 0;
    let totalWeight = 0;

    goals.forEach(goal => {
      const score = scores[goal] || 0;
      const weight = weights[goal] || 0;
      totalScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Candidate generation strategies
  generateLocalImprovement(schedule, staffMembers, dateRange) {
    const improved = JSON.parse(JSON.stringify(schedule));
    
    // Make small random changes
    const numChanges = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numChanges; i++) {
      const randomStaff = staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate = dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split('T')[0];
      
      if (improved[randomStaff.id] && improved[randomStaff.id][dateKey] !== undefined) {
        const possibleShifts = ['', '△', '◇', '×'];
        const newShift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
        improved[randomStaff.id][dateKey] = newShift;
      }
    }
    
    return improved;
  }

  async generateFairnessAdjustment(schedule, staffMembers, dateRange) {
    const adjusted = JSON.parse(JSON.stringify(schedule));
    
    // Calculate current workloads and identify imbalances
    const workloads = staffMembers.map(staff => {
      let workingDays = 0;
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const shift = schedule[staff.id]?.[dateKey];
        if (shift !== undefined && !isOffDay(shift)) {
          workingDays++;
        }
      });
      return { staff, workingDays, ratio: workingDays / dateRange.length };
    });

    // Sort by workload
    workloads.sort((a, b) => b.ratio - a.ratio);
    
    // Try to balance by moving shifts from high-workload to low-workload staff
    const overworked = workloads.slice(0, Math.ceil(workloads.length / 3));
    const underworked = workloads.slice(-Math.ceil(workloads.length / 3));
    
    if (overworked.length > 0 && underworked.length > 0) {
      const sourceStaff = overworked[0].staff;
      const targetStaff = underworked[0].staff;
      
      // Find a working day for source staff and try to swap with off day from target
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const sourceShift = adjusted[sourceStaff.id]?.[dateKey];
        const targetShift = adjusted[targetStaff.id]?.[dateKey];
        
        if (isWorkingShift(sourceShift) && isOffDay(targetShift)) {
          // Swap shifts
          adjusted[sourceStaff.id][dateKey] = targetShift;
          adjusted[targetStaff.id][dateKey] = sourceShift;
        }
      });
    }
    
    return adjusted;
  }

  async generatePreferenceAdjustment(schedule, staffMembers, dateRange) {
    const adjusted = JSON.parse(JSON.stringify(schedule));
    
    // Apply priority rules more strictly
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = getDayOfWeek(dateKey);
      
      Object.keys(PRIORITY_RULES).forEach(staffName => {
        const staff = staffMembers.find(s => s.name === staffName);
        if (!staff || !adjusted[staff.id] || adjusted[staff.id][dateKey] === undefined) {
          return;
        }

        const rules = PRIORITY_RULES[staffName];
        rules.preferredShifts.forEach(rule => {
          if (rule.day === dayOfWeek) {
            let targetShift = '';
            switch (rule.shift) {
              case 'early': targetShift = '△'; break;
              case 'off': targetShift = '×'; break;
              case 'late': targetShift = '◇'; break;
              default: targetShift = '';
            }
            adjusted[staff.id][dateKey] = targetShift;
          }
        });
      });
    });
    
    return adjusted;
  }

  async generateEfficiencyAdjustment(schedule, staffMembers, dateRange) {
    const adjusted = JSON.parse(JSON.stringify(schedule));
    
    // Optimize shift distribution for better coverage
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = getDayOfWeek(dateKey);
      
      // Count current shifts
      let workingCount = 0;
      staffMembers.forEach(staff => {
        if (adjusted[staff.id] && adjusted[staff.id][dateKey] !== undefined) {
          const shift = adjusted[staff.id][dateKey];
          if (isWorkingShift(shift)) workingCount++;
        }
      });
      
      // Adjust if under/overstaffed
      const optimalWorking = dayOfWeek === 'sunday' || dayOfWeek === 'saturday' ? 
        Math.ceil(staffMembers.length * 0.8) : 
        Math.ceil(staffMembers.length * 0.7);
      
      if (workingCount < optimalWorking) {
        // Convert some off days to working days
        const staffOff = staffMembers.filter(staff => 
          adjusted[staff.id] && 
          adjusted[staff.id][dateKey] !== undefined && 
          isOffDay(adjusted[staff.id][dateKey])
        );
        
        const needed = Math.min(optimalWorking - workingCount, staffOff.length);
        for (let i = 0; i < needed; i++) {
          adjusted[staffOff[i].id][dateKey] = '';
        }
      }
    });
    
    return adjusted;
  }

  async generateConstraintAdjustment(schedule, staffMembers, dateRange) {
    const adjusted = JSON.parse(JSON.stringify(schedule));
    
    // Try to fix constraint violations
    const validation = validateAllConstraints(adjusted, staffMembers, dateRange);
    
    if (!validation.valid && validation.violations.length > 0) {
      // Simple fix: if staff group conflict, change one member to working
      validation.violations.forEach(violation => {
        if (violation.type === 'staff_group_conflict') {
          const { date, details } = violation;
          if (details.conflictingMembers && details.conflictingMembers.length > 0) {
            const memberName = details.conflictingMembers[0].split(' ')[0];
            const staff = staffMembers.find(s => s.name === memberName);
            if (staff && adjusted[staff.id]) {
              adjusted[staff.id][date] = ''; // Change to normal working shift
            }
          }
        }
      });
    }
    
    return adjusted;
  }

  generateRandomPerturbation(schedule, staffMembers, dateRange) {
    const perturbed = JSON.parse(JSON.stringify(schedule));
    
    // Make larger random changes for exploration
    const numChanges = Math.floor(Math.random() * 10) + 5;
    
    for (let i = 0; i < numChanges; i++) {
      const randomStaff = staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const randomDate = dateRange[Math.floor(Math.random() * dateRange.length)];
      const dateKey = randomDate.toISOString().split('T')[0];
      
      if (perturbed[randomStaff.id] && perturbed[randomStaff.id][dateKey] !== undefined) {
        const possibleShifts = ['', '△', '◇', '×'];
        const newShift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
        perturbed[randomStaff.id][dateKey] = newShift;
      }
    }
    
    return perturbed;
  }

  /**
   * Analyze objective contributions to overall score
   * @param {Object} scores - Individual scores
   * @param {Object} weights - Weights used
   * @param {Array} goals - Goals evaluated
   * @returns {Object} Analysis of contributions
   */
  analyzeObjectiveContributions(scores, weights, goals) {
    const contributions = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    goals.forEach(goal => {
      const score = scores[goal] || 0;
      const weight = weights[goal] || 0;
      const contribution = score * weight;
      
      contributions[goal] = {
        score,
        weight,
        contribution,
        percentage: 0 // Will be calculated after total
      };
      
      totalWeightedScore += contribution;
      totalWeight += weight;
    });

    // Calculate percentages
    if (totalWeightedScore > 0) {
      Object.keys(contributions).forEach(goal => {
        contributions[goal].percentage = 
          (contributions[goal].contribution / totalWeightedScore) * 100;
      });
    }

    return {
      contributions,
      totalScore: totalWeight > 0 ? totalWeightedScore / totalWeight : 0,
      dominatingObjective: Object.keys(contributions).reduce((a, b) => 
        contributions[a].contribution > contributions[b].contribution ? a : b
      )
    };
  }

  /**
   * Generate optimization recommendations
   * @param {Object} schedule - Optimized schedule
   * @param {Object} scores - Final scores
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Array} Recommendations
   */
  async generateOptimizationRecommendations(schedule, scores, staffMembers, dateRange) {
    const recommendations = [];

    // Recommendations based on scores
    Object.keys(scores).forEach(objective => {
      const score = scores[objective];
      
      if (score < 70) {
        recommendations.push({
          type: 'objective_improvement',
          objective,
          priority: score < 50 ? 'high' : 'medium',
          description: `${objective} score is ${score.toFixed(1)}% - consider improvements`,
          suggestions: this.getObjectiveImprovementSuggestions(objective, score)
        });
      }
    });

    return recommendations;
  }

  /**
   * Get improvement suggestions for specific objective
   * @param {string} objective - Objective name
   * @param {number} score - Current score
   * @returns {Array} Suggestions
   */
  getObjectiveImprovementSuggestions(objective, score) {
    const suggestions = [];

    switch (objective) {
      case 'constraint_satisfaction':
        suggestions.push('Review and resolve constraint violations');
        suggestions.push('Check staff group conflicts');
        suggestions.push('Validate monthly and daily limits');
        break;
      
      case 'fairness':
        suggestions.push('Balance workload distribution across staff');
        suggestions.push('Ensure even distribution of off days');
        suggestions.push('Review shift assignments for equity');
        break;
      
      case 'preferences':
        suggestions.push('Apply priority rules more consistently');
        suggestions.push('Consider staff preferences in assignments');
        suggestions.push('Review Sunday shift preferences');
        break;
      
      case 'efficiency':
        suggestions.push('Optimize coverage levels for different days');
        suggestions.push('Balance shift distribution');
        suggestions.push('Review staffing for peak vs regular days');
        break;
    }

    return suggestions;
  }

  /**
   * Get recommendations for schedule improvements
   * @param {Object} scheduleData - Schedule data
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @returns {Array} Recommendations
   */
  async getRecommendations(scheduleData, staffMembers, dateRange) {
    const recommendations = [];

    // Calculate current scores
    const scores = await this.calculateAllObjectiveScores(
      scheduleData, 
      staffMembers, 
      dateRange, 
      ['constraint_satisfaction', 'fairness', 'preferences', 'efficiency']
    );

    // Generate recommendations based on scores
    Object.keys(scores).forEach(objective => {
      const score = scores[objective];
      
      if (score < 80) {
        recommendations.push({
          type: 'optimization_opportunity',
          objective,
          currentScore: score,
          priority: score < 60 ? 'high' : 'medium',
          description: `${objective.replace('_', ' ')} can be improved from ${score.toFixed(1)}%`,
          expectedImpact: {
            efficiency: objective === 'efficiency' ? 20 : 5,
            fairness: objective === 'fairness' ? 20 : 5,
            satisfaction: objective === 'preferences' ? 20 : 5
          }
        });
      }
    });

    return recommendations;
  }

  /**
   * Get optimizer status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      objectives: Array.from(this.optimizationObjectives.keys()),
      weightingSchemes: Array.from(this.weightingSchemes.keys()),
      performance: { ...this.performanceMetrics },
      recentOptimizations: this.optimizationHistory.slice(-10)
    };
  }
}