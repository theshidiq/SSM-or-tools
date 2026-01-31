#!/usr/bin/env python3
"""
Test case to reproduce March 7 post-period day-off issue.

Based on user screenshot:
- March 3-6: Must day off (××××) - maintenance closure
- March 7: 小池 and 岸 still getting × (violation of HARD constraint)
- Settings: isHardConstraint=true, minPeriodLength=3
"""

import sys
import json
from datetime import datetime, timedelta
from scheduler import ShiftScheduleOptimizer

def test_march7_post_period_constraint():
    """
    Reproduce the exact scenario from user's screenshot.
    """

    # Create scheduler
    scheduler = ShiftScheduleOptimizer()

    # Staff members - including 小池 and 岸
    staff_members = [
        {"id": "staff_koike", "name": "小池", "status": "社員"},  # Regular employee
        {"id": "staff_kishi", "name": "岸", "status": "社員"},    # Regular employee
        {"id": "staff_tanaka", "name": "田中", "status": "社員"},
        {"id": "staff_suzuki", "name": "鈴木", "status": "派遣"},
    ]

    # Date range: March 1-15, 2026
    start_date = datetime(2026, 3, 1)
    date_range = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(15)]

    # Calendar rules: March 3-6 are must_day_off (maintenance closure - 4 consecutive days)
    calendar_rules = {
        "2026-03-03": {"must_day_off": True},
        "2026-03-04": {"must_day_off": True},
        "2026-03-05": {"must_day_off": True},
        "2026-03-06": {"must_day_off": True},
    }

    # Periods configuration: March 3-6 closure (4 days >= minPeriodLength of 3)
    periods = [
        {"start": "2026-03-03", "end": "2026-03-06"}
    ]

    # Early shift config with HARD constraint enabled (use "earlyShiftConfig" key, not "earlyShiftPreferences")
    early_shift_config = {
        "postPeriodConstraint": {
            "enabled": True,
            "isHardConstraint": True,      # HARD MODE
            "minPeriodLength": 3,           # Only 3+ day periods
            "postPeriodDays": 2,           # NEW: Protect 2 days after period (March 6 AND March 7)
            "avoidDayOffForShain": True,    # Applies to 社員
            "avoidDayOffForHaken": True,    # Applies to 派遣
            "allowEarlyForShain": True,
        }
    }

    # Constraints configuration
    constraints = {
        "calendarRules": calendar_rules,
        "periods": periods,
        "earlyShiftConfig": early_shift_config,
        "monthly_limits": {
            "min_days_off_per_month": 4,
            "max_days_off_per_month": 10,
        },
        "daily_limits": {
            "min_staff_off": 1,
            "max_staff_off": 2,
        },
        "staff_type_limits": {},
        "staff_groups": [],
        "ortools_config": {
            "solverSettings": {
                "timeout": 10,
                "numWorkers": 2,
            },
            "penaltyWeights": {},  # Use defaults
        }
    }

    print("=" * 80)
    print("TEST: March 6 & 7 Post-Period Day-Off Issue")
    print("=" * 80)
    print(f"\nStaff Members: {[s['name'] for s in staff_members]}")
    print(f"Date Range: {date_range[0]} to {date_range[-1]}")
    print(f"Must Day Off Period: March 3-6 (4 days)")
    print(f"Post-Period Days: 2 (protects March 7 AND March 8)")
    print(f"HARD Constraint: Enabled (penalty=10000)")
    print(f"Minimum Period Length: 3 days")
    print()

    # Run optimization
    print("Running OR-Tools optimization...")
    print("-" * 80)
    result = scheduler.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )
    print("-" * 80)
    print()

    # Check results
    if not result['success']:
        print(f"❌ OPTIMIZATION FAILED: {result.get('error', 'Unknown error')}")
        return False

    schedule = result['schedule']
    violations = result.get('violations', [])

    print("RESULTS:")
    print("=" * 80)

    # Check March 7 for 小池 and 岸
    march_7 = "2026-03-07"
    print(f"\n📅 March 7 Assignments:")
    for staff in staff_members:
        staff_id = staff['id']
        staff_name = staff['name']
        shift = schedule.get(staff_id, {}).get(march_7, '?')

        status = "✅ OK" if shift != "×" else "❌ VIOLATION"
        if staff_name in ["小池", "岸"]:
            print(f"  {staff_name} (社員): {shift} {status}")

    # Check violations
    print(f"\n📋 Violations Report ({len(violations)} total):")
    post_period_violations = [
        v for v in violations
        if isinstance(v, str) and ('post-period' in v.lower() or 'hard escape' in v.lower())
    ]

    if post_period_violations:
        print("  ⚠️  Post-Period Constraint Violations:")
        for v in post_period_violations:
            print(f"    - {v}")
    else:
        print("  ✅ No post-period violations")

    # Verify constraint was applied
    print(f"\n🔍 Verification:")
    koike_march7 = schedule.get("staff_koike", {}).get(march_7, '?')
    kishi_march7 = schedule.get("staff_kishi", {}).get(march_7, '?')

    success = True
    if koike_march7 == "×":
        print(f"  ❌ FAILED: 小池 has day-off on March 7 (should be prevented by HARD constraint)")
        success = False
    else:
        print(f"  ✅ PASSED: 小池 does NOT have day-off on March 7")

    if kishi_march7 == "×":
        print(f"  ❌ FAILED: 岸 has day-off on March 7 (should be prevented by HARD constraint)")
        success = False
    else:
        print(f"  ✅ PASSED: 岸 does NOT have day-off on March 7")

    print()
    print("=" * 80)

    if success:
        print("✅ TEST PASSED: HARD constraint is working correctly")
    else:
        print("❌ TEST FAILED: HARD constraint is NOT preventing day-offs on March 7")
        print("\nDEBUG INFO:")
        print(f"  - Post-period violations: {len(post_period_violations)}")
        print(f"  - Total violations: {len(violations)}")
        print(f"  - Is optimal: {result.get('is_optimal', False)}")
        print(f"  - Solve time: {result.get('solve_time', 0):.2f}s")

    print("=" * 80)

    return success


if __name__ == "__main__":
    success = test_march7_post_period_constraint()
    sys.exit(0 if success else 1)
