# Settings & Configuration Backend Integration - Implementation Plan (Multi-Table Architecture)

## Executive Summary

This plan outlines the complete migration of Settings & Configuration from localStorage-only storage to full backend integration (Supabase + Go WebSocket server), following the proven architecture established for Staff Management.

**Migration Goals:**
- Integrate with existing multi-table Supabase settings architecture
- Implement Go WebSocket server handlers for real-time settings synchronization
- Enable multi-user collaboration for settings management
- Apply consistent camelCase ↔ snake_case field conversion
- Handle version control and audit trail via existing infrastructure
- Maintain backward compatibility during migration

**Key Architecture Discovery:**
The database already has a **sophisticated multi-table settings architecture** with version control and audit logging. This plan reflects that actual schema rather than creating new tables.

---

## Phase 1: Database Schema Documentation (Existing Schema)

### 1.1 Actual Database Structure (Verified via Supabase MCP)

The application uses a **multi-table normalized settings architecture** instead of a single JSONB table:

#### Core Settings Tables:

**1. `staff_groups` (9 rows)**
```sql
CREATE TABLE staff_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID REFERENCES config_versions(id),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    group_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

**2. `daily_limits` (3 rows)**
```sql
CREATE TABLE daily_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID REFERENCES config_versions(id),
    name TEXT NOT NULL,
    limit_config JSONB DEFAULT '{}'::jsonb,
    penalty_weight NUMERIC DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**3. `monthly_limits` (4 rows)**
```sql
CREATE TABLE monthly_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID REFERENCES config_versions(id),
    name TEXT NOT NULL,
    limit_config JSONB DEFAULT '{}'::jsonb,
    penalty_weight NUMERIC DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**4. `priority_rules` (4 rows)**
```sql
CREATE TABLE priority_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID REFERENCES config_versions(id),
    name TEXT NOT NULL,
    description TEXT,
    priority_level INTEGER DEFAULT 1,
    rule_definition JSONB DEFAULT '{}'::jsonb,
    rule_config JSONB DEFAULT '{}'::jsonb,
    penalty_weight NUMERIC DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**5. `ml_model_configs` (1 row)**
```sql
CREATE TABLE ml_model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_id UUID REFERENCES config_versions(id),
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    model_config JSONB DEFAULT '{}'::jsonb,
    confidence_threshold NUMERIC DEFAULT 0.75,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Supporting Infrastructure Tables:

**6. `config_versions` (1 row)**
```sql
CREATE TABLE config_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name TEXT,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    UNIQUE(restaurant_id, version_number)
);
```

**7. `config_changes` (0 rows - audit trail)**
```sql
CREATE TABLE config_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID REFERENCES config_versions(id),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);
```

### 1.2 Architecture Characteristics

**Multi-Table Benefits:**
- ✅ Normalized data structure (better data integrity)
- ✅ Version control via `config_versions` table (track configuration history)
- ✅ Audit trail via `config_changes` table (full change history)
- ✅ Multi-tenancy via `restaurant_id` (data isolation)
- ✅ Temporal constraints via `effective_from`/`effective_until` dates
- ✅ Soft deletes via `is_active` flag
- ✅ JSONB flexibility for dynamic config (limit_config, rule_definition, etc.)
- ✅ Constraint management (is_hard_constraint, penalty_weight)

**Key Differences from Original Plan:**
- ❌ No single `settings` table
- ✅ 5 separate settings tables (staff_groups, daily_limits, monthly_limits, priority_rules, ml_model_configs)
- ✅ Version-aware queries (all tables have `version_id` foreign key)
- ✅ Audit logging required (log to `config_changes`)
- ✅ Restaurant context required (filter by `restaurant_id`)

### 1.3 Field Mapping (snake_case ↔ camelCase)

**Database (snake_case) → React (camelCase):**

#### Common Fields (All Tables):
```javascript
{
  id → id
  restaurant_id → restaurantId
  version_id → versionId
  created_at → createdAt
  updated_at → updatedAt
  is_active → isActive
}
```

#### Staff Groups:
```javascript
{
  name → name
  description → description
  color → color
  group_config → groupConfig
}
```

#### Daily/Monthly Limits:
```javascript
{
  name → name
  limit_config → limitConfig
  penalty_weight → penaltyWeight
  is_hard_constraint → isHardConstraint
  effective_from → effectiveFrom
  effective_until → effectiveUntil
}
```

#### Priority Rules:
```javascript
{
  name → name
  description → description
  priority_level → priorityLevel
  rule_definition → ruleDefinition
  rule_config → ruleConfig
  penalty_weight → penaltyWeight
  is_hard_constraint → isHardConstraint
  effective_from → effectiveFrom
  effective_until → effectiveUntil
}
```

#### ML Model Configs:
```javascript
{
  model_name → modelName
  model_type → modelType
  parameters → parameters
  model_config → modelConfig
  confidence_threshold → confidenceThreshold
  is_default → isDefault
}
```

#### Config Versions:
```javascript
{
  version_number → versionNumber
  name → name
  description → description
  created_by → createdBy
  is_locked → isLocked
}
```

### 1.4 Migration Strategy from localStorage

**localStorage Structure:**
```javascript
{
  staffGroups: [{ id, name, members, ... }],
  dailyLimits: [{ name, value, type, ... }],
  monthlyLimits: [{ name, value, type, ... }],
  priorityRules: [{ name, conditions, ... }],
  mlParameters: { modelName, parameters, ... }
}
```

**Database Mapping Strategy:**
```javascript
// 1. Create or get active config_version
const versionId = await getOrCreateActiveVersion(restaurantId);

// 2. Map localStorage arrays to individual table rows
settings.staffGroups.forEach(group => {
  // Insert into staff_groups table with version_id
  INSERT INTO staff_groups (restaurant_id, version_id, name, group_config, ...)
});

settings.dailyLimits.forEach(limit => {
  // Insert into daily_limits table with version_id
  INSERT INTO daily_limits (restaurant_id, version_id, name, limit_config, ...)
});

