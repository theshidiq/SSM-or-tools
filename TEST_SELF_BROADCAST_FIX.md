# Test Plan: Self-Broadcast Loop Fix

## Test Environment
- Dev Server: http://localhost:3000 ✅ Running
- Go WebSocket Server: ws://localhost:8080 ✅ Running (PID: 64006, 64008)
- Browser: Chrome (recommended for DevTools console monitoring)

## Pre-Test Verification

### 1. Check Environment Variables
```bash
# Should return: true
echo $REACT_APP_WEBSOCKET_SETTINGS
```

### 2. Verify Go Server Health
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy","clients":...}
```

## Test Cases

### Test 1: Edit Group Name (Infinite Loop Check)
**Objective**: Verify no infinite sync loop when editing group name

**Steps**:
1. Open http://localhost:3000
2. Navigate to Settings → Staff Groups tab
3. Open browser DevTools (F12) → Console tab
4. Click Edit button on any group
5. Type slowly in the group name field (e.g., "Test Group 123")
6. Wait 1 second after typing

**Expected Results**:
- ✅ Console shows ONE "✏️ [updateGroup] Called" per keystroke
- ✅ Console shows ONE "⏱️ [updateGroup] Debounce timer fired" after 500ms
- ✅ Console shows "⏭️ [SYNC] Ignoring self-broadcast (clientId match)"
- ✅ NO repeating "📝 Settings updated: staff_groups table" loop
- ✅ Group name updates smoothly without lag

**Failure Signs**:
- ❌ Console floods with "📨 SETTINGS_SYNC_RESPONSE received"
- ❌ UI becomes laggy or unresponsive
- ❌ Browser tab freezes or crashes

### Test 2: UI Stability (No Jumping)
**Objective**: Verify groups don't reorder during editing

**Steps**:
1. Create 4 groups: "Group A", "Group B", "Group C", "Group D"
2. Note their visual order (left to right, top to bottom)
3. Click Edit on "Group B"
4. Change name to "ZZZZZ" (alphabetically last)
5. Type slowly and observe

**Expected Results**:
- ✅ Groups maintain same visual position during typing
- ✅ "Group B" stays in second position even with name "ZZZZZ"
- ✅ No visual "jumping" or reordering of cards
- ✅ Console shows stable `data-group-id` attributes

**Failure Signs**:
- ❌ Groups reorder alphabetically during typing
- ❌ Editing group moves to different position
- ❌ Cards "flash" or "jump" on screen

### Test 3: Deleted Groups Stay Deleted
**Objective**: Verify soft-deleted groups don't reappear

**Steps**:
1. Create a group called "Test Delete Group"
2. Note the total group count (e.g., 5 groups)
3. Click Delete on "Test Delete Group" → Confirm
4. Verify group is removed (count should be 4)
5. Edit another group's name
6. Wait for sync to complete
7. Check group count again

**Expected Results**:
- ✅ "Test Delete Group" remains deleted after edit
- ✅ Group count stays at 4 (doesn't jump back to 5)
- ✅ Console shows "🗑️ [SYNC] Filtered out X soft-deleted groups"
- ✅ No "ghost" groups appearing in UI

**Failure Signs**:
- ❌ Deleted group reappears after editing another group
- ❌ Group count increases unexpectedly
- ❌ UI shows duplicate groups

### Test 4: Debouncing Works Correctly
**Objective**: Verify 500ms debounce prevents rapid-fire updates

**Steps**:
1. Edit a group name
2. Type very quickly: "ABCDEFGHIJKLMNOP" (without pausing)
3. Stop typing
4. Watch console for next 1 second

**Expected Results**:
- ✅ Console shows multiple "✏️ [updateGroup] Called" (one per keystroke)
- ✅ Console shows multiple "✏️ [updateGroup] Clearing existing debounce timer"
- ✅ Console shows ONLY ONE "⏱️ [updateGroup] Debounce timer fired"
- ✅ ONLY ONE WebSocket message sent after typing stops
- ✅ Local state updates instantly (UI responsive)

**Failure Signs**:
- ❌ Multiple WebSocket messages sent during typing
- ❌ UI freezes during rapid typing
- ❌ Characters appear delayed in input field

### Test 5: Real-Time Sync to Other Clients
**Objective**: Verify other clients receive updates (multi-user scenario)

**Steps**:
1. Open TWO browser tabs/windows to http://localhost:3000
2. In Tab 1: Navigate to Settings → Staff Groups
3. In Tab 2: Navigate to Settings → Staff Groups
4. In Tab 1: Edit group "Group A" → change to "Modified Group A"
5. Wait 1 second
6. Check Tab 2

**Expected Results**:
- ✅ Tab 1: Shows "⏭️ [SYNC] Ignoring self-broadcast"
- ✅ Tab 2: Shows "🔄 [SYNC] Settings changed, syncing from server"
- ✅ Tab 2: Group name updates to "Modified Group A"
- ✅ Both tabs show identical group data
- ✅ No infinite loops in either tab

**Failure Signs**:
- ❌ Tab 2 doesn't update
- ❌ Both tabs show infinite loops
- ❌ Groups differ between tabs

### Test 6: Local Edits During Debounce
**Objective**: Verify local state maintains edits during debounce period

**Steps**:
1. Edit group name
2. Type "ABC" and immediately check displayed value
3. Type "DEF" and check again
4. Type "GHI" and check again
5. Stop typing

**Expected Results**:
- ✅ Input shows "ABC" immediately after typing
- ✅ Input shows "ABCDEF" immediately after typing
- ✅ Input shows "ABCDEFGHI" immediately after typing
- ✅ NO delay in character appearance
- ✅ Server receives final value "ABCDEFGHI" after 500ms

**Failure Signs**:
- ❌ Characters appear delayed (>50ms lag)
- ❌ Input value "jumps" or resets during typing
- ❌ Cursor position changes unexpectedly

## Console Log Pattern Analysis

### Healthy Edit Flow
```
✏️ [updateGroup] Called: {groupId: "...", updates: {name: "Test"}}
✏️ [updateGroup] Starting 500ms debounce timer...
⏱️ [updateGroup] Debounce timer fired - sending update to server
💫 [updateStaffGroups] START
🔄 Updating settings via WebSocket multi-table backend
📤 Phase 3 Settings: Sent staff groups update
📨 SETTINGS_SYNC_RESPONSE received
⏭️ [SYNC] Ignoring self-broadcast (clientId match)  ← KEY LINE
```

### Unhealthy Infinite Loop (What We Fixed)
```
📝 Settings updated: staff_groups table
📨 SETTINGS_SYNC_RESPONSE received
📥 Initial settings load from server              ← BAD: Processing own update
📊 Settings synced from multi-table backend
🔄 Syncing WebSocket multi-table settings to local state
📝 Settings updated: staff_groups table          ← LOOP STARTS
📨 SETTINGS_SYNC_RESPONSE received
[REPEATS FOREVER]
```

## Performance Benchmarks

### Before Fix
- Console messages during 1-second edit: **60+ messages**
- State updates during 1-second edit: **30+ updates**
- UI lag when typing: **100-500ms**
- Memory usage: **Growing unbounded (leak)**

### After Fix (Target)
- Console messages during 1-second edit: **<5 messages**
- State updates during 1-second edit: **1 update** (after debounce)
- UI lag when typing: **<10ms** (local state only)
- Memory usage: **Stable**

## Automated Test Script

```javascript
// Run in browser console
async function testSelfBroadcastFix() {
  console.clear();
  console.log('🧪 Testing self-broadcast fix...\n');

  // Test 1: Monitor console for 5 seconds during edit
  const startTime = Date.now();
  let syncResponseCount = 0;
  let selfBroadcastIgnoreCount = 0;

  const originalConsoleLog = console.log;
  console.log = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('SETTINGS_SYNC_RESPONSE received')) {
      syncResponseCount++;
    }
    if (msg.includes('Ignoring self-broadcast')) {
      selfBroadcastIgnoreCount++;
    }
    originalConsoleLog.apply(console, args);
  };

  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log = originalConsoleLog;

  const duration = Date.now() - startTime;

  console.log('\n📊 Test Results:');
  console.log(`  Duration: ${duration}ms`);
  console.log(`  SYNC_RESPONSE count: ${syncResponseCount}`);
  console.log(`  Self-broadcast ignores: ${selfBroadcastIgnoreCount}`);
  console.log(`  Expected: Self-broadcast ignores ≥ SYNC_RESPONSE count`);

  if (selfBroadcastIgnoreCount >= syncResponseCount && syncResponseCount < 10) {
    console.log('✅ PASS: Self-broadcast fix working correctly');
  } else {
    console.log('❌ FAIL: Infinite loop detected');
  }
}

