# Hybrid Go + WebSocket + Supabase Architecture Implementation Plan

## Executive Summary

**Project**: Solving StaffEditModal Real-time Update Race Conditions
**Objective**: Implement hybrid Go + WebSocket + Supabase architecture to eliminate race conditions while maintaining Supabase integration
**Duration**: 8-12 weeks (incremental implementation)
**Risk Level**: Medium - Incremental approach with rollback strategies

## Current System Analysis

### Identified Problems

1. **Complex 5-Layer State Management**:
   - React Query (cache layer)
   - useStaffManagementEnhanced (enhanced layer)
   - useStaffManagementRealtime (real-time layer)
   - Supabase real-time subscriptions
   - Local React state (StaffEditModal)

2. **Race Condition Patterns**:
   - UI updates lag behind database operations
   - Multiple state sources compete for truth
   - Asynchronous operations overlap without proper sequencing
   - Cache invalidation timing issues

3. **Current Architecture Complexity**:
   - 5-second stale time causing UI lag
   - Multiple cache layers (memory + IndexedDB + React Query)
   - Offline support adding operation queuing complexity
   - Conflict resolution competing with real-time updates

### Current Technology Stack
- **Frontend**: React 18 with hooks and functional components
- **State Management**: React Query (@tanstack/react-query)
- **Database**: Supabase with real-time subscriptions
- **Deployment**: Docker with NGINX, AI servers, Redis, PostgreSQL
- **Bundle Size**: 411kB gzipped (with 2.8MB AI modules)

## Proposed Hybrid Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  React App                                                      │
│  ├── WebSocket Client (Go server)                              │
│  ├── Supabase Client (fallback/bulk operations)               │
│  └── Simplified State Management (single source of truth)      │
├─────────────────────────────────────────────────────────────────┤
│                        ORCHESTRATION LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  Go WebSocket Server                                            │
│  ├── Real-time Event Orchestration                            │
│  ├── State Synchronization Engine                             │
│  ├── Client Connection Management                             │
│  └── Conflict Resolution Logic                                │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL                                           │
│  ├── Staff Management Tables                                  │
│  ├── Schedule Data Tables                                     │
│  ├── Real-time Change Log                                     │
│  └── Transaction Integrity                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Single Source of Truth**: Go server maintains authoritative state
2. **Event-Driven Updates**: WebSocket events drive all UI changes
3. **Supabase Integration**: Maintained for data persistence and query capabilities
4. **Incremental Migration**: Gradual replacement without disrupting existing features
5. **Rollback Safety**: Each phase can be reverted independently

## Implementation Phases

### Phase 1: Go WebSocket Server Foundation (Weeks 1-2)

#### 1.1 Go Server Setup
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

#### 1.2 Docker Integration
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

#### 1.3 WebSocket Protocol Design
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

#### Deliverables:
- [ ] Go server with WebSocket support
- [ ] Docker service configuration
- [ ] Basic message protocol definition
- [ ] Health check endpoints
- [ ] Supabase connection integration

#### Success Criteria:
- Go server starts successfully in Docker
- WebSocket connections established
- Basic ping/pong messaging works
- Supabase connectivity confirmed

#### Risk Mitigation:
- Start with minimal feature set
- Keep existing React app unchanged
- Use feature flags for gradual enablement

### Phase 2: Real-time State Synchronization (Weeks 3-4)

#### 2.1 State Management Engine
```go
type StateManager struct {
    staffMembers  map[string]*StaffMember
    mutex         sync.RWMutex
    version       int64
    changeLog     []StateChange
    subscribers   map[string]*Client
}

func (sm *StateManager) UpdateStaff(staffId string, changes StaffUpdate) error {
    sm.mutex.Lock()
    defer sm.mutex.Unlock()

    // Apply changes with conflict detection
    if err := sm.validateUpdate(staffId, changes); err != nil {
        return err
    }

    // Update state
    sm.staffMembers[staffId] = applyChanges(sm.staffMembers[staffId], changes)
    sm.version++

    // Log change
    sm.changeLog = append(sm.changeLog, StateChange{
        Type:      "staff_update",
        StaffId:   staffId,
        Changes:   changes,
        Version:   sm.version,
        Timestamp: time.Now(),
    })

    // Broadcast to subscribers
    sm.broadcastChange(staffId, changes)

    // Persist to Supabase
    return sm.persistToSupabase(staffId, sm.staffMembers[staffId])
}
```

