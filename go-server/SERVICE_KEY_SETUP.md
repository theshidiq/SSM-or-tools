# Go Server Service Role Key Setup

## Why This Is Needed

The Go WebSocket server needs the Supabase **service_role** key (not the anon key) to:
- **Bypass Row Level Security (RLS) policies** on the `daily_limits` table
- Perform administrative database operations
- Write configuration data to protected tables

## Current Issue

The database updates are failing with this error:
```
new row violates row-level security policy for table "daily_limits"
```

This happens because the server is using the `anon` key, which respects RLS policies.

## How to Get Your Service Role Key

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project: `shift_schedule`
3. Navigate to: **Settings** → **API**
4. Find the **service_role** key (under "Project API keys")
5. Click "Copy" to copy the key

### Option 2: Check MCP Configuration
If you have Supabase MCP configured in Claude Code, the service key might already be available in:
```
~/.config/claude/mcp_settings.json
```

Look for the `supabase` server configuration.

## How to Add the Key

### Method 1: Edit the .env file (Simple)
1. Open `go-server/.env`
2. Replace `your_service_role_key_here` with your actual service_role key:
   ```bash
   SUPABASE_SERVICE_KEY=eyJhbGc...your_actual_service_key_here
   ```
3. Save the file

### Method 2: Export environment variable (Temporary)
```bash
export SUPABASE_SERVICE_KEY="eyJhbGc...your_actual_service_key_here"
```

### Method 3: Add to parent .env file (Persistent)
Add this line to `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/.env`:
```bash
SUPABASE_SERVICE_KEY=eyJhbGc...your_actual_service_key_here
```

## After Adding the Key

1. **Kill the current Go server**:
   ```bash
   killall -9 go
   ```

2. **Load the environment variables**:
   ```bash
   cd /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/go-server
   source .env
   ```

3. **Start the Go server**:
   ```bash
   go run main.go settings_multitable.go shifts_websocket.go
   ```

4. **Verify the key is loaded**:
   Look for this log message on startup:
   ```
   ✅ Using SERVICE_ROLE key - RLS policies will be bypassed
   ```

   If you see this instead, the key is NOT loaded:
   ```
   ⚠️ WARNING: Using ANON key - some operations may be restricted by RLS policies
   ```

## Security Notes

- **NEVER** commit the service_role key to git
- The `.env` file should be in `.gitignore`
- The service_role key has full admin access to your database
- Keep this key secret and secure

## Testing After Setup

Once the server is running with the service_role key:

1. Open the app at http://localhost:80
2. Navigate to Daily Limits settings
3. Change a value (e.g., minOffPerDay from 0 to 2)
4. Click "Save Daily Limits"
5. Check the database to verify the update succeeded

You can verify in the database with:
```sql
SELECT * FROM daily_limits WHERE is_active = true;
```

The `limit_config` JSONB column should show your updated values.
