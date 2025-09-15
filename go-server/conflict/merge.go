// Phase 2.2: Conflict Resolution Strategy - Merge algorithms
package conflict

import (
	"time"

	"shift-schedule-manager/go-server/models"
)

// MergeResult contains the result of a merge operation
type MergeResult struct {
	Staff     *models.StaffMember
	Conflicts []ConflictDetail
}

// ConflictDetail describes a specific conflict that occurred during merge
type ConflictDetail struct {
	Field      string      `json:"field"`
	LocalValue interface{} `json:"localValue"`
	RemoteValue interface{} `json:"remoteValue"`
	Resolution string      `json:"resolution"`
}

// MergeStaffMembers merges two staff member versions
func (cr *ConflictResolver) mergeStaffMembers(local, remote *models.StaffMember) *models.StaffMember {
	merged := &models.StaffMember{
		ID: local.ID, // ID should always be the same
		CreatedAt: local.CreatedAt, // Created time should not change
	}

	conflicts := make([]ConflictDetail, 0)

	// Merge Name field
	if local.Name != remote.Name {
		// For merge strategy, prioritize non-empty values
		if local.Name == "" && remote.Name != "" {
			merged.Name = remote.Name
		} else if remote.Name == "" && local.Name != "" {
			merged.Name = local.Name
		} else {
			// Both have values, use remote (Last Writer Wins for conflicts)
			merged.Name = remote.Name
			conflicts = append(conflicts, ConflictDetail{
				Field: "name",
				LocalValue: local.Name,
				RemoteValue: remote.Name,
				Resolution: "remote_wins",
			})
		}
	} else {
		merged.Name = local.Name
	}

	// Merge Position field
	if local.Position != remote.Position {
		if local.Position == "" && remote.Position != "" {
			merged.Position = remote.Position
		} else if remote.Position == "" && local.Position != "" {
			merged.Position = local.Position
		} else {
			merged.Position = remote.Position
			conflicts = append(conflicts, ConflictDetail{
				Field: "position",
				LocalValue: local.Position,
				RemoteValue: remote.Position,
				Resolution: "remote_wins",
			})
		}
	} else {
		merged.Position = local.Position
	}

	// Merge Department field
	if local.Department != remote.Department {
		if local.Department == "" && remote.Department != "" {
			merged.Department = remote.Department
		} else if remote.Department == "" && local.Department != "" {
			merged.Department = local.Department
		} else {
			merged.Department = remote.Department
			conflicts = append(conflicts, ConflictDetail{
				Field: "department",
				LocalValue: local.Department,
				RemoteValue: remote.Department,
				Resolution: "remote_wins",
			})
		}
	} else {
		merged.Department = local.Department
	}

	// Merge Type field
	if local.Type != remote.Type {
		// Type changes should be explicit, use remote
		merged.Type = remote.Type
		if local.Type != "" && remote.Type != "" {
			conflicts = append(conflicts, ConflictDetail{
				Field: "type",
				LocalValue: local.Type,
				RemoteValue: remote.Type,
				Resolution: "remote_wins",
			})
		}
	} else {
		merged.Type = local.Type
	}

	// Merge Period field
	if local.Period != remote.Period {
		// Use the remote period
		merged.Period = remote.Period
	} else {
		merged.Period = local.Period
	}

	// Version and timestamps
	merged.Version = maxInt64(local.Version, remote.Version) + 1
	merged.UpdatedAt = maxTime(local.UpdatedAt, remote.UpdatedAt)

	return merged
}

// Helper function to get max of two int64 values
func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// Helper function to get max of two time values
func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

// CanMerge checks if two staff members can be automatically merged
func CanMerge(local, remote *models.StaffMember) bool {
	// Can merge if they have the same ID
	if local.ID != remote.ID {
		return false
	}

	// Can merge if no fundamental conflicts
	// For now, consider all staff changes as mergeable
	return true
}

// GetConflictSeverity returns severity of conflicts between two staff members
func GetConflictSeverity(local, remote *models.StaffMember) int {
	severity := 0

	if local.Name != remote.Name && local.Name != "" && remote.Name != "" {
		severity += 1
	}
	if local.Position != remote.Position && local.Position != "" && remote.Position != "" {
		severity += 1
	}
	if local.Department != remote.Department && local.Department != "" && remote.Department != "" {
		severity += 1
	}
	if local.Type != remote.Type && local.Type != "" && remote.Type != "" {
		severity += 2 // Type changes are more significant
	}

	return severity
}