/**
 * Optimized localStorage utilities for shift schedule management
 * Features:
 * - Period-based storage keys for better performance
 * - Memory caching to reduce localStorage reads
 * - Debounced batch writes to minimize localStorage operations
 * - Storage quota monitoring and graceful degradation
 * - Backward compatibility with existing data format
 */

// Memory cache for frequently accessed data
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

// Write queue for debounced operations
const writeQueue = new Map();
let writeTimeoutId = null;
const WRITE_DEBOUNCE_DELAY = 500; // 500ms debounce

// Storage quota monitoring
let storageQuotaExceeded = false;
let lastQuotaCheck = 0;
const QUOTA_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

/**
 * Storage key generators for period-based architecture
 */
export const STORAGE_KEYS = {
  // Period-based schedule data: "schedule-0", "schedule-1", etc.
  getScheduleKey: (periodIndex) => `schedule-${periodIndex}`,

  // Period-based staff data: "staff-0", "staff-1", etc.
  getStaffKey: (periodIndex) => `staff-${periodIndex}`,

  // Metadata keys
  CURRENT_PERIOD: "current-period-index",
  CACHE_VERSION: "cache-version",
  STORAGE_METADATA: "storage-metadata",

  // Legacy keys for migration
  LEGACY_SCHEDULE: "shift-schedule-data",
  LEGACY_STAFF: "staff-by-month-data",
  LEGACY_CURRENT: "current-month-index",
};

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(data, timestamp = Date.now()) {
    this.data = data;
    this.timestamp = timestamp;
    this.accessed = timestamp;
  }

  isExpired(ttl = CACHE_TTL) {
    return Date.now() - this.timestamp > ttl;
  }

  touch() {
    this.accessed = Date.now();
  }
}

/**
 * Storage quota monitoring and management
 */
export const storageQuota = {
  /**
   * Check localStorage usage and availability
   */
  checkQuota() {
    const now = Date.now();
    if (now - lastQuotaCheck < QUOTA_CHECK_INTERVAL && storageQuotaExceeded) {
      return { available: false, exceeded: true, usage: null };
    }

    lastQuotaCheck = now;

    try {
      // Estimate storage usage
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        totalSize += key.length + (value ? value.length : 0);
      }

      // Test write to check if quota is exceeded
      const testKey = "_quota_test_" + Date.now();
      const testData = "test";
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);

      storageQuotaExceeded = false;

      return {
        available: true,
        exceeded: false,
        usage: {
          totalSize,
          estimatedMB: (totalSize / (1024 * 1024)).toFixed(2),
        },
      };
    } catch (error) {
      storageQuotaExceeded = true;
      console.warn("❌ localStorage quota exceeded or unavailable:", error);

      return {
        available: false,
        exceeded: true,
        usage: null,
        error: error.message,
      };
    }
  },

  /**
   * Clean up old cache entries and unused data
   */
  cleanup() {
    try {
      // Clean up expired cache entries
      memoryCache.forEach((entry, key) => {
        if (entry.isExpired()) {
          memoryCache.delete(key);
        }
      });

      // Clean up old localStorage test keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("_quota_test_")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore cleanup errors
        }
      });

      // Development mode only: log cleanup results
      if (process.env.NODE_ENV === "development") {
        // Cleanup completed silently
      }
    } catch (error) {
      console.warn("⚠️ Storage cleanup failed:", error);
    }
  },

  /**
   * Get storage usage statistics
   */
  getUsageStats() {
    const quota = this.checkQuota();
    const cacheStats = {
      entries: memoryCache.size,
      oldestEntry: Math.min(
        ...Array.from(memoryCache.values()).map((e) => e.timestamp),
      ),
      newestEntry: Math.max(
        ...Array.from(memoryCache.values()).map((e) => e.timestamp),
      ),
    };

    return {
      localStorage: quota,
      memoryCache: cacheStats,
      writeQueue: {
        pending: writeQueue.size,
        hasTimeout: writeTimeoutId !== null,
      },
    };
  },
};

/**
 * Memory cache management
 */
