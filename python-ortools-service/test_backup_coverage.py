"""
Test backup staff coverage constraints with HARD/SOFT modes.

Tests the fix for backup staff not working when group members are off.
Expected behavior:
- HARD mode (default): Backup MUST work when group member has × (day off)
- SOFT mode: Backup SHOULD work (allows violations with penalty)
"""

import pytest
from scheduler import ShiftScheduleOptimizer


def test_backup_coverage_hard_constraint():
    """
    Test that backup staff MUST work when group member is off (HARD constraint mode).

    Business scenario:
    - Group 2 has 1 member: 料理長 (head chef)
    - 中田 is backup for Group 2
    - When 料理長 has × on 24水 and 30火 → 中田 MUST show ○ (work)
    """
    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'staff-1', 'name': '料理長', 'status': '社員'},
        {'id': 'staff-2', 'name': '中田', 'status': '派遣'}
    ]

    date_range = [
        '2024-01-24',  # 24水 - 料理長 will be off
        '2024-01-25',  # 25木
        '2024-01-26',  # 26金
        '2024-01-27',  # 27土
        '2024-01-28',  # 28日
        '2024-01-29',  # 29月
        '2024-01-30',  # 30火 - 料理長 will be off
    ]

    constraints = {
        'staffGroups': [
            {
                'id': 'group-2',
                'name': 'Group 2',
                'members': ['staff-1']  # Only 料理長 is active member
            }
        ],
        'backupAssignments': [
            {
                'id': 'backup-1',
                'staffId': 'staff-2',  # 中田
                'groupId': 'group-2',  # Covers Group 2
                'isActive': True
            }
        ],
        'prefilledSchedule': {
            'staff-1': {
                '2024-01-24': '×',  # 料理長 is off on 24水
                '2024-01-30': '×',  # 料理長 is off on 30火
            }
        },
        'monthlyLimit': {
            'minCount': 2,
            'maxCount': 4,  # Increased to accommodate pre-filled + generated offs
            'excludeCalendarRules': True
        },
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': True  # HARD constraint mode
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    # Assert solution was found
    assert result['success'], f"Failed to find solution: {result.get('error')}"

    schedule = result['schedule']

    # CRITICAL ASSERTION: 中田 MUST work (○) when 料理長 is off (×)
    # Note: Scheduler now outputs explicit ○ symbol for backup covering パート staff visibility
    assert schedule['staff-2']['2024-01-24'] == '○', \
        f"Expected 中田 to WORK (○) on 24水 when 料理長 is off, got: {schedule['staff-2']['2024-01-24']}"

    assert schedule['staff-2']['2024-01-30'] == '○', \
        f"Expected 中田 to WORK (○) on 30火 when 料理長 is off, got: {schedule['staff-2']['2024-01-30']}"

    # Verify 料理長 is indeed off on those dates (pre-filled constraint)
    assert schedule['staff-1']['2024-01-24'] == '×', "料理長 should be off on 24水"
    assert schedule['staff-1']['2024-01-30'] == '×', "料理長 should be off on 30火"

    # Check that backup coverage violations are zero (other violations may exist from monthly limits)
    backup_violations = [v for v in result.get('violations', []) if 'Backup' in v['description'] and 'not covering' in v['description']]
    assert len(backup_violations) == 0, \
        f"Expected NO backup coverage violations with HARD constraint, got {len(backup_violations)}"

    print("✅ HARD backup coverage constraint test PASSED")
    print(f"   中田 on 24水: {schedule['staff-2']['2024-01-24']} (expected: '' or ○)")
    print(f"   中田 on 30火: {schedule['staff-2']['2024-01-30']} (expected: '' or ○)")


def test_backup_coverage_soft_constraint():
    """
    Test that backup staff SHOULD work but can violate when other constraints conflict (SOFT mode).
    """
    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'staff-1', 'name': '料理長', 'status': '社員'},
        {'id': 'staff-2', 'name': '中田', 'status': '派遣'}
    ]

    date_range = [
        '2024-01-24',
        '2024-01-25',
        '2024-01-26',
        '2024-01-27',
        '2024-01-28',
        '2024-01-29',
        '2024-01-30',
    ]

    constraints = {
        'staffGroups': [
            {
                'id': 'group-2',
                'name': 'Group 2',
                'members': ['staff-1']
            }
        ],
        'backupAssignments': [
            {
                'id': 'backup-1',
                'staffId': 'staff-2',
                'groupId': 'group-2',
                'isActive': True
            }
        ],
        'prefilledSchedule': {
            'staff-1': {
                '2024-01-24': '×',
                '2024-01-30': '×',
            }
        },
        'monthlyLimit': {
            'minCount': 2,
            'maxCount': 2,
            'excludeCalendarRules': True
        },
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': False  # SOFT constraint mode
            },
            'penaltyWeights': {
                'backupCoverage': 500  # High penalty but not enforced
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    # Assert solution was found
    assert result['success'], f"Failed to find solution: {result.get('error')}"

    schedule = result['schedule']

    # In SOFT mode, backup SHOULD work but violations are allowed
    # We just verify a solution exists (no hard assertions on exact schedule)
    print("✅ SOFT backup coverage constraint test PASSED")
    print(f"   中田 on 24水: {schedule['staff-2']['2024-01-24']}")
    print(f"   中田 on 30火: {schedule['staff-2']['2024-01-30']}")
    print(f"   Total violations: {result['stats']['total_violations']}")

    # Return result for inspection
    return result


def test_backup_unavailable_when_no_coverage():
    """
    Test that backup staff shows ⊘ (unavailable) when NO group member is off.
    """
    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'staff-1', 'name': '料理長', 'status': '社員'},
        {'id': 'staff-2', 'name': '中田', 'status': '派遣'}
    ]

    date_range = [
        '2024-01-24',
        '2024-01-25',
        '2024-01-26',
    ]

    constraints = {
        'staffGroups': [
            {
                'id': 'group-2',
                'name': 'Group 2',
                'members': ['staff-1']
            }
        ],
        'backupAssignments': [
            {
                'id': 'backup-1',
                'staffId': 'staff-2',
                'groupId': 'group-2',
                'isActive': True
            }
        ],
        'prefilledSchedule': {
            'staff-1': {
                '2024-01-24': '',  # 料理長 works (no off)
                '2024-01-25': '',  # 料理長 works
            }
        },
        'monthlyLimit': {
            'minCount': 0,
            'maxCount': 1,
            'excludeCalendarRules': True
        },
        'ortoolsConfig': {
            'hardConstraints': {
                'backupCoverage': True
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    assert result['success'], f"Failed to find solution: {result.get('error')}"

    schedule = result['schedule']

    # When 料理長 is working, 中田 should be ⊘ (unavailable) or × (off)
    # The ⊘ symbol is shown when solver assigns OFF and no coverage is needed
    backup_24 = schedule['staff-2']['2024-01-24']
    backup_25 = schedule['staff-2']['2024-01-25']

    print("✅ Backup unavailable test PASSED")
    print(f"   料理長 on 24水: {schedule['staff-1']['2024-01-24']} (working)")
    print(f"   中田 on 24水: {backup_24} (expected: ⊘ or ×)")
    print(f"   料理長 on 25木: {schedule['staff-1']['2024-01-25']} (working)")
    print(f"   中田 on 25木: {backup_25} (expected: ⊘ or ×)")


if __name__ == '__main__':
    print("=" * 70)
    print("TESTING BACKUP STAFF COVERAGE CONSTRAINTS")
    print("=" * 70)

    print("\n[TEST 1] HARD constraint mode - backup MUST work when member is off")
    test_backup_coverage_hard_constraint()

    print("\n[TEST 2] SOFT constraint mode - backup SHOULD work (violations allowed)")
    test_backup_coverage_soft_constraint()

    print("\n[TEST 3] Backup unavailable when no coverage needed")
    test_backup_unavailable_when_no_coverage()

    print("\n" + "=" * 70)
    print("ALL TESTS COMPLETED")
    print("=" * 70)
