# Pre-filled Cells Feature Documentation

## Overview

The **Pre-filled Cells** feature allows restaurant managers to mark specific staff day-off requests before generating the AI schedule. This mimics the real-world workflow where staff submit time-off requests, and the manager enters them into the schedule before auto-filling the rest.

When the AI/OR-Tools optimizer runs, it treats these pre-filled cells as **HARD constraints** - they will never be changed, and the optimizer fills in the remaining empty cells while respecting all other scheduling rules.

---

## User Story

> As a restaurant manager, I want to enter staff day-off requests before generating the schedule, so that the AI fills in the remaining shifts while preserving the requested days off.

### Real-World Workflow

```
1. Staff member submits request: "I need Sunday the 15th off"
2. Manager opens the schedule for January-February period
3. Manager clicks on the cell for that staff member on the 15th
4. Manager enters "×" (day off symbol)
5. Manager repeats for all staff requests
6. Manager clicks "AI自動入力" (AI Auto-fill)
7. OR-Tools generates optimal schedule, preserving all pre-filled cells
8. Final schedule shows: requested days off + optimally assigned shifts
```

---

## Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Schedule Table (ScheduleTable.jsx)                │   │
│  │                                                                       │   │
│  │   Staff      │ Mon 1 │ Tue 2 │ Wed 3 │ Thu 4 │ Fri 5 │ Sat 6 │ Sun 7 │   │
│  │   ──────────────────────────────────────────────────────────────────   │   │
│  │   田中太郎   │       │       │  ×    │       │       │       │  ×    │   │
│  │   山田花子   │       │  △    │       │       │       │       │       │   │
│  │   佐藤次郎   │       │       │       │  ×    │       │       │       │   │
│  │                                                                       │   │
│  │   [×] = Pre-filled by manager (staff requested day off)              │   │
│  │   [△] = Pre-filled by manager (staff requested early shift)          │   │
│  │   [ ] = Empty cells to be filled by AI                               │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│                        ┌─────────────────────┐                              │
│                        │  Click "AI自動入力"  │                              │
│                        │  (AI Auto-fill)      │                              │
│                        └─────────────────────┘                              │
│                                    │                                         │
└────────────────────────────────────│─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REACT LAYER (useAIAssistantLazy.js)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Extract pre-filled cells from scheduleData                              │
│                                                                              │
│     scheduleData = {                                                        │
│       "staff-id-1": {                                                       │
│         "2025-01-03": "×",    // Pre-filled: day off                       │
│         "2025-01-07": "×",    // Pre-filled: day off                       │
│       },                                                                    │
│       "staff-id-2": {                                                       │
│         "2025-01-02": "△",    // Pre-filled: early shift                   │
│       },                                                                    │
│       "staff-id-3": {                                                       │
│         "2025-01-04": "×",    // Pre-filled: day off                       │
│       }                                                                     │
│     }                                                                       │
│                                                                              │
│  2. Build WebSocket message with prefilledSchedule                          │
│                                                                              │
│     {                                                                       │
│       type: "GENERATE_SCHEDULE_ORTOOLS",                                    │
│       payload: {                                                            │
│         staffMembers: [...],                                                │
│         dateRange: ["2025-01-01", "2025-01-02", ...],                       │
│         constraints: { calendarRules, staffGroups, ... },                   │
│         prefilledSchedule: { ... },  // ← NEW FIELD                        │
│         timeout: 30                                                         │
│       }                                                                     │
│     }                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GO SERVER (main.go:8080)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  handleGenerateScheduleORTools():                                           │
│                                                                              │
│  1. Parse message payload                                                   │
│  2. Extract prefilledSchedule field                                         │
│  3. Log: "[ORTOOLS] prefilledSchedule: 3 staff with pre-filled cells"      │
│  4. Forward ALL data to Python OR-Tools service via HTTP POST               │
│                                                                              │
│     POST http://ortools-optimizer:5000/optimize                             │
│     {                                                                       │
│       "staffMembers": [...],                                                │
│       "dateRange": [...],                                                   │
│       "constraints": {                                                      │
│         "calendarRules": {...},                                             │
│         "staffGroups": [...],                                               │
│         "prefilledSchedule": {        // ← Forwarded to Python             │
│           "staff-id-1": { "2025-01-03": "×", "2025-01-07": "×" },          │
│           "staff-id-2": { "2025-01-02": "△" },                             │
│           "staff-id-3": { "2025-01-04": "×" }                              │
│         }                                                                   │
│       },                                                                    │
│       "timeout": 30                                                         │
│     }                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP POST
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PYTHON OR-TOOLS SERVICE (scheduler.py:5001)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  optimize_schedule():                                                       │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    CONSTRAINT PRIORITY ORDER                          │  │
│  │                                                                       │  │
│  │  ① _add_prefilled_constraints()     ← NEW! HIGHEST PRIORITY          │  │
│  │     - User pre-filled cells become HARD constraints                  │  │
│  │     - model.Add(shifts[staff, date, type] == 1)                      │  │
│  │     - These cells are LOCKED and cannot be changed                   │  │
│  │                                                                       │  │
│  │  ② _add_calendar_rules()             Calendar must_day_off/must_work │  │
│  │  ③ _add_backup_staff_constraints()   Backup staff never off          │  │
│  │  ④ _add_staff_group_constraints()    Max 1 off/early per group       │  │
│  │  ⑤ _add_staff_type_daily_limits()    Per-type daily limits           │  │
│  │  ⑥ _add_monthly_limits()             Min/max off per period          │  │
│  │  ⑦ _add_5_day_rest_constraint()      Labor law (max 5 work days)     │  │
│  │  ⑧ _add_adjacent_conflict_prevention() No xx, sx, xs patterns        │  │
│  │  ⑨ _add_priority_rules()             Preferred/avoided shifts        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  _add_prefilled_constraints():                                              │
│                                                                              │
│    for staff_id, dates in prefilledSchedule.items():                        │
│        for date, symbol in dates.items():                                   │
│            shift_type = symbol_to_type(symbol)  # "×" → SHIFT_OFF          │
│            # HARD CONSTRAINT: This cell MUST have this shift               │
│            model.Add(shifts[(staff_id, date, shift_type)] == 1)            │
│                                                                              │
│  Result: OR-Tools solver preserves ALL pre-filled cells                     │
│          and optimizes only the remaining empty cells                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Response
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FINAL SCHEDULE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Staff      │ Mon 1 │ Tue 2 │ Wed 3 │ Thu 4 │ Fri 5 │ Sat 6 │ Sun 7 │      │
│   ──────────────────────────────────────────────────────────────────         │
│   田中太郎   │   ○   │   ○   │  [×]  │   ○   │   △   │   ○   │  [×]  │      │
│   山田花子   │   ○   │  [△]  │   ○   │   ×   │   ○   │   ○   │   ○   │      │
│   佐藤次郎   │   △   │   ○   │   ○   │  [×]  │   ○   │   ×   │   ○   │      │
│                                                                              │
│   [×] [△] = Pre-filled cells (PRESERVED from user input)                   │
│   ○ × △    = AI-generated cells (optimized by OR-Tools)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Pre-filled Schedule Format

