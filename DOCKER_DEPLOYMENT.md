# Docker Deployment Guide for AI-Powered Shift Schedule Manager

This guide provides comprehensive instructions for deploying the AI-powered shift schedule manager using Docker and Docker Compose with production-ready scaling capabilities.

## Architecture Overview

The application consists of:
- **React Client**: TensorFlow.js-powered frontend with AI components
- **Express.js AI Server**: TensorFlow.js Node.js backend for ML processing
- **Nginx**: Reverse proxy and static file server
- **Redis**: Caching layer for performance
- **PostgreSQL**: Optional database (can use Supabase instead)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 8GB RAM for production deployment
- At least 4 CPU cores recommended for AI workloads

## Quick Start

### Development Environment

1. **Clone and setup environment variables:**
```bash
cp .env.development .env
# Edit .env with your configuration
```

2. **Start development environment:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - AI Server: http://localhost:3001
   - Database: localhost:5432 (if using PostgreSQL)

### Production Environment

1. **Setup environment variables:**
```bash
cp .env.production .env
# Edit .env with your production values
```

2. **Build and deploy:**
```bash
docker-compose up -d
```

3. **Access the application:**
   - Application: http://localhost (port 80)
   - Monitoring: http://localhost:9090 (Prometheus)
   - Metrics: http://localhost:3000 (Grafana)

## Detailed Configuration

### Environment Variables

#### Required for Production

```env
# API Configuration
REACT_APP_API_BASE_URL=https://your-domain.com/api
CORS_ORIGIN=https://your-domain.com

# Database (if not using Supabase)
POSTGRES_PASSWORD=your-secure-password

# Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
```

#### Optional External Services

```env
# Supabase Integration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Google Services
REACT_APP_GOOGLE_VISION_API_KEY=your-api-key
REACT_APP_GOOGLE_SHEETS_API_KEY=your-api-key
```

### TensorFlow.js Optimization

The deployment includes several optimizations for TensorFlow.js:

#### Client Optimization
- **WebGL Backend**: Enabled by default for GPU acceleration
- **Model Caching**: TensorFlow.js models cached in Docker volumes
- **Memory Management**: Optimized memory allocation for large models

#### Server Optimization
- **Native Bindings**: Built with `--build-from-source` for optimal performance
- **CPU Backend**: TensorFlow Node.js with native CPU optimizations
- **Memory Allocation**: 4GB heap size for production workloads
- **Thread Pool**: UV_THREADPOOL_SIZE=4 for better concurrency

### Scaling Configuration

#### Horizontal Scaling

Scale AI servers based on load:

```bash
# Scale to 5 AI server instances
docker-compose up -d --scale ai-server=5

# Or modify docker-compose.yml:
services:
  ai-server:
    deploy:
      replicas: 5
```

#### Load Balancing

Nginx automatically load balances requests across AI server instances:
- **Algorithm**: Least connections (optimal for AI workloads)
- **Health Checks**: Automatic failover for unhealthy instances
- **Connection Pooling**: Keepalive connections for better performance

#### Resource Allocation

Adjust resources per service in `docker-compose.yml`:

```yaml
services:
  ai-server:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'
```

## Production Deployment Strategies

### 1. Single Server Deployment

For small to medium workloads on a single server:

```bash
# Standard deployment with 2 AI servers
docker-compose up -d

# Monitor resource usage
docker stats

# View logs
docker-compose logs -f ai-server
```

### 2. High-Availability Deployment

For production workloads requiring high availability:

```bash
# Deploy with monitoring stack
docker-compose --profile monitoring up -d

# Scale AI servers based on load
docker-compose up -d --scale ai-server=3

# Enable database backup
docker-compose --profile database up -d
```

### 3. Development to Production Migration

```bash
# 1. Test in development
docker-compose -f docker-compose.dev.yml up -d

# 2. Run tests
docker-compose -f docker-compose.dev.yml exec ai-server-dev npm test

# 3. Build production images
docker-compose build

# 4. Deploy to production
docker-compose up -d
```

## Monitoring and Maintenance

### Health Checks

All services include comprehensive health checks:

```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect shift-schedule-nginx --format='{{.State.Health}}'
```

### Performance Monitoring

With the monitoring profile enabled:

1. **Prometheus**: Metrics collection at http://localhost:9090
2. **Grafana**: Dashboards at http://localhost:3000
3. **Log Aggregation**: Loki for centralized logging

### Resource Monitoring

