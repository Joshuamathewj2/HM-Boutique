-- ============================================================================
-- Migration: fix_lifecycle.sql
-- Description: Standardize Order Lifecycle, Backfill Statuses, & Cleanup
-- ============================================================================

-- 1. Backfill legacy POS sales (Cash, GPay, Split) that have a NULL status to 'COMPLETED'
UPDATE public.orders
SET status = 'COMPLETED'
WHERE status IS NULL
  AND coalesce(is_advance, false) = false
  AND coalesce(is_credit, false) = false
  AND coalesce(payment_method, '') <> 'CREDIT';

-- 2. Identification Query (FOR REVIEW ONLY - DO NOT AUTO-RUN):
-- Find any credit rows currently marked COMPLETED whose balance was never paid:
--
-- SELECT id, invoice_no, customer_name, total, amount_paid, balance_due, status, credit_status, created_at
-- FROM public.orders
-- WHERE is_credit = true
--   AND (balance_due > 0 OR amount_paid < total)
--   AND status = 'COMPLETED';
--
-- Approved correction UPDATE (run only after user confirmation):
-- UPDATE public.orders
-- SET status = 'PENDING', credit_status = 'outstanding', updated_at = now()
-- WHERE is_credit = true
--   AND (balance_due > 0 OR amount_paid < total)
--   AND status = 'COMPLETED';

-- 3. Verify that the temporary status trap trigger has been removed
DROP TRIGGER IF EXISTS trg_trap ON public.orders;
DROP FUNCTION IF EXISTS trap_status_regress();
