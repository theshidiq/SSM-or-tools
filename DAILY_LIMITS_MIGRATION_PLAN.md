# Daily Limits Migration Plan

## Executive Summary

This document outlines the migration path for daily limits data from **localStorage** to the **Supabase `daily_limits` table** via the **WebSocket multi-table backend architecture**. The migration leverages existing infrastructure (Go WebSocket server + React hooks) to ensure data consistency and real-time synchronization.

---

## 1. Current Architecture Overview

### 1.1 localStorage Format (Current State)

**Storage Location**: `localStorage['shift-schedule-settings']`

**Data Structure**:
```javascript
{
  "migrationVersion": 5,  // Current version with MIN constraints
  "dailyLimits": {
    "minOffPerDay": 0,           // NEW in v5 - Minimum staff off per day (0-4)
    "maxOffPerDay": 3,           // Maximum staff off per day (0-4)
    "minEarlyPerDay": 0,         // NEW in v5 - Minimum early shifts (0-2)
    "maxEarlyPerDay": 2,         // Maximum early shifts (0-2)
    "minLatePerDay": 0,          // NEW in v5 - Minimum late shifts (0-3)
    "maxLatePerDay": 3,          // Maximum late shifts (0-3)
    "minWorkingStaffPerDay": 3   // Fixed - minimum working staff (not configurable in UI)
  },
  // ... other settings (staffGroups, weeklyLimits, monthlyLimits, priorityRules, etc.)
}
```

**Key Characteristics**:
- **Simple object format**: 7 key-value pairs (3 MIN + 4 MAX constraints)
- **No metadata**: No created_at, updated_at, version tracking
- **No multi-tenancy**: Single restaurant assumption
- **No date scoping**: Applies globally to all dates
- **Latest Migration**: Version 5 (added MIN constraints on 2025-11-30)

### 1.2 Database Schema (Target State)

**Table**: `public.daily_limits`

**Structure**:
```sql
CREATE TABLE public.daily_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  limit_config JSONB NOT NULL DEFAULT '{
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }'::jsonb,
  penalty_weight NUMERIC DEFAULT 1.0,
  is_hard_constraint BOOLEAN DEFAULT false,
  effective_from DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Characteristics**:
- **Multi-tenant**: `restaurant_id` foreign key
- **Versioned**: `version_id` foreign key to `config_versions`
- **Named configurations**: Multiple daily limit sets per restaurant
- **Date-scoped**: `effective_from` / `effective_until` for seasonal rules
- **Constraint enforcement**: `penalty_weight` and `is_hard_constraint`
- **Soft delete**: `is_active` flag
- **Auto-timestamped**: `created_at` / `updated_at` with triggers
- **JSONB storage**: `limit_config` contains the actual limits object

---

## 2. Data Flow Architecture

### 2.1 Current WebSocket Integration

The daily limits table integrates with the **existing WebSocket multi-table backend** used by:
- `staff_groups`
- `weekly_limits`
- `monthly_limits`
- `priority_rules`
- `ml_model_configs`
- `staff_backup_assignments`

**Data Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  useSettingsData.js (React Hook)                                │
│  ├── Aggregates settings from all tables                        │
│  ├── Detects changes via updateSettings()                       │
│  └── Calls wsUpdateDailyLimits() on change                      │
├─────────────────────────────────────────────────────────────────┤
│  useWebSocketSettings.js (WebSocket Hook)                       │
│  ├── updateDailyLimits(limitData)                               │
│  ├── Sends SETTINGS_UPDATE_DAILY_LIMITS message                 │
│  └── Receives SETTINGS_SYNC_RESPONSE with new data              │
├─────────────────────────────────────────────────────────────────┤
│                    GO WEBSOCKET SERVER                          │
│                    (Port 8080)                                   │
├─────────────────────────────────────────────────────────────────┤
│  settings_multitable.go                                         │
│  ├── handleSettingsUpdateDailyLimits()                          │
│  ├── Updates daily_limits table via Supabase                    │
│  ├── Broadcasts to all connected clients                        │
│  └── Sends SETTINGS_SYNC_RESPONSE                               │
├─────────────────────────────────────────────────────────────────┤
│                    SUPABASE POSTGRESQL                          │
├─────────────────────────────────────────────────────────────────┤
│  daily_limits table                                             │
│  ├── Stores limit_config as JSONB                               │
│  ├── Triggers update_daily_limits_updated_at()                  │
│  └── RLS policies for authenticated users                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 ConfigurationService Integration

**Current State** (ConfigurationService.js lines 643-700):
- `getDailyLimits()`: Returns from localStorage
- `updateDailyLimits()`: Saves to localStorage ONLY
- **WebSocket mode disabled**: `REACT_APP_WEBSOCKET_SETTINGS=true` prevents database sync

**Key Code** (lines 415-431):
```javascript
const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

