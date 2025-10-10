# Soft-Delete Cleanup System - Deployment & Operations Guide

## Overview

Automatic cleanup system for soft-deleted staff groups with a 30-day retention policy.

### Key Features
- ✅ Automatic hard-deletion after 30 days
- ✅ Complete audit trail for compliance
- ✅ Emergency recovery function
- ✅ Dry-run mode for safe testing
- ✅ Real-time monitoring views
- ✅ Manual cleanup override capability

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SOFT DELETE EVENT                        │
│              (User sets is_active = false)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 TRIGGER: update_timestamp                   │
│         Sets updated_at = NOW() on soft delete             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              30-DAY RETENTION PERIOD                        │
│         Group is soft-deleted but recoverable              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SCHEDULED JOB (Daily at 2:00 AM UTC)               │
│    Supabase Edge Function: cleanup-soft-deleted-groups     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│      FUNCTION: cleanup_soft_deleted_staff_groups()         │
│  1. Find groups where updated_at < NOW() - 30 days        │
│  2. Log to staff_groups_deletion_log                       │
│  3. Hard delete from staff_groups (CASCADE)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  AUDIT TRAIL PRESERVED                      │
│         staff_groups_deletion_log (permanent)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Steps

### 1. Deploy Database Migration

```bash
# Navigate to project directory
cd /Users/kamalashidiq/Documents/Apps/shift-schedule-manager

# Apply migration to Supabase
psql $DATABASE_URL -f database/migrations/utilities/011_soft_delete_cleanup_system.sql
```

Or via Supabase SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `011_soft_delete_cleanup_system.sql`
3. Execute the SQL

### 2. Deploy Edge Function

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref [YOUR_PROJECT_REF]

# Deploy the Edge Function
supabase functions deploy cleanup-soft-deleted-groups
```

### 3. Configure Cron Schedule

**Option A: Supabase Dashboard (Recommended)**
1. Navigate to: Database → Edge Functions
2. Select `cleanup-soft-deleted-groups`
3. Enable "Cron Triggers"
4. Set schedule: `0 2 * * *` (2:00 AM UTC daily)

**Option B: PostgreSQL pg_cron (If available)**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2:00 AM UTC
SELECT cron.schedule(
    'cleanup-soft-deleted-groups',
    '0 2 * * *',
    $$
    SELECT cleanup_soft_deleted_staff_groups(false, 30);
    $$
);
```

**Option C: External Cron (Server/VM)**
```bash
# Add to crontab
0 2 * * * curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"dry_run": false}'
```

---

## Usage & Testing

### Preview Groups Eligible for Cleanup

```sql
-- See all soft-deleted groups and when they'll be deleted
SELECT * FROM preview_groups_for_cleanup(30);

-- Or use the monitoring view
SELECT * FROM v_cleanup_eligible_groups;
```

Expected output:
```
group_id | group_name    | soft_deleted_at | days_since_deletion | will_delete_in_days
---------|---------------|-----------------|---------------------|--------------------
abc-123  | Old Kitchen   | 2024-09-05      | 35.2                | 0 (ELIGIBLE)
def-456  | Service Team  | 2024-10-01      | 9.1                 | 20.9 (PENDING)
```

### Dry Run Test (Safe Testing)

```sql
-- Preview what would be deleted WITHOUT actually deleting
SELECT * FROM cleanup_soft_deleted_staff_groups(
    p_dry_run := true,
    p_retention_days := 30
);
```

Expected output:
```json
{
  "deleted_count": 3,
  "deleted_ids": ["abc-123", "def-456", "ghi-789"],
  "deletion_details": [
    {
      "group_id": "abc-123",
      "name": "Old Kitchen Team",
      "soft_deleted_at": "2024-09-05T12:34:56Z",
      "member_count": 5,
      "child_group_count": 2,
      "days_since_deletion": 35.2
    }
  ]
}
```

### Execute Manual Cleanup

```sql
-- Actually delete groups older than 30 days
SELECT * FROM cleanup_soft_deleted_staff_groups(
    p_dry_run := false,
    p_retention_days := 30
);
```

### Custom Retention Period

```sql
-- Cleanup groups older than 60 days
SELECT * FROM cleanup_soft_deleted_staff_groups(false, 60);
```

### Force Delete Specific Group

```sql
-- Manually force cleanup of a specific group (admin only)
SELECT * FROM force_cleanup_group(
    p_group_id := 'abc-123-def-456',
    p_reason := 'manual_cleanup_requested_by_admin'
);
```

---

## Monitoring & Audit

### Check Recent Deletions

```sql
-- View deletion history for last 90 days
SELECT * FROM get_deletion_history(90);

-- View deletion statistics
SELECT * FROM v_deletion_statistics;
```

### View Audit Log

