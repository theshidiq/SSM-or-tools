# Daily Limits Migration - Executive Summary

## Overview

This document provides a quick-reference summary of the daily limits migration from localStorage to the Supabase database.

---

## Current State Analysis

### What's in localStorage Right Now

```javascript
{
  "migrationVersion": 5,  // Latest version (added MIN constraints)
  "dailyLimits": {
    "minOffPerDay": 0,           // NEW in v5
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,         // NEW in v5
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,          // NEW in v5
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }
}
```

**Key Facts**:
- ✅ Data exists in localStorage
- ✅ Migration v5 completed (MIN constraints added)
- ✅ 7 constraint fields (3 MIN + 4 MAX)
- ⚠️ No database persistence yet

### What's in the Database Right Now

```sql
SELECT COUNT(*) FROM public.daily_limits;
-- Expected Result: 0 (table is EMPTY)
```

**Key Facts**:
- ✅ Table exists (`daily_limits`)
- ✅ Schema is correct (JSONB limit_config)
- ✅ Indexes created
- ✅ RLS policies enabled
- ❌ No data migrated yet

---

## Data Transformation

### localStorage → Database Mapping

| Source (localStorage) | Target (Database) | Action |
|-----------------------|-------------------|--------|
| `dailyLimits` object | `limit_config` JSONB | **Copy entire object** |
| N/A | `restaurant_id` UUID | **Lookup from DB** |
| N/A | `version_id` UUID | **Lookup from DB** |
| N/A | `name` VARCHAR | **Set to "Default Daily Constraints"** |
| N/A | `penalty_weight` NUMERIC | **Default: 1.0** |
| N/A | `is_hard_constraint` BOOLEAN | **Default: false** |
| N/A | `effective_from` DATE | **Default: NULL** (all dates) |
| N/A | `effective_until` DATE | **Default: NULL** (no expiration) |
| N/A | `is_active` BOOLEAN | **Default: true** |

### Example Transformation

**Before** (localStorage):
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

**After** (Database Row):
```sql
INSERT INTO daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  is_active
) VALUES (
  'a1b2c3d4-...',  -- From restaurants table
  'f9e8d7c6-...',  -- From config_versions table
  'Default Daily Constraints',
  '{"minOffPerDay": 0, "maxOffPerDay": 3, ...}'::jsonb,
  true
);
```

---

## Migration Options

### Option A: Automatic (Recommended)

**Use the existing migration infrastructure**:

```javascript
// In React app
const { migrateToBackend } = useSettingsData();
await migrateToBackend();
```

**What happens**:
1. Reads `localStorage['shift-schedule-settings']`
2. Sends `SETTINGS_MIGRATE` WebSocket message to Go server
3. Go server inserts into `daily_limits` table
4. Broadcasts updated settings to all clients
5. React state updates automatically

**Pros**:
- ✅ Zero SQL required
- ✅ Migrates all settings tables at once
- ✅ Real-time broadcast to all clients
- ✅ Validated data structure

**Cons**:
- ⚠️ Requires WebSocket connection
- ⚠️ Requires Go server running

### Option B: Manual SQL (Fallback)

**Direct database insertion**:

```sql
-- Step 1: Get IDs
SELECT id FROM restaurants LIMIT 1;  -- Copy this ID
SELECT id FROM config_versions WHERE is_active = true LIMIT 1;  -- Copy this ID

-- Step 2: Insert daily limits
INSERT INTO daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config
) VALUES (
  '<paste-restaurant-id>',
  '<paste-version-id>',
  'Default Daily Constraints',
  '{"minOffPerDay": 0, "maxOffPerDay": 3, "minEarlyPerDay": 0, "maxEarlyPerDay": 2, "minLatePerDay": 0, "maxLatePerDay": 3, "minWorkingStaffPerDay": 3}'::jsonb
);
```

**Pros**:
- ✅ Works without WebSocket
- ✅ Direct database control

**Cons**:
- ⚠️ Manual SQL execution
- ⚠️ No automatic broadcast to clients
- ⚠️ Requires page refresh

---

## Quick Start: 5-Minute Migration

### Prerequisites Check
```bash
# 1. Check WebSocket is enabled
grep WEBSOCKET .env
# Expected: REACT_APP_WEBSOCKET_SETTINGS=true

# 2. Check Go server is running
curl http://localhost:8080/health
# Expected: HTTP 200

# 3. Check database table exists
# Supabase SQL Editor:
SELECT COUNT(*) FROM daily_limits;
# Expected: 0
```

### Migration Steps
```javascript
// Step 1: Browser console - check localStorage
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
console.log('Daily limits:', settings.dailyLimits);

// Step 2: Trigger migration (via React DevTools or exposed function)
await migrateToBackend();

// Step 3: Verify in Supabase
// SQL Editor:
SELECT * FROM daily_limits WHERE is_active = true;
```

### Verification
```sql
-- Should see 1 row with your daily limits
SELECT
  name,
  limit_config->>'minOffPerDay' AS min_off,
  limit_config->>'maxOffPerDay' AS max_off,
  created_at
FROM daily_limits
WHERE is_active = true;
```

---

## Data Flow After Migration

