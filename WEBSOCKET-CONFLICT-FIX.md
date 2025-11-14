# WebSocket Conflict Fix - Staff Groups Auto-Delete Issue

## Problem Summary

Staff groups were being automatically deleted/hidden after `npm start` even though they exist in the database with `is_active = true`.

## Root Cause

**CONFLICTING DATA SOURCES**: Two hooks were loading settings simultaneously and overwriting each other:

1. **WebSocket Hook** (`useWebSocketSettings`) - Tries to connect to Go server
2. **Direct Supabase Hook** (`useStaffGroupsData`) - Queries database directly

### Timeline of the Conflict

1. Go WebSocket server has compilation errors (won't build)
2. User added direct Supabase hooks as workaround (`usePriorityRulesData`, `useStaffGroupsData`)
3. But WebSocket feature flag was still ENABLED (`REACT_APP_WEBSOCKET_SETTINGS=true`)
4. On app start, BOTH hooks try to sync settings:
   - WebSocket hook loads stale/cached data with `isActive: false`
   - Direct Supabase hook loads fresh data with `isActive: true`
5. They race to call `updateSettings()` → one overwrites the other
6. Result: Groups appear then disappear on every reload

## Solution Applied

### 1. Disabled WebSocket Settings Feature Flag

Updated environment files to disable WebSocket settings:

**Files Modified:**
- `.env` - Set `REACT_APP_WEBSOCKET_SETTINGS=false`
- `.env.development` - Set `REACT_APP_WEBSOCKET_SETTINGS=false`
- `.env.local` - Set all WebSocket flags to `false`

This prevents `useWebSocketSettings` from running in `useSettingsData.js`.

### 2. Rely on Direct Supabase Hooks

The app now uses ONLY direct Supabase hooks for settings:
- `usePriorityRulesData()` - Loads priority rules directly from `priority_rules` table
- `useStaffGroupsData()` - Loads staff groups directly from `staff_groups` table

Both hooks:
- Query Supabase directly
- Transform data to localStorage format
- Include Supabase real-time subscriptions
- Sync to `SettingsContext` via `updateSettings()`

## Verification Steps

### 1. Restart the App

```bash
# Stop current server (Ctrl+C)
npm start
```

### 2. Check Console Logs

You should see:
```
✅ Loaded X staff groups from database and synced to settings
✅ Loaded X priority rules from database and synced to settings
```

You should NOT see:
```
🔌 [CONNECT] Phase 3 Settings: Creating WebSocket connection
🗑️ [SYNC] Received soft-deleted groups from server
```

### 3. Verify UI

- **Settings → Staff Groups Tab**: Groups should appear and persist after reload
- **Settings → Priority Rules Tab**: Rules should appear
- No "Configuration Error" messages
- No infinite loops

### 4. Run Database Fix (if needed)

If groups still don't appear, run `fix-settings-data.sql` in Supabase SQL Editor to ensure `is_active = true` in database.

## Technical Details

### Feature Flag Check (useSettingsData.js:7-8)

```javascript
const WEBSOCKET_SETTINGS_ENABLED =
  process.env.REACT_APP_WEBSOCKET_SETTINGS === "true";
```

When `false`, `useWebSocketSettings` is called with `enabled: false`, preventing connection.

### Data Flow (Now)

```
┌─────────────────────────────────────────┐
│         App Starts (App.js)             │
├─────────────────────────────────────────┤
│  usePriorityRulesData()  ──┐            │
│  useStaffGroupsData()      │            │
│                            ↓            │
├─────────────────────────────────────────┤
│     Direct Supabase Queries             │
├─────────────────────────────────────────┤
│  - SELECT * FROM priority_rules         │
│  - SELECT * FROM staff_groups           │
│  - Transform to localStorage format     │
│  - Sync to SettingsContext              │
└─────────────────────────────────────────┘
```

### Data Flow (Before - BROKEN)

```
┌─────────────────────────────────────────┐
│         App Starts (App.js)             │
├─────────────────────────────────────────┤
│  usePriorityRulesData()  ──┐            │
│  useStaffGroupsData()      │            │
│                            ├─ CONFLICT! │
│  useWebSocketSettings() ───┘            │
│  (via useSettingsData)                  │
├─────────────────────────────────────────┤
│     Multiple Data Sources               │
├─────────────────────────────────────────┤
│  ✅ Direct Supabase: fresh data         │
│  ❌ WebSocket: stale/error data         │
│  ⚠️  Race condition on updateSettings() │
└─────────────────────────────────────────┘
```

## Future: Fix Go Server

To re-enable WebSocket settings in the future:

### 1. Fix Go Server Compilation Errors

```bash
cd go-server
go build main.go
# Should compile without errors
```

Current errors (as of now):
```
./main.go:283:6: s.handleSettingsSyncRequest undefined
./main.go:285:6: s.handleStaffGroupsUpdate undefined
./main.go:287:6: s.handleStaffGroupCreate undefined
... (and more)
```

### 2. Start Go Server

```bash
cd go-server
./server
# Should start without errors
```

### 3. Re-enable WebSocket Feature Flag

Update `.env` and `.env.development`:
```bash
REACT_APP_WEBSOCKET_SETTINGS=true
```

### 4. Remove Direct Supabase Hooks (Optional)

Once WebSocket is stable, you can remove `usePriorityRulesData()` and `useStaffGroupsData()` from `App.js` to avoid duplication.

## Related Fixes

This fix complements the other fixes in:
- `SETTINGS-DATA-FIX-COMPLETE.md` - Database schema fixes
- `fix-settings-data.sql` - SQL migration for `is_active` field

## Files Modified

1. `.env` - Disabled WebSocket settings flag
2. `.env.development` - Disabled WebSocket settings flag
3. `.env.local` - Disabled all WebSocket flags
4. `WEBSOCKET-CONFLICT-FIX.md` - This documentation (NEW)

## Summary

✅ **Problem**: Two data sources conflicting → groups auto-deleted
✅ **Root Cause**: WebSocket enabled but broken + Direct Supabase hooks enabled
✅ **Solution**: Disable WebSocket, use only Direct Supabase hooks
✅ **Result**: Staff groups should now persist across reloads
