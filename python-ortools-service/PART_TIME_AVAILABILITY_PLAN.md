# Comprehensive Plan: パート (Part-time) Availability Improvement

## Executive Summary

**Current Behavior:**
- パート (中田) is **unavailable by default** (⊘)
- Only works (○) when a group member has a day off (×)

**New Behavior:**
- パート (中田) is **available for work by default** (○)
- Becomes **unavailable** (⊘) ONLY when:
  1. A group member has a day off (×) - **already implemented via backup coverage**
  2. The date is a **Japanese national holiday**

---

## API Reference

### Japanese Holidays API
- **URL**: `https://holidays-jp.github.io/api/v1/date.json`
- **Format**: JSON `{ "YYYY-MM-DD": "Holiday Name" }`
- **Coverage**: 2025-2027 (past, current, next year)
- **License**: MIT
- **Alternative**: Year-specific: `https://holidays-jp.github.io/api/v1/[YYYY]/date.json`

### Sample Response
```json
{
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  ...
}
```

---

## Current Logic Analysis

### Location: `scheduler.py` lines 802-831

```python
# CONSTRAINT B: If NO group member has OFF → Backup SHOULD be OFF (shown as ⊘)
# This is ALWAYS a SOFT constraint
backup_off_var = self.shifts[(backup_staff_id, date, self.SHIFT_OFF)]

# unavailable_violation = 1 when: any_member_off=0 AND backup_off=0
unavailable_violation = self.model.NewBoolVar(...)
```

**Problem:** The current logic says "if no one is off, backup should be off (unavailable)"
**New Logic:** "backup should WORK by default, and only be unavailable on holidays"

---

## Implementation Plan

### Phase 1: Fetch Japanese Holidays (Python Service)

**File:** `python-ortools-service/scheduler.py`

**Add new method to fetch holidays:**
```python
def _fetch_japanese_holidays(self) -> set:
    """
    Fetch Japanese national holidays from holidays-jp.github.io API.
    Returns a set of date strings (YYYY-MM-DD) that are holidays.

    Caches result to avoid repeated API calls during same session.
    """
    if hasattr(self, '_japanese_holidays_cache'):
        return self._japanese_holidays_cache

    import requests
    try:
        response = requests.get(
            'https://holidays-jp.github.io/api/v1/date.json',
            timeout=5
        )
        if response.status_code == 200:
            holidays_data = response.json()
            # Convert to set of date strings
            self._japanese_holidays_cache = set(holidays_data.keys())
            logger.info(f"[OR-TOOLS] Fetched {len(self._japanese_holidays_cache)} Japanese holidays")
            return self._japanese_holidays_cache
    except Exception as e:
        logger.warning(f"[OR-TOOLS] Failed to fetch Japanese holidays: {e}")

    # Return empty set on failure (fail gracefully)
    self._japanese_holidays_cache = set()
    return self._japanese_holidays_cache
```

### Phase 2: Modify Backup Staff Constraint Logic

**File:** `python-ortools-service/scheduler.py`
**Method:** `_add_backup_staff_constraints()` (lines 564-839)

**Current Logic (lines 802-831):**
```python
# CONSTRAINT B: If NO group member has OFF → Backup SHOULD be OFF (shown as ⊘)
```

**New Logic:**
```python
# CONSTRAINT B: Backup is UNAVAILABLE only on Japanese holidays
# When NO group member is off AND date is NOT a holiday → Backup WORKS (○)
# When date IS a holiday → Backup is UNAVAILABLE (⊘)

# Fetch Japanese holidays
japanese_holidays = self._fetch_japanese_holidays()
is_holiday = date in japanese_holidays

if is_holiday:
    # CONSTRAINT B1: On holidays → Backup MUST be OFF (unavailable)
    self.model.Add(backup_off_var == 1).OnlyEnforceIf(any_member_off.Not())
    # Mark as unavailable for symbol extraction
    self.backup_unavailable_slots[(backup_staff_id, date)] = 'holiday'
else:
    # CONSTRAINT B2: On non-holidays when no coverage needed → Backup WORKS (default)
    # Remove the old soft constraint that pushed backup to be OFF
    # Backup will naturally get WORK assignment as default
    pass

# Track unavailable slots for solution extraction
if is_holiday:
    self.backup_unavailable_slots[(backup_staff_id, date)] = 'holiday'
elif any_member_off is True:  # Coverage needed
    self.backup_unavailable_slots[(backup_staff_id, date)] = 'coverage'
```

### Phase 3: Update Solution Extraction

**File:** `python-ortools-service/scheduler.py`
**Method:** `_extract_solution()` (around line 2350+)

Ensure that:
- Holiday dates show ⊘ for backup staff
- Coverage dates show ○ (work) for backup staff
- Non-holiday, non-coverage dates show ○ (work) for backup staff

---

## Detailed Changes

### Change 1: Add Holiday Fetching (New Method)

**Location:** After line ~560 (before `_add_backup_staff_constraints`)

