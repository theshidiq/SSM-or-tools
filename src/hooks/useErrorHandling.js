import { useState, useCallback, useRef, useEffect } from "react";
import { consoleLogger } from "../utils/advancedLogger";

// Comprehensive error handling hook with recovery strategies
export const useErrorHandling = (options = {}) => {
  const {
    enableAutoRecovery = true,
    maxRetryAttempts = 3,
    retryDelay = 1000,
    escalationThreshold = 5,
    enableErrorReporting = true,
    enableUserNotifications = true,
    fallbackStrategies = {},
    onError,
    onRecovery,
    onEscalation,
  } = options;

  const [errors, setErrors] = useState(new Map());
  const [errorHistory, setErrorHistory] = useState([]);
  const [systemHealth, setSystemHealth] = useState("healthy"); // healthy, degraded, critical
  const [recoveryAttempts, setRecoveryAttempts] = useState(new Map());

  const errorCounts = useRef(new Map());
  const retryTimeouts = useRef(new Map());

  // Error classification system
  const classifyError = useCallback(
    (error, context = {}) => {
      const errorInfo = {
        type: error.name || "UnknownError",
        message: error.message || String(error),
        stack: error.stack,
        severity: "medium",
        category: "general",
        recoverable: true,
        context: context,
        timestamp: Date.now(),
        id: generateErrorId(),
      };

      // Classify by error type
      if (error.name === "NetworkError" || error.code === "NETWORK_ERROR") {
        errorInfo.category = "network";
        errorInfo.severity = "high";
        errorInfo.recoverable = true;
      } else if (
        error.name === "ValidationError" ||
        context.type === "validation"
      ) {
        errorInfo.category = "validation";
        errorInfo.severity = "low";
        errorInfo.recoverable = false;
      } else if (
        error.name === "DatabaseError" ||
        context.type === "database"
      ) {
        errorInfo.category = "database";
        errorInfo.severity = "high";
        errorInfo.recoverable = true;
      } else if (
        error.name === "AuthenticationError" ||
        context.type === "auth"
      ) {
        errorInfo.category = "auth";
        errorInfo.severity = "critical";
        errorInfo.recoverable = true;
      } else if (
        error.name === "TypeError" ||
        error.name === "ReferenceError"
      ) {
        errorInfo.category = "runtime";
        errorInfo.severity = "high";
        errorInfo.recoverable = false;
      } else if (context.type === "user") {
        errorInfo.category = "user";
        errorInfo.severity = "low";
        errorInfo.recoverable = false;
      }

      // Adjust severity based on frequency
      const errorKey = `${errorInfo.type}-${errorInfo.message}`;
      const count = errorCounts.current.get(errorKey) || 0;
      errorCounts.current.set(errorKey, count + 1);

      if (count >= escalationThreshold) {
        errorInfo.severity = "critical";
      } else if (count >= 2) {
        errorInfo.severity = "high";
      }

      return errorInfo;
    },
    [escalationThreshold],
  );

  // Generate unique error ID
  const generateErrorId = () => {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Main error handling function
  const handleError = useCallback(
    async (error, context = {}) => {
      const errorInfo = classifyError(error, context);

      // Log the error
      consoleLogger.logError(error, {
        ...context,
        errorInfo,
        systemHealth,
      });

      // Store error
      setErrors((prev) => new Map(prev.set(errorInfo.id, errorInfo)));
      setErrorHistory((prev) => [...prev.slice(-99), errorInfo]); // Keep last 100 errors

      // Update system health
      updateSystemHealth(errorInfo);

      // Notify callbacks
      if (onError) {
        onError(errorInfo);
      }

      // Attempt recovery if enabled and error is recoverable
      if (enableAutoRecovery && errorInfo.recoverable) {
        await attemptRecovery(errorInfo, context);
      }

      // Show user notification if enabled
      if (enableUserNotifications && errorInfo.severity !== "low") {
        showUserNotification(errorInfo);
      }

      return errorInfo;
    },
    [
      classifyError,
      enableAutoRecovery,
      enableUserNotifications,
      onError,
      systemHealth,
    ],
  );

  // Recovery attempt system
  const attemptRecovery = useCallback(
    async (errorInfo, context = {}) => {
      const recoveryKey = `${errorInfo.category}-${errorInfo.type}`;
      const attempts = recoveryAttempts.get(recoveryKey) || 0;

      if (attempts >= maxRetryAttempts) {
        consoleLogger.warn("Max recovery attempts reached", {
          errorInfo,
          attempts,
        });
        escalateError(errorInfo);
        return false;
      }

      // Update attempts
      setRecoveryAttempts(
        (prev) => new Map(prev.set(recoveryKey, attempts + 1)),
      );

      try {
        // Clear existing retry timeout
        if (retryTimeouts.current.has(recoveryKey)) {
          clearTimeout(retryTimeouts.current.get(recoveryKey));
        }

        // Apply recovery strategy
        const recovered = await applyRecoveryStrategy(errorInfo, context);

        if (recovered) {
          consoleLogger.info("Error recovery successful", {
            errorInfo,
            attempts: attempts + 1,
          });

          // Clear error from active errors
          setErrors((prev) => {
            const newErrors = new Map(prev);
            newErrors.delete(errorInfo.id);
            return newErrors;
          });

          // Reset attempts on successful recovery
          setRecoveryAttempts((prev) => {
            const newAttempts = new Map(prev);
            newAttempts.delete(recoveryKey);
            return newAttempts;
          });

          if (onRecovery) {
            onRecovery(errorInfo);
          }

          return true;
        } else {
          // Schedule retry
          const delay = retryDelay * Math.pow(2, attempts); // Exponential backoff
          const timeoutId = setTimeout(() => {
            attemptRecovery(errorInfo, context);
          }, delay);

          retryTimeouts.current.set(recoveryKey, timeoutId);
          return false;
        }
      } catch (recoveryError) {
        consoleLogger.error("Recovery attempt failed", {
          originalError: errorInfo,
          recoveryError: recoveryError.message,
          attempts: attempts + 1,
        });
        return false;
      }
    },
    [maxRetryAttempts, retryDelay, onRecovery],
  );

  // Apply specific recovery strategies
  const applyRecoveryStrategy = useCallback(
    async (errorInfo, context) => {
      const { category } = errorInfo;

      // Check for custom fallback strategies
      if (fallbackStrategies[category]) {
        return await fallbackStrategies[category](errorInfo, context);
      }

      // Built-in recovery strategies
      switch (category) {
        case "network":
          return await recoverNetworkError(errorInfo, context);

        case "database":
          return await recoverDatabaseError(errorInfo, context);

        case "auth":
          return await recoverAuthError(errorInfo, context);

        default:
          consoleLogger.warn("No recovery strategy for category", { category });
          return false;
      }
    },
    [fallbackStrategies],
  );

  // Network error recovery
  const recoverNetworkError = useCallback(async (errorInfo, context) => {
    try {
      // Test connectivity
      const response = await fetch(window.location.origin, {
        method: "HEAD",
        cache: "no-cache",
      });

      if (response.ok) {
        consoleLogger.info("Network connectivity restored");

        // Retry original operation if provided
        if (context.retryOperation) {
          return await context.retryOperation();
        }

        return true;
      }
      return false;
    } catch (error) {
      consoleLogger.debug("Network still unavailable", {
        error: error.message,
      });
      return false;
    }
  }, []);

  // Database error recovery
  const recoverDatabaseError = useCallback(async (errorInfo, context) => {
    try {
      // Try to reconnect or use fallback data source
      if (context.fallbackData) {
        consoleLogger.info("Using fallback data for database error");
        return true;
      }

      // Try to reinitialize connection
      if (context.reconnect) {
        return await context.reconnect();
      }

      return false;
    } catch (error) {
      consoleLogger.debug("Database recovery failed", { error: error.message });
      return false;
    }
  }, []);

  // Authentication error recovery
  const recoverAuthError = useCallback(async (errorInfo, context) => {
    try {
      // Try to refresh authentication
      if (context.refreshAuth) {
        return await context.refreshAuth();
      }

      // Redirect to login if needed
      if (context.redirectToLogin) {
        consoleLogger.info("Redirecting to login for auth error");
        context.redirectToLogin();
        return true;
      }

      return false;
    } catch (error) {
      consoleLogger.debug("Auth recovery failed", { error: error.message });
      return false;
    }
  }, []);

  // Update system health based on error patterns
  const updateSystemHealth = useCallback(
    (errorInfo) => {
      setSystemHealth((current) => {
        const criticalErrors = Array.from(errors.values()).filter(
          (e) => e.severity === "critical",
        ).length;
        const highErrors = Array.from(errors.values()).filter(
          (e) => e.severity === "high",
        ).length;

        if (criticalErrors > 0 || errorInfo.severity === "critical") {
          return "critical";
        } else if (highErrors >= 3 || errorInfo.severity === "high") {
          return "degraded";
        } else {
          return "healthy";
        }
      });
    },
    [errors],
  );

  // Escalate error when recovery fails
  const escalateError = useCallback(
    (errorInfo) => {
      consoleLogger.error("Error escalated - manual intervention required", {
        errorInfo,
      });

      setSystemHealth("critical");

      if (onEscalation) {
        onEscalation(errorInfo);
      }

      // Could integrate with external error tracking service here
      if (enableErrorReporting && typeof window !== "undefined") {
        // Example: Send to error tracking service
        try {
          // Placeholder for error reporting service integration
          console.warn(
            "Error escalation would be reported to external service:",
            errorInfo,
          );
        } catch (reportingError) {
          consoleLogger.debug("Failed to report escalated error", {
            reportingError,
          });
        }
      }
    },
    [onEscalation, enableErrorReporting],
  );

  // Show user notification
  const showUserNotification = useCallback((errorInfo) => {
    const messages = {
      network: "ネットワーク接続に問題があります。自動的に再試行します。",
      database: "データの保存に問題があります。しばらくお待ちください。",
      auth: "認証に問題があります。ログインし直してください。",
      validation: "データの形式が正しくありません。",
      runtime: "システムエラーが発生しました。",
      general: "予期しないエラーが発生しました。",
    };

    const message = messages[errorInfo.category] || messages.general;

    // This would integrate with your notification system
    console.warn("User notification:", message, errorInfo);

    // You could dispatch a custom event that your notification component listens for
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("app-error-notification", {
          detail: { message, errorInfo },
        }),
      );
    }
  }, []);

  // Clear resolved errors
  const clearError = useCallback((errorId) => {
    setErrors((prev) => {
      const newErrors = new Map(prev);
      newErrors.delete(errorId);
      return newErrors;
    });
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors(new Map());
    errorCounts.current.clear();

    // Clear retry timeouts
    retryTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
    retryTimeouts.current.clear();

    setRecoveryAttempts(new Map());
    setSystemHealth("healthy");
  }, []);

  // Get error statistics
  const getErrorStats = useCallback(() => {
    const errorArray = Array.from(errors.values());
    const historyArray = errorHistory.slice(-100);

    return {
      activeErrors: errorArray.length,
      totalErrors: historyArray.length,
      errorsByCategory: historyArray.reduce((acc, error) => {
        acc[error.category] = (acc[error.category] || 0) + 1;
        return acc;
      }, {}),
      errorsBySeverity: errorArray.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {}),
      systemHealth,
      recoveryAttempts: Array.from(recoveryAttempts.values()).reduce(
        (a, b) => a + b,
        0,
      ),
      escalatedErrors: historyArray.filter(
        (e) =>
          errorCounts.current.get(`${e.type}-${e.message}`) >=
          escalationThreshold,
      ).length,
    };
  }, [
    errors,
    errorHistory,
    systemHealth,
    recoveryAttempts,
    escalationThreshold,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all retry timeouts
      retryTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
      retryTimeouts.current.clear();
    };
  }, []);

  // Wrapper for async operations with error handling
  const withErrorHandling = useCallback(
    (asyncOperation, context = {}) => {
      return async (...args) => {
        try {
          const result = await asyncOperation(...args);
          return { success: true, data: result };
        } catch (error) {
          const errorInfo = await handleError(error, context);
          return { success: false, error: errorInfo };
        }
      };
    },
    [handleError],
  );

  // React error boundary integration
  const errorBoundaryHandler = useCallback(
    (error, errorInfo) => {
      handleError(error, {
        type: "react-error-boundary",
        componentStack: errorInfo.componentStack,
        ...errorInfo,
      });
    },
    [handleError],
  );

  return {
    // State
    errors,
    errorHistory,
    systemHealth,
    recoveryAttempts,

    // Methods
    handleError,
    clearError,
    clearAllErrors,
    withErrorHandling,
    errorBoundaryHandler,

    // Statistics
    getErrorStats,

    // Computed values
    hasActiveErrors: errors.size > 0,
    isCritical: systemHealth === "critical",
    isDegraded: systemHealth === "degraded",
    isHealthy: systemHealth === "healthy",
  };
};

export default useErrorHandling;
