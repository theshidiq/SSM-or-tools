/**
 * AIConfigAdapter.js
 *
 * Data adapter for transforming database settings (snake_case PostgreSQL)
 * into AI-compatible configuration objects (camelCase JavaScript).
 *
 * Phase 2: Database Settings → AI Configuration Transformation
 *
 * Handles:
 * - Snake_case to camelCase conversion
 * - JSONB field extraction from PostgreSQL
 * - Nested configuration object flattening
 * - Default value management
 * - Version compatibility and migration
 */

/**
 * Default configurations for fallback scenarios
 */
const DEFAULT_AI_CONFIG = {
  staffGroups: {},
  dailyLimits: [],
  priorityRules: [],
  mlConfig: {
    learningRate: 0.001,
    epochs: 100,
    batchSize: 32,
    optimizer: 'adam',
    lossFunction: 'categoricalCrossentropy',
    validationSplit: 0.2,
  },
};

/**
 * Transform staff groups from database format to AI-compatible Map
 *
 * Database format:
 * [
 *   {
 *     id: "uuid-1",
 *     name: "Group 1",
 *     restaurant_id: "rest-1",
 *     group_config: {
 *       members: ["staff-id-1", "staff-id-2"],
 *       conflictsWith: ["group-2"],
 *       maxSimultaneousOff: 1,
 *       coverageRule: { ... }
 *     },
 *     is_active: true,
 *     created_at: "2025-01-01T00:00:00Z"
 *   }
 * ]
 *
 * AI format:
 * {
 *   "group-id-1": {
 *     id: "group-id-1",
 *     name: "Group 1",
 *     members: ["staff-id-1", "staff-id-2"],
 *     conflictsWith: ["group-2"],
 *     maxSimultaneousOff: 1,
 *     coverageRule: { ... }
 *   }
 * }
 *
 * @param {Array} dbStaffGroups - Staff groups from database
 * @returns {Object} Map of staff groups by ID
 */
export function transformStaffGroups(dbStaffGroups) {
  if (!dbStaffGroups || !Array.isArray(dbStaffGroups)) {
    console.warn('⚠️ AIConfigAdapter: Invalid staff groups input, using empty map');
    return {};
  }

  const groupMap = {};

  dbStaffGroups.forEach((group) => {
    try {
      // Skip soft-deleted groups
      if (group.is_active === false) {
        return;
      }

      const groupId = group.id;
      const groupConfig = group.group_config || {};

      // Extract members from nested JSONB field
      const members = groupConfig.members || [];
      const conflictsWith = groupConfig.conflictsWith || groupConfig.conflicts_with || [];

      // Build AI-compatible group object
      groupMap[groupId] = {
        id: groupId,
        name: group.name || `Group ${groupId}`,
        members: Array.isArray(members) ? [...members] : [],
        conflictsWith: Array.isArray(conflictsWith) ? [...conflictsWith] : [],

        // Conflict rules
        maxSimultaneousOff: groupConfig.maxSimultaneousOff ?? groupConfig.max_simultaneous_off ?? 1,
        maxSimultaneousEarly: groupConfig.maxSimultaneousEarly ?? groupConfig.max_simultaneous_early ?? 1,
        allowsConflict: groupConfig.allowsConflict ?? groupConfig.allows_conflict ?? false,

        // Coverage compensation rule
        coverageRule: groupConfig.coverageRule ? {
          backupStaff: groupConfig.coverageRule.backupStaff || groupConfig.coverageRule.backup_staff,
          requiredShift: groupConfig.coverageRule.requiredShift || groupConfig.coverageRule.required_shift || 'normal',
          description: groupConfig.coverageRule.description || '',
        } : null,

        // Proximity pattern
        proximityPattern: groupConfig.proximityPattern ? {
          trigger: groupConfig.proximityPattern.trigger,
          condition: groupConfig.proximityPattern.condition || 'weekday_off',
          target: groupConfig.proximityPattern.target,
          proximity: groupConfig.proximityPattern.proximity || 2,
          description: groupConfig.proximityPattern.description || '',
        } : null,

        // Metadata
        priority: groupConfig.priority || group.priority || 'medium',
        description: group.description || groupConfig.description || '',
        active: group.is_active !== false,
        color: group.color || groupConfig.color || '#3B82F6',
      };
    } catch (error) {
      console.error(`❌ AIConfigAdapter: Failed to transform staff group ${group.id}:`, error);
    }
  });

  console.log(`✅ AIConfigAdapter: Transformed ${Object.keys(groupMap).length} staff groups`);
  return groupMap;
}

