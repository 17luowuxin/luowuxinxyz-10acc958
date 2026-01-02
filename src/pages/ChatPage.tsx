import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Smile, Trash2, RotateCcw, Quote, MoreVertical, X, Gift, MessageSquare, Check, ImagePlus, Sticker, Upload, Phone, Video, Volume2, Mic, MicOff, VideoIcon, Play, Pause, Plus, Settings, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import TransferCard from '@/components/chat/TransferCard';
import UserTransferCard from '@/components/chat/UserTransferCard';
import { defaultStickers, matchSticker, parseStickerRequest, shouldSendSticker, Sticker as StickerType } from '@/data/stickers';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import VoiceMessageBubble from '@/components/chat/VoiceMessageBubble';
import VoiceWaveform from '@/components/chat/VoiceWaveform';
import { useAudioPlaybackQueue } from '@/hooks/useAudioPlaybackQueue';
// 头像装饰图片
// 挂断音效 (base64 短音效)
import animeHeadDecor from '@/assets/bubble-frames/anime-head-decor.png';
import cuteBoyHead from '@/assets/bubble-frames/cute-boy-head.png';

const VOICE_REQUEST_KEYWORDS = [
  "发语音",
  "发个语音",
  "发条语音",
  "给我发语音",
  "来段语音",
  "来个语音",
  "语音回复",
  "用语音",
  "说句话",
  "说点什么",
  "听你声音",
  "想听",
] as const;

const isVoiceRequestedByUser = (text: string) => {
  const t = (text ?? "").replace(/\s+/g, "");
  return VOICE_REQUEST_KEYWORDS.some((kw) => t.includes(kw));
};

// Emoji categories with comprehensive emoji list
const EMOJI_CATEGORIES = {
  recent: { icon: '🕐', name: '最近', emojis: [] as string[] },
  smileys: { 
    icon: '😊', 
    name: '表情', 
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
      '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
      '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦',
      '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
      '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
      '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
      '🙀', '😿', '😾'
    ]
  },
  love: { 
    icon: '❤️', 
    name: '爱心', 
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '😍', '🥰', '😘', '😻',
      '💑', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩', '💏', '👩‍❤️‍💋‍👨', '💐', '🌹', '🥀', '💋', '💌'
    ]
  },
  gestures: { 
    icon: '👋', 
    name: '手势', 
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾',
      '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀',
      '👁️', '👅', '👄', '💋'
    ]
  },
  nature: { 
    icon: '🌸', 
    name: '自然', 
    emojis: [
      '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲',
      '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌍', '🌎',
      '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛',
      '🌜', '☀️', '🌝', '🌞', '⭐', '🌟', '🌠', '☁️', '⛅', '⛈️', '🌤️', '🌥️',
      '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌈', '❄️', '☃️', '⛄', '🔥', '💧',
      '🌊', '✨', '💫'
    ]
  },
  food: { 
    icon: '🍔', 
    name: '美食', 
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑',
      '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽',
      '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐',
      '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔',
      '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘',
      '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚',
      '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠',
      '🥡', '🦀', '🦞', '🦐', '🦑', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂',
      '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖',
      '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋'
    ]
  },
  activities: { 
    icon: '🎉', 
    name: '活动', 
    emojis: [
      '🎃', '🎄', '🎆', '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎',
      '🎏', '🎐', '🎑', '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅',
      '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏',
      '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁',
      '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿',
      '⛷️', '🏂', '🪂', '🏋️', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '⛑️', '🏊',
      '🤽', '🧗', '🚵', '🚴', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹',
      '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳',
      '🎮', '🎰', '🧩'
    ]
  }
};

// Keep a simple flat list for backward compatibility
const EMOJI_LIST = EMOJI_CATEGORIES.smileys.emojis.slice(0, 48);

