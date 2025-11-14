# Complete Testing Guide - Priority Rules with Multiple Staff

**Date**: 2025-11-14
**Status**: All fixes implemented, ready for testing
**Critical**: Database deletion prevention active

---

## What Was Fixed

### 8 Critical Issues Resolved

1. ✅ **Staff IDs not loading from database** - Added backward compatibility for legacy formats
2. ✅ **Staff names not displaying in UI** - Updated to show all staff members
3. ✅ **Staff updates not saving** - Fixed edit buffer to capture changes
4. ✅ **Update detection missing staffIds** - Added staffIds to comparison logic
5. ✅ **Go server not extracting staffIds** - Added JSONB array extraction
6. ✅ **WebSocket settings disabled** - Enabled WebSocket mode
7. ✅ **Race condition between hooks** - Disabled Supabase hooks in WebSocket mode
8. ✅ **Database deletion bug** - Triple-layer protection implemented

---

## Quick Verification Test

### Step 1: Check Current Database State

```bash
node check-database-state.js
```

**Expected Output**:
```
🔍 Checking Supabase Database State...

📋 PRIORITY RULES:
────────────────────────────────────────────────────────────────────────────────
⚠️  NO PRIORITY RULES FOUND IN DATABASE
   This explains why data appears "wiped" - it was never saved!

👥 STAFF GROUPS:
────────────────────────────────────────────────────────────────────────────────
⚠️  NO STAFF GROUPS FOUND IN DATABASE

📊 SUMMARY:
────────────────────────────────────────────────────────────────────────────────
Priority Rules: 0 total
Staff Groups: 0 total
```

**This is EXPECTED** - the database was wiped by the previous bug. We'll now test that data STAYS saved.

---

### Step 2: Verify Environment Configuration

Check `.env.development` has:
```env
REACT_APP_WEBSOCKET_SETTINGS=true
```

This is **CRITICAL** - WebSocket mode must be enabled for all fixes to work.

---

### Step 3: Start Application

```bash
# Terminal 1: Start Go WebSocket server
cd go-server
./shift-schedule-go-server

# Terminal 2: Start React app
npm start
```

**Expected Console Output**:
```
⏭️ ConfigurationService sync DISABLED - WebSocket mode handles database operations
   ⚠️  SAFETY: Prevents delete-then-insert from wiping database with stale cache
```

This confirms Layer 1 protection is active (ConfigurationService sync disabled).

---

### Step 4: Create Test Priority Rule

1. Open http://localhost:3000
2. Navigate to **Settings** → **Priority Rules** tab
3. Click **"+ Add New Priority Rule"**
4. Fill in:
   - **Name**: "Test Rule - Multiple Staff"
   - **Description**: "Testing multiple staff member support"
   - **Rule Type**: "Preferred Shift"
   - **Shift Type**: "○" (Normal shift)
   - **Priority Level**: 8

5. **Add Multiple Staff Members**:
   - Click **"Add Staff Member"** dropdown
   - Select **料理長** (Chef)
   - Click **"Add Staff Member"** again
   - Select **井関** (Iseki)

6. Click **"Add Rule"** or **"Update Rule"**

---

### Step 5: Verify UI Display

**Expected Result**:
The rule card should show:
```
Test Rule - Multiple Staff
Staff: 2 staff members  ← Should show count, not just first name
Type: Preferred Shift
Shift: ○ (Normal shift)
Priority: 8/10
```

If it shows **"料理長"** only (without 井関), the UI display fix failed.
If it shows **"2 staff members"**, the UI fix is working! ✅

---

### Step 6: Verify Database Save

```bash
node check-database-state.js
```

**Expected Output**:
```
📋 PRIORITY RULES:
────────────────────────────────────────────────────────────────────────────────
✅ Found 1 priority rule(s)

1. Test Rule - Multiple Staff
   ID: <uuid>
   Staff IDs: ✅ 2 staff
   Staff UUIDs: ["<uuid-1>","<uuid-2>"]
   Created: 2025-11-14 ...
   Is Active: true

📊 SUMMARY:
────────────────────────────────────────────────────────────────────────────────
Priority Rules: 1 total
  - 1 with staff IDs ✅
  - 0 without staff IDs ✅
```

