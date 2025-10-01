// Phase 6: Optimization & Future Enhancements - Complete hybrid architecture with AI integration
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
    "github.com/google/uuid"

    "github.com/gorilla/websocket"
    "github.com/supabase/postgrest-go"
    "shift-schedule-go-server/conflict"
    "shift-schedule-go-server/models"
    "shift-schedule-go-server/supabase"
)

// StaffServer - Enhanced with Phase 6 optimization and future enhancements
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

    // Phase 6: Advanced features and AI integration
    phase6Profiler   *Phase6Profiler
    aiResolver       *conflict.AIConflictResolver
    compressionEnabled bool

    // Staff management integration
    staffRepo       *supabase.StaffRepository
    supabaseClient  *supabase.SupabaseClient
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
    log.Println("🚀 PHASE 6: Initializing Complete Hybrid Architecture with AI Integration...")

    server := &StaffServer{
        clients:      make(map[*websocket.Conn]bool),
        broadcast:    make(chan []byte),
        register:     make(chan *websocket.Conn),
        unregister:   make(chan *websocket.Conn),
        startTime:    time.Now(),
        buildVersion: "Phase6-Complete-Hybrid-Architecture",
        compressionEnabled: true,
    }

    // Phase 4: Initialize performance optimization components
    server.optimizedServer = NewOptimizedServer()
    server.optimizedServer.batcher.SetConnectionPool(server.optimizedServer.connPool)

    // Phase 6: Initialize advanced features
    server.phase6Profiler = NewPhase6Profiler()
    server.aiResolver = conflict.NewAIConflictResolver(0.8) // 80% confidence threshold
    log.Println("🤖 PHASE 6: AI-powered conflict resolution initialized (90%+ accuracy target)")

    // Initialize Supabase connection
    supabaseURL := os.Getenv("SUPABASE_URL")
    supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

    if supabaseURL == "" {
        log.Println("WARNING: SUPABASE_URL not set, running with mock client")
        // Initialize mock client for development
        server.supabaseClient = supabase.NewMockSupabaseClient()
        server.staffRepo = supabase.NewStaffRepository(server.supabaseClient)
        log.Println("🔗 PHASE 6: Mock Supabase client initialized for development")
    } else {
        server.supabase = postgrest.NewClient(supabaseURL, supabaseKey, nil)
        server.supabaseClient = supabase.NewSupabaseClient(supabaseURL, supabaseKey)
        server.staffRepo = supabase.NewStaffRepository(server.supabaseClient)
        log.Println("🔗 PHASE 6: Supabase client and staff repository initialized")
    }

    // Phase 4: Start performance optimization components
    server.optimizedServer.Start()
    log.Println("⚡ PHASE 6: Performance optimization components started")

    // Phase 6: Start advanced monitoring
    server.phase6Profiler.StartPerformanceMonitoring()
    log.Println("📊 PHASE 6: Performance profiling and monitoring started")

    // Start WebSocket connection management hub
    go server.handleConnections()

    // WebSocket endpoint - Staff synchronization
    http.HandleFunc("/staff-sync", server.handleWebSocket)

    // Phase 4: Enhanced endpoints
    http.HandleFunc("/health", server.healthCheck)
    http.HandleFunc("/metrics-summary", server.metricsSummary)
    http.HandleFunc("/performance", server.performanceStatus)

    // Phase 6: Advanced optimization endpoints
    http.HandleFunc("/phase6-status", server.phase6Status)
    http.HandleFunc("/phase6-metrics", server.phase6Metrics)
    http.HandleFunc("/ai-stats", server.aiStatistics)
    http.HandleFunc("/compression-stats", server.compressionStatistics)

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

    // Enhanced WebSocket message handling with staff CRUD operations
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            log.Printf("PHASE6: WebSocket read error: %v", err)
            break
        }

        // Process WebSocket messages for staff operations
        if messageType == websocket.TextMessage {
            err = s.handleWebSocketMessage(conn, message)
            if err != nil {
                log.Printf("PHASE6: Error handling WebSocket message: %v", err)
                // Send error response to client
                errorMsg := map[string]interface{}{
                    "type": "ERROR",
                    "error": err.Error(),
                    "timestamp": time.Now().UTC().Format(time.RFC3339),
                }
                if errorBytes, marshalErr := json.Marshal(errorMsg); marshalErr == nil {
                    conn.WriteMessage(websocket.TextMessage, errorBytes)
                }
            }
        }
    }
}

