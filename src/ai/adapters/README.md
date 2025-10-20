# AI Configuration Data Adapter

**Phase 2: Database Settings → AI Configuration Transformation**

## Overview

The AI Configuration Data Adapter (`AIConfigAdapter.js`) transforms database settings from PostgreSQL (snake_case, JSONB fields) into AI-compatible configuration objects (camelCase, nested structures).

## Purpose

The Go WebSocket server sends settings data in **database format** (snake_case with JSONB), but the AI system expects **JavaScript format** (camelCase with nested objects). This adapter bridges the gap.

```
Database (PostgreSQL)         →  Adapter  →  AI System (JavaScript)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
snake_case fields                            camelCase properties
JSONB columns                                Native JS objects
Flat structures                              Nested configurations
Array of records                             Maps/Arrays for AI
```

## Main Functions

### 1. `transformStaffGroups(dbStaffGroups)`

Transforms staff groups from database format to AI Map structure.

**Input (Database):**
```javascript
[
  {
    id: "group-uuid-1",
    name: "Group 1",
    group_config: {
      members: ["staff-id-1", "staff-id-2"],
      max_simultaneous_off: 1
    },
    is_active: true
  }
]
```

**Output (AI):**
```javascript
{
  "group-uuid-1": {
    id: "group-uuid-1",
    name: "Group 1",
    members: ["staff-id-1", "staff-id-2"],
    maxSimultaneousOff: 1,
    active: true
  }
}
```

### 2. `transformDailyLimits(dbDailyLimits)`

Transforms daily limits from database to ConstraintEngine format.

**Input (Database):**
```javascript
[
  {
    id: "limit-1",
    name: "Maximum Off Days",
    limit_config: {
      type: "max_off_days",
      max_staff: 4,
      penalty_weight: 50
    },
    is_hard_constraint: true
  }
]
```

**Output (AI):**
```javascript
[
  {
    id: "limit-1",
    name: "Maximum Off Days",
    type: "max_off_days",
    maxStaff: 4,
    penalty: 50,
    isHard: true
  }
]
```

### 3. `transformPriorityRules(dbPriorityRules)`

Transforms priority rules with conditions and actions.

**Input (Database):**
```javascript
[
  {
    id: "rule-1",
    priority: 10,
    rule_config: {
      conditions: { staff_id: "chef-1", day_of_week: 0 },
      actions: { assign_shift: "early" }
    }
  }
]
```

**Output (AI):**
```javascript
[
  {
    id: "rule-1",
    priority: 10,
    conditions: { staffId: "chef-1", dayOfWeek: 0 },
    actions: { assignShift: "early" }
  }
]
```

### 4. `transformMLConfig(dbMLConfigs)`

Transforms ML model hyperparameters.

**Input (Database):**
```javascript
[
  {
    model_type: "neural_network",
    hyperparameters: {
      learning_rate: 0.001,
      batch_size: 32,
      epochs: 100
    },
    training_config: {
      validation_split: 0.2
    }
  }
]
```

**Output (AI):**
```javascript
{
  modelType: "neural_network",
  learningRate: 0.001,
  batchSize: 32,
  epochs: 100,
  validationSplit: 0.2
}
```

### 5. `createAIConfiguration(settings)`

**Main entry point** - transforms entire settings object.

**Input:** WebSocket message with all settings
**Output:** Unified AI configuration object

```javascript
const aiConfig = createAIConfiguration(websocketSettings);
// aiConfig = {
//   staffGroups: { ... },
//   dailyLimits: [ ... ],
//   priorityRules: [ ... ],
//   mlConfig: { ... },
//   version: { ... }
// }
```

## Utility Functions

### Key Transformation

```javascript
// Convert naming conventions
camelToSnake('learningRate')        // → 'learning_rate'
snakeToCamel('max_count')          // → 'maxCount'

// Deep object transformation
transformKeysToCamel({
  staff_id: 'staff-1',
  max_count: 5,
  nested_config: {
    learning_rate: 0.001
  }
})
// → {
//   staffId: 'staff-1',
//   maxCount: 5,
//   nestedConfig: {
//     learningRate: 0.001
//   }
// }
```

## Handling Edge Cases

### Missing/Null Values
```javascript
// Uses default values
const config = transformMLConfig([]);
// → Returns DEFAULT_AI_CONFIG.mlConfig
```

### Nested JSONB Extraction
```javascript
// Safely extracts from PostgreSQL JSONB
const groupConfig = group.group_config || {};
const members = groupConfig.members || [];
```

### Version Compatibility
```javascript
// Handles both snake_case and camelCase
maxStaff: config.maxStaff ?? config.max_staff ?? null
```

### Soft-Deleted Records
```javascript
// Filters out inactive records
.filter(item => item.is_active !== false)
```

## Usage Example

```javascript
import { createAIConfiguration } from './ai/adapters';

// In your WebSocket settings hook
const { settings: wsSettings } = useWebSocketSettings();

// Transform for AI consumption
const aiConfig = createAIConfiguration(wsSettings);

// Pass to AI system
const constraintEngine = new ConstraintEngine(aiConfig.dailyLimits);
const mlEngine = new MLEngine(aiConfig.mlConfig);
```

## Integration Points

### 1. WebSocket Settings Hook
```javascript
// src/hooks/useWebSocketSettings.js
import { createAIConfiguration } from '../ai/adapters';

const transformedConfig = createAIConfiguration(settings);
```

### 2. Constraint Engine
```javascript
// src/ai/constraints/ConstraintEngine.js
import { transformDailyLimits } from '../adapters';

const limits = transformDailyLimits(dbLimits);
```

### 3. ML Model Training
```javascript
// src/ai/ml/TensorFlowScheduler.js
import { transformMLConfig } from '../adapters';

const config = transformMLConfig(dbMLConfigs);
```

## Validation

```javascript
import { validateAIConfiguration } from './ai/adapters';

const validation = validateAIConfiguration(aiConfig);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## Testing

Run transformation examples:

```javascript
import { runAllExamples } from './ai/adapters';

runAllExamples();
// Outputs transformation examples for all functions
```

## Performance

- **Fast transformations**: O(n) complexity
- **Lazy evaluation**: Only transforms when needed
- **Memoization-friendly**: Pure functions, deterministic output
- **Memory efficient**: No unnecessary object cloning

## Error Handling

```javascript
try {
  const aiConfig = createAIConfiguration(settings);
} catch (error) {
  console.error('Transformation failed:', error);
  // Returns DEFAULT_AI_CONFIG on errors
}
```

## Future Enhancements

1. **Schema validation** using JSON Schema
2. **Type definitions** using TypeScript/JSDoc
3. **Transformation caching** for frequently accessed configs
4. **Incremental updates** for real-time sync
5. **Reverse transformation** for database writes

## Related Files

- `src/hooks/useWebSocketSettings.js` - WebSocket integration
- `src/ai/constraints/ConstraintEngine.js` - Constraint validation
- `src/ai/ml/TensorFlowScheduler.js` - ML training
- `src/services/ConfigurationService.js` - Settings management

## License

Part of the Shift Schedule Manager application.
