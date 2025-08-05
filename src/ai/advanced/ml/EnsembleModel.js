/**
 * EnsembleModel.js
 * 
 * Phase 3: Ensemble Model for combining multiple ML algorithms
 * Implements Random Forest, Gradient Boosting, SVM, and Logistic Regression
 */

import { RandomForestModel } from './models/RandomForestModel';
import { GradientBoostingModel } from './models/GradientBoostingModel';
import { SVMModel } from './models/SVMModel';
import { LogisticRegressionModel } from './models/LogisticRegressionModel';

/**
 * Ensemble Model combining multiple machine learning algorithms
 */
export class EnsembleModel {
  constructor() {
    this.initialized = false;
    this.trained = false;
    this.version = '1.0.0';
    
    // Individual models
    this.models = new Map();
    this.modelWeights = new Map();
    this.modelAccuracies = new Map();
    
    // Ensemble configuration
    this.config = {
      models: ['randomForest', 'gradientBoosting', 'svm', 'logisticRegression'],
      votingStrategy: 'soft', // 'hard' or 'soft'
      crossValidationFolds: 5,
      weightingStrategy: 'accuracy', // 'accuracy', 'uniform', 'performance'
      minModelAccuracy: 0.6 // Minimum accuracy to include model in ensemble
    };
    
    // Performance tracking
    this.performance = {
      overallAccuracy: 0,
      ensembleScore: 0,
      modelContributions: {},
      trainingTime: 0,
      predictionTime: 0,
      crossValidationScores: []
    };
    
    // Voting and combination strategies
    this.votingStrategies = {
      hard: this.hardVoting.bind(this),
      soft: this.softVoting.bind(this),
      weighted: this.weightedVoting.bind(this),
      stacked: this.stackedVoting.bind(this)
    };
  }

  /**
   * Initialize the ensemble model
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log('🌳 Initializing Ensemble Model...');
    
    try {
      // Merge configuration
      this.config = { ...this.config, ...config };
      
      // Initialize individual models
      await this.initializeModels();
      
      // Set initial uniform weights
      this.setUniformWeights();
      
      this.initialized = true;
      
      console.log('✅ Ensemble Model initialized');
      console.log(`Models: ${Array.from(this.models.keys()).join(', ')}`);
      console.log(`Voting strategy: ${this.config.votingStrategy}`);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        modelsInitialized: this.models.size,
        votingStrategy: this.config.votingStrategy
      };
      
    } catch (error) {
      console.error('❌ Ensemble Model initialization failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Initialize individual models
   */
  async initializeModels() {
    const modelInitializers = {
      randomForest: () => new RandomForestModel(),
      gradientBoosting: () => new GradientBoostingModel(),
      svm: () => new SVMModel(),
      logisticRegression: () => new LogisticRegressionModel()
    };
    
    for (const modelName of this.config.models) {
      if (modelInitializers[modelName]) {
        const model = modelInitializers[modelName]();
        await model.initialize();
        this.models.set(modelName, model);
        console.log(`✅ Initialized ${modelName}`);
      } else {
        console.warn(`⚠️ Unknown model type: ${modelName}`);
      }
    }
  }

  /**
   * Set uniform weights for all models
   */
  setUniformWeights() {
    const weight = 1.0 / this.models.size;
    this.models.forEach((model, name) => {
      this.modelWeights.set(name, weight);
    });
  }

