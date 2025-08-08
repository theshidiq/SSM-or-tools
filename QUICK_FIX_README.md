# 🚨 Quick Fix for Missing Database Tables

## Problem
The shift scheduling application is showing 404 errors because database tables are missing:
- restaurants
- config_versions  
- ml_model_configs
- conflict_rules
- priority_rules
- staff_groups
- daily_limits
- monthly_limits

## 🔧 Immediate Fix (1 command)

```bash
node database-setup-complete.js --force
```

This will:
- ✅ Create all required database tables
- ✅ Set up proper indexes and relationships
- ✅ Populate with sample data (Sakura Sushi Restaurant + 12 staff)
- ✅ Configure default ML model parameters
- ✅ Set up business rules and constraints
- ✅ Fix the "rules.reduce is not a function" error

## 🧪 Verify the Fix

```bash
node test-database-fix.js
```

Should show all tests passing.

## 🚀 Start the Application

```bash
npm start
```

Settings modal should now work without errors!

## 📚 Detailed Documentation

- **Complete Guide**: [DATABASE_SETUP_GUIDE.md](./DATABASE_SETUP_GUIDE.md)
- **Database Schema**: [database/README.md](./database/README.md)
- **Migration System**: [database/scripts/migrate.js](./database/scripts/migrate.js)

## 🛠️ Environment Variables Needed

```bash
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_SERVICE_KEY=your-service-role-key  # Required for setup
REACT_APP_SUPABASE_ANON_KEY=your-anon-key            # For application
```

## 🔍 Troubleshooting

### If setup fails:
```bash
node validate-database.js --verbose
```

### If you need to start fresh:
```bash
rm -rf logs/
node database-setup-complete.js --force --verbose
```

### Check specific issues:
- **Connection problems**: Verify Supabase URL and keys
- **Permission errors**: Use service role key for setup
- **RLS policies**: May need to temporarily disable in Supabase dashboard

## ✅ Success Indicators

After running the fix:
- [ ] No 404 errors in browser console
- [ ] Settings modal opens without errors
- [ ] ML parameters can be saved and loaded
- [ ] Staff groups are visible
- [ ] Schedule generation works

## 📞 Getting Help

1. **Check validation**: `node validate-database.js`
2. **Review setup guide**: [DATABASE_SETUP_GUIDE.md](./DATABASE_SETUP_GUIDE.md)
3. **Test specific components**: `node test-database-fix.js`

The application now includes robust fallback mechanisms, so it will work even if some database components are missing, but full setup is recommended for optimal performance.