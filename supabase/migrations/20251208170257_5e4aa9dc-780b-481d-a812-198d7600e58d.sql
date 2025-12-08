-- Add bubble_size and global_background_url columns to customization table
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS bubble_size integer DEFAULT 16,
ADD COLUMN IF NOT EXISTS global_background_url text;