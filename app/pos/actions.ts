"use server";

import { dbStore } from "@/lib/dbStore";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { validateCoupon } from "@/lib/services/couponService";
import { Product, OrderWithRelations, CartItem, Expense, PaymentMode, Category, AdvanceOrderWithRelations, AdvanceOrderStatus } from "@/lib/types";

// Helper to serialize Date objects from Postgres to strings
function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

export async function verifyPasscode(enteredPasscode: string): Promise<{ success: boolean; role?: 'staff' | 'admin' }> {
  const adminPasscode = process.env.ADMIN_PASSCODE || "admin123";
  const staffPasscode = process.env.STAFF_PASSCODE || process.env.NEXT_PUBLIC_STAFF_PASSCODE || "staff123";

  const normalizedEntered = enteredPasscode.replace(/\s/g, "");

  if (normalizedEntered === adminPasscode) {
    return { success: true, role: 'admin' };
  }
  if (normalizedEntered === staffPasscode) {
    return { success: true, role: 'staff' };
  }

  return { success: false };
}

// Categories
export async function fetchCategories(): Promise<Category[]> {
  return serialize(await dbStore.listCategories());
}

export async function createCategory(name: string): Promise<Category> {
  return serialize(await dbStore.addCategory(name.trim()));
}

export async function renameCategory(id: string, name: string): Promise<Category | null> {
  return serialize(await dbStore.updateCategory(id, name.trim()));
}

export async function removeCategory(id: string): Promise<void> {
  return await dbStore.deleteCategory(id);
}

// Products
export async function fetchProducts(): Promise<Product[]> {
  return serialize(await dbStore.listProducts());
}

export async function createProduct(data: {
  name: string;
  description: string | null;
  category: string;
  gst_rate: number;
  hsn_code: string | null;
  selling_price: number;
  sku?: string;
  stock_quantity?: number;
  low_stock_alert?: number;
  purchase_price?: number;
  item_type?: 'product' | 'service';
}): Promise<Product> {
  return serialize(await dbStore.addProduct(data));
}

export async function editProduct(id: string, data: Partial<Product>): Promise<Product | null> {
  return serialize(await dbStore.updateProduct(id, data));
}

export async function removeProduct(id: string): Promise<void> {
  return await dbStore.deleteProduct(id);
}

export async function adjustProductStock(data: {
  productId: string | number;
  adjustment: number;
  reason: string;
  referenceId?: string;
  oldQuantity: number;
  newQuantity: number;
}): Promise<void> {
  return await dbStore.adjustStock(data);
}

export async function seedCatalog(): Promise<{
  categoriesSeeded: number;
  productsSeeded: number;
  duplicatesRemoved: number;
  errors: string[];
}> {
  return serialize(await dbStore.seedCatalog());
}

// Orders
export async function fetchOrders(): Promise<OrderWithRelations[]> {
  return serialize(await dbStore.listOrdersWithRelations());
}

export async function fetchOrderById(id: string): Promise<OrderWithRelations | null> {
  return serialize(await dbStore.getOrderWithRelations(id));
}

export async function orderIdExists(id: string): Promise<boolean> {
  return await dbStore.orderIdExists(id);
}

export async function submitOrder(payload: {
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
  couponCode?: string | null;
  remarks?: string | null;
  referenceNumber?: string | null;
  creditDueDate?: string | null;
}): Promise<{ orderId: string; id?: string; invoiceNo?: string }> {
  return await dbStore.submitOrder(payload);
}

export async function removeOrder(id: string): Promise<void> {
  return await dbStore.deleteOrder(id);
}

export async function markCreditOrderPaid(orderId: string): Promise<void> {
  return await dbStore.markCreditOrderPaid(orderId);
}

export async function updateCreditDueDate(orderId: string, dueDate: string): Promise<void> {
  return await dbStore.updateCreditDueDate(orderId, dueDate);
}

