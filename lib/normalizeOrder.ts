// lib/normalizeOrder.ts
// Single source of truth normalizer for orders across all pages and modals

import { ORDER_STATUS } from './orderStatus';
import { isUuid } from './ids';

export function normalizeOrder(r: any) {
  if (!r) return null;

  const total = Number(r.total ?? r.grand_total ?? r.grandTotal ?? 0);
  const paid = Number(
    r.amount_paid !== undefined && r.amount_paid !== null
      ? r.amount_paid
      : r.amountPaid !== undefined && r.amountPaid !== null
      ? r.amountPaid
      : r.cash_received !== undefined && r.cash_received !== null
      ? r.cash_received
      : r.cashReceived !== undefined && r.cashReceived !== null
      ? r.cashReceived
      : String(r.status || '').toUpperCase() === ORDER_STATUS.COMPLETED
      ? total
      : 0
  );

  const balance = Number(
    r.balance_due !== undefined && r.balance_due !== null
      ? r.balance_due
      : r.balanceDue !== undefined && r.balanceDue !== null
      ? r.balanceDue
      : String(r.status || '').toUpperCase() === ORDER_STATUS.COMPLETED
      ? 0
      : Math.max(0, total - paid)
  );

  const customerName = (r.customer_name ?? r.customerName ?? r.name ?? r.customers?.name ?? '').trim() || 'Counter Customer';
  const customerPhone = (r.phone ?? r.customer_phone ?? r.customerPhone ?? r.customers?.phone ?? '').trim();
  const customerAddress = (r.address ?? r.customer_address ?? r.customerAddress ?? r.customers?.address ?? '').trim();
  const rawDate = r.created_at || r.bill_date || r.createdAt || r.date || new Date().toISOString();

  const status = r.status ? String(r.status).toUpperCase() : "";

  const isCredit = Boolean(
    r.is_credit ||
    String(r.payment_mode || '').toUpperCase() === 'CREDIT' ||
    String(r.payment_method || '').toUpperCase() === 'CREDIT' ||
    r.credit_status
  );

  const isAdvance = Boolean(
    r.is_advance ||
    String(r.order_type || '').toUpperCase() === 'ADVANCE' ||
    String(r.invoice_no || '').startsWith('DEP-')
  );

  const dueDate = r.due_date || r.credit_due_date || r.expected_delivery_date || null;

  let rawItems: any[] = [];
  if (Array.isArray(r.items) && r.items.length > 0) {
    rawItems = r.items;
  } else if (Array.isArray(r.order_items) && r.order_items.length > 0) {
    rawItems = r.order_items;
  } else if (typeof r.items === 'string') {
    try {
      const parsed = JSON.parse(r.items);
      if (Array.isArray(parsed)) rawItems = parsed;
    } catch {}
  }

  const items = rawItems.map((it: any, idx: number) => ({
    id: String(it.id || `${r.id || r.invoice_no}-${idx}`),
    name: it.snapshot_name || it.name || it.product_name || 'Item',
    snapshot_name: it.snapshot_name || it.name || it.product_name || 'Item',
    price: Number(it.snapshot_price ?? it.price ?? it.base_price ?? it.line_total ?? 0),
    snapshot_price: Number(it.snapshot_price ?? it.price ?? it.base_price ?? it.line_total ?? 0),
    quantity: Number(it.quantity ?? it.qty ?? 1),
    qty: Number(it.quantity ?? it.qty ?? 1),
  }));

  const rawId = r.id ? String(r.id) : '';
  const rawInvoiceNo = String(r.invoice_no || r.invoiceNo || r.deposit_id || r.depositId || '');
  const id = isUuid(rawId) ? rawId : (isUuid(r.order_id) ? String(r.order_id) : rawId);
  const invoiceNo = rawInvoiceNo || (isUuid(rawId) ? '' : rawId);

  return {
    ...r,
    id,
    invoiceNo,
    invoice_no: invoiceNo,
    customerName,
    customer_name: customerName,
    customerPhone,
    customer_phone: customerPhone,
    phone: customerPhone,
    customerAddress,
    customer_address: customerAddress,
    address: customerAddress,
    total,
    grand_total: total,
    grandTotal: total,
    paid,
    amount_paid: paid,
    amountPaid: paid,
    balance,
    balance_due: balance,
    balanceDue: balance,
    status,
    is_credit: isCredit,
    is_advance: isAdvance,
    due_date: dueDate,
    credit_due_date: dueDate,
    created_at: rawDate,
    bill_date: rawDate,
    date: rawDate,
    items,
    order_items: items,
  };
}

export function waLink(phone: string, text: string): string | null {
  let d = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) d = '91' + d;
  return d.length < 11 ? null : `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function formatDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