// ✅ CRITICAL: Only sync when WebSocket is DISABLED
// When enabled, Go server manages database - ConfigurationService must NOT interfere
if (this.isSupabaseEnabled && !WEBSOCKET_SETTINGS_ENABLED) {
  const syncResult = await this.syncToDatabase();
  if (syncResult.success) {
    console.log("✅ Settings auto-synced to database (localStorage mode)");
  }
} else if (WEBSOCKET_SETTINGS_ENABLED) {
  console.log("⏭️ ConfigurationService sync DISABLED - WebSocket mode handles database operations");
}
```

**Migration Flow** (lines 663-700):
```javascript
/**
 * Update daily limits configuration
 *
 * **WebSocket Integration:**
 * - In WebSocket mode (REACT_APP_WEBSOCKET_SETTINGS=true), this method updates localStorage only
 * - The actual database update is handled by useSettingsData.js via wsUpdateDailyLimits()
 * - Change detection in useSettingsData compares old vs new dailyLimits and sends WebSocket message
 * - Go server receives SETTINGS_UPDATE_DAILY_LIMITS message and updates daily_limits table
 * - Server broadcasts changes to all connected clients for real-time sync
 */
async updateDailyLimits(dailyLimits) {
  await this.initialize();
  console.log("💾 Updating daily limits:", dailyLimits);

  this.settings.dailyLimits = {
    ...this.settings.dailyLimits,
    ...dailyLimits,
  };

  await this.saveSettings(this.settings);
  console.log("✅ Daily limits updated successfully");
  return this.settings.dailyLimits;
}
```

### 2.3 useSettingsData Change Detection

**Current Implementation** (useSettingsData.js lines 744-753):
```javascript
// Detect and update daily limits
const oldDailyLimits = oldSettings.dailyLimits || {};
const newDailyLimits = newSettings.dailyLimits || {};

