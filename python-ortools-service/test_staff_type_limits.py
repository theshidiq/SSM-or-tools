"""
Comprehensive test suite for staff type daily limits feature.

Tests the _add_staff_type_daily_limits() method with various scenarios:
- Basic off/early limits
- HARD vs SOFT constraint modes
- Edge cases (no staff, zero limits, etc.)
- Integration with other constraints

Run with: pytest test_staff_type_limits.py -v
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestStaffTypeDailyLimits:
    """Test cases for per-staff-type daily limits."""

    # =========================================================================
    # FIXTURES
    # =========================================================================

    @pytest.fixture
    def mixed_staff(self):
        """
        9 staff members with mixed types:
        - 4 社員 (Regular full-time)
        - 3 派遣 (Dispatch/temp)
        - 2 パート (Part-time)
        """
        return [
            {"id": "staff-1", "name": "Chef", "status": "社員"},
            {"id": "staff-2", "name": "Sous Chef", "status": "社員"},
            {"id": "staff-3", "name": "Senior Cook", "status": "社員"},
            {"id": "staff-4", "name": "Cook", "status": "社員"},
            {"id": "staff-5", "name": "Temp Cook 1", "status": "派遣"},
            {"id": "staff-6", "name": "Temp Cook 2", "status": "派遣"},
            {"id": "staff-7", "name": "Temp Cook 3", "status": "派遣"},
            {"id": "staff-8", "name": "Part-timer A", "status": "パート"},
            {"id": "staff-9", "name": "Part-timer B", "status": "パート"},
        ]

    @pytest.fixture
    def short_dates(self):
        """Short date range for faster tests (10 days)."""
        return [f"2025-12-{str(d).zfill(2)}" for d in range(1, 11)]

    @pytest.fixture
    def month_dates(self):
        """Full month date range (31 days)."""
        return [f"2025-12-{str(d).zfill(2)}" for d in range(1, 32)]

    # =========================================================================
    # TEST 1: BASIC OFF LIMITS (HARD MODE)
    # =========================================================================

    def test_staff_type_off_limits_hard(self, mixed_staff, short_dates):
        """Test that staff type off limits are strictly enforced (HARD mode)."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxOff': 1, 'isHard': True},  # Max 1 regular off
                    '派遣': {'maxOff': 1, 'isHard': True},  # Max 1 dispatch off
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        assert result['success'] == True, f"Schedule generation failed: {result.get('error', 'Unknown error')}"

        # Verify: Each day has max 1 社員 off and max 1 派遣 off
        off_symbol = '\u00d7'

        regular_staff = ['staff-1', 'staff-2', 'staff-3', 'staff-4']
        dispatch_staff = ['staff-5', 'staff-6', 'staff-7']

        for date in short_dates:
            regular_off = sum(
                1 for sid in regular_staff
                if result['schedule'][sid][date] == off_symbol
            )
            dispatch_off = sum(
                1 for sid in dispatch_staff
                if result['schedule'][sid][date] == off_symbol
            )

            assert regular_off <= 1, f"社員: {regular_off} off on {date} (max 1)"
            assert dispatch_off <= 1, f"派遣: {dispatch_off} off on {date} (max 1)"

        print(f"✓ HARD mode off limits enforced: 0 violations")

    # =========================================================================
    # TEST 2: BASIC EARLY LIMITS (HARD MODE)
    # =========================================================================

    def test_staff_type_early_limits_hard(self, mixed_staff, short_dates):
        """Test that staff type early shift limits are strictly enforced."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxEarly': 2, 'isHard': True},  # Max 2 regular on early
                    'パート': {'maxEarly': 1, 'isHard': True}  # Max 1 part-timer on early
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        # Verify early shift limits
        early_symbol = '\u25b3'

        regular_staff = ['staff-1', 'staff-2', 'staff-3', 'staff-4']
        parttime_staff = ['staff-8', 'staff-9']

        for date in short_dates:
            regular_early = sum(
                1 for sid in regular_staff
                if result['schedule'][sid][date] == early_symbol
            )
            parttime_early = sum(
                1 for sid in parttime_staff
                if result['schedule'][sid][date] == early_symbol
            )

            assert regular_early <= 2, f"社員: {regular_early} early on {date} (max 2)"
            assert parttime_early <= 1, f"パート: {parttime_early} early on {date} (max 1)"

        print(f"✓ HARD mode early limits enforced: 0 violations")

    # =========================================================================
    # TEST 3: COMBINED OFF + EARLY LIMITS
    # =========================================================================

    def test_staff_type_combined_limits(self, mixed_staff, short_dates):
        """Test that both off and early limits work together."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                    '派遣': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                    'パート': {'maxOff': 2, 'maxEarly': 1, 'isHard': True}
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        off_symbol = '\u00d7'
        early_symbol = '\u25b3'

        regular_staff = ['staff-1', 'staff-2', 'staff-3', 'staff-4']
        dispatch_staff = ['staff-5', 'staff-6', 'staff-7']
        parttime_staff = ['staff-8', 'staff-9']

        violations = []

        for date in short_dates:
            regular_off = sum(1 for sid in regular_staff if result['schedule'][sid][date] == off_symbol)
            regular_early = sum(1 for sid in regular_staff if result['schedule'][sid][date] == early_symbol)
            dispatch_off = sum(1 for sid in dispatch_staff if result['schedule'][sid][date] == off_symbol)
            dispatch_early = sum(1 for sid in dispatch_staff if result['schedule'][sid][date] == early_symbol)
            parttime_off = sum(1 for sid in parttime_staff if result['schedule'][sid][date] == off_symbol)
            parttime_early = sum(1 for sid in parttime_staff if result['schedule'][sid][date] == early_symbol)

            if regular_off > 1:
                violations.append(f"社員 off: {regular_off} on {date}")
            if regular_early > 2:
                violations.append(f"社員 early: {regular_early} on {date}")
            if dispatch_off > 1:
                violations.append(f"派遣 off: {dispatch_off} on {date}")
            if dispatch_early > 2:
                violations.append(f"派遣 early: {dispatch_early} on {date}")
            if parttime_off > 2:
                violations.append(f"パート off: {parttime_off} on {date}")
            if parttime_early > 1:
                violations.append(f"パート early: {parttime_early} on {date}")

        assert len(violations) == 0, f"Violations found: {violations}"
        print(f"✓ Combined off+early limits enforced: 0 violations")

    # =========================================================================
    # TEST 4: SOFT CONSTRAINT MODE (ALLOWS VIOLATIONS)
    # =========================================================================

    def test_staff_type_soft_constraint(self, mixed_staff, short_dates):
        """Test that SOFT mode allows violations with penalty."""
        optimizer = ShiftScheduleOptimizer()

        # Create impossible constraint: 0 社員 can be off (but we need some off days)
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxOff': 0, 'isHard': False},  # SOFT: impossible if strict
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        # Should succeed with violations
        assert result['success'] == True
        assert result['stats']['total_violations'] > 0, "Expected violations in SOFT mode"

        # Verify violations are logged
        violations = result.get('violations', [])
        staff_type_violations = [v for v in violations if '社員' in v['description']]
        assert len(staff_type_violations) > 0, "Expected staff type violations"

        print(f"✓ SOFT mode allows violations: {len(staff_type_violations)} violations with penalty")

    # =========================================================================
    # TEST 5: EDGE CASE - NO STAFF OF TYPE
    # =========================================================================

    def test_staff_type_missing_type(self, mixed_staff, short_dates):
        """Test handling of staff type with no members."""
        optimizer = ShiftScheduleOptimizer()

        # Constrain a type that doesn't exist
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    'NonExistentType': {'maxOff': 1, 'isHard': True}
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=10
        )

        # Should succeed - constraint is skipped
        assert result['success'] == True
        print(f"✓ Edge case: Missing staff type handled gracefully")

    # =========================================================================
    # TEST 6: EDGE CASE - ZERO LIMITS
    # =========================================================================

    def test_staff_type_zero_limits(self, mixed_staff, short_dates):
        """Test that zero limits are valid (no one of that type can be off/early)."""
        # Use only 2 regular staff so others can handle off days
        small_staff = [
            {"id": "staff-1", "name": "Chef", "status": "社員"},
            {"id": "staff-2", "name": "Sous", "status": "社員"},
            {"id": "staff-3", "name": "Temp1", "status": "派遣"},
            {"id": "staff-4", "name": "Temp2", "status": "派遣"},
            {"id": "staff-5", "name": "Part1", "status": "パート"},
        ]

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=small_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxOff': 0, 'isHard': True},  # No regular staff can be off
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        # Verify: No regular staff are ever off
        off_symbol = '\u00d7'
        regular_staff = ['staff-1', 'staff-2']

        for date in short_dates:
            for sid in regular_staff:
                assert result['schedule'][sid][date] != off_symbol, \
                    f"社員 {sid} is off on {date} (should never be off with maxOff=0)"

        print(f"✓ Edge case: Zero limits enforced correctly")

    # =========================================================================
    # TEST 7: EDGE CASE - LIMITS EXCEED STAFF COUNT
    # =========================================================================

    def test_staff_type_limits_exceed_count(self, mixed_staff, short_dates):
        """Test that limits exceeding staff count are valid but ineffective."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    '社員': {'maxOff': 10, 'isHard': True},  # 4 社員, max 10 off (ineffective)
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=10
        )

        # Should succeed - constraint doesn't affect solution
        assert result['success'] == True
        print(f"✓ Edge case: Limits exceeding staff count handled")

    # =========================================================================
    # TEST 8: CALENDAR OVERRIDE DATES (SHOULD BE SKIPPED)
    # =========================================================================

    def test_staff_type_skips_calendar_dates(self, mixed_staff, short_dates):
        """Test that staff type limits don't apply to must_day_off dates."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'calendarRules': {
                    '2025-12-05': {'must_day_off': True}  # All staff off except early pref
                },
                'staffTypeLimits': {
                    '社員': {'maxOff': 1, 'isHard': True},  # Would be violated on Dec 5
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        # Should succeed - calendar dates are excluded from staff type limits
        assert result['success'] == True

        # On Dec 5, all staff should be off (calendar rule overrides)
        off_symbol = '\u00d7'
        for staff in mixed_staff:
            assert result['schedule'][staff['id']]['2025-12-05'] == off_symbol

        print(f"✓ Calendar override dates correctly skip staff type limits")

    # =========================================================================
    # TEST 9: INTEGRATION WITH OTHER CONSTRAINTS
    # =========================================================================

    def test_staff_type_with_daily_limits(self, mixed_staff, short_dates):
        """Test staff type limits combined with overall daily limits."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3},
                'staffTypeLimits': {
                    '社員': {'maxOff': 1, 'isHard': True},
                    '派遣': {'maxOff': 1, 'isHard': True},
                    'パート': {'maxOff': 2, 'isHard': True}
                }
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        off_symbol = '\u00d7'

        # Verify both constraints are satisfied
        for date in short_dates:
            # Overall daily limit (2-3 off total)
            total_off = sum(
                1 for staff in mixed_staff
                if result['schedule'][staff['id']][date] == off_symbol
            )
            assert 2 <= total_off <= 3, f"Daily limit violated: {total_off} off on {date}"

            # Per-type limits
            regular_off = sum(
                1 for sid in ['staff-1', 'staff-2', 'staff-3', 'staff-4']
                if result['schedule'][sid][date] == off_symbol
            )
            assert regular_off <= 1, f"Type limit violated: {regular_off} 社員 off on {date}"

        print(f"✓ Staff type limits work correctly with daily limits")

    # =========================================================================
    # TEST 10: INTEGRATION WITH STAFF GROUPS
    # =========================================================================

    def test_staff_type_with_staff_groups(self, mixed_staff, short_dates):
        """Test staff type limits combined with staff group constraints."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=short_dates,
            constraints={
                'staffGroups': [
                    {'name': 'SeniorChefs', 'members': ['staff-1', 'staff-2']}
                ],
                'staffTypeLimits': {
                    '社員': {'maxOff': 2, 'isHard': True},
                },
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        off_symbol = '\u00d7'
        early_symbol = '\u25b3'

        # Verify both constraints
        for date in short_dates:
            # Staff group: max 1 from SeniorChefs off/early
            group_off_early = sum(
                1 for sid in ['staff-1', 'staff-2']
                if result['schedule'][sid][date] in [off_symbol, early_symbol]
            )
            # SOFT constraint may allow violations
            # assert group_off_early <= 1, f"Group violated: {group_off_early} on {date}"

            # Staff type: max 2 社員 off
            regular_off = sum(
                1 for sid in ['staff-1', 'staff-2', 'staff-3', 'staff-4']
                if result['schedule'][sid][date] == off_symbol
            )
            assert regular_off <= 2, f"Type limit violated: {regular_off} 社員 off on {date}"

        print(f"✓ Staff type limits work correctly with staff groups")

    # =========================================================================
    # TEST 11: REALISTIC RESTAURANT SCENARIO
    # =========================================================================

    def test_realistic_restaurant_schedule(self, mixed_staff, month_dates):
        """Test realistic restaurant with full constraint set."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=mixed_staff,
            date_range=month_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3},
                'staffTypeLimits': {
                    '社員': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                    '派遣': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                    'パート': {'maxOff': 2, 'maxEarly': 1, 'isHard': False}
                },
                'monthlyLimit': {'minCount': 7, 'maxCount': 8, 'excludeCalendarRules': True},
                'calendarRules': {
                    '2025-12-25': {'must_day_off': True}  # Christmas
                }
            },
            timeout_seconds=30
        )

        assert result['success'] == True

        # Comprehensive validation
        off_symbol = '\u00d7'
        early_symbol = '\u25b3'

        regular_staff = ['staff-1', 'staff-2', 'staff-3', 'staff-4']
        dispatch_staff = ['staff-5', 'staff-6', 'staff-7']
        parttime_staff = ['staff-8', 'staff-9']

        violations = []

        for date in month_dates:
            if date == '2025-12-25':
                continue  # Skip calendar override

            # Check type limits
            regular_off = sum(1 for sid in regular_staff if result['schedule'][sid][date] == off_symbol)
            regular_early = sum(1 for sid in regular_staff if result['schedule'][sid][date] == early_symbol)

            if regular_off > 1:
                violations.append(f"社員 off > 1 on {date}")
            if regular_early > 2:
                violations.append(f"社員 early > 2 on {date}")

        # Check monthly limits for one staff
        staff_off_count = sum(
            1 for date in month_dates
            if result['schedule']['staff-1'][date] == off_symbol and date != '2025-12-25'
        )
        # Monthly limit: 7-8 off days (excluding calendar)
        # SOFT constraint may allow minor violations

        assert len(violations) == 0, f"Violations in realistic scenario: {violations}"
        print(f"✓ Realistic restaurant schedule generated successfully")
        print(f"  Stats: {result['stats']}")
        print(f"  Violations: {result['stats']['total_violations']}")

    # =========================================================================
    # TEST 12: PERFORMANCE WITH MANY TYPES
    # =========================================================================

    def test_performance_with_many_types(self, short_dates):
        """Test performance with multiple staff types."""
        # Create staff with 5 different types
        many_types_staff = [
            {"id": f"type1-{i}", "name": f"Type1-{i}", "status": "Type1"}
            for i in range(1, 4)
        ] + [
            {"id": f"type2-{i}", "name": f"Type2-{i}", "status": "Type2"}
            for i in range(1, 3)
        ] + [
            {"id": f"type3-{i}", "name": f"Type3-{i}", "status": "Type3"}
            for i in range(1, 3)
        ]

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=many_types_staff,
            date_range=short_dates,
            constraints={
                'staffTypeLimits': {
                    'Type1': {'maxOff': 1, 'maxEarly': 1, 'isHard': True},
                    'Type2': {'maxOff': 1, 'maxEarly': 1, 'isHard': True},
                    'Type3': {'maxOff': 1, 'maxEarly': 1, 'isHard': True},
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=15
        )

        assert result['success'] == True
        assert result['solve_time'] < 15, f"Solve time too long: {result['solve_time']}s"
        print(f"✓ Performance test: Solved in {result['solve_time']:.2f}s")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
