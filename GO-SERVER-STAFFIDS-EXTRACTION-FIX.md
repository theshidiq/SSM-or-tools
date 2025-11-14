# Go Server - staffIds Array Extraction Fix

## Issue: Data Wiping on npm Restart

**Problem**: Every time `npm start` runs, staff IDs disappear from priority rules in the database.

**User Report**: "everytime i restart the npm, its wiped old data specially the staff ids"

## Root Cause Analysis

### The Data Wiping Flow

```
T=0ms    → npm start - App loads from Supabase
           ✅ Priority rules loaded with staffIds: ["uuid-1", "uuid-2"]

T=100ms  → WebSocket connects to Go server

T=300ms  → Go server sends SETTINGS_SYNC_RESPONSE
           ❌ ToReactFormat() extracts staffId (singular) but NOT staffIds (array)
           ❌ Converted data: { staffId: "uuid-1", staffIds: undefined }

T=330ms  → WebSocket sync overwrites Supabase data
           ❌ Settings update with incomplete data
           ❌ Priority rules now have: staffIds: [] (empty array)

T=340ms  → UI displays rules WITHOUT staff members
           ❌ User sees "No staff assigned" warning
```

### The Smoking Gun

**File**: `go-server/settings_multitable.go` (Lines 227-252)

The `ToReactFormat()` method transforms database priority rules into React format. It was extracting single `staffId` but NOT the `staffIds` array:

```go
// ❌ OLD CODE: Only extracted single staffId
if staffID, exists := defMap["staff_id"]; exists {
    result["staffId"] = staffID  // Single staff ID only
}
// ❌ MISSING: No extraction of staffIds array!
```

When the Go server sent settings sync on app startup, it sent incomplete data:
- Database has: `rule_definition.staff_ids = ["uuid-1", "uuid-2", "uuid-3"]`
- Go server extracted: `{ staffId: "uuid-1" }` (first staff only, no staffIds array)
- React received incomplete data and updated localStorage/settings
- Database got overwritten with empty staffIds on next save

## The Fix

**File**: `go-server/settings_multitable.go` (Lines 254-268)

Added extraction of `staffIds` array from JSONB with multiple fallbacks:

```go
// ✅ NEW: Extract staffIds ARRAY from JSONB (multiple staff member support)
// This is the PRIMARY field - React expects staffIds array for multiple staff members
if staffIDs, exists := defMap["staff_ids"]; exists {
    result["staffIds"] = staffIDs
    log.Printf("✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: %v", staffIDs)
} else if staffIDs, exists := defMap["staffIds"]; exists {
    result["staffIds"] = staffIDs
    log.Printf("✅ [ToReactFormat] Extracted staffIds array from JSONB staffIds: %v", staffIDs)
} else if staffID, exists := result["staffId"]; exists && staffID != nil {
    // Fallback: Convert single staffId to array for consistency
    result["staffIds"] = []interface{}{staffID}
    log.Printf("✅ [ToReactFormat] Converted single staffId to array: %v", []interface{}{staffID})
} else {
    log.Printf("⚠️ [ToReactFormat] staffIds array NOT FOUND in RuleDefinition - rule will have no staff members")
}
```

### Extraction Logic

The fix checks in this order:

1. **Primary**: `rule_definition.staff_ids` (snake_case, database format)
2. **Secondary**: `rule_definition.staffIds` (camelCase, React format)
3. **Fallback**: Convert single `staffId` to array `[staffId]` for consistency
4. **Warning**: Log if no staff members found at all

## After Fix Flow

```
T=0ms    → npm start - App loads from Supabase
           ✅ Priority rules loaded with staffIds: ["uuid-1", "uuid-2"]

T=100ms  → WebSocket connects to Go server

T=300ms  → Go server sends SETTINGS_SYNC_RESPONSE
           ✅ ToReactFormat() extracts BOTH staffId AND staffIds
           ✅ Converted data: { staffId: "uuid-1", staffIds: ["uuid-1", "uuid-2"] }

T=330ms  → WebSocket sync merges with Supabase data
           ✅ Settings update with COMPLETE data
           ✅ Priority rules retain: staffIds: ["uuid-1", "uuid-2"]

T=340ms  → UI displays rules WITH all staff members
           ✅ User sees "2 staff members" or staff names
```

## Build & Deployment

### Build Command
```bash
cd go-server
go build -o shift-schedule-go-server *.go
```

