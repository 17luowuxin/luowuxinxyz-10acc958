-- Add reply and character_name columns to bottles table
ALTER TABLE public.bottles 
ADD COLUMN IF NOT EXISTS reply TEXT,
ADD COLUMN IF NOT EXISTS character_name TEXT;