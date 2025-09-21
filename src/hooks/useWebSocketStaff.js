/**
 * Phase 3: WebSocket Staff Management Hook
 * Simplified hook replacing complex state management layers
 * Connects directly to Go WebSocket server for real-time staff operations
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket message types matching Go server implementation
const MESSAGE_TYPES = {
  SYNC_REQUEST: 'SYNC_REQUEST',
  SYNC_RESPONSE: 'SYNC_RESPONSE',
  STAFF_UPDATE: 'STAFF_UPDATE',
  STAFF_CREATE: 'STAFF_CREATE',
  STAFF_DELETE: 'STAFF_DELETE',
  CONNECTION_ACK: 'CONNECTION_ACK',
  ERROR: 'ERROR'
};

export const useWebSocketStaff = (currentMonthIndex, options = {}) => {
  const { enabled = true } = options;
  const [staffMembers, setStaffMembers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState(null);
  const wsRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3; // Reduced from 5 to 3
  const reconnectTimeoutRef = useRef(null);
  const connectionFailedPermanently = useRef(false);
  const initialConnectionTimer = useRef(null);
  const connectionStartTime = useRef(Date.now());

  // Message handlers
  const handleStaffUpdate = useCallback((payload) => {
    setStaffMembers(prev =>
      prev.map(staff =>
        staff.id === payload.staffId
          ? { ...staff, ...payload.changes }
          : staff
      )
    );
  }, []);

  const handleStaffCreate = useCallback((payload) => {
    setStaffMembers(prev => [...prev, payload]);
  }, []);

  const handleStaffDelete = useCallback((payload) => {
    setStaffMembers(prev =>
      prev.filter(staff => staff.id !== payload.staffId)
    );
  }, []);

  // WebSocket connection management
  const connect = useCallback(() => {
    // Don't attempt connection if disabled via options
    if (!enabled) {
      console.log('🚫 Phase 3: WebSocket disabled via options, skipping connection attempt');
      setConnectionStatus('disabled');
      setIsLoading(false);
      setLastError('WebSocket disabled via feature flag');
      return;
    }

    // Don't attempt connection if permanently failed
    if (connectionFailedPermanently.current) {
      console.log('🚫 Phase 3: WebSocket permanently disabled, skipping connection attempt');
      setConnectionStatus('failed_permanently');
      setIsLoading(false);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close any existing connection before creating new one
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Set absolute timeout for initial connection (10 seconds)
    if (!initialConnectionTimer.current) {
      initialConnectionTimer.current = setTimeout(() => {
        console.log('⏰ Phase 3: WebSocket connection timeout reached, permanently disabling');
        connectionFailedPermanently.current = true;
        setConnectionStatus('failed_permanently');
        setLastError('Connection timeout - falling back to database mode');
        setIsLoading(false);

        if (wsRef.current) {
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      }, 10000); // 10 second timeout
    }

    try {
      const wsUrl = `ws://localhost:8080/staff-sync?period=${currentMonthIndex}`;
      console.log(`🔌 Phase 3: Creating WebSocket connection to ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set connection timeout per attempt (3 seconds)
      const connectionTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('⏰ Phase 3: Connection attempt timeout, closing socket');
          ws.close();
        }
      }, 3000);

      ws.onopen = () => {
        console.log('🔌 Phase 3: WebSocket connected to Go server');
        clearTimeout(connectionTimer);
        setConnectionStatus('connected');
        setLastError(null);
        reconnectAttempts.current = 0;

        // Clear the initial connection timeout since we connected successfully
        if (initialConnectionTimer.current) {
          clearTimeout(initialConnectionTimer.current);
          initialConnectionTimer.current = null;
        }

        // Request initial state sync
        ws.send(JSON.stringify({
          type: MESSAGE_TYPES.SYNC_REQUEST,
          payload: { period: currentMonthIndex },
          timestamp: new Date().toISOString(),
          clientId: clientIdRef.current
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case MESSAGE_TYPES.STAFF_UPDATE:
              handleStaffUpdate(message.payload);
              break;
            case MESSAGE_TYPES.STAFF_CREATE:
              handleStaffCreate(message.payload);
              break;
            case MESSAGE_TYPES.STAFF_DELETE:
              handleStaffDelete(message.payload);
              break;
            case MESSAGE_TYPES.SYNC_RESPONSE:
              // Handle both 'staff' (from Go server) and 'staffMembers' (legacy) fields
              const staffData = message.payload.staff || message.payload.staffMembers || [];
              setStaffMembers(staffData);
              setIsLoading(false);
              console.log(`📊 Phase 3: Synced ${staffData.length} staff members from ${message.payload.period ? `period ${message.payload.period}` : 'server'}`);
              break;
            case MESSAGE_TYPES.CONNECTION_ACK:
              console.log('✅ Phase 3: Connection acknowledged by Go server');
              break;
            case MESSAGE_TYPES.ERROR:
              console.error('❌ Phase 3: Server error:', message.payload);
              setLastError(message.payload.message);
              break;
            default:
              console.warn('⚠️ Phase 3: Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Phase 3: Failed to parse WebSocket message:', error);
          setLastError('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 Phase 3: WebSocket disconnected: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`);
        clearTimeout(connectionTimer);
        setConnectionStatus('disconnected');

        // Check if we should permanently disable reconnection
        if (connectionFailedPermanently.current) {
          console.log('🚫 Phase 3: WebSocket permanently disabled, no reconnection');
          setConnectionStatus('failed_permanently');
          setIsLoading(false);
          return;
        }

        // Check if we've been trying for too long (total time > 15 seconds)
        const totalTimeElapsed = Date.now() - connectionStartTime.current;
        if (totalTimeElapsed > 15000) {
          console.log('⏰ Phase 3: Total connection time exceeded, permanently disabling WebSocket');
          connectionFailedPermanently.current = true;
          setConnectionStatus('failed_permanently');
          setLastError('Connection failed - switching to database mode');
          setIsLoading(false);
          return;
        }

        // Handle different close codes
        if (event.code === 1006) {
          console.log('⚠️ Phase 3: Abnormal closure (1006) - likely connection race condition');
        }

        // Implement exponential backoff reconnection with stricter limits
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s
          reconnectAttempts.current++;

          console.log(`🔄 Phase 3: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('❌ Phase 3: Max reconnection attempts reached, permanently disabling');
          connectionFailedPermanently.current = true;
          setConnectionStatus('failed_permanently');
          setLastError('Connection failed after multiple attempts - switching to database mode');
          setIsLoading(false);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Phase 3: WebSocket error:', error);
        clearTimeout(connectionTimer);
        setLastError('WebSocket connection error');
      };

    } catch (error) {
      console.error('❌ Phase 3: Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
      setLastError('Failed to establish WebSocket connection');
    }
  }, [enabled, currentMonthIndex, handleStaffUpdate, handleStaffCreate, handleStaffDelete]);

  // Initialize WebSocket connection - debounced to prevent rapid re-connections
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      connect();
    }, 100); // Small delay to prevent rapid reconnections on currentMonthIndex changes

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

  // Staff operation methods
  const updateStaff = useCallback((staffId, changes) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3: Staff update blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.STAFF_UPDATE,
        payload: { staffId, changes },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3: Sent staff update:', { staffId, changes });

      return Promise.resolve(); // Optimistic update handled by server response
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3: Failed to update staff - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  const addStaff = useCallback((staffData) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3: Staff create blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.STAFF_CREATE,
        payload: {
          ...staffData,
          period: currentMonthIndex
        },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3: Sent staff create:', staffData);

      return Promise.resolve(); // Optimistic update handled by server response
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3: Failed to create staff - not connected');
      return Promise.reject(error);
    }
  }, [enabled, currentMonthIndex]);

  const deleteStaff = useCallback((staffId) => {
    if (!enabled) {
      const error = new Error('WebSocket disabled');
      console.log('🚫 Phase 3: Staff delete blocked - WebSocket disabled');
      return Promise.reject(error);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MESSAGE_TYPES.STAFF_DELETE,
        payload: { staffId },
        timestamp: new Date().toISOString(),
        clientId: clientIdRef.current
      };

      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Phase 3: Sent staff delete:', staffId);

      return Promise.resolve(); // Optimistic update handled by server response
    } else {
      const error = new Error('WebSocket not connected');
      console.error('❌ Phase 3: Failed to delete staff - not connected');
      return Promise.reject(error);
    }
  }, [enabled]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    if (!enabled) {
      console.log('🚫 Phase 3: Reconnection blocked - WebSocket disabled');
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttempts.current = 0;
    setConnectionStatus('connecting');
    connect();
  }, [enabled, connect]);

  return {
    // Core data
    staffMembers,

    // Operations
    updateStaff,
    addStaff,
    deleteStaff,

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

export default useWebSocketStaff;