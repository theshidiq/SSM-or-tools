/**
 * useAIAssistantLazy.js (OR-Tools Version)
 *
 * Sends schedule generation requests to Go server -> OR-Tools service.
 * Simplified from the previous multi-phase ML system to use constraint programming.
 *
 * Key Changes:
 * - Removed: BusinessRuleValidator, HybridPredictor, TensorFlowScheduler
 * - Added: Direct WebSocket communication to Go server for OR-Tools optimization
 * - Kept: CalendarRulesLoader, EarlyShiftPreferencesLoader (data loading)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { optimizedStorage } from "../utils/storageUtils";
import { generateDateRange } from "../utils/dateUtils";
import { useAISettings } from "./useAISettings";
import { useRestaurant } from "../contexts/RestaurantContext";
import { EarlyShiftPreferencesLoader } from "../ai/utils/EarlyShiftPreferencesLoader";
import { CalendarRulesLoader } from "../ai/utils/CalendarRulesLoader";

// WebSocket configuration (same as useWebSocketShifts)
const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8080";
const WS_ENDPOINT = "/staff-sync";

// Message types for OR-Tools
const MESSAGE_TYPES = {
  GENERATE_SCHEDULE_ORTOOLS: "GENERATE_SCHEDULE_ORTOOLS",
  SCHEDULE_GENERATED: "SCHEDULE_GENERATED",
  GENERATE_SCHEDULE_ERROR: "GENERATE_SCHEDULE_ERROR",
  CONNECTION_ACK: "CONNECTION_ACK",
};

export const useAIAssistantLazy = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  saveSchedule,
  options = {},
) => {
  const { autoInitialize = false } = options;

  // Core state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [systemType, setSystemType] = useState("ortools");
  const [systemHealth, setSystemHealth] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState(null);

  // WebSocket reference
  const wsRef = useRef(null);
  const messageHandlersRef = useRef({});

  // Get AI settings and restaurant context
  const aiSettings = useAISettings();
  const { restaurant } = useRestaurant();

  /**
   * Connect to WebSocket server
   */
  const connectWebSocket = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      const wsUrl = `${WS_URL}${WS_ENDPOINT}?period=${currentMonthIndex}`;
      console.log("[OR-TOOLS] Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[OR-TOOLS] WebSocket connected");
        wsRef.current = ws;
        setIsAvailable(true);
        resolve(ws);
      };

      ws.onerror = (event) => {
        console.error("[OR-TOOLS] WebSocket error:", event);
        setIsAvailable(false);
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        console.log("[OR-TOOLS] WebSocket closed");
        wsRef.current = null;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const handler = messageHandlersRef.current[message.type];
          if (handler) {
            handler(message.payload);
          }
        } catch (err) {
          console.error("[OR-TOOLS] Error parsing message:", err);
        }
      };

      // Timeout for connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);
    });
  }, [currentMonthIndex]);

  /**
   * Send message via WebSocket
   */
  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString(),
      }));
      return true;
    }
    return false;
  }, []);

  /**
   * Initialize AI system (simplified for OR-Tools)
   */
  const initializeAI = useCallback(async () => {
    if (isInitialized || isLoading) return true;

    setIsLoading(true);
    setError(null);

    try {
      // Connect to WebSocket
      await connectWebSocket();
      setIsInitialized(true);
      setSystemType("ortools");
      setIsAvailable(true);
      console.log("[OR-TOOLS] AI system initialized (OR-Tools via WebSocket)");
      return true;
    } catch (err) {
      console.error("[OR-TOOLS] Initialization error:", err);
      setError(err.message);
      setIsAvailable(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, isLoading, connectWebSocket]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      initializeAI();
    }
  }, [autoInitialize, isInitialized, isLoading, initializeAI]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  /**
   * Calculate date range for current month period
   */
  const calculateDateRange = useCallback((monthIndex) => {
    const dateRange = generateDateRange(monthIndex);
    return dateRange.map(date => date.toISOString().split("T")[0]);
  }, []);

  /**
   * Generate AI predictions using OR-Tools via Go server
   */
  const generateAIPredictions = useCallback(
    async (onProgress) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Step 1: Initialize if needed
        if (onProgress) {
          onProgress({
            stage: "initializing",
            progress: 10,
            message: "AIシステム初期化中...",
          });
        }

        // Ensure WebSocket is connected
        await connectWebSocket();

        // Step 2: Load constraints from database
        if (onProgress) {
          onProgress({
            stage: "loading_preferences",
            progress: 20,
            message: "設定を読み込み中...",
          });
        }

        const dateRange = calculateDateRange(currentMonthIndex);

        // Load early shift preferences
        let earlyShiftPreferences = {};
        if (restaurant?.id) {
          try {
            earlyShiftPreferences = await EarlyShiftPreferencesLoader.loadPreferences(
              restaurant.id,
              generateDateRange(currentMonthIndex)
            );
            console.log(
              `[OR-TOOLS] Loaded early shift preferences for ${Object.keys(earlyShiftPreferences).length} staff members`
            );
          } catch (err) {
            console.warn("[OR-TOOLS] Failed to load early shift preferences:", err);
          }
        }

        // Load calendar rules
        let calendarRules = {};
        if (restaurant?.id) {
          try {
            calendarRules = await CalendarRulesLoader.loadRules(
              restaurant.id,
              generateDateRange(currentMonthIndex)
            );
            const rulesSummary = CalendarRulesLoader.getRulesSummary(calendarRules);
            console.log(
              `[OR-TOOLS] Loaded ${rulesSummary.totalRules} calendar rules`
            );
          } catch (err) {
            console.warn("[OR-TOOLS] Failed to load calendar rules:", err);
          }
        }

        if (onProgress) {
          onProgress({
            stage: "optimizing",
            progress: 30,
            message: "OR-Toolsで最適化中...",
          });
        }

        // Step 3: Extract pre-filled cells from current schedule
        // These are staff day-off requests entered by manager before AI generation
        // They will be treated as HARD constraints in OR-Tools (cannot be changed)
        const prefilledSchedule = {};
        let prefilledCount = 0;

        if (scheduleData && typeof scheduleData === 'object') {
          Object.entries(scheduleData).forEach(([staffId, dates]) => {
            if (dates && typeof dates === 'object') {
              Object.entries(dates).forEach(([dateKey, shiftValue]) => {
                // Only include non-empty cells as pre-filled
                if (shiftValue && typeof shiftValue === 'string' && shiftValue.trim() !== '') {
                  if (!prefilledSchedule[staffId]) {
                    prefilledSchedule[staffId] = {};
                  }
                  prefilledSchedule[staffId][dateKey] = shiftValue;
                  prefilledCount++;
                }
              });
            }
          });
        }

        if (prefilledCount > 0) {
          console.log(`[OR-TOOLS] Extracted ${prefilledCount} pre-filled cells from schedule (will be preserved as HARD constraints)`);
        } else {
          console.log(`[OR-TOOLS] No pre-filled cells found - generating full schedule`);
        }

        // Step 4: Prepare constraints payload
        // ✅ FIX: Extract monthly limit from monthlyLimits array (not singular monthlyLimit)
        // The UI stores monthly limits as an array in settings.monthlyLimits
        // We need to find the first "off_days" limit and extract minCount/maxCount
        const monthlyLimitsArray = aiSettings?.monthlyLimits || [];
        const offDaysLimit = monthlyLimitsArray.find(l =>
          l.limitType === 'off_days' || l.limitType === 'max_off_days'
        ) || monthlyLimitsArray[0];

        // Extract minCount/maxCount from the found limit
        // ✅ FIX: Properly read values from database without incorrect fallbacks
        // - minCount: null means "no minimum" - DO NOT fall back to maxCount!
        // - isHardConstraint: Read from constraints.isHardConstraint (useAISettings path)
        //   OR directly from the limit object (Go server extracts from limit_config)
        const monthlyLimitConfig = offDaysLimit ? {
          // ✅ FIX: Keep minCount as null when database has null (no minimum constraint)
          // This gives flexibility for HARD priority rules to work
          minCount: offDaysLimit.minCount,  // null = no minimum, number = enforce minimum
          maxCount: offDaysLimit.maxCount ?? 8,
          excludeCalendarRules: offDaysLimit.excludeCalendarRules ?? true,
          excludeEarlyShiftCalendar: offDaysLimit.excludeEarlyShiftCalendar ?? true,
          overrideWeeklyLimits: offDaysLimit.overrideWeeklyLimits ?? true,
          countHalfDays: offDaysLimit.countHalfDays ?? true,
          // ✅ FIX: Read isHardConstraint from correct path
          // useAISettings transforms it to constraints.isHardConstraint
          // But Go server also puts it at top level from is_hard_constraint column
          isHardConstraint: offDaysLimit.constraints?.isHardConstraint ??
                           offDaysLimit.isHardConstraint ??
                           false,  // Default to SOFT to prevent INFEASIBLE conflicts
        } : {
          minCount: null,  // No minimum by default
          maxCount: 8,
          excludeCalendarRules: true,
          isHardConstraint: false, // Default to SOFT constraint
        };

        console.log(`[OR-TOOLS] Monthly limit config from settings:`, monthlyLimitConfig);
        console.log(`[OR-TOOLS] Monthly limit isHardConstraint: ${monthlyLimitConfig.isHardConstraint} (will ${monthlyLimitConfig.isHardConstraint ? 'STRICTLY enforce' : 'softly penalize'} limits)`);

        const constraints = {
          calendarRules: calendarRules || {},
          earlyShiftPreferences: earlyShiftPreferences || {},
          // DEPRECATED: Global daily limits - auto-disabled when staffTypeLimits is configured
          // See Python scheduler _add_daily_limits() for AUTO-DISABLE logic
          dailyLimitsRaw: aiSettings?.dailyLimitsRaw || {
            minOffPerDay: 0,  // Set to 0 to effectively disable
            maxOffPerDay: 3,
          },
          // ✅ FIX: Use extracted monthly limit config (from monthlyLimits array)
          monthlyLimit: monthlyLimitConfig,
          staffGroups: aiSettings?.staffGroups || [],
          priorityRules: aiSettings?.priorityRules || {},
          // ✅ PRIMARY: Staff Type Daily Limits (replaces global daily limits)
          // Per-staff-type constraints for off/early shifts
          // minOff: Minimum staff of this type that MUST be off each day
          // maxOff: Maximum staff of this type that CAN be off each day
          // Default: { '社員': { minOff: 1, maxOff: 1, maxEarly: 2, isHard: true } }
          staffTypeLimits: aiSettings?.staffTypeLimits || {
            '社員': { minOff: 1, maxOff: 1, maxEarly: 2, isHard: true },
          },
          // ✅ FIX: Include OR-Tools solver configuration (penalty weights, timeout, etc.)
          // This is used by Python OR-Tools scheduler to configure constraint penalties
          ortoolsConfig: aiSettings?.ortoolsConfig || {
            preset: 'balanced',
            penaltyWeights: {
              staffGroup: 100,
              dailyLimitMin: 50,
              dailyLimitMax: 50,
              monthlyLimit: 80,
              adjacentConflict: 30,
              fiveDayRest: 200,
            },
            solverSettings: {
              timeout: 30,
              numWorkers: 4,
            },
          },
          // ✅ NEW: Pre-filled schedule (user-edited cells before AI generation)
          // These become HARD constraints in OR-Tools - they will NOT be changed
          prefilledSchedule: prefilledSchedule,
          // ✅ NEW: Backup staff assignments (for coverage constraints)
          // Business Logic:
          // - When ANY member of a group has day off (×), backup staff MUST work (○)
          // - When NO member of a group has day off, backup staff gets Unavailable (⊘)
          // - This is a HARD constraint in OR-Tools
          backupAssignments: aiSettings?.backupAssignments || [],
        };

        // Log the ortoolsConfig being sent
        console.log("[OR-TOOLS] Using ortoolsConfig:", JSON.stringify(constraints.ortoolsConfig, null, 2));

        // Log staffTypeLimits if configured
        if (Object.keys(constraints.staffTypeLimits).length > 0) {
          console.log("[OR-TOOLS] Using staffTypeLimits:", JSON.stringify(constraints.staffTypeLimits, null, 2));
        }

        // Log backupAssignments if configured
        if (constraints.backupAssignments && constraints.backupAssignments.length > 0) {
          console.log("[OR-TOOLS] Using backupAssignments:", JSON.stringify(constraints.backupAssignments, null, 2));
        }

        // 🔍 DEBUG: Log staffGroups with members to verify data flow
        if (constraints.staffGroups && constraints.staffGroups.length > 0) {
          console.log("[OR-TOOLS] 🔍 DEBUG - staffGroups being sent:");
          constraints.staffGroups.forEach((group, i) => {
            console.log(`  Group ${i+1}: "${group.name}" (id: ${group.id})`);
            console.log(`    members: ${JSON.stringify(group.members)}`);
          });
        } else {
          console.log("[OR-TOOLS] ⚠️ WARNING - No staffGroups to send!");
        }

        // Log pre-filled cells summary
        if (prefilledCount > 0) {
          const staffWithPrefills = Object.keys(prefilledSchedule).length;
          console.log(`[OR-TOOLS] Pre-filled schedule: ${prefilledCount} cells across ${staffWithPrefills} staff members`);
        }

        // Step 5: Send optimization request to Go server with simulated progress
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            delete messageHandlersRef.current[MESSAGE_TYPES.SCHEDULE_GENERATED];
            delete messageHandlersRef.current[MESSAGE_TYPES.GENERATE_SCHEDULE_ERROR];
            reject(new Error("Schedule generation timed out (60s)"));
          }, 60000);

          // Simulated progress during OR-Tools solving
          let currentProgress = 30;
          const progressMessages = [
            { progress: 35, message: "制約条件を構築中..." },          // Building constraints
            { progress: 45, message: "変数を最適化中..." },            // Optimizing variables
            { progress: 55, message: "スタッフグループを処理中..." },  // Processing staff groups
            { progress: 65, message: "日次制限を適用中..." },          // Applying daily limits
            { progress: 70, message: "月間制限を適用中..." },          // Applying monthly limits
            { progress: 75, message: "5日休息を確認中..." },           // Checking 5-day rest
            { progress: 80, message: "最適解を探索中..." },            // Searching for optimal solution
            { progress: 85, message: "ソリューション検証中..." },      // Validating solution
          ];

          let progressIndex = 0;
          const progressInterval = setInterval(() => {
            if (progressIndex < progressMessages.length && onProgress) {
              const nextMessage = progressMessages[progressIndex];
              onProgress({
                stage: "optimizing",
                progress: nextMessage.progress,
                message: nextMessage.message,
              });
              progressIndex++;
            }
          }, 400); // Update every 400ms for smoother progress

          // Register success handler
          messageHandlersRef.current[MESSAGE_TYPES.SCHEDULE_GENERATED] = (data) => {
            clearInterval(progressInterval);
            clearTimeout(timeout);
            delete messageHandlersRef.current[MESSAGE_TYPES.SCHEDULE_GENERATED];
            delete messageHandlersRef.current[MESSAGE_TYPES.GENERATE_SCHEDULE_ERROR];
            resolve(data);
          };

          // Register error handler
          messageHandlersRef.current[MESSAGE_TYPES.GENERATE_SCHEDULE_ERROR] = (data) => {
            clearInterval(progressInterval);
            clearTimeout(timeout);
            delete messageHandlersRef.current[MESSAGE_TYPES.SCHEDULE_GENERATED];
            delete messageHandlersRef.current[MESSAGE_TYPES.GENERATE_SCHEDULE_ERROR];
            reject(new Error(data.error || "Schedule generation failed"));
          };

          // Send request
          const sent = sendMessage(MESSAGE_TYPES.GENERATE_SCHEDULE_ORTOOLS, {
            staffMembers: staffMembers.map(s => ({
              id: s.id,
              name: s.name,
              status: s.status,
              position: s.position,
              end_period: s.end_period || s.endPeriod || null,  // { year, month, day } or null
            })),
            dateRange,
            constraints,
            timeout: 30, // OR-Tools solve timeout
          });

          if (!sent) {
            clearInterval(progressInterval);
            clearTimeout(timeout);
            reject(new Error("Failed to send message - WebSocket not connected"));
          }
        });

        if (onProgress) {
          onProgress({
            stage: "saving",
            progress: 90,
            message: "スケジュール保存中...",
          });
        }

        // Step 5: Save the generated schedule
        if (result.schedule) {
          console.log("[OR-TOOLS] Saving generated schedule to backend...");
          console.log(`[OR-TOOLS] Schedule has ${Object.keys(result.schedule).length} staff members`);

          // Save to backend via WebSocket
          await saveSchedule(result.schedule, null, { fromAI: true });
          console.log("[OR-TOOLS] Schedule saved successfully");

          // Save to localStorage as backup
          optimizedStorage.saveScheduleData(currentMonthIndex, result.schedule);
        }

        if (onProgress) {
          onProgress({
            stage: "completed",
            progress: 100,
            message: `最適化完了 (${result.isOptimal ? '最適解' : '実行可能解'})`,
          });
        }

        return {
          success: true,
          schedule: result.schedule,
          isOptimal: result.isOptimal,
          solveTime: result.solveTime,
          status: result.status,
          stats: result.stats,
          message: result.isOptimal
            ? "OR-Toolsによる最適スケジュールを生成しました"
            : "OR-Toolsによる実行可能なスケジュールを生成しました",
        };

      } catch (err) {
        console.error("[OR-TOOLS] Generation error:", err);
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
      staffMembers,
      currentMonthIndex,
      saveSchedule,
      connectWebSocket,
      sendMessage,
      calculateDateRange,
      restaurant,
      aiSettings,
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
    return {
      isLoaded: isInitialized,
      isLoading,
      systemType,
      isAvailable,
      error,
      initialized: isInitialized,
      health: systemHealth,
      features: {
        ortools: true,
        enhanced: false,
        basic: false,
        fallback: false,
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

    // Feature detection
    isEnhanced: false,
    isBasic: false,
    isFallback: false,
    isORTools: true,
    isMLReady: true, // OR-Tools is always ready once connected

    // Backwards compatibility
    configurationStatus: isInitialized ? "ready" : "not-loaded",
  };
};

export default useAIAssistantLazy;