```typescript
// TypeScript interface
interface PrefilledSchedule {
  [staffId: string]: {
    [dateKey: string]: ShiftSymbol;
  };
}

type ShiftSymbol = '' | '○' | '×' | '△' | '◇' | '★' | '●' | '◎' | '▣' | '⊘';

// Example
const prefilledSchedule: PrefilledSchedule = {
  "staff-uuid-001": {
    "2025-01-03": "×",  // Day off
    "2025-01-07": "×",  // Day off
  },
  "staff-uuid-002": {
    "2025-01-02": "△",  // Early shift
  },
  "staff-uuid-003": {
    "2025-01-04": "×",  // Day off
    "2025-01-11": "×",  // Day off
  },
};
```

### Shift Symbol Mapping

| Symbol | Japanese | English | Shift Type Constant |
|--------|----------|---------|---------------------|
| `''` or `○` | 通常 | Normal/Work | `SHIFT_WORK = 0` |
| `×` | 休み | Day Off | `SHIFT_OFF = 1` |
| `△` | 早番 | Early Shift | `SHIFT_EARLY = 2` |
| `◇` | 遅番 | Late Shift | `SHIFT_LATE = 3` |

### Special/Star Symbols (Treated as WORK)

These symbols are used for special duties or designations. They are treated internally as WORK shifts for constraint solving, but their **original symbol is preserved** in the final schedule output.

| Symbol | Unicode | Japanese | English | Shift Type |
|--------|---------|----------|---------|------------|
| `★` | `\u2605` | 特別業務 | Special Duty | `SHIFT_WORK = 0` |
| `☆` | `\u2606` | 補助業務 | Support Duty | `SHIFT_WORK = 0` |
| `●` | `\u25cf` | 主担当 | Primary | `SHIFT_WORK = 0` |
| `◎` | `\u25ce` | 責任者 | Manager on Duty | `SHIFT_WORK = 0` |
| `▣` | `\u25a3` | 研修 | Training | `SHIFT_WORK = 0` |
| `⊘` | `\u2298` | 半休 | Half Day | `SHIFT_WORK = 0` |

**Important:** When a cell is pre-filled with a star symbol (e.g., `★`), the OR-Tools optimizer:
1. Adds a HARD constraint forcing that cell to be a WORK shift
2. Preserves the original `★` symbol in the output (not converted to empty string `''`)

---

## Implementation Details

### Phase 1: React Hook (`useAIAssistantLazy.js`)

**Location:** `src/hooks/useAIAssistantLazy.js`

**Changes:**

```javascript
// Line ~184: generateAIPredictions function
const generateAIPredictions = useCallback(
  async (onProgress) => {
    // ... existing code ...

    // NEW: Extract pre-filled cells from current schedule
    const prefilledSchedule = {};
    let prefilledCount = 0;

    if (scheduleData && typeof scheduleData === 'object') {
      Object.entries(scheduleData).forEach(([staffId, dates]) => {
        if (dates && typeof dates === 'object') {
          Object.entries(dates).forEach(([dateKey, shiftValue]) => {
            // Only include non-empty cells
            if (shiftValue && typeof shiftValue === 'string' && shiftValue.trim() !== '') {
              if (!prefilledSchedule[staffId]) {
                prefilledSchedule[staffId] = {};
              }
              prefilledSchedule[staffId][dateKey] = shiftValue;
              prefilledCount++;
            }
          });
        }
      });
    }

    console.log(`[OR-TOOLS] Extracted ${prefilledCount} pre-filled cells from schedule`);

    // Line ~330: Send request with prefilledSchedule
    const sent = sendMessage(MESSAGE_TYPES.GENERATE_SCHEDULE_ORTOOLS, {
      staffMembers: staffMembers.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        position: s.position,
      })),
      dateRange,
      constraints,
      prefilledSchedule,  // ← NEW FIELD
      timeout: 30,
    });

    // ... rest of existing code ...
  },
  [scheduleData, staffMembers, /* ... other deps ... */]
);
```

### Phase 2: Go Server (`main.go`)

**Location:** `go-server/main.go`

**Changes in `handleGenerateScheduleORTools()`:**

```go
// Line ~1442: Extract pre-filled schedule
prefilledSchedule, _ := payload["prefilledSchedule"].(map[string]interface{})
if prefilledSchedule != nil {
    prefilledCount := 0
    for _, dates := range prefilledSchedule {
        if datesMap, ok := dates.(map[string]interface{}); ok {
            prefilledCount += len(datesMap)
        }
    }
    log.Printf("[ORTOOLS] prefilledSchedule: %d cells from %d staff members",
        prefilledCount, len(prefilledSchedule))
} else {
    log.Printf("[ORTOOLS] prefilledSchedule: NONE (will generate full schedule)")
}

// Line ~1550: Add to constraints before sending to Python
if prefilledSchedule != nil {
    constraints["prefilledSchedule"] = prefilledSchedule
}
```

### Phase 3: Python OR-Tools (`scheduler.py`)

