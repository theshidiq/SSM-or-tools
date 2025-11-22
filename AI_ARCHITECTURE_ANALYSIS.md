# AI Schedule Generation Architecture Analysis

## Executive Summary

The shift-schedule-manager application features a sophisticated **hybrid AI architecture** combining constraint satisfaction, genetic algorithms, and pattern recognition. The system currently lacks direct integration of early shift preferences into the schedule generation process, which presents an opportunity for enhancement.

---

## 1. MAIN AI GENERATION ENTRY POINTS

### Primary Location
**File**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/core/ScheduleGenerator.js`

### Core Method
```javascript
async generateSchedule(params = {})  // Line 329
```

**Parameters**:
- `staffMembers`: Array of staff objects
- `dateRange`: Date array for schedule period
- `mlConfig`: ML algorithm configuration
- `constraints`: Constraint settings
- `restaurantId`: Restaurant context

**Returns**: Schedule object mapping staff IDs to date-based shift assignments

### Entry Flow
```
User Action (UI)
    ↓
generateSchedule() [ScheduleGenerator.js:329]
    ↓
    ├─ Load configurations (staff, constraints, calendar rules)
    ├─ Validate input parameters
    ├─ Choose algorithm (Genetic/Simulated Annealing/Ensemble)
    ├─ Execute algorithm with fitness evaluation
    ├─ Validate output schedule
    └─ Return optimized schedule
```

---

## 2. CALENDAR RULES INTEGRATION

### Current Implementation
**File**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useCalendarRules.js`

**Data Structure**:
```javascript
{
  "2025-01-01": "must_work",      // ALL staff must work
  "2025-01-15": "must_day_off"    // ALL staff must have day off
  // null = normal scheduling
}
```

**Database Table**: `calendar_rules`
- `restaurant_id`: UUID
- `date`: String (YYYY-MM-DD)
- `rule_type`: "must_work" | "must_day_off"
- `reason`: String
- `updated_at`: Timestamp

### Hook Functions
```javascript
// Load rules for date range
useCalendarRules(restaurantId, startDate, endDate)
  → returns { rules, isLoading, error, toggleRule, getRuleForDate, hasRule }

// Check rule for specific date
getRuleForDate(date) → "must_work" | "must_day_off" | null

// Toggle rule state
toggleRule(date) → Promise (cycles: null → must_work → must_day_off → null)
```

### Real-time Sync
- Supabase real-time subscriptions on `postgres_changes` events
- Auto-updates local state on INSERT/UPDATE/DELETE
- Cleanup on component unmount

### Current Usage in ScheduleGenerator
**Status**: ❌ **NOT CURRENTLY INTEGRATED**
- Calendar rules are loaded but not enforced in schedule generation
- Rules exist in database but don't constrain shift assignments
- No validation that generated schedules respect must_work/must_day_off

---

## 3. EARLY SHIFT PREFERENCES INTEGRATION

### Current Implementation
**File**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useEarlyShiftPreferences.js`

**Data Structure**:
```javascript
{
  staffId: {
    "2025-01-15": true,   // Can work early on this specific date
    "default": false      // Default: cannot work early
  }
}
```

**Database Table**: `staff_early_shift_preferences`
- `restaurant_id`: UUID
- `staff_id`: UUID
- `can_do_early_shift`: Boolean
- `applies_to_date`: String (YYYY-MM-DD) or NULL
- `preference_source`: "individual" | "bulk_assignment" | other
- `updated_at`: Timestamp

### Hook Functions
```javascript
useEarlyShiftPreferences(restaurantId)
  → returns {
      preferences,
      isLoading,
      error,
      savePreference(staffId, canDoEarlyShift, appliesToDate, preferenceSource),
      bulkSavePreferences(staffPreferences, appliesToDate, preferenceSource),
      getPreferenceForStaff(staffId, appliesToDate),
      canDoEarlyShift(staffId, appliesToDate)
    }
