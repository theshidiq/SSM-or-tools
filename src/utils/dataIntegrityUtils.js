/**
 * Data Integrity and Persistence Monitoring Utilities
 *
 * These utilities help monitor and ensure data persistence across
 * all storage layers: Memory → localStorage → Supabase
 */

import { optimizedStorage, STORAGE_KEYS } from "./storageUtils";

/**
 * Check data integrity across storage layers
 */
export const dataIntegrityMonitor = {
  /**
   * Verify manual input persistence
   */
  async checkManualInputPersistence(
    periodIndex,
    staffId,
    dateKey,
    expectedValue,
  ) {
    const results = {
      memoryCache: null,
      localStorage: null,
      supabase: null,
      issues: [],
    };

    try {
      // Check memory cache
      const scheduleData = optimizedStorage.getScheduleData(periodIndex);
      const memoryCacheValue = scheduleData?.[staffId]?.[dateKey];
      results.memoryCache = memoryCacheValue;

      // Check localStorage directly
      const localStorageKey = STORAGE_KEYS.getScheduleKey(periodIndex);
      const localStorageData = JSON.parse(
        localStorage.getItem(localStorageKey) || "{}",
      );
      const localStorageValue = localStorageData?.[staffId]?.[dateKey];
      results.localStorage = localStorageValue;

      // Compare values
      if (memoryCacheValue !== expectedValue) {
        results.issues.push(
          `Memory cache mismatch: expected "${expectedValue}", got "${memoryCacheValue}"`,
        );
      }

      if (localStorageValue !== expectedValue) {
        results.issues.push(
          `localStorage mismatch: expected "${expectedValue}", got "${localStorageValue}"`,
        );
      }

      // Check if data exists in any layer
      if (memoryCacheValue === undefined && localStorageValue === undefined) {
        results.issues.push("Data not found in any storage layer");
      }
    } catch (error) {
      results.issues.push(`Integrity check error: ${error.message}`);
    }

    return results;
  },

  /**
   * Verify data consistency across periods
   */
  checkCrossPeriodConsistency() {
    const issues = [];
    const staffConsistency = {};

    // Check staff data consistency across all periods
    for (let period = 0; period < 6; period++) {
      const staffData = optimizedStorage.getStaffData(period);
      if (staffData && staffData.length > 0) {
        staffData.forEach((staff) => {
          if (!staffConsistency[staff.id]) {
            staffConsistency[staff.id] = {
              name: staff.name,
              periods: [],
              variations: new Set(),
            };
          }
          staffConsistency[staff.id].periods.push(period);
          staffConsistency[staff.id].variations.add(staff.name);
        });
      }
    }

    // Check for name variations
    Object.keys(staffConsistency).forEach((staffId) => {
      const staff = staffConsistency[staffId];
      if (staff.variations.size > 1) {
        issues.push(
          `Staff ${staffId} has name variations: ${Array.from(staff.variations).join(", ")}`,
        );
      }
    });

    return { staffConsistency, issues };
  },

  /**
   * Monitor auto-save success rate
   */
  autoSaveMonitor: {
    saves: 0,
    failures: 0,
    lastSave: null,
    lastFailure: null,

    recordSave() {
      this.saves++;
      this.lastSave = new Date();
    },

    recordFailure(error) {
      this.failures++;
      this.lastFailure = { time: new Date(), error: error.message };
    },

    getStats() {
      const total = this.saves + this.failures;
      return {
        total,
        saves: this.saves,
        failures: this.failures,
        successRate:
          total > 0 ? ((this.saves / total) * 100).toFixed(2) + "%" : "0%",
        lastSave: this.lastSave,
        lastFailure: this.lastFailure,
      };
    },

    reset() {
      this.saves = 0;
      this.failures = 0;
      this.lastSave = null;
      this.lastFailure = null;
    },
  },
};

/**
 * Data validation utilities
 */
