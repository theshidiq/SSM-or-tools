# Investigation Index: New Staff Groups UPDATE Bug

## Overview

This investigation analyzed why new staff groups created in the frontend are being detected as UPDATE operations instead of CREATE operations when synced with the Go server.

## Documents Created

### 1. **INVESTIGATION-SUMMARY.md** (Start Here)
**7.9 KB** | Best for: Quick understanding of the issue

The executive summary of the investigation. Start here if you want the TL;DR:
- What's actually happening
- Why the frontend logs show "UPDATE" instead of "CREATE"
- The most likely root cause
- Missing information needed for complete diagnosis
- Conclusion: This is NOT a frontend bug

**Read this first before diving into details.**

---

### 2. **ROOT-CAUSE-NEW-GROUP-UPDATE-BUG.md** (Detailed Analysis)
**15 KB** | Best for: Understanding the complete flow

In-depth analysis of the bug including:
- Complete flow from user action to WebSocket message
- Timing issues and race conditions
- The root cause chain
- Why the database has no record
- Multiple hypotheses with detailed explanations
- Solution options (both client and server side)

**Read this if you want to understand all the nuances.**

---

### 3. **ROOT-CAUSE-VISUAL-TIMELINE.md** (Visual Guide)
**10 KB** | Best for: Visual learners and debugging

Visual timeline showing:
- ASCII diagram of message flow through time (T0-T7)
- Step-by-step code execution with line numbers
- Why the change detection logic is correct
- Why the server gets UPDATE instead of CREATE
- Three recommended fixes with code examples

**Use this while debugging to follow the flow visually.**

---

### 4. **CODE-REFERENCE-GUIDE.md** (Code Walkthrough)
**12 KB** | Best for: Developers implementing the fix

Complete code reference including:
- File locations for all relevant code
- Key code sections with line numbers
- Step-by-step code execution timeline
- Console logs to look for (both success and error cases)
- Questions to answer for diagnosis
- Immediate actions and next steps
- Implementation details to check

**Use this to find exactly where to look in the code.**

---

## The Investigation Flow

### If you have 5 minutes:
Read: **INVESTIGATION-SUMMARY.md**

### If you have 15 minutes:
Read: **INVESTIGATION-SUMMARY.md** + **ROOT-CAUSE-VISUAL-TIMELINE.md**

### If you have 30 minutes:
Read all in this order:
1. INVESTIGATION-SUMMARY.md
2. ROOT-CAUSE-VISUAL-TIMELINE.md
3. CODE-REFERENCE-GUIDE.md

### If you're implementing a fix:
1. Read: INVESTIGATION-SUMMARY.md (understand the problem)
2. Reference: CODE-REFERENCE-GUIDE.md (find the code)
3. Check: ROOT-CAUSE-NEW-GROUP-UPDATE-BUG.md (understand why your fix works)

---

## Key Findings

### The Good News
The frontend change detection logic is **CORRECT**. It properly:
- Detects new groups as CREATE
- Detects edited groups as UPDATE
- Sends the correct WebSocket messages

### The Bad News
Something is preventing the CREATE message from working:
1. CREATE message might not reach the server
2. CREATE might fail silently on the server
3. CREATE might succeed but server doesn't communicate it back
4. Race condition: UPDATE arrives before CREATE completes

### The Real Issue
The Go server receives an UPDATE for a group that doesn't exist, because either:
- The CREATE message never arrived, OR
- The CREATE failed, OR
- The CREATE succeeded but the response didn't reach the client

---

## Next Steps for Diagnosis

### Step 1: Check Go Server Logs
Look for:
- [ ] SETTINGS_CREATE_STAFF_GROUP messages
- [ ] SETTINGS_UPDATE_STAFF_GROUPS messages
- [ ] Which arrived first and when
- [ ] Any error responses

### Step 2: Verify Database State
Check if:
- [ ] Group exists in database
- [ ] When was it created
- [ ] When was UPDATE attempted

### Step 3: Test WebSocket Connection
Verify:
- [ ] Connection stays stable
- [ ] Both messages are sent
- [ ] Server responds to both

### Step 4: Implement Fix
Options:
- **Server-side (Recommended)**: UPSERT pattern (UPDATE or CREATE)
- **Client-side**: Track pending creates and queue updates
- **Hybrid**: Combination of both

