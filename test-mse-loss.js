#!/usr/bin/env node

/**
 * MSE Loss Test Script
 *
 * This script helps verify that the ML model is using Mean Squared Error (MSE) loss
 * instead of the problematic categorical crossentropy that was causing NaN losses.
 *
 * Usage:
 *   1. Clear the cache first: open clear-ml-cache.html in browser
 *   2. Run this script: node test-mse-loss.js
 *   3. Or manually follow the instructions below
 */

const instructions = `
╔════════════════════════════════════════════════════════════════════════╗
║                      MSE LOSS VERIFICATION TEST                        ║
╔════════════════════════════════════════════════════════════════════════╗

📋 STEP-BY-STEP INSTRUCTIONS:

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Clear ML Cache                                                │
└────────────────────────────────────────────────────────────────────────┘

Open the cache cleaner tool:
  1. Open: file://${process.cwd()}/clear-ml-cache.html
  2. Click: "🧹 Clear ML Cache" button
  3. Wait for: "✅ ML cache cleared successfully!" message

Or manually execute this in browser console on http://localhost:3001:

╭────────────────────────────────────────────────────────────────────────╮
│ // Clear IndexedDB                                                     │
│ await new Promise((resolve) => {                                       │
│   const deleteRequest = indexedDB.deleteDatabase('tensorflowjs');      │
│   deleteRequest.onsuccess = () => {                                    │
│     console.log('✅ Deleted tensorflowjs IndexedDB');                  │
│     resolve();                                                         │
│   };                                                                   │
│   deleteRequest.onerror = () => {                                      │
│     console.log('⚠️ Could not delete IndexedDB');                      │
│     resolve();                                                         │
│   };                                                                   │
│ });                                                                    │
│                                                                        │
│ // Clear localStorage metadata                                        │
│ localStorage.removeItem('ml_model_metadata');                         │
│ localStorage.removeItem('ml_last_training_check');                    │
│ console.log('✅ Cleared localStorage metadata');                       │
│                                                                        │
│ console.log('🎉 Cache cleared! Now refresh (F5) and start training.')│
╰────────────────────────────────────────────────────────────────────────╯

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Navigate to Application                                       │
└────────────────────────────────────────────────────────────────────────┘

  1. Open: http://localhost:3001
  2. Refresh the page (F5) if already open
  3. Open Browser DevTools (F12)
  4. Go to Console tab

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Start Training                                                │
└────────────────────────────────────────────────────────────────────────┘

  1. Look for the ML training button:
     - Initial state: "❌ トレーニング必要" (Training Required)
     - Or: "🔄 再トレーニング開始" (Restart Training)

  2. Click the training button

  3. Wait for training to start

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Monitor Console Output                                        │
└────────────────────────────────────────────────────────────────────────┘

Watch for these CRITICAL messages in the console:

✅ EXPECTED MESSAGES (Success):

  1. Model Creation:
     "🏗️ Creating enhanced TensorFlow model..."

  2. MSE Loss Confirmation (THIS IS THE KEY MESSAGE):
     "🔧 Using Mean Squared Error loss for improved numerical stability"

  3. Training Progress with VALID numbers:
     "Epoch 1/50: loss=0.234 (23% complete)"
     "Epoch 2/50: loss=0.189 (26% complete)"
     ...not NaN!

❌ PROBLEMATIC MESSAGES (Failure):

  1. If you see NaN in loss:
     "Epoch 1/50: loss=NaN"
     "⚠️ Warning: NaN detected in loss"

  2. If MSE message is missing:
     Model may be using wrong loss function

  3. If training fails immediately:
     "❌ Training failed: ..."

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Capture and Report Results                                    │
└────────────────────────────────────────────────────────────────────────┘

Copy the following information:

  1. ✅ Cache clearing confirmation
  2. 📊 Full console output from training
  3. 🔧 MSE loss message (present or missing)
  4. 📈 First 5 epoch loss values
  5. ⚠️ Any error messages or warnings

╔════════════════════════════════════════════════════════════════════════╗
║                         WHAT TO LOOK FOR                               ║
╚════════════════════════════════════════════════════════════════════════╝

SUCCESS INDICATORS:
  ✅ Message: "🔧 Using Mean Squared Error loss"
  ✅ Loss values are valid numbers (e.g., 0.234, 0.189)
  ✅ Loss decreases over epochs
  ✅ No NaN warnings
  ✅ Training completes successfully

FAILURE INDICATORS:
  ❌ No MSE message appears
  ❌ Loss values are NaN
  ❌ Training crashes or fails
  ❌ Warnings about invalid loss values

╔════════════════════════════════════════════════════════════════════════╗
║                      TROUBLESHOOTING TIPS                              ║
╚════════════════════════════════════════════════════════════════════════╝

If MSE message doesn't appear:
  1. Verify cache was actually cleared (check IndexedDB in DevTools)
  2. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
  3. Close all tabs and reopen
  4. Clear browser cache completely

If loss is still NaN:
  1. Check training data quality (are there valid patterns?)
  2. Verify feature engineering produces valid numbers
  3. Check for division by zero or invalid operations
  4. Inspect model input data in console

If training doesn't start:
  1. Check if there's sufficient training data (need 10+ periods)
  2. Verify data format is correct
  3. Check browser console for errors
  4. Ensure TensorFlow.js loaded successfully

╔════════════════════════════════════════════════════════════════════════╗
║                         HELPFUL COMMANDS                               ║
╚════════════════════════════════════════════════════════════════════════╝

In Browser Console:

// Check if IndexedDB exists
indexedDB.databases().then(dbs => console.log('Databases:', dbs));

// Check localStorage
Object.keys(localStorage).filter(k => k.includes('ml') || k.includes('tensor'));

// Force clear everything
indexedDB.deleteDatabase('tensorflowjs');
localStorage.clear();

// Monitor TensorFlow.js
window.tf?.version; // Should show TensorFlow.js version

╔════════════════════════════════════════════════════════════════════════╗
║                    EXPECTED CONSOLE OUTPUT                             ║
╚════════════════════════════════════════════════════════════════════════╝

Here's what a successful training session should look like:

[GOOD] 🏗️ Creating enhanced TensorFlow model...
[GOOD] 📊 Model architecture:
[GOOD]   - Input layer: 15 features
[GOOD]   - Hidden layers: [128, 64, 32]
[GOOD]   - Output layer: 4 classes (shift types)
[GOOD] 🔧 Using Mean Squared Error loss for improved numerical stability
[GOOD] 🎯 Training started with 10 periods...
[GOOD] Epoch 1/50: loss=0.234 (23% complete)
[GOOD] Epoch 2/50: loss=0.198 (26% complete)
[GOOD] Epoch 3/50: loss=0.167 (29% complete)
...
[GOOD] ✅ Training completed successfully!
[GOOD] 💾 Model saved to IndexedDB

vs. PROBLEMATIC output:

[BAD]  🏗️ Creating enhanced TensorFlow model...
[BAD]  🎯 Training started...
[BAD]  Epoch 1/50: loss=NaN  ❌ THIS IS WRONG!
[BAD]  ⚠️ Warning: NaN detected in loss
[BAD]  ❌ Training failed

╔════════════════════════════════════════════════════════════════════════╗
║                           QUICK START                                  ║
╚════════════════════════════════════════════════════════════════════════╝

For the impatient:

1. Open: file://${process.cwd()}/clear-ml-cache.html
2. Click: "🧹 Clear ML Cache"
3. Open: http://localhost:3001
4. Press: F12 (DevTools)
5. Click: Training button
6. Look for: "🔧 Using Mean Squared Error loss"
7. Verify: Loss values are numbers (not NaN)

That's it! 🎉

╚════════════════════════════════════════════════════════════════════════╝
`;

console.log(instructions);

// Additional programmatic checks
console.log('\n🔍 Running automated checks...\n');

const http = require('http');

// Check if server is running
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001', (res) => {
      console.log('✅ Server is running on http://localhost:3001');
      console.log(`   Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', () => {
      console.log('❌ Server is NOT running on http://localhost:3001');
      console.log('   Start the server with: npm start');
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      console.log('❌ Server timeout');
      resolve(false);
    });
  });
};

// Check if cache cleaner exists
const fs = require('fs');
const path = require('path');

const checkFiles = () => {
  const cleanerPath = path.join(process.cwd(), 'clear-ml-cache.html');

  if (fs.existsSync(cleanerPath)) {
    console.log('✅ Cache cleaner tool found');
    console.log(`   Location: ${cleanerPath}`);
    console.log(`   Open in browser: file://${cleanerPath}`);
  } else {
    console.log('❌ Cache cleaner tool not found');
    console.log('   Expected location:', cleanerPath);
  }
};

// Run checks
(async () => {
  await checkServer();
  checkFiles();

  console.log('\n' + '═'.repeat(76));
  console.log('All checks complete! Follow the instructions above to proceed.');
  console.log('═'.repeat(76) + '\n');
})();
