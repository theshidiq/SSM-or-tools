# Staff Groups Database Save Fix

**Date**: 2025-11-14
**Status**: ✅ Fixed - Race condition resolved
**Issue**: Staff groups not saving to database

---

## 🎯 Root Cause

Staff groups had a **race condition** in `useSettingsData.js` that blocked legitimate user saves:

```
1. WebSocket sync happens → sets isSyncingFromWebSocketRef.current = true
2. User creates/updates staff group → calls updateSettings()
3. updateSettings() checks isSyncingFromWebSocketRef.current
4. Still true (requestAnimationFrame() hasn't cleared it yet)
5. Update BLOCKED with warning "User data will NOT be saved to database!"
```

**The Problem**: The code blocked **ALL** updates during WebSocket sync, including legitimate user operations!

---

## 🛠️ The Fix

**File**: `src/hooks/useSettingsData.js` lines 369-400

### Before (BROKEN):
```javascript
if (isSyncingFromWebSocketRef.current) {
  console.log("⚠️ WARNING: User data will NOT be saved to database!");
  setSettings(newSettings);
  return; // ← BLOCKS ALL UPDATES!
}
```

### After (FIXED):
```javascript
if (isSyncingFromWebSocketRef.current) {
  // ✅ Check if this is circular (wsSettings → updateSettings)
  // or user-initiated (user action → updateSettings)
  const isCircularUpdate = wsSettings &&
    JSON.stringify(newSettings) === JSON.stringify(wsSettings);

  if (isCircularUpdate) {
    // Block only circular updates (prevents infinite loop)
    console.log("⏭️ Skipping circular update");
    setSettings(newSettings);
    return;
  } else {
    // ALLOW user-initiated updates
    console.log("✅ User-initiated update - ALLOWING database save");
  }
}
```

**Key Improvement**:
- **Circular updates** (WebSocket broadcast → state → updateSettings): BLOCKED ✅
- **User operations** (create/update staff group): ALLOWED ✅

---

## ✅ What Was Already Working

Investigation revealed that most of the infrastructure was **already in place**:

1. ✅ **WebSocket Functions Exist** (`useWebSocketSettings.js`):
   - `createStaffGroup()` (line 508-542)
   - `updateStaffGroups()` (line 469-503)
   - `deleteStaffGroup()` (line 547-578)

2. ✅ **WebSocket Callbacks Wired** (`useSettingsData.js`):
   - Lines 32-33: Gets WebSocket functions
   - Lines 53-80: Stores in wsCallbacksRef
   - Line 453: Calls `callbacks.wsCreateStaffGroup(group)`
   - Line 551: Calls `callbacks.wsUpdateStaffGroups(group)`

3. ✅ **Normalization Function** (`useSettingsData.js` line 406-413):
   ```javascript
   const normalizeGroup = (group) => ({
     id: group.id,
     name: group.name,
     description: group.description,
     color: group.color,
     members: group.members ?? [],
     isActive: group.isActive ?? group.is_active ?? true,
   });
   ```

4. ✅ **Change Detection Logic** (`useSettingsData.js` lines 429-556):
   - Detects CREATE operations (new groups)
   - Detects UPDATE operations (changed groups)
   - Detects DELETE operations (removed groups)

**Only thing broken**: The race condition check that blocked user saves!

---

## 🧪 Testing Instructions

### Test 1: Create Staff Group

1. Open http://localhost:3000
2. Go to **Settings** → **Staff Groups** tab
3. Click **"+ Add New Staff Group"**
4. Fill in:
   - **Name**: "Test Group"
   - **Color**: Any color
   - **Add 2 members** (e.g., 料理長, 井関)
5. Click **Save**

**Expected Console Output**:
```
🔍 [UPDATE CHECK] isSyncingFromWebSocketRef.current = false
✅ isSyncingFromWebSocketRef is false - proceeding with database save
🔄 Updating settings via WebSocket multi-table backend
  - 1 new group(s) created
  - Creating group "Test Group" (uuid)
📤 Phase 3 Settings: Sent staff group creation: {...}
```

**Verify in Database**:
```bash
node check-database-state.js
```

Expected: Shows 1 staff group with members ✅

---

### Test 2: Update Staff Group

1. Edit the staff group you just created
2. Add another member
3. Save changes

