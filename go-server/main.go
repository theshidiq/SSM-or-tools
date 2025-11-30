// WebSocket server for shift schedule management with Supabase integration
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
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
	clients     map[*Client]bool
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	supabaseURL string
	supabaseKey string
	tempIDMap   sync.Map // map[string]string - temporary ID -> database UUID for priority rules
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin for development
	},
}

// Message types matching React app expectations
const (
	// Staff management messages
	MESSAGE_SYNC_REQUEST              = "SYNC_REQUEST"
	MESSAGE_SYNC_RESPONSE             = "SYNC_RESPONSE"
	MESSAGE_SYNC_ALL_PERIODS_REQUEST  = "SYNC_ALL_PERIODS_REQUEST"
	MESSAGE_SYNC_ALL_PERIODS_RESPONSE = "SYNC_ALL_PERIODS_RESPONSE"
	MESSAGE_STAFF_UPDATE              = "STAFF_UPDATE"
	MESSAGE_STAFF_CREATE              = "STAFF_CREATE"
	MESSAGE_STAFF_DELETE              = "STAFF_DELETE"

	// Settings management messages (multi-table architecture)
	MESSAGE_SETTINGS_SYNC_REQUEST             = "SETTINGS_SYNC_REQUEST"
	MESSAGE_SETTINGS_SYNC_RESPONSE            = "SETTINGS_SYNC_RESPONSE"
	MESSAGE_SETTINGS_UPDATE_STAFF_GROUPS      = "SETTINGS_UPDATE_STAFF_GROUPS"
	MESSAGE_SETTINGS_CREATE_STAFF_GROUP       = "SETTINGS_CREATE_STAFF_GROUP"
	MESSAGE_SETTINGS_DELETE_STAFF_GROUP       = "SETTINGS_DELETE_STAFF_GROUP"
	MESSAGE_SETTINGS_HARD_DELETE_STAFF_GROUP  = "SETTINGS_HARD_DELETE_STAFF_GROUP"
	MESSAGE_SETTINGS_UPDATE_DAILY_LIMITS      = "SETTINGS_UPDATE_DAILY_LIMITS"
	MESSAGE_SETTINGS_UPDATE_WEEKLY_LIMITS     = "SETTINGS_UPDATE_WEEKLY_LIMITS"
	MESSAGE_SETTINGS_UPDATE_MONTHLY_LIMITS    = "SETTINGS_UPDATE_MONTHLY_LIMITS"
	MESSAGE_SETTINGS_CREATE_PRIORITY_RULE     = "SETTINGS_CREATE_PRIORITY_RULE"
	MESSAGE_SETTINGS_UPDATE_PRIORITY_RULES    = "SETTINGS_UPDATE_PRIORITY_RULES"
	MESSAGE_SETTINGS_DELETE_PRIORITY_RULE     = "SETTINGS_DELETE_PRIORITY_RULE"
	MESSAGE_SETTINGS_UPDATE_ML_CONFIG         = "SETTINGS_UPDATE_ML_CONFIG"
	MESSAGE_SETTINGS_CREATE_BACKUP_ASSIGNMENT = "SETTINGS_CREATE_BACKUP_ASSIGNMENT"
	MESSAGE_SETTINGS_UPDATE_BACKUP_ASSIGNMENT = "SETTINGS_UPDATE_BACKUP_ASSIGNMENT"
	MESSAGE_SETTINGS_DELETE_BACKUP_ASSIGNMENT = "SETTINGS_DELETE_BACKUP_ASSIGNMENT"
	MESSAGE_SETTINGS_MIGRATE                  = "SETTINGS_MIGRATE"
	MESSAGE_SETTINGS_RESET                    = "SETTINGS_RESET"
	MESSAGE_SETTINGS_CREATE_VERSION           = "SETTINGS_CREATE_VERSION"
	MESSAGE_SETTINGS_ACTIVATE_VERSION         = "SETTINGS_ACTIVATE_VERSION"

	// Shift management messages (real-time schedule updates)
	MESSAGE_SHIFT_UPDATE        = "SHIFT_UPDATE"
	MESSAGE_SHIFT_SYNC_REQUEST  = "SHIFT_SYNC_REQUEST"
	MESSAGE_SHIFT_SYNC_RESPONSE = "SHIFT_SYNC_RESPONSE"
	MESSAGE_SHIFT_BROADCAST     = "SHIFT_BROADCAST"
	MESSAGE_SHIFT_BULK_UPDATE   = "SHIFT_BULK_UPDATE"

	// Common messages
	MESSAGE_CONNECTION_ACK = "CONNECTION_ACK"
	MESSAGE_PING           = "PING"
	MESSAGE_PONG           = "PONG"
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

// ToReactFormat converts Supabase snake_case to React camelCase
func (s *StaffMember) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":          s.ID,
		"name":        s.Name,
		"position":    s.Position,
		"department":  s.Department,
		"type":        s.Type,
		"status":      s.Status,
		"period":      s.Period,
		"staffOrder":  s.StaffOrder,  // camelCase for React
		"startPeriod": s.StartPeriod, // camelCase for React
		"endPeriod":   s.EndPeriod,   // camelCase for React
		"createdAt":   s.CreatedAt,   // camelCase for React
		"updatedAt":   s.UpdatedAt,   // camelCase for React
	}
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
	log.Printf("Supported message types:")
	log.Printf("  Staff: %s, %s, %s, %s",
		MESSAGE_SYNC_REQUEST, MESSAGE_STAFF_UPDATE, MESSAGE_STAFF_CREATE, MESSAGE_STAFF_DELETE)
	log.Printf("  Settings: %s, %s, %s, %s",
		MESSAGE_SETTINGS_SYNC_REQUEST, MESSAGE_SETTINGS_UPDATE_STAFF_GROUPS, MESSAGE_SETTINGS_UPDATE_WEEKLY_LIMITS, MESSAGE_SETTINGS_MIGRATE)
	log.Printf("  Shifts: %s, %s, %s",
		MESSAGE_SHIFT_UPDATE, MESSAGE_SHIFT_SYNC_REQUEST, MESSAGE_SHIFT_BULK_UPDATE)
	log.Printf("  Common: %s, %s", MESSAGE_CONNECTION_ACK, MESSAGE_ERROR)

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

		// 🔍 DEBUG: Log payload details for settings messages
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			log.Printf("🔍 [MESSAGE PAYLOAD] Keys: %v", getKeys(payload))
		}

		switch msg.Type {
		// Staff management handlers
		case MESSAGE_SYNC_REQUEST:
			s.handleSyncRequest(client, &msg)
		case MESSAGE_SYNC_ALL_PERIODS_REQUEST:
			s.handleSyncAllPeriodsRequest(client, &msg)
		case MESSAGE_STAFF_UPDATE:
			s.handleStaffUpdate(client, &msg)
		case MESSAGE_STAFF_CREATE:
			s.handleStaffCreate(client, &msg)
		case MESSAGE_STAFF_DELETE:
			s.handleStaffDelete(client, &msg)

		// Settings management handlers (multi-table architecture)
		case MESSAGE_SETTINGS_SYNC_REQUEST:
			s.handleSettingsSyncRequest(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_STAFF_GROUPS:
			s.handleStaffGroupsUpdate(client, &msg)
		case MESSAGE_SETTINGS_CREATE_STAFF_GROUP:
			s.handleStaffGroupCreate(client, &msg)
		case MESSAGE_SETTINGS_DELETE_STAFF_GROUP:
			s.handleStaffGroupDelete(client, &msg)
		case MESSAGE_SETTINGS_HARD_DELETE_STAFF_GROUP:
			s.handleStaffGroupHardDelete(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_DAILY_LIMITS:
			s.handleDailyLimitsUpdate(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_WEEKLY_LIMITS:
			s.handleWeeklyLimitsUpdate(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_MONTHLY_LIMITS:
			s.handleMonthlyLimitsUpdate(client, &msg)
		case MESSAGE_SETTINGS_CREATE_PRIORITY_RULE:
			s.handlePriorityRuleCreate(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_PRIORITY_RULES:
			s.handlePriorityRulesUpdate(client, &msg)
		case MESSAGE_SETTINGS_DELETE_PRIORITY_RULE:
			s.handlePriorityRuleDelete(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_ML_CONFIG:
			s.handleMLConfigUpdate(client, &msg)
		case MESSAGE_SETTINGS_CREATE_BACKUP_ASSIGNMENT:
			s.handleBackupAssignmentCreate(client, &msg)
		case MESSAGE_SETTINGS_UPDATE_BACKUP_ASSIGNMENT:
			s.handleBackupAssignmentUpdate(client, &msg)
		case MESSAGE_SETTINGS_DELETE_BACKUP_ASSIGNMENT:
			s.handleBackupAssignmentDelete(client, &msg)
		case MESSAGE_SETTINGS_MIGRATE:
			s.handleSettingsMigrate(client, &msg)
		case MESSAGE_SETTINGS_RESET:
			s.handleSettingsReset(client, &msg)
		// TODO: Implement version control handlers
		// case MESSAGE_SETTINGS_CREATE_VERSION:
		// 	s.handleCreateConfigVersion(client, &msg)
		// case MESSAGE_SETTINGS_ACTIVATE_VERSION:
		// 	s.handleActivateConfigVersion(client, &msg)

		// Shift management handlers (real-time schedule updates)
		case MESSAGE_SHIFT_UPDATE:
			s.handleShiftUpdate(client, &msg)
		case MESSAGE_SHIFT_SYNC_REQUEST:
			s.handleShiftSyncRequest(client, &msg)
		case MESSAGE_SHIFT_BULK_UPDATE:
			s.handleShiftBulkUpdate(client, &msg)

		// Heartbeat/Connection health
		case MESSAGE_PING:
			s.handlePing(client, &msg)

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

func (s *StaffSyncServer) handleSyncAllPeriodsRequest(client *Client, msg *Message) {
	log.Printf("Processing SYNC_ALL_PERIODS_REQUEST from client %s", client.clientId)

	// Fetch all periods staff data
	allPeriodsStaff, err := s.fetchAllPeriodsStaff()
	if err != nil {
		log.Printf("Error fetching all periods staff: %v", err)
		// Send error response
		errorResponse := Message{
			Type: MESSAGE_ERROR,
			Payload: map[string]interface{}{
				"error":   "Failed to fetch all periods staff",
				"details": err.Error(),
			},
			Timestamp: time.Now(),
			ClientID:  client.clientId,
		}
		if errorBytes, marshalErr := json.Marshal(errorResponse); marshalErr == nil {
			client.conn.WriteMessage(websocket.TextMessage, errorBytes)
		}
		return
	}

	// Count total staff across all periods
	totalStaff := 0
	for _, staff := range allPeriodsStaff {
		totalStaff += len(staff)
	}

	log.Printf("Retrieved %d staff members across %d periods", totalStaff, len(allPeriodsStaff))

	// Convert all staff to React format (snake_case → camelCase)
	formattedPeriodsStaff := make(map[string][]map[string]interface{})
	for periodIndex, staffList := range allPeriodsStaff {
		var formattedStaffList []map[string]interface{}
		for _, staff := range staffList {
			formattedStaffList = append(formattedStaffList, staff.ToReactFormat())
		}
		// Convert int key to string for JSON compatibility
		formattedPeriodsStaff[fmt.Sprintf("%d", periodIndex)] = formattedStaffList
	}

	// Create sync all periods response with formatted data
	response := Message{
		Type: MESSAGE_SYNC_ALL_PERIODS_RESPONSE,
		Payload: map[string]interface{}{
			"periods":      formattedPeriodsStaff, // Now in camelCase for React
			"totalPeriods": len(allPeriodsStaff),
			"timestamp":    time.Now(),
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	// Send response to client
	if responseBytes, err := json.Marshal(response); err == nil {
		client.conn.WriteMessage(websocket.TextMessage, responseBytes)
		log.Printf("Sent SYNC_ALL_PERIODS_RESPONSE with %d periods to client %s", len(allPeriodsStaff), client.clientId)
	} else {
		log.Printf("Error marshaling sync all periods response: %v", err)
	}
}

func (s *StaffSyncServer) handleStaffUpdate(client *Client, msg *Message) {
	log.Printf("Processing STAFF_UPDATE from client %s", client.clientId)

	// Extract staff update data from payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid STAFF_UPDATE payload format")
		return
	}

	staffId, ok := payload["staffId"].(string)
	if !ok {
		log.Printf("❌ Missing staffId in STAFF_UPDATE payload")
		return
	}

	changes, ok := payload["changes"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing changes in STAFF_UPDATE payload")
		return
	}

	// Save to Supabase database
	if err := s.updateStaffInSupabase(staffId, changes); err != nil {
		log.Printf("❌ Failed to save staff update to Supabase: %v", err)

		// Send error response to client
		errorResponse := Message{
			Type: MESSAGE_ERROR,
			Payload: map[string]interface{}{
				"error":   "Failed to save staff update",
				"details": err.Error(),
				"staffId": staffId,
			},
			Timestamp: time.Now(),
			ClientID:  client.clientId,
		}
		if errorBytes, marshalErr := json.Marshal(errorResponse); marshalErr == nil {
			client.conn.WriteMessage(websocket.TextMessage, errorBytes)
		}
		return
	}

	log.Printf("✅ Successfully saved staff update to Supabase: %s", staffId)

	// Fetch fresh data from Supabase to ensure we broadcast the actual database state
	updatedStaff, err := s.fetchStaffById(staffId)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated staff from Supabase: %v (falling back to original message)", err)
		// Fallback: broadcast original message
		s.broadcastToAll(msg)
		return
	}

	// Create updated message with fresh database data in React-compatible format
	// The client expects the full staff object as "changes" with camelCase field names
	freshMsg := Message{
		Type: MESSAGE_STAFF_UPDATE,
		Payload: map[string]interface{}{
			"staffId": staffId,
			"id":      staffId,
			"changes": updatedStaff.ToReactFormat(), // Convert to camelCase for React
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	// Broadcast fresh data to ALL clients (including the updating client)
	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted fresh staff data to all clients including sender")
}

func (s *StaffSyncServer) handleStaffCreate(client *Client, msg *Message) {
	log.Printf("Processing STAFF_CREATE from client %s", client.clientId)

	// Extract staff creation data from payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid STAFF_CREATE payload format")
		return
	}

	// Save to Supabase database
	createdStaff, err := s.createStaffInSupabase(payload)
	if err != nil {
		log.Printf("❌ Failed to create staff in Supabase: %v", err)

		// Send error response to client
		errorResponse := Message{
			Type: MESSAGE_ERROR,
			Payload: map[string]interface{}{
				"error":   "Failed to create staff",
				"details": err.Error(),
			},
			Timestamp: time.Now(),
			ClientID:  client.clientId,
		}
		if errorBytes, marshalErr := json.Marshal(errorResponse); marshalErr == nil {
			client.conn.WriteMessage(websocket.TextMessage, errorBytes)
		}
		return
	}

	log.Printf("✅ Successfully created staff in Supabase: %s (%s)", createdStaff.Name, createdStaff.ID)

	// Create message with fresh created staff data in React-compatible format
	freshMsg := Message{
		Type:      MESSAGE_STAFF_CREATE,
		Payload:   createdStaff.ToReactFormat(), // Convert to camelCase for React
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	// Broadcast fresh data to ALL clients (including the creating client)
	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted fresh created staff to all clients including sender")
}

func (s *StaffSyncServer) handleStaffDelete(client *Client, msg *Message) {
	log.Printf("Processing STAFF_DELETE from client %s", client.clientId)

	// Extract staff deletion data from payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid STAFF_DELETE payload format")
		return
	}

	staffId, ok := payload["staffId"].(string)
	if !ok {
		log.Printf("❌ Missing staffId in STAFF_DELETE payload")
		return
	}

	// Delete from Supabase database (soft delete by setting is_active=false)
	if err := s.deleteStaffInSupabase(staffId); err != nil {
		log.Printf("❌ Failed to delete staff from Supabase: %v", err)

		// Send error response to client
		errorResponse := Message{
			Type: MESSAGE_ERROR,
			Payload: map[string]interface{}{
				"error":   "Failed to delete staff",
				"details": err.Error(),
				"staffId": staffId,
			},
			Timestamp: time.Now(),
			ClientID:  client.clientId,
		}
		if errorBytes, marshalErr := json.Marshal(errorResponse); marshalErr == nil {
			client.conn.WriteMessage(websocket.TextMessage, errorBytes)
		}
		return
	}

	log.Printf("✅ Successfully deleted staff from Supabase: %s", staffId)

	// Create message with deletion confirmation
	freshMsg := Message{
		Type: MESSAGE_STAFF_DELETE,
		Payload: map[string]interface{}{
			"staffId": staffId,
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	// Broadcast deletion to ALL clients (including the deleting client)
	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted staff deletion to all clients including sender")
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

// broadcastToAll broadcasts a message to ALL connected clients (including sender)
func (s *StaffSyncServer) broadcastToAll(msg *Message) {
	if msgBytes, err := json.Marshal(msg); err == nil {
		for client := range s.clients {
			err := client.conn.WriteMessage(websocket.TextMessage, msgBytes)
			if err != nil {
				log.Printf("Error broadcasting to client %s: %v", client.clientId, err)
			}
		}
	}
}

// broadcastToAllPeriods broadcasts a staff update to all clients where the staff member is active
// This is used when staff updates affect multiple periods
func (s *StaffSyncServer) broadcastToAllPeriods(sender *Client, msg *Message, affectedPeriods []int) {
	if msgBytes, err := json.Marshal(msg); err == nil {
		broadcastCount := 0
		for client := range s.clients {
			if client != sender {
				// If no specific periods provided, broadcast to all clients
				if len(affectedPeriods) == 0 {
					if err := client.conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
						log.Printf("Error broadcasting to client %s: %v", client.clientId, err)
					} else {
						broadcastCount++
					}
				} else {
					// Check if client's period is in affected periods
					for _, period := range affectedPeriods {
						if client.period == period {
							if err := client.conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
								log.Printf("Error broadcasting to client %s (period %d): %v", client.clientId, period, err)
							} else {
								broadcastCount++
							}
							break
						}
					}
				}
			}
		}
		log.Printf("Broadcasted %s to %d clients across %d periods", msg.Type, broadcastCount, len(affectedPeriods))
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

// fetchAllPeriodsStaff fetches staff data for all periods in a single query
func (s *StaffSyncServer) fetchAllPeriodsStaff() (map[int][]StaffMember, error) {
	log.Printf("Fetching staff data for ALL periods...")

	// First, fetch all periods to know how many we have
	allPeriods, err := s.fetchAllPeriods()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch periods: %w", err)
	}

	if len(allPeriods) == 0 {
		log.Printf("No periods found in database")
		return make(map[int][]StaffMember), nil
	}

	log.Printf("Found %d periods in database", len(allPeriods))

	// Fetch all active staff members (single query)
	allStaff, err := s.fetchAllStaff()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch all staff: %w", err)
	}

	log.Printf("Fetched %d total staff members", len(allStaff))

	// Group staff by period index
	staffByPeriod := make(map[int][]StaffMember)

	// For each period, filter staff members who are active during that period
	for periodIndex, periodDates := range allPeriods {
		var periodStaff []StaffMember
		for _, staff := range allStaff {
			if s.isStaffActiveInPeriod(staff, &periodDates) {
				// Create a copy of staff with period field set
				staffCopy := staff
				staffCopy.Period = periodIndex
				periodStaff = append(periodStaff, staffCopy)
			}
		}
		staffByPeriod[periodIndex] = periodStaff
		log.Printf("Period %d: %d active staff members", periodIndex, len(periodStaff))
	}

	log.Printf("Successfully grouped staff across %d periods", len(staffByPeriod))
	return staffByPeriod, nil
}

// fetchAllPeriods fetches all periods from the database
func (s *StaffSyncServer) fetchAllPeriods() (map[int]PeriodDates, error) {
	url := fmt.Sprintf("%s/rest/v1/periods?select=start_date,end_date&order=start_date.asc", s.supabaseURL)

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
		return nil, fmt.Errorf("failed to fetch periods: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("periods request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var periods []struct {
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if err := json.Unmarshal(body, &periods); err != nil {
		return nil, fmt.Errorf("failed to parse periods response: %w", err)
	}

	// Convert to map with period index as key
	periodMap := make(map[int]PeriodDates)
	for i, period := range periods {
		periodMap[i] = PeriodDates{
			StartDate: period.StartDate,
			EndDate:   period.EndDate,
		}
	}

	return periodMap, nil
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

// fetchStaffById fetches a single staff member by ID from Supabase
func (s *StaffSyncServer) fetchStaffById(staffId string) (*StaffMember, error) {
	url := fmt.Sprintf("%s/rest/v1/staff?id=eq.%s&select=*", s.supabaseURL, staffId)

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

	if len(staffMembers) == 0 {
		return nil, fmt.Errorf("staff member with ID %s not found", staffId)
	}

	return &staffMembers[0], nil
}

// updateStaffInSupabase updates a staff member in Supabase database
func (s *StaffSyncServer) updateStaffInSupabase(staffId string, changes map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/staff?id=eq.%s", s.supabaseURL, staffId)

	// Prepare update data - only include fields that are being changed
	updateData := make(map[string]interface{})

	// Map common field names
	if name, ok := changes["name"]; ok {
		updateData["name"] = name
	}
	if position, ok := changes["position"]; ok {
		updateData["position"] = position
	}
	if department, ok := changes["department"]; ok {
		updateData["department"] = department
	}
	if status, ok := changes["status"]; ok {
		updateData["status"] = status
	}
	if staffType, ok := changes["type"]; ok {
		updateData["type"] = staffType
	}
	if startPeriod, ok := changes["startPeriod"]; ok {
		updateData["start_period"] = startPeriod
	}
	if endPeriod, ok := changes["endPeriod"]; ok {
		updateData["end_period"] = endPeriod
	}
	if staffOrder, ok := changes["staff_order"]; ok {
		updateData["staff_order"] = staffOrder
	}

	// Always update the updated_at timestamp
	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Marshal update data to JSON
	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("failed to marshal update data: %w", err)
	}

	// Create PATCH request
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update in Supabase: %w", err)
	}
	defer resp.Body.Close()

	// Read response for error reporting
	body, _ := io.ReadAll(resp.Body)

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("Supabase update failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ Updated staff %s in Supabase database", staffId)
	return nil
}

// createStaffInSupabase creates a new staff member in Supabase database
func (s *StaffSyncServer) createStaffInSupabase(staffData map[string]interface{}) (*StaffMember, error) {
	url := fmt.Sprintf("%s/rest/v1/staff", s.supabaseURL)

	// Prepare staff creation data
	createData := make(map[string]interface{})

	// Generate UUID if not provided
	staffId, ok := staffData["id"].(string)
	if !ok || staffId == "" {
		staffId = uuid.New().String()
	}
	createData["id"] = staffId

	// Required fields
	if name, ok := staffData["name"]; ok {
		createData["name"] = name
	} else {
		return nil, fmt.Errorf("name is required")
	}

	// Optional fields with defaults
	if position, ok := staffData["position"]; ok {
		createData["position"] = position
	}
	if department, ok := staffData["department"]; ok {
		createData["department"] = department
	}
	if status, ok := staffData["status"]; ok {
		createData["status"] = status
		// Also map status to type field for database compatibility
		// The database has both 'status' and 'type' fields
		// 'status' stores the Japanese employment status (社員/派遣/パート)
		// 'type' stores the English equivalent or defaults to 'regular'
		if status == "社員" {
			createData["type"] = "regular"
		} else if status == "派遣" || status == "パート" {
			createData["type"] = "part-time"
		} else {
			createData["type"] = "regular" // Default fallback
		}
	} else {
		createData["status"] = "社員"    // Default status
		createData["type"] = "regular" // Default type
	}
	// Allow explicit type override if provided
	if staffType, ok := staffData["type"]; ok {
		createData["type"] = staffType
	}
	if startPeriod, ok := staffData["startPeriod"]; ok {
		createData["start_period"] = startPeriod
	}
	if endPeriod, ok := staffData["endPeriod"]; ok {
		createData["end_period"] = endPeriod
	}
	if staffOrder, ok := staffData["staff_order"]; ok {
		createData["staff_order"] = staffOrder
	}

	// Set default values
	createData["is_active"] = true
	createData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	createData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Set restaurant_id - hardcoded for now, should come from auth context in production
	createData["restaurant_id"] = "e1661c71-b24f-4ee1-9e8b-7290a43c9575"

	// DEBUG: Log the data being sent to Supabase
	log.Printf("🔍 [DEBUG] Creating staff with data: %+v", createData)

	// Marshal creation data to JSON
	jsonData, err := json.Marshal(createData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal create data: %w", err)
	}

	// DEBUG: Log the JSON being sent
	log.Printf("🔍 [DEBUG] JSON payload: %s", string(jsonData))

	// Create POST request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create in Supabase: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read create response: %w", err)
	}

	// Check response status
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase create failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse created staff member
	var createdStaff []StaffMember
	if err := json.Unmarshal(body, &createdStaff); err != nil {
		return nil, fmt.Errorf("failed to parse created staff response: %w", err)
	}

	if len(createdStaff) == 0 {
		return nil, fmt.Errorf("no staff member returned from create")
	}

	log.Printf("✅ Created staff %s (%s) in Supabase database", createdStaff[0].Name, createdStaff[0].ID)
	return &createdStaff[0], nil
}

// deleteStaffInSupabase soft-deletes a staff member in Supabase database
func (s *StaffSyncServer) deleteStaffInSupabase(staffId string) error {
	url := fmt.Sprintf("%s/rest/v1/staff?id=eq.%s", s.supabaseURL, staffId)

	// Soft delete by setting is_active to false
	updateData := map[string]interface{}{
		"is_active":  false,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	// Marshal update data to JSON
	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("failed to marshal delete data: %w", err)
	}

	// Create PATCH request
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete in Supabase: %w", err)
	}
	defer resp.Body.Close()

	// Read response for error reporting
	body, _ := io.ReadAll(resp.Body)

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("Supabase delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ Deleted (soft) staff %s in Supabase database", staffId)
	return nil
}

// handlePing handles lightweight ping messages for connection health check
func (s *StaffSyncServer) handlePing(client *Client, msg *Message) {
	// Extract timestamp from payload if available
	payload, ok := msg.Payload.(map[string]interface{})
	var timestamp int64
	if ok {
		if ts, exists := payload["timestamp"]; exists {
			switch v := ts.(type) {
			case float64:
				timestamp = int64(v)
			case int64:
				timestamp = v
			}
		}
	}

	// Send PONG response with original timestamp
	response := Message{
		Type: MESSAGE_PONG,
		Payload: map[string]interface{}{
			"timestamp": timestamp,
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	responseData, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshaling PONG response: %v", err)
		return
	}

	err = client.conn.WriteMessage(websocket.TextMessage, responseData)
	if err != nil {
		log.Printf("Error sending PONG: %v", err)
	}
}

func (s *StaffSyncServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	health := map[string]interface{}{
		"status":    "healthy",
		"clients":   len(s.clients),
		"endpoint":  "/staff-sync",
		"timestamp": time.Now(),
		"supabase": map[string]string{
			"url":    s.supabaseURL,
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
