#!/usr/bin/env python3
"""
Test script for pre-filled cells integration with monthly limits.

This test verifies that:
1. Pre-filled OFF days (×) count towards monthly limits
2. If max_off=3 and staff has 2 pre-filled ×, only 1 more × can be assigned
"""

import requests
import json

def test_prefilled_monthly_limits():
    """Test that pre-filled OFF days count towards monthly limits."""

    url = "http://localhost:5001/optimize"

    # Test scenario:
    # - Monthly limit: max 3 off days
    # - staff-1 has 2 pre-filled × days
    # - Expected: staff-1 should get at most 1 more × day (total 3)

    payload = {
        "staffMembers": [
            {"id": "staff-1", "name": "田中太郎", "status": "社員", "position": "調理"},
            {"id": "staff-2", "name": "山田花子", "status": "社員", "position": "調理"},
        ],
        "dateRange": [
            "2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05",
            "2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10"
        ],
        "constraints": {
            "calendarRules": {},
            "staffGroups": [],
            # Monthly limit: min 2, max 3 off days
            "monthlyLimit": {
                "minCount": 2,
                "maxCount": 3,
                "excludeCalendarRules": True
            },
            "staffTypeLimits": {},
            # staff-1 has 2 pre-filled × days
            "prefilledSchedule": {
                "staff-1": {
                    "2025-01-02": "×",  # Pre-filled day off
                    "2025-01-05": "×",  # Pre-filled day off
                }
            }
        },
        "timeout": 10
    }

    print("=" * 70)
    print("Testing Pre-filled Cells Integration with Monthly Limits")
    print("=" * 70)
    print()
    print("Configuration:")
    print(f"  Monthly limit: min=2, max=3 off days")
    print(f"  Date range: 10 days (2025-01-01 to 2025-01-10)")
    print()
    print("Pre-filled cells:")
    print(f"  staff-1 (田中太郎): 2 pre-filled × days (2025-01-02, 2025-01-05)")
    print(f"  staff-2 (山田花子): 0 pre-filled days")
    print()
    print("Expected behavior:")
    print(f"  staff-1: Should get at most 1 more × (2 pre-filled + 1 = 3 total)")
    print(f"  staff-2: Should get 2-3 × days (normal monthly limit)")
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

        print(f"Pre-filled cells preserved: {stats.get('prefilled_cells', 0)}")
        print()

        print("Generated Schedule:")
        print("-" * 70)

        date_range = payload['dateRange']
        header = "Staff        | " + " | ".join([d[-2:] for d in date_range]) + " | Total ×"
        print(header)
        print("-" * 70)

        results = {}
        for staff in payload['staffMembers']:
            staff_id = staff['id']
            staff_name = staff['name']
            staff_schedule = schedule.get(staff_id, {})

            row = f"{staff_name:12} | "
            off_count = 0

            for date in date_range:
                shift = staff_schedule.get(date, '')
                if not shift:
                    shift = '○'
                row += f" {shift} | "

                if shift == '×':
                    off_count += 1

            row += f"  {off_count}"
            print(row)

            results[staff_id] = {
                'name': staff_name,
                'off_count': off_count,
                'schedule': staff_schedule
            }

        print("-" * 70)
        print()

        # Verify results
        print("Verification:")

        # Check staff-1: should have exactly 3 off days (2 pre-filled + 1 assigned)
        # Or possibly fewer if other constraints prevent it
        staff1_off = results['staff-1']['off_count']
        staff1_check = "✓" if staff1_off <= 3 else "✗"
        print(f"  {staff1_check} staff-1 (田中太郎): {staff1_off} off days (max allowed: 3)")

        # Verify pre-filled days are preserved
        s1_jan02 = schedule.get('staff-1', {}).get('2025-01-02', '')
        s1_jan05 = schedule.get('staff-1', {}).get('2025-01-05', '')
        prefilled_ok = s1_jan02 == '×' and s1_jan05 == '×'
        prefilled_check = "✓" if prefilled_ok else "✗"
        print(f"  {prefilled_check} Pre-filled days preserved: 01-02={s1_jan02}, 01-05={s1_jan05}")

        # Check staff-2: should have 2-3 off days (normal monthly limit)
        staff2_off = results['staff-2']['off_count']
        staff2_check = "✓" if 2 <= staff2_off <= 3 else "✗"
        print(f"  {staff2_check} staff-2 (山田花子): {staff2_off} off days (expected: 2-3)")

        # Summary
        all_passed = (
            staff1_off <= 3 and
            prefilled_ok and
            2 <= staff2_off <= 3
        )

        print()
        if all_passed:
            print("✅ Monthly limits correctly account for pre-filled off days!")
        else:
            print("❌ Some monthly limit constraints were not met!")

        # Show violations if any
        violations = result.get('violations', [])
        if violations:
            print()
            print("Violations:")
            for v in violations[:5]:
                print(f"  - {v['description']}: {v['count']}")

        return all_passed
    else:
        print(f"Error: {result.get('error')}")
        return False


if __name__ == "__main__":
    success = test_prefilled_monthly_limits()
    exit(0 if success else 1)
