# Visual Timeline: How New Group Gets Sent as UPDATE

## The Problem in Action

```
TIME  FRONTEND STATE              GO SERVER              WEBSOCKET          LOGS
────────────────────────────────────────────────────────────────────────────────────────

T0    staffGroups = [           (empty database)
      ]                          

                                                         
      User clicks "Add Group" ──────────>

T1    staffGroups = [
        ...existing groups...,
        {                      ← NEW group in LOCAL state
          id: "4e1fadd8-...",
          name: "New Group 1",
          description: "",
          color: "#3B82F6",
          members: []
        }
      ]
      
      updateSettings() called
      oldSettings = settingsRef from T0 ← STALE!
      oldGroupIds = Set[existing-ids]  (NO "4e1fadd8")
      newGroupIds = Set[existing-ids, "4e1fadd8"]
      
      Change detection:
      createdGroups = [group with "4e1fadd8"]  ← CORRECT!
      
                                                    ──> SETTINGS_CREATE_STAFF_GROUP
                                                        {
                                                          id: "4e1fadd8-...",
                                                          name: "New Group 1",
                                                          ...
                                                        }

      Console: "1 new group(s) created"  ✓

─────────────────────────────────────────────────────────────────────────────────────────

T2                               Receives CREATE msg
                                 Inserts into database
                                 Returns: {
                                   id: "4e1fadd8-...",
                                   name: "New Group 1",
                                   members: [],
                                   isActive: true,
                                   createdAt: "2024-11-15T...",
                                   updatedAt: "2024-11-15T..."
                                 }
                                                    <── SETTINGS_UPDATE (broadcast)
                                                        Returns full group data

T3    WebSocket receives UPDATE
      setSettings() called
      Now local state has:
      staffGroups = [
        ...existing groups...,
        {
          id: "4e1fadd8-...",
          name: "New Group 1",
          description: "",
          color: "#3B82F6",
          members: [],
          isActive: true,           ← NOW HAS DB FIELDS
          createdAt: "...",
          updatedAt: "..."
        }
      ]
      
      settingsRef.current gets updated to this NEW state

─────────────────────────────────────────────────────────────────────────────────────────

      User edits group - adds member ──────>

T4    updateStaffGroups() called
      updateSettings() called again
      
      oldSettings = settingsRef from T3  ← NOW UP-TO-DATE!
      oldGroups = [
        ...existing...,
        {id: "4e1fadd8-...", members: []}  ← From server at T3
      ]
      
      newGroups = [
        ...existing...,
        {id: "4e1fadd8-...", members: ["staff-123"]}  ← User added member
      ]
      
      oldGroupIds = Set[..., "4e1fadd8"]  ← GROUP ID NOW IN SET!
      newGroupIds = Set[..., "4e1fadd8"]
      
      Change detection:
      createdGroups = [] ← NOT CREATED (UUID in oldGroupIds!)
      updatedGroups = [{id: "4e1fadd8-...", members: [...]}]  ← DETECTED AS UPDATE!
                                                    ──> SETTINGS_UPDATE_STAFF_GROUPS
                                                        {
                                                          id: "4e1fadd8-...",
                                                          name: "New Group 1",
                                                          members: ["staff-123"]
                                                        }

      Console: "1 group(s) updated"  ❌ WRONG!

─────────────────────────────────────────────────────────────────────────────────────────

T5                               Receives UPDATE msg
                                 Tries: UPDATE staff_groups 
                                        WHERE id = "4e1fadd8-..."
                                        SET members = ['staff-123']
                                 
                                 Result: 0 rows affected
                                 (Group exists! Was created at T2!)
                                 
                                 But frontend doesn't know about
                                 this error - message got lost

      ❌ DESYNC: Group is in database
         but frontend doesn't know
         about the update failure
```

---

## Why This Happens: The Root Cause Chain

### 1. **Frontend Creates in Memory, Not in DB**
```javascript
// StaffGroupsTab.jsx:649
const newGroup = {
  id: crypto.randomUUID(),  // ← Generated locally
  name: "New Group 1",
  members: []
};
updateStaffGroups([...staffGroups, newGroup]);  // ← Added to local state
```

At this point:
- Group exists in React state
- Group DOES NOT exist in database
- Group DOES NOT exist in oldSettings (settingsRef)

### 2. **Change Detection Correctly Identifies as CREATE**
```javascript
// useSettingsData.js:457
const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
```

- `oldGroupIds` = IDs from T0 state (before new group)
- New group's UUID is NOT in oldGroupIds
- **Correctly detected as CREATE** ✓

### 3. **CREATE Message Sent to Server**
```javascript
// useSettingsData.js:465
callbacks.wsCreateStaffGroup(group);
```

