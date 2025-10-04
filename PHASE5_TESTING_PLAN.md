# Phase 5: Integration Testing & Validation Plan
## Settings Backend Integration - Multi-Table Architecture

**Status**: 🚀 In Progress
**Days**: 8-9 of 10-Day Implementation
**Date**: October 3, 2025

---

## Testing Overview

### Objective
Comprehensively test the WebSocket multi-table backend integration for settings management, ensuring:
- ✅ All CRUD operations work correctly across 5 database tables
- ✅ Real-time synchronization via WebSocket
- ✅ Version control and audit trail functionality
- ✅ Data migration and rollback scenarios
- ✅ Cross-tab consistency and UI responsiveness
- ✅ Error handling and edge cases

---

## Test Environment

### Prerequisites
- ✅ Go WebSocket server running on `localhost:8080`
- ✅ React dev server running on `localhost:3001`
- ✅ Supabase database configured with 7 tables:
  1. `config_versions` - Version control
  2. `staff_groups` - Staff group configurations
  3. `daily_limits` - Daily shift limits
  4. `monthly_limits` - Monthly shift limits
  5. `priority_rules` - Priority scheduling rules
  6. `ml_model_configs` - ML algorithm parameters
  7. `config_changes` - Audit trail
- ✅ Environment variable: `REACT_APP_WEBSOCKET_SETTINGS=true`

### Test Data Status
- Current Version: 0 (Auto-generated Configuration)
- Staff Groups: 9 items
- Daily Limits: 3 items
- Monthly Limits: 2 items
- Priority Rules: 2 items
- ML Configs: 1 item

---

## Test Categories

### 1. Connection & Initialization Tests

#### 1.1 WebSocket Connection
- [ ] **Test**: WebSocket connects successfully on page load
- [ ] **Expected**: Console shows `📡 useSettingsData: WebSocket multi-table backend ACTIVE`
- [ ] **Expected**: Connection status: `✅ Connected` in UI
- [ ] **Expected**: Version info displayed: `Version 0 - Auto-generated Configuration`

#### 1.2 Initial Data Sync
- [ ] **Test**: Settings load from 5 database tables on connection
- [ ] **Expected**: Console shows `📊 Settings synced from multi-table backend`
- [ ] **Expected**: Correct item counts for all categories
- [ ] **Expected**: All tabs render without errors

#### 1.3 Reconnection Handling
- [ ] **Test**: Stop Go server, observe reconnection attempts
- [ ] **Expected**: Exponential backoff reconnection (1s, 2s, 4s)
- [ ] **Expected**: Falls back to localStorage after 3 failed attempts
- [ ] **Expected**: UI shows "Disconnected" status

---

### 2. CRUD Operations Tests

#### 2.1 Staff Groups Tab (staff_groups table)
- [ ] **Create**: Add new staff group with members
  - Expected: New group appears immediately via WebSocket broadcast
  - Expected: Database shows new row in `staff_groups` table
  - Expected: `groupConfig.members` stored as JSONB array

- [ ] **Read**: Load existing staff groups
  - Expected: All 9 groups display correctly
  - Expected: Members array extracted from `groupConfig.members`
  - Expected: No "Cannot read property" errors

- [ ] **Update**: Edit staff group (change name, add/remove members)
  - Expected: Changes sync immediately to all connected clients
  - Expected: Database row updated in `staff_groups`
  - Expected: Audit trail logged in `config_changes`

- [ ] **Delete**: Remove staff group
  - Expected: Group disappears from UI immediately
  - Expected: Database row deleted from `staff_groups`
  - Expected: Deletion logged in audit trail

#### 2.2 Daily Limits Tab (daily_limits table)
- [ ] **Create**: Add new daily limit rule
  - Expected: New limit appears with all properties
  - Expected: `limitConfig` JSONB field populated correctly
  - Expected: daysOfWeek, targetIds arrays saved

