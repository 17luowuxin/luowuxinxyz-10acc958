-- Add video_background_url column to customization table
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS video_background_url TEXT;