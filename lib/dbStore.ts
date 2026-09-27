import { sql } from './db';
import {
  Product,
  Category,
  Customer,
  OrderRow,
  OrderItemRow,
  OrderWithRelations,
  CartItem,
  Expense,
  PaymentMode,
  AdvanceOrderRow,
  AdvanceOrderItemRow,
  AdvanceOrderStatus,
  AdvanceOrderWithRelations,
} from './types';

// Utility to generate a unique ID
const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const dbStore = {
  // CATEGORIES
  async listCategories(): Promise<Category[]> {
    const rows = await sql`SELECT * FROM categories ORDER BY name ASC`;
    return rows as Category[];
  },

  async addCategory(name: string): Promise<Category> {
    const id = uid();
    const rows = await sql`
      INSERT INTO categories (id, name)
      VALUES (${id}, ${name})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
    `;
    return rows[0] as Category;
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const existing = await sql`SELECT * FROM categories WHERE id = ${id}`;
    if (existing.length === 0) return null;
    const oldName = (existing[0] as Category).name;
    const newName = name.trim();
    if (!newName || newName === oldName) return existing[0] as Category;

    const rows = await sql`
      UPDATE categories SET name = ${newName} WHERE id = ${id} RETURNING *
    `;
    // Keep products in sync — their category is stored as the name string.
    await sql`UPDATE products SET category = ${newName} WHERE category = ${oldName}`;
    return rows[0] as Category;
  },

  async deleteCategory(id: string): Promise<void> {
    await sql`DELETE FROM categories WHERE id = ${id}`;
  },

  // PRODUCTS
  async listProducts(): Promise<Product[]> {
    const rows = await sql`SELECT * FROM products ORDER BY name ASC`;
    return rows as Product[];
  },

  async getProduct(id: string): Promise<Product | null> {
    const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
    return rows.length > 0 ? (rows[0] as Product) : null;
  },

  async addProduct(input: {
    name: string;
    description: string | null;
    category: string;
    gst_rate: number;
    hsn_code: string | null;
    selling_price: number;
  }): Promise<Product> {
    const id = uid();
    const rows = await sql`
      INSERT INTO products (id, name, description, category, gst_rate, hsn_code, selling_price)
      VALUES (
        ${id}, ${input.name}, ${input.description}, ${input.category},
        ${input.gst_rate}, ${input.hsn_code}, ${input.selling_price}
      )
      RETURNING *
    `;
    return rows[0] as Product;
  },

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    if (Object.keys(patch).length === 0) return this.getProduct(id);

    // We update fields individually since dynamic SET with Neon SQL template tag is tricky
    if (patch.name !== undefined) await sql`UPDATE products SET name = ${patch.name} WHERE id = ${id}`;
    if (patch.description !== undefined) await sql`UPDATE products SET description = ${patch.description} WHERE id = ${id}`;
    if (patch.category !== undefined) await sql`UPDATE products SET category = ${patch.category} WHERE id = ${id}`;
    if (patch.gst_rate !== undefined) await sql`UPDATE products SET gst_rate = ${patch.gst_rate} WHERE id = ${id}`;
    if (patch.hsn_code !== undefined) await sql`UPDATE products SET hsn_code = ${patch.hsn_code} WHERE id = ${id}`;
    if (patch.selling_price !== undefined) await sql`UPDATE products SET selling_price = ${patch.selling_price} WHERE id = ${id}`;

    const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
    return rows.length > 0 ? (rows[0] as Product) : null;
  },

  async deleteProduct(id: string): Promise<void> {
    await sql`DELETE FROM products WHERE id = ${id}`;
  },

  // CUSTOMERS
  async upsertCustomer(name: string, phone: string, address?: string | null): Promise<Customer> {
    const id = uid();
    const rows = await sql`
      INSERT INTO customers (id, name, phone, address)
      VALUES (${id}, ${name}, ${phone}, ${address || null})
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
      RETURNING *
    `;
    return rows[0] as Customer;
  },

  // ORDERS
  async orderIdExists(id: string): Promise<boolean> {
    const rows = await sql`SELECT 1 FROM orders WHERE id = ${id} LIMIT 1`;
    return rows.length > 0;
  },

  async listOrdersWithRelations(): Promise<OrderWithRelations[]> {
    const orders = await sql`
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `;

    if (orders.length === 0) return [];

    const orderIds = orders.map((o: any) => o.id);
    const items = await sql`
      SELECT * FROM order_items
      WHERE order_id = ANY(${orderIds})
    `;

    return orders.map((o: any) => ({
      ...o,
      items: items.filter((i: any) => i.order_id === o.id) as OrderItemRow[],
    })) as OrderWithRelations[];
  },

  async getOrderWithRelations(id: string): Promise<OrderWithRelations | null> {
    const orders = await sql`
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ${id}
    `;
    if (orders.length === 0) return null;

    const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`;

    return {
      ...(orders[0] as any),
      items: items as OrderItemRow[],
    } as OrderWithRelations;
  },

  async deleteOrder(id: string): Promise<void> {
    // Order items are removed via ON DELETE CASCADE.
    await sql`DELETE FROM orders WHERE id = ${id}`;
  },

  // EXPENSES
  async listExpenses(): Promise<Expense[]> {
    const rows = await sql`
      SELECT * FROM expenses
      ORDER BY expense_date DESC, created_at DESC
    `;
    return rows as Expense[];
  },

  async addExpense(input: {
    title: string;
    category: string;
    amount: number;
    payment_mode: string;
    notes: string | null;
    expense_date: string;
  }): Promise<Expense> {
    const id = uid();
    const rows = await sql`
      INSERT INTO expenses (id, title, category, amount, payment_mode, notes, expense_date)
      VALUES (
        ${id}, ${input.title}, ${input.category}, ${input.amount},
        ${input.payment_mode}, ${input.notes}, ${input.expense_date}
      )
      RETURNING *
    `;
    return rows[0] as Expense;
  },

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
    if (Object.keys(patch).length === 0) {
      const rows = await sql`SELECT * FROM expenses WHERE id = ${id}`;
      return rows.length > 0 ? (rows[0] as Expense) : null;
    }

    if (patch.title !== undefined) await sql`UPDATE expenses SET title = ${patch.title} WHERE id = ${id}`;
    if (patch.category !== undefined) await sql`UPDATE expenses SET category = ${patch.category} WHERE id = ${id}`;
    if (patch.amount !== undefined) await sql`UPDATE expenses SET amount = ${patch.amount} WHERE id = ${id}`;
    if (patch.payment_mode !== undefined) await sql`UPDATE expenses SET payment_mode = ${patch.payment_mode} WHERE id = ${id}`;
    if (patch.notes !== undefined) await sql`UPDATE expenses SET notes = ${patch.notes} WHERE id = ${id}`;
    if (patch.expense_date !== undefined) await sql`UPDATE expenses SET expense_date = ${patch.expense_date} WHERE id = ${id}`;

    const rows = await sql`SELECT * FROM expenses WHERE id = ${id}`;
    return rows.length > 0 ? (rows[0] as Expense) : null;
  },

  async deleteExpense(id: string): Promise<void> {
    await sql`DELETE FROM expenses WHERE id = ${id}`;
  },

  // ORDER SUBMISSION
  async submitOrder(payload: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    source: 'ONLINE' | 'OFFLINE';
    isGst: boolean;
    billDate: string;
    items: CartItem[];
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    gstPercentage: number;
    gstAmount: number;
    deliveryFee: number;
    grandTotal: number;
    cashReceived: number;
    splitCash?: number;
    splitGpay?: number;
    paymentMode: PaymentMode;
  }): Promise<{ orderId: string }> {
    // Neon HTTP doesn't natively support full interactive transactions in the simple
    // API, so we run statements sequentially/concurrently which is fine at this scale.

    const customer = await this.upsertCustomer(
      payload.customerName,
      payload.customerPhone,
      payload.customerAddress,
    );

    // Each cart line becomes one order item, snapshotting its name and price.
    const finalOrderItems: Omit<OrderItemRow, 'id'>[] = payload.items.map((item) => ({
      order_id: payload.orderId,
      product_id: item.product_id ?? null,
      snapshot_name: item.name,
      snapshot_price: item.price,
      quantity: item.qty,
    }));

    // Subtotal is GST-inclusive (sum of line prices × qty).
    // grand_total = subtotal - discount + delivery  (GST is embedded in subtotal).
    const subtotalInclusive = payload.grandTotal + payload.discountAmount - payload.deliveryFee;

    await sql`
      INSERT INTO orders (
        id, customer_id, source, status, is_gst, subtotal, discount_type, discount_value,
        discount_amount, gst_percentage, gst_amount, delivery_fee, grand_total,
        cash_received, split_cash, split_gpay, payment_mode, bill_date, created_at
      ) VALUES (
        ${payload.orderId}, ${customer.id}, ${payload.source}, 'COMPLETED', ${payload.isGst},
        ${subtotalInclusive},
        ${payload.discountType}, ${payload.discountValue}, ${payload.discountAmount},
        ${payload.gstPercentage}, ${payload.gstAmount}, ${payload.deliveryFee},
        ${payload.grandTotal}, ${payload.cashReceived},
        ${payload.splitCash ?? 0}, ${payload.splitGpay ?? 0},
        ${payload.paymentMode}, ${payload.billDate}, now()
      )
    `;

    // Insert order items now that the order row exists.
    await Promise.all(
      finalOrderItems.map((oi) =>
        sql`
          INSERT INTO order_items (
            id, order_id, product_id, snapshot_name, snapshot_price, quantity
          ) VALUES (
            ${uid()}, ${oi.order_id}, ${oi.product_id},
            ${oi.snapshot_name}, ${oi.snapshot_price}, ${oi.quantity}
          )
        `
      ),
    );

    return { orderId: payload.orderId };
  },

  // ADVANCE ORDERS — partial-payment holds. Revenue is recognized only when the
  // balance is collected and finalizeAdvanceOrder turns the hold into an invoice.
  async listAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
    const rows = await sql`
      SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
      FROM advance_orders a
      JOIN customers c ON c.id = a.customer_id
      ORDER BY a.created_at DESC
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((r: any) => r.id);
    const items = await sql`
      SELECT * FROM advance_order_items WHERE advance_order_id = ANY(${ids})
    `;

    return rows.map((r: any) => ({
      ...r,
      items: (items as AdvanceOrderItemRow[]).filter((i) => i.advance_order_id === r.id),
    })) as AdvanceOrderWithRelations[];
  },

  async getAdvanceOrder(id: string): Promise<AdvanceOrderWithRelations | null> {
    const rows = await sql`
      SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
      FROM advance_orders a
      JOIN customers c ON c.id = a.customer_id
      WHERE a.id = ${id}
    `;
    if (rows.length === 0) return null;
    const items = await sql`SELECT * FROM advance_order_items WHERE advance_order_id = ${id}`;
    return { ...(rows[0] as any), items: items as AdvanceOrderItemRow[] } as AdvanceOrderWithRelations;
  },

  async advanceOrderIdExists(id: string): Promise<boolean> {
    const rows = await sql`SELECT 1 FROM advance_orders WHERE id = ${id} LIMIT 1`;
    return rows.length > 0;
  },

  async createAdvanceOrder(payload: {
    advanceOrderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    subtotal: number;
    totalAmount: number;
    depositAmount: number;
    depositPaymentMode: PaymentMode;
    deliveryDate: string | null;
    notes: string | null;
    items: {
      product_id: string | null;
      snapshot_name: string;
      snapshot_desc: string | null;
      snapshot_price: number;
      quantity: number;
    }[];
  }): Promise<{ advanceOrderId: string }> {
    const customer = await this.upsertCustomer(
      payload.customerName,
      payload.customerPhone,
      payload.customerAddress,
    );

    await sql`
      INSERT INTO advance_orders (
        id, customer_id, status, subtotal, total_amount, deposit_amount,
        deposit_payment_mode, delivery_date, notes
      ) VALUES (
        ${payload.advanceOrderId}, ${customer.id}, 'PENDING',
        ${payload.subtotal}, ${payload.totalAmount}, ${payload.depositAmount},
        ${payload.depositPaymentMode}, ${payload.deliveryDate}, ${payload.notes}
      )
    `;

    await Promise.all(
      payload.items.map((it) =>
        sql`
          INSERT INTO advance_order_items (
            id, advance_order_id, product_id, snapshot_name, snapshot_desc, snapshot_price, quantity
          ) VALUES (
            ${uid()}, ${payload.advanceOrderId}, ${it.product_id},
            ${it.snapshot_name}, ${it.snapshot_desc}, ${it.snapshot_price}, ${it.quantity}
          )
        `,
      ),
    );

    return { advanceOrderId: payload.advanceOrderId };
  },

  async updateAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
    await sql`UPDATE advance_orders SET status = ${status} WHERE id = ${id}`;
  },

  async cancelAdvanceOrder(id: string): Promise<void> {
    await sql`
      UPDATE advance_orders
      SET status = 'CANCELLED', cancelled_at = now()
      WHERE id = ${id}
    `;
  },

  async deleteAdvanceOrder(id: string): Promise<void> {
    await sql`DELETE FROM advance_orders WHERE id = ${id}`;
  },

  // Collect the remaining balance and turn the hold into a real invoice.
  // Reuses submitOrder for revenue recognition.
  async finalizeAdvanceOrder(payload: {
    advanceOrderId: string;
    invoiceId: string;
    isGst: boolean;
    gstPercentage: number;
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    deliveryFee: number;
    paymentMode: PaymentMode;
    billDate: string;
  }): Promise<{ orderId: string }> {
    const advance = await this.getAdvanceOrder(payload.advanceOrderId);
    if (!advance) throw new Error('Advance order not found');
    if (advance.status === 'COMPLETED') throw new Error('Advance order already finalized');
    if (advance.status === 'CANCELLED') throw new Error('Advance order was cancelled');

    // Rebuild cart from the stored snapshot items.
    const cart: CartItem[] = advance.items.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      name: it.snapshot_name,
      desc: it.snapshot_desc || '',
      price: Number(it.snapshot_price),
      qty: it.quantity,
    }));

    // Grand total math mirrors POSBilling.completeSale (GST-inclusive subtotal).
    const rawSubtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const netInclusive = Math.max(0, rawSubtotal - payload.discountAmount);
    const gstAmount =
      payload.isGst && payload.gstPercentage > 0
        ? netInclusive - netInclusive / (1 + payload.gstPercentage / 100)
        : 0;
    const grandTotal = netInclusive + payload.deliveryFee;

    const { orderId } = await this.submitOrder({
      orderId: payload.invoiceId,
      customerName: advance.customer_name,
      customerPhone: advance.customer_phone,
      customerAddress: advance.customer_address,
      source: 'OFFLINE',
      isGst: payload.isGst,
      billDate: payload.billDate,
      items: cart,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      gstPercentage: payload.isGst ? payload.gstPercentage : 0,
      gstAmount,
      deliveryFee: payload.deliveryFee,
      grandTotal,
      cashReceived: grandTotal,
      paymentMode: payload.paymentMode,
    });

    await sql`
      UPDATE advance_orders
      SET status = 'COMPLETED', finalized_order_id = ${orderId}, finalized_at = now()
      WHERE id = ${payload.advanceOrderId}
    `;

    return { orderId };
  },
};
