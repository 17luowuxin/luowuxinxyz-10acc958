-- Add desktop_widgets column to themes table for storing 3 desktop large images
ALTER TABLE public.themes 
ADD COLUMN desktop_widgets text[] DEFAULT '{}';

COMMENT ON COLUMN public.themes.desktop_widgets IS 'Array of URLs for 3 desktop widget images';