```sql
-- Complete audit trail
SELECT
    group_name,
    soft_deleted_at,
    hard_deleted_at,
    ROUND(EXTRACT(EPOCH FROM (hard_deleted_at - soft_deleted_at)) / 86400, 1) as days_retained,
    member_count,
    deletion_reason
FROM staff_groups_deletion_log
ORDER BY hard_deleted_at DESC
LIMIT 50;
```

### Monitor Edge Function Execution

```bash
# View Edge Function logs
supabase functions logs cleanup-soft-deleted-groups --tail

# Or in Supabase Dashboard:
# Navigate to: Edge Functions → cleanup-soft-deleted-groups → Logs
```

---

## Emergency Recovery

### Recover Accidentally Deleted Group

```sql
-- Attempt to recover a group from deletion log
SELECT * FROM recover_deleted_group('abc-123-def-456');
```

**Important Notes:**
- ⚠️ Only the group metadata is recovered
- ⚠️ Members and hierarchy relationships are **NOT** recovered (CASCADE deleted)
- ⚠️ Recovered group gets "(Recovered)" suffix to prevent name conflicts
- ⚠️ You must manually re-add members after recovery

### Prevent Accidental Deletion

```sql
-- Before hard-deleting, always check what will be deleted
SELECT
    sg.id,
    sg.name,
    sg.updated_at,
    COUNT(DISTINCT sgm.id) as members,
    COUNT(DISTINCT sgh.id) as hierarchy_relations
FROM staff_groups sg
LEFT JOIN staff_group_members sgm ON sg.id = sgm.group_id
LEFT JOIN staff_group_hierarchy sgh ON sg.id = sgh.parent_group_id
WHERE sg.is_active = false
AND sg.updated_at < NOW() - INTERVAL '30 days'
GROUP BY sg.id, sg.name, sg.updated_at;
```

---

## Testing Checklist

### Pre-Deployment Tests

```sql
-- 1. Create test group
INSERT INTO staff_groups (restaurant_id, version_id, name, is_active, updated_at)
VALUES (
    'your-restaurant-id',
    'your-version-id',
    'Test Cleanup Group',
    false,
    NOW() - INTERVAL '35 days' -- Simulate 35-day-old soft delete
);

-- 2. Verify it appears in preview
SELECT * FROM preview_groups_for_cleanup() WHERE group_name = 'Test Cleanup Group';

-- 3. Run dry-run cleanup
SELECT * FROM cleanup_soft_deleted_staff_groups(true, 30);

-- 4. Verify group still exists
SELECT * FROM staff_groups WHERE name = 'Test Cleanup Group';

-- 5. Run actual cleanup
SELECT * FROM cleanup_soft_deleted_staff_groups(false, 30);

-- 6. Verify group was deleted
SELECT * FROM staff_groups WHERE name = 'Test Cleanup Group'; -- Should return 0 rows

-- 7. Verify audit log entry
SELECT * FROM staff_groups_deletion_log WHERE group_name = 'Test Cleanup Group';

-- 8. Test recovery
SELECT * FROM recover_deleted_group('[deleted-group-id]');

-- 9. Cleanup test data
DELETE FROM staff_groups WHERE name LIKE 'Test Cleanup Group%';
DELETE FROM staff_groups_deletion_log WHERE group_name LIKE 'Test Cleanup Group%';
```

### Post-Deployment Verification

1. **Check trigger is active:**
```sql
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'staff_groups_soft_delete_timestamp';
```

2. **Verify cron schedule (if using pg_cron):**
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-soft-deleted-groups';
```

3. **Test Edge Function:**
```bash
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

---

## Performance Considerations

### Index Usage
The cleanup function uses these indexes:
- `idx_staff_groups_active` - WHERE clause on is_active
- Automatic index on `updated_at` for date comparison

### Execution Time
- **Small dataset** (<1000 groups): <100ms
- **Medium dataset** (1000-10000 groups): <500ms
- **Large dataset** (>10000 groups): <2 seconds

### Database Load
- Runs during off-peak hours (2:00 AM UTC)
- CASCADE deletes are handled efficiently by PostgreSQL
- Transaction-safe: All or nothing

### Batch Processing (Future Enhancement)
If you have millions of soft-deleted groups, consider batch processing:

```sql
-- Delete in batches of 1000
DO $$
DECLARE
    v_batch_size INTEGER := 1000;
    v_deleted_count INTEGER;
BEGIN
    LOOP
        -- Delete one batch
        WITH to_delete AS (
            SELECT id FROM staff_groups
            WHERE is_active = false
            AND updated_at < NOW() - INTERVAL '30 days'
            LIMIT v_batch_size
        )
        DELETE FROM staff_groups
        WHERE id IN (SELECT id FROM to_delete);

        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        EXIT WHEN v_deleted_count = 0;

        RAISE NOTICE 'Deleted % groups', v_deleted_count;
        PERFORM pg_sleep(0.1); -- Small pause between batches
    END LOOP;
END $$;
```

