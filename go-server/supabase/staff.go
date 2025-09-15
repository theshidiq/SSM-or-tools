// Phase 2.4: Supabase Integration - Staff operations
package supabase

import (
	"fmt"
	"log"

	"shift-schedule-manager/go-server/models"
)

// StaffRepository handles staff member operations with Supabase
type StaffRepository struct {
	client *SupabaseClient
}

// NewStaffRepository creates a new staff repository
func NewStaffRepository(client *SupabaseClient) *StaffRepository {
	return &StaffRepository{
		client: client,
	}
}

// CreateStaff creates a new staff member in Supabase
func (sr *StaffRepository) CreateStaff(staff *models.StaffMember) error {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Creating staff member %s (%s)", staff.Name, staff.ID)
		return nil
	}

	endpoint := "staff_members"
	var result []models.StaffMember

	err := sr.client.Post(endpoint, staff, &result)
	if err != nil {
		return fmt.Errorf("failed to create staff member: %w", err)
	}

	return nil
}

// GetStaff retrieves a staff member by ID
func (sr *StaffRepository) GetStaff(staffID string) (*models.StaffMember, error) {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Getting staff member %s", staffID)
		return &models.StaffMember{
			ID:         staffID,
			Name:       "Mock Staff",
			Position:   "Mock Position",
			Department: "Mock Department",
			Type:       "regular",
		}, nil
	}

	endpoint := fmt.Sprintf("staff_members?id=eq.%s&select=*", staffID)
	var result []models.StaffMember

	err := sr.client.Get(endpoint, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get staff member: %w", err)
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("staff member not found: %s", staffID)
	}

	return &result[0], nil
}

// GetAllStaffByPeriod retrieves all staff members for a specific period
func (sr *StaffRepository) GetAllStaffByPeriod(period int) ([]models.StaffMember, error) {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Getting all staff for period %d", period)
		return []models.StaffMember{
			{
				ID:         "mock-1",
				Name:       "Mock Staff 1",
				Position:   "Chef",
				Department: "Kitchen",
				Type:       "regular",
				Period:     period,
			},
			{
				ID:         "mock-2",
				Name:       "Mock Staff 2",
				Position:   "Server",
				Department: "Front of House",
				Type:       "part-time",
				Period:     period,
			},
		}, nil
	}

	endpoint := fmt.Sprintf("staff_members?period=eq.%d&select=*", period)
	var result []models.StaffMember

	err := sr.client.Get(endpoint, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get staff members for period %d: %w", period, err)
	}

	return result, nil
}

// UpdateStaff updates a staff member in Supabase
func (sr *StaffRepository) UpdateStaff(staffID string, staff *models.StaffMember) error {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Updating staff member %s (%s)", staff.Name, staffID)
		return nil
	}

	endpoint := fmt.Sprintf("staff_members?id=eq.%s", staffID)
	var result []models.StaffMember

	err := sr.client.Patch(endpoint, staff, &result)
	if err != nil {
		return fmt.Errorf("failed to update staff member: %w", err)
	}

	return nil
}

// DeleteStaff deletes a staff member from Supabase
func (sr *StaffRepository) DeleteStaff(staffID string) error {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Deleting staff member %s", staffID)
		return nil
	}

	endpoint := fmt.Sprintf("staff_members?id=eq.%s", staffID)

	err := sr.client.Delete(endpoint)
	if err != nil {
		return fmt.Errorf("failed to delete staff member: %w", err)
	}

	return nil
}

// UpsertStaff creates or updates a staff member
func (sr *StaffRepository) UpsertStaff(staff *models.StaffMember) error {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Upserting staff member %s (%s)", staff.Name, staff.ID)
		return nil
	}

	// Try to update first
	err := sr.UpdateStaff(staff.ID, staff)
	if err != nil {
		// If update fails, try to create
		return sr.CreateStaff(staff)
	}

	return nil
}

// BulkUpsertStaff performs bulk upsert of multiple staff members
func (sr *StaffRepository) BulkUpsertStaff(staffList []models.StaffMember) error {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Bulk upserting %d staff members", len(staffList))
		return nil
	}

	if len(staffList) == 0 {
		return nil
	}

	endpoint := "staff_members"
	var result []models.StaffMember

	// Use upsert=true parameter for Supabase upsert
	err := sr.client.Post(endpoint+"?on_conflict=id", staffList, &result)
	if err != nil {
		return fmt.Errorf("failed to bulk upsert staff members: %w", err)
	}

	return nil
}

// GetStaffByName retrieves staff members by name pattern
func (sr *StaffRepository) GetStaffByName(namePattern string, period int) ([]models.StaffMember, error) {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Getting staff by name pattern %s for period %d", namePattern, period)
		return []models.StaffMember{
			{
				ID:         "mock-search-1",
				Name:       "Mock " + namePattern,
				Position:   "Position",
				Department: "Department",
				Type:       "regular",
				Period:     period,
			},
		}, nil
	}

	endpoint := fmt.Sprintf("staff_members?period=eq.%d&name=ilike.*%s*&select=*", period, namePattern)
	var result []models.StaffMember

	err := sr.client.Get(endpoint, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to search staff by name: %w", err)
	}

	return result, nil
}

// GetStaffCount returns the total number of staff members for a period
func (sr *StaffRepository) GetStaffCount(period int) (int, error) {
	if sr.client.IsMockClient() {
		log.Printf("Mock: Getting staff count for period %d", period)
		return 10, nil
	}

	staff, err := sr.GetAllStaffByPeriod(period)
	if err != nil {
		return 0, err
	}

	return len(staff), nil
}