#!/bin/bash
# Verify MSE Loss Fix Implementation

echo "🔍 Verifying MSE Loss Fix Implementation..."
echo "=========================================="
echo ""

# Check TensorFlowScheduler.js for MSE loss
echo "1️⃣ Checking TensorFlowScheduler.js for MSE loss function..."
if grep -q "meanSquaredError" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js; then
    echo "   ✅ Found: meanSquaredError loss function"
    grep -n "meanSquaredError" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js | head -3
else
    echo "   ❌ NOT FOUND: meanSquaredError"
fi
echo ""

# Check for MSE console message
echo "2️⃣ Checking for MSE console message..."
if grep -q "Using Mean Squared Error loss" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js; then
    echo "   ✅ Found: MSE console message"
    grep -n "Using Mean Squared Error loss" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js
else
    echo "   ❌ NOT FOUND: MSE console message"
fi
echo ""

# Check TensorFlowConfig.js
echo "3️⃣ Checking TensorFlowConfig.js for loss configuration..."
if grep -q "loss:" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowConfig.js; then
    echo "   ✅ Found: loss configuration"
    grep -n -A 2 -B 2 "loss:" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowConfig.js | head -10
else
    echo "   ℹ️  No explicit loss config (may use default)"
fi
echo ""

# Check for removed categoricalCrossentropy
echo "4️⃣ Checking for old categoricalCrossentropy (should be removed)..."
if grep -q "categoricalCrossentropy" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js; then
    echo "   ⚠️  WARNING: Found old categoricalCrossentropy - should be removed!"
    grep -n "categoricalCrossentropy" /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js
else
    echo "   ✅ Good: categoricalCrossentropy removed"
fi
echo ""

echo "=========================================="
echo "📊 Verification Summary:"
echo ""
echo "Files checked:"
echo "  - /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js"
echo "  - /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowConfig.js"
echo ""
echo "✅ If all checks pass, MSE fix is correctly implemented"
echo "❌ If any check fails, review the implementation"
echo ""
echo "Next step: Run manual browser test using MANUAL-ML-CACHE-TEST.md"
