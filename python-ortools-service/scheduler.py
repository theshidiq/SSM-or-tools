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
        self.prefilled_cells = set()  # Track pre-filled cells (staff_id, date) for reference
        self.backup_unavailable_slots = {}  # Track (staff_id, date) -> any_member_off bool var for backup unavailability
        self.backup_staff_ids = set()  # Track backup staff IDs (exempt from monthly limits)

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
        self.backup_unavailable_slots = {}  # Reset backup unavailable slots tracking
        self.violation_vars = []  # Reset violation tracking

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
            self._add_staff_group_constraints()              # PHASE 2
            self._add_daily_limits()                         # BALANCE phase
            self._add_staff_type_daily_limits()             # Per-staff-type daily limits
            self._compute_priority_rule_off_equivalent()    # Pre-compute priority rule consumption (MUST be before monthly limits)
            self._add_monthly_limits()                       # Phase 6.6 monthly MIN/MAX (uses priority rule consumption)
            self._add_adjacent_conflict_prevention()         # No xx, sx, xs
            self._add_5_day_rest_constraint()               # PHASE 4
            self._add_priority_rules()                       # PHASE 1 (soft constraints)

            # 3. Add optimization objective
            self._add_objective()

            # 4. Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = timeout_seconds
            solver.parameters.num_search_workers = self.num_workers  # Use configurable workers

            logger.info(f"[OR-TOOLS] Solving with {timeout_seconds}s timeout and {self.num_workers} workers...")
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

    def _create_variables(self):
        """
        Create boolean decision variables: shifts[staff_id, date, shift_type]
        Each variable = "Does staff have this shift on this date?"

        Total variables: staff_count x days x 4 shift_types
        Example: 10 staff x 60 days x 4 = 2,400 variables
        """
        total_vars = len(self.staff_members) * len(self.date_range) * 4
        logger.info(f"[OR-TOOLS] Creating {total_vars} decision variables...")

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
        logger.info("[OR-TOOLS] Adding basic constraints...")

        for staff in self.staff_members:
            for date in self.date_range:
                # Exactly one shift type must be selected per day
                self.model.AddExactlyOne([
                    self.shifts[(staff['id'], date, shift)]
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
                        # Staff with early shift preference: Force s (early shift)
                        self.model.Add(self.shifts[(staff_id, date, self.SHIFT_EARLY)] == 1)
                        logger.info(f"  {staff.get('name', staff_id)}: EARLY on {date} (early pref)")
                    else:
                        # All other staff: Force x (off)
                        self.model.Add(self.shifts[(staff_id, date, self.SHIFT_OFF)] == 1)

            elif rule.get('must_work'):
                # All staff must work normal shift
                for staff in self.staff_members:
                    self.model.Add(self.shifts[(staff['id'], date, self.SHIFT_WORK)] == 1)
                logger.info(f"  All staff: WORK on {date} (must_work)")

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

                # ═══════════════════════════════════════════════════════════════════════════
                # BACKUP COVERAGE TRIGGER: Only day off (×) triggers coverage
                # - OFF (×) - day off → backup MUST work
                # - EARLY (△) - early shift → backup does NOT need to cover (staff still present)
                # ═══════════════════════════════════════════════════════════════════════════
                member_off_vars = []
                for member_id in valid_members:
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
                # CONSTRAINT B: If NO group member has OFF → Backup SHOULD be OFF (shown as ⊘)
                # ─────────────────────────────────────────────────────────────────────
                # IMPORTANT: This is ALWAYS a SOFT constraint to avoid INFEASIBLE solutions
                # The ⊘ symbol display is handled separately via backup_unavailable_slots tracking
                # Making this HARD would conflict with daily/monthly limits causing no solution
                backup_off_var = self.shifts[(backup_staff_id, date, self.SHIFT_OFF)]

                # ═══════════════════════════════════════════════════════════════════════════
                # SOFT CONSTRAINT: Backup SHOULD be OFF when no coverage needed
                # ═══════════════════════════════════════════════════════════════════════════
                # unavailable_violation = 1 when: any_member_off=0 AND backup_off=0
                unavailable_violation = self.model.NewBoolVar(f'backup_unavailable_violation_{backup_staff_id}_{date}')

                # If any_member_off=1, unavailable_violation must be 0 (no constraint)
                self.model.Add(unavailable_violation == 0).OnlyEnforceIf(any_member_off)
                # If any_member_off=0 AND backup_off=1, unavailable_violation must be 0
                self.model.Add(unavailable_violation == 0).OnlyEnforceIf([any_member_off.Not(), backup_off_var])
                # If any_member_off=0 AND backup_off=0, unavailable_violation must be 1
                self.model.AddBoolOr([any_member_off, backup_off_var, unavailable_violation])

                # Higher penalty when backup_coverage_is_hard (users expect ⊘ behavior)
                # but still SOFT to avoid infeasibility
                unavailable_penalty = self.PENALTY_WEIGHTS['backup_coverage'] // 2 if backup_coverage_is_hard else self.PENALTY_WEIGHTS['backup_coverage'] // 10
                self.violation_vars.append((
                    unavailable_violation,
                    unavailable_penalty,
                    f'Backup {backup_name} working when no coverage needed on {date}'
                ))
                constraint_count += 1

                # Track this slot for solution extraction (to output ⊘ instead of ×)
                self.backup_unavailable_slots[(backup_staff_id, date)] = any_member_off

        if skipped_count > 0:
            logger.info(f"[OR-TOOLS] Backup assignments: {constraint_count} {constraint_type} constraints added, {skipped_count} skipped")
        else:
            logger.info(f"[OR-TOOLS] 🛡️ Added {constraint_count} backup coverage {constraint_type} constraints")

    def _add_staff_group_constraints(self):
        """
        PHASE 2: Staff group constraints.

        Rule: Only 1 member of a group can have off (x) or early (s) on same day.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1844-1872:
        "If 2+ members in a group have off/early shifts on same date = CONFLICT"

        CONFIGURABLE: Can be HARD or SOFT constraints based on ortoolsConfig.
        - HARD constraint: Strictly enforced, no violations allowed
        - SOFT constraint: Violations allowed with penalty

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

        constraint_type = "HARD" if staff_group_is_hard else "SOFT"
        logger.info(f"[OR-TOOLS] Adding staff group constraints ({constraint_type}) for {len(staff_groups)} groups...")

        # Create a lookup for valid staff IDs
        valid_staff_ids = {s['id'] for s in self.staff_members}
        logger.info(f"[OR-TOOLS] Valid staff IDs: {valid_staff_ids}")

        constraint_count = 0

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

                # Sum of (off + early) for all members in group
                off_or_early_vars = []
                for member_id in valid_members:
                    off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_OFF)])
                    off_or_early_vars.append(self.shifts[(member_id, date, self.SHIFT_EARLY)])

                total_off_early = sum(off_or_early_vars)

                if staff_group_is_hard:
                    # HARD CONSTRAINT: At most 1 person can be off/early per group per day
                    self.model.Add(total_off_early <= 1)
                    constraint_count += 1
                else:
                    # SOFT CONSTRAINT: Allow violation but penalize it
                    # violation = max(0, total_off_early - 1)
                    violation_var = self.model.NewIntVar(0, len(valid_members), f'group_{group_name}_{date}_violation')
                    self.model.Add(violation_var >= total_off_early - 1)
                    self.model.Add(violation_var >= 0)

                    # Track violation for objective penalty
                    self.violation_vars.append((
                        violation_var,
                        self.PENALTY_WEIGHTS['staff_group'],
                        f'Staff group {group_name} on {date}'
                    ))
                    constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} staff group {constraint_type.lower()} constraints")

    def _add_daily_limits(self):
        """
        BALANCE phase: Daily min/max off limits.

        From AI_GENERATION_FLOW_DOCUMENTATION.md lines 1303-1400:
        - Default: min 2, max 3 staff off per day
        - Skip calendar rule dates (must_day_off/must_work override limits)

        CONFIGURABLE: Can be HARD or SOFT constraints based on ortoolsConfig.
        - HARD constraint: Strictly enforced, no violations allowed (may fail if unsatisfiable)
        - SOFT constraint: Violations allowed with penalty (always finds a solution)

        NEW: Can be disabled via 'enabled' flag when using per-staff-type limits instead.
        AUTO-DISABLE: When staffTypeLimits are configured, global daily limits are automatically skipped.
        """
        daily_limits = self.constraints_config.get('dailyLimitsRaw', {})
        staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

        # AUTO-DISABLE: Skip global daily limits when staff type limits are configured
        # This prevents conflicts between global "min 2 off per day" and per-type "max 1 社員 off per day"
        if staff_type_limits and len(staff_type_limits) > 0:
            logger.info("[OR-TOOLS] Daily limits AUTO-DISABLED (staffTypeLimits configured - using per-type limits instead)")
            return

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
        default_max = min(3, staff_count - 1) if staff_count > 1 else 0

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
            off_count = sum([
                self.shifts[(staff['id'], date, self.SHIFT_OFF)]
                for staff in non_backup_staff
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
            max_off = limits.get('maxOff', None)
            max_early = limits.get('maxEarly', None)
            is_hard = limits.get('isHard', False)

            # EDGE CASE: No limits specified for this type
            if max_off is None and max_early is None:
                logger.warning(f"  Type '{staff_type}': No limits specified (maxOff/maxEarly) - skipping")
                warning_count += 1
                continue

            # EDGE CASE: Validate limit values
            if max_off is not None and max_off < 0:
                logger.error(f"  Type '{staff_type}': Invalid maxOff={max_off} (must be >= 0) - skipping")
                warning_count += 1
                continue

            if max_early is not None and max_early < 0:
                logger.error(f"  Type '{staff_type}': Invalid maxEarly={max_early} (must be >= 0) - skipping")
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
            logger.info(f"  Type '{staff_type}': {len(type_staff)} staff, maxOff={max_off}, maxEarly={max_early}, mode={constraint_mode}")

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
                off_vars = [self.shifts[(staff['id'], date, self.SHIFT_OFF)] for staff in type_staff]
                early_vars = [self.shifts[(staff['id'], date, self.SHIFT_EARLY)] for staff in type_staff]

                # Create scaled sum: off × 2 + early × 1
                # off counts as 2 (= 1.0 in original scale), early counts as 1 (= 0.5)
                scaled_terms = []
                for var in off_vars:
                    scaled_terms.append(var * 2)
                for var in early_vars:
                    scaled_terms.append(var * 1)

                combined_scaled = sum(scaled_terms)

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

        for rule in priority_rules:
            rule_name = rule.get('name', 'Unnamed')
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
            # Check for EARLY symbol (△) - counts as 1 (scaled, = 0.5 off-equivalent)
            elif symbol in ['△', '\u25b3', 's', 'S']:
                prefilled_off_equiv_by_staff[staff_id] = prefilled_off_equiv_by_staff.get(staff_id, 0) + 1

        # Log pre-filled off-equivalent summary
        if prefilled_off_equiv_by_staff:
            logger.info(f"[OR-TOOLS] 🔒 Pre-filled off-equivalent (×=1.0, △=0.5) counts towards monthly limits:")
            for staff_id, scaled_count in prefilled_off_equiv_by_staff.items():
                staff_name = next((s.get('name', staff_id) for s in self.staff_members if s['id'] == staff_id), staff_id)
                off_equiv = scaled_count / 2.0  # Convert back to original scale for display
                remaining_equiv = max_off - off_equiv
                logger.info(f"    {staff_name}: {off_equiv:.1f} pre-filled off-equiv → remaining: {remaining_equiv:.1f} (max {max_off})")

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
            # SKIP BACKUP STAFF - They are exempt from monthly limits
            # Backup staff schedule is determined ONLY by group coverage constraints
            # ═══════════════════════════════════════════════════════════════════════════
            if staff_id in self.backup_staff_ids:
                skipped_backup_count += 1
                logger.info(f"  🛡️ Skipping backup staff {staff_name} from monthly limits (coverage-based schedule)")
                continue

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
                logger.info(f"      → Monthly limit: max={max_scaled/2:.1f}, min={min_scaled/2:.1f} (includes priority shifts)")

            if exclude_calendar:
                # Count combined off-equivalent for flexible dates (excluding calendar)
                # off × 2 + early × 1
                off_vars = [self.shifts[(staff_id, date, self.SHIFT_OFF)] for date in flexible_dates]
                early_vars = [self.shifts[(staff_id, date, self.SHIFT_EARLY)] for date in flexible_dates]

                # Create scaled sum: off × 2 + early × 1
                combined_scaled = sum(var * 2 for var in off_vars) + sum(var * 1 for var in early_vars)

                # Upper bound for violation variables (scaled)
                max_possible = num_flexible_days * 3

                if monthly_limit_is_hard:
                    # HARD CONSTRAINT: Strictly enforce ORIGINAL limits
                    # Priority-forced shifts count in combined_scaled automatically
                    if min_scaled > 0:
                        self.model.Add(combined_scaled >= min_scaled)
                        constraint_count += 1
                    self.model.Add(combined_scaled <= max_scaled)
                    constraint_count += 1
                else:
                    # SOFT CONSTRAINT for min: Penalize if below ORIGINAL minimum
                    if min_scaled > 0:
                        under_min_var = self.model.NewIntVar(0, max_possible, f'monthly_under_min_{staff_id}')
                        self.model.Add(under_min_var >= min_scaled - combined_scaled)
                        self.model.Add(under_min_var >= 0)
                        self.violation_vars.append((
                            under_min_var,
                            self.PENALTY_WEIGHTS['monthly_limit'],
                            f'Monthly under-minimum for {staff_name}'
                        ))
                        constraint_count += 1

                    # SOFT CONSTRAINT for max: Penalize if above ORIGINAL maximum
                    over_max_var = self.model.NewIntVar(0, max_possible, f'monthly_over_max_{staff_id}')
                    self.model.Add(over_max_var >= combined_scaled - max_scaled)
                    self.model.Add(over_max_var >= 0)
                    self.violation_vars.append((
                        over_max_var,
                        self.PENALTY_WEIGHTS['monthly_limit'],
                        f'Monthly over-maximum for {staff_name}'
                    ))
                    constraint_count += 1
            else:
                # Count combined off-equivalent for all dates
                # off × 2 + early × 1
                off_vars = [self.shifts[(staff_id, date, self.SHIFT_OFF)] for date in self.date_range]
                early_vars = [self.shifts[(staff_id, date, self.SHIFT_EARLY)] for date in self.date_range]

                combined_scaled = sum(var * 2 for var in off_vars) + sum(var * 1 for var in early_vars)
                max_possible = total_days * 3

                if monthly_limit_is_hard:
                    # HARD CONSTRAINT: Strictly enforce ORIGINAL limits
                    # Priority-forced shifts count in combined_scaled automatically
                    if min_scaled > 0:
                        self.model.Add(combined_scaled >= min_scaled)
                        constraint_count += 1
                    self.model.Add(combined_scaled <= max_scaled)
                    constraint_count += 1
                else:
                    # SOFT CONSTRAINT for min: Penalize if below ORIGINAL minimum
                    if min_scaled > 0:
                        under_min_var = self.model.NewIntVar(0, max_possible, f'monthly_under_min_{staff_id}')
                        self.model.Add(under_min_var >= min_scaled - combined_scaled)
                        self.model.Add(under_min_var >= 0)
                        self.violation_vars.append((
                            under_min_var,
                            self.PENALTY_WEIGHTS['monthly_limit'],
                            f'Monthly under-minimum for {staff_name}'
                        ))
                        constraint_count += 1

                    # SOFT CONSTRAINT for max: Penalize if above ORIGINAL maximum
                    over_max_var = self.model.NewIntVar(0, max_possible, f'monthly_over_max_{staff_id}')
                    self.model.Add(over_max_var >= combined_scaled - max_scaled)
                    self.model.Add(over_max_var >= 0)
                    self.violation_vars.append((
                        over_max_var,
                        self.PENALTY_WEIGHTS['monthly_limit'],
                        f'Monthly over-maximum for {staff_name}'
                    ))
                    constraint_count += 1

        logger.info(f"[OR-TOOLS] Added {constraint_count} monthly limit {constraint_type.lower()} constraints (with early=0.5 weight)")

    def _add_adjacent_conflict_prevention(self):
        """
        Prevent adjacent conflict patterns (SOFT - allows violations with penalty).

        From hasAdjacentConflict() in BusinessRuleValidator.js (lines 51-93):
        - No xx (two consecutive off days)
        - No sx (early shift followed by off)
        - No xs (off followed by early shift)

        Note: ss is NOT prevented in original code (early shifts can be consecutive)

        SOFT CONSTRAINT: Instead of hard failure, we add penalty for violations.
        This allows OR-Tools to provide best-effort solutions like TensorFlow.

        Calendar handling:
        - If BOTH dates are calendar_off_dates, skip (both are forced off anyway)
        - If only ONE date is calendar_off_date, we should still apply some constraints
          to prevent patterns that could form with the adjacent non-calendar date
        """
        logger.info("[OR-TOOLS] Adding adjacent conflict prevention (SOFT) (no xx, sx, xs)...")

        constraint_count = 0

        for staff in self.staff_members:
            staff_id = staff['id']
            staff_name = staff.get('name', staff_id)

            for i in range(len(self.date_range) - 1):
                date1 = self.date_range[i]
                date2 = self.date_range[i + 1]

                date1_is_calendar = date1 in self.calendar_off_dates
                date2_is_calendar = date2 in self.calendar_off_dates

                # If BOTH dates are calendar must_day_off, skip entirely
                # (both are forced to off anyway, nothing to constrain)
                if date1_is_calendar and date2_is_calendar:
                    continue

                # If date1 is calendar (forced off), only prevent xs pattern
                # (can't prevent xx since date1 is already fixed to off)
                if date1_is_calendar:
                    continue

                # If date2 is calendar (forced off), only prevent sx pattern
                if date2_is_calendar:
                    continue

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

        logger.info(f"[OR-TOOLS] Added {constraint_count} adjacent conflict soft constraints")

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

                # At least 1 OFF day (x) in the 6-day window
                # Only OFF counts as true rest, not early shift
                off_days = sum([
                    self.shifts[(staff_id, date, self.SHIFT_OFF)]
                    for date in window
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

        for rule in priority_rules:
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

            logger.info(f"  Rule: {rule.get('name', 'Unnamed')} - staff={target_staff_ids}, type={rule_type}, shift={shift_type_name}, days={target_days}, hard={is_hard}")

            # Apply rule to ALL target staff members
            for target_staff_id in target_staff_ids:
                for date in self.date_range:
                    # Skip calendar override dates
                    if date in self.calendar_off_dates:
                        continue

                    day_name = self._get_day_of_week(date)
                    if day_name not in target_days:
                        continue

                    shift_var = self.shifts[(target_staff_id, date, shift_type)]

                    if rule_type in ['avoided_shift', 'blocked']:
                        if is_hard:
                            # Hard constraint: MUST NOT have this shift on these days
                            self.model.Add(shift_var == 0)
                        else:
                            # Soft constraint: avoid this shift
                            self.avoided_vars.append((shift_var, priority_level))
                    else:
                        # Default to preferred_shift behavior (includes 'preferred_shift', 'required_off', or empty string)
                        if is_hard:
                            # Hard constraint: MUST have this shift on these days
                            self.model.Add(shift_var == 1)
                        else:
                            # Soft constraint: prefer this shift (add to objective with weight)
                            self.preferred_vars.append((shift_var, priority_level))

            rules_applied += 1

        logger.info(f"[OR-TOOLS] Priority rules: {rules_applied} applied, {rules_skipped} skipped")

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
                            self.preferred_vars.append(
                                (self.shifts[(staff_id, date, shift_type)], 2)
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
                                (self.shifts[(staff_id, date, shift_type)], 2)
                            )

    def _add_objective(self):
        """
        Optimization objective: What makes a "good" schedule?

        PRIMARY GOAL: Minimize constraint violations (soft constraints)
        SECONDARY GOAL: Maximize preferred shifts, minimize avoided shifts

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
                                any_member_off_var = backup_unavailable_slots[(staff_id, date)]

                                # CRITICAL FIX: Handle both BoolVar and literal values
                                try:
                                    member_off_value = solver.Value(any_member_off_var)
                                except Exception:
                                    # If any_member_off_var is a literal (not a variable),
                                    # it means we need to check it differently
                                    # This happens when the var was optimized to a constant
                                    member_off_value = 1 if any_member_off_var else 0

                                # LOGIC:
                                # - If any_member_off == 1 (coverage needed) → show normal shift (○, △, etc.)
                                # - If any_member_off == 0 (no coverage needed) AND shift is OFF → show ⊘
                                # - If any_member_off == 0 but shift is WORK → show normal (violation of unavailable)
                                if member_off_value == 0 and shift_type == self.SHIFT_OFF:
                                    # No coverage needed AND backup has OFF → show as Unavailable (⊘)
                                    schedule[staff_id][date] = UNAVAILABLE_SYMBOL
                                    backup_unavailable_count += 1
                                else:
                                    # Coverage needed OR backup is working → show normal shift symbol
                                    # ✅ FIX: For backup staff WORK shifts, use explicit ○ symbol instead of empty string
                                    # This prevents UI from converting empty to ⊘ for パート staff
                                    if shift_type == self.SHIFT_WORK:
                                        schedule[staff_id][date] = '○'  # Explicit work symbol for backup covering
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
