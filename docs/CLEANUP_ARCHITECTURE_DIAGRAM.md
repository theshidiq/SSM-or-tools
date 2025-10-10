# Soft-Delete Cleanup System - Architecture Diagrams

## System Overview Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                         USER INTERFACE LAYER                               │
│                                                                            │
│  [Staff Group Management UI]                                              │
│           │                                                                │
│           │ User clicks "Delete Group"                                     │
│           │                                                                │
│           ▼                                                                │
│  UPDATE staff_groups SET is_active = false WHERE id = '...'              │
│                                                                            │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     │
┌────────────────────────────────────▼───────────────────────────────────────┐
│                                                                            │
│                      DATABASE TRIGGER LAYER                                │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────┐          │
│  │ TRIGGER: staff_groups_soft_delete_timestamp                │          │
│  │                                                             │          │
│  │  IF (OLD.is_active = true AND NEW.is_active = false) THEN  │          │
│  │    NEW.updated_at = NOW()                                  │          │
│  │  END IF                                                     │          │
│  │                                                             │          │
│  │  Result: Timestamp marks exact soft-delete moment          │          │
│  └────────────────────────────────────────────────────────────┘          │
│                                                                            │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     │
                                     ▼
              ┌──────────────────────────────────────┐
              │                                      │
              │   RETENTION PERIOD: 30 DAYS          │
              │                                      │
              │   Group remains in database:         │
              │   - is_active = false                │
              │   - updated_at = deletion timestamp  │
              │   - Visible in admin queries         │
              │   - Can be manually recovered        │
              │                                      │
              └──────────────┬───────────────────────┘
                             │
                             │ After 30 days...
                             │
┌────────────────────────────▼───────────────────────────────────────────────┐
│                                                                            │
│                    SCHEDULED EXECUTION LAYER                               │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────┐            │
│  │  CRON TRIGGER: "0 2 * * *" (2:00 AM UTC Daily)           │            │
│  │                                                           │            │
│  │  Supabase Dashboard → Edge Functions →                   │            │
│  │  cleanup-soft-deleted-groups → Enable Cron               │            │
│  └─────────────────────┬────────────────────────────────────┘            │
│                        │                                                  │
│                        ▼                                                  │
│  ┌──────────────────────────────────────────────────────────┐            │
│  │  EDGE FUNCTION: cleanup-soft-deleted-groups              │            │
│  │  (TypeScript/Deno)                                       │            │
│  │                                                           │            │
│  │  1. Check last run time (prevent duplicates)             │            │
│  │  2. Call PostgreSQL function                             │            │
│  │  3. Log execution results                                │            │
│  │  4. Return JSON response                                 │            │
│  └─────────────────────┬────────────────────────────────────┘            │
│                        │                                                  │
│                        │ Invokes SQL function                             │
│                        │                                                  │
└────────────────────────┼──────────────────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼───────────────────────────────────────────────────┐
│                                                                            │
│                    CLEANUP EXECUTION LAYER                                 │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────┐            │
│  │  FUNCTION: cleanup_soft_deleted_staff_groups()           │            │
│  │  (PostgreSQL PL/pgSQL)                                   │            │
│  │                                                           │            │
│  │  FOR each group WHERE:                                   │            │
│  │    - is_active = false                                   │            │
│  │    - updated_at < NOW() - 30 days                        │            │
│  │  DO:                                                      │            │
│  │    ┌──────────────────────────────────────────┐         │            │
│  │    │ Step 1: Count related records            │         │            │
│  │    │   - staff_group_members                  │         │            │
│  │    │   - staff_group_hierarchy                │         │            │
│  │    └──────────────────────────────────────────┘         │            │
│  │                    │                                     │            │
│  │                    ▼                                     │            │
│  │    ┌──────────────────────────────────────────┐         │            │
│  │    │ Step 2: Create audit log entry           │         │            │
│  │    │   INSERT INTO staff_groups_deletion_log  │         │            │
│  │    │   - Full group metadata                  │         │            │
│  │    │   - Member/hierarchy counts              │         │            │
│  │    │   - Timestamps                           │         │            │
│  │    │   - Deletion reason                      │         │            │
│  │    └──────────────────────────────────────────┘         │            │
│  │                    │                                     │            │
│  │                    ▼                                     │            │
│  │    ┌──────────────────────────────────────────┐         │            │
│  │    │ Step 3: Hard delete group                │         │            │
│  │    │   DELETE FROM staff_groups               │         │            │
│  │    │   WHERE id = group_id                    │         │            │
│  │    │                                          │         │            │
│  │    │   CASCADE deletes:                       │         │            │
│  │    │   - staff_group_members                  │         │            │
│  │    │   - staff_group_hierarchy                │         │            │
│  │    └──────────────────────────────────────────┘         │            │
│  │  END FOR                                                 │            │
│  │                                                           │            │
│  │  RETURN: {deleted_count, deleted_ids, details}          │            │
│  └──────────────────────────────────────────────────────────┘            │
│                                                                            │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         AUDIT & RECOVERY LAYER                           │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  TABLE: staff_groups_deletion_log (Permanent)              │        │
│  │                                                             │        │
│  │  Stores for each deletion:                                 │        │
│  │  - Original group ID                                       │        │
│  │  - Group name, description, color                          │        │
│  │  - Soft-delete timestamp (updated_at)                      │        │
│  │  - Hard-delete timestamp (NOW())                           │        │
│  │  - Member count at deletion                                │        │
│  │  - Hierarchy count at deletion                             │        │
│  │  - Deletion reason                                         │        │
│  │  - Full group data JSON snapshot                           │        │
│  └────────────────────────────────────────────────────────────┘        │
│                             │                                           │
│                             │ Used by...                                │
│                             │                                           │
│                             ▼                                           │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  FUNCTION: recover_deleted_group(uuid)                     │        │
│  │                                                             │        │
│  │  1. Query deletion log for group ID                        │        │
│  │  2. Check for name conflicts                               │        │
│  │  3. Recreate group with "(Recovered)" suffix               │        │
│  │  4. Return new group ID                                    │        │
│  │                                                             │        │
│  │  ⚠️ Limitation: Only group metadata is recovered           │        │
│  │     Members and hierarchy are NOT recoverable              │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Timeline

