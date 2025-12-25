# Staff Type Daily Limits - OR-Tools Design Document

## Overview
This document describes the implementation of per-staff-type daily limits for off days and early shifts in the OR-Tools scheduler.

## Requirements

### Functional Requirements
1. Filter staff members by their `status` field (社員, 派遣, パート)
2. For each staff type and each date:
   - Count total off shifts (×) for that type
   - Count total early shifts (△) for that type
   - Apply maxOff and maxEarly constraints
3. Support both HARD and SOFT constraint modes
4. Handle edge cases gracefully

### Configuration Structure
```python
staffTypeLimits = {
    "社員": {
        "maxOff": 1,      # Max 1 regular employee off per day
        "maxEarly": 2,    # Max 2 regular employees on early shift
        "isHard": True    # Strictly enforce (vs soft penalty)
    },
    "派遣": {
        "maxOff": 1,
        "maxEarly": 2,
        "isHard": True
    },
    "パート": {
        "maxOff": 2,
        "maxEarly": 1,
        "isHard": False   # Allow violations with penalty
    }
}
```

## Implementation Design

### 1. Method Structure: `_add_staff_type_daily_limits()`

```python
def _add_staff_type_daily_limits(self):
    """
    Staff type daily limits: Limit off/early shifts per staff type per day.

    Purpose: Ensure balanced coverage by limiting how many staff of each type
    (社員/派遣/パート) can be off or on early shift on any given day.

    Example:
    - Max 1 regular employee (社員) off per day
    - Max 2 regular employees on early shift per day
    - Max 2 part-timers (パート) off per day

    CONFIGURABLE: Can be HARD or SOFT per staff type.
    """
    pass
```

### 2. Implementation Steps

#### Step 1: Configuration Extraction
```python
staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

if not staff_type_limits:
    logger.info("[OR-TOOLS] No staff type limits provided")
    return

logger.info(f"[OR-TOOLS] Adding staff type daily limits for {len(staff_type_limits)} types...")
```

#### Step 2: Staff Grouping by Type
```python
# Group staff by status (staff type)
staff_by_type = {}
for staff in self.staff_members:
    status = staff.get('status', 'Unknown')
    if status not in staff_by_type:
        staff_by_type[status] = []
    staff_by_type[status].append(staff)

logger.info(f"  Staff distribution: {[(t, len(s)) for t, s in staff_by_type.items()]}")
```

#### Step 3: Constraint Application
```python
constraint_count = 0

for staff_type, limits in staff_type_limits.items():
    # Get staff members of this type
    type_staff = staff_by_type.get(staff_type, [])

    if not type_staff:
        logger.warning(f"  No staff found with type '{staff_type}' - skipping")
        continue

    max_off = limits.get('maxOff', None)
    max_early = limits.get('maxEarly', None)
    is_hard = limits.get('isHard', False)

    # Apply constraints for each date
    for date in self.date_range:
        # Skip calendar must_day_off dates (forced off anyway)
        if date in self.calendar_off_dates:
            continue

        # Count off shifts for this type on this date
        if max_off is not None:
            # Apply off constraint
            pass

        # Count early shifts for this type on this date
        if max_early is not None:
            # Apply early constraint
            pass
```

#### Step 4: HARD vs SOFT Constraint Implementation
```python
# HARD CONSTRAINT
if is_hard:
    self.model.Add(off_count <= max_off)
    constraint_count += 1
else:
    # SOFT CONSTRAINT: Penalize violations
    violation_var = self.model.NewIntVar(
        0, len(type_staff),
        f'staff_type_{staff_type}_off_{date}_violation'
    )
    self.model.Add(violation_var >= off_count - max_off)
    self.model.Add(violation_var >= 0)

    self.violation_vars.append((
        violation_var,
        self.PENALTY_WEIGHTS.get('staff_type_limit', 60),
        f'Staff type {staff_type} over max off on {date}'
    ))
    constraint_count += 1
```

### 3. Edge Case Handling