// 3. Log migration to config_changes
INSERT INTO config_changes (version_id, table_name, operation, new_data, reason)
VALUES (versionId, 'staff_groups', 'INSERT', group_data, 'localStorage migration');
```

**Migration Complexity:**
- ❌ **Not trivial** - Cannot simply copy JSONB to database
- ✅ **Requires transformation** - Array items → individual rows
- ✅ **Requires version management** - Create/reference config_version
- ✅ **Requires audit logging** - Log all migrations
- ✅ **Requires restaurant context** - Determine restaurant_id

**Decision: Keep DataMigrationTab**
- Migration is complex enough to warrant UI-based tool
- User can review mapping before execution
- Provides rollback visibility
- Allows selective migration (table by table)

---

## Phase 2: Go Server Implementation (Multi-Table Architecture)

### 2.1 Message Types

Add new message types to `go-server/main.go`:

```go
// Settings message types (multi-table operations)
const (
    // ... existing staff message types ...

    // Settings management (aggregated)
    MESSAGE_SETTINGS_SYNC_REQUEST    = "SETTINGS_SYNC_REQUEST"
    MESSAGE_SETTINGS_SYNC_RESPONSE   = "SETTINGS_SYNC_RESPONSE"

    // Table-specific updates
    MESSAGE_SETTINGS_UPDATE_STAFF_GROUPS    = "SETTINGS_UPDATE_STAFF_GROUPS"
    MESSAGE_SETTINGS_UPDATE_DAILY_LIMITS    = "SETTINGS_UPDATE_DAILY_LIMITS"
    MESSAGE_SETTINGS_UPDATE_MONTHLY_LIMITS  = "SETTINGS_UPDATE_MONTHLY_LIMITS"
    MESSAGE_SETTINGS_UPDATE_PRIORITY_RULES  = "SETTINGS_UPDATE_PRIORITY_RULES"
    MESSAGE_SETTINGS_UPDATE_ML_CONFIG       = "SETTINGS_UPDATE_ML_CONFIG"

    // Bulk operations
    MESSAGE_SETTINGS_RESET           = "SETTINGS_RESET"
    MESSAGE_SETTINGS_MIGRATE         = "SETTINGS_MIGRATE"

    // Version management
    MESSAGE_SETTINGS_CREATE_VERSION  = "SETTINGS_CREATE_VERSION"
    MESSAGE_SETTINGS_ACTIVATE_VERSION = "SETTINGS_ACTIVATE_VERSION"
)
```

### 2.2 Settings Data Structures

```go
// Aggregated settings response (from all 5 tables)
type SettingsAggregate struct {
    StaffGroups    []StaffGroup      `json:"staffGroups"`
    DailyLimits    []DailyLimit      `json:"dailyLimits"`
    MonthlyLimits  []MonthlyLimit    `json:"monthlyLimits"`
    PriorityRules  []PriorityRule    `json:"priorityRules"`
    MLModelConfigs []MLModelConfig   `json:"mlModelConfigs"`
    Version        ConfigVersion     `json:"version"`
}

// Individual table structures
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
```

### 2.3 Handler Functions

#### 2.3.1 SETTINGS_SYNC_REQUEST Handler (Aggregated Response)

```go
func (s *StaffSyncServer) handleSettingsSyncRequest(client *Client, msg *Message) {
    log.Printf("Processing SETTINGS_SYNC_REQUEST from client %s", client.clientId)

    // Get active version
    version, err := s.fetchActiveConfigVersion()
    if err != nil {
        log.Printf("Error fetching active config version: %v", err)
        s.sendErrorResponse(client, "Failed to fetch config version", err)
        return
    }

    // Fetch all settings tables for active version
    staffGroups, err := s.fetchStaffGroups(version.ID)
    if err != nil {
        s.sendErrorResponse(client, "Failed to fetch staff groups", err)
        return
    }

    dailyLimits, err := s.fetchDailyLimits(version.ID)
    if err != nil {
        s.sendErrorResponse(client, "Failed to fetch daily limits", err)
        return
    }

    monthlyLimits, err := s.fetchMonthlyLimits(version.ID)
    if err != nil {
        s.sendErrorResponse(client, "Failed to fetch monthly limits", err)
        return
    }

    priorityRules, err := s.fetchPriorityRules(version.ID)
    if err != nil {
        s.sendErrorResponse(client, "Failed to fetch priority rules", err)
        return
    }

    mlConfigs, err := s.fetchMLModelConfigs(version.ID)
    if err != nil {
        s.sendErrorResponse(client, "Failed to fetch ML configs", err)
        return
    }

    // Aggregate all settings
    settings := SettingsAggregate{
        StaffGroups:    staffGroups,
        DailyLimits:    dailyLimits,
        MonthlyLimits:  monthlyLimits,
        PriorityRules:  priorityRules,
        MLModelConfigs: mlConfigs,
        Version:        *version,
    }

    log.Printf("Retrieved aggregated settings from Supabase (version %d)", version.VersionNumber)

    // Send aggregated response
    response := Message{
        Type: MESSAGE_SETTINGS_SYNC_RESPONSE,
        Payload: map[string]interface{}{
            "settings":  settings,
            "timestamp": time.Now(),
        },
        Timestamp: time.Now(),
        ClientID:  client.clientId,
    }

    if responseBytes, err := json.Marshal(response); err == nil {
        client.conn.WriteMessage(websocket.TextMessage, responseBytes)
        log.Printf("Sent SETTINGS_SYNC_RESPONSE to client %s", client.clientId)
    } else {
        log.Printf("Error marshaling settings sync response: %v", err)
    }
}
```

#### 2.3.2 Table-Specific Update Handlers

```go
func (s *StaffSyncServer) handleStaffGroupsUpdate(client *Client, msg *Message) {
    log.Printf("Processing SETTINGS_UPDATE_STAFF_GROUPS from client %s", client.clientId)

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
        Type: MESSAGE_SETTINGS_SYNC_RESPONSE,
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

// Similar handlers for:
// - handleDailyLimitsUpdate()
// - handleMonthlyLimitsUpdate()
// - handlePriorityRulesUpdate()
// - handleMLConfigUpdate()
```

#### 2.3.3 SETTINGS_MIGRATE Handler (localStorage → Multi-Table)

```go
func (s *StaffSyncServer) handleSettingsMigrate(client *Client, msg *Message) {
    log.Printf("Processing SETTINGS_MIGRATE from client %s", client.clientId)

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
            // Log migration
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
        Type: MESSAGE_SETTINGS_SYNC_RESPONSE,
        Payload: map[string]interface{}{
            "settings":  migratedSettings,
            "migrated":  true,
            "timestamp": time.Now(),
        },
        Timestamp: time.Now(),
        ClientID:  msg.ClientID,
    }

    client.conn.WriteMessage(websocket.TextMessage, confirmationMsg)
    log.Printf("📡 Sent migration confirmation to client %s", client.clientId)
}
```

#### 2.3.4 SETTINGS_RESET Handler (Multi-Table Reset)

```go
func (s *StaffSyncServer) handleSettingsReset(client *Client, msg *Message) {
    log.Printf("Processing SETTINGS_RESET from client %s", client.clientId)

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

    // 4. Insert default settings into all tables
    defaults := s.getDefaultSettings()

    // Insert default staff groups
    for _, group := range defaults.StaffGroups {
        s.insertStaffGroup(defaultVersion.ID, group)
        s.logConfigChange(defaultVersion.ID, "staff_groups", "INSERT", group)
    }

    // Insert default daily limits
    for _, limit := range defaults.DailyLimits {
        s.insertDailyLimit(defaultVersion.ID, limit)
        s.logConfigChange(defaultVersion.ID, "daily_limits", "INSERT", limit)
    }

    // Insert default monthly limits
    for _, limit := range defaults.MonthlyLimits {
        s.insertMonthlyLimit(defaultVersion.ID, limit)
        s.logConfigChange(defaultVersion.ID, "monthly_limits", "INSERT", limit)
    }

    // Insert default priority rules
    for _, rule := range defaults.PriorityRules {
        s.insertPriorityRule(defaultVersion.ID, rule)
        s.logConfigChange(defaultVersion.ID, "priority_rules", "INSERT", rule)
    }

    // Insert default ML config
    s.insertMLModelConfig(defaultVersion.ID, defaults.MLConfig)
    s.logConfigChange(defaultVersion.ID, "ml_model_configs", "INSERT", defaults.MLConfig)

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
        Type: MESSAGE_SETTINGS_SYNC_RESPONSE,
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
```

### 2.4 Supabase Integration Functions (Multi-Table)

```go
// Fetch active config version
func (s *StaffSyncServer) fetchActiveConfigVersion() (*ConfigVersion, error) {
    url := fmt.Sprintf("%s/rest/v1/config_versions?is_active=eq.true&select=*&order=created_at.desc&limit=1", s.supabaseURL)

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

// Fetch staff groups for version
func (s *StaffSyncServer) fetchStaffGroups(versionID string) ([]StaffGroup, error) {
    url := fmt.Sprintf("%s/rest/v1/staff_groups?version_id=eq.%s&is_active=eq.true&select=*", s.supabaseURL, versionID)

    // ... similar HTTP request logic ...

    var groups []StaffGroup
    json.Unmarshal(body, &groups)
    return groups, nil
}

// Fetch daily limits for version
func (s *StaffSyncServer) fetchDailyLimits(versionID string) ([]DailyLimit, error) {
    url := fmt.Sprintf("%s/rest/v1/daily_limits?version_id=eq.%s&is_active=eq.true&select=*", s.supabaseURL, versionID)

    // ... similar HTTP request logic ...

    var limits []DailyLimit
    json.Unmarshal(body, &limits)
    return limits, nil
}

// Similar functions for:
// - fetchMonthlyLimits(versionID)
// - fetchPriorityRules(versionID)
// - fetchMLModelConfigs(versionID)

// Update staff group (version-aware)
func (s *StaffSyncServer) updateStaffGroup(versionID string, groupData map[string]interface{}) error {
    groupID := groupData["id"].(string)
    url := fmt.Sprintf("%s/rest/v1/staff_groups?id=eq.%s&version_id=eq.%s", s.supabaseURL, groupID, versionID)

    // Add updated_at timestamp
    groupData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

    jsonData, _ := json.Marshal(groupData)
    req, _ := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))

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

// Insert staff group (for migration)
func (s *StaffSyncServer) insertStaffGroup(versionID string, groupData map[string]interface{}) error {
    url := fmt.Sprintf("%s/rest/v1/staff_groups", s.supabaseURL)

    // Add required fields
    groupData["version_id"] = versionID
    groupData["restaurant_id"] = s.restaurantID // From environment or context
    groupData["is_active"] = true
    groupData["created_at"] = time.Now().UTC().Format(time.RFC3339)
    groupData["updated_at"] = time.Now().UTC().Format(time.RFC3339)

    jsonData, _ := json.Marshal(groupData)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))

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

