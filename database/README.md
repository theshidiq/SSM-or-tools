# Database Migration System for Shift Schedule Manager

This directory contains a complete database migration system for the Shift Schedule Manager's configurable model specification system in Supabase.

## 🏗️ Architecture Overview

The system provides a comprehensive, production-ready database schema with:

- **Multi-tenant architecture** with row-level security (RLS)
- **Versioned configuration management** with rollback capabilities
- **Comprehensive business rules engine** for scheduling constraints
- **Advanced ML model configuration** and performance tracking
- **Real-time updates** via Supabase realtime
- **Audit trails** and change tracking
- **Data import/export utilities**

## 📁 Directory Structure

```
database/
├── migrations/
│   ├── schema/          # Core database schema files
│   ├── seed/            # Sample data for testing
│   ├── rollback/        # Rollback scripts
│   ├── tests/           # Validation tests
│   └── utilities/       # Helper scripts
├── scripts/             # Migration and utility scripts
├── utilities/           # Data import/export tools
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16 or higher)
2. **Supabase project** with service key
3. Required npm packages:
   ```bash
   npm install @supabase/supabase-js json2csv uuid
   ```

### Environment Setup

Create a `.env` file or set environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
LOG_LEVEL=info
```

### Running Migrations

1. **Full migration with seed data:**
   ```bash
   node scripts/migrate.js run --force
   ```

2. **Schema only (no sample data):**
   ```bash
   node scripts/migrate.js run --skip-seed
   ```

3. **Dry run (preview changes):**
   ```bash
   node scripts/migrate.js run --dry-run
   ```

4. **Check migration status:**
   ```bash
   node scripts/migrate.js status
   ```

## 📋 Migration Files

### Schema Migrations (Required Order)

1. **001_create_extensions.sql** - PostgreSQL extensions and custom types
2. **002_create_core_tables.sql** - Restaurants, staff, and user profiles
3. **003_create_configuration_system.sql** - Versioned configuration management
4. **004_create_staff_groups.sql** - Staff organization and hierarchy
5. **005_create_business_rules.sql** - Scheduling constraints and rules
6. **006_create_ml_system.sql** - ML model configuration and tracking
7. **007_create_violations_tracking.sql** - Constraint violation monitoring
8. **008_create_triggers_and_functions.sql** - Automation and business logic
9. **009_create_rls_policies.sql** - Row-level security policies

### Seed Data (Sample Restaurant Data)

1. **001_sample_restaurant.sql** - Sakura Sushi Restaurant with 12 staff members
2. **002_configuration_setup.sql** - Staff groups and organizational structure
3. **003_business_rules.sql** - Real-world scheduling constraints
4. **004_priority_rules.sql** - Staff preferences and priority rules
5. **005_ml_configuration.sql** - ML model configs with performance data

## 🏢 Sample Data Overview

The migration includes realistic sample data for **Sakura Sushi Restaurant**:

### Staff Members (12 total)
- **料理長** (Head Chef) - Leadership, Sunday early preference
- **井関** (Sous Chef) - Senior kitchen staff
- **古藤, 中田, 小池** - Kitchen cooks and assistants
- **田辺** (Floor Manager) - Service team leader
- **岸, 与儀, カマル, 高野** - Service staff with diverse backgrounds
- **派遣スタッフ 1,2** - Temporary staff for peak periods

### Business Rules Examples
- Senior staff coverage requirements
- Minimum rest periods between shifts
- Weekend scheduling limits
- Language skill coverage for international customers
- Holiday rotation policies

### ML Model Configurations
- **Genetic Algorithm Optimizer** (Primary)
- **Simulated Annealing** (Alternative)
- **Q-Learning System** (Experimental)
- **Ensemble Model** (Hybrid approach)

## 🔧 Utility Scripts

### Migration Management
```bash
# Run complete migration
node scripts/migrate.js run

# Validate migration results
node scripts/migrate.js validate

# Generate rollback script
node scripts/migrate.js rollback
```

### Data Export/Import
```bash
# Export restaurant data
node utilities/data-export.js restaurant 550e8400-e29b-41d4-a716-446655440001

# Export with anonymization
node utilities/data-export.js restaurant 550e8400-e29b-41d4-a716-446655440001 --anonymize

# Import data (dry run first!)
node utilities/data-import.js import export_file.json --dry-run
node utilities/data-import.js import export_file.json --overwrite
```

### Testing and Validation
```bash
# Run complete test suite
node scripts/test-suite.js

# Run specific test categories
node scripts/test-suite.js schema
node scripts/test-suite.js performance

# Validate migration results
psql -h your-host -d your-db -f migrations/tests/validate_migration.sql
```

## 🔐 Security Features

### Row Level Security (RLS)
- All tables protected with RLS policies
- Multi-tenant isolation by restaurant
- Role-based access control (admin, manager, staff, viewer)
- Secure function execution with `SECURITY DEFINER`

