/**
 * TestUtils.js
 * 
 * Comprehensive testing utilities for Phase 6 validation
 * Provides tools for creating test data, measuring performance, and validating results
 */

import { format } from 'date-fns';

/**
 * Creates realistic test staff members with various types and constraints
 */
export function createTestStaffMembers(count = 20) {
  const positions = ['マネージャー', 'シニアスタッフ', 'スタッフ', 'アルバイト'];
  const departments = ['キッチン', 'ホール', 'レジ', '清掃'];
  const statuses = ['社員', 'パート'];
  
  const staffMembers = [];
  
  for (let i = 0; i < count; i++) {
    const isRegular = Math.random() > 0.4; // 60% regular employees
    
    staffMembers.push({
      id: `staff_${i + 1}`,
      name: `テストスタッフ${i + 1}`,
      status: isRegular ? '社員' : 'パート',
      position: positions[Math.floor(Math.random() * positions.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      maxConsecutiveDays: isRegular ? 6 : 4,
      preferredShifts: generatePreferredShifts(),
      availability: generateAvailability(),
      skillLevel: Math.floor(Math.random() * 5) + 1, // 1-5 skill level
      hourlyRate: isRegular ? 1500 + Math.random() * 500 : 1000 + Math.random() * 300
    });
  }
  
  return staffMembers;
}

/**
 * Creates test schedule data with realistic patterns and constraints
 */
export function createTestScheduleData(staffCount = 20, dayCount = 60) {
  const scheduleData = {};
  const shiftTypes = ['△', '○', '▽', '×'];
  const shiftWeights = [0.2, 0.4, 0.2, 0.2]; // Normal shift weighted higher
  
  const startDate = new Date(2024, 0, 1); // January 1, 2024
  
  for (let staffIndex = 0; staffIndex < staffCount; staffIndex++) {
    const staffId = `staff_${staffIndex + 1}`;
    scheduleData[staffId] = {};
    
    let consecutiveDays = 0;
    let isRegular = Math.random() > 0.4;
    let maxConsecutive = isRegular ? 6 : 4;
    
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayIndex);
      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Apply realistic patterns
      let shiftType;
      
      // Force day off if consecutive limit reached
      if (consecutiveDays >= maxConsecutive) {
        shiftType = '×';
        consecutiveDays = 0;
      } else {
        // Weekend patterns (less likely to work)
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const weekendAdjustment = isWeekend ? 0.4 : 1.0;
        
        // Select shift type based on weights
        const random = Math.random() * weekendAdjustment;
        let cumulativeWeight = 0;
        
        for (let i = 0; i < shiftTypes.length; i++) {
          cumulativeWeight += shiftWeights[i];
          if (random <= cumulativeWeight) {
            shiftType = shiftTypes[i];
            break;
          }
        }
        
        if (shiftType === '×') {
          consecutiveDays = 0;
        } else {
          consecutiveDays++;
        }
      }
      
      scheduleData[staffId][dateKey] = shiftType;
    }
  }
  
  return scheduleData;
}

/**
 * Creates realistic test constraints for validation
 */
export function createTestConstraints() {
  return {
    minStaffPerShift: {
      '△': 3, // Early shift minimum
      '○': 5, // Normal shift minimum  
      '▽': 3  // Late shift minimum
    },
    maxConsecutiveDays: {
      '社員': 6,
      'パート': 4
    },
    requiredSkills: {
      'マネージャー': ['leadership', 'customer_service'],
      'シニアスタッフ': ['customer_service'],
      'スタッフ': [],
      'アルバイト': []
    },
    departmentRequirements: {
      'キッチン': { minStaff: 2, skillRequired: 'cooking' },
      'ホール': { minStaff: 3, skillRequired: 'customer_service' },
      'レジ': { minStaff: 1, skillRequired: 'cash_handling' },
      '清掃': { minStaff: 1, skillRequired: 'cleaning' }
    },
    costConstraints: {
      maxDailyCost: 50000, // yen
      overtimeMultiplier: 1.25,
      holidayMultiplier: 1.5
    }
  };
}

