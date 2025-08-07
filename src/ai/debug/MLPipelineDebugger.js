/**
 * MLPipelineDebugger.js
 * 
 * Debug tool to identify and fix ML pipeline issues
 * that are causing poor prediction accuracy.
 */

import { extractAllDataForAI } from '../utils/DataExtractor';
import { ScheduleFeatureEngineer } from '../ml/FeatureEngineering';
import { TensorFlowScheduler } from '../ml/TensorFlowScheduler';
import { MODEL_CONFIG } from '../ml/TensorFlowConfig';

export class MLPipelineDebugger {
  constructor() {
    this.debugResults = {
      dataExtraction: null,
      featureEngineering: null,
      modelTraining: null,
      overallStatus: 'not_tested'
    };
  }

  /**
   * Run comprehensive debug analysis of the ML pipeline
   */
  async debugFullPipeline() {
    console.log('🔬 Starting comprehensive ML pipeline debugging...');
    
    try {
      // Step 1: Debug data extraction
      console.log('\n📊 Step 1: Testing data extraction...');
      const dataResults = await this.debugDataExtraction();
      this.debugResults.dataExtraction = dataResults;
      
      if (!dataResults.success) {
        this.debugResults.overallStatus = 'data_extraction_failed';
        return this.generateDebugReport();
      }
      
      // Step 2: Debug feature engineering
      console.log('\n🔧 Step 2: Testing feature engineering...');
      const featureResults = await this.debugFeatureEngineering(dataResults.data);
      this.debugResults.featureEngineering = featureResults;
      
      if (!featureResults.success) {
        this.debugResults.overallStatus = 'feature_engineering_failed';
        return this.generateDebugReport();
      }
      
      // Step 3: Debug model training (limited test)
      console.log('\n🧠 Step 3: Testing model training...');
      const trainingResults = await this.debugModelTraining(featureResults.trainingData);
      this.debugResults.modelTraining = trainingResults;
      
      if (!trainingResults.success) {
        this.debugResults.overallStatus = 'model_training_failed';
      } else {
        this.debugResults.overallStatus = 'all_systems_working';
      }
      
      return this.generateDebugReport();
      
    } catch (error) {
      console.error('❌ Debug pipeline failed:', error);
      this.debugResults.overallStatus = 'debug_error';
      this.debugResults.error = error.message;
      return this.generateDebugReport();
    }
  }

  /**
   * Debug data extraction from localStorage
   */
  async debugDataExtraction() {
    try {
      console.log('  🔍 Extracting historical data...');
      
      const extractionResult = extractAllDataForAI();
      
      if (!extractionResult.success) {
        return {
          success: false,
          error: extractionResult.error,
          details: 'Failed to extract data from localStorage'
        };
      }
      
      const data = extractionResult.data;
      
      // Analyze data quality
      const analysis = {
        totalPeriods: data.rawPeriodData.length,
        totalStaff: Object.keys(data.staffProfiles).length,
        totalDataPoints: data.summary.totalShifts,
        dataCompleteness: data.summary.dataCompleteness
      };
      
      console.log('  ✅ Data extraction results:', analysis);
      
      // Check for minimum data requirements
      const minRequirements = {
        periods: analysis.totalPeriods >= 1,
        staff: analysis.totalStaff >= 2,
        dataPoints: analysis.totalDataPoints >= 50,
        completeness: analysis.dataCompleteness >= 10 // At least 10% completion
      };
      
      const requirementsMet = Object.values(minRequirements).every(req => req);
      
      if (!requirementsMet) {
        return {
          success: false,
          error: 'Insufficient training data',
          analysis,
          minRequirements,
          details: 'Need at least 1 period, 2 staff, 50 data points, 10% completeness'
        };
      }
      
      return {
        success: true,
        data,
        analysis,
        minRequirements
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: 'Exception during data extraction'
      };
    }
  }

