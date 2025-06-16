// @ts-nocheck
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';

// Directory containing YAML example configs
const EXAMPLES_DIR = path.resolve(process.cwd(), 'yaml-config-examples');

// Collect YAML files once at import time
const exampleFiles = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((file) => file.endsWith('.yaml'))
  .map((file) => path.join(EXAMPLES_DIR, file));

// Spin up a single Home Assistant instance for this suite
let hass: any;

test.beforeAll(async () => {
  hass = await HomeAssistant.create('', {
    browser: new PlaywrightBrowser('chromium'),
  });

  // Register the dist file path of our card so dashboards can load it
  const distPath = path.resolve(process.cwd(), 'dist/lovelace-lcars-card.js');
  await hass.addResource(distPath, 'module');
});

test.afterAll(async () => {
  if (hass) await hass.close();
});

// Dynamically generate one test per example file
for (const filePath of exampleFiles) {
  const fileName = path.basename(filePath);

  test(`config example – ${fileName} renders`, async ({ page }) => {
    // Parse YAML
    const raw = fs.readFileSync(filePath, 'utf-8');
    const configObj = yaml.load(raw);

    // Create a fresh one-card dashboard for this config
    const dashboard = await hass.Dashboard([configObj]);
    const url = await dashboard.link();

    await page.goto(url, { timeout: 60_000 });

    const card = page.locator('lovelace-lcars-card').first();
    await card.locator('svg').waitFor();

    await expect(card).toHaveScreenshot(`example-${fileName}.png`, { threshold: 0.2 });
  });
} 