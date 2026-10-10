const { chromium } = require('C:/freelance/HM-main/HM/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Authorize in localStorage & sessionStorage
  await page.addInitScript(() => {
    localStorage.setItem('pos_authorized', 'true');
    localStorage.setItem('pos_role', 'admin');
    sessionStorage.setItem('pos_authorized', 'true');
    sessionStorage.setItem('pos_role', 'admin');
  });

  console.log('Navigating to POS on port 3001...');
  await page.goto('http://localhost:3001/pos/admin/secure/control-panel/hm-boutique', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Go to Advance Orders tab
  console.log('Switching to Advance Orders tab...');
  const advanceTab = page.locator('button:has-text("Advance Orders")').first();
  if (await advanceTab.isVisible()) {
    await advanceTab.click();
    await page.waitForTimeout(1000);
  }

  // Find a "View Invoice" button in Advance Orders
  const viewInvoiceBtn = page.locator('button[title="View Invoice"]').first();
  await viewInvoiceBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Clicking View Invoice to open InvoiceModal...');
  await viewInvoiceBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of InvoiceModal open
  await page.screenshot({ path: 'screenshot_invoice_modal.png' });
  console.log('Saved screenshot_invoice_modal.png');

  // Find "Print Invoice" button inside InvoiceModal
  const printInvoiceBtn = page.locator('button:has-text("Print Invoice")');
  await printInvoiceBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Clicking Print Invoice inside InvoiceModal...');
  await printInvoiceBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of Print Settings modal open inside InvoiceModal!
  await page.screenshot({ path: 'screenshot_print_settings_modal.png' });
  console.log('Saved screenshot_print_settings_modal.png');

  // Verify that Print Settings modal is visible with Thermal Roll and Sheet (A4/A5)
  const thermalBtn = page.locator('button:has-text("Thermal Roll")');
  const sheetBtn = page.locator('button:has-text("Sheet (A4/A5)")');
  const isThermalVisible = await thermalBtn.isVisible();
  const isSheetVisible = await sheetBtn.isVisible();
  console.log(`Print Settings Visible: Thermal=${isThermalVisible}, Sheet=${isSheetVisible}`);

  // Test Thermal 80mm Print
  await thermalBtn.click();
  const btn80 = page.locator('button:has-text("80 mm")');
  if (await btn80.isVisible()) await btn80.click();

  // Intercept window.print to prevent freezing playwright
  await page.evaluate(() => {
    window.print = () => {
      console.log('WINDOW.PRINT CALLED');
      window.__printCalled = true;
    };
  });

  const printNowBtn = page.locator('button:has-text("Print Now")');
  await printNowBtn.click();
  await page.waitForTimeout(500);

  // Emulate print media and take screenshot of thermal print preview
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'screenshot_bug1_thermal_print.png', fullPage: true });
  console.log('Saved screenshot_bug1_thermal_print.png');

  // Reset print media emulation
  await page.emulateMedia({ media: 'screen' });

  // Open print settings again and test A4 Sheet
  await printInvoiceBtn.click();
  await page.waitForTimeout(500);
  await sheetBtn.click();
  const a4Btn = page.locator('button:has-text("A4 Sheet")');
  if (await a4Btn.isVisible()) await a4Btn.click();
  await printNowBtn.click();
  await page.waitForTimeout(500);

  // Emulate print media and take screenshot of A4 print preview
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'screenshot_bug1_a4_print.png', fullPage: true });
  console.log('Saved screenshot_bug1_a4_print.png');

  await browser.close();
  console.log('Bug 1 test complete!');
})();
