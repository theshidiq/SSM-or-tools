/**
 * WebSocket Shifts Hook - Real-time Shift Update Synchronization
 *
 * Integrates with Go WebSocket server for real-time shift updates
 * Features:
 * - Single shift cell updates with optimistic UI
 * - Bulk schedule updates for performance
 * - Real-time broadcast to all connected clients
 * - Automatic reconnection with exponential backoff
 * - Offline queue for pending updates
 * - Conflict resolution via server-authoritative updates
 *
 * Architecture:
 * - Go Server: Authoritative source of truth
 * - Supabase: Persistence layer (schedules.schedule_data JSONB)
 * - WebSocket: Real-time synchronization channel
 * - React Query: Client-side caching layer
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// WebSocket connection configuration
const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080';
const WS_ENDPOINT = '/staff-sync';
const RECONNECT_DELAY_BASE = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Message types
const MESSAGE_TYPES = {
  // Shift operations
  SHIFT_UPDATE: 'SHIFT_UPDATE',
  SHIFT_SYNC_REQUEST: 'SHIFT_SYNC_REQUEST',
  SHIFT_SYNC_RESPONSE: 'SHIFT_SYNC_RESPONSE',
  SHIFT_BROADCAST: 'SHIFT_BROADCAST',
  SHIFT_BULK_UPDATE: 'SHIFT_BULK_UPDATE',

  // Connection
  CONNECTION_ACK: 'CONNECTION_ACK',
  ERROR: 'ERROR',
};

/**
 * WebSocket Shifts Hook
 *
 * @param {number} currentPeriod - Current period index
 * @param {string} scheduleId - Current schedule ID
 * @param {object} options - Configuration options
 * @returns {object} WebSocket shift operations and state
 */
