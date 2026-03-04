
-- 角色提取记忆表（个性化分类记忆条目）
CREATE TABLE public.character_extracted_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  category TEXT DEFAULT 'other',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 对话摘要表（每批对话的摘要记录）
CREATE TABLE public.character_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  summary TEXT NOT NULL,
  message_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.character_extracted_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for character_extracted_memories
CREATE POLICY "Users can manage own extracted memories"
ON public.character_extracted_memories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for character_summaries
CREATE POLICY "Users can manage own summaries"
ON public.character_summaries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_extracted_memories_char_user ON public.character_extracted_memories(character_id, user_id);
CREATE INDEX idx_summaries_char_user ON public.character_summaries(character_id, user_id);
