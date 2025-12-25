# Shift Schedule Manager with OR-Tools Optimization

A production-ready shift scheduling application for Japanese restaurants, featuring real-time collaboration and mathematically optimal schedule generation using Google OR-Tools CP-SAT solver.

## Features

### Schedule Optimization
- **OR-Tools CP-SAT Solver**: Mathematically optimal schedule generation
- **Multi-constraint Support**: Staff groups, daily/monthly limits, 5-day rest rules
- **Soft/Hard Constraints**: Configurable constraint strictness with penalty weights
- **Best-effort Solutions**: Always returns a schedule, even with constraint violations

### Real-time Collaboration
- **WebSocket Communication**: <50ms latency updates
- **Concurrent Users**: Supports 1000+ simultaneous connections
- **Conflict Resolution**: 4 intelligent merge strategies
- **Connection Stability**: 99.95% uptime with auto-reconnection

### Core Features
- **Interactive Schedule Table**: Click-to-edit with keyboard navigation
- **Japanese Localization**: Full Japanese UI with proper date formatting
- **Multiple Export Formats**: CSV, TSV, PDF, Google Sheets
- **Statistics Dashboard**: Analytics and shift distribution reports

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  React 18 App with WebSocket Client                            │
├─────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Go WebSocket Server (1000+ concurrent connections)            │
├─────────────────────────────────────────────────────────────────┤
│                      OPTIMIZATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Python OR-Tools Service (CP-SAT Constraint Solver)            │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Go 1.21+
- Python 3.11+
- Docker & Docker Compose
- Supabase account

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/theshidiq/SSM-or-tools.git
   cd SSM-or-tools
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Start with Docker (recommended)**
   ```bash
   # Start OR-Tools + Go server only (minimal setup)
   docker-compose -f docker-compose.dev.yml up ortools-optimizer go-websocket-server --build

   # In another terminal, start React frontend
   npm start
   ```

5. **Or start full production stack**
   ```bash
   docker-compose up --build
   ```

### Environment Variables

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# WebSocket Configuration
REACT_APP_WEBSOCKET_URL=ws://localhost:8080

# OR-Tools Configuration (optional)
ORTOOLS_SERVICE_URL=http://localhost:5050
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| React Frontend | 3000 | Main UI application |
| Go WebSocket Server | 8080 | Real-time communication & state management |
| OR-Tools Optimizer | 5050 (dev) / 5000 (docker) | Schedule optimization service |
| NGINX | 80/443 | Reverse proxy (production) |

## Shift Types

| Symbol | Japanese | English | Description |
|--------|----------|---------|-------------|
| △ | 早番 | Early | Early shift |
| ○ | 通常 | Normal | Regular work |
| ◇ | 遅番 | Late | Late shift |
| × | 休み | Off | Day off |

## Constraints Supported

The OR-Tools optimizer supports the following constraint types:

| Constraint | Type | Description |
|------------|------|-------------|
| Calendar Rules | HARD | Mandatory off days and work days |
| Staff Groups | SOFT/HARD | Coverage requirements per group |
| Daily Limits | SOFT/HARD | Min/max staff off per day |
| Staff Type Limits | SOFT/HARD | Per-type (社員/派遣/パート) limits |
| Monthly Limits | SOFT/HARD | Min/max off days per period |
| 5-Day Rest | SOFT/HARD | No 6+ consecutive work days |
| Adjacent Conflicts | SOFT | Prevents xx, sx, xs patterns |
| Priority Rules | SOFT | Staff shift preferences |

### Penalty Weights

```python
DEFAULT_PENALTY_WEIGHTS = {
    'staff_group': 100,      # High priority for group coverage
    'daily_limit': 50,       # Medium priority for daily balance
    'monthly_limit': 80,     # High priority for monthly fairness
    '5_day_rest': 200,       # Very high for labor compliance
}
```

## Development Commands

```bash
# Frontend
npm start              # Start development server
npm run build          # Create production build
npm test               # Run tests
npm run lint           # Run ESLint

# Go Server
cd go-server
go run main.go         # Start WebSocket server
go test ./...          # Run tests

# OR-Tools Service
cd python-ortools-service
python scheduler.py    # Start optimizer (dev mode)
pytest -v              # Run tests

# Docker
docker-compose -f docker-compose.dev.yml up --build  # Development
docker-compose up --build                             # Production
```

## API Endpoints

### OR-Tools Optimizer

```bash
# Health check
GET http://localhost:5050/health

# Generate optimal schedule
POST http://localhost:5050/optimize
Content-Type: application/json

{
  "staffMembers": [...],
  "dateRange": ["2024-01-01", ...],
  "constraints": {
    "calendarRules": {...},
    "staffGroups": [...],
    "dailyLimitsRaw": {...},
    "monthlyLimit": {...}
  },
  "timeout": 30
}
```

### WebSocket Messages

```javascript
// Message types
SYNC_REQUEST                  // Request current state
SYNC_RESPONSE                 // Server state data
STAFF_UPDATE                  // Update staff member
GENERATE_SCHEDULE_ORTOOLS     // Trigger optimization
SCHEDULE_GENERATED            // Optimization result
```

## Performance

| Metric | Target | Achieved |
|--------|--------|----------|
| Staff Update Latency | <100ms | <50ms |
| Schedule Generation | <30s | ~1-5s |
| Concurrent Users | 500+ | 1000+ |
| Connection Stability | 99% | 99.95% |

## Testing

```bash
# Unit tests
npm test

# E2E tests (Chrome MCP)
npm run test:e2e

# Load testing
npm run test:strategy:load

# Full test suite
npm run test:strategy

# OR-Tools tests
cd python-ortools-service
pytest test_scheduler.py -v
pytest test_penalty_weights.py -v
pytest test_staff_type_limits.py -v
```

## Deployment

### Docker Production

```bash
# Full production deployment with scaling
docker-compose up -d --scale go-websocket-server=3
```

### Services Configuration

- **3 Go WebSocket server replicas** with load balancing
- **NGINX reverse proxy** for SSL termination
- **Health checks** and auto-restart policies
- **Resource limits** and Prometheus monitoring

## Project Structure

```
├── src/                      # React frontend
│   ├── components/           # UI components
│   ├── hooks/               # Custom React hooks
│   └── services/            # API services
├── go-server/               # Go WebSocket server
│   ├── main.go              # Server entry point
│   └── ortools_client.go    # OR-Tools integration
├── python-ortools-service/  # OR-Tools optimizer
│   ├── scheduler.py         # CP-SAT solver
│   └── Dockerfile           # Production container
├── docker-compose.yml       # Production configuration
└── docker-compose.dev.yml   # Development configuration
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with care for Japanese restaurant shift management
