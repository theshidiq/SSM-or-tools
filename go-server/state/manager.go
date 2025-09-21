// Phase 2.1: State Management Engine - StateManager implementation (lines 164-200)
package state

import (
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"shift-schedule-go-server/models"
	"shift-schedule-go-server/supabase"
)

var (
	ErrStaffNotFound     = errors.New("staff member not found")
	ErrInvalidVersion    = errors.New("invalid version for update")
	ErrValidationFailed  = errors.New("validation failed")
)

// StateManager - Exact implementation from official plan lines 164-171
type StateManager struct {
	staffMembers  map[string]*models.StaffMember
	mutex         sync.RWMutex
	version       int64
	changeLog     []StateChange
	subscribers   map[string]*Client
	versionCtrl   *VersionController
	changeLogger  *ChangeLogger
	persistence   *supabase.PersistenceLayer
}

// NewStateManager creates a new StateManager instance
func NewStateManager() *StateManager {
	persistence, err := supabase.NewPersistenceLayer()
	if err != nil {
		log.Printf("Warning: Failed to initialize Supabase persistence: %v", err)
		persistence = nil // Continue with in-memory only
	}

	return &StateManager{
		staffMembers:  make(map[string]*models.StaffMember),
		changeLog:     make([]StateChange, 0, 1000),
		subscribers:   make(map[string]*Client),
		versionCtrl:   NewVersionController(),
		changeLogger:  NewChangeLogger(1000),
		persistence:   persistence,
	}
}

// UpdateStaff - Exact implementation from official plan lines 173-200
func (sm *StateManager) UpdateStaff(staffId string, changes StaffUpdate) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	// Apply changes with conflict detection
	if err := sm.validateUpdate(staffId, changes); err != nil {
		return err
	}

	// Get or create staff member
	staff, exists := sm.staffMembers[staffId]
	if !exists {
		return ErrStaffNotFound
	}

	// Update state
	sm.staffMembers[staffId] = sm.applyChanges(staff, changes)
	sm.version = sm.versionCtrl.NextVersion()

	// Log change
	sm.changeLog = append(sm.changeLog, StateChange{
		Type:      "staff_update",
		StaffId:   staffId,
		Changes:   changes,
		Version:   sm.version,
		Timestamp: time.Now(),
		ClientId:  "", // Will be set by caller
	})

	// Broadcast to subscribers
	sm.broadcastChange(staffId, changes)

	// Persist to Supabase
	return sm.persistToSupabase(staffId, sm.staffMembers[staffId])
}

// validateUpdate checks if the update is valid
func (sm *StateManager) validateUpdate(staffId string, changes StaffUpdate) error {
	staff, exists := sm.staffMembers[staffId]
	if !exists {
		return ErrStaffNotFound
	}

	// Version check for conflict detection
	if changes.Version != 0 && changes.Version != staff.Version {
		return ErrInvalidVersion
	}

	// Validate field constraints
	if changes.Name != nil && len(*changes.Name) == 0 {
		return fmt.Errorf("%w: name cannot be empty", ErrValidationFailed)
	}

	if changes.Type != nil && *changes.Type != "regular" && *changes.Type != "part-time" {
		return fmt.Errorf("%w: type must be 'regular' or 'part-time'", ErrValidationFailed)
	}

	return nil
}

// applyChanges applies the changes to a staff member and returns updated copy
func (sm *StateManager) applyChanges(staff *models.StaffMember, changes StaffUpdate) *models.StaffMember {
	// Create a copy to avoid modifying the original
	updated := *staff

	if changes.Name != nil {
		updated.Name = *changes.Name
	}
	if changes.Position != nil {
		updated.Position = *changes.Position
	}
	if changes.Department != nil {
		updated.Department = *changes.Department
	}
	if changes.Type != nil {
		updated.Type = *changes.Type
	}

	updated.UpdatedAt = time.Now()
	updated.Version = sm.version

	return &updated
}

// broadcastChange broadcasts the change to all subscribers
func (sm *StateManager) broadcastChange(staffId string, changes StaffUpdate) {
	event := Event{
		Type: "staff_update",
		Data: map[string]interface{}{
			"staffId": staffId,
			"changes": changes,
			"version": sm.version,
		},
		Timestamp: time.Now(),
		Version:   sm.version,
	}

	// Broadcast to all subscribers (actual implementation will use ClientManager)
	for _, client := range sm.subscribers {
		if client.IsSubscribedTo("staff_update") {
			select {
			case client.SendChan <- event.Marshal():
			default:
				// Client send buffer full, will be handled by ClientManager
			}
		}
	}
}

