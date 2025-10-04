# Settings Backend Integration - Test Suite

## Quick Start

### Run All Settings Tests
```bash
npm run test:settings
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:settings:unit

# Integration tests only
npm run test:settings:integration

# Component tests only
npm run test:settings:component

# E2E tests only (requires Chrome MCP)
npm run test:settings:e2e

# Generate coverage report
npm run test:settings:coverage
```

---

## Test Files Overview

### 1. Unit Tests - Hooks

#### `src/hooks/__tests__/useWebSocketSettings.test.js`
Tests WebSocket connection, message handling, and real-time sync.

**Key Test Cases:**
- ✅ Connects to ws://localhost:8080/staff-sync
- ✅ Sends SETTINGS_SYNC_REQUEST after connection
- ✅ Handles SETTINGS_SYNC_RESPONSE with multi-table data
- ✅ Implements exponential backoff reconnection
- ✅ Sends table-specific update messages
- ✅ Creates and activates config versions

**Run:** `npm test -- --testPathPattern=useWebSocketSettings.test.js --watchAll=false`

---

#### `src/hooks/__tests__/useSettingsData.test.js`
Tests backend mode detection, data aggregation, and CRUD routing.

**Key Test Cases:**
- ✅ Detects WebSocket vs localStorage mode
- ✅ Aggregates settings from 5 database tables
- ✅ Routes updates to correct WebSocket messages
- ✅ Migrates localStorage → multi-table backend
- ✅ Handles fallback scenarios

**Run:** `npm test -- --testPathPattern=useSettingsData.test.js --watchAll=false`

---

### 2. Integration Tests

#### `src/__tests__/integration/SettingsMultiTableIntegration.test.js`
Tests end-to-end multi-table backend workflows.

**Key Test Cases:**
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Version control (create, activate, lock)
- ✅ Audit trail logging
- ✅ Cross-table data consistency
- ✅ JSONB field extraction (groupConfig.members, limitConfig.daysOfWeek)
- ✅ Migration with data integrity preservation

**Run:** `npm run test:settings:integration`

---

### 3. Component Tests

#### `src/components/settings/tabs/__tests__/StaffGroupsTab.test.js`
Tests UI component with data transformation and user interactions.

**Key Test Cases:**
- ✅ Data transformation (WebSocket ↔ localStorage format)
- ✅ Defensive array checks (undefined/null handling)
- ✅ Backward compatibility (mixed formats)
- ✅ User interactions (create, edit, delete)
- ✅ Validation error display

**Run:** `npm run test:settings:component`

---

### 4. E2E Tests (Chrome MCP)

#### `tests/e2e/settings-backend-e2e.test.js`
Tests real user workflows with browser automation.

**Key Test Cases:**
- ✅ Open settings → make changes → verify sync
- ✅ Multi-client synchronization (2 browser windows)
- ✅ Migration workflow via UI
- ✅ Connection loss and reconnection handling
- ✅ Version locking enforcement
- ✅ Performance monitoring (sync latency <2000ms)

**Run:** `npm run test:settings:e2e`

**Note:** Requires Chrome MCP server to be running

---

## Test Coverage

### Target Metrics
- **Branches:** >80%
- **Functions:** >80%
- **Lines:** >80%
- **Statements:** >80%

### Files Under Test
| File | Type | Test Coverage |
|------|------|---------------|
| `useWebSocketSettings.js` | Hook | 26 test cases |
| `useSettingsData.js` | Hook | 24 test cases |
| `StaffGroupsTab.jsx` | Component | 21 test cases |
| Multi-table Integration | Backend | 20 test cases |
| E2E User Flows | Browser | 11 test cases |

**Total:** 102 test cases

---

## Testing Patterns

### 1. WebSocket Mocking
```javascript
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;

    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    }, 10);
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
  }
}

global.WebSocket = MockWebSocket;
```

### 2. Async Testing
```javascript
await waitFor(() => {
  expect(result.current.settings).toBeDefined();
}, { timeout: 3000 });
```

### 3. Component Testing
```javascript
render(
  <StaffGroupsTab
    settings={testSettings}
    onSettingsChange={mockHandler}
    staffMembers={mockStaff}
  />
);

await waitFor(() => {
  expect(screen.getByText('Kitchen Staff')).toBeInTheDocument();
});
```

### 4. Integration Testing
```javascript
// Simulate complete flow
await act(async () => {
  await result.current.updateStaffGroups(newGroup);
});

await waitFor(() => {
  expect(result.current.settings.staffGroups).toHaveLength(1);
});
```

---

## Common Test Scenarios

