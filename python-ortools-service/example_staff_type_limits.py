"""
Example script demonstrating staff type daily limits feature.

This script shows how to use the new per-staff-type daily limits feature
to control how many staff of each type can be off or on early shift per day.

Run with: python example_staff_type_limits.py
"""

from scheduler import ShiftScheduleOptimizer
import json


def print_schedule_summary(result, staff_members, date_range):
    """Pretty print schedule summary with type-based analysis."""
    if not result['success']:
        print(f"❌ Optimization failed: {result.get('error', 'Unknown error')}")
        return

    print("\n" + "=" * 80)
    print("SCHEDULE GENERATION SUCCESSFUL")
    print("=" * 80)

    # Group staff by type
    staff_by_type = {}
    for staff in staff_members:
        status = staff.get('status', 'Unknown')
        if status not in staff_by_type:
            staff_by_type[status] = []
        staff_by_type[status].append(staff)

    # Print summary statistics
    print(f"\nSolver Statistics:")
    print(f"  Status: {result['status']}")
    print(f"  Solve Time: {result['solve_time']:.2f}s")
    print(f"  Is Optimal: {result['is_optimal']}")
    print(f"  Total Violations: {result['stats']['total_violations']}")

    if result['stats']['total_violations'] > 0:
        print(f"\n  Violation Details:")
        for violation in result.get('violations', [])[:5]:
            print(f"    - {violation['description']}: {violation['count']} (penalty: {violation['penalty']})")

    # Analyze schedule by staff type
    print(f"\nStaff Type Analysis:")
    off_symbol = '\u00d7'
    early_symbol = '\u25b3'

    for staff_type, type_staff in staff_by_type.items():
        print(f"\n  {staff_type} ({len(type_staff)} staff):")

        # Count off and early per date
        max_off = 0
        max_early = 0
        dates_with_violations = []

        for date in date_range:
            off_count = sum(
                1 for staff in type_staff
                if result['schedule'][staff['id']][date] == off_symbol
            )
            early_count = sum(
                1 for staff in type_staff
                if result['schedule'][staff['id']][date] == early_symbol
            )

            max_off = max(max_off, off_count)
            max_early = max(max_early, early_count)

            if off_count > 1 or early_count > 2:
                dates_with_violations.append((date, off_count, early_count))

        print(f"    Max off per day: {max_off}")
        print(f"    Max early per day: {max_early}")

        if dates_with_violations:
            print(f"    Dates with high counts: {len(dates_with_violations)}")
            for date, off, early in dates_with_violations[:3]:
                print(f"      - {date}: {off} off, {early} early")

    # Print sample schedule (first 7 days)
    print(f"\nSample Schedule (First 7 Days):")
    print(f"{'Staff':<20} {'Type':<10} " + " ".join([f"{d[-2:]}" for d in date_range[:7]]))
    print("-" * 80)

    for staff in staff_members[:8]:  # Show first 8 staff
        staff_name = staff['name'][:18]
        staff_type = staff.get('status', 'Unknown')[:8]
        shifts = [result['schedule'][staff['id']][d] or '○' for d in date_range[:7]]
        print(f"{staff_name:<20} {staff_type:<10} " + " ".join([f" {s} " for s in shifts]))


def example_1_basic_restaurant():
    """Example 1: Basic restaurant with type limits."""
    print("\n" + "=" * 80)
    print("EXAMPLE 1: Basic Restaurant with Staff Type Limits")
    print("=" * 80)
    print("\nScenario:")
    print("  - 9 staff: 4 regular (社員), 3 dispatch (派遣), 2 part-time (パート)")
    print("  - Max 1 regular off per day (HARD)")
    print("  - Max 1 dispatch off per day (HARD)")
    print("  - Max 2 part-timers off per day (SOFT)")
    print("  - Overall: 2-3 staff off per day")

    staff_members = [
        {"id": "staff-1", "name": "Head Chef", "status": "社員"},
        {"id": "staff-2", "name": "Sous Chef", "status": "社員"},
        {"id": "staff-3", "name": "Senior Cook", "status": "社員"},
        {"id": "staff-4", "name": "Line Cook", "status": "社員"},
        {"id": "staff-5", "name": "Temp Cook A", "status": "派遣"},
        {"id": "staff-6", "name": "Temp Cook B", "status": "派遣"},
        {"id": "staff-7", "name": "Temp Cook C", "status": "派遣"},
        {"id": "staff-8", "name": "Part-timer X", "status": "パート"},
        {"id": "staff-9", "name": "Part-timer Y", "status": "パート"},
    ]

    date_range = [f"2025-12-{str(d).zfill(2)}" for d in range(1, 15)]

    constraints = {
        'staffTypeLimits': {
            '社員': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
            '派遣': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
            'パート': {'maxOff': 2, 'maxEarly': 1, 'isHard': False}
        },
        'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
    }

    optimizer = ShiftScheduleOptimizer()
    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=15
    )

    print_schedule_summary(result, staff_members, date_range)


