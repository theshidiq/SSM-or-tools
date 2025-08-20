/**
 * Supabase Connection and RLS Policy Diagnostic Script
 * 
 * This script helps diagnose the authentication and RLS policy issues
 * preventing the autosave functionality from working.
 * 
 * Usage: Run this in browser console or Node.js to test Supabase connection
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - replace with your actual values
const SUPABASE_URL = 'https://ymdyejrljmvajqjbejvh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Test 1: Basic Connection Test
 */
async function testBasicConnection() {
  console.log('\n🔍 Test 1: Basic Connection Test');
  console.log('='.repeat(50));
  
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error);
      console.log('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return false;
    }
    
    console.log('✅ Basic connection successful');
    console.log('Data returned:', data);
    return true;
  } catch (error) {
    console.error('❌ Connection exception:', error);
    return false;
  }
}

/**
 * Test 2: Authentication Status
 */
async function testAuthStatus() {
  console.log('\n🔍 Test 2: Authentication Status');
  console.log('='.repeat(50));
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Auth error:', error);
      return false;
    }
    
    console.log('User data:', user);
    
    if (!user) {
      console.log('ℹ️ No authenticated user (using anonymous access)');
      
      // Check if anonymous access is working
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Session data:', sessionData);
      
      return true;
    } else {
      console.log('✅ User authenticated:', user.email);
      return true;
    }
  } catch (error) {
    console.error('❌ Auth exception:', error);
    return false;
  }
}

/**
 * Test 3: Table Access Test
 */
