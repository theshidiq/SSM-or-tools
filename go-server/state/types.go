// Phase 2.1: State Management Engine - Types and interfaces
package state

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"shift-schedule-manager/go-server/models"
)

// StateChange represents a change in the system state
type StateChange struct {
	Type      string                 `json:"type"`
	StaffId   string                 `json:"staffId"`
	Changes   models.StaffUpdateRequest `json:"changes"`
	Version   int64                  `json:"version"`
	Timestamp time.Time              `json:"timestamp"`
	ClientId  string                 `json:"clientId"`
}

// StaffUpdate represents an update to a staff member
type StaffUpdate = models.StaffUpdateRequest

// Client represents a WebSocket client connection
type Client struct {
	ID            string             `json:"id"`
	Conn          *websocket.Conn    `json:"-"`
	LastSeen      time.Time          `json:"lastSeen"`
	Subscriptions map[string]bool    `json:"subscriptions"`
	SendChan      chan []byte        `json:"-"`
	mutex         sync.RWMutex       `json:"-"`
}

// Event represents a system event to be broadcast
type Event struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	Version   int64       `json:"version"`
}

// Marshal converts an event to JSON bytes for sending
func (e Event) Marshal() []byte {
	// Implementation will be added when needed
	return []byte{}
}

// IsSubscribedTo checks if client is subscribed to event type
func (c *Client) IsSubscribedTo(eventType string) bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.Subscriptions[eventType]
}

// AddSubscription adds a subscription for this client
func (c *Client) AddSubscription(eventType string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if c.Subscriptions == nil {
		c.Subscriptions = make(map[string]bool)
	}
	c.Subscriptions[eventType] = true
}

// RemoveSubscription removes a subscription for this client
func (c *Client) RemoveSubscription(eventType string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	delete(c.Subscriptions, eventType)
}

// NewClient creates a new client instance
func NewClient(id string, conn *websocket.Conn) *Client {
	return &Client{
		ID:            id,
		Conn:          conn,
		LastSeen:      time.Now(),
		Subscriptions: make(map[string]bool),
		SendChan:      make(chan []byte, 256),
	}
}