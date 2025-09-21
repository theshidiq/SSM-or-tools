// Phase 2.3: Client Connection Management - ClientManager implementation (lines 234-263)
package client

import (
	"errors"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"shift-schedule-go-server/state"
)

var (
	ErrClientNotFound     = errors.New("client not found")
	ErrClientDisconnected = errors.New("client disconnected")
	ErrInvalidMessage     = errors.New("invalid message format")
)

// ClientManager - Exact implementation from official plan lines 235-239
type ClientManager struct {
	clients   map[string]*state.Client
	mutex     sync.RWMutex
	heartbeat time.Duration
	subManager *SubscriptionManager
}

// NewClientManager creates a new client manager
func NewClientManager(heartbeat time.Duration) *ClientManager {
	return &ClientManager{
		clients:    make(map[string]*state.Client),
		heartbeat:  heartbeat,
		subManager: NewSubscriptionManager(),
	}
}

// AddClient adds a new client to the manager
func (cm *ClientManager) AddClient(clientID string, conn *websocket.Conn) *state.Client {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	client := state.NewClient(clientID, conn)
	cm.clients[clientID] = client

	log.Printf("Client %s connected", clientID)
	return client
}

// RemoveClient removes a client from the manager
func (cm *ClientManager) RemoveClient(clientID string) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	client, exists := cm.clients[clientID]
	if exists {
		// Close the WebSocket connection
		if client.Conn != nil {
			client.Conn.Close()
		}

		// Close the send channel
		close(client.SendChan)

		// Remove from clients map
		delete(cm.clients, clientID)

		// Remove all subscriptions
		cm.subManager.RemoveClient(clientID)

		log.Printf("Client %s disconnected", clientID)
	}
}

// GetClient returns a client by ID
func (cm *ClientManager) GetClient(clientID string) (*state.Client, error) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	client, exists := cm.clients[clientID]
	if !exists {
		return nil, ErrClientNotFound
	}

	return client, nil
}

// GetAllClients returns all connected clients
func (cm *ClientManager) GetAllClients() []*state.Client {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	clients := make([]*state.Client, 0, len(cm.clients))
	for _, client := range cm.clients {
		clients = append(clients, client)
	}

	return clients
}

// BroadcastToSubscribers - Exact implementation from official plan lines 249-263
func (cm *ClientManager) BroadcastToSubscribers(event state.Event) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	for _, client := range cm.clients {
		if client.IsSubscribedTo(event.Type) {
			select {
			case client.SendChan <- event.Marshal():
			default:
				// Client send buffer full, disconnect
				cm.disconnectClient(client.ID)
			}
		}
	}
}

// disconnectClient internal method to disconnect a client (called with locks held)
func (cm *ClientManager) disconnectClient(clientID string) {
	// This should be called without holding the mutex since RemoveClient will acquire it
	go cm.RemoveClient(clientID)
}

// SubscribeClient subscribes a client to an event type
func (cm *ClientManager) SubscribeClient(clientID, eventType string) error {
	cm.mutex.RLock()
	client, exists := cm.clients[clientID]
	cm.mutex.RUnlock()

	if !exists {
		return ErrClientNotFound
	}

	client.AddSubscription(eventType)
	cm.subManager.Subscribe(clientID, eventType)

	log.Printf("Client %s subscribed to %s", clientID, eventType)
	return nil
}

// UnsubscribeClient unsubscribes a client from an event type
func (cm *ClientManager) UnsubscribeClient(clientID, eventType string) error {
	cm.mutex.RLock()
	client, exists := cm.clients[clientID]
	cm.mutex.RUnlock()

	if !exists {
		return ErrClientNotFound
	}

	client.RemoveSubscription(eventType)
	cm.subManager.Unsubscribe(clientID, eventType)

	log.Printf("Client %s unsubscribed from %s", clientID, eventType)
	return nil
}

// UpdateClientHeartbeat updates the last seen time for a client
func (cm *ClientManager) UpdateClientHeartbeat(clientID string) error {
	cm.mutex.RLock()
	client, exists := cm.clients[clientID]
	cm.mutex.RUnlock()

	if !exists {
		return ErrClientNotFound
	}

	client.LastSeen = time.Now()
	return nil
}

// StartHeartbeatMonitor starts monitoring client heartbeats
func (cm *ClientManager) StartHeartbeatMonitor() {
	ticker := time.NewTicker(cm.heartbeat)
	go func() {
		for range ticker.C {
			cm.checkClientHeartbeats()
		}
	}()
}

// checkClientHeartbeats checks for inactive clients and removes them
func (cm *ClientManager) checkClientHeartbeats() {
	now := time.Now()
	timeout := cm.heartbeat * 3 // Allow 3 heartbeat intervals before timeout

	cm.mutex.RLock()
	inactiveClients := make([]string, 0)
	for clientID, client := range cm.clients {
		if now.Sub(client.LastSeen) > timeout {
			inactiveClients = append(inactiveClients, clientID)
		}
	}
	cm.mutex.RUnlock()

	// Remove inactive clients
	for _, clientID := range inactiveClients {
		log.Printf("Client %s timed out, removing", clientID)
		cm.RemoveClient(clientID)
	}
}

// GetClientCount returns the number of connected clients
func (cm *ClientManager) GetClientCount() int {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return len(cm.clients)
}

// GetClientStats returns statistics about connected clients
func (cm *ClientManager) GetClientStats() map[string]interface{} {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	stats := map[string]interface{}{
		"totalClients": len(cm.clients),
		"heartbeat":    cm.heartbeat.String(),
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	// Count clients by their last seen time
	activeCount := 0
	for _, client := range cm.clients {
		if time.Since(client.LastSeen) < cm.heartbeat*2 {
			activeCount++
		}
	}
	stats["activeClients"] = activeCount

	return stats
}