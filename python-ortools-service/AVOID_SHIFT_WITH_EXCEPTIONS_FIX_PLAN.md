# Plan: Fix "Avoid Shift with Exceptions" Feature

## Executive Summary

The `avoid_shift_with_exceptions` priority rule type is **not implemented** in the OR-Tools scheduler. The React UI correctly sends `allowedShifts` data, but the Python scheduler ignores it and treats the rule as a simple `avoid_shift`.

---

## Current Issue Analysis

### User's Scenario
- **Staff Member**: 料理長 (Head Chef)
- **Rule Configured**: "Avoid Shift with Exceptions"
  - **Shift Type to Avoid**: Early Shift (△)
  - **Allowed Exception**: Off Day (×)
- **Expected Behavior**: On the selected days, 料理長 should NOT have Early Shift (△), BUT they CAN have Off Day (×)
- **Actual Behavior**: The scheduler does the **opposite** - it treats it as a simple "avoid" without understanding the exceptions

### Root Cause

In `scheduler.py` lines 2185-2199, the priority rule handler only checks for two rule types:
```python
if rule_type in ['avoided_shift', 'blocked']:
    # Penalize this shift
else:
    # Prefer this shift (default behavior)
```

**Missing**: There's no handling for `'avoid_shift_with_exceptions'` rule type!

The `allowedShifts` field IS being sent from React (line 434 in `useAISettings.js`), but OR-Tools never reads or uses it.

---

## Data Flow Analysis

### React UI → OR-Tools (What's Sent)
```javascript
// useAISettings.js creates this structure:
{
  id: "rule-1",
  name: "Avoid Early (Allow Off)",
  ruleType: "avoid_shift_with_exceptions",  // ✅ Correctly identified
  staffId: "料理長-id",
  shiftType: "early",           // The shift to AVOID
  allowedShifts: ["off"],       // ✅ Exceptions - these shifts ARE allowed
  daysOfWeek: [2, 6, 0],        // Tuesday, Saturday, Sunday
  preferences: {
    shiftType: "early",
    daysOfWeek: [2, 6, 0],
    priorityLevel: 3
  },
  constraints: {
    isHardConstraint: false
  }
}
```

### OR-Tools (What's Read)
```python
# scheduler.py currently reads:
rule_type = rule.get('ruleType', '')        # ✅ Gets 'avoid_shift_with_exceptions'
shift_type_name = rule.get('shiftType', '') # ✅ Gets 'early'
allowed_shifts = ???                         # ❌ NEVER READS THIS!
```

---

## Correct Semantic Interpretation

### Rule: "Avoid Early Shift (△), Allow Off Day (×)"

**Meaning**:
- On selected days (Tue, Sat, Sun), this staff member should NOT have Early Shift (△)
- BUT they CAN have Off Day (×) even though △ is being avoided
- They can also have: Normal Work (○) or Late Shift (◇)

**What the scheduler should do**:
1. **Penalize** Early Shift (△) on these days → Add to `avoided_vars`
2. **DO NOT penalize** Off Day (×), Normal Work (○), Late Shift (◇)

### Rule: "Avoid Off Day (×), Allow Early Shift (△)"

**Meaning**:
- On selected days, this staff member should NOT have Off Day (×)
- BUT they CAN have Early Shift (△) as an exception
- They can also have: Normal Work (○) or Late Shift (◇)

**What the scheduler should do**:
1. **Penalize** Off Day (×) on these days → Add to `avoided_vars`
2. **DO NOT penalize** Early Shift (△), Normal Work (○), Late Shift (◇)

---

## The "Opposite" Behavior Explained

The user observed the scheduler generating the **opposite** of expected. Here's why:

### Without Exception Handling (Current Bug)
When `ruleType = 'avoid_shift_with_exceptions'`:
- Current code checks: `if rule_type in ['avoided_shift', 'blocked']:`
- `'avoid_shift_with_exceptions'` is NOT in this list!
- So it falls through to the `else` block (default = preferred_shift)
- Result: It **PREFERS** the shift instead of **AVOIDING** it!

