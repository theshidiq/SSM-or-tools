// WebSocket server for shift schedule management with Supabase integration
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket client
type Client struct {
	conn     *websocket.Conn
	clientId string
	period   int
}

// Server for staff synchronization
type StaffSyncServer struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	supabaseURL string
	supabaseKey string
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin for development
	},
}

// Message types matching React app expectations
const (
	MESSAGE_SYNC_REQUEST    = "SYNC_REQUEST"
	MESSAGE_SYNC_RESPONSE   = "SYNC_RESPONSE"
	MESSAGE_STAFF_UPDATE    = "STAFF_UPDATE"
	MESSAGE_STAFF_CREATE    = "STAFF_CREATE"
	MESSAGE_STAFF_DELETE    = "STAFF_DELETE"
	MESSAGE_CONNECTION_ACK  = "CONNECTION_ACK"
	MESSAGE_ERROR          = "ERROR"
)

// Message structure matching React app format
type Message struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
	ClientID  string      `json:"clientId"`
}

// Staff member structure
type StaffMember struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Position    string      `json:"position"`
	Department  string      `json:"department"`
	Type        string      `json:"type"`
	Status      string      `json:"status"`
	Period      int         `json:"period"`
	StaffOrder  int         `json:"staff_order"`
	StartPeriod interface{} `json:"start_period"`
	EndPeriod   interface{} `json:"end_period"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// Supabase response structure
type SupabaseResponse struct {
	Data  []StaffMember `json:"data"`
	Error interface{}   `json:"error"`
}

func main() {
	log.Println("Starting Staff Sync WebSocket server with Supabase integration...")

	// Get Supabase configuration from environment
	supabaseURL := os.Getenv("REACT_APP_SUPABASE_URL")
	supabaseKey := os.Getenv("REACT_APP_SUPABASE_ANON_KEY")

	if supabaseURL == "" {
		supabaseURL = "https://ymdyejrljmvajqjbejvh.supabase.co"
	}
	if supabaseKey == "" {
		supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZHllanJsam12YWpxamJlanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjE1NDMsImV4cCI6MjA2ODI5NzU0M30.wFirIfjnpkgRqDhECW6XZKkzWg_Q-pvs7jX_FIAMYfE"
	}

	server := &StaffSyncServer{
		clients:     make(map[*Client]bool),
		broadcast:   make(chan []byte),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		supabaseURL: supabaseURL,
		supabaseKey: supabaseKey,
	}

	// Start client connection management
	go server.handleConnections()

	// Setup HTTP handlers
	http.HandleFunc("/staff-sync", server.handleStaffSync)
	http.HandleFunc("/health", server.handleHealth)
	http.HandleFunc("/", server.handleRoot)

	port := "8080"
	log.Printf("Starting Staff Sync WebSocket server on :%s", port)
	log.Printf("WebSocket endpoint: ws://localhost:%s/staff-sync", port)
	log.Printf("Health check: http://localhost:%s/health", port)
	log.Printf("Supabase URL: %s", supabaseURL)
	log.Printf("Supported message types: %s, %s, %s, %s, %s, %s, %s",
		MESSAGE_SYNC_REQUEST, MESSAGE_SYNC_RESPONSE, MESSAGE_STAFF_UPDATE,
		MESSAGE_STAFF_CREATE, MESSAGE_STAFF_DELETE, MESSAGE_CONNECTION_ACK, MESSAGE_ERROR)

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func (s *StaffSyncServer) handleConnections() {
	for {
		select {
		case client := <-s.register:
			s.clients[client] = true
			log.Printf("Client connected (ID: %s, Period: %d). Total: %d",
				client.clientId, client.period, len(s.clients))

			// Send connection acknowledgment
			ackMsg := Message{
				Type:      MESSAGE_CONNECTION_ACK,
				Payload:   map[string]string{"status": "connected", "clientId": client.clientId},
				Timestamp: time.Now(),
				ClientID:  client.clientId,
			}
			if msgBytes, err := json.Marshal(ackMsg); err == nil {
				client.conn.WriteMessage(websocket.TextMessage, msgBytes)
			}

		case client := <-s.unregister:
			if _, ok := s.clients[client]; ok {
				delete(s.clients, client)
				client.conn.Close()
				log.Printf("Client disconnected (ID: %s). Total: %d", client.clientId, len(s.clients))
			}

		case message := <-s.broadcast:
			for client := range s.clients {
				err := client.conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("Error broadcasting to client %s: %v", client.clientId, err)
					client.conn.Close()
					delete(s.clients, client)
				}
			}
		}
	}
}

func (s *StaffSyncServer) handleStaffSync(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Extract period from query parameters
	periodStr := r.URL.Query().Get("period")
	period := 0
	if periodStr != "" {
		if p, err := strconv.Atoi(periodStr); err == nil {
			period = p
		}
	}

	// Create client with unique ID
	client := &Client{
		conn:     conn,
		clientId: uuid.New().String(),
		period:   period,
	}

	s.register <- client

	for {
		_, messageData, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			s.unregister <- client
			break
		}

		var msg Message
		if err := json.Unmarshal(messageData, &msg); err != nil {
			log.Printf("JSON unmarshal error: %v", err)
			continue
		}

		log.Printf("Received message type: %s from client: %s", msg.Type, client.clientId)

		switch msg.Type {
		case MESSAGE_SYNC_REQUEST:
			s.handleSyncRequest(client, &msg)
		case MESSAGE_STAFF_UPDATE:
			s.handleStaffUpdate(client, &msg)
		case MESSAGE_STAFF_CREATE:
			s.handleStaffCreate(client, &msg)
		case MESSAGE_STAFF_DELETE:
			s.handleStaffDelete(client, &msg)
		default:
			log.Printf("Unknown message type: %s", msg.Type)
		}
	}
}

func (s *StaffSyncServer) handleSyncRequest(client *Client, msg *Message) {
	log.Printf("Processing SYNC_REQUEST for period %d", client.period)

	// Fetch staff data from Supabase
	staffMembers, err := s.fetchStaffFromSupabase(client.period)
	if err != nil {
		log.Printf("Error fetching staff from Supabase: %v", err)
		// Send empty response instead of failing
		staffMembers = []StaffMember{}
	}

	log.Printf("Retrieved %d staff members from Supabase for period %d", len(staffMembers), client.period)

	// Create sync response
	response := Message{
		Type: MESSAGE_SYNC_RESPONSE,
		Payload: map[string]interface{}{
			"staff":        staffMembers,
			"staffMembers": staffMembers, // Support both field names
			"period":       client.period,
			"timestamp":    time.Now(),
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	// Send response to client
	if responseBytes, err := json.Marshal(response); err == nil {
		client.conn.WriteMessage(websocket.TextMessage, responseBytes)
		log.Printf("Sent SYNC_RESPONSE with %d staff members to client %s", len(staffMembers), client.clientId)
	} else {
		log.Printf("Error marshaling sync response: %v", err)
	}
}

func (s *StaffSyncServer) handleStaffUpdate(client *Client, msg *Message) {
	log.Printf("Processing STAFF_UPDATE from client %s", client.clientId)

	// Broadcast update to all other clients
	s.broadcastToOthers(client, msg)
}

func (s *StaffSyncServer) handleStaffCreate(client *Client, msg *Message) {
	log.Printf("Processing STAFF_CREATE from client %s", client.clientId)

	// Broadcast creation to all other clients
	s.broadcastToOthers(client, msg)
}

func (s *StaffSyncServer) handleStaffDelete(client *Client, msg *Message) {
	log.Printf("Processing STAFF_DELETE from client %s", client.clientId)

	// Broadcast deletion to all other clients
	s.broadcastToOthers(client, msg)
}

func (s *StaffSyncServer) broadcastToOthers(sender *Client, msg *Message) {
	if msgBytes, err := json.Marshal(msg); err == nil {
		for client := range s.clients {
			if client != sender {
				err := client.conn.WriteMessage(websocket.TextMessage, msgBytes)
				if err != nil {
					log.Printf("Error broadcasting to client %s: %v", client.clientId, err)
				}
			}
		}
	}
}

func (s *StaffSyncServer) fetchStaffFromSupabase(period int) ([]StaffMember, error) {
	// First, get the period dates from the periods table
	periodDates, err := s.fetchPeriodDates(period)
	if err != nil {
		log.Printf("Warning: Could not fetch period dates for period %d: %v", period, err)
		// Fallback to fetching all staff if period lookup fails
		return s.fetchAllStaff()
	}

	log.Printf("Fetching staff for period %d (%s to %s)", period, periodDates.StartDate, periodDates.EndDate)

	// Build Supabase REST API URL - fetch all active staff
	url := fmt.Sprintf("%s/rest/v1/staff?is_active=eq.true&select=id,name,position,department,type,status,start_period,end_period,staff_order,created_at,updated_at", s.supabaseURL)

	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set Supabase headers
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("Supabase staff response (status %d)", resp.StatusCode)

	// Handle non-200 responses
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var allStaff []StaffMember
	if err := json.Unmarshal(body, &allStaff); err != nil {
		return nil, fmt.Errorf("failed to parse Supabase response: %w", err)
	}

	// Filter staff members who are active during this period
	var filteredStaff []StaffMember
	for _, staff := range allStaff {
		if s.isStaffActiveInPeriod(staff, periodDates) {
			// Set the period field for the response
			staff.Period = period
			filteredStaff = append(filteredStaff, staff)
		}
	}

	log.Printf("Filtered %d active staff members for period %d from %d total staff",
		len(filteredStaff), period, len(allStaff))

	return filteredStaff, nil
}

// PeriodDates represents the start and end dates of a period
type PeriodDates struct {
	StartDate string
	EndDate   string
}

// fetchPeriodDates gets the start and end dates for a given period index
func (s *StaffSyncServer) fetchPeriodDates(period int) (*PeriodDates, error) {
	// Build URL to fetch periods ordered by start_date
	url := fmt.Sprintf("%s/rest/v1/periods?select=start_date,end_date&order=start_date.asc", s.supabaseURL)

	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set Supabase headers
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch periods: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read periods response: %w", err)
	}

	// Handle non-200 responses
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("periods request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var periods []struct {
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
	}
	if err := json.Unmarshal(body, &periods); err != nil {
		return nil, fmt.Errorf("failed to parse periods response: %w", err)
	}

	// Check if period index is valid
	if period < 0 || period >= len(periods) {
		return nil, fmt.Errorf("period index %d is out of range (0-%d)", period, len(periods)-1)
	}

	return &PeriodDates{
		StartDate: periods[period].StartDate,
		EndDate:   periods[period].EndDate,
	}, nil
}

// isStaffActiveInPeriod checks if a staff member is active during the given period
func (s *StaffSyncServer) isStaffActiveInPeriod(staff StaffMember, periodDates *PeriodDates) bool {
	// Parse period dates
	periodStart, err := time.Parse("2006-01-02", periodDates.StartDate)
	if err != nil {
		log.Printf("Error parsing period start date %s: %v", periodDates.StartDate, err)
		return true // Default to including staff if date parsing fails
	}

	periodEnd, err := time.Parse("2006-01-02", periodDates.EndDate)
	if err != nil {
		log.Printf("Error parsing period end date %s: %v", periodDates.EndDate, err)
		return true // Default to including staff if date parsing fails
	}

	// If staff has no start_period, they're always active
	if staff.StartPeriod == nil {
		// Check end_period if it exists
		if staff.EndPeriod != nil {
			staffEndDate := s.periodJSONToDate(staff.EndPeriod)
			if staffEndDate != nil && staffEndDate.Before(periodStart) {
				return false // Staff ended before this period
			}
		}
		return true
	}

	// Parse staff start period
	staffStartDate := s.periodJSONToDate(staff.StartPeriod)
	if staffStartDate == nil {
		return true // Default to including if start date parsing fails
	}

	// Staff starts after this period ends
	if staffStartDate.After(periodEnd) {
		return false
	}

	// Check staff end period if it exists
	if staff.EndPeriod != nil {
		staffEndDate := s.periodJSONToDate(staff.EndPeriod)
		if staffEndDate != nil && staffEndDate.Before(periodStart) {
			return false // Staff ended before this period starts
		}
	}

	return true // Staff is active during this period
}

// periodJSONToDate converts a JSONB period to a time.Time
func (s *StaffSyncServer) periodJSONToDate(periodJSON interface{}) *time.Time {
	periodMap, ok := periodJSON.(map[string]interface{})
	if !ok {
		return nil
	}

	year, ok := periodMap["year"].(float64)
	if !ok {
		return nil
	}

	month, ok := periodMap["month"].(float64)
	if !ok {
		return nil
	}

	day := float64(1) // Default to first day of month
	if d, exists := periodMap["day"].(float64); exists {
		day = d
	}

	date := time.Date(int(year), time.Month(month), int(day), 0, 0, 0, 0, time.UTC)
	return &date
}

// fetchAllStaff fetches all staff without period filtering (fallback)
func (s *StaffSyncServer) fetchAllStaff() ([]StaffMember, error) {
	url := fmt.Sprintf("%s/rest/v1/staff?is_active=eq.true&select=*", s.supabaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var staffMembers []StaffMember
	if err := json.Unmarshal(body, &staffMembers); err != nil {
		return nil, fmt.Errorf("failed to parse Supabase response: %w", err)
	}

	return staffMembers, nil
}

func (s *StaffSyncServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	health := map[string]interface{}{
		"status":    "healthy",
		"clients":   len(s.clients),
		"endpoint":  "/staff-sync",
		"timestamp": time.Now(),
		"supabase":  map[string]string{
			"url": s.supabaseURL,
			"status": "configured",
		},
	}

	json.NewEncoder(w).Encode(health)
}

func (s *StaffSyncServer) handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)

	info := fmt.Sprintf(`Staff Sync WebSocket Server
Supabase Integration: %s
Active Clients: %d
WebSocket Endpoint: /staff-sync
Health Check: /health
`, s.supabaseURL, len(s.clients))

	w.Write([]byte(info))
}