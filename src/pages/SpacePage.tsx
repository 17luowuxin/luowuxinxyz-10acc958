import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, RefreshCw, User, Send, Sparkles, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';

interface Moment {
  id: string;
  content: string;
  image_url?: string;
  likes: number;
  created_at: string;
  character_id: string;
  is_user_post?: boolean;
  character?: {
    id: string;
    name: string;
    avatar_url?: string;
    persona?: string;
  };
  comments?: Comment[];
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
  const { apiConfig, isConfigured } = useAPIConfig();
  const [friendMoments, setFriendMoments] = useState<Moment[]>([]);
  const [myMoments, setMyMoments] = useState<Moment[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>({});
  const [likedMoments, setLikedMoments] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('friends');
  const [newPostContent, setNewPostContent] = useState('');
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchAllMoments();
    }
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    if (data) setCharacters(data);
  };

  const fetchAllMoments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('moments')
      .select('*, characters(id, name, avatar_url, persona)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      const momentsWithComments = await Promise.all(
        data.map(async (moment: any) => {
          const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('moment_id', moment.id)
            .order('created_at');
          
          // 判断是否是用户自己发的（character_id为空或特殊标记）
          const isUserPost = !moment.character_id || moment.character_id === user?.id;
          
          return {
            ...moment,
            character: moment.characters,
            comments: comments || [],
            is_user_post: isUserPost
          };
        })
      );
      
      // 分类：好友说说（AI角色发的）和我的说说（用户发的）
      setFriendMoments(momentsWithComments.filter(m => !m.is_user_post));
      setMyMoments(momentsWithComments.filter(m => m.is_user_post));
    }
    setLoading(false);
  };

  const generateMoment = async () => {
    if (characters.length === 0) {
      toast.error('请先创建AI角色');
      return;
    }

    setGenerating(true);
    
    // 随机选择1-3个角色发动态
    const numChars = Math.min(Math.floor(Math.random() * 3) + 1, characters.length);
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const selectedChars = shuffled.slice(0, numChars);
    
    try {
      for (const char of selectedChars) {
        const { data, error } = await supabase.functions.invoke('generate-moment', {
          body: { 
            character: char, 
            type: 'moment',
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            customBaseUrl: apiConfig.customBaseUrl,
            customModel: apiConfig.customModel
          }
        });

        if (error) throw error;

        await supabase.from('moments').insert({
          user_id: user?.id,
          character_id: char.id,
          content: data.content
        });

        toast.success(`${char.name} 发布了新动态!`);
      }
      
      fetchAllMoments();
    } catch (err) {
      console.error('Generate moment error:', err);
      toast.error('生成动态失败');
    }
    
    setGenerating(false);
  };

  const handleUserPost = async () => {
    if (!newPostContent.trim()) return;
    
    setPosting(true);
    try {
      // 用户发说说，使用一个特殊的character_id（用户自己的id）
      // 需要先检查是否有角色，如果有就用第一个角色的id（为了满足外键约束）
      if (characters.length === 0) {
        toast.error('请先创建至少一个AI角色');
        setPosting(false);
        return;
      }

      const { data: momentData, error } = await supabase.from('moments').insert({
        user_id: user?.id,
        character_id: user?.id, // 用用户ID作为特殊标记
        content: newPostContent.trim()
      }).select().single();

      if (error) throw error;

      toast.success('发布成功!');
      setNewPostContent('');
      setPostDialogOpen(false);

      // AI角色回复用户的说说
      const numReplies = Math.min(Math.floor(Math.random() * 3) + 1, characters.length);
      const shuffled = [...characters].sort(() => Math.random() - 0.5);
      const replyChars = shuffled.slice(0, numReplies);

      for (const char of replyChars) {
        try {
          const { data: replyData } = await supabase.functions.invoke('generate-moment', {
            body: { 
              character: char, 
              type: 'reply',
              userPost: newPostContent.trim(),
              userApiKey: apiConfig.apiKey,
              provider: apiConfig.provider,
              customBaseUrl: apiConfig.customBaseUrl,
              customModel: apiConfig.customModel
            }
          });

          if (replyData?.content) {
            await supabase.from('comments').insert({
              moment_id: momentData.id,
              user_id: user?.id,
              content: replyData.content,
              is_character_reply: true
            });
          }
        } catch (err) {
          console.error('AI reply error:', err);
        }
      }

      fetchAllMoments();
    } catch (err) {
      console.error('Post error:', err);
      toast.error('发布失败');
    }
    setPosting(false);
  };

  const handleLike = async (momentId: string) => {
    const isLiked = likedMoments.has(momentId);
    const allMoments = [...friendMoments, ...myMoments];
    const moment = allMoments.find(m => m.id === momentId);
    
    if (!moment) return;

    const updateMoments = (moments: Moment[]) => 
      moments.map(m => m.id === momentId ? { ...m, likes: m.likes + (isLiked ? -1 : 1) } : m);

    setFriendMoments(updateMoments);
    setMyMoments(updateMoments);

    const newLiked = new Set(likedMoments);
    if (isLiked) {
      newLiked.delete(momentId);
    } else {
      newLiked.add(momentId);
    }
    setLikedMoments(newLiked);

    await supabase
      .from('moments')
      .update({ likes: moment.likes + (isLiked ? -1 : 1) })
      .eq('id', momentId);
  };

  const handleComment = async (moment: Moment) => {
    const content = commentInputs[moment.id]?.trim();
    if (!content) return;

    await supabase.from('comments').insert({
      moment_id: moment.id,
      user_id: user?.id,
      content,
      is_character_reply: false
    });

    setCommentInputs(prev => ({ ...prev, [moment.id]: '' }));
    toast.success('评论成功!');

    // AI角色回复
    if (moment.character) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-moment', {
          body: { 
            character: moment.character,
            type: 'reply',
            userPost: content,
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            customBaseUrl: apiConfig.customBaseUrl,
            customModel: apiConfig.customModel
          }
        });

        if (!error && data?.content) {
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
    }

    fetchAllMoments();
  };

  const handleDelete = async (momentId: string) => {
    try {
      await supabase.from('comments').delete().eq('moment_id', momentId);
      await supabase.from('moments').delete().eq('id', momentId);
      toast.success('删除成功');
      fetchAllMoments();
    } catch (err) {
      toast.error('删除失败');
    }
    setDeleteId(null);
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

  const renderMoment = (moment: Moment, i: number) => (
    <motion.div
      key={moment.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="bg-card rounded-2xl p-3 shadow-sm"
    >
      {/* Author */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center overflow-hidden">
          {moment.is_user_post ? (
            <User className="w-5 h-5 text-primary-foreground" />
          ) : moment.character?.avatar_url ? (
            <img src={moment.character.avatar_url} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-primary-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {moment.is_user_post ? '我' : moment.character?.name || '未知角色'}
          </p>
          <p className="text-xs text-muted-foreground">{formatTime(moment.created_at)}</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteId(moment.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground mb-2 leading-relaxed">{moment.content}</p>

      {moment.image_url && (
        <img src={moment.image_url} className="w-full rounded-xl mb-2" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-border/30">
        <button
          onClick={() => handleLike(moment.id)}
          className={`flex items-center gap-1.5 transition-colors ${
            likedMoments.has(moment.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${likedMoments.has(moment.id) ? 'fill-current' : ''}`} />
          <span className="text-xs">{moment.likes || 0}</span>
        </button>
        <button
          onClick={() => setExpandedComments(prev => ({ ...prev, [moment.id]: !prev[moment.id] }))}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{moment.comments?.length || 0}</span>
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {expandedComments[moment.id] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {moment.comments?.map((comment) => (
              <div 
                key={comment.id}
                className={`text-xs p-2 rounded-lg ${
                  comment.is_character_reply 
                    ? 'bg-primary/10 ml-3' 
                    : 'bg-muted'
                }`}
              >
                <span className="font-medium text-muted-foreground">
                  {comment.is_character_reply ? moment.character?.name || 'AI' : '我'}:
                </span>
                <p className="mt-0.5">{comment.content}</p>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Input
                value={commentInputs[moment.id] || ''}
                onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                placeholder="写评论..."
                className="flex-1 h-8 text-xs"
                onKeyPress={(e) => e.key === 'Enter' && handleComment(moment)}
              />
              <Button 
                size="sm" 
                variant="candy"
                className="h-8 w-8 p-0"
                onClick={() => handleComment(moment)}
                disabled={!commentInputs[moment.id]?.trim()}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderEmptyState = (isMyPosts: boolean) => (
    <div className="text-center py-16 text-muted-foreground">
      <Heart className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">{isMyPosts ? '还没有发布说说' : '还没有好友动态'}</p>
      <p className="text-xs mt-1">
        {isMyPosts ? '点击右下角发布你的第一条说说' : '点击右上角✨让角色发布动态'}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-card/80 backdrop-blur-lg border-b">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">空间</h1>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-9 w-9"
          onClick={generateMoment}
          disabled={generating}
        >
          {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full rounded-none bg-card/50 border-b h-10">
          <TabsTrigger value="friends" className="flex-1 text-sm">好友说说</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 text-sm">我的说说</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="p-3 space-y-3 pb-24 mt-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : friendMoments.length === 0 ? (
            renderEmptyState(false)
          ) : (
            <AnimatePresence>
              {friendMoments.map((moment, i) => renderMoment(moment, i))}
            </AnimatePresence>
          )}
        </TabsContent>

        <TabsContent value="mine" className="p-3 space-y-3 pb-24 mt-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : myMoments.length === 0 ? (
            renderEmptyState(true)
          ) : (
            <AnimatePresence>
              {myMoments.map((moment, i) => renderMoment(moment, i))}
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>

      {/* Post Button - Only show on "我的说说" tab */}
      {activeTab === 'mine' && (
        <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg"
              variant="candy"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>发布说说</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="分享你的心情..."
                className="min-h-[120px] resize-none"
              />
              <Button 
                onClick={handleUserPost}
                disabled={!newPostContent.trim() || posting}
                className="w-full"
                variant="candy"
              >
                {posting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                {posting ? '发布中...' : '发布'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条说说吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SpacePage;
