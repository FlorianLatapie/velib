import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 30_000,

  use: {
    baseURL: 'https://florianlatapie.github.io/velib/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    headless: true,
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