# Supabase Authentication Alternatives

If anonymous access continues to fail, here are alternative approaches to fix the authentication and RLS policy issues for the Shift Schedule Manager.

## Current Problem Analysis

The app is experiencing:
- 401 Unauthorized errors when accessing Supabase REST API
- RLS policy violations blocking database operations
- Missing RLS policies for anonymous users on critical tables (especially `restaurants`)

## Solution 1: Service Role Key (Recommended for Development)

**What it is:** Use the service role key instead of anonymous key for full database access.

### Implementation:

1. **Get Service Role Key:**
   - Go to Supabase Dashboard > Settings > API
   - Copy the `service_role` key (not the `anon` key)
   - This key bypasses RLS policies entirely

2. **Update Environment Variables:**
```env
# Replace the anon key with service role key
REACT_APP_SUPABASE_ANON_KEY=your_service_role_key_here
```

3. **Pros:**
   - Immediate fix - no SQL policy changes needed
   - Full database access
   - No RLS policy complications

4. **Cons:**
   - Less secure (full database access)
   - Should only be used in development
   - Not suitable for production with real users

### Code Changes Required:
```javascript
// In src/utils/supabase.js - no changes needed
// The service role key will just work with existing code
```

## Solution 2: Custom User Authentication

**What it is:** Implement proper user authentication instead of relying on anonymous access.

### Implementation:

1. **Enable Authentication Providers:**
   - Go to Supabase Dashboard > Authentication > Providers
   - Enable Email authentication
   - Optionally enable Google, GitHub, etc.

2. **Create User Registration/Login:**
```javascript
// Add to src/utils/supabase.js
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
```

3. **Update RLS Policies for Authenticated Users:**
```sql
-- Replace anonymous policies with authenticated user policies
CREATE POLICY "restaurants_select_auth" ON public.restaurants
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "restaurants_insert_auth" ON public.restaurants
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Repeat for all tables...
```

4. **Add Authentication Context:**
```javascript
// Create src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Solution 3: Project-Level Configuration Fix

**What it is:** Fix Supabase project settings that might be blocking anonymous access.

### Steps:

1. **Check Project Settings:**
   - Go to Supabase Dashboard > Settings > API
   - Verify "Enable anonymous sign-ins" is checked
   - Check if there are any IP restrictions

2. **Check Database Settings:**
   - Go to Supabase Dashboard > Settings > Database
   - Verify RLS is enabled but not overly restrictive
   - Check if there are any database-level restrictions

3. **Verify Network Connectivity:**
   - Check if your network/firewall is blocking Supabase
   - Try accessing the API from a different network
   - Use curl to test direct API access:

```bash
curl -X GET "https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/restaurants" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Solution 4: Database Schema Reset

**What it is:** Completely reset the database schema and recreate with proper permissions.

### Implementation:

1. **Backup Existing Data:**
```sql
-- Export existing data if any
COPY restaurants TO '/tmp/restaurants_backup.csv' WITH CSV HEADER;
```

2. **Drop and Recreate Tables:**
```sql
-- Drop all tables
DROP TABLE IF EXISTS public.ml_model_configs;
DROP TABLE IF EXISTS public.priority_rules;
DROP TABLE IF EXISTS public.monthly_limits;
DROP TABLE IF EXISTS public.daily_limits;
DROP TABLE IF EXISTS public.staff_groups;
DROP TABLE IF EXISTS public.config_versions;
DROP TABLE IF EXISTS public.restaurants;

-- Recreate with proper structure (use your existing schema)
-- But ensure RLS is configured correctly from the start
```

3. **Apply Comprehensive Policies:**
Use the SQL script provided in `fix-supabase-rls-policies.sql`

## Solution 5: Local Development Bypass

**What it is:** Temporarily bypass Supabase entirely for local development.

### Implementation:

1. **Add Environment Flag:**
```env
REACT_APP_DISABLE_SUPABASE=true
```

2. **Update ConfigurationService:**
```javascript
// In src/services/ConfigurationService.js
constructor() {
  this.settings = this.loadSettings();
  this.restaurantId = null;
  this.currentVersionId = null;
  
  // Check if Supabase is disabled
  if (process.env.REACT_APP_DISABLE_SUPABASE === 'true') {
    this.isSupabaseEnabled = false;
    this.supabaseInitialized = true;
    console.log('🚫 Supabase disabled via environment variable');
    return;
  }
  
  this.isSupabaseEnabled = false;
  this.syncInProgress = false;
  this.supabaseInitialized = false;
  
  // Check Supabase availability (async, doesn't block constructor)
  this.checkSupabaseConnection();
}
```

## Recommended Fix Order

1. **First, try the RLS Policy Fix:**
   - Apply the `fix-supabase-rls-policies.sql` script
   - Run the verification tests
   - This should solve the immediate issue

2. **If RLS fix doesn't work, use Service Role Key:**
   - Quick temporary solution for development
   - Replace anon key with service role key
   - Plan to implement proper auth later

3. **For production, implement proper authentication:**
   - Add user registration/login
   - Update RLS policies for authenticated users
   - Add authentication UI components

4. **As last resort, disable Supabase temporarily:**
   - Use local storage only
   - Add environment flag to bypass database sync
   - Continue development without cloud sync

## Verification Commands

After applying any solution, use these commands in browser console:

```javascript
// Test basic connection
fetch('https://ymdyejrljmvajqjbejvh.supabase.co/rest/v1/restaurants?select=*', {
  headers: {
    'apikey': 'YOUR_KEY_HERE',
    'Authorization': 'Bearer YOUR_KEY_HERE'
  }
}).then(r => r.json()).then(console.log);

// Test app integration
configService.checkSupabaseConnection();
configService.getSyncStatus();
```

## Security Considerations

- **Anonymous Access:** Suitable for development but not production
- **Service Role:** Full database access - use with caution
- **Authenticated Users:** Most secure approach for production
- **RLS Policies:** Always verify they match your security requirements

Choose the solution that best fits your current development stage and security requirements.