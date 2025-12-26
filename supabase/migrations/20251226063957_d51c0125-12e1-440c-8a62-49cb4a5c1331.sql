-- 删除现有策略并重新创建为PERMISSIVE策略
DROP POLICY IF EXISTS "Users can manage their own stickers" ON public.user_stickers;

-- 创建分开的策略确保所有操作都能正常工作
CREATE POLICY "Users can view their own stickers" 
ON public.user_stickers 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stickers" 
ON public.user_stickers 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stickers" 
ON public.user_stickers 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stickers" 
ON public.user_stickers 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);