| Case | Handling |
|------|----------|
| No staff of a type | Skip with warning log |
| Zero limit (maxOff=0) | Valid - no one of that type can be off |
| Limit > staff count | Valid but ineffective - log warning |
| Calendar override dates | Skip those dates entirely |
| Missing 'status' field | Default to 'Unknown' type |
| Negative limits | Invalid - log error and skip |
| None/null limits | Skip that constraint type (off or early) |

### 4. Integration Point in `solve()` method

Add after `_add_daily_limits()` and before `_add_monthly_limits()`:

```python
# Line ~170 in scheduler.py
self._add_daily_limits()                         # BALANCE phase
self._add_staff_type_daily_limits()             # NEW: Per-type limits
self._add_monthly_limits()                       # Phase 6.6 monthly MIN/MAX
```

### 5. Logging Strategy

```python
# Initialization
logger.info("[OR-TOOLS] Adding staff type daily limits...")
logger.info(f"  Found {len(staff_by_type)} staff types: {list(staff_by_type.keys())}")

# Per-type processing
logger.info(f"  Type '{staff_type}': {len(type_staff)} staff, maxOff={max_off}, maxEarly={max_early}, mode={'HARD' if is_hard else 'SOFT'}")

# Constraint counting
logger.info(f"[OR-TOOLS] Added {constraint_count} staff type limit constraints")

# Warnings
logger.warning(f"  No staff found with type '{staff_type}' - skipping")
logger.warning(f"  Type '{staff_type}': maxOff={max_off} exceeds staff count={len(type_staff)}")
```

### 6. Penalty Weight Configuration

Add to `DEFAULT_PENALTY_WEIGHTS`:

```python
self.DEFAULT_PENALTY_WEIGHTS = {
    'staff_group': 100,
    'daily_limit': 50,
    'daily_limit_max': 50,
    'monthly_limit': 80,
    'adjacent_conflict': 30,
    '5_day_rest': 200,
    'staff_type_limit': 60,  # NEW: Medium-high priority
}
```

## Testing Strategy

### Unit Tests

#### Test 1: Basic Staff Type Limits
```python
def test_staff_type_off_limits(sample_staff_mixed_types, short_dates):
    """Test that staff type off limits are enforced."""
    # 3 社員, 2 派遣, 1 パート
    result = optimize_schedule(
        constraints={
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'isHard': True},
                '派遣': {'maxOff': 1, 'isHard': True}
            }
        }
    )

    # Verify: Each day has max 1 社員 off and max 1 派遣 off
```

#### Test 2: Early Shift Type Limits
```python
def test_staff_type_early_limits(sample_staff_mixed_types, short_dates):
    """Test that staff type early shift limits are enforced."""
    result = optimize_schedule(
        constraints={
            'staffTypeLimits': {
                '社員': {'maxEarly': 2, 'isHard': True}
            }
        }
    )

    # Verify: Each day has max 2 社員 on early shift
```

#### Test 3: SOFT Constraint Mode
```python
def test_staff_type_soft_constraint(sample_staff_mixed_types, short_dates):
    """Test that SOFT mode allows violations with penalty."""
    result = optimize_schedule(
        constraints={
            'staffTypeLimits': {
                '社員': {'maxOff': 0, 'isHard': False}  # Impossible if strict
            }
        }
    )

    # Should succeed with violations
    assert result['success'] == True
    assert result['stats']['total_violations'] > 0
```

#### Test 4: Edge Case - No Staff of Type
```python
def test_staff_type_missing_type():
    """Test handling of type with no staff members."""
    # Staff are all 社員, but we constrain 派遣
    result = optimize_schedule(
        constraints={
            'staffTypeLimits': {
                '派遣': {'maxOff': 1, 'isHard': True}
            }
        }
    )

    # Should succeed and skip the constraint
    assert result['success'] == True
```

