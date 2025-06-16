import { defineConfig, devices } from '@playwright/test';

// Base URL of Home Assistant instance. Override in env.
const haUrl = process.env.HA_URL || 'http://192.168.0.70:8123';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
    },
  },
  use: {
    // Tests set their own target URLs (either dev server or Hass Taste Test links).
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}); 