- [ ] **Update**: Modify daily limit (change days, max count)
  - Expected: Changes sync via WebSocket
  - Expected: `limitConfig` updated in database

- [ ] **Delete**: Remove daily limit
  - Expected: Limit removed from UI and database

#### 2.3 Priority Rules Tab (priority_rules table)
- [ ] **Create**: Add new priority rule
  - Expected: Rule created with all 13 properties
  - Expected: `ruleConfig` JSONB field populated
  - Expected: daysOfWeek, targetIds saved correctly

- [ ] **Update**: Modify priority rule (change days, rule type)
  - Expected: Real-time sync to connected clients
  - Expected: Conflict detection works

- [ ] **Delete**: Remove priority rule
  - Expected: Rule deleted from UI and database

#### 2.4 ML Parameters Tab (ml_model_configs table)
- [ ] **Update**: Modify ML parameters (weights, thresholds)
  - Expected: Parameters sync immediately
  - Expected: Only 1 ML config row per version (singleton pattern)

---

### 3. Version Control Tests

#### 3.1 Version Creation
- [ ] **Test**: Create new configuration version
- [ ] **Expected**: New row in `config_versions` table
- [ ] **Expected**: All current settings copied to new version
- [ ] **Expected**: Version becomes active automatically
- [ ] **Expected**: UI shows new version number

#### 3.2 Version Activation
- [ ] **Test**: Switch between versions
- [ ] **Expected**: Settings load from selected version
- [ ] **Expected**: All 5 tables filtered by `version_id`
- [ ] **Expected**: UI updates to show version info

#### 3.3 Version Locking
- [ ] **Test**: Lock a configuration version
- [ ] **Expected**: Locked indicator appears in UI (`🔒 Locked`)
- [ ] **Expected**: Cannot modify settings in locked version
- [ ] **Expected**: Server rejects update attempts

---

### 4. Audit Trail Tests

#### 4.1 Change Logging
- [ ] **Test**: Make any setting change
- [ ] **Expected**: New row in `config_changes` table
- [ ] **Expected**: Change includes: table_name, operation, data_before, data_after
- [ ] **Expected**: Timestamp and user_id recorded

#### 4.2 Change History
- [ ] **Test**: View audit trail (if UI implemented)
- [ ] **Expected**: All changes listed chronologically
- [ ] **Expected**: Can trace who changed what and when

---

### 5. Data Migration Tests

#### 5.1 Manual Migration (Via UI)
- [ ] **Test**: Click "Migrate to Multi-Table Backend" button
- [ ] **Expected**: localStorage settings read
- [ ] **Expected**: Settings mapped to 5 tables correctly
- [ ] **Expected**: Success message: `✅ Migration completed`
- [ ] **Expected**: Item counts match localStorage

#### 5.2 Data Format Conversion
- [ ] **Test**: Verify camelCase → snake_case conversion
- [ ] **Expected**: staffGroups → staff_groups (table)
- [ ] **Expected**: dailyLimits → daily_limits (table)
- [ ] **Expected**: mlParameters → ml_model_configs (table)

#### 5.3 Backward Compatibility
- [ ] **Test**: Disable WebSocket (`REACT_APP_WEBSOCKET_SETTINGS=false`)
- [ ] **Expected**: Falls back to localStorage mode
- [ ] **Expected**: UI shows "📱 Local Storage Mode"
- [ ] **Expected**: All tabs still work correctly

---

### 6. Real-Time Synchronization Tests

#### 6.1 Multi-Client Sync
- [ ] **Test**: Open app in 2 browser windows
- [ ] **Expected**: Changes in window 1 appear immediately in window 2
- [ ] **Expected**: WebSocket broadcast to all connected clients
- [ ] **Expected**: No race conditions or conflicts

#### 6.2 Broadcast Message Types
- [ ] **Test**: Monitor WebSocket messages for each operation
- [ ] **Expected**: `SETTINGS_UPDATE_STAFF_GROUPS` on staff group change
- [ ] **Expected**: `SETTINGS_UPDATE_DAILY_LIMITS` on daily limit change
- [ ] **Expected**: `SETTINGS_SYNC_RESPONSE` on initial load

