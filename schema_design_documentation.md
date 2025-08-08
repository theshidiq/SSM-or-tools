# Restaurant Shift Scheduling Database Schema Design

## Overview

This database schema is designed for a configurable ML-powered restaurant shift scheduling system using Supabase. It supports multi-tenancy, version control, complex business rules, and ML model configuration with comprehensive audit trails.

## Key Design Decisions

### 1. Multi-Tenancy Architecture

**Decision**: Use `restaurant_id` foreign keys with Row Level Security (RLS)
**Rationale**: 
- Each restaurant is completely isolated
- Supabase RLS provides automatic security enforcement
- Scalable for SaaS deployment
- No data leakage between tenants

### 2. Configuration Versioning System

**Decision**: Implement version control with `config_versions` table
**Rationale**:
- Allows rollback to previous configurations
- Change tracking for compliance and debugging
- A/B testing of different rule sets
- Safe configuration updates with fallback

**Tables**:
- `config_versions`: Version metadata
- `config_changes`: Detailed audit trail of all changes

### 3. Flexible JSON Rule Storage

**Decision**: Use JSONB columns for rule definitions
**Rationale**:
- Rules have varying structures (group vs individual conflicts)
- Easy to extend without schema migrations  
- PostgreSQL JSONB provides indexing and querying capabilities
- Supports complex nested conditions

**Example rule structures**:
```json
{
  "type": "group_conflict",
  "groups": ["kitchen_team_id", "service_team_id"],
  "constraint": "cannot_work_same_shift"
}
```

### 4. Separation of Concerns

**Decision**: Separate tables for different constraint types
**Rationale**:
- `conflict_rules`: Staff/group conflicts
- `daily_limits`: Per-day constraints
- `monthly_limits`: Monthly distribution rules
- `priority_rules`: Preference and priority handling

This separation enables:
- Optimized queries for specific constraint types
- Clear business logic organization
- Independent scaling of different rule types

### 5. ML Model Configuration Management

**Decision**: Store ML parameters in JSONB with performance tracking
**Rationale**:
- Different algorithms need different parameters
- A/B testing of model configurations
- Performance monitoring and optimization
- Version control of ML models alongside business rules

## Schema Components

### Core Tables

#### 1. `restaurants`
- Multi-tenant isolation
- Business settings and timezone configuration
- Soft delete capability

#### 2. `staff`  
- Employee information with flexible metadata
- Links to restaurant for tenant isolation
- Position and skill level tracking

#### 3. `config_versions`
- Version control for all configurations
- Single active version per restaurant
- Change attribution and rollback capability

### Rule Configuration Tables

#### 4. `staff_groups` & `staff_group_members`
- Logical grouping of staff (Kitchen, Service, etc.)
- Many-to-many relationship for flexible assignments
- Color coding for UI visualization

#### 5. `conflict_rules`
- Staff/group conflicts and constraints
- Hard vs soft constraints
- Penalty weights for ML optimization

#### 6. `daily_limits`
- Per-day shift distribution limits
- Day-of-week specific rules
- Minimum/maximum staffing requirements

#### 7. `monthly_limits`
- Monthly off-day limits
- Fair distribution enforcement
- Consecutive day restrictions

#### 8. `priority_rules`
- Individual preferences (料理長 Sunday early)
- Business priority enforcement
- Weighted preference system

#### 9. `ml_model_configs`
- Algorithm parameters and weights
- Confidence thresholds
- Multiple model support

#### 10. `ml_model_performance`
- Performance tracking over time
- User satisfaction scoring
- Optimization metrics

## Performance Optimizations

### Indexing Strategy

1. **Tenant Isolation**: `restaurant_id` indexes on all tables
2. **Version Access**: Active version lookups
3. **Frequent Reads**: Rule lookup during scheduling
4. **JSON Querying**: GIN indexes on JSONB rule types
5. **Audit Trails**: Time-based indexes for change tracking

### Query Optimization

```sql
-- Optimized active rules query
SELECT cr.*, sg.name as group_name
FROM conflict_rules cr
LEFT JOIN staff_groups sg ON sg.id = (cr.conflict_definition->>'group_id')::uuid
WHERE cr.restaurant_id = $1 
  AND cr.version_id = get_active_config_version($1)
  AND cr.is_active = true;
```

### RLS Performance

- Policies use indexed columns (`restaurant_id`)
- Simplified policy logic for fast evaluation
- User profile caching for repeated access

## Security Implementation

### Row Level Security (RLS)

All tables have RLS policies that:
- Restrict access by restaurant_id
- Use user_profiles table for authorization
- Prevent cross-tenant data access
- Support role-based permissions