#### 2.2 Conflict Resolution Strategy
```go
type ConflictResolver struct {
    strategy ConflictStrategy
}

type ConflictStrategy int

const (
    LastWriterWins ConflictStrategy = iota
    FirstWriterWins
    MergeChanges
    UserChoice
)

func (cr *ConflictResolver) ResolveConflict(local, remote *StaffMember) (*StaffMember, error) {
    switch cr.strategy {
    case LastWriterWins:
        return remote, nil
    case FirstWriterWins:
        return local, nil
    case MergeChanges:
        return cr.mergeStaffMembers(local, remote), nil
    case UserChoice:
        return nil, ErrUserChoiceRequired
    }
    return nil, ErrUnknownStrategy
}
```

#### 2.3 Client Connection Management
```go
type ClientManager struct {
    clients     map[string]*Client
    mutex       sync.RWMutex
    heartbeat   time.Duration
}

type Client struct {
    id           string
    conn         *websocket.Conn
    lastSeen     time.Time
    subscriptions map[string]bool
    sendChan     chan []byte
}

func (cm *ClientManager) BroadcastToSubscribers(event Event) {
    cm.mutex.RLock()
    defer cm.mutex.RUnlock()

    for _, client := range cm.clients {
        if client.isSubscribedTo(event.Type) {
            select {
            case client.sendChan <- event.Marshal():
            default:
                // Client send buffer full, disconnect
                cm.disconnectClient(client.id)
            }
        }
    }
}
```

#### Deliverables:
- [ ] Go state management engine
- [ ] Conflict resolution algorithms
- [ ] Client subscription system
- [ ] Change log and versioning
- [ ] Supabase persistence layer

#### Success Criteria:
- Multiple clients can connect simultaneously
- State changes propagate to all subscribers
- Conflicts detected and resolved automatically
- All changes persisted to Supabase
- Version tracking prevents lost updates

### Phase 3: React Client Integration (Weeks 5-6)

#### 3.1 WebSocket Hook
```typescript
// New simplified hook replacing complex state management
export const useWebSocketStaff = (currentMonthIndex: number) => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [isLoading, setIsLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8080/staff-sync?period=${currentMonthIndex}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      // Request initial state sync
      ws.send(JSON.stringify({
        type: 'SYNC_REQUEST',
        payload: { period: currentMonthIndex },
        timestamp: new Date().toISOString(),
        clientId: crypto.randomUUID()
      }))
    }

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)

      switch (message.type) {
        case 'STAFF_UPDATE':
          handleStaffUpdate(message.payload)
          break
        case 'STAFF_CREATE':
          handleStaffCreate(message.payload)
          break
        case 'STAFF_DELETE':
          handleStaffDelete(message.payload)
          break
        case 'SYNC_RESPONSE':
          setStaffMembers(message.payload.staffMembers)
          setIsLoading(false)
          break
      }
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      // Implement reconnection logic
    }

    return () => {
      ws.close()
    }
  }, [currentMonthIndex])

  const updateStaff = useCallback((staffId: string, changes: Partial<StaffMember>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STAFF_UPDATE',
        payload: { staffId, changes },
        timestamp: new Date().toISOString(),
        clientId: crypto.randomUUID()
      }))
    }
  }, [])

  const addStaff = useCallback((staffData: Omit<StaffMember, 'id'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STAFF_CREATE',
        payload: staffData,
        timestamp: new Date().toISOString(),
        clientId: crypto.randomUUID()
      }))
    }
  }, [])

  return {
    staffMembers,
    updateStaff,
    addStaff,
    deleteStaff: (staffId: string) => { /* implementation */ },
    connectionStatus,
    isLoading,
    isConnected: connectionStatus === 'connected'
  }
}
```

