-- 添加锁屏视频壁纸URL字段
ALTER TABLE public.customization 
ADD COLUMN IF NOT EXISTS lock_screen_video_url TEXT DEFAULT NULL;