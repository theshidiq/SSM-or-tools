# OR-Tools Alignment Implementation Plan

## Executive Summary

Based on comprehensive analysis of the AI_GENERATION_FLOW_DOCUMENTATION.md, JS BusinessRuleValidator.js, Python scheduler.py, and the React→Go→Python data flow, this plan addresses the gaps to achieve exact feature parity.

---

## CRITICAL ISSUES IDENTIFIED

### Issue 1: Priority Rules `staffId: None` (BLOCKING)
**Location:** Python scheduler.py lines 544-553
**Cause:** React sends rules with `staffId` but fallback extraction fails
**Impact:** ALL 6 priority rules being skipped

### Issue 2: Adjacent Conflict - Correct Logic Already
**Finding:** Python implementation correctly prevents `××`, `×△`, `△×` patterns
**Note:** `△△` (consecutive early) is NOT prevented in JS either - this is correct behavior

### Issue 3: Staff Group - Correct Implementation Already
**Finding:** Python correctly enforces "only 1 member off/early per group per day"

### Issue 4: Calendar/Early Shift Preferences - Data Not Reaching Python
**Cause:** Either empty database tables OR format mismatch
**Impact:** 0 dates shown in logs

---

## IMPLEMENTATION PHASES

### PHASE 1: Fix Data Flow Issues (Critical)

#### 1.1 Fix Priority Rules staffId Extraction

**File:** `python-ortools-service/scheduler.py`

```python
# BEFORE (line 544-553):
staff_id = rule.get('staffId')
if staff_id not in valid_staff_ids:
    logger.warning(f"Skipping rule - staff ID not found: {staff_id}")
    continue

# AFTER:
# Try multiple extraction paths (matching React's fallback chain)
staff_id = (
    rule.get('staffId') or
    rule.get('staff_id') or
    rule.get('ruleDefinition', {}).get('staff_id') or
    rule.get('ruleDefinition', {}).get('staffId')
)

# Also support multi-staff rules via staffIds array
staff_ids = (
    rule.get('staffIds') or
    rule.get('staff_ids') or
    rule.get('ruleDefinition', {}).get('staff_ids') or
    []
)

if staff_id:
    staff_ids = [staff_id] + [s for s in staff_ids if s != staff_id]
elif not staff_ids:
    logger.warning(f"Skipping rule - no staff ID found in any location")
    continue

# Process for each staff in the list
for sid in staff_ids:
    if sid not in valid_staff_ids:
        logger.warning(f"  Staff {sid} not in current schedule, skipping")
        continue
    # Apply rule to this staff...
```

#### 1.2 Add Data Validation Logging

**File:** `python-ortools-service/scheduler.py`

Add at the start of `optimize()`:
```python
def optimize(self):
    # Enhanced logging for debugging data flow issues
    logger.info("=" * 60)
    logger.info("[OR-TOOLS] CONSTRAINT DATA RECEIVED:")
    logger.info(f"  calendarRules: {len(self.constraints_config.get('calendarRules', {}))} dates")
    logger.info(f"  earlyShiftPreferences: {len(self.constraints_config.get('earlyShiftPreferences', {}))} staff")
    logger.info(f"  staffGroups: {len(self.constraints_config.get('staffGroups', []))} groups")
    logger.info(f"  priorityRules: {len(self.constraints_config.get('priorityRules', []))} rules")

    # Log sample data for debugging
    priority_rules = self.constraints_config.get('priorityRules', [])
    if priority_rules:
        sample = priority_rules[0]
        logger.info(f"  Sample priority rule keys: {list(sample.keys())}")
        logger.info(f"  Sample staffId: {sample.get('staffId')}")
        logger.info(f"  Sample staff_id: {sample.get('staff_id')}")
        logger.info(f"  Sample ruleDefinition: {sample.get('ruleDefinition')}")
    logger.info("=" * 60)
```

### PHASE 2: Align Constraint Logic with Documentation

#### 2.1 Constraint Priority/Tier System

The documentation defines this precedence (implement in Python):

```
TIER 0 (ABSOLUTE - Applied first AND last):
├── must_day_off (calendar rules)
├── must_work (calendar rules)
└── Early shift preferences on must_day_off dates

TIER 1 (HARD CONSTRAINTS):
├── Staff groups (only 1 off/early per group per day)
├── Adjacent conflicts (no ××, ×△, △×)
├── Daily limits (min/max off per day)
├── Monthly limits (min/max off per month, excludes calendar)
├── 5-day rest (max 5 consecutive work days)
└── Backup staff (never assign × to backup-only)

TIER 2 (SOFT CONSTRAINTS):
└── Priority rules (preferred/avoided shifts)
```

