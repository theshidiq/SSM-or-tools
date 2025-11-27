/**
 * BusinessRuleValidator.exceptionRules.test.js
 *
 * Unit tests for avoid_shift_with_exceptions in BusinessRuleValidator
 * Tests rule transformation and application logic
 */

import BusinessRuleValidator from '../BusinessRuleValidator';

describe('BusinessRuleValidator - Exception Rules', () => {
  let validator;
  let mockStaffMembers;

  beforeEach(() => {
    // Initialize validator
    validator = new BusinessRuleValidator();

    // Mock staff members
    mockStaffMembers = [
      {
        id: 'staff-uuid-1',
        name: '料理長',
        position: 'Chef',
        department: 'Kitchen'
      },
      {
        id: 'staff-uuid-2',
        name: '古藤',
        position: 'Cook',
        department: 'Kitchen'
      },
      {
        id: 'staff-uuid-3',
        name: '田中',
        position: 'Server',
        department: 'Hall'
      }
    ];
  });

  describe('transformPriorityRulesArrayToObject', () => {
    test('should transform avoid_shift_with_exceptions rule correctly', () => {
      const rulesArray = [
        {
          id: 'rule-1',
          name: 'Avoid Off but Allow Early',
          description: 'Avoid off days but allow early shifts on weekends',
          ruleType: 'avoid_shift_with_exceptions',
          shiftType: 'off',
          allowedShifts: ['early', 'late'],
          staffIds: ['staff-uuid-1'],
          daysOfWeek: [0, 6], // Sunday, Saturday
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should create rules for staff-uuid-1
      expect(result['staff-uuid-1']).toBeDefined();
      expect(result['staff-uuid-1'].avoidedShifts).toBeDefined();
      expect(result['staff-uuid-1'].exceptionsAllowed).toBeDefined();

      // Should have 2 avoided shift entries (Sunday and Saturday)
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(2);
      expect(result['staff-uuid-1'].avoidedShifts[0]).toEqual({
        day: 'sunday',
        shift: 'off',
        priority: 4
      });
      expect(result['staff-uuid-1'].avoidedShifts[1]).toEqual({
        day: 'saturday',
        shift: 'off',
        priority: 4
      });

      // Should have 2 exception entries (Sunday and Saturday)
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(2);
      expect(result['staff-uuid-1'].exceptionsAllowed[0]).toEqual({
        day: 'sunday',
        avoidedShift: 'off',
        allowedShifts: ['early', 'late'],
        priority: 4
      });
      expect(result['staff-uuid-1'].exceptionsAllowed[1]).toEqual({
        day: 'saturday',
        avoidedShift: 'off',
        allowedShifts: ['early', 'late'],
        priority: 4
      });
    });

    test('should handle multiple staff members in single rule', () => {
      const rulesArray = [
        {
          id: 'rule-2',
          name: 'Multi-staff Exception Rule',
          description: 'Test rule',
          ruleType: 'avoid_shift_with_exceptions',
          shiftType: 'off',
          allowedShifts: ['early'],
          staffIds: ['staff-uuid-1', 'staff-uuid-2'], // Multiple staff
          daysOfWeek: [0], // Sunday only
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Both staff should have exception rules
      expect(result['staff-uuid-1']).toBeDefined();
      expect(result['staff-uuid-2']).toBeDefined();

      // Each should have 1 avoided shift and 1 exception
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(1);
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(1);
      expect(result['staff-uuid-2'].avoidedShifts).toHaveLength(1);
      expect(result['staff-uuid-2'].exceptionsAllowed).toHaveLength(1);
    });

    test('should handle rule with no allowedShifts', () => {
      const rulesArray = [
        {
          id: 'rule-3',
          name: 'No Exceptions',
          description: 'Test rule',
          ruleType: 'avoid_shift_with_exceptions',
          shiftType: 'off',
          allowedShifts: [], // Empty exceptions
          staffIds: ['staff-uuid-1'],
          daysOfWeek: [0],
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should still create avoidedShifts
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(1);

      // But no exceptions should be added (empty array)
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(0);
    });

    test('should handle rule with undefined allowedShifts', () => {
      const rulesArray = [
        {
          id: 'rule-4',
          name: 'Undefined Exceptions',
          description: 'Test rule',
          ruleType: 'avoid_shift_with_exceptions',
          shiftType: 'off',
          // allowedShifts not defined
          staffIds: ['staff-uuid-1'],
          daysOfWeek: [0],
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should create avoidedShifts
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(1);

      // No exceptions should be added
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(0);
    });

    test('should handle defensive extraction from ruleDefinition', () => {
      const rulesArray = [
        {
          id: 'rule-5',
          name: 'JSONB Format',
          description: 'Test rule from database',
          ruleType: 'avoid_shift_with_exceptions',
          ruleDefinition: {
            shiftType: 'off',
            allowedShifts: ['early'], // Nested in ruleDefinition
            daysOfWeek: [0]
          },
          staffIds: ['staff-uuid-1'],
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should extract from ruleDefinition
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(1);
      expect(result['staff-uuid-1'].exceptionsAllowed[0].allowedShifts).toEqual(['early']);
    });

    test('should maintain backward compatibility with avoid_shift', () => {
      const rulesArray = [
        {
          id: 'rule-6',
          name: 'Regular Avoid Shift',
          description: 'Test backward compatibility',
          ruleType: 'avoid_shift', // Old rule type
          shiftType: 'off',
          staffIds: ['staff-uuid-1'],
          daysOfWeek: [0],
          priorityLevel: 4
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should create avoidedShifts
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(1);

      // No exceptions (old rule type doesn't support exceptions)
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(0);
    });

    test('should maintain backward compatibility with preferred_shift', () => {
      const rulesArray = [
        {
          id: 'rule-7',
          name: 'Preferred Shift',
          description: 'Test backward compatibility',
          ruleType: 'preferred_shift',
          shiftType: 'early',
          staffIds: ['staff-uuid-1'],
          daysOfWeek: [1, 2, 3],
          priorityLevel: 3
        }
      ];

      const result = validator.transformPriorityRulesArrayToObject(rulesArray, mockStaffMembers);

      // Should create preferredShifts
      expect(result['staff-uuid-1'].preferredShifts).toHaveLength(3);
      expect(result['staff-uuid-1'].preferredShifts[0]).toEqual({
        day: 'monday',
        shift: 'early',
        priority: 3
      });

      // No avoided shifts or exceptions
      expect(result['staff-uuid-1'].avoidedShifts).toHaveLength(0);
      expect(result['staff-uuid-1'].exceptionsAllowed).toHaveLength(0);
    });
  });

  describe('applyPriorityRules - Exception Logic', () => {
    let mockSchedule;
    let mockDateRange;

    beforeEach(() => {
      // Mock schedule with staff members
      mockSchedule = {
        'staff-uuid-1': {
          '2025-01-19': '×', // Sunday - OFF
          '2025-01-20': '△', // Monday - Early
          '2025-01-25': '×', // Saturday - OFF
        },
        'staff-uuid-2': {
          '2025-01-19': '×', // Sunday - OFF
          '2025-01-20': '○', // Monday - Normal
        }
      };

      // Mock date range (Sunday Jan 19 - Monday Jan 20)
      mockDateRange = [
        new Date('2025-01-19'), // Sunday
        new Date('2025-01-20'), // Monday
        new Date('2025-01-25'), // Saturday
      ];

      // Mock getLiveSettings to return priority rules
      validator.getLiveSettings = jest.fn();
    });

    test('should replace avoided shift with exception shift', async () => {
      // Set up priority rules with exceptions
      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-1',
            name: 'Avoid Off but Allow Early',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early'], // Allow early as exception
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0], // Sunday only
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Sunday should be replaced with early shift
      expect(mockSchedule['staff-uuid-1']['2025-01-19']).toBe('△'); // Early

      // Saturday should remain OFF (no rule for Saturday)
      expect(mockSchedule['staff-uuid-1']['2025-01-25']).toBe('×');
    });

    test('should randomly select from multiple exception shifts', async () => {
      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-2',
            name: 'Multiple Exceptions',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early', 'late'], // Multiple exceptions
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Should be either early or late (not OFF)
      const result = mockSchedule['staff-uuid-1']['2025-01-19'];
      expect(['△', '◇']).toContain(result);
      expect(result).not.toBe('×');
    });

    test('should clear shift when no exception rule exists', async () => {
      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-3',
            name: 'Regular Avoid Shift',
            ruleType: 'avoid_shift', // Old rule type, no exceptions
            shiftType: 'off',
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Should be cleared (blank/normal shift)
      expect(mockSchedule['staff-uuid-1']['2025-01-19']).toBe('');
    });

    test('should handle multiple staff with different exceptions', async () => {
      mockSchedule['staff-uuid-2']['2025-01-19'] = '×'; // Add OFF for staff-2

      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-4',
            name: 'Staff 1 - Allow Early',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early'],
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0],
            priorityLevel: 4
          },
          {
            id: 'rule-5',
            name: 'Staff 2 - Allow Late',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['late'],
            staffIds: ['staff-uuid-2'],
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Each staff should have their specific exception
      expect(mockSchedule['staff-uuid-1']['2025-01-19']).toBe('△'); // Early
      expect(mockSchedule['staff-uuid-2']['2025-01-19']).toBe('◇'); // Late
    });

    test('should not modify shift that is not avoided', async () => {
      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-6',
            name: 'Avoid Off',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early'],
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [1], // Monday only
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Monday is already early (△), should remain unchanged
      expect(mockSchedule['staff-uuid-1']['2025-01-20']).toBe('△');
    });

    test('should handle empty priority rules gracefully', async () => {
      validator.getLiveSettings.mockReturnValue({
        priorityRules: []
      });

      const originalSchedule = JSON.parse(JSON.stringify(mockSchedule));

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Schedule should remain unchanged
      expect(mockSchedule).toEqual(originalSchedule);
    });

    test('should handle rule with empty allowedShifts', async () => {
      validator.getLiveSettings.mockReturnValue({
        priorityRules: [
          {
            id: 'rule-7',
            name: 'No Exceptions',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: [], // Empty
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      await validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange);

      // Should behave like regular avoid_shift (clear the shift)
      expect(mockSchedule['staff-uuid-1']['2025-01-19']).toBe('');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle staff not found in schedule', async () => {
      const mockSchedule = {}; // Empty schedule
      const mockDateRange = [new Date('2025-01-19')];

      validator.getLiveSettings = jest.fn().mockReturnValue({
        priorityRules: [
          {
            id: 'rule-8',
            name: 'Test Rule',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early'],
            staffIds: ['staff-uuid-1'],
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      // Should not throw error
      await expect(
        validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange)
      ).resolves.not.toThrow();
    });

    test('should handle invalid staff ID in rule', async () => {
      const mockSchedule = { 'staff-uuid-1': { '2025-01-19': '×' } };
      const mockDateRange = [new Date('2025-01-19')];

      validator.getLiveSettings = jest.fn().mockReturnValue({
        priorityRules: [
          {
            id: 'rule-9',
            name: 'Invalid Staff',
            ruleType: 'avoid_shift_with_exceptions',
            shiftType: 'off',
            allowedShifts: ['early'],
            staffIds: ['invalid-staff-id'], // Not in staffMembers
            daysOfWeek: [0],
            priorityLevel: 4
          }
        ]
      });

      // Should not throw error, just skip the rule
      await expect(
        validator.applyPriorityRules(mockSchedule, mockStaffMembers, mockDateRange)
      ).resolves.not.toThrow();
    });
  });
});