---

### 7. Error Handling Tests

#### 7.1 Server Errors
- [ ] **Test**: Kill Go server while making changes
- [ ] **Expected**: Error message: `WebSocket not connected`
- [ ] **Expected**: Falls back to localStorage mode
- [ ] **Expected**: No data loss

#### 7.2 Invalid Data
- [ ] **Test**: Send malformed data to server (if possible)
- [ ] **Expected**: Server rejects with error message
- [ ] **Expected**: UI shows validation error
- [ ] **Expected**: Database remains consistent

#### 7.3 Network Issues
- [ ] **Test**: Simulate slow/unstable network
- [ ] **Expected**: Reconnection logic activates
- [ ] **Expected**: Exponential backoff works
- [ ] **Expected**: Eventually falls back to localStorage

---

### 8. UI/UX Tests

#### 8.1 Backend Status Indicator
- [ ] **Test**: Check SettingsModal header
- [ ] **Expected**: Shows "🟢 Real-time Multi-Table Sync" when connected
- [ ] **Expected**: Shows version number and name
- [ ] **Expected**: Shows "🔒 Locked" if version is locked

#### 8.2 Data Migration Tab
- [ ] **Test**: Navigate to Data Migration tab
- [ ] **Expected**: Shows multi-table mapping preview
- [ ] **Expected**: Shows correct item counts for each category
- [ ] **Expected**: Migration button enabled when connected

#### 8.3 Loading States
- [ ] **Test**: Observe loading indicators during operations
- [ ] **Expected**: Loading spinner appears during save
- [ ] **Expected**: "Auto-saving..." message when autosave active
- [ ] **Expected**: No UI freezes or unresponsive behavior

---

### 9. Performance Tests

#### 9.1 Load Time
- [ ] **Test**: Measure time to load all settings
- [ ] **Target**: < 500ms for initial sync
- [ ] **Measure**: Time from WebSocket connect to settings displayed

#### 9.2 Update Latency
- [ ] **Test**: Measure time for change to reflect in UI
- [ ] **Target**: < 100ms for WebSocket update
- [ ] **Measure**: Time from save click to UI update

#### 9.3 Large Dataset
- [ ] **Test**: Add many staff groups/rules (50+)
- [ ] **Expected**: No performance degradation
- [ ] **Expected**: Pagination or virtualization if needed

---

### 10. Data Consistency Tests

#### 10.1 Cross-Table References
- [ ] **Test**: Staff groups referenced in priority rules
- [ ] **Expected**: Foreign key constraints maintained
- [ ] **Expected**: Cascade delete if configured
- [ ] **Expected**: No orphaned references

#### 10.2 JSONB Field Integrity
- [ ] **Test**: Verify JSONB fields parse correctly
- [ ] **Expected**: `groupConfig.members` is valid JSON array
- [ ] **Expected**: `limitConfig` contains all required fields
- [ ] **Expected**: No nested object access errors

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Restart Go server to clear any cached data
- [ ] Clear browser localStorage
- [ ] Open browser DevTools (Console + Network tabs)
- [ ] Verify Supabase database is accessible
- [ ] Check environment variables

### During Testing
- [ ] Monitor console logs for errors/warnings
- [ ] Watch WebSocket messages in Network tab
- [ ] Verify database changes in Supabase dashboard
- [ ] Take screenshots of key states
- [ ] Document any unexpected behavior

### Post-Test Validation
- [ ] Review all console logs for errors
- [ ] Check database for data integrity
- [ ] Verify no memory leaks (Performance tab)
- [ ] Confirm all tests passed
- [ ] Document any issues found

---

## Success Criteria

