#!/bin/bash

echo "🧪 Testing Data Persistence - The Critical Test"
echo "================================================"
echo ""

echo "📊 BEFORE RESTART:"
node check-database-state.js | grep -A 3 "SUMMARY:"

echo ""
echo "⏸️  Now restart npm (Ctrl+C and npm start again)"
echo "   Then run this script again to verify data persists"
echo ""
echo "Expected: Data should STILL show 1 rule with 2 staff IDs ✅"
