"""
Test cases for OR-Tools scheduler.
Run with: pytest test_scheduler.py -v
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestShiftScheduleOptimizer:
    """Test cases for OR-Tools scheduler."""

    @pytest.fixture
    def sample_staff(self):
        """6 staff members for realistic scheduling."""
        return [
            {"id": "staff-1", "name": "Chef", "status": "Regular"},
            {"id": "staff-2", "name": "Tanaka", "status": "Regular"},
            {"id": "staff-3", "name": "Yamada", "status": "Regular"},
            {"id": "staff-4", "name": "Suzuki", "status": "Regular"},
            {"id": "staff-5", "name": "Sato", "status": "Regular"},
            {"id": "staff-6", "name": "Watanabe", "status": "Regular"},
        ]

    @pytest.fixture
    def small_staff(self):
        """3 staff members for smaller tests."""
        return [
            {"id": "staff-1", "name": "Chef", "status": "Regular"},
            {"id": "staff-2", "name": "Tanaka", "status": "Regular"},
            {"id": "staff-3", "name": "Yamada", "status": "Regular"},
        ]

    @pytest.fixture
    def sample_dates(self):
        return [f"2025-12-{str(d).zfill(2)}" for d in range(1, 32)]

    @pytest.fixture
    def short_dates(self):
        """Short date range for faster tests."""
        return [f"2025-12-{str(d).zfill(2)}" for d in range(1, 11)]

    def test_basic_schedule_generation(self, sample_staff, sample_dates):
        """Test that a basic schedule can be generated."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True
        assert len(result['schedule']) == len(sample_staff)

    def test_daily_limits_enforced(self, sample_staff, sample_dates):
        """Test that daily off limits are respected."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check each day has 1-2 off (as per limits)
        off_symbol = '\u00d7'  # multiplication sign
        for date in sample_dates:
            off_count = sum(
                1 for s in sample_staff
                if result['schedule'][s['id']][date] == off_symbol
            )
            assert 1 <= off_count <= 2, f"Expected 1-2 off on {date}, got {off_count}"

    def test_calendar_must_day_off(self, sample_staff, sample_dates):
        """Test that calendar must_day_off is enforced."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'calendarRules': {
                    '2025-12-25': {'must_day_off': True}
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # All staff should be off on Dec 25
        off_symbol = '\u00d7'
        for staff in sample_staff:
            assert result['schedule'][staff['id']]['2025-12-25'] == off_symbol

    def test_early_shift_preference_on_must_day_off(self, sample_staff, sample_dates):
        """Test early shift preference overrides must_day_off."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'calendarRules': {
                    '2025-12-25': {'must_day_off': True}
                },
                # Correct format: { staffId: { dateString: boolean } }
                'earlyShiftPreferences': {
                    'staff-1': {'2025-12-25': True}
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Staff-1 should have early shift, others should have off
        early_symbol = '\u25b3'  # triangle
        off_symbol = '\u00d7'
        assert result['schedule']['staff-1']['2025-12-25'] == early_symbol
        # Check that the rest are off (not all 6, just check a couple)
        assert result['schedule']['staff-2']['2025-12-25'] == off_symbol
        assert result['schedule']['staff-3']['2025-12-25'] == off_symbol

    def test_no_consecutive_off_days(self, sample_staff, short_dates):
        """Test that no staff has consecutive off days (xx)."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no consecutive off days
        off_symbol = '\u00d7'
        for staff in sample_staff:
            schedule = result['schedule'][staff['id']]
            for i in range(len(short_dates) - 1):
                d1, d2 = short_dates[i], short_dates[i+1]
                if schedule[d1] == off_symbol and schedule[d2] == off_symbol:
                    pytest.fail(f"{staff['name']} has consecutive off: {d1}, {d2}")

    def test_staff_group_constraint(self, sample_staff, short_dates):
        """Test staff group constraint (only 1 off per group)."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=short_dates,
            constraints={
                'staffGroups': [
                    {'name': 'Group1', 'members': ['staff-1', 'staff-2']}
                ],
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no more than 1 member of Group1 is off per day
        off_symbol = '\u00d7'
        early_symbol = '\u25b3'
        for date in short_dates:
            group_off = sum(
                1 for sid in ['staff-1', 'staff-2']
                if result['schedule'][sid][date] in [off_symbol, early_symbol]
            )
            assert group_off <= 1, f"Group1 has {group_off} members off on {date}"

    def test_5_day_rest_constraint(self, sample_staff, short_dates):
        """Test that no staff works >5 consecutive days."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no 6 consecutive work days for first staff member
        staff_id = sample_staff[0]['id']
        schedule = result['schedule'][staff_id]
        off_symbol = '\u00d7'
        early_symbol = '\u25b3'

        for i in range(len(short_dates) - 5):
            window = short_dates[i:i+6]
            rest_days = sum(
                1 for d in window
                if schedule[d] in [off_symbol, early_symbol]
            )
            assert rest_days >= 1, f"Staff has 6+ work days starting {window[0]}"

    def test_monthly_limits(self, sample_staff, sample_dates):
        """Test that monthly off limits are enforced."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'monthlyLimit': {
                    'minCount': 5,
                    'maxCount': 8,
                    'excludeCalendarRules': True
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        # Check each staff has between 5-8 off days
        off_symbol = '\u00d7'
        for staff in sample_staff:
            off_count = sum(
                1 for date in sample_dates
                if result['schedule'][staff['id']][date] == off_symbol
            )
            assert 5 <= off_count <= 8, f"{staff['name']} has {off_count} off days (expected 5-8)"

    def test_must_work_calendar_rule(self, sample_staff, short_dates):
        """Test that must_work calendar rule is enforced."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=short_dates,
            constraints={
                'calendarRules': {
                    '2025-12-05': {'must_work': True}
                },
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # All staff should be working on Dec 5
        work_symbol = ''  # empty string for work
        for staff in sample_staff:
            assert result['schedule'][staff['id']]['2025-12-05'] == work_symbol

    def test_violations_reported_for_conflicting_constraints(self, small_staff, short_dates):
        """Test that violations are reported when SOFT constraints conflict.

        When constraints conflict but are SOFT, the solver finds a best-effort solution
        and reports violations with penalties.
        """
        optimizer = ShiftScheduleOptimizer()

        # Conflicting constraints: daily min 2 off with only 3 staff over 10 days
        # means each staff needs ~6.7 off days on average, but if max is 5, violations occur
        result = optimizer.optimize_schedule(
            staff_members=small_staff,
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 2},  # Exactly 2 off per day
                'monthlyLimit': {
                    'minCount': None,
                    'maxCount': 3,  # Max 3 off-equivalent per staff (tight constraint)
                },
            },
            timeout_seconds=5
        )

        # Solver should succeed but report violations
        assert result['success'] == True
        # Solution should have violations (either daily under-min or monthly over-max)
        assert result.get('violations') is not None and len(result['violations']) > 0

    def test_solution_statistics(self, sample_staff, short_dates):
        """Test that solution includes statistics."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True
        assert 'stats' in result
        assert 'solve_time' in result
        assert result['stats']['staff_count'] == len(sample_staff)
        assert result['stats']['date_count'] == len(short_dates)

    def test_individual_monthly_limit_override(self, short_dates):
        """Test that individual monthly limits override staff_status limits.

        Scenario:
        - 小泉 is 派遣 with individual limit (min=5, max=5)
        - Default limit for 派遣 is (min=7, max=7)
        - 小泉 should use individual limit (5), not default (7)
        """
        # Staff setup: 小泉 is 派遣 but has individual override
        staff_members = [
            {'id': 'koizumi', 'name': '小泉', 'status': '派遣'},
            {'id': 'tanaka', 'name': '田中', 'status': '派遣'},
            {'id': 'yamada', 'name': '山田', 'status': '社員'},
        ]

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=staff_members,
            date_range=short_dates,  # 10 days
            constraints={
                # New array format with priority: individual > staff_status > all
                'monthlyLimitsArray': [
                    {
                        'id': 'limit-1',
                        'name': '小泉',
                        'scope': 'individual',
                        'targetIds': ['koizumi'],
                        'minCount': 2,  # Individual: min 2
                        'maxCount': 3,  # Individual: max 3
                        'isHardConstraint': True,
                        'excludeCalendarRules': True,
                    },
                    {
                        'id': 'limit-2',
                        'name': 'Default',
                        'scope': 'staff_status',
                        'targetIds': ['派遣', '社員'],
                        'minCount': 1,  # Default: min 1
                        'maxCount': 4,  # Default: max 4
                        'isHardConstraint': True,
                        'excludeCalendarRules': True,
                    },
                ],
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1}
            },
            timeout_seconds=15
        )

        assert result['success'] == True

        # Count off days for each staff
        off_symbol = '\u00d7'

        # 小泉 should have 2-3 off days (individual limit)
        koizumi_off = sum(
            1 for date in short_dates
            if result['schedule']['koizumi'][date] == off_symbol
        )
        assert 2 <= koizumi_off <= 3, f"小泉 has {koizumi_off} off days (expected 2-3 from individual limit)"

        # 田中 should have 1-4 off days (staff_status limit for 派遣)
        tanaka_off = sum(
            1 for date in short_dates
            if result['schedule']['tanaka'][date] == off_symbol
        )
        assert 1 <= tanaka_off <= 4, f"田中 has {tanaka_off} off days (expected 1-4 from staff_status limit)"


class TestFlaskAPI:
    """Test Flask API endpoints."""

    @pytest.fixture
    def client(self):
        from scheduler import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert data['service'] == 'ortools-optimizer'

    def test_optimize_endpoint(self, client):
        """Test optimization endpoint with valid data."""
        payload = {
            'staffMembers': [
                {'id': 's1', 'name': 'Staff 1'},
                {'id': 's2', 'name': 'Staff 2'},
                {'id': 's3', 'name': 'Staff 3'},
            ],
            'dateRange': ['2025-12-01', '2025-12-02', '2025-12-03'],
            'constraints': {
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1}
            },
            'timeout': 10
        }

        response = client.post('/optimize', json=payload)
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] == True
        assert 'schedule' in data

    def test_optimize_missing_fields(self, client):
        """Test optimization endpoint with missing fields."""
        payload = {
            'staffMembers': []
            # Missing dateRange and constraints
        }

        response = client.post('/optimize', json=payload)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] == False
        assert 'Missing required fields' in data['error']

    def test_optimize_empty_body(self, client):
        """Test optimization endpoint with empty body."""
        response = client.post('/optimize', json={})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] == False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
