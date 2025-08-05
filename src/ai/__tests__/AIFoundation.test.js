/**
 * AIFoundation.test.js
 * 
 * Comprehensive test suite for the AI Foundation system.
 * Tests all core functionality, data processing, and constraint validation.
 */

import { AIFoundation } from '../AIFoundation';
import { extractAllDataForAI } from '../utils/DataExtractor';
import { validateAllConstraints } from '../constraints/ConstraintEngine';
import { StaffGroupManager } from '../models/StaffGroupModel';
import { ConstraintManager } from '../models/ConstraintModel';
import { PreferenceManager } from '../models/PreferenceModel';

// Mock data for testing
const mockStaffMembers = [
  {
    id: 'staff_001',
    name: '料理長',
    position: 'Chef',
    status: '社員',
    type: '社員',
    department: 'Kitchen'
  },
  {
    id: 'staff_002',
    name: '古藤',
    position: 'Sous Chef',
    status: '社員',
    type: '社員',
    department: 'Kitchen'
  },
  {
    id: 'staff_003',
    name: '井関',
    position: 'Cook',
    status: '派遣',
    type: '派遣',
    department: 'Kitchen'
  },
  {
    id: 'staff_004',
    name: '小池',
    position: 'Cook',
    status: '派遣',
    type: '派遣',
    department: 'Kitchen'
  }
];

const mockDateRange = [
  new Date('2025-01-21'),
  new Date('2025-01-22'),
  new Date('2025-01-23'),
  new Date('2025-01-24'),
  new Date('2025-01-25'),
  new Date('2025-01-26'),
  new Date('2025-01-27')
];

const mockScheduleData = {
  'staff_001': {
    '2025-01-21': '',    // Normal shift
    '2025-01-22': '△',   // Early shift
    '2025-01-23': '',    // Normal shift
    '2025-01-24': '',    // Normal shift
    '2025-01-25': '',    // Normal shift
    '2025-01-26': '△',   // Early shift (Sunday - preferred)
    '2025-01-27': ''     // Normal shift
  },
  'staff_002': {
    '2025-01-21': '',    // Normal shift
    '2025-01-22': '',    // Normal shift
    '2025-01-23': '×',   // Off day
    '2025-01-24': '',    // Normal shift
    '2025-01-25': '',    // Normal shift
    '2025-01-26': '',    // Normal shift
    '2025-01-27': ''     // Normal shift
  },
  'staff_003': {
    '2025-01-21': '',    // Normal shift
    '2025-01-22': '',    // Normal shift
    '2025-01-23': '',    // Normal shift
    '2025-01-24': '×',   // Off day
    '2025-01-25': '',    // Normal shift
    '2025-01-26': '',    // Normal shift
    '2025-01-27': ''     // Normal shift
  },
  'staff_004': {
    '2025-01-21': '',    // Normal shift
    '2025-01-22': '',    // Normal shift
    '2025-01-23': '',    // Normal shift
    '2025-01-24': '',    // Normal shift
    '2025-01-25': '×',   // Off day
    '2025-01-26': '',    // Normal shift
    '2025-01-27': ''     // Normal shift
  }
};

