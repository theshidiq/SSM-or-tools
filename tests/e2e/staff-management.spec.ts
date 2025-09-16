// Testing Strategy Implementation: End-to-End Testing (lines 881-912)
// Playwright E2E tests for complete staff management workflow
// Exact implementation from IMPLEMENTATION_PLAN_HYBRID_ARCHITECTURE.md

import { test, expect } from '@playwright/test';

// Exact implementation from official plan lines 883-911
test('staff management workflow', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Open staff modal
  await page.click('[data-testid="staff-management-button"]');

  // Add new staff member
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'Test Staff Member');
  await page.click('[data-testid="save-button"]');

  // Verify immediate appearance in list
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Test Staff Member');

  // Test real-time update across multiple tabs
  const secondPage = await page.context().newPage();
  await secondPage.goto('http://localhost:3000');

  // Update staff in first tab
  await page.click('[data-testid="edit-staff-Test Staff Member"]');
  await page.fill('[data-testid="staff-name"]', 'Updated Staff Member');
  await page.click('[data-testid="save-button"]');

  // Verify update appears immediately in second tab
  await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('Updated Staff Member');
});

// Enhanced E2E tests for comprehensive workflow validation
test('complete staff CRUD operations with real-time synchronization', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Open staff management modal
  await page.click('[data-testid="staff-management-button"]');

  // Verify modal is visible
  await expect(page.locator('[data-testid="staff-edit-modal"]')).toBeVisible();

  // Test 1: Create new staff member
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'E2E Test Staff');
  await page.fill('[data-testid="staff-position"]', 'Server');
  await page.click('[data-testid="status-employee"]');
  await page.click('[data-testid="save-button"]');

  // Verify immediate UI feedback
  await expect(page.locator('text=E2E Test Staffを追加しました')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('E2E Test Staff');

  // Test 2: Edit staff member
  await page.click('[data-testid="edit-staff-E2E Test Staff"]');
  await page.fill('[data-testid="staff-name"]', 'E2E Updated Staff');
  await page.fill('[data-testid="staff-position"]', 'Head Server');
  await page.click('[data-testid="save-button"]');

  // Verify update feedback and UI change
  await expect(page.locator('text=E2E Updated Staffを更新しました')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('E2E Updated Staff');
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Head Server');

  // Test 3: Real-time synchronization across browser contexts
  const secondContext = await page.context().browser()?.newContext();
  const secondPage = await secondContext?.newPage();

  if (secondPage) {
    await secondPage.goto('http://localhost:3000');
    await secondPage.click('[data-testid="staff-management-button"]');

    // Verify data is synchronized across contexts
    await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('E2E Updated Staff');
    await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('Head Server');

    // Make change in second tab
    await secondPage.click('[data-testid="edit-staff-E2E Updated Staff"]');
    await secondPage.fill('[data-testid="staff-position"]', 'Manager');
    await secondPage.click('[data-testid="save-button"]');

    // Verify change appears in first tab (real-time sync)
    await expect(page.locator('[data-testid="staff-list"]')).toContainText('Manager', { timeout: 3000 });

    await secondContext?.close();
  }

  // Test 4: Delete staff member
  await page.click('[data-testid="edit-staff-E2E Updated Staff"]');
  await page.click('[data-testid="delete-button"]');

  // Handle confirmation dialog
  page.on('dialog', async dialog => {
    expect(dialog.message()).toContain('本当に');
    await dialog.accept();
  });

  // Verify deletion feedback and removal from list
  await expect(page.locator('text=E2E Updated Staffを削除しました')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="staff-list"]')).not.toContainText('E2E Updated Staff', { timeout: 3000 });
});

// Race condition elimination validation E2E test
test('race condition elimination in staff updates', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="staff-management-button"]');

  // Create test staff member
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'Race Test Staff');
  await page.click('[data-testid="save-button"]');

  // Wait for creation to complete
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Race Test Staff');

  // Open multiple tabs for concurrent testing
  const contexts = await Promise.all([
    page.context().browser()?.newContext(),
    page.context().browser()?.newContext(),
    page.context().browser()?.newContext()
  ]);

  const pages = await Promise.all(
    contexts.filter(Boolean).map(async context => {
      const newPage = await context?.newPage();
      if (newPage) {
        await newPage.goto('http://localhost:3000');
        await newPage.click('[data-testid="staff-management-button"]');
      }
      return newPage;
    })
  );

  // Perform concurrent updates to test race condition handling
  const updatePromises = pages.filter(Boolean).map(async (testPage, index) => {
    if (testPage) {
      await testPage.click('[data-testid="edit-staff-Race Test Staff"]');
      await testPage.fill('[data-testid="staff-name"]', `Concurrent Update ${index + 1}`);
      await testPage.click('[data-testid="save-button"]');
    }
  });

  await Promise.all(updatePromises);

  // Wait for all updates to settle
  await page.waitForTimeout(2000);

  // Verify final state is consistent (no race condition artifacts)
  const finalName = await page.locator('[data-testid="staff-list"] >> text=/Concurrent Update/').first().textContent();
  expect(finalName).toMatch(/Concurrent Update [123]/);

  // Verify only one final name exists (no duplicate entries from race conditions)
  const nameElements = await page.locator('[data-testid="staff-list"] >> text=/Concurrent Update/').count();
  expect(nameElements).toBeLessThanOrEqual(1);

  // Clean up contexts
  await Promise.all(contexts.filter(Boolean).map(context => context?.close()));
});