```

### Real-time Sync
- Supabase real-time subscriptions
- INSERT/UPDATE/DELETE handlers
- Nested preference structure updates

### Current Usage in ScheduleGenerator
**Status**: ⚠️ **PARTIALLY INTEGRATED**
- Early shift eligibility check exists: `isEligibleForEarlyShift(staff)` (Line 144)
  - Only 社員 (full-time employees) can work early shifts △
- User preferences are **NOT** read during generation
- No constraint validation against early shift preferences

---

## 4. STAFF ASSIGNMENT LOGIC

### Shift Types (Japanese)
```javascript
△  = Early shift   (sankaku)   - restricted to 社員 staff
○  = Normal shift  (maru)      - can be assigned to part-time
◇  = Late shift    (diamond)   - can be assigned
×  = Day off       (batsu)     - not working
```

### Assignment Flow (ScheduleGenerator.js)

#### Phase 1: Priority-Based Assignment
```
1. Load priority rules (staff preferences for specific shifts/days)
2. Assign high-priority requests first
3. Validate against conflict groups
4. Track assignment progress
```

#### Phase 2: Algorithm Execution
**Genetic Algorithm Path** (most common):
```
1. Initialize population (random schedules)
2. For each generation:
   a. Evaluate fitness (constraint satisfaction)
   b. Select fittest individuals
   c. Apply crossover (combine solutions)
   d. Apply mutation (random changes)
