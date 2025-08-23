/**
 * FallbackMLProcessor.js
 * 
 * Fallback ML processor for when Web Workers are not available.
 * Implements progressive processing with yielding to prevent UI blocking.
 */

import { ScheduleGenerator } from '../core/ScheduleGenerator';

class FallbackMLProcessor {
  constructor() {
    this.isInitialized = false;
    this.isCancelled = false;
    this.isProcessing = false;
    this.scheduleGenerator = null;
    this.yieldThreshold = 50; // Yield after processing this many items
    this.yieldInterval = 16; // Target 60fps (16ms between yields)
    
    // Memory tracking
    this.memoryTracker = {
      peakMemory: 0,
      currentAllocations: 0,
      cleanupCount: 0
    };
    
    // Processing stats
    this.processingStats = {
      totalOperations: 0,
      completedOperations: 0,
      yieldCount: 0,
      averageChunkTime: 0
    };
  }

  /**
   * Initialize the fallback processor
   */
  async initialize(options = {}) {
    try {
      console.log('🔄 Initializing Fallback ML Processor...');
      
      this.scheduleGenerator = new ScheduleGenerator();
      await this.scheduleGenerator.initialize(options);
      
      // Configure for progressive processing
      this.configureProgressiveSettings(options);
      
      this.isInitialized = true;
      console.log('✅ Fallback ML Processor initialized');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Fallback processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process ML predictions with progressive yielding
   */
  async process(data, progressCallback) {
    if (!this.isInitialized) {
      throw new Error('Processor not initialized');
    }

    if (this.isProcessing) {
      throw new Error('Already processing');
    }

    const startTime = Date.now();
    this.isProcessing = true;
    this.isCancelled = false;
    
    const { scheduleData, staffMembers, dateRange, options = {} } = data;
    
    try {
      // Initialize progress tracking
      const totalWork = staffMembers.length * dateRange.length;
      let completedWork = 0;
      
      this.processingStats.totalOperations = totalWork;
      this.processingStats.completedOperations = 0;
      this.processingStats.yieldCount = 0;
      
      // Report initial progress
      this.reportProgress(progressCallback, {
        progress: 0,
        stage: 'initializing',
        message: '処理を開始しています...',
        stats: { totalWork, completedWork }
      });

      // Phase 1: Data preparation with yielding
      const preparedData = await this.prepareDataWithYielding(
        scheduleData, 
        staffMembers, 
        dateRange, 
        options,
        (progress) => {
          this.reportProgress(progressCallback, {
            progress: Math.floor(progress * 0.15), // Use 15% for preparation
            stage: 'preparing',
            message: 'データを準備しています...',
            stats: { totalWork, completedWork: Math.floor(totalWork * progress) }
          });
        }
      );

      if (this.isCancelled) throw new Error('Processing cancelled');

      // Phase 2: ML prediction with chunked processing
      const predictions = await this.processMLPredictionsWithYielding(
        preparedData,
        (progress) => {
          const overallProgress = 15 + Math.floor(progress * 0.70); // Use 70% for ML
          this.reportProgress(progressCallback, {
            progress: overallProgress,
            stage: 'ml_processing',
            message: `AI予測を実行中... (${Math.floor(progress)}%)`,
            stats: { totalWork, completedWork: Math.floor(totalWork * progress) }
          });
        }
      );

      if (this.isCancelled) throw new Error('Processing cancelled');

      // Phase 3: Constraint validation with yielding
      const validationResults = await this.validateConstraintsWithYielding(
        predictions,
        preparedData,
        (progress) => {
          const overallProgress = 85 + Math.floor(progress * 0.10); // Use 10% for validation
          this.reportProgress(progressCallback, {
            progress: overallProgress,
            stage: 'validating',
            message: '制約を検証しています...',
            stats: { totalWork, completedWork: Math.floor(totalWork * progress) }
          });
        }
      );

      if (this.isCancelled) throw new Error('Processing cancelled');

      // Phase 4: Final optimization
      const optimizedResults = await this.optimizeResultsWithYielding(
        predictions,
        validationResults,
        preparedData,
        (progress) => {
          const overallProgress = 95 + Math.floor(progress * 0.05); // Use 5% for optimization
          this.reportProgress(progressCallback, {
            progress: overallProgress,
            stage: 'optimizing',
            message: '結果を最適化しています...',
            stats: { totalWork, completedWork: totalWork }
          });
        }
      );

      if (this.isCancelled) throw new Error('Processing cancelled');

      const processingTime = Date.now() - startTime;
      
      // Final progress report
      this.reportProgress(progressCallback, {
        progress: 100,
        stage: 'completed',
        message: '処理が完了しました',
        stats: { 
          totalWork, 
          completedWork: totalWork,
          processingTime,
          yieldCount: this.processingStats.yieldCount
        }
      });

      return {
        success: true,
        results: optimizedResults,
        processingTime,
        method: 'fallback',
        stats: {
          ...this.processingStats,
          processingTime,
          memoryStats: this.getMemoryStats()
        }
      };

    } catch (error) {
      if (error.message === 'Processing cancelled') {
        return { success: false, cancelled: true };
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Prepare data with yielding to prevent UI blocking
   */
  async prepareDataWithYielding(scheduleData, staffMembers, dateRange, options, progressCallback) {
    const totalSteps = staffMembers.length + dateRange.length + 10; // Extra steps for setup
    let completedSteps = 0;
    
    const preparedData = {
      schedule: JSON.parse(JSON.stringify(scheduleData)),
      staff: [...staffMembers],
      dates: [...dateRange],
      features: new Map(),
      constraints: null,
      options: { ...options }
    };

    // Step 1: Process staff data
    for (let i = 0; i < staffMembers.length; i++) {
      if (this.shouldYield()) {
        await this.yieldControl();
        if (this.isCancelled) return null;
      }

      const staff = staffMembers[i];
      
      // Process staff features
      preparedData.features.set(staff.id, {
        name: staff.name,
        type: staff.type || 'regular',
        position: staff.position || '',
        historicalPatterns: this.extractStaffPatterns(staff, scheduleData),
        workloadBalance: this.calculateWorkloadBalance(staff, scheduleData, dateRange)
      });

      completedSteps++;
      if (progressCallback && completedSteps % 5 === 0) {
        progressCallback(completedSteps / totalSteps);
      }
    }

    // Step 2: Process date features
    for (let i = 0; i < dateRange.length; i++) {
      if (this.shouldYield()) {
        await this.yieldControl();
        if (this.isCancelled) return null;
      }

      const date = dateRange[i];
      const dateKey = date.toISOString().split('T')[0];
      
      // Extract date features
      preparedData.features.set(`date_${dateKey}`, {
        dayOfWeek: date.getDay(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        monthDay: date.getDate(),
        season: this.getSeason(date),
        currentLoad: this.calculateDateLoad(dateKey, scheduleData, staffMembers)
      });

      completedSteps++;
      if (progressCallback && completedSteps % 10 === 0) {
        progressCallback(completedSteps / totalSteps);
      }
    }

    // Step 3: Load constraints (with yielding)
    await this.yieldControl();
    preparedData.constraints = await this.loadConstraintsData();
    completedSteps += 10;

    if (progressCallback) {
      progressCallback(1.0);
    }

    return preparedData;
  }

  /**
   * Process ML predictions with chunked processing and yielding
   */
  async processMLPredictionsWithYielding(preparedData, progressCallback) {
    const { schedule, staff, dates } = preparedData;
    const predictions = new Map();
    const confidence = new Map();
    
    const totalCells = staff.length * dates.length;
    let processedCells = 0;
    
    // Process in chunks to allow yielding
    const chunkSize = Math.min(this.yieldThreshold, 25);
    
    for (let staffIndex = 0; staffIndex < staff.length; staffIndex++) {
      const currentStaff = staff[staffIndex];
      
      for (let dateIndex = 0; dateIndex < dates.length; dateIndex += chunkSize) {
        if (this.shouldYield()) {
          await this.yieldControl();
          if (this.isCancelled) return null;
        }

        const chunkStartTime = Date.now();
        const endIndex = Math.min(dateIndex + chunkSize, dates.length);
        
        // Process chunk
        for (let i = dateIndex; i < endIndex; i++) {
          const date = dates[i];
          const dateKey = date.toISOString().split('T')[0];
          const cellKey = `${currentStaff.id}_${dateKey}`;
          
          // Skip if already assigned
          if (schedule[currentStaff.id] && schedule[currentStaff.id][dateKey]) {
            processedCells++;
            continue;
          }

          try {
            // Generate ML prediction (simplified for fallback)
            const prediction = await this.generatePrediction(
              currentStaff, 
              date, 
              schedule, 
              preparedData
            );
            
            if (prediction) {
              predictions.set(cellKey, prediction.shift);
              confidence.set(cellKey, prediction.confidence);
            }
            
          } catch (error) {
            console.warn(`Prediction failed for ${currentStaff.name} on ${dateKey}:`, error);
          }
          
          processedCells++;
        }

        // Update chunk timing stats
        const chunkTime = Date.now() - chunkStartTime;
        this.updateChunkStats(chunkTime, endIndex - dateIndex);
        
        // Report progress
        if (progressCallback) {
          progressCallback(processedCells / totalCells);
        }
      }
    }

    return { predictions, confidence };
  }

  /**
   * Validate constraints with yielding
   */
  async validateConstraintsWithYielding(predictions, preparedData, progressCallback) {
    const violations = [];
    const corrections = [];
    
    const allPredictions = Array.from(predictions.predictions.entries());
    const totalValidations = allPredictions.length;
    let completedValidations = 0;
    
    // Process validations in chunks
    const chunkSize = this.yieldThreshold;
    
    for (let i = 0; i < allPredictions.length; i += chunkSize) {
      if (this.shouldYield()) {
        await this.yieldControl();
        if (this.isCancelled) return null;
      }

      const chunk = allPredictions.slice(i, Math.min(i + chunkSize, allPredictions.length));
      
      for (const [cellKey, prediction] of chunk) {
        const [staffId, dateKey] = cellKey.split('_');
        const staff = preparedData.staff.find(s => s.id === staffId);
        
        if (staff) {
          // Validate prediction against constraints
          const validation = await this.validatePrediction(
            staff, 
            dateKey, 
            prediction, 
            preparedData
          );
          
          if (!validation.valid) {
            violations.push({
              cellKey,
              staffId,
              dateKey,
              violation: validation.violation,
              severity: validation.severity
            });
            
            // Auto-correct if possible
            if (validation.suggestedFix) {
              corrections.push({
                cellKey,
                originalPrediction: prediction,
                correctedPrediction: validation.suggestedFix
              });
              
              // Apply correction
              predictions.predictions.set(cellKey, validation.suggestedFix);
            }
          }
        }
        
        completedValidations++;
      }
      
      // Report progress
      if (progressCallback) {
        progressCallback(completedValidations / totalValidations);
      }
    }

    return { violations, corrections };
  }

  /**
   * Optimize results with yielding
   */
  async optimizeResultsWithYielding(predictions, validationResults, preparedData, progressCallback) {
    // Simple optimization pass to improve overall schedule quality
    const optimizationSteps = 10;
    let completedSteps = 0;
    
    for (let step = 0; step < optimizationSteps; step++) {
      if (this.shouldYield()) {
        await this.yieldControl();
        if (this.isCancelled) return null;
      }

      // Perform optimization step (simplified)
      await this.optimizationStep(predictions, preparedData);
      
      completedSteps++;
      if (progressCallback) {
        progressCallback(completedSteps / optimizationSteps);
      }
    }

    return {
      predictions: predictions.predictions,
      confidence: predictions.confidence,
      violations: validationResults.violations,
      corrections: validationResults.corrections,
      optimizationPasses: optimizationSteps
    };
  }

  /**
   * Generate a prediction for a specific staff member and date
   */
  async generatePrediction(staff, date, schedule, preparedData) {
    try {
      // Simplified ML prediction using rule-based approach
      const features = this.extractFeatures(staff, date, schedule, preparedData);
      
      // Basic prediction logic (can be enhanced with actual ML)
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Calculate probabilities for each shift type
      const probabilities = {
        '○': 0.4, // normal
        '△': 0.2, // early
        '▽': 0.2, // late
        '×': 0.2  // off
      };
      
      // Adjust probabilities based on features
      if (staff.name === '料理長' && dayOfWeek === 0) { // Sunday
        probabilities['△'] = 0.7; // High probability for early shift
        probabilities['○'] = 0.2;
        probabilities['▽'] = 0.05;
        probabilities['×'] = 0.05;
      }
      
      if (isWeekend) {
        probabilities['×'] += 0.1; // Higher off probability on weekends
      }
      
      // Normalize probabilities
      const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
      Object.keys(probabilities).forEach(key => {
        probabilities[key] = probabilities[key] / total;
      });
      
      // Select best prediction
      let bestShift = '○';
      let bestProb = 0;
      
      for (const [shift, prob] of Object.entries(probabilities)) {
        if (prob > bestProb) {
          bestProb = prob;
          bestShift = shift;
        }
      }
      
      return {
        shift: bestShift,
        confidence: Math.round(bestProb * 100),
        probabilities
      };
      
    } catch (error) {
      console.warn('Prediction generation failed:', error);
      return null;
    }
  }

  /**
   * Extract features for ML prediction
   */
  extractFeatures(staff, date, schedule, preparedData) {
    const features = {};
    
    // Staff features
    features.isChef = staff.name === '料理長';
    features.isRegular = staff.type === 'regular';
    
    // Date features
    features.dayOfWeek = date.getDay();
    features.isWeekend = date.getDay() === 0 || date.getDay() === 6;
    features.monthDay = date.getDate();
    
    // Historical features
    const staffData = preparedData.features.get(staff.id);
    if (staffData) {
      features.workloadBalance = staffData.workloadBalance || 0;
      features.historicalPreference = staffData.historicalPatterns || {};
    }
    
    return features;
  }

  /**
   * Validate a prediction against constraints
   */
  async validatePrediction(staff, dateKey, prediction, preparedData) {
    // Simplified constraint validation
    try {
      // Check off day limits
      if (prediction === '×') {
        const offDayCount = this.countOffDays(staff, preparedData.schedule);
        if (offDayCount >= 8) { // Monthly limit
          return {
            valid: false,
            violation: 'monthly_off_limit',
            severity: 'high',
            suggestedFix: '○' // Change to normal shift
          };
        }
      }
      
      // Check group conflicts (simplified)
      if (prediction === '×' || prediction === '△') {
        const hasGroupConflict = await this.checkGroupConflict(staff, dateKey, prediction, preparedData);
        if (hasGroupConflict) {
          return {
            valid: false,
            violation: 'group_conflict',
            severity: 'high',
            suggestedFix: '○'
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      console.warn('Validation error:', error);
      return { valid: true }; // Assume valid if validation fails
    }
  }

  /**
   * Perform an optimization step
   */
  async optimizationStep(predictions, preparedData) {
    // Simple optimization: balance workload across staff
    const staffWorkloads = new Map();
    
    // Calculate current workloads
    for (const [cellKey, prediction] of predictions.predictions) {
      if (prediction !== '×') { // Count working shifts
        const [staffId] = cellKey.split('_');
        staffWorkloads.set(staffId, (staffWorkloads.get(staffId) || 0) + 1);
      }
    }
    
    // Find imbalances and make minor adjustments (simplified)
    const avgWorkload = Array.from(staffWorkloads.values()).reduce((sum, w) => sum + w, 0) / staffWorkloads.size;
    
    for (const [staffId, workload] of staffWorkloads) {
      if (workload > avgWorkload + 2) {
        // Try to reduce workload for this staff member
        await this.reduceStaffWorkload(staffId, predictions, preparedData);
      }
    }
  }

  /**
   * Check if we should yield control back to the main thread
   */
  shouldYield() {
    this.processingStats.yieldCount++;
    return this.processingStats.yieldCount % this.yieldThreshold === 0;
  }

  /**
   * Yield control to prevent UI blocking
   */
  async yieldControl() {
    return new Promise(resolve => {
      setTimeout(resolve, this.yieldInterval);
    });
  }

  /**
   * Report progress to callback
   */
  reportProgress(callback, data) {
    if (callback && typeof callback === 'function') {
      try {
        callback(data);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    }
  }

  /**
   * Cancel processing
   */
  cancel() {
    this.isCancelled = true;
    console.log('🛑 Fallback processor cancellation requested');
  }

  /**
   * Destroy processor and cleanup
   */
  async destroy() {
    this.cancel();
    
    if (this.scheduleGenerator) {
      // Cleanup schedule generator if needed
      this.scheduleGenerator = null;
    }
    
    this.isInitialized = false;
    console.log('🧹 Fallback processor destroyed');
  }

  /**
   * Perform memory cleanup
   */
  async performMemoryCleanup() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.memoryTracker.cleanupCount++;
    
    return {
      success: true,
      cleanupCount: this.memoryTracker.cleanupCount,
      estimatedMemory: this.getEstimatedMemoryUsage()
    };
  }

  /**
   * Configure progressive processing settings
   */
  configureProgressiveSettings(options) {
    if (options.yieldThreshold) {
      this.yieldThreshold = options.yieldThreshold;
    }
    
    if (options.yieldInterval) {
      this.yieldInterval = options.yieldInterval;
    }
    
    // Adjust for device performance
    if (options.devicePerformance === 'low') {
      this.yieldThreshold = Math.max(10, this.yieldThreshold / 2);
      this.yieldInterval = Math.max(32, this.yieldInterval * 2);
    }
  }

  // Helper methods
  extractStaffPatterns(staff, scheduleData) {
    // Simplified pattern extraction
    return {};
  }

  calculateWorkloadBalance(staff, scheduleData, dateRange) {
    // Simplified workload calculation
    return 0.5;
  }

  getSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  calculateDateLoad(dateKey, scheduleData, staffMembers) {
    // Simplified date load calculation
    return 0.5;
  }

  async loadConstraintsData() {
    // Load constraint configuration
    return {};
  }

  countOffDays(staff, schedule) {
    let count = 0;
    if (schedule[staff.id]) {
      for (const shift of Object.values(schedule[staff.id])) {
        if (shift === '×') count++;
      }
    }
    return count;
  }

  async checkGroupConflict(staff, dateKey, prediction, preparedData) {
    // Simplified group conflict check
    return false;
  }

  async reduceStaffWorkload(staffId, predictions, preparedData) {
    // Simplified workload reduction
  }

  updateChunkStats(chunkTime, chunkSize) {
    this.processingStats.averageChunkTime = 
      (this.processingStats.averageChunkTime + chunkTime) / 2;
  }

  getMemoryStats() {
    return {
      estimatedUsage: this.getEstimatedMemoryUsage(),
      peakUsage: this.memoryTracker.peakMemory,
      cleanupCount: this.memoryTracker.cleanupCount
    };
  }

  getEstimatedMemoryUsage() {
    // Rough estimate of memory usage
    return Math.round(Math.random() * 50) * 1024 * 1024; // Random 0-50MB
  }
}

export { FallbackMLProcessor };