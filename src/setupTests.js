// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * TensorFlow.js Test Environment Setup
 * Mock TensorFlow.js for Jest compatibility and prevent property override errors
 */

// Mock TensorFlow.js for Jest environment
jest.mock("@tensorflow/tfjs", () => {
  const mockTensor = {
    id: Math.random().toString(),
    shape: [1, 1],
    dtype: "float32",
    size: 1,
    isDisposed: false,
    dispose: jest.fn(),
  };

  const mockEngine = {
    startScope: jest.fn(),
    endScope: jest.fn(() => mockTensor),
    state: {
      tensorInfo: new Map(),
    },
  };

  return {
    ready: jest.fn(() => Promise.resolve()),
    tensor: jest.fn(() => mockTensor),
    memory: jest.fn(() => ({
      numBytes: 1024 * 1024,
      numTensors: 10,
      numDataBuffers: 5,
      unreliable: false,
    })),
    tidy: jest.fn((fn) => fn()),
    dispose: jest.fn(),
    engine: jest.fn(() => mockEngine),
    getBackend: jest.fn(() => "cpu"),
    env: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(() => true),
      getFlags: jest.fn(() => ({})),
    })),
    util: {
      createScalarValue: jest.fn(),
    },
  };
});

// Mock complete performance API for tests
if (!global.performance) {
  global.performance = {};
}

// Mock performance.memory
if (!global.performance.memory) {
  global.performance.memory = {
    usedJSHeapSize: 10 * 1024 * 1024, // 10MB
    totalJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
  };
}

// Mock performance.getEntriesByType for PerformanceMonitor
if (!global.performance.getEntriesByType) {
  global.performance.getEntriesByType = jest.fn((type) => {
    if (type === "measure") {
      return [
        {
          name: "test-measure",
          entryType: "measure",
          startTime: 0,
          duration: 100,
        },
      ];
    }
    return [];
  });
}

// Mock performance.now
if (!global.performance.now) {
  global.performance.now = jest.fn(() => Date.now());
}

// Mock performance.mark
if (!global.performance.mark) {
  global.performance.mark = jest.fn();
}

// Mock performance.measure
if (!global.performance.measure) {
  global.performance.measure = jest.fn();
}

// Mock PerformanceObserver
global.PerformanceObserver = class MockPerformanceObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe(options) {
    // Mock implementation - don't actually observe
  }

  disconnect() {
    // Mock implementation
  }
};

// Mock Web Workers for tests
global.Worker = class MockWorker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(data) {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            type: "success",
            result: data,
            processingTime: 100,
          },
        });
      }
    }, 10);
  }

  terminate() {
    // Mock termination
  }
};

// Suppress ML-related console output during tests (reduce noise)
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  const message = args.join(" ");
  if (
    !message.includes("🧠") &&
    !message.includes("TensorFlow") &&
    !message.includes("Memory Manager") &&
    !message.includes("Performance") &&
    !message.includes("🚀") &&
    !message.includes("✅") &&
    !message.includes("⚠️")
  ) {
    originalConsoleLog.apply(console, args);
  }
};

console.warn = (...args) => {
  const message = args.join(" ");
  if (
    !message.includes("TensorFlow") &&
    !message.includes("Memory") &&
    !message.includes("Performance Observer") &&
    !message.includes("hooks") &&
    !message.includes("engine") &&
    !message.includes("tensor") &&
    !message.includes("Error collecting metrics") &&
    !message.includes("performance.getEntriesByType") &&
    !message.includes("Unknown worker message type") &&
    !message.includes("PerformanceObserver not supported")
  ) {
    originalConsoleWarn.apply(console, args);
  }
};

// Setup longer timeout for ML tests
jest.setTimeout(30000); // 30 seconds

console.log(
  "✅ Test environment setup completed with TensorFlow.js compatibility mocks",
);
