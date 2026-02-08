import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, Sparkles, Mail, Lock, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error.message || '';
          if (msg.includes('Invalid login credentials')) {
            toast.error('邮箱或密码错误');
          } else if (msg.includes('503') || msg.includes('upstream') || msg.includes('Service Unavailable')) {
            toast.error('服务暂时不可用，请稍后再试');
          } else if (msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
            toast.error('网络连接失败，请检查网络后重试');
          } else if (msg) {
            toast.error(msg);
          } else {
            toast.error('登录失败，请稍后重试');
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
        if (!inviteCode.trim()) {
          toast.error('请输入邀请码');
          setLoading(false);
          return;
        }
        
        // 验证邀请码
        const { data: validateData, error: validateError } = await supabase.functions.invoke('validate-invite-code', {
          body: { code: inviteCode, email }
        });
        
        if (validateError || !validateData?.valid) {
          toast.error(validateData?.message || '邀请码验证失败');
          setLoading(false);
          return;
        }
        
        const { error } = await signUp(email, password);
        if (error) {
          const msg = error.message || '';
          if (msg.includes('already registered')) {
            toast.error('该邮箱已注册');
          } else if (msg.includes('503') || msg.includes('upstream') || msg.includes('Service Unavailable')) {
            toast.error('服务暂时不可用，请稍后再试');
          } else if (msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
            toast.error('网络连接失败，请检查网络后重试');
          } else if (msg) {
            toast.error(msg);
          } else {
            toast.error('注册失败，请稍后重试');
          }
        } else {
          toast.success('注册成功!');
          const redirectTo = (location.state as { from?: string } | null)?.from || '/';
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error('服务暂时不可用，请稍后再试');
    }

    setLoading(false);
  };

  const getTitle = () => {
    return mode === 'login' ? '欢迎回来 💕' : '加入我们 ✨';
  };

  const getSubtitle = () => {
    return mode === 'login' ? '登录你的梦女小窝' : '创建你的专属空间';
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
          <p className="text-sm text-muted-foreground text-center mb-4">
            {getSubtitle()}
          </p>
          {/* 数据清理政策说明 */}
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-blue-700 dark:text-blue-300 text-center leading-relaxed">
              📢 为保障服务质量，超过3个月未登录的账号数据将被清理。
              <br />
              请定期登录以保留您的聊天记录和角色数据。
            </p>
          </div>


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
              
              {mode === 'signup' && (
                <>
                  <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
                      🎫 本站采用邀请制注册，请输入有效邀请码
                    </p>
                  </div>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="邀请码"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                      required
                      className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary uppercase tracking-widest"
                    />
                  </div>
                </>
              )}

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

          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <p className="text-xs text-muted-foreground">
                  忘记密码? 请联系管理员重置
                </p>
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
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
