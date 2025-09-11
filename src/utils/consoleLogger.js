/**
 * Console Logger - Captures and exports browser console logs in real-time
 * This will hook into the browser's console and save logs for analysis
 */

class ConsoleLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.isEnabled = true;
    this.originalConsole = {};

    // Store original console methods
    this.originalConsole.log = console.log;
    this.originalConsole.error = console.error;
    this.originalConsole.warn = console.warn;
    this.originalConsole.info = console.info;
    this.originalConsole.debug = console.debug;

    this.initializeLogging();
  }

  initializeLogging() {
    if (!this.isEnabled) return;

    const self = this;

    // Hook into console methods
    ["log", "error", "warn", "info", "debug"].forEach((method) => {
      console[method] = function (...args) {
        // Call original console method
        self.originalConsole[method].apply(console, args);

        // Store log entry
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: method.toUpperCase(),
          message: args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg),
            )
            .join(" "),
          stack: method === "error" ? new Error().stack : null,
        };

        self.addLog(logEntry);
      };
    });

    // Hook into window.onerror for unhandled errors
    window.addEventListener("error", (event) => {
      this.addLog({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message: `Unhandled Error: ${event.message}`,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null,
      });
    });

    // Hook into unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.addLog({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason && event.reason.stack ? event.reason.stack : null,
      });
    });

    // Only log initialization message once per session
    if (!window.consoleLoggerInitialized) {
      console.log("🔍 Console Logger initialized - capturing all console output");
      window.consoleLoggerInitialized = true;
    }
  }

  addLog(logEntry) {
    this.logs.push(logEntry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Auto-export critical errors (DISABLED to prevent runaway downloads)
    // Use exportLogs() manually or window.exportConsoleLogs() when needed
    // if (logEntry.level === "ERROR") {
    //   this.exportLogs(`error-${Date.now()}.json`);
    // }
  }

  getLogs(filterLevel = null) {
    if (!filterLevel) return this.logs;
    return this.logs.filter((log) => log.level === filterLevel.toUpperCase());
  }

  getRecentLogs(minutes = 5) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter((log) => new Date(log.timestamp) > cutoff);
  }

  exportLogs(filename = `console-logs-${Date.now()}.json`) {
    const logData = {
      exported: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs,
      summary: this.getSummary(),
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📁 Console logs exported to ${filename}`);
    return filename;
  }

  getSummary() {
    const summary = {
      total: this.logs.length,
      byLevel: {},
      recentErrors: [],
      lastExported: new Date().toISOString(),
    };

    // Count by level
    this.logs.forEach((log) => {
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
    });

    // Get recent errors (last 10 minutes)
    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
    summary.recentErrors = this.logs
      .filter(
        (log) =>
          log.level === "ERROR" && new Date(log.timestamp) > recentCutoff,
      )
      .slice(-10);

    return summary;
  }

  printSummary() {
    const summary = this.getSummary();
    console.log("📊 Console Logger Summary:");
    console.log(`   Total logs: ${summary.total}`);
    console.log("   By level:", summary.byLevel);
    console.log(`   Recent errors: ${summary.recentErrors.length}`);

    if (summary.recentErrors.length > 0) {
      console.log("   Recent error messages:");
      summary.recentErrors.forEach((error) => {
        console.log(`   - ${error.timestamp}: ${error.message}`);
      });
    }
  }

  clear() {
    this.logs = [];
    console.log("🗑️ Console logs cleared");
  }

  disable() {
    this.isEnabled = false;
    // Restore original console methods
    Object.keys(this.originalConsole).forEach((method) => {
      console[method] = this.originalConsole[method];
    });
    console.log("❌ Console Logger disabled");
  }
}

// Create global instance (singleton pattern)
if (!window.consoleLogger) {
  window.consoleLogger = new ConsoleLogger();
  
  // Add some helpful global functions
  window.exportConsoleLogs = () => window.consoleLogger.exportLogs();
  window.printLogSummary = () => window.consoleLogger.printSummary();
  window.clearConsoleLogs = () => window.consoleLogger.clear();
}

export default window.consoleLogger;
