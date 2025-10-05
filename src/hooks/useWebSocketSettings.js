/**
 * Phase 3: WebSocket Settings Management Hook
 * Real-time settings synchronization with Go server multi-table backend
 *
 * Architecture:
 * - Connects to existing Go WebSocket server (ws://localhost:8080/staff-sync)
 * - Manages aggregated settings from 5 database tables:
 *   1. staff_groups
 *   2. daily_limits
 *   3. monthly_limits
 *   4. priority_rules
 *   5. ml_model_configs
 * - Handles version control via config_versions table
 * - Supports automatic migration from localStorage
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket message types matching Go server implementation (settings_multitable.go)
const MESSAGE_TYPES = {
  // Settings synchronization
  SETTINGS_SYNC_REQUEST: 'SETTINGS_SYNC_REQUEST',
  SETTINGS_SYNC_RESPONSE: 'SETTINGS_SYNC_RESPONSE',

  // Table-specific updates
  SETTINGS_UPDATE_STAFF_GROUPS: 'SETTINGS_UPDATE_STAFF_GROUPS',
  SETTINGS_UPDATE_DAILY_LIMITS: 'SETTINGS_UPDATE_DAILY_LIMITS',
  SETTINGS_UPDATE_MONTHLY_LIMITS: 'SETTINGS_UPDATE_MONTHLY_LIMITS',
  SETTINGS_UPDATE_PRIORITY_RULES: 'SETTINGS_UPDATE_PRIORITY_RULES',
  SETTINGS_UPDATE_ML_CONFIG: 'SETTINGS_UPDATE_ML_CONFIG',

  // Bulk operations
  SETTINGS_RESET: 'SETTINGS_RESET',
  SETTINGS_MIGRATE: 'SETTINGS_MIGRATE',

  // Version management
  SETTINGS_CREATE_VERSION: 'SETTINGS_CREATE_VERSION',
  SETTINGS_ACTIVATE_VERSION: 'SETTINGS_ACTIVATE_VERSION',

  // Connection management
  CONNECTION_ACK: 'CONNECTION_ACK',
  ERROR: 'ERROR'
};

// Message types to silently ignore (handled by other hooks on same WebSocket)
const IGNORED_MESSAGE_TYPES = [
  'SHIFT_SYNC_RESPONSE',
  'SHIFT_UPDATE',
  'SHIFT_SYNC_REQUEST',
  'SHIFT_BROADCAST',
  'SHIFT_BULK_UPDATE',
  'SYNC_REQUEST',
  'SYNC_RESPONSE',
  'SYNC_ALL_PERIODS_REQUEST',
  'SYNC_ALL_PERIODS_RESPONSE',
  'STAFF_UPDATE',
  'STAFF_CREATE',
  'STAFF_DELETE'
];

/**
 * WebSocket Settings Hook
 *
 * @param {Object} options Configuration options
 * @param {boolean} options.enabled Whether to enable WebSocket connection
 * @returns {Object} Settings state and operations
 */
