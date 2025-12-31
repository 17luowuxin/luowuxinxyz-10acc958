import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Settings, User, AtSign, Smile, Trash2, RotateCcw, MoreVertical, Upload, Image, Quote, Flame, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
// 头像装饰图片
import animeHeadDecor from '@/assets/bubble-frames/anime-head-decor.png';

// Emoji categories
const EMOJI_CATEGORIES = {
  smileys: { 
    icon: '😊', 
    name: '表情', 
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
      '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎'
    ]
  },
  love: { 
    icon: '❤️', 
    name: '爱心', 
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '😍', '🥰', '😘', '😻'
    ]
  },
  gestures: { 
    icon: '👋', 
    name: '手势', 
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏'
    ]
  },
  nature: { 
    icon: '🌸', 
    name: '自然', 
    emojis: [
      '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲',
      '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌙', '⭐',
      '🌟', '✨', '💫', '🌈', '☀️', '🔥'
    ]
  },
  activities: { 
    icon: '🎉', 
    name: '活动', 
    emojis: [
      '🎃', '🎄', '🎆', '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎',
      '🎏', '🎐', '🎑', '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅'
    ]
  }
};

interface Message {
  id: string;
  sender_type: 'user' | 'character';
  character_id?: string;
  content: string;
  created_at: string;
  characterName?: string;
  characterAvatar?: string;
}

