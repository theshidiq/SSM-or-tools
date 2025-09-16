/**
 * Phase 3: Fallback Mechanisms
 * Ensures graceful degradation when WebSocket connections fail
 * Provides automatic fallback to Enhanced mode with seamless user experience
 */

import { useState, useEffect, useRef } from 'react';
import { emergencyRollback } from '../config/featureFlags';
import { phase3MigrationManager } from './phase3MigrationUtils';

/**
 * Connection health monitor
 * Tracks WebSocket connection stability and triggers fallback when needed
 */
export class ConnectionHealthMonitor {
  constructor() {
    this.healthMetrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      disconnections: 0,
      lastSuccessfulConnection: null,
      lastFailure: null,
      averageConnectionTime: 0,
      connectionStability: 'unknown' // excellent, good, poor, critical
    };
    this.listeners = [];
    this.stabilityThresholds = {
      excellent: { failureRate: 0.05, maxReconnects: 1 },
      good: { failureRate: 0.15, maxReconnects: 3 },
      poor: { failureRate: 0.35, maxReconnects: 5 },
      critical: { failureRate: 0.5, maxReconnects: 10 }
    };
  }

  /**
   * Record a connection attempt
   */
  recordConnectionAttempt() {
    this.healthMetrics.connectionAttempts++;
    this.updateStability();
  }

  /**
   * Record a successful connection
   */
  recordSuccessfulConnection() {
    this.healthMetrics.successfulConnections++;
    this.healthMetrics.lastSuccessfulConnection = new Date().toISOString();
    this.updateStability();
    this.notifyListeners('connection_success');
  }

  /**
   * Record a failed connection
   */
  recordFailedConnection(error) {
    this.healthMetrics.failedConnections++;
    this.healthMetrics.lastFailure = {
      timestamp: new Date().toISOString(),
      error: error.message || 'Unknown error'
    };
    this.updateStability();
    this.notifyListeners('connection_failure', error);
  }

  /**
   * Record a disconnection
   */
  recordDisconnection(reason) {
    this.healthMetrics.disconnections++;
    this.updateStability();
    this.notifyListeners('disconnection', reason);
  }

  /**
   * Update connection stability assessment
   */
  updateStability() {
    const { connectionAttempts, failedConnections } = this.healthMetrics;

    if (connectionAttempts === 0) {
      this.healthMetrics.connectionStability = 'unknown';
      return;
    }

    const failureRate = failedConnections / connectionAttempts;

    if (failureRate <= this.stabilityThresholds.excellent.failureRate) {
      this.healthMetrics.connectionStability = 'excellent';
    } else if (failureRate <= this.stabilityThresholds.good.failureRate) {
      this.healthMetrics.connectionStability = 'good';
    } else if (failureRate <= this.stabilityThresholds.poor.failureRate) {
      this.healthMetrics.connectionStability = 'poor';
    } else {
      this.healthMetrics.connectionStability = 'critical';
    }

    // Trigger automatic fallback for critical connections
    if (this.healthMetrics.connectionStability === 'critical' &&
        this.healthMetrics.failedConnections >= this.stabilityThresholds.critical.maxReconnects) {
      this.triggerAutomaticFallback('critical_connection_health');
    }
  }

  /**
   * Trigger automatic fallback to Enhanced mode
   */
  async triggerAutomaticFallback(reason) {
    console.warn(`🚨 Phase 3: Triggering automatic fallback - ${reason}`);

    try {
      await phase3MigrationManager.rollbackToEnhanced(`automatic_fallback_${reason}`);
      this.notifyListeners('automatic_fallback', reason);
    } catch (error) {
      console.error('❌ Phase 3: Failed to trigger automatic fallback:', error);
      // Last resort: emergency rollback
      emergencyRollback(`fallback_failure_${reason}`);
    }
  }

  /**
   * Subscribe to health events
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data, this.healthMetrics);
      } catch (error) {
        console.error('❌ Health monitor listener error:', error);
      }
    });
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      ...this.healthMetrics,
      isHealthy: ['excellent', 'good'].includes(this.healthMetrics.connectionStability),
      shouldFallback: this.healthMetrics.connectionStability === 'critical'
    };
  }

  /**
   * Reset health metrics
   */
  reset() {
    this.healthMetrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      disconnections: 0,
      lastSuccessfulConnection: null,
      lastFailure: null,
      averageConnectionTime: 0,
      connectionStability: 'unknown'
    };
  }
}

// Global health monitor instance
export const connectionHealthMonitor = new ConnectionHealthMonitor();

/**
 * Enhanced WebSocket hook with automatic fallback
 * Wraps the original WebSocket hook with health monitoring and fallback logic
 */
