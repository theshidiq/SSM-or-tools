#!/bin/bash

# Phase 5: Staged Rollout Automation Script
# Implementation of spec from lines 595-608 in IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md
# Supports 10% → 50% → 100% deployment strategy with zero-downtime

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
SERVICE_NAME="go-websocket-server"
HEALTH_CHECK_URL="http://localhost/ws/health"
ROLLBACK_TRIGGERS_FILE="$PROJECT_ROOT/deployment/rollback-triggers.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stage validation function
validate_stage() {
    local stage=$1
    local duration=${2:-60}

    log_info "Validating stage $stage for $duration seconds..."

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local success_count=0
    local total_checks=0

    while [ $(date +%s) -lt $end_time ]; do
        total_checks=$((total_checks + 1))

        # Health check
        if curl -f -s --max-time 5 "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            success_count=$((success_count + 1))
        fi

        # Error rate check (placeholder - would integrate with actual monitoring)
        local error_rate=$(get_error_rate)
        if [ "$error_rate" -gt 5 ]; then
            log_error "Error rate exceeded threshold: $error_rate%"
            return 1
        fi

        # Performance check (placeholder - would integrate with actual metrics)
        local avg_response_time=$(get_avg_response_time)
        if [ "$avg_response_time" -gt 1000 ]; then
            log_error "Average response time exceeded threshold: ${avg_response_time}ms"
            return 1
        fi

        sleep 5
    done

    local success_rate=$((success_count * 100 / total_checks))

    if [ "$success_rate" -lt 95 ]; then
        log_error "Health check success rate too low: $success_rate%"
        return 1
    fi

    log_success "Stage $stage validation passed (${success_rate}% success rate)"
    return 0
}

# Placeholder functions for metrics (would integrate with actual monitoring system)
get_error_rate() {
    # Placeholder: would query actual monitoring system
    echo "2"
}

get_avg_response_time() {
    # Placeholder: would query actual monitoring system
    echo "450"
}

# Deploy specific number of replicas
deploy_replicas() {
    local replica_count=$1
    local stage_name=$2

    log_info "Deploying $replica_count replicas for $stage_name..."

    # Update docker-compose.yml with new replica count
    sed -i.bak "s/replicas: [0-9]*/replicas: $replica_count/" "$COMPOSE_FILE"

    # Deploy with rolling update
    docker-compose -f "$COMPOSE_FILE" up -d --scale "$SERVICE_NAME=$replica_count"

    # Wait for deployment to stabilize
    log_info "Waiting for deployment to stabilize..."
    sleep 30

    # Verify all replicas are healthy
    local healthy_replicas=0
    for i in {1..60}; do
        healthy_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | xargs docker inspect --format='{{.State.Health.Status}}' | grep -c "healthy" || echo "0")

        if [ "$healthy_replicas" -eq "$replica_count" ]; then
            log_success "All $replica_count replicas are healthy"
            return 0
        fi

        log_info "Waiting for replicas to become healthy ($healthy_replicas/$replica_count ready)..."
        sleep 5
    done

    log_error "Deployment failed: only $healthy_replicas/$replica_count replicas are healthy"
    return 1
}

# Emergency rollback function
emergency_rollback() {
    log_error "Initiating emergency rollback..."

    # Restore previous docker-compose configuration
    if [ -f "$COMPOSE_FILE.bak" ]; then
        mv "$COMPOSE_FILE.bak" "$COMPOSE_FILE"
        log_info "Restored previous docker-compose configuration"
    fi

    # Scale back to previous configuration
    docker-compose -f "$COMPOSE_FILE" up -d --scale "$SERVICE_NAME=1"

    # Trigger React feature flag rollback
    trigger_feature_flag_rollback

    log_success "Emergency rollback completed"
}

# Trigger React feature flag rollback
trigger_feature_flag_rollback() {
    log_info "Triggering React feature flag rollback..."

    # Create rollback signal file that React app can detect
    echo '{"rollback": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$PROJECT_ROOT/public/rollback-signal.json"

    log_success "Feature flag rollback signal created"
}

# Main staged rollout function
main() {
    local stage=${1:-"all"}

    log_info "Starting Phase 5 staged rollout - Strategy: $stage"

    # Backup current configuration
    cp "$COMPOSE_FILE" "$COMPOSE_FILE.backup"

    case $stage in
        "stage1"|"10%"|"all")
            log_info "=== STAGE 1: 10% Rollout ==="
            if ! deploy_replicas 1 "Stage 1 (10%)"; then
                emergency_rollback
                exit 1
            fi

            if ! validate_stage "1" 120; then
                emergency_rollback
                exit 1
            fi

            log_success "Stage 1 (10%) completed successfully"

            if [ "$stage" != "all" ]; then
                exit 0
            fi
            ;;
    esac

    case $stage in
        "stage2"|"50%"|"all")
            log_info "=== STAGE 2: 50% Rollout ==="
            if ! deploy_replicas 2 "Stage 2 (50%)"; then
                emergency_rollback
                exit 1
            fi

            if ! validate_stage "2" 180; then
                emergency_rollback
                exit 1
            fi

            log_success "Stage 2 (50%) completed successfully"

            if [ "$stage" != "all" ]; then
                exit 0
            fi
            ;;
    esac

    case $stage in
        "stage3"|"100%"|"all")
            log_info "=== STAGE 3: 100% Rollout ==="
            if ! deploy_replicas 3 "Stage 3 (100%)"; then
                emergency_rollback
                exit 1
            fi

            if ! validate_stage "3" 300; then
                emergency_rollback
                exit 1
            fi

            log_success "Stage 3 (100%) completed successfully"
            ;;
    esac

    # Clean up backup files
    rm -f "$COMPOSE_FILE.bak" "$COMPOSE_FILE.backup"

    log_success "Phase 5 staged rollout completed successfully!"
    log_info "All users have been migrated to the new Go WebSocket backend"
}

# Handle script termination
trap 'log_error "Rollout interrupted"; emergency_rollback; exit 1' INT TERM

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi