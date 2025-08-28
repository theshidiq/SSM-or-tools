/**
 * ML Worker for heavy TensorFlow operations
 * Runs ML predictions in a separate thread to prevent UI blocking
 */

// Import TensorFlow.js for Web Worker
importScripts(
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js",
);

class MLWorkerEngine {
  constructor() {
    this.model = null;
    this.isInitialized = false;
    this.isTraining = false;
    this.operationQueue = [];
    this.processingOperation = false;
  }

  /**
   * Initialize TensorFlow in worker context
   */
  async initializeTensorFlow() {
    try {
      // Set TensorFlow backend for worker environment
      if (typeof tf !== "undefined") {
        await tf.ready();
        console.log("[Worker] TensorFlow initialized successfully");
        return true;
      } else {
        throw new Error("TensorFlow not available in worker");
      }
    } catch (error) {
      console.error("[Worker] TensorFlow initialization failed:", error);
      return false;
    }
  }

  /**
   * Process ML operations with proper yielding
   */
  async processOperation(operation) {
    const { type, data, id } = operation;

    try {
      let result;

      switch (type) {
        case "PREDICT_BATCH":
          result = await this.handleBatchPrediction(data);
          break;
        case "TRAIN_MODEL":
          result = await this.handleModelTraining(data);
          break;
        case "FEATURE_GENERATION":
          result = await this.handleFeatureGeneration(data);
          break;
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      // Send success response
      self.postMessage({
        type: "OPERATION_COMPLETE",
        id,
        success: true,
        result,
      });
    } catch (error) {
      // Send error response
      self.postMessage({
        type: "OPERATION_COMPLETE",
        id,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Handle batch predictions in worker
   */
  async handleBatchPrediction({ features, modelData }) {
    try {
      // Load model if provided
      if (modelData && !this.model) {
        this.model = await tf.loadLayersModel(tf.io.fromMemory(modelData));
      }

      if (!this.model) {
        throw new Error("No model available for prediction");
      }

      const predictions = [];
      const BATCH_SIZE = 10; // Process in small batches

      // Process features in batches with yielding
      for (let i = 0; i < features.length; i += BATCH_SIZE) {
        const batch = features.slice(i, i + BATCH_SIZE);

        // Create tensor and predict
        const inputTensor = tf.tensor2d(batch);
        const prediction = this.model.predict(inputTensor);
        const probabilities = await prediction.data();

        // Process results
        for (let j = 0; j < batch.length; j++) {
          const start = j * 5; // Assuming 5 classes
          const end = start + 5;
          const probs = Array.from(probabilities.slice(start, end));
          const predictedClass = probs.indexOf(Math.max(...probs));
          const confidence = Math.max(...probs);

          predictions.push({
            predictions: probs,
            predictedClass,
            confidence,
            success: true,
          });
        }

        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();

        // Yield control periodically
        if (i > 0 && i % (BATCH_SIZE * 5) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));

          // Send progress update
          const progress = Math.round((i / features.length) * 100);
          self.postMessage({
            type: "PROGRESS_UPDATE",
            progress,
          });
        }
      }

      return {
        predictions,
        totalProcessed: features.length,
        success: true,
      };
    } catch (error) {
      console.error("[Worker] Batch prediction failed:", error);
      throw error;
    }
  }

  /**
   * Handle feature generation in worker (if needed)
   */
  async handleFeatureGeneration({ featureData }) {
    try {
      // Process feature generation with yielding
      const results = [];

      for (let i = 0; i < featureData.length; i++) {
        const item = featureData[i];

        // Generate features (simplified version)
        const features = this.generateBasicFeatures(item);
        results.push(features);

        // Yield every 50 items
        if (i > 0 && i % 50 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));

          // Send progress update
          const progress = Math.round((i / featureData.length) * 100);
          self.postMessage({
            type: "PROGRESS_UPDATE",
            progress,
          });
        }
      }

      return {
        features: results,
        success: true,
      };
    } catch (error) {
      console.error("[Worker] Feature generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate basic features (simplified)
   */
  generateBasicFeatures(data) {
    // Return a basic feature vector
    // This is a simplified version - the full feature engineering would be more complex
    return new Array(50).fill(0).map(() => Math.random());
  }

  /**
   * Handle model training in worker
   */
  async handleModelTraining({ trainingData, modelConfig }) {
    try {
      console.log("[Worker] Starting model training...");
      this.isTraining = true;

      const { features, labels, config } = trainingData;

      // Create simple model for worker training
      const model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [features[0].length],
            units: 64,
            activation: "relu",
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 32,
            activation: "relu",
          }),
          tf.layers.dense({
            units: 5, // Number of shift classes
            activation: "softmax",
          }),
        ],
      });

      model.compile({
        optimizer: "adam",
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
      });

      // Convert data to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.oneHot(tf.tensor1d(labels, "int32"), 5);

      // Train with progress updates
      const history = await model.fit(xs, ys, {
        epochs: config.epochs || 50,
        batchSize: config.batchSize || 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const progress = Math.round(
              ((epoch + 1) / (config.epochs || 50)) * 100,
            );
            self.postMessage({
              type: "TRAINING_PROGRESS",
              progress,
              epoch: epoch + 1,
              loss: logs.loss,
              accuracy: logs.acc,
            });
          },
        },
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      // Store trained model
      this.model = model;
      this.isTraining = false;

      console.log("[Worker] Model training completed");

      return {
        success: true,
        history: history.history,
        modelTrained: true,
      };
    } catch (error) {
      this.isTraining = false;
      console.error("[Worker] Model training failed:", error);
      throw error;
    }
  }

  /**
   * Queue and process operations
   */
  async queueOperation(operation) {
    this.operationQueue.push(operation);

    if (!this.processingOperation) {
      this.processingOperation = true;

      while (this.operationQueue.length > 0) {
        const nextOperation = this.operationQueue.shift();
        await this.processOperation(nextOperation);

        // Yield between operations
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      this.processingOperation = false;
    }
  }
}

// Create worker engine instance
const mlEngine = new MLWorkerEngine();

// Handle messages from main thread
self.onmessage = async function (e) {
  const { type, data, id } = e.data;

  switch (type) {
    case "INITIALIZE":
      try {
        const initialized = await mlEngine.initializeTensorFlow();
        mlEngine.isInitialized = initialized;

        self.postMessage({
          type: "INITIALIZATION_COMPLETE",
          success: initialized,
          id,
        });
      } catch (error) {
        self.postMessage({
          type: "INITIALIZATION_COMPLETE",
          success: false,
          error: error.message,
          id,
        });
      }
      break;

    case "QUEUE_OPERATION":
      if (!mlEngine.isInitialized) {
        self.postMessage({
          type: "OPERATION_COMPLETE",
          id,
          success: false,
          error: "Worker not initialized",
        });
        return;
      }

      await mlEngine.queueOperation({
        type: data.operationType,
        data: data.operationData,
        id,
      });
      break;

    case "GET_STATUS":
      self.postMessage({
        type: "STATUS_RESPONSE",
        status: {
          initialized: mlEngine.isInitialized,
          training: mlEngine.isTraining,
          queueLength: mlEngine.operationQueue.length,
          processing: mlEngine.processingOperation,
        },
        id,
      });
      break;

    case "TERMINATE":
      // Clean up before termination
      if (mlEngine.model) {
        mlEngine.model.dispose();
      }
      self.close();
      break;

    default:
      self.postMessage({
        type: "ERROR",
        error: `Unknown message type: ${type}`,
        id,
      });
  }
};

// Send ready signal
self.postMessage({
  type: "WORKER_READY",
});
