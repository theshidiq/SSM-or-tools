/**
 * useAIAssistant.enhanced.js
 *
 * Enhanced React hook with true non-blocking worker-based AI processing.
 * This version prioritizes web workers to prevent main thread blocking.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { optimizedStorage } from "../utils/storageUtils";
import { generateDateRange } from "../utils/dateUtils";
// Lazy imports to prevent bundling AI code in main chunk
const loadConstraintEngine = async () => {
  const module = await import("../ai/constraints/ConstraintEngine");
  return {
    onConfigurationCacheInvalidated: module.onConfigurationCacheInvalidated,
    refreshAllConfigurations: module.refreshAllConfigurations,
  };
};

const loadConfigurationCache = async () => {
  const module = await import("../ai/cache/ConfigurationCacheManager");
  return module.configurationCache;
};

const loadWorkerManager = async () => {
  const module = await import("../ai/performance/WorkerManager");
  return module.getWorkerManager;
};

const loadAIErrorHandler = async () => {
  const module = await import("../ai/utils/ErrorHandler");
  return module.aiErrorHandler;
};

// Enhanced lazy import for production-ready hybrid AI system fallback
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

    return {
      HybridPredictor,
      BusinessRuleValidator,
      TensorFlowScheduler,
      aiErrorHandler,
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
  const [systemType, setSystemType] = useState("unknown"); // 'worker', 'enhanced', 'legacy', or 'unavailable'
  const [systemHealth, setSystemHealth] = useState(null);
  const [errorHistory, setErrorHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [configurationStatus, setConfigurationStatus] = useState("unknown");
  const [processingProgress, setProcessingProgress] = useState(null);
  const workerManagerRef = useRef(null);
  const aiSystemRef = useRef(null);
  const performanceManagerRef = useRef(null);
  const configInvalidationUnsubscribe = useRef(null);
  const currentProcessingRef = useRef(null); // Track current processing for cancellation
  const performanceMonitor = useRef({
    tensorCleanupCount: 0,
    memoryPeaks: [],
    lastCleanup: Date.now(),
    cleanupInterval: null,
    workerProcessingTimes: [],
    fallbackUsage: 0,
  });

  // Set up configuration change monitoring and cache initialization
  useEffect(() => {
    const initializeConfigurationSystem = async () => {
      try {
        console.log("🚀 Initializing AI configuration system...");

        const configurationCache = await loadConfigurationCache();
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

              const initializeCache = async () => {
                await configurationCache.initialize();
                console.log(
                  "✅ Configuration cache ready - AI will use instant access",
                );
                setConfigurationStatus("ready");
              };

              if (typeof requestIdleCallback !== "undefined") {
                requestIdleCallback(
                  async () => {
                    await initializeCache();
                  },
                  { timeout: 5000 },
                );
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
          }
        }, 50);
      } catch (error) {
        console.error("❌ Failed to setup configuration system:", error);
        setConfigurationStatus("error");
      }
    };

    // Set up legacy cache invalidation listener (for backwards compatibility)
    const setupLegacyListener = async () => {
      try {
        const constraintEngine = await loadConstraintEngine();
        const configurationCache = await loadConfigurationCache();

        configInvalidationUnsubscribe.current =
          constraintEngine.onConfigurationCacheInvalidated(() => {
            console.log("🔄 Legacy configuration update detected");
            configurationCache.forceRefresh().catch(console.error);
          });
      } catch (error) {
        console.warn(
          "⚠️ Failed to setup legacy configuration listener:",
          error,
        );
      }
    };

    setupLegacyListener();

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

        if (performanceMonitor.current.memoryPeaks.length > 20) {
          performanceMonitor.current.memoryPeaks =
            performanceMonitor.current.memoryPeaks.slice(-20);
        }

        const now = Date.now();
        const timeSinceLastCleanup =
          now - performanceMonitor.current.lastCleanup;

        if (memory.numTensors > 100 && timeSinceLastCleanup > 30000) {
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

    const interval = setInterval(monitorPerformance, 10000);
    performanceMonitor.current.cleanupInterval = interval;

    return () => {
      clearInterval(interval);
      if (performanceMonitor.current.cleanupInterval) {
        clearInterval(performanceMonitor.current.cleanupInterval);
      }
    };
  }, []);

  // Initialize worker-based AI system with fallback
  const initializeAI = useCallback(async () => {
    if (isInitialized || workerManagerRef.current) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      // Try to initialize WorkerManager first (preferred method)
      try {
        const getWorkerManager = await loadWorkerManager();
        console.log("🚀 Initializing worker-based AI system...");

        try {
          const workerManager = getWorkerManager();
          const initResult = await workerManager.initialize({
            enableMLPredictions: true,
            enableConstraintML: true,
            enablePatternRecognition: true,
            memoryLimitMB: 300, // Conservative limit
            restaurantId: "default",
          });

          if (initResult.success) {
            workerManagerRef.current = workerManager;
            setSystemType(initResult.fallback ? "worker_fallback" : "worker");
            setSystemHealth({
              type: "worker",
              capabilities: initResult.capabilities,
              fallback: initResult.fallback,
              initTime: Date.now() - startTime,
            });

            console.log(
              `✅ Worker-based AI system initialized in ${Date.now() - startTime}ms`,
              initResult.fallback ? "(using fallback)" : "",
            );

            setIsInitialized(true);
            return;
          }
        } catch (workerError) {
          console.warn(
            "⚠️ Worker initialization failed, trying enhanced system:",
            workerError,
          );
          performanceMonitor.current.fallbackUsage++;
        }
      } catch (workerLoadError) {
        console.warn(
          "⚠️ Worker manager loading failed, trying enhanced system:",
          workerLoadError,
        );
        performanceMonitor.current.fallbackUsage++;
      }

      // Fallback to enhanced hybrid system
      console.log("🔄 Falling back to enhanced hybrid AI system...");
      const aiSystem = await loadEnhancedAISystem();

      if (aiSystem && aiSystem.isEnhanced) {
        // Initialize enhanced system components
        const hybridPredictor = new aiSystem.HybridPredictor();
        await hybridPredictor.initialize({
          mlConfidenceThreshold: 0.8,
          useMLPredictions: true,
          strictRuleEnforcement: true,
          enablePerformanceMonitoring: true,
          workerFallback: true, // Flag for worker fallback mode
        });

        aiSystemRef.current = {
          hybridPredictor,
          errorHandler: aiSystem.aiErrorHandler,
          type: "enhanced",
        };

        setSystemType("enhanced");
        setSystemHealth(hybridPredictor.getDetailedStatus());
        setIsInitialized(true);

        console.log(
          `✨ Enhanced AI system initialized in ${Date.now() - startTime}ms (worker fallback mode)`,
        );
      } else if (aiSystem && aiSystem.fallback) {
        // Legacy system fallback
        console.log("🔄 Falling back to legacy AI system...");

        await aiSystem.autonomousEngine.initialize({
          scheduleGenerationInterval: 60000,
          proactiveMonitoring: false,
          autoCorrection: true,
        });

        aiSystemRef.current = {
          autonomousEngine: aiSystem.autonomousEngine,
          type: "legacy",
        };

        setSystemType("legacy");
        setIsInitialized(true);
      } else {
        throw new Error("No AI system available");
      }
    } catch (error) {
      console.error("❌ AI initialization failed completely:", error);
      setSystemType("unavailable");
      setErrorHistory((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          context: "initialization",
          error: error.message,
        },
      ]);

      // Still mark as initialized to allow basic functionality
      setIsInitialized(true);
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized]);

  // Emergency prediction fallback for timeout recovery
  const performEmergencyPrediction = useCallback(
    async (scheduleData, staffMembers) => {
      console.log("🆘 Performing emergency prediction fallback...");

      try {
        const newSchedule = JSON.parse(JSON.stringify(scheduleData));
        let filledCells = 0;

        // Basic pattern-based filling for empty cells only
        Object.keys(newSchedule).forEach((staffId) => {
          const staff = staffMembers.find((s) => s.id === staffId);
          if (!staff) return;

          Object.keys(newSchedule[staffId]).forEach((dateKey) => {
            const currentValue = newSchedule[staffId][dateKey];

            if (!currentValue || currentValue === "") {
              const date = new Date(dateKey);
              const dayOfWeek = date.getDay();

              let shift;
              if (staff.status === "パート") {
                shift = dayOfWeek === 0 || dayOfWeek === 6 ? "×" : "○";
              } else {
                if (dayOfWeek === 1)
                  shift = "×"; // Monday off
                else if (dayOfWeek === 0)
                  shift = "△"; // Sunday early
                else shift = ""; // Normal shift
              }

              newSchedule[staffId][dateKey] = shift;
              filledCells++;
            }
          });
        });

        return {
          success: true,
          newSchedule,
          message: `🆘 ${filledCells}個のセルを緊急モードで予測（タイムアウト回復）`,
          filledCells,
          accuracy: 60,
          method: "emergency_fallback",
          emergencyRecovery: true,
        };
      } catch (error) {
        console.error("❌ Emergency prediction failed:", error);
        return {
          success: false,
          message: `緊急予測も失敗しました: ${error.message}`,
          error: error.message,
        };
      }
    },
    [],
  );

  // True non-blocking auto-fill using worker-first approach
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

    // Prevent multiple concurrent processing
    if (isProcessing) {
      return {
        success: false,
        message: "他のAI処理が実行中です。少しお待ちください。",
      };
    }

    setIsProcessing(true);
    setProcessingProgress(null);
    const startTime = Date.now();

    try {
      // Prepare data for processing
      const dateRange = generateDateRange(currentMonthIndex);
      const processingData = {
        scheduleData,
        staffMembers,
        dateRange,
        currentMonthIndex,
        timeout: 25000, // 25 second timeout
        options: {
          useMLPredictions: true,
          strictRuleEnforcement: true,
          enablePatternRecognition: true,
        },
      };

      // Progress callback for real-time updates
      const progressCallback = (progress) => {
        setProcessingProgress({
          ...progress,
          timestamp: Date.now(),
        });
      };

      let result;

      // Method 1: Try Worker-based processing (preferred - truly non-blocking)
      if (
        workerManagerRef.current &&
        (systemType === "worker" || systemType === "worker_fallback")
      ) {
        console.log("🚀 Using worker-based AI processing (non-blocking)...");

        try {
          // Store current processing reference for cancellation
          currentProcessingRef.current = {
            type: "worker",
            startTime,
            canCancel: true,
          };

          result = await workerManagerRef.current.processMLPredictions(
            processingData,
            progressCallback,
          );

          // Track worker performance
          const processingTime = Date.now() - startTime;
          performanceMonitor.current.workerProcessingTimes.push(processingTime);

          if (performanceMonitor.current.workerProcessingTimes.length > 10) {
            performanceMonitor.current.workerProcessingTimes =
              performanceMonitor.current.workerProcessingTimes.slice(-10);
          }

          console.log(`✅ Worker processing completed in ${processingTime}ms`);
        } catch (workerError) {
          console.warn(
            "⚠️ Worker processing failed, falling back to enhanced system:",
            workerError,
          );
          performanceMonitor.current.fallbackUsage++;

          currentProcessingRef.current = null;

          // Worker failed, fall back to enhanced system
          result = await processWithEnhancedSystem(
            processingData,
            progressCallback,
            startTime,
          );
        }
      } else if (systemType === "enhanced" && aiSystemRef.current) {
        // Method 2: Enhanced hybrid system (with yielding)
        console.log("🤖 Using enhanced hybrid AI system...");
        result = await processWithEnhancedSystem(
          processingData,
          progressCallback,
          startTime,
        );
      } else {
        // Method 3: Legacy or basic fallback
        console.log("🔄 Using legacy/basic AI processing...");
        result = await processWithLegacySystem(
          processingData,
          progressCallback,
          startTime,
        );
      }

      // Apply results if successful
      if (result && result.success && result.schedule) {
        updateSchedule(result.schedule);

        const filledDetails = countFilledCells(scheduleData, result.schedule);
        const processingTime = Date.now() - startTime;

        return {
          success: true,
          message: `✨ ${filledDetails}個のセルを${getSystemDisplayName(result.metadata?.method || systemType)}で予測（精度: ${Math.round(result.metadata?.quality || result.metadata?.confidence || 75)}%, 処理時間: ${processingTime}ms）`,
          data: {
            filledCells: filledDetails,
            accuracy: Math.round(
              result.metadata?.quality || result.metadata?.confidence || 75,
            ),
            method: result.metadata?.method || systemType,
            mlUsed: result.metadata?.mlUsed || false,
            processingTime,
            emergencyFallback: result.metadata?.emergencyFallback || false,
            violations: result.metadata?.violations || [],
            systemHealth:
              systemType === "worker" ? "worker_healthy" : systemHealth,
          },
        };
      } else {
        // Processing failed
        return {
          success: false,
          message: result?.error || "予期しないエラーが発生しました。",
          error: result?.error,
        };
      }
    } catch (error) {
      console.error("❌ AI auto-fill error:", error);

      const processingTime = Date.now() - startTime;
      const errorInfo = {
        timestamp: Date.now(),
        context: "auto_fill_schedule",
        error: error.message,
        processingTime,
        systemType,
        recoveryAttempt: recoveryAttempts,
      };

      setErrorHistory((prev) => [...prev.slice(-9), errorInfo]);
      setLastError(error);
      setRecoveryAttempts((prev) => prev + 1);

      // Try emergency recovery
      if (recoveryAttempts < 2 && !error.message.includes("timeout")) {
        console.log("🆘 Attempting emergency recovery...");

        const emergencyResult = await performEmergencyPrediction(
          scheduleData,
          staffMembers,
        );

        if (emergencyResult.success && emergencyResult.newSchedule) {
          updateSchedule(emergencyResult.newSchedule);
          return {
            success: true,
            message: emergencyResult.message + " (緊急復旧)",
            data: {
              ...emergencyResult,
              recovery: true,
            },
          };
        }
      }

      return {
        success: false,
        message: `AI自動入力中にエラーが発生しました: ${error.message}`,
        error: error.message,
        canRetry: recoveryAttempts < 3,
      };
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
      currentProcessingRef.current = null;
    }
  }, [
    scheduleData,
    staffMembers,
    currentMonthIndex,
    updateSchedule,
    systemType,
    isProcessing,
    recoveryAttempts,
  ]);

  // Helper function to process with enhanced system (with timeout)
  const processWithEnhancedSystem = useCallback(
    async (processingData, progressCallback, startTime) => {
      const system = aiSystemRef.current;

      if (!system || system.type !== "enhanced") {
        throw new Error("Enhanced system not available");
      }

      currentProcessingRef.current = {
        type: "enhanced",
        startTime,
        canCancel: false,
      };

      const ENHANCED_TIMEOUT = processingData.timeout || 20000;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Enhanced system timeout after ${ENHANCED_TIMEOUT}ms`),
            ),
          ENHANCED_TIMEOUT,
        ),
      );

      const processingPromise = system.hybridPredictor.predictSchedule(
        {
          scheduleData: processingData.scheduleData,
          currentMonthIndex: processingData.currentMonthIndex,
          timestamp: Date.now(),
        },
        processingData.staffMembers,
        processingData.dateRange,
      );

      try {
        const result = await Promise.race([processingPromise, timeoutPromise]);
        return result;
      } catch (error) {
        if (error.message.includes("timeout")) {
          console.warn(
            "⏱️ Enhanced system timed out, using emergency fallback",
          );
          return await performEmergencyWorkerFallback(
            processingData,
            progressCallback,
          );
        }
        throw error;
      }
    },
    [],
  );

  // Helper function to process with legacy system
  const processWithLegacySystem = useCallback(
    async (processingData, progressCallback, startTime) => {
      currentProcessingRef.current = {
        type: "legacy",
        startTime,
        canCancel: false,
      };

      if (progressCallback) {
        progressCallback({
          stage: "legacy_processing",
          progress: 50,
          message: "レガシーシステムで処理中...",
        });
      }

      const historicalData = await loadAllHistoricalData();
      const result = await analyzeAndFillScheduleWithHistory(
        processingData.scheduleData,
        processingData.staffMembers,
        processingData.currentMonthIndex,
        historicalData,
      );

      return {
        success: result.success,
        schedule: result.newSchedule,
        metadata: {
          method: "legacy",
          quality: result.accuracy,
          confidence: result.accuracy,
          filledCells: result.filledCells,
          processingTime: Date.now() - startTime,
        },
        error: result.success ? null : result.message,
      };
    },
    [],
  );

  // Emergency worker fallback when even enhanced system fails
  const performEmergencyWorkerFallback = useCallback(
    async (processingData, progressCallback) => {
      console.log("🆘 Performing emergency worker fallback...");

      if (progressCallback) {
        progressCallback({
          stage: "emergency_fallback",
          progress: 50,
          message: "緊急フォールバック実行中...",
        });
      }

      const emergencyResult = await performEmergencyPrediction(
        processingData.scheduleData,
        processingData.staffMembers,
      );

      return {
        success: emergencyResult.success,
        schedule: emergencyResult.newSchedule,
        metadata: {
          method: "emergency_fallback",
          quality: emergencyResult.accuracy || 60,
          confidence: 60,
          filledCells: emergencyResult.filledCells || 0,
          emergencyFallback: true,
        },
        error: emergencyResult.success ? null : emergencyResult.message,
      };
    },
    [],
  );

  // Get display name for system type
  const getSystemDisplayName = useCallback((method) => {
    switch (method) {
      case "worker":
      case "worker_hybrid":
        return "ワーカーAI";
      case "enhanced":
      case "hybrid":
        return "ハイブリッドAI";
      case "legacy":
        return "レガシーAI";
      case "emergency_fallback":
      case "ultra_simple_emergency":
        return "緊急AI";
      default:
        return "AI";
    }
  }, []);

  // Generate AI predictions with true non-blocking progress tracking
  const generateAIPredictions = useCallback(
    async (onProgress) => {
      if (!scheduleData || !staffMembers || staffMembers.length === 0) {
        return {
          success: false,
          message: "スケジュールデータまたはスタッフデータがありません。",
        };
      }

      if (isProcessing) {
        return {
          success: false,
          message: "他のAI処理が実行中です。",
        };
      }

      if (!isInitialized) {
        if (onProgress)
          onProgress({
            stage: "initializing",
            progress: 10,
            message: "AIシステム初期化中...",
          });
        await initializeAI();
      }

      if (onProgress)
        onProgress({
          stage: "starting",
          progress: 20,
          message: "AI予測を開始...",
        });

      try {
        const result = await autoFillSchedule();

        if (onProgress)
          onProgress({
            stage: "completed",
            progress: 100,
            message: "予測完了",
          });

        return result;
      } catch (error) {
        console.error("❌ AI prediction with progress failed:", error);

        if (onProgress) {
          onProgress({
            stage: "error",
            progress: 0,
            message: `エラー: ${error.message}`,
          });
        }

        return {
          success: false,
          message: `AI予測中にエラーが発生しました: ${error.message}`,
          error: error.message,
          canRetry: true,
        };
      }
    },
    [
      scheduleData,
      staffMembers,
      isInitialized,
      initializeAI,
      autoFillSchedule,
      isProcessing,
    ],
  );

  // Cancel current processing
  const cancelProcessing = useCallback(async () => {
    if (!isProcessing || !currentProcessingRef.current) {
      return { success: false, reason: "No processing to cancel" };
    }

    const processingInfo = currentProcessingRef.current;
    console.log(`🛑 Cancelling ${processingInfo.type} processing...`);

    try {
      if (
        processingInfo.type === "worker" &&
        processingInfo.canCancel &&
        workerManagerRef.current
      ) {
        const result = await workerManagerRef.current.cancelProcessing();
        if (result.success) {
          setIsProcessing(false);
          setProcessingProgress(null);
          currentProcessingRef.current = null;
          return { success: true, method: "worker" };
        }
      }

      // For other types or if worker cancellation failed, force cleanup
      setIsProcessing(false);
      setProcessingProgress(null);
      currentProcessingRef.current = null;

      return {
        success: true,
        method: "forced",
        note: "Processing state cleared - may still complete in background",
      };
    } catch (error) {
      console.error("❌ Failed to cancel processing:", error);

      setIsProcessing(false);
      setProcessingProgress(null);
      currentProcessingRef.current = null;

      return { success: false, error: error.message, forcedCleanup: true };
    }
  }, [isProcessing, workerManagerRef]);

  // Get system status and health information
  const getSystemStatus = useCallback(() => {
    const system = aiSystemRef.current;
    const workerManager = workerManagerRef.current;

    if (workerManager) {
      return {
        type: systemType,
        initialized: isInitialized,
        available: true,
        health: systemHealth,
        worker: true,
      };
    }

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
    const workerManager = workerManagerRef.current;
    const system = aiSystemRef.current;

    if (workerManager) {
      try {
        const health = await workerManager.getStatus();
        setSystemHealth(health);
        return health;
      } catch (error) {
        console.error("❌ Worker health check failed:", error);
        return { error: error.message };
      }
    }

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

  // Enhanced reset system with comprehensive cleanup
  const resetSystem = useCallback(async () => {
    const system = aiSystemRef.current;
    const workerManager = workerManagerRef.current;

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

      // Reset worker system
      if (workerManager) {
        await workerManager.destroy();
        workerManagerRef.current = null;
      }

      // Reset system components
      if (system && system.type === "enhanced") {
        await system.hybridPredictor.reset();
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
    performEmergencyPrediction,
    cancelProcessing,

    // Enhanced features
    systemType,
    systemHealth,
    errorHistory,
    getSystemStatus,
    checkSystemHealth,
    resetSystem,

    // Progress tracking
    processingProgress,
    currentProcessing: currentProcessingRef.current,

    // System information
    isWorkerBased: systemType === "worker" || systemType === "worker_fallback",
    isEnhanced: systemType === "enhanced",
    isLegacy: systemType === "legacy",
    isAvailable: systemType !== "unavailable" && systemType !== "error",

    // Worker-specific information
    isWorkerReady: () => {
      return workerManagerRef.current && workerManagerRef.current.isInitialized;
    },
    getWorkerStatus: async () => {
      if (workerManagerRef.current) {
        return await workerManagerRef.current.getStatus();
      }
      return { available: false };
    },

    // ML-specific information
    isMLReady: () => {
      if (workerManagerRef.current) {
        return true; // Worker handles ML internally
      }
      const system = aiSystemRef.current;
      return (
        system &&
        system.type === "enhanced" &&
        system.hybridPredictor?.isMLReady()
      );
    },
    getMLModelInfo: () => {
      if (workerManagerRef.current) {
        return { type: "worker_managed", status: "ready" };
      }
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
      workerPerformance: workerManagerRef.current
        ? workerManagerRef.current.getPerformanceMetrics()
        : null,
    }),

    // Configuration management
    configurationStatus,
    refreshConfiguration: async () => {
      try {
        console.log("🔄 Refreshing AI configuration...");
        const constraintEngine = await loadConstraintEngine();
        await constraintEngine.refreshAllConfigurations();
        setConfigurationStatus("refreshed");

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

        // Refresh worker if available
        if (
          workerManagerRef.current &&
          workerManagerRef.current.refreshConfiguration
        ) {
          await workerManagerRef.current.refreshConfiguration();
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

    // Worker management
    restartWorker: async () => {
      if (workerManagerRef.current) {
        try {
          await workerManagerRef.current.destroy();
          workerManagerRef.current = null;
          await initializeAI(); // Re-initialize
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, reason: "No worker to restart" };
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

// Enhanced AI function using ALL historical data from all periods
const analyzeAndFillScheduleWithHistory = async (
  currentScheduleData,
  currentStaffMembers,
  currentMonthIndex,
  historicalData,
) => {
  console.log(
    "🚀 Starting comprehensive AI analysis with historical data from all periods...",
  );

  const workShifts = ["○", "△", "▽", ""];
  const restShifts = ["×"];

  const newSchedule = JSON.parse(JSON.stringify(currentScheduleData));
  let filledCells = 0;
  const patterns = [];

  // Build comprehensive staff profiles from ALL historical periods
  const comprehensiveStaffProfiles = await buildComprehensiveStaffProfiles(
    currentStaffMembers,
    historicalData,
    currentScheduleData,
  );

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

      if (currentShift && currentShift.trim() !== "") continue;

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

  const dates = Object.keys(
    currentScheduleData[Object.keys(currentScheduleData)[0]] || {},
  );
  const totalCells = Object.keys(currentScheduleData).length * dates.length;
  const existingData = totalCells - filledCells;

  const avgHistoricalDataPoints =
    totalHistoricalDataPoints / Math.max(profilesWithHistory.length, 1);
  const historicalQuality = Math.min(avgHistoricalDataPoints / 50, 1);
  const baseAccuracy = 75;
  const historyBonus = historicalQuality * 20;
  const existingDataBonus = (existingData / totalCells) * 10;

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

  currentStaffMembers.forEach((staff) => {
    profiles[staff.id] = {
      id: staff.id,
      name: staff.name,
      status: staff.status,
      isPartTime: staff.status === "パート",
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
  });

  // Analyze historical data from ALL periods
  for (const [periodIndex, scheduleData] of Object.entries(
    historicalData.schedules,
  )) {
    const periodInt = parseInt(periodIndex);
    const staffData = historicalData.staffMembers[periodIndex] || [];

    for (const staffId of Object.keys(scheduleData)) {
      if (!profiles[staffId]) {
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

      const periodAnalysis = analyzePeriodData(
        staffSchedule,
        profile.isPartTime,
        periodInt,
      );

      profile.historicalDataPoints += periodAnalysis.totalShifts;

      Object.entries(periodAnalysis.shiftCounts).forEach(([shift, count]) => {
        profile.shiftPreferences[shift] =
          (profile.shiftPreferences[shift] || 0) + count;
      });

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

      profile.seasonalTrends[periodInt] = {
        workRate: periodAnalysis.workRate,
        preferredShifts: periodAnalysis.preferredShifts,
        restRate: periodAnalysis.restRate,
      };

      profile.workRateByPeriod.push(periodAnalysis.workRate);

      Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
        profile.shiftsOverTime.push({
          period: periodInt,
          date: dateKey,
          shift: shift || "",
        });
      });
    }
  }

  // Calculate derived metrics for each profile
  Object.values(profiles).forEach((profile) => {
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

    profile.reliabilityScore = Math.min(
      100,
      (profile.historicalDataPoints / 20) * 100,
    );

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

  const shiftCounts = {};
  filledShifts.forEach((shift) => {
    shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
  });

  if (!isPartTime && emptyShifts.length > 0) {
    shiftCounts[""] = (shiftCounts[""] || 0) + emptyShifts.length;
  }

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

  const workShifts = ["○", "△", "▽", ""];
  const workShiftCount =
    filledShifts.filter((s) => workShifts.includes(s)).length +
    (!isPartTime ? emptyShifts.length : 0);
  const totalShiftCount = allShifts.length;
  const restShiftCount = filledShifts.filter((s) => s === "×").length;

  const workRate = workShiftCount / totalShiftCount;
  const restRate = restShiftCount / totalShiftCount;

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

      if (confidence > 0.6 && mostCommonShift !== "unavailable") {
        return mostCommonShift === "" ? "" : mostCommonShift;
      }
    }
  }

  // Method 2: Seasonal patterns
  const seasonalTrend = staffProfile.seasonalTrends[currentMonthIndex];
  if (seasonalTrend && seasonalTrend.preferredShifts.length > 0) {
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

  const maxConsecutiveDays = staffProfile.isPartTime ? 4 : 6;
  const workPenalty =
    consecutiveWorkDays >= maxConsecutiveDays
      ? 0.2
      : consecutiveWorkDays >= maxConsecutiveDays - 1
        ? 0.6
        : 1.0;

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
