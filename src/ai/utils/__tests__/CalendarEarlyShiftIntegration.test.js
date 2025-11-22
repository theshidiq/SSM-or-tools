/**
 * Phase 4: Integration Tests for Calendar Rules + Early Shift Preferences
 *
 * Tests all three phases:
 * - Phase 1: Early Shift Preferences
 * - Phase 2: Calendar Rules
 * - Phase 3: Combined Integration
 */

import { EarlyShiftPreferencesLoader } from '../EarlyShiftPreferencesLoader';
import { CalendarRulesLoader } from '../CalendarRulesLoader';
import { CalendarEarlyShiftIntegrator } from '../CalendarEarlyShiftIntegrator';

describe('Phase 1: Early Shift Preferences', () => {
  const mockPreferences = {
    'staff-1': {
      '2025-12-01': true,
      '2025-12-03': true,
      'default': false,
    },
    'staff-2': {
      'default': true,
    },
    'staff-3': {
      '2025-12-01': false,
      'default': true,
    },
  };

  describe('EarlyShiftPreferencesLoader.canDoEarlyShift', () => {
    test('should return true for staff with specific date permission', () => {
      const result = EarlyShiftPreferencesLoader.canDoEarlyShift(
        mockPreferences,
        'staff-1',
        '2025-12-01'
      );
      expect(result).toBe(true);
    });

    test('should return false for staff with specific date denial', () => {
      const result = EarlyShiftPreferencesLoader.canDoEarlyShift(
        mockPreferences,
        'staff-3',
        '2025-12-01'
      );
      expect(result).toBe(false);
    });

    test('should use default permission when no specific date match', () => {
      const result = EarlyShiftPreferencesLoader.canDoEarlyShift(
        mockPreferences,
        'staff-2',
        '2025-12-01'
      );
      expect(result).toBe(true);
    });

    test('should return false for staff without any preference', () => {
      const result = EarlyShiftPreferencesLoader.canDoEarlyShift(
        mockPreferences,
        'staff-4',
        '2025-12-01'
      );
      expect(result).toBe(false);
    });
  });

  describe('EarlyShiftPreferencesLoader.validateSchedule', () => {
    test('should pass validation when early shifts match preferences', () => {
      const schedule = {
        'staff-1': {
          '2025-12-01': '△',
          '2025-12-02': '',
        },
        'staff-2': {
          '2025-12-01': '△',
        },
      };

      const result = EarlyShiftPreferencesLoader.validateSchedule(
        schedule,
        mockPreferences
      );

      expect(result.isValid).toBe(true);
      expect(result.violationCount).toBe(0);
    });

    test('should fail validation when staff without permission has early shift', () => {
      const schedule = {
        'staff-3': {
          '2025-12-01': '△', // staff-3 not allowed on this date
        },
      };

      const result = EarlyShiftPreferencesLoader.validateSchedule(
        schedule,
        mockPreferences
      );

      expect(result.isValid).toBe(false);
      expect(result.violationCount).toBe(1);
      expect(result.violations[0].staffId).toBe('staff-3');
    });
  });
});

