import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Smile, Trash2, RotateCcw, Quote, MoreVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const [apiConfig, setApiConfig] = useState<any>({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');
  const [longPressedMsg, setLongPressedMsg] = useState<any>(null);
  const [quotedMessage, setQuotedMessage] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user && characterId) {
      fetchCharacter();
      fetchMessages();
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
    if (data) setCharacter(data);
  };

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user?.id).single();
    if (data) setProfile(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('character_id', characterId).order('created_at');
    if (data) setMessages(data);
  };

  const fetchCustomization = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).single();
    if (data) setCustomization(data);
  };

  const fetchApiConfig = async () => {
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
      }
    }
  };

  const getBubbleStyle = (isUser: boolean) => {
    const style = customization.bubble_style || 'rounded';
    const baseClasses = 'max-w-[75%] px-4 py-2.5 shadow-sm';
    
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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    // 构建消息内容，包含引用
    let messageContent = input;
    if (quotedMessage) {
      messageContent = `[引用: "${quotedMessage.content.slice(0, 50)}${quotedMessage.content.length > 50 ? '...' : ''}"]\n${input}`;
    }
    
    const userMessage = { role: 'user', content: messageContent };
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
      const body: any = { 
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), userMessage], 
        characterName: character?.name, 
        persona: character?.persona,
        userProfile: profile ? { nickname: profile.nickname, persona: profile.persona } : undefined
      };
      
      // Only add user API config if they have one configured
      if (apiConfig.apiKey && apiConfig.provider) {
        body.userApiKey = apiConfig.apiKey;
        body.provider = apiConfig.provider;
        if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
        if (apiConfig.model) body.model = apiConfig.model;
      }
      
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
      
      // Read entire stream first, then show complete message (no typing effect)
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6));
              const delta = json.choices?.[0]?.delta?.content || '';
              assistantContent += delta;
            } catch {}
          }
        }
      }
      
      // Show complete message at once (no streaming effect)
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: assistantContent }]);

      await supabase.from('chat_messages').insert({ 
        user_id: user?.id, 
        character_id: characterId, 
        role: 'assistant', 
        content: assistantContent 
      });
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
        <span className="font-semibold text-foreground text-sm ml-2 truncate flex-1">{character?.name || '加载中...'}</span>
        
        {/* 更多菜单 */}
        <Popover open={showMenu} onOpenChange={setShowMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="end">
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
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              onTouchStart={() => handleTouchStart(msg)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Avatar - 在消息底部对齐 */}
              <Avatar className="w-7 h-7 flex-shrink-0 border border-white/50 shadow-sm">
                {msg.role === 'user' ? (
                  <>
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-200 to-rose-200 text-[10px] text-gray-600">
                      {profile?.nickname?.charAt(0) || '我'}
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src={character?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-100 to-purple-100 text-[10px] text-gray-500">
                      {character?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              
              {/* Bubble */}
              <div 
                className={`${getBubbleStyle(msg.role === 'user')} relative`}
                style={{ 
                  backgroundColor: msg.role === 'user' ? userBubbleColor : friendBubbleColor, 
                  opacity: bubbleOpacity,
                  color: '#333',
                  fontSize: `${bubbleSize}px`,
                  lineHeight: '1.5'
                }}
              >
                {msg.content}
                
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
          ))}
          
          {loading && (
            <div className="flex items-end gap-2 flex-row">
              <Avatar className="w-7 h-7 flex-shrink-0 border border-white/50 shadow-sm">
                <AvatarImage src={character?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-pink-100 to-purple-100 text-[10px]">
                  {character?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div 
                className="px-3 py-2 rounded-2xl rounded-bl-md shadow-sm" 
                style={{ backgroundColor: friendBubbleColor, opacity: bubbleOpacity }}
              >
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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