```python
if rule_type in ['avoided_shift', 'blocked']:
    # ❌ This branch is NOT taken
    self.avoided_vars.append(...)  # Penalize
else:
    # ✅ This branch IS taken by mistake!
    self.preferred_vars.append(...)  # PREFER (opposite!)
```

---

## Fix Implementation Plan

### File: `python-ortools-service/scheduler.py`

#### Change 1: Add `avoid_shift_with_exceptions` to the avoided rule types check

```python
# BEFORE (line 2185):
if rule_type in ['avoided_shift', 'blocked']:

# AFTER:
if rule_type in ['avoided_shift', 'blocked', 'avoid_shift_with_exceptions']:
```

#### Change 2: Extract and use `allowedShifts` for exception handling

Add after line 2145 (after `priority_level` extraction):
```python
# Extract allowed exceptions for avoid_shift_with_exceptions
allowed_shifts = rule.get('allowedShifts', [])
if not allowed_shifts:
    # Also check nested preferences
    prefs = rule.get('preferences', {})
    allowed_shifts = prefs.get('allowedShifts', [])

# Convert to shift type constants
allowed_shift_types = set()
for shift_name in allowed_shifts:
    allowed_shift_types.add(self._parse_shift_type(shift_name.lower()))
```

#### Change 3: Modify the avoid logic to handle exceptions

Replace the current avoid block (lines 2185-2191) with:
```python
if rule_type in ['avoided_shift', 'blocked', 'avoid_shift_with_exceptions']:
    # Get allowed exceptions for this rule
    allowed_shifts = rule.get('allowedShifts', [])
    allowed_shift_types = set()
    for shift_name in (allowed_shifts or []):
        allowed_shift_types.add(self._parse_shift_type(shift_name.lower()))

    # Only apply avoidance to the specified shift type
    # The exception shifts (allowedShifts) are NOT penalized
    if shift_type not in allowed_shift_types:
        if is_hard:
            # Hard constraint: MUST NOT have this shift on these days
            self.model.Add(shift_var == 0)
        else:
            # Soft constraint: avoid this shift
            self.avoided_vars.append((shift_var, priority_level))
    else:
        # This shift is in allowedShifts - don't penalize
        logger.debug(f"    Shift {shift_type_name} is in allowed exceptions - not penalized")
```

Wait - I need to re-analyze. The logic above is incorrect.

---

## Corrected Understanding

### "Avoid Shift with Exceptions" Semantics

The rule says:
- **Avoid**: `shiftType` (e.g., "early" → △)
- **Allow**: `allowedShifts` (e.g., ["off"] → ×)

The `shiftType` is what we're avoiding. The `allowedShifts` are **alternative shifts** that are explicitly allowed despite the avoidance context.

**But wait** - this doesn't make sense logically. If we're avoiding Early (△), why would we need to "allow" Off (×)? Off was never being avoided in the first place!

### Re-reading the UI Screenshot

Looking at the user's screenshot:
- **Rule Type**: "Avoid Shift (with Exceptions)"
- **Shift Type** (to avoid): Early Shift (△)
- **Allowed Exceptions**: Off Day (×) is selected

**Interpretation A**: "Avoid Early Shift, but if the staff MUST be off (×), that's allowed"
- This means: Don't give them Early Shift, prefer other shifts, but Off is acceptable

**Interpretation B**: "Avoid Early Shift, and also ensure they can have Off Days"
- This is redundant since Off Days aren't being avoided

### Correct Interpretation Based on UI Design

Looking at `priorityRuleConstants.js`:
```javascript
{
  id: "avoid_shift_with_exceptions",
  label: "Avoid Shift (with Exceptions)",
  description: "Avoid specific shift but allow certain exceptions",
  helpText: "Example: Avoid off days (×) but allow early shifts (△) on weekends"
}
```

The help text says: "Avoid off days (×) but allow early shifts (△)"

**This means**:
- When avoiding Off Days (×), normally the scheduler would try to give work shifts
- But "allow early shifts" means: If they need a day off, Early Shift (△) is an acceptable alternative

**Wait, that still doesn't make sense...**

### Final Correct Interpretation

After deeper analysis, the feature seems designed for this use case:

**Example**: "Avoid Off Days (×) but allow Early (△) as exception"

