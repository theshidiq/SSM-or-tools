// Phase 2.3: Client Connection Management - Broadcasting logic
package client

import (
	"log"
	"time"

	"shift-schedule-go-server/state"
)

// BroadcastEvent broadcasts an event to all subscribed clients
func (cm *ClientManager) BroadcastEvent(event state.Event) {
	eventData := MarshalEvent(event)

	cm.mutex.RLock()
	subscribers := make([]*state.Client, 0)

	// Find all clients subscribed to this event type
	for _, client := range cm.clients {
		if client.IsSubscribedTo(event.Type) {
			subscribers = append(subscribers, client)
		}
	}
	cm.mutex.RUnlock()

	// Send to all subscribers
	for _, client := range subscribers {
		select {
		case client.SendChan <- eventData:
			// Successfully queued message
		default:
			// Client send buffer full, disconnect the client
			log.Printf("Client %s send buffer full, disconnecting", client.ID)
			cm.disconnectClient(client.ID)
		}
	}
}

// BroadcastToAll sends a message to all connected clients
func (cm *ClientManager) BroadcastToAll(event state.Event) {
	eventData := MarshalEvent(event)

	cm.mutex.RLock()
	clients := make([]*state.Client, 0, len(cm.clients))
	for _, client := range cm.clients {
		clients = append(clients, client)
	}
	cm.mutex.RUnlock()

	for _, client := range clients {
		select {
		case client.SendChan <- eventData:
			// Successfully queued message
		default:
			// Client send buffer full, disconnect the client
			log.Printf("Client %s send buffer full during broadcast, disconnecting", client.ID)
			cm.disconnectClient(client.ID)
		}
	}
}

// BroadcastToClient sends a message to a specific client
func (cm *ClientManager) BroadcastToClient(clientID string, event state.Event) error {
	cm.mutex.RLock()
	client, exists := cm.clients[clientID]
	cm.mutex.RUnlock()

	if !exists {
		return ErrClientNotFound
	}

	eventData := MarshalEvent(event)

	select {
	case client.SendChan <- eventData:
		return nil
	default:
		// Client send buffer full, disconnect the client
		cm.disconnectClient(clientID)
		return ErrClientDisconnected
	}
}

// BroadcastSystemAlert sends a system alert to all clients
func (cm *ClientManager) BroadcastSystemAlert(message string, alertType string) {
	event := state.Event{
		Type: EventTypeSystemAlert,
		Data: map[string]interface{}{
			"message":   message,
			"alertType": alertType,
			"timestamp": time.Now().Format(time.RFC3339),
		},
		Timestamp: time.Now(),
		Version:   0, // System alerts don't have versions
	}

	cm.BroadcastToAll(event)
}

// BroadcastStaffUpdate broadcasts a staff update event
func (cm *ClientManager) BroadcastStaffUpdate(staffID string, changes interface{}, version int64, excludeClientID string) {
	event := state.Event{
		Type: EventTypeStaffUpdate,
		Data: map[string]interface{}{
			"staffId": staffID,
			"changes": changes,
			"version": version,
		},
		Timestamp: time.Now(),
		Version:   version,
	}

	cm.broadcastExcluding(event, excludeClientID)
}

// BroadcastStaffCreate broadcasts a staff creation event
func (cm *ClientManager) BroadcastStaffCreate(staffID string, staffData interface{}, version int64, excludeClientID string) {
	event := state.Event{
		Type: EventTypeStaffCreate,
		Data: map[string]interface{}{
			"staffId": staffID,
			"staff":   staffData,
			"version": version,
		},
		Timestamp: time.Now(),
		Version:   version,
	}

	cm.broadcastExcluding(event, excludeClientID)
}

// BroadcastStaffDelete broadcasts a staff deletion event
func (cm *ClientManager) BroadcastStaffDelete(staffID string, version int64, excludeClientID string) {
	event := state.Event{
		Type: EventTypeStaffDelete,
		Data: map[string]interface{}{
			"staffId": staffID,
			"version": version,
		},
		Timestamp: time.Now(),
		Version:   version,
	}

	cm.broadcastExcluding(event, excludeClientID)
}

// broadcastExcluding broadcasts an event to all subscribed clients except the excluded one
func (cm *ClientManager) broadcastExcluding(event state.Event, excludeClientID string) {
	eventData := MarshalEvent(event)

	cm.mutex.RLock()
	subscribers := make([]*state.Client, 0)

	for _, client := range cm.clients {
		if client.ID != excludeClientID && client.IsSubscribedTo(event.Type) {
			subscribers = append(subscribers, client)
		}
	}
	cm.mutex.RUnlock()

	for _, client := range subscribers {
		select {
		case client.SendChan <- eventData:
			// Successfully queued message
		default:
			// Client send buffer full, disconnect the client
			log.Printf("Client %s send buffer full during targeted broadcast, disconnecting", client.ID)
			cm.disconnectClient(client.ID)
		}
	}
}

// GetBroadcastStats returns statistics about broadcasting
func (cm *ClientManager) GetBroadcastStats() map[string]interface{} {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	stats := map[string]interface{}{
		"totalClients": len(cm.clients),
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	// Count subscriptions by event type
	subscriptionCounts := make(map[string]int)
	for _, client := range cm.clients {
		for eventType := range client.Subscriptions {
			subscriptionCounts[eventType]++
		}
	}
	stats["subscriptionCounts"] = subscriptionCounts

	return stats
}