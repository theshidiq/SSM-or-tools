# Code Reference Guide: Staff Groups UPDATE Bug Investigation

## File Locations & Key Code Sections

### Frontend: Group Creation Flow

#### 1. User Clicks "Add Group" Button
**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/tabs/StaffGroupsTab.jsx`
**Lines:** 1426-1432

```javascript
<button
  onClick={createNewGroup}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
>
  <Plus size={16} />
  Add Group
</button>
```

#### 2. Create New Group Function
**File:** `StaffGroupsTab.jsx`
**Lines:** 617-653
**Key Code:**
```javascript
const createNewGroup = () => {
  const newGroup = {
    id: crypto.randomUUID(),  // ← NEW UUID
    name: newGroupName,
    description: "",
    color: getNextAvailableColor(),
    members: [],
  };
  
  setEditingGroup(newGroup.id);
  updateStaffGroups([...staffGroups, newGroup]);  // ← Triggers change detection
};
```

#### 3. Update Staff Groups
**File:** `StaffGroupsTab.jsx`
**Lines:** 436-532
**Key Code:**
```javascript
const updateStaffGroups = useCallback(
  async (newGroups, skipValidation = false) => {
    // ... validation ...
    const updatedSettings = {
      ...currentSettings,
      staffGroups: mergedGroups,
    };
    onSettingsChangeRef.current(updatedSettings);  // ← Calls updateSettings()
  },
  [currentScheduleId, validateStaffGroups],
);
```

**Note:** `onSettingsChangeRef.current` is the `updateSettings` function from SettingsContext.

---

### Frontend: Change Detection Logic

#### 4. Update Settings with Multi-Table Detection
**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useSettingsData.js`
**Lines:** 355-571
**Key Sections:**

**A. Get Old vs New Settings:**
```javascript
// Lines 404-429
const oldSettings = settingsRef.current || {};
const callbacks = wsCallbacksRef.current;

const oldGroups = oldSettings?.staffGroups ?? [];
const newGroups = newSettings?.staffGroups ?? [];

// Build ID sets
const oldGroupIds = new Set(oldGroups.map((g) => g.id));
const newGroupIds = new Set(newGroups.map((g) => g.id));
```

**B. Detect Created Groups:**
```javascript
// Lines 456-467
const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
createdGroupsCount = createdGroups.length;
if (createdGroups.length > 0) {
  console.log(`    - ${createdGroups.length} new group(s) created`);
  createdGroups.forEach((group) => {
    console.log(`      - Creating group "${group.name}" (${group.id})`);
    callbacks.wsCreateStaffGroup(group);  // ← SEND CREATE
  });
}
```

**C. Detect Updated Groups:**
```javascript
// Lines 532-565
const updatedGroups = newGroups.filter((newGroup) => {
  if (!oldGroupIds.has(newGroup.id)) return false;  // Skip new groups
  if (newGroup.is_active === false) return false;   // Skip soft-deleted

  const oldGroup = oldGroups.find((g) => g.id === newGroup.id);
  // Compare user-editable fields
  const oldData = {
    name: oldGroup?.name,
    description: oldGroup?.description,
    color: oldGroup?.color,
    members: oldGroup?.members || [],
  };
  const newData = {
    name: newGroup.name,
    description: newGroup.description,
    color: newGroup.color,
    members: newGroup.members || [],
  };
  return JSON.stringify(oldData) !== JSON.stringify(newData);
});

if (updatedGroups.length > 0) {
  console.log(`    - ${updatedGroups.length} group(s) updated`);
  updatedGroups.forEach((group) => {
    console.log(`      - Updating group "${group.name}": ...`);
    callbacks.wsUpdateStaffGroups(group);  // ← SEND UPDATE
  });
}
```

---

### Frontend: WebSocket Settings Context

#### 5. WebSocket Settings Hook
**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useWebSocketSettings.js`
**Key Functions:**
- `wsCreateStaffGroup(group)` - Sends CREATE message
- `wsUpdateStaffGroups(group)` - Sends UPDATE message
- `wsDeleteStaffGroup(groupId)` - Sends DELETE message

**Question:** How are these functions implemented? What exactly is sent to the Go server?

---

### Frontend: Settings Context

#### 6. Settings Provider
**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/contexts/SettingsContext.jsx`
**Lines:** 1-67

Provides `updateSettings` function to all components via context.

---

### Frontend: State Management

#### 7. Initial Settings Load
**File:** `useSettingsData.js`
**Lines:** 117-205