const ChatPage: React.FC = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [character, setCharacter] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customization, setCustomization] = useState<any>({});
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [apiConfigLoading, setApiConfigLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');
  const [longPressedMsg, setLongPressedMsg] = useState<any>(null);
  const [quotedMessage, setQuotedMessage] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplyModeMenu, setShowReplyModeMenu] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [replyMode, setReplyMode] = useState<'novel' | 'online'>('novel');
  const [onlineMessageCount, setOnlineMessageCount] = useState<string>('3-5');
  const [novelaiConfig, setNovelaiConfig] = useState<{
    enabled?: boolean;
    apiKey?: string;
    model?: string;
    autoGenerate?: boolean;
    style?: string;
    customStylePrompt?: string;
    triggerKeywords?: string;
    gender?: string;
    customGender?: string;
    action?: string;
    customAction?: string;
    expression?: string;
    customExpression?: string;
    nsfwMode?: boolean;
    characterPrompt?: string;
    referenceImage?: string;
    referenceStrength?: number;
    vibeTransfer?: boolean;
    vibeImage?: string;
    vibeStrength?: number;
  } | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null);
  // 表情包相关状态
  const [stickerEnabled, setStickerEnabled] = useState(true);
  const [userStickers, setUserStickers] = useState<StickerType[]>([]);
  const [showStickerUpload, setShowStickerUpload] = useState(false);
  const [stickerKeywordInput, setStickerKeywordInput] = useState('');
  const [pendingStickerFile, setPendingStickerFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false); // 快捷发送表情包面板
  // 通话相关状态
  const [showCallDialog, setShowCallDialog] = useState<'voice' | 'video' | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callMessages, setCallMessages] = useState<{ role: string; content: string; audioBase64?: string }[]>([]);
  // 保存已上传的视频通话视频URL（从数据库加载）
  const [savedCallVideoUrl, setSavedCallVideoUrl] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [callRinging, setCallRinging] = useState(false); // 来电铃声状态
  const [callStartTime, setCallStartTime] = useState<number | null>(null); // 通话开始时间
  const [callDuration, setCallDuration] = useState(0); // 通话时长（秒）
  const [isAISpeaking, setIsAISpeaking] = useState(false); // AI正在说话（TTS播放中）
  const [interimTranscript, setInterimTranscript] = useState(''); // 临时识别文字
  // TTS相关状态
  const [ttsConfig, setTtsConfig] = useState<{ enabled: boolean; baseUrl: string; apiKey: string; model: string } | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'off' | 'sometimes' | 'always'>('off'); // 角色语音模式
  // 视频通话相关
  const [callVideoUrl, setCallVideoUrl] = useState<string | null>(null); // 用户上传的6秒视频
  const [callVideoPlaying, setCallVideoPlaying] = useState(false);
  const callVideoRef = useRef<HTMLVideoElement>(null);
  const callVideoInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const callMessagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // 当前播放的音频
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null); // 来电铃声音频

  // 音频播放队列 - 确保语音串行播放
  const audioQueue = useAudioPlaybackQueue();

  // 自动发送通话消息的函数引用
  const autoSendCallMessageRef = useRef<((text: string) => Promise<void>) | null>(null);

  // 语音输入 Hook - 微信风格：识别完成自动发送
  const speechToText = useSpeechToText({
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
    persistent: true,
    onFinal: (text) => {
      console.log('[Call] Speech final:', text, 'inCall:', inCall, 'isAISpeaking:', isAISpeaking);
      if (text.trim() && showCallDialog && inCall && !isAISpeaking) {
        // 自动发送识别到的文字
        autoSendCallMessageRef.current?.(text.trim());
      }
    },
    onInterim: (text) => {
      // 实时显示正在识别的文字
      if (showCallDialog && inCall) {
        setInterimTranscript(text);
      }
    },
    onError: (message) => {
      console.error('[Call] Speech error:', message);
      toast.error(message);
    },
    onAudioStart: () => {
      console.log('[Call] Audio activity started');
    },
    onAudioEnd: () => {
      console.log('[Call] Audio activity ended');
    },
  });

  // 先定义 fetchProfile - 需要在 useEffect 之前
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.error('Fetch profile error:', error);
      return;
    }
    if (data) {
      console.log('Profile loaded:', data.nickname, 'avatar:', data.avatar_url?.slice(0, 50));
      setProfile(data);
    }
  }, [user?.id]);

  const fetchCharacter = useCallback(async () => {
    if (!characterId) return;
    const { data } = await supabase.from('characters').select('*').eq('id', characterId).single();
    if (data) {
      console.log('[fetchCharacter] loaded:', data.name, 'ringtone_url:', data.ringtone_url);
      setCharacter(data);
      if (data.reply_mode) {
        setReplyMode(data.reply_mode as 'novel' | 'online');
      }
      if (data.online_message_count) {
        setOnlineMessageCount(data.online_message_count);
      }
      setHistoryLimit(data.history_limit ?? 10);
      setTransferEnabled(data.transfer_enabled ?? true);
      // 加载表情包开关状态
      setStickerEnabled((data as any).sticker_enabled ?? true);
      // 加载语音模式
      setVoiceMode(((data as any).voice_mode as 'off' | 'sometimes' | 'always') || 'off');
      // 加载视频通话动态视频URL
      setSavedCallVideoUrl((data as any).call_video_url || null);
    }
  }, [characterId]);

  // 加载用户自定义表情包
  const fetchUserStickers = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('user_stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setUserStickers(data.map(s => ({
        id: s.id,
        imageUrl: s.image_url,
        keywords: s.keywords || [],
        text: (s.keywords || [])[0] || ''
      })));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && characterId) {
      fetchCharacter();
      fetchMessagesWithTransfers();
      fetchCustomization();
      fetchProfile();
      fetchApiConfig();
      fetchUserStickers();
    }
  }, [user, characterId, fetchProfile, fetchCharacter, fetchUserStickers]);

  // 优化滚动性能 - 使用防抖
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length]); // 只在消息数量变化时滚动


  const fetchMessagesWithTransfers = async () => {
    // 并行获取聊天消息和转账记录
    const [chatResult, transferResult] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('id, role, content, created_at, image_url, audio_url, quoted_message_id')
        .eq('character_id', characterId)
        .order('created_at'),
      supabase
        .from('dream_transactions')
        .select('*')
        .eq('character_id', characterId)
        .eq('user_id', user?.id)
        .order('created_at')
    ]);
    
    const chatData = chatResult.data;
    const transferData = transferResult.data;
    
    // 合并消息和转账记录
    const allItems: any[] = [];
    
    // 先创建消息映射，用于关联引用消息
    const messageMap = new Map<string, any>();
    if (chatData) {
      chatData.forEach(msg => {
        messageMap.set(msg.id, msg);
      });
    }
    
    if (chatData) {
      chatData.forEach(msg => {
        // 查找引用的消息
        let quotedMessage = null;
        if ((msg as any).quoted_message_id) {
          const quotedMsg = messageMap.get((msg as any).quoted_message_id);
          if (quotedMsg) {
            quotedMessage = {
              id: quotedMsg.id,
              role: quotedMsg.role,
              content: quotedMsg.content
            };
          }
        }
        
        allItems.push({
          ...msg,
          // 如果有audio_url，设置audioBase64为URL，组件需要能处理URL或base64
          audioBase64: (msg as any).audio_url || undefined,
          timestamp: new Date(msg.created_at).getTime(),
          quotedMessage
        });
      });
    }
    
    if (transferData) {
      setPendingTransfers(transferData);
      transferData.forEach(transfer => {
        allItems.push({
          id: transfer.id,
          role: 'transfer',
          content: `[TRANSFER:${transfer.id}:${transfer.amount}:${transfer.message || ''}]`,
          created_at: transfer.created_at,
          timestamp: new Date(transfer.created_at).getTime(),
          transferData: transfer
        });
      });
    }
    
    // 按时间排序
    allItems.sort((a, b) => a.timestamp - b.timestamp);
    setMessages(allItems);
    
    // 检查最后一条消息是否是用户消息（说明AI还没回复）
    if (chatData && chatData.length > 0) {
      const lastMsg = chatData[chatData.length - 1];
      if (lastMsg.role === 'user') {
        // 延迟一下再请求，等待其他数据加载完成
        setTimeout(() => {
          retryLastMessage(chatData);
        }, 500);
      }
    }
  };
  
  // 重新请求AI回复
  const retryLastMessage = async (chatData: any[]) => {
    if (!character || !apiConfig?.apiKey) return;
    
    setLoading(true);
    
    try {
      const recentMessages = chatData.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const body: any = { 
        messages: recentMessages, 
        characterName: character?.name, 
        characterId: characterId,
        userId: user?.id,
        persona: character?.persona,
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined,
        userApiKey: apiConfig.apiKey,
        provider: apiConfig.provider,
      };
      
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;
      
      console.log('Retrying last message for AI response...');
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: '请求失败' }));
        console.error('Retry chat error:', errorData);
        setLoading(false);
        return;
      }
      
      if (!resp.body) {
        setLoading(false);
        return;
      }
      
      // 读取响应
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();
      
      // 解析响应
      let assistantContent = '';
      
      if (!fullText.startsWith('data:') && !fullText.includes('\ndata:')) {
        try {
          const json = JSON.parse(fullText);
          if (json.error) {
            setLoading(false);
            return;
          }
          assistantContent = json.choices?.[0]?.message?.content 
            || json.choices?.[0]?.delta?.content
            || json.content
            || '';
        } catch {
          if (fullText.trim() && !fullText.includes('<!DOCTYPE')) {
            assistantContent = fullText.trim();
          }
        }
      }
      
      if (!assistantContent) {
        const lines = fullText.split('\n');
        for (const rawLine of lines) {
          let line = rawLine.trim();
          if (!line || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const json = JSON.parse(jsonStr);
              const delta = json.choices?.[0]?.delta?.content 
                || json.choices?.[0]?.message?.content
                || '';
              if (delta) assistantContent += delta;
            } catch {}
          }
        }
      }
      
      if (assistantContent.trim()) {
        assistantContent = assistantContent.trim();
        
        // 添加到消息列表
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: assistantContent }]);
        
        // 保存到数据库
        await supabase.from('chat_messages').insert({ 
          user_id: user?.id, 
          character_id: characterId, 
          role: 'assistant', 
          content: assistantContent 
        });
        
        console.log('AI response recovered successfully');
      }
    } catch (err) {
      console.error('Retry error:', err);
    }
    
    setLoading(false);
  };

  const fetchCustomization = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).single();
    if (data) setCustomization(data);
  };

  const fetchApiConfig = async () => {
    setApiConfigLoading(true);
    try {
      const { data: apiKeys } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
      if (apiKeys && apiKeys.length > 0) {
        const customKey = apiKeys.find(k => k.provider === 'custom');
        const deepseekKey = apiKeys.find(k => k.provider === 'deepseek');
        const openaiKey = apiKeys.find(k => k.provider === 'openai');
        const anthropicKey = apiKeys.find(k => k.provider === 'anthropic');
        const customBaseUrl = apiKeys.find(k => k.provider === 'custom_base_url');
        const customModel = apiKeys.find(k => k.provider === 'custom_model');
        
        // NovelAI config
        const novelaiKey = apiKeys.find(k => k.provider === 'novelai');
        const novelaiModel = apiKeys.find(k => k.provider === 'novelai_model');
        const novelaiAutoGenerate = apiKeys.find(k => k.provider === 'novelai_auto_generate');
        const novelaiStyle = apiKeys.find(k => k.provider === 'novelai_style');
        const novelaiCustomStylePrompt = apiKeys.find(k => k.provider === 'novelai_custom_style_prompt');
        const novelaiTriggerKeywords = apiKeys.find(k => k.provider === 'novelai_trigger_keywords');
        
        if (novelaiKey) {
          const enabledSetting = apiKeys.find(k => k.provider === 'novelai_enabled');
          const genderSetting = apiKeys.find(k => k.provider === 'novelai_gender');
          const customGenderSetting = apiKeys.find(k => k.provider === 'novelai_custom_gender');
          const actionSetting = apiKeys.find(k => k.provider === 'novelai_action');
          const customActionSetting = apiKeys.find(k => k.provider === 'novelai_custom_action');
          const expressionSetting = apiKeys.find(k => k.provider === 'novelai_expression');
          const customExpressionSetting = apiKeys.find(k => k.provider === 'novelai_custom_expression');
          const nsfwSetting = apiKeys.find(k => k.provider === 'novelai_nsfw');
          const characterPromptSetting = apiKeys.find(k => k.provider === 'novelai_character_prompt');
          const refImageSetting = apiKeys.find(k => k.provider === 'novelai_reference_image');
          const refStrengthSetting = apiKeys.find(k => k.provider === 'novelai_reference_strength');
          const vibeTransferSetting = apiKeys.find(k => k.provider === 'novelai_vibe_transfer');
          const vibeImageSetting = apiKeys.find(k => k.provider === 'novelai_vibe_image');
          const vibeStrengthSetting = apiKeys.find(k => k.provider === 'novelai_vibe_strength');
          
          setNovelaiConfig({
            enabled: enabledSetting?.api_key !== 'false',
            apiKey: novelaiKey.api_key,
            model: novelaiModel?.api_key || 'nai-diffusion-3',
            autoGenerate: novelaiAutoGenerate?.api_key === 'true',
            style: novelaiStyle?.api_key || 'selfie',
            customStylePrompt: novelaiCustomStylePrompt?.api_key || '',
            triggerKeywords: novelaiTriggerKeywords?.api_key || '画图,画一张,画一幅,画个,生成图,来一张图,发张图,发图,发个图,照片,自拍,看看你,你的样子',
            gender: genderSetting?.api_key || 'auto',
            customGender: customGenderSetting?.api_key || '',
            action: actionSetting?.api_key || 'none',
            customAction: customActionSetting?.api_key || '',
            expression: expressionSetting?.api_key || 'none',
            customExpression: customExpressionSetting?.api_key || '',
            nsfwMode: nsfwSetting?.api_key === 'true',
            characterPrompt: characterPromptSetting?.api_key || '',
            referenceImage: refImageSetting?.api_key || '',
            referenceStrength: refStrengthSetting ? parseFloat(refStrengthSetting.api_key) : 0.6,
            vibeTransfer: vibeTransferSetting?.api_key === 'true',
            vibeImage: vibeImageSetting?.api_key || '',
            vibeStrength: vibeStrengthSetting ? parseFloat(vibeStrengthSetting.api_key) : 0.6,
          });
        }
        
        if (customKey) {
          setApiConfig({ 
            provider: 'custom', 
            apiKey: customKey.api_key,
            baseUrl: customBaseUrl?.api_key,
            model: customModel?.api_key
          });
        } else if (deepseekKey) {
          setApiConfig({ provider: 'deepseek', apiKey: deepseekKey.api_key });
        } else if (openaiKey) {
          setApiConfig({ provider: 'openai', apiKey: openaiKey.api_key });
        } else if (anthropicKey) {
          setApiConfig({ provider: 'anthropic', apiKey: anthropicKey.api_key });
        } else {
          setApiConfig({});
        }
        
        // TTS config
        const ttsEnabledSetting = apiKeys.find(k => k.provider === 'tts_enabled');
        const ttsBaseUrlSetting = apiKeys.find(k => k.provider === 'tts_base_url');
        const ttsApiKeySetting = apiKeys.find(k => k.provider === 'tts_api_key');
        const ttsModelSetting = apiKeys.find(k => k.provider === 'tts_model');
        
        if (ttsBaseUrlSetting && ttsApiKeySetting) {
          setTtsConfig({
            enabled: ttsEnabledSetting?.api_key !== 'false',
            baseUrl: ttsBaseUrlSetting.api_key,
            apiKey: ttsApiKeySetting.api_key,
            model: ttsModelSetting?.api_key || '',
          });
        }
      } else {
        setApiConfig({});
      }
    } catch (err) {
      console.error('获取API配置失败:', err);
      setApiConfig({});
    } finally {
      setApiConfigLoading(false);
    }
  };
  
  // TTS生成函数 - 返回 audioBase64，支持重试
  const generateTTSAudio = async (text: string, retries: number = 2): Promise<string | null> => {
    if (!ttsConfig?.enabled || !ttsConfig.apiKey || !ttsConfig.baseUrl || !character) return null;
    
    const voiceId = character.voice_id;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text,
            voiceId: voiceId || 'default',
            ttsConfig: {
              apiKey: ttsConfig.apiKey,
              baseUrl: ttsConfig.baseUrl,
              model: ttsConfig.model,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          console.error(`TTS error (attempt ${attempt + 1}):`, data.error || 'Unknown error');
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // 递增延迟重试
            continue;
          }
          return null;
        }

        if (!data.audioContent) {
          console.error(`TTS: No audio content received (attempt ${attempt + 1})`);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          return null;
        }

        return data.audioContent;
      } catch (err) {
        console.error(`TTS generation error (attempt ${attempt + 1}):`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  // TTS播放函数
  const playTTS = async (text: string) => {
    if (!ttsConfig?.enabled || !ttsConfig.apiKey || !ttsConfig.baseUrl || !character) return;
    
    // 检查是否设置了语音ID (Volink等API必须)
    const voiceId = character.voice_id;
    
    try {
      setTtsPlaying(true);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text,
          voiceId: voiceId || 'default',
          ttsConfig: {
            apiKey: ttsConfig.apiKey,
            baseUrl: ttsConfig.baseUrl,
            model: ttsConfig.model,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('TTS error:', data.error || 'Unknown error');
        // 显示更友好的错误提示
        if (data.error?.includes('voice_id') || data.error?.includes('Voice ID')) {
          toast.error('请先设置角色语音ID（点击右上角菜单）');
        } else if (data.error?.includes('balance') || data.error?.includes('402')) {
          toast.error('TTS API余额不足');
        } else if (data.error?.includes('invalid') || data.error?.includes('401')) {
          toast.error('TTS API密钥无效');
        } else if (data.details) {
          console.error('TTS details:', data.details);
        }
        setTtsPlaying(false);
        return;
      }

      if (!data.audioContent) {
        console.error('TTS: No audio content received');
        setTtsPlaying(false);
        return;
      }

      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audio.onended = () => setTtsPlaying(false);
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setTtsPlaying(false);
      };
      await audio.play();
    } catch (err) {
      console.error('TTS playback error:', err);
      toast.error('语音播放失败');
      setTtsPlaying(false);
    }
  };

  const getBubbleStyle = (isUser: boolean) => {
    const style = customization.bubble_style || 'rounded';
    // 仅控制外形；内边距由 bubble_size 动态计算，保证“气泡大小”同步
    // 防竖排：在 items-start/end 的列布局里，子元素会 shrink-to-fit，中文可能被挤成单字换行；用 inline-block + minWidth（在 render 里）兜底
    const baseClasses = 'relative inline-block max-w-[70%] whitespace-pre-wrap break-words';

    switch (style) {
      case 'cloud':
        return `${baseClasses} rounded-2xl ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      case 'square':
        return `${baseClasses} rounded-lg ${isUser ? 'rounded-br-none' : 'rounded-bl-none'}`;
      case 'glass':
        return `${baseClasses} chat-bubble-glass rounded-[1.5rem] ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
      default:
        return `${baseClasses} rounded-xl ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
    }
  };

  const getBubblePadding = (fontSizePx: number) => {
    const scale = Math.max(0.85, Math.min(1.35, fontSizePx / 16));
    const px = Math.round(12 * scale);
    const py = Math.round(8 * scale);
    return `${py}px ${px}px`;
  };

  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmoji(false);
  };

  // 清空全部聊天记录
  const clearAllMessages = async () => {
    try {
      await supabase.from('chat_messages').delete().eq('character_id', characterId).eq('user_id', user?.id);
      setMessages([]);
      toast.success('已清空全部聊天记录');
    } catch (err) {
      toast.error('清空失败');
    }
  };

  // 从指定消息开始删除（回溯删除）
  const deleteFromMessage = async (msg: any) => {
    try {
      const msgIndex = messages.findIndex(m => m.id === msg.id);
      if (msgIndex === -1) return;
      
      const messagesToDelete = messages.slice(msgIndex);
      const idsToDelete = messagesToDelete.map(m => m.id);
      
      await supabase.from('chat_messages').delete().in('id', idsToDelete);
      setMessages(prev => prev.slice(0, msgIndex));
      setLongPressedMsg(null);
      toast.success('已删除该消息及之后的记录');
    } catch (err) {
      toast.error('删除失败');
    }
  };

  // 引用消息
  const quoteMessage = (msg: any) => {
    setQuotedMessage(msg);
    setLongPressedMsg(null);
  };

  // 长按消息显示菜单
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  
  const handleMessageTouchStart = (msg: any) => {
    if (msg.role === 'transfer') return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setLongPressedMsg(msg);
      // 触发轻微震动反馈（如果支持）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms 长按触发
  };
  
  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  
  const handleMessageTouchMove = () => {
    // 移动时取消长按
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  
  const handleMessageClick = (msg: any, e: React.MouseEvent) => {
    // 只在桌面端点击时触发（移动端用长按）
    e.stopPropagation();
    if (msg.role === 'transfer') return;
    // 如果是长按触发的，不处理点击
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    // 桌面端可以点击切换菜单
    if (window.matchMedia('(hover: hover)').matches) {
      setLongPressedMsg(longPressedMsg?.id === msg.id ? null : msg);
    }
  };
  
  // 复制消息
  const copyMessage = async (msg: any) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      toast.success('已复制');
      setLongPressedMsg(null);
    } catch (err) {
      toast.error('复制失败');
    }
  };

  // 转账相关函数 - 解析 AI 返回的转账指令
  const parseTransferCommand = (content: string): { amount: number; message: string } | null => {
    // 匹配格式: [转账:金额:留言] 或 [TRANSFER:金额:留言] 或 (转账:金额:留言)
    const transferMatch = content.match(/[\[\(](?:转账|TRANSFER):(\d+(?:\.\d{1,2})?):([^\]\)]*?)[\]\)]/i);
    if (transferMatch) {
      const amount = parseFloat(transferMatch[1]);
      const message = transferMatch[2].trim() || '给你的~';
      // 只要金额大于 0 就允许，具体合理性由上游提示控制
      if (amount > 0) {
        return { amount, message };
      }
    }
    return null;
  };
  
  // 从内容中移除转账指令标记
  const removeTransferCommand = (content: string): string => {
    return content.replace(/[\[\(](?:转账|TRANSFER):\d+(?:\.\d{1,2})?:[^\]\)]*?[\]\)]/gi, '').trim();
  };
  
  const createTransfer = async (amount: number, message?: string) => {
    if (!user?.id || !character) return null;
    
    const { data, error } = await supabase
      .from('dream_transactions')
      .insert({
        user_id: user.id,
        character_id: characterId,
        character_name: character.name,
        amount: amount,
        message: message || null,
        is_received: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Create transfer error:', error);
      return null;
    }
    
    return data;
  };
  
  const handleReceiveTransfer = async (transferId: string) => {
    const { error } = await supabase
      .from('dream_transactions')
      .update({ is_received: true })
      .eq('id', transferId);
    
    if (!error) {
      setPendingTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, is_received: true } : t
      ));
      toast.success('收款成功！');
    }
  };
  
  const handleDeleteTransfer = async (transferId: string) => {
    const { error } = await supabase
      .from('dream_transactions')
      .delete()
      .eq('id', transferId);
    
    if (!error) {
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
      setMessages(prev => prev.filter(m => !(m.role === 'transfer' && m.transferData?.id === transferId)));
      toast.success('转账记录已删除');
    } else {
      toast.error('删除失败');
    }
  };

  // 智能提取场景、动作、服装描述
  const extractSceneDetails = (text: string): string[] => {
    if (!text) return [];
    
    // 过滤掉图片消息和系统消息
    if (text.includes('给你发了一张图片') || text.startsWith('[TRANSFER') || text.startsWith('*给你发了')) {
      return [];
    }
    
    const details: string[] = [];
    
    // 提取 *动作/场景* 描述 - 这是最重要的上下文来源，但过滤掉图片相关描述
    const actionMatches = text.match(/\*([^*]{2,100})\*/g);
    if (actionMatches) {
      const filtered = actionMatches
        .map(s => s.replace(/\*/g, '').trim())
        .filter(s => !s.includes('发了一张图片') && !s.includes('给你发'));
      details.push(...filtered);
    }
    
    // 服装/穿着描述
    const clothingPatterns = [
      /(?:穿着?|身着|身穿|套着?|戴着?|换上了?|脱下了?)([^，。！？\n]{2,25})/g,
      /(?:衣服|裙子|制服|校服|衬衫|外套|大衣|连衣裙|泳装|睡衣|和服|旗袍|比基尼|内衣|T恤|牛仔裤|短裤|长裙|短裙|吊带|背心|西装|礼服|晚礼服|婚纱|围裙|浴袍|毛巾)([^，。！？\n]{0,15})/g,
    ];
    clothingPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0]) details.push(m[0].trim());
      }
    });
    
    // 场景/地点描述
    const scenePatterns = [
      /(?:在|来到|走进|坐在|躺在|站在|趴在|靠在|蹲在|跪在)([^，。！？\n]{2,20})/g,
      /(?:卧室|客厅|浴室|厨房|教室|办公室|海边|公园|街道|咖啡厅|餐厅|酒店|泳池|温泉|花园|阳台|天台|楼顶|车里|床上|沙发|椅子|地板|窗边|门口|走廊|电梯|超市|商场|学校|图书馆|医院|公司|家里|外面|室内|室外|户外|夜晚|白天|黄昏|日落|日出|星空|月光|阳光|雨天|雪天|晴天)/g,
    ];
    scenePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0]) details.push(m[0].trim());
      }
    });
    
    // 动作/姿势描述 - 扩展更多动作
    const actionPatterns = [
      /(?:正在|开始|继续|准备)([^，。！？\n]{2,20})/g,
      /(?:微笑|害羞|脸红|撒娇|生气|哭泣|大笑|眨眼|闭眼|睁眼|低头|抬头|转身|回头|弯腰|伸手|张嘴|闭嘴|舔嘴|咬唇|皱眉|挑眉|wink|pout|smile|blush)/gi,
      /(?:拥抱|牵手|亲吻|接吻|亲亲|抱抱|摸头|拍肩|握手|搭肩|靠着|贴着|挨着|抱着|搂着)/g,
      /(?:跑步|走路|散步|跳舞|唱歌|弹琴|画画|写字|看书|玩手机|打游戏|做饭|吃饭|喝水|喝茶|喝咖啡|睡觉|起床|洗澡|化妆|梳头|换衣服)/g,
    ];
    actionPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0]) details.push(m[0].trim());
      }
    });
    
    // 人物数量描述
    const countPatterns = [
      /(?:两个人|三个人|我们俩|我们两|一起|和你|跟你|陪你|带你|你我|咱俩|咱们)/g,
    ];
    countPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0]) details.push(m[0].trim());
      }
    });
    
    return [...new Set(details)];
  };

  // NovelAI 画图相关
  const shouldGenerateImage = (
    userInput: string,
    aiResponse: string,
  ): { should: boolean; prompt: string } => {
    // 检查画图功能是否启用（显式设为 false 才关闭）
    if (novelaiConfig?.enabled === false) {
      return { should: false, prompt: '' };
    }
    // 没有配 API Key 则也视为关闭
    if (!novelaiConfig?.apiKey) {
      return { should: false, prompt: '' };
    }
    
    const input = (userInput || '').trim().toLowerCase();
    const reply = (aiResponse || '').trim();

    // 1) 使用可配置的触发关键词 - 大幅放宽默认关键词
    const configKeywords = novelaiConfig?.triggerKeywords || '画图,画一张,画一幅,画个,生成图,来一张图,发张图,发图,发个图,照片,自拍,看看你,你的样子,图片,拍照,画画,绘画,出图,生成,来张,看你,见你,图,给我看,让我看,能看,想看,拍个,来个,发一张,给一张,秀一下,秀秀,show,pic,photo,image';
    const keywordList = configKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    
    // 检查是否设置了 * 表示任意消息触发
    const alwaysTrigger = keywordList.includes('*') || keywordList.includes('任意') || keywordList.includes('全部');

    const userRequestsImage =
      alwaysTrigger ||
      keywordList.some((kw) => kw && input.includes(kw)) ||
      /(画|发|来|给|要|想看|看|拍|秀|展示|show).*?(图|图片|照片|自拍|一下|你|pic|photo)/.test(userInput) ||
      /(给|让|能|可以).{0,4}(我|偶).{0,4}(看|见)/.test(userInput) ||
      /^\s*(\/draw|\/pic|\/image|\/img)\b/i.test(userInput);

    // 2) 自动触发：大幅放宽条件 - AI回复有动作/场景/穿着/表情/位置描述都触发
    const hasActionEmotes = /\*[^*]{2,}\*/.test(reply);
    const hasSceneKeywords = [
      '现在我穿着', '我正在', '此刻我', '我的样子', '我给你看', '发你一张', '给你发', 
      '穿着', '身穿', '身着', '换上', '脱下', '躺在', '坐在', '站在', '走到',
      '看着你', '望着', '凑近', '抱住', '牵着', '靠在', '贴着', '趴在', '倚在',
      '我的脸', '我的眼', '我微笑', '我笑了', '我脸红', '害羞', '撒娇',
      '走过来', '跑过来', '走近', '靠近', '蹲下', '弯腰', '伸手', '张开',
      '洗澡', '泡澡', '泡温泉', '游泳', '睡觉', '睡着', '醒来', '起床',
      '做饭', '吃饭', '喝水', '喝茶', '看书', '玩手机', '听音乐',
      '在卧室', '在客厅', '在浴室', '在厨房', '在教室', '在办公室', '在海边', '在公园'
    ].some((kw) => reply.includes(kw));
    const aiDescribesScene = hasActionEmotes || hasSceneKeywords;

    if (!(userRequestsImage || (novelaiConfig?.autoGenerate && aiDescribesScene))) {
      return { should: false, prompt: '' };
    }

    // ===== 智能提取用户意图 =====
    const userIntentParts: string[] = [];
    
    // 检测用户请求的构图类型
    if (/(全身|站着|站立|full\s*body|standing)/.test(userInput)) {
      userIntentParts.push('full body, standing');
    } else if (/(半身|上半身|upper\s*body)/.test(userInput)) {
      userIntentParts.push('upper body, portrait');
    } else if (/(特写|脸|face|close[\s-]*up)/.test(userInput)) {
      userIntentParts.push('close-up, face');
    }
    
    // 检测人数（两个人、和你一起等）
    const hasTwoPeople = /(两个人|我们俩|咱俩|你我|和你|跟你|一起|couple|together)/.test(userInput + reply);
    if (hasTwoPeople) {
      userIntentParts.push('2people, couple, together');
    }
    
    // 检测场景类型请求
    if (/(风景|scenery|landscape|背景|环境)/.test(userInput)) {
      userIntentParts.push('scenic, detailed background, beautiful scenery');
    }
    if (/(场景|scene|地点|位置)/.test(userInput)) {
      userIntentParts.push('detailed environment, background');
    }
    
    // 检测动作请求
    const actionKeywords: Record<string, string> = {
      '在干嘛': 'action, doing something',
      '在做什么': 'action, activity',
      '躺': 'lying down, on bed',
      '坐': 'sitting',
      '站': 'standing',
      '跑': 'running',
      '走': 'walking',
      '跳': 'jumping',
      '飞': 'flying',
      '游泳': 'swimming, in water',
      '洗澡': 'bathing, wet',
      '睡觉': 'sleeping, eyes closed, on bed',
      '吃': 'eating',
      '喝': 'drinking',
      '抱': 'hugging, embrace',
      '亲': 'kissing',
      '牵手': 'holding hands',
    };
    for (const [zh, en] of Object.entries(actionKeywords)) {
      if (userInput.includes(zh) || reply.includes(zh)) {
        userIntentParts.push(en);
      }
    }

    // 构建画图提示词 - 从对话内容智能提取场景
    const promptParts: string[] = [...userIntentParts];
    
    // 从最近对话中提取场景描述（用户消息+AI回复），过滤掉图片消息
    const recentDialogue = messages.slice(-10).filter(m => !m.image_url && !m.content?.includes('给你发了一张图片'));
    const dialogueContext: string[] = [];
    
    for (const msg of recentDialogue) {
      // 跳过系统性消息
      if (msg.content?.startsWith('*给你发了') || msg.content?.startsWith('[TRANSFER')) continue;
      const sceneFromMsg = extractSceneDetails(msg.content);
      dialogueContext.push(...sceneFromMsg);
    }
    
    // 大幅扩展的中英文翻译映射
    const zhToEnMap: Record<string, string> = {
      // 表情
      '微笑': 'smiling', '害羞': 'shy, blushing', '脸红': 'blushing',
      '撒娇': 'cute expression, pouting', '生气': 'angry', '哭泣': 'crying, tears',
      '大笑': 'laughing', '眨眼': 'winking', '闭眼': 'eyes closed',
      '睁眼': 'eyes open', '低头': 'looking down', '抬头': 'looking up',
      '皱眉': 'frowning', '舔嘴': 'licking lips', '咬唇': 'biting lip',
      // 场景/地点
      '卧室': 'bedroom, indoor', '客厅': 'living room', '浴室': 'bathroom, wet',
      '厨房': 'kitchen', '教室': 'classroom', '办公室': 'office',
      '海边': 'beach, ocean, sand', '公园': 'park, outdoors', '泳池': 'swimming pool, water',
      '温泉': 'hot spring, steam', '花园': 'garden, flowers', '阳台': 'balcony',
      '天台': 'rooftop', '床上': 'on bed', '沙发': 'on sofa',
      '窗边': 'by window', '夜晚': 'night, dark', '白天': 'daytime, bright',
      '黄昏': 'sunset, dusk', '日落': 'sunset', '星空': 'starry sky, night',
      '月光': 'moonlight', '阳光': 'sunlight', '雨天': 'rainy, rain',
      '雪天': 'snowy, snow', '室内': 'indoor', '室外': 'outdoor',
      // 服装
      '校服': 'school uniform', '制服': 'uniform', '连衣裙': 'dress',
      '泳装': 'swimsuit', '比基尼': 'bikini', '睡衣': 'pajamas, nightgown',
      '和服': 'kimono, japanese clothes', '旗袍': 'cheongsam, chinese dress',
      '女仆装': 'maid outfit', '护士服': 'nurse outfit', '水手服': 'sailor uniform',
      '晚礼服': 'evening dress, gown', '婚纱': 'wedding dress, bridal',
      '运动服': 'sportswear', 'T恤': 't-shirt', '牛仔裤': 'jeans',
      '短裤': 'shorts', '长裙': 'long skirt', '短裙': 'short skirt, miniskirt',
      '吊带': 'camisole', '背心': 'tank top', '西装': 'suit',
      '围裙': 'apron', '浴袍': 'bathrobe', '毛巾': 'towel',
      // 动作/姿势
      '拥抱': 'hugging, embrace', '亲吻': 'kissing', '牵手': 'holding hands',
      '躺着': 'lying down', '坐着': 'sitting', '站着': 'standing',
      '跪着': 'kneeling', '趴着': 'lying on stomach, prone', '侧躺': 'lying on side',
      '弯腰': 'bending over', '伸手': 'reaching out', '张嘴': 'open mouth',
      '跑步': 'running', '走路': 'walking', '散步': 'walking, stroll',
      '跳舞': 'dancing', '唱歌': 'singing', '弹琴': 'playing piano',
      '画画': 'painting, drawing', '写字': 'writing', '看书': 'reading book',
      '玩手机': 'using phone', '打游戏': 'playing games', '做饭': 'cooking',
      '吃饭': 'eating', '喝水': 'drinking', '喝茶': 'drinking tea',
      '睡觉': 'sleeping', '起床': 'waking up', '洗澡': 'bathing',
      '化妆': 'applying makeup', '梳头': 'brushing hair',
      // 人数相关
      '两个人': '2people, couple', '三个人': '3people, group',
      '我们俩': '2people, together', '一起': 'together',
    };
    
    for (const detail of [...new Set(dialogueContext)].slice(0, 12)) {
      // 先尝试直接匹配
      if (zhToEnMap[detail]) {
        promptParts.push(zhToEnMap[detail]);
      } else {
        // 尝试部分匹配
        let translated = detail;
        for (const [zh, en] of Object.entries(zhToEnMap)) {
          if (detail.includes(zh)) {
            translated = en;
            break;
          }
        }
        promptParts.push(translated);
      }
    }
    
    console.log('User intent:', userIntentParts);
    console.log('Extracted from dialogue:', dialogueContext.slice(0, 10));

    // 性别标签 - 根据设置决定，考虑两人场景
    let genderTag = '1girl';
    let genderBase = 'anime girl';
    
    const genderSetting = novelaiConfig?.gender || 'auto';
    
    // 如果检测到两个人的场景，优先使用couple
    if (hasTwoPeople) {
      genderTag = '1girl, 1boy, couple';
      genderBase = 'anime couple';
    } else if (genderSetting === 'auto') {
      // 从角色人设判断性别
      if (character?.persona) {
        const isMale = /(男|男性|boy|male|他是|哥哥|弟弟|王子|先生|少年|青年|帅|帅气|肌肉|英俊)/i.test(character.persona);
        const isFemale = /(女|女性|girl|female|她是|姐姐|妹妹|公主|小姐|少女|可爱|美丽|温柔)/i.test(character.persona);
        
        if (isMale && !isFemale) {
          genderTag = '1boy';
          genderBase = 'anime boy';
        } else if (!isMale && !isFemale) {
          genderTag = '1person';
          genderBase = 'anime character';
        }
      }
    } else if (genderSetting === 'male') {
      genderTag = '1boy';
      genderBase = 'anime boy';
    } else if (genderSetting === 'female') {
      genderTag = '1girl';
      genderBase = 'anime girl';
    } else if (genderSetting === 'couple') {
      genderTag = '1girl, 1boy, couple';
      genderBase = 'anime couple';
    } else if (genderSetting === 'custom' && novelaiConfig?.customGender) {
      genderTag = novelaiConfig.customGender;
      genderBase = 'anime characters';
    }
    
    // 整合所有自定义设置到提示词
    const customParts: string[] = [];
    
    // 添加动作/姿态（仅当用户没有明确指定时）
    const actionSetting = novelaiConfig?.action || 'none';
    const actionMap: Record<string, string> = {
      'standing': 'standing', 'sitting': 'sitting', 'lying': 'lying down, on bed',
      'kneeling': 'kneeling', 'walking': 'walking', 'running': 'running',
      'hugging': 'hugging, embrace', 'kissing': 'kissing', 'holding_hands': 'holding hands',
      'sleeping': 'sleeping, eyes closed', 'stretching': 'stretching, arms up',
    };
    if (!userIntentParts.some(p => /(lying|sitting|standing|walking|running|hugging|kissing)/.test(p))) {
      if (actionSetting === 'custom' && novelaiConfig?.customAction) {
        customParts.push(novelaiConfig.customAction);
      } else if (actionMap[actionSetting]) {
        customParts.push(actionMap[actionSetting]);
      }
    }
    
    // 添加表情/神态
    const expressionSetting = novelaiConfig?.expression || 'none';
    const expressionMap: Record<string, string> = {
      'smile': 'smile, happy', 'blush': 'blush, shy, embarrassed', 'laugh': 'laughing, open mouth',
      'cry': 'crying, tears', 'angry': 'angry, frown', 'surprised': 'surprised, wide eyes, open mouth',
      'seductive': 'seductive, bedroom eyes, parted lips', 'sleepy': 'sleepy, drowsy, half-closed eyes',
      'pout': 'pout, pouting', 'wink': 'wink, one eye closed',
    };
    if (expressionSetting === 'custom' && novelaiConfig?.customExpression) {
      customParts.push(novelaiConfig.customExpression);
    } else if (expressionMap[expressionSetting]) {
      customParts.push(expressionMap[expressionSetting]);
    }
    
    // 添加角色附加提示词（用户在设置中填写的固定提示词）
    if (novelaiConfig?.characterPrompt) {
      customParts.push(novelaiConfig.characterPrompt);
    }
    
    // 添加自定义风格提示词
    if (novelaiConfig?.style === 'custom' && novelaiConfig?.customStylePrompt) {
      customParts.push(novelaiConfig.customStylePrompt);
    }
    
    // 把自定义部分加入promptParts
    promptParts.push(...customParts);

    // 从角色人设提取外观特征
    if (character?.persona) {
      const appearancePatterns = [
        /(?:外貌|外观|样貌|长相|形象|特征|appearance)[：:]\s*([^。\n]+)/ig,
        /(?:头发|发色|眼睛|眼色|瞳色)[：:]?\s*([^，。\n]+)/g,
        /(?:身高|体型|身材)[：:]?\s*([^，。\n]+)/g,
      ];
      
      for (const pattern of appearancePatterns) {
        const matches = character.persona.matchAll(pattern);
        for (const m of matches) {
          if (m[1]) promptParts.push(m[1].trim());
        }
      }
      
      // 直接提取英文描述词
      const englishDesc = character.persona.match(/\b((?:pink|blue|red|green|purple|white|black|blonde|silver|golden|brown)\s+(?:hair|eyes?)|(?:long|short|twin\s*tails?|ponytail|bob|spiky|messy)\s+hair|(?:big|small)\s+(?:breasts?|chest)|(?:slim|curvy|petite|muscular|tall|short)\s+(?:body|figure|build))\b/gi);
      if (englishDesc) {
        promptParts.push(...englishDesc);
      }
    }

    // 智能提取AI回复中的场景/动作/服装
    const sceneDetails = extractSceneDetails(reply);
    if (sceneDetails.length > 0) {
      for (const detail of sceneDetails) {
        if (zhToEnMap[detail]) {
          promptParts.push(zhToEnMap[detail]);
        } else {
          // 尝试部分匹配
          for (const [zh, en] of Object.entries(zhToEnMap)) {
            if (detail.includes(zh)) {
              promptParts.push(en);
              break;
            }
          }
        }
      }
    }

    // 添加风格模板提示词（非自定义时，且用户没有明确指定构图）
    if (novelaiConfig?.style !== 'custom' && !userIntentParts.some(p => /(full body|upper body|close-up|scenic)/.test(p))) {
      const stylePrompts: Record<string, string> = {
        selfie: 'selfie, close-up, looking at viewer, front view',
        portrait: 'upper body, portrait, looking at viewer',
        fullbody: 'full body, standing, from front',
        scene: 'scenic, background, detailed environment',
      };
      const stylePrompt = stylePrompts[novelaiConfig?.style || 'selfie'] || stylePrompts.selfie;
      if (stylePrompt) {
        promptParts.push(stylePrompt);
      }
    }

    // 用户显式要图时，把用户的描述也带上（清理掉触发词）
    if (userRequestsImage && userInput && !alwaysTrigger) {
      const cleaned = userInput
        .replace(/^\s*(\/draw|\/pic|\/image)\b/i, '')
        .replace(/(画|发|来|给|要|想看|看|拍|秀|展示|出|生成).{0,6}(图|图片|照片|自拍|一下|你|出来)/g, '')
        .replace(/(全身|半身|特写|脸|风景|场景|两个人|我们俩)/g, '') // 这些已经处理过了
        .trim();
      if (cleaned && cleaned.length > 1) {
        // 尝试翻译用户描述
        let translatedCleaned = cleaned;
        for (const [zh, en] of Object.entries(zhToEnMap)) {
          if (cleaned.includes(zh)) {
            translatedCleaned = translatedCleaned.replace(zh, en);
          }
        }
        promptParts.push(translatedCleaned);
      }
    }

    // 基础提示词 - 根据性别动态设置，添加背景防止透明
    const nsfwMode = novelaiConfig?.nsfwMode || false;
    const qualityTags = nsfwMode 
      ? 'beautiful, high quality, detailed, masterpiece'
      : 'beautiful, high quality, detailed, masterpiece, safe, sfw';
    promptParts.push(`${character?.name || genderBase}, ${genderTag}, ${qualityTags}, simple background, white background`);

    const prompt = [...new Set(promptParts)].join(', ');
    console.log('Generated image prompt:', prompt);

    return { should: true, prompt };
  };

  const generateNovelAIImage = async (prompt: string) => {
    if (!novelaiConfig?.apiKey || !user?.id) return;
    
    setGeneratingImage(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('novelai-generate', {
        body: {
          prompt,
          userId: user.id,
          characterName: character?.name,
        },
      });
      
      if (error) {
        console.error('NovelAI error:', error);

        // 尽量把后端返回的具体错误展示给用户（例如：密钥无效/额度不足/请求过频/模型错误）
        let detail = error.message;
        const resp = (error as any)?.context?.response as Response | undefined;
        if (resp) {
          try {
            const body = await resp.clone().json();
            if (body?.error) detail = body.error;
          } catch {
            // ignore
          }
        }

        toast.error('画图失败: ' + detail);
        return;
      }
      
      if (data?.success && data?.imageUrl) {
        // 图片消息 - 只发图片，不显示提示词
        const imageContent = '';
        
        // 添加图片消息
        const imageMsg = {
          id: Date.now() + 1000,
          role: 'assistant',
          content: imageContent,
          image_url: data.imageUrl,
        };
        
        setMessages(prev => [...prev, imageMsg]);
        
        // 保存到数据库 - content为空，只保存图片URL
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: imageContent,
          image_url: data.imageUrl,
        });
        
        toast.success('图片生成完成~');
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error('Generate image error:', err);
      toast.error('画图失败，请稍后重试');
    } finally {
      setGeneratingImage(false);
    }
  };

  // 图片选择处理
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }
    
    // 预览图片
    const url = URL.createObjectURL(file);
    setPendingImage({ url, file });
  };

  // 上传图片到存储
  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload image error:', error);
      return null;
    }
  };

  // 发送带图片的消息
  const sendMessageWithImage = async () => {
    if (!pendingImage || loading) return;
    
    setUploadingImage(true);
    setLoading(true);
    
    try {
      // 上传图片
      const imageUrl = await uploadImageToStorage(pendingImage.file);
      if (!imageUrl) {
        toast.error('图片上传失败');
        setUploadingImage(false);
        setLoading(false);
        return;
      }
      
      // 构建消息内容 - 如果用户没有输入文字，则只存 [图片] 标记（不显示"发送了一张图片"）
      const textContent = input.trim();
      const messageContent = textContent ? `[图片] ${textContent}` : '[图片]';
      
      // 保存用户消息到数据库
      const { data: savedMsg, error: saveError } = await supabase
        .from('chat_messages')
        .insert({ 
          user_id: user?.id, 
          character_id: characterId, 
          role: 'user', 
          content: messageContent,
          image_url: imageUrl
        })
        .select()
        .single();
      
      if (saveError) {
        toast.error('发送失败');
        setUploadingImage(false);
        setLoading(false);
        return;
      }
      
      // 更新UI
      setMessages(prev => [...prev, { 
        id: savedMsg?.id || Date.now(), 
        role: 'user', 
        content: messageContent,
        image_url: imageUrl
      }]);
      
      // 清理状态
      setInput('');
      setPendingImage(null);
      setUploadingImage(false);
      URL.revokeObjectURL(pendingImage.url);
      
      // 调用AI（带图片识别），过滤掉表情包消息
      const recentMessages = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.content?.startsWith('[STICKER:'))
        .slice(-historyLimit)
        .map(m => ({ role: m.role, content: m.content, image_url: m.image_url }));
      
      const body: any = { 
        messages: [...recentMessages, { role: 'user', content: textContent, image_url: imageUrl }], 
        characterName: character?.name, 
        characterId: characterId,
        userId: user?.id,
        persona: character?.persona,
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined,
        replyMode: replyMode,
        onlineMessageCount: onlineMessageCount,
        transferEnabled: transferEnabled,
        historyLimit: historyLimit,
        hasImage: true, // 标记有图片
        imageUrl: imageUrl
      };
      
      body.userApiKey = apiConfig.apiKey;
      body.provider = apiConfig.provider;
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: '请求失败' }));
        toast.error(errorData.error || 'AI服务暂时不可用');
        setLoading(false);
        return;
      }
      
      // 解析响应（复用 sendMessage 的完整解析逻辑）
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();
      
      let assistantContent = '';
      
      // 1. 尝试解析为JSON（非流式响应）
      if (!fullText.startsWith('data:') && !fullText.includes('\ndata:')) {
        try {
          const json = JSON.parse(fullText);
          if (json.error) {
            toast.error(json.error);
            setLoading(false);
            return;
          }
          assistantContent = json.choices?.[0]?.message?.content 
            || json.choices?.[0]?.delta?.content
            || json.choices?.[0]?.text
            || json.content
            || '';
        } catch {
          if (fullText.trim() && !fullText.includes('<!DOCTYPE')) {
            assistantContent = fullText.trim();
          }
        }
      }
      
      // 2. SSE格式解析
      if (!assistantContent) {
        const lines = fullText.split('\n');
        for (const rawLine of lines) {
          let line = rawLine.trim();
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const json = JSON.parse(jsonStr);
              const delta = json.choices?.[0]?.delta?.content 
                || json.choices?.[0]?.message?.content
                || json.choices?.[0]?.text
                || json.content
                || json.delta?.content
                || '';
              if (delta) assistantContent += delta;
            } catch {}
          }
        }
      }
      
      if (!assistantContent.trim()) {
        console.error('Empty response from image API. Raw:', fullText.slice(0, 300));
        toast.error('AI返回为空');
        setLoading(false);
        return;
      }
      
      // 清理 ||| 分隔符（图片模式不分条）
      assistantContent = assistantContent
        .trim()
        .replace(/^\|{2,}\s*/g, '')
        .replace(/\s*\|{2,}$/g, '')
        .replace(/\|{2,}/g, ' ')
        .replace(/^\n+|\n+$/g, '');
      
      if (assistantContent.trim()) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: assistantContent }]);
        
        await supabase.from('chat_messages').insert({ 
          user_id: user?.id, 
          character_id: characterId, 
          role: 'assistant', 
          content: assistantContent 
        });
      }
    } catch (err) {
      console.error('Send image error:', err);
      toast.error('发送失败');
    }
    
    setLoading(false);
  };

  const sendMessage = async () => {
    // 如果有待发送的图片，走图片发送逻辑
    if (pendingImage) {
      return sendMessageWithImage();
    }
    
    if (!input.trim()) return;
    
    // 检查API配置是否加载完成
    if (apiConfigLoading) {
      toast.error('API配置加载中，请稍候...');
      return;
    }
    
    // 检查是否有API配置
    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }
    
    // 构建消息内容，包含引用
    let messageContent = input;
    if (quotedMessage) {
      messageContent = `[引用: "${quotedMessage.content.slice(0, 50)}${quotedMessage.content.length > 50 ? '...' : ''}"]\n${input}`;
    }

    // 如果用户明确要求“来/发”某个表情包，则优先按用户意图发送（在 AI 回复后作为单独一条消息）
    const requestedSticker = stickerEnabled
      ? parseStickerRequest(messageContent, defaultStickers, userStickers)
      : null;

    const userMessage = { role: 'user', content: messageContent };
    const tempId = Date.now();
    const isWaitingForAI = loading; // 记录当前是否正在等待AI回复
    // 先清空输入，允许用户继续输入
    setInput('');
    setQuotedMessage(null);
    
    // 如果当前没有在等待AI回复，设置loading
    if (!isWaitingForAI) {
      setLoading(true);
    }
    
    // 先保存到数据库，确保消息不丢失
    const { data: savedMsg, error: saveError } = await supabase
      .from('chat_messages')
      .insert({ 
        user_id: user?.id, 
        character_id: characterId, 
        role: 'user', 
        content: messageContent,
        quoted_message_id: quotedMessage?.id || null
      })
      .select()
      .single();
    
    if (saveError) {
      console.error('Save message error:', saveError);
      toast.error('发送失败，请重试');
      setLoading(false);
      setInput(messageContent); // 恢复输入
      return;
    }
    
    // 消息保存成功后再更新UI
    setMessages(prev => [...prev, { ...userMessage, id: savedMsg?.id || tempId, quotedMessage }]);

    try {
      // 保留历史消息中的图片URL，过滤掉表情包消息
      const recentMessages = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.content?.startsWith('[STICKER:'))
        .slice(-historyLimit)
        .map(m => ({ role: m.role, content: m.content, image_url: m.image_url }));
      
      // 检查最近消息中是否有图片（用于上下文），排除表情包
      const hasImageInHistory = recentMessages.some(m => m.image_url && !m.content?.startsWith('[STICKER:'));
      
      const body: any = { 
        messages: [...recentMessages, userMessage], 
        characterName: character?.name, 
        characterId: characterId,
        userId: user?.id,
        persona: character?.persona,
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined,
        replyMode: replyMode,
        onlineMessageCount: onlineMessageCount,
        transferEnabled: transferEnabled,
        historyLimit: historyLimit,
        hasImageInHistory: hasImageInHistory
      };
      
      // 始终传递API配置
      body.userApiKey = apiConfig.apiKey;
      body.provider = apiConfig.provider;
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;
      
      console.log('Sending chat with API config:', { 
        hasApiKey: !!body.userApiKey, 
        provider: body.provider, 
        hasBaseUrl: !!body.baseUrl, 
        model: body.model 
      });
      
      // Use fetch directly for streaming
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: '请求失败' }));
        console.error('Chat error:', errorData);
        toast.error(errorData.error || 'AI服务暂时不可用');
        setLoading(false);
        return;
      }
      
      if (!resp.body) {
        toast.error('无法获取响应');
        setLoading(false);
        return;
      }
      
      const contentType = resp.headers.get('content-type') || '';
      let assistantContent = '';
      
      // 尝试检测响应格式
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      // 先读取所有数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode(); // flush remaining
      
      console.log('Raw response preview:', fullText.slice(0, 300));
      
      // 尝试多种解析方式
      // 1. 首先检查是否是纯JSON响应
      if (!fullText.startsWith('data:') && !fullText.includes('\ndata:')) {
        try {
          const json = JSON.parse(fullText);
          // 检查是否是错误响应
          if (json.error) {
            toast.error(json.error);
            setLoading(false);
            return;
          }
          // 尝试多种格式提取内容
          assistantContent = json.choices?.[0]?.message?.content 
            || json.choices?.[0]?.delta?.content
            || json.choices?.[0]?.text
            || json.content
            || json.result
            || json.output
            || json.response
            || json.text
            || json.answer
            || (typeof json === 'string' ? json : '');
        } catch {
          // 不是JSON，可能是纯文本
          if (fullText.trim() && !fullText.includes('<!DOCTYPE')) {
            assistantContent = fullText.trim();
          }
        }
      }
      
      // 2. SSE格式解析
      if (!assistantContent) {
        const lines = fullText.split('\n');
        for (const rawLine of lines) {
          let line = rawLine.trim();
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const json = JSON.parse(jsonStr);
              const delta = json.choices?.[0]?.delta?.content 
                || json.choices?.[0]?.message?.content
                || json.choices?.[0]?.text
                || json.content
                || json.delta?.content
                || '';
              if (delta) assistantContent += delta;
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
      
      // 如果内容为空，显示详细错误
      if (!assistantContent.trim()) {
        console.error('Empty response. Raw data:', fullText.slice(0, 500));
        toast.error('AI返回为空，请检查API配置是否正确');
        setLoading(false);
        return;
      }
      
      // 清理内容 - 移除前后空白和多余换行
      assistantContent = assistantContent.trim().replace(/^\n+|\n+$/g, '');
      
      // 健壮的多消息解析 - 处理不同API返回格式的差异
      let multiMessages: string[] = [];
      
      if (replyMode === 'online') {
        // 清理常见的格式问题
        let cleanedContent = assistantContent
          // 移除开头和结尾的 |||
          .replace(/^\|{2,}\s*/g, '')
          .replace(/\s*\|{2,}$/g, '')
          // 统一分隔符格式（有些API可能用 || 或 ||| 或 ||||）
          .replace(/\|{2,}/g, '|||')
          // 移除可能的换行符混杂
          .replace(/\n\s*\|\|\|\s*\n?/g, '|||')
          .replace(/\|\|\|\s*\n/g, '|||');
        
        // 按 ||| 分割
        multiMessages = cleanedContent
          .split('|||')
          .map(s => s.trim())
          .filter(s => s.length > 0 && s !== '|||');
        
        const fixedCount = onlineMessageCount === '1-2' ? 2 : 5;
        
        // 如果分割后只有1条或0条，说明API没有正确使用|||分隔，当作普通回复处理
        if (multiMessages.length <= 1) {
          console.log('Online mode: API did not use ||| separator, treating as single message');
          multiMessages = [assistantContent.replace(/\|{2,}/g, ' ').trim()];
        }
        
        // 限制最多条数
        if (multiMessages.length > fixedCount) {
          multiMessages = multiMessages.slice(0, fixedCount);
        }
      } else {
        // 小说模式：不分割
        multiMessages = [assistantContent.replace(/\|\|\|/g, ' ').trim()];
      }
      
      // 最多5条
      if (multiMessages.length > 5) {
        multiMessages = multiMessages.slice(0, 5);
      }
      
      // 检查 AI 返回中是否包含转账指令
      const handleAITransfer = async (content: string): Promise<string> => {
        if (!transferEnabled) return content;
        
        const transferData = parseTransferCommand(content);
        if (transferData) {
          const transfer = await createTransfer(transferData.amount, transferData.message);
          if (transfer) {
            setPendingTransfers(prev => [...prev, transfer]);
            const transferMsgContent = `[TRANSFER:${transfer.id}:${transferData.amount}:${transferData.message}]`;
            setMessages(prev => [...prev, { 
              id: Date.now() + 999, 
              role: 'transfer', 
              content: transferMsgContent,
              transferData: transfer
            }]);
          }
          // 移除转账指令，只保留对话内容
          return removeTransferCommand(content);
        }
        return content;
      };
      
      if (replyMode === 'online' && multiMessages.length > 1) {
        // 线上模式：逐条显示消息，有延迟效果
        let delay = 0;
        for (let i = 0; i < multiMessages.length; i++) {
          let msgContent = multiMessages[i];
          const msgDelay = delay;
          
          // 检查这条消息是否包含转账指令
          const transferData = parseTransferCommand(msgContent);
          
          setTimeout(async () => {
            const msgId = Date.now() + i;
            
            // 如果有转账指令，处理转账
            if (transferEnabled && transferData) {
              const transfer = await createTransfer(transferData.amount, transferData.message);
              if (transfer) {
                setPendingTransfers(prev => [...prev, transfer]);
                const transferMsgContent = `[TRANSFER:${transfer.id}:${transferData.amount}:${transferData.message}]`;
                setMessages(prev => [...prev, { 
                  id: msgId + 0.5, 
                  role: 'transfer', 
                  content: transferMsgContent,
                  transferData: transfer
                }]);
              }
              // 移除转账指令
              msgContent = removeTransferCommand(msgContent);
            }
            
            // 如果移除转账指令后还有内容，显示消息
            if (msgContent.trim()) {
              // 生成语音气泡（如果TTS启用且voiceMode为always）
              let audioBase64: string | null = null;
              if (ttsConfig?.enabled && voiceMode === 'always') {
                audioBase64 = await generateTTSAudio(msgContent);
                // 使用音频队列串行播放
                if (audioBase64) {
                  const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
                  audioQueue.enqueue({ src: audioUrl }).catch(console.error);
                } else {
                  // 语音生成失败，在总是语音模式下提示用户
                  console.warn('语音生成失败，回退到文本消息');
                }
              }
              
              setMessages(prev => [...prev, { 
                id: msgId, 
                role: 'assistant', 
                content: msgContent,
                audioBase64: audioBase64 || undefined,
              }]);
              
              // 保存到数据库，包括audio_url
              await supabase.from('chat_messages').insert({ 
                user_id: user?.id, 
                character_id: characterId, 
                role: 'assistant', 
                content: msgContent,
                audio_url: audioBase64 || null
              });
            }
          }, msgDelay);
          
          // 每条消息间隔 600-1200ms，模拟打字延迟
          delay += 600 + Math.random() * 600;
        }

        // 等待所有消息显示完成后再触发画图和表情包，避免插入到消息中间
        setTimeout(async () => {
          setLoading(false);
          
          // 线上模式画图：在消息全部显示完后执行
          if (novelaiConfig?.apiKey) {
            const combinedForImage = multiMessages
              .map((m) => removeTransferCommand(m))
              .join(' ')
              .trim();
            if (combinedForImage) {
              const { should, prompt } = shouldGenerateImage(messageContent, combinedForImage);
              if (should) {
                void generateNovelAIImage(prompt);
              }
            }
          }

          // 线上模式语音：用户点名必发；偶尔模式概率发（最多1-2条）
          const userWantsVoice = isVoiceRequestedByUser(messageContent);

          if (userWantsVoice && (!ttsConfig?.enabled || !ttsConfig.apiKey || !ttsConfig.baseUrl)) {
            toast.error('还没配置语音服务（去设置里开启TTS）');
          } else if (userWantsVoice && !character?.voice_id?.trim()) {
            toast.error('请先设置角色语音ID（右上角菜单）');
          } else if (ttsConfig?.enabled && voiceMode !== 'always' && (userWantsVoice || voiceMode === 'sometimes')) {
            const shouldSendVoice = userWantsVoice || Math.random() < 0.8;

            if (shouldSendVoice) {
              const voiceCount = userWantsVoice ? (Math.random() < 0.5 ? 2 : 1) : 1;
              const voiceText = removeTransferCommand(multiMessages[multiMessages.length - 1] || '').trim();

              if (voiceText) {
                for (let i = 0; i < voiceCount; i++) {
                  const voiceAudio = await generateTTSAudio(voiceText);

                  if (!voiceAudio) {
                    if (userWantsVoice) toast.error('语音生成失败');
                    break;
                  }

                  setMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now() + 10 + i,
                      role: 'assistant',
                      content: voiceText,
                      audioBase64: voiceAudio,
                    },
                  ]);

                  audioQueue
                    .enqueue({ src: `data:audio/mpeg;base64,${voiceAudio}` })
                    .catch(console.error);

                  await supabase.from('chat_messages').insert({
                    user_id: user?.id,
                    character_id: characterId,
                    role: 'assistant',
                    content: voiceText,
                    audio_url: voiceAudio,
                  });

                  if (i < voiceCount - 1) {
                    await new Promise((r) => setTimeout(r, 800));
                  }
                }
              } else if (userWantsVoice) {
                toast.error('没有可生成语音的内容');
              }
            }
          }
          
          // 线上模式表情包
          if (stickerEnabled) {
            const combinedContent = multiMessages.join(' ');
            const recentMsgs = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));

            const stickerToSend =
              requestedSticker ||
              (shouldSendSticker(combinedContent, recentMsgs)
                ? matchSticker(combinedContent, defaultStickers, userStickers)
                : null);

            if (stickerToSend) {
              const stickerMsg = {
                id: Date.now() + 100,
                role: 'assistant',
                content: '',
                image_url: stickerToSend.imageUrl
              };
              setMessages(prev => [...prev, stickerMsg]);

              await supabase.from('chat_messages').insert({
                user_id: user?.id,
                character_id: characterId,
                role: 'assistant',
                content: `[STICKER:${stickerToSend.id}]`,
                image_url: stickerToSend.imageUrl
              });
            }
          }
        }, delay + 500);
        
        return; // 提前返回，不走下面的逻辑
      }
      
      // 小说模式或线上模式下只拆出1条：清理可能残留的 ||| 分隔符
      let finalContent = assistantContent.replace(/\|\|\|/g, ' ').trim();
      
      // 处理转账指令
      const cleanContent = await handleAITransfer(finalContent);
      
      if (cleanContent.trim()) {
        // 生成语音气泡（如果TTS启用且voiceMode为always）
        let audioBase64: string | null = null;
        if (ttsConfig?.enabled && voiceMode === 'always') {
          audioBase64 = await generateTTSAudio(cleanContent);
          // 使用音频队列串行播放
          if (audioBase64) {
            const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
            audioQueue.enqueue({ src: audioUrl }).catch(console.error);
          } else {
            // 语音生成失败，在总是语音模式下提示用户
            console.warn('语音生成失败，回退到文本消息');
          }
        }
        
        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          role: 'assistant', 
          content: cleanContent,
          audioBase64: audioBase64 || undefined,
        }]);

        await supabase.from('chat_messages').insert({ 
          user_id: user?.id, 
          character_id: characterId, 
          role: 'assistant', 
          content: cleanContent,
          audio_url: audioBase64 || null
        });
        
        // 角色语音输出：用户点名必发；偶尔模式概率发（最多1-2条）
        const userWantsVoice = isVoiceRequestedByUser(messageContent);

        if (userWantsVoice && (!ttsConfig?.enabled || !ttsConfig.apiKey || !ttsConfig.baseUrl)) {
          toast.error('还没配置语音服务（去设置里开启TTS）');
        } else if (userWantsVoice && !character?.voice_id?.trim()) {
          toast.error('请先设置角色语音ID（右上角菜单）');
        } else if (ttsConfig?.enabled && voiceMode !== 'always' && (userWantsVoice || voiceMode === 'sometimes')) {
          const shouldSendVoice = userWantsVoice || Math.random() < 0.8;

          if (shouldSendVoice) {
            const voiceCount = userWantsVoice ? (Math.random() < 0.5 ? 2 : 1) : 1;

            setTimeout(async () => {
              for (let i = 0; i < voiceCount; i++) {
                const voiceAudio = await generateTTSAudio(cleanContent);

                if (!voiceAudio) {
                  if (userWantsVoice) toast.error('语音生成失败');
                  break;
                }

                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now() + 10 + i,
                    role: 'assistant',
                    content: cleanContent,
                    audioBase64: voiceAudio,
                  },
                ]);

                audioQueue
                  .enqueue({ src: `data:audio/mpeg;base64,${voiceAudio}` })
                  .catch(console.error);

                await supabase.from('chat_messages').insert({
                  user_id: user?.id,
                  character_id: characterId,
                  role: 'assistant',
                  content: cleanContent,
                  audio_url: voiceAudio,
                });

                if (i < voiceCount - 1) {
                  await new Promise((r) => setTimeout(r, 800));
                }
              }
            }, 500);
          }
        }
        
        // 表情包发送逻辑
        if (stickerEnabled) {
          const recentMsgs = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));

          const stickerToSend =
            requestedSticker ||
            (shouldSendSticker(cleanContent, recentMsgs)
              ? matchSticker(cleanContent, defaultStickers, userStickers)
              : null);

          if (stickerToSend) {
            // 延迟发送表情包，模拟自然对话
            setTimeout(async () => {
              const stickerMsg = {
                id: Date.now() + 2,
                role: 'assistant',
                content: '',
                image_url: stickerToSend.imageUrl
              };
              setMessages(prev => [...prev, stickerMsg]);

              // 保存表情包消息到数据库
              await supabase.from('chat_messages').insert({
                user_id: user?.id,
                character_id: characterId,
                role: 'assistant',
                content: `[STICKER:${stickerToSend.id}]`,
                image_url: stickerToSend.imageUrl
              });
            }, 500 + Math.random() * 500);
          }
        }
      }
      
      // 检查是否需要生成图片
      if (novelaiConfig?.apiKey && cleanContent.trim()) {
        const { should, prompt } = shouldGenerateImage(messageContent, cleanContent);
        if (should) {
          // 异步生成图片，不阻塞主流程
          generateNovelAIImage(prompt);
        }
      }
      
      // 触发记忆摘要生成（每20条消息）
      const totalMessages = messages.length + 2; // +2 for user and assistant messages just added
      if (totalMessages > 0 && totalMessages % 20 === 0) {
        console.log('Triggering memory summary generation at message count:', totalMessages);
        // 后台生成摘要，不阻塞UI
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-memory-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            characterId,
            userId: user?.id,
            characterName: character?.name,
            characterPersona: character?.persona,
          }),
        }).then(res => {
          if (res.ok) {
            console.log('Memory summary generated successfully');
          } else {
            console.error('Memory summary generation failed');
          }
        }).catch(err => {
          console.error('Memory summary error:', err);
        });
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      toast.error('发送失败，请检查网络或API设置');
    }
    setLoading(false);
  };

  // Pastel macaron colors
  const userBubbleColor = customization.bubble_color || '#FFB5C5';
  const friendBubbleColor = customization.friend_bubble_color || '#B5D8FF';
  const bubbleOpacity = customization.bubble_opacity ?? 0.95;
  const bubbleSize = customization.bubble_size || 16;
  const fontColor = (customization as any).font_color || '#333333';
  const friendFontColor = (customization as any).friend_font_color || '#333333';
  
  // 头像框
  const userAvatarFrame = (customization as any).avatar_frame_url || '';
  const friendAvatarFrame = (customization as any).friend_avatar_frame_url || '';
  
// 气泡框预设 - 带三丽鸥装饰 + 头像装饰
  const bubbleFramePresets: Record<string, { type: 'css' | 'image'; gradient?: string; borderColor?: string; decorIcon: string; imageUrl?: string; decorImage?: string; backdropFilter?: string; boxShadow?: string; highlight?: string }> = {
    'cute-pink': { type: 'css', gradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFB5C5 100%)', borderColor: '#FFB5C5', decorIcon: '🎀' },
    'cute-blue': { type: 'css', gradient: 'linear-gradient(135deg, #E4F4FF 0%, #B5D8FF 100%)', borderColor: '#B5D8FF', decorIcon: '☁️' },
    'cute-yellow': { type: 'css', gradient: 'linear-gradient(135deg, #FFF9E4 0%, #FFFAB5 100%)', borderColor: '#FFE066', decorIcon: '⭐' },
    'cute-green': { type: 'css', gradient: 'linear-gradient(135deg, #E4FFF4 0%, #B5FFD8 100%)', borderColor: '#B5FFD8', decorIcon: '🍀' },
    'cute-purple': { type: 'css', gradient: 'linear-gradient(135deg, #F4E4FF 0%, #E5B5FF 100%)', borderColor: '#E5B5FF', decorIcon: '💜' },
    // 水滴透明磨砂气泡框 - 高光立体效果
    'water-drop': { type: 'css', gradient: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 15%, rgba(200,230,255,0.35) 40%, rgba(170,210,255,0.25) 70%, rgba(255,255,255,0.5) 100%)', borderColor: 'rgba(255,255,255,0.8)', decorIcon: '', backdropFilter: 'blur(12px) saturate(180%)', boxShadow: 'inset 0 4px 12px rgba(255,255,255,0.9), inset 0 -3px 8px rgba(100,180,255,0.25), inset 3px 0 8px rgba(255,255,255,0.5), inset -3px 0 8px rgba(255,255,255,0.5), 0 6px 20px rgba(80,140,200,0.3), 0 2px 6px rgba(255,255,255,0.6)', highlight: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,255,255,0.8) 0%, transparent 60%)' },
    // 带卡通头像装饰的黑红渐变气泡框
    'anime-head': { type: 'css', gradient: 'linear-gradient(180deg, #1a1a1a 0%, #2a0000 50%, #8b0000 100%)', borderColor: '#8b0000', decorIcon: '', decorImage: animeHeadDecor },
    // 可爱男孩气泡框 - 白底黑边+边缘贴卡通小人
    'cute-boy': { type: 'css', gradient: '#FFFFFF', borderColor: '#000000', decorIcon: '', decorImage: cuteBoyHead },
  };
  
  const userBubbleFrame = (customization as any).bubble_frame_url || '';
  const friendBubbleFrame = (customization as any).friend_bubble_frame_url || '';
  
  const normalizeHex = (value: string, fallback: string) => {
    if (typeof value !== 'string') return fallback;
    const hex = value.trim();
    if (hex.startsWith('#') && hex.length === 7) return hex;
    if (hex.startsWith('#') && hex.length === 4) {
      const r = hex[1];
      const g = hex[2];
      const b = hex[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
  };

  const getBubbleBackgroundStyle = (isUser: boolean): React.CSSProperties => {
    const frameId = isUser ? userBubbleFrame : friendBubbleFrame;
    const frame = bubbleFramePresets[frameId];
    
    if (frame) {
      if (frame.type === 'image' && frame.imageUrl) {
        // 图片气泡框 - 使用背景图片，自适应内容大小
        return { 
          backgroundImage: `url(${frame.imageUrl})`,
          backgroundSize: '100% 100%', // 拉伸适应气泡大小
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: 'transparent',
        };
      }
      // CSS 渐变气泡框
      const style: React.CSSProperties = { 
        background: frame.highlight 
          ? `${frame.highlight}, ${frame.gradient}`
          : frame.gradient 
      };
      if (frame.borderColor) {
        style.border = `2px solid ${frame.borderColor}`;
      }
      if (frame.backdropFilter) {
        style.backdropFilter = frame.backdropFilter;
        style.WebkitBackdropFilter = frame.backdropFilter;
      }
      if (frame.boxShadow) {
        style.boxShadow = frame.boxShadow;
      }
      return style;
    }

    const fallback = 'hsl(var(--muted))';
    const hex = normalizeHex(isUser ? userBubbleColor : friendBubbleColor, fallback);
    return { backgroundColor: hex };
  };

  const getUserBubbleDecor = () => bubbleFramePresets[userBubbleFrame]?.decorIcon;
  const getFriendBubbleDecor = () => bubbleFramePresets[friendBubbleFrame]?.decorIcon;
  const getUserBubbleDecorImage = () => bubbleFramePresets[userBubbleFrame]?.decorImage;
  const getFriendBubbleDecorImage = () => bubbleFramePresets[friendBubbleFrame]?.decorImage;

  // 选择表情包图片（先预览，不立即上传）
  const handleStickerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('表情包大小不能超过2MB');
      return;
    }
    
    const previewUrl = URL.createObjectURL(file);
    setPendingStickerFile({ file, previewUrl });
  };

  // 确认上传表情包
  const handleStickerUpload = async () => {
    if (!pendingStickerFile || !user?.id) return;
    
    // 解析关键词
    const keywords = stickerKeywordInput
      .split(/[,，、\s]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      toast.error('请输入至少一个关键词');
      return;
    }
    
    setUploadingSticker(true);
    
    try {
      const file = pendingStickerFile.file;
      const fileExt = file.name.split('.').pop();
      // 重要：photos 桶的上传策略要求第一层目录必须是 user.id
      const fileName = `${user.id}/stickers/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);
      
      if (uploadError) {
        toast.error('上传失败: ' + uploadError.message);
        setUploadingSticker(false);
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);
      
      // 保存到数据库
      const { data, error } = await supabase
        .from('user_stickers')
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          keywords: keywords
        })
        .select()
        .single();
      
      if (error) {
        toast.error('保存失败: ' + error.message);
        setUploadingSticker(false);
        return;
      }
      
      // 更新本地状态
      setUserStickers(prev => [{
        id: data.id,
        imageUrl: publicUrl,
        keywords: keywords,
        text: keywords[0]
      }, ...prev]);
      
      // 清理
      URL.revokeObjectURL(pendingStickerFile.previewUrl);
      setPendingStickerFile(null);
      setStickerKeywordInput('');
      toast.success('表情包上传成功！');
    } catch (err) {
      console.error('Upload sticker error:', err);
      toast.error('上传失败');
    } finally {
      setUploadingSticker(false);
    }
  };

  // 取消选择的表情包
  const cancelStickerSelect = () => {
    if (pendingStickerFile) {
      URL.revokeObjectURL(pendingStickerFile.previewUrl);
      setPendingStickerFile(null);
    }
    setStickerKeywordInput('');
  };

  // 删除用户表情包
  const handleDeleteSticker = async (stickerId: string) => {
    if (!user?.id) return;
    
    await supabase.from('user_stickers').delete().eq('id', stickerId);
    setUserStickers(prev => prev.filter(s => s.id !== stickerId));
    toast.success('已删除');
  };

  // 快捷发送表情包（用户点击即发送，并触发AI回复）
  const sendStickerDirectly = async (sticker: StickerType) => {
    if (!user?.id || !characterId || !character) return;
    setShowStickerPicker(false);

    // 用户发送表情包消息
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: '',
      image_url: sticker.imageUrl
    };
    setMessages(prev => [...prev, userMsg]);

    await supabase.from('chat_messages').insert({
      user_id: user.id,
      character_id: characterId,
      role: 'user',
      content: `[STICKER:${sticker.id}]`,
      image_url: sticker.imageUrl
    });

    // 触发AI回复（告诉AI用户发了表情包）
    setLoading(true);
    try {
      const stickerText = sticker.text || '表情包';
      const recentMessages = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.content?.startsWith('[STICKER:'))
        .slice(-historyLimit)
        .map(m => ({ role: m.role, content: m.content }));
      
      const body: any = { 
        messages: [...recentMessages, { role: 'user', content: `[用户发送了一个"${stickerText}"的表情包，请用简短的话回应]` }], 
        characterName: character.name, 
        characterId: characterId,
        userId: user.id,
        persona: character.persona,
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined,
        replyMode: replyMode,
        onlineMessageCount: onlineMessageCount,
        transferEnabled: transferEnabled,
        historyLimit: historyLimit,
      };
      
      body.userApiKey = apiConfig.apiKey;
      body.provider = apiConfig.provider;
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error('Sticker response error');
        setLoading(false);
        return;
      }
      
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();
      
      let assistantContent = '';
      
      // 解析响应
      if (!fullText.startsWith('data:') && !fullText.includes('\ndata:')) {
        try {
          const json = JSON.parse(fullText);
          assistantContent = json.choices?.[0]?.message?.content 
            || json.choices?.[0]?.delta?.content
            || json.content
            || '';
        } catch {
          if (fullText.trim() && !fullText.includes('<!DOCTYPE')) {
            assistantContent = fullText.trim();
          }
        }
      }
      
      // SSE格式解析
      if (!assistantContent) {
        const lines = fullText.split('\n');
        for (const rawLine of lines) {
          let line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            assistantContent += delta;
          } catch {}
        }
      }
      
      // 清理内容（移除|||分隔符，因为表情包回复应该简短）
      assistantContent = assistantContent.replace(/\|\|\|/g, ' ').trim();
      
      if (assistantContent) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: assistantContent }]);
        await supabase.from('chat_messages').insert({ 
          user_id: user.id, 
          character_id: characterId, 
          role: 'assistant', 
          content: assistantContent 
        });
      }
    } catch (err) {
      console.error('Sticker AI response error:', err);
    }
    setLoading(false);
  };

  // 开始通话（语音/视频）- 先显示来电动画
  const startCall = (type: 'voice' | 'video') => {
    setShowCallDialog(type);
    setCallRinging(true);
    setCallMessages([]);
    setCallDuration(0);
    setCallStartTime(null);
    // 加载已保存的视频URL
    setCallVideoUrl(savedCallVideoUrl);
    setCallVideoPlaying(false);
    
    // 播放来电铃声
    try {
      // 优先使用角色自定义铃声
      const customRingtoneUrl = character?.ringtone_url;
      console.log('[startCall] ringtone_url:', customRingtoneUrl);
      if (customRingtoneUrl) {
        // 使用自定义音频文件
        const audio = new Audio(customRingtoneUrl);
        audio.loop = true;
        audio.volume = 0.7;
        audio.play().catch(console.log);
        ringtoneAudioRef.current = { 
          stop: () => { 
            audio.pause(); 
            audio.currentTime = 0; 
          } 
        } as any;
      } else {
        // 回退到Web Audio API生成铃声
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        let isRinging = true; // 使用局部变量避免闭包问题
        
        const playRingtone = () => {
          if (!isRinging) return;
          
          // 创建简单的铃声音调
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        };
        
        // 立即播放一次
        playRingtone();
        
        // 设置循环铃声
        const ringtoneInterval = setInterval(() => {
          if (!isRinging) {
            clearInterval(ringtoneInterval);
            audioContext.close();
            return;
          }
          playRingtone();
        }, 1500);
        
        // 保存停止函数
        ringtoneAudioRef.current = { 
          stop: () => {
            isRinging = false;
            clearInterval(ringtoneInterval);
            audioContext.close();
          }
        } as any;
      }
    } catch (err) {
      console.log('Ringtone playback failed:', err);
    }
  };

  // 接听通话 - 先解锁音频，自动开启语音识别
  const answerCall = async () => {
    // 先更新UI，避免某些浏览器在音频解锁阶段卡住导致“点了没反应”

    // 停止来电铃声
    if (ringtoneAudioRef.current) {
      (ringtoneAudioRef.current as any).stop?.();
      ringtoneAudioRef.current = null;
    }

    setCallRinging(false);
    setInCall(true);
    setCallStartTime(Date.now());
    setInterimTranscript('');

    // 再尝试解锁音频自动播放（不允许阻塞太久）
    try {
      await Promise.race([
        audioQueue.unlock(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800)),
      ]);
    } catch {
      // ignore
    }
    
    // 角色的开场白 + TTS播放
    const greeting = showCallDialog === 'voice'
      ? `喂？${profile?.nickname || ''}？怎么啦，想我了吗～`
      : `哇，视频来了！让我看看你～ 你今天怎么样呀？`;
    
    setCallMessages([{ role: 'assistant', content: greeting }]);
    
    // 播放开场白TTS（使用队列）
    if (ttsConfig?.enabled && ttsConfig.apiKey && ttsConfig.baseUrl && character?.voice_id) {
      try {
        setIsAISpeaking(true);
        const controller = new AbortController();
        const ttsTimeout = window.setTimeout(() => controller.abort(), 8000);

        const ttsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: greeting,
            voiceId: character.voice_id,
            ttsConfig: {
              apiKey: ttsConfig.apiKey,
              baseUrl: ttsConfig.baseUrl,
              model: ttsConfig.model,
            },
          }),
        });

        window.clearTimeout(ttsTimeout);

        const ttsData = await ttsResp.json().catch(() => ({} as any));
        if (ttsData.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${ttsData.audioContent}`;
          // 使用队列播放，完成后开始语音识别
          audioQueue.enqueue({
            src: audioUrl,
            onEnd: () => {
              setIsAISpeaking(false);
              if (speechToText.isSupported && !speechToText.isListening) {
                speechToText.start();
              }
            },
            onError: () => {
              setIsAISpeaking(false);
              if (speechToText.isSupported && !speechToText.isListening) {
                speechToText.start();
              }
            },
          }).catch(() => {
            setIsAISpeaking(false);
            if (speechToText.isSupported && !speechToText.isListening) {
              speechToText.start();
            }
          });
        } else {
          setIsAISpeaking(false);
          // 没有语音则直接开始识别
          if (speechToText.isSupported && !speechToText.isListening) {
            speechToText.start();
          }
        }
      } catch (err) {
        console.error('TTS error:', err);
        setIsAISpeaking(false);
        // 出错也开始识别
        if (speechToText.isSupported && !speechToText.isListening) {
          speechToText.start();
        }
      }
    } else {
      // 没有TTS配置，直接开始语音识别
      if (speechToText.isSupported && !speechToText.isListening) {
        speechToText.start();
      }
    }
  };

  // 结束通话 - 立即关闭UI，后台保存记录
  const endCall = () => {
    // 立即停止所有音频和铃声
    audioQueue.stop();
    if (ringtoneAudioRef.current) {
      (ringtoneAudioRef.current as any).stop?.();
      ringtoneAudioRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (speechToText.isListening) {
      speechToText.stop();
    }
    
    // 缓存需要保存的数据
    const msgsToSave = [...callMessages];
    const callTypeToSave = showCallDialog === 'video' ? '视频通话' : '语音通话';
    const durationToSave = callDuration;
    
    // 立即关闭UI
    setShowCallDialog(null);
    setInCall(false);
    setCallRinging(false);
    setCallMessages([]);
    setCallStartTime(null);
    setCallDuration(0);
    setCallVideoUrl(null);
    setCallVideoPlaying(false);
    setIsAISpeaking(false);
    setInterimTranscript('');
    
    // 播放挂断音效（非阻塞）
    try {
      const hangupAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC4DELI+lllQgJe7wJFECABX0OvYtIhWIB1ittbapnJHLjpYtuzknG5MKRNcqMzEkEMVFHy/18qVXicSLZfCu5dkQCIIAES7z8SMUC8NGXnIyqFqOxoJSKfU1a1wMREFVsrczJlTGQxhxNfPnUoVBlix0tKbVB4La8/i1JVPGhJvy+XXjEkZD2jI5NmMRhgScNXo3YY4Dxl61ePZgC0OIoDZ5diCMxETesnm04U2FRR1zOjYi0cbD2rF5teQTRoTbsvn2I9LGxJuzOfWjkwaEW7L5tiOShsRbcvn1o5LGxFuy+fWjksaEW3L59aOSxsRbcvn1o5KGxFty+bWj0sbEW7L59ePShsRbsvm1o9LGxFty+fWjkobEW7L59aOSxsRbsvm1o9LGxFuy+bWj0sbEW7L5taPSxoRbsvm1o9LGhFuy+bWj0saEW7L5taPSxoRbsvm1o9KGhFuy+bWj0oaEW7L5taPShoRbsvm1o9KGhFuy+bWj0oaEW7L5taPShoRbsvm1o9KGg==');
      hangupAudio.volume = 0.5;
      hangupAudio.play().catch(() => {});
    } catch {}
    
    // 后台保存通话记录（非阻塞）
    if (msgsToSave.length > 0 && user?.id && characterId) {
      const durationStr = formatCallDuration(durationToSave);
      const endMsg = `[${callTypeToSave}] 通话时长 ${durationStr}`;
      
      // 更新本地消息列表（立即）
      setMessages(prev => [
        ...prev,
        ...msgsToSave.map((m, i) => ({ id: Date.now() + i, role: m.role, content: m.content, audioBase64: m.audioBase64 })),
        { id: Date.now() + msgsToSave.length, role: 'assistant', content: endMsg }
      ]);
      
      // 后台保存到数据库（不等待）
      (async () => {
        for (const msg of msgsToSave) {
          await supabase.from('chat_messages').insert({
            user_id: user.id,
            character_id: characterId,
            role: msg.role,
            content: msg.content,
            audio_url: msg.audioBase64 || null
          });
        }
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: endMsg
        });
      })().catch(console.error);
    }
  };

  // 处理视频通话上传6秒视频 - 保存到storage
  const handleCallVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // 验证是视频文件
    if (!file.type.startsWith('video/')) {
      toast.error('请选择视频文件');
      return;
    }

    // 创建预览URL用于验证时长
    const tempUrl = URL.createObjectURL(file);
    
    // 验证视频时长
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 6) {
        toast.error('视频时长不能超过6秒');
        URL.revokeObjectURL(tempUrl);
        return;
      }
      
      // 上传到storage
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/call-videos/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error('Upload video error:', uploadError);
          toast.error('视频上传失败');
          URL.revokeObjectURL(tempUrl);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);
        
        setCallVideoUrl(publicUrl);
        setSavedCallVideoUrl(publicUrl);
        // 保存到characters表
        await supabase.from('characters').update({ call_video_url: publicUrl }).eq('id', characterId);
        toast.success('视频上传成功，已保存');
      } catch (err) {
        console.error('Upload video error:', err);
        toast.error('视频上传失败');
      }
      URL.revokeObjectURL(tempUrl);
    };
    video.src = tempUrl;

    // Reset input
    e.target.value = '';
  };

  // 切换视频播放
  const toggleCallVideo = () => {
    if (!callVideoRef.current) return;
    if (callVideoPlaying) {
      callVideoRef.current.pause();
      setCallVideoPlaying(false);
    } else {
      callVideoRef.current.play();
      setCallVideoPlaying(true);
    }
  };


  // 通话时长计时器
  useEffect(() => {
    if (!callStartTime) return;
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [callStartTime]);

  // 格式化通话时长
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 自动发送通话消息（微信风格语音通话）
  const autoSendCallMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || callLoading || !character) return;

    // 清空临时识别文字
    setInterimTranscript('');
    setCallMessages(prev => [...prev, { role: 'user', content: userText }]);
    setCallLoading(true);

    try {
      const callType = showCallDialog === 'video' ? '视频通话' : '语音通话';
      // 修改系统提示：禁止一切描写，只要纯对话
      const systemHint = `【通话模式 - 铁律！】
你正在和用户${callType}，这是真实通话，不是写小说！

【绝对禁止 - 违反就是失败！】
- 禁止*动作*描写
- 禁止（心理）描写  
- 禁止场景描述
- 禁止"他/她/我..."的第三人称叙述
- 禁止任何括号、星号内容

【必须做到】
- 只说一句话，10-20个字
- 直接说话，像打电话一样
- 第一人称口语化

【正确示例】
用户：你好
回复：嗯，怎么了？

用户：看看我
回复：哇，今天气色不错呀`;

      const body: any = {
        messages: [
          ...callMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userText }
        ],
        characterName: character.name,
        characterId: characterId,
        userId: user?.id,
        persona: systemHint + (character.persona ? `\n\n【角色性格参考】${character.persona}` : ''),
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined,
        replyMode: 'online',
        onlineMessageCount: '1-2',
        historyLimit: 10
      };

      body.userApiKey = apiConfig.apiKey;
      body.provider = apiConfig.provider;
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        toast.error('通话出错');
        setCallLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();

      let assistantContent = '';

      if (!fullText.startsWith('data:') && !fullText.includes('\ndata:')) {
        try {
          const json = JSON.parse(fullText);
          assistantContent = json.choices?.[0]?.message?.content || json.content || '';
        } catch {
          if (fullText.trim() && !fullText.includes('<!DOCTYPE')) {
            assistantContent = fullText.trim();
          }
        }
      }

      if (!assistantContent) {
        const lines = fullText.split('\n');
        for (const rawLine of lines) {
          let line = rawLine.trim();
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const json = JSON.parse(jsonStr);
              const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
              if (delta) assistantContent += delta;
            } catch {}
          }
        }
      }

      assistantContent = assistantContent.replace(/\|{2,}/g, ' ').trim();

      if (assistantContent) {
        // 尝试生成语音并自动播放
        let audioBase64: string | undefined;
        
        // 调试日志
        console.log('TTS check - enabled:', ttsConfig?.enabled, 'apiKey:', !!ttsConfig?.apiKey, 'baseUrl:', !!ttsConfig?.baseUrl, 'voice_id:', character?.voice_id);
        
        // 恢复语音识别的辅助函数
        const resumeSpeechRecognition = () => {
          console.log('[Call] Resuming speech recognition, isSupported:', speechToText.isSupported, 'inCall:', inCall, 'isListening:', speechToText.isListening);
          setIsAISpeaking(false);
          if (speechToText.isSupported && inCall && !speechToText.isListening) {
            // 增加延迟到500ms，确保音频播放完全结束
            setTimeout(() => {
              console.log('[Call] Starting speech recognition after delay');
              speechToText.start();
            }, 500);
          }
        };
        
        if (ttsConfig?.enabled && ttsConfig.apiKey && ttsConfig.baseUrl && character?.voice_id) {
          // 暂停语音识别，避免识别到AI说话的声音
          if (speechToText.isListening) {
            speechToText.stop();
          }
          setIsAISpeaking(true);
          
          console.log('Generating TTS for:', assistantContent.slice(0, 50));
          
          // TTS请求带超时（8秒）
          const ttsController = new AbortController();
          const ttsTimeout = setTimeout(() => ttsController.abort(), 8000);
          
          try {
            const ttsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                text: assistantContent,
                voiceId: character.voice_id,
                ttsConfig: {
                  apiKey: ttsConfig.apiKey,
                  baseUrl: ttsConfig.baseUrl,
                  model: ttsConfig.model,
                },
              }),
              signal: ttsController.signal,
            });
            clearTimeout(ttsTimeout);
            
            const ttsData = await ttsResp.json();
            console.log('TTS response:', ttsResp.ok, 'hasAudio:', !!ttsData.audioContent, 'error:', ttsData.error);
            
            if (ttsData.audioContent) {
              audioBase64 = ttsData.audioContent;
              // 使用队列播放语音
              const audioUrl = `data:audio/mpeg;base64,${ttsData.audioContent}`;
              console.log('Playing TTS audio via queue...');
              
              audioQueue.enqueue({
                src: audioUrl,
                onEnd: () => {
                  console.log('TTS playback ended, resuming speech recognition');
                  resumeSpeechRecognition();
                },
                onError: () => {
                  console.error('TTS playback error');
                  resumeSpeechRecognition();
                },
              }).catch(() => resumeSpeechRecognition());
            } else {
              console.log('No audio content in TTS response');
              resumeSpeechRecognition();
            }
          } catch (err: any) {
            clearTimeout(ttsTimeout);
            if (err.name === 'AbortError') {
              console.log('TTS request timed out');
              toast.error('语音生成超时');
            } else {
              console.error('TTS generation error:', err);
            }
            resumeSpeechRecognition();
          }
        } else {
          console.log('TTS not configured or missing voice_id');
          // 没有TTS配置，直接恢复识别
          resumeSpeechRecognition();
        }
        setCallMessages(prev => [...prev, { role: 'assistant', content: assistantContent, audioBase64 }]);
      }
    } catch (err) {
      console.error('Call message error:', err);
      toast.error('发送失败');
    }

    setCallLoading(false);
  }, [callMessages, character, characterId, user?.id, profile, apiConfig, ttsConfig, showCallDialog, callLoading, speechToText, inCall, audioQueue]);

  // 更新自动发送函数引用
  useEffect(() => {
    autoSendCallMessageRef.current = autoSendCallMessage;
  }, [autoSendCallMessage]);

  // 通话消息滚动
  useEffect(() => {
    callMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [callMessages]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* 固定背景层 - 不随滚动移动 */}
      <div 
        className="absolute inset-0 -z-10"
        style={{ 
          backgroundImage: customization.chat_background_url 
            ? `url(${customization.chat_background_url})` 
            : 'linear-gradient(to bottom, hsl(var(--background)), hsl(var(--muted)))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

      {/* Fixed Header - 完全固定在顶部 */}
      <header className="h-12 flex-shrink-0 flex items-center px-3 border-b bg-background/95 backdrop-blur-md z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate('/friends')} className="flex-shrink-0 w-8 h-8">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 ml-2 flex-1">
          {character?.avatar_url && (
            <div className="relative">
              <Avatar className="w-7 h-7 border border-white/50 shadow-sm">
                <AvatarImage src={character.avatar_url} />
                <AvatarFallback>{character?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-background rounded-full" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm truncate">{character?.name || '加载中...'}</span>
            <span className="text-[10px] text-green-500">
              {loading ? '对方正在输入中……' : '在线'}
            </span>
          </div>
        </div>
        
        {/* 更多菜单 */}
        <Popover open={showMenu} onOpenChange={setShowMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="end">
            {/* 回复模式设置 */}
            <div className="px-3 py-2">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                回复模式
              </div>
              <div className="space-y-1">
                <button
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors ${replyMode === 'novel' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                  onClick={async () => {
                    setReplyMode('novel');
                    await supabase.from('characters').update({ reply_mode: 'novel' }).eq('id', characterId);
                    toast.success('已切换为小说模式');
                  }}
                >
                  <span>📖 小说模式</span>
                  {replyMode === 'novel' && <Check className="w-4 h-4" />}
                </button>
                <button
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors ${replyMode === 'online' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                  onClick={async () => {
                    setReplyMode('online');
                    await supabase.from('characters').update({ reply_mode: 'online' }).eq('id', characterId);
                    toast.success('已切换为线上模式');
                    setShowReplyModeMenu(true);
                  }}
                >
                  <span>💬 线上模式</span>
                  {replyMode === 'online' && <Check className="w-4 h-4" />}
                </button>
              </div>
              
              {/* 线上模式消息条数设置 */}
              {replyMode === 'online' && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">连续消息条数</div>
                  <div className="grid grid-cols-2 gap-1">
                    {['1-2', '3-5'].map((count) => (
                      <button
                        key={count}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${onlineMessageCount === count ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                        onClick={async () => {
                          setOnlineMessageCount(count);
                          await supabase.from('characters').update({ online_message_count: count }).eq('id', characterId);
                          toast.success(`已设置为${count}条`);
                        }}
                      >
                        {count}条
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* 表情包设置 */}
            <div className="px-3 py-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Sticker className="w-3 h-3" />
                表情包设置
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">角色发送表情包</span>
                <Switch 
                  checked={stickerEnabled}
                  onCheckedChange={async (checked) => {
                    setStickerEnabled(checked);
                    await supabase.from('characters').update({ sticker_enabled: checked }).eq('id', characterId);
                    toast.success(checked ? '已开启表情包' : '已关闭表情包');
                  }}
                />
              </div>
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-md transition-colors"
                onClick={() => setShowStickerUpload(true)}
              >
                <Upload className="w-3 h-3" />
                上传自定义表情包
              </button>
              {userStickers.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  已上传 {userStickers.length} 个表情包
                </div>
              )}
            </div>
            
            {/* 语音设置 */}
            <div className="px-3 py-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                角色语音设置
              </div>
              
              {/* 语音ID输入 */}
              <div className="mb-2">
                <label className="text-xs text-muted-foreground mb-1 block">语音ID (Voice ID)</label>
                <div className="flex gap-1">
                  <Input
                    value={character?.voice_id || ''}
                    onChange={(e) => setCharacter(prev => prev ? { ...prev, voice_id: e.target.value } : null)}
                    placeholder="输入TTS服务的Voice ID"
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={async () => {
                      if (!character?.voice_id?.trim()) {
                        toast.error('请输入语音ID');
                        return;
                      }
                      await supabase.from('characters').update({ voice_id: character.voice_id.trim() }).eq('id', characterId);
                      toast.success('语音ID已保存');
                    }}
                  >
                    保存
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  请在设置页配置TTS API后使用
                </p>
              </div>
              
              {/* 语音模式选择（仅在TTS配置好后显示） */}
              {ttsConfig?.enabled && character?.voice_id && (
                <>
                  <div className="text-xs text-muted-foreground mb-1">语音输出模式</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { value: 'off', label: '关闭' },
                      { value: 'sometimes', label: '偶尔' },
                      { value: 'always', label: '每句' },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${voiceMode === mode.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                        onClick={async () => {
                          setVoiceMode(mode.value as any);
                          await supabase.from('characters').update({ voice_mode: mode.value }).eq('id', characterId);
                          toast.success(`语音模式: ${mode.label}`);
                        }}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div className="h-px bg-border my-1" />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                  清空聊天记录
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清空？</AlertDialogTitle>
                  <AlertDialogDescription>
                    这将删除与该角色的所有聊天记录，此操作不可撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllMessages} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    确认清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PopoverContent>
        </Popover>
      </header>

      {/* Scrollable Messages Area - 只有这个区域可以滚动，背景透明 */}
      <main className="flex-1 overflow-y-auto overscroll-none touch-pan-y">
        <div className="p-3 space-y-3 pb-4">
          {messages.map((msg, index) => {
            // 计算是否需要显示时间分隔
            const currentTime = new Date(msg.created_at);
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const prevTime = prevMsg ? new Date(prevMsg.created_at) : null;
            const showTimeDivider = prevTime && (currentTime.getTime() - prevTime.getTime() > 60000); // 超过1分钟
            
            const formatTime = (date: Date) => {
              const now = new Date();
              const isToday = date.toDateString() === now.toDateString();
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              if (isToday) {
                return `${hours}:${minutes}`;
              }
              return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
            };
            
            // 处理转账消息
            if (msg.role === 'transfer') {
              const transfer = msg.transferData || pendingTransfers.find(t => msg.content.includes(t.id));
              if (transfer) {
                // 判断是用户转账（礼物）还是角色转账
                const isUserGift = (transfer as any).is_user_transfer === true;
                
                if (isUserGift) {
                  // 用户赠送礼物 - 显示在右侧，角色已收款
                  return (
                    <div key={msg.id} className="flex items-end gap-2 flex-row-reverse">
                      {/* 用户头像 */}
                      <div className="relative w-10 h-10 flex-shrink-0">
                        {userAvatarFrame && (
                          <img src={userAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                        )}
                        <div className={`absolute rounded-full overflow-hidden ${userAvatarFrame ? 'inset-[15%]' : 'inset-0'}`}>
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center text-[10px] text-gray-500">
                              {profile?.nickname?.charAt(0) || '我'}
                            </div>
                          )}
                        </div>
                      </div>
                      <UserTransferCard
                        amount={Math.abs(Number(transfer.amount))}
                        giftName={transfer.message?.replace('赠送了', '') || ''}
                        characterName={character?.name || '角色'}
                        message=""
                      />
                    </div>
                  );
                }
                
                // 角色转账 - 显示在左侧
                return (
                  <div key={msg.id} className="flex items-end gap-2 flex-row">
                    {/* 角色头像 */}
                    <div className="relative w-10 h-10 flex-shrink-0">
                      {friendAvatarFrame && (
                        <img src={friendAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                      )}
                      <div className={`absolute rounded-full overflow-hidden ${friendAvatarFrame ? 'inset-[15%]' : 'inset-0'}`}>
                        {character?.avatar_url ? (
                          <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-[10px] text-gray-500">
                            {character?.name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                    </div>
                    <TransferCard
                      amount={Number(transfer.amount)}
                      characterName={transfer.character_name || character?.name || '角色'}
                      message={transfer.message}
                      isReceived={transfer.is_received}
                      onReceive={() => handleReceiveTransfer(transfer.id)}
                      onDelete={() => handleDeleteTransfer(transfer.id)}
                    />
                  </div>
                );
              }
              return null;
            }
            
            return (
              <React.Fragment key={msg.id}>
                {showTimeDivider && (
                  <div className="flex justify-center py-2">
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {formatTime(currentTime)}
                    </span>
                  </div>
                )}
                <div 
                  className={`relative overflow-visible flex items-start gap-2 cursor-pointer select-none ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  onTouchStart={() => handleMessageTouchStart(msg)}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchMove={handleMessageTouchMove}
                  onClick={(e) => handleMessageClick(msg, e)}
                >
                  {/* Avatar with Frame - QQ风格顶部对齐 */}
                  <div className="relative w-9 h-9 flex-shrink-0 mt-0.5">
                    {msg.role === 'user' && userAvatarFrame && (
                      <img src={userAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                    )}
                    {msg.role !== 'user' && friendAvatarFrame && (
                      <img src={friendAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                    )}
                    <div className={`absolute rounded-full overflow-hidden ${(msg.role === 'user' ? userAvatarFrame : friendAvatarFrame) ? 'inset-[15%]' : 'inset-0'}`}>
                      {msg.role === 'user' ? (
                        profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center text-[10px] text-gray-600">
                            {profile?.nickname?.charAt(0) || '我'}
                          </div>
                        )
                      ) : (
                        character?.avatar_url ? (
                          <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-[10px] text-gray-500">
                            {character?.name?.charAt(0) || '?'}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  
              {/* Bubble with Sanrio Decoration */}
              <div className={`flex flex-col flex-1 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* 图片/表情包消息 - 独立容器，不透明，缩小尺寸 */}
                {msg.image_url && (
                  <div className="mb-1.5 rounded-lg overflow-hidden bg-background shadow-sm max-w-[140px]">
                    <img 
                      src={msg.image_url} 
                      alt="图片" 
                      loading="lazy"
                      decoding="async"
                      className="w-full rounded-lg object-cover cursor-pointer hover:brightness-95 transition-all"
                      style={{ maxHeight: '140px' }}
                      onClick={() => window.open(msg.image_url, '_blank')}
                    />
                  </div>
                )}
                
                {/* 文本气泡 - 横排（禁用竖排），气泡大小/透明度同步美化设置 */}
                {/* 如果是纯图片/表情包消息，不显示文字（包括 [STICKER:xxx] 和 [图片] xxx） */}
                {(() => {
                  // 检查是否有内联转账指令
                  const transferData = msg.role === 'assistant' ? parseTransferCommand(msg.content) : null;
                  const displayContent = transferData ? removeTransferCommand(msg.content) : msg.content;
                  const showBubble = displayContent && !displayContent.startsWith('[STICKER:') && !(msg.image_url && displayContent.startsWith('[图片]'));
                  
                  // 检测是否是通话记录消息
                  const callRecordMatch = displayContent?.match(/^\[((语音通话|视频通话))\]\s*通话时长\s*(\d{2}:\d{2})$/);
                  const isCallRecord = !!callRecordMatch;
                  const callType = callRecordMatch?.[1];
                  const callDurationStr = callRecordMatch?.[3];
                  
                  return (
                    <>
                      {/* 通话记录特殊样式 */}
                      {isCallRecord && (
                        <div 
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200/50 shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            {callType === '视频通话' ? (
                              <Video className="w-4 h-4 text-white" />
                            ) : (
                              <Phone className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-green-800">{callType}</span>
                            <span className="text-xs text-green-600">{callDurationStr}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* 语音消息气泡 - 如果有 audioBase64 则显示语音气泡 */}
                      {msg.audioBase64 && showBubble && !isCallRecord && (
                        <VoiceMessageBubble
                          audioBase64={msg.audioBase64}
                          transcript={displayContent}
                          isUser={msg.role === 'user'}
                          bubbleColor={msg.role === 'user' ? userBubbleColor : friendBubbleColor}
                          fontColor={msg.role === 'user' ? fontColor : friendFontColor}
                          bubbleStyle={{
                            ...getBubbleBackgroundStyle(msg.role === 'user'),
                            opacity: bubbleOpacity,
                          }}
                        />
                      )}
                      
                      {/* 普通文本气泡 - 没有语音时显示（排除通话记录） */}
                      {showBubble && !msg.audioBase64 && !isCallRecord && (
                        <div
                          className={getBubbleStyle(msg.role === 'user')}
                          style={{
                            // 气泡样式（背景/边框）+ 透明度：同时作用于文字与气泡背景
                            ...getBubbleBackgroundStyle(msg.role === 'user'),
                            opacity: bubbleOpacity,

                            color: msg.role === 'user' ? fontColor : friendFontColor,
                            fontSize: `${bubbleSize}px`,

                            // 强制横向排版：禁用任何竖排/列排模式
                            writingMode: 'horizontal-tb',
                            textOrientation: 'mixed',
                            direction: 'ltr',
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,

                            // 气泡自适应内容宽度，不设置强制最小宽度
                            width: 'fit-content',

                            // 气泡大小（内边距）随 bubble_size 同步
                            padding: getBubblePadding(bubbleSize),
                          }}
                        >
                          {/* 装饰图标 或 头像装饰图片 */}
                          {msg.role === 'user' && getUserBubbleDecorImage() && (
                            <img src={getUserBubbleDecorImage()} alt="" className="absolute -top-6 -right-6 w-12 h-12 object-contain z-20 pointer-events-none drop-shadow-md" />
                          )}
                          {msg.role === 'user' && !getUserBubbleDecorImage() && getUserBubbleDecor() && (
                            <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm z-20">{getUserBubbleDecor()}</span>
                          )}
                          {msg.role !== 'user' && getFriendBubbleDecorImage() && (
                            <img src={getFriendBubbleDecorImage()} alt="" className="absolute -top-6 -left-6 w-12 h-12 object-contain z-20 pointer-events-none drop-shadow-md" />
                          )}
                          {msg.role !== 'user' && !getFriendBubbleDecorImage() && getFriendBubbleDecor() && (
                            <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm z-20">{getFriendBubbleDecor()}</span>
                          )}

                          {/* 引用内容显示 - 类似QQ样式 */}
                          {msg.quotedMessage && (
                            <div 
                              className="mb-1.5 pb-1.5 border-b border-current/20 text-xs opacity-70"
                              style={{ fontSize: `${Math.max(bubbleSize - 2, 10)}px` }}
                            >
                              <span className="text-pink-500 font-medium">
                                回复 {msg.quotedMessage.role === 'user' ? (profile?.nickname || '我') : character?.name}：
                              </span>
                              <span className="ml-1">
                                {msg.quotedMessage.content?.slice(0, 30)}{(msg.quotedMessage.content?.length || 0) > 30 ? '...' : ''}
                              </span>
                            </div>
                          )}

                          <span className="relative z-10" style={{ display: 'inline' }}>
                            {/* 移除消息内容中的引用标记 */}
                            {displayContent.replace(/^\[引用: ".*?"\]\n?/s, '')}
                          </span>
                        </div>
                      )}
                      
                      {/* 内联转账卡片 - AI消息中检测到转账指令时显示 */}
                      {transferData && (
                        <div className="mt-2">
                          <TransferCard
                            amount={transferData.amount}
                            characterName={character?.name || '角色'}
                            message={transferData.message}
                            isReceived={false}
                            onReceive={() => {
                              toast.success(`收到 ${transferData.amount} 梦币！`);
                            }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
                
                {/* 已读状态 */}
                {msg.role === 'user' && (
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5">已读</span>
                )}
              </div>
              
              {/* 长按菜单 */}
              {longPressedMsg?.id === msg.id && (
                <div
                  className={`absolute top-full mt-1 bg-background border rounded-xl shadow-lg p-1.5 flex gap-1 z-50 ${msg.role === 'user' ? 'right-0' : 'left-0'}`}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-3 text-xs gap-1.5 rounded-lg"
                    onClick={() => quoteMessage(msg)}
                  >
                    <Quote className="w-4 h-4" />
                    引用
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-3 text-xs gap-1.5 rounded-lg"
                    onClick={() => copyMessage(msg)}
                  >
                    <Copy className="w-4 h-4" />
                    复制
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-lg text-destructive">
                        <RotateCcw className="w-4 h-4" />
                        回溯
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>回溯删除？</AlertDialogTitle>
                        <AlertDialogDescription>
                          这将删除该消息及之后的所有消息，以便重新开始对话。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setLongPressedMsg(null)}>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFromMessage(msg)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
              </React.Fragment>
            );
          })}
          
          {loading && (
            <div className="flex items-end gap-2">
              {/* AI头像 */}
              <div className="relative w-10 h-10 flex-shrink-0">
                {friendAvatarFrame && (
                  <img src={friendAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                )}
                <div className={`absolute rounded-full overflow-hidden ${friendAvatarFrame ? 'inset-[15%]' : 'inset-0'}`}>
                  {character?.avatar_url ? (
                    <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-[10px] text-gray-500">
                      {character?.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
              </div>
              {/* 输入中气泡 */}
              <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-muted/80 text-muted-foreground text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 待发送图片预览 */}
      {pendingImage && (
        <div className="px-3 py-2 bg-muted/80 border-t flex items-center gap-2">
          <div className="relative">
            <img 
              src={pendingImage.url} 
              alt="待发送" 
              className="w-16 h-16 object-cover rounded-lg"
            />
            <Button 
              variant="destructive"
              size="icon" 
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full"
              onClick={() => {
                URL.revokeObjectURL(pendingImage.url);
                setPendingImage(null);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground flex-1">
            {uploadingImage ? '上传中...' : '点击发送按钮发送图片'}
          </span>
        </div>
      )}

      {/* 引用消息提示 - 类似QQ样式 */}
      {quotedMessage && (
        <div className="px-3 py-2 bg-muted/60 border-t border-l-4 border-l-pink-400 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-pink-500 font-medium">
              回复 {quotedMessage.role === 'user' ? (profile?.nickname || '我') : character?.name}：
            </span>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {quotedMessage.content.slice(0, 50)}{quotedMessage.content.length > 50 ? '...' : ''}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-6 h-6 flex-shrink-0"
            onClick={() => setQuotedMessage(null)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Fixed Input Bar */}
      <footer className="h-14 flex-shrink-0 px-2 py-2 border-t bg-background/95 backdrop-blur-md flex items-center gap-2 z-20">
        {/* 隐藏的图片input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        
        {/* 加号按钮 - 展开工具菜单 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0 w-9 h-9 text-muted-foreground">
              <Plus className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-background border shadow-lg z-50" align="start" side="top">
            <div className="grid grid-cols-4 gap-3">
              {/* 图片 */}
              <button 
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading || uploadingImage}
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">图片</span>
              </button>
              
              {/* 表情包 */}
              <button 
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => {
                  setShowStickerPicker(true);
                }}
              >
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Sticker className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">表情包</span>
              </button>
              
              {/* 语音通话 */}
              <button 
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => startCall('voice')}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">语音</span>
              </button>
              
              {/* 视频通话 */}
              <button 
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => startCall('video')}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-purple-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">视频</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* 表情包快捷发送弹窗 - 单独控制 */}
        <Popover open={showStickerPicker} onOpenChange={setShowStickerPicker}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-background border shadow-lg z-50" align="start" side="top">
            <div className="text-xs font-medium text-muted-foreground mb-2 px-1">点击表情包直接发送</div>
            <div className="max-h-48 overflow-y-auto">
              {userStickers.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-muted-foreground mb-1 px-1">我的表情包</div>
                  <div className="grid grid-cols-4 gap-1">
                    {userStickers.map(sticker => (
                      <button
                        key={sticker.id}
                        onClick={() => sendStickerDirectly(sticker)}
                        className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                      >
                        <img src={sticker.imageUrl} alt={sticker.text} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 px-1">默认表情包</div>
                <div className="grid grid-cols-4 gap-1">
                  {defaultStickers.map(sticker => (
                    <button
                      key={sticker.id}
                      onClick={() => sendStickerDirectly(sticker)}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                    >
                      <img src={sticker.imageUrl} alt={sticker.text} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* 表情按钮 */}
        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0 w-8 h-8 text-muted-foreground">
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0 bg-background border shadow-lg z-50" align="start" side="top">
            {/* Category tabs */}
            <div className="flex items-center gap-0.5 p-1 border-b overflow-x-auto no-scrollbar">
              {Object.entries(EMOJI_CATEGORIES).filter(([key]) => key !== 'recent').map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => setActiveEmojiCategory(key as keyof typeof EMOJI_CATEGORIES)}
                  className={`w-8 h-8 flex items-center justify-center text-lg rounded-lg transition-colors flex-shrink-0 ${
                    activeEmojiCategory === key ? 'bg-primary/20' : 'hover:bg-muted'
                  }`}
                >
                  {category.icon}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="h-48 overflow-y-auto p-2">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_CATEGORIES[activeEmojiCategory]?.emojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    onClick={() => addEmoji(emoji)}
                    className="w-7 h-7 flex items-center justify-center text-lg hover:bg-muted rounded-md transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={pendingImage ? "添加说明..." : "输入消息..."} 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
          className="flex-1 h-9 rounded-full bg-muted border-0 text-sm" 
        />
        <Button 
          size="icon" 
          onClick={sendMessage} 
          disabled={loading || uploadingImage}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </footer>

      {/* 表情包管理弹窗 */}
      {showStickerUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowStickerUpload(false); cancelStickerSelect(); }}>
          <div className="bg-background rounded-xl p-4 w-[90%] max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">表情包管理</h3>
              <Button variant="ghost" size="icon" onClick={() => { setShowStickerUpload(false); cancelStickerSelect(); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* 上传新表情包 */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <label className="block text-sm font-medium mb-2">上传新表情包</label>
              
              {/* 图片预览或选择按钮 */}
              {pendingStickerFile ? (
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative">
                    <img 
                      src={pendingStickerFile.previewUrl} 
                      alt="预览" 
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full"
                      onClick={cancelStickerSelect}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Input
                      value={stickerKeywordInput}
                      onChange={(e) => setStickerKeywordInput(e.target.value)}
                      placeholder="输入关键词，用逗号分隔"
                      className="text-sm mb-2"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleStickerUpload}
                      disabled={uploadingSticker || !stickerKeywordInput.trim()}
                      className="w-full"
                    >
                      {uploadingSticker ? '上传中...' : '确认上传'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    ref={stickerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleStickerSelect}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full h-16 border-dashed"
                    onClick={() => stickerInputRef.current?.click()}
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">选择表情包图片</span>
                    </div>
                  </Button>
                </>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                输入关键词后，当角色回复包含这些词时会自动发送此表情包
              </p>
            </div>
            
            {/* 已上传的表情包列表 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                已上传的表情包 ({userStickers.length})
              </label>
              {userStickers.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {userStickers.map(sticker => (
                    <div key={sticker.id} className="relative group">
                      <img 
                        src={sticker.imageUrl} 
                        alt={sticker.text}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteSticker(sticker.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      <div className="text-[10px] text-center text-muted-foreground truncate mt-1" title={sticker.keywords.join(', ')}>
                        {sticker.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  还没有上传表情包
                </div>
              )}
            </div>
            
            {/* 默认表情包预览 */}
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium mb-2">
                默认表情包 ({defaultStickers.length})
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {defaultStickers.map(sticker => (
                  <div key={sticker.id} className="relative">
                    <img 
                      src={sticker.imageUrl} 
                      alt={sticker.text}
                      className="w-full aspect-square object-cover rounded-lg border opacity-80"
                    />
                    <div className="text-[9px] text-center text-muted-foreground truncate mt-0.5">
                      {sticker.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 通话弹窗（语音/视频） */}
      {showCallDialog && (
        <div 
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        >
          {/* 语音通话模糊头像背景 - 完全覆盖（不透出聊天页） */}
          {showCallDialog === 'voice' && (
            <div className="absolute inset-0 z-0 overflow-hidden">
              {/* 底色：即使头像是透明PNG也不会透出底下页面 */}
              <div className="absolute inset-0 bg-foreground" />

              {character?.avatar_url ? (
                <img
                  src={character.avatar_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    filter: 'blur(64px) brightness(0.7) saturate(1.3)',
                    transform: 'scale(1.5)',
                  }}
                  onError={(e) => {
                    // 图片加载失败也不要露出底页
                    e.currentTarget.style.display = 'none';
                    console.log('[call-bg] avatar load failed:', character?.avatar_url);
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-background via-muted to-muted" />
              )}

              {/* 罩层：压暗以更像系统来电界面 */}
              <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/40 to-foreground/80" />
            </div>
          )}
          {/* 视频通话背景 */}
          {showCallDialog === 'video' && (
            <div 
              className="absolute inset-0 z-0"
              style={{ background: '#FFB5C5' }}
            />
          )}
          {/* 隐藏的视频上传input */}
          <input
            ref={callVideoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleCallVideoUpload}
          />
          
          {/* 视频通话右上角上传按钮 */}
          {showCallDialog === 'video' && !callRinging && (
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => callVideoInputRef.current?.click()}
                className="text-white/90 text-sm font-medium hover:text-white transition-colors"
              >
                上传动态视频
              </button>
            </div>
          )}
          
          {/* 视频通话背景视频 */}
          {showCallDialog === 'video' && callVideoUrl && !callRinging && (
            <div className="absolute inset-0 overflow-hidden z-0">
              <video
                ref={callVideoRef}
                src={callVideoUrl}
                loop
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                onPlay={() => setCallVideoPlaying(true)}
                onPause={() => setCallVideoPlaying(false)}
              />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          )}
          
          {/* 主内容区域 */}
          <div className="flex-1 flex flex-col relative z-10 px-4 py-4">
            {/* 顶部：头像/名字区域 */}
            <div className="flex flex-col items-center mb-4">
              {/* 头像区域 - 语音通话参考图1样式 */}
              {showCallDialog === 'voice' && !inCall && (
                <div className="mb-4">
                  <div 
                    className="w-24 h-24 rounded-lg overflow-hidden shadow-lg"
                    style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
                  >
                    {character?.avatar_url ? (
                      <img 
                        src={character.avatar_url} 
                        alt={character.name} 
                        className="w-full h-full object-cover grayscale-[30%]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600 font-bold">
                        {character?.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 名字和时长 */}
              <h2 
                className="text-xl font-bold mb-1 text-white"
              >
                {character?.name}
              </h2>
              <p 
                className="text-sm text-white/80"
              >
                {callRinging 
                  ? (showCallDialog === 'video' ? '视频来电...' : '正在呼叫...') 
                  : formatCallDuration(callDuration)
                }
              </p>
              
              {/* 语音识别状态显示 - 更简洁 */}
              {inCall && speechToText.isListening && !isAISpeaking && !callLoading && (
                <div className="mt-2 px-3 py-1 bg-red-500/80 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs">正在听...</span>
                </div>
              )}
              {inCall && isAISpeaking && (
                <div className="mt-2 px-3 py-1 bg-green-500/80 rounded-full flex items-center gap-2">
                  <Volume2 className="w-3 h-3 text-white animate-pulse" />
                  <span className="text-white text-xs">说话中...</span>
                </div>
              )}
            </div>
            
              {/* 通话消息区域 - 只显示纯文字，不用气泡 */}
            {inCall && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
                {/* 只显示最后一条用户消息 */}
                {callMessages.length > 0 && callMessages.filter(m => m.role === 'user').slice(-1).map((msg, idx) => (
                  <p 
                    key={`user-${idx}`}
                    className="text-center text-sm text-white/70"
                  >
                    {msg.content}
                  </p>
                ))}
                {/* 只显示最后一条AI消息 */}
                {callMessages.length > 0 && callMessages.filter(m => m.role === 'assistant').slice(-1).map((msg, idx) => (
                  <p 
                    key={`ai-${idx}`}
                    className="text-center text-lg font-medium text-white"
                  >
                    {msg.content}
                  </p>
                ))}
                {callLoading && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce opacity-60" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce opacity-60" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce opacity-60" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            )}
            
            {/* 语音状态显示区域 - 微信风格纯语音通话 */}
            {inCall && (
              <div className="flex flex-col items-center gap-3 px-4 py-3">
                {/* AI正在说话状态 - 带波形动画 */}
                {isAISpeaking && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="px-4 py-2 bg-green-500/80 rounded-full flex items-center gap-3">
                      <VoiceWaveform isActive={true} color="#ffffff" bars={5} />
                      <span className="text-white text-sm">{character?.name}正在说话</span>
                    </div>
                  </div>
                )}
                
                {/* 正在识别临时文字 - 带波形动画 */}
                {interimTranscript && !isAISpeaking && (
                  <div className="flex flex-col items-center gap-2">
                    <VoiceWaveform isActive={true} color="#ef4444" bars={5} />
                    <div className="px-4 py-2 bg-white/90 rounded-2xl shadow-sm max-w-[80%]">
                      <span className="text-gray-600 text-sm">{interimTranscript}</span>
                      <span className="inline-block w-1 h-4 bg-gray-400 ml-1 animate-pulse" />
                    </div>
                  </div>
                )}
                
                {/* 等待用户说话 - 带波形动画 */}
                {!isAISpeaking && !interimTranscript && !callLoading && speechToText.isListening && (
                  <div className="flex flex-col items-center gap-2">
                    <VoiceWaveform isActive={true} color="#ef4444" bars={7} />
                    <span className="text-sm text-white/80">
                      正在听你说话...
                    </span>
                  </div>
                )}
                
                {/* AI回复加载中 */}
                {callLoading && !isAISpeaking && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="text-gray-600 text-sm">思考中...</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 视频通话装饰线 - 参考图2 */}
            {showCallDialog === 'video' && !callRinging && !inCall && (
              <div className="mt-8 w-64 flex items-center justify-center mx-auto">
                <div className="flex-1 h-px bg-white/30" />
                <div className="mx-4 flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className={`rounded-full bg-white/60 ${i === 2 ? 'w-2 h-2' : 'w-1 h-1'}`}
                    />
                  ))}
                </div>
                <div className="flex-1 h-px bg-white/30" />
              </div>
            )}
          </div>
          
          {/* 底部控制栏 */}
          <div className="relative z-10 pb-12 px-6">
            {callRinging ? (
              /* 来电接听/挂断按钮 */
              <div className="flex items-center justify-center gap-16">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
                  onClick={endCall}
                >
                  <Phone className="w-7 h-7 rotate-[135deg]" />
                </Button>
                <Button
                  size="lg"
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
                  onClick={answerCall}
                >
                  <Phone className="w-7 h-7" />
                </Button>
              </div>
            ) : (
              /* 通话中控制栏 - 参考图1底部样式 */
              <div className="flex items-center justify-center gap-8">
                {/* 挂断按钮 */}
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
                  onClick={endCall}
                >
                  <Phone className="w-6 h-6 rotate-[135deg]" />
                </Button>
                
                {/* 麦克风按钮 - 语音输入切换 */}
                {speechToText.isSupported && (
                  <Button
                    variant="ghost"
                    size="lg"
                    className={`w-14 h-14 rounded-full shadow-lg transition-all ${
                      speechToText.isListening 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={speechToText.toggle}
                  >
                    {speechToText.isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                )}
                
                {/* 扬声器按钮 */}
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 text-gray-700 shadow-lg"
                >
                  <Volume2 className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ChatPage;