// Log config change to audit trail
func (s *StaffSyncServer) logConfigChange(versionID string, tableName string, operation string, data map[string]interface{}) error {
    url := fmt.Sprintf("%s/rest/v1/config_changes", s.supabaseURL)

    changeLog := map[string]interface{}{
        "version_id":  versionID,
        "table_name":  tableName,
        "operation":   operation,
        "new_data":    data,
        "changed_at":  time.Now().UTC().Format(time.RFC3339),
        "reason":      "WebSocket operation",
    }

    jsonData, _ := json.Marshal(changeLog)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))

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

    return nil
}

// Create new config version
func (s *StaffSyncServer) createConfigVersion(name string, description string) (*ConfigVersion, error) {
    // Get latest version number
    latestVersion, err := s.fetchLatestConfigVersion()
    newVersionNumber := 1
    if err == nil {
        newVersionNumber = latestVersion.VersionNumber + 1
    }

    url := fmt.Sprintf("%s/rest/v1/config_versions", s.supabaseURL)

    versionData := map[string]interface{}{
        "restaurant_id":  s.restaurantID,
        "version_number": newVersionNumber,
        "name":           name,
        "description":    description,
        "is_active":      false, // Activate separately
        "is_locked":      false,
        "created_at":     time.Now().UTC().Format(time.RFC3339),
    }

    jsonData, _ := json.Marshal(versionData)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))

    req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
    req.Header.Set("apikey", s.supabaseKey)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Prefer", "return=representation")

    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to create version: %w", err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)

    var versions []ConfigVersion
    json.Unmarshal(body, &versions)

    if len(versions) == 0 {
        return nil, fmt.Errorf("failed to create version")
    }

    return &versions[0], nil
}

