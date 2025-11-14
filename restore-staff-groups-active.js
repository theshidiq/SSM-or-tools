/**
 * Restore Staff Groups - Set is_active to true
 *
 * This script updates all staff groups in the database to set is_active = true
 * Use this when groups exist but are soft-deleted (is_active = false)
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreStaffGroups() {
  try {
    console.log('🔍 Checking staff groups...\n');

    // Get all staff groups (including soft-deleted)
    const { data: allGroups, error: fetchError } = await supabase
      .from('staff_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Found ${allGroups.length} total staff groups in database\n`);

    // Separate active and inactive groups
    const inactiveGroups = allGroups.filter(g => g.is_active === false || g.is_active === null);
    const activeGroups = allGroups.filter(g => g.is_active === true);

    console.log(`✅ Active groups: ${activeGroups.length}`);
    activeGroups.forEach(g => {
      console.log(`   - ${g.name} (${g.id})`);
    });
    console.log();

    console.log(`❌ Inactive groups: ${inactiveGroups.length}`);
    inactiveGroups.forEach(g => {
      console.log(`   - ${g.name} (${g.id}) - is_active: ${g.is_active}`);
    });
    console.log();

    if (inactiveGroups.length === 0) {
      console.log('✅ All groups are already active!');
      return;
    }

    // Restore inactive groups
    console.log(`🔄 Restoring ${inactiveGroups.length} inactive groups...\n`);

    for (const group of inactiveGroups) {
      console.log(`   Restoring: ${group.name} (${group.id})`);

      const { error: updateError } = await supabase
        .from('staff_groups')
        .update({ is_active: true })
        .eq('id', group.id);

      if (updateError) {
        console.error(`   ❌ Failed to restore ${group.name}:`, updateError.message);
      } else {
        console.log(`   ✅ Restored ${group.name}`);
      }
    }

    console.log('\n🎉 Restoration complete!\n');

    // Verify restoration
    const { data: verifyGroups, error: verifyError } = await supabase
      .from('staff_groups')
      .select('*')
      .eq('is_active', true);

    if (verifyError) {
      throw verifyError;
    }

    console.log(`✅ Verification: ${verifyGroups.length} active groups in database`);
    verifyGroups.forEach(g => {
      console.log(`   - ${g.name} (${g.id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Run the script
console.log('🚀 Staff Groups Restoration Script\n');
console.log('===================================\n');
restoreStaffGroups()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh your browser');
    console.log('   2. Navigate to Settings → Staff Groups');
    console.log('   3. Your groups should now be visible');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
