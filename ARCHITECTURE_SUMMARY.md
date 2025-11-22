# AI Schedule Generation Architecture - Quick Reference

## System Overview
```
Shift Schedule Manager uses a HYBRID AI ARCHITECTURE:
- Genetic Algorithms (primary)
- Simulated Annealing (fallback)
- Ensemble approach (best quality)
- Real-time Supabase integration
- Constraint satisfaction framework
```

## Critical Files

### Entry Points
- **Main**: `/src/ai/core/ScheduleGenerator.js` → `generateSchedule(params)`
- **Hooks**: `/src/hooks/useCalendarRules.js`, `/src/hooks/useEarlyShiftPreferences.js`

### Algorithm Implementations
- **Genetic**: `/src/ai/algorithms/GeneticAlgorithm.js`
- **Annealing**: `/src/ai/algorithms/SimulatedAnnealing.js`
- **Ensemble**: `/src/ai/ml/EnsembleScheduler.js`

### Constraint Processing
- **Core**: `/src/ai/constraints/ConstraintEngine.js`
- **Integration**: `/src/ai/ml/ConstraintIntegrationLayer.js`
- **Patterns**: `/src/ai/core/PatternRecognizer.js`

## Data Flow (Simplified)

```
User clicks "Generate Schedule"
           ↓
  Load Configuration:
  ├─ Staff members
  ├─ Calendar rules (⚠️ loaded but NOT enforced)
  ├─ Early shift preferences (⚠️ loaded but NOT used)
  ├─ Priority rules ✅
  ├─ Staff groups ✅
  └─ Daily/monthly limits ✅
           ↓
   Select Algorithm:
   ├─ Genetic Algorithm (most common)
   ├─ Simulated Annealing
   └─ Ensemble (both)
           ↓
    Execute Algorithm:
    ├─ Initialize population
    ├─ Evaluate fitness (constraint satisfaction)
    ├─ Generate/select best solutions
    └─ Return optimized schedule
           ↓
  Validate Against Constraints:
  ├─ Staff conflicts ✅
  ├─ Daily limits ✅
  ├─ Monthly limits ✅
  ├─ Priority rules ✅
  ├─ Calendar rules ❌ (not validated)
  └─ Early shift preferences ❌ (not validated)
           ↓
    Return schedule or error
```

## Key Shift Types

```
△ (Early)   - Only 社員 (full-time) | 6:00-14:00 | NOT currently preference-aware
○ (Normal)  - Any staff type | 14:00-22:00 | Freely assigned
◇ (Late)    - Any staff type | 22:00-06:00 | Freely assigned
× (Off)     - All staff types | No shift    | Fairly distributed
```

## Database Tables (Key Fields)

### calendar_rules
```
restaurant_id: UUID
date: YYYY-MM-DD
rule_type: "must_work" | "must_day_off"
reason: string
```

### staff_early_shift_preferences
```
restaurant_id: UUID
staff_id: UUID
can_do_early_shift: boolean
applies_to_date: YYYY-MM-DD (or NULL for default)
preference_source: "individual" | "bulk_assignment"
```

## Current Constraint Status

### ✅ ENFORCED (Hard Constraints)
- Staff group conflicts
- Daily shift limits
- Priority rules (when marked hard)
- Minimum coverage

### ✅ SOFT CONSTRAINTS (Try to satisfy)
- Monthly fairness
- Shift distribution balance
- Preference satisfaction

### ❌ NOT ENFORCED
- Calendar rules (must_work, must_day_off)
- Early shift preferences (△ assignments)

## ML Algorithm Parameters

### Genetic Algorithm (Most Common)
```javascript
quick:    population=50,   generations=150, mutation=0.15
balanced: population=100,  generations=300, mutation=0.1
best:     population=200,  generations=500, mutation=0.05
```

### Fitness Scoring
```
Total Score = 
  Hard Constraints (50%) +
  Soft Constraints (30%) +
  Objectives (15%) +
  Penalties (-5%)
```

## Key Functions to Integrate

### For Early Shift Preferences
```javascript
// In ScheduleGenerator.loadEarlyShiftPreferences(restaurantId)
// In ConstraintIntegrationLayer.processEarlyShiftConstraints()
// In Fitness function: penalizeInvalidEarlyShifts()
// In ConstraintEngine.validateEarlyShiftPreferences()
```

### For Calendar Rules
```javascript
// In ScheduleGenerator.loadCalendarRules(restaurantId, dateRange)
// In ConstraintIntegrationLayer.processCalendarRuleConstraints()
// In Fitness function: penalizeCalendarRuleViolations()
// In ConstraintEngine.validateCalendarRules()
```

## Integration Points (4 Places to Add)

### 1. Configuration Loading
**File**: `ScheduleGenerator.js` line ~360-380
```javascript
// Add after existing constraint loading:
const earlyShiftPreferences = await this.loadEarlyShiftPreferences(restaurantId);
const calendarRules = await this.loadCalendarRules(restaurantId, dateRange);
```

### 2. Constraint Processing
**File**: `ConstraintIntegrationLayer.js` line ~262
```javascript
// In constraint processor loop:
processedConstraints.earlyShiftConstraints = 
  this.processEarlyShiftConstraints(earlyShiftPreferences, context);
```

### 3. Fitness Evaluation
**File**: `ScheduleGenerator.js` fitness function
```javascript
// During scoring:
const earlyShiftPenalty = this.countEarlyShiftViolations(solution);
fitnessScore -= earlyShiftPenalty * penaltyWeight;
```

### 4. Solution Validation
**File**: `ConstraintEngine.js` line ~500+
```javascript
// After current validations:
const earlyShiftValidation = this.validateEarlyShiftPreferences(schedule);
violations.push(...earlyShiftValidation);
```

## Testing Checklist

- [ ] Load calendar_rules successfully
- [ ] Load early_shift_preferences successfully
- [ ] Enforce must_work constraint
- [ ] Enforce must_day_off constraint
- [ ] Prevent △ assignment to non-eligible staff
- [ ] Penalize △ assignment to staff without preference
- [ ] Validate all constraints before returning
- [ ] Handle missing/empty preferences
- [ ] Test with all algorithm types
- [ ] Performance test with large datasets

## Performance Considerations

- **Cache Duration**: 30 seconds (for configuration changes)
- **Algorithm Runtime**: 2-12 minutes (depends on staff count & algorithm)
- **Population Size**: 50-200 (configurable)
- **Generations**: 150-500 (configurable)
- **Concurrent Users**: 1000+ (via Go WebSocket server)

## Deployment Notes

- All constraints are enforced BEFORE schedule is saved
- Invalid schedules return error with violation summary
- Preferences are read in real-time (no pre-caching)
- Calendar rules bypass age constraints
- Early shift preferences are role-specific (社員 only)

## Next Steps

1. **Phase 1**: Integrate early shift preferences (highest impact)
2. **Phase 2**: Integrate calendar rules (highest impact)
3. **Phase 3**: Add pattern-based weighting (medium impact)
4. **Phase 4**: Advanced features (lower priority)

See `AI_ARCHITECTURE_ANALYSIS.md` for detailed technical documentation.
