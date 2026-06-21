-- ====================================================================
-- SCHEMA UPDATE FOR PRODUCTS HIERARCHY & UNIT TYPES
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard.
-- 2. Navigate to the SQL Editor.
-- 3. Paste the following SQL commands and run them.
-- 
-- This will add the missing hierarchy columns to the products table,
-- allowing the Java POS to sync portion and packaging metadata,
-- and enabling the Web Dashboard to calculate total consolidated stocks.

-- Add parent_barcode column (linked portion/parent item)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS parent_barcode TEXT;

-- Add unit_type column (e.g., 'Kg', 'Pieces', 'Litre')
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'Pieces';

-- Add parent_wholesale_barcode column (used for auto-conversion hierarchy)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS parent_wholesale_barcode TEXT;

-- Add conversion_yield column (yield when parent converts to child)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS conversion_yield INTEGER DEFAULT 0;

-- Add raw_piece_yield column (pieces yielded by bulk package)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS raw_piece_yield INTEGER DEFAULT 0;

-- Recreate index on parent_barcode for performance
CREATE INDEX IF NOT EXISTS idx_products_parent_barcode ON public.products(parent_barcode);
CREATE INDEX IF NOT EXISTS idx_products_parent_wholesale_barcode ON public.products(parent_wholesale_barcode);
