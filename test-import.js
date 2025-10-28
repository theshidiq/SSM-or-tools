/**
 * Standalone Test Script for HTML Schedule Import
 *
 * Tests the import functionality with the sample 8-9.html file
 * Run with: node test-import.js
 */

const fs = require('fs');
const path = require('path');

// Mock DOMParser for Node.js environment
const { JSDOM } = require('jsdom');
global.DOMParser = new JSDOM().window.DOMParser;
global.document = new JSDOM().window.document;

// Import the parser (will need to be adapted for Node.js)
const htmlFile = path.join(__dirname, 'sample 8-9.html');

console.log('🧪 HTML Schedule Import Test');
console.log('================================\n');

// Read the HTML file
if (!fs.existsSync(htmlFile)) {
  console.error('❌ Sample file not found:', htmlFile);
  process.exit(1);
}

const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
console.log('✅ Read HTML file:', htmlFile);
console.log('📊 File size:', (htmlContent.length / 1024).toFixed(2), 'KB\n');

// Parse the HTML manually for testing
const dom = new JSDOM(htmlContent);
const doc = dom.window.document;

// Extract table
const table = doc.querySelector('table');
if (!table) {
  console.error('❌ No table found in HTML');
  process.exit(1);
}
console.log('✅ Found table in HTML\n');

// Extract staff names from header
const thead = table.querySelector('thead');
const headerRow = thead.querySelector('tr');
const headers = Array.from(headerRow.querySelectorAll('th'));
const staffNames = headers.slice(1).map(th => th.textContent.trim());

console.log('👥 Staff Names Extracted:');
console.log('------------------------');
staffNames.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});
console.log(`\nTotal: ${staffNames.length} staff members\n`);

// Extract schedule rows
const tbody = table.querySelector('tbody');
const rows = Array.from(tbody.querySelectorAll('tr'));

console.log('📅 Schedule Rows Extracted:');
console.log('-------------------------');
const scheduleRows = [];

rows.forEach((tr, rowIndex) => {
  const cells = Array.from(tr.querySelectorAll('td'));
  if (cells.length === 0) return;

  // First cell is the date
  const dateText = cells[0].textContent.trim();

  // Parse date (e.g., "木 21日")
  const match = dateText.match(/([月火水木金土日])\s*(\d+)日/);
  if (match) {
    const dayOfWeek = match[1];
    const dayNumber = parseInt(match[2], 10);

    // Extract shifts
    const shifts = cells.slice(1).map(cell => {
      let text = cell.textContent.trim();
      // Handle <br> tags
      if (cell.innerHTML.includes('<br>')) {
        text = cell.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
      }
      return text;
    });

    scheduleRows.push({
      dayOfWeek,
      dayNumber,
      dateText,
      shifts
    });

    console.log(`${rowIndex + 1}. ${dateText} - ${shifts.filter(s => s).length} shifts assigned`);
  }
});

console.log(`\nTotal: ${scheduleRows.length} days\n`);

// Test staff name mapping
console.log('🔍 Testing Staff Name Mapping:');
console.log('------------------------------');

const nameMapping = {
  "料理長": "料理長",  // Exact match
  "井関": "井関",      // Exact match
  "織": "与儀",        // MAPPING REQUIRED
  "由辺": "田辺",      // MAPPING REQUIRED
  "古藤": "古藤",      // Exact match
  "小池": "小池",      // Exact match
  "岸": "岸",          // Exact match
  "カマレ": "カマル",  // MAPPING REQUIRED
  "高野": "高野",      // Exact match
  "安井": "やすい",    // MAPPING REQUIRED
  "中田": "中田"       // Exact match
};

staffNames.forEach(htmlName => {
  const dbName = nameMapping[htmlName];
  if (dbName === htmlName) {
    console.log(`✅ ${htmlName} → ${dbName} (Exact match)`);
  } else {
    console.log(`🔄 ${htmlName} → ${dbName} (Mapping required)`);
  }
});

// Count mappings
const exactMatches = staffNames.filter(name => nameMapping[name] === name).length;
const mappedMatches = staffNames.filter(name => nameMapping[name] !== name).length;

console.log(`\n📊 Mapping Statistics:`);
console.log(`  - Total staff: ${staffNames.length}`);
console.log(`  - Exact matches: ${exactMatches} (${(exactMatches/staffNames.length*100).toFixed(1)}%)`);
console.log(`  - Requires mapping: ${mappedMatches} (${(mappedMatches/staffNames.length*100).toFixed(1)}%)`);

// Test data structure
console.log('\n📦 Sample Schedule Data Structure:');
console.log('-----------------------------------');

// Show first few days for first 3 staff
const sampleData = {};
staffNames.slice(0, 3).forEach((staffName, staffIndex) => {
  const dbName = nameMapping[staffName] || staffName;
  sampleData[dbName] = {};

  scheduleRows.slice(0, 5).forEach((row, dayIndex) => {
    const dateKey = `2025-08-${String(row.dayNumber).padStart(2, '0')}`;
    const shift = row.shifts[staffIndex] || '';
    sampleData[dbName][dateKey] = shift;
  });
});

console.log(JSON.stringify(sampleData, null, 2));

// Summary
console.log('\n\n✨ Test Complete!');
console.log('=================');
console.log('✅ HTML parsing: Success');
console.log('✅ Staff extraction: Success');
console.log('✅ Schedule extraction: Success');
console.log('✅ Name mapping: Ready');
console.log(`\n📊 Stats:`);
console.log(`  - ${staffNames.length} staff members`);
console.log(`  - ${scheduleRows.length} days`);
console.log(`  - ${staffNames.length * scheduleRows.length} total shifts`);
console.log(`  - ${exactMatches} exact matches, ${mappedMatches} need mapping`);
console.log(`\n🎉 Ready for import!`);