if (JSON.stringify(oldDailyLimits) !== JSON.stringify(newDailyLimits)) {
  console.log("  - Updating daily_limits table");
  console.log("    Old limits:", oldDailyLimits);
  console.log("    New limits:", newDailyLimits);
  callbacks.wsUpdateDailyLimits(newDailyLimits);
}
```

**WebSocket Message** (useWebSocketSettings.js lines 630-665):
```javascript
const updateDailyLimits = useCallback((limitData) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    const message = {
      type: MESSAGE_TYPES.SETTINGS_UPDATE_DAILY_LIMITS,
      payload: { limit: limitData },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current,
    };

    wsRef.current.send(JSON.stringify(message));
    console.log("📤 Phase 3 Settings: Sent daily limits update:", limitData);
    return Promise.resolve();
  }
}, [enabled]);
```

---

## 3. Data Mapping: localStorage → Database

### 3.1 Field Mapping

| localStorage Key | Database Column | Mapping Rule | Notes |
|-----------------|----------------|--------------|-------|
| `dailyLimits` (object) | `limit_config` (JSONB) | **Direct copy** | Entire object stored as JSONB |
| `dailyLimits.minOffPerDay` | `limit_config->minOffPerDay` | Direct field | Default: 0 |
| `dailyLimits.maxOffPerDay` | `limit_config->maxOffPerDay` | Direct field | Default: 3 |
| `dailyLimits.minEarlyPerDay` | `limit_config->minEarlyPerDay` | Direct field | Default: 0 (v5) |
| `dailyLimits.maxEarlyPerDay` | `limit_config->maxEarlyPerDay` | Direct field | Default: 2 |
| `dailyLimits.minLatePerDay` | `limit_config->minLatePerDay` | Direct field | Default: 0 (v5) |
| `dailyLimits.maxLatePerDay` | `limit_config->maxLatePerDay` | Direct field | Default: 3 |
| `dailyLimits.minWorkingStaffPerDay` | `limit_config->minWorkingStaffPerDay` | Direct field | Fixed at 3 |
| N/A | `name` | **Generated** | "Default Daily Constraints" |
| N/A | `restaurant_id` | **From DB lookup** | First restaurant in `restaurants` table |
| N/A | `version_id` | **From DB lookup** | Active version in `config_versions` |
| N/A | `penalty_weight` | **Default** | 1.0 |
| N/A | `is_hard_constraint` | **Default** | false |
| N/A | `effective_from` | **Default** | NULL (applies to all dates) |
| N/A | `effective_until` | **Default** | NULL (no expiration) |
| N/A | `is_active` | **Default** | true |
| N/A | `created_at` | **Auto-generated** | now() |
| N/A | `updated_at` | **Auto-generated** | now() |

### 3.2 Example Transformation

**Input** (localStorage):
```json
{
  "dailyLimits": {
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }
}
```

**Output** (SQL INSERT):
```sql
INSERT INTO public.daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  effective_from,
  effective_until,
  is_active
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- restaurant_id from DB
  'f9e8d7c6-b5a4-3210-fedc-ba9876543210',  -- version_id from DB
  'Default Daily Constraints',
  '{
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }'::jsonb,
  1.0,       -- penalty_weight
  false,     -- is_hard_constraint
  NULL,      -- effective_from (applies to all dates)
  NULL,      -- effective_until (no expiration)
  true       -- is_active
);
```

---

## 4. Migration Strategy

### 4.1 Migration Path Options

#### Option A: Automatic Migration via `wsMigrateSettings()` (RECOMMENDED)

**Pros**:
- ✅ Uses existing migration infrastructure (already tested)
- ✅ Handles all settings tables in one operation
- ✅ Validates data structure before insertion
- ✅ Broadcasts to all connected clients
- ✅ Zero manual SQL required

**Cons**:
- ⚠️ Migrates ALL settings (not just daily limits)
- ⚠️ Requires WebSocket connection

**Implementation**:
```javascript
// In React component or migration script
import { useSettingsData } from './hooks/useSettingsData';

const { migrateToBackend } = useSettingsData();

// Trigger migration
await migrateToBackend();
```

**What happens**:
1. `migrateToBackend()` reads `localStorage['shift-schedule-settings']`
2. Sends `SETTINGS_MIGRATE` message to Go server
3. Go server parses daily limits and inserts into `daily_limits` table
4. Server broadcasts `SETTINGS_SYNC_RESPONSE` to all clients
5. React state updates with database data

#### Option B: Manual SQL Migration (FALLBACK)

**Pros**:
- ✅ Works without WebSocket connection
- ✅ Direct database control
- ✅ Can migrate historical data

**Cons**:
- ⚠️ Requires manual SQL execution
- ⚠️ No automatic broadcast to clients
- ⚠️ Must manually lookup restaurant_id and version_id

**Implementation**:
```javascript
// Step 1: Extract data from localStorage (in browser console)
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
console.log(JSON.stringify(settings.dailyLimits, null, 2));

// Step 2: Get restaurant and version IDs (Supabase SQL Editor)
SELECT id AS restaurant_id FROM public.restaurants LIMIT 1;
SELECT id AS version_id FROM public.config_versions
WHERE is_active = true
ORDER BY version_number DESC
LIMIT 1;