```javascript
useEffect(() => {
  if (useWebSocket && wsSettings) {
    const syncId = ++syncCounterRef.current;
    isSyncingFromWebSocketRef.current = true;

    // Transform multi-table response to localStorage-compatible format
    const aggregatedSettings = {
      staffGroups: normalizedStaffGroups,  // ← Includes group with database fields
      dailyLimits: wsSettings?.dailyLimits ?? [],
      monthlyLimits: wsSettings?.monthlyLimits ?? [],
      priorityRules: wsSettings?.priorityRules ?? [],
      mlParameters: wsSettings?.mlModelConfigs?.[0] ?? {},
      version: wsVersion,
    };

    setSettings(aggregatedSettings);  // ← Updates local state with complete group data
    // ... later, settingsRef.current is updated
  }
}, [useWebSocket, wsSettings, wsVersion]);
```

---

## The Bug: Step-by-Step Code Execution

### Timeline with Code References

**T1: User Creates Group**
```
File: StaffGroupsTab.jsx, Line 1427
User clicks "Add Group" button

File: StaffGroupsTab.jsx, Line 617
createNewGroup() executes

File: StaffGroupsTab.jsx, Line 639
newGroup = {id: "4e1fadd8-...", name: "New Group 1", ...}

File: StaffGroupsTab.jsx, Line 649
updateStaffGroups([...staffGroups, newGroup])
  ↓
File: StaffGroupsTab.jsx, Line 518
onSettingsChangeRef.current(updatedSettings)
  ↓
File: useSettingsData.js, Line 355
updateSettings(newSettingsOrUpdater) called
```

**T2: Change Detection Runs**
```
File: useSettingsData.js, Line 406
oldSettings = settingsRef.current (from previous render)

File: useSettingsData.js, Line 428-429
oldGroups = oldSettings?.staffGroups ?? []
newGroups = newSettings?.staffGroups ?? []

File: useSettingsData.js, Line 453-454
oldGroupIds = Set[existing-ids]  (NO "4e1fadd8")
newGroupIds = Set[existing-ids, "4e1fadd8"]

File: useSettingsData.js, Line 457
createdGroups = newGroups.filter(g => !oldGroupIds.has(g.id))
              = [newGroup with "4e1fadd8"]

File: useSettingsData.js, Line 465
callbacks.wsCreateStaffGroup(group) ← CREATE SENT ✓
```

**T3: Server Processes & Responds**
```
Go Server receives SETTINGS_CREATE_STAFF_GROUP message
Database: Inserts group
Go Server broadcasts SETTINGS_UPDATE (new group data)
```

**T4: Frontend Receives Server Response**
```
File: useSettingsData.js, Line 180
setSettings(aggregatedSettings)
  - staffGroups now includes "4e1fadd8" with database fields
  - isActive: true
  - createdAt: "2024-11-15T..."
  - updatedAt: "2024-11-15T..."

File: useSettingsData.js, Line 208-210
useEffect updates settingsRef.current with new state
```

**T5: User Adds Member to Group**
```
File: StaffGroupsTab.jsx, Line 834-856
addStaffToGroup(groupId, staffId)

File: StaffGroupsTab.jsx, Line 854
updateStaffGroups(updatedGroups)
  ↓
File: useSettingsData.js, Line 355
updateSettings() called AGAIN
```

**T6: Second Change Detection Runs (THE BUG)**
```
File: useSettingsData.js, Line 406
oldSettings = settingsRef.current (NOW INCLUDES THE GROUP!)

File: useSettingsData.js, Line 428-429
oldGroups = [existing, {id: "4e1fadd8", members: []}]
newGroups = [existing, {id: "4e1fadd8", members: ["staff-123"]}]

File: useSettingsData.js, Line 453-454
oldGroupIds = Set[..., "4e1fadd8"]  ← UUID NOW IN SET!
newGroupIds = Set[..., "4e1fadd8"]

File: useSettingsData.js, Line 457
createdGroups = newGroups.filter(g => !oldGroupIds.has(g.id))
              = []  ← EMPTY! UUID is in oldGroupIds

File: useSettingsData.js, Line 532-565
updatedGroups = filter where:
  - !oldGroupIds.has(g.id) = FALSE (UUID IS in oldGroupIds)
  - g.is_active !== false = TRUE
  - fields changed = TRUE (members: [] → ["staff-123"])
  = [group with "4e1fadd8"]

File: useSettingsData.js, Line 563
callbacks.wsUpdateStaffGroups(group)  ← UPDATE SENT ✓
```

**T7: Server Receives UPDATE**
```
Go Server receives SETTINGS_UPDATE_STAFF_GROUPS message
Database: Attempts UPDATE where id = "4e1fadd8-..."
Result: 0 rows affected (group doesn't exist)
Error: Group not found
```

---

## Console Logs to Look For

### Frontend Console

