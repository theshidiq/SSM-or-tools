#!/bin/bash

# Phase 5: Comprehensive Monitoring and Alerting for Migration
# Real-time monitoring of deployment health and performance metrics

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
MONITORING_LOG="$PROJECT_ROOT/deployment/monitoring.log"
ALERT_LOG="$PROJECT_ROOT/deployment/alerts.log"
METRICS_FILE="$PROJECT_ROOT/deployment/metrics.json"

# Monitoring thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
ERROR_RATE_THRESHOLD=5
RESPONSE_TIME_THRESHOLD=1000
WEBSOCKET_CONNECTION_THRESHOLD=100

# Alert configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_ALERT_ENABLED="${EMAIL_ALERT_ENABLED:-false}"
ALERT_COOLDOWN=300  # 5 minutes cooldown between similar alerts

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
    echo "$msg" >> "$MONITORING_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$MONITORING_LOG"
}

log_warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$MONITORING_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$MONITORING_LOG"
}

log_alert() {
    local level="$1"
    local msg="$2"
    local alert_msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $msg"
    echo -e "${RED}$alert_msg${NC}"
    echo "$alert_msg" >> "$ALERT_LOG"

    # Send external alerts
    send_slack_alert "$level" "$msg"
    send_email_alert "$level" "$msg"
}

# Get container metrics
get_container_metrics() {
    local service_name="$1"
    local container_ids=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service_name" 2>/dev/null || echo "")

    if [ -z "$container_ids" ]; then
        echo "null"
        return
    fi

    local total_cpu=0
    local total_memory=0
    local container_count=0
    local healthy_count=0

    for container_id in $container_ids; do
        if [ -n "$container_id" ]; then
            # Get CPU and memory stats
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}}" "$container_id" 2>/dev/null || echo "0.00%,0.00%")
            local cpu=$(echo "$stats" | cut -d',' -f1 | tr -d '%')
            local memory=$(echo "$stats" | cut -d',' -f2 | tr -d '%')

            # Get health status
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "unknown")

            if [ "$health" = "healthy" ]; then
                healthy_count=$((healthy_count + 1))
            fi

            total_cpu=$(echo "$total_cpu + $cpu" | bc -l 2>/dev/null || echo "$total_cpu")
            total_memory=$(echo "$total_memory + $memory" | bc -l 2>/dev/null || echo "$total_memory")
            container_count=$((container_count + 1))
        fi
    done

    if [ $container_count -eq 0 ]; then
        echo "null"
        return
    fi

    local avg_cpu=$(echo "scale=2; $total_cpu / $container_count" | bc -l 2>/dev/null || echo "0")
    local avg_memory=$(echo "scale=2; $total_memory / $container_count" | bc -l 2>/dev/null || echo "0")

    echo "{\"cpu\":$avg_cpu,\"memory\":$avg_memory,\"containers\":$container_count,\"healthy\":$healthy_count}"
}

# Check WebSocket connections
check_websocket_health() {
    local endpoint="http://localhost/ws/health"
    local start_time=$(date +%s%3N)

    local response=$(curl -f -s --max-time 5 "$endpoint" 2>/dev/null || echo "ERROR")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))

    if [ "$response" = "ERROR" ]; then
        echo "{\"status\":\"error\",\"response_time\":null,\"connections\":0}"
    else
        # Parse connection count from response (assuming JSON response with connection info)
        local connections=$(echo "$response" | jq -r '.connections // 0' 2>/dev/null || echo "0")
        echo "{\"status\":\"healthy\",\"response_time\":$response_time,\"connections\":$connections}"
    fi
}

# Check application health
check_application_health() {
    local app_endpoint="http://localhost/nginx-health"
    local start_time=$(date +%s%3N)

    local response=$(curl -f -s --max-time 5 "$app_endpoint" 2>/dev/null || echo "ERROR")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))

    if [ "$response" = "ERROR" ]; then
        echo "{\"status\":\"error\",\"response_time\":null}"
    else
        echo "{\"status\":\"healthy\",\"response_time\":$response_time}"
    fi
}