**Location:** `python-ortools-service/scheduler.py`

**New method `_add_prefilled_constraints()`:**

```python
def _add_prefilled_constraints(self):
    """
    PRE-PHASE: Lock user-edited cells as HARD constraints.

    These represent staff day-off requests entered by the manager before
    AI schedule generation. They MUST be preserved in the final schedule.

    This is the HIGHEST PRIORITY constraint - runs before calendar rules.

    Format from React:
    {
        "staff-id-1": {
            "2025-01-03": "×",
            "2025-01-07": "×"
        },
        "staff-id-2": {
            "2025-01-02": "△"
        }
    }
    """
    prefilled = self.constraints_config.get('prefilledSchedule', {})

    if not prefilled:
        logger.info("[OR-TOOLS] No pre-filled cells provided - generating full schedule")
        return

    # Build lookup for valid staff IDs
    valid_staff_ids = {s['id'] for s in self.staff_members}

    locked_count = 0
    skipped_count = 0

    logger.info(f"[OR-TOOLS] Processing pre-filled cells for {len(prefilled)} staff members...")

    for staff_id, dates in prefilled.items():
        # Validate staff ID exists
        if staff_id not in valid_staff_ids:
            logger.warning(f"  Skipping unknown staff ID: {staff_id}")
            skipped_count += 1
            continue

        if not isinstance(dates, dict):
            continue

        for date_key, shift_symbol in dates.items():
            # Validate date is in our range
            if date_key not in self.date_range:
                logger.debug(f"  Skipping date outside range: {date_key}")
                skipped_count += 1
                continue

            # Convert symbol to shift type
            shift_type = self._symbol_to_shift_type(shift_symbol)

            # Add HARD constraint: This cell MUST have this exact shift
            self.model.Add(self.shifts[(staff_id, date_key, shift_type)] == 1)
            locked_count += 1

            # Find staff name for logging
            staff_name = next(
                (s.get('name', staff_id) for s in self.staff_members if s['id'] == staff_id),
                staff_id
            )
            logger.debug(f"  Locked: {staff_name} on {date_key} = {shift_symbol}")

    logger.info(f"[OR-TOOLS] Added {locked_count} pre-filled cell HARD constraints "
                f"({skipped_count} skipped)")

def _symbol_to_shift_type(self, symbol: str) -> int:
    """
    Convert shift symbol to internal type constant.

    Handles various symbol formats:
    - Japanese symbols: ×, △, ◇, ○
    - Unicode variations: \u00d7, \u25b3, \u25c7
    - Empty string = normal work
    """
    if not symbol or symbol.strip() == '':
        return self.SHIFT_WORK

    symbol = symbol.strip()

    # Primary mapping (exact matches)
    symbol_map = {
        '×': self.SHIFT_OFF,      # Multiplication sign
        '\u00d7': self.SHIFT_OFF, # Unicode multiplication
        '✕': self.SHIFT_OFF,      # Heavy multiplication
        'x': self.SHIFT_OFF,      # Lowercase x (fallback)
        'X': self.SHIFT_OFF,      # Uppercase X (fallback)

        '△': self.SHIFT_EARLY,    # Triangle
        '\u25b3': self.SHIFT_EARLY,
        '▲': self.SHIFT_EARLY,    # Filled triangle (alternate)

        '◇': self.SHIFT_LATE,     # Diamond/Lozenge
        '\u25c7': self.SHIFT_LATE,
        '◆': self.SHIFT_LATE,     # Filled diamond (alternate)

        '○': self.SHIFT_WORK,     # Circle = normal work
        '●': self.SHIFT_WORK,     # Filled circle
    }

    return symbol_map.get(symbol, self.SHIFT_WORK)
```

**Update `optimize_schedule()` to call new method:**

```python
def optimize_schedule(self, ...):
    # ... existing code ...

    try:
        # 1. Create decision variables
        self._create_variables()

        # 2. Add all constraints (order matters!)
        self._add_basic_constraints()              # One shift per staff per day
        self._add_prefilled_constraints()          # ← NEW! HIGHEST PRIORITY
        self._add_calendar_rules()                 # PRE-PHASE + Phase 3 Integration
        self._add_backup_staff_constraints()       # Backup staff handling
        # ... rest of constraints ...
```

