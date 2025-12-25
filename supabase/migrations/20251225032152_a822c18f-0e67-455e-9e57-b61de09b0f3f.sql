-- Create table for storing custom gift images
CREATE TABLE public.gift_custom_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gift_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, gift_id)
);

-- Enable RLS
ALTER TABLE public.gift_custom_images ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own custom images
CREATE POLICY "Users can manage own gift custom images"
ON public.gift_custom_images
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_gift_custom_images_updated_at
BEFORE UPDATE ON public.gift_custom_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();