3. Return best solution
```

**Key Fitness Components** (ConstraintIntegrationLayer.js):
- Hard constraints (must satisfy): 50% weight
- Soft constraints (prefer to satisfy): 30% weight
- Objectives: 15% weight
- Penalties: 5% weight

#### Phase 3: Constraint Validation
**ConstraintEngine.js** validates:
- Staff group conflicts (cannot all be off same day)
- Daily limits (max shifts per day per shift type)
- Monthly limits (fairness balance)
- Priority rules (staff preferences)
- Weekly limits (7-day rolling window)

### Current Gap: Early Shift Preferences NOT Checked
In algorithm execution, shifts are assigned without:
- Reading `staff_early_shift_preferences` table
- Verifying staff can work △ shifts
- Penalizing invalid early shift assignments

---

## 5. DATA FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                       │
├──────────────────────────────────────────────────────────────┤
│  ShiftScheduleEditorPhase3.jsx                               │
│  ├─ ScheduleTable (shift editing)                            │
│  ├─ NavigationToolbar (generate button)                      │
│  └─ StatisticsDashboard (analytics)                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    CONFIGURATION LAYER                        │
├──────────────────────────────────────────────────────────────┤
│ Load Settings (Real-time):                                    │
│ ├─ useCalendarRules(restaurantId)          [calendar_rules]  │
│ ├─ useEarlyShiftPreferences(restaurantId)  [staff_early_..] │
│ ├─ usePriorityRulesData(restaurantId)      [priority_rules]  │
│ ├─ useStaffGroupsData(restaurantId)        [staff_groups]    │
│ └─ ... (other configurations)                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│               SCHEDULE GENERATION ENGINE                      │
├──────────────────────────────────────────────────────────────┤
│ ScheduleGenerator.generateSchedule(params)                   │
│   ├─ Input Processing:                                       │
│   │  ├─ staffMembers (with status: 社員/パート)             │
│   │  ├─ dateRange [2025-01-01 ... 2025-02-28]              │
│   │  ├─ mlConfig (algorithm selection)                      │
│   │  └─ constraints (configuration bundle)                  │
│   │                                                           │
│   ├─ Configuration Loading:                                 │
│   │  ├─ staffGroups (conflict rules)        ✅ LOADED       │
│   │  ├─ priorityRules (staff preferences)   ✅ LOADED       │
│   │  ├─ dailyLimits (max shifts/day)        ✅ LOADED       │
│   │  ├─ monthlyLimits (fairness)            ✅ LOADED       │
│   │  ├─ calendar_rules (must_work/off)      ✅ LOADED       │
│   │  └─ early_shift_preferences             ⚠️  LOADED but   │
│   │                                             NOT USED      │
│   │                                                           │
│   ├─ Algorithm Selection:                                    │
│   │  ├─ if ensemble → run multiple algorithms               │
│   │  ├─ if genetic → GeneticAlgorithm.run()                │
│   │  └─ if annealing → SimulatedAnnealing.run()            │
│   │                                                           │
│   ├─ Constraint Enforcement:                                │
│   │  ├─ Hard constraints (violations penalized heavily)    │
│   │  │  ├─ staff group conflicts                           │
│   │  │  ├─ daily limits                                    │
│   │  │  └─ priority rules                                  │
│   │  │                                                       │
│   │  ├─ Soft constraints (violations penalized lightly)    │
│   │  │  ├─ fairness objectives                             │
│   │  │  └─ preference satisfaction                         │
│   │  │                                                       │
│   │  └─ NOT ENFORCED:                     ❌                 │
│   │     ├─ calendar_rules violations                        │
│   │     └─ early_shift_preferences violations              │
│   │                                                           │
│   ├─ Solution Evaluation:                                    │
│   │  └─ Fitness = constraint_score +                        │
│   │              fairness_score +                           │
│   │              preference_satisfaction                    │
│   │                                                           │
│   └─ Output: schedule { [staffId]: { [dateKey]: shift } }  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│               CONSTRAINT VALIDATION LAYER                     │
├──────────────────────────────────────────────────────────────┤
│ ConstraintEngine.validateAllConstraints()                    │
│   ├─ Validates schedule against all rules                   │
│   ├─ Returns: { valid, violations, summary }                │
│   └─ Flags: hard violations vs soft violations              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE                           │
├──────────────────────────────────────────────────────────────┤
│ Supabase PostgreSQL                                          │
│ ├─ calendar_rules (must_work/must_day_off)                 │
│ ├─ staff_early_shift_preferences (early △ permissions)     │
│ ├─ priority_rules (shift preferences)                       │
│ ├─ staff_groups (conflict groups)                           │
│ ├─ shift_schedules (generated output)                       │
│ └─ (other tables)                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. KEY FILES AND FUNCTIONS

### Schedule Generation Core
| File | Function | Responsibility |
|------|----------|-----------------|
| `ScheduleGenerator.js` | `generateSchedule()` | Main entry point |
| `ScheduleGenerator.js` | `generateWithSingleAlgorithm()` | Single algorithm wrapper |
| `ScheduleGenerator.js` | `runEnsembleAlgorithms()` | Multi-algorithm ensemble |
| `GeneticAlgorithm.js` | `run()` | GA implementation |
| `SimulatedAnnealing.js` | `run()` | SA implementation |
| `EnsembleScheduler.js` | `combine()` | Result aggregation |

### Constraint Processing
| File | Function | Responsibility |
|------|----------|-----------------|
| `ConstraintIntegrationLayer.js` | `processSmartConstraints()` | Auto-detect priorities |
| `ConstraintIntegrationLayer.js` | `processConstraints()` | Convert UI constraints to ML format |
| `ConstraintIntegrationLayer.js` | `validateSolution()` | Verify solution validity |
| `ConstraintEngine.js` | `validateAllConstraints()` | Comprehensive validation |
| `PatternRecognizer.js` | `recognizeAllPatterns()` | Detect staff patterns |

### Data Access Hooks
| File | Function | Responsibility |
|------|----------|-----------------|
| `useCalendarRules.js` | `useCalendarRules()` | Load/sync calendar rules |
| `useEarlyShiftPreferences.js` | `useEarlyShiftPreferences()` | Load/sync early shift prefs |
| `useAISettings.js` | `useAISettings()` | ML configuration |
| `usePriorityRulesData.js` | `usePriorityRulesData()` | Staff shift preferences |
| `useStaffGroupsData.js` | `useStaffGroupsData()` | Conflict groups |

---

## 7. CURRENT CONSTRAINTS RESPECTED

### Hard Constraints (Must Satisfy)
1. **Staff Group Conflicts** - Members cannot all be off on same day
2. **Daily Limits** - Max X shifts of type Y per day
3. **Priority Rules** - Honor explicit staff preferences when set as hard constraint
4. **Minimum Coverage** - Ensure staffing levels met

### Soft Constraints (Try to Satisfy)
1. **Fairness** - Balance shifts across staff members
2. **Monthly Limits** - Equity in workload distribution
3. **Preference Satisfaction** - Accommodate soft preferences
4. **Shift Distribution** - Rotate shift types fairly

### NOT Currently Constrained
- ❌ **Calendar Rules** (must_work, must_day_off)
- ❌ **Early Shift Preferences** (△ permissions)
- ❌ **Weekend Fairness** (partial)
- ❌ **Workload Peaks** (seasonal)

---

## 8. INTEGRATION POINTS FOR EARLY SHIFT PREFERENCES

### Point 1: Configuration Loading Phase
**Location**: `ScheduleGenerator.js:generateSchedule()` around line 360-380
```javascript
// After loading other constraints, ADD:
const earlyShiftPreferences = await loadEarlyShiftPreferences(restaurantId);
const calendarRules = await loadCalendarRules(restaurantId, dateRange);
```

### Point 2: Constraint Processing
**Location**: `ConstraintIntegrationLayer.js:processConstraints()` around line 262
```javascript
// In constraint processor loop, ADD:
processedConstraints.earlyShiftConstraints = 
  this.processEarlyShiftConstraints(earlyShiftPreferences, problemContext);
