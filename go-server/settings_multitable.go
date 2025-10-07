// Settings multi-table backend integration
// Handles real-time settings synchronization with Supabase multi-table architecture
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

// ============================================================================
// DATA STRUCTURES - Multi-Table Settings Architecture
// ============================================================================

// SettingsAggregate combines all 5 settings tables + version info
type SettingsAggregate struct {
	StaffGroups    []StaffGroup    `json:"staffGroups"`
	DailyLimits    []DailyLimit    `json:"dailyLimits"`
	MonthlyLimits  []MonthlyLimit  `json:"monthlyLimits"`
	PriorityRules  []PriorityRule  `json:"priorityRules"`
	MLModelConfigs []MLModelConfig `json:"mlModelConfigs"`
	Version        ConfigVersion   `json:"version"`
}

// StaffGroup represents a staff grouping configuration
type StaffGroup struct {
	ID           string                 `json:"id"`
	RestaurantID string                 `json:"restaurantId"`
	VersionID    string                 `json:"versionId"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Color        string                 `json:"color"`
	GroupConfig  map[string]interface{} `json:"groupConfig"`
	CreatedAt    time.Time              `json:"createdAt"`
	UpdatedAt    time.Time              `json:"updatedAt"`
	IsActive     bool                   `json:"isActive"`
}

// ToReactFormat converts snake_case to camelCase for React
func (sg *StaffGroup) ToReactFormat() map[string]interface{} {
	reactData := map[string]interface{}{
		"id":           sg.ID,
		"restaurantId": sg.RestaurantID,
		"versionId":    sg.VersionID,
		"name":         sg.Name,
		"description":  sg.Description,
		"color":        sg.Color,
		"groupConfig":  sg.GroupConfig,
		"createdAt":    sg.CreatedAt,
		"updatedAt":    sg.UpdatedAt,
		"isActive":     sg.IsActive,
	}

	// ✅ FIX: Extract members from group_config JSONB to top level for React
	// React expects: { id, name, members: [...] }
	// Database stores: { id, name, group_config: { members: [...] } }
	if sg.GroupConfig != nil {
		if members, ok := sg.GroupConfig["members"]; ok {
			reactData["members"] = members
		}
	}

	// Ensure members field always exists (even if empty)
	if _, exists := reactData["members"]; !exists {
		reactData["members"] = []interface{}{}
	}

	return reactData
}

// DailyLimit represents daily shift constraints
type DailyLimit struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurantId"`
	VersionID        string                 `json:"versionId"`
	Name             string                 `json:"name"`
	LimitConfig      map[string]interface{} `json:"limitConfig"`
	PenaltyWeight    float64                `json:"penaltyWeight"`
	IsHardConstraint bool                   `json:"isHardConstraint"`
	EffectiveFrom    *time.Time             `json:"effectiveFrom"`
	EffectiveUntil   *time.Time             `json:"effectiveUntil"`
	IsActive         bool                   `json:"isActive"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// ToReactFormat converts snake_case to camelCase for React
func (dl *DailyLimit) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":               dl.ID,
		"restaurantId":     dl.RestaurantID,
		"versionId":        dl.VersionID,
		"name":             dl.Name,
		"limitConfig":      dl.LimitConfig,
		"penaltyWeight":    dl.PenaltyWeight,
		"isHardConstraint": dl.IsHardConstraint,
		"effectiveFrom":    dl.EffectiveFrom,
		"effectiveUntil":   dl.EffectiveUntil,
		"isActive":         dl.IsActive,
		"createdAt":        dl.CreatedAt,
		"updatedAt":        dl.UpdatedAt,
	}
}

// MonthlyLimit represents monthly shift constraints
type MonthlyLimit struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurantId"`
	VersionID        string                 `json:"versionId"`
	Name             string                 `json:"name"`
	LimitConfig      map[string]interface{} `json:"limitConfig"`
	PenaltyWeight    float64                `json:"penaltyWeight"`
	IsHardConstraint bool                   `json:"isHardConstraint"`
	EffectiveFrom    *time.Time             `json:"effectiveFrom"`
	EffectiveUntil   *time.Time             `json:"effectiveUntil"`
	IsActive         bool                   `json:"isActive"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// ToReactFormat converts snake_case to camelCase for React
func (ml *MonthlyLimit) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":               ml.ID,
		"restaurantId":     ml.RestaurantID,
		"versionId":        ml.VersionID,
		"name":             ml.Name,
		"limitConfig":      ml.LimitConfig,
		"penaltyWeight":    ml.PenaltyWeight,
		"isHardConstraint": ml.IsHardConstraint,
		"effectiveFrom":    ml.EffectiveFrom,
		"effectiveUntil":   ml.EffectiveUntil,
		"isActive":         ml.IsActive,
		"createdAt":        ml.CreatedAt,
		"updatedAt":        ml.UpdatedAt,
	}
}

// PriorityRule represents scheduling priority rules
type PriorityRule struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurantId"`
	VersionID        string                 `json:"versionId"`
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	PriorityLevel    int                    `json:"priorityLevel"`
	RuleDefinition   map[string]interface{} `json:"ruleDefinition"`
	RuleConfig       map[string]interface{} `json:"ruleConfig"`
	PenaltyWeight    float64                `json:"penaltyWeight"`
	IsHardConstraint bool                   `json:"isHardConstraint"`
	EffectiveFrom    *time.Time             `json:"effectiveFrom"`
	EffectiveUntil   *time.Time             `json:"effectiveUntil"`
	IsActive         bool                   `json:"isActive"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// ToReactFormat converts snake_case to camelCase for React
func (pr *PriorityRule) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":               pr.ID,
		"restaurantId":     pr.RestaurantID,
		"versionId":        pr.VersionID,
		"name":             pr.Name,
		"description":      pr.Description,
		"priorityLevel":    pr.PriorityLevel,
		"ruleDefinition":   pr.RuleDefinition,
		"ruleConfig":       pr.RuleConfig,
		"penaltyWeight":    pr.PenaltyWeight,
		"isHardConstraint": pr.IsHardConstraint,
		"effectiveFrom":    pr.EffectiveFrom,
		"effectiveUntil":   pr.EffectiveUntil,
		"isActive":         pr.IsActive,
		"createdAt":        pr.CreatedAt,
		"updatedAt":        pr.UpdatedAt,
	}
}

// MLModelConfig represents ML model configuration
type MLModelConfig struct {
	ID                  string                 `json:"id"`
	RestaurantID        string                 `json:"restaurantId"`
	VersionID           string                 `json:"versionId"`
	ModelName           string                 `json:"modelName"`
	ModelType           string                 `json:"modelType"`
	Parameters          map[string]interface{} `json:"parameters"`
	ModelConfig         map[string]interface{} `json:"modelConfig"`
	ConfidenceThreshold float64                `json:"confidenceThreshold"`
	IsDefault           bool                   `json:"isDefault"`
	IsActive            bool                   `json:"isActive"`
	CreatedAt           time.Time              `json:"createdAt"`
	UpdatedAt           time.Time              `json:"updatedAt"`
}

// ToReactFormat converts snake_case to camelCase for React
func (mc *MLModelConfig) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":                  mc.ID,
		"restaurantId":        mc.RestaurantID,
		"versionId":           mc.VersionID,
		"modelName":           mc.ModelName,
		"modelType":           mc.ModelType,
		"parameters":          mc.Parameters,
		"modelConfig":         mc.ModelConfig,
		"confidenceThreshold": mc.ConfidenceThreshold,
		"isDefault":           mc.IsDefault,
		"isActive":            mc.IsActive,
		"createdAt":           mc.CreatedAt,
		"updatedAt":           mc.UpdatedAt,
	}
}

// ConfigVersion represents a configuration version
type ConfigVersion struct {
	ID            string     `json:"id"`
	RestaurantID  string     `json:"restaurantId"`
	VersionNumber int        `json:"versionNumber"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	CreatedBy     *string    `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
	IsActive      bool       `json:"isActive"`
	IsLocked      bool       `json:"isLocked"`
}

// ToReactFormat converts snake_case to camelCase for React
func (cv *ConfigVersion) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":            cv.ID,
		"restaurantId":  cv.RestaurantID,
		"versionNumber": cv.VersionNumber,
		"name":          cv.Name,
		"description":   cv.Description,
		"createdBy":     cv.CreatedBy,
		"createdAt":     cv.CreatedAt,
		"isActive":      cv.IsActive,
		"isLocked":      cv.IsLocked,
	}
}

// ============================================================================
// SUPABASE INTEGRATION FUNCTIONS - Multi-Table Queries
// ============================================================================

// getRestaurantID retrieves the restaurant ID from environment or uses default
func (s *StaffSyncServer) getRestaurantID() string {
	restaurantID := os.Getenv("RESTAURANT_ID")
	if restaurantID == "" {
		// Use default restaurant ID from Phase 1 verification
		restaurantID = "e1661c71-b24f-4ee1-9e8b-7290a43c9575"
	}
	return restaurantID
}

// fetchActiveConfigVersion retrieves the active configuration version
func (s *StaffSyncServer) fetchActiveConfigVersion() (*ConfigVersion, error) {
	restaurantID := s.getRestaurantID()
	url := fmt.Sprintf("%s/rest/v1/config_versions?restaurant_id=eq.%s&is_active=eq.true&select=*&order=created_at.desc&limit=1",
		s.supabaseURL, restaurantID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var versions []ConfigVersion
	if err := json.Unmarshal(body, &versions); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(versions) == 0 {
		return nil, fmt.Errorf("no active config version found")
	}

	return &versions[0], nil
}

// fetchStaffGroups retrieves staff groups for a specific version
func (s *StaffSyncServer) fetchStaffGroups(versionID string) ([]StaffGroup, error) {
	url := fmt.Sprintf("%s/rest/v1/staff_groups?version_id=eq.%s&is_active=eq.true&select=*",
		s.supabaseURL, versionID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var groups []StaffGroup
	if err := json.Unmarshal(body, &groups); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return groups, nil
}

// fetchDailyLimits retrieves daily limits for a specific version
func (s *StaffSyncServer) fetchDailyLimits(versionID string) ([]DailyLimit, error) {
	url := fmt.Sprintf("%s/rest/v1/daily_limits?version_id=eq.%s&is_active=eq.true&select=*",
		s.supabaseURL, versionID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var limits []DailyLimit
	if err := json.Unmarshal(body, &limits); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return limits, nil
}

// fetchMonthlyLimits retrieves monthly limits for a specific version
func (s *StaffSyncServer) fetchMonthlyLimits(versionID string) ([]MonthlyLimit, error) {
	url := fmt.Sprintf("%s/rest/v1/monthly_limits?version_id=eq.%s&is_active=eq.true&select=*",
		s.supabaseURL, versionID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var limits []MonthlyLimit
	if err := json.Unmarshal(body, &limits); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return limits, nil
}

// fetchPriorityRules retrieves priority rules for a specific version
func (s *StaffSyncServer) fetchPriorityRules(versionID string) ([]PriorityRule, error) {
	url := fmt.Sprintf("%s/rest/v1/priority_rules?version_id=eq.%s&is_active=eq.true&select=*",
		s.supabaseURL, versionID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var rules []PriorityRule
	if err := json.Unmarshal(body, &rules); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return rules, nil
}

// fetchMLModelConfigs retrieves ML model configurations for a specific version
func (s *StaffSyncServer) fetchMLModelConfigs(versionID string) ([]MLModelConfig, error) {
	url := fmt.Sprintf("%s/rest/v1/ml_model_configs?version_id=eq.%s&is_active=eq.true&select=*",
		s.supabaseURL, versionID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Supabase: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Supabase request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var configs []MLModelConfig
	if err := json.Unmarshal(body, &configs); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return configs, nil
}

// fetchAggregatedSettings fetches all settings tables for a specific version and aggregates them
func (s *StaffSyncServer) fetchAggregatedSettings(versionID string) (*SettingsAggregate, error) {
	// Fetch active version info
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch config version: %w", err)
	}

	// Fetch all settings tables
	staffGroups, err := s.fetchStaffGroups(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch staff groups: %v", err)
		staffGroups = []StaffGroup{}
	}

	dailyLimits, err := s.fetchDailyLimits(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch daily limits: %v", err)
		dailyLimits = []DailyLimit{}
	}

	monthlyLimits, err := s.fetchMonthlyLimits(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch monthly limits: %v", err)
		monthlyLimits = []MonthlyLimit{}
	}

	priorityRules, err := s.fetchPriorityRules(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch priority rules: %v", err)
		priorityRules = []PriorityRule{}
	}

	mlConfigs, err := s.fetchMLModelConfigs(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch ML configs: %v", err)
		mlConfigs = []MLModelConfig{}
	}

	return &SettingsAggregate{
		StaffGroups:    staffGroups,
		DailyLimits:    dailyLimits,
		MonthlyLimits:  monthlyLimits,
		PriorityRules:  priorityRules,
		MLModelConfigs: mlConfigs,
		Version:        *version,
	}, nil
}

// ============================================================================
// UPDATE OPERATIONS - Table-Specific Updates with Audit Logging
// ============================================================================

// updateStaffGroup updates a staff group in the database
func (s *StaffSyncServer) updateStaffGroup(versionID string, groupData map[string]interface{}) error {
	groupID, ok := groupData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid group id")
	}

	// 🔍 DEBUG: Log what we received from React
	log.Printf("🔍 [updateStaffGroup] Received groupData: %+v", groupData)
	if members, ok := groupData["members"]; ok {
		log.Printf("🔍 [updateStaffGroup] Members field present: %+v", members)
	} else {
		log.Printf("⚠️ [updateStaffGroup] Members field MISSING from groupData")
	}

	url := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, groupID, versionID)

	// Prepare update data with snake_case field names
	updateData := make(map[string]interface{})

	if name, ok := groupData["name"]; ok {
		updateData["name"] = name
	}
	if description, ok := groupData["description"]; ok {
		updateData["description"] = description
	}
	if color, ok := groupData["color"]; ok {
		updateData["color"] = color
	}

	// ✅ FIX: Handle members field from React - store in group_config JSONB
	// React sends members at top level: { id, name, members: [...] }
	// We need to merge it into groupConfig before storing
	if groupConfig, ok := groupData["groupConfig"].(map[string]interface{}); ok {
		// groupConfig exists - merge members into it
		if members, membersOk := groupData["members"]; membersOk {
			groupConfig["members"] = members
		}
		updateData["group_config"] = groupConfig
	} else {
		// groupConfig doesn't exist - create it with members
		if members, membersOk := groupData["members"]; membersOk {
			updateData["group_config"] = map[string]interface{}{
				"members": members,
			}
		} else if groupData["groupConfig"] != nil {
			// groupConfig is not a map but exists - preserve it
			updateData["group_config"] = groupData["groupConfig"]
		}
	}

	// Always update timestamp
	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// 🔍 DEBUG: Log what we're sending to Supabase
	log.Printf("🔍 [updateStaffGroup] Sending to Supabase: %+v", updateData)

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update staff group: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// updateDailyLimit updates a daily limit in the database
func (s *StaffSyncServer) updateDailyLimit(versionID string, limitData map[string]interface{}) error {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid limit id")
	}

	url := fmt.Sprintf("%s/rest/v1/daily_limits?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, limitID, versionID)

	// Prepare update data with snake_case field names
	updateData := make(map[string]interface{})

	if name, ok := limitData["name"]; ok {
		updateData["name"] = name
	}
	if limitConfig, ok := limitData["limitConfig"]; ok {
		updateData["limit_config"] = limitConfig
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		updateData["penalty_weight"] = penaltyWeight
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		updateData["is_hard_constraint"] = isHardConstraint
	}
	if effectiveFrom, ok := limitData["effectiveFrom"]; ok {
		updateData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := limitData["effectiveUntil"]; ok {
		updateData["effective_until"] = effectiveUntil
	}

	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update daily limit: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// updateMonthlyLimit updates a monthly limit in the database
func (s *StaffSyncServer) updateMonthlyLimit(versionID string, limitData map[string]interface{}) error {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid limit id")
	}

	url := fmt.Sprintf("%s/rest/v1/monthly_limits?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, limitID, versionID)

	// Prepare update data (same structure as daily limits)
	updateData := make(map[string]interface{})

	if name, ok := limitData["name"]; ok {
		updateData["name"] = name
	}
	if limitConfig, ok := limitData["limitConfig"]; ok {
		updateData["limit_config"] = limitConfig
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		updateData["penalty_weight"] = penaltyWeight
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		updateData["is_hard_constraint"] = isHardConstraint
	}
	if effectiveFrom, ok := limitData["effectiveFrom"]; ok {
		updateData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := limitData["effectiveUntil"]; ok {
		updateData["effective_until"] = effectiveUntil
	}

	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update monthly limit: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// updatePriorityRule updates a priority rule in the database
func (s *StaffSyncServer) updatePriorityRule(versionID string, ruleData map[string]interface{}) error {
	ruleID, ok := ruleData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid rule id")
	}

	url := fmt.Sprintf("%s/rest/v1/priority_rules?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, ruleID, versionID)

	// Prepare update data with snake_case field names
	updateData := make(map[string]interface{})

	if name, ok := ruleData["name"]; ok {
		updateData["name"] = name
	}
	if description, ok := ruleData["description"]; ok {
		updateData["description"] = description
	}
	if priorityLevel, ok := ruleData["priorityLevel"]; ok {
		updateData["priority_level"] = priorityLevel
	}
	if ruleDefinition, ok := ruleData["ruleDefinition"]; ok {
		updateData["rule_definition"] = ruleDefinition
	}
	if ruleConfig, ok := ruleData["ruleConfig"]; ok {
		updateData["rule_config"] = ruleConfig
	}
	if penaltyWeight, ok := ruleData["penaltyWeight"]; ok {
		updateData["penalty_weight"] = penaltyWeight
	}
	if isHardConstraint, ok := ruleData["isHardConstraint"]; ok {
		updateData["is_hard_constraint"] = isHardConstraint
	}
	if effectiveFrom, ok := ruleData["effectiveFrom"]; ok {
		updateData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := ruleData["effectiveUntil"]; ok {
		updateData["effective_until"] = effectiveUntil
	}

	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update priority rule: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// updateMLModelConfig updates an ML model configuration in the database
func (s *StaffSyncServer) updateMLModelConfig(versionID string, configData map[string]interface{}) error {
	configID, ok := configData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid config id")
	}

	url := fmt.Sprintf("%s/rest/v1/ml_model_configs?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, configID, versionID)

	// Prepare update data with snake_case field names
	updateData := make(map[string]interface{})

	if modelName, ok := configData["modelName"]; ok {
		updateData["model_name"] = modelName
	}
	if modelType, ok := configData["modelType"]; ok {
		updateData["model_type"] = modelType
	}
	if parameters, ok := configData["parameters"]; ok {
		updateData["parameters"] = parameters
	}
	if modelConfig, ok := configData["modelConfig"]; ok {
		updateData["model_config"] = modelConfig
	}
	if confidenceThreshold, ok := configData["confidenceThreshold"]; ok {
		updateData["confidence_threshold"] = confidenceThreshold
	}
	if isDefault, ok := configData["isDefault"]; ok {
		updateData["is_default"] = isDefault
	}

	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update ML config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ============================================================================
// INSERT OPERATIONS - For Migration and Bulk Operations
// ============================================================================

// insertStaffGroup inserts a new staff group into the database
func (s *StaffSyncServer) insertStaffGroup(versionID string, groupData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/staff_groups", s.supabaseURL)

	// Prepare insert data with required fields
	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data from groupData (camelCase → snake_case)
	if id, ok := groupData["id"]; ok {
		insertData["id"] = id
	}
	if name, ok := groupData["name"]; ok {
		insertData["name"] = name
	}
	if description, ok := groupData["description"]; ok {
		insertData["description"] = description
	}
	if color, ok := groupData["color"]; ok {
		insertData["color"] = color
	}

	// ✅ FIX: Handle members field from React - store in group_config JSONB
	if groupConfig, ok := groupData["groupConfig"].(map[string]interface{}); ok {
		// groupConfig exists - merge members into it
		if members, membersOk := groupData["members"]; membersOk {
			groupConfig["members"] = members
		}
		insertData["group_config"] = groupConfig
	} else {
		// groupConfig doesn't exist - create it with members
		if members, membersOk := groupData["members"]; membersOk {
			insertData["group_config"] = map[string]interface{}{
				"members": members,
			}
		} else if groupData["groupConfig"] != nil {
			// groupConfig is not a map but exists - preserve it
			insertData["group_config"] = groupData["groupConfig"]
		}
	}

	jsonData, _ := json.Marshal(insertData)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert staff group: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// insertDailyLimit inserts a new daily limit into the database
func (s *StaffSyncServer) insertDailyLimit(versionID string, limitData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/daily_limits", s.supabaseURL)

	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data (camelCase → snake_case)
	if id, ok := limitData["id"]; ok {
		insertData["id"] = id
	}
	if name, ok := limitData["name"]; ok {
		insertData["name"] = name
	}
	if limitConfig, ok := limitData["limitConfig"]; ok {
		insertData["limit_config"] = limitConfig
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		insertData["penalty_weight"] = penaltyWeight
	} else {
		insertData["penalty_weight"] = 1.0
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		insertData["is_hard_constraint"] = isHardConstraint
	} else {
		insertData["is_hard_constraint"] = false
	}

	jsonData, _ := json.Marshal(insertData)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert daily limit: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// insertMonthlyLimit inserts a new monthly limit into the database
func (s *StaffSyncServer) insertMonthlyLimit(versionID string, limitData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/monthly_limits", s.supabaseURL)

	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data (same structure as daily limits)
	if id, ok := limitData["id"]; ok {
		insertData["id"] = id
	}
	if name, ok := limitData["name"]; ok {
		insertData["name"] = name
	}
	if limitConfig, ok := limitData["limitConfig"]; ok {
		insertData["limit_config"] = limitConfig
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		insertData["penalty_weight"] = penaltyWeight
	} else {
		insertData["penalty_weight"] = 1.0
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		insertData["is_hard_constraint"] = isHardConstraint
	} else {
		insertData["is_hard_constraint"] = false
	}

	jsonData, _ := json.Marshal(insertData)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert monthly limit: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// insertPriorityRule inserts a new priority rule into the database
func (s *StaffSyncServer) insertPriorityRule(versionID string, ruleData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/priority_rules", s.supabaseURL)

	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data (camelCase → snake_case)
	if id, ok := ruleData["id"]; ok {
		insertData["id"] = id
	}
	if name, ok := ruleData["name"]; ok {
		insertData["name"] = name
	}
	if description, ok := ruleData["description"]; ok {
		insertData["description"] = description
	}
	if priorityLevel, ok := ruleData["priorityLevel"]; ok {
		insertData["priority_level"] = priorityLevel
	} else {
		insertData["priority_level"] = 1
	}
	if ruleDefinition, ok := ruleData["ruleDefinition"]; ok {
		insertData["rule_definition"] = ruleDefinition
	}
	if ruleConfig, ok := ruleData["ruleConfig"]; ok {
		insertData["rule_config"] = ruleConfig
	}
	if penaltyWeight, ok := ruleData["penaltyWeight"]; ok {
		insertData["penalty_weight"] = penaltyWeight
	} else {
		insertData["penalty_weight"] = 1.0
	}
	if isHardConstraint, ok := ruleData["isHardConstraint"]; ok {
		insertData["is_hard_constraint"] = isHardConstraint
	} else {
		insertData["is_hard_constraint"] = false
	}

	jsonData, _ := json.Marshal(insertData)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert priority rule: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// insertMLModelConfig inserts a new ML model configuration into the database
func (s *StaffSyncServer) insertMLModelConfig(versionID string, configData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/ml_model_configs", s.supabaseURL)

	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data (camelCase → snake_case)
	if id, ok := configData["id"]; ok {
		insertData["id"] = id
	}
	if modelName, ok := configData["modelName"]; ok {
		insertData["model_name"] = modelName
	}
	if modelType, ok := configData["modelType"]; ok {
		insertData["model_type"] = modelType
	}
	if parameters, ok := configData["parameters"]; ok {
		insertData["parameters"] = parameters
	}
	if modelConfig, ok := configData["modelConfig"]; ok {
		insertData["model_config"] = modelConfig
	}
	if confidenceThreshold, ok := configData["confidenceThreshold"]; ok {
		insertData["confidence_threshold"] = confidenceThreshold
	} else {
		insertData["confidence_threshold"] = 0.75
	}
	if isDefault, ok := configData["isDefault"]; ok {
		insertData["is_default"] = isDefault
	} else {
		insertData["is_default"] = false
	}

	jsonData, _ := json.Marshal(insertData)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert ML config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ============================================================================
// AUDIT TRAIL - Config Changes Logging
// ============================================================================

// logConfigChange logs a configuration change to the audit trail
func (s *StaffSyncServer) logConfigChange(versionID, tableName, operation string, data map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/config_changes", s.supabaseURL)

	changeLog := map[string]interface{}{
		"version_id": versionID,
		"table_name": tableName,
		"operation":  operation,
		"new_data":   data,
		"changed_at": time.Now().UTC().Format(time.RFC3339),
		"reason":     "WebSocket operation",
	}

	jsonData, _ := json.Marshal(changeLog)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to log config change: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("logging failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ============================================================================
// VERSION CONTROL OPERATIONS
// ============================================================================

// createConfigVersion creates a new configuration version
func (s *StaffSyncServer) createConfigVersion(name, description string) (*ConfigVersion, error) {
	// Get latest version number
	restaurantID := s.getRestaurantID()
	latestURL := fmt.Sprintf("%s/rest/v1/config_versions?restaurant_id=eq.%s&select=version_number&order=version_number.desc&limit=1",
		s.supabaseURL, restaurantID)

	req, err := http.NewRequest("GET", latestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch latest version: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	newVersionNumber := 1
	var versions []map[string]interface{}
	if json.Unmarshal(body, &versions) == nil && len(versions) > 0 {
		if vn, ok := versions[0]["version_number"].(float64); ok {
			newVersionNumber = int(vn) + 1
		}
	}

	// Create new version
	url := fmt.Sprintf("%s/rest/v1/config_versions", s.supabaseURL)

	versionData := map[string]interface{}{
		"restaurant_id":  restaurantID,
		"version_number": newVersionNumber,
		"name":           name,
		"description":    description,
		"is_active":      false, // Activate separately
		"is_locked":      false,
		"created_at":     time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, _ := json.Marshal(versionData)
	req, _ = http.NewRequest("POST", url, bytes.NewBuffer(jsonData))

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err = client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create version: %w", err)
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)

	var createdVersions []ConfigVersion
	if err := json.Unmarshal(body, &createdVersions); err != nil || len(createdVersions) == 0 {
		return nil, fmt.Errorf("failed to create version")
	}

	return &createdVersions[0], nil
}

// activateConfigVersion activates a configuration version (deactivates all others)
func (s *StaffSyncServer) activateConfigVersion(versionID string) error {
	restaurantID := s.getRestaurantID()

	// 1. Deactivate all versions
	deactivateURL := fmt.Sprintf("%s/rest/v1/config_versions?restaurant_id=eq.%s", s.supabaseURL, restaurantID)
	deactivateData := map[string]interface{}{"is_active": false}
	jsonData, _ := json.Marshal(deactivateData)

	req, _ := http.NewRequest("PATCH", deactivateURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	client.Do(req)

	// 2. Activate target version
	activateURL := fmt.Sprintf("%s/rest/v1/config_versions?id=eq.%s", s.supabaseURL, versionID)
	activateData := map[string]interface{}{"is_active": true}
	jsonData, _ = json.Marshal(activateData)

	req, _ = http.NewRequest("PATCH", activateURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to activate version: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// deactivateConfigVersion deactivates a configuration version
func (s *StaffSyncServer) deactivateConfigVersion(versionID string) error {
	url := fmt.Sprintf("%s/rest/v1/config_versions?id=eq.%s", s.supabaseURL, versionID)

	updateData := map[string]interface{}{"is_active": false}
	jsonData, _ := json.Marshal(updateData)

	req, _ := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to deactivate version: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// ============================================================================
// WEBSOCKET MESSAGE HANDLERS - Settings Multi-Table Operations
// ============================================================================

// handleSettingsSyncRequest returns aggregated settings from all 5 tables
func (s *StaffSyncServer) handleSettingsSyncRequest(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_SYNC_REQUEST from client %s", client.clientId)

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ Error fetching active config version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch config version", err)
		return
	}

	log.Printf("📌 Active config version: %d (%s)", version.VersionNumber, version.Name)

	// Fetch aggregated settings
	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("❌ Error fetching aggregated settings: %v", err)
		s.sendErrorResponse(client, "Failed to fetch settings", err)
		return
	}

	log.Printf("✅ Retrieved aggregated settings: %d staff groups, %d daily limits, %d monthly limits, %d priority rules, %d ML configs",
		len(settings.StaffGroups), len(settings.DailyLimits), len(settings.MonthlyLimits),
		len(settings.PriorityRules), len(settings.MLModelConfigs))

	// Send aggregated response
	response := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings":  settings,
			"timestamp": time.Now(),
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	if responseBytes, err := json.Marshal(response); err == nil {
		client.conn.WriteMessage(websocket.TextMessage, responseBytes)
		log.Printf("📡 Sent SETTINGS_SYNC_RESPONSE to client %s", client.clientId)
	} else {
		log.Printf("❌ Error marshaling settings sync response: %v", err)
	}
}

// handleStaffGroupsUpdate updates a staff group and broadcasts changes
func (s *StaffSyncServer) handleStaffGroupsUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_STAFF_GROUPS from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	groupData, ok := payload["group"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing group data")
		return
	}

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	// Check if version is locked
	if version.IsLocked {
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// Update staff group in database
	if err := s.updateStaffGroup(version.ID, groupData); err != nil {
		s.sendErrorResponse(client, "Failed to update staff group", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "staff_groups", "UPDATE", groupData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated staff group")

	// Fetch fresh aggregated settings
	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	// Broadcast updated settings to all clients
	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "staff_groups",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated staff groups to all clients")
}

// handleDailyLimitsUpdate updates a daily limit and broadcasts changes
func (s *StaffSyncServer) handleDailyLimitsUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_DAILY_LIMITS from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	limitData, ok := payload["limit"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing limit data")
		return
	}

	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	if version.IsLocked {
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	if err := s.updateDailyLimit(version.ID, limitData); err != nil {
		s.sendErrorResponse(client, "Failed to update daily limit", err)
		return
	}

	if err := s.logConfigChange(version.ID, "daily_limits", "UPDATE", limitData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated daily limit")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "daily_limits",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated daily limits to all clients")
}

// handleMonthlyLimitsUpdate updates a monthly limit and broadcasts changes
func (s *StaffSyncServer) handleMonthlyLimitsUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_MONTHLY_LIMITS from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	limitData, ok := payload["limit"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing limit data")
		return
	}

	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	if version.IsLocked {
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	if err := s.updateMonthlyLimit(version.ID, limitData); err != nil {
		s.sendErrorResponse(client, "Failed to update monthly limit", err)
		return
	}

	if err := s.logConfigChange(version.ID, "monthly_limits", "UPDATE", limitData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated monthly limit")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "monthly_limits",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated monthly limits to all clients")
}

// handlePriorityRulesUpdate updates a priority rule and broadcasts changes
func (s *StaffSyncServer) handlePriorityRulesUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_PRIORITY_RULES from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	ruleData, ok := payload["rule"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing rule data")
		return
	}

	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	if version.IsLocked {
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	if err := s.updatePriorityRule(version.ID, ruleData); err != nil {
		s.sendErrorResponse(client, "Failed to update priority rule", err)
		return
	}

	if err := s.logConfigChange(version.ID, "priority_rules", "UPDATE", ruleData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated priority rule")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "priority_rules",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated priority rules to all clients")
}

// handleMLConfigUpdate updates an ML model configuration and broadcasts changes
func (s *StaffSyncServer) handleMLConfigUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_ML_CONFIG from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	configData, ok := payload["config"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing config data")
		return
	}

	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	if version.IsLocked {
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	if err := s.updateMLModelConfig(version.ID, configData); err != nil {
		s.sendErrorResponse(client, "Failed to update ML config", err)
		return
	}

	if err := s.logConfigChange(version.ID, "ml_model_configs", "UPDATE", configData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated ML config")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "ml_model_configs",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated ML config to all clients")
}

// handleSettingsMigrate migrates localStorage settings to multi-table backend
func (s *StaffSyncServer) handleSettingsMigrate(client *Client, msg *Message) {
	log.Printf("📦 Processing SETTINGS_MIGRATE from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid migration payload format")
		return
	}

	settings, ok := payload["settings"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing settings in migration payload")
		return
	}

	// 1. Create new config version for migration
	version, err := s.createConfigVersion("localStorage Migration", "Automatic migration from localStorage")
	if err != nil {
		s.sendErrorResponse(client, "Failed to create migration version", err)
		return
	}

	log.Printf("📦 Created migration version: %d", version.VersionNumber)

	// 2. Migrate staff groups array → staff_groups table
	if staffGroups, ok := settings["staffGroups"].([]interface{}); ok {
		for _, group := range staffGroups {
			groupMap := group.(map[string]interface{})
			if err := s.insertStaffGroup(version.ID, groupMap); err != nil {
				log.Printf("⚠️ Failed to migrate staff group: %v", err)
				continue
			}
			s.logConfigChange(version.ID, "staff_groups", "INSERT", groupMap)
		}
		log.Printf("✅ Migrated %d staff groups", len(staffGroups))
	}

	// 3. Migrate daily limits array → daily_limits table
	if dailyLimits, ok := settings["dailyLimits"].([]interface{}); ok {
		for _, limit := range dailyLimits {
			limitMap := limit.(map[string]interface{})
			if err := s.insertDailyLimit(version.ID, limitMap); err != nil {
				log.Printf("⚠️ Failed to migrate daily limit: %v", err)
				continue
			}
			s.logConfigChange(version.ID, "daily_limits", "INSERT", limitMap)
		}
		log.Printf("✅ Migrated %d daily limits", len(dailyLimits))
	}

	// 4. Migrate monthly limits array → monthly_limits table
	if monthlyLimits, ok := settings["monthlyLimits"].([]interface{}); ok {
		for _, limit := range monthlyLimits {
			limitMap := limit.(map[string]interface{})
			if err := s.insertMonthlyLimit(version.ID, limitMap); err != nil {
				log.Printf("⚠️ Failed to migrate monthly limit: %v", err)
				continue
			}
			s.logConfigChange(version.ID, "monthly_limits", "INSERT", limitMap)
		}
		log.Printf("✅ Migrated %d monthly limits", len(monthlyLimits))
	}

	// 5. Migrate priority rules array → priority_rules table
	if priorityRules, ok := settings["priorityRules"].([]interface{}); ok {
		for _, rule := range priorityRules {
			ruleMap := rule.(map[string]interface{})
			if err := s.insertPriorityRule(version.ID, ruleMap); err != nil {
				log.Printf("⚠️ Failed to migrate priority rule: %v", err)
				continue
			}
			s.logConfigChange(version.ID, "priority_rules", "INSERT", ruleMap)
		}
		log.Printf("✅ Migrated %d priority rules", len(priorityRules))
	}

	// 6. Migrate ML parameters → ml_model_configs table
	if mlParams, ok := settings["mlParameters"].(map[string]interface{}); ok {
		if err := s.insertMLModelConfig(version.ID, mlParams); err != nil {
			log.Printf("⚠️ Failed to migrate ML config: %v", err)
		} else {
			s.logConfigChange(version.ID, "ml_model_configs", "INSERT", mlParams)
			log.Printf("✅ Migrated ML model config")
		}
	}

	// 7. Activate migrated version
	if err := s.activateConfigVersion(version.ID); err != nil {
		s.sendErrorResponse(client, "Failed to activate migrated version", err)
		return
	}

	log.Printf("✅ Successfully completed settings migration")

	// Fetch migrated settings
	migratedSettings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch migrated settings: %v", err)
		return
	}

	// Send confirmation with migrated data
	confirmationMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings":  migratedSettings,
			"migrated":  true,
			"timestamp": time.Now(),
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	if confirmationBytes, err := json.Marshal(confirmationMsg); err == nil {
		client.conn.WriteMessage(websocket.TextMessage, confirmationBytes)
		log.Printf("📡 Sent migration confirmation to client %s", client.clientId)
	}
}

// handleSettingsReset resets settings to defaults (multi-table reset)
func (s *StaffSyncServer) handleSettingsReset(client *Client, msg *Message) {
	log.Printf("🔄 Processing SETTINGS_RESET from client %s", client.clientId)

	// 1. Get current active version
	currentVersion, err := s.fetchActiveConfigVersion()
	if err != nil {
		s.sendErrorResponse(client, "Failed to fetch current version", err)
		return
	}

	// 2. Deactivate current version
	if err := s.deactivateConfigVersion(currentVersion.ID); err != nil {
		s.sendErrorResponse(client, "Failed to deactivate current version", err)
		return
	}

	// 3. Create new default version
	defaultVersion, err := s.createConfigVersion("Default Configuration", "Reset to system defaults")
	if err != nil {
		s.sendErrorResponse(client, "Failed to create default version", err)
		return
	}

	// 4. Insert default settings (placeholder - should be replaced with actual defaults)
	log.Printf("📝 Note: Using placeholder defaults - implement getDefaultSettings() for production")

	// 5. Activate default version
	if err := s.activateConfigVersion(defaultVersion.ID); err != nil {
		s.sendErrorResponse(client, "Failed to activate default version", err)
		return
	}

	log.Printf("✅ Successfully reset settings to defaults")

	// Fetch fresh default settings
	defaultSettings, err := s.fetchAggregatedSettings(defaultVersion.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch default settings: %v", err)
		return
	}

	// Broadcast reset to all clients
	resetMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": defaultSettings,
			"reset":    true,
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&resetMsg)
	log.Printf("📡 Broadcasted settings reset to all clients")
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// sendErrorResponse sends an error message to a specific client
func (s *StaffSyncServer) sendErrorResponse(client *Client, message string, err error) {
	errorMsg := Message{
		Type: "ERROR",
		Payload: map[string]interface{}{
			"error":   message,
			"details": "",
		},
		Timestamp: time.Now(),
		ClientID:  client.clientId,
	}

	if err != nil {
		errorMsg.Payload.(map[string]interface{})["details"] = err.Error()
	}

	if errorBytes, marshalErr := json.Marshal(errorMsg); marshalErr == nil {
		client.conn.WriteMessage(websocket.TextMessage, errorBytes)
	}
}