### Test WebSocket Connection
```javascript
test('connects to WebSocket on mount', async () => {
  const { result } = renderHook(() => useWebSocketSettings({ enabled: true }));

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });
});
```

### Test Data Transformation
```javascript
test('extracts members from groupConfig', async () => {
  const settings = {
    staffGroups: [
      {
        id: 'group-1',
        groupConfig: { members: ['staff-1', 'staff-2'] }
      }
    ]
  };

  // Component handles extraction
  render(<StaffGroupsTab settings={settings} />);

  expect(screen.getByText('Members (2)')).toBeInTheDocument();
});
```

### Test CRUD Operations
```javascript
test('creates staff group via WebSocket', async () => {
  const { result } = renderHook(() => useWebSocketSettings({ enabled: true }));

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });

  const newGroup = { id: 'group-1', name: 'Kitchen' };

  await act(async () => {
    await result.current.updateStaffGroups(newGroup);
  });

  // Verify message was sent
  expect(mockWebSocket.sentMessages).toContainEqual(
    expect.objectContaining({
      type: 'SETTINGS_UPDATE_STAFF_GROUPS',
      payload: { group: newGroup }
    })
  );
});
```

---

## Debugging Tests

### Enable Console Logs
```javascript
// In test file
console.log('Current settings:', result.current.settings);
```

### Run Single Test
```bash
npm test -- --testPathPattern=useWebSocketSettings.test.js --testNamePattern="connects to WebSocket" --watchAll=false
```

### Debug with Chrome DevTools
```bash
node --inspect-brk node_modules/.bin/jest --runInBand --testPathPattern=useWebSocketSettings.test.js
```

Then open `chrome://inspect` in Chrome.

### Check Coverage for Specific File
```bash
npm test -- --testPathPattern=useWebSocketSettings.test.js --coverage --collectCoverageFrom=src/hooks/useWebSocketSettings.js --watchAll=false
```

---

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Settings Tests
  run: npm run test:settings

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    flags: settings-backend
```

### Pre-commit Hook
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:settings:unit"
    }
  }
}
```

---

## Troubleshooting

### Issue: Tests timeout
**Solution:** Increase timeout in test
```javascript
jest.setTimeout(10000); // 10 seconds
```

### Issue: WebSocket mock not working
**Solution:** Verify global.WebSocket is set before import
```javascript
global.WebSocket = MockWebSocket;
// Then import component
```

### Issue: Async state not updating
**Solution:** Use waitFor with proper timeout
```javascript
await waitFor(() => {
  expect(result.current.settings).toBeDefined();
}, { timeout: 5000 });
```

### Issue: crypto is not defined
**Solution:** Already fixed in `src/setupTests.js`
```javascript
global.crypto = {
  randomUUID: () => '...',
  getRandomValues: (arr) => { /* ... */ }
};
```

---

## Adding New Tests

### 1. Create Test File
```bash
# Unit test
touch src/hooks/__tests__/useNewHook.test.js

# Component test
touch src/components/__tests__/NewComponent.test.js

# Integration test
touch src/__tests__/integration/NewIntegration.test.js
```

### 2. Use Testing Template
```javascript
import { renderHook, waitFor } from '@testing-library/react';
import { useNewHook } from '../useNewHook';

describe('useNewHook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does something', async () => {
    const { result } = renderHook(() => useNewHook());

    await waitFor(() => {
      expect(result.current.value).toBe(expected);
    });
  });
});
```

### 3. Run and Verify
```bash
npm test -- --testPathPattern=useNewHook.test.js --watchAll=false
```

---

## Best Practices

### ✅ DO
- Mock all external dependencies (WebSocket, Supabase, localStorage)
- Use `waitFor()` for async operations
- Test both happy paths and error scenarios
- Clean up in `afterEach()` hooks
- Use descriptive test names
- Isolate test data to individual tests

### ❌ DON'T
- Share state between tests
- Rely on test execution order
- Mock React internals
- Use `setTimeout()` for async waits (use `waitFor()` instead)
- Skip cleanup in afterEach
- Test implementation details

---

## Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Hooks Testing](https://react-hooks-testing-library.com/)
- [MSW (Mock Service Worker)](https://mswjs.io/)

---

## Support

For questions or issues with the test suite:
1. Check `/TEST_SUITE_SUMMARY.md` for detailed documentation
2. Review `/PHASE5_TESTING_PLAN.md` for architecture overview
3. See individual test files for implementation examples

---

**Last Updated:** 2025-01-03
**Test Suite Version:** 1.0.0
**Maintainer:** Development Team
