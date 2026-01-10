"""
Test for backup staff constraint fix.
Verifies that backup staff can ONLY have:
- ○ (WORK) when coverage is needed
- ⊘ (unavailable/OFF) when no coverage is needed
- NOT △ (EARLY) or ◇ (LATE) in any case
"""

import sys
from scheduler import ShiftScheduleOptimizer


def test_backup_staff_constraint_fix():
    """
    Test that backup staff (中田) shows correct symbols:
    - When 料理長 has × → 中田 should have ○ (WORK)
    - When 料理長 does NOT have × → 中田 should have ⊘ (shown as × internally, converted to ⊘ in output)
    - 中田 should NEVER have △ (EARLY) or ◇ (LATE)
    """
    optimizer = ShiftScheduleOptimizer()

    # Test data matching the screenshot scenario
    staff_members = [
        {
            'id': 'ryourichou',
            'name': '料理長',
            'status': '社員',
            'position': 'Chef'
        },
        {
            'id': 'nakada',
            'name': '中田',
            'status': 'パート',
            'position': 'Backup'
        }
    ]

    # Date range for testing
    date_range = [
        '2024-11-22',  # 22月 - 料理長 should have ×, 中田 should have ○
        '2024-11-23',  # 23火 - Test case
        '2024-11-25',  # 25木 - Test case
        '2024-11-26',  # 26金 - Test case
        '2024-11-28',  # 28日 - Test case
    ]

    # Staff group: Group 2 has only 料理長 as active member
    staff_groups = [
        {
            'id': 'group2',
            'name': 'Group 2',
            'members': ['ryourichou']  # Only 料理長 is active member
        }
    ]

    # Backup assignment: 中田 covers Group 2
    backup_assignments = [
        {
            'id': 'backup1',
            'staffId': 'nakada',
            'groupId': 'group2',
            'isActive': True
        }
    ]

    # Prefilled schedule: 料理長 has × on 2024-11-22
    prefilled_schedule = {
        'ryourichou': {
            '2024-11-22': '×',  # 料理長 is off on 22月
        }
    }

    # Constraints with HARD backup coverage
    constraints = {
        'staffGroups': staff_groups,
        'backupAssignments': backup_assignments,
        'prefilledSchedule': prefilled_schedule,
        'dailyLimitsRaw': {
            'enabled': False  # Disable to simplify test
        },
        'monthlyLimit': {},  # No monthly limits for this test
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': True  # HARD constraint - backup MUST work when needed
            }
        }
    }

    # Run optimization
    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    # Verify the result
    print("\n" + "="*80)
    print("BACKUP STAFF CONSTRAINT FIX TEST RESULTS")
    print("="*80)

    if not result['success']:
        print(f"❌ FAILED: Optimization failed with error: {result.get('error')}")
        return False

    schedule = result['schedule']
    nakada_schedule = schedule.get('nakada', {})
    ryourichou_schedule = schedule.get('ryourichou', {})

    # Verify each date
    all_passed = True

    for date in date_range:
        ryourichou_shift = ryourichou_schedule.get(date, '')
        nakada_shift = nakada_schedule.get(date, '')

        # Check if 料理長 has × (day off)
        ryourichou_has_off = ryourichou_shift in ['×', '\u00d7']

        print(f"\nDate: {date}")
        print(f"  料理長: {ryourichou_shift} (has_off={ryourichou_has_off})")
        print(f"  中田:   {nakada_shift}")

        # Validation rules
        if ryourichou_has_off:
            # When 料理長 has ×, 中田 MUST have ○ (normal work)
            if nakada_shift == '' or nakada_shift == '○' or nakada_shift == '\u25cb':
                print(f"  ✅ CORRECT: 中田 has WORK (○) when 料理長 is off")
            else:
                print(f"  ❌ ERROR: 中田 should have ○ but has {repr(nakada_shift)}")
                all_passed = False
        else:
            # When 料理長 does NOT have ×, 中田 MUST have ⊘ (unavailable)
            if nakada_shift == '⊘' or nakada_shift == '\u2298':
                print(f"  ✅ CORRECT: 中田 has ⊘ (unavailable) when 料理長 is working")
            else:
                print(f"  ❌ ERROR: 中田 should have ⊘ but has {repr(nakada_shift)}")
                all_passed = False

        # 中田 should NEVER have △ (EARLY) or ◇ (LATE)
        if nakada_shift in ['△', '\u25b3', '◇', '\u25c7']:
            print(f"  ❌ CRITICAL ERROR: 中田 has EARLY/LATE shift {repr(nakada_shift)} - THIS SHOULD NEVER HAPPEN")
            all_passed = False

    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED - Backup staff constraint is working correctly!")
    else:
        print("❌ SOME TESTS FAILED - Backup staff constraint needs fixing")
    print("="*80)

    return all_passed


if __name__ == '__main__':
    success = test_backup_staff_constraint_fix()
    sys.exit(0 if success else 1)
