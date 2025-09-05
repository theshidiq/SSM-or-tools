// Advanced logging system with structured logging, filtering, and analytics
export class AdvancedLogger {
  constructor(options = {}) {
    this.options = {
      level:
        options.level ||
        (process.env.NODE_ENV === "development" ? "debug" : "info"),
      enableConsole: options.enableConsole !== false,
      enableStorage: options.enableStorage || false,
      enableRemote: options.enableRemote || false,
      maxStorageSize: options.maxStorageSize || 1000,
      bufferSize: options.bufferSize || 100,
      flushInterval: options.flushInterval || 10000, // 10 seconds
      remoteEndpoint: options.remoteEndpoint,
      context: options.context || {},
      ...options,
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    this.buffer = [];
    this.storage = [];
    this.context = { ...this.options.context };
    this.sessionId = this.generateSessionId();
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0,
    };

    this.initializeLogger();
  }

  // Initialize logger with auto-flush and error handlers
  initializeLogger() {
    // Set up periodic buffer flush
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);

    // Handle page unload to flush remaining logs
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush(true); // Force sync flush
      });

      // Handle uncaught errors
      window.addEventListener("error", (event) => {
        this.error("Uncaught Error", {
          message: event.error?.message,
          stack: event.error?.stack,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: "window.error",
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        this.error("Unhandled Promise Rejection", {
          reason: event.reason,
          promise: event.promise,
          source: "unhandledrejection",
        });
      });
    }
  }

  // Generate unique session ID
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if log level should be processed
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.options.level];
  }

  // Create structured log entry
  createLogEntry(level, message, data = {}, metadata = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      data: this.sanitizeData(data),
      metadata: {
        sessionId: this.sessionId,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
        url: typeof window !== "undefined" ? window.location.href : "Unknown",
        context: this.context,
        ...metadata,
      },
      id: this.generateLogId(),
    };

    // Add performance timing if available
    if (performance && performance.now) {
      entry.metadata.performanceNow = performance.now();
    }

    // Add memory info if available
    if (performance && performance.memory) {
      entry.metadata.memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };
    }

    return entry;
  }

  // Generate unique log ID
  generateLogId() {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sanitize data to prevent circular references and large objects
  sanitizeData(data) {
    try {
      // Handle circular references
      const seen = new WeakSet();
      const sanitized = JSON.parse(
        JSON.stringify(data, (key, val) => {
          if (val != null && typeof val === "object") {
            if (seen.has(val)) return "[Circular]";
            seen.add(val);
          }
          return val;
        }),
      );

      // Limit object size
      const serialized = JSON.stringify(sanitized);
      if (serialized.length > 10000) {
        return {
          _truncated: true,
          _originalSize: serialized.length,
          _data: serialized.substring(0, 1000) + "...",
        };
      }

      return sanitized;
    } catch (error) {
      return {
        _error: "Failed to sanitize data",
        _originalType: typeof data,
        _message: error.message,
      };
    }
  }

  // Core logging method
  log(level, message, data = {}, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, data, metadata);

    // Update metrics
    this.metrics.totalLogs++;
    this.metrics[level + "Count"] = (this.metrics[level + "Count"] || 0) + 1;

    // Add to buffer
    this.buffer.push(entry);

    // Console logging
    if (this.options.enableConsole) {
      this.logToConsole(entry);
    }

    // Storage logging
    if (this.options.enableStorage) {
      this.addToStorage(entry);
    }

    // Auto-flush buffer if it's full
    if (this.buffer.length >= this.options.bufferSize) {
      this.flush();
    }

    return entry;
  }

  // Console logging with proper formatting
  logToConsole(entry) {
    const { level, message, data, metadata } = entry;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    const style = this.getConsoleStyle(level);
    const prefix = `%c[${timestamp}] ${level.toUpperCase()}`;

    if (
      Object.keys(data).length > 0 ||
      Object.keys(metadata.context).length > 0
    ) {
      console.groupCollapsed(prefix, style, message);
      if (Object.keys(data).length > 0) {
        console.log("Data:", data);
      }
      if (Object.keys(metadata.context).length > 0) {
        console.log("Context:", metadata.context);
      }
      if (metadata.stack) {
        console.log("Stack:", metadata.stack);
      }
      console.groupEnd();
    } else {
      console.log(prefix, style, message);
    }
  }

  // Get console styling for different log levels
  getConsoleStyle(level) {
    const styles = {
      error: "color: #DC2626; font-weight: bold;",
      warn: "color: #D97706; font-weight: bold;",
      info: "color: #2563EB; font-weight: bold;",
      debug: "color: #059669; font-weight: normal;",
      trace: "color: #6B7280; font-weight: normal;",
    };
    return styles[level] || styles.info;
  }

  // Add to local storage
  addToStorage(entry) {
    this.storage.push(entry);

    // Limit storage size
    if (this.storage.length > this.options.maxStorageSize) {
      this.storage = this.storage.slice(-this.options.maxStorageSize);
    }

    // Try to persist to localStorage
    if (typeof localStorage !== "undefined") {
      try {
        const storageKey = `advanced-logger-${this.sessionId}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            sessionId: this.sessionId,
            logs: this.storage.slice(-100), // Store only last 100 logs
            metrics: this.metrics,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        // localStorage might be full, ignore error
      }
    }
  }

  // Flush buffer to remote endpoint
  async flush(forceSync = false) {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer = [];

    if (this.options.enableRemote && this.options.remoteEndpoint) {
      try {
        const payload = {
          sessionId: this.sessionId,
          logs: logsToFlush,
          metrics: this.metrics,
          timestamp: Date.now(),
        };

        if (forceSync && navigator.sendBeacon) {
          // Use sendBeacon for synchronous sending during page unload
          navigator.sendBeacon(
            this.options.remoteEndpoint,
            JSON.stringify(payload),
          );
        } else {
          // Regular async fetch
          await fetch(this.options.remoteEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        }
      } catch (error) {
        // Put logs back in buffer on failure
        this.buffer.unshift(...logsToFlush);
        console.warn("Failed to flush logs to remote endpoint:", error);
      }
    }
  }

  // Set context information
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  // Clear context
  clearContext() {
    this.context = {};
  }

  // Convenience methods
  error(message, data = {}, metadata = {}) {
    // Automatically capture stack trace for errors
    if (!metadata.stack && Error.captureStackTrace) {
      const error = {};
      Error.captureStackTrace(error, this.error);
      metadata.stack = error.stack;
    }
    return this.log("error", message, data, metadata);
  }

  warn(message, data = {}, metadata = {}) {
    return this.log("warn", message, data, metadata);
  }

  info(message, data = {}, metadata = {}) {
    return this.log("info", message, data, metadata);
  }

  debug(message, data = {}, metadata = {}) {
    return this.log("debug", message, data, metadata);
  }

  trace(message, data = {}, metadata = {}) {
    return this.log("trace", message, data, metadata);
  }

  // Performance logging
  time(label) {
    const startTime = performance.now();
    this.debug(`Timer started: ${label}`, { startTime });

    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.debug(`Timer ended: ${label}`, {
          startTime,
          endTime,
          duration: `${duration.toFixed(2)}ms`,
        });
        return duration;
      },
    };
  }

  // Group logging
  group(label, collapsed = false) {
    if (this.options.enableConsole) {
      collapsed ? console.groupCollapsed(label) : console.group(label);
    }
    this.debug(`Group started: ${label}`);
  }

  groupEnd(label) {
    if (this.options.enableConsole) {
      console.groupEnd();
    }
    this.debug(`Group ended: ${label}`);
  }

  // Get stored logs
  getLogs(filter = {}) {
    let logs = [...this.storage];

    if (filter.level) {
      logs = logs.filter((log) => log.level === filter.level);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      logs = logs.filter((log) => new Date(log.timestamp) >= since);
    }

    if (filter.search) {
      const search = filter.search.toLowerCase();
      logs = logs.filter(
        (log) =>
          log.message.toLowerCase().includes(search) ||
          JSON.stringify(log.data).toLowerCase().includes(search),
      );
    }

    return logs;
  }

  // Get logging metrics
  getMetrics() {
    return {
      ...this.metrics,
      sessionId: this.sessionId,
      bufferSize: this.buffer.length,
      storageSize: this.storage.length,
      uptime: Date.now() - parseInt(this.sessionId.split("-")[1]),
    };
  }

  // Export logs as JSON
  exportLogs() {
    return {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      metrics: this.getMetrics(),
      logs: this.storage,
      context: this.context,
    };
  }

  // Clear all logs
  clear() {
    this.buffer = [];
    this.storage = [];
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0,
    };

    if (typeof localStorage !== "undefined") {
      const storageKey = `advanced-logger-${this.sessionId}`;
      localStorage.removeItem(storageKey);
    }
  }

  // Destroy logger
  destroy() {
    // Flush remaining logs
    this.flush(true);

    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Clear all data
    this.clear();
  }
}

// Create default logger instance
export const logger = new AdvancedLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  enableConsole: true,
  enableStorage: true,
  context: {
    application: "Shift Schedule Manager",
    version: process.env.REACT_APP_VERSION || "2.0.0",
    environment: process.env.NODE_ENV,
  },
});

// Enhanced console logger that integrates with existing code
export const consoleLogger = {
  ...logger,

  // Compatibility with existing consoleLogger
  logScheduleOperation: (operation, data) => {
    logger.info(`Schedule Operation: ${operation}`, data, {
      category: "schedule",
    });
  },

  logSupabaseOperation: (operation, success, data) => {
    const level = success ? "info" : "error";
    logger[level](
      `Supabase Operation: ${operation}`,
      { success, ...data },
      { category: "supabase" },
    );
  },

  logPerformance: (operation, duration, data) => {
    const level = duration > 100 ? "warn" : "debug";
    logger[level](
      `Performance: ${operation}`,
      { duration: `${duration}ms`, ...data },
      { category: "performance" },
    );
  },

  logUserAction: (action, data) => {
    logger.info(`User Action: ${action}`, data, { category: "user" });
  },

  logError: (error, context) => {
    logger.error(
      error.message || error,
      {
        stack: error.stack,
        name: error.name,
        ...context,
      },
      { category: "error" },
    );
  },
};

export default AdvancedLogger;