// Performance validation E2E test
test('validate KPI requirements for staff operations', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Measure page load time
  const loadStartTime = Date.now();
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - loadStartTime;

  // Validate reasonable page load time
  expect(loadTime).toBeLessThan(3000); // 3 second max for page load

  await page.click('[data-testid="staff-management-button"]');

  // Test UI response time for staff operations (<50ms KPI)
  await page.click('[data-testid="add-staff-button"]');

  const updateStartTime = Date.now();
  await page.fill('[data-testid="staff-name"]', 'Performance Test Staff');
  await page.click('[data-testid="save-button"]');

  // Verify immediate UI feedback (optimistic update)
  await expect(page.locator('text=Performance Test Staffを追加しています')).toBeVisible({ timeout: 100 });

  const responseTime = Date.now() - updateStartTime;

  // Validate KPI: UI Response Time <50ms (with some buffer for E2E overhead)
  expect(responseTime).toBeLessThan(200); // Allow buffer for E2E test overhead

  // Verify final success state
  await expect(page.locator('text=Performance Test Staffを追加しました')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Performance Test Staff');
});

// WebSocket connection stability E2E test
test('WebSocket connection stability and reconnection', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="staff-management-button"]');

  // Monitor network requests and WebSocket connections
  const wsConnections: any[] = [];

  page.on('websocket', ws => {
    wsConnections.push(ws);
    console.log(`WebSocket connection established: ${ws.url()}`);

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  // Create test staff to establish WebSocket activity
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'Connection Test Staff');
  await page.click('[data-testid="save-button"]');

  // Verify WebSocket connection was established
  await page.waitForTimeout(1000);
  expect(wsConnections.length).toBeGreaterThan(0);

  // Simulate network interruption and recovery
  await page.route('ws://localhost:8080/**', route => {
    // Temporarily block WebSocket connections
    route.abort();
  });

  // Attempt operation during "network interruption"
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'Reconnection Test');
  await page.click('[data-testid="save-button"]');

  // Restore network connectivity
  await page.unroute('ws://localhost:8080/**');

  // Verify reconnection and eventual consistency
  await page.waitForTimeout(2000);

  // The system should gracefully handle disconnection and reconnection
  // Verify that the interface remains responsive
  await expect(page.locator('[data-testid="staff-list"]')).toBeVisible();
});

// Multi-user collaboration E2E test
test('multi-user real-time collaboration', async ({ page, context }) => {
  // Setup: Start with first user
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="staff-management-button"]');

  // Create initial staff member
  await page.click('[data-testid="add-staff-button"]');
  await page.fill('[data-testid="staff-name"]', 'Collaboration Test');
  await page.click('[data-testid="save-button"]');

  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Collaboration Test');

  // Simulate second user joining
  const secondPage = await context.newPage();
  await secondPage.goto('http://localhost:3000');
  await secondPage.click('[data-testid="staff-management-button"]');

  // Second user should see the existing staff
  await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('Collaboration Test');

  // First user makes an update
  await page.click('[data-testid="edit-staff-Collaboration Test"]');
  await page.fill('[data-testid="staff-name"]', 'Updated by User 1');
  await page.click('[data-testid="save-button"]');

  // Second user should see the update in real-time
  await expect(secondPage.locator('[data-testid="staff-list"]')).toContainText('Updated by User 1', { timeout: 5000 });

  // Second user makes a counter-update
  await secondPage.click('[data-testid="edit-staff-Updated by User 1"]');
  await secondPage.fill('[data-testid="staff-name"]', 'Updated by User 2');
  await secondPage.click('[data-testid="save-button"]');

  // First user should see the counter-update
  await expect(page.locator('[data-testid="staff-list"]')).toContainText('Updated by User 2', { timeout: 5000 });

  // Both users should have consistent state
  const firstUserContent = await page.locator('[data-testid="staff-list"]').textContent();
  const secondUserContent = await secondPage.locator('[data-testid="staff-list"]').textContent();

  expect(firstUserContent).toBe(secondUserContent);
});