```
TIME: T=0 (User Action)
┌─────────────────────────────┐
│ User soft-deletes group     │
│ is_active: true → false     │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=0 (Immediate)
┌─────────────────────────────┐
│ Trigger fires               │
│ updated_at: OLD → NOW()     │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=0 to T=29 days
┌─────────────────────────────┐
│ RETENTION PERIOD            │
│                             │
│ - Group exists in DB        │
│ - is_active = false         │
│ - Visible to admins         │
│ - Can be restored           │
│ - Appears in preview        │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=30 days, 2:00 AM UTC
┌─────────────────────────────┐
│ Cron triggers Edge Function │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=30 days, 2:00:01 AM UTC
┌─────────────────────────────┐
│ Edge Function calls SQL     │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=30 days, 2:00:02 AM UTC
┌─────────────────────────────┐
│ SQL Function executes:      │
│ 1. Find eligible groups     │
│ 2. Log to audit table       │
│ 3. Hard delete from DB      │
└──────────┬──────────────────┘
           │
           ▼
TIME: T=30 days, 2:00:03 AM UTC
┌─────────────────────────────┐
│ COMPLETED                   │
│                             │
│ ✅ Group deleted            │
│ ✅ Members deleted (CASCADE)│
│ ✅ Hierarchy deleted        │
│ ✅ Audit log preserved      │
└─────────────────────────────┘
```

---

