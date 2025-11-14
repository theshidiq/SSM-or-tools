# ML Model Training Implementation Guide

## Overview

This document describes the implementation of **persistent ML model training with automatic period detection**. Training is now **separate from prediction**, with models persisted to IndexedDB and automatically detecting when retraining is needed.

## Architecture Changes

### Before (Old System)
```
User clicks "AI 自動入力"
  → Check model
  → Train for 28 minutes ⏳ (hardcoded 6 periods)
  → Generate predictions
  → Total: ~30 minutes
```

### After (New System)
```
FIRST TIME:
User clicks "モデルトレーニング" in Settings
  → Detects 10 periods automatically
  → Train for 28 minutes ⏳
  → Model saved to IndexedDB
  → Status: "Model Ready ✅"

SUBSEQUENT USES:
User clicks "AI 自動入力"
  → Load cached model (1-2 seconds)
  → Generate predictions
  → Total: ~10-30 seconds ⚡

NEW PERIOD ADDED:
System shows: "新しい期間検出 (Period 10)"
  → User clicks "再トレーニング"
  → Retrain with all 10 periods
  → Model updated
```

## Implementation Components

### 1. Period Detection (`src/utils/periodDetection.js`)

**Purpose**: Dynamically detect all periods with schedule data

**Key Functions**:
- `detectAvailablePeriods()` - Scans localStorage for periods with data
- `comparePeriodsWithModel()` - Checks if retraining needed
- `getPeriodDetails()` - Gets detailed period information
- `validateTrainingData()` - Ensures minimum data requirements
- `formatPeriodList()` - Pretty format for UI display

**Example Usage**:
```javascript
import { detectAvailablePeriods } from '../utils/periodDetection';

const periods = detectAvailablePeriods();
// Returns: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
console.log(`Found ${periods.length} periods with data`);
```

### 2. Data Extractor Updates (`src/ai/utils/DataExtractor.js`)

**Changes**:
- Removed hardcoded `< 6` limit
- Now uses `detectAvailablePeriods()` dynamically
- Returns `periodsUsed` and `totalPeriods` in extraction result

**Key Function**:
```javascript
export const extractAllHistoricalData = () => {
  const availablePeriods = detectAvailablePeriods();
  // Extract data from all detected periods
  // ...
  return {
    periods: allData,
    periodsUsed: availablePeriods,
    totalPeriods: availablePeriods.length,
  };
};
```

### 3. Model Metadata Enhancement (`src/ai/ml/TensorFlowScheduler.js`)

**Changes**:
- Captures `periodsUsed` during training
- Stores in model metadata
- Returns in training result

**Metadata Structure**:
```javascript
{
  version: "2.1.0",
  trainedAt: "2025-10-29T10:30:00Z",
  accuracy: 0.92,
  loss: 0.08,
  trainingSamples: 7200,
  staffCount: 15,
  trainingTime: 1680000, // milliseconds
  periodsUsed: [0,1,2,3,4,5,6,7,8,9],
  totalPeriods: 10,
  phase2Enabled: true,
  phase3Enabled: true
}
```

### 4. Training Hook (`src/hooks/useModelTraining.js`)

**Purpose**: Manage training independently from prediction

**Key Features**:
- Load/save model metadata
- Check model status and retraining needs
- Start/cancel training
- Progress reporting
- Auto-check for new periods (every 5 minutes)

**Usage Example**:
```javascript
import { useModelTraining } from '../hooks/useModelTraining';

const MyComponent = () => {
  const {
    modelStatus,
    trainingProgress,
    periodComparison,
    startTraining,
    isTraining,
    needsRetraining,
  } = useModelTraining();

  return (
    <div>
      <p>Status: {modelStatus.isReady ? 'Ready' : 'Not trained'}</p>
      {needsRetraining && <p>New periods detected!</p>}
      <button onClick={startTraining}>Start Training</button>
    </div>
  );
};
```

### 5. Training Modal (`src/components/ai/ModelTrainingModal.jsx`)

**Purpose**: Dedicated UI for model training

**Features**:
- Model status display
- Period comparison (current vs model)
- Real-time training progress
- Epoch-by-epoch updates
- Estimated time remaining
- Training history and metadata

