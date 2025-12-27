-- Add voice_mode column to characters for controlling voice output frequency
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS voice_mode text DEFAULT 'off';

-- Add is_user_transfer column to dream_transactions to track if it's a user gift
ALTER TABLE public.dream_transactions 
ADD COLUMN IF NOT EXISTS is_user_transfer boolean DEFAULT false;