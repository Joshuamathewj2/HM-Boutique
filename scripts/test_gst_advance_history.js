const { getOrderTotals, numberToWords } = require('../lib/orderTotals.ts');

function runTests() {
  console.log('--- Running GST & Advance Order Verification Tests ---\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
    }
  }

  // TEST CASE 1: Order of ₹10,000 with 5% GST and ₹100 advance
  // Advance Orders shows Total ₹10,500, Paid ₹100, Balance ₹10,400.
  const advanceOrderWithGst = {
    id: 'adv-gst-1',
    invoice_no: 'DEP-20261009-1234',
    customer_name: 'Priya Sharma',
    customer_phone: '9876543210',
    subtotal: 10000,
    is_gst: true,
    gst_percentage: 5,
    gst_amount: 500,
    total_amount: 10500,
    deposit_amount: 100,
    status: 'PENDING',
    items: [
      { snapshot_name: 'Designer Saree', snapshot_price: 10000, quantity: 1 }
    ]
  };

  const t1 = getOrderTotals(advanceOrderWithGst);
  assert(t1.subtotal === 10000, 'Test 1.1: Advance Order Subtotal is 10,000', `Got ${t1.subtotal}`);
  assert(t1.gstPercent === 5, 'Test 1.2: GST percentage is 5%', `Got ${t1.gstPercent}`);
  assert(t1.gstAmount === 500, 'Test 1.3: GST amount is 500', `Got ${t1.gstAmount}`);
  assert(t1.cgst === 250, 'Test 1.4: CGST is 250 (50% split)', `Got ${t1.cgst}`);
  assert(t1.sgst === 250, 'Test 1.5: SGST is 250 (50% split)', `Got ${t1.sgst}`);
  assert(t1.grandTotal === 10500, 'Test 1.6: Advance Orders Total is ₹10,500', `Got ${t1.grandTotal}`);
  assert(t1.paid === 100, 'Test 1.7: Advance Orders Paid is ₹100', `Got ${t1.paid}`);
  assert(t1.balance === 10400, 'Test 1.8: Advance Orders Balance is ₹10,400', `Got ${t1.balance}`);

  // TEST CASE 2: Same order in Order History shows ₹10,500
  const completedOrderHistory = {
    id: 'ord-hist-1',
    invoice_no: 'INV-2026-ABCDE',
    customer_name: 'Priya Sharma',
    subtotal: 10000,
    is_gst: true,
    gst_percentage: 5,
    gst_amount: 500,
    grand_total: 10500,
    total: 10500,
    amount_paid: 10500,
    status: 'COMPLETED',
    items: [
      { snapshot_name: 'Designer Saree', snapshot_price: 10000, quantity: 1 }
    ]
  };

  const t2 = getOrderTotals(completedOrderHistory);
  assert(t2.subtotal === 10000, 'Test 2.1: Order History Subtotal is ₹10,000', `Got ${t2.subtotal}`);
  assert(t2.gstAmount === 500, 'Test 2.2: Order History GST is ₹500', `Got ${t2.gstAmount}`);
  assert(t2.grandTotal === 10500, 'Test 2.3: Order History Grand Total is ₹10,500', `Got ${t2.grandTotal}`);
  assert(t2.paid === 10500, 'Test 2.4: Order History Paid is ₹10,500', `Got ${t2.paid}`);
  assert(t2.balance === 0, 'Test 2.5: Order History Balance is 0', `Got ${t2.balance}`);

  // TEST CASE 3: Invoice preview breakdown & Amount in words based on grand total
  const wordsFor10500 = numberToWords(t1.grandTotal);
  assert(
    wordsFor10500.toLowerCase().includes('ten thousand five hundred'),
    'Test 3.1: Amount in words uses grand total (Ten Thousand Five Hundred)',
    `Got "${wordsFor10500}"`
  );
  assert(t1.cgst + t1.sgst === t1.gstAmount, 'Test 3.2: CGST + SGST equals total GST amount', `${t1.cgst} + ${t1.sgst} vs ${t1.gstAmount}`);

  // TEST CASE 4: Non-GST order is unchanged
  const nonGstOrder = {
    id: 'ord-nongst-1',
    invoice_no: 'INV-2026-NONGST',
    subtotal: 4500,
    is_gst: false,
    gst_amount: 0,
    total: 4500,
    deposit_amount: 1500,
    status: 'PENDING',
    items: [{ snapshot_name: 'Cotton Kurti', snapshot_price: 4500, quantity: 1 }]
  };
  const t4 = getOrderTotals(nonGstOrder);
  assert(t4.subtotal === 4500, 'Test 4.1: Non-GST subtotal is 4500', `Got ${t4.subtotal}`);
  assert(t4.gstAmount === 0, 'Test 4.2: Non-GST gstAmount is 0', `Got ${t4.gstAmount}`);
  assert(t4.cgst === 0 && t4.sgst === 0, 'Test 4.3: Non-GST CGST and SGST are 0', `CGST: ${t4.cgst}, SGST: ${t4.sgst}`);
  assert(t4.grandTotal === 4500, 'Test 4.4: Non-GST grand total is 4500', `Got ${t4.grandTotal}`);
  assert(t4.paid === 1500, 'Test 4.5: Non-GST paid is 1500', `Got ${t4.paid}`);
  assert(t4.balance === 3000, 'Test 4.6: Non-GST balance is 3000', `Got ${t4.balance}`);

  // TEST CASE 5: Old order saved before this fix still opens without errors
  // e.g., only subtotal is present, no gst fields at all
  const legacyOrder1 = {
    id: 'ord-legacy-1',
    subtotal: 8000,
    items: [{ snapshot_name: 'Silk Dupatta', snapshot_price: 8000, quantity: 1 }]
  };
  const t5_1 = getOrderTotals(legacyOrder1);
  assert(t5_1.subtotal === 8000, 'Test 5.1: Legacy order subtotal is 8000', `Got ${t5_1.subtotal}`);
  assert(t5_1.grandTotal === 8000, 'Test 5.2: Legacy order grand total fallback is 8000', `Got ${t5_1.grandTotal}`);
  assert(t5_1.gstAmount === 0, 'Test 5.3: Legacy order GST is 0', `Got ${t5_1.gstAmount}`);
  assert(t5_1.balance === 8000, 'Test 5.4: Legacy order balance is 8000', `Got ${t5_1.balance}`);

  // Legacy advance order where total_amount was 10500 but total_gst was 0/missing
  const legacyAdvanceGst = {
    id: 'adv-legacy-gst',
    invoice_no: 'DEP-20260901-9999',
    subtotal: 10000,
    total_amount: 10500, // saved before fix with GST embedded in total_amount
    deposit_amount: 100,
    status: 'PENDING'
  };
  const t5_2 = getOrderTotals(legacyAdvanceGst);
  assert(t5_2.grandTotal === 10500, 'Test 5.5: Legacy advance order preserves total_amount of ₹10,500', `Got ${t5_2.grandTotal}`);
  assert(t5_2.paid === 100, 'Test 5.6: Legacy advance order deposit paid is ₹100', `Got ${t5_2.paid}`);
  assert(t5_2.balance === 10400, 'Test 5.7: Legacy advance order balance is ₹10,400', `Got ${t5_2.balance}`);
  assert(t5_2.gstAmount === 500, 'Test 5.8: Legacy advance order detects 500 GST from total diff', `Got ${t5_2.gstAmount}`);


  console.log(`\nResults: ${passed}/${total} assertions passed.`);
  if (passed === total) {
    console.log('ALL TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

runTests();
