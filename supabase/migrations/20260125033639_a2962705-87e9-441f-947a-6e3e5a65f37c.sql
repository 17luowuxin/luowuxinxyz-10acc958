-- Create announcements table for dynamic content management
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '公告',
  content text NOT NULL,
  wechat_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
USING (is_active = true);

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default announcement
INSERT INTO public.announcements (title, content, wechat_id, is_active)
VALUES (
  '梦境小手机交流群',
  '玩法分享｜问题求助｜干货领取\n🔥已购宝宝 带付款记录加微信拉你进群！',
  'XxyLxs9201314',
  true
);