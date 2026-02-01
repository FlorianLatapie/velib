const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console logs from the browser
  const consoleLogs = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
    console.log(`[Browser ${type}] ${text}`);
  });
  
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
  // Using networkidle to ensure all API calls complete
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  
  // Get the visible text content of the page
  const pageText = await page.evaluate(() => document.body.innerText);
  
  console.log('\n=== PAGE TEXT CONTENT ===');
  console.log(pageText);
  console.log('=== END OF PAGE TEXT ===');
  
  console.log('\n=== BROWSER CONSOLE SUMMARY ===');
  console.log(`Total console messages: ${consoleLogs.length}`);
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  console.log(`Error messages: ${errorLogs.length}`);
  if (errorLogs.length > 0) {
    console.log('\nError details:');
    errorLogs.forEach((log, idx) => {
      console.log(`  ${idx + 1}. ${log.text}`);
    });
  }
  console.log('=== END OF CONSOLE SUMMARY ===');
  
  // Check if the page displays an error message starting with ⚠️
  const hasWarning = pageText.includes('⚠️');
  
  if (hasWarning) {
    console.error('\n❌ ERROR: Page displays a warning message starting with ⚠️');
    console.error('Test FAILED');
    console.error('\nThis indicates that one or more API calls failed during page load.');
    console.error('The error typically occurs when:');
    console.error('  - External APIs (velib-metropole.fr or tdqr.ovh) are unreachable');
    console.error('  - CORS proxies are failing or timing out');
    console.error('  - Network connectivity issues from the GitHub Actions runner');
    console.error('\nCheck the browser console logs above for more details.');
    await browser.close();
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS: No warning messages found');
    console.log('Test PASSED');
    await browser.close();
    process.exit(0);
  }
})();
