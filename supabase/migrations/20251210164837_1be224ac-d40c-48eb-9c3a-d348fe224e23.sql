-- 添加字体颜色字段到 customization 表
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS font_color TEXT DEFAULT '#333333';
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS friend_font_color TEXT DEFAULT '#333333';