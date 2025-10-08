/**
 * Test script to debug delete group flow
 * Run with: node test-delete-flow.js
 */

// Simulate the change detection logic
function testDeleteDetection() {
  const oldSettings = {
    staffGroups: [
      { id: '1', name: 'Test Group', members: [] },
      { id: '2', name: 'New Group', members: ['料理長'] },
      { id: '3', name: 'New Group 1', members: [] }
    ]
  };

  // Simulate deleting group '1' (Test Group)
  const newSettings = {
    staffGroups: [
      { id: '2', name: 'New Group', members: ['料理長'] },
      { id: '3', name: 'New Group 1', members: [] }
    ]
  };

  console.log('OLD SETTINGS:', JSON.stringify(oldSettings, null, 2));
  console.log('NEW SETTINGS:', JSON.stringify(newSettings, null, 2));

  // Detect staff group changes
  if (JSON.stringify(oldSettings.staffGroups) !== JSON.stringify(newSettings.staffGroups)) {
    console.log('✅ Staff groups changed - detecting changes...');

    const oldGroups = oldSettings.staffGroups || [];
    const newGroups = newSettings.staffGroups || [];
    const oldGroupIds = new Set(oldGroups.map(g => g.id));
    const newGroupIds = new Set(newGroups.map(g => g.id));

    console.log('Old group IDs:', Array.from(oldGroupIds));
    console.log('New group IDs:', Array.from(newGroupIds));

    // Detect DELETED groups (exist in old but not in new)
    const deletedGroupIds = [...oldGroupIds].filter(id => !newGroupIds.has(id));
    console.log('Deleted group IDs:', deletedGroupIds);

    if (deletedGroupIds.length > 0) {
      console.log(`✅ ${deletedGroupIds.length} group(s) deleted`);
      deletedGroupIds.forEach(groupId => {
        const deletedGroup = oldGroups.find(g => g.id === groupId);
        console.log(`  - Deleting group "${deletedGroup?.name}" (${groupId})`);
        console.log(`  - Would call: wsDeleteStaffGroup("${groupId}")`);
      });
    } else {
      console.log('❌ No deleted groups detected!');
    }
  } else {
    console.log('❌ No changes detected!');
  }
}

testDeleteDetection();
