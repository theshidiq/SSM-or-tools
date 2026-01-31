#!/usr/bin/env python3
"""
Test case for backup staff monthly limit fix.

Problem: Backup staff (assigned via backupAssignments) were completely EXEMPT
from monthly limits, causing them to accumulate excessive day-offs (18+)
which starved other staff of their fair share.

Fix: Apply RELAXED limits (1.5x normal max) to backup staff instead of exempting them.

Expected behavior:
- Normal staff: min=6, max=10 off days
- Backup staff: min=0, max=15 off days (1.5x of 10)
"""

import sys
import json
from datetime import datetime, timedelta
from scheduler import ShiftScheduleOptimizer

def test_backup_staff_monthly_limit():
    """
    Test with backup assignments to verify backup staff get relaxed (not exempt) limits.
    """

    # Create scheduler
    scheduler = ShiftScheduleOptimizer()

    # 10 Staff members - similar to user's actual data
    staff_members = [
        {"id": "staff_01", "name": "料理長", "status": "社員"},
        {"id": "staff_02", "name": "小池", "status": "社員"},
        {"id": "staff_03", "name": "岸", "status": "社員"},
        {"id": "staff_04", "name": "田中", "status": "社員"},
        {"id": "staff_05", "name": "鈴木", "status": "社員"},
        {"id": "staff_06", "name": "佐藤", "status": "派遣"},
        {"id": "staff_07", "name": "山本", "status": "派遣"},
        {"id": "staff_08", "name": "中村", "status": "パート"},
        {"id": "staff_09", "name": "加藤", "status": "パート"},
        {"id": "staff_10", "name": "バックアップ君", "status": "パート"},  # BACKUP
    ]

    # Date range: March 1-31, 2026 (31 days)
    start_date = datetime(2026, 3, 1)
    date_range = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(31)]

    # Staff groups
    staff_groups = [
        {
            "id": "group_01",
            "name": "調理A",
            "members": ["staff_01", "staff_02", "staff_10"],
        },
        {
            "id": "group_02",
            "name": "調理B",
            "members": ["staff_03", "staff_04", "staff_10"],
        },
        {
            "id": "group_03",
            "name": "調理C",
            "members": ["staff_05", "staff_06", "staff_10"],
        },
    ]

    # Backup assignments - staff_10 covers all groups
    # This is the key configuration that makes staff_10 a "backup staff"
    backup_assignments = [
        {
            "backupStaffId": "staff_10",
            "groupId": "group_01",
        },
        {
            "backupStaffId": "staff_10",
            "groupId": "group_02",
        },
        {
            "backupStaffId": "staff_10",
            "groupId": "group_03",
        },
    ]

    # Constraints configuration
    constraints = {
        "staffGroups": staff_groups,
        "backupAssignments": backup_assignments,
        "monthlyLimit": {
            "minCount": 6,   # At least 6 days off
            "maxCount": 10,  # At most 10 days off
            "excludeCalendarRules": True,
            "isHardConstraint": False,  # SOFT - allows flexibility
        },
        "dailyLimits": {
            "minStaffOff": 1,
            "maxStaffOff": 3,
        },
        "ortoolsConfig": {
            "solverSettings": {
                "timeout": 30,
                "numWorkers": 4,
            },
            "penaltyWeights": {},
            "hardConstraints": {
                "staffGroups": True,  # HARD constraint for staff groups (causes backup to work more)
            }
        }
    }

    print("=" * 80)
    print("TEST: Backup Staff Monthly Limit Fix")
    print("=" * 80)
    print(f"\nStaff Members: {len(staff_members)}")
    print(f"Date Range: {date_range[0]} to {date_range[-1]} ({len(date_range)} days)")
    print(f"Normal Monthly Limits: min={constraints['monthlyLimit']['minCount']}, max={constraints['monthlyLimit']['maxCount']}")
    print(f"Backup Staff Limits: min=0, max=15 (1.5x normal max)")
    print(f"Backup Assignments: staff_10 covers 3 groups")
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
    backup_staff_id = "staff_10"

    for staff in staff_members:
        staff_id = staff['id']
        staff_name = staff['name']
        staff_schedule = schedule.get(staff_id, {})

        dayoffs = sum(1 for d, s in staff_schedule.items() if s == '×')
        early = sum(1 for d, s in staff_schedule.items() if s == '△')

        dayoff_counts[staff_id] = dayoffs
        early_counts[staff_id] = early

    print(f"\n📅 Day-Off Distribution:")
    total_dayoffs = 0
    for staff in staff_members:
        staff_id = staff['id']
        staff_name = staff['name']
        dayoffs = dayoff_counts[staff_id]
        early = early_counts[staff_id]
        off_equiv = dayoffs + early * 0.5
        total_dayoffs += dayoffs

        is_backup = staff_id == backup_staff_id
        limit_info = "relaxed: max=15" if is_backup else "normal: max=10"

        status = ""
        if is_backup:
            if dayoffs > 15:
                status = f" ❌ ABOVE RELAXED MAX (15)"
            elif dayoffs <= 10:
                status = f" ✅ Within normal range"
        else:
            if dayoffs < 6:
                status = f" ⚠️  BELOW MIN (6)"
            elif dayoffs > 10:
                status = f" ⚠️  ABOVE MAX (10)"
            else:
                status = f" ✅"

        is_backup_tag = " (BACKUP)" if is_backup else ""
        print(f"  {staff_name:12}{is_backup_tag:10}: × = {dayoffs:2}, △ = {early:2}, equiv = {off_equiv:5.1f} [{limit_info}]{status}")

    print(f"\n  Total day-offs assigned: {total_dayoffs}")

    # Check violations
    print(f"\n📋 Violations Report ({len(violations)} total):")
    backup_violations = [v for v in violations if 'backup' in str(v).lower() or 'バックアップ' in str(v)]
    if backup_violations:
        for v in backup_violations[:5]:
            print(f"  - {v}")
    else:
        print("  ✅ No backup-related violations")

    # Verification
    print(f"\n🔍 Verification:")
    success = True

    # Check 1: Backup staff should have RELAXED max (15), not unlimited
    backup_dayoffs = dayoff_counts[backup_staff_id]
    if backup_dayoffs <= 15:
        print(f"  ✅ PASSED: Backup staff has {backup_dayoffs} day-offs (≤ relaxed max 15)")
    else:
        print(f"  ❌ FAILED: Backup staff has {backup_dayoffs} day-offs (> relaxed max 15)")
        success = False

    # Check 2: Backup staff should not have excessive day-offs (the old bug was 18+)
    if backup_dayoffs <= 12:  # Reasonable upper bound
        print(f"  ✅ PASSED: Backup staff day-offs ({backup_dayoffs}) is reasonable (≤ 12)")
    else:
        print(f"  ⚠️  WARNING: Backup staff has {backup_dayoffs} day-offs (> 12, may affect balance)")

    # Check 3: Normal staff should meet minimum
    normal_below_min = [(s['name'], dayoff_counts[s['id']]) for s in staff_members
                        if s['id'] != backup_staff_id and dayoff_counts[s['id']] < 6]
    if not normal_below_min:
        print(f"  ✅ PASSED: All normal staff have at least 6 day-offs")
    else:
        print(f"  ❌ FAILED: Some normal staff below minimum: {normal_below_min}")
        success = False

    # Check 4: Normal staff should not exceed maximum
    normal_above_max = [(s['name'], dayoff_counts[s['id']]) for s in staff_members
                        if s['id'] != backup_staff_id and dayoff_counts[s['id']] > 10]
    if not normal_above_max:
        print(f"  ✅ PASSED: All normal staff within maximum (10)")
    else:
        print(f"  ⚠️  WARNING: Some normal staff above maximum: {normal_above_max}")

    print()
    print("=" * 80)

    if success:
        print("✅ TEST PASSED: Backup staff monthly limit is properly constrained")
    else:
        print("❌ TEST FAILED: Backup staff monthly limit issue detected")

    print("=" * 80)

    return success


if __name__ == "__main__":
    success = test_backup_staff_monthly_limit()
    sys.exit(0 if success else 1)
