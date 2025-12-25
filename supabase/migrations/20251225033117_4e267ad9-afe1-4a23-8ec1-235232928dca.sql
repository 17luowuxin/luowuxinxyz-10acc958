-- 创建用户自定义表情包表
CREATE TABLE public.user_stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;

-- 用户只能管理自己的表情包
CREATE POLICY "Users can manage their own stickers"
ON public.user_stickers
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 在characters表添加表情包开关字段
ALTER TABLE public.characters ADD COLUMN sticker_enabled BOOLEAN DEFAULT true;