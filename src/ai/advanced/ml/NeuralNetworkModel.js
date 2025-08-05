/**
 * NeuralNetworkModel.js
 * 
 * Phase 3: Neural Network Model for deep learning-based shift scheduling
 * Implements a multi-layer neural network for pattern recognition and prediction
 */

/**
 * Neural Network Model for shift scheduling predictions
 */
export class NeuralNetworkModel {
  constructor() {
    this.initialized = false;
    this.trained = false;
    this.version = '1.0.0';
    
    // Network architecture
    this.layers = [];
    this.weights = [];
    this.biases = [];
    this.activations = [];
    
    // Training state
    this.trainingHistory = [];
    this.currentEpoch = 0;
    this.bestAccuracy = 0;
    this.bestWeights = null;
    
    // Configuration
    this.config = {
      hiddenLayers: [64, 32, 16],
      activation: 'relu',
      outputActivation: 'softmax',
      optimizer: 'adam',
      learningRate: 0.001,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      earlyStoppingPatience: 10,
      dropoutRate: 0.2
    };
    
    // Optimizer state (for Adam)
    this.adamState = {
      m: [], // First moment
      v: [], // Second moment
      beta1: 0.9,
      beta2: 0.999,
      epsilon: 1e-8,
      t: 0 // Time step
    };
    
    // Performance metrics
    this.metrics = {
      accuracy: 0,
      loss: 0,
      valAccuracy: 0,
      valLoss: 0,
      trainingTime: 0,
      predictionTime: 0
    };
  }

  /**
   * Initialize the neural network
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log('🧠 Initializing Neural Network Model...');
    
    try {
      // Merge configuration
      this.config = { ...this.config, ...config };
      
      this.initialized = true;
      
      console.log('✅ Neural Network Model initialized');
      console.log(`Architecture: Input -> ${this.config.hiddenLayers.join(' -> ')} -> Output`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        architecture: this.config.hiddenLayers,
        activationFunction: this.config.activation
      };
      
    } catch (error) {
      console.error('❌ Neural Network initialization failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Build the neural network architecture
   * @param {number} inputSize - Number of input features
   * @param {number} outputSize - Number of output classes
   */
  buildNetwork(inputSize, outputSize) {
    console.log(`🏗️ Building network: ${inputSize} inputs -> ${outputSize} outputs`);
    
    // Define layer sizes
    const layerSizes = [inputSize, ...this.config.hiddenLayers, outputSize];
    this.layers = layerSizes;
    
    // Initialize weights and biases
    this.weights = [];
    this.biases = [];
    this.activations = [];
    
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const inputSize = layerSizes[i];
      const outputSize = layerSizes[i + 1];
      
      // Xavier initialization for weights
      const weights = this.initializeWeights(inputSize, outputSize);
      const biases = new Array(outputSize).fill(0);
      
      this.weights.push(weights);
      this.biases.push(biases);
      this.activations.push(new Array(outputSize).fill(0));
    }
    
    // Initialize Adam optimizer state
    this.initializeAdamState();
    
