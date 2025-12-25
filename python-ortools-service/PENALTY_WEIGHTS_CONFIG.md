# OR-Tools Penalty Weights Configuration

## Overview

The Python OR-Tools scheduler now accepts custom penalty weights and solver settings through the API request, allowing fine-tuned control over constraint enforcement priorities.

## Features

### 1. Configurable Penalty Weights

Control how aggressively the optimizer enforces each constraint type by adjusting penalty values. Higher penalties mean the constraint is more important to satisfy.

### 2. Configurable Solver Settings

Adjust the solver's timeout and number of parallel workers for performance tuning.

### 3. Default Fallback

If no custom configuration is provided, the system uses battle-tested default values.

## API Request Format

### Basic Request Structure

```json
{
  "staffMembers": [...],
  "dateRange": [...],
  "constraints": {
    "calendarRules": {...},
    "staffGroups": [...],
    "dailyLimitsRaw": {...},
    "monthlyLimit": {...},
    "priorityRules": [...],

    "ortoolsConfig": {
      "penaltyWeights": {
        "staffGroup": 100,
        "dailyLimitMin": 50,
        "dailyLimitMax": 50,
        "monthlyLimit": 80,
        "adjacentConflict": 30,
        "fiveDayRest": 200
      },
      "solverSettings": {
        "timeout": 30,
        "numWorkers": 4
      }
    }
  },
  "timeout": 30
}
```

### Penalty Weight Parameters

#### `staffGroup` (default: 100)
**What it controls:** Staff group constraint violations

**Description:** Prevents multiple members of the same group from having off days or early shifts simultaneously.

**Recommendations:**
- **High priority (150-200):** When maintaining group coverage is critical
- **Default (100):** Balanced enforcement
- **Low priority (50-80):** When group flexibility is acceptable

---

#### `dailyLimitMin` (default: 50)
**What it controls:** Daily minimum off-day violations

**Description:** Ensures at least the minimum number of staff get off days per day.

**Recommendations:**
- **High priority (80-100):** When ensuring adequate rest days is critical
- **Default (50):** Balanced enforcement
- **Low priority (20-40):** When flexibility is more important than minimum rest

---

#### `dailyLimitMax` (default: 50)
**What it controls:** Daily maximum off-day violations

**Description:** Ensures no more than the maximum number of staff are off per day.

**Recommendations:**
- **High priority (80-100):** When maintaining minimum working staff is critical
- **Default (50):** Balanced enforcement
- **Low priority (20-40):** When you can tolerate occasional understaffing

---

#### `monthlyLimit` (default: 80)
**What it controls:** Monthly off-day limit violations (both min and max)

**Description:** Ensures each staff member gets their monthly off-day allocation.

**Recommendations:**
- **High priority (100-150):** When fair distribution of rest days is critical
- **Default (80):** Balanced enforcement
- **Low priority (40-60):** When short-term flexibility is more important

---

#### `adjacentConflict` (default: 30)
**What it controls:** Adjacent conflict pattern violations (xx, sx, xs)

**Description:** Prevents problematic patterns like consecutive off days or early-then-off.

**Recommendations:**
- **High priority (50-80):** When maintaining consistent work patterns is important
- **Default (30):** Balanced enforcement (these are "soft" operational preferences)
- **Low priority (10-20):** When pattern flexibility is acceptable

---

#### `fiveDayRest` (default: 200)
**What it controls:** 5-day rest constraint violations (labor law compliance)

**Description:** Ensures no staff works more than 5 consecutive days without a rest day.

**Recommendations:**
- **Critical priority (300-500):** When strict labor law compliance is required
- **Default (200):** High priority for labor law compliance
- **Not recommended to reduce below 150:** This is a legal requirement in many jurisdictions

---

### Solver Settings

#### `timeout` (default: 30 seconds)
**What it controls:** Maximum time the solver will run before returning the best solution found

**Recommendations:**
- **Quick results (5-15s):** For small schedules or when speed is critical
- **Default (30s):** Good balance for most use cases
- **Complex schedules (60-120s):** For large staff counts or many constraints

#### `numWorkers` (default: 4)
**What it controls:** Number of parallel search threads