// Step 3: Insert into daily_limits table
INSERT INTO public.daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  is_active
) VALUES (
  '<restaurant_id_from_step_2>',
  '<version_id_from_step_2>',
  'Default Daily Constraints (Migrated from localStorage)',
  '<paste_dailyLimits_json_from_step_1>'::jsonb,
  true
);
```

### 4.2 Migration Pre-Checks

**Before migration, verify**:

1. **Database table exists**:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'daily_limits'
);
-- Expected: true
```

2. **Restaurant exists**:
```sql
SELECT COUNT(*) FROM public.restaurants;
-- Expected: >= 1
```

3. **Active config version exists**:
```sql
SELECT COUNT(*) FROM public.config_versions WHERE is_active = true;
-- Expected: >= 1
```

4. **localStorage has daily limits**:
```javascript
// Browser console
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
console.log('Has dailyLimits:', !!settings?.dailyLimits);
console.log('Migration version:', settings?.migrationVersion);
// Expected: true, 5
```

5. **WebSocket is enabled** (for Option A):
```javascript
// Check .env file or runtime config
console.log('WebSocket enabled:', process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true');
// Expected: true for Option A
```

---

## 5. Step-by-Step Migration Guide

### 5.1 Automated Migration (Option A)

#### Prerequisites
1. ✅ REACT_APP_WEBSOCKET_SETTINGS=true
2. ✅ Go WebSocket server running (localhost:8080)
3. ✅ Supabase database accessible
4. ✅ localStorage has populated daily limits

#### Steps

**Step 1: Verify Current State**
```javascript
// Browser console (http://localhost:3000)
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
console.log('📊 Current daily limits:', settings.dailyLimits);
console.log('📌 Migration version:', settings.migrationVersion);
```

**Expected output**:
```javascript
📊 Current daily limits: {
  minOffPerDay: 0,
  maxOffPerDay: 3,
  minEarlyPerDay: 0,
  maxEarlyPerDay: 2,
  minLatePerDay: 0,
  maxLatePerDay: 3,
  minWorkingStaffPerDay: 3
}
📌 Migration version: 5
```

**Step 2: Check Database State (Before)**
```sql
-- Supabase SQL Editor
SELECT COUNT(*) AS total_daily_limits FROM public.daily_limits;
-- Expected: 0 (empty table)
```

**Step 3: Trigger Migration**
```javascript
// Option 3A: Via React DevTools (recommended for testing)
// 1. Open React DevTools
// 2. Find component using useSettingsData hook
// 3. Call migrateToBackend() from component state

// Option 3B: Via browser console
// (Requires exposing migration function globally)
window.migrateSettings();

// Option 3C: Add migration button to Settings UI
// <button onClick={migrateToBackend}>Migrate to Database</button>
```

**Step 4: Monitor Migration**
```javascript
// Watch browser console for migration logs
// Expected output:
🚀 Starting localStorage → multi-table backend migration
📤 Phase 3 Settings: Sent settings migration (localStorage → multi-table)
✅ Migration complete (localStorage → multi-table backend)
  - Daily Limits: 1 config
  - Staff Groups: 8 items
  - ...
```

**Step 5: Verify Database State (After)**
```sql
-- Supabase SQL Editor
SELECT
  id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  is_active,
  created_at
FROM public.daily_limits
WHERE is_active = true;
```

**Expected result**:
```
id                                   | name                    | limit_config                        | penalty_weight | is_hard_constraint | is_active | created_at
------------------------------------ | ----------------------- | ----------------------------------- | -------------- | ------------------ | --------- | ----------
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Default Daily Constr... | {"minOffPerDay": 0, "maxOffPerDay"... | 1.0            | false              | true      | 2025-12-01 ...
```

