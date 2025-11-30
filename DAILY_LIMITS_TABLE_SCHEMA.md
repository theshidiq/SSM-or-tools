# Daily Limits Table Schema Documentation

## Overview
The `daily_limits` table stores per-day constraints for shift scheduling (min/max off days, early shifts, late shifts, etc.). This table follows the multi-table WebSocket backend architecture pattern used by `staff_groups`, `priority_rules`, and other configuration tables.

## Table Created
**Table Name**: `public.daily_limits`
**Status**: ✅ Successfully created
**Date Created**: 2025-11-30
**Project**: shift_schedule (ymdyejrljmvajqjbejvh)
**Region**: ap-northeast-1

---

## Table Structure

### Columns

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `restaurant_id` | UUID | NO | - | Foreign key to `restaurants.id` (CASCADE DELETE) |
| `version_id` | UUID | NO | - | Foreign key to `config_versions.id` (CASCADE DELETE) |
| `name` | VARCHAR | NO | - | Configuration name (e.g., "Default Daily Constraints") |
| `limit_config` | JSONB | NO | See below | Daily limits configuration object |
| `penalty_weight` | NUMERIC | YES | `1.0` | Weight for soft constraint violations |
| `is_hard_constraint` | BOOLEAN | YES | `false` | If true, violations are not allowed |
| `effective_from` | DATE | YES | - | Start date for this configuration (NULL = applies to all) |
| `effective_until` | DATE | YES | - | End date for this configuration (NULL = no expiration) |
| `is_active` | BOOLEAN | YES | `true` | Soft delete flag |
| `created_at` | TIMESTAMPTZ | YES | `now()` | Timestamp when record was created |
| `updated_at` | TIMESTAMPTZ | YES | `now()` | Timestamp when record was last updated |

### Default `limit_config` Structure

```json
{
  "minOffPerDay": 0,
  "maxOffPerDay": 3,
  "minEarlyPerDay": 0,
  "maxEarlyPerDay": 2,
  "minLatePerDay": 0,
  "maxLatePerDay": 3,
  "minWorkingStaffPerDay": 3
}
```

**Field Definitions**:
- `minOffPerDay`: Minimum number of staff who must have the day off (×)
- `maxOffPerDay`: Maximum number of staff who can have the day off (×)
- `minEarlyPerDay`: Minimum number of early shift assignments (△)
- `maxEarlyPerDay`: Maximum number of early shift assignments (△)
- `minLatePerDay`: Minimum number of late shift assignments (◇)
- `maxLatePerDay`: Maximum number of late shift assignments (◇)
- `minWorkingStaffPerDay`: Minimum total staff working (not off)

---

## Indexes

The following indexes were created for optimal query performance:

| Index Name | Type | Columns | Condition |
|------------|------|---------|-----------|
| `daily_limits_pkey1` | UNIQUE BTREE | `id` | - |
| `idx_daily_limits_restaurant_id` | BTREE | `restaurant_id` | - |
| `idx_daily_limits_version_id` | BTREE | `version_id` | - |
| `idx_daily_limits_active` | BTREE | `is_active` | `WHERE is_active = true` |
| `idx_daily_limits_effective_dates` | BTREE | `effective_from, effective_until` | `WHERE effective_from IS NOT NULL OR effective_until IS NOT NULL` |

### Index Usage Recommendations

1. **Query by restaurant and version**: Use composite filter for best performance
   ```sql
   SELECT * FROM daily_limits
   WHERE restaurant_id = ? AND version_id = ? AND is_active = true;
   ```

2. **Date-based filtering**: Leverage the effective_dates index
   ```sql
   SELECT * FROM daily_limits
   WHERE restaurant_id = ?
     AND (effective_from IS NULL OR effective_from <= ?)
     AND (effective_until IS NULL OR effective_until >= ?);
   ```

---

## Row Level Security (RLS)

**Status**: ✅ Enabled

**Policy**: `Allow all operations for authenticated users`
- **Applies to**: ALL operations (SELECT, INSERT, UPDATE, DELETE)
- **For**: `authenticated` role
- **Using**: `true` (all rows visible)
- **With Check**: `true` (all inserts/updates allowed)

This matches the security pattern used by other configuration tables in the system.

---

## Triggers