describe('Phase 2: Calendar Rules', () => {
  const mockCalendarRules = {
    '2025-12-01': {
      must_work: false,
      must_day_off: true,
      notes: 'Holiday',
    },
    '2025-12-03': {
      must_work: false,
      must_day_off: true,
      notes: 'Another holiday',
    },
    '2025-12-15': {
      must_work: true,
      must_day_off: false,
      notes: 'Busy day',
    },
  };

  const mockStaffMembers = [
    { id: 'staff-1', name: '料理長' },
    { id: 'staff-2', name: '副料理長' },
    { id: 'staff-3', name: 'パート A' },
  ];

  describe('CalendarRulesLoader helper functions', () => {
    test('isMustWorkDate should identify must_work dates', () => {
      const result = CalendarRulesLoader.isMustWorkDate(
        mockCalendarRules,
        '2025-12-15'
      );
      expect(result).toBe(true);
    });

    test('isMustDayOffDate should identify must_day_off dates', () => {
      const result = CalendarRulesLoader.isMustDayOffDate(
        mockCalendarRules,
        '2025-12-01'
      );
      expect(result).toBe(true);
    });

    test('getMustWorkDates should return all must_work dates', () => {
      const result = CalendarRulesLoader.getMustWorkDates(mockCalendarRules);
      expect(result).toEqual(['2025-12-15']);
    });

    test('getMustDayOffDates should return all must_day_off dates', () => {
      const result = CalendarRulesLoader.getMustDayOffDates(mockCalendarRules);
      expect(result).toEqual(['2025-12-01', '2025-12-03']);
    });
  });

  describe('CalendarRulesLoader.validateSchedule', () => {
    test('should pass when staff work on must_work dates', () => {
      const schedule = {
        'staff-1': {
          '2025-12-15': '', // Working (normal shift)
        },
        'staff-2': {
          '2025-12-15': '△', // Working (early shift)
        },
      };

      const result = CalendarRulesLoader.validateSchedule(
        schedule,
        mockCalendarRules,
        mockStaffMembers
      );

      expect(result.isValid).toBe(true);
      expect(result.mustWorkViolations).toBe(0);
    });

    test('should fail when staff have day off on must_work dates', () => {
      const schedule = {
        'staff-1': {
          '2025-12-15': '×', // Day off on must_work date - VIOLATION
        },
      };

      const result = CalendarRulesLoader.validateSchedule(
        schedule,
        mockCalendarRules,
        mockStaffMembers
      );

      expect(result.isValid).toBe(false);
      expect(result.mustWorkViolations).toBe(1);
    });

    test('should fail when staff work on must_day_off dates', () => {
      const schedule = {
        'staff-1': {
          '2025-12-01': '◇', // Late shift on must_day_off date - VIOLATION
        },
        'staff-2': {
          '2025-12-01': '△', // Early shift on must_day_off date - VIOLATION
        },
      };

      const result = CalendarRulesLoader.validateSchedule(
        schedule,
        mockCalendarRules,
        mockStaffMembers
      );

      expect(result.isValid).toBe(false);
      expect(result.mustDayOffViolations).toBe(2);
    });
  });

  describe('CalendarRulesLoader.applyRulesToSchedule', () => {
    test('should force day offs on must_day_off dates', () => {
      const schedule = {
        'staff-1': {
          '2025-12-01': '', // Should become ×
        },
        'staff-2': {
          '2025-12-01': '△', // Should become ×
        },
      };

      const result = CalendarRulesLoader.applyRulesToSchedule(
        schedule,
        mockCalendarRules,
        mockStaffMembers
      );

      expect(result['staff-1']['2025-12-01']).toBe('×');
      expect(result['staff-2']['2025-12-01']).toBe('×');
    });

    test('should force work on must_work dates', () => {
      const schedule = {
        'staff-1': {
          '2025-12-15': '×', // Should become ''
        },
      };

      const result = CalendarRulesLoader.applyRulesToSchedule(
        schedule,
        mockCalendarRules,
        mockStaffMembers
      );

      expect(result['staff-1']['2025-12-15']).toBe('');
    });
  });
});