## Database Schema Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                    LIVE DATA TABLES                              │
└──────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────┐
     │       staff_groups                  │
     │  (Main table)                       │
     ├─────────────────────────────────────┤
     │  id                 UUID PK         │
     │  restaurant_id      UUID FK         │
     │  version_id         UUID FK         │
     │  name               VARCHAR         │
     │  is_active          BOOLEAN         │◄─── Soft-delete flag
     │  updated_at         TIMESTAMP       │◄─── Cleanup trigger key
     │  created_at         TIMESTAMP       │
     │  ...                                │
     └────────────┬───────────┬────────────┘
                  │           │
         ON DELETE CASCADE   ON DELETE CASCADE
                  │           │
         ┌────────▼──────┐   └────────▼──────────┐
         │staff_group_   │   │staff_group_       │
         │members        │   │hierarchy          │
         ├───────────────┤   ├───────────────────┤
         │group_id  FK   │   │parent_group_id FK │
         │staff_id  FK   │   │child_group_id  FK │
         │...            │   │...                │
         └───────────────┘   └───────────────────┘
                  │                     │
                  │                     │
        When parent deleted,       When parent deleted,
        these CASCADE delete       these CASCADE delete

┌──────────────────────────────────────────────────────────────────┐
│                   AUDIT TABLE (Permanent)                        │
└──────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────┐
     │  staff_groups_deletion_log          │
     │  (Audit trail - never deleted)      │
     ├─────────────────────────────────────┤
     │  id                 UUID PK         │
     │  deleted_group_id   UUID            │◄─── Original group ID
     │  restaurant_id      UUID            │
     │  version_id         UUID            │
     │  group_name         VARCHAR         │◄─── Preserved metadata
     │  description        TEXT            │
     │  metadata           JSONB           │
     │  soft_deleted_at    TIMESTAMP       │◄─── When is_active=false
     │  hard_deleted_at    TIMESTAMP       │◄─── When hard-deleted
     │  member_count       INTEGER         │◄─── Count at deletion
     │  child_group_count  INTEGER         │◄─── Count at deletion
     │  deletion_reason    VARCHAR         │◄─── Why deleted
     │  deleted_data       JSONB           │◄─── Full JSON snapshot
     └─────────────────────────────────────┘
                       │
                       │ Used by...
                       │
                       ▼
           ┌──────────────────────────┐
           │ recover_deleted_group()  │
           │ (Recreates group)        │
           └──────────────────────────┘
```

---

## Execution Flow: Cleanup Function

```
START: cleanup_soft_deleted_staff_groups(dry_run, retention_days)
   │
   ├─► Calculate cutoff date
   │   cutoff_date = NOW() - retention_days
   │
   ├─► Query eligible groups
   │   SELECT * FROM staff_groups
   │   WHERE is_active = false
   │   AND updated_at < cutoff_date
   │
   ├─► FOR EACH eligible group:
   │   │
   │   ├─► Count related records
   │   │   │
   │   │   ├─► Count members:
   │   │   │   SELECT COUNT(*) FROM staff_group_members
   │   │   │   WHERE group_id = current_group.id
   │   │   │
   │   │   └─► Count hierarchy:
   │   │       SELECT COUNT(*) FROM staff_group_hierarchy
   │   │       WHERE parent_group_id = current_group.id
   │   │          OR child_group_id = current_group.id
   │   │
   │   ├─► Build deletion details JSON
   │   │
   │   ├─► IF NOT dry_run THEN
   │   │   │
   │   │   ├─► Insert audit log entry
   │   │   │   INSERT INTO staff_groups_deletion_log (...)
   │   │   │   VALUES (group_id, name, counts, timestamps, ...)
   │   │   │
   │   │   └─► Hard delete group
   │   │       DELETE FROM staff_groups
   │   │       WHERE id = current_group.id
   │   │       -- CASCADE automatically deletes:
   │   │       --   - staff_group_members
   │   │       --   - staff_group_hierarchy
   │   │
   │   └─► Add to deleted_ids array
   │
   └─► RETURN TABLE
       - deleted_count: INTEGER
       - deleted_ids: UUID[]
       - deletion_details: JSONB
```

---

## Monitoring & Query Patterns

```
┌──────────────────────────────────────────────────────────────────┐
│                  MONITORING VIEW ARCHITECTURE                    │
└──────────────────────────────────────────────────────────────────┘

