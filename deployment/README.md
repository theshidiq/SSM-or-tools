# Phase 5: Production Deployment & Migration

This directory contains the complete Phase 5 production deployment and migration system implementation according to the IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md.

## Overview

Phase 5 implements:
- **Production Docker Configuration**: 3 Go WebSocket server replicas with resource limits
- **NGINX WebSocket Proxy**: Load balancing with sticky sessions and health checks
- **Staged Rollout Strategy**: 10% → 50% → 100% deployment with validation
- **Zero-Downtime Deployment**: Rolling updates with continuous health monitoring
- **Emergency Rollback System**: Automated rollback triggers with React feature flags
- **Comprehensive Monitoring**: Real-time metrics, alerting, and performance validation

## Quick Start

### 1. Deploy with Staged Rollout (Recommended)
```bash
./deployment/deploy-phase5.sh staged
```

### 2. Deploy with Zero-Downtime Strategy
```bash
./deployment/deploy-phase5.sh zero-downtime
```

### 3. Fast Deployment (Skip Tests)
```bash
./deployment/deploy-phase5.sh staged --skip-tests
```

## Deployment Scripts

### Core Deployment Scripts

#### `deploy-phase5.sh` - Master Orchestration Script
The main deployment orchestrator that manages the complete Phase 5 migration process.

**Usage:**
```bash
./deploy-phase5.sh [MODE] [OPTIONS]

Modes:
  staged          # 10% → 50% → 100% rollout (default)
  zero-downtime   # Rolling deployment
  blue-green      # Blue-green deployment

Options:
  --skip-tests    # Skip test execution
  --monitoring    # Start monitoring only
  --rollback      # Emergency rollback
  --status        # Show deployment status
  --cleanup       # Clean up artifacts
```

#### `staged-rollout.sh` - Staged Deployment Strategy
Implements the 10% → 50% → 100% rollout strategy with validation at each stage.

**Usage:**
```bash
./staged-rollout.sh [STAGE]

Stages:
  stage1 / 10%    # Deploy 1 replica (10%)
  stage2 / 50%    # Deploy 2 replicas (50%)
  stage3 / 100%   # Deploy 3 replicas (100%)
  all             # Complete staged rollout (default)
```

#### `zero-downtime-deploy.sh` - Zero-Downtime Deployment
Rolling deployment that maintains service availability throughout the update process.

**Usage:**
```bash
./zero-downtime-deploy.sh [SKIP_BUILD]

Arguments:
  SKIP_BUILD      # true to skip image building (default: false)
```

#### `monitoring.sh` - Comprehensive Monitoring System
Real-time monitoring with metrics collection, alerting, and health validation.

**Usage:**
```bash
./monitoring.sh [COMMAND] [INTERVAL]

Commands:
  start [interval] # Start continuous monitoring (default: 30s)
  check           # Single monitoring check
  metrics         # Show current metrics
  logs            # Tail monitoring logs
  alerts          # Tail alert logs
```

#### `test-migration.sh` - Migration Test Suite
Comprehensive test suite validating all migration components and rollback procedures.

**Usage:**
```bash
./test-migration.sh [MODE]

Modes:
  all        # Complete test suite (default)
  quick      # Essential tests only
  rollback   # Rollback procedure tests
  deployment # Deployment process tests
```

## Configuration Files

### Docker Configuration

#### `docker-compose.yml` - Production Configuration
- **Go WebSocket Server**: 3 replicas with 512M memory, 1.0 CPU limits
- **Resource Management**: Memory reservations and CPU limits per spec
- **Health Checks**: 30s intervals, 5s timeout, 3 retries
- **Networks**: Isolated backend and monitoring networks

#### `nginx/websocket.conf` - WebSocket Proxy Configuration
- **Load Balancing**: IP hash for sticky sessions
- **WebSocket Headers**: Upgrade, Connection, and proxy headers
- **Timeouts**: 10s connect, 300s send/read timeouts
- **Rate Limiting**: 20 requests/second with burst capacity

### React Integration

#### `src/hooks/useEmergencyRollback.js` - Emergency Rollback Hook
React hook providing:
- **Feature Flag Management**: Dynamic feature flag control
- **Rollback Triggers**: Automated rollback based on thresholds
- **Metric Recording**: Performance and error tracking
- **Manual Rollback**: User-initiated rollback capability

## Monitoring & Alerting

### Real-time Monitoring
The monitoring system tracks:
- **Container Health**: CPU, memory, and health status
- **WebSocket Performance**: Response times and connection counts
- **Error Rates**: Application and infrastructure errors
- **Resource Usage**: System resource utilization

### Alert Thresholds
- **CPU Usage**: > 80%
- **Memory Usage**: > 80%
- **Error Rate**: > 5%
- **Response Time**: > 1000ms
- **WebSocket Connections**: > 100

### External Integrations
- **Slack Alerts**: Configure `SLACK_WEBHOOK_URL` environment variable
- **Email Alerts**: Set `EMAIL_ALERT_ENABLED=true`
- **Prometheus Metrics**: Available on port 9091
- **Grafana Dashboard**: Available on port 3000

