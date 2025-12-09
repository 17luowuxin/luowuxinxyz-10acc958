-- Add is_user_post column to moments table to mark user-created posts
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS is_user_post boolean DEFAULT false;