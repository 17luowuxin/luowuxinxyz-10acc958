ALTER TABLE public.moments
ADD COLUMN IF NOT EXISTS image_prompts JSONB NOT NULL DEFAULT '[]'::jsonb;
