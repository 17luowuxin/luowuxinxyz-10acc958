-- Create character_memories table for storing conversation summaries
CREATE TABLE public.character_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(character_id, user_id)
);

-- Enable RLS
ALTER TABLE public.character_memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage own character memories"
ON public.character_memories
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_character_memories_updated_at
BEFORE UPDATE ON public.character_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();