const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/invoice/TEST?print=true&paper=thermal&size=80');
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'C:/freelance/HM-Boutique/thermal_print.png', fullPage: true });
  
  await page.goto('http://localhost:3000/invoice/TEST?print=true&paper=a4');
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'C:/freelance/HM-Boutique/a4_print.png', fullPage: true });
  
  await browser.close();
  console.log('done');
})();
