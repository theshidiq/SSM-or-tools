// Phase 2.6: Testing Suite - StateManager tests
package tests

import (
	"testing"
	"time"

	"shift-schedule-manager/go-server/models"
	"shift-schedule-manager/go-server/state"
)

func TestStateManager_CreateAndGetStaff(t *testing.T) {
	sm := state.NewStateManager()

	// Test creating staff
	request := models.StaffCreateRequest{
		Name:       "Test Staff",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	if staff.Name != request.Name {
		t.Errorf("Expected name %s, got %s", request.Name, staff.Name)
	}

	// Test getting staff
	retrieved, err := sm.GetStaff(staff.ID)
	if err != nil {
		t.Fatalf("Failed to get staff: %v", err)
	}

	if retrieved.ID != staff.ID {
		t.Errorf("Expected ID %s, got %s", staff.ID, retrieved.ID)
	}
}

func TestStateManager_UpdateStaff(t *testing.T) {
	sm := state.NewStateManager()

	// Create initial staff
	request := models.StaffCreateRequest{
		Name:       "Test Staff",
		Position:   "Cook",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Test updating staff
	newName := "Updated Staff"
	newPosition := "Head Chef"

	changes := models.StaffUpdateRequest{
		Name:     &newName,
		Position: &newPosition,
		Version:  staff.Version,
	}

	err = sm.UpdateStaff(staff.ID, changes)
	if err != nil {
		t.Fatalf("Failed to update staff: %v", err)
	}

	// Verify changes
	updated, err := sm.GetStaff(staff.ID)
	if err != nil {
		t.Fatalf("Failed to get updated staff: %v", err)
	}

	if updated.Name != newName {
		t.Errorf("Expected name %s, got %s", newName, updated.Name)
	}

	if updated.Position != newPosition {
		t.Errorf("Expected position %s, got %s", newPosition, updated.Position)
	}

	if updated.Version <= staff.Version {
		t.Errorf("Expected version to increase, got %d vs original %d", updated.Version, staff.Version)
	}
}

func TestStateManager_DeleteStaff(t *testing.T) {
	sm := state.NewStateManager()

	// Create staff to delete
	request := models.StaffCreateRequest{
		Name:       "Test Staff",
		Position:   "Server",
		Department: "Front",
		Type:       "part-time",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Delete staff
	err = sm.DeleteStaff(staff.ID)
	if err != nil {
		t.Fatalf("Failed to delete staff: %v", err)
	}

	// Verify deletion
	_, err = sm.GetStaff(staff.ID)
	if err == nil {
		t.Error("Expected error when getting deleted staff, got nil")
	}
}

func TestStateManager_GetAllStaffByPeriod(t *testing.T) {
	sm := state.NewStateManager()

	// Create staff for different periods
	requests := []models.StaffCreateRequest{
		{Name: "Staff 1", Position: "Chef", Department: "Kitchen", Type: "regular", Period: 1},
		{Name: "Staff 2", Position: "Server", Department: "Front", Type: "part-time", Period: 1},
		{Name: "Staff 3", Position: "Cook", Department: "Kitchen", Type: "regular", Period: 2},
	}

	for _, req := range requests {
		_, err := sm.CreateStaff(req)
		if err != nil {
			t.Fatalf("Failed to create staff: %v", err)
		}
	}

	// Test getting staff for period 1
	period1Staff := sm.GetAllStaff(1)
	if len(period1Staff) != 2 {
		t.Errorf("Expected 2 staff for period 1, got %d", len(period1Staff))
	}

	// Test getting staff for period 2
	period2Staff := sm.GetAllStaff(2)
	if len(period2Staff) != 1 {
		t.Errorf("Expected 1 staff for period 2, got %d", len(period2Staff))
	}
}

func TestStateManager_VersionControl(t *testing.T) {
	sm := state.NewStateManager()

	initialVersion := sm.GetVersion()

	// Create staff and check version increment
	request := models.StaffCreateRequest{
		Name:       "Version Test",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	if sm.GetVersion() <= initialVersion {
		t.Error("Expected version to increment after creating staff")
	}

	// Update staff and check version increment again
	newName := "Updated Version Test"
	changes := models.StaffUpdateRequest{
		Name:    &newName,
		Version: staff.Version,
	}

	oldVersion := sm.GetVersion()
	err = sm.UpdateStaff(staff.ID, changes)
	if err != nil {
		t.Fatalf("Failed to update staff: %v", err)
	}

	if sm.GetVersion() <= oldVersion {
		t.Error("Expected version to increment after updating staff")
	}
}

func TestStateManager_ConcurrentAccess(t *testing.T) {
	sm := state.NewStateManager()

	// Create initial staff
	request := models.StaffCreateRequest{
		Name:       "Concurrent Test",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Test concurrent reads
	done := make(chan bool)
	errors := make(chan error, 10)

	for i := 0; i < 10; i++ {
		go func() {
			defer func() { done <- true }()

			for j := 0; j < 100; j++ {
				_, err := sm.GetStaff(staff.ID)
				if err != nil {
					errors <- err
					return
				}
			}
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Check for errors
	select {
	case err := <-errors:
		t.Fatalf("Concurrent read failed: %v", err)
	default:
		// No errors, test passed
	}
}

func TestStateManager_ChangeLog(t *testing.T) {
	sm := state.NewStateManager()

	// Create staff
	request := models.StaffCreateRequest{
		Name:       "Change Log Test",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Update staff
	newName := "Updated Change Log Test"
	changes := models.StaffUpdateRequest{
		Name:    &newName,
		Version: staff.Version,
	}

	err = sm.UpdateStaff(staff.ID, changes)
	if err != nil {
		t.Fatalf("Failed to update staff: %v", err)
	}

	// Check change log
	changeLog := sm.GetChangeLog()
	if len(changeLog) < 2 {
		t.Errorf("Expected at least 2 changes in log, got %d", len(changeLog))
	}

	// Verify change types
	foundCreate := false
	foundUpdate := false
	for _, change := range changeLog {
		if change.Type == "staff_create" {
			foundCreate = true
		}
		if change.Type == "staff_update" {
			foundUpdate = true
		}
	}

	if !foundCreate {
		t.Error("Expected staff_create in change log")
	}
	if !foundUpdate {
		t.Error("Expected staff_update in change log")
	}
}

func TestStateManager_ValidationErrors(t *testing.T) {
	sm := state.NewStateManager()

	// Test invalid staff type
	request := models.StaffCreateRequest{
		Name:       "Invalid Type Test",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "invalid-type", // Should cause validation error
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Test invalid update with wrong version
	emptyName := ""
	changes := models.StaffUpdateRequest{
		Name:    &emptyName, // Empty name should fail validation
		Version: staff.Version,
	}

	err = sm.UpdateStaff(staff.ID, changes)
	if err == nil {
		t.Error("Expected validation error for empty name, got nil")
	}

	// Test version conflict
	changes = models.StaffUpdateRequest{
		Version: staff.Version + 100, // Wrong version should fail
	}

	err = sm.UpdateStaff(staff.ID, changes)
	if err == nil {
		t.Error("Expected version conflict error, got nil")
	}
}