#### 3.2 StaffEditModal Simplification
```typescript
// Simplified modal without complex state management
const StaffEditModal = ({ /* props */ }) => {
  const { staffMembers, updateStaff, addStaff, deleteStaff, isConnected } = useWebSocketStaff(currentMonthIndex)
  const [editingStaffData, setEditingStaffData] = useState(initialState)
  const [operationInProgress, setOperationInProgress] = useState(false)

  // Single source of truth - no complex sync logic needed
  const handleSubmit = async (e) => {
    e.preventDefault()
    setOperationInProgress(true)

    try {
      if (isAddingNewStaff) {
        await addStaff(editingStaffData) // WebSocket handles everything
      } else {
        await updateStaff(selectedStaffForEdit.id, editingStaffData)
      }

      // UI updates automatically via WebSocket
      toast.success('操作が完了しました')
    } catch (error) {
      toast.error(`操作に失敗しました: ${error.message}`)
    } finally {
      setOperationInProgress(false)
    }
  }

  // No complex useEffect synchronization logic needed
  return (
    <Dialog open={showStaffEditModal}>
      {/* Simplified form - staffMembers updates automatically */}
    </Dialog>
  )
}
```

#### 3.3 Migration Strategy
```typescript
// Feature flag for gradual migration
const useStaffManagement = (currentMonthIndex: number) => {
  const enableWebSocketMode = useFeatureFlag('WEBSOCKET_STAFF_MANAGEMENT')

  if (enableWebSocketMode) {
    return useWebSocketStaff(currentMonthIndex)
  } else {
    return useStaffManagementEnhanced(currentMonthIndex) // Existing complex hook
  }
}
```

#### Deliverables:
- [ ] React WebSocket hook implementation
- [ ] Simplified StaffEditModal component
- [ ] Feature flag system for gradual rollout
- [ ] Migration utilities
- [ ] Fallback mechanisms

#### Success Criteria:
- StaffEditModal updates instantly without race conditions
- Connection loss handled gracefully
- Feature flag allows switching between old/new systems
- No regression in existing functionality
- 100% elimination of identified race conditions

### Phase 4: Performance Optimization & Monitoring (Weeks 7-8)

#### 4.1 Go Server Optimizations
```go
// Connection pooling and performance optimizations
type OptimizedServer struct {
    connPool        *ConnectionPool
    messageQueue    chan Message
    workerPool      *WorkerPool
    metrics         *MetricsCollector
    rateLimiter     *RateLimiter
}

// Message batching for high-frequency updates
type MessageBatcher struct {
    batchSize     int
    flushInterval time.Duration
    pending       []Message
    mutex         sync.Mutex
}

func (mb *MessageBatcher) AddMessage(msg Message) {
    mb.mutex.Lock()
    defer mb.mutex.Unlock()

    mb.pending = append(mb.pending, msg)

    if len(mb.pending) >= mb.batchSize {
        mb.flush()
    }
}
```

#### 4.2 Monitoring & Metrics
```go
type Metrics struct {
    ActiveConnections    prometheus.Gauge
    MessagesPerSecond    prometheus.Counter
    MessageLatency       prometheus.Histogram
    ConflictResolutions  prometheus.Counter
    SupabaseOperations   prometheus.Counter
}

// Health check endpoint
func (s *StaffServer) HealthCheck(w http.ResponseWriter, r *http.Request) {
    health := map[string]interface{}{
        "status":              "healthy",
        "active_connections":  s.metrics.ActiveConnections.Get(),
        "uptime":             time.Since(s.startTime).String(),
        "supabase_connected": s.supabase.IsConnected(),
        "version":            BuildVersion,
    }

    json.NewEncoder(w).Encode(health)
}
```

#### 4.3 Load Testing & Benchmarks
```bash
# WebSocket load testing script
#!/bin/bash
echo "Starting WebSocket load test..."

# Test with multiple concurrent connections
for i in {1..100}; do
    wscat -c ws://localhost:8080/staff-sync &
done

# Monitor metrics
curl http://localhost:8080/metrics | grep staff_
```

#### Deliverables:
- [ ] Performance optimizations (connection pooling, message batching)
- [ ] Comprehensive monitoring dashboard
- [ ] Load testing suite
- [ ] Performance benchmarks
- [ ] Auto-scaling configuration

