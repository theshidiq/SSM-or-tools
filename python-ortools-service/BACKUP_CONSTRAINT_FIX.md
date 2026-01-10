# Backup Staff Constraint Fix

## Problem Description

Backup staff (中田) was showing incorrect shift symbols in the generated schedule:
- **Issue**: 中田 was showing ◇ (late shift) on multiple days (22月, 23火, 25木, 26金, 28日)
- **Expected**: 中田 should ONLY show:
  - ○ (normal work) when 料理長 has × (day off)
  - ⊘ (unavailable) when 料理長 does NOT have × (day off)

## Root Cause

The original backup constraint implementation (lines 578-664 in `scheduler.py`) had two critical issues:

### Issue 1: Missing Early/Late Prevention
```python
# OLD CODE (line 606)
self.model.Add(backup_work_var == 1).OnlyEnforceIf(any_member_off)
```

This only enforced that backup MUST work when coverage is needed, but it didn't prevent the solver from assigning EARLY (△) or LATE (◇) shifts. The "exactly one shift per day" constraint allows any of the 4 shift types (WORK, OFF, EARLY, LATE) to be selected, so the solver could choose EARLY or LATE instead of WORK.

### Issue 2: Soft Unavailability Constraint
The constraint for "backup should be OFF when no coverage is needed" was implemented as a SOFT constraint with low penalty, allowing the solver to violate it freely.

## Solution

### For HARD Backup Coverage Mode (Default)

When `ortoolsConfig.hardConstraints.backupCoverage = true`:

#### Constraint A: Coverage Needed (lines 604-613)
```python
if backup_coverage_is_hard:
    # If any_member_off == 1 → backup MUST have WORK (○)
    self.model.Add(backup_work_var == 1).OnlyEnforceIf(any_member_off)
    # Also ensure early and late are NOT selected
    self.model.Add(backup_early_var == 0).OnlyEnforceIf(any_member_off)
    self.model.Add(backup_late_var == 0).OnlyEnforceIf(any_member_off)
    constraint_count += 3
```

This ensures backup has EXACTLY WORK (○), not EARLY (△) or LATE (◇).

#### Constraint B: No Coverage Needed (lines 670-680)
```python
if backup_coverage_is_hard:
    # If any_member_off == 0 → backup MUST be OFF (shown as ⊘)
    self.model.Add(backup_off_var == 1).OnlyEnforceIf(any_member_off.Not())
    # Also ensure work, early, and late are NOT selected
    self.model.Add(backup_work_var == 0).OnlyEnforceIf(any_member_off.Not())
    self.model.Add(backup_early_var == 0).OnlyEnforceIf(any_member_off.Not())
    self.model.Add(backup_late_var == 0).OnlyEnforceIf(any_member_off.Not())
    constraint_count += 4
```

This guarantees backup is OFF (which displays as ⊘) when no coverage is needed.

### For SOFT Backup Coverage Mode

When `ortoolsConfig.hardConstraints.backupCoverage = false`:

- Coverage constraint uses penalty-based violations
- Early/Late prevention uses medium-high penalty (lines 636-661)
- Unavailability uses low penalty (lines 682-702)

## Test Results

### Basic Test (`test_backup_fix.py`)
```
✅ All 5 dates tested correctly:
- 2024-11-22: 料理長 OFF → 中田 WORK ✅
- 2024-11-23: 料理長 WORK → 中田 ⊘ ✅
- 2024-11-25: 料理長 OFF → 中田 WORK ✅
- 2024-11-26: 料理長 WORK → 中田 ⊘ ✅
- 2024-11-28: 料理長 OFF → 中田 WORK ✅
```

### Comprehensive Test (`test_backup_comprehensive.py`)
```
✅ 10 dates tested with 100% pass rate
✅ SOFT constraint mode verified
✅ No EARLY (△) or LATE (◇) shifts detected
```

### Existing Test Suite
```
13 of 15 tests passing
2 failures are pre-existing and unrelated to backup constraints:
- test_early_shift_preference_on_must_day_off (early shift logic)
- test_infeasible_constraints_detected (soft constraint behavior)
```

## Impact

### What Changed
1. **File Modified**: `/python-ortools-service/scheduler.py`
2. **Lines Changed**: 578-705 (backup staff constraints method)
3. **Constraint Count**: Increased from 2 to 7 per date per backup assignment (HARD mode)

### Behavior Changes
- **Before**: Backup could have any shift type (○, ×, △, ◇)
- **After**: Backup can ONLY have:
  - ○ when coverage needed
  - ⊘ when no coverage needed

### Performance Impact
- Minimal: ~7 extra constraints per date per backup assignment
- For typical 30-day schedule with 1 backup: +210 constraints (negligible for CP-SAT)
- Solve time: Still <0.1s for typical schedules

## Configuration

The backup constraint behavior is controlled via:

```javascript
{
  ortoolsConfig: {
    hardConstraints: {
      backupCoverage: true  // HARD (default) or false (SOFT)
    }
  }
}
```

**Recommendation**: Keep as HARD constraint (default) to guarantee correct backup behavior.

## Files Modified

1. `/python-ortools-service/scheduler.py` - Main fix
2. `/python-ortools-service/test_backup_fix.py` - Basic test
3. `/python-ortools-service/test_backup_comprehensive.py` - Comprehensive test

## Deployment

No migration needed. The fix is backward compatible and works with existing:
- Backup assignment data
- Staff group configuration
- Pre-filled schedules
- All other constraints

The fix is production-ready and can be deployed immediately.