describe('AIFoundation', () => {
  let aiFoundation;

  beforeEach(() => {
    aiFoundation = new AIFoundation();
    
    // Mock console methods to reduce test noise
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      // Mock the data extraction to return test data
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [{
              monthIndex: 0,
              scheduleData: mockScheduleData,
              staffData: mockStaffMembers,
              dateRange: mockDateRange
            }],
            staffProfiles: {
              'staff_001': {
                id: 'staff_001',
                name: '料理長',
                totalShifts: 7,
                shiftCounts: { '': 5, '△': 2 },
                shiftHistory: { 0: mockScheduleData['staff_001'] }
              }
            },
            summary: {
              totalStaff: 4,
              totalPeriods: 1
            }
          }
        });

      const result = await aiFoundation.initialize();

      expect(result.success).toBe(true);
      expect(aiFoundation.initialized).toBe(true);
      expect(result.components.dataExtractor).toBe('initialized');
      expect(result.components.constraintEngine).toBe('initialized');
      expect(result.components.patternRecognizer).toBe('initialized');
    });

    test('should handle initialization failure', async () => {
      // Mock data extraction failure
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: false,
          error: 'No data found'
        });

      const result = await aiFoundation.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data extraction failed');
      expect(aiFoundation.initialized).toBe(false);
    });
  });

  describe('Constraint Validation', () => {
    beforeEach(async () => {
      // Initialize the foundation with mock data
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {},
            summary: { totalStaff: 0 }
          }
        });
      
      await aiFoundation.initialize();
    });

    test('should validate constraints successfully', async () => {
      const result = await aiFoundation.validateConstraints(
        mockScheduleData,
        mockStaffMembers,
        mockDateRange
      );

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.constraintValidation).toBeDefined();
      expect(typeof result.overallValid).toBe('boolean');
      expect(typeof result.totalViolations).toBe('number');
    });

    test('should detect staff group conflicts', async () => {
      // Create schedule with conflicting group members both off
      const conflictScheduleData = {
        ...mockScheduleData,
        'staff_001': {
          ...mockScheduleData['staff_001'],
          '2025-01-21': '×' // 料理長 off
        },
        'staff_002': {
          ...mockScheduleData['staff_002'],
          '2025-01-21': '×' // 古藤 off (same group as 料理長)
        }
      };

      const result = await aiFoundation.validateConstraints(
        conflictScheduleData,
        mockStaffMembers,
        mockDateRange
      );

      expect(result.groupValidations.length).toBeGreaterThan(0);
      expect(result.overallValid).toBe(false);
    });

    test('should detect monthly limit violations', async () => {
      // Create schedule with too many off days
      const excessiveOffDays = {};
      mockDateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        excessiveOffDays[dateKey] = '×'; // All days off
      });

      const violatingScheduleData = {
        'staff_001': excessiveOffDays
      };

      const result = await aiFoundation.validateConstraints(
        violatingScheduleData,
        [mockStaffMembers[0]], // Just one staff member
        mockDateRange
      );

      expect(result.constraintValidation.totalViolations).toBeGreaterThan(0);
    });
  });

  describe('Staff Preference Analysis', () => {
    beforeEach(async () => {
      // Initialize with preferences
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {
              'staff_001': {
                id: 'staff_001',
                name: '料理長',
                totalShifts: 14,
                shiftCounts: { '': 10, '△': 4 },
                shiftHistory: {
                  0: {
                    '2025-01-19': '△', // Sunday early
                    '2025-01-26': '△'  // Sunday early
                  }
                }
              }
            },
            summary: { totalStaff: 1 }
          }
        });
      
      await aiFoundation.initialize();
    });

    test('should analyze staff preferences', async () => {
      const result = await aiFoundation.analyzeStaffPreferences(
        'staff_001',
        mockScheduleData,
        mockDateRange
      );

      expect(result).toBeDefined();
      expect(result.staffId).toBe('staff_001');
      expect(result.overallScore).toBeDefined();
      expect(result.totalPreferences).toBeDefined();
      expect(result.satisfactionLevel).toBeDefined();
      expect(result.dailyScores).toBeDefined();
    });

    test('should handle staff with no preferences', async () => {
      const result = await aiFoundation.analyzeStaffPreferences(
        'staff_999', // Non-existent staff
        mockScheduleData,
        mockDateRange
      );

      expect(result.totalPreferences).toBe(0);
      expect(result.overallScore).toBe(0);
    });
  });

  describe('System Status', () => {
    test('should return system status when not initialized', () => {
      const status = aiFoundation.getSystemStatus();

      expect(status.initialized).toBe(false);
      expect(status.initializationTime).toBeNull();
      expect(status.components).toBeDefined();
    });

    test('should return system status when initialized', async () => {
      // Initialize first
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {},
            summary: { totalStaff: 0 }
          }
        });
      
      await aiFoundation.initialize();
      
      const status = aiFoundation.getSystemStatus();

      expect(status.initialized).toBe(true);
      expect(status.initializationTime).toBeDefined();
      expect(status.components.constraintManager.totalConstraints).toBeGreaterThan(0);
    });
  });

  describe('Data Export/Import', () => {
    beforeEach(async () => {
      // Initialize the foundation
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {},
            summary: { totalStaff: 0 }
          }
        });
      
      await aiFoundation.initialize();
    });

    test('should export data successfully', () => {
      const exportedData = aiFoundation.exportData();

      expect(exportedData).toBeDefined();
      expect(exportedData.exportedAt).toBeDefined();
      expect(exportedData.version).toBeDefined();
      expect(exportedData.systemStatus).toBeDefined();
      expect(exportedData.staffGroups).toBeDefined();
      expect(exportedData.constraints).toBeDefined();
      expect(exportedData.preferences).toBeDefined();
    });

    test('should import data successfully', () => {
      const exportedData = aiFoundation.exportData();
      const importResult = aiFoundation.importData(exportedData);

      expect(importResult.success).toBe(true);
      expect(importResult.message).toContain('imported successfully');
    });

    test('should handle import errors gracefully', () => {
      const invalidData = { invalid: 'data' };
      const importResult = aiFoundation.importData(invalidData);

      expect(importResult.success).toBe(true); // Should still succeed with partial data
    });
  });

  describe('System Reset', () => {
    test('should reset system successfully', async () => {
      // Initialize first
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {},
            summary: { totalStaff: 0 }
          }
        });
      
      await aiFoundation.initialize();
      expect(aiFoundation.initialized).toBe(true);

      const resetResult = aiFoundation.reset();

      expect(resetResult.success).toBe(true);
      expect(aiFoundation.initialized).toBe(false);
      expect(aiFoundation.lastAnalysis).toBeNull();
      expect(aiFoundation.analysisHistory).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle method calls before initialization', async () => {
      await expect(aiFoundation.analyzeSchedule(0))
        .rejects
        .toThrow('AI Foundation not initialized');

      await expect(aiFoundation.validateConstraints({}, [], []))
        .rejects
        .toThrow('AI Foundation not initialized');

      await expect(aiFoundation.analyzeStaffPreferences('staff_001', {}, []))
        .rejects
        .toThrow('AI Foundation not initialized');
    });

    test('should handle analysis errors gracefully', async () => {
      // Initialize with failing data extractor
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: true,
          data: {
            rawPeriodData: [],
            staffProfiles: {},
            summary: { totalStaff: 0 }
          }
        });
      
      await aiFoundation.initialize();

      // Mock data extractor to fail on second call
      jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
        .mockReturnValue({
          success: false,
          error: 'Analysis failed'
        });

      await expect(aiFoundation.analyzeSchedule(0))
        .rejects
        .toThrow('Data extraction failed: Analysis failed');
    });
  });
});

