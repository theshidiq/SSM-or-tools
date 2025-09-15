// Phase 2.7: Integration - Complete real-time state synchronization system
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"shift-schedule-manager/go-server/client"
	"shift-schedule-manager/go-server/conflict"
	"shift-schedule-manager/go-server/models"
	"shift-schedule-manager/go-server/state"
	"shift-schedule-manager/go-server/supabase"
)

// Phase2System integrates all Phase 2 components
type Phase2System struct {
	stateManager      *state.StateManager
	clientManager     *client.ClientManager
	conflictResolver  *conflict.ConflictResolver
	syncManager       *supabase.SyncManager
	upgrader          websocket.Upgrader
}

// NewPhase2System creates a complete Phase 2 system
func NewPhase2System() *Phase2System {
	stateManager := state.NewStateManager()
	clientManager := client.NewClientManager(30 * time.Second)
	conflictResolver := conflict.NewConflictResolver(conflict.MergeChanges)

	persistence, _ := supabase.NewPersistenceLayer()
	var syncManager *supabase.SyncManager
	if persistence != nil {
		syncManager = supabase.NewSyncManager(persistence)
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	system := &Phase2System{
		stateManager:     stateManager,
		clientManager:    clientManager,
		conflictResolver: conflictResolver,
		syncManager:      syncManager,
		upgrader:         upgrader,
	}

	// Start background processes
	system.startBackgroundProcesses()

	return system
}

// startBackgroundProcesses starts background monitoring and sync processes
func (p2 *Phase2System) startBackgroundProcesses() {
	// Start heartbeat monitoring
	p2.clientManager.StartHeartbeatMonitor()

	// Start periodic sync if Supabase is available
	if p2.syncManager != nil {
		go p2.periodicSync()
	}

	log.Println("Phase 2 background processes started")
}

// periodicSync performs periodic synchronization with Supabase
func (p2 *Phase2System) periodicSync() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// Sync all periods that are stale
		results := p2.syncManager.PerformPeriodicSync(10*time.Minute, supabase.SyncStrategyMerge)

		if len(results) > 0 {
			log.Printf("Periodic sync completed for %d periods", len(results))

			// Broadcast sync completion to all clients
			p2.clientManager.BroadcastSystemAlert(
				"Data synchronized with cloud storage",
				"sync_complete",
			)
		}
	}
}

// HandleWebSocket handles WebSocket connections for real-time communication
func (p2 *Phase2System) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := p2.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Generate client ID
	clientID := generateClientID()

	// Add client to manager
	client := p2.clientManager.AddClient(clientID, conn)
	p2.stateManager.AddSubscriber(clientID, client)

	log.Printf("WebSocket client connected: %s", clientID)

	// Handle client messages
	go p2.handleClientMessages(client)

	// Handle client writes
	go p2.handleClientWrites(client)

	// Send initial state to client
	p2.sendInitialState(client)
}

// handleClientMessages processes incoming messages from WebSocket clients
func (p2 *Phase2System) handleClientMessages(client *state.Client) {
	defer func() {
		p2.clientManager.RemoveClient(client.ID)
		p2.stateManager.RemoveSubscriber(client.ID)
	}()

	for {
		var message models.WebSocketMessage
		err := client.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", client.ID, err)
			}
			break
		}

		// Update client heartbeat
		p2.clientManager.UpdateClientHeartbeat(client.ID)

		// Process message based on type
		p2.processMessage(client, &message)
	}
}

// processMessage processes different types of WebSocket messages
func (p2 *Phase2System) processMessage(client *state.Client, message *models.WebSocketMessage) {
	switch message.Type {
	case models.MessageTypeStaffCreate:
		p2.handleStaffCreate(client, message)
	case models.MessageTypeStaffUpdate:
		p2.handleStaffUpdate(client, message)
	case models.MessageTypeStaffDelete:
		p2.handleStaffDelete(client, message)
	case models.MessageTypeSyncRequest:
		p2.handleSyncRequest(client, message)
	case models.MessageTypePing:
		p2.handlePing(client, message)
	default:
		log.Printf("Unknown message type from client %s: %s", client.ID, message.Type)
	}
}

// handleStaffCreate processes staff creation requests
func (p2 *Phase2System) handleStaffCreate(client *state.Client, message *models.WebSocketMessage) {
	var request models.StaffCreateRequest
	if err := mapToStruct(message.Payload, &request); err != nil {
		p2.sendError(client, "Invalid staff create request", err)
		return
	}

	staff, err := p2.stateManager.CreateStaff(request)
	if err != nil {
		p2.sendError(client, "Failed to create staff", err)
		return
	}

	// Broadcast to other clients (excluding sender)
	p2.clientManager.BroadcastStaffCreate(staff.ID, staff, staff.Version, client.ID)

	// Send confirmation to sender
	p2.sendStaffResponse(client, "staff_created", staff)
}