#### Success Criteria:
- Handle 1000+ concurrent connections
- Sub-100ms message latency
- 99.9% uptime during normal operations
- Automated alerting for performance degradation
- Horizontal scaling capability demonstrated

### Phase 5: Production Deployment & Migration (Weeks 9-10)

#### 5.1 Docker Production Configuration
```yaml
# Updated docker-compose.yml
services:
  go-websocket-server:
    build:
      context: ./go-server
      dockerfile: Dockerfile.production
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'
    environment:
      - GO_ENV=production
      - WEBSOCKET_PORT=8080
      - SUPABASE_URL=${REACT_APP_SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - backend

  nginx:
    # Updated to proxy WebSocket connections
    volumes:
      - ./nginx/websocket.conf:/etc/nginx/conf.d/websocket.conf:ro
```

#### 5.2 NGINX WebSocket Configuration
```nginx
# /nginx/websocket.conf
upstream websocket_backend {
    server go-websocket-server:8080;
    # Add more servers for load balancing
}

server {
    listen 80;

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Existing React app
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 5.3 Migration Execution Plan

**Week 9: Staged Rollout**
1. **Day 1-2**: Deploy Go server alongside existing system
2. **Day 3-4**: Enable WebSocket for 10% of users (feature flag)
3. **Day 5-6**: Monitor metrics, fix issues
4. **Day 7**: Increase to 50% if stable

**Week 10: Full Migration**
1. **Day 1-2**: 100% WebSocket enabled
2. **Day 3-4**: Remove old state management code
3. **Day 5-6**: Performance optimization
4. **Day 7**: Final verification and documentation

#### 5.4 Rollback Procedures
```typescript
// Emergency rollback function
const emergencyRollback = () => {
  // Disable WebSocket feature flag
  setFeatureFlag('WEBSOCKET_STAFF_MANAGEMENT', false)

  // Clear WebSocket connections
  disconnectAllWebSockets()

  // Revert to Supabase-only mode
  enableSupabaseDirectMode()

  console.log('Emergency rollback completed')
}
```

#### Deliverables:
- [ ] Production Docker configuration
- [ ] NGINX WebSocket proxy setup
- [ ] Staged rollout plan execution
- [ ] Monitoring dashboard deployment
- [ ] Rollback procedures tested

#### Success Criteria:
- Zero-downtime deployment
- All users migrated successfully
- No increase in error rates
- Performance metrics meet targets
- Rollback procedures verified working

### Phase 6: Optimization & Future Enhancements (Weeks 11-12)

#### 6.1 Advanced Features
```go
// Message compression for large datasets
type CompressedMessage struct {
    Type        string `json:"type"`
    Compressed  bool   `json:"compressed"`
    Payload     []byte `json:"payload"` // gzip compressed
    Checksum    string `json:"checksum"`
}

// Partial updates for large objects
type PartialUpdate struct {
    Path        string      `json:"path"`        // JSON path
    Operation   string      `json:"operation"`   // set, delete, append
    Value       interface{} `json:"value"`
    Version     int64       `json:"version"`
}
```

#### 6.2 Enhanced Error Handling
```typescript
// Sophisticated error recovery
class WebSocketManager {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private backoffMultiplier = 1.5

  async connectWithRetry(): Promise<WebSocket> {
    try {
      const ws = await this.connect()
      this.reconnectAttempts = 0 // Reset on success
      return ws
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(this.backoffMultiplier, this.reconnectAttempts) * 1000
        this.reconnectAttempts++

        console.log(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)

        await new Promise(resolve => setTimeout(resolve, delay))
        return this.connectWithRetry()
      } else {
        throw new Error('Max reconnection attempts reached')
      }
    }
  }
}
```

#### 6.3 Integration with Existing AI Features
```go
// AI-powered conflict resolution
type AIConflictResolver struct {
    model       *tensorflow.Model
    confidence  float64
}

