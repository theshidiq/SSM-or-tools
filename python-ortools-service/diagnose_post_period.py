#!/usr/bin/env python3
"""
Diagnostic script to analyze post-period constraint behavior for March 2026 bug.

This script simulates the OR-Tools constraint processing to identify:
1. What must_day_off dates are being detected
2. How periods are being grouped
3. What post-period dates are being calculated
4. Whether constraints are being applied to the correct dates
"""

from datetime import datetime, timedelta
import json

def analyze_post_period_constraint(calendar_rules, date_range, min_period_length=3):
    """Simulate the _add_post_period_constraints logic."""

    print("=" * 80)
    print("POST-PERIOD CONSTRAINT DIAGNOSTIC")
    print("=" * 80)
    print()

    # Step 1: Extract must_day_off dates (FIXED version)
    print("STEP 1: Extracting must_day_off dates")
    print("-" * 80)

    must_day_off_dates = sorted([
        date for date, rule in calendar_rules.items()
        if isinstance(rule, dict) and rule.get('must_day_off') and date in date_range
    ])

    print(f"Calendar rules: {json.dumps(calendar_rules, indent=2)}")
    print()
    print(f"Found {len(must_day_off_dates)} must_day_off dates:")
    for date in must_day_off_dates:
        print(f"  - {date}")
    print()

    if not must_day_off_dates:
        print("ERROR: No must_day_off dates found!")
        return

    # Step 2: Group consecutive dates into periods
    print("STEP 2: Grouping consecutive dates into periods")
    print("-" * 80)

    periods = []
    current_period = {'start': must_day_off_dates[0], 'end': must_day_off_dates[0]}

    for i in range(1, len(must_day_off_dates)):
        prev_date = datetime.strptime(must_day_off_dates[i-1], '%Y-%m-%d')
        curr_date = datetime.strptime(must_day_off_dates[i], '%Y-%m-%d')
        diff_days = (curr_date - prev_date).days

        print(f"  Comparing {must_day_off_dates[i-1]} → {must_day_off_dates[i]}: gap={diff_days} days")

        if diff_days == 1:
            # Consecutive - extend current period
            current_period['end'] = must_day_off_dates[i]
            print(f"    → CONSECUTIVE: Extending period to {current_period['end']}")
        else:
            # Gap - save current period and start new one
            periods.append(current_period)
            print(f"    → GAP DETECTED: Saving period {current_period['start']} ~ {current_period['end']}")
            current_period = {'start': must_day_off_dates[i], 'end': must_day_off_dates[i]}

    periods.append(current_period)
    print(f"  Final period added: {current_period['start']} ~ {current_period['end']}")
    print()

    print(f"Total periods found: {len(periods)}")
    for idx, period in enumerate(periods):
        start_date = datetime.strptime(period['start'], '%Y-%m-%d')
        end_date = datetime.strptime(period['end'], '%Y-%m-%d')
        period_length = (end_date - start_date).days + 1
        print(f"  Period {idx+1}: {period['start']} ~ {period['end']} ({period_length} days)")
    print()

    # Step 3: Filter by minimum length
    print("STEP 3: Filtering periods by minimum length")
    print("-" * 80)

    filtered_periods = []
    for period in periods:
        start_date = datetime.strptime(period['start'], '%Y-%m-%d')
        end_date = datetime.strptime(period['end'], '%Y-%m-%d')
        period_length = (end_date - start_date).days + 1

        if period_length >= min_period_length:
            filtered_periods.append(period)
            print(f"  ✅ Period {period['start']} ~ {period['end']} ({period_length} days) → INCLUDED")
        else:
            print(f"  ❌ Period {period['start']} ~ {period['end']} ({period_length} days) → SKIPPED (< {min_period_length})")

    print()
    print(f"Filtered periods: {len(filtered_periods)} (minPeriodLength={min_period_length})")
    print()

    # Step 4: Calculate post-period dates
    print("STEP 4: Calculating post-period dates")
    print("-" * 80)

    post_period_dates = []
    for period in filtered_periods:
        end_date = datetime.strptime(period['end'], '%Y-%m-%d')
        next_day = (end_date + timedelta(days=1)).strftime('%Y-%m-%d')

        if next_day in date_range:
            post_period_dates.append(next_day)
            print(f"  Period {period['start']} ~ {period['end']}")
            print(f"    → Post-period date: {next_day} ✅ (within range)")
        else:
            print(f"  Period {period['start']} ~ {period['end']}")
            print(f"    → Post-period date: {next_day} ❌ (outside range)")

    print()
    print(f"Post-period dates to protect: {post_period_dates}")
    print()

    # Step 5: Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Must day-off dates: {must_day_off_dates}")
    print(f"Periods detected: {len(filtered_periods)}")
    for period in filtered_periods:
        start_date = datetime.strptime(period['start'], '%Y-%m-%d')
        end_date = datetime.strptime(period['end'], '%Y-%m-%d')
        period_length = (end_date - start_date).days + 1
        print(f"  - {period['start']} ~ {period['end']} ({period_length} days)")
    print(f"Post-period dates (HARD constraints applied): {post_period_dates}")
    print("=" * 80)

    return {
        'must_day_off_dates': must_day_off_dates,
        'periods': filtered_periods,
        'post_period_dates': post_period_dates
    }


