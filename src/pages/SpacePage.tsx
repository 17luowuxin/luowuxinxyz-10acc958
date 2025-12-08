import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, RefreshCw, User, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Moment {
  id: string;
  content: string;
  image_url?: string;
  likes: number;
  created_at: string;
  character_id: string;
  character?: {
    id: string;
    name: string;
    avatar_url?: string;
    persona?: string;
  };
  comments?: Comment[];
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  is_character_reply: boolean;
  created_at: string;
}

const SpacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>({});
  const [likedMoments, setLikedMoments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchMoments();
    }
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    if (data) setCharacters(data);
  };

  const fetchMoments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('moments')
      .select('*, characters(id, name, avatar_url, persona)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      // 获取每个动态的评论
      const momentsWithComments = await Promise.all(
        data.map(async (moment: any) => {
          const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('moment_id', moment.id)
            .order('created_at');
          return {
            ...moment,
            character: moment.characters,
            comments: comments || []
          };
        })
      );
      setMoments(momentsWithComments);
    }
    setLoading(false);
  };

  const generateMoment = async () => {
    if (characters.length === 0) {
      toast.error('请先创建AI角色');
      return;
    }

    setGenerating(true);
    
    // 随机选择一个角色
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-moment', {
        body: { character: randomChar, type: 'moment' }
      });

      if (error) throw error;

      // 保存动态
      await supabase.from('moments').insert({
        user_id: user?.id,
        character_id: randomChar.id,
        content: data.content
      });

      toast.success(`${randomChar.name} 发布了新动态!`);
      fetchMoments();
    } catch (err) {
      console.error('Generate moment error:', err);
      toast.error('生成动态失败');
    }
    
    setGenerating(false);
  };

  const handleLike = async (momentId: string) => {
    const isLiked = likedMoments.has(momentId);
    
    // 更新本地状态
    setMoments(prev => prev.map(m => 
      m.id === momentId 
        ? { ...m, likes: m.likes + (isLiked ? -1 : 1) }
        : m
    ));

    if (isLiked) {
      likedMoments.delete(momentId);
    } else {
      likedMoments.add(momentId);
    }
    setLikedMoments(new Set(likedMoments));

    // 更新数据库
    const moment = moments.find(m => m.id === momentId);
    if (moment) {
      await supabase
        .from('moments')
        .update({ likes: moment.likes + (isLiked ? -1 : 1) })
        .eq('id', momentId);
    }
  };

  const handleComment = async (moment: Moment) => {
    const content = commentInputs[moment.id]?.trim();
    if (!content) return;

    // 添加用户评论
    await supabase.from('comments').insert({
      moment_id: moment.id,
      user_id: user?.id,
      content,
      is_character_reply: false
    });

    setCommentInputs(prev => ({ ...prev, [moment.id]: '' }));
    toast.success('评论成功!');

    // AI角色回复
    try {
      const { data, error } = await supabase.functions.invoke('reply-comment', {
        body: { 
          character: moment.character,
          userComment: content
        }
      });

      if (!error && data.content) {
        await supabase.from('comments').insert({
          moment_id: moment.id,
          user_id: user?.id,
          content: data.content,
          is_character_reply: true
        });
      }
    } catch (err) {
      console.error('Reply error:', err);
    }

    fetchMoments();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card/80 backdrop-blur-lg border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">空间</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={generateMoment}
          disabled={generating}
          className={generating ? 'animate-spin' : ''}
        >
          {generating ? <RefreshCw className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : moments.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>还没有动态</p>
            <p className="text-sm mt-2">点击右上角✨让角色发布动态</p>
          </div>
        ) : (
          <AnimatePresence>
            {moments.map((moment, i) => (
              <motion.div
                key={moment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-3xl p-4 shadow-card"
              >
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple flex items-center justify-center">
                    {moment.character?.avatar_url ? (
                      <img src={moment.character.avatar_url} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{moment.character?.name || '未知角色'}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(moment.created_at)}</p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-foreground mb-4 leading-relaxed">{moment.content}</p>

                {moment.image_url && (
                  <img src={moment.image_url} className="w-full rounded-2xl mb-4" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-6 pt-2 border-t border-border/50">
                  <button
                    onClick={() => handleLike(moment.id)}
                    className={`flex items-center gap-2 transition-colors ${
                      likedMoments.has(moment.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${likedMoments.has(moment.id) ? 'fill-current' : ''}`} />
                    <span className="text-sm">{moment.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => setExpandedComments(prev => ({ ...prev, [moment.id]: !prev[moment.id] }))}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{moment.comments?.length || 0}</span>
                  </button>
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                  {expandedComments[moment.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 space-y-3 overflow-hidden"
                    >
                      {/* Existing comments */}
                      {moment.comments?.map((comment) => (
                        <div 
                          key={comment.id}
                          className={`text-sm p-3 rounded-xl ${
                            comment.is_character_reply 
                              ? 'bg-primary/10 ml-4' 
                              : 'bg-muted'
                          }`}
                        >
                          <span className="font-medium text-xs text-muted-foreground">
                            {comment.is_character_reply ? moment.character?.name : '我'}:
                          </span>
                          <p className="mt-1">{comment.content}</p>
                        </div>
                      ))}

                      {/* Comment input */}
                      <div className="flex gap-2 pt-2">
                        <Input
                          value={commentInputs[moment.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                          placeholder="写评论..."
                          className="flex-1 h-9 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleComment(moment)}
                        />
                        <Button 
                          size="sm" 
                          variant="candy"
                          onClick={() => handleComment(moment)}
                          disabled={!commentInputs[moment.id]?.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default SpacePage;