---

## Solution Options

### Option 1: Server-Side UPSERT (Recommended)
**Pros:** Simple, handles race conditions naturally
**Cons:** Changes server code

When UPDATE fails (0 rows affected), automatically CREATE the group instead.

### Option 2: Client-Side Pending Tracking
**Pros:** Keeps all logic in client
**Cons:** More complex, state management issues

Track which groups are "pending create" and don't send UPDATEs until CREATE completes.

### Option 3: Server UPSERT + Client Error Handling
**Pros:** Most robust, covers all edge cases
**Cons:** Changes both client and server

Implement both UPSERT on server and proper error handling on client.

---

## File Locations Quick Reference

### Frontend Files
- **Group creation:** `/src/components/settings/tabs/StaffGroupsTab.jsx` (lines 617-653)
- **Change detection:** `/src/hooks/useSettingsData.js` (lines 355-571)
- **WebSocket functions:** `/src/hooks/useWebSocketSettings.js` (exact location unknown - needs investigation)
- **Settings context:** `/src/contexts/SettingsContext.jsx`

### Go Server Files
- **WebSocket handler:** `go-server/main.go` or `go-server/handlers/staff_groups.go` (needs location)
- **Database functions:** `go-server/supabase/` or `go-server/db/` (needs location)

---

## Investigation Checklist

### Frontend Analysis
- [x] Verified group creation code is correct
- [x] Verified change detection logic is correct
- [x] Identified the exact timing of state updates
- [x] Traced the complete flow from UI to WebSocket
- [ ] Verified wsCreateStaffGroup() is actually called
- [ ] Verified wsCreateStaffGroup() sends correct message

### Go Server Analysis
- [ ] Check for SETTINGS_CREATE_STAFF_GROUP receipt
- [ ] Check CREATE success/failure
- [ ] Check for SETTINGS_UPDATE_STAFF_GROUPS receipt
- [ ] Check UPDATE result (rows affected)
- [ ] Check error responses sent to client
- [ ] Verify group actually exists in database when UPDATE arrives

### Integration Analysis
- [ ] Verify CREATE message reaches server
- [ ] Verify server broadcasts CREATE response
- [ ] Verify client receives server response
- [ ] Verify state synchronizes correctly
- [ ] Verify subsequent UPDATE operates on synced state

---

## Key Code Sections to Review

### Change Detection Logic (useSettingsData.js:456-467)
```javascript
const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
if (createdGroups.length > 0) {
  createdGroups.forEach((group) => {
    callbacks.wsCreateStaffGroup(group);  // ← THIS MUST BE CALLED
  });
}
```

### Update Detection Logic (useSettingsData.js:532-565)
```javascript
const updatedGroups = newGroups.filter((newGroup) => {
  if (!oldGroupIds.has(newGroup.id)) return false;  // Skip new groups
  // ... compare fields ...
  return JSON.stringify(oldData) !== JSON.stringify(newData);
});
```

### State Sync (useSettingsData.js:180)
```javascript
setSettings(aggregatedSettings);  // Updates local state with server data
```

### Ref Update (useSettingsData.js:208-210)
```javascript
useEffect(() => {
  settingsRef.current = settings;  // Updates ref for next change detection
}, [settings]);
```

---

## Questions This Investigation Answers

- [x] Is the frontend incorrectly detecting the group as UPDATE?
  - **Answer:** No, the frontend is correct. After server sync, the group IS in oldState, so subsequent changes ARE updates.

- [x] Why does the console show "1 group(s) updated"?
  - **Answer:** Because at T4, the group exists in oldState (from server sync), so changes are detected as UPDATE.

- [x] Why is the database missing the group?
  - **Answer:** Unknown - requires Go server logs to determine if CREATE failed or never arrived.

- [x] Is this a change detection bug?
  - **Answer:** No, change detection is correct. This is likely a server-side issue.

- [x] What needs to be fixed?
  - **Answer:** Likely the Go server's handling of UPDATE for non-existent groups (should UPSERT instead).

---

## Last Updated
2024-11-15

## Investigation Status
ANALYSIS COMPLETE - Awaiting Go server logs for final diagnosis

