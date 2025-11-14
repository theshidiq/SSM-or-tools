# Debug Data Wipe Issue - Instructions

## Issue
Staff IDs are being wiped after `npm start` but before browser refresh.

## Diagnostic Tools Added

We've added two diagnostic tools to help identify exactly when and where data disappears:

### 1. Database State Checker
### 2. Startup Logger

---

## Step 1: Check Database State

This verifies if data actually exists in Supabase or if it was never saved properly.

```bash
node check-database-state.js
```

**What it checks:**
- How many priority rules exist in database
- How many rules have staff IDs vs empty arrays
- How many staff groups exist
- Provides diagnosis of the issue

**Possible Results:**

**A) Database is empty:**
```
⚠️  NO PRIORITY RULES FOUND IN DATABASE
```
→ **Diagnosis**: Data was never saved in the first place
→ **Next step**: Create a rule in UI and check for save errors

**B) Rules exist but staffIds are empty:**
```
❌ PROBLEM: All priority rules have EMPTY staff_ids arrays
```
→ **Diagnosis**: staffIds field not being saved correctly
→ **Next step**: Check frontend save logic or Go server extraction

**C) Database looks good:**
```
✅ Database looks good! X rule(s) have staff IDs.
```
→ **Diagnosis**: Data exists in database but something wipes it during app load
→ **Next step**: Enable startup logging to trace the issue

---

## Step 2: Enable Startup Debug Logging

If database has data but it disappears during app load, enable debug logging:

### Enable Debug Mode

Add to `.env.development`:
```env
REACT_APP_DEBUG_STARTUP=true
```

### Restart App

```bash
# Stop current npm (Ctrl+C)
npm start
```

### Watch Console Logs

The startup logger will print:
- **Timestamp** of every settings change
- **Source** of the change (which code triggered it)
- **Priority rules count** (total and with staff IDs)
- **Staff groups count**
- **⚠️  Warnings** when data disappears

**Example Output:**
```
🔍 [T+100ms] useSettingsData.WebSocketSync: Settings aggregated from WebSocket
   Priority Rules: 3 total (3 with staff, 0 empty)
   Staff Groups: 2 total

🔍 [T+500ms] usePriorityRulesData: Skipped in WebSocket mode
   Priority Rules: 3 total (3 with staff, 0 empty)
   Staff Groups: 2 total

⚠️  WARNING: Staff IDs disappeared! Rules went from 3 with staff → 0 with staff
   Previous state: useSettingsData.WebSocketSync - Settings aggregated from WebSocket
   Current state: useSettingsData.updateSettings - Updated by usePriorityRulesData
   Stack trace: [shows exact code location]
```

### Print Timeline Summary

After app loads, run in browser console:
```javascript
window.__printStartupTimeline()
```

This prints a complete timeline showing:
- Every settings change with timestamp
- Which changes caused data to disappear
- Exact source of the data wipe

---

## Step 3: Interpret Results

### Scenario 1: usePriorityRulesData NOT Skipped

**Console shows:**
```
🔍 [T+200ms] usePriorityRulesData: Loading from database
   Priority Rules: 0 total (0 with staff, 0 empty)
```

**Diagnosis**: The hook is still running even though it should be skipped!

**Cause**: WebSocket mode check not working

**Fix**: Verify `.env.development` has:
```env
REACT_APP_WEBSOCKET_SETTINGS=true
```

### Scenario 2: WebSocket Sync Has Empty Data

**Console shows:**
```
🔍 [T+500ms] useSettingsData.WebSocketSync: Settings aggregated from WebSocket
   Priority Rules: 0 total (0 with staff, 0 empty)
```

**Diagnosis**: Go server is returning empty data

**Possible causes:**
- Go server not running
- Go server can't connect to Supabase
- Supabase RLS blocking reads
- Go server ToReactFormat() not extracting staffIds

**Fix**: Check Go server console for errors

### Scenario 3: Data Appears Then Disappears

