/**
 * AI Adapters Module
 *
 * Export all adapter functions for data transformation between
 * database/WebSocket formats and AI system formats.
 */

export {
  // Main transformation functions
  transformStaffGroups,
  transformDailyLimits,
  transformMonthlyLimits,
  transformPriorityRules,
  transformMLConfig,
  createAIConfiguration,
  validateAIConfiguration,

  // Utility functions
  camelToSnake,
  snakeToCamel,
  transformKeysToCamel,
  transformKeysToSnake,

  // Default configuration
  DEFAULT_AI_CONFIG,
} from './AIConfigAdapter';

// Re-export test examples for development/debugging
export {
  exampleStaffGroupsTransformation,
  exampleDailyLimitsTransformation,
  examplePriorityRulesTransformation,
  exampleMLConfigTransformation,
  exampleCompleteTransformation,
  exampleKeyTransformations,
  runAllExamples,
} from './AIConfigAdapter.test';
