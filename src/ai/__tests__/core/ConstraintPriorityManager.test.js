/**
 * Unit Tests for ConstraintPriorityManager
 * Tests Phase 2 constraint priority system
 */

import {
  ConstraintPriorityManager,
  CONSTRAINT_REGISTRY,
  CONSTRAINT_TIERS
} from '../../core/ConstraintPriorityManager';

describe('ConstraintPriorityManager', () => {
  describe('Constraint Registry', () => {
    it('should have 15 total constraints defined', () => {
      const allConstraints = Object.values(CONSTRAINT_REGISTRY);
      expect(allConstraints).toHaveLength(15);
    });

    it('should have unique priority numbers', () => {
      const priorities = Object.values(CONSTRAINT_REGISTRY).map(c => c.priority);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    });

    it('should have unique constraint IDs', () => {
      const ids = Object.values(CONSTRAINT_REGISTRY).map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have 7 Tier 1 constraints', () => {
      const tier1 = Object.values(CONSTRAINT_REGISTRY).filter(
        c => c.tier === CONSTRAINT_TIERS.TIER_1_MUST
      );
      expect(tier1).toHaveLength(7);
    });

    it('should have 5 Tier 2 constraints', () => {
      const tier2 = Object.values(CONSTRAINT_REGISTRY).filter(
        c => c.tier === CONSTRAINT_TIERS.TIER_2_SHOULD
      );
      expect(tier2).toHaveLength(5);
    });

    it('should have 3 Tier 3 constraints', () => {
      const tier3 = Object.values(CONSTRAINT_REGISTRY).filter(
        c => c.tier === CONSTRAINT_TIERS.TIER_3_OPTIMIZE
      );
      expect(tier3).toHaveLength(3);
    });

    it('should mark all Tier 1 constraints as hard constraints', () => {
      const tier1 = Object.values(CONSTRAINT_REGISTRY).filter(
        c => c.tier === CONSTRAINT_TIERS.TIER_1_MUST
      );

      tier1.forEach(constraint => {
        expect(constraint.isHardConstraint).toBe(true);
        expect(constraint.canOverride).toBe(false);
      });
    });

    it('should mark Tier 2 and 3 constraints as soft constraints', () => {
      const softTiers = Object.values(CONSTRAINT_REGISTRY).filter(
        c => c.tier === CONSTRAINT_TIERS.TIER_2_SHOULD || c.tier === CONSTRAINT_TIERS.TIER_3_OPTIMIZE
      );

      softTiers.forEach(constraint => {
        expect(constraint.isHardConstraint).toBe(false);
        expect(constraint.canOverride).toBe(true);
      });
    });
  });

  describe('getAllConstraintsSorted', () => {
    it('should return all constraints sorted by priority', () => {
      const sorted = ConstraintPriorityManager.getAllConstraintsSorted();

      expect(sorted).toHaveLength(15);

      // Check priority ordering
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].priority).toBeGreaterThanOrEqual(sorted[i - 1].priority);
      }
    });

    it('should have calendar_must_work as first (highest priority)', () => {
      const sorted = ConstraintPriorityManager.getAllConstraintsSorted();
      expect(sorted[0].id).toBe('calendar_must_work');
      expect(sorted[0].priority).toBe(1);
    });

    it('should have staff_satisfaction as last (lowest priority)', () => {
      const sorted = ConstraintPriorityManager.getAllConstraintsSorted();
      const last = sorted[sorted.length - 1];
      expect(last.id).toBe('staff_satisfaction');
      expect(last.priority).toBe(15);
    });
  });

  describe('getConstraintsByTier', () => {
    it('should return Tier 1 constraints correctly', () => {
      const tier1 = ConstraintPriorityManager.getConstraintsByTier(CONSTRAINT_TIERS.TIER_1_MUST);
      expect(tier1).toHaveLength(7);
      tier1.forEach(c => expect(c.tier).toBe(CONSTRAINT_TIERS.TIER_1_MUST));
    });

    it('should return Tier 2 constraints correctly', () => {
      const tier2 = ConstraintPriorityManager.getConstraintsByTier(CONSTRAINT_TIERS.TIER_2_SHOULD);
      expect(tier2).toHaveLength(5);
      tier2.forEach(c => expect(c.tier).toBe(CONSTRAINT_TIERS.TIER_2_SHOULD));
    });

    it('should return Tier 3 constraints correctly', () => {
      const tier3 = ConstraintPriorityManager.getConstraintsByTier(CONSTRAINT_TIERS.TIER_3_OPTIMIZE);
      expect(tier3).toHaveLength(3);
      tier3.forEach(c => expect(c.tier).toBe(CONSTRAINT_TIERS.TIER_3_OPTIMIZE));
    });
  });

  describe('getTier1Constraints', () => {
    it('should return all Tier 1 (MUST ENFORCE) constraints', () => {
      const tier1 = ConstraintPriorityManager.getTier1Constraints();
      expect(tier1).toHaveLength(7);

      const expectedIds = [
        'calendar_must_work',
        'calendar_must_day_off',
        'early_shift_permission',
        'consecutive_work_limit',
        'monthly_work_limit',
        'daily_minimum_coverage',
        'staff_group_conflicts'
      ];

      const actualIds = tier1.map(c => c.id);
      expectedIds.forEach(id => {
        expect(actualIds).toContain(id);
      });
    });
  });

  describe('getTier2Constraints', () => {
    it('should return all Tier 2 (SHOULD ENFORCE) constraints', () => {
      const tier2 = ConstraintPriorityManager.getTier2Constraints();
      expect(tier2).toHaveLength(5);

      const expectedIds = [
        'weekly_rolling_limits',
        'adjacent_conflict',
        'five_day_rest',
        'priority_rules',
        'backup_staff'
      ];

      const actualIds = tier2.map(c => c.id);
      expectedIds.forEach(id => {
        expect(actualIds).toContain(id);
      });
    });
  });

  describe('getTier3Constraints', () => {
    it('should return all Tier 3 (OPTIMIZE) constraints', () => {
      const tier3 = ConstraintPriorityManager.getTier3Constraints();
      expect(tier3).toHaveLength(3);

      const expectedIds = [
        'fair_distribution',
        'pattern_consistency',
        'staff_satisfaction'
      ];

      const actualIds = tier3.map(c => c.id);
      expectedIds.forEach(id => {
        expect(actualIds).toContain(id);
      });
    });
  });

  describe('getConstraint', () => {
    it('should return constraint by ID', () => {
      const constraint = ConstraintPriorityManager.getConstraint('calendar_must_work');

      expect(constraint).toBeDefined();
      expect(constraint.id).toBe('calendar_must_work');
      expect(constraint.priority).toBe(1);
      expect(constraint.tier).toBe(CONSTRAINT_TIERS.TIER_1_MUST);
    });

    it('should return null for non-existent constraint', () => {
      const constraint = ConstraintPriorityManager.getConstraint('nonexistent_constraint');
      expect(constraint).toBeNull();
    });
  });

  describe('isHardConstraint', () => {
    it('should identify hard constraints correctly', () => {
      expect(ConstraintPriorityManager.isHardConstraint('calendar_must_work')).toBe(true);
      expect(ConstraintPriorityManager.isHardConstraint('early_shift_permission')).toBe(true);
      expect(ConstraintPriorityManager.isHardConstraint('consecutive_work_limit')).toBe(true);
    });

    it('should identify soft constraints correctly', () => {
      expect(ConstraintPriorityManager.isHardConstraint('weekly_rolling_limits')).toBe(false);
      expect(ConstraintPriorityManager.isHardConstraint('fair_distribution')).toBe(false);
      expect(ConstraintPriorityManager.isHardConstraint('staff_satisfaction')).toBe(false);
    });

    it('should return false for non-existent constraint', () => {
      expect(ConstraintPriorityManager.isHardConstraint('nonexistent')).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve calendar_must_work over early_shift_permission', () => {
      const winner = ConstraintPriorityManager.resolveConflict(
        'calendar_must_work',
        'early_shift_permission'
      );
      expect(winner).toBe('calendar_must_work'); // Priority 1 > Priority 3
    });

    it('should resolve early_shift_permission over weekly_rolling_limits', () => {
      const winner = ConstraintPriorityManager.resolveConflict(
        'early_shift_permission',
        'weekly_rolling_limits'
      );
      expect(winner).toBe('early_shift_permission'); // Priority 3 > Priority 8
    });

    it('should resolve Tier 1 over Tier 2 constraints', () => {
      const winner = ConstraintPriorityManager.resolveConflict(
        'consecutive_work_limit',
        'priority_rules'
      );
      expect(winner).toBe('consecutive_work_limit'); // Priority 4 > Priority 11
    });

    it('should handle non-existent constraints gracefully', () => {
      const winner1 = ConstraintPriorityManager.resolveConflict(
        'nonexistent',
        'calendar_must_work'
      );
      expect(winner1).toBe('calendar_must_work');

      const winner2 = ConstraintPriorityManager.resolveConflict(
        'calendar_must_work',
        'nonexistent'
      );
      expect(winner2).toBe('calendar_must_work');
    });
  });

  describe('getViolationSeverity', () => {
    it('should return critical severity for Tier 1 constraints', () => {
      expect(ConstraintPriorityManager.getViolationSeverity('calendar_must_work')).toBe('critical');
      expect(ConstraintPriorityManager.getViolationSeverity('early_shift_permission')).toBe('critical');
    });

    it('should return appropriate severity for different constraints', () => {
      expect(ConstraintPriorityManager.getViolationSeverity('weekly_rolling_limits')).toBe('medium');
      expect(ConstraintPriorityManager.getViolationSeverity('fair_distribution')).toBe('low');
    });

    it('should return low severity for non-existent constraint', () => {
      expect(ConstraintPriorityManager.getViolationSeverity('nonexistent')).toBe('low');
    });
  });

  describe('canOverride', () => {
    it('should not allow overriding Tier 1 constraints', () => {
      expect(ConstraintPriorityManager.canOverride('calendar_must_work')).toBe(false);
      expect(ConstraintPriorityManager.canOverride('early_shift_permission')).toBe(false);
    });

    it('should allow overriding Tier 2 and 3 constraints', () => {
      expect(ConstraintPriorityManager.canOverride('weekly_rolling_limits')).toBe(true);
      expect(ConstraintPriorityManager.canOverride('fair_distribution')).toBe(true);
    });

    it('should return false for non-existent constraint', () => {
      expect(ConstraintPriorityManager.canOverride('nonexistent')).toBe(false);
    });
  });

  describe('getHierarchySummary', () => {
    it('should return correct hierarchy statistics', () => {
      const summary = ConstraintPriorityManager.getHierarchySummary();

      expect(summary.totalConstraints).toBe(15);
      expect(summary.tier1Count).toBe(7);
      expect(summary.tier2Count).toBe(5);
      expect(summary.tier3Count).toBe(3);
      expect(summary.hardConstraints).toBe(7);
      expect(summary.softConstraints).toBe(8); // Tier 2 + Tier 3
    });

    it('should count critical violations correctly', () => {
      const summary = ConstraintPriorityManager.getHierarchySummary();

      // Count constraints with critical severity
      const tier1 = ConstraintPriorityManager.getTier1Constraints();
      const criticalCount = tier1.filter(c => c.violationSeverity === 'critical').length;

      expect(summary.criticalViolations).toBe(criticalCount);
    });
  });
});