  /**
   * Train the ensemble model
   * @param {Array} features - Training features
   * @param {Array} labels - Training labels
   * @param {Object} options - Training options
   * @returns {Object} Training result
   */
  async train(features, labels, options = {}) {
    if (!this.initialized) {
      throw new Error('Ensemble Model not initialized');
    }

    console.log('🎯 Training Ensemble Model...');
    
    try {
      const startTime = Date.now();
      const config = { ...this.config, ...options };
      
      // Perform cross-validation if requested
      if (config.crossValidationFolds > 1) {
        await this.performCrossValidation(features, labels, config);
      }
      
      // Train individual models
      const trainingResults = await this.trainIndividualModels(features, labels, config);
      
      // Calculate model weights based on performance
      this.calculateModelWeights(trainingResults, config.weightingStrategy);
      
      // Evaluate ensemble performance
      const ensembleAccuracy = await this.evaluateEnsemble(features, labels);
      
      this.trained = true;
      const trainingTime = Date.now() - startTime;
      this.performance.trainingTime = trainingTime;
      this.performance.overallAccuracy = ensembleAccuracy;
      
      console.log(`✅ Ensemble training completed in ${trainingTime}ms`);
      console.log(`🎯 Ensemble accuracy: ${ensembleAccuracy.toFixed(4)}`);
      
      // Find best performing individual model
      const bestModel = this.findBestModel(trainingResults);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        accuracy: ensembleAccuracy,
        trainingTime,
        modelAccuracies: Object.fromEntries(this.modelAccuracies),
        bestModel: bestModel.name,
        bestModelAccuracy: bestModel.accuracy,
        weights: Object.fromEntries(this.modelWeights)
      };
      
    } catch (error) {
      console.error('❌ Ensemble training failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Perform cross-validation
   * @param {Array} features - Training features
   * @param {Array} labels - Training labels
   * @param {Object} config - Configuration
   */
  async performCrossValidation(features, labels, config) {
    console.log(`🔄 Performing ${config.crossValidationFolds}-fold cross-validation...`);
    
    const foldSize = Math.floor(features.length / config.crossValidationFolds);
    const cvScores = [];
    
    for (let fold = 0; fold < config.crossValidationFolds; fold++) {
      const startIdx = fold * foldSize;
      const endIdx = fold === config.crossValidationFolds - 1 ? features.length : startIdx + foldSize;
      
      // Create train/validation split
      const valFeatures = features.slice(startIdx, endIdx);
      const valLabels = labels.slice(startIdx, endIdx);
      const trainFeatures = [...features.slice(0, startIdx), ...features.slice(endIdx)];
      const trainLabels = [...labels.slice(0, startIdx), ...labels.slice(endIdx)];
      
      // Train models on training fold
      const foldResults = await this.trainIndividualModels(trainFeatures, trainLabels, config);
      
      // Evaluate on validation fold
      const foldAccuracy = await this.evaluateEnsembleOnData(valFeatures, valLabels);
      cvScores.push(foldAccuracy);
      
      console.log(`Fold ${fold + 1}: ${foldAccuracy.toFixed(4)}`);
    }
    
    this.performance.crossValidationScores = cvScores;
    const meanCVScore = cvScores.reduce((sum, score) => sum + score, 0) / cvScores.length;
    const stdCVScore = Math.sqrt(cvScores.reduce((sum, score) => sum + Math.pow(score - meanCVScore, 2), 0) / cvScores.length);
    
    console.log(`✅ Cross-validation: ${meanCVScore.toFixed(4)} ± ${stdCVScore.toFixed(4)}`);
  }

  /**
   * Train individual models
   * @param {Array} features - Training features
   * @param {Array} labels - Training labels
   * @param {Object} config - Configuration
   * @returns {Map} Training results for each model
   */
  async trainIndividualModels(features, labels, config) {
    const trainingResults = new Map();
    
    for (const [modelName, model] of this.models) {
      try {
        console.log(`🔧 Training ${modelName}...`);
        
        const result = await model.train(features, labels, {
          onProgress: config.onModelTrained ? 
            (accuracy) => config.onModelTrained(modelName, accuracy) : 
            undefined
        });
        
        if (result.success && result.accuracy >= this.config.minModelAccuracy) {
          trainingResults.set(modelName, result);
          this.modelAccuracies.set(modelName, result.accuracy);
          console.log(`✅ ${modelName} trained: ${result.accuracy.toFixed(4)}`);
        } else {
          console.log(`⚠️ ${modelName} accuracy too low or training failed: ${result.accuracy || 0}`);
          // Remove low-performing model from ensemble
          this.models.delete(modelName);
        }
        
      } catch (error) {
        console.error(`❌ ${modelName} training failed:`, error);
        this.models.delete(modelName);
      }
    }
    
    return trainingResults;
  }

  /**
   * Calculate model weights based on performance
   * @param {Map} trainingResults - Training results
   * @param {string} strategy - Weighting strategy
   */
  calculateModelWeights(trainingResults, strategy) {
    console.log(`📊 Calculating model weights using ${strategy} strategy...`);
    
    switch (strategy) {
      case 'accuracy':
        this.calculateAccuracyBasedWeights(trainingResults);
        break;
      case 'performance':
        this.calculatePerformanceBasedWeights(trainingResults);
        break;
      case 'uniform':
      default:
        this.setUniformWeights();
        break;
    }
    
    // Normalize weights to sum to 1
    this.normalizeWeights();
    
    console.log('Model weights:', Object.fromEntries(this.modelWeights));
  }

  /**
   * Calculate accuracy-based weights
   * @param {Map} trainingResults - Training results
   */
  calculateAccuracyBasedWeights(trainingResults) {
    const totalAccuracy = Array.from(trainingResults.values())
      .reduce((sum, result) => sum + result.accuracy, 0);
    
    trainingResults.forEach((result, modelName) => {
      const weight = result.accuracy / totalAccuracy;
      this.modelWeights.set(modelName, weight);
    });
  }

  /**
   * Calculate performance-based weights (considering multiple metrics)
   * @param {Map} trainingResults - Training results
   */
  calculatePerformanceBasedWeights(trainingResults) {
    const scores = new Map();
    
    trainingResults.forEach((result, modelName) => {
      // Combine multiple performance metrics
      const performanceScore = (
        (result.accuracy || 0) * 0.4 +
        (result.precision || result.accuracy || 0) * 0.3 +
        (result.recall || result.accuracy || 0) * 0.2 +
        (result.f1Score || result.accuracy || 0) * 0.1
      );
      scores.set(modelName, performanceScore);
    });
    
    const totalScore = Array.from(scores.values())
      .reduce((sum, score) => sum + score, 0);
    
    scores.forEach((score, modelName) => {
      const weight = score / totalScore;
      this.modelWeights.set(modelName, weight);
    });
  }

  /**
   * Normalize weights to sum to 1
   */
  normalizeWeights() {
    const totalWeight = Array.from(this.modelWeights.values())
      .reduce((sum, weight) => sum + weight, 0);
    
    if (totalWeight > 0) {
      this.modelWeights.forEach((weight, modelName) => {
        this.modelWeights.set(modelName, weight / totalWeight);
      });
    }
  }

  /**
   * Evaluate ensemble performance
   * @param {Array} features - Features
   * @param {Array} labels - Labels
   * @returns {number} Ensemble accuracy
   */
  async evaluateEnsemble(features, labels) {
    return this.evaluateEnsembleOnData(features, labels);
  }

  /**
   * Evaluate ensemble on specific data
   * @param {Array} features - Features
   * @param {Array} labels - Labels
   * @returns {number} Accuracy
   */
  async evaluateEnsembleOnData(features, labels) {
    const predictions = await this.predict(features);
    
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predictedClass = this.argmax(predictions[i]);
      const actualClass = Array.isArray(labels[i]) ? this.argmax(labels[i]) : labels[i];
      
      if (predictedClass === actualClass) {
        correct++;
      }
    }
    
    return correct / predictions.length;
  }

  /**
   * Find the best performing individual model
   * @param {Map} trainingResults - Training results
   * @returns {Object} Best model info
   */
  findBestModel(trainingResults) {
    let bestModel = { name: '', accuracy: 0 };
    
    trainingResults.forEach((result, modelName) => {
      if (result.accuracy > bestModel.accuracy) {
        bestModel = { name: modelName, accuracy: result.accuracy };
      }
    });
    
    return bestModel;
  }

  /**
   * Make predictions using the ensemble
   * @param {Array} features - Input features (single sample or batch)
   * @returns {Array} Ensemble predictions
   */
  async predict(features) {
    if (!this.trained) {
      console.warn('⚠️ Ensemble Model not trained yet');
      const numClasses = 4; // Default for shift types
      const defaultPrediction = new Array(numClasses).fill(1 / numClasses);
      return Array.isArray(features[0]) ? 
        features.map(() => defaultPrediction) : 
        defaultPrediction;
    }

    const startTime = Date.now();
    
    // Get predictions from all models
    const modelPredictions = new Map();
    
    for (const [modelName, model] of this.models) {
      try {
        const predictions = await model.predict(features);
        modelPredictions.set(modelName, predictions);
      } catch (error) {
        console.error(`❌ ${modelName} prediction failed:`, error);
      }
    }
    
    // Combine predictions using voting strategy
    const ensemblePredictions = this.combineModelPredictions(modelPredictions, features);
    
    this.performance.predictionTime = Date.now() - startTime;
    
    return ensemblePredictions;
  }

  /**
   * Combine predictions from individual models
   * @param {Map} modelPredictions - Predictions from each model
   * @param {Array} features - Original features (for batch handling)
   * @returns {Array} Combined predictions
   */
  combineModelPredictions(modelPredictions, features) {
    if (modelPredictions.size === 0) {
      const numClasses = 4;
      const defaultPrediction = new Array(numClasses).fill(1 / numClasses);
      return Array.isArray(features[0]) ? 
        features.map(() => defaultPrediction) : 
        defaultPrediction;
    }
    
    // Determine if batch or single prediction
    const isBatch = Array.isArray(features[0]);
    const numSamples = isBatch ? features.length : 1;
    
    // Get voting strategy
    const votingStrategy = this.votingStrategies[this.config.votingStrategy] || 
                          this.votingStrategies.soft;
    
    const combinedPredictions = [];
    
    for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
      const samplePredictions = new Map();
      
      // Collect predictions for this sample from all models
      modelPredictions.forEach((predictions, modelName) => {
        const samplePrediction = isBatch ? predictions[sampleIdx] : predictions;
        samplePredictions.set(modelName, samplePrediction);
      });
      
      // Combine predictions for this sample
      const combinedPrediction = votingStrategy(samplePredictions);
      combinedPredictions.push(combinedPrediction);
    }
    
    return isBatch ? combinedPredictions : combinedPredictions[0];
  }