describe('Phase 3: Combined Integration', () => {
  const mockCalendarRules = {
    '2025-12-01': {
      must_work: false,
      must_day_off: true,
      notes: 'Holiday',
    },
    '2025-12-03': {
      must_work: false,
      must_day_off: true,
      notes: 'Another holiday',
    },
  };

  const mockEarlyShiftPreferences = {
    'staff-1': {
      '2025-12-01': true,
      'default': true,
    },
    'staff-2': {
      '2025-12-01': true,
      'default': false,
    },
    'staff-3': {
      'default': false, // Cannot do early shifts
    },
  };

  const mockStaffMembers = [
    { id: 'staff-1', name: '料理長' },
    { id: 'staff-2', name: '副料理長' },
    { id: 'staff-3', name: 'パート A' },
  ];

  describe('CalendarEarlyShiftIntegrator.getEligibleStaffForEarlyShift', () => {
    test('should return staff with early shift permission for specific date', () => {
      const result = CalendarEarlyShiftIntegrator.getEligibleStaffForEarlyShift(
        mockStaffMembers,
        mockEarlyShiftPreferences,
        '2025-12-01'
      );

      expect(result.length).toBe(2);
      expect(result.map((s) => s.id)).toEqual(['staff-1', 'staff-2']);
    });

    test('should exclude staff without permission', () => {
      const result = CalendarEarlyShiftIntegrator.getEligibleStaffForEarlyShift(
        mockStaffMembers,
        mockEarlyShiftPreferences,
        '2025-12-01'
      );

      expect(result.find((s) => s.id === 'staff-3')).toBeUndefined();
    });
  });

  describe('CalendarEarlyShiftIntegrator.applyCombinedRules', () => {
    test('should assign early shifts to eligible staff on must_day_off dates', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '' },
        'staff-2': { '2025-12-01': '' },
        'staff-3': { '2025-12-01': '' },
      };

      const result = CalendarEarlyShiftIntegrator.applyCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.schedule['staff-1']['2025-12-01']).toBe('△');
      expect(result.schedule['staff-2']['2025-12-01']).toBe('△');
      expect(result.summary.earlyShiftsAssigned).toBeGreaterThan(0);
    });

    test('should assign day off to non-eligible staff on must_day_off dates', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '' },
        'staff-2': { '2025-12-01': '' },
        'staff-3': { '2025-12-01': '' },
      };

      const result = CalendarEarlyShiftIntegrator.applyCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.schedule['staff-3']['2025-12-01']).toBe('×');
      expect(result.summary.dayOffsAssigned).toBeGreaterThan(0);
    });

    test('should handle multiple must_day_off dates', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '', '2025-12-03': '' },
        'staff-2': { '2025-12-01': '', '2025-12-03': '' },
        'staff-3': { '2025-12-01': '', '2025-12-03': '' },
      };

      const result = CalendarEarlyShiftIntegrator.applyCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      // Both dates should have early shifts for eligible staff
      expect(result.schedule['staff-1']['2025-12-01']).toBe('△');
      expect(result.schedule['staff-1']['2025-12-03']).toBe('△');
      expect(result.summary.mustDayOffDates).toBe(2);
    });
  });

  describe('CalendarEarlyShiftIntegrator.validateCombinedRules', () => {
    test('should pass when eligible staff have early shifts on must_day_off dates', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '△', '2025-12-03': '△' },
        'staff-2': { '2025-12-01': '△', '2025-12-03': '×' }, // staff-2 only eligible on 12-01, not 12-03
        'staff-3': { '2025-12-01': '×', '2025-12-03': '×' },
      };

      const result = CalendarEarlyShiftIntegrator.validateCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.isValid).toBe(true);
      expect(result.violationCount).toBe(0);
    });

    test('should fail when eligible staff do not have early shifts', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '×' }, // Should be △
        'staff-2': { '2025-12-01': '' },   // Should be △
        'staff-3': { '2025-12-01': '×' },  // Correct
      };

      const result = CalendarEarlyShiftIntegrator.validateCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.isValid).toBe(false);
      expect(result.violationCount).toBeGreaterThan(0);
    });

    test('should fail when non-eligible staff have work shifts on must_day_off', () => {
      const schedule = {
        'staff-1': { '2025-12-01': '△' },
        'staff-2': { '2025-12-01': '△' },
        'staff-3': { '2025-12-01': '' }, // Should be ×
      };

      const result = CalendarEarlyShiftIntegrator.validateCombinedRules(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.isValid).toBe(false);
      expect(result.violations.some((v) => v.staffId === 'staff-3')).toBe(true);
    });
  });

  describe('CalendarEarlyShiftIntegrator.getCombinedRulesSummary', () => {
    test('should provide accurate summary statistics', () => {
      const result = CalendarEarlyShiftIntegrator.getCombinedRulesSummary(
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers
      );

      expect(result.mustDayOffDates).toBe(2);
      expect(result.staffWithEarlyShiftPermission).toBe(3);
      expect(result.totalEarlyShiftsToAssign).toBeGreaterThan(0);
      expect(result.dates.mustDayOff).toEqual(['2025-12-01', '2025-12-03']);
    });
  });
});

describe('Integration: End-to-End Workflow', () => {
  test('should correctly apply all three phases together', () => {
    const mockCalendarRules = {
      '2025-12-01': { must_work: false, must_day_off: true },
      '2025-12-25': { must_work: false, must_day_off: true },
    };

    const mockEarlyShiftPreferences = {
      'chef-1': { 'default': true },
      'chef-2': { '2025-12-01': true, 'default': false },
      'part-timer': { 'default': false },
    };

    const mockStaffMembers = [
      { id: 'chef-1', name: '料理長' },
      { id: 'chef-2', name: '副料理長' },
      { id: 'part-timer', name: 'パート' },
    ];

    const initialSchedule = {
      'chef-1': { '2025-12-01': '', '2025-12-25': '' },
      'chef-2': { '2025-12-01': '', '2025-12-25': '' },
      'part-timer': { '2025-12-01': '', '2025-12-25': '' },
    };

    // Apply combined rules
    const result = CalendarEarlyShiftIntegrator.applyCombinedRules(
      initialSchedule,
      mockCalendarRules,
      mockEarlyShiftPreferences,
      mockStaffMembers
    );

    // Validate Phase 1: Early shift preferences respected
    expect(result.schedule['chef-1']['2025-12-01']).toBe('△');
    expect(result.schedule['chef-2']['2025-12-01']).toBe('△');

    // Validate Phase 2: Calendar rules enforced
    expect(result.schedule['part-timer']['2025-12-01']).toBe('×');
    expect(result.schedule['part-timer']['2025-12-25']).toBe('×');

    // Validate Phase 3: Combined logic
    const validation = CalendarEarlyShiftIntegrator.validateCombinedRules(
      result.schedule,
      mockCalendarRules,
      mockEarlyShiftPreferences,
      mockStaffMembers
    );

    expect(validation.isValid).toBe(true);
    expect(result.summary.earlyShiftsAssigned).toBeGreaterThan(0);
    expect(result.summary.dayOffsAssigned).toBeGreaterThan(0);
  });
});
