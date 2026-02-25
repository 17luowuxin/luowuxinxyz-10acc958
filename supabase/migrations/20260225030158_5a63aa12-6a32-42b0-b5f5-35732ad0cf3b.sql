DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'character_blocks_user_character_unique'
  ) THEN
    ALTER TABLE public.character_blocks ADD CONSTRAINT character_blocks_user_character_unique UNIQUE (user_id, character_id);
  END IF;
END $$;