// Phase 2.4: Supabase Integration - Synchronization logic
package supabase

import (
	"fmt"
	"log"
	"time"

	"shift-schedule-manager/go-server/models"
)

// SyncManager handles data synchronization between local state and Supabase
type SyncManager struct {
	persistence *PersistenceLayer
	lastSync    map[int]time.Time // Track last sync time per period
}

// NewSyncManager creates a new sync manager
func NewSyncManager(persistence *PersistenceLayer) *SyncManager {
	return &SyncManager{
		persistence: persistence,
		lastSync:    make(map[int]time.Time),
	}
}

// SyncStrategy defines how data should be synchronized
type SyncStrategy int

const (
	SyncStrategyMerge SyncStrategy = iota // Merge local and remote changes
	SyncStrategyLocalWins                 // Local changes override remote
	SyncStrategyRemoteWins                // Remote changes override local
)

// SyncResult contains the result of a synchronization operation
type SyncResult struct {
	Period          int                    `json:"period"`
	StartTime       time.Time              `json:"startTime"`
	EndTime         time.Time              `json:"endTime"`
	Duration        time.Duration          `json:"duration"`
	LocalCount      int                    `json:"localCount"`
	RemoteCount     int                    `json:"remoteCount"`
	Created         []string               `json:"created"`
	Updated         []string               `json:"updated"`
	Deleted         []string               `json:"deleted"`
	Conflicts       []string               `json:"conflicts"`
	Errors          []string               `json:"errors"`
	Success         bool                   `json:"success"`
}

// PerformSync synchronizes staff data for a specific period
func (sm *SyncManager) PerformSync(period int, localStaff []models.StaffMember, strategy SyncStrategy) (*SyncResult, error) {
	result := &SyncResult{
		Period:      period,
		StartTime:   time.Now(),
		LocalCount:  len(localStaff),
		Created:     make([]string, 0),
		Updated:     make([]string, 0),
		Deleted:     make([]string, 0),
		Conflicts:   make([]string, 0),
		Errors:      make([]string, 0),
	}

	defer func() {
		result.EndTime = time.Now()
		result.Duration = result.EndTime.Sub(result.StartTime)
		sm.lastSync[period] = result.EndTime
	}()

	// Load remote data
	remoteStaff, err := sm.persistence.LoadAllStaffByPeriod(period)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Failed to load remote staff: %v", err))
		return result, err
	}

	result.RemoteCount = len(remoteStaff)

	// Create maps for efficient lookups
	localMap := make(map[string]models.StaffMember)
	remoteMap := make(map[string]models.StaffMember)

	for _, staff := range localStaff {
		localMap[staff.ID] = staff
	}

	for _, staff := range remoteStaff {
		remoteMap[staff.ID] = staff
	}

	// Perform synchronization based on strategy
	switch strategy {
	case SyncStrategyMerge:
		err = sm.performMergeSync(localMap, remoteMap, result)
	case SyncStrategyLocalWins:
		err = sm.performLocalWinsSync(localMap, remoteMap, result)
	case SyncStrategyRemoteWins:
		err = sm.performRemoteWinsSync(localMap, remoteMap, result)
	default:
		err = fmt.Errorf("unknown sync strategy: %d", strategy)
		result.Errors = append(result.Errors, err.Error())
	}

	result.Success = err == nil && len(result.Errors) == 0

	log.Printf("Sync completed for period %d: %d created, %d updated, %d conflicts, %d errors",
		period, len(result.Created), len(result.Updated), len(result.Conflicts), len(result.Errors))

	return result, err
}