// Activate config version (deactivate all others)
func (s *StaffSyncServer) activateConfigVersion(versionID string) error {
    // 1. Deactivate all versions
    deactivateURL := fmt.Sprintf("%s/rest/v1/config_versions?restaurant_id=eq.%s", s.supabaseURL, s.restaurantID)
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

// Fetch aggregated settings (all tables for version)
func (s *StaffSyncServer) fetchAggregatedSettings(versionID string) (*SettingsAggregate, error) {
    version, err := s.fetchActiveConfigVersion()
    if err != nil {
        return nil, err
    }

    staffGroups, _ := s.fetchStaffGroups(versionID)
    dailyLimits, _ := s.fetchDailyLimits(versionID)
    monthlyLimits, _ := s.fetchMonthlyLimits(versionID)
    priorityRules, _ := s.fetchPriorityRules(versionID)
    mlConfigs, _ := s.fetchMLModelConfigs(versionID)

    return &SettingsAggregate{
        StaffGroups:    staffGroups,
        DailyLimits:    dailyLimits,
        MonthlyLimits:  monthlyLimits,
        PriorityRules:  priorityRules,
        MLModelConfigs: mlConfigs,
        Version:        *version,
    }, nil
}
```

### 2.5 Message Routing Update

```go
// In handleStaffSync function, add settings handlers
switch msg.Type {
    case MESSAGE_SYNC_REQUEST:
        s.handleSyncRequest(client, &msg)
    case MESSAGE_STAFF_UPDATE:
        s.handleStaffUpdate(client, &msg)
    case MESSAGE_STAFF_CREATE:
        s.handleStaffCreate(client, &msg)
    case MESSAGE_STAFF_DELETE:
        s.handleStaffDelete(client, &msg)

    // Settings handlers (multi-table architecture)
    case MESSAGE_SETTINGS_SYNC_REQUEST:
        s.handleSettingsSyncRequest(client, &msg)
    case MESSAGE_SETTINGS_UPDATE_STAFF_GROUPS:
        s.handleStaffGroupsUpdate(client, &msg)
    case MESSAGE_SETTINGS_UPDATE_DAILY_LIMITS:
        s.handleDailyLimitsUpdate(client, &msg)
    case MESSAGE_SETTINGS_UPDATE_MONTHLY_LIMITS:
        s.handleMonthlyLimitsUpdate(client, &msg)
    case MESSAGE_SETTINGS_UPDATE_PRIORITY_RULES:
        s.handlePriorityRulesUpdate(client, &msg)
    case MESSAGE_SETTINGS_UPDATE_ML_CONFIG:
        s.handleMLConfigUpdate(client, &msg)
    case MESSAGE_SETTINGS_MIGRATE:
        s.handleSettingsMigrate(client, &msg)
    case MESSAGE_SETTINGS_RESET:
        s.handleSettingsReset(client, &msg)
    case MESSAGE_SETTINGS_CREATE_VERSION:
        s.handleCreateConfigVersion(client, &msg)
    case MESSAGE_SETTINGS_ACTIVATE_VERSION:
        s.handleActivateConfigVersion(client, &msg)

    default:
        log.Printf("Unknown message type: %s", msg.Type)
}
```

---

## Phase 3: React Integration (Multi-Table Support)

### 3.1 WebSocket Hook: `useWebSocketSettings.js`

```javascript
/**
 * WebSocket Settings Management Hook (Multi-Table Architecture)
 * Real-time settings synchronization with Go server + Supabase multi-table backend
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket message types matching Go server implementation
const MESSAGE_TYPES = {
  SETTINGS_SYNC_REQUEST: 'SETTINGS_SYNC_REQUEST',
  SETTINGS_SYNC_RESPONSE: 'SETTINGS_SYNC_RESPONSE',

  // Table-specific updates
  SETTINGS_UPDATE_STAFF_GROUPS: 'SETTINGS_UPDATE_STAFF_GROUPS',
  SETTINGS_UPDATE_DAILY_LIMITS: 'SETTINGS_UPDATE_DAILY_LIMITS',
  SETTINGS_UPDATE_MONTHLY_LIMITS: 'SETTINGS_UPDATE_MONTHLY_LIMITS',
  SETTINGS_UPDATE_PRIORITY_RULES: 'SETTINGS_UPDATE_PRIORITY_RULES',
  SETTINGS_UPDATE_ML_CONFIG: 'SETTINGS_UPDATE_ML_CONFIG',

  // Bulk operations
  SETTINGS_RESET: 'SETTINGS_RESET',
  SETTINGS_MIGRATE: 'SETTINGS_MIGRATE',

  // Version management
  SETTINGS_CREATE_VERSION: 'SETTINGS_CREATE_VERSION',
  SETTINGS_ACTIVATE_VERSION: 'SETTINGS_ACTIVATE_VERSION',

  CONNECTION_ACK: 'CONNECTION_ACK',
  ERROR: 'ERROR'
};

export const useWebSocketSettings = (options = {}) => {
  const { enabled = true, autoMigrate = true } = options;

  const [settings, setSettings] = useState(null);
  const [version, setVersion] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState(null);
  const wsRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectTimeoutRef = useRef(null);
  const connectionFailedPermanently = useRef(false);
  const initialConnectionTimer = useRef(null);
  const migrationAttempted = useRef(false);

  // Message handlers
  const handleSettingsSyncResponse = useCallback((payload) => {
    const settingsData = payload.settings || {};
    const versionData = settingsData.version || null;

    // Separate version from settings
    const { version: _, ...actualSettings } = settingsData;

    setSettings(actualSettings);
    setVersion(versionData);
    setIsLoading(false);

    console.log('📊 Settings synced from multi-table backend:', actualSettings);
    console.log('📌 Active config version:', versionData?.versionNumber);

    // If this was a migration response, mark as complete
    if (payload.migrated) {
      localStorage.setItem('settings-migrated-to-backend', 'true');
      console.log('✅ Settings migration completed (localStorage → multi-table)');
    }

    // If this was a reset response
    if (payload.reset) {
      console.log('🔄 Settings reset to defaults (multi-table)');
    }
  }, []);

  // ... (WebSocket connection logic similar to original, but with multi-table awareness)

  // Settings operation methods (table-specific)
  const updateStaffGroups = useCallback((groupData) => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_UPDATE_STAFF_GROUPS,
      payload: { group: groupData },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent staff groups update:', groupData);
    return Promise.resolve();
  }, [enabled]);

  const updateDailyLimits = useCallback((limitData) => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_UPDATE_DAILY_LIMITS,
      payload: { limit: limitData },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent daily limits update:', limitData);
    return Promise.resolve();
  }, [enabled]);

  // Similar methods for:
  // - updateMonthlyLimits()
  // - updatePriorityRules()
  // - updateMLConfig()

  const resetSettings = useCallback(() => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_RESET,
      payload: {},
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent settings reset (multi-table)');
    return Promise.resolve();
  }, [enabled]);

  const migrateSettings = useCallback((settingsData) => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_MIGRATE,
      payload: { settings: settingsData },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent settings migration (localStorage → multi-table)');
    return Promise.resolve();
  }, [enabled]);

  const createVersion = useCallback((name, description) => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_CREATE_VERSION,
      payload: { name, description },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent create version request');
    return Promise.resolve();
  }, [enabled]);

  const activateVersion = useCallback((versionId) => {
    if (!enabled || wsRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    const message = {
      type: MESSAGE_TYPES.SETTINGS_ACTIVATE_VERSION,
      payload: { versionId },
      timestamp: new Date().toISOString(),
      clientId: clientIdRef.current
    };

    wsRef.current.send(JSON.stringify(message));
    console.log('📤 Sent activate version request:', versionId);
    return Promise.resolve();
  }, [enabled]);

  return {
    // Core data (aggregated from multi-table)
    settings,
    version,

    // Table-specific operations
    updateStaffGroups,
    updateDailyLimits,
    updateMonthlyLimits,
    updatePriorityRules,
    updateMLConfig,

    // Bulk operations
    resetSettings,
    migrateSettings,

    // Version management
    createVersion,
    activateVersion,

    // Connection state
    connectionStatus,
    isLoading,
    isConnected: connectionStatus === 'connected',
    lastError,
    connectionFailedPermanently: connectionFailedPermanently.current,

    // Debug info
    reconnectAttempts: reconnectAttempts.current,
    clientId: clientIdRef.current
  };
};

export default useWebSocketSettings;
```

### 3.2 Update `useSettingsData.js` Hook

```javascript
import { useState, useEffect, useCallback } from "react";
import { configService } from "../services/ConfigurationService";
import { useAutosave } from "./useAutosave";
import { useWebSocketSettings } from "./useWebSocketSettings";

// Feature flag for WebSocket settings
const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

export const useSettingsData = (autosaveEnabled = true) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(autosaveEnabled);

  // WebSocket hook (multi-table architecture)
  const {
    settings: wsSettings,
    version: wsVersion,
    updateStaffGroups: wsUpdateStaffGroups,
    updateDailyLimits: wsUpdateDailyLimits,
    updateMonthlyLimits: wsUpdateMonthlyLimits,
    updatePriorityRules: wsUpdatePriorityRules,
    updateMLConfig: wsUpdateMLConfig,
    resetSettings: wsResetSettings,
    migrateSettings: wsMigrateSettings,
    isConnected: wsConnected,
    connectionStatus,
    isLoading: wsLoading,
    lastError: wsError
  } = useWebSocketSettings({
    enabled: WEBSOCKET_SETTINGS_ENABLED,
    autoMigrate: true
  });

  // Determine which backend to use
  const useWebSocket = WEBSOCKET_SETTINGS_ENABLED && wsConnected;

  // Sync WebSocket settings to local state (aggregate multi-table data)
  useEffect(() => {
    if (useWebSocket && wsSettings) {
      // Transform multi-table response to localStorage-compatible format
      const aggregatedSettings = {
        staffGroups: wsSettings.staffGroups || [],
        dailyLimits: wsSettings.dailyLimits || [],
        monthlyLimits: wsSettings.monthlyLimits || [],
        priorityRules: wsSettings.priorityRules || [],
        mlParameters: wsSettings.mlModelConfigs?.[0] || {},
        version: wsVersion,
      };

      setSettings(aggregatedSettings);
      setIsLoading(false);
      setHasUnsavedChanges(false);
    }
  }, [useWebSocket, wsSettings, wsVersion]);

  // Update settings with table-specific operations
  const updateSettings = useCallback((newSettings) => {
    if (useWebSocket) {
      // Detect which table was modified and send specific update
      const oldSettings = settings || {};

      if (JSON.stringify(oldSettings.staffGroups) !== JSON.stringify(newSettings.staffGroups)) {
        // Staff groups changed
        newSettings.staffGroups.forEach(group => {
          wsUpdateStaffGroups(group);
        });
      }

      if (JSON.stringify(oldSettings.dailyLimits) !== JSON.stringify(newSettings.dailyLimits)) {
        // Daily limits changed
        newSettings.dailyLimits.forEach(limit => {
          wsUpdateDailyLimits(limit);
        });
      }

      if (JSON.stringify(oldSettings.monthlyLimits) !== JSON.stringify(newSettings.monthlyLimits)) {
        // Monthly limits changed
        newSettings.monthlyLimits.forEach(limit => {
          wsUpdateMonthlyLimits(limit);
        });
      }

      if (JSON.stringify(oldSettings.priorityRules) !== JSON.stringify(newSettings.priorityRules)) {
        // Priority rules changed
        newSettings.priorityRules.forEach(rule => {
          wsUpdatePriorityRules(rule);
        });
      }

      if (JSON.stringify(oldSettings.mlParameters) !== JSON.stringify(newSettings.mlParameters)) {
        // ML config changed
        wsUpdateMLConfig(newSettings.mlParameters);
      }
    } else {
      // localStorage mode
      setSettings(newSettings);
      setHasUnsavedChanges(true);
    }
    setValidationErrors({});
  }, [useWebSocket, settings, wsUpdateStaffGroups, wsUpdateDailyLimits, wsUpdateMonthlyLimits, wsUpdatePriorityRules, wsUpdateMLConfig]);

  // Reset to defaults (multi-table aware)
  const resetToDefaults = useCallback(async () => {
    try {
      setIsLoading(true);

      if (useWebSocket) {
        // WebSocket mode: send multi-table reset to Go server
        await wsResetSettings();
      } else {
        // localStorage mode: use configService
        await configService.resetToDefaults();
        const defaultSettings = configService.getSettingsSync();
        setSettings(defaultSettings);
      }

      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to reset to defaults:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsResetSettings]);

  // Migrate localStorage → multi-table backend
  const migrateToBackend = useCallback(async () => {
    if (!useWebSocket) {
      throw new Error('WebSocket not connected');
    }

    try {
      setIsLoading(true);

      // Get localStorage settings
      const localSettings = localStorage.getItem('shift-schedule-settings');
      if (!localSettings) {
        throw new Error('No localStorage settings to migrate');
      }

      const parsedSettings = JSON.parse(localSettings);

      // Send migration request (will map to multi-table structure on server)
      await wsMigrateSettings(parsedSettings);

      console.log('✅ Migration initiated (localStorage → multi-table backend)');
    } catch (err) {
      console.error("Failed to migrate settings:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsMigrateSettings]);

  return {
    // State
    settings,
    version: wsVersion,
    isLoading: useWebSocket ? wsLoading : isLoading,
    error,
    hasUnsavedChanges,
    validationErrors,

    // Actions (multi-table aware)
    updateSettings,
    resetToDefaults,
    migrateToBackend,

    // Backend mode indicator
    backendMode: useWebSocket ? 'websocket-multitable' : 'localStorage',
    isConnectedToBackend: useWebSocket,
    connectionStatus: useWebSocket ? connectionStatus : 'localStorage',

    // Version info
    currentVersion: wsVersion?.versionNumber,
    versionName: wsVersion?.name,
    isVersionLocked: wsVersion?.isLocked
  };
};
```

### 3.3 Keep DataMigrationTab (Enhanced for Multi-Table)

**Rationale:** Migration complexity warrants UI-based tool with visibility into multi-table mapping.

Update `DataMigrationTab.jsx` to show:
- Source: localStorage (flat structure)
- Target: Multi-table backend (staff_groups, daily_limits, monthly_limits, priority_rules, ml_model_configs)
- Mapping preview before migration
- Version creation during migration
- Audit trail visibility

```javascript
const DataMigrationTab = () => {
  const { migrateToBackend, backendMode, currentVersion } = useSettingsData();
  const [showMappingPreview, setShowMappingPreview] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('not_started');

  const handleMigrate = async () => {
    setMigrationStatus('in_progress');

    try {
      await migrateToBackend();
      setMigrationStatus('completed');
    } catch (err) {
      setMigrationStatus('failed');
    }
  };

  return (
    <div className="data-migration-tab">
      <h3>Multi-Table Backend Migration</h3>

      <div className="migration-info">
        <p><strong>Backend Mode:</strong> {backendMode}</p>
        <p><strong>Current Version:</strong> {currentVersion || 'N/A'}</p>
      </div>

      <div className="migration-mapping">
        <h4>Migration Mapping</h4>
        <table>
          <thead>
            <tr>
              <th>localStorage Key</th>
              <th>Target Table</th>
              <th>Mapping Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>staffGroups[]</td>
              <td>staff_groups</td>
              <td>Array → Rows</td>
            </tr>
            <tr>
              <td>dailyLimits[]</td>
              <td>daily_limits</td>
              <td>Array → Rows</td>
            </tr>
            <tr>
              <td>monthlyLimits[]</td>
              <td>monthly_limits</td>
              <td>Array → Rows</td>
            </tr>
            <tr>
              <td>priorityRules[]</td>
              <td>priority_rules</td>
              <td>Array → Rows</td>
            </tr>
            <tr>
              <td>mlParameters{}</td>
              <td>ml_model_configs</td>
              <td>Object → Row</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        onClick={handleMigrate}
        disabled={migrationStatus === 'in_progress' || backendMode === 'websocket-multitable'}
      >
        {migrationStatus === 'in_progress' ? 'Migrating...' : 'Migrate to Multi-Table Backend'}
      </button>

      {migrationStatus === 'completed' && (
        <div className="success-message">
          ✅ Migration completed! Data now stored in multi-table architecture with version control.
        </div>
      )}
    </div>
  );
};
```

### 3.4 Add Backend Status Indicator (Multi-Table Aware)

```javascript
// In SettingsModal.jsx
const SettingsModal = ({ isOpen, onClose }) => {
  const {
    settings,
    isLoading,
    backendMode,
    isConnectedToBackend,
    connectionStatus,
    currentVersion,
    versionName,
    isVersionLocked
  } = useSettingsData();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal-header">
        <h2>Settings & Configuration</h2>

        {/* Backend Status Badge (Multi-Table Architecture) */}
        <div className="backend-status">
          {backendMode === 'websocket-multitable' ? (
            <div className="badge badge-success">
              <span>🟢 Real-time Multi-Table Sync</span>
              <div className="version-info">
                <small>Version {currentVersion}: {versionName}</small>
                {isVersionLocked && <span className="lock-icon">🔒</span>}
              </div>
            </div>
          ) : (
            <span className="badge badge-warning">
              📱 Local Storage Mode
            </span>
          )}
        </div>
      </div>

      {/* Rest of modal content */}
    </Modal>
  );
};
```

---

## Phase 4: Testing & Validation (Multi-Table Specific)

### 4.1 Unit Testing

**Go Server Tests:**
```go
// go-server/settings_test.go
func TestFetchAggregatedSettings(t *testing.T) {
    // Test aggregation from 5 tables
    server := createTestServer()

    settings, err := server.fetchAggregatedSettings(testVersionID)
    assert.NoError(t, err)

    assert.NotNil(t, settings.StaffGroups)
    assert.NotNil(t, settings.DailyLimits)
    assert.NotNil(t, settings.MonthlyLimits)
    assert.NotNil(t, settings.PriorityRules)
    assert.NotNil(t, settings.MLModelConfigs)
    assert.NotNil(t, settings.Version)
}

