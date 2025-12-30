# AI Schedule Generation Flow: Complete Documentation

**Document Version:** 2.0
**Last Updated:** 2025-12-23
**Status:** Complete Reference Guide (OR-Tools Architecture)
**Investigation Level:** Very Thorough

---

## Major Architecture Change Notice

**Version 2.0 (OR-Tools Migration):**

This document has been completely rewritten to reflect the new OR-Tools constraint programming architecture. The previous rule-based system (BusinessRuleValidator, HybridPredictor, TensorFlowScheduler) has been replaced with:

- **Python OR-Tools CP-SAT Solver** for constraint optimization
- **Go WebSocket Server** for real-time communication and orchestration
- **Per-Staff-Type Daily Limits** (`staffTypeLimits`) as the PRIMARY constraint method
- **Deprecated**: Global daily limits (`dailyLimitsRaw`) - auto-disabled when staffTypeLimits configured

**Previous System (Deprecated):**
- BusinessRuleValidator.generateRuleBasedSchedule()
- HybridPredictor with ML fallback
- Multiple re-enforcement phases
- JavaScript-based constraint checking

**Current System (OR-Tools):**
- Python OR-Tools CP-SAT constraint programming solver
- Go WebSocket server for communication
- Declarative constraint definition
- Optimal/feasible solution finding

---

## Executive Summary

The AI schedule generation system now uses **Google OR-Tools CP-SAT Solver** for constraint programming optimization. This provides mathematically optimal solutions instead of heuristic-based generation.

### Key Architecture Facts
- **Entry Point:** `useAIAssistantLazy.js` hook → WebSocket → Go Server → Python OR-Tools
- **Primary Engine:** `python-ortools-service/scheduler.py` (CP-SAT Solver)
- **Constraint Method:** `staffTypeLimits` (per-staff-type daily limits) - PRIMARY
- **Communication:** WebSocket real-time protocol
- **Solution Quality:** Optimal or feasible solutions with solve time metrics