**Note**: Must build with `*.go` (all Go files) not just `main.go`, because:
- `main.go` defines the StaffSyncServer struct and message routing
- `settings_multitable.go` implements the methods (handleSettingsSyncRequest, etc.)
- Building only `main.go` results in "undefined method" errors

### Binary Info
- **Location**: `go-server/shift-schedule-go-server`
- **Size**: ~9.7 MB
- **Built**: November 13, 2025 21:16
- **Includes**: staffIds array extraction fix

## Testing Instructions

### Test Case 1: Verify No Data Loss on Restart

1. **Setup**: Create a priority rule with multiple staff members
   ```
   - Name: "Weekend Shift Priority"
   - Staff: Add 3 staff members (料理長, 井関, 山田)
   - Days: Select Saturday, Sunday
   - Click Save
   ```

2. **Verify Initial Save**:
   - Check Supabase database:
   ```sql
   SELECT name, rule_definition->'staff_ids' as staff_ids
   FROM priority_rules
   WHERE name = 'Weekend Shift Priority';
   ```
   - Should show: `["uuid-1", "uuid-2", "uuid-3"]`

3. **Restart Application**:
   ```bash
   # Stop npm (Ctrl+C)
   npm start
   # Wait for app to fully load
   ```

4. **Check Staff Members After Restart**:
   - Open Priority Rules settings tab
   - Verify rule card shows "3 staff members"
   - Click edit - verify all 3 staff members are selected
   - Check database again - staffIds should still be complete

5. **Expected Result**: ✅ Staff members persist after restart

### Test Case 2: Verify Go Server Logs

1. **Start Go Server with logging**:
   ```bash
   cd go-server
   ./shift-schedule-go-server
   ```

2. **Start React app**:
   ```bash
   npm start
   ```

3. **Check Go server console for logs**:
   ```
   ✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: [uuid-1 uuid-2 uuid-3]
   ```

4. **Expected Result**: ✅ staffIds array appears in logs (not just single staffId)

### Test Case 3: Verify Backward Compatibility

1. **Create rule with old format** (single staffId):
   - Manually update database with legacy format:
   ```sql
   UPDATE priority_rules
   SET rule_definition = jsonb_set(
     rule_definition,
     '{staff_id}',
     '"uuid-single"'
   )
   WHERE name = 'Test Rule';
   ```

2. **Restart app**

3. **Check conversion**:
   - Rule should show "1 staff member"
   - Edit rule - should show single staff selected
   - Go logs should show: `Converted single staffId to array: [uuid-single]`

4. **Expected Result**: ✅ Legacy single staffId converted to array

## Related Fixes

This completes the full chain of fixes for Priority Rules staff IDs:

1. ✅ **Loading from Database** (PRIORITY-RULES-TWO-ISSUES-FIX.md)
   - Added backward compatibility for old data formats
   - Fixed RLS policy blocking inserts

2. ✅ **UI Display** (PRIORITY-RULES-UI-DISPLAY-FIX.md)
   - Changed to show ALL staff members, not just first one
   - Shows count for multiple, name for single

3. ✅ **Edit Buffer Updates** (PRIORITY-RULES-STAFF-UPDATE-FIX.md)
   - Fixed addStaffMember/removeStaffMember to update buffer
   - Ensures changes persist when save clicked

4. ✅ **Update Detection** (PRIORITY-RULES-STAFFIDS-UPDATE-DETECTION-FIX.md)
   - Added staffIds to normalizeRule comparison
   - System now detects when staff members change

5. ✅ **Go Server Extraction** (THIS FIX)
   - Go server now extracts staffIds array from database
   - Prevents data loss on app restart

## Files Modified

**`go-server/settings_multitable.go`**
- Lines 254-268: Added staffIds array extraction in ToReactFormat() method
- Added comprehensive logging for debugging
- Includes fallback for legacy single staffId format

## Summary

**Problem**: npm restart wiped staff IDs from priority rules

**Root Cause**: Go server extracted single staffId but not staffIds array, causing incomplete data sync on startup

**Solution**: Added staffIds array extraction to ToReactFormat() method in Go server

**Impact**: HIGH - This was the final piece preventing staff member persistence across app restarts

**Status**: ✅ FIXED - Go server rebuilt and ready for testing

---

**Date**: 2025-11-13
**Critical Fix**: Prevents data loss on application restart
**Build**: `go build -o shift-schedule-go-server *.go` (required for proper compilation)
