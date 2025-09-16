#!/bin/bash

# Phase 5: Complete Deployment Orchestration Script
# Master deployment script that orchestrates the entire Phase 5 migration

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment/phase5-deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
    echo -e "${BLUE}$msg${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

# Phase 5 deployment steps
deploy_phase5() {
    local deployment_mode=${1:-"staged"}
    local skip_tests=${2:-false}

    log_info "========================================"
    log_info "Phase 5: Production Deployment Starting"
    log_info "Mode: $deployment_mode"
    log_info "Skip Tests: $skip_tests"
    log_info "========================================"

    # Step 1: Pre-deployment validation
    log_info "Step 1: Pre-deployment validation"
    if ! pre_deployment_validation; then
        log_error "Pre-deployment validation failed"
        return 1
    fi
    log_success "Pre-deployment validation completed"

    # Step 2: Run tests (if not skipped)
    if [ "$skip_tests" != "true" ]; then
        log_info "Step 2: Running test suite"
        if ! "$PROJECT_ROOT/deployment/test-migration.sh" "quick"; then
            log_error "Pre-deployment tests failed"
            return 1
        fi
        log_success "Pre-deployment tests completed"
    else
        log_warn "Step 2: Tests skipped"
    fi

    # Step 3: Start monitoring
    log_info "Step 3: Starting deployment monitoring"
    start_monitoring_daemon
    log_success "Monitoring daemon started"

    # Step 4: Execute deployment based on mode
    case $deployment_mode in
        "staged")
            log_info "Step 4: Executing staged rollout deployment"
            if ! "$PROJECT_ROOT/deployment/staged-rollout.sh" "all"; then
                log_error "Staged rollout failed"
                cleanup_deployment
                return 1
            fi
            ;;
        "zero-downtime")
            log_info "Step 4: Executing zero-downtime deployment"
            if ! "$PROJECT_ROOT/deployment/zero-downtime-deploy.sh"; then
                log_error "Zero-downtime deployment failed"
                cleanup_deployment
                return 1
            fi
            ;;
        "blue-green")
            log_info "Step 4: Executing blue-green deployment"
            if ! blue_green_deployment; then
                log_error "Blue-green deployment failed"
                cleanup_deployment
                return 1
            fi
            ;;
        *)
            log_error "Unknown deployment mode: $deployment_mode"
            return 1
            ;;
    esac
    log_success "Deployment execution completed"

    # Step 5: Post-deployment validation
    log_info "Step 5: Post-deployment validation"
    if ! post_deployment_validation; then
        log_error "Post-deployment validation failed - initiating rollback"
        emergency_rollback
        return 1
    fi
    log_success "Post-deployment validation completed"

    # Step 6: Performance validation
    log_info "Step 6: Performance validation"
    if ! performance_validation; then
        log_warn "Performance validation failed - monitoring for degradation"
        # Don't fail deployment for performance issues, but alert
    fi
    log_success "Performance validation completed"

    # Step 7: Final tests
    if [ "$skip_tests" != "true" ]; then
        log_info "Step 7: Running full test suite"
        if ! "$PROJECT_ROOT/deployment/test-migration.sh" "all"; then
            log_error "Post-deployment tests failed - system may be unstable"
            log_warn "Manual intervention may be required"
        else
            log_success "All post-deployment tests passed"
        fi
    else
        log_warn "Step 7: Final tests skipped"
    fi

    log_success "========================================"
    log_success "Phase 5 Deployment Completed Successfully"
    log_success "========================================"

    return 0
}

# Pre-deployment validation
pre_deployment_validation() {
    log_info "Running pre-deployment validation..."

    # Check Docker environment
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        return 1
    fi

    # Check required files
    local required_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/nginx/websocket.conf"
        "$PROJECT_ROOT/deployment/staged-rollout.sh"
        "$PROJECT_ROOT/deployment/zero-downtime-deploy.sh"
        "$PROJECT_ROOT/deployment/monitoring.sh"
        "$PROJECT_ROOT/src/hooks/useEmergencyRollback.js"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file missing: $file"
            return 1
        fi
    done

    # Check script permissions
    local executable_scripts=(
        "$PROJECT_ROOT/deployment/staged-rollout.sh"
        "$PROJECT_ROOT/deployment/zero-downtime-deploy.sh"
        "$PROJECT_ROOT/deployment/monitoring.sh"
        "$PROJECT_ROOT/deployment/test-migration.sh"
    )

    for script in "${executable_scripts[@]}"; do
        if [ ! -x "$script" ]; then
            log_error "Script not executable: $script"
            return 1
        fi
    done

    # Validate docker-compose configuration
    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.yml" config > /dev/null 2>&1; then
        log_error "Invalid docker-compose configuration"
        return 1
    fi

    # Check available resources
    local available_memory=$(free -m | awk 'NR==2{print $7}')
    if [ "$available_memory" -lt 2048 ]; then
        log_warn "Low available memory: ${available_memory}MB (recommended: 2048MB)"
    fi

    log_info "Pre-deployment validation passed"
    return 0
}

