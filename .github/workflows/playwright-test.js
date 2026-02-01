const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Define the localStorage data to inject
  const localStorageData = {
    stations: [
      {
        number: "10152",
        name: "Gare du Nord - Place de Valenciennes"
      },
      {
        number: "3012",
        name: "Square Emile - Chautemps"
      }
    ]
  };
  
  // Navigate to the page first (required to set localStorage)
  await page.goto('https://florianlatapie.github.io/velib/');
  
  // Inject localStorage
  await page.evaluate((data) => {
    localStorage.setItem('velib', JSON.stringify(data));
  }, localStorageData);
  
  // Reload the page to apply the localStorage changes
  await page.reload();
  
  // Wait for the page to load completely
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  
  // Get the visible text content of the page
  const pageText = await page.evaluate(() => document.body.innerText);
  
  console.log('=== PAGE TEXT CONTENT ===');
  console.log(pageText);
  console.log('=== END OF PAGE TEXT ===');
  
  // Check if the page displays an error message starting with ⚠️
  const hasWarning = pageText.includes('⚠️');
  
  if (hasWarning) {
    console.error('\n❌ ERROR: Page displays a warning message starting with ⚠️');
    console.error('Test FAILED');
    await browser.close();
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS: No warning messages found');
    console.log('Test PASSED');
    await browser.close();
    process.exit(0);
  }
})();
