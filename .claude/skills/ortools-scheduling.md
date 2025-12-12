# OR-Tools Employee Scheduling Skill

**Skill Name:** ortools-scheduling
**Purpose:** Build optimal employee/shift schedules using Google OR-Tools CP-SAT solver
**Source:** https://developers.google.com/optimization/scheduling/employee_scheduling

---

## Quick Start Template

```python
from ortools.sat.python import cp_model

def create_schedule(staff, days, shifts):
    model = cp_model.CpModel()

    # 1. Create variables
    assignments = {}
    for s in staff:
        for d in days:
            for shift in shifts:
                assignments[(s, d, shift)] = model.new_bool_var(f"shift_{s}_{d}_{shift}")

    # 2. Add constraints
    # ... (see constraint patterns below)

    # 3. Solve
    solver = cp_model.CpSolver()
    status = solver.solve(model)

    # 4. Extract solution
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        return extract_schedule(solver, assignments)
    return None
```

---

## Core Concepts

### 1. Model Creation

```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()
```

### 2. Boolean Variables

Each variable represents: "Does staff X work shift Y on day Z?"

```python
# Basic pattern
shifts = {}
for staff_id in all_staff:
    for date in all_dates:
        for shift_type in all_shifts:
            var_name = f"shift_{staff_id}_{date}_{shift_type}"
            shifts[(staff_id, date, shift_type)] = model.new_bool_var(var_name)
```

### 3. Shift Types (for your system)

```python
SHIFT_WORK = 0      # Normal work (○ or empty)
SHIFT_OFF = 1       # Off day (×)
SHIFT_EARLY = 2     # Early shift (△)
SHIFT_LATE = 3      # Late shift (◇)

SHIFT_SYMBOLS = {
    0: '',      # WORK
    1: '×',     # OFF
    2: '△',     # EARLY
    3: '◇'      # LATE
}
```

---

## Constraint Patterns

### Pattern 1: One Shift Per Staff Per Day

Each staff member has exactly one shift type per day.

```python
for staff_id in all_staff:
    for date in all_dates:
        model.AddExactlyOne([
            shifts[(staff_id, date, shift_type)]
            for shift_type in all_shifts
        ])
```

### Pattern 2: Exact Coverage Per Shift

Each shift must have exactly N staff assigned.

```python
# Exactly 1 staff per shift per day
for date in all_dates:
    for shift_type in all_shifts:
        model.AddExactlyOne([
            shifts[(staff_id, date, shift_type)]
            for staff_id in all_staff
        ])
```

### Pattern 3: Min/Max Limits Per Day

```python
# Daily off limits: min 2, max 3 staff off per day
for date in all_dates:
    off_count = sum([
        shifts[(staff_id, date, SHIFT_OFF)]
        for staff_id in all_staff
    ])
    model.Add(off_count >= 2)  # Minimum
    model.Add(off_count <= 3)  # Maximum
```

### Pattern 4: Min/Max Limits Per Staff Per Month

```python
# Monthly limits: each staff gets 7-8 off days per month
for staff_id in all_staff:
    total_off = sum([
        shifts[(staff_id, date, SHIFT_OFF)]
        for date in all_dates
    ])
    model.Add(total_off >= 7)   # Minimum off days
    model.Add(total_off <= 8)   # Maximum off days
```

### Pattern 5: Even Distribution

```python
# Distribute shifts evenly among staff
num_total_shifts = len(all_dates) * len(all_shifts)
min_per_staff = num_total_shifts // len(all_staff)
max_per_staff = min_per_staff + (1 if num_total_shifts % len(all_staff) else 0)

for staff_id in all_staff:
    worked = sum([
        shifts[(staff_id, date, shift_type)]
        for date in all_dates
        for shift_type in [SHIFT_WORK, SHIFT_EARLY, SHIFT_LATE]  # Exclude OFF
    ])
    model.Add(worked >= min_per_staff)
    model.Add(worked <= max_per_staff)
```

### Pattern 6: No Consecutive Pattern (e.g., no ××)

```python
# Prevent two consecutive off days
for staff_id in all_staff:
    for i in range(len(all_dates) - 1):
        date1 = all_dates[i]
        date2 = all_dates[i + 1]

        # off[day1] + off[day2] <= 1 (at most one can be off)
        model.Add(
            shifts[(staff_id, date1, SHIFT_OFF)] +
            shifts[(staff_id, date2, SHIFT_OFF)] <= 1
        )
```

