// Testing Strategy Implementation: WebSocket Mock Configuration
// Mock WebSocket implementation for testing staff management workflows

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.protocol = '';

    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // Mock behavior configuration
    this.autoConnect = true;
    this.connectionDelay = 10;
    this.messageDelay = 5;
    this.shouldFailConnection = false;
    this.shouldFailRandomly = false;
    this.failureRate = 0.01; // 1% failure rate

    // Message tracking for testing
    this.sentMessages = [];
    this.receivedMessages = [];
    this.connectionAttempts = 0;
    this.reconnectAttempts = 0;

    // Simulate connection
    if (this.autoConnect) {
      this._simulateConnection();
    }
  }

  // WebSocket API methods
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    this.sentMessages.push({
      data,
      timestamp: new Date().toISOString(),
      parsed: this._tryParseJSON(data)
    });

    // Simulate message sending with optional failure
    if (this.shouldFailRandomly && Math.random() < this.failureRate) {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
      }, this.messageDelay);
      return;
    }

    // Auto-respond for testing scenarios
    this._handleAutoResponse(data);
  }

  close(code, reason) {
    if (this.readyState === MockWebSocket.CLOSED ||
        this.readyState === MockWebSocket.CLOSING) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({
          code: code || 1000,
          reason: reason || '',
          wasClean: true
        });
      }
    }, 10);
  }

  // Mock-specific methods for testing
  simulateMessage(data) {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      this.receivedMessages.push({
        data: messageData,
        timestamp: new Date().toISOString(),
        parsed: this._tryParseJSON(messageData)
      });

      setTimeout(() => {
        this.onmessage({
          data: messageData,
          type: 'message',
          target: this
        });
      }, this.messageDelay);
    }
  }

  simulateConnectionFailure() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    if (this.onclose) {
      this.onclose({
        code: 1006,
        reason: 'Connection failed',
        wasClean: false
      });
    }
  }

  simulateReconnection() {
    this.reconnectAttempts++;
    this._simulateConnection();
  }

  // Configuration methods for testing
  setAutoResponse(enabled) {
    this.autoResponse = enabled;
  }

  setFailureRate(rate) {
    this.failureRate = Math.max(0, Math.min(1, rate));
    this.shouldFailRandomly = rate > 0;
  }

  setConnectionDelay(delay) {
    this.connectionDelay = delay;
  }

  setMessageDelay(delay) {
    this.messageDelay = delay;
  }

  // Testing utilities
  getMessageHistory() {
    return {
      sent: this.sentMessages,
      received: this.receivedMessages,
      connectionAttempts: this.connectionAttempts,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  clearMessageHistory() {
    this.sentMessages = [];
    this.receivedMessages = [];
    this.connectionAttempts = 0;
    this.reconnectAttempts = 0;
  }

  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getLastReceivedMessage() {
    return this.receivedMessages[this.receivedMessages.length - 1];
  }

  waitForMessage(timeout = 1000) {
    return new Promise((resolve, reject) => {
      const startCount = this.receivedMessages.length;
      const checkForMessage = () => {
        if (this.receivedMessages.length > startCount) {
          resolve(this.getLastReceivedMessage());
        } else if (timeout <= 0) {
          reject(new Error('Message timeout'));
        } else {
          timeout -= 10;
          setTimeout(checkForMessage, 10);
        }
      };
      checkForMessage();
    });
  }

  // Private methods
  _simulateConnection() {
    this.connectionAttempts++;
    this.readyState = MockWebSocket.CONNECTING;

    setTimeout(() => {
      if (this.shouldFailConnection) {
        this.simulateConnectionFailure();
        return;
      }

      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({
          type: 'open',
          target: this
        });
      }

      // Send connection acknowledgment
      this.simulateMessage({
        type: 'CONNECTION_ACK',
        payload: {
          status: 'connected',
          clientId: this._extractClientId()
        },
        timestamp: new Date().toISOString(),
        clientId: 'server'
      });

    }, this.connectionDelay);
  }

  _handleAutoResponse(data) {
    if (!this.autoResponse) return;

    try {
      const message = JSON.parse(data);
      const response = this._generateAutoResponse(message);

      if (response) {
        setTimeout(() => {
          this.simulateMessage(response);
        }, this.messageDelay);
      }
    } catch (error) {
      // Ignore invalid JSON
    }
  }

  _generateAutoResponse(message) {
    switch (message.type) {
      case 'SYNC_REQUEST':
        return {
          type: 'SYNC_RESPONSE',
          payload: {
            staffMembers: this._getMockStaffMembers(),
            period: message.payload?.period || 0,
            version: 1,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString(),
          clientId: 'server'
        };

      case 'STAFF_CREATE':
        return {
          type: 'STAFF_CREATE',
          payload: {
            ...message.payload,
            id: `mock-staff-${Date.now()}`,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString(),
          clientId: 'server'
        };

      case 'STAFF_UPDATE':
        return {
          type: 'STAFF_UPDATE',
          payload: {
            staffId: message.payload.staffId,
            changes: {
              ...message.payload.changes,
              version: (message.payload.version || 1) + 1,
              updatedAt: new Date().toISOString()
            }
          },
          timestamp: new Date().toISOString(),
          clientId: 'server'
        };

      case 'STAFF_DELETE':
        return {
          type: 'STAFF_DELETE',
          payload: {
            staffId: message.payload.staffId,
            success: true
          },
          timestamp: new Date().toISOString(),
          clientId: 'server'
        };

      default:
        return null;
    }
  }

  _getMockStaffMembers() {
    return [
      {
        id: 'mock-staff-1',
        name: 'Mock Staff 1',
        position: 'Server',
        department: 'Front of House',
        status: '社員',
        version: 1
      },
      {
        id: 'mock-staff-2',
        name: 'Mock Staff 2',
        position: 'Chef',
        department: 'Kitchen',
        status: '社員',
        version: 1
      }
    ];
  }

  _extractClientId() {
    const url = new URL(this.url, 'ws://localhost');
    return url.searchParams.get('clientId') || 'mock-client';
  }

  _tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
}

// Global WebSocket replacement for testing
const createMockWebSocket = (config = {}) => {
  const mockWs = new MockWebSocket('ws://localhost:8080/staff-sync');

  // Apply configuration
  if (config.autoResponse !== undefined) mockWs.setAutoResponse(config.autoResponse);
  if (config.failureRate !== undefined) mockWs.setFailureRate(config.failureRate);
  if (config.connectionDelay !== undefined) mockWs.setConnectionDelay(config.connectionDelay);
  if (config.messageDelay !== undefined) mockWs.setMessageDelay(config.messageDelay);
  if (config.shouldFailConnection !== undefined) mockWs.shouldFailConnection = config.shouldFailConnection;

  return mockWs;
};

// Jest mock setup
const setupWebSocketMock = () => {
  global.WebSocket = MockWebSocket;
  global.MockWebSocket = MockWebSocket;
  global.createMockWebSocket = createMockWebSocket;

  return MockWebSocket;
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MockWebSocket,
    createMockWebSocket,
    setupWebSocketMock
  };
}

if (typeof window !== 'undefined') {
  window.MockWebSocket = MockWebSocket;
  window.createMockWebSocket = createMockWebSocket;
  window.setupWebSocketMock = setupWebSocketMock;
}