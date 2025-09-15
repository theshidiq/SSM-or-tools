// Phase 1.3: WebSocket Protocol Design - Staff member model
package models

import "time"

// StaffMember represents a staff member in the system
type StaffMember struct {
    ID         string    `json:"id" db:"id"`
    Name       string    `json:"name" db:"name"`
    Position   string    `json:"position" db:"position"`
    Department string    `json:"department" db:"department"`
    Type       string    `json:"type" db:"type"` // regular, part-time
    CreatedAt  time.Time `json:"created_at" db:"created_at"`
    UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
    Version    int64     `json:"version" db:"version"`
    Period     int       `json:"period" db:"period"` // Monthly period index
}

// StaffCreateRequest represents a request to create a new staff member
type StaffCreateRequest struct {
    Name       string `json:"name"`
    Position   string `json:"position"`
    Department string `json:"department"`
    Type       string `json:"type"`
    Period     int    `json:"period"`
}

// StaffUpdateRequest represents a request to update an existing staff member
type StaffUpdateRequest struct {
    Name       *string `json:"name,omitempty"`
    Position   *string `json:"position,omitempty"`
    Department *string `json:"department,omitempty"`
    Type       *string `json:"type,omitempty"`
    Version    int64   `json:"version"`
}

// StaffSyncRequest represents a request to sync staff data for a period
type StaffSyncRequest struct {
    Period int `json:"period"`
}

// StaffSyncResponse represents the response with staff data
type StaffSyncResponse struct {
    StaffMembers []StaffMember `json:"staffMembers"`
    Period       int           `json:"period"`
    Version      int64         `json:"version"`
    Timestamp    time.Time     `json:"timestamp"`
}