/**
 * Transform daily limits from database format to AI-compatible array
 *
 * Database format:
 * [
 *   {
 *     id: "limit-1",
 *     name: "Maximum Off Days",
 *     limit_config: {
 *       type: "max_off_days",
 *       minStaff: null,
 *       maxStaff: 4,
 *       shiftType: "off",
 *       daysOfWeek: [0,1,2,3,4,5,6],
 *       penalty: 50
 *     },
 *     is_hard_constraint: true
 *   }
 * ]
 *
 * AI format (for ConstraintEngine):
 * [
 *   {
 *     name: "Maximum Off Days",
 *     type: "max_off_days",
 *     minStaff: null,
 *     maxStaff: 4,
 *     shiftType: "off",
 *     daysOfWeek: [0,1,2,3,4,5,6],
 *     penalty: 50,
 *     isHard: true
 *   }
 * ]
 *
 * @param {Array} dbDailyLimits - Daily limits from database
 * @returns {Array} AI-compatible daily limits array
 */
export function transformDailyLimits(dbDailyLimits) {
  if (!dbDailyLimits || !Array.isArray(dbDailyLimits)) {
    console.warn('⚠️ AIConfigAdapter: Invalid daily limits input, using defaults');
    return DEFAULT_AI_CONFIG.dailyLimits;
  }

  const limits = dbDailyLimits
    .filter(limit => limit.is_active !== false)
    .map((limit) => {
      try {
        const config = limit.limit_config || {};

        return {
          id: limit.id,
          name: limit.name || 'Unnamed Limit',
          type: config.type || limit.shift_type || 'custom',

          // Staff count constraints
          minStaff: config.minStaff ?? config.min_staff ?? null,
          maxStaff: config.maxStaff ?? config.max_staff ?? null,
          maxCount: config.maxCount ?? config.max_count ?? limit.max_count ?? null,

          // Shift type and scope
          shiftType: config.shiftType || config.shift_type || limit.shift_type || 'any',
          daysOfWeek: config.daysOfWeek || config.days_of_week || [0, 1, 2, 3, 4, 5, 6],
          scope: config.scope || limit.scope || 'all',
          targetIds: config.targetIds || config.target_ids || limit.target_ids || [],

          // Constraint properties
          isHard: limit.is_hard_constraint ?? config.isHardConstraint ?? true,
          penalty: config.penalty || config.penaltyWeight || config.penalty_weight || 50,
          weight: config.weight || config.penaltyWeight || config.penalty_weight || 50,

          // Additional metadata
          description: limit.description || config.description || '',
          enabled: limit.is_active !== false,
        };
      } catch (error) {
        console.error(`❌ AIConfigAdapter: Failed to transform daily limit ${limit.id}:`, error);
        return null;
      }
    })
    .filter(Boolean); // Remove nulls from failed transformations

  console.log(`✅ AIConfigAdapter: Transformed ${limits.length} daily limits`);
  return limits;
}

/**
 * Transform priority rules from database format to AI-compatible array
 *
 * Database format:
 * [
 *   {
 *     id: "rule-1",
 *     name: "Sunday Early Shift - Chef",
 *     priority: 10,
 *     rule_config: {
 *       conditions: {
 *         staffId: "staff-1",
 *         dayOfWeek: 0,
 *         shiftType: "early"
 *       },
 *       actions: {
 *         assignShift: "early",
 *         penaltyIfViolated: 100
 *       }
 *     },
 *     weight: 0.8
 *   }
 * ]
 *
 * AI format:
 * [
 *   {
 *     id: "rule-1",
 *     name: "Sunday Early Shift - Chef",
 *     priority: 10,
 *     conditions: { staffId: "staff-1", dayOfWeek: 0, shiftType: "early" },
 *     actions: { assignShift: "early", penaltyIfViolated: 100 },
 *     weight: 0.8
 *   }
 * ]
 *
 * @param {Array} dbPriorityRules - Priority rules from database
 * @returns {Array} AI-compatible priority rules array
 */