---

## Monthly Limits Integration

### How Pre-filled OFF Days Count Towards Monthly Limits

**Important Feature:** Pre-filled OFF days (×) **automatically count towards monthly limits**. This ensures fair distribution of days off across all staff members.

### How It Works

When a manager pre-fills `×` (day off) cells before AI generation:
1. The optimizer counts these pre-filled OFF days
2. The remaining monthly limit is reduced accordingly
3. Only the remaining quota can be assigned by the optimizer

### Example Scenario

```
Configuration:
  Monthly limit: min=2, max=3 off days per staff
  Date range: 10 days (2025-01-01 to 2025-01-10)

Pre-filled cells:
  staff-1 (田中太郎): 2 pre-filled × days (2025-01-02, 2025-01-05)
  staff-2 (山田花子): 0 pre-filled days

Expected behavior:
  staff-1: Can get at most 1 more × day (2 pre-filled + 1 assigned = 3 total max)
  staff-2: Can get 2-3 × days (normal monthly limit)

Result (Actual):
  Staff        | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | Total ×
  田中太郎      |  ○ |  × |  ○ |  ○ |  × |  ○ |  △ |  ○ |  × |  ○ |   3 ✓
  山田花子      |  ○ |  △ |  △ |  △ |  ○ |  × |  ○ |  × |  ○ |  × |   3 ✓

  staff-1: 3 off days (2 pre-filled + 1 assigned) - at max limit ✓
  staff-2: 3 off days (normal monthly limit) ✓
```

### Technical Implementation

The OR-Tools optimizer uses the **same shift variables** for both pre-filled and assigned days. This means:

1. Pre-filled `×` days create HARD constraints: `shifts[(staff_id, date, SHIFT_OFF)] == 1`
2. Monthly limits sum ALL off days: `sum(shifts[(staff_id, date, SHIFT_OFF)] for all dates)`
3. Since pre-filled days use the same variables, they are **automatically counted**

### Logging Output

The Python OR-Tools service logs pre-filled off day counts per staff:

```
[OR-TOOLS] 🔒 Pre-filled OFF days count towards monthly limits:
    田中太郎: 2 pre-filled × → remaining limit: 1 (max=3)
    佐藤次郎: 1 pre-filled × → remaining limit: 2 (max=3)
[OR-TOOLS] Monthly OFF limit constraint: min=2, max=3 per staff
```

### Key Points

| Aspect | Behavior |
|--------|----------|
| Pre-filled `×` counts | ✓ Automatically included in monthly OFF count |
| Pre-filled `△` counts | ✓ Automatically included in monthly EARLY count (if tracked) |
| Pre-filled `★` counts | ✗ Treated as WORK - does not count towards OFF limits |
| Overflow prevention | ✓ If staff has max pre-filled ×, no more assigned |
| Minimum enforcement | ✓ If staff has fewer than min pre-filled ×, more are assigned |

### Verification Tests

Test script: `python-ortools-service/test_prefilled_monthly.py`

```bash
cd python-ortools-service
python3 test_prefilled_monthly.py
```

Expected output:
```
✓ staff-1 (田中太郎): 3 off days (max allowed: 3)
✓ Pre-filled days preserved: 01-02=×, 01-05=×
✓ staff-2 (山田花子): 3 off days (expected: 2-3)

✅ Monthly limits correctly account for pre-filled off days!
```

---

## Conflict Resolution

### What happens when pre-filled cells conflict with other constraints?

| Conflict Type | Resolution | Example |
|---------------|------------|---------|
| **Pre-filled vs Calendar Rule** | Pre-filled wins (user intent) | User marks "×" on a must_work day → stays "×" |
| **Pre-filled vs Staff Group** | **Infeasible error** | Two staff in same group both marked "×" on same day |
| **Pre-filled vs Monthly Limit** | Pre-filled counts towards limit | If max=7 and 5 pre-filled ×, only 2 more can be assigned |
| **Pre-filled exceeds Monthly Max** | Soft constraint allows it | User marks 10 days off (exceeds max 8) → allowed but logged as violation |
| **Pre-filled vs 5-Day Rest** | Depends on HARD/SOFT mode | Hard mode → error; Soft mode → allowed with penalty |

