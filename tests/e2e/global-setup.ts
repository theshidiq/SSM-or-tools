// Testing Strategy Implementation: Playwright Global Setup
// Prepares testing environment for E2E staff management workflow tests

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test environment setup...');

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for React app to be available
    console.log('📱 Waiting for React app to be ready...');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('body', { timeout: 30000 });
    console.log('✅ React app is ready');

    // Test WebSocket server connectivity
    console.log('🔌 Testing WebSocket server connectivity...');
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8080/staff-sync?period=1');
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve('connected');
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    });
    console.log('✅ WebSocket server is ready');

    // Initialize test data if needed
    console.log('📋 Initializing test data...');

    // Clear any existing test data
    await page.goto('http://localhost:3000');

    // Check if staff management is accessible
    await page.click('[data-testid="staff-management-button"]', { timeout: 10000 });
    console.log('✅ Staff management interface is accessible');

    console.log('🎯 E2E test environment setup completed successfully');

  } catch (error) {
    console.error('❌ E2E test environment setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;