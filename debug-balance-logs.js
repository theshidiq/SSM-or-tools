// Debug script - Paste this in browser console after generating a schedule
// Then call: filterBalanceLogs() or filterDateLogs('2025-12-04')

window.filterBalanceLogs = () => {
  console.log('\n=== BALANCE PHASE LOGS ===\n');
  // This will show all BALANCE related logs from the console
  console.log('Search console for: [BALANCE]');
  console.log('Look for:');
  console.log('  1. "min: X, max: Y" - Check if min > 0');
  console.log('  2. "dailyLimitsRaw source: database" - Confirms DB values used');
  console.log('  3. "Only X staff off, need Y more" - Shows MIN violations found');
  console.log('  4. "Skip × on" - Shows why staff were skipped');
  console.log('  5. "Added × on" - Shows successful assignments');
};

window.filterDateLogs = (date) => {
  console.log(`\n=== LOGS FOR ${date} ===\n`);
  console.log(`Search console for: ${date}`);
};

window.filterStaffLogs = (staffName) => {
  console.log(`\n=== LOGS FOR ${staffName} ===\n`);
  console.log(`Search console for: ${staffName}`);
};

// Auto-capture logs during generation
window.capturedLogs = [];
const originalLog = console.log;
window.startCapture = () => {
  window.capturedLogs = [];
  console.log = (...args) => {
    const msg = args.join(' ');
    window.capturedLogs.push(msg);
    originalLog.apply(console, args);
  };
  console.log('📝 Log capture started. Generate schedule, then call showBalanceLogs()');
};

window.stopCapture = () => {
  console.log = originalLog;
  console.log('📝 Log capture stopped.');
};

window.showBalanceLogs = () => {
  stopCapture();
  const balanceLogs = window.capturedLogs.filter(log =>
    log.includes('[BALANCE]') ||
    log.includes('dailyLimitsRaw') ||
    log.includes('[getLiveSettings]')
  );
  console.log('\n========== FILTERED BALANCE LOGS ==========\n');
  balanceLogs.forEach(log => console.log(log));
  console.log('\n========== END ==========\n');
  console.log(`Total: ${balanceLogs.length} balance-related logs`);
  return balanceLogs;
};

window.showDateLogs = (dateStr) => {
  stopCapture();
  const dateLogs = window.capturedLogs.filter(log => log.includes(dateStr));
  console.log(`\n========== LOGS FOR ${dateStr} ==========\n`);
  dateLogs.forEach(log => console.log(log));
  console.log('\n========== END ==========\n');
  return dateLogs;
};

window.showStaffLogs = (staffName) => {
  stopCapture();
  const staffLogs = window.capturedLogs.filter(log => log.includes(staffName));
  console.log(`\n========== LOGS FOR ${staffName} ==========\n`);
  staffLogs.forEach(log => console.log(log));
  console.log('\n========== END ==========\n');
  return staffLogs;
};

console.log('🔧 Debug functions loaded!');
console.log('');
console.log('USAGE:');
console.log('  1. Run: startCapture()');
console.log('  2. Generate schedule (click 自動生成)');
console.log('  3. Run one of these:');
console.log('     - showBalanceLogs()     → All BALANCE phase logs');
console.log('     - showDateLogs("2025-12-04")  → Logs for specific date');
console.log('     - showDateLogs("12-04")       → Logs for Dec 4');
console.log('     - showStaffLogs("古藤")       → Logs for specific staff');