#### 2.2 Adjacent Conflict Patterns (VERIFIED CORRECT)

Current Python implementation correctly handles:
- `××` - Forbidden (consecutive off days)
- `×△` - Forbidden (off followed by early)
- `△×` - Forbidden (early followed by off)
- `△△` - **ALLOWED** (consecutive early shifts - matches JS)

**No changes needed** - implementation matches documentation.

#### 2.3 Staff Group Constraint (VERIFIED CORRECT)

Current Python implementation:
```python
# For each group, for each date:
# At most 1 member can have off OR early shift
self.model.Add(sum(off_or_early_vars) <= 1)
```

**No changes needed** - implementation matches documentation.

#### 2.4 Monthly Limits with Calendar Exclusion

**File:** `python-ortools-service/scheduler.py`

Ensure calendar off-days are EXCLUDED from monthly limit counting:
```python
def add_monthly_limit_constraints(self):
    monthly_limit = self.constraints_config.get('monthlyLimit', {})
    min_count = monthly_limit.get('minCount', 7)
    max_count = monthly_limit.get('maxCount', 8)
    exclude_calendar = monthly_limit.get('excludeCalendarRules', True)

    calendar_rules = self.constraints_config.get('calendarRules', {})

    for staff in self.staff_members:
        staff_id = staff['id']

        # Count off days on FLEXIBLE dates only (not calendar rule dates)
        flexible_off_vars = []
        for date in self.date_range:
            is_calendar_date = date in calendar_rules and calendar_rules[date].get('must_day_off')

            if exclude_calendar and is_calendar_date:
                continue  # Don't count calendar off-days toward limit

            flexible_off_vars.append(self.shifts[(staff_id, date, self.SHIFT_OFF)])

        # Apply MIN/MAX to flexible days only
        if flexible_off_vars:
            self.model.Add(sum(flexible_off_vars) >= min_count)
            self.model.Add(sum(flexible_off_vars) <= max_count)
```

### PHASE 3: Implement Missing Constraint Features

#### 3.1 Early Shift Preferences on must_day_off Dates

This is the TIER 0 override where early shift preference converts × to △:

```python
def add_calendar_constraints(self):
    calendar_rules = self.constraints_config.get('calendarRules', {})
    early_shift_prefs = self.constraints_config.get('earlyShiftPreferences', {})

    for date, rule in calendar_rules.items():
        if date not in self.date_range:
            continue

        if rule.get('must_day_off'):
            for staff in self.staff_members:
                staff_id = staff['id']

                # Check if staff has early shift preference for this date
                has_early_pref = False
                if staff_id in early_shift_prefs:
                    prefs = early_shift_prefs[staff_id]
                    has_early_pref = prefs.get(date, prefs.get('default', False))

                if has_early_pref:
                    # Force EARLY shift (△) instead of OFF
                    self.model.Add(self.shifts[(staff_id, date, self.SHIFT_EARLY)] == 1)
                    logger.info(f"  {staff_id} on {date}: Early shift (preference override)")
                else:
                    # Force OFF shift (×)
                    self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 1)
                    logger.info(f"  {staff_id} on {date}: Off day (calendar rule)")

        elif rule.get('must_work'):
            # Force all staff to work (not off, not early)
            for staff in self.staff_members:
                staff_id = staff['id']
                self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 0)
                self.model.Add(self.shifts[(staff_id, date, self.SHIFT_EARLY)] == 0)
```

#### 3.2 Backup Staff Handling

Add check to prevent off days for backup-only staff:

```python
def add_backup_staff_constraints(self):
    """Backup-only staff should never have off days (×)"""
    for staff in self.staff_members:
        staff_id = staff['id']
        is_backup = staff.get('isBackupOnly', False) or staff.get('is_backup_only', False)

        if is_backup:
            logger.info(f"[OR-TOOLS] Backup staff {staff_id}: No off days allowed")
            for date in self.date_range:
                self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 0)
```

#### 3.3 Day of Week Mapping Fix

Python uses Monday=0, JS uses Sunday=0. Fix the mapping:

