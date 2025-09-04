// Debug script for period duplication issue
// Run this in the browser console when the app is loaded

const debugPeriods = async () => {
  console.log('🔍 Starting period debugging...');
  
  // Check if the periods are available in the NavigationToolbar
  if (typeof window.checkPeriods === 'function') {
    console.log('\n📅 Calling NavigationToolbar debug function:');
    window.checkPeriods();
  }
  
  // Check if cleanup function is available
  if (typeof window.cleanupDuplicatePeriods === 'function') {
    console.log('\n🧹 Running duplicate cleanup:');
    const result = await window.cleanupDuplicatePeriods();
    console.log('Cleanup result:', result);
  }
  
  // Check React component state if available
  if (window.React && window.React.version) {
    console.log(`\n⚛️ React version: ${window.React.version}`);
  }
  
  // Check Supabase connection
  try {
    const { createClient } = await import('/src/utils/supabase.js');
    const supabase = createClient();
    
    console.log('\n🔍 Checking database periods directly:');
    const { data, error } = await supabase.rpc('get_periods');
    
    if (error) {
      console.error('Database error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No periods found in database');
      return;
    }
    
    console.log(`Found ${data.length} periods in database:`);
    data.forEach((period, index) => {
      console.log(`${index}: ${period.label} | ${period.start_date} to ${period.end_date} | ID: ${period.id}`);
    });
    
    // Check for duplicate date ranges
    const dateRangeSeen = new Map();
    const labelSeen = new Map();
    let duplicatesByDateRange = [];
    let duplicatesByLabel = [];
    
    data.forEach((period, index) => {
      const dateKey = `${period.start_date}-${period.end_date}`;
      const label = period.label;
      
      // Check for duplicate date ranges
      if (dateRangeSeen.has(dateKey)) {
        duplicatesByDateRange.push({
          current: period,
          previous: dateRangeSeen.get(dateKey),
          index: index
        });
      } else {
        dateRangeSeen.set(dateKey, period);
      }
      
      // Check for duplicate labels
      if (labelSeen.has(label)) {
        duplicatesByLabel.push({
          current: period,
          previous: labelSeen.get(label),
          index: index
        });
      } else {
        labelSeen.set(label, period);
      }
    });
    
    if (duplicatesByDateRange.length > 0) {
      console.log('\n❌ Found duplicate date ranges:');
      duplicatesByDateRange.forEach(dup => {
        console.log(`  Duplicate: "${dup.current.label}" (ID: ${dup.current.id}) has same dates as "${dup.previous.label}" (ID: ${dup.previous.id})`);
      });
    } else {
      console.log('\n✅ No duplicate date ranges found in database');
    }
    
    if (duplicatesByLabel.length > 0) {
      console.log('\n⚠️ Found duplicate labels:');
      duplicatesByLabel.forEach(dup => {
        console.log(`  Duplicate label: "${dup.current.label}" appears for both:`);
        console.log(`    - ID ${dup.previous.id}: ${dup.previous.start_date} to ${dup.previous.end_date}`);
        console.log(`    - ID ${dup.current.id}: ${dup.current.start_date} to ${dup.current.end_date}`);
      });
    } else {
      console.log('\n✅ No duplicate labels found in database');
    }
    
    // Check for year boundary issues
    console.log('\n📊 Year analysis:');
    const yearGroups = {};
    data.forEach(period => {
      const startYear = new Date(period.start_date).getFullYear();
      const endYear = new Date(period.end_date).getFullYear();
      
      if (!yearGroups[startYear]) yearGroups[startYear] = [];
      yearGroups[startYear].push(period);
      
      if (startYear !== endYear) {
        console.log(`⚠️ Period "${period.label}" spans years: ${startYear} to ${endYear}`);
      }
    });
    
    Object.keys(yearGroups).sort().forEach(year => {
      console.log(`${year}: ${yearGroups[year].length} periods`);
    });
    
  } catch (error) {
    console.error('Failed to check database:', error);
  }
  
  console.log('\n🔍 Period debugging complete');
};

// Export for use
if (typeof window !== 'undefined') {
  window.debugPeriods = debugPeriods;
  console.log('📝 Debug function available as window.debugPeriods()');
}

// Auto-run if in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  setTimeout(() => {
    console.log('🚀 Auto-running period debug in 2 seconds...');
    debugPeriods();
  }, 2000);
}

export default debugPeriods;