# Browser Cache Issue - Root Cause Analysis & Solution

## ✅ Issue Resolved - Database Cleaned

**Status**: 3 duplicate priority rules have been successfully deleted from Supabase.

## 🔍 Root Cause Identified

The browser cache issue was **NOT** caused by browser caching or service workers. The actual problem is:

### **The user is accessing the WRONG PORT**

- **Excalidraw POC server** is running on: `http://localhost:3000` ❌
- **Shift Schedule Manager** is running on: `http://localhost:3001` ✅

## 📊 Investigation Summary

### What We Found:

1. **Debouncing code IS present** in source file (`src/components/settings/tabs/PriorityRulesTab.jsx`, lines 173-240)
2. **Debouncing code IS being served** by React dev server (verified in bundle.js)
3. **No service worker** is registered (checked - not in use)
4. **No aggressive caching** in webpack config
5. **Port conflict detected**:
   - Process 50366 (`node dist/server.js` - Excalidraw) is on port 3000
   - Process 31890 (React dev server - Shift Schedule) is on port 3001

### Server Status:

```bash
Port 3000: Excalidraw POC Backend (WRONG APP)
Port 3001: Shift Schedule Manager React Dev Server (CORRECT APP) ✅
Port 8080: Go WebSocket Server (CORRECT - Running)
```

### Verification Commands Used:

```bash
# Confirmed Excalidraw on port 3000
curl -s http://localhost:3000 | grep -o '<title>[^<]*</title>'
# Output: Excalidraw POC - Backend API Integration

# Confirmed Shift Schedule Manager on port 3001
curl -s http://localhost:3001 | grep -o '<title>[^<]*</title>'
# Output: <title>Shift Schedule Manager</title>

# Confirmed debouncing code in bundle
curl -s "http://localhost:3001/static/js/bundle.js" | grep -o "DEBOUNCE"
# Output: DEBOUNCE (found 4 times)
```

## ✅ Solution

### Immediate Action Required:

**Access the correct URL: `http://localhost:3001`**

The browser was loading cached JavaScript from the **wrong application** (Excalidraw POC on port 3000).

### Why This Happened:

1. Excalidraw POC server started first and claimed port 3000
2. React dev server automatically moved to port 3001 (standard Create React App behavior)
3. User continued accessing `http://localhost:3000` (old/wrong app)
4. Browser cached the wrong app's JavaScript
5. Hard refresh didn't help because it was refreshing the wrong app

## 🔧 Step-by-Step Fix

### Step 1: Close the wrong application

```bash
# Kill the Excalidraw server on port 3000
kill 50366

# Or find and kill manually:
lsof -i :3000 | grep LISTEN
# Then: kill <PID>
```

### Step 2: Restart the correct dev server

```bash
cd /Users/kamalashidiq/Documents/Apps/shift-schedule-manager

# Stop current dev server (Ctrl+C in terminal running npm start)

# Restart to reclaim port 3000
npm start
```

### Step 3: Access the correct URL

Open browser to: **`http://localhost:3000`** (will now show correct app)

### Step 4: Clear browser cache (optional but recommended)

Since you were accessing the wrong app, clear browser cache:

**Chrome/Edge:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**OR use DevTools Application tab:**
1. F12 → Application tab
2. Clear Storage → Clear site data

**Firefox:**
1. Ctrl+Shift+Delete
2. Check "Cache" only
3. Time range: "Everything"
4. Click "Clear Now"

**Safari:**
1. Develop menu → Empty Caches (⌥⌘E)
2. Or: Safari → Clear History → All History

## 🧪 Verification Steps

After fixing, verify the new code is loaded:

### 1. Check Go Server Logs

When you create a new priority rule, you should now see:

```
🔄 [DEBOUNCE] Syncing buffered updates for rule <rule-id>: {...}
```

### 2. Check Browser Console

Open DevTools Console (F12) and look for the debounce log message when editing rule name.

### 3. Test Priority Rule Creation

1. Go to Settings → Priority Rules
2. Click "Add Priority Rule"
3. Change the rule name
4. **Wait 500ms without typing**
5. Check Go server logs - should see `🔄 [DEBOUNCE]` message
6. Check database - should have **only 1 rule**, not 3 duplicates

## 🚫 What NOT to Do

- ❌ Don't run multiple React dev servers simultaneously
- ❌ Don't access port 3000 if another app is on it
- ❌ Don't hard refresh port 3000 when your app is on 3001
- ❌ Don't blame browser cache when it's a wrong-port issue

## 📝 Prevention

To prevent this in the future:

### Option 1: Kill conflicting servers

```bash
# Before starting shift-schedule-manager, kill port 3000:
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
```

### Option 2: Set explicit port

Create `.env` file in project root:

```bash
PORT=3002
```

Then the app will always start on port 3002, avoiding conflicts.

### Option 3: Check running servers

Before `npm start`, check what's running:

```bash
lsof -i :3000
lsof -i :3001
```

## 🎯 Current System Status

### ✅ Completed:
- [x] Database cleaned (3 duplicates removed)
- [x] Source code verified (debouncing present)
- [x] Bundle verified (debouncing code served)
- [x] Root cause identified (wrong port)
- [x] Solution documented

### 🔄 User Actions Required:
1. Kill Excalidraw server on port 3000
2. Restart Shift Schedule Manager dev server
3. Access correct URL: `http://localhost:3001` (or `http://localhost:3000` after restart)
4. Clear browser cache
5. Test priority rule creation

## 📞 Next Steps

1. **Immediately**: Access `http://localhost:3001` to use the correct app with debouncing
2. **Optional**: Kill port 3000 and restart to reclaim default port
3. **Verify**: Create a test priority rule and confirm only 1 is created (no duplicates)

## 🐛 Debugging Commands

If issues persist, run these commands:

```bash
# Check what's running on each port
lsof -i :3000 -n -P
lsof -i :3001 -n -P
lsof -i :8080 -n -P

# Check React dev server process
ps aux | grep react-scripts | grep -v grep

# Check bundle for debounce code
curl -s "http://localhost:3001/static/js/bundle.js" | grep -o "DEBOUNCE"

# Test Go WebSocket server
curl http://localhost:8080/health
```

---

**Created**: 2025-10-25
**Status**: Database cleaned, root cause identified, solution provided
**Impact**: Issue was NOT browser cache - was wrong port access