// Run the test
testSelfBroadcastFix();
```

## Known Issues & Limitations

1. **Multiple Browser Windows**: If same user opens multiple tabs, each tab has different clientId, so they won't ignore each other's updates (this is expected behavior for multi-user sync)

2. **Network Latency**: In high-latency networks (>500ms), user might see brief flicker as server update arrives

3. **Concurrent Edits**: If two users edit same group simultaneously, last-write-wins (no conflict resolution yet)

## Rollback Plan

If fix causes issues:

1. Revert commit:
   ```bash
   git log --oneline | head -5  # Find commit hash
   git revert <commit-hash>
   ```

2. Emergency disable WebSocket settings:
   ```bash
   export REACT_APP_WEBSOCKET_SETTINGS=false
   npm start
   ```

3. Check Go server logs:
   ```bash
   # Go server logs should show broadcast pattern
   grep "SETTINGS_SYNC_RESPONSE" go-server/logs/*.log
   ```

## Success Criteria

All 6 test cases must PASS:
- ✅ Test 1: No infinite loop
- ✅ Test 2: UI stays stable (no jumping)
- ✅ Test 3: Deleted groups stay deleted
- ✅ Test 4: Debouncing works
- ✅ Test 5: Real-time sync to other clients
- ✅ Test 6: Local edits responsive

## Post-Test Validation

After all tests pass, verify:
1. No console errors
2. No memory leaks (check Chrome DevTools → Memory)
3. Network tab shows reasonable WebSocket message count
4. Application remains responsive after 5+ minutes of use
