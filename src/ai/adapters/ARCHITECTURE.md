# AI Config Adapter Architecture

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────┘

[1] PostgreSQL Database (Supabase)
    ↓
    │ - staff_groups (JSONB: group_config)
    │ - daily_limits (JSONB: limit_config)
    │ - priority_rules (JSONB: rule_config)
    │ - ml_model_configs (JSONB: hyperparameters)
    │ - monthly_limits (JSONB: limit_config)
    ↓
[2] Go WebSocket Server
    ↓
    │ - Fetches from database
    │ - Sends to client via WebSocket
    │ - Format: snake_case JSON
    ↓
[3] React Client (useWebSocketSettings)
    ↓
    │ - Receives WebSocket message
    │ - Raw database format
    ↓
[4] AI Config Adapter ⭐ YOU ARE HERE
    ↓
    │ ┌─────────────────────────────────────┐
    │ │ createAIConfiguration()             │
    │ ├─────────────────────────────────────┤
    │ │ - transformStaffGroups()            │
    │ │ - transformDailyLimits()            │
    │ │ - transformMonthlyLimits()          │
    │ │ - transformPriorityRules()          │
    │ │ - transformMLConfig()               │
    │ └─────────────────────────────────────┘
    ↓
[5] AI System (Ready for Consumption)
    ├─→ ConstraintEngine (dailyLimits, monthlyLimits)
    ├─→ TensorFlowScheduler (mlConfig)
    ├─→ PriorityRuleEngine (priorityRules)
    ├─→ StaffGroupManager (staffGroups)
    └─→ OptimizationEngine (full aiConfig)
```

## Transformation Layers

### Layer 1: Data Source (PostgreSQL)

**Characteristics:**
- Snake_case column names
- JSONB columns for complex data
- Relational structure (multiple tables)
- Soft deletes (is_active flag)

**Example:**
```sql
CREATE TABLE staff_groups (
  id UUID PRIMARY KEY,
  name TEXT,
  restaurant_id UUID,
  group_config JSONB,  -- Nested configuration
  is_active BOOLEAN,
  created_at TIMESTAMP
);
```

### Layer 2: Transport (WebSocket)

**Characteristics:**
- JSON message format
- Real-time updates
- Typed messages (SYNC_REQUEST, SETTINGS_UPDATE)
- Minimal transformation (database → JSON)

**Example Message:**
```json
{
  "type": "SETTINGS_SYNC",
  "version": { "versionNumber": 1 },
  "data": {
    "staffGroups": [...],
    "dailyLimits": [...]
  }
}
```

### Layer 3: Adapter (This Module)

**Characteristics:**
- Pure functions (no side effects)
- Type conversion (snake_case → camelCase)
- JSONB field extraction
- Default value injection
- Validation

**Transformation Pipeline:**
```javascript
Input (DB)  →  Extract JSONB  →  Convert Keys  →  Apply Defaults  →  Output (AI)
```

### Layer 4: AI Consumption

**Characteristics:**
- CamelCase properties
- Flat object structures
- Type-specific formats (Map, Array, Object)
- Ready for algorithm consumption

## Component Responsibilities

### AIConfigAdapter.js (Main Module)

**Responsibilities:**
- Define transformation logic
- Handle edge cases (null, undefined, missing)
- Apply default configurations
- Log transformation metrics

**Functions:**
| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `transformStaffGroups` | Array | Map | ID-based lookup for groups |
| `transformDailyLimits` | Array | Array | Constraint engine format |
| `transformMonthlyLimits` | Array | Array | Monthly constraint format |
| `transformPriorityRules` | Array | Array | Sorted by priority |
| `transformMLConfig` | Array | Object | Hyperparameters object |
| `createAIConfiguration` | Object | Object | Unified transformation |
| `validateAIConfiguration` | Object | Result | Validation check |

### AIConfigAdapter.test.js (Examples)

**Responsibilities:**
- Provide transformation examples
- Document expected input/output
- Test edge cases
- Serve as documentation

**Examples:**
- Staff groups with coverage rules
- Daily limits with penalties
- Priority rules with conditions
- ML config with hyperparameters
- Complete configuration transformation
- Key transformation utilities

## Design Patterns

### 1. Adapter Pattern

```javascript
// Client code doesn't know about database format
const aiConfig = createAIConfiguration(dbSettings);

// Works with AI-compatible format
const engine = new ConstraintEngine(aiConfig.dailyLimits);
```

### 2. Default Object Pattern

```javascript
const DEFAULT_AI_CONFIG = {
  staffGroups: {},
  dailyLimits: [],
  priorityRules: [],
  mlConfig: { /* sensible defaults */ }
};

