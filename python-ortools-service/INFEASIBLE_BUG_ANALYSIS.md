# INFEASIBLE Error Analysis: start_period + HARD Priority Rules Bug

## Problem Summary

The OR-Tools scheduler returns **INFEASIBLE** when a staff member has:
1. A `start_period` after the schedule start date (e.g., 村上 starts Jan 17, 2026)
2. HARD priority rules that apply to days before their start date

## Root Cause

### Bug Location: `scheduler.py` lines 2405-2413

```python
# Skip dates after staff's end_period (no variables exist)
if not self._staff_works_on_date(target_staff_id, date):
    continue

day_name = self._get_day_of_week(date)
if day_name not in target_days:
    continue

shift_var = self.shifts[(target_staff_id, date, shift_type)]  # ❌ BUG: KeyError!
```

### The Issue

1. **Variable Creation** (`_create_variables()`, line 371):
   - Variables are only created for dates where `_staff_works_on_date()` returns `True`
   - For 村上 with `start_period: 2026-01-17`, **NO variables exist** for Jan 1-16

2. **Priority Rules Application** (`_add_priority_rules()`, line 2405-2413):
   - The code correctly skips dates with `if not _staff_works_on_date()`
   - **BUT** the logic flaw: It skips to the next date in the loop, but the check happens BEFORE the day-of-week matching
   - When a HARD rule says "村上 cannot have OFF on Sundays":
     - For Sunday Jan 12 (before start_period):
       - `_staff_works_on_date('村上', '2026-01-12')` returns `False`
       - Code skips this date (continues to next date)
       - This is CORRECT behavior ✅
     - For Sunday Jan 19 (after start_period):
       - `_staff_works_on_date('村上', '2026-01-19')` returns `True`
       - Code proceeds to line 2413: `shift_var = self.shifts[...]`
       - Variable exists, constraint is added ✅

3. **Wait, then what's the actual bug?**

Let me re-examine the code flow more carefully...

## Detailed Code Flow Analysis

### Scenario: 村上 (Murakami)
- `start_period: {day: 17, year: 2026, month: 1}` → "2026-01-17"
- Schedule period: Jan-Feb 2026 (Jan 1 - Feb 28)
- HARD priority rule: "haken rule" - 村上 & 李 cannot have OFF on Sundays

### What Happens:

1. **`_create_variables()` is called first** (line 353):
   ```python
   for date in self.date_range:  # Jan 1 - Feb 28
       if not self._staff_works_on_date(staff_id, date):
           skipped_count += 4  # Skip Jan 1-16 for 村上
           continue
       # Only creates variables for Jan 17 - Feb 28
   ```

2. **`_add_priority_rules()` is called later** (line 2249):
   ```python
   for date in self.date_range:  # Jan 1 - Feb 28
       if date in self.calendar_off_dates or date in self.calendar_work_dates:
           continue  # Skip calendar override dates

       # ❌ BUG: This check comes AFTER calendar dates check
       if not self._staff_works_on_date(target_staff_id, date):
           continue  # Skip Jan 1-16

       day_name = self._get_day_of_week(date)
       if day_name not in target_days:  # Skip non-Sunday dates
           continue

       # For Sunday Jan 19, 26, Feb 2, 9, 16, 23:
       shift_var = self.shifts[(target_staff_id, date, shift_type)]

       if is_hard:
           # HARD constraint: MUST NOT have OFF on Sundays
           self.model.Add(shift_var == 0)  # ❌ Force NOT OFF
   ```

### The REAL Problem

Actually, wait - the code DOES check `_staff_works_on_date()` at line 2405-2407. Let me check if there's a different issue...

## Alternative Hypothesis: Conflicting HARD Constraints

Looking at the rules:
1. **"haken rule"**: 村上 & 李 **CANNOT have OFF** on Sundays (HARD)
2. **"nakata rule"**: nakata **MUST have OFF** on Sun/Tue/Sat (HARD)
3. **"wekend nott"**: Another staff **MUST avoid OFF** on Sun/Sat/Tue (HARD)

### Potential Conflict Scenario

If multiple HARD rules create impossible constraints:

**Example Conflict:**
- Sunday Jan 19:
  - "haken rule" (HARD): 村上 cannot have OFF → `shifts[村上][2026-01-19][OFF] == 0`
  - "haken rule" (HARD): 李 cannot have OFF → `shifts[李][2026-01-19][OFF] == 0`
  - "nakata rule" (HARD): nakata MUST have OFF → `shifts[nakata][2026-01-19][OFF] == 1`
  - "wekend nott" (HARD): staff X cannot have OFF → `shifts[X][2026-01-19][OFF] == 0`

Combined with:
- **Daily OFF limits**: min=1, max=4 staff off per day
- **Staff type limits**: 派遣/パート can only have WORK or OFF (not early/late)
- **Monthly limits**: Each staff needs 6-8 off days per month
- **5-day rest rule**: No more than 5 consecutive work days

**Result**: INFEASIBLE when:
- Too many staff are forced to WORK on Sunday (via HARD "cannot have OFF" rules)
- But monthly limits require them to have OFF days somewhere
- And the remaining days have similar HARD constraints blocking OFF assignments

