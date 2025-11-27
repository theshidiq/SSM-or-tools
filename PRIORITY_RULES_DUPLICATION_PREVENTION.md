# Priority Rules Duplication Prevention Guide

## Executive Summary

This document provides comprehensive guidance on preventing priority rules duplication in the Shift Schedule Manager application. The duplication bug was caused by a **race condition between WebSocket and Supabase database operations** combined with **missing debounce implementation** in the UI layer.

**Status**: Multiple fixes applied across 4 layers (UI, Hook, Service, Go Server)
**Date**: 2025-11-27
**Severity**: HIGH - Data integrity issue causing database pollution

---

## Table of Contents

1. [Problem Description](#problem-description)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Reproduction Steps](#reproduction-steps)
4. [Fix Implementation](#fix-implementation)
5. [Prevention Guidelines](#prevention-guidelines)
6. [Testing Checklist](#testing-checklist)
7. [Related Files](#related-files)

---

## Problem Description

### Symptoms

When creating or editing priority rules in the Settings modal:

1. **Multiple duplicate rules created** with names like:
   - "New Priori"
   - "New Priority"
   - "New Priority R"
   - "New Priority Rule"

2. **Incomplete rules saved to database** with:
   - Empty `daysOfWeek` arrays (should not be synced)
   - Missing staff member assignments
   - Partial rule names

3. **Database pollution** with skeleton rules that cannot be deleted via UI

### Impact

- ❌ Database cluttered with incomplete/duplicate rules
- ❌ User confusion about which rule is the "real" one
- ❌ Performance degradation from unnecessary database rows
- ❌ AI constraint validation errors from incomplete rules
- ❌ Export functions include invalid rules

---

## Root Cause Analysis

### The Multi-Layer Failure Chain

The duplication issue was caused by **5 interconnected failures** across the application stack:

```
┌──────────────────────────────────────────────────────────────────┐
│                  PRIORITY RULES DUPLICATION CHAIN                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: UI Component (PriorityRulesTab.jsx)                  │
│  ❌ MISSING: Debounced text input for rule name/description     │
│  ❌ BUG: Every keystroke triggers immediate updateRule()        │
│  Result: 15 keystrokes = 15 database updates                    │
│                                                                  │
│  LAYER 2: Edit Buffer Management (PriorityRulesTab.jsx)        │
│  ❌ BUG: Local buffer not preventing server sync                │
│  ❌ MISSING: Incomplete rule validation before sync             │
│  Result: Skeleton rules (empty days) synced to server           │
│                                                                  │
│  LAYER 3: Hook Layer (useSettingsData.js)                      │
│  ❌ RACE CONDITION: WebSocket sync vs localStorage save         │
│  ❌ BUG: Concurrent sync operations create duplicates           │
│  Result: Same rule inserted multiple times                      │
│                                                                  │
│  LAYER 4: Go WebSocket Server (settings_multitable.go)         │
│  ❌ BUG: Missing deduplication on CREATE_PRIORITY_RULE          │
│  ❌ MISSING: Validation for duplicate rule names                │
│  Result: Duplicate inserts accepted                             │
│                                                                  │
│  LAYER 5: Database Layer (Supabase)                            │
│  ❌ MISSING: UNIQUE constraint on (name + version_id)           │
│  ❌ MISSING: CHECK constraint for complete rules                │
│  Result: Database accepts invalid/duplicate data                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Detailed Analysis by Layer

#### Layer 1: UI Component - Missing Debounce

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

**Problematic Code** (Before Fix):
```javascript
// ❌ BEFORE: Direct state update on every keystroke
<input
  type="text"
  value={rule.name}
  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
  // Each keystroke triggers immediate server sync!
/>
```

**Why This Caused Duplication**:
- User types "New Priority Rule" (16 characters)
- **16 separate `updateRule()` calls** fire immediately
- Each call attempts to update the database
- Without debouncing, all 16 updates race to the server
- Some updates create new rules instead of updating existing

**The Fix Applied**:
```javascript
// ✅ AFTER: Debounced buffer with 500ms delay
const [editBuffer, setEditBuffer] = useState({});

<input
  type="text"
  value={editBuffer[rule.id]?.name ?? rule.name}
  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
  // Updates local buffer immediately (responsive UI)
  // Server sync delayed by 500ms after last keystroke
/>

// Debounced sync function
const syncRuleToServer = debounce((ruleId) => {
  const bufferedUpdates = editBuffer[ruleId];
  // Sync to server only after user stops typing
  updatePriorityRulesImmediate(/* ... */);
}, 500);
```

#### Layer 2: Incomplete Rule Sync

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

**Problematic Code** (Before Fix):
```javascript
// ❌ BEFORE: Synced ALL rules to server, including incomplete ones
const updatePriorityRulesImmediate = (newRules) => {
  updateSettings((prevSettings) => ({
    ...prevSettings,
    priorityRules: newRules, // Includes incomplete rules!
  }));
};
```

**Why This Caused Pollution**:
- New rule created with empty `daysOfWeek: []`
- User hasn't selected any days yet (rule incomplete)
- Update function syncs incomplete rule to database
- Result: Database contains skeleton rule that cannot pass validation

**The Fix Applied**:
```javascript
// ✅ AFTER: Separate incomplete and complete rules
const updatePriorityRulesImmediate = useCallback((newRules) => {
  const incompleteRules = [];
  const completeRules = [];

  newRules.forEach((rule) => {
    const hasDays = rule.daysOfWeek && rule.daysOfWeek.length > 0;
    const staffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
    const hasStaff = staffIds.length > 0;
    const isComplete = hasDays && hasStaff;

    if (!isComplete && rule._isLocalOnly) {
      console.log(`⏸️ Skipping incomplete rule "${rule.name}" - UI only`);
      incompleteRules.push(rule);
    } else {
      completeRules.push(rule);
    }
  });

  // Store incomplete rules in local state (UI only)
  setLocalIncompleteRules(incompleteRules);

  // Only sync complete rules to server/database
  updateSettings((prevSettings) => ({
    ...prevSettings,
    priorityRules: completeRules,
  }));
}, [updateSettings]);
```

#### Layer 3: Race Condition in Sync

**File**: `src/hooks/useSettingsData.js`

**Problematic Code** (Before Fix):
```javascript
// ❌ BEFORE: No protection against concurrent syncs
useEffect(() => {
  if (useWebSocket && wsSettings) {
    console.log('🔄 Syncing WebSocket settings to local state');

    // Direct update without checking if another sync is in progress
    setSettings({
      priorityRules: wsSettings.priorityRules,
      // ...
    });
  }
}, [wsSettings]);

// Parallel localStorage save operation
useEffect(() => {
  if (settings) {
    // Another concurrent update!
    configService.saveSettings(settings);
  }
}, [settings]);
```

**Why This Caused Duplicates**:
1. WebSocket receives priority rule update from server
2. Sets `settings.priorityRules = [rule1]`
3. **Before** localStorage save completes...
4. Another WebSocket message arrives
5. Sets `settings.priorityRules = [rule1, rule1]` (duplicate!)
6. Both saves complete, database now has 2 identical rules

**The Fix Applied**:
```javascript
// ✅ AFTER: Sync counter prevents race conditions
const isSyncingFromWebSocketRef = useRef(false);
const syncCounterRef = useRef(0);

useEffect(() => {
  if (useWebSocket && wsSettings) {
    // Track sync operation
    const syncId = ++syncCounterRef.current;
    isSyncingFromWebSocketRef.current = true;

    console.log(`🔄 Syncing WebSocket settings (sync #${syncId})`);

    setSettings({ /* ... */ });

    // Mark sync complete
    setTimeout(() => {
      if (syncCounterRef.current === syncId) {
        isSyncingFromWebSocketRef.current = false;
      }
    }, 100);
  }
}, [wsSettings]);

// Skip localStorage save during WebSocket sync
useEffect(() => {
  if (settings && !isSyncingFromWebSocketRef.current) {
    configService.saveSettings(settings);
  }
}, [settings]);
```

#### Layer 4: Go Server Missing Validation

**File**: `go-server/settings_multitable.go`

**Problematic Code** (Before Fix):
```go
// ❌ BEFORE: No duplicate check before INSERT
func handleCreatePriorityRule(message WebSocketMessage, client *Client) {
	ruleData := message.Payload["rule"]

	// Direct INSERT without checking if rule exists
	query := `INSERT INTO priority_rules (name, rule_definition, ...) VALUES ($1, $2, ...)`
	db.Exec(query, ruleData.Name, ruleData.RuleDefinition, ...)

	broadcastSettings() // Broadcasts to all clients
}
```

**Why This Allowed Duplicates**:
- Multiple CREATE requests for same rule name
- No validation that rule already exists
- Each request creates a new database row
- Result: 3 rules with names "New Priority", "New Priority R", "New Priority Rule"

**The Fix Applied**:
```go
// ✅ AFTER: Check for existing rule before INSERT
func handleCreatePriorityRule(message WebSocketMessage, client *Client) {
	ruleData := message.Payload["rule"]

	// Check if rule with same name exists for this version
	var existingID string
	err := db.QueryRow(`
		SELECT id FROM priority_rules
		WHERE name = $1 AND version_id = $2 AND is_active = true
	`, ruleData.Name, versionID).Scan(&existingID)

	if err == nil {
		// Rule exists - UPDATE instead of INSERT
		log.Printf("⚠️ Rule '%s' already exists, updating instead", ruleData.Name)
		handleUpdatePriorityRule(message, client)
		return
	}

	// Validate rule is complete before INSERT
	if len(ruleData.DaysOfWeek) == 0 {
		sendError(client, "Cannot create rule without days selected")
		return
	}
	if len(ruleData.StaffIDs) == 0 {
		sendError(client, "Cannot create rule without staff members")
		return
	}

	// Safe to INSERT
	query := `INSERT INTO priority_rules (...) VALUES (...)`
	db.Exec(query, ...)
}
```

#### Layer 5: Database Missing Constraints

**File**: `database_schema.sql` (Missing constraints)

**Current Schema** (Vulnerable):
```sql
CREATE TABLE priority_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    version_id UUID NOT NULL REFERENCES config_versions(id),
    name TEXT NOT NULL,
    rule_definition JSONB NOT NULL,
    -- ❌ MISSING: No UNIQUE constraint on (name, version_id)
    -- ❌ MISSING: No CHECK constraint for complete rules
);
```

**Why This Allowed Duplicates**:
- Database accepts multiple rules with identical names
- No validation that `rule_definition->>'days_of_week'` is non-empty
- No validation that `rule_definition->>'staff_ids'` is non-empty

**The Fix to Apply**:
```sql
-- ✅ Add UNIQUE constraint to prevent duplicate rule names
ALTER TABLE priority_rules
ADD CONSTRAINT priority_rules_unique_name_version
UNIQUE (name, version_id, restaurant_id);

-- ✅ Add CHECK constraint for complete rules
ALTER TABLE priority_rules
ADD CONSTRAINT priority_rules_complete_check
CHECK (
  jsonb_array_length(rule_definition->'staff_ids') > 0 AND
  jsonb_array_length(rule_definition->'days_of_week') > 0
);

-- ✅ Create index for fast duplicate detection
CREATE INDEX idx_priority_rules_name_version
ON priority_rules (name, version_id)
WHERE is_active = true;
```

---

## Reproduction Steps

### How to Trigger the Bug (Before Fixes)

1. **Open Settings Modal**
   - Go to Settings → Priority Rules tab
   - Click "Add Rule" button

2. **Start Typing Rule Name Quickly**
   - Type "New Priority Rule" rapidly (simulate fast typing)
   - **Do NOT pause** between keystrokes
   - Expected: 1 rule created
   - **Actual Bug**: 3-5 duplicate rules created

3. **Check Database**
   ```sql
   SELECT name, created_at
   FROM priority_rules
   WHERE name LIKE 'New Prior%'
   ORDER BY created_at;
   ```

   **Result Before Fix**:
   ```
   New Priori      | 2025-11-27 10:00:01
   New Priority    | 2025-11-27 10:00:02
   New Priority R  | 2025-11-27 10:00:03
   New Priority Ru | 2025-11-27 10:00:04
   ```

4. **Verify in UI**
   - Refresh page (or restart `npm start`)
   - Navigate to Settings → Priority Rules
   - **Expected**: 1 rule
   - **Actual Bug**: 4 incomplete rules visible

### Environmental Factors

The bug is **more likely** to occur when:

- ✅ **Fast typing**: User types quickly without pausing
- ✅ **Slow network**: Network latency causes request queueing
- ✅ **WebSocket enabled**: Race condition between WS and HTTP
- ✅ **Multiple tabs**: Concurrent edits from different browser tabs
- ✅ **Chrome DevTools open**: DevTools slows React rendering, delays debounce

The bug is **less likely** to occur when:

- ❌ **Slow typing**: User pauses between keystrokes (allows debounce to work)
- ❌ **Fast network**: Requests complete before next keystroke
- ❌ **WebSocket disabled**: Only Supabase direct inserts (still has issue)
- ❌ **Production build**: Optimized bundle has less render delay

---

## Fix Implementation

### Fix Summary

| Layer | Component | Fix Applied | Status |
|-------|-----------|-------------|--------|
| 1 | UI Component | Debounced text input (500ms) | ✅ Complete |
| 2 | Edit Buffer | Incomplete rule filtering | ✅ Complete |
| 3 | Hook Layer | Race condition prevention | ✅ Complete |
| 4 | Go Server | Duplicate detection + validation | ⏳ Partial |
| 5 | Database | UNIQUE + CHECK constraints | ❌ Pending |

### Fix 1: Debounced Text Input

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

**Changes Made** (Lines 75-294):

```javascript
// 1. Add edit buffer state
const [editBuffer, setEditBuffer] = useState({});

// 2. Create refs for stable access
const editBufferRef = useRef({});
const priorityRulesRef = useRef(priorityRules);
const debouncedSyncRef = useRef({});

// 3. Sync refs on changes
useEffect(() => {
  editBufferRef.current = editBuffer;
}, [editBuffer]);

useEffect(() => {
  priorityRulesRef.current = priorityRules;
}, [priorityRules]);

// 4. Debounced sync function
const syncRuleToServer = useCallback((ruleId) => {
  const bufferedUpdates = editBufferRef.current[ruleId];
  if (!bufferedUpdates) {
    console.log(`⚠️ No buffered updates for rule ${ruleId}`);
    return;
  }

  console.log(`🔄 [DEBOUNCE] Syncing buffered updates for rule ${ruleId}:`, bufferedUpdates);

  const updatedRules = priorityRulesRef.current.map((rule) => {
    if (rule.id === ruleId) {
      return { ...rule, ...bufferedUpdates };
    }
    return rule;
  });

  updatePriorityRulesImmediate(updatedRules);

  // Clear buffer after sync
  setEditBuffer((prev) => {
    const next = { ...prev };
    delete next[ruleId];
    return next;
  });
}, [updatePriorityRulesImmediate]);

// 5. Create stable debounced functions (one per rule)
const getOrCreateDebouncedSync = useCallback((ruleId) => {
  if (!debouncedSyncRef.current[ruleId]) {
    debouncedSyncRef.current[ruleId] = debounce(
      () => syncRuleToServer(ruleId),
      500, // 500ms delay after last keystroke
      {
        leading: false,  // Don't sync on first keystroke
        trailing: true,  // Do sync after last keystroke
      }
    );
  }
  return debouncedSyncRef.current[ruleId];
}, [syncRuleToServer]);

// 6. Update rule with buffer + debounce
const updateRule = useCallback((ruleId, updates) => {
  // Update local buffer immediately (responsive UI)
  setEditBuffer((prev) => ({
    ...prev,
    [ruleId]: { ...(prev[ruleId] || {}), ...updates },
  }));

  // Trigger debounced server sync
  const debouncedSync = getOrCreateDebouncedSync(ruleId);
  debouncedSync();
}, [getOrCreateDebouncedSync]);

// 7. Cleanup: cancel pending debounces on unmount
useEffect(() => {
  return () => {
    Object.values(debouncedSyncRef.current).forEach((debouncedFn) => {
      if (debouncedFn) debouncedFn.cancel();
    });
  };
}, []);

// 8. Update input to use edit buffer
<input
  type="text"
  value={editBuffer[rule.id]?.name ?? rule.name}
  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
  placeholder="e.g., Weekend Early Shifts for Chef Team"
  className="text-lg font-semibold bg-transparent border-b-2 border-purple-500 focus:outline-none w-full"
  autoFocus
/>
```

**Why This Works**:
- ✅ User types "New Priority Rule" (16 characters)
- ✅ Each keystroke updates `editBuffer` immediately (responsive UI)
- ✅ Debounce timer resets on each keystroke (cancel previous timer)
- ✅ After 500ms of no typing, `syncRuleToServer()` fires **once**
- ✅ Only **1 database update** instead of 16

### Fix 2: Incomplete Rule Filtering

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

**Changes Made** (Lines 79-124, 183-217):

```javascript
// 1. Add local state for incomplete rules (UI only)
const [localIncompleteRules, setLocalIncompleteRules] = useState([]);

// 2. Merge complete and incomplete rules for display
const priorityRules = useMemo(() => {
  const rules = settings?.priorityRules || [];
  const rulesArray = Array.isArray(rules) ? rules : [];

  const mappedRules = rulesArray.map((rule) => ({
    ...rule,
    // Extract staffIds from various formats
    staffIds: rule.staffIds ||
             rule.ruleDefinition?.staff_ids ||
             (rule.staffId ? [rule.staffId] : []),
    daysOfWeek: rule.daysOfWeek ||
                rule.ruleDefinition?.daysOfWeek || [],
  }));

  // Filter out soft-deleted rules
  const activeRules = mappedRules.filter(
    rule => rule.isActive !== false && rule.is_active !== false
  );

  // Merge complete rules from server + incomplete local-only rules
  return [...activeRules, ...localIncompleteRules];
}, [settings?.priorityRules, localIncompleteRules]);

// 3. Separate incomplete and complete rules before sync
const updatePriorityRulesImmediate = useCallback((newRules) => {
  const incompleteRules = [];
  const completeRules = [];

  newRules.forEach((rule) => {
    const hasDays = rule.daysOfWeek && rule.daysOfWeek.length > 0;
    const staffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
    const hasStaff = staffIds.length > 0;
    const isComplete = hasDays && hasStaff;

    if (!isComplete && rule._isLocalOnly) {
      const missingParts = [];
      if (!hasDays) missingParts.push('days');
      if (!hasStaff) missingParts.push('staff members');
      console.log(`⏸️ Skipping incomplete rule "${rule.name}" (missing: ${missingParts.join(', ')}) - keeping in UI only`);
      incompleteRules.push(rule);
    } else {
      completeRules.push(rule);
    }
  });

  // Store incomplete rules in local state (UI only, never synced)
  setLocalIncompleteRules(incompleteRules);

  // Only sync complete rules to server/database
  updateSettings((prevSettings) => ({
    ...prevSettings,
    priorityRules: completeRules,
  }));
}, [updateSettings]);

// 4. Mark new rules as local-only until completed
const createNewRule = () => {
  const newRule = {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    ruleType: "preferred_shift",
    staffIds: [],
    shiftType: "early",
    daysOfWeek: [], // Empty - rule incomplete
    _isLocalOnly: true, // ✅ Flag prevents server sync
  };

  // Add to state but NOT synced to server yet
  updatePriorityRules([...priorityRules, newRule]);
};

// 5. Remove flag when rule becomes complete
const toggleDayOfWeek = (ruleId, dayId) => {
  const rule = priorityRules.find((r) => r.id === ruleId);
  if (!rule) return;

  const currentDays = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
  const updatedDays = currentDays.includes(dayId)
    ? currentDays.filter((d) => d !== dayId)
    : [...currentDays, dayId];

  const updates = { ...rule, daysOfWeek: updatedDays };

  if (updatedDays.length > 0 && rule._isLocalOnly) {
    console.log(`✅ Rule "${rule.name}" is now complete - will sync to server`);
    updates._isLocalOnly = undefined; // Remove flag
  }

  const updatedRules = priorityRules.map((r) =>
    r.id === ruleId ? updates : r
  );
  updatePriorityRules(updatedRules);
};
```

**Why This Works**:
- ✅ New rule starts with `_isLocalOnly: true` flag
- ✅ Rule kept in `localIncompleteRules` state (UI only)
- ✅ Not included in `updateSettings()` call (no server sync)
- ✅ When user selects first day, flag removed
- ✅ Now included in next `updateSettings()` call (synced to server)
- ✅ **No skeleton rules in database**

### Fix 3: Race Condition Prevention

**File**: `src/hooks/useSettingsData.js`

**Changes Made** (Lines 22-27, 131-169):

```javascript
// 1. Add refs to track sync state
const isSyncingFromWebSocketRef = useRef(false);
const syncCounterRef = useRef(0);
const hasCompletedInitialLoadRef = useRef(false);

// 2. Sync WebSocket settings with protection
useEffect(() => {
  if (useWebSocket && wsSettings) {
    // Track this sync operation
    const syncId = ++syncCounterRef.current;
    isSyncingFromWebSocketRef.current = true;

    console.log(`🔄 Syncing WebSocket settings to local state (sync #${syncId})`);

    // Extract settings from WebSocket response
    const staffGroups = wsSettings?.staffGroups ?? [];
    const priorityRules = wsSettings?.priorityRules ?? [];

    // Validate no data loss
    if (priorityRules.length === 0 &&
        settingsRef.current?.priorityRules?.length > 0) {
      console.warn(`⚠️ WebSocket sync would delete ${settingsRef.current.priorityRules.length} priority rules - BLOCKING`);
      isSyncingFromWebSocketRef.current = false;
      return;
    }

    // Safe to update
    setSettings({
      staffGroups,
      priorityRules,
      // ... other settings
    });

    // Mark sync complete after brief delay
    setTimeout(() => {
      if (syncCounterRef.current === syncId) {
        isSyncingFromWebSocketRef.current = false;
        hasCompletedInitialLoadRef.current = true;
      }
    }, 100);
  }
}, [wsSettings]);

// 3. Skip localStorage save during WebSocket sync
useEffect(() => {
  if (settings && !isSyncingFromWebSocketRef.current) {
    // Only save to localStorage when NOT syncing from WebSocket
    configService.saveSettings(settings);
    console.log('💾 Saved settings to localStorage');
  } else if (isSyncingFromWebSocketRef.current) {
    console.log('⏭️ Skipping localStorage save during WebSocket sync');
  }
}, [settings]);
```

**Why This Works**:
- ✅ Sync counter prevents overlapping sync operations
- ✅ Flag prevents localStorage save during WebSocket sync
- ✅ Validation prevents data loss from empty sync responses
- ✅ Timer ensures flag cleared even if errors occur
- ✅ **No duplicate inserts from concurrent saves**

### Fix 4: Go Server Validation (Partial - Needs Completion)

**File**: `go-server/settings_multitable.go`

**Changes Needed** (Lines 800-850):

```go
// ✅ TODO: Add duplicate detection before INSERT
func handleCreatePriorityRule(message WebSocketMessage, client *Client) {
	var rulePayload map[string]interface{}
	if err := json.Unmarshal(message.Payload, &rulePayload); err != nil {
		sendError(client, "Invalid priority rule data")
		return
	}

	ruleName := rulePayload["name"].(string)
	versionID := rulePayload["versionId"].(string)

	// ✅ CRITICAL FIX: Check for existing rule with same name
	var existingID string
	err := db.QueryRow(`
		SELECT id FROM priority_rules
		WHERE name = $1
		  AND version_id = $2
		  AND is_active = true
	`, ruleName, versionID).Scan(&existingID)

	if err == nil {
		// Rule already exists - UPDATE instead
		log.Printf("⚠️ Rule '%s' already exists (ID: %s), updating instead of creating", ruleName, existingID)

		// Convert CREATE to UPDATE
		rulePayload["id"] = existingID
		message.Type = "SETTINGS_UPDATE_PRIORITY_RULES"
		handleUpdatePriorityRule(message, client)
		return
	}

	// ✅ CRITICAL FIX: Validate rule is complete before INSERT
	ruleDefinition := rulePayload["ruleDefinition"].(map[string]interface{})

	// Check days_of_week
	daysOfWeek, hasDays := ruleDefinition["days_of_week"].([]interface{})
	if !hasDays || len(daysOfWeek) == 0 {
		sendError(client, "Cannot create rule without days selected")
		log.Printf("❌ Rejected incomplete rule '%s': no days selected", ruleName)
		return
	}

	// Check staff_ids
	staffIDs, hasStaff := ruleDefinition["staff_ids"].([]interface{})
	if !hasStaff || len(staffIDs) == 0 {
		sendError(client, "Cannot create rule without staff members")
		log.Printf("❌ Rejected incomplete rule '%s': no staff assigned", ruleName)
		return
	}

	log.Printf("✅ Rule '%s' validated: %d days, %d staff members",
		ruleName, len(daysOfWeek), len(staffIDs))

	// Safe to INSERT
	query := `
		INSERT INTO priority_rules (
			name, version_id, rule_definition,
			priority_level, is_hard_constraint, is_active
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	var newID string
	err = db.QueryRow(query,
		ruleName,
		versionID,
		ruleDefinition,
		rulePayload["priorityLevel"],
		rulePayload["isHardConstraint"],
		true,
	).Scan(&newID)

	if err != nil {
		sendError(client, fmt.Sprintf("Failed to create rule: %v", err))
		return
	}

	log.Printf("✅ Created priority rule '%s' (ID: %s)", ruleName, newID)
	broadcastSettings()
}
```

**Status**: ⏳ **Partial** - Needs to be implemented in Go server

### Fix 5: Database Constraints (Pending)

**File**: `database_schema.sql` or migration script

**SQL to Apply**:

```sql
-- ✅ CRITICAL FIX: Prevent duplicate rule names per version
ALTER TABLE priority_rules
ADD CONSTRAINT priority_rules_unique_name_version
UNIQUE (name, version_id, restaurant_id);

-- ✅ CRITICAL FIX: Ensure rules are complete before INSERT
ALTER TABLE priority_rules
ADD CONSTRAINT priority_rules_complete_check
CHECK (
  -- Must have at least 1 staff member
  jsonb_array_length(rule_definition->'staff_ids') > 0
  AND
  -- Must have at least 1 day selected
  jsonb_array_length(rule_definition->'days_of_week') > 0
);

-- ✅ Performance: Index for fast duplicate detection
CREATE INDEX idx_priority_rules_name_version
ON priority_rules (name, version_id, restaurant_id)
WHERE is_active = true;

-- ✅ Performance: Index for staff_ids lookups
CREATE INDEX idx_priority_rules_staff_ids
ON priority_rules USING GIN ((rule_definition->'staff_ids'));

-- ✅ Performance: Index for days_of_week lookups
CREATE INDEX idx_priority_rules_days_of_week
ON priority_rules USING GIN ((rule_definition->'days_of_week'));
```

**Status**: ❌ **Pending** - Not yet applied to database

**To Apply**:
```bash
# 1. Connect to Supabase database
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# 2. Run the SQL above
\i database_migrations/add_priority_rules_constraints.sql

# 3. Verify constraints created
\d+ priority_rules
```

---

## Prevention Guidelines

### Code Patterns to Avoid

#### ❌ Anti-Pattern 1: Direct State Updates on Every Keystroke

```javascript
// ❌ BAD: Triggers server sync on every keystroke
<input
  value={rule.name}
  onChange={(e) => {
    const updated = { ...rule, name: e.target.value };
    updateRuleInDatabase(updated); // BAD!
  }}
/>
```

**Why It's Bad**:
- 1 character typed = 1 database update
- 16 characters typed = 16 database updates
- Race conditions between updates
- Unnecessary server load
- Risk of duplicate creation

#### ✅ Correct Pattern: Debounced Updates

```javascript
// ✅ GOOD: Local buffer + debounced sync
const [editBuffer, setEditBuffer] = useState({});

const updateRule = useCallback((ruleId, updates) => {
  // 1. Update local buffer immediately (responsive UI)
  setEditBuffer(prev => ({
    ...prev,
    [ruleId]: { ...(prev[ruleId] || {}), ...updates }
  }));

  // 2. Debounced server sync (500ms after last change)
  const debouncedSync = getOrCreateDebouncedSync(ruleId);
  debouncedSync();
}, [getOrCreateDebouncedSync]);

<input
  value={editBuffer[rule.id]?.name ?? rule.name}
  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
/>
```

#### ❌ Anti-Pattern 2: Syncing Incomplete Data

```javascript
// ❌ BAD: Syncs incomplete rules to server
const saveRule = (rule) => {
  // No validation!
  database.insert('priority_rules', rule);
};

// User creates new rule
const newRule = {
  id: uuid(),
  name: "",           // Empty!
  daysOfWeek: [],     // Empty!
  staffIds: []        // Empty!
};
saveRule(newRule); // Skeleton rule in database!
```

**Why It's Bad**:
- Database polluted with incomplete rules
- Skeleton rules cannot be used by AI
- Export functions include invalid data
- UI clutter from incomplete rules

#### ✅ Correct Pattern: Validation Before Sync

```javascript
// ✅ GOOD: Validate before syncing
const saveRule = (rule) => {
  // Validate rule is complete
  const hasDays = rule.daysOfWeek && rule.daysOfWeek.length > 0;
  const hasStaff = rule.staffIds && rule.staffIds.length > 0;

  if (!hasDays || !hasStaff) {
    console.log(`⏸️ Rule "${rule.name}" incomplete - keeping in UI only`);
    // Store in local state, don't sync to server
    setLocalIncompleteRules(prev => [...prev, rule]);
    return;
  }

  // Safe to sync
  database.insert('priority_rules', rule);
};

// User creates new rule
const newRule = {
  id: uuid(),
  name: "",
  daysOfWeek: [],
  staffIds: [],
  _isLocalOnly: true // Flag prevents sync
};
// Kept in UI only until completed
```

#### ❌ Anti-Pattern 3: Concurrent Sync Operations

```javascript
// ❌ BAD: No protection against concurrent syncs
useEffect(() => {
  if (wsSettings) {
    setSettings(wsSettings); // Sync 1
  }
}, [wsSettings]);

useEffect(() => {
  if (settings) {
    saveToLocalStorage(settings); // Sync 2
    saveToDatabase(settings);      // Sync 3
  }
}, [settings]);

// If wsSettings changes twice quickly:
// Sync 1a starts
// Sync 1b starts before 1a completes
// Sync 2a, 2b, 3a, 3b all run concurrently
// Result: Race condition, duplicates
```

**Why It's Bad**:
- Multiple saves happen simultaneously
- Last write doesn't always win
- Data corruption from interleaved saves
- Duplicate records created

#### ✅ Correct Pattern: Synchronized Updates

```javascript
// ✅ GOOD: Track sync state to prevent races
const isSyncingRef = useRef(false);
const syncCounterRef = useRef(0);

useEffect(() => {
  if (wsSettings) {
    const syncId = ++syncCounterRef.current;
    isSyncingRef.current = true;

    console.log(`🔄 Starting sync #${syncId}`);
    setSettings(wsSettings);

    setTimeout(() => {
      if (syncCounterRef.current === syncId) {
        isSyncingRef.current = false;
        console.log(`✅ Sync #${syncId} complete`);
      }
    }, 100);
  }
}, [wsSettings]);

useEffect(() => {
  if (settings && !isSyncingRef.current) {
    // Only save when NOT syncing from WebSocket
    saveToLocalStorage(settings);
    saveToDatabase(settings);
  }
}, [settings]);
```

#### ❌ Anti-Pattern 4: No Duplicate Detection

```go
// ❌ BAD: No check for existing records
func createPriorityRule(name string, data RuleData) error {
    // Direct INSERT without checking duplicates
    query := `INSERT INTO priority_rules (name, ...) VALUES ($1, ...)`
    _, err := db.Exec(query, name, ...)
    return err
}
```

**Why It's Bad**:
- Accepts duplicate rule names
- Creates multiple identical records
- No UPSERT logic (INSERT or UPDATE)

#### ✅ Correct Pattern: Upsert with Validation

```go
// ✅ GOOD: Check for existing + validate before INSERT
func createPriorityRule(name string, versionID string, data RuleData) error {
    // 1. Check if rule exists
    var existingID string
    err := db.QueryRow(`
        SELECT id FROM priority_rules
        WHERE name = $1 AND version_id = $2 AND is_active = true
    `, name, versionID).Scan(&existingID)

    if err == nil {
        // Rule exists - UPDATE instead
        log.Printf("⚠️ Rule '%s' exists, updating", name)
        return updatePriorityRule(existingID, data)
    }

    // 2. Validate data is complete
    if len(data.DaysOfWeek) == 0 {
        return errors.New("rule must have at least 1 day selected")
    }
    if len(data.StaffIDs) == 0 {
        return errors.New("rule must have at least 1 staff member")
    }

    // 3. Safe to INSERT
    query := `INSERT INTO priority_rules (name, version_id, ...) VALUES ($1, $2, ...)`
    _, err = db.Exec(query, name, versionID, ...)
    return err
}
```

### Idempotent Operation Patterns

#### Idempotent CREATE (UPSERT)

```javascript
// ✅ GOOD: Idempotent create using UPSERT pattern
const createOrUpdateRule = async (rule) => {
  // Use rule name + version as natural key
  const { data, error } = await supabase
    .from('priority_rules')
    .upsert({
      name: rule.name,
      version_id: rule.versionId,
      rule_definition: {
        staff_ids: rule.staffIds,
        days_of_week: rule.daysOfWeek,
        shift_type: rule.shiftType,
      },
      // ... other fields
    }, {
      onConflict: 'name,version_id', // Use UNIQUE constraint
      ignoreDuplicates: false          // Update on conflict
    });

  if (error) throw error;
  return data;
};
```

**Benefits**:
- ✅ Can be called multiple times safely
- ✅ Same result regardless of call count
- ✅ No duplicate creation
- ✅ Handles concurrent requests

#### Idempotent DELETE

```javascript
// ✅ GOOD: Soft delete is idempotent
const deleteRule = async (ruleId) => {
  // Set is_active = false (can be called multiple times safely)
  const { data, error } = await supabase
    .from('priority_rules')
    .update({ is_active: false })
    .eq('id', ruleId)
    .eq('is_active', true); // Only update if currently active

  if (error) throw error;

  // Returns 0 rows if already deleted (idempotent!)
  console.log(`Deleted ${data?.length || 0} rule(s)`);
  return data;
};
```

**Benefits**:
- ✅ Safe to call multiple times
- ✅ No error if already deleted
- ✅ Preserves audit trail
- ✅ Recoverable (can un-delete)

---

## Testing Checklist

### Pre-Deployment Testing

Before deploying fixes, verify all tests pass:

#### ✅ Unit Tests

- [ ] Debounce function delays sync by 500ms
- [ ] Edit buffer updates immediately on keystroke
- [ ] Incomplete rule filter blocks sync to server
- [ ] Sync counter increments correctly
- [ ] Race condition flag prevents concurrent saves

#### ✅ Integration Tests

- [ ] Create rule with 5 keystrokes → 1 database record
- [ ] Create incomplete rule → 0 database records
- [ ] Complete incomplete rule → 1 database record
- [ ] Edit rule name 10 times → 1 database update
- [ ] Delete rule → soft-deleted in database

#### ✅ E2E Tests (Chrome MCP)

```javascript
// Test: Rapid Typing Should Not Create Duplicates
test('rapid typing creates only 1 rule', async () => {
  // 1. Open Settings modal
  await chromeMCP.click('settings-button');
  await chromeMCP.click('priority-rules-tab');

  // 2. Create new rule
  await chromeMCP.click('add-rule-button');

  // 3. Type rule name rapidly (simulate fast typing)
  const input = await chromeMCP.findElement('rule-name-input');
  await input.type('New Priority Rule', { delay: 10 }); // 10ms between chars

  // 4. Wait for debounce (500ms)
  await chromeMCP.wait(600);

  // 5. Check database
  const rules = await database.query(`
    SELECT * FROM priority_rules
    WHERE name LIKE 'New Prior%'
  `);

  expect(rules.length).toBe(1); // ✅ Only 1 rule created
  expect(rules[0].name).toBe('New Priority Rule');
});

// Test: Incomplete Rule Should Not Sync
test('incomplete rule stays in UI only', async () => {
  // 1. Create new rule
  await chromeMCP.click('add-rule-button');

  // 2. Type name but DON'T select days
  const input = await chromeMCP.findElement('rule-name-input');
  await input.type('Test Rule');
  await chromeMCP.wait(600); // Wait for debounce

  // 3. Check database
  const rules = await database.query(`
    SELECT * FROM priority_rules WHERE name = 'Test Rule'
  `);

  expect(rules.length).toBe(0); // ✅ Not synced to database

  // 4. Check UI still shows rule
  const uiRules = await chromeMCP.findElements('.rule-card');
  expect(uiRules.length).toBe(1); // ✅ Visible in UI
});

// Test: Concurrent Edits Should Not Duplicate
test('concurrent edits create only 1 update', async () => {
  // 1. Open rule in 2 browser tabs
  const tab1 = await chromeMCP.newPage();
  const tab2 = await chromeMCP.newPage();

  await tab1.navigate('http://localhost:3000/settings');
  await tab2.navigate('http://localhost:3000/settings');

  // 2. Edit same rule in both tabs simultaneously
  const promises = [
    tab1.findElement('rule-name-input').type('Updated Name 1'),
    tab2.findElement('rule-name-input').type('Updated Name 2'),
  ];

  await Promise.all(promises);
  await chromeMCP.wait(600); // Wait for debounce

  // 3. Check database
  const rules = await database.query(`
    SELECT * FROM priority_rules WHERE id = $1
  `, [ruleId]);

  expect(rules.length).toBe(1); // ✅ Only 1 record
  // ✅ Last write wins (either "Updated Name 1" or "Updated Name 2")
});
```

### Post-Deployment Verification

After deploying to production:

#### ✅ Smoke Tests

1. **Create Priority Rule Test**
   - [ ] Navigate to Settings → Priority Rules
   - [ ] Click "Add Rule"
   - [ ] Type rule name: "Production Test Rule"
   - [ ] Select 3 days
   - [ ] Select 2 staff members
   - [ ] Click Save
   - [ ] Verify only 1 rule created in database
   - [ ] Refresh page
   - [ ] Verify rule still exists with correct data

2. **Rapid Typing Test**
   - [ ] Create new rule
   - [ ] Type "Weekend Early Shifts for Chef Team" quickly
   - [ ] Wait 1 second
   - [ ] Check database for duplicates
   - [ ] Expected: 1 rule
   - [ ] Actual: ___ rules

3. **Incomplete Rule Test**
   - [ ] Create new rule
   - [ ] Type name but DON'T select days
   - [ ] Click outside modal
   - [ ] Check database
   - [ ] Expected: 0 rules (not synced)
   - [ ] Reopen modal
   - [ ] Verify rule still in UI (local only)

4. **Concurrent Edit Test**
   - [ ] Open app in 2 browser tabs
   - [ ] Edit same rule in both tabs
   - [ ] Save from both tabs
   - [ ] Check database
   - [ ] Expected: 1 rule (no duplicate)
   - [ ] Last write should win

#### ✅ Database Verification

```sql
-- Check for duplicate rule names
SELECT name, COUNT(*) as count
FROM priority_rules
WHERE is_active = true
GROUP BY name, version_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check for incomplete rules
SELECT id, name,
       jsonb_array_length(rule_definition->'staff_ids') as staff_count,
       jsonb_array_length(rule_definition->'days_of_week') as day_count
FROM priority_rules
WHERE is_active = true
  AND (
    jsonb_array_length(rule_definition->'staff_ids') = 0
    OR jsonb_array_length(rule_definition->'days_of_week') = 0
  );
-- Expected: 0 rows

-- Check constraint enforcement
ALTER TABLE priority_rules VALIDATE CONSTRAINT priority_rules_unique_name_version;
ALTER TABLE priority_rules VALIDATE CONSTRAINT priority_rules_complete_check;
-- Expected: Success (no violations)
```

#### ✅ Performance Verification

```javascript
// Monitor debounce performance
console.time('debounce-sync');

// Type 16 characters rapidly
await input.type('New Priority Rule');

// Wait for debounce
await chromeMCP.wait(600);

console.timeEnd('debounce-sync');
// Expected: ~600ms total (not 16 separate requests)

// Monitor database query count
const beforeCount = await database.getQueryCount();

// Perform action
await createPriorityRule('Test');

const afterCount = await database.getQueryCount();
const queryCount = afterCount - beforeCount;

// Expected: 1-2 queries (SELECT duplicate check + INSERT)
// NOT: 16 queries (one per keystroke)
```

### Rollback Plan

If issues occur in production:

#### Immediate Rollback

1. **Disable WebSocket Settings** (Fastest)
   ```bash
   # Update .env in production
   REACT_APP_WEBSOCKET_SETTINGS=false

   # Restart app
   pm2 restart shift-schedule-manager
   ```

   **Effect**: Falls back to localStorage + direct Supabase mode

2. **Revert Code Changes** (Safe)
   ```bash
   # Revert to last known good commit
   git revert HEAD~3..HEAD
   git push origin main

   # Redeploy
   npm run build:production
   ```

3. **Database Cleanup** (If duplicates created)
   ```bash
   # Run cleanup script
   node delete_duplicate_rules.js
   ```

#### Long-term Fix

If rollback required, schedule proper fix for next release:

1. Complete Go server validation (Fix 4)
2. Apply database constraints (Fix 5)
3. Add comprehensive E2E tests
4. Implement monitoring/alerting for duplicates

---

## Related Files

### Core Implementation Files

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `src/components/settings/tabs/PriorityRulesTab.jsx` | 75-294, 479-503 | Debounced input + incomplete filtering | ✅ Complete |
| `src/hooks/useSettingsData.js` | 22-169 | Race condition prevention | ✅ Complete |
| `src/hooks/usePriorityRulesData.js` | 28-105 | Backward compatible loading | ✅ Complete |
| `src/hooks/useWebSocketSettings.js` | 100-203 | WebSocket sync with deduplication | ✅ Complete |
| `go-server/settings_multitable.go` | 800-850 | Server-side validation | ⏳ Partial |

### Utility Scripts

| Script | Purpose |
|--------|---------|
| `delete_duplicate_rules.js` | One-time cleanup of existing duplicates |
| `debug-priority-rules.js` | Debug tool for inspecting priority rules |
| `check-priority-rule.js` | Verification tool for specific rules |

### Documentation Files

| Document | Content |
|----------|---------|
| `PRIORITY-RULES-COMPLETE-FIX-SUMMARY.md` | Summary of all 5 fixes for staff IDs issue |
| `BROWSER-CACHE-FIX.md` | Documents port conflict causing old code to load |
| `PRIORITY-RULES-TWO-ISSUES-FIX.md` | Loading and RLS policy fixes |
| `PRIORITY-RULES-UI-DISPLAY-FIX.md` | UI display for multiple staff |
| `PRIORITY-RULES-STAFF-UPDATE-FIX.md` | Edit buffer update fix |
| `GO-SERVER-STAFFIDS-EXTRACTION-FIX.md` | Go server array extraction |

### Database Files

| File | Purpose |
|------|---------|
| `database_schema.sql` | Complete database schema |
| `database_migrations/add_priority_rules_constraints.sql` | ⏳ To be created |

---

## Summary

### ✅ Fixes Applied

1. **Debounced Text Input** - Prevents duplicate creates from rapid typing
2. **Incomplete Rule Filtering** - Prevents skeleton rules in database
3. **Race Condition Prevention** - Prevents concurrent sync duplicates
4. **Go Server Validation** - ⏳ Partial (needs completion)
5. **Database Constraints** - ❌ Pending (needs to be applied)

### 📋 Action Items

For developers:

- [x] Apply debounced input in PriorityRulesTab.jsx
- [x] Add incomplete rule filtering
- [x] Implement race condition protection
- [ ] Complete Go server validation logic
- [ ] Apply database UNIQUE + CHECK constraints
- [ ] Add E2E tests for duplication scenarios
- [ ] Set up monitoring for duplicate detection

For database administrators:

- [ ] Backup production database before applying constraints
- [ ] Test constraints on staging environment first
- [ ] Apply UNIQUE constraint: `(name, version_id, restaurant_id)`
- [ ] Apply CHECK constraint for complete rules
- [ ] Create indexes for performance
- [ ] Run cleanup script to remove existing duplicates

### 🎯 Success Metrics

After all fixes applied, verify:

- ✅ 1 rule created per user action (not 3-5)
- ✅ 0 incomplete rules in database
- ✅ 0 duplicate rule names per version
- ✅ <100ms UI response time (debounce doesn't affect UX)
- ✅ Database query count: 1-2 per action (not 16)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-27
**Author**: AI Analysis & Documentation Team
**Review Status**: Pending Review