export const memCache = {
  /**
   * Get data from memory cache
   */
  get(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (entry.isExpired()) {
      memoryCache.delete(key);
      return null;
    }

    entry.touch();
    return entry.data;
  },

  /**
   * Set data in memory cache
   */
  set(key, data) {
    memoryCache.set(key, new CacheEntry(data));

    // Prevent memory cache from growing too large
    if (memoryCache.size > 50) {
      this.evictOldest();
    }
  },

  /**
   * Remove from memory cache
   */
  delete(key) {
    return memoryCache.delete(key);
  },

  /**
   * Clear all cache entries
   */
  clear() {
    memoryCache.clear();
  },

  /**
   * Evict oldest cache entries
   */
  evictOldest() {
    const entries = Array.from(memoryCache.entries());
    entries.sort((a, b) => a[1].accessed - b[1].accessed);

    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      memoryCache.delete(entries[i][0]);
    }
  },

  /**
   * Invalidate cache for specific period
   */
  invalidatePeriod(periodIndex) {
    const scheduleKey = STORAGE_KEYS.getScheduleKey(periodIndex);
    const staffKey = STORAGE_KEYS.getStaffKey(periodIndex);

    this.delete(scheduleKey);
    this.delete(staffKey);
  },
};

/**
 * Raw localStorage operations with error handling
 */
