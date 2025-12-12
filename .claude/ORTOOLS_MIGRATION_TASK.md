# OR-Tools Migration Task for Next Agent

## Mission

Fork the current repository and replace the JavaScript ML system with Google OR-Tools for schedule optimization.

## Context

The user is unhappy with the current ML results. The existing system uses a multi-phase rule-based approach (~6,400 lines of JS code) that produces heuristic solutions. OR-Tools will provide **provably optimal** schedules using constraint programming.

## Future Feature: Shift Requests

After core migration, implement **shift requests** - staff can request preferred shifts as soft constraints. See Section 13 of the migration guide.

## Key Documents to Read First

1. **ORTOOLS_MIGRATION_GUIDE.md** - Complete migration specification (THIS IS YOUR BIBLE)
2. **AI_GENERATION_FLOW_DOCUMENTATION.md** - Understand current constraint system
3. **CLAUDE.md** - Project architecture overview

## Summary of Work

### What to CREATE

```
python-ortools-service/
├── scheduler.py        # OR-Tools optimizer (see ORTOOLS_MIGRATION_GUIDE.md Section 7)
├── requirements.txt    # ortools, flask, gunicorn
├── Dockerfile         # Python 3.11 + OR-Tools
└── test_scheduler.py  # Unit tests

go-server/
└── ortools_client.go  # HTTP client to call Python service (see Section 8)
```

### What to MODIFY

```
go-server/main.go              # Add GENERATE_SCHEDULE_ORTOOLS message handler
src/hooks/useAIAssistantLazy.js # Simplify to call Go server (see Section 9)
docker-compose.yml             # Add ortools-optimizer service (see Section 10)
```

### What to DELETE

```
src/ai/hybrid/BusinessRuleValidator.js    # ~3,000 lines
src/ai/hybrid/HybridPredictor.js          # ~500 lines
src/ai/constraints/ConstraintEngine.js    # ~2,000 lines
src/ai/core/PatternRecognizer.js          # ~300 lines
src/ai/utils/CalendarEarlyShiftIntegrator.js
src/ai/utils/MonthlyLimitCalculator.js
```

### What to KEEP

```
src/ai/utils/CalendarRulesLoader.js          # Data loading - KEEP
src/ai/utils/EarlyShiftPreferencesLoader.js  # Data loading - KEEP
```

## Constraint Mapping Quick Reference

| Current JS | OR-Tools |
|-----------|----------|
| Calendar must_day_off | `model.Add(shift[staff, date, OFF] == 1)` |
| Staff groups (1 off per group) | `model.Add(sum(off_shifts) <= 1)` |
| Daily limits (min 2, max 3) | `model.Add(off_count >= 2)` |
| No consecutive ×× | `model.Add(off[d1] + off[d2] <= 1)` |
| 5-day rest | `model.Add(sum(rest_in_window) >= 1)` |

## Estimated Time

| Phase | Hours |
|-------|-------|
| Python OR-Tools service | 6h |
| Go HTTP client | 4h |
| Frontend changes | 3h |
| Docker setup | 2h |
| Testing | 6h |
| **Total** | **~21h (3-5 days)** |

## How to Start

```bash
# 1. Create migration branch
git checkout -b ortools-migration

# 2. Create Python service directory
mkdir -p python-ortools-service

# 3. Follow ORTOOLS_MIGRATION_GUIDE.md Section 6 step by step
```

## Success Criteria

1. ✅ OR-Tools service generates schedules in <30s
2. ✅ All constraints from original system are implemented
3. ✅ Frontend calls Go server → OR-Tools (no local ML)
4. ✅ Unit tests pass
5. ✅ Docker deployment works
6. ✅ Schedule quality is optimal (or proven feasible)

## Important Notes

- **Keep old code in git history** - Don't force delete, just remove files
- **Test each phase** before moving to next
- **Deploy to staging first** before production
- **Keep CalendarRulesLoader.js and EarlyShiftPreferencesLoader.js** - they load data from Supabase

## Questions?

Refer to ORTOOLS_MIGRATION_GUIDE.md - it contains complete code examples for every component.
