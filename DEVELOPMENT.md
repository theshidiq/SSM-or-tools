# Development Guide

## Quick Start

### Starting the Development Environment

Simply run:

```bash
npm start
```

This will automatically start **both** the React development server and the Go WebSocket server concurrently.

**What happens:**
- 🌐 **React App** starts on `http://localhost:3001` (cyan console output)
- 🔌 **Go WebSocket Server** starts on `ws://localhost:8080` (green console output)

### Individual Server Control

If you need to start servers individually:

```bash
# Start only React (without WebSocket)
npm run start:react

# Start only Go WebSocket server
npm run start:go
```

### Stopping the Servers

Press `Ctrl+C` in the terminal running `npm start`. This will stop both servers automatically due to the `--kill-others-on-fail` flag.

---

## Architecture

### Multi-Server Setup

The application uses a hybrid architecture with two servers:

1. **React Development Server** (Port 3001)
   - Serves the React application
   - Hot module replacement (HMR)
   - Development tools

2. **Go WebSocket Server** (Port 8080)
   - Handles real-time staff synchronization
   - Server-authoritative state management
   - Conflict resolution and broadcasting

### Connection Flow

```
Browser → React App (localhost:3001) → WebSocket (localhost:8080) → Go Server
                                     ↓
                                 Supabase (fallback/persistence)
```

---

## Configuration

### Port Configuration

- **React**: Port 3001 (configurable via `PORT` environment variable)
- **Go Server**: Port 8080 (configurable via `WEBSOCKET_PORT` environment variable)

### Environment Variables

Create a `.env` file in the project root:

```bash
# React App
PORT=3001
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_WEBSOCKET_URL=ws://localhost:8080
REACT_APP_WEBSOCKET_STAFF_MANAGEMENT=true

# Go Server
WEBSOCKET_PORT=8080
GO_ENV=development
SUPABASE_SERVICE_KEY=your_service_key
```

---

## Troubleshooting

### WebSocket Connection Fails

**Symptom:** App shows "Offline Mode" or "Database Fallback"

**Solutions:**

1. **Verify Go server is running:**
   ```bash
   lsof -i :8080 | grep main
   ```

2. **Check console for errors:**
   - Open browser DevTools → Console
   - Look for `ERR_CONNECTION_REFUSED` messages

3. **Restart both servers:**
   ```bash
   # Stop current process (Ctrl+C)
   npm start
   ```

### Port Already in Use

**Symptom:** Error message like `EADDRINUSE: address already in use`

**Solutions:**

1. **Find and kill the process:**
   ```bash
   # For React (port 3001)
   lsof -ti:3001 | xargs kill -9

   # For Go server (port 8080)
   lsof -ti:8080 | xargs kill -9
   ```

2. **Change the port:**
   - React: Set `PORT=3002` in `.env`
   - Go: Set `WEBSOCKET_PORT=8081` in `.env`

### Go Dependencies Missing

**Symptom:** `go run main.go` fails with missing dependencies

**Solution:**
```bash
cd go-server
go mod download
go mod tidy
```

---

## Development Workflow

### Making Changes

#### React Frontend Changes
- Edit files in `src/`
- Changes auto-reload via HMR
- No server restart needed

#### Go Backend Changes
- Edit files in `go-server/`
- **Restart required**: Press `Ctrl+C` and run `npm start` again
- Or use Air for Go hot reload:
  ```bash
  cd go-server && air
  ```

### Testing

```bash
# Run all tests
npm test

# Test WebSocket connection
npm run test:integration

# Load testing
npm run test:load
```

---

## Production Deployment

### Building for Production

```bash
# Build React app
npm run build

# Build Go binary
cd go-server && go build -o staff-sync-server main.go
```

### Docker Deployment

```bash
# Start all services (NGINX + Go + Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Production URLs:**
- Application: `http://localhost:80`
- WebSocket: `ws://localhost:80/ws/` (proxied through NGINX)

---

## Useful Commands

### Development
```bash
npm start           # Start both React + Go server
npm run dev         # Alias for npm start
npm test            # Run tests in watch mode
```

### Code Quality
```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting issues
npm run format      # Format code with Prettier
npm run validate    # Run linting + tests
```

### Performance
```bash
npm run analyze     # Analyze bundle size
npm run performance # Run Lighthouse audit
npm run test:load   # WebSocket load testing
```

### Deployment
```bash
npm run build               # Production build
npm run build:production    # Optimized production build
npm run docker:dev          # Start Docker environment
npm run docker:stop         # Stop Docker containers
```

---

## Additional Resources

- **Implementation Plan**: See `PREFETCH_IMPLEMENTATION_PLAN.md` for upcoming architecture improvements
- **Testing Strategy**: See test scripts for comprehensive testing approach
- **Chrome MCP**: Browser automation and E2E testing framework

---

## Support

If you encounter issues:

1. Check console logs (browser and terminal)
2. Verify environment variables
3. Ensure Go is installed: `go version`
4. Check Node version: `node --version` (requires >= 16.0.0)
5. Clear cache: `npm run clean && npm install`

For WebSocket issues specifically, see the troubleshooting section above.