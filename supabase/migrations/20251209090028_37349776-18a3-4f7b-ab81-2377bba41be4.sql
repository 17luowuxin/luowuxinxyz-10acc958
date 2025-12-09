-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create diaries table for diary feature
CREATE TABLE public.diaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'happy',
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for diaries
CREATE POLICY "Users can manage own diaries"
ON public.diaries
FOR ALL
USING (auth.uid() = user_id);

-- Create presets table for character presets
CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

-- RLS policies for presets
CREATE POLICY "Users can manage own presets"
ON public.presets
FOR ALL
USING (auth.uid() = user_id);

-- Create world_books table for world settings
CREATE TABLE public.world_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.world_books ENABLE ROW LEVEL SECURITY;

-- RLS policies for world_books
CREATE POLICY "Users can manage own world_books"
ON public.world_books
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for diaries updated_at
CREATE TRIGGER update_diaries_updated_at
BEFORE UPDATE ON public.diaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();