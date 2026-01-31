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
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ============================================================================
// DATA STRUCTURES - Multi-Table Settings Architecture
// ============================================================================

// SettingsAggregate combines all 7 settings tables + version info
type SettingsAggregate struct {
	StaffGroups       []StaffGroup          `json:"staffGroups"`
	WeeklyLimits      []WeeklyLimit         `json:"weeklyLimits"`
	MonthlyLimits     []MonthlyLimit        `json:"monthlyLimits"`
	DailyLimits       map[string]interface{} `json:"dailyLimits"` // Daily limits stored as JSONB
	PriorityRules     []PriorityRule        `json:"priorityRules"`
	BackupAssignments []BackupAssignment    `json:"backupAssignments"`
	MLModelConfigs    []MLModelConfig       `json:"mlModelConfigs"`
	ORToolsConfig     []ORToolsSolverConfig `json:"ortoolsConfig"`
	Version           ConfigVersion         `json:"version"`
}

// MarshalJSON custom marshaler for SettingsAggregate
// Converts StaffGroups and PriorityRules to React format (snake_case → camelCase)
func (sa *SettingsAggregate) MarshalJSON() ([]byte, error) {
	// Convert staff groups to React format
	reactGroups := make([]map[string]interface{}, len(sa.StaffGroups))
	for i, group := range sa.StaffGroups {
		reactGroups[i] = group.ToReactFormat()

		// 🔍 DEBUG: Log Group 4 to verify members extraction
		if group.Name == "Group 4" {
			log.Printf("🔍 [MarshalJSON] Group 4 after ToReactFormat: %+v", reactGroups[i])
		}
	}

	// Convert weekly limits to React format (snake_case → camelCase)
	reactWeeklyLimits := make([]map[string]interface{}, len(sa.WeeklyLimits))
	for i, limit := range sa.WeeklyLimits {
		reactWeeklyLimits[i] = limit.ToReactFormat()

		// 🔍 DEBUG: Log ToReactFormat() output to verify extraction
		log.Printf("🔍 [ToReactFormat-WeeklyLimit] Limit %d '%s' after ToReactFormat:", i, limit.Name)
		if maxCount, ok := reactWeeklyLimits[i]["maxCount"]; ok {
			log.Printf("   ✅ maxCount extracted to top level: %v", maxCount)
		} else {
			log.Printf("   ❌ maxCount NOT found at top level!")
		}
		if shiftType, ok := reactWeeklyLimits[i]["shiftType"]; ok {
			log.Printf("   ✅ shiftType extracted to top level: %v", shiftType)
		} else {
			log.Printf("   ❌ shiftType NOT found at top level!")
		}
	}

	// Convert monthly limits to React format (snake_case → camelCase)
	reactMonthlyLimits := make([]map[string]interface{}, len(sa.MonthlyLimits))
	for i, limit := range sa.MonthlyLimits {
		reactMonthlyLimits[i] = limit.ToReactFormat()
	}

	// Convert priority rules to React format (CRITICAL FIX!)
	reactPriorityRules := make([]map[string]interface{}, len(sa.PriorityRules))
	for i, rule := range sa.PriorityRules {
		reactPriorityRules[i] = rule.ToReactFormat()

		// 🔍 DEBUG: Log transformed rule to verify extraction
		log.Printf("🔍 [MarshalJSON] Rule %d '%s' after ToReactFormat:", i, rule.Name)
		log.Printf("   staffId in result: %v", reactPriorityRules[i]["staffId"])
		log.Printf("   shiftType in result: %v", reactPriorityRules[i]["shiftType"])
		log.Printf("   daysOfWeek in result: %v", reactPriorityRules[i]["daysOfWeek"])
	}

	// Convert backup assignments to React format
	reactBackupAssignments := make([]map[string]interface{}, len(sa.BackupAssignments))
	for i, assignment := range sa.BackupAssignments {
		reactBackupAssignments[i] = assignment.ToReactFormat()
	}

	// ✅ FIX: Convert OR-Tools config array to single object for React
	// React expects: { preset, penaltyWeights, solverSettings }
	// Database stores: [ { id, preset, penaltyWeights, solverSettings, ... } ]
	var reactORToolsConfig map[string]interface{}
	if len(sa.ORToolsConfig) > 0 {
		// Take the first (and typically only) config
		config := sa.ORToolsConfig[0]
		// Use hardConstraints from database, or default with staffGroups=true
		hardConstraints := config.HardConstraints
		if hardConstraints == nil {
			hardConstraints = map[string]interface{}{
				"dailyLimits":  false,
				"monthlyLimits": false,
				"staffGroups":  true, // Default to HARD for staff groups
				"fiveDayRest":  false,
			}
		}
		reactORToolsConfig = map[string]interface{}{
			"id":              config.ID,
			"preset":          config.Preset,
			"penaltyWeights":  config.PenaltyWeights,
			"solverSettings":  config.SolverSettings,
			"hardConstraints": hardConstraints,
			"isActive":        config.IsActive,
		}
		log.Printf("🔧 [MarshalJSON] OR-Tools config included: preset=%s, hardConstraints=%v", config.Preset, hardConstraints)
	} else {
		// Provide defaults if no config exists
		reactORToolsConfig = map[string]interface{}{
			"preset": "balanced",
			"penaltyWeights": map[string]interface{}{
				"staffGroup":       100,
				"dailyLimitMin":    50,
				"dailyLimitMax":    50,
				"monthlyLimit":     80,
				"adjacentConflict": 30,
				"fiveDayRest":      200,
			},
			"solverSettings": map[string]interface{}{
				"timeout":    30,
				"numWorkers": 4,
			},
			"hardConstraints": map[string]interface{}{
				"dailyLimits":   false,
				"monthlyLimits": false,
				"staffGroups":   true, // Default to HARD for staff groups
				"fiveDayRest":   false,
			},
		}
		log.Printf("🔧 [MarshalJSON] No OR-Tools config found, using defaults with staffGroups=HARD")
	}

	// Create response structure with converted data
	response := map[string]interface{}{
		"staffGroups":       reactGroups,
		"weeklyLimits":      reactWeeklyLimits,      // ✅ FIXED: Now using converted format
		"monthlyLimits":     reactMonthlyLimits,     // ✅ FIXED: Now using converted format
		"dailyLimits":       sa.DailyLimits,         // ✅ FIXED: Added daily limits from database
		"priorityRules":     reactPriorityRules,     // ← FIXED: Now using converted format
		"backupAssignments": reactBackupAssignments, // Backup staff assignments
		"mlModelConfigs":    sa.MLModelConfigs,
		"ortoolsConfig":     reactORToolsConfig,     // ✅ FIX: Added OR-Tools config for React
		"version":           sa.Version,
	}

	return json.Marshal(response)
}

// StaffGroup represents a staff grouping configuration
type StaffGroup struct {
	ID           string                 `json:"id"`
	RestaurantID string                 `json:"restaurant_id"` // Changed: Supabase uses snake_case
	VersionID    string                 `json:"version_id"`    // Changed: Supabase uses snake_case
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Color        string                 `json:"color"`
	GroupConfig  map[string]interface{} `json:"group_config"` // ✅ FIX: Changed from groupConfig to group_config
	CreatedAt    time.Time              `json:"created_at"`   // Changed: Supabase uses snake_case
	UpdatedAt    time.Time              `json:"updated_at"`   // Changed: Supabase uses snake_case
	IsActive     bool                   `json:"is_active"`    // Changed: Supabase uses snake_case
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

// WeeklyLimit represents shift symbol constraints over rolling 7-day periods
// NOT calendar weeks (Mon-Sun), but any consecutive 7-day window
// Example: Maximum 2 "day off (×)" symbols in any 7-day period
type WeeklyLimit struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurant_id"` // Changed: Supabase uses snake_case
	VersionID        string                 `json:"version_id"`    // Changed: Supabase uses snake_case
	Name             string                 `json:"name"`
	LimitConfig      map[string]interface{} `json:"limit_config"`       // Changed: Supabase uses snake_case
	PenaltyWeight    float64                `json:"penalty_weight"`     // Changed: Supabase uses snake_case
	IsHardConstraint bool                   `json:"is_hard_constraint"` // Changed: Supabase uses snake_case
	EffectiveFrom    *time.Time             `json:"effective_from"`     // Changed: Supabase uses snake_case
	EffectiveUntil   *time.Time             `json:"effective_until"`    // Changed: Supabase uses snake_case
	IsActive         bool                   `json:"is_active"`          // Changed: Supabase uses snake_case
	CreatedAt        time.Time              `json:"created_at"`         // Changed: Supabase uses snake_case
	UpdatedAt        time.Time              `json:"updated_at"`         // Changed: Supabase uses snake_case
}

// ToReactFormat converts snake_case to camelCase for React
func (wl *WeeklyLimit) ToReactFormat() map[string]interface{} {
	reactData := map[string]interface{}{
		"id":               wl.ID,
		"restaurantId":     wl.RestaurantID,
		"versionId":        wl.VersionID,
		"name":             wl.Name,
		"limitConfig":      wl.LimitConfig,
		"penaltyWeight":    wl.PenaltyWeight,
		"isHardConstraint": wl.IsHardConstraint,
		"effectiveFrom":    wl.EffectiveFrom,
		"effectiveUntil":   wl.EffectiveUntil,
		"isActive":         wl.IsActive,
		"createdAt":        wl.CreatedAt,
		"updatedAt":        wl.UpdatedAt,
	}

	// ✅ FIX: Extract fields from limit_config JSONB to top level for React
	// React expects: { id, name, maxCount: 2, shiftType: "off", ... }
	// Database stores: { id, name, limit_config: { maxCount: 2, shiftType: "off", ... } }
	if wl.LimitConfig != nil {
		if maxCount, ok := wl.LimitConfig["maxCount"]; ok {
			reactData["maxCount"] = maxCount
		}
		if shiftType, ok := wl.LimitConfig["shiftType"]; ok {
			reactData["shiftType"] = shiftType
		}
		if daysOfWeek, ok := wl.LimitConfig["daysOfWeek"]; ok {
			reactData["daysOfWeek"] = daysOfWeek
		}
		if scope, ok := wl.LimitConfig["scope"]; ok {
			reactData["scope"] = scope
		}
		if targetIds, ok := wl.LimitConfig["targetIds"]; ok {
			reactData["targetIds"] = targetIds
		}
	}

	return reactData
}

