/**
 * useAISettings.test.js
 *
 * Test suite for AI Settings Integration Layer
 * Verifies transformation logic and real-time update handling
 */

import { renderHook } from "@testing-library/react";
import { useAISettings } from "../useAISettings";
import { useSettingsData } from "../useSettingsData";

// Mock useSettingsData hook
jest.mock("../useSettingsData");

describe("useAISettings", () => {
  // Mock settings data
  const mockSettings = {
    staffGroups: [
      {
        id: "group1",
        name: "Group 1",
        members: ["Staff A", "Staff B"],
        description: "Test group",
        color: "#FF0000",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
      {
        id: "group2",
        name: "Group 2",
        members: ["Staff C"],
        is_active: false, // Soft-deleted group
        color: "#00FF00",
      },
    ],
    dailyLimits: [
      {
        id: "daily1",
        name: "Max Off Days",
        shiftType: "off",
        maxCount: 4,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        scope: "all",
        targetIds: [],
        isHardConstraint: true,
        penaltyWeight: 100,
        description: "Maximum off days",
      },
    ],
    monthlyLimits: [
      {
        id: "monthly1",
        name: "Max Off Days Per Month",
        limitType: "max_off_days",
        maxCount: 8,
        scope: "individual",
        distributionRules: {
          maxConsecutive: 2,
          preferWeekends: true,
        },
        isHardConstraint: false,
        penaltyWeight: 40,
      },
    ],
    priorityRules: [
      {
        id: "priority1",
        name: "Staff A Preference",
        ruleType: "preferred_shift",
        staffId: "staff-a",
        shiftType: "early",
        daysOfWeek: [1, 2, 3],
        priorityLevel: 4,
        preferenceStrength: 0.9,
        isHardConstraint: false,
        penaltyWeight: 50,
        isActive: true,
      },
      {
        id: "priority2",
        name: "Inactive Rule",
        ruleType: "preferred_shift",
        staffId: "staff-b",
        isActive: false, // Inactive rule
      },
    ],
    mlParameters: {
      model_name: "genetic_algorithm",
      parameters: {
        populationSize: 100,
        generations: 300,
        mutationRate: 0.1,
      },
      confidence_threshold: 0.75,
    },
  };

  const mockVersion = {
    versionNumber: 1,
    name: "Test Version",
  };

  beforeEach(() => {
    // Reset mock before each test
    useSettingsData.mockReset();
  });

  describe("Data Transformation", () => {
    test("should transform staff groups correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      // Should filter out soft-deleted groups
      expect(result.current.staffGroups).toHaveLength(1);
      expect(result.current.staffGroups[0]).toEqual({
        id: "group1",
        name: "Group 1",
        members: ["Staff A", "Staff B"],
        description: "Test group",
        metadata: {
          color: "#FF0000",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          isActive: true,
        },
      });
    });

    test("should transform daily limits correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.dailyLimits).toHaveLength(1);
      expect(result.current.dailyLimits[0]).toEqual({
        id: "daily1",
        name: "Max Off Days",
        shiftType: "off",
        maxCount: 4,
        constraints: {
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: "all",
          targetIds: [],
          isHardConstraint: true,
          penaltyWeight: 100,
        },
        description: "Maximum off days",
      });
    });

    test("should transform monthly limits correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.monthlyLimits).toHaveLength(1);
      expect(result.current.monthlyLimits[0]).toEqual({
        id: "monthly1",
        name: "Max Off Days Per Month",
        limitType: "max_off_days",
        maxCount: 8,
        scope: "individual",
        targetIds: [],
        distribution: {
          maxConsecutive: 2,
          preferWeekends: true,
        },
        constraints: {
          isHardConstraint: false,
          penaltyWeight: 40,
        },
        description: "",
      });
    });

    test("should transform priority rules and filter inactive", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      // Should include both active and inactive rules
      expect(result.current.priorityRules).toHaveLength(2);

      // But allConstraints.priority should only include active rules
      expect(result.current.allConstraints.priority).toHaveLength(1);
      expect(result.current.allConstraints.priority[0].id).toBe("priority1");
    });

    test("should transform ML config from localStorage format", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: false,
        backendMode: "localStorage",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.mlConfig).toEqual({
        modelName: "genetic_algorithm",
        modelType: "genetic_algorithm",
        parameters: {
          populationSize: 100,
          generations: 300,
          mutationRate: 0.1,
          crossoverRate: 0.8, // Default value
          elitismRate: 0.1, // Default value
          convergenceThreshold: 0.001, // Default value
          maxRuntime: 300, // Default value
          enableAdaptiveMutation: true, // Default value
          parallelProcessing: true, // Default value
          targetAccuracy: 0.85, // Default value
        },
        confidenceThreshold: 0.75,
      });
    });

    test("should transform ML config from database format", () => {
      const dbSettings = {
        ...mockSettings,
        mlModelConfigs: [
          {
            model_name: "simulated_annealing",
            model_type: "optimization",
            hyperparameters: {
              population_size: 200,
              generations: 500,
            },
            confidence_threshold: 0.8,
          },
        ],
      };

      useSettingsData.mockReturnValue({
        settings: dbSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.mlConfig.modelName).toBe("simulated_annealing");
      expect(result.current.mlConfig.parameters.populationSize).toBe(200);
      expect(result.current.mlConfig.confidenceThreshold).toBe(0.8);
    });
  });

  describe("Constraint Aggregation", () => {
    test("should aggregate all constraints correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.allConstraints).toEqual({
        daily: expect.arrayContaining([
          expect.objectContaining({ id: "daily1" }),
        ]),
        monthly: expect.arrayContaining([
          expect.objectContaining({ id: "monthly1" }),
        ]),
        priority: expect.arrayContaining([
          expect.objectContaining({ id: "priority1" }),
        ]),
      });
    });

    test("should extract constraint weights correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      // Hard constraints
      expect(result.current.constraintWeights.hardConstraints).toEqual([
        {
          id: "daily1",
          type: "daily",
          weight: 100,
          isHard: true,
        },
      ]);

      // Soft constraints
      expect(result.current.constraintWeights.softConstraints).toHaveLength(2);
      expect(result.current.constraintWeights.softConstraints).toEqual(
        expect.arrayContaining([
          { id: "monthly1", type: "monthly", weight: 40, isHard: false },
          { id: "priority1", type: "priority", weight: 50, isHard: false },
        ])
      );
    });
  });

  describe("Validation", () => {
    test("should validate settings successfully", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());
      const validation = result.current.validateSettings();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    test("should warn when no staff groups configured", () => {
      const emptySettings = {
        ...mockSettings,
        staffGroups: [],
      };

      useSettingsData.mockReturnValue({
        settings: emptySettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());
      const validation = result.current.validateSettings();

      expect(validation.warnings).toContain("No staff groups configured");
    });

    test("should warn when no constraints configured", () => {
      const noConstraintSettings = {
        ...mockSettings,
        dailyLimits: [],
        monthlyLimits: [],
      };

      useSettingsData.mockReturnValue({
        settings: noConstraintSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());
      const validation = result.current.validateSettings();

      expect(validation.warnings).toContain(
        "No constraints configured - AI may generate unrealistic schedules"
      );
    });
  });

  describe("Loading and Error States", () => {
    test("should handle loading state", () => {
      useSettingsData.mockReturnValue({
        settings: null,
        version: null,
        isLoading: true,
        error: null,
        isConnectedToBackend: false,
        backendMode: "loading",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.staffGroups).toEqual([]);
      expect(result.current.hasSettings).toBe(false);
    });

    test("should handle error state", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: "Connection failed",
        isConnectedToBackend: false,
        backendMode: "localStorage",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.error).toBe("Connection failed");
      expect(result.current.isConnected).toBe(true); // localStorage fallback
    });
  });

  describe("Settings Summary", () => {
    test("should generate settings summary correctly", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());
      const summary = result.current.getSettingsSummary();

      expect(summary).toEqual({
        version: 1,
        versionName: "Test Version",
        backendMode: "websocket-multitable",
        totalGroups: 1, // Only active groups
        totalDailyLimits: 1,
        totalMonthlyLimits: 1,
        totalPriorityRules: 1, // Only active rules
        mlModel: "genetic_algorithm",
        hardConstraints: 1,
        softConstraints: 2,
      });
    });
  });

  describe("Backward Compatibility", () => {
    test("should provide raw settings for legacy code", () => {
      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.rawSettings).toEqual(mockSettings);
    });

    test("should expose updateSettings function", () => {
      const mockUpdateSettings = jest.fn();

      useSettingsData.mockReturnValue({
        settings: mockSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: mockUpdateSettings,
      });

      const { result } = renderHook(() => useAISettings());

      expect(result.current.updateSettings).toBe(mockUpdateSettings);
    });
  });

  describe("Database Format Compatibility", () => {
    test("should handle snake_case database fields", () => {
      const dbFormatSettings = {
        staffGroups: [
          {
            id: "group1",
            name: "Group 1",
            members: ["Staff A"],
            is_active: true,
            created_at: "2024-01-01",
          },
        ],
        dailyLimits: [
          {
            id: "daily1",
            name: "Limit",
            shift_type: "early",
            max_count: 5,
            days_of_week: [1, 2, 3],
            is_hard_constraint: false,
            penalty_weight: 30,
          },
        ],
        priorityRules: [
          {
            id: "rule1",
            name: "Rule",
            rule_type: "required_off",
            staff_id: "staff-a",
            shift_type: "off",
            days_of_week: [0, 6],
            priority_level: 5,
            preference_strength: 1.0,
            is_hard_constraint: true,
            penalty_weight: 100,
            effective_from: "2024-01-01",
            effective_until: "2024-12-31",
            is_active: true,
          },
        ],
      };

      useSettingsData.mockReturnValue({
        settings: dbFormatSettings,
        version: mockVersion,
        isLoading: false,
        error: null,
        isConnectedToBackend: true,
        backendMode: "websocket-multitable",
        updateSettings: jest.fn(),
      });

      const { result } = renderHook(() => useAISettings());

      // Verify transformation handles snake_case
      expect(result.current.dailyLimits[0].shiftType).toBe("early");
      expect(result.current.dailyLimits[0].maxCount).toBe(5);
      expect(result.current.priorityRules[0].ruleType).toBe("required_off");
      expect(result.current.priorityRules[0].staffId).toBe("staff-a");
    });
  });
});