VIEW: v_cleanup_eligible_groups
┌─────────────────────────────────────┐
│ SELECT from staff_groups            │
│ WHERE is_active = false             │
│ WITH:                               │
│   - Days since deletion             │
│   - Member count (JOIN)             │
│   - Hierarchy count (JOIN)          │
│   - Cleanup status (ELIGIBLE/PENDING)│
│   - Days until deletion             │
└─────────────────────────────────────┘
         │
         │ Used by admins for...
         │
         ▼
┌─────────────────────────────────────┐
│ Daily Monitoring Queries:           │
│                                     │
│ 1. How many groups pending deletion?│
│    SELECT COUNT(*) FROM view        │
│    WHERE cleanup_status = 'ELIGIBLE'│
│                                     │
│ 2. Which groups deleted today?      │
│    SELECT * FROM view               │
│    WHERE will_delete_in_days = 0    │
│                                     │
│ 3. Preview next 7 days              │
│    SELECT * FROM view               │
│    WHERE will_delete_in_days <= 7   │
└─────────────────────────────────────┘

VIEW: v_deletion_statistics
┌─────────────────────────────────────┐
│ SELECT from deletion_log            │
│ GROUP BY DATE(hard_deleted_at)      │
│ WITH:                               │
│   - Groups deleted per day          │
│   - Total members removed           │
│   - Total hierarchy removed         │
│   - Average retention days          │
└─────────────────────────────────────┘
         │
         │ Used for...
         │
         ▼
┌─────────────────────────────────────┐
│ Reporting & Analytics:              │
│                                     │
│ 1. Monthly cleanup summary          │
│    SELECT * FROM view               │
│    WHERE deletion_date >= ...       │
│                                     │
│ 2. Trend analysis                   │
│    Compare month-over-month         │
│                                     │
│ 3. Compliance reporting             │
│    Export for GDPR audits           │
└─────────────────────────────────────┘
```

---

## Error Handling & Recovery Flow

```
SCENARIO: Something goes wrong during cleanup

┌─────────────────────────────────────┐
│ Cleanup Function Executes           │
└──────────┬──────────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Transaction BEGIN │
    └──────┬───────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Delete group #1              │
    │   ✅ Insert audit log        │
    │   ✅ DELETE from staff_groups│
    └──────┬───────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Delete group #2              │
    │   ✅ Insert audit log        │
    │   ❌ ERROR: Constraint violation│
    └──────┬───────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Transaction      │
    │ ROLLBACK         │
    │                  │
    │ Result:          │
    │ - No groups deleted│
    │ - No audit logs   │
    │ - Database unchanged│
    │ - Error logged    │
    └──────┬───────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Edge Function catches error  │
    │ Returns:                     │
    │   {                          │
    │     "success": false,        │
    │     "error": "message"       │
    │   }                          │
    └──────┬───────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Admin reviews logs           │
    │ - Edge Function logs         │
    │ - PostgreSQL error logs      │
    │ - Runs test suite            │
    │ - Fixes issue                │
    │ - Re-runs cleanup            │
    └──────────────────────────────┘
```

---

## Deployment Architecture Options

```
OPTION A: Supabase Edge Function (RECOMMENDED)
┌──────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLOUD                           │
│                                                                  │
│  ┌─────────────────────┐         ┌──────────────────────┐      │
│  │  Cron Trigger       │────────►│  Edge Function       │      │
│  │  (Built-in)         │         │  (Deno/TypeScript)   │      │
│  │  "0 2 * * *"        │         │                      │      │
│  └─────────────────────┘         └──────────┬───────────┘      │
│                                             │                   │
│                                             │ Invokes           │
│                                             │                   │
│                                    ┌────────▼─────────────┐    │
│                                    │  PostgreSQL Database │    │
│                                    │  cleanup_function()  │    │
│                                    └──────────────────────┘    │
│                                                                  │
│  Pros: ✅ Easy setup, ✅ No server, ✅ Dashboard integration   │
│  Cons: ⚠️ Function limits on free tier                        │
└──────────────────────────────────────────────────────────────────┘

