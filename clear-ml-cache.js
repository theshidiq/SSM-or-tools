/**
 * Clear ML Model Cache
 *
 * This script clears the cached ML model from IndexedDB to force
 * recreation with the new MSE loss function.
 *
 * Run this in the browser console before training:
 *
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. Refresh the page
 * 5. Start training again - you should now see the MSE loss message
 */

(async function clearMLCache() {
  console.log('🧹 Starting ML cache cleanup...');

  try {
    // Clear IndexedDB model storage
    const MODEL_STORAGE_KEY = 'restaurant-schedule-ml-model';
    const METADATA_KEY = 'restaurant-schedule-ml-metadata';

    // Delete from IndexedDB
    const deleteFromIndexedDB = () => {
      return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('tensorflowjs');

        deleteRequest.onsuccess = () => {
          console.log('✅ Deleted tensorflowjs IndexedDB database');
          resolve();
        };

        deleteRequest.onerror = () => {
          console.warn('⚠️ Could not delete tensorflowjs database:', deleteRequest.error);
          resolve(); // Continue anyway
        };

        deleteRequest.onblocked = () => {
          console.warn('⚠️ IndexedDB deletion blocked - close other tabs using this app');
          resolve();
        };
      });
    };

    await deleteFromIndexedDB();

    // Clear localStorage metadata
    localStorage.removeItem('ml_model_metadata');
    localStorage.removeItem('ml_last_training_check');
    console.log('✅ Cleared localStorage metadata');

    // Clear any model backups
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('backup') && key.includes('model')) {
        backupKeys.push(key);
      }
    }

    backupKeys.forEach(key => localStorage.removeItem(key));
    if (backupKeys.length > 0) {
      console.log(`✅ Cleared ${backupKeys.length} model backups`);
    }

    console.log('🎉 ML cache cleared successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Refresh the page (F5)');
    console.log('2. Click the training button');
    console.log('3. Look for this message in console:');
    console.log('   "🔧 Using Mean Squared Error loss for improved numerical stability"');
    console.log('');
    console.log('✨ The model will be recreated with MSE loss function');

  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
  }
})();