func (ai *AIConflictResolver) PredictBestResolution(conflict Conflict) (Resolution, error) {
    // Use TensorFlow.js models for intelligent conflict resolution
    features := ai.extractFeatures(conflict)
    prediction := ai.model.Predict(features)

    if prediction.Confidence > ai.confidence {
        return prediction.Resolution, nil
    }

    // Fallback to manual resolution
    return Resolution{}, ErrLowConfidence
}
```

#### Deliverables:
- [ ] Message compression and optimization
- [ ] Advanced error handling and recovery
- [ ] AI integration for conflict resolution
- [ ] Performance profiling and optimization
- [ ] Comprehensive documentation

#### Success Criteria:
- 50% reduction in network traffic through compression
- 99.95% connection stability
- AI conflict resolution accuracy >90%
- Complete technical documentation
- Knowledge transfer completed

## Risk Analysis & Mitigation

### High-Risk Items

#### 1. WebSocket Connection Stability
**Risk**: Connection drops during critical operations
**Mitigation**:
- Implement robust reconnection logic with exponential backoff
- Message queuing during disconnections
- Automatic state re-synchronization on reconnect
- Comprehensive monitoring and alerting

#### 2. Data Consistency During Migration
**Risk**: Data loss or corruption during transition
**Mitigation**:
- Comprehensive backup strategy before migration
- Gradual feature flag rollout (10% → 50% → 100%)
- Real-time data validation and integrity checks
- Immediate rollback procedures

#### 3. Performance Degradation
**Risk**: New architecture slower than existing system
**Mitigation**:
- Extensive load testing before production
- Performance benchmarking at each phase
- Auto-scaling configuration
- Performance monitoring and alerting

#### 4. Docker Integration Complexity
**Risk**: Integration issues with existing Docker setup
**Mitigation**:
- Test in staging environment first
- Gradual service addition
- Comprehensive health checks
- Container resource monitoring

### Medium-Risk Items

#### 1. Go Server Learning Curve
**Risk**: Team unfamiliar with Go development
**Mitigation**:
- Provide Go training and resources
- Start with simple implementations
- Code reviews by Go-experienced developers
- Extensive documentation and comments

#### 2. Client-Side State Management Changes
**Risk**: Complex refactoring breaks existing functionality
**Mitigation**:
- Maintain backward compatibility during transition
- Comprehensive test coverage
- Feature flags for gradual migration
- Thorough integration testing

### Low-Risk Items

#### 1. Supabase Integration Maintenance
**Risk**: Changes affect existing Supabase functionality
**Mitigation**:
- Maintain all existing Supabase connections
- Use Go server as enhancement, not replacement
- Test all existing workflows

## Testing Strategy

### 1. Unit Testing
```go
// Go server unit tests
func TestStaffUpdateConflictResolution(t *testing.T) {
    resolver := NewConflictResolver(LastWriterWins)

    local := &StaffMember{Name: "Local Update", Version: 1}
    remote := &StaffMember{Name: "Remote Update", Version: 2}

    result, err := resolver.ResolveConflict(local, remote)

    assert.NoError(t, err)
    assert.Equal(t, "Remote Update", result.Name)
    assert.Equal(t, int64(2), result.Version)
}
```

### 2. Integration Testing
```typescript
// React component integration tests
describe('StaffEditModal with WebSocket', () => {
  it('should update staff member immediately', async () => {
    const { getByTestId } = render(<StaffEditModal />)

    // Mock WebSocket connection
    mockWebSocket.send.mockImplementation((message) => {
      const parsed = JSON.parse(message)
      if (parsed.type === 'STAFF_UPDATE') {
        // Simulate immediate server response
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'STAFF_UPDATE',
            payload: parsed.payload
          })
        })
      }
    })

    // Perform update
    fireEvent.change(getByTestId('staff-name'), { target: { value: 'New Name' } })
    fireEvent.click(getByTestId('save-button'))

    // Verify immediate UI update
    await waitFor(() => {
      expect(getByTestId('staff-name')).toHaveValue('New Name')
    })
  })
})
```

### 3. Load Testing
```bash
#!/bin/bash
# WebSocket load test script

echo "Testing 1000 concurrent connections..."

# Artillery.io configuration for WebSocket testing
cat > websocket-load-test.yml << EOF
config:
  target: 'ws://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 50
  engines:
    ws:
      query:
        period: "1"

