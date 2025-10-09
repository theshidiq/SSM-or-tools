// Test helpers and data-testid constants for StaffEditModal testing
// Ensures consistent test selectors across integration tests

export const TEST_IDS = {
  // Form elements
  STAFF_NAME: "staff-name",
  STAFF_POSITION: "staff-position",
  SAVE_BUTTON: "save-button",
  CANCEL_BUTTON: "cancel-button",
  DELETE_BUTTON: "delete-button",
  ADD_STAFF_BUTTON: "add-staff-button",

  // Staff list
  STAFF_LIST: "staff-list",
  STAFF_MANAGEMENT_BUTTON: "staff-management-button",

  // Status indicators
  LOADING_INDICATOR: "loading-indicator",
  SUCCESS_INDICATOR: "success-indicator",
  ERROR_INDICATOR: "error-indicator",

  // Form sections
  START_PERIOD_YEAR: "start-period-year",
  START_PERIOD_MONTH: "start-period-month",
  START_PERIOD_DAY: "start-period-day",
  END_PERIOD_YEAR: "end-period-year",
  END_PERIOD_MONTH: "end-period-month",
  END_PERIOD_DAY: "end-period-day",

  // Status radio buttons
  STATUS_EMPLOYEE: "status-employee",
  STATUS_DISPATCH: "status-dispatch",
  STATUS_PART: "status-part",
};

// Mock WebSocket factory for consistent testing
export const createMockWebSocket = (options = {}) => {
  const mockWs = {
    readyState: options.readyState || WebSocket.OPEN,
    url: options.url || "ws://localhost:8080/staff-sync",
    send: jest.fn(),
    close: jest.fn(),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };

  // Auto-implement message handling if provided
  if (options.messageHandler) {
    mockWs.send.mockImplementation((data) => {
      const message = JSON.parse(data);
      options.messageHandler(message, mockWs);
    });
  }

  return mockWs;
};

// Mock staff data for testing
export const MOCK_STAFF = {
  EXISTING: {
    id: "staff-1",
    name: "Test Staff Member",
    position: "Server",
    status: "社員",
    startPeriod: { year: 2024, month: 1, day: 1 },
    endPeriod: null,
    version: 1,
  },

  NEW: {
    name: "New Staff Member",
    position: "Chef",
    status: "社員",
    startPeriod: { year: 2024, month: 1, day: 15 },
    endPeriod: null,
  },

  UPDATED: {
    id: "staff-1",
    name: "Updated Staff Member",
    position: "Head Server",
    status: "社員",
    startPeriod: { year: 2024, month: 1, day: 1 },
    endPeriod: null,
    version: 2,
  },
};

// WebSocket message creators
export const createWSMessage = (type, payload, options = {}) => ({
  type,
  payload,
  timestamp: options.timestamp || new Date().toISOString(),
  clientId: options.clientId || "test-client-id",
  ...options,
});

// Common WebSocket messages for testing
export const WS_MESSAGES = {
  STAFF_UPDATE: (staffId, changes) =>
    createWSMessage("STAFF_UPDATE", {
      staffId,
      changes,
    }),

  STAFF_CREATE: (staffData) => createWSMessage("STAFF_CREATE", staffData),

  STAFF_DELETE: (staffId) => createWSMessage("STAFF_DELETE", { staffId }),

  SYNC_RESPONSE: (staffMembers, version = 1) =>
    createWSMessage("SYNC_RESPONSE", {
      staffMembers,
      version,
      period: 0,
    }),

  CONNECTION_ACK: () =>
    createWSMessage("CONNECTION_ACK", { status: "connected" }),

  ERROR: (message) =>
    createWSMessage("ERROR", {
      message,
      code: "TEST_ERROR",
    }),
};

// Performance measurement helper
export const measurePerformance = (operation) => {
  const start = performance.now();
  return {
    start,
    end: () => performance.now() - start,
    validate: (maxTime) => {
      const duration = performance.now() - start;
      return duration <= maxTime;
    },
  };
};

// Async testing utilities
export const waitForWSMessage = (mockWs, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("WebSocket message timeout"));
    }, timeout);

    const originalSend = mockWs.send;
    mockWs.send = jest.fn((data) => {
      clearTimeout(timeoutId);
      originalSend(data);
      resolve(JSON.parse(data));
    });
  });
};

// Race condition testing helper
export const simulateRaceCondition = (operations, delay = 10) => {
  return Promise.all(
    operations.map(
      (op, index) =>
        new Promise((resolve) => {
          setTimeout(() => {
            op();
            resolve(index);
          }, index * delay);
        }),
    ),
  );
};

export default {
  TEST_IDS,
  createMockWebSocket,
  MOCK_STAFF,
  WS_MESSAGES,
  createWSMessage,
  measurePerformance,
  waitForWSMessage,
  simulateRaceCondition,
};
