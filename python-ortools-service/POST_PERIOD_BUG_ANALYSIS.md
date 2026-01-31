# Post-Period Constraint Bug Analysis

## Bug Report Summary

**Issue**: March 7 is showing day-offs (×) for 小池 and 岸 despite post-period HARD constraint that should prevent day-offs after a maintenance closure period (March 3-5).

**Expected Behavior**:
- March 3-5: All staff get × (must_day_off - maintenance closure)
- March 6: HARD constraint prevents × for 社員/派遣 (post-period protection)
- March 7: Normal scheduling (no special constraints)

**Actual Behavior** (from screenshot):
- March 3-5: ✅ Correctly shows × for all staff
- March 6: ✅ Shows △ (early shift) for many staff - working as expected
- March 7: ❌ Shows × for 小池 and 岸 - BUG!

## Investigation Results

### 1. Code Analysis

#### Data Format Verification
The `CalendarRulesLoader.js` (lines 69-81) returns calendar rules in this format:
```javascript
{
  "2026-03-03": { must_work: false, must_day_off: true },
  "2026-03-04": { must_work: false, must_day_off: true },
  "2026-03-05": { must_work: false, must_day_off: true }
}
```

This is the correct dict format for the Python scheduler.

#### Fixed Code in scheduler.py (lines 2364-2366)
```python
must_day_off_dates = sorted([
    date for date, rule in calendar_rules.items()
    if isinstance(rule, dict) and rule.get('must_day_off') and date in self.date_range
])
```

The fix correctly extracts must_day_off dates from the dict format.

#### Alternative String Format Support (lines 2376-2383)
Added fallback support for alternative string format:
```python
must_day_off_dates_alt = sorted([
    date for date, rule in calendar_rules.items()
    if rule == 'must_day_off' and date in self.date_range
])

if not must_day_off_dates and must_day_off_dates_alt:
    must_day_off_dates = must_day_off_dates_alt
```

### 2. Constraint Logic Verification

#### Period Detection (Working Correctly)
```
Must day-off dates: ['2026-03-03', '2026-03-04', '2026-03-05']
Period detected: 2026-03-03 ~ 2026-03-05 (3 days)
Post-period date: 2026-03-06 ✅
```

The logic correctly:
1. Groups March 3-5 as a single period (3 consecutive days)
2. Meets minimum period length (3 days)
3. Calculates March 6 as the post-period date

#### HARD Constraint Implementation (lines 2487-2505)
```python
if is_hard_constraint:
    escape_var = self.model.NewBoolVar(f'post_period_escape_{staff_id}_{date}')

    # Cannot have off day UNLESS escape hatch is triggered
    self.model.Add(off_var == 0).OnlyEnforceIf(escape_var.Not())

    # Heavily penalize escape hatch usage
    self.violation_vars.append((
        escape_var,
        escape_penalty,  # 10000 - very high penalty
        f'HARD escape: Post-period day-off for {staff_name} ({staff_status}) on {date}'
    ))
```

The HARD constraint:
- Prevents day-off (×) on March 6 for 社員/派遣
- Escape penalty: 10,000 (very high)
- Applied only to March 6, NOT March 7

## Root Cause Analysis

### Why March 7 Shows Day-offs

**March 7 is NOT a post-period date** - it's a regular scheduling day with no special constraints.

The constraint is working EXACTLY as designed:
1. ✅ March 3-5: Must day-off (all × enforced)
2. ✅ March 6: Post-period protection (prevent × for 社員/派遣)
3. ❌ March 7: Regular scheduling (allows × based on other constraints)

### The Real Issue: User Expectation vs Implementation

**User expects**: Protection for MULTIPLE days after the closure period
**Current implementation**: Protection for ONLY 1 day after the closure period

From the screenshot:
- March 3-5: Closure period (3 days)
- March 6: Protected (post-period day 1)
- March 7: NOT protected (post-period day 2) ← User wants this protected too!

## Possible Solutions

### Option 1: Extend Post-Period Protection (Recommended)

Add a new config option `postPeriodDays` to protect multiple days:

```javascript
// Settings config
{
  earlyShiftConfig: {
    postPeriodConstraint: {
      enabled: true,
      minPeriodLength: 3,
      postPeriodDays: 2,  // ← NEW: Protect 2 days after period ends
      avoidDayOffForShain: true,
      avoidDayOffForHaken: true,
      isHardConstraint: true
    }
  }
}
```

Implementation in `scheduler.py`:
```python
post_period_days = post_period_config.get('postPeriodDays', 1)  # Default: 1 day

for period in filtered_periods:
    end_date = datetime.strptime(period['end'], '%Y-%m-%d')

    # Generate multiple post-period dates
    for day_offset in range(1, post_period_days + 1):
        next_day = (end_date + timedelta(days=day_offset)).strftime('%Y-%m-%d')
        if next_day in self.date_range:
            post_period_dates.append(next_day)
```

