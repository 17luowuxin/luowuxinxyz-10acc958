import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
    // Fetch user's custom API key configuration
    const { data: apiKeys } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
    if (apiKeys && apiKeys.length > 0) {
      // Prefer custom provider if available
      const customKey = apiKeys.find(k => k.provider === 'custom');
      const deepseekKey = apiKeys.find(k => k.provider === 'deepseek');
      const openaiKey = apiKeys.find(k => k.provider === 'openai');
      const anthropicKey = apiKeys.find(k => k.provider === 'anthropic');
      
      if (customKey) {
        setApiConfig({ provider: 'custom', apiKey: customKey.api_key });
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
    const baseClasses = 'max-w-[75%] px-4 py-2.5';
    
    switch (style) {
      case 'cloud':
        return `${baseClasses} rounded-3xl ${isUser ? 'rounded-br-lg' : 'rounded-bl-lg'}`;
      case 'square':
        return `${baseClasses} rounded-lg ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      default: // rounded
        return `${baseClasses} rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, { ...userMessage, id: Date.now() }]);
    setInput('');
    setLoading(true);

    await supabase.from('chat_messages').insert({ user_id: user?.id, character_id: characterId, role: 'user', content: input });

    try {
      const body: any = { 
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), userMessage], 
        characterName: character?.name, 
        persona: character?.persona 
      };
      
      // Add user's API config if available
      if (apiConfig.apiKey && apiConfig.provider) {
        body.userApiKey = apiConfig.apiKey;
        body.provider = apiConfig.provider;
        if (apiConfig.customBaseUrl) body.customBaseUrl = apiConfig.customBaseUrl;
        if (apiConfig.customModel) body.customModel = apiConfig.customModel;
      }
      
      const resp = await supabase.functions.invoke('chat', { body });

      if (resp.error) {
        toast.error(resp.error.message || 'AI服务暂时不可用');
        throw new Error(resp.error.message);
      }
      
      const reader = resp.data.getReader();
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

      await supabase.from('chat_messages').insert({ user_id: user?.id, character_id: characterId, role: 'assistant', content: assistantContent });
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('402') || err.message?.includes('配额')) {
        toast.error('API配额已用完，请检查设置');
      }
    }
    setLoading(false);
  };

  // Pastel macaron colors for bubbles
  const userBubbleColor = customization.bubble_color || '#FFB5C5'; // pastel pink
  const friendBubbleColor = customization.friend_bubble_color || '#B5D8FF'; // pastel blue

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with avatar */}
      <div className="flex items-center p-4 border-b bg-card/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate('/friends')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3 ml-2">
          <Avatar className="w-10 h-10 border-2 border-primary/20">
            <AvatarImage src={character?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
              {character?.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-foreground">{character?.name || '加载中...'}</span>
        </div>
      </div>

      {/* Messages with background */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4" 
        style={{ 
          backgroundImage: customization.chat_background_url ? `url(${customization.chat_background_url})` : undefined, 
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* Friend avatar on left */}
            {msg.role !== 'user' && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={character?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-secondary to-accent text-xs">
                  {character?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div 
              className={getBubbleStyle(msg.role === 'user')}
              style={{ 
                backgroundColor: msg.role === 'user' ? userBubbleColor : friendBubbleColor, 
                opacity: customization.bubble_opacity || 1,
                color: '#333'
              }}
            >
              {msg.content}
            </div>
            
            {/* User avatar on right */}
            {msg.role === 'user' && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-xs text-primary-foreground">
                  {profile?.nickname?.charAt(0) || '我'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={character?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-secondary to-accent text-xs">
                {character?.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ backgroundColor: friendBubbleColor }}>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-card/80 backdrop-blur-sm flex gap-2">
        <Input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="输入消息..." 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
          className="flex-1 bg-muted/50" 
        />
        <Button variant="candy" size="icon" onClick={sendMessage} disabled={loading}>
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;