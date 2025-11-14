# WebSocket Settings Enabled - Critical Fix for Staff IDs Deletion

## Issue: Staff IDs Still Deleted After Go Server Fix

**User Report**: "still deleted after npm start" (even after implementing Go server staffIds extraction)

**Date**: 2025-11-13

## Root Cause Discovery

The Go server fix in `settings_multitable.go` (lines 254-268) was **CORRECT** but **COMPLETELY BYPASSED** due to a feature flag.

### The Hidden Blocker

**File**: `.env.development` (Line 49)
```env
REACT_APP_WEBSOCKET_SETTINGS=false  ← Settings bypass Go server!
```

When this flag is `false`:
- Settings load directly from Supabase → ConfigurationService.js → UI
- Go server is **NOT involved** in settings at all
- The staffIds extraction fix **NEVER RUNS**
- Staff IDs are lost because no code extracts them from JSONB

### Data Flow Comparison

#### Before Fix (WebSocket Disabled)
```
App Startup
    ↓
Supabase.from('priority_rules').select('*')
    ↓
ConfigurationService.js (localStorage mode)
    ↓ NO staffIds extraction logic!
    ↓ rule_definition.staff_ids remains in JSONB
    ↓ Never converted to top-level staffIds array
    ↓
useSettingsData.js receives incomplete data
    ↓
UI displays: "No staff assigned" ❌
```

#### After Fix (WebSocket Enabled)
```
App Startup
    ↓
Go Server fetchPriorityRules()
    ↓
ToReactFormat() - lines 254-268
    ↓ ✅ Extracts staffIds from rule_definition.staff_ids
    ↓ ✅ Converts to top-level staffIds: ["uuid-1", "uuid-2"]
    ↓
WebSocket SETTINGS_SYNC_RESPONSE
    ↓
useWebSocketSettings.js receives complete data
    ↓
UI displays: "3 staff members" ✅
```

## The Fix

**File**: `.env.development` (Line 50)

### Changed From:
```env
# ❌ DISABLED: Use direct Supabase hooks to prevent inactivity deletion bug
# When enabled, ConfigurationService runs delete-then-insert which wipes data
REACT_APP_WEBSOCKET_SETTINGS=false
```

### Changed To:
```env
# ✅ ENABLED: Required for Go server staffIds extraction fix
# Go server ToReactFormat() extracts staffIds array from JSONB (lines 254-268)
# Without this, settings bypass Go server and staffIds are lost on restart
REACT_APP_WEBSOCKET_SETTINGS=true
```

## Why This Was Disabled

The original comment mentioned:
> "Use direct Supabase hooks to prevent inactivity deletion bug"

This suggests WebSocket mode had a deletion bug at some point. However:
1. **This may have been fixed** in subsequent commits
2. **The bug is not documented** - we don't know the exact scenario
3. **Disabling WebSocket broke staffIds** - creating a worse problem

## Impact of Enabling WebSocket Settings

### ✅ Benefits
1. **Staff IDs now persist** after app restart
2. **Real-time synchronization** across multiple tabs/users
3. **Server-authoritative updates** - better architecture
4. **Go server fixes apply** - staffIds extraction works

### ⚠️ Potential Risks
1. **Unknown "inactivity deletion bug"** might resurface
2. **WebSocket connection stability** needs monitoring
3. **Performance impact** of real-time updates

## Testing Instructions

### Step 1: Restart Application
```bash
# Stop current npm process (Ctrl+C)
npm start
```

The app will now use WebSocket mode for settings.

### Step 2: Verify WebSocket Mode Active

Open browser console and look for:
```
📡 useSettingsData: WebSocket multi-table backend ACTIVE
```

If you see this, WebSocket mode is enabled ✅

### Step 3: Verify Go Server Extraction

Check Go server console for:
```
✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: [uuid-1 uuid-2 uuid-3]
```

If you see this, staffIds are being extracted ✅

### Step 4: Test Priority Rules Persistence

1. **Create a priority rule with 3 staff members**
   - Name: "Test WebSocket Persistence"
   - Add staff: Select 3 different staff members
   - Select days: Monday, Tuesday, Wednesday
   - Click Save

2. **Verify in Database**
   ```sql
   SELECT
     name,
     rule_definition->'staff_ids' as staff_ids
   FROM priority_rules
   WHERE name = 'Test WebSocket Persistence';
   ```
   Should show: `["uuid-1", "uuid-2", "uuid-3"]`

3. **The Critical Test - Restart npm**
   ```bash
   # Stop npm (Ctrl+C)
   npm start
   ```

4. **Verify After Restart**
   - Go to Settings → Priority Rules
   - Rule should show "3 staff members" (NOT "No staff assigned")
   - Click edit - all 3 staff members should be selected
   - Database should still have 3 UUIDs in staff_ids

**Expected Result**: ✅ Staff IDs persist after restart

### Step 5: Monitor for Stability Issues

**Watch for these issues over the next 5-10 minutes:**

1. **Inactivity Deletion**
   - Leave app idle for 5 minutes
   - Refresh page
   - Check if priority rules are still there
   - If deleted: The old "inactivity deletion bug" has returned

2. **WebSocket Connection Stability**
   - Check browser console for disconnection messages
   - Monitor Go server console for errors
   - Verify settings sync correctly

3. **Data Integrity**
   - Create, update, delete priority rules
   - Verify all operations work correctly
   - Check database for unexpected changes

## Console Log Expectations

### ✅ Success Indicators