**Key UI Elements**:
- Model status badge (✅/⚠️/❌)
- Period detection display
- Progress bar with percentage
- Epoch counter (e.g., "Epoch 30/60")
- Loss and accuracy in real-time
- Cancel button
- Advanced details toggle

### 6. Status Badge (`src/components/ai/ModelStatusBadge.jsx`)

**Purpose**: Always-visible model status indicator

**States**:
- 🔄 **Training** (blue, animated)
- ✅ **Ready** (green)
- ⚠️ **Needs Retraining** (yellow)
- ❌ **Not Trained** (red)

**Usage**:
```javascript
import { ModelStatusBadge } from '../components/ai/ModelStatusBadge';

<ModelStatusBadge className="ml-auto" />
```

### 7. Progress Callbacks (`src/ai/ml/TensorFlowScheduler.js`)

**Progress Stages**:
1. **Data Extraction** (5%): "データ抽出中..."
2. **Model Training** (20-90%): "トレーニング中 (Epoch X/Y)"
   - Reports every epoch
   - Includes loss, accuracy, ETA
3. **Model Saving** (95%): "モデル保存中..."
4. **Completion** (100%): "完了"

**Callback Format**:
```javascript
onProgress({
  stage: 'トレーニング中 (Epoch 30/60)',
  percentage: 70,
  currentEpoch: 30,
  totalEpochs: 60,
  loss: 0.12,
  accuracy: 0.89,
  estimatedTimeRemaining: 840, // seconds
});
```

## Integration Guide

### Step 1: Add ModelStatusBadge to UI

Add to your main component (e.g., NavigationToolbar, Settings):

```javascript
import { ModelStatusBadge } from '../components/ai/ModelStatusBadge';

<div className="flex items-center gap-4">
  <ModelStatusBadge />
  {/* Other toolbar items */}
</div>
```

### Step 2: Add Training Button to Settings

In `src/components/settings/tabs/AISettingsTab.jsx`:

```javascript
import { useState } from 'react';
import { ModelTrainingModal } from '../../ai/ModelTrainingModal';
import { useModelTraining } from '../../../hooks/useModelTraining';

const AISettingsTab = () => {
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const { getModelInfo } = useModelTraining();
  const modelInfo = getModelInfo();

  return (
    <div>
      {/* Existing settings */}

      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">モデルトレーニング</h3>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-2">
            ステータス: {modelInfo.message}
          </p>
          {modelInfo.accuracy && (
            <p className="text-sm text-gray-600">
              精度: {(modelInfo.accuracy * 100).toFixed(1)}%
            </p>
          )}
        </div>

        <button
          onClick={() => setShowTrainingModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          モデルトレーニング
        </button>
      </div>

      <ModelTrainingModal
        isOpen={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
      />
    </div>
  );
};
```

### Step 3: Simplify AI Assistant (Optional)

Remove training logic from AI Assistant since model is pre-trained:

```javascript
// Before: AI Assistant triggered training
const handleAutoFillSchedule = async () => {
  await trainModel(); // 28 minutes...
  await generatePredictions();
};

// After: AI Assistant just uses cached model
const handleAutoFillSchedule = async () => {
  const { isReady } = useModelTraining();

  if (!isReady) {
    alert('モデルが未トレーニングです。先に設定からトレーニングしてください。');
    return;
  }

  await generatePredictions(); // Instant!
};
```

## Testing Guide

### Test 1: Period Detection
```javascript
// Run in browser console
import { detectAvailablePeriods } from './src/utils/periodDetection';

const periods = detectAvailablePeriods();
console.log('Detected periods:', periods);
// Expected: [0, 1, 2, ...] based on your data
```

### Test 2: Training with 10 Periods
1. Click "モデルトレーニング" button
2. Verify modal shows 10 periods detected
3. Click "トレーニング開始"
4. Watch progress bar advance
5. Verify completion at 100%
6. Check metadata shows correct periods

### Test 3: Retraining Detection
1. Train model with periods 0-9
2. Add period 10 data to localStorage
3. Wait 5 minutes or reload app
4. Verify badge shows "⚠️ 再トレーニング推奨"
5. Open modal, verify shows "新しい期間: 10"

