import { defineConfig, devices } from '@playwright/test';

// Base URL of Home Assistant instance. Override in env.
const haUrl = process.env.HA_URL || 'http://192.168.0.70:8123';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  reporter: [
    ['dot'], // Minimal output - just dots for progress and final results
  ],
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.025,
    },
  },
  use: {
    // Tests set their own target URLs (either dev server or Hass Taste Test links).
    headless: true,
    trace: 'retain-on-failure',
    video: 'on',
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: ['--window-size=1920,1080'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}); 