async function testTableAccess() {
  console.log('\n🔍 Test 3: Table Access Test');
  console.log('='.repeat(50));
  
  const tables = [
    'restaurants',
    'config_versions', 
    'staff_groups',
    'daily_limits',
    'monthly_limits',
    'priority_rules',
    'ml_model_configs'
  ];
  
  const results = {};
  
  for (const table of tables) {
    console.log(`\nTesting table: ${table}`);
    try {
      // Test SELECT
      const { data: selectData, error: selectError } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (selectError) {
        console.log(`❌ SELECT failed on ${table}:`, selectError.message);
        results[table] = { select: false, selectError: selectError.message };
      } else {
        console.log(`✅ SELECT works on ${table}`);
        results[table] = { select: true };
      }
      
      // Test INSERT (we'll use a test record)
      let testData = {};
      
      switch (table) {
        case 'restaurants':
          testData = {
            name: 'Test Restaurant',
            timezone: 'Asia/Tokyo'
          };
          break;
        case 'config_versions':
          // Skip INSERT test for config_versions as it needs restaurant_id
          console.log(`⚠️ Skipping INSERT test for ${table} (needs restaurant_id)`);
          continue;
        default:
          // Skip INSERT test for other tables as they need version_id
          console.log(`⚠️ Skipping INSERT test for ${table} (needs version_id)`);
          continue;
      }
      
      if (Object.keys(testData).length > 0) {
        const { data: insertData, error: insertError } = await supabase
          .from(table)
          .insert([testData])
          .select();
        
        if (insertError) {
          console.log(`❌ INSERT failed on ${table}:`, insertError.message);
          results[table].insert = false;
          results[table].insertError = insertError.message;
        } else {
          console.log(`✅ INSERT works on ${table}`);
          results[table].insert = true;
          
          // Clean up test record
          if (insertData && insertData[0]) {
            await supabase
              .from(table)
              .delete()
              .eq('id', insertData[0].id);
            console.log(`🗑️ Cleaned up test record from ${table}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Exception testing ${table}:`, error);
      results[table] = { error: error.message };
    }
  }
  
  return results;
}

/**
 * Test 4: RLS Policy Check (via direct query attempts)
 */
async function testRLSPolicies() {
  console.log('\n🔍 Test 4: RLS Policy Check');
  console.log('='.repeat(50));
  
  // Test the specific operations that are failing
  console.log('Testing restaurant creation (main failure point)...');
  
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .insert([{
        name: 'RLS Test Restaurant',
        timezone: 'Asia/Tokyo',
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('❌ Restaurant creation failed (RLS issue):', error);
      
      // Check specific error types
      if (error.message.includes('row-level security')) {
        console.log('🔍 This is definitely an RLS policy issue');
        console.log('💡 The restaurants table needs an RLS policy for anonymous users');
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        console.log('🔍 This is an authentication issue');
        console.log('💡 The API key might be invalid or anonymous access might be disabled');
      }
      
      return false;
    } else {
      console.log('✅ Restaurant creation successful');
      
      // Clean up
      if (data && data[0]) {
        await supabase.from('restaurants').delete().eq('id', data[0].id);
        console.log('🗑️ Cleaned up test restaurant');
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Restaurant creation exception:', error);
    return false;
  }
}

/**
 * Test 5: API Key Validation
 */
async function testAPIKeyValidation() {
  console.log('\n🔍 Test 5: API Key Validation');
  console.log('='.repeat(50));
  
  // Parse the JWT to check if it's valid
  try {
    const parts = SUPABASE_ANON_KEY.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format');
      return false;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    console.log('JWT Payload:', payload);
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('❌ JWT has expired');
      console.log(`Expired at: ${new Date(payload.exp * 1000)}`);
      console.log(`Current time: ${new Date()}`);
      return false;
    } else {
      console.log('✅ JWT is not expired');
      console.log(`Expires at: ${new Date(payload.exp * 1000)}`);
    }
    
    // Check role
    if (payload.role !== 'anon') {
      console.warn('⚠️ JWT role is not "anon":', payload.role);
    } else {
      console.log('✅ JWT role is correct: anon');
    }
    
    // Check project reference
    console.log('Project reference:', payload.ref);
    
    return true;
  } catch (error) {
    console.error('❌ JWT validation failed:', error);
    return false;
  }
}

/**
 * Main Diagnostic Function
 */
async function runDiagnostics() {
  console.log('🚀 Starting Supabase Diagnostic Tests');
  console.log('=' .repeat(80));
  
  const results = {
    basicConnection: await testBasicConnection(),
    authStatus: await testAuthStatus(),
    tableAccess: await testTableAccess(),
    rlsPolicies: await testRLSPolicies(),
    apiKeyValidation: await testAPIKeyValidation()
  };
  
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  console.log('Basic Connection:', results.basicConnection ? '✅ PASS' : '❌ FAIL');
  console.log('Auth Status:', results.authStatus ? '✅ PASS' : '❌ FAIL');
  console.log('RLS Policies:', results.rlsPolicies ? '✅ PASS' : '❌ FAIL');
  console.log('API Key Validation:', results.apiKeyValidation ? '✅ PASS' : '❌ FAIL');
  
  console.log('\n🎯 RECOMMENDED ACTIONS:');
  
  if (!results.basicConnection) {
    console.log('1. ❌ Basic connection failed - check Supabase URL and API key');
    console.log('   - Verify SUPABASE_URL is correct');
    console.log('   - Verify SUPABASE_ANON_KEY is valid');
  }
  
  if (!results.apiKeyValidation) {
    console.log('2. ❌ API key is invalid or expired - generate new key');
    console.log('   - Go to Supabase Dashboard > Settings > API');
    console.log('   - Copy the anon/public key');
  }
  
  if (!results.rlsPolicies) {
    console.log('3. ❌ RLS policies are missing or incorrect');
    console.log('   - Run the RLS policy fix SQL script');
    console.log('   - Ensure anonymous users have INSERT and SELECT permissions');
  }
  
  if (results.basicConnection && results.apiKeyValidation && !results.rlsPolicies) {
    console.log('4. 🎯 Main issue appears to be RLS policies');
    console.log('   - Focus on fixing table-level RLS policies');
    console.log('   - Ensure restaurants table has proper anonymous access');
  }
  
  return results;
}

// Export for use in browser console or Node.js
if (typeof window !== 'undefined') {
  // Browser environment
  window.supabaseDiagnostic = {
    runDiagnostics,
    testBasicConnection,
    testAuthStatus,
    testTableAccess,
    testRLSPolicies,
    testAPIKeyValidation
  };
  
  console.log('🔧 Supabase diagnostic tools loaded');
  console.log('Run: supabaseDiagnostic.runDiagnostics()');
} else {
  // Node.js environment
  export {
    runDiagnostics,
    testBasicConnection,
    testAuthStatus,
    testTableAccess,
    testRLSPolicies,
    testAPIKeyValidation
  };
}