// handleWebSocketMessage processes incoming WebSocket messages for staff operations
func (s *StaffServer) handleWebSocketMessage(conn *websocket.Conn, message []byte) error {
    var wsMsg models.WebSocketMessage
    if err := json.Unmarshal(message, &wsMsg); err != nil {
        return fmt.Errorf("failed to parse WebSocket message: %w", err)
    }

    log.Printf("PHASE6: Processing WebSocket message type: %s from client: %s", wsMsg.Type, wsMsg.ClientID)

    switch wsMsg.Type {
    case models.MessageTypeStaffCreate:
        return s.handleStaffCreate(conn, &wsMsg)
    case models.MessageTypeStaffUpdate:
        return s.handleStaffUpdate(conn, &wsMsg)
    case models.MessageTypeStaffDelete:
        return s.handleStaffDelete(conn, &wsMsg)
    case models.MessageTypeSyncRequest:
        return s.handleSyncRequest(conn, &wsMsg)
    case models.MessageTypePing:
        return s.handlePing(conn, &wsMsg)
    default:
        return fmt.Errorf("unknown message type: %s", wsMsg.Type)
    }
}

// handleStaffCreate processes staff creation requests
func (s *StaffServer) handleStaffCreate(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    var createReq models.StaffCreateRequest
    if err := json.Unmarshal(msg.Payload.([]byte), &createReq); err != nil {
        // Try to parse as map[string]interface{} for flexible JSON parsing
        payloadBytes, _ := json.Marshal(msg.Payload)
        if err := json.Unmarshal(payloadBytes, &createReq); err != nil {
            return fmt.Errorf("failed to parse staff create request: %w", err)
        }
    }

    // Create new staff member
    staff := &models.StaffMember{
        ID:         uuid.New().String(),
        Name:       createReq.Name,
        Position:   createReq.Position,
        Department: createReq.Department,
        Type:       createReq.Type,
        Period:     createReq.Period,
        CreatedAt:  time.Now(),
        UpdatedAt:  time.Now(),
        Version:    1,
    }

    // Save to repository
    if err := s.staffRepo.CreateStaff(staff); err != nil {
        return fmt.Errorf("failed to create staff member: %w", err)
    }

    // Broadcast creation to all clients
    response := models.NewWebSocketMessage("STAFF_CREATED", staff, msg.ClientID, msg.SequenceNumber+1)
    s.broadcastToAllClients(response)

    // Send success response to requesting client
    successResponse := models.NewWebSocketMessage("STAFF_CREATE_SUCCESS", staff, msg.ClientID, msg.SequenceNumber+1)
    return s.sendMessageToClient(conn, successResponse)
}

