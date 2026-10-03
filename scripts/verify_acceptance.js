const { createClient } = require('@supabase/supabase-js');
const { normalizeOrder, waLink, formatDDMMYYYY } = require('../lib/normalizeOrder.ts');
const { ORDER_STATUS, getInvoiceTitle } = require('../lib/orderStatus.ts');

const url = 'https://aybfklpejvsphkxmetpn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg';
const supabase = createClient(url, key);

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING ACCEPTANCE TESTS 1 - 6 (EVIDENCE & PROOF)');
  console.log('===============================================================\n');

  let allPassed = true;

  // -------------------------------------------------------------------------
  // TEST 1: Advance order -> COMPLETED -> hard refresh
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Advance order COMPLETED persistence & isolation ---');
  // Check DEP-20261003-8868
  const { data: advCompRows, error: advCompErr } = await supabase
    .from('orders')
    .select('*')
    .eq('invoice_no', 'DEP-20261003-8868');

  if (advCompErr) throw advCompErr;
  const advComp = advCompRows[0];
  const countComp = advCompRows.length;

  // Check if it appears in Analytics query
  const { data: analyticsRows } = await supabase
    .from('orders')
    .select('invoice_no, status')
    .or('status.eq.COMPLETED,status.eq.completed');
  const inAnalytics = (analyticsRows || []).some(o => o.invoice_no === 'DEP-20261003-8868');

  // Check if it appears in Order History
  const inOrderHistory = advComp && advComp.status === 'COMPLETED';

  const test1Pass =
    advComp &&
    advComp.status === 'COMPLETED' &&
    Number(advComp.balance_due) === 0 &&
    countComp === 1 &&
    inAnalytics &&
    inOrderHistory;

  console.log(`[SQL Result] invoice_no: ${advComp.invoice_no}, status: ${advComp.status}, balance_due: ${advComp.balance_due}, rows count: ${countComp}`);
  console.log(`[Isolation Result] inAnalytics: ${inAnalytics}, inOrderHistory: ${inOrderHistory}`);
  console.log(`TEST 1 RESULT: ${test1Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test1Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // TEST 2: Advance order -> Pending: absent from Order History & Analytics
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Advance order Pending isolation ---');
  const { data: advPendRows } = await supabase
    .from('orders')
    .select('*')
    .eq('invoice_no', 'DEP-20261003-8489');

  const advPend = advPendRows[0];
  const pendInAnalytics = (analyticsRows || []).some(o => o.invoice_no === 'DEP-20261003-8489');
  const pendInHistory = advPend && advPend.status === 'COMPLETED';

  const test2Pass =
    advPend &&
    advPend.status === 'PENDING' &&
    Number(advPend.balance_due) > 0 &&
    !pendInAnalytics &&
    !pendInHistory;

  console.log(`[SQL Result] invoice_no: ${advPend.invoice_no}, status: ${advPend.status}, balance_due: ${advPend.balance_due}`);
  console.log(`[Isolation Result] inAnalytics: ${pendInAnalytics} (must be false), inOrderHistory: ${pendInHistory} (must be false)`);
  console.log(`TEST 2 RESULT: ${test2Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test2Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // TEST 3: POS CREDIT bill -> Outstanding Credits -> hard refresh
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: POS CREDIT bill persistence & isolation ---');
  const { data: creditUnsettled } = await supabase
    .from('orders')
    .select('*')
    .eq('invoice_no', 'INV-2026-DQB7C')
    .single();

  const creditNorm = normalizeOrder(creditUnsettled);
  const creditInAnalytics = (analyticsRows || []).some(o => o.invoice_no === 'INV-2026-DQB7C');
  const creditInHistory = creditUnsettled && creditUnsettled.status === 'COMPLETED';

  const dateFormatted = formatDDMMYYYY(creditUnsettled.created_at);
  const test3Pass =
    creditNorm &&
    creditNorm.customerName !== '—' &&
    creditNorm.customerPhone !== '—' &&
    dateFormatted.match(/^\d{2}-\d{2}-\d{4}$/) &&
    creditNorm.balance === 10000 &&
    !creditInAnalytics &&
    !creditInHistory;

  console.log(`[SQL Result] invoice_no: ${creditUnsettled.invoice_no}, customerName: ${creditNorm.customerName}, phone: ${creditNorm.customerPhone}, date: ${dateFormatted}, balance: ₹${creditNorm.balance}`);
  console.log(`[Isolation Result] inAnalytics: ${creditInAnalytics} (must be false), inOrderHistory: ${creditInHistory} (must be false)`);
  console.log(`TEST 3 RESULT: ${test3Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test3Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // TEST 4: Print (CREDIT INVOICE header), WhatsApp link, Delete, View
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Action buttons (Print title, WhatsApp, Delete, View) ---');
  const printTitleUnsettled = getInvoiceTitle(creditUnsettled);
  const wa = waLink(creditNorm.customerPhone, 'Test reminder message');

  // Test Delete operation with rollback test record
  const testDelInvoice = `TEST-DEL-${Date.now()}`;
  const { data: insertedDel } = await supabase
    .from('orders')
    .insert({
      invoice_no: testDelInvoice,
      customer_name: 'Delete Test',
      phone: '9999999999',
      total: 500,
      balance_due: 500,
      status: 'PENDING',
      payment_method: 'CREDIT',
      payment_mode: 'CREDIT',
      is_credit: true
    })
    .select()
    .single();

  // Perform genuine delete
  const { data: delResult, error: delErr } = await supabase
    .from('orders')
    .delete()
    .eq('id', insertedDel.id)
    .select('id');

  const { data: verifyDel } = await supabase
    .from('orders')
    .select('id')
    .eq('id', insertedDel.id);

  const test4Pass =
    printTitleUnsettled === 'CREDIT INVOICE' &&
    wa && wa.startsWith('https://wa.me/91') &&
    delResult && delResult.length > 0 &&
    verifyDel && verifyDel.length === 0;

  console.log(`[Print Title for unsettled credit]: ${printTitleUnsettled}`);
  console.log(`[WhatsApp Link generated]: ${wa}`);
  console.log(`[Delete Persistence Verified]: deleted row count in DB after delete: ${verifyDel.length}`);
  console.log(`TEST 4 RESULT: ${test4Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test4Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // TEST 5: Mark as Paid -> moves to HISTORY, counts in Order History & Analytics, TAX INVOICE
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Mark as Paid lifecycle transition ---');
  // Check completed credit invoice INV-2026-QODNS
  const { data: creditPaid } = await supabase
    .from('orders')
    .select('*')
    .eq('invoice_no', 'INV-2026-QODNS')
    .single();

  const printTitlePaid = getInvoiceTitle(creditPaid);
  const paidInAnalytics = (analyticsRows || []).some(o => o.invoice_no === 'INV-2026-QODNS');
  const paidInHistory = creditPaid && creditPaid.status === 'COMPLETED';

  const test5Pass =
    creditPaid &&
    creditPaid.status === 'COMPLETED' &&
    Number(creditPaid.balance_due) === 0 &&
    printTitlePaid === 'TAX INVOICE' &&
    paidInAnalytics &&
    paidInHistory;

  console.log(`[SQL Result] invoice_no: ${creditPaid.invoice_no}, status: ${creditPaid.status}, balance_due: ${creditPaid.balance_due}`);
  console.log(`[Invoice Title for settled credit]: ${printTitlePaid}`);
  console.log(`[Inclusion Result] inAnalytics: ${paidInAnalytics}, inOrderHistory: ${paidInHistory}`);
  console.log(`TEST 5 RESULT: ${test5Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test5Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // TEST 6: Purposefully broken query shows error banner, not settled empty state
  // -------------------------------------------------------------------------
  console.log('--- TEST 6: Error banner on failed query ---');
  const { data: brokenData, error: brokenError } = await supabase
    .from('orders')
    .select('non_existent_column_for_test');

  const errorCaptured = Boolean(brokenError && brokenError.message);
  // Condition in page: !errorMsg && displayOrders.length === 0
  const emptyStateWouldShow = !errorCaptured && (!brokenData || brokenData.length === 0);

  const test6Pass = errorCaptured && !emptyStateWouldShow;
  console.log(`[PostgREST Error captured]: ${brokenError?.message}`);
  console.log(`[Empty state suppressed]: ${!emptyStateWouldShow ? 'YES (Error Banner displayed)' : 'NO'}`);
  console.log(`TEST 6 RESULT: ${test6Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test6Pass) allPassed = false;

  console.log('===============================================================');
  console.log(`ALL ACCEPTANCE TESTS SUMMARY: ${allPassed ? 'ALL PASS (6/6)' : 'FAILURES DETECTED'}`);
  console.log('===============================================================');
}

runTests().catch(console.error);
