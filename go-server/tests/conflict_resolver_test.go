// Phase 2.6: Testing Suite - ConflictResolver tests
package tests

import (
	"testing"
	"time"

	"shift-schedule-manager/go-server/conflict"
	"shift-schedule-manager/go-server/models"
)

func TestConflictResolver_LastWriterWins(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Staff",
		Position:   "Local Position",
		Department: "Local Dept",
		Type:       "regular",
		Version:    1,
		UpdatedAt:  time.Now().Add(-1 * time.Hour),
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Remote Staff",
		Position:   "Remote Position",
		Department: "Remote Dept",
		Type:       "part-time",
		Version:    2,
		UpdatedAt:  time.Now(),
	}

	result, err := resolver.ResolveConflict(local, remote)
	if err != nil {
		t.Fatalf("Failed to resolve conflict: %v", err)
	}

	if result.Name != remote.Name {
		t.Errorf("Expected remote name %s, got %s", remote.Name, result.Name)
	}

	if result.Position != remote.Position {
		t.Errorf("Expected remote position %s, got %s", remote.Position, result.Position)
	}
}

func TestConflictResolver_FirstWriterWins(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.FirstWriterWins)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Staff",
		Position:   "Local Position",
		Department: "Local Dept",
		Type:       "regular",
		Version:    1,
		UpdatedAt:  time.Now().Add(-1 * time.Hour),
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Remote Staff",
		Position:   "Remote Position",
		Department: "Remote Dept",
		Type:       "part-time",
		Version:    2,
		UpdatedAt:  time.Now(),
	}

	result, err := resolver.ResolveConflict(local, remote)
	if err != nil {
		t.Fatalf("Failed to resolve conflict: %v", err)
	}

	if result.Name != local.Name {
		t.Errorf("Expected local name %s, got %s", local.Name, result.Name)
	}

	if result.Position != local.Position {
		t.Errorf("Expected local position %s, got %s", local.Position, result.Position)
	}
}

func TestConflictResolver_MergeChanges(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.MergeChanges)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Staff",
		Position:   "Local Position",
		Department: "", // Empty department
		Type:       "regular",
		Version:    1,
		UpdatedAt:  time.Now().Add(-1 * time.Hour),
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "", // Empty name
		Position:   "Remote Position",
		Department: "Remote Dept",
		Type:       "part-time",
		Version:    2,
		UpdatedAt:  time.Now(),
	}

	result, err := resolver.ResolveConflict(local, remote)
	if err != nil {
		t.Fatalf("Failed to resolve conflict: %v", err)
	}

	// For merge strategy, non-empty values should be preserved
	if result.Name != local.Name {
		t.Errorf("Expected local name %s (non-empty), got %s", local.Name, result.Name)
	}

	if result.Department != remote.Department {
		t.Errorf("Expected remote department %s (non-empty), got %s", remote.Department, result.Department)
	}

	// For conflicting non-empty values, remote should win
	if result.Position != remote.Position {
		t.Errorf("Expected remote position %s, got %s", remote.Position, result.Position)
	}

	// Version should be incremented
	if result.Version <= local.Version && result.Version <= remote.Version {
		t.Errorf("Expected version to be incremented beyond both local (%d) and remote (%d), got %d",
			local.Version, remote.Version, result.Version)
	}
}

func TestConflictResolver_UserChoice(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.UserChoice)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Staff",
		Position:   "Local Position",
		Department: "Local Dept",
		Type:       "regular",
		Version:    1,
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Remote Staff",
		Position:   "Remote Position",
		Department: "Remote Dept",
		Type:       "part-time",
		Version:    2,
	}

	result, err := resolver.ResolveConflict(local, remote)
	if err != conflict.ErrUserChoiceRequired {
		t.Errorf("Expected ErrUserChoiceRequired, got %v", err)
	}

	if result != nil {
		t.Error("Expected nil result for user choice strategy")
	}
}

