import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Waves, Sparkles, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface BottleMessage {
  id: string;
  content: string;
  reply?: string;
  character?: string;
  created_at: string;
}

const BottlePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig } = useAPIConfig();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [bottles, setBottles] = useState<BottleMessage[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [currentReply, setCurrentReply] = useState<{ content: string; character: string } | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (user) fetchBottles();
  }, [user]);

  const fetchBottles = async () => {
    const { data } = await supabase
      .from('bottles')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) {
      setBottles(data.map(b => ({
        id: b.id,
        content: b.content,
        reply: (b as any).reply,
        character: (b as any).character_name,
        created_at: b.created_at
      })));
    }
  };

  const throwBottle = async () => {
    if (!input.trim() || sending) return;
    
    setSending(true);
    setAnimating(true);
    
    try {
      // 先保存漂流瓶
      const { data: bottleData, error: insertError } = await supabase
        .from('bottles')
        .insert({ 
          user_id: user?.id, 
          content: input.trim()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('漂流瓶已扔出，等待神秘回复...');
      setInput('');
      setShowCompose(false);

      // 调用AI生成回复
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bottle-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          content: input.trim(),
          apiConfig: apiConfig?.apiKey ? apiConfig : null
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '获取回复失败');
      }

      const { reply, character } = await response.json();

      // 更新漂流瓶回复
      await supabase
        .from('bottles')
        .update({ 
          is_picked: true,
          picked_by: user?.id,
          reply: reply,
          character_name: character,
        } as any)
        .eq('id', bottleData.id);

      // 显示回复动画
      setCurrentReply({ content: reply, character });
      
      // 刷新列表
      fetchBottles();
      
    } catch (err: any) {
      console.error('Throw bottle error:', err);
      toast.error(err.message || '发送失败，请重试');
    } finally {
      setSending(false);
      setTimeout(() => setAnimating(false), 500);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold ml-2 bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            漂流瓶
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {apiConfig?.apiKey && (
            <span className="text-xs bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 px-2 py-1 rounded-full">
              自定义API
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Ocean Animation Background */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Waves className="w-full h-32 text-cyan-400 animate-pulse" />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-32">
        {/* Reply Modal */}
        <AnimatePresence>
          {currentReply && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
              onClick={() => setCurrentReply(null)}
            >
              <motion.div 
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-4">
                  <Sparkles className="w-10 h-10 mx-auto text-yellow-400 mb-2" />
                  <h3 className="font-bold text-lg text-foreground">收到神秘回复！</h3>
                  <p className="text-sm text-cyan-500">来自 {currentReply.character}</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-700 dark:to-slate-600 rounded-2xl p-4 mb-4">
                  <p className="text-foreground leading-relaxed">{currentReply.content}</p>
                </div>
                <Button 
                  onClick={() => setCurrentReply(null)}
                  className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white"
                >
                  收下回复
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Section */}
        <AnimatePresence>
          {showCompose ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border border-cyan-100 dark:border-slate-700"
            >
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-500" />
                写一个漂流瓶
              </h3>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="写下你想说的话，扔进大海吧..."
                className="min-h-[120px] rounded-2xl border-cyan-200 dark:border-slate-600 resize-none mb-3"
                maxLength={500}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{input.length}/500</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCompose(false)} className="rounded-full">
                    取消
                  </Button>
                  <Button 
                    onClick={throwBottle}
                    disabled={!input.trim() || sending}
                    className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white"
                  >
                    {sending ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Waves className="w-4 h-4 mr-2" />
                    )}
                    {sending ? '扔出中...' : '扔出去'}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowCompose(true)}
              className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-3xl p-5 shadow-lg flex items-center justify-center gap-3 hover:shadow-xl transition-shadow"
            >
              <Waves className="w-6 h-6" />
              <span className="font-bold text-lg">扔一个漂流瓶</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bottles History */}
        <div className="space-y-3">
          <h3 className="font-bold text-foreground/80 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            我的漂流瓶
          </h3>
          
          {bottles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Waves className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>还没有漂流瓶</p>
              <p className="text-sm">扔一个出去吧~</p>
            </div>
          ) : (
            bottles.map((bottle, index) => (
              <motion.div
                key={bottle.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md border border-cyan-50 dark:border-slate-700"
              >
                {/* My message */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">我扔出的</span>
                    <span className="text-xs text-muted-foreground">{formatTime(bottle.created_at)}</span>
                  </div>
                  <p className="text-foreground bg-cyan-50 dark:bg-slate-700 rounded-xl p-3">
                    {bottle.content}
                  </p>
                </div>
                
                {/* Reply */}
                {bottle.reply && (
                  <div className="border-t border-cyan-100 dark:border-slate-600 pt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-cyan-500 font-medium">{bottle.character || '神秘人'}</span>
                    </div>
                    <p className="text-foreground bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-slate-700 dark:to-slate-600 rounded-xl p-3">
                      {bottle.reply}
                    </p>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BottlePage;
