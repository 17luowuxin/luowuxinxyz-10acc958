
-- 创建角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 创建用户角色表
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 启用 RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 创建安全函数检查用户角色
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 用户角色表的 RLS 策略
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 创建主题表
CREATE TABLE public.themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    preview_url TEXT,
    app_icon_url TEXT,
    chat_background_url TEXT,
    global_background_url TEXT,
    lock_screen_bg_url TEXT,
    lock_screen_video_url TEXT,
    video_background_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- 所有用户可以查看激活的主题
CREATE POLICY "Anyone can view active themes"
ON public.themes
FOR SELECT
USING (is_active = true);

-- 管理员可以管理所有主题
CREATE POLICY "Admins can manage themes"
ON public.themes
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 创建主题存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('themes', 'themes', true);

-- 主题存储策略
CREATE POLICY "Anyone can view theme files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'themes');

CREATE POLICY "Admins can upload theme files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'themes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update theme files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'themes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete theme files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'themes' AND public.has_role(auth.uid(), 'admin'));

-- 创建更新时间触发器
CREATE TRIGGER update_themes_updated_at
BEFORE UPDATE ON public.themes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
