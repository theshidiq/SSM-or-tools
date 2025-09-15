// Phase 2.2: Conflict Resolution Strategy - Strategy types and constants (lines 209-216)
package conflict

import "errors"

// ConflictStrategy - Exact implementation from official plan lines 209-216
type ConflictStrategy int

const (
	LastWriterWins ConflictStrategy = iota
	FirstWriterWins
	MergeChanges
	UserChoice
)

// Error definitions for conflict resolution
var (
	ErrUserChoiceRequired = errors.New("user choice required for conflict resolution")
	ErrUnknownStrategy   = errors.New("unknown conflict resolution strategy")
	ErrMergeFailed       = errors.New("failed to merge changes")
)

// String returns string representation of strategy
func (cs ConflictStrategy) String() string {
	switch cs {
	case LastWriterWins:
		return "LastWriterWins"
	case FirstWriterWins:
		return "FirstWriterWins"
	case MergeChanges:
		return "MergeChanges"
	case UserChoice:
		return "UserChoice"
	default:
		return "Unknown"
	}
}

// IsValid checks if the strategy is valid
func (cs ConflictStrategy) IsValid() bool {
	return cs >= LastWriterWins && cs <= UserChoice
}