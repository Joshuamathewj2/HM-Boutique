-- ============================================================================
-- Migration: expenses_fix.sql
-- Description: Ensure UUID PK, constraints, updated_at trigger, and RLS policies
-- ============================================================================

-- 1. Ensure primary key is UUID with default gen_random_uuid()
DO $$
BEGIN
  -- Verify pkey default
  ALTER TABLE public.expenses ALTER COLUMN id SET DEFAULT gen_random_uuid();
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 2. Add NOT NULL and CHECK constraints on amount and essential columns
ALTER TABLE public.expenses
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN expense_date SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT check_expense_amount_positive CHECK (amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Ensure updated_at column and auto-refresh trigger exist
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.refresh_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_updated_at_column();

-- 4. Enable Row Level Security (RLS) and define policies for public/authenticated/anon access
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Allow select for all" ON public.expenses;
CREATE POLICY "Allow select for all"
  ON public.expenses
  FOR SELECT
  USING (true);

-- INSERT policy
DROP POLICY IF EXISTS "Allow insert for all" ON public.expenses;
CREATE POLICY "Allow insert for all"
  ON public.expenses
  FOR INSERT
  WITH CHECK (true);

-- UPDATE policy (critical: missing UPDATE policy causes Supabase to return 0 rows affected without error)
DROP POLICY IF EXISTS "Allow update for all" ON public.expenses;
CREATE POLICY "Allow update for all"
  ON public.expenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE policy (critical: missing DELETE policy causes Supabase to silently skip deletion)
DROP POLICY IF EXISTS "Allow delete for all" ON public.expenses;
CREATE POLICY "Allow delete for all"
  ON public.expenses
  FOR DELETE
  USING (true);