### Handling Infeasible Schedules

When pre-filled cells make the schedule impossible:

```python
# In _extract_solution():
if status == cp_model.INFEASIBLE:
    logger.error("[OR-TOOLS] Schedule is INFEASIBLE - check pre-filled cells for conflicts")
    return {
        'success': False,
        'error': 'Schedule constraints are unsatisfiable. Check if pre-filled cells '
                 'conflict with staff group rules or other hard constraints.',
        'status': 'INFEASIBLE',
        'schedule': {},
        'suggestions': [
            'Remove conflicting day-off requests for staff in the same group',
            'Check calendar rules for conflicts with pre-filled cells',
            'Reduce number of pre-filled day-off cells'
        ]
    }
```

---

## UI Enhancement (Optional)

### Visual Indicators for Pre-filled Cells

**File:** `src/components/schedule/ScheduleTable.jsx`

```jsx
// Add visual distinction for pre-filled vs AI-generated cells
const CellContent = ({ staffId, dateKey, value, isPreFilled }) => {
  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center",
        isPreFilled && "bg-blue-50 border-2 border-blue-400 rounded"
      )}
      title={isPreFilled ? "事前入力済み (変更されません)" : "AI生成"}
    >
      {isPreFilled && (
        <span className="absolute top-0 right-0 text-xs text-blue-500">
          🔒
        </span>
      )}
      <span>{value}</span>
    </div>
  );
};
```

### Legend for Schedule Table

```jsx
<div className="flex gap-4 text-sm text-gray-600 mb-2">
  <span className="flex items-center gap-1">
    <div className="w-4 h-4 bg-blue-50 border-2 border-blue-400 rounded" />
    事前入力 (Pre-filled)
  </span>
  <span className="flex items-center gap-1">
    <div className="w-4 h-4 bg-white border border-gray-200 rounded" />
    AI生成 (AI Generated)
  </span>
</div>
```

---

## Testing Scenarios

### Test Case 1: Basic Pre-fill Preservation

```
Given: Empty schedule
When: User pre-fills 3 cells with "×"
And: User clicks "AI自動入力"
Then: All 3 pre-filled cells remain "×"
And: Remaining cells are optimally filled
```

### Test Case 2: Staff Group Conflict

```
Given: Staff A and B are in the same group
When: User pre-fills both A and B with "×" on Monday
And: User clicks "AI自動入力"
Then: Error message: "Schedule infeasible - staff group conflict"
Or: Warning if staff group is SOFT constraint
```

### Test Case 3: Calendar Rule Override

```
Given: January 15 is marked "must_work" in calendar rules
When: User pre-fills Staff A with "×" on January 15
And: User clicks "AI自動入力"
Then: Staff A has "×" on January 15 (user intent overrides calendar)
And: Log warning: "Pre-filled cell overrides calendar must_work rule"
```

### Test Case 4: Empty Schedule (No Pre-fills)

```
Given: Schedule is completely empty
When: User clicks "AI自動入力" without pre-filling any cells
Then: Full schedule is generated (same as current behavior)
And: prefilledSchedule = {} is sent to optimizer
```

### Test Case 5: All Cells Pre-filled

```
Given: User has manually filled every cell in the schedule
When: User clicks "AI自動入力"
Then: Schedule remains unchanged (nothing to optimize)
And: Quick response (trivial solve)
```

### Test Case 6: Pre-filled Cells Count Towards Monthly Limits

```
Given: Monthly limit is max=3 off days per staff
And: Staff A has 2 pre-filled × days (2025-01-02, 2025-01-05)
And: Staff B has 0 pre-filled days
When: User clicks "AI自動入力"
Then: Staff A gets at most 1 more × day (total max 3)
And: Staff B gets 2-3 × days (normal monthly limit)
And: Log shows: "Staff A: 2 pre-filled × → remaining limit: 1"
```

