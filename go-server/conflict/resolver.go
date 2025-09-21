// Phase 2.2: Conflict Resolution Strategy - ConflictResolver implementation (lines 204-231)
package conflict

import (
	"shift-schedule-go-server/models"
)

// ConflictResolver - Exact implementation from official plan lines 205-207
type ConflictResolver struct {
	strategy ConflictStrategy
}

// NewConflictResolver creates a new conflict resolver with the specified strategy
func NewConflictResolver(strategy ConflictStrategy) *ConflictResolver {
	return &ConflictResolver{
		strategy: strategy,
	}
}

// ResolveConflict - Exact implementation from official plan lines 218-230
func (cr *ConflictResolver) ResolveConflict(local, remote *models.StaffMember) (*models.StaffMember, error) {
	switch cr.strategy {
	case LastWriterWins:
		return remote, nil
	case FirstWriterWins:
		return local, nil
	case MergeChanges:
		return cr.mergeStaffMembers(local, remote), nil
	case UserChoice:
		return nil, ErrUserChoiceRequired
	}
	return nil, ErrUnknownStrategy
}

// SetStrategy changes the conflict resolution strategy
func (cr *ConflictResolver) SetStrategy(strategy ConflictStrategy) {
	cr.strategy = strategy
}

// GetStrategy returns the current conflict resolution strategy
func (cr *ConflictResolver) GetStrategy() ConflictStrategy {
	return cr.strategy
}

// ResolveConflictWithDetails returns both the resolved staff and conflict details
func (cr *ConflictResolver) ResolveConflictWithDetails(local, remote *models.StaffMember) (*models.StaffMember, []ConflictDetail, error) {
	switch cr.strategy {
	case LastWriterWins:
		return remote, []ConflictDetail{{
			Field:       "all",
			LocalValue:  local,
			RemoteValue: remote,
			Resolution:  "last_writer_wins",
		}}, nil
	case FirstWriterWins:
		return local, []ConflictDetail{{
			Field:       "all",
			LocalValue:  local,
			RemoteValue: remote,
			Resolution:  "first_writer_wins",
		}}, nil
	case MergeChanges:
		merged := cr.mergeStaffMembers(local, remote)
		conflicts := cr.detectConflicts(local, remote)
		return merged, conflicts, nil
	case UserChoice:
		return nil, nil, ErrUserChoiceRequired
	}
	return nil, nil, ErrUnknownStrategy
}

// detectConflicts identifies all conflicts between two staff members
func (cr *ConflictResolver) detectConflicts(local, remote *models.StaffMember) []ConflictDetail {
	var conflicts []ConflictDetail

	if local.Name != remote.Name && local.Name != "" && remote.Name != "" {
		conflicts = append(conflicts, ConflictDetail{
			Field:       "name",
			LocalValue:  local.Name,
			RemoteValue: remote.Name,
			Resolution:  "needs_resolution",
		})
	}

	if local.Position != remote.Position && local.Position != "" && remote.Position != "" {
		conflicts = append(conflicts, ConflictDetail{
			Field:       "position",
			LocalValue:  local.Position,
			RemoteValue: remote.Position,
			Resolution:  "needs_resolution",
		})
	}

	if local.Department != remote.Department && local.Department != "" && remote.Department != "" {
		conflicts = append(conflicts, ConflictDetail{
			Field:       "department",
			LocalValue:  local.Department,
			RemoteValue: remote.Department,
			Resolution:  "needs_resolution",
		})
	}

	if local.Type != remote.Type && local.Type != "" && remote.Type != "" {
		conflicts = append(conflicts, ConflictDetail{
			Field:       "type",
			LocalValue:  local.Type,
			RemoteValue: remote.Type,
			Resolution:  "needs_resolution",
		})
	}

	return conflicts
}

// HasConflict checks if there are conflicts between two staff members
func (cr *ConflictResolver) HasConflict(local, remote *models.StaffMember) bool {
	if local.ID != remote.ID {
		return false
	}

	conflicts := cr.detectConflicts(local, remote)
	return len(conflicts) > 0
}

// CanAutoResolve checks if conflicts can be automatically resolved
func (cr *ConflictResolver) CanAutoResolve(local, remote *models.StaffMember) bool {
	switch cr.strategy {
	case LastWriterWins, FirstWriterWins, MergeChanges:
		return true
	case UserChoice:
		return false
	default:
		return false
	}
}