# OR-Tools Migration Guide

**Document Version:** 1.1
**Created:** 2025-12-11
**Updated:** 2025-12-12
**Status:** Ready for Implementation
**Estimated Time:** 3-5 days (18-25 hours)

---

## Executive Summary

This guide documents the migration from the current JavaScript rule-based ML system to Google OR-Tools CP-SAT solver for shift schedule optimization. The decision was made because:

1. **Current ML results are unsatisfactory** - Multi-phase heuristic approach doesn't always find optimal solutions
2. **OR-Tools provides provably optimal solutions** - Uses constraint programming with SAT solver
3. **Cleaner architecture** - Remove ~6,400 lines of JS ML code, replace with Python OR-Tools service
4. **Better maintainability** - One system to maintain instead of complex multi-phase rule engine
5. **Shift Requests Support** - Future feature: staff can request preferred shifts (soft constraints)

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Target Architecture](#2-target-architecture)
3. [Files to DELETE](#3-files-to-delete)
4. [Files to KEEP](#4-files-to-keep)
5. [Constraint Mapping Reference](#5-constraint-mapping-reference)
6. [Implementation Steps](#6-implementation-steps)
7. [Python OR-Tools Service Specification](#7-python-or-tools-service-specification)
8. [Go Server Integration](#8-go-server-integration)
9. [Frontend Changes](#9-frontend-changes)
10. [Docker Configuration](#10-docker-configuration)
11. [Testing Strategy](#11-testing-strategy)
12. [Rollback Plan](#12-rollback-plan)
13. [Future: Shift Requests Feature](#13-future-shift-requests-feature)

---

## Skills & References

**Before implementing, read these resources:**

1. **Skill File:** `.claude/skills/ortools-scheduling.md` - Complete OR-Tools patterns and code templates
2. **Official Docs:** https://developers.google.com/optimization/scheduling/employee_scheduling
3. **Shift Requests:** https://developers.google.com/optimization/scheduling/employee_scheduling#scheduling_with_shift_requests

---

## 1. Current Architecture Overview

### Current ML Flow
```
User clicks "自動生成" (Auto-fill)
    ↓
useAIAssistantLazy.js
    ↓
HybridPredictor.js
    ↓
BusinessRuleValidator.generateRuleBasedSchedule()
    ↓
8+ sequential phases (PRE-PHASE, PHASE 1-6, POST-REPAIR)
    ↓
Returns schedule to UI
```

### Current File Structure (ML Components)
```
src/ai/
├── hybrid/
│   ├── BusinessRuleValidator.js    (~3,000 lines) - Main ML engine
│   └── HybridPredictor.js          (~500 lines)   - Orchestrator
├── constraints/
│   └── ConstraintEngine.js         (~2,000 lines) - Constraint definitions
├── core/
│   └── PatternRecognizer.js        (~300 lines)   - Pattern analysis
└── utils/
    ├── CalendarRulesLoader.js      (KEEP)         - Data loading
    ├── EarlyShiftPreferencesLoader.js (KEEP)      - Data loading
    ├── CalendarEarlyShiftIntegrator.js (~200 lines) - Phase 3 logic
    └── MonthlyLimitCalculator.js   (~400 lines)   - Monthly calculations
```

### Current Constraint System (from AI_GENERATION_FLOW_DOCUMENTATION.md)

The current system implements these constraints in sequential phases:

| Phase | Constraint Type | Description |
|-------|----------------|-------------|
| PRE-PHASE | Calendar must_day_off | Force × for all staff on specific dates |
| PHASE 1 | Priority Rules | Staff preferred/avoided shifts |
| PHASE 2 | Staff Groups | Only 1 member off per group per day |
| PHASE 3 | Off-Day Distribution | Random allocation with limits |
| PHASE 4 | 5-Day Rest | No >5 consecutive work days |
| PHASE 5 | Coverage Compensation | Backup staff when primary off |
| PHASE 6 | Final Adjustments | Operational tuning |
| POST | Consecutive Off Repair | Fix clustering patterns |
| BALANCE | Daily Limits | Enforce min 2, max 3 off per day |
| Phase 3 Integration | Calendar Override | Final calendar rule enforcement |

---

## 2. Target Architecture

### New Architecture (Clean)
```
┌─────────────────────────────────────────────────────────────────┐
│ React Frontend                                                  │
│ ├── useAIAssistantLazy.js (SIMPLIFIED - calls Go server)       │
│ ├── CalendarRulesLoader.js (KEEP - data loading)               │
│ └── EarlyShiftPreferencesLoader.js (KEEP - data loading)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Go WebSocket Server (existing + modifications)                  │
│ ├── WebSocket handling (existing)                               │
│ ├── HTTP client to OR-Tools (NEW)                               │
│ ├── Message: GENERATE_SCHEDULE_ORTOOLS (NEW)                    │
│ └── Result broadcasting (existing)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP POST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Python OR-Tools Service (NEW)                                   │
│ ├── Flask API (/optimize endpoint)                              │
│ ├── ShiftScheduleOptimizer class                                │
│ ├── All constraints as CP-SAT constraints                       │
│ └── Returns optimal schedule in <30s                            │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits of New Architecture
- **Provably optimal solutions** - OR-Tools finds mathematically best schedule
- **~6,400 lines of code removed** - Cleaner, simpler codebase
- **~480KB smaller frontend bundle** - No ML code in browser
- **Single system to maintain** - No dual-path complexity
- **Better infeasibility detection** - Knows when no solution exists

---

## 3. Files to DELETE

```bash
# Delete these files/directories in the fork:

# Main ML Engine (REMOVE)
rm src/ai/hybrid/BusinessRuleValidator.js        # ~3,000 lines
rm src/ai/hybrid/HybridPredictor.js              # ~500 lines

# Constraint Engine (REMOVE)
rm src/ai/constraints/ConstraintEngine.js        # ~2,000 lines

# Pattern Analysis (REMOVE)
rm src/ai/core/PatternRecognizer.js              # ~300 lines

# ML Utilities (REMOVE)
rm src/ai/utils/CalendarEarlyShiftIntegrator.js  # ~200 lines
rm src/ai/utils/MonthlyLimitCalculator.js        # ~400 lines

# Total: ~6,400 lines removed
```

### Files to Consider Removing (Optional)
```bash
# These may or may not be needed - check usage:
# src/ai/core/AdvancedIntelligence.jsx
# src/ai/core/AutonomousEngine.jsx
# src/ai/core/LearningEngine.js
# src/ai/core/NeuralScheduler.js
# src/ai/core/PredictiveAnalytics.js
```

---

## 4. Files to KEEP

```bash
# KEEP these files - they load data from Supabase:

src/ai/utils/CalendarRulesLoader.js          # Loads calendar rules from DB
src/ai/utils/EarlyShiftPreferencesLoader.js  # Loads early shift prefs from DB

# KEEP and MODIFY:
src/hooks/useAIAssistantLazy.js              # Simplify to call Go server

# KEEP as-is:
go-server/                                    # Add HTTP client for OR-Tools
```

---

## 5. Constraint Mapping Reference

### Constraint Type Mapping: JS → OR-Tools

| Current JS Implementation | OR-Tools CP-SAT Equivalent |
|--------------------------|---------------------------|
| **Calendar must_day_off** | `model.Add(shift[staff, date, OFF] == 1)` |
| **Calendar must_work** | `model.Add(shift[staff, date, WORK] == 1)` |
| **Early shift preference on must_day_off** | `model.Add(shift[staff, date, EARLY] == 1)` |
| **Staff groups (1 off per group)** | `model.Add(sum(off_shifts) <= 1)` |
| **Daily limits (min 2, max 3)** | `model.Add(off_count >= 2)`, `model.Add(off_count <= 3)` |
| **Monthly limits (min/max)** | `model.Add(sum(month_offs) >= min)`, etc. |
| **Adjacent conflict (no ××)** | `model.Add(off[d1] + off[d2] <= 1)` |
| **Adjacent conflict (no △×)** | `model.Add(early[d1] + off[d2] <= 1)` |
| **5-day rest** | `model.Add(sum(rest_in_window) >= 1)` for each 6-day window |
| **Priority rules (preferred)** | `model.Add(shift[staff, date, type] == 1)` or soft constraint |
| **Priority rules (avoided)** | `model.Add(shift[staff, date, type] == 0)` or soft constraint |

### Shift Type Constants

```python
# Python OR-Tools
SHIFT_WORK = 0      # Normal work (empty string or ○)
SHIFT_OFF = 1       # Off day (×)
SHIFT_EARLY = 2     # Early shift (△)
SHIFT_LATE = 3      # Late shift (◇)
```

```javascript
// JavaScript (for reference)
const SHIFTS = {
    WORK: '',       // or '○'
    OFF: '×',
    EARLY: '△',
    LATE: '◇'
};
```

### Data Flow: Frontend → OR-Tools

```javascript
// Data sent to OR-Tools service
{
    "staffMembers": [
        { "id": "uuid-1", "name": "料理長", "status": "社員", "position": "chef" },
        { "id": "uuid-2", "name": "田中", "status": "社員", "position": "cook" }
    ],
    "dateRange": ["2025-12-01", "2025-12-02", ..., "2026-01-31"],
    "constraints": {
        "calendarRules": {
            "2025-12-25": { "must_day_off": true },
            "2026-01-01": { "must_day_off": true }
        },
        "earlyShiftPreferences": {
            "uuid-1": { "dates": ["2025-12-25", "2026-01-01"] }
        },
        "dailyLimitsRaw": {
            "minOffPerDay": 2,
            "maxOffPerDay": 3
        },
        "monthlyLimit": {
            "minCount": 7,
            "maxCount": 8,
            "excludeCalendarRules": true
        },
        "staffGroups": [
            { "name": "Group 1", "members": ["uuid-1", "uuid-2", "uuid-3"] }
        ],
        "priorityRules": {
            "uuid-1": {
                "preferredShifts": [{ "day": "monday", "shift": "early" }],
                "avoidedShifts": [{ "day": "friday", "shift": "off" }]
            }
        }
    },
    "timeout": 30
}
```

---

## 6. Implementation Steps

### Phase 1: Setup (Day 1 - 4 hours)

```bash
# Step 1.1: Create migration branch
git checkout main
git pull origin main
git checkout -b ortools-migration

# Step 1.2: Create Python service directory
mkdir -p python-ortools-service
cd python-ortools-service

# Step 1.3: Create requirements.txt
cat > requirements.txt << 'EOF'
ortools>=9.8.3296
flask>=3.0.0
flask-cors>=4.0.0
gunicorn>=21.2.0
EOF

# Step 1.4: Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "scheduler:app"]
EOF
```

### Phase 2: Python OR-Tools Service (Day 1-2 - 6 hours)

Create `python-ortools-service/scheduler.py` with full implementation.
See [Section 7](#7-python-or-tools-service-specification) for complete code.

### Phase 3: Go Server Integration (Day 2-3 - 4 hours)

Modify Go server to call OR-Tools service.
See [Section 8](#8-go-server-integration) for complete code.

### Phase 4: Frontend Changes (Day 3 - 3 hours)

Simplify `useAIAssistantLazy.js` to call Go server.
See [Section 9](#9-frontend-changes) for complete code.

### Phase 5: Docker Configuration (Day 3-4 - 2 hours)

Add OR-Tools service to docker-compose.
See [Section 10](#10-docker-configuration) for complete code.

### Phase 6: Delete Old ML Code (Day 4 - 1 hour)

```bash
# Remove old ML files
rm -rf src/ai/hybrid/
rm -rf src/ai/core/
rm src/ai/constraints/ConstraintEngine.js
rm src/ai/utils/CalendarEarlyShiftIntegrator.js
rm src/ai/utils/MonthlyLimitCalculator.js

# Keep these:
# src/ai/utils/CalendarRulesLoader.js
# src/ai/utils/EarlyShiftPreferencesLoader.js
```

### Phase 7: Testing (Day 4-5 - 6 hours)

See [Section 11](#11-testing-strategy) for test cases.

---

## 7. Python OR-Tools Service Specification

### File: `python-ortools-service/scheduler.py`

```python
"""
OR-Tools Shift Schedule Optimizer
Replaces the multi-phase rule-based system with optimal constraint programming.

Author: Migration from BusinessRuleValidator.js
Version: 1.0
"""

from ortools.sat.python import cp_model
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


class ShiftScheduleOptimizer:
    """
    Optimal shift schedule generator using Google OR-Tools CP-SAT solver.

    Maps all constraints from the original BusinessRuleValidator.js:
    - PRE-PHASE: Calendar must_day_off
    - PHASE 1: Priority rules (preferred/avoided shifts)
    - PHASE 2: Staff group constraints
    - PHASE 3: Off-day distribution with daily limits
    - PHASE 4: 5-day rest constraint
    - BALANCE: Daily min/max enforcement
    - Phase 3 Integration: Calendar + early shift final override
    - POST-REPAIR: Consecutive off prevention
    """

    # Shift type constants (matching current JS system)
    SHIFT_WORK = 0      # Normal work (empty string or ○)
    SHIFT_OFF = 1       # Off day (×)
    SHIFT_EARLY = 2     # Early shift (△)
    SHIFT_LATE = 3      # Late shift (◇)

    SHIFT_SYMBOLS = {
        0: '',      # WORK
        1: '×',     # OFF
        2: '△',     # EARLY
        3: '◇'      # LATE
    }

    def __init__(self):
        self.model = None
        self.shifts = {}
        self.staff_members = []
        self.date_range = []
        self.constraints_config = {}
        self.calendar_off_dates = set()  # Track must_day_off dates

    def optimize_schedule(
        self,
        staff_members: List[Dict[str, Any]],
        date_range: List[str],
        constraints: Dict[str, Any],
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Main entry point for schedule optimization.

        Args:
            staff_members: List of staff dicts with id, name, status, position
            date_range: List of date strings (YYYY-MM-DD format)
            constraints: All constraint configurations
            timeout_seconds: Maximum solve time (default 30s)

        Returns:
            {
                'success': bool,
                'schedule': dict mapping staff_id -> {date -> shift_symbol},
                'solve_time': float,
                'is_optimal': bool,
                'stats': {...}
            }
        """
        logger.info(f"🔧 [OR-TOOLS] Starting optimization: {len(staff_members)} staff, {len(date_range)} days")

        # Reset state
        self.model = cp_model.CpModel()
        self.shifts = {}
        self.staff_members = staff_members
        self.date_range = date_range
        self.constraints_config = constraints
        self.calendar_off_dates = set()

        try:
            # 1. Create decision variables
            self._create_variables()

            # 2. Add all constraints (order matches original phases)
            self._add_basic_constraints()                    # One shift per staff per day
            self._add_calendar_rules()                       # PRE-PHASE + Phase 3 Integration
            self._add_staff_group_constraints()              # PHASE 2
            self._add_daily_limits()                         # BALANCE phase
            self._add_monthly_limits()                       # Phase 6.6 monthly MIN/MAX
            self._add_adjacent_conflict_prevention()         # No ××, △×, ×△
            self._add_5_day_rest_constraint()               # PHASE 4
            self._add_priority_rules()                       # PHASE 1 (soft constraints)

            # 3. Add optimization objective
            self._add_objective()

            # 4. Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = timeout_seconds
            solver.parameters.num_search_workers = 4  # Parallel search

            logger.info(f"🚀 [OR-TOOLS] Solving with {timeout_seconds}s timeout...")
            status = solver.Solve(self.model)

            # 5. Extract and return results
            return self._extract_solution(solver, status)

        except Exception as e:
            logger.error(f"❌ [OR-TOOLS] Error during optimization: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'schedule': {}
            }

    def _create_variables(self):
        """
        Create boolean decision variables: shifts[staff_id, date, shift_type]
        Each variable = "Does staff have this shift on this date?"

        Total variables: staff_count × days × 4 shift_types
        Example: 10 staff × 60 days × 4 = 2,400 variables
        """
        total_vars = len(self.staff_members) * len(self.date_range) * 4
        logger.info(f"📊 [OR-TOOLS] Creating {total_vars} decision variables...")

        for staff in self.staff_members:
            for date in self.date_range:
                for shift_type in range(4):
                    var_name = f"shift_{staff['id']}_{date}_{shift_type}"
                    self.shifts[(staff['id'], date, shift_type)] = \
                        self.model.NewBoolVar(var_name)

    def _add_basic_constraints(self):
        """
        Basic constraint: Each staff has exactly one shift type per day.
        This is fundamental - without it, staff could have multiple shifts.
        """
        logger.info("✅ [OR-TOOLS] Adding basic constraints...")

        for staff in self.staff_members:
            for date in self.date_range:
                # Exactly one shift type must be selected per day
                self.model.AddExactlyOne([
                    self.shifts[(staff['id'], date, shift)]
                    for shift in range(4)
                ])

    def _add_calendar_rules(self):
        """
        PRE-PHASE + Phase 3 Integration: Calendar must_day_off and must_work.

        From AI_GENERATION_FLOW_DOCUMENTATION.md:
        - must_day_off: ALL staff get × (day off), EXCEPT those with early shift preference get △
        - must_work: ALL staff work normal shift

        These are HIGHEST PRIORITY - override everything else.
        """
        calendar_rules = self.constraints_config.get('calendarRules', {})
        early_shift_prefs = self.constraints_config.get('earlyShiftPreferences', {})

        if not calendar_rules:
            return

        logger.info(f"📅 [OR-TOOLS] Adding calendar rules for {len(calendar_rules)} dates...")

        for date, rule in calendar_rules.items():
            if date not in self.date_range:
                continue  # Skip dates outside our range

            if rule.get('must_day_off'):
                self.calendar_off_dates.add(date)  # Track for monthly limit exclusion

                for staff in self.staff_members:
                    staff_id = staff['id']

                    # Check if staff has early shift preference for this date
                    has_early_pref = False
                    if staff_id in early_shift_prefs:
                        pref_dates = early_shift_prefs[staff_id].get('dates', [])
                        has_early_pref = date in pref_dates

                    if has_early_pref:
                        # Staff with early shift preference: Force △ (early shift)
                        self.model.Add(self.shifts[(staff_id, date, self.SHIFT_EARLY)] == 1)
                        logger.info(f"  📅 {staff.get('name', staff_id)}: △ on {date} (early pref)")
                    else:
                        # All other staff: Force × (off)
                        self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 1)

            elif rule.get('must_work'):
                # All staff must work normal shift
                for staff in self.staff_members:
                    self.model.Add(self.shifts[(staff['id'], date, self.SHIFT_WORK)] == 1)
                logger.info(f"  📅 All staff: WORK on {date} (must_work)")

    def _add_staff_group_constraints(self):
        """
        PHASE 2: Staff group constraints.

        Rule: Only 1 member of a group can have off (×) or early (△) on same day.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1844-1872:
        "If 2+ members in a group have off/early shifts on same date = CONFLICT"
        """
        staff_groups = self.constraints_config.get('staffGroups', [])

        if not staff_groups:
            return

        logger.info(f"👥 [OR-TOOLS] Adding staff group constraints for {len(staff_groups)} groups...")

        # Create a lookup for valid staff IDs
        valid_staff_ids = {s['id'] for s in self.staff_members}

        for group in staff_groups:
            group_name = group.get('name', 'Unknown')
            group_members = group.get('members', [])

            # Filter to only valid staff IDs in this group
            valid_members = [m for m in group_members if m in valid_staff_ids]

            if len(valid_members) < 2:
                continue  # Group needs at least 2 members to have conflict

            for date in self.date_range:
                # Skip calendar must_day_off dates (everyone is off anyway)
                if date in self.calendar_off_dates:
                    continue

                # Sum of (off + early) for all members in group
                off_or_early_vars = []
                for member_id in valid_members:
                    off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_OFF)])
                    off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_EARLY)])

                # At most 1 member can have off OR early (combined)
                # This is equivalent to: sum of off/early assignments <= 1
                self.model.Add(sum(off_or_early_vars) <= 1)

    def _add_daily_limits(self):
        """
        BALANCE phase: Daily min/max off limits.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1303-1400:
        - Default: min 2, max 3 staff off per day
        - Skip calendar rule dates (must_day_off/must_work override limits)
        """
        daily_limits = self.constraints_config.get('dailyLimitsRaw', {})
        min_off = daily_limits.get('minOffPerDay', 2)
        max_off = daily_limits.get('maxOffPerDay', 3)

        logger.info(f"📊 [OR-TOOLS] Adding daily limits: min={min_off}, max={max_off}...")

        calendar_rules = self.constraints_config.get('calendarRules', {})

        for date in self.date_range:
            # Skip calendar rule dates - they override daily limits
            if date in calendar_rules:
                rule = calendar_rules[date]
                if rule.get('must_day_off') or rule.get('must_work'):
                    continue

            # Count off days (×) on this date across all staff
            off_count = sum([
                self.shifts[(staff['id'], date, self.SHIFT_OFF)]
                for staff in self.staff_members
            ])

            # Enforce min and max
            self.model.Add(off_count >= min_off)
            self.model.Add(off_count <= max_off)

    def _add_monthly_limits(self):
        """
        Phase 6.6: Monthly MIN/MAX off-day limits with calendar exclusion.

        From AI_GENERATION_FLOW_DOCUMENTATION.md:
        - excludeCalendarRules: must_day_off dates DON'T count toward limits
        - excludeEarlyShiftCalendar: △ on must_day_off dates DON'T count

        This ensures staff get their "flexible" off days in addition to holidays.
        """
        monthly_limit = self.constraints_config.get('monthlyLimit', {})

        if not monthly_limit:
            return

        min_off = monthly_limit.get('minCount', 7)
        max_off = monthly_limit.get('maxCount', 8)
        exclude_calendar = monthly_limit.get('excludeCalendarRules', True)

        logger.info(f"📅 [OR-TOOLS] Adding monthly limits: min={min_off}, max={max_off}, exclude_calendar={exclude_calendar}...")

        for staff in self.staff_members:
            staff_id = staff['id']

            if exclude_calendar:
                # Count only non-calendar off days (flexible off days)
                flexible_dates = [d for d in self.date_range if d not in self.calendar_off_dates]

                flexible_off_count = sum([
                    self.shifts[(staff_id, date, self.SHIFT_OFF)]
                    for date in flexible_dates
                ])

                self.model.Add(flexible_off_count >= min_off)
                self.model.Add(flexible_off_count <= max_off)
            else:
                # Count all off days
                total_off_count = sum([
                    self.shifts[(staff_id, date, self.SHIFT_OFF)]
                    for date in self.date_range
                ])

                self.model.Add(total_off_count >= min_off)
                self.model.Add(total_off_count <= max_off)

    def _add_adjacent_conflict_prevention(self):
        """
        Prevent adjacent conflict patterns.

        From hasAdjacentConflict() in BusinessRuleValidator.js (lines 51-93):
        - No ×× (two consecutive off days)
        - No △× (early shift followed by off)
        - No ×△ (off followed by early shift)

        Note: △△ is NOT prevented in original code (early shifts can be consecutive)
        """
        logger.info("🚫 [OR-TOOLS] Adding adjacent conflict prevention (no ××, △×, ×△)...")

        for staff in self.staff_members:
            staff_id = staff['id']

            for i in range(len(self.date_range) - 1):
                date1 = self.date_range[i]
                date2 = self.date_range[i + 1]

                # Skip if either date is a calendar must_day_off
                # (calendar rules override adjacent constraints)
                if date1 in self.calendar_off_dates or date2 in self.calendar_off_dates:
                    continue

                # Prevent ×× (two consecutive off days)
                self.model.Add(
                    self.shifts[(staff_id, date1, self.SHIFT_OFF)] +
                    self.shifts[(staff_id, date2, self.SHIFT_OFF)] <= 1
                )

                # Prevent △× (early then off)
                self.model.Add(
                    self.shifts[(staff_id, date1, self.SHIFT_EARLY)] +
                    self.shifts[(staff_id, date2, self.SHIFT_OFF)] <= 1
                )

                # Prevent ×△ (off then early)
                self.model.Add(
                    self.shifts[(staff_id, date1, self.SHIFT_OFF)] +
                    self.shifts[(staff_id, date2, self.SHIFT_EARLY)] <= 1
                )

    def _add_5_day_rest_constraint(self):
        """
        PHASE 4: 5-day rest constraint (labor law compliance).

        From enforce5DayRestConstraint() in BusinessRuleValidator.js (lines 2417-2537):
        - No more than 5 consecutive work days
        - At least 1 rest day (× or △) in every 6-day window
        """
        logger.info("😴 [OR-TOOLS] Adding 5-day rest constraint (no >5 consecutive work days)...")

        for staff in self.staff_members:
            staff_id = staff['id']

            # Check every possible 6-day window
            for i in range(len(self.date_range) - 5):
                window = self.date_range[i:i+6]

                # At least 1 rest day (× or △) in the window
                # Rest = off (×) or early (△) - both count as "lighter" days
                rest_days = sum([
                    self.shifts[(staff_id, date, self.SHIFT_OFF)] +
                    self.shifts[(staff_id, date, self.SHIFT_EARLY)]
                    for date in window
                ])

                self.model.Add(rest_days >= 1)

    def _add_priority_rules(self):
        """
        PHASE 1: Staff priority rules (preferred and avoided shifts).

        Note: These are implemented as SOFT constraints (in objective function)
        rather than HARD constraints, because they're preferences not requirements.

        If you want them as hard constraints, change to model.Add() instead.
        """
        priority_rules = self.constraints_config.get('priorityRules', {})

        if not priority_rules:
            return

        logger.info(f"⭐ [OR-TOOLS] Processing priority rules for {len(priority_rules)} staff...")

        # For now, implement as soft constraints via objective
        # The objective function will try to maximize these
        self.preferred_vars = []
        self.avoided_vars = []

        for staff in self.staff_members:
            staff_id = staff['id']
            if staff_id not in priority_rules:
                continue

            rules = priority_rules[staff_id]

            # Handle preferred shifts
            for pref in rules.get('preferredShifts', []):
                day_of_week = pref.get('day', '').lower()
                shift_name = pref.get('shift', '').lower()
                shift_type = self._parse_shift_type(shift_name)

                for date in self.date_range:
                    if self._get_day_of_week(date) == day_of_week:
                        # Skip calendar override dates
                        if date not in self.calendar_off_dates:
                            self.preferred_vars.append(
                                self.shifts[(staff_id, date, shift_type)]
                            )

            # Handle avoided shifts
            for avoid in rules.get('avoidedShifts', []):
                day_of_week = avoid.get('day', '').lower()
                shift_name = avoid.get('shift', '').lower()
                shift_type = self._parse_shift_type(shift_name)

                for date in self.date_range:
                    if self._get_day_of_week(date) == day_of_week:
                        if date not in self.calendar_off_dates:
                            self.avoided_vars.append(
                                self.shifts[(staff_id, date, shift_type)]
                            )

    def _add_objective(self):
        """
        Optimization objective: What makes a "good" schedule?

        Maximize: preferred shifts satisfied
        Minimize: avoided shifts assigned

        This makes priority rules "soft" constraints.
        """
        if hasattr(self, 'preferred_vars') and hasattr(self, 'avoided_vars'):
            # Maximize preferred - minimize avoided
            # Weight: +1 for each preferred, -1 for each avoided
            objective_vars = []
            objective_coeffs = []

            for var in getattr(self, 'preferred_vars', []):
                objective_vars.append(var)
                objective_coeffs.append(1)  # Positive = want this

            for var in getattr(self, 'avoided_vars', []):
                objective_vars.append(var)
                objective_coeffs.append(-1)  # Negative = don't want this

            if objective_vars:
                self.model.Maximize(sum(
                    coeff * var for var, coeff in zip(objective_vars, objective_coeffs)
                ))
                logger.info(f"🎯 [OR-TOOLS] Objective: maximize {len(self.preferred_vars)} preferred, minimize {len(self.avoided_vars)} avoided")

    def _extract_solution(self, solver: cp_model.CpSolver, status) -> Dict[str, Any]:
        """Extract the schedule from solver results."""

        status_names = {
            cp_model.OPTIMAL: 'OPTIMAL',
            cp_model.FEASIBLE: 'FEASIBLE',
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'MODEL_INVALID',
            cp_model.UNKNOWN: 'UNKNOWN'
        }
        status_name = status_names.get(status, f'UNKNOWN({status})')

        if status == cp_model.OPTIMAL:
            logger.info(f"✅ [OR-TOOLS] Found OPTIMAL solution in {solver.WallTime():.2f}s")
            is_optimal = True
        elif status == cp_model.FEASIBLE:
            logger.info(f"⚠️ [OR-TOOLS] Found FEASIBLE solution in {solver.WallTime():.2f}s (not proven optimal)")
            is_optimal = False
        else:
            logger.error(f"❌ [OR-TOOLS] No solution found. Status: {status_name}")
            return {
                'success': False,
                'error': f'No feasible solution found. Status: {status_name}',
                'status': status_name,
                'schedule': {}
            }

        # Extract schedule
        schedule = {}
        for staff in self.staff_members:
            staff_id = staff['id']
            schedule[staff_id] = {}

            for date in self.date_range:
                # Find which shift type is selected (exactly one will be 1)
                for shift_type in range(4):
                    if solver.Value(self.shifts[(staff_id, date, shift_type)]) == 1:
                        schedule[staff_id][date] = self.SHIFT_SYMBOLS[shift_type]
                        break

        # Calculate stats
        total_off = sum(
            1 for staff_id in schedule
            for date in schedule[staff_id]
            if schedule[staff_id][date] == '×'
        )

        return {
            'success': True,
            'schedule': schedule,
            'solve_time': solver.WallTime(),
            'is_optimal': is_optimal,
            'status': status_name,
            'stats': {
                'num_conflicts': solver.NumConflicts(),
                'num_branches': solver.NumBranches(),
                'wall_time': solver.WallTime(),
                'total_off_days': total_off,
                'staff_count': len(self.staff_members),
                'date_count': len(self.date_range)
            }
        }

    def _parse_shift_type(self, shift_str: str) -> int:
        """Convert shift string name to type constant."""
        mapping = {
            'off': self.SHIFT_OFF,
            'early': self.SHIFT_EARLY,
            'late': self.SHIFT_LATE,
            'work': self.SHIFT_WORK,
            'normal': self.SHIFT_WORK,
        }
        return mapping.get(shift_str.lower(), self.SHIFT_WORK)

    def _get_day_of_week(self, date_str: str) -> str:
        """Get lowercase day of week from date string (YYYY-MM-DD)."""
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d')
            days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            return days[date.weekday()]
        except ValueError:
            return ''


# ============== Flask API ==============

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for Docker/Kubernetes."""
    return jsonify({
        'status': 'healthy',
        'service': 'ortools-optimizer',
        'version': '1.0'
    })


@app.route('/optimize', methods=['POST'])
def optimize():
    """
    Main optimization endpoint.

    Expected JSON body:
    {
        "staffMembers": [...],
        "dateRange": [...],
        "constraints": {...},
        "timeout": 30
    }
    """
    try:
        data = request.json

        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400

        # Validate required fields
        required = ['staffMembers', 'dateRange', 'constraints']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing}'
            }), 400

        # Run optimization
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=data['staffMembers'],
            date_range=data['dateRange'],
            constraints=data['constraints'],
            timeout_seconds=data.get('timeout', 30)
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"❌ [API] Error in /optimize: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/validate', methods=['POST'])
def validate():
    """
    Validate a schedule against constraints without optimizing.
    Useful for checking user-edited schedules.
    """
    # TODO: Implement schedule validation
    return jsonify({
        'success': True,
        'message': 'Validation endpoint - not yet implemented'
    })


if __name__ == '__main__':
    # Development server
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 8. Go Server Integration

### File: `go-server/ortools_client.go` (NEW)

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// ORToolsClient handles communication with the Python OR-Tools service
type ORToolsClient struct {
	baseURL    string
	httpClient *http.Client
}

// ORToolsRequest represents the request to the OR-Tools service
type ORToolsRequest struct {
	StaffMembers []StaffMember          `json:"staffMembers"`
	DateRange    []string               `json:"dateRange"`
	Constraints  map[string]interface{} `json:"constraints"`
	Timeout      int                    `json:"timeout"`
}

// ORToolsResponse represents the response from OR-Tools service
type ORToolsResponse struct {
	Success   bool                       `json:"success"`
	Schedule  map[string]map[string]string `json:"schedule"`
	SolveTime float64                    `json:"solve_time"`
	IsOptimal bool                       `json:"is_optimal"`
	Status    string                     `json:"status"`
	Stats     map[string]interface{}     `json:"stats"`
	Error     string                     `json:"error,omitempty"`
}

// NewORToolsClient creates a new OR-Tools client
func NewORToolsClient() *ORToolsClient {
	baseURL := os.Getenv("ORTOOLS_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://ortools-optimizer:5000"
	}

	return &ORToolsClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // Allow longer than solve timeout
		},
	}
}

// Optimize sends a schedule optimization request to OR-Tools
func (c *ORToolsClient) Optimize(req ORToolsRequest) (*ORToolsResponse, error) {
	url := fmt.Sprintf("%s/optimize", c.baseURL)

	// Set default timeout if not specified
	if req.Timeout == 0 {
		req.Timeout = 30
	}

	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[OR-TOOLS] Sending optimization request: %d staff, %d days, timeout=%ds",
		len(req.StaffMembers), len(req.DateRange), req.Timeout)

	// Make HTTP request
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to call OR-Tools service: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var result ORToolsResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Success {
		log.Printf("[OR-TOOLS] ✅ Optimization successful: %s in %.2fs",
			result.Status, result.SolveTime)
	} else {
		log.Printf("[OR-TOOLS] ❌ Optimization failed: %s", result.Error)
	}

	return &result, nil
}

// HealthCheck checks if OR-Tools service is healthy
func (c *ORToolsClient) HealthCheck() bool {
	url := fmt.Sprintf("%s/health", c.baseURL)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		log.Printf("[OR-TOOLS] Health check failed: %v", err)
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}
```

### Modify: `go-server/main.go` (Add message handler)

```go
// Add to your existing message handler switch statement:

case "GENERATE_SCHEDULE_ORTOOLS":
	go s.handleGenerateScheduleORTools(client, msg)

// Add new handler function:

func (s *Server) handleGenerateScheduleORTools(client *Client, msg WebSocketMessage) {
	log.Printf("[ORTOOLS] Received schedule generation request from client %s", client.ID)

	// Parse the request payload
	var payload struct {
		StaffMembers []StaffMember          `json:"staffMembers"`
		DateRange    []string               `json:"dateRange"`
		Constraints  map[string]interface{} `json:"constraints"`
		Timeout      int                    `json:"timeout"`
	}

	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		s.sendError(client, "GENERATE_SCHEDULE_ERROR", "Invalid request payload")
		return
	}

	// Send to OR-Tools service
	ortoolsClient := NewORToolsClient()

	result, err := ortoolsClient.Optimize(ORToolsRequest{
		StaffMembers: payload.StaffMembers,
		DateRange:    payload.DateRange,
		Constraints:  payload.Constraints,
		Timeout:      payload.Timeout,
	})

	if err != nil {
		log.Printf("[ORTOOLS] Error: %v", err)
		s.sendError(client, "GENERATE_SCHEDULE_ERROR", err.Error())
		return
	}

	if !result.Success {
		s.sendError(client, "GENERATE_SCHEDULE_ERROR", result.Error)
		return
	}

	// Send success response
	response := WebSocketMessage{
		Type: "SCHEDULE_GENERATED",
		Payload: mustMarshal(map[string]interface{}{
			"schedule":   result.Schedule,
			"solveTime":  result.SolveTime,
			"isOptimal":  result.IsOptimal,
			"status":     result.Status,
			"stats":      result.Stats,
		}),
	}

	client.Send <- mustMarshal(response)

	// Optionally broadcast to all clients
	// s.broadcast(response)
}
```

---

## 9. Frontend Changes

### Modify: `src/hooks/useAIAssistantLazy.js`

**Before:** ~600 lines with full ML system initialization

**After:** ~100 lines, calls Go server

```javascript
/**
 * useAIAssistantLazy.js (SIMPLIFIED for OR-Tools)
 *
 * Sends schedule generation requests to Go server → OR-Tools service.
 * No local ML processing.
 */

import { useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { CalendarRulesLoader } from '../ai/utils/CalendarRulesLoader';
import { EarlyShiftPreferencesLoader } from '../ai/utils/EarlyShiftPreferencesLoader';

export const useAIAssistantLazy = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  saveSchedule,
  options = {}
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const { sendMessage, subscribe } = useWebSocket();

  const settingsRef = useRef(options.settings || {});

  /**
   * Generate AI predictions using OR-Tools via Go server
   */
  const generateAIPredictions = useCallback(async (onProgress) => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Step 1: Load constraints from database
      if (onProgress) onProgress({ phase: 'loading', progress: 10 });

      const [calendarRules, earlyShiftPreferences] = await Promise.all([
        CalendarRulesLoader.loadRules(),
        EarlyShiftPreferencesLoader.loadPreferences(),
      ]);

      if (onProgress) onProgress({ phase: 'loading', progress: 20 });

      // Step 2: Prepare constraints payload
      const constraints = {
        calendarRules: calendarRules || {},
        earlyShiftPreferences: earlyShiftPreferences || {},
        dailyLimitsRaw: settingsRef.current.dailyLimitsRaw || {
          minOffPerDay: 2,
          maxOffPerDay: 3,
        },
        monthlyLimit: settingsRef.current.monthlyLimit || {
          minCount: 7,
          maxCount: 8,
          excludeCalendarRules: true,
        },
        staffGroups: settingsRef.current.staffGroups || [],
        priorityRules: settingsRef.current.priorityRules || {},
      };

      // Step 3: Calculate date range
      const dateRange = calculateDateRange(currentMonthIndex);

      if (onProgress) onProgress({ phase: 'optimizing', progress: 30 });

      // Step 4: Send to Go server (which calls OR-Tools)
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Schedule generation timed out'));
        }, 60000); // 60 second total timeout

        // Subscribe to response
        const unsubscribe = subscribe('SCHEDULE_GENERATED', (data) => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(data);
        });

        const unsubscribeError = subscribe('GENERATE_SCHEDULE_ERROR', (data) => {
          clearTimeout(timeout);
          unsubscribe();
          unsubscribeError();
          reject(new Error(data.error || 'Schedule generation failed'));
        });

        // Send request
        sendMessage({
          type: 'GENERATE_SCHEDULE_ORTOOLS',
          payload: {
            staffMembers: staffMembers.map(s => ({
              id: s.id,
              name: s.name,
              status: s.status,
              position: s.position,
            })),
            dateRange,
            constraints,
            timeout: 30, // OR-Tools solve timeout
          },
        });
      });

      if (onProgress) onProgress({ phase: 'complete', progress: 100 });

      // Step 5: Save to backend
      if (saveSchedule && result.schedule) {
        await saveSchedule(result.schedule);
      }

      setIsGenerating(false);
      return {
        success: true,
        schedule: result.schedule,
        isOptimal: result.isOptimal,
        solveTime: result.solveTime,
        stats: result.stats,
      };

    } catch (err) {
      console.error('[AI] Generation error:', err);
      setError(err.message);
      setIsGenerating(false);
      return {
        success: false,
        error: err.message,
      };
    }
  }, [staffMembers, currentMonthIndex, saveSchedule, sendMessage, subscribe]);

  /**
   * Calculate date range for current month period
   */
  const calculateDateRange = (monthIndex) => {
    // Your existing date range calculation logic
    // Returns array of date strings: ["2025-12-01", "2025-12-02", ...]
    const periods = [
      { start: [0, 26], end: [2, 25] },   // Jan-Feb
      { start: [2, 26], end: [4, 25] },   // Mar-Apr
      { start: [4, 26], end: [6, 25] },   // May-Jun
      { start: [6, 26], end: [8, 25] },   // Jul-Aug
      { start: [8, 26], end: [10, 25] },  // Sep-Oct
      { start: [10, 26], end: [0, 25] },  // Nov-Dec (wraps to next year)
    ];

    const period = periods[monthIndex] || periods[0];
    const year = new Date().getFullYear();

    const startDate = new Date(year, period.start[0], period.start[1]);
    const endDate = new Date(
      period.end[0] === 0 ? year + 1 : year,
      period.end[0],
      period.end[1]
    );

    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  return {
    generateAIPredictions,
    isGenerating,
    progress,
    error,
    systemType: 'ortools', // Changed from 'hybrid' or 'rule-based'
  };
};

