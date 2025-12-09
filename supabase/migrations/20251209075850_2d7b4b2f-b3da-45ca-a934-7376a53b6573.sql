-- Add DELETE policy for moments table
CREATE POLICY "Users can delete own moments" 
ON public.moments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add DELETE policy for comments table
CREATE POLICY "Users can delete own comments" 
ON public.comments 
FOR DELETE 
USING (auth.uid() = user_id);