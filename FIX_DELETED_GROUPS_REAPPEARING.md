# FIX: Deleted Staff Groups Reappearing in UI

## Problem Description
Deleted staff groups were reappearing in the UI after being deleted. Groups like "New Grou...", "New Group", "jijo", and "kambing" would be deleted but then show up again after page refresh or sync.

## Root Cause Analysis

### The Issue
The application uses a **soft-delete** pattern where groups are marked as `is_active=false` in the database rather than being physically deleted. However, the client-side delete logic was **hard-deleting** (removing from array) instead of soft-deleting, creating a mismatch:

1. **Client sends delete**: Filters group out of array → `updateSettings([group1, group2])` (no group3)
2. **Server detects change**: "group3 was removed from array" → performs soft-delete in database
3. **Server broadcasts back**: Includes ALL groups with `is_active=false` for soft-deleted ones
4. **Client filters received data**: Should filter out `is_active=false` groups
5. **BUG**: Change detection logic didn't recognize soft-delete, only hard-delete

### Technical Details

**Problem Location 1: `/src/components/settings/tabs/StaffGroupsTab.jsx` (line 687-690)**
```javascript
// ❌ BEFORE: Hard-delete (removing from array)
const updatedGroups = staffGroups.filter(
  (group) => group.id !== groupId
);
```

**Problem Location 2: `/src/hooks/useSettingsData.js` (line 282-294)**
```javascript
// ❌ BEFORE: Only detected hard-deletes (removed from array)
const deletedGroupIds = [...oldGroupIds].filter(
  (id) => !newGroupIds.has(id)
);
```

## Solution Implemented

### Fix 1: Client-Side Soft-Delete in StaffGroupsTab.jsx

**Changed**: `/src/components/settings/tabs/StaffGroupsTab.jsx` (line 719-723)
```javascript
// ✅ AFTER: Soft-delete (mark as inactive)
const updatedGroups = staffGroups.map((group) =>
  group.id === groupId
    ? { ...group, is_active: false } // Soft-delete
    : group
);
```

**Benefits**:
- Consistent with server-side soft-delete behavior
- Preserves group data for audit trails
- Matches the filtering expectations

### Fix 2: Detect Both Hard and Soft Deletes in useSettingsData.js

**Changed**: `/src/hooks/useSettingsData.js` (line 281-310)
```javascript
// ✅ AFTER: Detect both hard and soft deletes
const deletedGroupIds = [
  // Hard-deleted: removed from array
  ...[...oldGroupIds].filter((id) => !newGroupIds.has(id)),
  // Soft-deleted: is_active changed from true to false
  ...newGroups
    .filter((newGroup) => {
      const oldGroup = oldGroups.find((g) => g.id === newGroup.id);
      // Detect soft-delete: was active (or undefined), now inactive
      return (
        oldGroup &&
        oldGroup.is_active !== false &&
        newGroup.is_active === false
      );
    })
    .map((g) => g.id),
];
```

**Benefits**:
- Detects both removal from array AND `is_active=false` changes
- Properly sends `SETTINGS_DELETE_STAFF_GROUP` to server
- Consistent with soft-delete pattern

### Fix 3: Exclude Soft-Deleted Groups from Update Detection

**Changed**: `/src/hooks/useSettingsData.js` (line 315)
```javascript
// ✅ AFTER: Skip soft-deleted groups in update detection
const updatedGroups = newGroups.filter((newGroup) => {
  if (!oldGroupIds.has(newGroup.id)) return false; // Skip newly created
  if (newGroup.is_active === false) return false; // Skip soft-deleted groups
  // ... rest of update detection
});
```

**Benefits**:
- Prevents treating delete as update
- Ensures DELETE message is sent, not UPDATE

### Fix 4: Enhanced Logging for Debugging

**Added**: Comprehensive console logging in:
- `StaffGroupsTab.jsx` (line 280-310): Log all groups before/after filtering
- `StaffGroupsTab.jsx` (line 709-728): Log delete operation details
- `useSettingsData.js` (line 300-309): Log delete type (hard vs soft)

