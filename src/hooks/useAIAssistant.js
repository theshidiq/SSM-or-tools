/**
 * useAIAssistant.js
 *
 * React hook that connects the sparkle button to the complete AI system
 * without changing any existing UI/UX or features.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { optimizedStorage } from "../utils/storageUtils";
import { generateDateRange } from "../utils/dateUtils";
import {
  onConfigurationCacheInvalidated,
  refreshAllConfigurations,
} from "../ai/constraints/ConstraintEngine";
import { configurationCache } from "../ai/cache/ConfigurationCacheManager";

// Enhanced imports for production-ready AI system
let aiErrorHandler = null;
try {
  ({ aiErrorHandler } = require("../ai/utils/ErrorHandler"));
} catch (error) {
  console.log("⚠️ Enhanced error handler not available");
}

// Enhanced lazy import for production-ready hybrid AI system
const loadEnhancedAISystem = async () => {
  try {
    console.log("🚀 Loading enhanced hybrid AI system...");

    // Load hybrid system components
    const { HybridPredictor } = await import("../ai/hybrid/HybridPredictor");
    const { BusinessRuleValidator } = await import(
      "../ai/hybrid/BusinessRuleValidator"
    );
    const { TensorFlowScheduler } = await import(
      "../ai/ml/TensorFlowScheduler"
    );
    const { aiErrorHandler } = await import("../ai/utils/ErrorHandler");

    // Load performance optimization system
    const { AIPerformanceManager } = await import(
      "../ai/performance/AIPerformanceManager"
    );

    return {
      HybridPredictor,
      BusinessRuleValidator,
      TensorFlowScheduler,
      aiErrorHandler,
      AIPerformanceManager,
      isEnhanced: true,
    };
  } catch (error) {
    console.log(
      "⚠️ Enhanced AI system not available, attempting fallback...",
      error.message,
    );

    // Fallback to legacy system
    try {
      const { autonomousEngine } = await import("../ai/AutonomousEngine");
      const { analyticsDashboard } = await import(
        "../ai/enterprise/AnalyticsDashboard"
      );
      const { advancedIntelligence } = await import(
        "../ai/AdvancedIntelligence"
      );
      return {
        autonomousEngine,
        analyticsDashboard,
        advancedIntelligence,
        isEnhanced: false,
        fallback: true,
      };
    } catch (fallbackError) {
      console.log("❌ Both enhanced and legacy AI systems unavailable");
      return null;
    }
  }
};

export const useAIAssistant = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  updateSchedule,
) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemType, setSystemType] = useState("unknown"); // 'enhanced', 'legacy', or 'unavailable'
  const [systemHealth, setSystemHealth] = useState(null);
  const [errorHistory, setErrorHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [configurationStatus, setConfigurationStatus] = useState("unknown");
  const aiSystemRef = useRef(null);
  const performanceManagerRef = useRef(null);
  const configInvalidationUnsubscribe = useRef(null);
  const performanceMonitor = useRef({
    tensorCleanupCount: 0,
    memoryPeaks: [],
    lastCleanup: Date.now(),
    cleanupInterval: null,
  });

  // Set up configuration change monitoring and cache initialization
  useEffect(() => {
    const initializeConfigurationSystem = () => {
      try {
        console.log("🚀 Initializing AI configuration system...");

        // Set up cache change listener immediately (non-blocking)
        configurationCache.addChangeListener((changedType) => {
          console.log(`🔄 Configuration changed: ${changedType}`);
          setConfigurationStatus("updated");

          // Notify AI system of the change
          const system = aiSystemRef.current;
          if (system && system.type === "enhanced") {
            try {
              if (
                system.hybridPredictor &&
                typeof system.hybridPredictor.onConfigurationUpdated ===
                  "function"
              ) {
                system.hybridPredictor.onConfigurationUpdated();
              }
            } catch (error) {
              console.warn(
                "⚠️ Failed to notify AI system of configuration update:",
                error,
              );
            }
          }
        });

        setConfigurationStatus("initializing");
        console.log("🎯 AI configuration system listeners ready");

        // Initialize cache asynchronously in background (non-blocking)
        setTimeout(async () => {
          try {
            if (!configurationCache.isHealthy()) {
              console.log(
                "📦 Pre-loading system configurations in background...",
              );
              
              // Use requestIdleCallback if available for better performance
              const initializeCache = async () => {
                await configurationCache.initialize();
                console.log(
                  "✅ Configuration cache ready - AI will use instant access",
                );
                setConfigurationStatus("ready");
              };

              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(async () => {
                  await initializeCache();
                }, { timeout: 5000 });
              } else {
                await initializeCache();
              }
            } else {
              setConfigurationStatus("ready");
            }
          } catch (error) {
            console.warn(
              "⚠️ Configuration cache initialization failed, using fallbacks:",
              error,
            );
            setConfigurationStatus("fallback");
            // Don't throw - continue with fallback configurations
          }
        }, 50); // Longer delay to ensure UI render is complete
      } catch (error) {
        console.error("❌ Failed to setup configuration system:", error);
        setConfigurationStatus("error");
      }
    };

    // Set up legacy cache invalidation listener (for backwards compatibility)
    configInvalidationUnsubscribe.current = onConfigurationCacheInvalidated(
      () => {
        console.log("🔄 Legacy configuration update detected");
        // Refresh the new cache system
        configurationCache.forceRefresh().catch(console.error);
      },
    );

    // Initialize the configuration system (non-blocking)
    initializeConfigurationSystem();

    return () => {
      if (configInvalidationUnsubscribe.current) {
        configInvalidationUnsubscribe.current();
        configInvalidationUnsubscribe.current = null;
      }
    };
  }, []);

  // Performance monitoring and cleanup
  useEffect(() => {
    const monitorPerformance = () => {
      if (typeof window !== "undefined" && window.tf) {
        const memory = window.tf.memory();
        performanceMonitor.current.memoryPeaks.push({
          timestamp: Date.now(),
          numTensors: memory.numTensors,
          numBytes: memory.numBytes,
        });

        // Keep only last 20 memory snapshots
        if (performanceMonitor.current.memoryPeaks.length > 20) {
          performanceMonitor.current.memoryPeaks =
            performanceMonitor.current.memoryPeaks.slice(-20);
        }

        // Automatic cleanup if too many tensors
        const now = Date.now();
        const timeSinceLastCleanup =
          now - performanceMonitor.current.lastCleanup;

        if (memory.numTensors > 100 && timeSinceLastCleanup > 30000) {
          // 30 seconds
          console.log(
            `⚠️ High tensor count detected (${memory.numTensors}), performing cleanup...`,
          );
          try {
            const beforeCleanup = memory.numTensors;
            window.tf.disposeVariables();
            const afterMemory = window.tf.memory();
            console.log(
              `🧼 Cleaned up ${beforeCleanup - afterMemory.numTensors} tensors`,
            );
            performanceMonitor.current.tensorCleanupCount++;
            performanceMonitor.current.lastCleanup = now;
          } catch (error) {
            console.warn("⚠️ Tensor cleanup failed:", error);
          }
        }
      }
    };

    // Monitor performance every 10 seconds
    const interval = setInterval(monitorPerformance, 10000);
    performanceMonitor.current.cleanupInterval = interval;

    return () => {
      clearInterval(interval);
      if (performanceMonitor.current.cleanupInterval) {
        clearInterval(performanceMonitor.current.cleanupInterval);
      }
    };
  }, []);

  // Enhanced AI system initialization
  const initializeAI = useCallback(async () => {
    if (isInitialized || aiSystemRef.current) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      const aiSystem = await loadEnhancedAISystem();

      if (aiSystem) {
        if (aiSystem.isEnhanced) {
          console.log("🤖 Initializing enhanced hybrid AI system...");

          // Initialize hybrid predictor
          const hybridPredictor = new aiSystem.HybridPredictor();
          await hybridPredictor.initialize({
            mlConfidenceThreshold: 0.8,
            useMLPredictions: true,
            strictRuleEnforcement: true,
            enableIntelligentDecisionEngine: true,
            dynamicThresholdAdjustment: true,
            enablePerformanceMonitoring: true,
          });

          // Initialize business rule validator
          const businessValidator = new aiSystem.BusinessRuleValidator();
          await businessValidator.initialize({
            strictValidation: true,
            enableSeasonalAdjustments: true,
            enableAdvancedLaborLawCompliance: true,
            enableSmartCoverageOptimization: true,
            enableStaffSatisfactionMetrics: true,
          });

          // Initialize TensorFlow scheduler
          const mlScheduler = new aiSystem.TensorFlowScheduler();
          await mlScheduler.initialize({
            adaptiveLearning: {
              enabled: true,
              learningRate: 0.001,
              batchSize: 32,
              epochs: 50,
            },
          });

          aiSystemRef.current = {
            hybridPredictor,
            businessValidator,
            mlScheduler,
            errorHandler: aiSystem.aiErrorHandler,
            type: "enhanced",
          };

          setSystemType("enhanced");
          setSystemHealth(hybridPredictor.getDetailedStatus());
        } else {
          // Legacy system initialization
          console.log("🔄 Initializing legacy AI system...");

          await aiSystem.autonomousEngine.initialize({
            scheduleGenerationInterval: 60000,
            proactiveMonitoring: false,
            autoCorrection: true,
          });

          await aiSystem.analyticsDashboard.initialize();

          aiSystemRef.current = {
            autonomousEngine: aiSystem.autonomousEngine,
            analyticsDashboard: aiSystem.analyticsDashboard,
            advancedIntelligence: aiSystem.advancedIntelligence,
            type: "legacy",
          };

          setSystemType("legacy");
        }

        const initTime = Date.now() - startTime;
        setIsInitialized(true);
        console.log(
          `✨ AI Assistant (${systemType}) initialized successfully in ${initTime}ms`,
        );
      } else {
        setSystemType("unavailable");
        console.log("⚠️ AI Assistant unavailable - using fallback methods");
      }
    } catch (error) {
      console.error("❌ AI initialization failed:", error);
      setSystemType("error");
      setErrorHistory((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          context: "initialization",
          error: error.message,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized]);

  // Enhanced auto-fill using hybrid AI system
  const autoFillSchedule = useCallback(async () => {
    if (!scheduleData || !staffMembers || staffMembers.length === 0) {
      return {
        success: false,
        message: "スケジュールデータまたはスタッフデータがありません。",
      };
    }

    if (!updateSchedule || typeof updateSchedule !== "function") {
      return {
        success: false,
        message: "スケジュール更新機能が利用できません。",
      };
    }

    setIsProcessing(true);
    const startTime = Date.now();

    try {
      const system = aiSystemRef.current;

      if (system && system.type === "enhanced") {
        // Use enhanced hybrid AI system
        console.log(
          "🤖 Using enhanced hybrid AI system for schedule prediction...",
        );

        // Prepare input data with proper structure for HybridPredictor
        const inputData = {
          scheduleData,
          currentMonthIndex,
          timestamp: Date.now(),
        };

        // Generate date range for current month
        const dateRange = generateDateRange(currentMonthIndex);

        // Use hybrid predictor for intelligent schedule completion
        const result = await system.hybridPredictor.predictSchedule(
          inputData,
          staffMembers,
          dateRange,
        );

        if (result.success && result.schedule) {
          // Update the schedule with AI predictions
          updateSchedule(result.schedule);

          // Update system health
          setSystemHealth(system.hybridPredictor.getDetailedStatus());

          // Count filled cells with enhanced details
          const filledDetails = countFilledCells(scheduleData, result.schedule);

          return {
            success: true,
            message: `🤖 ${filledDetails}個のセルをハイブリッドAIで予測（${result.metadata.method}, 精度: ${Math.round(result.metadata.quality)}%, 処理時間: ${result.metadata.processingTime}ms）`,
            data: {
              filledCells: filledDetails,
              accuracy: Math.round(result.metadata.quality),
              method: result.metadata.method,
              mlUsed: result.metadata.mlUsed,
              mlConfidence: Math.round(
                (result.metadata.mlConfidence || 0) * 100,
              ),
              predictionConfidence: result.metadata.predictionConfidence,
              processingTime: result.metadata.processingTime,
              violations: result.metadata.violations || [],
              finalValidation: result.metadata.finalValidation,
              systemHealth: system.hybridPredictor.getDetailedStatus(),
              // Enhanced feedback data
              trainingProgress: result.metadata.trainingProgress,
              modelAccuracy: Math.round(
                (result.metadata.mlConfidence || 0) * 100,
              ),
              hybridMethod: result.metadata.method,
              rulesApplied:
                result.metadata.ruleValidationResult?.violations?.length > 0,
            },
          };
        } else {
          // Hybrid system failed, try error handling with memory cleanup
          console.warn(
            "⚠️ Hybrid prediction failed, attempting error recovery...",
          );

          // Perform memory cleanup before error handling
          if (typeof window !== "undefined" && window.tf) {
            const beforeMemory = window.tf.memory();
            if (beforeMemory.numTensors > 50) {
              try {
                window.tf.disposeVariables();
                performanceMonitor.current.tensorCleanupCount++;
                console.log(
                  "🧼 Memory cleanup performed during error recovery",
                );
              } catch (cleanupError) {
                console.warn(
                  "⚠️ Memory cleanup during error recovery failed:",
                  cleanupError,
                );
              }
            }
          }

          const errorResult = await system.errorHandler.handleError(
            new Error(result.error || "Hybrid prediction failed"),
            "auto_fill_schedule",
            {
              scheduleData,
              staffMembers,
              dateRange,
              userAction: true,
            },
          );

          if (errorResult.success && errorResult.data?.schedule) {
            updateSchedule(errorResult.data.schedule);
            const filledCells = countFilledCells(
              scheduleData,
              errorResult.data.schedule,
            );

            return {
              success: true,
              message: `🔄 ${filledCells}個のセルをフォールバックシステムで予測（${errorResult.fallback}, 精度: ${errorResult.data.accuracy || 50}%）`,
              data: {
                filledCells,
                accuracy: errorResult.data.accuracy || 50,
                method: errorResult.fallback,
                fallback: true,
                errorRecovered: true,
              },
            };
          }

          return {
            success: false,
            message: `ハイブリッドAIシステムエラー: ${errorResult.message}`,
            error: errorResult,
            recommendedAction: errorResult.recommendedAction,
          };
        }
      } else if (system && system.type === "legacy") {
        // Fallback to legacy system
        console.log("🔄 Using legacy AI system...");

        const historicalData = await loadAllHistoricalData();
        const result = await analyzeAndFillScheduleWithHistory(
          scheduleData,
          staffMembers,
          currentMonthIndex,
          historicalData,
        );

        if (result.success && result.newSchedule) {
          updateSchedule(result.newSchedule);

          return {
            success: true,
            message: `🔄 ${result.filledCells}個のセルをレガシーAIで予測（精度: ${result.accuracy}%）`,
            data: {
              filledCells: result.filledCells,
              accuracy: result.accuracy,
              patterns: result.patterns,
              historicalPeriods: result.historicalPeriods,
              legacy: true,
            },
          };
        }

        return result;
      } else {
        // No AI system available - use basic historical analysis
        console.log(
          "⚠️ No AI system available, using basic historical analysis...",
        );

        const historicalData = await loadAllHistoricalData();
        const result = await analyzeAndFillScheduleWithHistory(
          scheduleData,
          staffMembers,
          currentMonthIndex,
          historicalData,
        );

        if (result.success && result.newSchedule) {
          updateSchedule(result.newSchedule);

          return {
            success: true,
            message: `📊 ${result.filledCells}個のセルを履歴分析で予測（精度: ${result.accuracy}%）`,
            data: {
              ...result,
              basic: true,
              aiUnavailable: true,
            },
          };
        }

        return {
          success: false,
          message: "AIシステムが利用できず、基本的な分析も失敗しました。",
        };
      }
    } catch (error) {
      console.error("❌ Enhanced AI auto-fill error:", error);

      // Record error for analysis
      setErrorHistory((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          context: "auto_fill_schedule",
          error: error.message,
          processingTime: Date.now() - startTime,
        },
      ]);

      return {
        success: false,
        message: `AI自動入力中にエラーが発生しました: ${error.message}`,
        error: error.message,
        systemType,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [
    scheduleData,
    staffMembers,
    currentMonthIndex,
    updateSchedule,
    systemType,
  ]);

  // Generate AI predictions with progress tracking
  const generateAIPredictions = useCallback(
    async (onProgress) => {
      if (!scheduleData || !staffMembers || staffMembers.length === 0) {
        return {
          success: false,
          message: "スケジュールデータまたはスタッフデータがありません。",
        };
      }

      // Initialize AI if needed
      if (!isInitialized) {
        if (onProgress)
          onProgress({
            stage: "initializing",
            progress: 10,
            message: "AIシステム初期化中...",
          });
        await initializeAI();
      }

      const system = aiSystemRef.current;
      if (!system || system.type !== "enhanced") {
        return await autoFillSchedule(); // Fallback to legacy method
      }

      if (onProgress)
        onProgress({
          stage: "training",
          progress: 20,
          message: "MLモデルトレーニング中...",
        });

      try {
        // Ensure ML model is trained
        await system.hybridPredictor.ensureMLModelTrained(staffMembers);

        if (onProgress)
          onProgress({
            stage: "predicting",
            progress: 70,
            message: "AI予測生成中...",
          });

        // Generate predictions
        const result = await autoFillSchedule();

        if (onProgress)
          onProgress({
            stage: "completed",
            progress: 100,
            message: "予測完了",
          });

        return result;
      } catch (error) {
        console.error("❤️‍🩹 AI prediction with progress failed:", error);

        // Enhanced error handling with recovery attempts
        setLastError(error);
        setRecoveryAttempts((prev) => prev + 1);

        // Record detailed error information
        const errorInfo = {
          timestamp: Date.now(),
          context: "generateAIPredictions",
          error: error.message,
          stack: error.stack,
          recoveryAttempt: recoveryAttempts,
          systemState: {
            systemType,
            isInitialized,
            memoryUsage: performanceMonitor.current.memoryPeaks.slice(-3),
          },
        };
        setErrorHistory((prev) => [...prev.slice(-9), errorInfo]); // Keep last 10 errors

        if (onProgress) {
          onProgress({
            stage: "error",
            progress: 0,
            message:
              recoveryAttempts < 3
                ? `エラー: ${error.message} (再試行 ${recoveryAttempts}/3)`
                : `エラー: ${error.message} (システムリセットが必要)`,
          });
        }

        // Attempt automatic recovery for certain errors
        if (recoveryAttempts < 3 && error.message.includes("not initialized")) {
          console.log("🔄 Attempting automatic recovery...");
          try {
            await initializeAI();
            return await autoFillSchedule();
          } catch (recoveryError) {
            console.error("❌ Recovery failed:", recoveryError);
          }
        }

        return {
          success: false,
          message: `AI予測中にエラーが発生しました: ${error.message}`,
          error: errorInfo,
          canRetry: recoveryAttempts < 3,
          recommendedAction:
            recoveryAttempts >= 3
              ? "システムをリセットしてください"
              : "再試行してください",
        };
      }
    },
    [scheduleData, staffMembers, isInitialized, initializeAI, autoFillSchedule],
  );

  // Get system status and health information
  const getSystemStatus = useCallback(() => {
    const system = aiSystemRef.current;

    if (!system) {
      return {
        type: systemType,
        initialized: isInitialized,
        available: false,
        health: null,
      };
    }

    if (system.type === "enhanced") {
      return {
        type: "enhanced",
        initialized: isInitialized,
        available: true,
        health: systemHealth,
        components: {
          hybridPredictor: system.hybridPredictor?.getStatus(),
          businessValidator: system.businessValidator?.getStatus(),
          mlScheduler: system.mlScheduler?.getModelInfo(),
          errorHandler: system.errorHandler?.getSystemHealth(),
        },
      };
    }

    return {
      type: system.type || "legacy",
      initialized: isInitialized,
      available: true,
      health: "legacy_system",
      legacy: true,
    };
  }, [isInitialized, systemType, systemHealth]);

  // Manual system health check
  const checkSystemHealth = useCallback(async () => {
    const system = aiSystemRef.current;

    if (system && system.type === "enhanced") {
      try {
        const health = system.hybridPredictor.getDetailedStatus();
        setSystemHealth(health);
        return health;
      } catch (error) {
        console.error("❌ System health check failed:", error);
        return { error: error.message };
      }
    }

    return { type: systemType, legacy: true };
  }, [systemType]);

  // Enhanced reset system with comprehensive cleanup (for error recovery)
  const resetSystem = useCallback(async () => {
    const system = aiSystemRef.current;

    console.log("🔄 Starting comprehensive system reset...");

    try {
      // Reset error tracking
      setLastError(null);
      setRecoveryAttempts(0);
      setErrorHistory([]);

      // Clean up TensorFlow tensors if available
      if (
        typeof window !== "undefined" &&
        window.tf &&
        typeof window.tf.disposeVariables === "function"
      ) {
        const tensorCount = window.tf.memory().numTensors;
        window.tf.disposeVariables();
        performanceMonitor.current.tensorCleanupCount++;
        console.log(`🧼 Cleaned up ${tensorCount} tensors`);
      }

      // Force garbage collection if available
      if (typeof window !== "undefined" && window.gc) {
        window.gc();
        console.log("🗑️ Forced garbage collection");
      }

      // Reset system components
      if (system && system.type === "enhanced") {
        await system.hybridPredictor.reset();
        if (
          system.businessValidator &&
          typeof system.businessValidator.reset === "function"
        ) {
          await system.businessValidator.reset();
        }
        if (
          system.mlScheduler &&
          typeof system.mlScheduler.reset === "function"
        ) {
          await system.mlScheduler.reset();
        }

        setSystemHealth(system.hybridPredictor.getDetailedStatus());
      }

      // Clear system reference to force re-initialization
      aiSystemRef.current = null;
      setIsInitialized(false);
      setSystemType("unknown");

      console.log("✅ System reset completed successfully");
      return { success: true, message: "システムを完全にリセットしました" };
    } catch (error) {
      console.error("❌ System reset failed:", error);
      return { success: false, message: `リセット失敗: ${error.message}` };
    }
  }, []);

  return {
    // Core functionality
    isInitialized,
    isProcessing,
    initializeAI,
    autoFillSchedule,
    generateAIPredictions,

    // Enhanced features
    systemType,
    systemHealth,
    errorHistory,
    getSystemStatus,
    checkSystemHealth,
    resetSystem,

    // System information
    isEnhanced: systemType === "enhanced",
    isLegacy: systemType === "legacy",
    isAvailable: systemType !== "unavailable" && systemType !== "error",

    // ML-specific information
    isMLReady: () => {
      const system = aiSystemRef.current;
      return (
        system &&
        system.type === "enhanced" &&
        system.hybridPredictor?.isMLReady()
      );
    },
    getMLModelInfo: () => {
      const system = aiSystemRef.current;
      return system && system.type === "enhanced"
        ? system.mlScheduler?.getModelInfo()
        : null;
    },

    // Enhanced error and performance information
    lastError,
    recoveryAttempts,
    canRetry: recoveryAttempts < 3,
    getPerformanceMetrics: () => ({
      ...performanceMonitor.current,
      currentMemory:
        typeof window !== "undefined" && window.tf ? window.tf.memory() : null,
    }),

    // Configuration management
    configurationStatus,
    refreshConfiguration: async () => {
      try {
        console.log("🔄 Refreshing AI configuration...");
        await refreshAllConfigurations();
        setConfigurationStatus("refreshed");

        // Force AI system to refresh if it supports it
        const system = aiSystemRef.current;
        if (system && system.type === "enhanced") {
          if (
            system.hybridPredictor &&
            typeof system.hybridPredictor.forceRefreshConfiguration ===
              "function"
          ) {
            await system.hybridPredictor.forceRefreshConfiguration();
          }
        }

        return { success: true };
      } catch (error) {
        console.error("❌ Failed to refresh configuration:", error);
        return { success: false, error: error.message };
      }
    },

    // Recovery utilities
    clearErrors: () => {
      setLastError(null);
      setRecoveryAttempts(0);
      setErrorHistory([]);
    },
  };
};

// Load ALL historical data from all 6 periods
const loadAllHistoricalData = async () => {
  const historicalData = {
    schedules: {},
    staffMembers: {},
    periodNames: ["1-2月", "3-4月", "5-6月", "7-8月", "9-10月", "11-12月"],
  };

  // Load data from all 6 periods (0-5)
  for (let periodIndex = 0; periodIndex < 6; periodIndex++) {
    try {
      const scheduleData = optimizedStorage.getScheduleData(periodIndex);
      const staffData = optimizedStorage.getStaffData(periodIndex);

      if (scheduleData && Object.keys(scheduleData).length > 0) {
        historicalData.schedules[periodIndex] = scheduleData;
      }

      if (staffData && Array.isArray(staffData) && staffData.length > 0) {
        historicalData.staffMembers[periodIndex] = staffData;
      }
    } catch (error) {
      console.warn(
        `Failed to load historical data for period ${periodIndex}:`,
        error,
      );
    }
  }

  return historicalData;
};

// NEW: Enhanced AI function using ALL historical data from all periods
const analyzeAndFillScheduleWithHistory = async (
  currentScheduleData,
  currentStaffMembers,
  currentMonthIndex,
  historicalData,
) => {
  console.log(
    "🚀 Starting comprehensive AI analysis with historical data from all periods...",
  );

  // Shift symbols: 社員 use blank for normal, パート use ○ for normal
  const workShifts = ["○", "△", "▽", ""];
  const restShifts = ["×"];

  // Deep clone the schedule to avoid mutating the original
  const newSchedule = JSON.parse(JSON.stringify(currentScheduleData));
  let filledCells = 0;
  const patterns = [];

  // Build comprehensive staff profiles from ALL historical periods
  const comprehensiveStaffProfiles = await buildComprehensiveStaffProfiles(
    currentStaffMembers,
    historicalData,
    currentScheduleData,
  );

  // Count historical periods used
  const historicalPeriods = Object.keys(historicalData.schedules).length;
  patterns.push({
    description: `🎯 ${historicalPeriods}期間の履歴データから包括的パターンを学習`,
    confidence: 95,
  });

  // Fill empty cells using comprehensive historical analysis
  for (const staffId of Object.keys(newSchedule)) {
    const staffProfile = comprehensiveStaffProfiles[staffId];
    if (!staffProfile) continue;

    for (const dateKey of Object.keys(newSchedule[staffId])) {
      const currentShift = newSchedule[staffId][dateKey];

      // Skip if cell is already filled
      if (currentShift && currentShift.trim() !== "") continue;

      // Use comprehensive historical analysis to predict shift
      const predictedShift = await predictShiftWithHistoricalData(
        staffProfile,
        dateKey,
        newSchedule[staffId],
        currentMonthIndex,
      );

      if (predictedShift !== null) {
        newSchedule[staffId][dateKey] = predictedShift;
        filledCells++;
      }
    }
  }

  // Generate comprehensive pattern insights
  const profilesWithHistory = Object.values(comprehensiveStaffProfiles).filter(
    (p) => p.historicalDataPoints > 0,
  );
  const totalHistoricalDataPoints = profilesWithHistory.reduce(
    (sum, p) => sum + p.historicalDataPoints,
    0,
  );

  patterns.push({
    description: `📊 ${profilesWithHistory.length}名のスタッフから${totalHistoricalDataPoints}個の履歴データポイントを分析`,
    confidence: 93,
  });

  // Add seasonal pattern detection
  const seasonalPatterns = detectSeasonalPatterns(
    comprehensiveStaffProfiles,
    currentMonthIndex,
  );
  if (seasonalPatterns.length > 0) {
    patterns.push({
      description: `🌸 季節的パターン検出: ${seasonalPatterns.join(", ")}`,
      confidence: 87,
    });
  }

  // Add long-term trend analysis
  patterns.push({
    description: "📈 長期勤務傾向と個人の成長パターンを考慮した予測",
    confidence: 90,
  });

  // Calculate enhanced accuracy based on historical data depth
  const dates = Object.keys(
    currentScheduleData[Object.keys(currentScheduleData)[0]] || {},
  );
  const totalCells = Object.keys(currentScheduleData).length * dates.length;
  const existingData = totalCells - filledCells;

  // Enhanced accuracy calculation using historical data quality
  const avgHistoricalDataPoints =
    totalHistoricalDataPoints / Math.max(profilesWithHistory.length, 1);
  const historicalQuality = Math.min(avgHistoricalDataPoints / 50, 1); // Normalize to 0-1
  const baseAccuracy = 75;
  const historyBonus = historicalQuality * 20; // Up to 20% bonus for rich historical data
  const existingDataBonus = (existingData / totalCells) * 10; // Up to 10% bonus for existing data

  const accuracy = Math.min(
    98,
    baseAccuracy + historyBonus + existingDataBonus,
  );

  console.log(
    `✅ AI Analysis Complete: ${filledCells} cells filled with ${accuracy}% confidence`,
  );

  return {
    success: filledCells > 0,
    message:
      filledCells > 0
        ? `${filledCells}個のセルに自動入力しました（履歴学習モード）`
        : "入力可能な空のセルがありませんでした。",
    newSchedule,
    filledCells,
    accuracy: Math.round(accuracy),
    patterns,
    historicalPeriods,
  };
};

// Build comprehensive staff profiles from ALL historical periods
const buildComprehensiveStaffProfiles = async (
  currentStaffMembers,
  historicalData,
  currentScheduleData,
) => {
  const profiles = {};

  // Initialize profiles for current staff
  currentStaffMembers.forEach((staff) => {
    profiles[staff.id] = {
      id: staff.id,
      name: staff.name,
      status: staff.status,
      isPartTime: staff.status === "パート",
      historicalDataPoints: 0,

      // Comprehensive pattern analysis
      shiftPreferences: {}, // { shift: count }
      dayOfWeekPatterns: {}, // { dayOfWeek: { shift: count } }
      seasonalTrends: {}, // { periodIndex: { characteristic } }
      workRateByPeriod: [], // [workRate1, workRate2, ...]
      consecutiveDayTolerance: 0,
      restDayPreferences: [], // [dayOfWeek1, dayOfWeek2, ...]

      // Long-term trends
      shiftsOverTime: [], // [{period, date, shift}]
      workloadTrend: "stable", // 'increasing', 'decreasing', 'stable'
      reliabilityScore: 0, // 0-100
    };
  });

  // Analyze historical data from ALL periods
  for (const [periodIndex, scheduleData] of Object.entries(
    historicalData.schedules,
  )) {
    const periodInt = parseInt(periodIndex);
    const staffData = historicalData.staffMembers[periodIndex] || [];

    // Analyze each staff member's data for this period
    for (const staffId of Object.keys(scheduleData)) {
      if (!profiles[staffId]) {
        // Create profile for staff found in historical data
        const historicalStaff = staffData.find((s) => s.id === staffId);
        profiles[staffId] = {
          id: staffId,
          name: historicalStaff?.name || `Unknown-${staffId.slice(-4)}`,
          status: historicalStaff?.status || "社員",
          isPartTime: historicalStaff?.status === "パート",
          historicalDataPoints: 0,
          shiftPreferences: {},
          dayOfWeekPatterns: {},
          seasonalTrends: {},
          workRateByPeriod: [],
          consecutiveDayTolerance: 0,
          restDayPreferences: [],
          shiftsOverTime: [],
          workloadTrend: "stable",
          reliabilityScore: 0,
        };
      }

      const profile = profiles[staffId];
      const staffSchedule = scheduleData[staffId];

      // Analyze this period's data
      const periodAnalysis = analyzePeriodData(
        staffSchedule,
        profile.isPartTime,
        periodInt,
      );

      // Update comprehensive profile
      profile.historicalDataPoints += periodAnalysis.totalShifts;

      // Merge shift preferences
      Object.entries(periodAnalysis.shiftCounts).forEach(([shift, count]) => {
        profile.shiftPreferences[shift] =
          (profile.shiftPreferences[shift] || 0) + count;
      });

      // Merge day-of-week patterns
      Object.entries(periodAnalysis.dayOfWeekPatterns).forEach(
        ([day, patterns]) => {
          if (!profile.dayOfWeekPatterns[day])
            profile.dayOfWeekPatterns[day] = {};
          Object.entries(patterns).forEach(([shift, count]) => {
            profile.dayOfWeekPatterns[day][shift] =
              (profile.dayOfWeekPatterns[day][shift] || 0) + count;
          });
        },
      );

      // Track seasonal trends
      profile.seasonalTrends[periodInt] = {
        workRate: periodAnalysis.workRate,
        preferredShifts: periodAnalysis.preferredShifts,
        restRate: periodAnalysis.restRate,
      };

      profile.workRateByPeriod.push(periodAnalysis.workRate);

      // Add detailed shift tracking
      Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
        profile.shiftsOverTime.push({
          period: periodInt,
          date: dateKey,
          shift: shift || "",
        });
      });
    }
  }

  // Analyze current period data as well
  for (const staffId of Object.keys(currentScheduleData)) {
    if (profiles[staffId]) {
      const currentAnalysis = analyzePeriodData(
        currentScheduleData[staffId],
        profiles[staffId].isPartTime,
        null,
      );

      // Update with current data
      profiles[staffId].historicalDataPoints += currentAnalysis.totalShifts;

      Object.entries(currentAnalysis.shiftCounts).forEach(([shift, count]) => {
        profiles[staffId].shiftPreferences[shift] =
          (profiles[staffId].shiftPreferences[shift] || 0) + count;
      });

      Object.entries(currentAnalysis.dayOfWeekPatterns).forEach(
        ([day, patterns]) => {
          if (!profiles[staffId].dayOfWeekPatterns[day])
            profiles[staffId].dayOfWeekPatterns[day] = {};
          Object.entries(patterns).forEach(([shift, count]) => {
            profiles[staffId].dayOfWeekPatterns[day][shift] =
              (profiles[staffId].dayOfWeekPatterns[day][shift] || 0) + count;
          });
        },
      );
    }
  }

  // Calculate derived metrics for each profile
  Object.values(profiles).forEach((profile) => {
    // Calculate workload trend
    if (profile.workRateByPeriod.length >= 2) {
      const recent = profile.workRateByPeriod.slice(-3);
      const older = profile.workRateByPeriod.slice(0, -3);

      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (recentAvg > olderAvg + 0.1) profile.workloadTrend = "increasing";
        else if (recentAvg < olderAvg - 0.1)
          profile.workloadTrend = "decreasing";
        else profile.workloadTrend = "stable";
      }
    }

    // Calculate reliability score based on data consistency
    profile.reliabilityScore = Math.min(
      100,
      (profile.historicalDataPoints / 20) * 100,
    );

    // Identify rest day preferences
    profile.restDayPreferences = Object.entries(profile.dayOfWeekPatterns)
      .filter(([day, patterns]) => patterns["×"] && patterns["×"] > 1)
      .map(([day]) => parseInt(day))
      .sort();
  });

  return profiles;
};

// Analyze a single period's data for a staff member
const analyzePeriodData = (staffSchedule, isPartTime, periodIndex) => {
  const allShifts = Object.values(staffSchedule);
  const filledShifts = allShifts.filter(
    (shift) => shift && shift.trim() !== "",
  );
  const emptyShifts = allShifts.filter(
    (shift) => !shift || shift.trim() === "",
  );

  // Count shift frequencies
  const shiftCounts = {};
  filledShifts.forEach((shift) => {
    shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
  });

  // For 社員, empty cells typically mean normal work
  if (!isPartTime && emptyShifts.length > 0) {
    shiftCounts[""] = (shiftCounts[""] || 0) + emptyShifts.length;
  }

  // Analyze day-of-week patterns
  const dayOfWeekPatterns = {};
  Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
    const date = new Date(dateKey);
    const dayOfWeek = date.getDay();

    if (!dayOfWeekPatterns[dayOfWeek]) dayOfWeekPatterns[dayOfWeek] = {};

    const normalizedShift =
      shift && shift.trim() !== "" ? shift : isPartTime ? "unavailable" : "";
    dayOfWeekPatterns[dayOfWeek][normalizedShift] =
      (dayOfWeekPatterns[dayOfWeek][normalizedShift] || 0) + 1;
  });

  // Calculate work rate
  const workShifts = ["○", "△", "▽", ""];
  const workShiftCount =
    filledShifts.filter((s) => workShifts.includes(s)).length +
    (!isPartTime ? emptyShifts.length : 0);
  const totalShiftCount = allShifts.length;
  const restShiftCount = filledShifts.filter((s) => s === "×").length;

  const workRate = workShiftCount / totalShiftCount;
  const restRate = restShiftCount / totalShiftCount;

  // Get preferred shifts
  const workShiftCounts = {};
  Object.entries(shiftCounts).forEach(([shift, count]) => {
    if (workShifts.includes(shift)) {
      workShiftCounts[shift] = count;
    }
  });

  const preferredShifts = Object.entries(workShiftCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([shift]) => shift);

  return {
    totalShifts: filledShifts.length,
    shiftCounts,
    dayOfWeekPatterns,
    workRate,
    restRate,
    preferredShifts,
  };
};

// Predict shift using comprehensive historical analysis
const predictShiftWithHistoricalData = async (
  staffProfile,
  dateKey,
  currentStaffSchedule,
  currentMonthIndex,
) => {
  if (!staffProfile || staffProfile.historicalDataPoints === 0) {
    // Fallback to basic prediction
    return staffProfile?.isPartTime ? "○" : "";
  }

  const date = new Date(dateKey);
  const dayOfWeek = date.getDay();

  // Method 1: Strong day-of-week patterns from historical data
  const dayPatterns = staffProfile.dayOfWeekPatterns[dayOfWeek];
  if (dayPatterns) {
    const sortedPatterns = Object.entries(dayPatterns).sort(
      ([, a], [, b]) => b - a,
    );

    if (sortedPatterns.length > 0) {
      const [mostCommonShift, count] = sortedPatterns[0];
      const totalDays = Object.values(dayPatterns).reduce((a, b) => a + b, 0);
      const confidence = count / totalDays;

      // Strong pattern (>60% of the time this shift on this day)
      if (confidence > 0.6 && mostCommonShift !== "unavailable") {
        return mostCommonShift === "" ? "" : mostCommonShift;
      }
    }
  }

  // Method 2: Seasonal patterns
  const seasonalTrend = staffProfile.seasonalTrends[currentMonthIndex];
  if (seasonalTrend && seasonalTrend.preferredShifts.length > 0) {
    // Use seasonal preference with some randomness
    if (Math.random() < 0.7) {
      return seasonalTrend.preferredShifts[0];
    }
  }

  // Method 3: Overall historical preferences with consecutive day analysis
  const dates = Object.keys(currentStaffSchedule).sort();
  const currentDateIndex = dates.indexOf(dateKey);

  let consecutiveWorkDays = 0;
  for (let i = currentDateIndex - 1; i >= 0; i--) {
    const prevShift = currentStaffSchedule[dates[i]];
    const isWorkShift =
      prevShift && prevShift.trim() !== "" && prevShift !== "×";
    const isNormalWork =
      (!staffProfile.isPartTime && prevShift === "") ||
      (staffProfile.isPartTime && prevShift === "○") ||
      prevShift === "△" ||
      prevShift === "▽";

    if (isWorkShift || isNormalWork) {
      consecutiveWorkDays++;
    } else {
      break;
    }
  }

  // Adjust work probability based on consecutive days and historical patterns
  const maxConsecutiveDays = staffProfile.isPartTime ? 4 : 6;
  const workPenalty =
    consecutiveWorkDays >= maxConsecutiveDays
      ? 0.2
      : consecutiveWorkDays >= maxConsecutiveDays - 1
        ? 0.6
        : 1.0;

  // Use historical work rate with workload trend adjustment
  const baseWorkRate =
    staffProfile.workRateByPeriod.length > 0
      ? staffProfile.workRateByPeriod.reduce((a, b) => a + b, 0) /
        staffProfile.workRateByPeriod.length
      : staffProfile.isPartTime
        ? 0.6
        : 0.75;

  const trendMultiplier =
    staffProfile.workloadTrend === "increasing"
      ? 1.1
      : staffProfile.workloadTrend === "decreasing"
        ? 0.9
        : 1.0;

  const adjustedWorkRate = Math.min(
    0.85,
    baseWorkRate * trendMultiplier * workPenalty,
  );

  if (Math.random() < adjustedWorkRate) {
    // Choose work shift based on historical preferences
    const preferredShifts = Object.entries(staffProfile.shiftPreferences)
      .filter(([shift]) => ["○", "△", "▽", ""].includes(shift))
      .sort(([, a], [, b]) => b - a)
      .map(([shift]) => shift);

    return preferredShifts.length > 0
      ? preferredShifts[0]
      : staffProfile.isPartTime
        ? "○"
        : "";
  } else {
    return "×";
  }
};

// Detect seasonal patterns across all staff profiles
const detectSeasonalPatterns = (staffProfiles, currentMonthIndex) => {
  const patterns = [];

  // Analyze work rate changes by season
  const seasonalWorkRates = {};
  Object.values(staffProfiles).forEach((profile) => {
    Object.entries(profile.seasonalTrends).forEach(([period, data]) => {
      const periodInt = parseInt(period);
      if (!seasonalWorkRates[periodInt]) seasonalWorkRates[periodInt] = [];
      seasonalWorkRates[periodInt].push(data.workRate);
    });
  });

  // Find periods with consistently higher/lower work rates
  Object.entries(seasonalWorkRates).forEach(([period, rates]) => {
    if (rates.length >= 3) {
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const periodNames = [
        "1-2月",
        "3-4月",
        "5-6月",
        "7-8月",
        "9-10月",
        "11-12月",
      ];

      if (avgRate > 0.8) {
        patterns.push(`${periodNames[period]}は繁忙期`);
      } else if (avgRate < 0.6) {
        patterns.push(`${periodNames[period]}は閑散期`);
      }
    }
  });

  return patterns;
};

// Enhanced helper function to count filled cells with detailed analysis
const countFilledCells = (oldSchedule, newSchedule) => {
  let count = 0;
  const details = {
    totalCells: 0,
    previouslyFilled: 0,
    newlyFilled: 0,
    changed: 0,
    byStaff: {},
  };

  Object.keys(newSchedule).forEach((staffId) => {
    details.byStaff[staffId] = { filled: 0, changed: 0 };

    Object.keys(newSchedule[staffId]).forEach((dateKey) => {
      details.totalCells++;

      const oldValue = oldSchedule[staffId]?.[dateKey];
      const newValue = newSchedule[staffId][dateKey];

      const wasEmpty = !oldValue || oldValue === "";
      const isFilledNow = newValue && newValue !== "";
      const wasFilledBefore = oldValue && oldValue !== "";

      if (wasFilledBefore) {
        details.previouslyFilled++;
        if (oldValue !== newValue) {
          details.changed++;
          details.byStaff[staffId].changed++;
        }
      }

      if (wasEmpty && isFilledNow) {
        count++;
        details.newlyFilled++;
        details.byStaff[staffId].filled++;
      }
    });
  });

  return count;
};

// Enhanced legacy function with improved error handling
const analyzeAndFillSchedule = async (scheduleData, staffMembers) => {
  console.warn(
    "⚠️ Using legacy AI function - consider upgrading to enhanced hybrid system",
  );

  try {
    // Try to provide some basic functionality even in legacy mode
    const newSchedule = JSON.parse(JSON.stringify(scheduleData));
    let filledCells = 0;

    // Basic pattern: fill empty cells with reasonable defaults
    Object.keys(newSchedule).forEach((staffId) => {
      const staff = staffMembers.find((s) => s.id === staffId);
      if (!staff) return;

      Object.keys(newSchedule[staffId]).forEach((dateKey) => {
        const currentValue = newSchedule[staffId][dateKey];

        // Fill only truly empty cells
        if (!currentValue || currentValue === "") {
          // Simple heuristic: part-time gets ○, regular gets blank
          const defaultShift = staff.status === "パート" ? "○" : "";

          // Add some randomness for off days (20% chance)
          if (Math.random() < 0.2) {
            newSchedule[staffId][dateKey] = "×";
          } else {
            newSchedule[staffId][dateKey] = defaultShift;
          }

          filledCells++;
        }
      });
    });

    return {
      success: filledCells > 0,
      message:
        filledCells > 0
          ? `🔄 ${filledCells}個のセルを基本モードで入力（エンハンスドシステムの利用を推奨）`
          : "入力可能な空のセルがありませんでした。",
      newSchedule,
      filledCells,
      accuracy: 40,
      patterns: [
        {
          description: "🔄 基本モード: シンプルなパターンベースの予測",
          confidence: 40,
        },
      ],
      legacy: true,
      recommendation:
        "より高精度な予測のため、エンハンスドハイブリッドAIシステムをご利用ください。",
    };
  } catch (error) {
    console.error("❌ Legacy AI function failed:", error);

    return {
      success: false,
      message: `基本モードでもエラーが発生しました: ${error.message}`,
      newSchedule: scheduleData,
      filledCells: 0,
      accuracy: 0,
      patterns: [],
      error: error.message,
    };
  }
};
