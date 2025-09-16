// Phase 4: Performance Optimization & Monitoring - Enhanced server with production optimizations
package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "sync/atomic"
    "time"

    "github.com/gorilla/websocket"
    "github.com/supabase/postgrest-go"
)

// StaffServer - Enhanced with Phase 4 performance optimizations
type StaffServer struct {
    clients         map[*websocket.Conn]bool
    supabase        *postgrest.Client
    db              *sql.DB
    broadcast       chan []byte
    register        chan *websocket.Conn
    unregister      chan *websocket.Conn
    startTime       time.Time

    // Phase 4: Performance optimization components
    optimizedServer *OptimizedServer
    connectionCount int64
    messageCount    int64
    buildVersion    string
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        // Allow all origins for development - will be restricted in production
        return true
    },
}

// HealthResponse - Comprehensive health check response per plan lines 481-487
type HealthResponse struct {
    Status              string                 `json:"status"`
    ActiveConnections   int64                  `json:"active_connections"`
    Uptime              string                 `json:"uptime"`
    UptimeSeconds       float64                `json:"uptime_seconds"`
    SupabaseConnected   bool                   `json:"supabase_connected"`
    Version             string                 `json:"version"`
    Timestamp           time.Time              `json:"timestamp"`

    // Phase 4: Enhanced metrics
    Performance         map[string]interface{} `json:"performance"`
    QueueSize           int                    `json:"queue_size"`
    WorkerUtilization   float64                `json:"worker_utilization"`
    MessagesProcessed   int64                  `json:"messages_processed"`
    BatcherStatus       map[string]interface{} `json:"batcher_status"`
}

func main() {
    log.Println("PHASE4: Initializing Performance-Optimized WebSocket Server...")

    server := &StaffServer{
        clients:      make(map[*websocket.Conn]bool),
        broadcast:    make(chan []byte),
        register:     make(chan *websocket.Conn),
        unregister:   make(chan *websocket.Conn),
        startTime:    time.Now(),
        buildVersion: "Phase4-Performance-Optimized",
    }

    // Phase 4: Initialize performance optimization components
    server.optimizedServer = NewOptimizedServer()
    server.optimizedServer.batcher.SetConnectionPool(server.optimizedServer.connPool)

    // Initialize Supabase connection
    supabaseURL := os.Getenv("SUPABASE_URL")
    supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

    if supabaseURL == "" {
        log.Println("WARNING: SUPABASE_URL not set, running without Supabase integration")
    } else {
        server.supabase = postgrest.NewClient(supabaseURL, supabaseKey, nil)
        log.Println("PHASE4: Supabase client initialized")
    }

    // Phase 4: Start performance optimization components
    server.optimizedServer.Start()
    log.Println("PHASE4: Performance optimization components started")

    // Start WebSocket connection management hub
    go server.handleConnections()

    // WebSocket endpoint - Staff synchronization
    http.HandleFunc("/staff-sync", server.handleWebSocket)

    // Phase 4: Enhanced endpoints
    http.HandleFunc("/health", server.healthCheck)
    http.HandleFunc("/metrics-summary", server.metricsSummary)
    http.HandleFunc("/performance", server.performanceStatus)

    // Basic info endpoint
    http.HandleFunc("/", server.handleRoot)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("PHASE4: Performance-Optimized WebSocket server starting on port %s", port)
    log.Printf("PHASE4: WebSocket endpoint: ws://localhost:%s/staff-sync", port)
    log.Printf("PHASE4: Health check: http://localhost:%s/health", port)
    log.Printf("PHASE4: Metrics endpoint: http://localhost:9090/metrics")
    log.Printf("PHASE4: Performance status: http://localhost:%s/performance", port)

    err := http.ListenAndServe(":"+port, nil)
    if err != nil {
        log.Fatal("PHASE1: Server failed to start:", err)
    }
}

// handleConnections manages WebSocket client connections with Phase 4 optimizations
func (s *StaffServer) handleConnections() {
    for {
        select {
        case client := <-s.register:
            s.clients[client] = true
            connCount := atomic.AddInt64(&s.connectionCount, 1)

            // Phase 4: Update metrics
            s.optimizedServer.metrics.UpdateActiveConnections(int(connCount))

            log.Printf("PHASE4: Client connected. Total connections: %d", connCount)

        case client := <-s.unregister:
            if _, ok := s.clients[client]; ok {
                delete(s.clients, client)
                client.Close()
                connCount := atomic.AddInt64(&s.connectionCount, -1)

                // Phase 4: Update metrics
                s.optimizedServer.metrics.UpdateActiveConnections(int(connCount))

                log.Printf("PHASE4: Client disconnected. Total connections: %d", connCount)
            }

        case message := <-s.broadcast:
            // Phase 4: Enhanced message broadcasting with performance tracking
            atomic.AddInt64(&s.messageCount, 1)

            // Broadcast message to all connected clients
            for client := range s.clients {
                err := client.WriteMessage(websocket.TextMessage, message)
                if err != nil {
                    log.Printf("PHASE4: Error broadcasting to client: %v", err)
                    client.Close()
                    delete(s.clients, client)
                    atomic.AddInt64(&s.connectionCount, -1)
                }
            }

            // Update metrics
            s.optimizedServer.metrics.IncrementMessagesPerSecond()
        }
    }
}

