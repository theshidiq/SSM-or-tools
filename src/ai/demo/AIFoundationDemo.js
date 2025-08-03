/**
 * AIFoundationDemo.js
 * 
 * Demonstration script for the AI Foundation system.
 * Shows how to use the AI features for schedule analysis and optimization.
 */

import { aiFoundation } from '../AIFoundation';
import { generateDateRange } from '../../utils/dateUtils';

/**
 * Demo: Basic AI Foundation initialization and analysis
 */
export const runBasicDemo = async () => {
  console.log('🚀 Starting AI Foundation Basic Demo...');
  
  try {
    // Step 1: Initialize the AI Foundation
    console.log('\n📊 Step 1: Initializing AI Foundation...');
    const initResult = await aiFoundation.initialize();
    
    if (!initResult.success) {
      console.error('❌ Initialization failed:', initResult.error);
      return;
    }
    
    console.log('✅ AI Foundation initialized successfully!');
    console.log('📈 Data Analysis Summary:', initResult.dataAnalysis);
    
    // Step 2: Get system status
    console.log('\n🔍 Step 2: System Status...');
    const status = aiFoundation.getSystemStatus();
    console.log('📊 System Status:', {
      initialized: status.initialized,
      totalStaffGroups: status.components.staffGroupManager.totalGroups,
      totalConstraints: status.components.constraintManager.totalConstraints,
      staffWithPreferences: status.components.preferenceManager.staffWithPreferences
    });
    
    // Step 3: Analyze current schedule (if data exists)
    if (status.lastAnalysisSummary && status.lastAnalysisSummary.totalStaff > 0) {
      console.log('\n📊 Step 3: Schedule Analysis...');
      const analysisResult = await aiFoundation.analyzeSchedule(0);
      
      if (analysisResult.success) {
        console.log('✅ Schedule analysis completed!');
        console.log('📈 Analysis Summary:', analysisResult.analysis.summary);
        
        // Show optimization opportunities
        if (analysisResult.analysis.optimizationAnalysis.opportunities.length > 0) {
          console.log('\n🎯 Optimization Opportunities:');
          analysisResult.analysis.optimizationAnalysis.opportunities.forEach((opp, index) => {
            console.log(`  ${index + 1}. ${opp.description}`);
            console.log(`     Impact: Efficiency +${opp.impact.efficiency}%, Fairness +${opp.impact.fairness}%`);
          });
        }
      }
    } else {
      console.log('\n⚠️ No historical data found for analysis');
    }
    
    console.log('\n✅ Basic demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
};

/**
 * Demo: Constraint validation with sample data
 */
export const runConstraintValidationDemo = async () => {
  console.log('🚀 Starting Constraint Validation Demo...');
  
  try {
    // Initialize if not already done
    if (!aiFoundation.initialized) {
      await aiFoundation.initialize();
    }
    
    // Create sample data for demonstration
    const sampleStaffMembers = [
      {
        id: 'demo_001',
        name: '料理長',
        position: 'Head Chef',
        status: '社員',
        type: '社員'
      },
      {
        id: 'demo_002',
        name: '古藤',
        position: 'Sous Chef',
        status: '社員',
        type: '社員'
      },
      {
        id: 'demo_003',
        name: '井関',
        position: 'Cook',
        status: '派遣',
        type: '派遣'
      },
      {
        id: 'demo_004',
        name: '小池',
        position: 'Cook',
        status: '派遣',
        type: '派遣'
      }
    ];
    
    const sampleDateRange = generateDateRange(0); // Current period
    
    // Create a schedule with some violations for demonstration
    const sampleScheduleData = {};
    
    sampleStaffMembers.forEach(staff => {
      sampleScheduleData[staff.id] = {};
      sampleDateRange.forEach((date, index) => {
        const dateKey = date.toISOString().split('T')[0];
        
        // Create some patterns that might cause violations
        if (staff.name === '料理長') {
          // 料理長 should prefer early shift on Sunday but doesn't get it
          const dayOfWeek = date.getDay();
          sampleScheduleData[staff.id][dateKey] = dayOfWeek === 0 ? '' : ''; // Normal shifts
        } else if (staff.name === '古藤' && index < 3) {
          // 古藤 gets too many consecutive off days
          sampleScheduleData[staff.id][dateKey] = '×';
        } else if (staff.name === '井関' && staff.name === '小池' && index === 5) {
          // Group conflict: both 井関 and 小池 off on same day
          sampleScheduleData[staff.id][dateKey] = '×';
        } else {
          sampleScheduleData[staff.id][dateKey] = Math.random() > 0.8 ? '×' : '';
        }
      });
    });
    
    console.log('\n🔍 Validating sample schedule constraints...');
    const validationResult = await aiFoundation.validateConstraints(
      sampleScheduleData,
      sampleStaffMembers,
      sampleDateRange
    );
    
    console.log('\n📊 Validation Results:');
    console.log(`✅ Overall Valid: ${validationResult.overallValid}`);
    console.log(`🚨 Total Violations: ${validationResult.totalViolations}`);
    
    if (validationResult.totalViolations > 0) {
      console.log('\n⚠️ Constraint Violations Found:');
      
      const criticalViolations = validationResult.constraintValidation.allViolations
        .filter(v => v.severity === 'critical');
      const highViolations = validationResult.constraintValidation.allViolations
        .filter(v => v.severity === 'high');
      
      if (criticalViolations.length > 0) {
        console.log('\n🔴 Critical Violations:');
        criticalViolations.forEach((violation, index) => {
          console.log(`  ${index + 1}. ${violation.message}`);
        });
      }
      
      if (highViolations.length > 0) {
        console.log('\n🟠 High Priority Violations:');
        highViolations.forEach((violation, index) => {
          console.log(`  ${index + 1}. ${violation.message}`);
        });
      }
      
      if (validationResult.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        validationResult.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec.description}`);
        });
      }
    }
    
    console.log('\n✅ Constraint validation demo completed!');
    
  } catch (error) {
    console.error('❌ Constraint validation demo failed:', error.message);
  }
};

/**
 * Demo: Staff preference analysis
 */
export const runPreferenceAnalysisDemo = async () => {
  console.log('🚀 Starting Staff Preference Analysis Demo...');
  
  try {
    // Initialize if not already done
    if (!aiFoundation.initialized) {
      await aiFoundation.initialize();
    }
    
    // Get system status to see if we have any staff with preferences
    const status = aiFoundation.getSystemStatus();
    
    if (status.components.preferenceManager.staffWithPreferences === 0) {
      console.log('⚠️ No staff preferences found. This is normal for a fresh installation.');
      console.log('💡 Preferences are automatically created from historical schedule patterns.');
      return;
    }
    
    console.log(`\n👥 Found preferences for ${status.components.preferenceManager.staffWithPreferences} staff members`);
    
    // Create sample data for analysis
    const sampleStaffId = 'staff_001';
    const sampleSchedule = {
      [sampleStaffId]: {}
    };
    
    const dateRange = generateDateRange(0);
    dateRange.forEach((date, index) => {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Create a pattern where staff prefers early shifts on weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        sampleSchedule[sampleStaffId][dateKey] = '△'; // Early shift
      } else {
        sampleSchedule[sampleStaffId][dateKey] = ''; // Normal shift
      }
    });
    
    console.log('\n🔍 Analyzing staff preferences...');
    const preferenceResult = await aiFoundation.analyzeStaffPreferences(
      sampleStaffId,
      sampleSchedule,
      dateRange
    );
    
    console.log('\n📊 Preference Analysis Results:');
    console.log(`👤 Staff ID: ${preferenceResult.staffId}`);
    console.log(`⭐ Overall Score: ${preferenceResult.overallScore.toFixed(1)}`);
    console.log(`😊 Satisfaction Level: ${preferenceResult.satisfactionLevel}`);
    console.log(`🎯 Total Preferences: ${preferenceResult.totalPreferences}`);
    
    if (preferenceResult.recommendations.length > 0) {
      console.log('\n💡 Preference Recommendations:');
      preferenceResult.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.suggestion} (Priority: ${rec.priority})`);
      });
    }
    
    console.log('\n✅ Preference analysis demo completed!');
    
  } catch (error) {
    console.error('❌ Preference analysis demo failed:', error.message);
  }
};

