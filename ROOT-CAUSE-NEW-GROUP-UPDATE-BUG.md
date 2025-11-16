# Root Cause: New Staff Groups Being Sent as UPDATE Instead of CREATE

## Summary
When creating a NEW staff group in the frontend, it's being detected as an UPDATE operation instead of a CREATE. This causes the Go server to attempt an update on a non-existent group (400-level error), when it should be creating it.

**Affected Group:**
- Group ID: `4e1fadd8-8c90-4427-9689-3ea2d45e6ccc`
- Group Name: `New Group 1`
- Frontend log: "1 group(s) updated" (WRONG - should be CREATE)
- Expected log: "1 new group(s) created"

---

## The Flow: How Groups Get Created

### 1. User Clicks "Add Group" Button (StaffGroupsTab.jsx)
```javascript
// StaffGroupsTab.jsx:1427-1432
<button onClick={createNewGroup} className="...">
  <Plus size={16} />
  Add Group
</button>
```

### 2. createNewGroup() Called (StaffGroupsTab.jsx:617-653)
```javascript
const createNewGroup = () => {
  // ... Generate unique name ...
  const newGroup = {
    id: crypto.randomUUID(),  // ← NEW UUID generated here
    name: newGroupName,
    description: "",
    color: getNextAvailableColor(),
    members: [],
  };
  
  setEditingGroup(newGroup.id);
  updateStaffGroups([...staffGroups, newGroup]);  // ← Add to LOCAL state
};
```

**Key Point:** At this moment, the group is created in LOCAL state only. It does NOT exist in the database.

### 3. updateStaffGroups() Called (StaffGroupsTab.jsx:436-532)
This calls the context's `updateSettings()` function:
```javascript
updateStaffGroups([...staffGroups, newGroup]);
// Calls: onSettingsChangeRef.current(updatedSettings);
// Which calls: updateSettings() from SettingsContext
```

### 4. updateSettings() Detects Changes (useSettingsData.js:355-571)

This is where the BUG occurs. Let's trace the logic:

```javascript
// useSettingsData.js:355
const updateSettings = useCallback((newSettingsOrUpdater) => {
  const newSettings = typeof newSettingsOrUpdater === 'function' 
    ? newSettingsOrUpdater(settingsRef.current || {})
    : newSettingsOrUpdater;

  // ... 

  if (useWebSocket) {
    // Get the old and new settings
    const oldSettings = settingsRef.current || {};  // ← OLD STATE
    const oldGroups = oldSettings?.staffGroups ?? [];
    const newGroups = newSettings?.staffGroups ?? [];

    // Line 457: Detect CREATED groups
    const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
    
    // Line 532: Detect UPDATED groups
    const updatedGroups = newGroups.filter((newGroup) => {
      if (!oldGroupIds.has(newGroup.id)) return false;  // ← Skip if not in old
      if (newGroup.is_active === false) return false;
      
      const oldGroup = oldGroups.find((g) => g.id === newGroup.id);
      // ... compare fields ...
      return JSON.stringify(oldData) !== JSON.stringify(newData);
    });
  }
});
```

---

## The Root Cause: Timing of oldSettings vs newSettings

### The Problem

When `createNewGroup()` is called:

1. **Local React State Update (Synchronous):**
   ```javascript
   updateStaffGroups([...staffGroups, newGroup]);
   ```
   This calls `updateSettings()` with the NEW state.

2. **useSettingsData.js gets called with:**
   ```javascript
   newSettings = {
     staffGroups: [
       // ... existing groups from React state ...
       { id: "4e1fadd8-...", name: "New Group 1", members: [], ... }  // ← NEW
     ]
   }
   ```

3. **oldSettings comes from ref:**
   ```javascript
   const oldSettings = settingsRef.current;
   // This is updated by useEffect AFTER state change completes (useSettingsData.js:208-210)
   ```

### The Race Condition