### Test Case 7: Pre-filled Exceeds Monthly Maximum

```
Given: Monthly limit is max=3 off days per staff
And: Staff A has 5 pre-filled × days (exceeds max by 2)
When: User clicks "AI自動入力"
Then: Schedule is generated (soft constraint allows it)
And: Staff A keeps all 5 × days (pre-filled are HARD constraints)
And: Violation logged: "Monthly limit exceeded for Staff A: 5 > 3"
And: Penalty applied to objective function
```

---

## Logging Examples

### React Console

```
[OR-TOOLS] Extracted 5 pre-filled cells from schedule
[OR-TOOLS] Pre-filled cells: {
  "staff-001": { "2025-01-03": "×", "2025-01-07": "×" },
  "staff-002": { "2025-01-02": "△" },
  "staff-003": { "2025-01-04": "×", "2025-01-11": "×" }
}
```

### Go Server

```
[ORTOOLS] prefilledSchedule: 5 cells from 3 staff members
[ORTOOLS] Forwarding to Python OR-Tools service...
```

### Python OR-Tools

```
[OR-TOOLS] Processing pre-filled cells for 3 staff members...
  Locked: 田中太郎 on 2025-01-03 = ×
  Locked: 田中太郎 on 2025-01-07 = ×
  Locked: 山田花子 on 2025-01-02 = △
  Locked: 佐藤次郎 on 2025-01-04 = ×
  Locked: 佐藤次郎 on 2025-01-11 = ×
[OR-TOOLS] Added 5 pre-filled cell HARD constraints (0 skipped)
```

---

## API Reference

### WebSocket Message: GENERATE_SCHEDULE_ORTOOLS

**Request:**
```json
{
  "type": "GENERATE_SCHEDULE_ORTOOLS",
  "payload": {
    "staffMembers": [
      { "id": "uuid-1", "name": "田中太郎", "status": "社員", "position": "調理" }
    ],
    "dateRange": ["2025-01-01", "2025-01-02", "..."],
    "constraints": {
      "calendarRules": {},
      "staffGroups": [],
      "monthlyLimit": { "minCount": 7, "maxCount": 8 },
      "staffTypeLimits": { "社員": { "maxOff": 1 } }
    },
    "prefilledSchedule": {
      "uuid-1": {
        "2025-01-03": "×",
        "2025-01-07": "×"
      }
    },
    "timeout": 30
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Response (Success):**
```json
{
  "type": "SCHEDULE_GENERATED",
  "payload": {
    "success": true,
    "schedule": {
      "uuid-1": {
        "2025-01-01": "○",
        "2025-01-02": "○",
        "2025-01-03": "×",
        "2025-01-07": "×"
      }
    },
    "isOptimal": true,
    "solveTime": 1.23,
    "stats": {
      "prefilledCellsPreserved": 2,
      "totalViolations": 0
    }
  }
}
```

---

## Migration Notes

### Backward Compatibility

- If `prefilledSchedule` is not provided, optimizer generates full schedule (current behavior)
- No database schema changes required
- No breaking changes to existing API

### Feature Flag (Optional)

```javascript
// In useAIAssistantLazy.js
const ENABLE_PREFILLED_CELLS = process.env.REACT_APP_ENABLE_PREFILLED_CELLS !== 'false';

if (ENABLE_PREFILLED_CELLS && scheduleData) {
  // Extract pre-filled cells...
}
```

---

## Related Documentation

- [AI Generation Flow Documentation](./AI_GENERATION_FLOW_DOCUMENTATION.md)
- [OR-Tools Migration Guide](./OR_TOOLS_MIGRATION_GUIDE.md)
- [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-XX | Initial implementation |
| 1.1 | 2025-01-XX | Added star symbol support (★, ●, ◎, etc.) |
| 1.2 | 2025-01-XX | Monthly limits integration - pre-filled OFF days count towards limits |

---

## Authors

- Feature Design: Claude Code Assistant
- Implementation: [Your Name]