func TestVersionControl(t *testing.T) {
    // Test version creation and activation
    server := createTestServer()

    version, err := server.createConfigVersion("Test Version", "Testing")
    assert.NoError(t, err)
    assert.Equal(t, 2, version.VersionNumber) // Should increment

    err = server.activateConfigVersion(version.ID)
    assert.NoError(t, err)

    activeVersion, _ := server.fetchActiveConfigVersion()
    assert.Equal(t, version.ID, activeVersion.ID)
}

func TestAuditTrail(t *testing.T) {
    // Test config_changes logging
    server := createTestServer()

    groupData := map[string]interface{}{"name": "Test Group"}
    err := server.logConfigChange(testVersionID, "staff_groups", "INSERT", groupData)
    assert.NoError(t, err)

    // Verify change was logged
    changes := server.fetchConfigChanges(testVersionID)
    assert.Greater(t, len(changes), 0)
}

func TestMultiTableMigration(t *testing.T) {
    // Test localStorage → multi-table migration
    server := createTestServer()

    localStorageData := map[string]interface{}{
        "staffGroups":   []interface{}{...},
        "dailyLimits":   []interface{}{...},
        "monthlyLimits": []interface{}{...},
        "priorityRules": []interface{}{...},
        "mlParameters":  map[string]interface{}{...},
    }

    version, err := server.migrateLocalStorageToMultiTable(localStorageData)
    assert.NoError(t, err)

    // Verify all tables populated
    staffGroups, _ := server.fetchStaffGroups(version.ID)
    assert.Greater(t, len(staffGroups), 0)

    dailyLimits, _ := server.fetchDailyLimits(version.ID)
    assert.Greater(t, len(dailyLimits), 0)
}
```

**React Tests:**
```javascript
// src/hooks/__tests__/useWebSocketSettings.test.js
describe('useWebSocketSettings (Multi-Table)', () => {
  test('receives aggregated settings from multi-table backend', async () => {
    const { result } = renderHook(() => useWebSocketSettings());

    await waitFor(() => {
      expect(result.current.settings).toHaveProperty('staffGroups');
      expect(result.current.settings).toHaveProperty('dailyLimits');
      expect(result.current.settings).toHaveProperty('monthlyLimits');
      expect(result.current.settings).toHaveProperty('priorityRules');
      expect(result.current.settings).toHaveProperty('mlModelConfigs');
      expect(result.current.version).toHaveProperty('versionNumber');
    });
  });

  test('sends table-specific update messages', async () => {
    const { result } = renderHook(() => useWebSocketSettings());

    const groupData = { id: '1', name: 'Test Group' };
    await act(() => result.current.updateStaffGroups(groupData));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('SETTINGS_UPDATE_STAFF_GROUPS')
    );
  });

  test('handles version control operations', async () => {
    const { result } = renderHook(() => useWebSocketSettings());

    await act(() => result.current.createVersion('v2', 'New version'));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('SETTINGS_CREATE_VERSION')
    );
  });
});
```

### 4.2 Integration Testing

**Multi-Table Specific Tests:**
- ✅ Settings aggregate correctly from all 5 tables
- ✅ Version control creates/activates versions properly
- ✅ Audit trail logs all changes to config_changes
- ✅ Restaurant isolation (RLS) works correctly
- ✅ Locked versions cannot be modified
- ✅ Migration maps localStorage arrays to individual table rows
- ✅ Temporal constraints (effective_from/until) are respected
- ✅ JSONB config fields serialize/deserialize correctly
- ✅ Soft deletes (is_active) work as expected
- ✅ Constraint management (hard vs soft) functions properly

### 4.3 Browser Testing Scenarios

**Test Case: Multi-Table Migration**
1. Create settings in localStorage (old format)
2. Enable WebSocket settings
3. Trigger migration via DataMigrationTab
4. Verify:
   - New config_version created
   - All arrays mapped to individual rows in tables
   - Audit trail contains migration records
   - Active version updated
   - UI reflects migrated data

**Test Case: Version Control**
1. Create settings version 1
2. Make changes
3. Create version 2
4. Switch between versions
5. Verify UI updates to reflect version data
6. Lock version 1
7. Verify locked version cannot be modified

**Test Case: Cross-Table Consistency**
1. Update staff groups in Tab 1
2. Update daily limits in Tab 2
3. Verify both changes persist
4. Verify audit trail shows both operations
5. Verify version number consistent across tables

### 4.4 Performance Testing

**Multi-Table Specific Metrics:**
- Aggregated settings load time (5 table JOIN query)
- Table-specific update latency
- Version switch time
- Migration time for large datasets
- Audit trail query performance

**Performance Targets:**
- Aggregated load: < 300ms (5 tables)
- Table update: < 100ms
- Version switch: < 500ms
- Migration: < 2s for typical dataset

### 4.5 Data Integrity Testing

**Multi-Table Specific Validation:**
- ✅ All tables reference correct version_id
- ✅ All tables reference correct restaurant_id
- ✅ JSONB fields maintain structure (group_config, limit_config, rule_definition, etc.)
- ✅ Foreign key constraints enforced
- ✅ Cascade deletes work correctly
- ✅ Audit trail captures old_data and new_data
- ✅ Timestamps auto-update correctly

---

## Migration Execution Plan (Multi-Table Architecture)

### Step 1: Verify Database Schema (Day 1)

```bash
# 1. Connect to Supabase and verify tables exist
npx supabase db pull

