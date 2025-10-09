# FIX: Infinite WebSocket Reconnection Loop

## Problem Summary
WebSocket connection was stuck in an infinite loop:
1. Connect → SETTINGS_SYNC_REQUEST → SETTINGS_SYNC_RESPONSE
2. Disconnect (code 1005: "no status received")
3. Immediately reconnect with new client ID
4. Loop repeats forever

## Root Cause Analysis

### Primary Issue: Unstable useCallback Dependencies
The `connect()` function was recreated on every render due to changing dependencies:

```javascript
// BEFORE (BROKEN):
const handleSettingsSyncResponse = useCallback(
  (payload, messageClientId) => {
    // ... uses settings state
    if (settings !== null) {
      // Compare with current settings
    }
  },
  [settings], // ⚠️ settings changes → callback recreated
);

const connect = useCallback(() => {
  // ... connection logic
}, [enabled, handleSettingsSyncResponse, handleError]);
// ⚠️ handleSettingsSyncResponse changes → connect recreated

useEffect(() => {
  const timeoutId = setTimeout(() => {
    connect();
  }, 100);

  return () => {
    // ⚠️ CLEANUP RUNS ON EVERY RENDER when [connect] changes
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close(); // ⚠️ This causes the 1005 disconnect!
    }
  };
}, [connect]); // ⚠️ connect changes → cleanup runs → closes WebSocket
```

### The Infinite Loop Chain

1. **Settings state changes** (line 147: `setSettings(actualSettings)`)
2. **handleSettingsSyncResponse callback recreated** (dependency: `[settings]`)
3. **connect callback recreated** (dependency: `handleSettingsSyncResponse`)
4. **useEffect dependency triggers** (dependency: `[connect]`)
5. **useEffect cleanup runs** (closes WebSocket with code 1005)
6. **onclose handler triggers reconnection** (line 342-394)
7. **New connection established** → triggers settings update → **LOOP REPEATS**

### Secondary Issues
- **Code 1005 ("no status received")**: Client was closing connection abnormally via cleanup function
- **Duplicate connection attempts**: No guard to prevent reconnection when already connected
- **Insufficient logging**: Hard to diagnose the reconnection trigger

## Solution Implemented

### 1. Stabilize useCallback Dependencies with Refs

**File**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useWebSocketSettings.js`

```javascript
// AFTER (FIXED):
// Line 90: Add ref to track settings without triggering re-renders
const settingsRef = useRef(null);

const handleSettingsSyncResponse = useCallback(
  (payload, messageClientId) => {
    // Use settingsRef.current instead of settings state
    if (settingsRef.current !== null) {
      const currentSettingsStr = JSON.stringify(settingsRef.current);
      const newSettingsStr = JSON.stringify(actualSettings);

      if (currentSettingsStr === newSettingsStr) {
        return; // Skip update - no changes
      }
    }

    // Update both ref and state
    settingsRef.current = actualSettings;
    setSettings(actualSettings);
  },
  [], // ✅ EMPTY dependency array - stable callback
);

const connect = useCallback(() => {
  // ... connection logic (dependencies now stable)
}, [enabled, handleSettingsSyncResponse, handleError]);
// ✅ handleSettingsSyncResponse never changes now
```

### 2. Remove useEffect Dependency on connect

```javascript
// BEFORE (BROKEN):
useEffect(() => {
  const timeoutId = setTimeout(() => {
    connect();
  }, 100);

  return () => {
    // ... cleanup closes WebSocket
  };
}, [connect]); // ⚠️ Dependency causes re-runs