### Pattern 7: Rolling Window Constraint (5-Day Rest)

```python
# At least 1 rest day in every 6-day window (no >5 consecutive work days)
for staff_id in all_staff:
    for i in range(len(all_dates) - 5):
        window = all_dates[i:i+6]

        rest_days = sum([
            shifts[(staff_id, date, SHIFT_OFF)] +
            shifts[(staff_id, date, SHIFT_EARLY)]
            for date in window
        ])

        model.Add(rest_days >= 1)
```

### Pattern 8: Group Constraint (Only 1 Off Per Group)

```python
# Staff groups: only 1 member can be off per day
staff_groups = [
    {'name': 'Group1', 'members': ['staff-1', 'staff-2', 'staff-3']},
]

for group in staff_groups:
    for date in all_dates:
        group_off = sum([
            shifts[(member_id, date, SHIFT_OFF)] +
            shifts[(member_id, date, SHIFT_EARLY)]
            for member_id in group['members']
        ])
        model.Add(group_off <= 1)
```

### Pattern 9: Force Specific Assignment (Calendar Rules)

```python
# must_day_off: Force all staff to be off on specific date
must_day_off_dates = ['2025-12-25', '2026-01-01']

for date in must_day_off_dates:
    for staff_id in all_staff:
        model.Add(shifts[(staff_id, date, SHIFT_OFF)] == 1)
```

### Pattern 10: Force With Exception (Early Shift Preference)

```python
# must_day_off with early shift exceptions
early_shift_prefs = {
    'staff-1': ['2025-12-25'],  # staff-1 can work early on Dec 25
}

for date in must_day_off_dates:
    for staff_id in all_staff:
        if staff_id in early_shift_prefs and date in early_shift_prefs[staff_id]:
            # This staff gets early shift instead of off
            model.Add(shifts[(staff_id, date, SHIFT_EARLY)] == 1)
        else:
            # Everyone else gets off
            model.Add(shifts[(staff_id, date, SHIFT_OFF)] == 1)
```

---

## Shift Requests (Soft Constraints)

### Concept

Shift requests are **preferences**, not hard requirements. Use objective function to maximize fulfilled requests.

### Data Structure

```python
# 3D array: shift_requests[staff][day][shift] = 1 if requested, 0 if not
shift_requests = {
    'staff-1': {
        '2025-12-01': {'early': 1, 'off': 0, 'work': 0},  # Wants early shift
        '2025-12-02': {'early': 0, 'off': 1, 'work': 0},  # Wants off
    },
    'staff-2': {
        '2025-12-01': {'early': 0, 'off': 0, 'work': 1},  # Wants work
    }
}
```

### Maximize Fulfilled Requests

```python
# Create request variables
request_fulfilled = []

for staff_id in all_staff:
    if staff_id not in shift_requests:
        continue

    for date in all_dates:
        if date not in shift_requests[staff_id]:
            continue

        for shift_name, requested in shift_requests[staff_id][date].items():
            if requested == 1:
                shift_type = SHIFT_MAP[shift_name]
                request_fulfilled.append(shifts[(staff_id, date, shift_type)])

# Objective: maximize fulfilled requests
model.Maximize(sum(request_fulfilled))
```

### Complete Example with Requests