export const useWebSocketWithFallback = (originalHook, fallbackHook, currentMonthIndex) => {
  const [usingFallback, setUsingFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);
  const healthCheckInterval = useRef(null);

  // Use appropriate hook based on fallback state
  const hookResult = usingFallback ?
    fallbackHook(currentMonthIndex) :
    originalHook(currentMonthIndex);

  useEffect(() => {
    // Subscribe to health monitor events
    const unsubscribe = connectionHealthMonitor.subscribe((event, data, metrics) => {
      switch (event) {
        case 'automatic_fallback':
          setUsingFallback(true);
          setFallbackReason(data);
          console.log('🔄 Phase 3: Switched to fallback mode:', data);
          break;
        case 'connection_success':
          // Reset fallback if we were using it and connection is stable again
          if (usingFallback && metrics.connectionStability === 'excellent') {
            setTimeout(() => {
              console.log('✅ Phase 3: Connection stable, attempting to exit fallback mode');
              setUsingFallback(false);
              setFallbackReason(null);
            }, 5000); // Wait 5 seconds before trying to exit fallback
          }
          break;
      }
    });

    // Periodic health check
    healthCheckInterval.current = setInterval(() => {
      const healthStatus = connectionHealthMonitor.getHealthStatus();

      if (healthStatus.shouldFallback && !usingFallback) {
        console.warn('⚠️ Phase 3: Health check indicates fallback should be triggered');
        connectionHealthMonitor.triggerAutomaticFallback('periodic_health_check');
      }
    }, 30000); // Check every 30 seconds

    return () => {
      unsubscribe();
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
      }
    };
  }, [usingFallback]);

  // Monitor the original hook's connection status
  useEffect(() => {
    if (!usingFallback && hookResult.connectionStatus) {
      switch (hookResult.connectionStatus) {
        case 'connected':
          connectionHealthMonitor.recordSuccessfulConnection();
          break;
        case 'disconnected':
          connectionHealthMonitor.recordDisconnection('status_change');
          break;
        case 'connecting':
          connectionHealthMonitor.recordConnectionAttempt();
          break;
      }
    }
  }, [hookResult.connectionStatus, usingFallback]);

  // Monitor errors
  useEffect(() => {
    if (!usingFallback && hookResult.lastError) {
      connectionHealthMonitor.recordFailedConnection(new Error(hookResult.lastError));
    }
  }, [hookResult.lastError, usingFallback]);

  return {
    ...hookResult,
    // Additional fallback-related information
    usingFallback,
    fallbackReason,
    healthStatus: connectionHealthMonitor.getHealthStatus(),
    manualFallback: () => {
      setUsingFallback(true);
      setFallbackReason('manual_user_initiated');
    },
    exitFallback: () => {
      setUsingFallback(false);
      setFallbackReason(null);
      connectionHealthMonitor.reset();
    }
  };
};

/**
 * Fallback-aware staff management hook
 * Provides seamless switching between WebSocket and Enhanced modes
 */
export const useStaffManagementWithFallback = (currentMonthIndex) => {
  // Dynamic imports to avoid loading fallback until needed
  const [hooks, setHooks] = useState({ websocket: null, enhanced: null });

  useEffect(() => {
    const loadHooks = async () => {
      try {
        const [websocketModule, enhancedModule] = await Promise.all([
          import('../hooks/useWebSocketStaff'),
          import('../hooks/useStaffManagementEnhanced')
        ]);

        setHooks({
          websocket: websocketModule.default,
          enhanced: enhancedModule.useStaffManagementEnhanced
        });
      } catch (error) {
        console.error('❌ Phase 3: Failed to load staff management hooks:', error);
        // Force fallback to enhanced mode
        phase3MigrationManager.rollbackToEnhanced('hook_loading_failure');
      }
    };

    loadHooks();
  }, []);

  // Return fallback result until hooks are loaded
  if (!hooks.websocket || !hooks.enhanced) {
    return {
      staffMembers: [],
      updateStaff: () => Promise.reject(new Error('Hooks not yet loaded')),
      addStaff: () => Promise.reject(new Error('Hooks not yet loaded')),
      deleteStaff: () => Promise.reject(new Error('Hooks not yet loaded')),
      connectionStatus: 'connecting',
      isLoading: true,
      isConnected: false,
      usingFallback: true,
      fallbackReason: 'hooks_loading'
    };
  }

  return useWebSocketWithFallback(hooks.websocket, hooks.enhanced, currentMonthIndex);
};

// Development utilities
if (process.env.NODE_ENV === 'development') {
  window.connectionHealthMonitor = connectionHealthMonitor;
  window.fallbackUtils = {
    triggerFallback: (reason) => connectionHealthMonitor.triggerAutomaticFallback(reason),
    getHealthStatus: () => connectionHealthMonitor.getHealthStatus(),
    resetHealth: () => connectionHealthMonitor.reset()
  };
  console.log('🔧 Phase 3: Fallback utilities available at window.fallbackUtils');
}

export default {
  ConnectionHealthMonitor,
  connectionHealthMonitor,
  useWebSocketWithFallback,
  useStaffManagementWithFallback
};