    console.log(`✅ Network built with ${this.weights.length} layers`);
  }

  /**
   * Initialize weights using Xavier initialization
   * @param {number} inputSize - Input layer size
   * @param {number} outputSize - Output layer size
   * @returns {Array} Initialized weight matrix
   */
  initializeWeights(inputSize, outputSize) {
    const weights = [];
    const limit = Math.sqrt(6 / (inputSize + outputSize));
    
    for (let i = 0; i < inputSize; i++) {
      const row = [];
      for (let j = 0; j < outputSize; j++) {
        row.push((Math.random() * 2 - 1) * limit);
      }
      weights.push(row);
    }
    
    return weights;
  }

  /**
   * Initialize Adam optimizer state
   */
  initializeAdamState() {
    this.adamState.m = [];
    this.adamState.v = [];
    this.adamState.t = 0;
    
    for (let i = 0; i < this.weights.length; i++) {
      const weightShape = [this.weights[i].length, this.weights[i][0].length];
      const biasShape = [this.biases[i].length];
      
      // Initialize momentum arrays
      this.adamState.m.push({
        weights: this.createZeroMatrix(weightShape[0], weightShape[1]),
        biases: new Array(biasShape[0]).fill(0)
      });
      
      this.adamState.v.push({
        weights: this.createZeroMatrix(weightShape[0], weightShape[1]),
        biases: new Array(biasShape[0]).fill(0)
      });
    }
  }

  /**
   * Create a zero matrix
   * @param {number} rows - Number of rows
   * @param {number} cols - Number of columns
   * @returns {Array} Zero matrix
   */
  createZeroMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      matrix.push(new Array(cols).fill(0));
    }
    return matrix;
  }

  /**
   * Train the neural network
   * @param {Array} features - Training features
   * @param {Array} labels - Training labels
   * @param {Object} options - Training options
   * @returns {Object} Training result
   */
  async train(features, labels, options = {}) {
    if (!this.initialized) {
      throw new Error('Neural Network not initialized');
    }

    console.log('🎯 Training Neural Network...');
    
    try {
      const startTime = Date.now();
      const config = { ...this.config, ...options };
      
      // Prepare data
      const { trainFeatures, trainLabels, valFeatures, valLabels } = 
        this.splitTrainingData(features, labels, config.validationSplit);
      
      // Build network if not already built
      if (this.weights.length === 0) {
        const inputSize = features[0].length;
        const outputSize = this.getOutputSize(labels);
        this.buildNetwork(inputSize, outputSize);
      }
      
      // Convert labels to one-hot encoding
      const trainLabelsOneHot = this.toOneHot(trainLabels);
      const valLabelsOneHot = this.toOneHot(valLabels);
      
      // Training loop
      let bestValAccuracy = 0;
      let patienceCounter = 0;
      
      for (let epoch = 0; epoch < config.epochs; epoch++) {
        this.currentEpoch = epoch;
        
        // Shuffle training data
        const shuffledData = this.shuffleData(trainFeatures, trainLabelsOneHot);
        
        // Train on batches
        let totalLoss = 0;
        let correctPredictions = 0;
        
        for (let batchStart = 0; batchStart < shuffledData.features.length; batchStart += config.batchSize) {
          const batchEnd = Math.min(batchStart + config.batchSize, shuffledData.features.length);
          const batchFeatures = shuffledData.features.slice(batchStart, batchEnd);
          const batchLabels = shuffledData.labels.slice(batchStart, batchEnd);
          
          // Forward pass
          const predictions = batchFeatures.map(features => this.forward(features, true));
          
          // Calculate loss
          const batchLoss = this.calculateBatchLoss(predictions, batchLabels);
          totalLoss += batchLoss;
          
          // Count correct predictions
          correctPredictions += this.countCorrectPredictions(predictions, batchLabels);
          
          // Backward pass
          this.backward(batchFeatures, batchLabels, predictions, config.learningRate);
        }
        
        // Calculate training metrics
        const trainAccuracy = correctPredictions / shuffledData.features.length;
        const trainLoss = totalLoss / Math.ceil(shuffledData.features.length / config.batchSize);
        
        // Validation
        const valMetrics = this.validate(valFeatures, valLabelsOneHot);
        
        // Update metrics
        this.metrics = {
          accuracy: trainAccuracy,
          loss: trainLoss,
          valAccuracy: valMetrics.accuracy,
          valLoss: valMetrics.loss,
          trainingTime: Date.now() - startTime,
          predictionTime: this.metrics.predictionTime
        };
        
        // Store training history
        this.trainingHistory.push({
          epoch,
          trainAccuracy,
          trainLoss,
          valAccuracy: valMetrics.accuracy,
          valLoss: valMetrics.loss
        });
        
        // Early stopping
        if (valMetrics.accuracy > bestValAccuracy) {
          bestValAccuracy = valMetrics.accuracy;
          this.bestAccuracy = valMetrics.accuracy;
          this.bestWeights = this.copyWeights();
          patienceCounter = 0;
        } else {
          patienceCounter++;
        }
        
        // Callback for progress updates
        if (options.onEpochEnd) {
          options.onEpochEnd(epoch, trainLoss, trainAccuracy);
        }
        
        // Early stopping check
        if (patienceCounter >= config.earlyStoppingPatience) {
          console.log(`🛑 Early stopping at epoch ${epoch} (patience: ${config.earlyStoppingPatience})`);
          break;
        }
      }
      
      // Restore best weights
      if (this.bestWeights) {
        this.restoreWeights(this.bestWeights);
      }
      
      this.trained = true;
      const trainingTime = Date.now() - startTime;
      
      console.log(`✅ Neural Network training completed in ${trainingTime}ms`);
      console.log(`🎯 Best validation accuracy: ${this.bestAccuracy.toFixed(4)}`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        accuracy: this.bestAccuracy,
        loss: this.metrics.valLoss,
        epochs: this.currentEpoch + 1,
        trainingTime,
        modelSize: this.calculateModelSize()
      };
      
    } catch (error) {
      console.error('❌ Neural Network training failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Split data into training and validation sets
   * @param {Array} features - All features
   * @param {Array} labels - All labels
   * @param {number} validationSplit - Validation split ratio
   * @returns {Object} Split data
   */
  splitTrainingData(features, labels, validationSplit) {
    const totalSamples = features.length;
    const valSize = Math.floor(totalSamples * validationSplit);
    const trainSize = totalSamples - valSize;
    
    // Shuffle data before splitting
    const shuffled = this.shuffleData(features, labels);
    
    return {
      trainFeatures: shuffled.features.slice(0, trainSize),
      trainLabels: shuffled.labels.slice(0, trainSize),
      valFeatures: shuffled.features.slice(trainSize),
      valLabels: shuffled.labels.slice(trainSize)
    };
  }

  /**
   * Shuffle features and labels together
   * @param {Array} features - Features array
   * @param {Array} labels - Labels array
   * @returns {Object} Shuffled data
   */
  shuffleData(features, labels) {
    const indices = Array.from({ length: features.length }, (_, i) => i);
    
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    return {
      features: indices.map(i => features[i]),
      labels: indices.map(i => labels[i])
    };
  }

  /**
   * Get output size from labels
   * @param {Array} labels - Label array
   * @returns {number} Number of unique classes
   */
  getOutputSize(labels) {
    const uniqueLabels = [...new Set(labels)];
    return Math.max(4, uniqueLabels.length); // At least 4 for shift types
  }

  /**
   * Convert labels to one-hot encoding
   * @param {Array} labels - Label array
   * @returns {Array} One-hot encoded labels
   */
  toOneHot(labels) {
    const numClasses = this.getOutputSize(labels);
    return labels.map(label => {
      const oneHot = new Array(numClasses).fill(0);
      oneHot[Math.floor(label)] = 1;
      return oneHot;
    });
  }

  /**
   * Forward pass through the network
   * @param {Array} input - Input features
   * @param {boolean} training - Whether in training mode
   * @returns {Array} Network output
   */
  forward(input, training = false) {
    let activation = [...input];
    
    // Forward through each layer
    for (let layer = 0; layer < this.weights.length; layer++) {
      const weights = this.weights[layer];
      const biases = this.biases[layer];
      
      // Linear transformation
      const linearOutput = this.linearTransform(activation, weights, biases);
      
      // Apply activation function
      if (layer === this.weights.length - 1) {
        // Output layer - use softmax
        activation = this.softmax(linearOutput);
      } else {
        // Hidden layers - use specified activation
        activation = this.applyActivation(linearOutput, this.config.activation);
        
        // Apply dropout during training
        if (training && this.config.dropoutRate > 0) {
          activation = this.applyDropout(activation, this.config.dropoutRate);
        }
      }
      
      // Store activation for backpropagation
      this.activations[layer] = [...activation];
    }
    
    return activation;
  }

  /**
   * Linear transformation: Wx + b
   * @param {Array} input - Input vector
   * @param {Array} weights - Weight matrix
   * @param {Array} biases - Bias vector
   * @returns {Array} Linear output
   */
  linearTransform(input, weights, biases) {
    const output = [];
    
    for (let j = 0; j < weights[0].length; j++) {
      let sum = biases[j];
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * weights[i][j];
      }
      output.push(sum);
    }
    
    return output;
  }

  /**
   * Apply activation function
   * @param {Array} input - Input vector
   * @param {string} activation - Activation function name
   * @returns {Array} Activated output
   */
  applyActivation(input, activation) {
    switch (activation) {
      case 'relu':
        return input.map(x => Math.max(0, x));
      case 'sigmoid':
        return input.map(x => 1 / (1 + Math.exp(-x)));
      case 'tanh':
        return input.map(x => Math.tanh(x));
      case 'leaky_relu':
        return input.map(x => x > 0 ? x : 0.01 * x);
      default:
        return input;
    }
  }

  /**
   * Softmax activation function
   * @param {Array} input - Input vector
   * @returns {Array} Softmax output
   */
  softmax(input) {
    const max = Math.max(...input);
    const exps = input.map(x => Math.exp(x - max));
    const sum = exps.reduce((acc, val) => acc + val, 0);
    return exps.map(exp => exp / sum);
  }

  /**
   * Apply dropout during training
   * @param {Array} input - Input vector
   * @param {number} dropoutRate - Dropout rate
   * @returns {Array} Dropout applied vector
   */
  applyDropout(input, dropoutRate) {
    return input.map(x => Math.random() > dropoutRate ? x / (1 - dropoutRate) : 0);
  }

  /**
   * Calculate batch loss
   * @param {Array} predictions - Batch predictions
   * @param {Array} labels - Batch labels (one-hot)
   * @returns {number} Average batch loss
   */
  calculateBatchLoss(predictions, labels) {
    let totalLoss = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      totalLoss += this.crossEntropyLoss(predictions[i], labels[i]);
    }
    
    return totalLoss / predictions.length;
  }

  /**
   * Cross-entropy loss function
   * @param {Array} predicted - Predicted probabilities
   * @param {Array} actual - Actual one-hot labels
   * @returns {number} Cross-entropy loss
   */
  crossEntropyLoss(predicted, actual) {
    let loss = 0;
    for (let i = 0; i < predicted.length; i++) {
      // Prevent log(0) by adding small epsilon
      const p = Math.max(predicted[i], 1e-15);
      loss -= actual[i] * Math.log(p);
    }
    return loss;
  }

  /**
   * Count correct predictions in a batch
   * @param {Array} predictions - Batch predictions
   * @param {Array} labels - Batch labels (one-hot)
   * @returns {number} Number of correct predictions
   */
  countCorrectPredictions(predictions, labels) {
    let correct = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const predictedClass = this.argmax(predictions[i]);
      const actualClass = this.argmax(labels[i]);
      
      if (predictedClass === actualClass) {
        correct++;
      }
    }
    
    return correct;
  }

  /**
   * Find index of maximum value
   * @param {Array} array - Input array
   * @returns {number} Index of maximum value
   */
  argmax(array) {
    let maxIndex = 0;
    let maxValue = array[0];
    
    for (let i = 1; i < array.length; i++) {
      if (array[i] > maxValue) {
        maxValue = array[i];
        maxIndex = i;
      }
    }
    
    return maxIndex;
  }

  /**
   * Backward pass (backpropagation)
   * @param {Array} batchFeatures - Batch input features
   * @param {Array} batchLabels - Batch labels (one-hot)
   * @param {Array} predictions - Batch predictions
   * @param {number} learningRate - Learning rate
   */
  backward(batchFeatures, batchLabels, predictions, learningRate) {
    const batchSize = batchFeatures.length;
    
    // Calculate gradients for each sample in batch
    const gradients = {
      weights: this.weights.map(w => this.createZeroMatrix(w.length, w[0].length)),
      biases: this.biases.map(b => new Array(b.length).fill(0))
    };
    
    for (let sample = 0; sample < batchSize; sample++) {
      const sampleGradients = this.calculateSampleGradients(
        batchFeatures[sample],
        batchLabels[sample],
        predictions[sample]
      );
      
      // Accumulate gradients
      for (let layer = 0; layer < gradients.weights.length; layer++) {
        for (let i = 0; i < gradients.weights[layer].length; i++) {
          for (let j = 0; j < gradients.weights[layer][i].length; j++) {
            gradients.weights[layer][i][j] += sampleGradients.weights[layer][i][j];
          }
        }
        
        for (let j = 0; j < gradients.biases[layer].length; j++) {
          gradients.biases[layer][j] += sampleGradients.biases[layer][j];
        }
      }
    }
    
    // Average gradients
    for (let layer = 0; layer < gradients.weights.length; layer++) {
      for (let i = 0; i < gradients.weights[layer].length; i++) {
        for (let j = 0; j < gradients.weights[layer][i].length; j++) {
          gradients.weights[layer][i][j] /= batchSize;
        }
      }
      
      for (let j = 0; j < gradients.biases[layer].length; j++) {
        gradients.biases[layer][j] /= batchSize;
      }
    }
    
    // Update weights using Adam optimizer
    this.updateWeightsAdam(gradients, learningRate);
  }

  /**
   * Calculate gradients for a single sample
   * @param {Array} input - Input features
   * @param {Array} target - Target label (one-hot)
   * @param {Array} prediction - Network prediction
   * @returns {Object} Sample gradients
   */
  calculateSampleGradients(input, target, prediction) {
    // This is a simplified gradient calculation
    // In practice, you'd implement full backpropagation
    
    const gradients = {
      weights: this.weights.map(w => this.createZeroMatrix(w.length, w[0].length)),
      biases: this.biases.map(b => new Array(b.length).fill(0))
    };
    
    // For simplicity, calculate gradients based on output error
    const outputError = prediction.map((pred, i) => pred - target[i]);
    
    // This would be expanded to full backpropagation through all layers
    const lastLayer = gradients.weights.length - 1;
    
    // Update last layer gradients (simplified)
    for (let i = 0; i < gradients.weights[lastLayer].length; i++) {
      for (let j = 0; j < gradients.weights[lastLayer][i].length; j++) {
        gradients.weights[lastLayer][i][j] = this.activations[lastLayer - 1][i] * outputError[j];
      }
    }
    
    for (let j = 0; j < gradients.biases[lastLayer].length; j++) {
      gradients.biases[lastLayer][j] = outputError[j];
    }
    
    return gradients;
  }

  /**
   * Update weights using Adam optimizer
   * @param {Object} gradients - Calculated gradients
   * @param {number} learningRate - Learning rate
   */
  updateWeightsAdam(gradients, learningRate) {
    this.adamState.t++;
    
    for (let layer = 0; layer < this.weights.length; layer++) {
      // Update weights
      for (let i = 0; i < this.weights[layer].length; i++) {
        for (let j = 0; j < this.weights[layer][i].length; j++) {
          const gradient = gradients.weights[layer][i][j];
          
          // Update moments
          this.adamState.m[layer].weights[i][j] = 
            this.adamState.beta1 * this.adamState.m[layer].weights[i][j] + 
            (1 - this.adamState.beta1) * gradient;
          
          this.adamState.v[layer].weights[i][j] = 
            this.adamState.beta2 * this.adamState.v[layer].weights[i][j] + 
            (1 - this.adamState.beta2) * gradient * gradient;
          
          // Bias correction
          const mHat = this.adamState.m[layer].weights[i][j] / 
            (1 - Math.pow(this.adamState.beta1, this.adamState.t));
          const vHat = this.adamState.v[layer].weights[i][j] / 
            (1 - Math.pow(this.adamState.beta2, this.adamState.t));
          
          // Update weight
          this.weights[layer][i][j] -= learningRate * mHat / 
            (Math.sqrt(vHat) + this.adamState.epsilon);
        }
      }
      
      // Update biases
      for (let j = 0; j < this.biases[layer].length; j++) {
        const gradient = gradients.biases[layer][j];
        
        // Update moments
        this.adamState.m[layer].biases[j] = 
          this.adamState.beta1 * this.adamState.m[layer].biases[j] + 
          (1 - this.adamState.beta1) * gradient;
        
        this.adamState.v[layer].biases[j] = 
          this.adamState.beta2 * this.adamState.v[layer].biases[j] + 
          (1 - this.adamState.beta2) * gradient * gradient;
        
        // Bias correction
        const mHat = this.adamState.m[layer].biases[j] / 
          (1 - Math.pow(this.adamState.beta1, this.adamState.t));
        const vHat = this.adamState.v[layer].biases[j] / 
          (1 - Math.pow(this.adamState.beta2, this.adamState.t));
        
        // Update bias
        this.biases[layer][j] -= learningRate * mHat / 
          (Math.sqrt(vHat) + this.adamState.epsilon);
      }
    }
  }

  /**
   * Validate the model
   * @param {Array} valFeatures - Validation features
   * @param {Array} valLabels - Validation labels (one-hot)
   * @returns {Object} Validation metrics
   */
  validate(valFeatures, valLabels) {
    let totalLoss = 0;
    let correctPredictions = 0;
    
    for (let i = 0; i < valFeatures.length; i++) {
      const prediction = this.forward(valFeatures[i], false);
      const loss = this.crossEntropyLoss(prediction, valLabels[i]);
      
      totalLoss += loss;
      
      if (this.argmax(prediction) === this.argmax(valLabels[i])) {
        correctPredictions++;
      }
    }
    
    return {
      accuracy: correctPredictions / valFeatures.length,
      loss: totalLoss / valFeatures.length
    };
  }

  /**
   * Make predictions
   * @param {Array} features - Input features (can be single sample or batch)
   * @returns {Array} Predictions
   */
  async predict(features) {
    if (!this.trained) {
      console.warn('⚠️ Neural Network not trained yet');
      return Array.isArray(features[0]) ? features.map(() => [0.25, 0.25, 0.25, 0.25]) : [0.25, 0.25, 0.25, 0.25];
    }

    const startTime = Date.now();
    
    // Handle single sample or batch
    const isBatch = Array.isArray(features[0]);
    const samples = isBatch ? features : [features];
    
    const predictions = samples.map(sample => this.forward(sample, false));
    
    this.metrics.predictionTime = Date.now() - startTime;
    
    return isBatch ? predictions : predictions[0];
  }

  /**
   * Copy current weights
   * @returns {Object} Copied weights and biases
   */
  copyWeights() {
    return {
      weights: this.weights.map(layer => 
        layer.map(row => [...row])
      ),
      biases: this.biases.map(layer => [...layer])
    };
  }

  /**
   * Restore weights from backup
   * @param {Object} backup - Backed up weights and biases
   */
  restoreWeights(backup) {
    this.weights = backup.weights.map(layer => 
      layer.map(row => [...row])
    );
    this.biases = backup.biases.map(layer => [...layer]);
  }

  /**
   * Calculate model size in parameters
   * @returns {number} Number of parameters
   */
  calculateModelSize() {
    let totalParams = 0;
    
    for (let i = 0; i < this.weights.length; i++) {
      // Count weights
      totalParams += this.weights[i].length * this.weights[i][0].length;
      // Count biases
      totalParams += this.biases[i].length;
    }
    
    return totalParams;
  }

  /**
   * Check if model is ready for predictions
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && this.trained && this.weights.length > 0;
  }

  /**
   * Support incremental learning
   * @returns {boolean} Whether incremental learning is supported
   */
  supportsIncrementalLearning() {
    return true;
  }

  /**
   * Update model from feedback
   * @param {Object} feedbackData - Feedback data
   * @returns {Object} Update result
   */
  async updateFromFeedback(feedbackData) {
    if (!this.isReady()) {
      return {
        success: false,
        error: 'Model not ready for updates'
      };
    }

    try {
      // Perform a few training steps with feedback data
      const result = await this.train(
        feedbackData.features,
        feedbackData.labels,
        {
          epochs: 5, // Few epochs for incremental learning
          learningRate: this.config.learningRate * 0.1, // Lower learning rate
          onEpochEnd: () => {} // Silent updates
        }
      );
      
      return {
        success: true,
        updatedSamples: feedbackData.features.length,
        newAccuracy: result.accuracy
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get model status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      trained: this.trained,
      version: this.version,
      architecture: this.layers,
      metrics: { ...this.metrics },
      trainingHistory: this.trainingHistory.length,
      modelSize: this.weights.length > 0 ? this.calculateModelSize() : 0,
      ready: this.isReady()
    };
  }

  /**
   * Reset the neural network
   * @returns {Object} Reset result
   */
  async reset() {
    console.log('🔄 Resetting Neural Network...');
    
    try {
      this.initialized = false;
      this.trained = false;
      this.layers = [];
      this.weights = [];
      this.biases = [];
      this.activations = [];
      this.trainingHistory = [];
      this.currentEpoch = 0;
      this.bestAccuracy = 0;
      this.bestWeights = null;
      
      // Reset optimizer state
      this.adamState = {
        m: [],
        v: [],
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        t: 0
      };
      
      // Reset metrics
      this.metrics = {
        accuracy: 0,
        loss: 0,
        valAccuracy: 0,
        valLoss: 0,
        trainingTime: 0,
        predictionTime: 0
      };
      
      console.log('✅ Neural Network reset successfully');
      
      return {
        success: true,
        message: 'Neural Network reset successfully',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Neural Network reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}