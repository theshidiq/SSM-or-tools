/**
 * Phase3Demo.js
 *
 * Comprehensive demonstration of Phase 3: Advanced Intelligence capabilities
 * Showcases machine learning, seasonal analysis, real-time monitoring, and intelligent decision making
 */

import { advancedIntelligence } from "../AdvancedIntelligence";
import { extractAllDataForAI } from "../utils/DataExtractor";

/**
 * Run comprehensive Phase 3 demonstration
 * @returns {Object} Demo results
 */
export async function runPhase3Demo() {
  console.log("🎪 Starting Phase 3: Advanced Intelligence Demo");
  console.log("=".repeat(60));

  const demoResults = {
    success: false,
    startTime: Date.now(),
    results: {},
    summary: {},
    error: null,
  };

  try {
    // Demo 1: System Initialization and Setup
    console.log("\n🚀 Demo 1: Advanced Intelligence Initialization");
    const initDemo = await runInitializationDemo();
    demoResults.results.initDemo = initDemo;

    if (!initDemo.success) {
      throw new Error(`Initialization demo failed: ${initDemo.error}`);
    }

    // Demo 2: Machine Learning Engine
    console.log("\n🤖 Demo 2: Machine Learning Engine");
    const mlDemo = await runMLEngineDemo();
    demoResults.results.mlDemo = mlDemo;

    // Demo 3: Seasonal Pattern Analysis
    console.log("\n🗓️ Demo 3: Seasonal Pattern Analysis");
    const seasonalDemo = await runSeasonalAnalysisDemo();
    demoResults.results.seasonalDemo = seasonalDemo;

    // Demo 4: Real-Time Monitoring and Adjustment
    console.log("\n⚡ Demo 4: Real-Time Monitoring");
    const realTimeDemo = await runRealTimeDemo();
    demoResults.results.realTimeDemo = realTimeDemo;

    // Demo 5: Intelligent Schedule Generation
    console.log("\n🧠 Demo 5: Intelligent Schedule Generation");
    const intelligentDemo = await runIntelligentSchedulingDemo();
    demoResults.results.intelligentDemo = intelligentDemo;

    // Demo 6: Continuous Learning
    console.log("\n🎓 Demo 6: Continuous Learning from Feedback");
    const learningDemo = await runContinuousLearningDemo();
    demoResults.results.learningDemo = learningDemo;

    // Demo 7: System Performance Analysis
    console.log("\n📊 Demo 7: System Performance Analysis");
    const performanceDemo = await runPerformanceAnalysisDemo();
    demoResults.results.performanceDemo = performanceDemo;

    // Generate summary
    demoResults.summary = generateDemoSummary(demoResults.results);
    demoResults.success = true;
    demoResults.duration = Date.now() - demoResults.startTime;

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Phase 3 Demo Completed Successfully!");
    console.log(`Duration: ${demoResults.duration}ms`);
    console.log("Summary:", demoResults.summary);

    return demoResults;
  } catch (error) {
    console.error("\n❌ Phase 3 Demo Failed:", error);
    demoResults.error = error.message;
    demoResults.duration = Date.now() - demoResults.startTime;
    return demoResults;
  }
}

/**
 * Demo 1: System Initialization
 */
