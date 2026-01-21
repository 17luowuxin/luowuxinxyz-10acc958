-- 添加已读时间追踪表，记录用户对每个角色的最后已读时间
CREATE TABLE public.chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, character_id)
);

-- 启用 RLS
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can manage own read status" 
ON public.chat_read_status 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 更新时间触发器
CREATE TRIGGER update_chat_read_status_updated_at
BEFORE UPDATE ON public.chat_read_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 添加索引
CREATE INDEX idx_chat_read_status_user_char ON public.chat_read_status(user_id, character_id);