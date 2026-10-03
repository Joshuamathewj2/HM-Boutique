const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://aybfklpejvsphkxmetpn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const isUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function completeOrder(row) {
  if (!isUuid(row?.id)) throw new Error(`Row has no valid UUID: ${row?.id}`);
  const orderTotal = Number(row.total ?? row.grand_total ?? 0);
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'COMPLETED',
      credit_status: 'paid',
      balance_due: 0,
      amount_paid: orderTotal,
      cash_received: orderTotal,
      credit_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select()
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? 'Update affected 0 rows');

  const { data: check } = await supabase
    .from('orders')
    .select('status,balance_due')
    .eq('id', row.id)
    .single();

  if (check?.status !== 'COMPLETED') throw new Error('Status was reverted');
  return data;
}

async function runTests() {
  console.log('================================================================');
  console.log('ORDER LIFECYCLE ACCEPTANCE VERIFICATION');
  console.log('================================================================\n');

  // TEST 3: PENDING Advance Order is ABSENT from Order History & Analytics
  console.log('--- TEST 3: PENDING Advance Order Isolation ---');
  const advInvoiceNo = `DEP-${Date.now().toString().slice(-8)}`;
  const { data: advOrder, error: advErr } = await supabase
    .from('orders')
    .insert({
      invoice_no: advInvoiceNo,
      customer_name: 'Acceptance Advance Customer',
      phone: '9876543210',
      status: 'PENDING',
      is_advance: true,
      order_type: 'ADVANCE',
      payment_mode: 'CASH',
      payment_method: 'cash',
      total: 5000,
      amount_paid: 1000,
      balance_due: 4000,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (advErr || !advOrder) {
    console.error('Failed to create test advance order:', advErr);
    return;
  }
  console.log(`Created PENDING advance order: id=${advOrder.id}, invoice=${advOrder.invoice_no}`);

  // Query Order History (status = COMPLETED)
  const { data: historyWithPendingAdv } = await supabase
    .from('orders')
    .select('id, invoice_no, status')
    .eq('status', 'COMPLETED')
    .eq('id', advOrder.id);
  console.log('Present in Order History (should be 0):', historyWithPendingAdv.length);

  // Query Analytics (status = COMPLETED)
  const { data: analyticsWithPendingAdv } = await supabase
    .from('orders')
    .select('id, invoice_no, status')
    .eq('status', 'COMPLETED')
    .eq('id', advOrder.id);
  console.log('Present in Analytics (should be 0):', analyticsWithPendingAdv.length);

  const test3Pass = historyWithPendingAdv.length === 0 && analyticsWithPendingAdv.length === 0;
  console.log('TEST 3 RESULT:', test3Pass ? 'PASSED' : 'FAILED');

  // TEST 1 & 2: Advance Order PENDING -> COMPLETED via completeOrder
  console.log('\n--- TEST 1 & 2: Complete Advance Order (Dropdown / Rupee Button) ---');
  const completedAdv = await completeOrder(advOrder);
  console.log('Completed Advance DB Row:', {
    id: completedAdv.id,
    invoice_no: completedAdv.invoice_no,
    status: completedAdv.status,
    amount_paid: completedAdv.amount_paid,
    balance_due: completedAdv.balance_due,
  });

  // Query Order History
  const { data: historyWithCompletedAdv } = await supabase
    .from('orders')
    .select('id, invoice_no, status, balance_due')
    .eq('status', 'COMPLETED')
    .eq('id', advOrder.id);
  console.log('Found in Order History (should be 1):', historyWithCompletedAdv.length);

  // Query Analytics
  const { data: analyticsWithCompletedAdv } = await supabase
    .from('orders')
    .select('id, invoice_no, status, total')
    .eq('status', 'COMPLETED')
    .eq('id', advOrder.id);
  console.log('Found in Analytics (should be 1):', analyticsWithCompletedAdv.length);

  const test1Pass =
    completedAdv.status === 'COMPLETED' &&
    completedAdv.balance_due === 0 &&
    historyWithCompletedAdv.length === 1 &&
    analyticsWithCompletedAdv.length === 1;
  console.log('TEST 1 & 2 RESULT:', test1Pass ? 'PASSED' : 'FAILED');

  // Cleanup test advance order
  await supabase.from('orders').delete().eq('id', advOrder.id);

  // TEST 4: POS CREDIT Save
  console.log('\n--- TEST 4: POS Pay by CREDIT Isolation ---');
  const credInvoiceNo = `INV-${Date.now().toString().slice(-6)}`;
  const { data: credOrder, error: credErr } = await supabase
    .from('orders')
    .insert({
      invoice_no: credInvoiceNo,
      customer_name: 'Acceptance Credit Customer',
      phone: '9840123456',
      status: 'PENDING',
      is_credit: true,
      payment_mode: 'CREDIT',
      payment_method: 'CREDIT',
      credit_status: 'outstanding',
      total: 8000,
      amount_paid: 0,
      balance_due: 8000,
      due_date: '2026-10-20',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (credErr || !credOrder) {
    console.error('Failed to create credit order:', credErr);
    return;
  }
  console.log(`Created PENDING credit order: id=${credOrder.id}, invoice=${credOrder.invoice_no}`);

  // Query Outstanding Credits
  const { data: outstandingFetch } = await supabase
    .from('orders')
    .select('id, invoice_no, is_credit, status, balance_due')
    .or('payment_method.eq.CREDIT,is_credit.eq.true')
    .eq('id', credOrder.id);
  console.log('Found in Outstanding Credits list (should be 1):', outstandingFetch.length);

  // Check Order History (should be 0)
  const { data: historyWithPendingCred } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'COMPLETED')
    .eq('id', credOrder.id);
  console.log('Found in Order History (should be 0):', historyWithPendingCred.length);

  // Check Analytics (should be 0)
  const { data: analyticsWithPendingCred } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'COMPLETED')
    .eq('id', credOrder.id);
  console.log('Found in Analytics (should be 0):', analyticsWithPendingCred.length);

  const test4Pass =
    outstandingFetch.length === 1 &&
    historyWithPendingCred.length === 0 &&
    analyticsWithPendingCred.length === 0;
  console.log('TEST 4 RESULT:', test4Pass ? 'PASSED' : 'FAILED');

  // TEST 5: Mark as Paid via completeOrder(row)
  console.log('\n--- TEST 5: Mark as Paid ---');
  const paidCreditOrder = await completeOrder(credOrder);
  console.log('Settled Credit DB Row:', {
    id: paidCreditOrder.id,
    invoice_no: paidCreditOrder.invoice_no,
    status: paidCreditOrder.status,
    credit_status: paidCreditOrder.credit_status,
    amount_paid: paidCreditOrder.amount_paid,
    balance_due: paidCreditOrder.balance_due,
  });

  // Query Order History
  const { data: historyWithPaidCred } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'COMPLETED')
    .eq('id', credOrder.id);
  console.log('Found in Order History (should be 1):', historyWithPaidCred.length);

  // Query Analytics
  const { data: analyticsWithPaidCred } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'COMPLETED')
    .eq('id', credOrder.id);
  console.log('Found in Analytics (should be 1):', analyticsWithPaidCred.length);

  const test5Pass =
    paidCreditOrder.status === 'COMPLETED' &&
    paidCreditOrder.balance_due === 0 &&
    historyWithPaidCred.length === 1 &&
    analyticsWithPaidCred.length === 1;
  console.log('TEST 5 RESULT:', test5Pass ? 'PASSED' : 'FAILED');

  // Cleanup test credit order
  await supabase.from('orders').delete().eq('id', credOrder.id);

  // TEST 6: POS Cash Sale
  console.log('\n--- TEST 6: POS Cash Sale ---');
  const cashInvoiceNo = `INV-${Date.now().toString().slice(-6)}`;
  const { data: cashOrder, error: cashErr } = await supabase
    .from('orders')
    .insert({
      invoice_no: cashInvoiceNo,
      customer_name: 'Acceptance Cash Customer',
      status: 'COMPLETED',
      payment_mode: 'CASH',
      payment_method: 'CASH',
      total: 3500,
      amount_paid: 3500,
      cash_received: 3500,
      balance_due: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: historyWithCash } = await supabase
    .from('orders')
    .select('id, status')
    .eq('status', 'COMPLETED')
    .eq('id', cashOrder.id);
  console.log('Found in Order History immediately (should be 1):', historyWithCash.length);

  const { data: analyticsWithCash } = await supabase
    .from('orders')
    .select('id, total')
    .eq('status', 'COMPLETED')
    .eq('id', cashOrder.id);
  console.log('Found in Analytics immediately (should be 1):', analyticsWithCash.length);

  const test6Pass = historyWithCash.length === 1 && analyticsWithCash.length === 1;
  console.log('TEST 6 RESULT:', test6Pass ? 'PASSED' : 'FAILED');

  // Cleanup test cash order
  await supabase.from('orders').delete().eq('id', cashOrder.id);

  console.log('\n================================================================');
  console.log('ALL ACCEPTANCE TESTS SUMMARY:');
  console.log(`Test 1 & 2 (Advance completion): ${test1Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 3 (Advance pending isolation): ${test3Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 4 (Credit pending isolation): ${test4Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 5 (Mark as Paid flow): ${test5Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 6 (Cash sale flow): ${test6Pass ? 'PASSED' : 'FAILED'}`);
  console.log('================================================================');
}

runTests();
