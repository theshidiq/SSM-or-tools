# Quick ML Cache Clear & Test Instructions

## 🚀 Fast Track Testing (2 minutes)

### Step 1: Open App & Console
1. Go to: **http://localhost:3001**
2. Press **F12** (or Cmd+Option+I on Mac)
3. Click **Console** tab

### Step 2: Clear Cache (Copy & Paste)
```javascript
const result = await (async function() {
  try {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('tensorflowjs');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => { console.warn('Blocked - close other tabs'); resolve(); };
      setTimeout(() => resolve(), 2000);
    });
    localStorage.removeItem('ml_model_metadata');
    localStorage.removeItem('ml_last_training_check');
    return { success: true, message: 'Cache cleared!' };
  } catch(e) {
    return { success: false, error: e.message };
  }
})();
console.log('✅ Cache clear result:', result);
```

**Expected:** `✅ Cache clear result: { success: true, message: 'Cache cleared!' }`

### Step 3: Refresh Page
```javascript
location.reload();
```

### Step 4: Start Training
Wait 2 seconds, then click the button: **"トレーニング"** or **"再トレーニング"**

### Step 5: Watch Console
Look for these 4 critical lines:

```
✅ 🔧 Creating fresh model with current architecture
✅ 🏗️ Creating enhanced TensorFlow model
⭐ 🔧 Using Mean Squared Error loss for improved numerical stability  ← CRITICAL!
✅ 📊 Training epoch 1/100, loss: 0.4523  ← Should be a NUMBER, not NaN!
```

---

## ✅ SUCCESS if you see:
- Cache cleared: `{ success: true }`
- MSE message: `🔧 Using Mean Squared Error loss`
- Loss values: `0.45, 0.38, 0.32` (numbers, not NaN)

## ❌ FAILURE if you see:
- Cache clear failed
- No MSE message
- Loss values: `NaN, NaN, NaN`

---

## What to Report Back

**Just 3 things:**

1. **Cache Status:** SUCCESS or FAILED
2. **MSE Message:** YES or NO
3. **First 3 Loss Values:** Write the actual numbers or "NaN"

Example:
```
✅ Cache: SUCCESS
✅ MSE Message: YES
✅ Loss values: 0.4523, 0.3891, 0.3245
```

---

**That's it!** Should take 2 minutes total.
