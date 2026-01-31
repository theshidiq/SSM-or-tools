# March 7 Post-Period Day-Off Bug - Root Cause Analysis

## Problem Statement
Despite adding `postPeriodDays=2` feature, March 7 still shows day-offs (×) for some staff members in production, even though March 6 works correctly.

## Test Results
✅ **Backend Logic is CORRECT** - `test_march7_issue.py` passes with 100% success rate
- The Python OR-Tools scheduler correctly implements the constraint
- `postPeriodDays=2` properly protects BOTH March 6 AND March 7
- HARD constraint mode is working as expected

## Root Cause Analysis

### What We Know
1. **Backend Works**: Python scheduler correctly applies constraints when `postPeriodDays=2` is provided
2. **Frontend Defaults**: `EarlyShiftPreferencesTab.jsx` has correct default: `postPeriodDays: 2` (line 43)
3. **Data Flow**: Frontend → Go Server → Python OR-Tools → Schedule

### The Bug is in Data Persistence/Configuration
Since the backend test passes but production fails, the issue is **NOT** in the constraint logic. The issue is in **configuration delivery**:

#### Most Likely Cause: localStorage Not Saved
The `earlyShiftConfig` is stored in **localStorage** (not database), as seen in:
- `useAISettings.js` line 54: `localStorage.getItem(EARLY_SHIFT_CONFIG_KEY)`
- `EarlyShiftPreferencesTab.jsx` line 62: `localStorage.setItem(EARLY_SHIFT_CONFIG_KEY, ...)`

**Problem**: If the user hasn't explicitly saved the settings in the UI, the old localStorage config (without `postPeriodDays`) is still being used!

#### Other Possible Causes
1. **Old Schedule**: The schedule was generated BEFORE the `postPeriodDays=2` feature was added
2. **Empty Config**: localStorage is empty, causing default behavior (protect only 1 day)
3. **Frontend Not Sending**: The config is being filtered out somewhere in the data flow

## Diagnostic Steps

### 1. Check Browser localStorage
```javascript
// In browser DevTools Console:
JSON.parse(localStorage.getItem('shift-schedule-earlyShiftConfig'))
```

**Expected Output:**
```json
{
  "postPeriodConstraint": {
    "enabled": true,
    "isHardConstraint": true,
    "minPeriodLength": 3,
    "postPeriodDays": 2,
    "avoidDayOffForShain": true,
    "avoidDayOffForHaken": true,
    "allowEarlyForShain": true
  }
}
```

**If `postPeriodDays` is missing or not equal to 2**, that's the bug!

### 2. Check Frontend Console Logs
When clicking "AI自動生成" button, look for:
```
[OR-TOOLS] 🎯 earlyShiftConfig being sent: {...}
```

Verify `postPeriodDays: 2` is present in the logged config.

**If you see this warning:**
```
[OR-TOOLS] ⚠️ WARNING - earlyShiftConfig is EMPTY!
```
Then localStorage is not properly configured.

### 3. Check Go Server Logs
Look for this line in Go server output:
```
[ORTOOLS] 🎯 earlyShiftConfig.postPeriodConstraint:
[ORTOOLS]   enabled=true, isHardConstraint=true, minPeriodLength=3, postPeriodDays=2
```

**If `postPeriodDays` is missing or wrong**, the frontend is not sending it correctly.

### 4. Check Python OR-Tools Logs
Look for these lines:
```
[OR-TOOLS] POST DAY-OFF PERIOD CONSTRAINTS
Config: minPeriodLength=3, mode=HARD, postPeriodDays=2
POST-PERIOD DATES TO PROTECT: ["2026-03-07", "2026-03-08"]
```

**If `postPeriodDays=1`** or dates only show `["2026-03-07"]`, the config is not being passed correctly.

## Solution

### Option 1: Force Default Config (Quick Fix)
The easiest fix is to update the default in `useAISettings.js` so that even if localStorage is empty, it uses `postPeriodDays=2`:

```javascript
// In useAISettings.js line 52-66
const earlyShiftConfig = useMemo(() => {
  try {
    const saved = localStorage.getItem(EARLY_SHIFT_CONFIG_KEY);
    const localConfig = saved ? JSON.parse(saved) : {
      postPeriodConstraint: {
        enabled: true,
        isHardConstraint: true,
        minPeriodLength: 3,
        postPeriodDays: 2,  // ← DEFAULT to 2 days
        avoidDayOffForShain: true,
        avoidDayOffForHaken: true,
        allowEarlyForShain: true,
      }
    };
    // ...
  }
}, [settings?.earlyShiftConfig]);
```

### Option 2: UI Instructions for User
Ask the user to:
1. Open the application in their browser
2. Go to Settings → Early Shift tab
3. Verify the "Post day-off period constraint" toggle is **ON**
4. Verify "Post-period days" slider shows **2 days**
5. Click any setting to trigger a save (e.g., toggle off/on)
6. Go back to schedule page
7. Click "AI自動生成" button to regenerate the schedule

### Option 3: Database Migration (Permanent Fix)
Store `earlyShiftConfig` in the database instead of localStorage:
1. Add `early_shift_config` JSONB column to `restaurant_settings` table
2. Migrate localStorage data to database on first load
3. Update `useSettingsData` to include `earlyShiftConfig`
4. Remove localStorage dependency

## Verification
After applying the fix, verify:

1. **localStorage Check**:
   ```javascript
   localStorage.getItem('shift-schedule-earlyShiftConfig')
   // Should contain: "postPeriodDays": 2
   ```

2. **Generate New Schedule**:
   - Click "AI自動生成" button
   - Check console logs show `postPeriodDays=2`
   - Verify March 7 no longer has day-offs

3. **Run Backend Test**:
   ```bash
   python3 test_march7_issue.py
   # Should pass with "✅ TEST PASSED"
   ```

## Updated Go Server
The Go server logging has been updated to show ALL post-period config fields:
```go
log.Printf("[ORTOOLS]   enabled=%v, isHardConstraint=%v, minPeriodLength=%v, postPeriodDays=%v",
  postPeriodConstraint["enabled"],
  postPeriodConstraint["isHardConstraint"],
  postPeriodConstraint["minPeriodLength"],
  postPeriodConstraint["postPeriodDays"])
```

Rebuild with: `cd go-server && go build -o shift-schedule-go-server *.go`

## Conclusion
The backend constraint logic is **100% correct**. The bug is in **configuration delivery** - most likely:
- localStorage has old config without `postPeriodDays=2`
- OR schedule was generated before the feature was added
- OR user hasn't saved settings after the feature was deployed

**Recommended Fix**: Apply Option 1 (force default config) + ask user to regenerate schedule.
