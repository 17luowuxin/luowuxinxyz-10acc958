import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, Sparkles, Mail, Lock, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'update'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 发送密码重置邮件
  const handleResetPassword = async () => {
    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=update`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('重置密码邮件已发送，请查收邮箱');
      setMode('login');
    }
    setLoading(false);
  };

  // 更新密码
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('密码至少需要6个字符');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('密码修改成功!');
      navigate('/');
    }
    setLoading(false);
  };

  // 检查URL参数是否是重置密码回调
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'update') {
      setMode('update');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('邮箱或密码错误');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('登录成功!');
          const redirectTo = (location.state as { from?: string } | null)?.from || '/';
          navigate(redirectTo, { replace: true });
        }
      } else if (mode === 'signup') {
        if (password.length < 6) {
          toast.error('密码至少需要6个字符');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('该邮箱已注册');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('注册成功!');
          const redirectTo = (location.state as { from?: string } | null)?.from || '/';
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (error: any) {
      toast.error('发生错误，请重试');
    }

    setLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return '欢迎回来 💕';
      case 'signup': return '加入我们 ✨';
      case 'reset': return '重置密码 🔑';
      case 'update': return '设置新密码 🔐';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return '登录你的梦女小窝';
      case 'signup': return '创建你的专属空间';
      case 'reset': return '输入邮箱接收重置链接';
      case 'update': return '请设置你的新密码';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-purple via-candy-pink to-candy-orange flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="absolute top-20 left-10 text-white/30"
        >
          <Heart className="w-16 h-16" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 15, 0], rotate: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, delay: 1 }}
          className="absolute top-40 right-10 text-white/30"
        >
          <Sparkles className="w-12 h-12" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ repeat: Infinity, duration: 5, delay: 2 }}
          className="absolute bottom-32 left-20 text-white/20"
        >
          <Heart className="w-20 h-20" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm z-10"
      >
        <div className="glass rounded-4xl p-8 shadow-2xl">
          {/* Logo with Video */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-glow relative">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src="/videos/auth-bg.mp4" type="video/mp4" />
              </video>
            </div>
          </motion.div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            {getTitle()}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {getSubtitle()}
          </p>

          {/* 登录/注册表单 */}
          {(mode === 'login' || mode === 'signup') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
                />
              </div>

              <Button
                type="submit"
                variant="candy"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
              </Button>
            </form>
          )}

          {/* 重置密码表单 */}
          {mode === 'reset' && (
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
                />
              </div>
              <Button
                type="button"
                variant="candy"
                size="lg"
                className="w-full"
                disabled={loading}
                onClick={handleResetPassword}
              >
                {loading ? '发送中...' : '发送重置链接'}
              </Button>
            </div>
          )}

          {/* 更新密码表单 */}
          {mode === 'update' && (
            <div className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="新密码 (至少6位)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
                />
              </div>
              <Button
                type="button"
                variant="candy"
                size="lg"
                className="w-full"
                disabled={loading}
                onClick={handleUpdatePassword}
              >
                {loading ? '更新中...' : '确认修改密码'}
              </Button>
            </div>
          )}

          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline block w-full"
                >
                  忘记密码?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  还没有账号? 立即注册
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-primary hover:underline font-medium"
              >
                已有账号? 立即登录
              </button>
            )}
            {(mode === 'reset' || mode === 'update') && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-primary hover:underline font-medium"
              >
                返回登录
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