### Auto-update Timestamp Trigger

**Trigger Name**: `trigger_daily_limits_updated_at`
**Function**: `update_daily_limits_updated_at()`
**When**: BEFORE UPDATE
**Action**: Automatically sets `updated_at = now()` on every update

---

## Foreign Key Constraints

1. **Restaurant Relationship**
   - Column: `restaurant_id`
   - References: `public.restaurants(id)`
   - On Delete: CASCADE
   - Ensures daily limits are deleted when restaurant is deleted

2. **Version Relationship**
   - Column: `version_id`
   - References: `public.config_versions(id)`
   - On Delete: CASCADE
   - Ensures daily limits are deleted when config version is deleted

---

## Integration with WebSocket Backend

### Current Integration Status

The `daily_limits` table is now ready for WebSocket integration. Based on the existing code in `useSettingsData.js`:

**Line 192**: Daily limits are currently localStorage-only
```javascript
dailyLimits: wsSettings?.dailyLimits ?? {
  minOffPerDay: 0,
  maxOffPerDay: 3,
  minEarlyPerDay: 0,
  maxEarlyPerDay: 2,
  minLatePerDay: 0,
  maxLatePerDay: 3
}
```

**Lines 740-748**: Daily limits change detection exists but is localStorage-only
```javascript
// Detect and update daily limits (localStorage-only for now)
// Note: dailyLimits are not stored in a separate WebSocket table
// They're part of the settings blob in localStorage
if (
  JSON.stringify(oldSettings.dailyLimits) !==
  JSON.stringify(newSettings.dailyLimits)
) {
  console.log("  - Daily limits changed (localStorage-only):", newSettings.dailyLimits);
}
```

### Next Steps for Integration

To integrate this table with the WebSocket backend, you'll need to:

1. **Add WebSocket Hooks** (similar to `staff_groups`, `priority_rules`):
   - `wsUpdateDailyLimits()` - Update existing daily limits
   - `wsCreateDailyLimit()` - Create new daily limit configuration
   - `wsDeleteDailyLimit()` - Soft-delete daily limit configuration

2. **Update Go WebSocket Server**:
   - Add daily_limits table handlers in state manager
   - Add message types: `DAILY_LIMITS_UPDATE`, `DAILY_LIMITS_CREATE`, `DAILY_LIMITS_DELETE`
   - Include daily_limits in `SYNC_RESPONSE` messages

3. **Update `useSettingsData.js`**:
   - Remove "localStorage-only" comment on line 192
   - Replace lines 740-748 with proper WebSocket update logic
   - Add daily limits to the multi-table change detection system

4. **Update UI Component** (`LimitsTab.jsx`):
   - Connect to WebSocket hooks instead of direct localStorage
   - Remove autosave logic (WebSocket is authoritative)
   - Add real-time sync indicators

---

## Migration Strategy

### Migrating Existing localStorage Data

If you have existing daily limits in localStorage, you'll need to migrate them to the database:

```javascript
// Example migration code
async function migrateDailyLimitsToDatabase() {
  const localSettings = JSON.parse(localStorage.getItem('shift-schedule-settings'));
  const dailyLimits = localSettings?.dailyLimits;

  if (dailyLimits) {
    // Get current restaurant and version
    const restaurantId = 'your-restaurant-id';
    const versionId = 'your-version-id';

    // Insert into daily_limits table
    await supabase.from('daily_limits').insert({
      restaurant_id: restaurantId,
      version_id: versionId,
      name: 'Default Daily Constraints',
      limit_config: dailyLimits,
      is_active: true
    });
  }
}
```

### Default Data Insertion

For new restaurants/versions, insert default daily limits:

```sql
INSERT INTO public.daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  is_active
) VALUES (
  'your-restaurant-id',
  'your-version-id',
  'Default Daily Constraints',
  '{
    "minOffPerDay": 0,
    "maxOffPerDay": 3,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 2,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 3
  }'::jsonb,
  true
);
```

---

## Query Examples

### 1. Get Active Daily Limits for Restaurant/Version

```sql
SELECT
  id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  effective_from,
  effective_until,
  created_at,
  updated_at
FROM public.daily_limits
WHERE restaurant_id = 'your-restaurant-id'
  AND version_id = 'your-version-id'
  AND is_active = true
ORDER BY created_at DESC;
```

