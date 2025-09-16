#!/bin/bash

# Phase 5: Zero-Downtime Deployment Automation
# Implementation of deployment automation with zero-downtime capabilities

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
SERVICE_NAME="go-websocket-server"
NGINX_SERVICE="nginx"
HEALTH_CHECK_URL="http://localhost/ws/health"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment/deployment.log"

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

# Pre-deployment health check
pre_deployment_check() {
    log_info "Running pre-deployment health checks..."

    # Check Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        return 1
    fi

    # Check docker-compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.yml not found at $COMPOSE_FILE"
        return 1
    fi

    # Check current service health
    local healthy_services=$(docker-compose -f "$COMPOSE_FILE" ps -q | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")
    log_info "Currently healthy services: $healthy_services"

    # Verify nginx configuration
    if ! docker-compose -f "$COMPOSE_FILE" exec -T "$NGINX_SERVICE" nginx -t > /dev/null 2>&1; then
        log_warn "Nginx configuration test failed"
    fi

    log_success "Pre-deployment checks completed"
    return 0
}

# Build new images
build_images() {
    log_info "Building new Docker images..."

    # Build Go WebSocket server image
    if ! docker-compose -f "$COMPOSE_FILE" build "$SERVICE_NAME"; then
        log_error "Failed to build $SERVICE_NAME image"
        return 1
    fi

    # Build nginx image if needed
    if ! docker-compose -f "$COMPOSE_FILE" build "$NGINX_SERVICE"; then
        log_error "Failed to build $NGINX_SERVICE image"
        return 1
    fi

    log_success "Docker images built successfully"
    return 0
}

# Rolling deployment with zero downtime
rolling_deploy() {
    log_info "Starting rolling deployment..."

    # Get current replica count
    local current_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | wc -l | tr -d ' ')
    log_info "Current replicas: $current_replicas"

    # Deploy one replica at a time
    for ((i=1; i<=current_replicas; i++)); do
        log_info "Deploying replica $i/$current_replicas..."

        # Stop one replica
        local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | head -n1)
        if [ -n "$container_id" ]; then
            docker stop "$container_id"
            log_info "Stopped container: $container_id"
        fi

        # Start new replica
        docker-compose -f "$COMPOSE_FILE" up -d --scale "$SERVICE_NAME=$current_replicas"

        # Wait for new replica to be healthy
        local attempts=0
        while [ $attempts -lt 30 ]; do
            local healthy_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")

            if [ "$healthy_replicas" -eq "$current_replicas" ]; then
                log_success "Replica $i is healthy"
                break
            fi

            attempts=$((attempts + 1))
            log_info "Waiting for replica $i to become healthy... (attempt $attempts/30)"
            sleep 10
        done

        if [ $attempts -eq 30 ]; then
            log_error "Replica $i failed to become healthy within timeout"
            return 1
        fi

        # Verify service connectivity
        if ! curl -f -s --max-time 5 "$HEALTH_CHECK_URL" > /dev/null; then
            log_error "Service health check failed after deploying replica $i"
            return 1
        fi

        # Brief pause between deployments
        sleep 5
    done

    log_success "Rolling deployment completed successfully"
    return 0
}

# Post-deployment validation
post_deployment_validation() {
    log_info "Running post-deployment validation..."

    # Wait for all services to stabilize
    sleep 30

    # Check all replicas are healthy
    local healthy_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy" || echo "0")
    local total_replicas=$(docker-compose -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME" | wc -l | tr -d ' ')

    if [ "$healthy_replicas" -ne "$total_replicas" ]; then
        log_error "Not all replicas are healthy: $healthy_replicas/$total_replicas"
        return 1
    fi

    # Perform load test
    log_info "Performing connection test..."
    for i in {1..10}; do
        if ! curl -f -s --max-time 5 "$HEALTH_CHECK_URL" > /dev/null; then
            log_error "Health check failed on attempt $i"
            return 1
        fi
    done

    # Check nginx is properly routing
    if ! curl -f -s --max-time 5 "http://localhost/nginx-health" > /dev/null; then
        log_error "Nginx health check failed"
        return 1
    fi

    log_success "Post-deployment validation passed"
    return 0
}

# Rollback on failure
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."

    # Get previous image tags (simplified - in real scenario would use proper tagging)
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" up -d

    # Wait for rollback to complete
    sleep 30

    # Verify rollback
    if curl -f -s --max-time 5 "$HEALTH_CHECK_URL" > /dev/null; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback verification failed"
    fi
}

# Main deployment function
main() {
    local skip_build=${1:-false}

    log_info "Starting zero-downtime deployment..."
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting deployment" >> "$DEPLOYMENT_LOG"

    # Create deployment log directory
    mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

    # Pre-deployment checks
    if ! pre_deployment_check; then
        log_error "Pre-deployment checks failed"
        exit 1
    fi

    # Build images unless skipped
    if [ "$skip_build" != "true" ]; then
        if ! build_images; then
            log_error "Image build failed"
            exit 1
        fi
    fi

    # Perform rolling deployment
    if ! rolling_deploy; then
        log_error "Rolling deployment failed"
        rollback_deployment
        exit 1
    fi

    # Post-deployment validation
    if ! post_deployment_validation; then
        log_error "Post-deployment validation failed"
        rollback_deployment
        exit 1
    fi

    log_success "Zero-downtime deployment completed successfully!"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployment completed successfully" >> "$DEPLOYMENT_LOG"
}

# Handle script termination
trap 'log_error "Deployment interrupted"; rollback_deployment; exit 1' INT TERM

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi