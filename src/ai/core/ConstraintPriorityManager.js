/**
 * Constraint Priority Manager
 *
 * Defines a unified priority system for all scheduling constraints.
 * Provides clear hierarchy and conflict resolution strategies.
 *
 * Phase 2 of AI Generation Consistency Plan
 */

/**
 * Constraint Priority Tiers
 *
 * Tier 1 (MUST ENFORCE) - Hard constraints that MUST NEVER be violated
 * Tier 2 (SHOULD ENFORCE) - Important constraints that should be satisfied
 * Tier 3 (OPTIMIZE) - Soft constraints for quality optimization
 */
export const CONSTRAINT_TIERS = {
  TIER_1_MUST: 1,    // Hard constraints - never violate
  TIER_2_SHOULD: 2,  // Important constraints - minimize violations
  TIER_3_OPTIMIZE: 3 // Soft constraints - best effort
};

/**
 * Constraint Definitions with Priority
 */
export const CONSTRAINT_REGISTRY = {
  // ===== TIER 1: MUST ENFORCE (Hard Constraints) =====
  CALENDAR_MUST_WORK: {
    id: 'calendar_must_work',
    name: 'Calendar Must Work Dates',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 1,
    description: 'All staff must work on must_work calendar dates',
    category: 'calendar',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  CALENDAR_MUST_DAY_OFF: {
    id: 'calendar_must_day_off',
    name: 'Calendar Must Day Off Dates',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 2,
    description: 'Staff must have day off (or early shift if eligible) on must_day_off dates',
    category: 'calendar',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  EARLY_SHIFT_PERMISSION: {
    id: 'early_shift_permission',
    name: 'Early Shift Permission',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 3,
    description: 'Only staff with permission can be assigned early shifts',
    category: 'permissions',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  CONSECUTIVE_WORK_LIMIT: {
    id: 'consecutive_work_limit',
    name: 'Consecutive Work Day Limit',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 4,
    description: 'Staff cannot work more than 5 consecutive days (user requirement)',
    category: 'labor_law',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  MONTHLY_WORK_LIMIT: {
    id: 'monthly_work_limit',
    name: 'Monthly Work Day Limits',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 5,
    description: 'Staff must not exceed monthly work/off day limits',
    category: 'limits',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'high'
  },

  DAILY_MINIMUM_COVERAGE: {
    id: 'daily_minimum_coverage',
    name: 'Daily Minimum Coverage',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 6,
    description: 'Minimum number of staff required per day',
    category: 'coverage',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  STAFF_GROUP_CONFLICTS: {
    id: 'staff_group_conflicts',
    name: 'Staff Group Conflicts',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 7,
    description: 'Conflicting staff groups cannot have day off on same date',
    category: 'conflicts',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'high'
  },

  // ===== TIER 2: SHOULD ENFORCE (Important Constraints) =====
  WEEKLY_ROLLING_LIMITS: {
    id: 'weekly_rolling_limits',
    name: 'Weekly Rolling Limits',
    tier: CONSTRAINT_TIERS.TIER_2_SHOULD,
    priority: 8,
    description: 'Weekly limits for off days/early shifts in rolling 7-day windows',
    category: 'limits',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'medium'
  },

  ADJACENT_CONFLICT_PREVENTION: {
    id: 'adjacent_conflict',
    name: 'Adjacent Conflict Prevention',
    tier: CONSTRAINT_TIERS.TIER_2_SHOULD,
    priority: 9,
    description: 'Prevent same shift type on consecutive days',
    category: 'conflicts',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'low'
  },

  FIVE_DAY_REST_RULE: {
    id: 'five_day_rest',
    name: 'Five Day Rest Rule',
    tier: CONSTRAINT_TIERS.TIER_1_MUST,
    priority: 8,
    description: 'Staff MUST have at least 1 day off every 5 days (enforces 5-day work limit)',
    category: 'rest',
    isHardConstraint: true,
    canOverride: false,
    violationSeverity: 'critical'
  },

  PRIORITY_RULES: {
    id: 'priority_rules',
    name: 'Dynamic Priority Rules',
    tier: CONSTRAINT_TIERS.TIER_2_SHOULD,
    priority: 11,
    description: 'User-defined priority rules for specific staff/dates',
    category: 'priority',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'medium'
  },

  BACKUP_STAFF_ASSIGNMENT: {
    id: 'backup_staff',
    name: 'Backup Staff Assignment',
    tier: CONSTRAINT_TIERS.TIER_2_SHOULD,
    priority: 12,
    description: 'Ensure backup staff coverage for critical roles',
    category: 'coverage',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'medium'
  },

  // ===== TIER 3: OPTIMIZE (Soft Constraints) =====
  FAIR_DISTRIBUTION: {
    id: 'fair_distribution',
    name: 'Fair Shift Distribution',
    tier: CONSTRAINT_TIERS.TIER_3_OPTIMIZE,
    priority: 13,
    description: 'Distribute shifts fairly among staff',
    category: 'optimization',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'low'
  },

  PATTERN_CONSISTENCY: {
    id: 'pattern_consistency',
    name: 'Pattern Consistency',
    tier: CONSTRAINT_TIERS.TIER_3_OPTIMIZE,
    priority: 14,
    description: 'Maintain consistent shift patterns for each staff member',
    category: 'optimization',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'low'
  },

  STAFF_SATISFACTION: {
    id: 'staff_satisfaction',
    name: 'Staff Satisfaction',
    tier: CONSTRAINT_TIERS.TIER_3_OPTIMIZE,
    priority: 15,
    description: 'Optimize for staff preferences and satisfaction',
    category: 'optimization',
    isHardConstraint: false,
    canOverride: true,
    violationSeverity: 'low'
  }
};

/**
 * Constraint Priority Manager Class
 */
export class ConstraintPriorityManager {
  /**
   * Get all constraints sorted by priority
   * @returns {Array} Sorted array of constraints
   */
  static getAllConstraintsSorted() {
    return Object.values(CONSTRAINT_REGISTRY).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get constraints by tier
   * @param {number} tier - Tier number (1, 2, or 3)
   * @returns {Array} Constraints in this tier
   */
  static getConstraintsByTier(tier) {
    return Object.values(CONSTRAINT_REGISTRY).filter(c => c.tier === tier);
  }

  /**
   * Get Tier 1 (MUST ENFORCE) constraints
   * @returns {Array} Tier 1 constraints
   */
  static getTier1Constraints() {
    return this.getConstraintsByTier(CONSTRAINT_TIERS.TIER_1_MUST);
  }

  /**
   * Get Tier 2 (SHOULD ENFORCE) constraints
   * @returns {Array} Tier 2 constraints
   */
  static getTier2Constraints() {
    return this.getConstraintsByTier(CONSTRAINT_TIERS.TIER_2_SHOULD);
  }

  /**
   * Get Tier 3 (OPTIMIZE) constraints
   * @returns {Array} Tier 3 constraints
   */
  static getTier3Constraints() {
    return this.getConstraintsByTier(CONSTRAINT_TIERS.TIER_3_OPTIMIZE);
  }

  /**
   * Get constraint definition by ID
   * @param {string} constraintId - Constraint identifier
   * @returns {Object|null} Constraint definition
   */
  static getConstraint(constraintId) {
    return Object.values(CONSTRAINT_REGISTRY).find(c => c.id === constraintId) || null;
  }

  /**
   * Check if a constraint is a hard constraint
   * @param {string} constraintId - Constraint identifier
   * @returns {boolean} True if hard constraint
   */
  static isHardConstraint(constraintId) {
    const constraint = this.getConstraint(constraintId);
    return constraint ? constraint.isHardConstraint : false;
  }

  /**
   * Resolve conflict between two constraints
   * @param {string} constraintId1 - First constraint ID
   * @param {string} constraintId2 - Second constraint ID
   * @returns {string} ID of the winning constraint (higher priority)
   */
  static resolveConflict(constraintId1, constraintId2) {
    const c1 = this.getConstraint(constraintId1);
    const c2 = this.getConstraint(constraintId2);

    if (!c1) return constraintId2;
    if (!c2) return constraintId1;

    // Lower priority number = higher priority
    return c1.priority < c2.priority ? constraintId1 : constraintId2;
  }

  /**
   * Get severity level for a constraint violation
   * @param {string} constraintId - Constraint identifier
   * @returns {string} Severity level (critical, high, medium, low)
   */
  static getViolationSeverity(constraintId) {
    const constraint = this.getConstraint(constraintId);
    return constraint ? constraint.violationSeverity : 'low';
  }

  /**
   * Check if a constraint can be overridden
   * @param {string} constraintId - Constraint identifier
   * @returns {boolean} True if can be overridden
   */
  static canOverride(constraintId) {
    const constraint = this.getConstraint(constraintId);
    return constraint ? constraint.canOverride : false;
  }

  /**
   * Get summary of constraint hierarchy
   * @returns {Object} Summary statistics
   */
  static getHierarchySummary() {
    const tier1 = this.getTier1Constraints();
    const tier2 = this.getTier2Constraints();
    const tier3 = this.getTier3Constraints();

    return {
      totalConstraints: Object.keys(CONSTRAINT_REGISTRY).length,
      tier1Count: tier1.length,
      tier2Count: tier2.length,
      tier3Count: tier3.length,
      hardConstraints: tier1.length,
      softConstraints: tier2.length + tier3.length,
      criticalViolations: tier1.filter(c => c.violationSeverity === 'critical').length
    };
  }

  /**
   * Validate a schedule against all constraints
   * @param {Object} schedule - Schedule to validate
   * @param {Object} context - Validation context (rules, preferences, staff, etc.)
   * @returns {Object} Validation result with violations by tier
   */
  static validateSchedule(schedule, context) {
    const violations = {
      tier1: [],
      tier2: [],
      tier3: [],
      summary: {
        tier1Count: 0,
        tier2Count: 0,
        tier3Count: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
      }
    };

    // This is a placeholder - actual validation logic would go here
    // In practice, this would call the respective validation functions

    return violations;
  }

  /**
   * Log constraint hierarchy for debugging
   */
  static logHierarchy() {
    console.log('📊 [ConstraintPriority] Constraint Hierarchy:');
    console.log('');
    console.log('=== TIER 1: MUST ENFORCE (Hard Constraints) ===');
    this.getTier1Constraints().forEach(c => {
      console.log(`  ${c.priority}. [${c.id}] ${c.name} - ${c.description}`);
    });
    console.log('');
    console.log('=== TIER 2: SHOULD ENFORCE (Important Constraints) ===');
    this.getTier2Constraints().forEach(c => {
      console.log(`  ${c.priority}. [${c.id}] ${c.name} - ${c.description}`);
    });
    console.log('');
    console.log('=== TIER 3: OPTIMIZE (Soft Constraints) ===');
    this.getTier3Constraints().forEach(c => {
      console.log(`  ${c.priority}. [${c.id}] ${c.name} - ${c.description}`);
    });
    console.log('');
    console.log(`Total: ${Object.keys(CONSTRAINT_REGISTRY).length} constraints`);
  }
}

export default ConstraintPriorityManager;
