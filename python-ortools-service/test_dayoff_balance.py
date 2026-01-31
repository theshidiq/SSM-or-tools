#!/usr/bin/env python3
"""
Test case for day-off balance analysis.

Problem: Staff are "stuck" at 8.5 days off while backup staff has 18 days off.
This test analyzes why the solver gives uneven distribution.

The user's screenshot shows:
- 8.5, 8.5, 8.5, 11.5, 9.5, 9.5, 10, 11, 11, 18

Expected: More balanced distribution around 9-10 days each.
"""

import sys
import json
from datetime import datetime, timedelta
from scheduler import ShiftScheduleOptimizer

def test_dayoff_balance():
    """
    Test with 10 staff members and analyze day-off distribution.
    """

    # Create scheduler
    scheduler = ShiftScheduleOptimizer()

    # 10 Staff members - similar to user's actual data
    # The last one is typically the "backup" staff who gets excessive days off
    staff_members = [
        {"id": "staff_01", "name": "Staff 01", "status": "社員"},
        {"id": "staff_02", "name": "Staff 02", "status": "社員"},
        {"id": "staff_03", "name": "Staff 03", "status": "社員"},
        {"id": "staff_04", "name": "Staff 04", "status": "社員"},
        {"id": "staff_05", "name": "Staff 05", "status": "社員"},
        {"id": "staff_06", "name": "Staff 06", "status": "派遣"},
        {"id": "staff_07", "name": "Staff 07", "status": "派遣"},
        {"id": "staff_08", "name": "Staff 08", "status": "パート"},
        {"id": "staff_09", "name": "Staff 09", "status": "パート"},
        {"id": "staff_10", "name": "Backup Staff", "status": "パート"},  # Backup
    ]

    # Date range: March 1-31, 2026 (31 days)
    start_date = datetime(2026, 3, 1)
    date_range = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(31)]

    # Staff groups - last staff is backup for all groups
    # Using correct key "members" as expected by scheduler.py (line 1111)
    staff_groups = [
        {
            "id": "group_01",
            "name": "Group 1",
            "members": ["staff_01", "staff_02", "staff_10"],  # staff_10 is backup
            "description": "Test group 1",
        },
        {
            "id": "group_02",
            "name": "Group 2",
            "members": ["staff_03", "staff_04", "staff_10"],  # staff_10 is backup
            "description": "Test group 2",
        },
        {
            "id": "group_03",
            "name": "Group 3",
            "members": ["staff_05", "staff_06", "staff_10"],  # staff_10 is backup
            "description": "Test group 3",
        },
    ]

    # Constraints configuration - Using correct key names for scheduler.py
    constraints = {
        "staffGroups": staff_groups,  # Using camelCase as expected by scheduler
        "monthlyLimit": {
            "minCount": 6,   # At least 6 days off
            "maxCount": 10,  # At most 10 days off
            "excludeCalendarRules": True,
            "isHardConstraint": False,  # SOFT - allows flexibility
        },
        "dailyLimits": {
            "minStaffOff": 1,  # At least 1 person off per day
            "maxStaffOff": 3,  # Maximum 3 people off per day
        },
        "staffTypeLimits": {},
        "ortoolsConfig": {
            "solverSettings": {
                "timeout": 30,
                "numWorkers": 4,
            },
            "penaltyWeights": {},  # Use defaults
        }
    }

    print("=" * 80)
    print("TEST: Day-Off Balance Analysis")
    print("=" * 80)
    print(f"\nStaff Members: {len(staff_members)}")
    print(f"Date Range: {date_range[0]} to {date_range[-1]} ({len(date_range)} days)")
    print(f"Monthly Limits: min={constraints['monthlyLimit']['minCount']}, max={constraints['monthlyLimit']['maxCount']}")
    print(f"Daily Limits: min={constraints['dailyLimits']['minStaffOff']}, max={constraints['dailyLimits']['maxStaffOff']}")
    print(f"Staff Groups: {len(staff_groups)} groups (staff_10 is backup for all)")
    print()

    # Mathematical analysis
    print("📊 Mathematical Constraints Analysis:")
    total_days = len(date_range)
    num_staff = len(staff_members)
    min_daily_off = constraints['dailyLimits']['minStaffOff']
    max_daily_off = constraints['dailyLimits']['maxStaffOff']
    min_monthly_off = constraints['monthlyLimit']['minCount']
    max_monthly_off = constraints['monthlyLimit']['maxCount']

    total_min_off_slots = total_days * min_daily_off
    total_max_off_slots = total_days * max_daily_off
    total_min_off_needed = num_staff * min_monthly_off
    total_max_off_allowed = num_staff * max_monthly_off

    print(f"  - Total off slots available (daily max): {total_days} × {max_daily_off} = {total_max_off_slots}")
    print(f"  - Total off slots minimum (daily min): {total_days} × {min_daily_off} = {total_min_off_slots}")
    print(f"  - Total off needed (all staff min): {num_staff} × {min_monthly_off} = {total_min_off_needed}")
    print(f"  - Total off allowed (all staff max): {num_staff} × {max_monthly_off} = {total_max_off_allowed}")
    print(f"  - Feasible: {total_min_off_slots} ≤ distributed ≤ {total_max_off_slots}")
    print(f"  - Required: {total_min_off_needed} ≤ total ≤ {total_max_off_allowed}")

    # Average calculation
    avg_off_per_staff = total_max_off_slots / num_staff
    print(f"  - If evenly distributed: {total_max_off_slots}/{num_staff} = {avg_off_per_staff:.1f} per staff")
    print()

    # Run optimization
    print("Running OR-Tools optimization...")
    print("-" * 80)
    result = scheduler.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=30
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

    # Analyze day-off distribution
    dayoff_counts = {}
    early_counts = {}

    for staff in staff_members:
        staff_id = staff['id']
        staff_name = staff['name']
        staff_schedule = schedule.get(staff_id, {})

        dayoffs = sum(1 for d, s in staff_schedule.items() if s == '×')
        early = sum(1 for d, s in staff_schedule.items() if s == '△')

        dayoff_counts[staff_name] = dayoffs
        early_counts[staff_name] = early

    print(f"\n📅 Day-Off Distribution:")
    total_dayoffs = 0
    for staff in staff_members:
        staff_name = staff['name']
        dayoffs = dayoff_counts[staff_name]
        early = early_counts[staff_name]
        off_equiv = dayoffs + early * 0.5
        total_dayoffs += dayoffs

        status = ""
        if dayoffs < min_monthly_off:
            status = f" ⚠️  BELOW MIN ({min_monthly_off})"
        elif dayoffs > max_monthly_off:
            status = f" ⚠️  ABOVE MAX ({max_monthly_off})"

        is_backup = staff_name == "Backup Staff"
        print(f"  {staff_name:15} {'(BACKUP)' if is_backup else '        '}: × = {dayoffs:2}, △ = {early:2}, equiv = {off_equiv:.1f}{status}")

    print(f"\n  Total day-offs assigned: {total_dayoffs}")
    print(f"  Average per staff: {total_dayoffs/num_staff:.1f}")
    print(f"  Expected average: {avg_off_per_staff:.1f}")

    # Check daily distribution
    print(f"\n📊 Daily Off Counts:")
    daily_off_counts = {}
    for date in date_range:
        off_count = sum(1 for staff in staff_members if schedule.get(staff['id'], {}).get(date) == '×')
        daily_off_counts[date] = off_count

    # Histogram
    count_histogram = {}
    for date, count in daily_off_counts.items():
        count_histogram[count] = count_histogram.get(count, 0) + 1

    print(f"  Distribution of daily off counts:")
    for count in sorted(count_histogram.keys()):
        print(f"    {count} staff off: {count_histogram[count]} days")

    # Check violations
    print(f"\n📋 Violations Report ({len(violations)} total):")
    if violations:
        for v in violations[:10]:  # Show first 10
            print(f"  - {v}")
        if len(violations) > 10:
            print(f"  ... and {len(violations) - 10} more")
    else:
        print("  ✅ No violations")

    # Verification
    print(f"\n🔍 Verification:")
    success = True

    # Check 1: All staff meet minimum
    below_min = [name for name, count in dayoff_counts.items() if count < min_monthly_off]
    if not below_min:
        print(f"  ✅ PASSED: All staff have at least {min_monthly_off} day-offs")
    else:
        print(f"  ❌ FAILED: {len(below_min)} staff below minimum: {below_min}")
        success = False

    # Check 2: All staff within maximum
    above_max = [name for name, count in dayoff_counts.items() if count > max_monthly_off]
    if not above_max:
        print(f"  ✅ PASSED: All staff within {max_monthly_off} day-offs maximum")
    else:
        print(f"  ❌ FAILED: {len(above_max)} staff above maximum: {above_max}")
        success = False

    # Check 3: Balance (std deviation)
    import statistics
    counts = list(dayoff_counts.values())
    mean = statistics.mean(counts)
    stdev = statistics.stdev(counts) if len(counts) > 1 else 0

    print(f"\n  📈 Balance Statistics:")
    print(f"      Mean: {mean:.1f}")
    print(f"      Std Dev: {stdev:.1f}")
    print(f"      Min: {min(counts)}")
    print(f"      Max: {max(counts)}")
    print(f"      Range: {max(counts) - min(counts)}")

    if stdev <= 2.0:  # Good balance
        print(f"  ✅ PASSED: Good balance (std dev ≤ 2.0)")
    else:
        print(f"  ⚠️  WARNING: Uneven balance (std dev = {stdev:.1f} > 2.0)")

    print()
    print("=" * 80)

    if success:
        print("✅ TEST PASSED: Day-off distribution is within limits")
    else:
        print("❌ TEST FAILED: Day-off distribution has issues")

    print("=" * 80)

    return success


if __name__ == "__main__":
    success = test_dayoff_balance()
    sys.exit(0 if success else 1)