// Expenses
export async function fetchExpenses(): Promise<Expense[]> {
  return serialize(await dbStore.listExpenses());
}

export async function createExpense(data: {
  id?: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string | null;
  expense_date: string;
}): Promise<Expense> {
  return serialize(await dbStore.addExpense(data));
}

export async function editExpense(id: string, data: Partial<Expense>): Promise<Expense | null> {
  return serialize(await dbStore.updateExpense(id, data));
}

export async function removeExpense(id: string): Promise<void> {
  return await dbStore.deleteExpense(id);
}

// Advance Orders (partial-payment holds)
export async function fetchAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
  return serialize(await dbStore.listAdvanceOrders());
}

export async function fetchAdvanceOrderById(id: string): Promise<AdvanceOrderWithRelations | null> {
  return serialize(await dbStore.getAdvanceOrder(id));
}

export async function advanceOrderIdExists(id: string): Promise<boolean> {
  return await dbStore.advanceOrderIdExists(id);
}

export async function createAdvanceOrder(payload: {
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
  return await dbStore.createAdvanceOrder(payload);
}

export async function setAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
  return await dbStore.updateAdvanceOrderStatus(id, status);
}

export async function cancelAdvanceOrder(id: string): Promise<void> {
  return await dbStore.cancelAdvanceOrder(id);
}

export async function removeAdvanceOrder(id: string): Promise<void> {
  return await dbStore.deleteAdvanceOrder(id);
}

export async function finalizeAdvanceOrder(payload: {
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
  return await dbStore.finalizeAdvanceOrder(payload);
}

// Coupon validation & management
export async function checkCoupon(code: string, subtotal: number) {
  return await validateCoupon(code, subtotal);
}

export async function fetchCoupons() {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, percentage, is_active, expiry_date, usage_limit, usage_count, min_order_value')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return serialize(data || []);
  } catch (err) {
    console.error('Failed to fetch coupons:', err);
    return [];
  }
}

export async function saveCoupon(payload: {
  id?: number | null;
  code: string;
  percentage: number;
  expiry_date?: string | null;
  usage_limit?: number | null;
  min_order_value?: number;
  is_active?: boolean;
}) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const dataPayload: any = {
      percentage: Number(payload.percentage) || 0,
      expiry_date: payload.expiry_date || null,
      usage_limit: payload.usage_limit ? Number(payload.usage_limit) : null,
      min_order_value: Number(payload.min_order_value) || 0,
    };

    if (payload.id) {
      if (typeof payload.is_active === 'boolean') dataPayload.is_active = payload.is_active;
      const { error } = await supabase.from('coupons').update(dataPayload).eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    } else {
      dataPayload.code = payload.code.toUpperCase().trim();
      dataPayload.is_active = true;
      const { error } = await supabase.from('coupons').insert(dataPayload);
      if (error) throw error;
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save coupon' };
  }
}

export async function deleteCoupon(id: number) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete coupon' };
  }
}

export async function toggleCouponActive(id: number, currentStatus: boolean) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle coupon' };
  }
}

// Store settings
export async function fetchStoreSettings() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.from('store_settings').select('*').limit(1).single();
    return serialize(data);
  } catch {
    return null;
  }
}

export async function saveStoreSettings(settings: {
  name: string;
  ownerName: string;
  businessType: string;
  phone: string;
  shopContact: string;
  email: string;
  address: string;
  instagramId: string;
  logoUrl?: string;
  cardColor?: string;
}) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not connected' };
  try {
    const payload = {
      name: settings.name,
      owner_name: settings.ownerName,
      business_type: settings.businessType,
      phone: settings.phone,
      shop_contact: settings.shopContact,
      email: settings.email,
      address: settings.address,
      instagram_id: settings.instagramId,
      logo_url: settings.logoUrl || '/logo.png',
      card_color: settings.cardColor || '#F500A0',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('store_settings').upsert({ id: 1, ...payload });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save settings' };
  }
}
