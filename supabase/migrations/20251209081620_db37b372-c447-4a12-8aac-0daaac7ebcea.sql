-- Add UPDATE and DELETE policies for bottles table
CREATE POLICY "Users can update own bottles" 
ON public.bottles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bottles" 
ON public.bottles 
FOR DELETE 
USING (auth.uid() = user_id);