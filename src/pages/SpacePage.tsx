import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, RefreshCw, User, Send, Sparkles, Plus, Trash2, Image, Camera, BookOpen, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface SpaceLog {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
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
  const [commentReplyTargets, setCommentReplyTargets] = useState<{ [key: string]: string }>({});
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Guestbook state
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [newGuestbookContent, setNewGuestbookContent] = useState('');
  const [deleteGuestbookId, setDeleteGuestbookId] = useState<string | null>(null);
  const [postingGuestbook, setPostingGuestbook] = useState(false);
  const [selectedGuestbookChars, setSelectedGuestbookChars] = useState<Set<string>>(new Set());
  const [guestbookReplyTarget, setGuestbookReplyTarget] = useState<{ entryId: string; charName: string } | null>(null);

  // Space Logs state
  const [spaceLogs, setSpaceLogs] = useState<SpaceLog[]>([]);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogContent, setNewLogContent] = useState('');
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [postingLog, setPostingLog] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [viewingLog, setViewingLog] = useState<SpaceLog | null>(null);
  const [charSelectOpen, setCharSelectOpen] = useState(false);
  const [selectedReplyChars, setSelectedReplyChars] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchMoments();
      fetchUserProfile();
      fetchSpaceBackground();
      fetchGuestbook();
      fetchSpaceLogs();
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

  const fetchSpaceLogs = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('space_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSpaceLogs(data);
    }
  };

  const handlePostLog = async () => {
    if (!user?.id || !newLogTitle.trim() || !newLogContent.trim()) return;
    
    setPostingLog(true);
    try {
      const { data, error } = await supabase
        .from('space_logs')
        .insert({
          user_id: user.id,
          title: newLogTitle.trim(),
          content: newLogContent.trim()
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSpaceLogs(prev => [data, ...prev]);
        setNewLogTitle('');
        setNewLogContent('');
        setLogDialogOpen(false);
        toast.success('日志发布成功!');
      }
    } catch (err) {
      console.error(err);
      toast.error('发布失败');
    }
    setPostingLog(false);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('space_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setSpaceLogs(prev => prev.filter(l => l.id !== logId));
      setDeleteLogId(null);
      toast.success('日志已删除');
    } catch (err) {
      console.error(err);
      toast.error('删除失败');
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

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const filePath = `${user.id}/avatar-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setUserProfile(prev => ({
        nickname: prev?.nickname,
        persona: prev?.persona,
        avatar_url: publicUrl,
      }));

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      toast.success('头像已更新');
    } catch (err) {
      console.error(err);
      toast.error('头像上传失败');
    } finally {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
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

  const generateMoment = async (selectedCharacter?: any) => {
    if (characters.length === 0) {
      toast.error('请先创建AI角色');
      return;
    }

    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }

    setGenerating(true);
    setCharSelectOpen(false);
    
    let selectedChars: any[];
    
    if (selectedCharacter) {
      // 用户选择了特定角色
      selectedChars = [selectedCharacter];
    } else {
      // 随机选择1-3个角色
      const numChars = Math.min(Math.floor(Math.random() * 3) + 1, characters.length);
      const shuffled = [...characters].sort(() => Math.random() - 0.5);
      selectedChars = shuffled.slice(0, numChars);
    }
    
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

        // 如果生成了配图，一并保存
        await supabase.from('moments').insert({
          user_id: user?.id,
          character_id: char.id,
          content: data.content,
          image_url: data.imageUrl || null
        });

        toast.success(`${char.name} 发布了新动态!${data.imageUrl ? ' (含配图)' : ''}`);
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
      
      // 保存图片URLs用于AI回复（在清空状态前）
      const savedImages = [...postImages];
      
      setNewPostContent('');
      setPostImages([]);
      setPostDialogOpen(false);
      fetchMoments();

      // AI reply in background - 使用用户选择的角色，如果没选则随机
      let replyChars: any[];
      if (selectedReplyChars.size > 0) {
        replyChars = characters.filter(c => selectedReplyChars.has(c.id));
      } else {
        const numReplies = Math.min(Math.floor(Math.random() * 3) + 1, characters.length);
        replyChars = [...characters].sort(() => Math.random() - 0.5).slice(0, numReplies);
      }
      setSelectedReplyChars(new Set()); // 重置选择

      (async () => {
        for (const char of replyChars) {
          try {
            const { data: replyData } = await supabase.functions.invoke('generate-moment', {
              body: { 
                character: char, 
                type: 'reply',
                userPost: postContent,
                userImages: savedImages.length > 0 ? savedImages : undefined,
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
    const contentToPost = guestbookReplyTarget 
      ? `@${guestbookReplyTarget.charName} ${newGuestbookContent.trim()}`
      : newGuestbookContent.trim();
    
    try {
      await supabase.from('guestbook').insert({
        user_id: user?.id,
        content: contentToPost,
        is_character_reply: false
      });

      toast.success('留言成功!');
      const originalContent = newGuestbookContent.trim();
      setNewGuestbookContent('');
      fetchGuestbook();

      // AI character reply
      if (characters.length > 0 && apiConfig?.apiKey) {
        let replyChars: any[];
        
        // 如果是回复某个角色，只让那个角色回复
        if (guestbookReplyTarget) {
          const targetChar = characters.find(c => c.name === guestbookReplyTarget.charName);
          replyChars = targetChar ? [targetChar] : [];
        } else if (selectedGuestbookChars.size > 0) {
          replyChars = characters.filter(c => selectedGuestbookChars.has(c.id));
        } else {
          replyChars = [characters[Math.floor(Math.random() * characters.length)]];
        }
        
        setSelectedGuestbookChars(new Set()); // 重置选择
        setGuestbookReplyTarget(null); // 重置回复目标

        for (const char of replyChars) {
          try {
            const { data: replyData } = await supabase.functions.invoke('generate-moment', {
              body: { 
                character: char, 
                type: 'guestbook-reply',
                userPost: originalContent,
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
      } else {
        setGuestbookReplyTarget(null);
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
    const raw = commentInputs[moment.id]?.trim();
    if (!raw) return;

    const images = moment.image_url?.split(',').filter(Boolean) || [];

    // 允许用户“点选某条角色评论 -> 回复该角色”，或手动输入 @角色名
    const atMatch = raw.match(/^@([^\s]+)\s+/);
    const explicitTargetName = atMatch?.[1]?.trim();
    const targetName = explicitTargetName || commentReplyTargets[moment.id];

    const normalizedContent = targetName && !explicitTargetName ? `@${targetName} ${raw}` : raw;

    await supabase.from('comments').insert({
      moment_id: moment.id,
      user_id: user?.id,
      content: normalizedContent,
      is_character_reply: false,
    });

    setCommentInputs((prev) => ({ ...prev, [moment.id]: '' }));
    setCommentReplyTargets((prev) => {
      const next = { ...prev };
      delete next[moment.id];
      return next;
    });
    toast.success('评论成功!');

    if (!apiConfig?.apiKey) {
      fetchMoments();
      return;
    }

    // 选择要“回你评论”的角色：@优先，其次回帖作者（兼容旧逻辑）
    const replyCharacter =
      (targetName ? characters.find((c) => c.name === targetName) : null) || moment.character;

    if (replyCharacter) {
      try {
        const { data } = await supabase.functions.invoke('generate-moment', {
          body: {
            character: replyCharacter,
            type: 'reply',
            momentId: moment.id,
            userPost: normalizedContent,
            userImages: images.length > 0 ? images : undefined,
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            userProfile: userProfile,
            userId: user?.id,
          },
        });

        if (data?.content) {
          await supabase.from('comments').insert({
            moment_id: moment.id,
            user_id: user?.id,
            content: `[${replyCharacter.name}] ${data.content}`,
            is_character_reply: true,
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
                const charName = charMatch
                  ? charMatch[1]
                  : comment.is_character_reply
                    ? moment.character?.name || 'AI'
                    : null;
                const displayContent = charMatch ? comment.content.replace(/^\[.+?\]\s*/, '') : comment.content;

                const userName = userProfile?.nickname || '我';
                const replyToMatch = !comment.is_character_reply
                  ? displayContent.match(/^@([^\s]+)\s+(.*)$/)
                  : null;
                const replyToName = replyToMatch?.[1];
                const userDisplayContent = replyToMatch ? replyToMatch[2] : displayContent;

                return (
                  <div
                    key={comment.id}
                    className={`text-sm p-3 rounded-lg ${comment.is_character_reply ? 'bg-primary/10 ml-4' : 'bg-muted'}`}
                  >
                    {comment.is_character_reply ? (
                      <span className="font-medium">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            if (!charName) return;
                            setExpandedComments((prev) => ({ ...prev, [moment.id]: true }));
                            setCommentReplyTargets((prev) => ({ ...prev, [moment.id]: charName }));
                          }}
                        >
                          {charName}
                        </button>
                        <span className="text-muted-foreground mx-1">回复</span>
                        <span className="text-foreground">{userName}</span>
                        <span className="text-muted-foreground">:</span>
                      </span>
                    ) : (
                      <span className="font-medium">
                        <span className="text-foreground">{userName}</span>
                        <span className="text-muted-foreground mx-1">回复</span>
                        <span className="text-primary">{replyToName || moment.character?.name || '角色'}</span>
                        <span className="text-muted-foreground">:</span>
                      </span>
                    )}
                    <span className="ml-2 text-foreground">{comment.is_character_reply ? displayContent : userDisplayContent}</span>
                  </div>
                );
              })}

              {/* 回复角色选择器 */}
              {commentReplyTargets[moment.id] && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-lg">
                  <span>正在回复</span>
                  <span className="text-primary font-medium">@{commentReplyTargets[moment.id]}</span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setCommentReplyTargets(prev => {
                      const next = { ...prev };
                      delete next[moment.id];
                      return next;
                    })}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* 角色快速选择 */}
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-xs text-muted-foreground mr-1">回复:</span>
                {characters.map(char => (
                  <button
                    key={char.id}
                    type="button"
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      commentReplyTargets[moment.id] === char.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                    onClick={() => setCommentReplyTargets(prev => ({ ...prev, [moment.id]: char.name }))}
                  >
                    {char.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Input
                  value={commentInputs[moment.id] || ''}
                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                  placeholder={commentReplyTargets[moment.id] ? `回复 @${commentReplyTargets[moment.id]}...` : "写评论..."}
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
        {/* Top Bar with User Avatar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 z-10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 bg-black/20 text-white hover:bg-black/30" onClick={() => navigate('/home')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            {/* User Avatar & Name in Top Left */}
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => avatarInputRef.current?.click()}
            >
              <div className="w-10 h-10 rounded-full border-2 border-white/80 overflow-hidden bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-semibold text-sm drop-shadow-lg">
                  {userProfile?.nickname || '我'}
                </span>
                <span className="text-white/70 text-xs drop-shadow">
                  访客 {moments.length > 0 ? Math.floor(moments.length * 3.7 + 12) : 0}
                </span>
              </div>
            </div>
          </div>
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
            
            {/* 选择角色发说说 */}
            <Popover open={charSelectOpen} onOpenChange={setCharSelectOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-9 px-2 bg-black/20 text-white hover:bg-black/30"
                  disabled={generating}
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  <span className="text-xs">发说说</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-10"
                    onClick={() => generateMoment()}
                    disabled={generating}
                  >
                    <Sparkles className="w-4 h-4 mr-2 text-primary" />
                    随机角色发说说
                  </Button>
                  <div className="border-t my-2" />
                  <p className="text-xs text-muted-foreground px-2 py-1">选择角色:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {characters.map(char => (
                      <Button
                        key={char.id}
                        variant="ghost"
                        className="w-full justify-start text-sm h-10"
                        onClick={() => generateMoment(char)}
                        disabled={generating}
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-2 overflow-hidden">
                          {char.avatar_url ? (
                            <img src={char.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs">{char.name[0]}</span>
                          )}
                        </div>
                        <span className="truncate">{char.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>


        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadBackground}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadAvatar}
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
        <TabsContent value="diary" className="p-4 space-y-4 pb-24 mt-0">
          {spaceLogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>还没有日志</p>
              <p className="text-sm mt-1">点击右下角发布第一篇日志</p>
            </div>
          ) : (
            <div className="space-y-3">
              {spaceLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl p-4 border border-border/50 cursor-pointer hover:bg-card/80 transition-colors"
                  onClick={() => setViewingLog(log)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{log.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{log.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatTime(log.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteLogId(log.id);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 留言板 Tab */}
        <TabsContent value="guestbook" className="p-4 space-y-4 pb-24 mt-0">
          {/* Post Guestbook */}
          <div className="bg-card rounded-xl p-4 border border-border/50 space-y-3">
            {/* 回复指定角色提示 */}
            {guestbookReplyTarget && (
              <div className="flex items-center gap-2 text-sm bg-primary/5 px-3 py-2 rounded-lg">
                <span className="text-muted-foreground">正在回复</span>
                <span className="text-primary font-medium">@{guestbookReplyTarget.charName}</span>
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  onClick={() => setGuestbookReplyTarget(null)}
                >
                  ✕
                </button>
              </div>
            )}
            
            <Textarea
              value={newGuestbookContent}
              onChange={(e) => setNewGuestbookContent(e.target.value)}
              placeholder={guestbookReplyTarget ? `回复 @${guestbookReplyTarget.charName}...` : "写点什么..."}
              className="min-h-[80px] resize-none"
            />
            
            {/* 选择回复角色（没有指定回复目标时显示） */}
            {characters.length > 0 && !guestbookReplyTarget && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">选择回复的角色（不选则随机）</p>
                <div className="flex flex-wrap gap-2">
                  {characters.map(char => (
                    <button
                      key={char.id}
                      onClick={() => {
                        setSelectedGuestbookChars(prev => {
                          const next = new Set(prev);
                          if (next.has(char.id)) {
                            next.delete(char.id);
                          } else {
                            next.add(char.id);
                          }
                          return next;
                        });
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedGuestbookChars.has(char.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-primary/20 shrink-0">
                        {char.avatar_url ? (
                          <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">
                            {char.name[0]}
                          </div>
                        )}
                      </div>
                      <span>{char.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <Button 
              onClick={handleGuestbookPost}
              disabled={!newGuestbookContent.trim() || postingGuestbook}
              className="w-full"
            >
              {postingGuestbook ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {guestbookReplyTarget ? `回复 ${guestbookReplyTarget.charName}` : '发布留言'}
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
                    <span className="font-medium text-sm flex-1">
                      {entry.is_character_reply ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            const charName = entry.character?.name;
                            if (charName) {
                              setGuestbookReplyTarget({ entryId: entry.id, charName });
                            }
                          }}
                        >
                          <span className="text-primary">{entry.character?.name || 'AI角色'}</span>
                          <span className="text-muted-foreground mx-1">回复</span>
                          <span className="text-foreground">{userProfile?.nickname || '我'}</span>
                        </button>
                      ) : (
                        <span className="text-foreground">{userProfile?.nickname || '我'}</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(entry.created_at)}
                    </span>
                    {/* 回复按钮（角色留言可点击回复） */}
                    {entry.is_character_reply && entry.character?.name && (
                      <button
                        onClick={() => setGuestbookReplyTarget({ entryId: entry.id, charName: entry.character!.name })}
                        className="p-1 hover:bg-primary/10 rounded transition-colors text-primary"
                        title={`回复 ${entry.character.name}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
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
                className="min-h-[100px] resize-none"
              />
              
              {/* 选择回复角色 */}
              {characters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">选择回复的角色（不选则随机）</p>
                  <div className="flex flex-wrap gap-2">
                    {characters.map(char => (
                      <button
                        key={char.id}
                        onClick={() => {
                          setSelectedReplyChars(prev => {
                            const next = new Set(prev);
                            if (next.has(char.id)) {
                              next.delete(char.id);
                            } else {
                              next.add(char.id);
                            }
                            return next;
                          });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                          selectedReplyChars.has(char.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-primary/20 shrink-0">
                          {char.avatar_url ? (
                            <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">
                              {char.name[0]}
                            </div>
                          )}
                        </div>
                        <span>{char.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
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

      {/* Delete Log Confirm */}
      <AlertDialog open={!!deleteLogId} onOpenChange={() => setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这篇日志吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLogId && handleDeleteLog(deleteLogId)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Log Dialog */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingLog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{viewingLog && formatTime(viewingLog.created_at)}</p>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{viewingLog?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Log Dialog */}
      {activeTab === 'diary' && (
        <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>发布日志</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={newLogTitle}
                onChange={(e) => setNewLogTitle(e.target.value)}
                placeholder="日志标题"
              />
              <Textarea
                value={newLogContent}
                onChange={(e) => setNewLogContent(e.target.value)}
                placeholder="写下你的日志内容..."
                className="min-h-[200px] resize-none"
              />
              <Button 
                onClick={handlePostLog}
                disabled={!newLogTitle.trim() || !newLogContent.trim() || postingLog}
                className="w-full"
              >
                {postingLog ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                发布
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SpacePage;