```

### Point 3: Fitness Evaluation
**Location**: `ScheduleGenerator.js` - Fitness function
```javascript
// During fitness calculation, ADD:
const earlyShiftViolations = this.countEarlyShiftViolations(
  solution, 
  earlyShiftPreferences, 
  staffMembers
);
fitnessScore -= earlyShiftViolations * penaltyWeight;
```

### Point 4: Validation
**Location**: `ConstraintEngine.js:validateAllConstraints()` around line 500+
```javascript
// After current validations, ADD:
const earlyShiftValidation = this.validateEarlyShiftPreferences(
  schedule, 
  earlyShiftPreferences
);
```

---

## 9. ALGORITHM SELECTION AND PARAMETERS

### Available Algorithms
1. **Genetic Algorithm** (Most Common)
   - Population-based evolution
   - Crossover + mutation operations
   - Presets: quick (150 gen), balanced (300 gen), best (500 gen)

2. **Simulated Annealing**
   - Temperature-based acceptance
   - Good for escaping local minima
   - Slower but higher quality

3. **Ensemble** (Recommended for best quality)
   - Runs multiple algorithms
   - Combines results via voting/averaging
   - Takes longest but best accuracy

### ML Presets
```javascript
quick:    50 population,  150 generations, 0.15 mutation
balanced: 100 population, 300 generations, 0.1 mutation
best:     200 population, 500 generations, 0.05 mutation + ensemble
```

---

## 10. SHIFT ASSIGNMENT LOGIC

### Eligible Staff by Type
```javascript
社員 (Full-time Employee)
  ├─ Can work: △ (early), ○ (normal), ◇ (late)
  ├─ Prefers: as configured in staff_early_shift_preferences
  └─ Used for: early shift rotation

パート (Part-time Employee)
  ├─ Can work: ○ (normal), ◇ (late)
  ├─ Cannot work: △ (early)
  └─ Limited to: flexible schedules
