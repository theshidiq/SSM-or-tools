"""
Test backup staff behavior with early shift (△) and day off (×).

Backup coverage rules:
- Day off (×) - Backup MUST work (○)
- Early shift (△) - Backup does NOT cover (staff still present) → ⊘
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestBackupCoverageEarlyShift:
    """Test backup coverage with pre-filled early shifts."""

    @pytest.fixture
    def minimal_staff(self):
        """3 staff: 1 backup + 2 group members."""
        return [
            {"id": "backup-staff", "name": "Backup", "status": "Regular"},
            {"id": "member-1", "name": "Member1", "status": "Regular"},
            {"id": "member-2", "name": "Member2", "status": "Regular"},
        ]

    @pytest.fixture
    def backup_config(self):
        """Backup assignment: backup-staff covers Group1."""
        return {
            'staffGroups': [
                {
                    'id': 'group-1',
                    'name': 'Group1',
                    'members': ['member-1', 'member-2'],
                }
            ],
            'backupAssignments': [
                {
                    'id': 'assignment-1',
                    'staffId': 'backup-staff',
                    'groupId': 'group-1',
                    'isActive': True,
                }
            ],
            'ortoolsConfig': {
                'hardConstraints': {
                    'backupCoverage': True,  # HARD constraint
                }
            },
            'dailyLimitsRaw': {'minOffPerDay': 0, 'maxOffPerDay': 3},
        }

    def test_backup_unavailable_when_member_has_early_shift(self, minimal_staff, backup_config):
        """
        When member-1 has a pre-filled △ (early shift), backup should be ⊘ (unavailable).

        Early shift means staff is still present, just starting early.
        Backup coverage is NOT needed for early shifts.

        Pre-filled schedule:
        - member-1: △ on Jan 1
        - member-2: (not pre-filled - will work normally)
        - backup-staff: should be ⊘ (no coverage needed)

        Expected:
        - Jan 1: member-1=△, backup=⊘ (no coverage needed)
        """
        dates = ["2026-01-01", "2026-01-02", "2026-01-03"]

        constraints = {
            **backup_config,
            'prefilledSchedule': {
                'member-1': {
                    '2026-01-01': '\u25b3',  # △ early shift
                }
            }
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=minimal_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        # Check member-1 has △ on Jan 1 (pre-filled)
        member1_jan1 = result['schedule'].get('member-1', {}).get('2026-01-01', '')
        assert member1_jan1 == '\u25b3', f"member-1 should have △ on Jan 1, got: {repr(member1_jan1)}"

        # backup-staff should be ⊘ (unavailable) on Jan 1
        # Because member-1 has △ (early shift) - staff is STILL PRESENT, no coverage needed
        backup_jan1 = result['schedule'].get('backup-staff', {}).get('2026-01-01', '')

        print(f"\n=== TEST RESULTS ===")
        print(f"member-1 Jan 1: {repr(member1_jan1)}")
        print(f"backup Jan 1: {repr(backup_jan1)}")

        unavailable_symbol = '\u2298'  # ⊘

        # Backup should be ⊘ (unavailable) - early shift does NOT trigger coverage
        assert backup_jan1 == unavailable_symbol, \
            f"backup should be ⊘ when member has △ (early shift), got: {repr(backup_jan1)}"

    def test_backup_covers_prefilled_day_off(self, minimal_staff, backup_config):
        """
        When member-1 has a pre-filled × (day off), backup should work.
        This is the original expected behavior.
        """
        dates = ["2026-01-01", "2026-01-02", "2026-01-03"]

        constraints = {
            **backup_config,
            'prefilledSchedule': {
                'member-1': {
                    '2026-01-01': '\u00d7',  # × day off
                }
            }
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=minimal_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        # Check member-1 has × on Jan 1 (pre-filled)
        member1_jan1 = result['schedule'].get('member-1', {}).get('2026-01-01', '')
        assert member1_jan1 == '\u00d7', f"member-1 should have × on Jan 1, got: {repr(member1_jan1)}"

        # backup-staff should be WORKING on Jan 1 (coverage needed)
        backup_jan1 = result['schedule'].get('backup-staff', {}).get('2026-01-01', '')

        print(f"\n=== TEST RESULTS ===")
        print(f"member-1 Jan 1: {repr(member1_jan1)}")
        print(f"backup Jan 1: {repr(backup_jan1)}")

        # Backup should be working with ○ symbol (explicit work for パート staff visibility)
        assert backup_jan1 == '○', \
            f"backup should be working (○) when member has ×, got: {repr(backup_jan1)}"

    def test_backup_unavailable_when_no_coverage_needed(self, minimal_staff, backup_config):
        """
        When NO group member has × or △, backup should be ⊘ (unavailable).
        """
        dates = ["2026-01-01", "2026-01-02", "2026-01-03"]

        # No pre-filled schedule - all members will work normally
        constraints = backup_config.copy()

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=minimal_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        # Check backup is ⊘ on days where no coverage is needed
        unavailable_symbol = '\u2298'  # ⊘

        backup_schedule = result['schedule'].get('backup-staff', {})
        member1_schedule = result['schedule'].get('member-1', {})
        member2_schedule = result['schedule'].get('member-2', {})

        print(f"\n=== TEST RESULTS ===")
        for date in dates:
            m1 = member1_schedule.get(date, '')
            m2 = member2_schedule.get(date, '')
            backup = backup_schedule.get(date, '')
            print(f"{date}: member-1={repr(m1)}, member-2={repr(m2)}, backup={repr(backup)}")

            # Check: If neither member has × or △, backup should be ⊘
            off_symbol = '\u00d7'
            early_symbol = '\u25b3'
            any_member_off = m1 in [off_symbol, early_symbol] or m2 in [off_symbol, early_symbol]

            if not any_member_off:
                assert backup == unavailable_symbol, \
                    f"On {date}, no coverage needed but backup is {repr(backup)}, expected ⊘"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