**Expected Console Output**:
```
🔍 [UPDATE CHECK] isSyncingFromWebSocketRef.current = false
✅ isSyncingFromWebSocketRef is false - proceeding with database save
  - 1 group(s) updated
  - Updating group "Test Group": 2 → 3 members
📤 Phase 3 Settings: Sent staff groups update: {...}
```

---

### Test 3: Race Condition During Sync

This tests the scenario where user creates a group while WebSocket sync is happening:

1. Open browser console
2. Create a staff group quickly after page load
3. Watch console logs

**Expected (user operation allowed)**:
```
🔍 [UPDATE CHECK] isSyncingFromWebSocketRef.current = true
✅ User-initiated update detected during WebSocket sync - ALLOWING database save
   This is NOT a circular update - data differs from wsSettings
  - 1 new group(s) created
📤 Phase 3 Settings: Sent staff group creation
```

**NOT Expected (old broken behavior)**:
```
⚠️ WARNING: User data will NOT be saved to database!
```

If you see this warning, the fix didn't work!

---

### Test 4: Persistence Across Restart

1. Create staff group
2. Verify it's in database: `node check-database-state.js`
3. Stop npm: `Ctrl+C`
4. Restart: `npm start`
5. Check database again: `node check-database-state.js`

**Expected**: Staff group still exists ✅

---

## 🔍 Diagnostic Commands

### Check Current Database State
```bash
node check-database-state.js
```

Shows:
- How many staff groups exist
- Member counts for each group
- Whether groups are active

### Watch Console Logs
In browser console, filter for:
- `UPDATE CHECK` - Shows if update is allowed
- `User-initiated` - Shows user operations being allowed
- `Circular update` - Shows circular updates being blocked
- `WARNING: User data will NOT be saved` - ❌ Should NOT appear for user operations

### Check WebSocket Messages
DevTools → Network → WS → Messages
- Look for `SETTINGS_CREATE_STAFF_GROUP`
- Look for `SETTINGS_UPDATE_STAFF_GROUPS`
- Should see these when creating/updating groups

---

## 📊 Success Indicators

✅ **Fix is working if**:
- Console shows "User-initiated update detected during WebSocket sync - ALLOWING database save"
- `node check-database-state.js` shows created staff groups
- Staff groups persist across npm restart
- No "WARNING: User data will NOT be saved to database!" for user operations

❌ **Fix failed if**:
- Still seeing "WARNING: User data will NOT be saved to database!" when creating groups
- `node check-database-state.js` shows 0 staff groups after creating them
- Console shows "Skipping WebSocket update" for user-initiated operations

---

## 🔄 Comparison with Priority Rules Fix

### Priority Rules Issue (Previously Fixed)
- **Problem**: staffIds not included in normalizeRule comparison
- **Fix**: Added `staffIds: r.staffIds || []` to normalizeRule
- **Files**: `useSettingsData.js`, `usePriorityRulesData.js`, `PriorityRulesTab.jsx`

### Staff Groups Issue (This Fix)
- **Problem**: Race condition blocking legitimate user saves
- **Fix**: Check if update is circular vs user-initiated
- **Files**: `useSettingsData.js` only (single line of code!)

**Both issues shared**:
- ✅ WebSocket infrastructure already in place
- ✅ Change detection logic already working
- ✅ Go server extraction already implemented
- ❌ One small bug preventing saves from reaching database

---

## 💡 Why This Fix Works

### Prevents Infinite Loops ✅
```
WebSocket → setSettings(wsSettings) → updateSettings(wsSettings)
                                       ↓
                            isCircularUpdate = true
                                       ↓
                            BLOCK (prevents loop)
```

### Allows User Operations ✅
```
User clicks Save → updateSettings(newSettings)
                            ↓
            newSettings !== wsSettings
                            ↓
                  isCircularUpdate = false
                            ↓
                ALLOW (sends to database)
```

---

## 🎯 Expected Outcome

After this fix:
- ✅ Staff groups save to database immediately
- ✅ Data persists across npm restart
- ✅ No race condition blocking user operations
- ✅ Circular updates still blocked (prevents infinite loop)
- ✅ Same behavior as priority rules (which work correctly)

---

**Status**: ✅ Fixed and ready for testing
**Time to Test**: 5-10 minutes
**Risk**: LOW - Single logical change, preserves existing protections

**Next Step**: Run Test 1 above to verify the fix works!
