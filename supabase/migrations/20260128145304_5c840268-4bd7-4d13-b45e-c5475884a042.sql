-- Add auto_reply_enabled column to characters table
ALTER TABLE public.characters 
ADD COLUMN auto_reply_enabled boolean DEFAULT false;