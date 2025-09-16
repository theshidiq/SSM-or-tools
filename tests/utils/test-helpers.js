// Testing Strategy Implementation: Test Utilities and Helpers
// Common utilities for testing staff management functionality

import staffData from '../fixtures/staff-data.json';
import wsMessages from '../fixtures/websocket-messages.json';

// Performance measurement utilities
export const measurePerformance = (operation) => {
  const start = performance.now();
  return {
    start,
    end: () => performance.now() - start,
    validate: (maxTime) => {
      const duration = performance.now() - start;
      return duration <= maxTime;
    },
    getDuration: () => performance.now() - start
  };
};

// WebSocket message builders
export const createWSMessage = (type, payload, options = {}) => {
  const template = wsMessages.messageTemplates[type];
  if (!template) {
    throw new Error(`Unknown message type: ${type}`);
  }

  return {
    ...template,
    payload: { ...template.payload, ...payload },
    timestamp: options.timestamp || new Date().toISOString(),
    clientId: options.clientId || 'test-client'
  };
};

export const createBulkMessages = (type, count, payloadGenerator) => {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const payload = payloadGenerator ? payloadGenerator(i) : {};
    messages.push(createWSMessage(type, payload, {
      clientId: `bulk-client-${i}`,
      timestamp: new Date(Date.now() + i).toISOString()
    }));
  }
  return messages;
};

// Staff data generators
export const createTestStaffMember = (overrides = {}) => {
  const template = staffData.testStaffTemplates.newEmployee;
  return {
    ...template,
    id: `test-staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `Test Staff ${Date.now()}`,
    position: 'Test Position',
    department: 'Test Department',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides
  };
};

export const createConflictScenario = (scenarioName = 'scenario1') => {
  const scenario = staffData.conflictTestData[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown conflict scenario: ${scenarioName}`);
  }
  return scenario;
};

// Race condition testing utilities
export const simulateRaceCondition = async (operations, delay = 10) => {
  const results = await Promise.allSettled(
    operations.map((op, index) =>
      new Promise(resolve => {
        setTimeout(() => {
          resolve(op(index));
        }, index * delay);
      })
    )
  );
  return results;
};

export const createConcurrentOperations = (operationFactory, count) => {
  return Array.from({ length: count }, (_, index) => operationFactory(index));
};

// Async testing utilities
export const waitForCondition = (conditionFn, timeout = 5000, interval = 100) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkCondition = () => {
      if (conditionFn()) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(checkCondition, interval);
      }
    };
    checkCondition();
  });
};

export const waitForWebSocketMessage = (mockWs, predicate = () => true, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('WebSocket message timeout'));
    }, timeout);

    const originalOnMessage = mockWs.onmessage;
    mockWs.onmessage = (event) => {
      if (originalOnMessage) originalOnMessage(event);

      try {
        const data = JSON.parse(event.data);
        if (predicate(data)) {
          clearTimeout(timeoutId);
          resolve(data);
        }
      } catch (error) {
        // Continue waiting for valid JSON
      }
    };
  });
};

// KPI validation utilities
export const validateResponseTime = (startTime, maxTime = 50) => {
  const duration = Date.now() - startTime;
  return {
    duration,
    isWithinLimit: duration <= maxTime,
    exceedsBy: duration > maxTime ? duration - maxTime : 0
  };
};

export const validateSyncTime = (startTime, maxTime = 100) => {
  const duration = Date.now() - startTime;
  return {
    duration,
    isWithinLimit: duration <= maxTime,
    exceedsBy: duration > maxTime ? duration - maxTime : 0
  };
};

export const calculateSuccessRate = (successful, total) => {
  if (total === 0) return 0;
  return (successful / total) * 100;
};

// Test data cleanup utilities
export const cleanupTestData = (staffMembers, testPattern = /test|mock|temp/i) => {
  return staffMembers.filter(staff => !testPattern.test(staff.name));
};

export const findTestStaffMembers = (staffMembers, testPattern = /test|mock|temp/i) => {
  return staffMembers.filter(staff => testPattern.test(staff.name));
};

