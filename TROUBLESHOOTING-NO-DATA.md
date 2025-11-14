# Troubleshooting: "No historical data available for training"

## Problem
When you click "モデルトレーニングを開始", you get the error:
```
❌ Training failed: Error: Training data extraction failed: No historical data available for training
```

## Root Cause
The period detection system is not finding any schedule data in localStorage.

## Quick Diagnosis

### Step 1: Check Console Logs
Open browser console (F12) and look for these messages:
```
🔍 [Period Detection] Checking X defined periods...
❌ Period 0 has no data in localStorage (key: scheduleData_0)
❌ Period 1 has no data in localStorage (key: scheduleData_1)
...
📊 Detected 0 periods with data: []
```

### Step 2: Check localStorage
In browser console, run:
```javascript
// Check what's in localStorage
for (let i = 0; i < 10; i++) {
  const key = `scheduleData_${i}`;
  const data = localStorage.getItem(key);
  console.log(`${key}:`, data ? 'Has data' : 'No data');
}
```

### Step 3: Check if you have any schedules
```javascript
// List all localStorage keys
Object.keys(localStorage).filter(k => k.startsWith('scheduleData'));
```

## Solutions

### Solution 1: You Need to Create Schedules First! ✅

**The training system requires existing schedule data to learn from.**

1. **Create Staff Members**:
   - Click "Manage Staff" button
   - Add at least 5-10 staff members
   - Save

2. **Create Schedule Data**:
   - Fill in the schedule table with shifts (△, ○, ◇, ×)
   - Make sure you have data for multiple days
   - Save the schedule (it auto-saves to localStorage)

3. **Verify Data Saved**:
   - Reload the page
   - Check if your schedule data is still there
   - If yes, data is in localStorage ✅

4. **Try Training Again**:
   - Go to Settings → ML Parameters
   - Click "モデルトレーニングを開始"
   - Should now detect your periods!

### Solution 2: Check Period Index

Your current period might not be period 0. Check which period you're on:

```javascript
// In console
localStorage.getItem('currentMonthIndex');
```

If it shows `"5"` or another number, that's the period with your data.

### Solution 3: Import Existing Data

If you have existing schedule data in another format:

1. Use the **Import HTML** feature:
   - Click the Upload button in toolbar
   - Import your existing schedules
   - This will populate localStorage

2. Or manually create sample data for testing:
```javascript
// Create sample data for period 0
const sampleData = {
  "staff1": {
    "2025-01-01": "○",
    "2025-01-02": "○",
    "2025-01-03": "×",
  },
  "staff2": {
    "2025-01-01": "△",
    "2025-01-02": "○",
    "2025-01-03": "×",
  }
};
localStorage.setItem('scheduleData_0', JSON.stringify(sampleData));
```

### Solution 4: Check Data Format

The data must be in this format:
```javascript
{
  "staffId1": {
    "2025-01-01": "○",
    "2025-01-02": "×",
    "2025-01-03": "△"
  },
  "staffId2": {
    "2025-01-01": "◇",
    "2025-01-02": "○",
    "2025-01-03": "×"
  }
}
```

Check your data:
```javascript
const data = JSON.parse(localStorage.getItem('scheduleData_0'));
console.log('Staff count:', Object.keys(data).length);
console.log('First staff shifts:', Object.keys(data[Object.keys(data)[0]]).length);
```

## Expected Console Output (When Working)

When training works correctly, you should see:
```
🔍 [Period Detection] Checking 10 defined periods...
✅ Period 0 has data (15 staff members)
✅ Period 1 has data (15 staff members)
✅ Period 2 has data (15 staff members)
...
📊 Detected 10 periods with data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
📊 [DataExtractor] Using 10 periods for training: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## Minimum Requirements for Training

- **At least 1 period** with schedule data
- **At least 1 staff member** with schedules
- **At least 50 shift assignments** total
- Data must be in localStorage with key `scheduleData_X`

## Still Not Working?

### Debug Script
Run this in console to get full diagnostic:
```javascript
// Full diagnostic
console.log('=== TRAINING DATA DIAGNOSTIC ===');
console.log('1. Check periods:');
for (let i = 0; i < 10; i++) {
  const key = `scheduleData_${i}`;
  const data = localStorage.getItem(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      const staffCount = Object.keys(parsed).length;
      let totalShifts = 0;
      Object.values(parsed).forEach(schedule => {
        totalShifts += Object.keys(schedule).length;
      });
      console.log(`  Period ${i}: ${staffCount} staff, ${totalShifts} shifts`);
    } catch (e) {
      console.log(`  Period ${i}: Invalid data (${e.message})`);
    }
  } else {
    console.log(`  Period ${i}: No data`);
  }
}

console.log('2. Check staff data:');
for (let i = 0; i < 10; i++) {
  const key = `staffData_${i}`;
  const data = localStorage.getItem(key);
  if (data) {
    const parsed = JSON.parse(data);
    console.log(`  Period ${i}: ${parsed.length} staff members`);
  }
}

console.log('3. Current period:', localStorage.getItem('currentMonthIndex'));
console.log('=== END DIAGNOSTIC ===');
```

## Summary

**Most Common Issue**: No schedule data exists yet - you need to create schedules first!

**Solution**:
1. Add staff members
2. Fill in shift schedules
3. Save (auto-saves to localStorage)
4. Try training again

The training system learns from your existing schedules, so you need actual schedule data before training can work.