// MonthlyLimit represents monthly shift constraints
// ✅ FIX: JSON tags use snake_case to match Supabase REST API response format
type MonthlyLimit struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurant_id"`
	VersionID        string                 `json:"version_id"`
	Name             string                 `json:"name"`
	LimitConfig      map[string]interface{} `json:"limit_config"`
	PenaltyWeight    float64                `json:"penalty_weight"`
	IsHardConstraint bool                   `json:"is_hard_constraint"`
	EffectiveFrom    *time.Time             `json:"effective_from"`
	EffectiveUntil   *time.Time             `json:"effective_until"`
	IsActive         bool                   `json:"is_active"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

// ToReactFormat converts snake_case to camelCase for React
// ✅ FIX: Also extracts nested fields from limit_config JSONB to top-level properties
// React's LimitsTab.jsx expects minCount, maxCount, etc. at top level
func (ml *MonthlyLimit) ToReactFormat() map[string]interface{} {
	result := map[string]interface{}{
		"id":               ml.ID,
		"restaurantId":     ml.RestaurantID,
		"versionId":        ml.VersionID,
		"name":             ml.Name,
		"limitConfig":      ml.LimitConfig, // Keep original for compatibility
		"penaltyWeight":    ml.PenaltyWeight,
		"isHardConstraint": ml.IsHardConstraint,
		"effectiveFrom":    ml.EffectiveFrom,
		"effectiveUntil":   ml.EffectiveUntil,
		"isActive":         ml.IsActive,
		"createdAt":        ml.CreatedAt,
		"updatedAt":        ml.UpdatedAt,
	}

	// ✅ FIX: Extract nested fields from limit_config JSONB to top-level properties
	// React's LimitsTab.jsx expects these at top level, not nested inside limitConfig
	if ml.LimitConfig != nil {
		if limitType, ok := ml.LimitConfig["limitType"]; ok {
			result["limitType"] = limitType
		}
		if minCount, ok := ml.LimitConfig["minCount"]; ok {
			result["minCount"] = minCount
		}
		if maxCount, ok := ml.LimitConfig["maxCount"]; ok {
			result["maxCount"] = maxCount
		}
		if excludeCalendarRules, ok := ml.LimitConfig["excludeCalendarRules"]; ok {
			result["excludeCalendarRules"] = excludeCalendarRules
		}
		if excludeEarlyShiftCalendar, ok := ml.LimitConfig["excludeEarlyShiftCalendar"]; ok {
			result["excludeEarlyShiftCalendar"] = excludeEarlyShiftCalendar
		}
		if overrideWeeklyLimits, ok := ml.LimitConfig["overrideWeeklyLimits"]; ok {
			result["overrideWeeklyLimits"] = overrideWeeklyLimits
		}
		if countHalfDays, ok := ml.LimitConfig["countHalfDays"]; ok {
			result["countHalfDays"] = countHalfDays
		}
		if scope, ok := ml.LimitConfig["scope"]; ok {
			result["scope"] = scope
		}
		if targetIds, ok := ml.LimitConfig["targetIds"]; ok {
			result["targetIds"] = targetIds
		}
		if distributionRules, ok := ml.LimitConfig["distributionRules"]; ok {
			result["distributionRules"] = distributionRules
		}
	}

	return result
}

// PriorityRule represents scheduling priority rules
type PriorityRule struct {
	ID               string                 `json:"id"`
	RestaurantID     string                 `json:"restaurant_id"` // Fixed: Match Supabase snake_case
	VersionID        string                 `json:"version_id"`    // Fixed: Match Supabase snake_case
	StaffID          *string                `json:"staff_id"`      // ✅ FIX: Added to read from database column
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	PriorityLevel    int                    `json:"priority_level"`     // Fixed: Match Supabase snake_case
	RuleDefinition   map[string]interface{} `json:"rule_definition"`    // Fixed: Match Supabase snake_case (CRITICAL!)
	RuleConfig       map[string]interface{} `json:"rule_config"`        // Fixed: Match Supabase snake_case
	PenaltyWeight    float64                `json:"penalty_weight"`     // Fixed: Match Supabase snake_case
	IsHardConstraint bool                   `json:"is_hard_constraint"` // Fixed: Match Supabase snake_case
	EffectiveFrom    *time.Time             `json:"effective_from"`     // Fixed: Match Supabase snake_case
	EffectiveUntil   *time.Time             `json:"effective_until"`    // Fixed: Match Supabase snake_case
	IsActive         bool                   `json:"is_active"`          // Fixed: Match Supabase snake_case
	CreatedAt        time.Time              `json:"created_at"`         // Fixed: Match Supabase snake_case
	UpdatedAt        time.Time              `json:"updated_at"`         // Fixed: Match Supabase snake_case
}

// ToReactFormat converts snake_case to camelCase for React
// AND extracts nested JSONB fields to top-level for easier React access
func (pr *PriorityRule) ToReactFormat() map[string]interface{} {
	result := map[string]interface{}{
		"id":               pr.ID,
		"restaurantId":     pr.RestaurantID,
		"versionId":        pr.VersionID,
		"name":             pr.Name,
		"description":      pr.Description,
		"priorityLevel":    pr.PriorityLevel,
		"ruleDefinition":   pr.RuleDefinition, // Keep original for compatibility
		"ruleConfig":       pr.RuleConfig,
		"penaltyWeight":    pr.PenaltyWeight,
		"isHardConstraint": pr.IsHardConstraint,
		"effectiveFrom":    pr.EffectiveFrom,
		"effectiveUntil":   pr.EffectiveUntil,
		"isActive":         pr.IsActive,
		"createdAt":        pr.CreatedAt,
		"updatedAt":        pr.UpdatedAt,
	}

	// ✅ FIX: Extract nested fields from rule_definition JSONB to top-level properties
	// React's useAISettings expects staffId, shiftType, daysOfWeek at top level
	log.Printf("🔍 [ToReactFormat] Rule '%s': RuleDefinition length = %d", pr.Name, len(pr.RuleDefinition))
	log.Printf("🔍 [ToReactFormat] RuleDefinition content: %+v", pr.RuleDefinition)

	// ✅ FIX: Extract staffId from direct StaffID field FIRST (database column takes priority)
	if pr.StaffID != nil {
		result["staffId"] = *pr.StaffID
		log.Printf("✅ [ToReactFormat] Extracted staffId from direct StaffID field: %v", *pr.StaffID)
	}

	if len(pr.RuleDefinition) > 0 {
		defMap := pr.RuleDefinition

		// Fallback: Extract staffId from JSONB only if not already set from direct field
		if _, exists := result["staffId"]; !exists {
			if staffID, exists := defMap["staff_id"]; exists {
				result["staffId"] = staffID
				log.Printf("✅ [ToReactFormat] Extracted staffId from JSONB staff_id: %v", staffID)
			} else if staffID, exists := defMap["staffId"]; exists {
				result["staffId"] = staffID
				log.Printf("✅ [ToReactFormat] Extracted staffId from JSONB staffId: %v", staffID)
			} else {
				log.Printf("⚠️ [ToReactFormat] staffId NOT FOUND in RuleDefinition (checked both staff_id and staffId)")
			}
		}

		// ✅ NEW: Extract staffIds ARRAY from JSONB (multiple staff member support)
		// This is the PRIMARY field - React expects staffIds array for multiple staff members
		if staffIDs, exists := defMap["staff_ids"]; exists {
			result["staffIds"] = staffIDs
			log.Printf("✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: %v", staffIDs)
		} else if staffIDs, exists := defMap["staffIds"]; exists {
			result["staffIds"] = staffIDs
			log.Printf("✅ [ToReactFormat] Extracted staffIds array from JSONB staffIds: %v", staffIDs)
		} else if staffID, exists := result["staffId"]; exists && staffID != nil {
			// Fallback: Convert single staffId to array for consistency
			result["staffIds"] = []interface{}{staffID}
			log.Printf("✅ [ToReactFormat] Converted single staffId to array: %v", []interface{}{staffID})
		} else {
			log.Printf("⚠️ [ToReactFormat] staffIds array NOT FOUND in RuleDefinition - rule will have no staff members")
		}

		// Extract type or ruleType → ruleType
		if ruleType, exists := defMap["type"]; exists {
			result["ruleType"] = ruleType
			log.Printf("✅ [ToReactFormat] Extracted ruleType from type: %v", ruleType)
		} else if ruleType, exists := defMap["ruleType"]; exists {
			result["ruleType"] = ruleType
			log.Printf("✅ [ToReactFormat] Extracted ruleType from ruleType: %v", ruleType)
		}

		// Extract preference_strength or preferenceStrength → preferenceStrength
		if prefStrength, exists := defMap["preference_strength"]; exists {
			result["preferenceStrength"] = prefStrength
		} else if prefStrength, exists := defMap["preferenceStrength"]; exists {
			result["preferenceStrength"] = prefStrength
		}

		// ✅ FIX: Handle both flat structure (from React) and nested conditions object (from old data)
		// Try flat structure first (current format from React)
		if shiftType, exists := defMap["shiftType"]; exists {
			result["shiftType"] = shiftType
			log.Printf("✅ [ToReactFormat] Extracted shiftType from flat structure: %v", shiftType)
		} else if shiftType, exists := defMap["shift_type"]; exists {
			result["shiftType"] = shiftType
			log.Printf("✅ [ToReactFormat] Extracted shiftType from flat snake_case: %v", shiftType)
		}

		if daysOfWeek, exists := defMap["daysOfWeek"]; exists {
			result["daysOfWeek"] = daysOfWeek
			log.Printf("✅ [ToReactFormat] Extracted daysOfWeek from flat structure: %v", daysOfWeek)
		} else if daysOfWeek, exists := defMap["days_of_week"]; exists {
			result["daysOfWeek"] = daysOfWeek
			log.Printf("✅ [ToReactFormat] Extracted daysOfWeek from flat snake_case (days_of_week): %v", daysOfWeek)
		}

		// ✅ NEW: Extract allowedShifts for avoid_shift_with_exceptions rule type
		if allowedShifts, exists := defMap["allowedShifts"]; exists {
			result["allowedShifts"] = allowedShifts
			log.Printf("✅ [ToReactFormat] Extracted allowedShifts from flat structure: %v", allowedShifts)
		} else if allowedShifts, exists := defMap["allowed_shifts"]; exists {
			result["allowedShifts"] = allowedShifts
			log.Printf("✅ [ToReactFormat] Extracted allowedShifts from flat snake_case (allowed_shifts): %v", allowedShifts)
		}

		// Also try nested conditions object (for backward compatibility with old data format)
		if conditions, exists := defMap["conditions"]; exists {
			if condMap, condOk := conditions.(map[string]interface{}); condOk {
				// Only override if not already set from flat structure
				if result["shiftType"] == nil {
					if shiftType, shiftExists := condMap["shift_type"]; shiftExists {
						result["shiftType"] = shiftType
						log.Printf("✅ [ToReactFormat] Extracted shiftType from nested conditions: %v", shiftType)
					}
				}

				if result["daysOfWeek"] == nil {
					if dayOfWeek, dayExists := condMap["day_of_week"]; dayExists {
						result["daysOfWeek"] = dayOfWeek
						log.Printf("✅ [ToReactFormat] Extracted daysOfWeek from nested conditions: %v", dayOfWeek)
					}
				}
			}
		}
	}

	// 🔍 DEBUG: Log final result to see what's being returned
	log.Printf("🔍 [ToReactFormat] Final result for rule '%s':", pr.Name)
	log.Printf("   staffId: %v", result["staffId"])
	log.Printf("   staffIds: %v", result["staffIds"])
	log.Printf("   shiftType: %v", result["shiftType"])
	log.Printf("   daysOfWeek: %v", result["daysOfWeek"])
	log.Printf("   allowedShifts: %v", result["allowedShifts"])
	log.Printf("   ruleType: %v", result["ruleType"])

	return result
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

// ORToolsSolverConfig represents OR-Tools solver configuration
// Note: Uses snake_case JSON tags to match Supabase column names for proper deserialization
type ORToolsSolverConfig struct {
	ID              string                 `json:"id"`
	RestaurantID    string                 `json:"restaurant_id"`
	VersionID       string                 `json:"version_id,omitempty"`
	Name            string                 `json:"name"`
	Preset          string                 `json:"preset"`
	PenaltyWeights  map[string]interface{} `json:"penalty_weights"`
	SolverSettings  map[string]interface{} `json:"solver_settings"`
	HardConstraints map[string]interface{} `json:"hard_constraints"` // Which constraints are strictly enforced
	IsActive        bool                   `json:"is_active"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
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

