/**
 * Phase2.test.js
 * 
 * Comprehensive test suite for Phase 2: Core Prediction Engine.
 * Tests all major components and integration points.
 */

import { predictionEngine } from '../PredictionEngine';
import { CSPSolver } from '../algorithms/CSPSolver';
import { GeneticAlgorithm } from '../algorithms/GeneticAlgorithm';
import { ScheduleGenerator } from '../core/ScheduleGenerator';
import { ConflictResolver } from '../core/ConflictResolver';
import { OptimizationEngine } from '../core/OptimizationEngine';
import { PredictionModel } from '../models/PredictionModel';
import { validateAllConstraints } from '../constraints/ConstraintEngine';

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Test data
const mockStaffMembers = [
  { id: 'staff_001', name: '料理長', position: 'Head Chef', type: '社員' },
  { id: 'staff_002', name: '古藤', position: 'Chef', type: '社員' },
  { id: 'staff_003', name: '井関', position: 'Cook', type: '社員' },
  { id: 'staff_004', name: '中田', position: 'Cook', type: '社員' },
  { id: 'staff_005', name: '与儀', position: 'Server', type: '社員' }
];

const mockDateRange = Array.from({ length: 14 }, (_, i) => {
  const date = new Date('2025-01-21');
  date.setDate(date.getDate() + i);
  return date;
});

const mockSchedule = {
  'staff_001': {
    '2025-01-21': '△',
    '2025-01-22': '',
    '2025-01-23': '×',
  },
  'staff_002': {
    '2025-01-21': '',
    '2025-01-22': '△',
    '2025-01-23': '',
  }
};

describe('Phase 2: Core Prediction Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('PredictionEngine', () => {
    test('should initialize successfully', async () => {
      const result = await predictionEngine.initialize();
      
      expect(result.success).toBe(true);
      expect(result.components).toHaveProperty('scheduleGenerator');
      expect(result.components).toHaveProperty('conflictResolver');
      expect(result.components).toHaveProperty('optimizationEngine');
      expect(result.capabilities).toContain('intelligent_schedule_generation');
      expect(result.capabilities).toContain('automatic_conflict_resolution');
    });

    test('should generate schedule with valid parameters', async () => {
      await predictionEngine.initialize();
      
      const result = await predictionEngine.generateSchedule({
        monthIndex: 0,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange,
        existingSchedule: {},
        preserveExisting: false
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.analysis).toHaveProperty('constraintSatisfaction');
      expect(result.analysis).toHaveProperty('optimizationScore');
      expect(result.generationTime).toBeGreaterThan(0);
    });

    test('should predict individual shifts', async () => {
      await predictionEngine.initialize();
      
      const result = await predictionEngine.predictShift({
        staffId: 'staff_001',
        staffName: '料理長',
        dateKey: '2025-01-28',
        currentSchedule: mockSchedule,
        staffMembers: mockStaffMembers,
        contextDates: mockDateRange
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toHaveProperty('recommendedShift');
      expect(result.prediction).toHaveProperty('confidence');
      expect(result.prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(result.prediction.confidence).toBeLessThanOrEqual(1);
    });

    test('should resolve conflicts automatically', async () => {
      await predictionEngine.initialize();
      
      // Create conflicted schedule
      const conflictedSchedule = {
        'staff_001': { '2025-01-21': '×' }, // 料理長 off
        'staff_002': { '2025-01-21': '×' }  // 古藤 off (group conflict)
      };

      const result = await predictionEngine.resolveConflicts({
        scheduleData: conflictedSchedule,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange.slice(0, 5),
        maxAttempts: 3
      });

      expect(result.success).toBe(true);
      expect(result.changesApplied).toBeGreaterThan(0);
      expect(result.conflictsResolved).toBeGreaterThan(0);
    });

    test('should optimize existing schedule', async () => {
      await predictionEngine.initialize();
      
      const result = await predictionEngine.optimizeSchedule({
        scheduleData: mockSchedule,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange.slice(0, 7),
        goals: ['fairness', 'preferences'],
        maxIterations: 20
      });

      expect(result.success).toBe(true);
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizationScore).toBeLessThanOrEqual(100);
      expect(result.iterations).toBeGreaterThan(0);
    });

    test('should generate recommendations', async () => {
      await predictionEngine.initialize();
      
      const result = await predictionEngine.getRecommendations({
        scheduleData: mockSchedule,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange.slice(0, 5)
      });

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveProperty('critical');
      expect(result.recommendations).toHaveProperty('high');
      expect(result.recommendations).toHaveProperty('medium');
      expect(result.recommendations).toHaveProperty('low');
      expect(result.totalRecommendations).toBeGreaterThanOrEqual(0);
    });

    test('should provide system status', () => {
      const status = predictionEngine.getSystemStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('components');
      expect(status).toHaveProperty('performance');
      expect(status).toHaveProperty('capabilities');
      expect(status.components).toHaveProperty('scheduleGenerator');
      expect(status.components).toHaveProperty('conflictResolver');
      expect(status.components).toHaveProperty('optimizationEngine');
    });
  });

  describe('CSPSolver', () => {
    let cspSolver;

    beforeEach(() => {
      cspSolver = new CSPSolver();
      cspSolver.initialize();
    });

    test('should initialize with default constraints', () => {
      expect(cspSolver.initialized).toBe(true);
      expect(cspSolver.constraints).toHaveLength(5);
      expect(cspSolver.domain).toEqual(['', '△', '◇', '×']);
    });

    test('should generate feasible schedule', async () => {
      const result = await cspSolver.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7),
        existingSchedule: {},
        preserveExisting: false,
        timeLimit: 5000
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.solutionTime).toBeGreaterThan(0);
      expect(result.feasible).toBe(true);
    });

    test('should respect existing assignments when preserving', async () => {
      const existingSchedule = {
        'staff_001': { '2025-01-21': '△' }
      };

      const result = await cspSolver.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 3),
        existingSchedule,
        preserveExisting: true
      });

      expect(result.success).toBe(true);
      expect(result.schedule['staff_001']['2025-01-21']).toBe('△');
    });

    test('should track constraint checks and backtracks', async () => {
      const result = await cspSolver.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 5),
        existingSchedule: {},
        preserveExisting: false
      });

      expect(result.constraintChecks).toBeGreaterThan(0);
      expect(result.backtracks).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeGreaterThan(0);
    });
  });

  describe('GeneticAlgorithm', () => {
    let geneticAlgorithm;

    beforeEach(() => {
      geneticAlgorithm = new GeneticAlgorithm();
      geneticAlgorithm.initialize({
        parameters: {
          populationSize: 10,
          maxGenerations: 20,
          crossoverRate: 0.8,
          mutationRate: 0.1
        }
      });
    });

    test('should initialize with correct parameters', () => {
      expect(geneticAlgorithm.initialized).toBe(true);
      expect(geneticAlgorithm.parameters.populationSize).toBe(10);
      expect(geneticAlgorithm.parameters.maxGenerations).toBe(20);
    });

    test('should evolve population successfully', async () => {
      const result = await geneticAlgorithm.evolve({
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7),
        initialSchedule: {},
        preserveFixed: false
      });

      expect(result.success).toBe(true);
      expect(result.bestSchedule).toBeDefined();
      expect(result.bestFitness).toBeGreaterThanOrEqual(0);
      expect(result.bestFitness).toBeLessThanOrEqual(100);
      expect(result.generations).toBeGreaterThan(0);
      expect(result.evolutionTime).toBeGreaterThan(0);
    });

    test('should improve fitness over generations', async () => {
      const result = await geneticAlgorithm.evolve({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 5),
        initialSchedule: {},
        preserveFixed: false
      });

      expect(result.evolutionHistory.fitnessHistory).toHaveLength(result.generations);
      
      // Check that there's some improvement (not strictly required, but likely)
      const initialFitness = result.evolutionHistory.fitnessHistory[0];
      const finalFitness = result.bestFitness;
      expect(finalFitness).toBeGreaterThanOrEqual(initialFitness);
    });

    test('should terminate early with excellent fitness', async () => {
      // Create a nearly optimal initial schedule
      const goodSchedule = {};
      mockStaffMembers.slice(0, 2).forEach(staff => {
        goodSchedule[staff.id] = {};
        mockDateRange.slice(0, 5).forEach((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          goodSchedule[staff.id][dateKey] = index % 4 === 0 ? '×' : '';
        });
      });

      const result = await geneticAlgorithm.evolve({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 5),
        initialSchedule: goodSchedule,
        preserveFixed: true
      });

      // Should find good solution quickly
      expect(result.success).toBe(true);
      expect(result.bestFitness).toBeGreaterThan(70);
    });
  });

  describe('ScheduleGenerator', () => {
    let scheduleGenerator;

    beforeEach(async () => {
      scheduleGenerator = new ScheduleGenerator();
      await scheduleGenerator.initialize();
    });

    test('should initialize generation strategies', () => {
      expect(scheduleGenerator.initialized).toBe(true);
      expect(scheduleGenerator.generationStrategies.size).toBeGreaterThan(0);
      expect(scheduleGenerator.shiftPriorities.size).toBeGreaterThan(0);
    });

    test('should generate schedule using hybrid strategy', async () => {
      const result = await scheduleGenerator.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7),
        existingSchedule: {},
        preserveExisting: false,
        strategy: 'hybrid',
        maxIterations: 10
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.metadata.staffCount).toBe(3);
      expect(result.metadata.dateCount).toBe(7);
    });

    test('should respect existing assignments', async () => {
      const existingSchedule = {
        'staff_001': { '2025-01-21': '△' }
      };

      const result = await scheduleGenerator.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 3),
        existingSchedule,
        preserveExisting: true,
        maxIterations: 5
      });

      expect(result.success).toBe(true);
      expect(result.schedule['staff_001']['2025-01-21']).toBe('△');
    });
  });

  describe('ConflictResolver', () => {
    let conflictResolver;

    beforeEach(async () => {
      conflictResolver = new ConflictResolver();
      await conflictResolver.initialize();
    });

    test('should initialize resolution strategies', () => {
      expect(conflictResolver.initialized).toBe(true);
      expect(conflictResolver.resolutionStrategies.size).toBeGreaterThan(0);
    });

    test('should resolve group conflicts', async () => {
      // Create schedule with group conflict
      const conflictedSchedule = {
        'staff_001': { '2025-01-21': '×' }, // 料理長 off
        'staff_002': { '2025-01-21': '×' }, // 古藤 off (conflict)
        'staff_003': { '2025-01-21': '' },
        'staff_004': { '2025-01-21': '' },
        'staff_005': { '2025-01-21': '' }
      };

      const result = await conflictResolver.resolveAllConflicts(
        conflictedSchedule,
        mockStaffMembers,
        mockDateRange.slice(0, 1),
        { maxAttempts: 3 }
      );

      expect(result.success).toBe(true);
      expect(result.changesApplied).toBeGreaterThan(0);
      expect(result.conflictsResolved).toBeGreaterThan(0);
      
      // Verify conflict is resolved
      const finalValidation = validateAllConstraints(
        result.schedule,
        mockStaffMembers,
        mockDateRange.slice(0, 1)
      );
      expect(finalValidation.valid).toBe(true);
    });

    test('should handle insufficient coverage', async () => {
      // Create schedule with too many people off
      const insufficientSchedule = {};
      mockStaffMembers.forEach(staff => {
        insufficientSchedule[staff.id] = { '2025-01-21': '×' }; // Everyone off
      });

      const result = await conflictResolver.resolveAllConflicts(
        insufficientSchedule,
        mockStaffMembers,
        mockDateRange.slice(0, 1),
        { maxAttempts: 3 }
      );

      expect(result.success).toBe(true);
      expect(result.changesApplied).toBeGreaterThan(0);
      
      // Should have enough working staff now
      const workingStaff = Object.keys(result.schedule).filter(staffId => 
        result.schedule[staffId]['2025-01-21'] !== '×'
      );
      expect(workingStaff.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('OptimizationEngine', () => {
    let optimizationEngine;

    beforeEach(async () => {
      optimizationEngine = new OptimizationEngine();
      await optimizationEngine.initialize();
    });

    test('should initialize optimization objectives', () => {
      expect(optimizationEngine.initialized).toBe(true);
      expect(optimizationEngine.optimizationObjectives.size).toBeGreaterThan(0);
      expect(optimizationEngine.weightingSchemes.size).toBeGreaterThan(0);
    });

    test('should optimize schedule for multiple objectives', async () => {
      const result = await optimizationEngine.optimize(
        mockSchedule,
        mockStaffMembers.slice(0, 3),
        mockDateRange.slice(0, 5),
        {
          goals: ['constraint_satisfaction', 'fairness'],
          maxIterations: 10
        }
      );

      expect(result.success).toBe(true);
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizationScore).toBeLessThanOrEqual(100);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.objectives).toHaveProperty('initial');
      expect(result.objectives).toHaveProperty('final');
    });

    test('should calculate fairness score correctly', async () => {
      // Create balanced schedule
      const balancedSchedule = {};
      mockStaffMembers.slice(0, 3).forEach(staff => {
        balancedSchedule[staff.id] = {};
        mockDateRange.slice(0, 6).forEach((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          balancedSchedule[staff.id][dateKey] = index % 3 === 0 ? '×' : '';
        });
      });

      const score = await optimizationEngine.calculateFairnessScore(
        balancedSchedule,
        mockStaffMembers.slice(0, 3),
        mockDateRange.slice(0, 6)
      );

      expect(score).toBeGreaterThan(50); // Should be reasonably fair
    });

    test('should generate optimization recommendations', async () => {
      const recommendations = await optimizationEngine.generateOptimizationRecommendations(
        mockSchedule,
        { fairness: 30, preferences: 40 }, // Low scores
        mockStaffMembers.slice(0, 2),
        mockDateRange.slice(0, 3)
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('objective');
        expect(rec).toHaveProperty('priority');
      });
    });
  });

  describe('PredictionModel', () => {
    let predictionModel;

    beforeEach(async () => {
      predictionModel = new PredictionModel();
      await predictionModel.initialize();
    });

    test('should initialize pattern structures', () => {
      expect(predictionModel.initialized).toBe(true);
      expect(predictionModel.patterns).toBeDefined();
      expect(predictionModel.staffPreferences).toBeDefined();
      expect(predictionModel.contextualPatterns).toBeDefined();
    });

    test('should train from historical data', async () => {
      const historicalData = {
        scheduleData: {
          '2024-12': mockSchedule
        },
        staffProfiles: mockStaffMembers
      };

      await predictionModel.trainFromHistoricalData(historicalData);
      
      expect(predictionModel.patterns.size).toBeGreaterThan(0);
      expect(predictionModel.staffPreferences.size).toBeGreaterThan(0);
    });

    test('should predict shifts with confidence', async () => {
      const result = await predictionModel.predictShift({
        staffId: 'staff_001',
        staffName: '料理長',
        dateKey: '2025-01-28',
        currentSchedule: mockSchedule,
        staffMembers: mockStaffMembers,
        contextDates: mockDateRange.slice(0, 7)
      });

      expect(result.recommendedShift).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.1);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.reasoning).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    test('should enhance schedule with predictions', async () => {
      const baseSchedule = {
        'staff_001': { '2025-01-21': '' },
        'staff_002': { '2025-01-21': '' }
      };

      const result = await predictionModel.enhanceSchedule(
        baseSchedule,
        mockStaffMembers.slice(0, 2),
        mockDateRange.slice(0, 3)
      );

      expect(result.schedule).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.enhancementsApplied).toBeGreaterThanOrEqual(0);
    });

    test('should provide model status', () => {
      const status = predictionModel.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.patternsLearned).toBeGreaterThanOrEqual(0);
      expect(status.accuracy).toHaveProperty('overall');
      expect(status.accuracy).toHaveProperty('byShiftType');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete workflow', async () => {
      // Initialize
      const initResult = await predictionEngine.initialize();
      expect(initResult.success).toBe(true);

      // Generate initial schedule
      const generateResult = await predictionEngine.generateSchedule({
        monthIndex: 0,
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7),
        existingSchedule: {},
        optimizationGoals: ['constraint_satisfaction', 'fairness']
      });
      expect(generateResult.success).toBe(true);

      // Optimize the schedule
      const optimizeResult = await predictionEngine.optimizeSchedule({
        scheduleData: generateResult.schedule,
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7),
        goals: ['fairness', 'preferences'],
        maxIterations: 10
      });
      expect(optimizeResult.success).toBe(true);

      // Get recommendations
      const recommendationsResult = await predictionEngine.getRecommendations({
        scheduleData: optimizeResult.schedule,
        staffMembers: mockStaffMembers.slice(0, 3),
        dateRange: mockDateRange.slice(0, 7)
      });
      expect(recommendationsResult.success).toBe(true);

      // Verify final schedule is valid
      const validation = validateAllConstraints(
        optimizeResult.schedule,
        mockStaffMembers.slice(0, 3),
        mockDateRange.slice(0, 7)
      );
      expect(validation.valid).toBe(true);
    });

    test('should maintain data consistency across components', async () => {
      await predictionEngine.initialize();
      
      const scheduleData = mockSchedule;
      
      // Test that all components can process the same data
      const cspResult = await predictionEngine.cspSolver.generateSchedule({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 3),
        existingSchedule: scheduleData,
        preserveExisting: true
      });
      
      const gaResult = await predictionEngine.geneticAlgorithm.evolve({
        staffMembers: mockStaffMembers.slice(0, 2),
        dateRange: mockDateRange.slice(0, 3),
        initialSchedule: scheduleData,
        preserveFixed: true
      });

      expect(cspResult.success).toBe(true);
      expect(gaResult.success).toBe(true);
      
      // Both should respect existing data
      expect(cspResult.schedule['staff_001']['2025-01-21']).toBe('△');
      expect(gaResult.bestSchedule['staff_001']['2025-01-21']).toBe('△');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization failures gracefully', async () => {
      const engine = new predictionEngine.constructor();
      
      // Mock a component failure
      engine.scheduleGenerator = {
        initialize: jest.fn().mockRejectedValue(new Error('Mock failure'))
      };

      const result = await engine.initialize();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Mock failure');
    });

    test('should handle invalid parameters', async () => {
      await predictionEngine.initialize();
      
      const result = await predictionEngine.generateSchedule({
        monthIndex: 0,
        staffMembers: [], // Empty staff
        dateRange: mockDateRange,
        existingSchedule: {}
      });

      // Should handle gracefully without crashing
      expect(result).toHaveProperty('success');
    });

    test('should handle timeout in CSP solver', async () => {
      const cspSolver = new CSPSolver();
      cspSolver.initialize();
      
      const result = await cspSolver.generateSchedule({
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange, // Large problem
        existingSchedule: {},
        timeLimit: 100 // Very short timeout
      });

      // Should return result even if timeout
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('schedule');
    });
  });

  describe('Performance Tests', () => {
    test('should complete generation within reasonable time', async () => {
      await predictionEngine.initialize();
      
      const startTime = Date.now();
      
      const result = await predictionEngine.generateSchedule({
        monthIndex: 0,
        staffMembers: mockStaffMembers,
        dateRange: mockDateRange.slice(0, 14),
        existingSchedule: {},
        optimizationGoals: ['constraint_satisfaction']
      });
      
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should cache predictions efficiently', async () => {
      await predictionEngine.initialize();
      
      const params = {
        staffId: 'staff_001',
        staffName: '料理長',
        dateKey: '2025-01-28',
        currentSchedule: mockSchedule,
        staffMembers: mockStaffMembers,
        contextDates: mockDateRange
      };

      // First prediction
      const startTime1 = Date.now();
      const result1 = await predictionEngine.predictShift(params);
      const duration1 = Date.now() - startTime1;

      // Second prediction (should be cached)
      const startTime2 = Date.now();
      const result2 = await predictionEngine.predictShift(params);
      const duration2 = Date.now() - startTime2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(duration2).toBeLessThan(duration1); // Should be faster due to caching
    });
  });
});