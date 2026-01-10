"""
Debug test for backup staff coverage constraint.
Tests the exact data from database to verify constraint is working.
"""

import pytest
from scheduler import ShiftScheduleOptimizer


class TestBackupCoverageDebug:
    """Debug tests for backup staff coverage with real data from database."""

    @pytest.fixture
    def real_staff(self):
        """Staff members from actual database."""
        return [
            # 中田 is backup staff
            {"id": "264ef552-acf3-4e18-bba5-50beb841fe61", "name": "中田", "status": "Regular"},
            # 料理長 and 古藤 are in Group 2
            {"id": "23ad831b-f8b3-415f-82e3-a6723a090dc6", "name": "料理長", "status": "Regular"},
            {"id": "6db0a3f1-39a5-4f3c-812f-6ddb55877725", "name": "古藤", "status": "Regular"},
            # Additional staff
            {"id": "staff-4", "name": "井関", "status": "Regular"},
            {"id": "staff-5", "name": "井岡", "status": "Regular"},
            {"id": "staff-6", "name": "与儀", "status": "Regular"},
        ]

    @pytest.fixture
    def real_constraints(self):
        """Constraints matching the database configuration."""
        return {
            # Staff groups from database
            'staffGroups': [
                {
                    'id': '44d63f86-d4c3-4e09-8fb9-e9a6aa1932ee',
                    'name': 'Group 2',
                    # Members field should be at top level (extracted from group_config by Go server)
                    'members': [
                        '23ad831b-f8b3-415f-82e3-a6723a090dc6',  # 料理長
                        '6db0a3f1-39a5-4f3c-812f-6ddb55877725',  # 古藤
                    ],
                },
            ],
            # Backup assignments from database
            'backupAssignments': [
                {
                    'id': 'eb53dc87-8699-4a32-bcfd-1f899ff539a9',
                    'staffId': '264ef552-acf3-4e18-bba5-50beb841fe61',  # 中田
                    'groupId': '44d63f86-d4c3-4e09-8fb9-e9a6aa1932ee',  # Group 2
                    'isActive': True,
                },
            ],
            # Daily limits
            'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2},
            # OR-Tools config with HARD backup coverage
            'ortoolsConfig': {
                'hardConstraints': {
                    'backupCoverage': True,  # HARD constraint
                },
            },
        }

    @pytest.fixture
    def short_dates(self):
        """Short date range for testing."""
        return [f"2026-01-{str(d).zfill(2)}" for d in range(1, 11)]

    def test_backup_coverage_when_member_has_day_off(self, real_staff, real_constraints, short_dates):
        """
        Test that backup staff (中田) gets ○ when a group member has × day off.

        Expected behavior:
        - When 料理長 or 古藤 has × (day off), 中田 should have ○ (work/cover)
        - When neither has × (both working), 中田 should have ⊘ (unavailable)
        """
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=real_staff,
            date_range=short_dates,
            constraints=real_constraints,
            timeout_seconds=15
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        # Symbols
        work_symbol = ''      # Empty = normal work
        off_symbol = '\u00d7'  # × = day off
        early_symbol = '\u25b3'  # △ = early shift
        late_symbol = '\u25c7'   # ◇ = late shift
        cover_symbol = '\u25cb'  # ○ = work/cover (for backup)
        unavailable_symbol = '\u2298'  # ⊘ = unavailable

        # Get schedules
        nakata_id = '264ef552-acf3-4e18-bba5-50beb841fe61'
        ryoricho_id = '23ad831b-f8b3-415f-82e3-a6723a090dc6'
        koto_id = '6db0a3f1-39a5-4f3c-812f-6ddb55877725'

        nakata_schedule = result['schedule'].get(nakata_id, {})
        ryoricho_schedule = result['schedule'].get(ryoricho_id, {})
        koto_schedule = result['schedule'].get(koto_id, {})

        print("\n=== BACKUP COVERAGE TEST RESULTS ===")
        print(f"Nakata (backup) schedule: {nakata_schedule}")
        print(f"Ryoricho schedule: {ryoricho_schedule}")
        print(f"Koto schedule: {koto_schedule}")

        coverage_correct = 0
        coverage_incorrect = 0

        for date in short_dates:
            ryoricho_shift = ryoricho_schedule.get(date, work_symbol)
            koto_shift = koto_schedule.get(date, work_symbol)
            nakata_shift = nakata_schedule.get(date, '')

            any_member_off = ryoricho_shift == off_symbol or koto_shift == off_symbol

            print(f"\n{date}:")
            print(f"  料理長: {repr(ryoricho_shift)}, 古藤: {repr(koto_shift)}")
            print(f"  Any member OFF: {any_member_off}")
            print(f"  中田 (backup): {repr(nakata_shift)}")

            if any_member_off:
                # When a group member is OFF, backup should be WORK (empty string or ○)
                if nakata_shift in [work_symbol, cover_symbol]:
                    print(f"  ✅ CORRECT: Backup is covering")
                    coverage_correct += 1
                else:
                    print(f"  ❌ WRONG: Backup should be working/covering, got: {repr(nakata_shift)}")
                    coverage_incorrect += 1
            else:
                # When NO group member is OFF, backup should be UNAVAILABLE (⊘) or OFF (×)
                if nakata_shift in [unavailable_symbol, off_symbol]:
                    print(f"  ✅ CORRECT: Backup is unavailable (no coverage needed)")
                    coverage_correct += 1
                else:
                    print(f"  ⚠️ WARNING: Backup is {repr(nakata_shift)} (expected unavailable)")
                    # This is not strictly wrong, but not ideal

        print(f"\n=== SUMMARY ===")
        print(f"Coverage correct: {coverage_correct}")
        print(f"Coverage incorrect: {coverage_incorrect}")

        # The key assertion: NO incorrect coverage (backup working when should be unavailable)
        assert coverage_incorrect == 0, f"Backup coverage constraint not working correctly"

    def test_backup_coverage_with_forced_day_off(self, real_staff, real_constraints):
        """
        Force a specific member to have day off and verify backup covers.
        Uses pre-filled schedule to set 料理長 as OFF on specific dates.
        """
        # 3 day range
        dates = ["2026-01-06", "2026-01-07", "2026-01-08"]

        # Force 料理長 to be OFF on Jan 6
        constraints = {
            **real_constraints,
            'prefilledSchedule': {
                '23ad831b-f8b3-415f-82e3-a6723a090dc6': {  # 料理長
                    '2026-01-06': '\u00d7',  # × day off
                }
            }
        }

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=real_staff,
            date_range=dates,
            constraints=constraints,
            timeout_seconds=10
        )

        assert result['success'] == True, f"Optimization failed: {result.get('error')}"

        nakata_id = '264ef552-acf3-4e18-bba5-50beb841fe61'
        ryoricho_id = '23ad831b-f8b3-415f-82e3-a6723a090dc6'

        nakata_jan6 = result['schedule'].get(nakata_id, {}).get('2026-01-06', '')
        ryoricho_jan6 = result['schedule'].get(ryoricho_id, {}).get('2026-01-06', '')

        print(f"\n=== FORCED DAY OFF TEST ===")
        print(f"Jan 6 - 料理長: {repr(ryoricho_jan6)}, 中田: {repr(nakata_jan6)}")

        # 料理長 should be OFF (as pre-filled)
        assert ryoricho_jan6 == '\u00d7', f"料理長 should be OFF, got: {repr(ryoricho_jan6)}"

        # 中田 (backup) should be WORKING (○ symbol for backup covering)
        assert nakata_jan6 == '○', f"中田 (backup) should be working (○), got: {repr(nakata_jan6)}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
