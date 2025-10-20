# AI Config Adapter - Quick Reference Card

## Import

```javascript
import {
  createAIConfiguration,        // Main entry point
  transformStaffGroups,
  transformDailyLimits,
  transformPriorityRules,
  transformMLConfig,
  validateAIConfiguration,
} from './ai/adapters';
```

---

## Main Function: `createAIConfiguration(settings)`

### Input (WebSocket/Database Format)

```javascript
{
  staffGroups: [
    {
      id: "uuid",
      name: "Group Name",
      group_config: { members: [...], max_simultaneous_off: 1 },
      is_active: true
    }
  ],
  dailyLimits: [
    {
      id: "uuid",
      name: "Limit Name",
      limit_config: { max_staff: 4, penalty_weight: 50 },
      is_hard_constraint: true,
      is_active: true
    }
  ],
  priorityRules: [
    {
      id: "uuid",
      priority: 10,
      rule_config: { conditions: {...}, actions: {...} },
      is_active: true
    }
  ],
  mlModelConfigs: [
    {
      model_type: "neural_network",
      hyperparameters: { learning_rate: 0.001, epochs: 100 },
      training_config: { validation_split: 0.2 }
    }
  ]
}
```

### Output (AI Format)

```javascript
{
  staffGroups: {
    "uuid": {
      id: "uuid",
      name: "Group Name",
      members: [...],
      maxSimultaneousOff: 1,
      active: true
    }
  },
  dailyLimits: [
    {
      id: "uuid",
      name: "Limit Name",
      maxStaff: 4,
      penalty: 50,
      isHard: true,
      enabled: true
    }
  ],
  priorityRules: [
    {
      id: "uuid",
      priority: 10,
      conditions: {...},
      actions: {...}
    }
  ],
  mlConfig: {
    modelType: "neural_network",
    learningRate: 0.001,
    epochs: 100,
    validationSplit: 0.2
  }
}
```

---

## Quick Usage Patterns

### Pattern 1: Full Transformation

```javascript
const aiConfig = createAIConfiguration(websocketSettings);
```

### Pattern 2: Individual Transformations

```javascript
const groups = transformStaffGroups(dbSettings.staffGroups);
const limits = transformDailyLimits(dbSettings.dailyLimits);
const rules = transformPriorityRules(dbSettings.priorityRules);
const mlConf = transformMLConfig(dbSettings.mlModelConfigs);
```

### Pattern 3: With Validation

```javascript
const aiConfig = createAIConfiguration(settings);
const validation = validateAIConfiguration(aiConfig);

if (!validation.valid) {
  console.error('Errors:', validation.errors);
}
```

### Pattern 4: React Hook Integration

```javascript
const { settings } = useWebSocketSettings();
const aiConfig = useMemo(
  () => createAIConfiguration(settings),
  [settings]
);
```

---

## Key Transformations Cheat Sheet

### Naming Convention

| Database (snake_case) | AI (camelCase) |
|-----------------------|----------------|
| `max_simultaneous_off` | `maxSimultaneousOff` |
| `is_hard_constraint` | `isHard` |
| `penalty_weight` | `penalty` |
| `staff_id` | `staffId` |
| `day_of_week` | `dayOfWeek` |
| `learning_rate` | `learningRate` |
| `batch_size` | `batchSize` |
| `is_active` | `active` / `enabled` |

### Structure Transformations

| Transformation | Input Type | Output Type |
|----------------|------------|-------------|
| Staff Groups | `Array` | `Map (Object)` |
| Daily Limits | `Array` | `Array` |
| Monthly Limits | `Array` | `Array` |
| Priority Rules | `Array` | `Array (sorted)` |
| ML Config | `Array` | `Object` |

### JSONB Field Extraction

```javascript
// Database
{
  group_config: {
    members: [...],
    max_simultaneous_off: 1
  }
}

// AI Format
{
  members: [...],
  maxSimultaneousOff: 1
}
```

---

## Error Handling Patterns

### Safe Field Access

```javascript
// Try multiple field names (version compatibility)
const value = config.maxStaff ?? config.max_staff ?? null;

// With nested JSONB
const members = group.group_config?.members || [];
```

### Null/Undefined Handling

```javascript
if (!input || !Array.isArray(input)) {
  return DEFAULT_AI_CONFIG.dailyLimits;
}
```

### Try-Catch with Fallback

```javascript
try {
  return createAIConfiguration(settings);
} catch (error) {
  console.error('Transformation failed:', error);
  return DEFAULT_AI_CONFIG;
}
```

---

## Common Field Mappings

### Staff Groups

```javascript
// DB → AI
{
  id                          → id
  name                        → name
  group_config.members        → members
  group_config.max_off        → maxSimultaneousOff
  is_active                   → active
  color                       → color
}
```

### Daily Limits

```javascript
// DB → AI
{
  id                          → id
  name                        → name
  limit_config.max_staff      → maxStaff
  limit_config.penalty_weight → penalty
  is_hard_constraint          → isHard
  is_active                   → enabled
  shift_type                  → shiftType
}
```

### Priority Rules

```javascript
// DB → AI
{
  id                          → id
  name                        → name
  priority                    → priority
  rule_config.conditions      → conditions
  rule_config.actions         → actions
  weight                      → weight
  is_active                   → enabled
}
```

### ML Config

```javascript
// DB → AI
{
  model_type                  → modelType
  hyperparameters.learning_rate → learningRate
  hyperparameters.epochs      → epochs
  hyperparameters.batch_size  → batchSize
  training_config.validation_split → validationSplit
}
```

---

## Integration Checklist

- [ ] Import adapter functions
- [ ] Transform WebSocket settings
- [ ] Validate transformed config (optional)
- [ ] Pass to AI components (ConstraintEngine, MLEngine, etc.)
- [ ] Handle incremental updates
- [ ] Add error handling
- [ ] Memoize transformations in React
- [ ] Log transformations for debugging

---

## Performance Tips

1. **Memoize in React**
   ```javascript
   const aiConfig = useMemo(
     () => createAIConfiguration(settings),
     [settings]
   );
   ```

2. **Incremental Updates**
   ```javascript
   // Only transform what changed
   setAiConfig(prev => ({
     ...prev,
     dailyLimits: transformDailyLimits(newLimits)
   }));
   ```

3. **Validate Only in Dev**
   ```javascript
   if (process.env.NODE_ENV === 'development') {
     validateAIConfiguration(aiConfig);
   }
   ```

---

## Testing

### Run All Examples

```javascript
import { runAllExamples } from './ai/adapters';
runAllExamples();
```

### Individual Tests

```javascript
import {
  exampleStaffGroupsTransformation,
  exampleDailyLimitsTransformation
} from './ai/adapters';

exampleStaffGroupsTransformation();
exampleDailyLimitsTransformation();
```

---

## Default Config

```javascript
import { DEFAULT_AI_CONFIG } from './ai/adapters';

// Use as fallback
const config = aiConfig || DEFAULT_AI_CONFIG;
```

---

## Documentation Links

- **API Reference**: `README.md`
- **Usage Examples**: `USAGE_EXAMPLES.md`
- **Architecture**: `ARCHITECTURE.md`
- **Test Suite**: `AIConfigAdapter.test.js`

---

## Support

For questions or issues:
1. Check `USAGE_EXAMPLES.md` for integration patterns
2. Review `ARCHITECTURE.md` for design details
3. Run `runAllExamples()` to see transformations in action
4. Enable logging: All functions log transformation metrics

---

**Last Updated:** October 19, 2025
**Version:** 1.0.0