// Merge with defaults for missing values
return { ...DEFAULT_AI_CONFIG, ...transformed };
```

### 3. Null Object Pattern

```javascript
// Safe navigation with defaults
const members = group.group_config?.members || [];
const maxOff = config.maxStaff ?? config.max_staff ?? null;
```

### 4. Factory Pattern

```javascript
// Single entry point for creating AI config
export function createAIConfiguration(settings) {
  return {
    staffGroups: transformStaffGroups(settings.staffGroups),
    dailyLimits: transformDailyLimits(settings.dailyLimits),
    // ... other transformations
  };
}
```

## Type Conversions

### Naming Convention Conversion

```javascript
// Database (snake_case) → AI (camelCase)
{
  max_simultaneous_off: 1,     →  maxSimultaneousOff: 1,
  is_hard_constraint: true,    →  isHard: true,
  penalty_weight: 50,          →  penalty: 50,
  staff_id: "abc-123",         →  staffId: "abc-123",
  day_of_week: 0,              →  dayOfWeek: 0
}
```

### Structure Conversion

```javascript
// Database (flat JSONB) → AI (nested objects)
{
  group_config: {
    members: [...],
    max_simultaneous_off: 1,
    coverage_rule: {
      backup_staff: "staff-1"
    }
  }
}
↓
{
  members: [...],
  maxSimultaneousOff: 1,
  coverageRule: {
    backupStaff: "staff-1"
  }
}
```

### Collection Conversion

```javascript
// Database (Array) → AI (Map for groups, Array for others)
[
  { id: "g1", name: "Group 1", ... },
  { id: "g2", name: "Group 2", ... }
]
↓
{
  "g1": { id: "g1", name: "Group 1", ... },
  "g2": { id: "g2", name: "Group 2", ... }
}
```

## Error Handling Strategy

### Level 1: Field-Level Defaults

```javascript
const maxStaff = config.maxStaff ?? config.max_staff ?? null;
// ↑ Try camelCase → Try snake_case → Use null
```

### Level 2: Record-Level Catch

```javascript
.map(item => {
  try {
    return transformItem(item);
  } catch (error) {
    console.error('Failed to transform item:', error);
    return null;  // Skip this item
  }
})
.filter(Boolean);  // Remove nulls
```

### Level 3: Function-Level Fallback

```javascript
export function transformDailyLimits(dbLimits) {
  if (!dbLimits || !Array.isArray(dbLimits)) {
    console.warn('Invalid input, using defaults');
    return DEFAULT_AI_CONFIG.dailyLimits;
  }
  // ... transformation logic
}
```

### Level 4: Top-Level Recovery

```javascript
export function createAIConfiguration(settings) {
  try {
    // ... all transformations
  } catch (error) {
    console.error('Critical transformation error:', error);
    return DEFAULT_AI_CONFIG;  // Complete fallback
  }
}
```

## Performance Characteristics

### Time Complexity

| Function | Complexity | Reason |
|----------|-----------|--------|
| `transformStaffGroups` | O(n) | Single pass through array |
| `transformDailyLimits` | O(n) | Map + filter operations |
| `transformPriorityRules` | O(n log n) | Includes sorting |
| `transformMLConfig` | O(1) | Takes first config only |
| `createAIConfiguration` | O(n) | Sum of all transformations |

### Space Complexity

| Function | Complexity | Reason |
|----------|-----------|--------|
| All transforms | O(n) | Creates new objects, no mutation |

### Optimization Opportunities

1. **Memoization**: Cache transformation results
   ```javascript
   const memoized = useMemo(
     () => createAIConfiguration(settings),
     [settings]
   );
   ```

2. **Lazy Loading**: Transform only when needed
   ```javascript
   const aiConfig = {
     get staffGroups() {
       return transformStaffGroups(dbSettings.staffGroups);
     }
   };
   ```

3. **Incremental Updates**: Transform only changed parts
   ```javascript
   if (message.type === 'DAILY_LIMITS_UPDATE') {
     return { ...aiConfig, dailyLimits: transformDailyLimits(...) };
   }
   ```

## Testing Strategy

### Unit Tests
- Test each transformation function independently
- Test with valid input
- Test with null/undefined/invalid input
- Test with edge cases (empty arrays, missing fields)

### Integration Tests
- Test complete transformation pipeline
- Test with real database samples
- Test validation after transformation

### Example Test Cases

```javascript
describe('transformStaffGroups', () => {
  it('should transform valid staff groups', () => {
    const input = [{ id: 'g1', group_config: { members: ['s1'] } }];
    const output = transformStaffGroups(input);
    expect(output['g1'].members).toEqual(['s1']);
  });

  it('should handle null input', () => {
    const output = transformStaffGroups(null);
    expect(output).toEqual({});
  });

  it('should skip soft-deleted groups', () => {
    const input = [{ id: 'g1', is_active: false }];
    const output = transformStaffGroups(input);
    expect(Object.keys(output)).toHaveLength(0);
  });
});
```

## Version Compatibility

### Supporting Multiple Database Schema Versions

```javascript
// Handle both old and new field names
const maxStaff =
  config.maxStaff ??        // v2.0 (camelCase)
  config.max_staff ??       // v1.0 (snake_case)
  limit.max_count ??        // v1.5 (different field)
  null;                     // fallback
```

### Migration Path

```
v1.0 (snake_case)  →  Adapter supports both  →  v2.0 (camelCase)
                           ↓
                    Gradual migration
                    Both formats work
```

## Future Enhancements

1. **TypeScript Migration**
   - Add type definitions
   - Enable type checking
   - Generate documentation from types

2. **Schema Validation**
   - JSON Schema validation
   - Runtime type checking
   - Detailed error messages

3. **Reverse Transformation**
   - AI format → Database format
   - For saving modified configs
   - Bidirectional sync

4. **Performance Monitoring**
   - Track transformation times
   - Identify bottlenecks
   - Optimize hot paths

5. **Caching Layer**
   - Cache transformed results
   - Invalidate on updates
   - Reduce redundant transformations
