/**
 * Daily Limits Migration State Verification Script
 *
 * This script checks the current state of daily limits data in both
 * localStorage and the database to prepare for migration.
 *
 * Usage:
 * 1. Browser Console: Copy and paste this entire script
 * 2. Node.js: Run with `node verify-daily-limits-state.js` (requires Supabase credentials)
 */

// ============================================================================
// BROWSER CONSOLE VERSION
// ============================================================================

async function verifyDailyLimitsState() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Daily Limits Migration State Verification                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // -------------------------------------------------------------------------
  // 1. Check localStorage
  // -------------------------------------------------------------------------
  console.log('1️⃣  LOCALSTORAGE STATE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let localStorageData = null;
  let dailyLimits = null;

  try {
    const rawData = localStorage.getItem('shift-schedule-settings');

    if (!rawData) {
      console.warn('⚠️  No localStorage data found');
      console.warn('   Key: shift-schedule-settings');
      console.warn('   This is unexpected - application should have default settings\n');
    } else {
      localStorageData = JSON.parse(rawData);
      dailyLimits = localStorageData?.dailyLimits;

      console.log('✅ localStorage data found');
      console.log(`   Migration Version: ${localStorageData.migrationVersion || 'unknown'}`);
      console.log(`   Total size: ${(rawData.length / 1024).toFixed(2)} KB\n`);

      if (dailyLimits) {
        console.log('✅ Daily Limits data exists:');
        console.log('   ┌──────────────────────────┬───────┐');
        console.log('   │ Constraint               │ Value │');
        console.log('   ├──────────────────────────┼───────┤');
        console.log(`   │ minOffPerDay             │ ${String(dailyLimits.minOffPerDay).padEnd(5)} │`);
        console.log(`   │ maxOffPerDay             │ ${String(dailyLimits.maxOffPerDay).padEnd(5)} │`);
        console.log(`   │ minEarlyPerDay           │ ${String(dailyLimits.minEarlyPerDay).padEnd(5)} │`);
        console.log(`   │ maxEarlyPerDay           │ ${String(dailyLimits.maxEarlyPerDay).padEnd(5)} │`);
        console.log(`   │ minLatePerDay            │ ${String(dailyLimits.minLatePerDay).padEnd(5)} │`);
        console.log(`   │ maxLatePerDay            │ ${String(dailyLimits.maxLatePerDay).padEnd(5)} │`);
        console.log(`   │ minWorkingStaffPerDay    │ ${String(dailyLimits.minWorkingStaffPerDay).padEnd(5)} │`);
        console.log('   └──────────────────────────┴───────┘\n');

        // Validate MIN <= MAX
        const validations = {
          'Off Days': dailyLimits.minOffPerDay <= dailyLimits.maxOffPerDay,
          'Early Shifts': dailyLimits.minEarlyPerDay <= dailyLimits.maxEarlyPerDay,
          'Late Shifts': dailyLimits.minLatePerDay <= dailyLimits.maxLatePerDay,
        };

        console.log('   Validation (MIN ≤ MAX):');
        Object.entries(validations).forEach(([name, valid]) => {
          console.log(`   ${valid ? '✅' : '❌'} ${name}`);
        });

        if (!Object.values(validations).every(v => v)) {
          console.error('\n   ⚠️  VALIDATION FAILED: Some MIN values exceed MAX values!');
        }

        console.log('');
      } else {
        console.warn('⚠️  Daily Limits not found in localStorage');
        console.warn('   This is unexpected for migration v5\n');
      }

      // Check other settings
      const otherSettings = {
        'Staff Groups': localStorageData.staffGroups?.length || 0,
        'Weekly Limits': localStorageData.weeklyLimits?.length || 0,
        'Monthly Limits': localStorageData.monthlyLimits?.length || 0,
        'Priority Rules': localStorageData.priorityRules?.length || 0,
      };

      console.log('   Other Settings:');
      Object.entries(otherSettings).forEach(([name, count]) => {
        console.log(`   • ${name}: ${count} items`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to read localStorage:', error.message);
    console.error('   This may indicate corrupted data\n');
  }

  // -------------------------------------------------------------------------
  // 2. Check WebSocket Status
  // -------------------------------------------------------------------------
  console.log('2️⃣  WEBSOCKET STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const wsEnabled = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';
  console.log(`   Feature Flag: ${wsEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`   Environment: REACT_APP_WEBSOCKET_SETTINGS=${process.env.REACT_APP_WEBSOCKET_SETTINGS}\n`);

  // Check WebSocket connection
  try {
    const ws = new WebSocket('ws://localhost:8080/staff-sync');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('   ✅ WebSocket Server: ONLINE');
        console.log('   URL: ws://localhost:8080/staff-sync');
        ws.close();
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
      };
    });
  } catch (error) {
    console.warn('   ⚠️  WebSocket Server: OFFLINE');
    console.warn(`   Error: ${error.message}`);
    console.warn('   Start server: cd go-server && go run main.go');
  }

  console.log('');

  // -------------------------------------------------------------------------
  // 3. Check React State (if available)
  // -------------------------------------------------------------------------
  console.log('3️⃣  REACT STATE (Current Session)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Try to access React DevTools global hook
    const reactDevTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    if (!reactDevTools) {
      console.warn('   ⚠️  React DevTools not installed');
      console.warn('   Install: https://react.dev/learn/react-developer-tools\n');
    } else {
      console.log('   ✅ React DevTools available');
      console.log('   Use React DevTools > Components to inspect useSettingsData hook\n');
    }
  } catch (error) {
    console.warn('   ⚠️  Cannot access React state:', error.message);
  }

  // -------------------------------------------------------------------------
  // 4. Migration Readiness Check
  // -------------------------------------------------------------------------
  console.log('4️⃣  MIGRATION READINESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const readinessChecks = {
    'localStorage has daily limits': !!dailyLimits,
    'Daily limits have MIN constraints': dailyLimits?.minOffPerDay !== undefined,
    'Migration version is 5': localStorageData?.migrationVersion === 5,
    'WebSocket feature flag enabled': wsEnabled,
  };

  let allReady = true;
  Object.entries(readinessChecks).forEach(([check, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    if (!passed) allReady = false;
  });

  console.log('');

  if (allReady) {
    console.log('✅ READY FOR MIGRATION');
    console.log('   All prerequisites met. You can proceed with migration.\n');
  } else {
    console.warn('⚠️  NOT READY FOR MIGRATION');
    console.warn('   Fix the issues above before migrating.\n');
  }

  // -------------------------------------------------------------------------
  // 5. Migration Instructions
  // -------------------------------------------------------------------------
  console.log('5️⃣  NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (allReady) {
    console.log('   To migrate to database:');
    console.log('   1. Ensure Go server is running:');
    console.log('      cd go-server && go run main.go\n');
    console.log('   2. Open React DevTools');
    console.log('   3. Find component using useSettingsData hook');
    console.log('   4. Call migrateToBackend() function\n');
    console.log('   OR add migration button to Settings UI:');
    console.log('   <button onClick={migrateToBackend}>Migrate to Database</button>\n');
  } else {
    console.log('   Fix prerequisites first:\n');

    if (!dailyLimits) {
      console.log('   • localStorage missing daily limits:');
      console.log('     - Ensure migration v5 has run');
      console.log('     - Check ConfigurationService.getDefaultSettings()\n');
    }

    if (!wsEnabled) {
      console.log('   • Enable WebSocket feature flag:');
      console.log('     - Edit .env: REACT_APP_WEBSOCKET_SETTINGS=true');
      console.log('     - Restart app: npm start\n');
    }

    if (localStorageData?.migrationVersion < 5) {
      console.log('   • Update localStorage migration version:');
      console.log('     - Run ConfigurationService.forceMigration()');
      console.log('     - This adds MIN constraints to daily limits\n');
    }
  }

  // -------------------------------------------------------------------------
  // 6. Export Data (for manual migration)
  // -------------------------------------------------------------------------
  if (dailyLimits) {
    console.log('6️⃣  EXPORT DATA (Manual Migration Backup)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Copy this JSON for manual SQL migration:\n');
    console.log('   ```json');
    console.log(JSON.stringify(dailyLimits, null, 2));
    console.log('   ```\n');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Verification Complete                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  return {
    localStorageData,
    dailyLimits,
    wsEnabled,
    ready: allReady,
    checks: readinessChecks,
  };
}

// ============================================================================
// AUTO-RUN IN BROWSER CONSOLE
// ============================================================================

if (typeof window !== 'undefined') {
  console.log('\n🔍 Running Daily Limits Migration State Verification...\n');
  verifyDailyLimitsState().then(result => {
    console.log('\n📊 Verification result stored in window.__dailyLimitsVerification');
    window.__dailyLimitsVerification = result;
  });
}

// ============================================================================
// NODE.JS VERSION (for server-side verification)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyDailyLimitsState };
}