### Must Pass (Blocking)
- ✅ All CRUD operations work without errors
- ✅ WebSocket connection stable
- ✅ Real-time sync functional
- ✅ Data migration works correctly
- ✅ Version control operational
- ✅ Audit trail captures all changes
- ✅ No "Cannot read property" errors
- ✅ Backward compatibility with localStorage

### Should Pass (Important)
- ✅ Performance targets met (< 500ms load, < 100ms update)
- ✅ Reconnection logic works
- ✅ Error messages are clear
- ✅ UI shows correct status indicators
- ✅ Multi-client sync works
- ✅ Large datasets handle gracefully

### Nice to Have
- ✅ Offline support with queue
- ✅ Conflict resolution UI
- ✅ Change history visualization
- ✅ Export/import functionality

---

## Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Go Server: Running ✅ / Failed ❌
- React App: Running ✅ / Failed ❌
- Database: Connected ✅ / Failed ❌

### Test Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Skipped: W

### Detailed Results

#### Category: Connection Tests
- ✅ WebSocket connection successful
- ✅ Initial data sync working
- ❌ Reconnection has 5s delay (expected 2s)

[Continue for all categories...]

### Issues Found
1. **Issue**: Reconnection delay too long
   - **Severity**: Medium
   - **Status**: Fixed / In Progress / Blocked
   - **Notes**: ...

### Recommendations
- [ ] Fix reconnection timing
- [ ] Add loading indicator for migration
- [ ] Improve error messages

### Next Steps
1. Fix blocking issues
2. Re-test failed scenarios
3. Document workarounds
```

---

## Test Automation (Future)

### Unit Tests (Jest + React Testing Library)
```javascript
// Test useWebSocketSettings hook
describe('useWebSocketSettings', () => {
  test('connects to WebSocket on mount', () => {});
  test('syncs settings from multi-table backend', () => {});
  test('handles connection errors gracefully', () => {});
});

// Test useSettingsData hook
describe('useSettingsData', () => {
  test('aggregates settings from 5 tables', () => {});
  test('falls back to localStorage when disconnected', () => {});
});
```

### Integration Tests (Jest + MSW)
```javascript
describe('Settings Multi-Table Integration', () => {
  test('CRUD operations update database', async () => {});
  test('version control creates new versions', async () => {});
  test('audit trail logs all changes', async () => {});
});
```

### E2E Tests (Chrome MCP)
```javascript
describe('Settings Backend E2E', () => {
  test('user can migrate settings to backend', async () => {});
  test('changes sync across browser tabs', async () => {});
  test('locked versions cannot be modified', async () => {});
});
```

---

## Rollback Plan

### If Critical Issues Found
1. **Disable WebSocket Backend**
   ```bash
   # Set environment variable
   REACT_APP_WEBSOCKET_SETTINGS=false

   # Rebuild and redeploy
   npm run build
   ```

2. **Export Data from Multi-Table Backend**
   ```sql
   -- Run in Supabase SQL editor
   SELECT json_build_object(
     'staffGroups', (SELECT json_agg(sg.*) FROM staff_groups),
     'dailyLimits', (SELECT json_agg(dl.*) FROM daily_limits),
     ...
   );
   ```

3. **Import to localStorage**
   ```javascript
   localStorage.setItem('shift-schedule-settings', JSON.stringify(exportedData));
   ```

---

## Phase 5 Deliverables

- [ ] Completed test execution for all categories
- [ ] Test results document with pass/fail status
- [ ] List of issues found with severity ratings
- [ ] Recommendations for Phase 6 (Production Deployment)
- [ ] Updated documentation with any changes
- [ ] Video walkthrough of testing process (optional)

---

## Timeline

**Day 8**: Core functionality testing (Categories 1-5)
**Day 9**: Advanced testing (Categories 6-10) + documentation
**Review**: Phase 5 completion review before Phase 6

---

**Created**: October 3, 2025
**Phase**: 5 of 6 (Integration Testing & Validation)
**Next Phase**: Phase 6 - Production Deployment (Day 10)