### 2. Get Daily Limits for Specific Date Range

```sql
SELECT
  id,
  name,
  limit_config
FROM public.daily_limits
WHERE restaurant_id = 'your-restaurant-id'
  AND version_id = 'your-version-id'
  AND is_active = true
  AND (effective_from IS NULL OR effective_from <= '2025-12-01')
  AND (effective_until IS NULL OR effective_until >= '2025-12-01')
ORDER BY effective_from DESC NULLS LAST;
```

### 3. Update Daily Limits Configuration

```sql
UPDATE public.daily_limits
SET
  limit_config = '{
    "minOffPerDay": 1,
    "maxOffPerDay": 4,
    "minEarlyPerDay": 0,
    "maxEarlyPerDay": 3,
    "minLatePerDay": 0,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 4
  }'::jsonb
WHERE id = 'your-daily-limits-id';
-- updated_at is automatically updated by trigger
```

### 4. Soft Delete Daily Limits

```sql
UPDATE public.daily_limits
SET is_active = false
WHERE id = 'your-daily-limits-id';
```

### 5. Create New Daily Limits Configuration

```sql
INSERT INTO public.daily_limits (
  restaurant_id,
  version_id,
  name,
  limit_config,
  penalty_weight,
  is_hard_constraint,
  effective_from,
  effective_until,
  is_active
) VALUES (
  'your-restaurant-id',
  'your-version-id',
  'Holiday Constraints',
  '{
    "minOffPerDay": 0,
    "maxOffPerDay": 2,
    "minEarlyPerDay": 1,
    "maxEarlyPerDay": 3,
    "minLatePerDay": 1,
    "maxLatePerDay": 3,
    "minWorkingStaffPerDay": 5
  }'::jsonb,
  2.0,  -- Higher penalty weight for holidays
  true, -- Hard constraint
  '2025-12-25',
  '2025-12-25',
  true
) RETURNING id;
```

---

## Database Performance Optimization

### Expected Query Patterns

1. **High Frequency**:
   - Get active daily limits by restaurant + version
   - Update limit_config values

2. **Medium Frequency**:
   - Date-based filtering for effective ranges
   - Soft delete operations

3. **Low Frequency**:
   - Create new configurations
   - Hard delete (via CASCADE from version deletion)

### Optimization Recommendations

1. **Use Prepared Statements**: For repeated queries with different parameters
2. **Batch Updates**: When updating multiple configurations
3. **JSONB Indexing**: If querying specific fields within `limit_config`, add GIN index:
   ```sql
   CREATE INDEX idx_daily_limits_config_gin ON public.daily_limits USING gin(limit_config);
   ```
4. **Connection Pooling**: Use Supabase connection pooler for high-traffic scenarios

---

## Monitoring & Maintenance

### Recommended Monitoring Queries

**1. Count Active Configurations per Restaurant**
```sql
SELECT
  restaurant_id,
  COUNT(*) as active_configs
FROM public.daily_limits
WHERE is_active = true
GROUP BY restaurant_id;
```

**2. Detect Orphaned Records** (no matching restaurant/version)
```sql
SELECT dl.*
FROM public.daily_limits dl
LEFT JOIN public.restaurants r ON dl.restaurant_id = r.id
LEFT JOIN public.config_versions cv ON dl.version_id = cv.id
WHERE r.id IS NULL OR cv.id IS NULL;
```

**3. Find Overlapping Effective Dates**
```sql
SELECT
  dl1.id as config1_id,
  dl1.name as config1_name,
  dl1.effective_from as config1_from,
  dl1.effective_until as config1_until,
  dl2.id as config2_id,
  dl2.name as config2_name,
  dl2.effective_from as config2_from,
  dl2.effective_until as config2_until
FROM public.daily_limits dl1
JOIN public.daily_limits dl2
  ON dl1.restaurant_id = dl2.restaurant_id
  AND dl1.version_id = dl2.version_id
  AND dl1.id < dl2.id
WHERE dl1.is_active = true
  AND dl2.is_active = true
  AND (
    (dl1.effective_from, dl1.effective_until) OVERLAPS
    (dl2.effective_from, dl2.effective_until)
  );
```

---

## Comparison with Other Configuration Tables

