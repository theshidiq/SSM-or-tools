// Testing Strategy Implementation: Unit Testing (lines 792-807)
// Exact implementation from IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md
package tests

import (
	"testing"
	"time"

	"shift-schedule-manager/go-server/conflict"
	"shift-schedule-manager/go-server/models"
)

// TestStaffUpdateConflictResolution - Exact implementation from official plan lines 795-806
func TestStaffUpdateConflictResolution(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	local := &models.StaffMember{
		ID:         "staff1",
		Name:       "Local Update",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Version:    1,
		UpdatedAt:  time.Now().Add(-1 * time.Hour),
	}

	remote := &models.StaffMember{
		ID:         "staff1",
		Name:       "Remote Update",
		Position:   "Head Chef",
		Department: "Kitchen",
		Type:       "regular",
		Version:    2,
		UpdatedAt:  time.Now(),
	}

	result, err := resolver.ResolveConflict(local, remote)

	// Exact validation from official plan lines 803-805
	if err != nil {
		t.Fatalf("ResolveConflict failed: %v", err)
	}

	if result.Name != "Remote Update" {
		t.Errorf("Expected 'Remote Update', got %s", result.Name)
	}

	if result.Version != int64(2) {
		t.Errorf("Expected version 2, got %d", result.Version)
	}
}

// Additional comprehensive test scenarios for race condition elimination
func TestStaffUpdateConflictResolution_RaceConditionScenarios(t *testing.T) {
	tests := []struct {
		name              string
		strategy          conflict.ConflictStrategy
		localName         string
		localVersion      int64
		localUpdatedAt    time.Time
		remoteName        string
		remoteVersion     int64
		remoteUpdatedAt   time.Time
		expectedName      string
		expectedVersion   int64
		expectError       bool
	}{
		{
			name:            "LastWriterWins - Remote wins with higher version",
			strategy:        conflict.LastWriterWins,
			localName:       "Local Staff A",
			localVersion:    1,
			localUpdatedAt:  time.Now().Add(-2 * time.Hour),
			remoteName:      "Remote Staff A",
			remoteVersion:   2,
			remoteUpdatedAt: time.Now().Add(-1 * time.Hour),
			expectedName:    "Remote Staff A",
			expectedVersion: 2,
			expectError:     false,
		},
		{
			name:            "FirstWriterWins - Local wins regardless of version",
			strategy:        conflict.FirstWriterWins,
			localName:       "Local Staff B",
			localVersion:    1,
			localUpdatedAt:  time.Now().Add(-2 * time.Hour),
			remoteName:      "Remote Staff B",
			remoteVersion:   3,
			remoteUpdatedAt: time.Now(),
			expectedName:    "Local Staff B",
			expectedVersion: 1,
			expectError:     false,
		},
		{
			name:            "UserChoice - Requires manual resolution",
			strategy:        conflict.UserChoice,
			localName:       "Local Staff C",
			localVersion:    1,
			localUpdatedAt:  time.Now().Add(-1 * time.Hour),
			remoteName:      "Remote Staff C",
			remoteVersion:   2,
			remoteUpdatedAt: time.Now(),
			expectedName:    "",
			expectedVersion: 0,
			expectError:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := conflict.NewConflictResolver(tt.strategy)

			local := &models.StaffMember{
				ID:        "staff-test",
				Name:      tt.localName,
				Version:   tt.localVersion,
				UpdatedAt: tt.localUpdatedAt,
			}

			remote := &models.StaffMember{
				ID:        "staff-test",
				Name:      tt.remoteName,
				Version:   tt.remoteVersion,
				UpdatedAt: tt.remoteUpdatedAt,
			}

			result, err := resolver.ResolveConflict(local, remote)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				if result != nil {
					t.Errorf("Expected nil result for error case, got %v", result)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if result.Name != tt.expectedName {
				t.Errorf("Expected name %s, got %s", tt.expectedName, result.Name)
			}

			if result.Version != tt.expectedVersion {
				t.Errorf("Expected version %d, got %d", tt.expectedVersion, result.Version)
			}
		})
	}
}

