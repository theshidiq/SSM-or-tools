/**
 * useAIAssistantDebug.js
 *
 * Debug version of useAIAssistant with comprehensive logging to identify where the AI gets stuck.
 * This is a temporary debugging version that will help us pinpoint the exact bottleneck.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { optimizedStorage } from "../utils/storageUtils";
import { generateDateRange } from "../utils/dateUtils";
import { aiAssistantDebugger, debugLogImport, debugLogAsync, debugLog } from "../debug/AIAssistantDebugger";

export const useAIAssistantDebug = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  updateSchedule,
) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemType, setSystemType] = useState("unknown");
  const [systemHealth, setSystemHealth] = useState(null);
  const [errorHistory, setErrorHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [configurationStatus, setConfigurationStatus] = useState("unknown");
  const [processingProgress, setProcessingProgress] = useState(null);
  const aiSystemRef = useRef(null);
  const configInvalidationUnsubscribe = useRef(null);

  // Lazy load configuration cache with debugging using proper webpack imports
  const loadConfigurationCache = async () => {
    debugLog('LOAD_CONFIG_CACHE_START', 'Starting configuration cache import');
    try {
      const module = await import(
        /* webpackChunkName: "configuration-cache" */ "../ai/cache/ConfigurationCacheManager"
      );
      debugLog('LOAD_CONFIG_CACHE_SUCCESS', 'Configuration cache imported successfully', {
        hasConfigurationCache: !!module.configurationCache,
        exportedKeys: Object.keys(module)
      });
      return module.configurationCache;
    } catch (error) {
      debugLog('LOAD_CONFIG_CACHE_ERROR', 'Failed to import configuration cache', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };

  // Lazy load constraint engine with debugging using proper webpack imports
  const loadConstraintEngine = async () => {
    debugLog('LOAD_CONSTRAINT_ENGINE_START', 'Starting constraint engine import');
    try {
      const module = await import(
        /* webpackChunkName: "constraint-engine" */ "../ai/constraints/ConstraintEngine"
      );
      debugLog('LOAD_CONSTRAINT_ENGINE_SUCCESS', 'Constraint engine imported successfully', {
        hasOnConfigurationCacheInvalidated: !!module.onConfigurationCacheInvalidated,
        hasRefreshAllConfigurations: !!module.refreshAllConfigurations,
        exportedKeys: Object.keys(module)
      });
      return {
        onConfigurationCacheInvalidated: module.onConfigurationCacheInvalidated,
        refreshAllConfigurations: module.refreshAllConfigurations,
      };
    } catch (error) {
      debugLog('LOAD_CONSTRAINT_ENGINE_ERROR', 'Failed to import constraint engine', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };

  // Enhanced lazy import with debugging using proper webpack imports
  const loadEnhancedAISystem = async () => {
    debugLog('LOAD_AI_SYSTEM_START', 'Starting enhanced AI system import');
    
    try {
      debugLog('LOAD_AI_SYSTEM_IMPORTS', 'Loading AI system components...');

      // Load hybrid system components with proper webpack imports and debugging
      debugLog('IMPORT_HYBRID_PREDICTOR', 'Importing HybridPredictor...');
      const { HybridPredictor } = await import(
        /* webpackChunkName: "hybrid-predictor" */ "../ai/hybrid/HybridPredictor"
      );
      
      debugLog('IMPORT_BUSINESS_RULE_VALIDATOR', 'Importing BusinessRuleValidator...');
      const { BusinessRuleValidator } = await import(
        /* webpackChunkName: "business-rule-validator" */ "../ai/hybrid/BusinessRuleValidator"
      );
      
      debugLog('IMPORT_TENSORFLOW_SCHEDULER', 'Importing TensorFlowScheduler...');
      const { TensorFlowScheduler } = await import(
        /* webpackChunkName: "tensorflow-scheduler" */ "../ai/ml/TensorFlowScheduler"
      );
      
      debugLog('IMPORT_ERROR_HANDLER', 'Importing ErrorHandler...');
      const { aiErrorHandler } = await import(
        /* webpackChunkName: "error-handler" */ "../ai/utils/ErrorHandler"
      );

      debugLog('LOAD_AI_SYSTEM_SUCCESS', 'All AI system components imported successfully');

      return {
        HybridPredictor,
        BusinessRuleValidator,
        TensorFlowScheduler,
        aiErrorHandler,
        isEnhanced: true,
      };
    } catch (error) {
      debugLog('LOAD_AI_SYSTEM_ERROR', 'Enhanced AI system import failed', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to legacy system with proper webpack imports
      try {
        debugLog('FALLBACK_TO_LEGACY', 'Attempting fallback to legacy system...');
        
        const { autonomousEngine } = await import(
          /* webpackChunkName: "autonomous-engine" */ "../ai/AutonomousEngine"
        );
        const { analyticsDashboard } = await import(
          /* webpackChunkName: "analytics-dashboard" */ "../ai/enterprise/AnalyticsDashboard"
        );
        const { advancedIntelligence } = await import(
          /* webpackChunkName: "advanced-intelligence" */ "../ai/AdvancedIntelligence"
        );
        
        debugLog('LEGACY_SYSTEM_SUCCESS', 'Legacy system imported successfully');

        return {
          autonomousEngine,
          analyticsDashboard,
          advancedIntelligence,
          isEnhanced: false,
          fallback: true,
        };
      } catch (fallbackError) {
        debugLog('LEGACY_SYSTEM_ERROR', 'Legacy system import also failed', {
          error: fallbackError.message,
          stack: fallbackError.stack
        });
        return null;
      }
    }
  };

  // Configuration system initialization with debugging
  useEffect(() => {
    const initializeConfigurationSystem = async () => {
      debugLog('CONFIG_INIT_START', 'Starting configuration system initialization');
      
      try {
        setConfigurationStatus("initializing");

        // Lazy load modules in background with debugging
        setTimeout(async () => {
          try {
            debugLog('CONFIG_MODULES_LOAD_START', 'Loading configuration modules...');
            
            const [configurationCache, constraintEngine] = await Promise.all([
              debugLogAsync('loadConfigurationCache', () => loadConfigurationCache()),
              debugLogAsync('loadConstraintEngine', () => loadConstraintEngine())
            ]);

            debugLog('CONFIG_MODULES_LOADED', 'Configuration modules loaded successfully');

            // Set up cache change listener
            debugLog('CONFIG_CHANGE_LISTENER_SETUP', 'Setting up configuration change listener');
            configurationCache.addChangeListener((changedType) => {
              debugLog('CONFIG_CHANGED', `Configuration changed: ${changedType}`);
              setConfigurationStatus("updated");

              const system = aiSystemRef.current;
              if (system && system.type === "enhanced") {
                try {
                  if (
                    system.hybridPredictor &&
                    typeof system.hybridPredictor.onConfigurationUpdated === "function"
                  ) {
                    debugLog('CONFIG_UPDATE_NOTIFY', 'Notifying AI system of configuration update');
                    system.hybridPredictor.onConfigurationUpdated();
                  }
                } catch (error) {
                  debugLog('CONFIG_UPDATE_NOTIFY_ERROR', 'Failed to notify AI system of configuration update', {
                    error: error.message
                  });
                }
              }
            });

            // Set up legacy cache invalidation listener
            debugLog('CONFIG_INVALIDATION_LISTENER_SETUP', 'Setting up legacy configuration invalidation listener');
            configInvalidationUnsubscribe.current = constraintEngine.onConfigurationCacheInvalidated(() => {
              debugLog('CONFIG_LEGACY_INVALIDATION', 'Legacy configuration update detected');
              configurationCache.forceRefresh().catch(console.error);
            });

            debugLog('CONFIG_LISTENERS_READY', 'Configuration system listeners ready');

            // Initialize cache asynchronously in background
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(
                async () => {
                  try {
                    debugLog('CONFIG_CACHE_HEALTH_CHECK', 'Checking configuration cache health');
                    if (!configurationCache.isHealthy()) {
                      debugLog('CONFIG_CACHE_INIT_START', 'Configuration cache not healthy, initializing...');
                      await debugLogAsync('configCacheInitialize', () => configurationCache.initialize());
                      debugLog('CONFIG_CACHE_INIT_SUCCESS', 'Configuration cache initialized successfully');
                    } else {
                      debugLog('CONFIG_CACHE_HEALTHY', 'Configuration cache is already healthy');
                    }
                    setConfigurationStatus("ready");
                  } catch (error) {
                    debugLog('CONFIG_CACHE_INIT_ERROR', 'Configuration cache initialization failed', {
                      error: error.message,
                      stack: error.stack
                    });
                    setConfigurationStatus("fallback");
                  }
                },
                { timeout: 5000 }
              );
            } else {
              setTimeout(async () => {
                try {
                  debugLog('CONFIG_CACHE_HEALTH_CHECK_TIMEOUT', 'Checking configuration cache health (timeout fallback)');
                  if (!configurationCache.isHealthy()) {
                    debugLog('CONFIG_CACHE_INIT_TIMEOUT_START', 'Configuration cache not healthy, initializing with timeout...');
                    await debugLogAsync('configCacheInitializeTimeout', () => configurationCache.initialize());
                    debugLog('CONFIG_CACHE_INIT_TIMEOUT_SUCCESS', 'Configuration cache initialized successfully with timeout');
                  }
                  setConfigurationStatus("ready");
                } catch (error) {
                  debugLog('CONFIG_CACHE_INIT_TIMEOUT_ERROR', 'Configuration cache initialization failed with timeout', {
                    error: error.message,
                    stack: error.stack
                  });
                  setConfigurationStatus("fallback");
                }
              }, 100);
            }
          } catch (error) {
            debugLog('CONFIG_MODULES_LOAD_ERROR', 'Failed to load configuration modules', {
              error: error.message,
              stack: error.stack
            });
            setConfigurationStatus("fallback");
          }
        }, 10);
      } catch (error) {
        debugLog('CONFIG_INIT_ERROR', 'Failed to setup configuration system', {
          error: error.message,
          stack: error.stack
        });
        setConfigurationStatus("error");
      }
    };

    initializeConfigurationSystem();

    return () => {
      if (configInvalidationUnsubscribe.current) {
        configInvalidationUnsubscribe.current();
        configInvalidationUnsubscribe.current = null;
      }
    };
  }, []);

  // Initialize AI system with comprehensive debugging
  const initializeAI = useCallback(async () => {
    if (isInitialized || aiSystemRef.current) {
      debugLog('AI_INIT_SKIP', 'AI initialization skipped - already initialized');
      return;
    }

    debugLog('AI_INIT_START', 'Starting AI system initialization');
    
    try {
      setIsProcessing(true);
      const startTime = Date.now();

      debugLog('AI_SYSTEM_LOAD_START', 'Loading enhanced AI system...');
      const aiSystem = await debugLogAsync('loadEnhancedAISystem', () => loadEnhancedAISystem());

      if (aiSystem && aiSystem.isEnhanced) {
        debugLog('AI_ENHANCED_SYSTEM_INIT', 'Initializing enhanced system components');

        // Initialize enhanced system components
        debugLog('AI_HYBRID_PREDICTOR_CREATE', 'Creating HybridPredictor instance');
        const hybridPredictor = new aiSystem.HybridPredictor();
        
        debugLog('AI_HYBRID_PREDICTOR_INIT_START', 'Initializing HybridPredictor');
        await debugLogAsync('hybridPredictorInitialize', () => 
          hybridPredictor.initialize({
            mlConfidenceThreshold: 0.8,
            useMLPredictions: true,
            strictRuleEnforcement: true,
            enablePerformanceMonitoring: true,
            allowRuleOverrides: false,
            enableIntelligentDecisionEngine: true,
            maxCorrectionAttempts: 3,
          })
        );
        debugLog('AI_HYBRID_PREDICTOR_INIT_SUCCESS', 'HybridPredictor initialized successfully');

        aiSystemRef.current = {
          hybridPredictor,
          errorHandler: aiSystem.aiErrorHandler,
          type: "enhanced",
        };

        setSystemType("enhanced");
        debugLog('AI_SYSTEM_HEALTH_CHECK', 'Getting system health status');
        setSystemHealth(hybridPredictor.getDetailedStatus());
        setIsInitialized(true);

        const initTime = Date.now() - startTime;
        debugLog('AI_ENHANCED_INIT_SUCCESS', `Enhanced AI system initialized successfully in ${initTime}ms`);
      } else if (aiSystem && aiSystem.fallback) {
        debugLog('AI_LEGACY_SYSTEM_INIT', 'Initializing legacy AI system');

        await debugLogAsync('autonomousEngineInitialize', () =>
          aiSystem.autonomousEngine.initialize({
            scheduleGenerationInterval: 60000,
            proactiveMonitoring: false,
            autoCorrection: true,
          })
        );

        aiSystemRef.current = {
          autonomousEngine: aiSystem.autonomousEngine,
          type: "legacy",
        };

        setSystemType("legacy");
        setIsInitialized(true);
        
        debugLog('AI_LEGACY_INIT_SUCCESS', 'Legacy AI system initialized successfully');
      } else {
        throw new Error("No AI system available");
      }
    } catch (error) {
      debugLog('AI_INIT_ERROR', 'AI initialization failed completely', {
        error: error.message,
        stack: error.stack
      });
      
      setSystemType("unavailable");
      setErrorHistory((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          context: "initialization",
          error: error.message,
        },
      ]);

      setIsInitialized(true); // Still mark as initialized to allow basic functionality
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Auto-fill schedule with debugging
  const autoFillSchedule = useCallback(async () => {
    debugLog('AUTO_FILL_START', 'Starting auto-fill schedule process');
    
    if (!scheduleData || !staffMembers || staffMembers.length === 0) {
      debugLog('AUTO_FILL_VALIDATION_FAIL', 'Auto-fill validation failed - missing data', {
        hasScheduleData: !!scheduleData,
        staffMembersCount: staffMembers?.length || 0
      });
      return {
        success: false,
        message: "スケジュールデータまたはスタッフデータがありません。",
      };
    }

    if (!updateSchedule || typeof updateSchedule !== "function") {
      debugLog('AUTO_FILL_UPDATE_FUNCTION_FAIL', 'Auto-fill validation failed - missing update function');
      return {
        success: false,
        message: "スケジュール更新機能が利用できません。",
      };
    }

    if (isProcessing) {
      debugLog('AUTO_FILL_PROCESSING_BLOCK', 'Auto-fill blocked - already processing');
      return {
        success: false,
        message: "他のAI処理が実行中です。少しお待ちください。",
      };
    }

    setIsProcessing(true);
    setProcessingProgress(null);
    const startTime = Date.now();

    try {
      debugLog('AUTO_FILL_DATA_PREP', 'Preparing data for processing');
      
      const dateRange = generateDateRange(currentMonthIndex);
      const processingData = {
        scheduleData,
        staffMembers,
        dateRange,
        currentMonthIndex,
        timeout: 25000,
        options: {
          useMLPredictions: true,
          strictRuleEnforcement: true,
          enablePatternRecognition: true,
          allowRuleOverrides: false,
        },
      };

      debugLog('AUTO_FILL_DATA_READY', 'Processing data prepared', {
        staffMembersCount: staffMembers.length,
        dateRangeLength: dateRange.length,
        currentMonthIndex,
        options: processingData.options
      });

      const progressCallback = (progress) => {
        debugLog('AUTO_FILL_PROGRESS', 'Processing progress update', progress);
        setProcessingProgress({
          ...progress,
          timestamp: Date.now(),
        });
      };

      let result;

      if (systemType === "enhanced" && aiSystemRef.current) {
        debugLog('AUTO_FILL_ENHANCED_START', 'Using enhanced hybrid AI system');
        result = await debugLogAsync('processWithEnhancedSystem', async () => {
          const system = aiSystemRef.current;

          debugLog('AUTO_FILL_HYBRID_PREDICTOR_CALL', 'Calling HybridPredictor.predictSchedule');
          
          return await system.hybridPredictor.predictSchedule(
            {
              scheduleData: processingData.scheduleData,
              currentMonthIndex: processingData.currentMonthIndex,
              timestamp: Date.now(),
            },
            processingData.staffMembers,
            processingData.dateRange
          );
        });
        debugLog('AUTO_FILL_ENHANCED_SUCCESS', 'Enhanced system processing completed');
      } else {
        debugLog('AUTO_FILL_FALLBACK_START', 'Using fallback processing');
        result = await debugLogAsync('processWithFallback', async () => {
          return await performEmergencyPredictionWithRules(scheduleData, staffMembers);
        });
        debugLog('AUTO_FILL_FALLBACK_SUCCESS', 'Fallback processing completed');
      }

      debugLog('AUTO_FILL_RESULT_VALIDATION', 'Validating processing result', {
        hasResult: !!result,
        resultSuccess: result?.success,
        hasSchedule: !!(result?.schedule || result?.newSchedule)
      });

      if (result && result.success && (result.schedule || result.newSchedule)) {
        const finalSchedule = result.schedule || result.newSchedule;
        debugLog('AUTO_FILL_UPDATE_SCHEDULE', 'Updating schedule with AI results');
        
        updateSchedule(finalSchedule);

        const processingTime = Date.now() - startTime;
        debugLog('AUTO_FILL_SUCCESS', `Auto-fill completed successfully in ${processingTime}ms`);

        return {
          success: true,
          message: `✅ AI処理が正常に完了しました（処理時間: ${processingTime}ms）`,
          data: {
            filledCells: result.filledCells || 0,
            accuracy: Math.round(result.accuracy || 75),
            method: result.method || systemType,
            processingTime,
          },
        };
      } else {
        debugLog('AUTO_FILL_RESULT_FAIL', 'Processing result validation failed', {
          result: result ? 'has result' : 'no result',
          success: result?.success,
          hasSchedule: !!(result?.schedule || result?.newSchedule)
        });
        
        return {
          success: false,
          message: result?.error || result?.message || "予期しないエラーが発生しました。",
          error: result?.error,
        };
      }
    } catch (error) {
      debugLog('AUTO_FILL_ERROR', 'Auto-fill process failed with error', {
        error: error.message,
        stack: error.stack,
        processingTime: Date.now() - startTime
      });

      const errorInfo = {
        timestamp: Date.now(),
        context: "auto_fill_schedule",
        error: error.message,
        processingTime: Date.now() - startTime,
        systemType,
        recoveryAttempt: recoveryAttempts,
      };

      setErrorHistory((prev) => [...prev.slice(-9), errorInfo]);
      setLastError(error);
      setRecoveryAttempts((prev) => prev + 1);

      return {
        success: false,
        message: `AI自動入力中にエラーが発生しました: ${error.message}`,
        error: error.message,
        canRetry: recoveryAttempts < 3,
      };
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
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

  // Emergency prediction with debugging
  const performEmergencyPredictionWithRules = useCallback(
    async (scheduleData, staffMembers) => {
      debugLog('EMERGENCY_PREDICTION_START', 'Starting emergency prediction with rules');

      try {
        const newSchedule = JSON.parse(JSON.stringify(scheduleData));
        let filledCells = 0;

        debugLog('EMERGENCY_PREDICTION_PROCESSING', 'Processing emergency predictions', {
          staffMembersCount: staffMembers.length,
          scheduleKeys: Object.keys(newSchedule).length
        });

        // Enhanced pattern-based filling with basic business rule compliance
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
                shift = dayOfWeek >= 1 && dayOfWeek <= 5 ? "○" : "×";
              } else {
                shift = dayOfWeek === 0 ? "△" : "";
              }

              newSchedule[staffId][dateKey] = shift;
              filledCells++;
            }
          });
        });

        debugLog('EMERGENCY_PREDICTION_SUCCESS', `Emergency prediction completed with ${filledCells} filled cells`);

        return {
          success: true,
          newSchedule,
          message: `🆘 ${filledCells}個のセルを緊急モード（基本ルール適用）で予測`,
          filledCells,
          accuracy: 70,
          method: "emergency_with_basic_rules",
        };
      } catch (error) {
        debugLog('EMERGENCY_PREDICTION_ERROR', 'Emergency prediction failed', {
          error: error.message,
          stack: error.stack
        });
        
        return {
          success: false,
          message: `緊急予測（ルール適用）も失敗しました: ${error.message}`,
          error: error.message,
        };
      }
    },
    []
  );

  // Debug-enabled functions for external use
  const startDebugging = useCallback(() => {
    aiAssistantDebugger.startTracing();
    debugLog('USER_DEBUG_START', 'User started AI assistant debugging session');
  }, []);

  const stopDebugging = useCallback(() => {
    debugLog('USER_DEBUG_END', 'User ended AI assistant debugging session');
    const report = aiAssistantDebugger.stopTracing();
    return report;
  }, []);

  const exportDebugReport = useCallback(() => {
    aiAssistantDebugger.exportReport();
  }, []);

  return {
    // Core functionality
    isInitialized,
    isProcessing,
    initializeAI,
    autoFillSchedule,
    performEmergencyPredictionWithRules,

    // System information
    systemType,
    systemHealth,
    errorHistory,
    lastError,
    recoveryAttempts,
    processingProgress,
    configurationStatus,

    // Debug functionality
    startDebugging,
    stopDebugging,
    exportDebugReport,
    debugLog: (phase, message, data) => debugLog(phase, message, data),

    // System status
    isAvailable: systemType !== "unavailable" && systemType !== "error",
    canRetry: recoveryAttempts < 3,
  };
};