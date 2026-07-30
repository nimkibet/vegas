-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR VEGAS POS DASHBOARD
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard.
-- 2. Navigate to the SQL Editor.
-- 3. Paste the following SQL commands and run them.
-- 
-- These policies ensure that only authenticated users (e.g., the owner)
-- can view or edit the sensitive financial data in the debtors and
-- supplier_transactions tables.

-- 1. Enable RLS on the tables
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for the debtors table
-- Allow authenticated users to SELECT (read)
CREATE POLICY "Allow authenticated read access on debtors"
ON public.debtors
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to UPDATE (edit credit limits, etc)
CREATE POLICY "Allow authenticated update access on debtors"
ON public.debtors
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to INSERT (sync from local POS)
CREATE POLICY "Allow authenticated insert access on debtors"
ON public.debtors
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Create policies for the supplier_transactions table
-- Allow authenticated users to SELECT (read)
CREATE POLICY "Allow authenticated read access on supplier_transactions"
ON public.supplier_transactions
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to INSERT (sync from local POS)
CREATE POLICY "Allow authenticated insert access on supplier_transactions"
ON public.supplier_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE
CREATE POLICY "Allow authenticated update access on supplier_transactions"
ON public.supplier_transactions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
