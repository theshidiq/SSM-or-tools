#!/bin/bash

# Production deployment script for Shift Schedule Manager
# Handles environment setup, building, and deployment

set -e  # Exit on any error

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help message
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  dev         Start development environment"
    echo "  build       Build production images"
    echo "  deploy      Deploy to production"
    echo "  scale       Scale AI servers (requires --replicas=N)"
    echo "  stop        Stop all services"
    echo "  logs        Show service logs (requires --service=name)"
    echo "  health      Check service health"
    echo "  backup      Backup data volumes"
    echo "  restore     Restore from backup (requires --backup-file=path)"
    echo "  clean       Clean up images and volumes"
    echo ""
    echo "Options:"
    echo "  --replicas=N     Number of AI server replicas (default: 2)"
    echo "  --service=name   Service name for logs command"
    echo "  --backup-file=   Backup file path for restore command"
    echo "  --env=file       Environment file to use (default: .env)"
    echo "  --force          Force action without confirmation"
    echo "  --help, -h       Show this help message"
}

# Parse command line arguments
COMMAND=""
REPLICAS=2
SERVICE=""
BACKUP_FILE=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|build|deploy|scale|stop|logs|health|backup|restore|clean)
            COMMAND="$1"
            shift
            ;;
        --replicas=*)
            REPLICAS="${1#*=}"
            shift
            ;;
        --service=*)
            SERVICE="${1#*=}"
            shift
            ;;
        --backup-file=*)
            BACKUP_FILE="${1#*=}"
            shift
            ;;
        --env=*)
            ENV_FILE="${1#*=}"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if command is provided
if [[ -z "$COMMAND" ]]; then
    log_error "No command provided"
    show_help
    exit 1
fi

# Check Docker and Docker Compose availability
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Check environment file
check_environment() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning "Environment file not found: $ENV_FILE"
        log_info "Creating from template..."
        
        if [[ -f "$PROJECT_DIR/.env.example" ]]; then
            cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
            log_success "Environment file created from template"
            log_warning "Please edit $ENV_FILE with your configuration"
        else
            log_error "No environment template found"
            exit 1
        fi
    fi
}

# Development environment
start_development() {
    log_info "Starting development environment..."
    cd "$PROJECT_DIR"
    
    docker-compose -f docker-compose.dev.yml up -d
    
    log_success "Development environment started"
    log_info "Frontend: http://localhost:3000"
    log_info "AI Server: http://localhost:3001"
    log_info "Database: localhost:5432 (if enabled)"
}

# Build production images
build_images() {
    log_info "Building production images..."
    cd "$PROJECT_DIR"
    
    # Set build-time variables
    export REACT_APP_VERSION=$(date +"%Y%m%d-%H%M%S")
    export REACT_APP_BUILD_TIME=$(date -Iseconds)
    
    log_info "Building client image..."
    docker build -t shift-schedule-client:latest --target production .
    
    log_info "Building server image..."
    docker build -t shift-schedule-server:latest --target production ./server
    
    log_success "Images built successfully"
}

# Deploy to production
deploy_production() {
    log_info "Deploying to production..."
    cd "$PROJECT_DIR"
    
    # Check if already running
    if docker-compose ps -q | grep -q .; then
        if [[ "$FORCE" == false ]]; then
            log_warning "Services are already running. Use --force to redeploy."
            read -p "Continue with deployment? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Deployment cancelled"
                exit 0
            fi
        fi
        
        log_info "Stopping existing services..."
        docker-compose down
    fi
    
    log_info "Starting production services..."
    docker-compose up -d --scale ai-server="$REPLICAS"
    
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Health check
    if check_health_quiet; then
        log_success "Production deployment completed successfully"
        log_info "Application: http://localhost"
        log_info "AI Servers: $REPLICAS replicas"
    else
        log_error "Deployment failed - services are not healthy"
        exit 1
    fi
}

# Scale AI servers
scale_servers() {
    log_info "Scaling AI servers to $REPLICAS replicas..."
    cd "$PROJECT_DIR"
    
    docker-compose up -d --scale ai-server="$REPLICAS"
    
    log_success "Scaled to $REPLICAS AI server replicas"
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."
    cd "$PROJECT_DIR"
    
    if docker-compose ps -q | grep -q .; then
        docker-compose down
        log_success "Services stopped"
    else
        log_info "No services are running"
    fi
}

# Show service logs
show_logs() {
    if [[ -z "$SERVICE" ]]; then
        log_info "Showing logs for all services..."
        cd "$PROJECT_DIR"
        docker-compose logs -f
    else
        log_info "Showing logs for service: $SERVICE"
        cd "$PROJECT_DIR"
        docker-compose logs -f "$SERVICE"
    fi
}