// performMergeSync performs merge-based synchronization
func (sm *SyncManager) performMergeSync(localMap, remoteMap map[string]models.StaffMember, result *SyncResult) error {
	var toCreate []models.StaffMember
	var toUpdate []models.StaffMember

	// Process local changes
	for id, localStaff := range localMap {
		if remoteStaff, exists := remoteMap[id]; exists {
			// Both exist - check versions and merge if needed
			if localStaff.Version > remoteStaff.Version {
				toUpdate = append(toUpdate, localStaff)
				result.Updated = append(result.Updated, id)
			} else if localStaff.Version < remoteStaff.Version {
				// Remote is newer - conflict detected
				result.Conflicts = append(result.Conflicts, id)
				log.Printf("Conflict detected for staff %s: local v%d vs remote v%d",
					id, localStaff.Version, remoteStaff.Version)
			}
		} else {
			// Only exists locally - create in remote
			toCreate = append(toCreate, localStaff)
			result.Created = append(result.Created, id)
		}
	}

	// Process creates and updates
	allChanges := append(toCreate, toUpdate...)
	if len(allChanges) > 0 {
		err := sm.persistence.PersistMultipleStaff(allChanges)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to persist changes: %v", err))
			return err
		}
	}

	return nil
}

// performLocalWinsSync performs local-wins synchronization
func (sm *SyncManager) performLocalWinsSync(localMap, remoteMap map[string]models.StaffMember, result *SyncResult) error {
	var allStaff []models.StaffMember

	// Local wins - push all local data to remote
	for id, localStaff := range localMap {
		allStaff = append(allStaff, localStaff)

		if _, exists := remoteMap[id]; exists {
			result.Updated = append(result.Updated, id)
		} else {
			result.Created = append(result.Created, id)
		}
	}

	// Handle deletions (remote items not in local)
	for id := range remoteMap {
		if _, exists := localMap[id]; !exists {
			err := sm.persistence.DeleteStaff(id)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete staff %s: %v", id, err))
			} else {
				result.Deleted = append(result.Deleted, id)
			}
		}
	}

	// Push all local data
	if len(allStaff) > 0 {
		err := sm.persistence.PersistMultipleStaff(allStaff)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to persist local data: %v", err))
			return err
		}
	}

	return nil
}

// performRemoteWinsSync performs remote-wins synchronization
func (sm *SyncManager) performRemoteWinsSync(localMap, remoteMap map[string]models.StaffMember, result *SyncResult) error {
	// Remote wins - this is essentially a pull operation
	// We would update the local state to match remote
	// For now, just log the differences

	for id := range localMap {
		if _, exists := remoteMap[id]; !exists {
			result.Deleted = append(result.Deleted, id)
		}
	}

	for id, remoteStaff := range remoteMap {
		if localStaff, exists := localMap[id]; exists {
			if remoteStaff.Version != localStaff.Version {
				result.Updated = append(result.Updated, id)
			}
		} else {
			result.Created = append(result.Created, id)
		}
	}

	// Note: In a full implementation, we would update the local StateManager here
	// For Phase 2, we're focusing on the persistence layer
	log.Printf("Remote wins sync would update local state with %d changes",
		len(result.Created) + len(result.Updated) + len(result.Deleted))

	return nil
}

// GetLastSyncTime returns the last sync time for a period
func (sm *SyncManager) GetLastSyncTime(period int) *time.Time {
	if lastSync, exists := sm.lastSync[period]; exists {
		return &lastSync
	}
	return nil
}

// IsStale checks if the data for a period is stale (needs sync)
func (sm *SyncManager) IsStale(period int, maxAge time.Duration) bool {
	lastSync := sm.GetLastSyncTime(period)
	if lastSync == nil {
		return true // Never synced
	}
	return time.Since(*lastSync) > maxAge
}

// PerformPeriodicSync performs synchronization for all periods that need it
func (sm *SyncManager) PerformPeriodicSync(maxAge time.Duration, strategy SyncStrategy) map[int]*SyncResult {
	results := make(map[int]*SyncResult)

	// Check periods 1-6 (typical range)
	for period := 1; period <= 6; period++ {
		if sm.IsStale(period, maxAge) {
			// For periodic sync, we need to get local data from StateManager
			// This would be passed in from the main application
			log.Printf("Period %d is stale, would perform sync", period)

			// Create a placeholder result for now
			results[period] = &SyncResult{
				Period:    period,
				StartTime: time.Now(),
				EndTime:   time.Now(),
				Success:   true,
			}
		}
	}

	return results
}