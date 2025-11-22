# AI Architecture - Key File Locations

## Core Schedule Generation Engine

```
src/ai/core/
├── ScheduleGenerator.js                  [3,400+ lines]
│   ├── generateSchedule(params)          [Line 329] ⭐ MAIN ENTRY POINT
│   ├── generateWithSingleAlgorithm()    [Line 3446]
│   ├── runEnsembleAlgorithms()          [Line 3403]
│   ├── isEligibleForEarlyShift()        [Line 144] ✅ Early shift check
│   ├── countEarlyShiftViolations()      [MISSING - needs implementation]
│   └── ... (algorithm helpers)
│
├── ConflictResolver.js
│   └── Handles staff group conflicts
│
└── PatternRecognizer.js                  [1,300+ lines]
    ├── detectDayOfWeekPreferences()
    ├── detectShiftTypePreferences()
    ├── detectConsecutivePatterns()
    ├── recognizeAllPatterns()
    └── ... (6 pattern detection functions)
```

## Constraint Processing & Validation

```
src/ai/constraints/
├── ConstraintEngine.js                   [1,100+ lines]
│   ├── validateAllConstraints()          [Validates existing constraints]
│   ├── getDailyLimits()
│   ├── getMonthlyLimits()
│   ├── getPriorityRules()
│   ├── getStaffConflictGroups()
│   ├── isEarlyShift()                    [Line 402]
│   └── VIOLATION_TYPES                   [Constants for violation classification]
│
└── [NEW NEEDED] EarlyShiftConstraintProcessor
    └── Would validate early shift preferences

src/ai/ml/
├── ConstraintIntegrationLayer.js         [1,120+ lines]
│   ├── processSmartConstraints()         [Line 73]
│   ├── processConstraints()              [Line 262] ⭐ Constraint conversion
│   ├── validateSolution()                [Line 480]
│   ├── buildConstraintMatrix()
│   ├── createObjectiveFunction()
│   ├── StaffGroupProcessor              [Line 821]
│   ├── DailyLimitProcessor               [Line 890]
│   ├── PriorityRuleProcessor             [Line 942]
│   ├── MonthlyLimitProcessor             [Line 985]
│   └── BackupAssignmentProcessor         [Line 1026]
│
├── EnsembleScheduler.js
│   └── Combines results from multiple algorithms
│
└── TensorFlowScheduler.js
    └── Alternative ML approach
```

## Algorithms

```
src/ai/algorithms/
├── GeneticAlgorithm.js                   [1,200+ lines]
│   ├── run()                             [Main GA execution]
│   ├── initialize()
│   ├── evaluateFitness()
│   ├── selection()
│   ├── crossover()
│   └── mutation()
│
├── SimulatedAnnealing.js
│   ├── run()
│   ├── generateNeighbor()
│   └── accept()
│
└── CSPSolver.js
    └── Constraint Satisfaction Problem solver
```

## Data Access Hooks (Real-time)

```
src/hooks/
├── useCalendarRules.js                   [320+ lines] ⭐ CALENDAR RULES
│   ├── useCalendarRules()                [Line 15]
│   ├── loadRules()                       [Line 31]
│   ├── toggleRule()                      [Line 76]
│   ├── getRuleForDate()                  [Line 175]
│   ├── hasRule()                         [Line 184]
│   └── Real-time subscription via Supabase
│
├── useEarlyShiftPreferences.js            [325+ lines] ⭐ EARLY SHIFT PREFS
│   ├── useEarlyShiftPreferences()        [Line 12]
│   ├── loadPreferences()                 [Line 19]
│   ├── savePreference()                  [Line 57]
│   ├── bulkSavePreferences()             [Line 138]
│   ├── canDoEarlyShift()                 [Line 236]
│   └── Real-time subscription via Supabase
│
├── useAISettings.js
│   └── Load ML configuration
│
├── usePriorityRulesData.js
│   └── Load staff shift preferences
│
├── useStaffGroupsData.js
│   └── Load conflict groups
│
├── useSettingsData.js
│   └── Load general configuration
│
└── useScheduleDataPrefetch.js
    └── Prefetch schedule data
```

## UI Components

```
src/components/
├── ShiftScheduleEditorPhase3.jsx          [Main app component]
│   ├── NavigationToolbar.jsx              [Generate button location]
│   ├── ScheduleTable.jsx                  [Schedule editing/display]
│   └── StatisticsDashboard.jsx            [Analytics/reporting]
│
├── settings/
│   ├── tabs/EarlyShiftPreferencesTab.jsx [UI for early shift prefs]
│   └── tabs/PriorityRulesTab.jsx
│
└── ai/
    ├── AIAssistantModal.jsx
    └── ModelTrainingModal.jsx
```

## Utility Functions

```
src/utils/
├── dateUtils.js
│   ├── getDaysInMonth()
│   ├── getDateRange()
│   └── ... (date operations)
│
├── scheduleValidator.js
│   └── Validate schedule format
│
└── dataTransformation.js
    └── Data format conversions

src/lib/
└── utils.js (general utilities)
```

## Services

```
src/services/
├── ConfigurationService.js                [Configuration management]
│   ├── initialize()
│   ├── getSettings()
│   ├── saveSettings()
│   └── Real-time cache invalidation
│
├── BackupStaffService.js                  [Backup staff handling]
│   └── Integration with schedule generation
│
└── [NEW NEEDED] EarlyShiftPreferenceService
    └── Manage early shift preference business logic
```