```python
from ortools.sat.python import cp_model

def schedule_with_requests():
    model = cp_model.CpModel()

    # Data
    all_staff = ['nurse-1', 'nurse-2', 'nurse-3', 'nurse-4', 'nurse-5']
    all_dates = [f'2025-12-{str(d).zfill(2)}' for d in range(1, 8)]
    SHIFTS = [0, 1, 2]  # 0=morning, 1=afternoon, 2=night

    # Shift requests: requests[staff_idx][day_idx] = [morning, afternoon, night]
    # 1 = requested, 0 = not requested
    shift_requests = [
        [[0, 0, 1], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 0, 1]],
        [[0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0], [0, 0, 1]],
        [[0, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0]],
        [[0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, 0, 0]],
        [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]],
    ]

    # Create variables
    assignments = {}
    for n, staff_id in enumerate(all_staff):
        for d, date in enumerate(all_dates):
            for s in SHIFTS:
                assignments[(n, d, s)] = model.new_bool_var(f'shift_n{n}_d{d}_s{s}')

    # Constraint: Each shift has exactly 1 nurse
    for d in range(len(all_dates)):
        for s in SHIFTS:
            model.AddExactlyOne(assignments[(n, d, s)] for n in range(len(all_staff)))

    # Constraint: Each nurse works at most 1 shift per day
    for n in range(len(all_staff)):
        for d in range(len(all_dates)):
            model.AddAtMostOne(assignments[(n, d, s)] for s in SHIFTS)

    # Constraint: Even distribution
    min_shifts = (len(SHIFTS) * len(all_dates)) // len(all_staff)
    max_shifts = min_shifts + 1

    for n in range(len(all_staff)):
        worked = sum(assignments[(n, d, s)] for d in range(len(all_dates)) for s in SHIFTS)
        model.Add(worked >= min_shifts)
        model.Add(worked <= max_shifts)

    # Objective: Maximize fulfilled requests
    model.Maximize(
        sum(
            shift_requests[n][d][s] * assignments[(n, d, s)]
            for n in range(len(all_staff))
            for d in range(len(all_dates))
            for s in SHIFTS
        )
    )

    # Solve
    solver = cp_model.CpSolver()
    status = solver.solve(model)

    if status == cp_model.OPTIMAL:
        print(f"✅ Optimal solution found!")
        print(f"📊 Requests fulfilled: {int(solver.objective_value)}")

        for d, date in enumerate(all_dates):
            print(f"\n{date}:")
            for n, staff_id in enumerate(all_staff):
                for s in SHIFTS:
                    if solver.value(assignments[(n, d, s)]) == 1:
                        req_status = "(requested)" if shift_requests[n][d][s] else "(not requested)"
                        print(f"  {staff_id} → Shift {s} {req_status}")

    return solver.objective_value if status == cp_model.OPTIMAL else None

if __name__ == '__main__':
    schedule_with_requests()
```

---

## Solver Configuration

### Basic Solve

```python
solver = cp_model.CpSolver()
status = solver.solve(model)
```

### With Timeout

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 30.0
status = solver.solve(model)
```

### Parallel Search (Faster)

```python
solver = cp_model.CpSolver()
solver.parameters.num_search_workers = 4  # Use 4 CPU cores
status = solver.solve(model)
```

### Check Status

```python
if status == cp_model.OPTIMAL:
    print("Found optimal solution")
elif status == cp_model.FEASIBLE:
    print("Found feasible solution (may not be optimal)")
elif status == cp_model.INFEASIBLE:
    print("No solution exists - constraints are impossible")
elif status == cp_model.MODEL_INVALID:
    print("Model is invalid")
else:
    print("Unknown status")
```

### Extract Solution

```python
if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
    for staff_id in all_staff:
        for date in all_dates:
            for shift_type in all_shifts:
                if solver.value(shifts[(staff_id, date, shift_type)]) == 1:
                    print(f"{staff_id} works {SHIFT_SYMBOLS[shift_type]} on {date}")
```

### Get Statistics

```python
print(f"Solve time: {solver.wall_time:.2f}s")
print(f"Branches: {solver.num_branches}")
print(f"Conflicts: {solver.num_conflicts}")
if model.has_objective():
    print(f"Objective value: {solver.objective_value}")
```

---

## Complete Production Template

```python
"""
Production-ready OR-Tools Employee Scheduler
Includes all constraint patterns for shift-schedule-manager
"""

