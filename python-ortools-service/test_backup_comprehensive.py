"""
Comprehensive test for backup staff constraint fix.
Tests multiple scenarios to ensure backup staff behavior is correct.
"""

import sys
from scheduler import ShiftScheduleOptimizer


def test_backup_with_multiple_dates():
    """
    Test backup staff with multiple scenarios across several dates:
    1. Group member has OFF → Backup must have WORK (○)
    2. Group member is WORKING → Backup must have UNAVAILABLE (⊘)
    3. Backup should NEVER have EARLY (△) or LATE (◇)
    """
    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'chef1', 'name': '料理長', 'status': '社員', 'position': 'Chef'},
        {'id': 'backup1', 'name': '中田', 'status': 'パート', 'position': 'Backup'},
        {'id': 'staff1', 'name': '佐藤', 'status': '社員', 'position': 'Staff'},
    ]

    date_range = [
        '2024-11-20', '2024-11-21', '2024-11-22', '2024-11-23', '2024-11-24',
        '2024-11-25', '2024-11-26', '2024-11-27', '2024-11-28', '2024-11-29'
    ]

    staff_groups = [
        {
            'id': 'group1',
            'name': 'Group 1',
            'members': ['chef1']
        }
    ]

    backup_assignments = [
        {
            'id': 'backup_assign1',
            'staffId': 'backup1',
            'groupId': 'group1',
            'isActive': True
        }
    ]

    # Prefill some dates where chef1 has OFF
    prefilled_schedule = {
        'chef1': {
            '2024-11-22': '×',  # Chef off on 22
            '2024-11-25': '×',  # Chef off on 25
            '2024-11-28': '×',  # Chef off on 28
        }
    }

    constraints = {
        'staffGroups': staff_groups,
        'backupAssignments': backup_assignments,
        'prefilledSchedule': prefilled_schedule,
        'dailyLimitsRaw': {'enabled': False},
        'monthlyLimit': {},
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': True  # HARD constraint
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=15
    )

    print("\n" + "="*80)
    print("COMPREHENSIVE BACKUP STAFF TEST")
    print("="*80)

    if not result['success']:
        print(f"❌ FAILED: {result.get('error')}")
        return False

    chef_schedule = result['schedule'].get('chef1', {})
    backup_schedule = result['schedule'].get('backup1', {})

    passed = 0
    failed = 0

    print("\n{:<15} {:<10} {:<10} {:<30}".format("Date", "Chef", "Backup", "Result"))
    print("-" * 80)

    for date in date_range:
        chef_shift = chef_schedule.get(date, '')
        backup_shift = backup_schedule.get(date, '')

        chef_has_off = chef_shift in ['×', '\u00d7']

        # Validation
        status = ""
        is_valid = True

        if chef_has_off:
            # Chef is OFF → Backup must be WORK (○ or empty)
            if backup_shift in ['', '○', '\u25cb']:
                status = "✅ Backup working (correct)"
                passed += 1
            else:
                status = f"❌ Backup should be ○, got {repr(backup_shift)}"
                is_valid = False
                failed += 1
        else:
            # Chef is WORKING → Backup must be UNAVAILABLE (⊘)
            if backup_shift in ['⊘', '\u2298']:
                status = "✅ Backup unavailable (correct)"
                passed += 1
            else:
                status = f"❌ Backup should be ⊘, got {repr(backup_shift)}"
                is_valid = False
                failed += 1

        # Check for EARLY/LATE (should NEVER happen)
        if backup_shift in ['△', '\u25b3', '◇', '\u25c7']:
            status += " | ❌ CRITICAL: Has EARLY/LATE!"
            is_valid = False
            failed += 1

        print("{:<15} {:<10} {:<10} {:<30}".format(
            date,
            chef_shift if chef_shift else '○',
            backup_shift if backup_shift else '○',
            status
        ))

    print("\n" + "="*80)
    print(f"Results: {passed} passed, {failed} failed")

    if failed == 0:
        print("✅ ALL COMPREHENSIVE TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)

    return failed == 0


def test_backup_with_soft_constraints():
    """
    Test backup staff with SOFT constraints (should still work but allow violations).
    """
    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'chef1', 'name': '料理長', 'status': '社員'},
        {'id': 'backup1', 'name': '中田', 'status': 'パート'},
    ]

    date_range = ['2024-11-22', '2024-11-23', '2024-11-24']

    staff_groups = [
        {'id': 'group1', 'name': 'Group 1', 'members': ['chef1']}
    ]

    backup_assignments = [
        {'id': 'ba1', 'staffId': 'backup1', 'groupId': 'group1', 'isActive': True}
    ]

    prefilled_schedule = {
        'chef1': {'2024-11-22': '×'}
    }

    constraints = {
        'staffGroups': staff_groups,
        'backupAssignments': backup_assignments,
        'prefilledSchedule': prefilled_schedule,
        'dailyLimitsRaw': {'enabled': False},
        'monthlyLimit': {},
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': False  # SOFT constraint
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    print("\n" + "="*80)
    print("SOFT CONSTRAINT BACKUP TEST")
    print("="*80)

    if not result['success']:
        print(f"❌ FAILED: {result.get('error')}")
        return False

    # With SOFT constraints, solver should still find a solution
    # even if backup coverage isn't perfect
    backup_schedule = result['schedule'].get('backup1', {})

    print(f"Backup schedule: {backup_schedule}")
    print("✅ SOFT constraint mode works (solution found)")
    print("="*80)

    return True


if __name__ == '__main__':
    test1_pass = test_backup_with_multiple_dates()
    test2_pass = test_backup_with_soft_constraints()

    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    print(f"Comprehensive test: {'✅ PASSED' if test1_pass else '❌ FAILED'}")
    print(f"Soft constraint test: {'✅ PASSED' if test2_pass else '❌ FAILED'}")
    print("="*80)

    sys.exit(0 if (test1_pass and test2_pass) else 1)