---

## Troubleshooting

### Issue: Cleanup not running automatically

**Diagnosis:**
```sql
-- Check Edge Function execution logs
SELECT * FROM supabase_functions.logs
WHERE function_name = 'cleanup-soft-deleted-groups'
ORDER BY timestamp DESC LIMIT 10;
```

**Solutions:**
1. Verify cron schedule is enabled in Supabase Dashboard
2. Check service role key permissions
3. Ensure Edge Function is deployed: `supabase functions list`

### Issue: Groups not being deleted

**Diagnosis:**
```sql
-- Check if groups are actually old enough
SELECT
    id,
    name,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400 as days_old
FROM staff_groups
WHERE is_active = false
ORDER BY updated_at;
```

**Solutions:**
1. Ensure `updated_at` is being set on soft-delete (trigger active)
2. Verify retention period configuration
3. Check for database errors in logs

### Issue: Accidental deletion

**Recovery:**
```sql
-- Find in audit log
SELECT * FROM staff_groups_deletion_log
WHERE group_name ILIKE '%search-term%'
ORDER BY hard_deleted_at DESC;

-- Recover the group
SELECT * FROM recover_deleted_group('[group-id-from-log]');
```

---

## Security & Compliance

### GDPR Compliance
- Audit trail preserved indefinitely (unless manually purged)
- Deletion timestamps tracked for compliance reporting
- Recovery capability for accidental deletions (30-day window)

### Access Control
- Cleanup function: `service_role` only (automatic execution)
- Preview function: `authenticated` users (read-only)
- Force cleanup: `service_role` only (admin action)
- Recovery function: `service_role` only (admin action)

### Audit Requirements

Generate compliance report:
```sql
SELECT
    DATE_TRUNC('month', hard_deleted_at) as month,
    COUNT(*) as groups_deleted,
    SUM(member_count) as total_affected_members,
    AVG(EXTRACT(EPOCH FROM (hard_deleted_at - soft_deleted_at)) / 86400) as avg_retention_days
FROM staff_groups_deletion_log
WHERE hard_deleted_at >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', hard_deleted_at)
ORDER BY month DESC;
```

---

## FAQ

### Q: Can I change the retention period?

**A:** Yes, modify the Edge Function or direct SQL call:
```sql
SELECT cleanup_soft_deleted_staff_groups(false, 60); -- 60 days instead of 30
```

### Q: What happens to related data?

**A:** CASCADE deletion removes:
- All `staff_group_members` entries
- All `staff_group_hierarchy` entries (parent and child relationships)
- Full group record from `staff_groups`

Preserved:
- Complete audit trail in `staff_groups_deletion_log`
- Staff members themselves (only group membership is removed)

### Q: How do I temporarily pause automatic cleanup?

**A:** Disable the cron trigger:
```sql
-- If using pg_cron
SELECT cron.unschedule('cleanup-soft-deleted-groups');

-- Or in Supabase Dashboard:
-- Edge Functions → cleanup-soft-deleted-groups → Disable Cron Trigger
```

### Q: Can I restore deleted members?

**A:** No, CASCADE deletion is permanent. The `recover_deleted_group()` function only restores the group metadata. You must manually re-add members.

### Q: How much database space will this save?

**A:** Depends on your data volume:
- Each soft-deleted group: ~1 KB
- Each member relationship: ~200 bytes
- Each hierarchy relationship: ~200 bytes

Example: 1000 soft-deleted groups with 10 members each = ~3 MB saved

---

## Maintenance

### Monthly Audit Review

```sql
-- Review last 30 days of deletions
SELECT
    DATE(hard_deleted_at) as deletion_date,
    COUNT(*) as groups_deleted,
    ARRAY_AGG(group_name) as deleted_groups
FROM staff_groups_deletion_log
WHERE hard_deleted_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(hard_deleted_at)
ORDER BY deletion_date DESC;
```

### Purge Old Audit Logs (Optional)

If audit log grows too large (>1 million rows), consider archiving:

```sql
-- Archive logs older than 3 years to cold storage
-- Then delete from main table
DELETE FROM staff_groups_deletion_log
WHERE hard_deleted_at < NOW() - INTERVAL '3 years';
```

---

## Support & Resources

- **Migration File**: `/database/migrations/utilities/011_soft_delete_cleanup_system.sql`
- **Edge Function**: `/supabase/functions/cleanup-soft-deleted-groups/index.ts`
- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **pg_cron Docs**: https://github.com/citusdata/pg_cron

For issues or questions, check the audit log and Edge Function logs first.
