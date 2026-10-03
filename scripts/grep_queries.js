const fs = require('fs');
const files = [
  'app/admin/billing/page.tsx',
  'app/admin/advance-orders/page.tsx',
  'app/admin/outstanding-credits/page.tsx',
  'app/admin/orders/page.tsx',
  'app/admin/analytics/page.tsx',
  'app/components/InvoiceModal.tsx',
  'app/components/OutstandingCredits.tsx',
  'app/pos/admin/secure/control-panel/hm-boutique/page.tsx'
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log('NOT FOUND:', f);
    continue;
  }
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.from(')) {
      // print line and next 5 lines
      const snippet = lines.slice(idx, idx + 6).map(l => l.trim()).join(' ');
      console.log(`\nFILE: ${f} (Line ${idx + 1})\n  ${snippet}`);
    }
  });
}