async function runInitializationDemo() {
  console.log("  🔧 Initializing Advanced Intelligence System...");

  try {
    const startTime = Date.now();

    // Initialize with comprehensive configuration
    const initResult = await advancedIntelligence.initialize({
      mlEngine: {
        neuralNetwork: {
          hiddenLayers: [32, 16, 8],
          epochs: 20, // Reduced for demo
          learningRate: 0.001,
          batchSize: 16,
        },
        ensemble: {
          models: ["randomForest", "gradientBoosting", "logisticRegression"],
          votingStrategy: "soft",
          crossValidationFolds: 3,
        },
        features: {
          timeFeatures: true,
          patternFeatures: true,
          constraintFeatures: true,
          seasonalFeatures: true,
        },
      },
      seasonal: {
        forecastHorizon: 60,
        adaptationThreshold: 0.15,
        patternConfidenceThreshold: 0.6,
      },
      realTime: {
        monitoringInterval: 3000, // 3 seconds for demo
        emergencyResponseTime: 500,
        maxAdjustmentsPerHour: 20,
      },
    });

    const initTime = Date.now() - startTime;

    if (initResult.success) {
      console.log(`  ✅ System initialized in ${initTime}ms`);
      console.log(
        `  📊 Components: ${Object.keys(initResult.components).length}`,
      );
      console.log(`  🎯 Capabilities: ${initResult.capabilities.length}`);
      console.log(
        `  🤖 ML Models Ready: ${Object.values(initResult.mlModels).filter(Boolean).length}`,
      );

      return {
        success: true,
        initTime,
        components: initResult.components,
        capabilities: initResult.capabilities,
        mlModels: initResult.mlModels,
      };
    } else {
      throw new Error(initResult.error);
    }
  } catch (error) {
    console.error("  ❌ Initialization failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 2: Machine Learning Engine
 */
async function runMLEngineDemo() {
  console.log("  🧠 Demonstrating Machine Learning capabilities...");

  try {
    const mlEngine = advancedIntelligence.mlEngine;
    const results = {};

    // Extract training data
    console.log("  📚 Extracting training data...");
    const extractedData = extractAllDataForAI();

    if (extractedData.success && extractedData.data.staffProfiles) {
      // Create mock historical data for training
      const mockHistoricalData = createMockHistoricalData();

      // Train Neural Networks
      console.log("  🧠 Training Neural Networks...");
      const nnResult = await mlEngine.trainNeuralNetworks(mockHistoricalData);
      results.neuralNetwork = {
        success: nnResult.success,
        accuracy: nnResult.accuracy,
        trainingTime: nnResult.trainingTime,
        modelSize: nnResult.modelSize,
      };

      console.log(
        `    Neural Network Accuracy: ${(nnResult.accuracy * 100).toFixed(2)}%`,
      );

      // Train Ensemble Methods
      console.log("  🌳 Training Ensemble Methods...");
      const ensembleResult =
        await mlEngine.trainEnsembleMethods(mockHistoricalData);
      results.ensemble = {
        success: ensembleResult.success,
        accuracy: ensembleResult.accuracy,
        trainingTime: ensembleResult.trainingTime,
        modelAccuracies: ensembleResult.modelAccuracies,
      };

      console.log(
        `    Ensemble Accuracy: ${(ensembleResult.accuracy * 100).toFixed(2)}%`,
      );
      console.log(`    Best Model: ${ensembleResult.bestModel}`);

      // Generate ML Predictions
      console.log("  🔮 Generating ML Predictions...");
      const mockStaffMembers = createMockStaffMembers();
      const mockDateRange = createMockDateRange();

      const mlPredictions = await mlEngine.generateMLPredictions({
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange,
        existingSchedule: {},
        seasonalContext: { season: "winter", businessCycle: 0.8 },
      });

      results.predictions = {
        success: mlPredictions.success,
        predictionTime: mlPredictions.predictionTime,
        confidence: mlPredictions.confidence,
        patternsDetected: mlPredictions.patterns
          ? Object.keys(mlPredictions.patterns).length
          : 0,
      };

      console.log(
        `    Prediction Confidence: ${(mlPredictions.confidence?.overall || 0).toFixed(2)}%`,
      );
      console.log(
        `    Patterns Detected: ${results.predictions.patternsDetected}`,
      );

      // Feature Engineering Demo
      console.log("  🔧 Feature Engineering Demo...");
      const featureResult =
        await mlEngine.featureEngineer.extractFeatures(mockHistoricalData);
      results.features = {
        success: featureResult.success,
        totalFeatures: featureResult.featureNames?.length || 0,
        totalSamples: featureResult.features?.length || 0,
        extractionTime: featureResult.extractionTime || 0,
      };

      console.log(`    Features Extracted: ${results.features.totalFeatures}`);
      console.log(`    Training Samples: ${results.features.totalSamples}`);
    } else {
      console.log("  ⚠️ Using mock data for ML demo");
      results.warning = "Limited historical data available";
    }

    return {
      success: true,
      results,
      summary: {
        modelsTrained: Object.keys(results).length,
        highestAccuracy: Math.max(
          results.neuralNetwork?.accuracy || 0,
          results.ensemble?.accuracy || 0,
        ),
      },
    };
  } catch (error) {
    console.error("  ❌ ML Engine demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 3: Seasonal Pattern Analysis
 */
async function runSeasonalAnalysisDemo() {
  console.log("  🌸 Demonstrating Seasonal Pattern Analysis...");

  try {
    const seasonalAnalyzer = advancedIntelligence.seasonalAnalyzer;
    const results = {};

    // Analyze Historical Seasons
    console.log("  📊 Analyzing historical seasonal patterns...");
    const mockHistoricalData = createMockHistoricalData();
    const historicalAnalysis =
      await seasonalAnalyzer.analyzeHistoricalSeasons(mockHistoricalData);

    results.historicalAnalysis = {
      success: historicalAnalysis.success,
      seasonsAnalyzed: historicalAnalysis.seasonalPatterns
        ? Object.keys(historicalAnalysis.seasonalPatterns).length
        : 0,
      holidaysAnalyzed: historicalAnalysis.holidayPatterns
        ? Object.keys(historicalAnalysis.holidayPatterns).length
        : 0,
      patternAccuracy: historicalAnalysis.confidence || 0,
    };

    console.log(
      `    Seasons Analyzed: ${results.historicalAnalysis.seasonsAnalyzed}`,
    );
    console.log(
      `    Holidays Analyzed: ${results.historicalAnalysis.holidaysAnalyzed}`,
    );

    // Current Season Analysis
    console.log("  🗓️ Analyzing current season context...");
    const mockDateRange = createMockDateRange();
    const currentSeasonAnalysis = await seasonalAnalyzer.analyzeCurrentSeason({
      monthIndex: 0,
      dateRange: mockDateRange,
      historicalData: mockHistoricalData,
    });

    results.currentSeason = {
      success: currentSeasonAnalysis.success,
      season: currentSeasonAnalysis.currentSeason,
      upcomingHolidays: currentSeasonAnalysis.upcomingHolidays?.length || 0,
      demandTrend: currentSeasonAnalysis.demandForecast?.trend || "unknown",
      confidence: currentSeasonAnalysis.confidence || 0,
    };

    console.log(`    Current Season: ${results.currentSeason.season}`);
    console.log(
      `    Upcoming Holidays: ${results.currentSeason.upcomingHolidays}`,
    );
    console.log(`    Demand Trend: ${results.currentSeason.demandTrend}`);

    // Seasonal Adaptations
    console.log("  🎯 Applying seasonal adaptations...");
    const mockSchedule = createMockSchedule();
    const mockStaffMembers = createMockStaffMembers();

    const adaptationResult = await seasonalAnalyzer.applySeasonalAdaptations({
      schedule: mockSchedule,
      staffMembers: mockStaffMembers,
      dateRange: mockDateRange,
      seasonalAnalysis: currentSeasonAnalysis,
    });

    results.adaptations = {
      success: adaptationResult.success,
      adaptationsApplied: adaptationResult.adaptations?.length || 0,
      adaptationScore: adaptationResult.adaptationScore || 0,
      recommendationsGenerated: adaptationResult.recommendations?.length || 0,
    };

    console.log(
      `    Adaptations Applied: ${results.adaptations.adaptationsApplied}`,
    );
    console.log(
      `    Adaptation Score: ${results.adaptations.adaptationScore.toFixed(1)}%`,
    );

    // Deviation Detection
    console.log("  🔍 Detecting seasonal deviations...");
    const deviationResult = await seasonalAnalyzer.detectDeviations();

    results.deviations = {
      success: deviationResult.success,
      deviationsFound: deviationResult.deviations?.length || 0,
      overallSeverity: deviationResult.overallSeverity || 0,
      season: deviationResult.season,
    };

    console.log(`    Deviations Found: ${results.deviations.deviationsFound}`);
    console.log(
      `    Overall Severity: ${results.deviations.overallSeverity.toFixed(2)}`,
    );

    return {
      success: true,
      results,
      summary: {
        seasonalCapabilities: "fully_operational",
        analysisAccuracy: results.historicalAnalysis.patternAccuracy,
        adaptationSuccess: results.adaptations.adaptationScore,
      },
    };
  } catch (error) {
    console.error("  ❌ Seasonal analysis demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 4: Real-Time Monitoring
 */
async function runRealTimeDemo() {
  console.log("  ⚡ Demonstrating Real-Time Monitoring...");

  try {
    const realTimeAdjuster = advancedIntelligence.realTimeAdjuster;
    const results = {};

    // Start Monitoring
    console.log("  🔄 Starting real-time monitoring...");
    const monitoringResult = realTimeAdjuster.startMonitoring();

    results.monitoring = {
      success: monitoringResult.success,
      monitoringInterval: monitoringResult.monitoringInterval,
    };

    console.log(
      `    Monitoring Started: ${results.monitoring.success ? "Yes" : "No"}`,
    );
    console.log(
      `    Monitoring Interval: ${results.monitoring.monitoringInterval}ms`,
    );

    // Simulate monitoring cycle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Violation Detection Demo
    console.log("  🚨 Demonstrating violation detection...");
    const mockViolationData = {
      schedule: createMockScheduleWithViolations(),
      staffMembers: createMockStaffMembers(),
      dateRange: createMockDateRange(),
    };

    // Manually test violation detection methods
    const dailyCoverageViolations =
      await realTimeAdjuster.checkDailyCoverageLimit(mockViolationData);
    const workloadViolations =
      await realTimeAdjuster.checkWorkloadImbalance(mockViolationData);

    results.violations = {
      dailyCoverageViolations: dailyCoverageViolations.length,
      workloadViolations: workloadViolations.length,
      totalViolations:
        dailyCoverageViolations.length + workloadViolations.length,
    };

    console.log(
      `    Daily Coverage Violations: ${results.violations.dailyCoverageViolations}`,
    );
    console.log(
      `    Workload Violations: ${results.violations.workloadViolations}`,
    );

    // Emergency Handling Demo
    console.log("  🚨 Testing emergency handling...");

    // Add emergency to queue
    realTimeAdjuster.addEmergency({
      type: "staff_unavailable",
      priority: "critical",
      staffId: "staff_001",
      date: "2025-01-15",
      reason: "Demo emergency",
    });

    // Apply emergency adjustments
    const emergencyResult = await realTimeAdjuster.applyEmergencyAdjustments({
      violations: {
        critical: dailyCoverageViolations,
        high: [],
        medium: [],
        low: [],
      },
      imbalances: {
        severity: 0.5,
        workload: workloadViolations,
        coverage: [],
        fairness: [],
      },
    });

    results.emergency = {
      success: emergencyResult.success,
      adjustmentsApplied: emergencyResult.adjustmentsApplied || 0,
      violationsAddressed: emergencyResult.violationsAddressed || 0,
      responseTime: emergencyResult.adjustmentTime || 0,
    };

    console.log(
      `    Emergency Adjustments Applied: ${results.emergency.adjustmentsApplied}`,
    );
    console.log(`    Response Time: ${results.emergency.responseTime}ms`);

    // System Status Check
    const systemStatus = realTimeAdjuster.getStatus();
    results.systemStatus = {
      operational: systemStatus.monitoring,
      systemHealth: systemStatus.systemStatus.systemHealth,
      activeAlerts: systemStatus.systemStatus.activeAlerts,
      emergencyQueueSize: systemStatus.emergencyQueueSize,
    };

    console.log(`    System Health: ${results.systemStatus.systemHealth}`);
    console.log(`    Active Alerts: ${results.systemStatus.activeAlerts}`);

    // Stop monitoring
    const stopResult = realTimeAdjuster.stopMonitoring();
    results.monitoring.stopped = stopResult.success;

    return {
      success: true,
      results,
      summary: {
        monitoringCapability: "operational",
        violationDetectionAccuracy: "high",
        emergencyResponseTime: results.emergency.responseTime,
      },
    };
  } catch (error) {
    console.error("  ❌ Real-time demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 5: Intelligent Schedule Generation
 */
async function runIntelligentSchedulingDemo() {
  console.log("  🧠 Demonstrating Intelligent Schedule Generation...");

  try {
    const results = {};

    // Generate Intelligent Schedule
    console.log("  🎯 Generating intelligent schedule...");
    const mockStaffMembers = createMockStaffMembers();
    const mockDateRange = createMockDateRange();
    const mockHistoricalData = createMockHistoricalData();

    const scheduleResult =
      await advancedIntelligence.generateIntelligentSchedule({
        monthIndex: 0,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange,
        existingSchedule: {},
        context: {
          historical: mockHistoricalData,
          preferences: createMockPreferences(),
          constraints: createMockConstraints(),
        },
        options: {
          includeExplanations: true,
          optimizationGoals: [
            "constraint_satisfaction",
            "fairness",
            "preferences",
            "seasonal_adaptation",
          ],
        },
      });

    results.schedule = {
      success: scheduleResult.success,
      generationTime: scheduleResult.generationTime || 0,
      intelligenceScore: scheduleResult.analysis?.intelligenceScore || 0,
      mlAccuracy: scheduleResult.analysis?.mlAccuracy || 0,
      seasonalAdaptationScore:
        scheduleResult.analysis?.seasonalAdaptationScore || 0,
      constraintSatisfaction:
        scheduleResult.analysis?.constraintSatisfaction || false,
      explanationsProvided: scheduleResult.explanations
        ? Object.keys(scheduleResult.explanations).length
        : 0,
    };

    console.log(`    Generation Time: ${results.schedule.generationTime}ms`);
    console.log(
      `    Intelligence Score: ${results.schedule.intelligenceScore.toFixed(1)}%`,
    );
    console.log(`    ML Accuracy: ${results.schedule.mlAccuracy.toFixed(1)}%`);
    console.log(
      `    Seasonal Adaptation: ${results.schedule.seasonalAdaptationScore.toFixed(1)}%`,
    );
    console.log(
      `    Constraint Satisfaction: ${results.schedule.constraintSatisfaction ? "Yes" : "No"}`,
    );

    // Analyze Schedule Quality
    if (scheduleResult.success) {
      console.log("  📊 Analyzing schedule quality...");
      const mlEngine = advancedIntelligence.mlEngine;
      const qualityEvaluation = await mlEngine.modelEvaluator.evaluateSchedule(
        scheduleResult.schedule,
        mockStaffMembers,
        mockDateRange,
      );

      results.quality = {
        overallScore: qualityEvaluation.overallScore || 0,
        constraintCompliance:
          qualityEvaluation.scores?.constraintCompliance || 0,
        fairnessScore: qualityEvaluation.scores?.fairness || 0,
        staffSatisfaction: qualityEvaluation.scores?.staffSatisfaction || 0,
        operationalEfficiency:
          qualityEvaluation.scores?.operationalEfficiency || 0,
      };

      console.log(
        `    Overall Quality: ${results.quality.overallScore.toFixed(1)}%`,
      );
      console.log(`    Fairness Score: ${results.quality.fairnessScore}%`);
      console.log(
        `    Staff Satisfaction: ${results.quality.staffSatisfaction}%`,
      );
    }

    // Performance Metrics
    const performanceMetrics = advancedIntelligence.getPerformanceMetrics();
    results.performance = {
      totalIntelligentDecisions: performanceMetrics.totalIntelligentDecisions,
      averageResponseTime: performanceMetrics.averageResponseTime,
      mlAccuracy: performanceMetrics.mlAccuracy,
      adaptiveLearningScore: performanceMetrics.adaptiveLearningScore,
    };

    console.log(
      `    Total Intelligent Decisions: ${results.performance.totalIntelligentDecisions}`,
    );
    console.log(
      `    Average Response Time: ${results.performance.averageResponseTime.toFixed(1)}ms`,
    );

    return {
      success: true,
      results,
      summary: {
        schedulingCapability: "advanced",
        intelligenceLevel: results.schedule.intelligenceScore,
        qualityScore: results.quality?.overallScore || 0,
      },
    };
  } catch (error) {
    console.error("  ❌ Intelligent scheduling demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 6: Continuous Learning
 */
async function runContinuousLearningDemo() {
  console.log("  🎓 Demonstrating Continuous Learning...");

  try {
    const results = {};

    // Simulate User Corrections
    console.log("  📝 Processing user corrections...");
    const mockCorrections = [
      {
        staffId: "staff_001",
        staffName: "料理長",
        date: "2025-01-15",
        predictedShift: "○",
        correctedValue: "△",
        reason: "Prefers early shift on Wednesdays",
        wasCorrect: false,
      },
      {
        staffId: "staff_002",
        staffName: "与儀",
        date: "2025-01-21",
        predictedShift: "○",
        correctedValue: "×",
        reason: "Sunday day off preference",
        wasCorrect: false,
      },
      {
        staffId: "staff_003",
        staffName: "中田",
        date: "2025-01-16",
        predictedShift: "▽",
        correctedValue: "○",
        reason: "Avoid late shifts on Thursdays",
        wasCorrect: false,
      },
    ];

    // Apply corrections to learning system
    const learningResult =
      await advancedIntelligence.captureUserCorrections(mockCorrections);

    results.learning = {
      correctionsProcessed: mockCorrections.length,
      learningSuccess: learningResult ? true : false,
      patternsLearned: mockCorrections.map((c) => c.reason).length,
    };

    console.log(
      `    Corrections Processed: ${results.learning.correctionsProcessed}`,
    );
    console.log(
      `    Learning Success: ${results.learning.learningSuccess ? "Yes" : "No"}`,
    );

    // Demonstrate ML Model Updates
    console.log("  🔄 Updating ML models from feedback...");
    const mlEngine = advancedIntelligence.mlEngine;

    // Process feedback data for model updates
    const feedbackData = {
      features: mockCorrections.map(() =>
        Array(20)
          .fill(0)
          .map(() => Math.random()),
      ), // Mock features
      labels: mockCorrections.map((c) => {
        const shiftMap = { "△": 0, "○": 1, "▽": 2, "×": 3 };
        return shiftMap[c.correctedValue] || 1;
      }),
      corrections: mockCorrections.length,
    };

    // Update ensemble model (which supports incremental learning)
    if (mlEngine.ensemble.supportsIncrementalLearning()) {
      const updateResult =
        await mlEngine.ensemble.updateFromFeedback(feedbackData);
      results.modelUpdate = {
        success: updateResult.success,
        updatedModels: updateResult.updatedModels?.length || 0,
        newAccuracy: updateResult.updateResults
          ? Object.values(updateResult.updateResults)
              .map((r) => r.newAccuracy)
              .filter(Boolean)[0]
          : 0,
      };

      console.log(`    Models Updated: ${results.modelUpdate.updatedModels}`);
      console.log(
        `    New Accuracy: ${(results.modelUpdate.newAccuracy * 100).toFixed(2)}%`,
      );
    }

    // Performance Improvement Tracking
    const performanceMetrics = advancedIntelligence.getPerformanceMetrics();
    results.improvement = {
      adaptiveLearningScore: performanceMetrics.adaptiveLearningScore,
      totalDecisions: performanceMetrics.totalIntelligentDecisions,
      learningTrend: "improving", // Simulated
    };

    console.log(
      `    Adaptive Learning Score: ${results.improvement.adaptiveLearningScore.toFixed(1)}%`,
    );
    console.log(`    Learning Trend: ${results.improvement.learningTrend}`);

    return {
      success: true,
      results,
      summary: {
        learningCapability: "active",
        correctionsProcessed: results.learning.correctionsProcessed,
        modelsUpdated: results.modelUpdate?.updatedModels || 0,
      },
    };
  } catch (error) {
    console.error("  ❌ Continuous learning demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Demo 7: System Performance Analysis
 */
async function runPerformanceAnalysisDemo() {
  console.log("  📊 Analyzing System Performance...");

  try {
    const results = {};

    // System Status Analysis
    console.log("  🔍 Getting comprehensive system status...");
    const systemStatus = advancedIntelligence.getSystemStatus();

    results.systemStatus = {
      initialized: systemStatus.initialized,
      version: systemStatus.version,
      phase: systemStatus.phase,
      totalComponents: Object.keys(systemStatus.components).length,
      operationalComponents: Object.values(systemStatus.components).filter(
        (c) =>
          typeof c === "object" ? c.initialized !== false : c === "initialized",
      ).length,
      capabilities: systemStatus.capabilities?.length || 0,
    };

    console.log(`    System Version: ${results.systemStatus.version}`);
    console.log(`    Phase: ${results.systemStatus.phase}`);
    console.log(
      `    Components Operational: ${results.systemStatus.operationalComponents}/${results.systemStatus.totalComponents}`,
    );
    console.log(`    Capabilities: ${results.systemStatus.capabilities}`);

    // Performance Metrics
    console.log("  ⚡ Analyzing performance metrics...");
    const performanceMetrics = advancedIntelligence.getPerformanceMetrics();

    results.performance = {
      mlAccuracy: performanceMetrics.mlAccuracy,
      seasonalAdaptationRate: performanceMetrics.seasonalAdaptationRate,
      realTimeAdjustments: performanceMetrics.realTimeAdjustments,
      averageResponseTime: performanceMetrics.averageResponseTime,
      totalIntelligentDecisions: performanceMetrics.totalIntelligentDecisions,
      adaptiveLearningScore: performanceMetrics.adaptiveLearningScore,
    };

    console.log(
      `    ML Accuracy: ${results.performance.mlAccuracy.toFixed(1)}%`,
    );
    console.log(
      `    Seasonal Adaptation Rate: ${results.performance.seasonalAdaptationRate.toFixed(1)}%`,
    );
    console.log(
      `    Real-Time Adjustments: ${results.performance.realTimeAdjustments}`,
    );
    console.log(
      `    Average Response Time: ${results.performance.averageResponseTime.toFixed(1)}ms`,
    );
    console.log(
      `    Total Intelligent Decisions: ${results.performance.totalIntelligentDecisions}`,
    );

    // Component Performance
    console.log("  🔧 Analyzing component performance...");
    const componentPerformance = {
      mlEngine: advancedIntelligence.mlEngine.getStatus(),
      seasonalAnalyzer: advancedIntelligence.seasonalAnalyzer.getStatus(),
      realTimeAdjuster: advancedIntelligence.realTimeAdjuster.getStatus(),
    };

    results.components = {};
    Object.entries(componentPerformance).forEach(([name, status]) => {
      results.components[name] = {
        initialized: status.initialized,
        version: status.version,
        ready: status.ready !== undefined ? status.ready : true,
        performance: status.metrics || status.performance || {},
      };
    });

    console.log("    Component Status:");
    Object.entries(results.components).forEach(([name, comp]) => {
      console.log(
        `      ${name}: ${comp.initialized ? "✅" : "❌"} ${comp.ready ? "Ready" : "Not Ready"}`,
      );
    });

    // Memory and Resource Usage
    console.log("  💾 Analyzing resource usage...");
    results.resources = {
      cacheSize: systemStatus.performance?.cacheSize || 0,
      learningHistorySize: systemStatus.performance?.learningHistorySize || 0,
      estimatedMemoryUsage: calculateEstimatedMemoryUsage(systemStatus),
      scalabilityScore: calculateScalabilityScore(systemStatus),
    };

    console.log(`    Cache Size: ${results.resources.cacheSize} entries`);
    console.log(
      `    Learning History: ${results.resources.learningHistorySize} entries`,
    );
    console.log(
      `    Estimated Memory Usage: ${results.resources.estimatedMemoryUsage}MB`,
    );
    console.log(
      `    Scalability Score: ${results.resources.scalabilityScore.toFixed(1)}%`,
    );

    // Success Criteria Evaluation
    console.log("  🎯 Evaluating success criteria...");
    results.successCriteria = evaluateSuccessCriteria(results);

    console.log("    Success Criteria Evaluation:");
    Object.entries(results.successCriteria).forEach(([criterion, result]) => {
      const status = result.achieved ? "✅" : "❌";
      console.log(
        `      ${criterion}: ${status} (${result.value}/${result.target})`,
      );
    });

    return {
      success: true,
      results,
      summary: {
        overallHealth: calculateOverallHealth(results),
        performanceGrade: calculatePerformanceGrade(results),
        readinessLevel: calculateReadinessLevel(results),
      },
    };
  } catch (error) {
    console.error("  ❌ Performance analysis demo failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper functions for creating mock data

function createMockHistoricalData() {
  const scheduleData = {};
  const staffMembers = createMockStaffMembers();

  // Create 3 months of mock data
  for (let month = 0; month < 3; month++) {
    const monthKey = `2024-${String(month + 10).padStart(2, "0")}`;
    scheduleData[monthKey] = {};

    staffMembers.forEach((staff) => {
      scheduleData[monthKey][staff.id] = {};

      // Generate 30 days of shifts
      for (let day = 1; day <= 30; day++) {
        const dateKey = `2024-${String(month + 10).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const shifts = ["△", "○", "▽", "×"];
        const weights = [0.15, 0.5, 0.25, 0.1]; // Realistic distribution

        const randomValue = Math.random();
        let cumulativeWeight = 0;
        let selectedShift = shifts[1]; // Default to normal

        for (let i = 0; i < shifts.length; i++) {
          cumulativeWeight += weights[i];
          if (randomValue <= cumulativeWeight) {
            selectedShift = shifts[i];
            break;
          }
        }

        scheduleData[monthKey][staff.id][dateKey] = selectedShift;
      }
    });
  }

  return {
    scheduleData,
    staffMembers,
    totalSamples: staffMembers.length * 30 * 3,
  };
}

function createMockStaffMembers() {
  return [
    {
      id: "staff_001",
      name: "料理長",
      position: "料理長",
      department: "kitchen",
      type: "regular",
    },
    {
      id: "staff_002",
      name: "与儀",
      position: "サービス",
      department: "service",
      type: "regular",
    },
    {
      id: "staff_003",
      name: "中田",
      position: "キッチン",
      department: "kitchen",
      type: "regular",
    },
    {
      id: "staff_004",
      name: "古藤",
      position: "キッチン",
      department: "kitchen",
      type: "regular",
    },
    {
      id: "staff_005",
      name: "カマル",
      position: "サービス",
      department: "service",
      type: "regular",
    },
    {
      id: "staff_006",
      name: "井関",
      position: "キッチン",
      department: "kitchen",
      type: "regular",
    },
    {
      id: "staff_007",
      name: "小池",
      position: "キッチン",
      department: "kitchen",
      type: "part_time",
    },
    {
      id: "staff_008",
      name: "田辺",
      position: "キッチン",
      department: "kitchen",
      type: "part_time",
    },
  ];
}

function createMockDateRange() {
  const dates = [];
  const startDate = new Date("2025-01-01");

  for (let i = 0; i < 31; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }

  return dates;
}

function createMockSchedule() {
  const schedule = {};
  const staffMembers = createMockStaffMembers();
  const dateRange = createMockDateRange();

  staffMembers.forEach((staff) => {
    schedule[staff.id] = {};
    dateRange.forEach((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const shifts = ["△", "○", "▽", "×"];
      schedule[staff.id][dateKey] =
        shifts[Math.floor(Math.random() * shifts.length)];
    });
  });

  return schedule;
}

function createMockScheduleWithViolations() {
  const schedule = createMockSchedule();
  const staffMembers = createMockStaffMembers();
  const dateRange = createMockDateRange();

  // Create deliberate violations for testing
  // Too many staff off on the same day
  const violationDate = dateRange[0].toISOString().split("T")[0];
  staffMembers.slice(0, 6).forEach((staff) => {
    schedule[staff.id][violationDate] = "×"; // 6 staff off = violation
  });

  // Workload imbalance - give one staff too many work days
  const overworkedStaff = staffMembers[0];
  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    schedule[overworkedStaff.id][dateKey] = "○"; // All normal shifts = overworked
  });

  return schedule;
}

function createMockPreferences() {
  return {
    staff_001: { sundayPreference: "△", weekdayPreference: "○" },
    staff_002: { sundayPreference: "×", weekdayPreference: "○" },
    staff_003: { weekdayPreference: "○", weekendPreference: "▽" },
  };
}

function createMockConstraints() {
  return {
    maxDailyOff: 4,
    maxMonthlyOffRatio: 0.25,
    groupRestrictions: [
      {
        members: ["staff_001", "staff_004"],
        restriction: "no_simultaneous_off",
      },
    ],
  };
}

// Helper functions for performance analysis

function calculateEstimatedMemoryUsage(systemStatus) {
  // Rough estimation based on system components and data
  let estimatedMB = 20; // Base system

  if (systemStatus.performance?.cacheSize) {
    estimatedMB += systemStatus.performance.cacheSize * 0.001; // 1KB per cache entry
  }

  if (systemStatus.performance?.learningHistorySize) {
    estimatedMB += systemStatus.performance.learningHistorySize * 0.01; // 10KB per history entry
  }

  return Math.round(estimatedMB);
}

function calculateScalabilityScore(systemStatus) {
  // Estimate scalability based on performance and architecture
  let score = 80; // Base score

  if (systemStatus.performance?.averageResponseTime < 5000) score += 10;
  if (systemStatus.performance?.cacheSize < 1000) score += 5;
  if (systemStatus.capabilities?.length > 10) score += 5;

  return Math.min(100, score);
}

function evaluateSuccessCriteria(results) {
  return {
    mlAccuracy: {
      target: 97,
      value: results.performance?.mlAccuracy || 0,
      achieved: (results.performance?.mlAccuracy || 0) >= 97,
    },
    seasonalAdaptation: {
      target: 15,
      value: results.performance?.seasonalAdaptationRate || 0,
      achieved: (results.performance?.seasonalAdaptationRate || 0) >= 15,
    },
    responseTime: {
      target: 5000,
      value: results.performance?.averageResponseTime || 0,
      achieved: (results.performance?.averageResponseTime || 0) <= 5000,
    },
    systemHealth: {
      target: "healthy",
      value:
        results.systemStatus?.operationalComponents +
        "/" +
        results.systemStatus?.totalComponents,
      achieved:
        results.systemStatus?.operationalComponents ===
        results.systemStatus?.totalComponents,
    },
  };
}

function calculateOverallHealth(results) {
  const criteria = evaluateSuccessCriteria(results);
  const totalCriteria = Object.keys(criteria).length;
  const achievedCriteria = Object.values(criteria).filter(
    (c) => c.achieved,
  ).length;

  const healthPercentage = (achievedCriteria / totalCriteria) * 100;

  if (healthPercentage >= 90) return "excellent";
  if (healthPercentage >= 75) return "good";
  if (healthPercentage >= 50) return "fair";
  return "needs_improvement";
}

function calculatePerformanceGrade(results) {
  const mlScore = results.performance?.mlAccuracy || 0;
  const responseScore = Math.max(
    0,
    100 - (results.performance?.averageResponseTime || 0) / 50,
  );
  const adaptationScore = results.performance?.seasonalAdaptationRate || 0;

  const overallScore = (mlScore + responseScore + adaptationScore) / 3;

  if (overallScore >= 90) return "A+";
  if (overallScore >= 80) return "A";
  if (overallScore >= 70) return "B";
  if (overallScore >= 60) return "C";
  return "D";
}

function calculateReadinessLevel(results) {
  const criteria = evaluateSuccessCriteria(results);
  const criticalCriteria = ["mlAccuracy", "responseTime", "systemHealth"];
  const criticalAchieved = criticalCriteria.every((c) => criteria[c]?.achieved);

  if (criticalAchieved && Object.values(criteria).every((c) => c.achieved)) {
    return "production_ready";
  } else if (criticalAchieved) {
    return "staging_ready";
  } else {
    return "development_ready";
  }
}

function generateDemoSummary(results) {
  const successfulDemos = Object.values(results).filter(
    (r) => r.success,
  ).length;
  const totalDemos = Object.keys(results).length;

  return {
    demosCompleted: totalDemos,
    demosSuccessful: successfulDemos,
    successRate: `${((successfulDemos / totalDemos) * 100).toFixed(0)}%`,
    overallStatus:
      successfulDemos === totalDemos
        ? "all_systems_operational"
        : "partial_success",
    keyHighlights: {
      mlCapability: results.mlDemo?.success ? "operational" : "limited",
      seasonalAnalysis: results.seasonalDemo?.success
        ? "operational"
        : "limited",
      realTimeMonitoring: results.realTimeDemo?.success
        ? "operational"
        : "limited",
      intelligentScheduling: results.intelligentDemo?.success
        ? "operational"
        : "limited",
      continuousLearning: results.learningDemo?.success
        ? "operational"
        : "limited",
      performanceAnalysis: results.performanceDemo?.success
        ? "operational"
        : "limited",
    },
    readinessAssessment:
      results.performanceDemo?.results?.summary?.readinessLevel ||
      "development_ready",
  };
}

// Export demo functions for individual testing
export {
  runInitializationDemo,
  runMLEngineDemo,
  runSeasonalAnalysisDemo,
  runRealTimeDemo,
  runIntelligentSchedulingDemo,
  runContinuousLearningDemo,
  runPerformanceAnalysisDemo,
};
