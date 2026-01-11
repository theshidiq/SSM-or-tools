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

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// WebSocket connection configuration
const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8080";
const WS_ENDPOINT = "/staff-sync";
const RECONNECT_DELAY_BASE = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Message types
const MESSAGE_TYPES = {
  // Shift operations
  SHIFT_UPDATE: "SHIFT_UPDATE",
  SHIFT_SYNC_REQUEST: "SHIFT_SYNC_REQUEST",
  SHIFT_SYNC_RESPONSE: "SHIFT_SYNC_RESPONSE",
  SHIFT_BROADCAST: "SHIFT_BROADCAST",
  SHIFT_BULK_UPDATE: "SHIFT_BULK_UPDATE",

  // Connection
  CONNECTION_ACK: "CONNECTION_ACK",
  PING: "PING",
  PONG: "PONG",
  ERROR: "ERROR",
};

/**
 * WebSocket Shifts Hook
 *
 * @param {number} currentPeriod - Current period index
 * @param {string} scheduleId - Current schedule ID
 * @param {object} options - Configuration options
 * @returns {object} WebSocket shift operations and state
 */
export const useWebSocketShifts = (
  currentPeriod = 0,
  scheduleId = null,
  options = {},
) => {
  const {
    enabled = true,
    autoReconnect = true,
    enableOfflineQueue = true,
  } = options;

  const queryClient = useQueryClient();

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Schedule state
  const [scheduleData, setScheduleData] = useState({});
  const [syncedPeriodIndex, setSyncedPeriodIndex] = useState(null); // Track which period this data belongs to
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null); // Track when last sync occurred (for AI conflict detection)
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // WebSocket and refs
  const wsRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const clientIdRef = useRef(null);
  const isPeriodSwitchingRef = useRef(false); // Flag to prevent reconnection during period switches
  const currentPeriodRef = useRef(currentPeriod); // Ref to always have latest period for reconnections

  // 🔧 RACE CONDITION FIX: Track pending optimistic updates that haven't been confirmed by server
  const pendingUpdatesRef = useRef(new Map()); // Map<"staffId::dateKey", shiftValue>

  // Update period ref whenever currentPeriod changes
  useEffect(() => {
    currentPeriodRef.current = currentPeriod;
  }, [currentPeriod]);

  /**
   * Calculate reconnection delay with exponential backoff
   */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts),
      RECONNECT_DELAY_MAX,
    );
    return delay;
  }, [reconnectAttempts]);

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback(
    (type, payload) => {
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
        console.warn(
          `⚠️ [WEBSOCKET-SHIFTS] Cannot send ${type}: Not connected`,
        );

        // Queue message for later if offline queue enabled
        if (enableOfflineQueue && type !== MESSAGE_TYPES.SHIFT_SYNC_REQUEST) {
          offlineQueueRef.current.push({
            type,
            payload,
            timestamp: Date.now(),
          });
          console.log(
            `📥 [WEBSOCKET-SHIFTS] Queued ${type} for offline processing`,
          );
        }

        return false;
      }
    },
    [enableOfflineQueue],
  );

  /**
   * Process offline queue after reconnection
   */
  const processOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0) return;

    console.log(
      `📤 [WEBSOCKET-SHIFTS] Processing ${offlineQueueRef.current.length} queued messages`,
    );

    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];

    queue.forEach(({ type, payload }) => {
      sendMessage(type, payload);
    });
  }, [sendMessage]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(
          `📨 [WEBSOCKET-SHIFTS] Received ${message.type}:`,
          message.payload,
        );

        switch (message.type) {
          case MESSAGE_TYPES.CONNECTION_ACK:
            setConnectionStatus("connected");
            setIsConnected(true);
            setReconnectAttempts(0);
            clientIdRef.current =
              message.payload?.clientId || clientIdRef.current;
            console.log(
              `✅ [WEBSOCKET-SHIFTS] Connected (Client ID: ${clientIdRef.current})`,
            );

            // Request initial sync if scheduleId available
            if (scheduleId) {
              sendMessage(MESSAGE_TYPES.SHIFT_SYNC_REQUEST, {
                scheduleId,
                periodIndex: currentPeriod,
              });
              console.log(
                `📡 [WEBSOCKET-SHIFTS] Initial sync requested for schedule ${scheduleId}`,
              );
            } else {
              console.log(
                `⏳ [WEBSOCKET-SHIFTS] Connected but no scheduleId yet - sync will be triggered when available`,
              );
            }

            // Process offline queue
            processOfflineQueue();
            break;

          case MESSAGE_TYPES.SHIFT_SYNC_RESPONSE:
            // 🔧 RACE CONDITION FIX: Merge server data with pending optimistic updates
            const serverData = message.payload.scheduleData || {};

            // Check if we have pending updates that need to be preserved
            if (pendingUpdatesRef.current.size > 0) {
              console.log(
                `🔀 [WEBSOCKET-SHIFTS] Merging server data with ${pendingUpdatesRef.current.size} pending optimistic updates`,
              );

              // Create merged data: server data + pending optimistic updates
              const mergedData = JSON.parse(JSON.stringify(serverData));
              pendingUpdatesRef.current.forEach((shiftValue, key) => {
                const [staffId, dateKey] = key.split('::');
                if (!mergedData[staffId]) mergedData[staffId] = {};
                mergedData[staffId][dateKey] = shiftValue;
                console.log(`  🔹 Preserving pending: ${staffId} → ${dateKey} = "${shiftValue}"`);
              });

              setScheduleData(mergedData);

              // Update React Query cache with merged data
              queryClient.setQueryData(
                ["schedule", "data", currentPeriod],
                (old) => ({
                  ...old,
                  schedule: mergedData,
                  loadedAt: Date.now(),
                }),
              );
            } else {
              // No pending updates, safe to use server data directly
              setScheduleData(serverData);

              // Update React Query cache
              queryClient.setQueryData(
                ["schedule", "data", currentPeriod],
                (old) => ({
                  ...old,
                  schedule: serverData,
                  loadedAt: Date.now(),
                }),
              );
            }

            setSyncedPeriodIndex(message.payload.periodIndex ?? currentPeriod); // Track which period this data is for
            setLastSyncTimestamp(Date.now()); // Track timestamp for AI conflict detection
            setIsSyncing(false);
            console.log(
              `✅ [WEBSOCKET-SHIFTS] Schedule synced for period ${message.payload.periodIndex ?? currentPeriod}: ${Object.keys(serverData).length} staff members`,
            );
            break;

          case MESSAGE_TYPES.SHIFT_BROADCAST:
            // Real-time update from another client (or server confirming our update)
            const { staffId: broadcastStaffId, dateKey: broadcastDateKey, shiftValue: broadcastShiftValue } = message.payload;
            const broadcastKey = `${broadcastStaffId}::${broadcastDateKey}`;

            // 🔧 RACE CONDITION FIX: Remove from pending if this confirms our optimistic update
            if (pendingUpdatesRef.current.has(broadcastKey)) {
              const pendingValue = pendingUpdatesRef.current.get(broadcastKey);
              if (pendingValue === broadcastShiftValue) {
                console.log(`✅ [WEBSOCKET-SHIFTS] Server confirmed optimistic update: ${broadcastStaffId} → ${broadcastDateKey} = "${broadcastShiftValue}"`);
                pendingUpdatesRef.current.delete(broadcastKey);
              } else {
                console.warn(`⚠️ [WEBSOCKET-SHIFTS] Server value differs from pending: expected "${pendingValue}", got "${broadcastShiftValue}"`);
                // Server wins - remove from pending
                pendingUpdatesRef.current.delete(broadcastKey);
              }
            }

            // MUST create new nested object references for React immutability
            setScheduleData((prev) => ({
              ...prev,
              [broadcastStaffId]: {
                ...(prev[broadcastStaffId] || {}),
                [broadcastDateKey]: broadcastShiftValue,
              },
            }));

            console.log(
              `📡 [WEBSOCKET-SHIFTS] Received broadcast update: ${broadcastStaffId} → ${broadcastDateKey} = "${broadcastShiftValue}"`,
            );

            // Invalidate React Query cache to trigger refetch
            queryClient.invalidateQueries({
              queryKey: ["schedule", "data", currentPeriod],
            });
            break;

          case MESSAGE_TYPES.PONG:
            // Heartbeat response - connection is healthy
            console.log(`💓 [WEBSOCKET-SHIFTS] Heartbeat received (latency: ${Date.now() - (message.payload?.timestamp || 0)}ms)`);
            break;

          case MESSAGE_TYPES.ERROR:
            console.error(
              `❌ [WEBSOCKET-SHIFTS] Server error:`,
              message.payload,
            );
            setLastError(message.payload.error || "Unknown error");
            setIsSyncing(false);
            break;

          default:
            console.log(
              `📨 [WEBSOCKET-SHIFTS] Unhandled message type: ${message.type}`,
            );
        }
      } catch (error) {
        console.error(`❌ [WEBSOCKET-SHIFTS] Failed to parse message:`, error);
      }
    },
    [scheduleId, currentPeriod, sendMessage, processOfflineQueue, queryClient],
  );

  /**
   * Start heartbeat to keep connection alive
   * Uses lightweight PING/PONG instead of full schedule sync
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send lightweight PING to check connection health
        // No schedule data sync - only connection verification
        sendMessage(MESSAGE_TYPES.PING, {
          timestamp: Date.now(),
        });
      }
    }, HEARTBEAT_INTERVAL);
  }, [sendMessage]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");
    setIsLoading(true);

    try {
      const url = `${WS_URL}${WS_ENDPOINT}?period=${currentPeriodRef.current}`;
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
        setLastError("WebSocket connection error");
        setConnectionStatus("error");
      };

      ws.onclose = (event) => {
        console.log(
          `🔌 [WEBSOCKET-SHIFTS] WebSocket closed:`,
          event.code,
          event.reason,
        );
        setIsConnected(false);
        setConnectionStatus("disconnected");
        setIsLoading(false);

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Auto-reconnect if enabled and not during period switch
        if (autoReconnect && enabled && !isPeriodSwitchingRef.current) {
          const delay = getReconnectDelay();
          console.log(`🔄 [WEBSOCKET-SHIFTS] Reconnecting in ${delay}ms...`);

          reconnectTimerRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        } else if (isPeriodSwitchingRef.current) {
          console.log(`⏸️ [WEBSOCKET-SHIFTS] Skipping auto-reconnect during period switch`);
        }
      };
    } catch (error) {
      console.error(`❌ [WEBSOCKET-SHIFTS] Failed to create WebSocket:`, error);
      setLastError(error.message);
      setConnectionStatus("error");
      setIsLoading(false);
    }
  }, [
    enabled,
    currentPeriod,
    autoReconnect,
    getReconnectDelay,
    handleMessage,
    startHeartbeat,
  ]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback((isPeriodSwitch = false) => {
    // Set flag if this is a period switch to prevent auto-reconnect
    if (isPeriodSwitch) {
      isPeriodSwitchingRef.current = true;
      console.log(`🔄 [WEBSOCKET-SHIFTS] Period switch detected - preventing auto-reconnect`);
    }

    if (wsRef.current) {
      // Only close if connection is open or connecting
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
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
    setConnectionStatus("disconnected");
  }, []);

  /**
   * Update a single shift cell
   */
  const updateShift = useCallback(
    (staffId, dateKey, shiftValue) => {
      if (!scheduleId) {
        console.error(
          `❌ [WEBSOCKET-SHIFTS] Cannot update shift: No scheduleId`,
        );
        return Promise.reject(new Error("No scheduleId"));
      }

      console.log(
        `📝 [WEBSOCKET-SHIFTS] Updating shift: ${staffId} → ${dateKey} = "${shiftValue}"`,
      );

      // 🔧 RACE CONDITION FIX: Track this as a pending update before server confirms
      const pendingKey = `${staffId}::${dateKey}`;
      pendingUpdatesRef.current.set(pendingKey, shiftValue);
      console.log(`📌 [WEBSOCKET-SHIFTS] Added to pending: ${pendingKey} = "${shiftValue}" (total pending: ${pendingUpdatesRef.current.size})`);

      // Optimistic update - MUST create new nested object references for React
      setScheduleData((prev) => {
        return {
          ...prev,
          [staffId]: {
            ...(prev[staffId] || {}),
            [dateKey]: shiftValue,
          },
        };
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
        pendingUpdatesRef.current.delete(pendingKey);
        setScheduleData((prev) => {
          if (!prev[staffId]) return prev;
          const { [dateKey]: removed, ...restDates } = prev[staffId];
          return {
            ...prev,
            [staffId]: restDates,
          };
        });
        return Promise.reject(
          new Error("Not connected and offline queue disabled"),
        );
      }

      return Promise.resolve();
    },
    [scheduleId, currentPeriod, sendMessage, enableOfflineQueue],
  );

  /**
   * Bulk update entire schedule
   */
  const bulkUpdateSchedule = useCallback(
    (newScheduleData) => {
      if (!scheduleId) {
        console.error(
          `❌ [WEBSOCKET-SHIFTS] Cannot bulk update: No scheduleId`,
        );
        return Promise.reject(new Error("No scheduleId"));
      }

      console.log(
        `📦 [WEBSOCKET-SHIFTS] Bulk updating schedule: ${Object.keys(newScheduleData).length} staff members`,
      );

      // Optimistic update
      setScheduleData(newScheduleData);

      // Send to server
      const success = sendMessage(MESSAGE_TYPES.SHIFT_BULK_UPDATE, {
        scheduleId,
        scheduleData: newScheduleData,
        periodIndex: currentPeriod,
      });

      if (!success && !enableOfflineQueue) {
        return Promise.reject(
          new Error("Not connected and offline queue disabled"),
        );
      }

      return Promise.resolve();
    },
    [scheduleId, currentPeriod, sendMessage, enableOfflineQueue],
  );

  /**
   * Request schedule sync from server
   */
  const syncSchedule = useCallback(() => {
    if (!scheduleId) {
      console.log(`⏳ [WEBSOCKET-SHIFTS] Skipping sync: No scheduleId`);
      return;
    }

    // Don't attempt sync if not connected
    if (!isConnected || wsRef.current?.readyState !== WebSocket.OPEN) {
      console.log(
        `⏳ [WEBSOCKET-SHIFTS] Skipping sync: Not connected (will sync after reconnection)`,
      );
      return;
    }

    setIsSyncing(true);
    sendMessage(MESSAGE_TYPES.SHIFT_SYNC_REQUEST, {
      scheduleId,
      periodIndex: currentPeriod,
    });
  }, [scheduleId, currentPeriod, sendMessage, isConnected]);

  // Connect on mount and when enabled/period changes
  useEffect(() => {
    if (enabled) {
      // Clear the period switching flag and connect
      isPeriodSwitchingRef.current = false;

      // Small delay to ensure cleanup is complete before new connection
      const timer = setTimeout(() => {
        connect();
      }, 50);

      return () => {
        clearTimeout(timer);
      };
    }

    return () => {
      // Mark as period switch cleanup to prevent auto-reconnect
      disconnect(true);
    };
  }, [enabled, currentPeriod]); // Intentionally omitting connect/disconnect to avoid infinite loop

  // Request sync when scheduleId changes
  useEffect(() => {
    if (isConnected && scheduleId) {
      syncSchedule();
    }
  }, [isConnected, scheduleId]); // Intentionally omitting syncSchedule

  /**
   * Clear all pending optimistic updates
   * Call this when clearing the schedule to prevent old updates from being merged back
   */
  const clearPendingUpdates = useCallback(() => {
    const pendingCount = pendingUpdatesRef.current.size;
    if (pendingCount > 0) {
      console.log(`🧹 [WEBSOCKET-SHIFTS] Clearing ${pendingCount} pending optimistic updates`);
      pendingUpdatesRef.current.clear();
    }
  }, []);

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
    syncedPeriodIndex, // Which period this data belongs to
    lastSyncTimestamp, // When last sync occurred (for AI conflict detection)

    // Operations
    updateShift,
    bulkUpdateSchedule,
    syncSchedule,
    connect,
    disconnect,
    clearPendingUpdates, // Clear pending updates when schedule is cleared

    // Advanced
    offlineQueueLength: offlineQueueRef.current.length,
    clientId: clientIdRef.current,
  };
};
