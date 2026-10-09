const { calculateOrderTotals, numberToWords } = require('../lib/orderTotals.ts');


console.log('====================================================');
console.log('RUNNING LOGICAL & ALGORITHMIC TESTS FOR ALL 13 ITEMS');
console.log('====================================================\n');

let failed = 0;

// Test 1: Advance order: item ₹1,500, ₹500 paid, 18% GST. Modal shows Total ₹1,770, Balance ₹1,270, Final Amount ₹1,270.
const t1 = calculateOrderTotals({
  items: [{ snapshot_price: 1500, quantity: 1 }],
  is_gst: true,
  gst_percentage: 18,
  deposit_amount: 500,
});
console.log('Item 1 (Advance order math):');
console.log(`Total: ${t1.total} (expected 1770) | Balance: ${t1.balance} (expected 1270) | Paid: ${t1.paid} (expected 500)`);
if (t1.total === 1770 && t1.balance === 1270 && t1.paid === 500) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 3: Invoice test A: Subtotal 999, Discount 20, GST 18%, Delivery 20 -> GST +₹176.22, TOTAL ₹1,175.22
const t3 = calculateOrderTotals({
  subtotal: 999,
  discount_amount: 20,
  is_gst: true,
  gst_percentage: 18,
  delivery_fee: 20,
});
console.log('\nItem 3 (Invoice test A):');
console.log(`Taxable: ${t3.taxable} (expected 979) | GST: ${t3.gst} (expected 176.22) | Total: ${t3.total} (expected 1175.22)`);
if (t3.taxable === 979 && t3.gst === 176.22 && t3.total === 1175.22) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 4: Invoice test B: advance ₹1,500, 18% GST, ₹80 paid, no discount/delivery ->
// Subtotal ₹1,500.00, GST (18%) +₹270.00, TOTAL ₹1,770.00.
// Amount in Words: "One Thousand Seven Hundred Seventy Rupees Only". Left-bottom: paid ₹80.00, Balance Due ₹1,690.00
const t4 = calculateOrderTotals({
  subtotal: 1500,
  is_gst: true,
  gst_percentage: 18,
  deposit_amount: 80,
});
const words4 = numberToWords(t4.total);
console.log('\nItem 4 (Invoice test B):');
console.log(`Total: ${t4.total} (expected 1770) | GST: ${t4.gst} (expected 270) | Paid: ${t4.paid} (expected 80) | Balance: ${t4.balance} (expected 1690)`);
console.log(`Words: "${words4}" (expected "One Thousand Seven Hundred Seventy Rupees Only")`);
if (t4.total === 1770 && t4.gst === 270 && t4.paid === 80 && t4.balance === 1690 && words4 === 'One Thousand Seven Hundred Seventy Rupees Only') {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 5: Invoice test C: item ₹1,500, Discount ₹30, GST 18%, Delivery ₹40 ->
// Subtotal ₹1,500.00, Manual Discount -₹30.00, GST (18%) +₹264.60, Delivery ₹40.00, TOTAL ₹1,774.60. Words from ₹1,774.60.
const t5 = calculateOrderTotals({
  subtotal: 1500,
  discount_amount: 30,
  is_gst: true,
  gst_percentage: 18,
  delivery_fee: 40,
});
const words5 = numberToWords(t5.total);
console.log('\nItem 5 (Invoice test C):');
console.log(`Total: ${t5.total} (expected 1774.6) | GST: ${t5.gst} (expected 264.6) | Words: "${words5}"`);
if (t5.total === 1774.6 && t5.gst === 264.6 && words5.includes('One Thousand Seven Hundred Seventy Four Rupees and Sixty Paise Only')) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 6: Left-bottom example: order with Total ₹1,785.66 / Paid ₹70.00 shows "Cash Received: ₹70.00" and "Balance Due: ₹1,715.66"
const t6 = calculateOrderTotals({
  total: 1785.66,
  amount_paid: 70.00,
});
console.log('\nItem 6 (Left-bottom example):');
console.log(`Paid: ${t6.paid} (expected 70.00) | Balance: ${t6.balance} (expected 1715.66)`);
if (t6.paid === 70 && t6.balance === 1715.66) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 7: COMPLETED advance order: paid line shows full GST-inclusive TOTAL and "Balance Due: ₹0.00"
const t7 = calculateOrderTotals({
  subtotal: 1500,
  is_gst: true,
  gst_percentage: 18,
  deposit_amount: 500,
  status: 'COMPLETED',
});
console.log('\nItem 7 (COMPLETED advance order):');
console.log(`Paid: ${t7.paid} (expected 1770) | Balance: ${t7.balance} (expected 0)`);
if (t7.paid === 1770 && t7.balance === 0) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

// Test 13: An old record with no GST/discount/delivery shows only Subtotal and TOTAL and behaves exactly as before
const t13 = calculateOrderTotals({
  subtotal: 500,
  total: 500,
});
console.log('\nItem 13 (Old record with no GST/discount/delivery):');
console.log(`Subtotal: ${t13.subtotal} | Discount: ${t13.discount} | GST: ${t13.gst} | Delivery: ${t13.deliveryFee} | Total: ${t13.total}`);
if (t13.subtotal === 500 && t13.discount === 0 && t13.gst === 0 && t13.deliveryFee === 0 && t13.total === 500) {
  console.log('PASS');
} else {
  console.log('FAIL');
  failed++;
}

console.log(`\nAll checks completed. Total failures: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