If staffIds shows **❌ EMPTY ARRAY**, one of these fixes failed:
- Edit buffer not updating
- Update detection not working
- Go server extraction broken

---

### Step 7: Test Data Persistence (The Big Test!)

**This is the CRITICAL test** - does data survive npm restart?

```bash
# Stop npm (Ctrl+C in Terminal 2)
# Restart npm
npm start
```

**Wait for app to fully load**, then run:
```bash
node check-database-state.js
```

**Expected Output**:
```
✅ Found 1 priority rule(s)

1. Test Rule - Multiple Staff
   Staff IDs: ✅ 2 staff  ← STILL HAS DATA!
```

**If data is GONE** (0 rules or empty staffIds):
- One of the race condition fixes failed
- ConfigurationService protection bypassed
- Go server not running or not extracting properly

**If data is STILL THERE**:
🎉 **ALL FIXES WORKING!** 🎉

---

## What To Look For

### Success Indicators ✅

**Console Logs (npm start)**:
```
⏭️ ConfigurationService sync DISABLED - WebSocket mode handles database operations
   ⚠️  SAFETY: Prevents delete-then-insert from wiping database with stale cache

⏭️ usePriorityRulesData: Skipping mount effect in WebSocket mode
⏭️ useStaffGroupsData: Skipping mount effect in WebSocket mode
```

**Browser Console**:
```
🔍 [useSettingsData] Settings aggregated from WebSocket
   Priority Rules: 1 rules
   Staff Groups: X groups
```

**Database State**:
```
✅ Found 1 priority rule(s)
  - 1 with staff IDs ✅
```

---

### Failure Indicators ❌

**Console Shows Sync Running**:
```
✅ Settings auto-synced to database (localStorage mode)
```
→ **Problem**: WebSocket mode NOT active, Layer 1 protection bypassed
→ **Fix**: Check REACT_APP_WEBSOCKET_SETTINGS=true in .env.development

**Console Shows Hook Loading**:
```
🔍 usePriorityRulesData: Loading from database
```
→ **Problem**: Race condition fix failed, hook still running
→ **Fix**: Check hook WebSocket mode checks are in place

**Database Empty After Restart**:
```
⚠️  NO PRIORITY RULES FOUND IN DATABASE
```
→ **Problem**: Data deleted during initialization
→ **Fix**: Enable startup debug logging (see below)

**StaffIds Empty in Database**:
```
❌ PROBLEM: All priority rules have EMPTY staff_ids arrays
```
→ **Problem**: Go server extraction or save logic broken
→ **Fix**: Check Go server logs, verify ToReactFormat() extraction

---

## Advanced Debugging (If Tests Fail)

### Enable Startup Debug Logging

Add to `.env.development`:
```env
REACT_APP_DEBUG_STARTUP=true
```

Restart app and watch console for detailed state change tracking.

After app loads, run in browser console:
```javascript
window.__printStartupTimeline()
```

This shows EXACTLY when and where data disappears.

---

### Check Go Server Logs

The Go server should show:
```
✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: [...]
```

If you see:
```
⚠️ [ToReactFormat] staffIds array NOT FOUND in RuleDefinition
```
→ The database has data but Go server can't extract it

---

### Check WebSocket Messages

1. Open DevTools → Network tab
2. Filter: `WS`
3. Click WebSocket connection
4. Go to Messages tab
5. Find `SETTINGS_SYNC_RESPONSE`

**Good response**:
```json
{
  "type": "SETTINGS_SYNC_RESPONSE",
  "payload": {
    "priorityRules": [
      {
        "id": "...",
        "name": "Test Rule - Multiple Staff",
        "staffIds": ["uuid-1", "uuid-2"]  ✅
      }
    ]
  }
}
```

**Bad response**:
```json
{
  "type": "SETTINGS_SYNC_RESPONSE",
  "payload": {
    "priorityRules": [
      {
        "id": "...",
        "name": "Test Rule - Multiple Staff",
        "staffIds": []  ❌ EMPTY!
      }
    ]
  }
}
```

