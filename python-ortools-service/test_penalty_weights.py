#!/usr/bin/env python3
"""
Test script to verify penalty weight configuration works correctly.
Tests both default weights and custom weights from API request.
"""

import json
from scheduler import ShiftScheduleOptimizer


def test_default_weights():
    """Test that default weights are used when no custom weights provided."""
    print("\n=== Test 1: Default Penalty Weights ===")

    optimizer = ShiftScheduleOptimizer()

    # Simple test data
    staff_members = [
        {'id': 'staff1', 'name': 'Alice', 'position': 'Chef'},
        {'id': 'staff2', 'name': 'Bob', 'position': 'Cook'},
        {'id': 'staff3', 'name': 'Carol', 'position': 'Helper'},
    ]

    date_range = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05']

    constraints = {
        'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1},
        'monthlyLimit': {'minCount': 1, 'maxCount': 2},
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=5
    )

    if result['success']:
        print("✓ Optimization succeeded with default weights")
        config = result.get('config', {})
        print(f"  Penalty weights used: {config.get('penaltyWeights')}")
        print(f"  Solver settings: timeout={config.get('timeout')}s, workers={config.get('numWorkers')}")
    else:
        print(f"✗ Optimization failed: {result.get('error')}")

    return result['success']


def test_custom_weights():
    """Test that custom weights from API request override defaults."""
    print("\n=== Test 2: Custom Penalty Weights ===")

    optimizer = ShiftScheduleOptimizer()

    # Simple test data
    staff_members = [
        {'id': 'staff1', 'name': 'Alice', 'position': 'Chef'},
        {'id': 'staff2', 'name': 'Bob', 'position': 'Cook'},
        {'id': 'staff3', 'name': 'Carol', 'position': 'Helper'},
    ]

    date_range = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05']

    # Custom configuration with specific penalty weights
    constraints = {
        'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1},
        'monthlyLimit': {'minCount': 1, 'maxCount': 2},
        'ortoolsConfig': {
            'penaltyWeights': {
                'staffGroup': 150,        # Increased from 100
                'dailyLimitMin': 75,      # Increased from 50
                'dailyLimitMax': 80,      # Increased from 50
                'monthlyLimit': 100,      # Increased from 80
                'adjacentConflict': 50,   # Increased from 30
                'fiveDayRest': 300        # Increased from 200
            },
            'solverSettings': {
                'timeout': 10,
                'numWorkers': 8
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=5  # This should be overridden by ortoolsConfig.solverSettings.timeout
    )

    if result['success']:
        print("✓ Optimization succeeded with custom weights")
        config = result.get('config', {})
        weights = config.get('penaltyWeights', {})

        # Verify custom weights were applied
        print(f"  Penalty weights used:")
        print(f"    staffGroup: {weights.get('staffGroup')} (expected: 150)")
        print(f"    dailyLimitMin: {weights.get('dailyLimitMin')} (expected: 75)")
        print(f"    dailyLimitMax: {weights.get('dailyLimitMax')} (expected: 80)")
        print(f"    monthlyLimit: {weights.get('monthlyLimit')} (expected: 100)")
        print(f"    adjacentConflict: {weights.get('adjacentConflict')} (expected: 50)")
        print(f"    fiveDayRest: {weights.get('fiveDayRest')} (expected: 300)")

        print(f"  Solver settings: timeout={config.get('timeout')}s, workers={config.get('numWorkers')}")

        # Verify values match expectations
        if weights.get('staffGroup') == 150 and weights.get('fiveDayRest') == 300:
            print("✓ Custom weights were correctly applied")
            return True
        else:
            print("✗ Custom weights were NOT applied correctly")
            return False
    else:
        print(f"✗ Optimization failed: {result.get('error')}")
        return False


def test_partial_custom_weights():
    """Test that partial custom weights merge with defaults."""
    print("\n=== Test 3: Partial Custom Weights (Merge with Defaults) ===")

    optimizer = ShiftScheduleOptimizer()

    staff_members = [
        {'id': 'staff1', 'name': 'Alice', 'position': 'Chef'},
        {'id': 'staff2', 'name': 'Bob', 'position': 'Cook'},
    ]

    date_range = ['2025-01-01', '2025-01-02', '2025-01-03']

    # Only override some weights
    constraints = {
        'dailyLimitsRaw': {'minOffPerDay': 0, 'maxOffPerDay': 1},
        'ortoolsConfig': {
            'penaltyWeights': {
                'staffGroup': 200,  # Custom
                'fiveDayRest': 400  # Custom
                # Others should use defaults
            }
        }
    }

    result = optimizer.optimize_schedule(
        staff_members=staff_members,
        date_range=date_range,
        constraints=constraints,
        timeout_seconds=5
    )

    if result['success']:
        print("✓ Optimization succeeded with partial custom weights")
        config = result.get('config', {})
        weights = config.get('penaltyWeights', {})

        print(f"  Penalty weights used:")
        print(f"    staffGroup: {weights.get('staffGroup')} (expected: 200 - custom)")
        print(f"    dailyLimitMin: {weights.get('dailyLimitMin')} (expected: 50 - default)")
        print(f"    fiveDayRest: {weights.get('fiveDayRest')} (expected: 400 - custom)")

        if (weights.get('staffGroup') == 200 and
            weights.get('dailyLimitMin') == 50 and
            weights.get('fiveDayRest') == 400):
            print("✓ Partial custom weights were correctly merged with defaults")
            return True
        else:
            print("✗ Partial custom weights merge failed")
            return False
    else:
        print(f"✗ Optimization failed: {result.get('error')}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Testing OR-Tools Penalty Weight Configuration")
    print("=" * 60)

    results = []

    try:
        results.append(("Default weights", test_default_weights()))
        results.append(("Custom weights", test_custom_weights()))
        results.append(("Partial custom weights", test_partial_custom_weights()))
    except Exception as e:
        print(f"\n✗ Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {test_name}")

    all_passed = all(result[1] for result in results)

    if all_passed:
        print("\n✓ All tests passed!")
        return True
    else:
        print("\n✗ Some tests failed")
        return False


if __name__ == '__main__':
    import sys
    success = main()
    sys.exit(0 if success else 1)
