# Priority Rules Architecture Analysis

**Date:** 2025-11-27
**Purpose:** Comprehensive analysis of priority rules architecture for adding "allow certain shifts" functionality

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Data Flow: UI → Database → AI](#data-flow-ui--database--ai)
3. [Database Schema](#database-schema)
4. [UI Components](#ui-components)
5. [AI Integration](#ai-integration)
6. [Extension Points for New Functionality](#extension-points-for-new-functionality)
7. [Implementation Plan](#implementation-plan)

---

## 1. Current Architecture Overview

### 1.1 Current Rule Types

The system supports **3 rule types**:

| Rule Type | ID | Icon | Description | AI Behavior |
|-----------|-----|------|-------------|-------------|
| **Preferred Shift** | `preferred_shift` | ⭐ | Staff member prefers specific shifts on certain days | **Sets** the preferred shift (overrides ML) |
| **Avoid Shift** | `avoid_shift` | ❌ | Staff member wants to avoid specific shifts on certain days | **Clears** the avoided shift if ML assigned it |
| **Required Off** | `required_off` | 🏠 | Staff member must be off on specific days | **Sets** off day (× symbol) |

### 1.2 Current Shift Types

The system supports **3 shift types**:

| Shift Type | ID | Icon | Symbol | Description |
|------------|-----|------|---------|-------------|
| **Early Shift** | `early` | 🌅 | △ | Morning/opening shift |
| **Late Shift** | `late` | 🌙 | ◇ | Evening/closing shift |
| **Off Day** | `off` | 🏠 | × | Day off/休み |

### 1.3 Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                │
│  PriorityRulesTab.jsx                                          │
│  - Rule creation/editing                                        │
│  - Staff selection (multi-select)                              │
│  - Day selection (checkboxes)                                  │
│  - Shift type selection (early/late/off)                       │
│  - Rule type selection (preferred/avoid/required_off)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  usePriorityRulesData.js                                       │
│  - loadPriorityRules() - Load from Supabase                    │
│  - createPriorityRule() - Create new rule                      │
│  - updatePriorityRule() - Update existing rule                 │
│  - Real-time subscription to database changes                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
│  Supabase PostgreSQL - priority_rules table                    │
│  - Stores rule metadata (name, description, priority_level)    │
│  - JSONB rule_definition with conditions and preferences       │
│  - Supports single staff (legacy) or multiple staff (new)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       AI LAYER                                  │
│  BusinessRuleValidator.js                                       │
│  - transformPriorityRulesArrayToObject() - Array → Object      │
│  - applyPriorityRules() - Apply rules during schedule gen      │
│                                                                 │
│  HybridPredictor.js                                            │
│  - predictSchedule() - Main AI entry point                     │
│  - Passes priorityRules to ML engine                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow: UI → Database → AI

### 2.1 Rule Creation Flow

```javascript
// STEP 1: User creates rule in UI (PriorityRulesTab.jsx)
const newRule = {
  id: "uuid",
  name: "Weekend Early Shifts",
  description: "Staff prefers early shifts on weekends",
  ruleType: "preferred_shift",     // ← Rule behavior type
  shiftType: "early",               // ← Which shift to apply
  daysOfWeek: [0, 6],              // ← Sunday and Saturday
  staffIds: ["staff-uuid-1", "staff-uuid-2"], // ← Multiple staff
  priorityLevel: 4,                 // Hidden from UI (always 4)
  preferenceStrength: 1.0,          // Hidden from UI (always 1.0)
  isHardConstraint: true,           // Hidden from UI (always true)
  penaltyWeight: 100,               // Hidden from UI (always 100)
  isActive: true
};

// STEP 2: Save to database (usePriorityRulesData.js)
await supabase
  .from('priority_rules')
  .insert([{
    name: newRule.name,
    description: newRule.description,
    priority_level: 4,              // Top-level column
    penalty_weight: 100,            // Top-level column
    is_hard_constraint: true,       // Top-level column
    rule_definition: {              // ← JSONB storage
      rule_type: "preferred_shift",
      shift_type: "early",
      days_of_week: [0, 6],
      staff_ids: ["uuid1", "uuid2"] // ← Array in JSONB
    }
  }]);

// STEP 3: Load in AI (BusinessRuleValidator.js)
// Array format from database → Transform to object format
const rulesObject = {
  "staff-uuid-1": {
    preferredShifts: [
      { day: "sunday", shift: "early", priority: 4 },
      { day: "saturday", shift: "early", priority: 4 }
    ],
    avoidedShifts: []
  },
  "staff-uuid-2": {
    preferredShifts: [
      { day: "sunday", shift: "early", priority: 4 },
      { day: "saturday", shift: "early", priority: 4 }
    ],
    avoidedShifts: []
  }
};

// STEP 4: Apply during AI generation
await applyPriorityRules(schedule, staffMembers, dateRange);
// For "preferred_shift": Sets △ on Sunday/Saturday
// For "avoid_shift": Clears △ if ML assigned it
```

---

## 3. Database Schema

### 3.1 priority_rules Table Structure

**File:** `/database/migrations/schema/005_create_business_rules.sql`

```sql
CREATE TABLE priority_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,

    -- Metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Priority configuration (top-level columns)
    priority_level INTEGER DEFAULT 1,        -- Range: 1-10 (Higher = Higher priority)
    penalty_weight DECIMAL(5,2) DEFAULT 1.0, -- ML penalty multiplier
    is_hard_constraint BOOLEAN DEFAULT false, -- Cannot be violated vs soft

    -- Rule definition (JSONB - flexible structure)
    rule_definition JSONB NOT NULL,
    /* Current structure:
    {
      "type": "preferred_shift" | "avoid_shift" | "required_off",
      "staff_ids": ["uuid1", "uuid2", ...],  // NEW: Array format
      "conditions": {
        "day_of_week": [0, 1, 2, ...],       // 0=Sunday, 6=Saturday
        "shift_type": "early" | "late" | "off"
      },
      "preference_strength": 0.9  // 0-1 scale
    }
    */

    -- Time-based constraints
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(restaurant_id, version_id, name),
    CONSTRAINT valid_priority_level CHECK (priority_level >= 1 AND priority_level <= 10)
);
```

### 3.2 Key JSONB Paths

| Field | JSONB Path | Type | Example |
|-------|------------|------|---------|
| Rule Type | `rule_definition->>'type'` | String | `"preferred_shift"` |
| Staff IDs | `rule_definition->'staff_ids'` | Array | `["uuid1", "uuid2"]` |
| Days of Week | `rule_definition->'conditions'->'day_of_week'` | Array | `[0, 6]` |
| Shift Type | `rule_definition->'conditions'->>'shift_type'` | String | `"early"` |

### 3.3 Example Database Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440600",
  "name": "Weekend Early Shifts",
  "description": "Kitchen staff prefer early shifts on weekends",
  "priority_level": 4,
  "penalty_weight": 100.0,
  "is_hard_constraint": true,
  "rule_definition": {
    "type": "preferred_shift",
    "staff_ids": [
      "550e8400-e29b-41d4-a716-446655440010",
      "550e8400-e29b-41d4-a716-446655440011"
    ],
    "conditions": {
      "day_of_week": [0, 6],
      "shift_type": "early"
    },
    "preference_strength": 1.0
  },
  "is_active": true
}
```

---

## 4. UI Components

### 4.1 PriorityRulesTab.jsx Structure

**File:** `/src/components/settings/tabs/PriorityRulesTab.jsx` (1073 lines)

#### Key Constants (Lines 19-62)

```javascript
// Days of week selector
const DAYS_OF_WEEK = [
  { id: 0, label: "Sunday", short: "Sun" },
  { id: 1, label: "Monday", short: "Mon" },
  // ... through Saturday
];

// Shift type selector
const SHIFT_TYPES = [
  { id: "early", label: "Early Shift", icon: "🌅" },
  { id: "late", label: "Late Shift", icon: "🌙" },
  { id: "off", label: "Off Day", icon: "🏠" }
];

// Rule type selector
const RULE_TYPES = [
  {
    id: "preferred_shift",
    label: "Preferred Shift",
    icon: "⭐",
    description: "Staff member prefers specific shifts on certain days"
  },
  {
    id: "avoid_shift",
    label: "Avoid Shift",
    icon: "❌",
    description: "Staff member wants to avoid specific shifts on certain days"
  },
  {
    id: "required_off",
    label: "Required Off",
    icon: "🏠",
    description: "Staff member must be off on specific days"
  }
];
```

#### Data Structure (Lines 85-125)

```javascript
// Transform from WebSocket/Supabase format to UI format
const priorityRules = useMemo(() => {
  const rules = settings?.priorityRules || [];
  const rulesArray = Array.isArray(rules) ? rules : [];

  const mappedRules = rulesArray.map((rule) => ({
    ...rule,
    // Extract from nested JSONB structure
    daysOfWeek: rule.daysOfWeek ||
                rule.ruleDefinition?.conditions?.day_of_week ||
                [],
    shiftType: rule.shiftType ||
               rule.ruleDefinition?.conditions?.shift_type ||
               "early",
    ruleType: rule.ruleType ||
              rule.ruleDefinition?.type ||
              "preferred_shift",
    staffIds: rule.staffIds ||
              rule.ruleDefinition?.staff_ids ||
              []
  }));

  return mappedRules;
}, [settings?.priorityRules]);
```

#### Multi-Staff Support (Lines 506-555)

```javascript
// Add staff member to rule
const addStaffMember = useCallback((ruleId, staffId) => {
  const rule = priorityRules.find(r => r.id === ruleId);
  const currentStaffIds = rule.staffIds || [];

  if (currentStaffIds.includes(staffId)) return; // Prevent duplicates

  const updatedStaffIds = [...currentStaffIds, staffId];

  // Update edit buffer for save
  setEditBuffer((prev) => ({
    ...prev,
    [ruleId]: { ...prev[ruleId], staffIds: updatedStaffIds }
  }));

  // Update UI immediately
  updatePriorityRules(priorityRules.map(r =>
    r.id === ruleId ? { ...r, staffIds: updatedStaffIds } : r
  ));
}, [priorityRules, updatePriorityRules]);
```

#### UI Sections

1. **Rule Type Selector** (Lines 557-582) - Grid of 2 cards
2. **Shift Type Selector** (Lines 854-871) - 3 buttons (Early/Late/Off)
3. **Days of Week Selector** (Lines 584-615) - 7 checkboxes
4. **Staff Multi-Select** (Lines 766-848) - Dropdown + chips display

---

## 5. AI Integration

### 5.1 BusinessRuleValidator.js - Rule Application

**File:** `/src/ai/hybrid/BusinessRuleValidator.js`

#### Transform Array to Object (Lines 1370-1507)

```javascript
transformPriorityRulesArrayToObject(rulesArray, staffMembers) {
  const rulesObject = {};

  rulesArray.forEach((rule) => {
    // Extract staff IDs (supports both array and legacy single)
    const staffIds = rule.staffIds ||
                     rule.ruleDefinition?.staff_ids ||
                     (rule.staffId ? [rule.staffId] : []);

    // Extract shift configuration
    const daysOfWeek = rule.ruleDefinition?.conditions?.day_of_week || [];
    const shiftType = rule.ruleDefinition?.conditions?.shift_type || "early";
    const ruleType = rule.ruleDefinition?.type || "preferred_shift";

    // For each staff member
    staffIds.forEach((staffId) => {
      const staff = staffMembers.find(s => s.id === staffId);
      if (!staff) return;

      if (!rulesObject[staff.id]) {
        rulesObject[staff.id] = {
          preferredShifts: [],  // For preferred_shift rules
          avoidedShifts: []     // For avoid_shift rules
        };
      }

      // Convert days to shift rules
      daysOfWeek.forEach((dayNum) => {
        const shiftRule = {
          day: dayNames[dayNum],
          shift: shiftType,
          priority: rule.priorityLevel || 3
        };

        // Separate by rule type
        if (ruleType === 'avoid_shift') {
          rulesObject[staff.id].avoidedShifts.push(shiftRule);
        } else {
          rulesObject[staff.id].preferredShifts.push(shiftRule);
        }
      });
    });
  });

  return rulesObject;
}
```

#### Apply Rules During Generation (Lines 1208-1362)

```javascript
async applyPriorityRules(schedule, staffMembers, dateRange) {
  // Get rules from settings
  const liveSettings = this.getLiveSettings();
  let priorityRules = liveSettings.priorityRules;

  // Transform array format to object format
  if (Array.isArray(priorityRules)) {
    priorityRules = this.transformPriorityRulesArrayToObject(
      priorityRules,
      staffMembers
    );
  }

  // Apply for each staff member
  Object.keys(priorityRules).forEach((staffId) => {
    const staff = staffMembers.find(s => s.id === staffId);
    const rules = priorityRules[staffId];
    const preferredShifts = rules.preferredShifts || [];
    const avoidedShifts = rules.avoidedShifts || [];

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey); // "sunday", "monday", etc.

      // STEP 1: Process avoidedShifts FIRST (clear avoided shifts)
      avoidedShifts.forEach((rule) => {
        if (rule.day === dayOfWeek) {
          const avoidedShiftValue = mapShiftTypeToSymbol(rule.shift);
          const currentShift = schedule[staff.id][dateKey] || "";

          if (currentShift === avoidedShiftValue) {
            schedule[staff.id][dateKey] = ""; // Clear avoided shift
            console.log(`🚫 CLEARED "${avoidedShiftValue}" for ${staff.name}`);
          }
        }
      });

      // STEP 2: Process preferredShifts SECOND (set preferred shifts)
      preferredShifts.forEach((rule) => {
        if (rule.day === dayOfWeek) {
          const shiftValue = mapShiftTypeToSymbol(rule.shift);
          schedule[staff.id][dateKey] = shiftValue; // Set preferred shift
          console.log(`✅ SET "${shiftValue}" for ${staff.name}`);
        }
      });
    });
  });
}

function mapShiftTypeToSymbol(shiftType) {
  switch (shiftType) {
    case "early": return "△";
    case "late": return "◇";
    case "off": return "×";
    default: return "";
  }
}
```

### 5.2 HybridPredictor.js - ML Integration

**File:** `/src/ai/hybrid/HybridPredictor.js`

#### Priority Rules Passed to ML Engine (Lines 274-287)

```javascript
async predictSchedule(inputData, staffMembers, dateRange, onProgress) {
  // Get live settings
  const liveSettings = this.settingsProvider.getSettings();

  // Pass priority rules to ML engine
  mlPredictions = await this.mlEngine.predictSchedule(
    inputData.scheduleData,
    staffMembers,
    dateRange,
    onProgress,
    {
      priorityRules: liveSettings?.priorityRules || [],  // ← Priority rules
      dailyLimits: liveSettings?.dailyLimits || [],
      monthlyLimits: liveSettings?.monthlyLimits || [],
      staffGroups: liveSettings?.staffGroups || []
    }
  );
}
```

#### Rule Enforcement During Generation (Lines 1130-1156)

```javascript
async generateRuleBasedSchedule(inputData, staffMembers, dateRange) {
  // Step 1: Apply priority rules first
  await this.applyPriorityRules(schedule, staffMembers, dateRange);

  // Step 2: Apply staff group constraints
  await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);

  // Step 3: Re-enforce priority rules (prevent overwrites)
  await this.applyPriorityRules(schedule, staffMembers, dateRange);

  // Step 4: Apply daily limits
  await this.applyDailyLimits(schedule, staffMembers, dateRange);

  // Step 5: Re-enforce priority rules again
  await this.applyPriorityRules(schedule, staffMembers, dateRange);

  // Step 6: Distribute rest days
  await this.distributeRestDays(schedule, staffMembers, dateRange);

  // Step 7: Final priority rules enforcement
  await this.applyPriorityRules(schedule, staffMembers, dateRange);

  return schedule;
}
```

---

## 6. Extension Points for New Functionality

### 6.1 Proposed Feature: "Allow Certain Shifts"

**User Story:**
"As a staff member, I want to specify that I can ONLY work certain shifts (e.g., early shifts) on specific days, so the AI never assigns me other shift types."

**Current Limitation:**
- `preferred_shift` suggests a shift but doesn't prevent others
- `avoid_shift` only clears one specific shift type
- No way to say "ONLY allow early shift" (exclude late/normal/off)

### 6.2 Extension Points

#### 6.2.1 UI Layer (PriorityRulesTab.jsx)

**Location:** Lines 29-54 (RULE_TYPES constant)

```javascript
// ADD NEW RULE TYPE
const RULE_TYPES = [
  // ... existing rules ...
  {
    id: "allow_only_shifts",  // ← NEW
    label: "Allow Only Certain Shifts",
    icon: "✓",
    description: "Staff can ONLY work specific shifts on certain days (excludes all others)"
  }
];
```

**Location:** Lines 29-33 (SHIFT_TYPES constant) - Already supports multi-select

```javascript
// ENABLE MULTI-SELECT FOR SHIFT TYPES
// Current: Single selection (early OR late OR off)
// New: Multi-selection (early AND late, but NOT off)

// UI Change: Convert from radio buttons to checkboxes
const SHIFT_TYPES = [
  { id: "early", label: "Early Shift", icon: "🌅" },
  { id: "late", label: "Late Shift", icon: "🌙" },
  { id: "off", label: "Off Day", icon: "🏠" },
  { id: "normal", label: "Normal Shift", icon: "○" }  // ← ADD NORMAL OPTION
];
```

**Modification:** Lines 854-871 (renderShiftTypeSelector)

```javascript
// BEFORE (single select)
<button
  onClick={() => updateRule(rule.id, { shiftType: shift.id })}
  className={rule.shiftType === shift.id ? "selected" : ""}
>
  {shift.label}
</button>

// AFTER (multi-select)
<button
  onClick={() => toggleShiftType(rule.id, shift.id)}
  className={rule.allowedShifts?.includes(shift.id) ? "selected" : ""}
>
  {shift.label}
</button>

// New function
const toggleShiftType = (ruleId, shiftId) => {
  const rule = priorityRules.find(r => r.id === ruleId);
  const currentShifts = rule.allowedShifts || [];

  const updatedShifts = currentShifts.includes(shiftId)
    ? currentShifts.filter(s => s !== shiftId)
    : [...currentShifts, shiftId];

  updateRule(ruleId, { allowedShifts: updatedShifts });
};
```

#### 6.2.2 Database Layer

**Location:** `/database/migrations/schema/005_create_business_rules.sql`

**No schema changes needed!** The JSONB structure is flexible:

```sql
-- Current structure supports this already:
rule_definition = {
  "type": "allow_only_shifts",  -- ← NEW type
  "staff_ids": ["uuid1", "uuid2"],
  "conditions": {
    "day_of_week": [0, 6],
    "allowed_shift_types": ["early", "late"]  -- ← NEW: Array of allowed shifts
  }
}
```

#### 6.2.3 Data Hook Layer (usePriorityRulesData.js)

**Location:** Lines 54-81 (transformedRules mapping)

```javascript
// ADD NEW FIELD EXTRACTION
const transformedRules = (data || []).map(rule => ({
  // ... existing fields ...

  // NEW: Extract allowed shift types array
  allowedShifts: rule.ruleDefinition?.conditions?.allowed_shift_types ||
                 rule.allowedShifts ||
                 [],

  // Keep backward compatibility
  shiftType: rule.ruleDefinition?.conditions?.shift_type || "early"
}));
```

**Location:** Lines 139-149 (createPriorityRule)

```javascript
// ADD NEW FIELD TO INSERT
rule_definition: {
  rule_type: ruleData.ruleType,
  shift_type: ruleData.shiftType,  // Legacy single shift
  days_of_week: ruleData.daysOfWeek || [],
  staff_ids: staffIds,

  // NEW: Multi-shift support
  allowed_shift_types: ruleData.allowedShifts || [],

  preference_strength: ruleData.preferenceStrength ?? 1.0
}
```

#### 6.2.4 AI Layer (BusinessRuleValidator.js)

**Location:** Lines 1370-1507 (transformPriorityRulesArrayToObject)

```javascript
transformPriorityRulesArrayToObject(rulesArray, staffMembers) {
  // ... existing code ...

  rulesArray.forEach((rule) => {
    // ... existing extraction ...

    const ruleType = rule.ruleDefinition?.type || "preferred_shift";

    // NEW: Extract allowed shifts for new rule type
    const allowedShifts = rule.ruleDefinition?.conditions?.allowed_shift_types ||
                         rule.allowedShifts ||
                         [];

    // ... process staff and days ...

    daysOfWeek.forEach((dayNum) => {
      if (ruleType === 'allow_only_shifts') {
        // NEW: Store allowed shifts list
        const shiftRule = {
          day: dayNames[dayNum],
          allowedShifts: allowedShifts,  // ← Array: ["early", "late"]
          priority: rule.priorityLevel || 3
        };

        // NEW: Store in new array
        rulesObject[staff.id].allowOnlyShifts =
          rulesObject[staff.id].allowOnlyShifts || [];
        rulesObject[staff.id].allowOnlyShifts.push(shiftRule);
      }
      // ... existing preferred/avoided logic ...
    });
  });
}
```

**Location:** Lines 1208-1362 (applyPriorityRules)

```javascript
async applyPriorityRules(schedule, staffMembers, dateRange) {
  // ... existing code ...

  Object.keys(priorityRules).forEach((staffId) => {
    const rules = priorityRules[staffId];
    const preferredShifts = rules.preferredShifts || [];
    const avoidedShifts = rules.avoidedShifts || [];
    const allowOnlyShifts = rules.allowOnlyShifts || [];  // ← NEW

    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateKey);

      // NEW: STEP 0: Process allowOnlyShifts FIRST (most restrictive)
      allowOnlyShifts.forEach((rule) => {
        if (rule.day === dayOfWeek) {
          const currentShift = schedule[staff.id][dateKey] || "";
          const currentShiftType = symbolToShiftType(currentShift);

          // Check if current shift is allowed
          if (!rule.allowedShifts.includes(currentShiftType)) {
            // Current shift NOT allowed - replace with first allowed shift
            const firstAllowed = rule.allowedShifts[0];
            schedule[staff.id][dateKey] = shiftTypeToSymbol(firstAllowed);

            console.log(
              `🔒 [ALLOW-ONLY] ${staff.name}: Changed "${currentShift}" → "${shiftTypeToSymbol(firstAllowed)}" ` +
              `(only allowing: ${rule.allowedShifts.join(', ')})`
            );
          }
        }
      });

      // ... existing STEP 1 (avoidedShifts) ...
      // ... existing STEP 2 (preferredShifts) ...
    });
  });
}

