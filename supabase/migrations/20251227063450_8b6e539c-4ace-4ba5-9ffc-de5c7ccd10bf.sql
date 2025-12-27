-- Add voice_id column to characters table for TTS
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS voice_id text;