const rawStorage = {
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`⚠️ Failed to read localStorage key "${key}":`, error);
      return null;
    }
  },

  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      if (error.name === "QuotaExceededError" || error.code === 22) {
        storageQuotaExceeded = true;
        console.error(`❌ localStorage quota exceeded while saving "${key}"`);

        // Attempt cleanup and retry once
        storageQuota.cleanup();
        try {
          localStorage.setItem(key, JSON.stringify(data));
          storageQuotaExceeded = false;
          return true;
        } catch (retryError) {
          console.error(
            `❌ localStorage save failed after cleanup for "${key}":`,
            retryError,
          );
        }
      }
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to remove localStorage key "${key}":`, error);
      return false;
    }
  },
};

/**
 * Debounced batch write operations
 */
export const batchWriter = {
  /**
   * Queue a write operation
   */
  queueWrite(key, data) {
    // Check if this is staff data that might have been immediately written
    // If so, verify that queued data is not staler than what's already in localStorage
    if (key.startsWith("staff-")) {
      try {
        const currentStored = rawStorage.get(key);
        if (
          currentStored &&
          Array.isArray(currentStored) &&
          Array.isArray(data)
        ) {
          // Compare timestamps if available to prevent overwriting newer data with older data
          const currentTimestamp = Math.max(
            ...currentStored.map((s) => s.lastModified || 0),
          );
          const queuedTimestamp = Math.max(
            ...data.map((s) => s.lastModified || 0),
          );

          if (currentTimestamp > queuedTimestamp) {
            if (process.env.NODE_ENV === "development") {
              // Skipping queued write - localStorage has newer data
            }
            return; // Don't queue this write as localStorage already has newer data
          }
        }
      } catch (error) {
        // If comparison fails, proceed with queued write as fallback
        console.warn(
          `⚠️ Failed to compare staff data timestamps for ${key}:`,
          error,
        );
      }
    }

    writeQueue.set(key, data);

    // Cancel existing timeout
    if (writeTimeoutId) {
      clearTimeout(writeTimeoutId);
    }

    // Set new timeout for batch write
    writeTimeoutId = setTimeout(() => {
      this.flushWrites();
    }, WRITE_DEBOUNCE_DELAY);
  },

  /**
   * Force flush all queued writes
   */
  flushWrites() {
    if (writeQueue.size === 0) return;

    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    // Process all queued writes
    writeQueue.forEach((data, key) => {
      if (rawStorage.set(key, data)) {
        // Update memory cache on successful write
        memCache.set(key, data);
        successCount++;
      } else {
        errorCount++;
      }
    });

    const duration = performance.now() - startTime;

    // Only log batch write details in development mode
    if (process.env.NODE_ENV === "development") {
    }

    // Clear queue and timeout
    writeQueue.clear();
    writeTimeoutId = null;
  },

  /**
   * Get pending write count
   */
  getPendingCount() {
    return writeQueue.size;
  },
};

/**
 * High-level storage API with caching and optimization
 */
export const optimizedStorage = {
  /**
   * Get schedule data for a specific period
   */
  getScheduleData(periodIndex) {
    const key = STORAGE_KEYS.getScheduleKey(periodIndex);

    // Try memory cache first
    let data = memCache.get(key);
    if (data !== null) {
      return data;
    }

    // Fallback to localStorage
    data = rawStorage.get(key);
    if (data !== null) {
      memCache.set(key, data);
    }

    return data || {};
  },

  /**
   * Save schedule data for a specific period
   */
  saveScheduleData(periodIndex, data) {
    const key = STORAGE_KEYS.getScheduleKey(periodIndex);

    // Update memory cache immediately
    memCache.set(key, data);

    // Queue for batch write to localStorage
    batchWriter.queueWrite(key, data);
  },

  /**
   * Get staff data for a specific period
   */
  getStaffData(periodIndex) {
    const key = STORAGE_KEYS.getStaffKey(periodIndex);

    // Try memory cache first
    let data = memCache.get(key);
    if (data !== null) {
      return data;
    }

    // Fallback to localStorage
    data = rawStorage.get(key);
    if (data !== null) {
      memCache.set(key, data);
    }

    return data || [];
  },

  /**
   * Save staff data for a specific period
   */
  saveStaffData(periodIndex, data) {
    const key = STORAGE_KEYS.getStaffKey(periodIndex);

    // Update memory cache immediately
    memCache.set(key, data);

    // Staff data is critical - write immediately to localStorage to prevent race conditions
    // This ensures that staff updates are immediately persistent and available for inheritance logic
    const writeSuccess = rawStorage.set(key, data);

    if (!writeSuccess) {
      // If immediate write fails, fall back to queued write
      console.warn(
        `⚠️ Immediate staff data write failed for period ${periodIndex}, queuing for batch write`,
      );
      batchWriter.queueWrite(key, data);
    } else if (process.env.NODE_ENV === "development") {
      // Staff data immediately saved to localStorage
    }
  },

  /**
   * Get current period index
   */
  getCurrentPeriod() {
    const cached = memCache.get(STORAGE_KEYS.CURRENT_PERIOD);
    if (cached !== null) return cached;

    const stored = rawStorage.get(STORAGE_KEYS.CURRENT_PERIOD);
    if (stored !== null) {
      memCache.set(STORAGE_KEYS.CURRENT_PERIOD, stored);
    }

    return stored || 0;
  },

  /**
   * Save current period index
   */
  saveCurrentPeriod(periodIndex) {
    memCache.set(STORAGE_KEYS.CURRENT_PERIOD, periodIndex);
    batchWriter.queueWrite(STORAGE_KEYS.CURRENT_PERIOD, periodIndex);
  },

  /**
   * Clear staff data only for a specific period (keeps schedule data)
   */
  clearStaffData(periodIndex) {
    const staffKey = STORAGE_KEYS.getStaffKey(periodIndex);

    // Clear from memory cache
    memCache.delete(staffKey);

    // Remove from localStorage
    rawStorage.remove(staffKey);

    // Remove from write queue if pending
    writeQueue.delete(staffKey);
  },

  /**
   * Clear all data for a specific period
   */
  clearPeriodData(periodIndex) {
    const scheduleKey = STORAGE_KEYS.getScheduleKey(periodIndex);
    const staffKey = STORAGE_KEYS.getStaffKey(periodIndex);

    // Clear from memory cache
    memCache.delete(scheduleKey);
    memCache.delete(staffKey);

    // Remove from localStorage
    rawStorage.remove(scheduleKey);
    rawStorage.remove(staffKey);

    // Remove from write queue if pending
    writeQueue.delete(scheduleKey);
    writeQueue.delete(staffKey);
  },
};

/**
 * Migration utilities for backward compatibility
 */
export const migrationUtils = {
  /**
   * Check if legacy data exists
   */
  hasLegacyData() {
    return (
      rawStorage.get(STORAGE_KEYS.LEGACY_SCHEDULE) !== null ||
      rawStorage.get(STORAGE_KEYS.LEGACY_STAFF) !== null
    );
  },

  /**
   * Migrate legacy data to new period-based format
   */
  migrateLegacyData() {
    if (process.env.NODE_ENV === "development") {
      // Starting legacy data migration
    }

    const legacySchedule = rawStorage.get(STORAGE_KEYS.LEGACY_SCHEDULE) || {};
    const legacyStaff = rawStorage.get(STORAGE_KEYS.LEGACY_STAFF) || {};
    const legacyCurrent = rawStorage.get(STORAGE_KEYS.LEGACY_CURRENT) || 0;

    let migratedPeriods = 0;

    // Migrate schedule data
    Object.keys(legacySchedule).forEach((periodIndex) => {
      const scheduleData = legacySchedule[periodIndex];
      if (scheduleData && Object.keys(scheduleData).length > 0) {
        optimizedStorage.saveScheduleData(parseInt(periodIndex), scheduleData);
        migratedPeriods++;
      }
    });

    // Migrate staff data
    Object.keys(legacyStaff).forEach((periodIndex) => {
      const staffData = legacyStaff[periodIndex];
      if (staffData && Array.isArray(staffData) && staffData.length > 0) {
        optimizedStorage.saveStaffData(parseInt(periodIndex), staffData);
      }
    });

    // Migrate current period
    if (typeof legacyCurrent === "number") {
      optimizedStorage.saveCurrentPeriod(legacyCurrent);
    }

    // Force flush all migration writes
    batchWriter.flushWrites();

    if (process.env.NODE_ENV === "development") {
      // Migration completed
    }

    return { migratedPeriods, currentPeriod: legacyCurrent };
  },

  /**
   * Clean up legacy data after successful migration
   */
  cleanupLegacyData() {
    if (process.env.NODE_ENV === "development") {
      // Cleaning up legacy storage keys
    }

    const keysToRemove = [
      STORAGE_KEYS.LEGACY_SCHEDULE,
      STORAGE_KEYS.LEGACY_STAFF,
      STORAGE_KEYS.LEGACY_CURRENT,
      // Additional legacy keys mentioned in the original code
      "shift_schedules_by_month",
      "shift_staff_by_month",
      "shift_schedule_data",
      "shift_staff_members",
    ];

    let removedCount = 0;
    keysToRemove.forEach((key) => {
      if (rawStorage.remove(key)) {
        removedCount++;
      }
    });

    if (process.env.NODE_ENV === "development") {
      // Legacy cleanup completed
    }
  },

  /**
   * Clean up malformed cache keys caused by missing periodIndex parameter
   * Fixes issue where saveScheduleData() was called without periodIndex,
   * creating keys like "schedule-[object Object]" instead of "schedule-0"
   */
  cleanupMalformedCacheKeys() {
    const malformedPatterns = [
      "schedule-[object Object]",
      "staff-[object Object]",
      "schedule-undefined",
      "staff-undefined",
      "schedule-null",
      "staff-null",
    ];

    let removedCount = 0;
    const removedKeys = [];

    malformedPatterns.forEach((key) => {
      if (rawStorage.remove(key)) {
        removedCount++;
        removedKeys.push(key);
      }
    });

    // Also scan for any keys that might have similar issues
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        // Check for keys with [object in them (malformed serialization)
        if (key.includes("[object") || key.includes("undefined") || key.includes("null")) {
          // Only remove if it looks like one of our cache keys
          if (key.startsWith("schedule-") || key.startsWith("staff-")) {
            if (rawStorage.remove(key)) {
              removedCount++;
              removedKeys.push(key);
            }
          }
        }
      });
    } catch (error) {
      console.warn("⚠️ Could not scan localStorage for malformed keys:", error.message);
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} malformed cache key(s):`, removedKeys);
    }

    return { removedCount, removedKeys };
  },

  /**
   * Verify migration integrity
   */
  verifyMigration() {
    const legacySchedule = rawStorage.get(STORAGE_KEYS.LEGACY_SCHEDULE) || {};
    const errors = [];

    // Check that all legacy periods have been migrated
    Object.keys(legacySchedule).forEach((periodIndex) => {
      const legacyData = legacySchedule[periodIndex];
      const migratedData = optimizedStorage.getScheduleData(
        parseInt(periodIndex),
      );

      if (Object.keys(legacyData).length > Object.keys(migratedData).length) {
        errors.push(`Period ${periodIndex}: missing data in migration`);
      }
    });

    return { success: errors.length === 0, errors };
  },
};

/**
 * Performance monitoring and diagnostics
 */
export const performanceMonitor = {
  /**
   * Get comprehensive performance metrics
   */
  getMetrics() {
    const storageStats = storageQuota.getUsageStats();

    return {
      ...storageStats,
      migration: {
        hasLegacyData: migrationUtils.hasLegacyData(),
      },
      performance: {
        cacheHitRate: this.getCacheHitRate(),
        averageWriteDelay: WRITE_DEBOUNCE_DELAY,
        quotaExceeded: storageQuotaExceeded,
      },
    };
  },

  /**
   * Calculate cache hit rate (placeholder - would need tracking)
   */
  getCacheHitRate() {
    // This would require tracking cache hits vs misses
    // For now, return estimated based on cache size
    return memoryCache.size > 0 ? 0.85 : 0;
  },

  /**
   * Log performance summary (development mode only)
   */
  logSummary() {
    // Performance summary logging disabled
  },
};

// Automatic cleanup interval
setInterval(
  () => {
    storageQuota.cleanup();
  },
  5 * 60 * 1000,
); // Every 5 minutes

// Flush writes on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    batchWriter.flushWrites();
  });
}
