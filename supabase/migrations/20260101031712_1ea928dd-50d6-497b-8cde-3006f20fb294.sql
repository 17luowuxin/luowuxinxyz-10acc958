-- 添加管理员可以查看所有profiles的策略
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- 添加管理员可以查看所有characters的策略  
CREATE POLICY "Admins can view all characters" 
ON public.characters 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- 添加管理员可以查看所有chat_messages的策略
CREATE POLICY "Admins can view all messages" 
ON public.chat_messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));