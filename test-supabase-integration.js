/**
 * Test script to debug Supabase integration
 * Run with: node test-supabase-integration.js
 */

const { configService } = require('./src/services/ConfigurationService.js');
const { supabase } = require('./src/utils/supabase.js');

async function testSupabaseIntegration() {
  console.log("🔍 Testing Supabase Integration...\n");

  try {
    // 1. Test basic Supabase connection
    console.log("1️⃣ Testing basic Supabase connection...");
    const { data: testConnection, error: connectionError } = await supabase
      .from('restaurants')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.error("❌ Supabase connection failed:", connectionError.message);
      return;
    }
    console.log("✅ Supabase connection successful");

    // 2. Check if tables exist
    console.log("\n2️⃣ Checking if required tables exist...");
    const requiredTables = [
      'restaurants',
      'config_versions', 
      'staff_groups',
      'daily_limits',
      'monthly_limits',
      'priority_rules',
      'ml_model_configs'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table '${table}' - Error: ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}' - Error: ${err.message}`);
      }
    }

    // 3. Test ConfigurationService initialization
    console.log("\n3️⃣ Testing ConfigurationService initialization...");
    
    // Wait a moment for async initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const syncStatus = configService.getSyncStatus();
    console.log("Sync Status:", JSON.stringify(syncStatus, null, 2));

    // 4. Test saving settings
    console.log("\n4️⃣ Testing settings save...");
    const testSettings = {
      staffGroups: [
        {
          id: "test-group-1",
          name: "Test Group 1",
          description: "Test group for debugging",
          color: "#FF0000",
          members: ["Test Staff 1", "Test Staff 2"]
        }
      ]
    };

    const saveResult = await configService.saveSettings(testSettings);
    console.log("Save result:", saveResult);

    // 5. Check what's in the database after save
    console.log("\n5️⃣ Checking database contents after save...");
    
    // Check restaurants table
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*');
    console.log("Restaurants in DB:", restaurants?.length || 0);

    // Check config_versions table
    const { data: configVersions } = await supabase
      .from('config_versions')
      .select('*');
    console.log("Config versions in DB:", configVersions?.length || 0);

    // Check staff_groups table
    const { data: staffGroups } = await supabase
      .from('staff_groups')
      .select('*');
    console.log("Staff groups in DB:", staffGroups?.length || 0);

    if (staffGroups && staffGroups.length > 0) {
      console.log("Staff groups data:", JSON.stringify(staffGroups, null, 2));
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testSupabaseIntegration();