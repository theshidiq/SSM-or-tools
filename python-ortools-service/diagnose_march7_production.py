#!/usr/bin/env python3
"""
Diagnostic script for March 7 post-period constraint bug.

This script checks what config the production system might be receiving.
Run this to understand the data flow from frontend -> Go -> Python.
"""

import json
import sys

def check_default_config():
    """Check what the default earlyShiftConfig looks like"""
    print("=" * 80)
    print("DEFAULT EARLYSHIFTCONFIG (from EarlyShiftPreferencesTab.jsx)")
    print("=" * 80)

    default_config = {
        "postPeriodConstraint": {
            "enabled": True,
            "isHardConstraint": True,
            "minPeriodLength": 3,
            "postPeriodDays": 2,  # This should protect March 6 AND March 7
            "avoidDayOffForShain": True,
            "avoidDayOffForHaken": True,
            "allowEarlyForShain": True,
        }
    }

    print(json.dumps(default_config, indent=2, ensure_ascii=False))
    print()

    return default_config

def check_backend_receives(earlyShiftConfig):
    """Simulate what the Python backend sees"""
    print("=" * 80)
    print("WHAT PYTHON BACKEND SHOULD RECEIVE")
    print("=" * 80)

    # This is what scheduler.py extracts on line 2356
    post_period_config = earlyShiftConfig.get('postPeriodConstraint', {})
    post_period_days = post_period_config.get('postPeriodDays', 2)

    print(f"postPeriodConstraint: {json.dumps(post_period_config, indent=2)}")
    print(f"\nExtracted postPeriodDays: {post_period_days}")
    print()

    return post_period_days

def simulate_constraint_logic(post_period_days):
    """Simulate the constraint logic from scheduler.py"""
    print("=" * 80)
    print("CONSTRAINT LOGIC SIMULATION")
    print("=" * 80)

    # Period: March 3-6 (4 days)
    # Expected post-period dates with postPeriodDays=2:
    # - March 6 end_date + 1 day = March 7
    # - March 6 end_date + 2 days = March 8

    print(f"Period: March 3-6 (4 days)")
    print(f"postPeriodDays setting: {post_period_days}")
    print(f"\nExpected protected dates:")

    for day_offset in range(1, post_period_days + 1):
        print(f"  - March 6 + {day_offset} day(s) = March {6 + day_offset}")

    print()

    # Check if the logic would protect March 7
    march_7_protected = 1 <= post_period_days
    march_8_protected = 2 <= post_period_days

    print("Protection status:")
    print(f"  March 7: {'✅ PROTECTED' if march_7_protected else '❌ NOT PROTECTED'}")
    print(f"  March 8: {'✅ PROTECTED' if march_8_protected else '❌ NOT PROTECTED'}")
    print()

def check_possible_issues():
    """List possible reasons why March 7 might still have day-offs"""
    print("=" * 80)
    print("POSSIBLE CAUSES FOR MARCH 7 DAY-OFF BUG")
    print("=" * 80)

    issues = [
        {
            "num": 1,
            "cause": "localStorage is empty or old",
            "details": "User hasn't saved earlyShiftConfig with postPeriodDays=2",
            "fix": "Open Settings → Early Shift tab, verify toggle is ON, save settings",
        },
        {
            "num": 2,
            "cause": "Frontend not sending earlyShiftConfig",
            "details": "useAIAssistantLazy.js line 391 shows empty object warning",
            "fix": "Check browser console for '⚠️ WARNING - earlyShiftConfig is EMPTY!'",
        },
        {
            "num": 3,
            "cause": "Go server not forwarding config",
            "details": "Go server receives but doesn't pass postPeriodDays to Python",
            "fix": "Check Go server logs for postPeriodDays value",
        },
        {
            "num": 4,
            "cause": "Python scheduler ignoring postPeriodDays",
            "details": "Constraint logic not applying to all dates",
            "fix": "This would be caught by test_march7_issue.py (test passes)",
        },
        {
            "num": 5,
            "cause": "Schedule was generated before fix",
            "details": "Old schedule in database, not regenerated with new config",
            "fix": "Click 'AI自動生成' button again to regenerate schedule",
        },
    ]

    for issue in issues:
        print(f"\n{issue['num']}. {issue['cause']}")
        print(f"   Details: {issue['details']}")
        print(f"   Fix: {issue['fix']}")

    print()

def main():
    print("\n" + "=" * 80)
    print("MARCH 7 POST-PERIOD CONSTRAINT DIAGNOSTIC")
    print("=" * 80)
    print()

    # Step 1: Check default config
    default_config = check_default_config()

    # Step 2: Check what backend should receive
    post_period_days = check_backend_receives(default_config)

    # Step 3: Simulate constraint logic
    simulate_constraint_logic(post_period_days)

    # Step 4: List possible issues
    check_possible_issues()

    print("=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print()
    print("1. Check browser localStorage:")
    print("   - Open DevTools → Application → Local Storage")
    print("   - Find key: 'shift-schedule-earlyShiftConfig'")
    print("   - Verify it contains: {\"postPeriodConstraint\": {\"postPeriodDays\": 2, ...}}")
    print()
    print("2. Check browser console logs when generating schedule:")
    print("   - Look for: '[OR-TOOLS] 🎯 earlyShiftConfig being sent:'")
    print("   - Verify postPeriodDays: 2 is present")
    print()
    print("3. Check Go server logs:")
    print("   - Look for: '[ORTOOLS] 🎯 earlyShiftConfig.postPeriodConstraint:'")
    print("   - Verify postPeriodDays=2 is logged")
    print()
    print("4. Check Python OR-Tools logs:")
    print("   - Look for: 'Config: minPeriodLength=3, mode=HARD, postPeriodDays=2'")
    print("   - Look for: 'POST-PERIOD DATES TO PROTECT: [\"2026-03-07\", \"2026-03-08\"]'")
    print()
    print("5. If all configs look correct, regenerate schedule:")
    print("   - Click 'AI自動生成' button to generate fresh schedule")
    print("   - Old schedule might be from before the fix")
    print()
    print("=" * 80)

if __name__ == "__main__":
    main()