if __name__ == '__main__':
    # Test Case 1: March 3-5 are must_day_off (3 days)
    # Expected: March 6 should be post-period date
    print("\n" + "=" * 80)
    print("TEST CASE 1: March 3-5 are must_day_off (screenshot data)")
    print("=" * 80)
    print()

    calendar_rules_case1 = {
        '2026-03-03': {'must_day_off': True},
        '2026-03-04': {'must_day_off': True},
        '2026-03-05': {'must_day_off': True},
    }

    date_range_march = [f'2026-03-{day:02d}' for day in range(1, 32)]

    result1 = analyze_post_period_constraint(calendar_rules_case1, date_range_march, min_period_length=3)

    print("\n" + "🔍 ANALYSIS:")
    if '2026-03-06' in result1['post_period_dates']:
        print("  ✅ March 6 correctly identified as post-period date")
    else:
        print("  ❌ March 6 NOT identified as post-period date!")

    if '2026-03-07' in result1['post_period_dates']:
        print("  ❌ March 7 incorrectly identified as post-period date!")
    else:
        print("  ✅ March 7 correctly NOT a post-period date")

    # Test Case 2: March 3-6 are must_day_off (4 days)
    # Expected: March 7 should be post-period date
    print("\n\n" + "=" * 80)
    print("TEST CASE 2: March 3-6 are must_day_off (if user configured it this way)")
    print("=" * 80)
    print()

    calendar_rules_case2 = {
        '2026-03-03': {'must_day_off': True},
        '2026-03-04': {'must_day_off': True},
        '2026-03-05': {'must_day_off': True},
        '2026-03-06': {'must_day_off': True},
    }

    result2 = analyze_post_period_constraint(calendar_rules_case2, date_range_march, min_period_length=3)

    print("\n" + "🔍 ANALYSIS:")
    if '2026-03-07' in result2['post_period_dates']:
        print("  ✅ March 7 correctly identified as post-period date")
    else:
        print("  ❌ March 7 NOT identified as post-period date!")

    # Test Case 3: Alternative data format (rule_type instead of dict)
    print("\n\n" + "=" * 80)
    print("TEST CASE 3: Alternative calendar_rules format (string instead of dict)")
    print("=" * 80)
    print()

    calendar_rules_case3 = {
        '2026-03-03': 'must_day_off',
        '2026-03-04': 'must_day_off',
        '2026-03-05': 'must_day_off',
    }

    result3 = analyze_post_period_constraint(calendar_rules_case3, date_range_march, min_period_length=3)

    print("\n" + "🔍 ANALYSIS:")
    print("  This format would NOT be detected by current code!")
    print("  Current code checks: isinstance(rule, dict) and rule.get('must_day_off')")
    print("  This format needs: if rule == 'must_day_off'")

    # Final diagnosis
    print("\n\n" + "=" * 80)
    print("DIAGNOSTIC CONCLUSION")
    print("=" * 80)
    print()
    print("MOST LIKELY ROOT CAUSE:")
    print()
    print("1. The calendar_rules data format doesn't match what the code expects")
    print("   - Code expects: {'2026-03-03': {'must_day_off': True}, ...}")
    print("   - Might receive: {'2026-03-03': 'must_day_off', ...}")
    print()
    print("2. OR the must_day_off period actually includes March 6:")
    print("   - If March 3-6 are all must_day_off, then March 7 is the correct post-period date")
    print("   - But screenshot shows March 6 has △ (early shift), not × (day-off)")
    print("   - This suggests March 6 is NOT a must_day_off date")
    print()
    print("NEXT STEPS:")
    print("1. Add logging to scheduler.py to print the actual calendar_rules received")
    print("2. Add logging to print the must_day_off_dates extracted")
    print("3. Add logging to print the post_period_dates calculated")
    print("4. Check if the data format is string or dict")
    print()
    print("=" * 80)
