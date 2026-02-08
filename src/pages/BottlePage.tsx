import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Waves, Sparkles, RefreshCw, Trash2, X } from 'lucide-react';
import { getSupabaseUrl } from '@/lib/supabaseUrl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
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
  const { apiConfig, loading: apiConfigLoading } = useAPIConfig();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [bottles, setBottles] = useState<BottleMessage[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [currentReply, setCurrentReply] = useState<{ content: string; character: string } | null>(null);

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

  const deleteBottle = async (bottleId: string) => {
    // 先更新UI
    setBottles(prev => prev.filter(b => b.id !== bottleId));
    
    try {
      const { error } = await supabase.from('bottles').delete().eq('id', bottleId);
      if (error) {
        // 如果删除失败，重新获取数据
        fetchBottles();
        toast.error('删除失败');
      } else {
        toast.success('已删除');
      }
    } catch (err) {
      fetchBottles();
      toast.error('删除失败');
    }
  };

  const throwBottle = async () => {
    if (!input.trim() || sending) return;
    
    // 检查API配置
    if (apiConfigLoading) {
      toast.error('API配置加载中，请稍候...');
      return;
    }
    
    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }
    
    setSending(true);
    
    try {
      const { data: bottleData, error: insertError } = await supabase
        .from('bottles')
        .insert({ 
          user_id: user?.id, 
          content: input.trim()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('漂流瓶已扔出，等待回复...');
      setInput('');
      setShowCompose(false);

      const response = await fetch(`${getSupabaseUrl()}/functions/v1/bottle-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          content: input.trim(),
          apiConfig: {
            apiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
          },
          userId: user?.id
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '获取回复失败');
      }

      const { reply, character } = await response.json();

      await supabase
        .from('bottles')
        .update({ 
          is_picked: true,
          picked_by: user?.id,
          reply: reply,
          character_name: character,
        } as any)
        .eq('id', bottleData.id);

      setCurrentReply({ content: reply, character });
      fetchBottles();
      
    } catch (err: any) {
      console.error('Throw bottle error:', err);
      toast.error(err.message || '发送失败');
    } finally {
      setSending(false);
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
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-cyan-50 to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-cyan-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')} className="w-8 h-8">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1.5">
            <Waves className="w-5 h-5 text-cyan-500" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              漂流瓶
            </h1>
          </div>
        </div>
        {apiConfig?.apiKey && (
          <span className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full">
            自定义API
          </span>
        )}
      </header>

      {/* Main Content */}
      <div className="p-3 space-y-3 pb-6">
        {/* Reply Modal */}
        <AnimatePresence>
          {currentReply && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setCurrentReply(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 max-w-[280px] w-full shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-3">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-yellow-200 to-orange-200 dark:from-yellow-600 dark:to-orange-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-200" />
                  </div>
                  <h3 className="font-bold text-foreground">收到回复!</h3>
                  <p className="text-xs text-cyan-500">来自 {currentReply.character}</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-slate-700 dark:to-slate-600 rounded-xl p-3 mb-3 text-sm">
                  <p className="text-foreground leading-relaxed">{currentReply.content}</p>
                </div>
                <Button 
                  onClick={() => setCurrentReply(null)}
                  size="sm"
                  className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm h-9"
                >
                  收下
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Section */}
        <AnimatePresence mode="wait">
          {showCompose ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-cyan-100 dark:border-slate-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Send className="w-4 h-4 text-cyan-500" />
                  写漂流瓶
                </div>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setShowCompose(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="写下你想说的话..."
                className="min-h-[80px] text-sm rounded-xl border-cyan-200 dark:border-slate-600 resize-none mb-2"
                maxLength={500}
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">{input.length}/500</span>
                <Button 
                  onClick={throwBottle}
                  disabled={!input.trim() || sending}
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white h-8 px-4 text-sm"
                >
                  {sending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Waves className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {sending ? '扔出中' : '扔出去'}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowCompose(true)}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl p-3 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Waves className="w-5 h-5" />
              <span className="font-medium">扔一个漂流瓶</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bottles History */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground/70 flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5" />
            我的漂流瓶 ({bottles.length})
          </h3>
          
          {bottles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Waves className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">还没有漂流瓶</p>
              <p className="text-xs">扔一个出去吧~</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bottles.map((bottle, index) => (
                <motion.div
                  key={bottle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-cyan-50 dark:border-slate-700 relative group"
                >
                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/30 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[280px] rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-base">删除漂流瓶？</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                          将永久删除这个漂流瓶及其回复
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-8 text-sm rounded-full">取消</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteBottle(bottle.id)}
                          className="h-8 text-sm rounded-full bg-red-500 hover:bg-red-600"
                        >
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* My message */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-muted-foreground">我扔出的</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(bottle.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground bg-cyan-50/80 dark:bg-slate-700/50 rounded-lg p-2.5 leading-relaxed">
                      {bottle.content}
                    </p>
                  </div>
                  
                  {/* Reply */}
                  {bottle.reply ? (
                    <div className="border-t border-cyan-100/50 dark:border-slate-600/50 pt-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="w-2.5 h-2.5 text-yellow-500" />
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">{bottle.character || '神秘人'}</span>
                      </div>
                      <p className="text-sm text-foreground bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-lg p-2.5 leading-relaxed">
                        {bottle.reply}
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottlePage;
