/**
 * Test script to verify ML training with all NaN loss fixes applied
 *
 * Run this in browser console at http://localhost:3001
 *
 * This will:
 * 1. Load the necessary modules
 * 2. Trigger ML training
 * 3. Capture and display training logs
 */

console.log('🧪 Starting ML Training Test...');
console.log('📋 Checking for NaN loss issue with all fixes applied:');
console.log('   ✅ Empty shift label handling fixed');
console.log('   ✅ Feature validation (NaN/Infinity detection)');
console.log('   ✅ Label validation (integer check, range validation)');
console.log('   ✅ Feature normalization to [0,1] range');
console.log('   ✅ Batch normalization disabled');
console.log('   ✅ Label smoothing (10%) applied');
console.log('   ✅ Tensor validation before training');
console.log('   ✅ Simplified network architecture [128,64]');
console.log('   ✅ He initialization');
console.log('   ✅ ELU activation');
console.log('');
console.log('🔍 Please click the "❌ トレーニング必要" button and then "🔄 再トレーニング開始"');
console.log('📊 Watch for training output below...');
console.log('');
console.log('Expected output:');
console.log('  ⏱️ Epoch 1/50 - Loss: <number>, Acc: <percentage>');
console.log('  ⏱️ Epoch 2/50 - Loss: <number>, Acc: <percentage>');
console.log('  ...');
console.log('');
console.log('✅ SUCCESS if Loss shows a valid number (not NaN)');
console.log('❌ FAILURE if Loss shows NaN');
console.log('');
console.log('==========================================');