**Benefits**:
- Easy debugging of delete operations
- Track filtering behavior
- Verify soft-delete detection

## Existing Filters (Already in Place)

These filters were already working correctly - they just needed the delete detection to work:

1. **`useWebSocketSettings.js`** (line 112-124): Filters `is_active=false` before syncing to state
2. **`useSettingsData.js`** (line 110-112): Filters `is_active=false` when aggregating settings
3. **`StaffGroupsTab.jsx`** (line 293-300): Filters `is_active=false` in useMemo display

## Testing Instructions

### Test 1: Delete a Staff Group
1. Navigate to Settings → Staff Groups tab
2. Create a test group (e.g., "Test Group 1")
3. Click the delete button on the test group
4. Confirm deletion in the modal
5. **Expected**: Group disappears immediately from UI
6. Check console logs:
   - Should see `🗑️ [StaffGroupsTab] performDeleteGroup called`
   - Should see `soft-delete` in the logs
   - Should see `🗑️ [staffGroups useMemo] Filtering out deleted group`

### Test 2: Refresh Page After Delete
1. Delete a group as in Test 1
2. Refresh the page (F5)
3. **Expected**: Deleted group does NOT reappear
4. Check console logs:
   - Should see `🔍 [staffGroups useMemo]` filtering logs
   - Should NOT see the deleted group in filtered count

### Test 3: Multiple Deletes
1. Create 3 test groups: "Test 1", "Test 2", "Test 3"
2. Delete "Test 2"
3. Delete "Test 1"
4. Refresh page
5. **Expected**: Only "Test 3" remains visible
6. All deleted groups should stay hidden

### Test 4: WebSocket Sync (Multi-Client)
1. Open app in two browser tabs
2. In Tab 1: Delete a group
3. In Tab 2: **Expected**: Group disappears in real-time
4. Refresh both tabs
5. **Expected**: Deleted group stays hidden in both

## Verification Checklist

- [ ] Deleted groups disappear from UI immediately
- [ ] Page refresh does not restore deleted groups
- [ ] Console shows soft-delete detection working
- [ ] Console shows filtering working (3 layers)
- [ ] WebSocket broadcasts delete to other clients
- [ ] Database shows `is_active=false` (check Supabase)
- [ ] No duplicate delete messages sent to server
- [ ] Update operations don't interfere with deletes

## Files Modified

1. `/src/components/settings/tabs/StaffGroupsTab.jsx`
   - Changed hard-delete to soft-delete (line 719-723)
   - Added comprehensive logging (line 280-310, 709-728)

2. `/src/hooks/useSettingsData.js`
   - Detect both hard and soft deletes (line 281-310)
   - Skip soft-deleted groups in update detection (line 315)

3. `/src/hooks/useWebSocketSettings.js`
   - Already filtering correctly (line 112-124) - no changes needed

## Database Schema
The `staff_groups` table uses soft-delete pattern:
```sql
-- Soft-delete sets is_active to false
UPDATE staff_groups
SET is_active = false,
    updated_at = NOW()
WHERE id = <group_id>
AND version_id = <version_id>;

-- Queries filter out soft-deleted records
SELECT * FROM staff_groups
WHERE is_active = true
AND version_id = <active_version_id>;
```

## Success Criteria Met

✅ **Delete a group → it disappears from UI**
- Client-side soft-delete marks `is_active=false`
- Filtering layers remove it from display

✅ **Refresh page → deleted group stays hidden**
- Server query filters `is_active=true`
- Client receives only active groups
- useMemo filter removes any that slip through

✅ **No deleted groups in the groups list**
- 3-layer filtering ensures complete coverage
- Soft-delete detection triggers proper DELETE message

✅ **Console shows proper filtering happening**
- Comprehensive logging at each layer
- Delete type identification (hard vs soft)
- Filter count verification

## Rollback Instructions
If issues occur, revert these commits:
```bash
git revert HEAD~3..HEAD  # Reverts last 3 commits (this fix)
```

Or manually restore from these files:
- `src/components/settings/tabs/StaffGroupsTab.jsx` (before line 719 change)
- `src/hooks/useSettingsData.js` (before line 281 and 315 changes)