scenarios:
  - name: "Staff update operations"
    weight: 100
    engine: ws
    steps:
      - connect:
          url: "/staff-sync"
      - send:
          payload: '{"type":"SYNC_REQUEST","clientId":"load-test-{{ $randomNumber() }}"}'
      - think: 1
      - loop:
        - send:
            payload: '{"type":"STAFF_UPDATE","payload":{"staffId":"test-{{ $randomNumber() }}","changes":{"name":"Test {{ $randomNumber() }}"}}}'
        - think: 2
        count: 10
EOF

artillery run websocket-load-test.yml
```

### 4. End-to-End Testing
```typescript
// Playwright E2E tests
import { test, expect } from '@playwright/test'

test('staff management workflow', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // Open staff modal
  await page.click('[data-testid="staff-management-button"]')

  // Add new staff member
  await page.click('[data-testid="add-staff-button"]')
  await page.fill('[data-testid="staff-name"]', 'Test Staff Member')
  await page.click('[data-testid="save-button"]')

  // Verify immediate appearance in list
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Test Staff Member')

  // Test real-time update across multiple tabs
  const secondPage = await page.context().newPage()
  await secondPage.goto('http://localhost:3000')

  // Update staff in first tab
  await page.click('[data-testid="edit-staff-Test Staff Member"]')
  await page.fill('[data-testid="staff-name"]', 'Updated Staff Member')
  await page.click('[data-testid="save-button"]')

  // Verify update appears immediately in second tab
  await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('Updated Staff Member')
})
```

## Success Criteria & KPIs

### Primary Success Metrics

1. **Race Condition Elimination**: 100% elimination of identified StaffEditModal race conditions
2. **UI Response Time**: <50ms for staff member updates (down from current 1-5 seconds)
3. **Real-time Sync**: <100ms for updates to propagate across all connected clients
4. **System Stability**: 99.9% uptime during normal operations
5. **Data Consistency**: Zero data loss events during operations

### Performance Benchmarks

| Metric | Current State | Target State | Measurement Method |
|--------|---------------|--------------|-------------------|
| Staff Update Latency | 1-5 seconds | <50ms | Client-side timing |
| UI Race Conditions | 3-5 per session | 0 | Error monitoring |
| Connection Stability | 95% | 99.9% | WebSocket monitoring |
| Concurrent Users | 50 | 1000+ | Load testing |
| Bundle Size | 411kB | <300kB | Webpack analysis |

### User Experience Metrics

1. **Modal Responsiveness**: Staff edits appear instantly without refresh
2. **Multi-user Collaboration**: Changes from other users appear in real-time
3. **Offline Resilience**: Graceful handling of connection loss
4. **Error Recovery**: Automatic reconnection and state synchronization

## Resource Requirements

### Development Team
- **Go Developer**: 1 full-time (can be existing team member with training)
- **React Developer**: 1 full-time (existing team member)
- **DevOps Engineer**: 0.5 FTE for Docker integration
- **QA Engineer**: 0.5 FTE for testing

### Infrastructure
- **Additional Container**: Go WebSocket server (512MB memory, 1 CPU)
- **Network Bandwidth**: Minimal increase (efficient WebSocket protocol)
- **Monitoring**: Prometheus/Grafana stack (existing)
- **Testing**: Load testing environment

### Timeline & Budget

| Phase | Duration | Resource Allocation | Estimated Cost |
|-------|----------|-------------------|----------------|
| Phase 1 | 2 weeks | 1 Go dev + 0.5 DevOps | $8,000 |
| Phase 2 | 2 weeks | 1 Go dev + 0.5 QA | $6,000 |
| Phase 3 | 2 weeks | 1 React dev + 1 Go dev | $8,000 |
| Phase 4 | 2 weeks | 1 Go dev + 0.5 DevOps | $6,000 |
| Phase 5 | 2 weeks | Full team | $10,000 |
| Phase 6 | 2 weeks | 1 Go dev + 0.5 QA | $6,000 |
| **Total** | **12 weeks** | **Variable allocation** | **$44,000** |

## Deployment Strategy

### Staging Environment
```yaml
# staging-docker-compose.yml
version: '3.8'
services:
  staging-go-server:
    build:
      context: ./go-server
      dockerfile: Dockerfile.staging
    environment:
      - GO_ENV=staging
      - SUPABASE_URL=${STAGING_SUPABASE_URL}
    ports:
      - "8081:8080"  # Different port for staging

  staging-app:
    build:
      context: .
      dockerfile: Dockerfile
      target: staging
    environment:
      - REACT_APP_WEBSOCKET_URL=ws://localhost:8081
      - REACT_APP_FEATURE_WEBSOCKET=true
    ports:
      - "3001:3000"
