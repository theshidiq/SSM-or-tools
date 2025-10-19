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

            // Configure predictor with AI settings if connected
            if (aiSettings.isConnected && !aiSettings.isLoading) {
              predictor.setSettingsProvider(aiSettings);
              await predictor.initialize();
            }

            const system = {
              type: "enhanced",
              ...enhancedSystem,
              hybridPredictor: predictor,
              initialized: true,
            };

            aiSystemRef.current = system;
            setSystemType("enhanced");
            setIsInitialized(true);
            setIsAvailable(true);
            return system;
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
  }, [isInitialized, isLoading, enableEnhanced, fallbackMode, fallbackSystem]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      initializeAI();
    }
  }, [autoInitialize, isInitialized, isLoading, initializeAI]);

  // Generate AI predictions
  const generateAIPredictions = useCallback(
    async (options = {}) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Ensure AI is initialized
        const system = aiSystemRef.current || (await initializeAI());
        if (!system) {
          throw new Error("AI system not available");
        }

        // Generating predictions using AI system

        if (system.generateSchedule) {
          const result = await system.generateSchedule({
            scheduleData,
            staffMembers,
            currentMonthIndex,
            saveSchedule, // Pass backend save operation
            ...options,
          });

          // Apply the generated schedule to backend (WebSocket → Go Server → Database)
          if (result.success && result.schedule) {
            console.log("💾 [AI] Saving AI-generated schedule to backend...");

            // Save to backend via WebSocket (this persists to database)
            await saveSchedule(result.schedule);

            console.log("✅ [AI] AI-generated schedule saved to backend successfully");

            // Save to localStorage as backup cache
            optimizedStorage.saveScheduleData(result.schedule);
          }

          return result;
        } else {
          // Fallback for systems without generateSchedule
          return await fallbackSystem.generateSchedule();
        }
      } catch (err) {
        console.error("❌ Failed to generate AI predictions:", err);
        setError(err.message);
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
    ],
  );

  // Auto-fill schedule (alias for generateAIPredictions)
  const autoFillSchedule = useCallback(
    (options = {}) => {
      return generateAIPredictions({
        autoFill: true,
        ...options,
      });
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
