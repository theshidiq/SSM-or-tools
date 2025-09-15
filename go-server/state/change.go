// Phase 2.1: State Management Engine - Change logging system
package state

import (
	"time"

	"shift-schedule-manager/go-server/models"
)

// ChangeLogger handles logging of state changes
type ChangeLogger struct {
	changes []StateChange
	maxSize int
}

// NewChangeLogger creates a new change logger with specified max size
func NewChangeLogger(maxSize int) *ChangeLogger {
	return &ChangeLogger{
		changes: make([]StateChange, 0, maxSize),
		maxSize: maxSize,
	}
}

// LogChange adds a new change to the log
func (cl *ChangeLogger) LogChange(changeType, staffId, clientId string, changes models.StaffUpdateRequest, version int64) {
	change := StateChange{
		Type:      changeType,
		StaffId:   staffId,
		Changes:   changes,
		Version:   version,
		Timestamp: time.Now(),
		ClientId:  clientId,
	}

	// Add to the beginning of the slice
	cl.changes = append([]StateChange{change}, cl.changes...)

	// Trim to max size if needed
	if len(cl.changes) > cl.maxSize {
		cl.changes = cl.changes[:cl.maxSize]
	}
}

// GetChanges returns all logged changes
func (cl *ChangeLogger) GetChanges() []StateChange {
	return cl.changes
}

// GetChangesSince returns changes since a specific version
func (cl *ChangeLogger) GetChangesSince(version int64) []StateChange {
	var result []StateChange
	for _, change := range cl.changes {
		if change.Version > version {
			result = append(result, change)
		}
	}
	return result
}

// GetLatestVersion returns the latest version from the change log
func (cl *ChangeLogger) GetLatestVersion() int64 {
	if len(cl.changes) == 0 {
		return 0
	}
	return cl.changes[0].Version
}