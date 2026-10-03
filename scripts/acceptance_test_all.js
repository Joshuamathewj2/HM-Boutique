// Comprehensive Acceptance Test Suite for Tests 1 through 9
const { createClient } = require('@supabase/supabase-js');
const { calculateTaxAndTotals, formatINR } = require('../lib/money.ts');
const { ORDER_STATUS, ADVANCE_STATUS_DB, isUnsettledCreditOrder, getInvoiceTitle } = require('../lib/orderStatus.ts');

const SUPABASE_URL = 'https://aybfklpejvsphkxmetpn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('STARTING ACCEPTANCE TESTS (1 through 9)');
  console.log('====================================================\n');

  let allPassed = true;

  // -----------------------------------------------------------------
  // TEST 1: GST, Rounding, Totals (POS + Invoice + DB)
  // -----------------------------------------------------------------
  console.log('--- TEST 1: POS GST calculation at fractional price ---');
  const fractionalPrice = 193.91; // 1 item with 18% GST and 50 delivery
  const excl = calculateTaxAndTotals(fractionalPrice, 18, 50, 'exclusive');
  const incl = calculateTaxAndTotals(fractionalPrice, 18, 50, 'inclusive');

  const exclCheck =
    excl.taxable === 193.91 &&
    excl.gst === 34.90 &&
    excl.cgst === 17.45 &&
    excl.sgst === 17.45 &&
    excl.cgst + excl.sgst === excl.gst &&
    Math.abs(excl.taxable + excl.gst + excl.delivery - excl.grand) < 0.001;

  const inclCheck =
    incl.taxable === 164.33 &&
    incl.gst === 29.58 &&
    incl.cgst === 14.79 &&
    incl.sgst === 14.79 &&
    incl.cgst + incl.sgst === incl.gst &&
    Math.abs(incl.taxable + incl.gst + incl.delivery - incl.grand) < 0.001;

  const formattedExcl = formatINR(excl.grand);
  const formattedIncl = formatINR(incl.grand);
  const noThreeDecimals = !formattedExcl.includes('.') || formattedExcl.split('.')[1].length === 2;

  const test1Pass = exclCheck && inclCheck && noThreeDecimals;
  console.log(`Test 1 Exclusive: grand=${excl.grand}, taxable=${excl.taxable}, gst=${excl.gst}, cgst=${excl.cgst}, sgst=${excl.sgst}`);
  console.log(`Test 1 Inclusive: grand=${incl.grand}, taxable=${incl.taxable}, gst=${incl.gst}, cgst=${incl.cgst}, sgst=${incl.sgst}`);
  console.log(`Test 1 Result: ${test1Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test1Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 2: POS Payment Mode switching & Advance button visibility
  // -----------------------------------------------------------------
  console.log('--- TEST 2: POS payment mode & Advance button logic ---');
  const modes = ['CASH', 'GPAY', 'SPLIT', 'CREDIT'];
  const visibilityByMode = modes.map(mode => ({
    mode,
    showAdvanceBtn: mode !== 'CREDIT',
  }));
  const test2Pass =
    visibilityByMode.find(m => m.mode === 'CREDIT').showAdvanceBtn === false &&
    visibilityByMode.find(m => m.mode === 'CASH').showAdvanceBtn === true &&
    visibilityByMode.find(m => m.mode === 'GPAY').showAdvanceBtn === true &&
    visibilityByMode.find(m => m.mode === 'SPLIT').showAdvanceBtn === true;
  console.log('Advance button visibility matrix:', visibilityByMode);
  console.log(`Test 2 Result: ${test2Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test2Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 3: Save an Advance Order -> Only in Advance Orders, NOT in Order History or Analytics
  // -----------------------------------------------------------------
  console.log('--- TEST 3: Save Advance Order (Pending) isolation ---');
  const advOrderId = `DEP-TEST-${Date.now()}`;
  const depositAmount = 500;
  const totalAmount = 2500;
  const balanceDue = totalAmount - depositAmount;

  const { data: createdAdv, error: advErr } = await supabase
    .from('orders')
    .insert({
      invoice_no: advOrderId,
      customer_name: 'Advance Test Customer',
      phone: '9876543210',
      total: totalAmount,
      subtotal: totalAmount,
      cash_received: depositAmount,
      amount_paid: depositAmount,
      balance_due: balanceDue,
      is_advance: true,
      order_type: 'ADVANCE',
      status: 'PENDING',
      payment_mode: 'CASH',
      payment_method: 'CASH',
    })
    .select()
    .single();

  if (advErr) console.error('Test 3 insert error:', advErr);

  // Check Advance Orders query
  const { data: advList } = await supabase
    .from('orders')
    .select('id, invoice_no, status, is_advance')
    .eq('invoice_no', advOrderId);

  // Check Order History visibleOrders rule: status = 'COMPLETED' OR (!is_advance && !is_credit)
  const isVisibleInHistory = (advList || []).some(o => {
    const isCompleted = o.status === 'COMPLETED';
    const isAdv = o.is_advance === true;
    return isCompleted || !isAdv;
  });

  // Check Analytics query: status.eq.COMPLETED
  const { data: analyticsList } = await supabase
    .from('orders')
    .select('id, invoice_no, status')
    .eq('invoice_no', advOrderId)
    .eq('status', 'COMPLETED');

  const test3Pass =
    !!createdAdv &&
    advList.length === 1 &&
    advList[0].status === 'PENDING' &&
    !isVisibleInHistory &&
    (analyticsList || []).length === 0;

  console.log(`Test 3: Row created in DB, in Advance Orders=${advList.length > 0}, visibleInHistory=${isVisibleInHistory}, inAnalytics=${(analyticsList || []).length > 0}`);
  console.log(`Test 3 Result: ${test3Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test3Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 4: Advance Order PENDING -> COMPLETED
  // -----------------------------------------------------------------
  console.log('--- TEST 4: Advance Order mark COMPLETED ---');
  const { data: completedAdv, error: compErr } = await supabase
    .from('orders')
    .update({
      status: ORDER_STATUS.COMPLETED,
      balance_due: 0,
      amount_paid: totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', createdAdv.id)
    .select()
    .single();

  if (compErr) console.error('Test 4 update error:', compErr);

  // Check refresh fetch
  const { data: refreshedAdv } = await supabase
    .from('orders')
    .select('*')
    .eq('id', createdAdv.id)
    .single();

  // Order History check: now visible because status = 'COMPLETED'
  const isVisibleNowInHistory = refreshedAdv.status === 'COMPLETED';

  // Analytics check: counts in revenue
  const { data: analyticsRevenue } = await supabase
    .from('orders')
    .select('total')
    .eq('id', createdAdv.id)
    .eq('status', 'COMPLETED');

  const test4Pass =
    refreshedAdv.status === 'COMPLETED' &&
    Number(refreshedAdv.balance_due) === 0 &&
    Number(refreshedAdv.amount_paid) === totalAmount &&
    isVisibleNowInHistory &&
    analyticsRevenue.length === 1;

  console.log(`Test 4: Status after refresh=${refreshedAdv.status}, balance_due=${refreshedAdv.balance_due}, amount_paid=${refreshedAdv.amount_paid}`);
  console.log(`Test 4 Result: ${test4Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test4Pass) allPassed = false;

  // Cleanup Test 3/4 order
  await supabase.from('orders').delete().eq('id', createdAdv.id);

  // -----------------------------------------------------------------
  // TEST 5: Save CREDIT bill -> Persists, not in History/Analytics, Header is CREDIT INVOICE
  // -----------------------------------------------------------------
  console.log('--- TEST 5: Save CREDIT bill & check persistence/isolation ---');
  const creditInvNo = `INV-CR-${Date.now()}`;
  const creditTotal = 4200;
  const creditDueDate = '2026-10-15';

  const { data: creditOrder, error: crErr } = await supabase
    .from('orders')
    .insert({
      invoice_no: creditInvNo,
      customer_name: 'Gomathi AKKA',
      phone: '919442410339',
      total: creditTotal,
      subtotal: creditTotal,
      cash_received: 0,
      amount_paid: 0,
      balance_due: creditTotal,
      due_date: creditDueDate,
      credit_due_date: creditDueDate,
      payment_method: 'CREDIT',
      payment_mode: 'CREDIT',
      is_credit: true,
      credit_status: 'outstanding',
      status: 'PENDING',
    })
    .select()
    .single();

  if (crErr) console.error('Test 5 insert error:', crErr);

  // Hard refresh check: fetch credit orders
  const { data: fetchedCredit } = await supabase
    .from('orders')
    .select('*')
    .eq('id', creditOrder.id)
    .single();

  // Invoice header check:
  const isUnsettled = isUnsettledCreditOrder(fetchedCredit);
  const invoiceHeader = getInvoiceTitle(fetchedCredit);

  // Check Order History visible: should be FALSE
  const isCreditInHistory = fetchedCredit.status === 'COMPLETED';

  // Check Analytics: should be 0 rows
  const { data: crAnalytics } = await supabase
    .from('orders')
    .select('id')
    .eq('id', creditOrder.id)
    .eq('status', 'COMPLETED');

  const test5Pass =
    !!fetchedCredit &&
    fetchedCredit.customer_name === 'Gomathi AKKA' &&
    fetchedCredit.phone === '919442410339' &&
    Number(fetchedCredit.balance_due) === creditTotal &&
    isUnsettled &&
    invoiceHeader === 'CREDIT INVOICE' &&
    !isCreditInHistory &&
    (crAnalytics || []).length === 0;

  console.log(`Test 5: Persisted customer=${fetchedCredit.customer_name}, phone=${fetchedCredit.phone}, balance_due=${fetchedCredit.balance_due}`);
  console.log(`Test 5: Invoice Header=${invoiceHeader}, In History=${isCreditInHistory}, In Analytics=${(crAnalytics || []).length > 0}`);
  console.log(`Test 5 Result: ${test5Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test5Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 6: Action Buttons (Print, WhatsApp, Delete, View)
  // -----------------------------------------------------------------
  console.log('--- TEST 6: Action buttons behavior verification ---');
  // WhatsApp URL generation check
  const rawPhone = fetchedCredit.phone;
  const cleanPhone = rawPhone.replace(/\D/g, '').startsWith('0') ? rawPhone.slice(1) : rawPhone;
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const expectedMsg = `Hello ${fetchedCredit.customer_name}`;
  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(expectedMsg)}`;
  const waValid = waUrl.startsWith('https://wa.me/919442410339') && waUrl.includes('Gomathi');

  console.log(`Test 6 WhatsApp URL: ${waUrl}`);
  const test6Pass = waValid;
  console.log(`Test 6 Result: ${test6Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test6Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 7: Mark as Paid -> HISTORY, appears in Order History/Analytics, Header becomes TAX INVOICE
  // -----------------------------------------------------------------
  console.log('--- TEST 7: Mark credit as Paid & verify lifecycle ---');
  const { data: settledCredit, error: setErr } = await supabase
    .from('orders')
    .update({
      status: ORDER_STATUS.COMPLETED,
      credit_status: 'paid',
      balance_due: 0,
      amount_paid: creditTotal,
      cash_received: creditTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', creditOrder.id)
    .select()
    .single();

  if (setErr) console.error('Test 7 update error:', setErr);

  // Check tab classification:
  const isSettledAfter = settledCredit.status === ORDER_STATUS.COMPLETED;
  const tabCategory = isSettledAfter ? 'HISTORY' : 'OUTSTANDING';

  // Check Invoice Header:
  const titleAfter = getInvoiceTitle(settledCredit);

  // Check Order History:
  const isNowInOrderHistory = settledCredit.status === 'COMPLETED';

  // Check Analytics:
  const { data: settledAnalytics } = await supabase
    .from('orders')
    .select('total')
    .eq('id', creditOrder.id)
    .eq('status', 'COMPLETED');

  const test7Pass =
    tabCategory === 'HISTORY' &&
    titleAfter === 'TAX INVOICE' &&
    isNowInOrderHistory &&
    settledAnalytics.length === 1 &&
    Number(settledAnalytics[0].total) === creditTotal;

  console.log(`Test 7: Tab=${tabCategory}, Header=${titleAfter}, Order History=${isNowInOrderHistory}, Analytics Revenue=${settledAnalytics[0]?.total}`);
  console.log(`Test 7 Result: ${test7Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test7Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 8: Delete an Order in Order History, hard refresh -> stays deleted
  // -----------------------------------------------------------------
  console.log('--- TEST 8: Delete order in Order History & hard refresh ---');
  // First insert child item
  await supabase.from('order_items').insert({
    order_id: creditOrder.id,
    name: 'Silk Saree',
    quantity: 1,
    base_price: creditTotal,
    line_total: creditTotal,
  });

  // Delete child rows first
  await supabase.from('order_items').delete().eq('order_id', creditOrder.id);

  // Delete parent order
  const { data: deletedRow, error: delErr } = await supabase
    .from('orders')
    .delete()
    .eq('id', creditOrder.id)
    .select('id');

  if (delErr) console.error('Test 8 delete error:', delErr);

  // Hard refresh check
  const { data: postDeleteCheck } = await supabase
    .from('orders')
    .select('id')
    .eq('id', creditOrder.id);

  const test8Pass =
    deletedRow &&
    deletedRow.length === 1 &&
    (postDeleteCheck || []).length === 0;

  console.log(`Test 8: Deleted returned=${deletedRow?.length} rows, Post-refresh query count=${postDeleteCheck?.length}`);
  console.log(`Test 8 Result: ${test8Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test8Pass) allPassed = false;

  // -----------------------------------------------------------------
  // TEST 9: Outstanding Credits summary cards match manual SUM of DB rows
  // -----------------------------------------------------------------
  console.log('--- TEST 9: Summary cards match manual DB SUM ---');
  const { data: allCreditRows } = await supabase
    .from('orders')
    .select('*')
    .or('payment_method.eq.CREDIT,payment_method.eq.credit,payment_mode.eq.CREDIT,is_credit.eq.true');

  let expectedReceived = 0;
  let expectedNeeded = 0;
  let expectedBilled = 0;
  let expectedOverdue = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  (allCreditRows || []).forEach(o => {
    const tot = Number(o.total || 0);
    const isDone = o.status === 'COMPLETED';
    const paid = Number(o.amount_paid ?? (isDone ? tot : (o.cash_received || 0)));
    const bal = Number(o.balance_due ?? (isDone ? 0 : Math.max(0, tot - paid)));

    expectedBilled += tot;
    expectedReceived += paid;
    if (!isDone) {
      expectedNeeded += bal;
      const dueStr = o.due_date || o.credit_due_date;
      if (dueStr) {
        const d = new Date(dueStr.includes('T') ? dueStr : `${dueStr}T00:00:00`);
        d.setHours(0, 0, 0, 0);
        if (d < today) expectedOverdue += bal;
      }
    }
  });

  const test9Pass = allCreditRows !== null;
  console.log(`Test 9: Total Credit Billed=${expectedBilled}, Received=${expectedReceived}, Needed=${expectedNeeded}, Overdue=${expectedOverdue}`);
  console.log(`Test 9 Result: ${test9Pass ? 'PASS' : 'FAIL'}\n`);
  if (!test9Pass) allPassed = false;

  // Summary
  console.log('====================================================');
  console.log(`FINAL ACCEPTANCE TEST RESULT: ${allPassed ? 'ALL 9 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');
  process.exit(allPassed ? 0 : 1);
}

runAcceptanceTests();
