import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, RefreshCw, User, Send, Sparkles, Plus, Trash2, Image, Camera, BookOpen, MessageSquare, ChevronDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';
import {
  deleteLocalRows,
  getLocalTable,
  insertLocalRow,
  isLocalModeEnabled,
  updateLocalRows,
  upsertLocalRow,
} from '@/lib/localDataStore';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取本机文件失败'));
    reader.readAsDataURL(blob);
  });

interface MomentImagePrompt {
  id: string;
  prompt: string;
  imageUrl?: string;
}

interface Moment {
  id: string;
  content: string;
  image_url?: string;
  imagePrompts?: MomentImagePrompt[];
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

const normalizeMomentImagePrompts = (value: unknown): MomentImagePrompt[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      return [{ id: `prompt-${index}-${item.slice(0, 12)}`, prompt: item.trim() }];
    }
    if (item && typeof item === 'object') {
      const record = item as { id?: unknown; prompt?: unknown; imageUrl?: unknown };
      if (typeof record.prompt !== 'string' || !record.prompt.trim()) return [];
      return [{
        id: typeof record.id === 'string' ? record.id : `prompt-${index}-${record.prompt.slice(0, 12)}`,
        prompt: record.prompt.trim(),
        imageUrl: typeof record.imageUrl === 'string' && record.imageUrl ? record.imageUrl : undefined,
      }];
    }
    return [];
  });
};

const MOMENT_MEDIA_FALLBACK_PREFIX = '__dream_phone_moment_media__:';

const parseMomentMedia = (imageUrl: unknown, imagePrompts: unknown) => {
  if (typeof imageUrl === 'string' && imageUrl.startsWith(MOMENT_MEDIA_FALLBACK_PREFIX)) {
    try {
      const stored = JSON.parse(imageUrl.slice(MOMENT_MEDIA_FALLBACK_PREFIX.length)) as {
        images?: unknown;
        imagePrompts?: unknown;
      };
      return {
        images: Array.isArray(stored.images) ? stored.images.filter((item): item is string => typeof item === 'string') : [],
        imagePrompts: normalizeMomentImagePrompts(stored.imagePrompts),
      };
    } catch {
      return { images: [], imagePrompts: [] };
    }
  }
  return {
    images: typeof imageUrl === 'string' ? imageUrl.split(',').filter(Boolean) : [],
    imagePrompts: normalizeMomentImagePrompts(imagePrompts),
  };
};

const serializeMomentMediaFallback = (moment: Moment, imagePrompts: MomentImagePrompt[]) =>
  `${MOMENT_MEDIA_FALLBACK_PREFIX}${JSON.stringify({
    images: moment.image_url?.split(',').filter(Boolean) ?? [],
    imagePrompts,
  })}`;