// AFTER (FIXED):
useEffect(() => {
  console.log("🚀 [MOUNT] useWebSocketSettings mounted - initializing connection");

  const timeoutId = setTimeout(() => {
    connect();
  }, 100);

  // Cleanup ONLY runs on unmount
  return () => {
    console.log("🔌 [UNMOUNT] useWebSocketSettings unmounting - cleaning up connection");
    // ... cleanup logic
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ Empty deps - runs once on mount, cleanup on unmount only
```

### 3. Add Connection State Guards

```javascript
const connect = useCallback(() => {
  // ✅ Guard against duplicate connections
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    console.log("⏭️ [CONNECT] Already connected, skipping reconnection");
    return;
  }

  if (wsRef.current?.readyState === WebSocket.CONNECTING) {
    console.log("⏭️ [CONNECT] Connection in progress, skipping duplicate attempt");
    return;
  }

  // ... rest of connection logic
}, [enabled, handleSettingsSyncResponse, handleError]);
```

### 4. Enhanced Diagnostic Logging

```javascript
ws.onclose = (event) => {
  console.log(`🔌 [DISCONNECT] Phase 3 Settings: WebSocket disconnected`);
  console.log(`   - Close code: ${event.code}`);
  console.log(`   - Close reason: '${event.reason}'`);
  console.log(`   - Was clean: ${event.wasClean}`);
  console.log(`   - Current readyState: ${wsRef.current?.readyState}`);

  // Specific warning for code 1005
  if (event.code === 1005) {
    console.warn("⚠️ [DISCONNECT] Close code 1005 detected - connection closed abnormally");
    console.warn("   - This usually means the client closed the connection without sending a close frame");
    console.warn("   - Check for useEffect cleanup running prematurely");
  }

  // ... reconnection logic
};
```

## Testing Instructions

1. **Start the Go server**:
   ```bash
   cd go-server
   go run main.go
   ```

2. **Start the React app**:
   ```bash
   npm start
   ```

3. **Open browser console** and navigate to Settings page

4. **Expected behavior**:
   - ✅ Single log: `🚀 [MOUNT] useWebSocketSettings mounted - initializing connection`
   - ✅ Single log: `🔌 [CONNECT] Phase 3 Settings: Creating WebSocket connection to ws://localhost:8080/staff-sync`
   - ✅ Single log: `🔌 Phase 3 Settings: WebSocket connected to Go server`
   - ✅ Single log: `📥 [SYNC] Initial settings load from server`
   - ✅ Connection stays open (no disconnect/reconnect)
   - ✅ Settings load successfully
   - ✅ No infinite loop messages

5. **Verification checklist**:
   - [ ] WebSocket connects ONCE on page load
   - [ ] Connection stays open (no code 1005 disconnect)
   - [ ] Settings sync completes successfully
   - [ ] No reconnection loop in console
   - [ ] Browser console shows stable connection
   - [ ] Go server logs show single client connection (not multiple rapid connects)

## Success Criteria

### Before (Broken)
```
🔌 Phase 3 Settings: Creating WebSocket connection
Client connected (ID: abc123)
Received SETTINGS_SYNC_REQUEST
Sent SETTINGS_SYNC_RESPONSE
Read error: websocket: close 1005 (no status)
Client disconnected
🔌 Phase 3 Settings: Creating WebSocket connection
Client connected (ID: def456)  ← New ID, reconnected
Received SETTINGS_SYNC_REQUEST
Sent SETTINGS_SYNC_RESPONSE
Read error: websocket: close 1005 (no status)
Client disconnected
[INFINITE LOOP CONTINUES...]
```

### After (Fixed)
```
🚀 [MOUNT] useWebSocketSettings mounted - initializing connection
🔌 [CONNECT] Phase 3 Settings: Creating WebSocket connection
Client connected (ID: abc123)
🔌 Phase 3 Settings: WebSocket connected to Go server
Received SETTINGS_SYNC_REQUEST
Sent SETTINGS_SYNC_RESPONSE
📥 [SYNC] Initial settings load from server
📊 Settings synced from multi-table backend
[CONNECTION REMAINS STABLE - NO RECONNECTS]
```

## Technical Details

### WebSocket Close Code 1005
- **Meaning**: "No status received"
- **Cause**: Client closed the connection without sending a proper close frame
- **In this case**: useEffect cleanup was running on every render, closing the WebSocket prematurely

### React useEffect Dependency Best Practices
- **Empty array `[]`**: Effect runs once on mount, cleanup on unmount
- **With dependencies `[dep]`**: Effect runs on mount AND whenever `dep` changes, cleanup runs before each re-run
- **useCallback stability**: Callbacks should have stable dependencies or use refs to avoid triggering re-renders

### Refs vs State in React
- **State**: Triggers re-render when changed (use for UI updates)
- **Ref**: Persists across renders without triggering re-render (use for values that don't need UI updates)
- **In this fix**: `settingsRef` stores current settings for comparison without triggering callback recreation

## Files Modified

1. `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useWebSocketSettings.js`
   - Added `settingsRef` to prevent callback recreation
   - Stabilized `handleSettingsSyncResponse` dependency array (empty)
   - Removed `connect` from useEffect dependency array (empty)
   - Added connection state guards
   - Enhanced disconnect logging

## Related Issues

- Previous fix attempts: `BUGFIX_SELF_BROADCAST_LOOP.md` (focused on self-broadcast prevention)
- Related to: WebSocket connection lifecycle management
- Component: Settings management with multi-table backend

## Next Steps

1. Test the fix with user confirmation
2. Monitor browser console for stable connection
3. Verify Go server logs show single persistent client
4. If loop persists, add additional logging to identify trigger
5. Consider adding connection stability metrics to track uptime

## References

- WebSocket Close Codes: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
- React useEffect: https://react.dev/reference/react/useEffect
- React useCallback: https://react.dev/reference/react/useCallback
- React useRef: https://react.dev/reference/react/useRef
