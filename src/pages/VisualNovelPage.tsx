import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { ArrowLeft, Settings, ChevronLeft, ChevronRight, Send, Image, Volume2, VolumeX, User, Mic, MicOff, Play } from 'lucide-react';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  persona: string | null;
  sprite_url: string | null;
  voice_id: string | null;
}

interface Sprite {
  emotion: string;
  sprite_url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// 角色选择页面
const CharacterSelectPage: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('characters')
      .select('id, name, avatar_url, persona, sprite_url, voice_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setCharacters(data);
      });
  }, [user]);

  return (
    <div className="h-full w-full bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900 flex flex-col">
      <div className="flex items-center p-4 gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white">选择角色</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <p className="text-white/60 text-sm mb-4">选择一个角色开始视觉小说模式对话</p>
        
        <div className="grid grid-cols-2 gap-3">
          {characters.map((char) => (
            <motion.button
              key={char.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(char.id)}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-3 border border-white/10 hover:border-white/30 transition-colors"
            >
              {char.avatar_url ? (
                <img src={char.avatar_url} alt={char.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
              <span className="text-white font-medium text-sm">{char.name}</span>
              {char.sprite_url && (
                <span className="text-xs text-green-400">已有立绘</span>
              )}
            </motion.button>
          ))}
        </div>

        {characters.length === 0 && (
          <div className="text-center text-white/50 py-12">
            <p>暂无角色</p>
            <button
              onClick={() => navigate('/friends')}
              className="mt-4 px-4 py-2 bg-white/10 rounded-full text-sm"
            >
              去创建角色
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 视觉小说聊天页面
const VisualNovelChatPage: React.FC<{ characterId: string }> = ({ characterId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig, ttsConfig } = useAPIConfig();

  const [character, setCharacter] = useState<Character | null>(null);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [currentSpriteUrl, setCurrentSpriteUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 加载角色和立绘
  useEffect(() => {
    if (!characterId || !user) return;

    const loadCharacter = async () => {
      const { data } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCharacter(data);
        setCurrentSpriteUrl(data.sprite_url);

        // 加载表情立绘
        const { data: spritesData } = await supabase
          .from('character_sprites')
          .select('emotion, sprite_url')
          .eq('character_id', characterId)
          .eq('user_id', user.id);

        if (spritesData) {
          setSprites(spritesData);
        }

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
    };

    loadCharacter();
  }, [characterId, user]);

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

      if (data) {
        setMessages(data.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.created_at
        })));
        setCurrentMessageIndex(data.length > 0 ? data.length - 1 : 0);
      }
    };

    loadMessages();
  }, [characterId, user]);

  // 打字机效果
  useEffect(() => {
    const currentMessage = messages[currentMessageIndex];
    if (!currentMessage || currentMessage.role === 'user') {
      setTypedText(currentMessage?.content || '');
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

  // TTS 播放
  const playTTS = async (text: string) => {
    if (isMuted || !ttsConfig?.apiKey || !character?.voice_id) return;

    setIsPlaying(true);
    try {
      const response = await supabase.functions.invoke('tts', {
        body: {
          text,
          voiceId: character.voice_id,
          ttsConfig
        }
      });

      if (response.data?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${response.data.audioContent}`;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsPlaying(false);
    }
  };

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
      const response = await supabase.functions.invoke('chat', {
        body: {
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: userMessage }]),
          characterName: character.name,
          persona: character.persona,
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

        // 自动播放语音
        if (!isMuted && character.voice_id) {
          playTTS(response.data.response);
        }

        // 根据内容切换表情
        updateSpriteByEmotion(response.data.response);
      }
    } catch (error) {
      toast.error('发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 根据内容分析切换立绘表情
  const updateSpriteByEmotion = (text: string) => {
    if (sprites.length === 0) return;

    const emotionKeywords: Record<string, string[]> = {
      happy: ['开心', '高兴', '哈哈', '嘻嘻', '太好了', '喜欢', '爱', '❤', '😊', '😄'],
      sad: ['难过', '伤心', '哭', '😢', '呜呜', '不开心'],
      angry: ['生气', '讨厌', '烦', '😠', '哼'],
      shy: ['害羞', '不好意思', '脸红', '😳', '嘤'],
      surprised: ['惊讶', '天啊', '什么', '！？', '😮', '哇']
    };

    let detectedEmotion = 'normal';
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        detectedEmotion = emotion;
        break;
      }
    }

    const matchedSprite = sprites.find(s => s.emotion === detectedEmotion);
    if (matchedSprite) {
      setCurrentSpriteUrl(matchedSprite.sprite_url);
    } else if (character?.sprite_url) {
      setCurrentSpriteUrl(character.sprite_url);
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
      
      setCurrentSpriteUrl(publicUrl);
      
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

  const currentMessage = messages[currentMessageIndex];

  // 点击播放当前消息语音
  const handlePlayVoice = () => {
    if (currentMessage && currentMessage.role === 'assistant') {
      playTTS(currentMessage.content);
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-black">
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
        {currentSpriteUrl && (
          <motion.div
            key={currentSpriteUrl}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.4 }}
          >
            <img 
              src={currentSpriteUrl} 
              alt={character?.name || '角色'} 
              className="max-h-[55vh] object-contain drop-shadow-2xl"
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
          {character?.name || '加载中...'}
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
              className="w-full flex items-center gap-3 text-white/90 hover:text-white py-2"
            >
              <Image className="w-5 h-5" />
              <span className="text-sm">更换背景</span>
            </button>
            <button
              onClick={() => spriteInputRef.current?.click()}
              className="w-full flex items-center gap-3 text-white/90 hover:text-white py-2"
            >
              <User className="w-5 h-5" />
              <span className="text-sm">更换立绘</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-full flex items-center gap-3 text-white/90 hover:text-white py-2"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="text-sm">{isMuted ? '开启语音' : '关闭语音'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBgUpload}
      />
      <input
        ref={spriteInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSpriteUpload}
      />

      {/* 底部对话框 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="mx-3 mb-2 bg-black/70 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          {/* 消息导航 */}
          {messages.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={prevMessage}
                disabled={currentMessageIndex === 0}
                className="p-1 text-white/60 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">
                  {currentMessageIndex + 1} / {messages.length}
                </span>
                {currentMessage?.role === 'assistant' && character?.voice_id && !isMuted && (
                  <button
                    onClick={handlePlayVoice}
                    disabled={isPlaying}
                    className="p-1 text-white/60 hover:text-white disabled:opacity-50"
                  >
                    {isPlaying ? (
                      <Volume2 className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={nextMessage}
                disabled={currentMessageIndex === messages.length - 1}
                className="p-1 text-white/60 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* 消息内容 */}
          <div className="min-h-[60px]">
            {currentMessage ? (
              <div>
                <span className={`text-xs font-medium ${currentMessage.role === 'user' ? 'text-blue-400' : 'text-pink-400'}`}>
                  {currentMessage.role === 'user' ? '你' : character?.name}
                </span>
                <p className="text-white text-sm mt-1 leading-relaxed">
                  {currentMessage.role === 'user' ? currentMessage.content : typedText}
                  {isTyping && <span className="animate-pulse">▌</span>}
                </p>
              </div>
            ) : (
              <p className="text-white/50 text-sm text-center">
                {isLoading ? '正在输入...' : '开始对话吧~'}
              </p>
            )}
          </div>
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

  if (characterId) {
    return <VisualNovelChatPage characterId={characterId} />;
  }

  return <CharacterSelectPage onSelect={(id) => navigate(`/visual-novel/${id}`)} />;
};

export default VisualNovelPage;
