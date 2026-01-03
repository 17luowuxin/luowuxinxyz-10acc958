-- 为角色添加立绘URL字段
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS sprite_url TEXT;

-- 创建角色多表情立绘表（支持多种表情）
CREATE TABLE IF NOT EXISTS public.character_sprites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emotion TEXT NOT NULL DEFAULT 'normal',
  sprite_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(character_id, emotion)
);

-- 启用 RLS
ALTER TABLE public.character_sprites ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own sprites"
ON public.character_sprites
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sprites"
ON public.character_sprites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sprites"
ON public.character_sprites
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sprites"
ON public.character_sprites
FOR DELETE
USING (auth.uid() = user_id);

-- 添加时间戳触发器
CREATE TRIGGER update_character_sprites_updated_at
BEFORE UPDATE ON public.character_sprites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();