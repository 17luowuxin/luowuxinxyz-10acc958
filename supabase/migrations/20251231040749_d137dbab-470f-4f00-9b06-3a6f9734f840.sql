
-- 添加 app_icons 字段到 themes 表
ALTER TABLE public.themes 
ADD COLUMN app_icons JSONB DEFAULT '{}'::jsonb;
