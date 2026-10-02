export type Category = {
  id: string;
  name: string;
  created_at: string;
  is_active?: boolean;
  sort_order?: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  gst_rate: number; // Default GST % for this product (editable at billing)
  hsn_code: string | null; // HSN/SAC code shown on GST invoices
  selling_price: number; // GST-inclusive catalog price
  created_at: string;

  // HM Boutique Extended Inventory Fields
  sku?: string;
  stock_quantity?: number;
  low_stock_alert?: number;
  purchase_price?: number;
  price?: number;
  offer_price?: number | null;
  unit?: string;
  unit_label?: string;
  item_type?: 'product' | 'service';
  is_active?: boolean;
  image_url?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  created_at: string;
};

export type PaymentMode = 'CASH' | 'GPAY' | 'SPLIT' | 'CREDIT';

export type OrderRow = {
  id: string;
  customer_id: string;
  source: 'ONLINE' | 'OFFLINE';
  status: 'COMPLETED' | 'PENDING';
  is_gst: boolean; // true = GST invoice, false = non-GST bill
  subtotal: number; // GST-inclusive (line price × qty)
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  discount_amount: number;
  gst_percentage: number;
  gst_amount: number; // GST inside subtotal-discount (derived)
  delivery_fee: number;
  grand_total: number; // = subtotal - discount + delivery
  cash_received: number; // total amount tendered (cash for CASH, gpay amount for GPAY, cash+gpay for SPLIT)
  split_cash: number; // cash portion when payment_mode = SPLIT
  split_gpay: number; // gpay portion when payment_mode = SPLIT
  payment_mode: PaymentMode;
  bill_date: string;
  created_at: string;
  coupon_code?: string | null;
  remarks?: string | null;
  reference_number?: string | null;
  is_credit?: boolean;
  credit_status?: 'outstanding' | 'paid' | null;
  credit_due_date?: string | null;
  credit_paid_at?: string | null;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  snapshot_name: string;
  snapshot_price: number;
  quantity: number;
};

export type OrderWithRelations = OrderRow & {
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  items: OrderItemRow[];
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: string; // CASH | UPI | CARD | BANK | OTHER
  notes: string | null;
  expense_date: string;
  created_at: string;
};

export type AdvanceOrderStatus = 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type AdvanceOrderRow = {
  id: string;
  customer_id: string;
  status: AdvanceOrderStatus;
  subtotal: number;
  total_amount: number;
  deposit_amount: number;
  deposit_payment_mode: PaymentMode;
  delivery_date: string | null;
  notes: string | null;
  finalized_order_id: string | null;
  finalized_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type AdvanceOrderItemRow = {
  id: string;
  advance_order_id: string;
  product_id: string | null;
  snapshot_name: string;
  snapshot_desc: string | null;
  snapshot_price: number;
  quantity: number;
};

export type AdvanceOrderWithRelations = AdvanceOrderRow & {
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  items: AdvanceOrderItemRow[];
};

export type CartItem = {
  id: string;
  product_id: string | null;
  name: string;
  desc: string;
  price: number;
  qty: number;
  sku?: string;
  unit?: string;
};
