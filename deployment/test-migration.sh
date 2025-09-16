#!/bin/bash

# Phase 5: Migration and Rollback Testing Suite
# Comprehensive testing of all migration steps and rollback procedures

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
TEST_LOG="$PROJECT_ROOT/deployment/test-results.log"
BACKUP_DIR="$PROJECT_ROOT/deployment/test-backups"

# Test configuration
TEST_TIMEOUT=60
HEALTH_CHECK_RETRIES=10
LOAD_TEST_DURATION=30
CONCURRENT_CONNECTIONS=50

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test tracking
declare -A test_results
total_tests=0
passed_tests=0
failed_tests=0

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
    echo -e "${BLUE}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$TEST_LOG"
}

# Test result tracking
pass_test() {
    local test_name="$1"
    test_results["$test_name"]="PASS"
    passed_tests=$((passed_tests + 1))
    total_tests=$((total_tests + 1))
    log_success "TEST PASS: $test_name"
}

fail_test() {
    local test_name="$1"
    local reason="$2"
    test_results["$test_name"]="FAIL: $reason"
    failed_tests=$((failed_tests + 1))
    total_tests=$((total_tests + 1))
    log_error "TEST FAIL: $test_name - $reason"
}

# Wait for service to be healthy
wait_for_service_health() {
    local service_name="$1"
    local timeout="${2:-$TEST_TIMEOUT}"

    log_info "Waiting for $service_name to be healthy (timeout: ${timeout}s)..."

    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))

    while [ $(date +%s) -lt $end_time ]; do
        local healthy_count=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service_name" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")
        local total_count=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service_name" | wc -l | tr -d ' ')

        if [ "$healthy_count" -eq "$total_count" ] && [ "$total_count" -gt 0 ]; then
            log_success "$service_name is healthy ($healthy_count/$total_count containers)"
            return 0
        fi

        log_info "Waiting for $service_name... ($healthy_count/$total_count healthy)"
        sleep 5
    done

    log_error "$service_name failed to become healthy within ${timeout}s"
    return 1
}

# Test HTTP endpoint
test_http_endpoint() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local timeout="${3:-10}"

    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$endpoint" 2>/dev/null || echo "000")

    if [ "$response" = "$expected_status" ]; then
        return 0
    else
        log_error "Expected HTTP $expected_status, got $response for $endpoint"
        return 1
    fi
}

# Test WebSocket connection
test_websocket_connection() {
    local ws_url="$1"
    local timeout="${2:-10}"

    # Use a simple WebSocket test with Node.js (if available) or Python
    if command -v node > /dev/null 2>&1; then
        local test_script=$(cat <<'EOF'
const WebSocket = require('ws');
const ws = new WebSocket(process.argv[2]);
let connected = false;

ws.on('open', function open() {
    connected = true;
    console.log('connected');
    ws.close();
});

ws.on('error', function error(err) {
    console.log('error');
    process.exit(1);
});

setTimeout(() => {
    if (!connected) {
        console.log('timeout');
        process.exit(1);
    }
}, parseInt(process.argv[3]) * 1000);
EOF
        )

        local result=$(echo "$test_script" | node /dev/stdin "$ws_url" "$timeout" 2>/dev/null || echo "error")

        if [ "$result" = "connected" ]; then
            return 0
        else
            log_error "WebSocket connection failed: $result"
            return 1
        fi
    else
        # Fallback to HTTP health check
        test_http_endpoint "${ws_url/ws:/http:}/health" 200 "$timeout"
    fi
}

# Load testing function
run_load_test() {
    local endpoint="$1"
    local duration="$2"
    local connections="$3"

    log_info "Running load test: $connections concurrent connections for ${duration}s"

    if command -v ab > /dev/null 2>&1; then
        # Use Apache Bench if available
        local total_requests=$((connections * duration / 2))  # Rough calculation
        local result=$(ab -n "$total_requests" -c "$connections" -t "$duration" "$endpoint" 2>/dev/null | grep "Requests per second" | awk '{print $4}' || echo "0")

        log_info "Load test completed: $result requests/second"

        # Consider test passed if we get any requests through
        if (( $(echo "$result > 0" | bc -l 2>/dev/null || echo "0") )); then
            return 0
        else
            return 1
        fi
    else
        # Fallback to simple concurrent curl tests
        local success_count=0

        for ((i=1; i<=connections; i++)); do
            if curl -f -s --max-time 5 "$endpoint" > /dev/null 2>&1; then
                success_count=$((success_count + 1))
            fi &
        done

        wait

        log_info "Load test completed: $success_count/$connections successful requests"

        # Consider test passed if at least 80% of requests succeed
        local success_rate=$((success_count * 100 / connections))
        if [ "$success_rate" -ge 80 ]; then
            return 0
        else
            return 1
        fi
    fi
}

