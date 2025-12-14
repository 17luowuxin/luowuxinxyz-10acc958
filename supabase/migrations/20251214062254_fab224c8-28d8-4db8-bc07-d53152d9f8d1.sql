-- Create dream_transactions table for storing transfer records
CREATE TABLE public.dream_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  message TEXT,
  is_received BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.dream_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage own transactions" 
ON public.dream_transactions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);