**Scenario 1: WebSocket is NOT Connected Yet**
- `useWebSocket = false` (WebSocket disabled or disconnected)
- `updateSettings()` is called BUT exits early:
  ```javascript
  if (useWebSocket) {
    // ... change detection code ...
  }
  // No CREATE/UPDATE messages sent
  ```
- State updates locally, but NO WebSocket messages sent
- When user adds another member to the NEW group and edits it, the group is STILL only in local state

**Scenario 2: WebSocket IS Connected BUT settingsRef is STALE**
- The most likely issue!
- `updateSettings()` is called with new group
- `settingsRef.current` still contains OLD state (before the new group was added)
- `oldGroupIds` = Set of old group IDs (doesn't include the new UUID)
- `newGroupIds` = Set of all groups INCLUDING the new one

```javascript
const oldGroupIds = new Set(oldGroups.map((g) => g.id));
// = Set[ "existing-id-1", "existing-id-2", ... ]  ← NEW UUID NOT HERE

const newGroupIds = new Set(newGroups.map((g) => g.id));
// = Set[ "existing-id-1", "existing-id-2", ..., "4e1fadd8-..." ]  ← NEW UUID HERE

// Line 457 - Create detection:
const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
// ✅ This SHOULD detect the new group!
```

So the detection logic SHOULD work...

---

## The ACTUAL Root Cause: Initial Mount Detection Gate

### Look at this code (useSettingsData.js:431-440)

```javascript
// ✅ FIX #5 CORRECTION: Guard against initial WebSocket sync ONLY
// Only skip if this is during initial WebSocket sync (not user-initiated changes)
const isInitialLoad = !hasCompletedInitialLoadRef.current && oldGroups.length === 0;

if (isInitialLoad && newGroups.length > 0) {
  console.log(`🔒 [FIX #5] Skipping change detection - initial WebSocket sync...`);
  hasCompletedInitialLoadRef.current = true;
  // Don't process change detection during initial WebSocket sync
} else {
  // Normal operation - process all changes (CREATE, UPDATE, DELETE)
  // ... change detection here ...
}
```

**THE GATE IS SUPPOSED TO ONLY SKIP THE INITIAL LOAD.**

But here's what might happen:

### Timing Issue: When Does settingsRef Get Updated?

1. User clicks "Add Group"
2. `updateStaffGroups([...staffGroups, newGroup])` called
3. This calls `updateSettings(newSettings)` from SettingsContext
4. Inside `updateSettings()`:
   - Gets `oldSettings = settingsRef.current` (might be STALE)
   - Calls change detection logic
   
5. **BUT WAIT** - When does `settingsRef` get updated?

Looking at useSettingsData.js:208-210:
```javascript
useEffect(() => {
  settingsRef.current = settings;
}, [settings]);
```

This happens AFTER the state is set! But `updateSettings()` runs DURING the render cycle.

### The Real Issue: oldSettings is From Previous State

When you do:
```javascript
updateStaffGroups([...staffGroups, newGroup]);
```

Inside `StaffGroupsTab.jsx`, this calls:
```javascript
onSettingsChangeRef.current(updatedSettings);
```

Which is the context's `updateSettings()`. At THIS MOMENT:

- **newSettings** = the settings being passed in (WITH the new group)
- **settingsRef.current** = OLD settings (from the PREVIOUS render)

Then, the normal flow:
1. Change detection runs (using old vs new)
2. WebSocket messages sent based on detection
3. React re-renders
4. settingsRef gets updated to new state
5. **NEXT** change detection might see the group again (from WebSocket sync)

---

## The Likely Scenario: Group Created Locally, Then Server Syncs

Here's what I think is happening:

### Sequence of Events:

1. **T1: User creates group locally**
   - Group added to React state in StaffGroupsTab
   - `updateSettings()` called with new group
   - `oldGroupIds` doesn't have the new UUID (comes from stale ref)
   - Change detection sees: oldGroupIds.has(newId) = false
   - **CREATE message SHOULD be sent** ✓

2. **T2: Frontend sends CREATE message to WebSocket**
   - Server receives CREATE
   - Server creates group in database
   - Server broadcasts SETTINGS_UPDATE back to frontend

3. **T3: WebSocket sync updates local state**
   - Frontend receives server's staffGroups array
   - This includes the newly created group (from database)
   - State is set via `setSettings(aggregatedSettings)`
   - Now local state has the group WITH database fields (createdAt, updatedAt, etc.)

4. **T4: CRITICAL - Next user action on the group**
   - User adds a member to the new group
   - `updateGroup()` called → `updateStaffGroups()` → `updateSettings()`
   - Now comparing:
     - oldGroups = old state (had group with 0 members)
     - newGroups = new state (has group with 1 member)
   - **The UUID IS in oldGroupIds now** (because step 3 put it there)
   - Change detection thinks: "Group exists in old AND new, fields changed"
   - **UPDATE message is sent** ❌ (should still be CREATE, or server should create if needed)

### Why the Frontend Logs "1 group(s) updated"

From useSettingsData.js:556-565:
```javascript
if (updatedGroups.length > 0) {
  console.log(`    - ${updatedGroups.length} group(s) updated`);
  updatedGroups.forEach((group) => {
    const oldGroup = oldGroups.find((g) => g.id === group.id);
    console.log(
      `      - Updating group "${group.name}": ${oldGroup?.members?.length || 0} → ${group.members?.length || 0} members`,
    );
    callbacks.wsUpdateStaffGroups(group);  // ← Sends UPDATE
  });
}
```

The group is in `updatedGroups` because:
1. The UUID exists in `oldGroupIds` (from previous sync)
2. The fields are different (members: 0 → 1)
3. So it's treated as an UPDATE

---

## Why the Database Has No Record

The Go server receives:
```
SETTINGS_UPDATE_STAFF_GROUPS {
  id: "4e1fadd8-...",
  name: "New Group 1",
  members: [staffId]
}
```

It tries to UPDATE (instead of INSERT) and either:
1. Gets 0 rows affected (no group to update)
2. Returns an error

The frontend never gets notified that the group doesn't exist in the database!

---

## The Missing Piece: Initial Group Creation

The question is: **Was the CREATE message ever sent?**

Looking at the timeline:
- If CREATE was sent and succeeded, the group would exist in the database
- The subsequent UPDATE would work fine

So either:
1. CREATE message was NOT sent (change detection failed)
2. CREATE message was sent but FAILED on the server
3. CREATE message was sent and succeeded, BUT the member update was sent as separate UPDATE

Let me check option 3...

---

## Hypothesis: Separate CREATE vs Member Update

When you create a group and immediately add a member:

1. **First updateSettings() call**: Group created with 0 members
   - Detects: NEW group with id, name, color, description, members=[]
   - Sends: `wsCreateStaffGroup(group)` ✓

2. **Second updateSettings() call**: Member added
   - Now oldGroups has the group (from server sync after create)
   - newGroups has same group but with members=[staffId]
   - Detects: UPDATE (group exists in both, members differ)
   - Sends: `wsUpdateStaffGroups(group)` ✓

**This should work fine!** Unless...

### The Real Issue: The CREATE Message Itself

Let's look at what wsCreateStaffGroup sends. Let me check that:

---

## CRITICAL FINDING: What Data is Sent?

In StaffGroupsTab.jsx:649:
```javascript
updateStaffGroups([...staffGroups, newGroup]);
```

The newGroup object at this point:
```javascript
{
  id: "4e1fadd8-...",
  name: "New Group 1", 
  description: "",
  color: "#3B82F6",
  members: []
}
```

**This group DOES NOT have these fields:**
- `isActive` (undefined)
- `createdAt` (undefined)
- `updatedAt` (undefined)

When this is sent in the CREATE message, the server receives this exact structure and tries to insert it.

**Then when you add a member:**

The updated group is:
```javascript
{
  id: "4e1fadd8-...",
  name: "New Group 1",
  description: "",
  color: "#3B82F6",
  members: ["staff-id-123"]
}
```

This is sent as UPDATE, not CREATE!

### The Bug Chain:

1. User creates group → localgroup = {id, name, desc, color, members: []}
2. `updateSettings()` called
3. Change detection: Is this in oldGroupIds? NO → CREATE ✓
4. `wsCreateStaffGroup(group)` sent to server
5. Server should insert... but maybe it's failing?
6. EVEN IF IT SUCCEEDS, when user adds member:
7. Frontend's oldGroups now has the group (from server sync)
8. newGroups has same group with updated members
9. Change detection: Is this in oldGroupIds? YES → UPDATE ✓
10. But WHY send UPDATE for just adding members when CREATE should handle it?

---

## The Actual Root Cause Found

Looking at lines 456-467 of useSettingsData.js:

```javascript
// Detect CREATED groups (exist in new but not in old)
const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
createdGroupsCount = createdGroups.length;
if (createdGroups.length > 0) {
  console.log(`    - ${createdGroups.length} new group(s) created`);
  createdGroups.forEach((group) => {
    console.log(
      `      - Creating group "${group.name}" (${group.id})`,
    );
    callbacks.wsCreateStaffGroup(group);
  });
}
```

**What gets sent to wsCreateStaffGroup?**

The entire `group` object from newGroups. But if this is the SECOND updateSettings() call (after server synced the create response), then:

1. Server sent back the created group with ALL fields
2. Local state now has: {id, name, desc, color, members, createdAt, updatedAt, isActive, ...}
3. User adds a member
4. updateSettings() called
5. oldGroups has complete object
6. newGroups has same object but members differ
7. Is this group in oldGroupIds? **YES** (it was added in step 2)
8. Skip CREATE, go to UPDATE

### The Final Answer:

**The group is detected as UPDATE because:**

1. The CREATE message WAS sent (if old state was truly empty)
2. The server created the group successfully
3. The server broadcast the created group back with full fields
4. Local state now has the complete group in oldGroups
5. When members are added later, oldGroupIds INCLUDES this UUID
6. The change detection logic treats subsequent changes as UPDATE instead of realizing it's a new group

**The real bug:** Change detection logic doesn't distinguish between:
- A group that's been in the system for a while
- A group that was JUST created in this same updateSettings cycle

---

## Verification Needed

From Go server logs, check if CREATE was received and succeeded:
1. Was there a CREATE message before the UPDATE?
2. Did the CREATE succeed (200 response)?
3. When was the group created in the database vs when was UPDATE attempted?

---

## Solution Options

### Option 1: Don't Send UPDATE Right After CREATE
Track groups that were just created and skip immediate UPDATEs

### Option 2: Use Server-Side Upsert
Make wsUpdateStaffGroups() handle non-existent groups by creating them

### Option 3: Track Group Lifecycle
Keep track of which groups are "new" (created this session) and only send UPDATEs, never CREATE

### Option 4: Queue Changes Until CREATE Succeeds
Don't allow member edits until CREATE succeeds

---

## Files Involved

1. **src/components/settings/tabs/StaffGroupsTab.jsx** (lines 617-653)
   - `createNewGroup()` - Creates group in local state
   - `updateStaffGroups()` - Sends to updateSettings()

2. **src/hooks/useSettingsData.js** (lines 355-571)
   - `updateSettings()` - Detects CREATE vs UPDATE
   - Change detection logic (lines 456-565)

3. **src/contexts/SettingsContext.jsx**
   - Provides updateSettings to components

4. **Go Server** (presumably in go-server/)
   - Receives SETTINGS_UPDATE_STAFF_GROUPS messages
   - Should handle CREATE vs UPDATE

---

## Go Server Side

The Go server receives SETTINGS_UPDATE_STAFF_GROUPS with:
```json
{
  "group": {
    "id": "4e1fadd8-...",
    "name": "New Group 1",
    "members": [...]
  }
}
```

And tries to UPDATE existing record. When no record exists, it fails with:
```
error: no rows affected
```

The fix on the server side: Before UPDATE, check if group exists. If not, INSERT instead.
OR
The client shouldn't send UPDATE for groups that haven't been confirmed created yet.
