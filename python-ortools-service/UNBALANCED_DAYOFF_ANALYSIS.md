# Unbalanced Day-Off Distribution Analysis

## Problem Description

The OR-Tools scheduler is generating schedules with extremely unbalanced day-off distributions:

- **Most staff**: 8.5 - 10.5 day-offs (balanced)
- **Some staff**: 11-12 day-offs (slightly high)
- **One staff**: 18 day-offs (EXTREMELY HIGH - 2x expected!)

## Root Cause Analysis

### 1. Monthly Limit Constraints Are SOFT by Default

**Location**: `scheduler.py` lines 1823-1831

```python
# Check if monthly limits should be HARD constraints
monthly_limit_is_hard = monthly_limit.get('isHardConstraint', False)
constraint_type = "HARD" if monthly_limit_is_hard else "SOFT"
```

**Problem**:
- Monthly limits default to **SOFT constraints** with penalty weight of 80
- When constraints conflict, the solver can violate monthly limits to satisfy other constraints
- A staff with 18 day-offs means the solver violated the monthly max limit by ~8-10 days

**Impact**:
- With `maxCount=10` and penalty weight `80`, violating by 8 days = penalty of 640
- If satisfying other constraints (staff groups, daily limits, 5-day rest) saves more than 640 penalty points, the solver will sacrifice fairness

### 2. No Fairness/Balance Objective Function

**Location**: `scheduler.py` lines 2847-2896 (`_add_objective()`)

**Current objective**:
```python
objective_terms = []

# PRIMARY: Penalize all soft constraint violations
for violation_var, weight, description in self.violation_vars:
    objective_terms.append(-weight * violation_var)

# SECONDARY: Maximize preferred shifts, minimize avoided shifts
# (priority rules)

self.model.Maximize(sum(objective_terms))
```

**Missing**:
- No variance minimization for day-off distribution
- No standard deviation penalty
- No "balance" or "fairness" objective
- Solver only cares about meeting constraints, not about distributing day-offs evenly

**What's needed**:
```python
# Add fairness objective to minimize variance in day-offs
# Example pseudo-code:
avg_offs = total_flexible_days / num_staff
for staff in staff_members:
    deviation = abs(staff_offs[staff] - avg_offs)
    objective_terms.append(-FAIRNESS_WEIGHT * deviation)
```

### 3. Backup Staff Are Exempt from Monthly Limits

**Location**: `scheduler.py` lines 1861-1867

```python
# SKIP BACKUP STAFF - They are exempt from monthly limits
if staff_id in self.backup_staff_ids:
    skipped_backup_count += 1
    logger.info(f"Skipping backup staff {staff_name} from monthly limits")
    continue
```

**Problem**:
- If the staff with 18 day-offs is a **backup staff member**, they are completely exempt from monthly limits
- Backup staff schedules are determined ONLY by coverage constraints
- If no group members are off on certain days, backup staff get automatic off days (×)

**Detection**:
- Check if `staff_id in self.backup_staff_ids`
- Look for `backupAssignments` in constraints config

### 4. Staff with `start_period` or `end_period` Get Prorated Limits

**Location**: `scheduler.py` lines 1870-1920

```python
# PRORATE MONTHLY LIMITS FOR STAFF WITH start_period OR end_period
start_date = self.staff_start_dates.get(staff_id)
end_date = self.staff_end_dates.get(staff_id)

if start_date or end_date:
    # Calculate actual working days
    actual_working_days = sum(1 for d in self.date_range if self._staff_works_on_date(staff_id, d))

    # Formula: min_off = floor(working_days / 4.25)
    calculated_min = max(0, int(actual_working_days / 4.25))
    calculated_max = max(calculated_min + 1, int((max_scaled / 2) * prorate_ratio))
```

