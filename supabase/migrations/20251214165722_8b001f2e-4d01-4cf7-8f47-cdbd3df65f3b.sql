-- 为角色添加回复模式设置
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS reply_mode text DEFAULT 'novel',
ADD COLUMN IF NOT EXISTS online_message_count text DEFAULT '3-5';