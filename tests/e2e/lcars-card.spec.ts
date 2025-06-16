// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * E2E visual regression & interaction tests for the LCARS card.
 *
 * IMPORTANT:
 *   1. Ensure the Vite dev server is running (`npm run dev`) **before** executing these tests.
 *   2. Baseline screenshots are stored alongside the test after the first successful run.
 *      Commit them so future CI runs can detect visual regressions.
 */

test.describe('LCARS Card – visual & interaction', () => {
  const harnessPath = '/tests/e2e/test-harness.html';
  const devBase = process.env.DEV_BASE_URL || 'http://localhost:5000';

  test('renders initial state', async ({ page }) => {
    try {
      await page.goto(`${devBase}${harnessPath}`, { timeout: 10000 });
    } catch (error) {
      test.skip(true, `Dev server not reachable at ${devBase}`);
    }
    const card = page.locator('lovelace-lcars-card');

    // Ensure the SVG content inside the shadow DOM is rendered before taking a screenshot.
    await card.locator('svg').waitFor();

    // Take a full-card screenshot and compare.
    await expect(card).toHaveScreenshot('lcars-card-initial.png');
  });

  test('hovering updates interactive state', async ({ page }) => {
    try {
      await page.goto(`${devBase}${harnessPath}`, { timeout: 10000 });
    } catch (error) {
      test.skip(true, `Dev server not reachable at ${devBase}`);
    }

    // Target the rectangle shape path inside the card's shadow-root.
    const shape = page.locator('lovelace-lcars-card').locator('svg path').first();

    // Ensure the SVG has rendered so the path can exist.
    await page.locator('lovelace-lcars-card').locator('svg').waitFor({ timeout: 10000 });

    // Wait for the shape element to appear inside the shadow DOM.
    await shape.waitFor({ state: 'attached', timeout: 15000 });

    await shape.hover();

    const card = page.locator('lovelace-lcars-card');
    await expect(card).toHaveScreenshot('lcars-card-hover.png');
  });
}); 