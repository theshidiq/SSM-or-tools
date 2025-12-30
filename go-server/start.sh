#!/bin/bash

# Load environment variables from parent .env file
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | grep SUPABASE_SERVICE_KEY | xargs)
    export $(grep -v '^#' ../.env | grep REACT_APP_SUPABASE_URL | xargs)
    export $(grep -v '^#' ../.env | grep REACT_APP_SUPABASE_ANON_KEY | xargs)
    export $(grep -v '^#' ../.env | grep RESTAURANT_ID | xargs)
    export $(grep -v '^#' ../.env | grep ORTOOLS_SERVICE_URL | xargs)
fi

# Load environment variables from local .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep SUPABASE_SERVICE_KEY | xargs)
    export $(grep -v '^#' .env | grep REACT_APP_SUPABASE_URL | xargs)
    export $(grep -v '^#' .env | grep REACT_APP_SUPABASE_ANON_KEY | xargs)
    export $(grep -v '^#' .env | grep RESTAURANT_ID | xargs)
    export $(grep -v '^#' .env | grep ORTOOLS_SERVICE_URL | xargs)
fi

# Print environment status
if [ -n "$SUPABASE_SERVICE_KEY" ]; then
    echo "✅ SUPABASE_SERVICE_KEY loaded (${SUPABASE_SERVICE_KEY:0:20}...)"
else
    echo "⚠️ SUPABASE_SERVICE_KEY not found - will use ANON key"
fi

# Start Go server
exec go run main.go settings_multitable.go shifts_websocket.go ortools_client.go
