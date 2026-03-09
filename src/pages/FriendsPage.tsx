import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getSupabaseUrl } from '@/lib/supabaseUrl';
import { ChevronLeft, Plus, User, MoreVertical, Pencil, Trash2, X, Camera, Brain, RefreshCw, Settings, Gift, Upload, Brush, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { detectSensitiveWords, replaceSensitiveWords, DetectionResult } from '@/utils/sensitiveWordChecker';
import SensitiveWordWarning from '@/components/SensitiveWordWarning';
import { useCharactersCache } from '@/hooks/useLocalCache';


// 格式化消息时间
const formatMessageTime = (timeStr: string): string => {
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 截断消息内容
const truncateMessage = (content: string, maxLength: number = 30): string => {
  // 移除格式字符
  const cleaned = content
    .replace(/\[.*?\]/g, '[图片]')
    .replace(/\|+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
};

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, authSource } = useAuth();
  const [characters, setCharacters] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [openingLine, setOpeningLine] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<any>(null);
  const [memorySummary, setMemorySummary] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [regeneratingMemory, setRegeneratingMemory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [replyMode, setReplyMode] = useState<'online' | 'novel'>('online');
  const [useNovelFormat, setUseNovelFormat] = useState(false);
  const [voiceId, setVoiceId] = useState('');
  const [ringtoneUrl, setRingtoneUrl] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [uploadingRingtone, setUploadingRingtone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  
  // 敏感词检测相关状态
  const [sensitiveWarningOpen, setSensitiveWarningOpen] = useState(false);
  const [sensitiveResult, setSensitiveResult] = useState<DetectionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<'create' | 'update' | null>(null);
  
  // NovelAI 角色专属提示词
  const [naiPromptOpen, setNaiPromptOpen] = useState(false);
  const [naiPositivePrompt, setNaiPositivePrompt] = useState('');
  const [naiNegativePrompt, setNaiNegativePrompt] = useState('');
  // NovelAI 角色专属垫图设置
  const [naiReferenceImage, setNaiReferenceImage] = useState('');
  
  const [uploadingRefImage, setUploadingRefImage] = useState(false);
  const naiRefImageInputRef = useRef<HTMLInputElement>(null);

  // 本地缓存 Hook
  const { getCache: getCachedCharacters, setCache: cacheCharacters } = useCharactersCache(user?.id);

  // 全部标记已读
  const markAllAsRead = async () => {
    if (!user || characters.length === 0) return;
    const hasUnread = characters.some(c => c.unreadCount > 0);
    if (!hasUnread) return;
    
    const unreadChars = characters.filter(c => c.unreadCount > 0);
    const now = new Date().toISOString();
    
    // 逐个处理，先尝试 update，失败则 insert，避免 upsert 在无唯一约束时静默失败
    for (const c of unreadChars) {
      const { data: existing } = await supabase
        .from('chat_read_status')
        .select('id')
        .eq('user_id', user.id)
        .eq('character_id', c.id)
        .maybeSingle();
      
      if (existing) {
        await supabase.from('chat_read_status').update({ last_read_at: now }).eq('user_id', user.id).eq('character_id', c.id);
      } else {
        await supabase.from('chat_read_status').insert({ user_id: user.id, character_id: c.id, last_read_at: now });
      }
    }
    
    setCharacters(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
    cacheCharacters(characters.map(c => ({ ...c, unreadCount: 0 })));
    toast.success('已全部标记为已读');
  };

  // 初始化：先读取缓存，再从服务器更新
  useEffect(() => {
    if (user) {
      // 1. 先从缓存快速显示
      const cached = getCachedCharacters();
      if (cached && cached.length > 0) {
        console.log('[Cache] 从缓存加载好友列表，秒开界面');
        setCharacters(cached);
      }
      // 2. 然后从服务器获取最新数据
      fetchCharacters();
    }
  }, [user]);

  const fetchCharacters = async () => {
    if (!user?.id) return;
    // 获取角色列表
    const { data: charData } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user.id);
    
    if (!charData) return;
    
    // 并行获取：最后消息 + 已读状态（减少等待时间，提升列表打开速度）
    const [lastMessagesRes, readStatusRes] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('character_id, created_at, content, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        // 只需要最近一段用于：最后一条消息 + 未读计数，避免拉取过多导致卡顿
        .limit(500),
      supabase
        .from('chat_read_status')
        .select('character_id, last_read_at')
        .eq('user_id', user.id),
    ]);

    const lastMessages = lastMessagesRes.data;
    const readStatus = readStatusRes.data;
    
    // 创建已读时间映射
    const readTimeMap: Record<string, string> = {};
    if (readStatus) {
      for (const status of readStatus) {
        readTimeMap[status.character_id] = status.last_read_at;
      }
    }
    
    // 创建角色最后聊天时间和消息映射
    const lastChatMap: Record<string, { time: string; content: string; role: string }> = {};
    const unreadCountMap: Record<string, number> = {};
    
    if (lastMessages) {
      for (const msg of lastMessages) {
        // 记录最后一条消息
        if (!lastChatMap[msg.character_id]) {
          lastChatMap[msg.character_id] = {
            time: msg.created_at,
            content: msg.content,
            role: msg.role
          };
        }
        
        // 计算未读消息数（只计算assistant的消息）
        if (msg.role === 'assistant') {
          const lastReadTime = readTimeMap[msg.character_id];
          if (!lastReadTime || new Date(msg.created_at) > new Date(lastReadTime)) {
            unreadCountMap[msg.character_id] = (unreadCountMap[msg.character_id] || 0) + 1;
          }
        }
      }
    }
    
    // 按最后聊天时间排序，最近聊天的排在前面
    const sortedChars = charData.map(char => ({
      ...char,
      lastMessage: lastChatMap[char.id]?.content || char.opening_line,
      lastMessageRole: lastChatMap[char.id]?.role || 'assistant',
      lastMessageTime: lastChatMap[char.id]?.time,
      unreadCount: unreadCountMap[char.id] || 0
    })).sort((a, b) => {
      const aTime = a.lastMessageTime || a.created_at;
      const bTime = b.lastMessageTime || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    
    setCharacters(sortedChars);
    // 缓存到 LocalStorage
    cacheCharacters(sortedChars);
    console.log('[Cache] 好友列表已更新并缓存');
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true });
    
    if (error) {
      console.error('Avatar upload error:', error);
      toast.error('头像上传失败: ' + error.message);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  // 上传铃声
  const handleRingtoneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !editingChar) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const extOk = ['mp3', 'm4a', 'mp4', 'wav', 'ogg', 'aac'].includes(ext);
    const typeOk = file.type ? file.type.startsWith('audio/') : extOk;

    if (!typeOk) {
      console.log('[ringtone] invalid file type:', { name: file.name, type: file.type });
      toast.error('请选择音频文件（mp3/m4a/wav/ogg）');
      e.target.value = '';
      return;
    }

    const guessContentType = () => {
      if (file.type) return file.type;
      switch (ext) {
        case 'mp3':
          return 'audio/mpeg';
        case 'm4a':
        case 'mp4':
          return 'audio/mp4';
        case 'wav':
          return 'audio/wav';
        case 'ogg':
          return 'audio/ogg';
        case 'aac':
          return 'audio/aac';
        default:
          return 'application/octet-stream';
      }
    };

    setUploadingRingtone(true);
    try {
      // 使用已存在且可用的 bucket（avatars）存储铃声，避免 bucket 权限/不存在导致上传失败
      const bucket = 'avatars';
      const fileName = `${user.id}/ringtones/${Date.now()}.${ext || 'mp3'}`;

      console.log('[ringtone] uploading...', { bucket, fileName, size: file.size, type: file.type });

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true, contentType: guessContentType() });

      if (error) {
        console.error('Upload ringtone error:', error);
        toast.error(`铃声上传失败：${error.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      console.log('[ringtone] uploaded:', publicUrl);
      setRingtoneUrl(publicUrl);

      const { error: dbError } = await supabase
        .from('characters')
        .update({ ringtone_url: publicUrl })
        .eq('id', editingChar.id);

      if (dbError) {
        console.error('Save ringtone_url error:', dbError);
        toast.error(`保存铃声失败：${dbError.message}`);
        return;
      }

      toast.success('铃声已上传');
    } catch (err) {
      console.error('Upload ringtone error:', err);
      toast.error('铃声上传失败');
    } finally {
      setUploadingRingtone(false);
      e.target.value = '';
    }
  };

  // 检查敏感词并处理保存
  const checkAndSave = (action: 'create' | 'update') => {
    const result = detectSensitiveWords(persona);
    
    if (result.found) {
      setSensitiveResult(result);
      setPendingAction(action);
      setSensitiveWarningOpen(true);
    } else {
      // 没有敏感词，直接保存
      if (action === 'create') {
        doCreateCharacter();
      } else {
        doUpdateCharacter();
      }
    }
  };
  
  // 确认保存（用户选择继续）
  const handleConfirmSave = () => {
    setSensitiveWarningOpen(false);
    if (pendingAction === 'create') {
      doCreateCharacter();
    } else if (pendingAction === 'update') {
      doUpdateCharacter();
    }
    setPendingAction(null);
    setSensitiveResult(null);
  };
  
  // 取消保存
  const handleCancelSave = () => {
    setSensitiveWarningOpen(false);
    setPendingAction(null);
    setSensitiveResult(null);
  };
  
  // 一键替换敏感词
  const handleAutoReplace = () => {
    const { newText, replacedCount, replacements } = replaceSensitiveWords(persona);
    
    if (replacedCount > 0) {
      setPersona(newText);
      setSensitiveWarningOpen(false);
      setSensitiveResult(null);
      setPendingAction(null);
      
      // 显示替换结果
      const replacementList = replacements.map(r => `「${r.original}」→「${r.replacement}」`).join('、');
      toast.success(`已替换 ${replacedCount} 处敏感词`, {
        description: replacementList.length > 50 ? replacementList.slice(0, 50) + '...' : replacementList,
        duration: 5000,
      });
    } else {
      toast.info('没有可自动替换的敏感词，请手动修改');
    }
  };

  const doCreateCharacter = async () => {
    if (!name.trim()) { 
      toast.error('请输入角色名'); 
      return; 
    }

    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      const uploadedUrl = await uploadAvatar();
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    const { error } = await supabase.from('characters').insert({ 
      user_id: user?.id, 
      name, 
      persona, 
      opening_line: openingLine || '你好呀~',
      avatar_url: finalAvatarUrl
    });
    
    if (error) {
      console.error('Character creation error:', error);
      toast.error('创建失败: ' + error.message);
      return;
    }
    
    toast.success('角色创建成功!');
    resetForm();
    setOpen(false);
    fetchCharacters();
  };
  
  // 对外暴露的创建函数（会先检查敏感词）
  const createCharacter = () => {
    if (!name.trim()) { 
      toast.error('请输入角色名'); 
      return; 
    }
    checkAndSave('create');
  };

  const doUpdateCharacter = async () => {
    if (!editingChar) return;
    
    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      const uploadedUrl = await uploadAvatar();
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    await supabase
      .from('characters')
      .update({ 
        name, 
        persona, 
        opening_line: openingLine,
        avatar_url: finalAvatarUrl,
        history_limit: historyLimit,
        transfer_enabled: transferEnabled,
        reply_mode: replyMode,
        use_novel_format: useNovelFormat,
        voice_id: voiceId || null,
        ringtone_url: ringtoneUrl || null,
        auto_reply_enabled: autoReplyEnabled
      })
      .eq('id', editingChar.id);
    
    // 同时保存角色专属NAI设置（垫图、提示词）
    await saveNaiPrompts(true);
    
    toast.success('角色已更新');
    resetForm();
    setEditingChar(null);
    setOpen(false);
    fetchCharacters();
  };
  
  // 对外暴露的更新函数（会先检查敏感词）
  const updateCharacter = () => {
    if (!editingChar) return;
    checkAndSave('update');
  };

  const deleteCharacter = async (id: string) => {
    await supabase.from('characters').delete().eq('id', id);
    toast.success('角色已删除');
    fetchCharacters();
  };

  const resetForm = () => {
    setName('');
    setPersona('');
    setOpeningLine('');
    setAvatarUrl('');
    setAvatarFile(null);
    setHistoryLimit(10);
    setTransferEnabled(true);
    setReplyMode('online');
    setUseNovelFormat(false);
    setVoiceId('');
    setRingtoneUrl('');
    setAutoReplyEnabled(false);
  };

  const openEditDialog = async (char: any) => {
    setEditingChar(char);
    setName(char.name);
    setPersona(char.persona || '');
    setOpeningLine(char.opening_line || '');
    setAvatarUrl(char.avatar_url || '');
    setHistoryLimit(char.history_limit ?? 10);
    setTransferEnabled(char.transfer_enabled ?? true);
    setReplyMode(char.reply_mode === 'novel' ? 'novel' : 'online');
    setUseNovelFormat(char.use_novel_format ?? false);
    setVoiceId(char.voice_id || '');
    setRingtoneUrl(char.ringtone_url || '');
    setAutoReplyEnabled(char.auto_reply_enabled ?? false);
    setMemorySummary('');
    setNaiPositivePrompt('');
    setNaiNegativePrompt('');
    setNaiReferenceImage('');
    setOpen(true);
    
    // 并行加载记忆摘要和NAI提示词（包括垫图设置）
    setMemoryLoading(true);
    try {
      const [memoryRes, naiRes] = await Promise.all([
        supabase
          .from('character_memories')
          .select('summary')
          .eq('character_id', char.id)
          .eq('user_id', user?.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('api_keys')
          .select('provider, api_key')
          .eq('user_id', user?.id)
          .in('provider', [
            `nai_positive_${char.id}`, 
            `nai_negative_${char.id}`,
            `nai_ref_image_${char.id}`
          ])
      ]);
      
      if (memoryRes.data?.summary) {
        setMemorySummary(memoryRes.data.summary);
      }
      
      if (naiRes.data) {
        const positiveRow = naiRes.data.find(r => r.provider === `nai_positive_${char.id}`);
        const negativeRow = naiRes.data.find(r => r.provider === `nai_negative_${char.id}`);
        const refImageRow = naiRes.data.find(r => r.provider === `nai_ref_image_${char.id}`);
        if (positiveRow) setNaiPositivePrompt(positiveRow.api_key);
        if (negativeRow) setNaiNegativePrompt(negativeRow.api_key);
        if (refImageRow) setNaiReferenceImage(refImageRow.api_key);
      }
    } catch (err) {
      console.error('Failed to load character data:', err);
    } finally {
      setMemoryLoading(false);
    }
  };

  // 上传垫图
  const handleRefImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !editingChar) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      e.target.value = '';
      return;
    }
    
    setUploadingRefImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/nai-ref/${editingChar.id}-${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      
      if (error) {
        console.error('Upload ref image error:', error);
        toast.error('上传失败');
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      setNaiReferenceImage(publicUrl);
      toast.success('垫图已上传');
    } catch (err) {
      console.error('Upload ref image error:', err);
      toast.error('上传失败');
    } finally {
      setUploadingRefImage(false);
      e.target.value = '';
    }
  };

  // 保存角色专属NAI设置（提示词+垫图）
  const saveNaiPrompts = async (silent = false) => {
    if (!editingChar || !user) return;
    
    try {
      const providers = [
        `nai_positive_${editingChar.id}`, 
        `nai_negative_${editingChar.id}`,
        `nai_ref_image_${editingChar.id}`
      ];
      await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providers);
      
      const rows = [];
      if (naiPositivePrompt.trim()) {
        rows.push({ user_id: user.id, provider: `nai_positive_${editingChar.id}`, api_key: naiPositivePrompt.trim() });
      }
      if (naiNegativePrompt.trim()) {
        rows.push({ user_id: user.id, provider: `nai_negative_${editingChar.id}`, api_key: naiNegativePrompt.trim() });
      }
      if (naiReferenceImage.trim()) {
        rows.push({ user_id: user.id, provider: `nai_ref_image_${editingChar.id}`, api_key: naiReferenceImage.trim() });
      }
      
      if (rows.length > 0) {
        await supabase.from('api_keys').insert(rows);
      }
      
      if (!silent) setNaiPromptOpen(false);
      if (!silent) toast.success('角色NAI设置已保存');
    } catch (err) {
      console.error('Save NAI prompts error:', err);
      toast.error('保存失败');
    }
  };

  // 清空角色专属NAI设置
  const clearNaiPrompts = async () => {
    if (!editingChar || !user) return;
    
    try {
      const providers = [
        `nai_positive_${editingChar.id}`, 
        `nai_negative_${editingChar.id}`,
        `nai_ref_image_${editingChar.id}`
      ];
      await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providers);
      
      setNaiPositivePrompt('');
      setNaiNegativePrompt('');
      setNaiReferenceImage('');
      
      setNaiPromptOpen(false);
      toast.success('角色NAI设置已清空');
    } catch (err) {
      console.error('Clear NAI prompts error:', err);
      toast.error('清空失败');
    }
  };

  const handleDialogClose = () => {
    setOpen(false);
    setEditingChar(null);
    resetForm();
    setMemorySummary('');
  };

  const saveMemory = async () => {
    if (!editingChar || !user) return;
    
    try {
      const basePayload = {
        character_id: editingChar.id,
        user_id: user.id,
        summary: memorySummary,
        updated_at: new Date().toISOString(),
      };

      const payload = {
        ...basePayload,
        manually_edited: true,
      };

      const hasMissingOnConflictConstraint = (error: any) =>
        error?.code === '42P10' ||
        String(error?.message || '').includes('no unique or exclusion constraint matching the ON CONFLICT specification');

      const writeMemory = async (writePayload: Record<string, unknown>) => {
        let { error } = await supabase
          .from('character_memories')
          .upsert(writePayload as any, {
            onConflict: 'character_id,user_id'
          });

        if (!error) return null;
        if (!hasMissingOnConflictConstraint(error)) return error;

        const { data: updatedRows, error: updateError } = await supabase
          .from('character_memories')
          .update(writePayload as any)
          .eq('character_id', editingChar.id)
          .eq('user_id', user.id)
          .select('id')
          .limit(1);

        if (updateError) return updateError;
        if ((updatedRows?.length || 0) > 0) return null;

        const { error: insertError } = await supabase
          .from('character_memories')
          .insert(writePayload as any);

        return insertError || null;
      };

      let error = await writeMemory(payload);

      // 兼容外部数据库旧结构（无 manually_edited 字段）
      if (error?.code === 'PGRST204' && String(error.message || '').includes('manually_edited')) {
        error = await writeMemory(basePayload);
      }
      
      if (error) throw error;
      toast.success('记忆已保存');
    } catch (err: any) {
      console.error('Failed to save memory:', err);
      toast.error(`保存失败：${err?.message || '请稍后重试'}`);
    }
  };

  const regenerateMemory = async () => {
    if (!editingChar || !user) return;
    
    setRegeneratingMemory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${getSupabaseUrl()}/functions/v1/generate-memory-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          characterId: editingChar.id,
          userId: user.id,
          characterName: editingChar.name,
          characterPersona: editingChar.persona,
          authSource,
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        if (data.summary) {
          setMemorySummary(data.summary);
          toast.success('记忆已重新生成');
        } else {
          toast.info(data.message || '消息不足，无法生成摘要');
        }
      } else {
        toast.error('生成失败');
      }
    } catch (err) {
      console.error('Failed to regenerate memory:', err);
      toast.error('生成失败');
    } finally {
      setRegeneratingMemory(false);
    }
  };

  // 导入角色卡（简单JSON格式）
  const handleImportCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 简单格式: { name, persona, opening_line }
      if (!data.name) {
        toast.error('无效的角色文件：缺少角色名称');
        return;
      }
      
      // 创建角色
      const { error } = await supabase.from('characters').insert({
        user_id: user.id,
        name: data.name,
        persona: data.persona || '',
        opening_line: data.opening_line || '',
      });
      
      if (error) {
        console.error('Import character error:', error);
        toast.error('导入角色失败: ' + error.message);
        return;
      }
      
      toast.success(`成功导入角色: ${data.name}`);
      fetchCharacters();
      
    } catch (err) {
      console.error('Import error:', err);
      toast.error('导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelect}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".png,.json,.jsonl"
        className="hidden"
        onChange={handleImportCard}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/home')}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </Button>
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-bold text-gray-700">好友</h1>
          {characters.some(c => c.unreadCount > 0) && (
            <button
              onClick={markAllAsRead}
              className="ml-1 p-1 rounded-full text-pink-500 hover:bg-pink-50 transition-colors"
              title="全部已读"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
        </div>
        <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleDialogClose()}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-pink-500"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl bg-white/95 backdrop-blur-sm border-0 shadow-2xl max-w-sm mx-auto max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-center text-gray-700">
                {editingChar ? '编辑角色' : '创建新角色'}
              </DialogTitle>
            </DialogHeader>
            
            {editingChar ? (
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-3 rounded-xl bg-gray-100">
                  <TabsTrigger value="basic" className="rounded-lg text-xs">基本信息</TabsTrigger>
                  <TabsTrigger value="settings" className="rounded-lg text-xs">
                    <Settings className="w-3 h-3 mr-1" />
                    设置
                  </TabsTrigger>
                  <TabsTrigger value="memory" className="rounded-lg text-xs">
                    <Brain className="w-3 h-3 mr-1" />
                    记忆
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 mt-4">
                  {/* Avatar Upload */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        <Plus className="w-8 h-8 text-white" />
                      )}
                    </button>
                  </div>
                  
                  <Input 
                    placeholder="角色名称" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="rounded-xl bg-gray-50 border-gray-200"
                  />
                  <Textarea 
                    placeholder="角色人设（性格、背景、说话风格等）" 
                    value={persona} 
                    onChange={(e) => setPersona(e.target.value)} 
                    rows={3}
                    className="rounded-xl bg-gray-50 border-gray-200"
                  />
                  <Input 
                    placeholder="开场白" 
                    value={openingLine} 
                    onChange={(e) => setOpeningLine(e.target.value)}
                    className="rounded-xl bg-gray-50 border-gray-200"
                  />
                  <Button 
                    className="w-full rounded-xl py-6 bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg" 
                    onClick={updateCharacter}
                  >
                    保存修改
                  </Button>
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4 mt-4">
                  {/* History Limit */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">历史消息数量</p>
                        <p className="text-xs text-gray-400">发送给AI的历史消息条数</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[3, 5, 10, 15, 20].map((limit) => (
                        <button
                          key={limit}
                          onClick={() => setHistoryLimit(limit)}
                          className={`py-2 rounded-xl text-sm font-medium transition-all ${
                            historyLimit === limit
                              ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Reply Mode */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">回复模式</p>
                        <p className="text-xs text-gray-400">影响角色的互动方式和功能</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setReplyMode('online')}
                        className={`p-3 rounded-xl text-left transition-all border-2 ${
                          replyMode === 'online'
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>💬</span>
                          <span className={`text-sm font-medium ${replyMode === 'online' ? 'text-blue-600' : 'text-gray-700'}`}>
                            在线模式
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          模拟真实聊天，支持连续消息、拉黑互动、表情包等
                        </p>
                      </button>
                      <button
                        onClick={() => setReplyMode('novel')}
                        className={`p-3 rounded-xl text-left transition-all border-2 ${
                          replyMode === 'novel'
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>📖</span>
                          <span className={`text-sm font-medium ${replyMode === 'novel' ? 'text-purple-600' : 'text-gray-700'}`}>
                            小说模式
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          适合VN剧场、RP扮演，回复更有故事性
                        </p>
                      </button>
                    </div>
                    {replyMode === 'novel' && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                        ⚠️ 小说模式下拉黑互动功能不生效
                      </p>
                    )}
                    
                    {/* Novel Format Toggle - only show in novel mode */}
                    {replyMode === 'novel' && (
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          <div>
                            <p className="font-medium text-purple-700 text-sm">使用指令格式</p>
                            <p className="text-xs text-purple-500">AI回复自动使用 /旁白 /对话 /动作 /想法 格式</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setUseNovelFormat(!useNovelFormat)}
                          className={`w-12 h-6 rounded-full transition-all ${
                            useNovelFormat ? 'bg-purple-400' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            useNovelFormat ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Auto Reply Toggle - only show in online mode */}
                  {replyMode === 'online' && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-200">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💬</span>
                        <div>
                          <p className="font-medium text-blue-700 text-sm">沉默自动回复</p>
                          <p className="text-xs text-blue-500">你2分钟不说话时，角色会主动找你聊天</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                        className={`w-12 h-6 rounded-full transition-all ${
                          autoReplyEnabled ? 'bg-blue-400' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          autoReplyEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  )}
                  
                  {/* Transfer Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-pink-500" />
                      <div>
                        <p className="font-medium text-gray-700 text-sm">转账功能</p>
                        <p className="text-xs text-gray-400">允许角色给你发红包</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTransferEnabled(!transferEnabled)}
                      className={`w-12 h-6 rounded-full transition-all ${
                        transferEnabled ? 'bg-pink-400' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        transferEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  {/* Voice ID */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎙️</span>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">语音ID</p>
                        <p className="text-xs text-gray-400">用于TTS语音合成的声音ID</p>
                      </div>
                    </div>
                    <Input
                      placeholder="输入语音ID（从TTS服务获取）"
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value)}
                      className="rounded-xl bg-gray-50 border-gray-200"
                    />
                    <p className="text-xs text-gray-400">
                      不同TTS服务的语音ID格式不同，请参考对应服务的文档
                    </p>
                  </div>
                  
                  {/* Ringtone Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📞</span>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">来电铃声</p>
                        <p className="text-xs text-gray-400">语音/视频通话的自定义铃声</p>
                      </div>
                    </div>
                    <input
                      ref={ringtoneInputRef}
                      type="file"
                      accept="audio/*,video/mp4,.mp3,.m4a,.wav,.ogg,.aac,.mp4"
                      className="hidden"
                      onChange={handleRingtoneUpload}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl bg-gray-50 border-gray-200"
                        onClick={() => ringtoneInputRef.current?.click()}
                        disabled={uploadingRingtone}
                      >
                        {uploadingRingtone ? '上传中...' : (ringtoneUrl ? '更换铃声' : '上传铃声')}
                      </Button>
                      {ringtoneUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl"
                          onClick={() => {
                            const audio = new Audio(ringtoneUrl);
                            audio.volume = 0.5;
                            audio.play();
                            setTimeout(() => audio.pause(), 3000);
                          }}
                        >
                          ▶️
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">建议上传5-15秒的音频文件</p>
                    {ringtoneUrl && (
                      <p className="text-xs text-green-500">✓ 已设置自定义铃声</p>
                    )}
                  </div>
                  
                  {/* 垫图设置 - 直接在角色编辑页显示 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🖼️</span>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">垫图 (Reference Image)</p>
                          <p className="text-xs text-gray-400">AI绘图时以此图为基础重绘</p>
                        </div>
                      </div>
                      {naiReferenceImage && (
                        <button
                          onClick={() => setNaiReferenceImage('')}
                          className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-500"
                        >
                          移除
                        </button>
                      )}
                    </div>
                    
                    <input
                      ref={naiRefImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleRefImageUpload}
                    />
                    
                    {naiReferenceImage ? (
                      <div className="relative">
                        <img
                          src={naiReferenceImage}
                          alt="Reference"
                          className="w-full max-h-32 object-contain rounded-xl border border-gray-200"
                        />
                        <button
                          onClick={() => naiRefImageInputRef.current?.click()}
                          disabled={uploadingRefImage}
                          className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg text-xs font-medium text-gray-700 hover:bg-white shadow"
                        >
                          {uploadingRefImage ? '上传中...' : '更换'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => naiRefImageInputRef.current?.click()}
                        disabled={uploadingRefImage}
                        className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
                      >
                        {uploadingRefImage ? (
                          <>上传中...</>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            点击上传垫图
                          </>
                        )}
                      </button>
                    )}
                    
                  </div>

                  {/* NAI 角色专属提示词 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎨</span>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">角色专属NAI提示词</p>
                        <p className="text-xs text-gray-400">仅用于该角色的NovelAI出图</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl bg-pink-50 border-pink-200 text-pink-600 hover:bg-pink-100"
                      onClick={() => setNaiPromptOpen(true)}
                    >
                      <Brush className="w-4 h-4 mr-2" />
                      配置NAI提示词
                    </Button>
                    {(naiPositivePrompt || naiNegativePrompt) && (
                      <p className="text-xs text-green-500">
                        ✓ 已配置提示词
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    className="w-full rounded-xl py-6 bg-gradient-to-r from-blue-400 to-cyan-400 text-white shadow-lg" 
                    onClick={updateCharacter}
                  >
                    保存设置
                  </Button>
                </TabsContent>

        {/* NAI 角色专属提示词弹窗 */}
        <Dialog open={naiPromptOpen} onOpenChange={setNaiPromptOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>角色专属NAI提示词配置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-700">
                  💡 这里配置的提示词仅用于当前角色的NAI出图，不影响其他角色或系统设置
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">正面提示词 (Positive Prompt)</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        // 选择全部文本
                        const textarea = document.getElementById('nai-positive-textarea') as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.select();
                          textarea.focus();
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                      title="全选文本"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => setNaiPositivePrompt('')}
                      className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-500"
                      title="清空"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <Textarea
                  id="nai-positive-textarea"
                  value={naiPositivePrompt}
                  onChange={(e) => setNaiPositivePrompt(e.target.value)}
                  className="rounded-xl min-h-[100px] font-mono text-sm"
                  placeholder="1boy, blue hair, ..."
                  style={{ wordBreak: 'break-all' }}
                />
                <p className="text-xs text-gray-400">描述你希望生成的图像风格，可填入画师串。点击文本框后可用 Ctrl+A 全选</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">负面提示词 (Negative Prompt)</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const textarea = document.getElementById('nai-negative-textarea') as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.select();
                          textarea.focus();
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                      title="全选文本"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => setNaiNegativePrompt('')}
                      className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-500"
                      title="清空"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <Textarea
                  id="nai-negative-textarea"
                  value={naiNegativePrompt}
                  onChange={(e) => setNaiNegativePrompt(e.target.value)}
                  className="rounded-xl min-h-[80px] font-mono text-sm"
                  placeholder="lowres, bad anatomy, ..."
                  style={{ wordBreak: 'break-all' }}
                />
                <p className="text-xs text-gray-400">描述你希望避免的元素</p>
              </div>
              
              {/* 垫图已移至角色编辑页面的设置标签 */}
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={clearNaiPrompts}
                  className="flex-1 py-3 rounded-xl bg-white border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors"
                >
                  清空全部
                </button>
                <button
                  onClick={() => saveNaiPrompts()}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-medium hover:shadow-lg transition-all"
                >
                  保存
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
                
                <TabsContent value="memory" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      角色对你的记忆摘要
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={regenerateMemory}
                      disabled={regeneratingMemory}
                      className="text-purple-500"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${regeneratingMemory ? 'animate-spin' : ''}`} />
                      {regeneratingMemory ? '生成中...' : '重新生成'}
                    </Button>
                  </div>
                  
                  {memoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                  ) : (
                    <Textarea 
                      placeholder="暂无记忆摘要。与角色聊天20条以上后会自动生成，或点击上方按钮手动生成。"
                      value={memorySummary} 
                      onChange={(e) => setMemorySummary(e.target.value)} 
                      rows={6}
                      className="rounded-xl bg-gray-50 border-gray-200 text-sm"
                    />
                  )}
                  
                  <p className="text-xs text-gray-400">
                    记忆会帮助角色记住你们的对话内容，让交流更加自然。你可以手动编辑或重新生成。
                  </p>
                  
                  <Button 
                    className="w-full rounded-xl py-6 bg-gradient-to-r from-purple-400 to-indigo-400 text-white shadow-lg" 
                    onClick={saveMemory}
                    disabled={memoryLoading}
                  >
                    保存记忆
                  </Button>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4 mt-4">
                {/* Avatar Upload */}
                <div className="flex justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <Plus className="w-8 h-8 text-white" />
                    )}
                  </button>
                </div>
                
                <Input 
                  placeholder="角色名称" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="rounded-xl bg-gray-50 border-gray-200"
                />
                <Textarea 
                  placeholder="角色人设（性格、背景、说话风格等）" 
                  value={persona} 
                  onChange={(e) => setPersona(e.target.value)} 
                  rows={3}
                  className="rounded-xl bg-gray-50 border-gray-200"
                />
                <Input 
                  placeholder="你好呀~" 
                  value={openingLine} 
                  onChange={(e) => setOpeningLine(e.target.value)}
                  className="rounded-xl bg-gray-50 border-gray-200"
                />
                <Button 
                  className="w-full rounded-xl py-6 bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg" 
                  onClick={createCharacter}
                >
                  创建角色
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Character List */}
      <div className="space-y-3">
        <AnimatePresence>
          {characters.map((char, i) => (
            <motion.div 
              key={char.id} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }} 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4"
            >
              {/* Avatar with pink border and unread badge */}
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => navigate(`/chat/${char.id}`)}
                  className="w-14 h-14 rounded-full border-2 border-pink-200 overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100"
                >
                  {char.avatar_url ? (
                    <img src={char.avatar_url} className="w-full h-full object-cover" alt={char.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-6 h-6 text-pink-300" />
                    </div>
                  )}
                </button>
                {/* Unread badge - outside overflow:hidden */}
                {char.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg z-10">
                    {char.unreadCount > 99 ? '99+' : char.unreadCount}
                  </span>
                )}
              </div>
              
              {/* Info with last message preview */}
              <button 
                onClick={() => navigate(`/chat/${char.id}`)}
                className="flex-1 text-left min-w-0"
              >
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${char.unreadCount > 0 ? 'text-gray-800' : 'text-gray-700'}`}>
                    {char.name}
                  </h3>
                  {char.lastMessageTime && (
                    <span className="text-xs text-gray-400">
                      {formatMessageTime(char.lastMessageTime)}
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate ${char.unreadCount > 0 ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                  {char.lastMessageRole === 'user' ? '我: ' : ''}
                  {truncateMessage(char.lastMessage || char.opening_line || '点击开始聊天')}
                </p>
              </button>
              
              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => openEditDialog(char)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deleteCharacter(char.id)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {characters.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>还没有好友，点击右上角创建</p>
          </div>
        )}
      </div>
      
      {/* 敏感词警告对话框 */}
      {sensitiveResult && (
        <SensitiveWordWarning
          open={sensitiveWarningOpen}
          onOpenChange={setSensitiveWarningOpen}
          result={sensitiveResult}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelSave}
          onAutoReplace={handleAutoReplace}
        />
      )}
    </div>
  );
};

export default FriendsPage;
