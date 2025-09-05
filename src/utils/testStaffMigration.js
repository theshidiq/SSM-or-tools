/**
 * Test Staff Migration - Validates all migration fixes
 * Tests UUID generation, database operations, and RLS policies
 */

import { supabase } from './supabase';
import { transformStaffDataForDatabase, migrateStaffToDatabase } from './staffMigrationUtils';

/**
 * Generate test localStorage-format staff data
 */
const generateTestStaffData = () => {
  return [
    {
      name: '料理長',
      position: 'Head Chef',
      department: '調理',
      status: '社員',
      color: 'position-chef',
      staff_order: 0,
      startPeriod: { year: 2021, month: 1, day: 1 },
      endPeriod: null
    },
    {
      name: '井関',
      position: 'Sous Chef', 
      department: '調理',
      status: '社員',
      color: 'position-chef',
      staff_order: 1,
      startPeriod: { year: 2021, month: 1, day: 1 },
      endPeriod: null
    },
    {
      name: 'テスト社員',
      position: 'Test Employee',
      department: 'テスト部',
      status: '派遣',
      color: 'position-staff',
      staff_order: 2,
      // Test case with no ID - should generate new ULID
      startPeriod: { year: 2024, month: 1, day: 1 },
      endPeriod: null
    },
    {
      id: 'invalid-id-format', // Invalid ID that should be replaced
      name: 'Invalid ID Test',
      position: 'Test Position',
      status: 'パート',
      staff_order: 3
    }
  ];
};

/**
 * Test UUID generation and validation
 */
export const testUUIDGeneration = () => {
  console.log('🧪 Testing UUID generation...');
  
  const testData = generateTestStaffData();
  const transformedData = transformStaffDataForDatabase(testData);
  
  const results = {
    total: transformedData.length,
    validUUIDs: 0,
    validFormats: 0,
    errors: []
  };
  
  transformedData.forEach((staff, index) => {
    if (!staff) {
      results.errors.push(`Staff ${index}: Transformation returned null`);
      return;
    }
    
    // Check ID exists
    if (!staff.id) {
      results.errors.push(`Staff ${index} (${staff.name}): Missing ID`);
      return;
    }
    
    // Validate UUID format (should be standard UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(staff.id)) {
      results.validUUIDs++;
      
      // Check if it's ULID format (starts with 01)
      if (staff.id.startsWith('01')) {
        results.validFormats++;
      }
    } else {
      results.errors.push(`Staff ${index} (${staff.name}): Invalid UUID format: ${staff.id}`);
    }
    
    console.log(`  ✅ ${staff.name}: ${staff.id}`);
  });
  
  console.log(`📊 UUID Test Results:`, results);
  return results;
};

/**
 * Test database connection and operations
 */
export const testDatabaseOperations = async () => {
  console.log('🧪 Testing database operations...');
  
  try {
    // Test 1: Simple select to check connection
    const { data: existingStaff, error: selectError } = await supabase
      .from('app_staff')
      .select('id, name')
      .limit(1);
    
    if (selectError) {
      console.error('❌ Database connection failed:', selectError);
      return { success: false, error: selectError };
    }
    
    console.log('✅ Database connection working');
    
    // Test 2: Insert test record with proper ULID
    const testStaff = {
      id: '01934d2c-8a7b-7fff-8fff-testmigration',
      name: 'Migration Test Staff',
      position: 'Test Position',
      department: 'Test Department',
      type: 'regular',
      status: '社員',
      color: 'position-server',
      staff_order: 999,
      start_period: { year: 2024, month: 1, day: 1 },
      end_period: null,
      metadata: { test: true, created_at: new Date().toISOString() }
    };
    
    const { error: insertError } = await supabase
      .from('app_staff')
      .insert([testStaff]);
    
    if (insertError) {
      console.error('❌ Insert operation failed:', insertError);
      return { success: false, error: insertError };
    }
    
    console.log('✅ Insert operation successful');
    
    // Test 3: Verify the record was inserted
    const { data: insertedStaff, error: verifyError } = await supabase
      .from('app_staff')
      .select('*')
      .eq('id', testStaff.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return { success: false, error: verifyError };
    }
    
    console.log('✅ Record verification successful:', insertedStaff.name);
    
    // Test 4: Clean up test record
    const { error: deleteError } = await supabase
      .from('app_staff')
      .delete()
      .eq('id', testStaff.id);
    
    if (deleteError) {
      console.warn('⚠️ Cleanup failed (non-critical):', deleteError);
    } else {
      console.log('✅ Cleanup successful');
    }
    
    return { success: true, message: 'All database operations working correctly' };
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return { success: false, error };
  }
};