# Post-deployment validation
post_deployment_validation() {
    log_info "Running post-deployment validation..."

    # Wait for services to stabilize
    sleep 30

    # Check service health
    local services=("go-websocket-server" "nginx" "redis")
    for service in "${services[@]}"; do
        local healthy_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")
        local total_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q "$service" | wc -l | tr -d ' ')

        if [ "$healthy_count" -ne "$total_count" ] || [ "$total_count" -eq 0 ]; then
            log_error "Service $service health check failed: $healthy_count/$total_count healthy"
            return 1
        fi

        log_info "Service $service: $healthy_count/$total_count containers healthy"
    done

    # Check endpoint connectivity
    local endpoints=(
        "http://localhost/nginx-health"
        "http://localhost/ws/health"
    )

    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s --max-time 10 "$endpoint" > /dev/null; then
            log_error "Endpoint health check failed: $endpoint"
            return 1
        fi
        log_info "Endpoint healthy: $endpoint"
    done

    # Verify replica count
    local expected_replicas=3
    local actual_replicas=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q go-websocket-server | wc -l | tr -d ' ')
    if [ "$actual_replicas" -ne "$expected_replicas" ]; then
        log_error "Incorrect replica count: $actual_replicas (expected: $expected_replicas)"
        return 1
    fi

    log_info "Post-deployment validation passed"
    return 0
}

# Performance validation
performance_validation() {
    log_info "Running performance validation..."

    # Response time check
    local start_time=$(date +%s%3N)
    if curl -f -s --max-time 5 "http://localhost/nginx-health" > /dev/null; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))

        if [ "$response_time" -gt 1000 ]; then
            log_warn "High response time: ${response_time}ms"
            return 1
        fi

        log_info "Response time: ${response_time}ms"
    else
        log_error "Performance validation request failed"
        return 1
    fi

    # Resource usage check
    local cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep go-websocket | awk '{sum += $2} END {print sum/NR}')
    local memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemPerc}}" | grep go-websocket | awk '{sum += $2} END {print sum/NR}')

    if (( $(echo "$cpu_usage > 80" | bc -l 2>/dev/null || echo "0") )); then
        log_warn "High CPU usage: $cpu_usage%"
        return 1
    fi

    if (( $(echo "$memory_usage > 80" | bc -l 2>/dev/null || echo "0") )); then
        log_warn "High memory usage: $memory_usage%"
        return 1
    fi

    log_info "Resource usage - CPU: $cpu_usage%, Memory: $memory_usage%"
    log_info "Performance validation passed"
    return 0
}

# Start monitoring daemon
start_monitoring_daemon() {
    local monitoring_pid_file="$PROJECT_ROOT/deployment/monitoring.pid"

    # Start monitoring in background
    nohup "$PROJECT_ROOT/deployment/monitoring.sh" "start" 30 > /dev/null 2>&1 &
    local monitoring_pid=$!

    echo "$monitoring_pid" > "$monitoring_pid_file"
    log_info "Monitoring daemon started (PID: $monitoring_pid)"
}

# Stop monitoring daemon
stop_monitoring_daemon() {
    local monitoring_pid_file="$PROJECT_ROOT/deployment/monitoring.pid"

    if [ -f "$monitoring_pid_file" ]; then
        local monitoring_pid=$(cat "$monitoring_pid_file")
        if kill -0 "$monitoring_pid" 2>/dev/null; then
            kill "$monitoring_pid"
            log_info "Monitoring daemon stopped (PID: $monitoring_pid)"
        fi
        rm -f "$monitoring_pid_file"
    fi
}

# Blue-green deployment (advanced deployment strategy)
blue_green_deployment() {
    log_info "Executing blue-green deployment strategy..."

    # This is a simplified blue-green deployment
    # In a real scenario, this would involve separate environments

    # Deploy to "green" environment (new replicas)
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --scale go-websocket-server=6

    # Wait for new replicas to be healthy
    sleep 30

    local healthy_replicas=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q go-websocket-server | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")

    if [ "$healthy_replicas" -lt 6 ]; then
        log_error "Blue-green deployment failed: only $healthy_replicas/6 replicas healthy"
        return 1
    fi

    # Scale down to target count (3 replicas)
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --scale go-websocket-server=3

    log_info "Blue-green deployment completed successfully"
    return 0
}

