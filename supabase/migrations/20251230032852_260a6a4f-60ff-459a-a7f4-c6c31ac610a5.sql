-- 为chat_messages添加audio_url字段存储语音消息URL
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS audio_url text;

-- 为characters添加call_video_url字段存储视频通话的动态视频
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS call_video_url text;