### Audit Trails
- Complete change tracking for all configuration modifications
- User attribution and IP logging
- Schedule change audit log
- Migration history tracking

### Data Protection
- Email anonymization in exports
- Sensitive data filtering
- Secure foreign key relationships
- Input validation and constraints

## 📊 Performance Optimizations

### Indexing Strategy
- **Primary indexes** on all foreign keys
- **Composite indexes** for common query patterns
- **JSON indexes** for JSONB field queries
- **Partial indexes** for active records only

### Query Optimization
- Efficient RLS policy design
- Batch operations for large datasets
- Connection pooling compatibility
- Query result caching support

## 🔄 Rollback Procedures

### Complete Rollback
```bash
# Generate and review rollback script
node scripts/migrate.js rollback

# Execute complete rollback (⚠️ DESTRUCTIVE)
psql -h your-host -d your-db -f migrations/rollback/rollback_all.sql
```

### Seed Data Only Rollback
```bash
# Remove only sample data, keep schema
psql -h your-host -d your-db -f migrations/rollback/rollback_seed_only.sql
```

## 🎯 Real-time Features

### Supabase Realtime Setup
```sql
-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
ALTER PUBLICATION supabase_realtime ADD TABLE staff;
ALTER PUBLICATION supabase_realtime ADD TABLE config_versions;
-- ... (see utilities/supabase-realtime-setup.sql)
```

### Notification Channels
- **schedule_updates** - Configuration and staff changes
- **ml_performance_updates** - ML model performance data  
- **violation_alerts** - Constraint violation notifications

## 🧪 Testing Strategy

### Validation Tests
- Schema structure verification
- Data integrity checks
- Foreign key relationship validation
- Business rule compliance
- Performance benchmarking

### Performance Benchmarks
- Query response times (< 1000ms target)
- Batch operations (< 5000ms target)
- Index efficiency validation
- RLS policy performance

## 🛠️ Development Workflow

### Adding New Features
1. Create migration files in `migrations/schema/`
2. Add corresponding seed data in `migrations/seed/`
3. Update rollback scripts
4. Add validation tests
5. Update documentation

### Data Model Changes
1. Create new migration file with incremental number
2. Add rollback SQL in migration comments
3. Update affected RLS policies
4. Test with sample data
5. Validate performance impact

## 📝 Configuration Management

### Version Control
- Each configuration change creates a new version
- Only one version can be active per restaurant
- Complete audit trail of changes
- Rollback to previous versions

### Business Rules
- **Conflict Rules** - Staff scheduling conflicts
- **Daily Limits** - Maximum shifts per day
- **Monthly Limits** - Fair distribution over time
- **Priority Rules** - Staff preferences and requirements

### ML Model Management
- Multiple algorithm support
- Performance tracking and comparison
- Feature importance analysis
- Adaptive parameter tuning

## 🚨 Troubleshooting

### Common Issues

**Migration fails with permission error:**
```bash
# Ensure you're using the service role key, not anon key
export SUPABASE_SERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
```

**RLS policies blocking queries:**
```sql
-- Temporarily disable RLS for debugging (⚠️ Development only)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
-- Re-enable after troubleshooting
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Foreign key constraint errors:**
```bash
# Check foreign key integrity
node scripts/test-suite.js schema
```

### Performance Issues

**Slow queries:**
1. Check index usage with `EXPLAIN ANALYZE`
2. Review RLS policy complexity
3. Consider materialized views for complex queries
4. Optimize batch sizes for large operations

### Data Import Issues

**ID conflicts during import:**
```bash
# Generate new UUIDs during import
node utilities/data-import.js import file.json --generate-new-ids
```

**Validation failures:**
```bash
# Validate import file first
node utilities/data-import.js validate file.json
```

## 🔗 Integration Examples

### Frontend Integration
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Subscribe to schedule updates
const subscription = supabase
  .channel('schedule_updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'staff_groups'
  }, (payload) => {
    console.log('Staff group updated:', payload)
  })
  .subscribe()
```

