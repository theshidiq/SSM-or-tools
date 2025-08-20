/**
 * Browser Console Test Commands for Supabase Fix Verification
 * 
 * After applying the RLS policy fix, use these commands in your browser console
 * to verify that the authentication and database sync issues are resolved.
 * 
 * Usage: 
 * 1. Open your app in browser
 * 2. Open Developer Tools console (F12)
 * 3. Copy and paste these commands one by one
 * 4. Check for success messages
 */

console.log('🧪 Supabase Fix Verification Tests');
console.log('================================');

// Test 1: Basic Connection Test
console.log('\n🔍 Test 1: Basic Connection Test');
async function testConnection() {
  try {
    const response = await fetch('https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/', {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE'
      }
    });
    
    if (response.ok) {
      console.log('✅ Basic connection successful');
      return true;
    } else {
      console.error('❌ Connection failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection error:', error);
    return false;
  }
}

// Test 2: Restaurant Table Access (Main Issue)
console.log('\n🔍 Test 2: Restaurant Table Access');
async function testRestaurantAccess() {
  try {
    // Test SELECT
    const selectResponse = await fetch('https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/restaurants?select=*', {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE'
      }
    });
    
    if (selectResponse.ok) {
      console.log('✅ Restaurant SELECT successful');
      const data = await selectResponse.json();
      console.log('Existing restaurants:', data);
    } else {
      console.error('❌ Restaurant SELECT failed:', selectResponse.status, selectResponse.statusText);
      const errorData = await selectResponse.text();
      console.error('Error details:', errorData);
      return false;
    }
    
    // Test INSERT (the critical failing operation)
    const testRestaurant = {
      name: 'Test Restaurant - Fix Verification',
      timezone: 'Asia/Tokyo',
      created_at: new Date().toISOString()
    };
    
    const insertResponse = await fetch('https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/restaurants', {
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testRestaurant)
    });
    
    if (insertResponse.ok) {
      console.log('✅ Restaurant INSERT successful - RLS policy fix worked!');
      const insertedData = await insertResponse.json();
      console.log('Inserted restaurant:', insertedData);
      
      // Clean up test record
      if (insertedData && insertedData[0]) {
        const deleteResponse = await fetch(`https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/restaurants?id=eq.${insertedData[0].id}`, {
          method: 'DELETE',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE'
          }
        });
        
        if (deleteResponse.ok) {
          console.log('🗑️ Test restaurant cleaned up successfully');
        }
      }
      
      return true;
    } else {
      console.error('❌ Restaurant INSERT failed:', insertResponse.status, insertResponse.statusText);
      const errorData = await insertResponse.text();
      console.error('Error details:', errorData);
      
      if (errorData.includes('row-level security')) {
        console.error('💡 RLS policy still blocking - check if SQL script was applied correctly');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Restaurant access error:', error);
    return false;
  }
}

// Test 3: ConfigurationService Integration Test
console.log('\n🔍 Test 3: ConfigurationService Integration');
async function testConfigService() {
  try {
    // Check if ConfigurationService is available
    if (typeof configService === 'undefined') {
      console.error('❌ ConfigurationService not found. Make sure app is loaded.');
      return false;
    }
    
    console.log('📋 Current sync status:', configService.getSyncStatus());
    
    // Force re-initialization of Supabase connection
    console.log('🔄 Re-initializing Supabase connection...');
    await configService.checkSupabaseConnection();
    
    // Test saving settings (should trigger autosave)
    console.log('💾 Testing settings save with autosave...');
    const testSettings = {
      testTimestamp: new Date().toISOString(),
      testValue: 'RLS fix verification'
    };
    
    const saveResult = await configService.saveSettings(testSettings);
    
    if (saveResult) {
      console.log('✅ Settings save successful');
      console.log('📊 Updated sync status:', configService.getSyncStatus());
      return true;
    } else {
      console.error('❌ Settings save failed');
      return false;
    }
  } catch (error) {
    console.error('❌ ConfigService test error:', error);
    return false;
  }
}

// Test 4: Full End-to-End Test
console.log('\n🔍 Test 4: Full End-to-End Test');
async function runFullTest() {
  console.log('🚀 Running full end-to-end verification...');
  
  const results = {
    connection: await testConnection(),
    restaurantAccess: await testRestaurantAccess(),
    configService: await testConfigService()
  };
  
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');
  console.log('Basic Connection:', results.connection ? '✅ PASS' : '❌ FAIL');
  console.log('Restaurant Access:', results.restaurantAccess ? '✅ PASS' : '❌ FAIL');
  console.log('Config Service:', results.configService ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = results.connection && results.restaurantAccess && results.configService;
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! The fix is working correctly.');
    console.log('✅ You should now see "Settings auto-synced to database" messages');
    console.log('✅ No more 401 errors or RLS policy violations');
  } else {
    console.log('\n❌ Some tests failed. Check the issues above.');
    
    if (!results.connection) {
      console.log('🔧 Connection issue: Check API key and Supabase URL');
    }
    if (!results.restaurantAccess) {
      console.log('🔧 RLS issue: Make sure the SQL script was applied correctly');
    }
    if (!results.configService) {
      console.log('🔧 App integration issue: Try refreshing the page and running again');
    }
  }
  
  return allPassed;
}

// Quick Test Commands (copy these individually)
console.log('\n📋 QUICK TEST COMMANDS:');
console.log('======================');
console.log('Run individual tests:');
console.log('testConnection()');
console.log('testRestaurantAccess()');
console.log('testConfigService()');
console.log('');
console.log('Run all tests:');
console.log('runFullTest()');
console.log('');
console.log('Check current status:');
console.log('configService.getSyncStatus()');

// Make functions available globally
window.testConnection = testConnection;
window.testRestaurantAccess = testRestaurantAccess;
window.testConfigService = testConfigService;
window.runFullTest = runFullTest;