-- Add global text color and size columns to customization table
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS global_text_color text DEFAULT '#333333',
ADD COLUMN IF NOT EXISTS global_text_size integer DEFAULT 16;