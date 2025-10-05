// Shift Management WebSocket Integration
// Real-time shift update synchronization with Supabase persistence
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// ============================================================================
// DATA STRUCTURES - Shift Management
// ============================================================================

// ShiftUpdate represents a single shift cell update
type ShiftUpdate struct {
	StaffID    string    `json:"staffId"`
	DateKey    string    `json:"dateKey"` // Format: "2025-08-24"
	ShiftValue string    `json:"shiftValue"` // △, ○, ×, or custom
	ScheduleID string    `json:"scheduleId"`
	PeriodIndex int      `json:"periodIndex"`
	UserID     string    `json:"userId,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

// ShiftSchedule represents the complete schedule data structure
// Maps to Supabase schedules.schedule_data JSONB column
type ShiftSchedule struct {
	ID         string                       `json:"id"`
	ScheduleData map[string]map[string]string `json:"scheduleData"` // {staffId: {dateKey: shiftValue}}
	PeriodIndex  int                         `json:"periodIndex"`
	UpdatedAt    time.Time                   `json:"updatedAt"`
}

// ShiftSyncRequest represents a client request for current schedule data
type ShiftSyncRequest struct {
	ScheduleID  string `json:"scheduleId"`
	PeriodIndex int    `json:"periodIndex"`
}

// ShiftSyncResponse contains complete schedule data sent to clients
type ShiftSyncResponse struct {
	ScheduleID   string                       `json:"scheduleId"`
	ScheduleData map[string]map[string]string `json:"scheduleData"`
	PeriodIndex  int                          `json:"periodIndex"`
	Timestamp    time.Time                    `json:"timestamp"`
}

// ============================================================================
// WEBSOCKET MESSAGE HANDLERS - Shift Operations
// Message type constants are defined in main.go
// ============================================================================

// handleShiftUpdate processes a single shift cell update
func (s *StaffSyncServer) handleShiftUpdate(client *Client, msg *Message) {
	log.Printf("📝 Processing SHIFT_UPDATE from client %s", client.clientId)

	// Parse payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid SHIFT_UPDATE payload format")
		s.sendErrorResponse(client, "Invalid payload format", nil)
		return
	}

	// Extract shift update data
	staffId, ok := payload["staffId"].(string)
	if !ok {
		log.Printf("❌ Missing staffId in SHIFT_UPDATE")
		s.sendErrorResponse(client, "Missing staffId", nil)
		return
	}

	dateKey, ok := payload["dateKey"].(string)
	if !ok {
		log.Printf("❌ Missing dateKey in SHIFT_UPDATE")
		s.sendErrorResponse(client, "Missing dateKey", nil)
		return
	}

	shiftValue, ok := payload["shiftValue"].(string)
	if !ok {
		log.Printf("❌ Missing shiftValue in SHIFT_UPDATE")
		s.sendErrorResponse(client, "Missing shiftValue", nil)
		return
	}

	scheduleId, ok := payload["scheduleId"].(string)
	if !ok {
		log.Printf("❌ Missing scheduleId in SHIFT_UPDATE")
		s.sendErrorResponse(client, "Missing scheduleId", nil)
		return
	}

	periodIndex := 0
	if period, ok := payload["periodIndex"].(float64); ok {
		periodIndex = int(period)
	}

	// Create shift update object
	shiftUpdate := ShiftUpdate{
		StaffID:     staffId,
		DateKey:     dateKey,
		ShiftValue:  shiftValue,
		ScheduleID:  scheduleId,
		PeriodIndex: periodIndex,
		Timestamp:   time.Now(),
	}

	log.Printf("📝 Shift update: Staff=%s, Date=%s, Value=%s, Schedule=%s",
		staffId, dateKey, shiftValue, scheduleId)

	// Save to Supabase database
	if err := s.updateShiftInSupabase(&shiftUpdate); err != nil {
		log.Printf("❌ Failed to save shift update to Supabase: %v", err)
		s.sendErrorResponse(client, "Failed to save shift update", err)
		return
	}

	log.Printf("✅ Successfully saved shift update to Supabase")

	// Fetch fresh schedule data to ensure consistency
	freshSchedule, err := s.fetchScheduleFromSupabase(scheduleId)
	if err != nil {
		log.Printf("⚠️ Failed to fetch fresh schedule data: %v (broadcasting original)", err)
		// Fallback: broadcast the update we just made
		s.broadcastShiftUpdate(client, &shiftUpdate)
		return
	}

	// Broadcast fresh schedule data to ALL clients viewing this schedule
	s.broadcastScheduleSync(scheduleId, periodIndex, freshSchedule)
	log.Printf("📡 Broadcasted fresh schedule data to all clients")
}

// handleShiftSyncRequest sends current schedule data to requesting client
func (s *StaffSyncServer) handleShiftSyncRequest(client *Client, msg *Message) {
	log.Printf("🔄 Processing SHIFT_SYNC_REQUEST from client %s", client.clientId)

	// Parse payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid SHIFT_SYNC_REQUEST payload format")
		s.sendErrorResponse(client, "Invalid payload format", nil)
		return
	}

	scheduleId, ok := payload["scheduleId"].(string)
	if !ok {
		log.Printf("❌ Missing scheduleId in SHIFT_SYNC_REQUEST")
		s.sendErrorResponse(client, "Missing scheduleId", nil)
		return
	}

	periodIndex := 0
	if period, ok := payload["periodIndex"].(float64); ok {
		periodIndex = int(period)
	}

	log.Printf("🔄 Fetching schedule: %s (period %d)", scheduleId, periodIndex)

	// Fetch schedule from Supabase
	scheduleData, err := s.fetchScheduleFromSupabase(scheduleId)
	if err != nil {
		log.Printf("❌ Failed to fetch schedule: %v", err)
		s.sendErrorResponse(client, "Failed to fetch schedule", err)
		return
	}

	// Send sync response to requesting client
	response := Message{
		Type: MESSAGE_SHIFT_SYNC_RESPONSE,
		Payload: map[string]interface{}{
			"scheduleId":   scheduleId,
			"scheduleData": scheduleData,
			"periodIndex":  periodIndex,
			"timestamp":    time.Now(),
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	if responseBytes, err := json.Marshal(response); err == nil {
		client.conn.WriteMessage(websocket.TextMessage, responseBytes)
		log.Printf("✅ Sent SHIFT_SYNC_RESPONSE to client %s", client.clientId)
	} else {
		log.Printf("❌ Error marshaling sync response: %v", err)
	}
}

// handleShiftBulkUpdate processes multiple shift updates at once
func (s *StaffSyncServer) handleShiftBulkUpdate(client *Client, msg *Message) {
	log.Printf("📦 Processing SHIFT_BULK_UPDATE from client %s", client.clientId)

	// Parse payload
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid SHIFT_BULK_UPDATE payload format")
		s.sendErrorResponse(client, "Invalid payload format", nil)
		return
	}

	scheduleId, ok := payload["scheduleId"].(string)
	if !ok {
		log.Printf("❌ Missing scheduleId in SHIFT_BULK_UPDATE")
		s.sendErrorResponse(client, "Missing scheduleId", nil)
		return
	}

	scheduleData, ok := payload["scheduleData"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing scheduleData in SHIFT_BULK_UPDATE")
		s.sendErrorResponse(client, "Missing scheduleData", nil)
		return
	}

	periodIndex := 0
	if period, ok := payload["periodIndex"].(float64); ok {
		periodIndex = int(period)
	}

	// Convert scheduleData to proper format
	formattedScheduleData := make(map[string]map[string]string)
	for staffId, dates := range scheduleData {
		datesMap, ok := dates.(map[string]interface{})
		if !ok {
			continue
		}
		formattedScheduleData[staffId] = make(map[string]string)
		for dateKey, shiftValue := range datesMap {
			if shiftStr, ok := shiftValue.(string); ok {
				formattedScheduleData[staffId][dateKey] = shiftStr
			}
		}
	}

	log.Printf("📦 Bulk update: Schedule=%s, Period=%d, Updates=%d staff members",
		scheduleId, periodIndex, len(formattedScheduleData))

	// Save bulk update to Supabase
	if err := s.bulkUpdateScheduleInSupabase(scheduleId, formattedScheduleData); err != nil {
		log.Printf("❌ Failed to save bulk update to Supabase: %v", err)
		s.sendErrorResponse(client, "Failed to save bulk update", err)
		return
	}

	log.Printf("✅ Successfully saved bulk update to Supabase")

	// Fetch fresh schedule data
	freshSchedule, err := s.fetchScheduleFromSupabase(scheduleId)
	if err != nil {
		log.Printf("⚠️ Failed to fetch fresh schedule data: %v", err)
		freshSchedule = formattedScheduleData
	}

	// Broadcast to all clients
	s.broadcastScheduleSync(scheduleId, periodIndex, freshSchedule)
	log.Printf("📡 Broadcasted bulk update to all clients")
}

// ============================================================================
// SUPABASE INTEGRATION - Shift Persistence
// ============================================================================

// fetchScheduleFromSupabase retrieves schedule data from Supabase
func (s *StaffSyncServer) fetchScheduleFromSupabase(scheduleId string) (map[string]map[string]string, error) {
	url := fmt.Sprintf("%s/rest/v1/schedules?id=eq.%s&select=schedule_data",
		s.supabaseURL, scheduleId)

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
		return nil, fmt.Errorf("Supabase request failed with status %d: %s",
			resp.StatusCode, string(body))
	}

	// Parse response - Supabase returns array
	var schedules []map[string]interface{}
	if err := json.Unmarshal(body, &schedules); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(schedules) == 0 {
		// Return empty schedule if not found
		log.Printf("⚠️ Schedule %s not found, returning empty", scheduleId)
		return make(map[string]map[string]string), nil
	}

	// Extract schedule_data JSONB
	scheduleDataRaw, ok := schedules[0]["schedule_data"]
	if !ok {
		return make(map[string]map[string]string), nil
	}

	// Convert to proper format
	scheduleData := make(map[string]map[string]string)
	if dataMap, ok := scheduleDataRaw.(map[string]interface{}); ok {
		for staffId, dates := range dataMap {
			if datesMap, ok := dates.(map[string]interface{}); ok {
				scheduleData[staffId] = make(map[string]string)
				for dateKey, shiftValue := range datesMap {
					if shiftStr, ok := shiftValue.(string); ok {
						scheduleData[staffId][dateKey] = shiftStr
					}
				}
			}
		}
	}

	log.Printf("✅ Fetched schedule %s with %d staff members", scheduleId, len(scheduleData))
	return scheduleData, nil
}

// updateShiftInSupabase updates a single shift in the schedule JSONB
func (s *StaffSyncServer) updateShiftInSupabase(update *ShiftUpdate) error {
	// First fetch current schedule data
	currentSchedule, err := s.fetchScheduleFromSupabase(update.ScheduleID)
	if err != nil {
		return fmt.Errorf("failed to fetch current schedule: %w", err)
	}

	// Update the specific shift
	if currentSchedule[update.StaffID] == nil {
		currentSchedule[update.StaffID] = make(map[string]string)
	}
	currentSchedule[update.StaffID][update.DateKey] = update.ShiftValue

	// Save back to Supabase
	return s.bulkUpdateScheduleInSupabase(update.ScheduleID, currentSchedule)
}

// bulkUpdateScheduleInSupabase updates entire schedule_data JSONB
func (s *StaffSyncServer) bulkUpdateScheduleInSupabase(scheduleId string, scheduleData map[string]map[string]string) error {
	url := fmt.Sprintf("%s/rest/v1/schedules?id=eq.%s", s.supabaseURL, scheduleId)

	// Prepare update data
	updateData := map[string]interface{}{
		"schedule_data": scheduleData,
		"updated_at":    time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("failed to marshal update data: %w", err)
	}

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update in Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("Supabase update failed with status %d: %s",
			resp.StatusCode, string(body))
	}

	log.Printf("✅ Updated schedule %s in Supabase", scheduleId)
	return nil
}

// ============================================================================
// BROADCAST HELPERS - Real-time Synchronization
// ============================================================================

// broadcastShiftUpdate broadcasts a single shift update to all clients
func (s *StaffSyncServer) broadcastShiftUpdate(sender *Client, update *ShiftUpdate) {
	broadcastMsg := Message{
		Type: MESSAGE_SHIFT_BROADCAST,
		Payload: map[string]interface{}{
			"staffId":     update.StaffID,
			"dateKey":     update.DateKey,
			"shiftValue":  update.ShiftValue,
			"scheduleId":  update.ScheduleID,
			"periodIndex": update.PeriodIndex,
			"timestamp":   update.Timestamp,
		},
		Timestamp: time.Now(),
		ClientID:  sender.clientId,
	}

	s.broadcastToAll(&broadcastMsg)
}

// broadcastScheduleSync broadcasts complete schedule data to all clients
func (s *StaffSyncServer) broadcastScheduleSync(scheduleId string, periodIndex int, scheduleData map[string]map[string]string) {
	syncMsg := Message{
		Type: MESSAGE_SHIFT_SYNC_RESPONSE,
		Payload: map[string]interface{}{
			"scheduleId":   scheduleId,
			"scheduleData": scheduleData,
			"periodIndex":  periodIndex,
			"timestamp":    time.Now(),
			"broadcast":    true, // Indicates this is a broadcast, not a direct response
		},
		Timestamp: time.Now(),
		ClientID:  "server",
	}

	s.broadcastToAll(&syncMsg)
	log.Printf("📡 Broadcasted schedule sync to all clients (schedule: %s)", scheduleId)
}
