// Phase 1.3: WebSocket Protocol Design - Message types as specified in official plan
package models

import "time"

// WebSocketMessage - Exact interface from official plan lines 125-131
type WebSocketMessage struct {
    Type           string      `json:"type"`
    Payload        interface{} `json:"payload"`
    Timestamp      string      `json:"timestamp"`
    ClientID       string      `json:"clientId"`
    SequenceNumber int         `json:"sequenceNumber"`
}

// StaffUpdateMessage - Exact interface from official plan lines 133-141
type StaffUpdateMessage struct {
    Type    string             `json:"type"`
    Payload StaffUpdatePayload `json:"payload"`
}

type StaffUpdatePayload struct {
    StaffID string                 `json:"staffId"`
    Changes map[string]interface{} `json:"changes"`
    Version int64                  `json:"version"`
}

// Message types as defined in official plan line 126
const (
    MessageTypeStaffUpdate = "STAFF_UPDATE"
    MessageTypeStaffCreate = "STAFF_CREATE"
    MessageTypeStaffDelete = "STAFF_DELETE"
    MessageTypeSyncRequest = "SYNC_REQUEST"
    MessageTypeSyncResponse = "SYNC_RESPONSE"
    MessageTypePing = "PING"
    MessageTypePong = "PONG"
)

// NewWebSocketMessage creates a new WebSocket message with timestamp
func NewWebSocketMessage(msgType string, payload interface{}, clientID string, sequenceNumber int) *WebSocketMessage {
    return &WebSocketMessage{
        Type:           msgType,
        Payload:        payload,
        Timestamp:      time.Now().UTC().Format(time.RFC3339),
        ClientID:       clientID,
        SequenceNumber: sequenceNumber,
    }
}

// NewStaffUpdateMessage creates a staff update message
func NewStaffUpdateMessage(staffID string, changes map[string]interface{}, version int64) *StaffUpdateMessage {
    return &StaffUpdateMessage{
        Type: MessageTypeStaffUpdate,
        Payload: StaffUpdatePayload{
            StaffID: staffID,
            Changes: changes,
            Version: version,
        },
    }
}