/**
 * Test complete migration workflow
 */
export const testMigrationWorkflow = async () => {
  console.log('🧪 Testing complete migration workflow...');
  
  try {
    // Generate test data
    const testData = generateTestStaffData();
    console.log(`📝 Generated ${testData.length} test staff members`);
    
    // Transform data
    const transformedData = transformStaffDataForDatabase(testData);
    console.log(`🔄 Transformed data: ${transformedData.length} valid entries`);
    
    // Validate UUIDs
    const uuidResults = testUUIDGeneration();
    if (uuidResults.errors.length > 0) {
      console.error('❌ UUID validation failed:', uuidResults.errors);
      return { success: false, errors: uuidResults.errors };
    }
    
    // Test dry run migration
    const dryRunResult = await migrateStaffToDatabase(transformedData, { dryRun: true });
    console.log('🧪 Dry run result:', dryRunResult);
    
    if (!dryRunResult.success) {
      console.error('❌ Dry run failed:', dryRunResult.message);
      return { success: false, error: dryRunResult };
    }
    
    // Test actual migration with test prefix
    const testDataWithPrefix = transformedData.map(staff => ({
      ...staff,
      name: `TEST_${staff.name}`,
      metadata: { ...staff.metadata, test: true }
    }));
    
    const migrationResult = await migrateStaffToDatabase(testDataWithPrefix, { 
      dryRun: false,
      skipDuplicates: true 
    });
    
    console.log('📊 Migration result:', migrationResult);
    
    if (migrationResult.success) {
      // Clean up test records
      const { error: cleanupError } = await supabase
        .from('app_staff')
        .delete()
        .like('name', 'TEST_%');
      
      if (cleanupError) {
        console.warn('⚠️ Test cleanup failed:', cleanupError);
      } else {
        console.log('✅ Test records cleaned up');
      }
    }
    
    return {
      success: migrationResult.success,
      message: migrationResult.message,
      migrated: migrationResult.migrated,
      errors: migrationResult.errors
    };
    
  } catch (error) {
    console.error('❌ Migration workflow test failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Run all migration tests
 */
export const runAllMigrationTests = async () => {
  console.log('🚀 Starting comprehensive migration tests...\n');
  
  const results = {
    uuid: null,
    database: null,
    workflow: null,
    overall: false
  };
  
  try {
    // Test 1: UUID Generation
    console.log('=' .repeat(50));
    results.uuid = testUUIDGeneration();
    
    // Test 2: Database Operations  
    console.log('\n' + '='.repeat(50));
    results.database = await testDatabaseOperations();
    
    // Test 3: Complete Workflow
    console.log('\n' + '='.repeat(50));
    results.workflow = await testMigrationWorkflow();
    
    // Overall result
    results.overall = results.uuid.errors.length === 0 && 
                     results.database.success && 
                     results.workflow.success;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`UUID Generation: ${results.uuid.errors.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Database Operations: ${results.database.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Migration Workflow: ${results.workflow.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Overall: ${results.overall ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!results.overall) {
      console.log('\n❌ ERRORS FOUND:');
      if (results.uuid.errors.length > 0) {
        console.log('UUID Errors:', results.uuid.errors);
      }
      if (!results.database.success) {
        console.log('Database Error:', results.database.error);
      }
      if (!results.workflow.success) {
        console.log('Workflow Error:', results.workflow.error || results.workflow.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.overall = false;
  }
  
  return results;
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testStaffMigration = {
    runAllTests: runAllMigrationTests,
    testUUID: testUUIDGeneration,
    testDatabase: testDatabaseOperations,
    testWorkflow: testMigrationWorkflow
  };
  
  console.log('🧪 Staff Migration Tests loaded! Use window.testStaffMigration.runAllTests() to run all tests.');
}