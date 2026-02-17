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
    SHIFT_WORK = 0      # Normal work (empty string or maru)
    SHIFT_OFF = 1       # Off day (batsu)
    SHIFT_EARLY = 2     # Early shift (sankaku)
    SHIFT_LATE = 3      # Late shift (diamond)

    SHIFT_SYMBOLS = {
        0: '',      # WORK
        1: '\u00d7',     # OFF (multiplication sign)
        2: '\u25b3',     # EARLY (triangle)
        3: '\u25c7'      # LATE (diamond)
    }

    # Symbol to shift type mapping (for pre-filled cells)
    # Maps UI symbols to internal shift type constants
    # Note: Stars and special symbols are treated as WORK (normal shift) variants
    SYMBOL_TO_SHIFT = {
        # OFF symbols (×)
        '\u00d7': 1,     # × (multiplication sign) -> OFF
        '×': 1,          # × (batsu) -> OFF
        'x': 1,          # x (lowercase) -> OFF
        'X': 1,          # X (uppercase) -> OFF
        # EARLY symbols (△)
        '\u25b3': 2,     # △ (triangle) -> EARLY
        '△': 2,          # △ (sankaku) -> EARLY
        's': 2,          # s (early shorthand) -> EARLY
        'S': 2,          # S (early shorthand) -> EARLY
        # LATE symbols (◇)
        '\u25c7': 3,     # ◇ (diamond) -> LATE
        '◇': 3,          # ◇ (diamond) -> LATE
        # WORK symbols (○ and variants)
        '\u25cb': 0,     # ○ (maru) -> WORK
        '○': 0,          # ○ (maru) -> WORK
        '': 0,           # empty -> WORK
        # Special/Star symbols - treated as WORK (preserves the symbol but counts as working)
        '★': 0,          # Black star -> WORK
        '\u2605': 0,     # ★ (black star unicode) -> WORK
        '☆': 0,          # White star -> WORK
        '\u2606': 0,     # ☆ (white star unicode) -> WORK
        '●': 0,          # Black circle -> WORK
        '\u25cf': 0,     # ● (black circle unicode) -> WORK
        '◎': 0,          # Double circle -> WORK
        '\u25ce': 0,     # ◎ (bullseye unicode) -> WORK
        '▣': 0,          # Square with fill -> WORK
        '\u25a3': 0,     # ▣ (white square containing black small square) -> WORK
        '⊘': 0,          # Circled division slash -> WORK
        '\u2298': 0,     # ⊘ (circled division slash unicode) -> WORK
    }

    def __init__(self):
        self.model = None
        self.shifts = {}
        self.staff_members = []
        self.date_range = []
        self.constraints_config = {}
        self.calendar_off_dates = set()  # Track must_day_off dates
        self.calendar_work_dates = set()  # Track must_work dates (for skipping priority rules)
        self.prefilled_cells = set()  # Track pre-filled cells (staff_id, date) for reference
        self.prefilled_star_equiv_by_staff = {}  # Track ★ symbols per staff for monthly limits (★ is WORK but counts as off-equivalent)
        self.backup_unavailable_slots = {}  # Track (staff_id, date) -> any_member_off bool var for backup unavailability
        self.backup_staff_ids = set()  # Track backup staff IDs (exempt from monthly limits)
        self.staff_end_dates = {}  # Track staff end dates: staff_id -> end_date string (YYYY-MM-DD)
        self.staff_start_dates = {}  # Track staff start dates: staff_id -> start_date string (YYYY-MM-DD)

        # Soft constraint violation tracking (penalty-based like TensorFlow)
        self.violation_vars = []  # List of (violation_var, weight, description)

        # Default penalty weights for soft constraints (can be overridden via constraints)
        # Higher = more important to satisfy
        self.DEFAULT_PENALTY_WEIGHTS = {
            'staff_group': 100,      # High penalty for staff group violations
            'daily_limit': 50,       # Medium penalty for daily limit violations (min)
            'daily_limit_max': 50,   # Medium penalty for daily max violations
            'monthly_limit': 80,     # High penalty for monthly limits
            'adjacent_conflict': 30, # Lower penalty for adjacent conflicts
            '5_day_rest': 200,       # Very high for labor law compliance
            'staff_type_limit': 60,  # Medium-high penalty for per-type limits
            'backup_coverage': 500,  # HIGHEST priority for backup staff coverage (critical for operations)
            'staff_status_shift': 150,  # Very high penalty for 派遣/パート getting early/late shifts
        }

        # Active penalty weights (starts as defaults, can be overridden)
        self.PENALTY_WEIGHTS = self.DEFAULT_PENALTY_WEIGHTS.copy()

        # Solver settings (configurable)
        self.num_workers = 4  # Default number of parallel search workers

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
        logger.info(f"[OR-TOOLS] Starting optimization: {len(staff_members)} staff, {len(date_range)} days")

        # Enhanced logging for debugging data flow issues
        logger.info("=" * 60)
        logger.info("[OR-TOOLS] CONSTRAINT DATA RECEIVED:")
        logger.info(f"  calendarRules: {len(constraints.get('calendarRules', {}))} dates")
        logger.info(f"  earlyShiftPreferences: {len(constraints.get('earlyShiftPreferences', {}))} staff")
        logger.info(f"  staffGroups: {len(constraints.get('staffGroups', []))} groups")
        priority_rules = constraints.get('priorityRules', [])
        if isinstance(priority_rules, list):
            logger.info(f"  priorityRules: {len(priority_rules)} rules (array format)")
        elif isinstance(priority_rules, dict):
            logger.info(f"  priorityRules: {len(priority_rules)} staff (object format)")
        else:
            logger.info(f"  priorityRules: 0 (invalid format: {type(priority_rules)})")
        logger.info(f"  dailyLimitsRaw: {constraints.get('dailyLimitsRaw', {})}")
        logger.info(f"  monthlyLimit: {constraints.get('monthlyLimit', {})}")
        staff_type_limits = constraints.get('staffTypeLimits', {})
        if staff_type_limits:
            logger.info(f"  staffTypeLimits: {len(staff_type_limits)} types configured")
            for stype, limits in staff_type_limits.items():
                logger.info(f"    - {stype}: maxOff={limits.get('maxOff')}, maxEarly={limits.get('maxEarly')}, isHard={limits.get('isHard', True)}")
        else:
            logger.info("  staffTypeLimits: (none configured)")

        # Log pre-filled schedule info
        prefilled = constraints.get('prefilledSchedule', {})
        if prefilled:
            total_prefilled = sum(len(dates) for dates in prefilled.values() if isinstance(dates, dict))
            logger.info(f"  🔒 prefilledSchedule: {total_prefilled} cells across {len(prefilled)} staff (HARD constraints)")
        else:
            logger.info("  prefilledSchedule: (none - generating full schedule)")

        # Log backup assignments
        backup_assignments = constraints.get('backupAssignments', [])
        if backup_assignments:
            logger.info(f"  🛡️ backupAssignments: {len(backup_assignments)} assignments")
            for ba in backup_assignments[:3]:  # Show first 3
                logger.info(f"    - staffId={ba.get('staffId')}, groupId={ba.get('groupId')}, isActive={ba.get('isActive', True)}")
            if len(backup_assignments) > 3:
                logger.info(f"    ... and {len(backup_assignments) - 3} more")
        else:
            logger.info("  backupAssignments: (none)")
        logger.info("=" * 60)

        # Reset state
        self.model = cp_model.CpModel()
        self.shifts = {}
        self.staff_members = staff_members
        self.date_range = date_range
        self.constraints_config = constraints
        self.calendar_off_dates = set()
        self.prefilled_cells = set()  # Reset pre-filled cells tracking
        self.prefilled_star_equiv_by_staff = {}  # Reset star equivalent tracking
        self.backup_unavailable_slots = {}  # Reset backup unavailable slots tracking
        self.violation_vars = []  # Reset violation tracking

        # ═══════════════════════════════════════════════════════════════════════════
        # Parse staff end_period dates for employment termination handling
        # Staff with end_period within the schedule period will:
        # 1. Have no shifts assigned after end_period (cells left empty)
        # 2. Have prorated monthly limits based on actual working days
        # ═══════════════════════════════════════════════════════════════════════════
        self.staff_end_dates = {}
        for staff in staff_members:
            end_period = staff.get('end_period') or staff.get('endPeriod')
            if end_period and isinstance(end_period, dict):
                year = end_period.get('year')
                month = end_period.get('month')
                day = end_period.get('day', 1)  # Default to 1st if no day specified
                if year and month:
                    end_date_str = f"{year}-{int(month):02d}-{int(day):02d}"
                    self.staff_end_dates[staff['id']] = end_date_str
                    logger.info(f"  📅 Staff {staff.get('name', staff['id'])}: end_period={end_date_str}")

        if self.staff_end_dates:
            logger.info(f"[OR-TOOLS] 📅 {len(self.staff_end_dates)} staff with end_period dates parsed")

        # ═══════════════════════════════════════════════════════════════════════════
        # Parse staff start_period dates for new employee handling
        # Staff with start_period after the schedule start will:
        # 1. Have no shifts assigned before start_period (cells left empty)
        # 2. Have prorated monthly limits based on actual working days
        # ═══════════════════════════════════════════════════════════════════════════
        self.staff_start_dates = {}
        for staff in staff_members:
            start_period = staff.get('start_period') or staff.get('startPeriod')
            # Debug: Log what we're receiving
            logger.info(f"  🔍 Staff {staff.get('name', staff.get('id', '?'))}: start_period={start_period}, keys={list(staff.keys())}")
            if start_period and isinstance(start_period, dict):
                year = start_period.get('year')
                month = start_period.get('month')
                day = start_period.get('day', 1)  # Default to 1st if no day specified
                if year and month:
                    start_date_str = f"{year}-{int(month):02d}-{int(day):02d}"
                    # Only track if start_period is within or after schedule range
                    # FIX: Use >= to include staff starting exactly on the first day
                    if len(self.date_range) > 0 and start_date_str >= self.date_range[0]:
                        self.staff_start_dates[staff['id']] = start_date_str
                        logger.info(f"  🆕 Staff {staff.get('name', staff['id'])}: start_period={start_date_str}")

        if self.staff_start_dates:
            logger.info(f"[OR-TOOLS] 🆕 {len(self.staff_start_dates)} staff with start_period dates parsed")

        # Load custom penalty weights and solver settings if provided
        ortools_config = constraints.get('ortoolsConfig', {})
        custom_weights = ortools_config.get('penaltyWeights', {})

        # Map camelCase keys from frontend to snake_case used internally
        self.PENALTY_WEIGHTS = {
            'staff_group': custom_weights.get('staffGroup', self.DEFAULT_PENALTY_WEIGHTS['staff_group']),
            'daily_limit': custom_weights.get('dailyLimitMin', self.DEFAULT_PENALTY_WEIGHTS['daily_limit']),
            'daily_limit_max': custom_weights.get('dailyLimitMax', self.DEFAULT_PENALTY_WEIGHTS['daily_limit_max']),
            'monthly_limit': custom_weights.get('monthlyLimit', self.DEFAULT_PENALTY_WEIGHTS['monthly_limit']),
            'adjacent_conflict': custom_weights.get('adjacentConflict', self.DEFAULT_PENALTY_WEIGHTS['adjacent_conflict']),
            '5_day_rest': custom_weights.get('fiveDayRest', self.DEFAULT_PENALTY_WEIGHTS['5_day_rest']),
            'staff_type_limit': custom_weights.get('staffTypeLimit', self.DEFAULT_PENALTY_WEIGHTS['staff_type_limit']),
            'backup_coverage': custom_weights.get('backupCoverage', self.DEFAULT_PENALTY_WEIGHTS['backup_coverage']),
        }

        # Load solver settings
        solver_settings = ortools_config.get('solverSettings', {})
        if 'timeout' in solver_settings:
            timeout_seconds = solver_settings['timeout']
        if 'numWorkers' in solver_settings:
            self.num_workers = solver_settings['numWorkers']
        else:
            self.num_workers = 4  # Default

        logger.info(f"[OR-TOOLS] Using penalty weights: {self.PENALTY_WEIGHTS}")
        logger.info(f"[OR-TOOLS] Solver settings: timeout={timeout_seconds}s, workers={self.num_workers}")

        try:
            # 1. Create decision variables
            self._create_variables()

            # 2. Add all constraints (order matches original phases)
            self._add_basic_constraints()                    # One shift per staff per day
            self._add_prefilled_constraints()                # PRE-PHASE: Lock user-edited cells as HARD constraints
            self._add_calendar_rules()                       # PRE-PHASE + Phase 3 Integration
            self._add_backup_staff_constraints()             # Backup staff can never have off days
            self._add_staff_status_shift_restrictions()      # 派遣/パート can only have work/off shifts
            self._add_staff_group_constraints()              # PHASE 2
            self._add_daily_limits()                         # BALANCE phase
            self._add_staff_type_daily_limits()             # Per-staff-type daily limits
            self._compute_priority_rule_off_equivalent()    # Pre-compute priority rule consumption (MUST be before monthly limits)
            self._add_monthly_limits()                       # Phase 6.6 monthly MIN/MAX (uses priority rule consumption)
            self._add_monthly_early_shift_limits()           # Max 3 early shifts per month for 社員
            self._add_adjacent_conflict_prevention()         # No xx, sx, xs
            self._add_5_day_rest_constraint()               # PHASE 4
            self._add_post_period_constraints()              # Post day-off period constraints
            self._add_priority_rules()                       # PHASE 1 (soft constraints)

            # 3. Add optimization objective
            self._add_objective()

            # 4. Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = timeout_seconds
            solver.parameters.num_search_workers = self.num_workers  # Use configurable workers

            # Add random seed to generate different solutions on each run
            # This allows multiple valid schedules instead of always returning the same one
            import random
            import time
            random_seed = int(time.time() * 1000) % 2147483647  # Use timestamp as seed (max int32)
            solver.parameters.random_seed = random_seed

            logger.info(f"[OR-TOOLS] Solving with {timeout_seconds}s timeout, {self.num_workers} workers, seed={random_seed}...")
            status = solver.Solve(self.model)

            # 5. Extract and return results
            return self._extract_solution(solver, status)

        except Exception as e:
            logger.error(f"[OR-TOOLS] Error during optimization: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'schedule': {}
            }

    def _staff_works_on_date(self, staff_id: str, date: str) -> bool:
        """
        Check if staff is employed on this date (within start_period and end_period).

        Args:
            staff_id: The staff member's ID
            date: Date string in YYYY-MM-DD format

        Returns:
            True if staff is employed on this date, False if before start_period or after end_period
        """
        # Check start_period: staff hasn't started yet
        start_date = self.staff_start_dates.get(staff_id)
        if start_date and date < start_date:
            return False

        # Check end_period: staff has already left
        end_date = self.staff_end_dates.get(staff_id)
        if end_date and date > end_date:
            return False

        return True

    def _get_shift_var(self, staff_id: str, date: str, shift_type: int):
        """
        Safely get a shift variable, returning None if it doesn't exist.

        This prevents KeyError when accessing shifts for staff who don't work
        on certain dates (due to start_period or end_period).

        Args:
            staff_id: The staff member's ID
            date: Date string in YYYY-MM-DD format
            shift_type: 0=WORK, 1=OFF, 2=EARLY, 3=LATE

        Returns:
            The shift variable if it exists, None otherwise
        """
        key = (staff_id, date, shift_type)
        return self.shifts.get(key)

    def _has_shift_var(self, staff_id: str, date: str, shift_type: int = None) -> bool:
        """
        Check if shift variable(s) exist for a staff/date combination.

        Args:
            staff_id: The staff member's ID
            date: Date string in YYYY-MM-DD format
            shift_type: Optional specific shift type. If None, checks if ANY shift var exists.

        Returns:
            True if the shift variable(s) exist
        """
        if shift_type is not None:
            return (staff_id, date, shift_type) in self.shifts
        # Check if any shift type exists for this staff/date
        return (staff_id, date, 0) in self.shifts

    def _create_variables(self):
        """
        Create boolean decision variables: shifts[staff_id, date, shift_type]
        Each variable = "Does staff have this shift on this date?"

        Total variables: staff_count x days x 4 shift_types
        Example: 10 staff x 60 days x 4 = 2,400 variables

        IMPORTANT: Skip creating variables for dates after staff's end_period.
        This leaves those cells empty in the final schedule.
        """
        skipped_count = 0
        created_count = 0

        for staff in self.staff_members:
            staff_id = staff['id']
            for date in self.date_range:
                # Skip dates after staff's end_period (leave cells empty)
                if not self._staff_works_on_date(staff_id, date):
                    skipped_count += 4  # Would have created 4 variables
                    continue

                for shift_type in range(4):
                    var_name = f"shift_{staff_id}_{date}_{shift_type}"
                    self.shifts[(staff_id, date, shift_type)] = \
                        self.model.NewBoolVar(var_name)
                    created_count += 1

        logger.info(f"[OR-TOOLS] Created {created_count} decision variables (skipped {skipped_count} for staff past end_period)")

    def _add_basic_constraints(self):
        """
        Basic constraint: Each staff has exactly one shift type per day.
        This is fundamental - without it, staff could have multiple shifts.

        IMPORTANT: Skip dates after staff's end_period (no variables exist).
        """
        logger.info("[OR-TOOLS] Adding basic constraints...")

        for staff in self.staff_members:
            staff_id = staff['id']
            for date in self.date_range:
                # Skip dates after staff's end_period (no variables exist)
                if not self._staff_works_on_date(staff_id, date):
                    continue

                # Exactly one shift type must be selected per day
                self.model.AddExactlyOne([
                    self.shifts[(staff_id, date, shift)]
                    for shift in range(4)
                ])

    def _add_prefilled_constraints(self):
        """
        PRE-PHASE: Lock user-edited cells as HARD constraints.

        This implements the "fill the rest" workflow where managers can:
        1. Enter staff day-off requests (e.g., × on specific dates)
        2. Mark special assignments (e.g., ★ for specific duties)
        3. Run AI generation to fill remaining empty cells

        Pre-filled cells become HARD constraints - they will NOT be changed
        by the optimizer. This mimics the manual scheduling workflow where
        the manager's pre-entries are always respected.

        Data format from React (useAIAssistantLazy.js):
        {
            'prefilledSchedule': {
                'staff-uuid-1': {
                    '2024-01-15': '×',
                    '2024-01-20': '△'
                },
                'staff-uuid-2': {
                    '2024-01-18': '★'
                }
            }
        }

        Symbol mapping:
        - × (batsu) -> OFF (SHIFT_OFF = 1)
        - △ (sankaku) -> EARLY (SHIFT_EARLY = 2)
        - ◇ (diamond) -> LATE (SHIFT_LATE = 3)
        - ○, ★, ●, ◎, etc. -> WORK (SHIFT_WORK = 0)
        """
        prefilled = self.constraints_config.get('prefilledSchedule', {})

        if not prefilled:
            logger.info("[OR-TOOLS] No pre-filled cells provided (generating full schedule)")
            return

        # ═══════════════════════════════════════════════════════════════════════════
        # CRITICAL FIX: Identify backup staff IDs BEFORE processing pre-filled cells
        # Backup staff schedules are determined ONLY by coverage constraints,
        # NOT by pre-filled values. This prevents conflicts with backup coverage HARD constraints.
        # ═══════════════════════════════════════════════════════════════════════════
        backup_assignments = self.constraints_config.get('backupAssignments', [])
        backup_staff_ids_early = set()
        for assignment in backup_assignments:
            if assignment.get('isActive', True):
                staff_id = assignment.get('staffId') or assignment.get('staff_id')
                if staff_id:
                    backup_staff_ids_early.add(staff_id)

        if backup_staff_ids_early:
            logger.info(f"[OR-TOOLS] 🛡️ {len(backup_staff_ids_early)} backup staff will be EXCLUDED from pre-filled constraints")
            logger.info(f"[OR-TOOLS]    (Backup schedules determined by coverage constraints, not pre-filled values)")

        # Create lookup for valid staff IDs
        valid_staff_ids = {s['id'] for s in self.staff_members}
        valid_dates = set(self.date_range)

        constraint_count = 0
        skipped_count = 0
        backup_skipped_count = 0
        unknown_symbols = set()

        # Track pre-filled cells for use in solution extraction
        prefilled_symbols = {}  # (staff_id, date) -> original_symbol

        logger.info(f"[OR-TOOLS] 🔒 Adding pre-filled constraints (HARD) for {len(prefilled)} staff members...")

        for staff_id, dates in prefilled.items():
            # ═══════════════════════════════════════════════════════════════════════════
            # CRITICAL: Skip backup staff - their schedule is determined by coverage constraints
            # ═══════════════════════════════════════════════════════════════════════════
            if staff_id in backup_staff_ids_early:
                backup_skipped_count += len(dates) if isinstance(dates, dict) else 0
                continue

            # Skip if staff not in current schedule
            if staff_id not in valid_staff_ids:
                logger.warning(f"  Skipping unknown staff_id: {staff_id}")
                skipped_count += len(dates) if isinstance(dates, dict) else 0
                continue

            if not isinstance(dates, dict):
                logger.warning(f"  Skipping invalid dates format for staff {staff_id}: {type(dates)}")
                continue

            for date, symbol in dates.items():
                # Skip if date not in current range
                if date not in valid_dates:
                    skipped_count += 1
                    continue

                # Skip empty symbols
                if not symbol or (isinstance(symbol, str) and symbol.strip() == ''):
                    continue

                # Map symbol to shift type
                symbol_stripped = symbol.strip() if isinstance(symbol, str) else str(symbol)
                shift_type = self.SYMBOL_TO_SHIFT.get(symbol_stripped)

                if shift_type is None:
                    # Unknown symbol - try to handle gracefully
                    # Default to WORK for unknown symbols (preserves the symbol in output)
                    unknown_symbols.add(symbol_stripped)
                    shift_type = self.SHIFT_WORK
                    logger.warning(f"  Unknown symbol '{symbol_stripped}' for {staff_id} on {date} - treating as WORK")

                # Skip if shift variable doesn't exist (staff not working on this date)
                if not self._has_shift_var(staff_id, date):
                    logger.warning(f"  Skipping pre-filled cell for {staff_id} on {date} - no shift variable (before start_period)")
                    skipped_count += 1
                    continue

                # Add HARD constraint: This shift MUST be selected
                self.model.Add(self.shifts[(staff_id, date, shift_type)] == 1)

                # Track this cell as pre-filled
                self.prefilled_cells.add((staff_id, date))
                prefilled_symbols[(staff_id, date)] = symbol_stripped

                constraint_count += 1

        # Store prefilled symbols for solution extraction (to preserve original symbols)
        self.prefilled_symbols = prefilled_symbols

        if unknown_symbols:
            logger.warning(f"[OR-TOOLS] Unknown symbols encountered: {unknown_symbols}")

        if skipped_count > 0:
            logger.info(f"[OR-TOOLS] Skipped {skipped_count} pre-filled cells (invalid staff/date)")

        if backup_skipped_count > 0:
            logger.info(f"[OR-TOOLS] 🛡️ Skipped {backup_skipped_count} backup staff pre-filled cells (schedule determined by coverage)")

        logger.info(f"[OR-TOOLS] 🔒 Added {constraint_count} pre-filled HARD constraints")
        logger.info(f"[OR-TOOLS] Pre-filled cells will be preserved in final schedule")

    def _add_calendar_rules(self):
        """
        PRE-PHASE + Phase 3 Integration: Calendar must_day_off and must_work.

        From AI_GENERATION_FLOW_DOCUMENTATION.md:
        - must_day_off: ALL staff get x (day off), EXCEPT those with early shift preference get s
        - must_work: ALL staff work normal shift

        These are HIGHEST PRIORITY - override everything else.

        IMPORTANT: earlyShiftPreferences format from React:
        { staffId: { dateString: boolean, 'default': boolean } }
        NOT: { staffId: { dates: [...] } }
        """
        calendar_rules = self.constraints_config.get('calendarRules', {})
        early_shift_prefs = self.constraints_config.get('earlyShiftPreferences', {})

        if not calendar_rules:
            logger.info("[OR-TOOLS] No calendar rules provided")
            return

        logger.info(f"[OR-TOOLS] Adding calendar rules for {len(calendar_rules)} dates...")
        logger.info(f"[OR-TOOLS] Early shift prefs available for {len(early_shift_prefs)} staff members")

        for date, rule in calendar_rules.items():
            if date not in self.date_range:
                continue  # Skip dates outside our range

            if rule.get('must_day_off'):
                self.calendar_off_dates.add(date)  # Track for monthly limit exclusion

                for staff in self.staff_members:
                    staff_id = staff['id']

                    # Skip if shift variable doesn't exist (staff not working on this date)
                    if not self._has_shift_var(staff_id, date):
                        continue

                    # Check if staff has early shift preference for this date
                    # React format: { staffId: { dateString: boolean, 'default': boolean } }
                    has_early_pref = False
                    if staff_id in early_shift_prefs:
                        staff_prefs = early_shift_prefs[staff_id]
                        # Check specific date first, then fall back to default
                        if date in staff_prefs:
                            has_early_pref = staff_prefs[date] == True
                        elif 'default' in staff_prefs:
                            has_early_pref = staff_prefs['default'] == True

                    if has_early_pref:
                        # Staff with early shift preference: Strongly prefer early shift (SOFT to avoid INFEASIBLE)
                        # Use high penalty (1000) to make it very likely but not absolutely required
                        # Track as violation when staff is NOT assigned early shift
                        not_early = self.model.NewBoolVar(f'not_early_{staff_id}_{date}')
                        early_var = self.shifts[(staff_id, date, self.SHIFT_EARLY)]
                        self.model.Add(early_var == 0).OnlyEnforceIf(not_early)
                        self.model.Add(early_var == 1).OnlyEnforceIf(not_early.Not())
                        self.violation_vars.append((not_early, 1000, f'early_pref_{staff_id}_{date}'))
                        logger.info(f"  {staff.get('name', staff_id)}: PREFER EARLY on {date} (early pref, soft penalty=1000)")
                    else:
                        # All other staff: Force x (off) - this is HARD as it's a calendar rule
                        self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 1)

            elif rule.get('must_work'):
                # Track this date as a must_work date (for skipping priority rules)
                self.calendar_work_dates.add(date)
                # All staff must work normal shift
                for staff in self.staff_members:
                    # Skip if shift variable doesn't exist (staff not working on this date)
                    if not self._has_shift_var(staff['id'], date):
                        continue
                    self.model.Add(self.shifts[(staff['id'], date, self.SHIFT_WORK)] == 1)
                logger.info(f"  All staff: WORK on {date} (must_work)")

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
                self._japanese_holidays_cache = set(holidays_data.keys())
                self._japanese_holidays_names = holidays_data  # Store names for logging
                logger.info(f"[OR-TOOLS] Fetched {len(self._japanese_holidays_cache)} Japanese holidays from API")

                # Log holidays in date range for debugging
                holidays_in_range = [d for d in self.date_range if d in self._japanese_holidays_cache]
                if holidays_in_range:
                    logger.info(f"[OR-TOOLS] Holidays in schedule period ({len(holidays_in_range)}):")
                    for h in holidays_in_range:
                        logger.info(f"    {h}: {holidays_data.get(h, 'Unknown')}")

                return self._japanese_holidays_cache
        except Exception as e:
            logger.warning(f"[OR-TOOLS] Failed to fetch Japanese holidays: {e}")

        # Return empty set on failure (fail gracefully)
        self._japanese_holidays_cache = set()
        self._japanese_holidays_names = {}
        return self._japanese_holidays_cache

    def _add_backup_staff_constraints(self):
        """
        Backup staff coverage constraints using database backup assignments.

        CORRECT BUSINESS LOGIC (from user requirement):
        - When ANY member of a staff group has × (day off) → Backup staff MUST work (○)
        - When NO member of a staff group has × → Backup staff gets Unavailable (⊘)

        CONFIGURABLE CONSTRAINT: Can be HARD or SOFT based on ortoolsConfig.
        - HARD constraint (DEFAULT): Backup MUST work when group member is off
          * Ensures critical operational coverage
          * Solver will fail if backup coverage cannot be satisfied
          * Recommended for restaurants/healthcare where backup is mandatory
        - SOFT constraint: Backup SHOULD work with high penalty (penalty weight used)
          * Allows schedule generation even when backup coverage conflicts with other constraints
          * Used when backup coverage is important but not absolutely required

        Data format from React (backupAssignments from useAISettings.js):
        [
            {
                'id': 'assignment-uuid',
                'staffId': 'backup-staff-uuid',  # The backup staff member
                'groupId': 'group-uuid',         # The group they cover
                'isActive': True,
                ...
            }
        ]

        Staff groups format (from staffGroups):
        [
            {
                'id': 'group-uuid',
                'name': 'Group 2',
                'members': ['staff-uuid-1', 'staff-uuid-2']  # Group members to cover
            }
        ]

        Symbol meanings:
        - ⊘ (Unavailable): Backup has no coverage duty (no one in group is off)
        - ○ (Work): Backup SHOULD work to cover someone in the group who is off
        """
        backup_assignments = self.constraints_config.get('backupAssignments', [])
        staff_groups = self.constraints_config.get('staffGroups', [])

        # Debug: Log received data
        logger.info(f"[OR-TOOLS] 🔍 DEBUG - backupAssignments received: {backup_assignments}")
        logger.info(f"[OR-TOOLS] 🔍 DEBUG - staffGroups received: {len(staff_groups)} groups")
        for g in staff_groups:
            logger.info(f"[OR-TOOLS] 🔍 DEBUG - Group '{g.get('name', g.get('id'))}': members={g.get('members', [])}")

        if not backup_assignments:
            logger.info("[OR-TOOLS] No backup assignments provided")
            return

        if not staff_groups:
            logger.info("[OR-TOOLS] No staff groups provided - cannot process backup assignments")
            return

        # Check if backup coverage should be HARD constraint (default: True)
        ortools_config = self.constraints_config.get('ortoolsConfig', {})
        hard_constraints = ortools_config.get('hardConstraints', {})
        backup_coverage_is_hard = hard_constraints.get('backupCoverage', True)  # DEFAULT: HARD (backup coverage guaranteed)

        constraint_type = "HARD" if backup_coverage_is_hard else "SOFT"

        # Create lookups
        valid_staff_ids = {s['id'] for s in self.staff_members}
        group_by_id = {g['id']: g for g in staff_groups}

        logger.info(f"[OR-TOOLS] 🛡️ Processing {len(backup_assignments)} backup assignments ({constraint_type} constraints)...")

        # Fetch Japanese holidays for パート unavailability
        japanese_holidays = self._fetch_japanese_holidays()

        constraint_count = 0
        skipped_count = 0

        for assignment in backup_assignments:
            # Skip inactive assignments
            if not assignment.get('isActive', True):
                skipped_count += 1
                continue

            backup_staff_id = assignment.get('staffId') or assignment.get('staff_id')
            group_id = assignment.get('groupId') or assignment.get('group_id')

            # Validate backup staff exists
            if not backup_staff_id or backup_staff_id not in valid_staff_ids:
                logger.warning(f"  Skipping - backup staff not found: {backup_staff_id}")
                skipped_count += 1
                continue

            # Validate group exists
            if not group_id or group_id not in group_by_id:
                logger.warning(f"  Skipping - group not found: {group_id}")
                skipped_count += 1
                continue

            group = group_by_id[group_id]
            group_name = group.get('name', 'Unknown')
            group_members = group.get('members', [])

            # Filter to valid group members (must be in current staff list)
            # This eliminates inactive/deleted staff from coverage calculation
            valid_members = [m for m in group_members if m in valid_staff_ids]

            if not valid_members:
                logger.warning(f"  Skipping - no valid/active members in group '{group_name}' (original members: {group_members})")
                skipped_count += 1
                continue

            # Get backup staff name for logging
            backup_staff = next((s for s in self.staff_members if s['id'] == backup_staff_id), {})
            backup_name = backup_staff.get('name', backup_staff_id)

            # ═══════════════════════════════════════════════════════════════════════════
            # IMPORTANT: Track backup staff IDs to EXCLUDE from monthly limits
            # Backup staff schedule is determined ONLY by group coverage, not monthly quotas
            # ═══════════════════════════════════════════════════════════════════════════
            self.backup_staff_ids.add(backup_staff_id)

            # Log filtered members info with actual member IDs for debugging
            filtered_count = len(group_members) - len(valid_members)
            # Get member names for clearer logging
            member_names = []
            for mid in valid_members:
                staff = next((s for s in self.staff_members if s['id'] == mid), None)
                if staff:
                    member_names.append(f"{staff.get('name', mid)}")
                else:
                    member_names.append(mid)

            logger.info(f"  🛡️ {backup_name} → covers group '{group_name}'")
            logger.info(f"     Group members ({len(valid_members)}): {', '.join(member_names)}")
            logger.info(f"     Member IDs: {valid_members}")
            if filtered_count > 0:
                logger.info(f"     ({filtered_count} inactive members filtered out)")

            # ═══════════════════════════════════════════════════════════════════════════
            # For each date, create backup coverage constraint
            # ═══════════════════════════════════════════════════════════════════════════
            for date in self.date_range:
                # Skip calendar must_day_off dates (everyone is already off)
                if date in self.calendar_off_dates:
                    continue

                # Skip if backup staff not working on this date OR no shift variable exists
                if not self._staff_works_on_date(backup_staff_id, date) or not self._has_shift_var(backup_staff_id, date):
                    continue

                # ═══════════════════════════════════════════════════════════════════════════
                # BACKUP COVERAGE TRIGGER: Only day off (×) triggers coverage
                # - OFF (×) - day off → backup MUST work
                # - EARLY (△) - early shift → backup does NOT need to cover (staff still present)
                # ═══════════════════════════════════════════════════════════════════════════
                member_off_vars = []
                for member_id in valid_members:
                    # Skip members not working on this date OR no shift variable exists
                    if not self._staff_works_on_date(member_id, date) or not self._has_shift_var(member_id, date):
                        continue
                    # Only check for OFF (×), NOT early shift
                    member_off = self.shifts[(member_id, date, self.SHIFT_OFF)]
                    member_off_vars.append(member_off)

                any_member_off = self.model.NewBoolVar(f'any_off_{group_id}_{date}')

                # ═══════════════════════════════════════════════════════════════════════════
                # any_member_off = MAX(member_off_vars) means:
                # - If ANY member has day off (×), any_member_off = 1
                # - If NO member has day off, any_member_off = 0
                # Early shift (△) does NOT trigger backup coverage
                # ═══════════════════════════════════════════════════════════════════════════
                self.model.AddMaxEquality(any_member_off, member_off_vars)

                # ─────────────────────────────────────────────────────────────────────
                # CONSTRAINT A: If any group member has day off (×) → Backup MUST work (○)
                # ─────────────────────────────────────────────────────────────────────
                # CRITICAL FIX: Backup can ONLY have WORK (○), NOT early (△) or late (◇)
                backup_work_var = self.shifts[(backup_staff_id, date, self.SHIFT_WORK)]
                backup_early_var = self.shifts[(backup_staff_id, date, self.SHIFT_EARLY)]
                backup_late_var = self.shifts[(backup_staff_id, date, self.SHIFT_LATE)]

                if backup_coverage_is_hard:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # HARD CONSTRAINT: Backup MUST have WORK (and ONLY work, no early/late)
                    # ═══════════════════════════════════════════════════════════════════════════
                    # If any_member_off == 1 → backup_work must be 1
                    self.model.Add(backup_work_var == 1).OnlyEnforceIf(any_member_off)
                    # Also ensure early and late are NOT selected when coverage is needed
                    self.model.Add(backup_early_var == 0).OnlyEnforceIf(any_member_off)
                    self.model.Add(backup_late_var == 0).OnlyEnforceIf(any_member_off)
                    constraint_count += 3
                else:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # SOFT CONSTRAINT: Backup SHOULD work with penalty for violations
                    # ═══════════════════════════════════════════════════════════════════════════
                    # coverage_violation = 1 when: any_member_off=1 AND backup_work=0
                    coverage_violation = self.model.NewBoolVar(f'backup_coverage_violation_{backup_staff_id}_{date}')

                    # Using indicator constraints:
                    # If any_member_off=0, coverage_violation must be 0
                    self.model.Add(coverage_violation == 0).OnlyEnforceIf(any_member_off.Not())
                    # If any_member_off=1 AND backup_work=1, coverage_violation must be 0
                    self.model.Add(coverage_violation == 0).OnlyEnforceIf([any_member_off, backup_work_var])
                    # If any_member_off=1 AND backup_work=0, coverage_violation must be 1
                    self.model.AddBoolOr([any_member_off.Not(), backup_work_var, coverage_violation])

                    # Add to violation tracking with high penalty
                    self.violation_vars.append((
                        coverage_violation,
                        self.PENALTY_WEIGHTS['backup_coverage'],
                        f'Backup {backup_name} not covering {group_name} on {date}'
                    ))

                    # SOFT constraint to prevent early/late shifts when coverage is needed
                    # This should have medium-high penalty (backup should be normal work, not early/late)
                    early_violation = self.model.NewBoolVar(f'backup_early_violation_{backup_staff_id}_{date}')
                    late_violation = self.model.NewBoolVar(f'backup_late_violation_{backup_staff_id}_{date}')

                    # early_violation = 1 when: any_member_off=1 AND backup_early=1
                    self.model.Add(early_violation == 0).OnlyEnforceIf(any_member_off.Not())
                    self.model.Add(early_violation == 0).OnlyEnforceIf([any_member_off, backup_early_var.Not()])
                    self.model.Add(early_violation == 1).OnlyEnforceIf([any_member_off, backup_early_var])

                    # late_violation = 1 when: any_member_off=1 AND backup_late=1
                    self.model.Add(late_violation == 0).OnlyEnforceIf(any_member_off.Not())
                    self.model.Add(late_violation == 0).OnlyEnforceIf([any_member_off, backup_late_var.Not()])
                    self.model.Add(late_violation == 1).OnlyEnforceIf([any_member_off, backup_late_var])

                    self.violation_vars.append((
                        early_violation,
                        self.PENALTY_WEIGHTS['backup_coverage'] // 2,
                        f'Backup {backup_name} has early shift when should cover {group_name} on {date}'
                    ))
                    self.violation_vars.append((
                        late_violation,
                        self.PENALTY_WEIGHTS['backup_coverage'] // 2,
                        f'Backup {backup_name} has late shift when should cover {group_name} on {date}'
                    ))
                    constraint_count += 3

                # ─────────────────────────────────────────────────────────────────────
                # CONSTRAINT B: Backup availability based on Japanese holidays
                # ─────────────────────────────────────────────────────────────────────
                # NEW LOGIC (2024-01 update):
                # - Default: Backup WORKS (○) when no coverage needed (inverted from before)
                # - Holiday: Backup is UNAVAILABLE (⊘) on Japanese national holidays (HARD)
                # - Coverage: Backup WORKS (○) when group member has day off (handled in A)
                # - Holiday + Coverage conflict: Holiday takes precedence → UNAVAILABLE
                backup_off_var = self.shifts[(backup_staff_id, date, self.SHIFT_OFF)]

                # Check if this date is a Japanese holiday
                is_holiday = date in japanese_holidays

                if is_holiday:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # HARD CONSTRAINT: On Japanese holidays, backup MUST be OFF (unavailable)
                    # This takes precedence over coverage - group member day off will be moved
                    # ═══════════════════════════════════════════════════════════════════════════
                    self.model.Add(backup_off_var == 1)
                    constraint_count += 1

                    # Get holiday name for logging
                    holiday_name = getattr(self, '_japanese_holidays_names', {}).get(date, 'Holiday')
                    logger.debug(f"    {date} ({holiday_name}): backup MUST be off (holiday)")

                    # Track as unavailable for solution extraction (to output ⊘)
                    # Store a tuple (type, any_member_off) to handle both holiday and coverage cases
                    self.backup_unavailable_slots[(backup_staff_id, date)] = ('holiday', None)
                else:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # NON-HOLIDAY: Backup WORKS by default
                    # No constraint needed - backup will naturally get WORK assignment
                    # Only track unavailable status based on coverage (any_member_off)
                    # ═══════════════════════════════════════════════════════════════════════════
                    # Track for solution extraction (any_member_off determines if coverage needed)
                    # Store a tuple (type, any_member_off_var) for consistent handling
                    self.backup_unavailable_slots[(backup_staff_id, date)] = ('coverage', any_member_off)

        if skipped_count > 0:
            logger.info(f"[OR-TOOLS] Backup assignments: {constraint_count} {constraint_type} constraints added, {skipped_count} skipped")
        else:
            logger.info(f"[OR-TOOLS] 🛡️ Added {constraint_count} backup coverage {constraint_type} constraints")

    def _add_staff_status_shift_restrictions(self):
        """
        STAFF STATUS SHIFT RESTRICTIONS: Limit shift types based on staff status.

        Business Rule:
        - 派遣 (Dispatch) staff: Can ONLY have normal work (○/empty) or day off (×)
        - パート (Part-time) staff: Can ONLY have normal work (○/empty) or day off (×)
        - 社員 (Regular) staff: Can have all shift types (no restriction)

        This is a SOFT constraint with VERY HIGH penalty (150) - these staff types
        should normally NEVER be assigned early (△) or late (◇) shifts, but the
        solver can violate this if other constraints make it necessary (prevents INFEASIBLE).

        Configuration (optional, via staffStatusShiftRestrictions):
        {
            '派遣': {'allowedShifts': ['work', 'off']},  # Forbids early, late
            'パート': {'allowedShifts': ['work', 'off']},  # Forbids early, late
        }

        If not configured, uses default restrictions for 派遣 and パート.
        """
        # Get configuration or use defaults
        restrictions_config = self.constraints_config.get('staffStatusShiftRestrictions', {})

        # Default restrictions: 派遣 and パート can only have work/off
        default_restrictions = {
            '派遣': {'allowedShifts': ['work', 'off'], 'forbiddenShifts': ['early', 'late']},
            'パート': {'allowedShifts': ['work', 'off'], 'forbiddenShifts': ['early', 'late']},
        }

        # Merge with configured restrictions (config overrides defaults)
        effective_restrictions = {**default_restrictions, **restrictions_config}

        # Check if restrictions are disabled
        if self.constraints_config.get('disableStaffStatusShiftRestrictions', False):
            logger.info("[OR-TOOLS] Staff status shift restrictions DISABLED by configuration")
            return

        logger.info(f"[OR-TOOLS] Adding staff status shift restrictions (SOFT) for {len(effective_restrictions)} status types...")

        constraint_count = 0
        staff_affected = 0
        penalty_weight = self.PENALTY_WEIGHTS.get('staff_status_shift', 150)

        for staff in self.staff_members:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)
            staff_status = staff.get('status', '社員')  # Default to 社員 if not set

            # Skip if no restriction for this status
            if staff_status not in effective_restrictions:
                continue

            restriction = effective_restrictions[staff_status]
            forbidden_shifts = restriction.get('forbiddenShifts', [])

            if not forbidden_shifts:
                continue

            staff_affected += 1

            # Apply restriction for each date
            for date in self.date_range:
                # Skip if shift variable doesn't exist (staff not working on this date)
                if not self._has_shift_var(staff_id, date):
                    continue

                for forbidden_shift_name in forbidden_shifts:
                    # Map shift name to constant
                    shift_type = self._parse_shift_type(forbidden_shift_name)

                    # SOFT constraint: Create a violation variable for this forbidden shift
                    # If shift_var == 1 (assigned), then violation == 1 (penalty applies)
                    shift_var = self.shifts[(staff_id, date, shift_type)]

                    # The shift_var itself is the violation indicator
                    # If shift is assigned (shift_var == 1), we incur penalty
                    shift_type_name = 'early' if shift_type == self.SHIFT_EARLY else 'late'
                    description = f"Forbidden {shift_type_name} shift for {staff_name} ({staff_status}) on {date}"

                    self.violation_vars.append((shift_var, penalty_weight, description))
                    constraint_count += 1

        logger.info(f"[OR-TOOLS] ⚠️ Added {constraint_count} staff status shift restrictions SOFT ({staff_affected} staff affected, penalty={penalty_weight})")

    def _add_staff_group_constraints(self):
        """
        PHASE 2: Staff group constraints.

        Rule: Only 1 member of a group can have off (x) or early (s) on same day.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1844-1872:
        "If 2+ members in a group have off/early shifts on same date = CONFLICT"

        CONFIGURABLE: Can be HARD or SOFT constraints based on ortoolsConfig.

        IMPORTANT FIX: When staffGroups is HARD, we use a HYBRID approach:
        - EARLY SHIFTS (△): HARD constraint - max 1 per group per day (critical for operations)
        - DAY-OFF (×): SOFT constraint with HIGH penalty - allows 2+ but heavily penalized

        This prevents INFEASIBLE solutions when monthly limits require more off-days
        than pure HARD constraints would allow.

        IMPORTANT: staffGroups format from React:
        [
            {
                id, name, members: [staffId1, staffId2, ...],
                description, metadata: { color, ... }
            },
            ...
        ]
        """
        staff_groups = self.constraints_config.get('staffGroups', [])

        if not staff_groups:
            logger.info("[OR-TOOLS] No staff groups provided")
            return

        # Check if staff groups should be HARD constraints
        ortools_config = self.constraints_config.get('ortoolsConfig', {})
        hard_constraints = ortools_config.get('hardConstraints', {})
        staff_group_is_hard = hard_constraints.get('staffGroups', False)

        constraint_type = "HYBRID (off=HARD, early=SOFT)" if staff_group_is_hard else "SOFT"
        logger.info(f"[OR-TOOLS] Adding staff group constraints ({constraint_type}) for {len(staff_groups)} groups...")

        # Create a lookup for valid staff IDs
        valid_staff_ids = {s['id'] for s in self.staff_members}
        logger.info(f"[OR-TOOLS] Valid staff IDs: {valid_staff_ids}")

        hard_constraint_count = 0
        soft_constraint_count = 0

        for group in staff_groups:
            group_name = group.get('name', 'Unknown')
            group_members = group.get('members', [])

            logger.info(f"  Group '{group_name}': {len(group_members)} members -> {group_members}")

            # Filter to only valid staff IDs in this group
            valid_members = [m for m in group_members if m in valid_staff_ids]

            if len(valid_members) < 2:
                logger.info(f"    Skipping - only {len(valid_members)} valid members (need 2+)")
                continue  # Group needs at least 2 members to have conflict

            logger.info(f"    Valid members: {valid_members}")

            for date in self.date_range:
                # Skip calendar must_day_off dates (everyone is off anyway)
                if date in self.calendar_off_dates:
                    continue

                if staff_group_is_hard:
                    # HYBRID HARD APPROACH: Day-off is HARD, early shift is SOFT
                    # This ensures NO same day-off for group members while allowing
                    # flexibility for early shifts when needed (e.g., to satisfy monthly limits)

                    # Filter members to only those working on this date AND have shift variables
                    working_members = [m for m in valid_members if self._staff_works_on_date(m, date) and self._has_shift_var(m, date)]

                    if len(working_members) < 2:
                        continue  # Need at least 2 working members to have a conflict

                    # 1. EARLY SHIFTS (△): SOFT constraint with high penalty
                    # This allows the solver to violate if needed to satisfy other constraints
                    early_vars = []
                    for member_id in working_members:
                        early_vars.append(self.shifts[(member_id, date, self.SHIFT_EARLY)])
                    total_early = sum(early_vars)

                    # Create violation variable for early shifts
                    early_violation = self.model.NewIntVar(0, len(working_members), f'group_{group_name}_{date}_early_violation')
                    self.model.Add(early_violation >= total_early - 1)
                    self.model.Add(early_violation >= 0)

                    # High penalty for early shift violations (but still SOFT)
                    self.violation_vars.append((
                        early_violation,
                        self.PENALTY_WEIGHTS['staff_group'] * 2,  # Double penalty for importance
                        f'Staff group {group_name} early shift violation on {date}'
                    ))
                    soft_constraint_count += 1

                    # 2. DAY-OFF (×): HARD constraint - max 1 per group per day
                    # This is the critical constraint - cannot have 2 staff off same day
                    off_vars = []
                    for member_id in working_members:
                        off_vars.append(self.shifts[(member_id, date, self.SHIFT_OFF)])
                    total_off = sum(off_vars)
                    self.model.Add(total_off <= 1)
                    hard_constraint_count += 1
                else:
                    # PURE SOFT: Both off and early are soft constraints
                    # Filter members to only those working on this date AND have shift variables
                    working_members = [m for m in valid_members if self._staff_works_on_date(m, date) and self._has_shift_var(m, date)]

                    if len(working_members) < 2:
                        continue  # Need at least 2 working members to have a conflict

                    off_or_early_vars = []
                    for member_id in working_members:
                        off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_OFF)])
                        off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_EARLY)])

                    total_off_early = sum(off_or_early_vars)

                    # violation = max(0, total_off_early - 1)
                    violation_var = self.model.NewIntVar(0, len(working_members) * 2, f'group_{group_name}_{date}_violation')
                    self.model.Add(violation_var >= total_off_early - 1)
                    self.model.Add(violation_var >= 0)

                    # Track violation for objective penalty
                    self.violation_vars.append((
                        violation_var,
                        self.PENALTY_WEIGHTS['staff_group'],
                        f'Staff group {group_name} on {date}'
                    ))
                    soft_constraint_count += 1

        if staff_group_is_hard:
            logger.info(f"[OR-TOOLS] Added {hard_constraint_count} HARD (day-off) + {soft_constraint_count} SOFT (early shift) staff group constraints")
        else:
            logger.info(f"[OR-TOOLS] Added {soft_constraint_count} staff group soft constraints")

    def _add_daily_limits(self):
        """
        BALANCE phase: Daily min/max off limits.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1303-1400:
        - Default: min 2, max 3 staff off per day
        - Skip calendar rule dates (must_day_off/must_work override limits)

        CONFIGURABLE: Can be HARD or SOFT constraints based on ortoolsConfig.
        - HARD constraint: Strictly enforced, no violations allowed (may fail if unsatisfiable)
        - SOFT constraint: Violations allowed with penalty (always finds a solution)

        Can be disabled via 'enabled' flag in dailyLimitsRaw.

        NOTE: Daily limits and staff type limits serve DIFFERENT purposes and work together:
        - Daily limits: min/max TOTAL staff off per day (across all types)
        - Staff type limits: max of SPECIFIC TYPE off per day (e.g., max 1 社員)
        """
        daily_limits = self.constraints_config.get('dailyLimitsRaw', {})
        staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

        # NOTE: Daily limits and staff type limits serve DIFFERENT purposes:
        # - Daily limits: min/max TOTAL staff off per day (across all types)
        # - Staff type limits: max of SPECIFIC TYPE off per day (e.g., max 1 社員)
        # Both constraints should work together!
        if staff_type_limits and len(staff_type_limits) > 0:
            logger.info("[OR-TOOLS] Both daily limits AND staff type limits are active")

        # Check if daily limits are explicitly disabled via 'enabled' flag
        is_enabled = daily_limits.get('enabled', True)
        if not is_enabled:
            logger.info("[OR-TOOLS] Daily limits DISABLED via UI toggle")
            return

        # Use provided limits or smart defaults based on staff count
        # NOTE: Exclude backup staff from daily limit calculations
        non_backup_staff = [s for s in self.staff_members if s['id'] not in self.backup_staff_ids]
        staff_count = len(non_backup_staff)

        if len(self.backup_staff_ids) > 0:
            logger.info(f"  🛡️ {len(self.backup_staff_ids)} backup staff excluded from daily limits (staff_count={staff_count})")

        default_min = min(2, staff_count - 1) if staff_count > 1 else 0
        # Phase 2 fix: Increase default max from 3 to 4 to allow more day-off flexibility
        # With 10 staff and max=3, only 84 slots available (3×28) but 100 needed (10×10)
        # With max=4, 112 slots available (4×28) which satisfies all staff reaching 10
        default_max = min(4, staff_count - 1) if staff_count > 1 else 0

        min_off = daily_limits.get('minOffPerDay', default_min)
        max_off = daily_limits.get('maxOffPerDay', default_max)

        # Sanity check: adjust limits based on actual staff count
        min_off = min(min_off, staff_count - 1)  # At least 1 person must work
        max_off = min(max_off, staff_count - 1)

        # Ensure min <= max
        if min_off > max_off:
            min_off = max_off

        # Check if daily limits should be HARD constraints
        ortools_config = self.constraints_config.get('ortoolsConfig', {})
        hard_constraints = ortools_config.get('hardConstraints', {})
        daily_limit_is_hard = hard_constraints.get('dailyLimits', False)

        constraint_type = "HARD" if daily_limit_is_hard else "SOFT"
        logger.info(f"[OR-TOOLS] Adding daily limits ({constraint_type}): min={min_off}, max={max_off} (staff={staff_count})...")

        calendar_rules = self.constraints_config.get('calendarRules', {})
        constraint_count = 0

        for date in self.date_range:
            # Skip calendar rule dates - they override daily limits
            if date in calendar_rules:
                rule = calendar_rules[date]
                if rule.get('must_day_off') or rule.get('must_work'):
                    continue

            # Count off days (x) on this date across non-backup staff only
            # IMPORTANT: Only include staff who work on this date (before end_period) AND have shift vars
            off_count = sum([
                self.shifts[(staff['id'], date, self.SHIFT_OFF)]
                for staff in non_backup_staff
                if self._staff_works_on_date(staff['id'], date) and self._has_shift_var(staff['id'], date)
            ])

            if daily_limit_is_hard:
                # HARD CONSTRAINT: Strictly enforce limits (will fail if unsatisfiable)
                if min_off > 0:
                    self.model.Add(off_count >= min_off)
                    constraint_count += 1
                self.model.Add(off_count <= max_off)
                constraint_count += 1
            else:
                # SOFT CONSTRAINT for min: Penalize if below minimum
                if min_off > 0:
                    # under_min = max(0, min_off - off_count)
                    under_min_var = self.model.NewIntVar(0, staff_count, f'daily_under_min_{date}')
                    self.model.Add(under_min_var >= min_off - off_count)
                    self.model.Add(under_min_var >= 0)
                    self.violation_vars.append((
                        under_min_var,
                        self.PENALTY_WEIGHTS['daily_limit'],
                        f'Daily under-minimum on {date}'
                    ))
                    constraint_count += 1

                # SOFT CONSTRAINT for max: Penalize if above maximum
                # over_max = max(0, off_count - max_off)
                over_max_var = self.model.NewIntVar(0, staff_count, f'daily_over_max_{date}')
                self.model.Add(over_max_var >= off_count - max_off)
                self.model.Add(over_max_var >= 0)
                self.violation_vars.append((
                    over_max_var,
                    self.PENALTY_WEIGHTS['daily_limit_max'],
                    f'Daily over-maximum on {date}'
                ))
                constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} daily limit {constraint_type.lower()} constraints")

    def _add_staff_type_daily_limits(self):
        """
        Per-staff-type daily limits: Limit off/early shifts per staff type per day.

        Purpose: Ensure balanced coverage by limiting how many staff of each type
        (社員=Regular, 派遣=Dispatch, パート=Part-time) can be off or on early shift
        on any given day.

        Example use cases:
        - Restaurant: Max 1 regular chef (社員) off per day
        - Retail: Max 2 part-timers (パート) on early shift per day
        - Healthcare: Max 1 senior staff (社員) off per day for coverage

        Configuration format:
        {
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                '派遣': {'maxOff': 1, 'maxEarly': 2, 'isHard': True},
                'パート': {'maxOff': 2, 'maxEarly': 1, 'isHard': False}
            }
        }

        CONFIGURABLE: Can be HARD or SOFT per staff type.
        - HARD: Strictly enforce (solver will fail if unsatisfiable)
        - SOFT: Allow violations with penalty (always finds solution)

        Edge cases handled:
        - No staff of a given type: Skip with warning
        - Zero limits (maxOff=0): Valid - no one of that type can be off
        - Limit > staff count: Valid but ineffective - log info
        - Calendar override dates: Skip (forced assignments override)
        - Missing 'status' field: Default to 'Unknown' type
        - Negative limits: Invalid - log error and skip
        - None/null limits: Skip that constraint (off or early)
        """
        staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

        if not staff_type_limits:
            logger.info("[OR-TOOLS] No staff type limits provided")
            return

        logger.info(f"[OR-TOOLS] Adding staff type daily limits for {len(staff_type_limits)} types...")

        # ═══════════════════════════════════════════════════════════════════════════
        # STEP 1: Group staff by their status (staff type)
        # NOTE: Backup staff are EXCLUDED from staff type limits
        # ═══════════════════════════════════════════════════════════════════════════
        staff_by_type = {}
        skipped_backup_count = 0
        for staff in self.staff_members:
            staff_id = staff['id']

            # Skip backup staff - they are exempt from staff type limits
            if staff_id in self.backup_staff_ids:
                skipped_backup_count += 1
                continue

            # Use .get() with default to handle missing 'status' field
            status = staff.get('status', 'Unknown')

            if status not in staff_by_type:
                staff_by_type[status] = []

            staff_by_type[status].append(staff)

        # Log staff distribution for debugging
        distribution = [(t, len(s)) for t, s in staff_by_type.items()]
        logger.info(f"  Staff distribution by type: {distribution}")
        if skipped_backup_count > 0:
            logger.info(f"  🛡️ {skipped_backup_count} backup staff excluded from staff type limits")

        # ═══════════════════════════════════════════════════════════════════════════
        # STEP 2: Apply constraints for each staff type
        # ═══════════════════════════════════════════════════════════════════════════
        constraint_count = 0
        warning_count = 0

        for staff_type, limits in staff_type_limits.items():
            # Get staff members of this specific type
            type_staff = staff_by_type.get(staff_type, [])

            # EDGE CASE: No staff of this type found
            if not type_staff:
                logger.warning(f"  Type '{staff_type}': No staff members found - skipping")
                warning_count += 1
                continue

            # Extract limit configuration
            min_off = limits.get('minOff', None)  # NEW: Minimum staff of this type off per day
            max_off = limits.get('maxOff', None)
            max_early = limits.get('maxEarly', None)
            is_hard = limits.get('isHard', False)

            # EDGE CASE: No limits specified for this type
            if min_off is None and max_off is None and max_early is None:
                logger.warning(f"  Type '{staff_type}': No limits specified (minOff/maxOff/maxEarly) - skipping")
                warning_count += 1
                continue

            # EDGE CASE: Validate limit values
            if min_off is not None and min_off < 0:
                logger.error(f"  Type '{staff_type}': Invalid minOff={min_off} (must be >= 0) - skipping")
                warning_count += 1
                continue

            if max_off is not None and max_off < 0:
                logger.error(f"  Type '{staff_type}': Invalid maxOff={max_off} (must be >= 0) - skipping")
                warning_count += 1
                continue

            if max_early is not None and max_early < 0:
                logger.error(f"  Type '{staff_type}': Invalid maxEarly={max_early} (must be >= 0) - skipping")
                warning_count += 1
                continue

            # EDGE CASE: minOff cannot exceed maxOff
            if min_off is not None and max_off is not None and min_off > max_off:
                logger.error(f"  Type '{staff_type}': Invalid minOff={min_off} > maxOff={max_off} - skipping")
                warning_count += 1
                continue

            # ═══════════════════════════════════════════════════════════════════════════
            # IMPORTANT: Always use SOFT constraints for staff type limits
            # HARD constraints can easily become INFEASIBLE when combined with monthly limits
            # Example: 6 社員 need 8 off days each = 48 total, but maxOff=1 × 26 days = 26 max
            # ═══════════════════════════════════════════════════════════════════════════
            # Override is_hard to always be False - user requested "HARD" but we use high penalty SOFT instead
            original_is_hard = is_hard
            is_hard = False  # ALWAYS SOFT to prevent INFEASIBLE

            # Use higher penalty when user originally wanted HARD constraint
            penalty_multiplier = 3 if original_is_hard else 1
            constraint_mode = "SOFT (high priority)" if original_is_hard else "SOFT"
            logger.info(f"  Type '{staff_type}': {len(type_staff)} staff, minOff={min_off}, maxOff={max_off}, maxEarly={max_early}, mode={constraint_mode}")

            # EDGE CASE: Warn if limits exceed staff count (ineffective but valid)
            if max_off is not None and max_off >= len(type_staff):
                logger.info(f"    Note: maxOff={max_off} >= staff_count={len(type_staff)} (constraint will never bind)")

            if max_early is not None and max_early >= len(type_staff):
                logger.info(f"    Note: maxEarly={max_early} >= staff_count={len(type_staff)} (constraint will never bind)")

            # ═══════════════════════════════════════════════════════════════════════
            # STEP 3: Create COMBINED constraints for each date
            # ═══════════════════════════════════════════════════════════════════════
            # COMBINED CONSTRAINT: off × 1.0 + early × 0.5 <= maxOff + (maxEarly × 0.5)
            # Since CP-SAT requires integers, we scale by 2:
            # off × 2 + early × 1 <= (maxOff × 2) + (maxEarly × 1)
            #
            # Example with maxOff=1, maxEarly=2:
            # - Combined limit (scaled) = 1×2 + 2×1 = 4
            # - Valid: 1× + 2△ = 2 + 2 = 4 ✅
            # - Valid: 0× + 4△ = 0 + 4 = 4 ✅
            # - Valid: 2× + 0△ = 4 + 0 = 4 ✅
            # - Invalid: 1× + 3△ = 2 + 3 = 5 ❌
            # ═══════════════════════════════════════════════════════════════════════

            # Calculate combined limit (scaled by 2)
            # Handle None values: if not specified, treat as unlimited (use large value)
            max_off_val = max_off if max_off is not None else 999
            max_early_val = max_early if max_early is not None else 999
            max_scaled = (max_off_val * 2) + (max_early_val * 1)

            logger.info(f"    Combined limit formula: off×2 + early×1 <= {max_scaled} (maxOff={max_off_val}×2 + maxEarly={max_early_val}×1)")

            for date in self.date_range:
                # EDGE CASE: Skip calendar override dates (must_day_off/must_work)
                # These dates have forced assignments that override daily limits
                if date in self.calendar_off_dates:
                    continue

                # ─────────────────────────────────────────────────────────────────────
                # COMBINED CONSTRAINT: off × 2 + early × 1 <= max_scaled
                # This allows flexible combinations like:
                # - 1 off + 2 early = 2 + 2 = 4 (if max_scaled=4)
                # - 0 off + 4 early = 0 + 4 = 4
                # - 2 off + 0 early = 4 + 0 = 4
                # ─────────────────────────────────────────────────────────────────────

                # Get shift variables for this staff type on this date
                # IMPORTANT: Only include staff who work on this date (before end_period) AND have shift vars
                active_type_staff = [s for s in type_staff if self._staff_works_on_date(s['id'], date) and self._has_shift_var(s['id'], date)]
                off_vars = [self.shifts[(staff['id'], date, self.SHIFT_OFF)] for staff in active_type_staff]
                early_vars = [self.shifts[(staff['id'], date, self.SHIFT_EARLY)] for staff in active_type_staff]

                # Create scaled sum: off × 2 + early × 1
                # off counts as 2 (= 1.0 in original scale), early counts as 1 (= 0.5)
                scaled_terms = []
                for var in off_vars:
                    scaled_terms.append(var * 2)
                for var in early_vars:
                    scaled_terms.append(var * 1)

                combined_scaled = sum(scaled_terms)

                # ─────────────────────────────────────────────────────────────────────
                # MINIMUM OFF CONSTRAINT (NEW): At least minOff staff must be off
                # This ensures adequate coverage by guaranteeing rest days
                # ─────────────────────────────────────────────────────────────────────
                if min_off is not None and min_off > 0:
                    # Count only off days (×) for minimum constraint
                    off_count = sum(off_vars)

                    # SOFT CONSTRAINT: Penalize if below minimum
                    # under_min = max(0, min_off - off_count)
                    under_min_var = self.model.NewIntVar(
                        0, len(type_staff),
                        f'staff_type_{staff_type}_under_min_{date}'
                    )
                    self.model.Add(under_min_var >= min_off - off_count)
                    self.model.Add(under_min_var >= 0)

                    # Track for objective penalty (high priority for minimum constraint)
                    effective_penalty = self.PENALTY_WEIGHTS['staff_type_limit'] * penalty_multiplier * 2  # Double penalty for minimum
                    self.violation_vars.append((
                        under_min_var,
                        effective_penalty,
                        f'Staff type {staff_type} under minimum off ({min_off}) on {date}'
                    ))
                    constraint_count += 1

                # ─────────────────────────────────────────────────────────────────────
                # MAXIMUM COMBINED CONSTRAINT: off × 2 + early × 1 <= max_scaled
                # ─────────────────────────────────────────────────────────────────────
                # SOFT CONSTRAINT: Penalize violations of combined limit
                # violation = max(0, combined_scaled - max_scaled)
                max_violation = len(type_staff) * 3  # Upper bound for violation
                violation_var = self.model.NewIntVar(
                    0, max_violation,
                    f'staff_type_{staff_type}_combined_{date}_violation'
                )
                self.model.Add(violation_var >= combined_scaled - max_scaled)
                self.model.Add(violation_var >= 0)

                # Track for objective penalty (use higher penalty when user wanted HARD)
                effective_penalty = self.PENALTY_WEIGHTS['staff_type_limit'] * penalty_multiplier
                self.violation_vars.append((
                    violation_var,
                    effective_penalty,
                    f'Staff type {staff_type} over combined limit on {date}'
                ))
                constraint_count += 1

        # ═══════════════════════════════════════════════════════════════════════════
        # SUMMARY LOGGING
        # ═══════════════════════════════════════════════════════════════════════════
        if warning_count > 0:
            logger.warning(f"[OR-TOOLS] Staff type limits: {constraint_count} constraints added, {warning_count} warnings")
        else:
            logger.info(f"[OR-TOOLS] Added {constraint_count} staff type limit constraints")

    def _compute_priority_rule_off_equivalent(self):
        """
        Pre-compute off-equivalent consumed by HARD priority rules per staff.

        This method must be called BEFORE _add_monthly_limits() so that the
        monthly limit constraint can adjust the remaining budget.

        HARD priority rules force specific shifts on specific days. These forced
        shifts should count toward the monthly off-equivalent limit just like
        pre-filled cells.

        Off-equivalent weights (scaled by 2 for integer math):
        - × (off) = 1.0 = 2 scaled
        - △ (early) = 0.5 = 1 scaled

        Example:
        - Monthly limit max = 4 off-equivalent (8 scaled)
        - Staff has HARD priority rule: "Sunday early shifts" (4 Sundays)
        - Priority consumed = 4 × 1 = 4 scaled (= 2.0 off-equivalent)
        - Remaining budget = 8 - 4 = 4 scaled (= 2.0 off-equivalent)
        """
        self.priority_rule_off_equiv = {}  # {staff_id: scaled_value}

        priority_rules = self.constraints_config.get('priorityRules', [])

        if not priority_rules:
            logger.info("[OR-TOOLS] No priority rules - no off-equivalent pre-consumption")
            return

        # Handle array format only (object format is legacy)
        if isinstance(priority_rules, dict):
            # Legacy object format not supported for pre-computation
            logger.info("[OR-TOOLS] Priority rules in legacy object format - skipping pre-computation")
            return

        valid_staff_ids = {s['id'] for s in self.staff_members}

        # Day index to name mapping (JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday)
        day_index_to_name = {
            0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
            4: 'thursday', 5: 'friday', 6: 'saturday'
        }

        total_consumption = 0
        processed_rule_ids = set()  # Track processed rule IDs to avoid duplicates

        for rule in priority_rules:
            rule_name = rule.get('name', 'Unnamed')
            rule_id = rule.get('id', '')

            # Skip duplicate rules (same ID already processed)
            if rule_id and rule_id in processed_rule_ids:
                logger.info(f"[PRIORITY-PRE] Skipping duplicate rule '{rule_name}' (id={rule_id})")
                continue
            if rule_id:
                processed_rule_ids.add(rule_id)

            logger.info(f"[PRIORITY-PRE] Processing rule '{rule_name}': keys={list(rule.keys())}")

            # Only process HARD constraints that force shifts
            is_hard = rule.get('isHardConstraint', False)
            if not is_hard:
                constraints = rule.get('constraints', {})
                is_hard = constraints.get('isHardConstraint', False)

            logger.info(f"[PRIORITY-PRE]   isHardConstraint={is_hard}")

            if not is_hard:
                continue  # Skip SOFT rules - they don't guarantee shifts

            if not rule.get('isActive', True):
                logger.info(f"[PRIORITY-PRE]   Skipping inactive rule")
                continue  # Skip inactive rules

            rule_type = rule.get('ruleType', '')

            # Count preferred_shift and required_off rules that force shifts
            # avoided_shift and blocked rules force shift=0, not counted toward off-equivalent
            # If no ruleType specified but has shiftType, assume it's a preferred shift rule
            if rule_type in ['avoided_shift', 'blocked']:
                continue  # These don't force off/early, they prevent shifts

            # Extract staff IDs using helper methods
            staff_id = self._extract_staff_id_from_rule(rule)
            staff_ids = self._extract_staff_ids_from_rule(rule)

            # Build list of all staff IDs this rule applies to
            target_staff_ids = []
            if staff_id and staff_id in valid_staff_ids:
                target_staff_ids.append(staff_id)
            for sid in staff_ids:
                if sid in valid_staff_ids and sid not in target_staff_ids:
                    target_staff_ids.append(sid)

            if not target_staff_ids:
                logger.info(f"[PRIORITY-PRE]   No valid staff IDs found, skipping")
                continue

            logger.info(f"[PRIORITY-PRE]   Staff IDs: {target_staff_ids}")

            # Get shift type from multiple possible locations:
            # 1. Top-level shiftType (camelCase from Go server ToReactFormat)
            # 2. ruleDefinition.shift_type (snake_case from database JSONB)
            # 3. preferences.shiftType (legacy format)
            shift_type_name = rule.get('shiftType', '')
            if not shift_type_name:
                rule_def = rule.get('ruleDefinition', {})
                shift_type_name = rule_def.get('shift_type', '') or rule_def.get('shiftType', '')
            if not shift_type_name:
                prefs = rule.get('preferences', {})
                shift_type_name = prefs.get('shiftType', '')

            shift_type_name = (shift_type_name or 'off').lower()
            logger.info(f"[PRIORITY-PRE]   Shift type: {shift_type_name}")

            # Determine off-equivalent value (scaled by 2)
            if shift_type_name == 'off':
                off_equiv_scaled = 2  # 1.0 off-equivalent
            elif shift_type_name == 'early':
                off_equiv_scaled = 1  # 0.5 off-equivalent
            else:
                continue  # late/work don't count toward off-equivalent

            # Get days of week from multiple possible locations:
            # 1. Top-level daysOfWeek (camelCase from Go server ToReactFormat)
            # 2. ruleDefinition.days_of_week (snake_case from database JSONB)
            # 3. preferences.daysOfWeek (legacy format)
            days_of_week = rule.get('daysOfWeek', [])
            if not days_of_week:
                rule_def = rule.get('ruleDefinition', {})
                days_of_week = rule_def.get('days_of_week', []) or rule_def.get('daysOfWeek', [])
            if not days_of_week:
                prefs = rule.get('preferences', {})
                days_of_week = prefs.get('daysOfWeek', [])

            # Convert to lowercase day names
            # Handle both integer indices (0=Sunday) and string names ("Sunday")
            target_days = []
            for d in days_of_week:
                if isinstance(d, int) and d in day_index_to_name:
                    # Integer index: 0 -> 'sunday'
                    target_days.append(day_index_to_name[d])
                elif isinstance(d, str):
                    # String name: 'Sunday' -> 'sunday'
                    target_days.append(d.lower())

            if not target_days:
                logger.info(f"[PRIORITY-PRE]   No target days found, skipping")
                continue

            logger.info(f"[PRIORITY-PRE]   Days of week: {target_days}")

            # Count matching dates for each staff member
            for target_staff_id in target_staff_ids:
                for date in self.date_range:
                    # Skip calendar off dates (handled separately)
                    if date in self.calendar_off_dates:
                        continue

                    day_name = self._get_day_of_week(date)
                    if day_name in target_days:
                        # This date will be forced by the HARD priority rule
                        current = self.priority_rule_off_equiv.get(target_staff_id, 0)
                        self.priority_rule_off_equiv[target_staff_id] = current + off_equiv_scaled
                        total_consumption += off_equiv_scaled

        # Log the pre-computed consumption
        if self.priority_rule_off_equiv:
            logger.info(f"[OR-TOOLS] 📋 Priority rule off-equivalent pre-consumption:")
            for staff_id, consumed in self.priority_rule_off_equiv.items():
                staff_name = next((s.get('name', staff_id) for s in self.staff_members if s['id'] == staff_id), staff_id)
                logger.info(f"    {staff_name}: {consumed/2:.1f} off-equivalent ({consumed} scaled)")
            logger.info(f"[OR-TOOLS] 📋 Total priority rule consumption: {total_consumption/2:.1f} off-equivalent")
        else:
            logger.info("[OR-TOOLS] 📋 No HARD priority rules with off/early shifts - no pre-consumption")

    def _add_monthly_limits(self):
        """
        Phase 6.6: Monthly MIN/MAX off-day limits with calendar exclusion.

        From AI_GENERATION_FLOW_DOCUMENTATION.md:
        - excludeCalendarRules: must_day_off dates DON'T count toward limits
        - excludeEarlyShiftCalendar: s on must_day_off dates DON'T count

        This ensures staff get their "flexible" off days in addition to holidays.

        IMPORTANT: Pre-filled off days (×) COUNT towards monthly limits!
        - If monthlyLimit.maxCount = 7 and staff has 2 pre-filled × days
        - OR-Tools will only assign at most 5 more × days (7 - 2 = 5)
        - This is automatic because pre-filled cells use the same shift variables

        CONFIGURABLE: Can be HARD or SOFT constraints based on ortoolsConfig.
        - HARD constraint: Strictly enforced, no violations allowed
        - SOFT constraint: Violations allowed with penalty
        """
        monthly_limit = self.constraints_config.get('monthlyLimit', {})

        if not monthly_limit:
            return

        # Handle None/null values for minCount (means no minimum constraint)
        min_off_raw = monthly_limit.get('minCount')
        max_off_raw = monthly_limit.get('maxCount')

        # If minCount is None/null, treat as 0 (no minimum constraint)
        # If maxCount is None/null, use a high default (effectively no maximum)
        # Use floor for min (more lenient) and ceil for max (more lenient)
        import math
        min_off = int(math.floor(float(min_off_raw))) if min_off_raw is not None else 0
        max_off = int(math.ceil(float(max_off_raw))) if max_off_raw is not None else 999
        exclude_calendar = monthly_limit.get('excludeCalendarRules', True)

        # Calculate available flexible dates
        flexible_dates = [d for d in self.date_range if d not in self.calendar_off_dates]
        num_flexible_days = len(flexible_dates)

        # ═══════════════════════════════════════════════════════════════════════════
        # COUNT PRE-FILLED OFF-EQUIVALENT PER STAFF (for logging/reporting)
        # Pre-filled cells ARE included in monthly limits automatically
        # because they use the same shift variables constrained to == 1
        # × counts as 1.0, △ counts as 0.5 off-equivalent
        # ═══════════════════════════════════════════════════════════════════════════
        prefilled_symbols = getattr(self, 'prefilled_symbols', {})
        prefilled_off_equiv_by_staff = {}  # Now tracks scaled off-equivalent (×=2, △=1)

        for (staff_id, date), symbol in prefilled_symbols.items():
            # Check if date should be counted (based on exclude_calendar setting)
            if exclude_calendar and date not in flexible_dates:
                continue

            # Check for OFF symbol (×, x, X) - counts as 2 (scaled)
            if symbol in ['×', '\u00d7', 'x', 'X']:
                prefilled_off_equiv_by_staff[staff_id] = prefilled_off_equiv_by_staff.get(staff_id, 0) + 2
            # Check for STAR symbol (★, ☆) - designated day off, counts as 2 (scaled, = 1.0 off-equivalent)
            elif symbol in ['★', '\u2605', '☆', '\u2606']:
                prefilled_off_equiv_by_staff[staff_id] = prefilled_off_equiv_by_staff.get(staff_id, 0) + 2
            # Check for EARLY symbol (△) - counts as 1 (scaled, = 0.5 off-equivalent)
            elif symbol in ['△', '\u25b3', 's', 'S']:
                prefilled_off_equiv_by_staff[staff_id] = prefilled_off_equiv_by_staff.get(staff_id, 0) + 1

        # Store prefilled off-equivalent for use in constraint calculation
        # Note: × and △ are counted via shift variables, but ★ is mapped to WORK
        # so we need to track ★ separately and add it to the constraint
        self.prefilled_star_equiv_by_staff = {}  # Track ONLY ★ symbols (not counted in shift vars)
        for (staff_id, date), symbol in prefilled_symbols.items():
            if exclude_calendar and date not in flexible_dates:
                continue
            # Only track ★ symbols here (× and △ are already in shift vars)
            if symbol in ['★', '\u2605', '☆', '\u2606']:
                self.prefilled_star_equiv_by_staff[staff_id] = self.prefilled_star_equiv_by_staff.get(staff_id, 0) + 2

        # Log pre-filled off-equivalent summary
        if prefilled_off_equiv_by_staff:
            logger.info(f"[OR-TOOLS] 🔒 Pre-filled off-equivalent (×=1.0, ★=1.0, △=0.5) counts towards monthly limits:")
            for staff_id, scaled_count in prefilled_off_equiv_by_staff.items():
                staff_name = next((s.get('name', staff_id) for s in self.staff_members if s['id'] == staff_id), staff_id)
                off_equiv = scaled_count / 2.0  # Convert back to original scale for display
                remaining_equiv = max_off - off_equiv
                star_count = self.prefilled_star_equiv_by_staff.get(staff_id, 0) // 2
                logger.info(f"    {staff_name}: {off_equiv:.1f} pre-filled off-equiv (★={star_count}) → remaining: {remaining_equiv:.1f} (max {max_off})")

        # Sanity check: can't require more off days than available dates
        min_off = min(min_off, num_flexible_days)
        max_off = min(max_off, num_flexible_days)

        # Ensure min <= max
        if min_off > max_off:
            min_off = max_off

        # Check if monthly limits should be HARD constraints
        # Check both: monthlyLimit.isHardConstraint (direct) AND ortoolsConfig.hardConstraints.monthlyLimits (legacy)
        monthly_limit_is_hard = monthly_limit.get('isHardConstraint', False)
        if not monthly_limit_is_hard:
            ortools_config = self.constraints_config.get('ortoolsConfig', {})
            hard_constraints = ortools_config.get('hardConstraints', {})
            monthly_limit_is_hard = hard_constraints.get('monthlyLimits', False)

        constraint_type = "HARD" if monthly_limit_is_hard else "SOFT"

        # ═══════════════════════════════════════════════════════════════════════════
        # COMBINED OFF-EQUIVALENT: off × 1.0 + early × 0.5
        # Since CP-SAT requires integers, we scale by 2:
        # off × 2 + early × 1 >= min_off × 2
        # off × 2 + early × 1 <= max_off × 2
        #
        # Example with minCount=7, maxCount=8:
        # - Min (scaled) = 7 × 2 = 14
        # - Max (scaled) = 8 × 2 = 16
        # - Valid: 7× + 0△ = 14 ✅ (7 off-equivalent)
        # - Valid: 5× + 4△ = 10 + 4 = 14 ✅ (7 off-equivalent)
        # - Valid: 3× + 8△ = 6 + 8 = 14 ✅ (7 off-equivalent)
        # ═══════════════════════════════════════════════════════════════════════════
        min_scaled = min_off * 2  # Scale by 2 for integer math
        max_scaled = max_off * 2

        logger.info(f"[OR-TOOLS] Adding monthly limits ({constraint_type}): min={min_off} (scaled={min_scaled}), max={max_off} (scaled={max_scaled}), exclude_calendar={exclude_calendar}, flexible_days={num_flexible_days}...")
        logger.info(f"    Formula: off×2 + early×1 in [{min_scaled}, {max_scaled}] (early counts as 0.5 off-equivalent)")

        constraint_count = 0
        total_days = len(self.date_range)
        skipped_backup_count = 0

        for staff in self.staff_members:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)

            # ═══════════════════════════════════════════════════════════════════════════
            # BACKUP STAFF - Apply RELAXED monthly limits (not exempt)
            # Backup staff should still have reasonable day-off limits to avoid imbalance
            # Use 1.5x the normal max to give them flexibility for coverage
            # ═══════════════════════════════════════════════════════════════════════════
            is_backup = staff_id in self.backup_staff_ids
            backup_max_scaled = None  # Will be set if backup
            backup_min_scaled = None

            if is_backup:
                # Apply relaxed limits for backup staff (1.5x normal max)
                backup_max_off = int(max_off * 1.5)  # e.g., 10 * 1.5 = 15
                backup_min_off = 0  # No minimum for backup
                backup_max_scaled = backup_max_off * 2
                backup_min_scaled = backup_min_off * 2
                logger.info(f"  🛡️ Backup staff {staff_name}: relaxed limits min={backup_min_off}, max={backup_max_off} (1.5x normal)")

            # ═══════════════════════════════════════════════════════════════════════════
            # PRORATE MONTHLY LIMITS FOR STAFF WITH start_period OR end_period
            # Staff who join mid-period or leave mid-period have fewer working days,
            # so limits should be proportionally reduced to avoid INFEASIBLE scenarios.
            #
            # Formula (based on 5-day work rule):
            #   actual_working_days = days within employment period
            #   min_off = floor(actual_working_days / 4.25) rounded down
            #   This ensures approximately 1 off day per ~4-5 work days
            #   Example: 29 days → 29/4.25 = 6.82 → 6 minimum off days
            # ═══════════════════════════════════════════════════════════════════════════
            start_date = self.staff_start_dates.get(staff_id)
            end_date = self.staff_end_dates.get(staff_id)

            # Calculate actual working days using _staff_works_on_date
            actual_working_days = sum(1 for d in self.date_range if self._staff_works_on_date(staff_id, d))

            if start_date or end_date:
                # Staff has partial employment period - prorate limits
                total_days = len(self.date_range)

                if actual_working_days < total_days and actual_working_days > 0:
                    # Calculate prorated limits based on working days
                    # Formula: min_off = floor(working_days / 4.25)
                    # This ensures approximately 1 off day per ~4-5 work days
                    calculated_min = max(0, int(actual_working_days / 4.25))

                    # Max should be proportionally scaled from original
                    prorate_ratio = actual_working_days / total_days
                    calculated_max = max(calculated_min + 1, int((max_scaled / 2) * prorate_ratio))

                    # Scale for combined off-equivalent (off × 2 + early × 1)
                    staff_min_scaled = calculated_min * 2
                    staff_max_scaled = calculated_max * 2

                    period_info = []
                    if start_date:
                        period_info.append(f"start={start_date}")
                    if end_date:
                        period_info.append(f"end={end_date}")

                    logger.info(f"  📅 {staff_name}: {', '.join(period_info)}, works {actual_working_days}/{total_days} days")
                    logger.info(f"      → Prorated limits: min={staff_min_scaled/2:.1f}, max={staff_max_scaled/2:.1f} (ratio={prorate_ratio:.2f})")
                else:
                    # Edge case: no working days or full period
                    staff_min_scaled = min_scaled
                    staff_max_scaled = max_scaled
            else:
                # No start_period or end_period - use original limits
                staff_min_scaled = min_scaled
                staff_max_scaled = max_scaled

            # ═══════════════════════════════════════════════════════════════════════════
            # OVERRIDE WITH BACKUP LIMITS if this is backup staff
            # Backup staff get relaxed limits regardless of prorating
            # ═══════════════════════════════════════════════════════════════════════════
            if is_backup and backup_max_scaled is not None:
                staff_min_scaled = backup_min_scaled
                staff_max_scaled = backup_max_scaled
                logger.info(f"      → Using backup limits: min={staff_min_scaled/2:.1f}, max={staff_max_scaled/2:.1f}")

            # ═══════════════════════════════════════════════════════════════════════════
            # Get priority rule off-equivalent consumption for this staff (FOR LOGGING ONLY)
            # Priority rules with HARD constraints force shifts that count toward limits
            #
            # IMPORTANT: Do NOT adjust the monthly limit by priority consumption!
            # The priority-forced shifts are counted in combined_scaled automatically
            # since they use the same shift variables. Adjusting would double-count.
            #
            # Example: max=4 off-equiv (scaled=8), 4 Sunday early priority (2 off-equiv)
            #   - Priority forces: early[sunday1-4] == 1 (contributes 4 to combined_scaled)
            #   - Constraint: combined_scaled <= 8 (original, NOT adjusted)
            #   - If solver assigns 2 more off days: combined_scaled = 4 + 4 = 8 ✓
            #   - Total off-equiv: 2 (priority) + 2 (free) = 4 ✓
            # ═══════════════════════════════════════════════════════════════════════════
            priority_consumed = getattr(self, 'priority_rule_off_equiv', {}).get(staff_id, 0)

            if priority_consumed > 0:
                # Log the priority consumption for visibility (but don't adjust limits)
                logger.info(f"  📋 {staff_name}: priority rules force {priority_consumed/2:.1f} off-equiv (will count in combined total)")
                logger.info(f"      → Monthly limit: max={staff_max_scaled/2:.1f}, min={staff_min_scaled/2:.1f} (includes priority shifts)")

            if exclude_calendar:
                # Count combined off-equivalent for flexible dates (excluding calendar)
                # off × 2 + early × 1 + prefilled_star × 2
                # IMPORTANT: Only include dates where staff is employed (before end_period) AND shift var exists
                staff_flexible_dates = [d for d in flexible_dates if self._staff_works_on_date(staff_id, d) and self._has_shift_var(staff_id, d)]
                off_vars = [self.shifts[(staff_id, date, self.SHIFT_OFF)] for date in staff_flexible_dates]
                early_vars = [self.shifts[(staff_id, date, self.SHIFT_EARLY)] for date in staff_flexible_dates]

                # Get pre-filled ★ count for this staff (★ is mapped to WORK but counts as off-equivalent)
                prefilled_star_scaled = self.prefilled_star_equiv_by_staff.get(staff_id, 0)

                # Create scaled sum: off × 2 + early × 1 + prefilled_star (already scaled)
                combined_scaled = sum(var * 2 for var in off_vars) + sum(var * 1 for var in early_vars) + prefilled_star_scaled

                # Upper bound for violation variables (scaled) - based on staff's working days
                max_possible = len(staff_flexible_dates) * 3

                if monthly_limit_is_hard:
                    # HARD CONSTRAINT: Strictly enforce PRORATED limits
                    # Priority-forced shifts count in combined_scaled automatically
                    if staff_min_scaled > 0:
                        self.model.Add(combined_scaled >= staff_min_scaled)
                        constraint_count += 1
                    self.model.Add(combined_scaled <= staff_max_scaled)
                    constraint_count += 1
                else:
                    # SOFT CONSTRAINT for min: Penalize if below PRORATED minimum
                    if staff_min_scaled > 0:
                        under_min_var = self.model.NewIntVar(0, max_possible, f'monthly_under_min_{staff_id}')
                        self.model.Add(under_min_var >= staff_min_scaled - combined_scaled)
                        self.model.Add(under_min_var >= 0)
                        self.violation_vars.append((
                            under_min_var,
                            self.PENALTY_WEIGHTS['monthly_limit'],
                            f'Monthly under-minimum for {staff_name}'
                        ))
                        constraint_count += 1

                    # SOFT CONSTRAINT for max: Penalize if above PRORATED maximum
                    over_max_var = self.model.NewIntVar(0, max_possible, f'monthly_over_max_{staff_id}')
                    self.model.Add(over_max_var >= combined_scaled - staff_max_scaled)
                    self.model.Add(over_max_var >= 0)
                    self.violation_vars.append((
                        over_max_var,
                        self.PENALTY_WEIGHTS['monthly_limit'],
                        f'Monthly over-maximum for {staff_name}'
                    ))
                    constraint_count += 1
            else:
                # Count combined off-equivalent for all dates
                # off × 2 + early × 1 + prefilled_star × 2
                # IMPORTANT: Only include dates where staff is employed (before end_period) AND shift var exists
                staff_all_dates = [d for d in self.date_range if self._staff_works_on_date(staff_id, d) and self._has_shift_var(staff_id, d)]
                off_vars = [self.shifts[(staff_id, date, self.SHIFT_OFF)] for date in staff_all_dates]
                early_vars = [self.shifts[(staff_id, date, self.SHIFT_EARLY)] for date in staff_all_dates]

                # Get pre-filled ★ count for this staff (★ is mapped to WORK but counts as off-equivalent)
                prefilled_star_scaled = self.prefilled_star_equiv_by_staff.get(staff_id, 0)

                combined_scaled = sum(var * 2 for var in off_vars) + sum(var * 1 for var in early_vars) + prefilled_star_scaled
                max_possible = len(staff_all_dates) * 3

                if monthly_limit_is_hard:
                    # HARD CONSTRAINT: Strictly enforce PRORATED limits
                    # Priority-forced shifts count in combined_scaled automatically
                    if staff_min_scaled > 0:
                        self.model.Add(combined_scaled >= staff_min_scaled)
                        constraint_count += 1
                    self.model.Add(combined_scaled <= staff_max_scaled)
                    constraint_count += 1
                else:
                    # SOFT CONSTRAINT for min: Penalize if below PRORATED minimum
                    if staff_min_scaled > 0:
                        under_min_var = self.model.NewIntVar(0, max_possible, f'monthly_under_min_{staff_id}')
                        self.model.Add(under_min_var >= staff_min_scaled - combined_scaled)
                        self.model.Add(under_min_var >= 0)
                        self.violation_vars.append((
                            under_min_var,
                            self.PENALTY_WEIGHTS['monthly_limit'],
                            f'Monthly under-minimum for {staff_name}'
                        ))
                        constraint_count += 1

                    # SOFT CONSTRAINT for max: Penalize if above PRORATED maximum
                    over_max_var = self.model.NewIntVar(0, max_possible, f'monthly_over_max_{staff_id}')
                    self.model.Add(over_max_var >= combined_scaled - staff_max_scaled)
                    self.model.Add(over_max_var >= 0)
                    self.violation_vars.append((
                        over_max_var,
                        self.PENALTY_WEIGHTS['monthly_limit'],
                        f'Monthly over-maximum for {staff_name}'
                    ))
                    constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} monthly limit {constraint_type.lower()} constraints (with early=0.5 weight)")

    def _add_monthly_early_shift_limits(self):
        """
        Limit monthly early shifts (△) for 社員 staff type to maximum 3 per month.

        This is a HARD constraint to ensure no 社員 gets more than 3 early shifts
        in a given month, preventing overload of early morning duties.
        """
        MAX_EARLY_PER_MONTH = 3
        STAFF_TYPE_SHAIN = '社員'

        # Debug: Log all staff types
        logger.info(f"[OR-TOOLS] Staff types in data:")
        for s in self.staff_members:
            logger.info(f"    {s.get('name', 'Unknown')}: type='{s.get('type')}', status='{s.get('status')}'")

        # Get all 社員 staff members - check both 'type' and 'status' fields
        shain_staff = [s for s in self.staff_members if s.get('type') == STAFF_TYPE_SHAIN or s.get('status') == STAFF_TYPE_SHAIN]

        if not shain_staff:
            logger.info(f"[OR-TOOLS] No {STAFF_TYPE_SHAIN} staff found - skipping monthly early limit")
            return

        logger.info(f"[OR-TOOLS] Adding monthly early shift limit (max {MAX_EARLY_PER_MONTH}) for {len(shain_staff)} {STAFF_TYPE_SHAIN} staff...")
        constraint_count = 0

        for staff in shain_staff:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)

            # Get all dates this staff works (before end_period)
            working_dates = [d for d in self.date_range if self._staff_works_on_date(staff_id, d)]

            if not working_dates:
                continue

            # Sum all early shift variables for this staff across the month
            # FIX: Only include dates where shift variable exists
            early_vars = [self.shifts[(staff_id, date, self.SHIFT_EARLY)]
                         for date in working_dates
                         if (staff_id, date, self.SHIFT_EARLY) in self.shifts]
            total_early = sum(early_vars)

            # HARD constraint: max 3 early shifts per month
            self.model.Add(total_early <= MAX_EARLY_PER_MONTH)
            constraint_count += 1
            logger.info(f"    {staff_name}: max {MAX_EARLY_PER_MONTH} early shifts across {len(working_dates)} days")

        logger.info(f"[OR-TOOLS] Added {constraint_count} monthly early shift limit constraints for {STAFF_TYPE_SHAIN}")

    def _add_adjacent_conflict_prevention(self):
        """
        Prevent adjacent conflict patterns (SOFT - allows violations with penalty).

        From hasAdjacentConflict() in BusinessRuleValidator.js (lines 51-93):
        - No xx (two consecutive off days)
        - No sx (early shift followed by off)
        - No xs (off followed by early shift)
        - No ss (two consecutive early shifts) - ADDED to prevent early shift overload

        SOFT CONSTRAINT: Instead of hard failure, we add penalty for violations.
        This allows OR-Tools to provide best-effort solutions like TensorFlow.

        Calendar handling:
        - If BOTH dates are calendar_off_dates, skip (both are forced off anyway)
        - If only ONE date is calendar_off_date, we should still apply some constraints
          to prevent patterns that could form with the adjacent non-calendar date

        Pre-filled cell handling:
        - If a date has a pre-filled cell that is NOT an off day (×), prevent day-off adjacent to it
        - This ensures pre-filled working shifts don't get surrounded by day-offs
        """
        logger.info("[OR-TOOLS] Adding adjacent conflict prevention (SOFT) (no xx, sx, xs)...")

        constraint_count = 0
        prefilled_adjacent_count = 0

        # Get pre-filled symbols for checking (set during _add_prefilled_constraints)
        prefilled_symbols = getattr(self, 'prefilled_symbols', {})

        for staff in self.staff_members:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)

            for i in range(len(self.date_range) - 1):
                date1 = self.date_range[i]
                date2 = self.date_range[i + 1]

                date1_is_calendar = date1 in self.calendar_off_dates
                date2_is_calendar = date2 in self.calendar_off_dates

                # Check if dates are pre-filled (and what type)
                date1_prefilled_symbol = prefilled_symbols.get((staff_id, date1))
                date2_prefilled_symbol = prefilled_symbols.get((staff_id, date2))
                date1_is_prefilled_work = date1_prefilled_symbol is not None and date1_prefilled_symbol != '×'
                date2_is_prefilled_work = date2_prefilled_symbol is not None and date2_prefilled_symbol != '×'

                # If BOTH dates are calendar must_day_off, skip entirely
                # (both are forced to off anyway, nothing to constrain)
                if date1_is_calendar and date2_is_calendar:
                    continue

                # FIX: Skip if shift variables don't exist for either date
                # (staff with start_period after this date or end_period before this date)
                if not self._has_shift_var(staff_id, date1) or not self._has_shift_var(staff_id, date2):
                    continue

                # If date1 is calendar (forced off), only prevent xs pattern
                # (can't prevent xx since date1 is already fixed to off)
                if date1_is_calendar:
                    continue

                # If date2 is calendar (forced off), only prevent sx pattern
                if date2_is_calendar:
                    continue

                # ═══════════════════════════════════════════════════════════════════════════
                # PRE-FILLED CELL PROTECTION: Prevent day-off adjacent to pre-filled work cells
                # ═══════════════════════════════════════════════════════════════════════════
                # If date1 has a pre-filled work cell (not ×), prevent day-off on date2
                if date1_is_prefilled_work and not date2_is_calendar:
                    # Add SOFT constraint: date2 should not be off if date1 is pre-filled work
                    prefilled_off_violation = self.model.NewBoolVar(f'prefilled_off_{staff_id}_{date1}_{date2}')
                    self.model.Add(self.shifts[(staff_id, date2, self.SHIFT_OFF)] == 0).OnlyEnforceIf(prefilled_off_violation.Not())
                    self.model.Add(self.shifts[(staff_id, date2, self.SHIFT_OFF)] == 1).OnlyEnforceIf(prefilled_off_violation)
                    # Use high penalty (500) to strongly discourage day-off next to pre-filled work
                    self.violation_vars.append((
                        prefilled_off_violation,
                        500,  # High penalty for day-off adjacent to pre-filled work
                        f'Day-off after pre-filled work ({date1_prefilled_symbol}) for {staff_name} on {date2}'
                    ))
                    prefilled_adjacent_count += 1

                # If date2 has a pre-filled work cell (not ×), prevent day-off on date1
                if date2_is_prefilled_work and not date1_is_calendar:
                    # Add SOFT constraint: date1 should not be off if date2 is pre-filled work
                    prefilled_off_violation = self.model.NewBoolVar(f'prefilled_off_{staff_id}_{date2}_{date1}')
                    self.model.Add(self.shifts[(staff_id, date1, self.SHIFT_OFF)] == 0).OnlyEnforceIf(prefilled_off_violation.Not())
                    self.model.Add(self.shifts[(staff_id, date1, self.SHIFT_OFF)] == 1).OnlyEnforceIf(prefilled_off_violation)
                    # Use high penalty (500) to strongly discourage day-off next to pre-filled work
                    self.violation_vars.append((
                        prefilled_off_violation,
                        500,  # High penalty for day-off adjacent to pre-filled work
                        f'Day-off before pre-filled work ({date2_prefilled_symbol}) for {staff_name} on {date1}'
                    ))
                    prefilled_adjacent_count += 1

                # Neither date is calendar rule - apply all adjacent constraints as SOFT
                # SOFT CONSTRAINT for xx (two consecutive off days)
                xx_sum = self.shifts[(staff_id, date1, self.SHIFT_OFF)] + self.shifts[(staff_id, date2, self.SHIFT_OFF)]
                xx_violation = self.model.NewBoolVar(f'xx_violation_{staff_id}_{date1}')
                # xx_violation = 1 if xx_sum > 1 (i.e., both are off)
                self.model.Add(xx_sum <= 1).OnlyEnforceIf(xx_violation.Not())
                self.model.Add(xx_sum >= 2).OnlyEnforceIf(xx_violation)
                self.violation_vars.append((
                    xx_violation,
                    self.PENALTY_WEIGHTS['adjacent_conflict'],
                    f'Consecutive off days for {staff_name} on {date1}-{date2}'
                ))
                constraint_count += 1

                # SOFT CONSTRAINT for sx (early then off)
                sx_sum = self.shifts[(staff_id, date1, self.SHIFT_EARLY)] + self.shifts[(staff_id, date2, self.SHIFT_OFF)]
                sx_violation = self.model.NewBoolVar(f'sx_violation_{staff_id}_{date1}')
                self.model.Add(sx_sum <= 1).OnlyEnforceIf(sx_violation.Not())
                self.model.Add(sx_sum >= 2).OnlyEnforceIf(sx_violation)
                self.violation_vars.append((
                    sx_violation,
                    self.PENALTY_WEIGHTS['adjacent_conflict'],
                    f'Early-then-off for {staff_name} on {date1}-{date2}'
                ))
                constraint_count += 1

                # SOFT CONSTRAINT for xs (off then early)
                xs_sum = self.shifts[(staff_id, date1, self.SHIFT_OFF)] + self.shifts[(staff_id, date2, self.SHIFT_EARLY)]
                xs_violation = self.model.NewBoolVar(f'xs_violation_{staff_id}_{date1}')
                self.model.Add(xs_sum <= 1).OnlyEnforceIf(xs_violation.Not())
                self.model.Add(xs_sum >= 2).OnlyEnforceIf(xs_violation)
                self.violation_vars.append((
                    xs_violation,
                    self.PENALTY_WEIGHTS['adjacent_conflict'],
                    f'Off-then-early for {staff_name} on {date1}-{date2}'
                ))
                constraint_count += 1

                # SOFT CONSTRAINT for ss (consecutive early shifts) - NEW
                ss_sum = self.shifts[(staff_id, date1, self.SHIFT_EARLY)] + self.shifts[(staff_id, date2, self.SHIFT_EARLY)]
                ss_violation = self.model.NewBoolVar(f'ss_violation_{staff_id}_{date1}')
                self.model.Add(ss_sum <= 1).OnlyEnforceIf(ss_violation.Not())
                self.model.Add(ss_sum >= 2).OnlyEnforceIf(ss_violation)
                self.violation_vars.append((
                    ss_violation,
                    self.PENALTY_WEIGHTS['adjacent_conflict'],
                    f'Consecutive early shifts for {staff_name} on {date1}-{date2}'
                ))
                constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} adjacent conflict soft constraints (incl. no consecutive early)")
        if prefilled_adjacent_count > 0:
            logger.info(f"[OR-TOOLS] Added {prefilled_adjacent_count} pre-filled work protection constraints (penalty=500)")

    def _add_5_day_rest_constraint(self):
        """
        PHASE 4: 5-day rest constraint (labor law compliance) - CONFIGURABLE HARD/SOFT.

        From enforce5DayRestConstraint() in BusinessRuleValidator.js (lines 2417-2537):
        - No more than 5 consecutive work days
        - At least 1 rest day (off=x) in every 6-day window

        NOTE: The 6-day window is CORRECT! To prevent 6+ consecutive work days,
        we check that every window of 6 consecutive days has at least 1 off day.
        If any 6-day window has 0 off days, that means 6 consecutive work days (violation).

        IMPORTANT: Only OFF (×) counts as rest day, not early shift (△).
        Early shift is still work, just at a different time.

        CONSTRAINT MODES:
        - HARD: Strictly enforced - solver will fail if no valid solution exists
        - SOFT: Violations allowed but penalized with very HIGH weight (labor law)
        """
        # Check if 5-day rest should be HARD constraint
        ortools_config = self.constraints_config.get('ortoolsConfig', {})
        hard_constraints = ortools_config.get('hardConstraints', {})
        five_day_rest_is_hard = hard_constraints.get('fiveDayRest', False)

        constraint_mode = "HARD" if five_day_rest_is_hard else "SOFT"
        logger.info(f"[OR-TOOLS] Adding 5-day rest constraint ({constraint_mode}) (max 5 consecutive work days)...")

        constraint_count = 0

        for staff in self.staff_members:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)

            # Check every possible 6-day window
            # len(date_range) - 5 ensures we have exactly 6 dates in the window
            for i in range(len(self.date_range) - 5):
                window = self.date_range[i:i+6]

                # Filter window to only include dates where staff works AND has shift variables
                active_window = [d for d in window if self._staff_works_on_date(staff_id, d) and self._has_shift_var(staff_id, d)]

                # Skip if window has no active dates (staff doesn't work in this period)
                # Also skip if window is less than 6 days (staff ends mid-window)
                if len(active_window) < 6:
                    continue

                # At least 1 OFF day (x) in the 6-day window
                # Only OFF counts as true rest, not early shift
                off_days = sum([
                    self.shifts[(staff_id, date, self.SHIFT_OFF)]
                    for date in active_window
                ])

                if five_day_rest_is_hard:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # HARD CONSTRAINT: Strictly enforce at least 1 off day per 6-day window
                    # ═══════════════════════════════════════════════════════════════════════════
                    # This will make the solver fail if 5-day rest cannot be satisfied
                    self.model.Add(off_days >= 1)
                    constraint_count += 1
                else:
                    # ═══════════════════════════════════════════════════════════════════════════
                    # SOFT CONSTRAINT: Penalize violations with very high weight (labor law)
                    # ═══════════════════════════════════════════════════════════════════════════
                    # violation = max(0, 1 - off_days)
                    # If off_days >= 1: violation = 0 (compliant)
                    # If off_days == 0: violation = 1 (6 consecutive work days)
                    rest_violation = self.model.NewBoolVar(f'5day_rest_violation_{staff_id}_{i}')
                    self.model.Add(off_days >= 1).OnlyEnforceIf(rest_violation.Not())
                    self.model.Add(off_days == 0).OnlyEnforceIf(rest_violation)
                    self.violation_vars.append((
                        rest_violation,
                        self.PENALTY_WEIGHTS['5_day_rest'],
                        f'6+ consecutive work days for {staff_name} starting {window[0]}'
                    ))
                    constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} 5-day rest {constraint_mode} constraints")

    def _add_post_period_constraints(self):
        """
        Post day-off period constraints.

        After a long day-off period (must_day_off), apply constraints on the day after:
        - Avoid day-off (×) for 社員 and 派遣 staff
        - Allow early shift (△) for 社員 staff

        This ensures adequate staffing when returning from maintenance/holiday periods.

        Configuration from constraints_config['earlyShiftConfig']['postPeriodConstraint']:
        {
            'enabled': bool,
            'isHardConstraint': bool,        # HARD (escape hatch) vs SOFT (penalty) mode
            'minPeriodLength': int,          # Minimum consecutive days (default: 3)
            'avoidDayOffForShain': bool,     # Avoid × for 社員
            'avoidDayOffForHaken': bool,     # Avoid × for 派遣
            'allowEarlyForShain': bool,      # Allow △ for 社員
        }
        """
        # Enhanced logging header
        logger.info("=" * 60)
        logger.info("[OR-TOOLS] POST DAY-OFF PERIOD CONSTRAINTS")
        logger.info("=" * 60)

        # Get early shift config from constraints
        early_shift_config = self.constraints_config.get('earlyShiftConfig', {})
        logger.info(f"  earlyShiftConfig received: {early_shift_config}")

        post_period_config = early_shift_config.get('postPeriodConstraint', {})
        logger.info(f"  postPeriodConstraint: {post_period_config}")

        if not post_period_config.get('enabled', False):
            logger.info("  Status: DISABLED (enabled=False)")
            logger.info("=" * 60)
            return

        logger.info("  Status: ENABLED - Processing constraints...")

        # Extract configuration options
        min_period_length = post_period_config.get('minPeriodLength', 3)
        is_hard_constraint = post_period_config.get('isHardConstraint', True)  # Default: HARD mode
        avoid_dayoff_shain = post_period_config.get('avoidDayOffForShain', True)
        avoid_dayoff_haken = post_period_config.get('avoidDayOffForHaken', True)
        allow_early_shain = post_period_config.get('allowEarlyForShain', True)
        post_period_days = post_period_config.get('postPeriodDays', 2)  # NEW: Number of days to protect after period (default: 2)

        constraint_mode = "HARD (with escape hatch)" if is_hard_constraint else "SOFT (penalty-based)"
        logger.info(f"  Config: minPeriodLength={min_period_length}, mode={constraint_mode}, postPeriodDays={post_period_days}")
        logger.info(f"  Config: avoidDayOffForShain={avoid_dayoff_shain}, avoidDayOffForHaken={avoid_dayoff_haken}, allowEarlyForShain={allow_early_shain}")

        # Find the day after each day-off period ends
        # Group consecutive must_day_off dates into periods
        calendar_rules = self.constraints_config.get('calendarRules', {})

        # DIAGNOSTIC: Log the actual calendar_rules structure
        logger.info(f"  [DIAGNOSTIC] Calendar rules received (first 5 entries):")
        for idx, (date, rule) in enumerate(list(calendar_rules.items())[:5]):
            logger.info(f"    {date}: {rule} (type: {type(rule).__name__})")

        must_day_off_dates = sorted([
            date for date, rule in calendar_rules.items()
            if isinstance(rule, dict) and rule.get('must_day_off') and date in self.date_range
        ])

        # DIAGNOSTIC: Also check if any use the string format
        must_day_off_dates_alt = sorted([
            date for date, rule in calendar_rules.items()
            if rule == 'must_day_off' and date in self.date_range
        ])

        logger.info(f"  [DIAGNOSTIC] must_day_off dates (dict format): {must_day_off_dates}")
        logger.info(f"  [DIAGNOSTIC] must_day_off dates (string format): {must_day_off_dates_alt}")

        # Use the one that has data
        if not must_day_off_dates and must_day_off_dates_alt:
            logger.info(f"  [DIAGNOSTIC] Switching to string format - found {len(must_day_off_dates_alt)} dates")
            must_day_off_dates = must_day_off_dates_alt

        if not must_day_off_dates:
            logger.info("  No must_day_off dates found - skipping post-period constraints")
            return

        # Group consecutive dates into periods
        from datetime import datetime, timedelta

        periods = []
        current_period = {'start': must_day_off_dates[0], 'end': must_day_off_dates[0]}

        for i in range(1, len(must_day_off_dates)):
            prev_date = datetime.strptime(must_day_off_dates[i-1], '%Y-%m-%d')
            curr_date = datetime.strptime(must_day_off_dates[i], '%Y-%m-%d')
            diff_days = (curr_date - prev_date).days

            if diff_days == 1:
                # Consecutive - extend current period
                current_period['end'] = must_day_off_dates[i]
            else:
                # Gap - save current period and start new one
                periods.append(current_period)
                current_period = {'start': must_day_off_dates[i], 'end': must_day_off_dates[i]}

        periods.append(current_period)

        logger.info(f"  Found {len(periods)} day-off periods (before filtering)")

        # Filter periods by minimum length (only apply to long periods)
        filtered_periods = []
        for period in periods:
            start_date = datetime.strptime(period['start'], '%Y-%m-%d')
            end_date = datetime.strptime(period['end'], '%Y-%m-%d')
            period_length = (end_date - start_date).days + 1  # +1 to include both start and end

            if period_length >= min_period_length:
                filtered_periods.append(period)
                logger.info(f"    Period {period['start']} ~ {period['end']} ({period_length} days) → INCLUDED")
            else:
                logger.info(f"    Period {period['start']} ~ {period['end']} ({period_length} days) → SKIPPED (< {min_period_length})")

        periods = filtered_periods
        logger.info(f"  Filtered to {len(periods)} periods with {min_period_length}+ days")

        if not periods:
            logger.info(f"  No periods ≥ {min_period_length} days - skipping post-period constraints")
            logger.info("=" * 60)
            return

        # Find the days after each period ends (supports multiple days via postPeriodDays config)
        post_period_dates = []
        for period in periods:
            end_date = datetime.strptime(period['end'], '%Y-%m-%d')

            # Generate multiple post-period dates based on postPeriodDays config
            period_post_dates = []
            for day_offset in range(1, post_period_days + 1):
                post_date = (end_date + timedelta(days=day_offset)).strftime('%Y-%m-%d')

                # Only add if the date is within our date range
                if post_date in self.date_range:
                    post_period_dates.append(post_date)
                    period_post_dates.append(post_date)

            if period_post_dates:
                logger.info(f"    Period {period['start']} ~ {period['end']} → Post-period dates: {period_post_dates}")

        if not post_period_dates:
            logger.info("  No post-period dates within schedule range")
            logger.info("=" * 60)
            return

        # DIAGNOSTIC: Confirm what dates will be protected
        logger.info(f"  [DIAGNOSTIC] POST-PERIOD DATES TO PROTECT: {post_period_dates}")
        logger.info(f"  [DIAGNOSTIC] These dates will have HARD constraints against day-off (×)")

        constraint_count = 0
        escape_hatch_count = 0

        # Penalty weights based on mode
        if is_hard_constraint:
            escape_penalty = 10000  # 20x higher than SOFT mode
            logger.info(f"  Using HARD mode with escape hatch (penalty={escape_penalty})")
        else:
            standard_penalty = 500
            logger.info(f"  Using SOFT mode (penalty={standard_penalty})")

        for date in post_period_dates:
            logger.info(f"  [DIAGNOSTIC] Processing post-period date: {date}")
            staff_constraint_count = 0

            for staff in self.staff_members:
                staff_id = staff['id']
                staff_name = staff.get('name', staff_id)
                staff_status = staff.get('status', '社員')

                # Skip if staff doesn't work on this date
                if not self._staff_works_on_date(staff_id, date) or not self._has_shift_var(staff_id, date):
                    logger.debug(f"    Skipping {staff_name}: doesn't work on {date}")
                    continue

                # Determine if constraint applies to this staff type
                should_avoid_dayoff = (
                    (staff_status == '社員' and avoid_dayoff_shain) or
                    (staff_status == '派遣' and avoid_dayoff_haken)
                )

                if should_avoid_dayoff:
                    staff_constraint_count += 1
                    off_var = self.shifts[(staff_id, date, self.SHIFT_OFF)]

                    if is_hard_constraint:
                        # HARD MODE: Conditional constraint with escape hatch
                        escape_var = self.model.NewBoolVar(f'post_period_escape_{staff_id}_{date}')

                        # Cannot have off day UNLESS escape hatch is triggered
                        # Logically: off_var == 0 OR escape_var == 1
                        # Using OnlyEnforceIf: off_var == 0 is enforced when escape_var == 0
                        self.model.Add(off_var == 0).OnlyEnforceIf(escape_var.Not())

                        # Heavily penalize escape hatch usage
                        self.violation_vars.append((
                            escape_var,
                            escape_penalty,
                            f'HARD escape: Post-period day-off for {staff_name} ({staff_status}) on {date}'
                        ))
                        escape_hatch_count += 1
                        constraint_count += 1

                        logger.debug(f"    HARD: {staff_name} ({staff_status}) cannot have × on {date} (escape penalty={escape_penalty})")
                    else:
                        # SOFT MODE: Standard penalty approach
                        self.violation_vars.append((
                            off_var,
                            standard_penalty,
                            f'Post-period day-off avoided for {staff_name} ({staff_status}) on {date}'
                        ))
                        constraint_count += 1

                        logger.debug(f"    SOFT: {staff_name} ({staff_status}) avoid × on {date} (penalty={standard_penalty})")

                    # If allowEarlyForShain is enabled, add slight preference for early shift
                    if staff_status == '社員' and allow_early_shain:
                        early_var = self.shifts[(staff_id, date, self.SHIFT_EARLY)]
                        if not hasattr(self, 'preferred_vars'):
                            self.preferred_vars = []
                        self.preferred_vars.append((early_var, 20))  # Small preference weight
                        logger.debug(f"    {staff_name}: Prefer △ on {date} (preference=20)")

            logger.info(f"    → Applied constraints to {staff_constraint_count} staff on {date}")

        if is_hard_constraint:
            logger.info(f"  Added {constraint_count} post-period HARD constraints (escape hatches={escape_hatch_count}, penalty={escape_penalty})")
        else:
            logger.info(f"  Added {constraint_count} post-period SOFT constraints (penalty={standard_penalty})")

        logger.info("=" * 60)

    def _add_priority_rules(self):
        """
        PHASE 1: Staff priority rules (preferred and avoided shifts).

        Note: These are implemented as SOFT constraints (in objective function)
        rather than HARD constraints, because they're preferences not requirements.

        IMPORTANT: priorityRules format from React (ARRAY format):
        [
            {
                id, name, ruleType, staffId, shiftType, daysOfWeek: [0-6],
                priorityLevel, preferenceStrength, isHardConstraint, ...
            },
            ...
        ]
        daysOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday

        CRITICAL: staffId can come from multiple locations (matching React's fallback chain):
        - rule.staffId (top-level camelCase)
        - rule.staff_id (top-level snake_case)
        - rule.ruleDefinition.staff_id (nested JSONB)
        - rule.ruleDefinition.staffId (nested camelCase)
        - rule.staffIds[] (multi-staff array)
        - rule.staff_ids[] (multi-staff snake_case)
        - rule.preferences.staffId (legacy format)
        """
        priority_rules = self.constraints_config.get('priorityRules', [])

        if not priority_rules:
            logger.info("[OR-TOOLS] No priority rules provided")
            return

        # Handle both array and object formats for backwards compatibility
        if isinstance(priority_rules, dict):
            # Old object format: { staffId: { preferredShifts: [...], avoidedShifts: [...] } }
            self._add_priority_rules_object_format(priority_rules)
            return

        # New array format from React
        logger.info(f"[OR-TOOLS] Processing {len(priority_rules)} priority rules (array format)...")

        # Log sample rule structure for debugging
        if priority_rules:
            sample = priority_rules[0]
            logger.info(f"  Sample rule keys: {list(sample.keys())}")
            logger.info(f"  Sample staffId: {sample.get('staffId')}")
            logger.info(f"  Sample staff_id: {sample.get('staff_id')}")
            logger.info(f"  Sample ruleDefinition: {sample.get('ruleDefinition')}")
            logger.info(f"  Sample preferences: {sample.get('preferences')}")

        # For now, implement as soft constraints via objective
        # The objective function will try to maximize these
        self.preferred_vars = []
        self.avoided_vars = []

        # Create a lookup for valid staff IDs
        valid_staff_ids = {s['id'] for s in self.staff_members}
        rules_applied = 0
        rules_skipped = 0
        processed_rule_ids = set()  # Track processed rule IDs to avoid duplicates

        for rule in priority_rules:
            rule_id = rule.get('id', '')

            # Skip duplicate rules (same ID already processed)
            if rule_id and rule_id in processed_rule_ids:
                logger.info(f"  Skipping duplicate rule '{rule.get('name', 'Unnamed')}' (id={rule_id})")
                rules_skipped += 1
                continue
            if rule_id:
                processed_rule_ids.add(rule_id)

            if not rule.get('isActive', True):
                rules_skipped += 1
                continue  # Skip inactive rules

            # CRITICAL: Extract staffId using fallback chain (matching React's useAISettings.js)
            staff_id = self._extract_staff_id_from_rule(rule)

            # Also support multi-staff rules via staffIds array
            staff_ids = self._extract_staff_ids_from_rule(rule)

            # Build list of all staff IDs to apply this rule to
            target_staff_ids = []
            if staff_id and staff_id in valid_staff_ids:
                target_staff_ids.append(staff_id)

            for sid in staff_ids:
                if sid in valid_staff_ids and sid not in target_staff_ids:
                    target_staff_ids.append(sid)

            if not target_staff_ids:
                logger.warning(f"  Skipping rule '{rule.get('name', 'Unnamed')}' - no valid staff ID found")
                logger.warning(f"    Tried: staffId={staff_id}, staffIds={staff_ids}")
                rules_skipped += 1
                continue

            rule_type = rule.get('ruleType', '')
            shift_type_name = rule.get('shiftType', 'off').lower()

            # Also check nested preferences for shift type
            if not shift_type_name or shift_type_name == 'off':
                prefs = rule.get('preferences', {})
                if prefs.get('shiftType'):
                    shift_type_name = prefs.get('shiftType', 'off').lower()

            shift_type = self._parse_shift_type(shift_type_name)

            # Get days of week from multiple possible locations
            days_of_week = rule.get('daysOfWeek', [])
            if not days_of_week:
                prefs = rule.get('preferences', {})
                days_of_week = prefs.get('daysOfWeek', [])

            is_hard = rule.get('isHardConstraint', False)
            if not is_hard:
                constraints = rule.get('constraints', {})
                is_hard = constraints.get('isHardConstraint', False)

            priority_level = rule.get('priorityLevel', 2)
            if priority_level == 2:
                prefs = rule.get('preferences', {})
                priority_level = prefs.get('priorityLevel', 2)

            # Convert daysOfWeek to lowercase day names for matching
            # IMPORTANT: JavaScript uses 0=Sunday, Python weekday() uses 0=Monday
            # Handle both integer indices (0=Sunday) and string names ("Sunday")
            day_index_to_name = {
                0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
                4: 'thursday', 5: 'friday', 6: 'saturday'
            }
            target_days = []
            for d in days_of_week:
                if isinstance(d, int) and d in day_index_to_name:
                    target_days.append(day_index_to_name[d])
                elif isinstance(d, str):
                    target_days.append(d.lower())

            # Log rule details including allowedShifts for avoid_shift_with_exceptions
            allowed_shifts_log = rule.get('allowedShifts', [])
            if rule_type == 'avoid_shift_with_exceptions':
                logger.info(f"  Rule: {rule.get('name', 'Unnamed')} - staff={target_staff_ids}, type={rule_type}, AVOID={shift_type_name}, ALLOW={allowed_shifts_log}, days={target_days}, hard={is_hard}")
                # DEBUG: Write to file for debugging
                with open('/tmp/priority_rule_debug.log', 'a') as f:
                    f.write(f"[DEBUG] avoid_shift_with_exceptions: staff={target_staff_ids}, AVOID={shift_type_name}, ALLOW={allowed_shifts_log}, days={target_days}\n")
            else:
                logger.info(f"  Rule: {rule.get('name', 'Unnamed')} - staff={target_staff_ids}, type={rule_type}, shift={shift_type_name}, days={target_days}, hard={is_hard}")

            # Apply rule to ALL target staff members
            for target_staff_id in target_staff_ids:
                for date in self.date_range:
                    # Skip calendar override dates (must_day_off and must_work)
                    # Calendar rules take precedence over priority rules
                    if date in self.calendar_off_dates or date in self.calendar_work_dates:
                        continue

                    # Skip dates after staff's end_period (no variables exist)
                    if not self._staff_works_on_date(target_staff_id, date):
                        continue

                    day_name = self._get_day_of_week(date)
                    if day_name not in target_days:
                        continue

                    # FIX: Defensive check - skip if shift variable doesn't exist
                    shift_key = (target_staff_id, date, shift_type)
                    if shift_key not in self.shifts:
                        logger.warning(f"  ⚠️ Shift variable not found: {target_staff_id} on {date} - skipping")
                        continue

                    shift_var = self.shifts[shift_key]

                    if rule_type == 'avoid_shift_with_exceptions':
                        # SPECIAL HANDLING: Avoid the shiftType, but prefer the allowedShifts as alternatives
                        # Example: "Avoid Early (△), Allow Off (×)" means:
                        #   - Penalize Early Shift assignments
                        #   - Give a slight preference to Off Day as an acceptable alternative

                        # 1. Avoid the main shift type (same as 'avoided_shift')
                        if is_hard:
                            # FIX: Convert HARD to HIGH-PENALTY SOFT to prevent INFEASIBLE
                            # This ensures we always get a solution, but heavily penalizes violations
                            # Penalty=500 is higher than 5-day rest (200), so it's very important
                            rule_name = rule.get('name', 'unnamed')
                            self.violation_vars.append((
                                shift_var,
                                500,  # Very high penalty
                                f'hard_priority_avoid_{rule_name}_{target_staff_id}_{date}'
                            ))
                            logger.debug(f"  [HARD→SOFT] Avoid {shift_type_name} for {target_staff_id} on {date} (penalty=500)")
                        else:
                            # Soft constraint: avoid this shift
                            self.avoided_vars.append((shift_var, priority_level))

                        # 2. Prefer the allowed exception shifts (with lower weight)
                        # Extract allowedShifts from multiple possible locations
                        allowed_shifts = rule.get('allowedShifts', [])
                        if not allowed_shifts:
                            prefs = rule.get('preferences', {})
                            allowed_shifts = prefs.get('allowedShifts', [])

                        for allowed_shift_name in allowed_shifts:
                            allowed_shift_type = self._parse_shift_type(allowed_shift_name.lower())
                            if allowed_shift_type != shift_type:  # Don't add the avoided shift as preferred
                                # FIX: Defensive check - skip if shift variable doesn't exist
                                allowed_shift_key = (target_staff_id, date, allowed_shift_type)
                                if allowed_shift_key not in self.shifts:
                                    continue
                                allowed_shift_var = self.shifts[allowed_shift_key]
                                # Use moderate weight (15) for exception preferences - early shifts are an option, not forced
                                # This allows day-off bonus (30) on free days to compete, giving more balanced day-offs
                                # This should produce some early shifts while still allowing day-offs on free days
                                exception_weight = 15
                                self.preferred_vars.append((allowed_shift_var, exception_weight))
                                # DEBUG: Log each exception preference added
                                with open('/tmp/priority_rule_debug.log', 'a') as f:
                                    f.write(f"[DEBUG] Added exception preference: staff={target_staff_id}, date={date}, shift={allowed_shift_name}({allowed_shift_type}), weight={exception_weight}\n")

                    elif rule_type in ['avoided_shift', 'blocked']:
                        if is_hard:
                            # FIX: Convert HARD to HIGH-PENALTY SOFT to prevent INFEASIBLE
                            rule_name = rule.get('name', 'unnamed')
                            self.violation_vars.append((
                                shift_var,
                                500,  # Very high penalty
                                f'hard_priority_blocked_{rule_name}_{target_staff_id}_{date}'
                            ))
                            logger.debug(f"  [HARD→SOFT] Block {shift_type_name} for {target_staff_id} on {date} (penalty=500)")
                        else:
                            # Soft constraint: avoid this shift
                            self.avoided_vars.append((shift_var, priority_level))
                    else:
                        # Default to preferred_shift behavior (includes 'preferred_shift', 'required_off', or empty string)
                        if is_hard:
                            # FIX: Convert HARD to HIGH-PENALTY SOFT to prevent INFEASIBLE
                            # We want this shift to be 1, so add penalty when it's 0
                            rule_name = rule.get('name', 'unnamed')
                            # Create a NOT variable: penalty when shift_var == 0
                            not_shift = self.model.NewBoolVar(f'not_{target_staff_id}_{date}_{shift_type}')
                            self.model.Add(not_shift == 1 - shift_var)
                            self.violation_vars.append((
                                not_shift,
                                500,  # Very high penalty when NOT having this shift
                                f'hard_priority_required_{rule_name}_{target_staff_id}_{date}'
                            ))
                            logger.debug(f"  [HARD→SOFT] Require {shift_type_name} for {target_staff_id} on {date} (penalty=500)")
                        else:
                            # Soft constraint: prefer this shift (add to objective with weight)
                            self.preferred_vars.append((shift_var, priority_level))

            rules_applied += 1

        logger.info(f"[OR-TOOLS] Priority rules: {rules_applied} applied, {rules_skipped} skipped")

        # ═══════════════════════════════════════════════════════════════════════════
        # EARLY SHIFT SUBSTITUTION: Allow staff with "avoid day-off" rules to get rest
        # by taking early shifts, which then enables them to have day-offs elsewhere
        # ═══════════════════════════════════════════════════════════════════════════
        self._add_priority_rule_rest_guarantee(priority_rules, valid_staff_ids)

    def _add_priority_rule_rest_guarantee(self, priority_rules, valid_staff_ids):
        """
        Ensure staff with 'avoid_shift_with_exceptions' rules (that avoid day-offs)
        still get adequate rest through a combination of early shifts and day-offs.

        Strategy:
        1. Identify staff with rules that avoid day-offs (×) but allow early shifts (△)
        2. For these staff, add a SOFT constraint to encourage a minimum number of
           "rest equivalent" = (day-offs × 2) + (early shifts × 1)
        3. On days when multiple other staff already have early shifts, reduce the
           penalty for this staff to also take early shifts (cooperative early shift)

        This allows 料理長 to:
        - Take early shift on Feb 21 (when 小池, 岸 already have △)
        - Take day-off on Feb 27 (as "earned" rest)
        """
        logger.info("[OR-TOOLS] Checking for priority rule rest guarantee (early shift substitution)...")

        # Find staff with avoid_shift_with_exceptions rules that avoid day-offs and allow early shifts
        avoid_dayoff_staff = {}  # {staff_id: {'allowed_shifts': [...], 'days': [...]}}

        for rule in priority_rules:
            if not rule.get('isActive', True):
                continue

            rule_type = rule.get('ruleType', rule.get('type', ''))

            # Handle both direct field and nested ruleDefinition
            rule_def = rule.get('ruleDefinition', {})
            if not rule_type and isinstance(rule_def, dict):
                rule_type = rule_def.get('type', '')

            if rule_type != 'avoid_shift_with_exceptions':
                continue

            # Get shift type being avoided
            shift_type_name = (
                rule.get('shiftType', '') or
                rule.get('shift_type', '') or
                rule_def.get('shiftType', '') or
                rule_def.get('shift_type', '') or
                rule.get('preferences', {}).get('avoidedShift', '')
            )

            # Only process rules that avoid day-offs (off, day_off, ×)
            if shift_type_name.lower() not in ['off', 'day_off', '×', 'dayoff']:
                continue

            # Get allowed shifts (exceptions)
            allowed_shifts = rule.get('allowedShifts', [])
            if not allowed_shifts:
                allowed_shifts = rule_def.get('allowedShifts', [])
            if not allowed_shifts:
                allowed_shifts = rule.get('preferences', {}).get('allowedShifts', [])

            # Check if early shift is allowed as exception
            early_allowed = any(s.lower() in ['early', '△', 'early_shift', 'earlyshift']
                               for s in allowed_shifts)

            if not early_allowed:
                continue

            # Get target staff IDs
            target_staff_ids = self._extract_staff_ids_from_rule(rule)
            target_staff_ids = [sid for sid in target_staff_ids if sid in valid_staff_ids]

            # Get target days
            target_days = []
            days_of_week = rule.get('daysOfWeek', rule_def.get('days_of_week', rule_def.get('daysOfWeek', [])))
            day_index_to_name = {0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
                                4: 'thursday', 5: 'friday', 6: 'saturday'}

            for d in days_of_week:
                if isinstance(d, int) and d in day_index_to_name:
                    target_days.append(day_index_to_name[d])
                elif isinstance(d, str):
                    target_days.append(d.lower())

            for staff_id in target_staff_ids:
                if staff_id not in avoid_dayoff_staff:
                    avoid_dayoff_staff[staff_id] = {'allowed_shifts': set(), 'days': set()}
                avoid_dayoff_staff[staff_id]['allowed_shifts'].update(allowed_shifts)
                avoid_dayoff_staff[staff_id]['days'].update(target_days)

        if not avoid_dayoff_staff:
            logger.info("  No staff with 'avoid day-off + allow early' rules found")
            return

        logger.info(f"  Found {len(avoid_dayoff_staff)} staff with 'avoid day-off + allow early' rules")

        # Get total days in period (excluding calendar forced days)
        total_days = len(self.date_range)
        calendar_off_days = len(self.calendar_off_dates)
        flexible_days = total_days - calendar_off_days

        # For each staff with avoid-dayoff rules, ensure minimum rest through early shifts + day-offs
        constraint_count = 0

        for staff_id, rule_info in avoid_dayoff_staff.items():
            staff = next((s for s in self.staff_members if s['id'] == staff_id), None)
            if not staff:
                continue

            staff_name = staff.get('name', staff_id)
            target_days = rule_info['days']

            # Count applicable days (days where the rule applies)
            applicable_dates = []
            non_applicable_dates = []

            for date in self.date_range:
                if date in self.calendar_off_dates:
                    continue
                if not self._staff_works_on_date(staff_id, date):
                    continue
                if not self._has_shift_var(staff_id, date):
                    continue

                day_name = self._get_day_of_week(date)
                if target_days and day_name in target_days:
                    applicable_dates.append(date)
                else:
                    non_applicable_dates.append(date)

            # If rule applies to ALL days (no target_days specified), treat all as applicable
            if not target_days:
                applicable_dates = [d for d in self.date_range
                                   if d not in self.calendar_off_dates
                                   and self._staff_works_on_date(staff_id, d)
                                   and self._has_shift_var(staff_id, d)]
                non_applicable_dates = []

            logger.info(f"  {staff_name}: {len(applicable_dates)} days with avoid-dayoff rule, {len(non_applicable_dates)} free days")

            # Strategy 1: ENCOURAGE MINIMUM day-offs on NON-APPLICABLE days
            # (days where the avoid-dayoff rule doesn't apply)
            # Only encourage ENOUGH to meet monthly minimum, not all free days
            if non_applicable_dates:
                # Get monthly minimum/maximum constraints
                monthly_min = self.constraints_config.get('monthly_limits', {}).get('min_days_off_per_month', 4)
                monthly_max = self.constraints_config.get('monthly_limits', {}).get('max_days_off_per_month', 10)

                # Target: push toward maximum day-offs (staff should get as much rest as possible)
                target_dayoffs = monthly_max  # e.g., 10 if max=10

                # Use SOFT constraint to encourage minimum day-offs on free days
                # Rather than preferring ALL days, just ensure minimum is met
                off_vars_free = [self.shifts[(staff_id, d, self.SHIFT_OFF)] for d in non_applicable_dates]

                if off_vars_free:
                    # Create variable for under-minimum penalty
                    under_min_var = self.model.NewIntVar(0, monthly_max, f'under_min_dayoff_{staff_id}')
                    self.model.Add(under_min_var >= target_dayoffs - sum(off_vars_free))
                    self.model.Add(under_min_var >= 0)

                    # Penalize if below target (but lower penalty than avoid rule = 500)
                    # Weight 200 < 500 (avoid penalty), so won't override rule days
                    self.violation_vars.append((
                        under_min_var,
                        200,
                        f'Below target day-offs for {staff_name} on free days (target={target_dayoffs})'
                    ))

                    logger.info(f"    → Added target day-off constraint: {target_dayoffs} day-offs on {len(non_applicable_dates)} free days (penalty=200)")

            # Strategy 2: ENCOURAGE early shifts on APPLICABLE days (limited number)
            # This gives them "rest credit" while still working
            # Only encourage 2-3 early shifts per month (not all applicable days)
            max_early_per_month = 3  # Same as the 社員 monthly early shift limit
            early_vars_applicable = [self.shifts[(staff_id, d, self.SHIFT_EARLY)] for d in applicable_dates]

            if early_vars_applicable:
                # Use soft constraint to encourage some early shifts (but not too many)
                # Create variable for under-minimum early shifts
                target_early = min(2, len(applicable_dates))  # Target 2 early shifts

                under_early_var = self.model.NewIntVar(0, max_early_per_month, f'under_early_{staff_id}')
                self.model.Add(under_early_var >= target_early - sum(early_vars_applicable))
                self.model.Add(under_early_var >= 0)

                # Weight 100 encourages early shifts as alternative to day-offs
                self.violation_vars.append((
                    under_early_var,
                    100,
                    f'Below target early shifts for {staff_name} on rule days (target={target_early})'
                ))

                logger.info(f"    → Added target early shift constraint: {target_early} early shifts on {len(applicable_dates)} applicable days (penalty=100)")

            # Strategy 3: MINIMUM REST GUARANTEE (combined day-offs + early shifts)
            # Ensure they get at least some rest through combination of early shifts and day-offs
            # Rest equivalent = (day-offs × 2) + (early shifts × 1)
            # Target: at least 4-5 rest-equivalent per 28-day period

            all_working_dates = applicable_dates + non_applicable_dates
            if len(all_working_dates) > 0:
                # Calculate minimum rest equivalent (roughly 1 per 6 working days)
                min_rest_equiv = max(4, len(all_working_dates) // 6)  # At least 4, or 1 per 6 days

                # Sum up rest equivalent: off×2 + early×1
                off_vars = [self.shifts[(staff_id, d, self.SHIFT_OFF)] for d in all_working_dates]
                early_vars = [self.shifts[(staff_id, d, self.SHIFT_EARLY)] for d in all_working_dates]

                # rest_equiv = sum(off×2) + sum(early×1)
                rest_equiv = sum(v * 2 for v in off_vars) + sum(v * 1 for v in early_vars)

                # SOFT constraint: penalize if below minimum rest equivalent
                max_possible = len(all_working_dates) * 3  # Upper bound
                under_rest_var = self.model.NewIntVar(0, max_possible, f'under_rest_{staff_id}')
                self.model.Add(under_rest_var >= min_rest_equiv - rest_equiv)
                self.model.Add(under_rest_var >= 0)

                # VERY HIGH penalty for insufficient rest (300 = higher than priority avoid penalty)
                # This ensures staff with avoid-dayoff rules still get minimum rest
                self.violation_vars.append((
                    under_rest_var,
                    300,  # Very high priority (higher than 5-day rest=200)
                    f'Insufficient rest-equivalent for {staff_name} (min={min_rest_equiv/2:.1f})'
                ))
                constraint_count += 1

                logger.info(f"    → Added minimum rest guarantee: {min_rest_equiv/2:.1f} rest-equivalent (penalty=300)")

        logger.info(f"[OR-TOOLS] Added {constraint_count} priority rule rest guarantee constraints")

    def _add_priority_rules_object_format(self, priority_rules):
        """
        Handle legacy object format for priority rules.
        Format: { staffId: { preferredShifts: [...], avoidedShifts: [...] } }
        """
        logger.info(f"[OR-TOOLS] Processing priority rules for {len(priority_rules)} staff (object format)...")

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
                            # FIX: Skip if shift variable doesn't exist (staff not working on this date)
                            shift_var = self._get_shift_var(staff_id, date, shift_type)
                            if shift_var is not None:
                                self.preferred_vars.append((shift_var, 2))

            # Handle avoided shifts
            for avoid in rules.get('avoidedShifts', []):
                day_of_week = avoid.get('day', '').lower()
                shift_name = avoid.get('shift', '').lower()
                shift_type = self._parse_shift_type(shift_name)

                for date in self.date_range:
                    if self._get_day_of_week(date) == day_of_week:
                        if date not in self.calendar_off_dates:
                            # FIX: Skip if shift variable doesn't exist (staff not working on this date)
                            shift_var = self._get_shift_var(staff_id, date, shift_type)
                            if shift_var is not None:
                                self.avoided_vars.append((shift_var, 2))

    def _add_objective(self):
        """
        Optimization objective: What makes a "good" schedule?

        PRIMARY GOAL: Minimize constraint violations (soft constraints)
        SECONDARY GOAL: Maximize preferred shifts, minimize avoided shifts
        TERTIARY GOAL: Maximize day-offs for non-backup staff (balanced rest)

        This enables "best effort" solutions like TensorFlow - always provides
        a schedule even when perfect constraint satisfaction is impossible.
        """
        objective_terms = []

        # PRIMARY: Penalize all soft constraint violations
        # Higher penalty = more important to satisfy
        for violation_var, weight, description in self.violation_vars:
            # Negative weight because we're maximizing and want to minimize violations
            objective_terms.append(-weight * violation_var)

        logger.info(f"[OR-TOOLS] Added {len(self.violation_vars)} violation penalties to objective")

        # TERTIARY: Maximize day-offs for non-backup staff to encourage balanced rest
        # This pushes the solver to give staff MORE day-offs when there's room
        # Use weight 30 to compete with exception preferences (15) while staying below violation penalties (50-500)
        # Only apply to non-backup staff to avoid excessive day-offs for backup
        dayoff_bonus_weight = 30
        dayoff_bonus_count = 0

        for staff in self.staff_members:
            staff_id = staff['id']

            # Skip backup staff - they should work more, not get bonuses for day-offs
            if staff_id in self.backup_staff_ids:
                continue

            for date in self.date_range:
                # Skip if staff doesn't work on this date or no shift variable
                if not self._staff_works_on_date(staff_id, date) or not self._has_shift_var(staff_id, date):
                    continue

                # Add bonus for day-off (×)
                off_var = self.shifts.get((staff_id, date, self.SHIFT_OFF))
                if off_var is not None:
                    objective_terms.append(dayoff_bonus_weight * off_var)
                    dayoff_bonus_count += 1

                # Add smaller bonus for early shift (△) - counts as 0.5 day-off
                early_var = self.shifts.get((staff_id, date, self.SHIFT_EARLY))
                if early_var is not None:
                    objective_terms.append((dayoff_bonus_weight // 2) * early_var)

        if dayoff_bonus_count > 0:
            logger.info(f"[OR-TOOLS] Added {dayoff_bonus_count} day-off bonus terms (weight={dayoff_bonus_weight}) to maximize rest")

        # SECONDARY: Handle priority rules (preferred/avoided shifts)
        if hasattr(self, 'preferred_vars') and hasattr(self, 'avoided_vars'):
            # Maximize preferred - minimize avoided
            # Weight by priority level (higher priority = higher weight)
            # Use smaller weights than violation penalties so violations take priority

            for item in getattr(self, 'preferred_vars', []):
                if isinstance(item, tuple):
                    var, weight = item
                    objective_terms.append(weight * var)  # Positive = want this
                else:
                    # Legacy format (just var)
                    objective_terms.append(item)

            for item in getattr(self, 'avoided_vars', []):
                if isinstance(item, tuple):
                    var, weight = item
                    objective_terms.append(-weight * var)  # Negative = don't want this
                else:
                    # Legacy format (just var)
                    objective_terms.append(-item)

            logger.info(f"[OR-TOOLS] Added {len(self.preferred_vars)} preferred, {len(self.avoided_vars)} avoided to objective")

        if objective_terms:
            self.model.Maximize(sum(objective_terms))
            logger.info(f"[OR-TOOLS] Total objective terms: {len(objective_terms)}")
        else:
            logger.info("[OR-TOOLS] No objective terms - will find any feasible solution")

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
            logger.info(f"[OR-TOOLS] Found OPTIMAL solution in {solver.WallTime():.2f}s")
            is_optimal = True
        elif status == cp_model.FEASIBLE:
            logger.info(f"[OR-TOOLS] Found FEASIBLE solution in {solver.WallTime():.2f}s (not proven optimal)")
            is_optimal = False
        else:
            logger.error(f"[OR-TOOLS] No solution found. Status: {status_name}")
            return {
                'success': False,
                'error': f'No feasible solution found. Status: {status_name}',
                'status': status_name,
                'schedule': {}
            }

        # Extract schedule
        schedule = {}
        prefilled_preserved = 0
        backup_unavailable_count = 0

        # Get prefilled symbols if available (for preserving original symbols like ★)
        prefilled_symbols = getattr(self, 'prefilled_symbols', {})

        # Get backup unavailable slots for ⊘ symbol output
        backup_unavailable_slots = getattr(self, 'backup_unavailable_slots', {})

        # Unavailable symbol for backup staff when no coverage needed
        UNAVAILABLE_SYMBOL = '\u2298'  # ⊘ (circled division slash)

        for staff in self.staff_members:
            staff_id = staff['id']
            schedule[staff_id] = {}

            for date in self.date_range:
                # Skip dates where staff doesn't have shift variables (before start_period or after end_period)
                if not self._has_shift_var(staff_id, date):
                    continue

                # Check if this cell was pre-filled - preserve original symbol
                if (staff_id, date) in prefilled_symbols:
                    # Use the original symbol (e.g., ★, ●, ◎) instead of mapped symbol
                    schedule[staff_id][date] = prefilled_symbols[(staff_id, date)]
                    prefilled_preserved += 1
                else:
                    # Find which shift type is selected (exactly one will be 1)
                    for shift_type in range(4):
                        if solver.Value(self.shifts[(staff_id, date, shift_type)]) == 1:
                            # Check if this is a backup staff slot
                            if (staff_id, date) in backup_unavailable_slots:
                                slot_data = backup_unavailable_slots[(staff_id, date)]

                                # NEW: Handle tuple format (slot_type, any_member_off_var)
                                if isinstance(slot_data, tuple):
                                    slot_type, any_member_off_var = slot_data

                                    if slot_type == 'holiday':
                                        # Japanese holiday - backup MUST be unavailable (⊘)
                                        schedule[staff_id][date] = UNAVAILABLE_SYMBOL
                                        backup_unavailable_count += 1
                                    else:
                                        # Regular backup coverage logic (slot_type == 'coverage')
                                        # NEW LOGIC (inverted default):
                                        # - Backup now WORKS by default, only holiday makes them unavailable
                                        # ✅ FIX: For backup staff WORK shifts, use explicit ○ symbol
                                        if shift_type == self.SHIFT_WORK:
                                            schedule[staff_id][date] = '○'  # Explicit work symbol
                                        elif shift_type == self.SHIFT_OFF:
                                            # If backup is OFF on a non-holiday, this shouldn't happen normally
                                            # but handle gracefully - show as normal off symbol
                                            schedule[staff_id][date] = self.SHIFT_SYMBOLS[shift_type]
                                        else:
                                            schedule[staff_id][date] = self.SHIFT_SYMBOLS[shift_type]
                                else:
                                    # LEGACY: Handle old format (direct BoolVar or string)
                                    # This maintains backward compatibility
                                    if slot_data == 'holiday':
                                        schedule[staff_id][date] = UNAVAILABLE_SYMBOL
                                        backup_unavailable_count += 1
                                    else:
                                        # Regular backup coverage logic
                                        if shift_type == self.SHIFT_WORK:
                                            schedule[staff_id][date] = '○'
                                        else:
                                            schedule[staff_id][date] = self.SHIFT_SYMBOLS[shift_type]
                            else:
                                schedule[staff_id][date] = self.SHIFT_SYMBOLS[shift_type]
                            break

        if prefilled_preserved > 0:
            logger.info(f"[OR-TOOLS] 🔒 Preserved {prefilled_preserved} pre-filled cells with original symbols")

        if backup_unavailable_count > 0:
            logger.info(f"[OR-TOOLS] 🛡️ Set {backup_unavailable_count} backup slots to ⊘ (unavailable - no coverage needed)")

        # DEBUG: Log actual solver values for backup coverage analysis
        if backup_unavailable_slots:
            logger.info(f"[OR-TOOLS] 🔍 DEBUG - Backup coverage analysis:")
            # Get backup staff ID
            backup_staff_id = list(backup_unavailable_slots.keys())[0][0] if backup_unavailable_slots else None
            if backup_staff_id:
                # Find 料理長 ID for checking
                ryoricho_id = '23ad831b-f8b3-415f-82e3-a6723a090dc6'

                # Sample key dates including Sundays
                sample_dates = ['2025-12-28', '2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25']  # Sundays
                for date in sample_dates:
                    if date not in self.date_range:
                        continue

                    any_member_off_var = backup_unavailable_slots.get((backup_staff_id, date))
                    backup_shift = schedule.get(backup_staff_id, {}).get(date, '')
                    ryoricho_shift = schedule.get(ryoricho_id, {}).get(date, '')

                    # Get actual shift type values from solver
                    try:
                        ryoricho_early_val = solver.Value(self.shifts[(ryoricho_id, date, self.SHIFT_EARLY)])
                        ryoricho_off_val = solver.Value(self.shifts[(ryoricho_id, date, self.SHIFT_OFF)])
                        backup_work_val = solver.Value(self.shifts[(backup_staff_id, date, self.SHIFT_WORK)])
                        backup_off_val = solver.Value(self.shifts[(backup_staff_id, date, self.SHIFT_OFF)])

                        # Try to get any_member_off value safely
                        try:
                            any_off_val = solver.Value(any_member_off_var) if any_member_off_var else 'N/A'
                        except:
                            any_off_val = 'LITERAL'

                        logger.info(f"      {date}: 料理長={repr(ryoricho_shift)} (early={ryoricho_early_val}, off={ryoricho_off_val}), "
                                   f"backup={repr(backup_shift)} (work={backup_work_val}, off={backup_off_val}), any_member_off={any_off_val}")
                    except Exception as e:
                        logger.info(f"      {date}: Error getting values: {e}")

        # Calculate stats
        total_off = sum(
            1 for staff_id in schedule
            for date in schedule[staff_id]
            if schedule[staff_id][date] == self.SHIFT_SYMBOLS[self.SHIFT_OFF]
        )

        # Calculate violation statistics
        violations = []
        total_violation_penalty = 0
        for violation_var, weight, description in self.violation_vars:
            val = solver.Value(violation_var)
            if val > 0:
                violations.append({
                    'description': description,
                    'count': val,
                    'penalty': val * weight
                })
                total_violation_penalty += val * weight

        if violations:
            logger.warning(f"[OR-TOOLS] Solution has {len(violations)} constraint violations (total penalty: {total_violation_penalty})")
            for v in violations[:10]:  # Log first 10 violations
                logger.warning(f"  - {v['description']}: {v['count']} (penalty: {v['penalty']})")
            if len(violations) > 10:
                logger.warning(f"  ... and {len(violations) - 10} more violations")
        else:
            logger.info("[OR-TOOLS] Solution has NO constraint violations - all constraints satisfied!")

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
                'date_count': len(self.date_range),
                'total_violations': len(violations),
                'total_violation_penalty': total_violation_penalty,
                'prefilled_cells': prefilled_preserved  # Number of pre-filled cells preserved
            },
            'violations': violations[:20] if violations else [],  # Return top 20 violations
            'config': {
                'penaltyWeights': {
                    'staffGroup': self.PENALTY_WEIGHTS['staff_group'],
                    'dailyLimitMin': self.PENALTY_WEIGHTS['daily_limit'],
                    'dailyLimitMax': self.PENALTY_WEIGHTS['daily_limit_max'],
                    'monthlyLimit': self.PENALTY_WEIGHTS['monthly_limit'],
                    'adjacentConflict': self.PENALTY_WEIGHTS['adjacent_conflict'],
                    'fiveDayRest': self.PENALTY_WEIGHTS['5_day_rest'],
                },
                'timeout': solver.parameters.max_time_in_seconds,
                'numWorkers': self.num_workers
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

    def _extract_staff_id_from_rule(self, rule: Dict[str, Any]) -> Optional[str]:
        """
        Extract single staffId from priority rule using fallback chain.

        Matches React's useAISettings.js extraction logic (lines 342-348):
        - rule.staffId (top-level camelCase)
        - rule.staff_id (top-level snake_case)
        - rule.ruleDefinition.staff_id (nested JSONB)
        - rule.ruleDefinition.staffId (nested camelCase)
        - rule.ruleConfig.staffId (alternative nesting)
        - rule.preferences.staffId (legacy format)
        """
        # Check top-level
        staff_id = rule.get('staffId')
        if staff_id:
            return staff_id

        staff_id = rule.get('staff_id')
        if staff_id:
            return staff_id

        # Check nested ruleDefinition (common in database-seeded rules)
        rule_def = rule.get('ruleDefinition', {})
        if isinstance(rule_def, dict):
            staff_id = rule_def.get('staff_id')
            if staff_id:
                return staff_id
            staff_id = rule_def.get('staffId')
            if staff_id:
                return staff_id

        # Check ruleConfig (alternative nesting)
        rule_config = rule.get('ruleConfig', {})
        if isinstance(rule_config, dict):
            staff_id = rule_config.get('staffId')
            if staff_id:
                return staff_id
            staff_id = rule_config.get('staff_id')
            if staff_id:
                return staff_id

        # Check preferences (legacy format)
        prefs = rule.get('preferences', {})
        if isinstance(prefs, dict):
            staff_id = prefs.get('staffId')
            if staff_id:
                return staff_id
            staff_id = prefs.get('staff_id')
            if staff_id:
                return staff_id

        return None

    def _extract_staff_ids_from_rule(self, rule: Dict[str, Any]) -> List[str]:
        """
        Extract multiple staffIds from priority rule (for multi-staff rules).

        Matches React's useAISettings.js extraction logic (lines 332-340):
        - rule.staffIds (top-level camelCase array)
        - rule.staff_ids (top-level snake_case array)
        - rule.ruleDefinition.staff_ids (nested JSONB array)
        - rule.ruleConfig.staffIds (alternative nesting)
        - rule.preferences.staffIds (legacy format)
        """
        # Check top-level
        staff_ids = rule.get('staffIds')
        if staff_ids and isinstance(staff_ids, list):
            return staff_ids

        staff_ids = rule.get('staff_ids')
        if staff_ids and isinstance(staff_ids, list):
            return staff_ids

        # Check nested ruleDefinition
        rule_def = rule.get('ruleDefinition', {})
        if isinstance(rule_def, dict):
            staff_ids = rule_def.get('staff_ids')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids
            staff_ids = rule_def.get('staffIds')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids

        # Check ruleConfig
        rule_config = rule.get('ruleConfig', {})
        if isinstance(rule_config, dict):
            staff_ids = rule_config.get('staffIds')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids
            staff_ids = rule_config.get('staff_ids')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids

        # Check preferences
        prefs = rule.get('preferences', {})
        if isinstance(prefs, dict):
            staff_ids = prefs.get('staffIds')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids
            staff_ids = prefs.get('staff_ids')
            if staff_ids and isinstance(staff_ids, list):
                return staff_ids

        return []


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
        # Handle case where no JSON content type is provided
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request Content-Type must be application/json'
            }), 400

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
        logger.error(f"[API] Error in /optimize: {str(e)}")
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
    import os
    # Development server - use PORT env var or default to 5001 (5000 is used by AirPlay on macOS)
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
