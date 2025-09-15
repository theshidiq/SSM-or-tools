// Phase 2.4: Supabase Integration - Data persistence layer
package supabase

import (
	"fmt"
	"log"
	"sync"
	"time"

	"shift-schedule-manager/go-server/models"
)

// PersistenceLayer handles all data persistence operations
type PersistenceLayer struct {
	client     *SupabaseClient
	staffRepo  *StaffRepository
	mutex      sync.RWMutex
	syncStatus map[string]bool // Track sync status by operation ID
}

// NewPersistenceLayer creates a new persistence layer
func NewPersistenceLayer() (*PersistenceLayer, error) {
	client, err := NewSupabaseClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create Supabase client: %w", err)
	}

	return &PersistenceLayer{
		client:     client,
		staffRepo:  NewStaffRepository(client),
		syncStatus: make(map[string]bool),
	}, nil
}

// PersistStaff persists a staff member to Supabase
func (pl *PersistenceLayer) PersistStaff(staff *models.StaffMember) error {
	operationID := fmt.Sprintf("persist_staff_%s_%d", staff.ID, time.Now().UnixNano())

	pl.mutex.Lock()
	pl.syncStatus[operationID] = false
	pl.mutex.Unlock()

	defer func() {
		pl.mutex.Lock()
		pl.syncStatus[operationID] = true
		pl.mutex.Unlock()
	}()

	// Update the timestamps
	staff.UpdatedAt = time.Now()

	err := pl.staffRepo.UpsertStaff(staff)
	if err != nil {
		log.Printf("Failed to persist staff member %s: %v", staff.ID, err)
		return fmt.Errorf("failed to persist staff member: %w", err)
	}

	log.Printf("Successfully persisted staff member %s (%s)", staff.Name, staff.ID)
	return nil
}

// LoadStaff loads a staff member from Supabase
func (pl *PersistenceLayer) LoadStaff(staffID string) (*models.StaffMember, error) {
	staff, err := pl.staffRepo.GetStaff(staffID)
	if err != nil {
		return nil, fmt.Errorf("failed to load staff member: %w", err)
	}

	return staff, nil
}

// LoadAllStaffByPeriod loads all staff members for a period from Supabase
func (pl *PersistenceLayer) LoadAllStaffByPeriod(period int) ([]models.StaffMember, error) {
	staff, err := pl.staffRepo.GetAllStaffByPeriod(period)
	if err != nil {
		return nil, fmt.Errorf("failed to load staff for period %d: %w", period, err)
	}

	log.Printf("Loaded %d staff members for period %d", len(staff), period)
	return staff, nil
}

// PersistMultipleStaff persists multiple staff members in a batch
func (pl *PersistenceLayer) PersistMultipleStaff(staffList []models.StaffMember) error {
	operationID := fmt.Sprintf("persist_multiple_%d_%d", len(staffList), time.Now().UnixNano())

	pl.mutex.Lock()
	pl.syncStatus[operationID] = false
	pl.mutex.Unlock()

	defer func() {
		pl.mutex.Lock()
		pl.syncStatus[operationID] = true
		pl.mutex.Unlock()
	}()

	// Update timestamps for all staff members
	now := time.Now()
	for i := range staffList {
		staffList[i].UpdatedAt = now
	}

	err := pl.staffRepo.BulkUpsertStaff(staffList)
	if err != nil {
		log.Printf("Failed to persist %d staff members: %v", len(staffList), err)
		return fmt.Errorf("failed to persist multiple staff members: %w", err)
	}

	log.Printf("Successfully persisted %d staff members", len(staffList))
	return nil
}

// DeleteStaff deletes a staff member from Supabase
func (pl *PersistenceLayer) DeleteStaff(staffID string) error {
	operationID := fmt.Sprintf("delete_staff_%s_%d", staffID, time.Now().UnixNano())

	pl.mutex.Lock()
	pl.syncStatus[operationID] = false
	pl.mutex.Unlock()

	defer func() {
		pl.mutex.Lock()
		pl.syncStatus[operationID] = true
		pl.mutex.Unlock()
	}()

	err := pl.staffRepo.DeleteStaff(staffID)
	if err != nil {
		log.Printf("Failed to delete staff member %s: %v", staffID, err)
		return fmt.Errorf("failed to delete staff member: %w", err)
	}

	log.Printf("Successfully deleted staff member %s", staffID)
	return nil
}

// SyncStaffData synchronizes staff data between local state and Supabase
func (pl *PersistenceLayer) SyncStaffData(period int, localStaff []models.StaffMember) error {
	operationID := fmt.Sprintf("sync_staff_data_%d_%d", period, time.Now().UnixNano())

	pl.mutex.Lock()
	pl.syncStatus[operationID] = false
	pl.mutex.Unlock()

	defer func() {
		pl.mutex.Lock()
		pl.syncStatus[operationID] = true
		pl.mutex.Unlock()
	}()

	// Load remote staff data
	remoteStaff, err := pl.LoadAllStaffByPeriod(period)
	if err != nil {
		return fmt.Errorf("failed to load remote staff data: %w", err)
	}

	// Create maps for comparison
	localMap := make(map[string]models.StaffMember)
	remoteMap := make(map[string]models.StaffMember)

	for _, staff := range localStaff {
		localMap[staff.ID] = staff
	}

	for _, staff := range remoteStaff {
		remoteMap[staff.ID] = staff
	}

	// Find differences and sync
	var toUpdate []models.StaffMember
	var toCreate []models.StaffMember

	for id, localStaff := range localMap {
		if remoteStaff, exists := remoteMap[id]; exists {
			// Staff exists in both, check if update needed
			if localStaff.Version > remoteStaff.Version {
				toUpdate = append(toUpdate, localStaff)
			}
		} else {
			// Staff exists locally but not remotely, create
			toCreate = append(toCreate, localStaff)
		}
	}

	// Perform updates and creates
	allChanges := append(toUpdate, toCreate...)
	if len(allChanges) > 0 {
		err = pl.PersistMultipleStaff(allChanges)
		if err != nil {
			return fmt.Errorf("failed to sync staff changes: %w", err)
		}
	}

	log.Printf("Synchronized %d staff changes for period %d", len(allChanges), period)
	return nil
}

// GetSyncStatus returns the sync status for operations
func (pl *PersistenceLayer) GetSyncStatus() map[string]bool {
	pl.mutex.RLock()
	defer pl.mutex.RUnlock()

	// Return a copy to prevent external modifications
	status := make(map[string]bool)
	for k, v := range pl.syncStatus {
		status[k] = v
	}

	return status
}

// ClearSyncStatus clears old sync status entries
func (pl *PersistenceLayer) ClearSyncStatus() {
	pl.mutex.Lock()
	defer pl.mutex.Unlock()

	pl.syncStatus = make(map[string]bool)
	log.Println("Cleared sync status history")
}

// IsHealthy checks if the persistence layer is healthy
func (pl *PersistenceLayer) IsHealthy() bool {
	// For mock client, always return true
	if pl.client.IsMockClient() {
		return true
	}

	// Try a simple operation to check health
	_, err := pl.staffRepo.GetStaffCount(1)
	return err == nil
}

// GetClient returns the underlying Supabase client (for testing)
func (pl *PersistenceLayer) GetClient() *SupabaseClient {
	return pl.client
}