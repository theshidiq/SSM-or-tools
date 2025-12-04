# Daily Limits → AI Generator Integration Plan

## Executive Summary

This document outlines the comprehensive integration plan for connecting the **Daily Limits** settings (stored in Supabase database) with the **AI Schedule Generator**. The integration follows the established 5-layer architecture pattern used by Staff Groups, Weekly Limits, and Priority Rules.

**Current State**: Daily Limits are stored in database and synced via WebSocket to React UI, but NOT yet consumed by the AI Generator.

**Target State**: AI Generator uses real-time Daily Limits from database for constraint validation during schedule generation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current Daily Limits Data Flow](#2-current-daily-limits-data-flow)
3. [AI Generator Architecture](#3-ai-generator-architecture)
4. [Integration Points](#4-integration-points)
5. [Implementation Plan](#5-implementation-plan)
6. [File Changes Required](#6-file-changes-required)
7. [Testing Strategy](#7-testing-strategy)
8. [Risk Assessment](#8-risk-assessment)

---

## 1. Architecture Overview

### 1.1 The 5-Layer Integration Pattern

All settings follow this established pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATABASE (Supabase PostgreSQL)                        │
│ Table: daily_limits                                            │
│ Fields: limit_config (JSONB), is_active, version_id           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP REST API
┌────────────────────────▼────────────────────────────────────────┐
│ LAYER 2: GO SERVER (settings_multitable.go)                   │
│ - fetchDailyLimits(versionID) ✅ IMPLEMENTED                   │
│ - MarshalJSON includes dailyLimits ✅ IMPLEMENTED              │
│ - upsertDailyLimits() ✅ IMPLEMENTED                           │
└────────────────────────┬────────────────────────────────────────┘
                         │ WebSocket SETTINGS_SYNC_RESPONSE
┌────────────────────────▼────────────────────────────────────────┐
│ LAYER 3: WEBSOCKET HOOK (useWebSocketSettings.js)             │
│ - Receives dailyLimits in settings ✅ IMPLEMENTED              │
│ - updateDailyLimits() function ✅ IMPLEMENTED                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Context Provider
┌────────────────────────▼────────────────────────────────────────┐
│ LAYER 4: SETTINGS CONTEXT (useSettingsData.js)                │
│ - settings.dailyLimits ✅ IMPLEMENTED                          │
│ - updateSettings() syncs dailyLimits ✅ IMPLEMENTED            │
└────────────────────────┬────────────────────────────────────────┘
                         │ AI Settings Hook
┌────────────────────────▼────────────────────────────────────────┐
│ LAYER 5: AI LAYER (useAISettings.js)                          │
│ - dailyLimits extraction ⚠️ NEEDS ENHANCEMENT                  │
│ - Transform to AI format ⚠️ NEEDS ENHANCEMENT                  │
│ - Provide to ConstraintEngine ❌ NOT IMPLEMENTED               │
└────────────────────────┬────────────────────────────────────────┘
                         │ Constraint Validation
┌────────────────────────▼────────────────────────────────────────┐
│ AI GENERATOR CONSUMPTION                                       │
│ - ConstraintEngine.js ❌ Uses STATIC_DAILY_LIMITS              │
│ - CSPSolver.js ❌ Uses hardcoded values                        │
│ - BusinessRuleValidator.js ❌ No daily limits integration      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Table | ✅ Complete | `daily_limits` with JSONB `limit_config` |
| Go Server Fetch | ✅ Complete | `fetchDailyLimits()` in settings_multitable.go |
| Go Server Upsert | ✅ Complete | `upsertDailyLimits()` with UPDATE/INSERT strategy |
| MarshalJSON | ✅ Complete | Includes `dailyLimits` in response |
| WebSocket Sync | ✅ Complete | SETTINGS_SYNC_RESPONSE includes dailyLimits |
| React UI Display | ✅ Complete | LimitsTab.jsx shows sliders |
| useAISettings | ⚠️ Partial | Has dailyLimits but uses static fallback |
| ConstraintEngine | ❌ Missing | Uses STATIC_DAILY_LIMITS constant |
| CSPSolver | ❌ Missing | Hardcoded limit values |
| BusinessRuleValidator | ❌ Missing | No dynamic daily limits |

---

## 2. Current Daily Limits Data Flow

### 2.1 Database Schema

**Table**: `daily_limits`
**Location**: `database/migrations/schema/005_create_business_rules.sql`

```sql
CREATE TABLE daily_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    version_id UUID NOT NULL REFERENCES config_versions(id),
    name VARCHAR(255) NOT NULL,
    limit_config JSONB NOT NULL,  -- All limit values stored here
    penalty_weight DECIMAL(5,2) DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, version_id, name)
);
```

**limit_config JSONB Structure**:
```json
{
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
}
```

### 2.2 Go Server Integration

**File**: `go-server/settings_multitable.go`

#### fetchDailyLimits() (Lines 691-744)
```go
func (s *StaffSyncServer) fetchDailyLimits(versionID string) (map[string]interface{}, error) {
    url := fmt.Sprintf("%s/rest/v1/daily_limits?version_id=eq.%s&is_active=eq.true&select=limit_config",
        s.supabaseURL, versionID)

    // ... HTTP request to Supabase ...

    if len(results) > 0 {
        if limitConfig, ok := results[0]["limit_config"].(map[string]interface{}); ok {
            return limitConfig, nil  // Returns JSONB directly
        }
    }

    // Return defaults if not found
    return map[string]interface{}{
        "minOffPerDay": 0, "maxOffPerDay": 3,
        "minEarlyPerDay": 0, "maxEarlyPerDay": 2,
        "minLatePerDay": 0, "maxLatePerDay": 3,
        "minWorkingStaffPerDay": 3,
    }, nil
}
```

#### MarshalJSON (Line 97)
```go
response := map[string]interface{}{
    "staffGroups":       reactGroups,
    "weeklyLimits":      reactWeeklyLimits,
    "monthlyLimits":     reactMonthlyLimits,
    "dailyLimits":       sa.DailyLimits,  // ✅ Included in response
    "priorityRules":     reactPriorityRules,
    // ...
}
```

### 2.3 React Data Flow

**useSettingsData.js** (Line 195-196):
```javascript
dailyLimits: wsSettings?.dailyLimits ?? settingsRef.current?.dailyLimits ?? {
    minOffPerDay: 0, maxOffPerDay: 3,
    minEarlyPerDay: 0, maxEarlyPerDay: 2,
    minLatePerDay: 0, maxLatePerDay: 3,
    minWorkingStaffPerDay: 3
}
```

---

## 3. AI Generator Architecture

### 3.1 Key AI Components

| Component | File | Purpose |
|-----------|------|---------|
| ScheduleGenerator | `src/ai/core/ScheduleGenerator.js` | Main orchestrator |
| CSPSolver | `src/ai/algorithms/CSPSolver.js` | Constraint satisfaction solver |
| ConstraintEngine | `src/ai/constraints/ConstraintEngine.js` | Constraint validation |
| BusinessRuleValidator | `src/ai/hybrid/BusinessRuleValidator.js` | Runtime rule checking |
| ConstraintPriorityManager | `src/ai/core/ConstraintPriorityManager.js` | Constraint hierarchy |
| AIConfigAdapter | `src/ai/adapters/AIConfigAdapter.js` | Format transformation |

### 3.2 Current Daily Limits in AI (STATIC)

**ConstraintEngine.js** (Lines 248-256):
```javascript
// ❌ PROBLEM: These are STATIC, not from database!
const STATIC_DAILY_LIMITS = {
    minOffPerDay: 0,
    maxOffPerDay: 4,          // Hardcoded!
    minEarlyPerDay: 0,
    maxEarlyPerDay: 4,        // Hardcoded!
    minLatePerDay: 0,
    maxLatePerDay: 3,         // Hardcoded!
    minWorkingStaffPerDay: 3,
};
```

### 3.3 Constraint Weights

**ScheduleGenerator.js** (Lines 138-147):
```javascript
constraintWeights: {
    staffGroups: 0.25,
    weeklyLimits: 0.2,
    dailyLimits: 0.2,        // ← Weight exists but uses static values!
    priorityRules: 0.15,
    monthlyLimits: 0.15,
    fairness: 0.05,
}
```

### 3.4 Validation Functions

**ConstraintEngine.js** - `validateDailyLimits()` (Lines 536-720):
- Validates per-day counts for off, early, late shifts
- Currently uses `STATIC_DAILY_LIMITS` constant
- Needs to receive dynamic limits from database

---

## 4. Integration Points

### 4.1 Data Sources (Where Daily Limits Come From)

| Source | Current Usage | Target Usage |
|--------|--------------|--------------|
| Database (Supabase) | ✅ Stored | ✅ Primary source |
| Go Server | ✅ Fetched & sent | ✅ Pass-through |
| WebSocket | ✅ Synced to React | ✅ Pass-through |
| useSettingsData | ✅ Available | ✅ Pass-through |
| useAISettings | ⚠️ Partial | ✅ Transform for AI |
| ConfigurationService | ❌ Not used | ⚠️ Cache layer (optional) |
| ConstraintEngine | ❌ Static values | ✅ Dynamic from database |

### 4.2 Consumer Components (Where Daily Limits Are Used)

| Component | Method | Current State | Required Change |
|-----------|--------|---------------|-----------------|
| ConstraintEngine | `validateDailyLimits()` | Static | Dynamic |
| ConstraintEngine | `getDailyLimits()` | Returns static | Return from context |
| CSPSolver | `checkDailyLimits()` | Hardcoded | Pass from settings |
| BusinessRuleValidator | `canAssignOffDay()` | No limits check | Add limits validation |
| ScheduleGenerator | Initialization | No limits passed | Pass from useAISettings |
| HybridPredictor | Generation | No limits | Receive via settingsProvider |

### 4.3 Integration Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI SCHEDULE GENERATION                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ useAIAssistant.autoFillSchedule()                               │
│ - Get dailyLimits from useAISettings()  ← NEW                   │
│ - Pass to HybridPredictor                                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ HybridPredictor.initialize()                                    │
│ - Receive dailyLimits in settingsProvider  ← NEW                │
│ - Pass to BusinessRuleValidator                                 │
│ - Pass to ScheduleGenerator                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ BusinessRule    │ │ ConstraintEngine│ │ CSPSolver       │
│ Validator       │ │                 │ │                 │
│ - Use limits    │ │ - validateDaily │ │ - checkDaily    │
│   in validation │ │   Limits()      │ │   Limits()      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 5. Implementation Plan

### Phase 1: Enhance useAISettings Hook (Priority: HIGH)

**File**: `src/hooks/useAISettings.js`

**Current** (Line ~75):
```javascript
const dailyLimits = useMemo(() => {
    // Currently returns static defaults or partial data
    return settings?.dailyLimits || STATIC_DAILY_LIMITS;
}, [settings?.dailyLimits]);
```

**Target**:
```javascript
const dailyLimits = useMemo(() => {
    const dbLimits = settings?.dailyLimits;

    if (!dbLimits) {
        console.warn('[useAISettings] No dailyLimits from database, using defaults');
        return {
            minOffPerDay: 0,
            maxOffPerDay: 3,
            minEarlyPerDay: 0,
            maxEarlyPerDay: 2,
            minLatePerDay: 0,
            maxLatePerDay: 3,
            minWorkingStaffPerDay: 3,
            _source: 'default'
        };
    }

    return {
        minOffPerDay: dbLimits.minOffPerDay ?? 0,
        maxOffPerDay: dbLimits.maxOffPerDay ?? 3,
        minEarlyPerDay: dbLimits.minEarlyPerDay ?? 0,
        maxEarlyPerDay: dbLimits.maxEarlyPerDay ?? 2,
        minLatePerDay: dbLimits.minLatePerDay ?? 0,
        maxLatePerDay: dbLimits.maxLatePerDay ?? 3,
        minWorkingStaffPerDay: dbLimits.minWorkingStaffPerDay ?? 3,
        _source: 'database'
    };
}, [settings?.dailyLimits]);
```

---

### Phase 2: Update ConstraintEngine (Priority: HIGH)

**File**: `src/ai/constraints/ConstraintEngine.js`

#### 2.1 Remove Static Constant

**Current** (Lines 248-256):
```javascript
const STATIC_DAILY_LIMITS = {
    minOffPerDay: 0,
    maxOffPerDay: 4,
    // ... hardcoded values
};
```

**Target**: Remove or deprecate this constant.

#### 2.2 Add Dynamic Limits Support

**Current** `getDailyLimits()` (Lines 296-298):
```javascript
export const getDailyLimits = async () => {
    return await getCachedConfig("daily_limits");
};
```

**Target**: Integrate with real-time settings
```javascript
// Store instance-level daily limits
let _dynamicDailyLimits = null;

export const setDailyLimits = (limits) => {
    _dynamicDailyLimits = limits;
    console.log('[ConstraintEngine] Daily limits updated:', limits);
};

export const getDailyLimits = () => {
    if (_dynamicDailyLimits) {
        return _dynamicDailyLimits;
    }

    // Fallback to cached config or defaults
    const cached = getCachedConfigSync("daily_limits");
    return cached || {
        minOffPerDay: 0,
        maxOffPerDay: 3,
        minEarlyPerDay: 0,
        maxEarlyPerDay: 2,
        minLatePerDay: 0,
        maxLatePerDay: 3,
        minWorkingStaffPerDay: 3,
    };
};
```

#### 2.3 Update validateDailyLimits()

**Current** (Line 540):
```javascript
export const validateDailyLimits = (scheduleData, dateKey, staffMembers) => {
    const limits = STATIC_DAILY_LIMITS;  // ❌ Static!
    // ...
};
```

**Target**:
```javascript
export const validateDailyLimits = (scheduleData, dateKey, staffMembers, customLimits = null) => {
    const limits = customLimits || getDailyLimits();  // ✅ Dynamic!

    const violations = [];

    // Count shifts for this day
    const offCount = countShiftsForDay(scheduleData, dateKey, '×', staffMembers);
    const earlyCount = countShiftsForDay(scheduleData, dateKey, '△', staffMembers);
    const lateCount = countShiftsForDay(scheduleData, dateKey, '◇', staffMembers);
    const workingCount = staffMembers.length - offCount;

    // Validate MIN constraints (NEW!)
    if (offCount < limits.minOffPerDay) {
        violations.push({
            type: VIOLATION_TYPES.DAILY_OFF_LIMIT,
            severity: 'warning',
            message: `Day ${dateKey}: ${offCount} staff off, minimum required is ${limits.minOffPerDay}`,
            constraint: 'minOffPerDay',
            current: offCount,
            limit: limits.minOffPerDay
        });
    }

    // Validate MAX constraints (existing)
    if (offCount > limits.maxOffPerDay) {
        violations.push({
            type: VIOLATION_TYPES.DAILY_OFF_LIMIT,
            severity: 'high',
            message: `Day ${dateKey}: ${offCount} staff off exceeds maximum of ${limits.maxOffPerDay}`,
            constraint: 'maxOffPerDay',
            current: offCount,
            limit: limits.maxOffPerDay
        });
    }

    // Similar for early, late, and working staff...

    return violations;
};
```

---

### Phase 3: Update CSPSolver (Priority: MEDIUM)

**File**: `src/ai/algorithms/CSPSolver.js`

#### 3.1 Add Limits Parameter

**Current** `checkDailyLimits()` (Lines 608-639):
```javascript
checkDailyLimits(date) {
    const maxOff = 4;  // ❌ Hardcoded!
    // ...
}
```

**Target**:
```javascript
constructor(options = {}) {
    // ...
    this.dailyLimits = options.dailyLimits || {
        minOffPerDay: 0, maxOffPerDay: 3,
        minEarlyPerDay: 0, maxEarlyPerDay: 2,
        minLatePerDay: 0, maxLatePerDay: 3,
        minWorkingStaffPerDay: 3
    };
}

checkDailyLimits(date) {
    const limits = this.dailyLimits;  // ✅ From constructor

    const offCount = this.countAssignments(date, '×');
    const earlyCount = this.countAssignments(date, '△');
    const lateCount = this.countAssignments(date, '◇');

    // Check MAX constraints
    if (offCount > limits.maxOffPerDay) return false;
    if (earlyCount > limits.maxEarlyPerDay) return false;
    if (lateCount > limits.maxLatePerDay) return false;

    // Check MIN constraints (soft - used for scoring)
    // MIN constraints are typically not hard blockers in CSP

    return true;
}
```

---

### Phase 4: Update BusinessRuleValidator (Priority: MEDIUM)

**File**: `src/ai/hybrid/BusinessRuleValidator.js`

#### 4.1 Add Daily Limits to Constructor

**Current**:
```javascript
constructor(settingsProvider) {
    this.settingsProvider = settingsProvider;
    // No daily limits
}
```

**Target**:
```javascript
constructor(settingsProvider) {
    this.settingsProvider = settingsProvider;
    this.dailyLimits = settingsProvider?.dailyLimits || {
        minOffPerDay: 0, maxOffPerDay: 3,
        minEarlyPerDay: 0, maxEarlyPerDay: 2,
        minLatePerDay: 0, maxLatePerDay: 3,
        minWorkingStaffPerDay: 3
    };
}

canAssignShift(staffId, date, shiftType, currentSchedule) {
    const daySchedule = this.getScheduleForDate(currentSchedule, date);
    const counts = this.countShiftTypes(daySchedule);

    if (shiftType === '×' && counts.off >= this.dailyLimits.maxOffPerDay) {
        return { allowed: false, reason: 'Max off days reached for this date' };
    }
    if (shiftType === '△' && counts.early >= this.dailyLimits.maxEarlyPerDay) {
        return { allowed: false, reason: 'Max early shifts reached for this date' };
    }
    if (shiftType === '◇' && counts.late >= this.dailyLimits.maxLatePerDay) {
        return { allowed: false, reason: 'Max late shifts reached for this date' };
    }

    return { allowed: true };
}
```

---

### Phase 5: Update HybridPredictor (Priority: HIGH)

**File**: `src/ai/hybrid/HybridPredictor.js`

#### 5.1 Pass Daily Limits Through

**Current** `initialize()`:
```javascript
async initialize(settingsProvider) {
    this.businessRuleValidator = new BusinessRuleValidator(settingsProvider);
    // No dailyLimits passed
}
```

**Target**:
```javascript
async initialize(settingsProvider) {
    // Extract dailyLimits from settingsProvider
    const dailyLimits = settingsProvider?.dailyLimits || await getDailyLimits();

    // Pass to components
    this.businessRuleValidator = new BusinessRuleValidator({
        ...settingsProvider,
        dailyLimits
    });

    this.cspSolver = new CSPSolver({
        dailyLimits,
        staffMembers: settingsProvider.staffMembers
    });

    // Set in ConstraintEngine for validation
    setDailyLimits(dailyLimits);

    console.log('[HybridPredictor] Initialized with dailyLimits:', dailyLimits);
}
```

---

### Phase 6: Update useAIAssistant Hook (Priority: HIGH)

**File**: `src/hooks/useAIAssistant.js`

#### 6.1 Pass Daily Limits to AI Generation

**Current** `autoFillSchedule()` (Line ~512):
```javascript
const autoFillSchedule = async (options = {}) => {
    // Refresh configurations
    await constraintEngine.refreshAllConfigurations();

    // Prepare data - NO dailyLimits passed!
    const processingData = {
        staffMembers,
        dateRange,
        existingSchedule,
        // Missing: dailyLimits
    };
};
```

**Target**:
```javascript
const autoFillSchedule = async (options = {}) => {
    // Get daily limits from useAISettings
    const { dailyLimits } = useAISettings();

    // Refresh configurations with new limits
    await constraintEngine.refreshAllConfigurations();
    setDailyLimits(dailyLimits);  // Update ConstraintEngine

    // Prepare data WITH dailyLimits
    const processingData = {
        staffMembers,
        dateRange,
        existingSchedule,
        dailyLimits,  // ✅ Now included!
        strictRuleEnforcement: true,
    };

    // Pass to HybridPredictor
    const result = await hybridPredictor.predictSchedule(processingData);
};
```

---

## 6. File Changes Required

### 6.1 Summary of Changes

| File | Type | Priority | Effort |
|------|------|----------|--------|
| `src/hooks/useAISettings.js` | Modify | HIGH | Low |
| `src/ai/constraints/ConstraintEngine.js` | Modify | HIGH | Medium |
| `src/ai/algorithms/CSPSolver.js` | Modify | MEDIUM | Low |
| `src/ai/hybrid/BusinessRuleValidator.js` | Modify | MEDIUM | Medium |
| `src/ai/hybrid/HybridPredictor.js` | Modify | HIGH | Low |
| `src/hooks/useAIAssistant.js` | Modify | HIGH | Low |
| `src/ai/core/ScheduleGenerator.js` | Modify | LOW | Low |
| `src/ai/adapters/AIConfigAdapter.js` | Optional | LOW | Low |

### 6.2 Detailed File Changes

#### useAISettings.js
- [ ] Enhance `dailyLimits` useMemo to properly extract from settings
- [ ] Add `_source` field to track data origin (database vs default)
- [ ] Add validation for limit values (min <= max)

#### ConstraintEngine.js
- [ ] Add `setDailyLimits()` function to update runtime limits
- [ ] Modify `getDailyLimits()` to return dynamic values
- [ ] Update `validateDailyLimits()` to accept custom limits parameter
- [ ] Add MIN constraint validation (currently only MAX is validated)
- [ ] Remove or deprecate `STATIC_DAILY_LIMITS` constant

#### CSPSolver.js
- [ ] Add `dailyLimits` to constructor options
- [ ] Update `checkDailyLimits()` to use instance limits
- [ ] Add MIN constraint consideration in scoring

#### BusinessRuleValidator.js
- [ ] Add `dailyLimits` property from settingsProvider
- [ ] Implement `canAssignShift()` with limit checks
- [ ] Add `validateDailyLimitsForDate()` method

#### HybridPredictor.js
- [ ] Extract dailyLimits from settingsProvider in `initialize()`
- [ ] Pass dailyLimits to BusinessRuleValidator
- [ ] Pass dailyLimits to CSPSolver
- [ ] Call `setDailyLimits()` to update ConstraintEngine

#### useAIAssistant.js
- [ ] Get dailyLimits from useAISettings()
- [ ] Pass dailyLimits to processingData
- [ ] Update ConstraintEngine before generation

---

## 7. Testing Strategy

### 7.1 Unit Tests

```javascript
// Test: ConstraintEngine uses dynamic limits
describe('ConstraintEngine.validateDailyLimits', () => {
    it('should use database limits when provided', () => {
        setDailyLimits({ maxOffPerDay: 2 });
        const violations = validateDailyLimits(scheduleWith3Off, '2024-01-15', staff);
        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('DAILY_OFF_LIMIT');
    });

    it('should validate MIN constraints', () => {
        setDailyLimits({ minOffPerDay: 2 });
        const violations = validateDailyLimits(scheduleWith1Off, '2024-01-15', staff);
        expect(violations[0].constraint).toBe('minOffPerDay');
    });
});
```

### 7.2 Integration Tests

```javascript
// Test: End-to-end daily limits flow
describe('Daily Limits Integration', () => {
    it('should flow from database to AI generator', async () => {
        // 1. Set limits in database
        await upsertDailyLimits(versionId, { maxOffPerDay: 2 });

        // 2. Verify WebSocket sync
        const wsSettings = await waitForWebSocketSync();
        expect(wsSettings.dailyLimits.maxOffPerDay).toBe(2);

        // 3. Verify AI receives limits
        const aiSettings = renderHook(() => useAISettings());
        expect(aiSettings.dailyLimits.maxOffPerDay).toBe(2);

        // 4. Verify generation respects limits
        const schedule = await generateSchedule();
        const maxOffAnyDay = getMaxOffPerDay(schedule);
        expect(maxOffAnyDay).toBeLessThanOrEqual(2);
    });
});
```

### 7.3 E2E Tests (Chrome MCP)

1. **UI → Database → AI Flow**
   - Change daily limit in UI (slider)
   - Save and verify database update
   - Generate schedule
   - Verify schedule respects new limit

2. **Multi-User Sync**
   - User A changes limit
   - Verify User B receives WebSocket update
   - Both generate schedules
   - Both schedules respect same limit

---

## 8. Risk Assessment

### 8.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing AI generation | Medium | High | Comprehensive tests, feature flag |
| Performance degradation | Low | Medium | Cache limits, minimize lookups |
| Race conditions in limit updates | Low | Medium | Use WebSocket version control |
| Backward compatibility | Medium | Medium | Fallback to defaults if undefined |

### 8.2 Rollback Plan

If issues occur after deployment:

1. **Feature Flag**: Add `ENABLE_DYNAMIC_DAILY_LIMITS` environment variable
2. **Fallback**: Keep `STATIC_DAILY_LIMITS` as fallback
3. **Version Check**: Compare settings version before applying
4. **Monitoring**: Log when dynamic vs static limits are used

---

## Appendix A: Related Files Reference

### Database
- `database/migrations/schema/005_create_business_rules.sql` - Table definition

### Go Server
- `go-server/settings_multitable.go:691-744` - fetchDailyLimits()
- `go-server/settings_multitable.go:1468-1592` - upsertDailyLimits()
- `go-server/settings_multitable.go:97` - MarshalJSON inclusion

### React Hooks
- `src/hooks/useSettingsData.js:195-196` - Daily limits sync
- `src/hooks/useWebSocketSettings.js` - WebSocket communication
- `src/hooks/useAISettings.js` - AI settings extraction
- `src/hooks/useAIAssistant.js` - AI generation orchestration

### AI Components
- `src/ai/constraints/ConstraintEngine.js:248-256` - STATIC_DAILY_LIMITS
- `src/ai/constraints/ConstraintEngine.js:536-720` - validateDailyLimits()
- `src/ai/algorithms/CSPSolver.js:608-639` - checkDailyLimits()
- `src/ai/hybrid/BusinessRuleValidator.js` - Runtime validation
- `src/ai/hybrid/HybridPredictor.js` - AI orchestration

### UI Components
- `src/components/settings/tabs/LimitsTab.jsx:57-325` - DailyLimitsSection

---

## Appendix B: Message Formats

### WebSocket: SETTINGS_SYNC_RESPONSE
```json
{
    "type": "SETTINGS_SYNC_RESPONSE",
    "payload": {
        "settings": {
            "staffGroups": [...],
            "weeklyLimits": [...],
            "monthlyLimits": [...],
            "dailyLimits": {
                "minOffPerDay": 0,
                "maxOffPerDay": 3,
                "minEarlyPerDay": 0,
                "maxEarlyPerDay": 2,
                "minLatePerDay": 0,
                "maxLatePerDay": 3,
                "minWorkingStaffPerDay": 3
            },
            "priorityRules": [...]
        },
        "version": {...}
    }
}
```

### WebSocket: SETTINGS_UPDATE_DAILY_LIMITS
```json
{
    "type": "SETTINGS_UPDATE_DAILY_LIMITS",
    "payload": {
        "limit": {
            "minOffPerDay": 2,
            "maxOffPerDay": 3,
            "minEarlyPerDay": 0,
            "maxEarlyPerDay": 2,
            "minLatePerDay": 0,
            "maxLatePerDay": 3,
            "minWorkingStaffPerDay": 3
        }
    }
}
```

---

*Document created: 2024-12-04*
*Last updated: 2024-12-04*
*Author: Claude Code Integration Analysis*
