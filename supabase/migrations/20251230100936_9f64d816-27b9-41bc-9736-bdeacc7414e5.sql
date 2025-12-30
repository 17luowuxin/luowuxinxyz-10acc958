-- Add ringtone_url field to characters table
ALTER TABLE public.characters
ADD COLUMN ringtone_url TEXT NULL;