/**
 * Measures performance of a function execution
 */
export async function measurePerformance(func, ...args) {
  const startTime = Date.now();
  const startMemory = getMemoryUsage();
  
  let result;
  let error = null;
  
  try {
    result = await func(...args);
  } catch (e) {
    error = e;
  }
  
  const endTime = Date.now();
  const endMemory = getMemoryUsage();
  
  return {
    result,
    error,
    executionTime: endTime - startTime,
    memoryUsage: {
      start: startMemory,
      end: endMemory,
      delta: endMemory - startMemory
    },
    success: !error
  };
}

/**
 * Validates business rules compliance in generated schedules
 */
export function validateBusinessRules(schedule, staffMembers, constraints = createTestConstraints()) {
  const violations = [];
  const results = {
    overall: 0,
    consecutiveDays: { violations: 0, total: 0 },
    minStaffing: { violations: 0, total: 0 },
    skillRequirements: { violations: 0, total: 0 },
    workloadBalance: { score: 0 },
    costCompliance: { violations: 0, total: 0 }
  };
  
  // Check consecutive days violations
  staffMembers.forEach(staff => {
    const staffSchedule = schedule[staff.id] || {};
    const dateKeys = Object.keys(staffSchedule).sort();
    
    let consecutiveCount = 0;
    const maxAllowed = constraints.maxConsecutiveDays[staff.status] || 5;
    
    dateKeys.forEach(dateKey => {
      const shift = staffSchedule[dateKey];
      
      if (shift !== '×') {
        consecutiveCount++;
      } else {
        consecutiveCount = 0;
      }
      
      if (consecutiveCount > maxAllowed) {
        violations.push({
          type: 'consecutive_days',
          staffId: staff.id,
          dateKey,
          value: consecutiveCount,
          limit: maxAllowed
        });
        results.consecutiveDays.violations++;
      }
      
      results.consecutiveDays.total++;
    });
  });
  
  // Check minimum staffing violations
  const dateKeys = new Set();
  Object.values(schedule).forEach(staffSchedule => {
    Object.keys(staffSchedule).forEach(dateKey => dateKeys.add(dateKey));
  });
  
  Array.from(dateKeys).forEach(dateKey => {
    const shiftCounts = { '△': 0, '○': 0, '▽': 0 };
    
    Object.values(schedule).forEach(staffSchedule => {
      const shift = staffSchedule[dateKey];
      if (shiftCounts[shift] !== undefined) {
        shiftCounts[shift]++;
      }
    });
    
    Object.entries(constraints.minStaffPerShift).forEach(([shiftType, minRequired]) => {
      if (shiftCounts[shiftType] < minRequired) {
        violations.push({
          type: 'min_staffing',
          dateKey,
          shiftType,
          actual: shiftCounts[shiftType],
          required: minRequired
        });
        results.minStaffing.violations++;
      }
      results.minStaffing.total++;
    });
  });
  
  // Calculate workload balance
  const workloads = staffMembers.map(staff => {
    const staffSchedule = schedule[staff.id] || {};
    const workDays = Object.values(staffSchedule).filter(shift => shift !== '×').length;
    return workDays;
  });
  
  const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
  const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
  results.workloadBalance.score = Math.max(0, 1 - (workloadVariance / (avgWorkload * avgWorkload)));
  
  // Calculate overall compliance score
  const totalViolations = violations.length;
  const totalChecks = results.consecutiveDays.total + results.minStaffing.total + results.skillRequirements.total;
  results.overall = totalChecks > 0 ? Math.max(0, ((totalChecks - totalViolations) / totalChecks) * 100) : 100;
  
  return {
    ...results,
    violations,
    compliant: violations.length === 0
  };
}

/**
 * Calculates accuracy by comparing predicted vs expected schedules
 */