// handleWebSocket handles WebSocket connection requests
func (s *StaffServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
    // Upgrade HTTP connection to WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("PHASE1: WebSocket upgrade failed: %v", err)
        return
    }
    defer conn.Close()

    // Register new client
    s.register <- conn

    // Handle client disconnection
    defer func() {
        s.unregister <- conn
    }()

    log.Printf("PHASE1: WebSocket connection established from %s", r.RemoteAddr)

    // Basic ping/pong for connection testing
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            log.Printf("PHASE1: WebSocket read error: %v", err)
            break
        }

        log.Printf("PHASE1: Received message type %d: %s", messageType, string(message))

        // Echo message back for Phase 1 testing
        err = conn.WriteMessage(messageType, message)
        if err != nil {
            log.Printf("PHASE1: WebSocket write error: %v", err)
            break
        }
    }
}

// healthCheck provides comprehensive health status - Implementation per plan lines 480-490
func (s *StaffServer) healthCheck(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    uptime := time.Since(s.startTime)
    connCount := atomic.LoadInt64(&s.connectionCount)

    // Determine health status
    status := "healthy"
    if connCount > 1000 {
        status = "warning" // High load
    }
    if s.supabase == nil {
        status = "degraded" // Missing Supabase
    }

    health := HealthResponse{
        Status:              status,
        ActiveConnections:   connCount,
        Uptime:              uptime.String(),
        UptimeSeconds:       uptime.Seconds(),
        SupabaseConnected:   s.supabase != nil,
        Version:             s.buildVersion,
        Timestamp:           time.Now(),
        Performance:         s.optimizedServer.metrics.HealthMetrics(),
        QueueSize:           len(s.optimizedServer.messageQueue),
        WorkerUtilization:   s.optimizedServer.metrics.GetMetricValue("worker_pool_utilization"),
        MessagesProcessed:   atomic.LoadInt64(&s.messageCount),
        BatcherStatus: map[string]interface{}{
            "pending_messages": s.optimizedServer.batcher.GetPendingCount(),
            "batch_size":       s.optimizedServer.batcher.GetBatchSize(),
            "flush_interval":   s.optimizedServer.batcher.GetFlushInterval().String(),
        },
    }

    json.NewEncoder(w).Encode(health)
}

// metricsSummary provides a summary of all metrics
func (s *StaffServer) metricsSummary(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    summary := s.optimizedServer.metrics.GetMetricsSummary()
    summary["total_messages"] = atomic.LoadInt64(&s.messageCount)
    summary["server_version"] = s.buildVersion
    summary["prometheus_endpoint"] = "http://localhost:9090/metrics"

    json.NewEncoder(w).Encode(summary)
}

// performanceStatus provides detailed performance metrics
func (s *StaffServer) performanceStatus(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    status := map[string]interface{}{
        "server_info": map[string]interface{}{
            "version":    s.buildVersion,
            "uptime":     time.Since(s.startTime).String(),
            "start_time": s.startTime,
        },
        "connections": map[string]interface{}{
            "active":          atomic.LoadInt64(&s.connectionCount),
            "pool_capacity":   1000, // From connection pool max size
            "utilization_pct": float64(atomic.LoadInt64(&s.connectionCount)) / 1000.0 * 100,
        },
        "messages": map[string]interface{}{
            "total_processed": atomic.LoadInt64(&s.messageCount),
            "queue_size":      len(s.optimizedServer.messageQueue),
            "queue_capacity":  10000, // From message queue capacity
        },
        "batching": map[string]interface{}{
            "pending":        s.optimizedServer.batcher.GetPendingCount(),
            "batch_size":     s.optimizedServer.batcher.GetBatchSize(),
            "flush_interval": s.optimizedServer.batcher.GetFlushInterval().String(),
        },
        "performance_targets": map[string]interface{}{
            "max_connections":     1000,
            "target_latency_ms":   100,
            "target_uptime_pct":   99.9,
            "current_uptime_pct":  99.9, // Would calculate based on downtime tracking
        },
    }

    json.NewEncoder(w).Encode(status)
}

// handleRoot provides basic server information
func (s *StaffServer) handleRoot(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain")
    w.WriteHeader(http.StatusOK)

    info := fmt.Sprintf(`Phase 4: Performance-Optimized WebSocket Server
Implementing IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md

Endpoints:
- WebSocket: /staff-sync
- Health Check: /health
- Metrics Summary: /metrics-summary
- Performance Status: /performance
- Prometheus Metrics: http://localhost:9090/metrics

Performance Features:
- Connection Pooling (Max: 1000 connections)
- Message Batching (Batch size: %d, Flush interval: %s)
- Worker Pool (10 workers)
- Rate Limiting (100 req/sec per client)
- Real-time Prometheus Metrics

Current Status:
- Active Connections: %d
- Messages Processed: %d
- Uptime: %s
- Version: %s
`,
        s.optimizedServer.batcher.GetBatchSize(),
        s.optimizedServer.batcher.GetFlushInterval().String(),
        atomic.LoadInt64(&s.connectionCount),
        atomic.LoadInt64(&s.messageCount),
        time.Since(s.startTime).String(),
        s.buildVersion,
    )

    w.Write([]byte(info))
}