Server receives CREATE, inserts group, broadcasts back.

### 4. **Server Sync Updates Local State**
```javascript
// useSettingsData.js:154
setSettings(aggregatedSettings);  // Now includes created group
```

The group now exists in LOCAL state with ALL database fields.

### 5. **User Edits the Group (Adds Member)**
When user adds a member and calls updateSettings() again:

```javascript
// useSettingsData.js:453
const oldGroupIds = new Set(oldGroups.map((g) => g.id));
// OLD GROUP IDS NOW INCLUDES "4e1fadd8-..." from server sync!
```

- `oldSettings` = State from T3 (includes the group)
- `oldGroupIds` = includes the UUID
- **UUID is in oldGroupIds** → Not a CREATE
- Fields changed (members: [] vs members: ["staff-123"]) → **UPDATE**

### 6. **UPDATE Message Sent (WRONG!)**
```javascript
// useSettingsData.js:563
callbacks.wsUpdateStaffGroups(group);
```

Frontend thinks: "This group was in the system before, and I'm updating it"

---

## The Missing Logic

The change detection doesn't track:
- Which groups are NEWLY CREATED (not yet synced from server)
- vs. Which groups EXISTED BEFORE this updateSettings cycle

### Current Logic
```javascript
if (!oldGroupIds.has(g.id)) {
  // CREATE
} else {
  // UPDATE
}
```

This only checks: "Does the ID exist in old state?" Yes/No.

### Missing Logic
```javascript
if (!oldGroupIds.has(g.id)) {
  // CREATE - group didn't exist in previous state
} else if (groupWasJustCreatedAndNotYetInDatabase(g.id)) {
  // Don't send UPDATE yet, wait for CREATE to complete
} else {
  // UPDATE - group exists in database
}
```

---

## Why Server Shows UPDATE Instead of CREATE

Looking at the logs:
```
Server log: SETTINGS_UPDATE_STAFF_GROUPS received
Database: No group with this ID exists
Action: UPDATE fails
Result: Desync - client thinks it sent CREATE, server never got it
```

The issue is:
1. Client sent CREATE (implicit) but then IMMEDIATELY sent UPDATE
2. Between CREATE and UPDATE, there's a timing gap
3. If UPDATE arrives before CREATE is fully processed, or
4. If CREATE fails silently, UPDATE will fail with "no rows affected"

---

## The Real Solution

There are two possible fixes:

### Fix 1: Server-Side (Recommended)
Make `SETTINGS_UPDATE_STAFF_GROUPS` handle non-existent groups:

```go
// In go-server - handle staff group update
func (h *StaffGroupHandler) UpdateStaffGroup(group StaffGroup) error {
  // First, check if group exists
  exists, err := h.db.StaffGroupExists(group.ID)
  if err != nil {
    return err
  }
  
  if !exists {
    // Group doesn't exist - create it instead
    return h.db.CreateStaffGroup(&group)
  }
  
  // Group exists - update it
  return h.db.UpdateStaffGroup(&group)
}
```

### Fix 2: Client-Side
Track "pending creates" and don't send UPDATEs until CREATE completes:

```javascript
// In useSettingsData.js or separate hook
const pendingCreates = useRef(new Set());

// After CREATE is sent:
pendingCreates.current.add(groupId);

// When server confirms CREATE:
pendingCreates.current.delete(groupId);

// When detecting changes:
if (!oldGroupIds.has(g.id)) {
  // CREATE
  pendingCreates.current.add(g.id);
  wsCreateStaffGroup(g);
} else if (pendingCreates.current.has(g.id)) {
  // Skip UPDATE until CREATE completes
  console.log("Queuing UPDATE until CREATE completes for:", g.id);
} else {
  // UPDATE
  wsUpdateStaffGroups(g);
}
```

### Fix 3: Client-Side (Simpler)
Include `isActive` field in new groups so server knows it's a full object:

```javascript
// StaffGroupsTab.jsx:638-644
const newGroup = {
  id: crypto.randomUUID(),
  name: newGroupName,
  description: "",
  color: getNextAvailableColor(),
  members: [],
  isActive: true  // ← ADD THIS to signal it's a new group
};
```

Then in change detection, send CREATE differently based on `isActive` presence.

---

## Recommended Fix

**Fix 1 (Server-Side Upsert)** is recommended because:
1. More robust - handles race conditions naturally
2. Client doesn't need to track pending creates
3. Simple UPDATE becomes UPDATE-or-CREATE (UPSERT)
4. No changes needed to client logic

The Go server should change:
- `SETTINGS_UPDATE_STAFF_GROUPS` to check if group exists
- If not, INSERT instead of UPDATE
- Return appropriate status code (201 for created, 200 for updated)
