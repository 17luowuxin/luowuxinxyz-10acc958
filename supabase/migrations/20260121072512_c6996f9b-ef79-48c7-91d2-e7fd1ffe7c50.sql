-- Add novel mode color columns to customization table
ALTER TABLE public.customization
ADD COLUMN IF NOT EXISTS novel_dialogue_color text DEFAULT '#e91e63',
ADD COLUMN IF NOT EXISTS novel_narration_color text DEFAULT '#666666',
ADD COLUMN IF NOT EXISTS novel_action_color text DEFAULT '#9c27b0',
ADD COLUMN IF NOT EXISTS novel_thought_color text DEFAULT '#607d8b';