# Manual ML Cache Clear & Training Test

## Objective
Verify that the MSE (Mean Squared Error) loss fix is working correctly by clearing the ML model cache and testing fresh model training.

## Prerequisites
- Development server running on http://localhost:3001
- Chrome browser with DevTools

## Test Steps

### Step 1: Open Application
1. Navigate to: `http://localhost:3001`
2. Open Chrome DevTools (F12 or Cmd+Option+I)
3. Switch to the **Console** tab

### Step 2: Clear ML Model Cache
Copy and paste this **exact code** into the console and press Enter:

```javascript
const result = await (async function() {
  try {
    // Delete IndexedDB
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('tensorflowjs');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        console.warn('Blocked - close other tabs');
        resolve();
      };
      setTimeout(() => resolve(), 2000);
    });

    // Clear localStorage
    localStorage.removeItem('ml_model_metadata');
    localStorage.removeItem('ml_last_training_check');

    return { success: true, message: 'Cache cleared!' };
  } catch(e) {
    return { success: false, error: e.message };
  }
})();
console.log('✅ Cache clear result:', result);
```

**Expected output:**
```
✅ Cache clear result: { success: true, message: 'Cache cleared!' }
```

### Step 3: Refresh Page
Execute in console:
```javascript
location.reload();
```

### Step 4: Wait for Page Load
Wait approximately 2 seconds for the page to fully load.

### Step 5: Trigger Model Training
1. Look for the training button with text:
   - "トレーニング" (Training) or
   - "再トレーニング" (Re-training)
2. Click the button to start training

**Alternative:** If button not visible, execute in console:
```javascript
// Find and click training button
const button = Array.from(document.querySelectorAll('button')).find(
  btn => btn.textContent.includes('トレーニング') || btn.textContent.includes('再トレーニング')
);
if (button) {
  console.log('🖱️ Clicking training button:', button.textContent);
  button.click();
} else {
  console.error('❌ Training button not found');
}
```

### Step 6: Monitor Console Output
Watch the console for these **critical messages**:

#### ✅ Success Indicators:
1. `🔧 Creating fresh model with current architecture`
2. `🏗️ Creating enhanced TensorFlow model`
3. **⭐ CRITICAL:** `🔧 Using Mean Squared Error loss for improved numerical stability`
4. Epoch logs showing **numerical loss values** (not NaN)

Example expected output:
```
🔧 Creating fresh model with current architecture
🏗️ Creating enhanced TensorFlow model with advanced features
🔧 Using Mean Squared Error loss for improved numerical stability
📊 Training epoch 1/100, loss: 0.4523
📊 Training epoch 2/100, loss: 0.3891
📊 Training epoch 3/100, loss: 0.3245
```

#### ❌ Failure Indicators:
- Loss values showing `NaN`
- Missing MSE message
- Errors about loss function
- Training fails to start

## What to Report Back

### Required Information:

1. **Cache Clear Status:**
   - [ ] SUCCESS: `{ success: true, message: 'Cache cleared!' }`
   - [ ] FAILED: Error message

2. **MSE Message Appeared:**
   - [ ] YES - Found: `🔧 Using Mean Squared Error loss for improved numerical stability`
   - [ ] NO - Message not found

3. **First 3 Epoch Loss Values:**
   - Epoch 1: _________
   - Epoch 2: _________
   - Epoch 3: _________

4. **Complete Training Log:**
   Copy ALL console output from when you clicked the training button until training completes or fails.

## Troubleshooting

### Issue: IndexedDB Blocked
**Solution:** Close all other tabs with the application open, then retry cache clear.

### Issue: Training Button Not Found
**Solution:**
1. Check if you're on the correct page
2. Look for ML/AI settings panel
3. May need to enable AI features first

### Issue: Training Doesn't Start
**Solution:**
1. Check console for errors
2. Verify training data exists
3. Check if model is already trained (may need to force retrain)

## Success Criteria

✅ **Test PASSES if:**
- Cache cleared successfully
- MSE message appears in console
- First 3 epochs show numerical loss values (e.g., 0.45, 0.38, 0.32)
- No NaN values in loss

❌ **Test FAILS if:**
- Cache clear fails
- MSE message is missing
- Loss values are NaN
- Training crashes or errors

## Additional Notes

- Keep DevTools console open throughout the entire test
- Do not navigate away from the page during training
- Training may take 1-2 minutes to complete
- Save the complete console log for analysis