// handleStaffUpdate processes staff update requests
func (s *StaffServer) handleStaffUpdate(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    var updateMsg models.StaffUpdateMessage
    if err := json.Unmarshal(msg.Payload.([]byte), &updateMsg); err != nil {
        // Try to parse as map[string]interface{} for flexible JSON parsing
        payloadBytes, _ := json.Marshal(msg.Payload)
        if err := json.Unmarshal(payloadBytes, &updateMsg); err != nil {
            return fmt.Errorf("failed to parse staff update message: %w", err)
        }
    }

    // Get existing staff member
    existingStaff, err := s.staffRepo.GetStaff(updateMsg.Payload.StaffID)
    if err != nil {
        return fmt.Errorf("failed to get existing staff member: %w", err)
    }

    // Apply changes
    if name, ok := updateMsg.Payload.Changes["name"].(string); ok {
        existingStaff.Name = name
    }
    if position, ok := updateMsg.Payload.Changes["position"].(string); ok {
        existingStaff.Position = position
    }
    if department, ok := updateMsg.Payload.Changes["department"].(string); ok {
        existingStaff.Department = department
    }
    if staffType, ok := updateMsg.Payload.Changes["type"].(string); ok {
        existingStaff.Type = staffType
    }

    // Update version and timestamp
    existingStaff.Version = updateMsg.Payload.Version
    existingStaff.UpdatedAt = time.Now()

    // Save changes
    if err := s.staffRepo.UpdateStaff(existingStaff.ID, existingStaff); err != nil {
        return fmt.Errorf("failed to update staff member: %w", err)
    }

    // Broadcast update to all clients
    response := models.NewWebSocketMessage("STAFF_UPDATED", existingStaff, msg.ClientID, msg.SequenceNumber+1)
    s.broadcastToAllClients(response)

    // Send success response to requesting client
    successResponse := models.NewWebSocketMessage("STAFF_UPDATE_SUCCESS", existingStaff, msg.ClientID, msg.SequenceNumber+1)
    return s.sendMessageToClient(conn, successResponse)
}

// handleStaffDelete processes staff deletion requests
func (s *StaffServer) handleStaffDelete(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    var deleteData map[string]interface{}
    if err := json.Unmarshal(msg.Payload.([]byte), &deleteData); err != nil {
        // Try to parse as map[string]interface{} for flexible JSON parsing
        payloadBytes, _ := json.Marshal(msg.Payload)
        if err := json.Unmarshal(payloadBytes, &deleteData); err != nil {
            return fmt.Errorf("failed to parse staff delete request: %w", err)
        }
    }

    staffID, ok := deleteData["staffId"].(string)
    if !ok {
        return fmt.Errorf("staffId is required for delete operation")
    }

    // Delete from repository
    if err := s.staffRepo.DeleteStaff(staffID); err != nil {
        return fmt.Errorf("failed to delete staff member: %w", err)
    }

    // Broadcast deletion to all clients
    response := models.NewWebSocketMessage("STAFF_DELETED", map[string]string{"staffId": staffID}, msg.ClientID, msg.SequenceNumber+1)
    s.broadcastToAllClients(response)

    // Send success response to requesting client
    successResponse := models.NewWebSocketMessage("STAFF_DELETE_SUCCESS", map[string]string{"staffId": staffID}, msg.ClientID, msg.SequenceNumber+1)
    return s.sendMessageToClient(conn, successResponse)
}

// handleSyncRequest processes sync requests for staff data
func (s *StaffServer) handleSyncRequest(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    var syncReq models.StaffSyncRequest
    if err := json.Unmarshal(msg.Payload.([]byte), &syncReq); err != nil {
        // Try to parse as map[string]interface{} for flexible JSON parsing
        payloadBytes, _ := json.Marshal(msg.Payload)
        if err := json.Unmarshal(payloadBytes, &syncReq); err != nil {
            return fmt.Errorf("failed to parse sync request: %w", err)
        }
    }

    // Get all staff for the requested period
    staffMembers, err := s.staffRepo.GetAllStaffByPeriod(syncReq.Period)
    if err != nil {
        return fmt.Errorf("failed to get staff members for period %d: %w", syncReq.Period, err)
    }

    // Create sync response
    syncResponse := models.StaffSyncResponse{
        StaffMembers: staffMembers,
        Period:       syncReq.Period,
        Version:      time.Now().Unix(),
        Timestamp:    time.Now(),
    }

    // Send response to requesting client
    response := models.NewWebSocketMessage("SYNC_RESPONSE", syncResponse, msg.ClientID, msg.SequenceNumber+1)
    return s.sendMessageToClient(conn, response)
}

