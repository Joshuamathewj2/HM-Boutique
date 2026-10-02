-- ============================================================
-- HM BOUTIQUE — OUTSTANDING CREDITS & SETTLEMENT MIGRATION
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Ensure credit tracking columns exist on the 'orders' table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_credit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'outstanding',
ADD COLUMN IF NOT EXISTS credit_due_date DATE,
ADD COLUMN IF NOT EXISTS credit_paid_at TIMESTAMPTZ;

-- Step 2: Backfill existing credit orders if any
UPDATE public.orders
SET credit_status = 'outstanding', is_credit = true
WHERE (UPPER(payment_mode) = 'CREDIT' OR UPPER(payment_method) = 'CREDIT')
  AND (credit_status IS NULL OR credit_status = '');

-- Step 3: Create index for fast credit queries
CREATE INDEX IF NOT EXISTS idx_orders_credit_status ON public.orders(credit_status);
CREATE INDEX IF NOT EXISTS idx_orders_credit_due_date ON public.orders(credit_due_date);

-- Step 4: Create RPC function to atomically mark a credit order as paid
CREATE OR REPLACE FUNCTION public.mark_credit_order_paid(p_order_id TEXT)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  SELECT * INTO v_order 
  FROM public.orders 
  WHERE id::text = p_order_id OR invoice_no = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  UPDATE public.orders
  SET credit_status = 'paid', 
      credit_paid_at = NOW(), 
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_credit_order_paid(TEXT) TO authenticated, anon, public;
