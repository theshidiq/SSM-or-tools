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

export const useWebSocketStaff = (currentMonthIndex) => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState(null);
  const wsRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `ws://localhost:8080/staff-sync?period=${currentMonthIndex}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 Phase 3: WebSocket connected to Go server');
        setConnectionStatus('connected');
        setLastError(null);
        reconnectAttempts.current = 0;

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
              setStaffMembers(message.payload.staffMembers || []);
              setIsLoading(false);
              console.log(`📊 Phase 3: Synced ${message.payload.staffMembers?.length || 0} staff members`);
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
        console.log('🔌 Phase 3: WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');

        // Implement exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          reconnectAttempts.current++;

          console.log(`🔄 Phase 3: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('❌ Phase 3: Max reconnection attempts reached');
          setLastError('Connection failed after multiple attempts');
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Phase 3: WebSocket error:', error);
        setLastError('WebSocket connection error');
      };

    } catch (error) {
      console.error('❌ Phase 3: Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
      setLastError('Failed to establish WebSocket connection');
    }
  }, [currentMonthIndex, handleStaffUpdate, handleStaffCreate, handleStaffDelete]);

  // Initialize WebSocket connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Staff operation methods
  const updateStaff = useCallback((staffId, changes) => {
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
  }, []);

  const addStaff = useCallback((staffData) => {
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
  }, [currentMonthIndex]);

  const deleteStaff = useCallback((staffId) => {
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
  }, []);

  // Manual reconnection
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttempts.current = 0;
    setConnectionStatus('connecting');
    connect();
  }, [connect]);

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

    // Manual controls
    reconnect,

    // Debug info
    reconnectAttempts: reconnectAttempts.current,
    clientId: clientIdRef.current
  };
};

export default useWebSocketStaff;