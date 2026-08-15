import { test, expect } from '@playwright/test';

test('le site Vélib fonctionne', async ({ page }) => {
  const velibData = {
    stations: [
      { number: '1021', name: 'Halles - Bourdonnais' },
      { number: '1020', name: 'Lavandieres Sainte Opportune - Rivoli' },
    ],
  };

  // Injecter le localStorage avant tout chargement de page
  await page.addInitScript((value) => {
    window.localStorage.setItem('velib', value);
  }, JSON.stringify(velibData));

  await page.goto('/velib', {
    waitUntil: 'networkidle',
  });

  await expect(page).toHaveTitle(/VeXXXlib/i);
});