# Phase 1: Go WebSocket Server Foundation (Weeks 1-2)

## Executive Summary
This phase implements the foundation of the hybrid Go + WebSocket + Supabase architecture as specified in IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md. Every step follows the official plan exactly.

## Phase 1 Official Requirements

### 1.1 Go Server Setup
**Objective**: Create basic Go server with WebSocket support and Supabase integration

**Exact Implementation** (from lines 84-101 of official plan):
```go
// Basic server structure
package main

import (
    "github.com/gorilla/websocket"
    "github.com/supabase/postgrest-go"
    "database/sql"
)

type StaffServer struct {
    clients     map[*websocket.Conn]bool
    supabase    *postgrest.Client
    db          *sql.DB
    broadcast   chan []byte
    register    chan *websocket.Conn
    unregister  chan *websocket.Conn
}
```

### 1.2 Docker Integration
**Objective**: Add Go server to existing docker-compose.yml

**Exact Configuration** (from lines 104-120 of official plan):
```dockerfile
# Add to existing docker-compose.yml
go-websocket-server:
  build:
    context: ./go-server
    dockerfile: Dockerfile
  environment:
    - SUPABASE_URL=${REACT_APP_SUPABASE_URL}
    - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    - PORT=8080
  networks:
    - backend
  depends_on:
    - redis
  restart: unless-stopped
```

### 1.3 WebSocket Protocol Design
**Objective**: Define message protocol for client-server communication

**Exact Protocol** (from lines 122-141 of official plan):
```typescript
// Message types
interface WebSocketMessage {
  type: 'STAFF_UPDATE' | 'STAFF_CREATE' | 'STAFF_DELETE' | 'SYNC_REQUEST'
  payload: any
  timestamp: string
  clientId: string
  sequenceNumber: number
}

interface StaffUpdateMessage {
  type: 'STAFF_UPDATE'
  payload: {
    staffId: string
    changes: Partial<StaffMember>
    version: number
  }
}
```

## Detailed Implementation Steps

### Step 1: Create Go Server Directory Structure
```
go-server/
├── main.go                 # Main server file
├── go.mod                  # Go module definition
├── go.sum                  # Go dependencies checksum
├── Dockerfile              # Docker build configuration
├── handlers/               # WebSocket handlers
│   ├── websocket.go        # WebSocket connection handling
│   └── staff.go            # Staff-specific operations
├── models/                 # Data models
│   ├── staff.go            # Staff member model
│   └── message.go          # WebSocket message models
├── supabase/               # Supabase integration
│   └── client.go           # Supabase client setup
└── README.md               # Go server documentation
```

### Step 2: Implement Core Server Components

#### main.go Implementation
```go
package main

import (
    "log"
    "net/http"
    "os"

    "github.com/gorilla/websocket"
    "github.com/supabase/postgrest-go"
    "database/sql"
)

type StaffServer struct {
    clients     map[*websocket.Conn]bool
    supabase    *postgrest.Client
    db          *sql.DB
    broadcast   chan []byte
    register    chan *websocket.Conn
    unregister  chan *websocket.Conn
}

func main() {
    server := &StaffServer{
        clients:    make(map[*websocket.Conn]bool),
        broadcast:  make(chan []byte),
        register:   make(chan *websocket.Conn),
        unregister: make(chan *websocket.Conn),
    }

    // Initialize Supabase connection
    supabaseURL := os.Getenv("SUPABASE_URL")
    supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")
    server.supabase = postgrest.NewClient(supabaseURL, supabaseKey, nil)

    // Start WebSocket hub
    go server.handleConnections()

    // WebSocket endpoint
    http.HandleFunc("/staff-sync", server.handleWebSocket)

    // Health check endpoint
    http.HandleFunc("/health", server.healthCheck)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Go WebSocket server starting on port %s", port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
```

### Step 3: Docker Configuration

#### Dockerfile
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

CMD ["./main"]
```

### Step 4: Update Existing docker-compose.yml
Add the Go server service to the existing Docker Compose configuration.

## Deliverables (from official plan lines 143-148)
- [ ] Go server with WebSocket support
- [ ] Docker service configuration
- [ ] Basic message protocol definition
- [ ] Health check endpoints
- [ ] Supabase connection integration

## Success Criteria (from official plan lines 150-154)
- Go server starts successfully in Docker
- WebSocket connections established
- Basic ping/pong messaging works
- Supabase connectivity confirmed

## Risk Mitigation (from official plan lines 156-159)
- Start with minimal feature set
- Keep existing React app unchanged
- Use feature flags for gradual enablement

## Git Commit Strategy
Each step will be committed separately for proper tracking:

1. `git commit -m "PHASE1: Initialize Go server directory structure"`
2. `git commit -m "PHASE1: Implement basic StaffServer with WebSocket support"`
3. `git commit -m "PHASE1: Add Docker configuration for Go server"`
4. `git commit -m "PHASE1: Implement WebSocket protocol definition"`
5. `git commit -m "PHASE1: Add health check and Supabase integration"`
6. `git commit -m "PHASE1: Complete Go WebSocket Server Foundation"`

## Testing Plan
1. **Docker Build Test**: Verify Go server builds in Docker
2. **WebSocket Connection Test**: Establish basic WebSocket connection
3. **Health Check Test**: Verify `/health` endpoint responds
4. **Supabase Test**: Confirm database connectivity
5. **Integration Test**: Full Docker compose startup

## Next Phase Preparation
Upon completion of Phase 1, prepare for Phase 2: Real-time State Synchronization (Weeks 3-4) as specified in the official plan.

---
**Status**: Phase 1 execution following IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md exactly
**Timeline**: Weeks 1-2 of official implementation plan