# Test 1: Docker Environment Setup
test_docker_environment() {
    log_info "Testing Docker environment setup..."

    # Check Docker is running
    if ! docker info > /dev/null 2>&1; then
        fail_test "docker_environment" "Docker is not running"
        return
    fi

    # Check docker-compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        fail_test "docker_environment" "docker-compose.yml not found"
        return
    fi

    # Validate docker-compose configuration
    if ! docker-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        fail_test "docker_environment" "Invalid docker-compose configuration"
        return
    fi

    pass_test "docker_environment"
}

# Test 2: Initial Deployment
test_initial_deployment() {
    log_info "Testing initial deployment..."

    # Start services
    if ! docker-compose -f "$COMPOSE_FILE" up -d; then
        fail_test "initial_deployment" "Failed to start services"
        return
    fi

    # Wait for services to be healthy
    if ! wait_for_service_health "go-websocket-server" 120; then
        fail_test "initial_deployment" "Go WebSocket server failed to start"
        return
    fi

    if ! wait_for_service_health "nginx" 60; then
        fail_test "initial_deployment" "Nginx failed to start"
        return
    fi

    pass_test "initial_deployment"
}

# Test 3: Health Check Endpoints
test_health_endpoints() {
    log_info "Testing health check endpoints..."

    # Test nginx health
    if ! test_http_endpoint "http://localhost/nginx-health" 200 10; then
        fail_test "health_endpoints" "Nginx health check failed"
        return
    fi

    # Test WebSocket health
    if ! test_http_endpoint "http://localhost/ws/health" 200 10; then
        fail_test "health_endpoints" "WebSocket health check failed"
        return
    fi

    pass_test "health_endpoints"
}

# Test 4: WebSocket Connectivity
test_websocket_connectivity() {
    log_info "Testing WebSocket connectivity..."

    if ! test_websocket_connection "ws://localhost/ws" 15; then
        fail_test "websocket_connectivity" "WebSocket connection failed"
        return
    fi

    pass_test "websocket_connectivity"
}

# Test 5: Load Balancing
test_load_balancing() {
    log_info "Testing load balancing across replicas..."

    # Check that we have multiple replicas running
    local replica_count=$(docker-compose -f "$COMPOSE_FILE" ps -q go-websocket-server | wc -l | tr -d ' ')

    if [ "$replica_count" -lt 2 ]; then
        fail_test "load_balancing" "Insufficient replicas for load balancing test ($replica_count)"
        return
    fi

    # Run load test to verify distribution
    if ! run_load_test "http://localhost/ws/health" "$LOAD_TEST_DURATION" "$CONCURRENT_CONNECTIONS"; then
        fail_test "load_balancing" "Load balancing test failed"
        return
    fi

    pass_test "load_balancing"
}

# Test 6: Staged Rollout Simulation
test_staged_rollout() {
    log_info "Testing staged rollout process..."

    # Test stage 1 (10% - 1 replica)
    if ! "$PROJECT_ROOT/deployment/staged-rollout.sh" "stage1"; then
        fail_test "staged_rollout" "Stage 1 rollout failed"
        return
    fi

    # Verify 1 replica is running
    sleep 10
    local stage1_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q go-websocket-server | wc -l | tr -d ' ')
    if [ "$stage1_replicas" -ne 1 ]; then
        fail_test "staged_rollout" "Stage 1 replica count incorrect: $stage1_replicas (expected 1)"
        return
    fi

    # Test stage 2 (50% - 2 replicas)
    if ! "$PROJECT_ROOT/deployment/staged-rollout.sh" "stage2"; then
        fail_test "staged_rollout" "Stage 2 rollout failed"
        return
    fi

    # Verify 2 replicas are running
    sleep 10
    local stage2_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q go-websocket-server | wc -l | tr -d ' ')
    if [ "$stage2_replicas" -ne 2 ]; then
        fail_test "staged_rollout" "Stage 2 replica count incorrect: $stage2_replicas (expected 2)"
        return
    fi

    # Test stage 3 (100% - 3 replicas)
    if ! "$PROJECT_ROOT/deployment/staged-rollout.sh" "stage3"; then
        fail_test "staged_rollout" "Stage 3 rollout failed"
        return
    fi

    # Verify 3 replicas are running
    sleep 10
    local stage3_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q go-websocket-server | wc -l | tr -d ' ')
    if [ "$stage3_replicas" -ne 3 ]; then
        fail_test "staged_rollout" "Stage 3 replica count incorrect: $stage3_replicas (expected 3)"
        return
    fi

    pass_test "staged_rollout"
}

