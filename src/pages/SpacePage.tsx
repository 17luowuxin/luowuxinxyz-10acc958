import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, RefreshCw, User, Send, Sparkles, Plus, Trash2, Image, Camera, BookOpen, MessageSquare } from 'lucide-react';
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

interface GuestbookEntry {
  id: string;
  content: string;
  character_id?: string;
  is_character_reply: boolean;
  parent_id?: string;
  created_at: string;
  character?: {
    name: string;
    avatar_url?: string;
  };
}

const SpacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig, isConfigured, loading: apiConfigLoading } = useAPIConfig();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{ nickname?: string; persona?: string; avatar_url?: string } | null>(null);
  const [spaceBackground, setSpaceBackground] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>({});
  const [likedMoments, setLikedMoments] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('shuoshuo');
  const [newPostContent, setNewPostContent] = useState('');
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [postImages, setPostImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Guestbook state
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [newGuestbookContent, setNewGuestbookContent] = useState('');
  const [deleteGuestbookId, setDeleteGuestbookId] = useState<string | null>(null);
  const [postingGuestbook, setPostingGuestbook] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchMoments();
      fetchUserProfile();
      fetchSpaceBackground();
      fetchGuestbook();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('nickname, persona, avatar_url')
      .eq('user_id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchSpaceBackground = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('customization')
      .select('space_background_url')
      .eq('user_id', user.id)
      .single();
    if (data?.space_background_url) setSpaceBackground(data.space_background_url);
  };

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
            comments: comments || [],
            is_user_post: moment.is_user_post === true
          };
        })
      );
      setMoments(momentsWithComments);
    }
    setLoading(false);
  };

  const fetchGuestbook = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('guestbook')
      .select('*, characters(name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setGuestbookEntries(data.map((entry: any) => ({
        ...entry,
        character: entry.characters
      })));
    }
  };

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingBg(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/space-bg-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      await supabase
        .from('customization')
        .update({ space_background_url: publicUrl })
        .eq('user_id', user.id);

      setSpaceBackground(publicUrl);
      toast.success('背景更换成功!');
    } catch (err) {
      console.error(err);
      toast.error('上传失败');
    }
    setUploadingBg(false);
  };

  const handleUploadPostImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user?.id) return;
    if (postImages.length + files.length > 9) {
      toast.error('最多只能上传9张图片');
      return;
    }

    setUploadingImage(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/moment-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        setPostImages(prev => [...prev, publicUrl]);
      }
    } catch (err) {
      console.error(err);
      toast.error('图片上传失败');
    }
    setUploadingImage(false);
  };

  const generateMoment = async () => {
    if (characters.length === 0) {
      toast.error('请先创建AI角色');
      return;
    }

    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }

    setGenerating(true);
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
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            userId: user?.id
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
      fetchMoments();
    } catch (err) {
      console.error('Generate moment error:', err);
      toast.error('生成动态失败');
    }
    setGenerating(false);
  };

  const handleUserPost = async () => {
    if (!newPostContent.trim() && postImages.length === 0) return;
    
    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }
    
    setPosting(true);
    const postContent = newPostContent.trim();
    
    try {
      if (characters.length === 0) {
        toast.error('请先创建至少一个AI角色');
        setPosting(false);
        return;
      }

      const imageUrl = postImages.length > 0 ? postImages.join(',') : null;

      const { data: momentData, error } = await supabase.from('moments').insert({
        user_id: user?.id,
        character_id: characters[0].id,
        content: postContent || '分享了图片',
        image_url: imageUrl,
        is_user_post: true
      } as any).select().single();

      if (error) throw error;

      toast.success('发布成功!');
      setNewPostContent('');
      setPostImages([]);
      setPostDialogOpen(false);
      fetchMoments();

      // AI reply in background
      const numReplies = Math.min(Math.floor(Math.random() * 3) + 1, characters.length);
      const replyChars = [...characters].sort(() => Math.random() - 0.5).slice(0, numReplies);

      (async () => {
        for (const char of replyChars) {
          try {
            const { data: replyData } = await supabase.functions.invoke('generate-moment', {
              body: { 
                character: char, 
                type: 'reply',
                userPost: postContent,
                userApiKey: apiConfig.apiKey,
                provider: apiConfig.provider,
                baseUrl: apiConfig.baseUrl,
                model: apiConfig.model,
                userProfile: userProfile,
                replyCharacterId: char.id,
                userId: user?.id
              }
            });

            if (replyData?.content) {
              await supabase.from('comments').insert({
                moment_id: momentData.id,
                user_id: user?.id,
                content: `[${char.name}] ${replyData.content}`,
                is_character_reply: true
              });
              fetchMoments();
            }
          } catch (err) {
            console.error('AI reply error:', err);
          }
        }
      })();
    } catch (err) {
      console.error('Post error:', err);
      toast.error('发布失败');
    }
    setPosting(false);
  };

  const handleGuestbookPost = async () => {
    if (!newGuestbookContent.trim()) return;
    
    setPostingGuestbook(true);
    try {
      await supabase.from('guestbook').insert({
        user_id: user?.id,
        content: newGuestbookContent.trim(),
        is_character_reply: false
      });

      toast.success('留言成功!');
      setNewGuestbookContent('');
      fetchGuestbook();

      // AI character reply
      if (characters.length > 0 && apiConfig?.apiKey) {
        const char = characters[Math.floor(Math.random() * characters.length)];
        try {
          const { data: replyData } = await supabase.functions.invoke('generate-moment', {
            body: { 
              character: char, 
              type: 'reply',
              userPost: newGuestbookContent.trim(),
              userApiKey: apiConfig.apiKey,
              provider: apiConfig.provider,
              baseUrl: apiConfig.baseUrl,
              model: apiConfig.model,
              userProfile: userProfile,
              userId: user?.id
            }
          });

          if (replyData?.content) {
            await supabase.from('guestbook').insert({
              user_id: user?.id,
              content: replyData.content,
              character_id: char.id,
              is_character_reply: true
            });
            fetchGuestbook();
          }
        } catch (err) {
          console.error('AI guestbook reply error:', err);
        }
      }
    } catch (err) {
      console.error('Guestbook error:', err);
      toast.error('留言失败');
    }
    setPostingGuestbook(false);
  };

  const handleDeleteGuestbook = async (entryId: string) => {
    try {
      await supabase.from('guestbook').delete().eq('id', entryId);
      toast.success('留言删除成功');
      fetchGuestbook();
    } catch (err) {
      toast.error('删除失败');
    }
    setDeleteGuestbookId(null);
  };

  const handleLike = async (momentId: string) => {
    const isLiked = likedMoments.has(momentId);
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;

    setMoments(prev => prev.map(m => 
      m.id === momentId ? { ...m, likes: m.likes + (isLiked ? -1 : 1) } : m
    ));

    const newLiked = new Set(likedMoments);
    if (isLiked) newLiked.delete(momentId);
    else newLiked.add(momentId);
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

    if (moment.character && apiConfig?.apiKey) {
      try {
        const { data } = await supabase.functions.invoke('generate-moment', {
          body: { 
            character: moment.character,
            type: 'reply',
            userPost: content,
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            userProfile: userProfile,
            userId: user?.id
          }
        });

        if (data?.content) {
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
    fetchMoments();
  };

  const handleDelete = async (momentId: string) => {
    try {
      await supabase.from('comments').delete().eq('moment_id', momentId);
      await supabase.from('moments').delete().eq('id', momentId);
      toast.success('删除成功');
      fetchMoments();
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

  const renderMoment = (moment: Moment, i: number) => {
    const images = moment.image_url?.split(',').filter(Boolean) || [];
    
    return (
      <motion.div
        key={moment.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        className="bg-card/90 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-border/50"
      >
        {/* Author */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center overflow-hidden shrink-0">
            {moment.is_user_post ? (
              userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <User className="w-6 h-6 text-primary-foreground" />
              )
            ) : moment.character?.avatar_url ? (
              <img src={moment.character.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <User className="w-6 h-6 text-primary-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {moment.is_user_post ? (userProfile?.nickname || '我') : moment.character?.name || '未知角色'}
            </p>
            <p className="text-xs text-muted-foreground">{formatTime(moment.created_at)}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setDeleteId(moment.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <p className="text-foreground mb-3 leading-relaxed whitespace-pre-wrap">{moment.content}</p>

        {/* Images Grid */}
        {images.length > 0 && (
          <div className={`grid gap-1 mb-3 ${
            images.length === 1 ? 'grid-cols-1' : 
            images.length === 2 ? 'grid-cols-2' : 
            images.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {images.slice(0, 9).map((img, idx) => (
              <div 
                key={idx} 
                className={`aspect-square overflow-hidden rounded-lg ${
                  images.length === 1 ? 'max-w-xs' : ''
                }`}
              >
                <img src={img} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 pt-3 border-t border-border/30">
          <button
            onClick={() => handleLike(moment.id)}
            className={`flex items-center gap-1.5 transition-colors ${
              likedMoments.has(moment.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
            }`}
          >
            <Heart className={`w-5 h-5 ${likedMoments.has(moment.id) ? 'fill-current' : ''}`} />
            <span className="text-sm">{moment.likes || 0}</span>
          </button>
          <button
            onClick={() => setExpandedComments(prev => ({ ...prev, [moment.id]: !prev[moment.id] }))}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
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
              className="mt-3 space-y-2 overflow-hidden"
            >
              {moment.comments?.map((comment) => {
                const charMatch = comment.content.match(/^\[(.+?)\]\s*/);
                const charName = charMatch ? charMatch[1] : (comment.is_character_reply ? moment.character?.name || 'AI' : null);
                const displayContent = charMatch ? comment.content.replace(/^\[.+?\]\s*/, '') : comment.content;
                const userName = userProfile?.nickname || '我';
                
                return (
                  <div 
                    key={comment.id}
                    className={`text-sm p-3 rounded-lg ${
                      comment.is_character_reply ? 'bg-primary/10 ml-4' : 'bg-muted'
                    }`}
                  >
                    {comment.is_character_reply ? (
                      <span className="font-medium">
                        <span className="text-primary">{charName}</span>
                        <span className="text-muted-foreground mx-1">回复</span>
                        <span className="text-foreground">{userName}</span>
                        <span className="text-muted-foreground">:</span>
                      </span>
                    ) : (
                      <span className="font-medium text-foreground">{userName}:</span>
                    )}
                    <span className="ml-2 text-foreground">{displayContent}</span>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-2">
                <Input
                  value={commentInputs[moment.id] || ''}
                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                  placeholder="写评论..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleComment(moment)}
                />
                <Button 
                  size="icon"
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
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Background */}
      <div 
        className="relative h-48 bg-gradient-to-br from-primary/30 to-primary/10"
        style={spaceBackground ? { 
          backgroundImage: `url(${spaceBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 z-10">
          <Button variant="ghost" size="icon" className="h-9 w-9 bg-black/20 text-white hover:bg-black/30" onClick={() => navigate('/home')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 bg-black/20 text-white hover:bg-black/30"
              onClick={() => bgInputRef.current?.click()}
              disabled={uploadingBg}
            >
              <Camera className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 bg-black/20 text-white hover:bg-black/30"
              onClick={generateMoment}
              disabled={generating}
            >
              {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-end gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-primary to-primary/60">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold text-white drop-shadow-lg">
                {userProfile?.nickname || '我的空间'}
              </h1>
              <p className="text-sm text-white/80 truncate">
                {userProfile?.persona || '这个人很懒，什么都没写~'}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadBackground}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full rounded-none bg-card border-b h-12 grid grid-cols-3">
          <TabsTrigger value="shuoshuo" className="flex items-center gap-2 data-[state=active]:text-primary">
            <MessageCircle className="w-4 h-4" />
            说说
          </TabsTrigger>
          <TabsTrigger value="diary" className="flex items-center gap-2 data-[state=active]:text-primary">
            <BookOpen className="w-4 h-4" />
            日志
          </TabsTrigger>
          <TabsTrigger value="guestbook" className="flex items-center gap-2 data-[state=active]:text-primary">
            <MessageSquare className="w-4 h-4" />
            留言板
          </TabsTrigger>
        </TabsList>

        {/* 说说 Tab */}
        <TabsContent value="shuoshuo" className="p-4 space-y-4 pb-24 mt-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : moments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>还没有说说</p>
              <p className="text-sm mt-1">点击右下角发布第一条说说</p>
            </div>
          ) : (
            <AnimatePresence>
              {moments.map((moment, i) => renderMoment(moment, i))}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* 日志 Tab */}
        <TabsContent value="diary" className="p-4 pb-24 mt-0">
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>前往日记本查看日志</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/diary')}
            >
              打开日记本
            </Button>
          </div>
        </TabsContent>

        {/* 留言板 Tab */}
        <TabsContent value="guestbook" className="p-4 space-y-4 pb-24 mt-0">
          {/* Post Guestbook */}
          <div className="bg-card rounded-xl p-4 border border-border/50">
            <Textarea
              value={newGuestbookContent}
              onChange={(e) => setNewGuestbookContent(e.target.value)}
              placeholder="写点什么..."
              className="min-h-[80px] resize-none mb-3"
            />
            <Button 
              onClick={handleGuestbookPost}
              disabled={!newGuestbookContent.trim() || postingGuestbook}
              className="w-full"
            >
              {postingGuestbook ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              发布留言
            </Button>
          </div>

          {/* Guestbook Entries */}
          {guestbookEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>还没有留言</p>
            </div>
          ) : (
            <div className="space-y-3">
              {guestbookEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-xl ${
                    entry.is_character_reply 
                      ? 'bg-primary/10 border border-primary/20 ml-6' 
                      : 'bg-card border border-border/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                      {entry.is_character_reply && entry.character?.avatar_url ? (
                        <img src={entry.character.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : entry.is_character_reply ? (
                        <User className="w-4 h-4 text-white" />
                      ) : userProfile?.avatar_url ? (
                        <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="font-medium text-sm">
                      {entry.is_character_reply ? entry.character?.name || 'AI角色' : userProfile?.nickname || '我'}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatTime(entry.created_at)}
                    </span>
                    <button
                      onClick={() => setDeleteGuestbookId(entry.id)}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  <p className="text-foreground">{entry.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Post Button */}
      {activeTab === 'shuoshuo' && (
        <Dialog open={postDialogOpen} onOpenChange={(open) => {
          setPostDialogOpen(open);
          if (!open) setPostImages([]);
        }}>
          <DialogTrigger asChild>
            <Button 
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
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
              
              {/* Image Preview */}
              {postImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {postImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <img src={img} className="w-full h-full object-cover rounded-lg" alt="" />
                      <button
                        onClick={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || postImages.length >= 9}
                >
                  {uploadingImage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                </Button>
                <span className="text-xs text-muted-foreground self-center">
                  {postImages.length}/9
                </span>
                <Button 
                  onClick={handleUserPost}
                  disabled={(!newPostContent.trim() && postImages.length === 0) || posting}
                  className="flex-1"
                >
                  {posting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  发布
                </Button>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUploadPostImage}
              />
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

      {/* Delete Guestbook Confirm */}
      <AlertDialog open={!!deleteGuestbookId} onOpenChange={() => setDeleteGuestbookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条留言吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteGuestbookId && handleDeleteGuestbook(deleteGuestbookId)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SpacePage;
