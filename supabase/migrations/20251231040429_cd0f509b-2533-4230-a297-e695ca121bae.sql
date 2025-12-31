
-- 添加一个允许用户插入自己角色的策略
CREATE POLICY "Users can insert own roles"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
