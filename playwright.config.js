import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',

  timeout: 30_000,

  use: {
    baseURL: 'https://florianlatapie.github.io/',
    trace: 'retain-on-failure',
    screenshot: 'on',
    headless: true,
    channel: 'chromium',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/151.0.0.0 Safari/537.36',
  },

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',
    }],
  ],
});