# Analyze error logs
analyze_error_logs() {
    # Get recent error count from nginx logs
    local nginx_errors=0
    if [ -f "/var/log/nginx/error.log" ]; then
        nginx_errors=$(tail -n 100 /var/log/nginx/error.log 2>/dev/null | grep "$(date '+%Y/%m/%d')" | wc -l | tr -d ' ')
    fi

    # Get Go server errors from docker logs
    local go_errors=0
    local go_containers=$(docker-compose -f "$COMPOSE_FILE" ps -q go-websocket-server 2>/dev/null || echo "")
    if [ -n "$go_containers" ]; then
        for container in $go_containers; do
            local container_errors=$(docker logs --since="1m" "$container" 2>&1 | grep -i "error\|panic\|fatal" | wc -l | tr -d ' ')
            go_errors=$((go_errors + container_errors))
        done
    fi

    echo "{\"nginx_errors\":$nginx_errors,\"go_server_errors\":$go_errors,\"total_errors\":$((nginx_errors + go_errors))}"
}

# Send Slack alert
send_slack_alert() {
    local level="$1"
    local message="$2"

    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        return
    fi

    local color="danger"
    if [ "$level" = "WARN" ]; then
        color="warning"
    elif [ "$level" = "INFO" ]; then
        color="good"
    fi

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Shift Schedule Manager Alert",
            "text": "$message",
            "fields": [
                {
                    "title": "Level",
                    "value": "$level",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date '+%Y-%m-%d %H:%M:%S')",
                    "short": true
                }
            ]
        }
    ]
}
EOF
    )

    curl -X POST -H 'Content-type: application/json' \
         --data "$payload" \
         "$SLACK_WEBHOOK_URL" \
         >/dev/null 2>&1 || true
}

# Send email alert (placeholder - would integrate with actual email service)
send_email_alert() {
    local level="$1"
    local message="$2"

    if [ "$EMAIL_ALERT_ENABLED" != "true" ]; then
        return
    fi

    # Placeholder for email integration
    log_info "Email alert would be sent: [$level] $message"
}

# Check alert cooldown
should_send_alert() {
    local alert_type="$1"
    local cooldown_file="$PROJECT_ROOT/deployment/.alert_cooldown_$alert_type"

    if [ -f "$cooldown_file" ]; then
        local last_alert=$(cat "$cooldown_file")
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_alert))

        if [ $time_diff -lt $ALERT_COOLDOWN ]; then
            return 1
        fi
    fi

    echo "$(date +%s)" > "$cooldown_file"
    return 0
}

