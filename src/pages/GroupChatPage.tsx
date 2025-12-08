import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && groupId) {
      fetchGroup();
      fetchMessages();
      fetchCustomization();
    }
  }, [user, groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroup = async () => {
    const { data } = await supabase
      .from('group_chats')
      .select('*, group_members(character_id, characters(id, name, avatar_url, persona))')
      .eq('id', groupId)
      .single();
    
    if (data) {
      setGroup(data);
      const chars = data.group_members?.map((m: any) => m.characters).filter(Boolean) || [];
      setMembers(chars);
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

  const sendMessage = async () => {
    if (!input.trim() || loading || members.length === 0) return;
    
    const userMessage = input;
    setInput('');
    setLoading(true);

    // 添加用户消息
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
      // 调用群聊API
      const { data, error } = await supabase.functions.invoke('group-chat', {
        body: {
          messages: messages.map(m => ({
            role: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.sender_type === 'user' ? m.content : `${m.characterName}: ${m.content}`
          })),
          characters: members,
          userMessage
        }
      });

      if (error) throw error;

      // 添加AI角色回复
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
        }

        // 添加延迟效果
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (err) {
      console.error('Group chat error:', err);
      toast.error('发送失败，请重试');
    }

    setLoading(false);
  };

  const getCharacterColor = (charId?: string) => {
    if (!charId) return customization.friend_bubble_color || '#A855F7';
    const index = members.findIndex(m => m.id === charId);
    const colors = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/group')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3 ml-2 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center text-white text-sm font-bold">
            {members.length}
          </div>
          <div>
            <span className="font-semibold">{group?.name || '加载中...'}</span>
            <p className="text-xs text-muted-foreground">{members.length}个成员</p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Member avatars */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 overflow-x-auto no-scrollbar">
        {members.map((member, i) => (
          <div key={member.id} className="flex flex-col items-center gap-1 min-w-fit">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: getCharacterColor(member.id) }}
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <span className="text-xs text-muted-foreground max-w-[50px] truncate">{member.name}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ 
          backgroundImage: customization.chat_background_url ? `url(${customization.chat_background_url})` : undefined,
          backgroundSize: 'cover' 
        }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender_type === 'character' && (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white mr-2 flex-shrink-0"
                  style={{ backgroundColor: getCharacterColor(msg.character_id) }}
                >
                  {msg.characterAvatar ? (
                    <img src={msg.characterAvatar} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
              )}
              <div className="max-w-[70%]">
                {msg.sender_type === 'character' && (
                  <p className="text-xs text-muted-foreground mb-1 ml-1">{msg.characterName}</p>
                )}
                <div
                  className={`px-4 py-2 rounded-2xl text-white ${
                    msg.sender_type === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                  }`}
                  style={{
                    backgroundColor: msg.sender_type === 'user' 
                      ? (customization.bubble_color || '#FF6B9D')
                      : getCharacterColor(msg.character_id),
                    opacity: customization.bubble_opacity || 1
                  }}
                >
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

      {/* Input */}
      <div className="p-4 border-t bg-card flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="在群里说点什么..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
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
  );
};

export default GroupChatPage;
