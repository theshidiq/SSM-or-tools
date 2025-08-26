/**
 * AIAssistantDebugger.js
 * 
 * Debug tool to trace AI assistant execution and identify where it gets stuck
 */

class AIAssistantDebugger {
  constructor() {
    this.traceLog = [];
    this.timeoutHandlers = new Map();
    this.isTracing = false;
    this.startTime = null;
  }

  startTracing() {
    this.isTracing = true;
    this.startTime = Date.now();
    this.traceLog = [];
    this.log('DEBUG_START', 'AI Assistant debugging started');
  }

  stopTracing() {
    this.isTracing = false;
    const totalTime = Date.now() - this.startTime;
    this.log('DEBUG_END', `AI Assistant debugging ended (${totalTime}ms)`);
    return this.generateReport();
  }

  log(phase, message, data = null) {
    if (!this.isTracing) return;

    const timestamp = Date.now();
    const elapsed = timestamp - this.startTime;
    
    const logEntry = {
      timestamp,
      elapsed,
      phase,
      message,
      data: data ? JSON.stringify(data, null, 2) : null,
      stackTrace: this.captureStackTrace()
    };

    this.traceLog.push(logEntry);
    
    // Also log to console with clear formatting
    console.log(`🔍 [${elapsed}ms] ${phase}: ${message}`);
    if (data) {
      console.log('   Data:', data);
    }
  }

  logAsyncOperation(operationName, asyncFunction) {
    if (!this.isTracing) return asyncFunction();

    this.log('ASYNC_START', `Starting async operation: ${operationName}`);
    
    // Set up timeout detection
    const timeoutId = setTimeout(() => {
      this.log('ASYNC_TIMEOUT', `Operation ${operationName} is taking too long (>10s)`, {
        operationName,
        possibleHang: true
      });
    }, 10000);

    return asyncFunction()
      .then(result => {
        clearTimeout(timeoutId);
        this.log('ASYNC_SUCCESS', `Completed async operation: ${operationName}`);
        return result;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        this.log('ASYNC_ERROR', `Failed async operation: ${operationName}`, {
          error: error.message,
          stack: error.stack
        });
        throw error;
      });
  }

  logImportAttempt(modulePath) {
    this.log('IMPORT_START', `Attempting to import: ${modulePath}`);
    
    const importPromise = import(modulePath);
    
    const timeoutId = setTimeout(() => {
      this.log('IMPORT_TIMEOUT', `Import hanging: ${modulePath}`, {
        modulePath,
        possibleCircularDependency: true
      });
    }, 5000);

    return importPromise
      .then(module => {
        clearTimeout(timeoutId);
        this.log('IMPORT_SUCCESS', `Successfully imported: ${modulePath}`, {
          exportedKeys: Object.keys(module)
        });
        return module;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        this.log('IMPORT_ERROR', `Failed to import: ${modulePath}`, {
          error: error.message,
          stack: error.stack
        });
        throw error;
      });
  }

  logConfigurationCacheOperation(operation, details = {}) {
    this.log('CONFIG_CACHE', operation, details);
  }

  logHybridPredictorOperation(operation, details = {}) {
    this.log('HYBRID_PREDICTOR', operation, details);
  }

  logMLOperation(operation, details = {}) {
    this.log('ML_OPERATION', operation, details);
  }

