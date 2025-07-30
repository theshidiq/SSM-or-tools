// Force clear all localStorage and reload with fresh staff data
console.log('🧹 Force clearing localStorage...');

// Clear everything
localStorage.clear();
sessionStorage.clear();

console.log('✅ All storage cleared');
console.log('🔄 Reloading page...');

// Force reload from server
window.location.reload(true);