#### Test 5: Combined with Other Constraints
```python
def test_staff_type_with_daily_limits():
    """Test staff type limits combined with overall daily limits."""
    result = optimize_schedule(
        constraints={
            'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3},
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'isHard': True},
                '派遣': {'maxOff': 1, 'isHard': True}
            }
        }
    )

    # Both constraints should be satisfied
    assert result['success'] == True
```

#### Test 6: Calendar Override Dates
```python
def test_staff_type_skips_calendar_dates():
    """Test that staff type limits don't apply to must_day_off dates."""
    result = optimize_schedule(
        constraints={
            'calendarRules': {
                '2025-12-25': {'must_day_off': True}
            },
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'isHard': True}  # Would be violated on Dec 25
            }
        }
    )

    # Should succeed - calendar dates are excluded
    assert result['success'] == True
```

### Integration Tests

#### Test 7: Real-World Scenario
```python
def test_realistic_restaurant_schedule():
    """Test realistic restaurant with mixed staff types."""
    # 4 社員 (full-time), 3 派遣 (dispatch), 2 パート (part-time)
    result = optimize_schedule(
        staff_members=[
            {'id': '1', 'name': 'Chef', 'status': '社員'},
            {'id': '2', 'name': 'Sous', 'status': '社員'},
            {'id': '3', 'name': 'Cook1', 'status': '社員'},
            {'id': '4', 'name': 'Cook2', 'status': '社員'},
            {'id': '5', 'name': 'Temp1', 'status': '派遣'},
            {'id': '6', 'name': 'Temp2', 'status': '派遣'},
            {'id': '7', 'name': 'Temp3', 'status': '派遣'},
            {'id': '8', 'name': 'Part1', 'status': 'パート'},
            {'id': '9', 'name': 'Part2', 'status': 'パート'},
        ],
        date_range=['2025-12-{:02d}'.format(d) for d in range(1, 32)],
        constraints={
            'dailyLimitsRaw': {'minOffPerDay': 2, 'maxOffPerDay': 3},
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                '派遣': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                'パート': {'maxOff': 2, 'maxEarly': 1, 'isHard': False}
            },
            'monthlyLimit': {'minCount': 7, 'maxCount': 8}
        }
    )

    assert result['success'] == True
    # Verify all constraints are satisfied
```

## Performance Considerations

### Complexity Analysis
- **Variables**: No new variables added (uses existing shift variables)
- **Constraints**: O(T × D) where T = number of staff types, D = number of dates
- **Typical case**: 3 types × 30 days × 2 constraints = 180 constraints (negligible)

### Expected Impact
- Minimal impact on solve time (<5%)
- Improves solution quality by enforcing business rules
- SOFT mode prevents infeasibility from over-constraining

## Error Handling

### Validation Checks
1. **Invalid limits**: Negative values → Log error and skip
2. **Type mismatch**: No staff of that type → Log warning and skip
3. **Over-constraining**: Detect impossible combinations → Use SOFT mode
4. **Missing config**: No staffTypeLimits → Skip gracefully

### Error Messages
```python
# No staff of type
logger.warning(f"[OR-TOOLS] Staff type '{staff_type}' has no members - skipping constraints")

# Invalid limit value
logger.error(f"[OR-TOOLS] Invalid maxOff={max_off} for type '{staff_type}' - must be >= 0")

# Over-constraining detected
logger.warning(f"[OR-TOOLS] Type '{staff_type}' maxOff={max_off} exceeds available staff={len(type_staff)}")
```

## Future Enhancements

1. **Min Limits**: Add minOff/minEarly for ensuring minimum coverage
2. **Time-based Limits**: Different limits for weekdays vs weekends
3. **Combined Type Groups**: Constraints across multiple staff types
4. **Dynamic Adjustment**: Auto-adjust limits based on demand forecasts

## References
- Main scheduler: `scheduler.py`
- Existing daily limits: `_add_daily_limits()` (line 423)
- Staff grouping pattern: `_add_staff_group_constraints()` (line 332)
- HARD/SOFT pattern: All constraint methods (throughout)