# Emergency rollback
emergency_rollback() {
    log_error "Executing emergency rollback..."

    # Stop monitoring
    stop_monitoring_daemon

    # Create rollback signal
    echo '{"rollback": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "reason": "deployment_failure"}' > "$PROJECT_ROOT/public/rollback-signal.json"

    # Scale down to single replica
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --scale go-websocket-server=1

    # Wait for rollback to complete
    sleep 30

    log_error "Emergency rollback completed"
}

# Cleanup deployment
cleanup_deployment() {
    log_info "Cleaning up deployment..."

    # Stop monitoring
    stop_monitoring_daemon

    # Clean up any temporary files
    rm -f "$PROJECT_ROOT/deployment/monitoring.pid"
    rm -f "$PROJECT_ROOT/public/rollback-signal.json"

    log_info "Deployment cleanup completed"
}

# Display usage information
show_usage() {
    cat <<EOF
Phase 5 Deployment Script

Usage: $0 [MODE] [OPTIONS]

Deployment Modes:
  staged          - Staged rollout (10% → 50% → 100%) [default]
  zero-downtime   - Zero-downtime rolling deployment
  blue-green      - Blue-green deployment strategy

Options:
  --skip-tests    - Skip test execution (faster deployment)
  --monitoring    - Start monitoring only
  --rollback      - Execute emergency rollback
  --status        - Show current deployment status
  --cleanup       - Clean up deployment artifacts

Examples:
  $0 staged                 # Staged rollout with tests
  $0 zero-downtime --skip-tests  # Fast zero-downtime deployment
  $0 --monitoring           # Start monitoring daemon only
  $0 --rollback             # Emergency rollback
  $0 --status               # Show status

Environment Variables:
  SLACK_WEBHOOK_URL         - Slack webhook for alerts
  EMAIL_ALERT_ENABLED       - Enable email alerts (true/false)

EOF
}

# Show deployment status
show_status() {
    log_info "Current Deployment Status"
    log_info "========================"

    # Check service status
    if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps > /dev/null 2>&1; then
        echo
        echo "Service Status:"
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps

        echo
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemPerc}}" | head -n 10

        echo
        echo "Health Check Status:"
        curl -s "http://localhost/nginx-health" 2>/dev/null && echo "✓ Nginx: Healthy" || echo "✗ Nginx: Unhealthy"
        curl -s "http://localhost/ws/health" 2>/dev/null && echo "✓ WebSocket: Healthy" || echo "✗ WebSocket: Unhealthy"
    else
        log_warn "Services are not running"
    fi

    # Check monitoring status
    local monitoring_pid_file="$PROJECT_ROOT/deployment/monitoring.pid"
    if [ -f "$monitoring_pid_file" ]; then
        local monitoring_pid=$(cat "$monitoring_pid_file")
        if kill -0 "$monitoring_pid" 2>/dev/null; then
            echo "✓ Monitoring: Active (PID: $monitoring_pid)"
        else
            echo "✗ Monitoring: Inactive"
        fi
    else
        echo "✗ Monitoring: Not started"
    fi

    # Show recent metrics
    if [ -f "$PROJECT_ROOT/deployment/metrics.json" ]; then
        echo
        echo "Latest Metrics:"
        jq . "$PROJECT_ROOT/deployment/metrics.json" 2>/dev/null || cat "$PROJECT_ROOT/deployment/metrics.json"
    fi
}

# Main function
main() {
    local deployment_mode="staged"
    local skip_tests=false

    # Create deployment log directory
    mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

    # Initialize deployment log
    echo "Phase 5 Deployment Log - $(date)" > "$DEPLOYMENT_LOG"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            staged|zero-downtime|blue-green)
                deployment_mode="$1"
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --monitoring)
                start_monitoring_daemon
                exit 0
                ;;
            --rollback)
                emergency_rollback
                exit 0
                ;;
            --status)
                show_status
                exit 0
                ;;
            --cleanup)
                cleanup_deployment
                exit 0
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Execute deployment
    if deploy_phase5 "$deployment_mode" "$skip_tests"; then
        log_success "Phase 5 deployment completed successfully!"
        exit 0
    else
        log_error "Phase 5 deployment failed!"
        exit 1
    fi
}

# Handle script termination
trap 'cleanup_deployment; exit 1' INT TERM

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi