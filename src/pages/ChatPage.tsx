import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Smile, Trash2, RotateCcw, Quote, MoreVertical, X, Gift, MessageSquare, Check, ImagePlus, Sticker, Upload } from 'lucide-react';
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
import { defaultStickers, matchSticker, parseStickerRequest, shouldSendSticker, Sticker as StickerType } from '@/data/stickers';
// 头像装饰图片
import animeHeadDecor from '@/assets/bubble-frames/anime-head-decor.png';

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
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  

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
        .select('id, role, content, created_at, image_url')
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
    
    if (chatData) {
      chatData.forEach(msg => {
        allItems.push({
          ...msg,
          timestamp: new Date(msg.created_at).getTime()
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

  // 点击消息显示菜单
  const handleMessageClick = (msg: any, e: React.MouseEvent | React.TouchEvent) => {
    // 避免误触
    e.stopPropagation();
    if (msg.role === 'transfer') return;
    setLongPressedMsg(longPressedMsg?.id === msg.id ? null : msg);
  };

  // 转账相关函数 - 解析 AI 返回的转账指令
  const parseTransferCommand = (content: string): { amount: number; message: string } | null => {
    // 匹配格式: [转账:金额:留言] 或 [TRANSFER:金额:留言]
    const transferMatch = content.match(/\[(?:转账|TRANSFER):(\d+(?:\.\d{1,2})?):([^\]]*)\]/i);
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
    return content.replace(/\[(?:转账|TRANSFER):\d+(?:\.\d{1,2})?:[^\]]*\]/gi, '').trim();
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
      
      // 调用AI（带图片识别）
      const recentMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
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
        content: messageContent 
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
      // 保留历史消息中的图片URL
      const recentMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-historyLimit)
        .map(m => ({ role: m.role, content: m.content, image_url: m.image_url }));
      
      // 检查最近消息中是否有图片（用于上下文）
      const hasImageInHistory = recentMessages.some(m => m.image_url);
      
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
              setMessages(prev => [...prev, { id: msgId, role: 'assistant', content: msgContent }]);
              
              // 保存到数据库
              await supabase.from('chat_messages').insert({ 
                user_id: user?.id, 
                character_id: characterId, 
                role: 'assistant', 
                content: msgContent 
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
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: cleanContent }]);

        await supabase.from('chat_messages').insert({ 
          user_id: user?.id, 
          character_id: characterId, 
          role: 'assistant', 
          content: cleanContent 
        });
        
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
  const bubbleFramePresets: Record<string, { type: 'css' | 'image'; gradient?: string; borderColor?: string; decorIcon: string; imageUrl?: string; decorImage?: string }> = {
    'cute-pink': { type: 'css', gradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFB5C5 100%)', borderColor: '#FFB5C5', decorIcon: '🎀' },
    'cute-blue': { type: 'css', gradient: 'linear-gradient(135deg, #E4F4FF 0%, #B5D8FF 100%)', borderColor: '#B5D8FF', decorIcon: '☁️' },
    'cute-yellow': { type: 'css', gradient: 'linear-gradient(135deg, #FFF9E4 0%, #FFFAB5 100%)', borderColor: '#FFE066', decorIcon: '⭐' },
    'cute-green': { type: 'css', gradient: 'linear-gradient(135deg, #E4FFF4 0%, #B5FFD8 100%)', borderColor: '#B5FFD8', decorIcon: '🍀' },
    'cute-purple': { type: 'css', gradient: 'linear-gradient(135deg, #F4E4FF 0%, #E5B5FF 100%)', borderColor: '#E5B5FF', decorIcon: '💜' },
    // 带卡通头像装饰的黑红渐变气泡框
    'anime-head': { type: 'css', gradient: 'linear-gradient(180deg, #1a1a1a 0%, #2a0000 50%, #8b0000 100%)', borderColor: '#8b0000', decorIcon: '', decorImage: animeHeadDecor },
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
      return { background: frame.gradient };
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
                  className={`relative overflow-visible flex items-start gap-2 cursor-pointer ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
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
                {msg.content && !msg.content.startsWith('[STICKER:') && !(msg.image_url && msg.content.startsWith('[图片]')) && (
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
                      <img src={getUserBubbleDecorImage()} alt="" className="absolute -top-2 -right-3 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
                    )}
                    {msg.role === 'user' && !getUserBubbleDecorImage() && getUserBubbleDecor() && (
                      <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm z-20">{getUserBubbleDecor()}</span>
                    )}
                    {msg.role !== 'user' && getFriendBubbleDecorImage() && (
                      <img src={getFriendBubbleDecorImage()} alt="" className="absolute -top-2 -left-3 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
                    )}
                    {msg.role !== 'user' && !getFriendBubbleDecorImage() && getFriendBubbleDecor() && (
                      <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm z-20">{getFriendBubbleDecor()}</span>
                    )}

                    <span className="relative z-10" style={{ display: 'inline' }}>{msg.content}</span>
                  </div>
                )}
                
                {/* 已读状态 */}
                {msg.role === 'user' && (
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5">已读</span>
                )}
              </div>
              
              {/* 点击菜单 */}
              {longPressedMsg?.id === msg.id && (
                <div
                  className={`absolute top-full mt-1 bg-background border rounded-lg shadow-lg p-1 flex gap-1 z-50 ${msg.role === 'user' ? 'right-0' : 'left-0'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-xs gap-1"
                    onClick={() => quoteMessage(msg)}
                  >
                    <Quote className="w-3 h-3" />
                    引用
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 text-destructive">
                        <RotateCcw className="w-3 h-3" />
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setLongPressedMsg(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
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

      {/* 引用消息提示 */}
      {quotedMessage && (
        <div className="px-3 py-2 bg-muted/80 border-t flex items-center gap-2">
          <Quote className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">
            引用: {quotedMessage.content.slice(0, 40)}{quotedMessage.content.length > 40 ? '...' : ''}
          </span>
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
        
        {/* 图片按钮 */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="flex-shrink-0 w-8 h-8 text-muted-foreground"
          onClick={() => imageInputRef.current?.click()}
          disabled={loading || uploadingImage}
        >
          <ImagePlus className="w-4 h-4" />
        </Button>
        
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
    </div>
  );
};

export default ChatPage;
