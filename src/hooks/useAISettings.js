/**
 * useAISettings.js
 *
 * AI Settings Integration Layer (Phase 1)
 * Connects AI system to real-time WebSocket settings from Go server
 *
 * Architecture:
 * - Consumes useSettingsData (WebSocket + Supabase hybrid)
 * - Transforms database format to AI-friendly format
 * - Provides real-time updates to AI components
 * - Handles loading states and errors gracefully
 *
 * Usage:
 * const { staffGroups, dailyLimits, mlConfig, ... } = useAISettings();
 *
 * Replaces: ConfigurationService (localStorage-only, no real-time updates)
 */

import { useMemo, useCallback } from "react";
import { useSettingsData } from "./useSettingsData";

/**
 * Hook for AI systems to access settings with real-time WebSocket updates
 *
 * @returns {Object} AI-optimized settings interface with:
 *   - staffGroups: Transformed staff group data
 *   - dailyLimits: Daily constraint limits
 *   - monthlyLimits: Monthly constraint limits
 *   - priorityRules: Priority/preference rules
 *   - mlConfig: ML model configuration
 *   - allConstraints: Aggregated constraints for validation
 *   - constraintWeights: Weights for optimization algorithms
 *   - isLoading: Loading state
 *   - isConnected: Backend connection status
 *   - error: Error state
 */