### Architecture Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  React App (useAIAssistantLazy.js)                             │
│  ├── WebSocket Client (ws://localhost:8080)                    │
│  ├── Constraint Configuration (staffTypeLimits, etc.)          │
│  └── Progress Callbacks & Result Handling                      │
├─────────────────────────────────────────────────────────────────┤
│                    GO WEBSOCKET SERVER (:8080)                  │
├─────────────────────────────────────────────────────────────────┤
│  go-server/main.go                                             │
│  ├── WebSocket Message Routing                                 │
│  ├── GENERATE_SCHEDULE_ORTOOLS Handler                         │
│  ├── HTTP Client to Python Service                             │
│  └── Result Broadcasting to Clients                            │
├─────────────────────────────────────────────────────────────────┤
│                 PYTHON OR-TOOLS SERVICE (:5001)                 │
├─────────────────────────────────────────────────────────────────┤
│  python-ortools-service/scheduler.py                           │
│  ├── CP-SAT Model Builder                                      │
│  ├── Constraint Definition (HARD/SOFT)                         │
│  │   ├── Staff Groups (no 2 members off same day)              │
│  │   ├── Staff Type Limits (per-type max off/early)  ← PRIMARY │
│  │   ├── Monthly Limits (MIN/MAX off days per month)           │
│  │   ├── Calendar Rules (must_day_off, must_work)              │
│  │   ├── 5-Day Rest (no >5 consecutive work days)              │
│  │   └── Adjacent Patterns (no ××, no △× patterns)             │
│  ├── Penalty Weight System                                     │
│  └── Optimal/Feasible Solution Finder                          │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL                                           │
│  ├── Staff Members (with status: 社員, 派遣, パート)            │
│  ├── Schedule Data                                             │
│  ├── Calendar Rules                                            │
│  ├── Staff Groups                                              │
│  └── AI Settings (staffTypeLimits, etc.)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Entry Points: Where AI Generation Starts

### 1.1 Component Entry Point: `ShiftScheduleEditorPhase3.jsx`

**Location:** `src/components/ShiftScheduleEditorPhase3.jsx`

The main scheduling interface triggers AI generation when user clicks "自動生成" (Auto-fill) button:

```javascript
const handleAutoFill = async () => {
  const { generateAIPredictions } = useAIAssistantLazy(
    scheduleData,
    staffMembers,
    currentMonthIndex,
    saveSchedule
  );

  const result = await generateAIPredictions((progress) => {
    updateProgressBar(progress);
  });

  if (result.success) {
    console.log(`Generated schedule (${result.isOptimal ? 'optimal' : 'feasible'})`);
  }
};
```

### 1.2 Hook Entry Point: `useAIAssistantLazy.js`

**Location:** `src/hooks/useAIAssistantLazy.js`

OR-Tools version that sends requests to Go server via WebSocket:

```javascript
export const useAIAssistantLazy = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  saveSchedule,
  options = {}
) => {
  // WebSocket connection to Go server
  const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8080";

  const generateAIPredictions = async (onProgress) => {
    // 1. Connect to WebSocket
    await connectWebSocket();

    // 2. Load constraints from database
    const earlyShiftPreferences = await EarlyShiftPreferencesLoader.loadPreferences();
    const calendarRules = await CalendarRulesLoader.loadRules();

    // 3. Prepare constraints payload
    const constraints = {
      calendarRules,
      earlyShiftPreferences,
      // DEPRECATED: Global daily limits - auto-disabled when staffTypeLimits configured
      dailyLimitsRaw: aiSettings?.dailyLimitsRaw || { minOffPerDay: 0, maxOffPerDay: 3 },
      monthlyLimit: aiSettings?.monthlyLimit || { minCount: 7, maxCount: 8 },
      staffGroups: aiSettings?.staffGroups || [],
      // ✅ PRIMARY: Staff Type Daily Limits
      staffTypeLimits: aiSettings?.staffTypeLimits || {
        '社員': { maxOff: 1, maxEarly: 2, isHard: true },
      },
      ortoolsConfig: aiSettings?.ortoolsConfig || { preset: 'balanced' },
    };

    // 4. Send to Go server via WebSocket
    sendMessage('GENERATE_SCHEDULE_ORTOOLS', {
      staffMembers,
      dateRange,
      constraints,
      timeout: 30,
    });

    // 5. Wait for response
    const result = await waitForResponse();

    // 6. Save and return
    await saveSchedule(result.schedule);
    return result;
  };
};
```

**Key Responsibilities:**
- WebSocket connection management
- Loading constraint data (calendar rules, early shift preferences)
- Preparing constraint payload with `staffTypeLimits` as primary
- Sending generation request to Go server
- Handling responses and saving results

---

## 2. Constraint Configuration

### 2.1 Staff Type Daily Limits (PRIMARY)

**Location:** Settings UI → Database → `staffTypeLimits`

The PRIMARY constraint method for controlling daily off/early shifts per staff type:

```javascript
staffTypeLimits: {
  '社員': {           // Staff type (matches staff.status field)
    maxOff: 1,        // Max staff of this type off per day
    maxEarly: 2,      // Max staff of this type with early shift per day
    isHard: true      // HARD constraint (must be satisfied) vs SOFT (penalty-based)
  },
  '派遣': {
    maxOff: 2,
    maxEarly: 1,
    isHard: false     // SOFT: penalty applied if violated
  },
  'パート': {
    maxOff: 3,
    maxEarly: 2,
    isHard: false
  }
}
```

**Staff Type Mapping:**
- `社員` (Shain) - Regular employee
- `派遣` (Haken) - Dispatched worker
- `パート` (Part) - Part-time worker

**How It Works in Python Scheduler:**
```python
def _add_staff_type_daily_limits(self):
    """Per-staff-type daily limits - PRIMARY constraint method"""
    staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

    for staff_type, limits in staff_type_limits.items():
        max_off = limits.get('maxOff', 999)
        max_early = limits.get('maxEarly', 999)
        is_hard = limits.get('isHard', False)

        # Get staff of this type
        staff_of_type = [s for s in self.staff if s.get('status') == staff_type]

        for date in self.dates:
            # Count off shifts for this type on this date
            off_vars = [self.shift_vars[(s['id'], date, '×')] for s in staff_of_type]

            if is_hard:
                # HARD constraint: Must not exceed
                self.model.Add(sum(off_vars) <= max_off)
            else:
                # SOFT constraint: Add penalty if exceeded
                excess = self.model.NewIntVar(0, len(staff_of_type), f'excess_off_{staff_type}_{date}')
                self.model.Add(excess >= sum(off_vars) - max_off)
                self.penalties.append(excess * self.penalty_weights['staffTypeLimitViolation'])
```

### 2.2 Global Daily Limits (DEPRECATED)

**Status:** Auto-disabled when `staffTypeLimits` is configured

```javascript
// DEPRECATED - kept for backward compatibility
dailyLimitsRaw: {
  minOffPerDay: 0,    // Set to 0 to effectively disable
  maxOffPerDay: 3,    // Maximum staff off per day (all types combined)
  minEarlyPerDay: 0,
  maxEarlyPerDay: 2,
}
```

**Auto-Disable Logic in Python:**
```python
def _add_daily_limits(self):
    """Global daily limits - AUTO-DISABLED when staffTypeLimits configured"""
    staff_type_limits = self.constraints_config.get('staffTypeLimits', {})

    # AUTO-DISABLE: Skip global daily limits when staff type limits are configured
    if staff_type_limits and len(staff_type_limits) > 0:
        logger.info("[OR-TOOLS] Daily limits AUTO-DISABLED (staffTypeLimits configured)")
        return

    # Only runs if no staffTypeLimits configured (legacy mode)
    # ... global limit logic ...
```

### 2.3 Monthly Limits

**Configuration:**
```javascript
monthlyLimit: {
  minCount: 7,                    // MIN off days per staff per month
  maxCount: 8,                    // MAX off days per staff per month
  excludeCalendarRules: true,     // Calendar must_day_off excluded from count
}
```

**Python Implementation:**
```python
def _add_monthly_limits(self):
    """Monthly off-day limits per staff"""
    monthly_limit = self.constraints_config.get('monthlyLimit', {})
    min_count = monthly_limit.get('minCount', 7)
    max_count = monthly_limit.get('maxCount', 8)

    for staff in self.staff:
        off_vars = [self.shift_vars[(staff['id'], d, '×')] for d in self.dates]

        # MIN constraint (soft - penalty if not met)
        under_min = self.model.NewIntVar(0, len(self.dates), f'under_min_{staff["id"]}')
        self.model.Add(under_min >= min_count - sum(off_vars))
        self.penalties.append(under_min * self.penalty_weights['monthlyLimit'])

        # MAX constraint (hard - must not exceed)
        self.model.Add(sum(off_vars) <= max_count)
```

### 2.4 Staff Groups

**Configuration:**
```javascript
staffGroups: [
  {
    id: "group-1",
    name: "Group 1",
    members: ["staff-uuid-1", "staff-uuid-2"],
    // Rule: Only 1 member can be off/early on same day
  }
]
```

**Python Implementation:**
```python
def _add_staff_group_constraints(self):
    """Staff group constraints - only 1 member off per day per group"""
    staff_groups = self.constraints_config.get('staffGroups', [])

    for group in staff_groups:
        members = group.get('members', [])

        for date in self.dates:
            # For each group, at most 1 member can be off on each date
            off_vars = []
            for member_id in members:
                if member_id in self.staff_id_to_idx:
                    off_vars.append(self.shift_vars[(member_id, date, '×')])

            if len(off_vars) > 1:
                # HARD constraint: At most 1 member off
                self.model.Add(sum(off_vars) <= 1)
```

### 2.5 Calendar Rules

**Configuration:**
```javascript
calendarRules: {
  "2025-12-25": { must_day_off: true },   // Everyone off
  "2026-01-01": { must_work: true },      // Everyone works
}
```

**Python Implementation:**
```python
def _add_calendar_rules(self):
    """Calendar rules - must_day_off and must_work dates"""
    calendar_rules = self.constraints_config.get('calendarRules', {})

    for date, rules in calendar_rules.items():
        if rules.get('must_day_off'):
            # HARD: Everyone must be off (× or △)
            for staff in self.staff:
                work_var = self.shift_vars[(staff['id'], date, '○')]
                self.model.Add(work_var == 0)  # Cannot work

        elif rules.get('must_work'):
            # HARD: Everyone must work
            for staff in self.staff:
                off_var = self.shift_vars[(staff['id'], date, '×')]
                self.model.Add(off_var == 0)  # Cannot be off
```

### 2.6 5-Day Rest Constraint

**Rule:** No staff can work more than 5 consecutive days without a rest day (× or △).

**Python Implementation:**
```python
def _add_five_day_rest_constraint(self):
    """5-day rest - no more than 5 consecutive work days"""

    for staff in self.staff:
        for window_start in range(len(self.dates) - 5):
            window_dates = self.dates[window_start:window_start + 6]

            # At least 1 rest day (× or △) in any 6-day window
            rest_vars = []
            for date in window_dates:
                rest_vars.append(self.shift_vars[(staff['id'], date, '×')])
                rest_vars.append(self.shift_vars[(staff['id'], date, '△')])

            # HARD constraint: At least 1 rest day
            self.model.Add(sum(rest_vars) >= 1)
```

### 2.7 Adjacent Pattern Prevention

**Patterns Prevented:**
- `××` - Two consecutive off days
- `△×` - Early shift followed by off day

**Python Implementation:**
```python
def _add_adjacent_pattern_constraints(self):
    """Prevent ×× and △× adjacent patterns"""

    for staff in self.staff:
        for i in range(len(self.dates) - 1):
            date1 = self.dates[i]
            date2 = self.dates[i + 1]

            off1 = self.shift_vars[(staff['id'], date1, '×')]
            off2 = self.shift_vars[(staff['id'], date2, '×')]
            early1 = self.shift_vars[(staff['id'], date1, '△')]

            # No consecutive off days (××)
            self.model.Add(off1 + off2 <= 1)

            # No early followed by off (△×)
            self.model.Add(early1 + off2 <= 1)
```

---

## 3. OR-Tools Solver Configuration

### 3.1 Penalty Weights

**Configuration:**
```javascript
ortoolsConfig: {
  preset: 'balanced',  // 'strict', 'balanced', or 'relaxed'
  penaltyWeights: {
    staffGroup: 100,           // Staff group violation penalty
    dailyLimitMin: 50,         // Under minimum daily limit
    dailyLimitMax: 50,         // Over maximum daily limit
    monthlyLimit: 80,          // Monthly limit violation
    adjacentConflict: 30,      // Adjacent pattern violation
    fiveDayRest: 200,          // 5-day rest violation (high priority)
    staffTypeLimitViolation: 150,  // Staff type limit violation
  },
  solverSettings: {
    timeout: 30,               // Solver timeout in seconds
    numWorkers: 4,             // Number of parallel workers
  },
}
```

### 3.2 Presets

**Strict Preset:**
```python
STRICT_WEIGHTS = {
    'staffGroup': 200,
    'dailyLimitMin': 100,
    'dailyLimitMax': 100,
    'monthlyLimit': 150,
    'adjacentConflict': 80,
    'fiveDayRest': 500,
    'staffTypeLimitViolation': 300,
}
```

**Balanced Preset (Default):**
```python
BALANCED_WEIGHTS = {
    'staffGroup': 100,
    'dailyLimitMin': 50,
    'dailyLimitMax': 50,
    'monthlyLimit': 80,
    'adjacentConflict': 30,
    'fiveDayRest': 200,
    'staffTypeLimitViolation': 150,
}
```

**Relaxed Preset:**
```python
RELAXED_WEIGHTS = {
    'staffGroup': 50,
    'dailyLimitMin': 20,
    'dailyLimitMax': 20,
    'monthlyLimit': 40,
    'adjacentConflict': 10,
    'fiveDayRest': 100,
    'staffTypeLimitViolation': 75,
}
```

---

## 4. Python OR-Tools Scheduler

### 4.1 File Structure

```
python-ortools-service/
├── scheduler.py          # Main Flask server and CP-SAT solver
├── requirements.txt      # Dependencies (ortools, flask)
└── test_staff_type_limits.py  # Unit tests
```

### 4.2 Main Scheduler Class

**Location:** `python-ortools-service/scheduler.py`

```python
class ShiftScheduler:
    def __init__(self, staff, dates, constraints_config):
        self.staff = staff
        self.dates = dates
        self.constraints_config = constraints_config
        self.model = cp_model.CpModel()
        self.shift_vars = {}
        self.penalties = []
        self.penalty_weights = self._get_penalty_weights()

    def solve(self, timeout=30):
        # 1. Create variables
        self._create_variables()

        # 2. Add constraints
        self._add_staff_type_daily_limits()  # PRIMARY
        self._add_daily_limits()              # AUTO-DISABLED if staffTypeLimits exists
        self._add_monthly_limits()
        self._add_staff_group_constraints()
        self._add_calendar_rules()
        self._add_five_day_rest_constraint()
        self._add_adjacent_pattern_constraints()
        self._add_early_shift_preferences()

        # 3. Set objective (minimize penalties)
        self.model.Minimize(sum(self.penalties))

        # 4. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = timeout
        solver.parameters.num_workers = 4

        status = solver.Solve(self.model)

        # 5. Extract solution
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return self._extract_solution(solver, status)
        else:
            raise Exception(f"No solution found: {solver.StatusName(status)}")

    def _extract_solution(self, solver, status):
        schedule = {}
        for staff in self.staff:
            schedule[staff['id']] = {}
            for date in self.dates:
                for shift in ['×', '△', '○']:
                    if solver.Value(self.shift_vars[(staff['id'], date, shift)]):
                        schedule[staff['id']][date] = shift
                        break

        return {
            'schedule': schedule,
            'isOptimal': status == cp_model.OPTIMAL,
            'solveTime': solver.WallTime(),
            'status': solver.StatusName(status),
        }
```

### 4.3 Flask API Server

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/generate', methods=['POST'])
def generate_schedule():
    data = request.json

    staff = data['staffMembers']
    dates = data['dateRange']
    constraints = data['constraints']
    timeout = data.get('timeout', 30)

    try:
        scheduler = ShiftScheduler(staff, dates, constraints)
        result = scheduler.solve(timeout)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
```

---

## 5. Go WebSocket Server

### 5.1 Message Types

```go
const (
    MSG_GENERATE_SCHEDULE_ORTOOLS = "GENERATE_SCHEDULE_ORTOOLS"
    MSG_SCHEDULE_GENERATED        = "SCHEDULE_GENERATED"
    MSG_GENERATE_SCHEDULE_ERROR   = "GENERATE_SCHEDULE_ERROR"
)
```

### 5.2 OR-Tools Handler

**Location:** `go-server/main.go` (or `ortools_client.go`)

```go
func handleGenerateScheduleORTools(payload map[string]interface{}, client *Client) {
    // 1. Extract data from payload
    staffMembers := payload["staffMembers"]
    dateRange := payload["dateRange"]
    constraints := payload["constraints"]
    timeout := payload["timeout"]

    // 2. Call Python OR-Tools service
    pythonURL := "http://localhost:5001/generate"
    requestBody := map[string]interface{}{
        "staffMembers": staffMembers,
        "dateRange":    dateRange,
        "constraints":  constraints,
        "timeout":      timeout,
    }

    resp, err := http.Post(pythonURL, "application/json", jsonBody)
    if err != nil {
        sendError(client, "Failed to connect to OR-Tools service")
        return
    }

    // 3. Parse response
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)

    // 4. Send result back to client
    sendMessage(client, MSG_SCHEDULE_GENERATED, result)
}
```

### 5.3 Default Settings

**Location:** `go-server/settings_multitable.go`

```go
func fetchDailyLimits(versionID string) (map[string]interface{}, error) {
    // ... fetch from database ...

    // If not found, return defaults with staffTypeLimits
    return map[string]interface{}{
        // DEPRECATED: Global daily limits
        "minOffPerDay":          0,
        "maxOffPerDay":          3,
        "minEarlyPerDay":        0,
        "maxEarlyPerDay":        2,
        "minWorkingStaffPerDay": 3,
        // PRIMARY: Staff Type Daily Limits
        "staffTypeLimits": map[string]interface{}{
            "社員": map[string]interface{}{
                "maxOff":   1,
                "maxEarly": 2,
                "isHard":   true,
            },
        },
    }, nil
}
```

---

## 6. Constraint Priority System

### 6.1 HARD vs SOFT Constraints

**HARD Constraints (Must be satisfied):**
- Calendar rules (must_day_off, must_work)
- Staff groups (only 1 off per group per day)
- Monthly MAX limit
- Staff type limits with `isHard: true`

**SOFT Constraints (Penalty-based):**
- Monthly MIN limit
- Adjacent pattern prevention
- 5-day rest (enforced via high penalty)
- Staff type limits with `isHard: false`

### 6.2 Constraint Hierarchy

```
TIER 0 (ABSOLUTE - HARD constraints):
  ├─ Calendar must_day_off
  ├─ Calendar must_work
  └─ Staff type limits (isHard: true)

