/**
 * useConfigurationCache.js
 *
 * React hook for managing configuration cache operations.
 * Components use this to trigger cache refresh when settings change.
 */

import { useCallback, useEffect, useState } from "react";

// Lazy import to prevent bundling AI code in main chunk
const loadConfigurationCache = async () => {
  const module = await import("../ai/cache/ConfigurationCacheManager");
  return module.configurationCache;
};

export const useConfigurationCache = () => {
  const [cacheStatus, setCacheStatus] = useState("unknown");
  const [metrics, setMetrics] = useState(null);

  // Get cache health status
  const getCacheStatus = useCallback(async () => {
    try {
      const configurationCache = await loadConfigurationCache();
      if (!configurationCache.isHealthy()) {
        setCacheStatus("initializing");
      } else {
        setCacheStatus("ready");
      }

      setMetrics(configurationCache.getMetrics());
    } catch (error) {
      console.warn("⚠️ Failed to get cache status:", error);
      setCacheStatus("error");
    }
  }, []);

  // Refresh cache when settings change
  const refreshCache = useCallback(async (settingType = null) => {
    try {
      setCacheStatus("refreshing");
      console.log(
        `🔄 Refreshing configuration cache${settingType ? ` for ${settingType}` : ""}...`,
      );

      const configurationCache = await loadConfigurationCache();
      await configurationCache.refreshCache(settingType);

      setCacheStatus("ready");
      setMetrics(configurationCache.getMetrics());

      console.log("✅ Configuration cache refreshed successfully");
    } catch (error) {
      console.error("❌ Failed to refresh configuration cache:", error);
      setCacheStatus("error");
    }
  }, []);

  // Force immediate cache refresh
  const forceRefresh = useCallback(async () => {
    try {
      setCacheStatus("force-refreshing");
      console.log("🚀 Force refreshing configuration cache...");

      const configurationCache = await loadConfigurationCache();
      await configurationCache.forceRefresh();

      setCacheStatus("ready");
      setMetrics(configurationCache.getMetrics());

      console.log("✅ Configuration cache force refreshed");
    } catch (error) {
      console.error("❌ Failed to force refresh configuration cache:", error);
      setCacheStatus("error");
    }
  }, []);

  // Get cached configuration
  const getConfiguration = useCallback(async (type = "full") => {
    try {
      const configurationCache = await loadConfigurationCache();
      return configurationCache.getConfiguration(type);
    } catch (error) {
      console.error(`❌ Failed to get ${type} configuration:`, error);
      return null;
    }
  }, []);

  // Check if cache is ready
  const isCacheReady = useCallback(async () => {
    try {
      const configurationCache = await loadConfigurationCache();
      return configurationCache.isHealthy();
    } catch (error) {
      console.warn("⚠️ Failed to check cache readiness:", error);
      return false;
    }
  }, []);

  // Initialize cache status on mount
  useEffect(() => {
    getCacheStatus();

    // Update status periodically
    const interval = setInterval(getCacheStatus, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [getCacheStatus]);

  return {
    // Status
    cacheStatus,
    metrics,
    isCacheReady,

    // Actions
    refreshCache,
    forceRefresh,
    getConfiguration,

    // Utils
    getCacheStatus,
  };
};

// Helper hook for settings components
export const useSettingsCache = () => {
  const { refreshCache, cacheStatus } = useConfigurationCache();

  // Call this when any setting is saved
  const onSettingSaved = useCallback(
    async (settingType) => {
      console.log(`💾 Setting saved: ${settingType}, refreshing cache...`);
      await refreshCache(settingType);
    },
    [refreshCache],
  );

  // Call this when multiple settings are saved
  const onSettingsBulkSaved = useCallback(async () => {
    console.log("💾 Multiple settings saved, refreshing full cache...");
    await refreshCache();
  }, [refreshCache]);

  return {
    onSettingSaved,
    onSettingsBulkSaved,
    cacheStatus,
    isRefreshing:
      cacheStatus === "refreshing" || cacheStatus === "force-refreshing",
  };
};

export default useConfigurationCache;
