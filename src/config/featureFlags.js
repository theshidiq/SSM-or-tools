/**
 * Feature Flag System for Incremental Go + WebSocket Integration
 * Enables safe rollback and gradual feature migration
 */

import { useState, useEffect } from 'react';

// Environment-based feature flags
export const FEATURE_FLAGS = {
  WEBSOCKET_ENABLED: process.env.REACT_APP_WEBSOCKET_ENABLED === 'true',
  OPTIMISTIC_UPDATES: process.env.REACT_APP_OPTIMISTIC_UPDATES === 'true',
  CONFLICT_RESOLUTION: process.env.REACT_APP_CONFLICT_RESOLUTION === 'true',
  GO_BACKEND_INTEGRATION: process.env.REACT_APP_GO_BACKEND === 'true',
  ENHANCED_LOGGING: process.env.NODE_ENV === 'development' || process.env.REACT_APP_DEBUG_MODE === 'true',
};

// Emergency rollback function
export const emergencyRollback = (reason = 'manual_rollback') => {
  console.warn(`🚨 Emergency rollback initiated: ${reason}`);

  // Force Supabase-only mode
  localStorage.setItem('FORCE_SUPABASE_ONLY', 'true');
  localStorage.setItem('ROLLBACK_REASON', reason);
  localStorage.setItem('ROLLBACK_TIMESTAMP', new Date().toISOString());

  // Disable all advanced features
  localStorage.setItem('WEBSOCKET_ENABLED', 'false');
  localStorage.setItem('OPTIMISTIC_UPDATES', 'false');
  localStorage.setItem('CONFLICT_RESOLUTION', 'false');
  localStorage.setItem('GO_BACKEND_INTEGRATION', 'false');

  // Clear any cached data that might be inconsistent
  localStorage.removeItem('pending_operations');
  localStorage.removeItem('websocket_cache');

  // Reload to apply changes
  window.location.reload();
};

// Runtime feature flag management
export const useFeatureFlag = (flagName) => {
  const [enabled, setEnabled] = useState(() => {
    // Check for emergency rollback
    if (localStorage.getItem('FORCE_SUPABASE_ONLY') === 'true') {
      return false;
    }

    // Check for runtime override
    const runtimeValue = localStorage.getItem(flagName);
    if (runtimeValue !== null) {
      return runtimeValue === 'true';
    }

    // Use default from environment
    return FEATURE_FLAGS[flagName] || false;
  });

  useEffect(() => {
    // Listen for runtime flag changes
    const handleFlagChange = (event) => {
      if (event.detail.flag === flagName) {
        setEnabled(event.detail.enabled);
        localStorage.setItem(flagName, event.detail.enabled.toString());
      }
    };

    // Listen for emergency rollback
    const handleEmergencyRollback = () => {
      setEnabled(false);
    };

    window.addEventListener('feature-flag-change', handleFlagChange);
    window.addEventListener('emergency-rollback', handleEmergencyRollback);

    return () => {
      window.removeEventListener('feature-flag-change', handleFlagChange);
      window.removeEventListener('emergency-rollback', handleEmergencyRollback);
    };
  }, [flagName]);

  return enabled;
};

// Runtime feature flag control
export const setFeatureFlag = (flagName, enabled) => {
  const event = new CustomEvent('feature-flag-change', {
    detail: { flag: flagName, enabled }
  });
  window.dispatchEvent(event);

  if (FEATURE_FLAGS.ENHANCED_LOGGING) {
    console.log(`🔧 Feature flag ${flagName} set to:`, enabled);
  }
};

// System health checker
export const checkSystemHealth = () => {
  const health = {
    status: 'healthy',
    checks: {},
    warnings: [],
    errors: []
  };

  // Check if in rollback mode
  if (localStorage.getItem('FORCE_SUPABASE_ONLY') === 'true') {
    health.status = 'rollback_mode';
    health.warnings.push({
      component: 'system',
      message: `Emergency rollback active: ${localStorage.getItem('ROLLBACK_REASON')}`,
      timestamp: localStorage.getItem('ROLLBACK_TIMESTAMP')
    });
  }

  // Check feature flag consistency
  const enabledFlags = Object.entries(FEATURE_FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([flag, _]) => flag);

  if (enabledFlags.length > 0) {
    health.checks.activeFeatures = enabledFlags;
  }

  // Check localStorage for issues
  try {
    const testKey = 'health_check_test';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    health.checks.localStorage = 'operational';
  } catch (error) {
    health.status = 'degraded';
    health.errors.push({
      component: 'localStorage',
      message: 'LocalStorage access failed',
      error: error.message
    });
  }

  return health;
};

// Development utilities (only available in development)
if (FEATURE_FLAGS.ENHANCED_LOGGING) {
  // Expose debugging utilities to window
  window.debugUtils = {
    featureFlags: FEATURE_FLAGS,
    setFeatureFlag,
    emergencyRollback,
    checkSystemHealth,
    clearRollback: () => {
      localStorage.removeItem('FORCE_SUPABASE_ONLY');
      localStorage.removeItem('ROLLBACK_REASON');
      localStorage.removeItem('ROLLBACK_TIMESTAMP');
      window.location.reload();
    }
  };

  console.log('🔧 Debug utilities available at window.debugUtils');
}

export default FEATURE_FLAGS;