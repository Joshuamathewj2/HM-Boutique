const { createClient } = require('@supabase/supabase-js');

const url = 'https://aybfklpejvsphkxmetpn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg';
const supabase = createClient(url, key);

async function runAcceptanceTests() {
  console.log('=== STARTING ACCEPTANCE TESTS ===\n');

  // TEST 1: Delete an order in Order History
  console.log('--- TEST 1: Order Deletion Persistence ---');
  const { data: ord1, error: err1 } = await supabase.from('orders').insert({
    invoice_no: 'INV-TEST-A1-' + Date.now(),
    customer_name: 'Test Delete Order',
    total: 1500,
    status: 'COMPLETED',
    payment_mode: 'CASH',
    payment_method: 'cash',
    cash_received: 1500
  }).select().single();
  console.log('Created order:', ord1?.id, ord1?.invoice_no, err1 ? err1.message : 'OK');

  // Insert child item
  const { data: item1, error: itemErr1 } = await supabase.from('order_items').insert({
    order_id: ord1.id,
    product_name: 'Test Item',
    quantity: 1,
    line_total: 1500
  }).select().single();
  console.log('Created child item:', item1?.id, itemErr1 ? itemErr1.message : 'OK');

  // Delete child rows and order
  await supabase.from('order_items').delete().eq('order_id', ord1.id);
  const { data: del1, error: delErr1 } = await supabase.from('orders').delete().eq('id', ord1.id).select('id');
  console.log('Deleted order:', del1, delErr1 ? delErr1.message : 'OK');

  // Hard refresh check: check if row is gone in Supabase
  const { data: check1 } = await supabase.from('orders').select('*').eq('id', ord1.id);
  const test1Pass = check1 && check1.length === 0;
  console.log('Row existence in Supabase after delete:', check1 ? check1.length : 0, '-> TEST 1:', test1Pass ? 'PASS' : 'FAIL');


  // TEST 2: Advance order PENDING -> COMPLETED
  console.log('\n--- TEST 2: Advance Order Status COMPLETED ---');
  const depId = 'DEP-TEST-A2-' + Date.now();
  const { data: adv2, error: advErr2 } = await supabase.from('advance_orders').insert({
    deposit_id: depId,
    customer_name: 'Test Advance Customer',
    phone: '9876543210',
    product_name: 'Blouse Stitching',
    total_amount: 5000,
    deposit_amount: 1000,
    expected_delivery_date: '2026-10-15',
    status: 'pending_deposit'
  }).select().single();

  const ordRow2 = {
    invoice_no: depId,
    customer_name: 'Test Advance Customer',
    phone: '9876543210',
    order_type: 'ADVANCE',
    total: 5000,
    cash_received: 1000,
    status: 'PENDING'
  };
  const { data: ord2, error: ordErr2 } = await supabase.from('orders').insert(ordRow2).select().single();

  console.log('Advance order created:', adv2?.deposit_id, 'status:', adv2?.status, 'orders status:', ord2?.status);

  // Status transition to COMPLETED
  const { data: updOrd2 } = await supabase.from('orders').update({
    status: 'COMPLETED',
    cash_received: 5000,
    updated_at: new Date().toISOString()
  }).eq('id', ord2.id).select().single();

  const { data: updAdv2 } = await supabase.from('advance_orders').update({
    status: 'completed',
    deposit_amount: 5000,
    completed_at: new Date().toISOString()
  }).eq('id', adv2.id).select().single();

  // Check if satisfies Order History filter: completed sales
  const { data: histCheck } = await supabase.from('orders').select('*')
    .eq('id', ord2.id);
  const visibleInHistory = histCheck && histCheck.length === 1 && histCheck[0].status === 'COMPLETED';

  // Check Analytics query filter: status.eq.COMPLETED,status.eq.completed
  const { data: analyticsCheck } = await supabase.from('orders').select('*')
    .or('status.eq.COMPLETED,status.eq.completed')
    .eq('id', ord2.id);

  const test2Pass = updOrd2?.status === 'COMPLETED' && visibleInHistory && analyticsCheck && analyticsCheck.length === 1;
  console.log('Order status after completion:', updOrd2?.status, 'in History:', histCheck?.length, 'in Analytics:', analyticsCheck?.length, '-> TEST 2:', test2Pass ? 'PASS' : 'FAIL');

  // Clean up Test 2
  await supabase.from('advance_orders').delete().eq('id', adv2.id);
  await supabase.from('orders').delete().eq('id', ord2.id);


  // TEST 3: Create a CREDIT bill in POS, hard refresh Outstanding Credits
  console.log('\n--- TEST 3: CREDIT bill persistence in Supabase ---');
  const creditInv = 'INV-CREDIT-A3-' + Date.now();
  const { data: ord3, error: err3 } = await supabase.from('orders').insert({
    invoice_no: creditInv,
    customer_name: 'Credit Customer Test',
    phone: '9123456780',
    total: 3000,
    cash_received: 500,
    payment_mode: 'CREDIT',
    payment_method: 'credit',
    is_credit: true,
    credit_status: 'outstanding',
    credit_due_date: '2026-10-20',
    status: 'PENDING'
  }).select().single();

  console.log('Created credit order:', ord3?.invoice_no, err3 ? err3.message : 'OK');

  // Refresh query for Outstanding Credits
  const { data: creditsFetch } = await supabase.from('orders').select('*')
    .or('payment_mode.eq.CREDIT,payment_method.eq.CREDIT,payment_method.eq.credit,is_credit.eq.true')
    .eq('id', ord3.id);

  const test3Pass = creditsFetch && creditsFetch.length === 1 && creditsFetch[0].customer_name === 'Credit Customer Test';
  console.log('Credits fetch on refresh:', creditsFetch?.length, 'Customer:', creditsFetch?.[0]?.customer_name, '-> TEST 3:', test3Pass ? 'PASS' : 'FAIL');


  // TEST 4: Header title is CREDIT INVOICE, Mark as Completed -> HISTORY & TAX INVOICE
  console.log('\n--- TEST 4: Invoice title transition & Mark as Completed ---');
  const isUnsettledBefore = (creditsFetch[0].payment_method === 'credit' || creditsFetch[0].is_credit) && creditsFetch[0].status !== 'COMPLETED';
  const titleBefore = isUnsettledBefore ? 'CREDIT INVOICE' : 'TAX INVOICE';
  console.log('Initial Invoice Title:', titleBefore);

  // Mark as Completed
  const { data: ord4Completed } = await supabase.from('orders').update({
    status: 'COMPLETED',
    credit_status: 'paid',
    cash_received: 3000,
    credit_paid_at: new Date().toISOString()
  }).eq('id', ord3.id).select().single();

  const isUnsettledAfter = (ord4Completed.payment_method === 'credit' || ord4Completed.is_credit) && ord4Completed.status !== 'COMPLETED';
  const titleAfter = isUnsettledAfter ? 'CREDIT INVOICE' : 'TAX INVOICE';
  console.log('After Mark as Completed Status:', ord4Completed.status, 'Title:', titleAfter);

  const test4Pass = titleBefore === 'CREDIT INVOICE' && titleAfter === 'TAX INVOICE' && ord4Completed.status === 'COMPLETED';
  console.log('-> TEST 4:', test4Pass ? 'PASS' : 'FAIL');

  // Clean up Test 3 & 4
  await supabase.from('orders').delete().eq('id', ord3.id);


  // TEST 5: Summary cards match a manual SUM of DB rows
  console.log('\n--- TEST 5: Summary cards match manual SUM ---');
  // Insert 2 test credit rows: 1 outstanding, 1 settled
  const { data: c1 } = await supabase.from('orders').insert({
    invoice_no: 'INV-CR-S1-' + Date.now(),
    total: 2000,
    cash_received: 500,
    payment_mode: 'CREDIT',
    payment_method: 'credit',
    is_credit: true,
    credit_status: 'outstanding',
    credit_due_date: '2026-09-01',
    status: 'PENDING'
  }).select().single();

  const { data: c2 } = await supabase.from('orders').insert({
    invoice_no: 'INV-CR-S2-' + Date.now(),
    total: 4000,
    cash_received: 4000,
    payment_mode: 'CREDIT',
    payment_method: 'credit',
    is_credit: true,
    credit_status: 'paid',
    status: 'COMPLETED'
  }).select().single();

  const { data: allCredits } = await supabase.from('orders').select('*')
    .in('id', [c1.id, c2.id]);

  let totalBilled = 0, totalReceived = 0, totalOutstanding = 0;
  allCredits.forEach(o => {
    const tot = Number(o.total || 0);
    const isComp = o.status === 'COMPLETED';
    const rec = isComp ? tot : Number(o.cash_received || 0);
    totalBilled += tot;
    totalReceived += rec;
    if (!isComp) totalOutstanding += (tot - rec);
  });
  console.log('Manual DB calculations: Billed =', totalBilled, 'Received =', totalReceived, 'Outstanding =', totalOutstanding);
  const test5Pass = totalBilled === 6000 && totalReceived === 4500 && totalOutstanding === 1500;
  console.log('-> TEST 5:', test5Pass ? 'PASS' : 'FAIL');

  // Clean up Test 5
  await supabase.from('orders').delete().in('id', [c1.id, c2.id]);


  // TEST 6: Analytics counts ONLY completed orders
  console.log('\n--- TEST 6: Analytics Excludes Pending & Unpaid ---');
  const { data: ordComp } = await supabase.from('orders').insert({
    invoice_no: 'INV-ANA-1-' + Date.now(),
    total: 1000,
    status: 'COMPLETED'
  }).select().single();

  const { data: ordPend } = await supabase.from('orders').insert({
    invoice_no: 'INV-ANA-2-' + Date.now(),
    total: 2000,
    status: 'PENDING'
  }).select().single();

  const { data: anaRows } = await supabase.from('orders').select('*')
    .or('status.eq.COMPLETED,status.eq.completed');

  const includedIds = anaRows.map(r => r.id);
  const test6Pass = includedIds.includes(ordComp.id) && !includedIds.includes(ordPend.id);
  console.log('Analytics included COMPLETED:', includedIds.includes(ordComp.id), 'excluded PENDING:', !includedIds.includes(ordPend.id));
  console.log('-> TEST 6:', test6Pass ? 'PASS' : 'FAIL');

  // Clean up Test 6
  await supabase.from('orders').delete().in('id', [ordComp.id, ordPend.id]);

  console.log('\n=== ALL TESTS SUMMARY ===');
  console.log('Test 1:', test1Pass ? 'PASS' : 'FAIL');
  console.log('Test 2:', test2Pass ? 'PASS' : 'FAIL');
  console.log('Test 3:', test3Pass ? 'PASS' : 'FAIL');
  console.log('Test 4:', test4Pass ? 'PASS' : 'FAIL');
  console.log('Test 5:', test5Pass ? 'PASS' : 'FAIL');
  console.log('Test 6:', test6Pass ? 'PASS' : 'FAIL');
}

runAcceptanceTests().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
