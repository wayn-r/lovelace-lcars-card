// @ts-nocheck
import { test, expect } from '@playwright/test';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';
import path from 'path';

// Spin-up an isolated Home Assistant instance for this entire test file.
// Doing this in `beforeAll` avoids repeated start-ups when the file is run in workers.

test.describe('LCARS card inside isolated Home Assistant (hass-taste-test)', () => {
  let hass: any; // `HomeAssistant` instance
  let dashboardUrl: string;

  test.beforeAll(async () => {
    // Create the HA instance.  Use PlaywrightBrowser so hass-taste-test has a browser
    // to drive when it builds dashboards – this is separate from the Playwright test runner.
    hass = await HomeAssistant.create('', {
      browser: new PlaywrightBrowser('chromium'),
    });

    // Register our card's module so Lovelace can load it.
    const distPath = path.resolve(process.cwd(), 'dist/lovelace-lcars-card.js');
    await hass.addResource(distPath, 'module');

    // Minimal card config – we just need *something* valid so the custom element renders.
    const cardConfig = {
      type: 'custom:lovelace-lcars-card',
      groups: [
        {
          group_id: 'test_group',
          elements: [],
        },
      ],
    };

    const dashboard = await hass.Dashboard([cardConfig]);
    dashboardUrl = await dashboard.link();
  }, 120_000); // Allow plenty of time for HA to download & initialise

  test.afterAll(async () => {
    await hass.close();
  });

  test('card renders and reacts', async ({ page }) => {
    await page.goto(dashboardUrl, { timeout: 60_000 });

    const card = page.locator('lovelace-lcars-card');
    await card.locator('svg').waitFor();

    await expect(card).toHaveScreenshot('hass-lcars-initial.png');

    // Try hovering a generic shape inside the card just to exercise interactive colours.
    const rect = card.locator('svg path').first();
    if (await rect.count()) {
      await rect.hover();
      await expect(card).toHaveScreenshot('hass-lcars-hover.png');
    }
  });
}); 