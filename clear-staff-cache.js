/**
 * Script to clear localStorage staff data and force reload of new default staff data
 * This should be run after updating staffConstants.js with new staff data
 */

// Clear all staff-related localStorage keys
function clearStaffCache() {
  console.log('🧹 Starting staff cache cleanup...');
  
  const keysToRemove = [];
  
  // Find all staff-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('staff-') ||           // Period-based staff data
      key === 'staff-by-month-data' ||      // Legacy staff data
      key === 'shift_staff_by_month' ||     // Alternative legacy format
      key === 'shift_staff_members'         // Alternative legacy format
    )) {
      keysToRemove.push(key);
    }
  }
  
  // Remove identified keys
  let removedCount = 0;
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      removedCount++;
      console.log(`  ✅ Removed: ${key}`);
    } catch (error) {
      console.warn(`  ⚠️ Failed to remove ${key}:`, error);
    }
  });
  
  console.log(`✅ Staff cache cleanup completed: ${removedCount} keys removed`);
  console.log('🔄 New staff data will be loaded from staffConstants.js on next app startup');
  
  return { removedKeys: keysToRemove, removedCount };
}

// Run the cleanup
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  const result = clearStaffCache();
  
  // Log results for verification
  console.log('📊 Cleanup Results:', result);
  
  // Optionally reload the page to see changes immediately
  const shouldReload = confirm('Staff cache cleared successfully. Reload the page to see new staff data?');
  if (shouldReload) {
    window.location.reload();
  }
} else {
  console.error('❌ This script must be run in a browser environment with localStorage support');
}