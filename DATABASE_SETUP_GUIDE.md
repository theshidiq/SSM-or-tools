# Database Setup Guide - Shift Schedule Manager

This guide provides complete instructions for setting up the database for your shift scheduling application, fixing the 404 table errors, and ensuring everything works properly.

## 🚨 Quick Fix for 404 Errors

If you're seeing 404 errors for missing database tables, run this command immediately:

```bash
node database-setup-complete.js --force
```

This will create all required tables and populate them with default data.

## 📋 Problem Overview

The application was trying to access these missing tables:
- `restaurants` - Restaurant information
- `config_versions` - Configuration versioning system
- `ml_model_configs` - ML model parameters
- `conflict_rules` - Business rule conflicts
- `priority_rules` - Staff scheduling priorities
- `staff_groups` - Staff group management
- `daily_limits` - Daily scheduling limits
- `monthly_limits` - Monthly scheduling limits
- `staff` - Staff member information

## 🛠️ Complete Setup Process

### Step 1: Environment Setup

Ensure your `.env` file contains the correct Supabase credentials:

```bash
# Required for database setup
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_SERVICE_KEY=your-service-role-key

# Also include the anon key for the application
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

**Important**: Use the **Service Role Key** for setup, not the anon key. The service role key has admin privileges needed to create tables.

### Step 2: Run Complete Database Setup

```bash
# Full setup with all tables and default data
node database-setup-complete.js --force

# Or if you want to see what will be created first
node database-setup-complete.js --dry-run
```

**Options:**
- `--force` - Skip confirmation prompt
- `--dry-run` - Show what would be created without making changes
- `--skip-seed` - Create tables but skip default data
- `--verbose` - Show detailed output

### Step 3: Validate Setup

```bash
# Check if everything was created correctly
node validate-database.js --verbose
```

### Step 4: Test the Application

```bash
npm start
```

Open the Settings modal and verify you can save ML parameters without errors.

## 🔧 Alternative Setup Methods

### Method 1: Using the Migration System

```bash
cd database
node scripts/migrate.js run --force
```

### Method 2: Manual Supabase SQL

If the automated scripts don't work, you can run SQL directly in the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL from `database-setup.sql` (see below)
4. Run the query

## 📁 What Gets Created

### Core Tables
- **restaurants** - Multi-tenant restaurant data
- **staff** - Staff member information  
- **user_profiles** - User authentication and roles

### Configuration System
- **config_versions** - Versioned configuration management
- **staff_groups** - Staff team groupings
- **staff_group_members** - Group membership relationships

### Business Rules
- **conflict_rules** - Scheduling conflict definitions
- **daily_limits** - Daily scheduling constraints
- **monthly_limits** - Monthly scheduling constraints  
- **priority_rules** - Staff preference rules

### ML System
- **ml_model_configs** - ML model parameters
- **ml_model_performance** - Performance tracking
- **ml_training_history** - Training data history

### Sample Data
- **Sakura Sushi Restaurant** with 12 staff members
- **Default configuration version** with business rules
- **ML model configuration** with genetic algorithm settings
- **Staff groups** with realistic team structures

## 🔍 Troubleshooting Common Issues

### Issue: "Table doesn't exist" (404 errors)

**Solution:**
```bash
node database-setup-complete.js --force
```

### Issue: "Permission denied" or RLS errors  

**Cause:** Row Level Security policies blocking access

**Solutions:**
1. Use the service role key for setup
2. Temporarily disable RLS in Supabase dashboard:
   ```sql
   ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
   ```
3. Check your RLS policies allow the operations

### Issue: "Function does not exist"

**Cause:** Database functions weren't created

**Solution:**
```bash
# Re-run setup to create functions
node database-setup-complete.js --force
```

### Issue: Settings modal shows "Failed to save"

**Causes & Solutions:**

1. **Tables don't exist:**
   ```bash
   node database-setup-complete.js --force
   ```

2. **No default restaurant:**
   ```sql
   INSERT INTO restaurants (name, slug) VALUES ('My Restaurant', 'my-restaurant');
   ```

3. **No active configuration:**
   ```bash
   node validate-database.js
   # Follow the guidance provided
   ```

### Issue: "rules.reduce is not a function"

**Cause:** Priority rules returning invalid data

**Solution:** 
This is now fixed in the updated ConfigurationService. Update your code or re-run setup.

### Issue: Connection failures

**Check:**
1. SUPABASE_URL is correct
2. SUPABASE_SERVICE_KEY is correct  
3. Supabase project is active
4. Network connectivity

## 📊 Validation and Testing

### Check Database Status
```bash
# Quick validation
node validate-database.js