### Audit Trail

- All configuration changes logged
- User attribution for every change
- Before/after data capture
- Reason codes for changes

## Usage Examples

### Creating New Configuration Version

```sql
-- Create new version
SELECT create_config_version(
  'restaurant_uuid', 
  'Summer 2024 Rules', 
  'Updated rules for summer season'
);

-- Add rules to new version
INSERT INTO conflict_rules (restaurant_id, version_id, name, ...)
VALUES (...);

-- Activate when ready
SELECT activate_config_version('new_version_uuid');
```

### ML Model Integration

```sql
-- Get active ML configuration
SELECT parameters, confidence_threshold
FROM ml_model_configs 
WHERE restaurant_id = $1 
  AND version_id = get_active_config_version($1)
  AND is_default = true;

-- Log performance results
INSERT INTO ml_model_performance 
(model_config_id, execution_date, fitness_score, user_satisfaction_score)
VALUES ($1, CURRENT_DATE, $2, $3);
```

### Constraint Validation

```sql
-- Check active constraints for scheduling
WITH active_config AS (
  SELECT get_active_config_version($1) as version_id
)
SELECT 
  cr.name,
  cr.conflict_definition,
  cr.penalty_weight,
  cr.is_hard_constraint
FROM conflict_rules cr, active_config ac
WHERE cr.restaurant_id = $1
  AND cr.version_id = ac.version_id
  AND cr.is_active = true
  AND (cr.effective_from IS NULL OR cr.effective_from <= CURRENT_DATE)
  AND (cr.effective_until IS NULL OR cr.effective_until >= CURRENT_DATE);
```

## Scalability Considerations

### Horizontal Scaling
- Restaurant-based partitioning possible
- Read replicas for scheduling queries
- Separate OLAP database for analytics

### Performance Monitoring
- `pg_stat_statements` for query analysis
- Custom metrics for ML performance
- Constraint violation tracking

### Data Retention
- Archive old configuration versions
- Performance data aggregation
- Audit log rotation

## Migration Strategy

### Phase 1: Core Schema
1. Deploy base tables with RLS
2. Create initial restaurant and staff data
3. Set up basic configuration version

### Phase 2: Business Rules
1. Migrate existing scheduling rules to JSON format
2. Create staff groups and memberships
3. Configure basic conflict and limit rules

### Phase 3: ML Integration
1. Deploy ML model configuration
2. Set up performance tracking
3. Begin automated scheduling with fallback

### Phase 4: Advanced Features
1. Add priority rules and preferences
2. Implement violation tracking
3. Enable version rollback capabilities

## Monitoring Queries

### Configuration Health Check
```sql
SELECT 
  r.name,
  cv.name as active_config,
  COUNT(DISTINCT cr.id) as conflict_rules,
  COUNT(DISTINCT dl.id) as daily_limits,
  COUNT(DISTINCT ml.id) as monthly_limits,
  COUNT(DISTINCT pr.id) as priority_rules
FROM restaurants r
JOIN config_versions cv ON cv.restaurant_id = r.id AND cv.is_active = true
LEFT JOIN conflict_rules cr ON cr.version_id = cv.id AND cr.is_active = true
LEFT JOIN daily_limits dl ON dl.version_id = cv.id AND dl.is_active = true  
LEFT JOIN monthly_limits ml ON ml.version_id = cv.id AND ml.is_active = true
LEFT JOIN priority_rules pr ON pr.version_id = cv.id AND pr.is_active = true
GROUP BY r.id, r.name, cv.name;
```

### Performance Trending
```sql
SELECT 
  DATE_TRUNC('week', execution_date) as week,
  AVG(fitness_score) as avg_fitness,
  AVG(execution_time_ms) as avg_execution_time,
  AVG(user_satisfaction_score) as avg_satisfaction
FROM ml_model_performance mp
JOIN ml_model_configs mc ON mc.id = mp.model_config_id
WHERE mc.restaurant_id = $1
  AND execution_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY week
ORDER BY week;
```

### Constraint Violation Analysis
```sql
SELECT 
  violation_type,
  COUNT(*) as violation_count,
  AVG(penalty_applied) as avg_penalty,
  COUNT(*) FILTER (WHERE resolution_status = 'resolved') as resolved_count
FROM constraint_violations
WHERE restaurant_id = $1
  AND created_at >= CURRENT_DATE - INTERVAL '1 month'
GROUP BY violation_type
ORDER BY violation_count DESC;
```

This schema provides a robust foundation for a sophisticated restaurant scheduling system with ML optimization, comprehensive rule management, and enterprise-grade security and audit capabilities.