import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 30_000,

  use: {
    baseURL: 'https://florianlatapie.github.io/',
    trace: 'retain-on-failure',
    screenshot: 'on',
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