export function calculateAccuracy(predicted, expected) {
  if (!predicted || !expected) return 0;
  
  let totalCells = 0;
  let correctCells = 0;
  
  // Get all staff IDs from both schedules
  const allStaffIds = new Set([
    ...Object.keys(predicted),
    ...Object.keys(expected)
  ]);
  
  allStaffIds.forEach(staffId => {
    const predictedStaff = predicted[staffId] || {};
    const expectedStaff = expected[staffId] || {};
    
    // Get all dates from both schedules
    const allDates = new Set([
      ...Object.keys(predictedStaff),
      ...Object.keys(expectedStaff)
    ]);
    
    allDates.forEach(dateKey => {
      const predictedShift = predictedStaff[dateKey];
      const expectedShift = expectedStaff[dateKey];
      
      totalCells++;
      
      if (predictedShift === expectedShift) {
        correctCells++;
      }
    });
  });
  
  return totalCells > 0 ? correctCells / totalCells : 0;
}

/**
 * Simulates memory constraints for testing
 */
export function simulateMemoryConstraints(limitMB = 50) {
  const limit = limitMB * 1024 * 1024; // Convert to bytes
  
  return {
    checkMemoryLimit: () => {
      const current = getMemoryUsage();
      return current < limit;
    },
    getCurrentUsage: () => getMemoryUsage(),
    getLimit: () => limit,
    getRemainingMemory: () => Math.max(0, limit - getMemoryUsage())
  };
}

/**
 * Creates load testing scenarios
 */
export function createLoadTestScenarios() {
  return [
    {
      name: 'Light Load',
      concurrentUsers: 1,
      operationsPerUser: 10,
      dataSize: 'small'
    },
    {
      name: 'Medium Load', 
      concurrentUsers: 5,
      operationsPerUser: 20,
      dataSize: 'medium'
    },
    {
      name: 'Heavy Load',
      concurrentUsers: 10,
      operationsPerUser: 50,
      dataSize: 'large'
    },
    {
      name: 'Stress Test',
      concurrentUsers: 20,
      operationsPerUser: 100,
      dataSize: 'xlarge'
    }
  ];
}

/**
 * Validates TensorFlow model performance metrics
 */
export function validateTensorFlowMetrics(metrics) {
  const validationResults = {
    isValid: true,
    issues: []
  };
  
  // Check accuracy
  if (metrics.accuracy < 0.5) {
    validationResults.isValid = false;
    validationResults.issues.push('Accuracy too low: ' + metrics.accuracy);
  }
  
  // Check loss
  if (metrics.loss > 2.0) {
    validationResults.isValid = false;
    validationResults.issues.push('Loss too high: ' + metrics.loss);
  }
  
  // Check training time
  if (metrics.trainingTime > 60000) { // 60 seconds
    validationResults.isValid = false;
    validationResults.issues.push('Training time too long: ' + metrics.trainingTime + 'ms');
  }
  
  // Check memory usage
  if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
    validationResults.isValid = false;
    validationResults.issues.push('Memory usage too high: ' + Math.round(metrics.memoryUsage / 1024 / 1024) + 'MB');
  }
  
  return validationResults;
}

/**
 * Creates benchmark test cases for ML vs rule-based comparison
 */
export function createBenchmarkTestCases() {
  return [
    {
      name: 'Standard Week Schedule',
      description: 'Normal week with standard staffing requirements',
      staffCount: 10,
      dayCount: 7,
      complexity: 'low',
      expectedAccuracy: { ml: 0.85, rules: 0.65 }
    },
    {
      name: 'Holiday Period Schedule',
      description: 'Holiday period with increased demand and constraints',
      staffCount: 15,
      dayCount: 14,
      complexity: 'medium',
      specialConstraints: ['holiday_pay', 'increased_demand'],
      expectedAccuracy: { ml: 0.80, rules: 0.55 }
    },
    {
      name: 'Staff Shortage Scenario',
      description: 'Period with limited staff availability',
      staffCount: 6,
      dayCount: 14,
      complexity: 'high',
      specialConstraints: ['limited_staff', 'maintain_coverage'],
      expectedAccuracy: { ml: 0.75, rules: 0.45 }
    },
    {
      name: 'Mixed Employment Types',
      description: 'Complex mix of full-time and part-time employees',
      staffCount: 20,
      dayCount: 30,
      complexity: 'high',
      specialConstraints: ['mixed_employment', 'skill_requirements'],
      expectedAccuracy: { ml: 0.90, rules: 0.70 }
    },
    {
      name: 'Large Scale Schedule',
      description: 'Large restaurant with many staff and complex constraints',
      staffCount: 50,
      dayCount: 60,
      complexity: 'very_high',
      specialConstraints: ['large_scale', 'department_requirements', 'cost_optimization'],
      expectedAccuracy: { ml: 0.88, rules: 0.60 }
    }
  ];
}

