# Soft-Delete Cleanup System - Quick Reference Card

## 🚀 Common Operations

### Check What Will Be Deleted (Safe)
```sql
-- Preview all soft-deleted groups and their status
SELECT * FROM v_cleanup_eligible_groups ORDER BY days_since_deletion DESC;
```

### Test Cleanup (No Changes)
```sql
-- Dry-run mode: See what would be deleted WITHOUT deleting
SELECT * FROM cleanup_soft_deleted_staff_groups(true, 30);
```

### Run Cleanup Manually
```sql
-- Execute cleanup for groups older than 30 days
SELECT * FROM cleanup_soft_deleted_staff_groups(false, 30);
```

### View Recent Deletions
```sql
-- See deletion history for last 30 days
SELECT * FROM get_deletion_history(30);
```

---

## 📊 Monitoring Queries

### Active Soft-Deleted Groups
```sql
SELECT
    name,
    ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400, 1) as days_deleted,
    CASE
        WHEN updated_at < NOW() - INTERVAL '30 days' THEN '⚠️ WILL DELETE SOON'
        ELSE '✓ Still in retention period'
    END as status
FROM staff_groups
WHERE is_active = false
ORDER BY updated_at;
```

### Today's Cleanup Summary
```sql
SELECT
    COUNT(*) as groups_deleted_today,
    SUM(member_count) as total_members_affected,
    ARRAY_AGG(group_name) as deleted_groups
FROM staff_groups_deletion_log
WHERE DATE(hard_deleted_at) = CURRENT_DATE;
```

### Audit Trail Search
```sql
-- Find deleted groups by name
SELECT * FROM staff_groups_deletion_log
WHERE group_name ILIKE '%search_term%'
ORDER BY hard_deleted_at DESC;
```

---

## 🔧 Admin Operations

### Force Delete Specific Group (Bypass 30-day wait)
```sql
-- Warning: Immediate deletion!
SELECT * FROM force_cleanup_group(
    'group-uuid-here',
    'reason: admin_requested'
);
```

### Emergency Recovery
```sql
-- Attempt to recover a deleted group
SELECT * FROM recover_deleted_group('deleted-group-uuid');
```

### Change Retention Period
```sql
-- Custom retention: 60 days instead of 30
SELECT * FROM cleanup_soft_deleted_staff_groups(false, 60);
```

---

## 🧪 Testing Commands

### Test with Dry-Run
```bash
# Via Edge Function
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

### Run Full Test Suite
```bash
# Execute comprehensive tests
psql $DATABASE_URL -f database/tests/test_cleanup_system.sql
```

---

## 📈 Key Metrics

### Retention Policy
- **Default**: 30 days from soft-delete
- **Customizable**: 1-365 days
- **Execution**: Daily at 2:00 AM UTC

### What Gets Deleted
- ✅ Soft-deleted staff groups (is_active = false)
- ✅ All group members (CASCADE)
- ✅ All hierarchy relationships (CASCADE)
- ❌ Staff members themselves (preserved)

### Audit Trail
- **Preserved**: Group metadata, member counts, deletion timestamps
- **Recovery Window**: Indefinite (audit log never auto-deletes)
- **Recovery Limitations**: Only group metadata recoverable, not members

---

## ⚠️ Safety Checks

### Before Running Cleanup
```sql
-- 1. Check what will be deleted
SELECT COUNT(*) FROM v_cleanup_eligible_groups WHERE cleanup_status = 'ELIGIBLE';

-- 2. Review specific groups
SELECT * FROM preview_groups_for_cleanup(30);

-- 3. Run dry-run first
SELECT * FROM cleanup_soft_deleted_staff_groups(true, 30);
```

### After Running Cleanup
```sql
-- 1. Verify deletions
SELECT COUNT(*) FROM staff_groups_deletion_log WHERE DATE(hard_deleted_at) = CURRENT_DATE;

-- 2. Check for errors
SELECT * FROM staff_groups WHERE is_active = false AND updated_at < NOW() - INTERVAL '30 days';
-- Should return 0 rows after cleanup
```

---

## 🆘 Troubleshooting

### Groups Not Being Deleted
```sql
-- Check if trigger is updating timestamp
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'staff_groups_soft_delete_timestamp';
```

### Verify Last Cleanup Run
```sql
-- Check last execution time
SELECT MAX(hard_deleted_at) as last_cleanup_run
FROM staff_groups_deletion_log;
```

### Check Edge Function Status
```bash
# View recent logs
supabase functions logs cleanup-soft-deleted-groups --tail

# Test manually
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/cleanup-soft-deleted-groups \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"dry_run": true}'
```

---

## 📞 Quick Help

### Question: How do I know if cleanup is running?
**Answer:**
```sql
SELECT MAX(hard_deleted_at) FROM staff_groups_deletion_log;
-- Should show today's date if ran successfully
```

### Question: Can I undo a deletion?
**Answer:**
```sql
-- Partial recovery possible (only group metadata, not members)
SELECT * FROM recover_deleted_group('[uuid]');
```

### Question: How do I pause automatic cleanup?
**Answer:**
1. **Supabase Dashboard**: Edge Functions → Disable Cron Trigger
2. **pg_cron**: `SELECT cron.unschedule('cleanup-soft-deleted-groups');`

### Question: Where are my deleted groups?
**Answer:**
```sql
-- Check audit log
SELECT * FROM staff_groups_deletion_log
WHERE group_name ILIKE '%your_group_name%'
ORDER BY hard_deleted_at DESC;
```

---

## 📚 Documentation

- **Full Guide**: `/docs/SOFT_DELETE_CLEANUP_GUIDE.md`
- **Migration File**: `/database/migrations/utilities/011_soft_delete_cleanup_system.sql`
- **Edge Function**: `/supabase/functions/cleanup-soft-deleted-groups/index.ts`
- **Test Suite**: `/database/tests/test_cleanup_system.sql`

---

## ✅ Daily Checklist

- [ ] Check soft-deleted groups: `SELECT * FROM v_cleanup_eligible_groups;`
- [ ] Review deletion log: `SELECT * FROM get_deletion_history(7);`
- [ ] Verify cron running: Check last cleanup date
- [ ] Monitor storage: Check audit log size
- [ ] Test dry-run: Monthly verification

---

## 🔐 Permissions Required

| Operation | Role Required | SQL Function |
|-----------|--------------|--------------|
| Preview eligible groups | `authenticated` | `preview_groups_for_cleanup()` |
| Dry-run cleanup | `authenticated` | `cleanup_soft_deleted_staff_groups(true, 30)` |
| Actual cleanup | `service_role` | `cleanup_soft_deleted_staff_groups(false, 30)` |
| Force delete | `service_role` | `force_cleanup_group()` |
| Recovery | `service_role` | `recover_deleted_group()` |

---

**Last Updated**: 2025-10-10
**System Version**: 1.0.0
**Contact**: See project documentation for support
