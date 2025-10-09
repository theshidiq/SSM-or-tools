# Go WebSocket Server - Makefile

.PHONY: run build clean test help

# Default target
.DEFAULT_GOAL := help

# Server configuration
BINARY_NAME=server
PORT=8080

# Source files
SOURCES=main.go settings_multitable.go shifts_websocket.go

help: ## Show this help message
	@echo "Go WebSocket Server - Build Commands"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf "\033[36m\033[0m"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

run: ## Run the server (development mode)
	@echo "Starting Go WebSocket Server on port $(PORT)..."
	@echo "WebSocket endpoint: ws://localhost:$(PORT)/staff-sync"
	@echo "Health check: http://localhost:$(PORT)/health"
	@echo ""
	go run $(SOURCES)

build: ## Build the server binary
	@echo "Building $(BINARY_NAME)..."
	go build -o $(BINARY_NAME) $(SOURCES)
	@echo "Build complete: ./$(BINARY_NAME)"

build-production: ## Build optimized production binary
	@echo "Building production binary..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o $(BINARY_NAME) $(SOURCES)
	@echo "Production build complete: ./$(BINARY_NAME)"

clean: ## Remove built binaries
	@echo "Cleaning build artifacts..."
	rm -f $(BINARY_NAME)
	@echo "Clean complete"

test: ## Run all tests
	@echo "Running tests..."
	go test ./... -v

fmt: ## Format Go code
	@echo "Formatting code..."
	go fmt ./...
	@echo "Format complete"

vet: ## Run go vet
	@echo "Running go vet..."
	go vet ./...
	@echo "Vet complete"

check: fmt vet test ## Run all code quality checks

health: ## Check server health (requires running server)
	@echo "Checking server health..."
	@curl -s http://localhost:$(PORT)/health | jq . || echo "Server not running or jq not installed"

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	go mod download
	@echo "Dependencies downloaded"

tidy: ## Tidy go.mod
	@echo "Tidying go.mod..."
	go mod tidy
	@echo "Tidy complete"
