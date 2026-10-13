/**
 * lib/orderTotals.ts
 *
 * Single source of truth calculation for orders, advance orders, credit sales,
 * billing panel, invoice preview, print receipts, and WhatsApp share messages.
 */

export interface OrderTotals {
  subtotal: number;
  manualDiscount: number;
  couponDiscount: number;
  discount: number; // total discount = manualDiscount + couponDiscount
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  taxableAmount: number;
  taxable: number;
  taxMode: 'exclusive' | 'inclusive';
  gstPercent: number;
  gstRate: number;
  gstAmount: number;
  gstTotal: number;
  gst: number;
  cgst: number;
  sgst: number;
  delivery: number;
  deliveryFee: number;
  grandTotal: number;
  total: number;
  paid: number;
  balance: number;
  isGst: boolean;
}

export type BillTotalsResult = OrderTotals;

export interface BillCalculationInput {
  subtotal?: number;
  items?: any[];
  order_items?: any[];
  products?: any[];
  discountType?: 'PERCENT' | 'FIXED' | 'percent' | 'flat' | string;
  discount_type?: string;
  manual_discount_type?: string;
  discountValue?: number;
  discount_value?: number;
  manual_discount_value?: number;
  manualDiscount?: number;
  manual_discount_amount?: number;
  couponDiscount?: number;
  coupon_discount_amount?: number;
  coupon_discount?: number;
  couponCode?: string | null;
  coupon_code?: string | null;
  discount?: number;
  discount_amount?: number;
  taxMode?: 'exclusive' | 'inclusive' | string;
  tax_mode?: string;
  isGst?: boolean;
  is_gst?: boolean;
  gst_enabled?: boolean;
  applyGST?: boolean;
  gstPercentage?: number;
  gst_percentage?: number;
  gstPercent?: number;
  gst_percent?: number;
  gstRate?: number;
  gst_rate?: number;
  gstAmount?: number;
  gst_amount?: number;
  total_gst?: number;
  deliveryFee?: number;
  delivery_fee?: number;
  delivery_charge?: number;
  deliveryCharge?: number;
  shipping?: number;
  paid?: number;
  amount_paid?: number;
  deposit_amount?: number;
  deposit?: number;
  cash_received?: number;
  amount_received?: number;
  total?: number;
  grandTotal?: number;
  grand_total?: number;
  total_amount?: number;
  status?: string;
  credit_status?: string | null;
  is_advance?: boolean;
  order_type?: string;
  invoice_no?: string;
  id?: string;
  [key: string]: any;
}

/**
 * Calculates all billing and order totals using integer paise to eliminate floating-point drift.
 * Rules:
 * - Subtotal: sum of items (or provided subtotal)
 * - Discounts: manualDiscount + couponDiscount (subtracted from Subtotal before GST)
 * - Taxable = Math.max(0, Subtotal - Discounts)
 * - Exclusive GST: GST applies on Taxable, Delivery added after GST
 * - Inclusive GST: Taxable = (Subtotal - Discounts) / (1 + rate/100), Delivery added after
 * - Delivery: never taxed, strictly added after GST
 * - CGST / SGST: strict 50/50 split of GST to the paisa (cgst + sgst === gst)
 * - Balance = Math.max(0, GrandTotal - Paid) (0 if settled)
 */