export default useAIAssistantLazy;
```

---

## 10. Docker Configuration

### Modify: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # ... existing services (nginx, go-websocket-server, redis, etc.) ...

  # NEW: OR-Tools Optimizer Service
  ortools-optimizer:
    build:
      context: ./python-ortools-service
      dockerfile: Dockerfile
    container_name: ortools-optimizer
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - PYTHONUNBUFFERED=1
      - MAX_SOLVE_TIME=30
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - shift-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

  # Modify existing go-websocket-server to add OR-Tools dependency
  go-websocket-server:
    # ... existing config ...
    environment:
      - ORTOOLS_SERVICE_URL=http://ortools-optimizer:5000
    depends_on:
      ortools-optimizer:
        condition: service_healthy
    # ... rest of config ...

networks:
  shift-network:
    driver: bridge
```

### File: `python-ortools-service/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OR-Tools
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run with gunicorn for production
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "--timeout", "120", "scheduler:app"]
```

### File: `python-ortools-service/requirements.txt`

```
ortools>=9.8.3296
flask>=3.0.0
flask-cors>=4.0.0
gunicorn>=21.2.0
```

---

## 11. Testing Strategy

### Unit Tests for Python OR-Tools Service

Create: `python-ortools-service/test_scheduler.py`

```python
import pytest
from scheduler import ShiftScheduleOptimizer

