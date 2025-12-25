-- Create table for gift favorites (收藏)
CREATE TABLE public.gift_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_price INTEGER NOT NULL,
  gift_color TEXT NOT NULL,
  gift_category TEXT NOT NULL,
  custom_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for gift history (已赠送的礼物)
CREATE TABLE public.gift_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  character_name TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gift_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for gift_favorites
CREATE POLICY "Users can manage own gift favorites"
ON public.gift_favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for gift_history
CREATE POLICY "Users can manage own gift history"
ON public.gift_history
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);