  /**
   * Hard voting: majority vote of predicted classes
   * @param {Map} samplePredictions - Predictions for one sample
   * @returns {Array} Combined prediction
   */
  hardVoting(samplePredictions) {
    const classCounts = new Map();
    const numClasses = 4; // Default for shift types
    
    // Initialize class counts
    for (let i = 0; i < numClasses; i++) {
      classCounts.set(i, 0);
    }
    
    // Count votes from each model
    samplePredictions.forEach((prediction, modelName) => {
      const weight = this.modelWeights.get(modelName) || 0;
      const predictedClass = Array.isArray(prediction) ? 
        this.argmax(prediction) : Math.round(prediction);
      
      const currentCount = classCounts.get(predictedClass) || 0;
      classCounts.set(predictedClass, currentCount + weight);
    });
    
    // Find class with most votes
    let maxVotes = 0;
    let winningClass = 0;
    
    classCounts.forEach((votes, classIdx) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        winningClass = classIdx;
      }
    });
    
    // Return one-hot encoded result
    const result = new Array(numClasses).fill(0);
    result[winningClass] = 1;
    return result;
  }

  /**
   * Soft voting: weighted average of prediction probabilities
   * @param {Map} samplePredictions - Predictions for one sample
   * @returns {Array} Combined prediction
   */
  softVoting(samplePredictions) {
    const numClasses = 4; // Default for shift types
    const combinedPrediction = new Array(numClasses).fill(0);
    let totalWeight = 0;
    
    samplePredictions.forEach((prediction, modelName) => {
      const weight = this.modelWeights.get(modelName) || 0;
      totalWeight += weight;
      
      // Ensure prediction is array format
      const predArray = Array.isArray(prediction) ? prediction : [prediction];
      
      // Add weighted prediction
      for (let i = 0; i < Math.min(numClasses, predArray.length); i++) {
        combinedPrediction[i] += predArray[i] * weight;
      }
    });
    
    // Normalize by total weight
    if (totalWeight > 0) {
      for (let i = 0; i < numClasses; i++) {
        combinedPrediction[i] /= totalWeight;
      }
    } else {
      // Default uniform distribution
      combinedPrediction.fill(1 / numClasses);
    }
    
    return combinedPrediction;
  }

  /**
   * Weighted voting: confidence-weighted combination
   * @param {Map} samplePredictions - Predictions for one sample
   * @returns {Array} Combined prediction
   */
  weightedVoting(samplePredictions) {
    // For now, use soft voting with model weights
    return this.softVoting(samplePredictions);
  }

  /**
   * Stacked voting: use a meta-learner to combine predictions
   * @param {Map} samplePredictions - Predictions for one sample
   * @returns {Array} Combined prediction
   */
  stackedVoting(samplePredictions) {
    // Simplified stacking - in practice would use a trained meta-model
    return this.softVoting(samplePredictions);
  }

  /**
   * Find index of maximum value in array
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
   * Check if model is ready for predictions
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && this.trained && this.models.size > 0;
  }

  /**
   * Support incremental learning
   * @returns {boolean} Whether incremental learning is supported
   */
  supportsIncrementalLearning() {
    // Check if any individual model supports incremental learning
    for (const [modelName, model] of this.models) {
      if (model.supportsIncrementalLearning && model.supportsIncrementalLearning()) {
        return true;
      }
    }
    return false;
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
        error: 'Ensemble not ready for updates'
      };
    }

    const updateResults = new Map();
    
    // Update individual models that support incremental learning
    for (const [modelName, model] of this.models) {
      if (model.supportsIncrementalLearning && model.supportsIncrementalLearning()) {
        try {
          const result = await model.updateFromFeedback(feedbackData);
          updateResults.set(modelName, result);
          
          if (result.success && result.newAccuracy) {
            this.modelAccuracies.set(modelName, result.newAccuracy);
          }
        } catch (error) {
          console.error(`❌ ${modelName} update failed:`, error);
        }
      }
    }
    
    // Recalculate weights based on updated accuracies
    if (updateResults.size > 0) {
      this.recalculateWeights();
    }
    
    return {
      success: true,
      updatedModels: Array.from(updateResults.keys()),
      updatedSamples: feedbackData.features.length,
      updateResults: Object.fromEntries(updateResults)
    };
  }

  /**
   * Recalculate model weights after updates
   */
  recalculateWeights() {
    if (this.modelAccuracies.size === 0) return;
    
    const totalAccuracy = Array.from(this.modelAccuracies.values())
      .reduce((sum, accuracy) => sum + accuracy, 0);
    
    this.modelAccuracies.forEach((accuracy, modelName) => {
      const weight = accuracy / totalAccuracy;
      this.modelWeights.set(modelName, weight);
    });
    
    this.normalizeWeights();
  }

  /**
   * Get ensemble status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      trained: this.trained,
      version: this.version,
      modelsCount: this.models.size,
      models: Array.from(this.models.keys()),
      votingStrategy: this.config.votingStrategy,
      performance: { ...this.performance },
      modelAccuracies: Object.fromEntries(this.modelAccuracies),
      modelWeights: Object.fromEntries(this.modelWeights),
      ready: this.isReady()
    };
  }

  /**
   * Reset the ensemble model
   * @returns {Object} Reset result
   */
  async reset() {
    console.log('🔄 Resetting Ensemble Model...');
    
    try {
      // Reset individual models
      for (const [modelName, model] of this.models) {
        if (model.reset) {
          await model.reset();
        }
      }
      
      // Reset ensemble state
      this.initialized = false;
      this.trained = false;
      this.models.clear();
      this.modelWeights.clear();
      this.modelAccuracies.clear();
      
      // Reset performance
      this.performance = {
        overallAccuracy: 0,
        ensembleScore: 0,
        modelContributions: {},
        trainingTime: 0,
        predictionTime: 0,
        crossValidationScores: []
      };
      
      console.log('✅ Ensemble Model reset successfully');
      
      return {
        success: true,
        message: 'Ensemble Model reset successfully',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Ensemble Model reset failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}