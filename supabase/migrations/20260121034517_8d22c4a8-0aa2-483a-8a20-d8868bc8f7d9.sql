-- 创建角色拉黑表
CREATE TABLE public.character_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, character_id)
);

-- 启用 RLS
ALTER TABLE public.character_blocks ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can manage own character blocks"
ON public.character_blocks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 更新时间触发器
CREATE TRIGGER update_character_blocks_updated_at
BEFORE UPDATE ON public.character_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 启用 realtime 以便前端监听
ALTER PUBLICATION supabase_realtime ADD TABLE public.character_blocks;