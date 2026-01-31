#!/usr/bin/env python3
"""
Test case for 料理長 (Head Chef) day-off issue.

Problem: 料理長 has a priority rule that avoids day-offs on Sat/Sun/Tue,
but he should still be able to get day-offs on FREE days (Mon/Wed/Thu/Fri).

The priority rule:
- Type: avoid_shift_with_exceptions
- Avoided shift: day-off (×)
- Allowed shifts: early (△), day-off (×) [on exception days]
- Days: Sunday, Saturday, Tuesday

Expected behavior:
- On Sat/Sun/Tue: 料理長 should get early shifts (△) or work (○), not day-off (×)
- On Mon/Wed/Thu/Fri: 料理長 should get some day-offs (×) to meet minimum rest requirements
"""

import sys
import json
from datetime import datetime, timedelta
from scheduler import ShiftScheduleOptimizer

def test_head_chef_priority_rule():
    """
    Simulate 料理長's schedule with avoid-dayoff priority rule.
    Verify he gets day-offs on free days (Mon/Wed/Thu/Fri).
    """

    # Create scheduler
    scheduler = ShiftScheduleOptimizer()

    # Staff members - 料理長 is the head chef
    staff_members = [
        {"id": "staff_ryourichou", "name": "料理長", "status": "社員"},  # Head chef with priority rule
        {"id": "staff_koike", "name": "小池", "status": "社員"},
        {"id": "staff_kishi", "name": "岸", "status": "社員"},
        {"id": "staff_tanaka", "name": "田中", "status": "社員"},
        {"id": "staff_suzuki", "name": "鈴木", "status": "派遣"},
    ]

    # Date range: Feb 1-28, 2026 (full month)
    start_date = datetime(2026, 2, 1)
    date_range = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(28)]

    # Priority rules - 料理長's avoid_shift_with_exceptions rule
    priority_rules = [
        {
            "id": "rule_ryourichou_avoid_dayoff",
            "isActive": True,
            "ruleType": "avoid_shift_with_exceptions",
            "staffIds": ["staff_ryourichou"],
            "shiftType": "off",  # Avoid day-off
            "allowedShifts": ["early", "off"],  # But allow early shifts and off (exceptions)
            "daysOfWeek": [0, 2, 6],  # Sunday=0, Tuesday=2, Saturday=6
            "ruleDefinition": {
                "type": "avoid_shift_with_exceptions",
                "shiftType": "off",
                "allowedShifts": ["early", "off"],
            },
            "preferences": {
                "avoidedShift": "off",
                "allowedShifts": ["early", "off"]
            }
        }
    ]

    # Constraints configuration
    constraints = {
        "priorityRules": priority_rules,
        "monthly_limits": {
            "min_days_off_per_month": 4,  # Minimum 4 days off per month
            "max_days_off_per_month": 10,  # Maximum 10 days off per month
        },
        "daily_limits": {
            "min_staff_off": 1,  # At least 1 person off per day
            "max_staff_off": 2,  # Maximum 2 people off per day
        },
        "staff_type_limits": {},
        "staff_groups": [],
        "ortools_config": {
            "solverSettings": {
                "timeout": 15,
                "numWorkers": 4,
            },
            "penaltyWeights": {},  # Use defaults
        }
    }

    print("=" * 80)
    print("TEST: 料理長 Day-Off on Free Days (Mon/Wed/Thu/Fri)")
    print("=" * 80)
    print(f"\nStaff Members: {[s['name'] for s in staff_members]}")
    print(f"Date Range: {date_range[0]} to {date_range[-1]}")
    print(f"\nPriority Rule for 料理長:")
    print(f"  - Avoid: day-off (×) on Sunday, Tuesday, Saturday")
    print(f"  - Allow: early shift (△) on those days")
    print(f"  - FREE days: Monday, Wednesday, Thursday, Friday")
    print()

    # Run optimization
    print("Running OR-Tools optimization...")
    print("-" * 80)
    result = scheduler.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=15
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

    # Analyze 料理長's schedule
    ryourichou_schedule = schedule.get("staff_ryourichou", {})

    # Categorize shifts by day of week
    day_names = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'}
    rule_days = [0, 2, 6]  # Sunday, Tuesday, Saturday
    free_days = [1, 3, 4, 5]  # Monday, Wednesday, Thursday, Friday

    rule_day_shifts = []  # Shifts on rule days
    free_day_shifts = []  # Shifts on free days

    dayoffs_on_free_days = 0
    early_on_rule_days = 0
    dayoffs_on_rule_days = 0

    for date in date_range:
        shift = ryourichou_schedule.get(date, '○')
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        day_of_week = date_obj.weekday()  # 0=Mon, 6=Sun
        # Convert to JS convention: 0=Sun, 6=Sat
        js_dow = (day_of_week + 1) % 7

        if js_dow in rule_days:
            rule_day_shifts.append((date, day_names[js_dow], shift))
            if shift == '△':
                early_on_rule_days += 1
            elif shift == '×':
                dayoffs_on_rule_days += 1
        else:
            free_day_shifts.append((date, day_names[js_dow], shift))
            if shift == '×':
                dayoffs_on_free_days += 1

    print(f"\n📅 料理長's Schedule Analysis:")
    print(f"\n  RULE DAYS (Sat/Sun/Tue) - Should avoid ×, prefer △:")
    for date, day_name, shift in rule_day_shifts[:7]:  # Show first week
        status = "✅ OK" if shift != '×' else "⚠️  Violation"
        print(f"    {date} ({day_name}): {shift} {status}")
    print(f"  ... (total: {len(rule_day_shifts)} rule days)")
    print(f"    Early shifts (△): {early_on_rule_days}")
    print(f"    Day-offs (×): {dayoffs_on_rule_days} {'⚠️' if dayoffs_on_rule_days > 0 else ''}")

    print(f"\n  FREE DAYS (Mon/Wed/Thu/Fri) - Should get some ×:")
    for date, day_name, shift in free_day_shifts[:7]:  # Show first week
        status = "✅ DAY-OFF" if shift == '×' else ""
        print(f"    {date} ({day_name}): {shift} {status}")
    print(f"  ... (total: {len(free_day_shifts)} free days)")
    print(f"    Day-offs (×): {dayoffs_on_free_days}")

    # Count total day-offs for 料理長
    total_dayoffs = sum(1 for d, s in ryourichou_schedule.items() if s == '×')
    total_early = sum(1 for d, s in ryourichou_schedule.items() if s == '△')

    print(f"\n📊 Summary for 料理長:")
    print(f"  Total day-offs (×): {total_dayoffs}")
    print(f"  Total early shifts (△): {total_early}")
    print(f"  Rest equivalent: {total_dayoffs * 2 + total_early * 1}")

    # Verification
    print(f"\n🔍 Verification:")
    success = True

    # Check 1: Should have at least some day-offs on free days
    if dayoffs_on_free_days >= 2:  # Expect at least 2 over 28 days
        print(f"  ✅ PASSED: 料理長 has {dayoffs_on_free_days} day-offs on free days (Mon/Wed/Thu/Fri)")
    else:
        print(f"  ❌ FAILED: 料理長 only has {dayoffs_on_free_days} day-offs on free days (expected ≥2)")
        success = False

    # Check 2: Should have early shifts on rule days
    if early_on_rule_days >= 2:  # Expect at least 2 early shifts on rule days
        print(f"  ✅ PASSED: 料理長 has {early_on_rule_days} early shifts on rule days (Sat/Sun/Tue)")
    else:
        print(f"  ⚠️  WARNING: 料理長 only has {early_on_rule_days} early shifts on rule days")

    # Check 3: Should meet minimum rest requirement
    rest_equiv = total_dayoffs * 2 + total_early
    min_rest = 4  # At least 4 rest equivalent (= 2 days off or 4 early shifts)
    if rest_equiv >= min_rest:
        print(f"  ✅ PASSED: 料理長 rest equivalent = {rest_equiv} (≥{min_rest})")
    else:
        print(f"  ❌ FAILED: 料理長 rest equivalent = {rest_equiv} (<{min_rest})")
        success = False

    # Check 4: Day-offs on rule days should be minimal
    if dayoffs_on_rule_days == 0:
        print(f"  ✅ PASSED: 料理長 has no day-offs on rule days (Sat/Sun/Tue)")
    else:
        print(f"  ⚠️  WARNING: 料理長 has {dayoffs_on_rule_days} day-offs on rule days (should avoid)")

    print()
    print("=" * 80)

    if success:
        print("✅ TEST PASSED: Priority rule rest guarantee is working")
    else:
        print("❌ TEST FAILED: 料理長 is not getting enough rest on free days")
        print("\nDEBUG INFO:")
        print(f"  - Total day-offs: {total_dayoffs}")
        print(f"  - Day-offs on free days: {dayoffs_on_free_days}")
        print(f"  - Total violations: {len(violations)}")
        print(f"  - Is optimal: {result.get('is_optimal', False)}")
        print(f"  - Solve time: {result.get('solve_time', 0):.2f}s")

    print("=" * 80)

    return success


if __name__ == "__main__":
    success = test_head_chef_priority_rule()
    sys.exit(0 if success else 1)