| Feature | `daily_limits` | `staff_groups` | `priority_rules` | `weekly_limits` |
|---------|---------------|----------------|------------------|-----------------|
| Multi-tenant | ✅ restaurant_id | ✅ restaurant_id | ✅ restaurant_id | ✅ restaurant_id |
| Versioned | ✅ version_id | ✅ version_id | ✅ version_id | ✅ version_id |
| Soft Delete | ✅ is_active | ✅ is_active | ✅ is_active | ✅ is_active |
| JSONB Config | ✅ limit_config | ✅ group_config | ✅ rule_definition | ✅ limit_config |
| Date Range | ✅ effective_from/until | ❌ | ✅ effective_from/until | ✅ effective_from/until |
| Constraint Enforcement | ✅ penalty_weight, is_hard_constraint | ❌ | ✅ penalty_weight, is_hard_constraint | ✅ penalty_weight, is_hard_constraint |
| Auto-update Timestamp | ✅ Trigger | ✅ Trigger | ✅ Trigger | ✅ Trigger |
| RLS Enabled | ✅ | ✅ | ❌ | ✅ |

---

## Testing Recommendations

### 1. Unit Tests
- Test JSONB validation for `limit_config`
- Test CASCADE DELETE behavior
- Test RLS policies with different user roles
- Test trigger functionality on updates

### 2. Integration Tests
- Test WebSocket CRUD operations
- Test real-time sync between clients
- Test migration from localStorage to database
- Test conflict resolution scenarios

### 3. Load Tests
- Test concurrent updates from multiple clients
- Test query performance with large datasets
- Test index effectiveness

---

## Troubleshooting

### Common Issues

**Issue 1**: Daily limits not syncing from WebSocket
- **Cause**: WebSocket hooks not implemented yet
- **Solution**: Daily limits are still localStorage-only. Follow integration steps above.

**Issue 2**: Cannot insert daily limits (foreign key violation)
- **Cause**: Invalid `restaurant_id` or `version_id`
- **Solution**: Ensure restaurant and version exist before insertion

**Issue 3**: RLS denying access
- **Cause**: User not authenticated or wrong role
- **Solution**: Verify user is authenticated with `authenticated` role

**Issue 4**: `updated_at` not updating automatically
- **Cause**: Trigger not firing
- **Solution**: Verify trigger exists with `\dft update_daily_limits_updated_at` in psql

---

## Schema Version

**Schema Version**: 1.0
**Created**: 2025-11-30
**Last Modified**: 2025-11-30
**Status**: Production Ready (Database Layer)
**Integration Status**: Pending WebSocket Implementation

---

## References

- **Related Tables**: `staff_groups`, `priority_rules`, `weekly_limits`, `monthly_limits`
- **Integration Hook**: `useSettingsData.js` (lines 192, 740-748)
- **UI Component**: `LimitsTab.jsx` (formerly `WeeklyLimitsTab.jsx`)
- **Go Server**: Pending implementation in state manager

---

## SQL Schema Export

```sql
-- Complete table creation script (for reference)
CREATE TABLE IF NOT EXISTS public.daily_limits (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.config_versions(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    limit_config JSONB NOT NULL DEFAULT '{
        "minOffPerDay": 0,
        "maxOffPerDay": 3,
        "minEarlyPerDay": 0,
        "maxEarlyPerDay": 2,
        "minLatePerDay": 0,
        "maxLatePerDay": 3,
        "minWorkingStaffPerDay": 3
    }'::jsonb,
    penalty_weight NUMERIC DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_daily_limits_restaurant_id ON public.daily_limits(restaurant_id);
CREATE INDEX idx_daily_limits_version_id ON public.daily_limits(version_id);
CREATE INDEX idx_daily_limits_active ON public.daily_limits(is_active) WHERE is_active = true;
CREATE INDEX idx_daily_limits_effective_dates ON public.daily_limits(effective_from, effective_until)
    WHERE effective_from IS NOT NULL OR effective_until IS NOT NULL;

-- RLS
ALTER TABLE public.daily_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users" ON public.daily_limits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger
CREATE OR REPLACE FUNCTION update_daily_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_daily_limits_updated_at
    BEFORE UPDATE ON public.daily_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_limits_updated_at();
```

---

**End of Documentation**