export function transformPriorityRules(dbPriorityRules) {
  if (!dbPriorityRules || !Array.isArray(dbPriorityRules)) {
    console.warn('⚠️ AIConfigAdapter: Invalid priority rules input, using defaults');
    return DEFAULT_AI_CONFIG.priorityRules;
  }

  const rules = dbPriorityRules
    .filter(rule => rule.is_active !== false)
    .map((rule) => {
      try {
        const config = rule.rule_config || {};

        return {
          id: rule.id,
          name: rule.name || 'Unnamed Rule',
          priority: rule.priority || 5,

          // Flatten nested config
          conditions: config.conditions || {},
          actions: config.actions || {},

          // Weights and penalties
          weight: rule.weight ?? config.weight ?? 0.5,
          penalty: config.penalty || config.penaltyIfViolated || 50,

          // Staff and shift targeting
          staffId: config.staffId || config.staff_id || rule.staff_id,
          shiftType: config.shiftType || config.shift_type,
          dayOfWeek: config.dayOfWeek ?? config.day_of_week,

          // Metadata
          description: rule.description || config.description || '',
          enabled: rule.is_active !== false,
        };
      } catch (error) {
        console.error(`❌ AIConfigAdapter: Failed to transform priority rule ${rule.id}:`, error);
        return null;
      }
    })
    .filter(Boolean);

  console.log(`✅ AIConfigAdapter: Transformed ${rules.length} priority rules`);
  return rules;
}

/**
 * Transform ML configuration from database format to AI-compatible object
 *
 * Database format:
 * [
 *   {
 *     id: "ml-config-1",
 *     model_type: "neural_network",
 *     hyperparameters: {
 *       learning_rate: 0.001,
 *       epochs: 100,
 *       batch_size: 32,
 *       optimizer: "adam"
 *     },
 *     training_config: {
 *       validation_split: 0.2,
 *       early_stopping: true
 *     }
 *   }
 * ]
 *
 * AI format:
 * {
 *   learningRate: 0.001,
 *   epochs: 100,
 *   batchSize: 32,
 *   optimizer: "adam",
 *   validationSplit: 0.2,
 *   earlyStoppingEnabled: true
 * }
 *
 * @param {Array} dbMLConfigs - ML configurations from database
 * @returns {Object} AI-compatible ML configuration object
 */
export function transformMLConfig(dbMLConfigs) {
  if (!dbMLConfigs || !Array.isArray(dbMLConfigs) || dbMLConfigs.length === 0) {
    console.warn('⚠️ AIConfigAdapter: No ML config found, using defaults');
    return DEFAULT_AI_CONFIG.mlConfig;
  }

  try {
    // Use first active config
    const activeConfig = dbMLConfigs.find(config => config.is_active !== false) || dbMLConfigs[0];

    const hyperparams = activeConfig.hyperparameters || {};
    const trainingConfig = activeConfig.training_config || {};

    const mlConfig = {
      // Model type
      modelType: activeConfig.model_type || 'neural_network',

      // Core hyperparameters (with snake_case fallbacks)
      learningRate: hyperparams.learning_rate ?? hyperparams.learningRate ?? 0.001,
      epochs: hyperparams.epochs ?? 100,
      batchSize: hyperparams.batch_size ?? hyperparams.batchSize ?? 32,
      optimizer: hyperparams.optimizer ?? 'adam',

      // Loss and metrics
      lossFunction: hyperparams.loss_function ?? hyperparams.lossFunction ?? 'categoricalCrossentropy',
      metrics: hyperparams.metrics ?? ['accuracy'],

      // Training configuration
      validationSplit: trainingConfig.validation_split ?? trainingConfig.validationSplit ?? 0.2,
      earlyStoppingEnabled: trainingConfig.early_stopping ?? trainingConfig.earlyStoppingEnabled ?? false,
      earlyStoppingPatience: trainingConfig.early_stopping_patience ?? trainingConfig.earlyStoppingPatience ?? 10,

      // Advanced settings
      dropout: hyperparams.dropout ?? 0.2,
      regularization: hyperparams.regularization ?? 'l2',
      regularizationRate: hyperparams.regularization_rate ?? hyperparams.regularizationRate ?? 0.01,

      // Neural network architecture (if applicable)
      hiddenLayers: hyperparams.hidden_layers ?? hyperparams.hiddenLayers ?? [128, 64, 32],
      activationFunction: hyperparams.activation_function ?? hyperparams.activationFunction ?? 'relu',

      // Metadata
      version: activeConfig.version || '1.0.0',
      description: activeConfig.description || '',
    };

    console.log(`✅ AIConfigAdapter: Transformed ML config for model type: ${mlConfig.modelType}`);
    return mlConfig;
  } catch (error) {
    console.error('❌ AIConfigAdapter: Failed to transform ML config:', error);
    return DEFAULT_AI_CONFIG.mlConfig;
  }
}