TIER 1 (HIGH PRIORITY - High penalties):
  ├─ 5-Day Rest (penalty: 200)
  ├─ Staff Type Limits violation (penalty: 150)
  └─ Staff Groups (penalty: 100)

TIER 2 (MEDIUM PRIORITY):
  ├─ Monthly Limits (penalty: 80)
  ├─ Daily Limits MIN/MAX (penalty: 50)
  └─ Adjacent Conflicts (penalty: 30)

TIER 3 (PREFERENCES):
  └─ Early Shift Preferences (soft preference)
```

---

## 7. Data Flow Sequence

### 7.1 Complete Generation Flow

```
1. USER clicks "自動生成" button
   ↓
2. ShiftScheduleEditorPhase3 calls generateAIPredictions()
   ↓
3. useAIAssistantLazy:
   a. Connect WebSocket to Go server (ws://localhost:8080)
   b. Load earlyShiftPreferences from Supabase
   c. Load calendarRules from Supabase
   d. Get aiSettings (staffTypeLimits, etc.)
   e. Prepare constraints payload
   ↓
4. Send GENERATE_SCHEDULE_ORTOOLS message to Go server
   {
     staffMembers: [...],
     dateRange: ["2025-12-01", "2025-12-02", ...],
     constraints: {
       staffTypeLimits: { '社員': { maxOff: 1, maxEarly: 2, isHard: true } },
       calendarRules: {...},
       monthlyLimit: { minCount: 7, maxCount: 8 },
       staffGroups: [...],
       ortoolsConfig: { preset: 'balanced' }
     },
     timeout: 30
   }
   ↓
5. GO SERVER receives message:
   a. Parse payload
   b. HTTP POST to Python service (localhost:5001/generate)
   ↓
6. PYTHON OR-TOOLS SERVICE:
   a. Create CP-SAT model
   b. Create shift variables for each (staff, date, shift_type)
   c. Add constraints:
      - Staff type daily limits (PRIMARY)
      - Monthly limits
      - Staff groups
      - Calendar rules
      - 5-day rest
      - Adjacent patterns
   d. Set objective: Minimize sum of penalties
   e. Solve with timeout
   f. Extract schedule from solution
   g. Return JSON result
   ↓
7. GO SERVER:
   a. Receive Python response
   b. Send SCHEDULE_GENERATED message to client
   ↓
8. useAIAssistantLazy:
   a. Receive WebSocket message
   b. Save schedule to backend via saveSchedule()
   c. Save to localStorage as backup
   d. Return result with isOptimal, solveTime, stats
   ↓
9. UI updates with generated schedule
```

### 7.2 Message Flow Diagram

```
┌──────────────┐     WebSocket      ┌──────────────┐      HTTP       ┌──────────────┐
│   React App  │ ←─────────────────→│  Go Server   │ ←──────────────→│ Python OR-   │
│              │                    │   :8080      │                 │ Tools :5001  │
└──────────────┘                    └──────────────┘                 └──────────────┘
       │                                   │                               │
       │ GENERATE_SCHEDULE_ORTOOLS         │                               │
       │──────────────────────────────────→│                               │
       │                                   │  POST /generate               │
       │                                   │──────────────────────────────→│
       │                                   │                               │
       │                                   │                    [CP-SAT Solve]
       │                                   │                               │
       │                                   │  JSON Response                │
       │                                   │←──────────────────────────────│
       │ SCHEDULE_GENERATED                │                               │
       │←──────────────────────────────────│                               │
       │                                   │                               │
```

---

## 8. Response Format

### 8.1 Successful Generation

```javascript
{
  success: true,
  schedule: {
    "staff-uuid-1": {
      "2025-12-01": "○",
      "2025-12-02": "×",
      "2025-12-03": "△",
      // ...
    },
    "staff-uuid-2": {
      // ...
    }
  },
  isOptimal: true,        // true = optimal solution, false = feasible solution
  solveTime: 2.45,        // Solve time in seconds
  status: "OPTIMAL",      // "OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN"
  stats: {
    totalOffDays: 72,
    averageOffPerStaff: 7.2,
    constraintsSatisfied: 156,
    constraintsViolated: 0,
    penaltyScore: 0
  }
}
```

### 8.2 Error Response

```javascript
{
  success: false,
  error: "No feasible solution found within timeout",
  status: "INFEASIBLE"
}
```

---

## 9. UI Integration

### 9.1 Settings UI (LimitsTab.jsx)

**Location:** `src/components/settings/tabs/LimitsTab.jsx`

The UI displays only the Staff Type Daily Limits section (global daily limits UI removed):

```jsx
// Staff Type Daily Limits Section - PRIMARY constraint method
<StaffTypeLimitsSection
  staffTypeLimits={staffTypeLimits}
  onUpdate={handleUpdateStaffTypeLimits}
/>

// NOTE: Global Daily Limits (DailyLimitsSection) has been DEPRECATED
// in favor of per-staff-type limits for more granular control
```

### 9.2 Progress Callbacks

```javascript
const result = await generateAIPredictions((progress) => {
  // progress object:
  // { stage: 'initializing', progress: 10, message: 'AIシステム初期化中...' }
  // { stage: 'loading_preferences', progress: 20, message: '設定を読み込み中...' }
  // { stage: 'optimizing', progress: 30, message: 'OR-Toolsで最適化中...' }
  // { stage: 'saving', progress: 90, message: 'スケジュール保存中...' }
  // { stage: 'completed', progress: 100, message: '最適化完了 (最適解)' }

  updateProgressUI(progress);
});
```

---

## 10. Testing

### 10.1 Python Unit Tests

**Location:** `python-ortools-service/test_staff_type_limits.py`

```python
class TestStaffTypeDailyLimits:
    def test_staff_type_off_limits_hard(self):
        """Test HARD constraint for staff type off limits"""
        staff = [
            {'id': 'emp1', 'name': '社員1', 'status': '社員'},
            {'id': 'emp2', 'name': '社員2', 'status': '社員'},
        ]
        dates = ['2025-12-01', '2025-12-02']
        constraints = {
            'staffTypeLimits': {
                '社員': {'maxOff': 1, 'isHard': True}
            }
        }

        scheduler = ShiftScheduler(staff, dates, constraints)
        result = scheduler.solve()

        # Verify: At most 1 社員 off per day
        for date in dates:
            off_count = sum(1 for s in staff if result['schedule'][s['id']][date] == '×')
            assert off_count <= 1, f"More than 1 社員 off on {date}"
```

### 10.2 Running Tests

```bash
cd python-ortools-service
python -m pytest test_staff_type_limits.py -v
```

---

## 11. Troubleshooting

### 11.1 No Solution Found

**Symptoms:** Error "No feasible solution found"

**Possible Causes:**
1. Too many HARD constraints conflicting
2. Not enough staff for coverage requirements
3. Calendar rules creating impossible scenarios

**Solutions:**
1. Change some constraints from `isHard: true` to `isHard: false`
2. Reduce constraint strictness
3. Increase solver timeout
4. Check for conflicting calendar rules

### 11.2 Slow Solve Times

**Symptoms:** Solve time > 30 seconds

**Solutions:**
1. Reduce number of staff members
2. Shorten date range
3. Simplify constraints
4. Use 'relaxed' preset
5. Increase `numWorkers` in solver settings

### 11.3 staffTypeLimits Not Applied

**Symptoms:** Global daily limits being used instead

**Debug Steps:**
1. Check if `staffTypeLimits` is in constraints payload
2. Verify Python logs show "Daily limits AUTO-DISABLED"
3. Check staff `status` field matches staffTypeLimits keys

**Console Debug:**
```javascript
// In useAIAssistantLazy.js
console.log("[OR-TOOLS] Using staffTypeLimits:", JSON.stringify(constraints.staffTypeLimits, null, 2));
```

### 11.4 WebSocket Connection Failed

**Symptoms:** "WebSocket connection failed" error

**Solutions:**
1. Ensure Go server is running: `cd go-server && ./start.sh`
2. Check port 8080 is not in use: `lsof -i :8080`
3. Verify `REACT_APP_WEBSOCKET_URL` environment variable

### 11.5 Python Service Not Responding

**Symptoms:** Go server timeout waiting for Python response

**Solutions:**
1. Ensure Python service is running: `cd python-ortools-service && python3 scheduler.py`
2. Check port 5001 is not in use: `lsof -i :5001`
3. Check Python logs for errors

---

## 12. Migration from Old System

### 12.1 Deprecated Components

The following components are no longer used:

```
DEPRECATED:
├── src/ai/hybrid/BusinessRuleValidator.js
├── src/ai/hybrid/HybridPredictor.js
├── src/ai/ml/TensorFlowScheduler.js
├── src/ai/enhanced/*.js
└── Global dailyLimitsRaw (auto-disabled)
```

### 12.2 Migration Checklist

- [x] Replace BusinessRuleValidator with Python OR-Tools
- [x] Update useAIAssistantLazy.js to use WebSocket
- [x] Add staffTypeLimits as primary constraint
- [x] Remove global daily limits UI from LimitsTab.jsx
- [x] Update Go server with OR-Tools handler
- [x] Update defaults to include staffTypeLimits
- [x] Add AUTO-DISABLE logic for global daily limits
- [x] Update documentation

---

## 13. Best Practices

### 13.1 Constraint Configuration

1. **Use staffTypeLimits for fine-grained control**
   - Configure limits per staff type (社員, 派遣, パート)
   - Use `isHard: true` for critical constraints

2. **Set appropriate penalty weights**
   - Higher weights = stricter enforcement
   - Use presets as starting point

3. **Balance HARD vs SOFT constraints**
   - Too many HARD constraints → no solution
   - Too many SOFT constraints → poor quality

### 13.2 Performance Optimization

1. **Solver timeout**
   - Default: 30 seconds
   - Increase for complex scenarios

2. **Number of workers**
   - Default: 4
   - Match to available CPU cores

3. **Constraint complexity**
   - Simpler constraints = faster solving
   - Remove unnecessary constraints

### 13.3 Testing

1. **Always test constraint changes**
2. **Verify solution quality metrics**
3. **Check for constraint violations in stats**
4. **Test edge cases (empty staff, single day, etc.)**

---

## 14. Visual Flow Diagrams

### 14.1 Complete System Architecture

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                           SHIFT SCHEDULE GENERATION SYSTEM                        ║
║                              (OR-Tools Architecture)                              ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │                              USER INTERFACE                                  │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │  ShiftScheduleEditorPhase3.jsx                                      │   │ ║
║  │  │  ├── 📅 Schedule Table (日付 × スタッフ)                            │   │ ║
║  │  │  ├── ⚙️  Settings (staffTypeLimits, monthlyLimit, etc.)             │   │ ║
║  │  │  └── 🤖 [自動生成] Button → triggers AI generation                  │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                        │                                          ║
║                                        ▼                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │                           REACT HOOK LAYER                                   │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │  useAIAssistantLazy.js                                              │   │ ║
║  │  │  ├── 🔌 WebSocket Connection (ws://localhost:8080)                  │   │ ║
║  │  │  ├── 📥 Load: earlyShiftPreferences, calendarRules                  │   │ ║
║  │  │  ├── 📦 Prepare: constraints payload with staffTypeLimits           │   │ ║
║  │  │  └── 📤 Send: GENERATE_SCHEDULE_ORTOOLS message                     │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                        │                                          ║
║                           WebSocket Message                                       ║
║                        GENERATE_SCHEDULE_ORTOOLS                                  ║
║                                        ▼                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │                         GO WEBSOCKET SERVER (:8080)                          │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │  go-server/main.go + ortools_client.go                              │   │ ║
║  │  │  ├── 📨 Receive WebSocket message                                   │   │ ║
║  │  │  ├── 🔄 Route to OR-Tools handler                                   │   │ ║
║  │  │  ├── 🌐 HTTP POST to Python service                                 │   │ ║
║  │  │  └── 📤 Broadcast result to client                                  │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                        │                                          ║
║                              HTTP POST /generate                                  ║
║                                        ▼                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │                      PYTHON OR-TOOLS SERVICE (:5001)                         │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │  python-ortools-service/scheduler.py                                │   │ ║
║  │  │                                                                     │   │ ║
║  │  │  ┌───────────────────────────────────────────────────────────────┐ │   │ ║
║  │  │  │                    CP-SAT MODEL BUILDER                        │ │   │ ║
║  │  │  │  ┌─────────────────────────────────────────────────────────┐  │ │   │ ║
║  │  │  │  │ Variables: shift_vars[(staff_id, date, shift_type)]     │  │ │   │ ║
║  │  │  │  │ shift_type ∈ {×, △, ○}                                   │  │ │   │ ║
║  │  │  │  └─────────────────────────────────────────────────────────┘  │ │   │ ║
║  │  │  │                           │                                    │ │   │ ║
║  │  │  │                           ▼                                    │ │   │ ║
║  │  │  │  ┌─────────────────────────────────────────────────────────┐  │ │   │ ║
║  │  │  │  │              CONSTRAINT DEFINITIONS                      │  │ │   │ ║
║  │  │  │  │  ┌─────────────────────────────────────────────────┐    │  │ │   │ ║
║  │  │  │  │  │ HARD CONSTRAINTS (must satisfy)                  │    │  │ │   │ ║
║  │  │  │  │  │  • Calendar Rules (must_day_off, must_work)     │    │  │ │   │ ║
║  │  │  │  │  │  • Staff Groups (≤1 off per group per day)      │    │  │ │   │ ║
║  │  │  │  │  │  • Monthly MAX (≤8 off days per staff)          │    │  │ │   │ ║
║  │  │  │  │  │  • staffTypeLimits (isHard: true)               │    │  │ │   │ ║
║  │  │  │  │  └─────────────────────────────────────────────────┘    │  │ │   │ ║
║  │  │  │  │  ┌─────────────────────────────────────────────────┐    │  │ │   │ ║
║  │  │  │  │  │ SOFT CONSTRAINTS (penalty-based)                 │    │  │ │   │ ║
║  │  │  │  │  │  • 5-Day Rest (penalty: 200)                    │    │  │ │   │ ║
║  │  │  │  │  │  • staffTypeLimits (isHard: false, penalty:150) │    │  │ │   │ ║
║  │  │  │  │  │  • Staff Groups (penalty: 100)                  │    │  │ │   │ ║
║  │  │  │  │  │  • Monthly MIN (penalty: 80)                    │    │  │ │   │ ║
║  │  │  │  │  │  • Adjacent Patterns (penalty: 30)              │    │  │ │   │ ║
║  │  │  │  │  └─────────────────────────────────────────────────┘    │  │ │   │ ║
║  │  │  │  └─────────────────────────────────────────────────────────┘  │ │   │ ║
║  │  │  │                           │                                    │ │   │ ║
║  │  │  │                           ▼                                    │ │   │ ║
║  │  │  │  ┌─────────────────────────────────────────────────────────┐  │ │   │ ║
║  │  │  │  │                  OBJECTIVE FUNCTION                      │  │ │   │ ║
║  │  │  │  │         Minimize: Σ(penalty_weights × violations)        │  │ │   │ ║
║  │  │  │  └─────────────────────────────────────────────────────────┘  │ │   │ ║
║  │  │  │                           │                                    │ │   │ ║
║  │  │  │                           ▼                                    │ │   │ ║
║  │  │  │  ┌─────────────────────────────────────────────────────────┐  │ │   │ ║
║  │  │  │  │                     CP-SAT SOLVER                        │  │ │   │ ║
║  │  │  │  │  • Timeout: 30s    • Workers: 4 parallel threads         │  │ │   │ ║
║  │  │  │  │  • Status: OPTIMAL / FEASIBLE / INFEASIBLE               │  │ │   │ ║
║  │  │  │  └─────────────────────────────────────────────────────────┘  │ │   │ ║
║  │  │  └───────────────────────────────────────────────────────────────┘ │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                        │                                          ║
║                             JSON Response                                         ║
║                      { schedule, isOptimal, solveTime }                           ║
║                                        ▼                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │                              DATA LAYER                                      │ ║
║  │  ┌─────────────────────────────────────────────────────────────────────┐   │ ║
║  │  │  Supabase PostgreSQL                                                │   │ ║
║  │  │  ├── 👥 staff_members (id, name, status: 社員/派遣/パート)          │   │ ║
║  │  │  ├── 📅 schedules (schedule_data JSONB)                             │   │ ║
║  │  │  ├── 📋 calendar_rules (must_day_off, must_work)                    │   │ ║
║  │  │  ├── 👨‍👩‍👧‍👦 staff_groups (members[], constraints)                       │   │ ║
║  │  │  └── ⚙️  limit_config (staffTypeLimits, monthlyLimit, etc.)         │   │ ║
║  │  └─────────────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                   ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### 14.2 Generation Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        SCHEDULE GENERATION PIPELINE                               │
└──────────────────────────────────────────────────────────────────────────────────┘

User clicks [自動生成]
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 1: INITIALIZATION                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • Connect WebSocket to Go server                         │  │
│  │ • Verify connection (CONNECTION_ACK)                     │  │
│  │ • Set processing state = true                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 10% | Message: "AIシステム初期化中..."              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 2: LOAD CONFIGURATION                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • EarlyShiftPreferencesLoader.loadPreferences()          │  │
│  │ • CalendarRulesLoader.loadRules()                        │  │
│  │ • Get aiSettings (staffTypeLimits, monthlyLimit, etc.)   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 20% | Message: "設定を読み込み中..."                │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 3: PREPARE CONSTRAINTS PAYLOAD                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ constraints = {                                          │  │
│  │   staffTypeLimits: { '社員': {maxOff:1, isHard:true} },  │  │
│  │   calendarRules: {...},                                  │  │
│  │   monthlyLimit: { minCount:7, maxCount:8 },              │  │
│  │   staffGroups: [...],                                    │  │
│  │   ortoolsConfig: { preset:'balanced' }                   │  │
│  │ }                                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 25% | Message: "制約条件を準備中..."                │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 4: SEND TO GO SERVER                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ WebSocket.send({                                         │  │
│  │   type: "GENERATE_SCHEDULE_ORTOOLS",                     │  │
│  │   payload: { staffMembers, dateRange, constraints }      │  │
│  │ })                                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 30% | Message: "OR-Toolsで最適化中..."              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 5: GO SERVER ROUTING                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • Receive WebSocket message                              │  │
│  │ • Parse payload                                          │  │
│  │ • HTTP POST to Python service (localhost:5001/generate)  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 6: PYTHON OR-TOOLS OPTIMIZATION                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 6a. Create CP-SAT Model                                  │  │
│  │     • Variables: shift_vars[(staff, date, shift)]        │  │
│  │     • For each staff × date: exactly 1 shift assigned    │  │
│  │                                                          │  │
│  │ 6b. Add HARD Constraints                                 │  │
│  │     • Calendar rules (must_day_off → work_var = 0)       │  │
│  │     • Staff groups (sum(off_vars) ≤ 1)                   │  │
│  │     • staffTypeLimits with isHard=true                   │  │
│  │                                                          │  │
│  │ 6c. Add SOFT Constraints (with penalties)                │  │
│  │     • 5-day rest violations × 200                        │  │
│  │     • staffTypeLimits violations × 150                   │  │
│  │     • Monthly limit violations × 80                      │  │
│  │                                                          │  │
│  │ 6d. Set Objective                                        │  │
│  │     • Minimize(sum(penalties))                           │  │
│  │                                                          │  │
│  │ 6e. Solve                                                │  │
│  │     • solver.parameters.max_time_in_seconds = 30         │  │
│  │     • solver.parameters.num_workers = 4                  │  │
│  │     • Status: OPTIMAL / FEASIBLE / INFEASIBLE            │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 30-80% | Message: "OR-Toolsで最適化中..."           │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 7: EXTRACT SOLUTION                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ schedule = {}                                            │  │
│  │ for staff in staffMembers:                               │  │
│  │   for date in dateRange:                                 │  │
│  │     for shift in ['×', '△', '○']:                        │  │
│  │       if solver.Value(shift_vars[(staff, date, shift)]): │  │
│  │         schedule[staff][date] = shift                    │  │
│  │                                                          │  │
│  │ return {                                                 │  │
│  │   schedule, isOptimal, solveTime, status, stats          │  │
│  │ }                                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 85% | Message: "解を抽出中..."                      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 8: SAVE SCHEDULE                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • saveSchedule(result.schedule) → WebSocket → Supabase   │  │
│  │ • optimizedStorage.saveScheduleData() → localStorage     │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 90% | Message: "スケジュール保存中..."              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 9: COMPLETE                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • Return result to UI                                    │  │
│  │ • Update schedule table display                          │  │
│  │ • Show success message with solve stats                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Progress: 100% | Message: "最適化完了 (最適解)"               │
└───────────────────────────────────────────────────────────────┘
```

### 14.3 Constraint Priority Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                           CONSTRAINT PRIORITY HIERARCHY                           ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  TIER 0: ABSOLUTE (HARD - Must be satisfied or NO SOLUTION)                       ║
║  ════════════════════════════════════════════════════════════════════════════    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  🔴 Calendar must_day_off                                                 │   ║
║  │     └── All staff: × (off) or △ (early) on specified dates               │   ║
║  │  🔴 Calendar must_work                                                    │   ║
║  │     └── All staff: must work (no × allowed) on specified dates           │   ║
║  │  🔴 staffTypeLimits (isHard: true)                                        │   ║
║  │     └── e.g., 社員: maxOff=1 → At most 1 社員 off per day                 │   ║
║  │  🔴 Monthly MAX limit                                                     │   ║
║  │     └── Staff cannot exceed maxCount off days per month                  │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                      ▲                                           ║
║                                      │ Cannot override                           ║
║                                      │                                           ║
║  TIER 1: HIGH PRIORITY (SOFT - High penalty weight)                              ║
║  ════════════════════════════════════════════════════════════════════════════    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  🟠 5-Day Rest Constraint              (penalty: 200)                     │   ║
║  │     └── At least 1 rest day (× or △) in any 6-day window                 │   ║
║  │  🟠 staffTypeLimits (isHard: false)    (penalty: 150)                     │   ║
║  │     └── Soft enforcement of staff type daily limits                      │   ║
║  │  🟠 Staff Group Constraints            (penalty: 100)                     │   ║
║  │     └── Only 1 member off per group per day                              │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                      ▲                                           ║
║                                      │ Higher penalty                            ║
║                                      │                                           ║
║  TIER 2: MEDIUM PRIORITY (SOFT - Medium penalty weight)                          ║
║  ════════════════════════════════════════════════════════════════════════════    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  🟡 Monthly MIN limit                  (penalty: 80)                      │   ║
║  │     └── Staff should have at least minCount off days                     │   ║
║  │  🟡 Daily Limits MIN/MAX               (penalty: 50)                      │   ║
║  │     └── (DEPRECATED when staffTypeLimits configured)                     │   ║
║  │  🟡 Adjacent Pattern Prevention        (penalty: 30)                      │   ║
║  │     └── Avoid ×× (consecutive off) and △× (early→off)                    │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                      ▲                                           ║
║                                      │ Lower penalty                             ║
║                                      │                                           ║
║  TIER 3: PREFERENCES (SOFT - Low penalty or preference-based)                    ║
║  ════════════════════════════════════════════════════════════════════════════    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  🟢 Early Shift Preferences            (soft preference)                  │   ║
║  │     └── Staff can work △ on must_day_off dates if eligible               │   ║
║  │  🟢 Distribution Balance               (implicit)                         │   ║
║  │     └── Even distribution of off days across staff                       │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                   ║
╚══════════════════════════════════════════════════════════════════════════════════╝

LEGEND:
  🔴 HARD Constraint  - Violation = NO SOLUTION (solver fails)
  🟠 HIGH Penalty     - Violation heavily penalized, avoided if possible
  🟡 MEDIUM Penalty   - Violation penalized, balanced with other constraints
  🟢 LOW/Preference   - Soft preference, may be sacrificed for higher priorities
```

### 14.4 staffTypeLimits Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        staffTypeLimits DATA FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│  SETTINGS UI            │
│  (LimitsTab.jsx)        │
│  ┌───────────────────┐  │
│  │ Staff Type Limits │  │
│  │ ┌───────────────┐ │  │
│  │ │ 社員          │ │  │
│  │ │ maxOff: [1]   │ │  │
│  │ │ maxEarly: [2] │ │  │
│  │ │ [✓] isHard    │ │  │
│  │ └───────────────┘ │  │
│  │ ┌───────────────┐ │  │
│  │ │ 派遣          │ │  │
│  │ │ maxOff: [2]   │ │  │
│  │ │ maxEarly: [1] │ │  │
│  │ │ [ ] isHard    │ │  │
│  │ └───────────────┘ │  │
│  └───────────────────┘  │
└─────────────────────────┘
           │
           │ onUpdate()
           ▼
┌─────────────────────────┐
│  useSettingsData.js     │
│  WebSocket: UPDATE_STAFF│
│  _TYPE_LIMITS           │
└─────────────────────────┘
           │
           │ WebSocket
           ▼
┌─────────────────────────┐
│  GO SERVER              │
│  settings_multitable.go │
│  updateStaffTypeLimits()│
└─────────────────────────┘
           │
           │ SQL UPDATE
           ▼
┌─────────────────────────┐
│  SUPABASE               │
│  limit_config table     │
│  ┌───────────────────┐  │
│  │ limit_config:     │  │
│  │ {                 │  │
│  │  "staffTypeLimits"│  │
│  │  : {              │  │
│  │    "社員": {      │  │
│  │      maxOff: 1,   │  │
│  │      maxEarly: 2, │  │
│  │      isHard: true │  │
│  │    }              │  │
│  │  }                │  │
│  │ }                 │  │
│  └───────────────────┘  │
└─────────────────────────┘
           │
           │ On AI Generation
           ▼
┌─────────────────────────┐
│  useAIAssistantLazy.js  │
│  Load from aiSettings   │
│  constraints = {        │
│    staffTypeLimits:     │
│      aiSettings?.       │
│      staffTypeLimits    │
│  }                      │
└─────────────────────────┘
           │
           │ WebSocket
           ▼
┌─────────────────────────┐
│  GO SERVER              │
│  ortools_client.go      │
│  Forward to Python      │
└─────────────────────────┘
           │
           │ HTTP POST
           ▼
┌─────────────────────────┐
│  PYTHON SCHEDULER       │
│  scheduler.py           │
│  ┌───────────────────┐  │
│  │ _add_staff_type_  │  │
│  │ daily_limits()    │  │
│  │                   │  │
│  │ for type, limits: │  │
│  │   if isHard:      │  │
│  │     model.Add(    │  │
│  │       sum(off) <= │  │
│  │       maxOff)     │  │
│  │   else:           │  │
│  │     penalty +=    │  │
│  │       excess×150  │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ AUTO-DISABLE      │  │
│  │ Global daily      │  │
│  │ limits when       │  │
│  │ staffTypeLimits   │  │
│  │ is configured     │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### 14.5 Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           ERROR HANDLING FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────────┘

                              NORMAL FLOW
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ WebSocket Connection    │
                    └─────────────────────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
        ❌ FAILED            ✅ SUCCESS          ⏱️ TIMEOUT
             │                    │                    │
             ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ Error:          │  │ Continue to     │  │ Error:          │
    │ "WebSocket      │  │ OR-Tools        │  │ "Connection     │
    │ connection      │  │ Generation      │  │ timeout (10s)"  │
    │ failed"         │  │                 │  │                 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
             │                    │                    │
             └───────────────┐    │    ┌───────────────┘
                             ▼    ▼    ▼
                    ┌─────────────────────────┐
                    │ Python OR-Tools Solve   │
                    └─────────────────────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
        ❌ INFEASIBLE       ✅ OPTIMAL/         ⏱️ TIMEOUT
             │               FEASIBLE                  │
             ▼                    │                    ▼
    ┌─────────────────┐          │           ┌─────────────────┐
    │ Error:          │          │           │ Error:          │
    │ "No feasible    │          │           │ "Schedule       │
    │ solution -      │          │           │ generation      │
    │ constraints     │          │           │ timed out       │
    │ too strict"     │          │           │ (60s)"          │
    └─────────────────┘          │           └─────────────────┘
             │                   │                    │
             ▼                   ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ SUGGESTIONS:    │  │ SUCCESS!        │  │ SUGGESTIONS:    │
    │ • Relax isHard  │  │ • Save schedule │  │ • Reduce staff  │
    │ • Remove some   │  │ • Show stats    │  │ • Shorten range │
    │   constraints   │  │ • Update UI     │  │ • Use 'relaxed' │
    │ • Check calendar│  │                 │  │   preset        │
    │   rule conflicts│  │                 │  │ • Increase      │
    └─────────────────┘  └─────────────────┘  │   timeout       │
                                              └─────────────────┘
```

---

## 15. Conclusion

The OR-Tools migration provides:

1. **Mathematical Optimization** - Guaranteed optimal/feasible solutions
2. **Per-Staff-Type Control** - Fine-grained constraint configuration
3. **Real-time Communication** - WebSocket-based updates
4. **Transparent Results** - Solution quality metrics and stats

Key principles:
- **staffTypeLimits is PRIMARY** - Global daily limits auto-disabled
- **HARD constraints must be satisfiable** - Or no solution found
- **Penalty weights control trade-offs** - Balance competing constraints
- **Calendar rules are absolute** - Always enforced as HARD constraints

By following this architecture, the system reliably generates schedules that satisfy all business requirements while respecting staff preferences and operational constraints.