export const useWebSocketShifts = (currentPeriod = 0, scheduleId = null, options = {}) => {
  const {
    enabled = true,
    autoReconnect = true,
    enableOfflineQueue = true,
  } = options;

  const queryClient = useQueryClient();

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Schedule state
  const [scheduleData, setScheduleData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // WebSocket and refs
  const wsRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const clientIdRef = useRef(null);

  /**
   * Calculate reconnection delay with exponential backoff
   */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts),
      RECONNECT_DELAY_MAX
    );
    return delay;
  }, [reconnectAttempts]);

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current,
      };

      wsRef.current.send(JSON.stringify(message));
      console.log(`📤 [WEBSOCKET-SHIFTS] Sent ${type}:`, payload);
      return true;
    } else {
      console.warn(`⚠️ [WEBSOCKET-SHIFTS] Cannot send ${type}: Not connected`);

      // Queue message for later if offline queue enabled
      if (enableOfflineQueue && type !== MESSAGE_TYPES.SHIFT_SYNC_REQUEST) {
        offlineQueueRef.current.push({ type, payload, timestamp: Date.now() });
        console.log(`📥 [WEBSOCKET-SHIFTS] Queued ${type} for offline processing`);
      }

      return false;
    }
  }, [enableOfflineQueue]);

  /**
   * Process offline queue after reconnection
   */
  const processOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0) return;

    console.log(`📤 [WEBSOCKET-SHIFTS] Processing ${offlineQueueRef.current.length} queued messages`);

    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];

    queue.forEach(({ type, payload }) => {
      sendMessage(type, payload);
    });
  }, [sendMessage]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`📨 [WEBSOCKET-SHIFTS] Received ${message.type}:`, message.payload);

      switch (message.type) {
        case MESSAGE_TYPES.CONNECTION_ACK:
          setConnectionStatus('connected');
          setIsConnected(true);
          setReconnectAttempts(0);
          clientIdRef.current = message.payload?.clientId || clientIdRef.current;
          console.log(`✅ [WEBSOCKET-SHIFTS] Connected (Client ID: ${clientIdRef.current})`);

          // Request initial sync if scheduleId available
          if (scheduleId) {
            sendMessage(MESSAGE_TYPES.SHIFT_SYNC_REQUEST, {
              scheduleId,
              periodIndex: currentPeriod,
            });
          }

          // Process offline queue
          processOfflineQueue();
          break;

        case MESSAGE_TYPES.SHIFT_SYNC_RESPONSE:
          setScheduleData(message.payload.scheduleData || {});
          setIsSyncing(false);
          console.log(`✅ [WEBSOCKET-SHIFTS] Schedule synced: ${Object.keys(message.payload.scheduleData || {}).length} staff members`);

          // Update React Query cache
          queryClient.setQueryData(
            ['schedule', 'data', currentPeriod],
            (old) => ({
              ...old,
              schedule: message.payload.scheduleData,
              loadedAt: Date.now(),
            })
          );
          break;

        case MESSAGE_TYPES.SHIFT_BROADCAST:
          // Real-time update from another client
          const { staffId, dateKey, shiftValue } = message.payload;

          setScheduleData((prev) => {
            const updated = { ...prev };
            if (!updated[staffId]) updated[staffId] = {};
            updated[staffId][dateKey] = shiftValue;
            return updated;
          });

          console.log(`📡 [WEBSOCKET-SHIFTS] Received broadcast update: ${staffId} → ${dateKey} = "${shiftValue}"`);

          // Invalidate React Query cache to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['schedule', 'data', currentPeriod],
          });
          break;

        case MESSAGE_TYPES.ERROR:
          console.error(`❌ [WEBSOCKET-SHIFTS] Server error:`, message.payload);
          setLastError(message.payload.error || 'Unknown error');
          setIsSyncing(false);
          break;

        default:
          console.log(`📨 [WEBSOCKET-SHIFTS] Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ [WEBSOCKET-SHIFTS] Failed to parse message:`, error);
    }
  }, [scheduleId, currentPeriod, sendMessage, processOfflineQueue, queryClient]);

  /**
   * Start heartbeat to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send heartbeat (sync request acts as heartbeat)
        sendMessage(MESSAGE_TYPES.SHIFT_SYNC_REQUEST, {
          scheduleId,
          periodIndex: currentPeriod,
        });
      }
    }, HEARTBEAT_INTERVAL);
  }, [scheduleId, currentPeriod, sendMessage]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    setIsLoading(true);

    try {
      const url = `${WS_URL}${WS_ENDPOINT}?period=${currentPeriod}`;
      console.log(`🔌 [WEBSOCKET-SHIFTS] Connecting to: ${url}`);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ [WEBSOCKET-SHIFTS] WebSocket connection opened`);
        setIsLoading(false);
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error(`❌ [WEBSOCKET-SHIFTS] WebSocket error:`, error);
        setLastError('WebSocket connection error');
        setConnectionStatus('error');
      };

      ws.onclose = (event) => {
        console.log(`🔌 [WEBSOCKET-SHIFTS] WebSocket closed:`, event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setIsLoading(false);

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Auto-reconnect if enabled
        if (autoReconnect && enabled) {
          const delay = getReconnectDelay();
          console.log(`🔄 [WEBSOCKET-SHIFTS] Reconnecting in ${delay}ms...`);

          reconnectTimerRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error(`❌ [WEBSOCKET-SHIFTS] Failed to create WebSocket:`, error);
      setLastError(error.message);
      setConnectionStatus('error');
      setIsLoading(false);
    }
  }, [enabled, currentPeriod, autoReconnect, getReconnectDelay, handleMessage, startHeartbeat]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  /**
   * Update a single shift cell
   */
  const updateShift = useCallback((staffId, dateKey, shiftValue) => {
    if (!scheduleId) {
      console.error(`❌ [WEBSOCKET-SHIFTS] Cannot update shift: No scheduleId`);
      return Promise.reject(new Error('No scheduleId'));
    }

    console.log(`📝 [WEBSOCKET-SHIFTS] Updating shift: ${staffId} → ${dateKey} = "${shiftValue}"`);

    // Optimistic update
    setScheduleData((prev) => {
      const updated = { ...prev };
      if (!updated[staffId]) updated[staffId] = {};
      updated[staffId][dateKey] = shiftValue;
      return updated;
    });

    // Send to server
    const success = sendMessage(MESSAGE_TYPES.SHIFT_UPDATE, {
      staffId,
      dateKey,
      shiftValue,
      scheduleId,
      periodIndex: currentPeriod,
    });

    if (!success && !enableOfflineQueue) {
      // Rollback optimistic update if not queued
      setScheduleData((prev) => {
        const updated = { ...prev };
        if (updated[staffId]) {
          delete updated[staffId][dateKey];
        }
        return updated;
      });
      return Promise.reject(new Error('Not connected and offline queue disabled'));
    }

    return Promise.resolve();
  }, [scheduleId, currentPeriod, sendMessage, enableOfflineQueue]);

  /**
   * Bulk update entire schedule
   */
  const bulkUpdateSchedule = useCallback((newScheduleData) => {
    if (!scheduleId) {
      console.error(`❌ [WEBSOCKET-SHIFTS] Cannot bulk update: No scheduleId`);
      return Promise.reject(new Error('No scheduleId'));
    }

    console.log(`📦 [WEBSOCKET-SHIFTS] Bulk updating schedule: ${Object.keys(newScheduleData).length} staff members`);

    // Optimistic update
    setScheduleData(newScheduleData);

    // Send to server
    const success = sendMessage(MESSAGE_TYPES.SHIFT_BULK_UPDATE, {
      scheduleId,
      scheduleData: newScheduleData,
      periodIndex: currentPeriod,
    });

    if (!success && !enableOfflineQueue) {
      return Promise.reject(new Error('Not connected and offline queue disabled'));
    }

    return Promise.resolve();
  }, [scheduleId, currentPeriod, sendMessage, enableOfflineQueue]);

  /**
   * Request schedule sync from server
   */
  const syncSchedule = useCallback(() => {
    if (!scheduleId) {
      console.warn(`⚠️ [WEBSOCKET-SHIFTS] Cannot sync: No scheduleId`);
      return;
    }

    setIsSyncing(true);
    sendMessage(MESSAGE_TYPES.SHIFT_SYNC_REQUEST, {
      scheduleId,
      periodIndex: currentPeriod,
    });
  }, [scheduleId, currentPeriod, sendMessage]);

  // Connect on mount and when enabled/period changes
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, currentPeriod]); // Intentionally omitting connect/disconnect to avoid infinite loop

  // Request sync when scheduleId changes
  useEffect(() => {
    if (isConnected && scheduleId) {
      syncSchedule();
    }
  }, [isConnected, scheduleId]); // Intentionally omitting syncSchedule

  return {
    // Connection state
    connectionStatus,
    isConnected,
    isLoading,
    isSyncing,
    lastError,
    reconnectAttempts,

    // Schedule data
    scheduleData,

    // Operations
    updateShift,
    bulkUpdateSchedule,
    syncSchedule,
    connect,
    disconnect,

    // Advanced
    offlineQueueLength: offlineQueueRef.current.length,
    clientId: clientIdRef.current,
  };
};