**Step 6: Verify Real-Time Sync**
```javascript
// Browser console
// Make a change to daily limits
const { updateSettings } = useSettingsData();
updateSettings({
  ...settings,
  dailyLimits: {
    ...settings.dailyLimits,
    maxOffPerDay: 4  // Changed from 3 to 4
  }
});

// Watch for WebSocket message
// Expected:
📤 Phase 3 Settings: Sent daily limits update: { maxOffPerDay: 4, ... }
```

**Step 7: Verify Database Update**
```sql
-- Supabase SQL Editor (after 1-2 seconds)
SELECT
  limit_config->>'maxOffPerDay' AS max_off,
  updated_at
FROM public.daily_limits
WHERE is_active = true;
```

**Expected**:
```
max_off | updated_at
------- | ----------
4       | 2025-12-01 ... (timestamp should be recent)
```

### 5.2 Manual Migration (Option B - Fallback)

#### Prerequisites
1. ✅ Supabase SQL Editor access
2. ✅ Browser console access
3. ✅ localStorage has populated daily limits

#### Steps

**Step 1: Extract localStorage Data**
```javascript
// Browser console
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
const dailyLimitsJson = JSON.stringify(settings.dailyLimits, null, 2);
console.log('Copy this JSON for Step 3:');
console.log(dailyLimitsJson);
```

**Output**:
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

**Step 2: Get Restaurant and Version IDs**
```sql
-- Supabase SQL Editor
-- Get restaurant ID
SELECT id AS restaurant_id FROM public.restaurants LIMIT 1;

-- Get active config version ID
SELECT id AS version_id
FROM public.config_versions
WHERE is_active = true
ORDER BY version_number DESC
LIMIT 1;
```

**Output**:
```
restaurant_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
version_id: f9e8d7c6-b5a4-3210-fedc-ba9876543210
```

**Step 3: Insert Daily Limits**
```sql
-- Replace placeholders with actual IDs from Step 2
INSERT INTO public.daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  is_active
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Replace with your restaurant_id
  'f9e8d7c6-b5a4-3210-fedc-ba9876543210',  -- Replace with your version_id
  'Default Daily Constraints (Manual Migration)',
  '{
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }'::jsonb,
  1.0,
  false,
  true
) RETURNING id, name, limit_config;
```

**Step 4: Verify Insertion**
```sql
SELECT
  id,
  name,
  limit_config,
  created_at,
  updated_at
FROM public.daily_limits
WHERE is_active = true;
```

**Step 5: Refresh React App**
```javascript
// Browser console - force WebSocket sync
// Option A: Reload page
window.location.reload();

// Option B: Trigger manual sync (if available)
// This depends on exposing sync function in UI
```

---

## 6. Verification Queries

### 6.1 Database Verification

**Query 1: Count Daily Limit Records**
```sql
SELECT
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE is_active = true) AS active_records,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_records
FROM public.daily_limits;
```

**Expected** (after migration):
```
total_records | active_records | inactive_records
------------- | -------------- | ----------------
1             | 1              | 0
```

**Query 2: View Daily Limit Configuration**
```sql
SELECT
  id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  effective_from,
  effective_until,
  is_active,
  created_at,
  updated_at
FROM public.daily_limits
WHERE is_active = true;
```

**Query 3: Extract JSONB Fields**
```sql
SELECT
  name,
  limit_config->>'minOffPerDay' AS min_off,
  limit_config->>'maxOffPerDay' AS max_off,
  limit_config->>'minEarlyPerDay' AS min_early,
  limit_config->>'maxEarlyPerDay' AS max_early,
  limit_config->>'minLatePerDay' AS min_late,
  limit_config->>'maxLatePerDay' AS max_late,
  limit_config->>'minWorkingStaffPerDay' AS min_working
FROM public.daily_limits
WHERE is_active = true;
```

**Expected**:
```
name                        | min_off | max_off | min_early | max_early | min_late | max_late | min_working
--------------------------- | ------- | ------- | --------- | --------- | -------- | -------- | -----------
Default Daily Constraints   | 0       | 3       | 0         | 2         | 0        | 3        | 3
```

