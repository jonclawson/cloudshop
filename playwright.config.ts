// @ts-nocheck
import { defineConfig, devices } from '@playwright/test';
import os from 'os';

const darwinMajor = Number(os.release().split('.')[0]);
// Playwright webkit is not supported on macOS 12 (Darwin 21) per installation/runtime errors.
// Skip the webkit project on that platform so tests don't fail.
const includeWebkit = darwinMajor !== 21;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    // Save screenshots only when a test fails (includes retries too).
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    ...(includeWebkit
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