// Test concurrent modification scenarios that could cause race conditions
func TestStaffUpdateConflictResolution_ConcurrentModifications(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	// Simulate rapid successive updates that could cause race conditions
	baseTime := time.Now()

	tests := []struct {
		name         string
		modifications []struct {
			name    string
			version int64
			delay   time.Duration
		}
		expectedFinalName    string
		expectedFinalVersion int64
	}{
		{
			name: "Rapid successive updates - Last writer should win",
			modifications: []struct {
				name    string
				version int64
				delay   time.Duration
			}{
				{"Update 1", 1, 0},
				{"Update 2", 2, 10 * time.Millisecond},
				{"Update 3", 3, 20 * time.Millisecond},
				{"Update 4", 4, 30 * time.Millisecond},
			},
			expectedFinalName:    "Update 4",
			expectedFinalVersion: 4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var currentStaff *models.StaffMember

			for i, mod := range tt.modifications {
				newStaff := &models.StaffMember{
					ID:        "concurrent-test",
					Name:      mod.name,
					Version:   mod.version,
					UpdatedAt: baseTime.Add(mod.delay),
				}

				if i == 0 {
					currentStaff = newStaff
					continue
				}

				result, err := resolver.ResolveConflict(currentStaff, newStaff)
				if err != nil {
					t.Fatalf("Conflict resolution failed at step %d: %v", i, err)
				}

				currentStaff = result
			}

			if currentStaff.Name != tt.expectedFinalName {
				t.Errorf("Expected final name %s, got %s", tt.expectedFinalName, currentStaff.Name)
			}

			if currentStaff.Version != tt.expectedFinalVersion {
				t.Errorf("Expected final version %d, got %d", tt.expectedFinalVersion, currentStaff.Version)
			}
		})
	}
}

// Test merge strategy with detailed conflict detection
func TestStaffUpdateConflictResolution_MergeStrategy(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.MergeChanges)

	local := &models.StaffMember{
		ID:         "merge-test",
		Name:       "Local Name",
		Position:   "Local Position",
		Department: "", // Empty department
		Type:       "regular",
		Version:    1,
		UpdatedAt:  time.Now().Add(-1 * time.Hour),
	}

	remote := &models.StaffMember{
		ID:         "merge-test",
		Name:       "", // Empty name
		Position:   "Remote Position",
		Department: "Remote Department",
		Type:       "part-time",
		Version:    2,
		UpdatedAt:  time.Now(),
	}

	result, conflicts, err := resolver.ResolveConflictWithDetails(local, remote)

	if err != nil {
		t.Fatalf("Merge strategy failed: %v", err)
	}

	// Verify merge behavior: non-empty values preserved, conflicts detected
	if result.Name != "Local Name" {
		t.Errorf("Expected local name (non-empty) to be preserved, got %s", result.Name)
	}

	if result.Department != "Remote Department" {
		t.Errorf("Expected remote department (non-empty) to be preserved, got %s", result.Department)
	}

	// Both position values are non-empty, so should have conflict
	positionConflictFound := false
	typeConflictFound := false

	for _, conflict := range conflicts {
		if conflict.Field == "position" {
			positionConflictFound = true
		}
		if conflict.Field == "type" {
			typeConflictFound = true
		}
	}

	if !positionConflictFound {
		t.Error("Expected position conflict to be detected")
	}

	if !typeConflictFound {
		t.Error("Expected type conflict to be detected")
	}

	// Version should be incremented beyond both local and remote
	expectedMinVersion := int64(3) // max(1, 2) + 1
	if result.Version < expectedMinVersion {
		t.Errorf("Expected version >= %d, got %d", expectedMinVersion, result.Version)
	}
}

// Performance test to ensure conflict resolution is fast (<50ms as per KPI)
func TestStaffUpdateConflictResolution_Performance(t *testing.T) {
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	local := &models.StaffMember{
		ID:       "perf-test",
		Name:     "Local Staff",
		Position: "Position A",
		Version:  1,
	}

	remote := &models.StaffMember{
		ID:       "perf-test",
		Name:     "Remote Staff",
		Position: "Position B",
		Version:  2,
	}

	// Measure conflict resolution time
	iterations := 1000
	start := time.Now()

	for i := 0; i < iterations; i++ {
		_, err := resolver.ResolveConflict(local, remote)
		if err != nil {
			t.Fatalf("Conflict resolution failed at iteration %d: %v", i, err)
		}
	}

	duration := time.Since(start)
	avgTime := duration / time.Duration(iterations)

	// Target: <50ms per resolution as per KPI
	maxAllowedTime := 50 * time.Millisecond
	if avgTime > maxAllowedTime {
		t.Errorf("Conflict resolution too slow: %v average (max allowed: %v)", avgTime, maxAllowedTime)
	}

	t.Logf("Conflict resolution performance: %v average over %d iterations", avgTime, iterations)
}

// Test strategy validation and error handling
func TestStaffUpdateConflictResolution_StrategyValidation(t *testing.T) {
	tests := []struct {
		name     string
		strategy conflict.ConflictStrategy
		isValid  bool
	}{
		{"LastWriterWins is valid", conflict.LastWriterWins, true},
		{"FirstWriterWins is valid", conflict.FirstWriterWins, true},
		{"MergeChanges is valid", conflict.MergeChanges, true},
		{"UserChoice is valid", conflict.UserChoice, true},
		{"Invalid strategy", conflict.ConflictStrategy(999), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := tt.strategy.IsValid()
			if isValid != tt.isValid {
				t.Errorf("Expected strategy validity %v, got %v", tt.isValid, isValid)
			}

			// Test string representation
			strategyString := tt.strategy.String()
			if tt.isValid && strategyString == "Unknown" {
				t.Errorf("Valid strategy should not return 'Unknown' string")
			}
		})
	}
}