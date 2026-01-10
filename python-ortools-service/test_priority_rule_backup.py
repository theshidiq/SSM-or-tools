"""
Test backup coverage with priority rules.

Backup coverage rules:
- Day off (×) - Backup MUST work (○)
- Early shift (△) - Backup does NOT cover (staff still present) → ⊘

Priority rules for early shifts do NOT trigger backup coverage.
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestBackupCoveragePriorityRules:
    """Test backup coverage with priority rule early shifts."""

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

    def test_backup_unavailable_with_hard_priority_rule_early_shift(self, minimal_staff, backup_config):
        """
        When member-1 has a HARD priority rule for early shifts, backup is ⊘.

        HARD priority rule forces member-1 to have △ on Jan 4 (Sunday).
        Early shift does NOT trigger backup coverage - staff is still present.
        """
        # Jan 4, 2026 is a Sunday
        dates = ["2026-01-04", "2026-01-05", "2026-01-06"]

        constraints = {
            **backup_config,
            'priorityRules': [
                {
                    'id': 'rule-1',
                    'name': 'Member1 Sunday Early',
                    'staffId': 'member-1',  # Direct staffId
                    'ruleType': 'preferred_shift',
                    'shiftType': 'early',
                    'daysOfWeek': [0],  # Sunday
                    'isHardConstraint': True,  # HARD - forces the shift
                }
            ]
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=minimal_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        # Check member-1 has △ on Jan 4 (Sunday) due to HARD priority rule
        member1_jan4 = result['schedule'].get('member-1', {}).get('2026-01-04', '')
        early_symbol = '\u25b3'  # △

        print(f"\n=== TEST RESULTS ===")
        print(f"member-1 Jan 4 (Sunday): {repr(member1_jan4)}")

        # HARD priority rule should force △
        assert member1_jan4 == early_symbol, \
            f"member-1 should have △ on Jan 4 (HARD priority rule), got: {repr(member1_jan4)}"

        # backup-staff should be ⊘ (unavailable) - early shift does NOT trigger coverage
        backup_jan4 = result['schedule'].get('backup-staff', {}).get('2026-01-04', '')
        print(f"backup Jan 4: {repr(backup_jan4)}")

        unavailable_symbol = '\u2298'  # ⊘

        # Backup should be ⊘ - early shift means staff is still present
        assert backup_jan4 == unavailable_symbol, \
            f"backup should be ⊘ when member has △ (early shift), got: {repr(backup_jan4)}"

    def test_backup_unavailable_with_soft_priority_rule_early_shift(self, minimal_staff, backup_config):
        """
        When member-1 has a SOFT priority rule for early shifts, backup is ⊘.

        SOFT priority rule prefers member-1 to have △ on Sunday.
        Whether or not △ is selected, early shift does NOT trigger backup coverage.
        """
        # Jan 4, 2026 is a Sunday
        dates = ["2026-01-04", "2026-01-05", "2026-01-06"]

        constraints = {
            **backup_config,
            'priorityRules': [
                {
                    'id': 'rule-1',
                    'name': 'Member1 Sunday Early',
                    'staffId': 'member-1',
                    'ruleType': 'preferred_shift',
                    'shiftType': 'early',
                    'daysOfWeek': [0],  # Sunday
                    'isHardConstraint': False,  # SOFT - preference only
                    'priorityLevel': 3,  # High priority
                }
            ]
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=minimal_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        member1_jan4 = result['schedule'].get('member-1', {}).get('2026-01-04', '')
        backup_jan4 = result['schedule'].get('backup-staff', {}).get('2026-01-04', '')

        early_symbol = '\u25b3'  # △
        unavailable_symbol = '\u2298'  # ⊘
        off_symbol = '\u00d7'  # ×

        print(f"\n=== TEST RESULTS (SOFT RULE) ===")
        print(f"member-1 Jan 4 (Sunday): {repr(member1_jan4)}")
        print(f"backup Jan 4: {repr(backup_jan4)}")

        # Early shift does NOT trigger backup coverage
        # Backup should be ⊘ regardless of whether member has △ or works normally
        assert backup_jan4 == unavailable_symbol, \
            f"backup should be ⊘ (early shift does not trigger coverage), got: {repr(backup_jan4)}"

    def test_backup_covers_when_member_has_day_off(self, minimal_staff, backup_config):
        """
        Test backup coverage when member has day off (×).

        Only day off triggers backup coverage:
        - member-1: △ (early) → does NOT trigger coverage
        - member-2: × (off) → TRIGGERS coverage
        """
        dates = ["2026-01-01", "2026-01-02", "2026-01-03"]

        constraints = {
            **backup_config,
            'prefilledSchedule': {
                'member-1': {'2026-01-01': '\u25b3'},  # △ early - does NOT trigger
                'member-2': {'2026-01-01': '\u00d7'},  # × off - TRIGGERS coverage
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

        member1_jan1 = result['schedule'].get('member-1', {}).get('2026-01-01', '')
        member2_jan1 = result['schedule'].get('member-2', {}).get('2026-01-01', '')
        backup_jan1 = result['schedule'].get('backup-staff', {}).get('2026-01-01', '')

        print(f"\n=== TEST RESULTS (MEMBER HAS DAY OFF) ===")
        print(f"member-1 Jan 1: {repr(member1_jan1)} (early - no coverage)")
        print(f"member-2 Jan 1: {repr(member2_jan1)} (off - triggers coverage)")
        print(f"backup Jan 1: {repr(backup_jan1)}")

        # member-2 has × (day off), so backup MUST work with ○ symbol
        assert backup_jan1 == '○', \
            f"backup should be working (○) when member has day off (×), got: {repr(backup_jan1)}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
