import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Settings, User, AtSign, Smile, Trash2, RotateCcw, MoreVertical, Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const [apiConfig, setApiConfig] = useState<any>({});
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
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

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

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, persona')
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

  // 长按开始
  const handleTouchStart = (msg: any) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressedMsg(msg);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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

      if (apiConfig.apiKey && apiConfig.provider) {
        body.userApiKey = apiConfig.apiKey;
        body.provider = apiConfig.provider;
        if (apiConfig.baseUrl) body.baseUrl = apiConfig.baseUrl;
        if (apiConfig.model) body.model = apiConfig.model;
      }

      const { data, error } = await supabase.functions.invoke('group-chat', { body });

      if (error) throw error;

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

        await new Promise(resolve => setTimeout(resolve, 800));
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
    const baseClasses = 'max-w-[70%] px-4 py-2 shadow-sm';
    
    switch (style) {
      case 'cloud':
        return `${baseClasses} rounded-3xl ${isUser ? 'rounded-br-lg' : 'rounded-bl-lg'}`;
      case 'square':
        return `${baseClasses} rounded-lg ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      default:
        return `${baseClasses} rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
    }
  };

  // 字体颜色
  const fontColor = (customization as any).font_color || '#333333';
  const friendFontColor = (customization as any).friend_font_color || '#333333';

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

      {/* Member avatars */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 overflow-x-auto no-scrollbar">
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
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
              onTouchStart={() => handleTouchStart(msg)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {msg.sender_type === 'character' && (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white mr-2 flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: getCharacterAvatarColor(msg.character_id) }}
                >
                  {msg.characterAvatar ? (
                    <img src={msg.characterAvatar} className="w-full h-full object-cover" />
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
                  className={getBubbleStyle(msg.sender_type === 'user')}
                  style={{
                    backgroundColor: msg.sender_type === 'user' 
                      ? (customization.bubble_color || '#FF6B9D')
                      : getCharacterBubbleColor(),
                    opacity: customization.bubble_opacity || 1,
                    color: msg.sender_type === 'user' ? fontColor : friendFontColor,
                    fontSize: `${customization.bubble_size || 16}px`
                  }}
                >
                  {msg.content}
                </div>
              </div>
              {msg.sender_type === 'user' && (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white ml-2 flex-shrink-0 overflow-hidden bg-gradient-to-br from-pink-300 to-rose-400"
                >
                  <User className="w-4 h-4" />
                </div>
              )}
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
                className="w-full justify-start text-destructive"
                onClick={() => deleteFromMessage(longPressedMsg)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                从此处回溯删除
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