# Comprehensive monitoring check
run_monitoring_check() {
    log_info "Running comprehensive monitoring check..."

    # Initialize metrics
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local overall_status="healthy"
    local alerts=()

    # Check Go WebSocket server metrics
    log_info "Checking Go WebSocket server metrics..."
    local go_metrics=$(get_container_metrics "go-websocket-server")

    if [ "$go_metrics" = "null" ]; then
        overall_status="critical"
        alerts+=("Go WebSocket servers are not running")
        if should_send_alert "go_server_down"; then
            log_alert "CRITICAL" "Go WebSocket servers are not running"
        fi
    else
        local go_cpu=$(echo "$go_metrics" | jq -r '.cpu')
        local go_memory=$(echo "$go_metrics" | jq -r '.memory')
        local go_containers=$(echo "$go_metrics" | jq -r '.containers')
        local go_healthy=$(echo "$go_metrics" | jq -r '.healthy')

        # Check resource thresholds
        if (( $(echo "$go_cpu > $CPU_THRESHOLD" | bc -l) )); then
            alerts+=("Go server CPU usage high: ${go_cpu}%")
            if should_send_alert "go_cpu_high"; then
                log_alert "WARN" "Go server CPU usage high: ${go_cpu}%"
            fi
        fi

        if (( $(echo "$go_memory > $MEMORY_THRESHOLD" | bc -l) )); then
            alerts+=("Go server memory usage high: ${go_memory}%")
            if should_send_alert "go_memory_high"; then
                log_alert "WARN" "Go server memory usage high: ${go_memory}%"
            fi
        fi

        # Check healthy replicas
        if [ "$go_healthy" -lt "$go_containers" ]; then
            overall_status="degraded"
            alerts+=("Some Go server replicas are unhealthy: $go_healthy/$go_containers")
            if should_send_alert "go_replica_unhealthy"; then
                log_alert "ERROR" "Some Go server replicas are unhealthy: $go_healthy/$go_containers"
            fi
        fi

        log_info "Go servers: $go_healthy/$go_containers healthy, CPU: ${go_cpu}%, Memory: ${go_memory}%"
    fi

    # Check WebSocket connectivity
    log_info "Checking WebSocket connectivity..."
    local websocket_health=$(check_websocket_health)
    local ws_status=$(echo "$websocket_health" | jq -r '.status')
    local ws_response_time=$(echo "$websocket_health" | jq -r '.response_time')
    local ws_connections=$(echo "$websocket_health" | jq -r '.connections')

    if [ "$ws_status" = "error" ]; then
        overall_status="critical"
        alerts+=("WebSocket endpoint is not responding")
        if should_send_alert "websocket_down"; then
            log_alert "CRITICAL" "WebSocket endpoint is not responding"
        fi
    else
        if [ "$ws_response_time" != "null" ] && [ "$ws_response_time" -gt $RESPONSE_TIME_THRESHOLD ]; then
            alerts+=("WebSocket response time high: ${ws_response_time}ms")
            if should_send_alert "websocket_slow"; then
                log_alert "WARN" "WebSocket response time high: ${ws_response_time}ms"
            fi
        fi

        log_info "WebSocket: $ws_status, Response time: ${ws_response_time}ms, Connections: $ws_connections"
    fi

    # Check application health
    log_info "Checking application health..."
    local app_health=$(check_application_health)
    local app_status=$(echo "$app_health" | jq -r '.status')
    local app_response_time=$(echo "$app_health" | jq -r '.response_time')

    if [ "$app_status" = "error" ]; then
        overall_status="critical"
        alerts+=("Application endpoint is not responding")
        if should_send_alert "app_down"; then
            log_alert "CRITICAL" "Application endpoint is not responding"
        fi
    else
        log_info "Application: $app_status, Response time: ${app_response_time}ms"
    fi

    # Analyze error logs
    log_info "Analyzing error logs..."
    local error_analysis=$(analyze_error_logs)
    local total_errors=$(echo "$error_analysis" | jq -r '.total_errors')

    if [ "$total_errors" -gt $ERROR_RATE_THRESHOLD ]; then
        overall_status="degraded"
        alerts+=("High error rate detected: $total_errors errors in last minute")
        if should_send_alert "high_error_rate"; then
            log_alert "ERROR" "High error rate detected: $total_errors errors in last minute"
        fi
    fi

    log_info "Error analysis: $total_errors total errors in last minute"

    # Save metrics to file
    local metrics_json=$(cat <<EOF
{
    "timestamp": "$timestamp",
    "overall_status": "$overall_status",
    "go_websocket_server": $go_metrics,
    "websocket_health": $websocket_health,
    "application_health": $app_health,
    "error_analysis": $error_analysis,
    "alerts": [$(printf '"%s",' "${alerts[@]}" | sed 's/,$//')]
}
EOF
    )

    echo "$metrics_json" > "$METRICS_FILE"

    # Log summary
    if [ ${#alerts[@]} -eq 0 ]; then
        log_success "All systems healthy - Status: $overall_status"
    else
        log_warn "Detected ${#alerts[@]} issues - Status: $overall_status"
        for alert in "${alerts[@]}"; do
            log_warn "  - $alert"
        done
    fi
}

# Continuous monitoring loop
start_monitoring() {
    local interval=${1:-30}  # Default 30 seconds

    log_info "Starting continuous monitoring (interval: ${interval}s)..."

    # Create monitoring directories
    mkdir -p "$(dirname "$MONITORING_LOG")"
    mkdir -p "$(dirname "$ALERT_LOG")"
    mkdir -p "$(dirname "$METRICS_FILE")"

    while true; do
        run_monitoring_check
        sleep "$interval"
    done
}

# Display current metrics
show_metrics() {
    if [ -f "$METRICS_FILE" ]; then
        echo "Current System Metrics:"
        echo "======================"
        jq . "$METRICS_FILE" 2>/dev/null || cat "$METRICS_FILE"
    else
        echo "No metrics file found. Run monitoring first."
    fi
}

# Main function
main() {
    local command=${1:-"check"}
    local interval=${2:-30}

    case $command in
        "start")
            start_monitoring "$interval"
            ;;
        "check")
            run_monitoring_check
            ;;
        "metrics")
            show_metrics
            ;;
        "logs")
            if [ -f "$MONITORING_LOG" ]; then
                tail -f "$MONITORING_LOG"
            else
                echo "No monitoring log found."
            fi
            ;;
        "alerts")
            if [ -f "$ALERT_LOG" ]; then
                tail -f "$ALERT_LOG"
            else
                echo "No alert log found."
            fi
            ;;
        *)
            echo "Usage: $0 {start|check|metrics|logs|alerts} [interval]"
            echo "  start [interval]  - Start continuous monitoring (default: 30s)"
            echo "  check            - Run single monitoring check"
            echo "  metrics          - Show current metrics"
            echo "  logs             - Tail monitoring logs"
            echo "  alerts           - Tail alert logs"
            exit 1
            ;;
    esac
}

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi