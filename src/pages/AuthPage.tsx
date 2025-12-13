import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, Sparkles, Mail, Lock } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('邮箱或密码错误');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('登录成功!');
          navigate('/');
        }
      } else {
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
          navigate('/');
        }
      }
    } catch (error: any) {
      toast.error('发生错误，请重试');
    }

    setLoading(false);
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
            {isLogin ? '欢迎回来 💕' : '加入我们 ✨'}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {isLogin ? '登录你的梦女小窝' : '创建你的专属空间'}
          </p>

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
              {loading ? '请稍候...' : isLogin ? '登录' : '注册'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline font-medium"
            >
              {isLogin ? '还没有账号? 立即注册' : '已有账号? 立即登录'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
