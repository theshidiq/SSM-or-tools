# Adjacent Conflict Fix Summary

## Problem Report (User Issue)

**Date**: 2025-11-29
**Reported By**: User
**Severity**: Medium - Schedule quality issue

料理長 (Head Chef) had consecutive △ (early shifts) on:
- **Dates 22-23-24-25**: Four consecutive early shifts (△△△△)
- **Dates 13-14**: Two consecutive early shifts (△△)

This violates the adjacent conflict prevention rule that should prevent same shift types on consecutive days.

**User Hypothesis**: "probably we put the adjacent layer below other rules causing that happened"

## Root Cause Analysis

### What Went Wrong

The `applyPriorityRules()` function in `BusinessRuleValidator.js` assigns preferred shifts and exception shifts **WITHOUT checking for adjacent conflicts**.

### Where It Happened

**File**: `src/ai/hybrid/BusinessRuleValidator.js`
**Function**: `applyPriorityRules()` (lines 1212-1399)

**Two critical locations without adjacent checks**:

1. **Line 1352** (Exception shifts):
   ```javascript
   schedule[staff.id][dateKey] = exceptionShiftValue;
   // ↑ NO adjacent conflict check!
   ```

2. **Line 1396** (Preferred shifts) ← **PRIMARY ISSUE**:
   ```javascript
   schedule[staff.id][dateKey] = shiftValue;
   // ↑ NO adjacent conflict check!
   ```

### Why It Matters

Priority rules are **re-applied 5 times** during schedule generation:
- Line 1131: After calendar rules
- Line 1136: After preferred shifts
- Line 1143: After early shift enforcement
- Line 1150: After 5-day rest constraint
- Line 1155: After off-day distribution
- Line 1160: After staff group constraints

Each re-application could create consecutive shift patterns because there was **NO adjacent conflict check**.

### Evidence

The `hasAdjacentConflict()` function **exists** (line 49) and is used in other places:
- Line 2082: During 5-day rest enforcement ✅
- Line 2298: During rest constraint enforcement ✅

But it was **MISSING** from priority rules ❌

## The Fix

### What Was Changed

**Commit**: 4a40903
**File**: `src/ai/hybrid/BusinessRuleValidator.js`
**Lines Modified**: 1345-1357, 1389-1401

### Code Changes

#### 1. Exception Shift Assignment (Line 1346)

**BEFORE**:
```javascript
schedule[staff.id][dateKey] = exceptionShiftValue;
staffRulesApplied++;
console.log(...);
```

**AFTER**:
```javascript
// ✅ CHECK: Adjacent conflict prevention for exception shifts
const adjacentConflict = hasAdjacentConflict(staff, dateKey, exceptionShiftValue, schedule);
if (adjacentConflict) {
  console.log(
    `⏭️ [PRIORITY]   → ${staff.name}: Cannot replace with EXCEPTION "${exceptionShiftValue}" on ${date.toLocaleDateString('ja-JP')}, blocked by adjacent conflict`
  );
} else {
  schedule[staff.id][dateKey] = exceptionShiftValue;
  staffRulesApplied++;
  console.log(
    `🚫✅ [PRIORITY]   → ${staff.name}: REPLACED "${avoidedShiftValue}" with EXCEPTION "${exceptionShiftValue}" on ${date.toLocaleDateString('ja-JP')} (${dayOfWeek})`,
  );
}
```

#### 2. Preferred Shift Assignment (Line 1390) ← **PRIMARY FIX**

**BEFORE**:
```javascript
schedule[staff.id][dateKey] = shiftValue;
staffRulesApplied++;
console.log(...);
```

**AFTER**:
```javascript
// ✅ CHECK: Adjacent conflict prevention for preferred shifts
const adjacentConflict = hasAdjacentConflict(staff, dateKey, shiftValue, schedule);
if (adjacentConflict) {
  console.log(
    `⏭️ [PRIORITY]   → ${staff.name}: Cannot assign preferred "${shiftValue}" on ${date.toLocaleDateString('ja-JP')}, blocked by adjacent conflict`
  );
} else {
  schedule[staff.id][dateKey] = shiftValue;
  staffRulesApplied++;
  console.log(
    `✅ [PRIORITY]   → ${staff.name}: SET "${shiftValue}" on ${date.toLocaleDateString('ja-JP')} (${dayOfWeek}) - preferred shift applied`,
  );
}
```

### How It Works