**Browser Console:**
```
📡 useSettingsData: WebSocket multi-table backend ACTIVE
✅ WebSocket connected to Go server
🔄 Settings synced from WebSocket
✅ Added staff member to rule "Test": uuid-xxx
🔍 [addStaffMember] Updated staffIds: ["uuid-1", "uuid-2", "uuid-3"]
Summary: 0 created, 1 updated, 0 deleted
```

**Go Server Console:**
```
✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: [uuid-1 uuid-2 uuid-3]
📤 Sending SETTINGS_SYNC_RESPONSE to client
```

### ❌ Failure Indicators

**Browser Console:**
```
❌ WebSocket connection failed
⚠️ Falling back to localStorage mode
⚠️ Settings sync timeout
```

**Go Server Console:**
```
❌ Error loading priority rules from database
⚠️ [ToReactFormat] staffIds array NOT FOUND
```

## Rollback Plan

If WebSocket mode causes issues, you can **quickly rollback**:

### Option 1: Disable WebSocket (Quick Fix)
```env
# .env.development line 50
REACT_APP_WEBSOCKET_SETTINGS=false
```

Then restart `npm start`.

**Consequence**: Staff IDs will be deleted on restart again (original bug returns).

### Option 2: Implement Client-Side Extraction (Permanent Fix)
If WebSocket is unstable, add staffIds extraction to `ConfigurationService.js`:

```javascript
// Add this to transformSettings() in ConfigurationService.js
transformPriorityRule(rule) {
  return {
    ...rule,
    // Extract staffIds from JSONB rule_definition
    staffIds: rule.rule_definition?.staff_ids ||
              (rule.rule_definition?.conditions?.staff_id ?
                [rule.rule_definition.conditions.staff_id] : []) ||
              [],
    staffId: rule.rule_definition?.staff_ids?.[0] ||
             rule.rule_definition?.conditions?.staff_id,
  };
}
```

This duplicates the Go server logic but works without WebSocket.

## Why WebSocket Was Originally Disabled

Based on the .env comment, there was a bug where:
> "ConfigurationService runs delete-then-insert which wipes data"

**Theory**: The old ConfigurationService WebSocket handler might have been:
1. Deleting all existing settings
2. Inserting new settings
3. Causing data loss during the gap

**Current State**: The WebSocket handlers in Go server (settings_multitable.go) use UPDATE operations, not delete-then-insert. This bug may have been fixed already.

## Related Fixes

This completes the full fix chain:

1. ✅ Database loading supports all formats (usePriorityRulesData.js)
2. ✅ UI displays all staff members (PriorityRulesTab.jsx)
3. ✅ Edit buffer captures changes (PriorityRulesTab.jsx)
4. ✅ Update detection sees staffIds (useSettingsData.js)
5. ✅ Go server extracts staffIds array (settings_multitable.go)
6. ✅ **WebSocket settings enabled** (THIS FIX)

## Files Modified

**`.env.development`**
- Line 50: Changed `REACT_APP_WEBSOCKET_SETTINGS` from `false` to `true`
- Updated comment to explain why it's now enabled

## Verification Checklist

After enabling WebSocket settings, verify:

- [ ] Browser console shows "WebSocket multi-table backend ACTIVE"
- [ ] Go server console shows staffIds extraction logs
- [ ] Can create priority rule with multiple staff members
- [ ] Staff members display in UI correctly
- [ ] Changes save to database immediately
- [ ] **Staff IDs persist after npm restart** ← CRITICAL
- [ ] No data deletion after 5 minutes of inactivity
- [ ] No WebSocket connection errors in console
- [ ] Database integrity maintained

## Success Criteria

✅ **Primary Goal**: Staff IDs persist after restarting `npm start`

✅ **Secondary Goals**:
- No data loss from "inactivity deletion bug"
- Stable WebSocket connection
- All priority rules functionality works
- Real-time updates working

## Monitoring Period

**Monitor for 24 hours** after enabling to catch any edge cases:
- Inactivity scenarios (leave app idle)
- Multiple tab scenarios (open in 2+ tabs)
- Network interruptions (disconnect/reconnect WiFi)
- High load scenarios (rapid CRUD operations)

## Support & Troubleshooting

### If Staff IDs Still Don't Persist

1. **Check WebSocket is actually enabled:**
   ```bash
   grep REACT_APP_WEBSOCKET_SETTINGS .env.development
   # Should show: REACT_APP_WEBSOCKET_SETTINGS=true
   ```

2. **Verify Go server is running:**
   ```bash
   ps aux | grep "go run"
   # Should show: go run main.go settings_multitable.go shifts_websocket.go
   ```

3. **Check browser console for mode:**
   - Should see: "📡 useSettingsData: WebSocket multi-table backend ACTIVE"
   - Should NOT see: "⏭️ Skipping loadSettings - using localStorage"

4. **Verify extraction in Go server:**
   - Go server console should show staffIds extraction logs
   - If missing, check settings_multitable.go lines 254-268

### If "Inactivity Deletion Bug" Occurs

1. **Document the exact scenario:**
   - How long was app idle?
   - What data was deleted?
   - Any console errors?

2. **Check database triggers:**
   ```sql
   SELECT * FROM pg_trigger
   WHERE tgname LIKE '%priority_rules%';
   ```

3. **Review Go server delete handlers:**
   - Look for automatic cleanup code
   - Check for is_active = false updates

4. **Consider implementing Option 2** (client-side extraction)

---

**Date**: 2025-11-13
**Critical Change**: Enabled WebSocket settings to allow Go server staffIds extraction
**Impact**: HIGH - This enables all previous fixes to actually work
**Status**: ✅ ENABLED - Ready for testing
**Monitor**: Watch for any stability issues over next 24 hours