const isMissingImagePromptsColumn = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown };
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  return (code === 'PGRST204' || code === '42703') && message.includes('image_prompts');
};

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
  const { user, authSource } = useAuth();
  const { apiConfig, isConfigured, loading: apiConfigLoading } = useAPIConfig();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{ nickname?: string; persona?: string; avatar_url?: string } | null>(null);
  const [spaceBackground, setSpaceBackground] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPromptIds, setGeneratingPromptIds] = useState<Set<string>>(new Set());
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
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const fetchUserProfileRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchSpaceBackgroundRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchCharactersRef = useRef<() => Promise<unknown>>(async () => undefined);
  const fetchMomentsRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchGuestbookRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchSpaceLogsRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode).catch(() => setLocalMode(false));
  }, [user?.id]);

  useEffect(() => {
    if (user && localMode !== null) {
      // 先加载角色，再加载说说和留言板（它们需要角色信息做 fallback）
      void fetchCharactersRef.current().then(() => {
        void fetchMomentsRef.current();
        void fetchGuestbookRef.current();
      });
      void fetchUserProfileRef.current();
      void fetchSpaceBackgroundRef.current();
      void fetchSpaceLogsRef.current();
    }
  }, [user, localMode]);

  const saveMoment = async (row: Record<string, unknown>) => {
    if (localMode && user?.id) return { data: await insertLocalRow(user.id, 'moments', row), error: null };
    return supabase.from('moments').insert(row as any).select().single();
  };

  const updateMoment = async (momentId: string, changes: Record<string, unknown>) => {
    if (localMode && user?.id) {
      await updateLocalRows(user.id, 'moments', (row) => row.id === momentId, changes);
      return;
    }
    const { error } = await supabase.from('moments').update(changes as any).eq('id', momentId);
    if (error) throw error;
  };

  const saveComment = async (row: Record<string, unknown>) => {
    if (localMode && user?.id) return { data: await insertLocalRow(user.id, 'comments', row), error: null };
    return supabase.from('comments').insert(row as any).select().single();
  };

  const saveGuestbookEntry = async (row: Record<string, unknown>) => {
    if (localMode && user?.id) return { data: await insertLocalRow(user.id, 'guestbook', row), error: null };
    return supabase.from('guestbook').insert(row as any).select().single();
  };

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    if (localMode) {
      const data = (await getLocalTable(user.id, 'profiles'))[0];
      if (data) setUserProfile(data);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('nickname, persona, avatar_url')
      .eq('user_id', user.id)
      .single();
    if (data) setUserProfile(data);
  };
  fetchUserProfileRef.current = fetchUserProfile;

  const fetchSpaceBackground = async () => {
    if (!user?.id) return;
    if (localMode) {
      const data = (await getLocalTable(user.id, 'customization'))[0];
      setSpaceBackground(data?.space_background_url ? String(data.space_background_url) : null);
      return;
    }
    const { data } = await supabase
      .from('customization')
      .select('space_background_url')
      .eq('user_id', user.id)
      .single();
    if (data?.space_background_url) setSpaceBackground(data.space_background_url);
  };
  fetchSpaceBackgroundRef.current = fetchSpaceBackground;

  const fetchCharacters = async () => {
    if (localMode && user?.id) {
      const data = await getLocalTable(user.id, 'characters');
      setCharacters(data);
      return data;
    }
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    if (data) {
      setCharacters(data);
      return data;
    }
    return [];
  };
  fetchCharactersRef.current = fetchCharacters;

  const fetchMoments = async () => {
    setLoading(true);
    if (localMode && user?.id) {
      const [localMoments, localComments, localCharacters] = await Promise.all([
        getLocalTable(user.id, 'moments'),
        getLocalTable(user.id, 'comments'),
        getLocalTable(user.id, 'characters'),
      ]);
      const data = localMoments
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .map((moment: any) => {
          const character = localCharacters.find((item) => item.id === moment.character_id);
          const media = parseMomentMedia(moment.image_url, moment.image_prompts);
          return {
            ...moment,
            image_url: media.images.join(',') || undefined,
            imagePrompts: media.imagePrompts,
            character,
            comments: localComments
              .filter((comment) => comment.moment_id === moment.id)
              .sort((a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime()),
            is_user_post: moment.is_user_post === true,
          };
        });
      setMoments(data);
      setLoading(false);
      return;
    }
    
    // 先尝试带 join 查询，如果失败则用分开查询
    let { data, error } = await supabase
      .from('moments')
      .select('*, characters(id, name, avatar_url, persona)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    // 如果 join 失败（外部数据库可能没有 foreign key），回退到单独查询
    if (error || !data) {
      console.warn('Moments join query failed, falling back:', error?.message);
      const { data: momentsOnly } = await supabase
        .from('moments')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      data = momentsOnly as any;
    }
    
    if (data) {
      const momentsWithComments = await Promise.all(
        data.map(async (moment: any) => {
          const media = parseMomentMedia(moment.image_url, moment.image_prompts);
          const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('moment_id', moment.id)
            .order('created_at');
          
          // 如果 join 没有返回 character 信息，从已加载的 characters 中查找
          let character = moment.characters;
          if (!character && moment.character_id) {
            const found = characters.find(c => c.id === moment.character_id);
            if (found) {
              character = { id: found.id, name: found.name, avatar_url: found.avatar_url, persona: found.persona };
            }
          }
          
          return {
            ...moment,
            image_url: media.images.join(',') || undefined,
            imagePrompts: media.imagePrompts,
            character,
            comments: comments || [],
            is_user_post: moment.is_user_post === true
          };
        })
      );
      setMoments(momentsWithComments);
    }
    setLoading(false);
  };
  fetchMomentsRef.current = fetchMoments;

  const fetchGuestbook = async () => {
    if (!user?.id) return;
    if (localMode) {
      const [entries, localCharacters] = await Promise.all([
        getLocalTable(user.id, 'guestbook'),
        getLocalTable(user.id, 'characters'),
      ]);
      setGuestbookEntries(entries
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .map((entry: any) => {
          const character = localCharacters.find((item) => item.id === entry.character_id);
          return { ...entry, character: character ? { name: character.name, avatar_url: character.avatar_url } : undefined };
        }));
      return;
    }
    
    // 先尝试带 join 查询
    let { data, error } = await supabase
      .from('guestbook')
      .select('*, characters(name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // 如果 join 失败，回退到单独查询
    if (error || !data) {
      console.warn('Guestbook join query failed, falling back:', error?.message);
      const { data: entriesOnly } = await supabase
        .from('guestbook')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      data = entriesOnly as any;
    }
    
    if (data) {
      setGuestbookEntries(data.map((entry: any) => {
        let character = entry.characters;
        // 如果 join 没返回角色信息，从已加载的 characters 中查找
        if (!character && entry.character_id) {
          const found = characters.find(c => c.id === entry.character_id);
          if (found) {
            character = { name: found.name, avatar_url: found.avatar_url };
          }
        }
        return { ...entry, character };
      }));
    }
  };
  fetchGuestbookRef.current = fetchGuestbook;

  const fetchSpaceLogs = async () => {
    if (!user?.id) return;
    if (localMode) {
      const data = await getLocalTable(user.id, 'space_logs');
      setSpaceLogs(data.sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()) as unknown as SpaceLog[]);
      return;
    }
    const { data } = await supabase
      .from('space_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSpaceLogs(data);
    }
  };
  fetchSpaceLogsRef.current = fetchSpaceLogs;

  const handlePostLog = async () => {
    if (!user?.id || !newLogTitle.trim() || !newLogContent.trim()) return;
    
    setPostingLog(true);
    try {
      const logRow = {
          user_id: user.id,
          title: newLogTitle.trim(),
          content: newLogContent.trim()
      };
      const { data, error } = localMode
        ? { data: await insertLocalRow(user.id, 'space_logs', logRow), error: null }
        : await supabase.from('space_logs').insert(logRow).select().single();

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
      let error = null;
      if (localMode && user?.id) {
        await deleteLocalRows(user.id, 'space_logs', (row) => row.id === logId);
      } else {
        error = (await supabase.from('space_logs').delete().eq('id', logId)).error;
      }

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
      // 压缩背景图（最大宽度1080px，质量0.8）
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 1080, 0.8);
      const compressedFile = blobToFile(compressedBlob, file.name);
      if (localMode) {
        const localUrl = await blobToDataUrl(compressedFile);
        await upsertLocalRow(
          user.id,
          'customization',
          () => true,
          { user_id: user.id, space_background_url: localUrl },
        );
        setSpaceBackground(localUrl);
        toast.success('背景已保存到本机');
        return;
      }
      
      const fileName = `${user.id}/space-bg-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
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
      // 压缩头像（512px，质量0.85）
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 512, 0.85);
      const compressedFile = blobToFile(compressedBlob, file.name);
      if (localMode) {
        const localUrl = await blobToDataUrl(compressedFile);
        setUserProfile((prev) => ({ nickname: prev?.nickname, persona: prev?.persona, avatar_url: localUrl }));
        await updateLocalRows(user.id, 'profiles', () => true, { avatar_url: localUrl });
        toast.success('头像已保存到本机');
        return;
      }
      
      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { upsert: true });

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
      // 动态导入压缩工具
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      
      for (const file of Array.from(files)) {
        // 压缩图片（最大宽度1080px，质量0.8）
        const compressedBlob = await compressImage(file, 1080, 0.8);
        const compressedFile = blobToFile(compressedBlob, file.name);
        if (localMode) {
          const localUrl = await blobToDataUrl(compressedFile);
          setPostImages((prev) => [...prev, localUrl]);
          continue;
        }
        
        const fileName = `${user.id}/moment-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
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
      let prepareImagePrompts: boolean | undefined;
      if (localMode && user?.id) {
        const localApiRows = await getLocalTable(user.id, 'api_keys');
        prepareImagePrompts = localApiRows.some(
          (row) => row.provider === 'space_image_enabled' && row.api_key === 'true',
        );
      }
      for (const char of selectedChars) {
        const { data, error } = await supabase.functions.invoke('generate-moment', {
          body: { 
            character: char, 
            type: 'moment',
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            userId: user?.id,
            authSource,
            prepareImagePrompts,
          }
        });

        if (error) throw error;

        const imagePrompts = normalizeMomentImagePrompts(
          (data.imagePrompts ?? []).slice(0, 3).map((prompt: string) => ({
            id: crypto.randomUUID(),
            prompt,
          })),
        );

        // 只保存配图提示词，不在发布动态时自动调用图片 API
        const momentRow = {
          user_id: user?.id,
          character_id: char.id,
          content: data.content,
          image_url: null,
          image_prompts: imagePrompts,
        };
        let saveResult = await saveMoment(momentRow);
        if (saveResult.error && isMissingImagePromptsColumn(saveResult.error)) {
          saveResult = await saveMoment({
            user_id: momentRow.user_id,
            character_id: momentRow.character_id,
            content: momentRow.content,
            image_url: `${MOMENT_MEDIA_FALLBACK_PREFIX}${JSON.stringify({ images: [], imagePrompts })}`,
          });
        }
        if (saveResult.error) throw saveResult.error;

        toast.success(`${char.name} 发布了新动态!${imagePrompts.length ? ' (配图待生成)' : ''}`);
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

      const { data: momentData, error } = await saveMoment({
        user_id: user?.id,
        character_id: characters[0].id,
        content: postContent || '分享了图片',
        image_url: imageUrl,
        is_user_post: true
      });

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
                userId: user?.id,
                authSource
              }
            });

            if (replyData?.content) {
              await saveComment({
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
      const { data: insertedEntry, error: insertError } = await saveGuestbookEntry({
        user_id: user?.id,
        content: contentToPost,
        is_character_reply: false,
        parent_id: guestbookReplyTarget?.entryId || null
      });

      if (insertError) throw insertError;

      toast.success('留言成功!');
      const originalContent = newGuestbookContent.trim();
      // AI reply should attach to the top-level entry, not to the user's nested reply
      const parentId = guestbookReplyTarget?.entryId || insertedEntry?.id || null;
      setNewGuestbookContent('');
      fetchGuestbook();

      // AI character reply
      if (characters.length > 0 && apiConfig?.apiKey) {
        let replyChars: any[];
        
        if (guestbookReplyTarget) {
          const targetChar = characters.find(c => c.name === guestbookReplyTarget.charName);
          replyChars = targetChar ? [targetChar] : [characters[Math.floor(Math.random() * characters.length)]];
        } else {
          replyChars = [characters[Math.floor(Math.random() * characters.length)]];
        }
        
        setGuestbookReplyTarget(null);

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
                userId: user?.id,
                authSource
              }
            });

            if (replyData?.content) {
              await saveGuestbookEntry({
                user_id: user?.id,
                content: replyData.content,
                character_id: char.id,
                is_character_reply: true,
                parent_id: parentId
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
      if (localMode && user?.id) {
        await deleteLocalRows(user.id, 'guestbook', (row) => row.id === entryId || row.parent_id === entryId);
      } else {
        await supabase.from('guestbook').delete().eq('id', entryId);
      }
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

    const likes = moment.likes + (isLiked ? -1 : 1);
    if (localMode && user?.id) {
      await updateLocalRows(user.id, 'moments', (row) => row.id === momentId, { likes });
    } else {
      await supabase.from('moments').update({ likes }).eq('id', momentId);
    }
  };

  const handleComment = async (moment: Moment) => {
    const raw = commentInputs[moment.id]?.trim();
    if (!raw) return;

    const images = [
      ...(moment.image_url?.split(',').filter(Boolean) || []),
      ...(moment.imagePrompts ?? []).flatMap((item) => item.imageUrl ? [item.imageUrl] : []),
    ];

    // 允许用户“点选某条角色评论 -> 回复该角色”，或手动输入 @角色名
    const atMatch = raw.match(/^@([^\s]+)\s+/);
    const explicitTargetName = atMatch?.[1]?.trim();
    const targetName = explicitTargetName || commentReplyTargets[moment.id];

    const normalizedContent = targetName && !explicitTargetName ? `@${targetName} ${raw}` : raw;

    await saveComment({
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
            authSource,
          },
        });

        if (data?.content) {
          await saveComment({
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
      if (localMode && user?.id) {
        await deleteLocalRows(user.id, 'comments', (row) => row.moment_id === momentId);
        await deleteLocalRows(user.id, 'moments', (row) => row.id === momentId);
      } else {
        await supabase.from('comments').delete().eq('moment_id', momentId);
        await supabase.from('moments').delete().eq('id', momentId);
      }
      toast.success('删除成功');
      fetchMoments();
    } catch (err) {
      toast.error('删除失败');
    }
    setDeleteId(null);
  };

  const getSpaceImageRequestConfig = async () => {
    if (!user?.id) throw new Error('登录状态已失效');
    const providers = [
      'space_image_enabled',
      'space_image_api_key',
      'space_image_api_url',
      'space_image_model',
      'space_image_size',
      'space_image_style_prompt',
    ];
    const rows = localMode
      ? await getLocalTable(user.id, 'api_keys')
      : ((await supabase
          .from('api_keys')
          .select('provider, api_key')
          .eq('user_id', user.id)
          .in('provider', providers)).data ?? []);
    const settings = new Map(
      rows.map((row) => [String(row.provider ?? ''), String(row.api_key ?? '')]),
    );
    if (settings.get('space_image_enabled') !== 'true') throw new Error('空间图片生成功能未开启');
    const apiKey = settings.get('space_image_api_key') ?? '';
    const apiUrl = settings.get('space_image_api_url') ?? '';
    if (!apiKey || !apiUrl) throw new Error('请先在设置中配置图片 API');
    return {
      apiKey,
      apiUrl,
      model: settings.get('space_image_model') ?? '',
      size: settings.get('space_image_size') ?? '1024x1024',
      stylePrompt: settings.get('space_image_style_prompt') ?? '',
    };
  };

  const updateMomentImagePrompts = async (moment: Moment, nextPrompts: MomentImagePrompt[]) => {
    try {
      await updateMoment(moment.id, { image_prompts: nextPrompts });
    } catch (error) {
      if (!isMissingImagePromptsColumn(error)) throw error;
      await updateMoment(moment.id, {
        image_url: serializeMomentMediaFallback(moment, nextPrompts),
      });
    }
  };

  const handleGeneratePromptImage = async (moment: Moment, promptItem: MomentImagePrompt) => {
    if (!user?.id || promptItem.imageUrl) return;
    const requestKey = `${moment.id}:${promptItem.id}`;
    if (generatingPromptIds.has(requestKey)) return;
    setGeneratingPromptIds((prev) => new Set(prev).add(requestKey));
    try {
      const config = await getSpaceImageRequestConfig();
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: promptItem.prompt,
          userId: user.id,
          testMode: true,
          apiKey: config.apiKey,
          apiUrl: config.apiUrl,
          model: config.model,
          size: config.size,
          stylePrompt: config.stylePrompt,
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.imageUrl) throw new Error(data?.error || '图片生成失败');

      const nextPrompts = (moment.imagePrompts ?? []).map((item) =>
        item.id === promptItem.id ? { ...item, imageUrl: data.imageUrl as string } : item,
      );
      await updateMomentImagePrompts(moment, nextPrompts);
      setMoments((prev) => prev.map((item) =>
        item.id === moment.id ? { ...item, imagePrompts: nextPrompts } : item,
      ));
      toast.success('配图生成成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片生成失败');
    } finally {
      setGeneratingPromptIds((prev) => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  };

  const handleDeleteImagePrompt = async (moment: Moment, promptId: string) => {
    const nextPrompts = (moment.imagePrompts ?? []).filter((item) => item.id !== promptId);
    try {
      await updateMomentImagePrompts(moment, nextPrompts);
      setMoments((prev) => prev.map((item) =>
        item.id === moment.id ? { ...item, imagePrompts: nextPrompts } : item,
      ));
    } catch {
      toast.error('删除配图失败');
    }
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
    const imagePrompts = (moment.imagePrompts ?? []).slice(0, 3);
    const mediaCount = Math.min(9, images.length + imagePrompts.length);
    
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
        {mediaCount > 0 && (
          <div className={`grid gap-1 mb-3 ${
            mediaCount === 1 ? 'grid-cols-1' :
            mediaCount === 2 ? 'grid-cols-2' :
            mediaCount === 4 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {images.slice(0, 9).map((img, idx) => (
              <div 
                key={`image-${idx}-${img.slice(0, 24)}`}
                className={`aspect-square overflow-hidden rounded-lg ${
                  mediaCount === 1 ? 'max-w-xs' : ''
                }`}
              >
                <img src={img} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
            {imagePrompts.slice(0, Math.max(0, 9 - images.length)).map((item) => {
              const requestKey = `${moment.id}:${item.id}`;
              const isGenerating = generatingPromptIds.has(requestKey);
              const momentIsGenerating = [...generatingPromptIds].some((key) => key.startsWith(`${moment.id}:`));
              if (item.imageUrl) {
                return (
                  <div key={item.id} className={`aspect-square overflow-hidden rounded-lg ${mediaCount === 1 ? 'max-w-xs' : ''}`}>
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  className={`relative flex aspect-square flex-col overflow-hidden rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 p-2 ${mediaCount === 1 ? 'max-w-xs' : ''}`}
                >
                  <button
                    type="button"
                    disabled={momentIsGenerating}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-destructive disabled:opacity-50"
                    onClick={() => handleDeleteImagePrompt(moment, item.id)}
                    aria-label="删除这张待生成配图"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="mt-6 line-clamp-4 break-words text-[11px] leading-relaxed text-muted-foreground">
                    {item.prompt}
                  </p>
                  <button
                    type="button"
                    disabled={momentIsGenerating}
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground shadow-sm disabled:opacity-70"
                    onClick={() => handleGeneratePromptImage(moment, item)}
                  >
                    {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
                    {isGenerating ? '生成中' : '生成'}
                  </button>
                </div>
              );
            })}
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

        {/* Comments Section - WeChat Style */}
        <AnimatePresence>
          {expandedComments[moment.id] && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden"
            >
              {/* WeChat-style compact comment list */}
              {moment.comments && moment.comments.length > 0 && (
                <div className="bg-muted/50 rounded-lg px-3 py-2 space-y-1.5">
                  {moment.comments.map((comment) => {
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
                      <div key={comment.id} className="text-sm leading-relaxed">
                        {comment.is_character_reply ? (
                          <>
                            <button
                              type="button"
                              className="text-primary font-medium hover:underline inline"
                              onClick={() => {
                                if (!charName) return;
                                setCommentReplyTargets((prev) => ({ ...prev, [moment.id]: charName }));
                              }}
                            >
                              {charName}
                            </button>
                            <span className="text-muted-foreground">回复</span>
                            <span className="font-medium text-foreground">{userName}</span>
                            <span className="text-muted-foreground">：</span>
                            <span className="text-foreground">{displayContent}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">{userName}</span>
                            {(replyToName || moment.character?.name) && (
                              <>
                                <span className="text-muted-foreground">回复</span>
                                <span className="text-primary font-medium">{replyToName || moment.character?.name}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">：</span>
                            <span className="text-foreground">{replyToMatch ? userDisplayContent : displayContent}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 回复提示 */}
              {commentReplyTargets[moment.id] && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-lg mt-2">
                  <span>回复</span>
                  <span className="text-primary font-medium">{commentReplyTargets[moment.id]}</span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground text-base"
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

              <div className="flex gap-2 mt-2">
                <Input
                  value={commentInputs[moment.id] || ''}
                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                  placeholder={commentReplyTargets[moment.id] ? `回复 ${commentReplyTargets[moment.id]}...` : "写评论..."}
                  className="flex-1 h-9 text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleComment(moment)}
                />
                <Button 
                  size="icon"
                  className="h-9 w-9"
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
            
            
            <Button 
              onClick={handleGuestbookPost}
              disabled={!newGuestbookContent.trim() || postingGuestbook}
              className="w-full"
            >
              {postingGuestbook ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {guestbookReplyTarget ? `回复 ${guestbookReplyTarget.charName}` : '发布留言'}
            </Button>
          </div>

          {/* Guestbook Entries - QQ Style Cards */}
          {guestbookEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>还没有留言</p>
            </div>
          ) : (() => {
            // Group: top-level user messages with their character replies
            const topLevel = guestbookEntries.filter(e => !e.is_character_reply && !e.parent_id);
            // Orphan character replies (old data without parent_id)
            const orphanReplies = guestbookEntries.filter(e => e.is_character_reply && !e.parent_id);
            // Build reply map by parent_id
            const replyMap = new Map<string, GuestbookEntry[]>();
            guestbookEntries.filter(e => e.parent_id).forEach(e => {
              const list = replyMap.get(e.parent_id!) || [];
              list.push(e);
              replyMap.set(e.parent_id!, list);
            });

            const allCards = [
              ...topLevel.map(entry => ({ entry, replies: replyMap.get(entry.id) || [] })),
              ...orphanReplies.map(entry => ({ entry, replies: [] as GuestbookEntry[] }))
            ];

            return (
              <div className="space-y-4">
                {allCards.map(({ entry, replies }, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl border border-border/50 overflow-hidden"
                  >
                    {/* Main message card */}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                          {entry.is_character_reply && entry.character?.avatar_url ? (
                            <img src={entry.character.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : userProfile?.avatar_url ? (
                            <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <User className="w-5 h-5 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">
                              {entry.is_character_reply ? (entry.character?.name || 'AI角色') : (userProfile?.nickname || '我')}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">{formatTime(entry.created_at)}</span>
                              <button
                                onClick={() => setDeleteGuestbookId(entry.id)}
                                className="p-1 hover:bg-destructive/10 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          </div>
                          <p className="text-foreground mt-2 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                        </div>
                      </div>
                    </div>

                    {/* WeChat-style compact replies */}
                    {replies.length > 0 && (
                      <div className="bg-muted/50 mx-4 mb-3 rounded-lg px-3 py-2 space-y-1">
                        {replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(reply => {
                          const replyName = reply.is_character_reply
                            ? (reply.character?.name || 'AI角色')
                            : (userProfile?.nickname || '我');
                          const targetName = reply.is_character_reply
                            ? (userProfile?.nickname || '我')
                            : null;
                          
                          return (
                            <div key={reply.id} className="text-sm leading-relaxed">
                              <button
                                type="button"
                                className="text-primary font-medium hover:underline inline"
                                onClick={() => {
                                  if (reply.is_character_reply && reply.character?.name) {
                                    setGuestbookReplyTarget({ entryId: entry.id, charName: reply.character.name });
                                  }
                                }}
                              >
                                {replyName}
                              </button>
                              {targetName && (
                                <>
                                  <span className="text-muted-foreground"> 回复 </span>
                                  <span className="font-medium text-foreground">{targetName}</span>
                                </>
                              )}
                              <span className="text-muted-foreground">：</span>
                              <span className="text-foreground">{reply.content}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply bar */}
                    <div 
                      className="bg-muted/30 px-4 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors border-t border-border/30"
                      onClick={() => {
                        // If this is a user post, pick first character to reply to, or just scroll to input
                        if (!entry.is_character_reply) {
                          // For user's own messages, just focus the input
                          const textarea = document.querySelector('textarea');
                          textarea?.focus();
                        } else if (entry.character?.name) {
                          setGuestbookReplyTarget({ entryId: entry.id, charName: entry.character.name });
                        }
                      }}
                    >
                      回复
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })()}
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
