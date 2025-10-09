/**
 * Unit Tests for useSettingsData Hook
 * Tests backend mode detection, data aggregation, and CRUD operations routing
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useSettingsData } from "../useSettingsData";
import * as useWebSocketSettingsModule from "../useWebSocketSettings";
import { configService } from "../../services/ConfigurationService";

// Mock configService
jest.mock("../../services/ConfigurationService", () => ({
  configService: {
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
    validateSettings: jest.fn(),
    resetToDefaults: jest.fn(),
    exportSettings: jest.fn(),
    importSettings: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

global.localStorage = localStorageMock;

describe("useSettingsData Hook", () => {
  let mockWebSocketSettings;
  const originalEnv = process.env.REACT_APP_WEBSOCKET_SETTINGS;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    // Default: WebSocket enabled but disconnected
    process.env.REACT_APP_WEBSOCKET_SETTINGS = "true";

    // Default WebSocket mock (disconnected state)
    mockWebSocketSettings = {
      settings: null,
      version: null,
      updateStaffGroups: jest.fn(),
      updateDailyLimits: jest.fn(),
      updateMonthlyLimits: jest.fn(),
      updatePriorityRules: jest.fn(),
      updateMLConfig: jest.fn(),
      resetSettings: jest.fn(),
      migrateSettings: jest.fn(),
      isConnected: false,
      connectionStatus: "disconnected",
      isLoading: false,
      lastError: null,
    };

    // Mock useWebSocketSettings
    jest
      .spyOn(useWebSocketSettingsModule, "useWebSocketSettings")
      .mockReturnValue(mockWebSocketSettings);

    // Default configService mocks
    configService.getSettings.mockReturnValue({
      staffGroups: [],
      dailyLimits: [],
      monthlyLimits: [],
      priorityRules: [],
      mlParameters: {},
    });
    configService.validateSettings.mockReturnValue({
      isValid: true,
      errors: {},
    });
    configService.saveSettings.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.REACT_APP_WEBSOCKET_SETTINGS = originalEnv;
  });

  describe("Backend Mode Detection", () => {
    test("uses localStorage mode when WebSocket disabled", async () => {
      // Disable WebSocket via environment variable
      process.env.REACT_APP_WEBSOCKET_SETTINGS = "false";

      // Re-mock the hook with updated environment
      jest.resetModules();
      const {
        useSettingsData: useSettingsDataWithDisabledWs,
      } = require("../useSettingsData");

      const { result } = renderHook(() => useSettingsDataWithDisabledWs());

      await waitFor(() => {
        expect(result.current.backendMode).toBe("localStorage");
        expect(result.current.isConnectedToBackend).toBe(false);
        expect(result.current.connectionStatus).toBe("localStorage");
      });
    });

    test("uses localStorage fallback when WebSocket disconnected", async () => {
      // WebSocket is disabled via connection status
      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.backendMode).toBe("localStorage");
        expect(configService.getSettings).toHaveBeenCalled();
      });
    });

    test("uses WebSocket mode when connected", async () => {
      // Mock connected WebSocket
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {
        staffGroups: [],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlModelConfigs: [],
      };
      mockWebSocketSettings.version = {
        versionNumber: 1,
        name: "Initial",
        isActive: true,
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.backendMode).toBe("websocket-multitable");
        expect(result.current.isConnectedToBackend).toBe(true);
      });
    });
  });

  describe("Data Aggregation from Multi-Table", () => {
    test("aggregates settings from 5 tables (WebSocket mode)", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {
        staffGroups: [
          {
            id: "group-1",
            name: "Kitchen",
            groupConfig: { members: ["staff-1"] },
          },
        ],
        dailyLimits: [
          {
            id: "limit-1",
            limitConfig: { maxShifts: 2, daysOfWeek: [1, 2, 3] },
          },
        ],
        monthlyLimits: [
          { id: "monthly-1", limitConfig: { maxMonthlyShifts: 20 } },
        ],
        priorityRules: [{ id: "rule-1", ruleConfig: { priority: "high" } }],
        mlModelConfigs: [
          { id: "ml-1", modelConfig: { algorithm: "random-forest" } },
        ],
      };
      mockWebSocketSettings.version = {
        versionNumber: 2,
        name: "Production Config",
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
        expect(result.current.settings.staffGroups).toHaveLength(1);
        expect(result.current.settings.dailyLimits).toHaveLength(1);
        expect(result.current.settings.monthlyLimits).toHaveLength(1);
        expect(result.current.settings.priorityRules).toHaveLength(1);
        expect(result.current.settings.mlParameters).toEqual(
          mockWebSocketSettings.settings.mlModelConfigs[0],
        );
        expect(result.current.version).toEqual(mockWebSocketSettings.version);
      });
    });

    test("handles empty multi-table response", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};
      mockWebSocketSettings.version = null;

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings.staffGroups).toEqual([]);
        expect(result.current.settings.dailyLimits).toEqual([]);
        expect(result.current.settings.mlParameters).toEqual({});
      });
    });
  });

  describe("CRUD Operations Routing", () => {
    test("routes staff group updates to WebSocket (WebSocket mode)", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {
        staffGroups: [{ id: "group-1", name: "Kitchen" }],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlModelConfigs: [],
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const newGroup = { id: "group-2", name: "Service" };

      act(() => {
        result.current.updateSettings({
          ...result.current.settings,
          staffGroups: [{ id: "group-1", name: "Kitchen" }, newGroup],
        });
      });

      await waitFor(() => {
        expect(mockWebSocketSettings.updateStaffGroups).toHaveBeenCalledWith(
          newGroup,
        );
      });
    });

    test("routes daily limits updates to WebSocket (WebSocket mode)", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {
        staffGroups: [],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlModelConfigs: [],
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const newLimit = { id: "limit-1", limitConfig: { maxShifts: 3 } };

      act(() => {
        result.current.updateSettings({
          ...result.current.settings,
          dailyLimits: [newLimit],
        });
      });

      await waitFor(() => {
        expect(mockWebSocketSettings.updateDailyLimits).toHaveBeenCalledWith(
          newLimit,
        );
      });
    });

    test("updates local state in localStorage mode", async () => {
      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const updatedSettings = {
        ...result.current.settings,
        staffGroups: [{ id: "group-1", name: "New Group" }],
      };

      act(() => {
        result.current.updateSettings(updatedSettings);
      });

      await waitFor(() => {
        expect(result.current.hasUnsavedChanges).toBe(true);
        expect(result.current.settings.staffGroups).toHaveLength(1);
      });
    });

    test("does not mark unsaved changes in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {
        staffGroups: [],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlModelConfigs: [],
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      act(() => {
        result.current.updateSettings({
          ...result.current.settings,
          staffGroups: [{ id: "group-1", name: "Test" }],
        });
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe("Migration Function", () => {
    test("migrateToBackend sends localStorage data to WebSocket", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};

      const localSettings = {
        staffGroups: [{ id: "group-1", name: "Kitchen" }],
        dailyLimits: [{ id: "limit-1", maxShifts: 2 }],
        monthlyLimits: [],
        priorityRules: [],
        mlParameters: { algorithm: "test" },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(localSettings));

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await act(async () => {
        await result.current.migrateToBackend();
      });

      expect(mockWebSocketSettings.migrateSettings).toHaveBeenCalledWith(
        localSettings,
      );
    });

    test("migrateToBackend throws error when not connected", async () => {
      mockWebSocketSettings.isConnected = false;

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await expect(result.current.migrateToBackend()).rejects.toThrow(
        "WebSocket not connected",
      );
    });

    test("migrateToBackend throws error when no localStorage data", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};

      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await expect(result.current.migrateToBackend()).rejects.toThrow(
        "No localStorage settings to migrate",
      );
    });
  });

  describe("Reset to Defaults", () => {
    test("uses WebSocket reset in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};
      mockWebSocketSettings.resetSettings.mockResolvedValue();

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await act(async () => {
        await result.current.resetToDefaults();
      });

      expect(mockWebSocketSettings.resetSettings).toHaveBeenCalled();
      expect(configService.resetToDefaults).not.toHaveBeenCalled();
    });

    test("uses configService reset in localStorage mode", async () => {
      const defaultSettings = {
        staffGroups: [],
        dailyLimits: [],
        monthlyLimits: [],
        priorityRules: [],
        mlParameters: {},
      };

      configService.resetToDefaults.mockResolvedValue();
      configService.getSettings.mockReturnValue(defaultSettings);

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      await act(async () => {
        await result.current.resetToDefaults();
      });

      expect(configService.resetToDefaults).toHaveBeenCalled();
      expect(mockWebSocketSettings.resetSettings).not.toHaveBeenCalled();
    });
  });

  describe("Import/Export", () => {
    test("triggers migration after import in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};

      const configJson = JSON.stringify({
        staffGroups: [{ id: "group-1", name: "Imported" }],
        dailyLimits: [],
      });

      configService.importSettings.mockReturnValue({ success: true });

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      act(() => {
        result.current.importConfiguration(configJson);
      });

      await waitFor(() => {
        expect(configService.importSettings).toHaveBeenCalledWith(configJson);
        expect(mockWebSocketSettings.migrateSettings).toHaveBeenCalledWith(
          JSON.parse(configJson),
        );
      });
    });

    test("reloads settings after import in localStorage mode", async () => {
      const configJson = JSON.stringify({
        staffGroups: [{ id: "group-1", name: "Imported" }],
        dailyLimits: [],
      });

      configService.importSettings.mockReturnValue({ success: true });
      configService.getSettings.mockReturnValue(JSON.parse(configJson));

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      act(() => {
        result.current.importConfiguration(configJson);
      });

      await waitFor(() => {
        expect(configService.importSettings).toHaveBeenCalledWith(configJson);
        expect(configService.getSettings).toHaveBeenCalled();
      });
    });

    test("exportConfiguration uses configService", async () => {
      const exportedData = { staffGroups: [], dailyLimits: [] };
      configService.exportSettings.mockReturnValue(
        JSON.stringify(exportedData),
      );

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const exported = result.current.exportConfiguration();

      expect(configService.exportSettings).toHaveBeenCalled();
      expect(exported).toBe(JSON.stringify(exportedData));
    });
  });

  describe("Autosave Behavior", () => {
    test("disables autosave in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};

      const { result } = renderHook(() => useSettingsData(true));

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      // Autosave should be disabled in WebSocket mode
      expect(result.current.isAutosaving).toBe(false);
    });

    test("enables autosave in localStorage mode", async () => {
      const { result } = renderHook(() => useSettingsData(true));

      await waitFor(() => {
        expect(result.current.isAutosaveEnabled).toBe(true);
      });
    });
  });

  describe("Version Info", () => {
    test("exposes version info in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.settings = {};
      mockWebSocketSettings.version = {
        versionNumber: 5,
        name: "Production v5",
        isLocked: true,
      };

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.currentVersion).toBe(5);
        expect(result.current.versionName).toBe("Production v5");
        expect(result.current.isVersionLocked).toBe(true);
      });
    });

    test("version info is null in localStorage mode", async () => {
      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.currentVersion).toBeUndefined();
        expect(result.current.versionName).toBeUndefined();
        expect(result.current.isVersionLocked).toBeUndefined();
      });
    });
  });

  describe("Loading and Error States", () => {
    test("uses WebSocket loading state in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.isLoading = true;
      mockWebSocketSettings.settings = {};

      const { result } = renderHook(() => useSettingsData());

      expect(result.current.isLoading).toBe(true);

      mockWebSocketSettings.isLoading = false;
      jest
        .spyOn(useWebSocketSettingsModule, "useWebSocketSettings")
        .mockReturnValue(mockWebSocketSettings);

      const { result: result2 } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });
    });

    test("uses WebSocket error in WebSocket mode", async () => {
      mockWebSocketSettings.isConnected = true;
      mockWebSocketSettings.connectionStatus = "connected";
      mockWebSocketSettings.lastError = "Database connection failed";
      mockWebSocketSettings.settings = {};

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.error).toBe("Database connection failed");
      });
    });
  });

  describe("Validation", () => {
    test("validateSettings delegates to configService", async () => {
      const settingsToValidate = {
        staffGroups: [{ id: "group-1", name: "Test" }],
        dailyLimits: [],
      };

      const validationResult = {
        isValid: false,
        errors: { staffGroups: "Invalid format" },
      };
      configService.validateSettings.mockReturnValue(validationResult);

      const { result } = renderHook(() => useSettingsData());

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const validation = result.current.validateSettings(settingsToValidate);

      expect(configService.validateSettings).toHaveBeenCalledWith(
        settingsToValidate,
      );
      expect(validation).toEqual(validationResult);
    });
  });
});