// persistToSupabase persists the staff member to Supabase
func (sm *StateManager) persistToSupabase(staffId string, staff *models.StaffMember) error {
	if sm.persistence == nil {
		log.Printf("No persistence layer available, skipping Supabase sync for staff %s", staffId)
		return nil
	}

	return sm.persistence.PersistStaff(staff)
}

// GetStaff returns a staff member by ID
func (sm *StateManager) GetStaff(staffId string) (*models.StaffMember, error) {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	staff, exists := sm.staffMembers[staffId]
	if !exists {
		return nil, ErrStaffNotFound
	}

	// Return a copy to prevent external modifications
	staffCopy := *staff
	return &staffCopy, nil
}

// GetAllStaff returns all staff members for a specific period
func (sm *StateManager) GetAllStaff(period int) []*models.StaffMember {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	var result []*models.StaffMember
	for _, staff := range sm.staffMembers {
		if staff.Period == period {
			// Return copies to prevent external modifications
			staffCopy := *staff
			result = append(result, &staffCopy)
		}
	}

	return result
}

// CreateStaff creates a new staff member
func (sm *StateManager) CreateStaff(request models.StaffCreateRequest) (*models.StaffMember, error) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	// Generate new ID (simplified for now)
	staffId := fmt.Sprintf("staff_%d", time.Now().UnixNano())

	staff := &models.StaffMember{
		ID:         staffId,
		Name:       request.Name,
		Position:   request.Position,
		Department: request.Department,
		Type:       request.Type,
		Period:     request.Period,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		Version:    sm.versionCtrl.NextVersion(),
	}

	sm.staffMembers[staffId] = staff
	sm.version = staff.Version

	// Log change
	sm.changeLogger.LogChange("staff_create", staffId, "", models.StaffUpdateRequest{}, sm.version)

	return staff, sm.persistToSupabase(staffId, staff)
}

// DeleteStaff deletes a staff member
func (sm *StateManager) DeleteStaff(staffId string) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	_, exists := sm.staffMembers[staffId]
	if !exists {
		return ErrStaffNotFound
	}

	delete(sm.staffMembers, staffId)
	sm.version = sm.versionCtrl.NextVersion()

	// Log change
	sm.changeLogger.LogChange("staff_delete", staffId, "", models.StaffUpdateRequest{}, sm.version)

	// Broadcast deletion
	event := Event{
		Type: "staff_delete",
		Data: map[string]interface{}{
			"staffId": staffId,
			"version": sm.version,
		},
		Timestamp: time.Now(),
		Version:   sm.version,
	}

	for _, client := range sm.subscribers {
		if client.IsSubscribedTo("staff_delete") {
			select {
			case client.SendChan <- event.Marshal():
			default:
				// Client send buffer full
			}
		}
	}

	return nil
}

// AddSubscriber adds a client as a subscriber
func (sm *StateManager) AddSubscriber(clientId string, client *Client) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	sm.subscribers[clientId] = client
}

// RemoveSubscriber removes a client subscriber
func (sm *StateManager) RemoveSubscriber(clientId string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	delete(sm.subscribers, clientId)
}

// GetVersion returns the current state version
func (sm *StateManager) GetVersion() int64 {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	return sm.version
}

// GetChangeLog returns the change log
func (sm *StateManager) GetChangeLog() []StateChange {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	return sm.changeLog
}

// LoadStaffFromSupabase loads staff data from Supabase for a specific period
func (sm *StateManager) LoadStaffFromSupabase(period int) error {
	if sm.persistence == nil {
		return fmt.Errorf("no persistence layer available")
	}

	staffList, err := sm.persistence.LoadAllStaffByPeriod(period)
	if err != nil {
		return fmt.Errorf("failed to load staff from Supabase: %w", err)
	}

	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	// Add loaded staff to the state
	for _, staff := range staffList {
		sm.staffMembers[staff.ID] = &staff
		// Update version if loaded version is higher
		if staff.Version > sm.version {
			sm.version = staff.Version
		}
	}

	log.Printf("Loaded %d staff members from Supabase for period %d", len(staffList), period)
	return nil
}

// SyncWithSupabase synchronizes local state with Supabase
func (sm *StateManager) SyncWithSupabase(period int) error {
	if sm.persistence == nil {
		return fmt.Errorf("no persistence layer available")
	}

	sm.mutex.RLock()
	var localStaff []models.StaffMember
	for _, staff := range sm.staffMembers {
		if staff.Period == period {
			localStaff = append(localStaff, *staff)
		}
	}
	sm.mutex.RUnlock()

	return sm.persistence.SyncStaffData(period, localStaff)
}

// IsSupabaseHealthy checks if the Supabase connection is healthy
func (sm *StateManager) IsSupabaseHealthy() bool {
	if sm.persistence == nil {
		return false
	}
	return sm.persistence.IsHealthy()
}