```bash
# Monitor resource usage
docker stats

# Monitor AI server performance
docker-compose exec ai-server top

# Check TensorFlow.js memory usage
docker-compose logs ai-server | grep "Memory"
```

### Backup and Recovery

#### Database Backup (if using PostgreSQL)

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres shift_schedule > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres shift_schedule < backup.sql
```

#### Volume Backup

```bash
# Backup TensorFlow.js model cache
docker run --rm -v shift-schedule-manager_tf_models_cache:/data -v $(pwd):/backup alpine tar czf /backup/models-backup.tar.gz /data

# Restore models cache
docker run --rm -v shift-schedule-manager_tf_models_cache:/data -v $(pwd):/backup alpine tar xzf /backup/models-backup.tar.gz -C /
```

## Troubleshooting

### Common Issues

#### 1. TensorFlow.js Build Failures

```bash
# Rebuild with verbose logging
docker-compose build --no-cache --progress=plain ai-server

# Check native dependencies
docker-compose exec ai-server npm list @tensorflow/tfjs-node
```

#### 2. High Memory Usage

```bash
# Monitor memory usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Adjust memory limits in docker-compose.yml
services:
  ai-server:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048  # Reduce if needed
```

#### 3. Load Balancing Issues

```bash
# Check nginx upstream status
docker-compose exec nginx nginx -T

# View nginx access logs
docker-compose logs nginx | grep "upstream"

# Test AI server connectivity
docker-compose exec nginx nslookup ai-server
```

#### 4. Performance Issues

```bash
# Check AI server response times
curl -w "@curl-format.txt" http://localhost/api/health

# Monitor TensorFlow.js operations
docker-compose logs ai-server | grep "TensorFlow"

# Scale AI servers if needed
docker-compose up -d --scale ai-server=3
```

### Debug Mode

Enable debug logging for development:

```bash
# Start with debug logs
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f ai-server-dev
```

## Security Considerations

### Production Security

1. **Environment Variables**: Store sensitive values in Docker secrets
2. **Network Security**: Use internal networks for service communication
3. **Container Security**: Run containers as non-root users
4. **SSL/TLS**: Enable HTTPS in production (uncomment SSL config in nginx.conf)

### SSL/TLS Setup

1. **Obtain SSL certificates** (Let's Encrypt, commercial CA)
2. **Update nginx.conf** to enable HTTPS server block
3. **Mount certificates** as volumes in docker-compose.yml

```yaml
volumes:
  - ./certs:/etc/ssl/certs:ro
  - ./private:/etc/ssl/private:ro
```

## Performance Tuning

### AI Server Optimization

1. **CPU Affinity**: Pin AI servers to specific CPU cores
2. **Memory Allocation**: Adjust heap size based on model complexity
3. **Batch Processing**: Implement request batching for better throughput
4. **Model Caching**: Pre-load frequently used models

### Client Optimization

1. **Bundle Splitting**: Code splitting for faster initial loads
2. **Model Preloading**: Cache TensorFlow.js models in service worker
3. **WebGL Optimization**: Enable GPU acceleration where available
4. **Compression**: Gzip compression enabled in nginx

## Scaling Best Practices

### Horizontal Scaling

1. **Start with 2 AI servers** for redundancy
2. **Scale based on CPU/memory utilization**
3. **Monitor response times** and scale accordingly
4. **Use container orchestration** for automatic scaling

### Vertical Scaling

1. **Increase memory allocation** for complex AI models
2. **Add CPU cores** for better concurrent processing
3. **Optimize Docker layer caching** for faster builds
4. **Use multi-stage builds** to minimize image size

## CI/CD Integration

### Build Pipeline

```bash
# Build stage
docker build -t shift-schedule-client:${VERSION} .
docker build -t shift-schedule-server:${VERSION} ./server

# Test stage
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Deploy stage
docker-compose up -d
```

### Health Checks in CI/CD

```bash
# Wait for services to be healthy
docker-compose up -d
docker-compose exec -T nginx curl -f http://localhost/nginx-health
docker-compose exec -T ai-server curl -f http://localhost:3001/health
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update base images** monthly
2. **Monitor disk usage** (logs, volumes)
3. **Review security updates**
4. **Backup data** regularly
5. **Test disaster recovery** procedures

### Performance Monitoring

1. **Set up alerts** for high resource usage
2. **Monitor response times**
3. **Track error rates**
4. **Review logs** regularly

For additional support or questions, please refer to the project documentation or create an issue in the project repository.