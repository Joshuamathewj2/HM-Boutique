/**
 * lib/orderTotals.ts
 *
 * Single source of truth calculation for orders, advance orders, and credit sales.
 * Used across:
 * - Advance Orders table, summary cards, and status transitions
 * - Outstanding Credits table and summary cards
 * - "Receive Remaining Payment" modal
 * - Advance Order invoice (/advance/[id])
 * - Outstanding Credits invoice & Order History invoice (/invoice/[id], PrintableReceipt, InvoiceModal)
 * - PDF print & WhatsApp share generators
 */

export interface OrderTotals {
  subtotal: number;
  discount: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  taxable: number;
  gstPercent: number;
  gstRate: number;
  gstAmount: number;
  gst: number;
  cgst: number;
  sgst: number;
  deliveryFee: number;
  grandTotal: number;
  total: number;
  paid: number;
  balance: number;
}

export function getOrderTotals(record: any): OrderTotals {
  if (!record || typeof record !== 'object') {
    return {
      subtotal: 0,
      discount: 0,
      discountType: 'FIXED',
      discountValue: 0,
      taxable: 0,
      gstPercent: 0,
      gstRate: 0,
      gstAmount: 0,
      gst: 0,
      cgst: 0,
      sgst: 0,
      deliveryFee: 0,
      grandTotal: 0,
      total: 0,
      paid: 0,
      balance: 0,
    };
  }

  // 1. Items subtotal (fallback to record.subtotal if items missing or empty)
  const items: any[] = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.order_items)
    ? record.order_items
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
      : Number(record.subtotal ?? record.total_amount ?? record.total ?? record.grand_total ?? 0);
  const subtotal = Math.round(subtotalRaw * 100) / 100;

  // 2. Discount: subtracted from Subtotal first (support PERCENT and FIXED)
  const rawType = String(
    record.discount_type ||
      record.discountType ||
      (record.discount_percent || record.discountPercent ? 'PERCENT' : 'FIXED')
  ).toUpperCase();
  const isPercent = rawType === 'PERCENT' || rawType === '%' || rawType === 'PERCENTAGE';
  const discountType: 'PERCENT' | 'FIXED' = isPercent ? 'PERCENT' : 'FIXED';

  const discountValue = Number(
    record.discount_value ??
      record.discountValue ??
      (isPercent
        ? record.discount_percent ?? record.discountPercent ?? 0
        : record.discount_amount ??
          record.discountAmount ??
          record.manual_discount_amount ??
          record.discount ??
          0)
  );

  let discount = 0;
  if (isPercent) {
    discount = Math.round(((subtotal * discountValue) / 100) * 100) / 100;
  } else {
    discount = Math.round(
      Number(
        record.discount_amount ??
          record.discountAmount ??
          record.manual_discount_amount ??
          record.discount ??
          discountValue ??
          0
      ) * 100
    ) / 100;
  }
  discount = Math.min(subtotal, Math.max(0, discount));

  // 3. Taxable = Subtotal - Discount
  const taxable = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  // 4. Delivery fee: added after GST and not taxed
  const deliveryFee = Math.round(
    Number(
      record.delivery_fee ??
        record.deliveryFee ??
        record.delivery_charge ??
        record.deliveryCharge ??
        record.shipping ??
        0
    ) * 100
  ) / 100;

  // 5. GST: calculated on Taxable only
  const rawGstRate = Number(
    record.gst_percentage ??
      record.gstPercentage ??
      record.gst_percent ??
      record.gstPercent ??
      record.gst_rate ??
      record.gstRate ??
      0
  );
  const isGstExplicit = Boolean(record.is_gst ?? record.isGst ?? record.gst_enabled ?? record.applyGST);
  const storedGst = Number(record.gst_amount ?? record.gstAmount ?? record.total_gst ?? 0);
  const recordedTotal = Number(record.total ?? record.grand_total ?? record.grandTotal ?? record.total_amount ?? 0);

  let gstPercent = 0;
  let gstAmount = 0;

  if (rawGstRate > 0) {
    gstPercent = rawGstRate;
    gstAmount = storedGst > 0 ? storedGst : Math.round(((taxable * gstPercent) / 100) * 100) / 100;
  } else if (storedGst > 0) {
    gstAmount = Math.round(storedGst * 100) / 100;
    gstPercent = taxable > 0 ? Math.round((gstAmount / taxable) * 100) : (isGstExplicit ? 18 : 0);
  } else if (isGstExplicit) {
    const diff = recordedTotal > (taxable + deliveryFee)
      ? Math.round((recordedTotal - taxable - deliveryFee) * 100) / 100
      : 0;
    if (diff > 0) {
      gstAmount = diff;
      gstPercent = taxable > 0 ? Math.round((diff / taxable) * 100) : 18;
    } else {
      gstPercent = 18;
      gstAmount = Math.round(((taxable * 18) / 100) * 100) / 100;
    }
  } else if (
    recordedTotal > 0 &&
    Math.round((recordedTotal - taxable - deliveryFee) * 100) / 100 > 0 &&
    (record.is_advance ||
      String(record.order_type || '').toUpperCase() === 'ADVANCE' ||
      String(record.invoice_no || '').startsWith('DEP-') ||
      String(record.id || '').startsWith('DEP-') ||
      Boolean(record.deposit_id))
  ) {
    // Old advance order that had total saved as GST-inclusive (e.g. 10,500) but no GST fields
    const diff = Math.round((recordedTotal - taxable - deliveryFee) * 100) / 100;
    gstAmount = diff;
    gstPercent = taxable > 0 ? Math.round((diff / taxable) * 100) : 0;
  } else {
    // Non-GST order
    gstPercent = 0;
    gstAmount = 0;
  }

  // CGST and SGST: 50/50 split of gstAmount, strictly to the paisa
  const gstPaise = Math.round(gstAmount * 100);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const cgst = cgstPaise / 100;
  const sgst = sgstPaise / 100;

  // 6. TOTAL = Taxable + GST + Delivery
  const grandTotal = Math.round((taxable + gstAmount + deliveryFee) * 100) / 100;

  // 7. Settlement and balance determination
  const statusStr = String(record.status || '').toUpperCase();
  const creditStatusStr = String(record.credit_status || '').toLowerCase();
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
        record.amount_paid ??
          record.deposit_amount ??
          record.deposit ??
          record.cash_received ??
          record.amount_received ??
          0
      ) * 100
    ) / 100;
    balance = 0;
  } else {
    paid = Math.round(
      Number(
        record.amount_paid ??
          record.deposit_amount ??
          record.deposit ??
          record.cash_received ??
          record.amount_received ??
          0
      ) * 100
    ) / 100;
    balance = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
  }

  return {
    subtotal,
    discount,
    discountType,
    discountValue,
    taxable,
    gstPercent,
    gstRate: gstPercent,
    gstAmount,
    gst: gstAmount,
    cgst,
    sgst,
    deliveryFee,
    grandTotal,
    total: grandTotal,
    paid,
    balance,
  };
}

export function calculateOrderTotals(record: any): OrderTotals {
  return getOrderTotals(record);
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