**Query 4: Check Relationships**
```sql
SELECT
  dl.id,
  dl.name,
  r.name AS restaurant_name,
  cv.version_number,
  cv.name AS version_name
FROM public.daily_limits dl
JOIN public.restaurants r ON dl.restaurant_id = r.id
JOIN public.config_versions cv ON dl.version_id = cv.id
WHERE dl.is_active = true;
```

**Query 5: Test Trigger (Updated Timestamp)**
```sql
-- Update a daily limit
UPDATE public.daily_limits
SET limit_config = jsonb_set(
  limit_config,
  '{maxOffPerDay}',
  '4'::jsonb
)
WHERE is_active = true;

-- Verify updated_at changed
SELECT
  name,
  limit_config->>'maxOffPerDay' AS max_off,
  created_at,
  updated_at,
  (updated_at > created_at) AS trigger_worked
FROM public.daily_limits
WHERE is_active = true;
```

**Expected**:
```
name                      | max_off | created_at          | updated_at          | trigger_worked
------------------------- | ------- | ------------------- | ------------------- | --------------
Default Daily Constraints | 4       | 2025-12-01 10:00:00 | 2025-12-01 10:01:23 | true
```

### 6.2 React State Verification

**Verification 1: Check WebSocket Settings Hook**
```javascript
// Browser console
const wsSettings = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  .renderers.get(1)
  .findFiberByHostInstance(document.querySelector('[data-testid="settings-panel"]'))
  .return.memoizedState.memoizedState;

console.log('WebSocket settings:', wsSettings.settings?.dailyLimits);
console.log('Connection status:', wsSettings.connectionStatus);
console.log('Is connected:', wsSettings.isConnected);
```

**Verification 2: Check useSettingsData Hook**
```javascript
// Browser console (via React DevTools)
// 1. Open React DevTools
// 2. Select component using useSettingsData
// 3. View Hooks > settings.dailyLimits

// Or use global window function (if exposed)
console.log('Settings:', window.__appSettings?.dailyLimits);
```

**Verification 3: Monitor WebSocket Messages**
```javascript
// Browser console - enable verbose logging
localStorage.setItem('debug', 'websocket:*');

// Make a change
const { updateSettings } = useSettingsData();
updateSettings({
  dailyLimits: {
    minOffPerDay: 0,
    maxOffPerDay: 4,  // Changed
    minEarlyPerDay: 0,
    maxEarlyPerDay: 2,
    minLatePerDay: 0,
    maxLatePerDay: 3,
    minWorkingStaffPerDay: 3
  }
});

// Watch for messages:
// 📤 SETTINGS_UPDATE_DAILY_LIMITS sent
// 📥 SETTINGS_SYNC_RESPONSE received
```

---

## 7. Rollback Strategy

### 7.1 Immediate Rollback (Emergency)

**If migration fails or causes issues**:

**Step 1: Disable WebSocket Mode**
```bash
# .env file
REACT_APP_WEBSOCKET_SETTINGS=false
```

**Step 2: Restart Application**
```bash
npm start
```

**Step 3: Verify localStorage Fallback**
```javascript
// Browser console
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
console.log('Using localStorage:', !!settings.dailyLimits);
console.log('Daily limits:', settings.dailyLimits);
```

**Result**: Application falls back to localStorage-only mode, ignoring database.

### 7.2 Data Rollback (Restore Previous State)

**If database data is corrupted**:

**Step 1: Delete Migrated Data**
```sql
-- Soft delete (recommended - preserves data)
UPDATE public.daily_limits
SET is_active = false
WHERE name LIKE '%Migration%' OR name LIKE '%Default Daily Constraints%';

-- Hard delete (only if needed)
-- DELETE FROM public.daily_limits WHERE is_active = false;
```

