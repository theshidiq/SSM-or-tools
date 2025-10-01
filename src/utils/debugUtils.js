/**
 * Debug utilities for WebSocket and database mode switching
 */

/**
 * Force the app to use database mode (Enhanced Supabase) instead of WebSocket
 */
export const forceDatabaseMode = (reason = 'manual_debug') => {
  console.log(`🔧 Debug: Forcing database mode. Reason: ${reason}`);

  // Set flag to disable WebSocket
  localStorage.setItem('FORCE_SUPABASE_ONLY', 'true');
  localStorage.setItem('WEBSOCKET_STAFF_MANAGEMENT', 'false');
  localStorage.setItem('DEBUG_FORCE_DATABASE_MODE', reason);
  localStorage.setItem('DEBUG_FORCE_DATABASE_TIMESTAMP', new Date().toISOString());

  // Reload to apply changes
  window.location.reload();
};

/**
 * Re-enable WebSocket mode
 */
export const enableWebSocketMode = () => {
  console.log('🔧 Debug: Re-enabling WebSocket mode');

  localStorage.removeItem('FORCE_SUPABASE_ONLY');
  localStorage.removeItem('WEBSOCKET_STAFF_MANAGEMENT');
  localStorage.removeItem('DEBUG_FORCE_DATABASE_MODE');
  localStorage.removeItem('DEBUG_FORCE_DATABASE_TIMESTAMP');

  // Reload to apply changes
  window.location.reload();
};

/**
 * Check current mode status
 */
export const getCurrentModeStatus = () => {
  const isForced = localStorage.getItem('FORCE_SUPABASE_ONLY') === 'true';
  const reason = localStorage.getItem('DEBUG_FORCE_DATABASE_MODE');
  const timestamp = localStorage.getItem('DEBUG_FORCE_DATABASE_TIMESTAMP');

  return {
    mode: isForced ? 'Database (Forced)' : 'WebSocket (Default)',
    isForced,
    reason,
    timestamp
  };
};

/**
 * Get connection health info
 */
export const getConnectionHealth = () => {
  const status = getCurrentModeStatus();
  console.log('🔍 Connection Status:', status);
  return status;
};

// Expose to window for easy debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debugUtils = {
    forceDatabaseMode,
    enableWebSocketMode,
    getCurrentModeStatus,
    getConnectionHealth
  };
  console.log('🔧 Debug utilities available at window.debugUtils');
}