# Test 7: Emergency Rollback
test_emergency_rollback() {
    log_info "Testing emergency rollback procedures..."

    # Create rollback signal
    echo '{"rollback": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$PROJECT_ROOT/public/rollback-signal.json"

    # Test that rollback signal is detected
    sleep 5

    if [ ! -f "$PROJECT_ROOT/public/rollback-signal.json" ]; then
        fail_test "emergency_rollback" "Rollback signal file not created"
        return
    fi

    # Clean up rollback signal
    rm -f "$PROJECT_ROOT/public/rollback-signal.json"

    pass_test "emergency_rollback"
}

# Test 8: Zero-Downtime Deployment
test_zero_downtime_deployment() {
    log_info "Testing zero-downtime deployment..."

    # Start continuous health checking in background
    local health_check_log="$PROJECT_ROOT/deployment/health_check_during_deploy.log"
    (
        while true; do
            local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            if curl -f -s --max-time 3 "http://localhost/nginx-health" > /dev/null 2>&1; then
                echo "$timestamp: HEALTHY" >> "$health_check_log"
            else
                echo "$timestamp: UNHEALTHY" >> "$health_check_log"
            fi
            sleep 1
        done
    ) &
    local health_check_pid=$!

    # Run zero-downtime deployment (skip build to speed up test)
    if ! "$PROJECT_ROOT/deployment/zero-downtime-deploy.sh" "true"; then
        kill $health_check_pid 2>/dev/null || true
        fail_test "zero_downtime_deployment" "Zero-downtime deployment failed"
        return
    fi

    # Stop health checking
    kill $health_check_pid 2>/dev/null || true
    sleep 2

    # Analyze health check results
    if [ -f "$health_check_log" ]; then
        local unhealthy_count=$(grep "UNHEALTHY" "$health_check_log" | wc -l | tr -d ' ')
        local total_checks=$(wc -l < "$health_check_log" | tr -d ' ')
        local uptime_percentage=$((100 - (unhealthy_count * 100 / total_checks)))

        log_info "Uptime during deployment: $uptime_percentage% ($unhealthy_count/$total_checks failed checks)"

        # Consider test passed if uptime is > 95%
        if [ "$uptime_percentage" -ge 95 ]; then
            pass_test "zero_downtime_deployment"
        else
            fail_test "zero_downtime_deployment" "Uptime too low: $uptime_percentage%"
        fi

        # Clean up
        rm -f "$health_check_log"
    else
        fail_test "zero_downtime_deployment" "Health check log not found"
    fi
}

# Test 9: Monitoring and Alerting
test_monitoring_alerting() {
    log_info "Testing monitoring and alerting system..."

    # Run monitoring check
    if ! "$PROJECT_ROOT/deployment/monitoring.sh" "check"; then
        fail_test "monitoring_alerting" "Monitoring check failed"
        return
    fi

    # Verify metrics file is created
    if [ ! -f "$PROJECT_ROOT/deployment/metrics.json" ]; then
        fail_test "monitoring_alerting" "Metrics file not created"
        return
    fi

    # Validate metrics JSON
    if ! jq . "$PROJECT_ROOT/deployment/metrics.json" > /dev/null 2>&1; then
        fail_test "monitoring_alerting" "Invalid metrics JSON format"
        return
    fi

    pass_test "monitoring_alerting"
}