  /**
   * Debug feature engineering process
   */
  async debugFeatureEngineering(data) {
    try {
      console.log('  🔧 Testing feature engineering...');
      
      const featureEngineer = new ScheduleFeatureEngineer();
      
      // Test with first available staff and date
      const firstPeriod = data.rawPeriodData[0];
      const firstStaff = firstPeriod.staffData[0];
      const firstDate = firstPeriod.dateRange[0];
      
      console.log(`  📝 Testing with staff: ${firstStaff.name}, date: ${firstDate.toISOString().split('T')[0]}`);
      
      // Test single feature generation
      const singleFeatures = featureEngineer.generateFeatures({
        staff: firstStaff,
        date: firstDate,
        dateIndex: 0,
        periodData: firstPeriod,
        allHistoricalData: this.convertToHistoricalFormat(data.rawPeriodData),
        staffMembers: firstPeriod.staffData
      });
      
      if (!singleFeatures) {
        return {
          success: false,
          error: 'Feature generation returned null',
          details: 'generateFeatures() failed for test case'
        };
      }
      
      console.log(`  ✅ Generated ${singleFeatures.length} features (expected: ${MODEL_CONFIG.INPUT_FEATURES.TOTAL})`);
      
      // Test full training data preparation
      const historicalData = this.convertToHistoricalFormat(data.rawPeriodData);
      const allStaff = this.extractAllStaff(data.rawPeriodData);
      
      const trainingData = featureEngineer.prepareTrainingData(historicalData, allStaff);
      
      const featureAnalysis = {
        singleFeatureCount: singleFeatures.length,
        expectedFeatureCount: MODEL_CONFIG.INPUT_FEATURES.TOTAL,
        featureCountMatches: singleFeatures.length === MODEL_CONFIG.INPUT_FEATURES.TOTAL,
        trainingFeatures: trainingData.features.length,
        trainingLabels: trainingData.labels.length,
        trainingSampleValid: trainingData.features.length === trainingData.labels.length,
        successRate: trainingData.stats?.successRate || 0
      };
      
      console.log('  📊 Feature engineering analysis:', featureAnalysis);
      
      if (featureAnalysis.trainingFeatures === 0) {
        return {
          success: false,
          error: 'No training samples generated',
          analysis: featureAnalysis,
          details: 'prepareTrainingData() produced no samples'
        };
      }
      
      if (!featureAnalysis.featureCountMatches) {
        return {
          success: false,
          error: 'Feature count mismatch',
          analysis: featureAnalysis,
          details: `Expected ${MODEL_CONFIG.INPUT_FEATURES.TOTAL} features, got ${singleFeatures.length}`
        };
      }
      
      if (featureAnalysis.successRate < 0.5) {
        return {
          success: false,
          error: 'Low feature generation success rate',
          analysis: featureAnalysis,
          details: `Only ${(featureAnalysis.successRate * 100).toFixed(1)}% of samples generated successfully`
        };
      }
      
      return {
        success: true,
        analysis: featureAnalysis,
        trainingData,
        sampleFeatures: singleFeatures.slice(0, 10) // First 10 features for inspection
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: 'Exception during feature engineering'
      };
    }
  }

  /**
   * Debug model training (lightweight test)
   */
  async debugModelTraining(trainingData) {
    try {
      console.log('  🧠 Testing model training...');
      
      // Quick validation without full training
      const features = trainingData.features;
      const labels = trainingData.labels;
      
      if (!features || !labels || features.length === 0 || labels.length === 0) {
        return {
          success: false,
          error: 'No training data available',
          details: 'Training features or labels are empty'
        };
      }
      
      // Check feature vector consistency
      const featureLength = features[0].length;
      const inconsistentFeatures = features.some(f => f.length !== featureLength);
      
      if (inconsistentFeatures) {
        return {
          success: false,
          error: 'Inconsistent feature vector lengths',
          details: 'Some feature vectors have different lengths'
        };
      }
      
      // Check label range
      const uniqueLabels = [...new Set(labels)];
      const validLabels = uniqueLabels.every(label => 
        label >= 0 && label < MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE
      );
      
      if (!validLabels) {
        return {
          success: false,
          error: 'Invalid label values',
          details: `Labels should be 0-${MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE - 1}, found: ${uniqueLabels.join(', ')}`
        };
      }
      
      // Test TensorFlow scheduler initialization (without training)
      const scheduler = new TensorFlowScheduler();
      const initResult = await scheduler.initialize();
      
      if (!initResult) {
        return {
          success: false,
          error: 'TensorFlow scheduler initialization failed',
          details: 'Could not initialize ML engine'
        };
      }
      
      const trainingAnalysis = {
        samples: features.length,
        featureLength,
        uniqueLabels: uniqueLabels.length,
        labelDistribution: this.calculateLabelDistribution(labels),
        tensorFlowReady: initResult,
        minSamplesForTraining: features.length >= 50
      };
      
      console.log('  📊 Training readiness analysis:', trainingAnalysis);
      
      // Clean up scheduler
      if (scheduler.dispose) {
        scheduler.dispose();
      }
      
      return {
        success: true,
        analysis: trainingAnalysis,
        ready: trainingAnalysis.minSamplesForTraining && trainingAnalysis.tensorFlowReady
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: 'Exception during model training test'
      };
    }
  }

