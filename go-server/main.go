// Phase 1.1: Go Server Setup - Basic server structure as specified in IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md
package main

import (
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/gorilla/websocket"
    "github.com/supabase/postgrest-go"
)

// StaffServer - Exact structure from official plan lines 94-101
type StaffServer struct {
    clients     map[*websocket.Conn]bool
    supabase    *postgrest.Client
    db          *sql.DB
    broadcast   chan []byte
    register    chan *websocket.Conn
    unregister  chan *websocket.Conn
    startTime   time.Time
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        // Allow all origins for development - will be restricted in production
        return true
    },
}

// Health check response structure
type HealthResponse struct {
    Status            string    `json:"status"`
    ActiveConnections int       `json:"active_connections"`
    Uptime            string    `json:"uptime"`
    SupabaseConnected bool      `json:"supabase_connected"`
    Version           string    `json:"version"`
    Timestamp         time.Time `json:"timestamp"`
}

func main() {
    log.Println("PHASE1: Initializing Go WebSocket Server Foundation...")

    server := &StaffServer{
        clients:    make(map[*websocket.Conn]bool),
        broadcast:  make(chan []byte),
        register:   make(chan *websocket.Conn),
        unregister: make(chan *websocket.Conn),
        startTime:  time.Now(),
    }

    // Initialize Supabase connection
    supabaseURL := os.Getenv("SUPABASE_URL")
    supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

    if supabaseURL == "" {
        log.Println("WARNING: SUPABASE_URL not set, running without Supabase integration")
    } else {
        server.supabase = postgrest.NewClient(supabaseURL, supabaseKey, nil)
        log.Println("PHASE1: Supabase client initialized")
    }

    // Start WebSocket connection management hub
    go server.handleConnections()

    // WebSocket endpoint - Staff synchronization
    http.HandleFunc("/staff-sync", server.handleWebSocket)

    // Health check endpoint for monitoring
    http.HandleFunc("/health", server.healthCheck)

    // Basic info endpoint
    http.HandleFunc("/", server.handleRoot)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("PHASE1: Go WebSocket server starting on port %s", port)
    log.Printf("PHASE1: WebSocket endpoint: ws://localhost:%s/staff-sync", port)
    log.Printf("PHASE1: Health check: http://localhost:%s/health", port)

    err := http.ListenAndServe(":"+port, nil)
    if err != nil {
        log.Fatal("PHASE1: Server failed to start:", err)
    }
}

// handleConnections manages WebSocket client connections
func (s *StaffServer) handleConnections() {
    for {
        select {
        case client := <-s.register:
            s.clients[client] = true
            log.Printf("PHASE1: Client connected. Total connections: %d", len(s.clients))

        case client := <-s.unregister:
            if _, ok := s.clients[client]; ok {
                delete(s.clients, client)
                client.Close()
                log.Printf("PHASE1: Client disconnected. Total connections: %d", len(s.clients))
            }

        case message := <-s.broadcast:
            // Broadcast message to all connected clients
            for client := range s.clients {
                err := client.WriteMessage(websocket.TextMessage, message)
                if err != nil {
                    log.Printf("PHASE1: Error broadcasting to client: %v", err)
                    client.Close()
                    delete(s.clients, client)
                }
            }
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

// healthCheck provides health status for monitoring
func (s *StaffServer) healthCheck(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    health := HealthResponse{
        Status:            "healthy",
        ActiveConnections: len(s.clients),
        Uptime:            time.Since(s.startTime).String(),
        SupabaseConnected: s.supabase != nil,
        Version:           "Phase1-Foundation",
        Timestamp:         time.Now(),
    }

    json.NewEncoder(w).Encode(health)
}

// handleRoot provides basic server information
func (s *StaffServer) handleRoot(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Phase 1: Go WebSocket Server Foundation\nImplementing IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md\nWebSocket endpoint: /staff-sync\nHealth check: /health\n"))
}