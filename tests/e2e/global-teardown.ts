// Testing Strategy Implementation: Playwright Global Teardown
// Cleans up testing environment after E2E staff management workflow tests

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test environment cleanup...');

  // Launch browser for cleanup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Clean up any test data created during tests
    console.log('📋 Cleaning up test data...');

    await page.goto('http://localhost:3000');

    // Check if app is still accessible
    try {
      await page.click('[data-testid="staff-management-button"]', { timeout: 5000 });

      // Remove any test staff members that might have been created
      const testStaffElements = await page.locator('[data-testid="staff-list"] >> text=/Test|E2E|Performance|Race|Collaboration/').count();

      if (testStaffElements > 0) {
        console.log(`🗑️ Found ${testStaffElements} test staff members to clean up`);

        // Remove test staff members
        for (let i = 0; i < testStaffElements; i++) {
          try {
            const testStaffElement = page.locator('[data-testid="staff-list"] >> text=/Test|E2E|Performance|Race|Collaboration/').first();
            await testStaffElement.click();
            await page.click('[data-testid="delete-button"]');

            // Handle confirmation dialog if present
            page.on('dialog', async dialog => {
              await dialog.accept();
            });

            await page.waitForTimeout(500); // Brief wait between deletions
          } catch (error) {
            console.log(`⚠️ Could not clean up test staff member ${i + 1}:`, error);
          }
        }
      }

      console.log('✅ Test data cleanup completed');

    } catch (error) {
      console.log('ℹ️ App not accessible for cleanup (this is normal if servers were stopped)');
    }

    // Log test completion statistics
    console.log('📊 E2E Test Summary:');
    console.log('- Staff management workflow tests completed');
    console.log('- Real-time synchronization tests completed');
    console.log('- Race condition elimination tests completed');
    console.log('- Performance validation tests completed');
    console.log('- Multi-user collaboration tests completed');

    console.log('🎯 E2E test environment cleanup completed successfully');

  } catch (error) {
    console.error('❌ E2E test environment cleanup failed:', error);
    // Don't throw error during cleanup - just log it
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalTeardown;