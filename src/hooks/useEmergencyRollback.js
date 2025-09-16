/**
 * Phase 5: Emergency Rollback Hook with Feature Flag Management
 * Implementation of rollback procedures as per lines 609-624 in IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './enhanced/useSupabase';

// Feature flags for Phase 5 migration control
const FEATURE_FLAGS = {
  USE_GO_WEBSOCKET: 'go_websocket_enabled',
  HYBRID_MODE: 'hybrid_mode_enabled',
  FALLBACK_MODE: 'fallback_mode_enabled',
  EMERGENCY_ROLLBACK: 'emergency_rollback_active'
};

// Rollback triggers and thresholds
const ROLLBACK_THRESHOLDS = {
  ERROR_RATE: 5, // 5% error rate threshold
  CONNECTION_FAILURES: 10, // 10 consecutive connection failures
  RESPONSE_TIME: 5000, // 5 seconds response time threshold
  HEALTH_CHECK_FAILURES: 3 // 3 consecutive health check failures
};

export const useEmergencyRollback = () => {
  const [rollbackState, setRollbackState] = useState({
    isRollbackActive: false,
    rollbackReason: null,
    rollbackTimestamp: null,
    featureFlags: {},
    metrics: {
      errorCount: 0,
      connectionFailures: 0,
      lastResponseTime: 0,
      healthCheckFailures: 0
    }
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const monitoringIntervalRef = useRef(null);
  const metricsRef = useRef(rollbackState.metrics);
  const { supabase } = useSupabase();

  // Initialize feature flags from localStorage and remote config
  useEffect(() => {
    loadFeatureFlags();
    checkForRollbackSignal();
  }, []);

  // Load feature flags from multiple sources
  const loadFeatureFlags = useCallback(async () => {
    try {
      // Load from localStorage (immediate)
      const localFlags = JSON.parse(localStorage.getItem('featureFlags') || '{}');

      // Load from public rollback signal file (created by deployment scripts)
      try {
        const response = await fetch('/rollback-signal.json?t=' + Date.now());
        if (response.ok) {
          const rollbackSignal = await response.json();
          if (rollbackSignal.rollback) {
            triggerEmergencyRollback('deployment_script_triggered', rollbackSignal.timestamp);
            return;
          }
        }
      } catch (error) {
        // Rollback signal file doesn't exist or network error - this is normal
      }

      // Load from Supabase configuration (if available)
      let remoteFlags = {};
      if (supabase) {
        try {
          const { data } = await supabase
            .from('feature_flags')
            .select('flag_name, is_enabled')
            .eq('environment', process.env.NODE_ENV || 'production');

          if (data) {
            remoteFlags = data.reduce((acc, flag) => {
              acc[flag.flag_name] = flag.is_enabled;
              return acc;
            }, {});
          }
        } catch (error) {
          console.warn('Could not load remote feature flags:', error);
        }
      }

      // Merge flags (remote takes precedence)
      const mergedFlags = { ...localFlags, ...remoteFlags };

      setRollbackState(prev => ({
        ...prev,
        featureFlags: mergedFlags
      }));

      // Check if emergency rollback flag is active
      if (mergedFlags[FEATURE_FLAGS.EMERGENCY_ROLLBACK]) {
        triggerEmergencyRollback('feature_flag_triggered');
      }

    } catch (error) {
      console.error('Error loading feature flags:', error);
    }
  }, [supabase]);

  // Check for rollback signal file created by deployment scripts
  const checkForRollbackSignal = useCallback(async () => {
    try {
      const response = await fetch('/rollback-signal.json?t=' + Date.now());
      if (response.ok) {
        const signal = await response.json();
        if (signal.rollback && !rollbackState.isRollbackActive) {
          triggerEmergencyRollback('deployment_rollback_signal', signal.timestamp);
        }
      }
    } catch (error) {
      // File doesn't exist - normal operation
    }
  }, [rollbackState.isRollbackActive]);

  // Update feature flag
  const updateFeatureFlag = useCallback(async (flagName, value) => {
    try {
      const newFlags = { ...rollbackState.featureFlags, [flagName]: value };

      // Update localStorage immediately
      localStorage.setItem('featureFlags', JSON.stringify(newFlags));

      // Update remote configuration if available
      if (supabase) {
        await supabase
          .from('feature_flags')
          .upsert({
            flag_name: flagName,
            is_enabled: value,
            environment: process.env.NODE_ENV || 'production',
            updated_at: new Date().toISOString()
          });
      }

      setRollbackState(prev => ({
        ...prev,
        featureFlags: newFlags
      }));

      console.log(`Feature flag ${flagName} updated to ${value}`);
    } catch (error) {
      console.error('Error updating feature flag:', error);
    }
  }, [rollbackState.featureFlags, supabase]);

  // Record performance metric
  const recordMetric = useCallback((metricType, value) => {
    metricsRef.current = {
      ...metricsRef.current,
      [metricType]: value
    };

    setRollbackState(prev => ({
      ...prev,
      metrics: metricsRef.current
    }));

    // Check rollback thresholds
    checkRollbackThresholds();
  }, []);

  // Check if metrics exceed rollback thresholds
  const checkRollbackThresholds = useCallback(() => {
    const metrics = metricsRef.current;

    // Error rate threshold
    if (metrics.errorCount >= ROLLBACK_THRESHOLDS.ERROR_RATE) {
      triggerEmergencyRollback('error_rate_threshold', `Error count: ${metrics.errorCount}`);
      return;
    }

    // Connection failure threshold
    if (metrics.connectionFailures >= ROLLBACK_THRESHOLDS.CONNECTION_FAILURES) {
      triggerEmergencyRollback('connection_failure_threshold', `Connection failures: ${metrics.connectionFailures}`);
      return;
    }

    // Response time threshold
    if (metrics.lastResponseTime >= ROLLBACK_THRESHOLDS.RESPONSE_TIME) {
      triggerEmergencyRollback('response_time_threshold', `Response time: ${metrics.lastResponseTime}ms`);
      return;
    }

    // Health check failure threshold
    if (metrics.healthCheckFailures >= ROLLBACK_THRESHOLDS.HEALTH_CHECK_FAILURES) {
      triggerEmergencyRollback('health_check_threshold', `Health check failures: ${metrics.healthCheckFailures}`);
      return;
    }
  }, []);

  // Trigger emergency rollback
  const triggerEmergencyRollback = useCallback(async (reason, details = null) => {
    if (rollbackState.isRollbackActive) {
      return; // Already in rollback mode
    }

    console.error(`Emergency rollback triggered: ${reason}`, details);

    const rollbackTimestamp = new Date().toISOString();

    try {
      // Immediately disable Go WebSocket and enable fallback mode
      const rollbackFlags = {
        [FEATURE_FLAGS.USE_GO_WEBSOCKET]: false,
        [FEATURE_FLAGS.HYBRID_MODE]: false,
        [FEATURE_FLAGS.FALLBACK_MODE]: true,
        [FEATURE_FLAGS.EMERGENCY_ROLLBACK]: true
      };

      // Update localStorage immediately for instant rollback
      localStorage.setItem('featureFlags', JSON.stringify(rollbackFlags));

      // Update state
      setRollbackState(prev => ({
        ...prev,
        isRollbackActive: true,
        rollbackReason: reason,
        rollbackTimestamp,
        featureFlags: rollbackFlags
      }));

      // Update remote configuration
      if (supabase) {
        for (const [flagName, value] of Object.entries(rollbackFlags)) {
          await supabase
            .from('feature_flags')
            .upsert({
              flag_name: flagName,
              is_enabled: value,
              environment: process.env.NODE_ENV || 'production',
              updated_at: rollbackTimestamp
            });
        }

        // Log rollback event
        await supabase
          .from('rollback_events')
          .insert({
            reason,
            details,
            timestamp: rollbackTimestamp,
            metrics: metricsRef.current
          });
      }

      // Create rollback signal file for monitoring
      try {
        await fetch('/api/rollback-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rollback: true,
            reason,
            timestamp: rollbackTimestamp
          })
        });
      } catch (error) {
        console.warn('Could not create rollback signal file:', error);
      }

      // Force page reload to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error during emergency rollback:', error);
    }
  }, [rollbackState.isRollbackActive, supabase]);

  // Manual rollback function
  const manualRollback = useCallback(() => {
    triggerEmergencyRollback('manual_triggered', 'User initiated rollback');
  }, [triggerEmergencyRollback]);

  // Clear rollback state (recovery)
  const clearRollback = useCallback(async () => {
    try {
      const recoveryFlags = {
        [FEATURE_FLAGS.USE_GO_WEBSOCKET]: true,
        [FEATURE_FLAGS.HYBRID_MODE]: true,
        [FEATURE_FLAGS.FALLBACK_MODE]: false,
        [FEATURE_FLAGS.EMERGENCY_ROLLBACK]: false
      };

      // Update localStorage
      localStorage.setItem('featureFlags', JSON.stringify(recoveryFlags));

      // Update remote configuration
      if (supabase) {
        for (const [flagName, value] of Object.entries(recoveryFlags)) {
          await supabase
            .from('feature_flags')
            .upsert({
              flag_name: flagName,
              is_enabled: value,
              environment: process.env.NODE_ENV || 'production',
              updated_at: new Date().toISOString()
            });
        }
      }

      // Reset state
      setRollbackState(prev => ({
        ...prev,
        isRollbackActive: false,
        rollbackReason: null,
        rollbackTimestamp: null,
        featureFlags: recoveryFlags,
        metrics: {
          errorCount: 0,
          connectionFailures: 0,
          lastResponseTime: 0,
          healthCheckFailures: 0
        }
      }));

      // Clear metrics
      metricsRef.current = {
        errorCount: 0,
        connectionFailures: 0,
        lastResponseTime: 0,
        healthCheckFailures: 0
      };

      console.log('Rollback cleared, system recovered');
    } catch (error) {
      console.error('Error clearing rollback:', error);
    }
  }, [supabase]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    monitoringIntervalRef.current = setInterval(() => {
      checkForRollbackSignal();
    }, 10000); // Check every 10 seconds

    console.log('Emergency rollback monitoring started');
  }, [isMonitoring, checkForRollbackSignal]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    setIsMonitoring(false);
    console.log('Emergency rollback monitoring stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  return {
    rollbackState,
    isMonitoring,

    // Feature flag management
    updateFeatureFlag,
    getFeatureFlag: (flagName) => rollbackState.featureFlags[flagName] ?? false,

    // Metric recording
    recordMetric,
    recordError: () => recordMetric('errorCount', metricsRef.current.errorCount + 1),
    recordConnectionFailure: () => recordMetric('connectionFailures', metricsRef.current.connectionFailures + 1),
    recordResponseTime: (time) => recordMetric('lastResponseTime', time),
    recordHealthCheckFailure: () => recordMetric('healthCheckFailures', metricsRef.current.healthCheckFailures + 1),

    // Rollback control
    triggerEmergencyRollback,
    manualRollback,
    clearRollback,

    // Monitoring control
    startMonitoring,
    stopMonitoring,

    // Utility functions
    isRollbackActive: rollbackState.isRollbackActive,
    shouldUseGoWebSocket: () => !rollbackState.isRollbackActive && rollbackState.featureFlags[FEATURE_FLAGS.USE_GO_WEBSOCKET],
    shouldUseFallbackMode: () => rollbackState.isRollbackActive || rollbackState.featureFlags[FEATURE_FLAGS.FALLBACK_MODE]
  };
};