## Database Tables (Supabase)

```
public/
├── calendar_rules                         ⭐ MUST_WORK / MUST_DAY_OFF
│   ├── id (UUID)
│   ├── restaurant_id
│   ├── date (YYYY-MM-DD)
│   ├── rule_type ('must_work' | 'must_day_off')
│   ├── reason
│   └── updated_at
│
├── staff_early_shift_preferences          ⭐ EARLY SHIFT PREFERENCES
│   ├── id (UUID)
│   ├── restaurant_id
│   ├── staff_id
│   ├── can_do_early_shift (boolean)
│   ├── applies_to_date (YYYY-MM-DD or NULL)
│   ├── preference_source ('individual' | 'bulk_assignment')
│   └── updated_at
│
├── staff_members
│   ├── id
│   ├── name
│   ├── status ('社員' | 'パート')
│   └── ... (other fields)
│
├── shift_schedules
│   ├── id
│   ├── restaurant_id
│   ├── staff_id
│   ├── date
│   ├── shift_type ('△' | '○' | '◇' | '×')
│   └── updated_at
│
├── priority_rules
│   ├── Staff shift preferences
│   └── Hard/soft constraint flags
│
├── staff_groups
│   ├── Conflict groups
│   ├── Members
│   └── Coverage rules
│
├── daily_limits
│   ├── Max shifts per day per type
│   └── Hard/soft constraint flags
│
└── monthly_limits
    ├── Fairness limits
    └── Constraint configuration
```

## Integration Points (Where to Add Code)

### 1. Load Early Shift Preferences
**File**: `src/ai/core/ScheduleGenerator.js` Line ~360-380
- Add: `const prefs = await this.loadEarlyShiftPreferences(restaurantId);`

### 2. Process Early Shift Constraints
**File**: `src/ai/ml/ConstraintIntegrationLayer.js` Line ~262
- Add processor: `this.processEarlyShiftConstraints(prefs, context)`

### 3. Penalize Violations in Fitness
**File**: `src/ai/core/ScheduleGenerator.js` Fitness function
- Add penalty: `fitnessScore -= this.countEarlyShiftViolations(solution) * weight;`

### 4. Validate in Output
**File**: `src/ai/constraints/ConstraintEngine.js` Line ~500+
- Add validation: `const earlyShiftViolations = this.validateEarlyShiftPreferences(schedule);`

## Configuration Files

```
src/config/
├── featureFlags.js
│   └── Feature toggles for functionality
│
└── staffNameMappings.js
    └── Staff name to ID mappings
```

## Test Files

```
src/ai/adapters/
├── AIConfigAdapter.test.js
└── AIConfigAdapter.js

src/hooks/__tests__/
├── useAISettings.test.js
└── (other hook tests)
```

## Performance & Monitoring

```
src/ai/performance/
├── AIPerformanceManager.js
├── PerformanceMonitor.js
├── TensorMemoryManager.js
└── WorkerManager.js                     [Web Worker management]

src/ai/cache/
├── ConfigurationCacheManager.js          [Config caching]
├── FeatureCacheManager.js                [Feature caching]
└── (cache management)

src/ai/security/
└── SecurityManager.js                    [Security controls]
```

## Workers (Multi-threading)

```
src/workers/
├── aiWorker.js                           [Generic AI worker]
├── mlWorker.js                           [ML algorithm worker]
├── enhancedAIWorker.js                   [Enhanced ML worker]
├── featureGenerationWorker.js            [Feature engineering]
└── OptimizedFeatureManager.js            [Feature optimization]
```

## Debug & Development

```
src/debug/
├── AIAssistantDebugger.js                [Debugging utilities]
└── (debug tools)

src/components/debug/
├── DebugPatch.jsx
├── AIAssistantDebugTester.jsx
└── (debug components)
```

## Key Line Numbers (ScheduleGenerator.js)

| Function | Line | Purpose |
|----------|------|---------|
| `generateSchedule()` | 329 | Main entry point |
| `isEligibleForEarlyShift()` | 144 | Status check |
| `initializeGenerationStrategies()` | 195 | Strategy setup |
| `generateWithSingleAlgorithm()` | 3446 | Single algo wrapper |
| `runEnsembleAlgorithms()` | 3403 | Ensemble execution |
| Constraint weights | 116-123 | Weight configuration |
| ML presets | 65-113 | Algorithm parameters |

## Related Documentation

- `CLAUDE.md` - Project guidelines & commands
- `AI_ARCHITECTURE_ANALYSIS.md` - Detailed technical analysis
- `ARCHITECTURE_SUMMARY.md` - Quick reference guide (this file)
- `WORKING_CALENDAR_PLAN.md` - Calendar feature requirements

## Database Diagram

```
Staff Member
    ├─ has many Staff Early Shift Preferences
    ├─ has many Shift Schedules  
    └─ belongs to Staff Groups

Calendar Rules
    └─ applies to all staff on specific dates

Shift Schedules
    ├─ staff_id (foreign key)
    ├─ date
    ├─ shift_type (△, ○, ◇, ×)
    └─ validates against Calendar Rules

Staff Early Shift Preferences
    ├─ staff_id (foreign key)
    ├─ applies_to_date (specific date or NULL for global)
    └─ can_do_early_shift (boolean)
```