**Recommendations:**
- **Single core (1):** For testing or resource-constrained environments
- **Default (4):** Good balance for most servers
- **High-end systems (8-16):** For faster solving on powerful machines

## Usage Examples

### Example 1: Default Configuration

Use default penalty weights (no ortoolsConfig needed):

```json
{
  "staffMembers": [...],
  "dateRange": [...],
  "constraints": {
    "dailyLimitsRaw": {"minOffPerDay": 2, "maxOffPerDay": 3},
    "monthlyLimit": {"minCount": 7, "maxCount": 8}
  },
  "timeout": 30
}
```

**Result:** Uses all default weights (shown in response config).

---

### Example 2: Strict Labor Law Compliance

Emphasize labor law compliance with very high penalty for 5-day rest:

```json
{
  "constraints": {
    "ortoolsConfig": {
      "penaltyWeights": {
        "fiveDayRest": 500
      }
    }
  }
}
```

**Result:** 5-day rest violations have 2.5x higher penalty (500 vs default 200). Other weights use defaults.

---

### Example 3: Prioritize Group Coverage

Emphasize staff group constraints for better team coordination:

```json
{
  "constraints": {
    "ortoolsConfig": {
      "penaltyWeights": {
        "staffGroup": 200,
        "monthlyLimit": 150
      }
    }
  }
}
```

**Result:** Group violations penalized 2x more heavily. Monthly limits also increased.

---

### Example 4: Flexible Adjacent Patterns

Relax adjacent conflict rules when pattern flexibility is needed:

```json
{
  "constraints": {
    "ortoolsConfig": {
      "penaltyWeights": {
        "adjacentConflict": 10
      }
    }
  }
}
```

**Result:** Adjacent conflicts (xx, sx, xs) are allowed more frequently if needed to satisfy other constraints.

---

### Example 5: Performance Tuning

Optimize for fast results on complex schedules:

```json
{
  "constraints": {
    "ortoolsConfig": {
      "solverSettings": {
        "timeout": 60,
        "numWorkers": 8
      }
    }
  }
}
```

**Result:** Solver runs longer (60s) with more parallel threads (8) for better solutions on complex problems.

---

### Example 6: Comprehensive Custom Configuration

Full control over all parameters:

```json
{
  "constraints": {
    "ortoolsConfig": {
      "penaltyWeights": {
        "staffGroup": 150,
        "dailyLimitMin": 75,
        "dailyLimitMax": 80,
        "monthlyLimit": 100,
        "adjacentConflict": 50,
        "fiveDayRest": 300
      },
      "solverSettings": {
        "timeout": 45,
        "numWorkers": 6
      }
    }
  }
}
```

**Result:** All constraints balanced according to business priorities with optimized solver performance.

---

## Response Format

The API response includes the actual configuration used:

```json
{
  "success": true,
  "schedule": {...},
  "solve_time": 2.34,
  "is_optimal": true,
  "stats": {...},
  "violations": [],
  "config": {
    "penaltyWeights": {
      "staffGroup": 150,
      "dailyLimitMin": 75,
      "dailyLimitMax": 80,
      "monthlyLimit": 100,
      "adjacentConflict": 50,
      "fiveDayRest": 300
    },
    "timeout": 45.0,
    "numWorkers": 6
  }
}
```

**Key Response Fields:**
- `config.penaltyWeights`: The actual penalty weights used (custom or defaults)
- `config.timeout`: Solver timeout used
- `config.numWorkers`: Number of parallel workers used
- `violations`: List of any constraint violations with penalty costs

## Tuning Strategies

### 1. Start with Defaults

Begin with default weights and only adjust if you see specific issues.

### 2. Analyze Violations

Check the `violations` array in the response to see which constraints are being violated:

```json
{
  "violations": [
    {
      "description": "Staff group TeamA on 2025-01-15",
      "count": 2,
      "penalty": 200
    }
  ]
}
```

### 3. Adjust One Weight at a Time

Increase the penalty for the constraint you want to prioritize:

```json
{
  "penaltyWeights": {
    "staffGroup": 200  // Increased from 100
  }
}
```

### 4. Monitor Solution Quality