---

## Test Checklist

Use this checklist to verify all fixes:

### Database Loading ✅
- [ ] `node check-database-state.js` shows current data
- [ ] Rules with staffIds display staff count correctly
- [ ] Console shows no RLS errors

### UI Display ✅
- [ ] Single staff shows staff name
- [ ] Multiple staff shows "X staff members"
- [ ] Zero staff shows red warning
- [ ] All assigned staff visible in dropdown

### Edit & Save ✅
- [ ] Adding staff updates rule card immediately
- [ ] Removing staff updates rule card immediately
- [ ] Clicking "Update Rule" saves to database
- [ ] `node check-database-state.js` shows updated staffIds

### Go Server Extraction ✅
- [ ] Go server logs show staffIds extraction
- [ ] WebSocket message includes staffIds array
- [ ] Browser receives correct staff data

### WebSocket Mode ✅
- [ ] Console shows "ConfigurationService sync DISABLED"
- [ ] Console shows hooks skipped in WebSocket mode
- [ ] No localStorage direct writes

### Data Persistence ✅
- [ ] npm restart doesn't wipe data
- [ ] Browser refresh preserves data
- [ ] Database state unchanged after restart

### Protection Layers ✅
- [ ] Layer 1: ConfigurationService sync disabled
- [ ] Layer 2: Empty-check safeguards block deletion
- [ ] Layer 3: Console logging shows sync operations

---

## Expected Final State

After all tests pass, you should have:

**Database**:
- 1+ priority rules with staffIds arrays populated
- All staff IDs preserved across restarts

**UI**:
- Rules display correct staff count
- Edit mode allows adding/removing multiple staff
- Save operations persist to database

**Console**:
- No sync from ConfigurationService in WebSocket mode
- Hooks skipped in WebSocket mode
- No deletion warnings

**Verification**:
- `node check-database-state.js` shows all data intact
- npm restart doesn't wipe anything
- WebSocket delivers correct data to UI

---

## If All Tests Pass

**Congratulations!** 🎉

All 8 critical issues are resolved:
1. ✅ Backward compatibility
2. ✅ UI display
3. ✅ Edit buffer
4. ✅ Update detection
5. ✅ Go server extraction
6. ✅ WebSocket mode
7. ✅ Race condition prevention
8. ✅ Database deletion prevention

**You can now**:
- Create priority rules with multiple staff members
- Edit and update staff assignments
- Restart the app without losing data
- Trust the triple-layer protection system

---

## If Tests Fail

**Don't panic!** The diagnostic tools will pinpoint the exact issue:

1. **Run database checker** to see current state
2. **Check console logs** for which protection layer triggered
3. **Enable debug logging** to trace state changes
4. **Examine WebSocket messages** to verify data flow
5. **Check Go server logs** for extraction issues

Refer to:
- `DEBUG-DATA-WIPE-INSTRUCTIONS.md` - Complete debugging guide
- `CRITICAL-FIX-DATABASE-DELETION-PREVENTION.md` - Protection layer details
- `FINAL-FIX-RACE-CONDITION-SUPABASE-HOOKS.md` - Hook fix documentation

---

## Quick Fix Reference

| Problem | Quick Fix |
|---------|-----------|
| ConfigurationService syncing | Check `REACT_APP_WEBSOCKET_SETTINGS=true` |
| Hooks still running | Verify WebSocket checks in hooks |
| Data wiped on restart | Enable debug logging, check timeline |
| Empty staffIds in DB | Check Go server logs, ToReactFormat() |
| UI not showing staff | Check renderRuleCard uses staffIds array |
| Save not working | Check editBuffer setters in add/remove |

---

**Status**: Ready for verification testing
**Next Step**: Run Step 1 and work through the test procedure
**Expected Time**: 10-15 minutes for complete verification
**Documentation**: All fixes documented in respective .md files

---

**IMPORTANT**: This verification confirms the complete fix chain from database loading → UI display → editing → saving → persistence → restart protection. All 8 issues must pass for the system to be considered fully fixed.