**Problem**:
- If a staff member starts mid-period (e.g., 15 working days instead of 31)
- Their prorated max might be calculated incorrectly
- Example: 15 days → max = 15/4.25 = 3.5 → 3 days (too restrictive!)
- But the formula uses `prorate_ratio` for max, which could be too lenient

**Edge Case**:
- Staff with very few working days (e.g., 10 days) might get max=2 or max=3
- If constraint is SOFT and gets violated, they could end up with all 10 days off!

### 5. Constraint Conflict Scenarios

**Potential conflict chain causing 18 day-offs**:

1. **Staff Groups Constraint** (HARD, weight 100): "Only 1 member off per group per day"
   - If this staff is NOT in any group, they have no coverage constraints
   - Solver can assign them unlimited offs without violating group constraints

2. **Daily Limits Constraint** (SOFT, weight 50): "2-3 staff off per day"
   - Solver tries to maintain 2-3 staff off daily
   - If other staff are constrained (groups, 5-day rest), this staff becomes the "flexible buffer"

3. **5-Day Rest Constraint** (SOFT/HARD, weight 200): "No more than 5 consecutive work days"
   - If other staff violate 5-day rest, solver might overcompensate by giving this staff extra offs

4. **Adjacent Conflict** (SOFT, weight 30): "No xx, sx, xs patterns"
   - Low weight means solver easily violates this for one staff if it helps others

**Result**: One staff member becomes the "sacrifice" to satisfy all other constraints.

## Evidence Collection Needed

To confirm the root cause, check the following in logs or data:

### A. Is this staff a backup member?
```python
# Check constraints config
if staff_id in backupAssignments:
    print("BACKUP STAFF - exempt from monthly limits")
```

### B. Does this staff have start_period/end_period?
```python
if staff.get('start_period') or staff.get('end_period'):
    print(f"Partial employment: works {actual_days}/{total_days} days")
    print(f"Prorated max: {calculated_max}")
```

### C. Is this staff NOT in any staff group?
```python
# Check staffGroups in constraints
groups_this_staff = [g for g in staffGroups if staff_id in g['members']]
if not groups_this_staff:
    print("NOT IN ANY GROUP - no coverage constraints apply!")
```

### D. Are monthly limits SOFT or HARD?
```python
monthly_limit_is_hard = constraints['monthlyLimit'].get('isHardConstraint', False)
print(f"Monthly limits: {'HARD' if monthly_limit_is_hard else 'SOFT'}")
```

### E. What violations occurred?
```python
# Check violations list in result
for violation in result['violations']:
    if 'monthly' in violation['description'].lower():
        print(f"Monthly violation: {violation}")
```

## Recommended Solutions

### Solution 1: Make Monthly Limits HARD (Quick Fix)

**File**: Frontend constraints config

```javascript
constraints: {
  monthlyLimit: {
    minCount: 7,
    maxCount: 10,
    isHardConstraint: true,  // Add this!
    excludeCalendarRules: true
  }
}
```

**Pros**:
- Guarantees no staff exceeds max (no more 18 day-offs)
- Simple one-line fix
- Prevents extreme imbalances

**Cons**:
- Might make schedule INFEASIBLE if other constraints conflict
- Reduces solver flexibility
- Could fail to find solutions in edge cases

### Solution 2: Add Fairness Objective (Best Practice)

**File**: `scheduler.py` - Add new method

