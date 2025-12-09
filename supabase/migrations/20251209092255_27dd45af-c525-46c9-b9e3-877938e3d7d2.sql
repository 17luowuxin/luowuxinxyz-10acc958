-- Add font_family column to customization table for global font selection
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'default';

-- Add group_chat_background_url for group chat specific background
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS group_chat_background_url text;