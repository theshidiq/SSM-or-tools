#!/bin/bash

# Open Cache Cleaner Tool
# This script opens the cache cleaner HTML file in your default browser

CACHE_CLEANER="/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/clear-ml-cache.html"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                 Opening ML Cache Cleaner Tool                         ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Opening: file://$CACHE_CLEANER"
echo ""
echo "Next steps:"
echo "  1. Click '🧹 Clear ML Cache' button in the opened page"
echo "  2. Wait for confirmation message"
echo "  3. Navigate to http://localhost:3001"
echo "  4. Press F12 to open DevTools Console"
echo "  5. Click the training button (❌ トレーニング必要)"
echo "  6. Look for: '🔧 Using Mean Squared Error loss for improved numerical stability'"
echo "  7. Verify loss values are numbers (not NaN)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"

# Open in default browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$CACHE_CLEANER"
else
  # Linux
  if command -v xdg-open > /dev/null; then
    xdg-open "$CACHE_CLEANER"
  # Windows (Git Bash)
  elif command -v start > /dev/null; then
    start "$CACHE_CLEANER"
  else
    echo "❌ Could not detect browser opener for your OS"
    echo "Please manually open: file://$CACHE_CLEANER"
  fi
fi
