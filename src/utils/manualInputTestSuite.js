/**
 * Manual Input Integration Test Suite
 * 
 * This provides utilities to test and verify that manual schedule input
 * works correctly with all storage systems and app features.
 */

import { dataIntegrityMonitor, dataValidation, dataRecovery } from './dataIntegrityUtils';
import { optimizedStorage } from './storageUtils';
import { generateDateRange } from './dateUtils';

/**
 * Manual input integration tests
 */
export const manualInputTestSuite = {
  /**
   * Test basic manual input flow
   */
  async testBasicManualInput(updateShift, periodIndex = 0) {
    console.log('🧪 Testing basic manual input flow...');
    
    const testStaffId = 'test-staff-001';
    const testDateKey = '2024-01-15';
    const testValue = '△';
    
    const results = {
      inputSuccess: false,
      persistenceCheck: null,
      dataIntegrityCheck: null,
      issues: []
    };

    try {
      // Attempt manual input
      updateShift(testStaffId, testDateKey, testValue);
      results.inputSuccess = true;
      
      // Wait for auto-save debounce
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check data persistence
      results.persistenceCheck = await dataIntegrityMonitor.checkManualInputPersistence(
        periodIndex, testStaffId, testDateKey, testValue
      );
      
      // Check data integrity
      const scheduleData = optimizedStorage.getScheduleData(periodIndex);
      results.dataIntegrityCheck = dataValidation.validateScheduleStructure(scheduleData);
      
      if (results.persistenceCheck.issues.length > 0) {
        results.issues.push(...results.persistenceCheck.issues);
      }
      
      if (results.dataIntegrityCheck.length > 0) {
        results.issues.push(...results.dataIntegrityCheck);
      }
      
    } catch (error) {
      results.issues.push(`Test execution error: ${error.message}`);
    }

    console.log('🧪 Basic manual input test results:', results);
    return results;
  },

  /**
   * Test bulk manual input operations
   */
  async testBulkManualInput(updateShift, periodIndex = 0) {
    console.log('🧪 Testing bulk manual input operations...');
    
    const testEntries = [
      { staffId: 'bulk-staff-001', dateKey: '2024-01-15', value: '○' },
      { staffId: 'bulk-staff-002', dateKey: '2024-01-15', value: '△' },
      { staffId: 'bulk-staff-001', dateKey: '2024-01-16', value: '×' },
      { staffId: 'bulk-staff-002', dateKey: '2024-01-16', value: '▽' },
    ];
    
    const results = {
      totalEntries: testEntries.length,
      successfulEntries: 0,
      failedEntries: 0,
      persistenceResults: [],
      issues: []
    };

    try {
      // Execute bulk entries
      for (const entry of testEntries) {
        try {
          updateShift(entry.staffId, entry.dateKey, entry.value);
          results.successfulEntries++;
        } catch (error) {
          results.failedEntries++;
          results.issues.push(`Failed to input ${entry.staffId}/${entry.dateKey}: ${error.message}`);
        }
      }
      
      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check persistence for each entry
      for (const entry of testEntries) {
        const persistenceCheck = await dataIntegrityMonitor.checkManualInputPersistence(
          periodIndex, entry.staffId, entry.dateKey, entry.value
        );
        results.persistenceResults.push({
          entry,
          persistence: persistenceCheck
        });
        
        if (persistenceCheck.issues.length > 0) {
          results.issues.push(...persistenceCheck.issues);
        }
      }
      
    } catch (error) {
      results.issues.push(`Bulk test execution error: ${error.message}`);
    }

    console.log('🧪 Bulk manual input test results:', results);
    return results;
  },

  /**
   * Test data persistence across page refresh
   */
  async testRefreshPersistence(periodIndex = 0) {
    console.log('🧪 Testing data persistence across refresh...');
    
    // Create emergency backup before test
    const backupKey = dataRecovery.createEmergencyBackup();
    
    const results = {
      preRefreshData: null,
      postRefreshData: null,
      dataMatches: false,
      issues: []
    };

    try {
      // Get current data
      results.preRefreshData = {
        schedule: optimizedStorage.getScheduleData(periodIndex),
        staff: optimizedStorage.getStaffData(periodIndex)
      };
      
      // Simulate page refresh by clearing memory cache but keeping localStorage
      // Note: In a real test, this would require actual page refresh
      console.log('📝 Pre-refresh data captured. Manual refresh required to complete test.');
      console.log('💡 To complete: Refresh page and run `manualInputTestSuite.verifyPostRefreshData(${periodIndex})`');
      
    } catch (error) {
      results.issues.push(`Refresh test error: ${error.message}`);
    }

    return { results, backupKey };
  },

  /**
   * Verify data after refresh (companion to testRefreshPersistence)
   */
  verifyPostRefreshData(periodIndex = 0, preRefreshData = null) {
    console.log('🧪 Verifying post-refresh data...');
    
    const results = {
      postRefreshData: null,
      dataMatches: false,
      issues: []
    };

    try {
      results.postRefreshData = {
        schedule: optimizedStorage.getScheduleData(periodIndex),
        staff: optimizedStorage.getStaffData(periodIndex)
      };
      
      if (preRefreshData) {
        // Compare data structures
        const scheduleMatches = JSON.stringify(results.postRefreshData.schedule) === 
                               JSON.stringify(preRefreshData.schedule);
        const staffMatches = JSON.stringify(results.postRefreshData.staff) === 
                            JSON.stringify(preRefreshData.staff);
        
        results.dataMatches = scheduleMatches && staffMatches;
        
        if (!scheduleMatches) {
          results.issues.push('Schedule data does not match after refresh');
        }
        if (!staffMatches) {
          results.issues.push('Staff data does not match after refresh');
        }
      }
      
    } catch (error) {
      results.issues.push(`Post-refresh verification error: ${error.message}`);
    }

    console.log('🧪 Post-refresh verification results:', results);
    return results;
  },

  /**
   * Test integration with export features
   */
  async testExportIntegration(schedule, staffMembers, dateRange) {
    console.log('🧪 Testing export integration...');
    
    const results = {
      csvExport: null,
      printFormat: null,
      issues: []
    };

    try {
      // Test CSV export
      if (window.exportToCSV) {
        try {
          const csvData = window.exportToCSV(schedule, staffMembers, dateRange);
          results.csvExport = { success: true, dataLength: csvData ? csvData.length : 0 };
        } catch (error) {
          results.csvExport = { success: false, error: error.message };
          results.issues.push(`CSV export failed: ${error.message}`);
        }
      } else {
        results.issues.push('CSV export function not available');
      }

      // Test print format
      if (window.printSchedule) {
        try {
          // Note: printSchedule typically opens a print dialog, so we just check if function exists
          results.printFormat = { success: true, available: true };
        } catch (error) {
          results.printFormat = { success: false, error: error.message };
          results.issues.push(`Print format failed: ${error.message}`);
        }
      } else {
        results.issues.push('Print function not available');
      }
      
    } catch (error) {
      results.issues.push(`Export integration test error: ${error.message}`);
    }

    console.log('🧪 Export integration test results:', results);
    return results;
  },

  /**
   * Test statistics calculation with manual input
   */
  testStatisticsIntegration(schedule, staffMembers, dateRange) {
    console.log('🧪 Testing statistics integration...');
    
    const results = {
      statisticsGenerated: false,
      statisticsData: null,
      issues: []
    };

    try {
      if (window.generateStatistics) {
        const statistics = window.generateStatistics(schedule, staffMembers, dateRange);
        results.statisticsGenerated = true;
        results.statisticsData = {
          totalStaff: statistics?.totalStaff || 0,
          totalShifts: Object.keys(statistics || {}).length
        };
      } else {
        results.issues.push('Statistics generation function not available');
      }
      
    } catch (error) {
      results.issues.push(`Statistics integration error: ${error.message}`);
    }

    console.log('🧪 Statistics integration test results:', results);
    return results;
  },

  /**
   * Run complete integration test suite
   */
  async runCompleteTestSuite(updateShift, schedule, staffMembers, periodIndex = 0) {
    console.log('🧪 Running complete manual input integration test suite...');
    
    const dateRange = generateDateRange(periodIndex);
    const results = {
      timestamp: new Date().toISOString(),
      periodIndex,
      tests: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalIssues: 0
      }
    };

    // Test 1: Basic manual input
    results.tests.basicInput = await this.testBasicManualInput(updateShift, periodIndex);
    results.summary.totalTests++;
    if (results.tests.basicInput.issues.length === 0) results.summary.passedTests++;
    else results.summary.failedTests++;

    // Test 2: Bulk manual input
    results.tests.bulkInput = await this.testBulkManualInput(updateShift, periodIndex);
    results.summary.totalTests++;
    if (results.tests.bulkInput.issues.length === 0) results.summary.passedTests++;
    else results.summary.failedTests++;

    // Test 3: Export integration
    results.tests.exportIntegration = await this.testExportIntegration(schedule, staffMembers, dateRange);
    results.summary.totalTests++;
    if (results.tests.exportIntegration.issues.length === 0) results.summary.passedTests++;
    else results.summary.failedTests++;

    // Test 4: Statistics integration
    results.tests.statisticsIntegration = this.testStatisticsIntegration(schedule, staffMembers, dateRange);
    results.summary.totalTests++;
    if (results.tests.statisticsIntegration.issues.length === 0) results.summary.passedTests++;
    else results.summary.failedTests++;

    // Calculate total issues
    Object.values(results.tests).forEach(test => {
      if (test.issues) results.summary.totalIssues += test.issues.length;
    });

    console.log('🧪 Complete test suite results:', results);
    
    // Create test report
    const report = this.generateTestReport(results);
    console.log('📊 Test Report:\n', report);
    
    return results;
  },

  /**
   * Generate human-readable test report
   */
  generateTestReport(results) {
    const { summary, tests } = results;
    const passRate = ((summary.passedTests / summary.totalTests) * 100).toFixed(1);
    
    let report = `
📋 Manual Input Integration Test Report
Generated: ${results.timestamp}
Period: ${results.periodIndex}

📊 Summary:
- Total Tests: ${summary.totalTests}
- Passed: ${summary.passedTests}
- Failed: ${summary.failedTests}
- Pass Rate: ${passRate}%
- Total Issues: ${summary.totalIssues}

📝 Test Details:`;

    Object.entries(tests).forEach(([testName, testResult]) => {
      const status = testResult.issues && testResult.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
      report += `\n\n${testName}: ${status}`;
      
      if (testResult.issues && testResult.issues.length > 0) {
        report += `\n  Issues (${testResult.issues.length}):`;
        testResult.issues.forEach(issue => {
          report += `\n    • ${issue}`;
        });
      }
    });

    return report;
  }
};

// Global debug utilities (development only)
if (process.env.NODE_ENV === 'development') {
  window.manualInputTestSuite = manualInputTestSuite;
}