OPTION B: PostgreSQL pg_cron
┌──────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│                                                                  │
│  ┌─────────────────────┐         ┌──────────────────────┐      │
│  │  pg_cron Extension  │────────►│  cleanup_function()  │      │
│  │  SELECT cron.schedule│        │  (PL/pgSQL)          │      │
│  │  ("0 2 * * *", ...)  │        │                      │      │
│  └─────────────────────┘         └──────────────────────┘      │
│                                                                  │
│  Pros: ✅ Database-native, ✅ No external dependencies          │
│  Cons: ❌ Not available on Supabase free tier                  │
└──────────────────────────────────────────────────────────────────┘

OPTION C: External Cron (Server/VM)
┌──────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVER                             │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │  Cron Daemon        │                                        │
│  │  /etc/cron.d/       │                                        │
│  │  "0 2 * * *"        │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             │ curl POST                                          │
│             │                                                    │
└─────────────┼────────────────────────────────────────────────────┘
              │
              │ HTTPS
              │
┌─────────────▼────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                              │
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────┐       │
│  │  Edge Function       │──────►│  PostgreSQL Database │       │
│  │  (API endpoint)      │       │  cleanup_function()  │       │
│  └──────────────────────┘       └──────────────────────┘       │
│                                                                  │
│  Pros: ✅ Full control, ✅ Custom scheduling                    │
│  Cons: ❌ Requires server management, ❌ More complex           │
└──────────────────────────────────────────────────────────────────┘

OPTION D: Go Server Background Job
┌──────────────────────────────────────────────────────────────────┐
│                      GO SERVER (24/7)                            │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │  time.Ticker        │                                        │
│  │  Every 24 hours     │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             │ Calls                                              │
│             │                                                    │
│  ┌──────────▼──────────┐                                        │
│  │  cleanupService.Run()│                                       │
│  │  (Go routine)       │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             │ Supabase client                                    │
│             │                                                    │
└─────────────┼────────────────────────────────────────────────────┘
              │
              │
┌─────────────▼────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                              │
│  ┌──────────────────────┐                                       │
│  │  PostgreSQL Database │                                       │
│  │  cleanup_function()  │                                       │
│  └──────────────────────┘                                       │
│                                                                  │
│  Pros: ✅ Integrated with app, ✅ Custom logic                  │
│  Cons: ❌ App must be running 24/7, ❌ More complex             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Index Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                    INDEX OPTIMIZATION                            │
└──────────────────────────────────────────────────────────────────┘

CLEANUP QUERY:
    SELECT * FROM staff_groups
    WHERE is_active = false
    AND updated_at < NOW() - INTERVAL '30 days';

INDEXES USED:
    ┌────────────────────────────────────────┐
    │ idx_staff_groups_active                │
    │ (restaurant_id, is_active)             │
    │ WHERE is_active = true                 │
    │                                        │
    │ Purpose: Filter inactive groups        │
    │ Type: Partial index                    │
    │ Benefit: Excludes active groups        │
    └────────────────────────────────────────┘

    ┌────────────────────────────────────────┐
    │ Implicit index on updated_at           │
    │ (PostgreSQL query planner)             │
    │                                        │
    │ Purpose: Date range filtering          │
    │ Type: B-tree (default)                 │
    │ Benefit: Fast temporal queries         │
    └────────────────────────────────────────┘

EXECUTION PLAN:
    Index Scan on staff_groups
    └─► Filter: is_active = false
        └─► Filter: updated_at < [cutoff_date]
            └─► Rows: ~1-100 (typical)
                └─► Time: <10ms

OPTIMIZATION TIPS:
    ✅ Keep indexes maintained (VACUUM)
    ✅ Monitor index usage (pg_stat_user_indexes)
    ✅ Consider updated_at index if >10,000 soft-deleted groups
```

---

This comprehensive architecture documentation covers all aspects of the soft-delete cleanup system, from high-level data flow to detailed execution patterns.