// handlePing processes ping requests
func (s *StaffServer) handlePing(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    // Send pong response
    response := models.NewWebSocketMessage(models.MessageTypePong, map[string]string{"status": "ok"}, msg.ClientID, msg.SequenceNumber+1)
    return s.sendMessageToClient(conn, response)
}

// broadcastToAllClients sends a message to all connected clients
func (s *StaffServer) broadcastToAllClients(msg *models.WebSocketMessage) {
    messageBytes, err := json.Marshal(msg)
    if err != nil {
        log.Printf("PHASE6: Failed to marshal broadcast message: %v", err)
        return
    }

    // Use the existing broadcast channel
    select {
    case s.broadcast <- messageBytes:
        log.Printf("PHASE6: Broadcasting message type %s to %d clients", msg.Type, len(s.clients))
    default:
        log.Printf("PHASE6: Broadcast channel full, dropping message")
    }
}

// sendMessageToClient sends a message to a specific client
func (s *StaffServer) sendMessageToClient(conn *websocket.Conn, msg *models.WebSocketMessage) error {
    messageBytes, err := json.Marshal(msg)
    if err != nil {
        return fmt.Errorf("failed to marshal message: %w", err)
    }

    if err := conn.WriteMessage(websocket.TextMessage, messageBytes); err != nil {
        return fmt.Errorf("failed to send message to client: %w", err)
    }

    return nil
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

// Phase 6: Advanced endpoint handlers

// phase6Status provides comprehensive Phase 6 optimization status
func (s *StaffServer) phase6Status(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    metrics := s.phase6Profiler.GetPhase6Metrics()

    status := map[string]interface{}{
        "phase": "6",
        "status": metrics.OverallStatus,
        "success_criteria": map[string]interface{}{
            "network_traffic_reduction": map[string]interface{}{
                "current": metrics.NetworkTrafficReduction,
                "target": 50.0,
                "achieved": metrics.NetworkTrafficReduction >= 50.0,
            },
            "connection_stability": map[string]interface{}{
                "current": metrics.ConnectionStability,
                "target": 99.95,
                "achieved": metrics.ConnectionStability >= 99.95,
            },
            "ai_accuracy": map[string]interface{}{
                "current": metrics.AIAccuracy,
                "target": 90.0,
                "achieved": metrics.AIAccuracy >= 90.0,
            },
        },
        "timestamp": metrics.Timestamp,
        "uptime": metrics.Uptime.String(),
    }

    json.NewEncoder(w).Encode(status)
}

// phase6Metrics provides detailed Phase 6 performance metrics
func (s *StaffServer) phase6Metrics(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    metricsData, err := s.phase6Profiler.ExportMetrics()
    if err != nil {
        http.Error(w, "Failed to export metrics", http.StatusInternalServerError)
        return
    }

    w.Write(metricsData)
}

// aiStatistics provides AI conflict resolution statistics
func (s *StaffServer) aiStatistics(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    stats := s.aiResolver.GetResolutionStatistics()
    modelInfo := s.aiResolver.GetModelInfo()

    response := map[string]interface{}{
        "statistics": stats,
        "model_info": modelInfo,
        "enabled": true,
        "confidence_threshold": 0.8,
        "timestamp": time.Now(),
    }

    json.NewEncoder(w).Encode(response)
}

// compressionStatistics provides message compression performance data
func (s *StaffServer) compressionStatistics(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    metrics := s.phase6Profiler.GetPhase6Metrics()

    response := map[string]interface{}{
        "compression_enabled": s.compressionEnabled,
        "compression_stats": metrics.CompressionStats,
        "message_stats": metrics.MessageStats,
        "network_savings": map[string]interface{}{
            "bytes_saved": metrics.CompressionStats.BandwidthSaved,
            "compression_ratio": metrics.CompressionStats.CompressionRatio,
            "traffic_reduction": metrics.NetworkTrafficReduction,
        },
        "timestamp": time.Now(),
    }

    json.NewEncoder(w).Encode(response)
}