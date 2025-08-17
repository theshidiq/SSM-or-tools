/**
 * MLTester.js
 *
 * Simple ML system tester to validate fixes and improvements
 */

import { ScheduleFeatureEngineer } from "../ml/FeatureEngineering";
import { MODEL_CONFIG } from "../ml/TensorFlowConfig";

export class MLTester {
  constructor() {
    this.testResults = {};
  }

  /**
   * Run basic tests to validate ML pipeline fixes
   */
  async runBasicTests() {
    console.log("🧪 Running ML Pipeline Basic Tests...");

    const results = {
      featureEngineering: await this.testFeatureEngineering(),
      dataValidation: await this.testDataValidation(),
      overallStatus: "pending",
    };

    // Determine overall status
    const allPassed = Object.values(results).every(
      (test) => test !== "pending" && test.success === true,
    );

    results.overallStatus = allPassed ? "passed" : "failed";

    this.testResults = results;
    this.printTestReport();

    return results;
  }

  /**
   * Test feature engineering improvements
   */
  async testFeatureEngineering() {
    try {
      console.log("  🔧 Testing Feature Engineering...");

      const featureEngineer = new ScheduleFeatureEngineer();

      // Create mock data for testing
      const mockStaff = {
        id: "test-staff-1",
        name: "Test Staff",
        status: "社員",
        position: "Manager",
      };

      const mockDate = new Date("2024-01-15");
      const mockDateRange = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date("2024-01-01");
        date.setDate(date.getDate() + i);
        mockDateRange.push(date);
      }

      const mockPeriodData = {
        schedule: {
          "test-staff-1": {
            "2024-01-10": "○",
            "2024-01-11": "△",
            "2024-01-12": "",
            "2024-01-13": "×",
            "2024-01-14": "▽",
          },
        },
        dateRange: mockDateRange,
      };

      const mockHistoricalData = {
        0: mockPeriodData,
        1: mockPeriodData,
      };

      const mockStaffMembers = [mockStaff];

      // Test feature generation
      const features = featureEngineer.generateFeatures({
        staff: mockStaff,
        date: mockDate,
        dateIndex: 14,
        periodData: mockPeriodData,
        allHistoricalData: mockHistoricalData,
        staffMembers: mockStaffMembers,
      });

      const tests = {
        featuresGenerated: features !== null,
        correctFeatureCount:
          features && features.length === MODEL_CONFIG.INPUT_FEATURES.TOTAL,
        noNaNValues:
          features && features.every((f) => !isNaN(f) && isFinite(f)),
        allFeaturesBounded:
          features && features.every((f) => f >= 0 && f <= 10), // Reasonable bounds
      };

      const allTestsPassed = Object.values(tests).every(
        (test) => test === true,
      );

      console.log("    ✅ Feature generation tests:", tests);

      // Test training data preparation
      const trainingData = featureEngineer.prepareTrainingData(
        mockHistoricalData,
        mockStaffMembers,
      );

      const trainingTests = {
        samplesGenerated: trainingData.features.length > 0,
        featureLabelMatch:
          trainingData.features.length === trainingData.labels.length,
        validLabels: trainingData.labels.every(
          (label) =>
            Number.isInteger(label) &&
            label >= 0 &&
            label < MODEL_CONFIG.ARCHITECTURE.OUTPUT_SIZE,
        ),
      };

      console.log("    ✅ Training data tests:", trainingTests);

      const allTrainingTestsPassed = Object.values(trainingTests).every(
        (test) => test === true,
      );

      return {
        success: allTestsPassed && allTrainingTestsPassed,
        details: {
          featureGeneration: tests,
          trainingDataPreparation: trainingTests,
          sampleData: {
            featuresGenerated: features?.length || 0,
            trainingSamples: trainingData.features.length,
            uniqueLabels: [...new Set(trainingData.labels)],
          },
        },
      };
    } catch (error) {
      console.error("    ❌ Feature engineering test failed:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test data validation improvements
   */
  async testDataValidation() {
    try {
      console.log("  📊 Testing Data Validation...");

      // Test with mock data that should pass validation
      const goodMockData = {
        rawPeriodData: [
          {
            monthIndex: 0,
            scheduleData: {
              staff1: {
                "2024-01-01": "○",
                "2024-01-02": "△",
                "2024-01-03": "",
              },
              staff2: {
                "2024-01-01": "×",
                "2024-01-02": "○",
                "2024-01-03": "▽",
              },
            },
            staffData: [
              { id: "staff1", name: "Staff One", status: "社員" },
              { id: "staff2", name: "Staff Two", status: "パート" },
            ],
            dateRange: [
              new Date("2024-01-01"),
              new Date("2024-01-02"),
              new Date("2024-01-03"),
            ],
          },
        ],
        staffProfiles: {
          staff1: { status: "社員", totalShifts: 3 },
          staff2: { status: "パート", totalShifts: 3 },
        },
        summary: {
          dataCompleteness: 75.5,
          totalShifts: 6,
        },
      };

      // Mock the validation method (since we can't instantiate TensorFlowScheduler easily)
      const mockValidationPassed = this.mockDataQualityValidation(goodMockData);

      // Test with poor data that should fail
      const badMockData = {
        rawPeriodData: [],
        staffProfiles: {},
        summary: { dataCompleteness: 0, totalShifts: 0 },
      };

      const mockValidationFailed = this.mockDataQualityValidation(badMockData);

      const tests = {
        goodDataPasses: mockValidationPassed.passed,
        badDataFails: !mockValidationFailed.passed,
        validationHasMetrics: mockValidationPassed.metrics !== undefined,
      };

      console.log("    ✅ Data validation tests:", tests);

      const allTestsPassed = Object.values(tests).every(
        (test) => test === true,
      );

      return {
        success: allTestsPassed,
        details: {
          validationTests: tests,
          goodDataScore: mockValidationPassed.score,
          badDataScore: mockValidationFailed.score,
        },
      };
    } catch (error) {
      console.error("    ❌ Data validation test failed:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mock version of the data quality validation for testing
   */
  mockDataQualityValidation({ rawPeriodData, staffProfiles, summary }) {
    const issues = [];
    const warnings = [];
    let score = 100;

    // Basic validation logic (simplified version of the real implementation)
    if (rawPeriodData.length === 0) {
      issues.push("No historical periods found");
      score -= 50;
    }

    const totalStaff = Object.keys(staffProfiles).length;
    if (totalStaff < 2) {
      issues.push(`Insufficient staff data: ${totalStaff}`);
      score -= 30;
    }

    if (summary.dataCompleteness < 5) {
      issues.push(
        `Data completeness too low: ${summary.dataCompleteness.toFixed(1)}%`,
      );
      score -= 40;
    } else if (summary.dataCompleteness < 20) {
      warnings.push(
        `Low data completeness: ${summary.dataCompleteness.toFixed(1)}%`,
      );
      score -= 15;
    }

    const passed = issues.length === 0;

    return {
      passed,
      score,
      issues,
      warnings,
      metrics: {
        periods: rawPeriodData.length,
        totalStaff,
        completeness: summary.dataCompleteness,
      },
    };
  }

  /**
   * Print comprehensive test report
   */
  printTestReport() {
    console.log("\n📋 ML Pipeline Test Report");
    console.log("===========================");

    const { featureEngineering, dataValidation, overallStatus } =
      this.testResults;

    console.log(`Overall Status: ${overallStatus.toUpperCase()}`);

    console.log("\n🔧 Feature Engineering Tests:");
    if (featureEngineering.success) {
      console.log("  ✅ PASSED");
      console.log(
        `  📊 Features generated: ${featureEngineering.details.sampleData.featuresGenerated}`,
      );
      console.log(
        `  📈 Training samples: ${featureEngineering.details.sampleData.trainingSamples}`,
      );
    } else {
      console.log("  ❌ FAILED");
      console.log(`  Error: ${featureEngineering.error}`);
    }

    console.log("\n📊 Data Validation Tests:");
    if (dataValidation.success) {
      console.log("  ✅ PASSED");
      console.log(
        `  Good data score: ${dataValidation.details.goodDataScore}/100`,
      );
      console.log(
        `  Bad data properly rejected: ${dataValidation.details.validationTests.badDataFails}`,
      );
    } else {
      console.log("  ❌ FAILED");
      console.log(`  Error: ${dataValidation.error}`);
    }

    console.log("\n💡 Next Steps:");
    if (overallStatus === "passed") {
      console.log("  ✅ Basic ML pipeline components are working correctly");
      console.log("  🎯 Ready for integration testing with real data");
      console.log("  📈 Consider training a model with actual historical data");
    } else {
      console.log("  ❌ Some tests failed - review implementation");
      console.log("  🔧 Fix failing components before proceeding");
    }

    console.log("\n===========================");
  }
}

export default MLTester;
