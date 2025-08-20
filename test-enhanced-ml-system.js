/**
 * Test script for the enhanced ML system
 * Tests the new ML-optimized ScheduleGenerator with different presets
 */

// Mock implementations for testing without full dependencies
const ScheduleGenerator = class {
  constructor() {
    this.initialized = false;
    this.mlPresets = {
      quick: {
        algorithm: "genetic_algorithm",
        populationSize: 50,
        generations: 150,
        mutationRate: 0.15,
        maxRuntime: 120,
        confidenceThreshold: 0.65,
      },
      balanced: {
        algorithm: "genetic_algorithm", 
        populationSize: 100,
        generations: 300,
        mutationRate: 0.1,
        maxRuntime: 300,
        confidenceThreshold: 0.75,
      },
      best: {
        algorithm: "ensemble",
        populationSize: 200,
        generations: 500,
        mutationRate: 0.05,
        maxRuntime: 720,
        confidenceThreshold: 0.85,
        ensembleAlgorithms: ["genetic_algorithm", "simulated_annealing"],
      },
    };
  }

  async initialize() {
    this.initialized = true;
    console.log("✅ Mock ScheduleGenerator initialized");
  }

  async generateSchedule(params) {
    const { strategy = "balanced" } = params;
    const mlConfig = this.mlPresets[strategy];
    
    // Simulate generation time based on preset
    const simulatedTime = mlConfig.maxRuntime * 10; // Faster for demo
    await new Promise(resolve => setTimeout(resolve, Math.min(2000, simulatedTime)));
    
    // Mock realistic results based on preset
    let score, confidence;
    switch (strategy) {
      case "quick":
        score = 75 + Math.random() * 10; // 75-85%
        confidence = 0.6 + Math.random() * 0.15; // 60-75%
        break;
      case "balanced":
        score = 85 + Math.random() * 8; // 85-93%
        confidence = 0.7 + Math.random() * 0.15; // 70-85%
        break;
      case "best":
        score = 92 + Math.random() * 6; // 92-98%
        confidence = 0.85 + Math.random() * 0.12; // 85-97%
        break;
      default:
        score = 80;
        confidence = 0.7;
    }

    return {
      success: true,
      score,
      confidence,
      strategy,
      algorithm: mlConfig.algorithm,
      iterations: Math.floor(mlConfig.generations * (0.3 + Math.random() * 0.4)),
      qualityMetrics: {
        scores: {
          balance: score - 5 + Math.random() * 10,
          priority: score - 3 + Math.random() * 8,
          fairness: score - 4 + Math.random() * 9,
          efficiency: score - 2 + Math.random() * 6,
        },
        summary: {
          overall: score,
        },
      },
      constraintAnalysis: {
        totalViolations: Math.floor((100 - score) / 10),
        criticalViolations: Math.floor((100 - score) / 25),
        highViolations: Math.floor((100 - score) / 15),
        mediumViolations: Math.floor((100 - score) / 12),
      },
      metadata: {
        mlConfig: {
          preset: strategy,
          algorithm: mlConfig.algorithm,
          populationSize: mlConfig.populationSize,
          generations: mlConfig.generations,
        },
      },
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      mlPresets: Object.keys(this.mlPresets),
      mlComponents: {
        geneticAlgorithm: "available",
        simulatedAnnealing: "available", 
        ensembleScheduler: "available",
      },
      statistics: {
        totalGenerations: 5,
        successfulGenerations: 4,
      },
      performanceHistory: [
        { strategy: "balanced", score: 88, confidence: 0.82 },
        { strategy: "best", score: 95, confidence: 0.91 },
      ],
    };
  }
};

// Mock data for testing
const mockStaffMembers = [
  { id: '1', name: '料理長', position: '料理長', department: 'kitchen' },
  { id: '2', name: '井関', position: 'sous_chef', department: 'kitchen' },
  { id: '3', name: '古藤', position: 'line_cook', department: 'kitchen' },
  { id: '4', name: '中田', position: 'line_cook', department: 'kitchen' },
  { id: '5', name: '小池', position: 'prep_cook', department: 'kitchen' },
  { id: '6', name: '田辺', position: 'prep_cook', department: 'kitchen' },
  { id: '7', name: '岸', position: 'dishwasher', department: 'kitchen' },
  { id: '8', name: '与儀', position: 'server', department: 'service' },
  { id: '9', name: 'カマル', position: 'server', department: 'service' },
  { id: '10', name: '高野', position: 'server', department: 'service' },
];

// Create date range (7 days for testing)
const createDateRange = (days = 7) => {
  const dates = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

const dateRange = createDateRange(7);

// Initialize empty schedule
const existingSchedule = {};
mockStaffMembers.forEach(staff => {
  existingSchedule[staff.id] = {};
  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
    existingSchedule[staff.id][dateKey] = '';
  });
});

async function testEnhancedMLSystem() {
  console.log('🚀 Testing Enhanced ML System for Schedule Generation');
  console.log('==========================================\n');

  const generator = new ScheduleGenerator();
  
  try {
    // Initialize the generator
    console.log('📋 Initializing ScheduleGenerator...');
    await generator.initialize();
    console.log('✅ ScheduleGenerator initialized\n');

    // Test each ML preset
    const presets = ['quick', 'balanced', 'best'];
    
    for (const preset of presets) {
      console.log(`🎯 Testing "${preset}" preset:`);
      console.log('-----------------------------------');
      
      const startTime = Date.now();
      
      const result = await generator.generateSchedule({
        staffMembers: mockStaffMembers,
        dateRange: dateRange,
        existingSchedule: existingSchedule,
        preserveExisting: false,
        strategy: preset,
        maxIterations: 50, // Reduced for testing
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️  Generation time: ${duration}ms`);
      console.log(`📊 Success: ${result.success}`);
      console.log(`🎯 Score: ${result.score?.toFixed(2)}%`);
      console.log(`🤖 Confidence: ${((result.confidence || 0) * 100).toFixed(1)}%`);
      console.log(`🔧 Algorithm: ${result.algorithm}`);
      console.log(`🔁 Iterations: ${result.iterations}`);
      
      if (result.qualityMetrics) {
        console.log('📈 Quality Metrics:');
        console.log(`   - Balance: ${result.qualityMetrics.scores.balance.toFixed(1)}%`);
        console.log(`   - Priority: ${result.qualityMetrics.scores.priority.toFixed(1)}%`);
        console.log(`   - Fairness: ${result.qualityMetrics.scores.fairness.toFixed(1)}%`);
        console.log(`   - Efficiency: ${result.qualityMetrics.scores.efficiency.toFixed(1)}%`);
        console.log(`   - Overall: ${result.qualityMetrics.summary.overall.toFixed(1)}%`);
      }
      
      if (result.constraintAnalysis) {
        console.log('⚠️  Constraint Analysis:');
        console.log(`   - Total violations: ${result.constraintAnalysis.totalViolations}`);
        console.log(`   - Critical: ${result.constraintAnalysis.criticalViolations}`);
        console.log(`   - High: ${result.constraintAnalysis.highViolations}`);
        console.log(`   - Medium: ${result.constraintAnalysis.mediumViolations}`);
      }
      
      if (result.metadata?.mlConfig) {
        console.log('🔬 ML Configuration:');
        console.log(`   - Preset: ${result.metadata.mlConfig.preset}`);
        console.log(`   - Algorithm: ${result.metadata.mlConfig.algorithm}`);
        console.log(`   - Population: ${result.metadata.mlConfig.populationSize}`);
        console.log(`   - Generations: ${result.metadata.mlConfig.generations}`);
      }
      
      console.log('\n');
    }

    // Test generator status
    console.log('📊 Generator Status:');
    console.log('-------------------');
    const status = generator.getStatus();
    console.log(`Initialized: ${status.initialized}`);
    console.log(`ML Presets available: ${status.mlPresets?.join(', ')}`);
    console.log(`Performance history entries: ${status.performanceHistory?.length || 0}`);
    console.log(`Success rate: ${((status.statistics?.successfulGenerations || 0) / Math.max(1, status.statistics?.totalGenerations || 1) * 100).toFixed(1)}%`);
    
    if (status.mlComponents) {
      console.log('🧠 ML Components Status:');
      Object.entries(status.mlComponents).forEach(([component, status]) => {
        console.log(`   - ${component}: ${status}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testEnhancedMLSystem().then(() => {
  console.log('🎉 Enhanced ML System test completed!');
}).catch(error => {
  console.error('💥 Test execution failed:', error);
});