# 2. Verify table structure
psql -h db.ymdyejrljmvajqjbejvh.supabase.co -U postgres

\d staff_groups
\d daily_limits
\d monthly_limits
\d priority_rules
\d ml_model_configs
\d config_versions
\d config_changes

# 3. Verify sample data
SELECT * FROM config_versions WHERE is_active = true;
SELECT COUNT(*) FROM staff_groups;
SELECT COUNT(*) FROM daily_limits;

# 4. Document schema (already complete - no new tables needed)
```

### Step 2: Implement Go Server Multi-Table Handlers (Day 2-4)

```bash
# 1. Create settings_multitable.go file
touch go-server/settings_multitable.go

# 2. Implement all handler functions from Phase 2
# 3. Add message types to main.go
# 4. Add routing in handleStaffSync

# 5. Test multi-table operations
cd go-server
go test ./... -v -run TestMultiTable

# 6. Test version control
go test ./... -v -run TestVersionControl

# 7. Test audit trail
go test ./... -v -run TestAuditTrail

# 8. Build and run server
go build -o staff-sync-server main.go settings_multitable.go
./staff-sync-server
```

### Step 3: Implement React WebSocket Hook (Day 5)

```bash
# 1. Create useWebSocketSettings hook with multi-table support
touch src/hooks/useWebSocketSettings.js

