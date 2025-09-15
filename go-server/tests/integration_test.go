// Phase 2.6: Testing Suite - Integration tests for Phase 2 components
package tests

import (
	"testing"
	"time"

	"shift-schedule-manager/go-server/client"
	"shift-schedule-manager/go-server/conflict"
	"shift-schedule-manager/go-server/models"
	"shift-schedule-manager/go-server/state"
)

func TestIntegration_StateManagerWithConflictResolution(t *testing.T) {
	sm := state.NewStateManager()
	resolver := conflict.NewConflictResolver(conflict.MergeChanges)

	// Create initial staff member
	request := models.StaffCreateRequest{
		Name:       "Integration Test Staff",
		Position:   "Chef",
		Department: "Kitchen",
		Type:       "regular",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Simulate conflict resolution scenario
	localVersion := &models.StaffMember{
		ID:         staff.ID,
		Name:       "Local Updated Name",
		Position:   staff.Position,
		Department: staff.Department,
		Type:       staff.Type,
		Version:    staff.Version + 1,
		UpdatedAt:  time.Now(),
	}

	remoteVersion := &models.StaffMember{
		ID:         staff.ID,
		Name:       staff.Name,
		Position:   "Remote Updated Position",
		Department: staff.Department,
		Type:       staff.Type,
		Version:    staff.Version + 1,
		UpdatedAt:  time.Now(),
	}

	// Resolve conflict
	resolved, err := resolver.ResolveConflict(localVersion, remoteVersion)
	if err != nil {
		t.Fatalf("Failed to resolve conflict: %v", err)
	}

	// Verify merge strategy worked correctly
	if resolved.Name != localVersion.Name {
		t.Errorf("Expected merged name %s, got %s", localVersion.Name, resolved.Name)
	}

	if resolved.Position != remoteVersion.Position {
		t.Errorf("Expected merged position %s, got %s", remoteVersion.Position, resolved.Position)
	}
}

func TestIntegration_StateManagerWithClientManager(t *testing.T) {
	sm := state.NewStateManager()
	cm := client.NewClientManager(30 * time.Second)

	// Mock WebSocket connection
	mockConn := &MockWebSocketConn{}
	testClient := cm.AddClient("integration-client", mockConn)

	// Subscribe client to staff updates
	testClient.AddSubscription("staff_update")
	sm.AddSubscriber("integration-client", testClient)

	// Create staff member (this should trigger a broadcast)
	request := models.StaffCreateRequest{
		Name:       "Broadcast Test Staff",
		Position:   "Server",
		Department: "Front",
		Type:       "part-time",
		Period:     1,
	}

	staff, err := sm.CreateStaff(request)
	if err != nil {
		t.Fatalf("Failed to create staff: %v", err)
	}

	// Update staff member (this should also trigger a broadcast)
	newName := "Updated Broadcast Staff"
	changes := models.StaffUpdateRequest{
		Name:    &newName,
		Version: staff.Version,
	}

	err = sm.UpdateStaff(staff.ID, changes)
	if err != nil {
		t.Fatalf("Failed to update staff: %v", err)
	}

	// Verify client is still connected (integration successful)
	retrievedClient, err := cm.GetClient("integration-client")
	if err != nil {
		t.Fatalf("Client should still be connected: %v", err)
	}

	if !retrievedClient.IsSubscribedTo("staff_update") {
		t.Error("Client should still be subscribed to staff_update")
	}
}

func TestIntegration_FullWorkflow(t *testing.T) {
	// Initialize all components
	sm := state.NewStateManager()
	cm := client.NewClientManager(30 * time.Second)
	resolver := conflict.NewConflictResolver(conflict.LastWriterWins)

	// Add mock clients
	mockConn1 := &MockWebSocketConn{}
	mockConn2 := &MockWebSocketConn{}

	client1 := cm.AddClient("workflow-client-1", mockConn1)
	client2 := cm.AddClient("workflow-client-2", mockConn2)

	// Subscribe clients to different events
	client1.AddSubscription("staff_update")
	client1.AddSubscription("staff_create")
	client2.AddSubscription("staff_update")
	client2.AddSubscription("staff_delete")

	// Add clients as subscribers to state manager
	sm.AddSubscriber("workflow-client-1", client1)
	sm.AddSubscriber("workflow-client-2", client2)

	// Step 1: Create multiple staff members
	staffRequests := []models.StaffCreateRequest{
		{Name: "Workflow Staff 1", Position: "Chef", Department: "Kitchen", Type: "regular", Period: 1},
		{Name: "Workflow Staff 2", Position: "Server", Department: "Front", Type: "part-time", Period: 1},
		{Name: "Workflow Staff 3", Position: "Cook", Department: "Kitchen", Type: "regular", Period: 2},
	}

	var createdStaff []*models.StaffMember
	for _, req := range staffRequests {
		staff, err := sm.CreateStaff(req)
		if err != nil {
			t.Fatalf("Failed to create staff: %v", err)
		}
		createdStaff = append(createdStaff, staff)
	}

	// Step 2: Update staff members
	for i, staff := range createdStaff {
		newName := fmt.Sprintf("Updated Workflow Staff %d", i+1)
		changes := models.StaffUpdateRequest{
			Name:    &newName,
			Version: staff.Version,
		}

		err := sm.UpdateStaff(staff.ID, changes)
		if err != nil {
			t.Fatalf("Failed to update staff %s: %v", staff.ID, err)
		}
	}

	// Step 3: Test conflict resolution with one of the staff members
	targetStaff := createdStaff[0]
	updatedStaff, err := sm.GetStaff(targetStaff.ID)
	if err != nil {
		t.Fatalf("Failed to get updated staff: %v", err)
	}

	// Simulate remote change
	remoteStaff := &models.StaffMember{
		ID:         updatedStaff.ID,
		Name:       "Remote Updated Name",
		Position:   updatedStaff.Position,
		Department: updatedStaff.Department,
		Type:       updatedStaff.Type,
		Version:    updatedStaff.Version + 1,
		UpdatedAt:  time.Now(),
	}

	resolved, err := resolver.ResolveConflict(updatedStaff, remoteStaff)
	if err != nil {
		t.Fatalf("Failed to resolve conflict: %v", err)
	}

	// For LastWriterWins, remote should win
	if resolved.Name != remoteStaff.Name {
		t.Errorf("Expected resolved name %s, got %s", remoteStaff.Name, resolved.Name)
	}

	// Step 4: Delete a staff member
	err = sm.DeleteStaff(createdStaff[2].ID)
	if err != nil {
		t.Fatalf("Failed to delete staff: %v", err)
	}

	// Step 5: Verify final state
	period1Staff := sm.GetAllStaff(1)
	period2Staff := sm.GetAllStaff(2)

	if len(period1Staff) != 2 {
		t.Errorf("Expected 2 staff in period 1, got %d", len(period1Staff))
	}

	if len(period2Staff) != 0 {
		t.Errorf("Expected 0 staff in period 2 after deletion, got %d", len(period2Staff))
	}

	// Step 6: Verify change log
	changeLog := sm.GetChangeLog()
	if len(changeLog) < 6 { // 3 creates + 2 updates + 1 delete
		t.Errorf("Expected at least 6 changes in log, got %d", len(changeLog))
	}

	// Step 7: Verify client connections are still active
	finalClient1, err := cm.GetClient("workflow-client-1")
	if err != nil {
		t.Fatalf("Client 1 should still be connected: %v", err)
	}

	finalClient2, err := cm.GetClient("workflow-client-2")
	if err != nil {
		t.Fatalf("Client 2 should still be connected: %v", err)
	}

	if finalClient1.ID != "workflow-client-1" {
		t.Error("Client 1 ID mismatch")
	}

	if finalClient2.ID != "workflow-client-2" {
		t.Error("Client 2 ID mismatch")
	}

	// Step 8: Clean up
	cm.RemoveClient("workflow-client-1")
	cm.RemoveClient("workflow-client-2")

	if cm.GetClientCount() != 0 {
		t.Errorf("Expected 0 clients after cleanup, got %d", cm.GetClientCount())
	}
}

func TestIntegration_PerformanceUnderLoad(t *testing.T) {
	sm := state.NewStateManager()
	cm := client.NewClientManager(10 * time.Second)

	// Create multiple clients
	const clientCount = 10
	const operationsPerClient = 50

	clients := make([]*state.Client, clientCount)
	for i := 0; i < clientCount; i++ {
		mockConn := &MockWebSocketConn{}
		clientID := fmt.Sprintf("perf-client-%d", i)
		clients[i] = cm.AddClient(clientID, mockConn)
		clients[i].AddSubscription("staff_update")
		sm.AddSubscriber(clientID, clients[i])
	}

	// Perform concurrent operations
	done := make(chan bool, clientCount)
	errors := make(chan error, clientCount*operationsPerClient)

	startTime := time.Now()

	for i := 0; i < clientCount; i++ {
		go func(clientIndex int) {
			defer func() { done <- true }()

			for j := 0; j < operationsPerClient; j++ {
				// Create staff
				request := models.StaffCreateRequest{
					Name:       fmt.Sprintf("Perf Staff %d-%d", clientIndex, j),
					Position:   "Load Test",
					Department: "Performance",
					Type:       "regular",
					Period:     1,
				}

				staff, err := sm.CreateStaff(request)
				if err != nil {
					errors <- err
					continue
				}

				// Update staff
				newName := fmt.Sprintf("Updated Perf Staff %d-%d", clientIndex, j)
				changes := models.StaffUpdateRequest{
					Name:    &newName,
					Version: staff.Version,
				}

				err = sm.UpdateStaff(staff.ID, changes)
				if err != nil {
					errors <- err
				}
			}
		}(i)
	}

	// Wait for all operations to complete
	for i := 0; i < clientCount; i++ {
		<-done
	}

	duration := time.Since(startTime)

	// Check for errors
	select {
	case err := <-errors:
		t.Fatalf("Operation failed during load test: %v", err)
	default:
		// No errors, continue
	}

	// Verify performance (this is a basic check)
	totalOperations := clientCount * operationsPerClient * 2 // create + update
	operationsPerSecond := float64(totalOperations) / duration.Seconds()

	t.Logf("Performance test completed: %d operations in %v (%.2f ops/sec)",
		totalOperations, duration, operationsPerSecond)

	// Basic performance threshold (adjust as needed)
	if operationsPerSecond < 100 {
		t.Logf("Warning: Performance may be below expected threshold (%.2f ops/sec)", operationsPerSecond)
	}

	// Verify final state consistency
	allStaff := sm.GetAllStaff(1)
	expectedCount := clientCount * operationsPerClient
	if len(allStaff) != expectedCount {
		t.Errorf("Expected %d staff members, got %d", expectedCount, len(allStaff))
	}

	// Clean up clients
	for i := 0; i < clientCount; i++ {
		cm.RemoveClient(fmt.Sprintf("perf-client-%d", i))
	}

	if cm.GetClientCount() != 0 {
		t.Errorf("Expected 0 clients after cleanup, got %d", cm.GetClientCount())
	}
}

// Helper function for string formatting in integration tests
func fmt.Sprintf(format string, args ...interface{}) string {
	// Simplified sprintf implementation for tests
	// In production, this would be the real fmt.Sprintf
	if len(args) == 1 {
		if i, ok := args[0].(int); ok {
			// Simple replacement for %d
			result := ""
			for _, char := range format {
				if char == '%' {
					continue
				}
				if char == 'd' {
					result += string(rune('0' + i))
				} else {
					result += string(char)
				}
			}
			return result
		}
	}
	return format
}