export const dataValidation = {
  /**
   * Validate shift value format
   */
  isValidShiftValue(value) {
    if (value === null || value === undefined || value === "") {
      return true; // Empty values are valid
    }

    // Valid shift symbols
    const validSymbols = ["△", "○", "▽", "×", "⊘", "★"];

    // Check if it's a valid symbol
    if (validSymbols.includes(value)) {
      return true;
    }

    // Check if it's 'late' (special case)
    if (value === "late") {
      return true;
    }

    // Allow custom text (but warn if too long)
    if (typeof value === "string" && value.length > 10) {
      console.warn(`⚠️ Shift value might be too long: "${value}"`);
    }

    return typeof value === "string";
  },

  /**
   * Validate staff ID format
   */
  isValidStaffId(staffId) {
    return staffId && typeof staffId === "string" && staffId.length > 0;
  },

  /**
   * Validate date key format
   */
  isValidDateKey(dateKey) {
    return dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
  },

  /**
   * Validate complete schedule structure
   */
  validateScheduleStructure(schedule) {
    const issues = [];

    if (!schedule || typeof schedule !== "object") {
      issues.push("Schedule is not a valid object");
      return issues;
    }

    Object.keys(schedule).forEach((staffId) => {
      if (!this.isValidStaffId(staffId)) {
        issues.push(`Invalid staff ID: ${staffId}`);
        return;
      }

      const staffSchedule = schedule[staffId];
      if (!staffSchedule || typeof staffSchedule !== "object") {
        issues.push(`Invalid schedule structure for staff ${staffId}`);
        return;
      }

      Object.keys(staffSchedule).forEach((dateKey) => {
        if (!this.isValidDateKey(dateKey)) {
          issues.push(`Invalid date key: ${dateKey} for staff ${staffId}`);
        }

        const shiftValue = staffSchedule[dateKey];
        if (!this.isValidShiftValue(shiftValue)) {
          issues.push(
            `Invalid shift value: "${shiftValue}" for staff ${staffId} on ${dateKey}`,
          );
        }
      });
    });

    return issues;
  },
};

/**
 * Data recovery utilities
 */
export const dataRecovery = {
  /**
   * Attempt to recover data from different storage layers
   */
  async recoverScheduleData(periodIndex) {
    const recoveryAttempts = [];

    // Try memory cache first
    try {
      const memoryData = optimizedStorage.getScheduleData(periodIndex);
      if (memoryData && Object.keys(memoryData).length > 0) {
        recoveryAttempts.push({
          source: "memory",
          success: true,
          data: memoryData,
        });
        return { success: true, data: memoryData, source: "memory" };
      }
      recoveryAttempts.push({ source: "memory", success: false });
    } catch (error) {
      recoveryAttempts.push({
        source: "memory",
        success: false,
        error: error.message,
      });
    }

    // Try localStorage
    try {
      const localStorageKey = STORAGE_KEYS.getScheduleKey(periodIndex);
      const localStorageData = JSON.parse(
        localStorage.getItem(localStorageKey) || "{}",
      );
      if (Object.keys(localStorageData).length > 0) {
        recoveryAttempts.push({
          source: "localStorage",
          success: true,
          data: localStorageData,
        });
        // Restore to memory cache
        optimizedStorage.saveScheduleData(periodIndex, localStorageData);
        return {
          success: true,
          data: localStorageData,
          source: "localStorage",
        };
      }
      recoveryAttempts.push({ source: "localStorage", success: false });
    } catch (error) {
      recoveryAttempts.push({
        source: "localStorage",
        success: false,
        error: error.message,
      });
    }

    return { success: false, recoveryAttempts };
  },

  /**
   * Emergency data backup
   */
  createEmergencyBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      data: {},
    };

    try {
      // Backup all periods
      for (let period = 0; period < 6; period++) {
        const scheduleData = optimizedStorage.getScheduleData(period);
        const staffData = optimizedStorage.getStaffData(period);

        if (scheduleData && Object.keys(scheduleData).length > 0) {
          backup.data[`schedule-${period}`] = scheduleData;
        }

        if (staffData && staffData.length > 0) {
          backup.data[`staff-${period}`] = staffData;
        }
      }

      // Store backup in localStorage with timestamp
      const backupKey = `emergency-backup-${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(backup));

      console.log(`🔄 Emergency backup created: ${backupKey}`);
      return backupKey;
    } catch (error) {
      console.error("❌ Failed to create emergency backup:", error);
      return null;
    }
  },
};

// Global debug utilities (development only)
if (process.env.NODE_ENV === "development") {
  window.dataIntegrityMonitor = dataIntegrityMonitor;
  window.dataValidation = dataValidation;
  window.dataRecovery = dataRecovery;
}
