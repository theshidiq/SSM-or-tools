/**
 * TensorMemoryManager.js (DEPRECATED - OR-Tools Now Primary)
 *
 * This module is kept for backward compatibility only.
 * The application now uses OR-Tools via WebSocket for schedule optimization.
 * No TensorFlow memory management needed.
 */

class TensorMemoryManager {
  constructor() {
    this.isInitialized = false;
    console.log("[TensorMemoryManager] DEPRECATED: OR-Tools doesn't use TensorFlow memory");
  }

  initialize() {
    this.isInitialized = true;
    return this;
  }

  cleanup() {}

  dispose() {}

  getMemoryUsage() {
    return { numTensors: 0, numBytes: 0 };
  }

  runInScope(fn) {
    return fn();
  }
}

// Singleton instance
let instance = null;

export const getTensorMemoryManager = () => {
  if (!instance) {
    instance = new TensorMemoryManager();
  }
  return instance;
};

export const getEnhancedTensorMemoryManager = getTensorMemoryManager;

export default TensorMemoryManager;