Watch these metrics:
- `total_violations`: Number of constraint violations
- `total_violation_penalty`: Total penalty score
- `is_optimal`: Whether the solution is proven optimal
- `solve_time`: Time to find solution

### 5. Balance Trade-offs

When constraints conflict, the optimizer will choose the solution that minimizes total penalty:
- If you see monthly limit violations but need perfect group coverage, increase `monthlyLimit` weight
- If solver times out without finding a good solution, increase `timeout` or reduce constraint penalties

## Implementation Details

### Internal Mapping

The system maps camelCase API keys to snake_case internal keys:

```python
{
    'staff_group': custom_weights.get('staffGroup', 100),
    'daily_limit': custom_weights.get('dailyLimitMin', 50),
    'daily_limit_max': custom_weights.get('dailyLimitMax', 50),
    'monthly_limit': custom_weights.get('monthlyLimit', 80),
    'adjacent_conflict': custom_weights.get('adjacentConflict', 30),
    '5_day_rest': custom_weights.get('fiveDayRest', 200),
}
```

### Default Weights

All defaults are defined in `ShiftScheduleOptimizer.__init__()`:

```python
self.DEFAULT_PENALTY_WEIGHTS = {
    'staff_group': 100,
    'daily_limit': 50,
    'daily_limit_max': 50,
    'monthly_limit': 80,
    'adjacent_conflict': 30,
    '5_day_rest': 200,
}
```

### Solver Configuration

Solver settings are applied during optimization:

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = timeout_seconds
solver.parameters.num_search_workers = self.num_workers
```

## Testing

Run the test suite to verify configuration works correctly:

```bash
cd python-ortools-service
python3 test_penalty_weights.py
```

**Tests included:**
1. Default weights test
2. Custom weights test
3. Partial custom weights test (merge with defaults)

## Best Practices

### 1. Labor Law Compliance First
Always keep `fiveDayRest` at high priority (≥150) for legal compliance.

### 2. Gradual Adjustments
Make small incremental changes (±20-30) rather than dramatic changes.

### 3. Document Your Configuration
Keep notes on why specific weights were chosen for your use case.

### 4. Test with Real Data
Validate custom weights with actual schedule requirements before production deployment.

### 5. Monitor Violations
Regularly review the `violations` array to ensure schedules meet business needs.

### 6. Consider Trade-offs
Understand that perfect constraint satisfaction may be impossible - the optimizer finds the best balance.

## Troubleshooting

### Problem: Too many violations

**Solution:** Increase penalties for violated constraints

```json
{
  "penaltyWeights": {
    "staffGroup": 200  // Was 100
  }
}
```

### Problem: Solver times out

**Solution:** Increase timeout or reduce problem complexity

```json
{
  "solverSettings": {
    "timeout": 60  // Was 30
  }
}
```

### Problem: Solution found but not optimal

**Solution:** Increase timeout or workers for better solution quality

```json
{
  "solverSettings": {
    "timeout": 45,
    "numWorkers": 8  // Was 4
  }
}
```

### Problem: Conflicting requirements

**Solution:** Adjust relative priorities of conflicting constraints

```json
{
  "penaltyWeights": {
    "dailyLimitMax": 100,    // Prioritize minimum staffing
    "monthlyLimit": 60       // Relax monthly fairness
  }
}
```

## Migration Guide

### Upgrading from Hardcoded Weights

**Before (hardcoded):**
```python
# In scheduler.py
self.PENALTY_WEIGHTS = {
    'staff_group': 100,
    'daily_limit': 50,
    ...
}
```

**After (configurable):**
```json
{
  "constraints": {
    "ortoolsConfig": {
      "penaltyWeights": {
        "staffGroup": 100,
        "dailyLimitMin": 50
      }
    }
  }
}
```

**Backward Compatibility:**
- Existing API calls without `ortoolsConfig` continue to work with defaults
- No breaking changes to existing integrations

## Support

For questions or issues with penalty weight configuration:
1. Check the `violations` array in the API response
2. Review this documentation for recommended ranges
3. Test with `test_penalty_weights.py`
4. Monitor logs for `[OR-TOOLS] Using penalty weights:` messages
