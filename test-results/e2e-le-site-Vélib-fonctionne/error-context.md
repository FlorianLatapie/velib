# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.js >> le site Vélib fonctionne
- Location: tests/e2e.spec.js:3:1

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /VeXXXlib/i
Received string:  "Velib"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    14 × locator resolved to <html lang="fr">…</html>
       - unexpected value "Velib"

```

```yaml
- heading "Velib shortcut" [level=1]
- button
- heading "Halles - Bourdonnais" [level=2]
- button "Filtrer les vélos mécaniques" [pressed]:
  - paragraph: Mécanique
  - paragraph: "12"
- button "Filtrer les vélos électriques" [pressed]:
  - paragraph: Électrique
  - paragraph: "3"
- img
- paragraph: Parking
- paragraph: "5"
- paragraph: ⚠️ Erreur réseau
- heading "Lavandieres Sainte Opportune - Rivoli" [level=2]
- button "Filtrer les vélos mécaniques" [pressed]:
  - paragraph: Mécanique
  - paragraph: "13"
- button "Filtrer les vélos électriques" [pressed]:
  - paragraph: Électrique
  - paragraph: "10"
- img
- paragraph: Parking
- paragraph: "16"
- paragraph: ⚠️ Erreur réseau
- button "Changer de stations"
- button "Supprimer les données"
- paragraph:
  - text: Développé par
  - link "Florian Latapie":
    - /url: https://florianlatapie.github.io/
- paragraph:
  - text: Ouvrir
  - link "RATP shortcut":
    - /url: https://florianlatapie.github.io/ratp/
- paragraph:
  - text: Données
  - link "Données Open Data (GBFS) - Vélib' Métropole":
    - /url: https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole
  - text: et
  - link "VeliBest":
    - /url: https://velibest.fr/
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('le site Vélib fonctionne', async ({ page }) => {
  4  |   const velibData = {
  5  |     stations: [
  6  |       { number: '1021', name: 'Halles - Bourdonnais' },
  7  |       { number: '1020', name: 'Lavandieres Sainte Opportune - Rivoli' },
  8  |     ],
  9  |   };
  10 | 
  11 |   // Injecter le localStorage avant tout chargement de page
  12 |   await page.addInitScript((value) => {
  13 |     window.localStorage.setItem('velib', value);
  14 |   }, JSON.stringify(velibData));
  15 | 
  16 |   await page.goto('/velib', {
  17 |     waitUntil: 'networkidle',
  18 |   });
  19 | 
> 20 |   await expect(page).toHaveTitle(/VeXXXlib/i);
     |                      ^ Error: expect(page).toHaveTitle(expected) failed
  21 | });
```