# Quick Setup Guide - Automated Database Setup

## 🚀 One-Click Database Setup (Recommended)

The new automated setup eliminates manual SQL copy-pasting. Everything is done automatically with a single click!

### Step 1: Open Settings
1. Launch the Shift Schedule Manager application
2. Click the **Settings** gear icon in the top-right corner
3. Look for the "Database Setup" section

### Step 2: Choose Setup Mode
You'll see two options:

**🟢 Automated Setup (Recommended)**
- One-click solution
- No manual steps required
- Automatic table creation
- Real-time progress tracking
- Safe to run multiple times

**🔵 Manual Setup (Fallback)**
- Traditional SQL copy-paste method
- Use only if automated setup fails
- Requires Supabase dashboard access

### Step 3: Start Automated Setup
1. Click **"Start Automated Setup"** (green button with lightning bolt)
2. Watch the real-time progress bar
3. Setup completes in 30-60 seconds
4. All tables, functions, and sample data created automatically

### Step 4: Enjoy!
- ✅ Database ready to use immediately
- ✅ Sample restaurant and staff data included
- ✅ All AI/ML features enabled
- ✅ No configuration needed

---

## 🔧 If Automated Setup Fails

### Common Issue: RPC Functions Not Available

If you see this error: *"RPC functions not available"*

**Quick Fix:**
1. Copy the content of `supabase-rpc-setup.sql` (provided in project root)
2. Open your [Supabase Dashboard](https://supabase.com/dashboard)
3. Go to **SQL Editor**
4. Paste and run the RPC setup script
5. Return to the app and click **"Start Automated Setup"** again

**Alternative:** Click **"Switch to Manual Setup"** for traditional setup method

---

## 🆚 Setup Methods Comparison

| Feature | Automated Setup | Manual Setup |
|---------|----------------|-------------|
| **User Actions** | 1 click | 5-7 steps |
| **Time Required** | 30-60 seconds | 3-5 minutes |
| **Error Recovery** | Automatic retry | Manual retry |
| **Progress Visibility** | Real-time bar | None |
| **Table Conflicts** | Auto-skip existing | Manual check |
| **Sample Data** | Included | Optional |
| **User Experience** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 📋 What Gets Created Automatically

### Core Tables
- **restaurants** - Restaurant information and settings
- **staff** - Staff members and their details
- **config_versions** - Configuration management
- **config_changes** - Change history tracking

### Business Logic Tables  
- **staff_groups** - Team organization
- **conflict_rules** - Scheduling conflict rules
- **daily_limits** - Daily shift limits
- **monthly_limits** - Monthly scheduling constraints
- **priority_rules** - Staff scheduling preferences

### AI/ML Tables
- **ml_model_configs** - Machine learning model settings
- **ml_model_performance** - AI performance tracking

### Database Functions
- **get_active_config_version()** - Get current configuration
- **create_config_version()** - Create new configuration
- **activate_config_version()** - Switch configurations
- **update_updated_at_column()** - Automatic timestamp updates

### Performance Features
- **Indexes** - Optimized query performance
- **Triggers** - Automatic data maintenance
- **RLS Policies** - Row-level security

### Sample Data
- **Sample Restaurant** - "Sample Restaurant" with realistic settings
- **11 Staff Members** - Japanese restaurant staff with various positions
- **Default ML Config** - Genetic algorithm optimization settings
- **Priority Rules** - Example scheduling preferences

---

## 🛠️ Troubleshooting

### "Connection Failed"
**Cause:** Supabase credentials not configured
**Solution:** Check your `.env` file has correct `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`

### "Permission Denied"
**Cause:** Insufficient database privileges
**Solution:** Check your Supabase project settings and RLS policies

### "Tables Already Exist"
**Cause:** Previous setup attempt
**Solution:** This is normal - existing tables are safely skipped

### "Setup Incomplete"  
**Cause:** Some tables failed to create
**Solution:** Check error details and retry, or use manual setup

---

## 🔍 Verification

After successful setup, you should see:
- ✅ Green checkmark in settings
- ✅ Staff list shows sample employees  
- ✅ No error messages in console
- ✅ All app features work normally

---

## 🆘 Need Help?

1. **Check the error details** - Click "Show Error Details" for specific information
2. **Try manual setup** - Use the fallback option if automated fails
3. **Verify RPC setup** - Ensure the RPC functions are installed
4. **Check Supabase dashboard** - Verify tables were created correctly
5. **Review logs** - Browser console may have additional error information

The automated setup makes database configuration effortless - most users will never need to touch SQL or think about database schemas. Just click and go! 🚀