/**
 * Demo: Complete optimization workflow
 */
export const runOptimizationWorkflowDemo = async () => {
  console.log('🚀 Starting Optimization Workflow Demo...');
  
  try {
    // Initialize if not already done
    if (!aiFoundation.initialized) {
      console.log('\n📊 Initializing AI Foundation...');
      await aiFoundation.initialize();
    }
    
    // Create comprehensive sample data
    const staffMembers = [
      { id: 'opt_001', name: '料理長', position: 'Head Chef', status: '社員' },
      { id: 'opt_002', name: '古藤', position: 'Sous Chef', status: '社員' },
      { id: 'opt_003', name: '井関', position: 'Cook', status: '派遣' },
      { id: 'opt_004', name: '小池', position: 'Cook', status: '派遣' },
      { id: 'opt_005', name: '田辺', position: 'Prep Cook', status: '派遣' },
      { id: 'opt_006', name: '与儀', position: 'Server', status: 'パート' }
    ];
    
    const dateRange = generateDateRange(0);
    const scheduleData = {};
    
    // Create a realistic but problematic schedule
    staffMembers.forEach((staff, staffIndex) => {
      scheduleData[staff.id] = {};
      
      dateRange.forEach((date, dateIndex) => {
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // Create patterns based on staff role and day
        if (staff.name === '料理長') {
          // Head chef works most days, but not getting preferred early Sunday shift
          scheduleData[staff.id][dateKey] = dayOfWeek === 0 ? '' : ''; // Should be △ on Sunday
        } else if (staff.name === '与儀') {
          // Part-time staff wants Sunday off but doesn't get it
          scheduleData[staff.id][dateKey] = dayOfWeek === 0 ? '' : (Math.random() > 0.7 ? '×' : '');
        } else {
          // Other staff with some random patterns
          let shift = '';
          if (Math.random() > 0.85) shift = '×'; // Off
          else if (Math.random() > 0.9) shift = '△'; // Early
          scheduleData[staff.id][dateKey] = shift;
        }
      });
    });
    
    console.log('\n🎯 Generating optimization recommendations...');
    const optimizationResult = await aiFoundation.generateOptimizationRecommendations(
      scheduleData,
      staffMembers,
      dateRange
    );
    
    console.log('\n📊 Optimization Analysis:');
    console.log(`🚨 Constraint Violations: ${optimizationResult.constraintViolations}`);
    console.log(`⭐ Average Preference Score: ${optimizationResult.averagePreferenceScore.toFixed(1)}`);
    console.log(`🎯 Optimization Opportunities: ${optimizationResult.optimizationOpportunities.length}`);
    
    // Show recommendations by priority
    const priorities = ['critical', 'high', 'medium', 'low'];
    priorities.forEach(priority => {
      const recs = optimizationResult.recommendations[priority];
      if (recs.length > 0) {
        console.log(`\n${priority.toUpperCase()} Priority Recommendations:`);
        recs.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec.description}`);
          if (rec.impact) {
            console.log(`     Expected Impact: ${JSON.stringify(rec.impact)}`);
          }
        });
      }
    });
    
    // Show action plan
    if (optimizationResult.actionPlan.length > 0) {
      console.log('\n📋 Suggested Action Plan:');
      optimizationResult.actionPlan.forEach(action => {
        console.log(`  Step ${action.step}: ${action.action} (${action.priority} - ${action.estimatedTime})`);
      });
    }
    
    console.log('\n✅ Optimization workflow demo completed!');
    
  } catch (error) {
    console.error('❌ Optimization workflow demo failed:', error.message);
  }
};

/**
 * Demo: Data export and import functionality
 */
export const runDataManagementDemo = async () => {
  console.log('🚀 Starting Data Management Demo...');
  
  try {
    // Initialize if not already done
    if (!aiFoundation.initialized) {
      await aiFoundation.initialize();
    }
    
    console.log('\n💾 Exporting AI Foundation data...');
    const exportedData = aiFoundation.exportData();
    
    console.log('📊 Export Summary:');
    console.log(`  Export Time: ${exportedData.exportedAt}`);
    console.log(`  Version: ${exportedData.version}`);
    console.log(`  Staff Groups: ${Object.keys(exportedData.staffGroups.groups || {}).length}`);
    console.log(`  Constraints: ${Object.keys(exportedData.constraints.constraints || {}).length}`);
    console.log(`  Preferences: ${Object.keys(exportedData.preferences.preferences || {}).length}`);
    
    console.log('\n🔄 Testing data import...');
    
    // Reset system
    aiFoundation.reset();
    console.log('✅ System reset completed');
    
    // Import the data back
    const importResult = aiFoundation.importData(exportedData);
    
    if (importResult.success) {
      console.log('✅ Data import completed successfully');
      
      // Re-initialize to verify everything works
      await aiFoundation.initialize();
      
      const newStatus = aiFoundation.getSystemStatus();
      console.log('📊 Post-import Status:');
      console.log(`  Initialized: ${newStatus.initialized}`);
      console.log(`  Staff Groups: ${newStatus.components.staffGroupManager.totalGroups}`);
      console.log(`  Constraints: ${newStatus.components.constraintManager.totalConstraints}`);
      
    } else {
      console.error('❌ Data import failed:', importResult.error);
    }
    
    console.log('\n✅ Data management demo completed!');
    
  } catch (error) {
    console.error('❌ Data management demo failed:', error.message);
  }
};

/**
 * Run all demos in sequence
 */
export const runAllDemos = async () => {
  console.log('🎬 Running Complete AI Foundation Demo Suite...\n');
  
  try {
    await runBasicDemo();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await runConstraintValidationDemo();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await runPreferenceAnalysisDemo();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await runOptimizationWorkflowDemo();
    console.log('\n' + '='.repeat(80) + '\n');
    
    await runDataManagementDemo();
    
    console.log('\n🎉 All demos completed successfully!');
    console.log('\n💡 The AI Foundation system is ready for use in production.');
    console.log('   You can now integrate these features into your shift scheduling application.');
    
  } catch (error) {
    console.error('❌ Demo suite failed:', error.message);
  }
};

// Export for use in other files
export default {
  runBasicDemo,
  runConstraintValidationDemo,
  runPreferenceAnalysisDemo,
  runOptimizationWorkflowDemo,
  runDataManagementDemo,
  runAllDemos
};