### API Usage
```javascript
// Get active configuration
const { data: config } = await supabase
  .rpc('get_active_config_version', {
    p_restaurant_id: restaurantId
  })

// Create new configuration version
const { data: newVersion } = await supabase
  .rpc('create_config_version', {
    p_restaurant_id: restaurantId,
    p_name: 'Updated Rules',
    p_description: 'Added new holiday policies'
  })
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Database Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## 🤝 Contributing

1. Follow the established naming conventions
2. Add appropriate tests for new features
3. Update rollback scripts for schema changes
4. Document any new configuration options
5. Test with realistic data volumes

## 📄 License

This database migration system is part of the Shift Schedule Manager project.

---

## 🆕 AI Receptionist Feature (NEW)

### Migration 016: Allergen Schema

**File**: `migrations/016_allergen_schema_for_ai_receptionist.sql`
**Project**: `ai-receptionist-allergen` (separate repository)
**Date**: 2025-01-31
**Status**: ✅ Safe to apply - INDEPENDENT schema

### New Tables (8 tables for AI Receptionist)

1. **allergen_types** - Standard allergen list (gluten, dairy, shellfish, etc.)
2. **menu_categories** - Menu organization (Appetizers, Main Course, Desserts, Beverages)
3. **menu_items** - Hotel menu with multilingual support (English + Japanese)
4. **ingredients** - Shared ingredient library
5. **ingredient_allergens** - Maps ingredients to allergen types
6. **menu_item_ingredients** - Maps menu items to ingredients with quantities
7. **allergen_conversations** - Conversation logs for analytics
8. **allergen_sessions** - User session tracking

### Quick Start

```bash
# Apply allergen schema migration
psql $SUPABASE_DB_URL -f database/migrations/016_allergen_schema_for_ai_receptionist.sql

# Or via Supabase SQL Editor:
# 1. Open Supabase dashboard
# 2. Navigate to SQL Editor
# 3. Copy contents of 016_allergen_schema_for_ai_receptionist.sql
# 4. Execute
```

### Sample Data Included

- ✅ 10 standard allergen types with Japanese translations
- ✅ 4 menu categories
- ✅ 20 sample ingredients
- ✅ 4 sample menu items (Caesar Salad, Grilled Salmon, Shrimp Pasta, Grilled Chicken Rice Bowl)
- ✅ Accurate allergen mappings

**Next Step**: Add 16-26 more menu items for production (target: 20-30 total).

### Verification Queries

```sql
-- Check migration success
SELECT COUNT(*) AS allergen_count FROM allergen_types;  -- Should be 10
SELECT COUNT(*) AS menu_items FROM menu_items;          -- Should be 4+

-- Test allergen query (find items safe for shellfish allergy)
SELECT
  mi.name,
  mi.name_ja,
  COALESCE(ARRAY_AGG(DISTINCT at.name), '{}') AS allergens
FROM menu_items mi
LEFT JOIN menu_item_ingredients mii ON mi.id = mii.menu_item_id
LEFT JOIN ingredients i ON mii.ingredient_id = i.id
LEFT JOIN ingredient_allergens ia ON i.id = ia.ingredient_id
LEFT JOIN allergen_types at ON ia.allergen_type_id = at.id
WHERE mi.is_available = true
GROUP BY mi.id, mi.name, mi.name_ja
HAVING 'shellfish' != ALL(COALESCE(ARRAY_AGG(DISTINCT at.name), '{}'));
```

### Database Architecture

**Shared Supabase Instance**: Both Shift Scheduler and AI Receptionist use the SAME database.

**Benefits**:
- ✅ Cost efficient (1 Supabase FREE tier instance)
- ✅ Shared connection credentials
- ✅ Independent schemas (no foreign keys between projects)
- ✅ Safe to add/remove without affecting shift scheduler

**Environment Variables** (shared):
```bash
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  # For admin operations
```

### Rollback (if needed)

```sql
-- Remove all AI Receptionist tables
DROP TABLE IF EXISTS allergen_conversations CASCADE;
DROP TABLE IF EXISTS allergen_sessions CASCADE;
DROP TABLE IF EXISTS menu_item_ingredients CASCADE;
DROP TABLE IF EXISTS ingredient_allergens CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS allergen_types CASCADE;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_allergen_types_updated_at ON allergen_types;
DROP TRIGGER IF EXISTS trigger_menu_items_updated_at ON menu_items;
DROP TRIGGER IF EXISTS trigger_update_session_on_message ON allergen_conversations;
DROP FUNCTION IF EXISTS update_allergen_types_timestamp();
DROP FUNCTION IF EXISTS update_menu_items_timestamp();
DROP FUNCTION IF EXISTS update_session_activity();
```

### Next Steps for AI Receptionist Implementation

1. **Data Curation** (Week 1)
   - Add 16-26 more menu items (target: 20-30 total)
   - Include hotel-specific dishes with Japanese names
   - Verify allergen mappings for guest safety

2. **Backend Setup** (Week 1)
   - Initialize NestJS project
   - Configure TypeORM with Supabase
   - Implement allergen query API

3. **Frontend Setup** (Week 2)
   - Initialize SvelteKit project
   - Build chat UI components
   - Integrate with NestJS backend

4. **Testing & Deployment** (Week 3)
   - Write unit and integration tests
   - Deploy to Vercel (frontend) + Fly.io (backend)
   - Setup CI/CD pipeline

### Documentation

See comprehensive implementation guide:
- `docs/AI_RECEPTIONIST_AGENT_GUIDELINE.md` - Complete agent guideline
- `docs/NEXTBEAT_JOB_ALIGNMENT_ANALYSIS.md` - Job alignment analysis
- `docs/SVELTEKIT_IMPLEMENTATION_EXAMPLE.md` - Code examples