### Option 2: Add "Consecutive Day-offs After Closure" Constraint

Create a new constraint that prevents consecutive day-offs immediately after a closure period:

```python
# Prevent staff from taking day-off on March 7 if they're off on March 6
# This ensures gradual return to work
```

### Option 3: Database Issue (Less Likely)

**Check if March 6 is actually in the database as must_day_off:**

```sql
SELECT date, rule_type
FROM calendar_rules
WHERE restaurant_id = 'YOUR_RESTAURANT_ID'
AND date BETWEEN '2026-03-03' AND '2026-03-07'
ORDER BY date;
```

If the result shows:
```
2026-03-03 | must_day_off
2026-03-04 | must_day_off
2026-03-05 | must_day_off
2026-03-06 | must_day_off  ← If this exists, March 7 would be the post-period date
```

Then the constraint is actually working correctly for March 7!

## Enhanced Diagnostic Logging

Added comprehensive logging to capture production behavior:

### 1. Calendar Rules Inspection (lines 2368-2373)
```python
logger.info(f"  [DIAGNOSTIC] Calendar rules received (first 5 entries):")
for idx, (date, rule) in enumerate(list(calendar_rules.items())[:5]):
    logger.info(f"    {date}: {rule} (type: {type(rule).__name__})")
```

### 2. Format Detection (lines 2375-2383)
```python
logger.info(f"  [DIAGNOSTIC] must_day_off dates (dict format): {must_day_off_dates}")
logger.info(f"  [DIAGNOSTIC] must_day_off dates (string format): {must_day_off_dates_alt}")
```

### 3. Post-Period Date Confirmation (lines 2454-2456)
```python
logger.info(f"  [DIAGNOSTIC] POST-PERIOD DATES TO PROTECT: {post_period_dates}")
logger.info(f"  [DIAGNOSTIC] These dates will have HARD constraints against day-off (×)")
```

### 4. Per-Date Staff Tracking (lines 2469-2471, 2531)
```python
logger.info(f"  [DIAGNOSTIC] Processing post-period date: {date}")
# ... constraint application ...
logger.info(f"    → Applied constraints to {staff_constraint_count} staff on {date}")
```

## Next Steps

1. **Run the scheduler** with enhanced logging to capture:
   - Actual calendar_rules data from production
   - Calculated post_period_dates
   - Number of staff constraints applied per date

2. **Query the database** to verify calendar_rules entries:
   ```sql
   SELECT date, rule_type
   FROM calendar_rules
   WHERE date BETWEEN '2026-03-01' AND '2026-03-10'
   ORDER BY date;
   ```

3. **Check the OR-Tools logs** in production:
   - Look for `[DIAGNOSTIC] POST-PERIOD DATES TO PROTECT`
   - Verify if March 6 or March 7 is in the protected dates list

4. **If March 6 is the protected date** (as expected):
   - Implement Option 1: Add `postPeriodDays` config to protect multiple days
   - This allows flexible protection: 1 day, 2 days, or more

5. **If March 7 is the protected date**:
   - Database has March 6 as must_day_off (verify with SQL query)
   - Screenshot might not match the actual calendar_rules in production
   - User might have modified calendar rules after generating the schedule

## Test Coverage

Created diagnostic scripts:
- `diagnose_post_period.py` - Simulates constraint logic with various scenarios
- `test_post_period_production.py` - Tests with real production data format

Both tests confirm: **The constraint logic is CORRECT for March 6.**

## Recommended Fix

**Implement Option 1** with these settings UI additions:

```javascript
// In EarlyShiftPreferencesTab.jsx
<FormControl fullWidth>
  <InputLabel>Post-Period Protection Days</InputLabel>
  <Select
    value={postPeriodConstraint.postPeriodDays || 1}
    onChange={(e) => handlePostPeriodChange('postPeriodDays', e.target.value)}
  >
    <MenuItem value={1}>1 day after (current behavior)</MenuItem>
    <MenuItem value={2}>2 days after (recommended)</MenuItem>
    <MenuItem value={3}>3 days after (maximum protection)</MenuItem>
  </Select>
  <FormHelperText>
    Number of days after a closure period to prevent day-offs
  </FormHelperText>
</FormControl>
```

This gives users control over the protection duration while maintaining backward compatibility (default: 1 day).

## Files Modified

1. `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager-ortools/python-ortools-service/scheduler.py`
   - Lines 2361-2391: Fixed must_day_off extraction + added string format fallback
   - Lines 2368-2373: Added calendar rules diagnostic logging
   - Lines 2454-2456: Added post-period dates confirmation logging
   - Lines 2469-2471, 2531: Added per-date staff constraint tracking

2. **Created diagnostic tools**:
   - `diagnose_post_period.py` - General diagnostic script
   - `test_post_period_production.py` - Production data format test

3. **Documentation**:
   - This file: `POST_PERIOD_BUG_ANALYSIS.md`
