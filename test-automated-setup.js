/**
 * test-automated-setup.js
 * 
 * Test script to demonstrate the new automated database setup functionality.
 * Run this to test the automated setup without the UI.
 */

import AutomatedDatabaseSetupService from './src/services/AutomatedDatabaseSetupService.js';
import SupabaseCapabilities from './src/utils/supabaseCapabilities.js';

async function testAutomatedSetup() {
  console.log('🧪 Testing Automated Database Setup');
  console.log('=====================================\n');

  // 1. Check Supabase capabilities
  console.log('1. Checking Supabase capabilities...');
  try {
    const capabilities = await SupabaseCapabilities.checkAllCapabilities();
    console.log('   RPC Support:', capabilities.rpcSupport.supported ? '✅' : '❌', capabilities.rpcSupport.reason);
    console.log('   Table Access:', capabilities.tableAccess.supported ? '✅' : '❌', capabilities.tableAccess.reason);
    console.log('   Automated Setup:', capabilities.automatedSetupSupported ? '✅ Supported' : '❌ Not Supported');
    console.log('   Recommended Mode:', capabilities.recommendedMode);
    console.log('');

    if (!capabilities.automatedSetupSupported) {
      console.log('⚠️ Automated setup not supported. Reasons:');
      if (!capabilities.rpcSupport.supported) {
        console.log('   - RPC:', capabilities.rpcSupport.reason);
        if (capabilities.rpcSupport.recommendation) {
          console.log('     Recommendation:', capabilities.rpcSupport.recommendation);
        }
      }
      if (!capabilities.tableAccess.supported) {
        console.log('   - Table Access:', capabilities.tableAccess.reason);
        if (capabilities.tableAccess.recommendation) {
          console.log('     Recommendation:', capabilities.tableAccess.recommendation);
        }
      }
      console.log('   Please use manual setup instead.\n');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to check capabilities:', error.message);
    return;
  }

  // 2. Create and test automated setup service
  console.log('2. Creating AutomatedDatabaseSetupService...');
  const setupService = new AutomatedDatabaseSetupService();
  
  // Progress callback
  const onProgress = (progressInfo) => {
    const progress = Math.round(progressInfo.percentage);
    const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
    console.log(`   Progress: [${bar}] ${progress}% - ${progressInfo.message}`);
  };

  // Error callback
  const onError = (error, chunk) => {
    console.log(`   ⚠️ Error in ${chunk.name}: ${error.message}`);
  };

  // Chunk completion callback
  const onChunkComplete = (chunk, completed, total) => {
    console.log(`   ✅ Completed chunk ${completed}/${total}: ${chunk.name}`);
  };

  // Final completion callback
  const onComplete = (result) => {
    console.log('\n3. Setup Results:');
    console.log('   Success:', result.success ? '✅ Yes' : '❌ No');
    
    if (result.success) {
      console.log(`   Chunks Completed: ${result.chunksCompleted}`);
      if (result.tablesCreated?.length > 0) {
        console.log(`   Tables Created: ${result.tablesCreated.join(', ')}`);
      }
      if (result.tablesExisted?.length > 0) {
        console.log(`   Tables Skipped: ${result.tablesExisted.join(', ')}`);
      }
      if (result.errors?.length > 0) {
        console.log(`   Warnings: ${result.errors.length} non-critical issues`);
      }
    } else {
      console.log(`   Error: ${result.error}`);
      if (result.fallbackRequired) {
        console.log('   Recommendation: Use manual setup');
      }
    }
  };

  // 3. Execute automated setup
  console.log('\n3. Starting automated database setup...');
  try {
    await setupService.executeSetup(onProgress, onError, onComplete);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }

  console.log('\n✅ Test completed!');
}

// Run the test
testAutomatedSetup().catch(console.error);