**Step 2: Restore from localStorage Backup**
```javascript
// If you backed up localStorage before migration
const backup = JSON.parse(localStorage.getItem('shift-schedule-settings-backup'));
localStorage.setItem('shift-schedule-settings', JSON.stringify(backup));
```

**Step 3: Re-run Migration**
```javascript
// After fixing the issue, try migration again
await migrateToBackend();
```

### 7.3 Partial Rollback (Database Active, localStorage Sync Disabled)

**Keep database active but disable automatic sync**:

```javascript
// ConfigurationService.js (line 415-431)
// Change feature flag check
const WEBSOCKET_SETTINGS_ENABLED = false;  // Force disable

// This keeps database readable but prevents automatic writes
```

---

## 8. Post-Migration Cleanup

### 8.1 Optional: Remove localStorage Data

**After successful migration and verification**:

```javascript
// Browser console - ONLY after confirming database migration works
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));

// Backup first (just in case)
localStorage.setItem('shift-schedule-settings-backup', JSON.stringify(settings));

// Remove dailyLimits from localStorage (database is now source of truth)
delete settings.dailyLimits;
localStorage.setItem('shift-schedule-settings', JSON.stringify(settings));

console.log('✅ Daily limits removed from localStorage (now using database)');
```

**⚠️ WARNING**: Only do this AFTER:
1. ✅ Verified database has correct data
2. ✅ Tested real-time sync works
3. ✅ Confirmed UI updates correctly

### 8.2 Code Cleanup (Future)

**Files that can be simplified after migration**:

1. **ConfigurationService.js** (lines 643-700):
   - Remove `getDailyLimits()` method
   - Remove `updateDailyLimits()` method
   - Remove localStorage fallback logic

2. **useSettingsData.js** (lines 192-196):
   - Remove fallback defaults
   - Rely solely on WebSocket data

3. **Migration code** (ConfigurationService.js lines 298-378):
   - Migration v5 logic can be archived
   - Keep for reference but mark as legacy

---

## 9. Common Issues & Troubleshooting

### Issue 1: Migration Function Not Found

**Symptom**:
```
Uncaught ReferenceError: migrateToBackend is not defined
```

**Cause**: Function not exposed in component scope

**Solution**:
```javascript
// Option A: Use React DevTools
// 1. Open React DevTools
// 2. Find SettingsPanel component
// 3. Hooks > migrateToBackend > right-click > Store as global variable
// 4. Call temp1() in console

// Option B: Add migration button to UI
// src/components/SettingsPanel.jsx
const { migrateToBackend } = useSettingsData();
<button onClick={migrateToBackend}>Migrate to Database</button>
```

### Issue 2: WebSocket Not Connected

**Symptom**:
```
❌ Failed to migrate settings - not connected
```

**Cause**: Go server not running or WebSocket disabled

**Solution**:
```bash
# Check if Go server is running
curl http://localhost:8080/health

# Start Go server
cd go-server
go run main.go

# Check WebSocket feature flag
grep WEBSOCKET .env
# Should show: REACT_APP_WEBSOCKET_SETTINGS=true
```

### Issue 3: Restaurant/Version Not Found

**Symptom**:
```
ERROR: insert or update on table "daily_limits" violates foreign key constraint
```

**Cause**: No restaurant or config version in database

**Solution**:
```sql
-- Check if restaurant exists
SELECT COUNT(*) FROM public.restaurants;

-- If 0, create restaurant
INSERT INTO public.restaurants (name, timezone)
VALUES ('Default Restaurant', 'Asia/Tokyo')
RETURNING id;

-- Check if config version exists
SELECT COUNT(*) FROM public.config_versions WHERE is_active = true;

-- If 0, create version
INSERT INTO public.config_versions (
  restaurant_id,
  version_number,
  name,
  is_active
) VALUES (
  '<restaurant_id_from_above>',
  1,
  'Default Configuration',
  true
) RETURNING id;
```

### Issue 4: Database Has Multiple Daily Limit Records

**Symptom**:
```
Multiple active daily limits found for restaurant/version
```

