import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Smile, Trash2, RotateCcw, Quote, MoreVertical, X, Gift, MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import TransferCard from '@/components/chat/TransferCard';

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
    apiKey?: string;
    model?: string;
    autoGenerate?: boolean;
    style?: string;
    customStylePrompt?: string;
    triggerKeywords?: string;
  } | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user && characterId) {
      fetchCharacter();
      fetchMessagesWithTransfers();
      fetchCustomization();
      fetchProfile();
      fetchApiConfig();
    }
  }, [user, characterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchCharacter = async () => {
    const { data } = await supabase.from('characters').select('*').eq('id', characterId).single();
    if (data) {
      setCharacter(data);
      // 使用角色级别的设置
      if (data.reply_mode) {
        setReplyMode(data.reply_mode as 'novel' | 'online');
      }
      if (data.online_message_count) {
        setOnlineMessageCount(data.online_message_count);
      }
      // 角色级别的历史消息数量和转账开关
      setHistoryLimit(data.history_limit ?? 10);
      setTransferEnabled(data.transfer_enabled ?? true);
    }
  };

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user?.id).single();
    if (data) setProfile(data);
  };

  const fetchMessagesWithTransfers = async () => {
    // 获取聊天消息
    const { data: chatData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at');
    
    // 获取该角色的转账记录
    const { data: transferData } = await supabase
      .from('dream_transactions')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', user?.id)
      .order('created_at');
    
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
          setNovelaiConfig({
            apiKey: novelaiKey.api_key,
            model: novelaiModel?.api_key || 'nai-diffusion-3',
            autoGenerate: novelaiAutoGenerate?.api_key === 'true',
            style: novelaiStyle?.api_key || 'selfie',
            customStylePrompt: novelaiCustomStylePrompt?.api_key || '',
            triggerKeywords: novelaiTriggerKeywords?.api_key || '画图,画一张,画一幅,画个,生成图,来一张图,发张图,发图,发个图,照片,自拍,看看你,你的样子',
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
    const baseClasses = 'max-w-[75%] min-w-[60px] px-4 py-2.5 shadow-sm whitespace-pre-wrap break-words';
    
    switch (style) {
      case 'cloud':
        return `${baseClasses} rounded-3xl ${isUser ? 'rounded-br-lg' : 'rounded-bl-lg'}`;
      case 'square':
        return `${baseClasses} rounded-lg ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      default:
        return `${baseClasses} rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
    }
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

  // 长按开始
  const handleTouchStart = (msg: any) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressedMsg(msg);
    }, 500);
  };

  // 长按结束
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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

  // NovelAI 画图相关
  const shouldGenerateImage = (
    userInput: string,
    aiResponse: string,
  ): { should: boolean; prompt: string } => {
    const input = (userInput || '').trim().toLowerCase();
    const reply = (aiResponse || '').trim();

    // 1) 使用可配置的触发关键词
    const configKeywords = novelaiConfig?.triggerKeywords || '画图,画一张,画一幅,画个,生成图,来一张图,发张图,发图,发个图,照片,自拍,看看你,你的样子';
    const keywordList = configKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);

    const userRequestsImage =
      keywordList.some((kw) => input.includes(kw)) ||
      /(画|发|来|给).*?(图|图片|照片|自拍)/.test(userInput) ||
      /^\s*(\/draw|\/pic|\/image)\b/i.test(userInput);

    // 2) 自动触发：只要 AI 回复里出现 *动作* / *场景* 描述就认为"有画面"
    const hasActionEmotes = /\*[^*]{2,}\*/.test(reply);
    const aiDescribesScene =
      hasActionEmotes ||
      ['现在我穿着', '我正在', '此刻我', '我的样子', '我给你看', '发你一张', '给你发'].some((kw) =>
        reply.includes(kw),
      );

    if (!(userRequestsImage || (novelaiConfig?.autoGenerate && aiDescribesScene))) {
      return { should: false, prompt: '' };
    }

    // 构建画图提示词
    let prompt = '';

    // 从角色人设提取外观特征
    if (character?.persona) {
      const appearanceMatch = character.persona.match(
        /(?:外貌|外观|样貌|长相|形象|特征)[：:]\s*([^，。\n]+)/,
      );
      if (appearanceMatch) {
        prompt += appearanceMatch[1] + ', ';
      }
    }

    // 添加风格模板提示词
    const stylePrompts: Record<string, string> = {
      selfie: 'selfie, close-up, looking at viewer, front view',
      portrait: 'upper body, portrait, looking at viewer',
      fullbody: 'full body, standing, from front',
      scene: 'scenic, background, detailed environment',
      custom: novelaiConfig?.customStylePrompt || '',
    };
    const stylePrompt = stylePrompts[novelaiConfig?.style || 'selfie'] || stylePrompts.selfie;
    if (stylePrompt) {
      prompt += stylePrompt + ', ';
    }

    // 用户显式要图时，把用户的描述也带上（更稳）
    if (userRequestsImage && userInput) {
      const cleaned = userInput
        .replace(/^\s*(\/draw|\/pic|\/image)\b/i, '')
        .replace(/(画|发|来|给).{0,6}(图|图片|照片|自拍)/g, '')
        .trim();
      if (cleaned) prompt += cleaned + ', ';
    }

    // 从AI回复中提取 *场景描述*
    const sceneParts = reply.match(/\*([^*]+)\*/g);
    if (sceneParts) {
      prompt += sceneParts.map((s) => s.replace(/\*/g, '')).join(', ') + ', ';
    }

    // 基础提示词
    prompt += `${character?.name || 'anime girl'}, beautiful, high quality, detailed`;

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
        toast.error('画图失败: ' + error.message);
        return;
      }
      
      if (data?.success && data?.imageUrl) {
        // 添加图片消息
        const imageMsg = {
          id: Date.now() + 1000,
          role: 'assistant',
          content: `*给你发了一张图片~*`,
          image_url: data.imageUrl,
        };
        
        setMessages(prev => [...prev, imageMsg]);
        
        // 保存到数据库
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: imageMsg.content,
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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
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
    
    const userMessage = { role: 'user', content: messageContent };
    const originalInput = input; // 保存原始输入用于转账检测
    setMessages(prev => [...prev, { ...userMessage, id: Date.now(), quotedMessage }]);
    setInput('');
    setQuotedMessage(null);
    setLoading(true);

    await supabase.from('chat_messages').insert({ 
      user_id: user?.id, 
      character_id: characterId, 
      role: 'user', 
      content: messageContent 
    });

    try {
      const recentMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-historyLimit)
        .map(m => ({ role: m.role, content: m.content }));
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
        historyLimit: historyLimit
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
      
      // 检查是否是线上模式的多条消息（用 ||| 分隔）
      let multiMessages = assistantContent.split('|||').map(s => s.trim()).filter(s => s.length > 0);

      // 线上模式：严格固定条数，不足时自动补语气词
      if (replyMode === 'online') {
        const fixedCount = onlineMessageCount === '1-2' ? 2 : 5;
        
        // 限制最多条数
        if (multiMessages.length > fixedCount) {
          multiMessages = multiMessages.slice(0, fixedCount);
        }
        
        // 不足时自动补语气词（不拆分原有消息）
        const fillerWords = ['嗯', '哦', '呢', '呀', '嘻嘻', '😊', '❤️', '💕', '你呢', '是吧', '对吧', '哈哈', '嘿嘿', '~'];
        let fillerIndex = 0;
        while (multiMessages.length < fixedCount) {
          multiMessages.push(fillerWords[fillerIndex % fillerWords.length]);
          fillerIndex++;
        }
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

        // 线上模式也要触发画图（之前这里提前 return，导致“只成功一次/后面不发”）
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
        
        // 等待所有消息显示完成
        setTimeout(() => {
          setLoading(false);
        }, delay + 300);
        
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
  
  // 气泡框预设 - 带三丽鸥装饰
  const bubbleFramePresets: Record<string, { gradient: string; borderColor: string; decorIcon: string }> = {
    'cute-pink': { gradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFB5C5 100%)', borderColor: '#FFB5C5', decorIcon: '🎀' },
    'cute-blue': { gradient: 'linear-gradient(135deg, #E4F4FF 0%, #B5D8FF 100%)', borderColor: '#B5D8FF', decorIcon: '☁️' },
    'cute-yellow': { gradient: 'linear-gradient(135deg, #FFF9E4 0%, #FFFAB5 100%)', borderColor: '#FFE066', decorIcon: '⭐' },
    'cute-green': { gradient: 'linear-gradient(135deg, #E4FFF4 0%, #B5FFD8 100%)', borderColor: '#B5FFD8', decorIcon: '🍀' },
    'cute-purple': { gradient: 'linear-gradient(135deg, #F4E4FF 0%, #E5B5FF 100%)', borderColor: '#E5B5FF', decorIcon: '💜' },
  };
  
  const userBubbleFrame = (customization as any).bubble_frame_url || '';
  const friendBubbleFrame = (customization as any).friend_bubble_frame_url || '';
  
  const getUserBubbleStyle = () => {
    const frame = bubbleFramePresets[userBubbleFrame];
    if (frame) {
      return { background: frame.gradient, border: `2px solid ${frame.borderColor}` };
    }
    return { backgroundColor: userBubbleColor };
  };
  
  const getFriendBubbleStyle = () => {
    const frame = bubbleFramePresets[friendBubbleFrame];
    if (frame) {
      return { background: frame.gradient, border: `2px solid ${frame.borderColor}` };
    }
    return { backgroundColor: friendBubbleColor };
  };
  
  const getUserBubbleDecor = () => bubbleFramePresets[userBubbleFrame]?.decorIcon;
  const getFriendBubbleDecor = () => bubbleFramePresets[friendBubbleFrame]?.decorIcon;

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
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  onTouchStart={() => handleTouchStart(msg)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(msg)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Avatar with Frame - 在消息底部对齐 */}
              <div className="relative w-10 h-10 flex-shrink-0">
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
              <div 
                className={`${getBubbleStyle(msg.role === 'user')} relative`}
                style={{ 
                  ...(msg.role === 'user' ? getUserBubbleStyle() : getFriendBubbleStyle()),
                  opacity: bubbleOpacity,
                  color: msg.role === 'user' ? fontColor : friendFontColor,
                  fontSize: `${bubbleSize}px`,
                  lineHeight: '1.5'
                }}
              >
                {/* 三丽鸥装饰图标 */}
                {msg.role === 'user' && getUserBubbleDecor() && (
                  <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm">{getUserBubbleDecor()}</span>
                )}
                {msg.role !== 'user' && getFriendBubbleDecor() && (
                  <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm">{getFriendBubbleDecor()}</span>
                )}
                
                {/* 图片消息 */}
                {msg.image_url && (
                  <div className="mb-2 rounded-lg border border-border bg-card p-1">
                    <img 
                      src={msg.image_url} 
                      alt="AI生成的正方形图片" 
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover cursor-pointer hover:opacity-90"
                      style={{ maxHeight: '300px' }}
                      onClick={() => window.open(msg.image_url, '_blank')}
                    />
                  </div>
                )}
                
                {msg.content}
                
                {/* 已读状态 - 仅用户消息显示 */}
                {msg.role === 'user' && (
                  <span className="absolute -bottom-4 right-0 text-[10px] text-muted-foreground">
                    已读
                  </span>
                )}
                
                {/* 长按菜单 */}
                {longPressedMsg?.id === msg.id && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-background border rounded-lg shadow-lg p-1 flex gap-1 z-30">
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

      {/* Fixed Input Bar - 完全固定在底部 */}
      <footer className="h-14 flex-shrink-0 px-2 py-2 border-t bg-background/95 backdrop-blur-md flex items-center gap-2 z-20">
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
          placeholder="输入消息..." 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
          className="flex-1 h-9 rounded-full bg-muted border-0 text-sm" 
        />
        <Button 
          size="icon" 
          onClick={sendMessage} 
          disabled={loading}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </footer>
    </div>
  );
};

export default ChatPage;
