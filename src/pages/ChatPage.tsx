import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Smile, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Common emojis for quick access
const EMOJI_LIST = [
  '😊', '😂', '🥰', '😍', '😘', '😋', '😎', '🤗',
  '😭', '😢', '😤', '😡', '🥺', '😳', '🤔', '😏',
  '👍', '👎', '👏', '🙏', '💪', '✌️', '🤝', '👋',
  '❤️', '💕', '💖', '💗', '💓', '💔', '🖤', '💜',
  '🎉', '🎊', '🎁', '🎂', '🌟', '⭐', '✨', '🔥',
  '🌸', '🌺', '🌹', '🌻', '🌈', '☀️', '🌙', '💫',
];

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          customBaseUrl: customBaseUrl?.api_key,
          customModel: customModel?.api_key
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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, { ...userMessage, id: Date.now() }]);
    setInput('');
    setLoading(true);

    await supabase.from('chat_messages').insert({ 
      user_id: user?.id, 
      character_id: characterId, 
      role: 'user', 
      content: input 
    });

    try {
      const body: any = { 
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), userMessage], 
        characterName: character?.name, 
        persona: character?.persona 
      };
      
      // Only add user API config if they have one configured
      if (apiConfig.apiKey && apiConfig.provider) {
        body.userApiKey = apiConfig.apiKey;
        body.provider = apiConfig.provider;
        if (apiConfig.customBaseUrl) body.customBaseUrl = apiConfig.customBaseUrl;
        if (apiConfig.customModel) body.customModel = apiConfig.customModel;
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
      
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: '' }]);

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
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            } catch {}
          }
        }
      }

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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center p-3 border-b bg-background/95 backdrop-blur-md z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/friends')} className="flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 ml-1 min-w-0 flex-1">
          <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-pink-200">
            <AvatarImage src={character?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-pink-200 to-purple-200 text-gray-600 text-xs">
              {character?.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-foreground text-sm truncate">{character?.name || '加载中...'}</span>
        </div>
      </div>

      {/* Scrollable Messages Area - 固定高度，只有这里可以滚动 */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3" 
        style={{ 
          backgroundImage: customization.chat_background_url 
            ? `url(${customization.chat_background_url})` 
            : 'linear-gradient(to bottom, hsl(var(--background)), hsl(var(--muted)))',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar - 缩小尺寸 */}
            <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-white shadow-sm">
              {msg.role === 'user' ? (
                <>
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-200 to-rose-200 text-xs text-gray-600">
                    {profile?.nickname?.charAt(0) || '我'}
                  </AvatarFallback>
                </>
              ) : (
                <>
                  <AvatarImage src={character?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-100 to-purple-100 text-xs text-gray-500">
                    {character?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            
            {/* Bubble */}
            <div 
              className={getBubbleStyle(msg.role === 'user')}
              style={{ 
                backgroundColor: msg.role === 'user' ? userBubbleColor : friendBubbleColor, 
                opacity: bubbleOpacity,
                color: '#333',
                fontSize: `${bubbleSize}px`,
                lineHeight: '1.5'
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-start gap-2 flex-row">
            <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-white shadow-sm">
              <AvatarImage src={character?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-pink-100 to-purple-100 text-xs">
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

      {/* Fixed Input Bar - 固定在底部 */}
      <div className="flex-shrink-0 p-2 border-t bg-background/95 backdrop-blur-md flex items-center gap-2 z-10">
        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0 w-8 h-8 text-muted-foreground">
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-background border shadow-lg z-50" align="start" side="top">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="w-7 h-7 flex items-center justify-center text-base hover:bg-muted rounded-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
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
      </div>
    </div>
  );
};

export default ChatPage;
