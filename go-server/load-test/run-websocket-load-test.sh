#!/bin/bash
# Testing Strategy Implementation: Load Testing (lines 843-878)
# WebSocket load test script
# Exact implementation from IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md

echo "Testing 1000 concurrent connections..."

# Artillery.io configuration for WebSocket testing - exact from plan
cat > websocket-load-test.yml << EOF
config:
  target: 'ws://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 50
  engines:
    ws:
      query:
        period: "1"

scenarios:
  - name: "Staff update operations"
    weight: 100
    engine: ws
    steps:
      - connect:
          url: "/staff-sync"
      - send:
          payload: '{"type":"SYNC_REQUEST","clientId":"load-test-{{ \$randomNumber() }}"}'
      - think: 1
      - loop:
        - send:
            payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"test-{{ \$randomNumber() }}","changes":{"name":"Test {{ \$randomNumber() }}"}}}'
        - think: 2
        count: 10
EOF

# Run the load test - exact from plan line 878
artillery run websocket-load-test.yml

# Enhanced load test for higher concurrency (KPI validation)
echo "Running enhanced load test for 1000+ concurrent users..."

cat > websocket-enhanced-load-test.yml << EOF
config:
  target: 'ws://localhost:8080'
  phases:
    # Ramp up phase
    - duration: 30
      arrivalRate: 50
      name: "Ramp up"
    # Sustained load phase
    - duration: 120
      arrivalRate: 100
      name: "Sustained load"
    # Peak load phase (KPI: 1000+ concurrent users)
    - duration: 60
      arrivalRate: 150
      name: "Peak load"
  environments:
    production:
      target: 'ws://localhost:8080'
      phases:
        - duration: 180
          arrivalRate: 200  # Higher load for production testing
  engines:
    ws:
      query:
        period: "1"

scenarios:
  - name: "Staff CRUD operations"
    weight: 70
    engine: ws
    steps:
      - connect:
          url: "/staff-sync"
      - send:
          payload: '{"type":"SYNC_REQUEST","clientId":"load-test-{{ \$randomNumber() }}"}'
      - think: 1
      - loop:
        - send:
            payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"test-{{ \$randomNumber() }}","changes":{"name":"Test {{ \$randomNumber() }}"}}}'
        - think: 2
        - send:
            payload: '{"type":"STAFF_CREATE","payload":{"name":"Load Test Staff {{ \$randomNumber() }}","position":"Test Position","status":"社員"}}'
        - think: 1
        count: 5

  - name: "High-frequency updates (Race condition testing)"
    weight: 20
    engine: ws
    steps:
      - connect:
          url: "/staff-sync"
      - send:
          payload: '{"type":"SYNC_REQUEST","clientId":"race-test-{{ \$randomNumber() }}"}'
      - loop:
        - send:
            payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"race-staff-{{ \$randomNumber() }}","changes":{"name":"Race Test {{ \$randomNumber() }}"}}}'
        - think: 0.1  # Very fast updates to test race conditions
        count: 20

  - name: "Connection stability test"
    weight: 10
    engine: ws
    steps:
      - connect:
          url: "/staff-sync"
      - send:
          payload: '{"type":"SYNC_REQUEST","clientId":"stability-test-{{ \$randomNumber() }}"}'
      - think: 10  # Long-lived connection
      - send:
          payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"stability-staff","changes":{"name":"Stability Test"}}}'
      - think: 30  # Keep connection alive
EOF

echo "Running enhanced load test with race condition and stability testing..."
artillery run websocket-enhanced-load-test.yml

# Performance monitoring during load test
echo "Starting performance monitoring..."

cat > performance-monitor.yml << EOF
config:
  target: 'ws://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 50
  processor: "./performance-processor.js"
  engines:
    ws:
      query:
        period: "1"

scenarios:
  - name: "Performance monitored staff operations"
    weight: 100
    engine: ws
    beforeScenario: "measureConnectionTime"
    afterScenario: "measureTotalTime"
    steps:
      - connect:
          url: "/staff-sync"
      - function: "measureResponseTime"
      - send:
          payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"perf-test","changes":{"name":"Performance Test"}}}'
      - think: 1
EOF

# Create performance processor for detailed metrics
cat > performance-processor.js << 'EOF'
module.exports = {
  measureConnectionTime: function(context, events, done) {
    context.vars.connectionStart = Date.now();
    return done();
  },

  measureResponseTime: function(context, events, done) {
    context.vars.operationStart = Date.now();
    return done();
  },

  measureTotalTime: function(context, events, done) {
    const totalTime = Date.now() - context.vars.connectionStart;
    const operationTime = Date.now() - context.vars.operationStart;

    // Validate KPI requirements
    if (operationTime > 50) {
      console.log(\`WARNING: Operation time \${operationTime}ms exceeds KPI (<50ms)\`);
    }

    if (totalTime > 100) {
      console.log(\`INFO: Total connection time: \${totalTime}ms\`);
    }

    return done();
  }
};
EOF

echo "Running performance monitoring load test..."
artillery run performance-monitor.yml

echo "Load testing completed!"
echo ""
echo "Key metrics to validate:"
echo "- UI Response Time: <50ms for staff updates"
echo "- Real-time Sync: <100ms for update propagation"
echo "- System Stability: 99.9% uptime during operations"
echo "- Connection Stability: 99.9% success rate"
echo "- Concurrent Users: 1000+ simultaneous connections"
echo ""
echo "Check Artillery output for detailed performance metrics."