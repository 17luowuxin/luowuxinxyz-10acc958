
-- First, remove duplicate records keeping only the latest one for each user_id + character_id combination
DELETE FROM public.chat_read_status a
USING public.chat_read_status b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.character_id = b.character_id;

-- Add unique constraint for user_id and character_id
ALTER TABLE public.chat_read_status 
ADD CONSTRAINT chat_read_status_user_character_unique 
UNIQUE (user_id, character_id);
