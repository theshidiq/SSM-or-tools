/**
 * Phase 3: Migration Utilities
 * Comprehensive utilities for managing the migration from complex to simplified staff management
 */

import { useState, useEffect } from "react";
import {
  FEATURE_FLAGS,
  setFeatureFlag,
  emergencyRollback,
} from "../config/featureFlags";

/**
 * Migration data validator
 * Ensures data compatibility between Phase 2 and Phase 3 systems
 */
export const validateMigrationData = (staffData) => {
  const errors = [];
  const warnings = [];

  if (!staffData || !Array.isArray(staffData)) {
    errors.push("Staff data must be an array");
    return { valid: false, errors, warnings };
  }

  staffData.forEach((staff, index) => {
    // Required fields validation
    if (!staff.id) {
      errors.push(`Staff member at index ${index} missing required id field`);
    }
    if (!staff.name || typeof staff.name !== "string") {
      errors.push(
        `Staff member at index ${index} missing or invalid name field`,
      );
    }

    // Phase 3 compatibility checks
    if (staff.isOptimistic) {
      warnings.push(
        `Staff member ${staff.name} has optimistic flag - may need cleanup`,
      );
    }
    if (staff.pendingOperations && staff.pendingOperations.length > 0) {
      warnings.push(
        `Staff member ${staff.name} has pending operations - migration may be unsafe`,
      );
    }

    // Data structure validation
    if (staff.startPeriod && typeof staff.startPeriod !== "object") {
      warnings.push(
        `Staff member ${staff.name} has invalid startPeriod format`,
      );
    }
    if (staff.endPeriod && typeof staff.endPeriod !== "object") {
      warnings.push(`Staff member ${staff.name} has invalid endPeriod format`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    staffCount: staffData.length,
  };
};

/**
 * Migration state manager
 * Handles safe migration between systems
 */
export class MigrationManager {
  constructor() {
    this.migrationState = this.loadMigrationState();
    this.listeners = [];
  }

  loadMigrationState() {
    try {
      const saved = localStorage.getItem("phase3_migration_state");
      return saved ? JSON.parse(saved) : this.getDefaultState();
    } catch (error) {
      console.warn("🔄 Failed to load migration state, using defaults:", error);
      return this.getDefaultState();
    }
  }

  getDefaultState() {
    return {
      phase: "Phase 2",
      webSocketEnabled: false,
      lastMigration: null,
      migrationAttempts: 0,
      rollbackReason: null,
      healthChecks: [],
      dataValidation: null,
    };
  }

  saveMigrationState() {
    try {
      localStorage.setItem(
        "phase3_migration_state",
        JSON.stringify(this.migrationState),
      );
    } catch (error) {
      console.error("❌ Failed to save migration state:", error);
    }
  }

  /**
   * Initiate migration to Phase 3 WebSocket mode
   */
  async migrateToWebSocket(staffData = null) {
    console.log("🚀 Phase 3: Initiating migration to WebSocket mode");

    this.migrationState.migrationAttempts++;
    this.migrationState.lastMigration = {
      timestamp: new Date().toISOString(),
      direction: "to_websocket",
      attempt: this.migrationState.migrationAttempts,
    };

    // Validate data if provided
    if (staffData) {
      const validation = validateMigrationData(staffData);
      this.migrationState.dataValidation = validation;

      if (!validation.valid) {
        console.error(
          "❌ Phase 3: Migration validation failed:",
          validation.errors,
        );
        throw new Error(
          `Migration validation failed: ${validation.errors.join(", ")}`,
        );
      }

      if (validation.warnings.length > 0) {
        console.warn("⚠️ Phase 3: Migration warnings:", validation.warnings);
      }
    }

    // Perform health check
    const healthCheck = await this.performHealthCheck();
    this.migrationState.healthChecks.push(healthCheck);

    if (!healthCheck.webSocketSupported) {
      throw new Error("WebSocket not supported in this environment");
    }

    // Enable WebSocket mode
    setFeatureFlag("WEBSOCKET_STAFF_MANAGEMENT", true);
    this.migrationState.phase = "Phase 3";
    this.migrationState.webSocketEnabled = true;
    this.migrationState.rollbackReason = null;

    this.saveMigrationState();
    this.notifyListeners("migrated_to_websocket");

    console.log("✅ Phase 3: Successfully migrated to WebSocket mode");
    return true;
  }

  /**
   * Rollback to Phase 2 Enhanced mode
   */
  async rollbackToEnhanced(reason = "manual_rollback") {
    console.log(`🔄 Phase 3: Rolling back to Enhanced mode - ${reason}`);

    this.migrationState.lastMigration = {
      timestamp: new Date().toISOString(),
      direction: "to_enhanced",
      reason,
    };

    // Disable WebSocket mode
    setFeatureFlag("WEBSOCKET_STAFF_MANAGEMENT", false);
    this.migrationState.phase = "Phase 2";
    this.migrationState.webSocketEnabled = false;
    this.migrationState.rollbackReason = reason;

    this.saveMigrationState();
    this.notifyListeners("rolled_back_to_enhanced");

    console.log("✅ Phase 3: Successfully rolled back to Enhanced mode");
    return true;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      webSocketSupported: typeof WebSocket !== "undefined",
      localStorageAvailable: false,
      goServerReachable: false,
      overallHealth: "unknown",
    };

    // Test localStorage
    try {
      const testKey = "health_check_test";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      healthCheck.localStorageAvailable = true;
    } catch (error) {
      console.warn("⚠️ localStorage not available:", error);
    }

    // Test Go server connectivity (simplified)
    if (healthCheck.webSocketSupported) {
      try {
        // This would be expanded to actually test the connection
        // For now, we'll just check if the environment suggests it should be available
        healthCheck.goServerReachable = process.env.NODE_ENV === "development";
      } catch (error) {
        console.warn("⚠️ Cannot reach Go server:", error);
      }
    }

    // Determine overall health
    if (healthCheck.webSocketSupported && healthCheck.localStorageAvailable) {
      healthCheck.overallHealth = healthCheck.goServerReachable
        ? "excellent"
        : "good";
    } else {
      healthCheck.overallHealth = "poor";
    }

    return healthCheck;
  }

  /**
   * Subscribe to migration events
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback,
      );
    };
  }

  notifyListeners(event) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, this.migrationState);
      } catch (error) {
        console.error("❌ Migration listener error:", error);
      }
    });
  }

  /**
   * Get current migration status
   */
  getStatus() {
    return {
      ...this.migrationState,
      currentFeatureFlags: {
        websocketStaffManagement: FEATURE_FLAGS.WEBSOCKET_STAFF_MANAGEMENT,
        websocketEnabled: FEATURE_FLAGS.WEBSOCKET_ENABLED,
        goBackendIntegration: FEATURE_FLAGS.GO_BACKEND_INTEGRATION,
      },
    };
  }

  /**
   * Emergency reset
   */
  emergencyReset() {
    console.warn("🚨 Phase 3: Emergency migration reset initiated");
    emergencyRollback("migration_emergency_reset");
    this.migrationState = this.getDefaultState();
    this.saveMigrationState();
    this.notifyListeners("emergency_reset");
  }
}

// Create global migration manager instance
export const phase3MigrationManager = new MigrationManager();

/**
 * React hook for migration management
 */
export const useMigrationManager = () => {
  const [status, setStatus] = useState(phase3MigrationManager.getStatus());

  useEffect(() => {
    const unsubscribe = phase3MigrationManager.subscribe((event, newState) => {
      setStatus(phase3MigrationManager.getStatus());
    });

    return unsubscribe;
  }, []);

  return {
    status,
    migrateToWebSocket: (staffData) =>
      phase3MigrationManager.migrateToWebSocket(staffData),
    rollbackToEnhanced: (reason) =>
      phase3MigrationManager.rollbackToEnhanced(reason),
    performHealthCheck: () => phase3MigrationManager.performHealthCheck(),
    emergencyReset: () => phase3MigrationManager.emergencyReset(),
  };
};

// Development utilities
if (process.env.NODE_ENV === "development") {
  window.phase3MigrationManager = phase3MigrationManager;
  window.validateMigrationData = validateMigrationData;
  console.log(
    "🔧 Phase 3: Migration utilities available at window.phase3MigrationManager",
  );
}

export default phase3MigrationManager;
