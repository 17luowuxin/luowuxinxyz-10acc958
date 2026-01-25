-- 创建邀请码表
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 管理员可以管理所有邀请码
CREATE POLICY "Admins can manage invite_codes"
  ON public.invite_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- 创建索引加速查询
CREATE INDEX idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX idx_invite_codes_is_used ON public.invite_codes(is_used);