/**
 * Transform monthly limits from database format to AI-compatible array
 *
 * @param {Array} dbMonthlyLimits - Monthly limits from database
 * @returns {Array} AI-compatible monthly limits array
 */
export function transformMonthlyLimits(dbMonthlyLimits) {
  if (!dbMonthlyLimits || !Array.isArray(dbMonthlyLimits)) {
    console.warn('⚠️ AIConfigAdapter: Invalid monthly limits input, using defaults');
    return [];
  }

  const limits = dbMonthlyLimits
    .filter(limit => limit.is_active !== false)
    .map((limit) => {
      try {
        const config = limit.limit_config || {};

        return {
          id: limit.id,
          name: limit.name || 'Unnamed Monthly Limit',
          limitType: config.limitType || config.limit_type || limit.limit_type || 'max_off_days',

          // Count constraints
          maxCount: config.maxCount ?? config.max_count ?? limit.max_count ?? 8,
          minCount: config.minCount ?? config.min_count ?? null,

          // Scope and targeting
          scope: config.scope || limit.scope || 'individual',
          targetIds: config.targetIds || config.target_ids || limit.target_ids || [],

          // Distribution rules
          distributionRules: config.distributionRules || config.distribution_rules || {
            maxConsecutive: 2,
            preferWeekends: false,
          },

          // Constraint properties
          isHard: limit.is_hard_constraint ?? config.isHardConstraint ?? false,
          penalty: config.penalty || config.penaltyWeight || config.penalty_weight || 40,

          // Metadata
          description: limit.description || config.description || '',
          enabled: limit.is_active !== false,
        };
      } catch (error) {
        console.error(`❌ AIConfigAdapter: Failed to transform monthly limit ${limit.id}:`, error);
        return null;
      }
    })
    .filter(Boolean);

  console.log(`✅ AIConfigAdapter: Transformed ${limits.length} monthly limits`);
  return limits;
}

/**
 * Main transformation function: Create unified AI configuration from database settings
 *
 * This is the primary entry point for transforming WebSocket/database settings
 * into AI-compatible configuration format.
 *
 * @param {Object} settings - Raw settings from database (WebSocket message)
 * @param {Array} settings.staffGroups - Staff groups array
 * @param {Array} settings.dailyLimits - Daily limits array
 * @param {Array} settings.monthlyLimits - Monthly limits array
 * @param {Array} settings.priorityRules - Priority rules array
 * @param {Array} settings.mlModelConfigs - ML model configurations array
 * @returns {Object} Unified AI configuration object
 */
