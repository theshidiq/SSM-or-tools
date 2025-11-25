/**
 * Hybrid Configuration Service
 *
 * Manages application settings using localStorage as primary storage with
 * optional Supabase sync for cloud persistence and collaboration.
 */

import { supabase } from "../utils/supabase.js";

const STORAGE_KEY = "shift-schedule-settings";

export class ConfigurationService {
  constructor() {
    // Initialize with minimal defaults to prevent blocking
    this.settings = null;
    this.restaurantId = null;
    this.currentVersionId = null;
    this.isSupabaseEnabled = false;
    this.syncInProgress = false;
    this.supabaseInitialized = false;
    this.isInitialized = false;
    this.initPromise = null;

    // All heavy operations moved to lazy initialization
  }

  /**
   * Initialize the configuration service asynchronously (lazy loading)
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    if (this.isInitialized) return;

    console.log("🚀 Initializing Configuration Service (lazy)...");
    const startTime = Date.now();

    try {
      // Load settings asynchronously
      this.settings = await this._loadSettingsAsync();

      // Check Supabase availability in background (non-blocking)
      setTimeout(() => {
        this.checkSupabaseConnection().catch(console.warn);
      }, 100);

      this.isInitialized = true;
      console.log(
        `✅ Configuration Service initialized in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      console.error("❌ Configuration Service initialization failed:", error);
      // Fallback to defaults
      this.settings = this.getDefaultSettings();
      this.isInitialized = true;
    }
  }

  /**
   * Load settings from localStorage (async version)
   */
  async _loadSettingsAsync() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.loadSettings());
      }, 0);
    });
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

    // Current migration version - increment this when adding new migrations
    const CURRENT_MIGRATION_VERSION = 4;
    const currentVersion = settings.migrationVersion || 0;

    // Migrate weeklyLimits from object to array format
    if (settings.weeklyLimits && !Array.isArray(settings.weeklyLimits)) {
      console.log("Migrating weeklyLimits from object to array format");
      const oldLimits = settings.weeklyLimits;
      migratedSettings.weeklyLimits = [];

      // Convert old object format to new array format
      if (oldLimits.maxOffPerDay) {
        migratedSettings.weeklyLimits.push({
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
        migratedSettings.weeklyLimits.push({
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
        migratedSettings.weeklyLimits.push({
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
        migratedSettings.weeklyLimits.push({
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
          description:
            "Maximum number of days off allowed per staff member per month",
        });
      }

      // Migration for minWorkDaysPerMonth removed - this option is no longer supported
      // as minimum work days can be calculated as (total days in month - max off days)

      needsMigration = true;
    }

    // Migration v2: Clean up existing array-format monthlyLimits to remove deprecated "min_work_days" entries
    if (
      currentVersion < 2 &&
      settings.monthlyLimits &&
      Array.isArray(settings.monthlyLimits)
    ) {
      console.log(
        "Running migration v2: Removing deprecated minimum work days limits",
      );
      const originalLength = settings.monthlyLimits.length;
      migratedSettings.monthlyLimits = settings.monthlyLimits.filter(
        (limit) => {
          // Remove any limits with limitType "min_work_days" or containing "Minimum Work Days"
          const isMinWorkDaysLimit =
            limit.limitType === "min_work_days" ||
            (limit.name && limit.name.includes("Minimum Work Days")) ||
            (limit.id && limit.id.includes("min-work-days"));

          if (isMinWorkDaysLimit) {
            console.log(
              `Removing deprecated monthly limit: ${limit.name || limit.id}`,
            );
            return false;
          }
          return true;
        },
      );

      // Mark as needing migration if we removed any entries
      if (migratedSettings.monthlyLimits.length !== originalLength) {
        console.log(
          `Cleaned up ${originalLength - migratedSettings.monthlyLimits.length} deprecated monthly limit(s)`,
        );
        needsMigration = true;
      }
    }

    // Migration v3: Convert priorityRules from object format to array format
    if (
      currentVersion < 3 &&
      settings.priorityRules &&
      !Array.isArray(settings.priorityRules)
    ) {
      console.log(
        "Running migration v3: Converting priorityRules from object to array format",
      );
      const oldPriorityRules = settings.priorityRules;
      migratedSettings.priorityRules = [];

      // Convert old object format to new array format
      Object.entries(oldPriorityRules).forEach(([staffName, staffRules]) => {
        if (
          staffRules.preferredShifts &&
          Array.isArray(staffRules.preferredShifts)
        ) {
          staffRules.preferredShifts.forEach((pref, index) => {
            const newRule = {
              id: `migrated-priority-rule-${staffName}-${index}-${Date.now()}`,
              name: `${staffName} - ${pref.shift} preference`,
              description: `Migrated rule: ${staffName} prefers ${pref.shift} shifts`,
              ruleType:
                pref.shift === "off" ? "required_off" : "preferred_shift",
              staffId: staffName, // Using staff name as ID - may need adjustment based on actual staff data structure
              shiftType: pref.shift,
              daysOfWeek: pref.day === "sunday" ? [0] : [], // Convert day names to day IDs (0=Sunday)
              priorityLevel:
                pref.priority === "high"
                  ? 4
                  : pref.priority === "medium"
                    ? 3
                    : 2,
              preferenceStrength: pref.strength || 0.8,
              isHardConstraint: pref.priority === "high",
              penaltyWeight: pref.priority === "high" ? 80 : 50,
              effectiveFrom: null,
              effectiveUntil: null,
              isActive: true,
            };
            migratedSettings.priorityRules.push(newRule);
          });
        }
      });

      console.log(
        `Migrated ${migratedSettings.priorityRules.length} priority rules from object to array format`,
      );
      needsMigration = true;
    }

    // Migration v4: Extract daily limits from weeklyLimits array to dedicated dailyLimits object
    if (currentVersion < 4) {
      console.log(
        "🔄 Running migration v4: Extract daily limits from weeklyLimits array",
      );

      // IDs of items that are actually daily limits (stored in wrong place)
      const dailyLimitIds = [
        "daily-limit-off",
        "daily-limit-early",
        "daily-limit-late",
        "daily-limit-min-working",
      ];

      // Find existing daily limits in weeklyLimits array
      const dailyLimitItems =
        settings.weeklyLimits?.filter((limit) =>
          dailyLimitIds.includes(limit.id),
        ) || [];

      // Create new dailyLimits object
      migratedSettings.dailyLimits = {
        maxOffPerDay:
          dailyLimitItems.find((l) => l.id === "daily-limit-off")?.maxCount ||
          3,
        maxEarlyPerDay:
          dailyLimitItems.find((l) => l.id === "daily-limit-early")
            ?.maxCount || 2,
        maxLatePerDay:
          dailyLimitItems.find((l) => l.id === "daily-limit-late")?.maxCount ||
          3,
        minWorkingStaffPerDay:
          dailyLimitItems.find((l) => l.id === "daily-limit-min-working")
            ?.maxCount || 3,
      };

      // Remove daily limits from weeklyLimits array (they're in wrong place)
      migratedSettings.weeklyLimits =
        settings.weeklyLimits?.filter(
          (limit) => !dailyLimitIds.includes(limit.id),
        ) || [];

      console.log(
        "✅ Migration v4 complete: Daily limits extracted",
        migratedSettings.dailyLimits,
      );
      console.log(
        `   Removed ${dailyLimitItems.length} items from weeklyLimits array`,
      );

      needsMigration = true;
    }

    // Update migration version if any migration ran or if version is outdated
    if (needsMigration || currentVersion < CURRENT_MIGRATION_VERSION) {
      migratedSettings.migrationVersion = CURRENT_MIGRATION_VERSION;
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
   * Save settings to localStorage and sync to database if available
   */
  async saveSettings(settings) {
    try {
      this.settings = { ...this.settings, ...settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      console.log("Settings saved to localStorage");

      // Ensure Supabase connection is initialized before syncing
      if (!this.isSupabaseEnabled && !this.supabaseInitialized) {
        console.log("🔄 Initializing Supabase connection for autosave...");
        await this.checkSupabaseConnection();
      }

      // ✅ CRITICAL FIX: Disable database sync in WebSocket mode to prevent data deletion
      // ConfigurationService uses a DANGEROUS delete-then-insert pattern that wipes ALL data
      // if called with empty/stale settings. This caused complete database wipe on 2025-11-13.
      // In WebSocket mode, Go server + dedicated hooks handle database operations.
      // See: FINAL-FIX-RACE-CONDITION-SUPABASE-HOOKS.md, CONFIGURATION-SERVICE-DELETION-FIX.md
      const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

      // ✅ CRITICAL: Only sync when WebSocket is DISABLED
      // When enabled, Go server manages database - ConfigurationService must NOT interfere
      if (this.isSupabaseEnabled && !WEBSOCKET_SETTINGS_ENABLED) {
        const syncResult = await this.syncToDatabase();
        if (syncResult.success) {
          console.log("✅ Settings auto-synced to database (localStorage mode)");
        } else {
          console.warn("⚠️ Auto-sync failed:", syncResult.error);
        }
      } else if (WEBSOCKET_SETTINGS_ENABLED) {
        console.log("⏭️ ConfigurationService sync DISABLED - WebSocket mode handles database operations");
        console.log("   ⚠️  SAFETY: Prevents delete-then-insert from wiping database with stale cache");
      } else {
        console.log("📱 Supabase not available, using localStorage only");
      }

      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }

  /**
   * Get current settings (with lazy initialization)
   */
  async getSettings() {
    await this.initialize();
    return { ...this.settings };
  }

  /**
   * Get current settings synchronously (with fallback)
   */
  getSettingsSync() {
    if (!this.settings) {
      console.warn("⚠️ Settings not initialized, using defaults");
      return this.getDefaultSettings();
    }
    return { ...this.settings };
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults() {
    this.settings = this.getDefaultSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    console.log("Settings reset to defaults");

    // Sync with Supabase if enabled
    if (this.isSupabaseEnabled) {
      await this.syncToDatabase();
    }
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
      // Migration version
      migrationVersion: 4,

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
      dailyLimits: {
        maxOffPerDay: 3, // Default: 3, Max: 4
        maxEarlyPerDay: 2, // Default: 2, Max: 2
        maxLatePerDay: 3, // Default: 3, Max: 3
        minWorkingStaffPerDay: 3, // Fixed - not configurable via UI
      },

      // Weekly Limits (for weekly patterns)
      weeklyLimits: [
        // Weekly pattern limits will go here (not daily limits)
      ],

      // Priority Rules - using array format for consistency with UI components
      priorityRules: [
        // Example rules - in production, users will create their own rules through the UI
      ],

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

      // Note: Constraint weights are now auto-detected from actual settings
      // No manual constraint weight configuration needed

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
          description:
            "Maximum number of days off allowed per staff member per month",
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
    const settings = this.settings || this.getDefaultSettings();
    return settings.staffGroups || this.getDefaultSettings().staffGroups;
  }

  /**
   * Update staff groups
   */
  async updateStaffGroups(staffGroups) {
    return await this.saveSettings({ staffGroups });
  }

  /**
   * Get daily limits configuration
   * @returns {Object} Daily limits object with maxOffPerDay, maxEarlyPerDay, maxLatePerDay
   */
  async getDailyLimits() {
    await this.initialize();

    if (!this.settings?.dailyLimits) {
      console.warn("⚠️ dailyLimits not found in settings, using defaults");
      return {
        maxOffPerDay: 3,
        maxEarlyPerDay: 2,
        maxLatePerDay: 3,
        minWorkingStaffPerDay: 3,
      };
    }

    return this.settings.dailyLimits;
  }

  /**
   * Update daily limits configuration
   * @param {Object} dailyLimits - New daily limits
   * @returns {Object} Updated daily limits
   */
  async updateDailyLimits(dailyLimits) {
    await this.initialize();

    console.log("💾 Updating daily limits:", dailyLimits);

    this.settings.dailyLimits = {
      ...this.settings.dailyLimits,
      ...dailyLimits,
    };

    await this.saveSettings(this.settings);

    console.log("✅ Daily limits updated successfully");
    return this.settings.dailyLimits;
  }

  /**
   * Get weekly limits
   */
  getWeeklyLimits() {
    const settings = this.settings || this.getDefaultSettings();
    return settings.weeklyLimits || this.getDefaultSettings().weeklyLimits;
  }

  /**
   * Update daily limits
   */
  async updateWeeklyLimits(weeklyLimits) {
    return await this.saveSettings({ weeklyLimits });
  }

  /**
   * Get priority rules
   */
  getPriorityRules() {
    const settings = this.settings || this.getDefaultSettings();
    return settings.priorityRules || this.getDefaultSettings().priorityRules;
  }

  /**
   * Update priority rules
   */
  async updatePriorityRules(priorityRules) {
    return await this.saveSettings({ priorityRules });
  }

  /**
   * Get ML parameters
   */
  getMLParameters() {
    const settings = this.settings || this.getDefaultSettings();
    return settings.mlParameters || this.getDefaultSettings().mlParameters;
  }

  /**
   * Update ML parameters
   */
  async updateMLParameters(mlParameters) {
    return await this.saveSettings({ mlParameters });
  }

  /**
   * Get monthly limits
   */
  getMonthlyLimits() {
    const settings = this.settings || this.getDefaultSettings();
    return settings.monthlyLimits || this.getDefaultSettings().monthlyLimits;
  }

  /**
   * Update monthly limits
   */
  async updateMonthlyLimits(monthlyLimits) {
    return await this.saveSettings({ monthlyLimits });
  }

  /**
   * Get backup assignments
   */
  getBackupAssignments() {
    const settings = this.settings || this.getDefaultSettings();
    return (
      settings.backupAssignments || this.getDefaultSettings().backupAssignments
    );
  }

  /**
   * Update backup assignments
   */
  async updateBackupAssignments(backupAssignments) {
    return await this.saveSettings({ backupAssignments });
  }

  /**
   * 🔧 BRIDGE: Sync external settings into ConfigurationService cache
   * This allows WebSocket-based settings to update the AI system's cached config
   * Called by useSettingsData when settings change via WebSocket
   */
  syncExternalSettings(externalSettings) {
    if (!externalSettings) {
      console.warn("⚠️ [syncExternalSettings] No settings provided");
      return;
    }

    console.log("🔄 [ConfigurationService] Syncing external settings to cache");

    // Merge external settings into our cache
    this.settings = {
      ...this.settings,
      ...externalSettings,
    };

    console.log("✅ [ConfigurationService] Settings cache updated", {
      priorityRules: this.settings.priorityRules?.length || 0,
      staffGroups: this.settings.staffGroups?.length || 0,
      weeklyLimits: this.settings.weeklyLimits?.length || 0,
      monthlyLimits: this.settings.monthlyLimits?.length || 0,
    });
  }

  /**
   * Force migration of existing data (useful for testing or manual cleanup)
   */
  forceMigration() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        // Set migration version to 0 to force re-migration
        settings.migrationVersion = 0;
        const migrated = this.migrateSettings(settings);
        this.settings = migrated;
        console.log("Forced migration completed successfully");
        return { success: true };
      }
      return { success: false, error: "No settings found to migrate" };
    } catch (error) {
      console.error("Failed to force migration:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if data has deprecated entries that need cleanup
   */
  hasDeprecatedEntries() {
    const monthlyLimits = this.getMonthlyLimits();
    return monthlyLimits.some(
      (limit) =>
        limit.limitType === "min_work_days" ||
        (limit.name && limit.name.includes("Minimum Work Days")) ||
        (limit.id && limit.id.includes("min-work-days")),
    );
  }

  /**
   * Debug method to check current storage state (for browser console)
   */
  debugStorageState() {
    console.log("🔍 Current storage state:");
    console.log("Migration version:", this.settings.migrationVersion || "none");
    console.log("Monthly limits:", this.getMonthlyLimits().length);

    const deprecatedLimits = this.getMonthlyLimits().filter(
      (limit) =>
        limit.limitType === "min_work_days" ||
        (limit.name && limit.name.includes("Minimum Work Days")) ||
        (limit.id && limit.id.includes("min-work-days")),
    );

    if (deprecatedLimits.length > 0) {
      console.warn("⚠️ Found deprecated limits:", deprecatedLimits);
      console.log("To fix: Call configService.forceMigration()");
    } else {
      console.log("✅ No deprecated limits found");
    }

    return {
      migrationVersion: this.settings.migrationVersion,
      totalMonthlyLimits: this.getMonthlyLimits().length,
      deprecatedLimits: deprecatedLimits.length,
      hasDeprecatedEntries: deprecatedLimits.length > 0,
    };
  }

  /**
   * Validate settings structure
   */
  validateSettings(settings) {
    const errors = {};

    // Basic validation - can be expanded as needed
    if (settings.mlParameters) {
      const ml = settings.mlParameters;
      if (ml.populationSize < 10 || ml.populationSize > 1000) {
        errors.mlParameters = {
          populationSize: "Population size must be between 10 and 1000",
        };
      }
      if (ml.generations < 50 || ml.generations > 2000) {
        errors.mlParameters = {
          ...errors.mlParameters,
          generations: "Generations must be between 50 and 2000",
        };
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // ===== SUPABASE INTEGRATION METHODS =====

  /**
   * Check if Supabase is available and connected
   */
  async checkSupabaseConnection() {
    try {
      // Add timeout to prevent blocking on startup
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Supabase connection timeout")),
          3000,
        ),
      );

      const queryPromise = supabase.from("restaurants").select("id").limit(1);

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]);

      if (error) throw error;

      this.isSupabaseEnabled = true;

      // Get or create restaurant entry (also with timeout)
      if (data && data.length > 0) {
        this.restaurantId = data[0].id;
      } else {
        // Do this in background to not block initialization
        setTimeout(async () => {
          try {
            await this.createRestaurantEntry();
          } catch (error) {
            console.warn("⚠️ Failed to create restaurant entry:", error);
          }
        }, 100);
      }

      console.log("✅ Supabase configuration sync enabled");

      // Load settings from database in background to not block initialization
      setTimeout(async () => {
        try {
          await this.loadFromDatabase();
        } catch (error) {
          console.warn("⚠️ Failed to load from database:", error);
        }
      }, 200);

      this.supabaseInitialized = true;
    } catch (error) {
      console.log(
        "⚠️ Supabase not available, using localStorage only:",
        error.message,
      );
      this.isSupabaseEnabled = false;
      this.supabaseInitialized = true; // Mark as initialized even if failed
    }
  }

  /**
   * Create restaurant entry if none exists
   */
  async createRestaurantEntry() {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .insert([
          {
            name: "Default Restaurant",
            timezone: "Asia/Tokyo",
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;

      this.restaurantId = data[0].id;
      console.log("Created restaurant entry:", this.restaurantId);
    } catch (error) {
      console.error("Failed to create restaurant entry:", error);
      throw error;
    }
  }

  /**
   * Load settings from database
   */
  async loadFromDatabase() {
    if (!this.isSupabaseEnabled || !this.restaurantId) return;

    try {
      // Get the active configuration version
      const { data: configVersions, error: versionError } = await supabase
        .from("config_versions")
        .select("*")
        .eq("restaurant_id", this.restaurantId)
        .eq("is_active", true)
        .order("version_number", { ascending: false })
        .limit(1);

      if (versionError) throw versionError;

      if (!configVersions || configVersions.length === 0) {
        console.log(
          "No active configuration version found, will create one on first save",
        );
        return;
      }

      this.currentVersionId = configVersions[0].id;

      // Load all configuration data
      const [
        staffGroups,
        weeklyLimits,
        monthlyLimits,
        priorityRules,
        mlConfigs,
        backupAssignments,
      ] = await Promise.all([
        this.loadStaffGroupsFromDB(),
        this.loadWeeklyLimitsFromDB(),
        this.loadMonthlyLimitsFromDB(),
        this.loadPriorityRulesFromDB(),
        this.loadMLConfigFromDB(),
        this.loadBackupAssignmentsFromDB(),
      ]);

      // Merge with localStorage settings, preferring database data
      const databaseSettings = {
        ...this.settings,
        staffGroups: staffGroups || this.settings.staffGroups,
        weeklyLimits: weeklyLimits || this.settings.weeklyLimits,
        monthlyLimits: monthlyLimits || this.settings.monthlyLimits,
        priorityRules: priorityRules || this.settings.priorityRules,
        mlParameters: mlConfigs || this.settings.mlParameters,
        backupAssignments: backupAssignments || this.settings.backupAssignments,
        lastSyncedAt: new Date().toISOString(),
      };

      this.settings = databaseSettings;

      // Update localStorage with synced data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));

      console.log("✅ Settings loaded from database");
    } catch (error) {
      console.warn("Failed to load settings from database:", error);
    }
  }

  /**
   * Sync current settings to database
   */
  async syncToDatabase() {
    if (!this.isSupabaseEnabled || !this.restaurantId || this.syncInProgress) {
      return {
        success: false,
        error: "Supabase not available or sync in progress",
      };
    }

    this.syncInProgress = true;

    try {
      // Create or get configuration version
      if (!this.currentVersionId) {
        await this.createConfigVersion();
      }

      // Save all configuration components
      await Promise.all([
        this.saveStaffGroupsToDB(),
        this.saveWeeklyLimitsToDB(),
        this.saveMonthlyLimitsToDB(),
        this.savePriorityRulesToDB(),
        this.saveMLConfigToDB(),
        this.saveBackupAssignmentsToDB(),
      ]);

      // Update sync timestamp
      this.settings.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));

      console.log("✅ Settings synced to database");
      return { success: true };
    } catch (error) {
      console.error("Failed to sync settings to database:", error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create a new configuration version
   */
  async createConfigVersion() {
    try {
      const { data, error } = await supabase
        .from("config_versions")
        .insert([
          {
            restaurant_id: this.restaurantId,
            version_number: 1,
            name: "Auto-generated Configuration",
            description: "Automatically created configuration version",
            is_active: true,
            is_locked: false,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;

      this.currentVersionId = data[0].id;
      console.log("Created configuration version:", this.currentVersionId);
    } catch (error) {
      console.error("Failed to create configuration version:", error);
      throw error;
    }
  }

  // Database-specific load methods
  async loadStaffGroupsFromDB() {
    try {
      const { data, error } = await supabase
        .from("staff_groups")
        .select("*")
        .eq("version_id", this.currentVersionId);

      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          color: item.group_config?.color || "#3B82F6",
          members: item.group_config?.members || [],
        })) || null
      );
    } catch (error) {
      console.warn("Failed to load staff groups from database:", error);
      return null;
    }
  }

  async loadWeeklyLimitsFromDB() {
    try {
      const { data, error } = await supabase
        .from("weekly_limits")
        .select("*")
        .eq("version_id", this.currentVersionId);

      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          ...item.limit_config,
        })) || null
      );
    } catch (error) {
      console.warn("Failed to load weekly limits from database:", error);
      return null;
    }
  }

  async loadMonthlyLimitsFromDB() {
    try {
      const { data, error } = await supabase
        .from("monthly_limits")
        .select("*")
        .eq("version_id", this.currentVersionId);

      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          ...item.limit_config,
        })) || null
      );
    } catch (error) {
      console.warn("Failed to load monthly limits from database:", error);
      return null;
    }
  }

  async loadPriorityRulesFromDB() {
    try {
      const { data, error } = await supabase
        .from("priority_rules")
        .select("*")
        .eq("version_id", this.currentVersionId);

      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          ...item.rule_definition, // ✅ FIX: Changed from rule_config to rule_definition to match database schema
        })) || null
      );
    } catch (error) {
      console.warn("Failed to load priority rules from database:", error);
      return null;
    }
  }

  async loadMLConfigFromDB() {
    try {
      const { data, error } = await supabase
        .from("ml_model_configs")
        .select("*")
        .eq("version_id", this.currentVersionId)
        .eq("model_type", "optimization")
        .limit(1);

      if (error) throw error;

      return data && data.length > 0
        ? {
            model_name: data[0].model_name,
            model_type: data[0].model_type,
            ...data[0].model_config,
          }
        : null;
    } catch (error) {
      console.warn("Failed to load ML config from database:", error);
      return null;
    }
  }

  async loadBackupAssignmentsFromDB() {
    try {
      const { data, error } = await supabase
        .from("staff_backup_assignments")
        .select("*")
        .eq("version_id", this.currentVersionId)
        .eq("is_active", true)
        .order("priority_order", { ascending: true });

      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.id,
          staffId: item.staff_id,
          groupId: item.group_id,
          assignmentType: item.assignment_type || "regular",
          priorityOrder: item.priority_order || 1,
          effectiveFrom: item.effective_from,
          effectiveUntil: item.effective_until,
          notes: item.notes,
          createdAt: item.created_at,
        })) || null
      );
    } catch (error) {
      console.warn("Failed to load backup assignments from database:", error);
      return null;
    }
  }

  // Database-specific save methods
  async saveStaffGroupsToDB() {
    if (!this.settings.staffGroups) return;

    // ✅ SAFETY CHECK: Prevent data wipe if settings are empty
    // Do NOT delete if we have nothing to insert - this prevents accidental data loss
    if (this.settings.staffGroups.length === 0) {
      console.warn("⚠️ SAFETY: Refusing to delete all staff groups - settings array is empty");
      console.warn("   This prevents accidental data wipe from stale/empty settings cache");
      return;
    }

    try {
      console.log(`🗑️ Deleting existing staff groups for version ${this.currentVersionId}`);
      console.log(`📊 Will re-insert ${this.settings.staffGroups.length} groups`);

      // Delete existing staff groups for this version
      await supabase
        .from("staff_groups")
        .delete()
        .eq("version_id", this.currentVersionId);

      // Insert new staff groups
      if (this.settings.staffGroups.length > 0) {
        const groupsData = this.settings.staffGroups.map((group) => ({
          restaurant_id: this.restaurantId,
          version_id: this.currentVersionId,
          name: group.name,
          description: group.description || "",
          group_config: {
            color: group.color,
            members: group.members,
          },
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("staff_groups")
          .insert(groupsData);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to save staff groups to database:", error);
      throw error;
    }
  }

  async saveWeeklyLimitsToDB() {
    if (!this.settings.weeklyLimits) return;

    try {
      // Delete existing weekly limits for this version
      await supabase
        .from("weekly_limits")
        .delete()
        .eq("version_id", this.currentVersionId);

      // Insert new weekly limits
      if (this.settings.weeklyLimits.length > 0) {
        const limitsData = this.settings.weeklyLimits.map((limit) => ({
          restaurant_id: this.restaurantId,
          version_id: this.currentVersionId,
          name: limit.name,
          limit_config: {
            shiftType: limit.shiftType,
            maxCount: limit.maxCount,
            daysOfWeek: limit.daysOfWeek,
            scope: limit.scope,
            targetIds: limit.targetIds,
            isHardConstraint: limit.isHardConstraint,
            penaltyWeight: limit.penaltyWeight,
            description: limit.description,
          },
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("weekly_limits")
          .insert(limitsData);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to save weekly limits to database:", error);
      throw error;
    }
  }

  async saveMonthlyLimitsToDB() {
    if (!this.settings.monthlyLimits) return;

    try {
      // Delete existing monthly limits for this version
      await supabase
        .from("monthly_limits")
        .delete()
        .eq("version_id", this.currentVersionId);

      // Insert new monthly limits
      if (this.settings.monthlyLimits.length > 0) {
        const limitsData = this.settings.monthlyLimits.map((limit) => ({
          restaurant_id: this.restaurantId,
          version_id: this.currentVersionId,
          name: limit.name,
          limit_config: {
            limitType: limit.limitType,
            maxCount: limit.maxCount,
            scope: limit.scope,
            targetIds: limit.targetIds,
            distributionRules: limit.distributionRules,
            isHardConstraint: limit.isHardConstraint,
            penaltyWeight: limit.penaltyWeight,
            description: limit.description,
          },
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("monthly_limits")
          .insert(limitsData);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to save monthly limits to database:", error);
      throw error;
    }
  }

  async savePriorityRulesToDB() {
    if (!this.settings.priorityRules) return;

    // ✅ SAFETY CHECK: Prevent data wipe if settings are empty
    // Do NOT delete if we have nothing to insert - this prevents accidental data loss
    if (this.settings.priorityRules.length === 0) {
      console.warn("⚠️ SAFETY: Refusing to delete all priority rules - settings array is empty");
      console.warn("   This prevents accidental data wipe from stale/empty settings cache");
      return;
    }

    try {
      console.log(`🗑️ Deleting existing priority rules for version ${this.currentVersionId}`);
      console.log(`📊 Will re-insert ${this.settings.priorityRules.length} rules`);

      // Delete existing priority rules for this version
      await supabase
        .from("priority_rules")
        .delete()
        .eq("version_id", this.currentVersionId);

      // Insert new priority rules
      if (this.settings.priorityRules.length > 0) {
        const rulesData = this.settings.priorityRules.map((rule) => ({
          restaurant_id: this.restaurantId,
          version_id: this.currentVersionId,
          name: rule.name,
          description: rule.description || "",
          rule_definition: { // ✅ FIX: Changed from rule_config to rule_definition to match database schema
            ruleType: rule.ruleType,
            staffId: rule.staffId,
            shiftType: rule.shiftType,
            daysOfWeek: rule.daysOfWeek,
            priorityLevel: rule.priorityLevel,
            preferenceStrength: rule.preferenceStrength,
            isHardConstraint: rule.isHardConstraint,
            penaltyWeight: rule.penaltyWeight,
            effectiveFrom: rule.effectiveFrom,
            effectiveUntil: rule.effectiveUntil,
            isActive: rule.isActive,
          },
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("priority_rules")
          .insert(rulesData);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to save priority rules to database:", error);
      throw error;
    }
  }

  async saveMLConfigToDB() {
    if (!this.settings.mlParameters) return;

    try {
      // Delete existing ML config for this version
      await supabase
        .from("ml_model_configs")
        .delete()
        .eq("version_id", this.currentVersionId)
        .eq("model_type", "optimization");

      // Insert new ML config
      const { error } = await supabase.from("ml_model_configs").insert([
        {
          restaurant_id: this.restaurantId,
          version_id: this.currentVersionId,
          model_name:
            this.settings.mlParameters.algorithm || "genetic_algorithm",
          model_type: "optimization",
          model_config: this.settings.mlParameters,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to save ML config to database:", error);
      throw error;
    }
  }

  async saveBackupAssignmentsToDB() {
    if (!this.settings.backupAssignments) return;

    try {
      // Delete existing backup assignments for this version
      await supabase
        .from("staff_backup_assignments")
        .delete()
        .eq("version_id", this.currentVersionId);

      // Insert new backup assignments
      if (this.settings.backupAssignments.length > 0) {
        const assignmentsData = this.settings.backupAssignments.map(
          (assignment) => ({
            restaurant_id: this.restaurantId,
            version_id: this.currentVersionId,
            staff_id: assignment.staffId,
            group_id: assignment.groupId,
            assignment_type: assignment.assignmentType || "regular",
            priority_order: assignment.priorityOrder || 1,
            effective_from: assignment.effectiveFrom,
            effective_until: assignment.effectiveUntil,
            notes: assignment.notes,
            is_active: true,
            created_at: assignment.createdAt || new Date().toISOString(),
          }),
        );

        const { error } = await supabase
          .from("staff_backup_assignments")
          .insert(assignmentsData);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to save backup assignments to database:", error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSupabaseEnabled: this.isSupabaseEnabled,
      restaurantId: this.restaurantId,
      currentVersionId: this.currentVersionId,
      syncInProgress: this.syncInProgress,
      lastSyncedAt: this.settings.lastSyncedAt,
    };
  }

  /**
   * Force sync settings to database
   */
  async forceSyncToDatabase() {
    this.currentVersionId = null; // Force new version creation
    return await this.syncToDatabase();
  }
}

// Create a singleton instance
export const configService = new ConfigurationService();

export default configService;
