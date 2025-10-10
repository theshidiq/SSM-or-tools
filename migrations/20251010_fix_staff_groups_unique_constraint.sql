-- Migration: Fix staff_groups unique constraint to allow reusing names of soft-deleted groups
-- Date: 2025-10-10
-- Issue: Cannot create new group with same name as soft-deleted group
-- Root Cause: Unique constraint includes is_active column, preventing name reuse

-- Step 1: Drop the existing constraint
-- This constraint was incorrectly enforcing uniqueness on ALL groups (active + inactive)
ALTER TABLE staff_groups
DROP CONSTRAINT IF EXISTS staff_groups_restaurant_id_version_id_name_active_key;

-- Step 2: Create a partial unique index (only for active groups)
-- This allows multiple soft-deleted groups with the same name
-- But prevents duplicate names among active groups
CREATE UNIQUE INDEX IF NOT EXISTS staff_groups_active_name_unique
ON staff_groups (restaurant_id, version_id, name)
WHERE is_active = true;

-- Verification query (optional - run after migration)
-- This will show you all groups including soft-deleted ones
-- SELECT id, name, is_active, version_id, created_at, updated_at
-- FROM staff_groups
-- ORDER BY name, is_active DESC;

-- Test case:
-- 1. Create group "Test Group" (is_active = true) ✅
-- 2. Soft-delete "Test Group" (is_active = false) ✅
-- 3. Create new group "Test Group" (is_active = true) ✅ (This should now work!)
-- 4. Try to create another "Test Group" while one is active ❌ (Should fail - duplicate active name)
