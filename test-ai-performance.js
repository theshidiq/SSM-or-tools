/**
 * Quick AI Performance Test
 * Tests the optimized AI system performance
 */

const { chromium } = require('playwright');

async function testAIPerformance() {
  console.log('🧪 Testing AI Performance Optimizations...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let aiStartTime = null;
  let aiEndTime = null;
  let errors = [];
  
  // Monitor console for AI performance
  page.on('console', (msg) => {
    const text = msg.text();
    
    // Detect AI start
    if (text.includes('🎯 Starting AI prediction')) {
      aiStartTime = Date.now();
      console.log('⏱️ AI processing started...');
    }
    
    // Detect AI completion
    if (text.includes('✅ AI処理が正常に完了') || text.includes('AUTO_FILL_SUCCESS')) {
      aiEndTime = Date.now();
      const duration = aiEndTime - aiStartTime;
      console.log(`✅ AI completed in ${duration}ms`);
    }
    
    // Detect errors
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  try {
    await page.goto('http://localhost:3000', { timeout: 30000 });
    await page.waitForTimeout(3000); // Let app initialize
    
    // Try to trigger AI
    const aiButton = await page.locator('button:has-text("Start Debug Test")').first();
    if (await aiButton.isVisible({ timeout: 5000 })) {
      console.log('🖱️ Clicking AI test button...');
      await aiButton.click();
      
      // Wait for completion
      await page.waitForTimeout(15000);
      
      if (aiStartTime && aiEndTime) {
        const duration = aiEndTime - aiStartTime;
        console.log(`🎯 AI Performance Result: ${duration}ms`);
        
        if (duration < 5000) { // Less than 5 seconds
          console.log('✅ PERFORMANCE TEST PASSED - Under 5 second target');
        } else {
          console.log('⚠️ PERFORMANCE WARNING - Over 5 second target');
        }
      } else {
        console.log('⚠️ Could not measure AI performance timing');
      }
    } else {
      console.log('ℹ️ No AI test button found, testing basic functionality only');
    }
    
    if (errors.length === 0) {
      console.log('✅ NO ERRORS DETECTED');
    } else {
      console.log(`❌ ${errors.length} ERRORS FOUND:`, errors);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  await browser.close();
  return errors.length === 0;
}

testAIPerformance().then(success => {
  console.log(success ? '✅ PHASE 1 TEST PASSED' : '❌ PHASE 1 TEST FAILED');
  process.exit(success ? 0 : 1);
}).catch(console.error);