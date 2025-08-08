/**
 * Test script to verify ML scheduler fix
 */

import { HighAccuracyMLScheduler } from './src/ai/ml/HighAccuracyMLScheduler.js';

async function testMLFix() {
  console.log('🔧 Testing ML scheduler fix...');
  
  try {
    const scheduler = new HighAccuracyMLScheduler();
    
    // Test initialization
    console.log('1. Testing initialization...');
    const initResult = await scheduler.initialize();
    console.log('   Initialization result:', initResult);
    
    // Test prediction with mock data
    console.log('2. Testing prediction...');
    const mockParams = {
      staff: { id: 'test-staff', name: '中田', position: '中田' },
      date: new Date('2024-01-15'),
      dateIndex: 15,
      periodData: { monthIndex: 0, scheduleData: {} },
      allHistoricalData: [],
      staffMembers: [{ id: 'test-staff', name: '中田', position: '中田' }]
    };
    
    // Test feature generation
    const features = await scheduler.generateFeatures(mockParams);
    console.log('   Generated features count:', features.length);
    console.log('   Feature sample:', features.slice(0, 5));
    
    // Test prediction (this might fail if no training data, but should not crash)
    try {
      const prediction = await scheduler.predict(mockParams);
      console.log('   Prediction result:', prediction);
    } catch (predError) {
      console.log('   Prediction failed (expected without training):', predError.message);
    }
    
    console.log('✅ ML fix test completed successfully');
    
  } catch (error) {
    console.error('❌ ML fix test failed:', error);
  }
}

// Run test
testMLFix();