# Detailed validation
node validate-database.js --verbose
```

### Manual Verification

In Supabase dashboard, verify these tables exist:
- [ ] restaurants (should have 1+ records)
- [ ] staff (should have 12+ records if using sample data)
- [ ] config_versions (should have 1 active record)
- [ ] ml_model_configs (should have 1+ records)
- [ ] staff_groups (should have 7+ records)

### Test Application Functions

1. **Open Settings Modal** - Should load without errors
2. **Save ML Parameters** - Should save successfully
3. **View Staff Groups** - Should show configured groups
4. **Generate Schedule** - Should work with default constraints

## 🚀 Production Deployment

### Environment Variables
```bash
# Production
REACT_APP_SUPABASE_URL=https://your-prod-project.supabase.co
REACT_APP_SUPABASE_SERVICE_KEY=your-prod-service-key
REACT_APP_SUPABASE_ANON_KEY=your-prod-anon-key
```

### Deployment Steps
1. Set up production Supabase project
2. Update environment variables
3. Run database setup:
   ```bash
   NODE_ENV=production node database-setup-complete.js --force
   ```
4. Validate setup:
   ```bash
   node validate-database.js
   ```
5. Deploy application

### Security Considerations
- Use environment variables for keys
- Enable RLS policies
- Review user permissions
- Set up backup procedures

## 🔄 Updating and Maintenance

### Adding New Features
1. Create new migration files in `database/migrations/schema/`
2. Run migrations:
   ```bash
   node database/scripts/migrate.js run
   ```

### Backup and Restore
```bash
# Export data
node database/utilities/data-export.js restaurant your-restaurant-id

# Import data  
node database/utilities/data-import.js import backup-file.json
```

### Performance Monitoring
```bash
# Check performance
node validate-database.js --verbose

# View metrics in Supabase dashboard
```

## 📞 Getting Help

### Self-Diagnosis Tools
```bash
# Complete health check
node validate-database.js --verbose

# Test specific components
node test-settings-fix.js
```

### Common Commands
```bash
# Fresh start - recreate everything
node database-setup-complete.js --force

# Check what's missing
node validate-database.js

# View logs
tail -f logs/migration_*.json
```

### Support Information

If issues persist:

1. **Check logs** in `logs/` directory
2. **Run validation** with `--verbose` flag
3. **Review Supabase logs** in dashboard
4. **Verify environment variables** are correct
5. **Check network connectivity** to Supabase

### Quick Recovery

If everything breaks:
```bash
# Nuclear option - fresh setup
rm -f logs/*
node database-setup-complete.js --force --verbose
node validate-database.js --verbose
npm start
```

## 🎯 Success Criteria  

You'll know setup is successful when:

- [ ] All tables exist (validate with `node validate-database.js`)
- [ ] Settings modal opens without errors
- [ ] ML parameters can be saved and loaded
- [ ] Staff groups are visible in the interface
- [ ] Schedule generation works with default data
- [ ] No 404 errors in browser console

## 📝 Files Created/Modified

This setup creates:
- `/database-setup-complete.js` - Complete database setup script
- `/validate-database.js` - Database validation tool  
- `/src/services/ConfigurationService.js` - Updated with better error handling
- `/DATABASE_SETUP_GUIDE.md` - This guide
- Sample data in all required tables

The application now has robust fallback mechanisms and graceful error handling for any database issues.