describe('Constraint Engine Integration', () => {
  test('should validate monthly off limits correctly', () => {
    const scheduleData = {
      'staff_001': {}
    };

    // Create 31 days with 10 off days (exceeds limit of 8)
    for (let i = 1; i <= 31; i++) {
      const dateKey = `2025-01-${i.toString().padStart(2, '0')}`;
      scheduleData['staff_001'][dateKey] = i <= 10 ? '×' : '';
    }

    const dateRange = [];
    for (let i = 1; i <= 31; i++) {
      dateRange.push(new Date(`2025-01-${i.toString().padStart(2, '0')}`));
    }

    const result = validateAllConstraints(
      scheduleData,
      [{ id: 'staff_001', name: 'Test Staff' }],
      dateRange
    );

    expect(result.valid).toBe(false);
    expect(result.totalViolations).toBeGreaterThan(0);
    
    const monthlyViolations = result.allViolations.filter(v => 
      v.type === 'monthly_off_limit'
    );
    expect(monthlyViolations.length).toBeGreaterThan(0);
  });

  test('should validate daily limits correctly', () => {
    const scheduleData = {
      'staff_001': { '2025-01-21': '×' },
      'staff_002': { '2025-01-21': '×' },
      'staff_003': { '2025-01-21': '×' },
      'staff_004': { '2025-01-21': '×' },
      'staff_005': { '2025-01-21': '×' } // 5 staff off, exceeds limit of 4
    };

    const staffMembers = Array.from({ length: 5 }, (_, i) => ({
      id: `staff_${(i + 1).toString().padStart(3, '0')}`,
      name: `Staff ${i + 1}`
    }));

    const result = validateAllConstraints(
      scheduleData,
      staffMembers,
      [new Date('2025-01-21')]
    );

    expect(result.valid).toBe(false);
    
    const dailyViolations = result.allViolations.filter(v => 
      v.type === 'daily_off_limit'
    );
    expect(dailyViolations.length).toBeGreaterThan(0);
  });
});

