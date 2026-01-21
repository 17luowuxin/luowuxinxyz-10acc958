
-- 创建待处理消息表，用于跟踪需要后台处理的消息
CREATE TABLE public.pending_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 minutes'),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  -- 存储请求需要的上下文
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 启用 RLS
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can manage own pending messages" 
ON public.pending_messages 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 添加索引
CREATE INDEX idx_pending_messages_status ON public.pending_messages(status);
CREATE INDEX idx_pending_messages_expires ON public.pending_messages(expires_at);
CREATE INDEX idx_pending_messages_user ON public.pending_messages(user_id, character_id);

-- 更新时间触发器
CREATE TRIGGER update_pending_messages_updated_at
BEFORE UPDATE ON public.pending_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 创建推送订阅表
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- 启用 RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can manage own push subscriptions" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 更新时间触发器
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
