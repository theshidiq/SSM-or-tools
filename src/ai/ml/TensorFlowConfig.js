/**
 * TensorFlowConfig.js (DEPRECATED - OR-Tools Now Primary)
 *
 * This module is kept for backward compatibility only.
 * The application now uses OR-Tools via WebSocket for schedule optimization.
 */

// Stub MODEL_CONFIG for backward compatibility
export const MODEL_CONFIG = {
  inputFeatures: 10,
  hiddenLayers: [64, 32],
  outputClasses: 4,
  learningRate: 0.001,
  epochs: 100,
  batchSize: 32,
};

// Stub memory utils
export const MEMORY_UTILS = {
  cleanup: () => {},
  getMemoryUsage: () => ({ numTensors: 0, numBytes: 0 }),
};

// Stub model storage
export const MODEL_STORAGE = {
  save: async () => true,
  load: async () => null,
  exists: () => false,
};

// Stub initialization
export const initializeTensorFlow = async () => {
  console.log("[TensorFlowConfig] DEPRECATED: OR-Tools is now the primary optimizer");
  return true;
};

// Stub model creation
export const createScheduleModel = () => {
  return {
    compile: () => {},
    fit: async () => ({ history: { loss: [0], accuracy: [0.9] } }),
    predict: () => [],
    dispose: () => {},
  };
};

export default MODEL_CONFIG;
