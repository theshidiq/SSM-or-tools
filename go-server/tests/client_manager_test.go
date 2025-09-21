// Phase 2.6: Testing Suite - ClientManager tests
package tests

import (
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"shift-schedule-go-server/client"
	"shift-schedule-go-server/state"
)

// MockWebSocketConn is a mock WebSocket connection for testing
type MockWebSocketConn struct {
	closed bool
}

func (m *MockWebSocketConn) Close() error {
	m.closed = true
	return nil
}

func (m *MockWebSocketConn) ReadMessage() (messageType int, p []byte, err error) {
	return websocket.TextMessage, []byte("mock message"), nil
}

func (m *MockWebSocketConn) WriteMessage(messageType int, data []byte) error {
	return nil
}

func (m *MockWebSocketConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (m *MockWebSocketConn) SetWriteDeadline(t time.Time) error {
	return nil
}

func TestClientManager_AddAndRemoveClient(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)
	mockConn := &MockWebSocketConn{}

	// Test adding client
	clientID := "test-client-1"
	addedClient := cm.AddClient(clientID, mockConn)

	if addedClient.ID != clientID {
		t.Errorf("Expected client ID %s, got %s", clientID, addedClient.ID)
	}

	// Test getting client
	retrievedClient, err := cm.GetClient(clientID)
	if err != nil {
		t.Fatalf("Failed to get client: %v", err)
	}

	if retrievedClient.ID != clientID {
		t.Errorf("Expected retrieved client ID %s, got %s", clientID, retrievedClient.ID)
	}

	// Test client count
	if cm.GetClientCount() != 1 {
		t.Errorf("Expected 1 client, got %d", cm.GetClientCount())
	}

	// Test removing client
	cm.RemoveClient(clientID)

	// Verify client is removed
	_, err = cm.GetClient(clientID)
	if err == nil {
		t.Error("Expected error when getting removed client, got nil")
	}

	if cm.GetClientCount() != 0 {
		t.Errorf("Expected 0 clients after removal, got %d", cm.GetClientCount())
	}

	if !mockConn.closed {
		t.Error("Expected WebSocket connection to be closed after client removal")
	}
}

func TestClientManager_GetAllClients(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)

	// Add multiple clients
	clientIDs := []string{"client1", "client2", "client3"}
	for _, id := range clientIDs {
		mockConn := &MockWebSocketConn{}
		cm.AddClient(id, mockConn)
	}

	// Test getting all clients
	allClients := cm.GetAllClients()
	if len(allClients) != len(clientIDs) {
		t.Errorf("Expected %d clients, got %d", len(clientIDs), len(allClients))
	}

	// Verify all client IDs are present
	foundIDs := make(map[string]bool)
	for _, client := range allClients {
		foundIDs[client.ID] = true
	}

	for _, expectedID := range clientIDs {
		if !foundIDs[expectedID] {
			t.Errorf("Expected to find client ID %s", expectedID)
		}
	}
}

func TestClientManager_SubscribeAndUnsubscribe(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)
	mockConn := &MockWebSocketConn{}

	clientID := "test-client"
	client := cm.AddClient(clientID, mockConn)

	// Test subscribing to event type
	eventType := "staff_update"
	err := cm.SubscribeClient(clientID, eventType)
	if err != nil {
		t.Fatalf("Failed to subscribe client: %v", err)
	}

	// Verify subscription
	if !client.IsSubscribedTo(eventType) {
		t.Error("Client should be subscribed to staff_update")
	}

	// Test unsubscribing
	err = cm.UnsubscribeClient(clientID, eventType)
	if err != nil {
		t.Fatalf("Failed to unsubscribe client: %v", err)
	}

	// Verify unsubscription
	if client.IsSubscribedTo(eventType) {
		t.Error("Client should not be subscribed to staff_update after unsubscribe")
	}
}

func TestClientManager_BroadcastToSubscribers(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)

	// Add clients with different subscriptions
	mockConn1 := &MockWebSocketConn{}
	mockConn2 := &MockWebSocketConn{}
	mockConn3 := &MockWebSocketConn{}

	client1 := cm.AddClient("client1", mockConn1)
	client2 := cm.AddClient("client2", mockConn2)
	client3 := cm.AddClient("client3", mockConn3)

	// Subscribe clients to different events
	client1.AddSubscription("staff_update")
	client2.AddSubscription("staff_update")
	client3.AddSubscription("staff_create")

	// Create test event
	event := state.Event{
		Type: "staff_update",
		Data: map[string]interface{}{
			"staffId": "test-staff",
			"changes": map[string]interface{}{"name": "Updated Name"},
		},
		Timestamp: time.Now(),
		Version:   1,
	}

	// Mock the Marshal method for this test
	// In real implementation, this would return JSON bytes

	// Test broadcasting - this is a basic test since we're using mock connections
	// In real implementation, we would verify the messages were sent
	cm.BroadcastToSubscribers(event)

	// For this test, we mainly verify no panics occurred
	// More sophisticated testing would require implementing message tracking
}

