// @ts-nocheck
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';
import './test-helpers';

// ----------------------------------------------------------------------------
// Setup helpers
// ----------------------------------------------------------------------------

const EXAMPLES_DIR = path.resolve(process.cwd(), 'yaml-config-examples');

const exampleFiles = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => path.join(EXAMPLES_DIR, f));

let hass: any;

test.beforeAll(async () => {
  // We pass an *empty* string here because our test-helpers monkey-patch
  // already writes a minimal configuration (frontend, http, plus a template
  // light called kitchen_sink_light). Keeping this blank avoids duplicate YAML
  // keys like `light:`.

  hass = await HomeAssistant.create('', {
    browser: new PlaywrightBrowser('chromium'),
  });

  const distPath = path.resolve(process.cwd(), 'dist/lovelace-lcars-card.js');
  await hass.addResource(distPath, 'module');
});

test.afterAll(async () => {
  if (hass) await hass.close();
});

// ----------------------------------------------------------------------------
// Utility – YAML inspection for interactive metadata
// ----------------------------------------------------------------------------

type ButtonMeta = {
  fullId: string; // group_id.element_id
  targetElementRefs: string[]; // derived from actions
};

function analyseYamlForInteractions(yamlObj: any): ButtonMeta[] {
  const buttons: ButtonMeta[] = [];

  if (!yamlObj?.groups) return buttons;

  for (const group of yamlObj.groups) {
    const groupId = group.group_id;
    if (!group.elements) continue;

    for (const el of group.elements) {
      if (el?.button?.enabled) {
        const fullId = `${groupId}.${el.id}`;
        const targetRefs: string[] = [];

        const actionContainers = [] as any[];
        if (el.button.actions?.tap) actionContainers.push(el.button.actions.tap);
        if (el.button.actions?.hold) actionContainers.push(el.button.actions.hold);
        if (el.button.actions?.double_tap) actionContainers.push(el.button.actions.double_tap);

        actionContainers.flat().forEach((action: any) => {
          if (typeof action !== 'object') return;
          const unified = Array.isArray(action) ? action : [action];
          unified.forEach((a) => {
            if (a.target_element_ref) targetRefs.push(a.target_element_ref);
          });
        });

        buttons.push({ fullId, targetElementRefs: targetRefs });
      }
    }
  }

  return buttons;
}

// ----------------------------------------------------------------------------
// Dynamic per-yaml tests
// ----------------------------------------------------------------------------

for (const filePath of exampleFiles) {
  const fileName = path.basename(filePath); // e.g. 3-dynamic-color.yaml
  const baseName = path.parse(fileName).name; // e.g. 3-dynamic-color

  test.describe(`${baseName}`, () => {
    test(`baseline & interactions`, async ({ page }) => {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const configObj = yaml.load(raw);

      // Set initial brightness to 0 for a consistent starting state.
      await hass.callService('input_number', 'set_value', {
        entity_id: 'input_number.kitchen_sink_brightness',
        value: 0,
      });

      // Use dark colour-scheme so screenshots have consistent dark background.
      const dashboard = await hass.Dashboard([configObj]);
      const url = await dashboard.link();

      await page.goto(url, { timeout: 60_000 });

      const card = page.locator('lovelace-lcars-card').first();
      await card.locator('svg').waitFor();

      // Give the card a brief moment to perform its second-pass layout after
      // the Antonio font resolves (see waitForFonts logic in card implementation).
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);

      // Baseline screenshot
      await expect(card).toHaveScreenshot(`${baseName}-initial.png`);

      // Analyse YAML for interactive buttons
      const buttons = analyseYamlForInteractions(configObj);

      for (const button of buttons) {
        const shapeSelector = `path[id="${button.fullId}__shape"]`;
        const btn = card.locator(shapeSelector);

        // If button shape not in DOM, skip this interaction
        try {
          await btn.waitFor({ state: 'attached', timeout: 5000 });
        } catch {
          continue;
        }

        // --- Test Hover State ---
        await btn.hover();
        await page.waitForTimeout(125);
        await expect(card).toHaveScreenshot(`${baseName}-${button.fullId}-hover.png`);

        // --- Test Active State ---
        const box = await btn.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(125);
          await expect(card).toHaveScreenshot(`${baseName}-${button.fullId}-active.png`);
          await page.mouse.up();
        }

        // --- Test Click Action & Post-Click State ---
        await btn.click();
        // Allow state/animation propagation to settle and entity changes to propagate through HASS.
        await page.waitForTimeout(1500);
        await expect(card).toHaveScreenshot(`${baseName}-${button.fullId}-post-click-on.png`);

        // --- Test Second Click Action & Final State ---
        await btn.click();
        await page.waitForTimeout(1500);
        await expect(card).toHaveScreenshot(`${baseName}-${button.fullId}-post-click-off.png`);
      }
    });
  });
} 