def example_2_healthcare_coverage():
    """Example 2: Healthcare with senior staff coverage requirements."""
    print("\n\n" + "=" * 80)
    print("EXAMPLE 2: Healthcare with Senior Staff Coverage")
    print("=" * 80)
    print("\nScenario:")
    print("  - 8 staff: 3 senior nurses, 3 junior nurses, 2 assistants")
    print("  - Max 1 senior off per day (HARD) - always need senior coverage")
    print("  - Max 2 juniors off per day (SOFT)")
    print("  - No limits on assistants")

    staff_members = [
        {"id": "s1", "name": "Senior Nurse A", "status": "Senior"},
        {"id": "s2", "name": "Senior Nurse B", "status": "Senior"},
        {"id": "s3", "name": "Senior Nurse C", "status": "Senior"},
        {"id": "j1", "name": "Junior Nurse A", "status": "Junior"},
        {"id": "j2", "name": "Junior Nurse B", "status": "Junior"},
        {"id": "j3", "name": "Junior Nurse C", "status": "Junior"},
        {"id": "a1", "name": "Assistant A", "status": "Assistant"},
        {"id": "a2", "name": "Assistant B", "status": "Assistant"},
    ]

    date_range = [f"2025-12-{str(d).zfill(2)}" for d in range(1, 15)]

    constraints = {
        'staffTypeLimits': {
            'Senior': {'maxOff': 1, 'maxEarly': 1, 'isHard': True},  # Critical coverage
            'Junior': {'maxOff': 2, 'isHard': False}  # More flexible
        },
        'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
    }

    optimizer = ShiftScheduleOptimizer()
    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=15
    )

    print_schedule_summary(result, staff_members, date_range)


def example_3_soft_vs_hard():
    """Example 3: Comparing SOFT vs HARD constraint modes."""
    print("\n\n" + "=" * 80)
    print("EXAMPLE 3: SOFT vs HARD Constraint Comparison")
    print("=" * 80)
    print("\nScenario:")
    print("  - 6 staff: 3 regular, 3 part-time")
    print("  - Comparing maxOff=0 for regular staff in SOFT vs HARD mode")
    print("  - SOFT: Should succeed with violations")
    print("  - HARD: May fail if unsatisfiable")

    staff_members = [
        {"id": "r1", "name": "Regular A", "status": "Regular"},
        {"id": "r2", "name": "Regular B", "status": "Regular"},
        {"id": "r3", "name": "Regular C", "status": "Regular"},
        {"id": "p1", "name": "Part-time A", "status": "PartTime"},
        {"id": "p2", "name": "Part-time B", "status": "PartTime"},
        {"id": "p3", "name": "Part-time C", "status": "PartTime"},
    ]

    date_range = [f"2025-12-{str(d).zfill(2)}" for d in range(1, 11)]

    # Test with SOFT mode
    print("\n--- SOFT Mode (allows violations) ---")
    constraints_soft = {
        'staffTypeLimits': {
            'Regular': {'maxOff': 0, 'isHard': False},  # Impossible but SOFT
        },
        'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
    }

    optimizer = ShiftScheduleOptimizer()
    result_soft = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints_soft,
        timeout_seconds=10
    )

    print_schedule_summary(result_soft, staff_members, date_range)


def example_4_with_calendar():
    """Example 4: Integration with calendar rules."""
    print("\n\n" + "=" * 80)
    print("EXAMPLE 4: Integration with Calendar Rules")
    print("=" * 80)
    print("\nScenario:")
    print("  - 6 staff: 2 regular, 2 dispatch, 2 part-time")
    print("  - December 25: must_day_off (all staff off)")
    print("  - Type limits should skip Dec 25")

    staff_members = [
        {"id": "r1", "name": "Regular A", "status": "社員"},
        {"id": "r2", "name": "Regular B", "status": "社員"},
        {"id": "d1", "name": "Dispatch A", "status": "派遣"},
        {"id": "d2", "name": "Dispatch B", "status": "派遣"},
        {"id": "p1", "name": "Part-time A", "status": "パート"},
        {"id": "p2", "name": "Part-time B", "status": "パート"},
    ]

    date_range = [f"2025-12-{str(d).zfill(2)}" for d in range(20, 31)]

    constraints = {
        'calendarRules': {
            '2025-12-25': {'must_day_off': True}  # Christmas
        },
        'staffTypeLimits': {
            '社員': {'maxOff': 1, 'isHard': True},  # Would be violated on Dec 25
            '派遣': {'maxOff': 1, 'isHard': True},
        },
        'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
    }

    optimizer = ShiftScheduleOptimizer()
    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=10
    )

    print_schedule_summary(result, staff_members, date_range)


def main():
    """Run all examples."""
    print("\n" + "=" * 80)
    print("STAFF TYPE DAILY LIMITS - EXAMPLES")
    print("=" * 80)
    print("\nThis script demonstrates the per-staff-type daily limits feature.")
    print("It shows how to control off/early shifts per staff type per day.")

    # Run examples
    example_1_basic_restaurant()
    example_2_healthcare_coverage()
    example_3_soft_vs_hard()
    example_4_with_calendar()

    print("\n" + "=" * 80)
    print("ALL EXAMPLES COMPLETED")
    print("=" * 80)


if __name__ == '__main__':
    main()
