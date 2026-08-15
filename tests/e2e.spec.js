import { test, expect } from '@playwright/test';

test('le site Vélib fonctionne', async ({ page }) => {
  await page.goto('/', {
    waitUntil: 'networkidle',
  });

  await expect(page).toHaveTitle(/Vélib/i);
});