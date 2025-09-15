// Phase 2.1: State Management Engine - Version control system
package state

import (
	"sync/atomic"
	"time"
)

// VersionController manages version numbers for state changes
type VersionController struct {
	currentVersion int64
	lastUpdate     time.Time
}

// NewVersionController creates a new version controller
func NewVersionController() *VersionController {
	return &VersionController{
		currentVersion: 0,
		lastUpdate:     time.Now(),
	}
}

// NextVersion atomically increments and returns the next version number
func (vc *VersionController) NextVersion() int64 {
	vc.lastUpdate = time.Now()
	return atomic.AddInt64(&vc.currentVersion, 1)
}

// GetCurrentVersion returns the current version number
func (vc *VersionController) GetCurrentVersion() int64 {
	return atomic.LoadInt64(&vc.currentVersion)
}

// SetVersion sets the version to a specific value (used for initialization)
func (vc *VersionController) SetVersion(version int64) {
	atomic.StoreInt64(&vc.currentVersion, version)
	vc.lastUpdate = time.Now()
}

// GetLastUpdate returns when the version was last updated
func (vc *VersionController) GetLastUpdate() time.Time {
	return vc.lastUpdate
}

// IsNewerThan checks if the current version is newer than the provided version
func (vc *VersionController) IsNewerThan(version int64) bool {
	return vc.GetCurrentVersion() > version
}