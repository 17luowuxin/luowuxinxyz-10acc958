import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { 
  ArrowLeft, Settings, ChevronLeft, ChevronRight, Send, Image, 
  Volume2, VolumeX, User, Plus, ChevronDown, Music, MoreVertical,
  Eye, Edit, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  persona: string | null;
  sprite_url: string | null;
  voice_id: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface StorySettings {
  name: string;
  characters: Character[];
  background: string;
  opening: string;
  openingCharacter: string | null;
  willEnd: boolean;
}

// 故事设置页面
const StorySetupPage: React.FC<{ onStart: (settings: StorySettings, characterId: string) => void }> = ({ onStart }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  
  const [settings, setSettings] = useState<StorySettings>({
    name: '',
    characters: [],
    background: '',
    opening: '',
    openingCharacter: null,
    willEnd: false
  });

  useEffect(() => {
    if (!user) return;
    
    const loadCharacters = async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('id, name, avatar_url, persona, sprite_url, voice_id')
        .eq('user_id', user.id);
      
      if (data) setAllCharacters(data);
      setLoading(false);
    };
    
    loadCharacters();
  }, [user]);

  const addCharacter = (char: Character) => {
    if (!settings.characters.find(c => c.id === char.id)) {
      setSettings(prev => ({
        ...prev,
        characters: [...prev.characters, char]
      }));
    }
    setShowCharacterPicker(false);
  };

  const removeCharacter = (charId: string) => {
    setSettings(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== charId),
      openingCharacter: prev.openingCharacter === charId ? null : prev.openingCharacter
    }));
  };

  const handleStart = () => {
    if (settings.characters.length === 0) {
      toast.error('请至少选择一个角色');
      return;
    }
    // 默认使用第一个角色
    const mainChar = settings.characters[0];
    onStart(settings, mainChar.id);
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center">
        <div className="text-foreground/60">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* 顶部返回 */}
      <div className="flex items-center p-4">
        <button
          onClick={() => navigate('/games')}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* 故事名称 */}
        <div className="mb-6">
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
            placeholder="请填写故事名称"
            className="w-full px-4 py-4 bg-muted rounded-2xl text-lg placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>

        {/* 参与角色 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground font-medium">参与角色</h3>
            <button
              type="button"
              onClick={() => navigate('/visual-novel/sprites')}
              className="text-sm text-primary"
            >
              管理立绘
            </button>
          </div>
          <div className="bg-muted rounded-2xl p-4">
            {settings.characters.length > 0 ? (
              <div className="flex gap-3 flex-wrap mb-3">
                {settings.characters.map((char) => (
                  <div key={char.id} className="relative">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-primary/30">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-foreground/40" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCharacter(char.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                    <p className="text-xs text-center mt-1 truncate w-16">{char.name}</p>
                  </div>
                ))}
              </div>
            ) : null}
            
            <button
              onClick={() => setShowCharacterPicker(true)}
              className="w-full py-4 text-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>选择参与角色</span>
            </button>
          </div>
        </div>

        {/* 全局背景 */}
        <div className="mb-6">
          <h3 className="text-foreground font-medium mb-3">全局背景（选填）</h3>
          <div className="bg-muted rounded-2xl p-4">
            <textarea
              value={settings.background}
              onChange={(e) => setSettings(prev => ({ ...prev, background: e.target.value }))}
              placeholder="描述你想构建的世界观，如人物关系、主题背景、玩法规则等"
              rows={5}
              className="w-full bg-transparent resize-none placeholder:text-muted-foreground/60 focus:outline-none text-foreground"
            />
          </div>
        </div>

        {/* 故事开场 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground font-medium">故事开场</h3>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-muted-foreground" />
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="bg-muted rounded-2xl p-4 flex items-start gap-2">
            <button
              onClick={() => setShowCharacterPicker(true)}
              className="shrink-0 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1"
            >
              {settings.openingCharacter 
                ? settings.characters.find(c => c.id === settings.openingCharacter)?.name || '请选择'
                : '请选择'}
              <ChevronDown className="w-3 h-3" />
            </button>
            <span className="text-muted-foreground">:</span>
            <input
              type="text"
              value={settings.opening}
              onChange={(e) => setSettings(prev => ({ ...prev, opening: e.target.value }))}
              placeholder="请输入故事开场的内容"
              className="flex-1 bg-transparent placeholder:text-muted-foreground/60 focus:outline-none text-foreground"
            />
          </div>
        </div>

        {/* 故事是否会结束 */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <span className="text-foreground">故事是否会结束</span>
          <button
            onClick={() => setSettings(prev => ({ ...prev, willEnd: !prev.willEnd }))}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <span>{settings.willEnd ? '会结束' : '不会结束'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 flex gap-3">
        <button
          onClick={handleStart}
          className="flex-1 h-12 bg-primary text-primary-foreground rounded-full font-medium"
        >
          开始故事
        </button>
      </div>

      {/* 角色选择弹窗 */}
      <AnimatePresence>
        {showCharacterPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setShowCharacterPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-background rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium mb-4">选择角色</h3>
              <div className="grid grid-cols-3 gap-3">
                {allCharacters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => addCharacter(char)}
                    className={`p-3 rounded-2xl border-2 transition-colors ${
                      settings.characters.find(c => c.id === char.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted'
                    }`}
                  >
                    <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden mb-2">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-foreground/40" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-center truncate">{char.name}</p>
                  </button>
                ))}
              </div>
              
              {allCharacters.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>暂无角色</p>
                  <button
                    onClick={() => navigate('/friends')}
                    className="mt-3 text-primary"
                  >
                    去创建角色
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 视觉小说聊天页面
const VisualNovelChatPage: React.FC<{ 
  characterId: string;
  storySettings?: StorySettings;
}> = ({ characterId, storySettings }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig } = useAPIConfig();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);

  // 加载角色
  useEffect(() => {
    if (!characterId || !user) return;

    const loadCharacter = async () => {
      try {
        const { data, error } = await supabase
          .from('characters')
          .select('id, name, avatar_url, persona, sprite_url, voice_id')
          .eq('id', characterId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Load character error:', error);
          toast.error('角色加载失败');
          navigate('/visual-novel');
          return;
        }

        if (data) {
          setCharacter(data);

          // 加载自定义背景
          const { data: customData } = await supabase
            .from('customization')
            .select('app_icons')
            .eq('user_id', user.id)
            .single();

          if (customData?.app_icons) {
            const icons = customData.app_icons as Record<string, string>;
            const storedBg = icons[`vn_bg_${characterId}`];
            if (storedBg) setBackgroundUrl(storedBg);
          }
        }
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setPageLoading(false);
      }
    };

    loadCharacter();
  }, [characterId, user, navigate]);

  // 加载消息历史
  useEffect(() => {
    if (!characterId || !user) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('character_id', characterId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        setMessages(data.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.created_at
        })));
        setCurrentMessageIndex(data.length - 1);
      }
    };

    loadMessages();
  }, [characterId, user]);

  // 打字机效果
  useEffect(() => {
    const currentMessage = messages[currentMessageIndex];
    if (!currentMessage || currentMessage.role === 'user') {
      setTypedText(currentMessage?.content || '');
      setIsTyping(false);
      return;
    }

    setTypedText('');
    setIsTyping(true);
    
    const text = currentMessage.content;
    let index = 0;
    
    const timer = setInterval(() => {
      if (index < text.length) {
        setTypedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [currentMessageIndex, messages]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || !character || !user || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setCurrentMessageIndex(messages.length);

    await supabase.from('chat_messages').insert({
      user_id: user.id,
      character_id: characterId,
      role: 'user',
      content: userMessage
    });

    try {
      // 构建系统提示，包含故事设置
      let systemPrompt = character.persona || '';
      if (storySettings) {
        if (storySettings.background) {
          systemPrompt = `[故事背景]\n${storySettings.background}\n\n[角色设定]\n${systemPrompt}`;
        }
      }

      const response = await supabase.functions.invoke('chat', {
        body: {
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: userMessage }]),
          characterName: character.name,
          persona: systemPrompt,
          characterId: character.id,
          userId: user.id,
          ...apiConfig
        }
      });

      if (response.data?.response) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.data.response,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentMessageIndex(messages.length + 1);

        await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: response.data.response
        });
      }
    } catch (error) {
      toast.error('发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 背景上传
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !characterId) return;

    try {
      toast.loading('上传中...');
      const fileName = `${user.id}/vn-bg/${characterId}-${Date.now()}.jpg`;
      
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      setBackgroundUrl(publicUrl);
      
      const { data: existing } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user.id)
        .single();

      const icons = (existing?.app_icons as Record<string, string>) || {};
      icons[`vn_bg_${characterId}`] = publicUrl;

      await supabase.from('customization').upsert({
        user_id: user.id,
        app_icons: icons
      }, { onConflict: 'user_id' });

      toast.dismiss();
      toast.success('背景已设置');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    }
  };

  // 立绘上传
  const handleSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !characterId) return;

    try {
      toast.loading('上传中...');
      const fileName = `${user.id}/sprites/${characterId}/main-${Date.now()}.png`;
      
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      setCharacter(prev => prev ? { ...prev, sprite_url: publicUrl } : null);
      
      await supabase
        .from('characters')
        .update({ sprite_url: publicUrl })
        .eq('id', characterId);

      toast.dismiss();
      toast.success('立绘已设置');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    }
  };

  const prevMessage = () => {
    if (currentMessageIndex > 0) {
      setCurrentMessageIndex(prev => prev - 1);
    }
  };

  const nextMessage = () => {
    if (currentMessageIndex < messages.length - 1) {
      setCurrentMessageIndex(prev => prev + 1);
    }
  };

  const skipTyping = () => {
    if (isTyping) {
      const currentMessage = messages[currentMessageIndex];
      if (currentMessage) {
        setTypedText(currentMessage.content);
        setIsTyping(false);
      }
    }
  };

  const currentMessage = messages[currentMessageIndex];

  if (pageLoading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black">
      {/* 背景 */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ 
          backgroundImage: backgroundUrl 
            ? `url(${backgroundUrl})` 
            : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      {/* 角色立绘 */}
      <AnimatePresence mode="wait">
        {character?.sprite_url && (
          <motion.div
            key="sprite"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.4 }}
          >
            <img 
              src={character.sprite_url} 
              alt={character.name} 
              className="max-h-[50vh] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => navigate('/visual-novel')}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <h1 className="text-white font-medium text-lg drop-shadow-lg">
          {storySettings?.name || character?.name || '加载中...'}
        </h1>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 right-4 z-40 bg-black/80 backdrop-blur-md rounded-2xl p-4 space-y-3 min-w-[160px]"
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <Image className="w-4 h-4" />
              <span>更换背景</span>
            </button>
            <button
              onClick={() => spriteInputRef.current?.click()}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <User className="w-4 h-4" />
              <span>更换立绘</span>
            </button>
            <button
              onClick={() => navigate('/visual-novel/sprites')}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <Edit className="w-4 h-4" />
              <span>立绘管理</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? '取消静音' : '静音'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBgUpload}
        className="hidden"
      />
      <input
        ref={spriteInputRef}
        type="file"
        accept="image/*"
        onChange={handleSpriteUpload}
        className="hidden"
      />

      {/* 底部对话框区域 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* 消息导航 */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-4 mb-2">
            <button
              onClick={prevMessage}
              disabled={currentMessageIndex === 0}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-xs">
              {currentMessageIndex + 1} / {messages.length}
            </span>
            <button
              onClick={nextMessage}
              disabled={currentMessageIndex === messages.length - 1}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* 对话框 */}
        <div 
          className="mx-3 mb-3 bg-black/70 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-h-[100px]"
          onClick={skipTyping}
        >
          {currentMessage ? (
            <div>
              <div className="text-pink-400 text-sm font-medium mb-2">
                {currentMessage.role === 'assistant' ? character?.name : '我'}
              </div>
              <p className="text-white text-base leading-relaxed">
                {currentMessage.role === 'assistant' ? typedText : currentMessage.content}
                {isTyping && <span className="animate-pulse">▌</span>}
              </p>
            </div>
          ) : (
            <p className="text-white/50 text-center">开始对话吧...</p>
          )}
        </div>

        {/* 输入框 */}
        <div className="mx-3 mb-4 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="输入消息..."
            className="flex-1 h-11 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// 主入口组件
const VisualNovelPage: React.FC = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [storySettings, setStorySettings] = useState<StorySettings | null>(null);
  const [activeCharId, setActiveCharId] = useState<string | null>(characterId || null);

  const handleStartStory = (settings: StorySettings, charId: string) => {
    setStorySettings(settings);
    setActiveCharId(charId);
  };

  // 如果URL中有characterId，直接进入聊天
  if (characterId) {
    return <VisualNovelChatPage characterId={characterId} />;
  }

  // 如果已经设置了故事并选择了角色
  if (activeCharId && storySettings) {
    return <VisualNovelChatPage characterId={activeCharId} storySettings={storySettings} />;
  }

  // 否则显示故事设置页面
  return <StorySetupPage onStart={handleStartStory} />;
};

export default VisualNovelPage;
