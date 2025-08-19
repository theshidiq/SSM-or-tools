/**
 * Simple localStorage-based Configuration Service
 *
 * Manages application settings using localStorage for immediate functionality
 * without database dependencies.
 */

const STORAGE_KEY = "shift-schedule-settings";

export class ConfigurationService {
  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        // Migrate old data format to new format if needed
        return this.migrateSettings(settings);
      }
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
    }

    // Return default settings
    return this.getDefaultSettings();
  }

  /**
   * Migrate old settings format to new format
   */
  migrateSettings(settings) {
    let needsMigration = false;
    const migratedSettings = { ...settings };

    // Migrate dailyLimits from object to array format
    if (settings.dailyLimits && !Array.isArray(settings.dailyLimits)) {
      console.log("Migrating dailyLimits from object to array format");
      const oldLimits = settings.dailyLimits;
      migratedSettings.dailyLimits = [];

      // Convert old object format to new array format
      if (oldLimits.maxOffPerDay) {
        migratedSettings.dailyLimits.push({
          id: "daily-limit-off",
          name: "Maximum Off Days",
          shiftType: "off",
          maxCount: oldLimits.maxOffPerDay.value || 4,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: "all",
          targetIds: [],
          isHardConstraint: oldLimits.maxOffPerDay.isHard || true,
          penaltyWeight: oldLimits.maxOffPerDay.weight || 50,
          description: "Maximum number of staff that can be off per day",
        });
      }

      if (oldLimits.maxEarlyPerDay) {
        migratedSettings.dailyLimits.push({
          id: "daily-limit-early",
          name: "Maximum Early Shifts",
          shiftType: "early",
          maxCount: oldLimits.maxEarlyPerDay.value || 4,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: "all",
          targetIds: [],
          isHardConstraint: oldLimits.maxEarlyPerDay.isHard || false,
          penaltyWeight: oldLimits.maxEarlyPerDay.weight || 30,
          description: "Maximum number of staff on early shifts per day",
        });
      }

      if (oldLimits.maxLatePerDay) {
        migratedSettings.dailyLimits.push({
          id: "daily-limit-late",
          name: "Maximum Late Shifts",
          shiftType: "late",
          maxCount: oldLimits.maxLatePerDay.value || 3,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: "all",
          targetIds: [],
          isHardConstraint: oldLimits.maxLatePerDay.isHard || false,
          penaltyWeight: oldLimits.maxLatePerDay.weight || 30,
          description: "Maximum number of staff on late shifts per day",
        });
      }

      if (oldLimits.minWorkingStaffPerDay) {
        migratedSettings.dailyLimits.push({
          id: "daily-limit-min-working",
          name: "Minimum Working Staff",
          shiftType: "any",
          maxCount: oldLimits.minWorkingStaffPerDay.value || 3,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          scope: "all",
          targetIds: [],
          isHardConstraint: oldLimits.minWorkingStaffPerDay.isHard || true,
          penaltyWeight: oldLimits.minWorkingStaffPerDay.weight || 100,
          description: "Minimum number of staff required to work per day",
        });
      }

      needsMigration = true;
    }

    // Migrate monthlyLimits from object to array format
    if (settings.monthlyLimits && !Array.isArray(settings.monthlyLimits)) {
      console.log("Migrating monthlyLimits from object to array format");
      const oldLimits = settings.monthlyLimits;
      migratedSettings.monthlyLimits = [];

      if (oldLimits.maxOffDaysPerMonth) {
        migratedSettings.monthlyLimits.push({
          id: "monthly-limit-off-days",
          name: "Maximum Off Days Per Month",
          limitType: "max_off_days",
          maxCount: oldLimits.maxOffDaysPerMonth.value || 8,
          scope: "individual",
          targetIds: [],
          distributionRules: {
            maxConsecutive: 2,
            preferWeekends: false,
          },
          isHardConstraint: oldLimits.maxOffDaysPerMonth.isHard || false,
          penaltyWeight: oldLimits.maxOffDaysPerMonth.weight || 40,
          description: "Maximum number of days off allowed per staff member per month",
        });
      }

      // Migration for minWorkDaysPerMonth removed - this option is no longer supported
      // as minimum work days can be calculated as (total days in month - max off days)

      needsMigration = true;
    }

    // If migration was needed, save the migrated settings
    if (needsMigration) {
      console.log("Settings migration completed, saving migrated data");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedSettings));
    }

    return migratedSettings;
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings) {
    try {
      this.settings = { ...this.settings, ...settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      console.log("Settings saved successfully");
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults() {
    this.settings = this.getDefaultSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    console.log("Settings reset to defaults");
  }

  /**
   * Export settings to JSON
   */
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.saveSettings(imported);
      return { success: true };
    } catch (error) {
      console.error("Failed to import settings:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default settings configuration
   */
  getDefaultSettings() {
    return {
      // Staff Groups
      staffGroups: [
        {
          id: "group1",
          name: "Group 1",
          members: ["料理長", "井関"],
          color: "#3B82F6",
        },
        {
          id: "group2",
          name: "Group 2",
          members: ["料理長", "古藤"],
          color: "#EF4444",
        },
        {
          id: "group3",
          name: "Group 3",
          members: ["井関", "小池"],
          color: "#10B981",
        },
        {
          id: "group4",
          name: "Group 4",
          members: ["田辺", "小池"],
          color: "#F59E0B",
        },
        {
          id: "group5",
          name: "Group 5",
          members: ["古藤", "岸"],
          color: "#8B5CF6",
        },
        {
          id: "group6",
          name: "Group 6",
          members: ["与儀", "カマル"],
          color: "#EC4899",
        },
        {
          id: "group7",
          name: "Group 7",
          members: ["カマル", "高野"],
          color: "#06B6D4",
        },
        {
          id: "group8",
          name: "Group 8",
          members: ["高野", "派遣スタッフ"],
          color: "#84CC16",
        },
      ],

      // Daily Limits
      dailyLimits: [
        {
          id: "daily-limit-off",
          name: "Maximum Off Days",
          shiftType: "off",
          maxCount: 4,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          scope: "all",
          targetIds: [],
          isHardConstraint: true,
          penaltyWeight: 50,
          description: "Maximum number of staff that can be off per day",
        },
        {
          id: "daily-limit-early",
          name: "Maximum Early Shifts",
          shiftType: "early",
          maxCount: 4,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          scope: "all",
          targetIds: [],
          isHardConstraint: false,
          penaltyWeight: 30,
          description: "Maximum number of staff on early shifts per day",
        },
        {
          id: "daily-limit-late",
          name: "Maximum Late Shifts",
          shiftType: "late",
          maxCount: 3,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          scope: "all",
          targetIds: [],
          isHardConstraint: false,
          penaltyWeight: 30,
          description: "Maximum number of staff on late shifts per day",
        },
        {
          id: "daily-limit-min-working",
          name: "Minimum Working Staff",
          shiftType: "any",
          maxCount: 3,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          scope: "all",
          targetIds: [],
          isHardConstraint: true,
          penaltyWeight: 100,
          description: "Minimum number of staff required to work per day",
        },
      ],

      // Priority Rules
      priorityRules: {
        料理長: {
          preferredShifts: [
            { day: "sunday", shift: "early", priority: "high", strength: 0.8 },
          ],
        },
        与儀: {
          preferredShifts: [
            { day: "sunday", shift: "off", priority: "high", strength: 0.9 },
          ],
        },
      },

      // ML Parameters
      mlParameters: {
        model_name: "genetic_algorithm",
        model_type: "genetic_algorithm",
        parameters: {
          populationSize: 100,
          generations: 300,
          mutationRate: 0.1,
          crossoverRate: 0.8,
          elitismRate: 0.1,
          convergenceThreshold: 0.001,
          maxRuntime: 300,
          enableAdaptiveMutation: true,
          parallelProcessing: true,
          targetAccuracy: 0.85,
        },
        confidence_threshold: 0.75,
      },

      // Constraint Weights
      constraintWeights: {
        shift_distribution: 25,
        off_day_distribution: 20,
        weekend_fairness: 15,
        shift_preferences: 20,
        day_off_preferences: 15,
        seniority_bonus: 10,
        minimum_coverage: 40,
        skill_requirements: 30,
        conflict_avoidance: 35,
        schedule_stability: 15,
        cost_efficiency: 20,
        pattern_consistency: 10,
      },

      // Monthly Limits
      monthlyLimits: [
        {
          id: "monthly-limit-off-days",
          name: "Maximum Off Days Per Month",
          limitType: "max_off_days",
          maxCount: 8,
          scope: "individual",
          targetIds: [],
          distributionRules: {
            maxConsecutive: 2,
            preferWeekends: false,
          },
          isHardConstraint: false,
          penaltyWeight: 40,
          description: "Maximum number of days off allowed per staff member per month",
        },
      ],

      // Backup Assignments
      backupAssignments: [
        // Example: { id: "backup-1", staffId: "中田", groupId: "group-2", createdAt: "2024-01-01T00:00:00.000Z" }
      ],
    };
  }

  /**
   * Get staff groups
   */
  getStaffGroups() {
    return this.settings.staffGroups || this.getDefaultSettings().staffGroups;
  }

  /**
   * Update staff groups
   */
  updateStaffGroups(staffGroups) {
    return this.saveSettings({ staffGroups });
  }

  /**
   * Get daily limits
   */
  getDailyLimits() {
    return this.settings.dailyLimits || this.getDefaultSettings().dailyLimits;
  }

  /**
   * Update daily limits
   */
  updateDailyLimits(dailyLimits) {
    return this.saveSettings({ dailyLimits });
  }

  /**
   * Get priority rules
   */
  getPriorityRules() {
    return (
      this.settings.priorityRules || this.getDefaultSettings().priorityRules
    );
  }

  /**
   * Update priority rules
   */
  updatePriorityRules(priorityRules) {
    return this.saveSettings({ priorityRules });
  }

  /**
   * Get ML parameters
   */
  getMLParameters() {
    return this.settings.mlParameters || this.getDefaultSettings().mlParameters;
  }

  /**
   * Update ML parameters
   */
  updateMLParameters(mlParameters) {
    return this.saveSettings({ mlParameters });
  }

  /**
   * Get constraint weights
   */
  getConstraintWeights() {
    return (
      this.settings.constraintWeights ||
      this.getDefaultSettings().constraintWeights
    );
  }

  /**
   * Update constraint weights
   */
  updateConstraintWeights(constraintWeights) {
    return this.saveSettings({ constraintWeights });
  }

  /**
   * Get monthly limits
   */
  getMonthlyLimits() {
    return (
      this.settings.monthlyLimits || this.getDefaultSettings().monthlyLimits
    );
  }

  /**
   * Update monthly limits
   */
  updateMonthlyLimits(monthlyLimits) {
    return this.saveSettings({ monthlyLimits });
  }

  /**
   * Get backup assignments
   */
  getBackupAssignments() {
    return (
      this.settings.backupAssignments ||
      this.getDefaultSettings().backupAssignments
    );
  }

  /**
   * Update backup assignments
   */
  updateBackupAssignments(backupAssignments) {
    return this.saveSettings({ backupAssignments });
  }

  /**
   * Validate settings structure
   */
  validateSettings(settings) {
    const errors = {};

    // Basic validation - can be expanded as needed
    if (settings.mlParameters) {
      const ml = settings.mlParameters;
      if (ml.parameters) {
        if (
          ml.parameters.populationSize < 10 ||
          ml.parameters.populationSize > 1000
        ) {
          errors.mlParameters = {
            populationSize: "Population size must be between 10 and 1000",
          };
        }
        if (
          ml.parameters.generations < 50 ||
          ml.parameters.generations > 2000
        ) {
          errors.mlParameters = {
            ...errors.mlParameters,
            generations: "Generations must be between 50 and 2000",
          };
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

// Create a singleton instance
export const configService = new ConfigurationService();

export default configService;
