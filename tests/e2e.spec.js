import { test, expect } from '@playwright/test';
test('le site Vélib affiche le dernier trajet', async ({ page }) => {
  const localStorageData = {
    stations: [
      { number: '1021', name: 'Halles - Bourdonnais' },
      { number: '1020', name: 'Lavandieres Sainte Opportune - Rivoli' },
    ],
  };


  await page.addInitScript((value) => {
    window.localStorage.setItem('velib', value);
  }, JSON.stringify(localStorageData));

  await page.goto('/velib', {
    waitUntil: 'domcontentloaded',
  });

  //await page.waitForTimeout(5000);

  await expect(
    page.locator('.bike-item')
      .getByText('Dernier trajetXX', { exact: true })
      .first()
  ).toBeVisible({ timeout: 10000 });
});