## Rollback Procedures

### Automated Rollback Triggers
1. **Error Rate Threshold**: > 5 errors in 1 minute
2. **Connection Failures**: > 10 consecutive failures
3. **Response Time**: > 5 seconds average
4. **Health Check Failures**: > 3 consecutive failures

### Manual Rollback
```bash
# Emergency rollback via deployment script
./deploy-phase5.sh --rollback

# Or via staged rollout script
./staged-rollout.sh # Will detect issues and auto-rollback
```

### React Feature Flag Rollback
The React application automatically detects rollback signals and:
1. Disables Go WebSocket backend
2. Enables fallback mode (original system)
3. Updates feature flags in localStorage and Supabase
4. Reloads the application for clean state

## Testing

### Pre-deployment Testing
```bash
# Quick validation tests
./test-migration.sh quick

# Full test suite
./test-migration.sh all
```

### Test Coverage
1. **Docker Environment Setup**
2. **Initial Deployment Validation**
3. **Health Check Endpoints**
4. **WebSocket Connectivity**
5. **Load Balancing Verification**
6. **Staged Rollout Process**
7. **Emergency Rollback Procedures**
8. **Zero-Downtime Deployment**
9. **Monitoring and Alerting**
10. **Full Migration Simulation**

### Test Reports
Tests generate HTML reports in `deployment/test-report.html` with:
- Test execution summary
- Pass/fail status for each test
- Performance metrics
- Rollback validation results

## Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker status
docker info

# Validate docker-compose configuration
docker-compose config

# View service logs
docker-compose logs go-websocket-server
```

#### Health Checks Failing
```bash
# Test endpoints manually
curl http://localhost/nginx-health
curl http://localhost/ws/health

# Check container health
docker-compose ps
docker inspect <container_id>
```

#### Rollback Not Working
```bash
# Check rollback signal file
cat public/rollback-signal.json

# Verify feature flags
cat deployment/test-feature-flags.json

# Manual feature flag reset
echo '{"go_websocket_enabled": false, "fallback_mode_enabled": true}' > public/rollback-signal.json
```

### Log Locations
- **Deployment Logs**: `deployment/phase5-deployment.log`
- **Monitoring Logs**: `deployment/monitoring.log`
- **Alert Logs**: `deployment/alerts.log`
- **Test Results**: `deployment/test-results.log`
- **Metrics**: `deployment/metrics.json`

### Performance Tuning

#### Resource Limits
Adjust in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Increase for high load
      cpus: '1.0'   # Increase for CPU-intensive workloads
```

#### Connection Limits
Modify environment variables:
```yaml
environment:
  - MAX_CONNECTIONS=1000        # WebSocket connection limit
  - WEBSOCKET_READ_BUFFER_SIZE=1024
  - WEBSOCKET_WRITE_BUFFER_SIZE=1024
```

## Production Checklist

### Before Deployment
- [ ] Verify all scripts are executable
- [ ] Test docker-compose configuration
- [ ] Run quick test suite
- [ ] Configure monitoring alerts
- [ ] Backup current configuration
- [ ] Verify rollback procedures

### During Deployment
- [ ] Monitor deployment logs
- [ ] Watch service health checks
- [ ] Validate each rollout stage
- [ ] Monitor performance metrics
- [ ] Verify WebSocket connectivity

### After Deployment
- [ ] Run full test suite
- [ ] Validate all endpoints
- [ ] Check monitoring dashboards
- [ ] Test rollback procedures
- [ ] Update documentation
- [ ] Monitor for 24 hours

## Security Considerations

### Network Security
- Backend services isolated in internal networks
- Rate limiting on WebSocket endpoints
- Security headers in NGINX configuration

### Container Security
- Non-root user execution
- Resource limits prevent DoS
- Health checks ensure service availability
- Minimal attack surface with Alpine images

### Feature Flag Security
- Feature flags stored in Supabase with authentication
- Local storage as fallback only
- Rollback signals signed and timestamped

## Maintenance

### Regular Tasks
- Review deployment logs weekly
- Update monitoring thresholds based on usage
- Test rollback procedures monthly
- Update container images quarterly

### Capacity Planning
- Monitor resource usage trends
- Scale replicas based on load patterns
- Adjust rate limits for growth
- Plan hardware upgrades proactively

## Support

For issues with Phase 5 deployment:
1. Check deployment logs in `deployment/` directory
2. Run diagnostic tests with `./test-migration.sh quick`
3. Review monitoring metrics with `./monitoring.sh metrics`
4. Execute emergency rollback if needed: `./deploy-phase5.sh --rollback`

## Architecture Compliance

This implementation follows the exact specifications from IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md:
- **Lines 524-559**: Docker production configuration with 3 replicas and resource limits
- **Lines 561-593**: NGINX WebSocket proxy with load balancing and proper headers
- **Lines 595-608**: Staged rollout strategy with validation at each stage
- **Lines 609-624**: Emergency rollback procedures with React feature flags
- **Lines 626-632**: All required deliverables implemented
- **Lines 633-639**: Success criteria validation included in test suite