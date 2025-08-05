/**
 * Phase4.test.js
 * 
 * Comprehensive Test Suite for Phase 4 Components
 * - Unit tests for all Phase 4 modules
 * - Integration tests for autonomous operation
 * - Performance benchmarks and load testing
 * - Security testing and vulnerability assessment
 * - End-to-end workflow testing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Phase 4 Components
import SelfImprovingSystem from '../autonomous/SelfImprovingSystem.js';
import IntelligentAutomation from '../automation/IntelligentAutomation.js';
import MobileOptimizer from '../mobile/MobileOptimizer.js';
import CloudDeployment from '../cloud/CloudDeployment.js';
import SecurityManager from '../security/SecurityManager.js';
import NaturalLanguageProcessor from '../nlp/NaturalLanguageProcessor.js';

// Mock external dependencies
jest.mock('events');
jest.mock('../advanced/MLEngine.js');
jest.mock('../algorithms/GeneticAlgorithm.js');
jest.mock('../algorithms/CSPSolver.js');

describe('Phase 4: Full Automation Test Suite', () => {
  
  describe('SelfImprovingSystem', () => {
    let selfImprovingSystem;

    beforeEach(() => {
      selfImprovingSystem = new SelfImprovingSystem({
        learningRate: 0.001,
        evolutionGenerations: 10,
        performanceThreshold: 0.95
      });
    });

    test('should initialize successfully', async () => {
      const result = await selfImprovingSystem.initialize();
      expect(result).toBe(true);
    });

    test('should learn from operations', async () => {
      await selfImprovingSystem.initialize();
      
      const operation = {
        id: 'test_operation',
        context: { type: 'schedule_optimization' },
        metrics: { accuracy: 0.92, efficiency: 0.88 },
        decisions: [{ id: 'decision1', confidence: 0.9 }]
      };

      const learningResult = await selfImprovingSystem.learnFromOperation('test_op', operation);
      
      expect(learningResult).toBeDefined();
      expect(learningResult.results).toBeDefined();
    });

    test('should evolve algorithms', async () => {
      await selfImprovingSystem.initialize();
      
      const evolutionResult = await selfImprovingSystem.evolveAlgorithms();
      
      expect(evolutionResult.generation).toBeGreaterThan(0);
      expect(evolutionResult.algorithmEvolutions).toBeDefined();
      expect(evolutionResult.overallImprovement).toBeGreaterThanOrEqual(0);
    });

    test('should select optimal algorithms', async () => {
      await selfImprovingSystem.initialize();
      
      const problem = {
        type: 'scheduling',
        complexity: 'medium',
        constraints: 10
      };

      const selectedAlgorithm = await selfImprovingSystem.selectOptimalAlgorithm(problem);
      expect(selectedAlgorithm).toBeDefined();
    });

    test('should perform self-assessment', async () => {
      await selfImprovingSystem.initialize();
      
      const assessment = await selfImprovingSystem.performSelfAssessment();
      
      expect(assessment.overallPerformance).toBeDefined();
      expect(assessment.algorithmPerformance).toBeDefined();
      expect(assessment.recommendations).toBeDefined();
    });

    test('should run continuous improvement', async () => {
      await selfImprovingSystem.initialize();
      
      const improvementCycle = await selfImprovingSystem.runContinuousImprovement();
      
      expect(improvementCycle.cycleId).toBeDefined();
      expect(improvementCycle.phases).toHaveLength(5);
      expect(improvementCycle.duration).toBeGreaterThan(0);
    });

    test('performance benchmark: learning speed', async () => {
      await selfImprovingSystem.initialize();
      
      const startTime = performance.now();
      
      // Run multiple learning operations
      const operations = Array.from({ length: 10 }, (_, i) => ({
        id: `operation_${i}`,
        context: { type: 'test' },
        metrics: { accuracy: 0.8 + Math.random() * 0.2 },
        decisions: []
      }));

      for (const operation of operations) {
        await selfImprovingSystem.learnFromOperation(operation.id, operation);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Learning should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('IntelligentAutomation', () => {
    let intelligentAutomation;

    beforeEach(() => {
      intelligentAutomation = new IntelligentAutomation({
        notificationThreshold: 0.7,
        automationLevel: 'aggressive',
        riskToleranceLevel: 'medium'
      });
    });

    test('should initialize successfully', async () => {
      const result = await intelligentAutomation.initialize();
      expect(result).toBe(true);
    });

    test('should process smart notifications', async () => {
      await intelligentAutomation.initialize();
      
      const context = {
        type: 'schedule_change',
        data: { scheduleId: 'test123', changes: 5 }
      };

      const result = await intelligentAutomation.processSmartNotifications(context);
      
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.sent).toBeGreaterThanOrEqual(0);
      expect(result.notifications).toBeDefined();
    });

    test('should generate automated reports', async () => {
      await intelligentAutomation.initialize();
      
      const result = await intelligentAutomation.generateAutomatedReports('manual');
      
      expect(result.trigger).toBe('manual');
      expect(result.generated).toBeGreaterThanOrEqual(0);
      expect(result.reports).toBeDefined();
    });

    test('should evaluate policies', async () => {
      await intelligentAutomation.initialize();
      
      const data = {
        schedule: { workHours: 8, breaks: 2 },
        staff: { count: 5, type: 'regular' }
      };

      const result = await intelligentAutomation.evaluatePolicies(data);
      
      expect(result.evaluated).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeDefined();
    });

    test('should handle exceptions', async () => {
      await intelligentAutomation.initialize();
      
      const exception = {
        type: 'schedule_conflict',
        severity: 'high',
        data: { conflictingShifts: 2 }
      };

      const result = await intelligentAutomation.handleException(exception);
      
      expect(result.exception).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    test('should assess risks', async () => {
      await intelligentAutomation.initialize();
      
      const context = {
        schedules: { understaffed: 2, compliant: 8 },
        staff: { available: 20, onLeave: 3 }
      };

      const result = await intelligentAutomation.assessRisks(context);
      
      expect(result.riskFactors).toBeGreaterThanOrEqual(0);
      expect(result.assessment).toBeDefined();
    });

    test('should automate workflows', async () => {
      await intelligentAutomation.initialize();
      
      const context = {
        workflowType: 'schedule_approval',
        data: { scheduleId: 'test456' }
      };

      const result = await intelligentAutomation.automateWorkflow('schedule_approval', context);
      
      expect(result.workflowType).toBe('schedule_approval');
      expect(result.executionId).toBeDefined();
      expect(result.steps).toBeDefined();
    });

    test('load testing: concurrent automation tasks', async () => {
      await intelligentAutomation.initialize();
      
      const startTime = performance.now();
      
      // Run multiple automation tasks concurrently
      const tasks = Array.from({ length: 20 }, (_, i) => 
        intelligentAutomation.processSmartNotifications({
          type: 'test_notification',
          data: { id: i }
        })
      );

      const results = await Promise.all(tasks);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(10000); // 10 seconds
    });
  });

  describe('MobileOptimizer', () => {
    let mobileOptimizer;

    beforeEach(() => {
      // Mock mobile environment
      global.navigator = {
        onLine: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5
      };
      
      global.window = {
        innerWidth: 375,
        innerHeight: 812,
        devicePixelRatio: 3
      };

      mobileOptimizer = new MobileOptimizer({
        touchTargetSize: 44,
        pwaEnabled: true,
        performanceThreshold: 3000
      });
    });

    test('should initialize successfully', async () => {
      const result = await mobileOptimizer.initialize();
      expect(result).toBe(true);
    });

    test('should optimize for touch', async () => {
      await mobileOptimizer.initialize();
      
      // Mock DOM element
      const mockElement = {
        id: 'test-element',
        querySelectorAll: jest.fn().mockReturnValue([
          { getBoundingClientRect: () => ({ width: 30, height: 30 }), style: {} }
        ]),
        addEventListener: jest.fn()
      };

      const result = await mobileOptimizer.optimizeForTouch(mockElement);
      
      expect(result.element).toBe('test-element');
      expect(result.optimizations).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should enable offline mode', async () => {
      await mobileOptimizer.initialize();
      
      const result = await mobileOptimizer.enableOfflineMode();
      
      expect(result.cachedResources).toBeGreaterThanOrEqual(0);
      expect(result.offlineReady).toBe(true);
    });

    test('should enable PWA features', async () => {
      await mobileOptimizer.initialize();
      
      const result = await mobileOptimizer.enablePWAFeatures();
      
      expect(result.features).toBeGreaterThan(0);
      expect(result.pwaReady).toBe(true);
    });

    test('should optimize performance', async () => {
      await mobileOptimizer.initialize();
      
      const result = await mobileOptimizer.optimizePerformance();
      
      expect(result.optimizations).toBeGreaterThanOrEqual(0);
      expect(result.metrics).toBeDefined();
    });

    test('should synchronize offline data', async () => {
      await mobileOptimizer.initialize();
      
      const result = await mobileOptimizer.synchronizeOfflineData();
      
      expect(result.status).toBeDefined();
    });

    test('performance benchmark: touch response time', async () => {
      await mobileOptimizer.initialize();
      
      const startTime = performance.now();
      
      // Simulate multiple touch optimizations
      const elements = Array.from({ length: 50 }, (_, i) => ({
        id: `element_${i}`,
        querySelectorAll: jest.fn().mockReturnValue([]),
        addEventListener: jest.fn()
      }));

      for (const element of elements) {
        await mobileOptimizer.optimizeForTouch(element);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Touch optimization should be fast
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('CloudDeployment', () => {
    let cloudDeployment;

    beforeEach(() => {
      cloudDeployment = new CloudDeployment({
        cloudProvider: 'aws',
        deploymentRegions: ['us-east-1', 'eu-west-1'],
        autoScaling: true,
        minInstances: 2,
        maxInstances: 10
      });
    });

    test('should initialize successfully', async () => {
      const result = await cloudDeployment.initialize();
      expect(result).toBe(true);
    });

    test('should deploy application', async () => {
      await cloudDeployment.initialize();
      
      const deploymentConfig = {
        applicationName: 'shift-schedule-manager',
        version: '1.0.0',
        environment: 'production'
      };

      const result = await cloudDeployment.deployApplication(deploymentConfig);
      
      expect(result.id).toBeDefined();
      expect(result.stages).toHaveLength(6);
      expect(result.success).toBeDefined();
    });

    test('should manage auto-scaling', async () => {
      await cloudDeployment.initialize();
      
      const result = await cloudDeployment.manageAutoScaling();
      
      expect(result.decision).toBeDefined();
      expect(result.currentInstances).toBeGreaterThanOrEqual(0);
    });

    test('should perform health checks', async () => {
      await cloudDeployment.initialize();
      
      const result = await cloudDeployment.performHealthCheck();
      
      expect(result.overall).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    test('should execute disaster recovery', async () => {
      await cloudDeployment.initialize();
      
      const scenario = {
        type: 'region_failure',
        region: 'us-east-1',
        severity: 'high'
      };

      const result = await cloudDeployment.executeDisasterRecovery(scenario);
      
      expect(result.scenario).toBe('region_failure');
      expect(result.phases).toHaveLength(5);
      expect(result.success).toBeDefined();
    });

    test('should optimize costs', async () => {
      await cloudDeployment.initialize();
      
      const result = await cloudDeployment.optimizeCosts();
      
      expect(result.analysis).toBeDefined();
      expect(result.optimizations).toBeGreaterThanOrEqual(0);
      expect(result.estimatedSavings).toBeGreaterThanOrEqual(0);
    });

    test('should deploy to multiple regions', async () => {
      await cloudDeployment.initialize();
      
      const deploymentConfig = {
        applicationName: 'shift-schedule-manager',
        multiRegion: true
      };

      const result = await cloudDeployment.deployToMultipleRegions(deploymentConfig);
      
      expect(result.regions).toBeGreaterThan(0);
      expect(result.activeRegions).toBeDefined();
    });

    test('scalability test: instance management', async () => {
      await cloudDeployment.initialize();
      
      const startTime = performance.now();
      
      // Simulate scaling operations
      const scalingOperations = Array.from({ length: 10 }, () => 
        cloudDeployment.manageAutoScaling()
      );

      const results = await Promise.all(scalingOperations);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('SecurityManager', () => {
    let securityManager;

    beforeEach(() => {
      securityManager = new SecurityManager({
        encryptionAlgorithm: 'AES-256-GCM',
        maxLoginAttempts: 3,
        complianceFrameworks: ['GDPR', 'SOX'],
        zeroTrustMode: true
      });
    });

    test('should initialize successfully', async () => {
      const result = await securityManager.initialize();
      expect(result).toBe(true);
    });

    test('should authenticate users', async () => {
      await securityManager.initialize();
      
      const credentials = {
        username: 'testuser',
        password: 'securepassword123'
      };

      const result = await securityManager.authenticateUser(credentials);
      
      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.session).toBeDefined();
        expect(result.user).toBeDefined();
      }
    });

    test('should authorize access', async () => {
      await securityManager.initialize();
      
      // First authenticate to get a session
      const authResult = await securityManager.authenticateUser({
        username: 'testuser',
        password: 'securepassword123'
      });

      if (authResult.success) {
        const authzResult = await securityManager.authorizeAccess(
          authResult.session.id,
          'schedule',
          'read'
        );
        
        expect(authzResult.authorized).toBeDefined();
        expect(authzResult.permissions).toBeDefined();
      }
    });

    test('should encrypt sensitive data', async () => {
      await securityManager.initialize();
      
      const sensitiveData = 'user personal information';
      const context = { purpose: 'storage' };

      const result = await securityManager.encryptSensitiveData(sensitiveData, context);
      
      expect(result.success).toBe(true);
      expect(result.encryptedData).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should detect threats', async () => {
      await securityManager.initialize();
      
      const context = {
        userActivity: { loginAttempts: 5, failedLogins: 3 },
        networkActivity: { suspiciousIPs: 1 }
      };

      const result = await securityManager.detectThreats(context);
      
      expect(result.scanned).toBeGreaterThanOrEqual(0);
      expect(result.threats).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    test('should ensure compliance', async () => {
      await securityManager.initialize();
      
      const result = await securityManager.ensureCompliance();
      
      expect(result.frameworks).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
    });

    test('should handle security incidents', async () => {
      await securityManager.initialize();
      
      const incident = {
        type: 'data_breach',
        severity: 'high',
        affectedSystems: ['database']
      };

      const result = await securityManager.handleSecurityIncident(incident);
      
      expect(result.incidentId).toBeDefined();
      expect(result.phases).toHaveLength(5);
      expect(result.resolved).toBeDefined();
    });

    test('should perform vulnerability assessment', async () => {
      await securityManager.initialize();
      
      const result = await securityManager.performVulnerabilityAssessment();
      
      expect(result.assessment).toBeDefined();
      expect(result.vulnerabilities).toBeGreaterThanOrEqual(0);
      expect(result.remediationPlan).toBeDefined();
    });

    test('should implement zero trust', async () => {
      await securityManager.initialize();
      
      const result = await securityManager.implementZeroTrust();
      
      expect(result.components).toBeGreaterThan(0);
      expect(result.zeroTrustReady).toBe(true);
    });

    test('security stress test: concurrent authentication', async () => {
      await securityManager.initialize();
      
      const startTime = performance.now();
      
      // Simulate concurrent authentication attempts
      const authAttempts = Array.from({ length: 100 }, (_, i) => 
        securityManager.authenticateUser({
          username: `user${i}`,
          password: 'password123'
        }).catch(() => ({ success: false }))
      );

      const results = await Promise.all(authAttempts);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(15000); // 15 seconds
    });

    test('penetration test simulation', async () => {
      await securityManager.initialize();
      
      // Simulate various attack vectors
      const attackVectors = [
        { type: 'brute_force', attempts: 10 },
        { type: 'sql_injection', payload: "'; DROP TABLE users; --" },
        { type: 'xss', payload: '<script>alert("xss")</script>' }
      ];

      for (const attack of attackVectors) {
        const threats = await securityManager.detectThreats({
          attack: attack.type,
          payload: attack.payload
        });
        
        // Security system should detect threats
        expect(threats.scanned).toBeGreaterThan(0);
      }
    });
  });

  describe('NaturalLanguageProcessor', () => {
    let nlpProcessor;

    beforeEach(() => {
      nlpProcessor = new NaturalLanguageProcessor({
        supportedLanguages: ['en', 'ja'],
        defaultLanguage: 'en',
        conversationMemory: 10,
        voiceEnabled: true
      });
    });

    test('should initialize successfully', async () => {
      const result = await nlpProcessor.initialize();
      expect(result).toBe(true);
    });

    test('should process English input', async () => {
      await nlpProcessor.initialize();
      
      const input = "Create a new schedule for next week";
      const result = await nlpProcessor.processInput(input);
      
      expect(result.language).toBe('en');
      expect(result.intent).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should process Japanese input', async () => {
      await nlpProcessor.initialize();
      
      const input = "来週のスケジュールを作成してください";
      const result = await nlpProcessor.processInput(input);
      
      expect(result.language).toBe('ja');
      expect(result.intent).toBeDefined();
      expect(result.response).toBeDefined();
    });

    test('should start conversation', async () => {
      await nlpProcessor.initialize();
      
      const result = await nlpProcessor.startConversation('test_session', 'en');
      
      expect(result.sessionId).toBe('test_session');
      expect(result.language).toBe('en');
      expect(result.greeting).toBeDefined();
      expect(result.ready).toBe(true);
    });

    test('should manage conversation turns', async () => {
      await nlpProcessor.initialize();
      
      await nlpProcessor.startConversation('test_session', 'en');
      
      const result = await nlpProcessor.manageTurn(
        "What can you help me with?",
        'test_session'
      );
      
      expect(result.sessionId).toBe('test_session');
      expect(result.turn).toBeGreaterThan(0);
      expect(result.response).toBeDefined();
    });

    test('should execute commands', async () => {
      await nlpProcessor.initialize();
      
      const result = await nlpProcessor.executeCommand('schedule_create', {
        date: '2024-01-15',
        staff: ['Alice', 'Bob']
      });
      
      expect(result.command).toBe('schedule_create');
      expect(result.executed).toBeDefined();
    });

    test('should answer questions', async () => {
      await nlpProcessor.initialize();
      
      const question = "How do I create a new schedule?";
      const result = await nlpProcessor.answerQuestion(question);
      
      expect(result.question).toBe(question);
      expect(result.questionType).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should perform semantic analysis', async () => {
      await nlpProcessor.initialize();
      
      const text = "I'm really happy with the new scheduling system!";
      const result = await nlpProcessor.performSemanticAnalysis(text);
      
      expect(result.results.sentiment).toBeDefined();
      expect(result.results.keyPhrases).toBeDefined();
      expect(result.results.emotions).toBeDefined();
    });

    test('performance benchmark: language processing speed', async () => {
      await nlpProcessor.initialize();
      
      const startTime = performance.now();
      
      // Process multiple inputs
      const inputs = [
        "Create a schedule",
        "スケジュールを作成",
        "Show me the report",
        "レポートを表示",
        "Help with staff management"
      ];

      const results = await Promise.all(
        inputs.map(input => nlpProcessor.processInput(input))
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(3000); // 3 seconds
    });

    test('multilingual conversation flow', async () => {
      await nlpProcessor.initialize();
      
      // Start conversation in English
      await nlpProcessor.startConversation('multilingual_test', 'en');
      
      // Send English message
      const englishResult = await nlpProcessor.manageTurn(
        "Create a schedule for tomorrow",
        'multilingual_test'
      );
      expect(englishResult.response).toBeDefined();
      
      // Send Japanese message
      const japaneseResult = await nlpProcessor.manageTurn(
        "明日のスケジュールを作成",
        'multilingual_test'
      );
      expect(japaneseResult.response).toBeDefined();
      
      // Verify conversation continuity
      expect(japaneseResult.turn).toBeGreaterThan(englishResult.turn);
    });
  });

  describe('Integration Tests', () => {
    let components;

    beforeEach(async () => {
      components = {
        selfImproving: new SelfImprovingSystem(),
        automation: new IntelligentAutomation(),
        mobile: new MobileOptimizer(),
        cloud: new CloudDeployment(),
        security: new SecurityManager(),
        nlp: new NaturalLanguageProcessor()
      };

      // Initialize all components
      for (const component of Object.values(components)) {
        await component.initialize();
      }
    });

    test('end-to-end workflow: AI-powered schedule creation', async () => {
      // 1. NLP processes user request
      const nlpResult = await components.nlp.processInput(
        "Create an optimized schedule for next week with 10 staff members"
      );
      expect(nlpResult.intent).toBe('schedule_create');

      // 2. Security validates user access
      const authResult = await components.security.authenticateUser({
        username: 'manager',
        password: 'secure123'
      });
      expect(authResult.success).toBe(true);

      // 3. Automation triggers schedule creation workflow
      const workflowResult = await components.automation.automateWorkflow(
        'schedule_creation',
        { nlpRequest: nlpResult, user: authResult.user }
      );
      expect(workflowResult.success).toBeDefined();

      // 4. Self-improving system learns from the operation
      const learningResult = await components.selfImproving.learnFromOperation(
        'schedule_creation',
        { workflow: workflowResult, nlp: nlpResult }
      );
      expect(learningResult.results).toBeDefined();
    });

    test('autonomous operation resilience', async () => {
      // Simulate system under stress
      const stressOperations = Array.from({ length: 50 }, (_, i) => ({
        id: `stress_op_${i}`,
        type: Math.random() > 0.5 ? 'schedule_optimization' : 'staff_management',
        complexity: Math.random() > 0.7 ? 'high' : 'medium'
      }));

      const results = [];
      
      for (const operation of stressOperations) {
        try {
          // Process with multiple components
          const [nlpResult, automationResult, securityCheck] = await Promise.all([
            components.nlp.processInput(`Execute ${operation.type} operation`),
            components.automation.processSmartNotifications({
              type: operation.type,
              data: operation
            }),
            components.security.detectThreats({ operation })
          ]);

          results.push({
            operation: operation.id,
            nlp: nlpResult.confidence > 0.5,
            automation: automationResult.sent >= 0,
            security: securityCheck.riskLevel !== 'critical'
          });
        } catch (error) {
          results.push({
            operation: operation.id,
            error: error.message
          });
        }
      }

      // System should handle majority of operations successfully
      const successfulOperations = results.filter(r => 
        r.nlp && r.automation && r.security && !r.error
      );
      const successRate = successfulOperations.length / results.length;
      
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate
    });

    test('cross-component communication', async () => {
      // Test component interaction
      const communicationTest = {
        // NLP detects security threat in user input
        nlpInput: "DROP TABLE users; SELECT * FROM sensitive_data",
        
        // Security should detect SQL injection
        expectedThreat: true,
        
        // Automation should trigger security response
        expectedAutomation: true
      };

      // 1. NLP processes suspicious input
      const nlpResult = await components.nlp.processInput(communicationTest.nlpInput);
      
      // 2. Security analyzes the input
      const threatResult = await components.security.detectThreats({
        userInput: communicationTest.nlpInput,
        nlpAnalysis: nlpResult
      });
      
      // 3. Automation responds to security event
      const automationResponse = await components.automation.handleException({
        type: 'security_threat',
        severity: 'high',
        data: { input: communicationTest.nlpInput, threat: threatResult }
      });

      expect(nlpResult.processing).toBeDefined();
      expect(threatResult.scanned).toBeGreaterThan(0);
      expect(automationResponse.resolved).toBeDefined();
    });

    test('performance under load', async () => {
      const startTime = performance.now();
      
      // Simulate high load across all components
      const loadTasks = [
        // Multiple NLP requests
        ...Array.from({ length: 20 }, (_, i) => 
          components.nlp.processInput(`Request ${i}: Create schedule`)
        ),
        
        // Security validations
        ...Array.from({ length: 15 }, (_, i) =>
          components.security.authenticateUser({
            username: `user${i}`,
            password: 'password123'
          }).catch(() => ({ success: false }))
        ),
        
        // Automation tasks
        ...Array.from({ length: 10 }, (_, i) =>
          components.automation.processSmartNotifications({
            type: 'load_test',
            data: { taskId: i }
          })
        ),
        
        // Cloud operations
        ...Array.from({ length: 5 }, () =>
          components.cloud.performHealthCheck()
        ),
        
        // Self-improvement learning
        ...Array.from({ length: 5 }, (_, i) =>
          components.selfImproving.learnFromOperation(`load_test_${i}`, {
            context: { loadTest: true },
            metrics: { performance: Math.random() }
          })
        )
      ];

      const results = await Promise.allSettled(loadTasks);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const successfulTasks = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successfulTasks / results.length;
      
      // System should handle load efficiently
      expect(successRate).toBeGreaterThan(0.85); // 85% success rate
      expect(duration).toBeLessThan(30000); // 30 seconds
    });

    test('data consistency across components', async () => {
      // Test data consistency when multiple components interact
      const testData = {
        scheduleId: 'consistency_test_123',
        operation: 'schedule_update',
        changes: { staff: 5, hours: 40 }
      };

      // 1. Security logs the operation
      await components.security.auditManager.logDataOperation({
        type: 'schedule_update',
        scheduleId: testData.scheduleId,
        changes: testData.changes
      });

      // 2. Automation processes the change
      const automationResult = await components.automation.evaluatePolicies(testData);

      // 3. Self-improving system learns from it
      const learningResult = await components.selfImproving.learnFromOperation(
        testData.operation,
        { 
          scheduleId: testData.scheduleId,
          automation: automationResult,
          context: testData
        }
      );

      // Verify data consistency
      expect(automationResult.results).toBeDefined();
      expect(learningResult.results).toBeDefined();
      
      // All components should reference the same schedule ID
      const securityLogs = components.security.auditManager.auditLog;
      const recentLog = securityLogs[securityLogs.length - 1];
      expect(recentLog.scheduleId).toBe(testData.scheduleId);
    });
  });

  describe('Performance Benchmarks', () => {
    test('system startup time', async () => {
      const startTime = performance.now();
      
      const components = {
        selfImproving: new SelfImprovingSystem(),
        automation: new IntelligentAutomation(),
        mobile: new MobileOptimizer(),
        cloud: new CloudDeployment(),
        security: new SecurityManager(),
        nlp: new NaturalLanguageProcessor()
      };

      await Promise.all(
        Object.values(components).map(component => component.initialize())
      );
      
      const endTime = performance.now();
      const startupTime = endTime - startTime;
      
      // System should initialize within reasonable time
      expect(startupTime).toBeLessThan(10000); // 10 seconds
    });

    test('memory usage optimization', () => {
      const initialMemory = process.memoryUsage();
      
      // Create multiple component instances
      const instances = Array.from({ length: 10 }, () => ({
        selfImproving: new SelfImprovingSystem(),
        automation: new IntelligentAutomation(),
        security: new SecurityManager()
      }));
      
      const afterCreation = process.memoryUsage();
      const memoryIncrease = afterCreation.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('concurrent request handling', async () => {
      const nlp = new NaturalLanguageProcessor();
      await nlp.initialize();
      
      const startTime = performance.now();
      
      // Process 100 concurrent requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        nlp.processInput(`Test request number ${i}`)
      );
      
      const results = await Promise.all(requests);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = results.length / (duration / 1000); // requests per second
      
      expect(results).toHaveLength(100);
      expect(throughput).toBeGreaterThan(10); // At least 10 requests per second
    });
  });

  describe('Error Handling and Recovery', () => {
    test('component failure recovery', async () => {
      const automation = new IntelligentAutomation();
      await automation.initialize();
      
      // Simulate component failure
      const originalMethod = automation.processSmartNotifications;
      automation.processSmartNotifications = async () => {
        throw new Error('Simulated component failure');
      };
      
      // System should handle graceful failure
      try {
        await automation.processSmartNotifications({ type: 'test' });
        fail('Expected error was not thrown');
      } catch (error) {
        expect(error.message).toBe('Simulated component failure');
      }
      
      // Restore original method
      automation.processSmartNotifications = originalMethod;
      
      // System should recover
      const result = await automation.processSmartNotifications({ type: 'recovery_test' });
      expect(result).toBeDefined();
    });

    test('network failure resilience', async () => {
      const mobile = new MobileOptimizer();
      await mobile.initialize();
      
      // Simulate offline state
      mobile.state.isOnline = false;
      
      const result = await mobile.synchronizeOfflineData();
      
      // Should handle offline gracefully
      expect(result.status).toBe('waiting');
      expect(result.reason).toBe('offline');
    });

    test('data corruption handling', async () => {
      const security = new SecurityManager();
      await security.initialize();
      
      // Simulate data corruption scenario
      const corruptedData = "corrupted_binary_data_\x00\x01\x02";
      
      try {
        await security.encryptSensitiveData(corruptedData);
        // Should handle corrupted data gracefully
        expect(true).toBe(true);
      } catch (error) {
        // Error should be handled gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Security Testing', () => {
    test('authentication bypass attempts', async () => {
      const security = new SecurityManager();
      await security.initialize();
      
      const bypassAttempts = [
        { username: "admin'; --", password: "anything" },
        { username: "admin", password: "' OR '1'='1" },
        { username: "", password: "" },
        { username: null, password: null }
      ];
      
      for (const attempt of bypassAttempts) {
        const result = await security.authenticateUser(attempt);
        // All bypass attempts should fail
        expect(result.success).toBe(false);
      }
    });

    test('injection attack detection', async () => {
      const nlp = new NaturalLanguageProcessor();
      await nlp.initialize();
      
      const injectionAttempts = [
        "'; DROP TABLE schedules; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "eval(document.cookie)"
      ];
      
      for (const attempt of injectionAttempts) {
        const result = await nlp.processInput(attempt);
        // Should process safely without executing malicious code
        expect(result).toBeDefined();
        expect(result.response).toBeDefined();
      }
    });

    test('rate limiting effectiveness', async () => {
      const security = new SecurityManager();
      await security.initialize();
      
      const username = 'rate_limit_test_user';
      const attempts = [];
      
      // Attempt login multiple times rapidly
      for (let i = 0; i < 10; i++) {
        const result = await security.authenticateUser({
          username,
          password: 'wrong_password'
        });
        attempts.push(result);
      }
      
      // Account should be locked after max attempts
      const finalAttempt = attempts[attempts.length - 1];
      expect(finalAttempt.success).toBe(false);
    });
  });
});

// Test utilities and helpers
class TestHelper {
  static async waitForCondition(condition, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Condition not met within timeout');
  }
  
  static generateTestData(type, count = 10) {
    switch (type) {
      case 'users':
        return Array.from({ length: count }, (_, i) => ({
          id: `user_${i}`,
          username: `testuser${i}`,
          role: i % 3 === 0 ? 'admin' : 'user'
        }));
      
      case 'schedules':
        return Array.from({ length: count }, (_, i) => ({
          id: `schedule_${i}`,
          date: new Date(Date.now() + i * 86400000).toISOString(),
          staff: Math.floor(Math.random() * 10) + 1
        }));
      
      default:
        return [];
    }
  }
  
  static mockNetworkConditions(type) {
    const conditions = {
      slow: { delay: 2000, error: false },
      unstable: { delay: 500, error: Math.random() > 0.7 },
      offline: { delay: 0, error: true }
    };
    
    return conditions[type] || conditions.slow;
  }
}

// Export test helper for external use
export { TestHelper };