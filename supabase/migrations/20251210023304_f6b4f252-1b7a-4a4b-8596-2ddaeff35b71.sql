-- 添加默认音乐封面字段到 customization 表
ALTER TABLE public.customization 
ADD COLUMN music_cover_url text DEFAULT NULL;