from ortools.sat.python import cp_model
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class EmployeeScheduler:
    """OR-Tools based employee scheduler with all constraint patterns."""

    SHIFT_WORK = 0
    SHIFT_OFF = 1
    SHIFT_EARLY = 2
    SHIFT_LATE = 3

    SHIFT_SYMBOLS = {0: '', 1: '×', 2: '△', 3: '◇'}

    def __init__(self):
        self.model = None
        self.shifts = {}
        self.staff = []
        self.dates = []
        self.config = {}

    def solve(
        self,
        staff: List[Dict],
        dates: List[str],
        config: Dict[str, Any],
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Solve the scheduling problem.

        Args:
            staff: List of staff dicts with 'id', 'name'
            dates: List of date strings 'YYYY-MM-DD'
            config: Configuration dict with constraints
            timeout: Max solve time in seconds

        Returns:
            {
                'success': bool,
                'schedule': {staff_id: {date: symbol}},
                'stats': {...}
            }
        """
        self.model = cp_model.CpModel()
        self.staff = staff
        self.dates = dates
        self.config = config

        # Build model
        self._create_variables()
        self._add_one_shift_per_day()
        self._add_calendar_rules()
        self._add_daily_limits()
        self._add_monthly_limits()
        self._add_staff_groups()
        self._add_no_consecutive_off()
        self._add_5_day_rest()
        self._add_shift_requests()  # Objective function

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = timeout
        solver.parameters.num_search_workers = 4

        status = solver.solve(self.model)

        return self._extract_result(solver, status)

    def _create_variables(self):
        """Create boolean decision variables."""
        for s in self.staff:
            for d in self.dates:
                for shift in range(4):
                    self.shifts[(s['id'], d, shift)] = \
                        self.model.new_bool_var(f"s_{s['id']}_{d}_{shift}")

    def _add_one_shift_per_day(self):
        """Each staff has exactly one shift per day."""
        for s in self.staff:
            for d in self.dates:
                self.model.AddExactlyOne([
                    self.shifts[(s['id'], d, shift)]
                    for shift in range(4)
                ])

    def _add_calendar_rules(self):
        """Apply must_day_off and must_work rules."""
        rules = self.config.get('calendarRules', {})
        early_prefs = self.config.get('earlyShiftPreferences', {})

        for date, rule in rules.items():
            if date not in self.dates:
                continue

            if rule.get('must_day_off'):
                for s in self.staff:
                    sid = s['id']
                    has_early = sid in early_prefs and date in early_prefs[sid].get('dates', [])

                    if has_early:
                        self.model.Add(self.shifts[(sid, date, self.SHIFT_EARLY)] == 1)
                    else:
                        self.model.Add(self.shifts[(sid, date, self.SHIFT_OFF)] == 1)

            elif rule.get('must_work'):
                for s in self.staff:
                    self.model.Add(self.shifts[(s['id'], date, self.SHIFT_WORK)] == 1)

    def _add_daily_limits(self):
        """Add min/max off per day constraints."""
        limits = self.config.get('dailyLimitsRaw', {})
        min_off = limits.get('minOffPerDay', 2)
        max_off = limits.get('maxOffPerDay', 3)
        calendar = self.config.get('calendarRules', {})

        for d in self.dates:
            if d in calendar:
                continue  # Skip calendar override dates

            off_count = sum([
                self.shifts[(s['id'], d, self.SHIFT_OFF)]
                for s in self.staff
            ])
            self.model.Add(off_count >= min_off)
            self.model.Add(off_count <= max_off)

    def _add_monthly_limits(self):
        """Add min/max off per staff per month."""
        limits = self.config.get('monthlyLimit', {})
        if not limits:
            return

        min_off = limits.get('minCount', 7)
        max_off = limits.get('maxCount', 8)
        exclude_cal = limits.get('excludeCalendarRules', True)
        calendar = self.config.get('calendarRules', {})

        for s in self.staff:
            if exclude_cal:
                flexible_dates = [d for d in self.dates
                                  if d not in calendar or not calendar[d].get('must_day_off')]
            else:
                flexible_dates = self.dates

            off_count = sum([
                self.shifts[(s['id'], d, self.SHIFT_OFF)]
                for d in flexible_dates
            ])
            self.model.Add(off_count >= min_off)
            self.model.Add(off_count <= max_off)

    def _add_staff_groups(self):
        """Add staff group constraints (only 1 off per group per day)."""
        groups = self.config.get('staffGroups', [])
        staff_ids = {s['id'] for s in self.staff}
        calendar = self.config.get('calendarRules', {})

        for group in groups:
            members = [m for m in group.get('members', []) if m in staff_ids]
            if len(members) < 2:
                continue

            for d in self.dates:
                if d in calendar and calendar[d].get('must_day_off'):
                    continue

                off_early = sum([
                    self.shifts[(m, d, self.SHIFT_OFF)] +
                    self.shifts[(m, d, self.SHIFT_EARLY)]
                    for m in members
                ])
                self.model.Add(off_early <= 1)

    def _add_no_consecutive_off(self):
        """Prevent consecutive off days (××, △×, ×△)."""
        calendar = self.config.get('calendarRules', {})

        for s in self.staff:
            sid = s['id']
            for i in range(len(self.dates) - 1):
                d1, d2 = self.dates[i], self.dates[i + 1]

                if d1 in calendar or d2 in calendar:
                    continue

                # No ××
                self.model.Add(
                    self.shifts[(sid, d1, self.SHIFT_OFF)] +
                    self.shifts[(sid, d2, self.SHIFT_OFF)] <= 1
                )
                # No △×
                self.model.Add(
                    self.shifts[(sid, d1, self.SHIFT_EARLY)] +
                    self.shifts[(sid, d2, self.SHIFT_OFF)] <= 1
                )
                # No ×△
                self.model.Add(
                    self.shifts[(sid, d1, self.SHIFT_OFF)] +
                    self.shifts[(sid, d2, self.SHIFT_EARLY)] <= 1
                )

    def _add_5_day_rest(self):
        """At least 1 rest day in every 6-day window."""
        for s in self.staff:
            sid = s['id']
            for i in range(len(self.dates) - 5):
                window = self.dates[i:i+6]
                rest = sum([
                    self.shifts[(sid, d, self.SHIFT_OFF)] +
                    self.shifts[(sid, d, self.SHIFT_EARLY)]
                    for d in window
                ])
                self.model.Add(rest >= 1)

    def _add_shift_requests(self):
        """Add objective to maximize fulfilled shift requests."""
        requests = self.config.get('shiftRequests', {})
        if not requests:
            return

        fulfilled = []
        for s in self.staff:
            sid = s['id']
            if sid not in requests:
                continue

            for d, day_reqs in requests[sid].items():
                if d not in self.dates:
                    continue

                for shift_name, requested in day_reqs.items():
                    if requested:
                        shift_type = {'off': 1, 'early': 2, 'late': 3, 'work': 0}.get(shift_name, 0)
                        fulfilled.append(self.shifts[(sid, d, shift_type)])

        if fulfilled:
            self.model.Maximize(sum(fulfilled))

    def _extract_result(self, solver, status) -> Dict[str, Any]:
        """Extract solution from solver."""
        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return {
                'success': False,
                'error': f'No solution: {status}',
                'schedule': {}
            }

        schedule = {}
        for s in self.staff:
            sid = s['id']
            schedule[sid] = {}
            for d in self.dates:
                for shift in range(4):
                    if solver.value(self.shifts[(sid, d, shift)]) == 1:
                        schedule[sid][d] = self.SHIFT_SYMBOLS[shift]
                        break

        return {
            'success': True,
            'is_optimal': status == cp_model.OPTIMAL,
            'schedule': schedule,
            'solve_time': solver.wall_time,
            'stats': {
                'branches': solver.num_branches,
                'conflicts': solver.num_conflicts,
            }
        }


# Example usage
if __name__ == '__main__':
    scheduler = EmployeeScheduler()

    result = scheduler.solve(
        staff=[
            {'id': 'staff-1', 'name': '料理長'},
            {'id': 'staff-2', 'name': '田中'},
            {'id': 'staff-3', 'name': '山田'},
        ],
        dates=[f'2025-12-{str(d).zfill(2)}' for d in range(1, 32)],
        config={
            'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1},
            'monthlyLimit': {'minCount': 8, 'maxCount': 10},
            'calendarRules': {'2025-12-25': {'must_day_off': True}},
        },
        timeout=30
    )

    if result['success']:
        print(f"✅ Schedule generated in {result['solve_time']:.2f}s")
        for staff_id, days in result['schedule'].items():
            print(f"\n{staff_id}:")
            for date, shift in sorted(days.items()):
                print(f"  {date}: {shift or '○'}")
```

---

## Troubleshooting

### Problem: "No solution found"

```python
# Check if constraints are too tight
# Try relaxing one constraint at a time

# Example: Remove monthly limits temporarily
# config['monthlyLimit'] = None
```

### Problem: "Takes too long"

```python
# 1. Increase workers
solver.parameters.num_search_workers = 8

# 2. Accept first feasible solution
solver.parameters.stop_after_first_solution = True

# 3. Reduce timeout and accept feasible
solver.parameters.max_time_in_seconds = 10
```

### Problem: "Model invalid"

```python
# Check for conflicting constraints
# Example: min_off > max_off is invalid
# Example: more shifts required than staff available
```

---

## References

- [OR-Tools Employee Scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling)
- [OR-Tools CP-SAT Primer](https://developers.google.com/optimization/cp/cp_solver)
- [OR-Tools Python Reference](https://developers.google.com/optimization/reference/python/sat/python/cp_model)
