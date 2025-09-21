// Phase 2.3: Client Connection Management - Subscription system
package client

import (
	"encoding/json"
	"sync"
	"time"

	"shift-schedule-go-server/state"
)

// SubscriptionManager manages client subscriptions to different event types
type SubscriptionManager struct {
	subscriptions map[string]map[string]bool // clientID -> eventType -> subscribed
	mutex         sync.RWMutex
}

// NewSubscriptionManager creates a new subscription manager
func NewSubscriptionManager() *SubscriptionManager {
	return &SubscriptionManager{
		subscriptions: make(map[string]map[string]bool),
	}
}

// Subscribe adds a client subscription to an event type
func (sm *SubscriptionManager) Subscribe(clientID, eventType string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	if sm.subscriptions[clientID] == nil {
		sm.subscriptions[clientID] = make(map[string]bool)
	}
	sm.subscriptions[clientID][eventType] = true
}

// Unsubscribe removes a client subscription to an event type
func (sm *SubscriptionManager) Unsubscribe(clientID, eventType string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	if sm.subscriptions[clientID] != nil {
		delete(sm.subscriptions[clientID], eventType)
	}
}

// IsSubscribed checks if a client is subscribed to an event type
func (sm *SubscriptionManager) IsSubscribed(clientID, eventType string) bool {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	if sm.subscriptions[clientID] == nil {
		return false
	}
	return sm.subscriptions[clientID][eventType]
}

// GetSubscriptions returns all subscriptions for a client
func (sm *SubscriptionManager) GetSubscriptions(clientID string) []string {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	var subscriptions []string
	if sm.subscriptions[clientID] != nil {
		for eventType := range sm.subscriptions[clientID] {
			subscriptions = append(subscriptions, eventType)
		}
	}
	return subscriptions
}

// RemoveClient removes all subscriptions for a client
func (sm *SubscriptionManager) RemoveClient(clientID string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	delete(sm.subscriptions, clientID)
}

// GetSubscribersForEvent returns all client IDs subscribed to an event type
func (sm *SubscriptionManager) GetSubscribersForEvent(eventType string) []string {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	var subscribers []string
	for clientID, eventMap := range sm.subscriptions {
		if eventMap[eventType] {
			subscribers = append(subscribers, clientID)
		}
	}
	return subscribers
}

// Event types supported by the subscription system
const (
	EventTypeStaffUpdate = "staff_update"
	EventTypeStaffCreate = "staff_create"
	EventTypeStaffDelete = "staff_delete"
	EventTypeSyncUpdate  = "sync_update"
	EventTypeSystemAlert = "system_alert"
)

// SubscriptionRequest represents a client subscription request
type SubscriptionRequest struct {
	Action    string `json:"action"`    // "subscribe" or "unsubscribe"
	EventType string `json:"eventType"` // Event type to subscribe/unsubscribe
}

// SubscriptionResponse represents a subscription response
type SubscriptionResponse struct {
	Success      bool     `json:"success"`
	EventType    string   `json:"eventType"`
	Subscriptions []string `json:"subscriptions"`
	Message      string   `json:"message,omitempty"`
}

// MarshalEvent marshals an event to JSON for transmission
func MarshalEvent(event state.Event) []byte {
	data, err := json.Marshal(event)
	if err != nil {
		// Return error event if marshal fails
		errorEvent := state.Event{
			Type:      "error",
			Data:      map[string]interface{}{"error": "Failed to marshal event"},
			Timestamp: time.Now(),
			Version:   0,
		}
		data, _ = json.Marshal(errorEvent)
	}
	return data
}