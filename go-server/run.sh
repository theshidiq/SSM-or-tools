#!/bin/bash
# Go WebSocket Server - Startup Script
# This script runs the Go server with all required source files

echo "Starting Go WebSocket Server..."
echo "Port: 8080"
echo "WebSocket: ws://localhost:8080/staff-sync"
echo "Health: http://localhost:8080/health"
echo ""

# Run the server with all required files
go run main.go settings_multitable.go shifts_websocket.go
