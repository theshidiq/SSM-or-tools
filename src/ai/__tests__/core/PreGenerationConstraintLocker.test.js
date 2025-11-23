/**
 * Unit Tests for PreGenerationConstraintLocker
 * Tests Phase 1 pre-generation constraint locking functionality
 */

import { PreGenerationConstraintLocker } from '../../core/PreGenerationConstraintLocker';

describe('PreGenerationConstraintLocker', () => {
  // Mock data
  const mockStaffMembers = [
    { id: 'staff1', name: 'Alice' },
    { id: 'staff2', name: 'Bob' },
    { id: 'staff3', name: 'Charlie' }
  ];

  const mockDateRange = ['2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03'];

  const mockCalendarRules = {
    '2025-12-31': { must_work: true, must_day_off: false },
    '2026-01-01': { must_work: true, must_day_off: false },
    '2026-01-02': { must_day_off: true, must_work: false }
  };

  const mockEarlyShiftPreferences = {
    staff1: { can_do_early_shift: true },
    staff2: { can_do_early_shift: false },
    staff3: { can_do_early_shift: true }
  };

  describe('lockMandatoryConstraints', () => {
    it('should lock must_work dates with normal shifts for all staff', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers,
        mockDateRange
      );

      // Check must_work dates
      expect(schedule.staff1['2025-12-31']).toBe('');
      expect(schedule.staff2['2025-12-31']).toBe('');
      expect(schedule.staff3['2025-12-31']).toBe('');

      expect(schedule.staff1['2026-01-01']).toBe('');
      expect(schedule.staff2['2026-01-01']).toBe('');
      expect(schedule.staff3['2026-01-01']).toBe('');
    });

    it('should lock must_day_off dates with early shifts for eligible staff', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers,
        mockDateRange
      );

      // Check must_day_off dates
      expect(schedule.staff1['2026-01-02']).toBe('△'); // Can do early shift
      expect(schedule.staff2['2026-01-02']).toBe('×'); // Cannot do early shift
      expect(schedule.staff3['2026-01-02']).toBe('△'); // Can do early shift
    });

    it('should return correct locked cells set', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers,
        mockDateRange
      );

      // Total locked cells: 3 staff × 3 dates (2 must_work + 1 must_day_off) = 9 cells
      expect(result.lockedCells.size).toBe(9);

      // Check specific locked cells
      expect(result.lockedCells.has('staff1:2025-12-31')).toBe(true);
      expect(result.lockedCells.has('staff2:2026-01-01')).toBe(true);
      expect(result.lockedCells.has('staff3:2026-01-02')).toBe(true);
    });

    it('should return correct summary statistics', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        mockCalendarRules,
        mockEarlyShiftPreferences,
        mockStaffMembers,
        mockDateRange
      );

      expect(result.summary.totalLocked).toBe(9);
      expect(result.summary.mustWorkDatesLocked).toBe(2);
      expect(result.summary.mustDayOffDatesLocked).toBe(1);
      expect(result.summary.mustWorkCells).toBe(6); // 2 dates × 3 staff
      expect(result.summary.mustDayOffCells).toBe(3); // 1 date × 3 staff
      expect(result.summary.earlyShiftsAssigned).toBe(2); // staff1 and staff3
      expect(result.summary.dayOffsAssigned).toBe(1); // staff2
    });

    it('should handle empty calendar rules', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        {},
        mockEarlyShiftPreferences,
        mockStaffMembers,
        mockDateRange
      );

      expect(result.lockedCells.size).toBe(0);
      expect(result.summary.totalLocked).toBe(0);
    });

    it('should handle empty early shift preferences', () => {
      const schedule = {};

      const result = PreGenerationConstraintLocker.lockMandatoryConstraints(
        schedule,
        mockCalendarRules,
        {},
        mockStaffMembers,
        mockDateRange
      );

      // All staff should get day off (×) on must_day_off dates
      expect(schedule.staff1['2026-01-02']).toBe('×');
      expect(schedule.staff2['2026-01-02']).toBe('×');
      expect(schedule.staff3['2026-01-02']).toBe('×');
    });
  });

  describe('isCellLocked', () => {
    it('should correctly identify locked cells', () => {
      const lockedCells = new Set(['staff1:2025-12-31', 'staff2:2026-01-01']);

      expect(PreGenerationConstraintLocker.isCellLocked(lockedCells, 'staff1', '2025-12-31')).toBe(true);
      expect(PreGenerationConstraintLocker.isCellLocked(lockedCells, 'staff2', '2026-01-01')).toBe(true);
      expect(PreGenerationConstraintLocker.isCellLocked(lockedCells, 'staff3', '2026-01-02')).toBe(false);
    });
  });

  describe('getLockedStaffForDate', () => {
    it('should return all staff with locked cells on a specific date', () => {
      const lockedCells = new Set([
        'staff1:2025-12-31',
        'staff2:2025-12-31',
        'staff3:2026-01-01'
      ]);

      const staffOn1231 = PreGenerationConstraintLocker.getLockedStaffForDate(lockedCells, '2025-12-31');
      expect(staffOn1231).toEqual(['staff1', 'staff2']);

      const staffOn0101 = PreGenerationConstraintLocker.getLockedStaffForDate(lockedCells, '2026-01-01');
      expect(staffOn0101).toEqual(['staff3']);

      const staffOn0102 = PreGenerationConstraintLocker.getLockedStaffForDate(lockedCells, '2026-01-02');
      expect(staffOn0102).toEqual([]);
    });
  });

  describe('validateLockedCells', () => {
    it('should detect no violations when locked cells unchanged', () => {
      const originalSchedule = {
        staff1: { '2025-12-31': '', '2026-01-01': '' },
        staff2: { '2025-12-31': '', '2026-01-01': '' }
      };

      const generatedSchedule = {
        staff1: { '2025-12-31': '', '2026-01-01': '' },
        staff2: { '2025-12-31': '', '2026-01-01': '' }
      };

      const lockedCells = new Set(['staff1:2025-12-31', 'staff2:2026-01-01']);

      const result = PreGenerationConstraintLocker.validateLockedCells(
        originalSchedule,
        generatedSchedule,
        lockedCells
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.violationCount).toBe(0);
    });

    it('should detect violations when locked cells modified', () => {
      const originalSchedule = {
        staff1: { '2025-12-31': '', '2026-01-01': '' },
        staff2: { '2025-12-31': '', '2026-01-01': '' }
      };

      const generatedSchedule = {
        staff1: { '2025-12-31': '△', '2026-01-01': '' }, // Changed!
        staff2: { '2025-12-31': '', '2026-01-01': '×' }  // Changed!
      };

      const lockedCells = new Set(['staff1:2025-12-31', 'staff2:2026-01-01']);

      const result = PreGenerationConstraintLocker.validateLockedCells(
        originalSchedule,
        generatedSchedule,
        lockedCells
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violationCount).toBe(2);
    });
  });

  describe('getLockedCellsSummary', () => {
    it('should return correct summary statistics', () => {
      const lockedCells = new Set([
        'staff1:2025-12-31',
        'staff2:2025-12-31',
        'staff3:2025-12-31',
        'staff1:2026-01-01',
        'staff2:2026-01-01',
        'staff3:2026-01-01',
        'staff1:2026-01-02',
        'staff2:2026-01-02',
        'staff3:2026-01-02'
      ]);

      const summary = PreGenerationConstraintLocker.getLockedCellsSummary(
        lockedCells,
        mockCalendarRules
      );

      expect(summary.totalLockedCells).toBe(9);
      expect(summary.calendarRuleCount).toBe(3);
      expect(summary.mustWorkDates).toBe(2);
      expect(summary.mustDayOffDates).toBe(1);
    });
  });
});