  /**
   * Convert raw period data to historical format expected by feature engineering
   */
  convertToHistoricalFormat(rawPeriodData) {
    const historicalData = {};
    
    rawPeriodData.forEach(periodData => {
      historicalData[periodData.monthIndex] = {
        schedule: periodData.scheduleData,
        dateRange: periodData.dateRange
      };
    });
    
    return historicalData;
  }

  /**
   * Extract all unique staff members from periods
   */
  extractAllStaff(rawPeriodData) {
    const staffMap = new Map();
    
    rawPeriodData.forEach(periodData => {
      periodData.staffData.forEach(staff => {
        staffMap.set(staff.id, staff);
      });
    });
    
    return Array.from(staffMap.values());
  }

  /**
   * Calculate label distribution for analysis
   */
  calculateLabelDistribution(labels) {
    const distribution = {};
    labels.forEach(label => {
      distribution[label] = (distribution[label] || 0) + 1;
    });
    
    // Convert to percentages
    const total = labels.length;
    Object.keys(distribution).forEach(label => {
      distribution[label] = {
        count: distribution[label],
        percentage: ((distribution[label] / total) * 100).toFixed(1)
      };
    });
    
    return distribution;
  }

  /**
   * Generate comprehensive debug report
   */
  generateDebugReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: this.debugResults.overallStatus,
      summary: this.generateSummary(),
      details: this.debugResults,
      recommendations: this.generateRecommendations()
    };
    
    console.log('\n📋 ML Pipeline Debug Report:');
    console.log('=====================================');
    console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`Summary: ${report.summary}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n🔧 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    return report;
  }

  /**
   * Generate summary based on debug results
   */
  generateSummary() {
    const { overallStatus, dataExtraction, featureEngineering, modelTraining } = this.debugResults;
    
    switch (overallStatus) {
      case 'all_systems_working':
        return 'All ML pipeline components are working correctly. The issue may be in hyperparameters or model architecture.';
        
      case 'data_extraction_failed':
        const dataIssue = dataExtraction.error || 'Unknown data extraction error';
        return `Data extraction failed: ${dataIssue}`;
        
      case 'feature_engineering_failed':
        const featureIssue = featureEngineering.error || 'Unknown feature engineering error';
        return `Feature engineering failed: ${featureIssue}`;
        
      case 'model_training_failed':
        const trainingIssue = modelTraining.error || 'Unknown training error';
        return `Model training setup failed: ${trainingIssue}`;
        
      default:
        return 'Debug analysis incomplete or encountered errors.';
    }
  }

  /**
   * Generate recommendations based on debug results
   */
  generateRecommendations() {
    const recommendations = [];
    const { overallStatus, dataExtraction, featureEngineering, modelTraining } = this.debugResults;
    
    if (overallStatus === 'data_extraction_failed') {
      recommendations.push('Ensure historical schedule data exists in localStorage');
      recommendations.push('Verify at least 2 staff members have schedule data across multiple dates');
      recommendations.push('Check that schedule data contains meaningful shift symbols (○, △, ▽, ×)');
    }
    
    if (overallStatus === 'feature_engineering_failed') {
      if (featureEngineering?.analysis?.featureCountMatches === false) {
        recommendations.push('Fix feature count mismatch in FeatureEngineering.js generateFeatures() method');
        recommendations.push('Ensure all 35 features are properly generated and normalized');
      }
      
      if (featureEngineering?.analysis?.successRate < 0.8) {
        recommendations.push('Improve feature generation success rate by handling edge cases');
        recommendations.push('Add better data validation in prepareTrainingData()');
      }
    }
    
    if (overallStatus === 'model_training_failed') {
      recommendations.push('Check TensorFlow.js initialization and WebGL backend availability');
      recommendations.push('Verify training data has sufficient samples (minimum 50-100)');
      recommendations.push('Ensure label values are within expected range [0-4]');
    }
    
    if (overallStatus === 'all_systems_working') {
      recommendations.push('Consider increasing training epochs or adjusting learning rate');
      recommendations.push('Experiment with different neural network architectures');
      recommendations.push('Add more sophisticated feature engineering (temporal dependencies, staff interactions)');
      recommendations.push('Implement proper cross-validation to avoid overfitting');
    }
    
    return recommendations;
  }
}

export default MLPipelineDebugger;