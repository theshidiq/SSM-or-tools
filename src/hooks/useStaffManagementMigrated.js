/**
 * Phase 3: Migration Strategy Hook
 * Feature flag for gradual migration between complex and simplified staff management
 * Enables safe rollout of WebSocket-based staff management
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { useFeatureFlag } from '../config/featureFlags';
import useWebSocketStaff from './useWebSocketStaff';
import { useStaffManagementEnhanced } from './useStaffManagementEnhanced';

/**
 * Migration hook that switches between old complex system and new WebSocket system
 * based on feature flag configuration
 */
export const useStaffManagement = (currentMonthIndex, options = {}) => {
  const enableWebSocketMode = useFeatureFlag('WEBSOCKET_STAFF_MANAGEMENT');
  const enhancedLogging = useFeatureFlag('ENHANCED_LOGGING');

  // Call both hooks but only return the active one
  const webSocketResult = useWebSocketStaff(currentMonthIndex);
  const enhancedResult = useStaffManagementEnhanced(currentMonthIndex, options);

  if (enhancedLogging) {
    console.log(`🔧 Phase 6: Staff Management Mode - ${enableWebSocketMode ? 'WebSocket' : 'Enhanced'}`);
  }

  if (enableWebSocketMode) {
    // Phase 3: New simplified WebSocket approach
    if (enhancedLogging) {
      console.log('🚀 Phase 6: Using WebSocket Staff Management');
    }
    return webSocketResult;
  } else {
    // Phase 2: Existing complex enhanced approach
    if (enhancedLogging) {
      console.log('🔄 Phase 6: Using Enhanced Staff Management (fallback)');
    }
    return enhancedResult;
  }
};

/**
 * Migration utilities for debugging and system health
 */
export const getMigrationStatus = () => {
  // Check feature flags directly from environment/localStorage instead of using hooks
  const webSocketEnabled =
    localStorage.getItem('WEBSOCKET_STAFF_MANAGEMENT') === 'true' ||
    process.env.REACT_APP_WEBSOCKET_STAFF_MANAGEMENT === 'true';

  return {
    mode: webSocketEnabled ? 'websocket' : 'enhanced',
    webSocketEnabled,
    phase: webSocketEnabled ? 'Phase 6' : 'Phase 2',
    features: {
      realTimeSync: webSocketEnabled,
      complexStateManagement: !webSocketEnabled,
      optimisticUpdates: !webSocketEnabled,
      conflictResolution: !webSocketEnabled,
      offlineSupport: !webSocketEnabled
    },
    timestamp: new Date().toISOString()
  };
};

/**
 * Emergency migration controls for production safety
 */
export const migrationControls = {
  /**
   * Force switch to WebSocket mode (Phase 3)
   */
  enableWebSocketMode: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('WEBSOCKET_STAFF_MANAGEMENT', 'true');
      console.log('🚀 Phase 3: Forced switch to WebSocket mode');
      window.location.reload();
    }
  },

  /**
   * Force switch to Enhanced mode (Phase 2)
   */
  enableEnhancedMode: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('WEBSOCKET_STAFF_MANAGEMENT', 'false');
      console.log('🔄 Phase 3: Forced switch to Enhanced mode');
      window.location.reload();
    }
  },

  /**
   * Check current system health and compatibility
   */
  checkMigrationHealth: () => {
    const status = getMigrationStatus();
    const health = {
      ...status,
      healthy: true,
      warnings: [],
      recommendations: []
    };

    // Check WebSocket availability
    if (status.webSocketEnabled && typeof WebSocket === 'undefined') {
      health.healthy = false;
      health.warnings.push('WebSocket not supported in this environment');
      health.recommendations.push('Switch to Enhanced mode for compatibility');
    }

    // Check Go server connectivity (simplified check)
    if (status.webSocketEnabled) {
      try {
        // This would be expanded to actually test connectivity
        health.recommendations.push('Verify Go WebSocket server is running on localhost:8080');
      } catch (error) {
        health.warnings.push('Cannot verify Go server connectivity');
      }
    }

    return health;
  }
};

// Development utilities
if (process.env.NODE_ENV === 'development') {
  window.staffMigrationUtils = {
    getMigrationStatus,
    ...migrationControls,
    enableWebSocket: migrationControls.enableWebSocketMode,
    enableEnhanced: migrationControls.enableEnhancedMode,
    checkHealth: migrationControls.checkMigrationHealth
  };

  console.log('🔧 Phase 3: Staff migration utilities available at window.staffMigrationUtils');
}

export default useStaffManagement;