**Cause**: Duplicate migrations or manual inserts

**Solution**:
```sql
-- Find duplicates
SELECT
  restaurant_id,
  version_id,
  COUNT(*) AS count
FROM public.daily_limits
WHERE is_active = true
GROUP BY restaurant_id, version_id
HAVING COUNT(*) > 1;

-- Soft-delete older duplicates (keep most recent)
UPDATE public.daily_limits
SET is_active = false
WHERE id NOT IN (
  SELECT id
  FROM public.daily_limits
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1
);
```

### Issue 5: React State Not Updating

**Symptom**: Database has new data but UI shows old values

**Cause**: WebSocket sync not working or cache issue

**Solution**:
```javascript
// Force WebSocket resync
// Option A: Reload page
window.location.reload();

// Option B: Reconnect WebSocket
const { reconnect } = useWebSocketSettings();
reconnect();

// Option C: Clear React Query cache (if used)
queryClient.invalidateQueries(['settings']);
```

---

## 10. Success Criteria

### ✅ Migration Complete When:

1. **Database has data**:
   ```sql
   SELECT COUNT(*) FROM public.daily_limits WHERE is_active = true;
   -- Expected: >= 1
   ```

2. **UI displays database data**:
   ```javascript
   console.log('Backend mode:', useSettingsData().backendMode);
   // Expected: "websocket-multitable"
   ```

3. **Real-time sync works**:
   - Change daily limit in UI → Database updates within 1 second
   - Change database directly → UI updates within 1 second

4. **Validation passes**:
   ```javascript
   // All MIN values <= MAX values
   assert(dailyLimits.minOffPerDay <= dailyLimits.maxOffPerDay);
   assert(dailyLimits.minEarlyPerDay <= dailyLimits.maxEarlyPerDay);
   assert(dailyLimits.minLatePerDay <= dailyLimits.maxLatePerDay);
   ```

5. **No console errors**:
   - No WebSocket disconnections
   - No database constraint violations
   - No React rendering errors

---

## 11. Next Steps After Migration

### Phase 1: Monitoring (Week 1)
- [ ] Monitor database writes (check `updated_at` timestamps)
- [ ] Monitor WebSocket messages (check browser console)
- [ ] Verify no localStorage fallback warnings
- [ ] Check for duplicate records daily

### Phase 2: Optimization (Week 2)
- [ ] Add database indexes if query performance is slow
- [ ] Enable query result caching in Supabase
- [ ] Review WebSocket reconnection logs
- [ ] Optimize JSONB query patterns

### Phase 3: Advanced Features (Month 1)
- [ ] Add date-scoped daily limits (effective_from / effective_until)
- [ ] Implement hard constraints (is_hard_constraint = true)
- [ ] Add penalty weights for soft constraints
- [ ] Create seasonal daily limit configurations

### Phase 4: Cleanup (Month 2)
- [ ] Archive localStorage migration code
- [ ] Remove fallback defaults from useSettingsData
- [ ] Simplify ConfigurationService
- [ ] Document final architecture

---

## 12. References

### Documentation
- `DAILY_LIMITS_TABLE_SCHEMA.md` - Database schema and table structure
- `ConfigurationService.js` - localStorage management and migration logic
- `useSettingsData.js` - React state management and change detection
- `useWebSocketSettings.js` - WebSocket communication layer

### Database Tables
- `public.daily_limits` - Daily limit configurations
- `public.restaurants` - Restaurant multi-tenancy
- `public.config_versions` - Configuration versioning

### WebSocket Messages
- `SETTINGS_UPDATE_DAILY_LIMITS` - Update existing daily limits
- `SETTINGS_SYNC_RESPONSE` - Broadcast updated settings to clients
- `SETTINGS_MIGRATE` - Migrate localStorage to database

---

**Document Version**: 1.0
**Last Updated**: 2025-12-01
**Author**: System Architecture Analysis
**Status**: Ready for Implementation