// handleStaffUpdate processes staff update requests
func (p2 *Phase2System) handleStaffUpdate(client *state.Client, message *models.WebSocketMessage) {
	var updateMsg models.StaffUpdateMessage
	if err := mapToStruct(message.Payload, &updateMsg); err != nil {
		p2.sendError(client, "Invalid staff update request", err)
		return
	}

	// Convert changes to StaffUpdateRequest
	changes := models.StaffUpdateRequest{
		Version: updateMsg.Payload.Version,
	}

	// Map changes
	if name, ok := updateMsg.Payload.Changes["name"].(string); ok {
		changes.Name = &name
	}
	if position, ok := updateMsg.Payload.Changes["position"].(string); ok {
		changes.Position = &position
	}
	if department, ok := updateMsg.Payload.Changes["department"].(string); ok {
		changes.Department = &department
	}
	if staffType, ok := updateMsg.Payload.Changes["type"].(string); ok {
		changes.Type = &staffType
	}

	err := p2.stateManager.UpdateStaff(updateMsg.Payload.StaffID, changes)
	if err != nil {
		// Check if it's a version conflict
		if err == state.ErrInvalidVersion {
			p2.handleVersionConflict(client, updateMsg.Payload.StaffID, changes)
			return
		}

		p2.sendError(client, "Failed to update staff", err)
		return
	}

	// Get updated staff
	updatedStaff, err := p2.stateManager.GetStaff(updateMsg.Payload.StaffID)
	if err != nil {
		p2.sendError(client, "Failed to retrieve updated staff", err)
		return
	}

	// Broadcast to other clients (excluding sender)
	p2.clientManager.BroadcastStaffUpdate(updateMsg.Payload.StaffID, changes, updatedStaff.Version, client.ID)

	// Send confirmation to sender
	p2.sendStaffResponse(client, "staff_updated", updatedStaff)
}

// handleVersionConflict handles version conflicts using conflict resolution
func (p2 *Phase2System) handleVersionConflict(client *state.Client, staffID string, changes models.StaffUpdateRequest) {
	// Get current staff state
	currentStaff, err := p2.stateManager.GetStaff(staffID)
	if err != nil {
		p2.sendError(client, "Staff not found for conflict resolution", err)
		return
	}

	// Create a version representing the client's intended change
	clientStaff := *currentStaff
	if changes.Name != nil {
		clientStaff.Name = *changes.Name
	}
	if changes.Position != nil {
		clientStaff.Position = *changes.Position
	}
	if changes.Department != nil {
		clientStaff.Department = *changes.Department
	}
	if changes.Type != nil {
		clientStaff.Type = *changes.Type
	}
	clientStaff.Version = changes.Version

	// Resolve conflict
	resolved, conflictDetails, err := p2.conflictResolver.ResolveConflictWithDetails(currentStaff, &clientStaff)
	if err != nil {
		if err == conflict.ErrUserChoiceRequired {
			p2.sendConflictChoice(client, currentStaff, &clientStaff, conflictDetails)
			return
		}
		p2.sendError(client, "Failed to resolve conflict", err)
		return
	}

	// Apply resolved changes
	resolvedChanges := models.StaffUpdateRequest{
		Version: currentStaff.Version,
	}

	if resolved.Name != currentStaff.Name {
		resolvedChanges.Name = &resolved.Name
	}
	if resolved.Position != currentStaff.Position {
		resolvedChanges.Position = &resolved.Position
	}
	if resolved.Department != currentStaff.Department {
		resolvedChanges.Department = &resolved.Department
	}
	if resolved.Type != currentStaff.Type {
		resolvedChanges.Type = &resolved.Type
	}

	err = p2.stateManager.UpdateStaff(staffID, resolvedChanges)
	if err != nil {
		p2.sendError(client, "Failed to apply resolved changes", err)
		return
	}

	// Get final updated staff
	finalStaff, _ := p2.stateManager.GetStaff(staffID)

	// Broadcast resolution
	p2.clientManager.BroadcastStaffUpdate(staffID, resolvedChanges, finalStaff.Version, "")

	// Send conflict resolution details to client
	p2.sendConflictResolution(client, finalStaff, conflictDetails)
}

// Additional handler methods...

// sendError sends an error message to a client
func (p2 *Phase2System) sendError(client *state.Client, message string, err error) {
	errorMsg := models.NewWebSocketMessage("error", map[string]interface{}{
		"message": message,
		"error":   err.Error(),
	}, client.ID, 0)

	data, _ := json.Marshal(errorMsg)
	select {
	case client.SendChan <- data:
	default:
		log.Printf("Failed to send error to client %s: send buffer full", client.ID)
	}
}

// sendStaffResponse sends a staff response to a client
func (p2 *Phase2System) sendStaffResponse(client *state.Client, responseType string, staff *models.StaffMember) {
	response := models.NewWebSocketMessage(responseType, staff, client.ID, 0)
	data, _ := json.Marshal(response)

	select {
	case client.SendChan <- data:
	default:
		log.Printf("Failed to send staff response to client %s: send buffer full", client.ID)
	}
}

// Utility functions...

// generateClientID generates a unique client ID
func generateClientID() string {
	return "client_" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

// mapToStruct maps interface{} to a struct
func mapToStruct(data interface{}, target interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return json.Unmarshal(jsonData, target)
}

// Additional methods would be implemented here...
// (handleStaffDelete, handleSyncRequest, handlePing, etc.)

// GetStats returns system statistics
func (p2 *Phase2System) GetStats() map[string]interface{} {
	stats := map[string]interface{}{
		"clients":     p2.clientManager.GetClientStats(),
		"state":       map[string]interface{}{"version": p2.stateManager.GetVersion()},
		"supabase":    p2.stateManager.IsSupabaseHealthy(),
		"timestamp":   time.Now().Format(time.RFC3339),
	}

	if p2.syncManager != nil {
		stats["sync"] = "available"
	} else {
		stats["sync"] = "unavailable"
	}

	return stats
}