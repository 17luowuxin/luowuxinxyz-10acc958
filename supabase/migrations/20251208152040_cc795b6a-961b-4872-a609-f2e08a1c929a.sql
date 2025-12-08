-- Add lock screen background and app icons to customization table
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS lock_screen_bg_url TEXT,
ADD COLUMN IF NOT EXISTS app_icons JSONB DEFAULT '{}'::jsonb;