// BackupAssignment represents a backup staff assignment configuration
type BackupAssignment struct {
	ID             string     `json:"id"`
	RestaurantID   string     `json:"restaurant_id"`
	VersionID      string     `json:"version_id"`
	StaffID        string     `json:"staff_id"`
	GroupID        string     `json:"group_id"`
	AssignmentType string     `json:"assignment_type"`
	PriorityOrder  int        `json:"priority_order"`
	EffectiveFrom  *time.Time `json:"effective_from"`
	EffectiveUntil *time.Time `json:"effective_until"`
	IsActive       bool       `json:"is_active"`
	Notes          *string    `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	CreatedBy      *string    `json:"created_by"`
}

// ToReactFormat converts snake_case to camelCase for React
func (ba *BackupAssignment) ToReactFormat() map[string]interface{} {
	return map[string]interface{}{
		"id":             ba.ID,
		"restaurantId":   ba.RestaurantID,
		"versionId":      ba.VersionID,
		"staffId":        ba.StaffID,
		"groupId":        ba.GroupID,
		"assignmentType": ba.AssignmentType,
		"priority":       ba.PriorityOrder,
		"effectiveFrom":  ba.EffectiveFrom,
		"effectiveUntil": ba.EffectiveUntil,
		"isActive":       ba.IsActive,
		"notes":          ba.Notes,
		"createdAt":      ba.CreatedAt,
		"updatedAt":      ba.UpdatedAt,
		"createdBy":      ba.CreatedBy,
	}
}

// ConfigVersion represents a configuration version
type ConfigVersion struct {
	ID            string    `json:"id"`
	RestaurantID  string    `json:"restaurantId"`
	VersionNumber int       `json:"versionNumber"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	CreatedBy     *string   `json:"createdBy"`
	CreatedAt     time.Time `json:"createdAt"`
	IsActive      bool      `json:"isActive"`
	IsLocked      bool      `json:"isLocked"`
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
		// Use default restaurant ID - "My Restaurant"
		restaurantID = "4a4e4447-3ddc-4790-b2f9-b892722503b3"
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
// 🔧 FIX: Removed is_active filter to include soft-deleted groups in client state
func (s *StaffSyncServer) fetchStaffGroups(versionID string) ([]StaffGroup, error) {
	url := fmt.Sprintf("%s/rest/v1/staff_groups?version_id=eq.%s&select=*",
		s.supabaseURL, versionID)

	// 🔍 DEBUG: Log fetch query details
	log.Printf("🔍 [fetchStaffGroups] Fetching from URL: %s", url)
	log.Printf("🔍 [fetchStaffGroups] Version ID: %s", versionID)

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

	// 🔍 DEBUG: Log raw response from Supabase
	log.Printf("🔍 [fetchStaffGroups] Raw response from Supabase: %s", string(body))

	var groups []StaffGroup
	if err := json.Unmarshal(body, &groups); err != nil {
		log.Printf("❌ [fetchStaffGroups] Failed to parse response: %v", err)
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// 🔍 DEBUG: Log all parsed groups with their members
	log.Printf("🔍 [fetchStaffGroups] Fetched %d staff group(s) from database", len(groups))
	for i, group := range groups {
		log.Printf("   - Group %d: %s (ID: %s, IsActive: %v)", i+1, group.Name, group.ID, group.IsActive)
		if group.GroupConfig != nil {
			if members, ok := group.GroupConfig["members"]; ok {
				log.Printf("     Members in GroupConfig: %+v", members)
			} else {
				log.Printf("     ⚠️ No members field in GroupConfig")
			}
		} else {
			log.Printf("     ⚠️ GroupConfig is nil")
		}
	}

	return groups, nil
}

// fetchWeeklyLimits retrieves weekly limits for a specific version
// 🔧 FIX: Removed is_active filter to include soft-deleted limits in client state
func (s *StaffSyncServer) fetchWeeklyLimits(versionID string) ([]WeeklyLimit, error) {
	url := fmt.Sprintf("%s/rest/v1/weekly_limits?version_id=eq.%s&select=*",
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

	var limits []WeeklyLimit
	if err := json.Unmarshal(body, &limits); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return limits, nil
}

// fetchMonthlyLimits retrieves monthly limits for a specific version
func (s *StaffSyncServer) fetchMonthlyLimits(versionID string) ([]MonthlyLimit, error) {
	// 🔧 FIX: Removed is_active filter to include soft-deleted items in client state
	url := fmt.Sprintf("%s/rest/v1/monthly_limits?version_id=eq.%s&select=*",
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

// fetchDailyLimits retrieves active daily limits for a specific version
// Returns the limit_config JSONB as a map for direct use by React
func (s *StaffSyncServer) fetchDailyLimits(versionID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/rest/v1/daily_limits?version_id=eq.%s&is_active=eq.true&select=limit_config",
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

	// Parse response - expecting array with single object
	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Return limit_config from first result, or empty map if no results
	if len(results) > 0 {
		if limitConfig, ok := results[0]["limit_config"].(map[string]interface{}); ok {
			log.Printf("✅ [fetchDailyLimits] Fetched daily limits: %+v", limitConfig)
			return limitConfig, nil
		}
	}

	// Return default values if no daily limits found
	// NOTE: Global daily limits (minOffPerDay, maxOffPerDay) are DEPRECATED
	// Use staffTypeLimits for per-staff-type constraints instead
	log.Printf("⚠️ [fetchDailyLimits] No daily limits found, returning defaults with staffTypeLimits")
	return map[string]interface{}{
		// DEPRECATED: Global daily limits - kept for backward compatibility but won't be used
		// when staffTypeLimits is configured (auto-disabled in Python scheduler)
		"minOffPerDay":           0,
		"maxOffPerDay":           3,
		"minEarlyPerDay":         0,
		"maxEarlyPerDay":         2,
		"minLatePerDay":          0,
		"maxLatePerDay":          3,
		"minWorkingStaffPerDay":  3,
		// DEFAULT: Staff Type Daily Limits - per-staff-type constraints
		// This is now the PRIMARY constraint method for daily limits
		"staffTypeLimits": map[string]interface{}{
			"社員": map[string]interface{}{
				"maxOff":   1,
				"maxEarly": 2,
				"isHard":   true,
			},
		},
	}, nil
}

// fetchPriorityRules retrieves priority rules for a specific version
func (s *StaffSyncServer) fetchPriorityRules(versionID string) ([]PriorityRule, error) {
	// 🔧 FIX: Removed is_active filter to include soft-deleted items in client state
	// ORDER BY created_at DESC to fetch the LATEST rules (prevents fetching stale/skeleton rules)
	url := fmt.Sprintf("%s/rest/v1/priority_rules?version_id=eq.%s&select=*&order=created_at.desc",
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

	// 🔍 DEBUG: Log raw response from Supabase
	log.Printf("🔍 [fetchPriorityRules] Raw response from Supabase: %s", string(body))

	var rules []PriorityRule
	if err := json.Unmarshal(body, &rules); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// 🔍 DEBUG: Log unmarshaled rules to see if RuleDefinition is populated
	for i, rule := range rules {
		log.Printf("🔍 [fetchPriorityRules] Rule %d '%s': RuleDefinition length = %d", i, rule.Name, len(rule.RuleDefinition))
		if len(rule.RuleDefinition) > 0 {
			log.Printf("   RuleDefinition content: %+v", rule.RuleDefinition)
		} else {
			log.Printf("   ⚠️ RuleDefinition is empty/nil!")
		}
	}

	return rules, nil
}

// fetchSinglePriorityRule retrieves a single priority rule by ID
func (s *StaffSyncServer) fetchSinglePriorityRule(ruleID string, versionID string) (*PriorityRule, error) {
	url := fmt.Sprintf("%s/rest/v1/priority_rules?id=eq.%s&version_id=eq.%s&select=*",
		s.supabaseURL, ruleID, versionID)

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

	if len(rules) == 0 {
		return nil, fmt.Errorf("priority rule not found: %s", ruleID)
	}

	log.Printf("🔍 [fetchSinglePriorityRule] Fetched rule '%s': RuleDefinition length = %d", rules[0].Name, len(rules[0].RuleDefinition))

	return &rules[0], nil
}

// fetchMLModelConfigs retrieves ML model configurations for a specific version
func (s *StaffSyncServer) fetchMLModelConfigs(versionID string) ([]MLModelConfig, error) {
	// 🔧 FIX: Removed is_active filter to include soft-deleted items in client state
	url := fmt.Sprintf("%s/rest/v1/ml_model_configs?version_id=eq.%s&select=*",
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

// fetchBackupAssignments retrieves backup assignments for a specific version
func (s *StaffSyncServer) fetchBackupAssignments(versionID string) ([]BackupAssignment, error) {
	url := fmt.Sprintf("%s/rest/v1/staff_backup_assignments?version_id=eq.%s&select=*",
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

	var assignments []BackupAssignment
	if err := json.Unmarshal(body, &assignments); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	log.Printf("📋 Fetched %d backup assignments from database", len(assignments))
	return assignments, nil
}

// fetchORToolsConfig retrieves OR-Tools solver configurations for the restaurant
// Note: OR-Tools config is restaurant-scoped, not version-scoped
func (s *StaffSyncServer) fetchORToolsConfig(versionID string) ([]ORToolsSolverConfig, error) {
	// Fetch by restaurant_id since OR-Tools config is not version-specific
	restaurantID := s.getRestaurantID()
	url := fmt.Sprintf("%s/rest/v1/ortools_solver_config?restaurant_id=eq.%s&is_active=eq.true&select=*",
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

	var configs []ORToolsSolverConfig
	if err := json.Unmarshal(body, &configs); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	log.Printf("🔧 Fetched %d OR-Tools solver configs from database", len(configs))
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

	weeklyLimits, err := s.fetchWeeklyLimits(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch weekly limits: %v", err)
		weeklyLimits = []WeeklyLimit{}
	}

	monthlyLimits, err := s.fetchMonthlyLimits(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch monthly limits: %v", err)
		monthlyLimits = []MonthlyLimit{}
	}

	dailyLimits, err := s.fetchDailyLimits(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch daily limits: %v", err)
		// Use staffTypeLimits as the default constraint method
		dailyLimits = map[string]interface{}{
			// DEPRECATED: Global daily limits (kept for backward compatibility)
			"minOffPerDay":          0,
			"maxOffPerDay":          3,
			"minEarlyPerDay":        0,
			"maxEarlyPerDay":        2,
			"minLatePerDay":         0,
			"maxLatePerDay":         3,
			"minWorkingStaffPerDay": 3,
			// DEFAULT: Staff Type Daily Limits - the PRIMARY constraint method
			"staffTypeLimits": map[string]interface{}{
				"社員": map[string]interface{}{
					"maxOff":   1,
					"maxEarly": 2,
					"isHard":   true,
				},
			},
		}
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

	backupAssignments, err := s.fetchBackupAssignments(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch backup assignments: %v", err)
		backupAssignments = []BackupAssignment{}
	}

	ortoolsConfig, err := s.fetchORToolsConfig(versionID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch OR-Tools configs: %v", err)
		ortoolsConfig = []ORToolsSolverConfig{}
	}

	// 🔍 DEBUG: Log aggregated settings summary
	log.Printf("🔍 [fetchAggregatedSettings] Successfully aggregated settings for version %s:", versionID)
	log.Printf("   - Staff Groups: %d", len(staffGroups))
	log.Printf("   - Weekly Limits: %d", len(weeklyLimits))
	log.Printf("   - Monthly Limits: %d", len(monthlyLimits))
	log.Printf("   - Daily Limits: %+v", dailyLimits)
	log.Printf("   - Priority Rules: %d", len(priorityRules))
	log.Printf("   - Backup Assignments: %d", len(backupAssignments))
	log.Printf("   - ML Configs: %d", len(mlConfigs))
	log.Printf("   - OR-Tools Configs: %d", len(ortoolsConfig))

	return &SettingsAggregate{
		StaffGroups:       staffGroups,
		WeeklyLimits:      weeklyLimits,
		MonthlyLimits:     monthlyLimits,
		DailyLimits:       dailyLimits,
		PriorityRules:     priorityRules,
		BackupAssignments: backupAssignments,
		MLModelConfigs:    mlConfigs,
		ORToolsConfig:     ortoolsConfig,
		Version:           *version,
	}, nil
}

// ============================================================================
// UPDATE OPERATIONS - Table-Specific Updates with Audit Logging
// ============================================================================

// upsertStaffGroup attempts to update a staff group, returns number of rows affected
// Returns (rowsAffected int, error)
func (s *StaffSyncServer) upsertStaffGroup(versionID string, groupData map[string]interface{}) (int, error) {
	groupID, ok := groupData["id"].(string)
	if !ok {
		return 0, fmt.Errorf("missing or invalid group id")
	}

	// 🔍 DEBUG: Log what we received from React
	log.Printf("🔍 [upsertStaffGroup] Received groupData: %+v", groupData)
	if members, ok := groupData["members"]; ok {
		log.Printf("🔍 [upsertStaffGroup] Members field present: %+v", members)
	} else {
		log.Printf("⚠️ [upsertStaffGroup] Members field MISSING from groupData")
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
	if groupConfig, ok := groupData["groupConfig"].(map[string]interface{}); ok {
		if members, membersOk := groupData["members"]; membersOk {
			groupConfig["members"] = members
		}
		updateData["group_config"] = groupConfig
	} else {
		if members, membersOk := groupData["members"]; membersOk {
			updateData["group_config"] = map[string]interface{}{
				"members": members,
			}
		} else if groupData["groupConfig"] != nil {
			updateData["group_config"] = groupData["groupConfig"]
		}
	}

	// Always update timestamp
	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	log.Printf("🔍 [upsertStaffGroup] Sending to Supabase: %+v", updateData)

	jsonData, _ := json.Marshal(updateData)

	log.Printf("🔍 [SQL DEBUG] PATCH URL: %s", url)
	log.Printf("🔍 [SQL DEBUG] Request body: %s", string(jsonData))

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	// 🔧 UPSERT FIX: Use return=representation to get actual data back
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [upsertStaffGroup] HTTP request failed: %v", err)
		return 0, fmt.Errorf("failed to update staff group: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	log.Printf("🔍 [upsertStaffGroup] HTTP Response Status: %d", resp.StatusCode)
	log.Printf("🔍 [SQL DEBUG] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [upsertStaffGroup] Update failed with status %d: %s", resp.StatusCode, string(body))
		return 0, fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Check if any rows were affected by parsing the response
	// With return=representation, empty array [] means 0 rows affected
	var result []map[string]interface{}
	if err := json.Unmarshal(body, &result); err == nil {
		rowsAffected := len(result)
		log.Printf("✅ [upsertStaffGroup] Rows affected: %d", rowsAffected)
		return rowsAffected, nil
	}

	// If we can't parse, assume success (backward compatibility)
	log.Printf("⚠️ [upsertStaffGroup] Could not parse response, assuming 1 row affected")
	return 1, nil
}

// createStaffGroup inserts a new staff group into the database
func (s *StaffSyncServer) createStaffGroup(versionID string, groupData map[string]interface{}) error {
	groupID, ok := groupData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid group id")
	}

	log.Printf("🔍 [createStaffGroup] Creating new group: %s", groupID)

	url := fmt.Sprintf("%s/rest/v1/staff_groups", s.supabaseURL)

	// Prepare insert data
	insertData := make(map[string]interface{})
	insertData["id"] = groupID
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()

	if name, ok := groupData["name"]; ok {
		insertData["name"] = name
	}
	if description, ok := groupData["description"]; ok {
		insertData["description"] = description
	}
	if color, ok := groupData["color"]; ok {
		insertData["color"] = color
	}

	// Handle members field
	if groupConfig, ok := groupData["groupConfig"].(map[string]interface{}); ok {
		if members, membersOk := groupData["members"]; membersOk {
			groupConfig["members"] = members
		}
		insertData["group_config"] = groupConfig
	} else {
		if members, membersOk := groupData["members"]; membersOk {
			insertData["group_config"] = map[string]interface{}{
				"members": members,
			}
		}
	}

	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	log.Printf("🔍 [createStaffGroup] Insert data: %+v", insertData)

	jsonData, _ := json.Marshal(insertData)
	log.Printf("🔍 [SQL DEBUG] POST URL: %s", url)
	log.Printf("🔍 [SQL DEBUG] Request body: %s", string(jsonData))

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
		log.Printf("❌ [createStaffGroup] HTTP request failed: %v", err)
		return fmt.Errorf("failed to create staff group: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	log.Printf("🔍 [createStaffGroup] HTTP Response Status: %d", resp.StatusCode)
	log.Printf("🔍 [SQL DEBUG] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("❌ [createStaffGroup] Create failed with status %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("create failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [createStaffGroup] Successfully created staff group in database")
	return nil
}

// updateStaffGroup updates a staff group in the database (legacy - kept for compatibility)
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

	// 🔍 DEBUG: Log SQL query details
	log.Printf("🔍 [SQL DEBUG] PATCH URL: %s", url)
	log.Printf("🔍 [SQL DEBUG] Request body: %s", string(jsonData))

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
		log.Printf("❌ [updateStaffGroup] HTTP request failed: %v", err)
		return fmt.Errorf("failed to update staff group: %w", err)
	}
	defer resp.Body.Close()

	// Read response body for logging
	body, _ := io.ReadAll(resp.Body)

	// 🔍 DEBUG: Log HTTP response status and body
	log.Printf("🔍 [updateStaffGroup] HTTP Response Status: %d", resp.StatusCode)
	log.Printf("🔍 [SQL DEBUG] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [updateStaffGroup] Update failed with status %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [updateStaffGroup] Successfully updated staff group in database")
	return nil
}

// updateWeeklyLimit updates a weekly limit in the database (internal - use upsertWeeklyLimit instead)
// Weekly limits track shift symbol occurrences over rolling 7-day periods
// Returns (rowsAffected, error) to support UPSERT logic
func (s *StaffSyncServer) updateWeeklyLimit(versionID string, limitData map[string]interface{}) (int, error) {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return 0, fmt.Errorf("missing or invalid limit id")
	}

	log.Printf("🔍 [updateWeeklyLimit] Received limitData: %+v", limitData)

	url := fmt.Sprintf("%s/rest/v1/weekly_limits?id=eq.%s&version_id=eq.%s",
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

	log.Printf("🔍 [updateWeeklyLimit] Sending to Supabase: %+v", updateData)

	jsonData, _ := json.Marshal(updateData)

	log.Printf("🔍 [SQL DEBUG] PATCH URL: %s", url)
	log.Printf("🔍 [SQL DEBUG] Request body: %s", string(jsonData))

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	// 🔧 UPSERT FIX: Use return=representation to get actual data back
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [updateWeeklyLimit] HTTP request failed: %v", err)
		return 0, fmt.Errorf("failed to update weekly limit: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	log.Printf("🔍 [updateWeeklyLimit] HTTP Response Status: %d", resp.StatusCode)
	log.Printf("🔍 [SQL DEBUG] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [updateWeeklyLimit] Update failed with status %d: %s", resp.StatusCode, string(body))
		return 0, fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Check if any rows were affected by parsing the response
	// With return=representation, empty array [] means 0 rows affected
	var result []map[string]interface{}
	if err := json.Unmarshal(body, &result); err == nil {
		rowsAffected := len(result)
		log.Printf("✅ [updateWeeklyLimit] Rows affected: %d", rowsAffected)
		return rowsAffected, nil
	}

	// If we can't parse, assume success (backward compatibility)
	log.Printf("⚠️ [updateWeeklyLimit] Could not parse response, assuming 1 row affected")
	return 1, nil
}

// upsertWeeklyLimit attempts to update, falls back to create if limit doesn't exist
// Returns (rowsAffected, error) - use this for all weekly limit modifications
func (s *StaffSyncServer) upsertWeeklyLimit(versionID string, limitData map[string]interface{}) (int, error) {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return 0, fmt.Errorf("missing or invalid limit id")
	}

	log.Printf("🔧 [upsertWeeklyLimit] Attempting UPSERT for limit: %s", limitID)

	// Try UPDATE first
	rowsAffected, err := s.updateWeeklyLimit(versionID, limitData)
	if err != nil {
		log.Printf("❌ [upsertWeeklyLimit] Update failed: %v", err)
		return 0, err
	}

	// If 0 rows affected, the limit doesn't exist yet - CREATE it
	if rowsAffected == 0 {
		log.Printf("🔧 [upsertWeeklyLimit] 0 rows updated, creating new limit...")
		err := s.createWeeklyLimit(versionID, limitData)
		if err != nil {
			log.Printf("❌ [upsertWeeklyLimit] Create failed: %v", err)
			return 0, err
		}
		return 1, nil
	}

	log.Printf("✅ [upsertWeeklyLimit] Successfully updated %d row(s)", rowsAffected)
	return rowsAffected, nil
}

// createWeeklyLimit inserts a new weekly limit into the database
// Weekly limits constrain shift symbols over rolling 7-day periods (e.g., max 2 day-offs in any 7-day window)
func (s *StaffSyncServer) createWeeklyLimit(versionID string, limitData map[string]interface{}) error {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid limit id")
	}

	log.Printf("🔍 [createWeeklyLimit] Creating new weekly limit: %s", limitID)

	url := fmt.Sprintf("%s/rest/v1/weekly_limits", s.supabaseURL)

	// Prepare insert data with snake_case field names
	insertData := make(map[string]interface{})
	insertData["id"] = limitID
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()

	if name, ok := limitData["name"]; ok {
		insertData["name"] = name
	}
	if limitConfig, ok := limitData["limitConfig"]; ok {
		insertData["limit_config"] = limitConfig
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		insertData["penalty_weight"] = penaltyWeight
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		insertData["is_hard_constraint"] = isHardConstraint
	}
	if effectiveFrom, ok := limitData["effectiveFrom"]; ok {
		insertData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := limitData["effectiveUntil"]; ok {
		insertData["effective_until"] = effectiveUntil
	}

	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(insertData)
	log.Printf("🔍 [createWeeklyLimit] Insert data: %s", string(jsonData))

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create weekly limit: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("🔍 [createWeeklyLimit] Response status: %d, body: %s", resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("create failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [createWeeklyLimit] Successfully created weekly limit in database")
	return nil
}

// upsertDailyLimits upserts daily limits (singleton per version_id)
// Daily limits are a singleton configuration - one row per version
// Uses JSONB limit_config column to store all daily limit values
func (s *StaffSyncServer) upsertDailyLimits(versionID string, limitData map[string]interface{}) error {
	log.Printf("🔧 [upsertDailyLimits] Upserting daily limits for version: %s", versionID)
	log.Printf("🔍 [upsertDailyLimits] Received limitData: %+v", limitData)

	url := fmt.Sprintf("%s/rest/v1/daily_limits", s.supabaseURL)

	// Prepare upsert data - daily limits uses JSONB limit_config column
	upsertData := make(map[string]interface{})
	upsertData["version_id"] = versionID
	upsertData["restaurant_id"] = s.getRestaurantID()
	upsertData["name"] = "Default Daily Limits"

	// Store all daily limit values in the limit_config JSONB column
	// Keep camelCase for React compatibility
	limitConfig := make(map[string]interface{})
	if minOffPerDay, ok := limitData["minOffPerDay"]; ok {
		limitConfig["minOffPerDay"] = minOffPerDay
	}
	if maxOffPerDay, ok := limitData["maxOffPerDay"]; ok {
		limitConfig["maxOffPerDay"] = maxOffPerDay
	}
	if minEarlyPerDay, ok := limitData["minEarlyPerDay"]; ok {
		limitConfig["minEarlyPerDay"] = minEarlyPerDay
	}
	if maxEarlyPerDay, ok := limitData["maxEarlyPerDay"]; ok {
		limitConfig["maxEarlyPerDay"] = maxEarlyPerDay
	}
	if minLatePerDay, ok := limitData["minLatePerDay"]; ok {
		limitConfig["minLatePerDay"] = minLatePerDay
	}
	if maxLatePerDay, ok := limitData["maxLatePerDay"]; ok {
		limitConfig["maxLatePerDay"] = maxLatePerDay
	}
	if minWorkingStaffPerDay, ok := limitData["minWorkingStaffPerDay"]; ok {
		limitConfig["minWorkingStaffPerDay"] = minWorkingStaffPerDay
	}

	// ✅ FIX: Preserve staffTypeLimits when embedded in dailyLimits
	// React sends staffTypeLimits embedded in dailyLimits for server sync
	// This ensures per-staff-type constraints (社員, 派遣, パート) persist
	if staffTypeLimits, ok := limitData["staffTypeLimits"]; ok {
		limitConfig["staffTypeLimits"] = staffTypeLimits
		log.Printf("✅ [upsertDailyLimits] Preserving staffTypeLimits: %+v", staffTypeLimits)
	}

	upsertData["limit_config"] = limitConfig

	// Optional metadata fields
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		upsertData["penalty_weight"] = penaltyWeight
	} else {
		upsertData["penalty_weight"] = 1.0
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		upsertData["is_hard_constraint"] = isHardConstraint
	} else {
		upsertData["is_hard_constraint"] = false
	}
	if effectiveFrom, ok := limitData["effectiveFrom"]; ok {
		upsertData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := limitData["effectiveUntil"]; ok {
		upsertData["effective_until"] = effectiveUntil
	}

	upsertData["is_active"] = true
	upsertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(upsertData)
	log.Printf("🔍 [upsertDailyLimits] Upsert data: %s", string(jsonData))

	// Strategy: First try to UPDATE existing row with matching version_id
	// If no rows updated, then INSERT new row

	// Step 1: Try to update existing row
	updateURL := fmt.Sprintf("%s?version_id=eq.%s", url, versionID)
	updateReq, err := http.NewRequest("PATCH", updateURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create update request: %w", err)
	}

	updateReq.Header.Set("apikey", s.supabaseKey)
	updateReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	updateResp, err := client.Do(updateReq)
	if err != nil {
		return fmt.Errorf("failed to update daily limits: %w", err)
	}
	defer updateResp.Body.Close()

	updateBody, _ := io.ReadAll(updateResp.Body)
	log.Printf("🔍 [upsertDailyLimits] UPDATE response status: %d, body: %s", updateResp.StatusCode, string(updateBody))

	// If update was successful and affected rows, we're done
	if updateResp.StatusCode == http.StatusOK && len(updateBody) > 2 && string(updateBody) != "[]" {
		log.Printf("✅ [upsertDailyLimits] Successfully updated existing daily limits")
		return nil
	}

	// Step 2: If no rows were updated, insert a new row
	log.Printf("🔍 [upsertDailyLimits] No existing row found, inserting new row")
	insertReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create insert request: %w", err)
	}

	insertReq.Header.Set("apikey", s.supabaseKey)
	insertReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	insertReq.Header.Set("Content-Type", "application/json")
	insertReq.Header.Set("Prefer", "return=representation")

	insertResp, err := client.Do(insertReq)
	if err != nil {
		return fmt.Errorf("failed to insert daily limits: %w", err)
	}
	defer insertResp.Body.Close()

	insertBody, _ := io.ReadAll(insertResp.Body)
	log.Printf("🔍 [upsertDailyLimits] INSERT response status: %d, body: %s", insertResp.StatusCode, string(insertBody))

	if insertResp.StatusCode != http.StatusOK && insertResp.StatusCode != http.StatusCreated {
		return fmt.Errorf("insert failed with status %d: %s", insertResp.StatusCode, string(insertBody))
	}

	log.Printf("✅ [upsertDailyLimits] Successfully inserted new daily limits")
	return nil
}

// updateMonthlyLimit updates a monthly limit in the database using UPSERT pattern
// First tries UPDATE, if no rows affected, then INSERTs new record
func (s *StaffSyncServer) updateMonthlyLimit(versionID string, limitData map[string]interface{}) error {
	limitID, ok := limitData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid limit id")
	}

	log.Printf("🔍 [upsertMonthlyLimit] Processing monthly limit: %s", limitID)
	log.Printf("🔍 [upsertMonthlyLimit] Limit data: %+v", limitData)

	url := fmt.Sprintf("%s/rest/v1/monthly_limits", s.supabaseURL)

	// Prepare upsert data (same structure as daily limits)
	upsertData := make(map[string]interface{})
	upsertData["id"] = limitID
	upsertData["version_id"] = versionID
	upsertData["restaurant_id"] = s.getRestaurantID()

	if name, ok := limitData["name"]; ok {
		upsertData["name"] = name
	} else {
		upsertData["name"] = "New Monthly Limit"
	}
	// ✅ FIX: React sends minCount, maxCount etc. at TOP LEVEL, not inside limitConfig
	// When limitConfig exists, we MUST merge top-level values (minCount, maxCount) into it
	// because React sends updated values at top level while limitConfig contains old values
	if limitConfig, ok := limitData["limitConfig"]; ok && limitConfig != nil {
		// Convert limitConfig to map so we can modify it
		configMap, isMap := limitConfig.(map[string]interface{})
		if isMap {
			// ✅ CRITICAL FIX: Top-level values take PRECEDENCE over limitConfig values
			// This ensures user updates (e.g., maxCount from 7.5 to 8) are persisted
			if minCount, hasMin := limitData["minCount"]; hasMin {
				configMap["minCount"] = minCount
				log.Printf("✅ [upsertMonthlyLimit] Overriding limitConfig.minCount with top-level value: %v", minCount)
			}
			if maxCount, hasMax := limitData["maxCount"]; hasMax {
				configMap["maxCount"] = maxCount
				log.Printf("✅ [upsertMonthlyLimit] Overriding limitConfig.maxCount with top-level value: %v", maxCount)
			}
			// Also merge other top-level fields that might have been updated
			if excludeCalendarRules, ok := limitData["excludeCalendarRules"]; ok {
				configMap["excludeCalendarRules"] = excludeCalendarRules
			}
			if excludeEarlyShiftCalendar, ok := limitData["excludeEarlyShiftCalendar"]; ok {
				configMap["excludeEarlyShiftCalendar"] = excludeEarlyShiftCalendar
			}
			if overrideWeeklyLimits, ok := limitData["overrideWeeklyLimits"]; ok {
				configMap["overrideWeeklyLimits"] = overrideWeeklyLimits
			}
			if countHalfDays, ok := limitData["countHalfDays"]; ok {
				configMap["countHalfDays"] = countHalfDays
			}
			if scope, ok := limitData["scope"]; ok {
				configMap["scope"] = scope
			}
			if targetIds, ok := limitData["targetIds"]; ok {
				configMap["targetIds"] = targetIds
			}
			if distributionRules, ok := limitData["distributionRules"]; ok {
				configMap["distributionRules"] = distributionRules
			}
			upsertData["limit_config"] = configMap
			log.Printf("✅ [upsertMonthlyLimit] Merged top-level values into limitConfig: %+v", configMap)
		} else {
			// limitConfig exists but isn't a map, use it as-is
			upsertData["limit_config"] = limitConfig
			log.Printf("⚠️ [upsertMonthlyLimit] limitConfig is not a map, using as-is: %v", limitConfig)
		}
	} else {
		// Build limit_config from top-level fields (React LimitsTab.jsx sends data at top level)
		constructedConfig := map[string]interface{}{
			"limitType":  "off_days",
			"staffIds":   []string{},
			"shiftTypes": []string{"×"},
		}

		// Extract top-level fields that should be in limit_config
		if limitType, ok := limitData["limitType"]; ok {
			constructedConfig["limitType"] = limitType
		}
		if minCount, ok := limitData["minCount"]; ok {
			constructedConfig["minCount"] = minCount
			log.Printf("✅ [upsertMonthlyLimit] Found minCount at top level: %v", minCount)
		} else {
			constructedConfig["minCount"] = 7 // default
		}
		if maxCount, ok := limitData["maxCount"]; ok {
			constructedConfig["maxCount"] = maxCount
			log.Printf("✅ [upsertMonthlyLimit] Found maxCount at top level: %v", maxCount)
		} else {
			constructedConfig["maxCount"] = 8 // default
		}
		// Extract additional fields added in Phase 6 Monthly Limits Enhancement
		if excludeCalendarRules, ok := limitData["excludeCalendarRules"]; ok {
			constructedConfig["excludeCalendarRules"] = excludeCalendarRules
		}
		if excludeEarlyShiftCalendar, ok := limitData["excludeEarlyShiftCalendar"]; ok {
			constructedConfig["excludeEarlyShiftCalendar"] = excludeEarlyShiftCalendar
		}
		if overrideWeeklyLimits, ok := limitData["overrideWeeklyLimits"]; ok {
			constructedConfig["overrideWeeklyLimits"] = overrideWeeklyLimits
		}
		if countHalfDays, ok := limitData["countHalfDays"]; ok {
			constructedConfig["countHalfDays"] = countHalfDays
		}
		if scope, ok := limitData["scope"]; ok {
			constructedConfig["scope"] = scope
		}
		if targetIds, ok := limitData["targetIds"]; ok {
			constructedConfig["targetIds"] = targetIds
		}
		// Distribution rules
		if distributionRules, ok := limitData["distributionRules"]; ok {
			constructedConfig["distributionRules"] = distributionRules
		}

		upsertData["limit_config"] = constructedConfig
		log.Printf("✅ [upsertMonthlyLimit] Constructed limit_config from top-level fields: %+v", constructedConfig)
	}
	if penaltyWeight, ok := limitData["penaltyWeight"]; ok {
		upsertData["penalty_weight"] = penaltyWeight
	} else {
		upsertData["penalty_weight"] = 1.0
	}
	if isHardConstraint, ok := limitData["isHardConstraint"]; ok {
		upsertData["is_hard_constraint"] = isHardConstraint
	} else {
		upsertData["is_hard_constraint"] = false
	}
	if effectiveFrom, ok := limitData["effectiveFrom"]; ok {
		upsertData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := limitData["effectiveUntil"]; ok {
		upsertData["effective_until"] = effectiveUntil
	}

	upsertData["is_active"] = true
	upsertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(upsertData)
	log.Printf("🔍 [upsertMonthlyLimit] Upsert data: %s", string(jsonData))

	// Strategy: First try to UPDATE existing row with matching id and version_id
	// If no rows updated, then INSERT new row

	// Step 1: Try to update existing row
	updateURL := fmt.Sprintf("%s?id=eq.%s&version_id=eq.%s", url, limitID, versionID)
	updateReq, err := http.NewRequest("PATCH", updateURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create update request: %w", err)
	}

	updateReq.Header.Set("apikey", s.supabaseKey)
	updateReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	updateResp, err := client.Do(updateReq)
	if err != nil {
		return fmt.Errorf("failed to update monthly limit: %w", err)
	}
	defer updateResp.Body.Close()

	updateBody, _ := io.ReadAll(updateResp.Body)
	log.Printf("🔍 [upsertMonthlyLimit] UPDATE response status: %d, body: %s", updateResp.StatusCode, string(updateBody))

	// If update was successful and affected rows, we're done
	if updateResp.StatusCode == http.StatusOK && len(updateBody) > 2 && string(updateBody) != "[]" {
		log.Printf("✅ [upsertMonthlyLimit] Successfully updated existing monthly limit")
		return nil
	}

	// Step 2: If no rows were updated, insert a new row
	log.Printf("🔍 [upsertMonthlyLimit] No existing row found, inserting new row")

	// Add created_at for new record
	upsertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	jsonData, _ = json.Marshal(upsertData)

	insertReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create insert request: %w", err)
	}

	insertReq.Header.Set("apikey", s.supabaseKey)
	insertReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	insertReq.Header.Set("Content-Type", "application/json")
	insertReq.Header.Set("Prefer", "return=representation")

	insertResp, err := client.Do(insertReq)
	if err != nil {
		return fmt.Errorf("failed to insert monthly limit: %w", err)
	}
	defer insertResp.Body.Close()

	insertBody, _ := io.ReadAll(insertResp.Body)
	log.Printf("🔍 [upsertMonthlyLimit] INSERT response status: %d, body: %s", insertResp.StatusCode, string(insertBody))

	if insertResp.StatusCode != http.StatusOK && insertResp.StatusCode != http.StatusCreated {
		return fmt.Errorf("insert failed with status %d: %s", insertResp.StatusCode, string(insertBody))
	}

	log.Printf("✅ [upsertMonthlyLimit] Successfully inserted new monthly limit")
	return nil
}

// updatePriorityRule updates a priority rule in the database
func (s *StaffSyncServer) updatePriorityRule(versionID string, ruleData map[string]interface{}) error {
	ruleID, ok := ruleData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid rule id")
	}

	// 🔍 DEBUG: Log what we received from React
	log.Printf("🔍 [updatePriorityRule] Received ruleData: %+v", ruleData)

	// ✅ FIX: Smart temporary ID handling with mapping
	// Check if this is a temporary ID we've already seen and mapped
	if strings.HasPrefix(ruleID, "priority-rule-") {
		if dbUUID, ok := s.tempIDMap.Load(ruleID); ok {
			// We've seen this temp ID before - use the database UUID for UPDATE
			ruleID = dbUUID.(string)
			log.Printf("🔗 [updatePriorityRule] Translated temp ID to DB UUID: '%s'", ruleID)
		} else {
			// First time seeing this temp ID - route to INSERT
			log.Printf("🔍 [updatePriorityRule] New temp ID '%s', routing to INSERT", ruleID)
			return s.insertPriorityRule(versionID, ruleData)
		}
	}

	log.Printf("🔍 [updatePriorityRule] Updating existing rule with ID '%s'", ruleID)

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

	// ✅ FIX: Fetch existing rule_definition from database to preserve data on incremental updates
	// React may send only partial updates (e.g., just { name: "new name" })
	// We need to preserve existing staffId, shiftType, daysOfWeek, etc.
	ruleDefinition := make(map[string]interface{})

	// Fetch current rule from database to get existing rule_definition
	currentRule, err := s.fetchSinglePriorityRule(ruleID, versionID)
	if err != nil {
		log.Printf("⚠️ [updatePriorityRule] Failed to fetch existing rule (will create new rule_definition): %v", err)
	} else if currentRule != nil && len(currentRule.RuleDefinition) > 0 {
		// Start with existing rule_definition from database
		ruleDefinition = currentRule.RuleDefinition
		log.Printf("🔍 [updatePriorityRule] Preserving existing rule_definition: %+v", ruleDefinition)
	}

	// Override with ruleDefinition from payload if present
	if existingDef, ok := ruleData["ruleDefinition"].(map[string]interface{}); ok {
		// Merge payload ruleDefinition (don't completely replace)
		for k, v := range existingDef {
			ruleDefinition[k] = v
		}
		log.Printf("🔍 [updatePriorityRule] Merged payload ruleDefinition")
	}

	// Merge top-level fields into rule_definition with proper nested structure
	// ✅ NEW: Support multiple staff members via staffIds array
	// Staff IDs stored in rule_definition.staff_ids JSONB (database has no top-level staff_id column)
	if staffIds, ok := ruleData["staffIds"].([]interface{}); ok {
		// New format: staffIds array
		ruleDefinition["staff_ids"] = staffIds
		log.Printf("🔍 [updatePriorityRule] Merging staffIds array: %v", staffIds)
	} else if staffId, ok := ruleData["staffId"]; ok {
		// Legacy format: single staffId
		// ✅ FIX: Convert empty string to nil for UUID column validation
		var staffIdValue interface{}
		if staffIdStr, isString := staffId.(string); isString && staffIdStr == "" {
			staffIdValue = nil
			log.Printf("🔍 [updatePriorityRule] Empty staffId string, setting to nil")
		} else {
			staffIdValue = staffId
		}

		ruleDefinition["staff_id"] = staffIdValue
		// Also convert single staffId to staff_ids array for new format
		if staffIdValue != nil {
			ruleDefinition["staff_ids"] = []interface{}{staffIdValue}
		}
		log.Printf("🔍 [updatePriorityRule] Merging legacy staffId to rule_definition: %v", staffIdValue)
	}

	// ✅ FIX: Use FLAT format (not nested conditions) for avoid_shift_with_exceptions
	// Store shift_type, days_of_week, and allowed_shifts directly in rule_definition
	// This matches the frontend format and INTEGRATION_BUG_FIX.md specification
	if shiftType, ok := ruleData["shiftType"]; ok {
		ruleDefinition["shift_type"] = shiftType
		log.Printf("🔍 [updatePriorityRule] Merging shiftType: %v", shiftType)
	}
	if daysOfWeek, ok := ruleData["daysOfWeek"]; ok {
		ruleDefinition["days_of_week"] = daysOfWeek
		log.Printf("🔍 [updatePriorityRule] Merging daysOfWeek: %+v", daysOfWeek)
	}

	// ✅ NEW: Handle allowedShifts for avoid_shift_with_exceptions rule type
	// This field stores exception shifts that ARE allowed despite avoiding the main shift
	if allowedShifts, ok := ruleData["allowedShifts"]; ok {
		ruleDefinition["allowed_shifts"] = allowedShifts
		log.Printf("🔍 [updatePriorityRule] Merging allowedShifts: %+v", allowedShifts)
	}

	// Add other optional fields
	if ruleType, ok := ruleData["ruleType"]; ok {
		ruleDefinition["type"] = ruleType
		log.Printf("🔍 [updatePriorityRule] Merging ruleType: %v", ruleType)
	}
	if preferenceStrength, ok := ruleData["preferenceStrength"]; ok {
		ruleDefinition["preference_strength"] = preferenceStrength
	}

	// Only update rule_definition if we have fields to merge
	if len(ruleDefinition) > 0 {
		updateData["rule_definition"] = ruleDefinition
		log.Printf("🔍 [updatePriorityRule] Final rule_definition: %+v", ruleDefinition)
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

// insertPriorityRule creates a new priority rule in the database
// Called when React sends a temporary ID (e.g., "priority-rule-1761352355813")
func (s *StaffSyncServer) insertPriorityRule(versionID string, ruleData map[string]interface{}) error {
	log.Printf("🔍 [insertPriorityRule] Creating new priority rule: %s", ruleData["name"])

	// ✅ VALIDATION: Reject INSERT if critical fields are missing
	// This prevents NULL rule_definition in database

	// ✅ NEW: Check for BOTH staffIds (array) and staffId (legacy single)
	staffIds, hasStaffIds := ruleData["staffIds"].([]interface{})
	staffId, hasStaffId := ruleData["staffId"]
	shiftType, hasShiftType := ruleData["shiftType"]
	daysOfWeek, hasDaysOfWeek := ruleData["daysOfWeek"]

	// Validate: must have EITHER staffIds array OR legacy staffId
	hasValidStaff := false
	if hasStaffIds && len(staffIds) > 0 {
		hasValidStaff = true
		log.Printf("✅ [insertPriorityRule] Found staffIds array with %d members", len(staffIds))
	} else if hasStaffId && staffId != nil && staffId != "" {
		hasValidStaff = true
		log.Printf("✅ [insertPriorityRule] Found legacy staffId: %v", staffId)
	}

	if !hasValidStaff {
		log.Printf("❌ [insertPriorityRule] REJECTED: Missing staff selection for rule '%s'", ruleData["name"])
		return fmt.Errorf("priority rule must have staffIds array or staffId (staff member selection required)")
	}

	if !hasShiftType || shiftType == nil || shiftType == "" {
		log.Printf("❌ [insertPriorityRule] REJECTED: Missing shiftType for rule '%s'", ruleData["name"])
		return fmt.Errorf("priority rule must have shiftType (shift preference required)")
	}

	if !hasDaysOfWeek {
		log.Printf("❌ [insertPriorityRule] REJECTED: Missing daysOfWeek for rule '%s'", ruleData["name"])
		return fmt.Errorf("priority rule must have daysOfWeek (day selection required)")
	}

	// Validate daysOfWeek is an array
	daysArray, ok := daysOfWeek.([]interface{})
	if !ok {
		log.Printf("❌ [insertPriorityRule] REJECTED: daysOfWeek is not an array for rule '%s'", ruleData["name"])
		return fmt.Errorf("priority rule daysOfWeek must be an array")
	}

	if len(daysArray) == 0 {
		log.Printf("❌ [insertPriorityRule] REJECTED: daysOfWeek is empty for rule '%s'", ruleData["name"])
		return fmt.Errorf("priority rule must have at least one day selected")
	}

	log.Printf("✅ [insertPriorityRule] Validation passed: staffId=%v, shiftType=%v, daysOfWeek=%v", staffId, shiftType, daysOfWeek)

	url := fmt.Sprintf("%s/rest/v1/priority_rules", s.supabaseURL)

	// Build rule_definition JSONB (same logic as UPDATE)
	ruleDefinition := make(map[string]interface{})

	// Merge top-level fields into rule_definition with proper nested structure
	// Database expects: { staff_id, conditions: { shift_type, day_of_week } }
	// ✅ NEW: Support multiple staff members via staffIds array
	var staffIdForDB interface{}
	if staffIds, ok := ruleData["staffIds"].([]interface{}); ok {
		// New format: staffIds array
		ruleDefinition["staff_ids"] = staffIds

		// For backward compatibility: set top-level staff_id to first member if single staff
		if len(staffIds) == 1 {
			staffIdForDB = staffIds[0]
			log.Printf("🔍 [insertPriorityRule] Adding staffIds array (single): %v", staffIds)
		} else if len(staffIds) > 1 {
			staffIdForDB = nil // Multiple staff = no single staff_id
			log.Printf("🔍 [insertPriorityRule] Adding staffIds array (multiple): %v", staffIds)
		} else {
			staffIdForDB = nil // Empty array
			log.Printf("🔍 [insertPriorityRule] Empty staffIds array")
		}
	} else if staffId, ok := ruleData["staffId"]; ok {
		// Legacy format: single staffId
		// ✅ FIX: Convert empty string to nil for UUID column validation
		if staffIdStr, isString := staffId.(string); isString && staffIdStr == "" {
			staffIdForDB = nil
			log.Printf("🔍 [insertPriorityRule] Empty staffId string, setting to nil")
		} else {
			staffIdForDB = staffId
		}

		ruleDefinition["staff_id"] = staffIdForDB
		// Also convert single staffId to staff_ids array for new format
		if staffIdForDB != nil {
			ruleDefinition["staff_ids"] = []interface{}{staffIdForDB}
		}
		log.Printf("🔍 [insertPriorityRule] Adding legacy staffId: %v", staffIdForDB)
	}

	// ✅ FIX: Use FLAT format (not nested conditions) for avoid_shift_with_exceptions
	// Store shift_type, days_of_week, and allowed_shifts directly in rule_definition
	// This matches the frontend format and INTEGRATION_BUG_FIX.md specification
	if shiftType, ok := ruleData["shiftType"]; ok {
		ruleDefinition["shift_type"] = shiftType
		log.Printf("🔍 [insertPriorityRule] Adding shiftType: %v", shiftType)
	}
	if daysOfWeek, ok := ruleData["daysOfWeek"]; ok {
		ruleDefinition["days_of_week"] = daysOfWeek
		log.Printf("🔍 [insertPriorityRule] Adding daysOfWeek: %+v", daysOfWeek)
	}

	// ✅ NEW: Handle allowedShifts for avoid_shift_with_exceptions rule type
	// This field stores exception shifts that ARE allowed despite avoiding the main shift
	if allowedShifts, ok := ruleData["allowedShifts"]; ok {
		ruleDefinition["allowed_shifts"] = allowedShifts
		log.Printf("🔍 [insertPriorityRule] Adding allowedShifts: %+v", allowedShifts)
	}

	// Add other optional fields
	if ruleType, ok := ruleData["ruleType"]; ok {
		ruleDefinition["type"] = ruleType
		log.Printf("🔍 [insertPriorityRule] Adding ruleType: %v", ruleType)
	}
	if preferenceStrength, ok := ruleData["preferenceStrength"]; ok {
		ruleDefinition["preference_strength"] = preferenceStrength
	}

	log.Printf("🔍 [insertPriorityRule] Final rule_definition: %+v", ruleDefinition)

	// Build INSERT payload with all required fields
	// NOTE: restaurant_id comes from environment variable via getRestaurantID()
	// ✅ FIX: Removed staff_id - database schema doesn't have this column
	// Staff IDs are stored in rule_definition.staff_ids JSONB array
	insertData := map[string]interface{}{
		"restaurant_id": s.getRestaurantID(),
		"version_id":    versionID,
		"name":          ruleData["name"],
		"description":   ruleData["description"],
		"is_active":     true, // Always active for new rules
	}

	// Add optional fields with safe type assertions and defaults
	if priorityLevel, ok := ruleData["priorityLevel"].(float64); ok {
		insertData["priority_level"] = int(priorityLevel)
	} else {
		insertData["priority_level"] = 3 // Default priority
	}

	if penaltyWeight, ok := ruleData["penaltyWeight"].(float64); ok {
		insertData["penalty_weight"] = penaltyWeight
	} else {
		insertData["penalty_weight"] = 50.0 // Default penalty
	}

	if isHardConstraint, ok := ruleData["isHardConstraint"].(bool); ok {
		insertData["is_hard_constraint"] = isHardConstraint
	} else {
		insertData["is_hard_constraint"] = false // Default to soft constraint
	}

	// Add rule_definition JSONB
	if len(ruleDefinition) > 0 {
		insertData["rule_definition"] = ruleDefinition
	}

	// Optional: effective dates (can be null)
	if effectiveFrom, ok := ruleData["effectiveFrom"]; ok && effectiveFrom != nil {
		insertData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := ruleData["effectiveUntil"]; ok && effectiveUntil != nil {
		insertData["effective_until"] = effectiveUntil
	}

	log.Printf("🔍 [insertPriorityRule] INSERT payload: %+v", insertData)

	// ✅ FIX: Check for duplicate rule by client-provided ID to prevent race condition duplication
	// This happens when WebSocket broadcast triggers a second CREATE before the first one completes
	if clientID, ok := ruleData["id"].(string); ok && clientID != "" {
		// Check if rule with this ID already exists in database
		checkURL := fmt.Sprintf("%s/rest/v1/priority_rules?id=eq.%s&select=id", s.supabaseURL, clientID)
		checkReq, _ := http.NewRequest("GET", checkURL, nil)
		checkReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
		checkReq.Header.Set("apikey", s.supabaseKey)

		client := &http.Client{Timeout: 5 * time.Second}
		checkResp, err := client.Do(checkReq)
		if err == nil {
			defer checkResp.Body.Close()
			var existingRules []map[string]interface{}
			if body, _ := io.ReadAll(checkResp.Body); json.Unmarshal(body, &existingRules) == nil {
				if len(existingRules) > 0 {
					log.Printf("⏭️ [insertPriorityRule] Rule with ID %s already exists, skipping duplicate INSERT", clientID)
					return nil // Skip insertion - rule already exists
				}
			}
		}

		// Use client-provided ID instead of letting database generate one
		insertData["id"] = clientID
		log.Printf("🔍 [insertPriorityRule] Using client-provided ID: %s", clientID)
	}

	// Send POST request to Supabase
	jsonData, err := json.Marshal(insertData)
	if err != nil {
		return fmt.Errorf("failed to marshal insert data: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation") // Return the created row

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [insertPriorityRule] Successfully created priority rule: %s", ruleData["name"])
	log.Printf("🔍 [insertPriorityRule] Supabase response: %s", string(body))

	// ✅ FIX: Store temporary ID → database UUID mapping for future UPDATEs
	// Extract the database-generated UUID from the INSERT response
	var createdRules []map[string]interface{}
	if err := json.Unmarshal(body, &createdRules); err == nil && len(createdRules) > 0 {
		if dbUUID, ok := createdRules[0]["id"].(string); ok {
			if tempID, ok := ruleData["id"].(string); ok && strings.HasPrefix(tempID, "priority-rule-") {
				// Store mapping: temporary ID → database UUID
				s.tempIDMap.Store(tempID, dbUUID)
				log.Printf("🔗 [insertPriorityRule] Mapped temp ID '%s' → DB UUID '%s'", tempID, dbUUID)
			}
		}
	}

	return nil
}

// updateMLModelConfig updates an ML model configuration in the database
func (s *StaffSyncServer) updateMLModelConfig(versionID string, configData map[string]interface{}) error {
	// Try to get config ID from request, otherwise lookup existing or generate new
	configID, ok := configData["id"].(string)
	if !ok || configID == "" {
		// Lookup existing config by version_id
		existingConfigs, err := s.fetchMLModelConfigs(versionID)
		if err == nil && len(existingConfigs) > 0 {
			configID = existingConfigs[0].ID
			log.Printf("📊 [updateMLModelConfig] Found existing config ID: %s", configID)
		} else {
			// Generate new UUID for new config
			configID = uuid.New().String()
			log.Printf("📊 [updateMLModelConfig] Generated new config ID: %s", configID)
		}
	}

	log.Printf("📊 [updateMLModelConfig] Updating config: %s", configID)

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

// updateORToolsConfig updates an OR-Tools solver configuration in the database
// Note: OR-Tools config is restaurant-scoped, not version-scoped
func (s *StaffSyncServer) updateORToolsConfig(versionID string, configData map[string]interface{}) error {
	restaurantID := s.getRestaurantID()

	// Try to get config ID from request, otherwise lookup existing or generate new
	configID, ok := configData["id"].(string)
	if !ok || configID == "" {
		// Lookup existing config by restaurant_id
		existingConfigs, err := s.fetchORToolsConfig(versionID)
		if err == nil && len(existingConfigs) > 0 {
			configID = existingConfigs[0].ID
			log.Printf("🔧 [updateORToolsConfig] Found existing config ID: %s", configID)
		} else {
			// Generate new UUID for new config
			configID = uuid.New().String()
			log.Printf("🔧 [updateORToolsConfig] Generated new config ID: %s", configID)
		}
	}

	log.Printf("🔧 [updateORToolsConfig] Updating config: %s", configID)
	log.Printf("🔧 [updateORToolsConfig] Config data: %+v", configData)

	url := fmt.Sprintf("%s/rest/v1/ortools_solver_config", s.supabaseURL)

	// Prepare upsert data with snake_case field names
	upsertData := make(map[string]interface{})
	upsertData["id"] = configID
	// Note: version_id is NULL for restaurant-wide config
	upsertData["restaurant_id"] = restaurantID

	if name, ok := configData["name"]; ok {
		upsertData["name"] = name
	} else {
		upsertData["name"] = "Default Solver Config"
	}

	if preset, ok := configData["preset"]; ok {
		upsertData["preset"] = preset
	} else {
		upsertData["preset"] = "balanced"
	}

	if penaltyWeights, ok := configData["penaltyWeights"]; ok && penaltyWeights != nil {
		upsertData["penalty_weights"] = penaltyWeights
	} else {
		// Default penalty weights
		upsertData["penalty_weights"] = map[string]interface{}{
			"hardConstraintViolation": 1000,
			"monthlyLimitViolation":   100,
			"dailyLimitViolation":     50,
			"priorityRuleViolation":   10,
		}
	}

	if solverSettings, ok := configData["solverSettings"]; ok && solverSettings != nil {
		upsertData["solver_settings"] = solverSettings
	} else {
		// Default solver settings
		upsertData["solver_settings"] = map[string]interface{}{
			"maxTimeSeconds": 30,
			"numWorkers":     4,
			"logSearchProgress": false,
		}
	}

	if isActive, ok := configData["isActive"]; ok {
		upsertData["is_active"] = isActive
	} else {
		upsertData["is_active"] = true
	}

	upsertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	jsonData, _ := json.Marshal(upsertData)
	log.Printf("🔧 [updateORToolsConfig] Upsert data: %s", string(jsonData))

	// Try UPDATE first - query by id and restaurant_id (config is restaurant-scoped)
	updateURL := fmt.Sprintf("%s?id=eq.%s&restaurant_id=eq.%s", url, configID, restaurantID)
	req, err := http.NewRequest("PATCH", updateURL, bytes.NewBuffer(jsonData))
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
		return fmt.Errorf("failed to update OR-Tools config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent {
		log.Printf("✅ [updateORToolsConfig] Successfully updated config")
		return nil
	}

	// If UPDATE didn't find the row, try INSERT
	log.Printf("⚠️ [updateORToolsConfig] UPDATE failed (status %d), trying INSERT", resp.StatusCode)

	upsertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	jsonData, _ = json.Marshal(upsertData)

	req, err = http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create insert request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err = client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert OR-Tools config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [updateORToolsConfig] Successfully inserted config")
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

// deleteStaffGroup soft-deletes a staff group from the database by setting is_active to false
func (s *StaffSyncServer) deleteStaffGroup(versionID string, groupID string) error {
	url := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, groupID, versionID)

	log.Printf("🗑️ [deleteStaffGroup] Starting soft-delete for group: %s", groupID)
	log.Printf("🗑️ [deleteStaffGroup] Version ID: %s", versionID)
	log.Printf("🗑️ [deleteStaffGroup] URL: %s", url)

	// Soft delete by setting is_active to false
	updateData := map[string]interface{}{
		"is_active":  false,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, _ := json.Marshal(updateData)
	log.Printf("🗑️ [deleteStaffGroup] PATCH data: %s", string(jsonData))

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ [deleteStaffGroup] Failed to create request: %v", err)
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	log.Printf("🗑️ [deleteStaffGroup] Request headers: Authorization=[REDACTED], apikey=[REDACTED], Content-Type=application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [deleteStaffGroup] HTTP request failed: %v", err)
		return fmt.Errorf("failed to delete staff group: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("🗑️ [deleteStaffGroup] Response status: %d", resp.StatusCode)
	log.Printf("🗑️ [deleteStaffGroup] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [deleteStaffGroup] Delete failed with status %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [deleteStaffGroup] Successfully soft-deleted group: %s", groupID)
	return nil
}

// hardDeleteStaffGroup permanently deletes a staff group from the database
func (s *StaffSyncServer) hardDeleteStaffGroup(versionID string, groupID string) error {
	// 🔧 FIX #3: Verify item is soft-deleted (is_active=false) before allowing hard delete
	// This prevents accidental permanent deletion of active items
	log.Printf("🗑️ [hardDeleteStaffGroup] Starting PERMANENT delete for group: %s", groupID)
	log.Printf("🗑️ [hardDeleteStaffGroup] Version ID: %s", versionID)

	// Step 1: Fetch the group to verify it's soft-deleted
	fetchURL := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&version_id=eq.%s&select=*",
		s.supabaseURL, groupID, versionID)

	fetchReq, err := http.NewRequest("GET", fetchURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create fetch request: %w", err)
	}
	fetchReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	fetchReq.Header.Set("apikey", s.supabaseKey)

	client := &http.Client{Timeout: 10 * time.Second}
	fetchResp, err := client.Do(fetchReq)
	if err != nil {
		return fmt.Errorf("failed to fetch group for validation: %w", err)
	}
	defer fetchResp.Body.Close()

	fetchBody, _ := io.ReadAll(fetchResp.Body)
	if fetchResp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch group (status %d): %s", fetchResp.StatusCode, string(fetchBody))
	}

	var groups []StaffGroup
	if err := json.Unmarshal(fetchBody, &groups); err != nil {
		return fmt.Errorf("failed to parse group data: %w", err)
	}

	if len(groups) == 0 {
		return fmt.Errorf("group not found: %s", groupID)
	}

	group := groups[0]
	log.Printf("🔍 [hardDeleteStaffGroup] Group status: is_active=%v", group.IsActive)

	// ✅ FIX #3: Only allow hard delete if group is soft-deleted (is_active=false)
	if group.IsActive {
		log.Printf("❌ [hardDeleteStaffGroup] REJECTED: Cannot hard delete active group (is_active=true)")
		return fmt.Errorf("cannot hard delete active group: must be soft-deleted first (is_active=false)")
	}

	log.Printf("✅ [hardDeleteStaffGroup] Validation passed: group is soft-deleted, proceeding with permanent delete")

	// Step 2: Proceed with hard delete
	url := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, groupID, versionID)
	log.Printf("🗑️ [hardDeleteStaffGroup] URL: %s", url)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		log.Printf("❌ [hardDeleteStaffGroup] Failed to create request: %v", err)
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [hardDeleteStaffGroup] HTTP request failed: %v", err)
		return fmt.Errorf("failed to hard delete staff group: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("🗑️ [hardDeleteStaffGroup] Response status: %d", resp.StatusCode)
	log.Printf("🗑️ [hardDeleteStaffGroup] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [hardDeleteStaffGroup] Hard delete failed with status %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("hard delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [hardDeleteStaffGroup] Successfully PERMANENTLY deleted group: %s", groupID)
	return nil
}

// insertDailyLimit inserts a new daily limit into the database
func (s *StaffSyncServer) insertDailyLimit(versionID string, limitData map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/weekly_limits", s.supabaseURL)

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

// deletePriorityRule soft-deletes a priority rule from the database by setting is_active to false
func (s *StaffSyncServer) deletePriorityRule(versionID string, ruleID string) error {
	url := fmt.Sprintf("%s/rest/v1/priority_rules?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, ruleID, versionID)

	log.Printf("🗑️ [deletePriorityRule] Starting HARD DELETE for rule: %s", ruleID)
	log.Printf("🗑️ [deletePriorityRule] Version ID: %s", versionID)
	log.Printf("🗑️ [deletePriorityRule] URL: %s", url)

	// ✅ FIX: Changed from PATCH (soft-delete) to DELETE (hard-delete)
	// This permanently removes rules from database to prevent NULL staff_id issues
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		log.Printf("❌ [deletePriorityRule] Failed to create request: %v", err)
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	log.Printf("🗑️ [deletePriorityRule] Request headers: Authorization=[REDACTED], apikey=[REDACTED], Content-Type=application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [deletePriorityRule] HTTP request failed: %v", err)
		return fmt.Errorf("failed to delete priority rule: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("🗑️ [deletePriorityRule] Response status: %d", resp.StatusCode)
	log.Printf("🗑️ [deletePriorityRule] Response body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		log.Printf("❌ [deletePriorityRule] Delete failed with status %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [deletePriorityRule] Successfully HARD-DELETED rule from database: %s", ruleID)
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

// insertBackupAssignment inserts a new backup assignment into the database
func (s *StaffSyncServer) insertBackupAssignment(versionID string, assignmentData map[string]interface{}) error {
	log.Printf("📋 [insertBackupAssignment] Creating new backup assignment")

	url := fmt.Sprintf("%s/rest/v1/staff_backup_assignments", s.supabaseURL)

	insertData := make(map[string]interface{})
	insertData["version_id"] = versionID
	insertData["restaurant_id"] = s.getRestaurantID()
	insertData["is_active"] = true
	insertData["created_at"] = time.Now().UTC().Format(time.RFC3339)
	insertData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy data (camelCase → snake_case)
	if id, ok := assignmentData["id"]; ok {
		insertData["id"] = id
	}
	if staffId, ok := assignmentData["staffId"]; ok {
		insertData["staff_id"] = staffId
	}
	if groupId, ok := assignmentData["groupId"]; ok {
		insertData["group_id"] = groupId
	}
	if assignmentType, ok := assignmentData["assignmentType"]; ok {
		insertData["assignment_type"] = assignmentType
	} else {
		insertData["assignment_type"] = "regular"
	}
	if priority, ok := assignmentData["priority"]; ok {
		insertData["priority_order"] = priority
	} else {
		insertData["priority_order"] = 1
	}
	if effectiveFrom, ok := assignmentData["effectiveFrom"]; ok && effectiveFrom != nil {
		insertData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := assignmentData["effectiveUntil"]; ok && effectiveUntil != nil {
		insertData["effective_until"] = effectiveUntil
	}
	if notes, ok := assignmentData["notes"]; ok {
		insertData["notes"] = notes
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
		return fmt.Errorf("failed to insert backup assignment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [insertBackupAssignment] Successfully created backup assignment")
	return nil
}

// updateBackupAssignment updates an existing backup assignment in the database
func (s *StaffSyncServer) updateBackupAssignment(versionID string, assignmentData map[string]interface{}) error {
	assignmentID, ok := assignmentData["id"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid assignment ID")
	}

	log.Printf("📋 [updateBackupAssignment] Updating backup assignment: %s", assignmentID)

	url := fmt.Sprintf("%s/rest/v1/staff_backup_assignments?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, assignmentID, versionID)

	updateData := make(map[string]interface{})
	updateData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	// Copy updatable fields (camelCase → snake_case)
	if staffId, ok := assignmentData["staffId"]; ok {
		updateData["staff_id"] = staffId
	}
	if groupId, ok := assignmentData["groupId"]; ok {
		updateData["group_id"] = groupId
	}
	if assignmentType, ok := assignmentData["assignmentType"]; ok {
		updateData["assignment_type"] = assignmentType
	}
	if priority, ok := assignmentData["priority"]; ok {
		updateData["priority_order"] = priority
	}
	if effectiveFrom, ok := assignmentData["effectiveFrom"]; ok {
		updateData["effective_from"] = effectiveFrom
	}
	if effectiveUntil, ok := assignmentData["effectiveUntil"]; ok {
		updateData["effective_until"] = effectiveUntil
	}
	if isActive, ok := assignmentData["isActive"]; ok {
		updateData["is_active"] = isActive
	}
	if notes, ok := assignmentData["notes"]; ok {
		updateData["notes"] = notes
	}

	jsonData, _ := json.Marshal(updateData)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
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
		return fmt.Errorf("failed to update backup assignment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [updateBackupAssignment] Successfully updated backup assignment")
	return nil
}

// deleteBackupAssignment deletes a backup assignment from the database
func (s *StaffSyncServer) deleteBackupAssignment(versionID string, assignmentID string) error {
	log.Printf("🗑️ [deleteBackupAssignment] Deleting backup assignment: %s", assignmentID)

	url := fmt.Sprintf("%s/rest/v1/staff_backup_assignments?id=eq.%s&version_id=eq.%s",
		s.supabaseURL, assignmentID, versionID)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete backup assignment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [deleteBackupAssignment] Successfully deleted backup assignment")
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

	log.Printf("✅ Retrieved aggregated settings: %d staff groups, %d weekly limits, %d monthly limits, %d priority rules, %d ML configs",
		len(settings.StaffGroups), len(settings.WeeklyLimits), len(settings.MonthlyLimits),
		len(settings.PriorityRules), len(settings.MLModelConfigs))

	// 🔍 DEBUG: Log weeklyLimits content
	log.Printf("🔍 [WEEKLY-LIMITS-DEBUG] WeeklyLimits array length: %d", len(settings.WeeklyLimits))
	if len(settings.WeeklyLimits) > 0 {
		for i, limit := range settings.WeeklyLimits {
			limitJSON, _ := json.Marshal(limit)
			log.Printf("🔍 [WEEKLY-LIMITS-DEBUG] Limit %d: %s", i, string(limitJSON))
		}
	}

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

	// 🔍 DEBUG: Log what's actually being sent
	if payloadMap, ok := response.Payload.(map[string]interface{}); ok {
		if settingsInterface, exists := payloadMap["settings"]; exists {
			if settingsMap, ok := settingsInterface.(*SettingsAggregate); ok {
				log.Printf("🔍 [WEBSOCKET-SEND-DEBUG] Sending weeklyLimits count: %d", len(settingsMap.WeeklyLimits))
			}
		}
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
	log.Printf("🔍 [DEBUG] Payload type: %T", msg.Payload)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format - got type %T", msg.Payload)
		return
	}
	log.Printf("🔍 [DEBUG] Payload keys: %v", getKeys(payload))

	groupData, ok := payload["group"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing group data - available keys: %v", getKeys(payload))
		log.Printf("🔍 [DEBUG] Full payload: %+v", payload)
		return
	}

	// ✅ DEBUG: Log the group data we received
	log.Printf("🔍 [handleStaffGroupsUpdate] Group data received:")
	log.Printf("   - ID: %v", groupData["id"])
	log.Printf("   - Name: %v", groupData["name"])
	log.Printf("   - Members: %v", groupData["members"])
	log.Printf("   - Full groupData: %+v", groupData)

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ Failed to fetch active version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	log.Printf("🔍 [handleStaffGroupsUpdate] Using version_id: %s", version.ID)

	// Check if version is locked
	if version.IsLocked {
		log.Printf("❌ Version is locked, cannot update")
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// 🔧 UPSERT: Try UPDATE first, if no rows affected, CREATE instead
	log.Printf("🔍 [handleStaffGroupsUpdate] Calling updateStaffGroup...")
	rowsAffected, err := s.upsertStaffGroup(version.ID, groupData)
	if err != nil {
		log.Printf("❌ upsertStaffGroup failed: %v", err)
		s.sendErrorResponse(client, "Failed to upsert staff group", err)
		return
	}

	if rowsAffected == 0 {
		log.Printf("⚠️ UPDATE affected 0 rows - group doesn't exist, falling back to CREATE")
		// Group doesn't exist in database, create it instead
		if err := s.createStaffGroup(version.ID, groupData); err != nil {
			log.Printf("❌ createStaffGroup failed: %v", err)
			s.sendErrorResponse(client, "Failed to create staff group", err)
			return
		}
		log.Printf("✅ createStaffGroup succeeded (UPSERT fallback)")
	} else {
		log.Printf("✅ updateStaffGroup succeeded (%d row(s) affected)", rowsAffected)
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "staff_groups", "UPDATE", groupData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated staff group")

	// Fetch fresh aggregated settings
	log.Printf("🔍 [handleStaffGroupsUpdate] Fetching fresh aggregated settings...")
	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("❌ Failed to fetch updated settings: %v", err)
		return
	}

	// ✅ DEBUG: Log how many staff groups were returned
	log.Printf("🔍 [handleStaffGroupsUpdate] fetchAggregatedSettings returned:")
	log.Printf("   - Staff Groups count: %d", len(settings.StaffGroups))
	for i, group := range settings.StaffGroups {
		log.Printf("   - Group %d: %s (ID: %s)", i, group.Name, group.ID)
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

// handleStaffGroupCreate creates a new staff group and broadcasts changes
func (s *StaffSyncServer) handleStaffGroupCreate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_CREATE_STAFF_GROUP from client %s", client.clientId)
	log.Printf("🔍 DEBUG: Payload type: %T, value: %+v", msg.Payload, msg.Payload)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format - got type %T", msg.Payload)
		return
	}
	log.Printf("🔍 DEBUG: Payload keys: %v", payload)

	groupData, ok := payload["group"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing group data - payload[\"group\"] type: %T", payload["group"])
		return
	}
	log.Printf("🔍 DEBUG: Group data: %+v", groupData)

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

	// Insert new staff group into database
	if err := s.insertStaffGroup(version.ID, groupData); err != nil {
		s.sendErrorResponse(client, "Failed to create staff group", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "staff_groups", "INSERT", groupData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully created staff group: %s", groupData["id"])

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
			"action":   "created",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted new staff group to all clients")
}

// handleStaffGroupDelete deletes a staff group and broadcasts changes
func (s *StaffSyncServer) handleStaffGroupDelete(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_DELETE_STAFF_GROUP from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format - got type %T", msg.Payload)
		return
	}

	log.Printf("🔍 [handleStaffGroupDelete] Payload: %+v", payload)

	groupID, ok := payload["groupId"].(string)
	if !ok {
		log.Printf("❌ Missing group ID - payload[\"groupId\"] type: %T, value: %v", payload["groupId"], payload["groupId"])
		return
	}

	log.Printf("🔍 [handleStaffGroupDelete] Group ID to delete: %s", groupID)

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ [handleStaffGroupDelete] Failed to fetch active version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	log.Printf("🔍 [handleStaffGroupDelete] Active version: %s (locked: %v)", version.ID, version.IsLocked)

	// Check if version is locked
	if version.IsLocked {
		log.Printf("⚠️ [handleStaffGroupDelete] Version is locked, cannot delete")
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// Delete staff group from database
	log.Printf("🔍 [handleStaffGroupDelete] Calling deleteStaffGroup with versionID=%s, groupID=%s", version.ID, groupID)
	if err := s.deleteStaffGroup(version.ID, groupID); err != nil {
		log.Printf("❌ [handleStaffGroupDelete] deleteStaffGroup failed: %v", err)
		s.sendErrorResponse(client, "Failed to delete staff group", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "staff_groups", "DELETE", map[string]interface{}{"id": groupID}); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully deleted staff group: %s", groupID)

	// 🔍 VERIFICATION: Query database to confirm is_active=false BEFORE fetching aggregated settings
	verifyURL := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&select=id,name,is_active",
		s.supabaseURL, groupID)
	verifyReq, _ := http.NewRequest("GET", verifyURL, nil)
	verifyReq.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	verifyReq.Header.Set("apikey", s.supabaseKey)
	verifyReq.Header.Set("Content-Type", "application/json")

	verifyClient := &http.Client{Timeout: 5 * time.Second}
	verifyResp, err := verifyClient.Do(verifyReq)
	if err == nil {
		defer verifyResp.Body.Close()
		verifyBody, _ := io.ReadAll(verifyResp.Body)
		log.Printf("🔍 [VERIFY DELETE] Database state after delete: %s", string(verifyBody))
	} else {
		log.Printf("⚠️ [VERIFY DELETE] Failed to verify deletion: %v", err)
	}

	// Fetch fresh aggregated settings
	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	// 🔍 LOG: Show how many groups are in the fetched settings
	log.Printf("🔍 [handleStaffGroupDelete] Fetched %d staff groups after deletion", len(settings.StaffGroups))
	for i, group := range settings.StaffGroups {
		log.Printf("🔍 [handleStaffGroupDelete] Group %d: %s (ID: %s, is_active: %v)", i+1, group.Name, group.ID, group.IsActive)
	}

	// Broadcast updated settings to all clients
	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "staff_groups",
			"action":   "deleted",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted group deletion to all clients (containing %d groups)", len(settings.StaffGroups))
}

// handleStaffGroupHardDelete permanently deletes a staff group and broadcasts changes
func (s *StaffSyncServer) handleStaffGroupHardDelete(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_HARD_DELETE_STAFF_GROUP from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format - got type %T", msg.Payload)
		return
	}

	groupID, ok := payload["groupId"].(string)
	if !ok {
		log.Printf("❌ Missing group ID")
		return
	}

	log.Printf("🗑️ [handleStaffGroupHardDelete] Group ID to PERMANENTLY delete: %s", groupID)

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ Failed to fetch active version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	// Check if version is locked
	if version.IsLocked {
		log.Printf("⚠️ Version is locked, cannot delete")
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// Hard delete staff group from database
	if err := s.hardDeleteStaffGroup(version.ID, groupID); err != nil {
		log.Printf("❌ hardDeleteStaffGroup failed: %v", err)
		s.sendErrorResponse(client, "Failed to permanently delete staff group", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "staff_groups", "HARD_DELETE", map[string]interface{}{"id": groupID}); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully PERMANENTLY deleted staff group: %s", groupID)

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
			"action":   "hard_deleted",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted hard group deletion to all clients (containing %d groups)", len(settings.StaffGroups))
}

// handleDailyLimitsUpdate updates daily limits and broadcasts changes
// Daily limits are a singleton configuration constraining min/max shifts per day
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

	// UPSERT daily limits (singleton per version)
	if err := s.upsertDailyLimits(version.ID, limitData); err != nil {
		s.sendErrorResponse(client, "Failed to upsert daily limits", err)
		return
	}

	if err := s.logConfigChange(version.ID, "daily_limits", "UPDATE", limitData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated daily limits")

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

// handleWeeklyLimitsUpdate updates a weekly limit and broadcasts changes
// Weekly limits constrain shift symbols over rolling 7-day periods (e.g., max 2 day-offs in any 7-day window)
func (s *StaffSyncServer) handleWeeklyLimitsUpdate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_UPDATE_WEEKLY_LIMITS from client %s", client.clientId)

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

	// 🔧 UPSERT FIX: Use upsertWeeklyLimit to handle both create and update
	rowsAffected, err := s.upsertWeeklyLimit(version.ID, limitData)
	if err != nil {
		s.sendErrorResponse(client, "Failed to upsert weekly limit", err)
		return
	}
	log.Printf("🔧 [handleWeeklyLimitsUpdate] Upserted weekly limit, rows affected: %d", rowsAffected)

	if err := s.logConfigChange(version.ID, "weekly_limits", "UPDATE", limitData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated weekly limit")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "weekly_limits",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated weekly limits to all clients")
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

// handlePriorityRuleCreate creates a new priority rule and broadcasts changes
func (s *StaffSyncServer) handlePriorityRuleCreate(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_CREATE_PRIORITY_RULE from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	log.Printf("🔍 [handlePriorityRuleCreate] Payload: %+v", payload)

	rule, ok := payload["rule"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing rule data in payload")
		return
	}

	log.Printf("🔍 [handlePriorityRuleCreate] Rule data: %+v", rule)
	log.Printf("🔍 [handlePriorityRuleCreate] Rule name: %v", rule["name"])
	log.Printf("🔍 [handlePriorityRuleCreate] Rule description: %v", rule["description"])
	log.Printf("🔍 [handlePriorityRuleCreate] Rule ID: %v", rule["id"])

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ [handlePriorityRuleCreate] Failed to fetch active version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	log.Printf("🔍 [handlePriorityRuleCreate] Active version: %s (locked: %v)", version.ID, version.IsLocked)

	// Check if version is locked
	if version.IsLocked {
		log.Printf("⚠️ [handlePriorityRuleCreate] Version is locked, cannot create")
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// Create priority rule in database using insertPriorityRule
	log.Printf("🔍 [handlePriorityRuleCreate] Calling insertPriorityRule with versionID=%s", version.ID)
	if err := s.insertPriorityRule(version.ID, rule); err != nil {
		log.Printf("❌ [handlePriorityRuleCreate] insertPriorityRule failed: %v", err)
		s.sendErrorResponse(client, "Failed to create priority rule", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "priority_rules", "CREATE", rule); err != nil {
		log.Printf("⚠️  Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully created priority rule")

	// Fetch updated settings from database
	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	// Broadcast to all clients (including sender)
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
	log.Printf("📡 Broadcasted new priority rule to all clients")
}

// handlePriorityRuleDelete soft-deletes a priority rule and broadcasts changes
func (s *StaffSyncServer) handlePriorityRuleDelete(client *Client, msg *Message) {
	log.Printf("📊 Processing SETTINGS_DELETE_PRIORITY_RULE from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format - got type %T", msg.Payload)
		return
	}

	log.Printf("🔍 [handlePriorityRuleDelete] Payload: %+v", payload)

	ruleID, ok := payload["ruleId"].(string)
	if !ok {
		log.Printf("❌ Missing rule ID - payload[\"ruleId\"] type: %T, value: %v", payload["ruleId"], payload["ruleId"])
		return
	}

	log.Printf("🔍 [handlePriorityRuleDelete] Rule ID to delete: %s", ruleID)

	// Get active version
	version, err := s.fetchActiveConfigVersion()
	if err != nil {
		log.Printf("❌ [handlePriorityRuleDelete] Failed to fetch active version: %v", err)
		s.sendErrorResponse(client, "Failed to fetch active version", err)
		return
	}

	log.Printf("🔍 [handlePriorityRuleDelete] Active version: %s (locked: %v)", version.ID, version.IsLocked)

	// Check if version is locked
	if version.IsLocked {
		log.Printf("⚠️ [handlePriorityRuleDelete] Version is locked, cannot delete")
		s.sendErrorResponse(client, "Cannot modify locked version", nil)
		return
	}

	// Delete priority rule from database
	log.Printf("🔍 [handlePriorityRuleDelete] Calling deletePriorityRule with versionID=%s, ruleID=%s", version.ID, ruleID)
	if err := s.deletePriorityRule(version.ID, ruleID); err != nil {
		log.Printf("❌ [handlePriorityRuleDelete] deletePriorityRule failed: %v", err)
		s.sendErrorResponse(client, "Failed to delete priority rule", err)
		return
	}

	// Log change to audit trail
	if err := s.logConfigChange(version.ID, "priority_rules", "DELETE", map[string]interface{}{"id": ruleID}); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully deleted priority rule: %s", ruleID)

	// Fetch updated settings
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
			"updated":  "priority_rules",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated priority rules to all clients after deletion")
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

// handleORToolsConfigUpdate updates an OR-Tools solver configuration and broadcasts changes
func (s *StaffSyncServer) handleORToolsConfigUpdate(client *Client, msg *Message) {
	log.Printf("🔧 Processing SETTINGS_UPDATE_ORTOOLS_CONFIG from client %s", client.clientId)

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

	if err := s.updateORToolsConfig(version.ID, configData); err != nil {
		s.sendErrorResponse(client, "Failed to update OR-Tools config", err)
		return
	}

	if err := s.logConfigChange(version.ID, "ortools_solver_config", "UPDATE", configData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated OR-Tools config")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "ortools_solver_config",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated OR-Tools config to all clients")
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

	// 3. Migrate daily limits array → weekly_limits table
	if dailyLimits, ok := settings["dailyLimits"].([]interface{}); ok {
		for _, limit := range dailyLimits {
			limitMap := limit.(map[string]interface{})
			if err := s.insertDailyLimit(version.ID, limitMap); err != nil {
				log.Printf("⚠️ Failed to migrate daily limit: %v", err)
				continue
			}
			s.logConfigChange(version.ID, "weekly_limits", "INSERT", limitMap)
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

	// 4. Insert default settings
	log.Printf("📝 Inserting default settings (staff groups, daily limits, monthly limits)...")
	if err := s.insertDefaultSettings(defaultVersion.ID); err != nil {
		s.sendErrorResponse(client, "Failed to insert default settings", err)
		return
	}
	log.Printf("✅ Default settings inserted successfully")

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

// insertDefaultSettings inserts default configuration into a new version
// This matches the default settings from ConfigurationService.js in the React app
func (s *StaffSyncServer) insertDefaultSettings(versionID string) error {
	log.Printf("📝 Inserting default settings for version %s", versionID)

	// Insert 8 default staff groups (matching ConfigurationService.js)
	defaultGroups := []map[string]interface{}{
		{
			"id":          "group1",
			"name":        "Group 1",
			"description": "",
			"color":       "#3B82F6",
			"members":     []string{"料理長", "井関"},
		},
		{
			"id":          "group2",
			"name":        "Group 2",
			"description": "",
			"color":       "#10B981",
			"members":     []string{"井岡", "与儀"},
		},
		{
			"id":          "group3",
			"name":        "Group 3",
			"description": "",
			"color":       "#F59E0B",
			"members":     []string{"田辺", "古館"},
		},
		{
			"id":          "group4",
			"name":        "Group 4",
			"description": "",
			"color":       "#EF4444",
			"members":     []string{"小池", "岸"},
		},
		{
			"id":          "group5",
			"name":        "Group 5",
			"description": "",
			"color":       "#8B5CF6",
			"members":     []string{"カマル", "安井"},
		},
		{
			"id":          "group6",
			"name":        "Group 6",
			"description": "",
			"color":       "#EC4899",
			"members":     []string{"中田"},
		},
		{
			"id":          "group7",
			"name":        "Group 7",
			"description": "",
			"color":       "#14B8A6",
			"members":     []string{},
		},
		{
			"id":          "group8",
			"name":        "Group 8",
			"description": "",
			"color":       "#F97316",
			"members":     []string{},
		},
	}

	// Insert staff groups using Supabase REST API
	for i, group := range defaultGroups {
		// Prepare insert data for staff_groups table
		insertData := map[string]interface{}{
			"version_id":  versionID,
			"group_id":    group["id"],
			"group_name":  group["name"],
			"description": group["description"],
			"color":       group["color"],
			"members":     group["members"],
			"is_active":   true,
		}

		// Convert to JSON
		jsonData, err := json.Marshal(insertData)
		if err != nil {
			return fmt.Errorf("failed to marshal group %d: %w", i, err)
		}

		// POST to Supabase REST API
		url := fmt.Sprintf("%s/rest/v1/staff_groups", s.supabaseURL)
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create request for group %s: %w", group["id"], err)
		}

		req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
		req.Header.Set("apikey", s.supabaseKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Prefer", "return=minimal")

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to insert group %s: %w", group["id"], err)
		}
		defer resp.Body.Close()

		// Check response status
		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("failed to insert group %s (status %d): %s", group["id"], resp.StatusCode, string(body))
		}

		log.Printf("  ✅ Inserted staff group: %s", group["name"])
	}

	// Insert default daily limits (matching ConfigurationService.js)
	defaultDailyLimits := []map[string]interface{}{
		{
			"id":                    "default-daily-limits",
			"minWorkingStaffPerDay": 3,
			"maxOffPerDay":          4,
			"enforceGroupBalance":   true,
		},
	}

	for i, limit := range defaultDailyLimits {
		// Prepare insert data for weekly_limits table
		insertData := map[string]interface{}{
			"version_id":            versionID,
			"limit_id":              limit["id"],
			"min_working_staff":     limit["minWorkingStaffPerDay"],
			"max_off_per_day":       limit["maxOffPerDay"],
			"enforce_group_balance": limit["enforceGroupBalance"],
			"is_active":             true,
		}

		// Convert to JSON
		jsonData, err := json.Marshal(insertData)
		if err != nil {
			return fmt.Errorf("failed to marshal daily limit %d: %w", i, err)
		}

		// POST to Supabase REST API
		url := fmt.Sprintf("%s/rest/v1/weekly_limits", s.supabaseURL)
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create request for daily limit: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
		req.Header.Set("apikey", s.supabaseKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Prefer", "return=minimal")

		httpClient := &http.Client{Timeout: 10 * time.Second}
		resp, err := httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("failed to insert daily limit: %w", err)
		}
		defer resp.Body.Close()

		// Check response status
		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("failed to insert daily limit (status %d): %s", resp.StatusCode, string(body))
		}

		log.Printf("  ✅ Inserted daily limits: min=%d, max_off=%d", limit["minWorkingStaffPerDay"], limit["maxOffPerDay"])
	}

	// Insert default monthly limit (matching ConfigurationService.js)
	defaultMonthlyLimits := []map[string]interface{}{
		{
			"id":             "default-monthly-limits",
			"maxOffPerMonth": 8,
		},
	}

	for i, limit := range defaultMonthlyLimits {
		// Prepare insert data for monthly_limits table
		insertData := map[string]interface{}{
			"version_id":        versionID,
			"limit_id":          limit["id"],
			"max_off_per_month": limit["maxOffPerMonth"],
			"is_active":         true,
		}

		// Convert to JSON
		jsonData, err := json.Marshal(insertData)
		if err != nil {
			return fmt.Errorf("failed to marshal monthly limit %d: %w", i, err)
		}

		// POST to Supabase REST API
		url := fmt.Sprintf("%s/rest/v1/monthly_limits", s.supabaseURL)
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create request for monthly limit: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
		req.Header.Set("apikey", s.supabaseKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Prefer", "return=minimal")

		httpClient := &http.Client{Timeout: 10 * time.Second}
		resp, err := httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("failed to insert monthly limit: %w", err)
		}
		defer resp.Body.Close()

		// Check response status
		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("failed to insert monthly limit (status %d): %s", resp.StatusCode, string(body))
		}

		log.Printf("  ✅ Inserted monthly limits: max_off=%d", limit["maxOffPerMonth"])
	}

	// NO default priority rules - these are user-created only
	log.Printf("  ℹ️  No priority rules inserted (user-created only)")

	log.Printf("✅ Successfully inserted all default settings")
	return nil
}

// ============================================================================
// BACKUP ASSIGNMENT HANDLERS - WebSocket Message Handlers
// ============================================================================

// handleBackupAssignmentCreate creates a new backup assignment and broadcasts changes
func (s *StaffSyncServer) handleBackupAssignmentCreate(client *Client, msg *Message) {
	log.Printf("📋 Processing SETTINGS_CREATE_BACKUP_ASSIGNMENT from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	assignmentData, ok := payload["assignment"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing assignment data")
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

	if err := s.insertBackupAssignment(version.ID, assignmentData); err != nil {
		s.sendErrorResponse(client, "Failed to create backup assignment", err)
		return
	}

	if err := s.logConfigChange(version.ID, "staff_backup_assignments", "INSERT", assignmentData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully created backup assignment")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "staff_backup_assignments",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted new backup assignment to all clients")
}

// handleBackupAssignmentUpdate updates an existing backup assignment and broadcasts changes
func (s *StaffSyncServer) handleBackupAssignmentUpdate(client *Client, msg *Message) {
	log.Printf("📋 Processing SETTINGS_UPDATE_BACKUP_ASSIGNMENT from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	assignmentData, ok := payload["assignment"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing assignment data")
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

	if err := s.updateBackupAssignment(version.ID, assignmentData); err != nil {
		s.sendErrorResponse(client, "Failed to update backup assignment", err)
		return
	}

	if err := s.logConfigChange(version.ID, "staff_backup_assignments", "UPDATE", assignmentData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully updated backup assignment")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "staff_backup_assignments",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated backup assignment to all clients")
}

// handleBackupAssignmentDelete deletes a backup assignment and broadcasts changes
func (s *StaffSyncServer) handleBackupAssignmentDelete(client *Client, msg *Message) {
	log.Printf("🗑️ Processing SETTINGS_DELETE_BACKUP_ASSIGNMENT from client %s", client.clientId)

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid payload format")
		return
	}

	assignmentID, ok := payload["assignmentId"].(string)
	if !ok {
		log.Printf("❌ Missing assignment ID")
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

	if err := s.deleteBackupAssignment(version.ID, assignmentID); err != nil {
		s.sendErrorResponse(client, "Failed to delete backup assignment", err)
		return
	}

	logData := map[string]interface{}{
		"assignmentId": assignmentID,
	}
	if err := s.logConfigChange(version.ID, "staff_backup_assignments", "DELETE", logData); err != nil {
		log.Printf("⚠️ Failed to log config change: %v", err)
	}

	log.Printf("✅ Successfully deleted backup assignment")

	settings, err := s.fetchAggregatedSettings(version.ID)
	if err != nil {
		log.Printf("⚠️ Failed to fetch updated settings: %v", err)
		return
	}

	freshMsg := Message{
		Type: "SETTINGS_SYNC_RESPONSE",
		Payload: map[string]interface{}{
			"settings": settings,
			"updated":  "staff_backup_assignments",
		},
		Timestamp: time.Now(),
		ClientID:  msg.ClientID,
	}

	s.broadcastToAll(&freshMsg)
	log.Printf("📡 Broadcasted updated backup assignments to all clients after deletion")
}

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

// Helper function to get keys from a map
func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