```python
def _fetch_japanese_holidays(self) -> set:
    """
    Fetch Japanese national holidays from holidays-jp.github.io API.
    Returns a set of date strings (YYYY-MM-DD) that are holidays.
    """
    if hasattr(self, '_japanese_holidays_cache'):
        return self._japanese_holidays_cache

    import requests
    try:
        response = requests.get(
            'https://holidays-jp.github.io/api/v1/date.json',
            timeout=5
        )
        if response.status_code == 200:
            holidays_data = response.json()
            self._japanese_holidays_cache = set(holidays_data.keys())
            logger.info(f"[OR-TOOLS] 🎌 Fetched {len(self._japanese_holidays_cache)} Japanese holidays from API")

            # Log holidays in date range for debugging
            holidays_in_range = [d for d in self.date_range if d in self._japanese_holidays_cache]
            if holidays_in_range:
                logger.info(f"[OR-TOOLS] 🎌 Holidays in schedule period: {holidays_in_range}")
                for h in holidays_in_range:
                    logger.info(f"    {h}: {holidays_data.get(h, 'Unknown')}")

            return self._japanese_holidays_cache
    except Exception as e:
        logger.warning(f"[OR-TOOLS] ⚠️ Failed to fetch Japanese holidays: {e}")

    self._japanese_holidays_cache = set()
    return self._japanese_holidays_cache
```

### Change 2: Modify Backup Constraint Logic

**Location:** Lines 802-831 in `_add_backup_staff_constraints()`

**BEFORE:**
```python
# CONSTRAINT B: If NO group member has OFF → Backup SHOULD be OFF (shown as ⊘)
# ...soft constraint pushing backup to be OFF when no coverage needed
```

**AFTER:**
```python
# ─────────────────────────────────────────────────────────────────────
# CONSTRAINT B: Backup availability based on Japanese holidays
# ─────────────────────────────────────────────────────────────────────
# NEW LOGIC:
# - Default: Backup WORKS (○) when no coverage needed
# - Holiday: Backup is UNAVAILABLE (⊘) on Japanese national holidays
# - Coverage: Backup WORKS (○) when group member has day off (handled above)

# Fetch Japanese holidays (cached)
japanese_holidays = self._fetch_japanese_holidays()
is_holiday = date in japanese_holidays

if is_holiday:
    # On Japanese holidays: Backup MUST be OFF (unavailable)
    # This is a HARD constraint - パート cannot work on holidays
    self.model.Add(backup_off_var == 1).OnlyEnforceIf(any_member_off.Not())

    # Track as holiday unavailable (for ⊘ symbol display)
    self.backup_unavailable_slots[(backup_staff_id, date)] = any_member_off
    constraint_count += 1

    logger.debug(f"    {date} is a holiday - backup will be unavailable (⊘)")
else:
    # On non-holidays: Backup WORKS by default (no constraint needed)
    # Only track unavailable status if coverage is needed (any_member_off=True)
    self.backup_unavailable_slots[(backup_staff_id, date)] = any_member_off

    # Remove the old soft constraint that pushed backup to OFF
    # (Previously had unavailable_violation penalty - now removed)
```

### Change 3: Add `requests` to requirements.txt

**File:** `python-ortools-service/requirements.txt`

Add:
```
requests>=2.28.0
```

---

## Testing Plan

### Test Case 1: Non-Holiday, No Coverage
- **Date:** 2026-02-23 (Monday, not a holiday, no group member off)
- **Expected:** パート works (○)

### Test Case 2: Non-Holiday, Coverage Needed
- **Date:** 2026-02-24 (Tuesday, 料理長 has day off due to priority rule)
- **Expected:** パート works (○) to cover

### Test Case 3: Japanese Holiday
- **Date:** 2026-02-11 (建国記念の日)
- **Expected:** パート is unavailable (⊘)

### Test Case 4: Holiday + Coverage Conflict
- **Date:** If a holiday coincides with a group member day off
- **Expected:** パート is unavailable (⊘) - holiday takes precedence

---

## Summary of Changes

| Aspect | Current | After Change |
|--------|---------|--------------|
| Default availability | Unavailable (⊘) | Work (○) |
| When group member off | Work (○) | Work (○) |
| On Japanese holidays | Work (○) | Unavailable (⊘) |
| API dependency | None | holidays-jp.github.io |

---

## Fallback Behavior

If the API fails to respond:
- Log a warning
- Continue with empty holiday set
- パート will work on all days (no holiday restriction)
- System remains functional

---

## Files to Modify

1. **`python-ortools-service/scheduler.py`**
   - Add `_fetch_japanese_holidays()` method
   - Modify `_add_backup_staff_constraints()` logic (lines 802-831)

2. **`python-ortools-service/requirements.txt`**
   - Add `requests>=2.28.0`

---

## Implementation Order

1. Add `requests` to requirements.txt
2. Add `_fetch_japanese_holidays()` method
3. Modify backup constraint logic to:
   - Remove old "unavailable by default" soft constraint
   - Add holiday-based unavailability constraint
4. Test with sample schedule period containing holidays
5. Verify パート works by default and is unavailable only on holidays

---

## Approval Required

Please review this plan and confirm:
1. Is the new logic correct? (Work by default, unavailable on holidays + when group member is off)
2. Should holidays be a HARD or SOFT constraint?
3. Any additional requirements?
