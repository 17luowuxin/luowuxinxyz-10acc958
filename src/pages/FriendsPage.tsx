import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, User, MoreVertical, Pencil, Trash2, X, Camera, Brain, RefreshCw, Settings, Gift, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { detectSensitiveWords, replaceSensitiveWords, DetectionResult } from '@/utils/sensitiveWordChecker';
import SensitiveWordWarning from '@/components/SensitiveWordWarning';
import { parseCharacterCard, convertToAppFormat, extractAvatarFromFile } from '@/utils/characterCardParser';

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
  const { user } = useAuth();
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
  const [uploadingRingtone, setUploadingRingtone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  
  // 敏感词检测相关状态
  const [sensitiveWarningOpen, setSensitiveWarningOpen] = useState(false);
  const [sensitiveResult, setSensitiveResult] = useState<DetectionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<'create' | 'update' | null>(null);

  useEffect(() => {
    if (user) fetchCharacters();
  }, [user]);

  const fetchCharacters = async () => {
    // 获取角色列表
    const { data: charData } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    
    if (!charData) return;
    
    // 获取每个角色的最后聊天消息（包含内容）
    const { data: lastMessages } = await supabase
      .from('chat_messages')
      .select('character_id, created_at, content, role')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    // 获取已读状态
    const { data: readStatus } = await supabase
      .from('chat_read_status')
      .select('character_id, last_read_at')
      .eq('user_id', user?.id);
    
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
      console.error('Upload error:', error);
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
      toast.error('创建失败');
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
        ringtone_url: ringtoneUrl || null
      })
      .eq('id', editingChar.id);
    
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
    setMemorySummary('');
    setOpen(true);
    
    // 加载记忆摘要
    setMemoryLoading(true);
    try {
      const { data } = await supabase
        .from('character_memories')
        .select('summary')
        .eq('character_id', char.id)
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (data?.summary) {
        setMemorySummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load memory:', err);
    } finally {
      setMemoryLoading(false);
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
      const { error } = await supabase
        .from('character_memories')
        .upsert({
          character_id: editingChar.id,
          user_id: user.id,
          summary: memorySummary,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'character_id,user_id'
        });
      
      if (error) throw error;
      toast.success('记忆已保存');
    } catch (err) {
      console.error('Failed to save memory:', err);
      toast.error('保存失败');
    }
  };

  const regenerateMemory = async () => {
    if (!editingChar || !user) return;
    
    setRegeneratingMemory(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-memory-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          characterId: editingChar.id,
          userId: user.id,
          characterName: editingChar.name,
          characterPersona: editingChar.persona,
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

  // 导入角色卡
  const handleImportCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setImporting(true);
    try {
      const result = await parseCharacterCard(file);
      
      if (!result.success || !result.data) {
        toast.error(result.error || '导入失败');
        return;
      }
      
      const { name: cardName, persona: cardPersona, openingLine: cardOpeningLine } = convertToAppFormat(result.data);
      
      // 尝试提取头像（如果是PNG文件）
      let finalAvatarUrl = '';
      if (file.type.startsWith('image/')) {
        const avatarBase64 = await extractAvatarFromFile(file);
        if (avatarBase64) {
          // 将base64转为文件并上传
          try {
            const response = await fetch(avatarBase64);
            const blob = await response.blob();
            const avatarFile = new File([blob], `imported_${Date.now()}.png`, { type: 'image/png' });
            
            const fileName = `${user.id}/${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, avatarFile, { upsert: true });
            
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
              finalAvatarUrl = publicUrl;
            }
          } catch (uploadErr) {
            console.error('Avatar upload error:', uploadErr);
          }
        }
      }
      
      // 创建角色
      const { error } = await supabase.from('characters').insert({
        user_id: user.id,
        name: cardName,
        persona: cardPersona,
        opening_line: cardOpeningLine,
        avatar_url: finalAvatarUrl || null,
      });
      
      if (error) {
        toast.error('创建角色失败');
        return;
      }
      
      toast.success(`成功导入角色: ${cardName}`);
      fetchCharacters();
      
    } catch (err) {
      console.error('Import error:', err);
      toast.error('导入失败');
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
        <h1 className="text-xl font-bold text-gray-700">好友</h1>
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
                  
                  <Button 
                    className="w-full rounded-xl py-6 bg-gradient-to-r from-blue-400 to-cyan-400 text-white shadow-lg" 
                    onClick={updateCharacter}
                  >
                    保存设置
                  </Button>
                </TabsContent>
                
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
                {/* Import Character Card Button */}
                <button
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 text-purple-600 font-medium flex items-center justify-center gap-2 hover:bg-purple-100/50 transition-colors disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      导入酒馆角色卡
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-400 text-center -mt-2">
                  支持 PNG（带嵌入数据）、JSON、JSONL 格式
                </p>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400">或手动创建</span>
                  </div>
                </div>

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