func TestClientManager_UpdateHeartbeat(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)
	mockConn := &MockWebSocketConn{}

	clientID := "heartbeat-client"
	client := cm.AddClient(clientID, mockConn)

	originalHeartbeat := client.LastSeen

	// Wait a small amount to ensure time difference
	time.Sleep(10 * time.Millisecond)

	// Update heartbeat
	err := cm.UpdateClientHeartbeat(clientID)
	if err != nil {
		t.Fatalf("Failed to update client heartbeat: %v", err)
	}

	// Verify heartbeat was updated
	if !client.LastSeen.After(originalHeartbeat) {
		t.Error("Expected LastSeen to be updated after heartbeat")
	}
}

func TestClientManager_GetClientStats(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)

	// Add some clients
	for i := 0; i < 3; i++ {
		mockConn := &MockWebSocketConn{}
		clientID := fmt.Sprintf("stats-client-%d", i)
		cm.AddClient(clientID, mockConn)
	}

	stats := cm.GetClientStats()

	// Verify stats structure
	if totalClients, exists := stats["totalClients"]; !exists {
		t.Error("Expected totalClients in stats")
	} else if totalClients != 3 {
		t.Errorf("Expected 3 total clients, got %v", totalClients)
	}

	if heartbeat, exists := stats["heartbeat"]; !exists {
		t.Error("Expected heartbeat in stats")
	} else if heartbeat != "30s" {
		t.Errorf("Expected heartbeat '30s', got %v", heartbeat)
	}

	if timestamp, exists := stats["timestamp"]; !exists {
		t.Error("Expected timestamp in stats")
	} else if timestamp == "" {
		t.Error("Expected non-empty timestamp")
	}

	if activeClients, exists := stats["activeClients"]; !exists {
		t.Error("Expected activeClients in stats")
	} else if activeClients != 3 {
		t.Errorf("Expected 3 active clients, got %v", activeClients)
	}
}

func TestClientManager_NonExistentClient(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)

	nonExistentID := "does-not-exist"

	// Test getting non-existent client
	_, err := cm.GetClient(nonExistentID)
	if err == nil {
		t.Error("Expected error when getting non-existent client")
	}

	// Test subscribing non-existent client
	err = cm.SubscribeClient(nonExistentID, "staff_update")
	if err == nil {
		t.Error("Expected error when subscribing non-existent client")
	}

	// Test unsubscribing non-existent client
	err = cm.UnsubscribeClient(nonExistentID, "staff_update")
	if err == nil {
		t.Error("Expected error when unsubscribing non-existent client")
	}

	// Test updating heartbeat for non-existent client
	err = cm.UpdateClientHeartbeat(nonExistentID)
	if err == nil {
		t.Error("Expected error when updating heartbeat for non-existent client")
	}
}

// Helper function for string formatting in tests
func sprintf(format string, args ...interface{}) string {
	// This is a simplified sprintf for the test
	// In real code, use fmt.Sprintf
	if len(args) == 0 {
		return format
	}
	// Basic replacement for one %d argument
	if args[0] != nil {
		if i, ok := args[0].(int); ok {
			// Replace %d with the integer
			return format[:len(format)-2] + string(rune('0'+i))
		}
	}
	return format
}

// MockBroadcaster implements a simple broadcaster for testing
type MockBroadcaster struct {
	messagesSent []state.Event
}

func (mb *MockBroadcaster) BroadcastEvent(event state.Event) {
	mb.messagesSent = append(mb.messagesSent, event)
}

func TestClientManager_BroadcastEvent(t *testing.T) {
	cm := client.NewClientManager(30 * time.Second)

	// Add clients
	mockConn := &MockWebSocketConn{}
	client := cm.AddClient("broadcast-test-client", mockConn)
	client.AddSubscription("staff_update")

	// Create event
	event := state.Event{
		Type: "staff_update",
		Data: map[string]interface{}{
			"staffId": "test-staff",
			"version": int64(1),
		},
		Timestamp: time.Now(),
		Version:   1,
	}

	// Test broadcast - mainly testing that it doesn't panic
	cm.BroadcastEvent(event)

	// In a full implementation, we would verify the message was actually sent
	// For now, we just ensure the method completes without error
}