## The Core Issue: start_period Parsing

Looking back at line 246:
```python
if len(self.date_range) > 0 and start_date_str > self.date_range[0]:
    self.staff_start_dates[staff['id']] = start_date_str
```

**POTENTIAL BUG**: This checks if `start_date_str > self.date_range[0]`, which means:
- If start_period = "2026-01-17" and date_range[0] = "2026-01-01"
- Condition is True: "2026-01-17" > "2026-01-01" ✅
- Staff is correctly added to `staff_start_dates`

But what if the staff's start_period is **exactly equal** to the first date?
- If start_period = "2026-01-01" and date_range[0] = "2026-01-01"
- Condition is False: NOT ("2026-01-01" > "2026-01-01")
- Staff is **NOT added** to `staff_start_dates`
- Result: Variables are created for ALL dates (including before start_period)

**FIX NEEDED**: Change `>` to `>=`:
```python
if len(self.date_range) > 0 and start_date_str >= self.date_range[0]:
```

## Recommended Fixes

### Fix 1: Correct start_period comparison (Line 246)

**Current Code:**
```python
if len(self.date_range) > 0 and start_date_str > self.date_range[0]:
```

**Fixed Code:**
```python
if len(self.date_range) > 0 and start_date_str >= self.date_range[0]:
```

**Reason**: Staff with start_period equal to the first schedule date should still be tracked.

### Fix 2: Add defensive check in priority rules (Line 2413)

**Current Code:**
```python
shift_var = self.shifts[(target_staff_id, date, shift_type)]
```

**Fixed Code:**
```python
# Defensive check: Skip if variable doesn't exist (shouldn't happen if _staff_works_on_date is correct)
shift_key = (target_staff_id, date, shift_type)
if shift_key not in self.shifts:
    logger.warning(f"  Variable not found: {shift_key} - skipping")
    continue

shift_var = self.shifts[shift_key]
```

**Reason**: Prevents KeyError if there's any edge case where `_staff_works_on_date` returns True but variables don't exist.

### Fix 3: Relax conflicting HARD constraints

The user reported that even after removing staff group members, it's still INFEASIBLE. This suggests the issue is NOT staff groups, but conflicting HARD priority rules.

**Option A**: Convert HARD priority rules to SOFT with very high penalties
- Change line 2458-2460 to use high-penalty soft constraints instead
- Already done for staff groups (line 1022) and staff type limits (line 1392)

**Option B**: Add conflict detection before solving
- Scan all HARD constraints for potential conflicts
- Warn user about impossible constraint combinations

**Option C**: Implement constraint relaxation
- When INFEASIBLE is detected, automatically try relaxing HARD constraints one by one
- Return a report of which constraints were violated

### Fix 4: Better start_period handling in monthly limits (Line 1826)

Current code prorates monthly limits based on working days, but doesn't validate that the prorated limits are achievable with the HARD constraints.

**Example**:
- 村上 starts Jan 17 (only 14 days in Jan)
- Monthly min = 6 off days (prorated to ~3 days for 14 working days)
- But HARD rule: Cannot have OFF on Sundays (removes 2 Sundays from available OFF days)
- Result: Only 12 possible OFF days, but needs 3 - should be feasible
- UNLESS other HARD constraints block more dates...

## Conclusion

The INFEASIBLE error is likely caused by:

1. **Primary Issue**: Multiple conflicting HARD priority rules that over-constrain the schedule
   - "haken rule" forces 村上 & 李 to work on Sundays
   - "nakata rule" forces nakata to be off on Sun/Tue/Sat
   - "wekend nott" forces another staff to work on Sun/Sat/Tue
   - These constraints, combined with daily limits and monthly limits, create an impossible situation

2. **Secondary Issue**: Potential edge case in start_period parsing (line 246)
   - Using `>` instead of `>=` might miss staff who start exactly on the first day

3. **Tertiary Issue**: No defensive check in priority rules (line 2413)
   - If variables don't exist due to start_period, code will crash with KeyError

## Next Steps

1. **Apply Fix 1**: Change line 246 from `>` to `>=`
2. **Apply Fix 2**: Add defensive check at line 2413
3. **Analyze constraint conflicts**:
   - Check if the 3 HARD priority rules + daily/monthly limits are mathematically satisfiable
   - Use CP-SAT's built-in conflict detection to identify which constraints are conflicting
4. **Consider converting HARD priority rules to SOFT**:
   - Like staff groups and staff type limits, use high-penalty soft constraints instead
   - This guarantees a solution while heavily penalizing violations

## Testing Plan

1. **Test Case 1**: Staff with start_period = schedule start date
   - Should create variables and constraints correctly

2. **Test Case 2**: Staff with start_period mid-period + HARD priority rule
   - Should skip dates before start_period
   - Should apply rules only to dates after start_period

3. **Test Case 3**: Conflicting HARD rules
   - Multiple staff with conflicting Sunday constraints
   - Should either find solution or report specific conflict

4. **Test Case 4**: Remove all HARD priority rules
   - Convert to SOFT with high penalties
   - Should return FEASIBLE solution with violation report