# Check service health (quiet mode for scripts)
check_health_quiet() {
    cd "$PROJECT_DIR"
    
    # Check if services are running
    if ! docker-compose ps -q | grep -q .; then
        return 1
    fi
    
    # Check nginx health
    if ! docker-compose exec -T nginx curl -sf http://localhost/nginx-health >/dev/null 2>&1; then
        return 1
    fi
    
    # Check AI server health
    if ! docker-compose exec -T ai-server curl -sf http://localhost:3001/health >/dev/null 2>&1; then
        return 1
    fi
    
    return 0
}

# Check service health
check_health() {
    log_info "Checking service health..."
    cd "$PROJECT_DIR"
    
    if check_health_quiet; then
        log_success "All services are healthy"
        
        # Show service status
        echo ""
        log_info "Service Status:"
        docker-compose ps
        
        # Show resource usage
        echo ""
        log_info "Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    else
        log_error "Some services are unhealthy"
        docker-compose ps
        exit 1
    fi
}

# Backup data
backup_data() {
    log_info "Creating backup..."
    cd "$PROJECT_DIR"
    
    BACKUP_DIR="$PROJECT_DIR/backups"
    BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
    BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_DATE"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup TensorFlow.js models
    if docker volume ls | grep -q tf_models_cache; then
        log_info "Backing up TensorFlow.js models..."
        docker run --rm -v shift-schedule-manager_tf_models_cache:/data -v "$BACKUP_PATH":/backup alpine tar czf /backup/tf_models.tar.gz -C /data .
    fi
    
    # Backup PostgreSQL data (if running)
    if docker-compose ps postgres | grep -q Up; then
        log_info "Backing up PostgreSQL database..."
        docker-compose exec -T postgres pg_dump -U postgres shift_schedule > "$BACKUP_PATH/database.sql"
    fi
    
    # Backup Redis data (if running)
    if docker-compose ps redis | grep -q Up; then
        log_info "Backing up Redis data..."
        docker run --rm -v shift-schedule-manager_redis_data:/data -v "$BACKUP_PATH":/backup alpine tar czf /backup/redis.tar.gz -C /data .
    fi
    
    log_success "Backup created: $BACKUP_PATH"
}

# Restore from backup
restore_data() {
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Backup file path is required (--backup-file=path)"
        exit 1
    fi
    
    if [[ ! -d "$BACKUP_FILE" ]]; then
        log_error "Backup directory not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Restoring from backup: $BACKUP_FILE"
    
    if [[ "$FORCE" == false ]]; then
        log_warning "This will overwrite current data!"
        read -p "Continue with restore? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi
    
    cd "$PROJECT_DIR"
    
    # Restore TensorFlow.js models
    if [[ -f "$BACKUP_FILE/tf_models.tar.gz" ]]; then
        log_info "Restoring TensorFlow.js models..."
        docker run --rm -v shift-schedule-manager_tf_models_cache:/data -v "$BACKUP_FILE":/backup alpine tar xzf /backup/tf_models.tar.gz -C /data
    fi
    
    # Restore PostgreSQL data
    if [[ -f "$BACKUP_FILE/database.sql" ]]; then
        log_info "Restoring PostgreSQL database..."
        docker-compose exec -T postgres psql -U postgres shift_schedule < "$BACKUP_FILE/database.sql"
    fi
    
    # Restore Redis data
    if [[ -f "$BACKUP_FILE/redis.tar.gz" ]]; then
        log_info "Restoring Redis data..."
        docker run --rm -v shift-schedule-manager_redis_data:/data -v "$BACKUP_FILE":/backup alpine tar xzf /backup/redis.tar.gz -C /data
    fi
    
    log_success "Restore completed"
}

# Clean up Docker resources
clean_up() {
    log_info "Cleaning up Docker resources..."
    
    if [[ "$FORCE" == false ]]; then
        log_warning "This will remove unused Docker images and volumes!"
        read -p "Continue with cleanup? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleanup cancelled"
            exit 0
        fi
    fi
    
    cd "$PROJECT_DIR"
    
    # Stop services first
    docker-compose down
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (excluding named volumes)
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Cleanup completed"
}

# Main execution
main() {
    check_dependencies
    
    case $COMMAND in
        dev)
            check_environment
            start_development
            ;;
        build)
            build_images
            ;;
        deploy)
            check_environment
            build_images
            deploy_production
            ;;
        scale)
            scale_servers
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs
            ;;
        health)
            check_health
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data
            ;;
        clean)
            clean_up
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main