/**
 * Generates realistic user feedback for model improvement testing
 */
export function generateUserFeedback(schedule, staffMembers, feedbackType = 'mixed') {
  const feedback = [];
  
  const feedbackTypes = {
    positive: 0.8, // 80% positive feedback
    mixed: 0.6,    // 60% positive feedback  
    negative: 0.3  // 30% positive feedback
  };
  
  const positiveRate = feedbackTypes[feedbackType] || 0.6;
  
  Object.entries(schedule).forEach(([staffId, staffSchedule]) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;
    
    Object.entries(staffSchedule).forEach(([dateKey, shiftType]) => {
      if (Math.random() < 0.3) { // 30% chance of feedback on any given shift
        const isPositive = Math.random() < positiveRate;
        
        feedback.push({
          staffId,
          dateKey,
          originalShift: shiftType,
          feedback: isPositive ? 'correct' : 'incorrect',
          suggestedShift: isPositive ? shiftType : getAlternativeShift(shiftType),
          reason: isPositive ? 
            'Good match for staff preferences' : 
            'Conflicts with availability or preferences',
          timestamp: new Date().toISOString()
        });
      }
    });
  });
  
  return feedback;
}

// Helper functions
function generatePreferredShifts() {
  const shifts = ['△', '○', '▽'];
  const preferences = {};
  
  shifts.forEach(shift => {
    preferences[shift] = Math.random(); // 0-1 preference score
  });
  
  return preferences;
}

function generateAvailability() {
  const availability = {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    availability[day] = {
      available: Math.random() > 0.2, // 80% chance available
      preferredShifts: ['△', '○', '▽'].filter(() => Math.random() > 0.3)
    };
  });
  
  return availability;
}

function getMemoryUsage() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize;
  }
  
  // Fallback for Node.js environment
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  
  return 0;
}

function getAlternativeShift(currentShift) {
  const alternatives = {
    '△': '○',
    '○': '▽', 
    '▽': '△',
    '×': '○'
  };
  
  return alternatives[currentShift] || '○';
}

/**
 * Creates comprehensive test report generator
 */
export class TestReportGenerator {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }
  
  addTestResult(testName, result) {
    this.testResults.push({
      testName,
      result,
      timestamp: new Date().toISOString()
    });
  }
  
  generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    const passedTests = this.testResults.filter(r => r.result.success).length;
    const totalTests = this.testResults.length;
    const passRate = (passedTests / totalTests) * 100;
    
    return {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: passRate.toFixed(1),
        totalDuration
      },
      testResults: this.testResults,
      phase6Status: passRate >= 85 ? 'SUCCESS' : 'NEEDS_ATTENTION',
      recommendations: this.generateRecommendations()
    };
  }
  
  generateRecommendations() {
    const failedTests = this.testResults.filter(r => !r.result.success);
    const recommendations = [];
    
    if (failedTests.length > 0) {
      recommendations.push('Review failed tests and address underlying issues');
    }
    
    // Add specific recommendations based on test results
    const performanceIssues = this.testResults.filter(r => 
      r.result.executionTime && r.result.executionTime > 5000
    );
    
    if (performanceIssues.length > 0) {
      recommendations.push('Optimize performance for slow-running operations');
    }
    
    return recommendations;
  }
}

export default {
  createTestStaffMembers,
  createTestScheduleData,
  createTestConstraints,
  measurePerformance,
  validateBusinessRules,
  calculateAccuracy,
  simulateMemoryConstraints,
  createLoadTestScenarios,
  validateTensorFlowMetrics,
  createBenchmarkTestCases,
  generateUserFeedback,
  TestReportGenerator
};