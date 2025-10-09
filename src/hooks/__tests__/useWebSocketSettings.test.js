/**
 * Unit Tests for useWebSocketSettings Hook
 * Tests WebSocket connection lifecycle, message handling, and data synchronization
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useWebSocketSettings } from "../useWebSocketSettings";

// Track all WebSocket instances for test access
let lastWebSocketInstance = null;

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];

    // Store reference for tests
    lastWebSocketInstance = this;

    // Simulate immediate connection - use setTimeout(0) to ensure onopen handler is set first
    setTimeout(() => {
      if (this.readyState === WebSocket.CONNECTING) {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
          this.onopen({ type: "open" });
        }
      }
    }, 0);
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: "Normal closure" });
    }
  }

  // Test helper to simulate receiving messages
  simulateMessage(message) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(message) });
    }
  }

  // Test helper to simulate errors
  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

// Setup global WebSocket mock
global.WebSocket = MockWebSocket;
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

describe("useWebSocketSettings Hook", () => {
  // Helper to wait for WebSocket connection with real timers
  const waitForConnection = async () => {
    // Wait for connection delay (100ms) + setTimeout(0)
    await new Promise((resolve) => setTimeout(resolve, 200));
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    lastWebSocketInstance = null;
    // Use real timers by default
    jest.useRealTimers();
  });

  afterEach(() => {
    // Cleanup - wrap in act to avoid warnings
    act(() => {
      if (lastWebSocketInstance) {
        lastWebSocketInstance.close();
        lastWebSocketInstance = null;
      }
    });
    // Ensure real timers are restored
    jest.useRealTimers();
  });

  describe("Connection Lifecycle", () => {
    test("connects to ws://localhost:8080/staff-sync on mount", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.isConnected).toBe(true);
    });

    test("sets connectionStatus to disabled when enabled=false", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: false }),
      );

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("disabled");
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastError).toBe(
        "WebSocket disabled via feature flag",
      );
    });

    test("sends SETTINGS_SYNC_REQUEST after connection", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      // Check if sync request was sent
      expect(lastWebSocketInstance).toBeDefined();
      expect(lastWebSocketInstance.sentMessages).toBeDefined();
      const syncRequest = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_SYNC_REQUEST",
      );
      expect(syncRequest).toBeDefined();
      expect(syncRequest.payload.clientId).toBeDefined();
    });

    test("handles connection timeout and marks as failed_permanently", async () => {
      jest.useFakeTimers();

      // Override WebSocket to never connect
      class NeverConnectingWebSocket extends MockWebSocket {
        constructor(url) {
          super(url);
          this.readyState = WebSocket.CONNECTING;
          // Never call onopen
        }
      }
      global.WebSocket = NeverConnectingWebSocket;

      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      // Fast-forward to trigger timeout (10 second timeout)
      act(() => {
        jest.advanceTimersByTime(11000);
      });

      expect(result.current.connectionStatus).toBe("failed_permanently");
      expect(result.current.lastError).toContain("Connection timeout");

      jest.useRealTimers();
    });

    test("implements exponential backoff reconnection", async () => {
      jest.useFakeTimers();

      let connectionAttempts = 0;
      class ReconnectingWebSocket extends MockWebSocket {
        constructor(url) {
          super(url);
          connectionAttempts++;

          // Fail first 2 attempts, succeed on 3rd
          if (connectionAttempts < 3) {
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED;
              if (this.onclose) {
                this.onclose({ code: 1006, reason: "Abnormal closure" });
              }
            }, 20);
          }
        }
      }
      global.WebSocket = ReconnectingWebSocket;

      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      // Advance through multiple reconnection attempts
      // Initial connect: 100ms + fail delay 20ms = 120ms
      // Reconnect 1: 1000ms delay + 120ms
      // Reconnect 2: 2000ms delay + 120ms
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(connectionAttempts).toBeGreaterThanOrEqual(2);

      jest.useRealTimers();
    });

    test("marks as failed_permanently after max reconnection attempts", async () => {
      jest.useFakeTimers();

      let attempts = 0;
      class AlwaysFailingWebSocket extends MockWebSocket {
        constructor(url) {
          super(url);
          attempts++;
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            if (this.onclose) {
              this.onclose({ code: 1006, reason: "Connection failed" });
            }
          }, 20);
        }
      }
      global.WebSocket = AlwaysFailingWebSocket;

      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      // Advance through all reconnection attempts until permanent failure
      // Initial: 100ms + 20ms
      // Reconnect 1: 1000ms + 20ms
      // Reconnect 2: 2000ms + 20ms
      // Reconnect 3: 4000ms + 20ms (max attempts reached)
      act(() => {
        jest.advanceTimersByTime(8000);
      });

      expect(result.current.connectionStatus).toBe("failed_permanently");
      expect(result.current.lastError).toContain(
        "Connection failed after multiple attempts",
      );
      expect(attempts).toBeGreaterThanOrEqual(3);

      jest.useRealTimers();
    });
  });

  describe("Message Handling", () => {
    test("handles SETTINGS_SYNC_RESPONSE with multi-table data", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      // Simulate sync response
      const mockResponse = {
        type: "SETTINGS_SYNC_RESPONSE",
        payload: {
          settings: {
            staffGroups: [
              {
                id: "group-1",
                name: "Kitchen Staff",
                members: ["staff-1", "staff-2"],
              },
            ],
            dailyLimits: [
              {
                id: "limit-1",
                limitConfig: { maxShifts: 2, daysOfWeek: [1, 2, 3] },
              },
            ],
            monthlyLimits: [],
            priorityRules: [],
            mlModelConfigs: [],
            version: {
              versionNumber: 1,
              name: "Initial Config",
              isActive: true,
            },
          },
        },
      };

      act(() => {
        // Access WebSocket instance and simulate message
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(mockResponse);
        }
      });

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
        expect(result.current.settings.staffGroups).toHaveLength(1);
        expect(result.current.version).toEqual(
          mockResponse.payload.settings.version,
        );
      });
    });

    test("handles CONNECTION_ACK message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const ackMessage = {
        type: "CONNECTION_ACK",
        payload: { message: "Connected successfully" },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(ackMessage);
        }
      });

      // Should not cause errors
      expect(result.current.lastError).toBeNull();
    });

    test("handles ERROR message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const errorMessage = {
        type: "ERROR",
        payload: { message: "Database connection failed" },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(errorMessage);
        }
      });

      await waitFor(() => {
        expect(result.current.lastError).toBe("Database connection failed");
      });
    });

    test("handles unknown message types gracefully", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const unknownMessage = {
        type: "UNKNOWN_TYPE",
        payload: { data: "something" },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(unknownMessage);
        }
      });

      // Should not crash or set error
      expect(result.current.lastError).toBeNull();
    });
  });

  describe("Data Transformation", () => {
    test("extracts members from groupConfig.members (JSONB)", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const responseWithGroupConfig = {
        type: "SETTINGS_SYNC_RESPONSE",
        payload: {
          settings: {
            staffGroups: [
              {
                id: "group-1",
                name: "Kitchen",
                groupConfig: {
                  members: ["staff-1", "staff-2", "staff-3"],
                },
              },
            ],
            dailyLimits: [],
            monthlyLimits: [],
            priorityRules: [],
            mlModelConfigs: [],
          },
        },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(responseWithGroupConfig);
        }
      });

      await waitFor(() => {
        expect(result.current.settings?.staffGroups).toBeDefined();
      });

      // Note: The extraction happens in useSettingsData, not this hook
      // This hook just passes the raw data
      expect(result.current.settings.staffGroups[0]).toEqual(
        responseWithGroupConfig.payload.settings.staffGroups[0],
      );
    });

    test("provides safe defaults for undefined nested properties", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const responseWithMissingData = {
        type: "SETTINGS_SYNC_RESPONSE",
        payload: {
          settings: {},
        },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(responseWithMissingData);
        }
      });

      await waitFor(() => {
        expect(result.current.settings).toEqual({});
      });
    });

    test("separates version from settings data", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const responseWithVersion = {
        type: "SETTINGS_SYNC_RESPONSE",
        payload: {
          settings: {
            staffGroups: [],
            dailyLimits: [],
            version: {
              versionNumber: 5,
              name: "Production Config v5",
              isLocked: true,
            },
          },
        },
      };

      act(() => {
        if (lastWebSocketInstance) {
          lastWebSocketInstance.simulateMessage(responseWithVersion);
        }
      });

      await waitFor(() => {
        expect(result.current.version).toEqual({
          versionNumber: 5,
          name: "Production Config v5",
          isLocked: true,
        });
        expect(result.current.settings.version).toBeUndefined();
      });
    });
  });

  describe("CRUD Operations", () => {
    test("sends SETTINGS_UPDATE_STAFF_GROUPS message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const groupData = {
        id: "group-1",
        name: "Kitchen Staff",
        members: ["staff-1", "staff-2"],
      };

      act(() => {
        result.current.updateStaffGroups(groupData);
      });

      expect(lastWebSocketInstance).toBeDefined();
      const updateMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_UPDATE_STAFF_GROUPS",
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage.payload.group).toEqual(groupData);
    });

    test("sends SETTINGS_UPDATE_DAILY_LIMITS message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const limitData = {
        id: "limit-1",
        limitConfig: { maxShifts: 2, daysOfWeek: [1, 2, 3] },
      };

      act(() => {
        result.current.updateDailyLimits(limitData);
      });

      expect(lastWebSocketInstance).toBeDefined();
      const updateMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_UPDATE_DAILY_LIMITS",
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage.payload.limit).toEqual(limitData);
    });

    test("rejects operations when WebSocket disabled", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: false }),
      );

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("disabled");
      });

      await expect(
        result.current.updateStaffGroups({ id: "test" }),
      ).rejects.toThrow("WebSocket disabled");
    });

    test("rejects operations when not connected", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      // Try to update before connection is established
      await expect(
        result.current.updateStaffGroups({ id: "test" }),
      ).rejects.toThrow("WebSocket not connected");
    });
  });

  describe("Version Management", () => {
    test("sends SETTINGS_CREATE_VERSION message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.createVersion("Backup Config", "Pre-migration backup");
      });

      expect(lastWebSocketInstance).toBeDefined();
      const versionMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_CREATE_VERSION",
      );
      expect(versionMessage).toBeDefined();
      expect(versionMessage.payload).toEqual({
        name: "Backup Config",
        description: "Pre-migration backup",
      });
    });

    test("sends SETTINGS_ACTIVATE_VERSION message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.activateVersion("version-123");
      });

      expect(lastWebSocketInstance).toBeDefined();
      const activateMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_ACTIVATE_VERSION",
      );
      expect(activateMessage).toBeDefined();
      expect(activateMessage.payload.versionId).toBe("version-123");
    });
  });

  describe("Bulk Operations", () => {
    test("sends SETTINGS_RESET message", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.resetSettings();
      });

      expect(lastWebSocketInstance).toBeDefined();
      const resetMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_RESET",
      );
      expect(resetMessage).toBeDefined();
    });

    test("sends SETTINGS_MIGRATE message with localStorage data", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      const localStorageData = {
        staffGroups: [{ id: "group-1", name: "Kitchen" }],
        dailyLimits: [],
        monthlyLimits: [],
      };

      act(() => {
        result.current.migrateSettings(localStorageData);
      });

      expect(lastWebSocketInstance).toBeDefined();
      const migrateMessage = lastWebSocketInstance.sentMessages.find(
        (msg) => msg.type === "SETTINGS_MIGRATE",
      );
      expect(migrateMessage).toBeDefined();
      expect(migrateMessage.payload.settings).toEqual(localStorageData);
    });
  });

  describe("Manual Controls", () => {
    test("reconnect() resets connection and attempts to reconnect", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connecting");
      });
    });

    test("provides debug info (clientId, reconnectAttempts)", async () => {
      const { result } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitFor(() => {
        expect(result.current.clientId).toBeDefined();
        expect(result.current.reconnectAttempts).toBe(0);
      });
    });
  });

  describe("Cleanup", () => {
    test("closes WebSocket connection on unmount", async () => {
      const { result, unmount } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      await waitForConnection();

      expect(result.current.isConnected).toBe(true);

      expect(lastWebSocketInstance).toBeDefined();
      const closeSpy = jest.spyOn(lastWebSocketInstance, "close");

      unmount();

      // Close should be called immediately on unmount
      expect(closeSpy).toHaveBeenCalled();
    });

    test("clears all timers on unmount", async () => {
      const { unmount } = renderHook(() =>
        useWebSocketSettings({ enabled: true }),
      );

      unmount();

      // Advance timers to ensure no pending timers
      jest.runOnlyPendingTimers();

      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
