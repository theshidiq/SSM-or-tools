/**
 * RLS Policy Diagnostic Script
 * 
 * Run this in your browser console to diagnose the current RLS policy state
 * and verify if the fix needs to be applied.
 * 
 * Usage:
 * 1. Open browser developer tools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter to run
 */

(async function diagnoseRLSIssue() {
  console.log('🔍 Starting RLS Policy Diagnostic...\n');
  
  // Import the Supabase client (assumes it's available globally)
  let supabase;
  try {
    // Try to import from global scope or module
    if (typeof window !== 'undefined' && window.supabase) {
      supabase = window.supabase;
    } else {
      // Try to import from modules if available
      const { supabase: sb } = await import('./src/utils/supabase.js');
      supabase = sb;
    }
  } catch (error) {
    console.error('❌ Could not access Supabase client:', error);
    console.log('💡 Make sure you run this in the context of your application');
    return;
  }

  if (!supabase) {
    console.error('❌ Supabase client not available');
    console.log('💡 Make sure Supabase is properly initialized in your app');
    return;
  }

  const results = {
    connectionTest: null,
    restaurantAccess: null,
    tableExists: {},
    currentPolicies: null,
    recommendedAction: ''
  };

  console.log('1️⃣ Testing basic connection...');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && !error.message.includes('no active session')) {
      throw error;
    }
    results.connectionTest = '✅ Supabase connection OK';
    console.log('✅ Supabase connection working');
  } catch (error) {
    results.connectionTest = `❌ Connection failed: ${error.message}`;
    console.log('❌ Supabase connection failed:', error.message);
  }

  console.log('\n2️⃣ Testing table access...');
  const tables = ['restaurants', 'config_versions', 'staff_groups', 'daily_limits', 'monthly_limits'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        if (error.code === '42P01') {
          results.tableExists[table] = '❌ Table does not exist';
          console.log(`❌ ${table}: Table does not exist`);
        } else if (error.code === '42501') {
          results.tableExists[table] = '🔒 RLS policy blocks access';
          console.log(`🔒 ${table}: RLS policy violation (${error.code})`);
        } else {
          results.tableExists[table] = `⚠️ Error: ${error.message}`;
          console.log(`⚠️ ${table}: ${error.message}`);
        }
      } else {
        results.tableExists[table] = '✅ Accessible';
        console.log(`✅ ${table}: Accessible`);
      }
    } catch (error) {
      results.tableExists[table] = `❌ Exception: ${error.message}`;
      console.log(`❌ ${table}: Exception -`, error.message);
    }
  }

  console.log('\n3️⃣ Testing restaurant creation (the specific failing operation)...');
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .insert([{
        name: 'Test Restaurant',
        slug: 'test-' + Date.now(),
        timezone: 'Asia/Tokyo'
      }])
      .select();
      
    if (error) {
      if (error.code === '42501') {
        results.restaurantAccess = '🔒 RLS policy prevents INSERT operations';
        console.log('🔒 Restaurant creation blocked by RLS policy');
        console.log('Error details:', error);
      } else {
        results.restaurantAccess = `⚠️ Other error: ${error.message}`;
        console.log('⚠️ Restaurant creation failed with different error:', error);
      }
    } else {
      results.restaurantAccess = '✅ Restaurant creation works';
      console.log('✅ Restaurant creation successful');
      
      // Clean up test data
      if (data && data[0]) {
        await supabase.from('restaurants').delete().eq('id', data[0].id);
        console.log('🧹 Test data cleaned up');
      }
    }
  } catch (error) {
    results.restaurantAccess = `❌ Exception: ${error.message}`;
    console.log('❌ Restaurant creation exception:', error);
  }

  console.log('\n4️⃣ Analyzing results...');
  
  // Determine the issue and recommendation
  const hasRLSIssues = Object.values(results.tableExists).some(status => status.includes('RLS policy')) ||
                       results.restaurantAccess?.includes('RLS policy');
                       
  const hasMissingTables = Object.values(results.tableExists).some(status => status.includes('does not exist'));
  
  if (hasMissingTables) {
    results.recommendedAction = 'SETUP_REQUIRED';
    console.log('📋 DIAGNOSIS: Database setup required');
    console.log('💡 SOLUTION: Run the database setup SQL first, then apply RLS fix');
  } else if (hasRLSIssues) {
    results.recommendedAction = 'APPLY_RLS_FIX';
    console.log('🔒 DIAGNOSIS: RLS policy prevents anonymous access');  
    console.log('💡 SOLUTION: Apply the RLS fix SQL (SUPABASE_RLS_FIX.sql)');
  } else if (results.restaurantAccess?.includes('works')) {
    results.recommendedAction = 'NO_ACTION_NEEDED';
    console.log('✅ DIAGNOSIS: Everything working correctly');
    console.log('💡 No action needed - RLS policies are properly configured');
  } else {
    results.recommendedAction = 'UNKNOWN_ISSUE';
    console.log('❓ DIAGNOSIS: Unknown issue detected');
    console.log('💡 SOLUTION: Check network connection and Supabase configuration');
  }

  console.log('\n📋 SUMMARY:');
  console.log('='.repeat(50));
  console.log('Connection:', results.connectionTest);
  console.log('Restaurant Creation:', results.restaurantAccess);
  console.log('\nTable Access:');
  Object.entries(results.tableExists).forEach(([table, status]) => {
    console.log(`  ${table}: ${status}`);
  });
  console.log('\nRecommended Action:', results.recommendedAction);
  
  console.log('\n🎯 NEXT STEPS:');
  switch (results.recommendedAction) {
    case 'SETUP_REQUIRED':
      console.log('1. Run complete database setup SQL');
      console.log('2. Then apply RLS fix SQL');
      console.log('3. Test autosave functionality');
      break;
    case 'APPLY_RLS_FIX':
      console.log('1. Open Supabase SQL Editor');
      console.log('2. Run SUPABASE_RLS_FIX.sql');
      console.log('3. Refresh application and test');
      break;
    case 'NO_ACTION_NEEDED':
      console.log('1. Verify autosave is working in your app');
      console.log('2. Check for any remaining console errors');
      break;
    case 'UNKNOWN_ISSUE':
      console.log('1. Check Supabase project status');
      console.log('2. Verify environment variables');
      console.log('3. Check network connectivity');
      break;
  }
  
  console.log('\n✅ Diagnostic complete!');
  return results;
})();