func TestConflictResolver_HasConflict(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	// No conflict case - same values
	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Same Staff",
		Position:   "Same Position",
		Department: "Same Dept",
		Type:       "regular",
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Same Staff",
		Position:   "Same Position",
		Department: "Same Dept",
		Type:       "regular",
	}

	hasConflict := resolver.HasConflict(local, remote)
	if hasConflict {
		t.Error("Expected no conflict for identical staff members")
	}

	// Conflict case - different values
	remote.Name = "Different Staff"
	remote.Position = "Different Position"

	hasConflict = resolver.HasConflict(local, remote)
	if !hasConflict {
		t.Error("Expected conflict for different staff members")
	}
}

func TestConflictResolver_CanAutoResolve(t *testing.T) {
	local := &models.StaffMember{ID: "staff1", Name: "Local"}
	remote := &models.StaffMember{ID: "staff1", Name: "Remote"}

	testCases := []struct {
		strategy   conflict.ConflictStrategy
		canResolve bool
	}{
		{conflict.LastWriterWins, true},
		{conflict.FirstWriterWins, true},
		{conflict.MergeChanges, true},
		{conflict.UserChoice, false},
	}

	for _, tc := range testCases {
		resolver := conflict.NewConflictResolver(tc.strategy)
		canResolve := resolver.CanAutoResolve(local, remote)

		if canResolve != tc.canResolve {
			t.Errorf("Strategy %s: expected CanAutoResolve=%v, got %v",
				tc.strategy.String(), tc.canResolve, canResolve)
		}
	}
}

func TestConflictResolver_ResolveConflictWithDetails(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.MergeChanges)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Staff",
		Position:   "Local Position",
		Department: "Local Dept",
		Type:       "regular",
		Version:    1,
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Remote Staff",
		Position:   "Remote Position",
		Department: "Remote Dept",
		Type:       "part-time",
		Version:    2,
	}

	result, conflicts, err := resolver.ResolveConflictWithDetails(local, remote)
	if err != nil {
		t.Fatalf("Failed to resolve conflict with details: %v", err)
	}

	if result == nil {
		t.Fatal("Expected resolved result, got nil")
	}

	// Should have conflicts for all differing non-empty fields
	expectedConflicts := 4 // name, position, department, type
	if len(conflicts) != expectedConflicts {
		t.Errorf("Expected %d conflicts, got %d", expectedConflicts, len(conflicts))
	}

	// Verify conflict details
	conflictFields := make(map[string]bool)
	for _, c := range conflicts {
		conflictFields[c.Field] = true
	}

	expectedFields := []string{"name", "position", "department", "type"}
	for _, field := range expectedFields {
		if !conflictFields[field] {
			t.Errorf("Expected conflict for field %s", field)
		}
	}
}

func TestConflictResolver_SetAndGetStrategy(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	if resolver.GetStrategy() != conflict.LastWriterWins {
		t.Errorf("Expected LastWriterWins strategy, got %s", resolver.GetStrategy().String())
	}

	resolver.SetStrategy(conflict.MergeChanges)

	if resolver.GetStrategy() != conflict.MergeChanges {
		t.Errorf("Expected MergeChanges strategy after setting, got %s", resolver.GetStrategy().String())
	}
}

func TestConflictStrategy_String(t *testing.T) {
	testCases := []struct {
		strategy conflict.ConflictStrategy
		expected string
	}{
		{conflict.LastWriterWins, "LastWriterWins"},
		{conflict.FirstWriterWins, "FirstWriterWins"},
		{conflict.MergeChanges, "MergeChanges"},
		{conflict.UserChoice, "UserChoice"},
	}

	for _, tc := range testCases {
		actual := tc.strategy.String()
		if actual != tc.expected {
			t.Errorf("Strategy %d: expected string %s, got %s",
				tc.strategy, tc.expected, actual)
		}
	}
}

func TestConflictStrategy_IsValid(t *testing.T) {
	validStrategies := []conflict.ConflictStrategy{
		conflict.LastWriterWins,
		conflict.FirstWriterWins,
		conflict.MergeChanges,
		conflict.UserChoice,
	}

	for _, strategy := range validStrategies {
		if !strategy.IsValid() {
			t.Errorf("Strategy %s should be valid", strategy.String())
		}
	}

	// Test invalid strategy
	invalidStrategy := conflict.ConflictStrategy(999)
	if invalidStrategy.IsValid() {
		t.Error("Invalid strategy should not be valid")
	}
}