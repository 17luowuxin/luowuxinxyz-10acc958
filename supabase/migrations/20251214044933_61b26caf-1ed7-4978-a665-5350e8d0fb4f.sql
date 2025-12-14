-- Add space background url field to customization table
ALTER TABLE public.customization 
ADD COLUMN space_background_url text DEFAULT NULL;

-- Create guestbook table for message board feature
CREATE TABLE public.guestbook (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content text NOT NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  is_character_reply boolean DEFAULT false,
  parent_id uuid REFERENCES public.guestbook(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own guestbook" 
ON public.guestbook 
FOR ALL 
USING (auth.uid() = user_id);