```python
def get_day_of_week_js_style(self, date_str):
    """Convert Python weekday to JS weekday (Sunday=0)"""
    from datetime import datetime
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    py_weekday = dt.weekday()  # Monday=0, Sunday=6
    js_weekday = (py_weekday + 1) % 7  # Sunday=0, Monday=1, ...
    return js_weekday
```

### PHASE 4: Enhanced Logging and Debugging

#### 4.1 Constraint Application Summary

Add summary logging after all constraints:

```python
def log_constraint_summary(self):
    logger.info("=" * 60)
    logger.info("[OR-TOOLS] CONSTRAINT SUMMARY:")
    logger.info(f"  Calendar rules applied: {self.calendar_constraint_count}")
    logger.info(f"  Staff group constraints: {self.staff_group_constraint_count}")
    logger.info(f"  Adjacent conflict constraints: {self.adjacent_constraint_count}")
    logger.info(f"  Daily limit constraints: {self.daily_limit_constraint_count}")
    logger.info(f"  Monthly limit constraints: {self.monthly_limit_constraint_count}")
    logger.info(f"  5-day rest constraints: {self.five_day_rest_constraint_count}")
    logger.info(f"  Priority rules applied: {self.priority_rule_count}")
    logger.info(f"  Priority rules skipped: {self.priority_rule_skipped_count}")
    logger.info("=" * 60)
```

### PHASE 5: Testing and Validation

#### 5.1 Test Cases to Add

```python
# test_scheduler.py

def test_priority_rules_staffId_extraction():
    """Test that priority rules work with various staffId formats"""
    constraints = {
        'priorityRules': [
            # Format 1: Top-level staffId
            {'staffId': 'staff-1', 'shiftType': 'off', 'daysOfWeek': [1]},
            # Format 2: Top-level staff_id (snake_case)
            {'staff_id': 'staff-2', 'shiftType': 'early', 'daysOfWeek': [2]},
            # Format 3: Nested in ruleDefinition
            {'ruleDefinition': {'staff_id': 'staff-3'}, 'shiftType': 'off', 'daysOfWeek': [3]},
            # Format 4: Multi-staff via staffIds array
            {'staffIds': ['staff-4', 'staff-5'], 'shiftType': 'off', 'daysOfWeek': [4]},
        ]
    }
    # Assert all rules are applied

def test_calendar_early_shift_override():
    """Test that early shift preference overrides must_day_off"""
    constraints = {
        'calendarRules': {'2025-12-25': {'must_day_off': True}},
        'earlyShiftPreferences': {'staff-1': {'2025-12-25': True}}
    }
    # Assert staff-1 gets △ on 2025-12-25, others get ×

def test_monthly_limits_exclude_calendar():
    """Test that calendar off-days don't count toward monthly limit"""
    # 3 calendar off-days + 7 flexible off-days should be valid
    # if excludeCalendarRules=True and maxCount=8
```

---

## IMPLEMENTATION ORDER

1. **Priority 1 (Critical - Fix Now):**
   - Fix priority rules staffId extraction (Phase 1.1)
   - Add data validation logging (Phase 1.2)
   - Fix day of week mapping (Phase 3.3)

2. **Priority 2 (Important):**
   - Early shift preferences on must_day_off (Phase 3.1)
   - Monthly limits calendar exclusion (Phase 2.4)
   - Backup staff handling (Phase 3.2)

3. **Priority 3 (Enhancement):**
   - Enhanced logging (Phase 4)
   - Comprehensive tests (Phase 5)

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] Priority rules show "Applied: 6" instead of "Skipped: 6"
- [ ] Calendar rules show correct date count (not 0)
- [ ] Early shift preferences show correct staff count (not 0)
- [ ] Staff groups show correct constraint count
- [ ] Generated schedule respects:
  - [ ] No consecutive off days (××)
  - [ ] No off→early or early→off patterns (×△, △×)
  - [ ] Only 1 member per group has off/early per day
  - [ ] Daily limits are respected
  - [ ] Monthly limits are respected (excluding calendar days)
  - [ ] No more than 5 consecutive work days
  - [ ] Priority rules applied where possible

---

## FILES TO MODIFY

1. `python-ortools-service/scheduler.py` - Main constraint logic
2. `python-ortools-service/test_scheduler.py` - Test cases
3. `go-server/main.go` - Enhanced logging (optional)
4. `src/hooks/useAISettings.js` - Ensure proper staffId extraction (optional)