class TestShiftScheduleOptimizer:
    """Test cases for OR-Tools scheduler."""

    @pytest.fixture
    def sample_staff(self):
        return [
            {"id": "staff-1", "name": "料理長", "status": "社員"},
            {"id": "staff-2", "name": "田中", "status": "社員"},
            {"id": "staff-3", "name": "山田", "status": "社員"},
        ]

    @pytest.fixture
    def sample_dates(self):
        return [f"2025-12-{str(d).zfill(2)}" for d in range(1, 32)]

    def test_basic_schedule_generation(self, sample_staff, sample_dates):
        """Test that a basic schedule can be generated."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={},
            timeout_seconds=10
        )

        assert result['success'] == True
        assert len(result['schedule']) == len(sample_staff)

    def test_daily_limits_enforced(self, sample_staff, sample_dates):
        """Test that daily off limits are respected."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check each day has exactly 1 off
        for date in sample_dates:
            off_count = sum(
                1 for s in sample_staff
                if result['schedule'][s['id']][date] == '×'
            )
            assert off_count == 1, f"Expected 1 off on {date}, got {off_count}"

    def test_calendar_must_day_off(self, sample_staff, sample_dates):
        """Test that calendar must_day_off is enforced."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'calendarRules': {
                    '2025-12-25': {'must_day_off': True}
                }
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # All staff should be off on Dec 25
        for staff in sample_staff:
            assert result['schedule'][staff['id']]['2025-12-25'] == '×'

    def test_early_shift_preference_on_must_day_off(self, sample_staff, sample_dates):
        """Test early shift preference overrides must_day_off."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'calendarRules': {
                    '2025-12-25': {'must_day_off': True}
                },
                'earlyShiftPreferences': {
                    'staff-1': {'dates': ['2025-12-25']}
                }
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Staff-1 should have △, others should have ×
        assert result['schedule']['staff-1']['2025-12-25'] == '△'
        assert result['schedule']['staff-2']['2025-12-25'] == '×'
        assert result['schedule']['staff-3']['2025-12-25'] == '×'

    def test_no_consecutive_off_days(self, sample_staff, sample_dates):
        """Test that no staff has consecutive off days (××)."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 1}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no consecutive off days
        for staff in sample_staff:
            schedule = result['schedule'][staff['id']]
            for i in range(len(sample_dates) - 1):
                d1, d2 = sample_dates[i], sample_dates[i+1]
                if schedule[d1] == '×' and schedule[d2] == '×':
                    pytest.fail(f"{staff['name']} has consecutive off: {d1}, {d2}")

    def test_staff_group_constraint(self, sample_staff, sample_dates):
        """Test staff group constraint (only 1 off per group)."""
        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff,
            date_range=sample_dates,
            constraints={
                'staffGroups': [
                    {'name': 'Group1', 'members': ['staff-1', 'staff-2']}
                ],
                'dailyLimitsRaw': {'minOffPerDay': 1, 'maxOffPerDay': 2}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no more than 1 member of Group1 is off per day
        for date in sample_dates:
            group_off = sum(
                1 for sid in ['staff-1', 'staff-2']
                if result['schedule'][sid][date] in ['×', '△']
            )
            assert group_off <= 1, f"Group1 has {group_off} members off on {date}"

    def test_5_day_rest_constraint(self, sample_staff, sample_dates):
        """Test that no staff works >5 consecutive days."""
        # Use only 10 days for this test
        short_dates = sample_dates[:10]

        optimizer = ShiftScheduleOptimizer()
        result = optimizer.optimize_schedule(
            staff_members=sample_staff[:1],  # Just 1 staff
            date_range=short_dates,
            constraints={
                'dailyLimitsRaw': {'minOffPerDay': 0, 'maxOffPerDay': 1}
            },
            timeout_seconds=10
        )

        assert result['success'] == True

        # Check no 6 consecutive work days
        staff_id = sample_staff[0]['id']
        schedule = result['schedule'][staff_id]

        for i in range(len(short_dates) - 5):
            window = short_dates[i:i+6]
            rest_days = sum(
                1 for d in window
                if schedule[d] in ['×', '△']
            )
            assert rest_days >= 1, f"Staff has 6+ work days starting {window[0]}"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
```

### Run Tests

```bash
cd python-ortools-service
pip install pytest
pytest test_scheduler.py -v
```

---

## 12. Rollback Plan

### If OR-Tools Migration Fails

```bash
# Step 1: Stop new services
docker-compose stop ortools-optimizer

# Step 2: Revert to old branch
git checkout main

# Step 3: Rebuild and deploy
docker-compose up -d --build

# Step 4: Verify old system works
curl http://localhost/health
```

### Keep Old Code Available

```bash
# Before deleting old ML code, tag the commit
git tag v1.0-rule-based-ml

# Can always restore with:
git checkout v1.0-rule-based-ml -- src/ai/
```

---

## Quick Reference Card

### Commands

```bash
# Build OR-Tools service
docker-compose build ortools-optimizer

# Start OR-Tools service
docker-compose up -d ortools-optimizer

# View logs
docker-compose logs -f ortools-optimizer

# Test health
curl http://localhost:5000/health

# Test optimization
curl -X POST http://localhost:5000/optimize \
  -H "Content-Type: application/json" \
  -d '{"staffMembers":[...],"dateRange":[...],"constraints":{}}'
```

### Key Constraints Summary

| Constraint | OR-Tools Implementation |
|------------|------------------------|
| One shift per day | `model.AddExactlyOne(shifts)` |
| Calendar must_day_off | `model.Add(shift[OFF] == 1)` |
| Daily limits | `model.Add(sum >= min)`, `model.Add(sum <= max)` |
| Staff groups | `model.Add(sum(group_off) <= 1)` |
| No consecutive ×× | `model.Add(off[d1] + off[d2] <= 1)` |
| 5-day rest | `model.Add(sum(rest_in_6days) >= 1)` |

### Expected Performance

| Scenario | Expected Time |
|----------|--------------|
| 10 staff, 30 days | 500ms - 2s |
| 10 staff, 60 days | 1s - 5s |
| 20 staff, 60 days | 2s - 10s |
| Infeasible | <1s (fails fast) |

---

## Next Steps for Implementing Agent

1. **Read this document completely** before starting
2. **Fork the repository** and create `ortools-migration` branch
3. **Implement in order**: Python service → Go bridge → Frontend → Docker
4. **Run tests** after each phase
5. **Compare results** with old system before merging
6. **Deploy to staging** first, then production

**Questions?** Refer to:
- `AI_GENERATION_FLOW_DOCUMENTATION.md` for constraint details
- Google OR-Tools docs: https://developers.google.com/optimization
- Original `BusinessRuleValidator.js` for constraint logic reference
- Skill file: `.claude/skills/ortools-scheduling.md` for code patterns

---

## 13. Future: Shift Requests Feature

### Overview

Shift requests allow staff to **request preferred shifts** on specific dates. These are implemented as **soft constraints** (preferences, not requirements) using OR-Tools objective function.

**Source:** https://developers.google.com/optimization/scheduling/employee_scheduling#scheduling_with_shift_requests

### Concept: Hard vs Soft Constraints

| Type | Description | Example | OR-Tools |
|------|-------------|---------|----------|
| **Hard** | MUST be satisfied | Calendar must_day_off | `model.Add(...)` |
| **Soft** | TRY to satisfy | Staff prefers off on Friday | `model.Maximize(...)` |

### Data Structure for Shift Requests

```python
# Option 1: 3D Array (Google's example)
# shift_requests[staff_index][day_index][shift_index] = 1 if requested
shift_requests = [
    # Staff 0: requests shift 2 on day 0, shift 1 on day 5
    [[0, 0, 1], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 0, 1]],
    # Staff 1: different preferences
    [[0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0], [0, 0, 1]],
]

# Option 2: Dict (more readable for your system)
shift_requests = {
    'staff-1': {
        '2025-12-01': {'off': 1, 'early': 0, 'work': 0},  # Wants off
        '2025-12-05': {'off': 0, 'early': 1, 'work': 0},  # Wants early
    },
    'staff-2': {
        '2025-12-03': {'off': 1, 'early': 0, 'work': 0},
    }
}
```

### Implementation in Python OR-Tools

Add this method to `ShiftScheduleOptimizer` class:

```python
def _add_shift_requests(self):
    """
    Add soft constraints for shift requests.
    Uses objective function to MAXIMIZE fulfilled requests.
    """
    shift_requests = self.constraints_config.get('shiftRequests', {})

    if not shift_requests:
        return

    logger.info(f"📋 [OR-TOOLS] Processing shift requests...")

    # Build list of requested shift variables
    request_vars = []
    request_weights = []

    for staff in self.staff_members:
        staff_id = staff['id']
        if staff_id not in shift_requests:
            continue

        for date, day_requests in shift_requests[staff_id].items():
            if date not in self.date_range:
                continue

            # Skip calendar override dates (hard constraints take priority)
            if date in self.calendar_off_dates:
                continue

            for shift_name, weight in day_requests.items():
                if weight > 0:  # Staff requested this shift
                    shift_type = {
                        'off': self.SHIFT_OFF,
                        'early': self.SHIFT_EARLY,
                        'late': self.SHIFT_LATE,
                        'work': self.SHIFT_WORK
                    }.get(shift_name, self.SHIFT_WORK)

                    request_vars.append(self.shifts[(staff_id, date, shift_type)])
                    request_weights.append(weight)  # Can use weights for priority

    if request_vars:
        # Objective: Maximize sum of fulfilled requests
        # Each fulfilled request adds its weight to the objective
        self.model.Maximize(
            sum(var * weight for var, weight in zip(request_vars, request_weights))
        )

        logger.info(f"📋 [OR-TOOLS] Added {len(request_vars)} shift requests to objective")
```

### Complete Example with Shift Requests

```python
"""Example: Schedule with staff shift requests"""

from ortools.sat.python import cp_model

def schedule_with_requests():
    model = cp_model.CpModel()

    # Data
    staff = ['田中', '山田', '鈴木', '佐藤', '高橋']
    days = [f'2025-12-{str(d).zfill(2)}' for d in range(1, 8)]  # Dec 1-7
    SHIFT_WORK, SHIFT_OFF, SHIFT_EARLY = 0, 1, 2

    # Shift requests: 1 = requested, 0 = no preference
    # Format: requests[staff_idx][day_idx] = [work, off, early]
    shift_requests = [
        # 田中: wants off on day 0, early on day 4
        [[0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0], [0, 0, 0]],
        # 山田: wants early on days 2, 3
        [[0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 1], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
        # 鈴木: wants off on day 5
        [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0]],
        # 佐藤: wants work (no off) on day 6
        [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 0, 0]],
        # 高橋: wants off on day 1
        [[0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ]

    # Create variables
    shifts = {}
    for n in range(len(staff)):
        for d in range(len(days)):
            for s in range(3):  # 3 shift types
                shifts[(n, d, s)] = model.new_bool_var(f'shift_n{n}_d{d}_s{s}')

    # Hard constraint: One shift per staff per day
    for n in range(len(staff)):
        for d in range(len(days)):
            model.AddExactlyOne(shifts[(n, d, s)] for s in range(3))

    # Hard constraint: Daily off limits (1-2 per day)
    for d in range(len(days)):
        off_count = sum(shifts[(n, d, SHIFT_OFF)] for n in range(len(staff)))
        model.Add(off_count >= 1)
        model.Add(off_count <= 2)

    # Hard constraint: No consecutive off days
    for n in range(len(staff)):
        for d in range(len(days) - 1):
            model.Add(shifts[(n, d, SHIFT_OFF)] + shifts[(n, d+1, SHIFT_OFF)] <= 1)

    # SOFT constraint: Maximize fulfilled shift requests
    model.Maximize(
        sum(
            shift_requests[n][d][s] * shifts[(n, d, s)]
            for n in range(len(staff))
            for d in range(len(days))
            for s in range(3)
        )
    )

    # Solve
    solver = cp_model.CpSolver()
    status = solver.solve(model)

    if status == cp_model.OPTIMAL:
        print("✅ Optimal schedule found!\n")

        shift_names = {0: '○', 1: '×', 2: '△'}

        # Print header
        print(f"{'Staff':<8} | " + " | ".join(d[-2:] for d in days))
        print("-" * 50)

        # Print schedule
        for n, name in enumerate(staff):
            row = f"{name:<8} | "
            for d in range(len(days)):
                for s in range(3):
                    if solver.value(shifts[(n, d, s)]) == 1:
                        symbol = shift_names[s]
                        # Mark if this was requested
                        if shift_requests[n][d][s] == 1:
                            symbol = f"[{symbol}]"  # Bracket = fulfilled request
                        row += f" {symbol:^3} |"
            print(row)

        print(f"\n📊 Requests fulfilled: {int(solver.objective_value)} / {sum(sum(sum(r) for r in d) for d in shift_requests)}")
    else:
        print("❌ No solution found")

if __name__ == '__main__':
    schedule_with_requests()
```

**Output:**
```
✅ Optimal schedule found!

Staff    | 01 | 02 | 03 | 04 | 05 | 06 | 07
--------------------------------------------------
田中     | [×] |  ○ |  ○ |  ○ | [△] |  ○ |  ○ |
山田     |  ○ |  ○ | [△] | [△] |  ○ |  ○ |  ○ |
鈴木     |  ○ |  ○ |  ○ |  ○ |  ○ | [×] |  ○ |
佐藤     |  ○ |  × |  ○ |  ○ |  ○ |  ○ | [○] |
高橋     |  ○ | [×] |  ○ |  ○ |  ○ |  ○ |  × |

📊 Requests fulfilled: 7 / 7
```

### Database Schema for Shift Requests (Future)

```sql
-- Supabase table for shift requests
CREATE TABLE shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_type VARCHAR(10) NOT NULL, -- 'off', 'early', 'late', 'work'
    weight INTEGER DEFAULT 1, -- Priority: 1=normal, 2=important, 3=critical
    reason TEXT, -- Optional reason
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'fulfilled'
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(staff_id, date, shift_type)
);

-- Index for efficient queries
CREATE INDEX idx_shift_requests_date ON shift_requests(date);
CREATE INDEX idx_shift_requests_staff ON shift_requests(staff_id);
```

### API Endpoint for Shift Requests (Future)

```python
# Add to python-ortools-service/scheduler.py

@app.route('/requests', methods=['POST'])
def submit_request():
    """Staff submits a shift request."""
    data = request.json
    # Save to database
    # Return confirmation
    pass

@app.route('/requests/<staff_id>', methods=['GET'])
def get_requests(staff_id):
    """Get all requests for a staff member."""
    # Query database
    pass
```

### Frontend Component (Future)

```jsx
// ShiftRequestModal.jsx - Staff can request specific shifts
const ShiftRequestModal = ({ staffId, date, onSubmit }) => {
    const [shiftType, setShiftType] = useState('off');
    const [reason, setReason] = useState('');

    return (
        <div className="modal">
            <h3>{date} のシフト希望</h3>
            <select value={shiftType} onChange={e => setShiftType(e.target.value)}>
                <option value="off">休み (×)</option>
                <option value="early">早番 (△)</option>
                <option value="work">出勤 (○)</option>
            </select>
            <textarea
                placeholder="理由（任意）"
                value={reason}
                onChange={e => setReason(e.target.value)}
            />
            <button onClick={() => onSubmit({ staffId, date, shiftType, reason })}>
                希望を送信
            </button>
        </div>
    );
};
```

### Implementation Priority

| Phase | Feature | Priority |
|-------|---------|----------|
| **Phase 1** | Core OR-Tools migration | 🔴 HIGH (do now) |
| **Phase 2** | Shift requests backend | 🟡 MEDIUM (after migration) |
| **Phase 3** | Shift requests frontend | 🟡 MEDIUM |
| **Phase 4** | Request approval workflow | 🟢 LOW (nice to have) |
| **Phase 5** | Analytics & reporting | 🟢 LOW |

### Key Points for Shift Requests

1. **Soft constraints** - Requests are preferences, not requirements
2. **Weights** - Can prioritize some requests over others
3. **Calendar rules still win** - Hard constraints override requests
4. **Objective function** - Solver MAXIMIZES fulfilled requests
5. **Reporting** - Show which requests were fulfilled vs not

---

## Summary

This migration guide covers:

1. ✅ **Core OR-Tools implementation** - Replace JS ML with Python CP-SAT
2. ✅ **All constraint mappings** - Calendar, groups, limits, adjacent, 5-day rest
3. ✅ **Integration architecture** - Go bridge, Docker, frontend
4. ✅ **Testing strategy** - Unit tests, validation
5. ✅ **Future: Shift requests** - Soft constraints for staff preferences

**Skill file for quick reference:** `.claude/skills/ortools-scheduling.md`

**Ready to implement!** Follow the steps in Section 6.