**Expected logs (if everything is working):**
```
💫 [createNewGroup] START - Current staffGroups: [...]
✅ [createNewGroup] Generated unique name: "New Group 1"
✅ [createNewGroup] New group object: {id: "4e1fadd8-...", ...}
💫 [updateStaffGroups] START: {newGroupsCount: X, ...}
✅ Sync #1 state updates applied, scheduling flag clear
🔍 [UPDATE SETTINGS] updateSettings called with: {oldGroupsCount: X, newGroupsCount: X+1}
  - Detecting staff_groups table changes...
    - 1 new group(s) created
      - Creating group "New Group 1" (4e1fadd8-...)
📤 [SEND CREATE] wsCreateStaffGroup called  ← IF THIS EXISTS

[Server response received]

🔄 Syncing WebSocket multi-table settings to local state (sync #2)
🔍 [UPDATE SETTINGS] updateSettings called with: {oldGroupsCount: X+1, newGroupsCount: X+1}
⭐ [addStaffToGroup] START: {groupId: "4e1fadd8-...", staffId: "..."}
💫 [updateStaffGroups] START: {newGroupsCount: X+1}
🔍 [UPDATE SETTINGS] updateSettings called with: {oldGroupsCount: X+1, newGroupsCount: X+1}
  - Detecting staff_groups table changes...
    - 1 group(s) updated
      - Updating group "New Group 1": 0 → 1 members
📤 [SEND UPDATE] wsUpdateStaffGroups called  ← CORRECT AT THIS POINT
```

### Go Server Logs

**Expected logs:**
```
[timestamp] SETTINGS_CREATE_STAFF_GROUP {id: "4e1fadd8-...", name: "New Group 1", ...}
[timestamp] Successfully created staff group: 4e1fadd8-...
[timestamp] Broadcasting SETTINGS_UPDATE to all clients
[timestamp] SETTINGS_UPDATE_STAFF_GROUPS {id: "4e1fadd8-...", members: ["staff-123"]}
[timestamp] Successfully updated staff group: 4e1fadd8-...
```

**Problem logs:**
```
[timestamp] SETTINGS_UPDATE_STAFF_GROUPS {id: "4e1fadd8-...", members: ["staff-123"]}
[timestamp] ERROR: UPDATE failed - no rows affected
[timestamp] ERROR: Group 4e1fadd8-... not found in database
```

---

## Questions to Answer

### For Frontend Investigation:
1. [ ] Does `wsCreateStaffGroup()` actually send the CREATE message?
2. [ ] Is the CREATE message reaching the Go server?
3. [ ] When you add a member, does the console show "1 group(s) updated"?
4. [ ] Does `wsUpdateStaffGroups()` send the UPDATE message with correct data?

### For Go Server Investigation:
1. [ ] Does the server receive SETTINGS_CREATE_STAFF_GROUP message?
2. [ ] Does the CREATE succeed (group inserted into database)?
3. [ ] Does the server broadcast the created group back?
4. [ ] When UPDATE is received, does the group exist in database?
5. [ ] What error is returned when UPDATE fails?

### For WebSocket Investigation:
1. [ ] Does the WebSocket connection stay open between messages?
2. [ ] Are both CREATE and UPDATE messages being sent?
3. [ ] Is the server responding to both messages?
4. [ ] Are errors being communicated back to the client?

---

## Next Steps

### Immediate Actions:
1. [ ] Check Go server logs for SETTINGS_CREATE_STAFF_GROUP messages
2. [ ] Check Go server logs for SETTINGS_UPDATE_STAFF_GROUPS messages
3. [ ] Verify group creation time vs. update time in database
4. [ ] Check for any WebSocket connection drops

### Quick Fixes (Server-Side):
1. [ ] Implement UPSERT logic (UPDATE or CREATE)
2. [ ] Add proper error responses for non-existent groups
3. [ ] Add logging for all staff group operations
4. [ ] Verify database constraints aren't blocking CREATE

### Quick Fixes (Client-Side):
1. [ ] Add error handling for failed updates
2. [ ] Queue updates until CREATE succeeds
3. [ ] Add explicit logging when CREATE is sent
4. [ ] Monitor WebSocket connection health

---

## Implementation Details to Check

### useWebSocketSettings.js
Search for:
```javascript
wsCreateStaffGroup(group)
wsUpdateStaffGroups(group)
```

These functions should:
1. Create proper WebSocket message
2. Send to Go server
3. Handle response
4. Update local state on success/error

### Go Server WebSocket Handler
Search for:
```go
case "SETTINGS_CREATE_STAFF_GROUP":
case "SETTINGS_UPDATE_STAFF_GROUPS":
```

These should:
1. Parse message
2. Call database functions
3. Check for errors
4. Send response back to client
5. Broadcast update to all clients