export function calculateBillTotals(input: BillCalculationInput | any): BillTotalsResult {
  if (!input || typeof input !== 'object') {
    return {
      subtotal: 0,
      manualDiscount: 0,
      couponDiscount: 0,
      discount: 0,
      discountType: 'FIXED',
      discountValue: 0,
      taxableAmount: 0,
      taxable: 0,
      taxMode: 'exclusive',
      gstPercent: 0,
      gstRate: 0,
      gstAmount: 0,
      gstTotal: 0,
      gst: 0,
      cgst: 0,
      sgst: 0,
      delivery: 0,
      deliveryFee: 0,
      grandTotal: 0,
      total: 0,
      paid: 0,
      balance: 0,
      isGst: false,
    };
  }

  // 1. Subtotal calculation
  const items: any[] = Array.isArray(input.items)
    ? input.items
    : Array.isArray(input.order_items)
    ? input.order_items
    : Array.isArray(input.products)
    ? input.products
    : [];

  let itemsSum = 0;
  if (items.length > 0) {
    itemsSum = items.reduce((sum, it) => {
      const price = Number(
        it.snapshot_price ?? it.price ?? it.rate ?? it.unit_price ?? it.base_price ?? 0
      );
      const qty = Number(it.quantity ?? it.qty ?? 1);
      return sum + price * qty;
    }, 0);
  }

  const subtotalRaw =
    itemsSum > 0
      ? itemsSum
      : Number(input.subtotal ?? input.total_amount ?? input.total ?? input.grand_total ?? input.grandTotal ?? 0);
  const subtotal = Math.round(Math.max(0, subtotalRaw) * 100) / 100;

  // 2. Discount type & value
  const rawType = String(
    input.discountType ||
    input.discount_type ||
    input.manual_discount_type ||
    (input.discount_percent || input.discountPercent ? 'PERCENT' : 'FIXED')
  ).toUpperCase();
  const isPercent = rawType === 'PERCENT' || rawType === '%' || rawType === 'PERCENTAGE';
  const discountType: 'PERCENT' | 'FIXED' = isPercent ? 'PERCENT' : 'FIXED';

  const discountValue = Number(
    input.discountValue ??
    input.discount_value ??
    input.manual_discount_value ??
    (isPercent ? (input.discount_percent ?? input.discountPercent ?? 0) : 0)
  );

  // Coupon discount
  const couponDiscount = Math.round(
    Number(
      input.couponDiscount ??
      input.coupon_discount_amount ??
      input.coupon_discount ??
      0
    ) * 100
  ) / 100;

  // Manual discount: computed from percentage or fixed amount
  let manualDiscount = 0;
  if (input.manualDiscount !== undefined && input.manualDiscount !== null) {
    manualDiscount = Math.round(Number(input.manualDiscount) * 100) / 100;
  } else if (isPercent) {
    manualDiscount = Math.round(((subtotal * Math.max(0, discountValue)) / 100) * 100) / 100;
  } else {
    // Fixed amount: check manual_discount_value, manual_discount_amount, or discount_amount
    const rawFixed = Number(
      discountValue > 0
        ? discountValue
        : (input.manual_discount_value && input.manual_discount_value > 0
            ? input.manual_discount_value
            : (input.manual_discount_amount && input.manual_discount_amount > 0
                ? input.manual_discount_amount
                : (input.discount_amount ?? input.discountAmount ?? input.discount ?? 0)))
    );
    manualDiscount = Math.round(Math.max(0, rawFixed) * 100) / 100;
    // If discount was read from an already-combined discount_amount and couponDiscount was provided separately, avoid double counting
    if (couponDiscount > 0 && manualDiscount > couponDiscount && (input.discount_amount || input.discount)) {
      if (manualDiscount === Number(input.discount_amount || input.discount)) {
        manualDiscount = Math.max(0, manualDiscount - couponDiscount);
      }
    }
  }

  manualDiscount = Math.min(subtotal, Math.max(0, manualDiscount));
  const totalDiscount = Math.min(subtotal, Math.round((manualDiscount + couponDiscount) * 100) / 100);

  // 3. Taxable Amount (Subtotal - Discounts)
  const netAfterDiscount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

  // 4. Delivery fee (added after GST, never taxed)
  const deliveryFee = Math.round(
    Number(
      input.deliveryFee ??
      input.delivery_fee ??
      input.delivery_charge ??
      input.deliveryCharge ??
      input.shipping ??
      0
    ) * 100
  ) / 100;

  // 5. GST determination and mode
  const rawGstRate = Number(
    input.gstPercentage ??
    input.gst_percentage ??
    input.gstPercent ??
    input.gst_percent ??
    input.gstRate ??
    input.gst_rate ??
    0
  );
  const isGstExplicit = Boolean(
    input.isGst ??
    input.is_gst ??
    input.gst_enabled ??
    input.applyGST ??
    (rawGstRate > 0)
  );

  const taxMode: 'exclusive' | 'inclusive' =
    String(input.taxMode || input.tax_mode || 'exclusive').toLowerCase() === 'inclusive'
      ? 'inclusive'
      : 'exclusive';

  let gstPercent = 0;
  let gstAmount = 0;
  let taxableAmount = netAfterDiscount;

  if (rawGstRate > 0 || isGstExplicit) {
    gstPercent = rawGstRate > 0 ? rawGstRate : 18;

    if (gstPercent > 0 && netAfterDiscount > 0) {
      if (taxMode === 'inclusive') {
        const netPaise = Math.round(netAfterDiscount * 100);
        const taxablePaise = Math.round(netPaise / (1 + gstPercent / 100));
        const gstPaise = netPaise - taxablePaise;
        taxableAmount = taxablePaise / 100;
        gstAmount = gstPaise / 100;
      } else {
        // Exclusive mode
        taxableAmount = netAfterDiscount;
        gstAmount = Math.round(((taxableAmount * gstPercent) / 100) * 100) / 100;
      }
    } else {
      taxableAmount = netAfterDiscount;
      gstAmount = 0;
    }
  } else {
    gstPercent = 0;
    gstAmount = 0;
    taxableAmount = netAfterDiscount;
  }

  // CGST and SGST: strict 50/50 split to the paisa
  const gstPaise = Math.round(gstAmount * 100);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const cgst = cgstPaise / 100;
  const sgst = sgstPaise / 100;

  // 6. Grand Total
  // Exclusive: taxable + gst + delivery
  // Inclusive: netAfterDiscount + delivery (since taxable + gst === netAfterDiscount)
  const grandTotal = Math.round((taxableAmount + gstAmount + deliveryFee) * 100) / 100;

  // 7. Settlement and balance determination
  const statusStr = String(input.status || '').toUpperCase();
  const creditStatusStr = String(input.credit_status || '').toLowerCase();
  const isSettled =
    statusStr === 'COMPLETED' ||
    statusStr === 'PAID' ||
    creditStatusStr === 'paid';
  const isCancelled = statusStr === 'CANCELLED';

  let paid: number;
  let balance: number;

  if (isSettled) {
    paid = grandTotal;
    balance = 0;
  } else if (isCancelled) {
    paid = Math.round(
      Number(
        input.amount_paid ??
        input.deposit_amount ??
        input.deposit ??
        input.cash_received ??
        input.amount_received ??
        input.paid ??
        0
      ) * 100
    ) / 100;
    balance = 0;
  } else {
    paid = Math.round(
      Number(
        input.amount_paid ??
        input.deposit_amount ??
        input.deposit ??
        input.cash_received ??
        input.amount_received ??
        input.paid ??
        0
      ) * 100
    ) / 100;
    balance = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
  }

  return {
    subtotal,
    manualDiscount,
    couponDiscount,
    discount: totalDiscount,
    discountType,
    discountValue,
    taxableAmount,
    taxable: taxableAmount,
    taxMode,
    gstPercent,
    gstRate: gstPercent,
    gstAmount,
    gstTotal: gstAmount,
    gst: gstAmount,
    cgst,
    sgst,
    delivery: deliveryFee,
    deliveryFee,
    grandTotal,
    total: grandTotal,
    paid,
    balance,
    isGst: isGstExplicit && gstPercent > 0,
  };
}

export function getOrderTotals(record: any): OrderTotals {
  return calculateBillTotals(record);
}

export function calculateOrderTotals(record: any): OrderTotals {
  return calculateBillTotals(record);
}

export function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatChunk = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "") + " ";
    } else if (n > 0) {
      str += a[n] + " ";
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let result = "";
  let n = integerPart;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore > 0) result += formatChunk(crore) + " Crore ";
  if (lakh > 0) result += formatChunk(lakh) + " Lakh ";
  if (thousand > 0) result += formatChunk(thousand) + " Thousand ";
  if (hundred > 0) result += formatChunk(hundred) + " ";

  result = result.trim();
  if (!result) result = "Zero";

  let out = result + " Rupees";
  if (decimalPart > 0) {
    out += " and " + formatChunk(decimalPart) + " Paise";
  }
  return out + " Only";
}
