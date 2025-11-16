# Investigation Summary: New Staff Groups UPDATE Bug

## Quick Answer

**The frontend is NOT incorrectly sending UPDATE instead of CREATE.**

The frontend correctly sends CREATE when a new group is first created. However, when the user immediately edits that group (adds a member), the frontend correctly detects a change and sends an UPDATE message.

**The real problem:** The Go server receives the UPDATE message for a group that should exist (because CREATE was sent first), but:
1. The group DOESN'T exist in the database, or
2. The update fails and the error isn't communicated back to the frontend

This causes a desync where:
- Frontend thinks the group exists and is updating it
- Server responds with a 400/500 error
- Frontend state remains with the "new" group, but database has no trace of it

---

## What's Actually Happening

### Step 1: User Creates Group (CORRECT)
```javascript
// StaffGroupsTab.jsx creates new group
createNewGroup() → {
  id: "4e1fadd8-...",
  name: "New Group 1",
  description: "",
  color: "#3B82F6",
  members: []
}

// Added to local state
updateStaffGroups([...staffGroups, newGroup])

// Change detection in useSettingsData.js:
oldGroupIds = Set[...existing] // Does NOT include "4e1fadd8"
createdGroups = newGroups.filter(g => !oldGroupIds.has(g.id))
// Returns the new group

// Action: wsCreateStaffGroup() is called ✓
// Frontend log: "1 new group(s) created" ✓
```

### Step 2: Server Creates Group
- Receives CREATE message
- Inserts into database
- Broadcasts SETTINGS_UPDATE back with full group data

### Step 3: Frontend Syncs from Server
- Local state now has the group WITH database fields
- `settingsRef.current` is updated

### Step 4: User Edits Group (Adds Member)
```javascript
// User adds member
addStaffToGroup(groupId, staffId)

// This calls updateStaffGroups() again
// Now change detection runs with:
oldGroupIds = Set[..., "4e1fadd8"] // NOW INCLUDES IT (from T3 sync)
updatedGroups = filter where id is in oldGroupIds AND fields changed
// Returns the group (because members: [] → [staffId])

// Action: wsUpdateStaffGroups() is called ✓
// Frontend log: "1 group(s) updated" ✓
```

### Step 5: Server Receives UPDATE
- Group is being updated when it SHOULD already exist
- But something fails:
  - Group doesn't exist in database (CREATE failed), OR
  - UPDATE query returns 0 rows affected, OR
  - Race condition: UPDATE arrives before CREATE is committed

---

## The Real Issue: Incomplete Root Cause Analysis

Based on the Go server logs showing:
- "SETTINGS_UPDATE_STAFF_GROUPS" message received
- Database query with UPDATE (not CREATE)
- Group DOESN'T exist in database

### Most Likely Scenario:

**CREATE message never reaches the server, or CREATE fails silently.**

Evidence:
- Frontend log says "1 new group(s) created" (correct detection)
- But Go server shows UPDATE message (not CREATE)
- Group doesn't exist in database

This suggests:
1. CREATE message is sent but LOST before reaching server
2. CREATE message reaches server but INSERT fails
3. WebSocket connection drops after CREATE but before confirmation

---

## Missing Information Needed

To fully diagnose the issue, we need:

### From Go Server Logs:
```
[ ] 1. Is there a SETTINGS_CREATE_STAFF_GROUP message?
[ ] 2. When was it sent relative to SETTINGS_UPDATE_STAFF_GROUPS?
[ ] 3. What was the CREATE response (success or error)?
[ ] 4. When was the group actually inserted into database?
[ ] 5. What error occurred during UPDATE (if any)?
[ ] 6. Did WebSocket connection stay stable during the exchange?
```

### From Frontend Console Logs:
```
[ ] 1. Was "1 new group(s) created" logged?
[ ] 2. When was the WebSocket UPDATE received from server?
[ ] 3. Were there any WebSocket connection errors?
[ ] 4. Did the initial sync complete successfully?
[ ] 5. What does staffGroupsRef show at T4?
```

---

## The Code Flow Verified

