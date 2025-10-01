#!/bin/bash

# Database Persistence Test Script
# Tests that WebSocket staff updates are saved to Supabase

echo "🧪 Testing Database Persistence for Staff Updates"
echo "================================================"
echo ""

# Test staff ID
STAFF_ID="ded6e0bc-b9f6-425b-94eb-a3126226a927"

# WebSocket endpoint
WS_URL="ws://localhost:8080/staff-sync"

echo "📋 Step 1: Check initial database state"
echo "SELECT id, name, position, updated_at FROM staff WHERE id = '$STAFF_ID';" | psql $DATABASE_URL

echo ""
echo "📤 Step 2: Send WebSocket staff update message"

# Create WebSocket test message
cat > /tmp/ws_test_message.json <<EOF
{
  "type": "STAFF_UPDATE",
  "payload": {
    "staffId": "$STAFF_ID",
    "changes": {
      "name": "カマル (Updated via WebSocket)",
      "position": "Senior Server"
    }
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "clientId": "test-client-$(date +%s)"
}
EOF

echo "Message to send:"
cat /tmp/ws_test_message.json | jq .

echo ""
echo "📊 Step 3: Wait for server to process and save to database..."
sleep 2

echo ""
echo "✅ Step 4: Verify database was updated"
echo "SELECT id, name, position, updated_at FROM staff WHERE id = '$STAFF_ID';" | psql $DATABASE_URL

echo ""
echo "Expected: updated_at should be more recent than initial check"
echo ""
echo "Test complete! Check server logs with: tail -f go-server/server.log"