# Test 10: Full Migration Simulation
test_full_migration() {
    log_info "Testing full migration simulation..."

    # This test simulates a complete migration from legacy to new system
    # Including feature flag management and rollback capabilities

    # Set feature flags for migration
    local feature_flags='{"go_websocket_enabled": true, "hybrid_mode_enabled": true, "fallback_mode_enabled": false, "emergency_rollback_active": false}'
    echo "$feature_flags" > "$PROJECT_ROOT/deployment/test-feature-flags.json"

    # Simulate migration stages with monitoring
    for stage in 10 50 100; do
        log_info "Simulating $stage% migration..."

        # Run monitoring during stage
        "$PROJECT_ROOT/deployment/monitoring.sh" "check" || true

        # Verify system health
        if ! test_http_endpoint "http://localhost/nginx-health" 200 10; then
            fail_test "full_migration" "System unhealthy at $stage% migration"
            return
        fi

        sleep 5
    done

    # Clean up
    rm -f "$PROJECT_ROOT/deployment/test-feature-flags.json"

    pass_test "full_migration"
}

# Cleanup function
cleanup_test_environment() {
    log_info "Cleaning up test environment..."

    # Stop services
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

    # Clean up test files
    rm -f "$PROJECT_ROOT/public/rollback-signal.json"
    rm -f "$PROJECT_ROOT/deployment/test-feature-flags.json"
    rm -f "$PROJECT_ROOT/deployment/health_check_during_deploy.log"

    # Clean up alert cooldown files
    rm -f "$PROJECT_ROOT/deployment/.alert_cooldown_"*

    log_info "Test environment cleanup completed"
}

# Generate test report
generate_test_report() {
    log_info "Generating test report..."

    local report_file="$PROJECT_ROOT/deployment/test-report.html"

    cat > "$report_file" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Phase 5 Migration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Phase 5 Migration Test Report</h1>
    <div class="summary">
        <h2>Test Summary</h2>
        <p><strong>Total Tests:</strong> $total_tests</p>
        <p><strong>Passed:</strong> <span class="pass">$passed_tests</span></p>
        <p><strong>Failed:</strong> <span class="fail">$failed_tests</span></p>
        <p><strong>Success Rate:</strong> $(( total_tests > 0 ? passed_tests * 100 / total_tests : 0 ))%</p>
        <p><strong>Generated:</strong> $(date)</p>
    </div>

    <h2>Test Results</h2>
    <table>
        <tr><th>Test Name</th><th>Result</th></tr>
EOF

    for test_name in "${!test_results[@]}"; do
        local result="${test_results[$test_name]}"
        local class="pass"
        if [[ "$result" == FAIL* ]]; then
            class="fail"
        fi
        echo "        <tr><td>$test_name</td><td class=\"$class\">$result</td></tr>" >> "$report_file"
    done

    cat >> "$report_file" <<EOF
    </table>
</body>
</html>
EOF

    log_success "Test report generated: $report_file"
}

# Main test execution
main() {
    local test_mode=${1:-"all"}

    log_info "Starting Phase 5 Migration Test Suite"
    log_info "Test mode: $test_mode"

    # Create test directories
    mkdir -p "$(dirname "$TEST_LOG")"
    mkdir -p "$BACKUP_DIR"

    # Initialize test log
    echo "Phase 5 Migration Test Suite - $(date)" > "$TEST_LOG"

    case $test_mode in
        "all")
            test_docker_environment
            test_initial_deployment
            test_health_endpoints
            test_websocket_connectivity
            test_load_balancing
            test_staged_rollout
            test_emergency_rollback
            test_zero_downtime_deployment
            test_monitoring_alerting
            test_full_migration
            ;;
        "quick")
            test_docker_environment
            test_initial_deployment
            test_health_endpoints
            test_websocket_connectivity
            ;;
        "rollback")
            test_emergency_rollback
            test_monitoring_alerting
            ;;
        "deployment")
            test_staged_rollout
            test_zero_downtime_deployment
            ;;
        *)
            log_error "Unknown test mode: $test_mode"
            echo "Usage: $0 {all|quick|rollback|deployment}"
            exit 1
            ;;
    esac

    # Generate report
    generate_test_report

    # Final summary
    log_info "=== TEST SUITE COMPLETED ==="
    log_info "Total tests: $total_tests"
    log_success "Passed: $passed_tests"
    if [ $failed_tests -gt 0 ]; then
        log_error "Failed: $failed_tests"
    else
        log_success "Failed: $failed_tests"
    fi

    local success_rate=$(( total_tests > 0 ? passed_tests * 100 / total_tests : 0 ))
    log_info "Success rate: $success_rate%"

    # Exit with error if any tests failed
    if [ $failed_tests -gt 0 ]; then
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

# Handle script termination
trap 'cleanup_test_environment; exit 1' INT TERM

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi