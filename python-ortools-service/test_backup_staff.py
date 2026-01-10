#!/usr/bin/env python3
"""
Test script for backup staff constraint logic.

This test verifies that:
1. When ANY group member has day off (×), backup staff MUST work (○)
2. When NO group member has day off, backup staff gets Unavailable (⊘)
"""

import requests
import json

def test_backup_staff_constraint():
    """Test backup staff coverage constraint."""

    url = "http://localhost:5001/optimize"

    # Test scenario:
    # - Group "Group 2" has members: staff-1 (料理長), staff-2 (古藤)
    # - staff-3 (中田) is backup for Group 2
    # - staff-4 is a normal staff (not backup, not in any group)
    #
    # Expected behavior:
    # - When staff-1 or staff-2 has × → staff-3 MUST have ○
    # - When neither staff-1 nor staff-2 has × → staff-3 gets ⊘

    payload = {
        "staffMembers": [
            {"id": "staff-1", "name": "料理長", "status": "社員", "position": "調理"},
            {"id": "staff-2", "name": "古藤", "status": "社員", "position": "調理"},
            {"id": "staff-3", "name": "中田", "status": "社員", "position": "調理"},  # Backup staff
            {"id": "staff-4", "name": "山田", "status": "社員", "position": "調理"},  # Normal staff
        ],
        "dateRange": [
            "2025-01-20", "2025-01-21", "2025-01-22", "2025-01-23", "2025-01-24",
            "2025-01-25", "2025-01-26", "2025-01-27", "2025-01-28", "2025-01-29"
        ],
        "constraints": {
            "calendarRules": {},
            "staffGroups": [
                {
                    "id": "group-2",
                    "name": "Group 2",
                    "members": ["staff-1", "staff-2"],  # 料理長 and 古藤
                    "description": "Kitchen team"
                }
            ],
            # Monthly limit: 2-3 off days per staff (so we force some off days)
            "monthlyLimit": {
                "minCount": 2,
                "maxCount": 3,
                "excludeCalendarRules": True
            },
            # staff-3 (中田) is backup for Group 2
            "backupAssignments": [
                {
                    "id": "backup-1",
                    "staffId": "staff-3",  # 中田
                    "groupId": "group-2",  # Group 2
                    "isActive": True
                }
            ],
            # Disable staff type limits for cleaner test
            "staffTypeLimits": {},
            "prefilledSchedule": {}
        },
        "timeout": 10
    }

    print("=" * 70)
    print("Testing Backup Staff Coverage Constraint")
    print("=" * 70)
    print()
    print("Configuration:")
    print(f"  Group 2 members: staff-1 (料理長), staff-2 (古藤)")
    print(f"  Backup staff: staff-3 (中田) → covers Group 2")
    print(f"  Normal staff: staff-4 (山田) - not backup")
    print(f"  Date range: 10 days (2025-01-20 to 2025-01-29)")
    print()
    print("Expected behavior:")
    print(f"  When staff-1 or staff-2 has × → staff-3 (中田) MUST have ○")
    print(f"  When neither staff-1 nor staff-2 has × → staff-3 (中田) gets ⊘")
    print()

    response = requests.post(url, json=payload)
    result = response.json()

    print(f"Status: {response.status_code}")
    print(f"Success: {result.get('success')}")
    print(f"Is Optimal: {result.get('is_optimal')}")
    print(f"Solve Time: {result.get('solve_time', 0):.3f}s")
    print()

    if result.get('success'):
        schedule = result.get('schedule', {})
        stats = result.get('stats', {})

        print("Generated Schedule:")
        print("-" * 70)

        date_range = payload['dateRange']
        header = "Staff        | " + " | ".join([d[-2:] for d in date_range]) + " | Shifts"
        print(header)
        print("-" * 70)

        results = {}
        for staff in payload['staffMembers']:
            staff_id = staff['id']
            staff_name = staff['name']
            staff_schedule = schedule.get(staff_id, {})

            row = f"{staff_name:12} | "
            shifts = {}
            shifts['○'] = 0  # Work
            shifts['×'] = 0  # Off
            shifts['⊘'] = 0  # Unavailable

            for date in date_range:
                shift = staff_schedule.get(date, '')
                if not shift:
                    shift = '○'
                row += f" {shift} | "

                if shift in shifts:
                    shifts[shift] += 1
                elif shift == '':
                    shifts['○'] += 1
                else:
                    shifts['○'] += 1

            row += f"○:{shifts['○']} ×:{shifts['×']} ⊘:{shifts['⊘']}"
            print(row)

            results[staff_id] = {
                'name': staff_name,
                'shifts': shifts,
                'schedule': staff_schedule
            }

        print("-" * 70)
        print()

        # Verify backup constraint
        print("Verification:")

        errors = []
        correct = 0
        total = 0

        for date in date_range:
            # Check if any group member (staff-1 or staff-2) has off
            s1_shift = schedule.get('staff-1', {}).get(date, '○')
            s2_shift = schedule.get('staff-2', {}).get(date, '○')
            s3_shift = schedule.get('staff-3', {}).get(date, '')

            any_member_off = s1_shift == '×' or s2_shift == '×'

            total += 1

            if any_member_off:
                # Backup should work (○ or empty)
                if s3_shift in ['○', '', '△', '◇']:
                    correct += 1
                    print(f"  ✓ {date}: Group member off (料理長={s1_shift}, 古藤={s2_shift}) → 中田 works ({s3_shift})")
                else:
                    errors.append(f"{date}: Expected 中田 to work but got {s3_shift}")
                    print(f"  ✗ {date}: Group member off (料理長={s1_shift}, 古藤={s2_shift}) → 中田 should work, got {s3_shift}")
            else:
                # Backup should be unavailable (⊘)
                if s3_shift == '⊘':
                    correct += 1
                    print(f"  ✓ {date}: No group member off (料理長={s1_shift}, 古藤={s2_shift}) → 中田 unavailable (⊘)")
                else:
                    errors.append(f"{date}: Expected 中田 to be unavailable (⊘) but got {s3_shift}")
                    print(f"  ✗ {date}: No group member off (料理長={s1_shift}, 古藤={s2_shift}) → 中田 should be ⊘, got {s3_shift}")

        print()
        print(f"Results: {correct}/{total} days correct")

        if not errors:
            print("✅ Backup staff constraint working correctly!")
            return True
        else:
            print("❌ Backup staff constraint has errors:")
            for err in errors:
                print(f"  - {err}")
            return False
    else:
        print(f"Error: {result.get('error')}")
        return False


if __name__ == "__main__":
    success = test_backup_staff_constraint()
    exit(0 if success else 1)