```
┌─────────────────────────────────────────────────────────┐
│                    USER ACTION                          │
│  User changes daily limit in Settings UI               │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               useSettingsData.js                        │
│  updateSettings() detects dailyLimits change           │
│  Calls wsUpdateDailyLimits(newLimits)                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            useWebSocketSettings.js                      │
│  Sends SETTINGS_UPDATE_DAILY_LIMITS message            │
│  WebSocket: ws://localhost:8080/staff-sync             │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Go WebSocket Server                        │
│  settings_multitable.go                                 │
│  handleSettingsUpdateDailyLimits()                      │
│  Updates daily_limits table                             │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Supabase PostgreSQL                          │
│  UPDATE daily_limits                                    │
│  SET limit_config = {...}, updated_at = now()           │
│  WHERE version_id = ? AND is_active = true              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Go Server Broadcast                          │
│  Sends SETTINGS_SYNC_RESPONSE to all clients           │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            All Connected Clients                        │
│  useWebSocketSettings receives update                  │
│  useSettingsData syncs React state                     │
│  UI re-renders with new limits                         │
└─────────────────────────────────────────────────────────┘
```

**Round-trip time**: ~50-100ms

---

## Important Architecture Notes

### ConfigurationService Role

**Current behavior** (ConfigurationService.js lines 415-431):

```javascript
const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

// ✅ CRITICAL: Only sync when WebSocket is DISABLED
if (this.isSupabaseEnabled && !WEBSOCKET_SETTINGS_ENABLED) {
  // Direct Supabase sync (legacy mode)
  await this.syncToDatabase();
} else if (WEBSOCKET_SETTINGS_ENABLED) {
  // WebSocket mode - Go server handles database
  console.log("⏭️ ConfigurationService sync DISABLED - WebSocket mode handles database");
}
```

**What this means**:
- ✅ ConfigurationService **does NOT write to database** in WebSocket mode
- ✅ Go server is the **single source of truth** for database writes
- ✅ Prevents race conditions and data conflicts
- ⚠️ ConfigurationService still manages localStorage as cache

### WebSocket Message Types

**For daily limits**:
- `SETTINGS_UPDATE_DAILY_LIMITS` - Update existing limits
- `SETTINGS_SYNC_RESPONSE` - Broadcast updated settings
- `SETTINGS_MIGRATE` - Migrate localStorage → database
- `SETTINGS_RESET` - Reset to defaults

**Current implementation**:
- ✅ All message types implemented in Go server
- ✅ All message types implemented in React hooks
- ✅ Real-time broadcasting to all connected clients

---

## Success Criteria

### ✅ Migration is successful when:

1. **Database has data**:
   ```sql
   SELECT COUNT(*) FROM daily_limits WHERE is_active = true;
   -- Result: 1
   ```

2. **UI shows "websocket-multitable" mode**:
   ```javascript
   useSettingsData().backendMode === "websocket-multitable"
   ```

3. **Real-time sync works**:
   - Change UI → Database updates in <1s
   - Change DB → UI updates in <1s

4. **No errors in console**:
   - No WebSocket disconnections
   - No constraint violations
   - No React errors

5. **Validation passes**:
   ```javascript
   // All MIN <= MAX
   dailyLimits.minOffPerDay <= dailyLimits.maxOffPerDay
   dailyLimits.minEarlyPerDay <= dailyLimits.maxEarlyPerDay
   dailyLimits.minLatePerDay <= dailyLimits.maxLatePerDay
   ```

---

## Rollback Plan

### Emergency Rollback (< 1 minute)

```bash
# 1. Disable WebSocket mode
# Edit .env:
REACT_APP_WEBSOCKET_SETTINGS=false

# 2. Restart app
npm start

# 3. Verify localStorage fallback
# Browser console:
JSON.parse(localStorage.getItem('shift-schedule-settings')).dailyLimits
```

**Result**: App immediately falls back to localStorage-only mode.

### Data Rollback (if database corrupted)

```sql
-- Soft delete bad data
UPDATE daily_limits SET is_active = false WHERE created_at > '2025-12-01';

-- Re-run migration
-- (Use migration steps above)
```

---

## Common Issues

### Issue: "WebSocket not connected"
**Solution**: Start Go server
```bash
cd go-server && go run main.go
```

### Issue: "Restaurant/Version not found"
**Solution**: Create restaurant and version
```sql
INSERT INTO restaurants (name, timezone) VALUES ('Default', 'Asia/Tokyo');
INSERT INTO config_versions (restaurant_id, version_number, name, is_active)
VALUES ((SELECT id FROM restaurants LIMIT 1), 1, 'Default', true);
```

### Issue: "UI not updating"
**Solution**: Force refresh
```javascript
window.location.reload();
```

---

## Next Steps After Migration

### Week 1: Monitoring
- [ ] Check database writes daily
- [ ] Monitor WebSocket messages
- [ ] Verify no localStorage fallback warnings

### Week 2: Optimization
- [ ] Add database indexes if needed
- [ ] Enable query caching
- [ ] Review reconnection logs

### Month 1: Advanced Features
- [ ] Add date-scoped limits (seasonal constraints)
- [ ] Implement hard constraints
- [ ] Add penalty weights

### Month 2: Cleanup
- [ ] Archive migration code
- [ ] Remove localStorage fallback
- [ ] Document final architecture

---

## Resources

- **Full Migration Plan**: `DAILY_LIMITS_MIGRATION_PLAN.md`
- **Table Schema**: `DAILY_LIMITS_TABLE_SCHEMA.md`
- **Code Files**:
  - `src/services/ConfigurationService.js`
  - `src/hooks/useSettingsData.js`
  - `src/hooks/useWebSocketSettings.js`

---

**Quick Reference Version**: 1.0
**Last Updated**: 2025-12-01
**Status**: Ready for Migration
