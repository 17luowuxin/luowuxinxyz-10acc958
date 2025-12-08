import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ChatPage: React.FC = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customization, setCustomization] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && characterId) {
      fetchCharacter();
      fetchMessages();
      fetchCustomization();
    }
  }, [user, characterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchCharacter = async () => {
    const { data } = await supabase.from('characters').select('*').eq('id', characterId).single();
    if (data) setCharacter(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('character_id', characterId).order('created_at');
    if (data) setMessages(data);
  };

  const fetchCustomization = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).single();
    if (data) setCustomization(data);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, { ...userMessage, id: Date.now() }]);
    setInput('');
    setLoading(true);

    await supabase.from('chat_messages').insert({ user_id: user?.id, character_id: characterId, role: 'user', content: input });

    try {
      const resp = await supabase.functions.invoke('chat', {
        body: { messages: [...messages.map(m => ({ role: m.role, content: m.content })), userMessage], characterName: character?.name, persona: character?.persona }
      });

      if (resp.error) throw new Error(resp.error.message);
      
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
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/friends')}><ChevronLeft className="w-6 h-6" /></Button>
        <div className="flex items-center gap-3 ml-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple" />
          <span className="font-semibold">{character?.name || '加载中...'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: customization.chat_background_url ? `url(${customization.chat_background_url})` : undefined, backgroundSize: 'cover' }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-white ${msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`} style={{ backgroundColor: msg.role === 'user' ? (customization.bubble_color || '#FF6B9D') : (customization.friend_bubble_color || '#A855F7'), opacity: customization.bubble_opacity || 1 }}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-card flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入消息..." onKeyPress={(e) => e.key === 'Enter' && sendMessage()} className="flex-1" />
        <Button variant="candy" size="icon" onClick={sendMessage} disabled={loading}><Send className="w-5 h-5" /></Button>
      </div>
    </div>
  );
};

export default ChatPage;
