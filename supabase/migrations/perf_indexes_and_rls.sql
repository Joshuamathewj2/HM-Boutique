-- ============================================================================
-- Migration: perf_indexes_and_rls.sql
-- Description: Performance indexes for Advance Orders & Order History pages.
--   Fixes:
--     1. Partial index for COMPLETED orders (Order History query)
--     2. Partial index for ADVANCE orders (Advance Orders query — replaces ILIKE)
--     3. Composite index for order_type + created_at (ORDER BY support)
--     4. order_items.order_id index (join key for nested select)
--   Safe to run on live DB — uses CONCURRENTLY where possible.
-- ============================================================================

-- 1. Partial index: completed orders (Order History page filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_completed_at
  ON public.orders (created_at DESC)
  WHERE status = 'COMPLETED';

-- 2. Partial index: advance orders (Advance Orders page filter)
--    Replaces the slow ILIKE on invoice_no
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_is_advance_at
  ON public.orders (created_at DESC)
  WHERE is_advance = true;

-- 3. Composite index: order_type + created_at for advance orders fallback
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_type_at
  ON public.orders (order_type, created_at DESC);

-- 4. order_items join key (foreign key should have an index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- 5. Index on status + created_at for general filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_at
  ON public.orders (status, created_at DESC);

-- ============================================================================
-- VERIFY (run after applying):
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('orders', 'order_items')
-- ORDER BY tablename, indexname;
-- ============================================================================