const GroupChatPage: React.FC = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customization, setCustomization] = useState<any>({});
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [apiConfigLoading, setApiConfigLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');
  const [longPressedMsg, setLongPressedMsg] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const bgInputRef = useRef<HTMLInputElement>(null);
  
  // 热闹模式和角色互动设置
  const [livelyMode, setLivelyMode] = useState(false);
  const [interactionSettings, setInteractionSettings] = useState({
    maxRounds: 3,
    firstTriggerChance: 50, // 百分比
    continueChanceBase: 40, // 百分比
    continueChanceDecay: 10 // 每轮递减百分比
  });
  const [showInteractionSettings, setShowInteractionSettings] = useState(false);

  useEffect(() => {
    if (user && groupId) {
      fetchGroup();
      fetchMessages();
      fetchCustomization();
      fetchApiConfig();
      fetchUserProfile();
    }
  }, [user, groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroup = async () => {
    try {
      const { data, error } = await supabase
        .from('group_chats')
        .select('*, group_members(character_id, characters(id, name, avatar_url, persona))')
        .eq('id', groupId)
        .maybeSingle();
      
      if (error) {
        console.error('获取群聊失败:', error);
        toast.error('加载群聊失败');
        return;
      }
      
      if (data) {
        setGroup(data);
        const chars = data.group_members?.map((m: any) => m.characters).filter(Boolean) || [];
        setMembers(chars);
      } else {
        toast.error('群聊不存在');
        navigate('/group');
      }
    } catch (err) {
      console.error('获取群聊异常:', err);
      toast.error('加载群聊失败');
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, characters(name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at');
    
    if (data) {
      setMessages(data.map((msg: any) => ({
        ...msg,
        characterName: msg.characters?.name,
        characterAvatar: msg.characters?.avatar_url
      })));
    }
  };

  const fetchCustomization = async () => {
    const { data } = await supabase
      .from('customization')
      .select('*')
      .eq('user_id', user?.id)
      .single();
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

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, persona, avatar_url')
      .eq('user_id', user?.id)
      .single();
    if (data) setUserProfile(data);
  };

  // 处理输入变化，检测@符号
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setInput(value);
    setCursorPosition(position);

    const textBeforeCursor = value.slice(0, position);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const filterText = textBeforeCursor.slice(atIndex + 1);
      if (!filterText.includes(' ')) {
        setMentionFilter(filterText.toLowerCase());
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
  };

  const selectMention = (member: any) => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = input.slice(cursorPosition);
    
    const newInput = textBeforeCursor.slice(0, atIndex) + `@${member.name} ` + textAfterCursor;
    setInput(newInput);
    setShowMentionList(false);
    inputRef.current?.focus();
  };

  const parseMentions = (text: string): string[] => {
    const mentionedIds: string[] = [];
    members.forEach(member => {
      if (text.includes(`@${member.name}`)) {
        mentionedIds.push(member.id);
      }
    });
    return mentionedIds;
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(mentionFilter)
  );

  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmoji(false);
  };

  // 清空全部聊天记录
  const clearAllMessages = async () => {
    try {
      await supabase.from('group_messages').delete().eq('group_id', groupId);
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
      
      await supabase.from('group_messages').delete().in('id', idsToDelete);
      setMessages(prev => prev.slice(0, msgIndex));
      setLongPressedMsg(null);
      toast.success('已删除该消息及之后的记录');
    } catch (err) {
      toast.error('删除失败');
    }
  };

  // 点击消息显示菜单
  const handleMessageClick = (msg: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setLongPressedMsg(longPressedMsg?.id === msg.id ? null : msg);
  };

  // 上传群聊背景
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    const fileName = `${user.id}/group-bg-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file);
    
    if (uploadError) {
      toast.error('上传失败');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    
    await supabase.from('customization').upsert({
      user_id: user.id,
      group_chat_background_url: publicUrl
    } as any, { onConflict: 'user_id' });
    
    setCustomization((prev: any) => ({ ...prev, group_chat_background_url: publicUrl }));
    toast.success('群聊背景已更新');
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || members.length === 0) return;
    
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
    
    const userMessage = input;
    const mentionedCharacterIds = parseMentions(userMessage);
    setInput('');
    setShowMentionList(false);
    setLoading(true);

    const { data: insertedMsg } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_type: 'user',
        content: userMessage
      })
      .select()
      .single();

    if (insertedMsg) {
      setMessages(prev => [...prev, { ...insertedMsg, sender_type: 'user' as const }]);
    }

    try {
      const body: any = {
        messages: messages.map(m => ({
          role: m.sender_type === 'user' ? 'user' : 'assistant',
          content: m.sender_type === 'user' ? m.content : `${m.characterName}: ${m.content}`
        })),
        characters: members,
        userMessage,
        userProfile,
        mentionedCharacterIds
      };

      body.userId = user?.id;
      // 始终传递API配置
      body.userApiKey = apiConfig.apiKey;
      body.provider = apiConfig.provider;
      if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
      if (apiConfig.model) body.model = apiConfig.model;
      
      console.log('Sending group-chat with API config:', { 
        hasApiKey: !!body.userApiKey, 
        provider: body.provider, 
        hasBaseUrl: !!body.baseUrl, 
        model: body.model 
      });

      const { data, error } = await supabase.functions.invoke('group-chat', { body });

      if (error) throw error;

      // 保存最新消息列表用于角色回角色
      let currentMessages = [...messages, { sender_type: 'user', content: userMessage }];
      let lastCharacterResponse: { characterId: string; characterName: string; content: string } | null = null;

      for (const response of data.responses || []) {
        const { data: charMsg } = await supabase
          .from('group_messages')
          .insert({
            group_id: groupId,
            sender_type: 'character',
            character_id: response.characterId,
            content: response.content
          })
          .select('*, characters(name, avatar_url)')
          .single();

        if (charMsg) {
          setMessages(prev => [...prev, {
            ...charMsg,
            sender_type: 'character' as const,
            characterName: charMsg.characters?.name,
            characterAvatar: charMsg.characters?.avatar_url
          }]);
          currentMessages.push({
            sender_type: 'character',
            content: response.content,
            characterName: response.characterName
          });
          lastCharacterResponse = response;
        }

        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // 角色回角色功能：连续多轮互动（根据设置调整）
      if (lastCharacterResponse && members.length > 1) {
        // 获取实际设置（热闹模式下提高概率和轮数）
        const effectiveSettings = livelyMode ? {
          maxRounds: Math.min(interactionSettings.maxRounds + 2, 8),
          firstTriggerChance: Math.min(interactionSettings.firstTriggerChance + 30, 95),
          continueChanceBase: Math.min(interactionSettings.continueChanceBase + 20, 80),
          continueChanceDecay: Math.max(interactionSettings.continueChanceDecay - 5, 5)
        } : { ...interactionSettings };
        
        console.log('Interaction settings:', effectiveSettings, 'Lively mode:', livelyMode);
        
        let currentRound = 0;
        const firstRoll = Math.random() * 100;
        let continueInteraction = firstRoll < effectiveSettings.firstTriggerChance;
        let currentTrigger = lastCharacterResponse;
        
        console.log(`First trigger roll: ${firstRoll.toFixed(1)} < ${effectiveSettings.firstTriggerChance}? ${continueInteraction}`);

        while (continueInteraction && currentRound < effectiveSettings.maxRounds) {
          currentRound++;
          console.log(`Character-to-character round ${currentRound}/${effectiveSettings.maxRounds}...`);
          await new Promise(resolve => setTimeout(resolve, livelyMode ? 800 : 1200));
          
          const c2cBody: any = {
            messages: currentMessages.map((m: any) => ({
              role: m.sender_type === 'user' ? 'user' : 'assistant',
              content: m.sender_type === 'user' ? m.content : `${m.characterName}: ${m.content}`
            })),
            characters: members,
            userMessage: currentTrigger.content,
            userProfile,
            isCharacterToCharacter: true,
            triggerCharacterId: currentTrigger.characterId,
            userId: user?.id,
            userApiKey: apiConfig.apiKey,
            provider: apiConfig.provider,
          };
          if (apiConfig.baseUrl) c2cBody.baseUrl = apiConfig.baseUrl;
          if (apiConfig.model) c2cBody.model = apiConfig.model;

          try {
            const { data: c2cData, error: c2cError } = await supabase.functions.invoke('group-chat', { body: c2cBody });
            
            if (!c2cError && c2cData?.responses?.length > 0) {
              const c2cResponse = c2cData.responses[0];
              const { data: c2cMsg } = await supabase
                .from('group_messages')
                .insert({
                  group_id: groupId,
                  sender_type: 'character',
                  character_id: c2cResponse.characterId,
                  content: c2cResponse.content
                })
                .select('*, characters(name, avatar_url)')
                .single();

              if (c2cMsg) {
                setMessages(prev => [...prev, {
                  ...c2cMsg,
                  sender_type: 'character' as const,
                  characterName: c2cMsg.characters?.name,
                  characterAvatar: c2cMsg.characters?.avatar_url
                }]);
                
                currentMessages.push({
                  sender_type: 'character',
                  content: c2cResponse.content,
                  characterName: c2cResponse.characterName
                });
                currentTrigger = c2cResponse;
                
                // 递减概率决定是否继续
                const continueChance = effectiveSettings.continueChanceBase - (currentRound * effectiveSettings.continueChanceDecay);
                const continueRoll = Math.random() * 100;
                continueInteraction = continueRoll < Math.max(continueChance, 5);
                console.log(`Continue roll: ${continueRoll.toFixed(1)} < ${Math.max(continueChance, 5)}? ${continueInteraction}`);
              } else {
                continueInteraction = false;
              }
            } else {
              continueInteraction = false;
            }
          } catch (c2cErr) {
            console.error('Character-to-character error:', c2cErr);
            continueInteraction = false;
          }
        }
      }
    } catch (err) {
      console.error('Group chat error:', err);
      toast.error('发送失败，请重试');
    }

    setLoading(false);
  };

  // 使用 friend_bubble_color 作为所有角色的统一颜色
  const getCharacterBubbleColor = () => {
    return customization.friend_bubble_color || '#A855F7';
  };

  // 用于头像的区分色
  const getCharacterAvatarColor = (charId?: string) => {
    if (!charId) return '#A855F7';
    const index = members.findIndex(m => m.id === charId);
    const colors = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    return colors[index % colors.length];
  };

  const getBubbleStyle = (isUser: boolean) => {
    const style = customization.bubble_style || 'rounded';
    // 防竖排：group chat 同步 ChatPage 策略（inline-block + 外层 flex-1/min-w-0 + render 时 minWidth）
    const baseClasses = `relative inline-block max-w-[75%] px-3 py-2 shadow-sm whitespace-pre-wrap break-words`;

    switch (style) {
      case 'cloud':
        return `${baseClasses} rounded-[20px] ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
      case 'square':
        return `${baseClasses} rounded-lg ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      case 'glass':
        return `${baseClasses} chat-bubble-glass rounded-[1.5rem] ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
      default:
        return `${baseClasses} rounded-[18px] ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
    }
  };

  // 字体颜色
  const fontColor = (customization as any).font_color || '#333333';
  const friendFontColor = (customization as any).friend_font_color || '#333333';

// 气泡框预设 - 带图片气泡框支持 + 头像装饰
  const bubbleFramePresets: Record<string, { type: 'css' | 'image'; gradient?: string; borderColor?: string; imageUrl?: string; decorIcon?: string; decorImage?: string; backdropFilter?: string; boxShadow?: string; highlight?: string }> = {
    'cute-pink': { type: 'css', gradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFB5C5 100%)', borderColor: '#FFB5C5', decorIcon: '🎀' },
    'cute-blue': { type: 'css', gradient: 'linear-gradient(135deg, #E4F4FF 0%, #B5D8FF 100%)', borderColor: '#B5D8FF', decorIcon: '☁️' },
    'cute-yellow': { type: 'css', gradient: 'linear-gradient(135deg, #FFF9E4 0%, #FFFAB5 100%)', borderColor: '#FFE066', decorIcon: '⭐' },
    'cute-green': { type: 'css', gradient: 'linear-gradient(135deg, #E4FFF4 0%, #B5FFD8 100%)', borderColor: '#B5FFD8', decorIcon: '🍀' },
    'cute-purple': { type: 'css', gradient: 'linear-gradient(135deg, #F4E4FF 0%, #E5B5FF 100%)', borderColor: '#E5B5FF', decorIcon: '💜' },
    // 水滴透明磨砂气泡框 - 高光立体效果
    'water-drop': { type: 'css', gradient: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 15%, rgba(200,230,255,0.35) 40%, rgba(170,210,255,0.25) 70%, rgba(255,255,255,0.5) 100%)', borderColor: 'rgba(255,255,255,0.8)', decorIcon: '', backdropFilter: 'blur(12px) saturate(180%)', boxShadow: 'inset 0 4px 12px rgba(255,255,255,0.9), inset 0 -3px 8px rgba(100,180,255,0.25), inset 3px 0 8px rgba(255,255,255,0.5), inset -3px 0 8px rgba(255,255,255,0.5), 0 6px 20px rgba(80,140,200,0.3), 0 2px 6px rgba(255,255,255,0.6)', highlight: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,255,255,0.8) 0%, transparent 60%)' },
    // 带卡通头像装饰的黑红渐变气泡框
    'anime-head': { type: 'css', gradient: 'linear-gradient(180deg, #1a1a1a 0%, #2a0000 50%, #8b0000 100%)', borderColor: '#8b0000', decorIcon: '', decorImage: animeHeadDecor },
  };
  
  const getUserBubbleDecorImage = () => bubbleFramePresets[userBubbleFrame]?.decorImage;
  const getFriendBubbleDecorImage = () => bubbleFramePresets[friendBubbleFrame]?.decorImage;
  const getUserBubbleDecor = () => bubbleFramePresets[userBubbleFrame]?.decorIcon;
  const getFriendBubbleDecor = () => bubbleFramePresets[friendBubbleFrame]?.decorIcon;
  
  const userBubbleFrame = (customization as any).bubble_frame_url || '';
  const friendBubbleFrame = (customization as any).friend_bubble_frame_url || '';
  
  const getUserBubbleStyle = (): React.CSSProperties => {
    const frame = bubbleFramePresets[userBubbleFrame];
    if (frame) {
      if (frame.type === 'image' && frame.imageUrl) {
        return { 
          backgroundImage: `url(${frame.imageUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: 'transparent',
        };
      }
      const style: React.CSSProperties = { 
        background: frame.highlight 
          ? `${frame.highlight}, ${frame.gradient}`
          : frame.gradient, 
        border: `2px solid ${frame.borderColor}` 
      };
      if (frame.backdropFilter) {
        style.backdropFilter = frame.backdropFilter;
        style.WebkitBackdropFilter = frame.backdropFilter;
      }
      if (frame.boxShadow) {
        style.boxShadow = frame.boxShadow;
      }
      return style;
    }
    return { backgroundColor: customization.bubble_color || '#FFB5C5' };
  };
  
  const getFriendBubbleStyle = (): React.CSSProperties => {
    const frame = bubbleFramePresets[friendBubbleFrame];
    if (frame) {
      if (frame.type === 'image' && frame.imageUrl) {
        return { 
          backgroundImage: `url(${frame.imageUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: 'transparent',
        };
      }
      const style: React.CSSProperties = { 
        background: frame.highlight 
          ? `${frame.highlight}, ${frame.gradient}`
          : frame.gradient, 
        border: `2px solid ${frame.borderColor}` 
      };
      if (frame.backdropFilter) {
        style.backdropFilter = frame.backdropFilter;
        style.WebkitBackdropFilter = frame.backdropFilter;
      }
      if (frame.boxShadow) {
        style.boxShadow = frame.boxShadow;
      }
      return style;
    }
    return { backgroundColor: getCharacterBubbleColor() };
  };

  // 四格头像组件
  const GroupAvatar = () => {
    const displayMembers = members.slice(0, 4);
    const gridSize = displayMembers.length <= 1 ? 1 : 2;
    
    return (
      <div 
        className="w-12 h-12 rounded-xl overflow-hidden bg-muted grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {displayMembers.map((member, i) => (
          <div key={member.id} className="w-full h-full bg-muted">
            {member.avatar_url ? (
              <img src={member.avatar_url} className="w-full h-full object-cover" alt={member.name} />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center text-white text-xs"
                style={{ backgroundColor: getCharacterAvatarColor(member.id) }}
              >
                {member.name[0]}
              </div>
            )}
          </div>
        ))}
        {displayMembers.length < 4 && displayMembers.length > 1 && 
          Array(4 - displayMembers.length).fill(0).map((_, i) => (
            <div key={`empty-${i}`} className="w-full h-full bg-muted/50" />
          ))
        }
      </div>
    );
  };

  const chatBgUrl = (customization as any).group_chat_background_url || customization.chat_background_url;

  return (
    <div className="h-screen bg-background/80 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/group')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3 ml-2 flex-1">
          <GroupAvatar />
          <div>
            <span className="font-semibold">{group?.name || '加载中...'}</span>
            <p className="text-xs text-muted-foreground">{members.length}个成员</p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => bgInputRef.current?.click()}>
              <Image className="w-4 h-4 mr-2" />
              更换群聊背景
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowInteractionSettings(true)}>
              <Sliders className="w-4 h-4 mr-2" />
              角色互动设置
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  清空聊天记录
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清空</AlertDialogTitle>
                  <AlertDialogDescription>确定要清空所有聊天记录吗？此操作不可恢复。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllMessages}>确认清空</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
      </div>

      {/* Member avatars + Lively Mode Toggle */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 flex-1">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-1 min-w-fit">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white overflow-hidden"
                style={{ backgroundColor: getCharacterAvatarColor(member.id) }}
              >
                {member.avatar_url ? (
                  <img src={member.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs text-muted-foreground max-w-[50px] truncate">{member.name}</span>
            </div>
          ))}
        </div>
        
        {/* 热闹模式开关 */}
        <button
          onClick={() => setLivelyMode(!livelyMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
            livelyMode 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Flame className={`w-3.5 h-3.5 ${livelyMode ? 'animate-pulse' : ''}`} />
          热闹模式
        </button>
      </div>

      {/* 角色互动设置面板 */}
      <AnimatePresence>
        {showInteractionSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border-b overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">角色互动设置</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowInteractionSettings(false)}>
                  关闭
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">最大互动轮数: {interactionSettings.maxRounds}轮</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={interactionSettings.maxRounds}
                    onChange={(e) => setInteractionSettings(prev => ({ ...prev, maxRounds: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">首次触发概率: {interactionSettings.firstTriggerChance}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={interactionSettings.firstTriggerChance}
                    onChange={(e) => setInteractionSettings(prev => ({ ...prev, firstTriggerChance: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">继续互动基础概率: {interactionSettings.continueChanceBase}%</label>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={interactionSettings.continueChanceBase}
                    onChange={(e) => setInteractionSettings(prev => ({ ...prev, continueChanceBase: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">每轮递减: {interactionSettings.continueChanceDecay}%</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="5"
                    value={interactionSettings.continueChanceDecay}
                    onChange={(e) => setInteractionSettings(prev => ({ ...prev, continueChanceDecay: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                💡 开启「热闹模式」后，轮数+2、首次触发+30%、继续概率+20%
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ 
          backgroundImage: chatBgUrl ? `url(${chatBgUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex cursor-pointer ${msg.sender_type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              onClick={(e) => handleMessageClick(msg, e)}
            >
              {/* Avatar */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 overflow-hidden shadow-sm"
                style={{ 
                  backgroundColor: msg.sender_type === 'user' 
                    ? undefined 
                    : getCharacterAvatarColor(msg.character_id) 
                }}
              >
                {msg.sender_type === 'user' ? (
                  userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="用户头像" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center text-[10px] text-gray-600">
                      {userProfile?.nickname?.charAt(0) || '我'}
                    </div>
                  )
                ) : (
                  msg.characterAvatar ? (
                    <img src={msg.characterAvatar} className="w-full h-full object-cover" alt={msg.characterName} />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )
                )}
              </div>

              {/* Bubble - 紧贴头像，gap-1.5 */}
              <div className={`flex flex-col flex-1 min-w-0 max-w-[calc(100%-48px)] ${msg.sender_type === 'user' ? 'mr-1.5 items-end' : 'ml-1.5 items-start'}`}>
                {msg.sender_type === 'character' && (
                  <p className="text-xs text-muted-foreground mb-0.5">{msg.characterName}</p>
                )}
                <div
                  className={getBubbleStyle(msg.sender_type === 'user')}
                  style={{
                    ...(msg.sender_type === 'user' ? getUserBubbleStyle() : getFriendBubbleStyle()),
                    opacity: customization.bubble_opacity ?? 1,
                    color: msg.sender_type === 'user' ? fontColor : friendFontColor,
                    fontSize: `${customization.bubble_size || 16}px`,
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    writingMode: 'horizontal-tb',
                    textOrientation: 'mixed',
                    // 气泡自适应内容宽度
                    width: 'fit-content',
                  }}
                >
                  {/* 装饰图标 或 头像装饰图片 */}
                  {msg.sender_type === 'user' && getUserBubbleDecorImage() && (
                    <img src={getUserBubbleDecorImage()} alt="" className="absolute -top-2 -right-3 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
                  )}
                  {msg.sender_type === 'user' && !getUserBubbleDecorImage() && getUserBubbleDecor() && (
                    <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm z-20">{getUserBubbleDecor()}</span>
                  )}
                  {msg.sender_type !== 'user' && getFriendBubbleDecorImage() && (
                    <img src={getFriendBubbleDecorImage()} alt="" className="absolute -top-2 -left-3 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
                  )}
                  {msg.sender_type !== 'user' && !getFriendBubbleDecorImage() && getFriendBubbleDecor() && (
                    <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm z-20">{getFriendBubbleDecor()}</span>
                  )}
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="px-4 py-3 rounded-2xl bg-muted">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Long press menu */}
      <AnimatePresence>
        {longPressedMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setLongPressedMsg(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-2xl p-4 space-y-2 min-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-muted-foreground mb-2 truncate max-w-[200px]">
                "{longPressedMsg.content.slice(0, 30)}..."
              </p>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setInput(prev => `[引用: "${longPressedMsg.content.slice(0, 30)}..."]\n${prev}`);
                  setLongPressedMsg(null);
                }}
              >
                <Quote className="w-4 h-4 mr-2" />
                引用
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive"
                onClick={() => deleteFromMessage(longPressedMsg)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                回溯删除
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLongPressedMsg(null)}
              >
                取消
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="relative p-4 border-t bg-card">
        {/* @提及列表 */}
        <AnimatePresence>
          {showMentionList && filteredMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-2 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              <div className="p-2 text-xs text-muted-foreground border-b flex items-center gap-1">
                <AtSign className="w-3 h-3" />
                选择要@的角色
              </div>
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => selectMention(member)}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white overflow-hidden"
                    style={{ backgroundColor: getCharacterAvatarColor(member.id) }}
                  >
                    {member.avatar_url ? (
                      <img src={member.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <span className="font-medium">{member.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-center">
          {/* Emoji button */}
          <Popover open={showEmoji} onOpenChange={setShowEmoji}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" disabled={loading}>
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" side="top">
              <div className="flex gap-1 mb-2 border-b pb-2">
                {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => setActiveEmojiCategory(key as keyof typeof EMOJI_CATEGORIES)}
                    className={`p-2 rounded-lg transition-colors ${
                      activeEmojiCategory === key ? 'bg-primary/20' : 'hover:bg-muted'
                    }`}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji, i) => (
                  <button
                    key={i}
                    className="p-1.5 text-xl hover:bg-muted rounded transition-colors"
                    onClick={() => addEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* @ button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setInput(prev => prev + '@');
              setShowMentionList(true);
              setMentionFilter('');
              inputRef.current?.focus();
            }}
            disabled={loading}
          >
            <AtSign className="w-5 h-5" />
          </Button>

          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="输入消息... @可指定角色"
            onKeyPress={(e) => e.key === 'Enter' && !showMentionList && sendMessage()}
            className="flex-1"
            disabled={loading}
          />
          <Button 
            variant="candy" 
            size="icon" 
            onClick={sendMessage} 
            disabled={loading || !input.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatPage;