```python
def _add_fairness_objective(self):
    """
    Add fairness objective to minimize variance in day-off distribution.

    This ensures day-offs are distributed evenly across staff members,
    preventing scenarios where one staff gets 18 days off while others get 9.
    """
    FAIRNESS_WEIGHT = 10  # Lower than constraint penalties

    # Calculate target average off days
    flexible_dates = [d for d in self.date_range if d not in self.calendar_off_dates]
    total_flexible = len(flexible_dates)
    non_backup_staff = [s for s in self.staff_members if s['id'] not in self.backup_staff_ids]

    if not non_backup_staff:
        return

    # Target: total_flexible / num_staff (e.g., 25 days / 10 staff = 2.5 avg)
    # Scale by 2 for integer math: target = 5
    target_scaled = int((total_flexible * 2) / len(non_backup_staff))

    logger.info(f"[OR-TOOLS] Adding fairness objective: target={target_scaled/2:.1f} avg off-equiv per staff")

    fairness_terms = []

    for staff in non_backup_staff:
        staff_id = staff['id']
        staff_name = staff.get('name', staff_id)

        # Get working dates (exclude start/end period)
        staff_dates = [d for d in flexible_dates if self._staff_works_on_date(staff_id, d)]

        if not staff_dates:
            continue

        # Calculate combined off-equivalent: off × 2 + early × 1
        off_vars = [self.shifts[(staff_id, d, self.SHIFT_OFF)] for d in staff_dates]
        early_vars = [self.shifts[(staff_id, d, self.SHIFT_EARLY)] for d in staff_dates]
        combined_scaled = sum(v * 2 for v in off_vars) + sum(v * 1 for v in early_vars)

        # Create deviation variables (both positive and negative)
        # deviation = |combined_scaled - target_scaled|
        max_deviation = len(staff_dates) * 2  # Maximum possible deviation

        pos_dev = self.model.NewIntVar(0, max_deviation, f'fairness_pos_{staff_id}')
        neg_dev = self.model.NewIntVar(0, max_deviation, f'fairness_neg_{staff_id}')

        # pos_dev >= combined_scaled - target_scaled
        self.model.Add(pos_dev >= combined_scaled - target_scaled)
        self.model.Add(pos_dev >= 0)

        # neg_dev >= target_scaled - combined_scaled
        self.model.Add(neg_dev >= target_scaled - combined_scaled)
        self.model.Add(neg_dev >= 0)

        # Minimize total deviation (penalize both over and under)
        fairness_terms.append(-FAIRNESS_WEIGHT * pos_dev)
        fairness_terms.append(-FAIRNESS_WEIGHT * neg_dev)

    # Add fairness terms to objective
    if fairness_terms:
        logger.info(f"[OR-TOOLS] Added {len(fairness_terms)} fairness terms to objective")
        return fairness_terms

    return []
```

**Integration** in `_add_objective()`:

```python
def _add_objective(self):
    objective_terms = []

    # PRIMARY: Penalize soft constraint violations
    for violation_var, weight, description in self.violation_vars:
        objective_terms.append(-weight * violation_var)

    # NEW: Add fairness objective
    fairness_terms = self._add_fairness_objective()
    objective_terms.extend(fairness_terms)

    # SECONDARY: Priority rules
    # ... existing code ...

    self.model.Maximize(sum(objective_terms))
```

**Pros**:
- Encourages balanced distribution without hard constraints
- Still allows flexibility for edge cases
- Prevents extreme imbalances (18 day-offs)
- Works well with SOFT monthly limits

**Cons**:
- More complex implementation
- Adds computational overhead
- Requires tuning FAIRNESS_WEIGHT

### Solution 3: Increase Monthly Limit Penalty Weight

**File**: `scheduler.py` line 112

```python
DEFAULT_PENALTY_WEIGHTS = {
    'staff_group': 100,
    'daily_limit': 50,
    'daily_limit_max': 50,
    'monthly_limit': 150,  # Increase from 80 → 150
    'adjacent_conflict': 30,
    '5_day_rest': 200,
    'staff_type_limit': 60,
}
```

**Pros**:
- Simple one-line fix
- Makes solver prioritize monthly limits over less important constraints
- Keeps flexibility of SOFT constraints

**Cons**:
- Might not completely solve the problem (still SOFT)
- Could create new imbalances in other constraints
- Requires testing to find optimal weight

### Solution 4: Add Hard Cap on Individual Staff Deviation

**File**: `scheduler.py` - Add after monthly limits

