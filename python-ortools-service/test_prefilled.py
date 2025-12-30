#!/usr/bin/env python3
"""
Test script for pre-filled cells feature in OR-Tools scheduler.
"""

import requests
import json

def test_prefilled_cells():
    """Test that pre-filled cells are preserved as HARD constraints."""

    url = "http://localhost:5001/optimize"

    payload = {
        "staffMembers": [
            {"id": "staff-1", "name": "田中太郎", "status": "社員", "position": "調理"},
            {"id": "staff-2", "name": "山田花子", "status": "社員", "position": "調理"},
            {"id": "staff-3", "name": "佐藤次郎", "status": "パート", "position": "ホール"}
        ],
        "dateRange": ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05"],
        "constraints": {
            "calendarRules": {},
            "staffGroups": [],
            "monthlyLimit": {"minCount": 1, "maxCount": 2, "excludeCalendarRules": True},
            "staffTypeLimits": {"社員": {"maxOff": 1, "maxEarly": 2, "isHard": True}},
            "prefilledSchedule": {
                "staff-1": {
                    "2025-01-02": "×",  # Day off - should be preserved
                    "2025-01-05": "★"   # Star symbol - should be preserved
                },
                "staff-2": {
                    "2025-01-03": "△"   # Early shift - should be preserved
                }
            }
        },
        "timeout": 10
    }

    print("=" * 60)
    print("Testing Pre-filled Cells Feature")
    print("=" * 60)
    print("\nPre-filled cells:")
    print("  - staff-1 on 2025-01-02: × (day off)")
    print("  - staff-1 on 2025-01-05: ★ (star symbol)")
    print("  - staff-2 on 2025-01-03: △ (early shift)")
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
        print("-" * 60)

        for staff_id in ["staff-1", "staff-2", "staff-3"]:
            staff_schedule = schedule.get(staff_id, {})
            name = next((s['name'] for s in payload['staffMembers'] if s['id'] == staff_id), staff_id)
            row = f"  {name}: "
            for date in payload['dateRange']:
                shift = staff_schedule.get(date, '?')
                if not shift:
                    shift = '○'  # Show empty as maru
                row += f"{shift} "
            print(row)

        print("-" * 60)
        print()

        # Verify pre-filled cells are preserved
        print("Verification:")

        # Check staff-1 on 2025-01-02 = ×
        s1_jan02 = schedule.get('staff-1', {}).get('2025-01-02', '')
        s1_check = "✓" if s1_jan02 == '×' else "✗"
        print(f"  {s1_check} staff-1 on 2025-01-02: expected '×', got '{s1_jan02}'")

        # Check staff-1 on 2025-01-05 = ★
        s1_jan05 = schedule.get('staff-1', {}).get('2025-01-05', '')
        s1_star_check = "✓" if s1_jan05 == '★' else "✗"
        print(f"  {s1_star_check} staff-1 on 2025-01-05: expected '★', got '{s1_jan05}'")

        # Check staff-2 on 2025-01-03 = △
        s2_jan03 = schedule.get('staff-2', {}).get('2025-01-03', '')
        s2_check = "✓" if s2_jan03 == '△' else "✗"
        print(f"  {s2_check} staff-2 on 2025-01-03: expected '△', got '{s2_jan03}'")

        all_passed = s1_jan02 == '×' and s1_jan05 == '★' and s2_jan03 == '△'
        print()
        if all_passed:
            print("✅ All pre-filled cells preserved correctly!")
        else:
            print("❌ Some pre-filled cells were not preserved!")

        return all_passed
    else:
        print(f"Error: {result.get('error')}")
        return False


if __name__ == "__main__":
    success = test_prefilled_cells()
    exit(0 if success else 1)