// Helper function: Symbol → Shift Type
function symbolToShiftType(symbol) {
  switch (symbol) {
    case "△": return "early";
    case "◇": return "late";
    case "×": return "off";
    case "○": return "normal";
    case "": return "normal";
    default: return "unknown";
  }
}

// Helper function: Shift Type → Symbol
function shiftTypeToSymbol(shiftType) {
  switch (shiftType) {
    case "early": return "△";
    case "late": return "◇";
    case "off": return "×";
    case "normal": return "○";
    default: return "";
  }
}
```

---

## 7. Implementation Plan

### 7.1 Phase 1: UI Changes (PriorityRulesTab.jsx)

**Tasks:**
1. ✅ Add new rule type to `RULE_TYPES` constant
2. ✅ Add "Normal Shift" to `SHIFT_TYPES` constant
3. ✅ Convert shift type selector from single-select to multi-select
4. ✅ Update rule card display to show allowed shifts array
5. ✅ Add validation: "At least one shift type must be selected"

**Files to modify:**
- `/src/components/settings/tabs/PriorityRulesTab.jsx` (Lines 29-54, 854-871)

**Estimated complexity:** Medium (2-3 hours)

### 7.2 Phase 2: Data Layer (usePriorityRulesData.js)

**Tasks:**
1. ✅ Add `allowedShifts` field extraction in `transformedRules`
2. ✅ Update `createPriorityRule()` to save `allowed_shift_types` in JSONB
3. ✅ Update `updatePriorityRule()` to handle `allowed_shift_types` updates
4. ✅ Add backward compatibility checks

**Files to modify:**
- `/src/hooks/usePriorityRulesData.js` (Lines 54-81, 139-149, 210-239)

**Estimated complexity:** Low (1-2 hours)

### 7.3 Phase 3: AI Integration (BusinessRuleValidator.js)

**Tasks:**
1. ✅ Update `transformPriorityRulesArrayToObject()` to handle `allow_only_shifts`
2. ✅ Add `allowOnlyShifts` array to transformed object
3. ✅ Implement new STEP 0 in `applyPriorityRules()` for restrictive enforcement
4. ✅ Add helper functions: `symbolToShiftType()`, `shiftTypeToSymbol()`
5. ✅ Add logging for debugging

**Files to modify:**
- `/src/ai/hybrid/BusinessRuleValidator.js` (Lines 1208-1507)

**Estimated complexity:** Medium (2-3 hours)

### 7.4 Phase 4: Testing & Validation

**Test Scenarios:**

1. **Single Shift Allow:**
   - Rule: "Allow ONLY early shifts on Monday"
   - Expected: ML assigns late shift → AI changes to early shift

2. **Multi-Shift Allow:**
   - Rule: "Allow ONLY early + late shifts (no off days) on weekends"
   - Expected: ML assigns × → AI changes to △ or ◇

3. **Interaction with Avoid Rules:**
   - Rule 1: "Avoid late shifts on Monday"
   - Rule 2: "Allow only early + late on Monday"
   - Expected: Allow-only takes precedence → only early allowed

4. **Multi-Staff Rule:**
   - Rule: "Allow only early shifts for Staff A, B, C on Tuesday"
   - Expected: All 3 staff get △ on Tuesday

**Estimated complexity:** Medium (2-3 hours)

### 7.5 Total Effort Estimate

| Phase | Complexity | Time Estimate |
|-------|------------|---------------|
| Phase 1: UI | Medium | 2-3 hours |
| Phase 2: Data | Low | 1-2 hours |
| Phase 3: AI | Medium | 2-3 hours |
| Phase 4: Testing | Medium | 2-3 hours |
| **Total** | **Medium** | **7-11 hours** |

---

## 8. Key Findings & Recommendations

### 8.1 Architecture Strengths

✅ **Flexible JSONB Storage:** Database schema already supports new rule types without migration
✅ **Clean Separation:** UI → Data → AI layers are well-separated
✅ **Multi-Staff Support:** Infrastructure already supports rules for multiple staff members
✅ **Real-time Updates:** Supabase subscriptions ensure UI stays in sync
✅ **Backward Compatibility:** Code handles both legacy and new formats gracefully

### 8.2 Potential Challenges

⚠️ **Rule Priority Order:**
Current execution: `avoidedShifts` → `preferredShifts`
New requirement: `allowOnlyShifts` should execute FIRST (most restrictive)

⚠️ **Rule Conflicts:**
What if staff has:
- Rule 1: "Allow only early shifts on Monday"
- Rule 2: "Prefer late shifts on Monday"

**Solution:** Enforce precedence order: `allowOnlyShifts` > `preferredShifts` > `avoidedShifts`

⚠️ **UI Complexity:**
Multi-select shift types may confuse users if not clearly labeled

**Solution:** Add helper text: "Select all shift types this staff member is allowed to work"

### 8.3 Recommended Implementation Order

1. **Start with AI Layer** - Implement `allowOnlyShifts` logic in BusinessRuleValidator
2. **Add Data Layer Support** - Update hooks to save/load `allowed_shift_types`
3. **Build UI Components** - Add multi-select UI for shift types
4. **Integration Testing** - Test with real staff schedules

### 8.4 Code Quality Notes

✅ **Well-documented:** Extensive comments explaining data transformations
✅ **Defensive coding:** Multiple fallback paths for data extraction
✅ **Debug logging:** Comprehensive console logging for troubleshooting
⚠️ **Large files:** BusinessRuleValidator.js is 2800+ lines (consider splitting)

---

## 9. Next Steps

1. **Create Feature Branch:** `feature/allow-only-shifts`
2. **Implement Phase 1 (UI):** Add multi-select shift type selector
3. **Implement Phase 2 (Data):** Update hooks to save allowed shifts array
4. **Implement Phase 3 (AI):** Add enforcement logic in BusinessRuleValidator
5. **Write Tests:** Unit tests for transformation and application logic
6. **Manual QA:** Test with various rule combinations
7. **Documentation:** Update user guide with new rule type

---

**End of Analysis**
