/**
 * ConfigurationService.priorityRules.test.js
 *
 * Unit tests for Priority Rules validation in ConfigurationService
 * Specifically tests the avoid_shift_with_exceptions rule type
 */

import { ConfigurationService } from '../ConfigurationService';

describe('ConfigurationService - Priority Rules Validation', () => {
  describe('validatePriorityRule - avoid_shift_with_exceptions', () => {
    test('should validate avoid_shift_with_exceptions with valid allowedShifts', () => {
      const rule = {
        id: 'rule-1',
        name: 'Avoid Off but Allow Early',
        description: 'Avoid off days but allow early shifts on weekends',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early', 'late'],
        staffIds: ['staff-1', 'staff-2'],
        daysOfWeek: [0, 6], // Sunday, Saturday
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should warn when avoid_shift_with_exceptions has no allowedShifts', () => {
      const rule = {
        id: 'rule-2',
        name: 'Avoid Off with No Exceptions',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: [], // Empty exceptions
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('should have at least one allowedShift');
    });

    test('should warn when avoid_shift_with_exceptions has undefined allowedShifts', () => {
      const rule = {
        id: 'rule-3',
        name: 'Avoid Off with Undefined Exceptions',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        // allowedShifts not defined
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('should have at least one allowedShift');
    });

    test('should error when allowedShifts includes the avoided shift', () => {
      const rule = {
        id: 'rule-4',
        name: 'Invalid Exception Rule',
        description: 'Avoid off but also allow off (contradiction)',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early', 'off'], // ❌ Contains the avoided shift
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Cannot allow the same shift');
      expect(result.errors[0]).toContain('off');
    });

    test('should error when allowedShifts contains invalid shift type', () => {
      const rule = {
        id: 'rule-5',
        name: 'Invalid Shift Type',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early', 'invalid_shift'], // ❌ Invalid shift type
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('Invalid shift type'))).toBe(true);
    });

    test('should validate all valid shift types in allowedShifts', () => {
      const rule = {
        id: 'rule-6',
        name: 'All Valid Shifts',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early', 'late'], // All valid
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should error when rule name is missing', () => {
      const rule = {
        id: 'rule-7',
        name: '', // ❌ Empty name
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early'],
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('name is required'))).toBe(true);
    });

    test('should validate regular avoid_shift rule (backward compatibility)', () => {
      const rule = {
        id: 'rule-8',
        name: 'Regular Avoid Shift',
        description: 'Test backward compatibility',
        ruleType: 'avoid_shift', // Old rule type
        shiftType: 'off',
        // No allowedShifts field
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate preferred_shift rule (backward compatibility)', () => {
      const rule = {
        id: 'rule-9',
        name: 'Preferred Shift',
        description: 'Test backward compatibility',
        ruleType: 'preferred_shift',
        shiftType: 'early',
        staffIds: ['staff-1'],
        daysOfWeek: [1, 2, 3],
        priorityLevel: 3,
        preferenceStrength: 7,
        isHardConstraint: false,
        penaltyWeight: 3.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null allowedShifts gracefully', () => {
      const rule = {
        id: 'rule-10',
        name: 'Null Allowed Shifts',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: null,
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    test('should handle single exception shift', () => {
      const rule = {
        id: 'rule-11',
        name: 'Single Exception',
        description: 'Test rule',
        ruleType: 'avoid_shift_with_exceptions',
        shiftType: 'off',
        allowedShifts: ['early'], // Only one exception
        staffIds: ['staff-1'],
        daysOfWeek: [0],
        priorityLevel: 4,
        preferenceStrength: 8,
        isHardConstraint: false,
        penaltyWeight: 5.0,
        effectiveFrom: null,
        effectiveUntil: null,
        isActive: true
      };

      const result = ConfigurationService.validatePriorityRule(rule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