**Console shows:**
```
🔍 [T+500ms] useSettingsData.WebSocketSync: Settings aggregated from WebSocket
   Priority Rules: 3 total (3 with staff, 0 empty)  ✅

🔍 [T+800ms] useSettingsData.updateSettings: Updated by SomeComponent
   Priority Rules: 3 total (0 with staff, 3 empty)  ❌

⚠️  WARNING: Staff IDs disappeared!
```

**Diagnosis**: Some component is calling `updateSettings()` with incomplete data

**Fix**: Check which component triggered the update (shown in log), fix that component to preserve staffIds

### Scenario 4: Multiple Rapid Updates

**Console shows:**
```
🔍 [T+100ms] useSettingsData.WebSocketSync: ...
   Priority Rules: 3 total (3 with staff, 0 empty)

🔍 [T+150ms] useSettingsData.updateSettings: ...
   Priority Rules: 3 total (3 with staff, 0 empty)

🔍 [T+200ms] usePriorityRulesData: ...
   Priority Rules: 0 total (0 with staff, 0 empty)  ❌
```

**Diagnosis**: Race condition - multiple hooks updating settings at once

**Fix**: One hook is not being skipped correctly in WebSocket mode

---

## Step 4: Advanced Debugging

### Export Full Timeline

In browser console:
```javascript
const timeline = window.__exportStartupLogs()
console.log(JSON.stringify(timeline, null, 2))
```

Copy this JSON and save to a file for detailed analysis.

### Check WebSocket Messages

1. Open DevTools → Network tab
2. Filter: `WS` (WebSocket)
3. Click the WebSocket connection
4. Go to Messages tab
5. Look for `SETTINGS_SYNC_RESPONSE`
6. Check if `priorityRules` field has data

**Example good response:**
```json
{
  "type": "SETTINGS_SYNC_RESPONSE",
  "payload": {
    "priorityRules": [
      {
        "id": "...",
        "name": "Test Rule",
        "staffIds": ["uuid-1", "uuid-2"]  ✅
      }
    ]
  }
}
```

**Example bad response:**
```json
{
  "type": "SETTINGS_SYNC_RESPONSE",
  "payload": {
    "priorityRules": [
      {
        "id": "...",
        "name": "Test Rule",
        "staffIds": []  ❌ EMPTY!
      }
    ]
  }
}
```

If empty, the problem is in Go server or database.

---

## Step 5: Report Findings

After running diagnostics, provide:

1. **Database check results:**
   - How many rules in database?
   - Do they have staff IDs?

2. **Console timeline:**
   - Copy/paste the full console output from npm start
   - Include any warnings about data disappearing

3. **Timeline summary:**
   - Output from `window.__printStartupTimeline()`

4. **WebSocket messages:**
   - Screenshot of SETTINGS_SYNC_RESPONSE from DevTools Network tab

This information will pinpoint the EXACT location and cause of the data wipe.

---

## Quick Test Procedure

1. **Database Check:**
   ```bash
   node check-database-state.js
   ```

2. **If database has data, enable logging:**
   - Add `REACT_APP_DEBUG_STARTUP=true` to `.env.development`

3. **Restart and observe:**
   ```bash
   npm start
   ```
   - Watch console for data wipe warnings
   - Note timestamps and sources

4. **Print timeline:**
   ```javascript
   window.__printStartupTimeline()
   ```

5. **Report the results!**

---

## Expected Success Case

If everything is working correctly, you should see:

```
🔍 [T+0ms] App Start

🔍 [T+100ms] useSettingsData.mount: Initial state (null)
   Priority Rules: 0 total

🔍 [T+500ms] useSettingsData.WebSocketSync: Settings aggregated from WebSocket
   Priority Rules: 3 total (3 with staff, 0 empty)  ✅

🔍 [T+600ms] usePriorityRulesData: Skipped in WebSocket mode  ✅
🔍 [T+600ms] useStaffGroupsData: Skipped in WebSocket mode  ✅

✅ No data wipes detected in timeline
```

If you see this, the system is working correctly and data should persist!

---

**Created**: 2025-11-13
**Purpose**: Diagnose data wipe during app initialization
**Tools**: Database checker + Startup logger