// Performance benchmarking
export class PerformanceBenchmark {
  constructor(name) {
    this.name = name;
    this.metrics = [];
    this.startTime = null;
  }

  start() {
    this.startTime = performance.now();
    return this;
  }

  end() {
    if (this.startTime === null) {
      throw new Error('Benchmark not started');
    }
    const duration = performance.now() - this.startTime;
    this.metrics.push(duration);
    this.startTime = null;
    return duration;
  }

  getStats() {
    if (this.metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0 };
    }

    const sorted = [...this.metrics].sort((a, b) => a - b);
    return {
      count: this.metrics.length,
      average: this.metrics.reduce((sum, val) => sum + val, 0) / this.metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  validateKPI(maxTime) {
    const stats = this.getStats();
    return {
      averageWithinKPI: stats.average <= maxTime,
      p95WithinKPI: stats.p95 <= maxTime,
      p99WithinKPI: stats.p99 <= maxTime,
      stats
    };
  }

  reset() {
    this.metrics = [];
    this.startTime = null;
  }
}

// Load testing utilities
export const generateLoadTestData = (options = {}) => {
  const {
    staffCount = 100,
    updateCount = 50,
    clientCount = 10,
    operationTypes = ['create', 'update', 'delete']
  } = options;

  const operations = [];

  for (let i = 0; i < updateCount; i++) {
    const operationType = operationTypes[i % operationTypes.length];
    const clientId = `load-client-${i % clientCount}`;

    switch (operationType) {
      case 'create':
        operations.push({
          type: 'STAFF_CREATE',
          payload: createTestStaffMember({ name: `Load Test Staff ${i}` }),
          clientId,
          timestamp: new Date(Date.now() + i * 100).toISOString()
        });
        break;

      case 'update':
        operations.push({
          type: 'STAFF_UPDATE',
          payload: {
            staffId: `load-staff-${i % staffCount}`,
            changes: {
              name: `Updated Load Test Staff ${i}`,
              position: `Position ${i % 5}`
            }
          },
          clientId,
          timestamp: new Date(Date.now() + i * 100).toISOString()
        });
        break;

      case 'delete':
        operations.push({
          type: 'STAFF_DELETE',
          payload: {
            staffId: `load-staff-${i % staffCount}`
          },
          clientId,
          timestamp: new Date(Date.now() + i * 100).toISOString()
        });
        break;
    }
  }

  return operations;
};

// Conflict detection utilities
export const detectConflicts = (localStaff, remoteStaff) => {
  const conflicts = [];

  if (localStaff.id !== remoteStaff.id) {
    throw new Error('Cannot compare staff members with different IDs');
  }

  const fields = ['name', 'position', 'department', 'status'];

  fields.forEach(field => {
    if (localStaff[field] !== remoteStaff[field]) {
      if (localStaff[field] && remoteStaff[field]) {
        conflicts.push({
          field,
          localValue: localStaff[field],
          remoteValue: remoteStaff[field]
        });
      }
    }
  });

  return conflicts;
};

// Error simulation utilities
export const createErrorScenario = (errorType = 'network') => {
  const scenarios = {
    network: {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
      recoverable: true,
      retryDelay: 1000
    },
    server: {
      code: 'SERVER_ERROR',
      message: 'Internal server error',
      recoverable: false,
      retryDelay: 0
    },
    conflict: {
      code: 'CONFLICT_ERROR',
      message: 'Data conflict detected',
      recoverable: true,
      retryDelay: 100
    },
    validation: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid data provided',
      recoverable: false,
      retryDelay: 0
    }
  };

  return scenarios[errorType] || scenarios.network;
};

export default {
  measurePerformance,
  createWSMessage,
  createBulkMessages,
  createTestStaffMember,
  createConflictScenario,
  simulateRaceCondition,
  createConcurrentOperations,
  waitForCondition,
  waitForWebSocketMessage,
  validateResponseTime,
  validateSyncTime,
  calculateSuccessRate,
  cleanupTestData,
  findTestStaffMembers,
  PerformanceBenchmark,
  generateLoadTestData,
  detectConflicts,
  createErrorScenario
};