```

### Assignment Constraints
1. **Staff Status Check**
   - Before assigning △: verify `staff.status === "社員"`
   - Add early shift preference check

2. **Conflict Avoidance**
   - Check staff_groups for members who can't all be off
   - Don't assign △ to staff without preference

3. **Coverage Requirements**
   - Ensure minimum shifts per day
   - Balance across shift types

4. **Fairness**
   - Rotate △ assignments across eligible staff
   - Track historical assignments

---

## 11. CONSTRAINTS VIOLATION TYPES

From `ConstraintEngine.js`:

```javascript
export const VIOLATION_TYPES = {
  INSUFFICIENT_COVERAGE: "insufficient_coverage",
  DAILY_OFF_LIMIT: "daily_off_limit",
  STAFF_GROUP_CONFLICT: "staff_group_conflict",
  PRIORITY_RULE_VIOLATION: "priority_rule_violation",
  MONTHLY_LIMIT_EXCEEDED: "monthly_limit_exceeded",
  SHIFT_TYPE_RESTRICTION: "shift_type_restriction",
  // TODO: ADD
  // CALENDAR_RULE_VIOLATION: "calendar_rule_violation",
  // EARLY_SHIFT_PREFERENCE_VIOLATION: "early_shift_preference_violation",
};
```

---

## 12. PATTERN RECOGNITION INTEGRATION

### Available Pattern Detection
Located in `PatternRecognizer.js`:

1. **Day-of-Week Preferences**
   - Which days staff prefer off
   - Consistency score

2. **Shift Type Preferences**
   - Early vs late vs normal preferences
   - Adaptability score

3. **Consecutive Patterns**
   - Work streak tendencies
   - Off streak preferences

4. **Frequency Patterns**
   - How often staff work
   - Consistency trends

5. **Seasonal Patterns**
   - Quarterly trends
   - Seasonal adaptability

6. **Position-Based Patterns**
   - Weekly cycle positions
   - Monthly position patterns

### Current Usage
- Pattern recognition runs but doesn't feedback into generation
- Results available for analysis/reporting
- Not used for constraint weighting

---

## 13. RECOMMENDED INTEGRATION STRATEGY

### Phase 1: Early Shift Preferences (High Impact)
1. Load `staff_early_shift_preferences` in generateSchedule()
2. Create constraint processor for early shift rules
3. Add hard constraint: don't assign △ to non-eligible staff
4. Add soft constraint: prefer staff with early shift preference
5. Penalty score for violations

### Phase 2: Calendar Rules (High Impact)
1. Validate generated schedule against calendar_rules
2. Add constraint processor for must_work/must_day_off
3. Hard constraint: enforce calendar_rules for all staff
4. Ensure 100% compliance before returning schedule

### Phase 3: Pattern-Based Weighting (Medium Impact)
1. Use PatternRecognizer output to adjust constraint weights
2. Personalized fairness based on historical patterns
3. Shift type rotation based on recognized preferences

### Phase 4: Advanced Features (Lower Priority)
1. Conflict prediction (prevent future conflicts)
2. Workload forecasting
3. Staff satisfaction scoring

---

## 14. IMPLEMENTATION CHECKLIST

- [ ] Add `loadEarlyShiftPreferences()` function
- [ ] Add `loadCalendarRules()` function
- [ ] Create `EarlyShiftConstraintProcessor`
- [ ] Create `CalendarRuleConstraintProcessor`
- [ ] Integrate processors into constraint pipeline
- [ ] Add penalty functions for violations
- [ ] Update fitness evaluation
- [ ] Add validation rules
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update UI to show constraint compliance
- [ ] Add logging/debugging for preferences

---

## Files Summary

**Schedule Generation**: 3,400+ lines across 4 main algorithm files
**Constraint Processing**: 1,100+ lines in ConstraintEngine, 1,120+ lines in ConstraintIntegrationLayer
**Pattern Recognition**: 1,300+ lines in PatternRecognizer
**Data Access**: 320+ lines in useCalendarRules, 325+ lines in useEarlyShiftPreferences
**Total Analyzed**: ~8,400+ lines of AI/scheduling code