export const useAISettings = () => {
  const {
    settings,
    version,
    isLoading,
    error,
    isConnectedToBackend,
    backendMode,
    updateSettings,
  } = useSettingsData(true);

  /**
   * Transform staff groups from database format to AI format
   * Database: [{ id, name, members: [...], color, is_active, ... }]
   * AI: [{ id, name, members: [...], metadata: { color, ... } }]
   */
  const staffGroups = useMemo(() => {
    if (!settings?.staffGroups) return [];

    // Filter out soft-deleted groups (is_active === false)
    const activeGroups = settings.staffGroups.filter(
      (group) => group.is_active !== false
    );

    return activeGroups.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members || [],
      description: group.description || "",
      metadata: {
        color: group.color || "#3B82F6",
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        isActive: group.is_active !== false,
      },
    }));
  }, [settings?.staffGroups]);

  /**
   * ✅ NEW: Raw daily limits object for direct use by ConstraintEngine
   * This provides the flat object format that ConstraintEngine.validateDailyLimits() expects
   * Includes both MIN and MAX constraints from database
   *
   * Format: {
   *   minOffPerDay: 0, maxOffPerDay: 3,
   *   minEarlyPerDay: 0, maxEarlyPerDay: 2,
   *   minLatePerDay: 0, maxLatePerDay: 3,
   *   minWorkingStaffPerDay: 3,
   *   _source: 'database' | 'default'
   * }
   */
  const dailyLimitsRaw = useMemo(() => {
    const dbLimits = settings?.dailyLimits;

    // Default values if no database limits
    const defaults = {
      minOffPerDay: 0,
      maxOffPerDay: 3,
      minEarlyPerDay: 0,
      maxEarlyPerDay: 2,
      minLatePerDay: 0,
      maxLatePerDay: 3,
      minWorkingStaffPerDay: 3,
    };

    if (!dbLimits || (typeof dbLimits === 'object' && Object.keys(dbLimits).length === 0)) {
      console.log('[useAISettings] No dailyLimits from database, using defaults');
      return {
        ...defaults,
        _source: 'default',
      };
    }

    // If it's an array (old format), extract first item or use defaults
    if (Array.isArray(dbLimits)) {
      console.log('[useAISettings] dailyLimits is array format (legacy), using defaults');
      return {
        ...defaults,
        _source: 'default',
      };
    }

    // Validate min <= max constraints
    const validated = {
      minOffPerDay: dbLimits.minOffPerDay ?? defaults.minOffPerDay,
      maxOffPerDay: dbLimits.maxOffPerDay ?? defaults.maxOffPerDay,
      minEarlyPerDay: dbLimits.minEarlyPerDay ?? defaults.minEarlyPerDay,
      maxEarlyPerDay: dbLimits.maxEarlyPerDay ?? defaults.maxEarlyPerDay,
      minLatePerDay: dbLimits.minLatePerDay ?? defaults.minLatePerDay,
      maxLatePerDay: dbLimits.maxLatePerDay ?? defaults.maxLatePerDay,
      minWorkingStaffPerDay: dbLimits.minWorkingStaffPerDay ?? defaults.minWorkingStaffPerDay,
    };

    // Ensure min <= max for each constraint type
    if (validated.minOffPerDay > validated.maxOffPerDay) {
      console.warn('[useAISettings] minOffPerDay > maxOffPerDay, adjusting');
      validated.minOffPerDay = validated.maxOffPerDay;
    }
    if (validated.minEarlyPerDay > validated.maxEarlyPerDay) {
      console.warn('[useAISettings] minEarlyPerDay > maxEarlyPerDay, adjusting');
      validated.minEarlyPerDay = validated.maxEarlyPerDay;
    }
    if (validated.minLatePerDay > validated.maxLatePerDay) {
      console.warn('[useAISettings] minLatePerDay > maxLatePerDay, adjusting');
      validated.minLatePerDay = validated.maxLatePerDay;
    }

    console.log('[useAISettings] ✅ Daily limits loaded from database:', validated);

    return {
      ...validated,
      _source: 'database',
    };
  }, [settings?.dailyLimits]);

  /**
   * Transform daily limits from database format to AI format (array)
   * NEW FORMAT (object): { maxOffPerDay: 3, maxEarlyPerDay: 2, maxLatePerDay: 3, minOffPerDay: 0, ... }
   * OLD FORMAT (array): [{ id, name, limitConfig: {...} }]
   * AI FORMAT (array): [{ id, name, shiftType, minCount, maxCount, constraints: {...} }]
   *
   * ✅ ENHANCED: Now includes MIN constraints for better schedule distribution
   */
  const dailyLimits = useMemo(() => {
    if (!settings?.dailyLimits) return [];

    const limits = settings.dailyLimits;

    // NEW FORMAT: Object with minOffPerDay, maxOffPerDay, minEarlyPerDay, maxEarlyPerDay, etc.
    // Transform to array format for AI compatibility
    if (!Array.isArray(limits)) {
      const dailyLimitsArray = [];

      // Add off days limit (includes both MIN and MAX)
      dailyLimitsArray.push({
        id: 'daily-limit-off',
        name: 'Staff Off Days Per Day',
        shiftType: 'off',
        minCount: limits.minOffPerDay ?? 0,      // ✅ NEW: MIN constraint
        maxCount: limits.maxOffPerDay ?? 3,
        constraints: {
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: 'all',
          targetIds: [],
          isHardConstraint: true,
          penaltyWeight: 50,
        },
        description: `${limits.minOffPerDay ?? 0}-${limits.maxOffPerDay ?? 3} staff should be off per day`,
      });

      // Add early shifts limit (includes both MIN and MAX)
      dailyLimitsArray.push({
        id: 'daily-limit-early',
        name: 'Early Shifts Per Day',
        shiftType: 'early',
        minCount: limits.minEarlyPerDay ?? 0,    // ✅ NEW: MIN constraint
        maxCount: limits.maxEarlyPerDay ?? 2,
        constraints: {
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: 'all',
          targetIds: [],
          isHardConstraint: false,
          penaltyWeight: 30,
        },
        description: `${limits.minEarlyPerDay ?? 0}-${limits.maxEarlyPerDay ?? 2} staff on early shifts per day`,
      });

      // Add late shifts limit (includes both MIN and MAX)
      dailyLimitsArray.push({
        id: 'daily-limit-late',
        name: 'Late Shifts Per Day',
        shiftType: 'late',
        minCount: limits.minLatePerDay ?? 0,     // ✅ NEW: MIN constraint
        maxCount: limits.maxLatePerDay ?? 3,
        constraints: {
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: 'all',
          targetIds: [],
          isHardConstraint: false,
          penaltyWeight: 30,
        },
        description: `${limits.minLatePerDay ?? 0}-${limits.maxLatePerDay ?? 3} staff on late shifts per day`,
      });

      // Add minimum working staff limit
      if (limits.minWorkingStaffPerDay !== undefined) {
        dailyLimitsArray.push({
          id: 'daily-limit-min-working',
          name: 'Minimum Working Staff Per Day',
          shiftType: 'working',
          minCount: limits.minWorkingStaffPerDay,  // This IS a minimum
          maxCount: 999,  // No upper limit for working staff
          constraints: {
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            scope: 'all',
            targetIds: [],
            isHardConstraint: true,
            penaltyWeight: 100,
          },
          description: `At least ${limits.minWorkingStaffPerDay} staff must work per day`,
        });
      }

      return dailyLimitsArray;
    }

    // OLD FORMAT: Array - transform for backward compatibility
    return limits.map((limit) => ({
      id: limit.id,
      name: limit.name,
      shiftType: limit.shiftType || limit.shift_type || "any",
      minCount: limit.minCount || limit.min_count || 0,  // ✅ NEW: MIN constraint
      maxCount: limit.maxCount || limit.max_count || 0,
      constraints: {
        daysOfWeek: limit.daysOfWeek || limit.days_of_week || [0, 1, 2, 3, 4, 5, 6],
        scope: limit.scope || "all",
        targetIds: limit.targetIds || limit.target_ids || [],
        isHardConstraint: limit.isHardConstraint ?? limit.is_hard_constraint ?? true,
        penaltyWeight: limit.penaltyWeight ?? limit.penalty_weight ?? 50,
      },
      description: limit.description || "",
    }));
  }, [settings?.dailyLimits]);

  /**
   * ✅ NEW: Transform weekly limits from database format to AI format
   * Weekly limits enforce rolling 7-day window constraints
   * Database: [{ id, name, shiftType, maxCount, limitConfig: {...} }]
   * AI: [{ id, name, shiftType, maxCount, windowSize: 7, constraints: {...} }]
   */
  const weeklyLimits = useMemo(() => {
    if (!settings?.weeklyLimits) return [];

    return settings.weeklyLimits
      .filter(limit => limit.isActive !== false) // ✅ FIX: Use camelCase (Go sends isActive)
      .map((limit) => ({
        id: limit.id,
        name: limit.name,
        // ✅ FIX: Go now extracts these from limitConfig to top level
        shiftType: limit.shiftType || "off",
        maxCount: limit.maxCount || 2,
        windowSize: limit.windowSize || 7, // Rolling 7-day window
        constraints: {
          daysOfWeek: limit.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
          scope: limit.scope || "all",
          targetIds: limit.targetIds || [],
          isHardConstraint: limit.isHardConstraint ?? true,
          penaltyWeight: limit.penaltyWeight ?? 50,
        },
        description: limit.description || "",
      }));
  }, [settings?.weeklyLimits]);

  /**
   * Transform monthly limits from database format to AI format
   * Database: [{ id, name, minCount, maxCount, limitType, excludeCalendarRules, ... }]
   * AI: [{ id, name, limitType, minCount, maxCount, excludeCalendarRules, ... }]
   *
   * ✅ FIX: Include minCount and all new fields from LimitsTab.jsx
   */
  const monthlyLimits = useMemo(() => {
    if (!settings?.monthlyLimits) return [];

    console.log('[useAISettings] Raw monthlyLimits from settings:', settings.monthlyLimits);

    return settings.monthlyLimits.map((limit) => ({
      id: limit.id,
      name: limit.name,
      limitType: limit.limitType || limit.limit_type || "off_days",
      // ✅ FIX: Include minCount (was missing!)
      minCount: limit.minCount ?? limit.min_count ?? null,
      maxCount: limit.maxCount ?? limit.max_count ?? 8,
      // ✅ FIX: Include new calendar integration fields
      excludeCalendarRules: limit.excludeCalendarRules ?? limit.exclude_calendar_rules ?? true,
      excludeEarlyShiftCalendar: limit.excludeEarlyShiftCalendar ?? limit.exclude_early_shift_calendar ?? true,
      overrideWeeklyLimits: limit.overrideWeeklyLimits ?? limit.override_weekly_limits ?? true,
      countHalfDays: limit.countHalfDays ?? limit.count_half_days ?? true,
      scope: limit.scope || "individual",
      targetIds: limit.targetIds || limit.target_ids || [],
      distribution: {
        maxConsecutive: limit.distributionRules?.maxConsecutive ||
                       limit.distribution_rules?.max_consecutive || 2,
        preferWeekends: limit.distributionRules?.preferWeekends ??
                       limit.distribution_rules?.prefer_weekends ?? false,
      },
      constraints: {
        isHardConstraint: limit.isHardConstraint ?? limit.is_hard_constraint ?? true,
        penaltyWeight: limit.penaltyWeight ?? limit.penalty_weight ?? 50,
      },
      description: limit.description || "",
    }));
  }, [settings?.monthlyLimits]);

  /**
   * Transform priority rules from database format to AI format
   * Database: [{ id, name, priority, ruleDefinition: { staff_id, conditions: {...} } }] or flat format
   * AI: [{ id, name, ruleType, staffId, preferences: {...} }]
   */
  const priorityRules = useMemo(() => {
    if (!settings?.priorityRules) return [];

    // Debug: Log raw priority rules to see what we're receiving
    console.log('🔍 [useAISettings] Raw priority rules from settings:',
      JSON.stringify(settings.priorityRules, null, 2).substring(0, 500));

    return settings.priorityRules.map((rule) => {
      // ✅ NEW: Extract staffIds array (multi-staff support) - prioritize TOP LEVEL first
      const staffIds =
        rule.staffIds ||             // ← TOP LEVEL (UI creates this for multi-staff)
        rule.staff_ids ||            // ← TOP LEVEL (snake_case variant)
        rule.ruleDefinition?.staff_ids ||  // ← Nested JSONB
        rule.ruleConfig?.staffIds ||
        rule.preferences?.staffIds ||
        null;

      // Extract legacy staffId (single-staff support) - for backward compatibility
      const staffId =
        rule.staffId ||              // ← TOP LEVEL (UI creates this)
        rule.staff_id ||             // ← TOP LEVEL (snake_case variant)
        rule.ruleDefinition?.staff_id ||  // ← Nested JSONB (database seed format)
        rule.ruleDefinition?.staffId ||
        rule.ruleConfig?.staffId ||
        rule.preferences?.staffId;   // ← After transformation fallback

      // Extract shiftType - prioritize TOP LEVEL properties first
      const shiftType =
        rule.shiftType ||            // ← TOP LEVEL (UI creates this)
        rule.shift_type ||           // ← TOP LEVEL (snake_case variant)
        rule.ruleDefinition?.conditions?.shift_type ||  // ← Nested JSONB
        rule.ruleDefinition?.shiftType ||
        rule.preferences?.shiftType;

      // Extract daysOfWeek - prioritize TOP LEVEL properties first
      const daysOfWeek =
        rule.daysOfWeek ||           // ← TOP LEVEL (UI creates this)
        rule.days_of_week ||         // ← TOP LEVEL (snake_case variant)
        rule.ruleDefinition?.conditions?.day_of_week ||  // ← Nested JSONB
        rule.ruleDefinition?.daysOfWeek ||
        rule.preferences?.daysOfWeek ||
        [];

      // ✅ NEW: Extract allowedShifts for avoid_shift_with_exceptions rule type
      const allowedShifts =
        rule.allowedShifts ||        // ← TOP LEVEL (UI creates this)
        rule.allowed_shifts ||       // ← TOP LEVEL (snake_case variant)
        rule.ruleDefinition?.allowedShifts ||  // ← Nested JSONB
        rule.ruleDefinition?.allowed_shifts ||
        rule.preferences?.allowedShifts ||
        [];

      // Debug: Log extraction results for first 2 rules
      if (settings.priorityRules.indexOf(rule) < 2) {
        console.log(`🔍 [useAISettings] Rule "${rule.name}" extraction:`, {
          staffId,
          staffIds, // ✅ NEW: Log multi-staff array
          shiftType,
          daysOfWeek,
          allowedShifts, // ✅ NEW: Log exception shifts
          sources: {
            topLevel_staffId: rule.staffId,
            topLevel_staffIds: rule.staffIds, // ✅ NEW
            topLevel_shiftType: rule.shiftType,
            topLevel_daysOfWeek: rule.daysOfWeek,
            topLevel_allowedShifts: rule.allowedShifts, // ✅ NEW
            nested_staffId: rule.ruleDefinition?.staff_id,
            nested_staffIds: rule.ruleDefinition?.staff_ids, // ✅ NEW
            nested_shiftType: rule.ruleDefinition?.conditions?.shift_type,
            nested_daysOfWeek: rule.ruleDefinition?.conditions?.day_of_week,
            nested_allowedShifts: rule.ruleDefinition?.allowedShifts // ✅ NEW
          }
        });
      }

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description || "",
        ruleType: rule.ruleType || rule.rule_type || "preferred_shift",
        staffId: staffId,  // Legacy single-staff support
        staffIds: staffIds, // ✅ NEW: Multi-staff support
        allowedShifts: allowedShifts, // ✅ NEW: Exception shifts for avoid_shift_with_exceptions
        preferences: {
          shiftType: shiftType,
          daysOfWeek: daysOfWeek,
          priorityLevel: rule.priorityLevel ?? rule.priority_level ?? 3,
          preferenceStrength: rule.preferenceStrength ?? rule.preference_strength ?? 0.8,
        },
        constraints: {
          isHardConstraint: rule.isHardConstraint ?? rule.is_hard_constraint ?? false,
          penaltyWeight: rule.penaltyWeight ?? rule.penalty_weight ?? 50,
        },
        validity: {
          effectiveFrom: rule.effectiveFrom || rule.effective_from,
          effectiveUntil: rule.effectiveUntil || rule.effective_until,
          isActive: rule.isActive ?? rule.is_active ?? true,
        },
      };
    });
  }, [settings?.priorityRules]);

  /**
   * ✅ NEW: OR-Tools Solver Configuration
   * Used by Python OR-Tools scheduler to configure penalty weights and solver settings
   * Database: { preset, penaltyWeights: {...}, solverSettings: {...}, hardConstraints: {...} }
   */
  const ortoolsConfig = useMemo(() => {
    const config = settings?.ortoolsConfig;

    // Default configuration
    const defaults = {
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
      // ✅ NEW: Hard constraints toggle (when true, constraints are strictly enforced)
      hardConstraints: {
        dailyLimits: false,
        monthlyLimits: false,
        staffGroups: false,
        fiveDayRest: false,
      },
    };

    if (!config) return defaults;

    return {
      preset: config.preset || defaults.preset,
      penaltyWeights: {
        staffGroup: config.penaltyWeights?.staffGroup ?? defaults.penaltyWeights.staffGroup,
        dailyLimitMin: config.penaltyWeights?.dailyLimitMin ?? defaults.penaltyWeights.dailyLimitMin,
        dailyLimitMax: config.penaltyWeights?.dailyLimitMax ?? defaults.penaltyWeights.dailyLimitMax,
        monthlyLimit: config.penaltyWeights?.monthlyLimit ?? defaults.penaltyWeights.monthlyLimit,
        adjacentConflict: config.penaltyWeights?.adjacentConflict ?? defaults.penaltyWeights.adjacentConflict,
        fiveDayRest: config.penaltyWeights?.fiveDayRest ?? defaults.penaltyWeights.fiveDayRest,
      },
      solverSettings: {
        timeout: config.solverSettings?.timeout ?? defaults.solverSettings.timeout,
        numWorkers: config.solverSettings?.numWorkers ?? defaults.solverSettings.numWorkers,
      },
      // ✅ NEW: Hard constraints toggle
      hardConstraints: {
        dailyLimits: config.hardConstraints?.dailyLimits ?? defaults.hardConstraints.dailyLimits,
        monthlyLimits: config.hardConstraints?.monthlyLimits ?? defaults.hardConstraints.monthlyLimits,
        staffGroups: config.hardConstraints?.staffGroups ?? defaults.hardConstraints.staffGroups,
        fiveDayRest: config.hardConstraints?.fiveDayRest ?? defaults.hardConstraints.fiveDayRest,
      },
    };
  }, [settings?.ortoolsConfig]);

  /**
   * ✅ NEW: Backup Staff Assignments
   * Maps backup staff to the groups they cover
   * Database: [{ id, staffId, groupId, ... }]
   * AI: [{ id, staffId, groupId, ... }]
   *
   * Business Logic:
   * - When ANY member of a group has day off (×), backup staff MUST work (○)
   * - When NO member of a group has day off, backup staff gets Unavailable (⊘)
   * - This is a HARD constraint in OR-Tools
   */
  const backupAssignments = useMemo(() => {
    if (!settings?.backupAssignments) return [];

    console.log('[useAISettings] Raw backupAssignments from settings:', settings.backupAssignments);

    return settings.backupAssignments.map((assignment) => ({
      id: assignment.id,
      staffId: assignment.staffId || assignment.staff_id,
      groupId: assignment.groupId || assignment.group_id,
      assignmentType: assignment.assignmentType || assignment.assignment_type || 'regular',
      priorityOrder: assignment.priorityOrder || assignment.priority_order || 1,
      isActive: assignment.isActive ?? assignment.is_active ?? true,
      effectiveFrom: assignment.effectiveFrom || assignment.effective_from,
      effectiveUntil: assignment.effectiveUntil || assignment.effective_until,
      notes: assignment.notes || '',
    }));
  }, [settings?.backupAssignments]);

  /**
   * ✅ NEW: Staff Type Daily Limits Configuration
   * Per-staff-type constraints for daily off/early limits
   * Database: { staffTypeLimits: { '社員': { maxOff: 1, maxEarly: 2, isHard: true }, ... } }
   *
   * Business Logic:
   * - For 社員 (n=6), max 1 off per day ensures adequate coverage
   * - Allows combinations like: (1 off + 1 early) or (0 off + 2 early)
   * - Prevents scenarios like: (2 off + 0 early) which reduces coverage too much
   */
  const staffTypeLimits = useMemo(() => {
    const config = settings?.staffTypeLimits;

    // Default configuration (no limits if not configured)
    const defaults = {};

    if (!config || Object.keys(config).length === 0) {
      console.log('[useAISettings] No staffTypeLimits configured');
      return defaults;
    }

    // Transform and validate each staff type limit
    const transformed = {};
    for (const [staffType, limits] of Object.entries(config)) {
      transformed[staffType] = {
        maxOff: limits.maxOff ?? null,           // null = no limit
        maxEarly: limits.maxEarly ?? null,       // null = no limit
        minNormal: limits.minNormal ?? null,     // null = no limit (minimum normal shifts)
        isHard: limits.isHard ?? true,           // default to HARD constraint
        penaltyWeight: limits.penaltyWeight ?? 60, // default penalty weight
      };
    }

    console.log('[useAISettings] ✅ Staff type limits loaded:', transformed);

    return transformed;
  }, [settings?.staffTypeLimits]);

  /**
   * Transform ML model configs from database format to AI format
   * Database: [{ id, modelType, hyperparameters: {...} }]
   * localStorage: { model_name, parameters: {...} }
   * AI: { modelName, modelType, parameters: {...} }
   */
  const mlConfig = useMemo(() => {
    // Handle both array format (database) and object format (localStorage)
    const mlData = settings?.mlModelConfigs?.[0] || settings?.mlParameters || {};

    return {
      modelName: mlData.model_name || mlData.modelName || "genetic_algorithm",
      modelType: mlData.model_type || mlData.modelType || "genetic_algorithm",
      parameters: {
        // Genetic Algorithm parameters
        populationSize: mlData.parameters?.populationSize ??
                       mlData.hyperparameters?.population_size ?? 100,
        generations: mlData.parameters?.generations ??
                    mlData.hyperparameters?.generations ?? 300,
        mutationRate: mlData.parameters?.mutationRate ??
                     mlData.hyperparameters?.mutation_rate ?? 0.1,
        crossoverRate: mlData.parameters?.crossoverRate ??
                      mlData.hyperparameters?.crossover_rate ?? 0.8,
        elitismRate: mlData.parameters?.elitismRate ??
                    mlData.hyperparameters?.elitism_rate ?? 0.1,
        convergenceThreshold: mlData.parameters?.convergenceThreshold ??
                             mlData.hyperparameters?.convergence_threshold ?? 0.001,
        maxRuntime: mlData.parameters?.maxRuntime ??
                   mlData.hyperparameters?.max_runtime ?? 300,
        enableAdaptiveMutation: mlData.parameters?.enableAdaptiveMutation ??
                               mlData.hyperparameters?.enable_adaptive_mutation ?? true,
        parallelProcessing: mlData.parameters?.parallelProcessing ??
                           mlData.hyperparameters?.parallel_processing ?? true,
        targetAccuracy: mlData.parameters?.targetAccuracy ??
                       mlData.hyperparameters?.target_accuracy ?? 0.85,
      },
      confidenceThreshold: mlData.confidence_threshold ??
                          mlData.confidenceThreshold ?? 0.75,
    };
  }, [settings?.mlModelConfigs, settings?.mlParameters]);

  /**
   * Get all active constraints (daily + monthly + priority rules)
   * Useful for AI algorithms to validate schedules
   */
  const allConstraints = useMemo(() => {
    return {
      daily: dailyLimits,
      dailyRaw: dailyLimitsRaw, // ✅ NEW: Raw object format for ConstraintEngine
      weekly: weeklyLimits, // ✅ NEW: Rolling 7-day window constraints
      monthly: monthlyLimits,
      priority: priorityRules.filter(rule => rule.validity.isActive),
    };
  }, [dailyLimits, dailyLimitsRaw, weeklyLimits, monthlyLimits, priorityRules]);

  /**
   * Get constraint weights for AI optimization
   * Auto-extracted from actual settings
   */
  const constraintWeights = useMemo(() => {
    const weights = {
      hardConstraints: [],
      softConstraints: [],
    };

    // Extract from daily limits
    dailyLimits.forEach(limit => {
      const weight = {
        id: limit.id,
        type: "daily",
        weight: limit.constraints.penaltyWeight,
        isHard: limit.constraints.isHardConstraint,
      };

      if (weight.isHard) {
        weights.hardConstraints.push(weight);
      } else {
        weights.softConstraints.push(weight);
      }
    });

    // ✅ NEW: Extract from weekly limits (rolling 7-day windows)
    weeklyLimits.forEach(limit => {
      const weight = {
        id: limit.id,
        type: "weekly",
        weight: limit.constraints.penaltyWeight,
        isHard: limit.constraints.isHardConstraint,
      };

      if (weight.isHard) {
        weights.hardConstraints.push(weight);
      } else {
        weights.softConstraints.push(weight);
      }
    });

    // Extract from monthly limits
    monthlyLimits.forEach(limit => {
      const weight = {
        id: limit.id,
        type: "monthly",
        weight: limit.constraints.penaltyWeight,
        isHard: limit.constraints.isHardConstraint,
      };

      if (weight.isHard) {
        weights.hardConstraints.push(weight);
      } else {
        weights.softConstraints.push(weight);
      }
    });

    // Extract from priority rules
    priorityRules.forEach(rule => {
      if (!rule.validity.isActive) return;

      const weight = {
        id: rule.id,
        type: "priority",
        weight: rule.constraints.penaltyWeight,
        isHard: rule.constraints.isHardConstraint,
      };

      if (weight.isHard) {
        weights.hardConstraints.push(weight);
      } else {
        weights.softConstraints.push(weight);
      }
    });

    return weights;
  }, [dailyLimits, monthlyLimits, priorityRules]);

  /**
   * Validate if AI system can operate with current settings
   * Returns validation result with warnings if any
   */
  const validateSettings = useCallback(() => {
    const warnings = [];
    const errors = [];

    // Check staff groups
    if (staffGroups.length === 0) {
      warnings.push("No staff groups configured");
    }

    // Check ML config
    if (!mlConfig.modelName) {
      errors.push("ML model not configured");
    }

    // Check constraints
    if (dailyLimits.length === 0 && monthlyLimits.length === 0) {
      warnings.push("No constraints configured - AI may generate unrealistic schedules");
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }, [staffGroups, mlConfig, dailyLimits, monthlyLimits]);

  /**
   * Get settings summary for AI logging
   */
  const getSettingsSummary = useCallback(() => {
    return {
      version: version?.versionNumber || "localStorage",
      versionName: version?.name || "Local Storage",
      backendMode,
      totalGroups: staffGroups.length,
      totalDailyLimits: dailyLimits.length,
      totalMonthlyLimits: monthlyLimits.length,
      totalPriorityRules: priorityRules.filter(r => r.validity.isActive).length,
      mlModel: mlConfig.modelName,
      hardConstraints: constraintWeights.hardConstraints.length,
      softConstraints: constraintWeights.softConstraints.length,
      // ✅ NEW: Daily limits summary for AI debugging
      dailyLimitsSource: dailyLimitsRaw._source,
      dailyLimitsConfig: {
        off: `${dailyLimitsRaw.minOffPerDay}-${dailyLimitsRaw.maxOffPerDay}`,
        early: `${dailyLimitsRaw.minEarlyPerDay}-${dailyLimitsRaw.maxEarlyPerDay}`,
        late: `${dailyLimitsRaw.minLatePerDay}-${dailyLimitsRaw.maxLatePerDay}`,
        minWorking: dailyLimitsRaw.minWorkingStaffPerDay,
      },
    };
  }, [version, backendMode, staffGroups, dailyLimits, dailyLimitsRaw, monthlyLimits,
      priorityRules, mlConfig, constraintWeights]);

  // Return AI-friendly interface
  return useMemo(() => {
    // Handle loading/error states
    if (!settings) {
      const loadingState = {
        staffGroups: [],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlConfig: {
          modelName: "genetic_algorithm",
          modelType: "genetic_algorithm",
          parameters: {},
          confidenceThreshold: 0.75,
        },
        allConstraints: { daily: [], monthly: [], priority: [] },
        constraintWeights: { hardConstraints: [], softConstraints: [] },
      };

      return {
        // Method for HybridPredictor interface
        getSettings: () => loadingState,

        // Properties for direct access (backward compatibility)
        isConnected: false,
        isLoading: true,
        error: null,
        ...loadingState,
        validateSettings: () => ({ isValid: false, warnings: [], errors: ["Settings not loaded"] }),
        getSettingsSummary: () => ({ backendMode: "loading" }),
        version: null,
        backendMode: "loading",
        hasSettings: false,
        updateSettings,
        rawSettings: null,
      };
    }

    // Create settings object for HybridPredictor
    const settingsData = {
      staffGroups,
      dailyLimits,
      dailyLimitsRaw, // ✅ NEW: Raw object format for ConstraintEngine
      weeklyLimits, // ✅ FIX: Include weekly limits in getSettings() return value
      monthlyLimits,
      priorityRules,
      mlConfig,
      ortoolsConfig, // ✅ NEW: OR-Tools solver configuration
      staffTypeLimits, // ✅ NEW: Per-staff-type daily limits
      backupAssignments, // ✅ NEW: Backup staff assignments for coverage
      allConstraints,
      constraintWeights,
    };

    return {
      // Method for HybridPredictor interface (required)
      getSettings: () => settingsData,

      // Properties for direct access (backward compatibility)
      staffGroups,
      dailyLimits,
      dailyLimitsRaw, // ✅ NEW: Raw object format for ConstraintEngine
      weeklyLimits, // ✅ NEW: Rolling 7-day window limits
      monthlyLimits,
      priorityRules,
      mlConfig,
      ortoolsConfig, // ✅ NEW: OR-Tools solver configuration
      staffTypeLimits, // ✅ NEW: Per-staff-type daily limits
      backupAssignments, // ✅ NEW: Backup staff assignments for coverage

      // Aggregated data
      allConstraints,
      constraintWeights,

      // State
      isLoading,
      isConnected: isConnectedToBackend || backendMode === "localStorage",
      error,

      // Backend info
      backendMode,
      version,

      // Helpers for AI systems
      hasSettings: staffGroups.length > 0 ||
                   dailyLimits.length > 0 ||
                   weeklyLimits.length > 0 || // ✅ NEW
                   monthlyLimits.length > 0 ||
                   priorityRules.length > 0,

      // Utilities
      validateSettings,
      getSettingsSummary,
      updateSettings, // Pass through for AI to update settings if needed

      // Raw settings (for backward compatibility)
      rawSettings: settings,
    };
  }, [
    settings,
    staffGroups,
    dailyLimits,
    dailyLimitsRaw, // ✅ NEW: Raw object format
    weeklyLimits, // ✅ NEW
    monthlyLimits,
    priorityRules,
    mlConfig,
    ortoolsConfig, // ✅ NEW: OR-Tools solver configuration
    staffTypeLimits, // ✅ NEW: Per-staff-type daily limits
    backupAssignments, // ✅ NEW: Backup staff assignments
    allConstraints,
    constraintWeights,
    isLoading,
    isConnectedToBackend,
    error,
    backendMode,
    version,
    validateSettings,
    getSettingsSummary,
    updateSettings,
  ]);
};

export default useAISettings;