**Meaning**:
1. On selected days, prefer to have staff WORKING (avoid ×)
2. BUT if they must have a "not-normal-work" shift, Early (△) is acceptable
3. This combines: "Don't give Off" + "If something special, prefer Early"

**In constraint terms**:
- AVOID: Off Day (×) → Penalize if × is assigned
- PREFER (exception): Early Shift (△) → If avoiding × forces a choice, Early is OK

### OR-Tools Implementation

For `avoid_shift_with_exceptions`:
1. **Penalize** the `shiftType` being avoided (add to `avoided_vars`)
2. **Prefer** the `allowedShifts` as alternatives (add to `preferred_vars` with lower weight)

This creates a soft preference chain:
- Normal Work (○) = baseline (no penalty, no preference)
- Early (△) = slightly preferred (if it's in allowedShifts)
- Late (◇) = baseline (no penalty, no preference)
- Off (×) = avoided (penalty if assigned)

---

## Updated Implementation Plan

### File: `python-ortools-service/scheduler.py`

#### Location: Lines 2185-2199 in `_add_priority_rules()`

```python
# Current code (lines 2185-2199):
if rule_type in ['avoided_shift', 'blocked']:
    if is_hard:
        self.model.Add(shift_var == 0)
    else:
        self.avoided_vars.append((shift_var, priority_level))
else:
    # Default to preferred_shift behavior
    if is_hard:
        self.model.Add(shift_var == 1)
    else:
        self.preferred_vars.append((shift_var, priority_level))

# NEW code:
if rule_type == 'avoid_shift_with_exceptions':
    # SPECIAL HANDLING: Avoid the shiftType, but prefer the allowedShifts as alternatives

    # 1. Avoid the main shift type
    if is_hard:
        self.model.Add(shift_var == 0)
    else:
        self.avoided_vars.append((shift_var, priority_level))

    # 2. Prefer the allowed exception shifts (with lower weight)
    allowed_shifts = rule.get('allowedShifts', [])
    for allowed_shift_name in allowed_shifts:
        allowed_shift_type = self._parse_shift_type(allowed_shift_name.lower())
        if allowed_shift_type != shift_type:  # Don't add the avoided shift as preferred
            allowed_shift_var = self.shifts[(target_staff_id, date, allowed_shift_type)]
            # Use half the weight for exception preferences
            exception_weight = max(1, priority_level // 2)
            self.preferred_vars.append((allowed_shift_var, exception_weight))

elif rule_type in ['avoided_shift', 'blocked']:
    if is_hard:
        self.model.Add(shift_var == 0)
    else:
        self.avoided_vars.append((shift_var, priority_level))
else:
    # Default to preferred_shift behavior
    if is_hard:
        self.model.Add(shift_var == 1)
    else:
        self.preferred_vars.append((shift_var, priority_level))
```

---

## Testing Plan

### Test Case 1: Avoid Early (△), Allow Off (×)
- **Staff**: 料理長
- **Days**: Tuesday, Saturday, Sunday
- **Expected**: 料理長 should NOT have △ on Tue/Sat/Sun, but × is acceptable

### Test Case 2: Avoid Off (×), Allow Early (△)
- **Staff**: 料理長
- **Days**: Tuesday, Saturday, Sunday
- **Expected**: 料理長 should NOT have × on Tue/Sat/Sun, Early (△) is acceptable alternative

### Test Case 3: Hard Constraint
- Same as Test 1, but `isHardConstraint: true`
- **Expected**: MUST NOT have △ on those days (hard constraint)

---

## Files to Modify

1. **`python-ortools-service/scheduler.py`** (lines 2185-2199)
   - Add handling for `'avoid_shift_with_exceptions'` rule type
   - Extract and use `allowedShifts` to create exception preferences

2. **`python-ortools-service/test_priority_rule_exceptions.py`** (NEW)
   - Add unit tests for the new logic

---

## Summary

| Aspect | Current State | After Fix |
|--------|---------------|-----------|
| Rule type check | Missing `avoid_shift_with_exceptions` | Includes it |
| `allowedShifts` usage | Ignored | Used for exception preferences |
| Behavior | Treats as `preferred_shift` (opposite!) | Correctly avoids + prefers exceptions |