```python
def _add_max_deviation_hard_cap(self):
    """
    Add HARD constraint limiting individual staff deviation from average.

    Prevents extreme outliers (e.g., 18 day-offs) while keeping monthly limits SOFT.
    """
    MAX_DEVIATION_FROM_AVG = 3  # No staff can have more than +3 days from average

    flexible_dates = [d for d in self.date_range if d not in self.calendar_off_dates]
    total_flexible = len(flexible_dates)
    non_backup_staff = [s for s in self.staff_members if s['id'] not in self.backup_staff_ids]

    if not non_backup_staff:
        return

    # Calculate average and hard cap
    avg_scaled = int((total_flexible * 2) / len(non_backup_staff))
    max_allowed = avg_scaled + (MAX_DEVIATION_FROM_AVG * 2)  # Scale by 2

    logger.info(f"[OR-TOOLS] Adding hard cap: max {max_allowed/2:.1f} off-equiv per staff (avg={avg_scaled/2:.1f} + {MAX_DEVIATION_FROM_AVG})")

    for staff in non_backup_staff:
        staff_id = staff['id']
        staff_dates = [d for d in flexible_dates if self._staff_works_on_date(staff_id, d)]

        if not staff_dates:
            continue

        off_vars = [self.shifts[(staff_id, d, self.SHIFT_OFF)] for d in staff_dates]
        early_vars = [self.shifts[(staff_id, d, self.SHIFT_EARLY)] for d in staff_dates]
        combined_scaled = sum(v * 2 for v in off_vars) + sum(v * 1 for v in early_vars)

        # HARD constraint: combined_scaled <= max_allowed
        self.model.Add(combined_scaled <= max_allowed)
```

**Call** in `optimize()` after `_add_monthly_limits()`:

```python
self._add_monthly_limits()
self._add_max_deviation_hard_cap()  # Add this!
self._add_monthly_early_shift_limits()
```

**Pros**:
- Prevents extreme outliers (18 day-offs)
- Keeps monthly limits SOFT for flexibility
- Guarantees no staff exceeds reasonable bounds

**Cons**:
- Adds complexity
- Might make schedule INFEASIBLE in rare cases
- Requires tuning MAX_DEVIATION_FROM_AVG

## Recommended Implementation Priority

**Phase 1 (Immediate - 5 minutes)**:
1. Make monthly limits HARD: `isHardConstraint: true`
2. OR increase penalty weight: `monthly_limit: 150`

**Phase 2 (Short-term - 1 hour)**:
3. Add max deviation hard cap (Solution 4)

**Phase 3 (Long-term - 2-3 hours)**:
4. Implement fairness objective (Solution 2)
5. Add variance minimization to objective function

## Testing Strategy

After implementing fixes:

1. **Test Case 1**: 10 regular staff, 31 days, minCount=7, maxCount=10
   - Verify all staff get 8-10 day-offs (no 18!)

2. **Test Case 2**: Staff with start_period (15 working days)
   - Verify prorated limits work correctly
   - Check if deviation is proportional to working days

3. **Test Case 3**: Backup staff member
   - Verify they are still exempt from monthly limits
   - Check that their offs are based on coverage needs

4. **Test Case 4**: Conflicting constraints (tight groups + tight daily limits)
   - Verify schedule is still feasible
   - Check that no single staff becomes the "sacrifice"

5. **Test Case 5**: Variance analysis
   - Calculate standard deviation of day-offs across all staff
   - Target: stdev < 1.5 days (currently ~3-4 days with 18 outlier)

## Conclusion

The 18 day-off anomaly is caused by:

1. **Monthly limits being SOFT constraints** (can be violated)
2. **No fairness/balance objective** in the optimization function
3. **Potential special cases** (backup staff, partial employment, no group membership)
4. **Constraint conflicts** where one staff becomes the "flexible buffer"

**Immediate fix**: Make monthly limits HARD or increase penalty weight.

**Best long-term solution**: Add fairness objective to minimize variance in day-off distribution.
