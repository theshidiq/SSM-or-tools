/**
 * Test Priority Rule Validation
 * This script simulates creating a priority rule without staff to verify validation
 */

// Simulate the validation logic from usePriorityRulesData.js
function validatePriorityRule(ruleData) {
  console.log('\n🧪 Testing Priority Rule Validation\n');
  console.log('Input ruleData:', JSON.stringify(ruleData, null, 2));

  // Extract staffIds (same logic as the fix)
  const staffIds = ruleData.staffIds || (ruleData.staffId ? [ruleData.staffId] : []);

  console.log('\n📊 Validation Check:');
  console.log('─'.repeat(60));
  console.log('staffIds:', staffIds);
  console.log('staffIds.length:', staffIds.length);
  console.log('Is array empty?', staffIds.length === 0);

  // Apply validation (same as the fix)
  if (!staffIds || staffIds.length === 0) {
    console.log('\n❌ VALIDATION FAILED');
    console.log('Error: Priority rule must have at least one staff member selected');
    console.log('─'.repeat(60));
    return false;
  }

  console.log('\n✅ VALIDATION PASSED');
  console.log('Rule has', staffIds.length, 'staff member(s)');
  console.log('─'.repeat(60));
  return true;
}

// Test Case 1: Empty staffIds array (should FAIL)
console.log('\n' + '='.repeat(60));
console.log('TEST 1: Rule with empty staffIds array');
console.log('='.repeat(60));
const result1 = validatePriorityRule({
  name: "Test Rule 1",
  staffIds: [], // Empty!
  daysOfWeek: [0, 1, 2],
  ruleType: "preferred_shift"
});

// Test Case 2: Missing staffIds field (should FAIL)
console.log('\n' + '='.repeat(60));
console.log('TEST 2: Rule without staffIds field');
console.log('='.repeat(60));
const result2 = validatePriorityRule({
  name: "Test Rule 2",
  // No staffIds field at all!
  daysOfWeek: [0, 1, 2],
  ruleType: "preferred_shift"
});

// Test Case 3: Legacy single staffId with empty string (should FAIL)
console.log('\n' + '='.repeat(60));
console.log('TEST 3: Rule with empty staffId string');
console.log('='.repeat(60));
const result3 = validatePriorityRule({
  name: "Test Rule 3",
  staffId: "", // Empty string!
  daysOfWeek: [0, 1, 2],
  ruleType: "preferred_shift"
});

// Test Case 4: Valid staffIds array (should PASS)
console.log('\n' + '='.repeat(60));
console.log('TEST 4: Rule with valid staffIds array');
console.log('='.repeat(60));
const result4 = validatePriorityRule({
  name: "Test Rule 4",
  staffIds: ["550e8400-e29b-41d4-a716-446655440000"], // Has UUID!
  daysOfWeek: [0, 1, 2],
  ruleType: "preferred_shift"
});

// Test Case 5: Legacy single staffId with UUID (should PASS)
console.log('\n' + '='.repeat(60));
console.log('TEST 5: Rule with valid legacy staffId');
console.log('='.repeat(60));
const result5 = validatePriorityRule({
  name: "Test Rule 5",
  staffId: "550e8400-e29b-41d4-a716-446655440000", // Has UUID!
  daysOfWeek: [0, 1, 2],
  ruleType: "preferred_shift"
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log('Test 1 (Empty array):', result1 ? '✅ PASS' : '❌ FAIL (Expected)');
console.log('Test 2 (Missing field):', result2 ? '✅ PASS' : '❌ FAIL (Expected)');
console.log('Test 3 (Empty string):', result3 ? '✅ PASS' : '❌ FAIL (Expected)');
console.log('Test 4 (Valid array):', result4 ? '✅ PASS (Expected)' : '❌ FAIL');
console.log('Test 5 (Valid legacy):', result5 ? '✅ PASS (Expected)' : '❌ FAIL');
console.log('='.repeat(60));

console.log('\n📋 CONCLUSION:');
if (!result1 && !result2 && !result3 && result4 && result5) {
  console.log('✅ All tests passed! Validation is working correctly.');
  console.log('   - Empty/missing staff IDs are rejected ✓');
  console.log('   - Valid staff IDs are accepted ✓');
} else {
  console.log('❌ Some tests failed! Check validation logic.');
}
console.log('');