  captureStackTrace() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 8) : [];
  }

  generateReport() {
    const report = {
      totalTime: Date.now() - this.startTime,
      totalLogs: this.traceLog.length,
      phases: this.analyzePhases(),
      timeouts: this.findTimeouts(),
      errors: this.findErrors(),
      possibleHangPoints: this.findPossibleHangs(),
      recommendations: this.generateRecommendations()
    };

    // Log the full report
    console.log('🔍 AI Assistant Debug Report:', report);
    
    return report;
  }

  analyzePhases() {
    const phases = {};
    
    for (let i = 0; i < this.traceLog.length; i++) {
      const log = this.traceLog[i];
      if (!phases[log.phase]) {
        phases[log.phase] = {
          count: 0,
          firstOccurrence: log.elapsed,
          lastOccurrence: log.elapsed,
          totalTime: 0
        };
      }
      
      phases[log.phase].count++;
      phases[log.phase].lastOccurrence = log.elapsed;
      
      // Calculate time spent in this phase
      if (i < this.traceLog.length - 1) {
        const nextLog = this.traceLog[i + 1];
        phases[log.phase].totalTime += (nextLog.elapsed - log.elapsed);
      }
    }
    
    return phases;
  }

  findTimeouts() {
    return this.traceLog.filter(log => 
      log.phase.includes('TIMEOUT') || 
      (log.data && JSON.parse(log.data).possibleHang)
    );
  }

  findErrors() {
    return this.traceLog.filter(log => 
      log.phase.includes('ERROR') || 
      log.message.toLowerCase().includes('error') ||
      log.message.toLowerCase().includes('failed')
    );
  }

  findPossibleHangs() {
    const hangs = [];
    
    // Look for operations that took too long
    for (let i = 0; i < this.traceLog.length - 1; i++) {
      const current = this.traceLog[i];
      const next = this.traceLog[i + 1];
      const timeDiff = next.elapsed - current.elapsed;
      
      if (timeDiff > 5000) { // More than 5 seconds between logs
        hangs.push({
          phase: current.phase,
          message: current.message,
          hangTime: timeDiff,
          possibleCause: this.diagnosePossibleCause(current, next)
        });
      }
    }
    
    return hangs;
  }

  diagnosePossibleCause(current, next) {
    if (current.phase.includes('IMPORT')) {
      return 'Dynamic import may be stuck or has circular dependencies';
    }
    if (current.phase.includes('CONFIG_CACHE')) {
      return 'Configuration cache initialization may be hanging';
    }
    if (current.phase.includes('HYBRID_PREDICTOR')) {
      return 'HybridPredictor initialization may be stuck';
    }
    if (current.phase.includes('ML_OPERATION')) {
      return 'ML model loading or training may be hanging';
    }
    if (current.phase.includes('ASYNC')) {
      return 'Async operation may be waiting for a resource or have a deadlock';
    }
    return 'Unknown cause - check for infinite loops or resource locks';
  }

  generateRecommendations() {
    const recommendations = [];
    const hangs = this.findPossibleHangs();
    const errors = this.findErrors();
    const timeouts = this.findTimeouts();

    if (hangs.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Performance hangs detected',
        description: `Found ${hangs.length} operations that took longer than 5 seconds`,
        solutions: [
          'Add timeout mechanisms to long-running operations',
          'Implement progress callbacks for user feedback',
          'Break down large operations into smaller chunks',
          'Use background workers for heavy computations'
        ]
      });
    }

    if (errors.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Errors detected in AI assistant flow',
        description: `Found ${errors.length} errors during execution`,
        solutions: [
          'Add proper error handling and fallbacks',
          'Implement graceful degradation',
          'Add retry mechanisms with exponential backoff',
          'Improve error reporting and logging'
        ]
      });
    }

    if (timeouts.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Timeout warnings detected',
        description: `Found ${timeouts.length} operations that exceeded expected time`,
        solutions: [
          'Increase timeout values for legitimate long operations',
          'Optimize slow operations',
          'Add user cancellation options',
          'Implement progressive loading'
        ]
      });
    }

    return recommendations;
  }

  exportReport() {
    const report = this.generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistant-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const aiAssistantDebugger = new AIAssistantDebugger();

// Enhanced logging functions for specific components
export const debugLogImport = (modulePath) => {
  return aiAssistantDebugger.logImportAttempt(modulePath);
};

export const debugLogAsync = (operationName, asyncFunction) => {
  return aiAssistantDebugger.logAsyncOperation(operationName, asyncFunction);
};

export const debugLog = (phase, message, data = null) => {
  aiAssistantDebugger.log(phase, message, data);
};

export default aiAssistantDebugger;