# 2. Implement table-specific operations
# 3. Add version control support
# 4. Add unit tests

touch src/hooks/__tests__/useWebSocketSettings.test.js

npm test useWebSocketSettings
```

### Step 4: Update useSettingsData Hook (Day 6)

```bash
# 1. Update useSettingsData.js with multi-table WebSocket integration
# 2. Add aggregation logic
# 3. Update tests
# 4. Run integration tests

REACT_APP_WEBSOCKET_SETTINGS=true npm start
```

### Step 5: Update DataMigrationTab (Day 7)

```bash
# 1. Enhance DataMigrationTab with multi-table mapping visualization
# 2. Add migration preview
# 3. Add version creation during migration
# 4. Test migration flow
```

### Step 6: Add Backend Status Indicator (Day 7)

```bash
# 1. Update SettingsModal with multi-table status
# 2. Show version info
# 3. Show locked version indicator
# 4. Test visual appearance
```

### Step 7: Integration Testing (Day 8-9)

```bash
# 1. Run full test suite
npm test

# 2. Test multi-table migration
# 3. Test version control
# 4. Test audit trail
# 5. Test cross-table consistency
# 6. Test restaurant isolation
```

### Step 8: Production Deployment (Day 10)

```bash
# 1. Build Go server for production
cd go-server
go build -o staff-sync-server-production -ldflags="-s -w" main.go settings_multitable.go

# 2. Build React app with WebSocket enabled
cd ..
REACT_APP_WEBSOCKET_SETTINGS=true npm run build:production

# 3. Deploy to production
docker-compose up -d

# 4. Monitor multi-table queries
docker-compose logs -f go-websocket-server | grep "settings"
```

---

## Rollback Plan (Multi-Table Aware)

### Emergency Rollback to localStorage

```bash
# 1. Disable WebSocket settings
REACT_APP_WEBSOCKET_SETTINGS=false

# 2. Rebuild and redeploy
npm run build:production

