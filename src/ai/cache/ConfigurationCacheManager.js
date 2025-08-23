/**
 * ConfigurationCacheManager.js
 *
 * Smart caching system for AI system configurations to prevent main thread blocking.
 * Pre-fetches and caches system settings, constraints, and business rules.
 * Only refreshes when settings actually change, not every AI assistant run.
 */

class ConfigurationCacheManager {
  constructor() {
    this.cache = new Map();
    this.lastCacheTime = null;
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.isInitialized = false;
    this.initPromise = null;

    // Configuration change listeners
    this.changeListeners = new Set();

    // Cache keys for different configuration types
    this.CACHE_KEYS = {
      STAFF_GROUPS: "staff_groups",
      DAILY_LIMITS: "daily_limits",
      PRIORITY_RULES: "priority_rules",
      BUSINESS_RULES: "business_rules",
      CONSTRAINT_CONFIG: "constraint_config",
      SYSTEM_SETTINGS: "system_settings",
      FULL_CONFIG: "full_configuration",
    };

    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      configFetches: 0,
      lastFetchTime: null,
      averageFetchTime: 0,
    };
  }

  /**
   * Initialize the cache manager and pre-load configurations
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

    console.log("🔄 Initializing Configuration Cache Manager...");
    const startTime = Date.now();

    try {
      // Pre-load all critical configurations
      await this.preloadAllConfigurations();

      // Set up change detection
      this.setupChangeDetection();

      this.isInitialized = true;
      this.lastCacheTime = Date.now();

      const initTime = Date.now() - startTime;
      console.log(
        `✅ Configuration Cache Manager initialized in ${initTime}ms`,
      );
    } catch (error) {
      console.error(
        "❌ Failed to initialize Configuration Cache Manager:",
        error,
      );
      throw error;
    }
  }

  /**
   * Pre-load all system configurations into cache
   */
  async preloadAllConfigurations() {
    console.log("📦 Pre-loading all system configurations...");

    const startTime = Date.now();

    try {
      // Load constraint engine configurations with timeout protection
      const { getAllConfigurations } = await import(
        "../constraints/ConstraintEngine"
      );

      // Add timeout to prevent infinite blocking
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Configuration loading timeout")),
          10000,
        ),
      );

      const configurations = await Promise.race([
        getAllConfigurations(),
        timeoutPromise,
      ]);

      // Cache individual configuration types
      this.cache.set(
        this.CACHE_KEYS.STAFF_GROUPS,
        configurations.staffGroups || {},
      );
      this.cache.set(
        this.CACHE_KEYS.DAILY_LIMITS,
        configurations.dailyLimits || {},
      );
      this.cache.set(
        this.CACHE_KEYS.PRIORITY_RULES,
        configurations.priorityRules || [],
      );
      this.cache.set(
        this.CACHE_KEYS.BUSINESS_RULES,
        configurations.businessRules || {},
      );
      this.cache.set(
        this.CACHE_KEYS.CONSTRAINT_CONFIG,
        configurations.constraintConfig || {},
      );
      this.cache.set(
        this.CACHE_KEYS.SYSTEM_SETTINGS,
        configurations.systemSettings || {},
      );

      // Cache the full configuration object
      this.cache.set(this.CACHE_KEYS.FULL_CONFIG, configurations);

      const loadTime = Date.now() - startTime;
      this.metrics.configFetches++;
      this.metrics.lastFetchTime = Date.now();
      this.updateAverageFetchTime(loadTime);

      console.log(`✅ Pre-loaded configurations in ${loadTime}ms`);
      console.log("📋 Cached configurations:", {
        staffGroups: Object.keys(configurations.staffGroups || {}).length,
        dailyLimits: Object.keys(configurations.dailyLimits || {}).length,
        priorityRules: (configurations.priorityRules || []).length,
        businessRules: Object.keys(configurations.businessRules || {}).length,
      });
    } catch (error) {
      console.warn(
        "⚠️ Failed to pre-load configurations, using fallbacks:",
        error,
      );
      // Set empty fallback configurations instead of throwing
      this.setFallbackConfigurations();

      const loadTime = Date.now() - startTime;
      this.metrics.configFetches++;
      this.metrics.lastFetchTime = Date.now();
      this.updateAverageFetchTime(loadTime);

      console.log(`📦 Fallback configurations loaded in ${loadTime}ms`);

      // Don't throw error - graceful degradation
      return;
    }
  }

  /**
   * Get configuration from cache (instant access)
   */
  getConfiguration(type = "full") {
    const cacheKey =
      type === "full"
        ? this.CACHE_KEYS.FULL_CONFIG
        : this.CACHE_KEYS[type.toUpperCase().replace(/[^A-Z_]/g, "_")];

    if (!cacheKey) {
      console.warn(`Unknown configuration type: ${type}`);
      return null;
    }

    if (this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      const config = this.cache.get(cacheKey);
      console.log(
        `⚡ Cache HIT for ${type} (${this.metrics.cacheHits} hits total)`,
      );
      return config;
    }

    this.metrics.cacheMisses++;
    console.warn(
      `💥 Cache MISS for ${type} (${this.metrics.cacheMisses} misses total)`,
    );
    return null;
  }

  /**
   * Get all configurations (optimized for AI processing)
   */
  getAllConfigurations() {
    const fullConfig = this.getConfiguration("full");

    if (!fullConfig) {
      console.warn("⚠️ No cached configurations available, using fallback");
      return this.getFallbackConfiguration();
    }

    return {
      ...fullConfig,
      _cached: true,
      _cacheTime: this.lastCacheTime,
      _performance: {
        cacheHits: this.metrics.cacheHits,
        averageFetchTime: this.metrics.averageFetchTime,
      },
    };
  }

  /**
   * Refresh cache when settings change
   */
  async refreshCache(changedType = null) {
    console.log(
      `🔄 Refreshing configuration cache${changedType ? ` for ${changedType}` : ""}...`,
    );

    const startTime = Date.now();

    try {
      if (changedType && changedType !== "full") {
        // Selective refresh for specific configuration type
        await this.refreshSpecificConfiguration(changedType);
      } else {
        // Full refresh
        await this.preloadAllConfigurations();
      }

      // Notify all listeners about the change
      this.notifyChangeListeners(changedType || "full");

      const refreshTime = Date.now() - startTime;
      console.log(`✅ Cache refreshed in ${refreshTime}ms`);
    } catch (error) {
      console.error("❌ Failed to refresh cache:", error);
      throw error;
    }
  }

  /**
   * Refresh specific configuration type
   */
  async refreshSpecificConfiguration(type) {
    const cacheKey =
      this.CACHE_KEYS[type.toUpperCase().replace(/[^A-Z_]/g, "_")];
    if (!cacheKey) return;

    try {
      const { getSpecificConfiguration } = await import(
        "../constraints/ConstraintEngine"
      );
      const config = await getSpecificConfiguration(type);

      this.cache.set(cacheKey, config);

      // Update full configuration cache as well
      const fullConfig = this.cache.get(this.CACHE_KEYS.FULL_CONFIG) || {};
      fullConfig[type] = config;
      this.cache.set(this.CACHE_KEYS.FULL_CONFIG, fullConfig);
    } catch (error) {
      console.error(`Failed to refresh ${type} configuration:`, error);
    }
  }

  /**
   * Setup change detection for automatic cache invalidation
   */
  setupChangeDetection() {
    // Listen for storage changes (when settings are modified)
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", (event) => {
        if (this.isConfigurationKey(event.key)) {
          console.log(`🔄 Detected configuration change: ${event.key}`);
          this.refreshCache();
        }
      });
    }

    // Setup periodic cache validation (every 5 minutes)
    setInterval(
      () => {
        if (this.shouldValidateCache()) {
          this.validateCacheIntegrity();
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Check if cache should be validated
   */
  shouldValidateCache() {
    if (!this.lastCacheTime) return true;
    const now = Date.now();
    return now - this.lastCacheTime > this.cacheTimeout;
  }

  /**
   * Validate cache integrity and refresh if needed
   */
  async validateCacheIntegrity() {
    console.log("🔍 Validating cache integrity...");

    try {
      // Check if configurations have changed in storage
      const { getConfigurationChecksum } = await import(
        "../constraints/ConstraintEngine"
      );
      const currentChecksum = await getConfigurationChecksum();
      const cachedConfig = this.cache.get(this.CACHE_KEYS.FULL_CONFIG);

      if (
        !cachedConfig ||
        !cachedConfig._checksum ||
        cachedConfig._checksum !== currentChecksum
      ) {
        console.log("🔄 Configuration changes detected, refreshing cache...");
        await this.refreshCache();
      } else {
        console.log("✅ Cache integrity validated");
      }
    } catch (error) {
      console.error("❌ Cache validation failed:", error);
      // Refresh cache as a safety measure
      await this.refreshCache();
    }
  }

  /**
   * Check if a storage key is related to configurations
   */
  isConfigurationKey(key) {
    if (!key) return false;

    const configKeys = [
      "staffGroups",
      "dailyLimits",
      "priorityRules",
      "businessRules",
      "systemSettings",
      "constraints",
    ];

    return configKeys.some((configKey) => key.includes(configKey));
  }

  /**
   * Add change listener for configuration updates
   */
  addChangeListener(callback) {
    this.changeListeners.add(callback);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(callback) {
    this.changeListeners.delete(callback);
  }

  /**
   * Notify all change listeners
   */
  notifyChangeListeners(changedType) {
    this.changeListeners.forEach((callback) => {
      try {
        callback(changedType);
      } catch (error) {
        console.error("Error in configuration change listener:", error);
      }
    });
  }

  /**
   * Set fallback configurations for error cases
   */
  setFallbackConfigurations() {
    const fallback = {
      staffGroups: {},
      dailyLimits: {},
      priorityRules: [],
      businessRules: {},
      constraintConfig: {},
      systemSettings: {},
      _fallback: true,
    };

    Object.values(this.CACHE_KEYS).forEach((key) => {
      this.cache.set(key, key === this.CACHE_KEYS.FULL_CONFIG ? fallback : {});
    });
  }

  /**
   * Get fallback configuration
   */
  getFallbackConfiguration() {
    return {
      staffGroups: {},
      dailyLimits: {},
      priorityRules: [],
      businessRules: {},
      constraintConfig: {},
      systemSettings: {},
      _fallback: true,
    };
  }

  /**
   * Update average fetch time metric
   */
  updateAverageFetchTime(newTime) {
    if (this.metrics.averageFetchTime === 0) {
      this.metrics.averageFetchTime = newTime;
    } else {
      this.metrics.averageFetchTime =
        (this.metrics.averageFetchTime + newTime) / 2;
    }
  }

  /**
   * Get cache performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      lastCacheTime: this.lastCacheTime,
      cacheHitRate:
        this.metrics.cacheHits /
          (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
    };
  }

  /**
   * Clear all cache (for testing/debugging)
   */
  clearCache() {
    this.cache.clear();
    this.lastCacheTime = null;
    console.log("🧹 Configuration cache cleared");
  }

  /**
   * Force immediate cache refresh
   */
  async forceRefresh() {
    console.log("🚀 Forcing immediate cache refresh...");
    this.lastCacheTime = null;
    await this.refreshCache();
  }

  /**
   * Check if cache is healthy and ready
   */
  isHealthy() {
    return (
      this.isInitialized &&
      this.cache.has(this.CACHE_KEYS.FULL_CONFIG) &&
      this.lastCacheTime &&
      Date.now() - this.lastCacheTime < this.cacheTimeout
    );
  }
}

// Export singleton instance
export const configurationCache = new ConfigurationCacheManager();
export default configurationCache;
