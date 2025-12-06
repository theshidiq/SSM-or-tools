/**
 * useAIAssistantLazy.js
 *
 * Lazy-loading version of useAIAssistant that only loads AI features when requested
 * This provides a lightweight fallback with progressive enhancement
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { optimizedStorage } from "../utils/storageUtils";
import { generateDateRange } from "../utils/dateUtils";
import { useAISettings } from "./useAISettings";
import { useRestaurant } from "../contexts/RestaurantContext";
import { EarlyShiftPreferencesLoader } from "../ai/utils/EarlyShiftPreferencesLoader";
import { CalendarRulesLoader } from "../ai/utils/CalendarRulesLoader";

// Lazy loading functions that only import when needed
const loadAISystem = async () => {
  try {
    // Loading AI system modules

    const [
      { featureCacheManager },
      { aiErrorHandler },
      constraintModule,
      configModule,
    ] = await Promise.all([
      import("../ai/cache/FeatureCacheManager.js"),
      import("../ai/utils/ErrorHandler"),
      import("../ai/constraints/ConstraintEngine"),
      import("../ai/cache/ConfigurationCacheManager"),
    ]);

    return {
      featureCacheManager,
      aiErrorHandler,
      constraintEngine: constraintModule,
      configurationCache: configModule.configurationCache,
    };
  } catch (error) {
    console.warn("⚠️ Failed to load AI system modules:", error.message);
    return null;
  }
};

const loadEnhancedAISystem = async () => {
  try {
    // Loading enhanced AI system

    const [hybridModule, businessRuleModule, tensorFlowModule] =
      await Promise.all([
        import("../ai/hybrid/HybridPredictor"),
        import("../ai/hybrid/BusinessRuleValidator"),
        import("../ai/ml/TensorFlowScheduler"),
      ]);

    return {
      HybridPredictor: hybridModule.HybridPredictor,
      BusinessRuleValidator: businessRuleModule.BusinessRuleValidator,
      TensorFlowScheduler: tensorFlowModule.TensorFlowScheduler,
    };
  } catch (error) {
    console.warn("⚠️ Failed to load enhanced AI system:", error.message);
    return null;
  }
};

export const useAIAssistantLazy = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  saveSchedule, // Backend save operation (WebSocket + Database)
  options = {},
) => {
  const {
    autoInitialize = false,
    enableEnhanced = true,
    fallbackMode = true,
  } = options;

  // Core state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [systemType, setSystemType] = useState("not-loaded");
  const [systemHealth, setSystemHealth] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState(null);

  // AI System reference
  const aiSystemRef = useRef(null);
  const loadingPromiseRef = useRef(null);

  // Get AI settings (WebSocket or localStorage)
  const aiSettings = useAISettings();

  // Get restaurant context for loading early shift preferences
  const { restaurant } = useRestaurant();

  // Lightweight fallback system that works without AI
  const fallbackSystem = useMemo(
    () => ({
      type: "fallback",
      generateSchedule: async () => {
        // Using fallback schedule generation (rule-based)

        // Simple rule-based schedule generation
        const newSchedule = { ...scheduleData };
        const dateRange = generateDateRange(currentMonthIndex);

        // Apply basic patterns for each staff member
        staffMembers.forEach((staff) => {
          if (!newSchedule[staff.id]) {
            newSchedule[staff.id] = {};
          }

          dateRange.forEach((date, index) => {
            const dateKey = date.toISOString().split("T")[0];
            const dayOfWeek = date.getDay();

            // Simple pattern: work 5 days, rest 2 days
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              // Weekend
              newSchedule[staff.id][dateKey] = "×"; // Day off
            } else if (staff.status === "パート") {
              newSchedule[staff.id][dateKey] = "○"; // Part-time normal shift
            } else {
              newSchedule[staff.id][dateKey] = ""; // Full-time normal shift (empty)
            }
          });
        });

        return {
          success: true,
          schedule: newSchedule,
          message: "Generated basic schedule using rule-based approach",
          source: "fallback",
        };
      },

      validateConstraints: (schedule) => {
        // Basic validation
        const issues = [];
        const dateRange = generateDateRange(currentMonthIndex);

        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const workingStaff = staffMembers.filter((staff) => {
            const shift = schedule[staff.id]?.[dateKey];
            return shift && shift !== "×"; // Not day off
          });

          // Check minimum staffing
          if (workingStaff.length < 2) {
            issues.push(
              `${dateKey}: Minimum staffing not met (${workingStaff.length} < 2)`,
            );
          }
        });

        return {
          isValid: issues.length === 0,
          violations: issues,
          source: "fallback",
        };
      },
    }),
    [scheduleData, staffMembers, currentMonthIndex],
  );

  // Initialize AI system
  const initializeAI = useCallback(async () => {
    if (isInitialized || isLoading) return aiSystemRef.current;

    // If already loading, wait for existing promise
    if (loadingPromiseRef.current) {
      return await loadingPromiseRef.current;
    }

    setIsLoading(true);
    setError(null);

    const loadingPromise = (async () => {
      try {
        // Initializing lazy AI system
        setSystemType("loading");

        // Try to load enhanced system first
        if (enableEnhanced) {
          const enhancedSystem = await loadEnhancedAISystem();
          if (enhancedSystem) {
            // Enhanced AI system loaded

            // Initialize HybridPredictor with settings provider
            const predictor = new enhancedSystem.HybridPredictor();

            // ✅ FIX: Always configure and initialize predictor
            // Don't skip initialization based on settings connection status
            // The predictor can handle settings being loaded asynchronously
            predictor.setSettingsProvider(aiSettings);
            await predictor.initialize();

            const system = {
              type: "enhanced",
              ...enhancedSystem,
              hybridPredictor: predictor,
              initialized: true,

              // Bridge method to connect generateAIPredictions to hybridPredictor
              generateSchedule: async ({
                scheduleData: inputScheduleData,
                staffMembers: inputStaffMembers,
                currentMonthIndex: inputMonthIndex,
                saveSchedule: inputSaveSchedule,
                onProgress,
                earlyShiftPreferences,
                calendarRules,
              }) => {
                // Ensure predictor is initialized (lazy initialization)
                if (!predictor.initialized || !predictor.isReady()) {
                  console.log("🔧 Lazy-initializing HybridPredictor...");
                  predictor.setSettingsProvider(aiSettings);
                  await predictor.initialize();
                  console.log("✅ HybridPredictor initialized");
                }

                const dateRange = generateDateRange(inputMonthIndex);

                if (onProgress) {
                  onProgress({
                    stage: "predicting",
                    progress: 30,
                    message: "ハイブリッドAI予測中...",
                  });
                }

                // Call hybrid predictor with progress callback
                const result = await predictor.predictSchedule(
                  {
                    scheduleData: inputScheduleData,
                    currentMonthIndex: inputMonthIndex,
                    timestamp: Date.now(),
                    earlyShiftPreferences,
                    calendarRules,
                  },
                  inputStaffMembers,
                  dateRange,
                  onProgress // Forward progress callback
                );

                return {
                  success: result.success !== false,
                  schedule: result.schedule || result.predictions,
                  message: result.message || "ハイブリッドAI予測完了",
                  data: result,
                  ...result,
                };
              },
            };

            // ✅ FIX: Validate predictor is properly initialized before marking ready
            if (predictor.initialized && predictor.isReady()) {
              aiSystemRef.current = system;
              setSystemType("enhanced");
              setIsInitialized(true);
              setIsAvailable(true);
              console.log("✅ Enhanced AI system initialized successfully with predictor");
              return system;
            } else {
              console.warn("⚠️ Predictor not ready, will retry or use fallback");
              // Don't mark as initialized - allow retry
              if (fallbackMode) {
                console.log("🔄 Falling back to basic system due to predictor initialization failure");
                // Continue to fallback section below
              } else {
                return null;
              }
            }
          }
        }

        // Fallback to basic system
        const basicSystem = await loadAISystem();
        if (basicSystem) {
          // Basic AI system loaded
          const system = {
            type: "basic",
            ...basicSystem,
            initialized: true,
          };

          aiSystemRef.current = system;
          setSystemType("basic");
          setIsInitialized(true);
          setIsAvailable(true);
          return system;
        }

        // Use fallback system if nothing else works
        if (fallbackMode) {
          // Using fallback system (no AI loaded)
          aiSystemRef.current = fallbackSystem;
          setSystemType("fallback");
          setIsInitialized(true);
          setIsAvailable(true);
          return fallbackSystem;
        }

        throw new Error("No AI system could be loaded");
      } catch (err) {
        console.error("❌ Failed to initialize AI system:", err);
        setError(err.message);

        // Use fallback if available
        if (fallbackMode) {
          aiSystemRef.current = fallbackSystem;
          setSystemType("fallback");
          setIsAvailable(true);
          return fallbackSystem;
        }

        setSystemType("error");
        setIsAvailable(false);
        return null;
      } finally {
        setIsLoading(false);
        loadingPromiseRef.current = null;
      }
    })();

    loadingPromiseRef.current = loadingPromise;
    return await loadingPromise;
  }, [
    isInitialized,
    isLoading,
    enableEnhanced,
    fallbackMode,
    fallbackSystem,
    scheduleData,      // Fix stale closure
    staffMembers,      // Fix stale closure
    currentMonthIndex, // Fix stale closure
    saveSchedule,      // Fix stale closure
    aiSettings,        // ✅ FIX: Add aiSettings to prevent stale closure
  ]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      initializeAI();
    }
  }, [autoInitialize, isInitialized, isLoading, initializeAI]);

  // Generate AI predictions
  const generateAIPredictions = useCallback(
    async (onProgress) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Report initialization progress
        if (onProgress) {
          onProgress({
            stage: "initializing",
            progress: 10,
            message: "AIシステム初期化中...",
          });
        }

        // Ensure AI is initialized
        const system = aiSystemRef.current || (await initializeAI());
        if (!system) {
          // ✅ FIX: Provide better error handling with explicit fallback
          if (fallbackMode && fallbackSystem) {
            console.warn("⚠️ Enhanced system not available, using fallback system");
            aiSystemRef.current = fallbackSystem;
            setSystemType("fallback");
            setIsInitialized(true);
            setIsAvailable(true);
            // Use fallback system
            const fallbackResult = await fallbackSystem.generateSchedule({
              scheduleData,
              staffMembers,
              currentMonthIndex,
              saveSchedule,
              onProgress,
            });
            return fallbackResult;
          }
          throw new Error("AI system not available and fallback is disabled");
        }

        // Report AI system ready
        if (onProgress) {
          onProgress({
            stage: "starting",
            progress: 20,
            message: "AI予測を開始...",
          });
        }

        // Load early shift preferences for AI constraint processing
        let earlyShiftPreferences = {};
        if (restaurant?.id) {
          try {
            if (onProgress) {
              onProgress({
                stage: "loading_preferences",
                progress: 25,
                message: "早番設定を読み込み中...",
              });
            }

            const dateRange = generateDateRange(currentMonthIndex);
            earlyShiftPreferences = await EarlyShiftPreferencesLoader.loadPreferences(
              restaurant.id,
              dateRange
            );

            console.log(
              `✅ [AI-LAZY] Loaded early shift preferences for ${Object.keys(earlyShiftPreferences).length} staff members`
            );
          } catch (err) {
            console.warn("⚠️ [AI-LAZY] Failed to load early shift preferences:", err);
            // Continue without preferences - AI will work without early shift constraints
          }
        } else {
          console.warn("⚠️ [AI-LAZY] No restaurant ID available - skipping early shift preferences loading");
          console.warn("⚠️ [AI-LAZY] Restaurant context:", { hasRestaurant: !!restaurant, restaurantId: restaurant?.id });
        }

        // Load calendar rules (must_work, must_day_off) for AI constraint processing
        let calendarRules = {};
        if (restaurant?.id) {
          try {
            if (onProgress) {
              onProgress({
                stage: "loading_calendar_rules",
                progress: 30,
                message: "カレンダールールを読み込み中...",
              });
            }

            const dateRange = generateDateRange(currentMonthIndex);
            calendarRules = await CalendarRulesLoader.loadRules(
              restaurant.id,
              dateRange
            );

            const rulesSummary = CalendarRulesLoader.getRulesSummary(calendarRules);
            console.log(
              `✅ [AI-LAZY] Loaded ${rulesSummary.totalRules} calendar rules (${rulesSummary.mustWorkCount} must_work, ${rulesSummary.mustDayOffCount} must_day_off)`
            );
          } catch (err) {
            console.warn("⚠️ [AI-LAZY] Failed to load calendar rules:", err);
            // Continue without calendar rules - AI will work without calendar constraints
          }
        } else {
          console.warn("⚠️ [AI-LAZY] No restaurant ID available - skipping calendar rules loading");
          console.warn("⚠️ [AI-LAZY] Restaurant context:", { hasRestaurant: !!restaurant, restaurantId: restaurant?.id });
        }

        // Generating predictions using AI system

        if (system.generateSchedule) {
          const result = await system.generateSchedule({
            scheduleData,
            staffMembers,
            currentMonthIndex,
            saveSchedule, // Pass backend save operation
            onProgress, // Pass progress callback through
            earlyShiftPreferences, // Pass early shift preferences for constraint processing
            calendarRules, // Pass calendar rules (must_work, must_day_off) for constraint processing
          });

          console.log("🔍 [AI-LAZY] generateSchedule returned result:", {
            success: result?.success,
            hasSchedule: !!result?.schedule,
            scheduleKeys: result?.schedule ? Object.keys(result.schedule).length : 0,
            method: result?.metadata?.method
          });

          // Apply the generated schedule to backend (WebSocket → Go Server → Database)
          if (result.success && result.schedule) {
            console.log("💾 [AI] Saving AI-generated schedule to backend...");
            console.log(`📊 [AI] Schedule to save has ${Object.keys(result.schedule).length} staff members`);

            if (onProgress) {
              onProgress({
                stage: "saving",
                progress: 90,
                message: "スケジュール保存中...",
              });
            }

            // Save to backend via WebSocket (this persists to database)
            // ✅ FIX: Pass { fromAI: true } to trigger immediate UI update with new reference
            // This ensures React detects the state change and re-renders the ScheduleTable
            console.log("📤 [AI] Calling saveSchedule function with fromAI flag...");
            await saveSchedule(result.schedule, null, { fromAI: true });

            console.log("✅ [AI] AI-generated schedule saved to backend and UI updated immediately");

            // Save to localStorage as backup cache
            console.log("💾 [AI] Saving to localStorage as backup...");
            optimizedStorage.saveScheduleData(currentMonthIndex, result.schedule);
          } else {
            console.error("❌ [AI-LAZY] Schedule save skipped - conditions not met:", {
              success: result?.success,
              hasSchedule: !!result?.schedule,
              scheduleType: typeof result?.schedule
            });
          }

          // Report completion
          if (onProgress) {
            onProgress({
              stage: "completed",
              progress: 100,
              message: "予測完了",
            });
          }

          console.log("✅ [AI-LAZY] Returning result to caller");
          return result;
        } else {
          // Fallback for systems without generateSchedule
          return await fallbackSystem.generateSchedule();
        }
      } catch (err) {
        console.error("❌ Failed to generate AI predictions:", err);
        setError(err.message);

        if (onProgress) {
          onProgress({
            stage: "error",
            progress: 0,
            message: `エラー: ${err.message}`,
          });
        }

        return {
          success: false,
          error: err.message,
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [
      scheduleData,
      staffMembers,
      currentMonthIndex,
      saveSchedule, // Updated to use backend save operation
      initializeAI,
      fallbackSystem,
      restaurant, // Add restaurant for early shift preferences loading
    ],
  );

  // Auto-fill schedule (alias for generateAIPredictions)
  const autoFillSchedule = useCallback(
    (onProgress) => {
      return generateAIPredictions(onProgress);
    },
    [generateAIPredictions],
  );

  // Get system status
  const getSystemStatus = useCallback(() => {
    const system = aiSystemRef.current;
    return {
      isLoaded: isInitialized,
      isLoading,
      systemType,
      isAvailable,
      error,
      initialized: system?.initialized || false,
      health: systemHealth,
      features: {
        enhanced: systemType === "enhanced",
        basic: systemType === "basic",
        fallback: systemType === "fallback",
      },
    };
  }, [isInitialized, isLoading, systemType, isAvailable, error, systemHealth]);

  return {
    // Core state
    isInitialized,
    isProcessing,
    isLoading,
    systemType,
    systemHealth,
    isAvailable,
    error,

    // Methods
    initializeAI,
    generateAIPredictions,
    autoFillSchedule,
    generateSchedule: aiSystemRef.current?.generateSchedule, // Bridge to HybridPredictor
    getSystemStatus,

    // Enhanced features detection
    isEnhanced: systemType === "enhanced",
    isBasic: systemType === "basic",
    isFallback: systemType === "fallback",
    isMLReady: systemType === "enhanced",

    // Backwards compatibility
    configurationStatus: isInitialized ? "ready" : "not-loaded",
  };
};

export default useAIAssistantLazy;