1. **Before assigning a shift**, check if it would create an adjacent conflict
2. **If conflict detected**, skip the assignment and log warning
3. **If no conflict**, proceed with the assignment as before

The `hasAdjacentConflict()` function checks:
- Previous day's shift
- Day before previous day's shift
- Prevents consecutive patterns like △△, ××, ◇◇

## Expected Results

After this fix:

✅ **料理長** should NOT have 4 consecutive △ (dates 22-23-24-25)
✅ **All staff** should respect adjacent conflict prevention
✅ **Priority rules** will skip assignments that would create consecutive patterns
✅ **Console logs** will show when priority rules are blocked by adjacent conflicts

## Testing Checklist

### Manual Testing
- [ ] Generate schedule for current month
- [ ] Check 料理長's schedule for consecutive △ patterns
- [ ] Check all staff for consecutive × or ◇ patterns
- [ ] Verify priority rules are still being applied
- [ ] Check console logs for "blocked by adjacent conflict" messages

### Expected Console Output
```
⏭️ [PRIORITY]   → 料理長: Cannot assign preferred "△" on 2025-01-23, blocked by adjacent conflict
⏭️ [PRIORITY]   → 料理長: Cannot assign preferred "△" on 2025-01-24, blocked by adjacent conflict
```

### Success Criteria
- NO consecutive △△ patterns in ANY staff schedule
- NO consecutive ×× patterns in ANY staff schedule
- NO consecutive ◇◇ patterns in ANY staff schedule
- Priority rules still applied where no adjacent conflict exists

## Related Files

### Modified
- ✅ `src/ai/hybrid/BusinessRuleValidator.js` (Lines 1345-1357, 1389-1401)

### Reference
- `src/ai/constraints/ConstraintEngine.js` (hasAdjacentConflict function)
- `src/ai/core/ConstraintPriorityManager.js` (ADJACENT_CONFLICT_PREVENTION constraint)

## Related Issues

### Previous Fixes (This Session)
1. ✅ Staff group violations (Fix 1)
2. ✅ Daily limit violations (Fix 2)
3. ✅ Consecutive work limit 6→5 days (Fix 3)
4. ✅ 5-day rest rule promoted to Tier 1 (Fix 4)
5. ❌ ViolationRepairEngine (Fix 5 - REVERTED, caused ○ symbol issue)
6. ✅ ○ symbol assigned to regular staff (CRITICAL FIX - commit 3d87651)
7. ✅ Adjacent conflicts in priority rules (THIS FIX - commit 4a40903)

### Constraint Enforcement Order
1. Calendar rules (must_work, must_day_off) - Tier 1
2. Priority rules (preferred/avoided shifts) - Tier 2 ← **NOW WITH ADJACENT CHECK**
3. Early shift enforcement - Tier 1
4. 5-day rest constraint - Tier 1
5. Off-day distribution - Tier 2
6. Staff group constraints - Tier 1

## Technical Notes

### Why This Was Hard to Catch

1. Priority rules are applied **5 times** during generation
2. Each application can override previous shifts
3. Adjacent conflict checking was **inconsistent** across the codebase
4. Tier 2 constraints (like adjacent) were considered "soft" and sometimes skipped

### Why User Hypothesis Was Correct

User said: "probably we put the adjacent layer below other rules causing that happened"

**This was exactly right**:
- Priority rules (Tier 2) were applied AFTER adjacent conflict checking
- Each re-application could create consecutive patterns
- The "adjacent layer" was indeed below priority rules in execution order

### Lessons Learned

1. **ALL shift assignments** should check adjacent conflicts, not just some
2. **Re-application of rules** can create violations if not careful
3. **Tier 2 constraints** still need enforcement, not just optimization
4. **User observations** are valuable for identifying execution order issues

## Success Metrics

**Before Fix**:
- 料理長 had 4 consecutive △ on dates 22-23-24-25
- 2 consecutive △ on dates 13-14

**After Fix**:
- Should see console logs: "Cannot assign preferred △, blocked by adjacent conflict"
- 料理長 should have varied shift patterns (△, blank, ×, etc.)
- NO consecutive same-shift patterns for ANY staff

## Deployment Notes

- **No database migration required**
- **No UI changes needed**
- **Console output enhanced** with new skip messages
- **Backward compatible** - only adds checks, doesn't change data structure
- **Safe to deploy** - worst case is priority rules get skipped (better than violations)

---

**Status**: ✅ FIXED
**Commit**: 4a40903
**Tested**: Awaiting user verification
**Next**: User to generate new schedule and verify no consecutive patterns
