# WebSocket Settings Tests Fix Summary

## Issues Fixed

### 1. **act() Deprecation Warning** ✅
**Problem**: Tests imported `act` from `@testing-library/react` which triggers deprecation warning
**Solution**: Changed import to `import { act } from 'react'`
**Files**:
- `useWebSocketSettings.test.js`
- `useSettingsData.test.js`

### 2. **WebSocket Mock Instance Tracking** ✅
**Problem**: Tests tried to access `global.WebSocket.mock?.instances?.[0]` but MockWebSocket class didn't set up Jest mock tracking
**Solution**: Created `lastWebSocketInstance` variable to track the most recent WebSocket instance
**Files**: `useWebSocketSettings.test.js`

### 3. **WebSocket Connection Timing** ⚠️ PARTIALLY FIXED
**Problem**: Mock WebSocket `onopen` event not triggering, tests expecting `isConnected: true` getting `false`
**Solution**:
- Changed from `queueMicrotask()` to `setTimeout(0)` for better compatibility
- Created `waitForConnection()` helper function
- Implemented fake timers for all tests to control timing

**Current Status**: Tests are hanging due to interaction between fake timers and `waitFor()` from @testing-library/react

### 4. **Backend Mode Detection** ⚠️ NEEDS WORK
**Problem**: Tests expecting "websocket-multitable" backend mode but getting "localStorage"
**Solution**: Added proper environment variable management in beforeEach/afterEach
**Current Status**: Still failing - WebSocket mock needs to be in connected state

## Test Results

### useWebSocketSettings.test.js
- **Status**: HANGING (timeout after 45s)
- **Root Cause**: Fake timers + waitFor() compatibility issue
- **Tests Affected**: All tests waiting for connection

### useSettingsData.test.js
- **Status**: 12 failed, 12 passed (50%)
- **Failures**:
  1. Backend mode tests - WebSocket not connected in mock
  2. CRUD operations - WebSocket not connected
  3. Version info tests - WebSocket mock not providing version data
  4. Loading/error state tests - Mock state not properly set

## Remaining Issues

### Issue A: Fake Timers + waitFor Incompatibility
**Problem**: `waitFor()` doesn't advance fake timers automatically, causing infinite wait
**Potential Solutions**:
1. Use `waitFor()` with manual timer advancement in each test
2. Switch to manual polling instead of `waitFor()`
3. Use real timers for most tests, fake timers only for timeout tests

### Issue B: WebSocket Mock State Management
**Problem**: Mock defaults to disconnected state; tests expecting connected state need explicit setup
**Solution Needed**:
```javascript
beforeEach(() => {
  mockWebSocketSettings.isConnected = true;
  mockWebSocketSettings.connectionStatus = 'connected';
  mockWebSocketSettings.settings = { /* valid data */ };
});
```

### Issue C: Environment Variable Module Caching
**Problem**: `process.env.REACT_APP_WEBSOCKET_SETTINGS` is read at module load time
**Solution Needed**: Use `jest.resetModules()` when changing env vars (partially implemented)

## Recommended Next Steps

1. **Fix Timer Strategy**:
   - Remove fake timers from beforeEach
   - Only use fake timers in specific timeout/reconnection tests
   - Use real timers for connection tests

2. **Simplify waitForConnection Helper**:
   ```javascript
   const waitForConnection = async () => {
     await new Promise(resolve => setTimeout(resolve, 150));
   };
   ```

3. **Fix Mock State** in useSettingsData tests:
   - Set connected state by default
   - Provide valid settings/version data

4. **Run Tests Incrementally**:
   - Fix connection lifecycle tests first
   - Then message handling tests
   - Finally CRUD and version tests

## Files Modified

1. `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/__tests__/useWebSocketSettings.test.js`
   - Fixed act() import
   - Added lastWebSocketInstance tracking
   - Converted all WebSocket instance access
   - Added waitForConnection() helper
   - Implemented fake timers (causing current hang)

2. `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/__tests__/useSettingsData.test.js`
   - Fixed act() import
   - Added environment variable management
   - Fixed module caching for env var test
