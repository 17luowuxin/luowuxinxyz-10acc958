-- 给 characters 表添加角色级别的设置字段
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS history_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS transfer_enabled boolean DEFAULT true;