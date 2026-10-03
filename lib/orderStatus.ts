// Shared order status constants and lifecycle definitions
// Single source of truth for order statuses across the application

export const ORDER_STATUS = {
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  READY: 'READY',
} as const;

export const STATUS = ORDER_STATUS;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ADVANCE_STATUS_DB = {
  PENDING: 'pending_deposit',
  READY: 'ready_for_delivery',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const CREDIT_STATUS = {
  OUTSTANDING: 'outstanding',
  PAID: 'paid',
} as const;

export type CreditStatus = typeof CREDIT_STATUS[keyof typeof CREDIT_STATUS];

export const PAYMENT_METHOD = {
  CASH: 'CASH',
  GPAY: 'GPAY',
  SPLIT: 'SPLIT',
  CREDIT: 'CREDIT',
} as const;

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

/**
 * Derived rule: An invoice is an unsettled credit if it is a credit sale
 * and its status is NOT COMPLETED.
 */
export function isUnsettledCreditOrder(order: {
  payment_method?: string | null;
  payment_mode?: string | null;
  is_credit?: boolean | null;
  status?: string | null;
  credit_status?: string | null;
}): boolean {
  const method = String(order.payment_method || order.payment_mode || '').toUpperCase();
  const isCredit = method === 'CREDIT' || Boolean(order.is_credit);
  const statusUpper = String(order.status || '').toUpperCase();
  return isCredit && statusUpper !== ORDER_STATUS.COMPLETED;
}

/**
 * Derived invoice title rule:
 * "CREDIT INVOICE" until the order is COMPLETED, and only then "TAX INVOICE".
 */
export function getInvoiceTitle(order: {
  payment_method?: string | null;
  payment_mode?: string | null;
  is_credit?: boolean | null;
  status?: string | null;
  credit_status?: string | null;
}): 'CREDIT INVOICE' | 'TAX INVOICE' {
  return isUnsettledCreditOrder(order) ? 'CREDIT INVOICE' : 'TAX INVOICE';
}