# 3. Settings automatically fallback to localStorage
# 4. No data loss - multi-table data preserved in database
```

### Data Recovery (Multi-Table)

```sql
-- Export settings from multi-table backend
SELECT json_build_object(
  'staffGroups', (SELECT json_agg(sg.*) FROM staff_groups sg WHERE version_id = 'active_version_id'),
  'dailyLimits', (SELECT json_agg(dl.*) FROM daily_limits dl WHERE version_id = 'active_version_id'),
  'monthlyLimits', (SELECT json_agg(ml.*) FROM monthly_limits ml WHERE version_id = 'active_version_id'),
  'priorityRules', (SELECT json_agg(pr.*) FROM priority_rules pr WHERE version_id = 'active_version_id'),
  'mlParameters', (SELECT row_to_json(mmc.*) FROM ml_model_configs mmc WHERE version_id = 'active_version_id' LIMIT 1)
) AS settings_export;

-- Import to localStorage
localStorage.setItem('shift-schedule-settings', JSON.stringify(settings_export));
```

---

## Success Criteria (Multi-Table Architecture)

- ✅ All settings load correctly from multi-table backend (5 tables aggregated)
- ✅ Settings save to correct tables based on type
- ✅ Version control creates/activates versions properly
- ✅ Audit trail logs all changes to config_changes table
- ✅ Restaurant isolation works (RLS via restaurant_id)
- ✅ Locked versions cannot be modified
- ✅ Auto-migration from localStorage maps correctly to multi-table structure
- ✅ Field name conversion works (camelCase ↔ snake_case)
- ✅ WebSocket connection stable with multi-table queries
- ✅ Fallback to localStorage works when server unavailable
- ✅ DataMigrationTab provides visibility into multi-table mapping
- ✅ Backend status indicator shows version info
- ✅ All tests pass (unit, integration, browser)
- ✅ Performance targets met for multi-table queries
- ✅ No data loss during migration
- ✅ Cross-table consistency maintained
- ✅ Temporal constraints respected (effective_from/until)

---

## File Structure Summary (Multi-Table Architecture)

### New Files to Create:

```
📁 go-server/
├── settings_multitable.go               # Multi-table settings handlers
├── settings_multitable_test.go          # Multi-table tests

📁 src/
├── hooks/
│   ├── useWebSocketSettings.js          # Multi-table WebSocket hook
│   └── __tests__/
│       └── useWebSocketSettings.test.js # Multi-table tests
```

### Files to Modify:

```
📁 go-server/
├── main.go                              # Add multi-table message types and routing

📁 src/
├── hooks/
│   ├── useSettingsData.js               # Add multi-table WebSocket integration
│   └── __tests__/
│       └── useSettingsData.test.js      # Update tests

├── components/
│   └── settings/
│       ├── SettingsModal.jsx            # Add multi-table status indicator
│       └── DataMigrationTab.jsx         # Update with multi-table mapping preview
```

### Files NOT to Delete:

```
📁 src/
└── components/
    └── settings/
        └── DataMigrationTab.jsx         # KEEP - migration complexity warrants UI tool
```

---

## Environment Variables

Add to `.env`:

```bash
# Settings WebSocket Configuration (Multi-Table Architecture)
REACT_APP_WEBSOCKET_SETTINGS=true

# Go Server Configuration
REACT_APP_WEBSOCKET_URL=ws://localhost:8080

# Restaurant Context (for multi-tenancy)
REACT_APP_RESTAURANT_ID=default-restaurant-id
```

Add to `go-server/.env`:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://ymdyejrljmvajqjbejvh.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# Server Configuration
WEBSOCKET_PORT=8080

# Restaurant Context (for RLS)
RESTAURANT_ID=default-restaurant-id
```

---

## Timeline Estimate (Multi-Table Architecture)

**Total Duration: 10 days**

- **Day 1**: Database schema verification and documentation
- **Day 2-4**: Go server multi-table implementation (handlers + Supabase queries)
- **Day 5**: React WebSocket hook with multi-table support
- **Day 6**: Update useSettingsData hook with aggregation logic
- **Day 7**: Update DataMigrationTab + Add status indicator
- **Day 8-9**: Comprehensive multi-table integration testing
- **Day 10**: Production deployment and monitoring

**Note**: Increased timeline due to multi-table complexity (vs. 8 days for single-table approach).

---

## Key Architectural Decisions

### 1. Why Keep DataMigrationTab?

**Original Plan:** Remove DataMigrationTab after migration
**Actual Decision:** Keep and enhance DataMigrationTab

**Rationale:**
- Multi-table migration is **significantly more complex** than JSONB copy
- localStorage arrays must map to individual table rows
- Version control must be created during migration
- Audit trail must log migration operations
- Users need visibility into mapping before execution
- Rollback capability requires understanding of multi-table structure

### 2. Why Multi-Table Instead of Single JSONB Table?

**Discovered Architecture Benefits:**
- ✅ **Data Integrity**: Foreign key constraints, normalized structure
- ✅ **Version Control**: Track configuration history
- ✅ **Audit Trail**: Full change history with old/new data
- ✅ **Multi-Tenancy**: Restaurant-level isolation
- ✅ **Temporal Constraints**: Effective date ranges
- ✅ **Flexible Constraints**: Hard vs soft, penalty weights
- ✅ **Query Efficiency**: Index individual tables vs scanning JSONB

**Trade-offs:**
- ❌ More complex queries (5 table aggregation)
- ❌ More complex migration (array → rows)
- ❌ Longer development time
- ✅ Better long-term maintainability
- ✅ Better data integrity
- ✅ Better audit capabilities

### 3. Why Version Control?

The `config_versions` table enables:
- **Rollback**: Switch to previous working configuration
- **A/B Testing**: Compare different settings versions
- **Change Tracking**: See what changed when
- **Locking**: Prevent modification of production configs
- **Branching**: Create variations without affecting active config

---

## References

### Database Schema:
- **Verified via Supabase MCP**: Tables exist with data
- **5 Settings Tables**: staff_groups (9 rows), daily_limits (3 rows), monthly_limits (4 rows), priority_rules (4 rows), ml_model_configs (1 row)
- **Version Control**: config_versions (1 row active)
- **Audit Trail**: config_changes (empty, ready for logging)

### Similar Implementations:
- **Staff Management**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useWebSocketStaff.js`
- **Go Server Handlers**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/go-server/main.go`

### Documentation:
- **WebSocket Protocol**: CLAUDE.md - "WebSocket Protocol" section
- **Hybrid Architecture**: CLAUDE.md - "Hybrid Architecture" section
- **Testing Strategy**: CLAUDE.md - "Testing Guidelines" section

---

**Document Version:** 2.0 (Multi-Table Architecture)
**Last Updated:** 2025-10-02
**Author:** Claude Code Assistant
**Status:** Ready for Implementation (Updated to reflect actual database schema)
**Architecture:** Multi-Table Normalized Design with Version Control and Audit Trail
