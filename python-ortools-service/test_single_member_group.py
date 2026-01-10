"""
Test backup coverage with SINGLE member group.

Backup coverage rules:
- Day off (×) - Backup MUST work (○)
- Early shift (△) - Backup does NOT cover (staff still present) → ⊘

This tests the scenario from the database where Group 2 has only 1 valid member (料理長).
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestSingleMemberGroupBackup:
    """Test backup coverage when group has only 1 member."""

    @pytest.fixture
    def single_member_staff(self):
        """2 staff: 1 backup + 1 group member (like real scenario)."""
        return [
            {"id": "backup-staff", "name": "中田", "status": "Regular"},
            {"id": "ryoricho", "name": "料理長", "status": "Regular"},
        ]

    @pytest.fixture
    def single_member_config(self):
        """Backup config with single member group."""
        return {
            'staffGroups': [
                {
                    'id': 'group-2',
                    'name': 'Group2',
                    'members': ['ryoricho'],  # Only 1 member!
                }
            ],
            'backupAssignments': [
                {
                    'id': 'assignment-1',
                    'staffId': 'backup-staff',
                    'groupId': 'group-2',
                    'isActive': True,
                }
            ],
            'ortoolsConfig': {
                'hardConstraints': {
                    'backupCoverage': True,
                }
            },
            'dailyLimitsRaw': {'minOffPerDay': 0, 'maxOffPerDay': 3},
        }

    def test_single_member_prefilled_early_backup_unavailable(self, single_member_staff, single_member_config):
        """
        When the ONLY group member has △ (early shift), backup should be ⊘.

        Early shift does NOT trigger backup coverage - staff is still present.
        """
        dates = ["2026-01-04", "2026-01-05", "2026-01-06"]  # Jan 4 is Sunday

        constraints = {
            **single_member_config,
            'prefilledSchedule': {
                'ryoricho': {
                    '2026-01-04': '\u25b3',  # △ early shift - does NOT trigger coverage
                }
            }
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=single_member_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        ryoricho_jan4 = result['schedule'].get('ryoricho', {}).get('2026-01-04', '')
        backup_jan4 = result['schedule'].get('backup-staff', {}).get('2026-01-04', '')

        print(f"\n=== SINGLE MEMBER GROUP TEST (EARLY SHIFT) ===")
        print(f"料理長 (ryoricho) Jan 4: {repr(ryoricho_jan4)}")
        print(f"中田 (backup) Jan 4: {repr(backup_jan4)}")

        # 料理長 should have △ (pre-filled)
        assert ryoricho_jan4 == '\u25b3', f"ryoricho should have △, got: {repr(ryoricho_jan4)}"

        # Backup should be ⊘ (unavailable) - early shift does NOT trigger coverage
        assert backup_jan4 == '\u2298', \
            f"backup should be ⊘ when member has △ (early), got: {repr(backup_jan4)}"

    def test_single_member_priority_rule_early_backup_unavailable(self, single_member_staff, single_member_config):
        """
        When single member has HARD priority rule for early → backup is ⊘.

        Early shift does NOT trigger backup coverage - staff is still present.
        """
        dates = ["2026-01-04", "2026-01-05", "2026-01-06"]

        constraints = {
            **single_member_config,
            'priorityRules': [
                {
                    'id': 'rule-1',
                    'staffId': 'ryoricho',
                    'ruleType': 'preferred_shift',
                    'shiftType': 'early',
                    'daysOfWeek': [0],  # Sunday
                    'isHardConstraint': True,
                }
            ]
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=single_member_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        ryoricho_jan4 = result['schedule'].get('ryoricho', {}).get('2026-01-04', '')
        backup_jan4 = result['schedule'].get('backup-staff', {}).get('2026-01-04', '')

        print(f"\n=== SINGLE MEMBER + PRIORITY RULE TEST (EARLY) ===")
        print(f"料理長 (ryoricho) Jan 4 (Sunday): {repr(ryoricho_jan4)}")
        print(f"中田 (backup) Jan 4: {repr(backup_jan4)}")

        # With HARD priority rule, ryoricho should have △
        assert ryoricho_jan4 == '\u25b3', f"ryoricho should have △ (HARD rule), got: {repr(ryoricho_jan4)}"

        # Backup should be ⊘ - early shift does NOT trigger coverage
        assert backup_jan4 == '\u2298', \
            f"backup should be ⊘ when member has △ (early), got: {repr(backup_jan4)}"

    def test_single_member_working_backup_unavailable(self, single_member_staff, single_member_config):
        """
        When the ONLY group member is WORKING (not off/early), backup is unavailable.
        """
        dates = ["2026-01-05", "2026-01-06", "2026-01-07"]

        # No prefilled, no priority rules → member will work normally
        constraints = single_member_config.copy()

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=single_member_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        ryoricho_schedule = result['schedule'].get('ryoricho', {})
        backup_schedule = result['schedule'].get('backup-staff', {})

        print(f"\n=== SINGLE MEMBER WORKING - NO COVERAGE NEEDED ===")
        for date in dates:
            ryoricho = ryoricho_schedule.get(date, '')
            backup = backup_schedule.get(date, '')
            print(f"{date}: ryoricho={repr(ryoricho)}, backup={repr(backup)}")

            # If ryoricho is working (empty), backup should be unavailable (⊘)
            if ryoricho == '':
                assert backup == '\u2298', \
                    f"On {date}, when ryoricho works, backup should be ⊘, got: {repr(backup)}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
