-- 添加头像框和气泡框URL字段
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS avatar_frame_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS friend_avatar_frame_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bubble_frame_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS friend_bubble_frame_url TEXT DEFAULT NULL;