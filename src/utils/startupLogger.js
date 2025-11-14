/**
 * Startup Debug Logger
 * Tracks settings state changes during app initialization
 * Helps identify EXACTLY when and where data gets wiped
 */

const startTime = Date.now();
const logs = [];

class StartupLogger {
  constructor() {
    this.enabled = process.env.REACT_APP_DEBUG_STARTUP === 'true';
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since app start
   */
  getElapsed() {
    return `T+${Date.now() - this.startTime}ms`;
  }

  /**
   * Log a settings change with timestamp
   */
  logSettingsChange(source, description, newSettings) {
    if (!this.enabled) return;

    const elapsed = this.getElapsed();
    const priorityRulesCount = newSettings?.priorityRules?.length || 0;
    const staffGroupsCount = newSettings?.staffGroups?.length || 0;

    // Check if priority rules have staff IDs
    let rulesWithStaff = 0;
    let rulesWithoutStaff = 0;
    if (newSettings?.priorityRules) {
      newSettings.priorityRules.forEach(rule => {
        const staffIds = rule.staffIds || [];
        if (staffIds.length > 0) {
          rulesWithStaff++;
        } else {
          rulesWithoutStaff++;
        }
      });
    }

    const logEntry = {
      timestamp: elapsed,
      source,
      description,
      priorityRulesCount,
      staffGroupsCount,
      rulesWithStaff,
      rulesWithoutStaff,
    };

    logs.push(logEntry);

    // Console output
    console.log(`\n🔍 [${elapsed}] ${source}: ${description}`);
    console.log(`   Priority Rules: ${priorityRulesCount} total (${rulesWithStaff} with staff, ${rulesWithoutStaff} empty)`);
    console.log(`   Staff Groups: ${staffGroupsCount} total`);

    // WARNING if data just disappeared
    if (priorityRulesCount === 0 && logs.length > 1) {
      const prevLog = logs[logs.length - 2];
      if (prevLog.priorityRulesCount > 0) {
        console.warn(`⚠️  WARNING: Priority rules went from ${prevLog.priorityRulesCount} → 0!`);
        console.warn(`   Previous state: ${prevLog.source} - ${prevLog.description}`);
        console.warn(`   Current state: ${source} - ${description}`);
        console.trace('   Stack trace:');
      }
    }

    // WARNING if staff IDs disappeared
    if (rulesWithStaff === 0 && rulesWithoutStaff > 0) {
      const prevLog = logs[logs.length - 2];
      if (prevLog && prevLog.rulesWithStaff > 0) {
        console.warn(`⚠️  WARNING: Staff IDs disappeared! Rules went from ${prevLog.rulesWithStaff} with staff → 0 with staff`);
        console.warn(`   Previous state: ${prevLog.source} - ${prevLog.description}`);
        console.warn(`   Current state: ${source} - ${description}`);
        console.trace('   Stack trace:');
      }
    }
  }

  /**
   * Log WebSocket lifecycle events
   */
  logWebSocket(event, details) {
    if (!this.enabled) return;

    const elapsed = this.getElapsed();
    console.log(`\n🔌 [${elapsed}] WebSocket ${event}:`, details);

    logs.push({
      timestamp: elapsed,
      source: 'WebSocket',
      description: `${event}: ${JSON.stringify(details)}`,
    });
  }

  /**
   * Log hook lifecycle events
   */
  logHook(hookName, event, details) {
    if (!this.enabled) return;

    const elapsed = this.getElapsed();
    console.log(`\n🪝 [${elapsed}] ${hookName} ${event}:`, details);

    logs.push({
      timestamp: elapsed,
      source: hookName,
      description: `${event}: ${JSON.stringify(details)}`,
    });
  }

  /**
   * Print timeline summary
   */
  printTimeline() {
    if (!this.enabled) return;

    console.log('\n' + '='.repeat(80));
    console.log('📊 STARTUP TIMELINE SUMMARY');
    console.log('='.repeat(80));

    logs.forEach((log, index) => {
      const icon = log.rulesWithoutStaff > log.rulesWithStaff ? '⚠️ ' : '  ';
      console.log(`${icon}${log.timestamp.padEnd(10)} | ${log.source.padEnd(25)} | ${log.description}`);
      if (log.priorityRulesCount !== undefined) {
        console.log(`${' '.repeat(13)}   Rules: ${log.priorityRulesCount} (${log.rulesWithStaff} with staff)`);
      }
    });

    console.log('='.repeat(80) + '\n');

    // Analyze for data wipe
    const dataWipes = [];
    logs.forEach((log, index) => {
      if (index === 0) return;
      const prev = logs[index - 1];

      // Check for priority rules disappearing
      if (prev.priorityRulesCount > 0 && log.priorityRulesCount === 0) {
        dataWipes.push({
          type: 'TOTAL_WIPE',
          from: prev,
          to: log,
        });
      }

      // Check for staff IDs disappearing
      if (prev.rulesWithStaff > 0 && log.rulesWithStaff === 0 && log.priorityRulesCount > 0) {
        dataWipes.push({
          type: 'STAFF_IDS_WIPE',
          from: prev,
          to: log,
        });
      }
    });

    if (dataWipes.length > 0) {
      console.log('🚨 DATA WIPE DETECTED:\n');
      dataWipes.forEach((wipe, index) => {
        console.log(`${index + 1}. ${wipe.type}:`);
        console.log(`   FROM: [${wipe.from.timestamp}] ${wipe.from.source} - ${wipe.from.description}`);
        console.log(`         Rules: ${wipe.from.priorityRulesCount} (${wipe.from.rulesWithStaff} with staff)`);
        console.log(`   TO:   [${wipe.to.timestamp}] ${wipe.to.source} - ${wipe.to.description}`);
        console.log(`         Rules: ${wipe.to.priorityRulesCount} (${wipe.to.rulesWithStaff} with staff)`);
        console.log('');
      });
    } else {
      console.log('✅ No data wipes detected in timeline\n');
    }
  }

  /**
   * Export logs for analysis
   */
  exportLogs() {
    return {
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      logs: [...logs],
    };
  }
}

// Singleton instance
const logger = new StartupLogger();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.__startupLogger = logger;
  window.__printStartupTimeline = () => logger.printTimeline();
  window.__exportStartupLogs = () => logger.exportLogs();
}

export default logger;
