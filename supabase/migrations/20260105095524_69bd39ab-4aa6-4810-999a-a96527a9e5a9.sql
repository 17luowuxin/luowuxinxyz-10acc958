-- 创建视觉小说存档表
CREATE TABLE public.vn_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '存档',
  story_settings JSONB DEFAULT '{}'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  background_url TEXT,
  user_sprite_url TEXT,
  current_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.vn_saves ENABLE ROW LEVEL SECURITY;

-- 用户只能管理自己的存档
CREATE POLICY "Users can manage own vn_saves" 
ON public.vn_saves 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 自动更新时间戳
CREATE TRIGGER update_vn_saves_updated_at
BEFORE UPDATE ON public.vn_saves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();