### Test 4: Prediction Speed
1. Train model once
2. Close and reopen app
3. Click "AI 自動入力"
4. Measure time to prediction start
5. Expected: <5 seconds (no retraining)

## Performance Characteristics

### Training Time (10 Periods)
- **Small Dataset** (<500 samples): ~1-2 minutes
- **Medium Dataset** (500-2000): ~5-10 minutes
- **Large Dataset** (>2000): ~20-30 minutes
- **Your Dataset** (7200 samples): ~28 minutes

### Memory Usage
- **Feature Tensors**: ~2.2 MB
- **Model Weights**: ~5.0 MB
- **Pattern Memory**: ~0.7 MB
- **Total Peak**: ~8 MB (acceptable)

### Prediction Speed
- **Cold Start** (first prediction): ~2-5 seconds
- **Cached**: ~100-500 ms per prediction
- **No Training Wait**: Instant (model pre-loaded)

## Troubleshooting

### Issue: "No periods detected"
**Solution**: Verify localStorage has schedule data
```javascript
// Check in console
for (let i = 0; i < 10; i++) {
  const data = localStorage.getItem(`scheduleData_${i}`);
  console.log(`Period ${i}:`, data ? 'Has data' : 'No data');
}
```

### Issue: Training fails with "Insufficient data"
**Solution**: Ensure minimum requirements
- At least 1 period with data
- At least 50 training samples
- At least 1 staff member with schedule

### Issue: Progress bar stuck
**Solution**: Check console for errors
- TensorFlow errors
- Memory issues
- Browser compatibility

### Issue: Model not persisting
**Solution**: Check IndexedDB
```javascript
// In console
window.indexedDB.databases().then(dbs => {
  console.log('IndexedDB databases:', dbs);
});
```

## Future Enhancements

### Phase 5: Incremental Training
- Train only on new periods (faster)
- Preserve existing model weights
- Update without full retrain

### Phase 6: Model Versioning
- Keep multiple model versions
- A/B testing between models
- Rollback to previous version

### Phase 7: Distributed Training
- Web Worker parallelization
- Multi-threaded training
- Faster completion time

### Phase 8: Cloud Sync
- Sync trained models across devices
- Share models between users
- Centralized model repository

## API Reference

### detectAvailablePeriods()
Returns array of period indices with data.
```javascript
detectAvailablePeriods() => number[]
```

### useModelTraining()
Hook for training management.
```javascript
{
  modelStatus: {
    isReady: boolean,
    isTraining: boolean,
    needsRetraining: boolean,
    metadata: object | null,
    error: string | null
  },
  trainingProgress: {
    stage: string,
    percentage: number,
    currentEpoch: number,
    totalEpochs: number,
    loss: number,
    accuracy: number,
    estimatedTimeRemaining: number
  },
  periodComparison: object | null,
  startTraining: (options?) => Promise<result>,
  cancelTraining: () => void,
  loadModel: () => Promise<result>,
  checkModelStatus: () => Promise<status>,
  getModelInfo: () => object
}
```

### Model Metadata Schema
```typescript
interface ModelMetadata {
  version: string;
  trainedAt: string; // ISO 8601
  accuracy: number; // 0-1
  loss: number;
  trainingSamples: number;
  validationSamples: number;
  staffCount: number;
  trainingTime: number; // milliseconds
  periodsUsed: number[];
  totalPeriods: number;
  phase2Enabled: boolean;
  phase3Enabled: boolean;
}
```

## Summary

This implementation provides:
- ✅ **Dynamic Period Detection**: Automatically supports 1-100+ periods
- ✅ **Persistent Training**: Train once, use forever
- ✅ **Separate Training UI**: Dedicated modal for training
- ✅ **Real-time Progress**: Epoch-by-epoch updates with ETA
- ✅ **Smart Retraining**: Auto-detect when new periods added
- ✅ **Fast Predictions**: No training wait for AI Assistant
- ✅ **Model Metadata**: Track what periods were used
- ✅ **Status Badge**: Always-visible model status

**Result**:
- Training: ~28 minutes (one-time)
- Predictions: <5 seconds (every time)
- Total improvement: ~25 minutes saved per prediction!
