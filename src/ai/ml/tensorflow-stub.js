/**
 * TensorFlow.js Stub
 *
 * This module provides empty stubs for TensorFlow.js functionality.
 * The application now uses OR-Tools via WebSocket for schedule optimization,
 * so TensorFlow.js is no longer needed. These stubs maintain backward
 * compatibility with legacy code that hasn't been removed yet.
 *
 * Portfolio Optimization: Removed TensorFlow.js to reduce bundle size by 2.8MB
 */

// Stub tensor class
class TensorStub {
  constructor(shape = []) {
    this.shape = shape;
    this.dtype = 'float32';
  }

  dispose() {}

  dataSync() {
    return new Float32Array(this.shape.reduce((a, b) => a * b, 1) || 1);
  }

  async data() {
    return this.dataSync();
  }

  arraySync() {
    return [];
  }
}

// Stub model class
class ModelStub {
  constructor() {
    this.layers = [];
  }

  compile() {}

  async fit() {
    return { history: { loss: [0], accuracy: [0.9] } };
  }

  predict() {
    return new TensorStub([1]);
  }

  async save() {}

  summary() {}

  dispose() {}
}

// Stub layer functions
const layerStubs = {
  dense: () => ({}),
  dropout: () => ({}),
  batchNormalization: () => ({}),
  lstm: () => ({}),
  gru: () => ({}),
  conv1d: () => ({}),
  maxPooling1d: () => ({}),
  flatten: () => ({}),
  reshape: () => ({}),
  embedding: () => ({}),
  input: () => ({}),
};

// Stub tf object
export const tf = {
  // Tensor creation
  tensor: (data, shape) => new TensorStub(shape),
  tensor1d: (data) => new TensorStub([data?.length || 0]),
  tensor2d: (data, shape) => new TensorStub(shape),
  zeros: (shape) => new TensorStub(shape),
  ones: (shape) => new TensorStub(shape),
  fill: (shape) => new TensorStub(shape),

  // Math operations
  add: (a, b) => new TensorStub(),
  sub: (a, b) => new TensorStub(),
  mul: (a, b) => new TensorStub(),
  div: (a, b) => new TensorStub(),
  matMul: (a, b) => new TensorStub(),
  mean: (t) => new TensorStub([1]),
  sum: (t) => new TensorStub([1]),
  argMax: (t) => new TensorStub([1]),
  softmax: (t) => new TensorStub(),

  // Memory management
  dispose: () => {},
  tidy: (fn) => fn(),
  keep: (t) => t,
  memory: () => ({ numTensors: 0, numBytes: 0 }),

  // Sequential model
  sequential: () => new ModelStub(),
  model: () => new ModelStub(),

  // Layers
  layers: layerStubs,

  // IO
  io: {
    withSaveHandler: () => {},
    fromMemory: () => {},
  },

  // Backend
  setBackend: async () => true,
  getBackend: () => 'cpu',
  ready: async () => true,

  // Load model
  loadLayersModel: async () => new ModelStub(),

  // Callbacks
  callbacks: {
    earlyStopping: () => ({}),
  },

  // Train
  train: {
    adam: () => ({}),
    sgd: () => ({}),
    rmsprop: () => ({}),
  },

  // Data utilities
  util: {
    shuffleCombo: () => {},
    createShuffledIndices: () => [],
  },
};

export default tf;