describe('Staff Group Manager Integration', () => {
  test('should manage staff groups correctly', () => {
    const staffGroupManager = new StaffGroupManager();
    
    // Should have default groups
    const groups = staffGroupManager.getAllGroups();
    expect(groups.length).toBeGreaterThan(0);
    
    // Check for specific default groups
    const group1 = staffGroupManager.getGroup('Group 1');
    expect(group1).toBeDefined();
    expect(group1.members).toContain('料理長');
    expect(group1.members).toContain('井関');
    
    const group2 = staffGroupManager.getGroup('Group 2');
    expect(group2).toBeDefined();
    expect(group2.members).toContain('料理長');
    expect(group2.members).toContain('古藤');
  });

  test('should detect group conflicts', () => {
    const staffGroupManager = new StaffGroupManager();
    
    const conflictScheduleData = {
      'staff_001': { '2025-01-21': '×' }, // 料理長 off
      'staff_002': { '2025-01-21': '×' }  // 古藤 off (same group)
    };

    const staffMembers = [
      { id: 'staff_001', name: '料理長' },
      { id: 'staff_002', name: '古藤' }
    ];

    const result = staffGroupManager.checkAllGroupConflicts(
      conflictScheduleData,
      '2025-01-21',
      staffMembers
    );

    expect(result.hasConflicts).toBe(true);
    expect(result.groupConflicts.length).toBeGreaterThan(0);
  });
});

describe('Performance Tests', () => {
  test('should initialize within reasonable time', async () => {
    const aiFoundation = new AIFoundation();
    
    // Mock minimal data
    jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
      .mockReturnValue({
        success: true,
        data: {
          rawPeriodData: [],
          staffProfiles: {},
          summary: { totalStaff: 0 }
        }
      });

    const startTime = Date.now();
    const result = await aiFoundation.initialize();
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('should handle large datasets efficiently', async () => {
    const aiFoundation = new AIFoundation();
    
    // Create large mock dataset
    const largeStaffMembers = Array.from({ length: 50 }, (_, i) => ({
      id: `staff_${i.toString().padStart(3, '0')}`,
      name: `Staff ${i}`,
      status: '派遣'
    }));

    const largeDateRange = Array.from({ length: 31 }, (_, i) => 
      new Date(`2025-01-${(i + 1).toString().padStart(2, '0')}`)
    );

    const largeScheduleData = {};
    largeStaffMembers.forEach(staff => {
      largeScheduleData[staff.id] = {};
      largeDateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        largeScheduleData[staff.id][dateKey] = Math.random() > 0.8 ? '×' : '';
      });
    });

    jest.spyOn(require('../utils/DataExtractor'), 'extractAllDataForAI')
      .mockReturnValue({
        success: true,
        data: {
          rawPeriodData: [],
          staffProfiles: {},
          summary: { totalStaff: 0 }
        }
      });

    await aiFoundation.initialize();

    const startTime = Date.now();
    const result = await aiFoundation.validateConstraints(
      largeScheduleData,
      largeStaffMembers,
      largeDateRange
    );
    const endTime = Date.now();

    expect(result).toBeDefined();
    expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});