export function createAIConfiguration(settings) {
  if (!settings || typeof settings !== 'object') {
    console.error('❌ AIConfigAdapter: Invalid settings object, using defaults');
    return DEFAULT_AI_CONFIG;
  }

  console.log('🔄 AIConfigAdapter: Transforming database settings to AI configuration...');

  try {
    const aiConfig = {
      // Staff groups (Map format for quick lookup)
      staffGroups: transformStaffGroups(settings.staffGroups),

      // Daily limits (Array format for constraint engine)
      dailyLimits: transformDailyLimits(settings.dailyLimits),

      // Monthly limits (Array format)
      monthlyLimits: transformMonthlyLimits(settings.monthlyLimits),

      // Priority rules (Array format sorted by priority)
      priorityRules: transformPriorityRules(settings.priorityRules).sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      ),

      // ML configuration (Object format)
      mlConfig: transformMLConfig(settings.mlModelConfigs),

      // Metadata
      version: settings.version || {
        versionNumber: 1,
        name: 'v1.0',
        timestamp: new Date().toISOString(),
      },

      // Timestamps
      transformedAt: new Date().toISOString(),
    };

    console.log('✅ AIConfigAdapter: Configuration transformation complete');
    console.log(`  - Staff Groups: ${Object.keys(aiConfig.staffGroups).length}`);
    console.log(`  - Daily Limits: ${aiConfig.dailyLimits.length}`);
    console.log(`  - Monthly Limits: ${aiConfig.monthlyLimits.length}`);
    console.log(`  - Priority Rules: ${aiConfig.priorityRules.length}`);
    console.log(`  - ML Model: ${aiConfig.mlConfig.modelType}`);

    return aiConfig;
  } catch (error) {
    console.error('❌ AIConfigAdapter: Critical error during transformation:', error);
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Validate transformed AI configuration
 *
 * @param {Object} aiConfig - AI configuration object
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 */
export function validateAIConfiguration(aiConfig) {
  const errors = [];

  // Validate staff groups
  if (!aiConfig.staffGroups || typeof aiConfig.staffGroups !== 'object') {
    errors.push('Invalid staffGroups: must be an object');
  } else {
    Object.entries(aiConfig.staffGroups).forEach(([id, group]) => {
      if (!Array.isArray(group.members)) {
        errors.push(`Staff group ${id}: members must be an array`);
      }
    });
  }

  // Validate daily limits
  if (!Array.isArray(aiConfig.dailyLimits)) {
    errors.push('Invalid dailyLimits: must be an array');
  } else {
    aiConfig.dailyLimits.forEach((limit, index) => {
      if (!limit.name) {
        errors.push(`Daily limit ${index}: missing name`);
      }
      if (limit.maxStaff !== null && limit.maxStaff !== undefined && limit.maxStaff < 0) {
        errors.push(`Daily limit ${limit.name}: maxStaff cannot be negative`);
      }
    });
  }

  // Validate priority rules
  if (!Array.isArray(aiConfig.priorityRules)) {
    errors.push('Invalid priorityRules: must be an array');
  }

  // Validate ML config
  if (!aiConfig.mlConfig || typeof aiConfig.mlConfig !== 'object') {
    errors.push('Invalid mlConfig: must be an object');
  } else {
    if (typeof aiConfig.mlConfig.learningRate !== 'number' || aiConfig.mlConfig.learningRate <= 0) {
      errors.push('ML config: learningRate must be a positive number');
    }
    if (typeof aiConfig.mlConfig.epochs !== 'number' || aiConfig.mlConfig.epochs <= 0) {
      errors.push('ML config: epochs must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper: Convert camelCase to snake_case
 *
 * @param {string} str - CamelCase string
 * @returns {string} snake_case string
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Helper: Convert snake_case to camelCase
 *
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Helper: Deep transform object keys from snake_case to camelCase
 *
 * @param {Object} obj - Object with snake_case keys
 * @returns {Object} Object with camelCase keys
 */
export function transformKeysToCamel(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeysToCamel);

  const transformed = {};
  Object.entries(obj).forEach(([key, value]) => {
    const camelKey = snakeToCamel(key);
    transformed[camelKey] = transformKeysToCamel(value);
  });

  return transformed;
}

/**
 * Helper: Deep transform object keys from camelCase to snake_case
 *
 * @param {Object} obj - Object with camelCase keys
 * @returns {Object} Object with snake_case keys
 */
export function transformKeysToSnake(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeysToSnake);

  const transformed = {};
  Object.entries(obj).forEach(([key, value]) => {
    const snakeKey = camelToSnake(key);
    transformed[snakeKey] = transformKeysToSnake(value);
  });

  return transformed;
}

// Export default configuration for testing
export { DEFAULT_AI_CONFIG };