export const useWebSocketSettings = (options = {}) => {
  const { enabled = true } = options;

  // State management - aggregated from multi-table backend
  const [settings, setSettings] = useState(null);
  const [version, setVersion] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState(null);

  // WebSocket connection refs
  const wsRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectTimeoutRef = useRef(null);
  const connectionFailedPermanently = useRef(false);
  const initialConnectionTimer = useRef(null);

  /**
   * Handle SETTINGS_SYNC_RESPONSE message
   * Parses aggregated multi-table response and separates version from settings
   */
  const handleSettingsSyncResponse = useCallback((payload) => {
    try {
      const settingsData = payload.settings || {};
      const versionData = settingsData.version || null;

      // Separate version from settings
      const { version: _, ...actualSettings } = settingsData;

      setSettings(actualSettings);
      setVersion(versionData);
      setIsLoading(false);

      console.log('📊 Settings synced from multi-table backend:', {
        staffGroups: actualSettings.staffGroups?.length || 0,
        dailyLimits: actualSettings.dailyLimits?.length || 0,
        monthlyLimits: actualSettings.monthlyLimits?.length || 0,
        priorityRules: actualSettings.priorityRules?.length || 0,
        mlModelConfigs: actualSettings.mlModelConfigs?.length || 0
      });
      console.log('📌 Active config version:', versionData?.versionNumber);

      // If this was a migration response
      if (payload.migrated) {
        console.log('✅ Settings migration completed (localStorage → multi-table)');
      }

      // If this was a reset response
      if (payload.reset) {
        console.log('🔄 Settings reset to defaults (multi-table)');
      }

      // If a specific table was updated
      if (payload.updated) {
        console.log(`📝 Settings updated: ${payload.updated} table`);
      }
    } catch (error) {
      console.error('❌ Failed to parse settings sync response:', error);
      setLastError('Failed to parse settings data');
    }
  }, []);

  /**
   * Handle ERROR message
   */
  const handleError = useCallback((payload) => {
    console.error('❌ Settings server error:', payload);
    setLastError(payload.message || 'Unknown server error');
  }, []);

  /**
   * WebSocket connection management
   */
  const connect = useCallback(() => {
    // Don't attempt connection if disabled via options
    if (!enabled) {
      console.log('🚫 Phase 3 Settings: WebSocket disabled via options, skipping connection');
      setConnectionStatus('disabled');
      setIsLoading(false);
      setLastError('WebSocket disabled via feature flag');
      return;
    }

    // Don't attempt connection if permanently failed
    if (connectionFailedPermanently.current) {
      console.log('🚫 Phase 3 Settings: WebSocket permanently disabled, skipping connection');
      setConnectionStatus('failed_permanently');
      setIsLoading(false);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close any existing connection
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Set absolute timeout for initial connection (10 seconds)
    if (!initialConnectionTimer.current) {
      initialConnectionTimer.current = setTimeout(() => {
        console.log('⏰ Phase 3 Settings: WebSocket connection timeout, permanently disabling');
        connectionFailedPermanently.current = true;
        setConnectionStatus('failed_permanently');
        setLastError('Connection timeout - falling back to localStorage mode');
        setIsLoading(false);

        if (wsRef.current) {
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      }, 10000);
    }

    try {
      // Use same endpoint as staff management for connection reuse
      const wsUrl = 'ws://localhost:8080/staff-sync';
      console.log(`🔌 Phase 3 Settings: Creating WebSocket connection to ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection timeout per attempt (3 seconds)
      const connectionTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('⏰ Phase 3 Settings: Connection attempt timeout, closing socket');
          ws.close();
        }
      }, 3000);

      ws.onopen = () => {
        console.log('🔌 Phase 3 Settings: WebSocket connected to Go server');
        clearTimeout(connectionTimer);
        setConnectionStatus('connected');
        setLastError(null);
        reconnectAttempts.current = 0;

        // Reset permanent failure flag on successful connection
        connectionFailedPermanently.current = false;

        // Clear initial connection timeout
        if (initialConnectionTimer.current) {
          clearTimeout(initialConnectionTimer.current);
          initialConnectionTimer.current = null;
        }

        // Request initial settings sync
        console.log('📤 Phase 3 Settings: Requesting settings sync');
        ws.send(JSON.stringify({
          type: MESSAGE_TYPES.SETTINGS_SYNC_REQUEST,
          payload: { clientId: clientIdRef.current },
          timestamp: new Date().toISOString(),
          clientId: clientIdRef.current
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case MESSAGE_TYPES.SETTINGS_SYNC_RESPONSE:
              handleSettingsSyncResponse(message.payload);
              break;

            case MESSAGE_TYPES.CONNECTION_ACK:
              console.log('✅ Phase 3 Settings: Connection acknowledged by Go server');
              break;

            case MESSAGE_TYPES.ERROR:
              handleError(message.payload);
              break;

            default:
              // Silently ignore messages handled by other hooks (staff, shifts)
              if (!IGNORED_MESSAGE_TYPES.includes(message.type)) {
                console.warn('⚠️ Phase 3 Settings: Unknown message type:', message.type);
              }
          }
        } catch (error) {
          console.error('❌ Phase 3 Settings: Failed to parse WebSocket message:', error);
          setLastError('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 Phase 3 Settings: WebSocket disconnected: code=${event.code}, reason='${event.reason}'`);
        clearTimeout(connectionTimer);
        setConnectionStatus('disconnected');

        // Check if permanently disabled
        if (connectionFailedPermanently.current) {
          console.log('🚫 Phase 3 Settings: WebSocket permanently disabled, no reconnection');
          setConnectionStatus('failed_permanently');
          setIsLoading(false);
          return;
        }

        // Implement exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s
          reconnectAttempts.current++;

          console.log(`🔄 Phase 3 Settings: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('❌ Phase 3 Settings: Max reconnection attempts reached, permanently disabling');
          connectionFailedPermanently.current = true;
          setConnectionStatus('failed_permanently');
          setLastError('Connection failed after multiple attempts - switching to localStorage mode');
          setIsLoading(false);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Phase 3 Settings: WebSocket error:', error);
        clearTimeout(connectionTimer);
        setLastError('WebSocket connection error');
      };

    } catch (error) {
      console.error('❌ Phase 3 Settings: Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
      setLastError('Failed to establish WebSocket connection');
    }
  }, [enabled, handleSettingsSyncResponse, handleError]);

  // Initialize WebSocket connection
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      connect();
    }, 100); // Small delay to prevent rapid reconnections

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (initialConnectionTimer.current) {
        clearTimeout(initialConnectionTimer.current);
      }
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * Update staff groups (table-specific operation)
   */
  const updateStaffGroups = useCallback((groupData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Staff groups update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_UPDATE_STAFF_GROUPS,
        payload: { group: groupData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent staff groups update:', groupData);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to update staff groups - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Update daily limits (table-specific operation)
   */
  const updateDailyLimits = useCallback((limitData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Daily limits update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_UPDATE_DAILY_LIMITS,
        payload: { limit: limitData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent daily limits update:', limitData);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to update daily limits - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Update monthly limits (table-specific operation)
   */
  const updateMonthlyLimits = useCallback((limitData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Monthly limits update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_UPDATE_MONTHLY_LIMITS,
        payload: { limit: limitData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent monthly limits update:', limitData);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to update monthly limits - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Update priority rules (table-specific operation)
   */
  const updatePriorityRules = useCallback((ruleData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Priority rules update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_UPDATE_PRIORITY_RULES,
        payload: { rule: ruleData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent priority rules update:', ruleData);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to update priority rules - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Update ML model config (table-specific operation)
   */
  const updateMLConfig = useCallback((configData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: ML config update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_UPDATE_ML_CONFIG,
        payload: { config: configData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent ML config update:', configData);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to update ML config - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Reset settings to defaults (multi-table reset)
   */
  const resetSettings = useCallback(() => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Reset blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_RESET,
        payload: {},
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent settings reset (multi-table)');

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to reset settings - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Migrate settings from localStorage to multi-table backend
   */
  const migrateSettings = useCallback((localStorageData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Migration blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_MIGRATE,
        payload: { settings: localStorageData },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent settings migration (localStorage → multi-table)');

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to migrate settings - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Create new config version
   */
  const createVersion = useCallback((name, description) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Create version blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_CREATE_VERSION,
        payload: { name, description },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent create version request:', { name, description });

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to create version - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Activate config version
   */
  const activateVersion = useCallback((versionId) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3 Settings: Activate version blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.SETTINGS_ACTIVATE_VERSION,
        payload: { versionId },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3 Settings: Sent activate version request:', versionId);

      return Promise.resolve();
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3 Settings: Failed to activate version - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  /**
   * Manual reconnection
   */
  const reconnect = useCallback(() => {
    if (!enabled) {
      console.log('🚫 Phase 3 Settings: Reconnection blocked - WebSocket disabled');
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttempts.current = 0;
    connectionFailedPermanently.current = false;
    setConnectionStatus('connecting');
    connect();
  }, [enabled, connect]);

  return {
    // Core data (aggregated from multi-table)
    settings,
    version,

    // Table-specific operations
    updateStaffGroups,
    updateDailyLimits,
    updateMonthlyLimits,
    updatePriorityRules,
    updateMLConfig,

    // Bulk operations
    resetSettings,
    migrateSettings,

    // Version management
    createVersion,
    activateVersion,

    // Connection state
    connectionStatus,
    isLoading,
    isConnected: connectionStatus === 'connected',
    lastError,
    connectionFailedPermanently: connectionFailedPermanently.current,

    // Manual controls
    reconnect,

    // Debug info
    reconnectAttempts: reconnectAttempts.current,
    clientId: clientIdRef.current
  };
};

export default useWebSocketSettings;
