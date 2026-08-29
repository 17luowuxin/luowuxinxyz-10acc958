-- =====================================================
-- 外部 Supabase 数据库结构迁移脚本
-- 项目: 梦境小手机 (Dream Phone)
-- 目标: https://lxbusdoqghkcajlctbqg.supabase.co
-- =====================================================

-- 1. 创建枚举类型
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. 创建基础函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 3. 创建用户相关表
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  nickname TEXT,
  avatar_url TEXT,
  persona TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  theme TEXT,
  bubble_color TEXT,
  bubble_style TEXT,
  bubble_opacity REAL,
  bubble_size REAL,
  bubble_frame_url TEXT,
  font_color TEXT,
  font_family TEXT,
  avatar_frame_url TEXT,
  friend_avatar_frame_url TEXT,
  friend_bubble_color TEXT,
  friend_bubble_frame_url TEXT,
  friend_font_color TEXT,
  chat_background_url TEXT,
  global_background_url TEXT,
  global_text_color TEXT,
  global_text_size REAL,
  video_background_url TEXT,
  lock_screen_bg_url TEXT,
  lock_screen_video_url TEXT,
  space_background_url TEXT,
  group_chat_background_url TEXT,
  music_cover_url TEXT,
  novel_dialogue_color TEXT,
  novel_action_color TEXT,
  novel_thought_color TEXT,
  novel_narration_color TEXT,
  app_icons JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. 创建角色相关表
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  persona TEXT,
  avatar_url TEXT,
  sprite_url TEXT,
  opening_line TEXT,
  voice_id TEXT,
  voice_mode TEXT,
  reply_mode TEXT,
  history_limit INTEGER,
  auto_reply_enabled BOOLEAN DEFAULT false,
  sticker_enabled BOOLEAN DEFAULT true,
  transfer_enabled BOOLEAN DEFAULT true,
  use_novel_format BOOLEAN DEFAULT false,
  online_message_count TEXT,
  ringtone_url TEXT,
  call_video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.character_sprites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emotion TEXT DEFAULT 'neutral',
  sprite_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.character_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.character_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. 创建聊天相关表
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  audio_url TEXT,
  quoted_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. 创建群聊相关表
CREATE TABLE public.group_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  lively_mode BOOLEAN DEFAULT false,
  interaction_settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. 创建朋友圈相关表
CREATE TABLE public.moments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  image_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_user_post BOOLEAN DEFAULT false,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_character_reply BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. 创建其他功能表
CREATE TABLE public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.diaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.music (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.bottles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  character_name TEXT,
  is_picked BOOLEAN DEFAULT false,
  picked_by UUID,
  reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.guestbook (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.guestbook(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_character_reply BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.world_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.user_stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.dream_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name TEXT NOT NULL,
  amount REAL NOT NULL,
  message TEXT,
  is_received BOOLEAN DEFAULT true,
  is_user_transfer BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.gift_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_category TEXT NOT NULL,
  gift_color TEXT NOT NULL,
  gift_price REAL NOT NULL,
  custom_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.gift_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_price REAL NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.gift_custom_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gift_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.space_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.vn_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  name TEXT DEFAULT 'Save',
  messages JSONB DEFAULT '[]',
  current_index INTEGER,
  background_url TEXT,
  user_sprite_url TEXT,
  story_settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.pending_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  request_context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. 创建管理相关表（这些不需要 RLS，因为只有管理员访问）
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  wechat_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  preview_url TEXT,
  global_background_url TEXT,
  chat_background_url TEXT,
  lock_screen_bg_url TEXT,
  lock_screen_video_url TEXT,
  video_background_url TEXT,
  app_icon_url TEXT,
  app_icons JSONB,
  desktop_widgets TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. 创建触发器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customization_updated_at
  BEFORE UPDATE ON public.customization
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_sprites_updated_at
  BEFORE UPDATE ON public.character_sprites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_memories_updated_at
  BEFORE UPDATE ON public.character_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_blocks_updated_at
  BEFORE UPDATE ON public.character_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diaries_updated_at
  BEFORE UPDATE ON public.diaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_space_logs_updated_at
  BEFORE UPDATE ON public.space_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vn_saves_updated_at
  BEFORE UPDATE ON public.vn_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_messages_updated_at
  BEFORE UPDATE ON public.pending_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. 创建新用户触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.customization (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 12. 创建 auth 触发器（在 auth.users 上）
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_user_role();

-- 13. 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sprites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dream_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_custom_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vn_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 14. 创建 RLS 策略
-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Customization
CREATE POLICY "Users can view own customization" ON public.customization FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own customization" ON public.customization FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customization" ON public.customization FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Characters
CREATE POLICY "Users can view own characters" ON public.characters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own characters" ON public.characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own characters" ON public.characters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own characters" ON public.characters FOR DELETE USING (auth.uid() = user_id);

-- Character Sprites
CREATE POLICY "Users can view own sprites" ON public.character_sprites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sprites" ON public.character_sprites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sprites" ON public.character_sprites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sprites" ON public.character_sprites FOR DELETE USING (auth.uid() = user_id);

-- Character Memories
CREATE POLICY "Users can view own memories" ON public.character_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memories" ON public.character_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.character_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.character_memories FOR DELETE USING (auth.uid() = user_id);

-- Character Blocks
CREATE POLICY "Users can view own blocks" ON public.character_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own blocks" ON public.character_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blocks" ON public.character_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blocks" ON public.character_blocks FOR DELETE USING (auth.uid() = user_id);

-- Chat Messages
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Chat Read Status
CREATE POLICY "Users can view own read status" ON public.chat_read_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own read status" ON public.chat_read_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own read status" ON public.chat_read_status FOR UPDATE USING (auth.uid() = user_id);

-- Group Chats
CREATE POLICY "Users can view own groups" ON public.group_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own groups" ON public.group_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON public.group_chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON public.group_chats FOR DELETE USING (auth.uid() = user_id);

-- Group Members (通过 group 关联到 user)
CREATE POLICY "Users can view group members" ON public.group_members FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert group members" ON public.group_members FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete group members" ON public.group_members FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND user_id = auth.uid()));

-- Group Messages
CREATE POLICY "Users can view group messages" ON public.group_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert group messages" ON public.group_messages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_chats WHERE id = group_id AND user_id = auth.uid()));

-- Moments
CREATE POLICY "Users can view own moments" ON public.moments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own moments" ON public.moments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own moments" ON public.moments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own moments" ON public.moments FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Users can view own comments" ON public.comments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Albums
CREATE POLICY "Users can view own albums" ON public.albums FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own albums" ON public.albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own albums" ON public.albums FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own albums" ON public.albums FOR DELETE USING (auth.uid() = user_id);

-- Photos
CREATE POLICY "Users can view own photos" ON public.photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own photos" ON public.photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own photos" ON public.photos FOR DELETE USING (auth.uid() = user_id);

-- Diaries
CREATE POLICY "Users can view own diaries" ON public.diaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diaries" ON public.diaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diaries" ON public.diaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diaries" ON public.diaries FOR DELETE USING (auth.uid() = user_id);

-- Music
CREATE POLICY "Users can view own music" ON public.music FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own music" ON public.music FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own music" ON public.music FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own music" ON public.music FOR DELETE USING (auth.uid() = user_id);

-- Bottles (漂流瓶可以被其他人捞取)
CREATE POLICY "Users can view bottles" ON public.bottles FOR SELECT USING (true);
CREATE POLICY "Users can insert own bottles" ON public.bottles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update bottles" ON public.bottles FOR UPDATE USING (true);

-- Guestbook
CREATE POLICY "Users can view own guestbook" ON public.guestbook FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own guestbook" ON public.guestbook FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own guestbook" ON public.guestbook FOR DELETE USING (auth.uid() = user_id);

-- Presets
CREATE POLICY "Users can view own presets" ON public.presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own presets" ON public.presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presets" ON public.presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presets" ON public.presets FOR DELETE USING (auth.uid() = user_id);

-- World Books
CREATE POLICY "Users can view own world books" ON public.world_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own world books" ON public.world_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own world books" ON public.world_books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own world books" ON public.world_books FOR DELETE USING (auth.uid() = user_id);

-- API Keys
CREATE POLICY "Users can view own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

-- User Stickers
CREATE POLICY "Users can view own stickers" ON public.user_stickers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stickers" ON public.user_stickers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stickers" ON public.user_stickers FOR DELETE USING (auth.uid() = user_id);

-- Dream Transactions
CREATE POLICY "Users can view own transactions" ON public.dream_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.dream_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gift Favorites
CREATE POLICY "Users can view own gift favorites" ON public.gift_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gift favorites" ON public.gift_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own gift favorites" ON public.gift_favorites FOR DELETE USING (auth.uid() = user_id);

-- Gift History
CREATE POLICY "Users can view own gift history" ON public.gift_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gift history" ON public.gift_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gift Custom Images
CREATE POLICY "Users can view own gift images" ON public.gift_custom_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gift images" ON public.gift_custom_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gift images" ON public.gift_custom_images FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gift images" ON public.gift_custom_images FOR DELETE USING (auth.uid() = user_id);

-- Space Logs
CREATE POLICY "Users can view own space logs" ON public.space_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own space logs" ON public.space_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own space logs" ON public.space_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own space logs" ON public.space_logs FOR DELETE USING (auth.uid() = user_id);

-- VN Saves
CREATE POLICY "Users can view own vn saves" ON public.vn_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vn saves" ON public.vn_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vn saves" ON public.vn_saves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vn saves" ON public.vn_saves FOR DELETE USING (auth.uid() = user_id);

-- Pending Messages
CREATE POLICY "Users can view own pending messages" ON public.pending_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pending messages" ON public.pending_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending messages" ON public.pending_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pending messages" ON public.pending_messages FOR DELETE USING (auth.uid() = user_id);

-- Push Subscriptions
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Announcements (公开读取)
CREATE POLICY "Anyone can view active announcements" ON public.announcements FOR SELECT USING (is_active = true);

-- Themes (公开读取)
CREATE POLICY "Anyone can view active themes" ON public.themes FOR SELECT USING (is_active = true);

-- Invite Codes (仅服务端访问，无需客户端 RLS)
CREATE POLICY "Service role can manage invite codes" ON public.invite_codes FOR ALL USING (true);

-- 15. 创建 Storage 桶
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds', 'backgrounds', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('music', 'music', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('themes', 'themes', true);

-- Storage RLS 策略
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
