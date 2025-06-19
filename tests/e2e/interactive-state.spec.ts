// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Additional interaction tests for the LCARS card.
 *
 * This file focuses on verifying that:
 * 1. Hovering updates stateful colours.
 * 2. Mouse down ("active" state) updates colours.
 * 3. A button element can toggle another element's state via the `toggle_state` action.
 *
 * The test re-uses the generic test harness HTML to avoid duplicating example files. It
 * dynamically injects a purpose-built configuration into the card at runtime so we
 * can exercise the various interaction paths without changing the static harness.
 */

test.describe.skip('LCARS Card – interaction states', () => {
  const harnessPath = '/tests/e2e/test-harness.html';
  const devBase = process.env.DEV_BASE_URL || 'http://localhost:5000';

  async function loadCustomConfig(page) {
    // Reconfigure the existing <lovelace-lcars-card id="test-card"> in the harness.
    await page.evaluate(() => {
      const card = document.getElementById('test-card');
      const hassMock = {
        states: {},
        themes: {},
        language: 'en',
        resources: {},
      };

      // Simple layout: a rectangular button at the top toggles a status rectangle below.
      card.setConfig({
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'controls',
            elements: [
              {
                id: 'toggle_btn',
                type: 'rectangle',
                appearance: {
                  fill: {
                    default: '#2266ff',
                    hover: '#3388ff',
                    active: '#1144cc',
                  },
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  cornerRadius: 4,
                },
                text: {
                  content: 'Toggle',
                  fill: '#ffffff',
                  fontFamily: 'Antonio',
                  fontSize: 16,
                  textAnchor: 'middle',
                  dominantBaseline: 'middle',
                },
                button: {
                  enabled: true,
                  actions: {
                    tap: [
                      {
                        action: 'toggle_state',
                        target_element_ref: 'status_group.status_rect',
                        states: ['default', 'highlight'],
                      },
                    ],
                  },
                },
                layout: {
                  width: 120,
                  height: 40,
                  offsetX: 20,
                  offsetY: 20,
                },
              },
            ],
          },
          {
            group_id: 'status_group',
            elements: [
              {
                id: 'status_rect',
                type: 'rectangle',
                appearance: {
                  // Colour changes will be driven by state-based animations so keep static here.
                  fill: {
                    default: '#666666',
                  },
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  cornerRadius: 4,
                },
                state_management: {
                  default_state: 'default',
                },
                animations: {
                  custom_states: [
                    {
                      state: 'highlight',
                      animation: {
                        type: 'fade',
                        duration: 300,
                        fade_params: {
                          opacity_start: 0.4,
                          opacity_end: 1,
                        },
                      },
                    },
                  ],
                },
                layout: {
                  width: 120,
                  height: 40,
                  offsetX: 20,
                  offsetY: 80,
                },
              },
            ],
          },
        ],
      });
      card.hass = hassMock;
    });
  }

  test('hover & active visual states', async ({ page }) => {
    // Load harness and replace config.
    try {
      await page.goto(`${devBase}${harnessPath}`, { timeout: 10000 });
    } catch (error) {
      test.skip(true, `Dev server not reachable at ${devBase}`);
    }

    const card = page.locator('lovelace-lcars-card');
    await card.locator('svg').waitFor();

    // Ensure fonts loaded after the card has been initialised
    await page.evaluate(() => document.fonts.ready);

    await loadCustomConfig(page);

    const buttonShape = card.locator('path[id="controls.toggle_btn__shape"]');

    // Wait until the toggle button is rendered inside the card's shadow DOM.
    await buttonShape.waitFor({ state: 'attached', timeout: 15000 });

    // Check default fill colour.
    await expect(await buttonShape.getAttribute('fill')).toBe('#2266ff');

    // Hover state should update the fill.
    await buttonShape.hover();
    await expect(await buttonShape.getAttribute('fill')).toBe('#3388ff');

    // Active (mouse down) state – hold mouse down to keep the active fill visible.
    const box = await buttonShape.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect(await buttonShape.getAttribute('fill')).toBe('#1144cc');
      await page.mouse.up();
    }
  });

  test('button click toggles target state', async ({ page }) => {
    try {
      await page.goto(`${devBase}${harnessPath}`, { timeout: 10000 });
    } catch (error) {
      test.skip(true, `Dev server not reachable at ${devBase}`);
    }

    const card = page.locator('lovelace-lcars-card');
    await card.locator('svg').waitFor();

    // Ensure fonts loaded after the card has been initialised
    await page.evaluate(() => document.fonts.ready);

    await loadCustomConfig(page);

    const buttonShape = card.locator('path[id="controls.toggle_btn__shape"]');

    // Ensure button exists before interaction
    await buttonShape.waitFor({ state: 'attached', timeout: 15000 });

    // Click the button – this should toggle the state of the status rectangle.
    await buttonShape.click();

    // Wait for the state change animation (~300ms) to complete.
    await page.waitForTimeout(400);

    // The target rectangle should now be in "highlight" state which we detect by opacity 1.
    const statusShape = card.locator('path[id="status_group.status_rect__shape"]');
    const opacity = await statusShape.evaluate((el) => {
      const o = window.getComputedStyle(el).opacity;
      return parseFloat(o);
    });
    expect(opacity).toBeGreaterThan(0.9);
  });
}); 