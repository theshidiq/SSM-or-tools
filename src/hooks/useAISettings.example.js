/**
 * useAISettings.example.js
 *
 * Example usage of useAISettings hook in AI components
 * Demonstrates how to migrate from ConfigurationService to real-time WebSocket settings
 */

import { useAISettings } from "./useAISettings";

/**
 * EXAMPLE 1: Basic AI Component Usage
 *
 * Before (ConfigurationService - localStorage only):
 * ---------------------------------------------------
 * import { ConfigurationService } from "../services/ConfigurationService";
 *
 * const configService = new ConfigurationService();
 * await configService.initialize();
 * const staffGroups = configService.getStaffGroups();
 * const dailyLimits = configService.getDailyLimits();
 *
 * After (useAISettings - WebSocket + real-time):
 * -----------------------------------------------
 */
export const ExampleAIComponent1 = () => {
  const {
    staffGroups,
    dailyLimits,
    monthlyLimits,
    priorityRules,
    mlConfig,
    isLoading,
    isConnected,
  } = useAISettings();

  // Handle loading state
  if (isLoading) {
    return <div>Loading AI settings...</div>;
  }

  // Handle disconnected state
  if (!isConnected) {
    return <div>Connecting to settings backend...</div>;
  }

  // Use settings in AI algorithm
  const generateSchedule = () => {
    console.log("AI Settings loaded:");
    console.log("- Staff Groups:", staffGroups.length);
    console.log("- Daily Limits:", dailyLimits.length);
    console.log("- ML Config:", mlConfig.modelName);

    // AI algorithm implementation...
  };

  return <button onClick={generateSchedule}>Generate Schedule</button>;
};

/**
 * EXAMPLE 2: Constraint Validation
 *
 * Using aggregated constraints for schedule validation
 */
export const ExampleConstraintValidator = () => {
  const { allConstraints, constraintWeights, validateSettings } = useAISettings();

  const validateSchedule = (schedule) => {
    // Validate AI settings first
    const settingsValidation = validateSettings();
    if (!settingsValidation.isValid) {
      console.error("Settings validation errors:", settingsValidation.errors);
      return false;
    }

    if (settingsValidation.warnings.length > 0) {
      console.warn("Settings validation warnings:", settingsValidation.warnings);
    }

    // Validate against daily constraints
    allConstraints.daily.forEach((limit) => {
      console.log(`Validating daily limit: ${limit.name}`);
      console.log(`  - Shift type: ${limit.shiftType}`);
      console.log(`  - Max count: ${limit.maxCount}`);
      console.log(`  - Hard constraint: ${limit.constraints.isHardConstraint}`);

      // Validation logic...
    });

    // Validate against monthly constraints
    allConstraints.monthly.forEach((limit) => {
      console.log(`Validating monthly limit: ${limit.name}`);
      console.log(`  - Limit type: ${limit.limitType}`);
      console.log(`  - Max count: ${limit.maxCount}`);

      // Validation logic...
    });

    // Check priority rules
    allConstraints.priority.forEach((rule) => {
      console.log(`Checking priority rule: ${rule.name}`);
      console.log(`  - Staff: ${rule.staffId}`);
      console.log(`  - Rule type: ${rule.ruleType}`);
      console.log(`  - Priority level: ${rule.preferences.priorityLevel}`);

      // Validation logic...
    });

    return true;
  };

  return { validateSchedule };
};

/**
 * EXAMPLE 3: ML Configuration Access
 *
 * Accessing ML model parameters for optimization algorithms
 */
export const ExampleMLOptimizer = () => {
  const { mlConfig } = useAISettings();

  const runGeneticAlgorithm = () => {
    const {
      populationSize,
      generations,
      mutationRate,
      crossoverRate,
      elitismRate,
    } = mlConfig.parameters;

    console.log("Running Genetic Algorithm with:");
    console.log(`- Population Size: ${populationSize}`);
    console.log(`- Generations: ${generations}`);
    console.log(`- Mutation Rate: ${mutationRate}`);
    console.log(`- Crossover Rate: ${crossoverRate}`);
    console.log(`- Elitism Rate: ${elitismRate}`);

    // Genetic algorithm implementation...
  };

  return { runGeneticAlgorithm };
};

/**
 * EXAMPLE 4: Constraint Weights for Optimization
 *
 * Using extracted constraint weights in optimization algorithms
 */
export const ExampleWeightedOptimizer = () => {
  const { constraintWeights } = useAISettings();

  const calculatePenalty = (schedule) => {
    let totalPenalty = 0;

    // Hard constraints (must be satisfied)
    constraintWeights.hardConstraints.forEach((constraint) => {
      const violated = checkConstraintViolation(schedule, constraint);
      if (violated) {
        totalPenalty += constraint.weight * 1000; // Heavy penalty
      }
    });

    // Soft constraints (preferably satisfied)
    constraintWeights.softConstraints.forEach((constraint) => {
      const violated = checkConstraintViolation(schedule, constraint);
      if (violated) {
        totalPenalty += constraint.weight; // Light penalty
      }
    });

    return totalPenalty;
  };

  const checkConstraintViolation = (schedule, constraint) => {
    // Constraint violation logic...
    return false;
  };

  return { calculatePenalty };
};

