#!/bin/sh

# Environment variable injection script for React build
# This script injects runtime environment variables into the React build
# allowing for dynamic configuration without rebuilding the Docker image

set -e

# Define the JS file path where environment variables will be injected
ENV_JS_FILE="/usr/share/nginx/html/env-config.js"

echo "Injecting environment variables into React build..."

# Create the environment configuration JavaScript file
cat <<EOF > "$ENV_JS_FILE"
// Runtime environment configuration
// This file is generated at container startup with environment variables

window._env_ = {
  REACT_APP_SUPABASE_URL: "${REACT_APP_SUPABASE_URL:-}",
  REACT_APP_SUPABASE_ANON_KEY: "${REACT_APP_SUPABASE_ANON_KEY:-}",
  REACT_APP_GOOGLE_VISION_API_KEY: "${REACT_APP_GOOGLE_VISION_API_KEY:-}",
  REACT_APP_GOOGLE_SHEETS_API_KEY: "${REACT_APP_GOOGLE_SHEETS_API_KEY:-}",
  REACT_APP_GOOGLE_APPS_SCRIPT_URL: "${REACT_APP_GOOGLE_APPS_SCRIPT_URL:-}",
  REACT_APP_API_BASE_URL: "${REACT_APP_API_BASE_URL:-http://localhost/api}",
  REACT_APP_ENVIRONMENT: "${REACT_APP_ENVIRONMENT:-production}",
  REACT_APP_VERSION: "${REACT_APP_VERSION:-1.0.0}",
  REACT_APP_BUILD_TIME: "${REACT_APP_BUILD_TIME:-$(date -Iseconds)}"
};

// Console logging for debugging (only in development)
if (window._env_.REACT_APP_ENVIRONMENT !== 'production') {
  console.log('Environment configuration loaded:', window._env_);
}
EOF

# Update the index.html file to include the env-config.js script
# This approach allows runtime environment variable injection
INDEX_FILE="/usr/share/nginx/html/index.html"

if [ -f "$INDEX_FILE" ]; then
    # Check if env-config.js is already included
    if ! grep -q "env-config.js" "$INDEX_FILE"; then
        echo "Adding env-config.js script to index.html..."
        
        # Insert the script tag before the closing head tag
        sed -i 's|</head>|  <script src="/env-config.js"></script>\n  </head>|g' "$INDEX_FILE"
    fi
    
    echo "Environment variables injected successfully!"
else
    echo "Warning: index.html not found at $INDEX_FILE"
    exit 1
fi

# Make the env-config.js file readable by nginx
chmod 644 "$ENV_JS_FILE"

echo "Environment injection completed."