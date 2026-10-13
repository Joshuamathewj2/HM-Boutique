// scripts/test_calculate_bill_totals.js
// Unit tests for single source-of-truth calculateBillTotals function

const assert = require('assert');
const { calculateBillTotals, numberToWords } = require('../lib/orderTotals.ts');

function runTests() {
  console.log("=== RUNNING UNIT TESTS FOR calculateBillTotals ===");
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // 1. User Test Case (Repro)
  test("User Repro: ₹10,000 subtotal, ₹20 manual discount, ₹20 delivery, GST 18% Exclusive, ₹500 paid", () => {
    const res = calculateBillTotals({
      subtotal: 10000,
      discountType: 'FIXED',
      discountValue: 20,
      deliveryFee: 20,
      isGst: true,
      gstPercentage: 18,
      taxMode: 'exclusive',
      paid: 500,
      status: 'pending_deposit',
    });

    assert.strictEqual(res.subtotal, 10000);
    assert.strictEqual(res.manualDiscount, 20);
    assert.strictEqual(res.couponDiscount, 0);
    assert.strictEqual(res.discount, 20);
    assert.strictEqual(res.taxableAmount, 9980);
    assert.strictEqual(res.gstAmount, 1796.40);
    assert.strictEqual(res.cgst, 898.20);
    assert.strictEqual(res.sgst, 898.20);
    assert.strictEqual(res.cgst + res.sgst, res.gstAmount);
    assert.strictEqual(res.deliveryFee, 20);
    assert.strictEqual(res.grandTotal, 11796.40);
    assert.strictEqual(res.paid, 500);
    assert.strictEqual(res.balance, 11296.40);
  });

  // 2. Fixed ₹ discount without delivery
  test("Fixed ₹ discount without delivery (₹5,000 subtotal, ₹100 discount, non-GST)", () => {
    const res = calculateBillTotals({
      subtotal: 5000,
      discountType: 'FIXED',
      discountValue: 100,
      deliveryFee: 0,
      isGst: false,
      paid: 2000,
      status: 'pending_deposit',
    });

    assert.strictEqual(res.subtotal, 5000);
    assert.strictEqual(res.manualDiscount, 100);
    assert.strictEqual(res.discount, 100);
    assert.strictEqual(res.taxableAmount, 4900);
    assert.strictEqual(res.gstAmount, 0);
    assert.strictEqual(res.grandTotal, 4900);
    assert.strictEqual(res.paid, 2000);
    assert.strictEqual(res.balance, 2900);
  });

  // 3. Percentage discount (%): 10% on ₹10,000 with delivery
  test("Percentage discount (%): 10% on ₹10,000 subtotal with ₹50 delivery, GST 18% Exclusive", () => {
    const res = calculateBillTotals({
      subtotal: 10000,
      discountType: 'PERCENT',
      discountValue: 10,
      deliveryFee: 50,
      isGst: true,
      gstPercentage: 18,
      taxMode: 'exclusive',
      paid: 0,
      status: 'pending_deposit',
    });

    // 10,000 - 10% (1,000) = 9,000 taxable. 18% GST = 1,620. Total = 9000 + 1620 + 50 = 10,670.
    assert.strictEqual(res.subtotal, 10000);
    assert.strictEqual(res.manualDiscount, 1000);
    assert.strictEqual(res.discount, 1000);
    assert.strictEqual(res.taxableAmount, 9000);
    assert.strictEqual(res.gstAmount, 1620);
    assert.strictEqual(res.cgst, 810);
    assert.strictEqual(res.sgst, 810);
    assert.strictEqual(res.deliveryFee, 50);
    assert.strictEqual(res.grandTotal, 10670);
    assert.strictEqual(res.balance, 10670);
  });

  // 4. GST Inclusive mode
  test("GST Inclusive mode: ₹11,800 subtotal, ₹0 discount, GST 18% Inclusive, ₹100 delivery", () => {
    const res = calculateBillTotals({
      subtotal: 11800,
      deliveryFee: 100,
      isGst: true,
      gstPercentage: 18,
      taxMode: 'inclusive',
      paid: 11900,
      status: 'COMPLETED',
    });

    // Inclusive 18% on 11,800: taxable = 10,000, gst = 1,800, delivery = 100 -> total = 11,900
    assert.strictEqual(res.subtotal, 11800);
    assert.strictEqual(res.taxableAmount, 10000);
    assert.strictEqual(res.gstAmount, 1800);
    assert.strictEqual(res.cgst, 900);
    assert.strictEqual(res.sgst, 900);
    assert.strictEqual(res.grandTotal, 11900);
    assert.strictEqual(res.paid, 11900);
    assert.strictEqual(res.balance, 0);
  });

  // 5. GST Inclusive with manual discount
  test("GST Inclusive mode with discount: ₹11,800 subtotal, ₹1,180 discount, 18% GST Inclusive, ₹50 delivery", () => {
    const res = calculateBillTotals({
      subtotal: 11800,
      discountType: 'FIXED',
      discountValue: 1180,
      deliveryFee: 50,
      isGst: true,
      gstPercentage: 18,
      taxMode: 'inclusive',
    });

    // Net after discount = 11,800 - 1,180 = 10,620.
    // Taxable = 10,620 / 1.18 = 9,000. GST = 1,620. Total = 10,620 + 50 = 10,670.
    assert.strictEqual(res.subtotal, 11800);
    assert.strictEqual(res.discount, 1180);
    assert.strictEqual(res.taxableAmount, 9000);
    assert.strictEqual(res.gstAmount, 1620);
    assert.strictEqual(res.grandTotal, 10670);
  });

  // 6. Non-GST bill
  test("Non-GST bill: ₹1,500 subtotal, ₹50 discount, ₹30 delivery", () => {
    const res = calculateBillTotals({
      subtotal: 1500,
      discountType: 'FIXED',
      discountValue: 50,
      deliveryFee: 30,
      isGst: false,
      gstPercentage: 0,
      paid: 1480,
      status: 'COMPLETED',
    });

    assert.strictEqual(res.subtotal, 1500);
    assert.strictEqual(res.discount, 50);
    assert.strictEqual(res.taxableAmount, 1450);
    assert.strictEqual(res.gstAmount, 0);
    assert.strictEqual(res.deliveryFee, 30);
    assert.strictEqual(res.grandTotal, 1480);
    assert.strictEqual(res.paid, 1480);
    assert.strictEqual(res.balance, 0);
  });

  // 7. Coupon plus manual discount combined
  test("Coupon plus manual discount combined: ₹10,000 subtotal, ₹100 manual, ₹200 coupon, GST 18% Exclusive, ₹50 delivery", () => {
    const res = calculateBillTotals({
      subtotal: 10000,
      manualDiscount: 100,
      couponDiscount: 200,
      deliveryFee: 50,
      isGst: true,
      gstPercentage: 18,
      taxMode: 'exclusive',
      paid: 500,
    });

    // Total discount = 100 + 200 = 300. Taxable = 9,700. GST 18% = 1,746. Total = 9700 + 1746 + 50 = 11,496.
    assert.strictEqual(res.subtotal, 10000);
    assert.strictEqual(res.manualDiscount, 100);
    assert.strictEqual(res.couponDiscount, 200);
    assert.strictEqual(res.discount, 300);
    assert.strictEqual(res.taxableAmount, 9700);
    assert.strictEqual(res.gstAmount, 1746);
    assert.strictEqual(res.grandTotal, 11496);
    assert.strictEqual(res.paid, 500);
    assert.strictEqual(res.balance, 10996);
  });

  // 8. Order record with saved columns where discount was saved in discount_amount and manual_discount_amount
  test("DB Row with both discount_amount and manual_discount_amount: does NOT double discount", () => {
    const dbRow = {
      subtotal: 10000,
      discount_amount: 20,
      manual_discount_amount: 20,
      manual_discount_type: 'flat',
      manual_discount_value: 20,
      delivery_charge: 20,
      is_gst: true,
      gst_percentage: 18,
      amount_paid: 500,
      status: 'PENDING',
    };

    const res = calculateBillTotals(dbRow);

    assert.strictEqual(res.subtotal, 10000);
    assert.strictEqual(res.discount, 20, "Discount must be 20, NOT 40!");
    assert.strictEqual(res.taxableAmount, 9980);
    assert.strictEqual(res.gstAmount, 1796.40);
    assert.strictEqual(res.deliveryFee, 20);
    assert.strictEqual(res.grandTotal, 11796.40, "Grand total must be 11,796.40, NOT 11,776.40!");
    assert.strictEqual(res.paid, 500);
    assert.strictEqual(res.balance, 11296.40);
  });

  // 9. Items calculation directly from cart/order array
  test("Items array subtotal calculation: 2 items at ₹4,000 + 1 item at ₹2,000", () => {
    const res = calculateBillTotals({
      items: [
        { name: "Blouse", price: 4000, qty: 2 },
        { name: "Salwar", snapshot_price: 2000, quantity: 1 }
      ],
      discountValue: 0,
      isGst: false,
    });

    assert.strictEqual(res.subtotal, 10000);
    assert.strictEqual(res.grandTotal, 10000);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests();