/**
 * EXAMPLE 5: Real-time Settings Updates
 *
 * Handling real-time settings changes in AI components
 */
export const ExampleRealTimeAI = () => {
  const {
    staffGroups,
    dailyLimits,
    version,
    getSettingsSummary,
  } = useAISettings();

  // Settings automatically update when changed via WebSocket
  // No need for manual refresh or polling!

  useEffect(() => {
    console.log("Settings updated in real-time!");
    console.log("Summary:", getSettingsSummary());

    // Re-run AI algorithms with new settings
    regenerateSchedule();
  }, [staffGroups, dailyLimits, version]);

  const regenerateSchedule = () => {
    // AI algorithm implementation...
  };

  return null;
};

/**
 * EXAMPLE 6: Backward Compatibility
 *
 * Accessing raw settings for legacy code
 */
export const ExampleLegacyCode = () => {
  const { rawSettings, backendMode } = useAISettings();

  // Access original settings format for backward compatibility
  const legacyFunction = () => {
    console.log("Backend mode:", backendMode);
    console.log("Raw settings:", rawSettings);

    // Legacy code that expects original format...
  };

  return { legacyFunction };
};

/**
 * EXAMPLE 7: Settings Summary for Logging
 *
 * Getting settings summary for debug logging and analytics
 */
export const ExampleLogging = () => {
  const { getSettingsSummary } = useAISettings();

  const logAIOperation = (operation, result) => {
    const summary = getSettingsSummary();

    console.log(`AI Operation: ${operation}`);
    console.log(`Settings Version: ${summary.version} (${summary.versionName})`);
    console.log(`Backend Mode: ${summary.backendMode}`);
    console.log(`Configuration Summary:
      - Staff Groups: ${summary.totalGroups}
      - Daily Limits: ${summary.totalDailyLimits}
      - Monthly Limits: ${summary.totalMonthlyLimits}
      - Priority Rules: ${summary.totalPriorityRules}
      - ML Model: ${summary.mlModel}
      - Hard Constraints: ${summary.hardConstraints}
      - Soft Constraints: ${summary.softConstraints}
    `);
    console.log(`Result: ${result}`);
  };

  return { logAIOperation };
};

/**
 * EXAMPLE 8: Staff Group Access
 *
 * Working with transformed staff groups
 */
export const ExampleStaffGroups = () => {
  const { staffGroups } = useAISettings();

  const analyzeStaffGroups = () => {
    staffGroups.forEach((group) => {
      console.log(`Group: ${group.name}`);
      console.log(`  - ID: ${group.id}`);
      console.log(`  - Members: ${group.members.join(", ")}`);
      console.log(`  - Description: ${group.description}`);
      console.log(`  - Color: ${group.metadata.color}`);
      console.log(`  - Active: ${group.metadata.isActive}`);
      console.log(`  - Created: ${group.metadata.createdAt}`);

      // Group analysis logic...
    });
  };

  return { analyzeStaffGroups };
};

/**
 * MIGRATION GUIDE: ConfigurationService → useAISettings
 * ======================================================
 *
 * OLD CODE (ConfigurationService):
 * --------------------------------
 * import { ConfigurationService } from "../services/ConfigurationService";
 *
 * const configService = new ConfigurationService();
 * await configService.initialize();
 *
 * const staffGroups = configService.getStaffGroups();
 * const dailyLimits = configService.getDailyLimits();
 * const mlParameters = configService.getMLParameters();
 *
 * NEW CODE (useAISettings):
 * -------------------------
 * import { useAISettings } from "../hooks/useAISettings";
 *
 * const MyAIComponent = () => {
 *   const {
 *     staffGroups,
 *     dailyLimits,
 *     mlConfig, // Note: mlParameters → mlConfig
 *     isLoading,
 *     isConnected,
 *   } = useAISettings();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!isConnected) return <div>Connecting...</div>;
 *
 *   // Use settings...
 * };
 *
 * KEY DIFFERENCES:
 * ----------------
 * 1. Real-time updates: Settings update automatically via WebSocket
 * 2. No initialization: Hook handles connection and state management
 * 3. Transformed data: AI-friendly format with metadata separation
 * 4. React integration: Works seamlessly with React component lifecycle
 * 5. Error handling: Built-in error and loading states
 * 6. Type safety: Consistent data structure across all modes
 *
 * BENEFITS:
 * ---------
 * ✅ Real-time synchronization across all clients
 * ✅ Automatic reconnection and error recovery
 * ✅ No manual refresh or polling needed
 * ✅ Consistent API regardless of backend mode
 * ✅ Better performance with React optimization
 * ✅ Graceful degradation to localStorage fallback
 */