### Frontend Change Detection (useSettingsData.js:355-571)
The code is CORRECT. It properly:
1. Detects CREATE when UUID not in oldGroupIds ✓
2. Detects UPDATE when UUID in oldGroupIds and fields differ ✓
3. Calls appropriate WebSocket function for each case ✓
4. Sends correct messages in correct order ✓

### Frontend Group Creation (StaffGroupsTab.jsx:617-653)
The code is CORRECT. It:
1. Generates unique UUID for group ✓
2. Creates group object with required fields ✓
3. Adds to local state ✓
4. Calls updateSettings() which triggers proper detection ✓

### WebSocket Message Flow
The frontend properly:
1. Calls wsCreateStaffGroup() for new groups
2. Calls wsUpdateStaffGroups() for modified existing groups
3. Sends to Go server via WebSocket

---

## The Problem: Server-Side

### Most Likely Root Cause

The Go server's SETTINGS_UPDATE_STAFF_GROUPS handler:

**Receives UPDATE message for a group that doesn't exist**

This happens when:
1. CREATE message was lost in transit
2. CREATE succeeded but server broadcast didn't reach client
3. CREATE failed on server but client never got error notification
4. Race condition: UPDATE arrives before CREATE is fully committed

### What Happens Next

```go
// In go-server (pseudocode)
if message.Type == "SETTINGS_UPDATE_STAFF_GROUPS" {
  // Try to update the group
  result := db.UpdateStaffGroup(message.Group)
  if result.RowsAffected == 0 {
    // Error: No rows were updated
    // Group doesn't exist in database!
    return error("group not found")
  }
}
```

The frontend never receives this error because the server doesn't acknowledge it properly or the WebSocket connection fails.

---

## Recommended Investigation Steps

### 1. Check Go Server Logs
Look for:
- SETTINGS_CREATE_STAFF_GROUP messages
- SETTINGS_UPDATE_STAFF_GROUPS messages  
- Timing between them
- Any error responses

### 2. Add Explicit Error Handling
In go-server, modify staff group update to:
```go
if rows == 0 {
  // Try to create if update failed
  return CreateStaffGroup(group)  // UPSERT pattern
}
```

### 3. Add Client-Side Error Handling
In useWebSocketSettings, listen for:
- Staff group update failures
- Provide user feedback when update fails

### 4. Verify CREATE Was Sent
Add explicit logging in useSettingsData.js when wsCreateStaffGroup() is called:
```javascript
if (createdGroups.length > 0) {
  console.log(`📤 [SEND CREATE] Sending CREATE messages:`, createdGroups);
  createdGroups.forEach((group) => {
    console.log(`   - Group: ${group.id} (${group.name})`);
    callbacks.wsCreateStaffGroup(group);
  });
}
```

---

## Files to Check Next

1. **go-server/main.go** or **go-server/handlers/staff_groups.go**
   - SETTINGS_UPDATE_STAFF_GROUPS handler
   - Check if it handles non-existent groups

2. **go-server/supabase/** or **go-server/db/**
   - UpdateStaffGroup() method
   - Check return value handling

3. **src/hooks/useWebSocketSettings.js** (if exists)
   - wsUpdateStaffGroups() implementation
   - What message is sent exactly?
   - How are responses handled?

---

## Quick Test to Verify

1. Open browser DevTools → Network tab
2. Filter for WebSocket messages
3. Create new staff group
4. Look for messages sent:
   - Should see SETTINGS_CREATE_STAFF_GROUP (or CREATE message)
   - Should see SETTINGS_UPDATE_STAFF_GROUPS only when you edit it

5. In Go server logs, verify:
   - Does the same message pattern appear?
   - Are both CREATE and UPDATE received?
   - When does group appear in database?

---

## Conclusion

**This is NOT a frontend bug in change detection logic.**

The frontend correctly:
- Identifies new groups as CREATE
- Sends CREATE message to server
- Later sends UPDATE for subsequent edits

**The issue is likely:**
1. CREATE message not reaching server (connection loss)
2. CREATE failing on server (constraint violation, duplicate key, etc.)
3. Server not properly communicating CREATE success back to client
4. Server trying to UPDATE before CREATE completes (race condition)

**The fix should be on the server side** to handle UPDATE for non-existent groups by creating them (UPSERT pattern), or properly tracking and communicating CREATE message success.

