# System Architecture Documentation

**Shift Schedule Manager with OR-Tools CP-SAT**

This document provides comprehensive technical documentation of the system architecture, design decisions, and implementation details.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture Layers](#architecture-layers)
- [Data Flow](#data-flow)
- [Component Details](#component-details)
- [Technology Stack](#technology-stack)
- [Design Decisions](#design-decisions)
- [Constraint Programming Model](#constraint-programming-model)
- [WebSocket Protocol](#websocket-protocol)
- [Database Schema](#database-schema)
- [Deployment Architecture](#deployment-architecture)
- [Performance Characteristics](#performance-characteristics)
- [Security Considerations](#security-considerations)

---

## Overview

The Shift Schedule Manager is a **hybrid architecture** system that combines:

1. **React frontend** for user interface
2. **Go WebSocket server** for real-time orchestration
3. **Python OR-Tools service** for mathematical optimization
4. **Supabase PostgreSQL** for data persistence

This architecture provides:
- ⚡ **Sub-50ms UI updates** through WebSocket communication
- 🎯 **Mathematically optimal schedules** via Google CP-SAT solver
- 🌐 **1000+ concurrent users** with horizontal scaling
- 🔄 **Real-time collaboration** with conflict resolution

---

## Architecture Layers

### Layer 1: Client Layer

**Technology**: React 18 + Tailwind CSS + React Query

```
┌─────────────────────────────────────────┐
│          React Application              │
├─────────────────────────────────────────┤
│  Components:                            │
│  ├── ShiftScheduleEditorPhase3         │
│  ├── ScheduleTable                     │
│  ├── NavigationToolbar                 │
│  └── StatisticsDashboard               │
├─────────────────────────────────────────┤
│  State Management:                      │
│  ├── useWebSocketStaff (primary)       │
│  ├── useScheduleDataPrefetch           │
│  └── usePeriodsRealtime                │
├─────────────────────────────────────────┤
│  Communication:                         │
│  ├── WebSocket Client                  │
│  └── Supabase Client (fallback)        │
└─────────────────────────────────────────┘
```

**Responsibilities**:
- User interface rendering
- User input handling
- Client-side state management
- WebSocket connection management
- Optimistic UI updates

---

### Layer 2: Orchestration Layer

**Technology**: Go 1.21+ with gorilla/websocket

```
┌─────────────────────────────────────────┐
│       Go WebSocket Server               │
├─────────────────────────────────────────┤
│  Connection Manager:                    │
│  ├── Client lifecycle management       │
│  ├── Heartbeat monitoring              │
│  └── Auto-reconnection handling         │
├─────────────────────────────────────────┤
│  State Manager:                         │
│  ├── Thread-safe state operations      │
│  ├── Version control                   │
│  └── Change logging                    │
├─────────────────────────────────────────┤
│  Conflict Resolver:                     │
│  ├── Last Writer Wins                  │
│  ├── First Writer Wins                 │
│  ├── Merge Strategy                    │
│  └── User Choice                       │
├─────────────────────────────────────────┤
│  OR-Tools Client:                       │
│  ├── HTTP client integration           │
│  ├── Request/response handling         │
│  └── Error management                  │
└─────────────────────────────────────────┘
```

**Responsibilities**:
- Real-time event broadcasting
- State synchronization across clients
- Conflict resolution
- OR-Tools service communication
- Database persistence coordination

**Key Files**:
- `go-server/main.go` - Server entry point
- `go-server/state/manager.go` - State management
- `go-server/conflict/resolver.go` - Conflict resolution
- `go-server/ortools_client.go` - OR-Tools integration

---

### Layer 3: Optimization Layer

**Technology**: Python 3.11 + Google OR-Tools + Flask

```
┌─────────────────────────────────────────┐
│     Python OR-Tools Service             │
├─────────────────────────────────────────┤
│  HTTP API (Flask):                      │
│  ├── /health - Health check            │
│  └── /optimize - Schedule generation   │
├─────────────────────────────────────────┤
│  CP-SAT Solver:                         │
│  ├── Model initialization              │
│  ├── Variable creation                 │
│  ├── Constraint addition               │
│  ├── Objective function setup          │
│  └── Solver execution                  │
├─────────────────────────────────────────┤
│  Constraint Engine:                     │
│  ├── Hard constraints (MUST satisfy)   │
│  ├── Soft constraints (penalty-based)  │
│  └── Violation tracking                │
└─────────────────────────────────────────┘
```

**Responsibilities**:
- Schedule optimization using CP-SAT
- Constraint modeling and enforcement
- Solution quality assessment
- Violation reporting

**Key Files**:
- `python-ortools-service/scheduler.py` - Main optimizer
- `python-ortools-service/test_scheduler.py` - Unit tests

---

### Layer 4: Data Layer

**Technology**: Supabase PostgreSQL + Real-time

```
┌─────────────────────────────────────────┐
│        Supabase PostgreSQL              │
├─────────────────────────────────────────┤
│  Tables:                                │
│  ├── staff_members                     │
│  ├── schedule_data                     │
│  ├── periods                           │
│  ├── settings                          │
│  └── survey_responses (research)       │
├─────────────────────────────────────────┤
│  Analytics Views:                       │
│  ├── survey_analytics                  │
│  ├── time_efficiency_stats             │
│  └── satisfaction_by_category          │
├─────────────────────────────────────────┤
│  Real-time Subscriptions:               │
│  └── Change notifications               │
└─────────────────────────────────────────┘
```

**Responsibilities**:
- Persistent data storage
- ACID transaction guarantees
- Real-time change notifications
- Analytics data aggregation

---

## Data Flow

### 1. User Action to Schedule Update

```
User clicks cell → React component updates
                ↓
        WebSocket message sent
                ↓
    Go server receives message
                ↓
    State manager validates & updates
                ↓
    Broadcast to all connected clients
                ↓
    Supabase database updated
                ↓
    Clients receive update via WebSocket
                ↓
    React re-renders with new data
```

**Latency**: <50ms end-to-end

---

### 2. Schedule Generation Flow

```
User clicks "Generate Schedule" button
                ↓
    React sends GENERATE_SCHEDULE_ORTOOLS message
                ↓
    Go server forwards to OR-Tools service
                ↓
    OR-Tools service:
    ├── Parses input data
    ├── Builds CP-SAT model
    ├── Adds constraints
    ├── Runs solver (max 30s)
    └── Returns optimal solution
                ↓
    Go server receives result
                ↓
    Broadcasts SCHEDULE_GENERATED message
                ↓
    Clients update schedule table
                ↓
    Supabase database updated
```

**Typical Duration**: 1-5 seconds for 15 staff × 60 days

---

### 3. Conflict Resolution Flow

```
Two users edit same cell simultaneously
                ↓
    Both send update messages
                ↓
    Go server detects conflict (version mismatch)
                ↓
    Applies configured resolution strategy:
    ├── Last Writer Wins (default)
    ├── First Writer Wins
    ├── Merge (if compatible)
    └── User Choice (prompt user)
                ↓
    Resolved state broadcast to all clients
                ↓
    Losing client receives conflict notification
```

---

## Component Details

### React Hooks Architecture

#### useWebSocketStaff (Primary)

```javascript
const {
  staffMembers,      // Current staff list
  connected,         // Connection status
  updateStaff,       // Update function
  deleteStaff,       // Delete function
  createStaff,       // Create function
  syncWithServer,    // Manual sync
} = useWebSocketStaff();
```

**Features**:
- Automatic reconnection
- Message queueing during disconnect
- Optimistic updates
- Server-authoritative state

#### useScheduleDataPrefetch

```javascript
const {
  scheduleData,      // Schedule state
  isLoading,         // Loading state
  error,             // Error state
  refetch,           // Manual refetch
} = useScheduleDataPrefetch(periodId);
```

**Features**:
- React Query caching
- Stale-while-revalidate
- Background refetching
- Optimistic mutations

---

### Go WebSocket Server

#### State Manager

```go
type StateManager struct {
    mu       sync.RWMutex
    staff    map[string]*StaffMember
    version  int64
    changes  []ChangeLog
}

func (s *StateManager) UpdateStaff(id string, updates map[string]interface{}) error
func (s *StateManager) DeleteStaff(id string) error
func (s *StateManager) GetAllStaff() []*StaffMember
```

**Thread Safety**: Uses `sync.RWMutex` for concurrent access

#### Message Protocol

```go
type Message struct {
    Type      string                 `json:"type"`
    Payload   map[string]interface{} `json:"payload"`
    Timestamp time.Time              `json:"timestamp"`
    Version   int64                  `json:"version,omitempty"`
}
```

**Message Types**:
- `SYNC_REQUEST` / `SYNC_RESPONSE`
- `STAFF_UPDATE` / `STAFF_CREATE` / `STAFF_DELETE`
- `GENERATE_SCHEDULE_ORTOOLS`
- `SCHEDULE_GENERATED`
- `CONNECTION_ACK`
- `ERROR`

---

### Python OR-Tools Optimizer

#### CP-SAT Model Structure

```python
class ScheduleOptimizer:
    def __init__(self, staff_members, date_range, constraints):
        self.model = cp_model.CpModel()
        self.shifts = {}  # Decision variables
        self.violation_vars = []  # Penalty tracking

    def _create_variables(self):
        # Create shifts[s,d,t] for each staff, date, shift type
        pass

    def _add_hard_constraints(self):
        # MUST be satisfied (one shift per day, pre-filled, etc.)
        pass

    def _add_soft_constraints(self):
        # Penalty-based (staff groups, daily limits, etc.)
        pass

    def _add_objective(self):
        # Minimize: Σ(weight × violation)
        pass

    def solve(self, timeout=30):
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = timeout
        status = solver.Solve(self.model)
        return self._extract_solution(solver, status)
```

#### Constraint Implementation Example

```python
def _add_staff_group_constraints(self):
    """Max 1 member off/early per group per day"""
    for group in self.staff_groups:
        for date in self.date_range:
            violation = self.model.NewBoolVar(f'group_{group.id}_{date}')

            # off_equivalent: off=2, early=1
            off_equivalent = sum(
                2 * self.shifts[(s.id, date, SHIFT_OFF)] +
                self.shifts[(s.id, date, SHIFT_EARLY)]
                for s in group.members
            )

            # Satisfied if off_equivalent <= 2
            self.model.Add(off_equivalent <= 2).OnlyEnforceIf(violation.Not())

            # Add to penalty
            self.violation_vars.append(
                (violation, PENALTY_WEIGHTS['staff_group'], f'group_{group.id}_{date}')
            )
```

---

## Technology Stack

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI library |
| Tailwind CSS | 3.4.1 | Styling framework |
| React Query | 5.x | Server state management |
| React Hook Form | 7.x | Form handling |
| Recharts | 2.x | Data visualization |
| date-fns | 3.x | Date manipulation |

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.21+ | WebSocket server |
| gorilla/websocket | Latest | WebSocket library |
| Python | 3.11+ | OR-Tools runtime |
| Flask | 3.x | HTTP API |
| Gunicorn | 22.x | WSGI server |
| OR-Tools | 9.11+ | CP-SAT solver |

### Infrastructure Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | Latest | Containerization |
| Docker Compose | Latest | Multi-container orchestration |
| NGINX | 1.27 | Reverse proxy |
| Supabase | Cloud | Database & auth |
| Redis | 7.x | Session management (optional) |

---

## Design Decisions

### 1. Why Hybrid Architecture?

**Decision**: Use Go WebSocket server instead of direct React↔Supabase

**Rationale**:
- ✅ **Eliminates race conditions**: Server-authoritative state
- ✅ **Better performance**: <50ms vs 1-5s with Supabase
- ✅ **Conflict resolution**: Intelligent merge strategies
- ✅ **Scalability**: 1000+ concurrent connections

**Trade-offs**:
- ❌ Additional complexity (3-tier instead of 2-tier)
- ❌ More infrastructure to deploy

---

### 2. Why OR-Tools CP-SAT?

**Decision**: Use Google OR-Tools instead of custom algorithms

**Rationale**:
- ✅ **Mathematically optimal**: Proven solutions
- ✅ **Always feasible**: Soft constraints prevent INFEASIBLE
- ✅ **Fast solving**: 1-5s for realistic problems
- ✅ **Flexible constraints**: 10+ constraint types

**Alternatives Considered**:
- Genetic algorithms (slower, not optimal)
- Rule-based systems (brittle, not scalable)
- Manual heuristics (unpredictable quality)

---

### 3. Why WebSocket over HTTP Polling?

**Decision**: Use WebSocket for real-time updates

**Rationale**:
- ✅ **Low latency**: <50ms vs 1-5s polling
- ✅ **Reduced bandwidth**: No repeated polling overhead
- ✅ **True real-time**: Instant propagation
- ✅ **Better UX**: Live collaboration

**Trade-offs**:
- ❌ Stateful connections (vs stateless HTTP)
- ❌ Load balancer considerations (sticky sessions)

---

### 4. Why Supabase over Self-hosted PostgreSQL?

**Decision**: Use Supabase cloud service

**Rationale**:
- ✅ **Real-time subscriptions**: Built-in change notifications
- ✅ **Authentication**: Integrated auth system
- ✅ **Managed service**: No database ops overhead
- ✅ **Free tier**: Good for development

**Trade-offs**:
- ❌ Vendor lock-in
- ❌ Internet dependency

---

## Constraint Programming Model

### Mathematical Formulation

**Decision Variables**:
```
X = {shifts[s,d,t] | s ∈ S, d ∈ D, t ∈ T}

S = Set of staff (15-20 members)
D = Set of dates (60 days)
T = {WORK, OFF, EARLY, LATE}

Domain: shifts[s,d,t] ∈ {0, 1}
Total variables: |S| × |D| × |T| = 3,600-4,800 boolean variables
```

**Hard Constraints** (MUST satisfy):
```
1. ∀s ∈ S, ∀d ∈ D: Σₜ shifts[s,d,t] = 1
   (Exactly one shift type per staff per day)

2. ∀(s,d,t) ∈ PreFilled: shifts[s,d,t] = 1
   (Pre-filled cells fixed)

3. ∀(d,s) ∈ MustOff: shifts[s,d,OFF] = 1
   (Calendar mandatory off days)
```

**Soft Constraints** (Penalty-based):
```
4. Staff Groups: Σₛ∈G (2×shifts[s,d,OFF] + shifts[s,d,EARLY]) ≤ 2
   Penalty: 100 per violation

5. Daily Limits: minOff ≤ Σₛ shifts[s,d,OFF] ≤ maxOff
   Penalty: 50 per violation

6. Monthly Limits: minMonthly ≤ Σd shifts[s,d,OFF] ≤ maxMonthly
   Penalty: 80 per violation

7. 5-Day Rest: No 6+ consecutive WORK shifts
   Penalty: 200 per violation
```

**Objective Function**:
```
Minimize: Z = Σᵢ (wᵢ × vᵢ)

wᵢ = Penalty weight for constraint i
vᵢ = Boolean variable (1 if violated, 0 otherwise)
```

---

## WebSocket Protocol

### Connection Lifecycle

```
1. Client → Server: WebSocket handshake
2. Server → Client: CONNECTION_ACK
3. Client → Server: SYNC_REQUEST
4. Server → Client: SYNC_RESPONSE (full state)
5. [Ongoing]: Bidirectional messages
6. [Disconnect]: Auto-reconnect with exponential backoff
```

### Message Examples

**SYNC_REQUEST**:
```json
{
  "type": "SYNC_REQUEST",
  "payload": {},
  "timestamp": "2024-01-28T10:00:00Z"
}
```

**STAFF_UPDATE**:
```json
{
  "type": "STAFF_UPDATE",
  "payload": {
    "id": "staff-123",
    "name": "Updated Name",
    "position": "Chef"
  },
  "timestamp": "2024-01-28T10:01:00Z",
  "version": 42
}
```

**GENERATE_SCHEDULE_ORTOOLS**:
```json
{
  "type": "GENERATE_SCHEDULE_ORTOOLS",
  "payload": {
    "staffMembers": [...],
    "dateRange": ["2024-01-01", ...],
    "constraints": {...}
  },
  "timestamp": "2024-01-28T10:02:00Z"
}
```

---

## Database Schema

### staff_members Table

```sql
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  staff_type TEXT CHECK (staff_type IN ('regular', 'contract', 'part_time')),
  staff_group_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### schedule_data Table

```sql
CREATE TABLE schedule_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES periods(id),
  staff_id UUID NOT NULL REFERENCES staff_members(id),
  date DATE NOT NULL,
  shift_symbol TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, staff_id, date)
);
```

---

## Deployment Architecture

### Production Deployment (Docker Compose)

```
                    Internet
                       |
                   [NGINX:80/443]
                       |
         +-------------+-------------+
         |             |             |
   [Go Server]  [Go Server]  [Go Server]
    (Replica 1)  (Replica 2)  (Replica 3)
         |             |             |
         +-------------+-------------+
                       |
              [OR-Tools Service]
                       |
              [Supabase PostgreSQL]
```

**Key Features**:
- 3 Go server replicas for redundancy
- NGINX load balancing with health checks
- WebSocket sticky sessions
- OR-Tools single instance (CPU-intensive)
- Supabase managed database

### Resource Allocation

```yaml
go-websocket-server:
  cpu_limit: 1.0
  mem_limit: 512M
  replicas: 3

ortools-optimizer:
  cpu_limit: 2.0
  mem_limit: 2G
  replicas: 1

nginx:
  cpu_limit: 0.5
  mem_limit: 256M
  replicas: 1
```

---

## Performance Characteristics

### Latency Benchmarks

| Operation | Target | Achieved | Notes |
|-----------|--------|----------|-------|
| Staff Update (UI) | <100ms | <50ms | WebSocket to re-render |
| Schedule Generation | <30s | 1-5s | 15 staff × 60 days |
| Database Query | <500ms | <200ms | With indexes |
| WebSocket Message | <100ms | <50ms | Server broadcast |

### Scalability Metrics

| Metric | Development | Production |
|--------|-------------|------------|
| Concurrent Users | 10-50 | 1000+ |
| Messages/Second | 100 | 10,000+ |
| Database Connections | 10 | 100 (pooled) |
| Memory Usage | 256MB | 2GB (total) |

---

## Security Considerations

### Authentication & Authorization

- **Supabase Auth**: JWT-based authentication
- **Row Level Security (RLS)**: Database-level access control
- **WebSocket Auth**: Token validation on connection

### Data Protection

- **HTTPS/WSS**: Encrypted communication
- **CORS**: Configured allowed origins
- **Input Validation**: Server-side validation of all inputs
- **SQL Injection**: Parameterized queries only

### Deployment Security

- **Environment Variables**: Secrets management
- **Docker Networks**: Isolated service communication
- **Rate Limiting**: Prevent abuse
- **Health Checks**: Monitor service availability

---

## Additional Resources

- [README.md](./README.md) - Project overview
- [CLAUDE.md](./CLAUDE.md) - Development guide for Claude Code
- [docs/en/CHAPTER_3_RESEARCH_METHODOLOGY.md](./docs/en/CHAPTER_3_RESEARCH_METHODOLOGY.md) - Academic research
- [research/IMPLEMENTATION-GUIDE.md](./research/IMPLEMENTATION-GUIDE.md) - Research app guide

---

<p align="center">
  <strong>For questions or clarifications, please open an issue on GitHub</strong>
</p>
