// Script to clear localStorage and force reload of new staff data
// Copy and paste this into your browser console

console.log('🧹 Starting localStorage cleanup...');

// Count and show what we're removing
let removedCount = 0;
const keysToRemove = [];

// Collect all keys first
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
        keysToRemove.push(key);
    }
}

console.log('📋 Found', keysToRemove.length, 'localStorage items:', keysToRemove);

// Remove all items
keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    removedCount++;
});

console.log('🗑️ Removed', removedCount, 'localStorage items');

// Also clear sessionStorage
const sessionKeys = Object.keys(sessionStorage);
sessionKeys.forEach(key => sessionStorage.removeItem(key));
console.log('🗑️ Cleared sessionStorage:', sessionKeys.length, 'items');

// Clear any potential caches
if ('caches' in window) {
    caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
        });
    });
}

console.log('✅ All storage cleared!');
console.log('🔄 Reloading page to load new staff data...');

// Reload the page after a short delay
setTimeout(() => {
    window.location.reload(true); // Force reload from server
}, 1000);