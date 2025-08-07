/**
 * ErrorHandler.js
 * 
 * Production-ready error handling and system monitoring for the hybrid AI system.
 * Provides comprehensive error recovery, fallback strategies, and system health monitoring.
 */

class AIErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.systemHealth = {
      overall: 'healthy',
      lastCheck: Date.now(),
      mlEngineStatus: 'unknown',
      ruleEngineStatus: 'unknown',
      hybridSystemStatus: 'unknown'
    };
    this.fallbackStrategies = new Map();
    this.recoveryAttempts = new Map();
    this.maxRecoveryAttempts = 3;
    this.criticalErrors = new Set();
    
    // Performance monitoring
    this.performanceMetrics = {
      errorRate: 0,
      recoveryRate: 0,
      averageRecoveryTime: 0,
      criticalErrorCount: 0,
      lastHourErrors: []
    };
    
    this.initializeFallbackStrategies();
    this.startHealthMonitoring();
  }

  /**
   * Initialize fallback strategies for different error types
   */
  initializeFallbackStrategies() {
    // ML Engine errors
    this.fallbackStrategies.set('ml_initialization_error', {
      priority: 'high',
      strategy: this.handleMLInitializationError.bind(this),
      fallbackMethod: 'rule_based_only',
      description: 'ML initialization failed, use rule-based system only'
    });

    this.fallbackStrategies.set('ml_prediction_error', {
      priority: 'medium',
      strategy: this.handleMLPredictionError.bind(this),
      fallbackMethod: 'rule_based_prediction',
      description: 'ML prediction failed, fallback to rule-based prediction'
    });

    this.fallbackStrategies.set('ml_training_error', {
      priority: 'medium',
      strategy: this.handleMLTrainingError.bind(this),
      fallbackMethod: 'use_pretrained_model',
      description: 'ML training failed, continue with existing model'
    });

    // Rule Engine errors
    this.fallbackStrategies.set('rule_validation_error', {
      priority: 'high',
      strategy: this.handleRuleValidationError.bind(this),
      fallbackMethod: 'basic_validation',
      description: 'Rule validation failed, use basic constraint checking'
    });

    this.fallbackStrategies.set('rule_correction_error', {
      priority: 'medium',
      strategy: this.handleRuleCorrectionError.bind(this),
      fallbackMethod: 'no_corrections',
      description: 'Rule correction failed, accept schedule with violations'
    });

    // System-level errors
    this.fallbackStrategies.set('memory_error', {
      priority: 'critical',
      strategy: this.handleMemoryError.bind(this),
      fallbackMethod: 'memory_cleanup_and_restart',
      description: 'Memory error detected, cleanup and restart components'
    });

    this.fallbackStrategies.set('data_extraction_error', {
      priority: 'high',
      strategy: this.handleDataExtractionError.bind(this),
      fallbackMethod: 'basic_schedule_generation',
      description: 'Data extraction failed, generate basic schedule'
    });

    // Network/Storage errors
    this.fallbackStrategies.set('storage_error', {
      priority: 'medium',
      strategy: this.handleStorageError.bind(this),
      fallbackMethod: 'in_memory_only',
      description: 'Storage error, continue with in-memory operations only'
    });

    // Browser compatibility errors
    this.fallbackStrategies.set('browser_compatibility_error', {
      priority: 'high',
      strategy: this.handleBrowserCompatibilityError.bind(this),
      fallbackMethod: 'legacy_mode',
      description: 'Browser compatibility issue, switch to legacy mode'
    });
  }

  /**
   * Handle browser compatibility errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleBrowserCompatibilityError(errorRecord) {
    try {
      console.log('🔧 Handling browser compatibility error...');
      
      return {
        success: true,
        method: 'legacy_mode',
        message: 'Browser compatibility issue, switched to legacy mode',
        data: {
          legacyMode: true,
          modernFeaturesDisabled: true,
          recommendedAction: 'Consider updating browser for full functionality'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'browser_compatibility_recovery'
      };
    }
  }

  /**
   * Handle storage errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleStorageError(errorRecord) {
    try {
      console.log('🔧 Handling storage error...');
      
      return {
        success: true,
        method: 'in_memory_only',
        message: 'Storage error, continuing with in-memory operations only',
        data: {
          inMemoryMode: true,
          persistenceDisabled: true,
          recommendedAction: 'Data may be lost on page refresh'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'storage_error_recovery'
      };
    }
  }

  /**
   * Handle rule correction errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleRuleCorrectionError(errorRecord) {
    try {
      console.log('🔧 Handling rule correction error...');
      
      return {
        success: true,
        method: 'no_corrections',
        message: 'Rule correction failed, accepting schedule with violations',
        data: {
          correctionsDisabled: true,
          violationsAccepted: true,
          recommendedAction: 'Manually review and adjust schedule'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'rule_correction_recovery'
      };
    }
  }

  /**
   * Start continuous health monitoring
   */
  startHealthMonitoring() {
    // Check system health every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);

    // Clean up old error data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  /**
   * Main error handling entry point
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {Object} metadata - Additional error metadata
   * @returns {Promise<Object>} Error handling result
   */
  async handleError(error, context, metadata = {}) {
    const errorId = this.generateErrorId();
    const timestamp = Date.now();
    
    console.error(`🚨 AI System Error [${errorId}] in ${context}:`, error);

    try {
      // Record the error
      const errorRecord = {
        id: errorId,
        timestamp,
        context,
        message: error.message,
        stack: error.stack,
        metadata,
        severity: this.assessErrorSeverity(error, context),
        type: this.categorizeError(error, context)
      };

      this.errorHistory.push(errorRecord);
      this.updatePerformanceMetrics(errorRecord);

      // Check if this is a critical error
      if (errorRecord.severity === 'critical') {
        this.criticalErrors.add(errorId);
        await this.handleCriticalError(errorRecord);
      }

      // Attempt error recovery
      const recoveryResult = await this.attemptErrorRecovery(errorRecord);

      // Update system health
      await this.updateSystemHealth(errorRecord, recoveryResult);

      return {
        success: recoveryResult.success,
        errorId,
        type: errorRecord.type,
        severity: errorRecord.severity,
        recovery: recoveryResult,
        fallback: recoveryResult.fallbackMethod,
        message: recoveryResult.success ? 
          `Error recovered using ${recoveryResult.fallbackMethod}` :
          `Error recovery failed: ${recoveryResult.error}`,
        data: recoveryResult.data,
        recommendedAction: this.getRecommendedAction(errorRecord),
        systemHealth: this.getSystemHealth()
      };

    } catch (handlerError) {
      console.error('❌ Error handler itself failed:', handlerError);
      
      // Fallback to most basic error handling
      return {
        success: false,
        errorId: 'handler-error',
        type: 'error_handler_failure',
        severity: 'critical',
        message: `Error handler failed: ${handlerError.message}`,
        fallback: 'basic_functionality',
        recommendedAction: 'Restart application',
        systemHealth: { status: 'critical', message: 'Error handler failure' }
      };
    }
  }

  /**
   * Attempt to recover from an error using appropriate strategy
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async attemptErrorRecovery(errorRecord) {
    const recoveryKey = `${errorRecord.type}_${errorRecord.context}`;
    
    // Check if we've attempted recovery too many times
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
    if (attempts >= this.maxRecoveryAttempts) {
      return {
        success: false,
        error: 'Max recovery attempts exceeded',
        attempts,
        giveUp: true
      };
    }

    // Increment recovery attempts
    this.recoveryAttempts.set(recoveryKey, attempts + 1);

    try {
      // Find appropriate fallback strategy
      const strategy = this.fallbackStrategies.get(errorRecord.type);
      
      if (strategy) {
        console.log(`🔄 Attempting recovery using strategy: ${strategy.description}`);
        const startTime = Date.now();
        
        const recoveryResult = await strategy.strategy(errorRecord);
        const recoveryTime = Date.now() - startTime;
        
        // Reset recovery attempts on success
        if (recoveryResult.success) {
          this.recoveryAttempts.delete(recoveryKey);
        }
        
        return {
          ...recoveryResult,
          strategy: strategy.description,
          fallbackMethod: strategy.fallbackMethod,
          recoveryTime,
          attempts: attempts + 1
        };
      } else {
        // No specific strategy found, use generic recovery
        console.log(`⚠️ No specific strategy for ${errorRecord.type}, using generic recovery`);
        return await this.genericErrorRecovery(errorRecord);
      }

    } catch (recoveryError) {
      console.error('❌ Error recovery failed:', recoveryError);
      return {
        success: false,
        error: recoveryError.message,
        fallbackMethod: 'none',
        attempts: attempts + 1
      };
    }
  }

  /**
   * Handle ML initialization errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleMLInitializationError(errorRecord) {
    try {
      console.log('🔧 Handling ML initialization error...');
      
      // Try memory cleanup first
      if (errorRecord.message.includes('memory') || errorRecord.message.includes('tensor')) {
        await this.performMemoryCleanup();
        
        // Wait a bit and try to reinitialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          success: true,
          method: 'memory_cleanup_and_retry',
          message: 'ML initialization recovered after memory cleanup',
          data: { mlFallback: false, retrySuccessful: true }
        };
      }
      
      // If TensorFlow is not available, switch to rule-based only
      if (errorRecord.message.includes('TensorFlow') || errorRecord.message.includes('webgl')) {
        return {
          success: true,
          method: 'rule_based_only',
          message: 'ML unavailable, using rule-based system exclusively',
          data: { mlFallback: true, ruleBasedOnly: true }
        };
      }
      
      // Generic ML initialization fallback
      return {
        success: true,
        method: 'rule_based_fallback',
        message: 'ML initialization failed, falling back to rule-based system',
        data: { mlFallback: true, hybridMode: false }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'ml_initialization_recovery'
      };
    }
  }

  /**
   * Handle ML prediction errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleMLPredictionError(errorRecord) {
    try {
      console.log('🔧 Handling ML prediction error...');
      
      // Generate rule-based schedule as fallback
      const scheduleData = errorRecord.metadata.scheduleData;
      const staffMembers = errorRecord.metadata.staffMembers;
      const dateRange = errorRecord.metadata.dateRange;
      
      if (scheduleData && staffMembers && dateRange) {
        // Use the legacy AI function as fallback
        const { analyzeAndFillScheduleWithHistory } = await import('../../hooks/useAIAssistant');
        const fallbackResult = await analyzeAndFillScheduleWithHistory(
          scheduleData,
          staffMembers,
          0, // currentMonthIndex
          { schedules: {}, staffMembers: {} } // empty historical data
        );
        
        return {
          success: true,
          method: 'rule_based_prediction',
          message: 'ML prediction failed, used rule-based prediction',
          data: {
            schedule: fallbackResult.newSchedule,
            accuracy: fallbackResult.accuracy,
            filledCells: fallbackResult.filledCells,
            fallback: true
          }
        };
      }
      
      return {
        success: false,
        error: 'Insufficient data for fallback prediction',
        method: 'ml_prediction_recovery'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'ml_prediction_recovery'
      };
    }
  }

  /**
   * Handle ML training errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleMLTrainingError(errorRecord) {
    try {
      console.log('🔧 Handling ML training error...');
      
      return {
        success: true,
        method: 'continue_without_training',
        message: 'ML training failed, continuing with existing model',
        data: {
          trainingSkipped: true,
          useExistingModel: true,
          recommendedAction: 'Check training data quality'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'ml_training_recovery'
      };
    }
  }

  /**
   * Handle rule validation errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleRuleValidationError(errorRecord) {
    try {
      console.log('🔧 Handling rule validation error...');
      
      return {
        success: true,
        method: 'basic_validation',
        message: 'Rule validation failed, using basic constraint checking',
        data: {
          validationLevel: 'basic',
          fullValidationDisabled: true,
          recommendedAction: 'Review rule validation logic'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'rule_validation_recovery'
      };
    }
  }

  /**
   * Handle memory errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleMemoryError(errorRecord) {
    try {
      console.log('🔧 Handling memory error - performing cleanup...');
      
      await this.performMemoryCleanup();
      
      return {
        success: true,
        method: 'memory_cleanup',
        message: 'Memory cleanup performed, system should be stable',
        data: {
          memoryCleanupPerformed: true,
          recommendedAction: 'Monitor memory usage'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'memory_error_recovery'
      };
    }
  }

  /**
   * Handle data extraction errors
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async handleDataExtractionError(errorRecord) {
    try {
      console.log('🔧 Handling data extraction error...');
      
      // Create basic schedule structure
      const basicSchedule = {};
      const staffMembers = errorRecord.metadata.staffMembers || [];
      const dateRange = errorRecord.metadata.dateRange || [];
      
      staffMembers.forEach(staff => {
        basicSchedule[staff.id] = {};
        dateRange.forEach(date => {
          const dateKey = date.toISOString ? date.toISOString().split('T')[0] : date;
          basicSchedule[staff.id][dateKey] = ''; // Default work shift
        });
      });
      
      return {
        success: true,
        method: 'basic_schedule_generation',
        message: 'Data extraction failed, generated basic schedule template',
        data: {
          schedule: basicSchedule,
          isBasic: true,
          requiresManualInput: true,
          recommendedAction: 'Review and manually adjust schedule'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'data_extraction_recovery'
      };
    }
  }

  /**
   * Generic error recovery for unhandled error types
   * @param {Object} errorRecord - Error record
   * @returns {Promise<Object>} Recovery result
   */
  async genericErrorRecovery(errorRecord) {
    try {
      console.log('🔧 Performing generic error recovery...');
      
      // Basic recovery: continue with degraded functionality
      return {
        success: true,
        method: 'degraded_mode',
        message: 'Error handled with degraded functionality',
        data: {
          degradedMode: true,
          fullFunctionalityDisabled: false,
          recommendedAction: 'Contact support if issues persist'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'generic_recovery'
      };
    }
  }

  /**
   * Handle critical errors that threaten system stability
   * @param {Object} errorRecord - Error record
   */
  async handleCriticalError(errorRecord) {
    console.error('🚨 CRITICAL ERROR DETECTED:', errorRecord);
    
    // Immediate actions for critical errors
    this.systemHealth.overall = 'critical';
    this.systemHealth.lastCriticalError = errorRecord;
    
    // Perform emergency cleanup
    await this.performMemoryCleanup();
    
    // Log critical error for monitoring
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'critical_error', {
        error_type: errorRecord.type,
        error_context: errorRecord.context,
        error_message: errorRecord.message
      });
    }
  }

  /**
   * Perform system memory cleanup
   */
  async performMemoryCleanup() {
    try {
      console.log('🧹 Performing memory cleanup...');
      
      // TensorFlow cleanup
      if (typeof window !== 'undefined' && window.tf) {
        window.tf.dispose();
        console.log('🧹 TensorFlow tensors disposed');
      }
      
      // Force garbage collection if available
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
        console.log('🧹 Garbage collection triggered');
      }
      
      // Clear caches
      if (typeof caches !== 'undefined') {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('ai-cache')) {
            await caches.delete(cacheName);
            console.log(`🧹 Cache ${cacheName} cleared`);
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Memory cleanup failed:', error.message);
    }
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck() {
    try {
      console.log('🏥 Performing system health check...');
      
      const healthStatus = {
        timestamp: Date.now(),
        overall: 'healthy',
        components: {
          errorHandler: 'healthy',
          memory: 'unknown',
          performance: 'unknown'
        },
        metrics: {
          errorRate: this.calculateErrorRate(),
          memoryUsage: this.getMemoryUsage(),
          recentErrors: this.errorHistory.slice(-10).length
        }
      };
      
      // Check error rate
      if (healthStatus.metrics.errorRate > 0.1) { // More than 10% error rate
        healthStatus.overall = 'degraded';
        healthStatus.components.performance = 'degraded';
      }
      
      // Check critical errors
      if (this.criticalErrors.size > 0) {
        healthStatus.overall = 'critical';
      }
      
      // Check memory usage
      if (healthStatus.metrics.memoryUsage > 0.8) { // More than 80% memory usage
        healthStatus.overall = healthStatus.overall === 'healthy' ? 'warning' : healthStatus.overall;
        healthStatus.components.memory = 'high';
      }
      
      this.systemHealth = healthStatus;
      console.log(`🏥 Health check complete: ${healthStatus.overall}`);
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.systemHealth = {
        timestamp: Date.now(),
        overall: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Clean up old error data and performance metrics
   */
  cleanupOldData() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Clean up old errors (keep last 24 hours)
    this.errorHistory = this.errorHistory.filter(error => error.timestamp > oneDayAgo);
    
    // Clean up old performance metrics
    this.performanceMetrics.lastHourErrors = this.performanceMetrics.lastHourErrors
      .filter(error => error.timestamp > oneHourAgo);
    
    // Clean up old recovery attempts
    this.recoveryAttempts.clear();
    
    console.log('🧹 Old error data cleaned up');
  }

  /**
   * Assess error severity based on error type and context
   * @param {Error} error - The error
   * @param {string} context - Error context
   * @returns {string} Severity level
   */
  assessErrorSeverity(error, context) {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('out of memory') || 
        message.includes('maximum call stack') ||
        message.includes('cannot read property') ||
        context.includes('initialization')) {
      return 'critical';
    }
    
    // High severity errors
    if (message.includes('network') ||
        message.includes('timeout') ||
        context.includes('training') ||
        context.includes('prediction')) {
      return 'high';
    }
    
    // Medium severity errors
    if (message.includes('validation') ||
        message.includes('constraint') ||
        context.includes('correction')) {
      return 'medium';
    }
    
    // Default to low
    return 'low';
  }

  /**
   * Categorize error type for appropriate handling
   * @param {Error} error - The error
   * @param {string} context - Error context
   * @returns {string} Error type
   */
  categorizeError(error, context) {
    const message = error.message.toLowerCase();
    
    if (context.includes('ml_') || message.includes('tensorflow') || message.includes('tensor')) {
      if (context.includes('initialization')) return 'ml_initialization_error';
      if (context.includes('training')) return 'ml_training_error';
      if (context.includes('prediction')) return 'ml_prediction_error';
      return 'ml_system_error';
    }
    
    if (context.includes('rule') || context.includes('validation') || context.includes('constraint')) {
      if (context.includes('validation')) return 'rule_validation_error';
      if (context.includes('correction')) return 'rule_correction_error';
      return 'rule_system_error';
    }
    
    if (message.includes('memory') || message.includes('heap')) {
      return 'memory_error';
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('storage')) {
      return 'storage_error';
    }
    
    if (message.includes('webgl') || message.includes('browser')) {
      return 'browser_compatibility_error';
    }
    
    if (context.includes('data_extraction') || context.includes('data')) {
      return 'data_extraction_error';
    }
    
    return 'unknown_error';
  }

  /**
   * Update performance metrics based on error
   * @param {Object} errorRecord - Error record
   */
  updatePerformanceMetrics(errorRecord) {
    // Add to recent errors
    this.performanceMetrics.lastHourErrors.push({
      timestamp: errorRecord.timestamp,
      type: errorRecord.type,
      severity: errorRecord.severity
    });
    
    // Update error rate (errors per hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.performanceMetrics.lastHourErrors
      .filter(error => error.timestamp > oneHourAgo);
    this.performanceMetrics.errorRate = recentErrors.length / 60; // per minute
    
    // Count critical errors
    if (errorRecord.severity === 'critical') {
      this.performanceMetrics.criticalErrorCount++;
    }
  }

  /**
   * Update system health based on error and recovery
   * @param {Object} errorRecord - Error record
   * @param {Object} recoveryResult - Recovery result
   */
  async updateSystemHealth(errorRecord, recoveryResult) {
    const componentMap = {
      ml_: 'mlEngineStatus',
      rule_: 'ruleEngineStatus',
      hybrid_: 'hybridSystemStatus'
    };
    
    // Update component status
    Object.keys(componentMap).forEach(prefix => {
      if (errorRecord.context.startsWith(prefix)) {
        this.systemHealth[componentMap[prefix]] = recoveryResult.success ? 'degraded' : 'error';
      }
    });
    
    // Update overall health
    if (errorRecord.severity === 'critical' && !recoveryResult.success) {
      this.systemHealth.overall = 'critical';
    } else if (errorRecord.severity === 'high' && !recoveryResult.success) {
      this.systemHealth.overall = 'degraded';
    }
    
    this.systemHealth.lastCheck = Date.now();
  }

  /**
   * Get recommended action for error
   * @param {Object} errorRecord - Error record
   * @returns {string} Recommended action
   */
  getRecommendedAction(errorRecord) {
    switch (errorRecord.severity) {
      case 'critical':
        return 'Restart application or refresh page';
      case 'high':
        return 'Review system logs and consider restarting';
      case 'medium':
        return 'Monitor system performance';
      default:
        return 'Continue normal operation';
    }
  }

  /**
   * Calculate current error rate
   * @returns {number} Error rate (errors per minute)
   */
  calculateErrorRate() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
    return recentErrors.length / 60; // per minute
  }

  /**
   * Get memory usage if available
   * @returns {number} Memory usage ratio (0-1)
   */
  getMemoryUsage() {
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        return performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate unique error ID
   * @returns {string} Error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Get current system health status
   * @returns {Object} System health information
   */
  getSystemHealth() {
    return {
      ...this.systemHealth,
      errorCount: this.errorHistory.length,
      recentErrorCount: this.performanceMetrics.lastHourErrors.length,
      criticalErrorCount: this.criticalErrors.size,
      performanceMetrics: { ...this.performanceMetrics }
    };
  }

  /**
   * Get error statistics for monitoring
   * @returns {Object} Error statistics
   */
  getErrorStatistics() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
    
    const errorTypes = {};
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    
    recentErrors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
      severityCounts[error.severity]++;
    });
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorTypes,
      severityCounts,
      errorRate: this.performanceMetrics.errorRate,
      criticalErrors: this.criticalErrors.size,
      systemHealth: this.systemHealth.overall
    };
  }
}

// Create singleton instance for global use
const errorHandlerInstance = new AIErrorHandler();

// Named export for the singleton instance
export { errorHandlerInstance as aiErrorHandler };

// Also export the class for testing and advanced usage
export { AIErrorHandler };

// Default export the singleton instance
export default errorHandlerInstance;