```

### Production Deployment Checklist

#### Pre-deployment
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load tests completed successfully
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Staging environment validated
- [ ] Rollback procedures tested

#### Deployment Day
- [ ] Database backup completed
- [ ] Feature flags configured
- [ ] Monitoring dashboards prepared
- [ ] Support team notified
- [ ] Go server deployed
- [ ] NGINX configuration updated
- [ ] Feature flag enabled for 10%
- [ ] Monitor metrics for 2 hours
- [ ] Gradually increase percentage

#### Post-deployment
- [ ] Performance metrics validated
- [ ] User feedback collected
- [ ] Error rates monitored
- [ ] Old code removal (after 1 week stability)
- [ ] Documentation updated
- [ ] Team training completed

## Monitoring & Alerting

### Key Metrics Dashboard
```yaml
# Grafana dashboard configuration
dashboard:
  title: "Staff Management WebSocket System"
  panels:
    - title: "Active WebSocket Connections"
      type: "graph"
      targets:
        - expr: 'websocket_connections_active'

    - title: "Message Latency"
      type: "histogram"
      targets:
        - expr: 'websocket_message_duration_seconds'

    - title: "Staff Operation Success Rate"
      type: "stat"
      targets:
        - expr: 'rate(staff_operations_total{status="success"}[5m]) / rate(staff_operations_total[5m])'

    - title: "Supabase Sync Errors"
      type: "graph"
      targets:
        - expr: 'supabase_sync_errors_total'

alerts:
  - name: "WebSocket Connection Drop"
    condition: 'websocket_connections_active < 10'
    severity: "critical"

  - name: "High Message Latency"
    condition: 'websocket_message_duration_seconds > 0.1'
    severity: "warning"

  - name: "Staff Operation Failures"
    condition: 'rate(staff_operations_total{status="error"}[5m]) > 0.05'
    severity: "critical"
```

### Logging Strategy
```go
// Structured logging with different levels
import (
    "github.com/sirupsen/logrus"
    "context"
)

type Logger struct {
    *logrus.Logger
    requestID string
}

func (l *Logger) LogStaffOperation(ctx context.Context, operation string, staffID string, success bool) {
    entry := l.WithFields(logrus.Fields{
        "operation":  operation,
        "staff_id":   staffID,
        "success":    success,
        "request_id": l.requestID,
        "timestamp":  time.Now().UTC(),
    })

    if success {
        entry.Info("Staff operation completed")
    } else {
        entry.Error("Staff operation failed")
    }
}
```

## Conclusion

This implementation plan provides a comprehensive roadmap for solving the StaffEditModal race condition issues through a hybrid Go + WebSocket + Supabase architecture. The phased approach ensures minimal risk while delivering immediate benefits.

### Key Benefits

1. **Immediate Problem Resolution**: Eliminates all identified race conditions
2. **Future-Proof Architecture**: Scalable WebSocket foundation for real-time features
3. **Maintained Integration**: Keeps Supabase for data persistence and complex queries
4. **Performance Enhancement**: Sub-100ms response times vs current 1-5 seconds
5. **User Experience**: Real-time collaboration across multiple users

### Next Steps

1. **Week 1**: Begin Phase 1 implementation (Go server foundation)
2. **Week 2**: Complete Docker integration and basic WebSocket protocol
3. **Week 3**: Start Phase 2 (real-time state synchronization)
4. **Ongoing**: Regular stakeholder updates and progress reviews

This plan balances technical excellence with practical implementation constraints, ensuring successful delivery while maintaining system reliability and user experience.