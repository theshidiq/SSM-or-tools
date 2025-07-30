// Temporary script to reset staff data and force reload of defaults
// Run this in browser console to clear cached staff data

// Clear all staff-related localStorage data
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('staff') || key.includes('Staff') || key.includes('members'))) {
    keysToRemove.push(key);
  }
}

console.log('Clearing localStorage keys:', keysToRemove);
keysToRemove.forEach(key => localStorage.removeItem(key));

// Also clear period-specific data that might have staff info
for (let period = 0; period < 6; period++) {
  localStorage.removeItem(`schedule_data_period_${period}`);
  localStorage.removeItem(`staff_members_period_${period}`);
}

// Clear optimized storage cache keys
const cacheKeys = ['scheduleCache', 'staffCache', 'performanceMetrics'];
cacheKeys.forEach(key => localStorage.removeItem(key));

console.log('✅ All staff data cleared! Refresh the page to load original staff data.');